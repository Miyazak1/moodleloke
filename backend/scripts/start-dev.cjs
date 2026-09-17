const { spawnSync } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { loadRootEnv } = require('./load-root-env.cjs');

const backendRoot = path.resolve(__dirname, '..');
loadRootEnv();

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const port = Number(process.env.PORT || 3000);

function requestHealth() {
  return new Promise((resolve) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/v1/health', timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => resolve(null));
  });
}

function canListen() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      resolve(error && error.code === 'EADDRINUSE' ? false : true);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '::');
  });
}

async function assertPortAvailable() {
  if (await canListen()) return;
  const health = await requestHealth();
  if (health?.service === 'moodlelike-backend') {
    console.log(`Moodlelike backend is already running on http://localhost:${port}.`);
    process.exit(0);
  }
  console.error(`Port ${port} is already in use by another process. Stop it or set PORT to a free port before starting the backend.`);
  process.exit(1);
}

async function main() {
  await assertPortAvailable();

  const generate = spawnSync(npmCommand, ['run', 'prisma:generate'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  if (generate.error || generate.status !== 0) {
    if (generate.error) console.error(generate.error);
    process.exit(generate.status || 1);
  }

  const startScript = process.env.CSCALITE_BACKEND_WATCH === '0' ? 'start:dev' : 'start:watch';
  const start = spawnSync(npmCommand, ['run', startScript], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  if (start.error) {
    console.error(start.error);
    process.exit(1);
  }

  process.exit(start.status ?? 1);
}

void main();
