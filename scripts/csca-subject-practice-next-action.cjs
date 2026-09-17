#!/usr/bin/env node

const cp = require('node:child_process');
const fs = require('node:fs');

function loadProjectEnv() {
  try {
    const text = fs.readFileSync('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
    // Best-effort only; child preview scripts surface missing environment.
  }
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + asNumber(row[key]), 0);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(3)) : null;
}

function positiveInt(name, fallback) {
  const value = Number(argValue(name, fallback));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function runArgValue(name, fallback = 'latest') {
  const value = cleanText(argValue(name, fallback));
  return value || fallback;
}

function resolveAuditRunId(audit, requestedRun) {
  const auditRunId = Number(audit?.run?.id);
  if (Number.isInteger(auditRunId) && auditRunId > 0) return auditRunId;
  const numericRequestedRun = Number(requestedRun);
  if (Number.isInteger(numericRequestedRun) && numericRequestedRun > 0) return numericRequestedRun;
  throw new Error(`Unable to resolve production run id from requested run "${requestedRun}".`);
}

function positiveMs(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function runJson(script, args) {
  const output = cp.execFileSync(process.execPath, [script, ...args, '--json'], {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024
  });
  return JSON.parse(output);
}

function compactDispatchCapacity(audit) {
  const capacity = audit?.provider?.dispatchCapacity || {};
  return {
    activeJobLimit: capacity.activeJobLimit ?? null,
    activeProductionJobCount: capacity.activeProductionJobCount ?? null,
    activeCapacityRemaining: capacity.activeCapacityRemaining ?? null,
    activeCapacityStatus: capacity.activeCapacityStatus || null,
    activeProductionCells: Array.isArray(capacity.activeProductionCells)
      ? capacity.activeProductionCells.map((cell) => ({
        id: cell.id,
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        activeJobCount: cell.activeJobCount,
        openCount: cell.openCount
      }))
      : [],
    openCellsWaitingForDispatch: Array.isArray(capacity.openCellsWaitingForDispatch)
      ? capacity.openCellsWaitingForDispatch.map((cell) => ({
        id: cell.id,
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        openCount: cell.openCount,
        dispatchWaitReason: cell.dispatchWaitReason,
        nextSafeAction: cell.nextSafeAction
      }))
      : []
  };
}

function compactProviderErrors(audit) {
  const provider = audit?.provider || {};
  return {
    jobErrorSummary: provider.jobErrorSummary || null,
    gatewayErrors: provider.gatewayErrors || null,
    providerErrors: provider.providerErrors || null
  };
}

const TRANSIENT_PROVIDER_FAILURE_CODES = new Set([
  'provider_unavailable',
  'provider_rate_limited',
  'provider_timeout',
  'provider_network_error',
  'gateway_key_cooldown',
  'gateway_concurrency_timeout',
  'gateway_key_concurrency_saturated',
  'gateway_key_rate_limited',
  'gateway_no_key_available'
]);

const PROVIDER_HARD_STOP_CODES = new Set([
  'provider_auth_error',
  'provider_quota_exceeded',
  'gateway_key_disabled'
]);

function latestTimestamp(rows, predicate) {
  return rows
    .filter(predicate)
    .map((item) => Date.parse(item.latestCreatedAt || item.latestAt || ''))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0] || null;
}

function compactGatewayHardStopSample(row) {
  const id = Number(row?.id);
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    requestId: cleanText(row?.requestId) || null,
    taskType: cleanText(row?.taskType) || null,
    sourceModule: cleanText(row?.sourceModule) || null,
    providerId: cleanText(row?.providerId) || null,
    model: cleanText(row?.model) || null,
    status: cleanText(row?.status) || null,
    errorCode: cleanText(row?.errorCode) || null,
    errorMessagePreview: cleanText(row?.errorMessagePreview) || null,
    subject: cleanText(row?.subject) || null,
    topicId: cleanText(row?.topicId) || null,
    blueprintId: cleanText(row?.blueprintId) || null,
    generationTier: cleanText(row?.generationTier) || null,
    questionType: cleanText(row?.questionType) || null,
    observationTaskId: cleanText(row?.observationTaskId) || null,
    createdAt: cleanText(row?.createdAt) || null
  };
}

function providerBackoffFor(audit) {
  const provider = audit?.provider || {};
  const gatewayErrors = Array.isArray(provider.gatewayErrors) ? provider.gatewayErrors : [];
  const gatewayHardStopSamples = Array.isArray(provider.gatewayHardStopSamples)
    ? provider.gatewayHardStopSamples.map(compactGatewayHardStopSample)
    : [];
  const providerErrors = Array.isArray(provider.providerErrors) ? provider.providerErrors : [];
  const backoffWindowMs = positiveMs('CSCA_SUBJECT_PRACTICE_PROVIDER_BACKOFF_MS', 15 * 60 * 1000);
  const hardStopWindowMs = positiveMs('CSCA_SUBJECT_PRACTICE_PROVIDER_HARD_STOP_WINDOW_MS', 24 * 60 * 60 * 1000);
  const minimumFailures = positiveInt('provider-backoff-min-failures', Number(process.env.CSCA_SUBJECT_PRACTICE_PROVIDER_BACKOFF_MIN_FAILURES || 2));
  const gatewaySignals = gatewayErrors
    .filter((item) => TRANSIENT_PROVIDER_FAILURE_CODES.has(cleanText(item.errorCode || item.status)))
    .map((item) => ({
      source: 'gateway',
      code: cleanText(item.errorCode || item.status),
      count: Number(item.count) || 0,
      latestAt: cleanText(item.latestCreatedAt) || null
    }));
  const providerSignals = providerErrors
    .filter((item) => TRANSIENT_PROVIDER_FAILURE_CODES.has(cleanText(item.errorCode)))
    .map((item) => ({
      source: 'job',
      code: cleanText(item.errorCode),
      count: Number(item.count) || 0,
      latestAt: null
    }));
  const hardStopGatewaySignals = gatewayErrors
    .filter((item) => PROVIDER_HARD_STOP_CODES.has(cleanText(item.errorCode || item.status)))
    .map((item) => ({
      source: 'gateway',
      code: cleanText(item.errorCode || item.status),
      count: Number(item.count) || 0,
      latestAt: cleanText(item.latestCreatedAt) || null
    }));
  const hardStopProviderSignals = providerErrors
    .filter((item) => PROVIDER_HARD_STOP_CODES.has(cleanText(item.errorCode)))
    .map((item) => ({
      source: 'job',
      code: cleanText(item.errorCode),
      count: Number(item.count) || 0,
      latestAt: null
    }));
  const signals = [...gatewaySignals, ...providerSignals];
  const hardStopSignals = [...hardStopGatewaySignals, ...hardStopProviderSignals];
  const transientFailureCount = signals.reduce((sum, item) => sum + item.count, 0);
  const hardStopFailureCount = hardStopSignals.reduce((sum, item) => sum + item.count, 0);
  const latestAt = latestTimestamp(gatewaySignals, () => true);
  const latestAgeMs = latestAt ? Math.max(0, Date.now() - latestAt) : null;
  const active = transientFailureCount >= minimumFailures
    && latestAgeMs != null
    && latestAgeMs <= backoffWindowMs;
  const latestHardStopAt = latestTimestamp(hardStopGatewaySignals, () => true);
  const latestHardStopAgeMs = latestHardStopAt ? Math.max(0, Date.now() - latestHardStopAt) : null;
  const latestRecoverySuccessAt = latestTimestamp(gatewayErrors, (item) => {
    const status = cleanText(item.status);
    const errorCode = cleanText(item.errorCode).toLowerCase();
    return status === 'success' && (!errorCode || errorCode === 'none');
  });
  const recoveredAfterHardStop = latestHardStopAt != null
    && latestRecoverySuccessAt != null
    && latestRecoverySuccessAt > latestHardStopAt;
  const hardStopActive = hardStopFailureCount > 0
    && (latestHardStopAgeMs == null || latestHardStopAgeMs <= hardStopWindowMs)
    && !recoveredAfterHardStop;
  return {
    active,
    hardStopActive,
    policy: hardStopActive
      ? 'provider_auth_or_quota_failures_stop_live_calls_until_configuration_changes'
      : 'transient_provider_delivery_failures_defer_live_calls_not_quality_memory',
    transientFailureCodes: Array.from(TRANSIENT_PROVIDER_FAILURE_CODES),
    hardStopFailureCodes: Array.from(PROVIDER_HARD_STOP_CODES),
    transientFailureCount,
    hardStopFailureCount,
    minimumFailures,
    backoffWindowMs,
    hardStopWindowMs,
    latestFailureAt: latestAt ? new Date(latestAt).toISOString() : null,
    latestFailureAgeMs: latestAgeMs,
    latestHardStopAt: latestHardStopAt ? new Date(latestHardStopAt).toISOString() : null,
    latestHardStopAgeMs,
    latestRecoverySuccessAt: latestRecoverySuccessAt ? new Date(latestRecoverySuccessAt).toISOString() : null,
    recoveredAfterHardStop,
    hardStopRecoveryPolicy: 'later_gateway_success_clears_prior_provider_auth_or_quota_hard_stop_for_next_action_preview',
    signals,
    hardStopSignals,
    hardStopSourceSamples: gatewayHardStopSamples
  };
}

function isProModelName(model) {
  return /deepseek-v4-pro/i.test(cleanText(model));
}

function throughputEfficiencyFor(audit, dispatchCapacity, providerConfig = {}, providerBackoff = {}, mathStageEvidence = null) {
  const run = audit?.run || {};
  const quality = audit?.quality || {};
  const diagnostics = arrayFrom(audit?.productionDiagnostics);
  const providerErrors = arrayFrom(audit?.provider?.providerErrors);
  const attemptCount = sum(diagnostics, 'jobAttemptCount');
  const generatedCount = sum(diagnostics, 'generatedQuestionCount');
  const approvedGeneratedCount = sum(diagnostics, 'approvedGeneratedCount');
  const deliveryYield = generatedCount <= attemptCount ? ratio(generatedCount, attemptCount) : null;
  const generatedToApprovedYield = ratio(approvedGeneratedCount, generatedCount);
  const attemptToApprovedYield = ratio(approvedGeneratedCount, attemptCount);
  const thresholds = {
    minimumDeliveryYield: 0.65,
    minimumGeneratedToApprovedYield: 0.35,
    minimumAttemptToApprovedYield: 0.25,
    minimumActiveUtilizationWhenOpen: 0.8
  };
  const activeJobLimit = asNumber(dispatchCapacity.activeJobLimit);
  const activeProductionJobCount = asNumber(dispatchCapacity.activeProductionJobCount);
  const activeCapacityRemaining = asNumber(dispatchCapacity.activeCapacityRemaining);
  const activeUtilization = activeJobLimit > 0
    ? Number((activeProductionJobCount / activeJobLimit).toFixed(3))
    : null;
  const openTotal = asNumber(run.computedOpenTotal);
  const p0p1 = arrayFrom(quality.p0p1);
  const deliveryIssueCount = providerErrors
    .filter((item) => /provider_|gateway_|timeout|network|rate_limited|cooldown|unavailable/i.test(cleanText(item.errorCode)))
    .reduce((total, item) => total + asNumber(item.count), 0);
  const reasons = [];
  if (cleanText(run.blockedReasonCode)) reasons.push(`run_blocked:${cleanText(run.blockedReasonCode)}`);
  if (p0p1.length) reasons.push(`p0p1_attention:${p0p1.length}`);
  if (deliveryYield != null && deliveryYield < thresholds.minimumDeliveryYield) reasons.push('delivery_yield_below_threshold');
  if (generatedToApprovedYield != null && generatedToApprovedYield < thresholds.minimumGeneratedToApprovedYield) reasons.push('generated_to_approved_yield_below_threshold');
  if (attemptToApprovedYield != null && attemptToApprovedYield < thresholds.minimumAttemptToApprovedYield) reasons.push('attempt_to_approved_yield_below_threshold');
  if (activeJobLimit > 0 && activeProductionJobCount > activeJobLimit) reasons.push('active_capacity_over_limit');
  if (cleanText(dispatchCapacity.activeCapacityStatus) === 'active_capacity_exhausted_by_existing_jobs') reasons.push('active_capacity_exhausted');
  if (openTotal > 0 && activeCapacityRemaining > 0 && activeUtilization != null && activeUtilization < thresholds.minimumActiveUtilizationWhenOpen) {
    reasons.push('active_capacity_underfilled_with_open_cells');
  }
  if (deliveryIssueCount > 0) reasons.push('provider_delivery_noise_present');
  if (providerConfig.standardTierUsesProModel) reasons.push('standard_generation_model_configured_to_pro_model');
  if (providerBackoff.hardStopActive) reasons.push('provider_hard_stop_active');
  const boundedMathStageSatisfied = mathStageEvidence?.status === 'passed'
    && mathStageEvidence?.efficiencySatisfied === true;
  const status = boundedMathStageSatisfied
    ? 'acceptable_with_bounded_stage_evidence'
    : openTotal > 0
    ? reasons.some((reason) => /yield_below|run_blocked|p0p1|active_capacity_exhausted|active_capacity_over_limit|provider_hard_stop/.test(reason))
      ? 'below_acceptable_efficiency'
      : reasons.length
        ? 'acceptable_with_operator_actions'
        : 'acceptable'
    : 'closed_or_no_open_work';
  return {
    mode: 'audit_only_next_action_throughput_efficiency',
    status,
    productionImpact: 'none_read_only_next_action_preview',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    thresholds,
    reasons,
    activeUtilization,
    activeJobLimit,
    activeProductionJobCount,
    activeCapacityRemaining,
    openTotal,
    deliveryIssueCount,
    yieldEvidence: {
      deliveryYield,
      generatedToApprovedYield,
      attemptToApprovedYield,
      attemptCount,
      generatedCount,
      approvedGeneratedCount
    },
    boundedMathStageEvidence: mathStageEvidence,
    nextEfficiencyLever: boundedMathStageSatisfied
      ? 'close_validated_cell_and_select_next_guarded_math_family_without_provider'
      : reasons.includes('provider_hard_stop_active')
      ? 'prove_provider_recovery_before_more_provider_spend'
      : reasons.includes('active_capacity_over_limit')
      ? 'stop_or_recover_over_limit_jobs_before_more_provider_spend'
      : reasons.includes('standard_generation_model_configured_to_pro_model')
        ? 'configure_standard_generation_model_to_flash_before_more_provider_spend'
      : reasons.some((reason) => /run_blocked|yield_below/.test(reason))
      ? 'tighten_question_plan_or_reviewer_profile_calibration_before_more_provider_spend'
      : reasons.includes('active_capacity_underfilled_with_open_cells')
        ? 'fill_available_capacity_with_exact_enqueue_or_process_existing_queued_job'
        : reasons.includes('provider_delivery_noise_present')
          ? 'watch_provider_backoff_or_switch_provider_if_recent_failures_continue'
          : null,
    evidenceLimit: boundedMathStageSatisfied
      ? 'bounded_observation_stage_overrides_historical_recovery_routing_only; it_does_not_prove_run_scale_efficiency_or_future_family_quality'
      : 'historical_current_run_funnel_and_audit_only_capacity_not_future_provider_success'
  };
}

function mathStageEvidenceFor(subject, runId) {
  const cellId = Number(argValue('observation-cell', ''));
  if (subject !== 'math' || !Number.isInteger(cellId) || cellId <= 0) return null;
  const report = runJson('scripts/csca-subject-practice-math-postfix-efficiency-gate.cjs', [
    `--run=${runId}`,
    `--cell=${cellId}`,
    '--hours=72'
  ]);
  return {
    mode: report.mode ?? null,
    status: report.status ?? null,
    efficiencySatisfied: report.efficiencySatisfied === true,
    productionRunId: runId,
    productionCellId: cellId,
    metricPolicyVersion: report.metricPolicyVersion ?? null,
    sampleCounts: report.sampleCounts ?? null,
    yields: report.yields ?? null,
    reasons: arrayFrom(report.reasons),
    providerImpact: report.providerImpact ?? null,
    dbImpact: report.dbImpact ?? null,
    evidenceLimit: report.evidenceLimit ?? null
  };
}

function observationContinuationFor(subject, runId, cellId) {
  if (!Number.isInteger(Number(cellId)) || Number(cellId) <= 0) return null;
  const scorecard = runJson('scripts/csca-subject-practice-observation-scorecard.cjs', [
    `--subject=${subject}`,
    `--run=${runId}`,
    `--cell=${cellId}`,
    '--limit=20'
  ]);
  return {
    productionCellId: Number(cellId),
    scorecardStatus: scorecard.status ?? null,
    providerSampleCount: scorecard.funnels?.providerAttemptedTaskCount ?? null,
    totalEstimatedCostUsd: scorecard.cost?.totalEstimatedCostUsd ?? null,
    continuation: scorecard.continuation ?? null,
    thresholds: scorecard.thresholds ?? null,
    evidenceLimit: 'read_only_durable_observation_evidence_does_not_authorize_execution'
  };
}

function deriveAllowlist(inputAllowlist, dispatchCapacity) {
  const configured = cleanText(inputAllowlist);
  if (configured) return configured;
  const activeCells = dispatchCapacity.activeProductionCells
    .map((cell) => Number(cell.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(activeCells)).sort((left, right) => left - right).join(',');
}

function providerConfigSummary() {
  const standardModel = process.env.CSCA_AI_QUESTION_GENERATION_MODEL
    || process.env.AI_GATEWAY_MODEL
    || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL
    || process.env.DEEPSEEK_DEFAULT_MODEL
    || null;
  const proModel = process.env.CSCA_AI_QUESTION_GENERATION_PRO_MODEL
    || process.env.CSCA_SUBJECT_PRACTICE_PRO_MODEL
    || process.env.DEEPSEEK_PRO_MODEL
    || null;
  const standardTierUsesProModel = isProModelName(standardModel);
  return {
    provider: process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER || process.env.AI_GATEWAY_PROVIDER || null,
    baseUrl: process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL || process.env.AI_GATEWAY_BASE_URL || null,
    model: standardModel,
    proModel,
    standardTierUsesProModel,
    modelTierRisk: standardTierUsesProModel
      ? 'standard_generation_model_configured_to_pro_increases_cost_latency_and_quota_burn'
      : null,
    recommendedStandardModel: standardTierUsesProModel
      ? (process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash')
      : null
  };
}

function liveCommands({ subject, runId, cellId, jobId, allowlist, baseUrl }) {
  const common = `--subject=${subject} --run=${runId} --cell=${cellId} --job=${jobId} --enable-question-plan --question-plan-cell-allowlist=${allowlist} --base-url=${baseUrl}`;
  const commands = {
    startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${allowlist}`,
    preview: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --json`,
    applyAfterAuthorization: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --apply --confirm-exact-question-plan-live-job --accept-provider-payload-and-db-writes --confirm-job=${jobId} --json`,
    verifyEvidence: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --json`,
    queuedRevalidation: `npm.cmd run csca-ai-questioning:question-plan-queued-revalidation -- --subject=${subject} --run=${runId} --enable-question-plan --question-plan-cell-allowlist=${allowlist} --json`
  };
  if (subject === 'math') {
    commands.targetPromptContractSelfTest = `npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=${runId} --cell=${cellId} --json`;
  }
  return commands;
}

function enqueueCommands({ subject, runId, cellId, blueprintId, baseUrl }) {
  const previewCommon = `--subject=${subject} --run=${runId}`;
  const exactCommon = `--subject=${subject} --run=${runId} --cell=${cellId} --blueprint=${blueprintId} --base-url=${baseUrl}`;
  return {
    previewNextCell: `npm.cmd run csca-ai-questioning:subject-practice-exact-cell-enqueue -- ${previewCommon}`,
    startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${cellId}`,
    applyAfterAuthorization: `npm.cmd run csca-ai-questioning:subject-practice-exact-cell-enqueue -- ${exactCommon} --apply --confirm-exact-cell-enqueue --confirm-cell=${cellId}`,
    queuedRevalidationAfterEnqueue: `npm.cmd run csca-ai-questioning:question-plan-queued-revalidation -- --subject=${subject} --run=${runId} --enable-question-plan --question-plan-cell-allowlist=${cellId} --json`
  };
}

function recoveryCommands({ subject, runId }) {
  const commands = {
    scorecard: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=${subject} --${subject}-run=${runId} --sample=80 --json`,
    productionAudit: `npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=${subject} --run=${runId} --sample=80 --days=30 --json`,
    exactCellEnqueuePreview: `npm.cmd run csca-ai-questioning:subject-practice-exact-cell-enqueue -- --subject=${subject} --run=${runId} --include-prompt-contract --json`,
    currentOpenCellQuestionPlanSelfTest: 'npm.cmd run csca-ai-questioning:current-open-cell-question-plan-self-test -- --json',
    noProviderAcceptance: 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance -- --json'
  };
  if (subject !== 'math') return commands;
  return {
    ...commands,
    mathRecoveryDiagnostics: `npm.cmd run csca-ai-questioning:subject-practice-math-recovery-diagnostics -- --run=${runId} --json`,
    mathQuestionPlanCalibration: `npm.cmd run csca-ai-questioning:question-plan-calibration -- --subject=math --run=${runId} --json`,
    mathDiversityPreflight: 'npm.cmd run csca-ai-questioning:math-diversity-observation-preflight -- --json',
    mathCurrentPolicyRefreshDryRun: 'npm.cmd run csca-ai-questioning:subject-practice-production-current-policy-refresh -- --subject=math --statuses=blocked,completed --days=30 --limit=100 --json'
  };
}

function postExecutionVerificationCommands({ subject, runId, operatorCommands }) {
  return {
    ...(operatorCommands?.verifyEvidence ? { verifyEvidence: operatorCommands.verifyEvidence } : {}),
    ...(operatorCommands?.queuedRevalidation ? { queuedRevalidation: operatorCommands.queuedRevalidation } : {}),
    ...(operatorCommands?.queuedRevalidationAfterEnqueue ? { queuedRevalidationAfterEnqueue: operatorCommands.queuedRevalidationAfterEnqueue } : {}),
    ...(operatorCommands?.targetPromptContractSelfTest ? { targetPromptContractSelfTest: operatorCommands.targetPromptContractSelfTest } : {}),
    ...(operatorCommands?.observationScorecard ? { observationScorecard: operatorCommands.observationScorecard } : {}),
    scorecard: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=${subject} --${subject}-run=${runId} --sample=80 --json`,
    actionQueueGate: `npm.cmd run csca-ai-questioning:subject-practice-action-queue-gate -- --subject=${subject} --run=${runId} --json`,
    noProviderAcceptance: 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance -- --json'
  };
}

function preAuthorizationChecksFor(item) {
  if (['read_only_math_recovery_diagnostics', 'read_only_subject_recovery_diagnostics'].includes(item?.type)) {
    return [
      'run_listed_read_only_subject_recovery_diagnostics',
      'do_not_enqueue_or_call_provider_until_recovery_report_is_clean',
      'rerun_action_queue_gate_before_any_side_effect'
    ];
  }
  if (item?.type === 'live_existing_queued_job') {
    const mathPromptContractCheck = cleanText(item?.subject) === 'math'
      ? ['run_target_prompt_contract_self_test_for_reported_cell']
      : [];
    return [
      'run_action_queue_gate_with_require_ready',
      'start_observation_backend_for_reported_cell_allowlist',
      ...mathPromptContractCheck,
      'run_live_job_preview_until_ready_for_explicit_live_authorization',
      'obtain_fresh_exact_live_provider_authorization_text'
    ];
  }
  if (item?.type === 'submit_one_guarded_observation_task') {
    return [
      'start_isolated_observation_backend_for_reported_cell_allowlist',
      'run_target_prompt_contract_self_test_for_reported_cell',
      'run_guarded_observation_preview_and_confirm_cost_reservation_within_explicit_cap',
      'prove_provider_recovery_immediately_before_apply',
      'obtain_fresh_exact_one_call_db_write_no_student_publication_authorization_text'
    ];
  }
  if (item?.type === 'revalidate_existing_candidates_without_provider') {
    return [
      'rerun_exact_owner_revalidation_plan_and_confirm_the_same_candidate_whitelist',
      'inspect_exact_candidate_content_and_record_the_content_set_sha256',
      'run_deterministic_owner_revalidation_preview_and_require_all_candidates_publishable',
      'confirm_no_provider_gateway_is_constructed_or_called',
      'obtain_fresh_exact_candidate_db_write_and_automatic_publication_authorization_text'
    ];
  }
  if (/enqueue_one_exact_cell_job/.test(cleanText(item?.type))) {
    return [
      'run_action_queue_gate_and_confirm_capacity_fill_intent',
      'run_exact_cell_enqueue_preview_until_ready_for_exact_cell_enqueue',
      'obtain_fresh_exact_db_enqueue_authorization_text'
    ];
  }
  return [
    'rerun_action_queue_gate_before_any_side_effect'
  ];
}

function actionQueueReadinessFor(decision) {
  const type = cleanText(decision?.recommended?.type);
  if (type === 'read_only_math_guarded_family_selection') return 'read_only_guarded_family_selection_ready';
  if (type === 'read_only_math_recovery_diagnostics') return 'read_only_operator_diagnostics_ready';
  if (type === 'read_only_subject_recovery_diagnostics') return 'read_only_operator_diagnostics_ready';
  if (decision?.status === 'provider_delivery_backoff_before_live_job') return 'deferred_until_provider_recovery';
  return 'requires_fresh_explicit_authorization';
}

function sideEffectScopeFor(type) {
  if (type === 'live_existing_queued_job') return 'one_live_provider_call_plus_generation_job_gateway_candidate_gate_publish_side_effects';
  if (type === 'submit_one_guarded_observation_task') return 'one_guarded_provider_call_plus_local_task_job_candidate_gate_writes_no_student_publication';
  if (type === 'revalidate_existing_candidates_without_provider') return 'exact_candidate_review_metadata_db_writes_plus_existing_automatic_gate_publication_no_provider_call';
  if (/enqueue_one_exact_cell_job/.test(type)) return 'one_generation_job_db_enqueue_no_provider_call';
  if (type === 'read_only_math_guarded_family_selection') return 'none_read_only_selection_and_local_calibration';
  if (type === 'read_only_math_recovery_diagnostics') return 'none_read_only_diagnostics';
  if (type === 'read_only_subject_recovery_diagnostics') return 'none_read_only_diagnostics';
  return 'unknown_requires_operator_review';
}

function capacityFillOpportunityFor({ subject, runId, baseUrl, dispatchCapacity, enqueuePreview, providerBackoff, throughputEfficiency }) {
  const remaining = Number(dispatchCapacity?.activeCapacityRemaining ?? 0);
  if (providerBackoff?.hardStopActive) {
    return {
      status: 'no_capacity_fill_provider_hard_stop',
      recommended: null,
      reason: 'provider_auth_or_quota_hard_stop_active'
    };
  }
  if (['below_acceptable_efficiency', 'acceptable_for_one_guarded_observation_only'].includes(cleanText(throughputEfficiency?.status))) {
    return {
      status: 'no_capacity_fill_while_efficiency_requires_guarded_observation',
      recommended: null,
      reason: 'historical_yield_below_threshold_allows_at_most_one_guarded_observation_path'
    };
  }
  if (remaining <= 0) {
    return {
      status: 'no_capacity_fill_slot_available',
      recommended: null,
      reason: dispatchCapacity?.activeCapacityStatus || 'capacity_unavailable'
    };
  }
  if (enqueuePreview?.preflight?.status !== 'ready_for_exact_cell_enqueue') {
    return {
      status: 'no_capacity_fill_enqueue_ready',
      recommended: null,
      reason: Array.isArray(enqueuePreview?.preflight?.failures) ? enqueuePreview.preflight.failures.join(',') : 'enqueue_preview_not_ready'
    };
  }
  const cellId = enqueuePreview.selection?.selectedCellId;
  const blueprintId = enqueuePreview.selection?.selectedBlueprintId;
  return {
    status: 'capacity_fill_enqueue_ready_for_explicit_authorization',
    recommended: {
      type: 'enqueue_one_exact_cell_job_to_fill_available_capacity',
      subject,
      productionRunId: runId,
      productionCellId: cellId,
      blueprintId,
      productionGapKey: enqueuePreview.enqueueBody?.productionGapKey || null
    },
    operatorCommands: enqueueCommands({ subject, runId, cellId, blueprintId, baseUrl }),
    explicitAuthorizationRequired: `Authorize exactly one DB enqueue for ${subject} production run #${runId}, cell #${cellId}, blueprint #${blueprintId}, accepting one queued generation job DB write but no Provider call.`,
    stopAfter: [
      'one_generation_job_is_enqueued_for_the_selected_cell',
      'active_capacity_is_filled_but_no_provider_call_is_made',
      'queued_revalidation_identifies_the_exact_job_before_any_provider_call'
    ]
  };
}

function ownerRevalidationPlanFor(subject, runId) {
  try {
    return runJson('scripts/csca-subject-practice-owner-revalidation-plan.cjs', [
      `--subject=${subject}`,
      `--run=${runId}`,
      '--limit=20'
    ]);
  } catch (error) {
    return {
      mode: 'subject_practice_owner_revalidation_plan',
      status: 'unavailable',
      error: error instanceof Error ? error.message : String(error),
      productionImpact: 'none_read_only_execution_plan',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_expected'
    };
  }
}

function ownerCandidateInspectionFor(subject, runId, candidateIds) {
  if (!candidateIds.length) return null;
  try {
    return runJson('scripts/csca-subject-practice-owner-candidate-inspection.cjs', [
      `--subject=${subject}`,
      `--run=${runId}`,
      `--candidate-ids=${candidateIds.join(',')}`
    ]);
  } catch (error) {
    return {
      mode: 'subject_practice_owner_candidate_inspection',
      status: 'unavailable',
      error: error instanceof Error ? error.message : String(error),
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_attempted',
      doesNotAuthorizeExecution: true
    };
  }
}

function ownerRevalidationCommands({ subject, runId, candidateIds, exactContentSetSha256 }) {
  const ids = candidateIds.join(',');
  const common = `--subject=${subject} --run=${runId} --candidate-ids=${ids} --json`;
  return {
    plan: `npm.cmd run csca-ai-questioning:subject-practice-owner-revalidation-plan -- --subject=${subject} --run=${runId} --json`,
    inspectCandidateContent: `npm.cmd run csca-ai-questioning:subject-practice-owner-candidate-inspection -- ${common}`,
    preview: `npm.cmd run csca-ai-questioning:subject-practice-owner-revalidation-apply -- ${common}`,
    applyAfterAuthorization: `npm.cmd run csca-ai-questioning:subject-practice-owner-revalidation-apply -- ${common} --apply --confirm-exact-owner-revalidation --expected-content-set-sha256=${exactContentSetSha256}`,
    verifyScorecard: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=${subject} --${subject}-run=${runId} --sample=80 --json`,
    verifyProductionAudit: `npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=${subject} --run=${runId} --sample=80 --days=30 --json`
  };
}

function guardedObservationReadinessFor({ subject, enqueuePreview, throughputEfficiency, observationContinuation }) {
  const plan = enqueuePreview?.questionPlanPreview?.questionPlan || null;
  const exactGate = enqueuePreview?.questionPlanPreview?.exactObservationGate || null;
  const attempt = enqueuePreview?.questionPlanPreview?.exactObservationAttempt || null;
  const prompt = enqueuePreview?.promptContractPreview || null;
  const cost = prompt?.executionCostPolicy || null;
  const checks = {
    historicalYieldBelowThreshold: cleanText(throughputEfficiency?.status) === 'below_acceptable_efficiency',
    exactCellPreflightReady: enqueuePreview?.preflight?.status === 'ready_for_exact_cell_enqueue',
    questionPlanPresent: Boolean(plan?.planTemplate && plan?.taskFamily),
    questionPlanRequiredAndValid: exactGate?.mode === 'plan_required'
      && exactGate?.generationAllowed === true
      && exactGate?.validation?.valid === true,
    questionPlanAttemptReady: attempt?.status === 'plan_ready',
    promptContractPassed: prompt?.status === 'passed',
    promptBudgetPassed: prompt?.promptBudgetStatus === 'passed'
      && Number(prompt?.totalPromptCharacters) > 0
      && Number(prompt?.totalPromptCharacters) <= Number(prompt?.promptCharacterBudget),
    guardedLowReasoningPolicyActive: cost?.status === 'guarded_low_reasoning_policy_active'
      && cost?.model === 'deepseek-v4-flash'
      && cost?.thinkingMode === 'enabled'
      && cost?.reasoningEffort === 'low'
      && cost?.temperaturePolicy === 'omitted_for_thinking_mode'
      && cost?.reasoningPolicyVersion === 'question-generation-reasoning-effort-v2',
    outputTokenCeilingBounded: Number(cost?.outputTokenCeiling) === 8000,
    noProviderOrDbMutation: enqueuePreview?.providerImpact === 'none_no_provider_call'
      && enqueuePreview?.dbImpact === 'read_only_preview',
    continuationAllowsOneMore: observationContinuation?.continuation?.status === 'eligible_for_one_more_guarded_observation'
      && observationContinuation?.continuation?.doesNotAuthorizeExecution === true
      && observationContinuation?.continuation?.requiresFreshExplicitAuthorization === true
  };
  const ready = subject !== 'math' && Object.values(checks).every(Boolean);
  return {
    status: ready ? 'ready_for_one_guarded_observation_task_authorization' : 'not_ready_for_guarded_observation',
    ready,
    subject,
    productionCellId: enqueuePreview?.selection?.selectedCellId || null,
    blueprintId: enqueuePreview?.selection?.selectedBlueprintId || null,
    taskFamily: plan?.taskFamily || null,
    planTemplate: plan?.planTemplate || null,
    promptCharacters: Number(prompt?.totalPromptCharacters) || null,
    promptBudget: Number(prompt?.promptCharacterBudget) || null,
    executionCostPolicy: cost,
    checks,
    authorizationBoundary: ready
      ? 'one_backend_owned_provider_call_and_local_evidence_writes_with_explicit_cost_cap_no_student_publication'
      : 'no_observation_task_or_provider_action_recommended',
    observationContinuation,
    evidenceLimit: 'local_plan_prompt_safety_and_durable_cumulative_observation_budget_readiness_only_not_future_provider_quality'
  };
}

function guardedObservationCommands({ subject, runId, cellId }) {
  const common = `--subject=${subject} --run=${runId} --cell=${cellId} --max-estimated-cost-usd=0.01 --json`;
  return {
    startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${cellId}`,
    targetPromptContractSelfTest: `npm.cmd run csca-ai-questioning:guarded-observation-run -- --subject=${subject} --run=${runId} --cell=${cellId} --self-test-target-prompt-contract --json`,
    preview: `npm.cmd run csca-ai-questioning:guarded-observation-run -- ${common}`,
    applyAfterAuthorization: `npm.cmd run csca-ai-questioning:guarded-observation-run -- ${common} --apply --wait --timeout-ms=900000 --confirm-subject-practice-guarded-observation-run --confirm-provider-recovery --confirm-run=${runId} --confirm-cell=${cellId}`,
    observationScorecard: `npm.cmd run csca-ai-questioning:observation-scorecard -- --subject=${subject} --run=${runId} --cell=${cellId} --limit=20 --json`
  };
}

function recoveryDecisionFor({ subject, runId, audit, enqueuePreview, throughputEfficiency, observationContinuation }) {
  const stageEvidence = throughputEfficiency?.boundedMathStageEvidence;
  if (subject === 'math' && stageEvidence?.status === 'passed' && stageEvidence?.efficiencySatisfied === true) {
    const cellId = Number(stageEvidence.productionCellId) || null;
    return {
      status: 'math_stage_validated_select_next_guarded_family',
      recommended: {
        type: 'read_only_math_guarded_family_selection',
        subject,
        productionRunId: runId,
        validatedProductionCellId: cellId,
        stageEvidence
      },
      operatorCommands: {
        guardedFamilySelector: `npm.cmd run csca-ai-questioning:math-guarded-family-selector -- --run=${runId} --validated-cell=${cellId} --json`,
        noProviderAcceptance: `npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance -- --math-run=${runId} --math-observation-cell=${cellId} --json`
      },
      explicitAuthorizationRequired: 'No Provider authorization is needed for read-only guarded-family selection. Any later live validation requires a fresh authorization naming the selected family and exact call limit.',
      stopAfter: [
        'validated_cell_is_excluded_from_repeat_provider_spend',
        'next_guarded_family_is_selected_and_locally_calibrated_without_provider',
        'no_provider_call_or_student_publication_occurs'
      ]
    };
  }
  const continuationStatus = cleanText(observationContinuation?.continuation?.status);
  const guardedObservationPathRequired = ['below_acceptable_efficiency', 'acceptable_for_one_guarded_observation_only']
    .includes(cleanText(throughputEfficiency?.status));
  if (guardedObservationPathRequired
    && continuationStatus
    && continuationStatus !== 'eligible_for_one_more_guarded_observation') {
    const cellId = Number(observationContinuation?.productionCellId) || null;
    return {
      status: 'guarded_observation_continuation_stopped',
      recommended: null,
      reason: continuationStatus,
      observationContinuation,
      operatorCommands: {
        observationScorecard: `npm.cmd run csca-ai-questioning:observation-scorecard -- --subject=${subject} --run=${runId} --cell=${cellId} --limit=20 --json`,
        auditAgain: `npm.cmd run csca-ai-questioning:subject-practice-next-action -- --subject=${subject} --run=${runId} --observation-cell=${cellId} --json`
      },
      explicitAuthorizationRequired: 'No guarded observation task, Provider call, or DB enqueue is recommended after the cumulative continuation gate stops this cell.',
      stopAfter: [
        continuationStatus,
        'do_not_submit_another_observation_without_new_evidence_and_a_new_scoped_policy_decision'
      ]
    };
  }
  if (cleanText(throughputEfficiency?.status) === 'acceptable_for_one_guarded_observation_only') return null;
  const reasons = arrayFrom(throughputEfficiency?.reasons);
  const runBlockedReason = reasons.find((reason) => reason.startsWith('run_blocked:')) || null;
  const yieldBelowReasons = reasons.filter((reason) => /yield_below_threshold/.test(reason));
  if (!runBlockedReason && !yieldBelowReasons.length) return null;
  if (subject !== 'math') {
    return {
      status: 'subject_recovery_diagnostics_required_before_live_or_enqueue',
      recommended: {
        type: 'read_only_subject_recovery_diagnostics',
        subject,
        productionRunId: runId,
        runStatus: audit?.run?.status || null,
        blockedReason: audit?.run?.blockedReasonCode || null,
        scorecardStatus: throughputEfficiency?.status || null,
        yieldBelowReasons,
        enqueuePreflightFailures: arrayFrom(enqueuePreview?.preflight?.failures),
        candidateCellId: enqueuePreview?.selection?.selectedCellId || null,
        candidateBlueprintId: enqueuePreview?.selection?.selectedBlueprintId || null
      },
      operatorCommands: recoveryCommands({ subject, runId }),
      explicitAuthorizationRequired: `No live Provider call or DB enqueue is recommended while ${subject} production is below the acceptable yield floor and the selected guarded plan is not fully ready.`,
      stopAfter: [
        'selected_cell_question_plan_and_prompt_contract_pass_locally',
        'historical_gate_bottleneck_is_classified',
        'next_action_is_limited_to_one_guarded_observation'
      ]
    };
  }
  return {
    status: 'math_recovery_diagnostics_required_before_live_or_enqueue',
    recommended: {
      type: 'read_only_math_recovery_diagnostics',
      subject,
      productionRunId: runId,
      runStatus: audit?.run?.status || null,
      blockedReason: audit?.run?.blockedReasonCode || null,
      scorecardStatus: throughputEfficiency?.status || null,
      yieldBelowReasons,
      enqueuePreflightFailures: arrayFrom(enqueuePreview?.preflight?.failures),
      candidateCellId: enqueuePreview?.selection?.selectedCellId || null,
      candidateBlueprintId: enqueuePreview?.selection?.selectedBlueprintId || null
    },
    operatorCommands: recoveryCommands({ subject, runId }),
    explicitAuthorizationRequired: 'No live Provider call or DB enqueue is recommended while math production is blocked or below the acceptable yield floor.',
    stopAfter: [
      'math_run_unblocked_or_new_guarded_observation_run_selected',
      'math_question_plan_calibration_identifies_preferred_family_to_test',
      'fresh_math_live_gate_evidence_is_available_before_completion_claim'
    ]
  };
}

function buildDecision({ subject, runId, baseUrl, allowlist, audit, revalidation, enqueuePreview, providerBackoff, throughputEfficiency, observationContinuation, ownerRevalidationPlan, ownerCandidateInspection }) {
  const ownerCandidateIds = arrayFrom(ownerRevalidationPlan?.ownerRevalidation?.formalGatePublishableCandidateIds)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const exactContentSetSha256 = cleanText(ownerCandidateInspection?.exactContentSetSha256).toLowerCase();
  const candidateContentReady = ownerCandidateInspection?.status === 'ready_for_manual_academic_authorization_review'
    && /^[a-f0-9]{64}$/.test(exactContentSetSha256)
    && JSON.stringify(arrayFrom(ownerCandidateInspection?.requestedCandidateIds).map(Number)) === JSON.stringify(ownerCandidateIds);
  if (ownerRevalidationPlan?.status === 'ready_for_authorized_low_risk_revalidation' && ownerCandidateIds.length > 0 && !candidateContentReady) {
    return {
      status: 'existing_candidate_content_inspection_required',
      recommended: null,
      ownerCandidateInspection,
      explicitAuthorizationRequired: 'No candidate DB write or automatic publication is recommended until exact content inspection passes and produces a stable content-set SHA-256.',
      stopAfter: [
        'rerun_exact_candidate_content_inspection',
        'manually_review_academic_correctness',
        'require_the_same_exact_candidate_whitelist_and_content_set_sha256_before_apply'
      ]
    };
  }
  if (ownerRevalidationPlan?.status === 'ready_for_authorized_low_risk_revalidation' && ownerCandidateIds.length > 0) {
    return {
      status: 'existing_candidate_revalidation_ready_for_explicit_authorization',
      recommended: {
        type: 'revalidate_existing_candidates_without_provider',
        subject,
        productionRunId: runId,
        candidateIds: ownerCandidateIds,
        exactContentSetSha256,
        providerCallLimit: 0,
        publicationPolicy: 'existing_automatic_gate_only_after_exact_explicit_authorization'
      },
      operatorCommands: ownerRevalidationCommands({ subject, runId, candidateIds: ownerCandidateIds, exactContentSetSha256 }),
      explicitAuthorizationRequired: `Authorize deterministic owner revalidation for existing ${subject} candidate(s) ${ownerCandidateIds.map((id) => `#${id}`).join(', ')} in production run #${runId} with exact content-set SHA-256 ${exactContentSetSha256}, allowing exact candidate review metadata/status DB writes and publication only through the existing automatic gate, with zero Provider calls.`,
      stopAfter: [
        'the_exact_candidate_whitelist_is_revalidated_once',
        'no_provider_call_occurs',
        'stop_if_any_preview_candidate_is_not_publishable_under_the_current_formal_gate',
        'rerun_quality_scorecard_and_production_audit_before_any_generation_spend'
      ]
    };
  }
  if (providerBackoff?.hardStopActive) {
    return {
      status: 'provider_hard_stop_before_live_or_enqueue',
      recommended: null,
      providerBackoff,
      recoveryPlan: {
        status: 'provider_recovery_probe_required_before_math_live_or_enqueue',
        legacyStatus: 'restart_backend_after_provider_repair_before_live_or_enqueue',
        reason: 'provider auth/quota hard-stop remains active until a later successful background-pool gateway call proves recovery',
        sequence: [
          'stop_duplicate_or_old_backend_processes_if_the_latest_hard_stop_signal_keeps_advancing',
          'restart_backend_or_observation_backend_after_provider_configuration_or_key_pool_repair',
          'rerun_read_only_next_action_until_latest_hard_stop_signal_stops_advancing',
          'after_explicit_operator_authorization_run_one_provider_recovery_probe',
          'only_then_request_exact_scoped_math_observation_authorization'
        ],
        liveSafety: [
          'does_not_authorize_math_observation_provider_call',
          'does_not_authorize_subject_practice_db_enqueue',
          'does_not_authorize_student_pool_publication'
        ]
      },
      operatorCommands: {
        auditAgain: `npm.cmd run csca-ai-questioning:subject-practice-next-action -- --subject=${subject} --run=${runId}`,
        inspectProviderErrors: `npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=${subject} --run=${runId} --sample=60 --days=2`,
        runtimeProcessAudit: 'npm.cmd run csca-ai-questioning:runtime-process-audit -- --json',
        runtimeProcessCleanupPlan: 'npm.cmd run csca-ai-questioning:runtime-process-cleanup-plan -- --json',
        listBackendProcessesReadOnly: 'Get-CimInstance Win32_Process -Filter "name = \'node.exe\'" | Where-Object { $_.CommandLine -match \'CSCAlite|backend|vite|nest|tsx|ts-node|npm\' } | Select-Object ProcessId,CreationDate,CommandLine',
        startObservationBackendAfterRestart: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${allowlist}`,
        targetPromptContractSelfTest: `npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=${runId} --cell=${enqueuePreview?.selection?.selectedCellId || allowlist} --json`,
        providerRecoveryState: 'npm.cmd run csca-ai-gateway:provider-recovery-state -- --json',
        providerRecoveryProbeAfterExplicitAuthorization: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean',
        verifyHardStopCleared: `npm.cmd run csca-ai-questioning:subject-practice-next-action -- --subject=${subject} --run=${runId} --json`,
        scorecardAfterRecovery: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=${subject} --json`
      },
      explicitAuthorizationRequired: 'No math live Provider call or DB enqueue is recommended while provider auth/quota hard-stop signals are active. A provider recovery probe is a separate one-call live-provider action and requires its own explicit operator authorization.',
      stopAfter: [
        'provider_balance_or_credentials_are_repaired',
        'duplicate_or_old_backend_processes_are_stopped_and_backend_is_restarted',
        'gateway_errors_no_longer_report_recent_provider_auth_or_quota_failures',
        'authorized_provider_recovery_probe_writes_a_successful_background_pool_gateway_ledger_entry',
        'next_action_preview_recommends_a_scoped_action_again'
      ]
    };
  }
  const recoveryDecision = recoveryDecisionFor({ subject, runId, audit, enqueuePreview, throughputEfficiency, observationContinuation });
  if (recoveryDecision) return recoveryDecision;

  const live = revalidation?.liveExecutionBoundary || {};
  const recommendedJobId = Array.isArray(live.recommendedJobIds) ? live.recommendedJobIds[0] : null;
  if (recommendedJobId) {
    const item = (revalidation.items || []).find((candidate) => candidate.jobId === recommendedJobId) || {};
    const cellId = item.productionCellId || (Array.isArray(live.allowedProductionCellIds) ? live.allowedProductionCellIds[0] : null);
    const commands = liveCommands({ subject, runId, cellId, jobId: recommendedJobId, allowlist, baseUrl });
    if (providerBackoff?.active) {
      return {
        status: 'provider_delivery_backoff_before_live_job',
        recommended: {
          type: 'wait_or_switch_provider_before_live_existing_queued_job',
          subject,
          productionRunId: runId,
          productionCellId: cellId,
          jobId: recommendedJobId,
          taskFamily: item.current?.taskFamily || null,
          planTemplate: item.current?.planTemplate || null
        },
        providerBackoff,
        operatorCommands: {
          auditAgain: `npm.cmd run csca-ai-questioning:subject-practice-next-action -- --subject=${subject} --run=${runId}`,
          previewWhenProviderRecovers: commands.preview,
          applyAfterFreshAuthorizationAndProviderRecovery: commands.applyAfterAuthorization
        },
        deferredLiveAuthorizationRequired: `After provider recovery, authorize exactly one live provider call for ${subject} production run #${runId}, job #${recommendedJobId}, cell #${cellId}, sending the generation prompt/payload to ${providerConfigSummary().baseUrl || 'the configured provider endpoint'} using ${providerConfigSummary().model || 'the configured model'} and accepting DB/gateway/candidate/gate/publish side effects.`,
        explicitAuthorizationRequired: 'No live execution is recommended while transient Provider delivery backoff is active.',
        stopAfter: [
          'provider_backoff_window_expires_or_provider_configuration_changes',
          'next_action_preview_recommends_live_job_ready_again'
        ]
      };
    }
    return {
      status: 'live_job_ready_for_preview_and_explicit_authorization',
      recommended: {
        type: 'live_existing_queued_job',
        subject,
        productionRunId: runId,
        productionCellId: cellId,
        jobId: recommendedJobId,
        taskFamily: item.current?.taskFamily || null,
        planTemplate: item.current?.planTemplate || null
      },
      operatorCommands: commands,
      explicitAuthorizationRequired: `Authorize exactly one live provider call for ${subject} production run #${runId}, job #${recommendedJobId}, cell #${cellId}, sending the generation prompt/payload to ${providerConfigSummary().baseUrl || 'the configured provider endpoint'} using ${providerConfigSummary().model || 'the configured model'} and accepting DB/gateway/candidate/gate/publish side effects.`,
      stopAfter: live.stopAfter || []
    };
  }

  if (enqueuePreview?.preflight?.status === 'ready_for_exact_cell_enqueue') {
    const cellId = enqueuePreview.selection?.selectedCellId;
    const blueprintId = enqueuePreview.selection?.selectedBlueprintId;
    const guardedObservationOnly = throughputEfficiency?.status === 'acceptable_for_one_guarded_observation_only';
    const observationCostReservation = enqueuePreview?.promptContractPreview?.executionCostPolicy?.costReservation || null;
    const taskFamily = enqueuePreview?.questionPlanPreview?.questionPlan?.taskFamily || null;
    const planTemplate = enqueuePreview?.questionPlanPreview?.questionPlan?.planTemplate || null;
    return {
      status: guardedObservationOnly
        ? 'guarded_observation_task_ready_for_explicit_authorization'
        : 'enqueue_ready_for_explicit_authorization',
      recommended: {
        type: guardedObservationOnly
          ? 'submit_one_guarded_observation_task'
          : 'enqueue_one_exact_cell_job',
        subject,
        productionRunId: runId,
        productionCellId: cellId,
        blueprintId,
        ...(guardedObservationOnly ? {
          taskFamily,
          planTemplate,
          maxEstimatedCostUsd: 0.01,
          maximumReservedCostUsd: observationCostReservation?.maximumReservedCostUsd ?? null,
          studentPublicationPolicy: 'observation_gate_evidence_only_no_student_publication'
        } : {}),
        productionGapKey: enqueuePreview.enqueueBody?.productionGapKey || null
      },
      operatorCommands: guardedObservationOnly
        ? guardedObservationCommands({ subject, runId, cellId })
        : enqueueCommands({ subject, runId, cellId, blueprintId, baseUrl }),
      explicitAuthorizationRequired: guardedObservationOnly
        ? `Authorize exactly one backend-owned guarded observation for ${subject} production run #${runId}, cell #${cellId}, task family ${taskFamily || 'unresolved'}, allowing at most one Provider request and local task/job/candidate/gate writes with an explicit USD 0.01 cap, while prohibiting student publication.`
        : `Authorize exactly one DB enqueue for ${subject} production run #${runId}, cell #${cellId}, blueprint #${blueprintId}, accepting one queued generation job DB write but no Provider call.`,
      stopAfter: guardedObservationOnly
        ? [
          'one_guarded_observation_task_reaches_terminal_or_requires_attention',
          'no_student_publication_occurs',
          'do_not_submit_a_second_task_without_fresh_authorization'
        ]
        : [
          'one_generation_job_is_enqueued_for_the_selected_cell',
          'queued_revalidation_identifies_the_exact_job_before_any_provider_call'
        ]
    };
  }

  const capacityStatus = audit?.provider?.dispatchCapacity?.activeCapacityStatus || enqueuePreview?.dispatchCapacity?.activeCapacityStatus || null;
  return {
    status: capacityStatus === 'active_capacity_exhausted_by_existing_jobs'
      ? 'wait_for_existing_active_jobs_or_process_exact_job'
      : 'no_safe_next_action_ready',
    recommended: null,
    operatorCommands: {
      audit: `npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=${subject} --run=${runId} --sample=60 --days=2`,
      enqueuePreview: `npm.cmd run csca-ai-questioning:subject-practice-exact-cell-enqueue -- --subject=${subject} --run=${runId}`
    },
    explicitAuthorizationRequired: 'No live execution or enqueue should be attempted from this report.',
    stopAfter: []
  };
}

function actionQueueFor({ subject, runId, decision, capacityFillOpportunity, throughputEfficiency }) {
  const queue = [];
  if (decision?.recommended) {
    queue.push({
      priority: 1,
      role: 'primary_next_action',
      status: decision.status,
      actionType: decision.recommended.type,
      target: decision.recommended,
      executionReadiness: actionQueueReadinessFor(decision),
      sideEffectScope: sideEffectScopeFor(cleanText(decision.recommended.type)),
      preAuthorizationChecks: preAuthorizationChecksFor(decision.recommended),
      authorizationText: decision.explicitAuthorizationRequired ?? null,
      operatorCommands: decision.operatorCommands ?? null,
      postExecutionVerificationCommands: ['read_only_math_recovery_diagnostics', 'read_only_subject_recovery_diagnostics'].includes(cleanText(decision.recommended.type))
        ? null
        : postExecutionVerificationCommands({
          subject,
          runId,
          operatorCommands: decision.operatorCommands
        }),
      stopAfter: decision.stopAfter ?? []
    });
  } else {
    queue.push({
      priority: 1,
      role: 'primary_next_action',
      status: decision?.status ?? 'no_decision',
      actionType: null,
      target: null,
      executionReadiness: 'no_authorized_action_ready',
      sideEffectScope: 'none',
      preAuthorizationChecks: preAuthorizationChecksFor(null),
      authorizationText: decision?.explicitAuthorizationRequired ?? 'No live execution or enqueue should be attempted from this report.',
      operatorCommands: decision?.operatorCommands ?? null,
      postExecutionVerificationCommands: null,
      stopAfter: decision?.stopAfter ?? []
    });
  }

  if (capacityFillOpportunity?.recommended) {
    queue.push({
      priority: 2,
      role: 'throughput_capacity_fill',
      status: capacityFillOpportunity.status,
      actionType: capacityFillOpportunity.recommended.type,
      target: capacityFillOpportunity.recommended,
      executionReadiness: 'requires_fresh_explicit_authorization',
      sideEffectScope: 'one_generation_job_db_enqueue_no_provider_call',
      preAuthorizationChecks: preAuthorizationChecksFor(capacityFillOpportunity.recommended),
      authorizationText: capacityFillOpportunity.explicitAuthorizationRequired ?? null,
      operatorCommands: capacityFillOpportunity.operatorCommands ?? null,
      postExecutionVerificationCommands: postExecutionVerificationCommands({
        subject,
        runId,
        operatorCommands: capacityFillOpportunity.operatorCommands
      }),
      stopAfter: capacityFillOpportunity.stopAfter ?? [],
      throughputLever: throughputEfficiency?.nextEfficiencyLever ?? null
    });
  } else if (throughputEfficiency?.nextEfficiencyLever) {
    queue.push({
      priority: 2,
      role: 'throughput_capacity_fill',
      status: capacityFillOpportunity?.status ?? 'no_capacity_fill_opportunity',
      actionType: null,
      target: null,
      executionReadiness: 'no_authorized_capacity_fill_ready',
      sideEffectScope: 'none',
      preAuthorizationChecks: preAuthorizationChecksFor(null),
      authorizationText: null,
      operatorCommands: capacityFillOpportunity?.operatorCommands ?? null,
      postExecutionVerificationCommands: null,
      stopAfter: capacityFillOpportunity?.stopAfter ?? [],
      throughputLever: throughputEfficiency.nextEfficiencyLever
    });
  }

  return {
    mode: 'ordered_subject_practice_next_action_queue',
    productionImpact: 'none_read_only_action_queue',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    orderingPolicy: 'zero_provider_existing_candidate_recovery_before_provider_or_enqueue_then_primary_existing_job_before_capacity_fill',
    items: queue
  };
}

function runContinuationRoutingSelfTest() {
  const base = {
    subject: 'physics',
    runId: 2,
    audit: {},
    enqueuePreview: {},
    throughputEfficiency: { status: 'below_acceptable_efficiency', reasons: [] }
  };
  const stopped = recoveryDecisionFor({
    ...base,
    observationContinuation: {
      productionCellId: 19,
      continuation: { status: 'stop_provider_sample_budget_exhausted' }
    }
  });
  if (stopped?.status !== 'guarded_observation_continuation_stopped' || stopped?.recommended !== null) {
    throw new Error('A stopped cumulative observation gate must produce a no-action stop decision.');
  }
  const eligible = recoveryDecisionFor({
    ...base,
    observationContinuation: {
      productionCellId: 19,
      continuation: { status: 'eligible_for_one_more_guarded_observation' }
    }
  });
  if (eligible !== null) throw new Error('An eligible cumulative observation gate must preserve guarded routing.');
  const mathSelection = recoveryDecisionFor({
    ...base,
    subject: 'math',
    runId: 1,
    throughputEfficiency: {
      status: 'acceptable_for_one_guarded_observation_only',
      boundedMathStageEvidence: { status: 'passed', efficiencySatisfied: true, productionCellId: 17 }
    },
    observationContinuation: {
      productionCellId: 17,
      continuation: { status: 'stop_legacy_protocol_evidence_only' }
    }
  });
  if (mathSelection?.recommended?.type !== 'read_only_math_guarded_family_selection') {
    throw new Error('A completed math stage must retain read-only next-family selection without another Provider observation.');
  }
  console.log(JSON.stringify({
    mode: 'subject_practice_next_action_continuation_routing_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    caseCount: 3
  }, null, 2));
}

function printText(report) {
  console.log(`Subject-practice next action ${report.subject} #${report.productionRunId}: ${report.decision.status}`);
  console.log(`- providerImpact=${report.providerImpact}; dbImpact=${report.dbImpact}; productionImpact=${report.productionImpact}`);
  console.log(`- dispatch capacity: ${report.dispatchCapacity.activeProductionJobCount}/${report.dispatchCapacity.activeJobLimit} (${report.dispatchCapacity.activeCapacityStatus})`);
  console.log(`- throughput efficiency: ${report.throughputEfficiency.status}; yields=${report.throughputEfficiency.yieldEvidence.deliveryYield ?? 'n/a'}/${report.throughputEfficiency.yieldEvidence.generatedToApprovedYield ?? 'n/a'}/${report.throughputEfficiency.yieldEvidence.attemptToApprovedYield ?? 'n/a'}`);
  console.log(`- provider backoff: ${report.providerBackoff.active ? 'active' : 'inactive'}; transientFailures=${report.providerBackoff.transientFailureCount}; latest=${report.providerBackoff.latestFailureAt || 'none'}`);
  if (report.providerBackoff.hardStopSourceSamples?.length) {
    const sample = report.providerBackoff.hardStopSourceSamples[0];
    console.log(`- latest hard-stop source: ${sample.subject || 'unknown'} topic=${sample.topicId || 'n/a'} blueprint=${sample.blueprintId || 'n/a'} task=${sample.taskType || 'n/a'} code=${sample.errorCode || 'n/a'} at=${sample.createdAt || 'n/a'}`);
  }
  if (report.decision.recommended) {
    const item = report.decision.recommended;
    console.log(`- recommended: ${item.type}, cell #${item.productionCellId}${item.jobId ? `, job #${item.jobId}` : ''}${item.blueprintId ? `, blueprint #${item.blueprintId}` : ''}`);
    console.log(`- authorization: ${report.decision.explicitAuthorizationRequired}`);
  } else {
    console.log('- recommended: none');
  }
  if (report.capacityFillOpportunity?.recommended) {
    const item = report.capacityFillOpportunity.recommended;
    console.log(`- capacity fill: ${item.type}, cell #${item.productionCellId}, blueprint #${item.blueprintId}`);
    console.log(`- capacity fill authorization: ${report.capacityFillOpportunity.explicitAuthorizationRequired}`);
  } else if (report.capacityFillOpportunity) {
    console.log(`- capacity fill: ${report.capacityFillOpportunity.status}`);
  }
  if (report.actionQueue?.items?.length) {
    for (const item of report.actionQueue.items) {
      console.log(`- action queue #${item.priority}: ${item.role}, status=${item.status}, readiness=${item.executionReadiness}`);
    }
  }
}

function main() {
  if (hasFlag('self-test-continuation-routing')) {
    runContinuationRoutingSelfTest();
    return;
  }
  loadProjectEnv();
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const requestedRun = runArgValue('run', 'latest');
  const sample = positiveInt('sample', 60);
  const days = positiveInt('days', 2);
  const baseUrl = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');
  const audit = runJson('scripts/csca-subject-practice-production-audit.cjs', [
    `--subject=${subject}`,
    `--run=${requestedRun}`,
    `--sample=${sample}`,
    `--days=${days}`
  ]);
  const runId = resolveAuditRunId(audit, requestedRun);
  const dispatchCapacity = compactDispatchCapacity(audit);
  const providerBackoff = providerBackoffFor(audit);
  const providerConfig = providerConfigSummary();
  const ownerRevalidationPlan = ownerRevalidationPlanFor(subject, runId);
  const mathStageEvidence = mathStageEvidenceFor(subject, runId);
  let throughputEfficiency = throughputEfficiencyFor(audit, dispatchCapacity, providerConfig, providerBackoff, mathStageEvidence);
  const activeOrRequestedAllowlist = deriveAllowlist(
    argValue('question-plan-cell-allowlist', argValue('cell-allowlist', '')),
    dispatchCapacity
  );
  const enqueuePreview = runJson('scripts/csca-subject-practice-exact-cell-enqueue.cjs', [
    `--subject=${subject}`,
    `--run=${runId}`,
    `--base-url=${baseUrl}`,
    '--include-prompt-contract'
  ]);
  const requestedObservationCell = Number(argValue('observation-cell', ''));
  const observationCellId = Number.isInteger(requestedObservationCell) && requestedObservationCell > 0
    ? requestedObservationCell
    : Number(enqueuePreview?.selection?.selectedCellId);
  const observationContinuation = observationContinuationFor(subject, runId, observationCellId);
  const guardedObservationReadiness = guardedObservationReadinessFor({
    subject,
    enqueuePreview,
    throughputEfficiency,
    observationContinuation
  });
  if (guardedObservationReadiness.ready) {
    throughputEfficiency = {
      ...throughputEfficiency,
      historicalStatus: throughputEfficiency.status,
      status: 'acceptable_for_one_guarded_observation_only',
      guardedObservationReadiness,
      nextEfficiencyLever: 'run_at_most_one_exact_guarded_observation_then_measure_delivery_candidate_and_gate_yield',
      evidenceLimit: 'historical_yield_remains_below_threshold_local_plan_readiness_only_allows_one_bounded_observation_path'
    };
  }
  const recoverableExistingCandidateIds = arrayFrom(ownerRevalidationPlan?.ownerRevalidation?.formalGatePublishableCandidateIds)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const ownerCandidateInspection = ownerCandidateInspectionFor(subject, runId, recoverableExistingCandidateIds);
  if (recoverableExistingCandidateIds.length > 0) {
    throughputEfficiency = {
      ...throughputEfficiency,
      existingCandidateRecovery: {
        status: 'preferred_before_any_new_provider_spend',
        candidateIds: recoverableExistingCandidateIds,
        exactContentSetSha256: cleanText(ownerCandidateInspection?.exactContentSetSha256) || null,
        providerCallLimit: 0,
        requiresFreshExplicitAuthorization: true
      },
      nextEfficiencyLever: 'revalidate_existing_publishable_candidates_before_any_new_provider_spend',
      evidenceLimit: 'deterministic_current_gate_dry_run_only_apply_and_publication_require_fresh_exact_authorization'
    };
  }
  const selectedCellAllowlist = cleanText(enqueuePreview?.selection?.selectedCellId);
  const allowlist = activeOrRequestedAllowlist || selectedCellAllowlist;
  const revalidation = allowlist
    ? runJson('scripts/csca-subject-practice-question-plan-queued-revalidation.cjs', [
      `--subject=${subject}`,
      `--run=${runId}`,
      '--enable-question-plan',
      `--question-plan-cell-allowlist=${allowlist}`
    ])
    : null;
  const report = {
    mode: 'subject_practice_next_action_preview',
    subject,
    productionRunId: runId,
    productionImpact: 'none_read_only_next_action_preview',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    providerConfig,
    providerBackoff,
    ownerRevalidationPlan,
    ownerCandidateInspection,
    mathStageEvidence,
    observationContinuation,
    guardedObservationReadiness,
    throughputEfficiency,
    derivedQuestionPlanCellAllowlist: allowlist || null,
    dispatchCapacity,
    providerDeliverySignals: compactProviderErrors(audit),
    queuedRevalidation: revalidation
      ? {
        summary: revalidation.summary,
        liveExecutionBoundary: revalidation.liveExecutionBoundary,
        items: (revalidation.items || []).map((item) => ({
          jobId: item.jobId,
          status: item.status,
          productionCellId: item.productionCellId,
          targetDifficulty: item.targetDifficulty,
          taskFamily: item.current?.taskFamily || null,
          planTemplate: item.current?.planTemplate || null,
          promptContractImpact: item.current?.promptContractImpact || null
        }))
      }
      : null,
    enqueuePreview: {
      selection: enqueuePreview.selection,
      dispatchCapacity: enqueuePreview.dispatchCapacity,
      preflight: enqueuePreview.preflight,
      questionPlanPreview: enqueuePreview.questionPlanPreview
        ? {
          productionImpact: enqueuePreview.questionPlanPreview.productionImpact ?? null,
          providerImpact: enqueuePreview.questionPlanPreview.providerImpact ?? null,
          dbImpact: enqueuePreview.questionPlanPreview.dbImpact ?? null,
          source: enqueuePreview.questionPlanPreview.source ?? null,
          planTemplate: enqueuePreview.questionPlanPreview.questionPlan?.planTemplate ?? null,
          taskFamily: enqueuePreview.questionPlanPreview.questionPlan?.taskFamily ?? null,
          exactObservationGateMode: enqueuePreview.questionPlanPreview.exactObservationGate?.mode ?? null,
          exactObservationGateAllowed: enqueuePreview.questionPlanPreview.exactObservationGate?.generationAllowed ?? null,
          exactObservationAttemptStatus: enqueuePreview.questionPlanPreview.exactObservationAttempt?.status ?? null,
          promptContractStatus: enqueuePreview.promptContractPreview?.status ?? null,
          promptCharacters: enqueuePreview.promptContractPreview?.totalPromptCharacters ?? null,
          promptBudget: enqueuePreview.promptContractPreview?.promptCharacterBudget ?? null,
          promptBudgetStatus: enqueuePreview.promptContractPreview?.promptBudgetStatus ?? null,
          executionCostPolicy: enqueuePreview.promptContractPreview?.executionCostPolicy ?? null
        }
        : null,
      enqueueBody: {
        blueprintIds: enqueuePreview.enqueueBody?.blueprintIds || [],
        productionRunId: enqueuePreview.enqueueBody?.productionRunId || null,
        productionCellId: enqueuePreview.enqueueBody?.productionCellId || null,
        generationProfileId: enqueuePreview.enqueueBody?.generationProfileId || null,
        productionGapKey: enqueuePreview.enqueueBody?.productionGapKey || null
      }
    },
    capacityFillOpportunity: null,
    decision: null,
    actionQueue: null
  };
  report.capacityFillOpportunity = capacityFillOpportunityFor({
    subject,
    runId,
    baseUrl,
    dispatchCapacity,
    enqueuePreview,
    providerBackoff,
    throughputEfficiency: report.throughputEfficiency
  });
  report.decision = buildDecision({
    subject,
    runId,
    baseUrl,
    allowlist,
    audit,
    revalidation,
    enqueuePreview,
    providerBackoff,
    throughputEfficiency: report.throughputEfficiency,
    observationContinuation: report.observationContinuation,
    ownerRevalidationPlan: report.ownerRevalidationPlan,
    ownerCandidateInspection: report.ownerCandidateInspection
  });
  report.actionQueue = actionQueueFor({
    subject,
    runId,
    decision: report.decision,
    capacityFillOpportunity: report.capacityFillOpportunity,
    throughputEfficiency: report.throughputEfficiency
  });
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else printText(report);
}

main();
