#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve, relative, isAbsolute, sep } = require('node:path');
const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  subjectPracticeObservationExpectedGeneratorVersionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  scoreSubjectPracticeObservationBatchEvidence
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-evidence-policy');

const EXPORT_MODE = 'subject_practice_observation_batch_read_only_export_v1';

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function loadDatabaseUrl(workspaceRoot = process.cwd()) {
  if (String(process.env.DATABASE_URL ?? '').trim()) return true;
  const envPath = resolve(workspaceRoot, '.env');
  if (!existsSync(envPath)) return false;
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/)
    .find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return false;
  const value = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
  if (!value) return false;
  process.env.DATABASE_URL = value;
  return true;
}

function batchIdFrom(value) {
  const batchId = String(value ?? '').trim().toLowerCase();
  if (!/^local-shadow-[a-f0-9]{20}$/.test(batchId)) {
    throw new Error('observation_batch_export_valid_batch_id_required');
  }
  return batchId;
}

function outputPathFrom(value, workspaceRoot = process.cwd()) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('observation_batch_export_output_path_required');
  const root = resolve(workspaceRoot);
  const target = resolve(root, raw);
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error('observation_batch_export_output_must_be_new_file_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) {
    throw new Error('observation_batch_export_output_must_be_json');
  }
  if (existsSync(target)) throw new Error('observation_batch_export_refuses_to_overwrite');
  return target;
}

function manifestFromCapturedRows(rows, selectedBatchId) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error('observation_batch_export_batch_not_found');
  }
  const sealed = recordFrom(recordFrom(rows[0].filterSnapshot).sealedObservationBatch);
  const manifest = sealed.manifest;
  const expected = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
  if (expected.batchId !== selectedBatchId) {
    throw new Error('observation_batch_export_selector_manifest_binding_invalid');
  }
  return expected.manifest;
}

function scoreCapturedBatch(input) {
  const batchId = batchIdFrom(input.batchId);
  const manifest = manifestFromCapturedRows(input.rows, batchId);
  const score = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: input.rows });
  if (!score.complete) {
    throw new Error(`observation_batch_export_incomplete_or_invalid:${score.reasons.join(',')}`);
  }
  if (score.batchId !== batchId) {
    throw new Error('observation_batch_export_score_batch_binding_invalid');
  }
  return { manifest, score };
}

function preflight(input = {}) {
  let selectedBatchId = null;
  if (input.batchId) selectedBatchId = batchIdFrom(input.batchId);
  return {
    mode: EXPORT_MODE,
    status: 'preflight_only_no_database_connection',
    selectedBatchId,
    selectionBoundary: 'sealed_batch_id_only_candidate_ids_not_accepted',
    completenessBoundary: 'all_manifest_ordinals_must_be_terminal_and_valid',
    denominatorPolicy: 'failed_cancelled_and_no_candidate_tasks_are_retained',
    transactionMode: 'repeatable_read_read_only',
    outputPolicy: 'new_json_file_inside_workspace_no_overwrite',
    executeRequiredForDatabaseRead: true,
    providerImpact: 'none_no_provider_call',
    mutationImpact: 'none_read_only_database_transaction_when_executed',
    publicationImpact: 'none_no_candidate_or_student_publication_write'
  };
}

async function execute(input) {
  const batchId = batchIdFrom(input.batchId);
  const outputPath = outputPathFrom(input.out);
  if (!loadDatabaseUrl()) throw new Error('observation_batch_export_database_url_missing');
  const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const captured = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [snapshot] = await tx.$queryRaw`SELECT txid_current_snapshot()::text AS "transactionSnapshotId"`;
      const rows = await tx.$queryRaw(Prisma.sql`
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
      return {
        transactionSnapshotId: String(snapshot?.transactionSnapshotId ?? ''),
        rows
      };
    }, { isolationLevel: 'RepeatableRead' });
    const { manifest, score } = scoreCapturedBatch({ batchId, rows: captured.rows });
    const exportedAt = new Date().toISOString();
    const artifact = {
      mode: EXPORT_MODE,
      exportedAt,
      batchId,
      transactionSnapshotId: captured.transactionSnapshotId,
      manifest,
      taskReadModels: captured.rows,
      score,
      selectionBiasControls: {
        databaseSelector: 'batch_id_only',
        candidateIdsAcceptedAsInput: false,
        allManifestOrdinalsRequired: true,
        terminalFailuresRemainInDenominator: true
      },
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only_repeatable_read_transaction',
      publicationImpact: 'none_no_publication_write'
    };
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { ...artifact, outputPath };
  } finally {
    await prisma.$disconnect();
  }
}

function selfTest() {
  const manifest = buildSubjectPracticeObservationBatchManifest([{
    ordinal: 1,
    subject: 'math',
    productionRunId: 1,
    productionCellId: 16,
    taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1',
    plannedScopeId: 'math-basic-elementary-rotation-v1:power:function_value'
  }]);
  const envelope = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
  const task = {
    id: '00000000-0000-0000-0000-000000000001',
    subject: 'math',
    resourceType: 'production_run',
    resourceId: '1',
    filterSnapshot: {
      productionCellId: 16,
      requestedTaskFamily: 'elementary_function_direct_property',
      requestedPlanTemplate: 'math_elementary_function_relation_v1',
      sealedObservationBatch: envelope
    },
    status: 'succeeded',
    requested: 1,
    succeeded: 1,
    skipped: 0,
    failed: 0,
    error: null,
    result: {
      generatedQuestionId: 101,
      gateDecision: 'publishable',
      plannedTaskFamily: 'elementary_function_direct_property',
      classifiedTaskFamily: 'elementary_function_direct_property',
      observedPlanTemplate: 'math_elementary_function_relation_v1',
      observedScopeId: 'math-basic-elementary-rotation-v1:power:function_value',
      generatorProvider: 'local-deterministic',
      generatorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(manifest.tasks[0]),
      providerAttemptLimit: 0,
      automatedCandidateLeakageGate: {
        status: 'clear',
        scannedRevisionCount: 1,
        blockedRevisionCount: 0,
        ambiguousRevisionCount: 0,
        failClosed: true,
        sourceContentExposedToGenerator: false
      }
    }
  };
  const checks = {};
  checks.completeBatchPasses = scoreCapturedBatch({ batchId: envelope.batchId, rows: [task] }).score.complete === true;
  try { scoreCapturedBatch({ batchId: envelope.batchId, rows: [] }); checks.missingTaskRejected = false; } catch { checks.missingTaskRejected = true; }
  try {
    scoreCapturedBatch({ batchId: envelope.batchId, rows: [{ ...task, status: 'running' }] });
    checks.nonTerminalTaskRejected = false;
  } catch { checks.nonTerminalTaskRejected = true; }
  try {
    scoreCapturedBatch({ batchId: 'local-shadow-00000000000000000000', rows: [task] });
    checks.selectorManifestMismatchRejected = false;
  } catch { checks.selectorManifestMismatchRejected = true; }
  try { outputPathFrom('../outside.json'); checks.pathEscapeRejected = false; } catch { checks.pathEscapeRejected = true; }
  checks.preflightRejectsCandidateIdSelection = preflight({ batchId: envelope.batchId }).selectionBoundary
    === 'sealed_batch_id_only_candidate_ids_not_accepted';
  const report = {
    mode: `${EXPORT_MODE}_self_test`,
    reportVersion: 'subject-practice-observation-batch-read-only-export-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    preflight: preflight({ batchId: envelope.batchId }),
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_self_test_does_not_construct_prisma_client',
    productionImpact: 'none_no_output_written'
  };
  return report;
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['candidate-ids']) throw new Error('observation_batch_export_candidate_id_selection_forbidden');
  if (args['self-test']) return selfTest();
  if (!args.execute) return preflight({ batchId: args['batch-id'] });
  return execute({ batchId: args['batch-id'], out: args.out });
}

if (require.main === module) {
  main().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPORT_MODE,
  argsFrom,
  loadDatabaseUrl,
  batchIdFrom,
  outputPathFrom,
  manifestFromCapturedRows,
  scoreCapturedBatch,
  preflight,
  execute,
  selfTest
};
