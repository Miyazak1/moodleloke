require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { TrainingEventService } = require('../backend/src/csca-special-practice/training-event.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function makeHighDifficultyRound({ subject, total, userId }) {
  return {
    session: { userId, subject, mode: 'practice' },
    submittedAt: new Date(),
    items: Array.from({ length: total }, () => ({
      plannedDifficulty: '挑战',
      usedHint: false,
      usedExplanation: false
    }))
  };
}

function healthySnapshot() {
  return {
    id: 1,
    snapshotDate: new Date(),
    actionType: 'repair_weak_subject',
    clickedCount: 12,
    followedCount: 7,
    abilityLiftCount: 5,
    followThroughRate: 0.5833,
    abilityLiftRate: 0.4167,
    averageMasteryDelta: 0.12,
    multiplier: 1.04,
    status: 'positive'
  };
}

function serviceWith({ rounds, snapshots = [healthySnapshot()] }) {
  return new TrainingEventService({
    cscaTrainingEvent: {
      findMany: async () => []
    },
    cscaAdaptiveRound: {
      findMany: async () => rounds
    },
    cscaReadinessActionCalibrationSnapshot: {
      findMany: async () => snapshots
    }
  });
}

async function assertSampledRolloutReady() {
  const rounds = [
    ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'math', total: 4, userId: 100 + index })),
    ...Array.from({ length: 3 }, (_, index) => makeHighDifficultyRound({ subject: 'math', total: 3, userId: 200 + index })),
    ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'physics', total: 2, userId: 300 + index })),
    ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'chemistry', total: 2, userId: 400 + index }))
  ];
  const overview = await serviceWith({ rounds }).getOverview({ days: '30' });
  assertEqual(overview.readinessSampledThresholdRollout.status, 'ready', 'Sampled threshold rollout gate should pass with sufficient samples and healthy calibration.');
  assert(overview.readinessSampledThresholdRollout.checklist.every((item) => item.status === 'passed'), 'All sampled threshold rollout checklist items should pass.');
}

async function assertSampledRolloutBlocksLowSamples() {
  const rounds = [
    ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'math', total: 4, userId: 100 + index })),
    ...Array.from({ length: 3 }, (_, index) => makeHighDifficultyRound({ subject: 'physics', total: 2, userId: 300 + index })),
    ...Array.from({ length: 3 }, (_, index) => makeHighDifficultyRound({ subject: 'chemistry', total: 2, userId: 400 + index }))
  ];
  const overview = await serviceWith({ rounds }).getOverview({ days: '30' });
  assertEqual(overview.readinessSampledThresholdRollout.status, 'blocked', 'Sampled threshold rollout gate should block when subject samples are insufficient.');
  assert(overview.readinessSampledThresholdRollout.checklist.some((item) => item.key === 'sample_size' && item.status === 'blocked'), 'Sample size checklist item should block rollout.');
}

async function main() {
  const previousMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
  const previousImpact = process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS;
  process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = 'sampled';
  process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS = '5';
  try {
    await assertSampledRolloutReady();
    await assertSampledRolloutBlocksLowSamples();
    console.log('CSCA readiness release gate passed.');
  } finally {
    if (previousMode === undefined) delete process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
    else process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = previousMode;
    if (previousImpact === undefined) delete process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS;
    else process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS = previousImpact;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
