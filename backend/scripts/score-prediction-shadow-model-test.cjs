const assert = require('node:assert/strict');
const { runChemistryScorePredictionShadow } = require('../dist/backend/src/learning-intelligence/readiness/score-prediction-shadow.model');

const base = {
  schemaVersion: '1', userId: 9, goalId: 'goal-1', subjectCode: 'chemistry', targetScore: 80,
  scoreMinimum: 0, scoreMaximum: 100, evaluationDate: '2026-09-14',
  evidenceCutoffAt: '2026-09-13T10:00:00.000Z', scoringPolicyVersion: 'policy-v1',
  itemCalibrationVersion: 'items-v1', modelingPrerequisiteStatus: 'qualified',
  modelingPrerequisiteReasonCodes: [],
  topicStateCount: 8, independentEvidenceCount: 40, averageStateConfidence: 0.8,
  maximumStateAgeDays: 3, timedMockCount: 2, latestTimedMockAgeDays: 5,
  latestTimedMockScoreNormalized: 0.72, mastery: 0.7, coverage: 0.8, independence: 0.75,
  retention: 0.68, fluency: 0.64, transfer: 0.66, consistency: 0.7,
  sourceVersions: { learningModelVersion: 'ls-v1', learningStateVersionHash: 'a'.repeat(64),
    evidenceVersionHash: 'b'.repeat(64), mockVersionHash: 'c'.repeat(64),
    scoringPolicySourceHash: 'd'.repeat(64), itemCalibrationArtifactHash: 'e'.repeat(64) }
};

const first = runChemistryScorePredictionShadow(base);
const replay = runChemistryScorePredictionShadow(base);
assert.deepEqual(first, replay, 'identical versioned evidence must replay identically');
assert.equal(first.status, 'computed');
assert.equal(first.candidateOutput.method, 'interpretable_weighted_scorecard');
assert.ok(first.reasonCodes.includes('MODEL_UNCALIBRATED'));
assert.ok(first.reasonCodes.includes('NUMERIC_FORECAST_RELEASE_DISABLED'));

const stronger = runChemistryScorePredictionShadow({ ...base, mastery: 0.9 });
assert.ok(stronger.candidateOutput.scoreBand.central >= first.candidateOutput.scoreBand.central);
assert.ok(stronger.candidateOutput.targetAttainmentProbability >= first.candidateOutput.targetAttainmentProbability);

const noMock = runChemistryScorePredictionShadow({ ...base, timedMockCount: 0,
  latestTimedMockAgeDays: null, latestTimedMockScoreNormalized: null });
assert.equal(noMock.status, 'blocked');
assert.equal(noMock.candidateOutput, null);
assert.ok(noMock.reasonCodes.includes('TIMED_MOCK_MISSING'));

const noGovernance = runChemistryScorePredictionShadow({ ...base, modelingPrerequisiteStatus: 'blocked' });
assert.equal(noGovernance.status, 'blocked');
assert.ok(noGovernance.reasonCodes.includes('MODELING_PREREQUISITES_BLOCKED'));
console.log('SCORE_PREDICTION_SHADOW_MODEL_OK');
