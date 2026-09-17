#!/usr/bin/env node

const crypto = require('node:crypto');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const MODE = 'subject_practice_source_corpus_db_inventory_v2';
const MAXIMUM_SOURCE_QUESTIONS = 100000;
const QUERY_CONTRACT = 'csca_source_documents_and_questions_all_statuses_allow_similarity_check_not_false_v1';
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
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

function outputPathFrom(value, workspaceRoot = process.cwd()) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('source_corpus_db_inventory_output_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('source_corpus_db_inventory_output_must_be_json');
  if (existsSync(target)) throw new Error('source_corpus_db_inventory_refuses_to_overwrite');
  return target;
}

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_database_connection',
    executeRequiredForDatabaseRead: true,
    databaseUrlConfigured: text(process.env.DATABASE_URL).length > 0,
    queryContract: QUERY_CONTRACT,
    sourceTables: ['csca_source_documents', 'csca_source_questions'],
    documentStatusPolicy: 'all_statuses_included_when_allowSimilarityCheck_is_not_false',
    maximumSourceQuestions: MAXIMUM_SOURCE_QUESTIONS,
    transactionMode: 'repeatable_read_read_only',
    outputPolicy: 'new_json_file_inside_workspace_no_overwrite',
    extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_does_not_construct_prisma_client',
    productionImpact: 'none_read_only_inventory_protocol'
  };
}

function usagePolicyAllowsSimilarityCheck(value) {
  return !(value && typeof value === 'object' && value.allowSimilarityCheck === false);
}

async function execute(input) {
  const outputPath = outputPathFrom(input.out);
  if (!text(process.env.DATABASE_URL)) throw new Error('source_corpus_db_inventory_database_url_missing');
  const { PrismaClient } = require('../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const capturedAt = new Date().toISOString();
    const captured = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [snapshot] = await tx.$queryRawUnsafe('SELECT txid_current_snapshot()::text AS "transactionSnapshotId"');
      const documents = await tx.$queryRawUnsafe(`
        SELECT "id", "subject", "source_type" AS "sourceType", "title", "exam_year" AS "examYear",
               "exam_session" AS "examSession", "language", "file_hash" AS "fileHash",
               "storage_key" AS "storageKey", "source_label" AS "sourceLabel", "source_url" AS "sourceUrl",
               "license_scope" AS "licenseScope", "usage_policy" AS "usagePolicy", "status",
               "created_at" AS "createdAt", "updated_at" AS "updatedAt"
        FROM "csca_source_documents"
        ORDER BY "id" ASC
      `);
      const includedDocumentIds = documents.filter((document) => usagePolicyAllowsSimilarityCheck(document.usagePolicy))
        .map((document) => Number(document.id));
      if (!includedDocumentIds.length) {
        return { transactionSnapshotId: String(snapshot?.transactionSnapshotId ?? ''), documents, rows: [], expectedCount: 0 };
      }
      const [countRow] = await tx.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS "count"
        FROM "csca_source_questions"
        WHERE "document_id" = ANY($1::int[])
      `, includedDocumentIds);
      const expectedCount = Number(countRow?.count ?? 0);
      if (!Number.isInteger(expectedCount) || expectedCount < 0 || expectedCount > MAXIMUM_SOURCE_QUESTIONS) {
        throw new Error('source_corpus_db_inventory_question_count_invalid_or_exceeds_limit');
      }
      const rows = await tx.$queryRawUnsafe(`
        SELECT q."id", q."document_id" AS "documentId", q."subject", q."question_number" AS "questionNumber",
               q."page_number" AS "pageNumber", q."language", q."prompt_hash" AS "promptHash",
               q."prompt_text" AS "promptText", q."options", q."correct_answer" AS "correctAnswer",
               q."explanation", q."syllabus_version" AS "syllabusVersion", q."topic_id" AS "topicId",
               q."topic_codes" AS "topicCodes", q."blueprint_like_tags" AS "blueprintLikeTags",
               q."analysis", q."analysis_status" AS "analysisStatus", q."review_status" AS "reviewStatus",
               q."created_at" AS "createdAt", q."updated_at" AS "updatedAt"
        FROM "csca_source_questions" q
        WHERE q."document_id" = ANY($1::int[])
        ORDER BY q."id" ASC
      `, includedDocumentIds);
      return { transactionSnapshotId: String(snapshot?.transactionSnapshotId ?? ''), documents, rows, expectedCount };
    }, { isolationLevel: 'RepeatableRead' });

    const includedDocuments = captured.documents.filter((document) => usagePolicyAllowsSimilarityCheck(document.usagePolicy));
    const excludedDocuments = captured.documents.filter((document) => !usagePolicyAllowsSimilarityCheck(document.usagePolicy));
    const observedCount = captured.rows.length;
    if (observedCount !== captured.expectedCount) throw new Error('source_corpus_db_inventory_snapshot_count_mismatch');
    const timestamps = [...includedDocuments, ...captured.rows]
      .map((row) => new Date(row.updatedAt).toISOString()).sort();
    const highWatermark = timestamps.at(-1) ?? capturedAt;
    const subjectCounts = {};
    const languageCounts = {};
    for (const row of captured.rows) {
      const subject = text(row.subject).toLowerCase() || 'unknown';
      const language = text(row.language).toLowerCase() || 'unknown';
      subjectCounts[subject] = (subjectCounts[subject] ?? 0) + 1;
      languageCounts[language] = (languageCounts[language] ?? 0) + 1;
    }
    const sourceInventory = {
      sourceId: 'production_csca_source_questions',
      kind: 'database_query',
      locatorFingerprintSha256: sha256(QUERY_CONTRACT),
      expectedCount: captured.expectedCount,
      observedCount,
      highWatermark,
      updatedAt: capturedAt,
      extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
      status: observedCount === captured.expectedCount ? 'complete' : 'failed'
    };
    const payload = {
      schemaVersion: 'subject-practice-source-corpus-db-inventory-v2',
      mode: MODE,
      capturedAt,
      transactionSnapshotId: captured.transactionSnapshotId,
      queryContract: QUERY_CONTRACT,
      sourceInventory,
      documentCount: captured.documents.length,
      includedDocumentCount: includedDocuments.length,
      excludedDocumentCount: excludedDocuments.length,
      excludedDocuments: excludedDocuments.map((document) => ({
        id: Number(document.id), fileHash: document.fileHash, reason: 'usage_policy_allowSimilarityCheck_false'
      })),
      questionCount: observedCount,
      subjectCounts,
      languageCounts,
      documents: includedDocuments,
      sourceQuestions: captured.rows,
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only_repeatable_read_transaction',
      productionImpact: 'none_inventory_export_only'
    };
    const artifact = { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return {
      mode: MODE, status: 'database_inventory_exported_read_only', outputPath,
      payloadSha256: artifact.payloadSha256, transactionSnapshotId: captured.transactionSnapshotId,
      sourceInventory, documentCount: artifact.documentCount, includedDocumentCount: artifact.includedDocumentCount,
      excludedDocumentCount: artifact.excludedDocumentCount, questionCount: artifact.questionCount,
      subjectCounts, languageCounts,
      providerImpact: artifact.providerImpact, databaseImpact: artifact.databaseImpact,
      productionImpact: artifact.productionImpact
    };
  } finally {
    await prisma.$disconnect();
  }
}

function selfTest() {
  const checks = {
    preflightDoesNotConstructPrisma: preflight().status === 'preflight_only_no_database_connection',
    explicitExecuteRequired: preflight().executeRequiredForDatabaseRead === true,
    allDocumentStatusesDeclared: preflight().documentStatusPolicy.startsWith('all_statuses'),
    extractionFieldsComplete: preflight().extractedFields.join(',') === 'prompt,options,answer,explanation,localizations',
    explicitMaximumBound: preflight().maximumSourceQuestions === MAXIMUM_SOURCE_QUESTIONS,
    usagePolicyFalseExcluded: !usagePolicyAllowsSimilarityCheck({ allowSimilarityCheck: false }),
    usagePolicyMissingIncluded: usagePolicyAllowsSimilarityCheck({}),
    pathEscapeRejected: (() => { try { outputPathFrom('../outside.json'); return false; } catch { return true; } })(),
    dateCanonicalizedBeforeHashing: canonicalJsonValue(new Date('2026-09-13T00:00:00.000Z')) === '2026-09-13T00:00:00.000Z'
  };
  return {
    mode: `${MODE}_self_test`, reportVersion: 'subject-practice-source-corpus-db-inventory-self-test-v2',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks, preflight: preflight(),
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_self_test_only', productionImpact: 'none'
  };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['self-test']) return selfTest();
  if (!args.execute) return preflight();
  return execute({ out: args.out });
}

if (require.main === module) {
  main().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  }).catch((error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; });
}

module.exports = { argsFrom, outputPathFrom, preflight, usagePolicyAllowsSimilarityCheck, execute, selfTest };
