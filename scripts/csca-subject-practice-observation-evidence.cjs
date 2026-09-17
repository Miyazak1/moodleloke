const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

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

function asInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function asNumber(value, fallback = 0) {
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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  }
  return null;
}

async function latestTask(prisma, subject) {
  const rows = await prisma.$queryRaw`
    SELECT id
    FROM csca_ai_questioning_tasks
    WHERE task_type = 'subject_practice_observation'
      AND (${subject}::text IS NULL OR subject = ${subject})
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function main() {
  const prisma = new PrismaClient();
  const subject = argValue('subject', 'math') || null;
  const taskId = argValue('task') || await latestTask(prisma, subject);
  const gatewayWindowMinutes = Math.max(1, Math.min(60, asInt(argValue('gateway-window-minutes', '5'), 5)));
  const json = hasFlag('json');

  if (!taskId && hasFlag('allow-missing-latest-task')) {
    const report = {
      mode: 'read_only_observation_evidence',
      status: 'skipped_no_observation_task',
      taskId: null,
      productionImpact: 'none_read_only_db_lookup',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_task_lookup',
      liveObservationSubmitted: false,
      providerFailuresAreDeliveryEvidenceOnly: true,
      studentConsumableNotProvenByThisReport: true
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Observation evidence: skipped, no subject_practice_observation task found.');
    await prisma.$disconnect();
    return;
  }

  if (!taskId) throw new Error('No subject_practice_observation task found. Pass --task=<uuid> or create an observation task first.');

  try {
    const tasks = await prisma.$queryRaw`
      SELECT id, task_type AS "taskType", action, subject, resource_type AS "resourceType", resource_id AS "resourceId",
             filter_snapshot AS "filterSnapshot", status, requested, succeeded, skipped, failed, error, result,
             execution_owner_id AS "executionOwnerId", execution_attempt_token AS "executionAttemptToken",
             last_heartbeat_at AS "lastHeartbeatAt", cancel_requested_at AS "cancelRequestedAt",
             started_at AS "startedAt", completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM csca_ai_questioning_tasks
      WHERE id = ${taskId}::uuid
        AND task_type = 'subject_practice_observation'
      LIMIT 1
    `;
    const task = tasks[0];
    if (!task) throw new Error(`Observation task ${taskId} was not found.`);

    const taskResult = asJson(task.result) ?? {};
    const taskFilter = asJson(task.filterSnapshot) ?? {};
    const generationJobId = asInt(taskResult.generationJobId, 0) || null;

    const jobs = generationJobId
      ? await prisma.$queryRaw`
          SELECT id, status, question_id AS "questionId", provider, model, request_hash AS "requestHash",
                 prompt_metadata AS "promptMetadata", raw_output AS "rawOutput", normalized_output AS "normalizedOutput",
                 review_result AS "reviewResult", error, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM csca_ai_generation_jobs
          WHERE id = ${generationJobId}
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT id, status, question_id AS "questionId", provider, model, request_hash AS "requestHash",
                 prompt_metadata AS "promptMetadata", raw_output AS "rawOutput", normalized_output AS "normalizedOutput",
                 review_result AS "reviewResult", error, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM csca_ai_generation_jobs
          WHERE prompt_metadata->>'observationTaskId' = ${taskId}
          ORDER BY created_at DESC
        `;
    const job = jobs[0] ?? null;
    const jobMetadata = asJson(job?.promptMetadata) ?? {};

    const duplicateJobs = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM csca_ai_generation_jobs
      WHERE prompt_metadata->>'observationTaskId' = ${taskId}
    `;

    const questions = job?.questionId
      ? await prisma.$queryRaw`
          SELECT id, status, source_question_id AS "sourceQuestionId", designed_difficulty AS "designedDifficulty",
                 generation_metadata AS "generationMetadata", review_metadata AS "reviewMetadata",
                 LEFT(prompt, 240) AS prompt, correct_answer AS "correctAnswer",
                 LEFT(explanation, 240) AS explanation, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM csca_questions
          WHERE id = ${job.questionId}
          LIMIT 1
        `
      : [];
    const question = questions[0] ?? null;
    const reviewMetadata = asJson(question?.reviewMetadata) ?? {};
    const questionGenerationMetadata = asJson(question?.generationMetadata) ?? {};
    const sourceQuestionId = asInt(question?.sourceQuestionId, 0) || null;
    const specialPracticeQuestionRows = sourceQuestionId
      ? await prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM special_practice_questions
          WHERE id = ${sourceQuestionId}
        `
      : [{ count: 0 }];
    const specialPracticeQuestionCount = specialPracticeQuestionRows[0]?.count ?? 0;
    const suppressStudentPublication = taskFilter.suppressStudentPublication !== false
      || jobMetadata.suppressStudentPublication === true
      || questionGenerationMetadata.suppressStudentPublication === true;
    const publicationPolicy = firstString(
      taskFilter.publicationPolicy,
      jobMetadata.publicationPolicy,
      questionGenerationMetadata.publicationPolicy
    );

    const taskCreatedAt = new Date(task.createdAt);
    const taskUpdatedAt = new Date(task.updatedAt);
    const gatewayStart = new Date(taskCreatedAt.getTime() - gatewayWindowMinutes * 60_000);
    const gatewayEnd = new Date(taskUpdatedAt.getTime() + gatewayWindowMinutes * 60_000);
    const directGatewayLogs = await prisma.$queryRaw`
      SELECT id, request_id AS "requestId", task_type AS "taskType", source_module AS "sourceModule",
             provider_id AS "providerId", model, key_id AS "keyId", status, error_code AS "errorCode",
             LEFT(COALESCE(error_message, ''), 240) AS "errorMessage", latency_ms AS "latencyMs",
             prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens", total_tokens AS "totalTokens",
             estimated_cost AS "estimatedCost", metadata, created_at AS "createdAt"
      FROM ai_gateway_call_logs
      WHERE metadata->>'observationTaskId' = ${taskId}
        AND task_type = 'question_generation'
        AND source_module = 'question_generator'
      ORDER BY created_at DESC
      LIMIT 8
    `;
    const timeWindowGatewayLogs = directGatewayLogs.length ? [] : await prisma.$queryRaw`
      SELECT id, request_id AS "requestId", task_type AS "taskType", source_module AS "sourceModule",
             provider_id AS "providerId", model, key_id AS "keyId", status, error_code AS "errorCode",
             LEFT(COALESCE(error_message, ''), 240) AS "errorMessage", latency_ms AS "latencyMs",
             prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens", total_tokens AS "totalTokens",
             estimated_cost AS "estimatedCost", metadata, created_at AS "createdAt"
      FROM ai_gateway_call_logs
      WHERE created_at BETWEEN ${gatewayStart} AND ${gatewayEnd}
        AND task_type = 'question_generation'
        AND source_module = 'question_generator'
        AND (${task.subject}::text IS NULL OR metadata->>'subject' = ${task.subject})
      ORDER BY created_at DESC
      LIMIT 8
    `;
    const gatewayLogs = directGatewayLogs.length ? directGatewayLogs : timeWindowGatewayLogs;
    const gatewayUsage = gatewayLogs.reduce((total, item) => ({
      promptTokens: total.promptTokens + asNumber(item.promptTokens),
      completionTokens: total.completionTokens + asNumber(item.completionTokens),
      totalTokens: total.totalTokens + asNumber(item.totalTokens),
      estimatedCostUsd: total.estimatedCostUsd + asNumber(item.estimatedCost)
    }), { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
    const directlyBoundGatewayEvidence = directGatewayLogs.length > 0;
    const gatewayProviderAttemptCount = directlyBoundGatewayEvidence
      ? gatewayLogs.reduce((total, item) => total + asInt(asJson(item.metadata)?.gatewayProviderAttemptCount, 0), 0)
      : null;
    const maxEstimatedCostUsd = asNumber(taskFilter.maxEstimatedCostUsd, 0) || null;
    const maximumReservedCostUsd = asNumber(taskFilter.maximumReservedCostUsd, 0) || null;
    const estimatedCostUsd = Number(gatewayUsage.estimatedCostUsd.toFixed(9));
    const costWithinAuthorizedCap = directlyBoundGatewayEvidence && maxEstimatedCostUsd != null
      ? estimatedCostUsd <= maxEstimatedCostUsd + Number.EPSILON
      : null;
    const providerAttemptLimit = asInt(
      jobMetadata.observationCostAdmission?.providerAttemptLimit
        ?? asJson(gatewayLogs[0]?.metadata)?.providerAttemptLimit
        ?? asJson(gatewayLogs[0]?.metadata)?.gatewayProviderAttemptLimit,
      0
    ) || null;

    const activeObservationTasks = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM csca_ai_questioning_tasks
      WHERE task_type = 'subject_practice_observation'
        AND status IN ('queued', 'running')
    `;
    const activeObservationJobs = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM csca_ai_generation_jobs
      WHERE status IN ('queued', 'running')
        AND (
          prompt_metadata->>'workClass' = 'observation'
          OR NULLIF(prompt_metadata->>'observationTaskId', '') IS NOT NULL
        )
    `;
    const activeMathJobs = await prisma.$queryRaw`
      SELECT status, COUNT(*)::int AS count
      FROM csca_ai_generation_jobs
      WHERE prompt_metadata->>'productionRunId' = '156'
        AND status IN ('queued', 'running')
      GROUP BY status
      ORDER BY status
    `;

    const latestChemistryRuns = await prisma.$queryRaw`
      SELECT id, status, published_total AS "published", open_total AS "open",
             blocked_reason_code AS "blockedReason", updated_at AS "updatedAt"
      FROM csca_subject_practice_production_runs
      WHERE subject = 'chemistry'
        AND status IN ('running', 'blocked')
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `;

    const report = {
      mode: 'read_only_observation_evidence',
      taskId,
      task: {
        id: task.id,
        status: task.status,
        action: task.action,
        subject: task.subject,
        productionRunId: asInt(task.resourceId, taskFilter.productionRunId ?? null),
        productionCellId: taskFilter.productionCellId ?? null,
        error: task.error,
        result: taskResult,
        executionOwnerId: task.executionOwnerId,
        executionAttemptToken: task.executionAttemptToken,
        lastHeartbeatAt: task.lastHeartbeatAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        maxEstimatedCostUsd,
        maximumReservedCostUsd,
        costReservationPolicyVersion: firstString(taskFilter.costReservationPolicyVersion)
      },
      generationJob: job ? {
        id: job.id,
        status: job.status,
        questionId: job.questionId,
        provider: job.provider,
        model: job.model,
        workClass: firstString(jobMetadata.workClass),
        observationTaskId: firstString(jobMetadata.observationTaskId),
        suppressStudentPublication: jobMetadata.suppressStudentPublication === true,
        publicationPolicy: firstString(jobMetadata.publicationPolicy),
        productionRunId: firstString(jobMetadata.productionRunId),
        productionCellId: firstString(jobMetadata.productionCellId),
        failureCategory: firstString(jobMetadata.failureCategory, jobMetadata.providerFailureCategory),
        providerStatus: firstString(jobMetadata.providerStatus),
        providerFailureCategory: firstString(jobMetadata.providerFailureCategory),
        schedulerHint: jobMetadata.repairFeedback?.schedulerHint ?? jobMetadata.schedulerHint ?? null,
        schedulerHintAdherence: jobMetadata.schedulerHintAdherence ?? null,
        targetProfileCompatibility: jobMetadata.targetProfileCompatibility ?? null,
        gatewayAttemptCount: asInt(jobMetadata.gatewayAttemptCount, Array.isArray(jobMetadata.gatewayAttempts) ? jobMetadata.gatewayAttempts.length : 0),
        gatewayAttempts: Array.isArray(jobMetadata.gatewayAttempts) ? jobMetadata.gatewayAttempts : [],
        observationCostAdmission: jobMetadata.observationCostAdmission ?? null,
        providerAttemptLimit,
        hasRawOutput: job.rawOutput != null,
        hasNormalizedOutput: job.normalizedOutput != null,
        hasReviewResult: job.reviewResult != null,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      } : null,
      uniqueness: {
        observationJobCountForTask: duplicateJobs[0]?.count ?? 0,
        oneObservationJobForTask: (duplicateJobs[0]?.count ?? 0) === 1
      },
      question: question ? {
        id: question.id,
        status: question.status,
        sourceQuestionId,
        designedDifficulty: question.designedDifficulty,
        gateDecision: reviewMetadata.gate?.decision ?? null,
        gateReasons: reviewMetadata.gate?.reasons ?? null,
        autoApprovalStatus: reviewMetadata.subjectPracticeAutoApproval?.status ?? null,
        suppressStudentPublication: questionGenerationMetadata.suppressStudentPublication === true,
        publicationPolicy: firstString(questionGenerationMetadata.publicationPolicy),
        prompt: question.prompt,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      } : null,
      studentPublication: {
        suppressStudentPublication,
        publicationPolicy,
        specialPracticeQuestionCount,
        sourceQuestionId,
        studentPoolStatus: specialPracticeQuestionCount > 0
          ? 'published_to_student_pool'
          : 'not_published_to_student_pool'
      },
      gatewayCandidateLogs: {
        binding: directGatewayLogs.length
          ? 'direct_gateway_metadata_observationTaskId'
          : 'time_window_subject_taskType_sourceModule_candidate_not_unique_request_binding',
        windowMinutes: gatewayWindowMinutes,
        count: gatewayLogs.length,
        items: gatewayLogs
      },
      providerUsageAndCost: {
        binding: directlyBoundGatewayEvidence ? 'direct_observation_task_id' : 'ambiguous_time_window_fallback',
        providerAttemptLimit,
        providerAttemptCount: gatewayProviderAttemptCount,
        providerAttemptLimitRespected: gatewayProviderAttemptCount == null || providerAttemptLimit == null
          ? null
          : gatewayProviderAttemptCount <= providerAttemptLimit,
        promptTokens: gatewayUsage.promptTokens,
        completionTokens: gatewayUsage.completionTokens,
        totalTokens: gatewayUsage.totalTokens,
        estimatedCostUsd,
        maximumReservedCostUsd,
        maxEstimatedCostUsd,
        costWithinAuthorizedCap
      },
      isolation: {
        activeObservationTaskCount: activeObservationTasks[0]?.count ?? 0,
        activeObservationJobCount: activeObservationJobs[0]?.count ?? 0,
        math156ActiveJobs: activeMathJobs,
        latestChemistryRun: latestChemistryRuns[0] ?? null
      },
      interpretation: {
        noCandidate: taskResult.noCandidate === true,
        deliveryFailure: firstString(taskResult.deliveryFailure, jobMetadata.failureCategory, jobMetadata.providerFailureCategory),
        schedulerAdherenceInspectable: Boolean(taskResult.schedulerAdherence || jobMetadata.schedulerHintAdherence || question),
        gateInspectable: Boolean(question || taskResult.gateDecision),
        providerFailuresAreDeliveryEvidenceOnly: true,
        studentConsumableNotProvenByThisReport: true,
        deliveryStatus: gatewayLogs.some((item) => item.status === 'success') ? 'provider_delivered' : 'provider_not_delivered',
        candidateStatus: question ? 'candidate_recorded' : 'no_candidate_recorded',
        gateStatus: question ? (reviewMetadata.gate?.decision ?? 'gate_missing') : 'not_applicable_without_candidate',
        costEvidenceStatus: directlyBoundGatewayEvidence ? 'directly_bound' : 'ambiguous_or_missing',
        costWithinAuthorizedCap
      }
    };

    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Observation evidence: task=${report.task.id} status=${report.task.status} run=#${report.task.productionRunId} cell=#${report.task.productionCellId}`);
      console.log(`- job=${report.generationJob?.id ?? 'none'} status=${report.generationJob?.status ?? 'none'} question=${report.generationJob?.questionId ?? 'none'} workClass=${report.generationJob?.workClass ?? 'none'}`);
      console.log(`- uniqueObservationJob=${report.uniqueness.oneObservationJobForTask} count=${report.uniqueness.observationJobCountForTask}`);
      console.log(`- deliveryFailure=${report.interpretation.deliveryFailure ?? 'none'} noCandidate=${report.interpretation.noCandidate}`);
      console.log(`- studentPublication=${report.studentPublication.studentPoolStatus} suppressStudentPublication=${report.studentPublication.suppressStudentPublication}`);
      console.log(`- gatewayCandidateLogs=${report.gatewayCandidateLogs.count} binding=${report.gatewayCandidateLogs.binding}`);
      console.log(`- providerAttempts=${report.providerUsageAndCost.providerAttemptCount ?? 'unknown'}/${report.providerUsageAndCost.providerAttemptLimit ?? 'unknown'} tokens=${report.providerUsageAndCost.totalTokens} estimatedCostUsd=${report.providerUsageAndCost.estimatedCostUsd} withinCap=${report.providerUsageAndCost.costWithinAuthorizedCap}`);
      console.log(`- activeObservationTasks=${report.isolation.activeObservationTaskCount} activeObservationJobs=${report.isolation.activeObservationJobCount} math156ActiveJobs=${JSON.stringify(report.isolation.math156ActiveJobs)}`);
      console.log(`- latestChemistryRun=${report.isolation.latestChemistryRun?.id ?? 'none'} status=${report.isolation.latestChemistryRun?.status ?? 'none'} open=${report.isolation.latestChemistryRun?.open ?? 'n/a'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, mode: 'read_only_observation_evidence', message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
