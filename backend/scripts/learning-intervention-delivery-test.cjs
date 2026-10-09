const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { AgentInterventionDeliveryService } = require('../dist/backend/src/agent/agent-intervention-delivery.service');

function proposal() {
  return {
    id: 'intervention-1', userId: 42, subjectCode: 'math', topicId: 11,
    action: 'offer_micro_lesson', status: 'shadow_proposed', urgency: 'high', placement: 'between_sets',
    triggerCodes: ['MISCONCEPTION_REPEATED'], reasonSummary: '同一知识点近期反复出错。',
    createdAt: new Date('2026-09-13T09:00:00Z'), expiresAt: new Date(Date.now() + 60_000)
  };
}

function card() {
  return {
    id: 7, title: '函数单调性', body: '先比较自变量变化方向，再判断函数值变化方向。',
    exampleJson: { prompt: '比较区间上的变化。' }, status: 'published', source: 'manual',
    updatedAt: new Date('2026-09-13T08:00:00Z'), topic: { title: '函数', syllabusVersion: '2026' }
  };
}

function deliveryRow(overrides = {}) {
  return {
    id: 'delivery-1', interventionId: 'intervention-1', userId: 42, channel: 'agent_web', placement: 'after_round',
    status: 'offered', contentSourceType: 'concept_card', contentSourceId: '7', contentSourceVersion: 'v1',
    contentSnapshot: { title: '函数单调性', body: '审核后的讲解正文', topicTitle: '函数' }, offeredAt: new Date(),
    startedAt: null, completedAt: null, deferredUntil: null, skippedAt: null, intervention: proposal(), ...overrides
  };
}

function rolloutFlags(isEnabled = true, eligible = true) {
  return {
    isEnabled: () => isEnabled,
    interventionRolloutMode: () => 'internal',
    interventionRollout: () => ({ percent: 0 }),
    interventionRolloutEligibility: (_userId, subjectCode, topicCode) => ({
      eligible, mode: 'internal', subjectCode, topicCode, bucket: null, percent: 0,
      reasonCodes: eligible ? [] : ['USER_NOT_INTERNAL']
    })
  };
}

function topicDb(prisma) {
  prisma.cscaExamTopic = {
    findUnique: async ({ where }) => where.id === 11 ? { code: 'M-FUNC-001' } : null,
    findMany: async () => [{ id: 11, code: 'M-FUNC-001' }]
  };
  prisma.cscaTrainingEvent ??= {
    findFirst: async () => null,
    create: async ({ data }) => data
  };
  return prisma;
}

async function testReviewedOfferAndContentGate() {
  let createdDelivery;
  const steps = [];
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async ({ where }) => where.userId === 42 ? { id: where.id } : null },
    learningInterventionDelivery: {
      findFirst: async () => null,
      create: async ({ data }) => { createdDelivery = deliveryRow({ ...data, contentSnapshot: data.contentSnapshot }); return createdDelivery; }
    },
    learningIntervention: { findMany: async ({ where }) => { assert.equal(where.status, 'shadow_proposed'); return [proposal()]; } },
    cscaConceptCard: {
      findFirst: async ({ where }) => {
        assert.equal(where.status, 'published');
        assert.equal(where.topic.status, 'published');
        return card();
      }
    },
    cscaQuestion: { findFirst: async () => { throw new Error('approved fallback must not run when a reviewed card exists'); } },
    learningInterventionStep: { create: async ({ data }) => { steps.push(data); return data; } },
    $transaction: async (callback) => callback(prisma)
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(), { resolvePublishedForTopic: async () => null });
  const result = await service.offer(42, { clientRequestId: 'offer-request-1', context: 'agent_conversation', conversationId: 'conversation-1' });
  assert.equal(result.item.status, 'offered');
  assert.equal(result.item.content.sourceType, 'concept_card');
  assert.equal(result.item.content.body, '', 'content is revealed only after the learner starts');
  assert.equal(createdDelivery.contextSnapshot.automaticQuestionGenerationInvoked, false);
  assert.equal(createdDelivery.contextSnapshot.aiExplanationGenerated, false);
  assert.equal(createdDelivery.contextSnapshot.masteryMutationAllowed, false);
  assert.equal(createdDelivery.contextSnapshot.interventionRollout.mode, 'internal');
  assert.equal(createdDelivery.contextSnapshot.interventionRollout.eligible, true);
  assert.equal(steps[0].action, 'offer');
}

async function testMissingContentAndFormalMockSuppression() {
  let status;
  const base = {
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionDelivery: { findFirst: async () => null, create: async ({ data }) => { status = data.status; return deliveryRow({ ...data }); } },
    learningIntervention: { findMany: async () => [proposal()] },
    cscaConceptCard: { findFirst: async () => null },
    cscaQuestion: { findFirst: async ({ where }) => { assert.equal(where.status, 'approved'); return null; } },
    learningInterventionStep: { create: async ({ data }) => data },
    $transaction: async (callback) => callback(base)
  };
  base.mockExamAttempt = { findFirst: async () => null };
  topicDb(base);
  const service = new AgentInterventionDeliveryService(base, rolloutFlags(), { resolvePublishedForTopic: async () => null });
  const missing = await service.offer(42, { clientRequestId: 'missing-content-1', context: 'after_round' });
  assert.equal(missing.item, null);
  assert.equal(missing.suppressedReason, 'REVIEWED_CONTENT_UNAVAILABLE');
  assert.equal(status, 'content_unavailable');
  base.mockExamAttempt.findFirst = async () => ({ id: 9 });
  const mock = await service.offer(42, { clientRequestId: 'formal-mock-1', context: 'agent_conversation' });
  assert.equal(mock.item, null);
  assert.equal(mock.suppressedReason, 'FORMAL_MOCK_ACTIVE');
}

async function testPlaceholderContentIsNeverDelivered() {
  let status;
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionDelivery: {
      findFirst: async () => null,
      create: async ({ data }) => { status = data.status; return deliveryRow({ ...data }); }
    },
    learningIntervention: { findMany: async () => [proposal()] },
    cscaConceptCard: { findFirst: async () => ({ ...card(), body: 'This item is local demo data for the Agent golden path.' }) },
    cscaQuestion: { findFirst: async () => null },
    learningInterventionStep: { create: async ({ data }) => data },
    $transaction: async (callback) => callback(prisma)
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(), { resolvePublishedForTopic: async () => null });
  const result = await service.offer(42, { clientRequestId: 'placeholder-content-1', context: 'after_round' });
  assert.equal(result.item, null);
  assert.equal(result.suppressedReason, 'REVIEWED_CONTENT_UNAVAILABLE');
  assert.equal(status, 'content_unavailable');
}

async function testExistingPlaceholderDeliveryIsSuppressed() {
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    agentConversation: { findFirst: async () => ({ id: 'conversation-1' }) },
    learningInterventionDelivery: {
      findFirst: async () => deliveryRow({ contentSnapshot: { title: '解析几何', body: 'This item is local demo data for the Agent golden path.', topicTitle: '解析几何' } })
    }
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(), { resolvePublishedForTopic: async () => null });
  const result = await service.offer(42, { clientRequestId: 'existing-placeholder-1', context: 'agent_conversation', conversationId: 'conversation-1' });
  assert.equal(result.item, null);
  assert.equal(result.suppressedReason, 'PLACEHOLDER_CONTENT_REJECTED');
  await assert.rejects(() => service.get(42, 'delivery-1'), (error) => error?.response?.code === 'INTERVENTION_CONTENT_UNAVAILABLE');
}

async function testActionsAreOwnedAndIdempotent() {
  let row = deliveryRow();
  const steps = new Map();
  let updates = 0;
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    learningInterventionStep: {
      findUnique: async ({ where }) => steps.get(where.userId_clientRequestId.clientRequestId) ?? null,
      create: async ({ data }) => { const saved = { ...data, delivery: row }; steps.set(data.clientRequestId, saved); return saved; }
    },
    learningInterventionDelivery: {
      findFirst: async ({ where }) => where.userId === 42 && where.id === row.id ? row : null,
      updateMany: async ({ where, data }) => {
        if (where.userId !== 42 || where.status !== row.status) return { count: 0 };
        updates += 1; row = { ...row, ...data }; return { count: 1 };
      },
      findUniqueOrThrow: async () => row
    },
    $transaction: async (callback) => callback(prisma)
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(), { resolvePublishedForTopic: async () => null });
  const loaded = await service.get(42, row.id);
  assert.equal(loaded.id, row.id);
  assert.equal(loaded.status, 'offered');
  const started = await service.act(42, row.id, { clientRequestId: 'start-action-1', action: 'start' });
  assert.equal(started.status, 'in_progress');
  assert.equal(started.content.body, '审核后的讲解正文');
  assert.equal(started.masteryChanged, false);
  const replay = await service.act(42, row.id, { clientRequestId: 'start-action-1', action: 'start' });
  assert.equal(replay.status, 'in_progress');
  assert.equal(updates, 1, 'replayed client request must not apply the transition twice');
  const disabledService = new AgentInterventionDeliveryService(prisma, rolloutFlags(false), { resolvePublishedForTopic: async () => null });
  const completed = await disabledService.act(42, row.id, { clientRequestId: 'complete-after-disable-1', action: 'complete' });
  assert.equal(completed.status, 'completed', 'an in-progress lesson remains finishable after new offers are disabled');
  await assert.rejects(() => service.act(7, row.id, { clientRequestId: 'other-user-1', action: 'complete' }), /学习讲解建议不存在/);
}

async function testNonAllowlistedUserIsSuppressed() {
  let created = false;
  let rolloutEvent;
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    learningInterventionDelivery: { findFirst: async () => null, create: async () => { created = true; } },
    learningIntervention: { findMany: async () => [proposal()] },
    cscaTrainingEvent: {
      findFirst: async () => null,
      create: async ({ data }) => { rolloutEvent = data; return data; }
    }
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(true, false), { resolvePublishedForTopic: async () => null });
  const result = await service.offer(42, { clientRequestId: 'not-allowlisted-1', context: 'after_round' });
  assert.equal(result.item, null);
  assert.equal(result.suppressedReason, 'ROLLOUT_NOT_ELIGIBLE');
  assert.equal(created, false, 'An excluded learner must not receive a delivery row.');
  assert.equal(rolloutEvent.eventType, 'learning_intervention_rollout_decision');
  assert.equal(rolloutEvent.metadata.eligible, false);
  assert.deepEqual(rolloutEvent.metadata.reasonCodes, ['USER_NOT_INTERNAL']);
}

async function testRemovedLearnerCannotStartOfferedDelivery() {
  let updates = 0;
  const existing = deliveryRow();
  const prisma = {
    mockExamAttempt: { findFirst: async () => null },
    learningInterventionStep: { findUnique: async () => null },
    learningInterventionDelivery: {
      findFirst: async () => existing,
      updateMany: async () => { updates += 1; return { count: 1 }; }
    }
  };
  topicDb(prisma);
  const service = new AgentInterventionDeliveryService(prisma, rolloutFlags(true, false), { resolvePublishedForTopic: async () => null });
  await assert.rejects(
    () => service.act(42, existing.id, { clientRequestId: 'removed-user-start-1', action: 'start' }),
    (error) => error?.response?.code === 'LEARNING_INTERVENTION_ROLLOUT_NOT_ELIGIBLE'
  );
  assert.equal(updates, 0, 'An excluded learner must not transition an offered delivery to in-progress.');
}

function testIsolationGuard() {
  const source = readFileSync(require.resolve('../dist/backend/src/agent/agent-intervention-delivery.service'), 'utf8');
  assert.doesNotMatch(source, /aiGateway|generateQuestion|userCscaTopicStateV2\.(update|upsert)|mastery\s*:/i);
}

async function main() {
  await testReviewedOfferAndContentGate();
  await testMissingContentAndFormalMockSuppression();
  await testPlaceholderContentIsNeverDelivered();
  await testExistingPlaceholderDeliveryIsSuppressed();
  await testActionsAreOwnedAndIdempotent();
  await testNonAllowlistedUserIsSuppressed();
  await testRemovedLearnerCannotStartOfferedDelivery();
  testIsolationGuard();
  console.log('LEARNING_INTERVENTION_DELIVERY_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
