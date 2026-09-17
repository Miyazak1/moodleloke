#!/usr/bin/env node

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadEnv } = require('./load-env.cjs');
const { localPreProviderFailureReason } = require('./lib/subject-practice-observation-failure-classification.cjs');

loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return {}; }
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function currentPolicyReplayReportFor({ requested, candidateCount, summary, minimumStrictUsableYield }) {
  if (!requested) {
    return {
      requested: false,
      status: 'not_requested',
      mutatesHistoricalEvidence: false,
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none'
    };
  }
  if (candidateCount === 0) {
    return {
      requested: true,
      status: 'no_candidates',
      evidenceBasis: 'deterministic_current_code_read_only',
      mutatesHistoricalEvidence: false,
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      candidateCount: 0,
      strictUsableYield: null,
      minimumStrictUsableYield,
      strictUsableThresholdMet: false
    };
  }
  const replaySummary = asJson(summary);
  const strictBatchUniqueCandidateCount = asNumber(replaySummary.strictBatchUniqueCandidateCount);
  const strictUsableYield = ratio(strictBatchUniqueCandidateCount, candidateCount);
  return {
    requested: true,
    status: 'completed',
    evidenceBasis: 'deterministic_current_code_read_only',
    replayScope: 'selected_scorecard_candidate_ids_only',
    uniquenessScope: 'current_replay_cohort_only_not_external_approved_pool',
    mutatesHistoricalEvidence: false,
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    candidateCount,
    currentQuestionPlanBlockedCount: asNumber(replaySummary.currentQuestionPlanBlockedCount),
    currentQuestionPlanBlockedIds: replaySummary.currentQuestionPlanBlockedIds || [],
    currentOwnerEligibleCount: asNumber(replaySummary.ownerRevalidationCandidateCount),
    currentOwnerEligibleIds: replaySummary.ownerRevalidationCandidateIds || [],
    strictBatchUniquenessPolicy: replaySummary.strictBatchUniquenessPolicy || null,
    strictBatchUniqueCandidateCount,
    strictBatchUniqueCandidateIds: replaySummary.strictBatchUniqueCandidateIds || [],
    strictBatchNearDuplicateCandidateCount: asNumber(replaySummary.strictBatchNearDuplicateCandidateCount),
    strictBatchNearDuplicateCandidateIds: replaySummary.strictBatchNearDuplicateCandidateIds || [],
    strictUsableYield,
    minimumStrictUsableYield,
    strictUsableThresholdMet: strictUsableYield != null && strictUsableYield >= minimumStrictUsableYield
  };
}

function runCurrentPolicyReplay(subject, candidateIds) {
  if (candidateIds.length === 0) return null;
  const output = execFileSync(process.execPath, [
    path.resolve(__dirname, 'csca-subject-practice-reviewer-profile-replay.cjs'),
    `--subject=${subject}`,
    `--ids=${candidateIds.join(',')}`,
    '--statuses=',
    `--limit=${candidateIds.length}`,
    '--summary-only',
    '--json'
  ], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output).summary;
}

function observationQualityAndKnownSafetyPassedFor(input) {
  return input.enoughSamples
    && input.deliveryYield >= input.minimumDeliveryYield
    && input.candidateYield === 1
    && input.gateYield >= input.minimumGateYield
    && input.questionPlanEvaluationCoverage === 1
    && input.questionPlanAdherenceYield >= input.minimumQuestionPlanAdherenceYield
    && input.studentViolationCount === 0
    && input.providerAttemptViolationCount === 0
    && input.costCapViolationCount === 0;
}

function roundUsd(value) {
  return Number(asNumber(value).toFixed(9));
}

function validationProtocolCohortFor(samples, validationProtocolVersion) {
  if (!validationProtocolVersion) return samples;
  return samples.filter((sample) => sample.validationProtocolVersion === validationProtocolVersion);
}

function validationBatchCohortFor(samples, validationBatchId) {
  if (!validationBatchId) return samples;
  return samples.filter((sample) => sample.validationBatchId === validationBatchId);
}

function observationScorecardStatusFor(input) {
  if (input.hasActiveTasks) return 'awaiting_terminal_observation_tasks';
  if (!input.enoughSamples) return 'insufficient_provider_samples';
  if (input.passed) return 'bounded_observation_passed';
  if (input.knownMechanismSafetyPassed && input.currentProtocolEvidenceMissing) {
    return 'legacy_bounded_evidence_missing_current_cost_or_attempt_caps';
  }
  return 'bounded_observation_failed';
}

function observationContinuationDecisionFor(input) {
  const base = {
    policyVersion: 'guarded-observation-continuation-v1',
    doesNotAuthorizeExecution: true,
    requiresFreshExplicitAuthorization: false,
    actionType: null
  };
  if (input.hasActiveTasks) {
    return { ...base, status: 'wait_for_active_observation_task' };
  }
  if (input.safetyViolation) {
    return { ...base, status: 'stop_observation_safety_violation' };
  }
  if (input.currentProtocolEvidenceMissing && input.providerSampleCount > 0) {
    return { ...base, status: 'stop_legacy_protocol_evidence_only' };
  }
  if (input.scorecardStatus === 'bounded_observation_passed') {
    return { ...base, status: 'stop_bounded_observation_passed' };
  }
  if (input.enoughSamples) {
    return { ...base, status: 'stop_quality_threshold_not_met' };
  }
  if (input.providerSampleCount >= input.maximumProviderSamples) {
    return { ...base, status: 'stop_provider_sample_budget_exhausted' };
  }
  if (input.totalCostUsd >= input.maximumCumulativeCostUsd) {
    return { ...base, status: 'stop_cumulative_cost_budget_exhausted' };
  }
  if (input.averageCostPerPublishableUsd != null
    && input.averageCostPerPublishableUsd > input.maximumCostPerPublishableUsd) {
    return { ...base, status: 'stop_cost_per_publishable_above_threshold' };
  }
  if (input.totalCostUsd + input.maximumNextReservedCostUsd > input.maximumCumulativeCostUsd) {
    return { ...base, status: 'stop_cumulative_cost_budget_exhausted' };
  }
  return {
    ...base,
    status: 'eligible_for_one_more_guarded_observation',
    requiresFreshExplicitAuthorization: true,
    actionType: 'submit_one_guarded_observation_task'
  };
}

function runSelfTest() {
  const statusCases = [
    [{ hasActiveTasks: false, enoughSamples: true, passed: true, knownMechanismSafetyPassed: true, currentProtocolEvidenceMissing: false }, 'bounded_observation_passed'],
    [{ hasActiveTasks: false, enoughSamples: true, passed: false, knownMechanismSafetyPassed: true, currentProtocolEvidenceMissing: true }, 'legacy_bounded_evidence_missing_current_cost_or_attempt_caps'],
    [{ hasActiveTasks: false, enoughSamples: true, passed: false, knownMechanismSafetyPassed: false, currentProtocolEvidenceMissing: false }, 'bounded_observation_failed'],
    [{ hasActiveTasks: false, enoughSamples: false, passed: false, knownMechanismSafetyPassed: false, currentProtocolEvidenceMissing: false }, 'insufficient_provider_samples'],
    [{ hasActiveTasks: true, enoughSamples: true, passed: false, knownMechanismSafetyPassed: false, currentProtocolEvidenceMissing: false }, 'awaiting_terminal_observation_tasks']
  ];
  for (const [input, expected] of statusCases) {
    const actual = observationScorecardStatusFor(input);
    if (actual !== expected) throw new Error(`Scorecard status fixture expected ${expected}, got ${actual}.`);
  }
  const base = {
    hasActiveTasks: false,
    safetyViolation: false,
    currentProtocolEvidenceMissing: false,
    scorecardStatus: 'insufficient_provider_samples',
    enoughSamples: false,
    providerSampleCount: 1,
    maximumProviderSamples: 3,
    totalCostUsd: 0.004,
    maximumCumulativeCostUsd: 0.03,
    maximumNextReservedCostUsd: 0.00434,
    averageCostPerPublishableUsd: 0.004,
    maximumCostPerPublishableUsd: 0.01
  };
  const continuationCases = [
    [{ ...base, hasActiveTasks: true }, 'wait_for_active_observation_task'],
    [{ ...base, safetyViolation: true }, 'stop_observation_safety_violation'],
    [{ ...base, currentProtocolEvidenceMissing: true }, 'stop_legacy_protocol_evidence_only'],
    [{ ...base, scorecardStatus: 'bounded_observation_passed', enoughSamples: true, providerSampleCount: 3 }, 'stop_bounded_observation_passed'],
    [{ ...base, enoughSamples: true, providerSampleCount: 3 }, 'stop_quality_threshold_not_met'],
    [{ ...base, providerSampleCount: 3 }, 'stop_provider_sample_budget_exhausted'],
    [{ ...base, totalCostUsd: 0.028 }, 'stop_cumulative_cost_budget_exhausted'],
    [{ ...base, averageCostPerPublishableUsd: 0.02 }, 'stop_cost_per_publishable_above_threshold'],
    [base, 'eligible_for_one_more_guarded_observation']
  ];
  for (const [input, expected] of continuationCases) {
    const actual = observationContinuationDecisionFor(input);
    if (actual.status !== expected) throw new Error(`Continuation fixture expected ${expected}, got ${actual.status}.`);
    if (actual.doesNotAuthorizeExecution !== true) throw new Error('Continuation decision must never authorize execution.');
  }
  const qualityBase = {
    enoughSamples: true,
    deliveryYield: 1,
    minimumDeliveryYield: 1,
    candidateYield: 1,
    gateYield: 2 / 3,
    minimumGateYield: 2 / 3,
    questionPlanEvaluationCoverage: 1,
    questionPlanAdherenceYield: 2 / 3,
    minimumQuestionPlanAdherenceYield: 2 / 3,
    studentViolationCount: 0,
    providerAttemptViolationCount: 0,
    costCapViolationCount: 0
  };
  const qualityCases = [
    [qualityBase, true],
    [{ ...qualityBase, deliveryYield: 2 / 3 }, false],
    [{ ...qualityBase, questionPlanEvaluationCoverage: 2 / 3 }, false],
    [{ ...qualityBase, questionPlanAdherenceYield: 1 / 3 }, false]
  ];
  for (const [input, expected] of qualityCases) {
    const actual = observationQualityAndKnownSafetyPassedFor(input);
    if (actual !== expected) throw new Error(`Scorecard quality fixture expected ${expected}, got ${actual}.`);
  }
  const localPreProviderCases = [
    [{ provider: 'prompt-budget-gate' }, 'prompt_budget_gate'],
    [{ jobError: 'generator_prompt_budget_exceeded' }, 'prompt_budget_exceeded'],
    [{ jobError: 'observation_provider_cost_admission_failed: {"validGuardedPolicy":false}' }, 'provider_cost_admission_failed_before_gateway'],
    [{ jobError: 'Provider request failed; cause=Error/EACCES/connect EACCES 198.18.0.64:443' }, 'connect_eacces_443_local_network_denial'],
    [{ jobMetadata: { providerStatus: 'provider_http_400' } }, null]
  ];
  for (const [input, expected] of localPreProviderCases) {
    const actual = localPreProviderFailureReason(input);
    if (actual !== expected) throw new Error(`Local pre-Provider fixture expected ${expected}, got ${actual}.`);
  }
  const protocolFixtures = [
    { taskId: 'legacy', validationProtocolVersion: null, validationBatchId: null },
    { taskId: 'v3-a', validationProtocolVersion: 'math-elementary-direct-property-rotation-v3', validationBatchId: 'batch-a' },
    { taskId: 'v3-b', validationProtocolVersion: 'math-elementary-direct-property-rotation-v3', validationBatchId: 'batch-b' },
    { taskId: 'v3-a-2', validationProtocolVersion: 'math-elementary-direct-property-rotation-v3', validationBatchId: 'batch-a' },
    { taskId: 'old-v2', validationProtocolVersion: 'math-elementary-direct-property-compact-v2', validationBatchId: 'batch-a' }
  ];
  const versionedFixtures = validationProtocolCohortFor(protocolFixtures, 'math-elementary-direct-property-rotation-v3');
  if (versionedFixtures.length !== 3 || versionedFixtures.some((sample) => !sample.taskId.startsWith('v3-'))) {
    throw new Error('Validation protocol cohort must exclude legacy and other-version samples.');
  }
  const batchFixtures = validationBatchCohortFor(versionedFixtures, 'batch-a');
  if (batchFixtures.length !== 2 || batchFixtures.some((sample) => sample.validationBatchId !== 'batch-a')) {
    throw new Error('Validation batch cohort must isolate one exact batch inside the selected protocol.');
  }
  const replayFixture = currentPolicyReplayReportFor({
    requested: true,
    candidateCount: 3,
    minimumStrictUsableYield: 2 / 3,
    summary: {
      currentQuestionPlanBlockedCount: 1,
      currentQuestionPlanBlockedIds: [611],
      ownerRevalidationCandidateCount: 2,
      ownerRevalidationCandidateIds: [610, 609],
      strictBatchUniquenessPolicy: 'fixture',
      strictBatchUniqueCandidateCount: 2,
      strictBatchUniqueCandidateIds: [610, 609],
      strictBatchNearDuplicateCandidateCount: 0,
      strictBatchNearDuplicateCandidateIds: []
    }
  });
  if (replayFixture.strictUsableYield !== 0.6667 || replayFixture.strictUsableThresholdMet !== true) {
    throw new Error('Current-policy replay fixture must qualify 2 of 3 candidates at the two-thirds threshold.');
  }
  console.log(JSON.stringify({
    mode: 'subject_practice_observation_scorecard_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    statusCaseCount: statusCases.length,
    continuationCaseCount: continuationCases.length,
    qualityCaseCount: qualityCases.length,
    localPreProviderCaseCount: localPreProviderCases.length,
    validationProtocolCohortCaseCount: 1,
    validationBatchCohortCaseCount: 1,
    currentPolicyReplayCaseCount: 1,
    caseCount: statusCases.length + continuationCases.length + qualityCases.length + localPreProviderCases.length + 3
  }, null, 2));
}

const subject = String(argValue('subject')).trim().toLowerCase();
if (!['math', 'physics', 'chemistry'].includes(subject)) {
  throw new Error('--subject=math|physics|chemistry is required.');
}
const observationActions = {
  math: 'math_scheduler_v2',
  physics: 'physics_scheduler_v2',
  chemistry: 'chemistry_scheduler_v2'
};
const runIdValue = Number(argValue('run'));
const cellIdValue = Number(argValue('cell'));
const runId = Number.isInteger(runIdValue) && runIdValue > 0 ? runIdValue : null;
const cellId = Number.isInteger(cellIdValue) && cellIdValue > 0 ? cellIdValue : null;
const requestedTaskFamily = cleanText(argValue('task-family')) || null;
const requestedValidationProtocolVersion = cleanText(argValue('validation-protocol-version')) || null;
const requestedValidationBatchId = cleanText(argValue('validation-batch-id')) || null;
const currentProtocolCohortOnly = hasFlag('current-protocol-cohort');
const limit = Math.max(1, Math.min(100, Math.trunc(asNumber(argValue('limit', '20'), 20))));
const minimumProviderSamples = Math.max(1, Math.min(20, Math.trunc(asNumber(argValue('minimum-provider-samples', '3'), 3))));
const minimumDeliveryYield = Math.max(0, Math.min(1, asNumber(argValue('minimum-delivery-yield', String(2 / 3)), 2 / 3)));
const minimumGateYield = Math.max(0, Math.min(1, asNumber(argValue('minimum-gate-yield', String(2 / 3)), 2 / 3)));
const minimumQuestionPlanAdherenceYield = Math.max(0, Math.min(1, asNumber(argValue('minimum-question-plan-adherence-yield', String(2 / 3)), 2 / 3)));
const maximumProviderSamples = Math.max(minimumProviderSamples, Math.min(20, Math.trunc(asNumber(argValue('maximum-provider-samples', '3'), 3))));
const maximumCumulativeCostUsd = Math.max(0, asNumber(argValue('maximum-cumulative-cost-usd', '0.03'), 0.03));
const maximumNextReservedCostUsd = Math.max(0, asNumber(argValue('maximum-next-reserved-cost-usd', '0.00434'), 0.00434));
const maximumCostPerPublishableUsd = Math.max(0, asNumber(argValue('maximum-cost-per-publishable-usd', '0.01'), 0.01));
const includeCurrentPolicyReplay = hasFlag('include-current-policy-replay');

async function main() {
  if (hasFlag('self-test')) {
    runSelfTest();
    return;
  }
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT task.id::text AS "taskId", task.status AS "taskStatus", task.action, task.subject,
             task.resource_id AS "resourceId", task.filter_snapshot AS "filterSnapshot",
             task.result AS "taskResult", task.error AS "taskError", task.created_at AS "createdAt",
             task.completed_at AS "completedAt",
             job.id AS "jobId", job.status AS "jobStatus", job.question_id AS "questionId",
             job.provider, job.model, job.error AS "jobError", job.prompt_metadata AS "promptMetadata",
             question.status AS "questionStatus", question.source_question_id AS "sourceQuestionId",
             question.review_metadata->'gate'->>'decision' AS "gateDecision",
             question.generation_metadata->'questionPlanAdherence'->>'adheres' AS "questionPlanAdheres",
             EXISTS (
               SELECT 1 FROM special_practice_questions student_question
               WHERE student_question.id = question.source_question_id
             ) AS "publishedToStudentPool",
             gateway."gatewayLogCount", gateway."providerAttemptCount", gateway."successLogCount",
             gateway."promptTokens", gateway."completionTokens", gateway."totalTokens", gateway."estimatedCostUsd"
      FROM csca_ai_questioning_tasks task
      LEFT JOIN LATERAL (
        SELECT candidate_job.*
        FROM csca_ai_generation_jobs candidate_job
        WHERE candidate_job.prompt_metadata->>'observationTaskId' = task.id::text
        ORDER BY candidate_job.created_at DESC
        LIMIT 1
      ) job ON TRUE
      LEFT JOIN csca_questions question ON question.id = job.question_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS "gatewayLogCount",
               COALESCE(SUM(COALESCE((log.metadata->>'gatewayProviderAttemptCount')::int, 1)), 0)::int AS "providerAttemptCount",
               COUNT(*) FILTER (WHERE log.status = 'success')::int AS "successLogCount",
               COALESCE(SUM(log.prompt_tokens), 0)::bigint AS "promptTokens",
               COALESCE(SUM(log.completion_tokens), 0)::bigint AS "completionTokens",
               COALESCE(SUM(log.total_tokens), 0)::bigint AS "totalTokens",
               COALESCE(SUM(log.estimated_cost), 0)::numeric AS "estimatedCostUsd"
        FROM ai_gateway_call_logs log
        WHERE log.metadata->>'observationTaskId' = task.id::text
          AND log.task_type = 'question_generation'
          AND log.source_module = 'question_generator'
      ) gateway ON TRUE
      WHERE task.task_type = 'subject_practice_observation'
        AND task.subject = $1
        AND ($2::int IS NULL OR task.resource_id = $2::text)
        AND ($3::int IS NULL OR (task.filter_snapshot->>'productionCellId')::int = $3)
        AND ($5::text IS NULL OR COALESCE(task.filter_snapshot->>'requestedTaskFamily', job.prompt_metadata->'questionPlan'->>'taskFamily') = $5)
      ORDER BY task.created_at DESC
      LIMIT $4
    `, subject, runId, cellId, limit, requestedTaskFamily);

    const allScopedSamples = rows.reverse().map((row) => {
      const taskFilter = asJson(row.filterSnapshot);
      const jobMetadata = asJson(row.promptMetadata);
      const providerAttemptCount = asNumber(row.providerAttemptCount);
      const estimatedCostUsd = roundUsd(row.estimatedCostUsd);
      const maxEstimatedCostUsd = asNumber(taskFilter.maxEstimatedCostUsd) || null;
      const providerAttemptLimit = asNumber(
        jobMetadata.observationCostAdmission?.providerAttemptLimit
          ?? jobMetadata.providerAttemptLimit
          ?? 0
      ) || null;
      const observationCostAdmission = asJson(jobMetadata.observationCostAdmission);
      const taskResult = asJson(row.taskResult);
      const localPreProviderFailure = localPreProviderFailureReason({
        taskResult,
        jobMetadata,
        taskError: row.taskError,
        jobError: row.jobError,
        provider: row.provider
      });
      return {
        taskId: row.taskId,
        taskStatus: row.taskStatus,
        action: row.action,
        actionMatchesSubjectProtocol: row.action === observationActions[subject],
        subject: row.subject,
        productionRunId: asNumber(row.resourceId) || null,
        productionCellId: asNumber(taskFilter.productionCellId) || null,
        taskFamily: taskFilter.requestedTaskFamily ?? jobMetadata.questionPlan?.taskFamily ?? null,
        validationProtocolVersion: taskFilter.validationProtocolVersion ?? jobMetadata.validationProtocolVersion ?? null,
        validationBatchId: taskFilter.validationBatchId ?? jobMetadata.validationBatchId ?? null,
        planTemplate: taskFilter.requestedPlanTemplate ?? jobMetadata.questionPlan?.planTemplate ?? null,
        jobId: asNumber(row.jobId) || null,
        jobStatus: row.jobStatus ?? null,
        questionId: asNumber(row.questionId) || null,
        provider: row.provider ?? null,
        model: row.model ?? null,
        providerAttemptCount,
        effectiveProviderSample: providerAttemptCount > 0 && localPreProviderFailure == null,
        localPreProviderFailure,
        providerAttemptLimit,
        providerAttemptLimitExactlyOne: providerAttemptLimit == null ? null : providerAttemptLimit === 1,
        providerAttemptLimitRespected: providerAttemptLimit == null ? null : providerAttemptCount <= providerAttemptLimit,
        providerDelivered: asNumber(row.successLogCount) > 0,
        candidateRecorded: Boolean(row.questionId),
        gateDecision: row.gateDecision ?? null,
        gatePublishable: row.gateDecision === 'publishable',
        questionPlanAdheres: row.questionPlanAdheres == null ? null : row.questionPlanAdheres === 'true',
        studentPublished: row.publishedToStudentPool === true,
        promptTokens: asNumber(row.promptTokens),
        completionTokens: asNumber(row.completionTokens),
        totalTokens: asNumber(row.totalTokens),
        estimatedCostUsd,
        maximumReservedCostUsd: asNumber(taskFilter.maximumReservedCostUsd) || null,
        maxEstimatedCostUsd,
        costWithinAuthorizedCap: maxEstimatedCostUsd == null ? null : estimatedCostUsd <= maxEstimatedCostUsd + Number.EPSILON,
        costReservationPolicyVersion: taskFilter.costReservationPolicyVersion ?? null,
        guardedProviderCostAdmissionValid: Object.keys(observationCostAdmission).length
          ? observationCostAdmission.validGuardedPolicy === true && observationCostAdmission.validCostReservation === true
          : null,
        studentPublicationSuppressionConfigured: taskFilter.suppressStudentPublication !== false
          && jobMetadata.suppressStudentPublication === true
          && jobMetadata.publicationPolicy === 'observation_gate_evidence_only_no_student_publication',
        terminal: ['succeeded', 'failed', 'cancelled'].includes(row.taskStatus),
        taskError: row.taskError ?? null,
        jobError: row.jobError ?? null,
        createdAt: row.createdAt,
        completedAt: row.completedAt
      };
    });
    const isCurrentProtocolSample = (sample) => sample.actionMatchesSubjectProtocol
      && sample.providerAttemptLimitExactlyOne === true
      && sample.maxEstimatedCostUsd != null
      && sample.guardedProviderCostAdmissionValid === true
      && sample.studentPublicationSuppressionConfigured === true;
    const currentProtocolSamples = allScopedSamples.filter(isCurrentProtocolSample);
    const exactValidationProtocolSamples = validationProtocolCohortFor(allScopedSamples, requestedValidationProtocolVersion);
    const exactValidationBatchSamples = validationBatchCohortFor(exactValidationProtocolSamples, requestedValidationBatchId);
    const samples = currentProtocolCohortOnly
      ? exactValidationBatchSamples.filter((sample) => isCurrentProtocolSample(sample) || sample.localPreProviderFailure != null)
      : exactValidationBatchSamples;

    const terminal = samples.filter((sample) => sample.terminal);
    const providerAttempted = terminal.filter((sample) => sample.providerAttemptCount > 0);
    const localPreProviderDiagnostics = terminal.filter((sample) => sample.localPreProviderFailure != null);
    const effectiveProviderSamples = providerAttempted.filter((sample) => sample.effectiveProviderSample);
    const delivered = effectiveProviderSamples.filter((sample) => sample.providerDelivered);
    const candidates = delivered.filter((sample) => sample.candidateRecorded);
    const publishable = candidates.filter((sample) => sample.gatePublishable);
    const planEvaluated = candidates.filter((sample) => sample.questionPlanAdheres != null);
    const planAdhered = planEvaluated.filter((sample) => sample.questionPlanAdheres);
    const protocolSafetySamples = samples.filter((sample) => sample.localPreProviderFailure == null);
    const studentViolations = samples.filter((sample) => sample.studentPublished);
    const providerAttemptViolations = protocolSafetySamples.filter((sample) => sample.providerAttemptLimitRespected === false);
    const costCapViolations = protocolSafetySamples.filter((sample) => sample.costWithinAuthorizedCap === false);
    const missingCostCaps = protocolSafetySamples.filter((sample) => sample.maxEstimatedCostUsd == null);
    const missingProviderAttemptLimits = protocolSafetySamples.filter((sample) => sample.providerAttemptLimit == null);
    const actionProtocolViolations = samples.filter((sample) => !sample.actionMatchesSubjectProtocol);
    const providerAttemptPolicyViolations = protocolSafetySamples.filter((sample) => sample.providerAttemptLimitExactlyOne === false);
    const missingGuardedCostAdmissions = providerAttempted.filter((sample) => sample.guardedProviderCostAdmissionValid == null);
    const guardedCostAdmissionViolations = providerAttempted.filter((sample) => sample.guardedProviderCostAdmissionValid === false);
    const publicationSuppressionViolations = samples.filter((sample) => !sample.studentPublicationSuppressionConfigured);
    const totalCostUsd = roundUsd(providerAttempted.reduce((sum, sample) => sum + sample.estimatedCostUsd, 0));
    const averageCostPerPublishableUsd = publishable.length ? roundUsd(totalCostUsd / publishable.length) : null;
    const deliveryYield = ratio(delivered.length, effectiveProviderSamples.length);
    const candidateYield = ratio(candidates.length, delivered.length);
    const gateYield = ratio(publishable.length, candidates.length);
    const questionPlanEvaluationCoverage = ratio(planEvaluated.length, candidates.length);
    const questionPlanAdherenceYield = ratio(planAdhered.length, planEvaluated.length);
    const enoughSamples = effectiveProviderSamples.length >= minimumProviderSamples;
    const qualityAndKnownSafetyPassed = observationQualityAndKnownSafetyPassedFor({
      enoughSamples,
      deliveryYield,
      minimumDeliveryYield,
      candidateYield,
      gateYield,
      minimumGateYield,
      questionPlanEvaluationCoverage,
      questionPlanAdherenceYield,
      minimumQuestionPlanAdherenceYield,
      studentViolationCount: studentViolations.length,
      providerAttemptViolationCount: providerAttemptViolations.length,
      costCapViolationCount: costCapViolations.length
    });
    const knownMechanismSafetyPassed = qualityAndKnownSafetyPassed
      && actionProtocolViolations.length === 0
      && providerAttemptPolicyViolations.length === 0
      && guardedCostAdmissionViolations.length === 0
      && publicationSuppressionViolations.length === 0;
    const currentProtocolEvidenceMissing = missingCostCaps.length > 0
      || missingProviderAttemptLimits.length > 0
      || missingGuardedCostAdmissions.length > 0;
    const passed = knownMechanismSafetyPassed
      && missingCostCaps.length === 0
      && missingProviderAttemptLimits.length === 0
      && missingGuardedCostAdmissions.length === 0
      && !currentProtocolEvidenceMissing;
    const hasActiveTasks = samples.some((sample) => !sample.terminal);
    const status = observationScorecardStatusFor({
      hasActiveTasks,
      enoughSamples,
      passed,
      knownMechanismSafetyPassed,
      currentProtocolEvidenceMissing
    });
    const safetyViolation = studentViolations.length > 0
      || providerAttemptViolations.length > 0
      || costCapViolations.length > 0
      || actionProtocolViolations.length > 0
      || providerAttemptPolicyViolations.length > 0
      || guardedCostAdmissionViolations.length > 0
      || publicationSuppressionViolations.length > 0;
    const continuation = observationContinuationDecisionFor({
      hasActiveTasks,
      safetyViolation,
      currentProtocolEvidenceMissing,
      scorecardStatus: status,
      enoughSamples,
      providerSampleCount: effectiveProviderSamples.length,
      maximumProviderSamples,
      totalCostUsd,
      maximumCumulativeCostUsd,
      maximumNextReservedCostUsd,
      averageCostPerPublishableUsd,
      maximumCostPerPublishableUsd
    });
    const currentPolicyReplaySummary = includeCurrentPolicyReplay
      ? runCurrentPolicyReplay(subject, candidates.map((sample) => sample.questionId).filter(Boolean))
      : null;
    const currentPolicyReplay = currentPolicyReplayReportFor({
      requested: includeCurrentPolicyReplay,
      candidateCount: candidates.length,
      summary: currentPolicyReplaySummary,
      minimumStrictUsableYield: minimumGateYield
    });

    const report = {
      mode: 'subject_practice_observation_scorecard',
      status,
      subject,
      productionRunId: runId,
      productionCellId: cellId,
      requestedTaskFamily,
      requestedValidationProtocolVersion,
      requestedValidationBatchId,
      evidenceScope: requestedTaskFamily ? 'exact_requested_task_family' : 'all_task_families_in_subject_run_cell',
      protocolCohort: requestedValidationProtocolVersion
        ? 'exact_validation_protocol_version'
        : currentProtocolCohortOnly ? 'current_protocol_only' : 'all_historical_protocols',
      validationBatchCohort: requestedValidationBatchId ? 'exact_validation_batch' : 'all_batches_in_protocol',
      protocolCohortCounts: {
        allScopedSampleCount: allScopedSamples.length,
        currentProtocolSampleCount: currentProtocolSamples.length,
        exactValidationProtocolSampleCount: requestedValidationProtocolVersion ? exactValidationProtocolSamples.length : null,
        exactValidationBatchSampleCount: requestedValidationBatchId ? exactValidationBatchSamples.length : null,
        selectedCohortSampleCount: samples.length,
        excludedDifferentValidationProtocolSampleCount: requestedValidationProtocolVersion
          ? allScopedSamples.length - exactValidationProtocolSamples.length
          : 0,
        excludedLegacyOrIncompleteProtocolSampleCount: allScopedSamples.length - currentProtocolSamples.length
      },
      productionImpact: 'none_read_only_observation_scorecard',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      thresholds: {
        minimumProviderSamples,
        maximumProviderSamples,
        minimumDeliveryYield,
        minimumGateYield,
        minimumQuestionPlanAdherenceYield,
        maximumCumulativeCostUsd,
        maximumNextReservedCostUsd,
        maximumCostPerPublishableUsd
      },
      continuation,
      generationTimeEvidence: {
        status,
        passed,
        continuationStatus: continuation.status,
        candidateCount: candidates.length,
        publishableGateCount: publishable.length,
        gateYield,
        questionPlanAdherenceYield
      },
      evidenceSemantics: {
        generationTimeScorecardIsImmutable: true,
        currentPolicyReplayDoesNotRewriteStoredGateOrPlanEvidence: true,
        requirePassedUsesGenerationTimeScorecardOnly: true
      },
      funnels: {
        observedTaskCount: samples.length,
        terminalTaskCount: terminal.length,
        providerAttemptedTaskCount: providerAttempted.length,
        effectiveProviderSampleCount: effectiveProviderSamples.length,
        localPreProviderDiagnosticCount: localPreProviderDiagnostics.length,
        deliveredTaskCount: delivered.length,
        candidateCount: candidates.length,
        publishableGateCount: publishable.length,
        deliveryYield,
        candidateYield,
        gateYield,
        questionPlanEvaluatedCount: planEvaluated.length,
        questionPlanAdheredCount: planAdhered.length,
        questionPlanEvaluationCoverage,
        questionPlanAdherenceYield
      },
      cost: {
        totalEstimatedCostUsd: totalCostUsd,
        averageCostPerProviderAttemptedTaskUsd: effectiveProviderSamples.length ? roundUsd(totalCostUsd / effectiveProviderSamples.length) : null,
        averageCostPerDeliveredCandidateUsd: candidates.length ? roundUsd(totalCostUsd / candidates.length) : null,
        averageCostPerPublishableGateUsd: averageCostPerPublishableUsd,
        totalPromptTokens: providerAttempted.reduce((sum, sample) => sum + sample.promptTokens, 0),
        totalCompletionTokens: providerAttempted.reduce((sum, sample) => sum + sample.completionTokens, 0),
        totalTokens: providerAttempted.reduce((sum, sample) => sum + sample.totalTokens, 0),
        costCapViolationCount: costCapViolations.length,
        legacyMissingCostCapCount: missingCostCaps.length
      },
      safety: {
        studentPublicationViolationCount: studentViolations.length,
        studentPublicationSuppressionConfigurationViolationCount: publicationSuppressionViolations.length,
        subjectActionProtocolViolationCount: actionProtocolViolations.length,
        providerAttemptLimitViolationCount: providerAttemptViolations.length,
        providerAttemptLimitPolicyViolationCount: providerAttemptPolicyViolations.length,
        missingProviderAttemptLimitCount: missingProviderAttemptLimits.length,
        missingGuardedProviderCostAdmissionCount: missingGuardedCostAdmissions.length,
        guardedProviderCostAdmissionViolationCount: guardedCostAdmissionViolations.length,
        allCurrentCostCapsRespected: costCapViolations.length === 0,
        allKnownProviderAttemptLimitsRespected: providerAttemptViolations.length === 0,
        currentCostAndAttemptCapEvidenceComplete: !currentProtocolEvidenceMissing,
        currentObservationProtocolSatisfied: passed
      },
      interpretation: {
        passed,
        qualityAndKnownSafetyPassed,
        knownMechanismSafetyPassed,
        currentProtocolEvidenceMissing,
        providerFailuresCountOnlyInDeliveryYield: true,
        localPreProviderFailuresExcludedFromEffectiveSampleAndDeliveryDenominator: true,
        gateYieldDenominator: 'delivered_candidates_only',
        legacyRowsWithoutExplicitCostOrAttemptCapsRemainVisibleButCannotProveCurrentCapCompliance: true,
        studentConsumableQualityNotProvenByObservation: true
      },
      currentPolicyReplay,
      samples
    };

    if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Observation scorecard: ${subject} ${status}`);
      console.log(`- tasks=${samples.length} provider=${providerAttempted.length} delivered=${delivered.length} candidates=${candidates.length} publishable=${publishable.length}`);
      console.log(`- delivery=${deliveryYield ?? 'n/a'} candidate=${candidateYield ?? 'n/a'} gate=${gateYield ?? 'n/a'} costUsd=${totalCostUsd}`);
      console.log(`- studentPublicationViolations=${studentViolations.length} providerAttemptLimitViolations=${providerAttemptViolations.length} costCapViolations=${costCapViolations.length}`);
      console.log(`- protocol: actionViolations=${actionProtocolViolations.length} suppressionConfigViolations=${publicationSuppressionViolations.length} missingCostAdmissions=${missingGuardedCostAdmissions.length}`);
      console.log(`- continuation=${continuation.status} authorized=${!continuation.doesNotAuthorizeExecution}`);
      if (includeCurrentPolicyReplay) {
        console.log(`- currentPolicyReplay=${currentPolicyReplay.status} strictUsable=${currentPolicyReplay.strictBatchUniqueCandidateCount ?? 0}/${currentPolicyReplay.candidateCount ?? 0} yield=${currentPolicyReplay.strictUsableYield ?? 'n/a'} thresholdMet=${currentPolicyReplay.strictUsableThresholdMet}`);
      }
    }
    if (hasFlag('require-passed') && status !== 'bounded_observation_passed') process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, mode: 'subject_practice_observation_scorecard', message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
