const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const tempDir = path.join(root, '.tmp');
fs.mkdirSync(tempDir, { recursive: true });

const env = {
  ...process.env,
  TMP: tempDir,
  TEMP: tempDir
};

const prismaBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const schemaPath = path.join(root, 'backend', 'prisma', 'schema.prisma');

const result = spawnSync(prismaBin, ['generate', '--schema', schemaPath], {
  cwd: root,
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
