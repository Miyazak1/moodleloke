const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { AgentInterventionVerificationService } = require('../dist/backend/src/agent/agent-intervention-verification.service');
const { AdaptiveQuestionProviderService } = require('../dist/backend/src/csca-special-practice/adaptive-question-provider.service');

const delivery = {
  id: 'delivery-1', interventionId: 'intervention-1', userId: 42, status: 'completed',
  contentSourceType: 'concept_card', contentSourceId: '7', contentSourceVersion: 'v4', completedAt: new Date(),
  intervention: { id: 'intervention-1', subjectCode: 'math', topicId: 11, reasonSummary: '函数概念反复出错。' }
};

function row(overrides = {}) {
  return {
    id: 'verification-1', deliveryId: delivery.id, interventionId: delivery.interventionId, userId: 42,
    subjectCode: 'math', topicId: 11, status: 'recommended', phase: 'immediate', selectionVersion: 'selection-v1',
    measurementVersion: 'measurement-v1', contentSourceVersion: 'v4',
    questionRefs: [{ type: 'csca_question', id: 1, version: 2, topicId: 11, difficulty: '中等', transferSignature: 'blueprint_skill:direct' }],
    selectionConstraints: {},
    supplySnapshot: { topicTitle: '函数' }, conversationId: 'conversation-1', offerRequestId: 'offer-request-1',
    startRequestId: null, roundId: null, dueAt: new Date(Date.now() - 1_000), expiresAt: new Date(Date.now() + 60_000), startedAt: null,
    completedAt: null, updatedAt: new Date(), sourceDelivery: { ...delivery, stabilityAssessment: null }, outcome: null, ...overrides
  };
}

async function testStrictUnexposedSelection() {
  const prisma = {
    cscaQuestion: { findMany: async () => [
      { id: 1, version: 2, questionType: 'single-choice', knowledgeTags: ['函数'], blueprint: { skill: 'direct' }, designedDifficulty: '中等', empiricalDifficulty: null, difficultyConfidence: null, qualityMetric: null, topic: { id: 11, code: 'FUNC', title: '函数' } },
      { id: 2, version: 1, questionType: 'single-choice', knowledgeTags: ['函数'], blueprint: { skill: 'direct' }, designedDifficulty: '中等', empiricalDifficulty: null, difficultyConfidence: null, qualityMetric: { needsReview: true }, topic: { id: 11, code: 'FUNC', title: '函数' } },
      { id: 3, version: 1, questionType: 'single-choice', knowledgeTags: ['函数图像'], blueprint: { skill: 'graph' }, designedDifficulty: '较难', empiricalDifficulty: null, difficultyConfidence: null, qualityMetric: null, topic: { id: 11, code: 'FUNC', title: '函数' } }
    ] },
    cscaQuestionExposure: { findMany: async () => [{ questionId: 1 }] },
    assessmentItemExposure: { findMany: async () => [] },
    learningEvidenceEvent: { findMany: async () => [] }
  };
  const selected = await new AdaptiveQuestionProviderService(prisma).pickIndependentVerificationQuestions(42, 11, 3);
  assert.deepEqual(selected.map((item) => item.questionId), [3]);
}

async function testShortageAndMockSuppression() {
  let saved;
  const supplyRequests = [];
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionVerification: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }) => { saved = row({ ...data }); return saved; }
    },
    learningInterventionDelivery: { findFirst: async () => delivery },
    cscaExamTopic: { findFirst: async () => ({ title: '函数' }) },
    learningInterventionStabilityAssessment: { findUnique: async () => null, upsert: async ({ create }) => create }
  };
  prisma.$transaction = async (callback) => callback(prisma);
  const service = new AgentInterventionVerificationService(
    prisma, { isEnabled: () => true }, { pickIndependentVerificationQuestions: async () => [] },
    { createInterventionVerificationRound: async () => { throw new Error('generator-like round creation must not run during offer'); } },
    { async recordBestEffort(input) { supplyRequests.push(input); } }
  );
  const result = await service.offer(42, { clientRequestId: 'offer-request-1', conversationId: 'conversation-1' });
  assert.equal(result.item, null);
  assert.equal(result.shortage.code, 'REVIEWED_UNEXPOSED_SUPPLY_UNAVAILABLE');
  assert.equal(saved.status, 'supply_unavailable');
  assert.equal(saved.supplySnapshot.aiInvoked, false);
  assert.equal(saved.supplySnapshot.automaticQuestionGenerationInvoked, false);
  assert.equal(supplyRequests.length, 1);
  assert.equal(supplyRequests[0].source, 'intervention_verification');
  assert.equal(supplyRequests[0].verificationPhase, 'immediate');
  assert.equal(supplyRequests[0].availableCount, 0);
  prisma.mockExamAttempt.findFirst = async () => ({ id: 9 });
  await assert.rejects(() => service.offer(42, { clientRequestId: 'mock-request-1' }), /正式模考/);
}

async function testStartReplayAndOutcomeEvidence() {
  const started = row({ status: 'started', startRequestId: 'start-request-1', roundId: 99, startedAt: new Date() });
  const outcome = { id: 'outcome-1', result: 'passed', correctCount: 2, totalCount: 3, accuracy: 2 / 3, independent: true, evidenceRefs: [{ evidenceId: 'e-1' }], evaluatedAt: new Date() };
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    learningInterventionVerification: {
      findFirst: async ({ where }) => where.userId === 42 ? started : null,
      updateMany: async () => ({ count: 1 }),
      upsert: async () => ({}) ,
      findFirstOrThrow: async () => ({ ...started, outcome, sourceDelivery: { ...delivery, stabilityAssessment: { status: 'pending', result: null, policyVersion: 'v1' } } })
    },
    cscaAdaptiveRound: { findFirst: async () => ({
      id: 99, submittedAt: new Date(), items: [
        { questionId: 1, isCorrect: true, usedHint: false, usedExplanation: false },
        { questionId: 2, isCorrect: true, usedHint: false, usedExplanation: false },
        { questionId: 3, isCorrect: false, usedHint: false, usedExplanation: false }
      ]
    }) },
    learningEvidenceEvent: { findMany: async () => [1, 2, 3].map((id) => ({ id: `e-${id}`, eventId: `event-${id}`, questionId: `csca_question:${id}`, retraction: null })) },
    learningInterventionOutcome: {
      upsert: async ({ create }) => { assert.equal(create.metadata.masteryChangedByOutcomeWriter, false); assert.equal(create.evidenceRefs.length, 3); return { ...create, ...outcome }; },
      findMany: async () => [{ ...outcome, verification: { phase: 'immediate' } }]
    },
    learningInterventionStabilityAssessment: { upsert: async ({ create }) => { assert.equal(create.status, 'pending'); return create; } }
  };
  prisma.$transaction = async (callback) => callback(prisma);
  const adaptive = { createInterventionVerificationRound: async () => { throw new Error('idempotent replay must not create another round'); } };
  const service = new AgentInterventionVerificationService(prisma, { isEnabled: () => true }, {}, adaptive);
  const replay = await service.start(42, started.id, { clientRequestId: 'start-request-1', questionLanguage: 'zh' });
  assert.equal(replay.route.includes('/rounds/99'), true);
  const settled = await service.settle(42, started.id);
  assert.equal(settled.outcome.result, 'passed');
  await assert.rejects(() => service.start(7, started.id, { clientRequestId: 'start-request-2', questionLanguage: 'zh' }), /不存在/);
}

async function testSuccessfulStartConfirmsRecoveredSupply() {
  const refs = [1, 2, 3].map((id) => ({
    type: 'csca_question', id, version: 1, topicId: 11, difficulty: '中等', transferSignature: `skill:${id}`
  }));
  const recommended = row({ questionRefs: refs, selectionConstraints: {}, status: 'recommended' });
  const started = row({ questionRefs: refs, selectionConstraints: {}, status: 'started', roundId: 101, startedAt: new Date() });
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    learningInterventionVerification: {
      findFirst: async () => recommended,
      updateMany: async () => ({ count: 1 }),
      findFirstOrThrow: async () => started
    }
  };
  const confirmations = [];
  const service = new AgentInterventionVerificationService(
    prisma,
    { isEnabled: () => true },
    {},
    { async createInterventionVerificationRound() { return { round: { id: 101 } }; } },
    { async recordRecoveryBestEffort(input) { confirmations.push(input); } }
  );
  const result = await service.start(42, recommended.id, { clientRequestId: 'recovery-start-1', questionLanguage: 'zh' });
  assert.equal(result.route.includes('/rounds/101'), true);
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0].confirmationKind, 'task_started');
  assert.equal(confirmations[0].availableCount, 3);
}

function testIsolationAndLeakageGuards() {
  const serviceSource = readFileSync(require.resolve('../dist/backend/src/agent/agent-intervention-verification.service'), 'utf8');
  const adaptiveSource = readFileSync(require.resolve('../dist/backend/src/csca-special-practice/csca-adaptive.service'), 'utf8');
  const coachSource = readFileSync(require.resolve('../dist/backend/src/csca-special-practice/ai-coach.service'), 'utf8');
  assert.doesNotMatch(serviceSource, /aiGateway|generateQuestion|userCscaTopicStateV2\.(update|upsert)/i);
  assert.match(adaptiveSource, /INDEPENDENT_VERIFICATION_NO_LIVE_CHECK/);
  assert.match(coachSource, /INDEPENDENT_VERIFICATION_ASSISTANCE_DISABLED/);
}

async function main() {
  await testStrictUnexposedSelection();
  await testShortageAndMockSuppression();
  await testStartReplayAndOutcomeEvidence();
  await testSuccessfulStartConfirmsRecoveredSupply();
  testIsolationAndLeakageGuards();
  console.log('LEARNING_INTERVENTION_VERIFICATION_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
