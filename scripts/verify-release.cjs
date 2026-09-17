const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function parsePort(url) {
  const parsed = new URL(url);
  if (parsed.port) return Number(parsed.port);
  return parsed.protocol === 'https:' ? 443 : 80;
}

function isPortOpen(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runStep(label, command, args, options = {}) {
  console.log(`\n[S19] ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...options
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function buildMissingEnv() {
  const env = { ...process.env, NODE_ENV: 'production', CSC_ENV: 'production' };
  for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'JWT_SECRET', 'PAYMENT_CALLBACK_SECRET', 'CORS_ORIGINS']) {
    delete env[key];
  }
  return env;
}

function buildProductionEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.JWT_SECRET) missing.push('AUTH_SECRET or JWT_SECRET');
  if (!process.env.PAYMENT_CALLBACK_SECRET) missing.push('PAYMENT_CALLBACK_SECRET');
  if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (missing.length) {
    throw new Error(`Release verification needs env before production startup smoke: ${missing.join(', ')}`);
  }
  return {
    ...process.env,
    NODE_ENV: 'production',
    CSC_ENV: 'production',
    AUTH_SECRET: process.env.RELEASE_SMOKE_AUTH_SECRET || 'release-smoke-auth-secret-not-for-production-2026',
    JWT_SECRET: process.env.RELEASE_SMOKE_AUTH_SECRET || 'release-smoke-auth-secret-not-for-production-2026',
    PAYMENT_CALLBACK_SECRET: process.env.RELEASE_SMOKE_PAYMENT_CALLBACK_SECRET || 'release-smoke-payment-secret-not-for-production-2026',
    ALLOW_LOCAL_DATABASE_IN_PRODUCTION: '1'
  };
}

function assertProductionMissingEnvFails() {
  const result = spawnSync(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: buildMissingEnv(),
    encoding: 'utf8'
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) {
    throw new Error('Production missing-env smoke expected backend startup to fail, but it exited successfully.');
  }
  if (!output.includes('Production startup blocked') || !output.includes('DATABASE_URL') || !output.includes('PAYMENT_CALLBACK_SECRET')) {
    throw new Error('Production missing-env smoke failed for an unexpected reason.');
  }
  console.log('[S19] Production missing-env fail-fast passed.');
}

async function assertProductionReadyStarts() {
  const port = parsePort(baseUrl);
  if (await isPortOpen(port)) {
    throw new Error(`Production ready smoke expected to start the built backend, but port ${port} is already in use.`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: buildProductionEnv(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[production-backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[production-backend] ${chunk}`));

  try {
    const deadline = Date.now() + startupTimeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Production ready smoke backend exited early with code ${child.exitCode}.`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/v1/ops/ready`, {
          headers: { 'x-request-id': 's19-production-ready-smoke' }
        });
        const body = await response.json();
        if (response.status === 200 && body.status === 'ready') {
          console.log('[S19] Production ready startup smoke passed.');
          return;
        }
        lastError = new Error(`/api/v1/ops/ready returned ${response.status} ${JSON.stringify(body)}`);
      } catch (error) {
        lastError = error;
      }
      await delay(500);
    }
    throw new Error(`Production ready smoke timed out. Last error: ${lastError?.message}`);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

async function main() {
  runStep('verify:local', npmCommand, ['run', 'verify:local']);
  runStep('verify:launch', npmCommand, ['run', 'verify:launch']);

  console.log('\n[S19] production env fail-fast smoke');
  assertProductionMissingEnvFails();
  await assertProductionReadyStarts();

  runStep('S18 smoke data dry-run', process.execPath, ['scripts/cleanup-s18-smoke-data.cjs'], {
    shell: false
  });

  console.log('\nCSCAlite S19 release verification passed.');
}

main().catch((error) => {
  console.error(`CSCAlite S19 release verification failed: ${error.message}`);
  process.exit(1);
});
