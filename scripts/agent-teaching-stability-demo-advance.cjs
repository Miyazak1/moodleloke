const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const root = path.resolve(__dirname, '..');
const scenarioPath = path.join(root, '.local', 'agent-teaching-browser-demo.json');
const marker = 'LOCAL_DEMO_ONLY_AGENT_TEACHING_BROWSER';

loadEnv();
const prisma = new PrismaClient();

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertLocalWrite() {
  assert(process.argv.includes('--apply'), 'Refusing to write without --apply.');
  assert(process.env.NODE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'Agent stability demo advance is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), `Demo advance only accepts a local database, received ${databaseUrl.hostname || 'unset'}.`);
  assert(fs.existsSync(scenarioPath), 'Missing teaching scenario. Run agent-teaching-browser-demo-prepare.cjs --apply first.');
}

async function main() {
  assertLocalWrite();
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  assert(scenario.marker === marker, 'The scenario file is not the isolated Agent teaching demo.');
  const verification = await prisma.learningInterventionVerification.findFirst({
    where: {
      userId: Number(scenario.userId),
      conversationId: String(scenario.conversationId),
      status: 'scheduled'
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }]
  });
  assert(verification, 'No scheduled stability verification is waiting to become due.');
  assert(verification.phase === 'retention' || verification.phase === 'transfer', `Cannot advance phase ${verification.phase}.`);
  const now = new Date();
  await prisma.learningInterventionVerification.update({
    where: { id: verification.id },
    data: { dueAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) }
  });
  console.log(JSON.stringify({ status: 'advanced', verificationId: verification.id, phase: verification.phase, dueAt: now.toISOString() }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
