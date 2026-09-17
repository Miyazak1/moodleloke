#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { buildReport } = require('./csca-subject-practice-local-shadow-batch-preflight.cjs');
const { validationProtocolForTarget } = require('./lib/subject-practice-validation-protocol.cjs');
const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');

const ACTIONS = {
  math: 'math_scheduler_v2',
  physics: 'physics_scheduler_v2',
  chemistry: 'chemistry_scheduler_v2'
};
const COST_POLICY = 'guarded-observation-zero-provider-cost-reservation-v1';
const WAIT_POLLING_POLICY = Object.freeze({
  initialDelayMs: 250,
  delayMultiplier: 1.7,
  maximumDelayMs: 1500
});

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function digestFor(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}

function requestedSubjects() {
  const subjects = clean(argValue('subjects', 'math,physics,chemistry'))
    .toLowerCase().split(/[,;\s]+/).filter(Boolean);
  if (!subjects.length || subjects.some((subject) => !ACTIONS[subject])) {
    throw new Error('--subjects must contain math, physics, and/or chemistry.');
  }
  return [...new Set(subjects)];
}

async function requestJson(baseUrl, pathname, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${pathname} returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function resolveAdminToken(baseUrl) {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) return configured;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Apply requires CSCA_OBSERVATION_ADMIN_TOKEN or ADMIN_BOOTSTRAP_EMAIL/PASSWORD.');
  const login = await requestJson(baseUrl, '/api/v1/auth/login', '', {
    method: 'POST', body: { email, password }
  });
  const token = login.tokens?.accessToken;
  if (!token) throw new Error('Admin login did not return an access token.');
  return token;
}

async function waitForTask(baseUrl, taskId, token, timeoutMs, testRuntime = null) {
  const now = testRuntime?.now ?? Date.now;
  const sleep = testRuntime?.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const request = testRuntime?.requestJson ?? requestJson;
  const startedAt = now();
  let delayMs = WAIT_POLLING_POLICY.initialDelayMs;
  while (now() - startedAt < timeoutMs) {
    const response = await request(
      baseUrl,
      `/api/v1/admin/ai-questioning/subject-practice-observation-tasks/${taskId}`,
      token
    );
    if (['succeeded', 'failed', 'cancelled'].includes(response.task?.status)) return response;
    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) break;
    await sleep(Math.min(delayMs, remainingMs));
    delayMs = Math.min(
      WAIT_POLLING_POLICY.maximumDelayMs,
      Math.ceil(delayMs * WAIT_POLLING_POLICY.delayMultiplier)
    );
  }
  throw new Error(`Timed out waiting for local shadow observation task ${taskId}.`);
}

function selectTargets(preflight, subjects, countPerSubject) {
  return subjects.map((subject) => {
    const family = preflight.families.find((item) => item.subject === subject && item.status === 'batch_plan_ready');
    if (!family) return { subject, status: 'compatible_open_cell_missing' };
    return {
      subject,
      status: 'selected',
      productionRunId: Number(family.runId),
      productionCellId: Number(family.cellId),
      taskFamily: family.taskFamily,
      planTemplate: family.planTemplate,
      count: countPerSubject,
      plannedScopes: family.items.slice(0, countPerSubject).map((item) => item.scopeId)
    };
  });
}

function assertRuntime(readiness, targets) {
  const failures = [];
  if (readiness?.readyForLocalZeroProviderSubmission !== true) failures.push('local_zero_provider_submission_not_ready');
  if (readiness?.readyForLocalZeroProviderExecution !== true) failures.push('local_zero_provider_execution_not_ready');
  if (readiness?.observationOnlyMode !== true) failures.push('observation_only_mode_required');
  if (readiness?.localGeneratorShadowEnabled !== true) failures.push('local_generator_shadow_required');
  if (readiness?.questionPlanEnabled !== true) failures.push('question_plan_required');
  const allowlist = clean(readiness?.questionPlanCellAllowlist).split(/[,;\s]+/).filter(Boolean);
  if (!allowlist.includes('*') && targets.some((target) => !allowlist.includes(String(target.productionCellId)))) {
    failures.push('exact_cell_allowlist_incomplete');
  }
  if (failures.length) {
    throw new Error(`Local zero-Provider backend is not ready: ${failures.join(',')}; reasons=${JSON.stringify(readiness?.localZeroProviderReasons || [])}.`);
  }
}

function summarizeResults(results) {
  const summaryFor = (items) => {
    const succeeded = items.filter((item) => item.status === 'succeeded').length;
    const candidateCount = items.filter((item) => Number(item.result?.generatedQuestionId) > 0).length;
    const publishableCount = items.filter((item) => item.result?.gateDecision === 'publishable').length;
    const leakageClearCount = items.filter((item) => item.result?.automatedCandidateLeakageGate?.status === 'clear'
      && Number(item.result?.automatedCandidateLeakageGate?.scannedRevisionCount) > 0).length;
    const leakageBlockedCount = items.filter((item) => ['blocked', 'ambiguous', 'missing_corpus']
      .includes(item.result?.automatedCandidateLeakageGate?.status)).length;
    return {
      requested: items.length,
      succeeded,
      candidateCount,
      publishableCount,
      leakageClearCount,
      leakageBlockedCount,
      leakageClearRate: items.length ? leakageClearCount / items.length : null,
      candidateYieldRate: items.length ? candidateCount / items.length : null,
      publishableRate: items.length ? publishableCount / items.length : null,
      providerCallCount: 0,
      estimatedCostUsd: 0,
      studentPublicationCount: 0
    };
  };
  return {
    overall: summaryFor(results),
    bySubject: Object.fromEntries(Object.keys(ACTIONS).map((subject) => [
      subject,
      summaryFor(results.filter((item) => item.subject === subject))
    ]))
  };
}

async function main() {
  const apply = hasFlag('apply');
  const subjects = requestedSubjects();
  const countPerSubject = Number(argValue('count-per-subject', '1'));
  if (!Number.isInteger(countPerSubject) || countPerSubject < 1 || countPerSubject > 8) {
    throw new Error('--count-per-subject must be an integer from 1 to 8.');
  }
  const baseUrl = clean(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');
  const timeoutMs = Math.max(60_000, Math.min(15 * 60_000, Number(argValue('timeout-ms', '300000')) || 300_000));
  const prisma = new PrismaClient();
  let preflight;
  try {
    preflight = await buildReport(prisma, countPerSubject);
  } finally {
    await prisma.$disconnect();
  }
  const targets = selectTargets(preflight, subjects, countPerSubject);
  const selectedTargets = targets.filter((target) => target.status === 'selected');
  const missingSubjects = targets.filter((target) => target.status !== 'selected').map((target) => target.subject);
  const authorizationPlan = {
    protocol: 'subject-practice-local-shadow-three-subject-run-v2',
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    manifestPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION,
    targets: selectedTargets.map(({ subject, productionRunId, productionCellId, taskFamily, planTemplate, count, plannedScopes }) => ({
      subject, productionRunId, productionCellId, taskFamily, planTemplate, count, plannedScopes
    }))
  };
  const planDigest = digestFor(authorizationPlan);
  const sealedManifestTasks = selectedTargets.flatMap((target) => target.plannedScopes.map((plannedScopeId, index) => ({
    subject: target.subject,
    productionRunId: target.productionRunId,
    productionCellId: target.productionCellId,
    taskFamily: target.taskFamily,
    planTemplate: target.planTemplate,
    plannedScopeId,
    localOrdinal: index + 1
  }))).map((task, index) => ({ ...task, ordinal: index + 1 }));
  const sealedBatchManifest = sealedManifestTasks.length
    ? buildSubjectPracticeObservationBatchManifest(sealedManifestTasks)
    : null;
  const firstSealedEnvelope = sealedBatchManifest
    ? subjectPracticeObservationBatchEnvelopeFor({ manifest: sealedBatchManifest, taskOrdinal: 1 })
    : null;
  const report = {
    mode: apply ? 'local_shadow_three_subject_apply' : 'local_shadow_three_subject_preview',
    reportVersion: 'subject-practice-local-shadow-three-subject-run-v2',
    status: missingSubjects.length
      ? 'scope_incomplete'
      : Number(preflight.activeObservationTaskCount || 0) > 0
        ? 'waiting_for_existing_observation_task'
        : apply ? 'applying' : 'ready_for_exact_authorization',
    standaloneProviderExecution: false,
    providerImpact: 'none_provider_attempt_limit_zero',
    maximumEstimatedCostUsd: 0,
    databaseImpact: apply ? 'bounded_observation_tasks_and_candidate_writes' : 'read_only_preflight',
    studentPublicationImpact: 'none_suppressed',
    baseUrl,
    authorizationPlan,
    planDigest,
    sealedObservationBatch: firstSealedEnvelope ? {
      policyVersion: sealedBatchManifest.policyVersion,
      batchId: firstSealedEnvelope.batchId,
      manifestSha256: firstSealedEnvelope.manifestSha256,
      expectedTaskCount: firstSealedEnvelope.expectedTaskCount,
      manifest: sealedBatchManifest
    } : null,
    missingSubjects,
    activeObservationTaskCount: Number(preflight.activeObservationTaskCount || 0),
    activeObservationTasks: preflight.activeObservationTasks || [],
    targets,
    requiredConfirmations: [
      '--apply',
      '--confirm-zero-provider-shadow-batch',
      `--confirm-plan-digest=${planDigest}`
    ],
    results: []
  };
  if (hasFlag('check-runtime')) {
    try {
      const token = await resolveAdminToken(baseUrl);
      const runtime = await requestJson(
        baseUrl,
        '/api/v1/admin/ai-questioning/subject-practice-observation-tasks?limit=1',
        token
      );
      assertRuntime(runtime.readiness, selectedTargets);
      report.runtimeCheck = { status: 'passed', readiness: runtime.readiness };
    } catch (error) {
      report.runtimeCheck = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
      report.status = 'runtime_not_ready';
      if (apply) throw error;
    }
  }
  if (!apply) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (missingSubjects.length) throw new Error(`Apply refused because no compatible open cell exists for: ${missingSubjects.join(',')}.`);
  if (Number(preflight.activeObservationTaskCount || 0) > 0) {
    throw new Error('Apply refused because an existing queued/running observation task must reach a terminal state first.');
  }
  if (!hasFlag('confirm-zero-provider-shadow-batch')) {
    throw new Error('Apply requires --confirm-zero-provider-shadow-batch.');
  }
  if (clean(argValue('confirm-plan-digest')) !== planDigest) {
    throw new Error(`Apply requires --confirm-plan-digest=${planDigest}.`);
  }
  const token = await resolveAdminToken(baseUrl);
  const runtime = await requestJson(
    baseUrl,
    '/api/v1/admin/ai-questioning/subject-practice-observation-tasks?limit=1',
    token
  );
  assertRuntime(runtime.readiness, selectedTargets);
  let batchTaskOrdinal = 0;
  for (const target of selectedTargets) {
    for (let ordinal = 1; ordinal <= countPerSubject; ordinal += 1) {
      batchTaskOrdinal += 1;
      const sealedObservationBatch = subjectPracticeObservationBatchEnvelopeFor({
        manifest: sealedBatchManifest,
        taskOrdinal: batchTaskOrdinal
      });
      const validationProtocolVersion = validationProtocolForTarget({
        subject: target.subject,
        productionRunId: target.productionRunId,
        productionCellId: target.productionCellId,
        taskFamily: target.taskFamily
      });
      const submitted = await requestJson(
        baseUrl,
        '/api/v1/admin/ai-questioning/subject-practice-observation-tasks',
        token,
        {
          method: 'POST',
          body: {
            action: ACTIONS[target.subject],
            subject: target.subject,
            productionRunId: target.productionRunId,
            productionCellId: target.productionCellId,
            taskFamily: target.taskFamily,
            ...(validationProtocolVersion ? { validationProtocolVersion } : {}),
            validationBatchId: `${planDigest}-${target.subject}-${ordinal}`,
            sealedObservationBatch,
            maxEstimatedCostUsd: 0,
            maximumReservedCostUsd: 0,
            costReservationPolicyVersion: COST_POLICY,
            suppressStudentPublication: true
          }
        }
      );
      const taskId = submitted.task?.id;
      if (!taskId) throw new Error(`Observation submission did not return a task id for ${target.subject} #${ordinal}.`);
      const terminal = await waitForTask(baseUrl, taskId, token, timeoutMs);
      report.results.push({
        subject: target.subject,
        ordinal,
        taskId,
        status: terminal.task?.status ?? 'unknown',
        result: terminal.task?.result ?? null,
        error: terminal.task?.error ?? null
      });
      if (terminal.task?.status !== 'succeeded') {
        report.status = 'stopped_on_first_non_success';
        report.scorecard = summarizeResults(report.results);
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        process.exitCode = 1;
        return;
      }
    }
  }
  report.status = 'completed';
  report.scorecard = summarizeResults(report.results);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertRuntime,
  digestFor,
  requestJson,
  resolveAdminToken,
  selectTargets,
  summarizeResults,
  WAIT_POLLING_POLICY,
  waitForTask
};
