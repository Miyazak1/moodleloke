const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { AdaptiveReplenishmentService } = require('../backend/src/ai-questioning/adaptive-replenishment.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const { AdaptiveQuestionProviderService } = require('../backend/src/csca-special-practice/adaptive-question-provider.service');

const prisma = new PrismaClient();
const suffix = Date.now();
const subject = `codex_predictive_${suffix}`;
const syllabusVersion = '2025';
const topicCode = `codex-predictive-topic-${suffix}`;
const organizationSlug = `codex-predictive-org-${suffix}`;
const cohortSlug = `codex-predictive-cohort-${suffix}`;
const userEmail = `codex-predictive-${suffix}@example.test`;
const keepFixture = process.argv.includes('--keep-fixture');
const REQUIRED_TABLES = [
  'csca_student_learning_cycles',
  'csca_adaptive_usage_aggregates',
  'csca_adaptive_inventory_snapshots',
  'csca_adaptive_inventory_events',
  'csca_subject_practice_production_runs',
  'csca_subject_practice_production_cells'
];

const created = {
  userId: null,
  organizationId: null,
  organizationCohortId: null,
  organizationMemberId: null,
  learningCohortId: null,
  syllabusImportId: null,
  topicId: null,
  styleProfileId: null,
  seriesProfileId: null,
  generationProfileId: null,
  sourceDocumentId: null,
  sourceQuestionIds: [],
  blueprintIds: [],
  inventoryEventIds: [],
  productionRunId: null,
  adaptiveSessionId: null,
  specialPracticeTopicIds: [],
  specialPracticeQuestionIds: [],
  formalQuestionIds: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI gateway should not be called by predictive replenishment smoke.');
    }
  };
}

function disabledProvider() {
  return {
    generate: async () => {
      throw new Error('Disabled generator provider should not be called by predictive replenishment smoke.');
    }
  };
}

function jsonb(value) {
  return Prisma.sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}

function sha256Text(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function sourceQuestionAnalysis(difficulty = 'medium') {
  return {
    schemaVersion: 'source-question-profile-v2',
    difficulty,
    questionForm: 'calculation_application',
    cognitiveSkill: 'standard_application',
    readingLoad: 'low',
    calculationLoad: 'medium',
    topicMapping: {
      topicId: created.topicId,
      topicCode,
      confidence: 0.96
    }
  };
}

function makeService() {
  const gateway = disabledGateway();
  const provider = disabledProvider();
  const adaptiveReplenishment = new AdaptiveReplenishmentService(prisma);
  return {
    adaptiveReplenishment,
    service: new AIQuestioningService(
      prisma,
      new QuestionGeneratorService(),
      provider,
      new QuestionReviewerService(new QuestionValidatorService(), provider),
      new QuestionTopicMapperProviderService(gateway),
      new QuestionQualityService(prisma),
      adaptiveReplenishment
    )
  };
}

async function insertOne(sql) {
  const rows = await prisma.$queryRaw(sql);
  return rows[0];
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw(Prisma.sql`SELECT to_regclass(${tableName})::text AS "name"`);
  return Boolean(rows[0]?.name);
}

async function ensureRequiredTables() {
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    if (!(await tableExists(table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(`Predictive replenishment tables are missing: ${missing.join(', ')}. Run "npm.cmd run db:migrate" before this smoke.`);
  }
}

async function cleanupSmokeOrphans() {
  const topicRows = await prisma.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "csca_exam_topics"
    WHERE "code" LIKE 'codex-predictive-topic-%'
  `);
  const topicIds = topicRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (topicIds.length) {
    const specialPracticeTopicRows = await prisma.$queryRaw(Prisma.sql`
      SELECT DISTINCT spq."topic_id" AS "id"
      FROM "special_practice_questions" spq
      JOIN "csca_questions" q ON q."source_question_id" = spq."id"
      WHERE q."topic_id" IN (${Prisma.join(topicIds)})
      UNION
      SELECT "id"
      FROM "special_practice_topics"
      WHERE "slug" LIKE 'codex-predictive-special-topic-%'
    `);
    const specialPracticeTopicIds = specialPracticeTopicRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (specialPracticeTopicIds.length) {
      const specialPracticeQuestionRows = await prisma.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "special_practice_questions"
        WHERE "topic_id" IN (${Prisma.join(specialPracticeTopicIds)})
      `);
      const specialPracticeQuestionIds = specialPracticeQuestionRows
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (specialPracticeQuestionIds.length) {
        await prisma.$executeRaw(Prisma.sql`
          DELETE FROM "csca_topic_mappings"
          WHERE "source_type" = 'special_practice_question'
            AND "source_id" IN (${Prisma.join(specialPracticeQuestionIds)})
        `);
        await prisma.$executeRaw(Prisma.sql`
          DELETE FROM "csca_questions"
          WHERE "source_question_id" IN (${Prisma.join(specialPracticeQuestionIds)})
             OR "topic_id" IN (${Prisma.join(topicIds)})
        `);
      } else {
        await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_questions" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
      }
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_questions" WHERE "topic_id" IN (${Prisma.join(specialPracticeTopicIds)})`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_topics" WHERE "id" IN (${Prisma.join(specialPracticeTopicIds)})`);
    } else {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_questions" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
    }
    if (await tableExists('csca_subject_practice_production_runs')) {
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM "csca_subject_practice_production_runs"
        WHERE "id" IN (
          SELECT DISTINCT "run_id"
          FROM "csca_subject_practice_production_cells"
          WHERE "topic_id" IN (${Prisma.join(topicIds)})
        )
      `);
    }
    if (await tableExists('csca_adaptive_usage_aggregates')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_usage_aggregates" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
    }
    if (await tableExists('csca_adaptive_inventory_snapshots')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_inventory_snapshots" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
    }
    if (await tableExists('csca_adaptive_inventory_events')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_inventory_events" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
    }
    if (await tableExists('csca_learning_cohorts')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_learning_cohorts" WHERE "subject" LIKE 'codex_predictive_%'`);
    }
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_generation_profiles" WHERE "subject" LIKE 'codex_predictive_%'`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_exam_series_profiles" WHERE "subject" LIKE 'codex_predictive_%'`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_source_documents" WHERE "subject" LIKE 'codex_predictive_%'`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_question_style_profiles" WHERE "scope_id" IN (${Prisma.join(topicIds)}) AND "scope_type" = 'topic'`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_question_blueprints" WHERE "topic_id" IN (${Prisma.join(topicIds)})`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_exam_topics" WHERE "id" IN (${Prisma.join(topicIds)})`);
  }

  await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_syllabus_imports" WHERE "syllabus_version" LIKE 'codex-predictive-%'`);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "csca_adaptive_sessions"
    WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE 'codex-predictive-%@example.test')
       OR "subject" LIKE 'codex_predictive_%'
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "organization_members"
    WHERE "organization_id" IN (SELECT "id" FROM "organizations" WHERE "slug" LIKE 'codex-predictive-org-%')
       OR "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE 'codex-predictive-%@example.test')
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "organization_cohorts"
    WHERE "organization_id" IN (SELECT "id" FROM "organizations" WHERE "slug" LIKE 'codex-predictive-org-%')
       OR "slug" LIKE 'codex-predictive-cohort-%'
  `);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "organizations" WHERE "slug" LIKE 'codex-predictive-org-%'`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "users" WHERE "email" LIKE 'codex-predictive-%@example.test'`);
}

function difficultyLabel(difficulty) {
  if (difficulty === 'basic') return '基础';
  if (difficulty === 'hard') return '较难';
  return '中等';
}

async function insertFormalSubjectPracticeQuestion(cell, orderNumber, config = {}) {
  let specialTopicId = created.specialPracticeTopicIds[0] ?? null;
  if (!specialTopicId) {
    const specialTopic = await insertOne(Prisma.sql`
      INSERT INTO "special_practice_topics" (
        "subject", "module", "slug", "title", "description", "overview", "focus_items",
        "difficulty_label", "frequency_label", "question_count", "sort_order", "status", "updated_at"
      )
      VALUES (
        ${subject}, 'codex-fixture', ${`codex-predictive-special-topic-${suffix}`},
        'Predictive replenishment fixture topic',
        'Temporary formal subject-practice topic for predictive replenishment lifecycle verification.',
        'Temporary fixture topic.', ${jsonb(['predictive replenishment lifecycle'])},
        'mixed', 'fixture', 0, 999999, 'published', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);
    specialTopicId = Number(specialTopic.id);
    created.specialPracticeTopicIds.push(specialTopicId);
  }

  const prompt = `Codex lifecycle fixture ${cell.difficultyBand} question ${orderNumber}`;
  const attachProductionMetadata = config.attachProductionMetadata !== false;
  const generationMetadata = {
    generator: 'codex-fixture',
    generationMode: 'subject_practice_production_matrix',
    targetUseCase: 'subject_practice',
    versionGovernance: {
      status: 'current',
      reason: 'predictive_replenishment_smoke',
      targetUseCase: 'subject_practice',
      generationProfileId: created.generationProfileId,
      seriesProfileId: created.seriesProfileId
    },
    ...(attachProductionMetadata
      ? {
        productionRunId: String(created.productionRunId),
        productionCellId: String(cell.id)
      }
      : {
        legacyFixture: true
      }),
    lifecycleFixture: true
  };
  const options = [
    { label: 'A', text: '1' },
    { label: 'B', text: '2' },
    { label: 'C', text: '3' },
    { label: 'D', text: '4' }
  ];
  const specialQuestion = await insertOne(Prisma.sql`
    INSERT INTO "special_practice_questions" (
      "topic_id", "order_number", "difficulty", "question_type", "prompt", "options",
      "correct_answer", "explanation", "knowledge_tags", "localizations", "status", "updated_at"
    )
    VALUES (
      ${specialTopicId}, ${orderNumber}, ${difficultyLabel(cell.difficultyBand)}, 'single-choice',
      ${prompt}, ${jsonb(options)}, 'A', 'Fixture explanation.', ${jsonb([topicCode, cell.difficultyBand])},
      ${jsonb({
        zh: { prompt, options, explanation: 'Fixture explanation.' },
        en: { prompt: `${prompt} (English)`, options, explanation: 'Fixture explanation.' }
      })},
      'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  const specialQuestionId = Number(specialQuestion.id);
  created.specialPracticeQuestionIds.push(specialQuestionId);

  const formalQuestion = await insertOne(Prisma.sql`
    INSERT INTO "csca_questions" (
      "subject", "topic_id", "blueprint_id", "source_type", "source_question_id",
      "designed_difficulty", "difficulty_confidence", "question_type", "prompt", "options",
      "correct_answer", "explanation", "knowledge_tags", "syllabus_version",
      "generation_metadata", "review_metadata", "status", "updated_at"
    )
    VALUES (
      ${subject}, ${created.topicId}, ${created.blueprintIds[0] ?? null}, 'ai', ${specialQuestionId},
      ${cell.difficultyBand}, 1, 'single-choice', ${prompt}, ${jsonb(options)},
      'A', 'Fixture explanation.', ${jsonb([topicCode, cell.difficultyBand])}, ${syllabusVersion},
      ${jsonb(generationMetadata)},
      ${jsonb({
        subjectPracticeAutoApproval: {
          status: 'published_to_subject_practice',
          targetUseCase: 'subject_practice',
          targetQuestionBank: 'special_practice_questions'
        },
        gate: { status: 'passed' }
      })},
      'approved', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  const formalQuestionId = Number(formalQuestion.id);
  created.formalQuestionIds.push(formalQuestionId);

  await insertOne(Prisma.sql`
    INSERT INTO "csca_topic_mappings" ("source_type", "source_id", "topic_id", "confidence", "updated_at")
    VALUES ('special_practice_question', ${specialQuestionId}, ${created.topicId}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("source_type", "source_id", "topic_id") DO UPDATE
    SET "confidence" = EXCLUDED."confidence", "updated_at" = CURRENT_TIMESTAMP
    RETURNING "id"
  `);

  return { specialQuestionId, formalQuestionId };
}

async function insertPublishableProductionCandidate(cell, orderNumber, config = {}) {
  const prompt = `Codex production candidate ${cell.difficultyBand} question ${orderNumber}`;
  const candidateProductionRunId = Number(config.productionRunId ?? created.productionRunId);
  const gapSuffix = config.gapSuffix ?? 'current-run';
  const optionRows = [
    { id: 'A', label: 'A', text: '1' },
    { id: 'B', label: 'B', text: '2' },
    { id: 'C', label: 'C', text: '3' },
    { id: 'D', label: 'D', text: '4' }
  ];
  const generationMetadata = {
    generator: 'codex-fixture',
    generationMode: 'subject_practice_production_matrix',
    intendedUse: 'subject_practice',
    targetUseCase: 'subject_practice',
    versionGovernance: {
      status: 'current',
      reason: 'predictive_replenishment_smoke',
      targetUseCase: 'subject_practice',
      generationProfileId: created.generationProfileId,
      seriesProfileId: created.seriesProfileId
    },
    productionRunId: String(candidateProductionRunId),
    productionCellId: String(cell.id),
    scope: {
      targetUseCase: 'subject_practice',
      intendedUse: 'subject_practice',
      subject,
      topicId: created.topicId,
      gapKey: `${topicCode}:${cell.difficultyBand}:${gapSuffix}`
    },
    localizations: {
      zh: { prompt, options: optionRows, explanation: 'Fixture explanation.' },
      en: { prompt: `${prompt} (English)`, options: optionRows, explanation: 'Fixture explanation.' }
    },
    lifecycleFixture: true
  };
  const candidate = await insertOne(Prisma.sql`
    INSERT INTO "csca_questions" (
      "subject", "topic_id", "blueprint_id", "source_type", "source_question_id",
      "designed_difficulty", "difficulty_confidence", "question_type", "prompt", "options",
      "correct_answer", "explanation", "knowledge_tags", "syllabus_version",
      "generation_metadata", "review_metadata", "status", "updated_at"
    )
    VALUES (
      ${subject}, ${created.topicId}, ${created.blueprintIds[0] ?? null}, 'ai', NULL,
      ${cell.difficultyBand}, 1, 'single-choice', ${prompt}, ${jsonb(optionRows)},
      'A', 'Fixture explanation.', ${jsonb([topicCode, cell.difficultyBand])}, ${syllabusVersion},
      ${jsonb(generationMetadata)},
      ${jsonb({
        status: 'passed',
        decision: 'approve',
        score: 100,
        gate: {
          decision: 'publishable',
          publishable: true,
          score: 100,
          reasons: []
        },
        rubric: {
          answer: 100,
          options: 100,
          explanation: 100,
          difficulty: 100,
          language: 100
        }
      })},
      'pending_review', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  const candidateId = Number(candidate.id);
  created.formalQuestionIds.push(candidateId);
  return candidateId;
}

async function seedStaleSyllabusSubjectPracticeCandidate() {
  const options = [
    { id: 'A', label: 'A', text: '1' },
    { id: 'B', label: 'B', text: '2' },
    { id: 'C', label: 'C', text: '3' },
    { id: 'D', label: 'D', text: '4' }
  ];
  const staleCandidate = await insertOne(Prisma.sql`
    INSERT INTO "csca_questions" (
      "subject", "topic_id", "blueprint_id", "source_type", "source_question_id",
      "designed_difficulty", "difficulty_confidence", "question_type", "prompt", "options",
      "correct_answer", "explanation", "knowledge_tags", "syllabus_version",
      "generation_metadata", "review_metadata", "status", "updated_at"
    )
    VALUES (
      ${subject}, ${created.topicId}, ${created.blueprintIds[0] ?? null}, 'ai', NULL,
      'medium', 1, 'single-choice', 'Codex stale syllabus candidate', ${jsonb(options)},
      'A', 'Fixture explanation.', ${jsonb([topicCode, 'medium'])}, ${`${syllabusVersion}-stale`},
      ${jsonb({
        generator: 'codex-fixture',
        intendedUse: 'subject_practice',
        targetUseCase: 'subject_practice',
        scope: { targetUseCase: 'subject_practice', subject, topicId: created.topicId }
      })},
      ${jsonb({
        subjectPracticeAutoApproval: {
          status: 'passed',
          targetUseCase: 'subject_practice',
          targetQuestionBank: 'special_practice_questions'
        }
      })},
      'pending_review', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.formalQuestionIds.push(Number(staleCandidate.id));
}

async function seedFixture() {
  const user = await insertOne(Prisma.sql`
    INSERT INTO "users" ("email", "role", "status", "display_name", "updated_at")
    VALUES (${userEmail}, 'student', 'active', 'Codex predictive smoke student', CURRENT_TIMESTAMP)
    RETURNING "id"
  `);
  created.userId = user.id;

  const organization = await insertOne(Prisma.sql`
    INSERT INTO "organizations" ("slug", "name", "type", "status", "updated_at")
    VALUES (${organizationSlug}, 'Codex predictive smoke organization', 'school', 'active', CURRENT_TIMESTAMP)
    RETURNING "id"
  `);
  created.organizationId = organization.id;

  const cohort = await insertOne(Prisma.sql`
    INSERT INTO "organization_cohorts" ("organization_id", "slug", "name", "status", "metadata", "updated_at")
    VALUES (${created.organizationId}, ${cohortSlug}, 'Codex predictive smoke cohort', 'active', ${jsonb({ smoke: true })}, CURRENT_TIMESTAMP)
    RETURNING "id"
  `);
  created.organizationCohortId = cohort.id;

  const member = await insertOne(Prisma.sql`
    INSERT INTO "organization_members" ("organization_id", "user_id", "cohort_id", "role", "status", "joined_at", "metadata", "updated_at")
    VALUES (${created.organizationId}, ${created.userId}, ${created.organizationCohortId}, 'student', 'active', CURRENT_TIMESTAMP, ${jsonb({ smoke: true })}, CURRENT_TIMESTAMP)
    RETURNING "id"
  `);
  created.organizationMemberId = member.id;

  const syllabus = await insertOne(Prisma.sql`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary", "applied_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, 'Codex predictive replenishment smoke', 'applied',
      ${jsonb({ topics: [{ code: topicCode, title: 'Predictive replenishment algebra' }] })},
      ${jsonb({ smoke: true, topicCode })},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.syllabusImportId = syllabus.id;

  const topic = await insertOne(Prisma.sql`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version",
      "weight", "allowed_question_types", "difficulty_range", "status", "updated_at"
    )
    VALUES (
      ${subject}, 'codex-smoke', ${topicCode}, 'Predictive replenishment algebra',
      'Temporary topic for predictive replenishment smoke.',
      'Used only by the predictive replenishment smoke test.',
      ${syllabusVersion},
      1,
      ${jsonb(['single-choice'])},
      ${jsonb({ allowed: ['basic', 'medium', 'hard'] })},
      'published',
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.topicId = topic.id;

  const profile = await insertOne(Prisma.sql`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "scope_id", "source_question_ids",
      "sample_size", "confidence", "profile", "profile_version", "source_question_snapshot_hash",
      "status", "generated_by", "generated_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, 'topic', ${created.topicId}, ${jsonb([1, 2, 3])},
      3, 'high',
      ${jsonb({
        questionFormDistribution: { calculation_application: 3 },
        cognitiveSkillDistribution: { standard_application: 3 },
        readingLoadDistribution: { low: 3 },
        calculationLoadDistribution: { medium: 3 },
        difficultyDistribution: { basic: 1, medium: 4, hard: 4 },
        commonQuestionForms: ['calculation_application'],
        commonCognitiveSkills: ['standard_application'],
        commonReadingLoads: ['low'],
        commonCalculationLoads: ['medium'],
        optionPatterns: {
          commonDistractorTypes: ['calculation_error'],
          commonMisconceptions: ['sign_error']
        },
        estimatedTimeSeconds: { p50: 90, p90: 150 }
      })},
      1,
      ${`codex-predictive-smoke-${suffix}`},
      'active',
      'rule',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.styleProfileId = profile.id;

  for (const difficulty of ['basic', 'medium', 'hard']) {
    const blueprint = await insertOne(Prisma.sql`
      INSERT INTO "csca_question_blueprints" (
        "subject", "topic_id", "difficulty", "question_type", "skill", "source", "constraints", "status", "updated_at"
      )
      VALUES (
        ${subject}, ${created.topicId}, ${difficulty}, 'single-choice', 'standard_application',
        'codex-smoke', ${jsonb({ smoke: true, syllabusVersion })}, 'active', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);
    created.blueprintIds.push(blueprint.id);
  }

  await seedCurrentPastPaperGenerationProfile();

}

async function activeSyllabusSnapshotHash() {
  const [row] = await prisma.$queryRaw(Prisma.sql`
    SELECT "id", "raw_json" AS "rawJson", "applied_at" AS "appliedAt", "updated_at" AS "updatedAt"
    FROM "csca_syllabus_imports"
    WHERE "id" = ${created.syllabusImportId}
    LIMIT 1
  `);
  assert(row, 'Predictive smoke must have an applied syllabus import before profile seeding.');
  return sha256Text({
    subject,
    syllabusVersion,
    syllabusImportId: Number(row.id),
    rawJson: row.rawJson,
    appliedAt: row.appliedAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null
  });
}

async function activePastPaperSourceSnapshotHash() {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT q."id", q."document_id" AS "documentId", q."prompt_hash" AS "promptHash",
           q."topic_id" AS "topicId", q."topic_codes" AS "topicCodes",
           q."analysis_status" AS "analysisStatus", q."analysis_confidence" AS "analysisConfidence",
           q."auto_profile_status" AS "autoProfileStatus", q."updated_at" AS "updatedAt"
    FROM "csca_source_questions" q
    JOIN "csca_source_documents" d ON d."id" = q."document_id"
    WHERE q."subject" = ${subject}
      AND q."syllabus_version" = ${syllabusVersion}
      AND d."subject" = ${subject}
      AND d."source_type" = 'past_paper'
      AND d."status" = 'active'
      AND d."usage_policy"->>'allowStyleExtraction' <> 'false'
      AND q."auto_profile_status" = 'auto_approved'
    ORDER BY d."exam_year" ASC NULLS LAST, d."exam_session" ASC NULLS LAST, d."id" ASC, q."id" ASC
    LIMIT 2000
  `);
  assert(rows.length > 0, 'Predictive smoke must have approved past-paper source questions before profile seeding.');
  const documentIds = Array.from(new Set(rows.map((row) => Number(row.documentId)).filter((id) => Number.isInteger(id) && id > 0)));
  const sourceQuestionIds = rows.map((row) => Number(row.id));
  return {
    sourceSnapshotHash: sha256Text({
      subject,
      syllabusVersion,
      sourceKind: 'past_paper',
      sourceDocumentIds: documentIds,
      sourceQuestionIds,
      questions: rows.map((row) => ({
        id: Number(row.id),
        documentId: Number(row.documentId),
        promptHash: row.promptHash,
        topicId: row.topicId === null ? null : Number(row.topicId),
        topicCodes: row.topicCodes,
        analysisStatus: row.analysisStatus,
        analysisConfidence: row.analysisConfidence === null ? null : Number(row.analysisConfidence),
        autoProfileStatus: row.autoProfileStatus,
        updatedAt: row.updatedAt?.toISOString?.() ?? null
      }))
    }),
    sourceQuestionIds
  };
}

async function seedCurrentPastPaperGenerationProfile() {
  const document = await insertOne(Prisma.sql`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language", "file_hash",
      "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${subject}, 'past_paper', ${`Predictive replenishment smoke past paper ${suffix}`},
      2026, '2026-smoke', 'en', ${sha256Text({ subject, syllabusVersion, suffix, kind: 'past_paper' })},
      ${`Predictive replenishment smoke ${suffix}`}, 'internal_analysis',
      ${jsonb({ allowStyleExtraction: true, allowSimilarityReference: true, allowDirectReuse: false })},
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.sourceDocumentId = Number(document.id);

  for (const [index, difficulty] of ['basic', 'medium', 'hard'].entries()) {
    const question = await insertOne(Prisma.sql`
      INSERT INTO "csca_source_questions" (
        "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
        "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
        "analysis", "analysis_status", "analysis_confidence", "analysis_issues", "review_status",
        "auto_profile_status", "auto_profile_attempts", "auto_profile_decided_at", "auto_profile_decision",
        "auto_profile_gate_result", "updated_at"
      )
      VALUES (
        ${created.sourceDocumentId}, ${subject}, ${String(index + 1)}, 'en',
        ${sha256Text({ subject, syllabusVersion, suffix, sourceQuestion: index + 1 })},
        ${`Predictive replenishment smoke source question ${index + 1}`},
        ${jsonb([
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' }
        ])},
        'A', 'Fixture source explanation.', ${syllabusVersion}, ${created.topicId}, ${jsonb([topicCode])},
        ${jsonb(sourceQuestionAnalysis(difficulty))},
        'ai_parsed', 0.96, '[]'::jsonb, 'approved',
        'auto_approved', 1, CURRENT_TIMESTAMP,
        ${jsonb({ decision: 'auto_approved', source: 'predictive_replenishment_smoke' })},
        ${jsonb({ gate: { decision: 'passed', score: 96 } })},
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);
    created.sourceQuestionIds.push(Number(question.id));
  }

  const syllabusSnapshotHash = await activeSyllabusSnapshotHash();
  const { sourceSnapshotHash, sourceQuestionIds } = await activePastPaperSourceSnapshotHash();
  const trendProfile = {
    schemaVersion: 'csca-exam-series-profile-v1',
    subject,
    syllabusVersion,
    sourceSnapshotHash,
    syllabusSnapshotHash,
    normalizedTargets: {
      onlineMockExam: {
        targetCount: 48,
        distributions: {
          difficulty: { basic: 16, medium: 16, hard: 16 },
          questionForm: { calculation_application: 48 },
          cognitiveSkill: { standard_application: 48 }
        }
      }
    },
    distributions: {
      difficulty: { basic: 1, medium: 1, hard: 1 },
      questionForm: { calculation_application: 3 },
      cognitiveSkill: { standard_application: 3 }
    }
  };
  const seriesProfile = await insertOne(Prisma.sql`
    INSERT INTO "csca_exam_series_profiles" (
      "subject", "syllabus_version", "title", "source_document_ids", "source_style_profile_ids",
      "source_question_ids", "session_summary", "trend_profile", "sample_size", "confidence",
      "status", "generated_by", "generated_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, ${`Predictive replenishment smoke trend ${suffix}`},
      ${jsonb([created.sourceDocumentId])}, ${jsonb([created.styleProfileId])},
      ${jsonb(sourceQuestionIds)}, ${jsonb({ sessions: ['2026-smoke'], smoke: true })},
      ${jsonb(trendProfile)}, ${sourceQuestionIds.length}, 'high',
      'active', 'smoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.seriesProfileId = Number(seriesProfile.id);

  const generationProfile = {
    schemaVersion: 'csca-generation-profile-v1',
    subject,
    syllabusVersion,
    useCase: 'subject_practice',
    seriesProfileId: created.seriesProfileId,
    sourceSnapshotHash,
    syllabusSnapshotHash,
    targetProfile: {
      topicId: created.topicId,
      topicCode,
      difficultyDistribution: { basic: 1, medium: 1, hard: 1 },
      questionFormDistribution: { calculation_application: 3 },
      cognitiveSkillDistribution: { standard_application: 3 }
    }
  };
  const profile = await insertOne(Prisma.sql`
    INSERT INTO "csca_generation_profiles" (
      "subject", "syllabus_version", "use_case", "title", "series_profile_id", "source_style_profile_id",
      "profile", "target_policy", "sample_size", "confidence", "status", "generated_by", "generated_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, 'subject_practice', ${`Predictive replenishment smoke subject profile ${suffix}`},
      ${created.seriesProfileId}, ${created.styleProfileId}, ${jsonb(generationProfile)},
      ${jsonb({
        sourceSnapshotHash,
        syllabusSnapshotHash,
        seriesProfileId: created.seriesProfileId,
        targetUseCase: 'subject_practice'
      })},
      ${sourceQuestionIds.length}, 'high', 'active', 'smoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  created.generationProfileId = Number(profile.id);
}

async function seedLowPressureAdaptiveUsageSample() {
  const session = await insertOne(Prisma.sql`
    INSERT INTO "csca_adaptive_sessions" ("user_id", "subject", "mode", "status", "question_language", "updated_at")
    VALUES (${created.userId}, ${subject}, 'practice', 'active', 'zh', CURRENT_TIMESTAMP)
    RETURNING "id"
  `);
  created.adaptiveSessionId = Number(session.id);
  const round = await insertOne(Prisma.sql`
    INSERT INTO "csca_adaptive_rounds" (
      "session_id", "round_index", "status", "planner_snapshot", "answers", "time_spent",
      "current_question", "correct_count", "wrong_count", "unanswered_count", "updated_at"
    )
    VALUES (
      ${created.adaptiveSessionId}, 1, 'active', ${jsonb({ smoke: true })}, ${jsonb({})}, ${jsonb({})},
      1, 0, 0, 1, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
  await insertOne(Prisma.sql`
    INSERT INTO "csca_adaptive_round_items" (
      "round_id", "question_id", "question_source", "topic_id", "planned_difficulty", "position", "time_spent_seconds", "updated_at"
    )
    VALUES (
      ${round.id}, 900001, 'special_practice', ${created.topicId}, 'medium', 1, 30, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);
}

async function seedInventoryEvents() {
  const teamKey = `organization:${created.organizationId}:cohort:${created.organizationCohortId}`;
  for (const difficulty of ['basic', 'medium', 'hard']) {
    const event = await insertOne(Prisma.sql`
      INSERT INTO "csca_adaptive_inventory_events" (
        "user_id", "organization_id", "organization_cohort_id", "team_key",
        "subject", "topic_id", "difficulty_band", "question_type", "event_type", "metadata"
      )
      VALUES (
        ${created.userId}, ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
        ${subject}, ${created.topicId}, ${difficulty}, 'single-choice', 'no_question_available',
        ${jsonb({ smoke: true, reason: 'predictive_replenishment_smoke' })}
      )
      RETURNING "id"
    `);
    created.inventoryEventIds.push(event.id);
  }
}

async function seedExpiredInventoryEvents() {
  const teamKey = `organization:${created.organizationId}:cohort:${created.organizationCohortId}`;
  for (const difficulty of ['basic', 'medium', 'hard']) {
    const event = await insertOne(Prisma.sql`
      INSERT INTO "csca_adaptive_inventory_events" (
        "user_id", "organization_id", "organization_cohort_id", "team_key",
        "subject", "topic_id", "difficulty_band", "question_type", "event_type", "metadata", "created_at"
      )
      VALUES (
        ${created.userId}, ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
        ${subject}, ${created.topicId}, ${difficulty}, 'single-choice', 'no_question_available',
        ${jsonb({ smoke: true, reason: 'expired_predictive_replenishment_pressure' })},
        NOW() - INTERVAL '90 days'
      )
      RETURNING "id"
    `);
    created.inventoryEventIds.push(event.id);
  }
}

async function seedExpiredTeamPressureAggregate() {
  const teamKey = `organization:${created.organizationId}:cohort:${created.organizationCohortId}`;
  if (created.learningCohortId) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_learning_cohorts"
      SET "status" = 'active',
          "target_exam_at" = CURRENT_TIMESTAMP - INTERVAL '20 days',
          "metadata" = ${jsonb({ smoke: true, reason: 'expired_team_pressure_gate' })},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${created.learningCohortId}
    `);
  } else {
    const cohort = await insertOne(Prisma.sql`
      INSERT INTO "csca_learning_cohorts" (
        "name", "subject", "source", "status", "organization_id", "organization_cohort_id", "team_key",
        "target_exam_at", "metadata", "updated_at"
      )
      VALUES (
        'Codex expired predictive smoke cohort', ${subject}, 'organization_cohort', 'active',
        ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
        CURRENT_TIMESTAMP - INTERVAL '20 days',
        ${jsonb({ smoke: true, reason: 'expired_team_pressure_gate' })}, CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);
    created.learningCohortId = Number(cohort.id);
  }
  await insertOne(Prisma.sql`
    WITH usage_window AS (
      SELECT
        date_trunc('day', NOW() - INTERVAL '30 days') AS "windowStart",
        date_trunc('day', NOW()) + INTERVAL '1 day' AS "windowEnd"
    )
    INSERT INTO "csca_adaptive_usage_aggregates" (
      "user_id", "cohort_id", "organization_id", "organization_cohort_id", "team_key",
      "subject", "topic_id", "difficulty_band", "question_type", "window_start", "window_end",
      "exposure_count", "attempt_count", "unique_user_count", "correct_count", "wrong_count",
      "repeat_exposure_count", "fallback_draw_count", "no_question_error_count", "average_response_time_ms",
      "metadata", "updated_at"
    )
    SELECT
      NULL, NULL, ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
      ${subject}, ${created.topicId}, 'medium', 'single-choice', usage_window."windowStart", usage_window."windowEnd",
      0, 24, 12, 0, 0,
      0, 0, 0, NULL,
      ${jsonb({ source: 'codex_inactive_team_pressure', smoke: true })}, CURRENT_TIMESTAMP
    FROM usage_window
    RETURNING "id"
  `);
}

async function seedCoolingTeamSoftPressureAggregate() {
  const teamKey = `organization:${created.organizationId}:cohort:${created.organizationCohortId}`;
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "csca_learning_cohorts"
    SET "status" = 'cooling',
        "target_exam_at" = NULL,
        "end_at" = NULL,
        "metadata" = ${jsonb({ smoke: true, reason: 'cooling_soft_pressure_gate' })},
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${created.learningCohortId}
  `);
  await insertOne(Prisma.sql`
    WITH usage_window AS (
      SELECT
        date_trunc('day', NOW() - INTERVAL '30 days') AS "windowStart",
        date_trunc('day', NOW()) + INTERVAL '1 day' AS "windowEnd"
    )
    INSERT INTO "csca_adaptive_usage_aggregates" (
      "user_id", "cohort_id", "organization_id", "organization_cohort_id", "team_key",
      "subject", "topic_id", "difficulty_band", "question_type", "window_start", "window_end",
      "exposure_count", "attempt_count", "unique_user_count", "correct_count", "wrong_count",
      "repeat_exposure_count", "fallback_draw_count", "no_question_error_count", "average_response_time_ms",
      "metadata", "updated_at"
    )
    SELECT
      NULL, NULL, ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
      ${subject}, ${created.topicId}, 'medium', 'single-choice', usage_window."windowStart", usage_window."windowEnd",
      0, 24, 12, 0, 0,
      0, 0, 0, NULL,
      ${jsonb({ source: 'codex_cooling_team_soft_pressure', smoke: true })}, CURRENT_TIMESTAMP
    FROM usage_window
    RETURNING "id"
  `);
}

async function setTeamCohortCoolingForSeverePressure() {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "csca_learning_cohorts"
    SET "status" = 'cooling',
        "target_exam_at" = NULL,
        "end_at" = NULL,
        "metadata" = ${jsonb({ smoke: true, reason: 'cooling_severe_pressure_gate' })},
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${created.learningCohortId}
  `);
}

async function seedInactiveTeamOnlyInventoryEvent() {
  const teamKey = `organization:${created.organizationId}:cohort:${created.organizationCohortId}`;
  const event = await insertOne(Prisma.sql`
    INSERT INTO "csca_adaptive_inventory_events" (
      "user_id", "organization_id", "organization_cohort_id", "team_key",
      "subject", "topic_id", "difficulty_band", "question_type", "event_type", "metadata"
    )
    VALUES (
      NULL, ${created.organizationId}, ${created.organizationCohortId}, ${teamKey},
      ${subject}, ${created.topicId}, 'medium', 'single-choice', 'no_question_available',
      ${jsonb({ smoke: true, reason: 'inactive_team_only_shortage_pressure' })}
    )
    RETURNING "id"
  `);
  created.inventoryEventIds.push(event.id);
  return Number(event.id);
}

async function cleanup() {
  if (created.specialPracticeQuestionIds.length) {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'special_practice_question'
        AND "source_id" IN (${Prisma.join(created.specialPracticeQuestionIds)})
    `);
  }
  if (created.formalQuestionIds.length) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_questions" WHERE "id" IN (${Prisma.join(created.formalQuestionIds)})`);
  }
  if (created.specialPracticeQuestionIds.length) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_questions" WHERE "id" IN (${Prisma.join(created.specialPracticeQuestionIds)})`);
  }
  if (created.specialPracticeTopicIds.length) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_topics" WHERE "id" IN (${Prisma.join(created.specialPracticeTopicIds)})`);
  }
  if (created.productionRunId) {
    if (await tableExists('csca_subject_practice_production_runs')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_subject_practice_production_runs" WHERE "id" = ${created.productionRunId}`);
    }
  }
  if (created.generationProfileId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_generation_profiles" WHERE "id" = ${created.generationProfileId}`);
  }
  if (created.seriesProfileId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_exam_series_profiles" WHERE "id" = ${created.seriesProfileId}`);
  }
  if (created.sourceDocumentId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_source_documents" WHERE "id" = ${created.sourceDocumentId}`);
  }
  if (created.topicId) {
    if (await tableExists('csca_adaptive_usage_aggregates')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_usage_aggregates" WHERE "topic_id" = ${created.topicId}`);
    }
    if (await tableExists('csca_adaptive_inventory_snapshots')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_inventory_snapshots" WHERE "topic_id" = ${created.topicId}`);
    }
    if (await tableExists('csca_adaptive_inventory_events')) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_inventory_events" WHERE "topic_id" = ${created.topicId}`);
    }
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_question_style_profiles" WHERE "scope_id" = ${created.topicId} AND "scope_type" = 'topic'`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_question_blueprints" WHERE "topic_id" = ${created.topicId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.topicId}`);
  }
  if (created.syllabusImportId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_syllabus_imports" WHERE "id" = ${created.syllabusImportId}`);
  }
  if (created.adaptiveSessionId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_adaptive_sessions" WHERE "id" = ${created.adaptiveSessionId}`);
  }
  if (created.learningCohortId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_learning_cohorts" WHERE "id" = ${created.learningCohortId}`);
  }
  if (created.organizationMemberId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "organization_members" WHERE "id" = ${created.organizationMemberId}`);
  }
  if (created.organizationCohortId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "organization_cohorts" WHERE "id" = ${created.organizationCohortId}`);
  }
  if (created.organizationId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "organizations" WHERE "id" = ${created.organizationId}`);
  }
  if (created.userId) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "users" WHERE "id" = ${created.userId}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for predictive replenishment database smoke.');
  }

  await cleanupSmokeOrphans();
  await ensureRequiredTables();
  await seedFixture();
  await seedLowPressureAdaptiveUsageSample();
  const { adaptiveReplenishment, service } = makeService();
  service.kickSubjectPracticeProductionRunner = () => undefined;

  await seedStaleSyllabusSubjectPracticeCandidate();
  const staleInventory = await adaptiveReplenishment.inventory({ subject, topicId: created.topicId, persistSnapshot: false });
  const staleCandidateCount = (staleInventory.items ?? [])
    .filter((item) => Number(item.topicId) === Number(created.topicId))
    .reduce((sum, item) => sum + Number(item.candidateCount ?? 0), 0);
  assert(
    staleCandidateCount === 0,
    `stale syllabus AI candidates must not count toward current inventory candidates: ${JSON.stringify(staleInventory.items ?? [])}`
  );

  const noPressureResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (noPressureResult.items ?? []).some((item) => item.action === 'skip' && item.reason === 'no_recent_usage_pressure'),
    `predictive replenishment should skip quiet topics without recent pressure: ${JSON.stringify(noPressureResult.items ?? [])}`
  );
  const noPressureRunRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = ${subject}
  `);
  assert(Number(noPressureRunRows[0]?.count ?? 0) === 0, 'predictive replenishment must not create production runs without recent usage pressure');
  assert(Number(noPressureResult.usage?.touchedCycles ?? 0) >= 1, `usage refresh should maintain student learning cycles: ${JSON.stringify(noPressureResult.usage ?? {})}`);
  assert(Number(noPressureResult.usage?.touchedCohorts ?? 0) >= 1, `usage refresh should maintain team learning cohorts: ${JSON.stringify(noPressureResult.usage ?? {})}`);
  const maintainedCycleRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_student_learning_cycles"
    WHERE "user_id" = ${created.userId}
      AND "subject" = ${subject}
      AND "status" = 'active'
  `);
  assert(Number(maintainedCycleRows[0]?.count ?? 0) >= 1, 'usage refresh should persist an active student learning cycle');
  const maintainedCohortRows = await prisma.$queryRaw(Prisma.sql`
    SELECT "id", "status"
    FROM "csca_learning_cohorts"
    WHERE "subject" = ${subject}
      AND "organization_id" = ${created.organizationId}
      AND "organization_cohort_id" = ${created.organizationCohortId}
    ORDER BY "id" ASC
    LIMIT 1
  `);
  created.learningCohortId = Number(maintainedCohortRows[0]?.id ?? 0) || null;
  assert(created.learningCohortId && maintainedCohortRows[0]?.status === 'active', `usage refresh should persist an active team learning cohort: ${JSON.stringify(maintainedCohortRows[0] ?? null)}`);

  await seedCoolingTeamSoftPressureAggregate();
  const coolingSoftPressureResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (coolingSoftPressureResult.items ?? []).some((item) => item.action === 'skip' && item.reason === 'no_recent_usage_pressure'),
    `cooling team soft usage pressure must not drive predictive replenishment runs: ${JSON.stringify(coolingSoftPressureResult.items ?? [])}`
  );
  const coolingCohortRows = await prisma.$queryRaw(Prisma.sql`
    SELECT "status"
    FROM "csca_learning_cohorts"
    WHERE "id" = ${created.learningCohortId}
  `);
  assert(coolingCohortRows[0]?.status === 'cooling', `cooling team cohort should not be auto-promoted by soft usage: ${JSON.stringify(coolingCohortRows[0] ?? null)}`);
  const coolingSoftPressureRunRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = ${subject}
  `);
  assert(Number(coolingSoftPressureRunRows[0]?.count ?? 0) === 0, 'cooling soft team pressure must not create production runs');

  await seedExpiredTeamPressureAggregate();
  const inactiveTeamResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (inactiveTeamResult.items ?? []).some((item) => item.action === 'skip' && item.reason === 'no_recent_usage_pressure'),
    `inactive/completed team cohorts must not drive predictive replenishment runs: ${JSON.stringify(inactiveTeamResult.items ?? [])}`
  );
  assert(
    Number(inactiveTeamResult.usage?.expiredCohorts ?? 0) >= 1,
    `expired team cohorts should be marked inactive during usage refresh: ${JSON.stringify(inactiveTeamResult.usage ?? {})}`
  );
  const expiredCohortRows = await prisma.$queryRaw(Prisma.sql`
    SELECT "status", "inactive_at" AS "inactiveAt"
    FROM "csca_learning_cohorts"
    WHERE "id" = ${created.learningCohortId}
  `);
  assert(
    expiredCohortRows[0]?.status === 'inactive' && expiredCohortRows[0]?.inactiveAt,
    `expired team cohort should become inactive before demand selection: ${JSON.stringify(expiredCohortRows[0] ?? null)}`
  );
  const inactiveTeamRunRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = ${subject}
  `);
  assert(Number(inactiveTeamRunRows[0]?.count ?? 0) === 0, 'inactive team pressure must not create production runs');

  const inactiveTeamOnlyEventId = await seedInactiveTeamOnlyInventoryEvent();
  const inactiveTeamOnlyAggregateResult = await service.refreshAdaptiveUsageAggregates({ subject, days: 30 });
  assert(
    Number(inactiveTeamOnlyAggregateResult.scopes?.events ?? 0) >= 1,
    `inactive team-only shortage event should be aggregated for audit: ${JSON.stringify(inactiveTeamOnlyAggregateResult)}`
  );
  const inactiveTeamOnlyResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (inactiveTeamOnlyResult.items ?? []).some((item) => item.action === 'skip' && item.reason === 'no_recent_usage_pressure'),
    `inactive team-only shortage pressure must not bypass cohort status through global aggregates: ${JSON.stringify(inactiveTeamOnlyResult.items ?? [])}`
  );
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "csca_adaptive_inventory_events"
    WHERE "id" = ${inactiveTeamOnlyEventId}
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "csca_adaptive_usage_aggregates"
    WHERE "topic_id" = ${created.topicId}
  `);

  await seedExpiredInventoryEvents();
  const expiredPressureAggregateResult = await service.refreshAdaptiveUsageAggregates({ subject, days: 30 });
  assert(
    Number(expiredPressureAggregateResult.scopes?.events ?? 0) === 0,
    `expired shortage events outside the pressure window must not enter current aggregates: ${JSON.stringify(expiredPressureAggregateResult)}`
  );
  const expiredPressureResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (expiredPressureResult.items ?? []).some((item) => item.action === 'skip' && item.reason === 'no_recent_usage_pressure'),
    `stale shortage events outside the pressure window must not trigger predictive replenishment: ${JSON.stringify(expiredPressureResult.items ?? [])}`
  );
  const expiredPressureRunRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = ${subject}
  `);
  assert(Number(expiredPressureRunRows[0]?.count ?? 0) === 0, 'expired pressure must not create production runs');

  await setTeamCohortCoolingForSeverePressure();
  await seedInventoryEvents();
  const aggregateResult = await service.refreshAdaptiveUsageAggregates({ subject, days: 30 });
  assert(Number(aggregateResult.scopes?.events ?? 0) >= 3, 'shortage events were not aggregated');

  const inventory = await adaptiveReplenishment.inventory({ subject, topicId: created.topicId, persistSnapshot: true });
  assert(inventory.items.some((item) => item.topicId === created.topicId && Number(item.noQuestionErrorCount ?? 0) > 0), 'inventory did not reflect shortage pressure');
  const expectedPredictiveTargetTotal = (inventory.items ?? [])
    .filter((item) => Number(item.topicId) === Number(created.topicId))
    .reduce((sum, item) => sum + Math.max(0, Number(item.requiredPublishedCount ?? 0) || 0), 0);
  const expectedPredictiveTargetsByDifficulty = (inventory.items ?? [])
    .filter((item) => Number(item.topicId) === Number(created.topicId))
    .reduce((map, item) => {
      const difficulty = String(item.difficultyBand || '').trim();
      const requiredPublishedCount = Math.max(0, Number(item.requiredPublishedCount ?? 0) || 0);
      if (difficulty && requiredPublishedCount > 0) map.set(difficulty, (map.get(difficulty) ?? 0) + requiredPublishedCount);
      return map;
    }, new Map());
  assert(expectedPredictiveTargetTotal > 0, `inventory should expose required published gaps before predictive production: ${JSON.stringify(inventory.items ?? [])}`);
  const snapshotRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_adaptive_inventory_snapshots"
    WHERE "topic_id" = ${created.topicId}
  `);
  const snapshotCount = Number(snapshotRows[0]?.count ?? 0);
  assert(snapshotCount > 0, 'inventory snapshots were not persisted');

  const runResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });

  const createdItem = (runResult.items ?? []).find((item) => item.action === 'created_run' || item.action === 'existing_run');
  assert(createdItem, `cooling team severe shortage pressure should create a predictive replenishment run: ${JSON.stringify(runResult.items ?? [])}`);
  assert(createdItem.action === 'created_run' || createdItem.action === 'existing_run', `unexpected predictive action: ${createdItem.action}`);

  const runId = Number(createdItem.runId ?? createdItem.run?.id);
  assert(Number.isInteger(runId) && runId > 0, 'predictive replenishment did not return a production run id');
  created.productionRunId = runId;

  const runRows = await prisma.$queryRaw(Prisma.sql`
    SELECT "plan"
    FROM "csca_subject_practice_production_runs"
    WHERE "id" = ${runId}
  `);
  const requestedTopicIds = Array.isArray(runRows[0]?.plan?.requestedTopicIds) ? runRows[0].plan.requestedTopicIds.map(Number) : [];
  assert(requestedTopicIds.includes(created.topicId), 'production run was created without the shortage topic');

  const initialRun = await service.subjectPracticeProductionRun(runId);
  assert(initialRun.status !== 'completed', 'production run should not complete before target counts are filled');
  assert(Number(initialRun.openTotal ?? 0) > 0, 'production run should expose open target count before formal questions exist');
  assert(
    Number(initialRun.targetTotal ?? 0) === expectedPredictiveTargetTotal,
    `predictive production targetTotal must equal requiredPublishedCount gaps, not full cycle target stock: ${JSON.stringify({
      expectedPredictiveTargetTotal,
      targetTotal: initialRun.targetTotal,
      difficultyProgress: initialRun.difficultyProgress
    })}`
  );

  const cells = await prisma.$queryRaw(Prisma.sql`
    SELECT "id", "difficulty_band" AS "difficultyBand", "status", "target_count" AS "targetCount", "candidate_limit" AS "candidateLimit"
    FROM "csca_subject_practice_production_cells"
    WHERE "run_id" = ${runId}
      AND "topic_id" = ${created.topicId}
    ORDER BY "difficulty_band" ASC
  `);
  assert(cells.length >= 3, 'production run did not create difficulty cells');
  assert(cells.some((cell) => cell.difficultyBand === 'basic'), 'production run missing basic cell');
  assert(cells.some((cell) => cell.difficultyBand === 'medium'), 'production run missing medium cell');
  assert(cells.some((cell) => cell.difficultyBand === 'hard'), 'production run missing hard cell');
  assert(cells.every((cell) => cell.status === 'open'), 'production cells should be open with complete style profile');
  const actualProductionTargetsByDifficulty = cells.reduce((map, cell) => {
    const difficulty = String(cell.difficultyBand || '').trim();
    const targetCount = Math.max(0, Number(cell.targetCount ?? 0) || 0);
    if (difficulty && targetCount > 0) map.set(difficulty, (map.get(difficulty) ?? 0) + targetCount);
    return map;
  }, new Map());
  for (const [difficulty, expectedTarget] of expectedPredictiveTargetsByDifficulty.entries()) {
    assert(
      actualProductionTargetsByDifficulty.get(difficulty) === expectedTarget,
      `predictive production cell target must equal requiredPublishedCount for ${difficulty}: ${JSON.stringify({
        expected: Object.fromEntries(expectedPredictiveTargetsByDifficulty.entries()),
        actual: Object.fromEntries(actualProductionTargetsByDifficulty.entries()),
        cells
      })}`
    );
  }
  for (const cell of cells) {
    const targetCount = Number(cell.targetCount ?? 0);
    const expectedCandidateLimit = Math.min(120, Math.max(12, targetCount * 6, Math.ceil(targetCount * 2)));
    assert(Number(cell.candidateLimit ?? 0) === expectedCandidateLimit, `candidate budget should be derived from target gap and capped: ${JSON.stringify(cell)}`);
  }

  const legacyFormal = await insertFormalSubjectPracticeQuestion(cells[0], 900001, { attachProductionMetadata: false });
  const runAfterLegacyFormal = await service.subjectPracticeProductionRun(runId);
  assert(
    Number(runAfterLegacyFormal.publishedTotal ?? 0) === 0,
    'legacy formal subject-practice AI questions without production run/cell metadata must not count toward this production run'
  );
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "csca_topic_mappings"
    WHERE "source_type" = 'special_practice_question'
      AND "source_id" = ${legacyFormal.specialQuestionId}
  `);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_questions" WHERE "id" = ${legacyFormal.formalQuestionId}`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_questions" WHERE "id" = ${legacyFormal.specialQuestionId}`);

  const currentRunCandidateId = await insertPublishableProductionCandidate(cells[0], 900002);
  const approvedCurrentRunCandidate = await service.approveQuestion(currentRunCandidateId, { autoSubjectPractice: true });
  assert(
    approvedCurrentRunCandidate?.status === 'approved' && Number(approvedCurrentRunCandidate?.sourceQuestionId) > 0,
    'production-run candidate should auto-publish according to its current production cell, not the legacy topic gap snapshot'
  );
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "csca_topic_mappings"
    WHERE "source_type" = 'special_practice_question'
      AND "source_id" = ${Number(approvedCurrentRunCandidate.sourceQuestionId)}
  `);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_questions" WHERE "id" = ${currentRunCandidateId}`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "special_practice_questions" WHERE "id" = ${Number(approvedCurrentRunCandidate.sourceQuestionId)}`);
  await service.subjectPracticeProductionRun(runId);

  const crossRunCandidateId = await insertPublishableProductionCandidate(cells[0], 900003, {
    productionRunId: Number(created.productionRunId) + 9999,
    gapSuffix: 'cross-run'
  });
  await service.processSubjectPracticeProductionRun(runId, {
    maxJobs: 1,
    maxJobsPerDifficulty: 1,
    maxRounds: 1,
    untilComplete: false
  });
  const [crossRunCandidate] = await prisma.$queryRaw(Prisma.sql`
    SELECT "status", "source_question_id" AS "sourceQuestionId"
    FROM "csca_questions"
    WHERE "id" = ${crossRunCandidateId}
    LIMIT 1
  `);
  assert(
    crossRunCandidate?.status === 'pending_review' && crossRunCandidate?.sourceQuestionId === null,
    'current production run must not auto-approve or mutate candidates from another productionRunId'
  );

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "csca_subject_practice_production_runs"
    SET "max_no_progress_rounds" = 1, "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${runId}
  `);
  const noProgressResult = await service.processSubjectPracticeProductionRun(runId, {
    maxJobs: 1,
    maxJobsPerDifficulty: 1,
    maxRounds: 1,
    untilComplete: false
  });
  assert(noProgressResult.run?.status === 'blocked', 'production run should block after a no-progress round when max_no_progress_rounds is reached');
  assert(noProgressResult.run?.blockedReasonCode === 'no_progress', `unexpected blocked reason: ${noProgressResult.run?.blockedReasonCode}`);

  let orderNumber = 1;
  for (const cell of cells) {
    for (let index = 0; index < Number(cell.targetCount ?? 0); index += 1) {
      await insertFormalSubjectPracticeQuestion(cell, orderNumber);
      orderNumber += 1;
    }
  }
  const completedRun = await service.subjectPracticeProductionRun(runId);
  assert(completedRun.status === 'completed', `production run should complete after all target counts are filled, got ${completedRun.status}`);
  assert(Number(completedRun.openTotal ?? -1) === 0, 'completed production run should have zero open total');
  assert(Number(completedRun.publishedTotal ?? 0) === Number(completedRun.targetTotal ?? -1), 'completed production run should have published total equal target total');
  assert((completedRun.cells ?? []).every((cell) => cell.status === 'fulfilled'), 'all production cells should be fulfilled after target counts are filled');

  const fulfilledCell = (completedRun.cells ?? [])[0];
  assert(fulfilledCell, 'completed production run should expose fulfilled cells');
  const staleJobEnqueue = await service.enqueueGenerationJobs({
    blueprintIds: [created.blueprintIds[0]],
    limit: 1,
    force: true,
    expand: true,
    count: 1,
    perBlueprint: 1,
    batchId: `fulfilled-cell-${suffix}`,
    generationMode: 'subject_practice_production_matrix',
    productionRunId: runId,
    productionCellId: Number(fulfilledCell.id),
    productionGapKey: fulfilledCell.targetProfile?.gapKey,
    targetProfile: fulfilledCell.targetProfile
  });
  const staleJobId = Number(staleJobEnqueue.items?.[0]?.id);
  assert(Number.isInteger(staleJobId) && staleJobId > 0, `failed to enqueue fulfilled-cell guard job: ${JSON.stringify(staleJobEnqueue)}`);
  const staleJobProcessed = await service.processGenerationJob(staleJobId, { force: true, allowFailed: false, allowStaleRunning: false });
  assert(
    staleJobProcessed?.status === 'archived'
      && staleJobProcessed?.promptMetadata?.archiveNote === 'subject_practice_production_cell_already_fulfilled',
    `queued production job for a fulfilled cell must be archived before provider execution: ${JSON.stringify(staleJobProcessed)}`
  );

  const completedInventory = await adaptiveReplenishment.inventory({ subject, topicId: created.topicId, persistSnapshot: false });
  const inventoryTotals = (completedInventory.items ?? []).reduce(
    (acc, item) => {
      acc.manualStock += Number(item.manualStock ?? 0);
      acc.aiFormalStock += Number(item.aiFormalStock ?? 0);
      acc.globalEffectiveStock += Number(item.globalEffectiveStock ?? 0);
      return acc;
    },
    { manualStock: 0, aiFormalStock: 0, globalEffectiveStock: 0 }
  );
  assert(inventoryTotals.manualStock === 0, `AI-backed formal questions must not be double-counted as manual stock: ${JSON.stringify(inventoryTotals)}`);
  assert(inventoryTotals.aiFormalStock === Number(completedRun.targetTotal ?? 0), `AI formal stock should equal completed target total: ${JSON.stringify(inventoryTotals)}`);
  assert(inventoryTotals.globalEffectiveStock === Number(completedRun.targetTotal ?? 0), `global effective stock should not double-count AI-backed special-practice rows: ${JSON.stringify(inventoryTotals)}`);

  const overrideRun = await service.createSubjectPracticeProductionRun({
    subject,
    topicIds: [created.topicId],
    difficultyTargets: [
      { topicId: created.topicId, difficultyBand: 'basic', targetCount: 2 }
    ],
    triggerType: 'codex_smoke_override_target'
  });
  assert(
    Number(overrideRun.targetTotal ?? 0) === 2 && Number(overrideRun.openTotal ?? 0) === 2,
    `explicit production targets must not be reduced by legacy/formal inventory: ${JSON.stringify({
      targetTotal: overrideRun.targetTotal,
      publishedTotal: overrideRun.publishedTotal,
      openTotal: overrideRun.openTotal
    })}`
  );
  assert(
    (overrideRun.cells ?? []).length === 1
      && overrideRun.cells[0].difficultyBand === 'basic'
      && Number(overrideRun.cells[0].targetCount ?? 0) === 2
      && Number(overrideRun.cells[0].publishedCount ?? 0) === 0,
    'explicit production override should create a fresh current-run cell with zero current-run published count'
  );
  const overrideTargetProfile = overrideRun.cells[0].targetProfile ?? {};
  assert(
    overrideTargetProfile.questionForm === 'calculation_application'
      && overrideTargetProfile.cognitiveSkill === 'standard_application'
      && overrideTargetProfile.readingLoad === 'low',
    `fresh production cell should preserve true profile dimensions even when legacy inventory is already full: ${JSON.stringify(overrideTargetProfile)}`
  );
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_subject_practice_production_cells" WHERE "run_id" = ${Number(overrideRun.id)}`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "csca_subject_practice_production_runs" WHERE "id" = ${Number(overrideRun.id)}`);

  const adaptiveProvider = new AdaptiveQuestionProviderService(prisma);
  const selectedAfterPredictiveCompletion = await adaptiveProvider.pickQuestions(created.userId, [{
    topicId: created.topicId,
    targetDifficulty: '中等',
    count: 1,
    reason: 'predictive_replenishment_smoke'
  }], 1);
  assert(
    selectedAfterPredictiveCompletion.some((item) => (
      item.questionSource === 'special_practice'
      && created.specialPracticeQuestionIds.includes(item.questionId)
    )),
    `Adaptive subject-practice provider should select predictive replenishment formal questions: ${JSON.stringify(selectedAfterPredictiveCompletion)}`
  );

  const afterTargetResult = await service.runSubjectPracticePredictiveReplenishment({
    subject,
    days: 30,
    topicLimit: 5,
    maxSubjects: 1,
    maxJobs: 1,
    maxRounds: 0,
    processImmediately: false,
    includeColdStart: false
  });
  assert(
    (afterTargetResult.items ?? []).some((item) => item.action === 'skip' && ['no_inventory_gap_under_cap', 'no_recent_usage_pressure'].includes(item.reason)),
    `predictive replenishment should stop after cycle targets are filled even if pressure events still exist: ${JSON.stringify(afterTargetResult.items ?? [])}`
  );
  const afterTargetRequired = (afterTargetResult.items ?? [])
    .flatMap((item) => Array.isArray(item.inventory?.items) ? item.inventory.items : [])
    .reduce((sum, item) => sum + Number(item.requiredPublishedCount ?? 0), 0);
  assert(afterTargetRequired === 0, `cycle targets should leave no required published gap after completion: ${afterTargetRequired}`);
  const runCountRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" = ${subject}
  `);
  assert(Number(runCountRows[0]?.count ?? 0) === 1, 'predictive replenishment must not create another production run after cycle targets are filled');

  console.log(JSON.stringify({
    status: 'passed',
    subject,
    topicId: created.topicId,
    runId,
    cellCount: cells.length,
    targetTotal: completedRun.targetTotal,
    publishedTotal: completedRun.publishedTotal,
    adaptiveSelected: selectedAfterPredictiveCompletion.map((item) => ({ questionSource: item.questionSource, questionId: item.questionId })),
    snapshotCount,
    aggregateScopes: aggregateResult.scopes,
    message: 'Predictive replenishment DB smoke passed: run blocks on no-progress and completes only after all difficulty targets are formally filled.'
  }, null, 2));
}

main()
  .catch((error) => {
    process.exitCode = 1;
    console.error(error);
  })
  .finally(async () => {
    try {
      if (!keepFixture) await cleanup();
    } catch (cleanupError) {
      console.warn('Predictive replenishment smoke cleanup warning:', cleanupError);
    } finally {
      await prisma.$disconnect();
    }
  });
