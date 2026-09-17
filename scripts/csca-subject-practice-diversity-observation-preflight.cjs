const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

const PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN = 'provider_empty_output|provider_timeout|provider_network_error|provider_schema_invalid|provider_rate_limited|provider_unavailable|provider_quota_exceeded|gateway_key_cooldown|gateway_concurrency_timeout|gateway_key_concurrency_saturated|gateway_key_rate_limited|gateway_no_key_available|gateway_unknown_error|no_key_available';

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

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function positiveIntArg(name, fallback, min, max) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return;
  process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

function runNodeJson(args, label) {
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
}

function phaseByName(readiness, name) {
  return arrayFrom(recordFrom(readiness).phases).find((phase) => cleanText(phase.phase) === name) ?? null;
}

function subjectReadiness(report, subject) {
  return arrayFrom(recordFrom(report).subjects).find((item) => cleanText(item.subject) === subject) ?? null;
}

function pushFailure(failures, condition, code, detail) {
  if (!condition) failures.push({ code, detail });
}

function providerRecoveryStateFor(runtimeState) {
  const cooldownMinutes = 30;
  const latestProviderFailureAt = runtimeState.latestProviderFailureAt
    ? new Date(runtimeState.latestProviderFailureAt)
    : null;
  if (!latestProviderFailureAt || Number.isNaN(latestProviderFailureAt.getTime())) {
    return {
      cooldownMinutes,
      latestProviderFailureAt: null,
      eligibleAfter: null,
      remainingSeconds: 0
    };
  }
  const eligibleAfter = new Date(latestProviderFailureAt.getTime() + cooldownMinutes * 60 * 1000);
  return {
    cooldownMinutes,
    latestProviderFailureAt: latestProviderFailureAt.toISOString(),
    eligibleAfter: eligibleAfter.toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((eligibleAfter.getTime() - Date.now()) / 1000))
  };
}

function observationCooldownStateFor(observationAdmission) {
  const admission = recordFrom(observationAdmission);
  const cooldownMinutes = Math.max(1, Number(admission.cooldownMinutes) || 30);
  const latestTaskCreatedAt = admission.latestTaskCreatedAt ? new Date(admission.latestTaskCreatedAt) : null;
  if (!latestTaskCreatedAt || Number.isNaN(latestTaskCreatedAt.getTime())) {
    return {
      cooldownMinutes,
      latestTaskCreatedAt: null,
      eligibleAfter: null,
      remainingSeconds: 0,
      active: false
    };
  }
  const eligibleAfter = new Date(latestTaskCreatedAt.getTime() + cooldownMinutes * 60 * 1000);
  const remainingSeconds = Math.max(0, Math.ceil((eligibleAfter.getTime() - Date.now()) / 1000));
  return {
    cooldownMinutes,
    latestTaskCreatedAt: latestTaskCreatedAt.toISOString(),
    eligibleAfter: eligibleAfter.toISOString(),
    remainingSeconds,
    active: remainingSeconds > 0
  };
}

function envFlagEnabled(name) {
  return ['true', '1'].includes(cleanText(process.env[name]));
}

function questionPlanCellAllowedFor(cellId, allowlist) {
  const raw = cleanText(allowlist);
  if (!raw) return true;
  const target = cleanText(cellId);
  if (!target) return false;
  const allowed = raw.split(/[,;\s]+/).map(cleanText).filter(Boolean);
  return allowed.includes('*') || allowed.includes(target);
}

function observationNetworkRecoveryStateFor(runtimeState) {
  const recoveryMinutes = Math.max(1, Number(process.env.SUBJECT_PRACTICE_OBSERVATION_PROVIDER_NETWORK_RECOVERY_MINUTES || 60));
  const threshold = Math.max(2, Number(process.env.SUBJECT_PRACTICE_OBSERVATION_PROVIDER_NETWORK_FAILURE_THRESHOLD || 2));
  const streak = Number(runtimeState.observationNetworkFailureStreak) || 0;
  const latestFailureAt = runtimeState.latestObservationNetworkFailureAt
    ? new Date(runtimeState.latestObservationNetworkFailureAt)
    : null;
  if (streak < threshold || !latestFailureAt || Number.isNaN(latestFailureAt.getTime())) {
    return {
      recoveryMinutes,
      threshold,
      streak,
      latestFailureAt: latestFailureAt && !Number.isNaN(latestFailureAt.getTime()) ? latestFailureAt.toISOString() : null,
      eligibleAfter: null,
      remainingSeconds: 0,
      active: false
    };
  }
  const eligibleAfter = new Date(latestFailureAt.getTime() + recoveryMinutes * 60 * 1000);
  const remainingSeconds = Math.max(0, Math.ceil((eligibleAfter.getTime() - Date.now()) / 1000));
  return {
    recoveryMinutes,
    threshold,
    streak,
    latestFailureAt: latestFailureAt.toISOString(),
    eligibleAfter: eligibleAfter.toISOString(),
    remainingSeconds,
    active: remainingSeconds > 0
  };
}

function observationBackendBaseUrl() {
  const configured = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || ''));
  return configured ? configured.replace(/\/+$/, '') : '';
}

function skipObservationBackendReadiness() {
  return hasFlag('skip-backend-readiness')
    || process.env.CSCA_OBSERVATION_BACKEND_READINESS_SKIP === '1';
}

async function requestObservationBackendJson(baseUrl, pathname, token, options = {}) {
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

async function resolveObservationBackendAdminToken(baseUrl) {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) return configured;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Admin token or ADMIN_BOOTSTRAP_EMAIL/PASSWORD is required.');
  const login = await requestObservationBackendJson(baseUrl, '/api/v1/auth/login', '', { method: 'POST', body: { email, password } });
  const token = login.tokens?.accessToken;
  if (!token) throw new Error('Admin login did not return an access token.');
  return token;
}

async function loadObservationBackendAdmission(baseUrl) {
  if (!baseUrl) return null;
  const token = await resolveObservationBackendAdminToken(baseUrl);
  const status = await requestObservationBackendJson(
    baseUrl,
    '/api/v1/admin/ai-questioning/subject-practice-observation-tasks?subject=math&limit=1',
    token
  );
  return {
    baseUrl,
    readiness: recordFrom(status.readiness),
    itemCount: arrayFrom(status.items).length
  };
}

function mergeObservationAdmission(localAdmission, backendAdmission) {
  const local = recordFrom(localAdmission);
  if (!backendAdmission) {
    return {
      ...local,
      source: 'local_database_and_cli_env',
      backendBaseUrl: null,
      backendReadinessLoaded: false
    };
  }
  const readiness = recordFrom(backendAdmission.readiness);
  return {
    ...local,
    taskEnabled: readiness.taskEnabled === true,
    executionEnabled: readiness.executionEnabled === true,
    singletonConfirmed: readiness.singletonConfirmed === true,
    observationOnlyMode: readiness.observationOnlyMode === true,
    questionPlanEnabled: readiness.questionPlanEnabled === true,
    questionPlanFeatureFlag: cleanText(readiness.questionPlanFeatureFlag) || cleanText(local.questionPlanFeatureFlag) || 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED',
    questionPlanCellAllowlist: cleanText(readiness.questionPlanCellAllowlist) || cleanText(local.questionPlanCellAllowlist) || null,
    questionPlanCellAllowlistFlag: cleanText(readiness.questionPlanCellAllowlistFlag) || cleanText(local.questionPlanCellAllowlistFlag) || 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST',
    globalConcurrency: Number(readiness.globalConcurrency) || Number(local.globalConcurrency) || 0,
    realtimeConcurrency: Number(readiness.realtimeConcurrency) || Number(local.realtimeConcurrency) || 0,
    backgroundConcurrency: Number(readiness.backgroundConcurrency) || Number(local.backgroundConcurrency) || 0,
    eligibleBackgroundKeySlots: Number(readiness.eligibleKeySlots) || Number(local.eligibleBackgroundKeySlots) || 0,
    cooldownMinutes: Number(readiness.cooldownMinutes) || Number(local.cooldownMinutes) || 30,
    backendReasons: arrayFrom(readiness.reasons),
    source: 'target_backend_readiness',
    backendBaseUrl: backendAdmission.baseUrl,
    backendReadinessLoaded: true,
    backendReadinessItemCount: Number(backendAdmission.itemCount) || 0
  };
}

async function mathRuntimeState(prisma) {
  const runRows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'running')::int AS "runningRunCount",
      COUNT(*) FILTER (WHERE "status" = 'queued')::int AS "queuedRunCount",
      COUNT(*) FILTER (WHERE "status" = 'blocked' AND "blocked_reason_code" = 'duplicate_subject_production_run')::int AS "duplicateBlockedRunCount",
      COUNT(*) FILTER (
        WHERE "status" = 'blocked'
          AND "blocked_reason_code" = 'duplicate_subject_production_run'
          AND COALESCE("open_total", 0) > 0
      )::int AS "duplicateBlockedOpenRunCount",
      MAX("updated_at") AS "latestRunUpdatedAt"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = 'math'
  `);
  const jobRows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE job."status" = 'queued')::int AS "queuedJobCount",
      COUNT(*) FILTER (WHERE job."status" = 'running')::int AS "runningJobCount",
      COUNT(*) FILTER (
        WHERE job."status" IN ('queued', 'running')
          AND COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') <> ''
      )::int AS "activeSchedulerHintJobCount",
      COUNT(*) FILTER (
        WHERE job."status" = 'failed'
          AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
          AND COALESCE(job."error", '') ~* ${`status=(${PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN})`}
      )::int AS "recentProviderFailureJobCount",
      COUNT(*) FILTER (
        WHERE job."status" = 'failed'
          AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
          AND COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') <> ''
          AND COALESCE(job."error", '') ~* ${`status=(${PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN})`}
      )::int AS "recentProviderFailureSchedulerHintJobCount",
      COUNT(*) FILTER (
        WHERE job."status" = 'failed'
          AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
          AND COALESCE(job."error", '') ~* 'status=provider_empty_output'
      )::int AS "recentProviderEmptyOutputJobCount",
      COUNT(*) FILTER (
        WHERE job."status" = 'succeeded'
          AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
      )::int AS "recentSucceededJobCount",
      MAX(job."updated_at") FILTER (
        WHERE job."status" = 'failed'
          AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
          AND COALESCE(job."error", '') ~* ${`status=(${PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN})`}
      ) AS "latestProviderFailureAt"
    FROM "csca_ai_generation_jobs" job
    JOIN "csca_question_blueprints" b ON b."id" = job."blueprint_id"
    WHERE b."subject" = 'math'
      AND COALESCE(job."prompt_metadata"->>'source', '') = 'subject_practice_production_matrix'
  `);
  const schedulerHintFailureRows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') AS "preferredFamily",
      CASE
        WHEN COALESCE(job."error", '') ~* 'status=([a-z0-9_]+)' THEN regexp_replace(COALESCE(job."error", ''), '^.*status=([a-z0-9_]+).*$' ,'\\1')
        WHEN COALESCE(job."error", '') = '' THEN 'unknown'
        ELSE left(regexp_replace(COALESCE(job."error", ''), '\\s+', ' ', 'g'), 80)
      END AS "errorCode",
      COUNT(*)::int AS "count",
      MAX(job."updated_at") AS "latestUpdatedAt"
    FROM "csca_ai_generation_jobs" job
    JOIN "csca_question_blueprints" b ON b."id" = job."blueprint_id"
    WHERE b."subject" = 'math'
      AND COALESCE(job."prompt_metadata"->>'source', '') = 'subject_practice_production_matrix'
      AND job."status" = 'failed'
      AND job."updated_at" >= NOW() - INTERVAL '30 minutes'
      AND COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') <> ''
      AND COALESCE(job."error", '') ~* ${`status=(${PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN})`}
    GROUP BY "preferredFamily", "errorCode"
    ORDER BY COUNT(*) DESC, MAX(job."updated_at") DESC
    LIMIT 8
  `);
  const schedulerHintDeliveryPressureRawRows = await prisma.$queryRaw(Prisma.sql`
    WITH failed_scheduler_jobs AS (
      SELECT
        COALESCE(job."prompt_metadata"->>'productionRunId', '') AS "productionRunId",
        COALESCE(job."prompt_metadata"->>'productionCellId', '') AS "productionCellId",
        COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') AS "preferredFamily",
        COALESCE(job."prompt_metadata"->'targetProfile'->>'questionForm', '') AS "targetProfileQuestionForm",
        COALESCE(job."prompt_metadata"->'targetProfile'->>'cognitiveSkill', '') AS "targetProfileCognitiveSkill",
        COALESCE(job."prompt_metadata"->'targetProfile'->>'calculationLoad', '') AS "targetProfileCalculationLoad",
        COALESCE(job."prompt_metadata"->'targetProfile'->>'difficultyBand', '') AS "targetProfileDifficulty",
        CASE
          WHEN COALESCE(job."error", '') ~* 'status=([a-z0-9_]+)' THEN regexp_replace(COALESCE(job."error", ''), '^.*status=([a-z0-9_]+).*$' ,'\\1')
          WHEN COALESCE(job."error", '') = '' THEN 'unknown'
          ELSE left(regexp_replace(COALESCE(job."error", ''), '\\s+', ' ', 'g'), 80)
        END AS "errorCode",
        job."updated_at" AS "updatedAt"
      FROM "csca_ai_generation_jobs" job
      JOIN "csca_question_blueprints" b ON b."id" = job."blueprint_id"
      WHERE b."subject" = 'math'
        AND COALESCE(job."prompt_metadata"->>'source', '') = 'subject_practice_production_matrix'
        AND job."status" = 'failed'
        AND job."updated_at" >= NOW() - INTERVAL '24 hours'
        AND COALESCE(job."prompt_metadata"->'repairFeedback'->'schedulerHint'->>'preferredFamily', '') <> ''
        AND COALESCE(job."error", '') ~* ${`status=(${PROVIDER_DELIVERY_FAILURE_STATUS_PATTERN})`}
    )
    SELECT
      "productionRunId",
      "productionCellId",
      COUNT(*)::int AS "deliveryFailureCount",
      COUNT(DISTINCT "preferredFamily")::int AS "distinctPreferredFamilyCount",
      ARRAY_AGG(DISTINCT "preferredFamily" ORDER BY "preferredFamily") AS "preferredFamilies",
      ARRAY_AGG(DISTINCT "errorCode" ORDER BY "errorCode") AS "errorCodes",
      MAX("updatedAt") AS "latestUpdatedAt",
      MAX("targetProfileQuestionForm") AS "targetProfileQuestionForm",
      MAX("targetProfileCognitiveSkill") AS "targetProfileCognitiveSkill",
      MAX("targetProfileCalculationLoad") AS "targetProfileCalculationLoad",
      MAX("targetProfileDifficulty") AS "targetProfileDifficulty"
    FROM failed_scheduler_jobs
    GROUP BY "productionRunId", "productionCellId"
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC, COUNT(DISTINCT "preferredFamily") DESC, MAX("updatedAt") DESC
    LIMIT 6
  `);
  const schedulerHintDeliveryPressureRows = schedulerHintDeliveryPressureRawRows.map((row) => {
    const questionForm = cleanText(row.targetProfileQuestionForm).toLowerCase();
    const calculationLoad = cleanText(row.targetProfileCalculationLoad).toLowerCase();
    const difficulty = cleanText(row.targetProfileDifficulty).toLowerCase();
    return {
      ...row,
      targetProfileConstraintPressure:
        difficulty === 'medium'
          && ['concept_judgement', 'concept_check', 'concept_identification'].includes(questionForm)
          && calculationLoad === 'heavy'
          ? 'math_medium_concept_judgement_heavy_calculation'
          : null
    };
  });
  const duplicateBlockedOpenRuns = await prisma.$queryRaw(Prisma.sql`
    SELECT
      "id",
      "status",
      "blocked_reason_code" AS "blockedReason",
      COALESCE("open_total", 0)::int AS "openTotal",
      "updated_at" AS "updatedAt"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = 'math'
      AND "status" = 'blocked'
      AND "blocked_reason_code" = 'duplicate_subject_production_run'
      AND COALESCE("open_total", 0) > 0
    ORDER BY "updated_at" DESC, "id" DESC
    LIMIT 5
  `);
  const chemistryProtectionRows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE job."status" = 'queued')::int AS "queuedJobCount",
      COUNT(*) FILTER (
        WHERE job."status" = 'running'
          AND COALESCE(NULLIF(job."prompt_metadata"->>'processingStartedAt', '')::timestamp, job."created_at") >= NOW() - INTERVAL '10 minutes'
      )::int AS "freshRunningJobCount",
      MAX(run."id")::int AS "latestActiveRunId"
    FROM "csca_subject_practice_production_runs" run
    LEFT JOIN "csca_ai_generation_jobs" job
      ON job."prompt_metadata"->>'productionRunId' = run."id"::text
     AND job."status" IN ('queued', 'running')
    WHERE run."subject" = 'chemistry'
      AND run."status" IN ('queued', 'running')
  `);
  const observationTaskRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE task."status" IN ('queued', 'running'))::int AS "activeObservationTaskCount",
           MAX(task."created_at") FILTER (
             WHERE NOT EXISTS (
               SELECT 1
               FROM "csca_ai_generation_jobs" local_pre_provider_job
               WHERE local_pre_provider_job."prompt_metadata"->>'observationTaskId' = task."id"::text
                 AND local_pre_provider_job."status" = 'failed'
                 AND (
                   local_pre_provider_job."provider" = 'prompt-budget-gate'
                   OR COALESCE(local_pre_provider_job."error", '') ~* 'observation_provider_cost_admission_failed'
                   OR COALESCE(local_pre_provider_job."error", '') ~* 'connect EACCES [^ ]+:443'
                 )
             )
           ) AS "latestObservationTaskCreatedAt"
    FROM "csca_ai_questioning_tasks" task
    WHERE task."task_type" = 'subject_practice_observation'
  `).catch(() => [{ activeObservationTaskCount: 0, latestObservationTaskCreatedAt: null }]);
  const observationJobRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE "status" IN ('queued', 'running'))::int AS "activeObservationJobCount",
           MAX("updated_at") FILTER (WHERE "status" IN ('queued', 'running')) AS "latestObservationJobUpdatedAt"
    FROM "csca_ai_generation_jobs"
    WHERE (
      "prompt_metadata"->>'workClass' = 'observation'
      OR NULLIF("prompt_metadata"->>'observationTaskId', '') IS NOT NULL
    )
  `).catch(() => [{ activeObservationJobCount: 0, latestObservationJobUpdatedAt: null }]);
  const observationDeliveryRows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      task."id",
      task."status",
      task."result"->>'deliveryFailure' AS "deliveryFailure",
      job."id" AS "generationJobId",
      CASE
        WHEN COALESCE(job."error", '') ~* 'status=([a-z0-9_]+)' THEN regexp_replace(COALESCE(job."error", ''), '^.*status=([a-z0-9_]+).*$' ,'\\1')
        WHEN COALESCE(job."error", '') = '' THEN NULL
        ELSE left(regexp_replace(COALESCE(job."error", ''), '\\s+', ' ', 'g'), 80)
      END AS "providerStatus",
      task."created_at" AS "createdAt",
      task."updated_at" AS "updatedAt"
    FROM "csca_ai_questioning_tasks" task
    LEFT JOIN "csca_ai_generation_jobs" job
      ON job."prompt_metadata"->>'observationTaskId' = task."id"::text
    WHERE task."task_type" = 'subject_practice_observation'
      AND task."subject" = 'math'
      AND task."action" = 'math_scheduler_v2'
      AND task."status" IN ('succeeded', 'failed', 'cancelled')
    ORDER BY task."created_at" DESC
    LIMIT 5
  `).catch(() => []);
  let observationNetworkFailureStreak = 0;
  let latestObservationNetworkFailureAt = null;
  for (const row of observationDeliveryRows) {
    const isProviderNetworkFailure = cleanText(row.status) === 'failed'
      && cleanText(row.deliveryFailure) === 'provider_error'
      && cleanText(row.providerStatus) === 'provider_network_error';
    if (!isProviderNetworkFailure) break;
    observationNetworkFailureStreak += 1;
    if (!latestObservationNetworkFailureAt) latestObservationNetworkFailureAt = row.updatedAt ?? row.createdAt ?? null;
  }
  const backgroundKeys = cleanText(process.env.DEEPSEEK_BACKGROUND_API_KEYS).split(/[\n,]/).filter(Boolean).length;
  const backgroundKeyConcurrency = Math.max(1, Number(process.env.DEEPSEEK_BACKGROUND_KEY_CONCURRENCY || process.env.DEEPSEEK_KEY_CONCURRENCY || 1));
  const observationCooldownMinutes = Math.max(1, Number(process.env.SUBJECT_PRACTICE_OBSERVATION_GLOBAL_COOLDOWN_MINUTES || 30));
  const latestObservationTaskCreatedAt = recordFrom(observationTaskRows[0]).latestObservationTaskCreatedAt ?? null;
  const latestObservationTaskCreatedAtMs = latestObservationTaskCreatedAt ? new Date(latestObservationTaskCreatedAt).getTime() : 0;
  const observationCooldownRemainingSeconds = Number.isFinite(latestObservationTaskCreatedAtMs) && latestObservationTaskCreatedAtMs > 0
    ? Math.max(0, Math.ceil((latestObservationTaskCreatedAtMs + observationCooldownMinutes * 60 * 1000 - Date.now()) / 1000))
    : 0;
  return {
    ...(recordFrom(runRows[0])),
    ...(recordFrom(jobRows[0])),
    recentProviderFailureSchedulerHints: schedulerHintFailureRows,
    schedulerHintDeliveryPressure: schedulerHintDeliveryPressureRows,
    duplicateBlockedOpenRuns,
    chemistryProtection: recordFrom(chemistryProtectionRows[0]),
    activeObservationTaskCount: Number(recordFrom(observationTaskRows[0]).activeObservationTaskCount) || 0,
    activeObservationJobCount: Number(recordFrom(observationJobRows[0]).activeObservationJobCount) || 0,
    latestObservationJobUpdatedAt: recordFrom(observationJobRows[0]).latestObservationJobUpdatedAt ?? null,
    observationNetworkFailureStreak,
    latestObservationNetworkFailureAt,
    recentObservationDeliveryOutcomes: observationDeliveryRows.map((row) => ({
      id: row.id,
      status: row.status,
      deliveryFailure: row.deliveryFailure,
      generationJobId: row.generationJobId,
      providerStatus: row.providerStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    observationAdmission: {
      taskEnabled: envFlagEnabled('SUBJECT_PRACTICE_OBSERVATION_TASK_ENABLED'),
      executionEnabled: envFlagEnabled('SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ENABLED'),
      singletonConfirmed: envFlagEnabled('SUBJECT_PRACTICE_OBSERVATION_SINGLETON_CONFIRMED'),
      observationOnlyMode: envFlagEnabled('SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE'),
      questionPlanEnabled: envFlagEnabled('CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED'),
      questionPlanFeatureFlag: 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED',
      questionPlanCellAllowlist: cleanText(process.env.CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST) || null,
      questionPlanCellAllowlistFlag: 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST',
      globalConcurrency: Number(process.env.AI_GATEWAY_GLOBAL_CONCURRENCY || 5),
      realtimeConcurrency: Number(process.env.AI_GATEWAY_REALTIME_CONCURRENCY || 3),
      backgroundConcurrency: Number(process.env.AI_GATEWAY_BACKGROUND_CONCURRENCY || 2),
      eligibleBackgroundKeySlots: backgroundKeys * backgroundKeyConcurrency,
      cooldownMinutes: observationCooldownMinutes,
      latestTaskCreatedAt: latestObservationTaskCreatedAt,
      cooldownRemainingSeconds: observationCooldownRemainingSeconds
    }
  };
}

async function chemistryRegressionTransientRefreshState(prisma, chemistryRegression) {
  const p0p1 = arrayFrom(recordFrom(recordFrom(chemistryRegression).evidence).p0p1).map(cleanText).filter(Boolean);
  const onlyStoredCountRefresh = p0p1.length > 0
    && p0p1.every((item) => item.startsWith('stored_active_job_count_needs_refresh'));
  if (!onlyStoredCountRefresh) {
    return {
      checked: false,
      onlyStoredCountRefresh,
      p0p1,
      protectedAfterRecheck: false,
      reason: p0p1.length ? 'chemistry_attention_not_limited_to_stored_count_refresh' : 'chemistry_attention_not_present'
    };
  }
  const [run] = await prisma.$queryRaw(Prisma.sql`
    SELECT "id", "status", "blocked_reason_code" AS "blockedReason"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = 'chemistry'
      AND "status" IN ('queued', 'running')
    ORDER BY "updated_at" DESC, "id" DESC
    LIMIT 1
  `);
  const runId = Number(recordFrom(run).id) || 0;
  if (!runId) {
    return {
      checked: true,
      onlyStoredCountRefresh,
      p0p1,
      protectedAfterRecheck: false,
      reason: 'no_active_chemistry_run_found'
    };
  }
  const mismatchRows = await prisma.$queryRaw(Prisma.sql`
    SELECT c."id",
           c."running_job_count" AS "storedRunning",
           COUNT(job."id") FILTER (WHERE job."status" = 'queued')::int AS "queued",
           COUNT(job."id") FILTER (
             WHERE job."status" = 'running'
               AND COALESCE(NULLIF(job."prompt_metadata"->>'processingStartedAt', '')::timestamp, job."created_at") >= NOW() - INTERVAL '10 minutes'
           )::int AS "activeRunning",
           COUNT(job."id") FILTER (
             WHERE job."status" = 'running'
               AND COALESCE(NULLIF(job."prompt_metadata"->>'processingStartedAt', '')::timestamp, job."created_at") < NOW() - INTERVAL '10 minutes'
           )::int AS "staleRunning"
    FROM "csca_subject_practice_production_cells" c
    LEFT JOIN "csca_ai_generation_jobs" job
      ON job."prompt_metadata"->>'productionRunId' = ${String(runId)}
     AND job."prompt_metadata"->>'productionCellId' = c."id"::text
     AND job."status" IN ('queued', 'running')
    WHERE c."run_id" = ${runId}
    GROUP BY c."id"
    HAVING c."running_job_count" <> (
        COUNT(job."id") FILTER (WHERE job."status" = 'queued')
        + COUNT(job."id") FILTER (
          WHERE job."status" = 'running'
            AND COALESCE(NULLIF(job."prompt_metadata"->>'processingStartedAt', '')::timestamp, job."created_at") >= NOW() - INTERVAL '10 minutes'
        )
      )
      OR COUNT(job."id") FILTER (
        WHERE job."status" = 'running'
          AND COALESCE(NULLIF(job."prompt_metadata"->>'processingStartedAt', '')::timestamp, job."created_at") < NOW() - INTERVAL '10 minutes'
      ) > 0
    ORDER BY c."id"
  `);
  const safeActiveUndercountRows = mismatchRows.filter((row) => {
    const record = recordFrom(row);
    const storedRunning = Number(record.storedRunning) || 0;
    const actualActive = (Number(record.queued) || 0) + (Number(record.activeRunning) || 0);
    const staleRunning = Number(record.staleRunning) || 0;
    return staleRunning === 0 && actualActive > storedRunning;
  });
  const safeActiveUndercount = mismatchRows.length > 0 && safeActiveUndercountRows.length === mismatchRows.length;
  const protectedAfterRecheck = !cleanText(recordFrom(run).blockedReason)
    && (mismatchRows.length === 0 || safeActiveUndercount);
  return {
    checked: true,
    onlyStoredCountRefresh,
    p0p1,
    runId,
    runStatus: cleanText(recordFrom(run).status),
    blockedReason: cleanText(recordFrom(run).blockedReason) || null,
    mismatchCount: mismatchRows.length,
    mismatchRows: mismatchRows.slice(0, 5),
    safeActiveUndercount,
    protectedAfterRecheck,
    reason: mismatchRows.length === 0
      ? 'transient_stored_count_refresh_verified_clear'
      : safeActiveUndercount
        ? 'stored_count_refresh_safe_active_undercount'
        : 'stored_count_refresh_still_visible'
  };
}

async function main() {
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Set it in the environment or project .env.');
  }
  const sample = positiveIntArg('sample', 40, 1, 50);
  const days = positiveIntArg('days', 30, 1, 60);
  const chemistryDays = positiveIntArg('chemistry-days', 1, 1, 60);
  const chemistryRun = cleanText(argValue('chemistry-run', ''));
  const qualityAuditLedger = cleanText(argValue('quality-audit-ledger', argValue('manual-review-ledger', '')));
  const json = hasFlag('json');
  const productionCellId = cleanText(argValue('cell', argValue('production-cell-id', '')));
  const readinessArgs = [
    path.resolve(__dirname, 'csca-subject-practice-diversity-readiness.cjs'),
    `--sample=${sample}`,
    `--days=${days}`,
    `--chemistry-days=${chemistryDays}`
  ];
  if (chemistryRun) readinessArgs.push(`--chemistry-run=${chemistryRun}`);
  if (qualityAuditLedger) readinessArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const readiness = runNodeJson(readinessArgs, 'three-subject diversity readiness');
  const auditArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--subject=math',
    `--sample=${sample}`,
    `--days=${days}`,
    '--json'
  ];
  if (qualityAuditLedger) auditArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const mathAudit = runNodeJson(auditArgs, 'math production audit');
  const prisma = new PrismaClient();
  try {
    const backendBaseUrl = observationBackendBaseUrl();
    const backendReadinessSkipped = backendBaseUrl && skipObservationBackendReadiness();
    let backendAdmission = null;
    let backendAdmissionError = null;
    if (backendBaseUrl && !backendReadinessSkipped) {
      try {
        backendAdmission = await loadObservationBackendAdmission(backendBaseUrl);
      } catch (error) {
        backendAdmissionError = error instanceof Error ? error.message : String(error);
      }
    }
    const runtimeState = await mathRuntimeState(prisma);
    const localObservationAdmission = recordFrom(runtimeState.observationAdmission);
    runtimeState.observationAdmission = backendAdmission
      ? mergeObservationAdmission(localObservationAdmission, backendAdmission)
      : {
          ...mergeObservationAdmission(localObservationAdmission, null),
          ...(backendBaseUrl
            ? {
                source: backendReadinessSkipped
                  ? 'target_backend_readiness_skipped'
                  : 'target_backend_readiness_unavailable',
                backendBaseUrl,
                backendReadinessLoaded: false,
                backendReadinessSkipped: Boolean(backendReadinessSkipped),
                backendReadinessError: backendAdmissionError,
                observationOnlyMode: false
              }
            : {})
        };
    const chemistry = subjectReadiness(readiness, 'chemistry');
    const math = subjectReadiness(readiness, 'math');
    const physics = subjectReadiness(readiness, 'physics');
    const mathFamilyVisibility = phaseByName(math, 'phase_1_family_visibility');
    const mathSoftCap = phaseByName(math, 'phase_2_math_soft_cap');
    const mathCandidateReplay = phaseByName(math, 'phase_2_math_candidate_replay_guardrail');
    const mathScheduler = phaseByName(math, 'phase_5_math_scheduler_hint');
    const mathSchedulerAdherence = phaseByName(math, 'phase_5_math_scheduler_hint_adherence');
    const mathNearDuplicate = phaseByName(math, 'phase_6_near_duplicate_fallback');
    const studentBoundary = phaseByName(math, 'student_consumable_current_policy_boundary');
    const chemistryRegression = phaseByName(chemistry, 'phase_3_chemistry_regression_protection');
    const physicsVisibility = phaseByName(physics, 'phase_4_physics_visibility');
    const physicsDifficultyWatch = phaseByName(physics, 'phase_4_physics_difficulty_watch');
    const recentFormalWindow = recordFrom(recordFrom(mathAudit).recentFormalWindow);
    const mathSoftCapDryRun = recordFrom(recentFormalWindow.mathSoftCapDryRun);
    const calibration = recordFrom(mathSoftCapDryRun.calibration);
    const candidateReplay = recordFrom(recentFormalWindow.candidateDiversityObservationReplay);
    const schedulerAdherence = recordFrom(recentFormalWindow.schedulerHintAdherence);
    const chemistryTransientRefreshState = await chemistryRegressionTransientRefreshState(prisma, chemistryRegression);
    const chemistryRegressionStatus = chemistryTransientRefreshState.protectedAfterRecheck
      ? 'protected'
      : cleanText(recordFrom(chemistryRegression).status);
    const failures = [];
    pushFailure(failures, cleanText(readiness.mode) === 'audit_only', 'readiness_not_audit_only', readiness.mode);
    pushFailure(failures, cleanText(readiness.productionImpact) === 'none_audit_only', 'readiness_has_production_impact', readiness.productionImpact);
    pushFailure(failures, chemistryRegressionStatus === 'protected', 'chemistry_regression_not_protected', recordFrom(chemistryRegression).status);
    pushFailure(failures, cleanText(recordFrom(mathSoftCap).status) === 'eligible_for_guarded_default_off_smoke', 'math_soft_cap_not_default_off_eligible', recordFrom(mathSoftCap).status);
    pushFailure(failures, calibration.productionFlagEnabled === false, 'math_soft_cap_flag_enabled', calibration.productionFlagEnabled);
    pushFailure(failures, Number(calibration.incrementalUnreviewedCount) === 0, 'math_incremental_samples_unreviewed', calibration.incrementalUnreviewedCount);
    pushFailure(failures, Number(candidateReplay.currentFlagRegenerateCount) === 0, 'math_candidate_replay_current_flag_regenerates', candidateReplay.currentFlagRegenerateCount);
    pushFailure(failures, ['ready_for_guarded_flag_smoke', 'observe_before_flag_enable'].includes(cleanText(recordFrom(mathCandidateReplay).status)), 'math_candidate_replay_guardrail_not_ready', recordFrom(mathCandidateReplay).status);
    pushFailure(failures, cleanText(recordFrom(mathScheduler).status) === 'audit_ready', 'math_scheduler_not_audit_ready', recordFrom(mathScheduler).status);
    pushFailure(failures, ['pending_observation', 'observing', 'needs_prompt_tuning'].includes(cleanText(recordFrom(mathSchedulerAdherence).status)), 'math_scheduler_adherence_not_observable', recordFrom(mathSchedulerAdherence).status);
    pushFailure(failures, cleanText(schedulerAdherence.productionImpact) === 'none_audit_only', 'scheduler_adherence_has_production_impact', schedulerAdherence.productionImpact);
    pushFailure(failures, cleanText(recordFrom(mathNearDuplicate).status) === 'audit_ready', 'math_near_duplicate_not_audit_ready', recordFrom(mathNearDuplicate).status);
    pushFailure(failures, !['needs_attention', 'missing_calibration', 'needs_classifier_work'].includes(cleanText(recordFrom(studentBoundary).status)), 'student_boundary_not_protected', recordFrom(studentBoundary).status);
    const waitReasons = [];
    const providerRecoveryState = providerRecoveryStateFor(runtimeState);
    if (Number(runtimeState.queuedRunCount) > 0) waitReasons.push('math_production_run_already_in_progress');
    if (Number(runtimeState.runningJobCount) > 0 || Number(runtimeState.queuedJobCount) > 0) waitReasons.push('math_generation_jobs_already_in_flight');
    const chemistryProtection = recordFrom(runtimeState.chemistryProtection);
    if (Number(runtimeState.activeObservationTaskCount) > 0) waitReasons.push('observation_task_already_active');
    if (Number(runtimeState.activeObservationJobCount) > 0) waitReasons.push('observation_job_already_active');
    const warnings = [];
    if (cleanText(recordFrom(physicsVisibility).status) !== 'ready') warnings.push('physics_visibility_not_ready');
    if (cleanText(recordFrom(mathFamilyVisibility).status) !== 'ready') warnings.push('math_family_visibility_not_ready_observation_evidence_gap');
    if (Number(runtimeState.runningRunCount) > 0) warnings.push('math_production_run_active_observation_targets_existing_run');
    const observationAdmission = recordFrom(runtimeState.observationAdmission);
    const observationOnlyMode = observationAdmission.observationOnlyMode === true;
    const questionPlanEnabled = observationAdmission.questionPlanEnabled === true;
    const questionPlanCellAllowed = productionCellId
      ? questionPlanCellAllowedFor(productionCellId, observationAdmission.questionPlanCellAllowlist)
      : false;
    const questionPlanReadyForTarget = questionPlanEnabled && questionPlanCellAllowed;
    const observationCooldownState = observationCooldownStateFor(observationAdmission);
    const observationNetworkRecoveryState = observationNetworkRecoveryStateFor(runtimeState);
    if (observationCooldownState.active) waitReasons.push('observation_task_cooldown');
    if (observationNetworkRecoveryState.active) waitReasons.push('provider_network_delivery_recovery');
    if (!observationAdmission.taskEnabled) warnings.push('observation_task_flag_disabled_submit_will_be_rejected');
    if (!observationAdmission.executionEnabled) warnings.push('observation_execution_flag_disabled_task_will_remain_queued');
    if (!observationAdmission.singletonConfirmed) warnings.push('single_backend_execution_not_confirmed');
    if (!observationOnlyMode) warnings.push('observation_only_mode_not_enabled_start_validation_backend_before_apply');
    if (!productionCellId) warnings.push('observation_question_plan_target_cell_missing');
    if (!questionPlanReadyForTarget) warnings.push('observation_question_plan_not_enabled_for_target_cell');
    if (backendBaseUrl && observationAdmission.backendReadinessSkipped) warnings.push('observation_backend_readiness_skipped');
    else if (backendBaseUrl && !observationAdmission.backendReadinessLoaded) warnings.push('observation_backend_readiness_unavailable');
    if (chemistryTransientRefreshState.protectedAfterRecheck) warnings.push('chemistry_stored_count_refresh_transient_verified_clear');
    if (chemistryTransientRefreshState.safeActiveUndercount) warnings.push('chemistry_stored_count_refresh_safe_active_undercount');
    if (Number(observationAdmission.backgroundConcurrency) < 2 || Number(observationAdmission.eligibleBackgroundKeySlots) < 2) warnings.push('observation_requires_two_background_and_key_slots');
    if (Number(observationAdmission.realtimeConcurrency) + Number(observationAdmission.backgroundConcurrency) > Number(observationAdmission.globalConcurrency)) warnings.push('gateway_child_capacity_exceeds_global_capacity');
    if (Number(chemistryProtection.freshRunningJobCount) > 0 || Number(chemistryProtection.queuedJobCount) > 0) warnings.push('chemistry_throughput_will_temporarily_share_one_background_slot');
    if (Number(runtimeState.recentProviderFailureSchedulerHintJobCount) > 0 || Number(runtimeState.recentProviderFailureJobCount) > 0) warnings.push('recent_provider_delivery_failures_remain_delivery_evidence_only');
    if (Number(runtimeState.observationNetworkFailureStreak) >= Number(observationNetworkRecoveryState.threshold)) warnings.push('provider_network_delivery_failure_streak_remains_delivery_evidence_only');
    if (Number(runtimeState.duplicateBlockedOpenRunCount) > 0) warnings.push('duplicate_blocked_math_runs_exist_review_before_creating_new_run');
    if (cleanText(schedulerAdherence.status) === 'needs_prompt_tuning') warnings.push('scheduler_hint_adherence_needs_prompt_tuning');
    if (arrayFrom(runtimeState.schedulerHintDeliveryPressure).some((item) => Number(item.distinctPreferredFamilyCount) >= 2)) {
      warnings.push('math_scheduler_hint_delivery_pressure_review_prompt_or_target_profile');
    }
    if (arrayFrom(runtimeState.schedulerHintDeliveryPressure).some((item) => cleanText(item.targetProfileConstraintPressure))) {
      warnings.push('math_target_profile_constraint_pressure_requires_normalization');
    }
    const hasActiveWorkWait = waitReasons.some((reason) => [
      'math_production_run_already_in_progress',
      'math_generation_jobs_already_in_flight',
      'observation_task_already_active',
      'observation_job_already_active'
    ].includes(reason));
    const hasCooldownWait = waitReasons.includes('observation_task_cooldown');
    const hasProviderNetworkRecoveryWait = waitReasons.includes('provider_network_delivery_recovery');
    const status = failures.length
      ? 'failed'
      : hasActiveWorkWait
        ? 'wait_for_existing_observation_or_math_work'
        : hasProviderNetworkRecoveryWait
          ? 'wait_for_provider_network_recovery'
        : hasCooldownWait
          ? 'wait_for_observation_cooldown'
        : observationOnlyMode && questionPlanReadyForTarget
          ? 'eligible_for_backend_owned_observation_submission'
        : !observationOnlyMode && !questionPlanReadyForTarget
          ? 'ready_after_observation_only_question_plan_backend_start'
        : observationOnlyMode
          ? 'ready_after_observation_question_plan_backend_start'
          : 'ready_after_observation_only_backend_start';
    const report = {
      mode: 'read_only_preflight',
      subject: 'math',
      status,
      recommendation: status === 'eligible_for_backend_owned_observation_submission'
        ? 'Submit one durable backend-owned math observation task. It shares the backend FIFO gateway and may temporarily reduce chemistry/background throughput by one slot.'
        : status === 'ready_after_observation_only_question_plan_backend_start'
          ? `Start or point the CLI at an observation-only backend with CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED=true and CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST including ${productionCellId || '<target-cell>'} before submitting the durable observation task.`
        : status === 'ready_after_observation_question_plan_backend_start'
          ? `Start or point the CLI at an observation backend with CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED=true and CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST including ${productionCellId || '<target-cell>'} before submitting the durable observation task.`
        : status === 'ready_after_observation_only_backend_start'
          ? 'Start or point the CLI at a backend with SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE=true before submitting the durable observation task.'
        : status === 'wait_for_existing_observation_or_math_work'
          ? 'Wait for the active observation or math work to settle before submitting another task.'
        : status === 'wait_for_observation_cooldown'
          ? 'Wait for the observation cooldown to clear before submitting another explicitly authorized task.'
        : status === 'wait_for_provider_network_recovery'
          ? 'Wait for provider network delivery recovery after consecutive observation network failures before submitting another live task.'
          : 'Do not start a math observation run until the listed failures are cleared.',
      productionImpact: 'bounded_one_background_slot_backend_owned',
      featureFlag: 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED',
      productionFlagEnabled: calibration.productionFlagEnabled === true,
      providerFailurePolicy: 'excluded_from_diversity_quality_memory',
      providerRecoveryPolicy: 'provider_failures_are_delivery_evidence_and_do_not_block_durable_submission_or_family_memory',
      schedulerHintProviderFailurePolicy: 'scheduler_hints_on_failed_provider_jobs_are_delivery_evidence_not_adherence_or_family_quality',
      providerRecoveryState,
      observationCooldownState,
      observationNetworkRecoveryState,
      observationBackendReadiness: {
        baseUrl: backendBaseUrl || null,
        source: observationAdmission.source || 'local_database_and_cli_env',
        loaded: observationAdmission.backendReadinessLoaded === true,
        error: observationAdmission.backendReadinessError || null,
        reasons: arrayFrom(observationAdmission.backendReasons),
        productionCellId: productionCellId || null,
        questionPlanEnabled,
        questionPlanCellAllowed,
        questionPlanReadyForTarget,
        questionPlanFeatureFlag: observationAdmission.questionPlanFeatureFlag || 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED',
        questionPlanCellAllowlist: observationAdmission.questionPlanCellAllowlist || null,
        questionPlanCellAllowlistFlag: observationAdmission.questionPlanCellAllowlistFlag || 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST'
      },
      waitReasons,
      warnings,
      runtimeState,
      chemistryTransientRefreshState,
      evidence: {
        readinessStatus: readiness.status,
        mathStatus: recordFrom(math).status,
        chemistryRegressionStatus,
        chemistryRegressionOriginalStatus: recordFrom(chemistryRegression).status,
        physicsVisibilityStatus: recordFrom(physicsVisibility).status,
        physicsDifficultyWatchStatus: recordFrom(physicsDifficultyWatch).status ?? null,
        physicsDifficultyFindingCount: Number(recordFrom(recordFrom(physicsDifficultyWatch).evidence).difficultyFindingCount) || 0,
        mathFamilyVisibilityStatus: recordFrom(mathFamilyVisibility).status,
        mathSoftCapStatus: recordFrom(mathSoftCap).status,
        mathCandidateReplayStatus: recordFrom(mathCandidateReplay).status,
        mathSchedulerStatus: recordFrom(mathScheduler).status,
        mathSchedulerAdherenceStatus: recordFrom(mathSchedulerAdherence).status,
        mathNearDuplicateStatus: recordFrom(mathNearDuplicate).status,
        studentBoundaryStatus: recordFrom(studentBoundary).status,
        candidateReplayWouldRegenerateIfFlagEnabledCount: Number(candidateReplay.wouldRegenerateIfFlagEnabledCount) || 0,
        candidateReplayCurrentFlagRegenerateCount: Number(candidateReplay.currentFlagRegenerateCount) || 0,
        schedulerCurrentPolicyVersion: cleanText(schedulerAdherence.currentSchedulerPolicyVersion) || null,
        schedulerTotalHintedCandidateCount: Number(schedulerAdherence.totalHintedCandidateCount) || Number(schedulerAdherence.hintedCandidateCount) || 0,
        schedulerHintedCandidateCount: Number(schedulerAdherence.hintedCandidateCount) || 0,
        schedulerLegacyHintedCandidateCount: Number(schedulerAdherence.legacyHintedCandidateCount) || 0,
        schedulerPreferredMatchRatio: Number(schedulerAdherence.preferredMatchRatio) || 0,
        schedulerAvoidedFamilyHitRatio: Number(schedulerAdherence.avoidedFamilyHitRatio) || 0,
        incrementalUnreviewedCount: Number(calibration.incrementalUnreviewedCount) || 0
      },
      failures
    };
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Math diversity observation preflight: ${report.status}`);
      console.log(`- readiness=${report.evidence.readinessStatus}, flagEnabled=${report.productionFlagEnabled}, productionImpact=${report.productionImpact}`);
      console.log(`- chemistry=${report.evidence.chemistryRegressionStatus}, physics=${report.evidence.physicsVisibilityStatus}, physicsDifficultyWatch=${report.evidence.physicsDifficultyWatchStatus || 'n/a'}(${report.evidence.physicsDifficultyFindingCount}), studentBoundary=${report.evidence.studentBoundaryStatus}`);
      console.log(`- candidateReplay=${report.evidence.mathCandidateReplayStatus}, wouldRegenerateIfFlagEnabled=${report.evidence.candidateReplayWouldRegenerateIfFlagEnabledCount}, currentFlagRegenerate=${report.evidence.candidateReplayCurrentFlagRegenerateCount}`);
      console.log(`- scheduler=${report.evidence.mathSchedulerStatus}, adherence=${report.evidence.mathSchedulerAdherenceStatus}, currentPolicy=${report.evidence.schedulerCurrentPolicyVersion || 'n/a'}, hinted=${report.evidence.schedulerHintedCandidateCount}/${report.evidence.schedulerTotalHintedCandidateCount}, legacy=${report.evidence.schedulerLegacyHintedCandidateCount}, preferredMatchRatio=${report.evidence.schedulerPreferredMatchRatio}, avoidHitRatio=${report.evidence.schedulerAvoidedFamilyHitRatio}`);
      console.log(`- providerRecovery: recentFailures=${Number(runtimeState.recentProviderFailureJobCount) || 0}, hintedFailures=${Number(runtimeState.recentProviderFailureSchedulerHintJobCount) || 0}, emptyOutput=${Number(runtimeState.recentProviderEmptyOutputJobCount) || 0}, recentSucceeded=${Number(runtimeState.recentSucceededJobCount) || 0}, latestFailure=${runtimeState.latestProviderFailureAt ?? 'n/a'}, eligibleAfter=${providerRecoveryState.eligibleAfter ?? 'n/a'}, remainingSeconds=${providerRecoveryState.remainingSeconds}`);
      console.log(`- observationCooldown: active=${observationCooldownState.active}, latestTask=${observationCooldownState.latestTaskCreatedAt ?? 'n/a'}, eligibleAfter=${observationCooldownState.eligibleAfter ?? 'n/a'}, remainingSeconds=${observationCooldownState.remainingSeconds}`);
      console.log(`- chemistryCapacity: run=${chemistryProtection.latestActiveRunId ?? 'n/a'}, freshRunning=${Number(chemistryProtection.freshRunningJobCount) || 0}, queued=${Number(chemistryProtection.queuedJobCount) || 0}`);
      console.log(`- observationAdmission: active=${Number(runtimeState.activeObservationTaskCount) || 0}, activeJobs=${Number(runtimeState.activeObservationJobCount) || 0}, observationOnlyMode=${observationOnlyMode}, cooldownRemainingSeconds=${Number(recordFrom(runtimeState.observationAdmission).cooldownRemainingSeconds) || 0}`);
      if (backendBaseUrl) {
        console.log(`  - backend readiness: baseUrl=${backendBaseUrl}, loaded=${observationAdmission.backendReadinessLoaded === true}, source=${observationAdmission.source || 'n/a'}, reasons=${arrayFrom(observationAdmission.backendReasons).join(',') || 'none'}`);
      }
      if (arrayFrom(runtimeState.recentProviderFailureSchedulerHints).length) {
        console.log(`  - hinted provider failures: ${arrayFrom(runtimeState.recentProviderFailureSchedulerHints).map((item) => `${item.preferredFamily || 'unknown'}/${item.errorCode}:${item.count}`).join(', ')}`);
      }
      if (arrayFrom(runtimeState.schedulerHintDeliveryPressure).length) {
        console.log(`  - scheduler delivery pressure: ${arrayFrom(runtimeState.schedulerHintDeliveryPressure).map((item) => `run#${item.productionRunId}/cell#${item.productionCellId}:failures=${item.deliveryFailureCount},families=${arrayFrom(item.preferredFamilies).join('|')},errors=${arrayFrom(item.errorCodes).join('|')},profilePressure=${item.targetProfileConstraintPressure || 'none'}`).join('; ')}`);
      }
      if (arrayFrom(runtimeState.duplicateBlockedOpenRuns).length) {
        console.log(`  - duplicate blocked open runs: ${arrayFrom(runtimeState.duplicateBlockedOpenRuns).map((run) => `#${run.id}(open=${run.openTotal}, updated=${run.updatedAt})`).join(', ')}`);
      }
      if (waitReasons.length) console.log(`- wait: ${waitReasons.join(', ')}`);
      if (warnings.length) console.log(`- warnings: ${warnings.join(', ')}`);
      if (failures.length) {
        console.log('Failures');
        for (const failure of failures) console.log(`- ${failure.code}: ${JSON.stringify(failure.detail)}`);
      }
    }
    if (failures.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
