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
  generateSubjectPracticePhysicsKinematicsLocally,
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
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

const MODE = 'subject_practice_physics_kinematics_db_novelty_preflight_v1';
const RELATIONS = [
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
];

function clean(value) {
  return String(value ?? '').trim();
}

function positiveIntegerArg(name, fallback) {
  const prefix = `--${name}=`;
  const token = process.argv.find((value) => value.startsWith(prefix));
  const parsed = Number(token ? token.slice(prefix.length) : fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 512) throw new Error(`${name}_must_be_integer_1_to_512`);
  return parsed;
}

const blueprint = {
  id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学',
  topicTitle: 'Kinematics', syllabusVersion: '2025',
  examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
  excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model'],
  difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
};

async function execute(samplesPerScope) {
  if (!clean(process.env.DATABASE_URL)) throw new Error('physics_kinematics_db_novelty_preflight_database_url_missing');
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
        WHERE q."subject" = 'physics' AND d."status" = 'active'
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
      for (let seed = 0; seed < samplesPerScope; seed += 1) {
        const questionPlan = buildSubjectPracticeQuestionPlan({
          subject: 'physics', topicId: 8, topicTitle: blueprint.topicTitle, productionCellId: 24,
          targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
          exactPhysicsKinematicsScope: relationKind, scenarioSeed: seed
        });
        const generated = generateSubjectPracticePhysicsKinematicsLocally({ blueprint, questionPlan, seed, relationKind });
        if (!generated.candidate) {
          const key = generated.status || 'unknown';
          generationFailureCounts[key] = (generationFailureCounts[key] ?? 0) + 1;
          continue;
        }
        entries.push({
          candidateId: `${relationKind}:${seed}`,
          scopeId: generated.scopeId,
          evidence: evaluateSubjectPracticeCandidateOutputNovelty({
            candidate: generated.candidate,
            sourceRevisions: revisions
          })
        });
      }
    }
    return {
      mode: MODE,
      status: entries.length === RELATIONS.length * samplesPerScope
        ? 'completed_nonqualifying_read_only_preflight'
        : 'generation_incomplete',
      generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
      samplesPerScope,
      attemptedCandidateCount: RELATIONS.length * samplesPerScope,
      generatedCandidateCount: entries.length,
      generationFailureCounts,
      sourceRevisionCount: revisions.length,
      ...summarizeCandidateEvidence(entries),
      evidenceRoots: buildReadOnlyNoveltyEvidenceRoots({
        subject: 'physics', generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
        revisions, entries
      }),
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
  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({
      mode: MODE, status: 'preflight_only_no_database_connection', samplesPerScope,
      attemptedCandidateCount: RELATIONS.length * samplesPerScope,
      requiredFlag: '--execute', emitsQuestionContent: false,
      providerImpact: 'none_no_provider_call', databaseImpact: 'none', publicationImpact: 'none'
    }, null, 2));
    return;
  }
  console.log(JSON.stringify(await execute(samplesPerScope), null, 2));
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ mode: MODE, status: 'failed', error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
