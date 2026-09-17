const { spawn } = require('node:child_process');
const net = require('node:net');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const port = Number(process.env.OPS_SMOKE_PORT || 3010);
const baseUrl = process.env.OPS_SMOKE_BASE_URL || `http://127.0.0.1:${port}`;
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const metricsToken = 'ops-smoke-token';

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
  if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (!process.env.PAYMENT_CALLBACK_SECRET) missing.push('PAYMENT_CALLBACK_SECRET');
  if (missing.length) {
    throw new Error(`ops smoke needs env: ${missing.join(', ')}`);
  }
}

function assertNoSecretLeak(value) {
  const source = JSON.stringify(value);
  for (const secret of [process.env.AUTH_SECRET, process.env.JWT_SECRET, process.env.PAYMENT_CALLBACK_SECRET, process.env.OPS_METRICS_TOKEN, metricsToken]) {
    if (secret && source.includes(secret)) {
      throw new Error('ops response leaked a configured secret');
    }
  }
}

async function readJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function waitUntilReady() {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const { response, body } = await readJson('/api/v1/ops/ready', {
        headers: { 'x-request-id': 'ops-smoke-ready' }
      });
      if (response.status === 200 && body.status === 'ready' && body.database?.connected === true) return;
      lastError = new Error(`/api/v1/ops/ready returned ${response.status} ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`ops smoke backend did not become ready. Last error: ${lastError?.message}`);
}

async function runAssertions() {
  const healthResponse = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { 'x-request-id': 'ops-smoke-health' }
  });
  const health = await healthResponse.json();
  if (health.status !== 'ok') throw new Error('/api/v1/health must be ok');
  assertNoSecretLeak(health);

  const expectedHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
  for (const [header, expected] of Object.entries(expectedHeaders)) {
    const actual = healthResponse.headers.get(header);
    if (actual !== expected) throw new Error(`${header} expected ${expected}, got ${actual}`);
  }
  const csp = healthResponse.headers.get('content-security-policy-report-only') || healthResponse.headers.get('content-security-policy');
  if (!csp || !csp.includes("default-src 'self'") || !csp.includes('report-uri')) {
    throw new Error('CSP header is missing required directives');
  }

  const metricsDenied = await readJson('/api/v1/ops/metrics');
  if (metricsDenied.response.status !== 401) {
    throw new Error(`metrics without token must return 401, got ${metricsDenied.response.status}`);
  }

  const metricsAllowed = await readJson('/api/v1/ops/metrics', {
    headers: { Authorization: `Bearer ${metricsToken}` }
  });
  if (metricsAllowed.response.status !== 200 || typeof metricsAllowed.body.requests?.total !== 'number') {
    throw new Error('metrics with token must return a metrics snapshot');
  }
  assertNoSecretLeak(metricsAllowed.body);

  const metricsText = await fetch(`${baseUrl}/api/v1/ops/metrics?format=prometheus`, {
    headers: { Authorization: `Bearer ${metricsToken}`, Accept: 'text/plain' }
  });
  const metricsTextBody = await metricsText.text();
  if (metricsText.status !== 200 || !metricsTextBody.includes('cscalite_requests_total')) {
    throw new Error('metrics prometheus text output must be available');
  }
  assertNoSecretLeak(metricsTextBody);

  const cspReport = await readJson('/api/v1/ops/csp-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'csp-report': {
        'document-uri': 'https://www.example.com/?token=secret-token',
        'violated-directive': 'script-src'
      }
    })
  });
  if (cspReport.response.status >= 400 || cspReport.body.received !== true) {
    throw new Error('CSP report endpoint must acknowledge reports');
  }
}

async function main() {
  requireEnv();
  if (await isPortOpen(port)) {
    throw new Error(`ops smoke port ${port} is already in use`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CSC_ENV: 'production',
      AUTH_SECRET: process.env.OPS_SMOKE_AUTH_SECRET || 'ops-smoke-auth-secret-not-for-production-2026',
      JWT_SECRET: process.env.OPS_SMOKE_AUTH_SECRET || 'ops-smoke-auth-secret-not-for-production-2026',
      PAYMENT_CALLBACK_SECRET: process.env.OPS_SMOKE_PAYMENT_CALLBACK_SECRET || 'ops-smoke-payment-secret-not-for-production-2026',
      ALLOW_LOCAL_DATABASE_IN_PRODUCTION: '1',
      PORT: String(port),
      LOG_FORMAT: 'json',
      CSP_MODE: 'report-only',
      CSP_REPORT_URI: '/api/v1/ops/csp-report',
      OPS_METRICS_ENABLED: 'true',
      OPS_METRICS_TOKEN: metricsToken,
      OPS_HEALTH_DETAILS_ENABLED: 'true',
      APP_VERSION: process.env.APP_VERSION || 'ops-smoke'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[ops-backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[ops-backend] ${chunk}`));

  try {
    await waitUntilReady();
    await runAssertions();
    console.log('CSCAlite ops smoke passed.');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

main().catch((error) => {
  console.error(`CSCAlite ops smoke failed: ${error.message}`);
  process.exit(1);
});
