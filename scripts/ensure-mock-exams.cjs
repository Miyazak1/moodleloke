const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const prisma = new PrismaClient();

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
}

async function main() {
  const publishedCount = await prisma.mockExamPaper.count({ where: { status: 'published' } });
  if (publishedCount > 0) {
    console.log(`Mock exam seed skipped: ${publishedCount} published paper(s) already exist.`);
    return;
  }

  console.log('No published mock exam papers found. Seeding default CSCA mock exams...');
  run('mock exam seed', process.execPath, ['scripts/seed-mock-exams.cjs']);
  run('mock exam validation', process.execPath, ['scripts/validate-mock-exams.cjs']);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
