const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const prisma = new PrismaClient();

function readDays(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${name} must be a positive number of days.`);
  }
  return value;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function countAndMaybeDelete(label, model, where) {
  const count = await model.count({ where });
  if (!execute) return { label, count, deleted: 0 };
  const result = await model.deleteMany({ where });
  return { label, count, deleted: result.count };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for security data cleanup.');
  }

  const authEmailTokenDays = readDays('CLEANUP_AUTH_EMAIL_TOKEN_DAYS', 7);
  const refreshSessionDays = readDays('CLEANUP_REFRESH_SESSION_DAYS', 30);
  const paymentCallbackDays = readDays('CLEANUP_PAYMENT_CALLBACK_LOG_DAYS', 90);

  const authEmailTokenCutoff = daysAgo(authEmailTokenDays);
  const refreshSessionCutoff = daysAgo(refreshSessionDays);
  const paymentCallbackCutoff = daysAgo(paymentCallbackDays);

  const results = [];
  results.push(await countAndMaybeDelete('auth_email_tokens', prisma.authEmailToken, {
    OR: [
      { usedAt: { not: null, lt: authEmailTokenCutoff } },
      { expiresAt: { lt: authEmailTokenCutoff } }
    ]
  }));
  results.push(await countAndMaybeDelete('refresh_sessions', prisma.refreshSession, {
    OR: [
      { revokedAt: { not: null, lt: refreshSessionCutoff } },
      { expiresAt: { lt: refreshSessionCutoff } }
    ]
  }));
  results.push(await countAndMaybeDelete('payment_callback_logs', prisma.paymentCallbackLog, {
    createdAt: { lt: paymentCallbackCutoff }
  }));

  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'dry-run',
    cutoffs: {
      authEmailTokensBefore: authEmailTokenCutoff.toISOString(),
      refreshSessionsBefore: refreshSessionCutoff.toISOString(),
      paymentCallbackLogsBefore: paymentCallbackCutoff.toISOString()
    },
    results
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`CSCAlite security data cleanup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
