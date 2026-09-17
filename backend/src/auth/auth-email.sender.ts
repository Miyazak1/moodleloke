import { Socket, connect as netConnect } from 'node:net';
import { connect as tlsConnect, TLSSocket } from 'node:tls';

export type AppEmailMessage = {
  to: string;
  subject: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  secure: boolean;
};

type SmtpSocket = Socket | TLSSocket;

declare global {
  // eslint-disable-next-line no-var
  var __CSC_AUTH_EMAILS__: AppEmailMessage[] | undefined;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!host || !from) return null;
  const port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587));
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user: process.env.SMTP_USER?.trim() || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from,
    secure: process.env.SMTP_SECURE === 'true'
  };
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeader(value: string) {
  const escaped = escapeHeader(value);
  if (/^[\x00-\x7F]*$/.test(escaped)) return escaped;
  return `=?UTF-8?B?${Buffer.from(escaped, 'utf8').toString('base64')}?=`;
}

function encodeBase64Body(value: string) {
  const normalized = value.replace(/\r?\n/g, '\r\n');
  return Buffer.from(normalized, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

function messageIdDomain(from: string) {
  const domain = from.split('@')[1]?.replace(/[>\s]/g, '').trim();
  return domain || 'cscalite.local';
}

function isCompleteSmtpResponse(value: string) {
  const lines = value.split(/\r?\n/).filter(Boolean);
  const lastLine = lines.at(-1) ?? '';
  return /^\d{3} /.test(lastLine);
}

function formatMessage(message: AppEmailMessage, from: string) {
  return [
    `From: ${encodeHeader(from)}`,
    `To: ${escapeHeader(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${randomString()}@${messageIdDomain(from)}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Body(message.text)
  ].join('\r\n');
}

function randomString() {
  return Math.random().toString(36).slice(2, 12);
}

function readLine(socket: SmtpSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (isCompleteSmtpResponse(buffer)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function command(socket: SmtpSocket, line: string, expected: number[]) {
  socket.write(`${line}\r\n`);
  const response = await readLine(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed with ${code}.`);
  }
  return response;
}

function openSocket(config: SmtpConfig): Promise<SmtpSocket> {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? tlsConnect(config.port, config.host, { servername: config.host }, () => resolve(socket))
      : netConnect(config.port, config.host, () => resolve(socket));
    socket.setTimeout(12000, () => {
      socket.destroy(new Error('SMTP connection timed out.'));
    });
    socket.once('error', reject);
  });
}

async function sendViaSmtp(config: SmtpConfig, message: AppEmailMessage) {
  const socket = await openSocket(config);
  try {
    const greeting = await readLine(socket);
    if (Number(greeting.slice(0, 3)) !== 220) throw new Error('SMTP server did not accept connection.');
    await command(socket, 'EHLO cscalite.local', [250]);
    if (config.user && config.password) {
      await command(socket, 'AUTH LOGIN', [334]);
      await command(socket, Buffer.from(config.user).toString('base64'), [334]);
      await command(socket, Buffer.from(config.password).toString('base64'), [235]);
    }
    await command(socket, `MAIL FROM:<${config.from}>`, [250]);
    await command(socket, `RCPT TO:<${message.to}>`, [250, 251]);
    await command(socket, 'DATA', [354]);
    socket.write(`${formatMessage(message, config.from)}\r\n.\r\n`);
    const dataResponse = await readLine(socket);
    if (Number(dataResponse.slice(0, 3)) !== 250) throw new Error('SMTP DATA rejected.');
    await command(socket, 'QUIT', [221]);
  } finally {
    socket.destroy();
  }
}

export async function sendAppEmail(message: AppEmailMessage) {
  if (process.env.AUTH_EMAIL_CAPTURE === 'true') {
    globalThis.__CSC_AUTH_EMAILS__ = globalThis.__CSC_AUTH_EMAILS__ ?? [];
    globalThis.__CSC_AUTH_EMAILS__.push(message);
    return { sent: true, captured: true };
  }
  const config = getSmtpConfig();
  if (!config) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[auth-email] SMTP is not configured; skipped email to ${message.to}.`);
    }
    return { sent: false, skipped: true };
  }
  await sendViaSmtp(config, message);
  return { sent: true };
}

export async function sendAuthEmail(message: AppEmailMessage) {
  return sendAppEmail(message);
}
