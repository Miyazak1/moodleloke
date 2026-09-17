const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const {
  SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
  SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanEnabled,
  subjectPracticeQuestionPlanGateFor,
  subjectPracticeQuestionPlanAttemptFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

function argValueFrom(args, name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function argValue(name, fallback = '') {
  return argValueFrom(process.argv, name, fallback);
}

function hasFlagFrom(args, name) {
  return args.includes(`--${name}`);
}

function hasFlag(name) {
  return hasFlagFrom(process.argv, name);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanPositiveInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envPositiveMs(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function subjectPracticeProductionActiveJobLimit() {
  return cleanPositiveInt(
    process.env.CSCA_SUBJECT_PRACTICE_ACTIVE_JOB_LIMIT ?? process.env.AI_GATEWAY_BACKGROUND_CONCURRENCY,
    1,
    1,
    12
  );
}

function subjectPracticeStaleRunningMs() {
  return Math.max(
    3 * 60 * 1000,
    Math.min(
      10 * 60 * 1000,
      envPositiveMs('CSCA_AI_QUESTION_GENERATION_TIMEOUT_MS', 90_000) * 3
        + envPositiveMs('CSCA_AI_QUESTION_REVIEW_TIMEOUT_MS', 30_000) * 3
        + envPositiveMs('AI_GATEWAY_BACKGROUND_KEY_WAIT_TIMEOUT_MS', 120_000)
    )
  );
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function maybeSetQuestionPlanEnvFromArgs() {
  if (hasFlag('enable-question-plan')) {
    process.env[SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG] = 'true';
  }
  const allowlist = cleanText(argValue('question-plan-cell-allowlist', argValue('cell-allowlist', '')));
  if (allowlist) process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG] = allowlist;
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return;
  process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

function buildCurrentPolicyProjection(row) {
  const metadata = recordFrom(row.promptMetadata);
  const storedPlan = recordFrom(metadata.questionPlan);
  const storedGate = recordFrom(metadata.questionPlanGate);
  const storedAttempt = recordFrom(metadata.questionPlanAttempt);
  const targetProfile = recordFrom(metadata.targetProfile);
  const productionCellId = asNumber(metadata.productionCellId || row.productionCellId);
  const targetDifficulty = cleanText(targetProfile.difficultyBand || row.blueprintDifficulty);
  const rebuiltPlanCandidate = Object.keys(storedPlan).length
    ? storedPlan
    : subjectPracticeQuestionPlanEnabled()
      ? buildSubjectPracticeQuestionPlan({
        subject: row.subject,
        topicId: row.topicId,
        topicTitle: row.topicTitle,
        productionCellId,
        targetDifficulty
      })
      : null;
  const currentGate = subjectPracticeQuestionPlanGateFor({
    subject: row.subject,
    topicTitle: row.topicTitle,
    productionCellId,
    targetDifficulty,
    questionPlan: rebuiltPlanCandidate
  });
  const effectiveQuestionPlan = currentGate.validation?.valid === true ? rebuiltPlanCandidate : null;
  const currentAttempt = subjectPracticeQuestionPlanAttemptFor({
    attemptId: cleanText(storedAttempt.attemptId),
    attemptIndex: Number(storedAttempt.attemptIndex) || 1,
    phase: 'live_job_preflight',
    gate: currentGate,
    questionPlan: effectiveQuestionPlan
  });
  return {
    jobId: Number(row.id),
    status: cleanText(row.status),
    subject: cleanText(row.subject),
    topicId: Number(row.topicId),
    topicTitle: cleanText(row.topicTitle),
    productionRunId: asNumber(metadata.productionRunId),
    productionCellId,
    targetDifficulty,
    stored: {
      hasQuestionPlan: Object.keys(storedPlan).length > 0,
      gateMode: cleanText(storedGate.mode) || null
    },
    current: {
      featureFlag: SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
      featureFlagEnabled: subjectPracticeQuestionPlanEnabled(),
      cellAllowlistFlag: SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
      cellAllowlist: cleanText(process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]) || null,
      gateMode: currentGate.mode,
      gateEnabled: currentGate.enabled,
      gateApplicable: currentGate.applicable,
      gateCellAllowed: currentGate.cellAllowed,
      generationAllowed: currentGate.generationAllowed,
      reasonCodes: currentGate.reasonCodes,
      taskFamily: currentGate.taskFamily,
      planTemplate: currentGate.planTemplate,
      hasEffectiveQuestionPlan: Boolean(effectiveQuestionPlan),
      attemptStatus: currentAttempt.status,
      providerBoundary: currentGate.generationAllowed
        ? 'would_continue_to_provider_when_runner_claims'
        : 'would_fail_before_provider_without_provider_call',
      promptContractImpact: effectiveQuestionPlan
        ? 'question_plan_contract_would_be_sent'
        : 'none'
    }
  };
}

async function loadJobProjection(jobId) {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT job.id,
             job.status,
             job.prompt_metadata AS "promptMetadata",
             bp.subject,
             bp.topic_id AS "topicId",
             bp.difficulty AS "blueprintDifficulty",
             topic.title AS "topicTitle"
      FROM csca_ai_generation_jobs job
      JOIN csca_question_blueprints bp ON bp.id = job.blueprint_id
      JOIN csca_exam_topics topic ON topic.id = bp.topic_id
      WHERE job.id = $1
      LIMIT 1
    `, jobId);
    if (!rows.length) throw new Error(`Generation job #${jobId} was not found.`);
    return buildCurrentPolicyProjection(rows[0]);
  } finally {
    await prisma.$disconnect();
  }
}

function summarizeJobEvidence({ job, question }) {
  const metadata = recordFrom(asJson(job?.promptMetadata));
  const reviewMetadata = recordFrom(asJson(question?.reviewMetadata));
  const gate = recordFrom(reviewMetadata.gate);
  const autoApproval = recordFrom(reviewMetadata.subjectPracticeAutoApproval);
  const failureCategory = cleanText(metadata.failureCategory) || null;
  const gateDecision = cleanText(gate.decision) || null;
  const gateReasons = Array.isArray(gate.reasons) ? gate.reasons.map(cleanText).filter(Boolean) : [];
  const questionId = Number(job?.questionId) || Number(question?.id) || null;
  let conclusion = 'pending_or_not_started';
  if (cleanText(job?.status) === 'failed' && !questionId) conclusion = 'delivery_or_generation_failure';
  else if (questionId && gateDecision === 'publishable') conclusion = 'publishable_by_automatic_gate';
  else if (questionId && gateDecision) conclusion = `gate_terminal_${gateDecision}`;
  else if (questionId) conclusion = 'candidate_created_gate_not_recorded';
  return {
    conclusion,
    job: job
      ? {
        id: Number(job.id),
        status: cleanText(job.status),
        questionId,
        provider: cleanText(job.provider) || null,
        model: cleanText(job.model) || null,
        failureCategory,
        errorPreview: cleanText(job.error).slice(0, 240) || null,
        updatedAt: job.updatedAt
      }
      : null,
    question: question
      ? {
        id: Number(question.id),
        status: cleanText(question.status),
        designedDifficulty: cleanText(question.designedDifficulty) || null,
        gateDecision,
        gateReasons,
        autoApprovalStatus: cleanText(autoApproval.status) || null,
        autoApprovalTargetUseCase: cleanText(autoApproval.targetUseCase) || null,
        promptPreview: cleanText(question.prompt).slice(0, 240) || null,
        correctAnswer: cleanText(question.correctAnswer) || null,
        explanationPreview: cleanText(question.explanation).slice(0, 240) || null,
        updatedAt: question.updatedAt
      }
      : null,
    questionPlanRuntime: {
      gateMode: cleanText(recordFrom(metadata.questionPlanGate).mode) || null,
      attemptStatus: cleanText(recordFrom(metadata.questionPlanAttempt).status) || null,
      planTemplate: cleanText(recordFrom(metadata.questionPlan).planTemplate) || cleanText(recordFrom(metadata.questionPlanGate).planTemplate) || null
    }
  };
}

async function loadJobEvidence(jobId) {
  const prisma = new PrismaClient();
  try {
    const jobs = await prisma.$queryRawUnsafe(`
      SELECT id, status, question_id AS "questionId", provider, model,
             prompt_metadata AS "promptMetadata", error, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM csca_ai_generation_jobs
      WHERE id = $1
      LIMIT 1
    `, jobId);
    const job = jobs[0] ?? null;
    const questionId = Number(job?.questionId) || 0;
    const questions = questionId
      ? await prisma.$queryRawUnsafe(`
          SELECT id, status, designed_difficulty AS "designedDifficulty",
                 review_metadata AS "reviewMetadata",
                 LEFT(prompt, 240) AS prompt, correct_answer AS "correctAnswer",
                 LEFT(explanation, 240) AS explanation,
                 created_at AS "createdAt", updated_at AS "updatedAt"
          FROM csca_questions
          WHERE id = $1
          LIMIT 1
        `, questionId)
      : [];
    return {
      mode: 'read_only_single_job_evidence',
      productionImpact: 'none_read_only_evidence',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      ...summarizeJobEvidence({ job, question: questions[0] ?? null })
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function loadRunAdmission(runId) {
  const prisma = new PrismaClient();
  try {
    const staleRunningBefore = new Date(Date.now() - subjectPracticeStaleRunningMs());
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, status, prompt_metadata AS "promptMetadata", updated_at AS "updatedAt"
      FROM csca_ai_generation_jobs
      WHERE prompt_metadata->>'productionRunId' = $1
        AND status = 'running'
        AND COALESCE(NULLIF(prompt_metadata->>'processingStartedAt', '')::timestamp, created_at) >= $2
      ORDER BY updated_at DESC, id DESC
    `, String(runId), staleRunningBefore);
    const activeLimit = subjectPracticeProductionActiveJobLimit();
    return {
      mode: 'read_only_run_admission',
      productionImpact: 'none_read_only_admission',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      activeLimit,
      freshRunningCount: rows.length,
      staleRunningMs: subjectPracticeStaleRunningMs(),
      capacityAvailable: rows.length < activeLimit,
      freshRunningJobIds: rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0)
    };
  } finally {
    await prisma.$disconnect();
  }
}

const baseUrl = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');

async function requestJson(pathname, token, options = {}) {
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

async function resolveAdminToken() {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) return configured;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Admin token or ADMIN_BOOTSTRAP_EMAIL/PASSWORD is required.');
  const login = await requestJson('/api/v1/auth/login', '', { method: 'POST', body: { email, password } });
  const token = login.tokens?.accessToken;
  if (!token) throw new Error('Admin login did not return an access token.');
  return token;
}

function exactPreflight({ projection, subject, runId, cellId, admission }) {
  const failures = [];
  if (projection.subject !== subject) failures.push(`subject_mismatch:${projection.subject}`);
  if (projection.productionRunId !== runId) failures.push(`run_mismatch:${projection.productionRunId}`);
  if (projection.productionCellId !== cellId) failures.push(`cell_mismatch:${projection.productionCellId}`);
  if (projection.status !== 'queued') failures.push(`job_not_queued:${projection.status}`);
  if (!projection.current.hasEffectiveQuestionPlan) failures.push('effective_question_plan_missing');
  if (projection.current.providerBoundary !== 'would_continue_to_provider_when_runner_claims') failures.push(projection.current.providerBoundary);
  if (admission && admission.capacityAvailable !== true) {
    failures.push(`run_inflight_capacity_full:${admission.freshRunningCount}/${admission.activeLimit}`);
  }
  return {
    status: failures.length ? 'not_ready' : 'ready_for_explicit_live_authorization',
    failures,
    liveRisks: [
      'sends_selected_generation_payload_to_configured_provider',
      'writes_generation_job_and_gateway_interaction_state',
      'may_insert_candidate_question',
      'ordinary_generation_job_may_publish_if_automatic_gate_accepts'
    ],
    stopAfter: [
      'one_selected_job_reaches_terminal_or_provider_delivery_failure',
      'new_candidate_gate_decision_is_recorded',
      'queued_revalidation_and_scorecard_are_rerun'
    ]
  };
}

function directApplyAuthorizationFailures(jobId, args = process.argv) {
  const failures = [];
  if (!hasFlagFrom(args, 'confirm-exact-question-plan-live-job')) {
    failures.push('Apply requires --confirm-exact-question-plan-live-job.');
  }
  if (!hasFlagFrom(args, 'accept-provider-payload-and-db-writes')) {
    failures.push('Apply requires --accept-provider-payload-and-db-writes.');
  }
  if (!hasFlagFrom(args, 'allow-student-publication')) {
    failures.push('Direct live-job apply may auto-publish subject-practice candidates; use math-one-shot-harness for --confirm-no-student-publication, or pass --allow-student-publication explicitly.');
  }
  if (Number(argValueFrom(args, 'confirm-job', '')) !== jobId) {
    failures.push(`Apply requires --confirm-job=${jobId}.`);
  }
  return failures;
}

function shellArg(value) {
  const text = cleanText(value);
  if (!text) return '""';
  return /^[A-Za-z0-9_.:,=/#-]+$/.test(text) ? text : `"${text.replace(/"/g, '\\"')}"`;
}

function buildOperatorCommands({ subject, runId, cellId, jobId }) {
  const allowlist = cleanText(process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]);
  const commonArgs = [
    '--subject', subject,
    '--run', String(runId),
    '--cell', String(cellId),
    '--job', String(jobId),
    '--enable-question-plan',
    ...(allowlist ? ['--question-plan-cell-allowlist', allowlist] : [])
  ];
  const common = commonArgs.map(shellArg).join(' ');
  return {
    startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan${allowlist ? ` --question-plan-cell-allowlist=${shellArg(allowlist)}` : ''}`,
    preview: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --json`,
    applyExactSingleJobWithStudentPublicationRisk: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --apply --confirm-exact-question-plan-live-job --accept-provider-payload-and-db-writes --allow-student-publication --confirm-job=${jobId} --json`,
    noStudentPublicationObservationHarness: `npm.cmd run csca-ai-questioning:math-one-shot-harness -- --run=${runId} --cell=${cellId} --apply --confirm-one-math-observation-harness --confirm-runtime-clean --confirm-provider-recovery --confirm-no-student-publication --confirm-run=${runId} --confirm-cell=${cellId} --json`,
    verifySingleJobEvidence: `npm.cmd run csca-ai-questioning:question-plan-live-job -- ${common} --json`,
    verifyQueuedRevalidation: `npm.cmd run csca-ai-questioning:question-plan-queued-revalidation -- --subject=${shellArg(subject)} --run=${runId} --enable-question-plan${allowlist ? ` --question-plan-cell-allowlist=${shellArg(allowlist)}` : ''} --json`
  };
}

function summarizeApplyOutcome(result, jobId) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  const item = items.find((entry) => Number(entry?.id) === Number(jobId)) ?? items[0] ?? null;
  const error = errors.find((entry) => Number(entry?.id) === Number(jobId)) ?? errors[0] ?? null;
  const requested = Number(result?.requested) || 0;
  const succeeded = Number(result?.succeeded) || 0;
  const failed = Number(result?.failed) || 0;
  const skippedByActiveJobLimit = Number(result?.skippedByActiveJobLimit) || 0;
  let status = 'not_processed';
  if (item) status = item.questionId ? 'processed_candidate_created' : 'processed_without_candidate';
  else if (error) status = 'process_error';
  else if (skippedByActiveJobLimit > 0) status = 'skipped_by_active_job_limit';
  else if (requested === 0) status = 'job_not_selected_by_server_query';
  return {
    status,
    requested,
    succeeded,
    failed,
    skippedByActiveJobLimit,
    processedJobId: item ? Number(item.id) || null : null,
    questionId: item ? Number(item.questionId) || null : null,
    error: error ? cleanText(error.message || error.error).slice(0, 240) || null : null,
    requiresFollowupEvidence: ['processed_candidate_created', 'processed_without_candidate', 'process_error'].includes(status),
    providerMayHaveBeenCalled: ['processed_candidate_created', 'processed_without_candidate', 'process_error'].includes(status),
    providerDefinitelyNotCalledByApply: ['skipped_by_active_job_limit', 'job_not_selected_by_server_query', 'not_processed'].includes(status)
  };
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const created = summarizeApplyOutcome({
    requested: 1,
    succeeded: 1,
    failed: 0,
    skippedByActiveJobLimit: 0,
    items: [{ id: 21297, questionId: 16399 }]
  }, 21297);
  assertSelfTest(created.status === 'processed_candidate_created', 'candidate-created apply outcome must be detected.');
  assertSelfTest(created.providerMayHaveBeenCalled === true, 'candidate-created outcome may have called provider.');
  assertSelfTest(created.providerDefinitelyNotCalledByApply === false, 'candidate-created outcome must not be marked no-provider.');

  const noCandidate = summarizeApplyOutcome({
    requested: 1,
    succeeded: 1,
    failed: 0,
    items: [{ id: 21297 }]
  }, 21297);
  assertSelfTest(noCandidate.status === 'processed_without_candidate', 'processed-without-candidate outcome must be detected.');
  assertSelfTest(noCandidate.requiresFollowupEvidence === true, 'processed-without-candidate outcome needs follow-up evidence.');

  const processError = summarizeApplyOutcome({
    requested: 1,
    succeeded: 0,
    failed: 1,
    errors: [{ id: 21297, message: 'provider_empty_output' }]
  }, 21297);
  assertSelfTest(processError.status === 'process_error', 'process error outcome must be detected.');
  assertSelfTest(processError.error === 'provider_empty_output', 'process error outcome must preserve error preview.');

  const capacitySkipped = summarizeApplyOutcome({
    requested: 1,
    succeeded: 0,
    failed: 0,
    skippedByActiveJobLimit: 1,
    items: [],
    errors: []
  }, 21297);
  assertSelfTest(capacitySkipped.status === 'skipped_by_active_job_limit', 'capacity skipped outcome must be detected.');
  assertSelfTest(capacitySkipped.providerDefinitelyNotCalledByApply === true, 'capacity skipped outcome must be marked no-provider.');

  const notSelected = summarizeApplyOutcome({
    requested: 0,
    succeeded: 0,
    failed: 0,
    skippedByActiveJobLimit: 0
  }, 21297);
  assertSelfTest(notSelected.status === 'job_not_selected_by_server_query', 'server-query miss outcome must be detected.');
  assertSelfTest(notSelected.providerDefinitelyNotCalledByApply === true, 'server-query miss must be marked no-provider.');

  const missingStudentPublicationAuthorization = directApplyAuthorizationFailures(21297, [
    'node',
    'script',
    '--apply',
    '--confirm-exact-question-plan-live-job',
    '--accept-provider-payload-and-db-writes',
    '--confirm-job=21297'
  ]);
  assertSelfTest(
    missingStudentPublicationAuthorization.some((failure) => failure.includes('may auto-publish subject-practice candidates')),
    'Direct live-job apply must refuse when student publication risk has not been explicitly authorized.'
  );
  const authorizedStudentPublicationRisk = directApplyAuthorizationFailures(21297, [
    'node',
    'script',
    '--apply',
    '--confirm-exact-question-plan-live-job',
    '--accept-provider-payload-and-db-writes',
    '--allow-student-publication',
    '--confirm-job=21297'
  ]);
  assertSelfTest(authorizedStudentPublicationRisk.length === 0, 'Direct live-job apply confirmations should pass only when student publication risk is explicit.');

  return {
    mode: 'question_plan_single_live_job_self_test',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    status: 'passed',
    checkedOutcomes: [
      created.status,
      noCandidate.status,
      processError.status,
      capacitySkipped.status,
      notSelected.status,
      'student_publication_risk_guard'
    ]
  };
}

async function main() {
  if (hasFlag('self-test')) {
    const report = runSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
    else console.log(`QuestionPlan live-job self-test ${report.status}: ${report.checkedOutcomes.join(', ')}`);
    return;
  }
  loadDatabaseUrl();
  maybeSetQuestionPlanEnvFromArgs();
  const apply = hasFlag('apply');
  const json = hasFlag('json');
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const jobId = Number(argValue('job', ''));
  const runId = Number(argValue('run', ''));
  const cellId = Number(argValue('cell', ''));
  if (!Number.isInteger(jobId) || jobId <= 0) throw new Error('--job=<id> is required.');
  if (!Number.isInteger(runId) || runId <= 0) throw new Error('--run=<id> is required.');
  if (!Number.isInteger(cellId) || cellId <= 0) throw new Error('--cell=<id> is required.');

  const projection = await loadJobProjection(jobId);
  const admission = await loadRunAdmission(runId);
  const preflight = exactPreflight({ projection, subject, runId, cellId, admission });
  const evidence = await loadJobEvidence(jobId);
  let report = {
    mode: apply ? 'question_plan_single_live_job_apply' : 'question_plan_single_live_job_preview',
    standaloneProviderExecution: false,
    productionImpact: apply ? 'bounded_single_job_live_execution_if_confirmed' : 'none_preview_only',
    providerImpact: apply ? 'one_selected_provider_generation_call_if_confirmed' : 'none_preview_only',
    dbImpact: apply ? 'writes_selected_generation_job_gateway_and_candidate_state_if_confirmed' : 'read_only_preview',
    baseUrl,
    requested: { subject, productionRunId: runId, productionCellId: cellId, jobId },
    currentPolicy: {
      featureFlag: SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
      featureFlagEnabled: subjectPracticeQuestionPlanEnabled(),
      cellAllowlistFlag: SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
      cellAllowlist: cleanText(process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]) || null
    },
    projection,
    admission,
    preflight,
    evidence,
    operatorCommands: buildOperatorCommands({ subject, runId, cellId, jobId }),
    processEndpoint: 'POST /api/v1/admin/ai-questioning/generation-jobs/process',
    processBody: { jobIds: [jobId], limit: 1, useCase: 'subject_practice', retryFailed: false, force: false },
    studentPublicationBoundary: 'ordinary_generation_job_apply_may_auto_publish_use_observation_harness_for_no_student_publication',
    authorizationBoundary: apply
      ? 'apply_requires_exact_confirmation_and_observation_only_backend'
      : 'preview_only_does_not_authorize_or_call_provider',
    requiredConfirmations: [
      '--apply',
      '--confirm-exact-question-plan-live-job',
      '--accept-provider-payload-and-db-writes',
      '--allow-student-publication',
      `--confirm-job=${jobId}`
    ]
  };

  if (apply) {
    if (preflight.failures.length) throw new Error(`Apply refused: ${preflight.failures.join(',')}`);
    const authorizationFailures = directApplyAuthorizationFailures(jobId);
    if (authorizationFailures.length) throw new Error(authorizationFailures.join(' '));
    const token = await resolveAdminToken();
    const admission = await requestJson(`/api/v1/admin/ai-questioning/subject-practice-observation-tasks?subject=${encodeURIComponent(subject)}&limit=1`, token);
    const readiness = recordFrom(admission.readiness);
    if (readiness.observationOnlyMode !== true) {
      throw new Error('Apply refused because backend readiness does not report observationOnlyMode=true.');
    }
    const result = await requestJson('/api/v1/admin/ai-questioning/generation-jobs/process', token, {
      method: 'POST',
      body: report.processBody
    });
    report = {
      ...report,
      admission: {
        observationOnlyMode: readiness.observationOnlyMode === true,
        readyForSubmission: readiness.readyForSubmission === true,
        readyForExecution: readiness.readyForExecution === true
      },
      result,
      applyOutcome: summarizeApplyOutcome(result, jobId),
      postApplyEvidence: await loadJobEvidence(jobId)
    };
  }

  if (json) console.log(JSON.stringify(report, jsonReplacer, 2));
  else {
    console.log(`QuestionPlan single live job ${apply ? 'apply' : 'preview'}: ${preflight.status}`);
    console.log(`- job=#${jobId} run=#${runId} cell=#${cellId} backend=${baseUrl}`);
    console.log(`- providerImpact=${report.providerImpact} dbImpact=${report.dbImpact}`);
    console.log(`- plan=${projection.current.planTemplate || 'none'} boundary=${projection.current.providerBoundary}`);
    console.log(`- evidence=${report.evidence.conclusion} jobStatus=${report.evidence.job?.status || 'missing'} question=${report.evidence.job?.questionId || 'none'}`);
    if (preflight.failures.length) console.log(`- failures=${preflight.failures.join(',')}`);
    if (!apply) console.log(`- preview only. Add ${report.requiredConfirmations.join(' ')} after starting observation-only backend.`);
    if (report.result) console.log(`- result=${JSON.stringify(report.result)}`);
    if (report.applyOutcome) console.log(`- applyOutcome=${JSON.stringify(report.applyOutcome)}`);
    if (report.postApplyEvidence) console.log(`- postApplyEvidence=${JSON.stringify(report.postApplyEvidence)}`);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error), standaloneProviderExecution: false }, null, 2));
  process.exitCode = 1;
});
