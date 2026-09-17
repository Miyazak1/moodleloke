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
  generateSubjectPracticeMathDerivativeLocally,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
  subjectPracticeLocalShadowCandidateSeedBindingFor
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  summarizeCandidateEvidence,
  buildReadOnlyNoveltyEvidenceRoots
} = require('./csca-subject-practice-observation-batch-novelty-diagnostic.cjs');
const {
  normalizeSubjectPracticeSourceCorpusText
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  bindings: productionProfileBindings
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const MODE = 'subject_practice_math_derivative_sealed_batch_db_novelty_preflight_v1';
const PRODUCTION_RUN_ID = 1;
const PRODUCTION_CELL_ID = 10;
const EXACT_SCOPE_ID = 'math-basic-derivative-v1:direct_polynomial_value';

function clean(value) {
  return String(value ?? '').trim();
}

function argValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}

function sealedBatchIdArg() {
  const batchId = clean(argValue('batch-id')).toLowerCase();
  if (!/^local-shadow-[a-f0-9]{20}$/.test(batchId)) {
    throw new Error('math_derivative_db_novelty_preflight_valid_batch_id_required');
  }
  return batchId;
}

function taskCountArg() {
  const parsed = Number(argValue('task-count') || 8);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 128) {
    throw new Error('math_derivative_db_novelty_preflight_task_count_must_be_integer_1_to_128');
  }
  return parsed;
}

function diagnosticNonClearCandidates(entries) {
  if (!process.argv.includes('--diagnostic-fragments')) return undefined;
  return entries.filter((entry) => entry.evidence.status !== 'clear').map((entry) => {
    const fragmentHashes = new Set(entry.evidence.nonClearRevisionMatches.flatMap((match) =>
      match.weakFragmentDescriptors.map((descriptor) => descriptor.fragmentSha256)));
    const candidateSideFragments = Array.from(new Set([
      ...(entry.candidate.options ?? []).map((option) => option.text),
      ...Object.values(entry.candidate.localizations ?? {}).flatMap((localized) =>
        (localized.options ?? []).map((option) => option.text))
    ].map(normalizeSubjectPracticeSourceCorpusText).filter((value) =>
      value && fragmentHashes.has(createHash('sha256').update(value).digest('hex')))));
    return {
      candidateId: entry.candidateId,
      scopeId: entry.scopeId,
      status: entry.evidence.status,
      reasonCodes: entry.evidence.reasonCodes,
      candidateSideMatchedFragments: candidateSideFragments
    };
  });
}

const blueprint = {
  id: PRODUCTION_CELL_ID,
  subject: 'math',
  topicId: 71,
  topicCode: productionProfileBindings.mathDerivative.topicCode,
  topicModule: '微积分',
  topicTitle: '导数与微积分初步',
  syllabusVersion: '2025',
  examScope: '多项式函数的直接求导与指定点导数值。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: ['domain_trap', 'piecewise_function', 'implicit_differentiation', 'higher_derivative'],
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'multi_step_reasoning',
  constraints: {}
};

const questionPlan = buildSubjectPracticeQuestionPlan({
  subject: 'math',
  topicId: blueprint.topicId,
  topicTitle: blueprint.topicTitle,
  productionCellId: PRODUCTION_CELL_ID,
  targetDifficulty: 'basic',
  taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1',
  exactDerivativeScope: 'direct_polynomial_value'
});

async function execute(batchId, taskCount) {
  if (!clean(process.env.DATABASE_URL)) {
    throw new Error('math_derivative_db_novelty_preflight_database_url_missing');
  }
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
      sourceSystem: 'production_database',
      documentId: String(row.documentId),
      questionOrdinal: clean(row.questionNumber) || String(row.id),
      subject: row.subject,
      language: row.language,
      prompt: row.promptText,
      options: row.options,
      answer: row.correctAnswer,
      explanation: row.explanation
    }));
    const entries = [];
    const generationFailureCounts = {};
    const seedBindings = [];
    for (let taskOrdinal = 1; taskOrdinal <= taskCount; taskOrdinal += 1) {
      const seedBinding = subjectPracticeLocalShadowCandidateSeedBindingFor({
        observationBatchId: batchId,
        taskOrdinal,
        productionRunId: PRODUCTION_RUN_ID,
        productionCellId: PRODUCTION_CELL_ID
      });
      seedBindings.push(seedBinding);
      const generated = generateSubjectPracticeMathDerivativeLocally({
        blueprint,
        questionPlan,
        seed: seedBinding.seed
      });
      if (!generated.candidate || generated.scopeId !== EXACT_SCOPE_ID) {
        const key = generated.status || 'scope_mismatch';
        generationFailureCounts[key] = (generationFailureCounts[key] ?? 0) + 1;
        continue;
      }
      entries.push({
        candidateId: `${batchId}:${taskOrdinal}`,
        scopeId: generated.scopeId,
        candidate: generated.candidate,
        evidence: evaluateSubjectPracticeCandidateOutputNovelty({
          candidate: generated.candidate,
          sourceRevisions: revisions
        })
      });
    }
    const summary = summarizeCandidateEvidence(entries);
    const nonClearCount = (summary.candidateStatusCounts.blocked ?? 0)
      + (summary.candidateStatusCounts.ambiguous ?? 0);
    return {
      mode: MODE,
      status: entries.length !== taskCount
        ? 'generation_incomplete'
        : nonClearCount > 0
          ? 'completed_with_non_clear_candidates'
          : 'completed_all_candidates_clear_nonqualifying_read_only_preflight',
      sealedBatchId: batchId,
      productionRunId: PRODUCTION_RUN_ID,
      productionCellId: PRODUCTION_CELL_ID,
      exactScopeId: EXACT_SCOPE_ID,
      generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
      productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
      productionProfileBindingDigest: productionProfileBindings.mathDerivative.bindingDigest,
      seedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
      seedBindingsValid: seedBindings.length === taskCount
        && seedBindings.every((binding, index) => binding.taskOrdinal === index + 1
          && binding.observationBatchId === batchId
          && binding.productionRunId === PRODUCTION_RUN_ID
          && binding.productionCellId === PRODUCTION_CELL_ID
          && binding.databaseIdentityIndependent === true),
      attemptedCandidateCount: taskCount,
      generatedCandidateCount: entries.length,
      generationFailureCounts,
      sourceRevisionCount: revisions.length,
      ...summary,
      evidenceRoots: buildReadOnlyNoveltyEvidenceRoots({
        subject: 'math',
        generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
        revisions,
        entries
      }),
      diagnosticNonClearCandidates: diagnosticNonClearCandidates(entries),
      contentExposure: process.argv.includes('--diagnostic-fragments')
        ? 'candidate_side_matched_fragments_only_no_source_identity_or_source_text'
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
  const taskCount = taskCountArg();
  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({
      mode: MODE,
      status: 'preflight_only_no_database_connection',
      taskCount,
      requiredFlags: ['--execute', '--batch-id=local-shadow-<20 hex>'],
      emitsQuestionContent: false,
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'none',
      publicationImpact: 'none'
    }, null, 2));
    return;
  }
  console.log(JSON.stringify(await execute(sealedBatchIdArg(), taskCount), null, 2));
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({
    mode: MODE,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
