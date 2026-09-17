require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { createStandaloneAiGatewayService } = require('../backend/src/ai-gateway/ai-gateway.service');
const { AiGatewayConfigService } = require('../backend/src/ai-gateway/ai-gateway-config.service');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readPositiveInt(name, fallback, options = {}) {
  const value = Number(process.env[name] ?? fallback);
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(value) || value < minimum) return fallback;
  return Math.min(value, maximum);
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

function configuredProviderSummary() {
  const model = configuredGenerationModel();
  return {
    provider: cleanText(process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER || process.env.AI_DEFAULT_PROVIDER || process.env.CSCA_AI_PROVIDER || 'deepseek'),
    baseUrl: cleanText(process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL || process.env.DEEPSEEK_BACKGROUND_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'),
    model,
    proModel: cleanText(process.env.CSCA_AI_QUESTION_GENERATION_PRO_MODEL || process.env.CSCA_SUBJECT_PRACTICE_PRO_MODEL || process.env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro'),
    standardTierUsesProModel: /deepseek-v4-pro/i.test(model)
  };
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

function compactResponse(response) {
  return {
    requestId: response.requestId,
    taskType: response.taskType,
    providerId: response.providerId,
    model: response.model,
    keyId: response.keyId,
    status: response.status,
    errorCode: response.errorCode,
    errorMessage: response.errorMessage,
    latencyMs: response.latencyMs,
    usage: response.usage,
    attemptCount: Array.isArray(response.attempts) ? response.attempts.length : 0,
    attempts: Array.isArray(response.attempts)
      ? response.attempts.map((attempt) => ({
        providerId: attempt.providerId,
        model: attempt.model,
        keyId: attempt.keyId,
        status: attempt.status,
        errorCode: attempt.errorCode,
        latencyMs: attempt.latencyMs
      }))
      : []
  };
}

function recoveryDiagnosis(response) {
  const attempts = Array.isArray(response.attempts) ? response.attempts : [];
  const codes = Array.from(new Set(attempts.map((attempt) => attempt.errorCode).filter(Boolean)));
  const quotaBlockedKeyCount = attempts.filter((attempt) => attempt.errorCode === 'provider_quota_exceeded').length;
  const schemaInvalidKeyCount = attempts.filter((attempt) => attempt.errorCode === 'provider_schema_invalid').length;
  return {
    status: response.status === 'success' ? 'provider_available' : 'provider_not_recovered',
    blockingErrorCodes: codes,
    quotaBlockedKeyCount,
    schemaInvalidKeyCount,
    nextOperatorAction: quotaBlockedKeyCount > 0
      ? 'repair_or_replace_background_deepseek_keys_then_rerun_one_recovery_probe'
      : schemaInvalidKeyCount > 0
        ? 'rerun_recovery_probe_after_probe_output_budget_or_delivery_contract_adjustment'
        : 'inspect_gateway_attempt_errors_before_math_live_observation',
    mathLiveObservationAllowed: false
  };
}

function runtimeProcessAuditPrecheck() {
  try {
    const stdout = execFileSync(process.execPath, [
      scriptPath('csca-runtime-process-audit.cjs'),
      '--json'
    ], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const report = parseJson(stdout) || {};
    return {
      mode: report.mode ?? null,
      status: report.status ?? 'unknown',
      productionImpact: report.productionImpact ?? null,
      providerImpact: report.providerImpact ?? null,
      dbImpact: report.dbImpact ?? null,
      inspectionError: report.inspectionError ?? null,
      backendRunnerCount: report.backendRunnerCount ?? null,
      observationBackendProcessCount: report.observationBackendProcessCount ?? null,
      duplicateOrMixedBackendRisk: report.duplicateOrMixedBackendRisk === true,
      nextSafeAction: report.nextSafeAction ?? null,
      riskProcesses: Array.isArray(report.riskProcesses)
        ? report.riskProcesses.map((processInfo) => ({
          processId: processInfo.processId ?? null,
          parentProcessId: processInfo.parentProcessId ?? null,
          name: processInfo.name ?? null,
          category: processInfo.category ?? null,
          commandLine: processInfo.commandLine ?? null
        })).slice(0, 8)
        : []
    };
  } catch (error) {
    return {
      mode: 'csca_runtime_process_audit',
      status: 'process_inspection_unavailable',
      productionImpact: 'none_read_only_runtime_process_audit',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_db_access',
      inspectionError: cleanText(error?.stderr || error?.message || error),
      backendRunnerCount: null,
      observationBackendProcessCount: null,
      duplicateOrMixedBackendRisk: false,
      nextSafeAction: 'rerun_process_audit_from_an_elevated_local_shell_before_provider_recovery_probe',
      riskProcesses: []
    };
  }
}

function runtimeCleanupPlanPrecheck() {
  try {
    const stdout = execFileSync(process.execPath, [
      scriptPath('csca-runtime-process-cleanup-plan.cjs'),
      '--json'
    ], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const report = parseJson(stdout) || {};
    const cleanupPlan = report.cleanupPlan || {};
    return {
      mode: report.mode ?? null,
      status: report.status ?? 'unknown',
      productionImpact: report.productionImpact ?? null,
      providerImpact: report.providerImpact ?? null,
      dbImpact: report.dbImpact ?? null,
      inspectionError: report.inspectionError ?? null,
      duplicateOrMixedBackendRisk: report.duplicateOrMixedBackendRisk === true,
      stopProcessIds: Array.isArray(cleanupPlan.stopProcessIds) ? cleanupPlan.stopProcessIds : [],
      applyCommand: cleanupPlan.applyCommand ?? null,
      postCleanupCommands: cleanupPlan.postCleanupCommands ?? null,
      safetyBoundary: Array.isArray(report.safetyBoundary) ? report.safetyBoundary : []
    };
  } catch (error) {
    return {
      mode: 'csca_runtime_process_cleanup_plan',
      status: 'process_inspection_unavailable',
      productionImpact: 'none_dry_run_cleanup_plan_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_db_access',
      inspectionError: cleanText(error?.stderr || error?.message || error),
      duplicateOrMixedBackendRisk: false,
      stopProcessIds: [],
      applyCommand: null,
      postCleanupCommands: null,
      safetyBoundary: [
        'dry_run_by_default',
        'does_not_call_provider',
        'does_not_read_or_write_database',
        'does_not_authorize_student_publication'
      ]
    };
  }
}

function runtimePrecheckBlocksLiveProbe(precheck) {
  return precheck.status !== 'clear_single_or_no_backend_runner'
    || precheck.duplicateOrMixedBackendRisk === true
    || Boolean(cleanText(precheck.inspectionError));
}

async function main() {
  const runtimePrecheckOnly = hasFlag('runtime-precheck-only');
  const allowLiveProvider = hasFlag('allow-live-provider')
    || process.env.AI_GATEWAY_PROVIDER_RECOVERY_PROBE_ALLOW_LIVE === '1';
  const runtimeCleanConfirmed = hasFlag('confirm-runtime-clean')
    || process.env.AI_GATEWAY_PROVIDER_RECOVERY_PROBE_CONFIRM_RUNTIME_CLEAN === '1';
  const providerConfig = configuredProviderSummary();
  const keyPoolSummary = providerKeyPoolSummary(providerConfig);
  const maxTokens = readPositiveInt('AI_GATEWAY_PROVIDER_RECOVERY_PROBE_MAX_TOKENS', 512, { minimum: 128, maximum: 2048 });

  if (runtimePrecheckOnly) {
    const runtimePrecheck = runtimeProcessAuditPrecheck();
    const runtimeCleanupPlan = runtimeCleanupPlanPrecheck();
    console.log(JSON.stringify({
      mode: 'ai_gateway_provider_recovery_probe',
      status: runtimePrecheckBlocksLiveProbe(runtimePrecheck)
        ? 'runtime_precheck_blocked'
        : 'runtime_precheck_passed_live_provider_not_called',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_write',
      studentConsumableImpact: 'none',
      providerConfig,
      keyPoolSummary,
      probeMaxTokens: maxTokens,
      runtimeCleanConfirmed,
      runtimePrecheckOnly: true,
      runtimePrecheck,
      runtimeCleanupPlan,
      nextOperatorCommandBeforeLiveProbe: runtimePrecheckBlocksLiveProbe(runtimePrecheck)
        ? runtimeCleanupPlan.applyCommand
        : null,
      nextLiveCommandAfterFreshAuthorization: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean',
      message: 'Runtime precheck-only mode stops before any live provider or database gateway call.'
    }, null, 2));
    if (runtimePrecheckBlocksLiveProbe(runtimePrecheck)) process.exitCode = 1;
    return;
  }

  if (!allowLiveProvider) {
    console.log(JSON.stringify({
      mode: 'ai_gateway_provider_recovery_probe',
      status: 'authorization_required',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_write',
      studentConsumableImpact: 'none',
      providerConfig,
      keyPoolSummary,
      probeMaxTokens: maxTokens,
      requiredFlags: ['--allow-live-provider', '--confirm-runtime-clean'],
      runtimeCleanConfirmed,
      message: 'This recovery probe makes one live background-pool provider call and writes one ai_gateway_call_logs success/failure row. Re-run with --allow-live-provider and --confirm-runtime-clean only after explicit operator authorization and runtime cleanup verification.'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!runtimeCleanConfirmed) {
    const runtimeCleanupPlan = runtimeCleanupPlanPrecheck();
    console.log(JSON.stringify({
      mode: 'ai_gateway_provider_recovery_probe',
      status: 'runtime_cleanup_confirmation_required',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_write',
      studentConsumableImpact: 'none',
      providerConfig,
      keyPoolSummary,
      probeMaxTokens: maxTokens,
      requiredFlags: ['--allow-live-provider', '--confirm-runtime-clean'],
      runtimeCleanConfirmed,
      runtimeCleanupPlan,
      operatorCommands: {
        runtimeProcessAudit: 'npm.cmd run csca-ai-questioning:runtime-process-audit -- --json',
        runtimeProcessCleanupPlan: 'npm.cmd run csca-ai-questioning:runtime-process-cleanup-plan -- --json',
        runtimePrecheckOnly: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --runtime-precheck-only',
        liveProbeAfterExplicitAuthorizationAndRuntimeCleanup: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean'
      },
      message: 'Runtime cleanup must be verified before a live provider recovery probe so duplicate backend runners cannot refresh cooldown or consume keys during recovery evidence collection.'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const runtimePrecheck = runtimeProcessAuditPrecheck();
  if (runtimePrecheckBlocksLiveProbe(runtimePrecheck)) {
    const runtimeCleanupPlan = runtimeCleanupPlanPrecheck();
    console.log(JSON.stringify({
      mode: 'ai_gateway_provider_recovery_probe',
      status: runtimePrecheck.duplicateOrMixedBackendRisk
        ? 'runtime_cleanup_required'
        : 'runtime_cleanup_verification_required',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_write',
      studentConsumableImpact: 'none',
      providerConfig,
      keyPoolSummary,
      probeMaxTokens: maxTokens,
      requiredFlags: ['--allow-live-provider', '--confirm-runtime-clean'],
      runtimeCleanConfirmed,
      runtimePrecheck,
      runtimeCleanupPlan,
      nextOperatorCommandBeforeLiveProbe: runtimeCleanupPlan.applyCommand,
      operatorCommands: {
        runtimeProcessAudit: 'npm.cmd run csca-ai-questioning:runtime-process-audit -- --json',
        runtimeProcessCleanupPlan: 'npm.cmd run csca-ai-questioning:runtime-process-cleanup-plan -- --json',
        runtimePrecheckOnly: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --runtime-precheck-only',
        liveProbeAfterExplicitAuthorizationAndRuntimeCleanup: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean'
      },
      message: 'Runtime audit must be clear before the live provider recovery probe; confirmation flags alone do not bypass duplicate or mixed backend runner risk.'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  let response;
  try {
    const gateway = createStandaloneAiGatewayService({ prisma });
    response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'ai_gateway_provider_recovery_probe',
      modelHint: providerConfig.model,
      responseFormat: 'json',
      temperature: 0,
      maxTokens,
      timeoutMs: 30_000,
      bypassProviderHardStopLedger: true,
      messages: [
        {
          role: 'system',
          content: 'Provider recovery probe. Return only a compact JSON object in message.content. Do not include markdown or explanations.'
        },
        {
          role: 'user',
          content: 'Return exactly {"ok":true,"probe":"ai_gateway_provider_recovery"} if the provider is available.'
        }
      ],
      metadata: {
        purpose: 'provider_recovery_probe',
        requestedModel: providerConfig.model,
        runtimeCleanConfirmed: true,
        runtimeAuditStatus: runtimePrecheck.status,
        providerImpact: 'one_live_provider_call_explicitly_authorized',
        dbImpact: 'ai_gateway_call_log_written',
        studentConsumableImpact: 'none_does_not_publish_or_reclassify',
        bypassProviderHardStopLedger: true
      }
    });
  } finally {
    await prisma.$disconnect();
  }

  const parsed = parseJson(response.content);
  const passed = response.status === 'success'
    && parsed?.ok === true
    && parsed?.probe === 'ai_gateway_provider_recovery';

  console.log(JSON.stringify({
    mode: 'ai_gateway_provider_recovery_probe',
    status: passed ? 'passed' : 'failed',
    providerImpact: 'one_live_provider_call_explicitly_authorized',
    dbImpact: 'ai_gateway_call_log_written',
    ledgerPersistence: 'database_ai_gateway_call_logs',
    studentConsumableImpact: 'none_does_not_publish_or_reclassify',
    providerConfig,
    keyPoolSummary,
    probeMaxTokens: maxTokens,
    runtimeCleanConfirmed: true,
    runtimePrecheck,
    clearsBackgroundProviderHardStopOnSuccess: true,
    bypassProviderHardStopLedger: true,
    response: compactResponse(response),
    recoveryDiagnosis: recoveryDiagnosis(response)
  }, null, 2));

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
