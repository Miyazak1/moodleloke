const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadRootEnv } = require('./load-root-env.cjs');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');
const tempDir = path.join(backendRoot, '.tmp');
fs.mkdirSync(tempDir, { recursive: true });
loadRootEnv();

const prismaBin = path.join(backendRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const maxAttempts = Number(process.env.PRISMA_GENERATE_ATTEMPTS || (process.platform === 'win32' ? 4 : 1));

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shouldRetry(output) {
  return /EPERM|EBUSY|operation not permitted|rename .*query_engine/i.test(output);
}

function hasGeneratedClient() {
  return (
    fs.existsSync(path.join(backendRoot, 'node_modules', '@prisma', 'client', 'index.d.ts')) &&
    fs.existsSync(path.join(backendRoot, 'node_modules', '.prisma', 'client', 'index.js'))
  );
}

let lastStatus = 1;
let lastWasFileLock = false;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(prismaBin, ['generate', '--schema', path.join(backendRoot, 'prisma', 'schema.prisma')], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMP: tempDir,
      TEMP: tempDir
    },
    shell: process.platform === 'win32'
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  lastStatus = result.status ?? 1;
  if (lastStatus === 0) process.exit(0);

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  lastWasFileLock = shouldRetry(output);
  if (attempt < maxAttempts && lastWasFileLock) {
    const delayMs = attempt * 1500;
    console.warn(`Prisma generate hit a transient Windows file lock; retrying in ${delayMs}ms (${attempt + 1}/${maxAttempts}).`);
    sleep(delayMs);
    continue;
  }
  break;
}

if (
  process.platform === 'win32' &&
  lastWasFileLock &&
  process.env.PRISMA_GENERATE_ALLOW_LOCKED_CLIENT !== 'false' &&
  hasGeneratedClient()
) {
  console.warn('Prisma generate could not replace the Windows query engine because a local process is holding it.');
  console.warn('Continuing with the existing generated Prisma client. Stop the local backend and rerun prisma:generate before committing schema changes.');
  process.exit(0);
}

process.exit(lastStatus);
