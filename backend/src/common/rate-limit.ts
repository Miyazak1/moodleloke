import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Socket, createConnection } from 'node:net';
import { TLSSocket, connect as connectTls } from 'node:tls';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const REDIS_RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

function rateLimitStore() {
  return (process.env.RATE_LIMIT_STORE ?? '').trim().toLowerCase();
}

function redisUrl() {
  return (process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
}

function redisTimeoutMs() {
  const value = Number(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS ?? 500);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 5000) : 500;
}

function encodeRedisCommand(parts: Array<string | number>) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parseRedisResponse(raw: string): unknown {
  let offset = 0;
  const readLine = () => {
    const end = raw.indexOf('\r\n', offset);
    if (end < 0) throw new Error('Invalid Redis response.');
    const line = raw.slice(offset, end);
    offset = end + 2;
    return line;
  };
  const readValue = (): unknown => {
    const marker = raw[offset];
    offset += 1;
    if (marker === '+') return readLine();
    if (marker === '-') throw new Error(readLine());
    if (marker === ':') return Number(readLine());
    if (marker === '$') {
      const length = Number(readLine());
      if (length < 0) return null;
      const value = raw.slice(offset, offset + length);
      offset += length + 2;
      return value;
    }
    if (marker === '*') {
      const length = Number(readLine());
      const values: unknown[] = [];
      for (let index = 0; index < length; index += 1) values.push(readValue());
      return values;
    }
    throw new Error('Unknown Redis response type.');
  };
  return readValue();
}

function openRedisSocket(url: URL, timeoutMs: number) {
  return new Promise<Socket | TLSSocket>((resolve, reject) => {
    const port = url.port ? Number(url.port) : 6379;
    const host = url.hostname || '127.0.0.1';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Redis rate limit connection timed out.'));
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve(socket);
    };
    const socket = url.protocol === 'rediss:'
      ? connectTls({ host, port, servername: host }, onReady)
      : createConnection({ host, port }, onReady);
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function sendRedisCommand(socket: Socket | TLSSocket, parts: Array<string | number>, timeoutMs: number) {
  return new Promise<unknown>((resolve, reject) => {
    let response = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Redis rate limit command timed out.'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };
    const onData = (chunk: Buffer) => {
      response += chunk.toString('utf8');
      try {
        const parsed = parseRedisResponse(response);
        cleanup();
        resolve(parsed);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Invalid Redis response')) return;
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

async function incrementRedisRateLimit(key: string, windowMs: number) {
  const configuredUrl = redisUrl();
  if (!configuredUrl) {
    throw new ServiceUnavailableException('Redis rate limit store is not configured.');
  }
  const url = new URL(configuredUrl);
  const timeoutMs = redisTimeoutMs();
  const socket = await openRedisSocket(url, timeoutMs);
  try {
    if (url.password) {
      const username = decodeURIComponent(url.username || 'default');
      const password = decodeURIComponent(url.password);
      await sendRedisCommand(socket, url.username ? ['AUTH', username, password] : ['AUTH', password], timeoutMs);
    }
    const db = url.pathname.replace('/', '');
    if (db) {
      await sendRedisCommand(socket, ['SELECT', db], timeoutMs);
    }
    const value = await sendRedisCommand(socket, ['EVAL', REDIS_RATE_LIMIT_SCRIPT, 1, `cscalite:rate:${key}`, windowMs], timeoutMs);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Redis rate limit script returned an invalid value.');
    }
    return value;
  } finally {
    socket.end();
  }
}

function incrementMemoryRateLimit(key: string, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  current.count += 1;
  return current.count;
}

export async function assertRateLimit(key: string, limit: number, windowMs: number, message: string) {
  let count: number;
  try {
    count = rateLimitStore() === 'redis'
      ? await incrementRedisRateLimit(key, windowMs)
      : incrementMemoryRateLimit(key, windowMs);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException('Rate limit store is unavailable.');
  }

  if (count > limit) {
    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export function resetRateLimitForTests() {
  buckets.clear();
}

export function getRateLimitReadiness() {
  const store = rateLimitStore() === 'redis' ? 'redis' : 'memory';
  return {
    store,
    shared: store === 'redis',
    configured: store === 'memory' || Boolean(redisUrl())
  };
}
