#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
const {
  generateSubjectPracticeMathElementaryLocally,
  SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  summarizeCandidateEvidence,
  buildReadOnlyNoveltyEvidenceRoots
} = require('./csca-subject-practice-observation-batch-novelty-diagnostic.cjs');
const { normalizeSubjectPracticeSourceCorpusText } = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');

const MODE = 'subject_practice_math_elementary_db_novelty_preflight_v1';
const SLOTS = [
  ['logarithmic', 'domain'],
  ['exponential', 'range'],
  ['radical', 'monotonicity'],
  ['power', 'function_value']
];

function clean(value) {
  return String(value ?? '').trim();
}

function positiveIntegerArg(name, fallback) {
  const prefix = `--${name}=`;
  const token = process.argv.find((value) => value.startsWith(prefix));
  const parsed = Number(token ? token.slice(prefix.length) : fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 512) {
    throw new Error(`${name}_must_be_integer_1_to_512`);
  }
  return parsed;
}

const blueprint = {
  id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数',
  topicTitle: '基本初等函数', syllabusVersion: '2025',
  examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'], excludedScope: [],
  difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {}
};

function candidateSideLongestExplanationFragment(candidate, evidence, revisions) {
  if (!process.argv.includes('--diagnostic-fragments')) return undefined;
  const sourceId = evidence.strongestSourceRevisionMatch?.sourceQuestionRevisionId;
  const source = revisions.find((revision) => revision.sourceQuestionRevisionId === sourceId);
  const target = normalizeSubjectPracticeSourceCorpusText(candidate.localizations?.en?.explanation ?? candidate.explanation);
  const sourceText = normalizeSubjectPracticeSourceCorpusText(source?.fields.explanation ?? '');
  let longest = '';
  for (let start = 0; start < target.length; start += 1) {
    for (let end = start + 16; end <= target.length; end += 1) {
      const fragment = target.slice(start, end);
      if (sourceText.includes(fragment) && fragment.length > longest.length) longest = fragment;
    }
  }
  return longest || null;
}

function compactNonClear(entries, status, revisions) {
  return entries.filter((entry) => entry.evidence.status === status).map((entry) => ({
    candidateId: entry.candidateId,
    scopeId: entry.scopeId,
    reasonCodes: entry.evidence.reasonCodes,
    affectedRevisionCount: status === 'blocked'
      ? entry.evidence.blockedRevisionCount
      : entry.evidence.ambiguousRevisionCount,
    strongestMatchedFieldMask: entry.evidence.strongestSourceRevisionMatch?.matchedFieldMask ?? [],
    strongestSignalScore: entry.evidence.strongestSourceRevisionMatch?.strongestSignalScore ?? null,
    strongestLanguagePair: entry.evidence.strongestSourceRevisionMatch?.strongestLanguagePair ?? null,
    strongestPromptSimilarity: entry.evidence.strongestSourceRevisionMatch?.prompt ?? null,
    strongestExplanationSimilarity: entry.evidence.strongestSourceRevisionMatch?.explanation ?? null,
    candidateSideLongestExplanationFragment: candidateSideLongestExplanationFragment(entry.candidate, entry.evidence, revisions),
    strongestMatchSha256: entry.evidence.strongestSourceRevisionMatch
      ? entry.evidence.nonClearRevisionMatches.find((match) =>
        match.sourceQuestionRevisionId === entry.evidence.strongestSourceRevisionMatch.sourceQuestionRevisionId)?.matchSha256 ?? null
      : null
  }));
}

async function execute(samplesPerScope) {
  if (!clean(process.env.DATABASE_URL)) throw new Error('math_elementary_db_novelty_preflight_database_url_missing');
  const prisma = new PrismaClient();
  try {
    const sources = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."document_id" AS "documentId", q."question_number" AS "questionNumber",
               q."subject", q."language", q."prompt_text" AS "promptText", q."options",
               q."correct_answer" AS "correctAnswer", q."explanation"
        FROM "csca_source_questions" q
        JOIN "csca_source_documents" d ON d."id" = q."document_id"
        WHERE q."subject" = 'math' AND d."status" = 'active'
        ORDER BY q."document_id" ASC, q."id" ASC
      `);
    }, { isolationLevel: 'RepeatableRead' });
    const revisions = sources.map((row) => buildSubjectPracticeStructuredSourceQuestionRevision({
      sourceSystem: 'production_database', documentId: String(row.documentId),
      questionOrdinal: clean(row.questionNumber) || String(row.id), subject: row.subject, language: row.language,
      prompt: row.promptText, options: row.options, answer: row.correctAnswer, explanation: row.explanation
    }));
    const entries = [];
    const generationFailureCounts = {};
    for (const [functionClass, propertyTarget] of SLOTS) {
      for (let seed = 0; seed < samplesPerScope; seed += 1) {
        const questionPlan = buildSubjectPracticeQuestionPlan({
          subject: 'math', topicId: 69, topicTitle: blueprint.topicTitle, productionCellId: 16,
          targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
          requiredElementaryFunctionClass: functionClass,
          requiredSinglePropertyTarget: propertyTarget
        });
        const generated = generateSubjectPracticeMathElementaryLocally({ blueprint, questionPlan, seed });
        if (!generated.candidate) {
          const key = generated.status || 'unknown';
          generationFailureCounts[key] = (generationFailureCounts[key] ?? 0) + 1;
          continue;
        }
        entries.push({
          candidateId: `${functionClass}:${propertyTarget}:${seed}`,
          scopeId: generated.scopeId,
          candidate: generated.candidate,
          evidence: evaluateSubjectPracticeCandidateOutputNovelty({
            candidate: generated.candidate,
            sourceRevisions: revisions
          })
        });
      }
    }
    const attemptedCandidateCount = SLOTS.length * samplesPerScope;
    return {
      mode: MODE,
      status: entries.length === attemptedCandidateCount
        ? 'completed_nonqualifying_read_only_preflight'
        : 'generation_incomplete',
      generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
      samplesPerScope,
      attemptedCandidateCount,
      generatedCandidateCount: entries.length,
      generationFailureCounts,
      sourceRevisionCount: revisions.length,
      ...summarizeCandidateEvidence(entries),
      evidenceRoots: buildReadOnlyNoveltyEvidenceRoots({
        subject: 'math', generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
        revisions, entries
      }),
      blockedCandidates: compactNonClear(entries, 'blocked', revisions),
      ambiguousCandidates: compactNonClear(entries, 'ambiguous', revisions),
      contentExposure: process.argv.includes('--diagnostic-fragments')
        ? 'candidate_side_matched_fragment_only_no_source_identity_or_source_text'
        : 'none_only_hashes_counts_scope_ids_and_reason_codes_emitted',
      formalQualificationEligible: false,
      transactionMode: 'repeatable_read_read_only_fetch_then_in_memory_evaluation',
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only',
      publicationImpact: 'none'
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const samplesPerScope = positiveIntegerArg('samples-per-scope', 128);
  const attemptedCandidateCount = SLOTS.length * samplesPerScope;
  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({
      mode: MODE, status: 'preflight_only_no_database_connection', samplesPerScope, attemptedCandidateCount,
      requiredFlag: '--execute', emitsQuestionContent: false,
      providerImpact: 'none_no_provider_call', databaseImpact: 'none', publicationImpact: 'none'
    }, null, 2));
    return;
  }
  console.log(JSON.stringify(await execute(samplesPerScope), null, 2));
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({
    mode: MODE,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
