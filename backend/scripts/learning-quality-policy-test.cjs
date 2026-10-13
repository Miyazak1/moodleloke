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
  dailyPlanExecutions: [
    { executionKey: '2026-10-12:task-1:artifact-1', completed: true, positive: true, entry: 'today_plan' },
    { executionKey: '2026-10-12:task-1:artifact-1', completed: true, positive: true, entry: 'today_plan' },
    { executionKey: '2026-10-12:task-2:artifact-2', completed: true, positive: false, entry: 'refreshed_next' },
    { executionKey: '2026-10-12:task-3:artifact-3', completed: false, positive: false, entry: 'today_plan' }
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
assert.equal(calibrated.dailyPlanExecution.startedCount, 3);
assert.equal(calibrated.dailyPlanExecution.completedCount, 2);
assert.equal(calibrated.dailyPlanExecution.positiveOutcomeCount, 1);
assert.equal(calibrated.dailyPlanExecution.refreshedNextStartedCount, 1);
assert.equal(calibrated.dailyPlanExecution.completionRate, 67);
assert.equal(calibrated.dailyPlanExecution.positiveOutcomeRate, 50);

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
