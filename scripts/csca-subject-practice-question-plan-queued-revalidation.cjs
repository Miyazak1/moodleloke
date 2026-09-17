const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

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

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return;
  process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function uniquePositiveIds(value) {
  return Array.from(new Set(
    cleanText(value)
      .split(/[,;\s]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )).sort((left, right) => left - right);
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
    phase: 'enqueue',
    gate: currentGate,
    questionPlan: effectiveQuestionPlan
  });
  return {
    jobId: Number(row.id),
    status: cleanText(row.status),
    subject: cleanText(row.subject),
    topicId: Number(row.topicId),
    topicTitle: cleanText(row.topicTitle),
    productionRunId: asNumber(metadata.productionRunId || row.productionRunId),
    productionCellId,
    targetDifficulty,
    stored: {
      hasQuestionPlan: Object.keys(storedPlan).length > 0,
      gateMode: cleanText(storedGate.mode) || null,
      gateEnabled: storedGate.enabled === true,
      gateApplicable: storedGate.applicable === true,
      gateCellAllowed: storedGate.cellAllowed === true,
      attemptStatus: cleanText(storedAttempt.status) || null
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
    },
    metadataRefreshNeeded: cleanText(storedGate.mode) !== currentGate.mode
      || (storedGate.enabled === true) !== currentGate.enabled
      || (storedGate.cellAllowed === true) !== currentGate.cellAllowed
      || (Object.keys(storedPlan).length > 0) !== Boolean(effectiveQuestionPlan)
  };
}

function buildLiveExecutionBoundary({ subject, runId, cells, items }) {
  const allowlist = cleanText(process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]) || '';
  const allowlistOrder = uniquePositiveIds(allowlist);
  const cellRank = (cellId) => {
    const index = allowlistOrder.indexOf(Number(cellId));
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  };
  const allowedJobs = items
    .filter((item) => item.status === 'queued')
    .filter((item) => item.current.hasEffectiveQuestionPlan)
    .filter((item) => item.current.providerBoundary === 'would_continue_to_provider_when_runner_claims')
    .sort((left, right) => {
      const leftCellRank = cellRank(left.productionCellId);
      const rightCellRank = cellRank(right.productionCellId);
      const leftHard = left.targetDifficulty === 'hard' ? 0 : 1;
      const rightHard = right.targetDifficulty === 'hard' ? 0 : 1;
      return leftCellRank - rightCellRank || leftHard - rightHard || left.jobId - right.jobId;
    });
  const recommended = allowedJobs.slice(0, 1);
  return {
    status: recommended.length ? 'requires_explicit_live_authorization' : 'no_question_plan_queued_job_ready',
    authorizationBoundary: 'read_only_report_only_does_not_authorize_execution',
    recommendedJobIds: recommended.map((item) => item.jobId),
    allowedJobIds: allowedJobs.map((item) => item.jobId),
    allowedProductionRunId: runId,
    allowedProductionCellIds: Array.from(new Set(allowedJobs.map((item) => item.productionCellId))).sort((left, right) => left - right),
    scopedCells: cells,
    requiredBackendMode: 'observation_only_backend',
    requiredFeatureFlags: {
      CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED: 'true',
      CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST: allowlist || '(must include selected cell)'
    },
    startBackendCommand: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan${allowlist ? ` --question-plan-cell-allowlist=${allowlist}` : ''}`,
    processEndpoint: 'POST /api/v1/admin/ai-questioning/generation-jobs/process',
    processBody: recommended.length
      ? { jobIds: recommended.map((item) => item.jobId), limit: 1, useCase: 'subject_practice', retryFailed: false, force: false }
      : null,
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
    ],
    forbiddenActions: [
      'do_not_start_unbounded_ordinary_production_runner',
      'do_not_process_entire_production_run',
      'do_not_process_jobs_outside_allowedJobIds',
      'do_not_publish_without_formal_automatic_gate',
      'do_not_treat_provider_failure_as_family_quality_memory'
    ],
    explicitAuthorizationRequired: recommended.length
      ? `Authorize exactly one live provider call for ${subject} production run #${runId}, job #${recommended[0].jobId}, cell #${recommended[0].productionCellId}, accepting the listed DB/provider/student-publication side effects; use the observation harness instead when student publication must be suppressed.`
      : 'No live execution should be attempted from this report.'
  };
}

async function main() {
  loadDatabaseUrl();
  maybeSetQuestionPlanEnvFromArgs();
  const prisma = new PrismaClient();
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const runId = Number(argValue('run', '200'));
  const cells = uniquePositiveIds(argValue('cells', ''));
  const json = hasFlag('json');
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
      WHERE job.prompt_metadata->>'productionRunId' = $1
        AND bp.subject = $2
        AND job.status IN ('queued', 'running')
        AND ($3::int[] IS NULL OR (job.prompt_metadata->>'productionCellId')::int = ANY($3::int[]))
      ORDER BY job.updated_at DESC, job.id DESC
    `, String(runId), subject, cells.length ? cells : null);
    const items = rows.map(buildCurrentPolicyProjection);
    const wouldContinueToProvider = items.filter((item) => item.current.providerBoundary === 'would_continue_to_provider_when_runner_claims').length;
    const wouldFailBeforeProvider = items.filter((item) => item.current.providerBoundary === 'would_fail_before_provider_without_provider_call').length;
    const report = {
      mode: 'read_only_question_plan_queued_revalidation',
      subject,
      productionRunId: runId,
      scopedCells: cells,
      productionImpact: 'none_audit_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      currentPolicy: {
        featureFlag: SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
        featureFlagEnabled: subjectPracticeQuestionPlanEnabled(),
        cellAllowlistFlag: SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
        cellAllowlist: cleanText(process.env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]) || null
      },
      summary: {
        activeJobCount: items.length,
        metadataRefreshNeededCount: items.filter((item) => item.metadataRefreshNeeded).length,
        wouldContinueToProvider,
        wouldFailBeforeProvider,
        effectiveQuestionPlanCount: items.filter((item) => item.current.hasEffectiveQuestionPlan).length
      },
      liveExecutionBoundary: buildLiveExecutionBoundary({ subject, runId, cells, items }),
      items
    };
    if (json) console.log(JSON.stringify(report, jsonReplacer, 2));
    else {
      console.log(`QuestionPlan queued revalidation ${subject} #${runId}: active=${items.length}, effectivePlan=${report.summary.effectiveQuestionPlanCount}, wouldProvider=${wouldContinueToProvider}, wouldFailBeforeProvider=${wouldFailBeforeProvider}`);
      if (report.liveExecutionBoundary.recommendedJobIds.length) {
        console.log(`- live boundary: recommended single job #${report.liveExecutionBoundary.recommendedJobIds[0]}; requires explicit live authorization before provider call.`);
      } else {
        console.log(`- live boundary: ${report.liveExecutionBoundary.status}`);
      }
      for (const item of items) {
        console.log(`- job #${item.jobId} cell #${item.productionCellId}: stored=${item.stored.gateMode || 'none'} current=${item.current.gateMode} plan=${item.current.hasEffectiveQuestionPlan ? item.current.planTemplate : 'none'} boundary=${item.current.providerBoundary}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
