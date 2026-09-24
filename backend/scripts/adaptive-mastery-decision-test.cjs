const assert = require('node:assert/strict');
const { decideAdaptiveLearning } = require('../dist/backend/src/csca-special-practice/adaptive-learning-decision.policy');
const { decideWrongPatternVerification } = require('../dist/backend/src/csca-learning/wrong-pattern-verification.policy');

function topic(overrides = {}) {
  return {
    topicId: 47,
    code: 'inertia',
    title: '惯性',
    total: 3,
    correct: 3,
    unanswered: 0,
    independentCorrect: 3,
    assistedCorrect: 0,
    firstAttemptCount: 3,
    averageSeconds: 48,
    state: {
      source: 'learning_state_v2', mastery: .8, confidence: .7, independence: .8,
      retention: .7, fluency: .7, transfer: .65, consistency: .75, coverage: .7,
      evidenceCount: 6, stateVersion: 'state-6'
    },
    reviewPattern: null,
    ...overrides
  };
}

const stable = decideAdaptiveLearning({ subject: 'physics', adaptationPending: false, topics: [topic()] });
assert.equal(stable.status, 'verified_mastery');
assert.equal(stable.nextStep.type, 'broaden_coverage');
assert.equal(stable.generatedByAI, false);

const assisted = decideAdaptiveLearning({
  subject: 'physics', adaptationPending: false,
  topics: [topic({ independentCorrect: 1, assistedCorrect: 2 })]
});
assert.equal(assisted.status, 'needs_verification');
assert.match(assisted.topics[0].reasons.join(' '), /提示或解析/);

const wrong = decideAdaptiveLearning({
  subject: 'physics', adaptationPending: true,
  topics: [topic({
    correct: 1, independentCorrect: 1,
    reviewPattern: { id: 71, patternType: 'concept_gap', status: 'active', recurrenceCount: 3, nextReviewAt: null, consecutiveVerificationPassCount: 0 }
  })]
});
assert.equal(wrong.status, 'needs_review');
assert.equal(wrong.nextStep.reviewItemId, 71);
assert.equal(wrong.adaptationPending, true);

const firstAt = new Date('2026-09-22T08:00:00.000Z');
const firstPass = decideWrongPatternVerification({ passed: true, occurredAt: firstAt, metadata: {} });
assert.equal(firstPass.resolved, false, 'one pass must not equal stable mastery');
assert.equal(firstPass.consecutivePassCount, 1);
assert.equal(firstPass.nextReviewDelayDays, 3);

const immediateRepeat = decideWrongPatternVerification({
  passed: true,
  occurredAt: new Date('2026-09-22T09:00:00.000Z'),
  metadata: firstPass.metadata
});
assert.equal(immediateRepeat.resolved, false, 'same-day repetition must not satisfy delayed verification');
assert.equal(immediateRepeat.consecutivePassCount, 1);

const delayedPass = decideWrongPatternVerification({
  passed: true,
  occurredAt: new Date('2026-09-25T08:00:00.000Z'),
  metadata: firstPass.metadata
});
assert.equal(delayedPass.resolved, true);
assert.equal(delayedPass.consecutivePassCount, 2);

const failed = decideWrongPatternVerification({
  passed: false,
  occurredAt: new Date('2026-09-25T08:00:00.000Z'),
  metadata: firstPass.metadata
});
assert.equal(failed.resolved, false);
assert.equal(failed.consecutivePassCount, 0);
assert.equal(failed.nextReviewDelayDays, 2);

console.log('Adaptive mastery decision tests passed.');
