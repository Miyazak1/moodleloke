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
const { CscaMockExamService } = require('../backend/src/csca-mock-exam/csca-mock-exam.service');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const stamp = `mock-ai-live-${Date.now()}`;
const actorId = Number(process.env.CSCA_MOCK_EXAM_AI_LIVE_SMOKE_ACTOR_ID || 1);
const subject = process.env.CSCA_MOCK_EXAM_AI_LIVE_SMOKE_SUBJECT || 'math';
const created = {
  syllabusImportId: null,
  topicId: null,
  sourceProfileId: null,
  sourcePaperId: null,
  sourceQuestionId: null,
  mockBlueprintId: null,
  mockSlotId: null,
  mockJobId: null,
  mockJobIds: [],
  aiBlueprintIds: [],
  aiJobIds: [],
  candidateId: null,
  liveCandidateId: null,
  candidateIds: [],
  draftPaperId: null,
  targetPaperIds: [],
  auditIds: []
};
const keepArtifacts = process.env.CSCA_MOCK_EXAM_AI_LIVE_SMOKE_KEEP_ARTIFACTS === '1';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertWithContext(condition, message, context) {
  if (condition) return;
  const suffix = context === undefined ? '' : ` ${JSON.stringify(context, null, 2)}`;
  throw new Error(`${message}${suffix}`);
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for live online mock AI generation smoke.`);
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

function assertLiveProviderConfig() {
  requireEnv('DATABASE_URL');
  const config = providerConfig();
  assert(config.enabled === 'true' || config.enabled === '1', 'CSCA_AI_QUESTION_GENERATION_ENABLED must be true/1.');
  assert(config.provider && config.provider !== 'rule-fallback', 'Question generation provider must not be rule-fallback.');
  assert(config.model, 'Question generation model is required.');
  assert(config.hasApiKey, 'Question generation API key is required.');
  return config;
}

function options() {
  return [
    { id: 'A', text: '2' },
    { id: 'B', text: '4' },
    { id: 'C', text: '6' },
    { id: 'D', text: '8' }
  ];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectGenerationArtifactsFromJob() {
  const mockJobIds = Array.from(new Set([created.mockJobId, ...created.mockJobIds].filter(Boolean).map(Number)));
  if (!mockJobIds.length) return;
  const rows = await prisma.$queryRaw`
    SELECT "id", "slot_results" AS "slotResults", "target_paper_id" AS "targetPaperId"
    FROM "mock_exam_generation_jobs"
    WHERE "id" IN (${Prisma.join(mockJobIds)})
  `.catch(() => []);
  for (const row of rows) {
    const targetPaperId = Number(row?.targetPaperId);
    if (Number.isInteger(targetPaperId) && targetPaperId > 0 && !created.targetPaperIds.includes(targetPaperId)) {
      created.targetPaperIds.push(targetPaperId);
      created.draftPaperId = targetPaperId;
    }
  }
  const slotResults = rows.flatMap((row) => Array.isArray(row?.slotResults) ? row.slotResults : []);
  for (const result of slotResults) {
    const aiBlueprintId = Number(result?.aiBlueprintId);
    const aiGenerationJobId = Number(result?.aiGenerationJobId);
    const candidateQuestionId = Number(result?.candidateQuestionId);
    if (Number.isInteger(aiBlueprintId) && aiBlueprintId > 0 && !created.aiBlueprintIds.includes(aiBlueprintId)) {
      created.aiBlueprintIds.push(aiBlueprintId);
    }
    if (Number.isInteger(aiGenerationJobId) && aiGenerationJobId > 0 && !created.aiJobIds.includes(aiGenerationJobId)) {
      created.aiJobIds.push(aiGenerationJobId);
    }
    if (Number.isInteger(candidateQuestionId) && candidateQuestionId > 0) {
      created.candidateId = candidateQuestionId;
      if (!created.candidateIds.includes(candidateQuestionId)) created.candidateIds.push(candidateQuestionId);
    }
  }
}

async function aiJobDiagnostics() {
  await collectGenerationArtifactsFromJob();
  if (!created.aiJobIds.length) return [];
  return prisma.$queryRaw`
    SELECT "id", "blueprint_id" AS "blueprintId", "status", "provider", "model", "error",
           "question_id" AS "questionId", "updated_at" AS "updatedAt"
    FROM "csca_ai_generation_jobs"
    WHERE "id" IN (${Prisma.join(created.aiJobIds)})
    ORDER BY "id" ASC
  `.catch(() => []);
}

async function waitForMockGenerationJob(mockExamService, jobId, expectedStatus, timeoutMs = 120000) {
  const startedAt = Date.now();
  let lastJob = null;
  while (Date.now() - startedAt < timeoutMs) {
    const detail = await mockExamService.getAdminBlueprint(String(created.mockBlueprintId));
    lastJob = detail.generationJobs.find((job) => job.id === jobId) ?? null;
    await collectGenerationArtifactsFromJob();
    if (lastJob && expectedStatus.includes(lastJob.status)) return lastJob;
    if (lastJob?.status === 'failed' && !expectedStatus.includes('failed')) break;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for mock generation job ${jobId}; last=${JSON.stringify(lastJob)}`);
}

async function cleanup() {
  if (keepArtifacts) {
    console.error(JSON.stringify({
      status: 'kept_live_smoke_artifacts',
      created
    }, null, 2));
    return;
  }
  await collectGenerationArtifactsFromJob();
  if (created.auditIds.length) {
    await prisma.adminAuditLog.deleteMany({ where: { id: { in: created.auditIds } } }).catch(() => undefined);
  }
  const targetPaperIds = Array.from(new Set([created.draftPaperId, ...created.targetPaperIds].filter(Boolean).map(Number)));
  if (targetPaperIds.length) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: { in: targetPaperIds } } }).catch(() => undefined);
    await prisma.mockExamPaper.deleteMany({ where: { id: { in: targetPaperIds } } }).catch(() => undefined);
  }
  const mockJobIds = Array.from(new Set([created.mockJobId, ...created.mockJobIds].filter(Boolean).map(Number)));
  if (mockJobIds.length) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_generation_jobs" WHERE "id" IN (${Prisma.join(mockJobIds)})`.catch(() => undefined);
  }
  if (created.mockBlueprintId) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_blueprints" WHERE "id" = ${created.mockBlueprintId}`.catch(() => undefined);
  }
  for (const aiJobId of created.aiJobIds) {
    await prisma.$executeRaw`DELETE FROM "csca_ai_generation_jobs" WHERE "id" = ${aiJobId}`.catch(() => undefined);
  }
  const candidateIds = Array.from(new Set([created.candidateId, ...created.candidateIds].filter(Boolean).map(Number)));
  if (candidateIds.length) {
    await prisma.$executeRaw`DELETE FROM "csca_questions" WHERE "id" IN (${Prisma.join(candidateIds)})`.catch(() => undefined);
  }
  for (const aiBlueprintId of created.aiBlueprintIds) {
    await prisma.$executeRaw`DELETE FROM "csca_question_blueprints" WHERE "id" = ${aiBlueprintId}`.catch(() => undefined);
  }
  if (created.sourceQuestionId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'mock_exam_question' AND "source_id" = ${created.sourceQuestionId}
    `.catch(() => undefined);
  }
  if (created.sourceProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_style_profiles"
      WHERE "id" = ${created.sourceProfileId}
    `.catch(() => undefined);
  }
  if (created.sourcePaperId) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: created.sourcePaperId } }).catch(() => undefined);
    await prisma.mockExamPaper.delete({ where: { id: created.sourcePaperId } }).catch(() => undefined);
  }
  if (created.topicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.topicId}`.catch(() => undefined);
  }
  if (created.syllabusImportId) {
    await prisma.$executeRaw`DELETE FROM "csca_syllabus_imports" WHERE "id" = ${created.syllabusImportId}`.catch(() => undefined);
  }
}

function makeAIQuestioningService() {
  const gateway = createStandaloneAiGatewayService();
  const reviewer = new QuestionReviewerService(new QuestionValidatorService(), new QuestionReviewerProviderService(gateway));
  return new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    new QuestionGeneratorProviderService(new QuestionPromptBuilderService(), gateway),
    reviewer,
    new QuestionTopicMapperProviderService(gateway),
    new QuestionQualityService(prisma)
  );
}

async function main() {
  const config = assertLiveProviderConfig();
  try {
    const [existingSyllabusImport] = await prisma.$queryRaw`
      SELECT "id", "syllabus_version" AS "syllabusVersion"
      FROM "csca_syllabus_imports"
      WHERE "subject" = ${subject} AND "status" = 'applied'
      ORDER BY "applied_at" DESC NULLS LAST, "updated_at" DESC, "id" DESC
      LIMIT 1
    `;
    let syllabusVersion = existingSyllabusImport?.syllabusVersion || '2026-live-check';
    const [topic] = await prisma.$queryRaw`
      INSERT INTO "csca_exam_topics" (
        "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "difficulty_range", "status"
      )
      VALUES (
        ${subject}, 'Live Mock Check', ${stamp}, 'Live Online Mock AI Verification Topic',
        'Temporary algebra topic for live online mock AI generation verification.',
        'Compound algebraic conditions, interval constraints, and parameter-style calculation suitable for a medium online mock verification item.',
        ${syllabusVersion}, 1, ${JSON.stringify(['basic', 'medium', 'hard'])}::jsonb, 'published'
      )
      RETURNING "id"
    `;
    created.topicId = topic.id;
    if (!existingSyllabusImport) {
      const [syllabusImport] = await prisma.$queryRaw`
        INSERT INTO "csca_syllabus_imports" (
          "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary", "applied_at", "created_by"
        )
        VALUES (
          ${subject}, ${syllabusVersion}, 'Live online mock AI verification syllabus', 'applied',
          ${JSON.stringify({ subject, syllabusVersion })}::jsonb,
          ${JSON.stringify({ topicCount: 1, source: 'csca-mock-exam-ai-generation-live-check' })}::jsonb,
          NOW(), ${actorId}
        )
        RETURNING "id", "syllabus_version" AS "syllabusVersion"
      `;
      created.syllabusImportId = syllabusImport.id;
      syllabusVersion = syllabusImport.syllabusVersion;
    }

    const paper = await prisma.mockExamPaper.create({
      data: {
        subject,
        slug: `${stamp}-source`,
        title: `Live Mock AI Verification Source ${stamp}`,
        description: 'Temporary source paper for live online mock AI verification.',
        language: 'zh',
        questionCount: 1,
        durationMinutes: 10,
        priceLabel: null,
        isFree: true,
        isLocked: true,
        sortOrder: 9999,
        status: 'draft',
        questions: {
          create: {
            orderNumber: 1,
            questionType: 'single-choice',
            prompt: '已知实数 x 同时满足 x+2>0 与 3x-1≤8，求 x 的取值范围。',
            options: [
              { id: 'A', text: '(-2,3]' },
              { id: 'B', text: '[-2,3)' },
              { id: 'C', text: '(-∞,3]' },
              { id: 'D', text: '(-2,+∞)' }
            ],
            correctAnswer: 'A',
            explanation: '由 x+2>0 得 x>-2，由 3x-1≤8 得 x≤3，所以取交集为 (-2,3]。',
            knowledgeTags: ['inequality', 'interval', 'compound-condition'],
            status: 'published'
          }
        }
      },
      include: { questions: true }
    });
    created.sourcePaperId = paper.id;
    created.sourceQuestionId = paper.questions[0].id;

    await prisma.cscaTopicMapping.create({
      data: {
        sourceType: 'mock_exam_question',
        sourceId: created.sourceQuestionId,
        topicId: created.topicId,
        confidence: 0.98
      }
    });

    const [sourceProfile] = await prisma.$queryRaw`
      INSERT INTO "csca_question_style_profiles" (
        "subject", "syllabus_version", "scope_type", "source_question_ids", "sample_size",
        "confidence", "profile", "profile_version", "source_question_snapshot_hash", "status",
        "generated_by", "updated_at"
      )
      VALUES (
        ${subject}, ${syllabusVersion}, 'subject', ${JSON.stringify([created.sourceQuestionId])}::jsonb, 1,
        'high', ${JSON.stringify({
          promptStyle: 'short CSCA-style word problem source profile for live mock AI verification',
          answerDistribution: { C: 1 },
          difficultyMix: { basic: 1 }
        })}::jsonb,
        1, ${`${stamp}-source-profile`}, 'active', 'live-smoke', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    created.sourceProfileId = sourceProfile.id;

    const realAIQuestioning = makeAIQuestioningService();
    const mockExamService = new CscaMockExamService(prisma, {}, {}, {}, realAIQuestioning);

    const blueprintResult = await mockExamService.createAdminBlueprintFromPaper(String(created.sourcePaperId), {
      title: `Live Mock AI Blueprint ${stamp}`,
      syllabusVersion,
      force: true
    }, actorId);
    created.mockBlueprintId = blueprintResult.blueprint.id;
    assert(blueprintResult.created === true, 'Blueprint should be created from the source paper.');
    assert(blueprintResult.slots.length === 1, 'Blueprint should contain one slot.');
    created.mockSlotId = blueprintResult.slots[0].id;

    await mockExamService.updateAdminBlueprintSlot(String(created.mockSlotId), {
      status: 'ready',
      topicIds: [created.topicId],
      difficultyBand: 'medium',
      cognitiveSkill: 'standard_application',
      readingLoad: 'medium',
      calculationLoad: 'medium',
      estimatedTimeSeconds: 45,
      generationPromptHints: [
        'Generate one original CSCA-style single-choice algebra item.',
        'Use compound conditions, interval endpoints, or a simple parameter constraint; do not copy the source wording.',
        'Avoid trivial one-step arithmetic. The answer should require combining at least two conditions.'
      ],
      reviewerChecklist: [
        'The item must be original and not a direct rewrite of the source question.',
        'The answer must be unique.',
        'The explanation must combine at least two conditions before selecting the correct option.'
      ]
    }, actorId);

    const active = await mockExamService.updateAdminBlueprint(String(created.mockBlueprintId), {
      status: 'active',
      expectedVersion: blueprintResult.blueprint.version
    }, actorId);
    assert(active.blueprint.status === 'active', 'Blueprint should become active after ready slot confirmation.');

    const liveAiBlueprint = await realAIQuestioning.createBlueprint({
      subject,
      topicId: created.topicId,
      difficulty: 'medium',
      questionType: 'single_choice',
      skill: 'standard_application',
      source: 'mock_exam_blueprint_slot',
      constraints: {
        mockExamSlot: {
          blueprintId: created.mockBlueprintId,
          blueprintTitle: active.blueprint.title,
          slotId: created.mockSlotId,
          slotNumber: 1,
          sourcePaperId: created.sourcePaperId,
          questionCount: 1,
          durationMinutes: 10,
          totalScore: 100
        },
        generationMode: 'online_mock_exam_candidate',
        generationSource: 'mock_exam_blueprint_slot',
        targetUseCase: 'online_mock_exam',
        generationPromptHints: [
          'Generate one original CSCA-style single-choice algebra item.',
          'Use compound conditions, interval endpoints, or a simple parameter constraint; do not copy the source wording.'
        ],
        reviewerChecklist: [
          'The item must be original and not a direct rewrite of the source question.',
          'The answer must be unique.',
          'The explanation must justify the correct answer.'
        ],
        targetProfile: {
          slotNumber: 1,
          questionForm: 'calculation_application',
          cognitiveSkill: 'standard_application',
          difficultyBand: 'medium',
          readingLoad: 'medium',
          calculationLoad: 'medium',
          targetAnswer: 'A',
          estimatedTimeSeconds: 45
        },
        syllabusScope: {
          subject,
          topicId: created.topicId,
          topicTitle: 'Live Online Mock AI Verification Topic',
          syllabusVersion,
          examScope: 'Compound algebraic conditions, interval constraints, and parameter-style calculation suitable for a medium online mock verification item.'
        },
        governance: {
          publishPolicy: 'candidate_review_required',
          formalMockPaperMutation: 'forbidden_until_reviewed',
          createdFrom: 'mock_exam_generation_live_smoke'
        }
      }
    });
    created.aiBlueprintIds.push(Number(liveAiBlueprint.id));
    const enqueuedLive = await realAIQuestioning.enqueueGenerationJobs({
      blueprintIds: [Number(liveAiBlueprint.id)],
      limit: 1,
      force: true
    });
    const liveAiJobId = enqueuedLive.items[0]?.id;
    assert(liveAiJobId, 'Live mock AI smoke should enqueue an online mock generation job.');
    created.aiJobIds.push(Number(liveAiJobId));
    const liveAiJob = await realAIQuestioning.retryGenerationJob(Number(liveAiJobId));
    assert(liveAiJob.provider && liveAiJob.provider !== 'rule-fallback' && liveAiJob.provider !== 'cache' && liveAiJob.provider !== 'smoke-stub', `Expected live provider, got ${liveAiJob.provider}.`);
    assert(liveAiJob.model && liveAiJob.model !== 'local-question-generator-v1' && liveAiJob.model !== 'mock-exam-ai-generation-smoke', `Expected live model, got ${liveAiJob.model}.`);
    assert(liveAiJob.questionId, `Live online mock AI job should create a candidate question. status=${liveAiJob.status} error=${liveAiJob.error || ''}`);
    created.candidateId = Number(liveAiJob.questionId);
    created.liveCandidateId = Number(liveAiJob.questionId);
    created.candidateIds.push(Number(liveAiJob.questionId));

    const [candidate] = await prisma.$queryRaw`
      SELECT "id", "prompt", "status", "source_question_id" AS "sourceQuestionId",
             "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
      FROM "csca_questions"
      WHERE "id" = ${created.candidateId}
      LIMIT 1
    `;
    assert(candidate, `Generated candidate ${created.candidateId} was not found.`);
    assert(candidate.sourceQuestionId == null, 'Live mock candidate must not be linked to a special-practice question before approval.');
    assert(candidate.generationMetadata?.generationMode === 'online_mock_exam_candidate', 'Candidate must be marked online_mock_exam_candidate.');
    assert(candidate.generationMetadata?.sourceKind === 'mock_exam_blueprint_slot' || candidate.generationMetadata?.generationSource === 'mock_exam_blueprint_slot', 'Candidate must preserve mock_exam_blueprint_slot source metadata.');
    assert(candidate.generationMetadata?.fallbackUsed === false, 'Live mock candidate unexpectedly used fallback.');
    assert(candidate.sourceQuestionId == null, 'Live mock candidate approval must not link a special-practice question.');

    const specialPracticeRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "special_practice_questions"
      WHERE "prompt" = ${candidate.prompt}
    `;
    assert(specialPracticeRows.length === 0, 'Live mock candidate generation/review must not create a special-practice question.');

    const controlledCandidate = await prisma.cscaQuestion.create({
      data: {
        subject,
        topicId: created.topicId,
        blueprintId: Number(liveAiBlueprint.id),
        sourceType: 'ai',
        sourceQuestionId: null,
        designedDifficulty: 'medium',
        questionType: 'single_choice',
        prompt: `已知 ${stamp} 验证题：x 同时满足 x+2>0 与 3x-1<=8，求 x 的取值范围。`,
        options: [
          { id: 'A', text: '(-2,3]' },
          { id: 'B', text: '[-2,3)' },
          { id: 'C', text: '(-∞,3]' },
          { id: 'D', text: '(-2,+∞)' }
        ],
        correctAnswer: 'A',
        explanation: '由 x+2>0 得 x>-2，由 3x-1<=8 得 x<=3，所以交集为 (-2,3]，选 A。',
        knowledgeTags: ['inequality', 'interval', 'compound-condition'],
        optionMetadata: [
          { optionId: 'B', distractorIntent: '端点开闭混淆', misconceptionTags: ['endpoint_error'] },
          { optionId: 'C', distractorIntent: '漏掉左侧条件', misconceptionTags: ['condition_omission'] },
          { optionId: 'D', distractorIntent: '漏掉右侧条件', misconceptionTags: ['condition_omission'] }
        ],
        syllabusVersion,
        generationMetadata: {
          generationMode: 'online_mock_exam_candidate',
          generationSource: 'mock_exam_blueprint_slot',
          sourceKind: 'mock_exam_blueprint_slot',
          targetUseCase: 'online_mock_exam',
          fallbackUsed: false,
          mockExamSlot: {
            blueprintId: created.mockBlueprintId,
            blueprintTitle: active.blueprint.title,
            slotId: created.mockSlotId,
            slotNumber: 1,
            sourcePaperId: created.sourcePaperId
          },
          versionGovernance: {
            status: 'current',
            targetUseCase: 'online_mock_exam',
            approval: {
              status: 'approved_for_mock_exam_assembly',
              source: 'live_smoke_controlled_candidate'
            }
          },
          localizations: {
            zh: {
              prompt: `已知 ${stamp} 验证题：x 同时满足 x+2>0 与 3x-1<=8，求 x 的取值范围。`,
              options: [
                { id: 'A', text: '(-2,3]' },
                { id: 'B', text: '[-2,3)' },
                { id: 'C', text: '(-∞,3]' },
                { id: 'D', text: '(-2,+∞)' }
              ],
              explanation: '由两个不等式取交集，答案为 A。',
              knowledgeTags: ['inequality', 'interval']
            },
            en: {
              prompt: `For ${stamp}, x satisfies x+2>0 and 3x-1<=8. Find the range of x.`,
              options: [
                { id: 'A', text: '(-2,3]' },
                { id: 'B', text: '[-2,3)' },
                { id: 'C', text: '(-infinity,3]' },
                { id: 'D', text: '(-2,+infinity)' }
              ],
              explanation: 'Intersect x>-2 and x<=3, so the answer is A.',
              knowledgeTags: ['inequality', 'interval']
            }
          }
        },
        reviewMetadata: {
          approvalGate: { status: 'passed', source: 'live_smoke_controlled_candidate' },
          mockExamApproval: {
            status: 'approved_for_mock_exam_assembly',
            targetUseCase: 'online_mock_exam',
            targetQuestionBank: 'mock_exam_questions',
            disposition: 'candidate_pool',
            blueprintId: created.mockBlueprintId,
            slotId: created.mockSlotId,
            slotNumber: 1,
            practicePublishSkipped: true
          }
        },
        status: 'approved'
      }
    });
    created.candidateIds.push(controlledCandidate.id);

    const controlledSlotResult = {
      slotId: created.mockSlotId,
      slotNumber: 1,
      aiBlueprintId: Number(liveAiBlueprint.id),
      aiGenerationJobId: Number(liveAiJobId),
      candidateQuestionId: controlledCandidate.id,
      status: 'approved',
      issues: [],
      topicIds: [created.topicId],
      targetProfile: {
        slotNumber: 1,
        questionForm: 'calculation_application',
        cognitiveSkill: 'standard_application',
        difficultyBand: 'medium',
        readingLoad: 'medium',
        calculationLoad: 'medium'
      },
      candidateAttemptCount: 1,
      providerWaitCount: 0
    };
    const [controlledJob] = await prisma.$queryRaw`
      INSERT INTO "mock_exam_generation_jobs" (
        "blueprint_id", "target_paper_id", "status", "provider", "model",
        "requested_slot_numbers", "slot_results", "created_by", "started_at", "updated_at"
      )
      VALUES (
        ${created.mockBlueprintId}, NULL, 'queued', ${liveAiJob.provider}, ${liveAiJob.model},
        ${JSON.stringify([1])}::jsonb, ${JSON.stringify([controlledSlotResult])}::jsonb,
        ${actorId}, NOW(), NOW()
      )
      RETURNING "id"
    `;
    created.mockJobId = controlledJob.id;
    created.mockJobIds.push(controlledJob.id);

    const processed = await mockExamService.processAdminGenerationJob(String(controlledJob.id), { force: true }, actorId);
    await collectGenerationArtifactsFromJob();

    assert(processed.targetPaperId, 'Completed live mock generation job must auto assemble and publish a target paper.');
    created.draftPaperId = Number(processed.targetPaperId);
    created.targetPaperIds.push(Number(processed.targetPaperId));
    const publishedPaper = await prisma.mockExamPaper.findUnique({
      where: { id: created.draftPaperId }
    });
    assert(publishedPaper, 'Auto-published live mock paper must exist.');
    assert(publishedPaper.status === 'published', `Auto-assembled live mock paper must be published, got ${publishedPaper.status}.`);

    const draftQuestions = await prisma.mockExamQuestion.findMany({
      where: { paperId: created.draftPaperId },
      orderBy: { orderNumber: 'asc' }
    });
    assert(draftQuestions.length === 1, 'Auto-published live mock paper should contain one question.');
    assert(draftQuestions[0].prompt === controlledCandidate.prompt, 'Published question should come from the approved controlled mock candidate.');

    const auditRows = await prisma.adminAuditLog.findMany({
      where: {
        module: 'mock-exam',
        resourceId: { in: [String(created.mockBlueprintId), String(created.mockSlotId), String(created.mockJobId)] }
      },
      select: { id: true }
    });
    created.auditIds = auditRows.map((row) => row.id);
    assert(created.auditIds.length >= 4, 'Live mock exam smoke should write admin audit provenance.');

    console.log(JSON.stringify({
      status: 'passed',
      provider: processed.provider,
      model: processed.model,
      providerConfig: config,
      blueprintId: created.mockBlueprintId,
      generationJobId: created.mockJobId,
      aiBlueprintIds: created.aiBlueprintIds,
      aiJobIds: created.aiJobIds,
      liveCandidateId: created.liveCandidateId,
      controlledCandidateId: controlledCandidate.id,
      publishedPaperId: created.draftPaperId,
      auditEvents: created.auditIds.length,
      promptPreview: String(candidate.prompt || '').slice(0, 180)
    }, null, 2));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    status: 'failed',
    message: error instanceof Error ? error.message : String(error),
    providerConfig: providerConfig()
  }, null, 2));
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
