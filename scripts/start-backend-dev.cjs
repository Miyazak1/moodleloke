const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['run', 'dev'], {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
