const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const composeFile = path.join(root, 'deploy', 'docker-compose.prod.yml');
const projectName = process.env.DOCKER_COMPOSE_PROJECT || process.env.CSC_DOCKER_PROJECT || 'cscalite-verify';
const frontendPort = process.env.CSC_DOCKER_HTTP_PORT || '18080';
const localBaseUrl = process.env.LOCAL_STAGING_BASE_URL || `http://127.0.0.1:${frontendPort}`;
const metricsToken = process.env.OPS_METRICS_TOKEN || process.env.STAGING_METRICS_TOKEN || 'local-staging-metrics-token';
const startupTimeoutMs = Number(process.env.DOCKER_STAGING_TIMEOUT_MS || 120000);
const buildImages = process.env.DOCKER_STAGING_BUILD === 'true';

function resolveAppVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  return result.status === 0 ? result.stdout.trim() : 'docker-local-staging';
}

function run(label, command, args, options = {}) {
  console.log(`\n[docker-staging] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: command === 'npm' && process.platform === 'win32',
    env: buildEnv(),
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function buildEnv() {
  return {
    ...process.env,
    CSC_DOCKER_HTTP_PORT: frontendPort,
    PUBLIC_APP_ORIGIN: localBaseUrl,
    CORS_ORIGINS: localBaseUrl,
    AUTH_REFRESH_COOKIE_ENABLED: 'true',
    AUTH_LEGACY_REFRESH_FALLBACK_ENABLED: 'false',
    AUTH_COOKIE_SECURE: 'false',
    OPS_METRICS_ENABLED: 'true',
    OPS_METRICS_TOKEN: metricsToken,
    STAGING_METRICS_TOKEN: metricsToken,
    APP_VERSION: resolveAppVersion()
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady() {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const ready = await fetch(`${localBaseUrl}/api/v1/ops/ready`, {
        headers: { 'x-request-id': 'docker-staging-ready' }
      });
      const readyBody = await ready.json().catch(() => ({}));
      const home = await fetch(`${localBaseUrl}/`);
      const homeText = await home.text();
      if (ready.status === 200 && readyBody.status === 'ready' && home.status === 200 && /CSCAlite|<div id="root"/.test(homeText)) {
        return;
      }
      lastError = new Error(`ready=${ready.status} ${JSON.stringify(readyBody)} home=${home.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1500);
  }
  throw new Error(`local Docker staging did not become ready. Last error: ${lastError?.message}`);
}

function logs() {
  spawnSync('docker', ['compose', '-p', projectName, '-f', composeFile, 'logs', '--no-color', '--tail', '200'], {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
}

async function main() {
  run('docker version', 'docker', ['version']);
  run('compose config', 'docker', ['compose', '-p', projectName, '-f', composeFile, 'config']);
  if (buildImages) {
    run('compose build', 'docker', ['compose', '-p', projectName, '-f', composeFile, 'build']);
  }
  run('compose up', 'docker', ['compose', '-p', projectName, '-f', composeFile, 'up', '-d']);
  try {
    await waitForReady();
    run('docker status evidence', process.execPath, ['scripts/verify-docker-status.cjs']);
    run('local staging full verification', process.execPath, ['scripts/verify-staging.cjs', '--full'], {
      env: {
        ...buildEnv(),
        LOCAL_STAGING_BASE_URL: localBaseUrl,
        STAGING_BASE_URL: ''
      }
    });
    run('local staging browser E2E', 'npm', ['--prefix', 'frontend', 'run', 'test:e2e'], {
      env: {
        ...buildEnv(),
        E2E_BASE_URL: localBaseUrl,
        E2E_SKIP_WEB_SERVER: '1'
      }
    });
    console.log(`CSCAlite local Docker staging verification passed: ${localBaseUrl}`);
    console.log('Cleanup note: this script leaves the staging stack running for inspection.');
    console.log(`To stop it later: docker compose -p ${projectName} -f deploy/docker-compose.prod.yml down`);
  } catch (error) {
    logs();
    throw error;
  }
}

main().catch((error) => {
  console.error(`CSCAlite local Docker staging verification failed: ${error.message}`);
  process.exit(1);
});
