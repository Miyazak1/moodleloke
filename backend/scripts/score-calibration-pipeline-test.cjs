const assert = require('node:assert/strict');
const {
  buildItemCalibrationArtifact,
  buildForecastCalibrationArtifact
} = require('../dist/backend/src/learning-intelligence/calibration/score-calibration-engine');

const hash = (character) => character.repeat(64);
const itemThresholds = {
  minimumSampleCount: 8, minimumHoldoutSampleCount: 4, minimumItemCount: 2,
  minimumObservationsPerItem: 4, minimumMedianDiscrimination: -1,
  maximumLowDiscriminationShare: 1, maximumMeanDifficultyDrift: 1
};
const forecastThresholds = {
  minimumHoldoutSampleCount: 4, minimumSubgroupSampleCount: 2,
  nominalIntervalCoverage: 1, intervalCoverageTolerance: 0,
  maximumNormalizedMae: 0.2, maximumExpectedCalibrationError: 0.3,
  maximumSubgroupNormalizedMae: 0.2, maximumSubgroupCalibrationError: 0.4,
  maximumMaeDrift: 0.1, maximumCalibrationErrorDrift: 0.2
};

function itemInput() {
  const observations = [];
  const outcomes = [[true, true], [false, true], [true, false], [false, false]];
  outcomes.forEach((learnerOutcomes, learnerIndex) => {
    learnerOutcomes.forEach((correct, itemIndex) => observations.push({
      observationId: `obs-${learnerIndex}-${itemIndex}`,
      learnerKeyHash: hash(String(learnerIndex + 1)),
      itemId: `item-${itemIndex + 1}`,
      split: learnerIndex < 2 ? 'calibration' : 'holdout',
      outcome: correct ? 'correct' : 'incorrect',
      sourceType: learnerIndex % 2 ? 'mock_exam' : 'diagnostic',
      exposureState: 'prompt_seen', firstAttempt: true, usedHint: false,
      usedExplanation: false, questionQualityConfidence: 0.95
    }));
  });
  return {
    calibrationVersion: 'item-cal-v1', examSystemCode: 'csca', subjectCode: 'chemistry',
    itemBankVersion: 'bank-v1', dataWindowStart: '2026-01-01T00:00:00.000Z',
    dataWindowEnd: '2026-06-30T00:00:00.000Z', sourceDatasetHash: hash('a'), observations
  };
}

function forecastInput() {
  const actuals = [80, 60, 90, 70];
  return {
    calibrationVersion: 'forecast-cal-v1', examSystemCode: 'csca', subjectCode: 'chemistry',
    languageCode: 'zh', examFormCode: 'form-a', forecastModelVersion: 'forecast-v2',
    scoringPolicyVersion: 'score-v1', itemCalibrationVersion: 'item-cal-v1',
    outcomeSource: 'verified_csca_exam',
    scoreMinimum: 0, scoreMaximum: 100, dataWindowStart: '2026-01-01T00:00:00.000Z',
    dataWindowEnd: '2026-06-30T00:00:00.000Z', sourceDatasetHash: hash('b'),
    baselineMetrics: { normalizedMae: 0.05, expectedCalibrationError: 0.15 },
    rows: actuals.map((actualScore, index) => ({
      rowId: `row-${index}`, learnerKeyHash: hash(String(index + 5)), split: 'holdout',
      actualScore, predictedLow: actualScore - 5, predictedCentral: actualScore - 2,
      predictedHigh: actualScore + 5, targetScore: 75,
      predictedAttainmentProbability: actualScore >= 75 ? 0.8 : 0.2,
      targetAttained: actualScore >= 75, stratum: index < 2 ? 'zh-form-a' : 'en-form-b'
    }))
  };
}

function main() {
  const item = itemInput();
  const itemArtifact = buildItemCalibrationArtifact(item, itemThresholds);
  assert.equal(itemArtifact.allCriteriaPassed, true);
  assert.equal(buildItemCalibrationArtifact(item).allCriteriaPassed, false, 'small fixtures must fail production thresholds');
  assert.equal(itemArtifact.metrics.splitLeakageLearnerCount, 0);
  assert.equal(itemArtifact.artifactHash,
    buildItemCalibrationArtifact({ ...item, observations: [...item.observations].reverse() }, itemThresholds).artifactHash,
    'artifact hash must not depend on ingestion order');

  const leaked = itemInput();
  leaked.observations.find((row) => row.split === 'holdout').learnerKeyHash = hash('1');
  const leakedArtifact = buildItemCalibrationArtifact(leaked, itemThresholds);
  assert.equal(leakedArtifact.criteriaResults.learnerSplitIsolation, false);
  assert.equal(leakedArtifact.allCriteriaPassed, false);

  assert.throws(() => buildItemCalibrationArtifact({
    ...item, observations: item.observations.map((row, index) => index ? row : { ...row, usedHint: true })
  }, itemThresholds), /Invalid input/);

  const forecast = forecastInput();
  const forecastArtifact = buildForecastCalibrationArtifact(forecast, forecastThresholds);
  assert.equal(forecastArtifact.allCriteriaPassed, true);
  assert.equal(buildForecastCalibrationArtifact(forecast).allCriteriaPassed, false, 'small fixtures must fail production thresholds');
  assert.equal(forecastArtifact.metrics.intervalCoverage, 1);
  assert.equal(forecastArtifact.artifactHash,
    buildForecastCalibrationArtifact({ ...forecast, rows: [...forecast.rows].reverse() }, forecastThresholds).artifactHash);

  const noBaseline = buildForecastCalibrationArtifact({ ...forecast, baselineMetrics: null }, forecastThresholds);
  assert.equal(noBaseline.criteriaResults.baselinePresent, false);
  assert.equal(noBaseline.allCriteriaPassed, false);

  const proxyOutcome = buildForecastCalibrationArtifact({ ...forecast, outcomeSource: 'timed_mock_proxy' }, forecastThresholds);
  assert.equal(proxyOutcome.criteriaResults.verifiedOutcomeSource, false);
  assert.equal(proxyOutcome.allCriteriaPassed, false, 'timed mock proxy outcomes can never qualify a release artifact');

  assert.throws(() => buildForecastCalibrationArtifact({
    ...forecast,
    rows: forecast.rows.map((row, index) => index ? row : { ...row, targetAttained: !row.targetAttained })
  }, forecastThresholds), /Attainment label contradicts/);

  console.log('SCORE_CALIBRATION_PIPELINE_OK');
}

main();
