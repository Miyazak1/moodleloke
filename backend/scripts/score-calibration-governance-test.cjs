const assert = require('node:assert/strict');
const { ScoreCalibrationGovernanceService } = require('../dist/backend/src/learning-intelligence/readiness/score-calibration-governance.service');

const at = new Date('2026-09-14T10:00:00.000Z');
const baseInput = {
  examSystemCode: 'csca', subjectCode: 'chemistry', scoringPolicyVersion: 'csca-score-2026-v1',
  itemCalibrationVersion: 'chem-bank-2026-v1', forecastModelVersion: 'readiness-model-v2'
};

function store(overrides = {}) {
  const policy = {
    id: 'policy-1', examSystemCode: 'csca', policyVersion: 'csca-score-2026-v1', status: 'active',
    sourceType: 'official', sourceUrl: 'https://official.example/scoring', sourceSnapshotHash: 'a'.repeat(64),
    reviewedByUserId: 7, reviewedAt: at, activatedAt: at,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), effectiveTo: null, updatedAt: at
  };
  const item = {
    id: 'item-cal-1', examSystemCode: 'csca', subjectCode: 'chemistry',
    calibrationVersion: 'chem-bank-2026-v1', status: 'qualified', allCriteriaPassed: true,
    artifactHash: 'b'.repeat(64), reviewedByUserId: 7, reviewedAt: at, qualifiedAt: at, createdAt: at
  };
  const forecast = {
    id: 'forecast-cal-1', calibrationVersion: 'readiness-cal-v1', status: 'qualified',
    allCriteriaPassed: true, artifactHash: 'c'.repeat(64), outcomeSource: 'verified_csca_exam', reviewedByUserId: 7,
    reviewedAt: at, qualifiedAt: at, createdAt: at
  };
  return {
    examScoringPolicy: { async findUnique() { return overrides.policy === undefined ? policy : overrides.policy; } },
    itemCalibrationSnapshot: { async findUnique() { return overrides.item === undefined ? item : overrides.item; } },
    forecastCalibrationSnapshot: { async findFirst(args) {
      assert.deepEqual(args.where, { ...baseInput, status: 'qualified' });
      return overrides.forecast === undefined ? forecast : overrides.forecast;
    } }
  };
}

async function main() {
  const qualifiedService = new ScoreCalibrationGovernanceService(store());
  const modeling = await qualifiedService.evaluateModelingPrerequisites(baseInput, undefined, at);
  assert.equal(modeling.status, 'qualified');
  assert.deepEqual(modeling.reasonCodes, []);
  assert.equal(modeling.prerequisiteVersionHash.length, 64);
  const laterSameEvidence = await qualifiedService.evaluate(baseInput, undefined, new Date('2026-09-14T18:00:00.000Z'));
  const qualified = await qualifiedService.evaluate(baseInput, undefined, at);
  assert.equal(qualified.status, 'shadow_qualified');
  assert.equal(qualified.numericForecastRelease, 'disabled');
  assert.deepEqual(qualified.reasonCodes, ['NUMERIC_FORECAST_RELEASE_DISABLED']);
  assert.equal(qualified.gateVersionHash.length, 64);
  assert.deepEqual(qualified, await qualifiedService.evaluate(baseInput, undefined, at), 'same evidence must hash deterministically');
  assert.equal(qualified.gateVersionHash, laterSameEvidence.gateVersionHash, 'query time must not alter the gate hash');

  const uncalibratedRelease = await new ScoreCalibrationGovernanceService(store({ forecast: null }))
    .evaluate(baseInput, undefined, at);
  assert.equal(uncalibratedRelease.status, 'blocked');
  assert.equal((await new ScoreCalibrationGovernanceService(store({ forecast: null }))
    .evaluateModelingPrerequisites(baseInput, undefined, at)).status, 'qualified',
  'forecast calibration must not circularly block shadow model execution');

  const proxyForecast = await new ScoreCalibrationGovernanceService(store({ forecast: {
    id: 'forecast-proxy', calibrationVersion: 'proxy-v1', status: 'qualified', allCriteriaPassed: true,
    artifactHash: 'c'.repeat(64), outcomeSource: 'timed_mock_proxy', reviewedByUserId: 7,
    reviewedAt: at, qualifiedAt: at, createdAt: at
  } })).evaluate(baseInput, undefined, at);
  assert.equal(proxyForecast.status, 'blocked');
  assert.ok(proxyForecast.reasonCodes.includes('FORECAST_CALIBRATION_NOT_QUALIFIED'));

  const blocked = await new ScoreCalibrationGovernanceService(store({ policy: null, item: null, forecast: null }))
    .evaluate(baseInput, undefined, at);
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasonCodes.includes('SCORING_POLICY_NOT_REGISTERED'));
  assert.ok(blocked.reasonCodes.includes('ITEM_CALIBRATION_NOT_REGISTERED'));
  assert.ok(blocked.reasonCodes.includes('FORECAST_MODEL_NOT_CALIBRATED'));

  const unreviewed = await new ScoreCalibrationGovernanceService(store({
    policy: { id: 'policy-1', examSystemCode: 'csca', policyVersion: baseInput.scoringPolicyVersion,
      status: 'reviewed', sourceType: 'provisional', sourceUrl: null, sourceSnapshotHash: 'x',
      reviewedByUserId: null, reviewedAt: null, activatedAt: null,
      effectiveFrom: null, effectiveTo: null, updatedAt: at }
  })).evaluate(baseInput, undefined, at);
  assert.equal(unreviewed.status, 'blocked');
  assert.ok(unreviewed.reasonCodes.includes('SCORING_POLICY_UNVERIFIED'));

  console.log('SCORE_CALIBRATION_GOVERNANCE_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
