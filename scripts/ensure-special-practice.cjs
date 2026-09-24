const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const prisma = new PrismaClient();

function run(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
}

async function main() {
  const publishedCount = await prisma.specialPracticeTopic.count({ where: { status: 'published' } });
  if (publishedCount === 0) {
    console.log('No published special-practice topics found. Seeding the fixed question bank...');
    run('special-practice seed', ['scripts/seed-special-practice.cjs']);
  } else {
    console.log(`Special-practice seed skipped: ${publishedCount} published topic(s) already exist.`);
  }
  run('special-practice validation', ['scripts/validate-special-practice.cjs']);
  run('adaptive topic mapping seed', ['scripts/seed-csca-adaptive-topic-mapping.cjs']);
  run('adaptive topic mapping validation', ['scripts/validate-csca-adaptive-topic-mapping.cjs']);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
