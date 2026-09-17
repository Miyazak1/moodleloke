#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  argsFrom,
  batchIdFrom,
  outputPathFrom,
  loadDatabaseUrl,
  scoreCapturedBatch
} = require('./csca-subject-practice-observation-batch-export.cjs');
const {
  bindSubjectPracticeObservationBatchQualificationEvidence,
  subjectPracticeObservationCandidateEvidenceBatchId
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-qualification-policy');
const {
  createSubjectPracticeProductionShadowExporterAttestation
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  buildSubjectPracticeProductionShadowEvidenceBatch,
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-trusted-exporter');
const { report: qualificationPolicySelfTest } = require('./csca-subject-practice-observation-batch-qualification-self-test.cjs');

const EXPORT_MODE = 'subject_practice_observation_batch_qualification_read_only_export_v1';
const SECRET_ENV = 'CSCA_PRODUCTION_SHADOW_EXPORTER_HMAC_SECRET';

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function projectEnvValue(name, workspaceRoot = process.cwd()) {
  const existing = String(process.env[name] ?? '').trim();
  if (existing) return existing;
  const envPath = resolve(workspaceRoot, '.env');
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));
  if (!line) return '';
  const value = line.slice(name.length + 1).trim().replace(/^"|"$/g, '');
  if (value) process.env[name] = value;
  return value;
}

function exactPlanKey(task) {
  return `${String(task.subject).trim().toLowerCase()}:${String(task.taskFamily).trim().toLowerCase()}:${String(task.planTemplate).trim().toLowerCase()}`;
}

function taskOrdinal(row) {
  return Number(recordFrom(recordFrom(row.filterSnapshot).sealedObservationBatch).taskOrdinal);
}

function candidateIdsFromTaskRows(rows) {
  const ids = rows.map((row) => Number(recordFrom(row.result).generatedQuestionId))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (new Set(ids).size !== ids.length) throw new Error('observation_batch_qualification_export_candidate_id_reused');
  return ids.sort((left, right) => left - right);
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalJsonValue(value));
}

function verifyQualificationArtifact(input) {
  const artifact = recordFrom(input?.artifact);
  const secret = String(input?.secret ?? projectEnvValue(SECRET_ENV)).trim();
  if (secret.length < 32) throw new Error('observation_batch_qualification_artifact_hmac_secret_missing_or_too_short');
  const taskReadModels = Array.isArray(artifact.taskReadModels) ? artifact.taskReadModels : [];
  const signedCandidateEvidence = Array.isArray(artifact.signedCandidateEvidence)
    ? artifact.signedCandidateEvidence
    : [];
  const recomputedQualification = bindSubjectPracticeObservationBatchQualificationEvidence({
    manifest: artifact.manifest,
    tasks: taskReadModels,
    signedCandidateEvidence,
    exporterHmacSecret: secret
  });
  const derivedCandidateIds = candidateIdsFromTaskRows(taskReadModels);
  const checks = {
    modeMatched: artifact.mode === EXPORT_MODE,
    batchIdentityMatched: String(artifact.batchId ?? '') === recomputedQualification.observationBatchId,
    candidateIdsDerivedOnlyFromTasks:
      stableJson(derivedCandidateIds) === stableJson(artifact.candidateIdsDerivedFromTasks),
    storedQualificationMatchedRecomputation:
      stableJson(recomputedQualification) === stableJson(artifact.qualification),
    hmacQualificationReady: recomputedQualification.readyForFamilyQualification === true,
    hmacSecretNotSerialized: artifact.hmacSecretSerialized === false
      && !stableJson(artifact).includes(secret),
    declaredReadOnlyImpact: artifact.providerImpact === 'none_no_provider_call'
      && artifact.databaseImpact === 'single_read_only_repeatable_read_transaction'
      && artifact.publicationImpact === 'none_no_publication_write'
  };
  const status = Object.values(checks).every(Boolean)
    ? 'verified_trusted_complete_batch_qualification_artifact'
    : 'invalid_or_nonqualifying_artifact';
  return {
    status,
    verified: status === 'verified_trusted_complete_batch_qualification_artifact',
    checks,
    batchId: recomputedQualification.observationBatchId,
    manifestSha256: recomputedQualification.observationManifestSha256,
    qualification: recomputedQualification,
    candidateIds: derivedCandidateIds,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_artifact_only',
    publicationImpact: 'none_no_publication_write'
  };
}

function preflight(input = {}) {
  const selectedBatchId = input.batchId ? batchIdFrom(input.batchId) : null;
  const secret = projectEnvValue(SECRET_ENV);
  return {
    mode: EXPORT_MODE,
    status: secret.length >= 32
      ? 'ready_for_explicit_read_only_execution'
      : 'blocked_exporter_hmac_secret_missing_or_too_short',
    selectedBatchId,
    databaseSelectionBoundary: 'sealed_batch_id_only',
    candidateSelectionBoundary: 'candidate_ids_derived_exclusively_from_all_sealed_task_results',
    transactionMode: 'single_repeatable_read_read_only_transaction_for_tasks_and_questions',
    contentEvidence: 'hmac_attested_persisted_question_read_model',
    taskToContentBinding: 'exact_candidate_id_set_scope_and_gate_outcome',
    outputPolicy: 'new_json_file_inside_workspace_no_overwrite',
    hmacSecretEnvironmentVariable: SECRET_ENV,
    hmacSecretConfigured: secret.length >= 32,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'read_only_when_executed',
    publicationImpact: 'none_no_publication_write'
  };
}

function signedCandidateEvidenceFromCapture(input) {
  const rowByOrdinal = new Map(input.taskRows.map((row) => [taskOrdinal(row), row]));
  const questionById = new Map(input.questionRows.map((row) => [Number(row.id), row]));
  const manifestGroups = new Map();
  for (const descriptor of input.manifest.tasks) {
    const row = rowByOrdinal.get(descriptor.ordinal);
    const candidateId = Number(recordFrom(row?.result).generatedQuestionId);
    if (!Number.isInteger(candidateId) || candidateId <= 0) continue;
    const key = exactPlanKey(descriptor);
    const ids = manifestGroups.get(key) ?? [];
    ids.push(candidateId);
    manifestGroups.set(key, ids);
  }
  return Array.from(manifestGroups.entries()).map(([key, candidateIds]) => {
    const snapshots = candidateIds.map((candidateId) => {
      const row = questionById.get(candidateId);
      if (!row) throw new Error(`observation_batch_qualification_export_candidate_missing:${candidateId}`);
      return subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
        row,
        transactionSnapshotId: input.transactionSnapshotId
      });
    });
    const batch = buildSubjectPracticeProductionShadowEvidenceBatch({
      batchId: subjectPracticeObservationCandidateEvidenceBatchId({
        observationBatchId: input.observationBatchId,
        exactPlanKey: key
      }),
      generatedAt: input.exportedAt,
      snapshots
    });
    const attestation = createSubjectPracticeProductionShadowExporterAttestation({
      batch,
      exporterId: EXPORT_MODE,
      issuedAt: input.exportedAt,
      secret: input.secret
    });
    return { exactPlanKey: key, batch, attestation };
  });
}

async function execute(input) {
  const batchId = batchIdFrom(input.batchId);
  const outputPath = outputPathFrom(input.out);
  if (!loadDatabaseUrl()) throw new Error('observation_batch_qualification_export_database_url_missing');
  const secret = projectEnvValue(SECRET_ENV);
  if (secret.length < 32) throw new Error('observation_batch_qualification_export_hmac_secret_missing_or_too_short');
  const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const captured = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [snapshot] = await tx.$queryRaw`SELECT txid_current_snapshot()::text AS "transactionSnapshotId"`;
      const taskRows = await tx.$queryRaw(Prisma.sql`
        SELECT task."id"::text AS "id", task."subject", task."resource_type" AS "resourceType",
               task."resource_id" AS "resourceId", task."filter_snapshot" AS "filterSnapshot",
               task."status", task."requested", task."succeeded", task."skipped", task."failed",
               task."result", task."error"
        FROM "csca_ai_questioning_tasks" task
        WHERE task."task_type" = 'subject_practice_observation'
          AND task."filter_snapshot"->'sealedObservationBatch'->>'batchId' = ${batchId}
        ORDER BY (task."filter_snapshot"->'sealedObservationBatch'->>'taskOrdinal')::int ASC,
                 task."id" ASC
      `);
      const { manifest } = scoreCapturedBatch({ batchId, rows: taskRows });
      const candidateIds = candidateIdsFromTaskRows(taskRows);
      let questionRows = [];
      if (candidateIds.length > 0) {
        questionRows = await tx.$queryRaw(Prisma.sql`
          SELECT q."id", q."subject", q."source_type" AS "sourceType", q."prompt", q."options",
                 q."correct_answer" AS "correctAnswer", q."explanation",
                 q."generation_metadata"->'localizations' AS "localizations",
                 q."created_at" AS "createdAt", q."generation_metadata" AS "generationMetadata",
                 q."review_metadata" AS "reviewMetadata",
                 (SELECT COUNT(*)::int FROM "csca_question_exposures" exposure
                    WHERE exposure."question_id" = q."id") AS "studentPublicationCount",
                 ((CASE WHEN q."status" IN ('approved', 'published') THEN 1 ELSE 0 END)
                   + (SELECT COUNT(*)::int FROM "csca_adaptive_round_items" item
                        WHERE item."question_source" = 'csca_question' AND item."question_id" = q."id"))::int
                   AS "publicationAttemptCount"
          FROM "csca_questions" q
          WHERE q."id" IN (${Prisma.join(candidateIds)})
          ORDER BY q."id" ASC
        `);
      }
      const foundIds = new Set(questionRows.map((row) => Number(row.id)));
      const missingIds = candidateIds.filter((candidateId) => !foundIds.has(candidateId));
      if (missingIds.length) {
        throw new Error(`observation_batch_qualification_export_candidates_missing:${missingIds.join(',')}`);
      }
      return {
        transactionSnapshotId: String(snapshot?.transactionSnapshotId ?? ''),
        manifest,
        taskRows,
        questionRows,
        candidateIds
      };
    }, { isolationLevel: 'RepeatableRead' });
    const exportedAt = new Date().toISOString();
    const signedCandidateEvidence = signedCandidateEvidenceFromCapture({
      observationBatchId: batchId,
      manifest: captured.manifest,
      taskRows: captured.taskRows,
      questionRows: captured.questionRows,
      transactionSnapshotId: captured.transactionSnapshotId,
      exportedAt,
      secret
    });
    const qualification = bindSubjectPracticeObservationBatchQualificationEvidence({
      manifest: captured.manifest,
      tasks: captured.taskRows,
      signedCandidateEvidence,
      exporterHmacSecret: secret
    });
    const artifact = {
      mode: EXPORT_MODE,
      exportedAt,
      batchId,
      transactionSnapshotId: captured.transactionSnapshotId,
      manifest: captured.manifest,
      taskReadModels: captured.taskRows,
      candidateIdsDerivedFromTasks: captured.candidateIds,
      signedCandidateEvidence,
      qualification,
      hmacSecretSerialized: false,
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'single_read_only_repeatable_read_transaction',
      publicationImpact: 'none_no_publication_write'
    };
    if (JSON.stringify(artifact).includes(secret)) {
      throw new Error('observation_batch_qualification_export_secret_serialization_detected');
    }
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { ...artifact, outputPath };
  } finally {
    await prisma.$disconnect();
  }
}

function selfTest() {
  const rows = [
    { result: { generatedQuestionId: 3 } },
    { result: { generatedQuestionId: null } },
    { result: { generatedQuestionId: 1 } }
  ];
  const checks = {};
  checks.policyBridgeSelfTestPassed = qualificationPolicySelfTest.status === 'passed';
  checks.candidateIdsDerivedFromTasks = JSON.stringify(candidateIdsFromTaskRows(rows)) === JSON.stringify([1, 3]);
  try {
    candidateIdsFromTaskRows([{ result: { generatedQuestionId: 3 } }, { result: { generatedQuestionId: 3 } }]);
    checks.duplicateCandidateReuseRejected = false;
  } catch { checks.duplicateCandidateReuseRejected = true; }
  try { outputPathFrom('../outside.json'); checks.pathEscapeRejected = false; } catch { checks.pathEscapeRejected = true; }
  checks.noCandidateWhitelistArgument = !Object.keys(preflight()).some((key) => /candidateIds/i.test(key));
  const report = {
    mode: `${EXPORT_MODE}_self_test`,
    reportVersion: 'subject-practice-observation-batch-qualification-read-only-export-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    preflight: preflight(),
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
  return report;
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['candidate-ids']) {
    throw new Error('observation_batch_qualification_export_candidate_id_selection_forbidden');
  }
  if (args['self-test']) return selfTest();
  if (!args.execute) return preflight({ batchId: args['batch-id'] });
  return execute({ batchId: args['batch-id'], out: args.out });
}

if (require.main === module) {
  main().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
    if (process.argv.includes('--require-qualified')
      && report.qualification?.readyForFamilyQualification !== true) process.exitCode = 2;
  }).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPORT_MODE,
  projectEnvValue,
  candidateIdsFromTaskRows,
  preflight,
  signedCandidateEvidenceFromCapture,
  verifyQualificationArtifact,
  execute,
  selfTest
};
