const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function run(label, args) {
  console.log(`\n[deploy] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
}

try {
  run('Prisma migrate deploy', ['scripts/prisma-cli.cjs', 'migrate', 'deploy']);
  run('Ensure mock exams', ['scripts/ensure-mock-exams.cjs']);
  run('Ensure special practice', ['scripts/ensure-special-practice.cjs']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
