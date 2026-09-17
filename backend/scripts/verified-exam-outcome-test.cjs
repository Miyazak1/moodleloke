const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { buildScorePredictionCalibrationDataset } = require('../dist/backend/src/learning-intelligence/calibration/score-prediction-calibration-dataset');
const { StudentExamOutcomeService } = require('../dist/backend/src/score-calibration/student-exam-outcome.service');
const { VerifiedExamCalibrationDatasetService } = require('../dist/backend/src/score-calibration/verified-exam-calibration-dataset.service');

const key = (char) => char.repeat(64);
const prediction = (runId, learnerKeyHash, predictionAt) => ({ runId, learnerKeyHash, predictionAt,
  evidenceCutoffAt: predictionAt, targetScore: 75, scoreMinimum: 0, scoreMaximum: 100,
  baseline: { scoreBand: { low: 55, central: 70, high: 85 }, targetAttainmentProbability: .4 },
  candidate: { scoreBand: { low: 62, central: 76, high: 88 }, targetAttainmentProbability: .55 } });
const outcome = (outcomeId, learnerKeyHash, outcomeAt) => ({ outcomeId, learnerKeyHash, outcomeAt,
  normalizedScore: .8, stratum: 'form:2026-09' });

function verifiedDatasetTest() {
  const built = buildScorePredictionCalibrationDataset({
    examSystemCode: 'csca', subjectCode: 'chemistry', outcomeSource: 'verified_csca_exam',
    scoringPolicyVersion: 'policy-v1', itemCalibrationVersion: 'items-v1', learnerKeyVersion: 'salt-v1',
    temporalCutoffDate: '2026-09-01',
    predictions: [prediction('run-a', key('a'), '2026-07-01T00:00:00.000Z'),
      prediction('run-b', key('b'), '2026-09-02T00:00:00.000Z')],
    outcomes: [outcome('out-a', key('a'), '2026-07-10T00:00:00.000Z'),
      outcome('out-b', key('b'), '2026-09-11T00:00:00.000Z')]
  }, { minimumCalibrationLearners: 1, minimumHoldoutLearners: 1,
    minimumOutcomeHorizonDays: 7, maximumOutcomeHorizonDays: 90 });
  assert.equal(built.status, 'ready_for_snapshot_build');
  assert.equal(built.outcomeSource, 'verified_csca_exam');
  assert.equal(built.forecastCalibrationInput.outcomeSource, 'verified_csca_exam');
  assert.equal(built.manifestRows.length, 2);
  assert.ok(!built.reasonCodes.includes('TIMED_MOCK_PROXY_OUTCOME_ONLY'));
  assert.ok(built.reasonCodes.includes('STUDENT_NUMERIC_RELEASE_DISABLED'));
}

function lifecycleFixture() {
  const state = { outcome: { id: 'outcome-1', userId: 9, status: 'submitted', consentWithdrawnAt: null,
    reviewedByUserId: null, reviewedAt: null, verifiedByUserId: null, verifiedAt: null,
    evidence: [{ attachment: { userId: 9, status: 'ready', deletedAt: null, sha256: key('e') } }] },
  manifest: { id: 'manifest-1', status: 'active', snapshots: [{ id: 'snapshot-1', status: 'qualified' }] }, events: [] };
  const tx = {
    studentExamOutcome: {
      async findUnique(args) { return args.include ? state.outcome : { ...state.outcome, evidence: undefined }; },
      async findFirst() { return state.outcome; },
      async updateMany(args) {
        if (args.where.status !== state.outcome.status) return { count: 0 };
        Object.assign(state.outcome, args.data); return { count: 1 };
      }
    },
    studentExamOutcomeEvent: { async create(args) { state.events.push(args.data); return args.data; } },
    forecastCalibrationDatasetManifest: {
      async findMany() { return state.manifest.status === 'active' ? [state.manifest] : []; },
      async updateMany(args) { Object.assign(state.manifest, args.data); return { count: 1 }; }
    },
    forecastCalibrationSnapshot: { async updateMany(args) {
      Object.assign(state.manifest.snapshots[0], args.data); return { count: 1 };
    } },
    scoreCalibrationGovernanceEvent: { async create(args) { state.events.push(args.data); return args.data; } }
  };
  return { state, prisma: { async $transaction(callback) { return callback(tx); } } };
}

async function lifecycleTest() {
  const fixture = lifecycleFixture();
  const service = new StudentExamOutcomeService(fixture.prisma);
  await service.review('outcome-1', 101, 'Official score report checked by first administrator.');
  assert.equal(fixture.state.outcome.status, 'reviewed');
  await assert.rejects(() => service.verify('outcome-1', 101, 'Second review attempted by same administrator.'), ConflictException);
  await service.verify('outcome-1', 102, 'Independent administrator confirmed score and evidence.');
  assert.equal(fixture.state.outcome.status, 'verified');
  await service.withdraw(9, 'outcome-1', 'No longer consent to calibration use.');
  assert.equal(fixture.state.outcome.status, 'withdrawn');
  assert.equal(fixture.state.manifest.status, 'invalidated');
  assert.equal(fixture.state.manifest.snapshots[0].status, 'retired');
  assert.ok(fixture.state.events.some((event) => event.action === 'retired_source_invalidated'));
}

async function verifiedAdapterTest() {
  const users = Array.from({ length: 400 }, (_, index) => index + 1);
  const output = { method: 'test', scoreBand: { low: 65, central: 76, high: 88 }, targetAttainmentProbability: .6 };
  const runs = users.map((userId, index) => {
    const calibration = index < 100;
    const evaluationDate = calibration ? '2026-06-10' : '2026-08-10';
    return { id: `run-${userId}`, userId, featureSnapshot: {
      schemaVersion: '1', userId, goalId: `goal-${userId}`, subjectCode: 'chemistry', targetScore: 75,
      scoreMinimum: 0, scoreMaximum: 100, evaluationDate, evidenceCutoffAt: `${evaluationDate}T10:00:00.000Z`,
      scoringPolicyVersion: 'policy-v1', itemCalibrationVersion: 'items-v1', modelingPrerequisiteStatus: 'qualified',
      modelingPrerequisiteReasonCodes: [], topicStateCount: 5, independentEvidenceCount: 40,
      averageStateConfidence: .8, maximumStateAgeDays: 2, timedMockCount: 1, latestTimedMockAgeDays: 2,
      latestTimedMockScoreNormalized: .7, mastery: .7, coverage: .8, independence: .7, retention: .7,
      fluency: .7, transfer: .7, consistency: .7, sourceVersions: {
        learningModelVersion: 'ls-v1-shadow-model-1', learningStateVersionHash: key('a'),
        evidenceVersionHash: key('b'), mockVersionHash: key('c'), scoringPolicySourceHash: key('d'),
        itemCalibrationArtifactHash: key('e')
      }
    }, baselineOutput: output, candidateOutput: output };
  });
  const outcomes = users.map((userId, index) => ({ id: `out-${userId}`, userId, score: 80,
    examDate: new Date(index < 100 ? '2026-06-20T00:00:00.000Z' : '2026-08-20T00:00:00.000Z'),
    examFormCode: 'main', reviewedByUserId: 501, verifiedByUserId: 502,
    verifiedAt: new Date('2026-09-01T00:00:00.000Z') }));
  let sealed;
  const tx = {
    studentExamOutcome: { async updateMany(args) { return { count: args.where.id.in.length }; } },
    forecastCalibrationDatasetManifest: { async upsert(args) {
      sealed = args.create; return { id: 'manifest-verified', status: 'active', ...args.create };
    } }
  };
  const prisma = {
    scorePredictionShadowRun: { async findMany() { return runs; } },
    studentExamOutcome: { async findMany() { return outcomes; } },
    async $transaction(callback) { return callback(tx); }
  };
  const service = new VerifiedExamCalibrationDatasetService(prisma, { isEnabled() { return true; } }, {
    CSCA_FORECAST_CALIBRATION_LEARNER_SALT: 's'.repeat(32),
    CSCA_FORECAST_CALIBRATION_LEARNER_SALT_VERSION: 'salt-v1'
  });
  const exported = await service.export({ scoringPolicyVersion: 'policy-v1', itemCalibrationVersion: 'items-v1',
    temporalCutoffDate: '2026-06-30', dataWindowStart: '2026-01-01', dataWindowEnd: '2026-09-01' }, 700);
  assert.equal(exported.status, 'ready_for_snapshot_build');
  assert.equal(exported.datasetManifestId, 'manifest-verified');
  assert.equal(exported.forecastCalibrationInput.datasetManifestId, 'manifest-verified');
  assert.equal(sealed.rows.create.length, 400);
  assert.equal(sealed.createdByUserId, 700);
}

verifiedDatasetTest();
Promise.all([lifecycleTest(), verifiedAdapterTest()]).then(() => console.log('VERIFIED_EXAM_OUTCOME_OK'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
