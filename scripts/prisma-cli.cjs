const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);
const tempDir = path.join(root, 'backend', '.tmp');
fs.mkdirSync(tempDir, { recursive: true });

const args = process.argv.slice(2);
const env = {
  ...process.env,
  TMP: tempDir,
  TEMP: tempDir,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:56432/moodlelike?schema=public'
};

const backendRoot = path.join(root, 'backend');
const prismaBin = path.join(backendRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const result = spawnSync(prismaBin, [...args, '--schema', 'prisma/schema.prisma'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
