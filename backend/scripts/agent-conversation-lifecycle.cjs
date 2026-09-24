const { PrismaClient } = require('@prisma/client');
const { AgentConversationLifecycleService } = require('../dist/backend/src/agent/agent-conversation-lifecycle.service');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const confirmation = process.argv.find((item) => item.startsWith('--confirm='))?.slice('--confirm='.length) || '';
if (apply && confirmation !== 'PURGE_PRACTICE_QA') {
  throw new Error('Apply mode requires --confirm=PURGE_PRACTICE_QA after reviewing the dry-run output.');
}
const batchArgument = process.argv.find((item) => item.startsWith('--batch-size='));
const batchSize = batchArgument ? Number(batchArgument.slice('--batch-size='.length)) : 100;

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const service = new AgentConversationLifecycleService(prisma);
    const report = await service.run({ dryRun: !apply, batchSize });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
