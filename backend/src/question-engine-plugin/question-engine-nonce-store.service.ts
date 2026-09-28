import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Socket, createConnection } from 'node:net';
import { TLSSocket, connect as connectTls } from 'node:tls';

function configuredRedisUrl(env: NodeJS.ProcessEnv = process.env) {
  return String(env.QUESTION_ENGINE_NONCE_REDIS_URL || env.REDIS_URL || '').trim();
}

function configuredTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(env.QUESTION_ENGINE_NONCE_REDIS_TIMEOUT_MS ?? 750);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 5000) : 750;
}

function encodeRedisCommand(parts: Array<string | number>) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parseRedisResponse(raw: string): string | number | null | undefined {
  const lineEnd = raw.indexOf('\r\n');
  if (lineEnd < 0) return undefined;
  const header = raw.slice(1, lineEnd);
  if (raw.startsWith('+')) return header;
  if (raw.startsWith(':')) return Number(header);
  if (raw.startsWith('$')) {
    const length = Number(header);
    if (length === -1) return null;
    if (!Number.isInteger(length) || length < 0) throw new Error('question_engine_nonce_redis_response_invalid');
    const valueStart = lineEnd + 2;
    if (raw.length < valueStart + length + 2) return undefined;
    return raw.slice(valueStart, valueStart + length);
  }
  if (raw.startsWith('-')) throw new Error(`question_engine_nonce_redis_error:${header}`);
  throw new Error('question_engine_nonce_redis_response_invalid');
}

function openSocket(url: URL, timeoutMs: number) {
  return new Promise<Socket | TLSSocket>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, socket?: Socket | TLSSocket) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (socket) resolve(socket);
    };
    const port = url.port ? Number(url.port) : 6379;
    const host = url.hostname || '127.0.0.1';
    const socket = url.protocol === 'rediss:'
      ? connectTls({ host, port, servername: host }, () => finish(undefined, socket))
      : createConnection({ host, port }, () => finish(undefined, socket));
    const timer = setTimeout(() => {
      socket.destroy();
      finish(new Error('question_engine_nonce_redis_connection_timeout'));
    }, timeoutMs);
    socket.once('error', (error) => finish(error));
  });
}

function sendCommand(socket: Socket | TLSSocket, parts: Array<string | number>, timeoutMs: number) {
  return new Promise<string | number | null>((resolve, reject) => {
    let raw = '';
    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error('question_engine_nonce_redis_command_timeout'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };
    const onData = (chunk: Buffer) => {
      raw += chunk.toString('utf8');
      try {
        const parsed = parseRedisResponse(raw);
        if (parsed === undefined) return;
        cleanup();
        resolve(parsed);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.on('data', onData);
    socket.once('error', onError);
    socket.write(encodeRedisCommand(parts));
  });
}

export function questionEngineNonceStoreConfigured(env: NodeJS.ProcessEnv = process.env) {
  try {
    const url = new URL(configuredRedisUrl(env));
    return url.protocol === 'redis:' || url.protocol === 'rediss:';
  } catch {
    return false;
  }
}

@Injectable()
export class QuestionEngineNonceStoreService {
  async claim(replayKey: string, ttlMs: number): Promise<boolean> {
    return this.withRedis(async (socket, timeoutMs) => {
      const digest = createHash('sha256').update(replayKey).digest('hex');
      const result = await sendCommand(socket, ['SET', `moodlelike:question-engine:nonce:${digest}`, '1', 'NX', 'PX', this.safeTtl(ttlMs)], timeoutMs);
      if (result === 'OK') return true;
      if (result === null) return false;
      throw new Error('question_engine_nonce_redis_claim_invalid');
    });
  }

  async getCompletedResult(taskId: string): Promise<string | null> {
    return this.withRedis(async (socket, timeoutMs) => {
      const result = await sendCommand(socket, ['GET', this.resultKey(taskId)], timeoutMs);
      if (result === null || typeof result === 'string') return result;
      throw new Error('question_engine_result_cache_read_invalid');
    });
  }

  async cacheCompletedResult(taskId: string, serializedResult: string, ttlMs: number): Promise<boolean> {
    if (Buffer.byteLength(serializedResult) > 2 * 1024 * 1024) throw new Error('question_engine_result_cache_value_too_large');
    return this.withRedis(async (socket, timeoutMs) => {
      const result = await sendCommand(socket, ['SET', this.resultKey(taskId), serializedResult, 'NX', 'PX', this.safeTtl(ttlMs)], timeoutMs);
      if (result === 'OK') return true;
      if (result === null) return false;
      throw new Error('question_engine_result_cache_write_invalid');
    });
  }

  private safeTtl(ttlMs: number) {
    return Math.min(Math.max(Math.floor(ttlMs), 1000), 600_000);
  }

  private resultKey(taskId: string) {
    const digest = createHash('sha256').update(taskId).digest('hex');
    return `moodlelike:question-engine:result:${digest}`;
  }

  private async withRedis<T>(run: (socket: Socket | TLSSocket, timeoutMs: number) => Promise<T>): Promise<T> {
    const configuredUrl = configuredRedisUrl();
    if (!configuredUrl) throw new Error('question_engine_nonce_store_not_configured');
    const url = new URL(configuredUrl);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') throw new Error('question_engine_nonce_store_url_invalid');
    const timeoutMs = configuredTimeoutMs();
    const socket = await openSocket(url, timeoutMs);
    try {
      if (url.password) {
        const username = decodeURIComponent(url.username || 'default');
        const password = decodeURIComponent(url.password);
        const authenticated = await sendCommand(socket, url.username ? ['AUTH', username, password] : ['AUTH', password], timeoutMs);
        if (authenticated !== 'OK') throw new Error('question_engine_nonce_redis_auth_failed');
      }
      const database = url.pathname.replace(/^\//, '');
      if (database) {
        const selected = await sendCommand(socket, ['SELECT', database], timeoutMs);
        if (selected !== 'OK') throw new Error('question_engine_nonce_redis_select_failed');
      }
      return await run(socket, timeoutMs);
    } finally {
      socket.end();
    }
  }
}
