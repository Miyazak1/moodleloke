const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { AdaptiveQuestionProviderService } = require('../dist/backend/src/csca-special-practice/adaptive-question-provider.service');
const { AgentInterventionVerificationService } = require('../dist/backend/src/agent/agent-intervention-verification.service');

const intervention = { id: 'intervention-1', subjectCode: 'math', topicId: 11, reasonSummary: '函数知识需要巩固。' };
const delivery = {
  id: 'delivery-1', interventionId: intervention.id, userId: 42, status: 'completed',
  contentSourceType: 'concept_card', contentSourceId: '7', contentSourceVersion: 'v4',
  completedAt: new Date(), intervention, stabilityAssessment: null
};

function verification(phase, overrides = {}) {
  return {
    id: `verification-${phase}`, deliveryId: delivery.id, interventionId: intervention.id, userId: 42,
    subjectCode: 'math', topicId: 11, status: 'scheduled', phase,
    selectionVersion: `${phase}-selection-v1`, measurementVersion: `${phase}-measurement-v1`, contentSourceVersion: 'v4',
    questionRefs: [], selectionConstraints: {}, supplySnapshot: { topicTitle: '函数' },
    conversationId: 'conversation-1', offerRequestId: `offer-${phase}-1`, startRequestId: null, roundId: null,
    dueAt: new Date(Date.now() - 1_000), expiresAt: new Date(Date.now() + 60_000),
    startedAt: null, completedAt: null, updatedAt: new Date(), sourceDelivery: delivery, outcome: null,
    ...overrides
  };
}

function trustedQuestion(id, skill) {
  return {
    id, version: 1, questionType: 'single-choice', knowledgeTags: ['函数'],
    generationMetadata: null, reviewMetadata: null, blueprint: skill ? { skill } : null,
    designedDifficulty: '中等', empiricalDifficulty: null, difficultyConfidence: null,
    qualityMetric: null, topic: { id: 11, code: 'FUNC', title: '函数' }
  };
}

async function testTransferRequiresDifferentTrustedStructure() {
  const prisma = {
    cscaQuestion: { findMany: async () => [trustedQuestion(1, 'direct'), trustedQuestion(2, 'graph'), trustedQuestion(3, null), trustedQuestion(4, 'application')] },
    cscaQuestionExposure: { findMany: async () => [] },
    assessmentItemExposure: { findMany: async () => [] },
    learningEvidenceEvent: { findMany: async () => [] }
  };
  const selected = await new AdaptiveQuestionProviderService(prisma).pickIndependentVerificationQuestions(
    42, 11, 3, [], { requireDifferentTransferSignature: true, excludedTransferSignatures: ['blueprint_skill:direct', 'taxonomy:single-choice|函数'] }
  );
  assert.deepEqual(selected.map((item) => item.questionId), [2, 4]);
  assert.deepEqual(selected.map((item) => item.transferSignature), ['blueprint_skill:graph', 'blueprint_skill:application']);
}

async function testRetentionWaitsUntilDue() {
  const future = verification('retention', { dueAt: new Date(Date.now() + 60_000) });
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionVerification: { findFirst: async () => future }
  };
  const service = new AgentInterventionVerificationService(prisma, { isEnabled: () => true }, {
    pickIndependentVerificationQuestions: async () => { throw new Error('questions must not be selected before dueAt'); }
  }, {});
  const result = await service.offer(42, { clientRequestId: 'retention-wait-1', conversationId: 'conversation-1' });
  assert.equal(result.item, null);
  assert.equal(new Date(result.nextDueAt).getTime(), future.dueAt.getTime());
}

async function testTransferMaterializationAndShortage() {
  const due = verification('transfer');
  let update;
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionVerification: {
      findFirst: async () => due,
      findMany: async () => [{ questionRefs: [{ id: 1, version: 1, transferSignature: 'blueprint_skill:direct' }] }],
      updateMany: async ({ data }) => { update = data; return { count: 1 }; },
      findFirstOrThrow: async () => verification('transfer', { status: update.status, questionRefs: update.questionRefs, supplySnapshot: update.supplySnapshot })
    },
    cscaExamTopic: { findFirst: async () => ({ title: '函数' }) },
    learningInterventionStabilityAssessment: { findUnique: async () => null, upsert: async ({ create }) => create }
  };
  prisma.$transaction = async (callback) => callback(prisma);
  const service = new AgentInterventionVerificationService(prisma, { isEnabled: () => true }, {
    pickIndependentVerificationQuestions: async (_user, _topic, _count, excludedRefs, constraints) => {
      assert.deepEqual(excludedRefs, ['csca_question:1:v1']);
      assert.equal(constraints.requireDifferentTransferSignature, true);
      assert.deepEqual(constraints.excludedTransferSignatures, ['blueprint_skill:direct']);
      return [];
    }
  }, {});
  const result = await service.offer(42, { clientRequestId: 'transfer-offer-1', conversationId: 'conversation-1' });
  assert.equal(result.item, null);
  assert.equal(result.shortage.code, 'CROSS_STRUCTURE_SUPPLY_UNAVAILABLE');
  assert.equal(update.supplySnapshot.aiInvoked, false);
  assert.equal(update.supplySnapshot.automaticQuestionGenerationInvoked, false);
}

async function settlePhase(phase, resultKind = 'passed') {
  const current = verification(phase, {
    status: 'started', roundId: 99, dueAt: new Date(Date.now() - 60_000),
    questionRefs: [1, 2, 3].map((id) => ({ id, version: 1, transferSignature: `blueprint_skill:s${id}` }))
  });
  const correctCount = resultKind === 'passed' ? 3 : 1;
  let scheduled = null;
  let assessment = null;
  const outcome = {
    id: `outcome-${phase}`, verificationId: current.id, deliveryId: delivery.id,
    result: resultKind, correctCount, totalCount: 3, accuracy: correctCount / 3, independent: true,
    evidenceRefs: [1, 2, 3].map((id) => ({ evidenceId: `e-${id}` })), evaluatedAt: new Date(), verification: { phase }
  };
  const priorOutcomes = phase === 'immediate' ? [] : [{
    ...outcome, id: 'outcome-immediate', verificationId: 'verification-immediate', result: 'passed', verification: { phase: 'immediate' }
  }, ...(phase === 'transfer' ? [{
    ...outcome, id: 'outcome-retention', verificationId: 'verification-retention', result: 'passed', verification: { phase: 'retention' }
  }] : [])];
  const prisma = {
    learningInterventionVerification: {
      findFirst: async () => current, updateMany: async () => ({ count: 1 }),
      upsert: async ({ create }) => { scheduled = create; return create; },
      findFirstOrThrow: async () => ({ ...current, status: 'completed', outcome, sourceDelivery: { ...delivery, stabilityAssessment: assessment } })
    },
    cscaAdaptiveRound: { findFirst: async () => ({
      id: 99, submittedAt: new Date(), items: [1, 2, 3].map((questionId, index) => ({
        questionId, isCorrect: index < correctCount, usedHint: false, usedExplanation: false
      }))
    }) },
    learningEvidenceEvent: { findMany: async () => [1, 2, 3].map((id) => ({ id: `e-${id}`, eventId: `event-${id}`, questionId: `csca_question:${id}`, retraction: null })) },
    learningInterventionOutcome: { upsert: async () => outcome, findMany: async () => [...priorOutcomes, outcome] },
    learningInterventionStabilityAssessment: { upsert: async ({ create }) => { assessment = create; return create; } }
  };
  prisma.$transaction = async (callback) => callback(prisma);
  const service = new AgentInterventionVerificationService(prisma, { isEnabled: () => true }, {}, {});
  await service.settle(42, current.id);
  return { scheduled, assessment };
}

async function testStabilitySequence() {
  const immediate = await settlePhase('immediate', 'passed');
  assert.equal(immediate.scheduled.phase, 'retention');
  assert.equal(immediate.scheduled.status, 'scheduled');
  assert.ok(immediate.scheduled.dueAt.getTime() > Date.now());
  assert.equal(immediate.assessment.status, 'pending');

  const retention = await settlePhase('retention', 'passed');
  assert.equal(retention.scheduled.phase, 'transfer');
  assert.equal(retention.assessment.status, 'pending');

  const transfer = await settlePhase('transfer', 'passed');
  assert.equal(transfer.scheduled, null);
  assert.equal(transfer.assessment.status, 'completed');
  assert.equal(transfer.assessment.result, 'stable');

  const failed = await settlePhase('retention', 'failed');
  assert.equal(failed.scheduled, null);
  assert.equal(failed.assessment.result, 'not_stable');
}

function testArchitectureGuards() {
  const service = readFileSync(require.resolve('../dist/backend/src/agent/agent-intervention-verification.service'), 'utf8');
  assert.doesNotMatch(service, /aiGateway|generateQuestion|userCscaTopicStateV2\.(update|upsert)/i);
  assert.match(service, /CROSS_STRUCTURE_SUPPLY_UNAVAILABLE/);
  assert.match(service, /masteryChangedByOutcomeWriter/);
}

async function main() {
  await testTransferRequiresDifferentTrustedStructure();
  await testRetentionWaitsUntilDue();
  await testTransferMaterializationAndShortage();
  await testStabilitySequence();
  testArchitectureGuards();
  console.log('LEARNING_INTERVENTION_STABILITY_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
