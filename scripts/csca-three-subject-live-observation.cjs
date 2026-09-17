#!/usr/bin/env node

const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

const execute = process.argv.includes('--execute');
const preview = process.argv.includes('--plan');
if (!execute && !preview) {
  throw new Error('Pass --plan for a read-only preview or --execute for live provider calls.');
}
if (execute && !process.argv.includes('--accept-provider-payload-and-db-writes')) {
  throw new Error('Live provider calls require --accept-provider-payload-and-db-writes.');
}
if (execute && !process.argv.includes('--confirm-no-student-publication')) {
  throw new Error('Live observation requires --confirm-no-student-publication.');
}
if (execute) {
  throw new Error(
    'Legacy direct three-subject execution is retired: it cannot provide the durable exact-cell cost reservation and Provider-boundary admission required by guarded observations. Use csca-ai-questioning:guarded-observation-run once per explicitly authorized subject/run/cell/task-family instead.'
  );
}

process.env.SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE = 'true';
process.env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED = 'false';
process.env.CSCA_AI_QUESTION_REVIEW_ENABLED = 'false';
process.env.CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED = 'true';
process.env.CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST = '13,24,41';

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const { NestFactory } = require('../backend/node_modules/@nestjs/core');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AppModule } = require('../backend/src/app.module');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');

const TARGETS = [
  { subject: 'math', runId: 1, cellId: 13, blueprintId: 13 },
  { subject: 'physics', runId: 2, cellId: 24, blueprintId: 24 },
  { subject: 'chemistry', runId: 3, cellId: 41, blueprintId: 41 }
];

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const requestedSubjects = argValue('subjects')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const unknownSubjects = requestedSubjects.filter((subject) => !TARGETS.some((target) => target.subject === subject));
if (unknownSubjects.length) {
  throw new Error(`Unknown --subjects values: ${unknownSubjects.join(', ')}.`);
}
const selectedTargets = requestedSubjects.length
  ? TARGETS.filter((target) => requestedSubjects.includes(target.subject))
  : TARGETS;

const perSubject = Number(argValue('per-subject', '1'));
if (!Number.isInteger(perSubject) || perSubject < 1 || perSubject > 5) {
  throw new Error('--per-subject must be an integer from 1 to 5.');
}
const workItems = Array.from({ length: perSubject }, (_, repetition) =>
  selectedTargets.map((target) => ({ ...target, repetition: repetition + 1 }))
).flat();
const plannedProviderCallCount = workItems.length;
const maxProviderCalls = Number(argValue('max-provider-calls', '0'));
const maxEstimatedCostUsd = Number(argValue('max-estimated-cost-usd', '0'));
const reservedCostPerCallUsd = Number(argValue('reserved-cost-per-call-usd', '0.01'));
const maxConsecutiveFailures = Number(argValue('max-consecutive-failures', '2'));
if (execute && (!Number.isInteger(maxProviderCalls) || maxProviderCalls !== plannedProviderCallCount)) {
  throw new Error(`--max-provider-calls=${plannedProviderCallCount} is required for this exact batch.`);
}
if (execute && (!Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd <= 0)) {
  throw new Error('--max-estimated-cost-usd=<positive number> is required for live execution.');
}
if (!Number.isFinite(reservedCostPerCallUsd) || reservedCostPerCallUsd <= 0) {
  throw new Error('--reserved-cost-per-call-usd must be positive.');
}
if (execute && reservedCostPerCallUsd * plannedProviderCallCount > maxEstimatedCostUsd + Number.EPSILON) {
  throw new Error(`Cost reserve ${(reservedCostPerCallUsd * plannedProviderCallCount).toFixed(6)} USD exceeds --max-estimated-cost-usd.`);
}
if (!Number.isInteger(maxConsecutiveFailures) || maxConsecutiveFailures < 1 || maxConsecutiveFailures > 5) {
  throw new Error('--max-consecutive-failures must be an integer from 1 to 5.');
}

const resumedJobIds = argValue('resume-jobs')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
if (resumedJobIds.length && resumedJobIds.length !== workItems.length) {
  throw new Error(`--resume-jobs requires exactly ${workItems.length} comma-separated job ids.`);
}

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}

async function loadTarget(prisma, target) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT run.id AS "runId", run.subject, run.status AS "runStatus", run.plan,
            cell.id AS "cellId", cell.topic_id AS "topicId", cell.topic_title AS "topicTitle",
            cell.difficulty_band AS "difficultyBand", cell.target_profile AS "targetProfile",
            cell.target_count AS "targetCount", cell.published_count AS "publishedCount",
            blueprint.id AS "blueprintId", blueprint.status AS "blueprintStatus"
       FROM csca_subject_practice_production_runs run
       JOIN csca_subject_practice_production_cells cell ON cell.run_id = run.id
       JOIN csca_question_blueprints blueprint
         ON blueprint.id = $4 AND blueprint.topic_id = cell.topic_id AND blueprint.subject = run.subject
      WHERE run.id = $1 AND run.subject = $2 AND cell.id = $3
      LIMIT 1`,
    target.runId,
    target.subject,
    target.cellId,
    target.blueprintId
  );
  if (!row) throw new Error(`${target.subject}: configured run/cell/blueprint target is missing.`);
  if (row.runStatus !== 'running') throw new Error(`${target.subject}: run #${target.runId} is ${row.runStatus}, expected running.`);
  if (row.blueprintStatus !== 'active') throw new Error(`${target.subject}: blueprint #${target.blueprintId} is not active.`);
  if (Number(row.publishedCount) >= Number(row.targetCount)) throw new Error(`${target.subject}: cell #${target.cellId} has no open capacity.`);
  const generationProfileId = Number(row.plan?.generationProfileLineage?.generationProfileId || 0);
  if (!generationProfileId) throw new Error(`${target.subject}: generation profile lineage is missing.`);
  return { ...row, generationProfileId };
}

async function readEvidence(prisma, jobId) {
  const [job] = await prisma.$queryRawUnsafe(
    `SELECT job.id, job.status, job.provider, job.model, job.question_id AS "questionId",
            job.error,
            job.prompt_metadata->>'workClass' AS "workClass",
            (job.prompt_metadata->>'suppressStudentPublication')::boolean AS "suppressStudentPublication",
            question.status AS "questionStatus", question.prompt,
            question.designed_difficulty AS "designedDifficulty",
            question.source_question_id AS "publishedQuestionId",
            question.review_metadata->'gate'->>'decision' AS "gateDecision",
            (question.review_metadata->'gate'->>'publishable')::boolean AS publishable,
            question.review_metadata->>'status' AS "reviewStatus",
            question.review_metadata->>'score' AS "reviewScore",
            question.review_metadata->'profileAlignment'->>'status' AS "profileStatus",
            question.review_metadata->'profileAlignment'->>'score' AS "profileScore",
            question.review_metadata->'profileAlignment'->'evidence'->>'inferredDifficultyBand' AS "inferredDifficulty",
            (question.generation_metadata->'questionPlanAdherence'->>'adheres')::boolean AS "questionPlanAdheres"
       FROM csca_ai_generation_jobs job
       LEFT JOIN csca_questions question ON question.id = job.question_id
      WHERE job.id = $1`,
    jobId
  );
  const [gateway] = await prisma.$queryRawUnsafe(
    `SELECT id, provider_id AS "providerId", model, status, error_code AS "errorCode",
            latency_ms AS "latencyMs", prompt_tokens AS "promptTokens",
            completion_tokens AS "completionTokens", total_tokens AS "totalTokens",
            estimated_cost AS "estimatedCost"
       FROM ai_gateway_call_logs
      WHERE metadata->>'generationJobId' = $1
      ORDER BY id DESC LIMIT 1`,
    String(jobId)
  );
  return {
    job,
    gateway: gateway || null,
    studentPublicationSuppressed: job?.suppressStudentPublication === true
      && job?.workClass === 'observation'
      && !job?.publishedQuestionId
  };
}

async function bindObservationOwnership(prisma, configured, jobId, ownership) {
  const metadataPatch = JSON.stringify({
    workClass: 'observation',
    observationTaskId: ownership.observationTaskId,
    suppressStudentPublication: true,
    publicationPolicy: 'observation_gate_evidence_only_no_student_publication',
    executionOwnerId: ownership.executionOwnerId,
    executionAttemptToken: ownership.executionAttemptToken
  });
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE csca_ai_generation_jobs
        SET status = 'queued', error = NULL,
            prompt_metadata = (COALESCE(prompt_metadata, '{}'::jsonb) - 'archivedAt' - 'archiveNote') || $5::jsonb,
            updated_at = NOW()
      WHERE id = $1
        AND blueprint_id = $2
        AND prompt_metadata->>'productionRunId' = $3
        AND prompt_metadata->>'productionCellId' = $4
        AND question_id IS NULL`,
    jobId,
    configured.blueprintId,
    String(configured.runId),
    String(configured.cellId),
    metadataPatch
  );
  if (updated !== 1) throw new Error(`${configured.subject}: job #${jobId} could not be bound as a no-publication observation job.`);
}

async function createObservationFence(prisma, configured, ownership) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO csca_ai_questioning_tasks (
       id, task_type, action, subject, resource_type, resource_id, filter_snapshot,
       status, requested, execution_owner_id, execution_attempt_token,
       last_heartbeat_at, started_at, created_at, updated_at
     ) VALUES (
       $1::uuid, 'subject_practice_observation', 'three_subject_live_observation', $2,
       'production_run', $3, $4::jsonb, 'running', 1, $5, $6::uuid,
       NOW(), NOW(), NOW(), NOW()
     )`,
    ownership.observationTaskId,
    configured.subject,
    String(configured.runId),
    JSON.stringify({
      schemaVersion: 'three-subject-live-observation-v1',
      productionRunId: configured.runId,
      productionCellId: configured.cellId,
      suppressStudentPublication: true,
      publicationPolicy: 'observation_gate_evidence_only_no_student_publication'
    }),
    ownership.executionOwnerId,
    ownership.executionAttemptToken
  );
}

async function finishObservationFence(prisma, taskId, processed) {
  const succeeded = processed?.status === 'succeeded';
  await prisma.$executeRawUnsafe(
    `UPDATE csca_ai_questioning_tasks
        SET status = $2, succeeded = $3, failed = $4,
            result = $5::jsonb, error = $6, completed_at = NOW(),
            last_heartbeat_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid`,
    taskId,
    succeeded ? 'succeeded' : 'failed',
    succeeded ? 1 : 0,
    succeeded ? 0 : 1,
    JSON.stringify({
      generationJobId: Number(processed?.id || 0) || null,
      generatedQuestionId: Number(processed?.questionId || 0) || null,
      noCandidate: !processed?.questionId
    }),
    succeeded ? null : String(processed?.error || processed?.status || 'generation_failed')
  );
}

async function main() {
  const prisma = new PrismaClient();
  if (preview) {
    try {
      const targets = [];
      for (const target of selectedTargets) targets.push(await loadTarget(prisma, target));
      console.log(JSON.stringify({
        mode: 'three_subject_live_observation_plan',
        providerImpact: 'none_no_provider_call',
        dbImpact: 'none_read_only_preflight',
        requestedSubjects: selectedTargets.map((target) => target.subject),
        perSubject,
        plannedProviderCallCount,
        requiredExecutionCaps: {
          maxProviderCalls: plannedProviderCallCount,
          suggestedMaxEstimatedCostUsd: Number((reservedCostPerCallUsd * plannedProviderCallCount).toFixed(6)),
          reservedCostPerCallUsd,
          maxConsecutiveFailures
        },
        targets: targets.map((target) => ({
          subject: target.subject,
          runId: target.runId,
          cellId: target.cellId,
          blueprintId: target.blueprintId,
          topicTitle: target.topicTitle,
          difficultyBand: target.difficultyBand,
          openCapacity: Math.max(0, Number(target.targetCount) - Number(target.publishedCount))
        }))
      }, jsonReplacer, 2));
      return;
    } finally {
      await prisma.$disconnect();
    }
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const service = app.get(AIQuestioningService);
  const results = [];
  let cumulativeEstimatedCostUsd = 0;
  let consecutiveFailures = 0;
  try {
    for (const [targetIndex, configured] of workItems.entries()) {
      if (cumulativeEstimatedCostUsd + reservedCostPerCallUsd > maxEstimatedCostUsd + Number.EPSILON) {
        results.push({
          subject: configured.subject,
          repetition: configured.repetition,
          status: 'skipped_by_cost_budget_guard',
          estimatedCostBeforeCallUsd: cumulativeEstimatedCostUsd,
          reservedCostPerCallUsd,
          maxEstimatedCostUsd
        });
        continue;
      }
      if (consecutiveFailures >= maxConsecutiveFailures) {
        results.push({
          subject: configured.subject,
          repetition: configured.repetition,
          status: 'skipped_by_consecutive_failure_circuit_breaker',
          consecutiveFailures,
          maxConsecutiveFailures
        });
        continue;
      }
      const target = await loadTarget(prisma, configured);
      const observationTaskId = randomUUID();
      const executionOwnerId = `three-subject-live-observation-${process.pid}`;
      const executionAttemptToken = randomUUID();
      const targetProfile = target.targetProfile && typeof target.targetProfile === 'object'
        ? target.targetProfile
        : {};
      let jobId = resumedJobIds[targetIndex] || 0;
      if (!jobId) {
        const enqueued = await service.enqueueGenerationJobs({
          blueprintIds: [configured.blueprintId],
          limit: 1,
          force: true,
          expand: true,
          count: 1,
          perBlueprint: 1,
          batchId: `three-subject-live-${configured.subject}-r${configured.repetition}-${Date.now()}`,
          generationMode: 'subject_practice_production_matrix_observation',
          subjectPracticeGenerationTier: 'standard',
          productionRunId: configured.runId,
          productionCellId: configured.cellId,
          generationProfileId: target.generationProfileId,
          productionGapKey: targetProfile.gapKey || null,
          targetProfile
        });
        jobId = Number(enqueued?.items?.[0]?.id || 0);
        if (!jobId) throw new Error(`${configured.subject}: enqueue did not return a generation job.`);
      }
      await createObservationFence(prisma, configured, {
        observationTaskId,
        executionOwnerId,
        executionAttemptToken
      });
      await bindObservationOwnership(prisma, configured, jobId, {
        observationTaskId,
        executionOwnerId,
        executionAttemptToken
      });
      let processed;
      try {
        processed = await service.processGenerationJob(jobId, {
          force: true,
          observationTaskId,
          executionOwnerId,
          executionAttemptToken
        });
      } catch (error) {
        processed = { status: 'process_exception', error: error instanceof Error ? error.message : String(error) };
      }
      await finishObservationFence(prisma, observationTaskId, processed);
      const evidence = await readEvidence(prisma, jobId);
      const callEstimatedCostUsd = Number(evidence.gateway?.estimatedCost || 0);
      if (Number.isFinite(callEstimatedCostUsd) && callEstimatedCostUsd > 0) {
        cumulativeEstimatedCostUsd += callEstimatedCostUsd;
      }
      if (processed?.status === 'succeeded') consecutiveFailures = 0;
      else consecutiveFailures += 1;
      results.push({
        subject: configured.subject,
        repetition: configured.repetition,
        runId: configured.runId,
        cellId: configured.cellId,
        blueprintId: configured.blueprintId,
        topicTitle: target.topicTitle,
        jobId,
        processed: {
          status: processed?.status || null,
          questionId: Number(processed?.questionId || 0) || null,
          provider: processed?.provider || null,
          model: processed?.model || null,
          error: processed?.error || null
        },
        evidence,
        cumulativeEstimatedCostUsd: Number(cumulativeEstimatedCostUsd.toFixed(9))
      });
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
  const attempted = results.filter((item) => Number(item.jobId) > 0);
  const generated = attempted.filter((item) => item.processed?.status === 'succeeded');
  const publishable = generated.filter((item) => item.evidence?.job?.gateDecision === 'publishable');
  const plannedQuestions = generated.filter((item) => item.evidence?.job?.questionPlanAdheres !== null && item.evidence?.job?.questionPlanAdheres !== undefined);
  const planAdhered = plannedQuestions.filter((item) => item.evidence?.job?.questionPlanAdheres === true);
  const totalTokens = attempted.reduce((sum, item) => sum + Number(item.evidence?.gateway?.totalTokens || 0), 0);
  const totalLatencyMs = attempted.reduce((sum, item) => sum + Number(item.evidence?.gateway?.latencyMs || 0), 0);
  const publicationViolations = attempted.filter((item) => item.evidence?.studentPublicationSuppressed !== true);
  console.log(JSON.stringify({
    mode: 'three_subject_live_observation',
    requestedSubjects: selectedTargets.map((target) => target.subject),
    perSubject,
    plannedProviderCallCount,
    attemptedProviderCallCount: attempted.length,
    boundedProviderCallCount: maxProviderCalls,
    providerImpact: `${attempted.length}_bounded_question_generation_call${attempted.length === 1 ? '' : 's'}`,
    dbImpact: `${attempted.length}_generation_job${attempted.length === 1 ? '' : 's'}_and_up_to_${attempted.length}_non_student_candidate_question${attempted.length === 1 ? '' : 's'}`,
    studentPublicationPolicy: 'suppressed_for_every_job',
    executionCaps: { maxProviderCalls, maxEstimatedCostUsd, reservedCostPerCallUsd, maxConsecutiveFailures },
    stabilitySummary: {
      generationSuccessCount: generated.length,
      generationSuccessRate: attempted.length ? Number((generated.length / attempted.length).toFixed(4)) : null,
      automaticPublishableCount: publishable.length,
      automaticPublishableRate: generated.length ? Number((publishable.length / generated.length).toFixed(4)) : null,
      questionPlanEvaluatedCount: plannedQuestions.length,
      questionPlanAdheredCount: planAdhered.length,
      questionPlanAdherenceRate: plannedQuestions.length ? Number((planAdhered.length / plannedQuestions.length).toFixed(4)) : null,
      totalTokens,
      totalLatencyMs,
      averageLatencyMs: attempted.length ? Math.round(totalLatencyMs / attempted.length) : null,
      estimatedCostUsd: Number(cumulativeEstimatedCostUsd.toFixed(9)),
      studentPublicationViolationCount: publicationViolations.length,
      circuitBreakerTriggered: results.some((item) => item.status === 'skipped_by_consecutive_failure_circuit_breaker'),
      costBudgetGuardTriggered: results.some((item) => item.status === 'skipped_by_cost_budget_guard')
    },
    results
  }, jsonReplacer, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
