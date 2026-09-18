const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const port = Number(process.env.COOKIE_ONLY_SMOKE_PORT || 3020);
const baseUrl = `http://127.0.0.1:${port}`;
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const email = `cookie-only-${Date.now()}@moodlelike.local`;
const password = 'CookieOnly123';
const refreshCookieName = process.env.AUTH_REFRESH_COOKIE_NAME || 'moodlelike_refresh';
const csrfCookieName = process.env.AUTH_CSRF_COOKIE_NAME || 'moodlelike_csrf';
const csrfHeaderName = process.env.AUTH_CSRF_HEADER_NAME || 'x-csrf-token';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
}

function requireEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.JWT_SECRET) missing.push('AUTH_SECRET or JWT_SECRET');
  if (missing.length) {
    throw new Error(`cookie-only smoke needs env: ${missing.join(', ')}`);
  }
}

function collectSetCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const combined = response.headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,=\s]+=)/).map((value) => value.trim()) : [];
}

function applySetCookies(jar, response) {
  for (const item of collectSetCookies(response)) {
    const [pair] = item.split(';');
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (!name) continue;
    if (!value) delete jar[name.trim()];
    else jar[name.trim()] = value;
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');
}

function findCookie(response, name) {
  return collectSetCookies(response).find((cookie) => cookie.startsWith(`${name}=`));
}

async function readJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function waitUntilReady() {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const { response, body } = await readJson('/api/v1/ops/ready', {
        headers: { 'x-request-id': 'cookie-only-ready' }
      });
      if (response.status === 200 && body.status === 'ready') return;
      lastError = new Error(`/api/v1/ops/ready returned ${response.status} ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`cookie-only smoke backend did not become ready. Last error: ${lastError?.message}`);
}

async function cleanupSmokeUser() {
  const { PrismaClient } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { email } });
  } finally {
    await prisma.$disconnect();
  }
}

async function runAssertions() {
  const jar = {};
  const register = await readJson('/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      'x-request-id': 'cookie-only-register'
    },
    body: JSON.stringify({ email, password })
  });
  assert(register.response.ok, `register expected success, got ${register.response.status} ${JSON.stringify(register.body)}`);
  assert(register.body.tokens?.accessToken, 'register must return access token');
  assert(register.body.tokens?.refreshToken, 'register must retain compatible refresh token JSON field');
  applySetCookies(jar, register.response);

  const refreshCookie = findCookie(register.response, refreshCookieName);
  const csrfCookie = findCookie(register.response, csrfCookieName);
  assert(refreshCookie && /HttpOnly/i.test(refreshCookie), 'refresh cookie must be HttpOnly');
  assert(csrfCookie && !/HttpOnly/i.test(csrfCookie), 'csrf cookie must be readable');

  const missingCsrf = await readJson('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      Origin: baseUrl,
      'x-request-id': 'cookie-only-missing-csrf'
    }
  });
  assert(missingCsrf.response.status === 403, `cookie refresh without CSRF expected 403, got ${missingCsrf.response.status}`);

  const cookieRefresh = await readJson('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeaderName]: decodeURIComponent(jar[csrfCookieName]),
      Origin: baseUrl,
      'x-request-id': 'cookie-only-refresh'
    }
  });
  assert(cookieRefresh.response.ok && cookieRefresh.body.tokens?.accessToken, `cookie refresh expected success, got ${cookieRefresh.response.status}`);
  applySetCookies(jar, cookieRefresh.response);

  const bearerFallback = await readJson('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${register.body.tokens.refreshToken}`,
      Origin: baseUrl,
      'x-request-id': 'cookie-only-bearer-refresh'
    }
  });
  assert(bearerFallback.response.status === 401, `Bearer refresh fallback must be disabled, got ${bearerFallback.response.status}`);

  const crossOrigin = await readJson('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeaderName]: decodeURIComponent(jar[csrfCookieName]),
      Origin: 'https://evil.example',
      'x-request-id': 'cookie-only-cross-origin'
    }
  });
  assert(crossOrigin.response.status === 403, `cross-origin cookie refresh expected 403, got ${crossOrigin.response.status}`);

  const logout = await readJson('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeaderName]: decodeURIComponent(jar[csrfCookieName]),
      Origin: baseUrl,
      'x-request-id': 'cookie-only-logout'
    }
  });
  assert(logout.response.ok && logout.body.revoked === true, `logout expected revoked true, got ${logout.response.status}`);

  const afterLogout = await readJson('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeaderName]: jar[csrfCookieName] ? decodeURIComponent(jar[csrfCookieName]) : 'missing',
      Origin: baseUrl,
      'x-request-id': 'cookie-only-after-logout'
    }
  });
  assert(afterLogout.response.status === 401 || afterLogout.response.status === 403, `refresh after logout expected 401/403, got ${afterLogout.response.status}`);
}

async function main() {
  requireEnv();
  if (await isPortOpen(port)) {
    throw new Error(`cookie-only smoke port ${port} is already in use`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CSC_ENV: 'production',
      AUTH_SECRET: process.env.COOKIE_SMOKE_AUTH_SECRET || 'cookie-smoke-auth-secret-not-for-production-2026',
      JWT_SECRET: process.env.COOKIE_SMOKE_AUTH_SECRET || 'cookie-smoke-auth-secret-not-for-production-2026',
      PAYMENT_CALLBACK_SECRET: process.env.COOKIE_SMOKE_PAYMENT_CALLBACK_SECRET || 'cookie-smoke-payment-secret-not-for-production-2026',
      ALLOW_LOCAL_DATABASE_IN_PRODUCTION: '1',
      PORT: String(port),
      LOG_FORMAT: 'json',
      AUTH_REFRESH_COOKIE_ENABLED: 'true',
      AUTH_LEGACY_REFRESH_FALLBACK_ENABLED: 'false',
      AUTH_COOKIE_SECURE: 'false',
      AUTH_CSRF_COOKIE_NAME: csrfCookieName,
      AUTH_CSRF_HEADER_NAME: csrfHeaderName,
      CORS_ORIGINS: baseUrl,
      PUBLIC_APP_ORIGIN: baseUrl,
      ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@moodlelike.local',
      ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'AdminBootstrap123',
      APP_VERSION: process.env.APP_VERSION || 'cookie-only-smoke'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[cookie-backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[cookie-backend] ${chunk}`));

  try {
    await waitUntilReady();
    await runAssertions();
    console.log('CSCAlite cookie-only smoke passed.');
  } finally {
    await cleanupSmokeUser().catch((error) => {
      console.warn(`cookie-only cleanup warning: ${error.message}`);
    });
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

main().catch((error) => {
  console.error(`CSCAlite cookie-only smoke failed: ${error.message}`);
  process.exit(1);
});
