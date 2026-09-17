const assert = require('node:assert/strict');
const { ScorePredictionShadowService } = require('../dist/backend/src/learning-intelligence/readiness/score-prediction-shadow.service');

const at = new Date('2026-09-14T10:00:00.000Z');
function txFixture({ empty = false } = {}) {
  const states = empty ? [] : Array.from({ length: 5 }, (_, index) => ({
    id: `state-${index}`, userId: 9, subjectCode: 'chemistry', topicId: index + 1,
    stateVersion: `sv-${index}`, modelVersion: 'ls-v1-shadow-model-1', mastery: .72,
    confidence: .8, independence: .76, retention: .7, fluency: .66, transfer: .68,
    consistency: .74, coverage: .8, evidenceCount: 8, lastEvidenceAt: new Date('2026-09-12T10:00:00.000Z'),
    createdAt: at, updatedAt: at
  }));
  let persisted;
  return {
    get persisted() { return persisted; },
    studentScoreGoal: { async findFirst() { return { id: 'goal-1', userId: 9, examSystemCode: 'csca',
      status: 'active', effectiveAt: at, createdAt: at,
      subjects: [{ subjectCode: 'chemistry', targetScore: 80 }] }; } },
    examScoringPolicy: { async findUnique() { return { sourceSnapshotHash: 'a'.repeat(64),
      scoreScale: { subjects: { chemistry: { minimum: 0, maximum: 100 } } } }; } },
    itemCalibrationSnapshot: { async findUnique() { return { artifactHash: 'b'.repeat(64) }; } },
    userCscaTopicStateV2: { async findMany() { return states; } },
    learningEvidenceEvent: { async aggregate() { return { _count: { _all: empty ? 0 : 40 },
      _max: { eventSequence: empty ? null : 40n, recordedAt: empty ? null : at } }; } },
    mockExamAttempt: { async findMany() { return empty ? [] : [{ id: 1, score: 74, correctCount: 35,
      wrongCount: 10, unansweredCount: 3, startedAt: new Date('2026-09-14T08:00:00.000Z'),
      submittedAt: at, updatedAt: at, paper: { subject: 'chemistry', durationMinutes: 120, version: 1 } }]; } },
    scorePredictionShadowRun: { async upsert(args) { persisted = args.create; return args.create; } }
  };
}
function serviceFor(tx) {
  const prisma = { async $transaction(callback) { return callback(tx); }, scorePredictionShadowRun: { async findMany() { return []; } } };
  const flags = { isEnabled() { return true; } };
  const governance = { async evaluateModelingPrerequisites() { return { status: 'qualified', reasonCodes: [] }; } };
  return new ScorePredictionShadowService(prisma, flags, governance);
}

async function main() {
  const validTx = txFixture();
  const valid = await serviceFor(validTx).run({ userId: 9, scoringPolicyVersion: 'policy-v1',
    itemCalibrationVersion: 'items-v1', evaluationDate: '2026-09-14' });
  assert.equal(valid.status, 'computed');
  assert.equal(valid.visibility, 'internal_shadow');
  assert.equal(valid.numericForecastRelease, 'disabled');
  assert.equal(validTx.persisted.status, 'computed');

  const emptyTx = txFixture({ empty: true });
  const blocked = await serviceFor(emptyTx).run({ userId: 9, scoringPolicyVersion: 'policy-v1',
    itemCalibrationVersion: 'items-v1', evaluationDate: '2026-09-14' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.run.result.candidateOutput, null);
  assert.ok(blocked.run.result.reasonCodes.includes('INDEPENDENT_EVIDENCE_INSUFFICIENT'));
  assert.equal(emptyTx.persisted.status, 'blocked');
  console.log('SCORE_PREDICTION_SHADOW_SERVICE_OK');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
