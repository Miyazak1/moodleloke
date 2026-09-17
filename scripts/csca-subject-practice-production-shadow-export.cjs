#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { existsSync, writeFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { resolve, relative, isAbsolute, sep } = require('node:path');
const {
  createSubjectPracticeProductionShadowExporterAttestation,
  scoreSubjectPracticeProductionShadowEvidence,
  verifySubjectPracticeProductionShadowExporterAttestation
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  buildSubjectPracticeProductionShadowEvidenceBatch,
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-trusted-exporter');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
  subjectPracticeProductionShadowScopeContractFor,
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');

const EXPORT_MODE = 'subject_practice_production_shadow_read_only_export_v1';
const SECRET_ENV = 'CSCA_PRODUCTION_SHADOW_EXPORTER_HMAC_SECRET';

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function candidateIdsFrom(value) {
  const raw = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const ids = raw.map(Number);
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('production_shadow_export_requires_positive_candidate_ids');
  }
  if (ids.length > 1000) throw new Error('production_shadow_export_candidate_limit_exceeded');
  if (new Set(ids).size !== ids.length) throw new Error('production_shadow_export_candidate_ids_must_be_unique');
  return ids;
}

function outputPathFrom(value, workspaceRoot = process.cwd()) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('production_shadow_export_output_path_required');
  const root = resolve(workspaceRoot);
  const target = resolve(root, raw);
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error('production_shadow_export_output_must_be_new_file_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('production_shadow_export_output_must_be_json');
  if (existsSync(target)) throw new Error('production_shadow_export_refuses_to_overwrite');
  return target;
}

function preflight(input = {}) {
  const contract = input.subject
    ? subjectPracticeProductionShadowScopeContractFor(input.subject, input.taskFamily, input.planTemplate)
    : null;
  const contracts = subjectPracticeProductionShadowScopeContracts();
  return {
    mode: EXPORT_MODE,
    status: 'preflight_only_no_database_connection',
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    supportedSubjects: Array.from(new Set(contracts.map((item) => item.subject))),
    supportedContracts: contracts.map((item) => ({ subject: item.subject, taskFamily: item.taskFamily, planTemplate: item.planTemplate })),
    selectedSubject: contract?.subject ?? null,
    selectedTaskFamily: contract?.taskFamily ?? null,
    selectedPlanTemplate: contract?.planTemplate ?? null,
    selectedScopeCount: contract?.expectedScopeIds.length ?? 0,
    executeRequiredForDatabaseRead: true,
    exactCandidateWhitelistRequired: true,
    maximumCandidateCount: 1000,
    transactionMode: 'repeatable_read_read_only',
    outputPolicy: 'new_json_file_inside_workspace_no_overwrite',
    hmacSecretEnvironmentVariable: SECRET_ENV,
    hmacSecretConfigured: String(process.env[SECRET_ENV] ?? '').trim().length >= 32,
    providerImpact: 'none_no_provider_call',
    mutationImpact: 'none_read_only_database_transaction_when_executed',
    publicationImpact: 'none_publication_counts_are_read_and_must_be_zero'
  };
}

async function execute(input) {
  const contract = subjectPracticeProductionShadowScopeContractFor(input.subject, input.taskFamily, input.planTemplate);
  if (!contract) throw new Error('production_shadow_export_exact_subject_family_template_contract_required');
  const candidateIds = candidateIdsFrom(input.candidateIds);
  const outputPath = outputPathFrom(input.out);
  const secret = String(process.env[SECRET_ENV] ?? '').trim();
  if (secret.length < 32) throw new Error('production_shadow_export_hmac_secret_missing_or_too_short');
  const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const captured = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [snapshot] = await tx.$queryRaw`SELECT txid_current_snapshot()::text AS "transactionSnapshotId"`;
      const rows = await tx.$queryRaw(Prisma.sql`
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
        WHERE q."id" IN (${Prisma.join(candidateIds)}) AND q."subject" = ${contract.subject}
        ORDER BY q."id" ASC
      `);
      return { transactionSnapshotId: String(snapshot?.transactionSnapshotId ?? ''), rows };
    }, { isolationLevel: 'RepeatableRead' });
    const foundIds = new Set(captured.rows.map((row) => Number(row.id)));
    const missingIds = candidateIds.filter((id) => !foundIds.has(id));
    if (missingIds.length) throw new Error(`production_shadow_export_candidates_missing:${missingIds.join(',')}`);
    const snapshots = captured.rows.map((row) => subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
      row,
      transactionSnapshotId: captured.transactionSnapshotId
    }));
    const generatedAt = new Date().toISOString();
    const batch = buildSubjectPracticeProductionShadowEvidenceBatch({
      batchId: `production-shadow-${contract.subject}-${randomUUID()}`,
      generatedAt,
      snapshots
    });
    const attestation = createSubjectPracticeProductionShadowExporterAttestation({
      batch,
      exporterId: `${EXPORT_MODE}:${contract.registryVersion}`,
      issuedAt: generatedAt,
      secret
    });
    const trustedExporterProof = verifySubjectPracticeProductionShadowExporterAttestation({ batch, attestation, secret });
    if (!trustedExporterProof) throw new Error('production_shadow_export_attestation_self_verification_failed');
    const score = scoreSubjectPracticeProductionShadowEvidence(batch, {
      expectedScopeIds: contract.expectedScopeIds,
      expectedBinding: contract.expectedBinding,
      trustedExporterProof
    });
    const artifact = {
      mode: EXPORT_MODE,
      registryVersion: contract.registryVersion,
      exportedAt: generatedAt,
      subject: contract.subject,
      exactCandidateIds: candidateIds,
      transactionSnapshotId: captured.transactionSnapshotId,
      batch,
      attestation,
      score,
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only_repeatable_read_transaction',
      publicationImpact: 'none_verified_by_zero_exposure_and_round_item_counts'
    };
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { ...artifact, outputPath, hmacSecretSerialized: false };
  } finally {
    await prisma.$disconnect();
  }
}

function selfTest() {
  const checks = {};
  checks.registryHasFiveVersionCompleteContracts = subjectPracticeProductionShadowScopeContracts().length === 5
    && subjectPracticeProductionShadowScopeContracts().every((contract) => contract.expectedScopeIds.length >= 1
      && Object.values(contract.expectedBinding).every((value) => value !== null
        && value !== undefined
        && (typeof value !== 'string' || value.trim().length > 0)));
  checks.candidateWhitelistParses = JSON.stringify(candidateIdsFrom('1,2,3')) === JSON.stringify([1, 2, 3]);
  try { candidateIdsFrom('1,1'); checks.duplicateCandidateRejected = false; } catch { checks.duplicateCandidateRejected = true; }
  try { candidateIdsFrom('0,-1'); checks.invalidCandidateRejected = false; } catch { checks.invalidCandidateRejected = true; }
  try { outputPathFrom('../outside.json'); checks.pathEscapeRejected = false; } catch { checks.pathEscapeRejected = true; }
  const report = {
    mode: `${EXPORT_MODE}_self_test`,
    reportVersion: 'subject-practice-production-shadow-read-only-export-self-test-v2-math-derivative',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    preflight: preflight({
      subject: 'math',
      taskFamily: 'math_line_relation_direct',
      planTemplate: 'math_line_relation_direct_v1'
    }),
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_self_test_does_not_construct_prisma_client',
    productionImpact: 'none_no_output_written'
  };
  return report;
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['self-test']) return selfTest();
  const selector = {
    subject: args.subject,
    taskFamily: args['task-family'],
    planTemplate: args['plan-template']
  };
  if (!args.execute) return preflight(selector);
  return execute({ ...selector, candidateIds: args['candidate-ids'], out: args.out });
}

if (require.main === module) {
  main().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
    if (process.argv.includes('--require-qualified') && report.score?.qualifiesAsFormalProductionShadowEvidence !== true) process.exitCode = 2;
  }).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { argsFrom, candidateIdsFrom, outputPathFrom, preflight, execute, selfTest };
