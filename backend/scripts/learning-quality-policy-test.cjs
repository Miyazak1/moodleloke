const assert = require('node:assert/strict');
const { buildLearningQualitySnapshot } = require('../dist/backend/src/agent/learning-quality.policy.js');

const base = {
  evidenceCount: 12, evidencedTopicCount: 4, totalTopicCount: 10,
  projectionPending: false, decisionAvailable: true,
  prescriptions: [{ prescriptionId: 'p1' }, { prescriptionId: 'p2' }],
  outcomes: [
    { prescriptionId: 'p1', decision: 'shown' },
    { prescriptionId: 'p1', decision: 'accepted' },
    { prescriptionId: 'p1', decision: 'completed', targetAccuracy: 100 },
    { prescriptionId: 'p2', decision: 'shown' }
  ],
  validations: [{ status: 'completed', result: 'stable' }, { status: 'completed', result: 'not_stable' }],
  contradictions: { strongWithActiveErrorCount: 0, weakWithStableValidationCount: 0 },
  supply: { status: 'sufficient', requestedCount: 5, availableCount: 8, teachingAssetCount: 1, conceptCardCount: 0, explainedQuestionCount: 1 }
};

const calibrated = buildLearningQualitySnapshot(base);
assert.equal(calibrated.status, 'calibrated');
assert.equal(calibrated.recommendationFunnel.followThroughRate, 50);
assert.equal(calibrated.recommendationFunnel.completionRate, 100);
assert.equal(calibrated.recommendationFunnel.positiveOutcomeRate, 100);

const cold = buildLearningQualitySnapshot({ ...base, evidenceCount: 0, evidencedTopicCount: 0, prescriptions: [], outcomes: [], validations: [] });
assert.equal(cold.status, 'cold_start');
assert.equal(cold.alerts[0].code, 'cold_start');

const shortage = buildLearningQualitySnapshot({ ...base, supply: { status: 'limited', requestedCount: 5, availableCount: 2 } });
assert.ok(shortage.alerts.some((item) => item.code === 'supply_gap'));
assert.ok(shortage.alerts.some((item) => item.code === 'teaching_content_gap'));

const contradiction = buildLearningQualitySnapshot({ ...base, contradictions: { strongWithActiveErrorCount: 1, weakWithStableValidationCount: 1 } });
assert.equal(contradiction.validation.contradictionCount, 2);
assert.ok(contradiction.alerts.some((item) => item.code === 'calibration_attention'));

const degraded = buildLearningQualitySnapshot({ ...base, decisionAvailable: false, projectionPending: true });
assert.ok(degraded.alerts.some((item) => item.code === 'decision_unavailable'));
assert.ok(degraded.alerts.some((item) => item.code === 'projection_pending'));

console.log('Learning quality policy tests passed.');
