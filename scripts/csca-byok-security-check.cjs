const { loadEnv } = require('./load-env.cjs');

loadEnv();

function hasStorageSecret() {
  return Boolean(
    String(process.env.CSCA_ORG_LLM_KEY_SECRET || '').trim()
    || String(process.env.AUTH_SECRET || '').trim()
    || String(process.env.JWT_SECRET || '').trim()
  );
}

function dbCheckEnabled() {
  return process.env.CSCA_BYOK_SECURITY_CHECK_DB === '1'
    || process.env.NODE_ENV === 'production'
    || process.env.CSC_ENV === 'production';
}

async function activeProviderSummary() {
  const { PrismaClient } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "activeCount",
        COUNT(*) FILTER (WHERE "encrypted_api_key" LIKE 'enc:v1:%')::int AS "encryptedCount",
        COUNT(*) FILTER (WHERE "encrypted_api_key" NOT LIKE 'enc:v1:%')::int AS "legacyCount"
      FROM "organization_llm_provider_configs"
      WHERE "status" = 'active'
    `;
    return rows[0] ?? { activeCount: 0, encryptedCount: 0, legacyCount: 0 };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const storageSecretConfigured = hasStorageSecret();
  if (!dbCheckEnabled()) {
    console.log(JSON.stringify({
      status: 'checked',
      dbCheck: 'skipped',
      storageSecretConfigured,
      note: 'Set CSCA_BYOK_SECURITY_CHECK_DB=1 or run with NODE_ENV/CSC_ENV=production to check active organization BYOK provider rows.'
    }, null, 2));
    console.log('CSCA BYOK security check passed.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('CSCA BYOK security DB check requires DATABASE_URL.');
  }

  const summary = await activeProviderSummary();
  if (summary.activeCount > 0 && !storageSecretConfigured) {
    throw new Error(`Active organization BYOK providers exist (${summary.activeCount}) but no CSCA_ORG_LLM_KEY_SECRET/AUTH_SECRET/JWT_SECRET is configured.`);
  }
  if (summary.activeCount > 0 && summary.legacyCount > 0 && process.env.CSCA_BYOK_BLOCK_LEGACY_SECRET_STORAGE === '1') {
    throw new Error(`Active organization BYOK providers include ${summary.legacyCount} legacy plaintext/base64/raw key storage value(s). Migrate or re-save them before release.`);
  }

  console.log(JSON.stringify({
    status: 'checked',
    dbCheck: 'completed',
    storageSecretConfigured,
    ...summary
  }, null, 2));
  console.log('CSCA BYOK security check passed.');
}

main().catch((error) => {
  console.error(`CSCA BYOK security check failed: ${error.message}`);
  process.exitCode = 1;
});
