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
const stamp = `mock-ai-live-48-${Date.now()}`;
const actorId = Number(process.env.CSCA_MOCK_EXAM_AI_LIVE_48_ACTOR_ID || 1);
const subject = process.env.CSCA_MOCK_EXAM_AI_LIVE_48_SUBJECT || 'math';
const timeoutMs = Number(process.env.CSCA_MOCK_EXAM_AI_LIVE_48_TIMEOUT_MS || 90 * 60 * 1000);
const keepArtifacts = process.env.CSCA_MOCK_EXAM_AI_LIVE_48_KEEP_ARTIFACTS === '1';
const expectedQuestionCount = 48;

const created = {
  syllabusImportId: null,
  topicIds: [],
  sourceProfileId: null,
  sourcePaperId: null,
  sourceQuestionIds: [],
  mockBlueprintId: null,
  mockSlotIds: [],
  mockJobId: null,
  aiBlueprintIds: [],
  aiJobIds: [],
  candidateIds: [],
  draftPaperId: null,
  auditIds: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required for live 48-question online mock generation.');
  const config = providerConfig();
  assert(config.enabled === 'true' || config.enabled === '1', 'CSCA_AI_QUESTION_GENERATION_ENABLED must be true/1.');
  assert(config.provider && config.provider !== 'rule-fallback', 'Question generation provider must not be rule-fallback.');
  assert(config.model, 'Question generation model is required.');
  assert(config.hasApiKey, 'Question generation API key is required.');
  return config;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniquePush(list, value) {
  const number = Number(value);
  if (Number.isInteger(number) && number > 0 && !list.includes(number)) list.push(number);
}

function sourceQuestion(index) {
  const topicIndex = index % 4;
  const base = 20 + index;
  if (topicIndex === 0) {
    return {
      prompt: `A study group has ${base} students. Half of them finished a worksheet and 3 more finished later. How many students finished in total?`,
      options: [
        { id: 'A', text: String(Math.floor(base / 2)) },
        { id: 'B', text: String(Math.floor(base / 2) + 3) },
        { id: 'C', text: String(base - 3) },
        { id: 'D', text: String(base + 3) }
      ],
      correctAnswer: 'B',
      explanation: `Half of ${base} plus 3 gives ${Math.floor(base / 2) + 3}.`,
      knowledgeTags: ['ratio', 'arithmetic', 'word-problem']
    };
  }
  if (topicIndex === 1) {
    return {
      prompt: `Solve the equation x + ${index + 2} = ${base}. What is x?`,
      options: [
        { id: 'A', text: String(base - index - 2) },
        { id: 'B', text: String(base + index + 2) },
        { id: 'C', text: String(index + 2) },
        { id: 'D', text: String(base) }
      ],
      correctAnswer: 'A',
      explanation: `Subtract ${index + 2} from both sides.`,
      knowledgeTags: ['linear-equation', 'algebra']
    };
  }
  if (topicIndex === 2) {
    return {
      prompt: `A number is multiplied by 3 and then decreased by ${index}. Which expression represents the result?`,
      options: [
        { id: 'A', text: `3x - ${index}` },
        { id: 'B', text: `3(x - ${index})` },
        { id: 'C', text: `x/3 - ${index}` },
        { id: 'D', text: `${index} - 3x` }
      ],
      correctAnswer: 'A',
      explanation: 'Multiplying by 3 gives 3x, then decreasing gives 3x minus the number.',
      knowledgeTags: ['expression', 'algebra']
    };
  }
  return {
    prompt: `A bag contains ${index + 4} red balls and ${index + 6} blue balls. What is the probability of drawing a red ball?`,
    options: [
      { id: 'A', text: `${index + 4}/${2 * index + 10}` },
      { id: 'B', text: `${index + 6}/${2 * index + 10}` },
      { id: 'C', text: `${index + 4}/${index + 6}` },
      { id: 'D', text: `${index + 6}/${index + 4}` }
    ],
    correctAnswer: 'A',
    explanation: 'Probability is favourable outcomes divided by total outcomes.',
    knowledgeTags: ['probability', 'fraction']
  };
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

async function collectGenerationArtifactsFromJob() {
  if (!created.mockJobId) return [];
  const rows = await prisma.$queryRaw`
    SELECT "slot_results" AS "slotResults"
    FROM "mock_exam_generation_jobs"
    WHERE "id" = ${created.mockJobId}
    LIMIT 1
  `.catch(() => []);
  const slotResults = Array.isArray(rows?.[0]?.slotResults) ? rows[0].slotResults : [];
  for (const result of slotResults) {
    uniquePush(created.aiBlueprintIds, result?.aiBlueprintId);
    uniquePush(created.aiJobIds, result?.aiGenerationJobId);
    uniquePush(created.candidateIds, result?.candidateQuestionId);
  }
  return slotResults;
}

async function jobDiagnostics() {
  const slotResults = await collectGenerationArtifactsFromJob();
  const statusCounts = slotResults.reduce((acc, item) => {
    const status = String(item?.status || 'unknown');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const candidateCount = created.candidateIds.length;
  const aiJobs = created.aiJobIds.length
    ? await prisma.$queryRaw`
        SELECT "status", "provider", "model", "error"
        FROM "csca_ai_generation_jobs"
        WHERE "id" IN (${Prisma.join(created.aiJobIds)})
      `.catch(() => [])
    : [];
  const aiJobStatusCounts = aiJobs.reduce((acc, item) => {
    const status = String(item?.status || 'unknown');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const errorCounts = aiJobs.reduce((acc, item) => {
    const error = String(item?.error || '').slice(0, 180);
    if (error) acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {});
  const approvedCandidates = created.candidateIds.length
    ? await prisma.$queryRaw`
        SELECT COUNT(*)::int AS "count"
        FROM "csca_questions"
        WHERE "id" IN (${Prisma.join(created.candidateIds)})
          AND "status" = 'approved'
          AND "review_metadata"->'approvalGate'->>'status' = 'passed'
      `.catch(() => [{ count: 0 }])
    : [{ count: 0 }];
  return {
    slotStatusCounts: statusCounts,
    candidateCount,
    approvedCandidateCount: Number(approvedCandidates?.[0]?.count || 0),
    aiJobCount: created.aiJobIds.length,
    aiJobStatusCounts,
    topErrors: Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([error, count]) => ({ error, count }))
  };
}

async function cleanup() {
  await collectGenerationArtifactsFromJob();
  if (keepArtifacts) {
    console.error(JSON.stringify({ status: 'kept_live_48_artifacts', created }, null, 2));
    return;
  }
  if (created.auditIds.length) {
    await prisma.adminAuditLog.deleteMany({ where: { id: { in: created.auditIds } } }).catch(() => undefined);
  }
  if (created.draftPaperId) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: created.draftPaperId } }).catch(() => undefined);
    await prisma.mockExamPaper.delete({ where: { id: created.draftPaperId } }).catch(() => undefined);
  }
  if (created.mockJobId) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_generation_jobs" WHERE "id" = ${created.mockJobId}`.catch(() => undefined);
  }
  if (created.mockBlueprintId) {
    await prisma.$executeRaw`DELETE FROM "mock_exam_blueprints" WHERE "id" = ${created.mockBlueprintId}`.catch(() => undefined);
  }
  if (created.aiJobIds.length) {
    await prisma.$executeRaw`DELETE FROM "csca_ai_generation_jobs" WHERE "id" IN (${Prisma.join(created.aiJobIds)})`.catch(() => undefined);
  }
  if (created.candidateIds.length) {
    await prisma.$executeRaw`DELETE FROM "csca_questions" WHERE "id" IN (${Prisma.join(created.candidateIds)})`.catch(() => undefined);
  }
  if (created.aiBlueprintIds.length) {
    await prisma.$executeRaw`DELETE FROM "csca_question_blueprints" WHERE "id" IN (${Prisma.join(created.aiBlueprintIds)})`.catch(() => undefined);
  }
  if (created.sourceQuestionIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'mock_exam_question' AND "source_id" IN (${Prisma.join(created.sourceQuestionIds)})
    `.catch(() => undefined);
  }
  if (created.sourceProfileId) {
    await prisma.$executeRaw`DELETE FROM "csca_question_style_profiles" WHERE "id" = ${created.sourceProfileId}`.catch(() => undefined);
  }
  if (created.sourcePaperId) {
    await prisma.mockExamQuestion.deleteMany({ where: { paperId: created.sourcePaperId } }).catch(() => undefined);
    await prisma.mockExamPaper.delete({ where: { id: created.sourcePaperId } }).catch(() => undefined);
  }
  if (created.topicIds.length) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" IN (${Prisma.join(created.topicIds)})`.catch(() => undefined);
  }
  if (created.syllabusImportId) {
    await prisma.$executeRaw`DELETE FROM "csca_syllabus_imports" WHERE "id" = ${created.syllabusImportId}`.catch(() => undefined);
  }
}

async function prepareFixture(mockExamService) {
  const topicRows = [];
  const topicDefs = [
    ['M-LIVE-RATIO', 'Ratios and percentages', 'ratio, percentage, proportional reasoning'],
    ['M-LIVE-EQ', 'Linear equations', 'one-variable equations and rearrangement'],
    ['M-LIVE-EXP', 'Expressions and algebraic language', 'expressions, transformations, algebraic representation'],
    ['M-LIVE-PROB', 'Probability and fractions', 'probability, fractions, simple counting']
  ];
  for (const [code, title, scope] of topicDefs) {
    const [topic] = await prisma.$queryRaw`
      INSERT INTO "csca_exam_topics" (
        "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version", "weight", "difficulty_range", "status"
      )
      VALUES (
        ${subject}, 'Live 48 Mock Check', ${`${stamp}-${code}`}, ${title},
        'Temporary topic for live 48-question online mock AI generation verification.',
        ${scope}, '2026-live-48-check', 1, ${JSON.stringify(['基础', '中等', '较难'])}::jsonb, 'published'
      )
      RETURNING "id"
    `;
    topicRows.push(topic);
    created.topicIds.push(topic.id);
  }
  const [syllabusImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary", "applied_at", "created_by"
    )
    VALUES (
      ${subject}, '2026-live-48-check', 'Live 48 online mock AI verification syllabus', 'applied',
      ${JSON.stringify({ subject, syllabusVersion: '2026-live-48-check', topicCount: topicRows.length })}::jsonb,
      ${JSON.stringify({ topicCount: topicRows.length, source: 'csca-mock-exam-ai-generation-live-48-loop' })}::jsonb,
      NOW(), ${actorId}
    )
    RETURNING "id"
  `;
  created.syllabusImportId = syllabusImport.id;

  const questions = Array.from({ length: expectedQuestionCount }, (_, index) => {
    const question = sourceQuestion(index + 1);
    return {
      orderNumber: index + 1,
      questionType: 'single-choice',
      prompt: question.prompt,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      knowledgeTags: question.knowledgeTags,
      status: 'published'
    };
  });
  const paper = await prisma.mockExamPaper.create({
    data: {
      subject,
      slug: `${stamp}-source`,
      title: `Live 48 Mock AI Verification Source ${stamp}`,
      description: 'Temporary 48-question source paper for live online mock AI generation verification.',
      language: 'zh',
      questionCount: expectedQuestionCount,
      durationMinutes: 60,
      priceLabel: null,
      isFree: true,
      isLocked: true,
      sortOrder: 9999,
      status: 'draft',
      questions: { create: questions }
    },
    include: { questions: true }
  });
  created.sourcePaperId = paper.id;
  created.sourceQuestionIds = paper.questions.map((question) => question.id);

  for (const question of paper.questions) {
    const topicId = topicRows[(question.orderNumber - 1) % topicRows.length].id;
    await prisma.cscaTopicMapping.create({
      data: {
        sourceType: 'mock_exam_question',
        sourceId: question.id,
        topicId,
        confidence: 0.96
      }
    });
  }

  const [sourceProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "source_question_ids", "sample_size",
      "confidence", "profile", "profile_version", "source_question_snapshot_hash", "status",
      "generated_by", "updated_at"
    )
    VALUES (
      ${subject}, '2026-live-48-check', 'subject', ${JSON.stringify(created.sourceQuestionIds)}::jsonb, ${expectedQuestionCount},
      'high', ${JSON.stringify({
        promptStyle: 'short to medium CSCA-style MCQ source profile for live 48-question online mock AI verification',
        answerDistribution: { A: 12, B: 12, C: 12, D: 12 },
        difficultyMix: { basic: 16, medium: 20, hard: 12 },
        readingLoadMix: { low: 16, medium: 24, high: 8 },
        calculationLoadMix: { light: 18, medium: 22, heavy: 8 }
      })}::jsonb,
      1, ${`${stamp}-source-profile`}, 'active', 'live-48-smoke', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.sourceProfileId = sourceProfile.id;

  const blueprintResult = await mockExamService.createAdminBlueprintFromPaper(String(created.sourcePaperId), {
    title: `Live 48 Mock AI Blueprint ${stamp}`,
    syllabusVersion: '2026-live-48-check',
    force: true
  }, actorId);
  created.mockBlueprintId = blueprintResult.blueprint.id;
  assert(blueprintResult.slots.length === expectedQuestionCount, `Expected ${expectedQuestionCount} slots, got ${blueprintResult.slots.length}.`);
  created.mockSlotIds = blueprintResult.slots.map((slot) => slot.id);

  const difficulties = ['basic', 'medium', 'hard'];
  const cognitiveSkills = ['standard_application', 'calculation', 'multi_step_reasoning', 'concept_discrimination'];
  for (const slot of blueprintResult.slots) {
    const index = slot.slotNumber - 1;
    const difficultyBand = index < 16 ? 'basic' : index < 36 ? 'medium' : 'hard';
    const calculationLoad = difficultyBand === 'basic' ? 'light' : difficultyBand === 'medium' ? 'medium' : 'heavy';
    const readingLoad = index % 6 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low';
    const questionForm = index % 5 === 0 ? 'concept_judgement' : 'calculation_application';
    const cognitiveSkill = questionForm === 'concept_judgement'
      ? 'concept_discrimination'
      : cognitiveSkills[index % cognitiveSkills.length];
    await mockExamService.updateAdminBlueprintSlot(String(slot.id), {
      status: 'ready',
      topicIds: [topicRows[index % topicRows.length].id],
      difficultyBand,
      questionForm,
      cognitiveSkill,
      readingLoad,
      calculationLoad,
      estimatedTimeSeconds: difficultyBand === 'hard' ? 105 : difficultyBand === 'medium' ? 75 : 45,
      generationPromptHints: [
        `Generate original question ${slot.slotNumber} for a full 48-question online mock exam.`,
        `Target difficulty is ${difficultyBand}; target readingLoad is ${readingLoad}; target calculationLoad is ${calculationLoad}.`,
        'Do not copy the source question wording or numbers. Keep exactly four MCQ options and one correct answer.'
      ],
      reviewerChecklist: [
        'The item must be original and not a direct rewrite of the source question.',
        'The answer must be unique and supported by the explanation.',
        'The generated item must match the target profile for this slot.'
      ]
    }, actorId);
  }

  const latest = await mockExamService.getAdminBlueprint(String(created.mockBlueprintId));
  await mockExamService.updateAdminBlueprint(String(created.mockBlueprintId), {
    status: 'active',
    expectedVersion: latest.blueprint.version
  }, actorId);
}

async function main() {
  const config = assertLiveProviderConfig();
  const mockExamService = new CscaMockExamService(prisma, {}, {}, {}, makeAIQuestioningService());
  let monitorDone = false;
  try {
    await prepareFixture(mockExamService);
    const generationJob = await mockExamService.createAdminGenerationJob(String(created.mockBlueprintId), {
      slotNumbers: Array.from({ length: expectedQuestionCount }, (_, index) => index + 1),
      autoProcess: false
    }, actorId);
    created.mockJobId = generationJob.id;

    const monitor = (async () => {
      let lastLine = '';
      while (!monitorDone) {
        const diagnostics = await jobDiagnostics();
        const line = JSON.stringify({
          event: 'live_48_progress',
          elapsedSeconds: Math.round((Date.now() - Number(stamp.split('-').pop())) / 1000),
          ...diagnostics
        });
        if (line !== lastLine) {
          console.error(line);
          lastLine = line;
        }
        await sleep(15000);
      }
    })();

    const processing = mockExamService.processAdminGenerationJob(String(created.mockJobId), { force: true }, actorId);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms running live 48-question mock generation.`)), timeoutMs));
    const processed = await Promise.race([processing, timeout]);
    monitorDone = true;
    await monitor.catch(() => undefined);

    await collectGenerationArtifactsFromJob();
    const diagnostics = await jobDiagnostics();
    assert(processed.status === 'completed', `Expected generation job completed, got ${processed.status}: ${processed.error || ''}`);
    assert(processed.provider && processed.provider !== 'rule-fallback' && processed.provider !== 'cache' && processed.provider !== 'smoke-stub', `Expected live provider, got ${processed.provider}.`);
    assert(processed.model && processed.model !== 'local-question-generator-v1' && processed.model !== 'mock-exam-ai-generation-smoke', `Expected live model, got ${processed.model}.`);
    assert(Number(diagnostics.slotStatusCounts.approved || 0) === expectedQuestionCount, `Expected ${expectedQuestionCount} approved slot results, got ${JSON.stringify(diagnostics.slotStatusCounts)}.`);
    assert(diagnostics.approvedCandidateCount === expectedQuestionCount, `Expected ${expectedQuestionCount} approved candidates, got ${diagnostics.approvedCandidateCount}.`);

    const assembled = await mockExamService.assembleAdminGenerationJobDraft(String(created.mockJobId), {
      slug: `${stamp}-draft`,
      title: `Live 48 Mock AI Draft ${stamp}`
    }, actorId);
    created.draftPaperId = assembled.paper.id;
    const draftQuestions = await prisma.mockExamQuestion.count({ where: { paperId: created.draftPaperId } });
    assert(draftQuestions === expectedQuestionCount, `Expected assembled draft to contain ${expectedQuestionCount} questions, got ${draftQuestions}.`);

    const auditRows = await prisma.adminAuditLog.findMany({
      where: {
        module: 'mock-exam',
        resourceId: { in: [String(created.mockBlueprintId), String(created.mockJobId)] }
      },
      select: { id: true }
    });
    created.auditIds = auditRows.map((row) => row.id);

    console.log(JSON.stringify({
      status: 'passed',
      provider: processed.provider,
      model: processed.model,
      providerConfig: config,
      blueprintId: created.mockBlueprintId,
      generationJobId: created.mockJobId,
      draftPaperId: created.draftPaperId,
      slotStatusCounts: diagnostics.slotStatusCounts,
      aiJobStatusCounts: diagnostics.aiJobStatusCounts,
      candidateCount: diagnostics.candidateCount,
      approvedCandidateCount: diagnostics.approvedCandidateCount,
      auditEvents: created.auditIds.length
    }, null, 2));
  } finally {
    monitorDone = true;
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    status: 'failed',
    message: error instanceof Error ? error.message : String(error),
    providerConfig: providerConfig(),
    created,
    diagnostics: await jobDiagnostics().catch((diagnosticError) => ({ error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError) }))
  }, null, 2));
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
