#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');

const MODE = 'subject_practice_observation_batch_novelty_diagnostic_v1';

function clean(value) {
  return String(value ?? '').trim();
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function batchIdFrom(value) {
  const batchId = clean(value).toLowerCase();
  if (!/^local-shadow-[a-f0-9]{20}$/.test(batchId)) {
    throw new Error('observation_batch_novelty_diagnostic_valid_batch_id_required');
  }
  return batchId;
}

function argValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}

function increment(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function sortedCounts(value) {
  return Object.fromEntries(Object.entries(value)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)]));
  }
  return value;
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex');
}

function buildReadOnlyNoveltyEvidenceRoots({ subject, generatorVersion, revisions, entries }) {
  const sourceSnapshotEntries = revisions.map((revision) => ({
    sourceQuestionRevisionId: revision.sourceQuestionRevisionId,
    lineageHash: revision.lineageHash,
    documentIdentityHash: revision.documentIdentityHash,
    rawContentSha256: revision.fieldHashes?.rawContentSha256,
    canonicalTaskParameterFingerprint: revision.canonicalTaskParameterFingerprint ?? null
  })).sort((left, right) => left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  const candidateEvidenceEntries = entries.map((entry) => ({
    candidateId: String(entry.candidateId),
    scopeId: clean(entry.scopeId).toLowerCase(),
    policyVersion: entry.evidence?.policyVersion,
    status: entry.evidence?.status,
    reasonCodes: [...(entry.evidence?.reasonCodes ?? [])].sort(),
    scannedRevisionCount: entry.evidence?.scannedRevisionCount,
    revisionMatchSetSha256: entry.evidence?.revisionMatchSetSha256
  })).sort((left, right) => left.scopeId.localeCompare(right.scopeId)
    || left.candidateId.localeCompare(right.candidateId));
  const sourceCorpusSnapshotSha256 = sha256Json(sourceSnapshotEntries);
  const candidateEvidenceRootSha256 = sha256Json(candidateEvidenceEntries);
  const evidenceCore = {
    evidenceVersion: 'subject-practice-read-only-db-novelty-evidence-v1',
    subject: clean(subject).toLowerCase(),
    generatorVersion: clean(generatorVersion),
    noveltyPolicyVersion: candidateEvidenceEntries[0]?.policyVersion ?? null,
    sourceRevisionCount: sourceSnapshotEntries.length,
    evaluatedCandidateCount: candidateEvidenceEntries.length,
    sourceCorpusSnapshotSha256,
    candidateEvidenceRootSha256
  };
  return {
    ...evidenceCore,
    evidenceDigest: sha256Json(evidenceCore),
    allSourceRevisionsContentBoundByHash: sourceSnapshotEntries.every((entry) =>
      /^[a-f0-9]{64}$/.test(entry.sourceQuestionRevisionId)
      && /^[a-f0-9]{64}$/.test(entry.rawContentSha256)),
    allCandidatesBoundToCompleteRevisionMatchSet: candidateEvidenceEntries.every((entry) =>
      entry.scannedRevisionCount === sourceSnapshotEntries.length
      && /^[a-f0-9]{64}$/.test(entry.revisionMatchSetSha256)),
    attestationClass: 'repeatable_read_local_untrusted_nonqualifying',
    formalQualificationEligible: false
  };
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))];
}

function summarizeCandidateEvidence(entries) {
  const candidateStatusCounts = {};
  const candidateReasonCounts = {};
  const revisionReasonCounts = {};
  const matchedFieldMaskCounts = {};
  const scopeStatusCounts = {};
  const weakFragmentStats = new Map();
  const ambiguousRevisionCounts = [];
  for (const entry of entries) {
    const evidence = entry.evidence;
    increment(candidateStatusCounts, evidence.status);
    ambiguousRevisionCounts.push(evidence.ambiguousRevisionCount);
    for (const reason of evidence.reasonCodes) increment(candidateReasonCounts, reason);
    const scopeKey = entry.scopeId || 'scope_missing';
    scopeStatusCounts[scopeKey] ??= {};
    increment(scopeStatusCounts[scopeKey], evidence.status);
    for (const match of evidence.nonClearRevisionMatches) {
      for (const reason of match.reasonCodes) increment(revisionReasonCounts, reason);
      for (const field of match.matchedFieldMask) increment(matchedFieldMaskCounts, field);
      for (const descriptor of match.weakFragmentDescriptors) {
        const current = weakFragmentStats.get(descriptor.fragmentSha256) ?? {
          fragmentSha256: descriptor.fragmentSha256,
          normalizedLength: descriptor.normalizedLength,
          candidateIds: new Set(),
          sourceRevisionIds: new Set(),
          sourceDocumentIdentityHashes: new Set()
        };
        current.candidateIds.add(entry.candidateId);
        current.sourceRevisionIds.add(match.sourceQuestionRevisionId);
        current.sourceDocumentIdentityHashes.add(match.sourceDocumentIdentityHash);
        weakFragmentStats.set(descriptor.fragmentSha256, current);
      }
    }
  }
  return {
    candidateStatusCounts: sortedCounts(candidateStatusCounts),
    candidateReasonCounts: sortedCounts(candidateReasonCounts),
    revisionReasonCounts: sortedCounts(revisionReasonCounts),
    matchedFieldMaskCounts: sortedCounts(matchedFieldMaskCounts),
    ambiguousRevisionCountDistribution: {
      minimum: ambiguousRevisionCounts.length ? Math.min(...ambiguousRevisionCounts) : null,
      median: percentile(ambiguousRevisionCounts, 0.5),
      p95: percentile(ambiguousRevisionCounts, 0.95),
      maximum: ambiguousRevisionCounts.length ? Math.max(...ambiguousRevisionCounts) : null
    },
    scopeStatusCounts: Object.fromEntries(Object.entries(scopeStatusCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([scope, counts]) => [scope, sortedCounts(counts)])),
    weakFragmentHashStatistics: Array.from(weakFragmentStats.values()).map((item) => ({
      fragmentSha256: item.fragmentSha256,
      normalizedLength: item.normalizedLength,
      candidateCount: item.candidateIds.size,
      sourceRevisionCount: item.sourceRevisionIds.size,
      independentSourceDocumentCount: item.sourceDocumentIdentityHashes.size
    })).sort((left, right) => right.candidateCount - left.candidateCount
      || right.independentSourceDocumentCount - left.independentSourceDocumentCount
      || left.fragmentSha256.localeCompare(right.fragmentSha256)).slice(0, 40)
  };
}

async function execute(batchId) {
  if (!clean(process.env.DATABASE_URL)) throw new Error('observation_batch_novelty_diagnostic_database_url_missing');
  const prisma = new PrismaClient();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const tasks = await tx.$queryRaw(Prisma.sql`
        SELECT task."id"::text AS "id", task."subject", task."result"
        FROM "csca_ai_questioning_tasks" task
        WHERE task."task_type" = 'subject_practice_observation'
          AND task."filter_snapshot"->'sealedObservationBatch'->>'batchId' = ${batchId}
        ORDER BY (task."filter_snapshot"->'sealedObservationBatch'->>'taskOrdinal')::int ASC
      `);
      if (!tasks.length) throw new Error('observation_batch_novelty_diagnostic_batch_not_found');
      const candidateIds = Array.from(new Set(tasks.map((task) => Number(recordFrom(task.result).generatedQuestionId))
        .filter((id) => Number.isInteger(id) && id > 0)));
      const candidates = candidateIds.length ? await tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."subject", q."topic_id" AS "topicId", q."blueprint_id" AS "blueprintId",
               q."designed_difficulty" AS "designedDifficulty", q."question_type" AS "questionType",
               q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
               q."knowledge_tags" AS "knowledgeTags", q."option_metadata" AS "optionMetadata",
               q."syllabus_version" AS "syllabusVersion", q."generation_metadata" AS "generationMetadata"
        FROM "csca_questions" q
        WHERE q."id" IN (${Prisma.join(candidateIds)})
        ORDER BY q."id" ASC
      `) : [];
      const subjects = Array.from(new Set(candidates.map((candidate) => clean(candidate.subject).toLowerCase())));
      const sources = subjects.length ? await tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."document_id" AS "documentId", q."question_number" AS "questionNumber",
               q."subject", q."language", q."prompt_text" AS "promptText", q."options",
               q."correct_answer" AS "correctAnswer", q."explanation"
        FROM "csca_source_questions" q
        JOIN "csca_source_documents" d ON d."id" = q."document_id"
        WHERE q."subject" IN (${Prisma.join(subjects)}) AND d."status" = 'active'
        ORDER BY q."document_id" ASC, q."id" ASC
      `) : [];
      const sourceRevisionsBySubject = new Map();
      for (const row of sources) {
        const subject = clean(row.subject).toLowerCase();
        const revisions = sourceRevisionsBySubject.get(subject) ?? [];
        revisions.push(buildSubjectPracticeStructuredSourceQuestionRevision({
          sourceSystem: 'production_database', documentId: String(row.documentId),
          questionOrdinal: clean(row.questionNumber) || String(row.id), subject, language: row.language,
          prompt: row.promptText, options: row.options, answer: row.correctAnswer, explanation: row.explanation
        }));
        sourceRevisionsBySubject.set(subject, revisions);
      }
      const entries = candidates.map((row) => {
        const generation = recordFrom(row.generationMetadata);
        const formal = recordFrom(generation.formalVerificationBundle);
        const candidate = {
          subject: row.subject, topicId: row.topicId, blueprintId: row.blueprintId, sourceType: 'ai',
          designedDifficulty: row.designedDifficulty, questionType: row.questionType,
          prompt: row.prompt, options: row.options, correctAnswer: row.correctAnswer,
          explanation: row.explanation, knowledgeTags: row.knowledgeTags,
          optionMetadata: row.optionMetadata, localizations: generation.localizations ?? null,
          syllabusVersion: row.syllabusVersion
        };
        return {
          candidateId: Number(row.id),
          scopeId: clean(formal.scopeId ?? formal.plannedScopeId).toLowerCase() || null,
          evidence: evaluateSubjectPracticeCandidateOutputNovelty({
            candidate,
            sourceRevisions: sourceRevisionsBySubject.get(clean(row.subject).toLowerCase()) ?? []
          })
        };
      });
      const sourceLanguageCounts = {};
      for (const source of sources) increment(sourceLanguageCounts, `${clean(source.subject).toLowerCase()}:${clean(source.language).toLowerCase()}`);
      return {
        mode: MODE,
        status: candidateIds.length === candidates.length ? 'completed' : 'candidate_set_incomplete',
        batchId,
        taskCount: tasks.length,
        taskCandidateIdCount: candidateIds.length,
        loadedCandidateCount: candidates.length,
        sourceRevisionCount: sources.length,
        sourceLanguageCounts: sortedCounts(sourceLanguageCounts),
        ...summarizeCandidateEvidence(entries),
        contentExposure: 'none_only_hashes_counts_scope_ids_and_reason_codes_emitted',
        transactionMode: 'repeatable_read_read_only',
        providerImpact: 'none_no_provider_call',
        databaseImpact: 'read_only',
        publicationImpact: 'none'
      };
    }, { isolationLevel: 'RepeatableRead' });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const batchId = batchIdFrom(argValue('batch-id'));
  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({
      mode: MODE, status: 'preflight_only_no_database_connection', batchId,
      requiredFlag: '--execute', emitsQuestionContent: false,
      providerImpact: 'none_no_provider_call', databaseImpact: 'none', publicationImpact: 'none'
    }, null, 2));
    return;
  }
  console.log(JSON.stringify(await execute(batchId), null, 2));
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ mode: MODE, status: 'failed', error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});

module.exports = { summarizeCandidateEvidence, buildReadOnlyNoveltyEvidenceRoots };
