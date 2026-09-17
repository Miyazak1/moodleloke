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
  generateSubjectPracticeChemistryAcidBaseLocally,
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const {
  buildSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  summarizeCandidateEvidence,
  buildReadOnlyNoveltyEvidenceRoots
} = require('./csca-subject-practice-observation-batch-novelty-diagnostic.cjs');

const MODE = 'subject_practice_chemistry_acid_base_db_novelty_preflight_v1';
const RELATIONS = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'];
const ANSWER_TARGETS = ['ph_value', 'acid_base_character'];

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
  id: 42, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液',
  topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025',
  examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'],
  excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve'],
  difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
};

async function execute(samplesPerScope) {
  if (!clean(process.env.DATABASE_URL)) throw new Error('chemistry_acid_base_db_novelty_preflight_database_url_missing');
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
        WHERE q."subject" = 'chemistry' AND d."status" = 'active'
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
    for (const relationKind of RELATIONS) {
      for (const answerTarget of ANSWER_TARGETS) {
        for (let seed = 0; seed < samplesPerScope; seed += 1) {
          const questionPlan = buildSubjectPracticeQuestionPlan({
            subject: 'chemistry', topicId: 642, topicTitle: blueprint.topicTitle, productionCellId: 42,
            targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
            exactChemistryRelationKind: relationKind, exactChemistryAnswerTarget: answerTarget,
            scenarioSeed: seed
          });
          const generated = generateSubjectPracticeChemistryAcidBaseLocally({
            blueprint, questionPlan, seed, relationKind, answerTarget
          });
          if (!generated.candidate) {
            const key = generated.status || 'unknown';
            generationFailureCounts[key] = (generationFailureCounts[key] ?? 0) + 1;
            continue;
          }
          entries.push({
            candidateId: `${relationKind}:${answerTarget}:${seed}`,
            scopeId: generated.scopeId,
            evidence: evaluateSubjectPracticeCandidateOutputNovelty({
              candidate: generated.candidate,
              sourceRevisions: revisions
            })
          });
        }
      }
    }
    const attemptedCandidateCount = RELATIONS.length * ANSWER_TARGETS.length * samplesPerScope;
    return {
      mode: MODE,
      status: entries.length === attemptedCandidateCount
        ? 'completed_nonqualifying_read_only_preflight'
        : 'generation_incomplete',
      generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
      samplesPerScope,
      attemptedCandidateCount,
      generatedCandidateCount: entries.length,
      generationFailureCounts,
      sourceRevisionCount: revisions.length,
      ...summarizeCandidateEvidence(entries),
      evidenceRoots: buildReadOnlyNoveltyEvidenceRoots({
        subject: 'chemistry', generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
        revisions, entries
      }),
      blockedCandidates: entries.filter((entry) => entry.evidence.status === 'blocked').map((entry) => ({
        candidateId: entry.candidateId,
        scopeId: entry.scopeId,
        reasonCodes: entry.evidence.reasonCodes,
        blockedRevisionCount: entry.evidence.blockedRevisionCount,
        strongestMatchedFieldMask: entry.evidence.strongestSourceRevisionMatch?.matchedFieldMask ?? [],
        strongestMatchSha256: entry.evidence.strongestSourceRevisionMatch
          ? entry.evidence.nonClearRevisionMatches.find((match) =>
            match.sourceQuestionRevisionId === entry.evidence.strongestSourceRevisionMatch.sourceQuestionRevisionId)?.matchSha256 ?? null
          : null
      })),
      ambiguousCandidates: entries.filter((entry) => entry.evidence.status === 'ambiguous').map((entry) => ({
        candidateId: entry.candidateId,
        scopeId: entry.scopeId,
        reasonCodes: entry.evidence.reasonCodes,
        ambiguousRevisionCount: entry.evidence.ambiguousRevisionCount,
        strongestMatchedFieldMask: entry.evidence.strongestSourceRevisionMatch?.matchedFieldMask ?? [],
        strongestMatchSha256: entry.evidence.strongestSourceRevisionMatch
          ? entry.evidence.nonClearRevisionMatches.find((match) =>
            match.sourceQuestionRevisionId === entry.evidence.strongestSourceRevisionMatch.sourceQuestionRevisionId)?.matchSha256 ?? null
          : null
      })),
      contentExposure: 'none_only_hashes_counts_scope_ids_and_reason_codes_emitted',
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
  const attemptedCandidateCount = RELATIONS.length * ANSWER_TARGETS.length * samplesPerScope;
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
