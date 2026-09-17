const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

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
const { AIQuestioningController } = require('../backend/src/ai-questioning/ai-questioning.controller');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { AdaptiveReplenishmentService } = require('../backend/src/ai-questioning/adaptive-replenishment.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const {
  QuestionReviewerService,
  SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION
} = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const { AdaptiveQuestionProviderService } = require('../backend/src/csca-special-practice/adaptive-question-provider.service');

loadEnv(path.resolve(__dirname, '..'));
// Keep this fixture smoke hermetic even when the developer's local .env enables
// live generation. The smoke injects deterministic providers and must never
// enter the live auto-regeneration path.
process.env.CSCA_AI_QUESTION_GENERATION_ENABLED = 'false';
process.env.CSCA_AI_QUESTION_REVIEW_ENABLED = 'false';
process.env.CSCA_ALLOW_SMOKE_SUBJECTS = 'true';

const prisma = new PrismaClient();
const testCode = `codex-ai-questioning-smoke-${Date.now()}`;
const smokeSubject = `smoke_math_${Date.now()}`;
const coverageSubject = `smoke_math_${Date.now() + 1}`;
const bridgeSlugPrefix = 'csca-ai-math-';
const created = {
  examTopicId: null,
  coverageExamTopicId: null,
  blueprintId: null,
  styleProfileId: null,
  seriesProfileId: null,
  generationProfileId: null,
  additionalSeriesProfileIds: [],
  additionalGenerationProfileIds: [],
  coverageBlueprintIds: [],
  coverageStyleProfileId: null,
  coverageSeriesProfileId: null,
  coverageGenerationProfileId: null,
  coverageSourceDocumentId: null,
  coverageSourceQuestionId: null,
  sourceDocumentId: null,
  sourceQuestionId: null,
  questionId: null,
  questionIds: [],
  generationJobIds: [],
  publishedQuestionIds: [],
  syllabusImportIds: [],
  adminAuditLogIds: [],
  syllabusImportTopicCode: null,
  syllabusImportTopicCodes: [],
  bridgeTopicId: null,
  adaptiveSessionIds: []
};

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called in smoke fallback mode.');
    }
  };
}

class SmokeQuestionGeneratorProvider {
  async generate(_blueprint, fallback) {
    return {
      candidate: fallback,
      rawOutput: fallback,
      normalizedOutput: fallback,
      promptMetadata: { smokeProvider: true },
      agent: {
        role: 'generator',
        name: 'smoke-question-generator',
        provider: 'smoke-fixture',
        model: 'smoke-fixture',
        promptVersion: 'smoke-generator-v1'
      },
      provider: 'smoke-fixture',
      model: 'smoke-fixture',
      status: 'success'
    };
  }
}

class SmokeQuestionReviewerProvider {
  async review() {
    return {
      issues: [],
      dimensions: [],
      provider: {
        provider: 'smoke-fixture',
        model: 'smoke-reviewer',
        status: 'success'
      }
    };
  }

  agentIdentity(provider) {
    return {
      role: 'reviewer',
      name: 'smoke-question-reviewer',
      provider: provider?.provider || 'smoke-fixture',
      model: provider?.model || 'smoke-reviewer',
      promptVersion: 'smoke-reviewer-v1'
    };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function markQuestionMetadataAsRealFixture(question) {
  const [current] = await prisma.$queryRaw`
    SELECT "id", "subject", "topic_id" AS "topicId", "prompt", "options",
           "correct_answer" AS "correctAnswer", "explanation",
           "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${question.id}
    LIMIT 1
  `;
  const source = current ?? question;
  const options = Array.isArray(source.options) ? source.options : [];
  const existingProfileAlignment = source.reviewMetadata?.profileAlignment && typeof source.reviewMetadata.profileAlignment === 'object'
    ? source.reviewMetadata.profileAlignment
    : {};
  const existingDifficultyEvidence = existingProfileAlignment.evidence && typeof existingProfileAlignment.evidence === 'object'
    ? existingProfileAlignment.evidence
    : {};
  const localizations = {
    zh: {
      prompt: source.prompt,
      options,
      correctAnswer: source.correctAnswer,
      explanation: source.explanation
    },
    en: {
      prompt: source.prompt,
      options,
      correctAnswer: source.correctAnswer,
      explanation: source.explanation
    }
  };
  await prisma.$executeRaw`
    UPDATE "csca_questions"
    SET "generation_metadata" = COALESCE("generation_metadata", '{}'::jsonb) || ${JSON.stringify({
      sourceKind: 'syllabus',
      generationSource: 'subject_practice_fixture',
      generationMode: 'subject_practice_candidate',
      syllabusVersion: '2026-fixture',
      localizations,
      scope: {
        targetUseCase: 'subject_practice',
        intendedUse: 'subject_practice',
        subject: source.subject,
        topicId: source.topicId,
        gapKey: `fixture-topic-${source.topicId}`,
        targetQuestionBank: 'special_practice_questions'
      },
      versionGovernance: {
        status: 'current',
        targetUseCase: 'subject_practice',
        reason: 'smoke_fixture_current_version',
        classifiedBy: 'smoke'
      },
      syllabusScope: {
        subject: source.subject,
        topicId: source.topicId,
        topicCode: `fixture-topic-${source.topicId}`,
        topicTitle: 'AI Questioning Fixture Topic',
        topicModule: 'Fixture',
        examScope: 'Fixture scope',
        syllabusVersion: '2026-fixture',
        allowedQuestionTypes: [],
        difficultyRange: [],
        excludedScope: [],
        sourceLabel: null,
        sourceUrl: null
      }
    })}::jsonb,
        "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
          profileAlignment: {
            ...existingProfileAlignment,
            evidence: {
              ...existingDifficultyEvidence,
              difficultyEvidencePolicyVersion: SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION
            }
          }
        })}::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${question.id}
  `;
}

async function createStalePublishedPracticeBackedQuestion(input) {
  const options = [
    { id: 'A', text: '1' },
    { id: 'B', text: '2' },
    { id: 'C', text: '3' },
    { id: 'D', text: '4' }
  ];
  const [bridgeQuestion] = await prisma.$queryRaw`
    INSERT INTO "special_practice_questions" (
      "topic_id", "order_number", "difficulty", "question_type", "prompt",
      "options", "correct_answer", "explanation", "knowledge_tags", "status", "updated_at"
    )
    VALUES (
      ${input.bridgeTopicId},
      COALESCE((SELECT MAX("order_number") + 1 FROM "special_practice_questions" WHERE "topic_id" = ${input.bridgeTopicId}), 900001),
      '基础', 'single-choice',
      'This stale AI-backed bridge question must never be selected by adaptive practice.',
      ${JSON.stringify(options)}::jsonb,
      'A',
      'This row is intentionally stale for version-governance filtering smoke coverage.',
      ${JSON.stringify(['version-governance-stale'])}::jsonb,
      'published',
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.publishedQuestionIds.push(bridgeQuestion.id);
  await prisma.$executeRaw`
    INSERT INTO "csca_topic_mappings" ("source_type", "source_id", "topic_id", "confidence", "updated_at")
    VALUES ('special_practice_question', ${bridgeQuestion.id}, ${input.examTopicId}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("source_type", "source_id", "topic_id") DO UPDATE
      SET "confidence" = EXCLUDED."confidence", "updated_at" = CURRENT_TIMESTAMP
  `;
  const generationMetadata = {
    sourceKind: 'syllabus_and_past_paper_profile',
    generationSource: 'subject_practice_profile',
    generationMode: 'subject_practice_candidate',
    syllabusVersion: '2026-smoke',
    scope: {
      targetUseCase: 'subject_practice',
      intendedUse: 'subject_practice',
      subject: input.subject,
      topicId: input.examTopicId,
      targetQuestionBank: 'special_practice_questions'
    },
    versionGovernance: {
      status: 'stale_needs_review',
      reason: 'smoke_stale_version_should_not_reach_students',
      targetUseCase: 'subject_practice',
      classifiedBy: 'smoke'
    }
  };
  const reviewMetadata = {
    subjectPracticeAutoApproval: {
      status: 'published_to_subject_practice',
      targetUseCase: 'subject_practice',
      targetQuestionBank: 'special_practice_questions',
      source: 'smoke_version_governance_filter'
    }
  };
  const [aiQuestion] = await prisma.$queryRaw`
    INSERT INTO "csca_questions" (
      "subject", "topic_id", "source_type", "source_question_id", "designed_difficulty",
      "question_type", "prompt", "options", "correct_answer", "explanation",
      "knowledge_tags", "syllabus_version", "generation_metadata", "review_metadata",
      "status", "updated_at"
    )
    VALUES (
      ${input.subject}, ${input.examTopicId}, 'ai', ${bridgeQuestion.id}, '基础',
      'single-choice',
      'This stale AI backing row must make the published bridge question unavailable.',
      ${JSON.stringify(options)}::jsonb,
      'A',
      'The adaptive provider must reject stale_needs_review AI-backed rows.',
      ${JSON.stringify(['version-governance-stale'])}::jsonb,
      '2026-smoke',
      ${JSON.stringify(generationMetadata)}::jsonb,
      ${JSON.stringify(reviewMetadata)}::jsonb,
      'approved',
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.questionIds.push(aiQuestion.id);
  return { bridgeQuestionId: bridgeQuestion.id, aiQuestionId: aiQuestion.id };
}

async function cleanup() {
  if (created.adminAuditLogIds.length) {
    await prisma.adminAuditLog.deleteMany({
      where: { id: { in: created.adminAuditLogIds } }
    });
  }
  if (created.syllabusImportIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_syllabus_imports"
      WHERE "id" IN (${Prisma.join(created.syllabusImportIds)})
    `;
  }
  if (created.syllabusImportTopicCode) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_topics"
      WHERE "code" = ${created.syllabusImportTopicCode}
    `;
  }
  if (created.syllabusImportTopicCodes.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_topics"
      WHERE "code" IN (${Prisma.join(created.syllabusImportTopicCodes)})
    `;
  }
  if (created.adaptiveSessionIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_adaptive_sessions"
      WHERE "id" IN (${Prisma.join(created.adaptiveSessionIds)})
    `;
  }
  if (created.publishedQuestionIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'special_practice_question'
        AND "source_id" IN (${Prisma.join(created.publishedQuestionIds)})
    `;
    await prisma.$executeRaw`
      DELETE FROM "special_practice_questions"
      WHERE "id" IN (${Prisma.join(created.publishedQuestionIds)})
    `;
  }
  if (created.questionIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_ai_generation_jobs"
      WHERE "question_id" IN (${Prisma.join(created.questionIds)})
        OR "id" IN (${Prisma.join(created.generationJobIds.length ? created.generationJobIds : [0])})
    `;
    await prisma.$executeRaw`
      DELETE FROM "csca_questions"
      WHERE "id" IN (${Prisma.join(created.questionIds)})
    `;
  }
  if (created.blueprintId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_blueprints"
      WHERE "id" = ${created.blueprintId}
    `;
  }
  if (created.styleProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_style_profiles"
      WHERE "id" = ${created.styleProfileId}
    `;
  }
  if (created.generationProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" = ${created.generationProfileId}
    `;
  }
  if (created.additionalGenerationProfileIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" IN (${Prisma.join(created.additionalGenerationProfileIds)})
    `;
  }
  if (created.seriesProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" = ${created.seriesProfileId}
    `;
  }
  if (created.additionalSeriesProfileIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" IN (${Prisma.join(created.additionalSeriesProfileIds)})
    `;
  }
  if (created.sourceDocumentId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_source_documents"
      WHERE "id" = ${created.sourceDocumentId}
    `;
  }
  if (created.coverageBlueprintIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_blueprints"
      WHERE "id" IN (${Prisma.join(created.coverageBlueprintIds)})
    `;
  }
  if (created.coverageGenerationProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" = ${created.coverageGenerationProfileId}
    `;
  }
  if (created.coverageSeriesProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" = ${created.coverageSeriesProfileId}
    `;
  }
  if (created.coverageStyleProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_style_profiles"
      WHERE "id" = ${created.coverageStyleProfileId}
    `;
  }
  if (created.coverageSourceDocumentId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_source_documents"
      WHERE "id" = ${created.coverageSourceDocumentId}
    `;
  }
  if (created.bridgeTopicId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'special_practice_topic'
        AND "source_id" = ${created.bridgeTopicId}
    `;
    await prisma.$executeRaw`
      DELETE FROM "special_practice_topics"
      WHERE "id" = ${created.bridgeTopicId}
        AND "slug" LIKE ${bridgeSlugPrefix + '%'}
    `;
  }
  if (created.examTopicId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_misconceptions"
      WHERE "topic_id" = ${created.examTopicId}
        AND "slug" LIKE ${`${smokeSubject}-${created.examTopicId}-%`}
    `;
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_topics"
      WHERE "id" = ${created.examTopicId}
      AND "code" = ${testCode}
    `;
  }
  if (created.coverageExamTopicId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_topics"
      WHERE "id" = ${created.coverageExamTopicId}
        AND "code" = ${testCode + '-coverage'}
    `;
  }
}

async function main() {
  await prisma.$executeRaw`
    ALTER TABLE "csca_adaptive_round_items"
      ADD COLUMN IF NOT EXISTS "question_source" VARCHAR(60) NOT NULL DEFAULT 'special_practice'
  `;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "uq_csca_adaptive_round_items_round_question"`;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_adaptive_round_items_round_source_question"
      ON "csca_adaptive_round_items" ("round_id", "question_source", "question_id")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "idx_csca_adaptive_round_items_source_question"
      ON "csca_adaptive_round_items" ("question_source", "question_id")
  `;
  await prisma.$executeRaw`
    ALTER TABLE "csca_exam_topics"
      ADD COLUMN IF NOT EXISTS "excluded_scope" JSONB
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "csca_syllabus_imports" (
      "id" SERIAL PRIMARY KEY,
      "subject" VARCHAR(60) NOT NULL,
      "syllabus_version" VARCHAR(60) NOT NULL,
      "source_label" VARCHAR(200),
      "source_url" TEXT,
      "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
      "raw_json" JSONB NOT NULL,
      "preview_summary" JSONB,
      "applied_at" TIMESTAMP(3),
      "applied_by" INTEGER,
      "created_by" INTEGER,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "idx_csca_syllabus_import_subject_version_status"
      ON "csca_syllabus_imports" ("subject", "syllabus_version", "status")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "idx_csca_syllabus_import_status_created"
      ON "csca_syllabus_imports" ("status", "created_at")
  `;

  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "difficulty_range", "status"
    )
    VALUES (
      ${smokeSubject}, 'Smoke', ${testCode}, 'AI Questioning Smoke Topic', 'Smoke topic', 'Smoke scope', '2026-smoke', 1,
      ${JSON.stringify(['基础'])}::jsonb, 'published'
    )
    RETURNING "id"
  `;
  created.examTopicId = topic.id;
  const [mathImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary", "applied_at", "created_by"
    )
    VALUES (
      ${smokeSubject}, '2026-smoke', 'AI questioning smoke math syllabus', 'applied',
      ${JSON.stringify({ subject: smokeSubject, syllabusVersion: '2026-smoke' })}::jsonb,
      ${JSON.stringify({ topicCount: 1 })}::jsonb,
      NOW(), 3
    )
    RETURNING "id"
  `;
  created.syllabusImportIds.push(mathImport.id);
  const [coverageTopic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "difficulty_range", "status"
    )
    VALUES (
      ${coverageSubject}, 'Smoke', ${testCode + '-coverage'}, 'AI Questioning Coverage Topic', 'Coverage topic', 'Coverage scope', '2026-smoke', 1,
      ${JSON.stringify(['基础'])}::jsonb, 'published'
    )
    RETURNING "id"
  `;
  created.coverageExamTopicId = coverageTopic.id;
  const [coverageImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary", "applied_at", "created_by"
    )
    VALUES (
      ${coverageSubject}, '2026-smoke', 'AI questioning smoke applied syllabus', 'applied',
      ${JSON.stringify({ subject: coverageSubject, syllabusVersion: '2026-smoke' })}::jsonb,
      ${JSON.stringify({ topicCount: 1 })}::jsonb,
      NOW(), 3
    )
    RETURNING "id"
  `;
  created.syllabusImportIds.push(coverageImport.id);

  const reviewer = new QuestionReviewerService(new QuestionValidatorService(), new SmokeQuestionReviewerProvider());
  const qualityService = new QuestionQualityService(prisma);
  const adaptiveReplenishmentService = new AdaptiveReplenishmentService(prisma);
  const service = new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    new SmokeQuestionGeneratorProvider(),
    reviewer,
    new QuestionTopicMapperProviderService(disabledGateway()),
    qualityService,
    adaptiveReplenishmentService
  );
  const controller = new AIQuestioningController(service, qualityService, adaptiveReplenishmentService, prisma);
  const adaptiveQuestionProvider = new AdaptiveQuestionProviderService(prisma);
  const coverageBefore = await service.blueprintCoverageSummary({ subject: coverageSubject });
  assert(
    coverageBefore.missingTopics.some((item) => item.id === created.coverageExamTopicId),
    'Blueprint coverage should list published topics without a non-archived blueprint.'
  );
  const ensuredCoverage = await service.ensureBlueprintCoverage({ subject: coverageSubject, limit: 10 });
  created.coverageBlueprintIds = ensuredCoverage.items
    .filter((item) => item.topicId === created.coverageExamTopicId)
    .map((item) => item.id);
  assert(created.coverageBlueprintIds.length === 1, 'Blueprint coverage ensure should create one base blueprint for a missing published topic.');
  const coverageAfter = await service.blueprintCoverageSummary({ subject: coverageSubject });
  assert(
    !coverageAfter.missingTopics.some((item) => item.id === created.coverageExamTopicId),
    'Blueprint coverage should stop listing a topic after its base blueprint is created.'
  );
  const blockedWithoutSourceProfile = await service.runPregeneration({ subject: coverageSubject, topicId: created.coverageExamTopicId, limit: 1, perTopic: 1, force: true });
  assert(
    blockedWithoutSourceProfile.summary.topicsSelected === 0 && blockedWithoutSourceProfile.summary.jobsEnqueued === 0,
    `Pregeneration should not enqueue subject-practice jobs before active source questions exist. Got ${JSON.stringify(blockedWithoutSourceProfile.summary)}`
  );
  const [coverageSourceDocument] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language",
      "file_hash", "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${coverageSubject}, 'past_paper', ${`AI questioning smoke source ${testCode}`}, 2026, 'smoke', 'en',
      ${`coverage-source-${testCode}`}, 'AI questioning smoke past paper', 'internal_analysis',
      ${JSON.stringify({ allowAIProfile: true, allowStyleExtraction: true, allowQuestionGenerationReference: true })}::jsonb,
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.coverageSourceDocumentId = coverageSourceDocument.id;
  const [coverageSourceQuestion] = await prisma.$queryRaw`
    INSERT INTO "csca_source_questions" (
      "document_id", "subject", "question_number", "language", "prompt_hash",
      "prompt_text", "options", "correct_answer", "explanation", "syllabus_version",
      "topic_id", "topic_codes", "blueprint_like_tags", "analysis", "analysis_status",
      "analysis_confidence", "analysis_issues", "review_status", "auto_profile_status",
      "auto_profile_decided_at", "auto_profile_gate_result", "updated_at"
    )
    VALUES (
      ${created.coverageSourceDocumentId}, ${coverageSubject}, '1', 'en', ${`coverage-source-question-${testCode}`},
      'What is 1 + 1?', ${JSON.stringify([{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }])}::jsonb,
      'B', '1 + 1 = 2.', '2026-smoke',
      ${created.coverageExamTopicId}, ${JSON.stringify([testCode + '-coverage'])}::jsonb,
      ${JSON.stringify(['formula_calculation', 'calculation'])}::jsonb,
      ${JSON.stringify({
        questionForm: 'formula_calculation',
        cognitiveSkill: 'calculation',
        difficulty: 'basic',
        readingLoad: 'low',
        calculationLoad: 'light'
      })}::jsonb,
      'human_confirmed', 0.96, '[]'::jsonb, 'mapped', 'auto_approved',
      CURRENT_TIMESTAMP,
      ${JSON.stringify({ status: 'auto_approved', reasonCode: 'smoke_fixture' })}::jsonb,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.coverageSourceQuestionId = coverageSourceQuestion.id;
  const blockedWithoutStyleProfile = await service.runPregeneration({ subject: coverageSubject, topicId: created.coverageExamTopicId, limit: 1, perTopic: 1, force: true });
  assert(
    blockedWithoutStyleProfile.summary.topicsSelected === 0 && blockedWithoutStyleProfile.summary.jobsEnqueued === 0,
    `Pregeneration should not enqueue subject-practice jobs before a source style profile exists. Got ${JSON.stringify(blockedWithoutStyleProfile.summary)}`
  );
  const [coverageStyleProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "scope_id", "source_question_ids",
      "sample_size", "confidence", "profile", "profile_version", "source_question_snapshot_hash",
      "status", "generated_by", "updated_at"
    )
    VALUES (
      ${coverageSubject}, '2026-smoke', 'topic', ${created.coverageExamTopicId}, ${JSON.stringify([created.coverageSourceQuestionId])}::jsonb,
      1, 'high', ${JSON.stringify({
        questionFormDistribution: { formula_calculation: 1 },
        commonQuestionForms: ['formula_calculation'],
        cognitiveSkillDistribution: { calculation: 1 },
        commonCognitiveSkills: ['calculation'],
        difficultyDistribution: { basic: 1 },
        readingLoadDistribution: { low: 1 },
        calculationLoadDistribution: { light: 1 },
        optionPatterns: {
          commonDistractorTypes: ['calculation_error'],
          commonMisconceptions: ['operation_order']
        },
        estimatedTimeSeconds: { p50: 60 }
      })}::jsonb, 1, ${`coverage-smoke-${testCode}`},
      'active', 'ai-questioning-smoke', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.coverageStyleProfileId = coverageStyleProfile.id;
  const coverageSeriesProfile = await service.generateExamSeriesProfile({
    subject: coverageSubject,
    syllabusVersion: '2026-smoke',
    title: `AI questioning smoke coverage trend ${testCode}`
  });
  created.coverageSeriesProfileId = coverageSeriesProfile.profile.id;
  const coverageGenerationProfile = await service.generateGenerationProfile({
    subject: coverageSubject,
    syllabusVersion: '2026-smoke',
    useCase: 'subject_practice',
    seriesProfileId: coverageSeriesProfile.profile.id
  });
  created.coverageGenerationProfileId = coverageGenerationProfile.profile.id;
  const pregenerated = await service.runPregeneration({ subject: coverageSubject, topicId: created.coverageExamTopicId, limit: 1, perTopic: 1, force: true });
  assert(pregenerated.summary.topicsSelected === 1, 'Pregeneration should select the blueprint-covered topic that needs candidates.');
  assert(pregenerated.summary.jobsEnqueued >= 1, `Pregeneration should enqueue generation jobs for a topic without candidates. Got ${JSON.stringify({ summary: pregenerated.summary, topics: pregenerated.topics })}`);
  if (pregenerated.summary.jobsSucceeded < 1) {
    const topicJobIds = pregenerated.topics.flatMap((item) => Array.isArray(item.jobIds) ? item.jobIds : []).map(Number).filter(Boolean);
    const queuedDiagnostics = topicJobIds.length
      ? await prisma.$queryRaw`
        SELECT job."id", job."status", b."status" AS "blueprintStatus", b."subject", b."topic_id" AS "topicId",
               b."source", b."constraints", t."status" AS "topicStatus"
        FROM "csca_ai_generation_jobs" job
        JOIN "csca_question_blueprints" b ON b."id" = job."blueprint_id"
        JOIN "csca_exam_topics" t ON t."id" = b."topic_id"
        WHERE job."id" IN (${Prisma.join(topicJobIds)})
      `
      : [];
    pregenerated.diagnostics = { topicJobIds, queuedDiagnostics };
  }
  assert(pregenerated.summary.jobsSucceeded >= 1, `Pregeneration should process queued jobs. Got ${JSON.stringify({ summary: pregenerated.summary, topics: pregenerated.topics, processed: pregenerated.processed, diagnostics: pregenerated.diagnostics })}`);
  assert(pregenerated.summary.candidatesCreated >= 1, `Pregeneration should create candidate questions. Got ${JSON.stringify(pregenerated.summary)}`);
  const pregeneratedJob = pregenerated.processed.items[0];
  created.generationJobIds.push(...pregenerated.processed.items.map((item) => item.id).filter(Boolean));
  created.questionIds.push(...pregenerated.processed.items.map((item) => item.questionId).filter(Boolean));
  const pregeneratedQuestions = await prisma.$queryRaw`
    SELECT "id", "status", "source_question_id" AS "sourceQuestionId", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" IN (${Prisma.join(created.questionIds)})
  `;
  created.publishedQuestionIds.push(
    ...pregeneratedQuestions
      .map((item) => Number(item.sourceQuestionId))
      .filter((id) => Number.isInteger(id) && id > 0)
  );
  created.generationJobIds.push(
    ...pregeneratedQuestions.flatMap((item) => {
      const jobIds = item.reviewMetadata?.subjectPracticeAutoRegenerate?.jobIds;
      return Array.isArray(jobIds) ? jobIds : [];
    }).map(Number).filter((id) => Number.isInteger(id) && id > 0)
  );
  assert(
    pregeneratedQuestions.some((item) => item.id === pregeneratedJob.questionId
      && item.status === 'review_failed'
      && !item.sourceQuestionId
      && item.reviewMetadata?.subjectPracticeAutoRegenerate?.status === 'skipped'
      && item.reviewMetadata?.subjectPracticeAutoRegenerate?.reasonCode === 'local_diagnostic_regenerate_manual_only'),
    `Non-production diagnostic candidates should stay out of the formal bank and require manual regeneration instead of starting an unbounded retry chain. Got ${JSON.stringify(pregeneratedQuestions)}`
  );
  const readinessEvent = await controller.recordOperationalReadinessEvent({
    event: 'download_json',
    subject: coverageSubject,
    format: 'json',
    targetId: 'admin-ai-questioning-candidates'
  }, { id: 1, email: 'ai-questioning-smoke-admin@example.test' });
  assert(readinessEvent.ok === true && readinessEvent.event === 'download_json', 'Operational readiness event endpoint should accept download_json.');
  assert(readinessEvent.readiness.subject === coverageSubject, 'Operational readiness event should recompute and return the requested subject.');
  assert(readinessEvent.readiness.format === 'json', 'Operational readiness event should preserve allowed report format.');
  assert(readinessEvent.latestAuditEvent?.action === 'download_json', 'Operational readiness event endpoint should return the saved latest audit event.');
  assert(readinessEvent.latestAuditEvent?.module === 'ai-questioning', 'Operational readiness event response should include the audit module.');
  assert(readinessEvent.latestAuditEvent?.resourceType === 'operational-readiness', 'Operational readiness event response should include the audit resource type.');
  assert(readinessEvent.latestAuditEvent?.actorEmail === 'ai-questioning-smoke-admin@example.test', 'Operational readiness event response should include the current actor email.');
  const readinessAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'operational-readiness',
      resourceId: coverageSubject,
      action: 'download_json'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(readinessAuditRows.length === 1, 'Operational readiness event endpoint should write an admin audit log.');
  created.adminAuditLogIds.push(readinessAuditRows[0].id);
  assert(readinessEvent.latestAuditEvent?.id === readinessAuditRows[0].id, 'Operational readiness event response should reference the saved audit row.');
  assert(readinessAuditRows[0].after?.nextAction, 'Operational readiness audit log should include the recomputed next action.');
  assert(Array.isArray(readinessAuditRows[0].after?.warnings), 'Operational readiness audit log should include warning snapshots.');
  const readinessAfterAudit = await controller.operationalReadiness({ subject: coverageSubject });
  assert(readinessAfterAudit.latestAuditEvent?.id === readinessAuditRows[0].id, 'Operational readiness should expose the latest matching audit event.');
  assert(readinessAfterAudit.latestAuditEvent?.action === 'download_json', 'Operational readiness latest audit event should include the action.');
  const blueprint = await service.createBlueprint({
    subject: smokeSubject,
    topicId: created.examTopicId,
    difficulty: '基础',
    questionType: 'single_choice',
    skill: 'smoke validation',
    source: 'smoke'
  });
  created.blueprintId = blueprint.id;
  const updatedBlueprint = await controller.updateBlueprint(String(created.blueprintId), {
    difficulty: '基础',
    questionType: 'single_choice',
    skill: 'smoke reviewed skill',
    instruction: 'Use a concise operationally reviewed prompt boundary.',
    targetSkills: ['reviewed-skill', 'smoke-skill'],
    excludedScope: ['unrelated calculus'],
    note: 'smoke_update_blueprint_constraints'
  }, {
    id: 7,
    email: 'ai-questioning-blueprint-admin@example.test'
  });
  assert(updatedBlueprint.difficulty === '基础', 'Blueprint update should persist the reviewed difficulty.');
  assert(updatedBlueprint.skill === 'smoke reviewed skill', 'Blueprint update should persist the reviewed skill.');
  assert(updatedBlueprint.constraints?.instruction === 'Use a concise operationally reviewed prompt boundary.', 'Blueprint update should persist generation instruction.');
  assert(updatedBlueprint.constraints?.blueprintGovernance?.status === 'reviewed', 'Blueprint update should record governance metadata.');
  const blueprintUpdateAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'blueprint',
      resourceId: String(created.blueprintId),
      action: 'update_constraints'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(blueprintUpdateAuditRows.length === 1, 'Blueprint constraint update should write an admin audit log.');
  created.adminAuditLogIds.push(blueprintUpdateAuditRows[0].id);
  assert(blueprintUpdateAuditRows[0].actorId === 7, 'Blueprint constraint update audit should retain the actor.');
  const pausedBlueprint = await service.updateBlueprintStatus(created.blueprintId, 'paused', { note: 'smoke_pause' });
  assert(pausedBlueprint.status === 'paused', 'Blueprint should be pausable by governance action.');
  const resumedBlueprint = await service.updateBlueprintStatus(created.blueprintId, 'active', { note: 'smoke_resume' });
  assert(resumedBlueprint.status === 'active', 'Blueprint should be resumable by governance action.');
  const [sourceDocument] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language",
      "file_hash", "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${smokeSubject}, 'past_paper', ${`AI questioning smoke primary source ${testCode}`}, 2026, 'smoke', 'en',
      ${`primary-source-${testCode}`}, 'AI questioning smoke primary past paper', 'internal_analysis',
      ${JSON.stringify({ allowAIProfile: true, allowStyleExtraction: true, allowQuestionGenerationReference: true })}::jsonb,
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.sourceDocumentId = sourceDocument.id;
  const [sourceQuestion] = await prisma.$queryRaw`
    INSERT INTO "csca_source_questions" (
      "document_id", "subject", "question_number", "language", "prompt_hash",
      "prompt_text", "options", "correct_answer", "explanation", "syllabus_version",
      "topic_id", "topic_codes", "blueprint_like_tags", "analysis", "analysis_status",
      "analysis_confidence", "analysis_issues", "review_status", "auto_profile_status",
      "auto_profile_decided_at", "auto_profile_gate_result", "updated_at"
    )
    VALUES (
      ${created.sourceDocumentId}, ${smokeSubject}, '1', 'en', ${`primary-source-question-${testCode}`},
      'Choose the smoke validation concept.', ${JSON.stringify([{ id: 'A', text: 'Concept A' }, { id: 'B', text: 'Concept B' }, { id: 'C', text: 'Concept C' }, { id: 'D', text: 'Concept D' }])}::jsonb,
      'A', 'Concept A is the intended smoke fixture answer.', '2026-smoke',
      ${created.examTopicId}, ${JSON.stringify([testCode])}::jsonb,
      ${JSON.stringify(['concept_identification', 'condition-missing'])}::jsonb,
      ${JSON.stringify({
        questionForm: 'concept_identification',
        cognitiveSkill: 'concept_identification',
        difficulty: 'basic',
        readingLoad: 'medium',
        calculationLoad: 'light'
      })}::jsonb,
      'human_confirmed', 0.96, '[]'::jsonb, 'mapped', 'auto_approved',
      CURRENT_TIMESTAMP,
      ${JSON.stringify({ status: 'auto_approved', reasonCode: 'smoke_fixture' })}::jsonb,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.sourceQuestionId = sourceQuestion.id;
  const [styleProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "scope_id", "source_question_ids",
      "sample_size", "confidence", "profile", "profile_version", "source_question_snapshot_hash",
      "status", "generated_by", "updated_at"
    )
    VALUES (
      ${smokeSubject}, '2026-smoke', 'topic', ${created.examTopicId}, ${JSON.stringify([created.sourceQuestionId])}::jsonb,
      1, 'high', ${JSON.stringify({
        questionFormDistribution: { concept_identification: 1 },
        commonQuestionForms: ['concept_identification'],
        cognitiveSkillDistribution: { concept_identification: 1 },
        commonCognitiveSkills: ['concept_identification'],
        difficultyDistribution: { basic: 1 },
        readingLoadDistribution: { medium: 1 },
        calculationLoadDistribution: { light: 1 },
        optionPatterns: {
          commonDistractorTypes: ['condition-missing', 'target-confusion'],
          commonMisconceptions: ['condition-missing']
        },
        estimatedTimeSeconds: { p50: 60 }
      })}::jsonb, 1, ${`${smokeSubject}-smoke-${testCode}`},
      'active', 'ai-questioning-smoke', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.styleProfileId = styleProfile.id;
  const seriesProfile = await service.generateExamSeriesProfile({
    subject: smokeSubject,
    syllabusVersion: '2026-smoke',
    title: `AI questioning smoke primary trend ${testCode}`
  });
  created.seriesProfileId = seriesProfile.profile.id;
  const generationProfile = await service.generateGenerationProfile({
    subject: smokeSubject,
    syllabusVersion: '2026-smoke',
    useCase: 'subject_practice',
    seriesProfileId: seriesProfile.profile.id
  });
  created.generationProfileId = generationProfile.profile.id;
  const healthBeforeGeneration = await service.topicQuestionBankHealth({ subject: smokeSubject, limit: 100 });
  const smokeHealthBefore = healthBeforeGeneration.items.find((item) => item.topicId === created.examTopicId);
  assert(smokeHealthBefore?.status === 'needs_candidates', `Topic health should flag a blueprint-covered topic without candidates. Got ${JSON.stringify(smokeHealthBefore)}`);

  const topicGenerated = await service.runTopicAction(created.examTopicId, { action: 'generate_candidates', limit: 1, force: true, processNow: false });
  assert(topicGenerated.enqueued >= 1, `Topic action should enqueue generation jobs instead of bypassing the queue. Got ${JSON.stringify(topicGenerated)}`);
  created.generationJobIds.push(topicGenerated.items[0].id);
  const topicProcessedJob = await service.retryGenerationJob(topicGenerated.items[0].id);
  assert(
    topicProcessedJob.status === 'succeeded' && topicProcessedJob.questionId,
    `Topic queued generation job should process into a candidate. status=${topicProcessedJob.status}; questionId=${topicProcessedJob.questionId ?? '-'}; error=${topicProcessedJob.error ?? '-'}`
  );
  const generatedQuestions = await service.listQuestions({ topicId: created.examTopicId });
  const generatedQuestion = generatedQuestions.items.find((item) => item.id === topicProcessedJob.questionId);
  assert(generatedQuestion, 'Topic queued generation should create a governable candidate.');
  const generated = {
    question: generatedQuestion,
    review: topicProcessedJob.reviewResult,
    generation: generatedQuestion.generationMetadata
  };
  created.questionId = generated.question.id;
  created.questionIds.push(generated.question.id);
  assert(
    ['passed', 'needs_review', 'failed'].includes(generated.review.status),
    `Generated candidate should include a concrete reviewer status. status=${generated.review.status}`
  );
  assert(['pending_review', 'review_failed'].includes(generated.question.status), 'Generated candidate should remain in the governance queue when it is not formally approved.');
  assert(generated.generation.status === 'success', 'Generator should report a successful real AI generation before storing a candidate.');

  const cached = await service.generateCandidate(created.blueprintId);
  if (!created.questionIds.includes(cached.question.id)) created.questionIds.push(cached.question.id);
  const nextDirect = await service.generateCandidate(created.blueprintId);
  if (!created.questionIds.includes(nextDirect.question.id)) created.questionIds.push(nextDirect.question.id);
  assert(
    cached.question.id && nextDirect.question.id,
    'Direct generation should return governable candidate attempts while the subject-practice gap remains open.'
  );

  const retried = await service.generateCandidate(created.blueprintId, { force: true });
  created.questionIds.push(retried.question.id);
  assert(retried.question.id !== generated.question.id, 'Force generation should create a new candidate attempt.');
  const bulkReview = await service.bulkQuestionAction({ action: 'review', questionIds: [created.questionId, retried.question.id], limit: 5 });
  assert(bulkReview.succeeded === 2, 'Bulk review should process explicit candidate ids.');
  const bulkArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [retried.question.id], limit: 5 });
  assert(bulkArchive.succeeded === 1, 'Bulk archive should process explicit candidate ids.');

  const blockedApprovalCandidate = await service.generateCandidate(created.blueprintId, { force: true });
  created.questionIds.push(blockedApprovalCandidate.question.id);
  await prisma.$executeRaw`
    UPDATE "csca_questions"
    SET "prompt" = "prompt" || ' The correct answer is A.',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${blockedApprovalCandidate.question.id}
  `;
  const blockedReview = await service.reviewQuestion(blockedApprovalCandidate.question.id);
  assert(blockedReview.status === 'review_failed', 'Prompt leakage should move a candidate into review_failed.');
  let approvalBlocked = false;
  try {
    await service.approveQuestion(blockedApprovalCandidate.question.id);
  } catch (error) {
    approvalBlocked = String(error?.message ?? error).includes('不能发布');
  }
  assert(approvalBlocked, 'Approval gate must block deterministic reviewer failures from publishing.');
  const blockedRows = await service.listQuestions({ topicId: created.examTopicId, status: 'review_failed' });
  const blockedRow = blockedRows.items.find((item) => item.id === blockedApprovalCandidate.question.id);
  assert(blockedRow?.reviewMetadata?.approvalGate?.status === 'blocked', 'Blocked approval should persist governance evidence.');
  const fixedBlockedCandidate = await controller.updateQuestionDraft(String(blockedApprovalCandidate.question.id), {
    prompt: blockedApprovalCandidate.question.prompt,
    options: blockedApprovalCandidate.question.options,
    correctAnswer: blockedApprovalCandidate.question.correctAnswer,
    explanation: blockedApprovalCandidate.question.explanation,
    knowledgeTags: Array.isArray(blockedApprovalCandidate.question.knowledgeTags) ? blockedApprovalCandidate.question.knowledgeTags : [],
    optionMetadata: Array.isArray(blockedApprovalCandidate.question.optionMetadata) ? blockedApprovalCandidate.question.optionMetadata : [],
    note: 'smoke_manual_fix_and_review'
  }, {
    id: 6,
    email: 'ai-questioning-manual-fix-admin@example.test'
  });
  assert(
    fixedBlockedCandidate.status === 'pending_review',
    `Manual-fixed review-failed candidates should return to pending review when the fix passes deterministic gates. status=${fixedBlockedCandidate.status}; review=${JSON.stringify(fixedBlockedCandidate.reviewMetadata ?? {}).slice(0, 1200)}`
  );
  assert(fixedBlockedCandidate.version > blockedApprovalCandidate.question.version, 'Manual fixes should increment the candidate version.');
  assert(fixedBlockedCandidate.reviewMetadata?.manualEditGate?.note === 'smoke_manual_fix_and_review', 'Manual fixes should persist the manual edit review gate.');
  assert(fixedBlockedCandidate.generationMetadata?.lastManualEdit?.note === 'smoke_manual_fix_and_review', 'Manual fixes should persist lastManualEdit metadata.');
  assert(!fixedBlockedCandidate.reviewMetadata?.issues?.some((issue) => issue.code === 'prompt_leakage'), 'Manual fixes should rerun review on the edited prompt.');
  const manualFixAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'question',
      resourceId: String(blockedApprovalCandidate.question.id),
      action: 'manual_fix_and_review'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(manualFixAuditRows.length === 1, 'Manual fix endpoint should write an admin audit log.');
  created.adminAuditLogIds.push(manualFixAuditRows[0].id);
  assert(manualFixAuditRows[0].actorId === 6, 'Manual fix audit log should record the actor id.');
  assert(manualFixAuditRows[0].after?.status === 'pending_review', 'Manual fix audit log should include the post-review status.');
  const blockedArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [blockedApprovalCandidate.question.id], limit: 5 });
  assert(blockedArchive.succeeded === 1, 'Blocked candidates should remain archivable.');

  const queued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(queued.enqueued === 1, 'Generation queue should enqueue an active blueprint.');
  created.generationJobIds.push(queued.items[0].id);
  const queuedList = await service.listGenerationJobs({ status: 'queued', blueprintId: created.blueprintId, limit: 10 });
  assert(queuedList.items.some((item) => item.id === queued.items[0].id), 'Generation job list should expose queued jobs.');
  const processedQueue = await service.processGenerationJobs({ jobIds: [queued.items[0].id], limit: 1 });
  const processedJob = processedQueue.items[0];
  assert(
    processedJob?.status === 'succeeded' && processedJob.questionId,
    `Generation queue processing should produce a succeeded job with a candidate question. requested=${processedQueue.requested}; succeeded=${processedQueue.succeeded}; failed=${processedQueue.failed}; status=${processedJob?.status ?? '-'}; error=${processedJob?.error ?? processedQueue.errors?.[0]?.message ?? '-'}`
  );
  created.questionIds.push(processedJob.questionId);
  const processedList = await service.listGenerationJobs({ status: 'succeeded', blueprintId: created.blueprintId, limit: 10 });
  assert(processedList.items.some((item) => item.id === queued.items[0].id && item.questionId === processedJob.questionId), 'Generation job list should expose processed job results.');
  const queueReview = await service.bulkQuestionAction({ action: 'review', questionIds: [processedJob.questionId], limit: 5 });
  assert(queueReview.succeeded === 1, 'Queue-generated candidates should remain governable by normal question actions.');

  const failingQueued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(failingQueued.enqueued === 1, 'Generation queue should enqueue a job for failure-governance smoke.');
  created.generationJobIds.push(failingQueued.items[0].id);
  await service.updateBlueprintStatus(created.blueprintId, 'paused', { note: 'smoke_pause_for_failed_job' });
  const failedJob = await service.retryGenerationJob(failingQueued.items[0].id);
  assert(failedJob.status === 'failed', 'Generation queue should mark a job failed when its blueprint is paused.');
  assert(failedJob.governance.attemptCount === 1, 'Failed generation jobs should record attempt count.');
  assert(failedJob.governance.failureCategory === 'blueprint_inactive', 'Failed generation jobs should expose a failure category.');
  const failedHealth = await service.generationQueueHealth({ subject: smokeSubject, limit: 50 });
  assert(failedHealth.summary.failed >= 1, 'Generation queue health should count failed jobs.');
  assert(failedHealth.byFailureCategory.some((item) => item.key === 'blueprint_inactive'), 'Generation queue health should group failed jobs by category.');
  await service.updateBlueprintStatus(created.blueprintId, 'active', { note: 'smoke_resume_after_failed_job' });
  const retryBatch = await service.bulkGenerationJobAction({ action: 'retry_failed', subject: smokeSubject, failureCategory: 'blueprint_inactive', jobIds: [failingQueued.items[0].id], limit: 1 });
  assert(retryBatch.succeeded === 1, 'Generation queue bulk retry should retry a failed category.');
  const resumedJob = retryBatch.items[0];
  assert(resumedJob.status === 'succeeded' && resumedJob.governance.attemptCount >= 2 && resumedJob.governance.failureCategory === null, 'Paused failed jobs should be retryable after blueprint resume.');
  created.questionIds.push(resumedJob.questionId);
  const resumedArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [resumedJob.questionId], limit: 5 });
  assert(resumedArchive.succeeded === 1, 'Retried queue-generated candidate should remain governable.');

  const staleQueued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(staleQueued.enqueued === 1, 'Generation queue should enqueue a job for stale-running retry smoke.');
  created.generationJobIds.push(staleQueued.items[0].id);
  await prisma.$executeRaw`
    UPDATE "csca_ai_generation_jobs"
    SET "status" = 'running',
        "updated_at" = NOW() - INTERVAL '45 minutes',
        "prompt_metadata" = COALESCE("prompt_metadata", '{}'::jsonb) || '{"attemptCount":1,"maxAttempts":3,"processingStartedAt":"2000-01-01T00:00:00.000Z","smokeMarker":"smoke_stale_running"}'::jsonb
    WHERE "id" = ${staleQueued.items[0].id}
  `;
  const staleHealth = await service.generationQueueHealth({ subject: smokeSubject, limit: 50 });
  assert(staleHealth.summary.staleRunning >= 1, 'Generation queue health should count stale running jobs.');
  const staleRetryBatch = await service.bulkGenerationJobAction({ action: 'retry_failed', subject: smokeSubject, jobIds: [staleQueued.items[0].id], limit: 1 });
  assert(staleRetryBatch.succeeded === 1, 'Generation queue bulk retry should recover stale running jobs.');
  const staleRetriedJob = staleRetryBatch.items[0];
  assert(staleRetriedJob.status === 'succeeded' && staleRetriedJob.questionId, `Recovered stale running jobs should produce a candidate. got=${JSON.stringify(staleRetriedJob)}`);
  created.questionIds.push(staleRetriedJob.questionId);
  const staleArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [staleRetriedJob.questionId], limit: 5 });
  assert(staleArchive.succeeded === 1, 'Recovered stale-running candidates should remain governable.');

  const directStaleQueued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(directStaleQueued.enqueued === 1, 'Generation queue should enqueue a job for direct stale-running retry smoke.');
  created.generationJobIds.push(directStaleQueued.items[0].id);
  await prisma.$executeRaw`
    UPDATE "csca_ai_generation_jobs"
    SET "status" = 'running',
        "updated_at" = NOW() - INTERVAL '45 minutes',
        "prompt_metadata" = COALESCE("prompt_metadata", '{}'::jsonb) || '{"attemptCount":1,"maxAttempts":3,"processingStartedAt":"2000-01-01T00:00:00.000Z","smokeMarker":"smoke_direct_stale_running"}'::jsonb
    WHERE "id" = ${directStaleQueued.items[0].id}
  `;
  const directStaleRetriedJob = await service.retryGenerationJob(directStaleQueued.items[0].id);
  assert(directStaleRetriedJob.status === 'succeeded' && directStaleRetriedJob.questionId, 'Single-job retry should recover stale running jobs.');
  created.questionIds.push(directStaleRetriedJob.questionId);
  const directStaleArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [directStaleRetriedJob.questionId], limit: 5 });
  assert(directStaleArchive.succeeded === 1, 'Single-retried stale-running candidates should remain governable.');

  const schedulerStaleQueued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(schedulerStaleQueued.enqueued === 1, 'Generation queue should enqueue a job for scheduler stale-running retry smoke.');
  created.generationJobIds.push(schedulerStaleQueued.items[0].id);
  await prisma.$executeRaw`
    UPDATE "csca_ai_generation_jobs"
    SET "status" = 'running',
        "updated_at" = NOW() - INTERVAL '45 minutes',
        "prompt_metadata" = COALESCE("prompt_metadata", '{}'::jsonb) || '{"attemptCount":1,"maxAttempts":3,"processingStartedAt":"2000-01-01T00:00:00.000Z","smokeMarker":"smoke_scheduler_stale_running"}'::jsonb
    WHERE "id" = ${schedulerStaleQueued.items[0].id}
  `;
  const schedulerStaleProcessed = await service.processGenerationJobs({ retryFailed: true, jobIds: [schedulerStaleQueued.items[0].id], limit: 1 });
  assert(schedulerStaleProcessed.succeeded === 1, 'Scheduled retryFailed processing should recover stale running jobs.');
  const schedulerStaleRetriedJob = schedulerStaleProcessed.items[0];
  assert(schedulerStaleRetriedJob.status === 'succeeded' && schedulerStaleRetriedJob.questionId, 'Scheduler-recovered stale running jobs should produce a candidate.');
  created.questionIds.push(schedulerStaleRetriedJob.questionId);
  const schedulerStaleArchive = await service.bulkQuestionAction({ action: 'archive', questionIds: [schedulerStaleRetriedJob.questionId], limit: 5 });
  assert(schedulerStaleArchive.succeeded === 1, 'Scheduler-recovered stale-running candidates should remain governable.');

  const qualitySeedQuestion = await service.updateQuestionDraft(created.questionId, {
    prompt: 'If f(x) = 2x + 1, what is f(3)?',
    options: [
      { id: 'A', text: '7' },
      { id: 'B', text: '8' },
      { id: 'C', text: '6' },
      { id: 'D', text: '5' }
    ],
    correctAnswer: 'A',
    explanation: 'Substitute x = 3 into f(x) = 2x + 1: f(3) = 2 x 3 + 1 = 7.',
    knowledgeTags: ['function-value', 'substitution', 'quality-smoke'],
    optionMetadata: [
      { optionId: 'A', distractorIntent: 'correct answer', misconceptionTags: [] },
      { optionId: 'B', distractorIntent: 'adds one extra after substitution', misconceptionTags: ['condition-missing'] },
      { optionId: 'C', distractorIntent: 'forgets the constant term', misconceptionTags: ['condition-missing'] },
      { optionId: 'D', distractorIntent: 'subtracts instead of adding the constant term', misconceptionTags: ['operation-confusion'] }
    ],
    note: 'smoke_quality_metric_seed',
    allowHumanReview: true
  });
  created.questionId = qualitySeedQuestion.id;
  await markQuestionMetadataAsRealFixture(qualitySeedQuestion);
  // The metadata promotion above changes this row into a formal
  // subject-practice candidate. Re-run review so the current difficulty
  // evidence policy is attached before exercising manual approval.
  await service.reviewQuestion(created.questionId);
  await markQuestionMetadataAsRealFixture(qualitySeedQuestion);
  const approved = await service.approveQuestion(created.questionId, { allowHumanReview: true });
  created.publishedQuestionIds.push(approved.sourceQuestionId);
  assert(approved.status === 'approved', 'Question should be approved.');
  assert(approved.sourceQuestionId, 'Approved question should publish into special practice questions.');
  const healthAfterPublish = await service.topicQuestionBankHealth({ subject: smokeSubject, limit: 100 });
  const smokeHealthAfter = healthAfterPublish.items.find((item) => item.topicId === created.examTopicId);
  if (!smokeHealthAfter || smokeHealthAfter.publishedQuestionCount < 1) {
    const approvedDiagnostic = await prisma.$queryRaw`
      SELECT "id", "status", "topic_id" AS "topicId", "source_question_id" AS "sourceQuestionId",
             "syllabus_version" AS "syllabusVersion", "generation_metadata" AS "generationMetadata",
             "review_metadata" AS "reviewMetadata"
      FROM "csca_questions"
      WHERE "id" = ${approved.id}
    `;
    smokeHealthAfter.approvedDiagnostic = approvedDiagnostic;
  }
  assert(smokeHealthAfter?.publishedQuestionCount >= 1, `Topic health should count approved unified-bank questions as practice-ready. Got ${JSON.stringify(smokeHealthAfter)}`);
  assert(smokeHealthAfter?.bridgeQuestionCount >= 1, 'Topic health should still expose legacy bridge question count for migration tracking.');

  const [published] = await prisma.$queryRaw`
    SELECT q."id", q."status", mapping."topic_id" AS "topicId", topic."id" AS "bridgeTopicId"
    FROM "special_practice_questions" q
    JOIN "csca_topic_mappings" mapping ON mapping."source_type" = 'special_practice_question' AND mapping."source_id" = q."id"
    JOIN "special_practice_topics" topic ON topic."id" = q."topic_id"
    WHERE q."id" = ${approved.sourceQuestionId}
    LIMIT 1
  `;
  created.bridgeTopicId = published.bridgeTopicId;
  assert(published.status === 'published', 'Published bridge question should be available to adaptive practice.');
  assert(published.topicId === created.examTopicId, 'Published bridge question must map back to the CSCA exam topic.');
  const currentSelection = await adaptiveQuestionProvider.pickQuestions(910998, [{
    topicId: created.examTopicId,
    code: testCode,
    title: 'AI Questioning Smoke Topic',
    module: 'Smoke',
    targetDifficulty: '基础',
    reason: 'smoke'
  }], 1);
  assert(currentSelection.some((item) => item.questionId === approved.sourceQuestionId && item.questionSource === 'special_practice'), 'Approved AI question should publish into the formal special-practice bank and be selectable by adaptive practice.');
  const staleBackedQuestion = await createStalePublishedPracticeBackedQuestion({
    subject: smokeSubject,
    examTopicId: created.examTopicId,
    bridgeTopicId: created.bridgeTopicId
  });
  const governanceFilteredSelection = await adaptiveQuestionProvider.pickQuestions(910999, [{
    topicId: created.examTopicId,
    code: testCode,
    title: 'AI Questioning Smoke Topic',
    module: 'Smoke',
    targetDifficulty: '基础',
    reason: 'smoke-version-governance-filter'
  }], 5);
  assert(
    governanceFilteredSelection.some((item) => item.questionId === approved.sourceQuestionId && item.questionSource === 'special_practice'),
    'Version-governance filtering should keep current/legacy usable subject-practice AI questions selectable.'
  );
  assert(
    !governanceFilteredSelection.some((item) => item.questionId === staleBackedQuestion.bridgeQuestionId && item.questionSource === 'special_practice'),
    'Adaptive practice must not select published special-practice questions whose AI backing row is stale_needs_review.'
  );

  function governanceSmokeSample(label) {
    const samples = {
      archive: {
        prompt: 'Solve the inequality x^2 - x - 2 < 0.',
        options: [
          { id: 'A', text: 'x < -1 or x > 2' },
          { id: 'B', text: '-1 < x < 2' },
          { id: 'C', text: '-2 < x < 1' },
          { id: 'D', text: 'x < 1 or x > 2' }
        ],
        correctAnswer: 'B',
        explanation: 'Factor x^2 - x - 2 as (x - 2)(x + 1). The product is negative between the roots, so -1 < x < 2.',
        knowledgeTags: ['quadratic-inequality', 'interval-solution']
      },
      reject: {
        prompt: 'For the arithmetic sequence with a_1 = 3 and common difference d = 2, what is a_5?',
        options: [
          { id: 'A', text: '7' },
          { id: 'B', text: '9' },
          { id: 'C', text: '11' },
          { id: 'D', text: '13' }
        ],
        correctAnswer: 'C',
        explanation: 'Use a_n = a_1 + (n - 1)d. Thus a_5 = 3 + 4 x 2 = 11.',
        knowledgeTags: ['arithmetic-sequence', 'general-term']
      },
      'stale-syllabus': {
        prompt: 'What is the center of the circle (x - 1)^2 + (y + 2)^2 = 9?',
        options: [
          { id: 'A', text: '(1, -2)' },
          { id: 'B', text: '(-1, 2)' },
          { id: 'C', text: '(1, 2)' },
          { id: 'D', text: '(-1, -2)' }
        ],
        correctAnswer: 'A',
        explanation: 'The standard form is (x - a)^2 + (y - b)^2 = r^2, so the center is (1, -2).',
        knowledgeTags: ['circle-standard-form', 'coordinate-geometry']
      },
      'quality-archive': {
        prompt: 'If log_2 8 = k, what is k?',
        options: [
          { id: 'A', text: '2' },
          { id: 'B', text: '3' },
          { id: 'C', text: '4' },
          { id: 'D', text: '8' }
        ],
        correctAnswer: 'B',
        explanation: 'Since 2^3 = 8, log_2 8 = 3.',
        knowledgeTags: ['logarithm', 'exponential-form']
      },
      'reduce-exposure': {
        prompt: 'Given points A(1, 2) and B(5, 10), what is the slope of line AB?',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' }
        ],
        correctAnswer: 'B',
        explanation: 'The slope is (10 - 2) / (5 - 1) = 8 / 4 = 2.',
        knowledgeTags: ['slope', 'coordinate-geometry']
      },
      'normal-exposure': {
        prompt: 'The line y = mx + 1 passes through the point (2, 7). What is the value of m?',
        options: [
          { id: 'A', text: '2' },
          { id: 'B', text: '3' },
          { id: 'C', text: '4' },
          { id: 'D', text: '5' }
        ],
        correctAnswer: 'B',
        explanation: 'Substitute (2, 7) into y = mx + 1 to get 7 = 2m + 1, so 2m = 6 and m = 3.',
        knowledgeTags: ['linear-functions', 'substitution']
      }
    };
    return samples[label] ?? samples.archive;
  }

  async function publishGovernanceSmokeCandidate(label) {
    const sample = governanceSmokeSample(label);
    const wrongOptionTags = [`${label}-distractor`];
    const optionMetadata = sample.options
      .filter((option) => option.id !== sample.correctAnswer)
      .map((option, index) => ({
        optionId: option.id,
        distractorIntent: `plausible distractor ${index + 1}`,
        misconceptionTags: wrongOptionTags
      }));
    const candidate = await prisma.cscaQuestion.create({
      data: {
        subject: smokeSubject,
        topicId: created.examTopicId,
        blueprintId: created.blueprintId,
        sourceType: 'ai',
        designedDifficulty: '基础',
        questionType: 'single_choice',
        prompt: sample.prompt,
        options: sample.options,
        correctAnswer: sample.correctAnswer,
        explanation: sample.explanation,
        knowledgeTags: [...sample.knowledgeTags, `${label}-practice-pool-governance`],
        optionMetadata,
        syllabusVersion: '2026-smoke',
        generationMetadata: {
          status: 'success',
          generator: 'smoke-governance-seed',
          provider: 'smoke-fixture',
          model: 'smoke-fixture',
          requestHash: `smoke-governance-${label}-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          source: 'smoke-fixture'
        },
        reviewMetadata: {
          status: 'needs_review',
          issues: [],
          dimensions: [],
          sources: ['smoke-fixture'],
          checkedAt: new Date().toISOString()
        },
        status: 'pending_review'
      }
    });
    created.questionIds.push(candidate.id);
    const updated = await service.updateQuestionDraft(candidate.id, {
      prompt: sample.prompt,
      options: sample.options,
      correctAnswer: sample.correctAnswer,
      explanation: sample.explanation,
      knowledgeTags: [...sample.knowledgeTags, `${label}-practice-pool-governance`],
      optionMetadata,
      note: `smoke_${label}_practice_pool_governance`,
      allowHumanReview: true
    });
    await markQuestionMetadataAsRealFixture(updated);
    let approvedCandidate;
    try {
      approvedCandidate = await service.approveQuestion(updated.id, { allowHumanReview: true });
    } catch (error) {
      const detail = JSON.stringify(updated.reviewMetadata ?? {}, null, 2).slice(0, 1200);
      throw new Error(`Governance smoke candidate "${label}" could not be approved: ${error instanceof Error ? error.message : String(error)}\nreviewMetadata=${detail}`);
    }
    created.publishedQuestionIds.push(approvedCandidate.sourceQuestionId);
    assert(approvedCandidate.sourceQuestionId, `${label} candidate should publish into the practice pool.`);
    return approvedCandidate;
  }

  async function topicHealthForSmokeTopic() {
    const health = await service.topicQuestionBankHealth({ subject: smokeSubject, limit: 100, refresh: true });
    return health.items.find((item) => item.topicId === created.examTopicId);
  }

  const archivedApprovedCandidate = await publishGovernanceSmokeCandidate('archive');
  const healthBeforeArchiveGovernance = await topicHealthForSmokeTopic();
  await service.archiveQuestion(archivedApprovedCandidate.id);
  const [archivedPracticeQuestion] = await prisma.$queryRaw`
    SELECT "status"
    FROM "special_practice_questions"
    WHERE "id" = ${archivedApprovedCandidate.sourceQuestionId}
    LIMIT 1
  `;
  assert(archivedPracticeQuestion.status === 'archived', 'Archiving an approved AI question should also remove its published practice question from the active pool.');
  const healthAfterArchiveGovernance = await topicHealthForSmokeTopic();
  assert(
    healthAfterArchiveGovernance.bridgeQuestionCount < healthBeforeArchiveGovernance.bridgeQuestionCount,
    'Topic health bridge count should drop when an approved bridge question leaves the active practice pool.'
  );

  const rejectedApprovedCandidate = await publishGovernanceSmokeCandidate('reject');
  const healthBeforeRejectGovernance = await topicHealthForSmokeTopic();
  await service.rejectQuestion(rejectedApprovedCandidate.id, { reason: 'smoke_reject_published_candidate' });
  const [rejectedPracticeQuestion] = await prisma.$queryRaw`
    SELECT "status"
    FROM "special_practice_questions"
    WHERE "id" = ${rejectedApprovedCandidate.sourceQuestionId}
    LIMIT 1
  `;
  assert(rejectedPracticeQuestion.status === 'archived', 'Rejecting an approved AI question should also remove its published practice question from the active pool.');
  const healthAfterRejectGovernance = await topicHealthForSmokeTopic();
  assert(
    healthAfterRejectGovernance.bridgeQuestionCount < healthBeforeRejectGovernance.bridgeQuestionCount,
    'Topic health bridge count should drop when an approved bridge question is rejected.'
  );

  const staleSyllabusApprovedCandidate = await publishGovernanceSmokeCandidate('stale-syllabus');
  const healthBeforeStaleSyllabus = await topicHealthForSmokeTopic();
  await prisma.$executeRaw`
    UPDATE "csca_questions"
    SET "syllabus_version" = 'smoke-stale-syllabus',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${staleSyllabusApprovedCandidate.id}
  `;
  const healthAfterStaleSyllabus = await topicHealthForSmokeTopic();
  assert(
    healthAfterStaleSyllabus.approvedQuestionCount >= healthBeforeStaleSyllabus.approvedQuestionCount &&
      healthAfterStaleSyllabus.publishedQuestionCount < healthBeforeStaleSyllabus.publishedQuestionCount &&
      healthAfterStaleSyllabus.bridgeQuestionCount < healthBeforeStaleSyllabus.bridgeQuestionCount,
    'Topic health should keep stale approved questions visible in approved totals but remove them from practice-ready counts.'
  );

  const qualityArchiveApprovedCandidate = await publishGovernanceSmokeCandidate('quality-archive');
  const [qualityArchiveSession] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_sessions" ("user_id", "subject", "mode", "status", "question_language", "completed_at", "updated_at")
    VALUES (910997, ${smokeSubject}, 'practice', 'completed', 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id"
  `;
  created.adaptiveSessionIds.push(qualityArchiveSession.id);
  const [qualityArchiveRound] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_rounds" (
      "session_id", "round_index", "status", "answers", "time_spent", "current_question",
      "correct_count", "wrong_count", "unanswered_count", "submitted_at", "updated_at"
    )
    VALUES (
      ${qualityArchiveSession.id}, 1, 'submitted', '{}'::jsonb, '{}'::jsonb, 1,
      0, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  await prisma.$executeRaw`
    INSERT INTO "csca_adaptive_round_items" (
      "round_id", "question_id", "topic_id", "planned_difficulty", "position",
      "selected_answer", "is_correct", "time_spent_seconds", "updated_at"
    )
    VALUES (
      ${qualityArchiveRound.id}, ${qualityArchiveApprovedCandidate.sourceQuestionId}, ${created.examTopicId}, '基础', 1,
      'A', false, 30, CURRENT_TIMESTAMP
    )
  `;
  const qualityArchiveMetric = await qualityService.refreshForSpecialPracticeQuestionIds([qualityArchiveApprovedCandidate.sourceQuestionId]);
  assert(qualityArchiveMetric.refreshed === 1, 'Quality archive smoke should create a metric for the approved practice question.');
  await qualityService.applyDisposition(qualityArchiveApprovedCandidate.id, { disposition: 'archive', note: 'smoke_quality_archive_published_candidate' });
  const [qualityArchivedPracticeQuestion] = await prisma.$queryRaw`
    SELECT "status"
    FROM "special_practice_questions"
    WHERE "id" = ${qualityArchiveApprovedCandidate.sourceQuestionId}
    LIMIT 1
  `;
  assert(qualityArchivedPracticeQuestion.status === 'archived', 'Quality archive disposition should also remove the published practice question from the active pool.');

  for (let index = 0; index < 20; index += 1) {
    const [session] = await prisma.$queryRaw`
      INSERT INTO "csca_adaptive_sessions" ("user_id", "subject", "mode", "status", "question_language", "completed_at", "updated_at")
      VALUES (${910000 + index}, ${smokeSubject}, 'practice', 'completed', 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id"
    `;
    created.adaptiveSessionIds.push(session.id);
    const [round] = await prisma.$queryRaw`
      INSERT INTO "csca_adaptive_rounds" (
        "session_id", "round_index", "status", "answers", "time_spent", "current_question",
        "correct_count", "wrong_count", "unanswered_count", "submitted_at", "updated_at"
      )
      VALUES (
        ${session.id}, 1, 'submitted', '{}'::jsonb, '{}'::jsonb, 1,
        ${index === 0 ? 1 : 0}, ${index === 0 ? 0 : 1}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    await prisma.$executeRaw`
      INSERT INTO "csca_adaptive_round_items" (
        "round_id", "question_id", "topic_id", "planned_difficulty", "position",
        "selected_answer", "is_correct", "time_spent_seconds", "updated_at"
      )
      VALUES (
        ${round.id}, ${approved.sourceQuestionId}, ${created.examTopicId}, '基础', 1,
        ${index === 0 ? 'A' : 'B'}, ${index === 0}, ${20 + index}, CURRENT_TIMESTAMP
      )
    `;
  }

  const quality = await qualityService.refreshForSpecialPracticeQuestionIds([approved.sourceQuestionId]);
  assert(quality.refreshed === 1, 'Quality refresh should update the generated CSCA question.');
  assert(quality.items[0]?.attemptCount === 20, 'Quality metric should aggregate submitted attempts.');
  assert(quality.items[0]?.needsReview === true, 'Low quality signal should send generated question to review.');
  assert(quality.items[0]?.empiricalDifficulty === '挑战', 'Low correct rate should calibrate empirical difficulty.');
  assert(quality.items[0]?.mostSelectedWrongOption === 'B', 'Quality metric should capture the most selected wrong option.');
  assert(quality.items[0]?.optionSelectionStats?.some((item) => item.optionId === 'B' && item.count === 19), 'Quality metric should include option selection distribution.');
  assert(quality.items[0]?.qualitySummary?.severity === 'high', 'Quality summary should classify severe empirical quality problems.');
  assert(quality.items[0]?.qualitySummary?.recommendedAction === 'regenerate', 'Quality summary should recommend regeneration for severe low-quality generated questions.');
  assert(quality.items[0]?.qualitySummary?.evidence?.problemOptions?.some((item) => item.optionId === 'B' && item.signal === 'dominant_distractor'), 'Quality summary should expose problem option evidence.');
  const dominantWrong = quality.items[0]?.optionSelectionStats?.find((item) => item.optionId === 'B');
  assert(dominantWrong?.wrongSelectionRate === 1, 'Quality metric should expose wrong-option selection rate.');
  assert(dominantWrong?.misconceptionTags?.includes('condition-missing'), 'Quality metric should join option-level misconception tags.');
  const topicQualityAction = await service.runTopicAction(created.examTopicId, { action: 'review_quality', limit: 5 });
  assert(topicQualityAction.action === 'review_quality' && topicQualityAction.underlyingAction === 'send_to_review', 'Topic quality action should route through quality governance, not candidate review.');
  assert(topicQualityAction.succeeded >= 1, 'Topic quality action should hand off matching low-quality questions to quality review.');
  const topicQualityHandoff = await qualityService.listMetrics({ questionIds: [quality.items[0].questionId] });
  assert(topicQualityHandoff[0]?.qualityGovernance?.status === 'needs_review', 'Topic quality action should write quality governance metadata.');
  const qualityTrend = await qualityService.qualityTrend({ subject: smokeSubject, days: 7 });
  assert(qualityTrend.summary.attemptCount >= 20, 'Quality trend should aggregate recent AI-backed practice attempts.');
  assert(qualityTrend.summary.needsReviewCount >= 1, 'Quality trend should expose current review workload.');
  assert(qualityTrend.summary.highSeverityCount >= 1, 'Quality trend should expose high-severity quality workload.');
  assert(qualityTrend.bySubject.some((item) => item.subject === smokeSubject && item.attemptCount >= 20), 'Quality trend should group recent attempts by subject.');
  assert(qualityTrend.byDay.some((item) => item.subject === smokeSubject && item.attemptCount >= 20), 'Quality trend should group recent attempts by day.');
  const [directQualitySession] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_sessions" ("user_id", "subject", "mode", "status", "question_language", "completed_at", "updated_at")
    VALUES (910050, ${smokeSubject}, 'practice', 'completed', 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id"
  `;
  created.adaptiveSessionIds.push(directQualitySession.id);
  const [directQualityRound] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_rounds" (
      "session_id", "round_index", "status", "answers", "time_spent", "current_question",
      "correct_count", "wrong_count", "unanswered_count", "submitted_at", "updated_at"
    )
    VALUES (
      ${directQualitySession.id}, 1, 'submitted', '{}'::jsonb, '{}'::jsonb, 1,
      1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  await prisma.$executeRaw`
    INSERT INTO "csca_adaptive_round_items" (
      "round_id", "question_id", "question_source", "topic_id", "planned_difficulty", "position",
      "selected_answer", "is_correct", "time_spent_seconds", "updated_at"
    )
    VALUES (
      ${directQualityRound.id}, ${approved.id}, 'csca_question', ${created.examTopicId}, '基础', 1,
      'A', true, 18, CURRENT_TIMESTAMP
    )
  `;
  const refreshedAllQuality = await qualityService.refreshAll();
  const refreshedUnifiedQuality = refreshedAllQuality.items.find((item) => item.questionId === approved.id);
  assert(refreshedUnifiedQuality?.attemptCount === 21, 'Quality refresh-all should merge special-practice and direct unified-bank attempts for the same AI question.');
  assert(refreshedUnifiedQuality?.optionSelectionStats?.some((item) => item.optionId === 'A' && item.count === 2), 'Merged quality stats should include option selections from both practice sources.');
  const sentToReview = await qualityService.sendMetricToReview(generated.question.id, { reason: 'smoke_quality_review' });
  assert(sentToReview.needsReview === true && sentToReview.reviewReason === 'smoke_quality_review', 'Quality metric should be sendable back to review.');
  assert(sentToReview.qualityGovernance?.status === 'needs_review', 'Quality metric should expose the latest send-to-review governance decision.');
  const assignedReview = await qualityService.assignMetricReview(generated.question.id, { assignedTo: 2, reason: 'smoke_assigned_quality_review', note: 'smoke_assign' }, 1);
  assert(assignedReview.needsReview === true && assignedReview.reviewReason === 'smoke_assigned_quality_review', 'Quality metric should be assignable for human review.');
  assert(assignedReview.qualityGovernance?.status === 'assigned', 'Quality metric should expose assigned review governance status.');
  assert(assignedReview.qualityGovernance?.assignedTo === 2, 'Assigned quality review should record the assignee.');
  assert(assignedReview.qualityGovernance?.assignedBy === 1, 'Assigned quality review should record the assigning admin.');
  const qualityResolved = await qualityService.resolveMetric(generated.question.id, { note: 'smoke_resolved' });
  assert(qualityResolved.needsReview === false, 'Quality metric should be markable as resolved.');
  assert(qualityResolved.qualityGovernance?.status === 'resolved', 'Quality metric should expose the latest resolved governance decision.');
  const reducedExposureCandidate = await publishGovernanceSmokeCandidate('reduce-exposure');
  const normalExposureCandidate = await publishGovernanceSmokeCandidate('normal-exposure');
  const [reducedExposureSession] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_sessions" ("user_id", "subject", "mode", "status", "question_language", "completed_at", "updated_at")
    VALUES (910996, ${smokeSubject}, 'practice', 'completed', 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id"
  `;
  created.adaptiveSessionIds.push(reducedExposureSession.id);
  const [reducedExposureRound] = await prisma.$queryRaw`
    INSERT INTO "csca_adaptive_rounds" (
      "session_id", "round_index", "status", "answers", "time_spent", "current_question",
      "correct_count", "wrong_count", "unanswered_count", "submitted_at", "updated_at"
    )
    VALUES (
      ${reducedExposureSession.id}, 1, 'submitted', '{}'::jsonb, '{}'::jsonb, 1,
      0, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  await prisma.$executeRaw`
    INSERT INTO "csca_adaptive_round_items" (
      "round_id", "question_id", "topic_id", "planned_difficulty", "position",
      "selected_answer", "is_correct", "time_spent_seconds", "updated_at"
    )
    VALUES (
      ${reducedExposureRound.id}, ${reducedExposureCandidate.sourceQuestionId}, ${created.examTopicId}, '基础', 1,
      'A', false, 30, CURRENT_TIMESTAMP
    )
  `;
  const reducedExposureMetric = await qualityService.refreshForSpecialPracticeQuestionIds([reducedExposureCandidate.sourceQuestionId]);
  assert(reducedExposureMetric.refreshed === 1, 'Reduce-exposure smoke should create a metric for the approved practice question.');
  const reducedExposure = await qualityService.applyDisposition(reducedExposureCandidate.id, { disposition: 'reduce_exposure', note: 'smoke_reduce_exposure' });
  assert(reducedExposure.qualityGovernance?.disposition === 'reduce_exposure', 'Quality disposition should record reduced exposure decisions.');
  const reducedExposureSelection = await adaptiveQuestionProvider.pickQuestions(910995, [{
    topicId: created.examTopicId,
    code: testCode,
    title: 'AI Questioning Smoke Topic',
    module: 'Smoke',
    targetDifficulty: '基础',
    reason: 'smoke_reduce_exposure'
  }], 1);
  assert(
    reducedExposureSelection.length === 1 &&
      !reducedExposureSelection.some((item) => (
        item.questionId === reducedExposureCandidate.id && item.questionSource === 'csca_question'
      ) || (
        item.questionId === reducedExposureCandidate.sourceQuestionId && item.questionSource === 'special_practice'
      )),
    `Adaptive provider should prefer normal candidates before reduced-exposure AI-backed questions. selection=${JSON.stringify(reducedExposureSelection)} reduced=${JSON.stringify({ id: reducedExposureCandidate.id, sourceQuestionId: reducedExposureCandidate.sourceQuestionId })} normal=${JSON.stringify({ id: normalExposureCandidate.id, sourceQuestionId: normalExposureCandidate.sourceQuestionId })}`
  );
  const manualFix = await qualityService.applyDisposition(generated.question.id, { disposition: 'manual_fix', note: 'smoke_manual_fix' });
  assert(manualFix.needsReview === true && manualFix.reviewReason === 'manual_fix_required', 'Manual-fix disposition should send the metric back to review.');
  const reviewedManualFix = await service.reviewQuestion(generated.question.id);
  assert(reviewedManualFix.status === 'pending_review', 'Reviewing a manual-fix candidate should keep it in the review queue when deterministic gates pass.');
  const [reviewedManualFixRow] = await prisma.$queryRaw`
    SELECT "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${generated.question.id}
    LIMIT 1
  `;
  assert(reviewedManualFixRow.reviewMetadata?.qualityGovernance?.disposition === 'manual_fix', 'Reviewing a candidate should preserve quality governance metadata.');
  assert(reviewedManualFixRow.reviewMetadata?.reviewGate?.status, 'Reviewing a candidate should record review gate metadata.');
  let regeneratedDisposition = await qualityService.applyDisposition(generated.question.id, { disposition: 'regenerate', note: 'smoke_regenerate' });
  assert(regeneratedDisposition.needsReview === true && regeneratedDisposition.reviewReason === 'regeneration_required', 'Regenerate disposition should request a replacement review.');
  assert(regeneratedDisposition.qualityGovernance?.replacementQuestionId, 'Regenerate disposition should create a replacement candidate.');
  created.questionIds.push(regeneratedDisposition.qualityGovernance.replacementQuestionId);
  const [replacementQuestion] = await prisma.$queryRaw`
    SELECT "id", "status", "generated_variant_of" AS "generatedVariantOf", "generation_metadata" AS "generationMetadata"
    FROM "csca_questions"
    WHERE "id" = ${regeneratedDisposition.qualityGovernance.replacementQuestionId}
    LIMIT 1
  `;
  assert(replacementQuestion.status === 'pending_review', 'Replacement candidate should wait for human review.');
  assert(replacementQuestion.generatedVariantOf === generated.question.id, 'Replacement candidate should be linked to the low-quality source question.');
  assert(replacementQuestion.generationMetadata?.purpose === 'quality_replacement', 'Replacement candidate should be marked as quality replacement.');
  await service.archiveQuestion(regeneratedDisposition.qualityGovernance.replacementQuestionId);
  regeneratedDisposition = await qualityService.applyDisposition(generated.question.id, { disposition: 'regenerate', note: 'smoke_regenerate_after_stale_replacement' });
  assert(
    regeneratedDisposition.qualityGovernance?.replacementQuestionId &&
    regeneratedDisposition.qualityGovernance.replacementQuestionId !== replacementQuestion.id,
    'Regenerate disposition should create a fresh replacement candidate after the previous replacement is archived.'
  );
  created.questionIds.push(regeneratedDisposition.qualityGovernance.replacementQuestionId);
  const [freshReplacementQuestion] = await prisma.$queryRaw`
    SELECT "id", "status", "generated_variant_of" AS "generatedVariantOf", "generation_metadata" AS "generationMetadata"
    FROM "csca_questions"
    WHERE "id" = ${regeneratedDisposition.qualityGovernance.replacementQuestionId}
    LIMIT 1
  `;
  assert(freshReplacementQuestion.status === 'pending_review', 'Fresh replacement candidate should wait for human review.');
  assert(freshReplacementQuestion.generatedVariantOf === generated.question.id, 'Fresh replacement candidate should remain linked to the low-quality source question.');

  const [metadataRow] = await prisma.$queryRaw`
    SELECT "option_metadata" AS "optionMetadata"
    FROM "csca_questions"
    WHERE "id" = ${generated.question.id}
    LIMIT 1
  `;
  const bMetadata = metadataRow.optionMetadata.find((item) => item.optionId === 'B');
  assert(bMetadata?.evidence?.wrongSelectionRate === 1, 'Option metadata should be enriched with observed evidence.');

  const misconceptionRows = await prisma.$queryRaw`
    SELECT "slug", "label"
    FROM "csca_question_misconceptions"
    WHERE "topic_id" = ${created.examTopicId}
      AND "label" = 'condition-missing'
  `;
  assert(misconceptionRows.length >= 1, 'Observed option misconception tags should be upserted into the misconception dictionary.');
  const misconceptionSummary = await service.listMisconceptions({ subject: smokeSubject, limit: 20 });
  const smokeMisconception = misconceptionSummary.items.find((item) => item.label === 'condition-missing');
  assert(smokeMisconception, 'Misconception governance list should include observed option tags.');
  assert(smokeMisconception.optionCount >= 1, 'Misconception governance list should include option-level usage counts.');
  assert(
    misconceptionSummary.governance.suggestions.some((item) => item.issue === 'missing_concept_card' && item.misconceptionId === smokeMisconception.id),
    'Misconception governance should flag active option-level tags without a published concept card.'
  );
  const [duplicateMisconception] = await prisma.$queryRaw`
    INSERT INTO "csca_question_misconceptions" ("slug", "subject", "topic_id", "label", "description", "status", "updated_at")
    VALUES (${`${smokeSubject}-${created.examTopicId}-smoke-condition-missing-duplicate`}, ${smokeSubject}, ${created.examTopicId}, 'condition missing', 'Smoke duplicate tag.', 'active', CURRENT_TIMESTAMP)
    RETURNING "id", "label"
  `;
  const duplicateGovernance = await service.listMisconceptions({ subject: smokeSubject, limit: 20 });
  assert(
    duplicateGovernance.governance.suggestions.some((item) => item.issue === 'possible_duplicate' && item.misconceptionId === duplicateMisconception.id && item.targetId === smokeMisconception.id),
    'Misconception governance should flag normalized duplicate tags and suggest the stronger target.'
  );
  const governanceConceptCard = await service.createConceptCardForMisconception(duplicateMisconception.id, {
    note: 'smoke_governance_concept_card'
  });
  assert(governanceConceptCard.created === true, 'Misconception governance should create a concept card draft when none exists.');
  assert(governanceConceptCard.item.status === 'draft', 'Governance-created concept card should start as a draft.');
  assert(governanceConceptCard.item.misconceptionLabel === duplicateMisconception.label, 'Governance-created concept card should stay linked to the source misconception.');
  const reusedGovernanceConceptCard = await service.createConceptCardForMisconception(duplicateMisconception.id, {
    note: 'smoke_governance_concept_card_reuse'
  });
  assert(reusedGovernanceConceptCard.created === false, 'Misconception governance should reuse an existing non-archived concept card draft.');
  const governanceVariant = await service.createVariantForMisconception(duplicateMisconception.id, {
    note: 'smoke_governance_variant'
  });
  created.questionIds.push(governanceVariant.questionId);
  assert(governanceVariant.created === true, 'Misconception governance should create a variant candidate when none exists.');
  assert(governanceVariant.status === 'pending_review', 'Governance-created variant should start in pending review.');
  assert(governanceVariant.sourceQuestionId === generated.question.id, 'Governance-created variant should link back to the source question.');
  const reusedGovernanceVariant = await service.createVariantForMisconception(duplicateMisconception.id, {
    note: 'smoke_governance_variant_reuse'
  });
  assert(reusedGovernanceVariant.created === false, 'Misconception governance should reuse an existing variant candidate.');
  assert(reusedGovernanceVariant.questionId === governanceVariant.questionId, 'Reused governance variant should return the existing candidate id.');
  const [mergeTarget] = await prisma.$queryRaw`
    INSERT INTO "csca_question_misconceptions" ("slug", "subject", "topic_id", "label", "description", "status", "updated_at")
    VALUES (${`${smokeSubject}-${created.examTopicId}-smoke-condition-gap`}, ${smokeSubject}, ${created.examTopicId}, 'condition-gap', 'Smoke merge target.', 'active', CURRENT_TIMESTAMP)
    RETURNING "id", "label"
  `;
  const mergedMisconception = await service.mergeMisconception(smokeMisconception.id, {
    targetId: mergeTarget.id,
    note: 'smoke_merge'
  });
  assert(mergedMisconception.migrated.questions >= 1, 'Misconception merge should update question option metadata.');
  assert(mergedMisconception.migrated.optionTags >= 1, 'Misconception merge should migrate option-level tags.');
  const [mergedMetadataRow] = await prisma.$queryRaw`
    SELECT "option_metadata" AS "optionMetadata"
    FROM "csca_questions"
    WHERE "id" = ${generated.question.id}
    LIMIT 1
  `;
  const mergedBMetadata = mergedMetadataRow.optionMetadata.find((item) => item.optionId === 'B');
  assert(mergedBMetadata?.misconceptionTags?.includes('condition-gap'), 'Misconception merge should replace source option tags with target label.');
  assert(!mergedBMetadata?.misconceptionTags?.includes('condition-missing'), 'Misconception merge should remove the source option tag.');
  const [mergedSourceRow] = await prisma.$queryRaw`
    SELECT "status"
    FROM "csca_question_misconceptions"
    WHERE "id" = ${smokeMisconception.id}
    LIMIT 1
  `;
  assert(mergedSourceRow.status === 'archived', 'Merged source misconception should be archived.');
  const editedMisconception = await service.updateMisconception(mergeTarget.id, {
    label: 'condition-gap-edited',
    description: 'Edited smoke misconception description.'
  });
  assert(editedMisconception.label === 'condition-gap-edited', 'Misconception label should be editable by admins.');
  assert(editedMisconception.description === 'Edited smoke misconception description.', 'Misconception description should be editable by admins.');
  const archivedMisconception = await service.updateMisconceptionStatus(mergeTarget.id, 'archived');
  assert(archivedMisconception.status === 'archived', 'Misconception tag should be archivable by admins.');
  const restoredMisconception = await service.updateMisconceptionStatus(mergeTarget.id, 'active');
  assert(restoredMisconception.status === 'active', 'Misconception tag should be restorable by admins.');
  const conceptCards = await prisma.$queryRaw`
    SELECT "id", "status", "source", "misconception_id" AS "misconceptionId"
    FROM "csca_concept_cards"
    WHERE "topic_id" = ${created.examTopicId}
      AND "source" = 'quality_feedback'
  `;
  assert(conceptCards.some((item) => item.status === 'draft'), 'Dominant misconception should create a draft concept card.');
  assert(conceptCards.every((item) => item.misconceptionId === mergeTarget.id), 'Misconception merge should migrate concept cards to the target tag.');
  const conceptCard = conceptCards.find((item) => item.status === 'draft');
  const editedCard = await service.updateConceptCard(conceptCard.id, {
    title: 'Edited smoke concept card',
    body: 'Edited concept card body for smoke validation.',
    note: 'smoke_edit'
  });
  assert(editedCard.title === 'Edited smoke concept card', 'Concept card title should be editable before publication.');
  assert(editedCard.body === 'Edited concept card body for smoke validation.', 'Concept card body should be editable before publication.');
  assert(editedCard.reviewMetadata?.adminEdit?.note === 'smoke_edit', 'Concept card edit should persist admin edit metadata.');
  const publishedCard = await service.updateConceptCardStatus(conceptCard.id, 'published', { note: 'smoke_publish' });
  assert(publishedCard.status === 'published', 'Concept card draft should be publishable from the remediation queue.');
  const archivedCard = await service.updateConceptCardStatus(conceptCard.id, 'archived', { note: 'smoke_archive' });
  assert(archivedCard.status === 'archived', 'Concept card should be archivable from the remediation queue.');
  const variantBlueprints = await prisma.$queryRaw`
    SELECT "id", "source", "constraints"
    FROM "csca_question_blueprints"
    WHERE "topic_id" = ${created.examTopicId}
      AND "source" = 'misconception_variant'
  `;
  assert(variantBlueprints.some((item) => item.constraints?.originalQuestionId === generated.question.id), 'Dominant misconception should create a variant blueprint.');
  const variantQuestions = await prisma.$queryRaw`
    SELECT "id", "status", "generated_variant_of" AS "generatedVariantOf"
    FROM "csca_questions"
    WHERE "generated_variant_of" = ${generated.question.id}
  `;
  assert(variantQuestions.some((item) => item.status === 'pending_review'), 'Dominant misconception should create a pending-review variant candidate.');
  assert(!variantQuestions.some((item) => item.status === 'approved'), 'Variant candidates must not be auto-approved.');
  const topicDetail = await service.topicQuestionBankDetail(created.examTopicId);
  assert(topicDetail.topic.id === created.examTopicId, 'Topic detail should include the selected exam topic.');
  assert(topicDetail.blueprints.some((item) => item.id === created.blueprintId), 'Topic detail should include topic blueprints.');
  assert(topicDetail.questions.some((item) => item.id === generated.question.id), 'Topic detail should include topic candidates.');
  assert(topicDetail.quality.some((item) => item.questionId === generated.question.id), 'Topic detail should include topic quality metrics.');
  assert(topicDetail.quality.some((item) => item.questionId === generated.question.id && item.qualityGovernance?.disposition === 'regenerate'), 'Topic detail should expose quality governance decisions.');
  assert(topicDetail.questions.some((item) => item.id === regeneratedDisposition.qualityGovernance.replacementQuestionId), 'Topic detail should include replacement candidates.');
  assert(topicDetail.remediation.some((item) => item.sourceQuestionId === generated.question.id), 'Topic detail should include topic remediation materials.');

  const replacementId = regeneratedDisposition.qualityGovernance.replacementQuestionId;
  const reviewedReplacement = await service.reviewQuestion(replacementId);
  assert(reviewedReplacement.status === 'pending_review', 'Reviewing a replacement candidate should keep it in the review queue when deterministic gates pass.');
  const [reviewedReplacementRow] = await prisma.$queryRaw`
    SELECT "generated_variant_of" AS "generatedVariantOf", "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${replacementId}
    LIMIT 1
  `;
  assert(reviewedReplacementRow.generatedVariantOf === generated.question.id, 'Reviewing a replacement candidate should preserve its source link.');
  assert(reviewedReplacementRow.generationMetadata?.purpose === 'quality_replacement', 'Reviewing a replacement candidate should preserve its replacement purpose.');
  assert(reviewedReplacementRow.reviewMetadata?.reviewGate?.status, 'Reviewing a candidate should record review gate metadata.');
  await markQuestionMetadataAsRealFixture(reviewedReplacement);
  const approvedReplacement = await service.approveQuestion(replacementId, { allowHumanReview: true });
  created.publishedQuestionIds.push(approvedReplacement.sourceQuestionId);
  assert(approvedReplacement.status === 'approved' && approvedReplacement.sourceQuestionId, 'Approved quality replacement should publish into the practice bank.');
  const [replacedSource] = await prisma.$queryRaw`
    SELECT q."status", q."review_metadata" AS "reviewMetadata", metric."needs_review" AS "needsReview"
    FROM "csca_questions" q
    LEFT JOIN "csca_question_quality_metrics" metric ON metric."question_id" = q."id"
    WHERE q."id" = ${generated.question.id}
    LIMIT 1
  `;
  assert(replacedSource.status === 'archived', 'Approving a quality replacement should archive the low-quality source question.');
  assert(replacedSource.needsReview === false, 'Approving a quality replacement should resolve the source quality metric.');
  assert(replacedSource.reviewMetadata?.qualityGovernance?.disposition === 'replaced', 'Source question should record the replacement governance decision.');
  assert(replacedSource.reviewMetadata?.qualityGovernance?.replacementQuestionId === replacementId, 'Source question should link to the approved replacement candidate.');
  assert(replacedSource.reviewMetadata?.qualityGovernance?.replacementPublishedQuestionId === approvedReplacement.sourceQuestionId, 'Source question should link to the published replacement practice question.');
  const [replacedPublishedPracticeQuestion] = await prisma.$queryRaw`
    SELECT "status"
    FROM "special_practice_questions"
    WHERE "id" = ${approved.sourceQuestionId}
    LIMIT 1
  `;
  assert(replacedPublishedPracticeQuestion.status === 'archived', 'Approving a quality replacement should remove the old published practice question from the active pool.');
  const [approvedReplacementRow] = await prisma.$queryRaw`
    SELECT "review_metadata" AS "reviewMetadata", "source_question_id" AS "sourceQuestionId"
    FROM "csca_questions"
    WHERE "id" = ${replacementId}
    LIMIT 1
  `;
  assert(approvedReplacementRow.sourceQuestionId === approvedReplacement.sourceQuestionId, 'Replacement candidate should remember its published practice question id.');
  assert(approvedReplacementRow.reviewMetadata?.replacementApproval?.replacedQuestionId === generated.question.id, 'Replacement candidate should record the replaced source question.');
  const replacedMetric = await qualityService.listMetrics({ questionIds: [generated.question.id] });
  assert(replacedMetric[0]?.questionStatus === 'archived', 'Quality metric API should expose that the replaced source question left the active pool.');
  assert(replacedMetric[0]?.qualityGovernance?.replacementPublishedQuestionId === approvedReplacement.sourceQuestionId, 'Quality metric API should expose the published replacement practice question.');

  const importNewTopicCode = `${testCode}-json-import-new`;
  const legacyImportTopicCode = `${testCode}-json-import-legacy`;
  const migratedImportTopicCode = `${testCode}-json-import-migrated`;
  created.syllabusImportTopicCode = importNewTopicCode;
  created.syllabusImportTopicCodes.push(importNewTopicCode, legacyImportTopicCode, migratedImportTopicCode);
  const [legacyImportTopic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "status"
    )
    VALUES (
      ${smokeSubject}, 'Smoke JSON Legacy', ${legacyImportTopicCode}, 'AI Questioning JSON Import Legacy Topic',
      'Legacy topic for JSON code migration.', 'Legacy topic imported from an older syllabus code.',
      '2025-json-import', 1, 'published'
    )
    RETURNING "id"
  `;
  const syllabusJsonPayload = {
    schemaVersion: 'csca-syllabus-v1',
    subject: smokeSubject,
    syllabusVersion: '2026-json-import',
    sourceLabel: 'Smoke JSON syllabus source',
    sourceUrl: 'https://example.test/csca-json-syllabus',
    verifiedAt: '2026-06-11T00:00:00.000Z',
    topics: [
      {
        code: testCode,
        title: 'AI Questioning Smoke Topic Updated From JSON',
        module: 'Smoke JSON',
        examScope: 'Updated smoke scope imported from JSON.',
        allowedQuestionTypes: ['single_choice'],
        difficultyRange: ['基础', '中等'],
        weight: 2,
        skills: ['json-import'],
        aliases: ['smoke json import'],
        excludedScope: ['unrelated calculus'],
        status: 'published'
      },
      {
        code: importNewTopicCode,
        title: 'AI Questioning JSON Import New Topic',
        module: 'Smoke JSON',
        examScope: 'New topic created by JSON syllabus import.',
        allowedQuestionTypes: ['single_choice'],
        difficultyRange: ['基础'],
        weight: 1,
        skills: ['new-topic'],
        aliases: [],
        excludedScope: [],
        status: 'published'
      },
      {
        code: migratedImportTopicCode,
        previousCodes: [legacyImportTopicCode],
        title: 'AI Questioning JSON Import Migrated Topic',
        module: 'Smoke JSON',
        examScope: 'Migrated topic created by JSON syllabus import from a previous code.',
        allowedQuestionTypes: ['single_choice'],
        difficultyRange: ['基础'],
        weight: 1,
        skills: ['code-migration'],
        aliases: [],
        excludedScope: [],
        status: 'published'
      }
    ]
  };
  const jsonImportPreview = await service.previewSyllabusJsonImport(syllabusJsonPayload);
  assert(jsonImportPreview.summary.updatedTopics === 2, 'Syllabus JSON preview should detect updated existing and migrated topics.');
  assert(jsonImportPreview.summary.newTopics === 1, 'Syllabus JSON preview should detect new topics.');
  assert(jsonImportPreview.items.some((item) => item.code === migratedImportTopicCode && item.matchedBy === 'previous_code' && item.previousCode === legacyImportTopicCode), 'Syllabus JSON preview should match migrated topics by previous code.');
  assert(jsonImportPreview.summary.approvedQuestionsBecomingPendingReview >= 1, 'Syllabus JSON preview should count approved questions that need review after version change.');
  const createdImport = await service.createSyllabusJsonImport(syllabusJsonPayload, 3);
  created.syllabusImportIds.push(createdImport.import.id);
  assert(createdImport.import.status === 'draft', 'Syllabus JSON import should be saved as a draft before apply.');
  assert(createdImport.preview.summary.updatedTopics === 2, 'Saved syllabus JSON import should persist preview summary.');
  const listedImports = await service.listSyllabusJsonImports({ subject: smokeSubject, status: 'draft', limit: 10 });
  assert(listedImports.items.some((item) => item.id === createdImport.import.id), 'Syllabus JSON import list should include the saved draft.');
  const importDetail = await service.getSyllabusJsonImport(createdImport.import.id);
  assert(importDetail.rawJson?.syllabusVersion === '2026-json-import', 'Syllabus JSON import detail should expose the stored normalized JSON.');
  const appliedImport = await service.applySyllabusJsonImport(createdImport.import.id, { missingTopicAction: 'keep' }, 3);
  assert(appliedImport.import.status === 'applied', 'Syllabus JSON import apply should mark the import as applied.');
  assert(appliedImport.apply.refreshedQuestionCount >= 1, 'Syllabus JSON import apply should move stale approved questions into review.');
  assert(appliedImport.apply.blueprintSyncedCount >= 1, 'Syllabus JSON import apply should sync affected blueprint syllabus scopes.');
  assert(appliedImport.import.previewSummary?.apply?.migrationCount === 1, 'Syllabus JSON import apply should persist the code migration count.');
  assert(appliedImport.import.previewSummary?.apply?.blueprintSyncedCount >= 1, 'Syllabus JSON import apply should persist blueprint sync counts.');
  assert(appliedImport.import.previewSummary?.apply?.migrations?.[0]?.previousCode === legacyImportTopicCode, 'Syllabus JSON import apply should persist the previous code migration audit row.');
  assert(appliedImport.import.previewSummary?.apply?.migrations?.[0]?.nextCode === migratedImportTopicCode, 'Syllabus JSON import apply should persist the next code migration audit row.');
  const reversePlan = await controller.createSyllabusJsonImportReversePlan(String(createdImport.import.id), {
    id: 5,
    email: 'ai-questioning-reverse-plan-admin@example.test'
  });
  assert(reversePlan.reversePlan.mode === 'dry_run', 'Syllabus reverse plan must be dry-run only.');
  assert(reversePlan.reversePlan.importId === createdImport.import.id, 'Syllabus reverse plan should target the applied import.');
  assert(reversePlan.reversePlan.summary.topicOperations >= 3, 'Syllabus reverse plan should include imported topic operations.');
  assert(reversePlan.reversePlan.summary.codeMigrationOperations === 1, 'Syllabus reverse plan should include code migration operations.');
  assert(reversePlan.reversePlan.summary.questionReviewCount >= 1, 'Syllabus reverse plan should count questions marked by the import metadata.');
  assert(reversePlan.reversePlan.questionReview.recommendation === 'quality_attention_required', 'Syllabus reverse plan must require explicit quality attention for affected questions.');
  const reversePlanAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'syllabus-import',
      resourceId: String(createdImport.import.id),
      action: 'reverse_plan'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(reversePlanAuditRows.length === 1, 'Syllabus reverse plan endpoint should write an admin audit log.');
  created.adminAuditLogIds.push(reversePlanAuditRows[0].id);
  assert(reversePlanAuditRows[0].actorId === 5, 'Syllabus reverse plan audit log should record the actor id.');
  assert(reversePlanAuditRows[0].after?.reversePlan?.summary?.questionReviewCount >= 1, 'Syllabus reverse plan audit log should preserve the compact plan summary.');
  assert(!reversePlanAuditRows[0].after?.reversePlan?.operations, 'Syllabus reverse plan audit log should not store full operation snapshots.');
  const recoveryDraft = await controller.createSyllabusJsonImportRecoveryDraft(String(createdImport.import.id), {
    id: 4,
    email: 'ai-questioning-recovery-admin@example.test'
  });
  created.syllabusImportIds.push(recoveryDraft.import.id);
  assert(recoveryDraft.import.status === 'draft', 'Syllabus recovery draft should create a new draft import.');
  assert(recoveryDraft.import.id !== createdImport.import.id, 'Syllabus recovery draft should not mutate the source import.');
  assert(recoveryDraft.import.rawJson?.syllabusVersion === '2026-json-import', 'Syllabus recovery draft should preserve the original normalized JSON.');
  assert(recoveryDraft.import.previewSummary?.recovery?.sourceImportId === createdImport.import.id, 'Syllabus recovery draft should record its source import id.');
  assert(recoveryDraft.import.previewSummary?.recovery?.sourceImportStatus === 'applied', 'Syllabus recovery draft should record the source import status.');
  assert(recoveryDraft.preview.summary.subject === smokeSubject, 'Syllabus recovery draft should return a refreshed preview.');
  assert(recoveryDraft.preview.summary.updatedTopics >= 0, 'Syllabus recovery draft preview should expose refreshed update counts.');
  const recoveryAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'syllabus-import',
      resourceId: String(createdImport.import.id),
      action: 'recovery_draft'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(recoveryAuditRows.length === 1, 'Syllabus recovery draft endpoint should write an admin audit log.');
  created.adminAuditLogIds.push(recoveryAuditRows[0].id);
  assert(recoveryAuditRows[0].actorId === 4, 'Syllabus recovery draft audit log should record the actor id.');
  assert(recoveryAuditRows[0].after?._audit?.actor?.id === 4, 'Syllabus recovery draft audit metadata should include the actor summary.');
  assert(recoveryAuditRows[0].after?.import?.id === recoveryDraft.import.id, 'Syllabus recovery draft audit log should include the new draft import.');
  assert(recoveryAuditRows[0].after?.import?.previewSummary?.recovery?.sourceImportId === createdImport.import.id, 'Syllabus recovery draft audit log should preserve recovery metadata.');
  const [jsonAppliedTopic] = await prisma.$queryRaw`
    SELECT "title", "syllabus_version" AS "syllabusVersion", "source_label" AS "sourceLabel",
           "excluded_scope" AS "excludedScope", "verified_by" AS "verifiedBy"
    FROM "csca_exam_topics"
    WHERE "id" = ${created.examTopicId}
    LIMIT 1
  `;
  assert(jsonAppliedTopic.title === 'AI Questioning Smoke Topic Updated From JSON', 'Syllabus JSON import apply should update existing topic fields.');
  assert(jsonAppliedTopic.syllabusVersion === '2026-json-import', 'Syllabus JSON import apply should update existing topic version.');
  assert(jsonAppliedTopic.sourceLabel === 'Smoke JSON syllabus source', 'Syllabus JSON import apply should persist source metadata.');
  assert(Array.isArray(jsonAppliedTopic.excludedScope) && jsonAppliedTopic.excludedScope.includes('unrelated calculus'), 'Syllabus JSON import apply should persist excluded scope on the topic.');
  assert(jsonAppliedTopic.verifiedBy === 3, 'Syllabus JSON import apply should record the verifying admin.');
  const [jsonSyncedBlueprint] = await prisma.$queryRaw`
    SELECT "status", "constraints"
    FROM "csca_question_blueprints"
    WHERE "id" = ${created.blueprintId}
    LIMIT 1
  `;
  assert(jsonSyncedBlueprint.status === 'active', 'Published syllabus import should keep active blueprints active after scope sync.');
  assert(jsonSyncedBlueprint.constraints?.syllabusGovernance?.status === 'synced', 'Syllabus JSON import apply should mark affected blueprint scope as synced.');
  assert(jsonSyncedBlueprint.constraints?.syllabusScope?.excludedScope?.includes('unrelated calculus'), 'Syllabus JSON import apply should sync excluded scope into blueprint constraints.');
  const confirmedBlueprint = await controller.confirmBlueprintSyllabus(String(created.blueprintId), { note: 'smoke_confirm_blueprint_syllabus' }, {
    id: 7,
    email: 'ai-questioning-blueprint-admin@example.test'
  });
  assert(confirmedBlueprint.constraints?.syllabusGovernance?.status === 'synced', 'Blueprint syllabus confirmation should mark the blueprint as synced.');
  assert(confirmedBlueprint.constraints?.syllabusGovernance?.note === 'smoke_confirm_blueprint_syllabus', 'Blueprint syllabus confirmation should persist the operator note.');
  assert(confirmedBlueprint.constraints?.syllabusScope?.excludedScope?.includes('unrelated calculus'), 'Blueprint syllabus confirmation should preserve current topic excluded scope.');
  const blueprintConfirmAuditRows = await prisma.adminAuditLog.findMany({
    where: {
      module: 'ai-questioning',
      resourceType: 'blueprint',
      resourceId: String(created.blueprintId),
      action: 'confirm_syllabus'
    },
    orderBy: { id: 'desc' },
    take: 1
  });
  assert(blueprintConfirmAuditRows.length === 1, 'Blueprint syllabus confirmation should write an admin audit log.');
  created.adminAuditLogIds.push(blueprintConfirmAuditRows[0].id);
  assert(blueprintConfirmAuditRows[0].actorId === 7, 'Blueprint syllabus confirmation audit should record the actor id.');
  await prisma.$executeRaw`
    UPDATE "csca_source_questions"
    SET "syllabus_version" = '2026-json-import',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${created.sourceQuestionId}
  `;
  const postImportSeriesProfile = await service.generateExamSeriesProfile({
    subject: smokeSubject,
    syllabusVersion: '2026-json-import',
    title: `AI questioning smoke post-import trend ${testCode}`
  });
  created.additionalSeriesProfileIds.push(postImportSeriesProfile.profile.id);
  const postImportGenerationProfile = await service.generateGenerationProfile({
    subject: smokeSubject,
    syllabusVersion: '2026-json-import',
    useCase: 'subject_practice',
    seriesProfileId: postImportSeriesProfile.profile.id
  });
  created.additionalGenerationProfileIds.push(postImportGenerationProfile.profile.id);
  const postImportGenerated = await service.generateCandidate(created.blueprintId, { force: true });
  created.questionIds.push(postImportGenerated.question.id);
  assert(postImportGenerated.generation.syllabusScope.excludedScope.includes('unrelated calculus'), 'Post-import generation should carry topic excluded scope into AI syllabus context.');
  const [jsonNewTopic] = await prisma.$queryRaw`
    SELECT "id", "syllabus_version" AS "syllabusVersion", "status"
    FROM "csca_exam_topics"
    WHERE "code" = ${importNewTopicCode}
    LIMIT 1
  `;
  assert(jsonNewTopic?.id, 'Syllabus JSON import apply should create new topics.');
  assert(jsonNewTopic.syllabusVersion === '2026-json-import', 'New JSON-imported topics should carry the uploaded version.');
  const [jsonMigratedTopic] = await prisma.$queryRaw`
    SELECT "id", "title", "syllabus_version" AS "syllabusVersion"
    FROM "csca_exam_topics"
    WHERE "code" = ${migratedImportTopicCode}
    LIMIT 1
  `;
  const [jsonLegacyTopicAfterMigration] = await prisma.$queryRaw`
    SELECT "id"
    FROM "csca_exam_topics"
    WHERE "code" = ${legacyImportTopicCode}
    LIMIT 1
  `;
  assert(jsonMigratedTopic?.id === legacyImportTopic.id, 'Syllabus JSON import apply should migrate the legacy topic code instead of creating a disconnected topic.');
  assert(jsonMigratedTopic.title === 'AI Questioning JSON Import Migrated Topic', 'Migrated JSON-imported topics should receive uploaded fields.');
  assert(!jsonLegacyTopicAfterMigration, 'Syllabus JSON import apply should remove the old code after migration.');
  const [jsonStaleQuestion] = await prisma.$queryRaw`
    SELECT "status", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${replacementId}
    LIMIT 1
  `;
  assert(jsonStaleQuestion.status === 'pending_review', 'Syllabus JSON import apply should pull stale approved unified questions back to review.');
  assert(jsonStaleQuestion.reviewMetadata?.syllabusGovernance?.importId === createdImport.import.id, 'Syllabus JSON import apply should record import governance metadata on stale questions.');

  const syllabusPreview = await service.previewSyllabusTopicUpdate(created.examTopicId, {
    syllabusVersion: '2027-smoke',
    sourceUrl: 'https://example.test/csca-syllabus-smoke',
    sourceLabel: 'Smoke syllabus source',
    lastVerifiedAt: '2026-06-11T00:00:00.000Z'
  });
  assert(syllabusPreview.impact.staleAfterUpdateCount >= 1, 'Syllabus update preview should show generated questions that will become stale.');
  assert(syllabusPreview.sample.some((item) => item.id === replacementId), 'Syllabus update preview should sample impacted generated questions.');
  const appliedSyllabus = await service.applySyllabusTopicUpdate(created.examTopicId, {
    syllabusVersion: '2027-smoke',
    sourceUrl: 'https://example.test/csca-syllabus-smoke',
    sourceLabel: 'Smoke syllabus source',
    lastVerifiedAt: '2026-06-11T00:00:00.000Z'
  }, 1);
  assert(appliedSyllabus.topic.syllabusVersion === '2027-smoke', 'Syllabus update apply should update the topic version.');
  assert(appliedSyllabus.topic.sourceLabel === 'Smoke syllabus source', 'Syllabus update apply should persist source metadata.');
  const [verifiedTopic] = await prisma.$queryRaw`
    SELECT "verified_by" AS "verifiedBy", "last_verified_at" AS "lastVerifiedAt"
    FROM "csca_exam_topics"
    WHERE "id" = ${created.examTopicId}
    LIMIT 1
  `;
  assert(verifiedTopic.verifiedBy === 1, 'Syllabus update apply should record the verifying admin.');
  assert(verifiedTopic.lastVerifiedAt instanceof Date, 'Syllabus update apply should record verification time.');
  const bulkSyllabusPreview = await service.previewSyllabusBulkUpdate({
    topicIds: [created.examTopicId],
    syllabusVersion: '2028-smoke',
    sourceUrl: 'https://example.test/csca-syllabus-smoke-2028',
    sourceLabel: 'Smoke syllabus source 2028',
    lastVerifiedAt: '2026-06-12T00:00:00.000Z'
  });
  assert(bulkSyllabusPreview.summary.topics === 1, 'Bulk syllabus preview should summarize selected topics.');
  assert(bulkSyllabusPreview.summary.staleAfterUpdateCount >= 1, 'Bulk syllabus preview should summarize impacted stale questions.');
  assert(bulkSyllabusPreview.items[0]?.sample.some((item) => item.id === replacementId), 'Bulk syllabus preview should include impacted generated question samples.');
  const bulkSyllabusApply = await service.applySyllabusBulkUpdate({
    topics: [{
      topicId: created.examTopicId,
      syllabusVersion: '2028-smoke',
      sourceUrl: 'https://example.test/csca-syllabus-smoke-2028',
      sourceLabel: 'Smoke syllabus source 2028',
      lastVerifiedAt: '2026-06-12T00:00:00.000Z'
    }]
  }, 2);
  assert(bulkSyllabusApply.summary.topics === 1, 'Bulk syllabus apply should summarize selected topics.');
  assert(bulkSyllabusApply.items[0]?.topic.syllabusVersion === '2028-smoke', 'Bulk syllabus apply should update the topic version.');
  const [bulkVerifiedTopic] = await prisma.$queryRaw`
    SELECT "verified_by" AS "verifiedBy", "source_label" AS "sourceLabel"
    FROM "csca_exam_topics"
    WHERE "id" = ${created.examTopicId}
    LIMIT 1
  `;
  assert(bulkVerifiedTopic.verifiedBy === 2, 'Bulk syllabus apply should record the verifying admin.');
  assert(bulkVerifiedTopic.sourceLabel === 'Smoke syllabus source 2028', 'Bulk syllabus apply should persist source metadata.');
  const staleSummary = await service.syllabusGovernanceSummary({ subject: smokeSubject });
  assert(staleSummary.items.some((item) => item.questionId === replacementId && item.reason === 'syllabus_version_mismatch'), 'Syllabus governance should detect stale generated questions.');
  assert(!staleSummary.items.some((item) => item.questionId === generatedQuestion.id && item.reason === 'pending_review'), 'Syllabus governance should not include ordinary pending candidates.');
  const staleSelection = await adaptiveQuestionProvider.pickQuestions(910999, [{
    topicId: created.examTopicId,
    code: testCode,
    title: 'AI Questioning Smoke Topic',
    module: 'Smoke',
    targetDifficulty: '基础',
    reason: 'smoke'
  }], 1);
  assert(!staleSelection.some((item) => item.questionId === approvedReplacement.sourceQuestionId), 'Adaptive provider must not select stale AI-backed questions.');
  const governanceRefresh = await service.refreshSyllabusGovernance({ subject: smokeSubject });
  assert(governanceRefresh.refreshed >= 1, 'Syllabus governance refresh should flag stale questions for review.');
  const refreshedQuestion = await service.listQuestions({ subject: smokeSubject, syllabusStatus: 'stale' });
  assert(refreshedQuestion.items.some((item) => item.id === replacementId && item.status === 'pending_review'), 'Stale generated question should return to pending review.');
  const fixedSyllabusQuestion = await service.updateQuestionDraft(replacementId, {
    prompt: 'After the syllabus update, choose the value of 1 + 1.',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
      { id: 'C', text: '3' },
      { id: 'D', text: '4' }
    ],
    correctAnswer: 'B',
    explanation: '1 + 1 = 2, so the correct answer is B.',
    knowledgeTags: ['syllabus-review-smoke'],
    optionMetadata: [
      { optionId: 'A', distractorIntent: 'off_by_one_low', misconceptionTags: ['arithmetic-slip'] },
      { optionId: 'C', distractorIntent: 'off_by_one_high', misconceptionTags: ['arithmetic-slip'] },
      { optionId: 'D', distractorIntent: 'over_counting', misconceptionTags: ['arithmetic-slip'] }
    ],
    note: 'smoke_syllabus_review_manual_fix'
  });
  assert(fixedSyllabusQuestion.reviewMetadata?.syllabusGovernance?.status === 'needs_review', 'Manual fixing a syllabus-reviewed question should preserve syllabus governance metadata.');
  const syllabusReviewedQuestion = await service.confirmSyllabusQuestionReview(replacementId, { note: 'smoke_confirm_current_syllabus' }, 4);
  assert(syllabusReviewedQuestion.syllabusVersion === '2028-smoke', 'Confirming a syllabus-reviewed question should sync it to the current topic syllabus version.');
  assert(syllabusReviewedQuestion.reviewMetadata?.syllabusGovernance?.status === 'resolved', 'Confirming a syllabus-reviewed question should resolve syllabus governance metadata.');
  assert(syllabusReviewedQuestion.reviewMetadata?.syllabusGovernance?.resolvedBy === 'syllabus_confirmation', 'Syllabus confirmation should record the resolution source.');
  const syllabusSummaryAfterApproval = await service.syllabusGovernanceSummary({ subject: smokeSubject });
  assert(!syllabusSummaryAfterApproval.items.some((item) => item.questionId === replacementId), 'Confirmed syllabus-reviewed questions should leave the syllabus governance queue.');

  console.log('CSCA AI questioning smoke passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
