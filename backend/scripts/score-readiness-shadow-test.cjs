const assert = require('node:assert/strict');
const { ScoreReadinessService } = require('../dist/backend/src/learning-intelligence/readiness/score-readiness.service');
const { LearningIntelligenceFeatureFlagsService } = require('../dist/backend/src/learning-intelligence/learning-intelligence-feature-flags.service');

const now = '2026-09-14T08:00:00.000Z';
const versions = {
  goalVersion: 'goal:g1:v1', availabilityVersion: 'availability:v1', evidenceVersion: 'evidence:e1',
  learningStateVersion: 'state:s1', learningModelVersion: 'ls-v1-shadow-model-1',
  syllabusVersion: 'syllabus:v1', scoringPolicyVersion: 'csca-score-unverified-v1',
  itemCalibrationVersion: 'not-enabled', decisionPolicyVersion: 'ls-v1-prescription-rules-2',
  decisionContextVersion: 'context:c1', forecastModelVersion: 'score-readiness-shadow-gate-v1'
};

function gap(type, subject, recommendedAction) {
  return {
    gapId: `gap-${type}-${subject}`, type, subject, topicIds: type === 'exam_execution' ? [] : [11],
    severity: 0.8, confidence: 'medium', estimatedScoreImpact: null,
    evidenceRefs: [], reasonCodes: [`${type.toUpperCase()}_GAP`], recommendedAction
  };
}

function decision(versionHash = 'a'.repeat(64), gaps = [gap('coverage', 'chemistry', 'diagnostic')]) {
  return {
    versionHash,
    gap: {
      schemaVersion: '1', gapSnapshotId: `gap-${versionHash.slice(0, 8)}`, goalId: 'goal-1', userId: 42,
      versions: { ...versions, decisionContextVersion: `context:${versionHash.slice(0, 8)}` },
      gaps, evidenceCutoffAt: now, createdAt: now
    },
    prescription: { prescriptionId: `rx-${versionHash.slice(0, 8)}` }
  };
}

function store() {
  const rows = new Map();
  const calls = [];
  let currentVersion = 'a'.repeat(64);
  const db = {
    calls,
    rows,
    setCurrentVersion(value) { currentVersion = value; },
    async $transaction(work) { return work(db); },
    async $executeRaw() { calls.push(['lock']); return 1; },
    studentScoreGoal: {
      async findFirst(args) {
        calls.push(['goal', args]);
        if (args.where.userId !== 42 || args.where.id !== 'goal-1') return null;
        return {
          id: 'goal-1', userId: 42, status: 'active', examSystemCode: 'csca',
          subjects: [
            { subjectCode: 'chemistry', targetScore: 88, priority: 1 },
            { subjectCode: 'unsupported', targetScore: 99, priority: 2 }
          ]
        };
      }
    },
    learningDecisionCurrent: {
      async findFirst(args) {
        calls.push(['current', args]);
        return args.where.userId === 42 && args.where.versionHash === currentVersion ? { id: 'current-1' } : null;
      }
    },
    scoreReadinessForecast: {
      async upsert({ where, create }) {
        calls.push(['forecast', { where }]);
        const key = `${create.userId}:${create.goalId}:${create.subjectCode}:${create.versionHash}`;
        if (!rows.has(key)) rows.set(key, { ...create });
        return rows.get(key);
      }
    }
  };
  return db;
}

function enabledFlags() {
  return new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true',
    CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
    CSCA_TARGET_GAP_ENABLED: 'true',
    CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true',
    CSCA_SCORE_READINESS_ENABLED: 'true'
  });
}

const governance = {
  async evaluate(input) {
    return {
      schemaVersion: '1', ...input, gateVersionHash: 'c'.repeat(64), status: 'blocked',
      numericForecastRelease: 'disabled', scoringPolicyId: null,
      itemCalibrationSnapshotId: null, forecastCalibrationSnapshotId: null,
      reasonCodes: ['SCORING_POLICY_NOT_REGISTERED', 'ITEM_CALIBRATION_NOT_REGISTERED',
        'FORECAST_MODEL_NOT_CALIBRATED', 'NUMERIC_FORECAST_RELEASE_DISABLED'],
      evaluatedAt: now
    };
  }
};

async function main() {
  const db = store();
  let currentDecision = decision();
  const decisionService = { async recompute(userId) { assert.equal(userId, 42); return currentDecision; } };
  const service = new ScoreReadinessService(db, enabledFlags(), decisionService, governance);

  const first = await service.getScoreReadiness(42);
  const repeated = await service.getScoreReadiness(42);
  assert.equal(first.status, 'ready');
  assert.equal(first.visibility, 'shadow');
  assert.deepEqual(first, repeated, 'same decision input must replay deterministically');
  assert.equal(db.rows.size, 1, 'same decision version must persist only one subject forecast');
  assert.equal(first.forecasts[0].readinessState, 'insufficient');
  assert.equal(first.forecasts[0].nextValidationAction, 'diagnostic');
  assert.equal(first.forecasts[0].expectedScoreBand, null);
  assert.equal(first.forecasts[0].targetAttainmentProbability, null);
  assert.ok(first.forecasts[0].reasonCodes.includes('FORECAST_MODEL_NOT_CALIBRATED'));
  assert.ok(db.calls.filter(([name]) => name === 'goal' || name === 'current')
    .every(([, args]) => args.where.userId === 42), 'all readiness reads must constrain actor user in SQL');

  const nextHash = 'b'.repeat(64);
  db.setCurrentVersion(nextHash);
  currentDecision = decision(nextHash, [gap('exam_execution', 'chemistry', 'mock_exam')]);
  const measuring = await service.getScoreReadiness(42);
  assert.equal(measuring.forecasts[0].readinessState, 'insufficient', 'an unqualified calibration gate must fail closed');
  assert.equal(measuring.forecasts[0].nextValidationAction, 'mock_exam');
  assert.equal(db.rows.size, 2, 'a new decision version must create a new immutable forecast');

  const disabled = await new ScoreReadinessService(db, new LearningIntelligenceFeatureFlagsService({}), decisionService, governance)
    .getScoreReadiness(42);
  assert.deepEqual(disabled, { status: 'disabled', forecasts: [] });

  const unset = await new ScoreReadinessService(db, enabledFlags(), { async recompute() { return null; } }, governance)
    .getScoreReadiness(42);
  assert.deepEqual(unset, { status: 'goal_unset', forecasts: [] });

  const updating = await new ScoreReadinessService(db, enabledFlags(), {
    async recompute() { throw new Error('LEARNING_DECISION_STATE_UPDATING'); }
  }, governance).getScoreReadiness(42);
  assert.deepEqual(updating, { status: 'updating', forecasts: [] });

  console.log('SCORE_READINESS_SHADOW_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
