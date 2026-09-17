const assert = require('node:assert/strict');
const { buildScorePredictionCalibrationDataset } = require('../dist/backend/src/learning-intelligence/calibration/score-prediction-calibration-dataset');
const { ScorePredictionCalibrationDatasetService } = require('../dist/backend/src/learning-intelligence/calibration/score-prediction-calibration-dataset.service');

const h = (char) => char.repeat(64);
function prediction(runId, learnerKeyHash, predictionAt) {
  return { runId, learnerKeyHash, predictionAt, evidenceCutoffAt: predictionAt,
    targetScore: 75, scoreMinimum: 0, scoreMaximum: 100,
    baseline: { scoreBand: { low: 55, central: 70, high: 85 }, targetAttainmentProbability: .4 },
    candidate: { scoreBand: { low: 62, central: 74, high: 86 }, targetAttainmentProbability: .48 } };
}
function outcome(outcomeId, learnerKeyHash, outcomeAt, normalizedScore = .78) {
  return { outcomeId, learnerKeyHash, outcomeAt, normalizedScore, stratum: 'language:zh' };
}
const input = {
  examSystemCode: 'csca', subjectCode: 'chemistry', scoringPolicyVersion: 'policy-v1',
  itemCalibrationVersion: 'items-v1', learnerKeyVersion: 'local-v1', temporalCutoffDate: '2026-09-01',
  predictions: [
    prediction('run-cal', h('a'), '2026-07-01T00:00:00.000Z'),
    prediction('run-h1', h('b'), '2026-09-02T00:00:00.000Z'),
    prediction('run-h2', h('c'), '2026-09-03T00:00:00.000Z'),
    prediction('run-leak', h('d'), '2026-07-01T00:00:00.000Z')
  ],
  outcomes: [
    outcome('out-cal', h('a'), '2026-07-10T00:00:00.000Z'),
    outcome('out-h1', h('b'), '2026-09-11T00:00:00.000Z'),
    outcome('out-h2', h('c'), '2026-09-12T00:00:00.000Z', .8),
    outcome('out-leak-cal', h('d'), '2026-07-10T00:00:00.000Z'),
    outcome('out-leak-holdout', h('d'), '2026-09-10T00:00:00.000Z')
  ]
};
const thresholds = { minimumCalibrationLearners: 1, minimumHoldoutLearners: 2,
  minimumOutcomeHorizonDays: 7, maximumOutcomeHorizonDays: 90 };
const built = buildScorePredictionCalibrationDataset(input, thresholds);
assert.equal(built.status, 'ready_for_snapshot_build');
assert.equal(built.counts.calibrationLearnerCount, 1);
assert.equal(built.counts.holdoutLearnerCount, 2);
assert.equal(built.counts.excludedCrossSplitLearnerCount, 1);
assert.equal(built.forecastCalibrationInput.rows.length, 2);
assert.equal(built.forecastCalibrationInput.baselineMetrics.normalizedMae, .09);
assert.ok(built.reasonCodes.includes('TIMED_MOCK_PROXY_OUTCOME_ONLY'));
assert.ok(built.reasonCodes.includes('STUDENT_NUMERIC_RELEASE_DISABLED'));
const replay = buildScorePredictionCalibrationDataset({ ...input,
  predictions: [...input.predictions].reverse(), outcomes: [...input.outcomes].reverse() }, thresholds);
assert.equal(replay.sourceDatasetHash, built.sourceDatasetHash, 'input order must not alter dataset hash');
assert.deepEqual(replay.forecastCalibrationInput, built.forecastCalibrationInput);

const empty = buildScorePredictionCalibrationDataset({ ...input, predictions: [], outcomes: [] });
assert.equal(empty.status, 'blocked');
assert.equal(empty.forecastCalibrationInput, null);
assert.ok(empty.reasonCodes.includes('HOLDOUT_LEARNERS_INSUFFICIENT'));

async function adapterTest() {
  const feature = { schemaVersion: '1', userId: 9, goalId: 'goal-1', subjectCode: 'chemistry', targetScore: 75,
    scoreMinimum: 0, scoreMaximum: 100, evaluationDate: '2026-09-01', evidenceCutoffAt: '2026-09-01T10:00:00.000Z',
    scoringPolicyVersion: 'policy-v1', itemCalibrationVersion: 'items-v1', modelingPrerequisiteStatus: 'qualified',
    modelingPrerequisiteReasonCodes: [], topicStateCount: 5, independentEvidenceCount: 40,
    averageStateConfidence: .8, maximumStateAgeDays: 2, timedMockCount: 1, latestTimedMockAgeDays: 2,
    latestTimedMockScoreNormalized: .7, mastery: .7, coverage: .8, independence: .7, retention: .7,
    fluency: .7, transfer: .7, consistency: .7,
    sourceVersions: { learningModelVersion: 'ls-v1-shadow-model-1', learningStateVersionHash: h('a'),
      evidenceVersionHash: h('b'), mockVersionHash: h('c'), scoringPolicySourceHash: h('d'),
      itemCalibrationArtifactHash: h('e') } };
  const output = { method: 'test', scoreBand: { low: 60, central: 72, high: 84 }, targetAttainmentProbability: .45 };
  const prisma = {
    scorePredictionShadowRun: { async findMany() { return [{ id: 'run-1', userId: 9,
      featureSnapshot: feature, baselineOutput: output, candidateOutput: output }]; } },
    mockExamAttempt: { async findMany() { return [{ id: 3, userId: 9, correctCount: 38, wrongCount: 8,
      unansweredCount: 2, startedAt: new Date('2026-09-10T08:00:00.000Z'),
      submittedAt: new Date('2026-09-10T10:00:00.000Z'),
      paper: { subject: 'chemistry', language: 'zh', durationMinutes: 120 } }]; } }
  };
  const flags = { isEnabled() { return true; } };
  const request = { scoringPolicyVersion: 'policy-v1', itemCalibrationVersion: 'items-v1',
    temporalCutoffDate: '2026-09-05', dataWindowStart: '2026-08-01', dataWindowEnd: '2026-09-30' };
  const missingSalt = await new ScorePredictionCalibrationDatasetService(prisma, flags, {}).export(request);
  assert.equal(missingSalt.status, 'preflight_blocked');
  const exported = await new ScorePredictionCalibrationDatasetService(prisma, flags, {
    CSCA_FORECAST_CALIBRATION_LEARNER_SALT: 's'.repeat(32),
    CSCA_FORECAST_CALIBRATION_LEARNER_SALT_VERSION: 'local-v1'
  }).export(request);
  assert.equal(exported.status, 'blocked');
  assert.equal(exported.counts.predictionCount, 1);
  assert.equal(exported.counts.outcomeCount, 1);
  assert.equal(exported.counts.holdoutLearnerCount, 1);
  assert.equal(exported.forecastCalibrationInput, null);
}

adapterTest().then(() => console.log('SCORE_PREDICTION_CALIBRATION_DATASET_OK'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
