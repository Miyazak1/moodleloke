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
const stamp = `mock-ai-smoke-${Date.now()}`;
const actorId = 1;
const created = {
  topicId: null,
  sourceProfileId: null,
  seriesProfileId: null,
  seriesProfileIds: [],
  generationProfileId: null,
  generationProfileIds: [],
  sourcePaperId: null,
  sourceQuestionId: null,
  mockBlueprintId: null,
  mockSlotId: null,
  mockJobId: null,
  mockJobIds: [],
  aiBlueprintId: null,
  aiJobId: null,
  candidateId: null,
  draftPaperId: null,
  draftQuestionIds: [],
  auditIds: []
};

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called in smoke fallback mode.');
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function options() {
  return [
    { id: 'A', text: '2' },
    { id: 'B', text: '4' },
    { id: 'C', text: '6' },
    { id: 'D', text: '8' }
  ];
}

function mockGenerationMetadata({ blueprintId, slotId }) {
  return {
    sourceKind: 'mock_exam_blueprint_slot',
    generationSource: 'mock_exam_blueprint_slot',
    generationMode: 'online_mock_exam_candidate',
    intendedUse: 'mock_candidate',
    targetUseCase: 'online_mock_exam',
    versionGovernance: {
      status: 'current',
      targetUseCase: 'online_mock_exam',
      reason: 'mock_exam_ai_generation_smoke_fixture',
      checkedAt: new Date().toISOString()
    },
    mockExamSlot: {
      blueprintId,
      slotId,
      slotNumber: 1
    },
    governance: {
      publishPolicy: 'candidate_review_required',
      formalMockPaperMutation: 'forbidden_until_reviewed',
      createdFrom: 'mock_exam_generation_job'
    },
    provider: {
      provider: 'smoke-stub',
      model: 'mock-exam-ai-generation-smoke'
    },
    localizations: {
      zh: {
        prompt: `Smoke mock candidate ${stamp}: 2 + 2 等于多少？`,
        options: options(),
        answer: 'B',
        explanation: '2 + 2 = 4。'
      },
      en: {
        prompt: `Smoke mock candidate ${stamp}: What is 2 + 2?`,
        options: options(),
        answer: 'B',
        explanation: '2 + 2 = 4.'
      }
    }
  };
}

function reviewMetadata() {
  return {
    status: 'passed',
    decision: 'publishable',
    score: 96,
    issues: [],
    dimensions: [
      { key: 'answer', status: 'passed', score: 100 },
      { key: 'style', status: 'passed', score: 92 }
    ],
    sources: ['smoke-stub'],
    rubric: {
      styleAlignment: 90,
      examLikeDifficulty: 90,
      pastPaperSimilarityRisk: 5
    },
    gate: {
      decision: 'publishable',
      publishable: true,
      reasons: [],
      score: 96
    },
    reviewer: {
      source: 'smoke-stub',
      status: 'passed'
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMockGenerationJob(mockExamService, jobId, expectedStatus, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastJob = null;
  while (Date.now() - startedAt < timeoutMs) {
    const detail = await mockExamService.getAdminBlueprint(String(created.mockBlueprintId));
    lastJob = detail.generationJobs.find((job) => job.id === jobId) ?? null;
    if (lastJob && expectedStatus.includes(lastJob.status)) return lastJob;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for mock generation job ${jobId}; last=${JSON.stringify(lastJob)}`);
}

async function createActiveMockGenerationProfile({ sourceSnapshotHash, syllabusSnapshotHash, profilePolicyVersion }) {
  const [seriesProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_series_profiles" (
      "subject", "syllabus_version", "title", "source_style_profile_ids",
      "source_question_ids", "session_summary", "trend_profile", "sample_size",
      "confidence", "status", "generated_by", "updated_at"
    )
    VALUES (
      'math', '2026-smoke', ${`Mock AI Smoke Trend ${stamp} ${profilePolicyVersion}`},
      ${JSON.stringify([created.sourceProfileId])}::jsonb,
      ${JSON.stringify([created.sourceQuestionId])}::jsonb,
      ${JSON.stringify({ source: 'mock-ai-smoke' })}::jsonb,
      ${JSON.stringify({
        sourceSnapshotHash,
        syllabusSnapshotHash,
        sourceProfileIds: [created.sourceProfileId],
        sourceQuestionIds: [created.sourceQuestionId],
        profileWindow: 'mock-ai-smoke'
      })}::jsonb,
      48, 'medium', 'active', 'smoke', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.seriesProfileIds.push(seriesProfile.id);

  const [generationProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_generation_profiles" (
      "subject", "syllabus_version", "use_case", "title", "series_profile_id",
      "source_style_profile_id", "profile", "target_policy", "sample_size",
      "confidence", "status", "generated_by", "updated_at"
    )
    VALUES (
      'math', '2026-smoke', 'online_mock_exam', ${`Mock AI Smoke Online Generation ${stamp} ${profilePolicyVersion}`},
      ${seriesProfile.id}, ${created.sourceProfileId},
      ${JSON.stringify({
        sourceSnapshotHash,
        syllabusSnapshotHash,
        sourceProfileIds: [created.sourceProfileId],
        sourceQuestionIds: [created.sourceQuestionId],
        profileWindow: 'mock-ai-smoke',
        profilePolicyVersion,
        assembly: { targetUseCase: 'online_mock_exam' }
      })}::jsonb,
      ${JSON.stringify({
        sourceSnapshotHash,
        syllabusSnapshotHash,
        sourceProfileIds: [created.sourceProfileId],
        profileWindow: 'mock-ai-smoke',
        targetUseCase: 'online_mock_exam'
      })}::jsonb,
      48, 'medium', 'active', 'smoke', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.generationProfileIds.push(generationProfile.id);
  created.seriesProfileId = seriesProfile.id;
  created.generationProfileId = generationProfile.id;
  return {
    seriesProfileId: seriesProfile.id,
    generationProfileId: generationProfile.id,
    sourceStyleProfileId: created.sourceProfileId,
    sourceSnapshotHash,
    syllabusSnapshotHash,
    profilePolicyVersion
  };
}

async function cleanup() {
  if (created.auditIds.length) {
    await prisma.adminAuditLog.deleteMany({ where: { id: { in: created.auditIds } } }).catch(() => undefined);
  }
  const mockJobIds = [...new Set([created.mockJobId, ...created.mockJobIds].filter(Boolean).map(Number))];
  const targetPaperRows = mockJobIds.length
    ? await prisma.$queryRaw`
      SELECT "target_paper_id" AS "targetPaperId"
      FROM "mock_exam_generation_jobs"
      WHERE "id" IN (${Prisma.join(mockJobIds)})
    `.catch(() => [])
    : [];
  const targetPaperIds = [...new Set([
    created.draftPaperId,
    ...targetPaperRows.map((row) => Number(row.targetPaperId)).filter((id) => Number.isInteger(id) && id > 0)
  ].filter(Boolean).map(Number))];
  if (targetPaperIds.length) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: { in: targetPaperIds } } }).catch(() => undefined);
    await prisma.mockExamPaper.deleteMany({ where: { id: { in: targetPaperIds } } }).catch(() => undefined);
  }
  for (const jobId of mockJobIds) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_generation_jobs" WHERE "id" = ${jobId}`.catch(() => undefined);
  }
  if (created.mockBlueprintId) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_blueprints" WHERE "id" = ${created.mockBlueprintId}`.catch(() => undefined);
  }
  if (created.aiJobId) {
    await prisma.$executeRaw`DELETE FROM "csca_ai_generation_jobs" WHERE "id" = ${created.aiJobId}`.catch(() => undefined);
  }
  if (created.candidateId) {
    await prisma.$executeRaw`DELETE FROM "csca_questions" WHERE "id" = ${created.candidateId}`.catch(() => undefined);
  }
  if (created.aiBlueprintId) {
    await prisma.$executeRaw`DELETE FROM "csca_question_blueprints" WHERE "id" = ${created.aiBlueprintId}`.catch(() => undefined);
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
  for (const generationProfileId of [...new Set([created.generationProfileId, ...created.generationProfileIds].filter(Boolean))]) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" = ${generationProfileId}
    `.catch(() => undefined);
  }
  for (const seriesProfileId of [...new Set([created.seriesProfileId, ...created.seriesProfileIds].filter(Boolean))]) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" = ${seriesProfileId}
    `.catch(() => undefined);
  }
  if (created.sourcePaperId) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: created.sourcePaperId } }).catch(() => undefined);
    await prisma.mockExamPaper.delete({ where: { id: created.sourcePaperId } }).catch(() => undefined);
  }
  if (created.topicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.topicId}`.catch(() => undefined);
  }
}

class StubAIQuestioningService {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  async assertOnlineMockExamGenerationReady() {
    return { ready: true };
  }

  async createBlueprint(input) {
    const [row] = await this.prisma.$queryRaw`
      INSERT INTO "csca_question_blueprints" (
        "subject", "topic_id", "difficulty", "question_type", "skill", "source", "constraints", "status", "updated_at"
      )
      VALUES (
        ${input.subject}, ${input.topicId}, ${input.difficulty || '基础'}, ${input.questionType || 'single_choice'},
        ${input.skill || 'mock smoke'}, ${input.source || 'mock_exam_blueprint_slot'},
        ${JSON.stringify(input.constraints || {})}::jsonb, 'active', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    created.aiBlueprintId = row.id;
    return { id: row.id };
  }

  async enqueueGenerationJobs({ blueprintIds }) {
    const blueprintId = Number(blueprintIds[0]);
    const [row] = await this.prisma.$queryRaw`
      INSERT INTO "csca_ai_generation_jobs" ("blueprint_id", "status", "provider", "model", "updated_at")
      VALUES (${blueprintId}, 'queued', 'smoke-stub', 'mock-exam-ai-generation-smoke', CURRENT_TIMESTAMP)
      RETURNING "id"
    `;
    created.aiJobId = row.id;
    return { items: [{ id: row.id, blueprintId, status: 'queued', questionId: null }] };
  }

  async processGenerationJobs({ jobIds }) {
    const jobId = Number(jobIds[0]);
    const [blueprint] = await this.prisma.$queryRaw`
      SELECT "id", "subject", "topic_id" AS "topicId", "constraints"
      FROM "csca_question_blueprints"
      WHERE "id" = ${created.aiBlueprintId}
      LIMIT 1
    `;
    const mockExamSlot = blueprint.constraints?.mockExamSlot || {};
    const [question] = await this.prisma.$queryRaw`
      INSERT INTO "csca_questions" (
        "subject", "topic_id", "blueprint_id", "source_type", "designed_difficulty",
        "question_type", "prompt", "options", "correct_answer", "explanation",
        "knowledge_tags", "option_metadata", "syllabus_version", "generation_metadata",
        "review_metadata", "status", "updated_at"
      )
      VALUES (
        ${blueprint.subject}, ${blueprint.topicId}, ${blueprint.id}, 'ai_generated', 'basic',
        'single_choice', ${`Smoke mock candidate ${stamp}: What is 2 + 2?`}, ${JSON.stringify(options())}::jsonb,
        'B', '2 + 2 = 4.', ${JSON.stringify(['mock-ai-smoke'])}::jsonb,
        ${JSON.stringify([{ optionId: 'A', distractorIntent: 'under-counts by two', misconceptionTags: ['arithmetic'] }])}::jsonb,
        '2026-smoke', ${JSON.stringify(mockGenerationMetadata({
          blueprintId: mockExamSlot.blueprintId,
          slotId: mockExamSlot.slotId
        }))}::jsonb,
        ${JSON.stringify(reviewMetadata())}::jsonb, 'pending_review', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    created.candidateId = question.id;
    await this.prisma.$executeRaw`
      UPDATE "csca_ai_generation_jobs"
      SET "status" = 'succeeded', "question_id" = ${question.id}, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${jobId}
    `;
    return { items: [{ id: jobId, blueprintId: blueprint.id, status: 'succeeded', questionId: question.id, provider: 'smoke-stub', model: 'mock-exam-ai-generation-smoke' }] };
  }
}

async function main() {
  try {
    const [topic] = await prisma.$queryRaw`
      INSERT INTO "csca_exam_topics" (
        "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "difficulty_range", "status"
      )
      VALUES (
        'math', 'Mock Smoke', ${stamp}, 'Mock Exam AI Smoke Topic', 'Mock exam AI smoke topic',
        'Simple arithmetic for online mock exam AI generation smoke.', '2026-smoke', 1,
        ${JSON.stringify(['基础'])}::jsonb, 'published'
      )
      RETURNING "id"
    `;
    created.topicId = topic.id;

    const paper = await prisma.mockExamPaper.create({
      data: {
        subject: 'math',
        slug: `${stamp}-source`,
        title: `Mock AI Smoke Source ${stamp}`,
        description: 'Temporary source paper for mock exam AI smoke.',
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
            prompt: 'Smoke source question: What is 1 + 1?',
            options: options(),
            correctAnswer: 'A',
            explanation: '1 + 1 = 2.',
            knowledgeTags: ['mock-ai-smoke'],
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
        confidence: 0.95
      }
    });

    const [sourceProfile] = await prisma.$queryRaw`
      INSERT INTO "csca_question_style_profiles" (
        "subject", "syllabus_version", "scope_type", "source_question_ids", "sample_size",
        "confidence", "profile", "profile_version", "source_question_snapshot_hash", "status",
        "generated_by", "updated_at"
      )
      VALUES (
        'math', '2026-smoke', 'subject', ${JSON.stringify([created.sourceQuestionId])}::jsonb, 1,
        'high', ${JSON.stringify({
          promptStyle: 'short arithmetic source profile for mock AI smoke',
          answerDistribution: { A: 1 },
          difficultyMix: { basic: 1 }
        })}::jsonb,
        1, ${`${stamp}-source-profile`}, 'active', 'smoke', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    created.sourceProfileId = sourceProfile.id;

    const firstProfile = await createActiveMockGenerationProfile({
      sourceSnapshotHash: `${stamp}-source-snapshot-v1`,
      syllabusSnapshotHash: `${stamp}-syllabus-snapshot-v1`,
      profilePolicyVersion: 'mock-ai-smoke-v1'
    });
    let { sourceSnapshotHash, syllabusSnapshotHash } = firstProfile;

    const gateway = disabledGateway();
    const realReviewer = new QuestionReviewerService(new QuestionValidatorService(), new QuestionReviewerProviderService(gateway));
    const qualityService = new QuestionQualityService(prisma);
    const realAIQuestioning = new AIQuestioningService(
      prisma,
      new QuestionGeneratorService(),
      new QuestionGeneratorProviderService(new QuestionPromptBuilderService(), gateway),
      realReviewer,
      new QuestionTopicMapperProviderService(gateway),
      qualityService
    );
    const mockExamService = new CscaMockExamService(
      prisma,
      {},
      {},
      {},
      new StubAIQuestioningService(prisma)
    );

    const blueprintResult = await mockExamService.createAdminBlueprintFromPaper(String(created.sourcePaperId), {
      title: `Mock AI Smoke Blueprint ${stamp}`,
      syllabusVersion: '2026-smoke',
      force: true
    }, actorId);
    created.mockBlueprintId = blueprintResult.blueprint.id;
    assert(blueprintResult.created === true, 'Blueprint should be created from the source paper.');
    assert(blueprintResult.slots.length === 1, 'Blueprint should contain one slot.');
    created.mockSlotId = blueprintResult.slots[0].id;

    await mockExamService.updateAdminBlueprintSlot(String(created.mockSlotId), {
      status: 'ready',
      topicIds: [created.topicId],
      difficultyBand: 'basic',
      cognitiveSkill: 'calculation',
      readingLoad: 'low',
      calculationLoad: 'light',
      estimatedTimeSeconds: 45,
      generationPromptHints: ['Keep the item concise.'],
      reviewerChecklist: ['Check arithmetic and option uniqueness.']
    }, actorId);

    const active = await mockExamService.updateAdminBlueprint(String(created.mockBlueprintId), {
      status: 'active',
      expectedVersion: blueprintResult.blueprint.version
    }, actorId);
    assert(active.blueprint.status === 'active', 'Blueprint should become active after ready slot confirmation.');

    const staleJob = await mockExamService.createAdminGenerationJob(String(created.mockBlueprintId), {
      slotNumbers: [1],
      autoProcess: false
    }, actorId);
    created.mockJobIds.push(staleJob.id);
    const staleQueuedLineage = staleJob.slotResults?.[0]?.generationLineage;
    assert(staleQueuedLineage?.generationProfileId === firstProfile.generationProfileId, 'Stale fixture job should first pin the original generation profile.');
    assert(staleQueuedLineage?.sourceSnapshotHash === firstProfile.sourceSnapshotHash, 'Stale fixture job should first pin the original source snapshot.');

    await prisma.$executeRaw`
      UPDATE "csca_generation_profiles"
      SET "status" = 'superseded', "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${firstProfile.generationProfileId}
    `;
    await prisma.$executeRaw`
      UPDATE "csca_exam_series_profiles"
      SET "status" = 'superseded', "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${firstProfile.seriesProfileId}
    `;
    const secondProfile = await createActiveMockGenerationProfile({
      sourceSnapshotHash: `${stamp}-source-snapshot-v2`,
      syllabusSnapshotHash: `${stamp}-syllabus-snapshot-v2`,
      profilePolicyVersion: 'mock-ai-smoke-v2'
    });
    ({ sourceSnapshotHash, syllabusSnapshotHash } = secondProfile);

    let staleError = null;
    try {
      await mockExamService.processAdminGenerationJob(String(staleJob.id), { force: true }, actorId);
    } catch (error) {
      staleError = error;
    }
    assert(staleError?.message?.includes('archived_stale_profile'), `Old queued mock job should fail before provider when active profile changes. got=${staleError?.message}`);
    const staleAfterProfileSwitch = await waitForMockGenerationJob(mockExamService, staleJob.id, ['failed']);
    assert(staleAfterProfileSwitch.error?.includes('archived_stale_profile'), 'Stale mock job must persist archived_stale_profile error.');
    assert(created.candidateId == null, 'Stale mock job must be blocked before candidate generation.');

    const generationJob = await mockExamService.createAdminGenerationJob(String(created.mockBlueprintId), {
      slotNumbers: [1],
      autoProcess: true
    }, actorId);
    created.mockJobId = generationJob.id;
    created.mockJobIds.push(generationJob.id);
    assert(generationJob.status === 'queued', 'Generation job should be created queued before background processing updates it.');
    const queuedLineage = generationJob.slotResults?.[0]?.generationLineage;
    assert(queuedLineage?.generationProfileId === created.generationProfileId, 'Queued mock job must pin the active generation profile id.');
    assert(queuedLineage?.seriesProfileId === created.seriesProfileId, 'Queued mock job must pin the active series profile id.');
    assert(queuedLineage?.sourceStyleProfileId === created.sourceProfileId, 'Queued mock job must pin the active source style profile id.');
    assert(queuedLineage?.sourceSnapshotHash === sourceSnapshotHash, 'Queued mock job must pin the source snapshot hash.');
    assert(queuedLineage?.syllabusSnapshotHash === syllabusSnapshotHash, 'Queued mock job must pin the syllabus snapshot hash.');
    assert(queuedLineage?.profilePolicyVersion === 'mock-ai-smoke-v2', 'Queued mock job must pin the profile policy version.');

    const processed = await waitForMockGenerationJob(mockExamService, created.mockJobId, ['completed']);
    assert(processed.status === 'completed', `Processed mock generation job should auto-approve gate-passed candidates, got ${JSON.stringify(processed)}.`);
    const candidateId = processed.slotResults?.[0]?.candidateQuestionId;
    assert(candidateId === created.candidateId, 'Generation job should store the generated candidate id.');
    assert(['approved', 'assembled'].includes(processed.slotResults?.[0]?.status), 'Gate-passed mock candidate should be approved and may already be auto-assembled in slot results.');
    const processedLineage = processed.slotResults?.[0]?.generationLineage;
    assert(processedLineage?.generationProfileId === created.generationProfileId, 'Processed mock job must retain generation profile lineage.');
    assert(processedLineage?.sourceSnapshotHash === sourceSnapshotHash, 'Processed mock job must retain source snapshot lineage.');

    const approved = await realAIQuestioning.listQuestions({ useCase: 'online_mock_exam', status: 'approved', limit: 5 });
    const approvedCandidate = approved.items.find((item) => item.id === created.candidateId);
    assert(approvedCandidate?.status === 'approved', 'Mock candidate should move to approved status automatically.');
    assert(approvedCandidate.sourceQuestionId == null, 'Mock candidate approval must not link a special-practice question.');
    assert(approvedCandidate.reviewMetadata?.mockExamApproval?.practicePublishSkipped === true, 'Mock candidate approval must record practice publish skip.');
    assert(approvedCandidate.generationMetadata?.targetUseCase === 'online_mock_exam', 'Approved mock candidate must retain online_mock_exam target use case.');
    assert(approvedCandidate.generationMetadata?.versionGovernance?.status === 'current', 'Approved mock candidate must retain current version governance status.');
    assert(approvedCandidate.generationMetadata?.versionGovernance?.targetUseCase === 'online_mock_exam', 'Approved mock candidate governance must stay scoped to online_mock_exam.');

    const specialPracticeRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "special_practice_questions"
      WHERE "prompt" = ${`Smoke mock candidate ${stamp}: What is 2 + 2?`}
    `;
    assert(specialPracticeRows.length === 0, 'Mock candidate approval must not create a special-practice question.');

    assert(processed.targetPaperId, 'Completed mock generation job must auto assemble and publish a target paper.');
    created.draftPaperId = processed.targetPaperId;
    assert(processed.slotResults?.[0]?.assembledQuestionId, 'Slot result must keep assembled question provenance after auto assembly.');
    const publicPaper = await prisma.mockExamPaper.findFirst({
      where: { id: created.draftPaperId, status: 'published' }
    });
    assert(publicPaper, 'Auto-assembled mock paper must be public.');

    const draftQuestions = await prisma.mockExamQuestion.findMany({
      where: { paperId: created.draftPaperId },
      orderBy: { orderNumber: 'asc' }
    });
    created.draftQuestionIds = draftQuestions.map((question) => question.id);
    assert(draftQuestions.length === 1, 'Auto-published mock paper should contain one question.');
    assert(draftQuestions[0].prompt.includes(`Smoke mock candidate ${stamp}`), 'Published question should come from the approved mock candidate.');
    assert(draftQuestions[0].knowledgeTags.includes('mock-ai-smoke'), 'Published question should preserve candidate provenance fields.');

    const auditRows = await prisma.adminAuditLog.findMany({
      where: {
        module: 'mock-exam',
        resourceId: { in: [String(created.mockBlueprintId), String(created.mockSlotId), String(created.mockJobId)] }
      },
      select: { id: true }
    });
    created.auditIds = auditRows.map((row) => row.id);
    assert(created.auditIds.length >= 4, 'Mock exam smoke should write admin audit provenance.');

    console.log(JSON.stringify({
      status: 'passed',
      blueprintId: created.mockBlueprintId,
      generationJobId: created.mockJobId,
      candidateId: created.candidateId,
      publishedPaperId: created.draftPaperId,
      auditEvents: created.auditIds.length
    }, null, 2));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
