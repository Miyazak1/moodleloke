#!/usr/bin/env node

const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { localPreProviderFailureSignal } = require('./lib/subject-practice-observation-failure-classification.cjs');

loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asInt(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function asNumber(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : null;
}

function round(value) {
  return value == null ? null : Number(value.toFixed(3));
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  }
  return null;
}

function deliveryFailureSignal(sample) {
  const errorText = cleanText([
    sample.taskResult?.deliveryFailure,
    sample.taskResult?.failureCategory,
    sample.jobMetadata?.failureCategory,
    sample.jobMetadata?.providerFailureCategory,
    sample.jobMetadata?.providerStatus,
    sample.jobError
  ].filter(Boolean).join(' ')).toLowerCase();
  if (!errorText) return false;
  return [
    'provider_',
    'gateway_',
    'quota',
    'cooldown',
    'disabled',
    'bad_request',
    'timeout',
    'network',
    'insufficient balance'
  ].some((needle) => errorText.includes(needle));
}

function sampleFromRow(row) {
  const taskResult = asJson(row.result) ?? {};
  const taskFilter = asJson(row.filterSnapshot) ?? {};
  const jobMetadata = asJson(row.promptMetadata) ?? {};
  const reviewMetadata = asJson(row.reviewMetadata) ?? {};
  const questionGenerationMetadata = asJson(row.generationMetadata) ?? {};
  const gateDecision = firstString(
    reviewMetadata.gate?.decision,
    taskResult.gateDecision,
    taskResult.autoApproval?.gateDecision
  );
  const specialPracticeQuestionCount = asInt(row.specialPracticeQuestionCount, 0) ?? 0;
  const suppressStudentPublication = taskFilter.suppressStudentPublication !== false
    || jobMetadata.suppressStudentPublication === true
    || questionGenerationMetadata.suppressStudentPublication === true;
  const status = cleanText(row.status);
  const active = ['queued', 'running'].includes(status);
  const terminal = !active;
  const gatewayAttemptCount = asInt(row.gatewayAttemptCount, 0) ?? 0;
  const localPreProviderFailure = localPreProviderFailureSignal({
    taskResult,
    jobMetadata,
    jobError: row.jobError,
    jobProvider: row.jobProvider,
    gatewayAttemptCount
  });

  return {
    taskId: cleanText(row.id),
    status,
    action: cleanText(row.action),
    productionRunId: asInt(row.resourceId, asInt(taskFilter.productionRunId, null)),
    productionCellId: asInt(taskFilter.productionCellId, asInt(taskResult.productionCellId, null)),
    completedAt: iso(row.completedAt || row.updatedAt),
    updatedAt: iso(row.updatedAt),
    jobId: asInt(row.jobId, null),
    jobStatus: cleanText(row.jobStatus),
    questionId: asInt(row.questionId, null),
    questionStatus: cleanText(row.questionStatus),
    jobProvider: cleanText(row.jobProvider),
    gatewayAttemptCount,
    sourceQuestionId: asInt(row.sourceQuestionId, null),
    observationJobCountForTask: asInt(row.observationJobCountForTask, 0) ?? 0,
    terminal,
    active,
    succeeded: status === 'succeeded',
    noCandidate: taskResult.noCandidate === true,
    gateDecision,
    gatePublishable: gateDecision === 'publishable',
    deliveryFailure: deliveryFailureSignal({
      taskResult,
      jobMetadata,
      jobError: row.jobError
    }),
    localPreProviderFailure,
    deliveredCandidate: Boolean(asInt(row.questionId, null)) && cleanText(row.jobStatus) === 'succeeded',
    suppressStudentPublication,
    studentPublished: specialPracticeQuestionCount > 0,
    specialPracticeQuestionCount,
    oneObservationJobForTask: (asInt(row.observationJobCountForTask, 0) ?? 0) === 1,
    taskResult,
    jobMetadata
  };
}

function divide(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : null;
}

function thresholdsFromArgs() {
  return {
    minimumTerminalSamples: Math.max(1, asInt(argValue('minimum-terminal-samples', '3'), 3)),
    minimumDeliverySuccessYield: Math.max(0, Math.min(1, asNumber(argValue('minimum-delivery-success-yield', '0.65'), 0.65))),
    minimumGatePublishableYield: Math.max(0, Math.min(1, asNumber(argValue('minimum-gate-publishable-yield', '0.35'), 0.35))),
    minimumOneJobPerTaskYield: Math.max(0, Math.min(1, asNumber(argValue('minimum-one-job-per-task-yield', '1'), 1))),
    requiredStudentPublishedCount: 0
  };
}

function evaluatePostfixEfficiency(samples, thresholds = thresholdsFromArgs()) {
  const terminalSamples = samples.filter((sample) => sample.terminal);
  const activeSamples = samples.filter((sample) => sample.active);
  const localPreProviderSamples = terminalSamples.filter((sample) => sample.localPreProviderFailure);
  const eligibleTerminalSamples = terminalSamples.filter((sample) => !sample.localPreProviderFailure);
  const deliveredSamples = eligibleTerminalSamples.filter((sample) => sample.deliveredCandidate ?? (!sample.deliveryFailure && !sample.noCandidate));
  const terminalTaskCount = terminalSamples.length;
  const activeTaskCount = activeSamples.length;
  const deliveryFailureCount = eligibleTerminalSamples.filter((sample) => sample.deliveryFailure).length;
  const gatePublishableCount = deliveredSamples.filter((sample) => sample.gatePublishable).length;
  const successfulTaskCount = eligibleTerminalSamples.filter((sample) => sample.succeeded).length;
  const noCandidateCount = terminalSamples.filter((sample) => sample.noCandidate).length;
  const studentPublishedCount = terminalSamples.filter((sample) => sample.studentPublished).length;
  const studentSuppressedCount = terminalSamples.filter((sample) => sample.suppressStudentPublication).length;
  const oneObservationJobForTaskCount = eligibleTerminalSamples.filter((sample) => sample.oneObservationJobForTask).length;
  const eligibleTerminalSampleCount = eligibleTerminalSamples.length;
  const deliveredCandidateCount = deliveredSamples.length;
  const deliverySuccessYield = divide(deliveredCandidateCount, eligibleTerminalSampleCount);
  const gatePublishableYield = divide(gatePublishableCount, deliveredCandidateCount);
  const successfulTaskYield = divide(successfulTaskCount, eligibleTerminalSampleCount);
  const studentSuppressionYield = divide(studentSuppressedCount, terminalTaskCount);
  const oneJobPerTaskYield = divide(oneObservationJobForTaskCount, eligibleTerminalSampleCount);
  const reasons = [];

  if (studentPublishedCount !== thresholds.requiredStudentPublishedCount) reasons.push('student_pool_publication_detected');
  if (deliveredCandidateCount < thresholds.minimumTerminalSamples) reasons.push('minimum_delivered_sample_not_met');
  if (deliverySuccessYield != null && deliverySuccessYield < thresholds.minimumDeliverySuccessYield) reasons.push('delivery_success_yield_below_threshold');
  if (gatePublishableYield != null && gatePublishableYield < thresholds.minimumGatePublishableYield) reasons.push('gate_publishable_yield_below_threshold');
  if (oneJobPerTaskYield != null && oneJobPerTaskYield < thresholds.minimumOneJobPerTaskYield) reasons.push('one_observation_job_per_task_yield_below_threshold');
  if (activeTaskCount > 0 && deliveredCandidateCount < thresholds.minimumTerminalSamples) reasons.push('active_observation_samples_waiting');

  const status = studentPublishedCount !== thresholds.requiredStudentPublishedCount
    ? 'failed_student_publication_detected'
    : activeTaskCount > 0 && deliveredCandidateCount < thresholds.minimumTerminalSamples
      ? 'waiting_for_terminal_samples'
      : deliveredCandidateCount < thresholds.minimumTerminalSamples && gatePublishableCount > 0
        ? 'sample_quality_passed_needs_more_scale'
        : deliveredCandidateCount < thresholds.minimumTerminalSamples
          ? 'insufficient_postfix_sample'
          : deliverySuccessYield >= thresholds.minimumDeliverySuccessYield
            && gatePublishableYield >= thresholds.minimumGatePublishableYield
            && oneJobPerTaskYield >= thresholds.minimumOneJobPerTaskYield
              ? 'passed'
              : 'below_acceptable_efficiency';

  return {
    mode: 'math_postfix_efficiency_gate',
    metricPolicyVersion: 'math-postfix-efficiency-v2-four-funnel',
    status,
    productionImpact: 'none_read_only_postfix_observation_efficiency_gate',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_observation_tasks_generation_jobs_questions',
    studentConsumableImpact: 'none_audit_only_reports_if_student_pool_publication_exists',
    thresholds,
    sampleCounts: {
      taskCount: samples.length,
      terminalTaskCount,
      activeTaskCount,
      eligibleTerminalSampleCount,
      deliveredCandidateCount,
      localPreProviderExcludedCount: localPreProviderSamples.length,
      successfulTaskCount,
      noCandidateCount,
      deliveryFailureCount,
      gatePublishableCount,
      studentPublishedCount,
      studentSuppressedCount,
      oneObservationJobForTaskCount
    },
    yields: {
      deliverySuccessYield,
      gatePublishableYield,
      successfulTaskYield,
      studentSuppressionYield,
      oneJobPerTaskYield
    },
    reasons,
    denominatorPolicy: {
      deliveryYield: 'provider_eligible_terminal_samples_excluding_local_pre_provider_failures',
      gateYield: 'delivered_candidates_only',
      minimumSample: 'delivered_candidates',
      localPreProviderExclusions: ['prompt_budget_gate', 'generator_prompt_budget_exceeded', 'connect_eacces_443_local_network_denial']
    },
    efficiencySatisfied: status === 'passed',
    doesNotProve: status === 'passed'
      ? ['future_provider_delivery_success', 'full_three_subject_long_run_stability']
      : ['math_generation_efficiency_at_scale', 'future_provider_delivery_success', 'full_three_subject_long_run_stability']
  };
}

function passingFixture() {
  return [
    { taskId: 'a', terminal: true, active: false, succeeded: true, noCandidate: false, deliveryFailure: false, gatePublishable: true, studentPublished: false, suppressStudentPublication: true, oneObservationJobForTask: true },
    { taskId: 'b', terminal: true, active: false, succeeded: true, noCandidate: false, deliveryFailure: false, gatePublishable: true, studentPublished: false, suppressStudentPublication: true, oneObservationJobForTask: true },
    { taskId: 'c', terminal: true, active: false, succeeded: true, noCandidate: false, deliveryFailure: false, gatePublishable: false, studentPublished: false, suppressStudentPublication: true, oneObservationJobForTask: true }
  ];
}

function runSelfTest() {
  const thresholds = {
    minimumTerminalSamples: 3,
    minimumDeliverySuccessYield: 0.65,
    minimumGatePublishableYield: 0.35,
    minimumOneJobPerTaskYield: 1,
    requiredStudentPublishedCount: 0
  };
  const passing = evaluatePostfixEfficiency(passingFixture(), thresholds);
  const oneGoodSample = evaluatePostfixEfficiency([passingFixture()[0]], thresholds);
  const lowQuality = evaluatePostfixEfficiency([
    { ...passingFixture()[0], gatePublishable: false },
    { ...passingFixture()[1], gatePublishable: false },
    { ...passingFixture()[2], gatePublishable: true }
  ], thresholds);
  const studentPublished = evaluatePostfixEfficiency([
    { ...passingFixture()[0], studentPublished: true, specialPracticeQuestionCount: 1 },
    passingFixture()[1],
    passingFixture()[2]
  ], thresholds);
  const waiting = evaluatePostfixEfficiency([
    { taskId: 'active', terminal: false, active: true, succeeded: false, noCandidate: false, deliveryFailure: false, gatePublishable: false, studentPublished: false, suppressStudentPublication: true, oneObservationJobForTask: false }
  ], thresholds);
  const localPreProviderExcluded = evaluatePostfixEfficiency([
    ...passingFixture(),
    { taskId: 'local-budget', terminal: true, active: false, succeeded: false, noCandidate: true, deliveryFailure: true, localPreProviderFailure: true, gatePublishable: false, studentPublished: false, suppressStudentPublication: true, oneObservationJobForTask: true }
  ], thresholds);

  if (passing.status !== 'passed') throw new Error(`Passing fixture should pass, got ${passing.status}.`);
  if (oneGoodSample.status !== 'sample_quality_passed_needs_more_scale') throw new Error(`One good sample should require scale, got ${oneGoodSample.status}.`);
  if (lowQuality.status !== 'below_acceptable_efficiency') throw new Error(`Low quality fixture should fail efficiency, got ${lowQuality.status}.`);
  if (studentPublished.status !== 'failed_student_publication_detected') throw new Error(`Student publication must fail, got ${studentPublished.status}.`);
  if (waiting.status !== 'waiting_for_terminal_samples') throw new Error(`Active-only fixture should wait, got ${waiting.status}.`);
  if (localPreProviderExcluded.status !== 'passed'
    || localPreProviderExcluded.sampleCounts.localPreProviderExcludedCount !== 1
    || localPreProviderExcluded.yields.deliverySuccessYield !== 1) {
    throw new Error(`Local pre-provider failures must be reported but excluded from provider delivery denominators: ${JSON.stringify(localPreProviderExcluded)}`);
  }

  return {
    mode: 'math_postfix_efficiency_gate_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    cases: [
      { label: 'passing', status: passing.status },
      { label: 'one_good_sample', status: oneGoodSample.status },
      { label: 'low_quality', status: lowQuality.status, reasons: lowQuality.reasons },
      { label: 'student_published', status: studentPublished.status, reasons: studentPublished.reasons },
      { label: 'waiting', status: waiting.status, reasons: waiting.reasons },
      { label: 'local_pre_provider_excluded', status: localPreProviderExcluded.status, sampleCounts: localPreProviderExcluded.sampleCounts }
    ]
  };
}

function sinceFromArgs() {
  const since = cleanText(argValue('since', ''));
  if (since) {
    const parsed = new Date(since);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --since value: ${since}`);
    return parsed;
  }
  const hours = Math.max(1, Math.min(720, asInt(argValue('hours', '48'), 48)));
  return new Date(Date.now() - hours * 3_600_000);
}

async function readSamples(prisma, options) {
  const rows = await prisma.$queryRaw`
    WITH scoped_tasks AS (
      SELECT task.id, task.action, task.subject, task.resource_id AS "resourceId",
             task.filter_snapshot AS "filterSnapshot", task.status, task.result,
             task.completed_at AS "completedAt", task.created_at AS "createdAt", task.updated_at AS "updatedAt"
      FROM csca_ai_questioning_tasks task
      WHERE task.task_type = 'subject_practice_observation'
        AND task.subject = 'math'
        AND task.action = 'math_scheduler_v2'
        AND (${options.hasTaskId}::boolean = false OR task.id = NULLIF(${options.taskId}, '')::uuid)
        AND (${options.hasTaskId}::boolean = true OR task.created_at >= ${options.since})
        AND (${options.hasRunId}::boolean = false
          OR task.resource_id = ${options.runIdText}
          OR task.filter_snapshot->>'productionRunId' = ${options.runIdText}
          OR task.result->>'productionRunId' = ${options.runIdText})
        AND (${options.hasCellId}::boolean = false
          OR task.filter_snapshot->>'productionCellId' = ${options.cellIdText}
          OR task.result->>'productionCellId' = ${options.cellIdText})
    )
    SELECT task.*,
           job.id AS "jobId", job.status AS "jobStatus", job.question_id AS "questionId",
           job.prompt_metadata AS "promptMetadata", job.error AS "jobError", job.provider AS "jobProvider",
           COALESCE(gateway_counts.count, 0)::int AS "gatewayAttemptCount",
           question.status AS "questionStatus", question.source_question_id AS "sourceQuestionId",
           question.generation_metadata AS "generationMetadata", question.review_metadata AS "reviewMetadata",
           COALESCE(job_counts.count, 0)::int AS "observationJobCountForTask",
           COALESCE(student_pool.count, 0)::int AS "specialPracticeQuestionCount"
    FROM scoped_tasks task
    LEFT JOIN LATERAL (
      SELECT candidate.*
      FROM csca_ai_generation_jobs candidate
      WHERE candidate.prompt_metadata->>'observationTaskId' = task.id::text
        OR (
          NULLIF(task.result->>'generationJobId', '') ~ '^[0-9]+$'
          AND candidate.id = (task.result->>'generationJobId')::int
        )
      ORDER BY
        CASE WHEN candidate.prompt_metadata->>'observationTaskId' = task.id::text THEN 0 ELSE 1 END,
        candidate.created_at DESC,
        candidate.id DESC
      LIMIT 1
    ) job ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM csca_ai_generation_jobs counted
      WHERE counted.prompt_metadata->>'observationTaskId' = task.id::text
    ) job_counts ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM ai_gateway_call_logs gateway_log
      WHERE gateway_log.metadata->>'observationTaskId' = task.id::text
    ) gateway_counts ON true
    LEFT JOIN csca_questions question ON question.id = job.question_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM special_practice_questions special
      WHERE special.id = question.source_question_id
    ) student_pool ON true
    ORDER BY task."createdAt" DESC, task.id DESC
    LIMIT ${options.limit}
  `;
  return rows.map(sampleFromRow);
}

async function main() {
  const json = hasFlag('json');
  if (hasFlag('self-test')) {
    const report = runSelfTest();
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Math post-fix efficiency gate self-test passed.');
    return;
  }

  const taskId = cleanText(argValue('task', ''));
  const runId = asInt(argValue('run', ''), null);
  const cellId = asInt(argValue('cell', ''), null);
  const since = sinceFromArgs();
  const limit = Math.max(1, Math.min(200, asInt(argValue('limit', '50'), 50)));
  const thresholds = thresholdsFromArgs();
  const options = {
    taskId,
    hasTaskId: Boolean(taskId),
    runIdText: runId == null ? '' : String(runId),
    hasRunId: runId != null,
    cellIdText: cellId == null ? '' : String(cellId),
    hasCellId: cellId != null,
    since,
    limit
  };
  const prisma = new PrismaClient();
  try {
    const samples = await readSamples(prisma, options);
    const evaluated = evaluatePostfixEfficiency(samples, thresholds);
    const report = {
      ...evaluated,
      scope: {
        subject: 'math',
        action: 'math_scheduler_v2',
        taskId: taskId || null,
        productionRunId: runId,
        productionCellId: cellId,
        since: iso(since),
        limit
      },
      evidenceLimit: 'postfix_observation_tasks_only_not_historical_production_run_funnel',
      evidence: samples.map((sample) => ({
        taskId: sample.taskId,
        status: sample.status,
        productionRunId: sample.productionRunId,
        productionCellId: sample.productionCellId,
        completedAt: sample.completedAt,
        jobId: sample.jobId,
        jobStatus: sample.jobStatus,
        questionId: sample.questionId,
        questionStatus: sample.questionStatus,
        gateDecision: sample.gateDecision,
        deliveryFailure: sample.deliveryFailure,
        localPreProviderFailure: sample.localPreProviderFailure,
        gatewayAttemptCount: sample.gatewayAttemptCount,
        observationJobCountForTask: sample.observationJobCountForTask,
        studentPublished: sample.studentPublished,
        suppressStudentPublication: sample.suppressStudentPublication
      }))
    };

    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Math post-fix efficiency gate: ${report.status}`);
      console.log(`- terminal=${report.sampleCounts.terminalTaskCount}/${report.sampleCounts.taskCount}, publishable=${report.sampleCounts.gatePublishableCount}, deliveryFailures=${report.sampleCounts.deliveryFailureCount}`);
      console.log(`- yields delivery=${report.yields.deliverySuccessYield ?? 'n/a'} gate=${report.yields.gatePublishableYield ?? 'n/a'} oneJob=${report.yields.oneJobPerTaskYield ?? 'n/a'}`);
      if (report.reasons.length) console.log(`- reasons=${report.reasons.join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    mode: 'math_postfix_efficiency_gate',
    message: error instanceof Error ? error.message : String(error),
    providerImpact: 'none_no_provider_call',
    studentConsumableImpact: 'none_audit_only_reports_if_student_pool_publication_exists'
  }, null, 2));
  process.exitCode = 1;
});
