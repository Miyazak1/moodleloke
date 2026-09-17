const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const composeFile = path.join(root, 'deploy', 'docker-compose.prod.yml');
const projectName = process.env.CSC_DOCKER_PROJECT || 'cscalite-verify';
const frontendPort = process.env.CSC_DOCKER_HTTP_PORT || '18080';
const baseUrl = `http://127.0.0.1:${frontendPort}`;
const startupTimeoutMs = Number(process.env.DOCKER_VERIFY_TIMEOUT_MS || 120000);

function resolveAppVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  return result.status === 0 ? result.stdout.trim() : 'docker-verify';
}

function run(label, args, options = {}) {
  console.log(`\n[docker] ${label}`);
  const result = spawnSync('docker', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CSC_DOCKER_HTTP_PORT: frontendPort,
      APP_VERSION: resolveAppVersion()
    },
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStack() {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const ready = await fetch(`${baseUrl}/api/v1/ops/ready`);
      const readyBody = await ready.json();
      const home = await fetch(`${baseUrl}/`);
      const homeText = await home.text();
      if (ready.status === 200 && readyBody.status === 'ready' && home.status === 200 && /CSCA|CSCAlite/.test(homeText)) {
        return;
      }
      lastError = new Error(`ready=${ready.status} ${JSON.stringify(readyBody)} home=${home.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1500);
  }
  throw new Error(`Docker stack did not become ready. Last error: ${lastError?.message}`);
}

function logs() {
  spawnSync('docker', ['compose', '-p', projectName, '-f', composeFile, 'logs', '--no-color', '--tail', '200'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
}

async function main() {
  run('docker version', ['version']);
  run('compose config', ['compose', '-p', projectName, '-f', composeFile, 'config']);
  run('compose build', ['compose', '-p', projectName, '-f', composeFile, 'build']);

  try {
    run('compose up', ['compose', '-p', projectName, '-f', composeFile, 'up', '-d']);
    await waitForStack();
    console.log('CSCAlite docker verification passed.');
  } catch (error) {
    logs();
    throw error;
  } finally {
    run('compose down', ['compose', '-p', projectName, '-f', composeFile, 'down', '--volumes', '--remove-orphans']);
  }
}

main().catch((error) => {
  console.error(`CSCAlite docker verification failed: ${error.message}`);
  process.exit(1);
});
