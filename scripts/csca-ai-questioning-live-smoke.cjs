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
const { createStandaloneAiGatewayService } = require('../backend/src/ai-gateway/ai-gateway.service');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { QuestionGeneratorProviderService } = require('../backend/src/ai-questioning/question-generator-provider.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionPromptBuilderService } = require('../backend/src/ai-questioning/question-prompt-builder.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerProviderService } = require('../backend/src/ai-questioning/question-reviewer-provider.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for live AI question generation smoke.`);
  return value;
}

function providerConfig() {
  const provider = process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER || process.env.CSCA_AI_PROVIDER || '';
  const model = process.env.CSCA_AI_QUESTION_GENERATION_MODEL || process.env.CSCA_AI_MODEL || '';
  const baseUrl = process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL || process.env.CSCA_AI_BASE_URL || '';
  return {
    enabled: process.env.CSCA_AI_QUESTION_GENERATION_ENABLED,
    provider,
    model,
    baseUrl: baseUrl ? new URL(baseUrl).origin : '',
    hasApiKey: Boolean(process.env.DEEPSEEK_BACKGROUND_API_KEYS || process.env.DEEPSEEK_API_KEYS || process.env.CSCA_AI_QUESTION_GENERATION_API_KEY || process.env.CSCA_AI_API_KEY)
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  requireEnv('DATABASE_URL');
  const config = providerConfig();
  assert(config.enabled === 'true' || config.enabled === '1', 'CSCA_AI_QUESTION_GENERATION_ENABLED must be true/1.');
  assert(config.provider && config.provider !== 'rule-fallback', 'Question generation provider must not be rule-fallback.');
  assert(config.model, 'Question generation model is required.');
  assert(config.hasApiKey, 'Question generation API key is required.');

  const promptBuilder = new QuestionPromptBuilderService();
  const generator = new QuestionGeneratorService();
  const gateway = createStandaloneAiGatewayService();
  const generatorProvider = new QuestionGeneratorProviderService(promptBuilder, gateway);
  const reviewerProvider = new QuestionReviewerProviderService(gateway);
  const reviewer = new QuestionReviewerService(new QuestionValidatorService(), reviewerProvider);
  const service = new AIQuestioningService(
    prisma,
    generator,
    generatorProvider,
    reviewer,
    new QuestionTopicMapperProviderService(gateway),
    new QuestionQualityService(prisma)
  );

  const subject = process.env.CSCA_AI_QUESTIONING_LIVE_SMOKE_SUBJECT || 'math';
  const blueprintId = process.env.CSCA_AI_QUESTIONING_LIVE_SMOKE_BLUEPRINT_ID
    ? Number(process.env.CSCA_AI_QUESTIONING_LIVE_SMOKE_BLUEPRINT_ID)
    : null;
  const rows = await prisma.$queryRaw`
    SELECT b."id", t."title" AS "topicTitle", t."exam_scope" AS "examScope"
    FROM "csca_question_blueprints" b
    JOIN "csca_exam_topics" t ON t."id" = b."topic_id"
    WHERE b."status" = 'active'
      AND t."status" = 'published'
      AND (${subject}::text IS NULL OR b."subject" = ${subject})
      AND (${blueprintId}::int IS NULL OR b."id" = ${blueprintId})
    ORDER BY CASE WHEN NULLIF(t."exam_scope", '') IS NULL THEN 1 ELSE 0 END,
             b."updated_at" DESC,
             b."id" ASC
    LIMIT 1
  `;
  const blueprint = rows[0];
  assert(blueprint, `No active published blueprint found for subject=${subject}. Import syllabus and confirm blueprints first.`);

  const queued = await service.enqueueGenerationJobs({
    blueprintIds: [blueprint.id],
    limit: 1,
    force: true
  });
  assert(queued.enqueued === 1 && queued.items[0]?.id, 'Failed to enqueue a live generation job.');

  const job = await service.retryGenerationJob(queued.items[0].id);
  assert(job.status === 'succeeded', `Live generation job failed: ${job.error || 'unknown error'}`);
  assert(job.provider && job.provider !== 'rule-fallback' && job.provider !== 'cache', `Expected live provider, got ${job.provider}.`);
  assert(job.model && job.model !== 'local-question-generator-v1', `Expected live model, got ${job.model}.`);
  assert(job.questionId, 'Live generation job did not create a candidate question.');

  const questionRows = await prisma.$queryRaw`
    SELECT "id", "prompt", "status", "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${job.questionId}
    LIMIT 1
  `;
  const question = questionRows[0];
  assert(question, `Generated question ${job.questionId} was not found in candidate ledger.`);
  const generation = question.generationMetadata || {};
  assert(generation.status === 'success', `Generated question was not marked success: ${generation.status}`);
  assert(generation.fallbackUsed === false, 'Generated question unexpectedly used fallback.');

  console.log(JSON.stringify({
    ok: true,
    provider: job.provider,
    model: job.model,
    blueprintId: blueprint.id,
    topicTitle: blueprint.topicTitle,
    jobId: job.id,
    questionId: job.questionId,
    questionStatus: question.status,
    reviewStatus: question.reviewMetadata?.status,
    promptPreview: String(question.prompt || '').slice(0, 160)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      providerConfig: providerConfig()
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
