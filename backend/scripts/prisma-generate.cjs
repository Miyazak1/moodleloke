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

function generatedClientMatchesSchema() {
  const sourceSchema = path.join(backendRoot, 'prisma', 'schema.prisma');
  const generatedSchema = path.join(backendRoot, 'node_modules', '.prisma', 'client', 'schema.prisma');
  if (!hasGeneratedClient() || !fs.existsSync(generatedSchema)) return false;
  return fs.readFileSync(sourceSchema).equals(fs.readFileSync(generatedSchema));
}

function generatedClientMatchesRuntime() {
  try {
    const cliPackage = JSON.parse(fs.readFileSync(path.join(backendRoot, 'node_modules', 'prisma', 'package.json'), 'utf8'));
    const clientPackage = JSON.parse(fs.readFileSync(path.join(backendRoot, 'node_modules', '@prisma', 'client', 'package.json'), 'utf8'));
    return Boolean(cliPackage.version) && cliPackage.version === clientPackage.version;
  } catch {
    return false;
  }
}

if (
  process.platform === 'win32' &&
  process.env.PRISMA_GENERATE_FORCE !== 'true' &&
  generatedClientMatchesSchema() &&
  generatedClientMatchesRuntime()
) {
  console.log('Generated Prisma client already matches prisma/schema.prisma and the installed Prisma runtime; reusing it.');
  process.exit(0);
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
  if (
    process.platform === 'win32' &&
    lastWasFileLock &&
    process.env.PRISMA_GENERATE_ALLOW_LOCKED_CLIENT !== 'false' &&
    generatedClientMatchesSchema()
  ) {
    console.warn('Prisma engine is locked by the local backend, but the generated client exactly matches prisma/schema.prisma.');
    console.warn('Reusing the existing generated client without further retries.');
    process.exit(0);
  }
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
  generatedClientMatchesSchema()
) {
  console.warn('Prisma generate could not replace the Windows query engine because a local process is holding it.');
  console.warn('Continuing with the existing generated Prisma client. Stop the local backend and rerun prisma:generate before committing schema changes.');
  process.exit(0);
}

process.exit(lastStatus);
