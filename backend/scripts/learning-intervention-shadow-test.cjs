const assert = require('node:assert/strict');
const { decideLearningIntervention, LEARNING_INTERVENTION_POLICY_VERSION } = require('../dist/backend/src/learning-intelligence/intervention/learning-intervention-policy');
const { LearningInterventionShadowService } = require('../dist/backend/src/learning-intelligence/intervention/learning-intervention-shadow.service');

function signal(index, outcome, extra = {}) {
  return { eventId: `event-${index}`, outcome, usedHint: false, usedExplanation: false, sourceType: 'adaptive', quality: .9, occurredAt: new Date(`2026-09-13T0${index}:00:00Z`), ...extra };
}

function input(overrides = {}) {
  return { topicId: 11, stateVersion: 'state-5', mastery: .42, confidence: .7, independence: .5, retention: .6, transfer: .5, evidenceCount: 5, incorrectCount: 2, recentEvidence: [signal(5, 'incorrect'), signal(4, 'incorrect'), signal(3, 'correct')], ...overrides };
}

function testPolicy() {
  const repeated = decideLearningIntervention(input());
  assert.equal(repeated.action, 'offer_micro_lesson');
  assert.deepEqual(repeated.triggerCodes, ['MISCONCEPTION_REPEATED']);
  assert.equal(repeated.contentPlan.verificationRequired, true);
  assert.deepEqual(decideLearningIntervention(input()), repeated, 'same versioned input must replay deterministically');

  const insufficient = decideLearningIntervention(input({ evidenceCount: 1, confidence: .2, recentEvidence: [signal(1, 'incorrect')] }));
  assert.equal(insufficient.action, 'continue_practice');
  assert.deepEqual(insufficient.triggerCodes, ['EVIDENCE_INSUFFICIENT']);

  const assisted = decideLearningIntervention(input({ mastery: .7, incorrectCount: 0, recentEvidence: [signal(5, 'correct', { usedHint: true }), signal(4, 'correct', { usedExplanation: true }), signal(3, 'correct')] }));
  assert.deepEqual(assisted.triggerCodes, ['ASSISTANCE_DEPENDENCE']);

  const retention = decideLearningIntervention(input({ mastery: .7, independence: .8, retention: .3, incorrectCount: 0, recentEvidence: [signal(5, 'correct'), signal(4, 'correct'), signal(3, 'correct')] }));
  assert.equal(retention.action, 'schedule_review');
}

async function testServiceSuppressionAndIdempotency() {
  const now = new Date('2026-09-13T12:00:00Z');
  const saved = new Map();
  let creates = 0;
  let activeMock = { id: 99 };
  let recentInterventions = [];
  const state = { topicId: 11, stateVersion: 'state-5', mastery: .4, confidence: .7, independence: .45, retention: .6, transfer: .4, evidenceCount: 5, misconceptionState: { incorrectCount: 3 }, lastEvidenceAt: now };
  const evidence = [signal(5, 'incorrect'), signal(4, 'incorrect'), signal(3, 'correct')].map((item, index) => ({ ...item, eventSequence: BigInt(5 - index), subjectCode: 'math', topicEvidence: [{ topicId: 11, weight: 1 }], retraction: null, questionQualityConfidence: item.quality }));
  const prisma = {
    learningStateProjectionCheckpoint: { findUnique: async () => ({ lastEventSequence: 5n }) },
    userCscaTopicStateV2: { findMany: async ({ where }) => { assert.equal(where.userId, 42); return [state]; } },
    learningEvidenceEvent: { findMany: async ({ where }) => { assert.equal(where.userId, 42); assert.equal(where.eventSequence.lte, 5n); return evidence; } },
    learningIntervention: {
      findMany: async () => recentInterventions,
      upsert: async ({ where, create }) => {
        if (saved.has(where.decisionKey)) return saved.get(where.decisionKey);
        const row = { id: `decision-${++creates}`, createdAt: now, ...create }; saved.set(where.decisionKey, row); return row;
      }
    },
    mockExamAttempt: { findFirst: async ({ where }) => { assert.equal(where.submittedAt, null); return activeMock; } }
  };
  const flags = { isEnabled: (name) => name === 'interventionShadow' };
  const service = new LearningInterventionShadowService(prisma, flags);
  const first = await service.evaluateUserSubject(42, 'math', now);
  assert.equal(first.suppressed, 1);
  assert.deepEqual(first.items[0].suppressionCodes, ['FORMAL_MOCK_ACTIVE']);
  assert.equal(first.items[0].inputSnapshot.studentVisible, false);
  assert.equal(first.items[0].inputSnapshot.automaticQuestionGenerationInvoked, false);
  const replay = await service.evaluateUserSubject(42, 'math', now);
  assert.equal(replay.items[0].id, first.items[0].id);
  assert.equal(creates, 1, 'same state version must not create duplicate decisions');
  assert.equal(first.items[0].policyVersion, LEARNING_INTERVENTION_POLICY_VERSION);

  activeMock = null;
  const eligibleAfterMock = await service.evaluateUserSubject(42, 'math', now);
  assert.equal(eligibleAfterMock.items[0].status, 'shadow_proposed', 'a time-based suppression ending must make the same state eligible');
  assert.equal(creates, 2);

  state.stateVersion = 'state-6';
  recentInterventions = [{ id: 'prior', topicId: 11, status: 'shadow_proposed', createdAt: new Date(now.getTime() - 60 * 60 * 1000) }];
  const cooldown = await service.evaluateUserSubject(42, 'math', now);
  assert.deepEqual(cooldown.items[0].suppressionCodes, ['COOLDOWN_ACTIVE']);

  state.stateVersion = 'state-7';
  recentInterventions = [1, 2, 3].map((id) => ({ id: `prior-${id}`, topicId: 20 + id, status: 'shadow_proposed', createdAt: new Date(now.getTime() - 60 * 60 * 1000) }));
  const limited = await service.evaluateUserSubject(42, 'math', now);
  assert.deepEqual(limited.items[0].suppressionCodes, ['DAILY_LIMIT_REACHED']);
}

async function main() {
  testPolicy();
  await testServiceSuppressionAndIdempotency();
  console.log('LEARNING_INTERVENTION_SHADOW_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
