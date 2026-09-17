const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { ScoreCalibrationAdminService } = require('../dist/backend/src/score-calibration/score-calibration-admin.service');
const { buildForecastCalibrationArtifact } = require('../dist/backend/src/learning-intelligence/calibration/score-calibration-engine');

function store() {
  const policies = new Map();
  const items = new Map();
  const forecasts = new Map();
  const manifests = new Map();
  const events = [];
  let sequence = 0;
  const db = {
    events,
    policies,
    items,
    forecasts,
    manifests,
    async $transaction(work) { return work(db); },
    examScoringPolicy: {
      async create({ data }) {
        const row = { id: `policy-${++sequence}`, status: 'draft', reviewedByUserId: null,
          reviewedAt: null, activatedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        policies.set(row.id, row);
        return { ...row };
      },
      async findUnique({ where }) {
        if (where.id) return policies.get(where.id) ? { ...policies.get(where.id) } : null;
        return [...policies.values()].find((row) => row.policyVersion === where.policyVersion) ?? null;
      },
      async findFirst({ where }) {
        return [...policies.values()].find((row) => row.examSystemCode === where.examSystemCode
          && row.status === where.status && row.id !== where.id?.not) ?? null;
      },
      async update({ where, data }) {
        const row = { ...policies.get(where.id), ...data, updatedAt: new Date() };
        policies.set(where.id, row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const row = policies.get(where.id);
        if (!row || (where.status && row.status !== where.status)) return { count: 0 };
        policies.set(where.id, { ...row, ...data, updatedAt: new Date() });
        return { count: 1 };
      }
    },
    scoreCalibrationGovernanceEvent: {
      async create({ data }) { const row = { id: `event-${events.length + 1}`, ...data }; events.push(row); return row; }
    },
    itemCalibrationSnapshot: {
      async findUnique({ where }) {
        if (where.id) return items.get(where.id) ? { ...items.get(where.id) } : null;
        return [...items.values()].find((row) => row.calibrationVersion === where.calibrationVersion) ?? null;
      },
      async update({ where, data }) {
        const row = { ...items.get(where.id), ...data };
        items.set(where.id, row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const row = items.get(where.id);
        if (!row || (where.status && row.status !== where.status)) return { count: 0 };
        items.set(where.id, { ...row, ...data });
        return { count: 1 };
      }
    },
    forecastCalibrationSnapshot: {
      async findUnique({ where }) { return forecasts.get(where.id) ? { ...forecasts.get(where.id) } : null; },
      async update({ where, data }) {
        const row = { ...forecasts.get(where.id), ...data };
        forecasts.set(where.id, row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const row = forecasts.get(where.id);
        if (!row || (where.status && row.status !== where.status)) return { count: 0 };
        forecasts.set(where.id, { ...row, ...data });
        return { count: 1 };
      }
    },
    forecastCalibrationDatasetManifest: {
      async findUnique({ where }) { return manifests.get(where.id) ? { ...manifests.get(where.id) } : null; }
    }
  };
  return db;
}

async function main() {
  const db = store();
  const service = new ScoreCalibrationAdminService(db, { evaluate() { throw new Error('not used'); } });
  const policy = await service.createPolicy({
    examSystemCode: 'csca', policyVersion: 'score-v1', sourceType: 'official',
    sourceTitle: 'Official scoring policy', sourceUrl: 'https://official.example/scoring',
    sourcePublishedAt: '2026-01-01', sourceSnapshotHash: 'a'.repeat(64),
    scoreScale: { minimum: 0, maximum: 100 }, scoringRules: { method: 'raw' },
    effectiveFrom: '2026-01-01', effectiveTo: null, supersedesPolicyId: null
  }, 10);
  await assert.rejects(() => service.reviewPolicy(policy.id, 'Creator attempted review.', 10), ConflictException);
  const reviewed = await service.reviewPolicy(policy.id, 'Independent source review passed.', 11);
  assert.equal(reviewed.status, 'reviewed');
  const active = await service.activatePolicy(policy.id, 'Approved for shadow calibration use.', 11);
  assert.equal(active.status, 'active');

  db.items.set('item-1', {
    id: 'item-1', calibrationVersion: 'item-cal-v1', examSystemCode: 'csca', subjectCode: 'chemistry',
    status: 'reviewed', allCriteriaPassed: true,
    reviewedByUserId: 11, artifactHash: 'b'.repeat(64)
  });
  const qualifiedItem = await service.qualifySnapshot('item', 'item-1', 'Qualified after independent item review.', 12);
  assert.equal(qualifiedItem.status, 'qualified');
  const forecastInput = {
    calibrationVersion: 'forecast-build-v1', examSystemCode: 'csca', subjectCode: 'chemistry',
    languageCode: null, examFormCode: null, forecastModelVersion: 'model-v1',
    scoringPolicyVersion: 'score-v1', itemCalibrationVersion: 'item-cal-v1',
    outcomeSource: 'verified_csca_exam', scoreMinimum: 0, scoreMaximum: 100,
    dataWindowStart: '2026-01-01T00:00:00.000Z', dataWindowEnd: '2026-09-01T00:00:00.000Z',
    sourceDatasetHash: 'f'.repeat(64), baselineMetrics: null,
    rows: [{ rowId: 'row-1', learnerKeyHash: 'e'.repeat(64), split: 'holdout', actualScore: 80,
      predictedLow: 65, predictedCentral: 78, predictedHigh: 90, targetScore: 75,
      predictedAttainmentProbability: .7, targetAttained: true, stratum: 'form:main' }]
  };
  db.manifests.set('manifest-build', { id: 'manifest-build', status: 'active', outcomeSource: 'verified_csca_exam',
    sourceDatasetHash: forecastInput.sourceDatasetHash,
    forecastArtifactHash: buildForecastCalibrationArtifact(forecastInput).artifactHash,
    examSystemCode: 'csca', subjectCode: 'chemistry', scoringPolicyVersion: 'score-v1', itemCalibrationVersion: 'item-cal-v1' });
  await assert.rejects(() => service.buildForecastSnapshot({ ...forecastInput, datasetManifestId: 'manifest-build',
    rows: [{ ...forecastInput.rows[0], predictedCentral: 79 }] }, 12), ConflictException,
  'a client-modified row must not pass a valid manifest');
  db.forecasts.set('forecast-1', {
    id: 'forecast-1', status: 'reviewed', allCriteriaPassed: true, reviewedByUserId: 11,
    outcomeSource: 'verified_csca_exam', datasetManifestId: 'manifest-1',
    examSystemCode: 'csca', subjectCode: 'chemistry',
    scoringPolicyVersion: 'score-v1', itemCalibrationVersion: 'item-cal-v1', artifactHash: 'c'.repeat(64)
  });
  db.manifests.set('manifest-1', { id: 'manifest-1', status: 'active', outcomeSource: 'verified_csca_exam' });
  const qualifiedForecast = await service.qualifySnapshot('forecast', 'forecast-1', 'Qualified for shadow comparison only.', 12);
  assert.equal(qualifiedForecast.status, 'qualified');

  db.forecasts.set('forecast-proxy', {
    id: 'forecast-proxy', status: 'reviewed', allCriteriaPassed: true, reviewedByUserId: 11,
    outcomeSource: 'timed_mock_proxy', examSystemCode: 'csca', subjectCode: 'chemistry',
    scoringPolicyVersion: 'score-v1', itemCalibrationVersion: 'item-cal-v1', artifactHash: 'd'.repeat(64)
  });
  await assert.rejects(() => service.qualifySnapshot('forecast', 'forecast-proxy',
    'Proxy outcome must remain shadow only.', 12), ConflictException);

  const withdrawn = await service.withdrawPolicy(policy.id, 'Official policy source was withdrawn.', 12);
  assert.equal(withdrawn.status, 'withdrawn');
  assert.deepEqual(db.events.map((event) => event.action),
    ['created', 'reviewed', 'activated', 'qualified', 'qualified', 'withdrawn']);
  assert.ok(db.events.every((event) => event.actorUserId > 0 && event.reason.length >= 8));
  console.log('SCORE_CALIBRATION_ADMIN_WORKFLOW_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
