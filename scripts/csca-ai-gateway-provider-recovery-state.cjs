#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { loadEnv } = require('./load-env.cjs');
const { AiGatewayConfigService } = require('../backend/src/ai-gateway/ai-gateway-config.service');
const { AiGatewayLedgerService } = require('../backend/src/ai-gateway/ai-gateway-ledger.service');

loadEnv();

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : null;
}

function truncate(value, max = 160) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function configuredGenerationModel() {
  return cleanText(
    process.env.CSCA_AI_QUESTION_GENERATION_MODEL
    || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL
    || process.env.DEEPSEEK_DEFAULT_MODEL
    || process.env.CSCA_AI_MODEL
    || 'deepseek-v4-flash'
  );
}

function providerKeyPoolSummary(providerConfig) {
  const config = new AiGatewayConfigService();
  const keys = config.platformKeysForTask('question_generation', providerConfig.model);
  return {
    taskType: 'question_generation',
    pool: keys[0]?.pool ?? null,
    configuredKeyCount: keys.length,
    enabledKeyCount: keys.filter((key) => key.enabled).length,
    keyIds: keys.map((key) => key.keyId),
    models: Array.from(new Set(keys.map((key) => key.model))).sort(),
    baseUrls: Array.from(new Set(keys.map((key) => key.baseUrl))).sort(),
    maxConcurrencyByKey: Array.from(new Set(keys.map((key) => key.maxConcurrency))).sort((left, right) => left - right),
    requestsPerMinuteByKey: Array.from(new Set(keys.map((key) => key.requestsPerMinute ?? null))).sort(),
    requestsPerDayByKey: Array.from(new Set(keys.map((key) => key.requestsPerDay ?? null))).sort()
  };
}

async function latestRecoveryProbeRecords(prisma, limit = 5) {
  const rows = await prisma.aiGatewayCallLog.findMany({
    where: {
      providerId: 'deepseek',
      sourceModule: 'ai_gateway_provider_recovery_probe'
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      requestId: true,
      taskType: true,
      sourceModule: true,
      providerId: true,
      model: true,
      keyId: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      latencyMs: true,
      createdAt: true,
      metadata: true
    }
  });
  return rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    taskType: row.taskType,
    sourceModule: row.sourceModule,
    providerId: row.providerId,
    model: row.model,
    keyId: row.keyId,
    status: row.status,
    errorCode: row.errorCode,
    errorMessagePreview: truncate(row.errorMessage),
    latencyMs: row.latencyMs,
    createdAt: iso(row.createdAt),
    requestedModel: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata.requestedModel ?? null
      : null,
    runtimeCleanConfirmed: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata.runtimeCleanConfirmed === true
      : false
  }));
}

async function main() {
  const providerConfig = {
    provider: cleanText(process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER || process.env.AI_DEFAULT_PROVIDER || process.env.CSCA_AI_PROVIDER || 'deepseek'),
    baseUrl: cleanText(process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL || process.env.DEEPSEEK_BACKGROUND_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'),
    model: configuredGenerationModel()
  };
  const prisma = new PrismaClient();
  try {
    const config = new AiGatewayConfigService();
    const ledger = new AiGatewayLedgerService(prisma, config);
    const hardStop = await ledger.providerHardStopState({
      providerId: 'deepseek',
      taskTypes: ['question_generation', 'question_review', 'question_repair', 'topic_mapping', 'translation', 'batch_backfill']
    });
    const probes = await latestRecoveryProbeRecords(prisma);
    const report = {
      mode: 'ai_gateway_provider_recovery_state',
      status: hardStop.active ? 'provider_hard_stop_active' : 'provider_hard_stop_clear',
      productionImpact: 'none_read_only_provider_recovery_state',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_ai_gateway_call_logs',
      studentConsumableImpact: 'none',
      providerConfig,
      keyPoolSummary: providerKeyPoolSummary(providerConfig),
      hardStop: {
        active: hardStop.active,
        providerId: hardStop.providerId,
        latestHardStopAt: iso(hardStop.latestHardStopAt),
        latestRecoverySuccessAt: iso(hardStop.latestRecoverySuccessAt),
        recoveredAfterHardStop: Boolean(hardStop.latestRecoverySuccessAt && hardStop.latestHardStopAt && hardStop.latestRecoverySuccessAt > hardStop.latestHardStopAt),
        errorCode: hardStop.errorCode ?? null,
        errorMessagePreview: truncate(hardStop.errorMessage),
        sourceModule: hardStop.sourceModule ?? null,
        taskType: hardStop.taskType ?? null,
        subject: hardStop.subject ?? null,
        topicId: hardStop.topicId ?? null,
        blueprintId: hardStop.blueprintId ?? null
      },
      latestRecoveryProbeRecords: probes,
      nextSafeAction: hardStop.active
        ? 'repair_or_replace_background_deepseek_keys_then_rerun_one_authorized_recovery_probe'
        : 'rerun_subject_practice_next_action_then_exact_scoped_math_observation',
      safetyBoundary: [
        'does_not_call_provider',
        'does_not_write_database',
        'does_not_enqueue_or_process_generation_jobs',
        'does_not_publish_student_questions'
      ]
    };
    if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Provider recovery state: ${report.status}`);
      console.log(`- latest hard-stop: ${report.hardStop.errorCode || 'none'} at ${report.hardStop.latestHardStopAt || 'n/a'}`);
      console.log(`- latest recovery success: ${report.hardStop.latestRecoverySuccessAt || 'none'}`);
      console.log(`- next: ${report.nextSafeAction}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
