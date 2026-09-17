require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const RealDate = Date;
const FIXED_TEST_NOW_MS = RealDate.parse('2026-06-08T12:00:00.000Z');
class FixedTestDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_TEST_NOW_MS);
      return;
    }
    super(...args);
  }

  static now() {
    return FIXED_TEST_NOW_MS;
  }
}
global.Date = FixedTestDate;

const { CscaLearningService } = require('../backend/src/csca-learning/csca-learning.service');
const { TrainingEventService } = require('../backend/src/csca-special-practice/training-event.service');
const { nextShanghaiDailyRunMs } = require('../backend/src/ops/readiness-calibration-scheduler.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function makeBasePrisma(overrides = {}) {
  return {
    cscaLearningDailySnapshot: {
      findMany: async () => [],
      aggregate: async () => ({ _sum: { answeredCount: null, correctCount: null } }),
      count: async () => 0,
      ...overrides.cscaLearningDailySnapshot
    },
    cscaLearningStreak: {
      findUnique: async () => null,
      ...overrides.cscaLearningStreak
    },
    cscaLearningInsight: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 1, createdAt: new Date('2026-06-07T17:00:00.000Z'), ...data }),
      ...overrides.cscaLearningInsight
    },
    cscaReadinessActionCalibrationSnapshot: {
      findMany: async () => [],
      upsert: async ({ create }) => ({ id: 1, createdAt: new Date('2026-06-09T00:00:00.000Z'), updatedAt: new Date('2026-06-09T00:00:00.000Z'), ...create }),
      ...overrides.cscaReadinessActionCalibrationSnapshot
    },
    cscaWrongPattern: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 1, createdAt: new Date('2026-06-07T17:00:00.000Z'), updatedAt: new Date('2026-06-07T17:00:00.000Z'), ...data }),
      update: async ({ where, data }) => ({ id: where.id, createdAt: new Date('2026-06-07T17:00:00.000Z'), updatedAt: new Date('2026-06-07T17:00:00.000Z'), ...data }),
      ...overrides.cscaWrongPattern
    },
    cscaAIInteraction: {
      create: async ({ data }) => ({ id: 1, createdAt: new Date('2026-06-07T17:00:00.000Z'), ...data }),
      ...overrides.cscaAIInteraction
    },
    cscaTrainingEvent: {
      create: async ({ data }) => ({ id: 1, createdAt: new Date('2026-06-07T17:00:00.000Z'), ...data }),
      findMany: async () => [],
      ...overrides.cscaTrainingEvent
    },
    userCscaTopicMastery: {
      findMany: async () => [],
      ...overrides.userCscaTopicMastery
    },
    cscaExamTopic: {
      findMany: async () => [],
      ...overrides.cscaExamTopic
    },
    cscaTopicMapping: {
      findMany: async () => [],
      ...overrides.cscaTopicMapping
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [],
      ...overrides.cscaAdaptiveRound
    },
    cscaAdaptiveSession: {
      findMany: async () => [],
      ...overrides.cscaAdaptiveSession
    },
    mockExamAttempt: {
      findMany: async () => [],
      ...overrides.mockExamAttempt
    }
  };
}

function makeAIStubs(overrides = {}) {
  return {
    entitlement: {
      reserve: async () => ({ allowed: true, accountId: 1, ledgerId: 8, balanceUnits: 49 }),
      commit: async () => {},
      refund: async () => {},
      ...overrides.entitlement
    },
    provider: {
      isExternalEnabled: () => false,
      configuredProvider: () => 'rule-fallback',
      configuredModel: () => 'local-rule-v1',
      generate: async ({ input, fallbackOutput }) => ({
        output: fallbackOutput,
        provider: 'rule-fallback',
        model: 'local-rule-v1',
        promptVersion: 'coach-rule-v1',
        input,
        status: 'success'
      }),
      ...overrides.provider
    },
    usageMeter: {
      measure: () => ({
        tokenUsage: { billable: false },
        costEstimate: 0,
        status: 'success'
      }),
      ...overrides.usageMeter
    }
  };
}

function makeHighDifficultyRound({ subject = 'math', topicStart = 1, correctCount = 8, total = 8, userId = 100 } = {}) {
  return {
    session: { userId, subject, mode: 'practice' },
    submittedAt: new Date('2026-06-08T11:00:00.000Z'),
    items: Array.from({ length: total }, (_, index) => ({
      topicId: topicStart + index,
      plannedDifficulty: index % 4 === 3 ? '挑战' : '较难',
      isCorrect: index < correctCount,
      usedHint: false,
      usedExplanation: false
    }))
  };
}

function testReadinessCalibrationSchedulerUsesShanghaiTime() {
  const beforeTarget = nextShanghaiDailyRunMs(new Date('2026-06-09T18:00:00.000Z'), 3, 20);
  const afterTarget = nextShanghaiDailyRunMs(new Date('2026-06-09T20:00:00.000Z'), 3, 20);
  assertEqual(beforeTarget, 80 * 60 * 1000, 'Scheduler should target the same Shanghai day before the configured time.');
  assertEqual(afterTarget, (23 * 60 + 20) * 60 * 1000, 'Scheduler should target the next Shanghai day after the configured time.');
}

async function testAdminTrainingObservabilityExposesHighDifficultyThresholdDistribution() {
  const previousMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
  process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = 'sampled';
  try {
    const service = new TrainingEventService({
      cscaTrainingEvent: {
        findMany: async () => []
      },
      cscaAdaptiveRound: {
        findMany: async () => [
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 4, total: 4, userId: 100 + index })),
          ...Array.from({ length: 3 }, (_, index) => makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 3, total: 3, userId: 200 + index })),
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'physics', topicStart: 11, correctCount: 2, total: 2, userId: 300 + index })),
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'chemistry', topicStart: 21, correctCount: 2, total: 2, userId: 400 + index }))
        ]
      }
    });

    const overview = await service.getOverview({ days: '30' });
    const math = overview.readinessDifficultyThresholds.bySubject.find((item) => item.subject === 'math');
    assert(math, 'Admin observability should expose math threshold distribution.');
    assertEqual(math.source, 'sampled_distribution', 'Admin threshold distribution should expose sampled source when enabled and sufficient.');
    assertEqual(math.recommendedCount, 4, 'Admin threshold distribution should expose sampled recommendation.');
    assertEqual(math.readyAtDefault, 11, 'Admin threshold distribution should count default-ready user-subject samples.');
    assertEqual(math.readyAtSampled, 8, 'Admin threshold distribution should count sampled-ready user-subject samples.');
    assertEqual(math.impactedUserSubjectCount, 3, 'Admin threshold distribution should estimate sampled-mode impact.');
  } finally {
    if (previousMode === undefined) {
      delete process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
    } else {
      process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = previousMode;
    }
  }
}

async function testAdminTrainingObservabilityExposesReadinessCalibrationHealthAlerts() {
  const previousMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
  process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = 'sampled';
  try {
    const staleSnapshotDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const service = new TrainingEventService({
      cscaTrainingEvent: {
        findMany: async () => []
      },
      cscaAdaptiveRound: {
        findMany: async () => []
      },
      cscaReadinessActionCalibrationSnapshot: {
        findMany: async () => [{
          id: 1,
          snapshotDate: staleSnapshotDate,
          actionType: 'repair_weak_subject',
          clickedCount: 8,
          followedCount: 1,
          abilityLiftCount: 0,
          followThroughRate: 0.125,
          abilityLiftRate: 0,
          averageMasteryDelta: 0,
          multiplier: 0.9,
          status: 'needs_calibration'
        }]
      }
    });

    const overview = await service.getOverview({ days: '30' });
    const health = overview.readinessCalibrationHealth;
    assertEqual(health.status, 'needs_attention', 'Admin observability should flag readiness calibration health issues.');
    assert(health.alerts.some((item) => item.code === 'calibration_snapshot_stale'), 'Calibration health should flag stale snapshots.');
    assert(health.alerts.some((item) => item.code === 'action_type_needs_calibration' && item.actionType === 'repair_weak_subject'), 'Calibration health should flag action types needing calibration.');
    assert(health.alerts.some((item) => item.code === 'sampled_distribution_insufficient' && item.subject === 'math'), 'Calibration health should flag insufficient sampled threshold data.');
  } finally {
    if (previousMode === undefined) {
      delete process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
    } else {
      process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = previousMode;
    }
  }
}

async function testAdminTrainingObservabilityExposesSampledThresholdRolloutReadiness() {
  const previousMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
  const previousImpact = process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS;
  process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = 'sampled';
  process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS = '5';
  try {
    const service = new TrainingEventService({
      cscaTrainingEvent: {
        findMany: async () => []
      },
      cscaAdaptiveRound: {
        findMany: async () => [
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 4, total: 4, userId: 100 + index })),
          ...Array.from({ length: 3 }, (_, index) => makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 3, total: 3, userId: 200 + index })),
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'physics', topicStart: 11, correctCount: 2, total: 2, userId: 300 + index })),
          ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'chemistry', topicStart: 21, correctCount: 2, total: 2, userId: 400 + index }))
        ]
      },
      cscaReadinessActionCalibrationSnapshot: {
        findMany: async () => [{
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
        }]
      }
    });

    const overview = await service.getOverview({ days: '30' });
    const rollout = overview.readinessSampledThresholdRollout;
    assertEqual(rollout.status, 'ready', 'Sampled threshold rollout should be ready when samples, health, impact, and mode pass.');
    assertEqual(rollout.metrics.sampledReadySubjects, 3, 'Rollout metrics should count ready subjects.');
    assertEqual(rollout.metrics.impactedUserSubjectCount, 3, 'Rollout metrics should expose sampled impact.');
    assert(rollout.checklist.every((item) => item.status === 'passed'), 'Rollout checklist should pass all gates.');
  } finally {
    if (previousMode === undefined) {
      delete process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
    } else {
      process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = previousMode;
    }
    if (previousImpact === undefined) {
      delete process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS;
    } else {
      process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS = previousImpact;
    }
  }
}

function makeStableHighDifficultyRounds() {
  return [
    makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 3, total: 3 }),
    makeHighDifficultyRound({ subject: 'physics', topicStart: 11, correctCount: 2, total: 2 }),
    makeHighDifficultyRound({ subject: 'chemistry', topicStart: 21, correctCount: 2, total: 2 })
  ];
}

function makeWeakDifficultyTopicRound() {
  return {
    session: { subject: 'math', mode: 'practice' },
    submittedAt: new Date('2026-06-08T11:00:00.000Z'),
    items: [
      ...Array.from({ length: 3 }, () => ({
        topicId: 1,
        plannedDifficulty: '挑战',
        isCorrect: false,
        usedHint: false,
        usedExplanation: false
      })),
      ...Array.from({ length: 9 }, (_, index) => ({
        topicId: index + 2,
        plannedDifficulty: index % 3 === 0 ? '挑战' : '较难',
        isCorrect: true,
        usedHint: false,
        usedExplanation: false
      }))
    ]
  };
}

async function testSnapshotPathWins() {
  let fallbackRoundQueryCount = 0;
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') {
          return [{
            localDate: new Date('2026-06-07T16:00:00.000Z'),
            activeScore: 40,
            answeredCount: 5,
            correctCount: 4,
            wrongCount: 1,
            unansweredCount: 0,
            practiceSeconds: 300,
            mockSeconds: 0,
            aiInteractionCount: 0,
            isStreakEligible: true
          }];
        }
        if (where.subject === 'math') {
          return [{
            localDate: new Date('2026-06-07T16:00:00.000Z'),
            activeScore: 40,
            answeredCount: 5,
            correctCount: 4,
            wrongCount: 1,
            unansweredCount: 0,
            practiceSeconds: 300,
            mockSeconds: 0,
            aiInteractionCount: 0,
            masteryAvg: 0.62,
            isStreakEligible: true
          }];
        }
        if (where.subject?.in?.includes('math')) {
          return [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject: 'math', answeredCount: 5, masteryAvg: 0.5 },
            { localDate: new Date('2026-06-07T16:00:00.000Z'), subject: 'math', answeredCount: 5, masteryAvg: 0.62 }
          ];
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 5, correctCount: 4 } }),
      count: async () => 1
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => where.subject === 'math' ? [{ mastery: 0.62 }] : []
    },
    cscaLearningStreak: {
      findUnique: async () => ({ currentStreakDays: 1, longestStreakDays: 2 })
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async ({ select } = {}) => {
        if (select?.correctCount) fallbackRoundQueryCount += 1;
        return [];
      }
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    }
  }));

  const dashboard = await service.getDashboard(101);
  assertEqual(dashboard.summary.totalAnswered, 5, 'Snapshot dashboard must use stored answered count.');
  assertEqual(dashboard.summary.totalCorrect, 4, 'Snapshot dashboard must use stored correct count.');
  assertEqual(dashboard.summary.practiceMinutesThisWeek, 5, 'Snapshot dashboard must expose weekly practice minutes.');
  assertEqual(dashboard.summary.currentStreakDays, 1, 'Snapshot dashboard must use stored streak state.');
  assertEqual(dashboard.summary.longestStreakDays, 2, 'Snapshot dashboard must use stored longest streak.');
  assertEqual(dashboard.aiInsight.status, 'fallback', 'Snapshot dashboard should return rule fallback insight without cached AI insight.');
  assertEqual(dashboard.learningSummary.status, 'ready', 'Snapshot dashboard should expose a rule-generated learning summary.');
  assertEqual(dashboard.learningSummary.source, 'rule_engine', 'Rule learning summary should not be labeled as AI output.');
  assertEqual(dashboard.masteryTrend.find((subject) => subject.subject === 'math')?.delta, 12, 'Dashboard should expose subject mastery trend delta.');
  assertEqual(fallbackRoundQueryCount, 0, 'Historical fallback must not run when snapshot data exists.');
}

async function testHistoricalFallback() {
  const service = new CscaLearningService(makeBasePrisma({
    userCscaTopicMastery: {
      findMany: async ({ where }) => where.subject === 'math'
        ? [{ mastery: 0.4 }, { mastery: 0.8 }]
        : []
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [
        {
          submittedAt: new Date('2026-06-06T08:00:00.000Z'),
          correctCount: 3,
          wrongCount: 2,
          unansweredCount: 0,
          items: Array.from({ length: 5 }, () => ({ timeSpentSeconds: 30 })),
          session: { subject: 'math', mode: 'practice' }
        },
        {
          submittedAt: new Date('2026-06-07T08:00:00.000Z'),
          correctCount: 10,
          wrongCount: 5,
          unansweredCount: 5,
          items: Array.from({ length: 20 }, () => ({ timeSpentSeconds: 20 })),
          session: { subject: 'math', mode: 'diagnostic' }
        }
      ]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 88,
        submittedAt: new Date('2026-06-07T10:00:00.000Z'),
        score: 42,
        correctCount: 20,
        wrongCount: 8,
        unansweredCount: 20,
        timeSpent: { 1: 60, 2: 90, 3: 120 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(202);
  assertEqual(dashboard.summary.totalAnswered, 48, 'Historical fallback must aggregate answered practice and mock questions.');
  assertEqual(dashboard.summary.totalCorrect, 33, 'Historical fallback must aggregate correct practice and mock questions.');
  assertEqual(dashboard.summary.accuracy, 69, 'Historical fallback must compute total accuracy.');
  assertEqual(dashboard.summary.currentStreakDays, 2, 'Historical fallback must derive consecutive learning days.');
  assertEqual(dashboard.summary.longestStreakDays, 2, 'Historical fallback must derive longest streak.');
  assertEqual(dashboard.summary.totalActiveDays, 2, 'Historical fallback must count unique active learning days.');
  assertEqual(dashboard.subjects.find((subject) => subject.subject === 'math')?.answeredCount, 48, 'Historical fallback must feed subject cards.');
  assertEqual(dashboard.subjects.find((subject) => subject.subject === 'math')?.masteryAvg, 60, 'Historical fallback must keep mastery in subject cards.');
  assert(dashboard.heatmap.some((item) => item.date === '2026-06-06' && item.answeredCount === 5), 'Historical fallback must fill heatmap rows.');
  assert(dashboard.heatmap.some((item) => item.date === '2026-06-07' && item.answeredCount === 43), 'Historical fallback must merge same-day training and mock data.');
  assertEqual(dashboard.mockTrend.latest?.score, 42, 'Dashboard should expose latest mock score.');
  assertEqual(dashboard.mockTrend.latest?.unansweredCount, 20, 'Dashboard should expose latest mock unanswered count.');
  assertEqual(dashboard.mockTrend.latest?.reportHref, '/zh/csca-mock-exam/attempts/88/report', 'Dashboard should expose the current mock report route.');
  assertEqual(dashboard.readiness.stage, 'diagnosing', 'Readiness should stay conservative while subject evidence is incomplete.');
  assertEqual(dashboard.readiness.confidence, 'low', 'Readiness should expose low confidence when evidence is thin.');
  assert(dashboard.readiness.dimensions.some((dimension) => dimension.key === 'evidence' && dimension.status !== 'strong'), 'Thin evidence should be visible as its own readiness dimension.');
  assert(dashboard.readiness.scoreExplanation.includes('不是模考'), 'Readiness should explain that the score is not a mock score.');
  assertEqual(dashboard.readiness.nextAction.type, 'start_diagnostic', 'Readiness should guide users to missing diagnostics first.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('不够') || blocker.includes('看不清')), 'Readiness should explain the missing baseline.');
}

async function testCachedWeeklyInsight() {
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => where.subject === 'all'
        ? [{
          localDate: new Date('2026-06-07T16:00:00.000Z'),
          activeScore: 40,
          answeredCount: 5,
          correctCount: 4,
          wrongCount: 1,
          unansweredCount: 0,
          practiceSeconds: 300,
          mockSeconds: 0,
          aiInteractionCount: 0,
          isStreakEligible: true
        }]
        : [],
      aggregate: async () => ({ _sum: { answeredCount: 5, correctCount: 4 } }),
      count: async () => 1
    },
    cscaLearningInsight: {
      findFirst: async () => ({
        id: 9,
        userId: 303,
        periodType: 'weekly',
        periodStart: new Date('2026-06-01T16:00:00.000Z'),
        periodEnd: new Date('2026-06-07T16:00:00.000Z'),
        summary: '本周数学训练更稳定，下一轮优先复盘函数。',
        strengths: ['训练稳定'],
        weaknesses: ['函数'],
        recommendedActions: ['复盘函数错题', '完成下一轮数学训练'],
        provider: 'deepseek',
        model: 'deepseek-chat',
        status: 'success',
        createdAt: new Date('2026-06-07T17:00:00.000Z')
      })
    }
  }));

  const dashboard = await service.getDashboard(303);
  assertEqual(dashboard.aiInsight.status, 'ready', 'Cached insight should be exposed as ready.');
  assertEqual(dashboard.aiInsight.summary, '本周数学训练更稳定，下一轮优先复盘函数。', 'Cached insight summary should be returned.');
  assertEqual(dashboard.aiInsight.actions.length, 2, 'Cached insight actions should be returned.');
  assertEqual(dashboard.aiInsight.provider, 'deepseek', 'Cached insight provider should be returned.');
  assertEqual(dashboard.learningSummary.summary, '本周数学训练更稳定，下一轮优先复盘函数。', 'Learning summary should expose cached summary text.');
  assertEqual(dashboard.learningSummary.source, 'llm_polished', 'Cached provider insight should be treated as optional polished copy.');
}

async function testGenerateWeeklyInsightEndpointDoesNotChargeOrCallProvider() {
  let reserved = false;
  let committed = false;
  let generated = false;
  const ai = makeAIStubs({
    entitlement: {
      reserve: async () => { reserved = true; throw new Error('Learning summary compatibility endpoint should not reserve user credits.'); },
      commit: async () => { committed = true; }
    },
    provider: {
      isExternalEnabled: () => true,
      configuredProvider: () => 'deepseek',
      configuredModel: () => 'deepseek-chat',
      generate: async () => {
        generated = true;
        throw new Error('Learning summary compatibility endpoint should not call external providers.');
      }
    }
  });
  const service = new CscaLearningService(
    makeBasePrisma({
      cscaLearningDailySnapshot: {
        findMany: async ({ where }) => where.subject === 'all'
          ? [{
            localDate: new Date('2026-06-07T16:00:00.000Z'),
            activeScore: 40,
            answeredCount: 5,
            correctCount: 4,
            wrongCount: 1,
            unansweredCount: 0,
            practiceSeconds: 300,
            mockSeconds: 0,
            aiInteractionCount: 0,
            isStreakEligible: true
          }]
          : [],
        aggregate: async () => ({ _sum: { answeredCount: 5, correctCount: 4 } }),
        count: async () => 1
      },
      cscaLearningInsight: {
        findFirst: async () => null,
        create: async ({ data }) => ({ id: 44, createdAt: new Date('2026-06-07T17:00:00.000Z'), ...data })
      }
    }),
    ai.entitlement,
    ai.provider,
    ai.usageMeter
  );

  const insight = await service.generateWeeklyInsight(404);
  assertEqual(insight.status, 'fallback', 'Compatibility endpoint should return the rule summary insight.');
  assertEqual(insight.provider, null, 'Compatibility endpoint should not expose an external provider.');
  assert(!reserved, 'Compatibility endpoint must not reserve user AI credits.');
  assert(!committed, 'Compatibility endpoint must not commit user AI credits.');
  assert(!generated, 'Compatibility endpoint must not call external providers.');
}

async function testActivityDoesNotAutoGenerateWithoutEnoughEvidence() {
  let generateCount = 0;
  const ai = makeAIStubs({
    provider: {
      isExternalEnabled: () => true,
      configuredProvider: () => 'deepseek',
      configuredModel: () => 'deepseek-chat',
      generate: async () => {
        generateCount += 1;
        throw new Error('Weekly insight should not generate for a single 5-question round.');
      }
    }
  });
  const service = new CscaLearningService(
    makeBasePrisma({
      cscaLearningDailySnapshot: {
        findMany: async ({ select }) => select?.answeredCount ? [{ answeredCount: 5 }] : [],
        aggregate: async () => ({ _sum: { answeredCount: 5, correctCount: 4 } }),
        count: async () => 1,
        upsert: async () => ({})
      },
      cscaLearningStreak: {
        findUnique: async () => null,
        upsert: async () => ({})
      }
    }),
    ai.entitlement,
    ai.provider,
    ai.usageMeter
  );

  await service.recordLearningActivity({
    userId: 505,
    subject: 'math',
    source: 'adaptive_practice',
    answeredCount: 5,
    correctCount: 4,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 300
  });
  assertEqual(generateCount, 0, 'Weekly insight should not auto-generate without enough evidence.');
}

async function testActivityAutoGeneratesWhenEvidenceIsEnough() {
  let generateCount = 0;
  let insightCreated = false;
  const ai = makeAIStubs({
    provider: {
      isExternalEnabled: () => true,
      configuredProvider: () => 'deepseek',
      configuredModel: () => 'deepseek-chat',
      generate: async ({ input }) => {
        generateCount += 1;
        return {
          output: '本周训练证据充分，可以形成周报。\n继续复盘错题。\n完成下一轮训练。',
          provider: 'deepseek',
          model: 'deepseek-chat',
          promptVersion: 'coach-v2-safety',
          input,
          status: 'success'
        };
      }
    },
    usageMeter: {
      measure: () => ({
        tokenUsage: { billable: true },
        costEstimate: 0.001,
        status: 'success'
      })
    }
  });
  const snapshotRow = {
    localDate: new Date('2026-06-07T16:00:00.000Z'),
    activeScore: 80,
    answeredCount: 20,
    correctCount: 14,
    wrongCount: 6,
    unansweredCount: 0,
    practiceSeconds: 1200,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  };
  const service = new CscaLearningService(
    makeBasePrisma({
      cscaLearningDailySnapshot: {
        findMany: async ({ where, select }) => {
          if (select?.answeredCount) return [{ answeredCount: 20 }];
          return where.subject === 'all' ? [snapshotRow] : [];
        },
        aggregate: async () => ({ _sum: { answeredCount: 20, correctCount: 14 } }),
        count: async () => 1,
        upsert: async () => ({})
      },
      cscaLearningStreak: {
        findUnique: async () => null,
        upsert: async () => ({})
      },
      cscaLearningInsight: {
        findFirst: async () => null,
        create: async ({ data }) => {
          insightCreated = true;
          return { id: 55, createdAt: new Date('2026-06-07T17:00:00.000Z'), ...data };
        }
      }
    }),
    ai.entitlement,
    ai.provider,
    ai.usageMeter
  );

  await service.recordLearningActivity({
    userId: 606,
    subject: 'math',
    source: 'adaptive_diagnostic',
    answeredCount: 20,
    correctCount: 14,
    wrongCount: 6,
    unansweredCount: 0,
    practiceSeconds: 1200
  });
  assertEqual(generateCount, 0, 'Weekly insight should not auto-generate from background activity.');
  assert(!insightCreated, 'Background activity should not cache a billable weekly insight.');
}

async function testWrongPatternsAreAggregatedAndExposed() {
  const writes = [];
  const service = new CscaLearningService(makeBasePrisma({
    cscaWrongPattern: {
      findFirst: async () => ({
        id: 12,
        userId: 707,
        subject: 'math',
        topicId: 5,
        patternType: 'formula_or_rule',
        recurrenceCount: 2,
        metadata: { recentQuestionIds: [8, 9] }
      }),
      update: async ({ where, data }) => {
        writes.push({ where, data });
        return { id: where.id, ...data };
      },
      findMany: async () => [{
        id: 12,
        userId: 707,
        subject: 'math',
        topicId: 5,
        topic: { title: '平面解析几何' },
        patternType: 'formula_or_rule',
        recurrenceCount: 3,
        status: 'active',
        lastWrongAt: new Date('2026-06-07T10:00:00.000Z'),
        lastCorrectAt: null,
        nextReviewAt: new Date('2026-06-07T10:00:00.000Z')
      }]
    },
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => where.subject === 'all'
        ? [{
          localDate: new Date('2026-06-07T16:00:00.000Z'),
          activeScore: 40,
          answeredCount: 5,
          correctCount: 3,
          wrongCount: 2,
          unansweredCount: 0,
          practiceSeconds: 300,
          mockSeconds: 0,
          aiInteractionCount: 0,
          isStreakEligible: true
        }]
        : [],
      aggregate: async () => ({ _sum: { answeredCount: 5, correctCount: 3 } }),
      count: async () => 1
    }
  }));

  await service.recordWrongPatterns({
    userId: 707,
    subject: 'math',
    source: 'adaptive_practice',
    occurredAt: new Date('2026-06-07T10:00:00.000Z'),
    items: [{
      questionId: 10,
      questionSource: 'csca_question',
      topicId: 5,
      selectedAnswer: 'B',
      correctAnswer: 'C',
      knowledgeTags: ['平面解析几何', '圆的方程']
    }]
  });
  assertEqual(writes.length, 1, 'Existing wrong pattern should be updated instead of duplicated.');
  assertEqual(writes[0].data.recurrenceCount, 3, 'Wrong pattern recurrence should increment.');
  assert(writes[0].data.metadata.recentQuestionIds.includes(10), 'Wrong pattern metadata should keep latest question id.');
  assertEqual(writes[0].data.metadata.lastQuestionSource, 'csca_question', 'Wrong pattern metadata should keep the latest question source.');
  assert(writes[0].data.metadata.recentQuestionRefs.some((item) => item.questionId === 10 && item.questionSource === 'csca_question'), 'Wrong pattern metadata should keep source-aware recent question refs.');

  const dashboard = await service.getDashboard(707);
  assertEqual(dashboard.wrongPatterns.length, 1, 'Dashboard should expose active wrong patterns.');
  assertEqual(dashboard.wrongPatterns[0].label, '公式/规则混淆', 'Dashboard should expose readable pattern label.');
  assertEqual(dashboard.wrongPatterns[0].topicTitle, '平面解析几何', 'Dashboard should expose topic title.');
  assertEqual(dashboard.wrongPatterns[0].status, 'active', 'Dashboard should expose wrong pattern status.');
  assertEqual(dashboard.wrongPatterns[0].priority, 'high', 'Due wrong pattern should be high priority.');
  assertEqual(dashboard.wrongPatternTrend[0].label, '公式/规则混淆', 'Dashboard should expose wrong pattern trend labels.');
  assertEqual(dashboard.wrongPatternTrend[0].dueCount, 1, 'Dashboard should count due wrong pattern trend items.');
  assertEqual(dashboard.rhythmEvaluation.status, 'building', 'Dashboard should evaluate recent learning rhythm.');
  assertEqual(dashboard.readiness.dimensions.find((dimension) => dimension.key === 'review')?.status, 'weak', 'Readiness should mark due review backlog as a weak dimension.');
}

async function testReadinessPrioritizesDueReviewsAfterBaseline() {
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 101 : subject === 'physics' ? index + 111 : index + 121,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = [
    { subject: 'all', answeredCount: 12, correctCount: 10 },
    { subject: 'all', answeredCount: 12, correctCount: 9 },
    { subject: 'all', answeredCount: 12, correctCount: 9 },
    { subject: 'all', answeredCount: 12, correctCount: 10 },
    { subject: 'all', answeredCount: 12, correctCount: 9 },
    { subject: 'all', answeredCount: 12, correctCount: 10 },
    { subject: 'all', answeredCount: 12, correctCount: 9 }
  ].map((row, index) => ({
    localDate: new Date(`2026-06-0${index + 1}T16:00:00.000Z`),
    activeScore: 80,
    answeredCount: row.answeredCount,
    correctCount: row.correctCount,
    wrongCount: row.answeredCount - row.correctCount,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 3, masteryAvg: 0.72 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 8, masteryAvg: 0.68 },
            { localDate: new Date('2026-06-07T16:00:00.000Z'), subject, answeredCount: 12, masteryAvg: 0.72 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 84, correctCount: 66 } }),
      count: async () => 7
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.72, confidence: 0.62, attemptCount: 3 }))
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    cscaWrongPattern: {
      findMany: async () => [{
        id: 31,
        userId: 909,
        subject: 'physics',
        topicId: 11,
        topic: { title: '力学图像' },
        patternType: 'visual_interpretation',
        recurrenceCount: 4,
        status: 'active',
        lastWrongAt: new Date('2026-06-07T10:00:00.000Z'),
        lastCorrectAt: null,
        nextReviewAt: new Date('2026-06-07T10:00:00.000Z')
      }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 92,
        submittedAt: new Date('2026-06-07T10:00:00.000Z'),
        score: 76,
        correctCount: 36,
        wrongCount: 8,
        unansweredCount: 4,
        timeSpent: { 1: 60, 2: 90 },
        paper: { subject: 'physics', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(909);
  assertEqual(dashboard.readiness.stage, 'repairing', 'Readiness should enter repair mode when due reviews remain after baseline is complete.');
  assertEqual(dashboard.readiness.nextAction.type, 'review_due_patterns', 'Readiness should prioritize due review completion.');
  assertEqual(dashboard.readiness.nextAction.href, '/zh/me?section=practice&due=1#wrong-bank', 'Readiness review action should jump to the wrong-question bank.');
}

async function testReadinessExamReadyWhenSignalsAreStable() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 1 : subject === 'physics' ? index + 11 : index + 21,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 4 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => makeStableHighDifficultyRounds()
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 93,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'chemistry', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1001);
  assertEqual(dashboard.readiness.stage, 'exam_ready', 'Readiness should mark stable high-signal users as exam-ready.');
  assertEqual(dashboard.readiness.confidence, 'high', 'Exam-ready readiness should expose high confidence.');
  assert(dashboard.readiness.score >= 78, 'Exam-ready readiness should expose a high total score.');
  assertEqual(dashboard.readiness.dimensions.reduce((sum, dimension) => sum + dimension.maxScore, 0), 100, 'Readiness dimensions should still add up to 100.');
  assert(dashboard.readiness.dimensions.some((dimension) => dimension.key === 'evidence' && dimension.status === 'strong'), 'Exam-ready users should expose strong evidence sufficiency.');
  assertEqual(dashboard.readiness.difficulty.highDifficultySubjectReadyCount, 3, 'Exam-ready users should satisfy per-subject high-difficulty thresholds.');
  assert(dashboard.readiness.difficulty.highDifficultySubjectThresholds.every((threshold) => threshold.source === 'default'), 'Default threshold mode should expose default threshold source.');
  assertEqual(dashboard.readiness.nextAction.type, 'keep_training', 'Exam-ready users should be guided to maintain training.');
  assertEqual(dashboard.readiness.blockers.length, 0, 'Exam-ready users should not show blockers.');
}

async function testReadinessHighDifficultyThresholdUsesSampledDistribution() {
  const previousMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
  process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = 'sampled';
  try {
    const startDate = new Date('2026-05-29T16:00:00.000Z');
    const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
      id: subject === 'math' ? index + 1 : subject === 'physics' ? index + 11 : index + 21,
      subject,
      title: `${subject}-${index + 1}`,
      weight: index < 2 ? 2 : 1
    })));
    const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
      localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
      activeScore: 120,
      answeredCount: 10,
      correctCount: 9,
      wrongCount: 1,
      unansweredCount: 0,
      practiceSeconds: 900,
      mockSeconds: 0,
      aiInteractionCount: 0,
      isStreakEligible: true
    }));
    const distributionRounds = [
      ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 4, total: 4, userId: 300 + index })),
      ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'physics', topicStart: 11, correctCount: 2, total: 2, userId: 400 + index })),
      ...Array.from({ length: 8 }, (_, index) => makeHighDifficultyRound({ subject: 'chemistry', topicStart: 21, correctCount: 2, total: 2, userId: 500 + index }))
    ];
    const service = new CscaLearningService(makeBasePrisma({
      cscaLearningDailySnapshot: {
        findMany: async ({ where }) => {
          if (where.subject === 'all') return snapshotRows;
          if (['math', 'physics', 'chemistry'].includes(where.subject)) {
            return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
          }
          if (where.subject?.in) {
            return ['math', 'physics', 'chemistry'].flatMap((subject) => [
              { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
              { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
            ]);
          }
          return [];
        },
        aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
        count: async () => 12
      },
      cscaExamTopic: {
        findMany: async ({ where }) => topics.filter((topic) => !where.subject || topic.subject === where.subject)
      },
      userCscaTopicMastery: {
        findMany: async ({ where }) => topics
          .filter((topic) => !where.subject || topic.subject === where.subject)
          .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 4 }))
      },
      cscaAdaptiveRound: {
        findFirst: async () => null,
        findMany: async ({ where }) => where.session?.userId ? makeStableHighDifficultyRounds() : distributionRounds
      },
      cscaAdaptiveSession: {
        findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
      },
      mockExamAttempt: {
        findMany: async () => [{
          id: 93,
          submittedAt: new Date('2026-06-08T10:00:00.000Z'),
          score: 88,
          correctCount: 42,
          wrongCount: 6,
          unansweredCount: 0,
          timeSpent: { 1: 60, 2: 70 },
          paper: { subject: 'chemistry', questionCount: 48 }
        }]
      }
    }));

    const dashboard = await service.getDashboard(1001);
    const mathThreshold = dashboard.readiness.difficulty.highDifficultySubjectThresholds.find((threshold) => threshold.subject === 'math');
    assert(mathThreshold, 'Readiness should expose math high-difficulty threshold.');
    assertEqual(mathThreshold.source, 'sampled_distribution', 'Sampled threshold mode should expose sampled source when sample size is sufficient.');
    assertEqual(mathThreshold.sampleSize, 8, 'Sampled threshold should expose distribution sample size.');
    assertEqual(mathThreshold.recommendedCount, 4, 'Sampled threshold should expose distribution recommendation.');
    assertEqual(mathThreshold.requiredCount, 4, 'Sampled threshold mode should apply distribution recommendation.');
    assertEqual(mathThreshold.ready, false, 'User should not satisfy raised sampled math threshold with only 3 samples.');
    assert(dashboard.readiness.stage !== 'exam_ready', 'Raised sampled threshold should block exam-ready.');
  } finally {
    if (previousMode === undefined) {
      delete process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE;
    } else {
      process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE = previousMode;
    }
  }
}

async function testReadinessWeakDifficultyTopicBlocksExamReady() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 1 : subject === 'physics' ? index + 11 : index + 21,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => {
        if (where.id?.in) return topics.filter((topic) => where.id.in.includes(topic.id));
        return topics.filter((topic) => topic.subject === where.subject);
      }
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 8 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeWeakDifficultyTopicRound()]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 96,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'chemistry', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1004);
  assertEqual(dashboard.readiness.difficulty.lowDifficultyAdjustedTopicCount, 1, 'Readiness should expose weak difficulty-adjusted topics.');
  assertEqual(dashboard.readiness.difficulty.weakDifficultyTopics[0]?.topicId, 1, 'Weak difficulty topic should identify the unstable topic.');
  assert(dashboard.readiness.stage !== 'exam_ready', 'Weak difficulty-adjusted topic should block exam-ready.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('较难题') || blocker.includes('不稳')), 'Readiness should explain difficulty-adjusted topic instability in user-facing language.');
}

async function testReadinessMockExamSourceFeedsDifficultyTopics() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 1 : subject === 'physics' ? index + 11 : index + 21,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => {
        if (where.id?.in) return topics.filter((topic) => where.id.in.includes(topic.id));
        return topics.filter((topic) => topic.subject === where.subject);
      }
    },
    cscaTopicMapping: {
      findMany: async () => []
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 8 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeHighDifficultyRound({ correctCount: 8, total: 8 })]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 97,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        answers: { 1001: 'B', 1002: 'C', 1003: '' },
        timeSpent: { 1001: 60, 1002: 70, 1003: 80 },
        paper: {
          subject: 'math',
          questionCount: 48,
          questions: [
            { id: 1001, correctAnswer: 'A', knowledgeTags: ['math-1'] },
            { id: 1002, correctAnswer: 'A', knowledgeTags: ['math-1'] },
            { id: 1003, correctAnswer: 'A', knowledgeTags: ['math-1'] }
          ]
        }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1005);
  const weakTopic = dashboard.readiness.difficulty.weakDifficultyTopics.find((topic) => topic.topicId === 1);
  assert(weakTopic, 'Mock exam topic fallback evidence should feed weak difficulty topics.');
  assert(weakTopic.sourceWeight > 1, 'Mock exam topic evidence should raise the source weight above plain practice.');
  assert(dashboard.readiness.stage !== 'exam_ready', 'Weak mock-transfer topic should block exam-ready.');
}

async function testReadinessRequiresBroadHighDifficultySubjects() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 1 : subject === 'physics' ? index + 11 : index + 21,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => {
        if (where.id?.in) return topics.filter((topic) => where.id.in.includes(topic.id));
        return topics.filter((topic) => topic.subject === where.subject);
      }
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 8 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeHighDifficultyRound({ subject: 'math', topicStart: 1, correctCount: 8, total: 8 })]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 98,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'chemistry', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1006);
  assertEqual(dashboard.readiness.difficulty.highDifficultySubjectReadyCount, 1, 'Readiness should expose that only one subject has enough high-difficulty evidence.');
  assert(dashboard.readiness.stage !== 'exam_ready', 'Single-subject high-difficulty evidence should not be enough for exam-ready.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('中高难')), 'Readiness should explain missing cross-subject high-difficulty evidence.');
}

async function testReadinessPendingVerificationBlocksExamReady() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 401 : subject === 'physics' ? index + 421 : index + 441,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 4 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeHighDifficultyRound({ correctCount: 7, total: 8 })]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    cscaWrongPattern: {
      findMany: async () => [{
        id: 41,
        userId: 1004,
        subject: 'math',
        topicId: 401,
        topic: { title: 'math-1' },
        patternType: 'formula_or_rule',
        recurrenceCount: 2,
        status: 'improving',
        lastWrongAt: new Date('2026-06-06T10:00:00.000Z'),
        lastCorrectAt: null,
        nextReviewAt: new Date('2099-06-20T10:00:00.000Z'),
        metadata: { reviewCount: 1, lastReviewCompletedAt: '2026-06-08T10:00:00.000Z' }
      }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 96,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1004);
  const reviewDimension = dashboard.readiness.dimensions.find((dimension) => dimension.key === 'review');
  assert(dashboard.readiness.stage !== 'exam_ready', 'Pending repair verification must block exam-ready readiness.');
  assertEqual(dashboard.readiness.nextAction.type, 'review_due_patterns', 'Pending verification should guide users back to the review queue.');
  assertEqual(dashboard.readiness.nextActions[0].type, dashboard.readiness.nextAction.type, 'Top ranked next action should remain the primary readiness action.');
  assert(dashboard.readiness.nextActions.length >= 2, 'Readiness should expose multiple ranked next actions when more than one useful move exists.');
  assert(dashboard.readiness.nextActions[0].expectedGain >= dashboard.readiness.nextActions[1].expectedGain, 'Ranked next actions should be sorted by expected gain.');
  assertEqual(reviewDimension?.status, 'steady', 'Pending verification should lower review stability below strong.');
  assert(reviewDimension?.evidence.includes('同类题确认'), 'Review evidence should explain pending verification.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('同类题确认') || blocker.includes('修好')), 'Readiness should expose pending repair verification as a blocker.');
}

async function testReadinessActionClickIsRecorded() {
  const events = [];
  const service = new CscaLearningService(makeBasePrisma({
    userCscaTopicMastery: {
      findMany: async () => [
        { topicId: 7, subject: 'math', mastery: 0.42, confidence: 0.24 },
        { topicId: 9, subject: 'physics', mastery: 0.58, confidence: 0.38 }
      ]
    },
    cscaTrainingEvent: {
      create: async ({ data }) => {
        events.push(data);
        return { id: 1, createdAt: new Date('2026-06-08T12:00:00.000Z'), ...data };
      }
    }
  }));

  const result = await service.recordReadinessActionClick(808, {
    type: 'review_due_patterns',
    href: '/zh/me?section=practice&due=1#wrong-bank',
    expectedGain: 20,
    priority: 'high',
    rank: 1,
    stage: 'repairing',
    score: 71,
    source: 'readiness_card'
  });
  assertEqual(result.recorded, true, 'Readiness action click should report recorded state.');
  assertEqual(events.length, 1, 'Readiness action click should create one training event.');
  assertEqual(events[0].eventType, 'readiness_action_clicked', 'Readiness action click should use a stable event type.');
  assertEqual(events[0].source, 'learning_dashboard', 'Readiness action click should use learning dashboard source.');
  assertEqual(events[0].metadata.actionType, 'review_due_patterns', 'Readiness action click should keep action type metadata.');
  assertEqual(events[0].metadata.expectedGain, 20, 'Readiness action click should keep expected gain metadata.');
  assertEqual(events[0].metadata.masteryBaseline[0].topicId, 7, 'Readiness action click should snapshot weakest topic mastery baseline.');
}

async function testReadinessActionOutcomeTracksFollowThrough() {
  const clickedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const followedAt = new Date(clickedAt.getTime() + 45 * 60 * 1000);
  const service = new CscaLearningService(makeBasePrisma({
    cscaTrainingEvent: {
      findMany: async ({ where }) => {
        if (where.eventType === 'readiness_action_clicked') {
          return [{
            id: 1,
            userId: 9090,
            subject: null,
            sessionId: null,
            roundId: null,
            questionId: null,
            eventType: 'readiness_action_clicked',
            source: 'learning_dashboard',
            metadata: {
              actionType: 'repair_weak_subject',
              expectedGain: 18,
              score: 40,
              masteryBaseline: [{ topicId: 301, mastery: 0.52, confidence: 0.32 }]
            },
            createdAt: clickedAt
          }];
        }
        if (where.eventType?.in?.includes('practice_round_completed')) {
          return [{
            id: 2,
            userId: 9090,
            subject: 'math',
            sessionId: 11,
            roundId: 22,
            questionId: null,
            eventType: 'practice_round_completed',
            source: 'adaptive',
            metadata: { accuracy: 0.8 },
            createdAt: followedAt
          }];
        }
        return [];
      }
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => {
        if (where.updatedAt) {
          return [{
            userId: 9090,
            topicId: 301,
            updatedAt: new Date(clickedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
            mastery: 0.64,
            confidence: 0.42
          }];
        }
        return [];
      }
    }
  }));

  const dashboard = await service.getDashboard(9090);
  assertEqual(dashboard.readiness.actionOutcome.clickedCount, 1, 'Readiness action outcome should count recent clicks.');
  assertEqual(dashboard.readiness.actionOutcome.followedCount, 1, 'Readiness action outcome should match a follow-up practice event.');
  assertEqual(dashboard.readiness.actionOutcome.followThroughRate, 1, 'Readiness action outcome should expose follow-through rate.');
  assertEqual(dashboard.readiness.actionOutcome.abilityLiftCount, 1, 'Readiness action outcome should count post-action mastery lift.');
  assertEqual(dashboard.readiness.actionOutcome.abilityLiftRate, 1, 'Readiness action outcome should expose ability lift rate.');
  assertEqual(dashboard.readiness.actionOutcome.averageMasteryDelta, 0.12, 'Readiness action outcome should expose real topic mastery delta.');
  assertEqual(dashboard.readiness.actionOutcome.averageExpectedGain, 18, 'Readiness action outcome should average expected gain.');
  assertEqual(dashboard.readiness.actionOutcome.topActionType, 'repair_weak_subject', 'Readiness action outcome should expose the most clicked action type.');
}

async function testReadinessActionCalibrationAdjustsExpectedGain() {
  const clickedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 501 : subject === 'physics' ? index + 521 : index + 541,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.82 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.78 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.82, confidence: 0.7, attemptCount: 4 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeHighDifficultyRound({ correctCount: 7, total: 8 })]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    cscaWrongPattern: {
      findMany: async () => [{
        id: 51,
        userId: 1005,
        subject: 'math',
        topicId: 501,
        topic: { title: 'math-1' },
        patternType: 'formula_or_rule',
        recurrenceCount: 3,
        status: 'active',
        lastWrongAt: new Date('2026-06-08T10:00:00.000Z'),
        lastCorrectAt: null,
        nextReviewAt: new Date('2026-06-08T12:00:00.000Z'),
        metadata: {}
      }]
    },
    cscaTrainingEvent: {
      findMany: async ({ where }) => {
        if (where.eventType === 'readiness_action_clicked') {
          return Array.from({ length: 5 }, (_, index) => ({
            id: index + 1,
            userId: index + 200,
            subject: null,
            sessionId: null,
            roundId: null,
            questionId: null,
            eventType: 'readiness_action_clicked',
            source: 'learning_dashboard',
            metadata: { actionType: 'review_due_patterns', expectedGain: 26, score: 64 },
            createdAt: new Date(clickedAt.getTime() + index * 60 * 1000)
          }));
        }
        return [];
      }
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 97,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 80,
        correctCount: 38,
        wrongCount: 10,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1005);
  const reviewAction = dashboard.readiness.nextActions.find((action) => action.type === 'review_due_patterns');
  assert(reviewAction, 'Readiness should include review action when reviews are due.');
  assertEqual(reviewAction.calibration.status, 'needs_calibration', 'Low follow-through review actions should be flagged for calibration.');
  assert(reviewAction.expectedGain < reviewAction.baseExpectedGain, 'Low follow-through calibration should lower expected gain.');
}

async function testReadinessActionCalibrationUsesAbilityLift() {
  const clickedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 601 : subject === 'physics' ? index + 621 : index + 641,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const calibrationSnapshots = [];
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.62 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.58 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.62 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => {
        if (where.updatedAt) {
          return Array.from({ length: 5 }, (_, index) => ({
            userId: index + 300,
            topicId: 601,
            updatedAt: new Date(clickedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
            mastery: 0.66,
            confidence: 0.44
          }));
        }
        return topics
          .filter((topic) => !where.subject || topic.subject === where.subject)
          .map((topic) => ({ topicId: topic.id, mastery: 0.62, confidence: 0.55, attemptCount: 4 }));
      }
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => makeStableHighDifficultyRounds()
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    cscaTrainingEvent: {
      findMany: async ({ where }) => {
        if (where.eventType === 'readiness_action_clicked') {
          return Array.from({ length: 5 }, (_, index) => ({
            id: index + 1,
            userId: index + 300,
            subject: null,
            sessionId: null,
            roundId: null,
            questionId: null,
            eventType: 'readiness_action_clicked',
            source: 'learning_dashboard',
            metadata: { actionType: 'repair_weak_subject', expectedGain: 18, score: 58, masteryBaseline: [{ topicId: 601, mastery: 0.58, confidence: 0.38 }] },
            createdAt: new Date(clickedAt.getTime() + index * 60 * 1000)
          }));
        }
        if (where.eventType?.in?.includes('practice_round_completed')) {
          return Array.from({ length: 5 }, (_, index) => ({
            id: index + 20,
            userId: index + 300,
            subject: 'math',
            eventType: 'practice_round_completed',
            source: 'adaptive',
            metadata: { accuracy: 0.8 },
            createdAt: new Date(clickedAt.getTime() + 45 * 60 * 1000)
          }));
        }
        return [];
      }
    },
    cscaReadinessActionCalibrationSnapshot: {
      findMany: async () => [],
      upsert: async ({ create, update }) => {
        calibrationSnapshots.push(create ?? update);
        return { id: calibrationSnapshots.length, ...(create ?? update) };
      }
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 98,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 80,
        correctCount: 38,
        wrongCount: 10,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1006);
  const repairAction = dashboard.readiness.nextActions.find((action) => action.type === 'repair_weak_subject');
  assert(repairAction, 'Readiness should include repair action for weak mastery.');
  assertEqual(repairAction.calibration.status, 'positive', 'Ability lift should make repair action calibration positive.');
  assertEqual(repairAction.calibration.abilityLiftRate, 1, 'Ability lift calibration should expose lift rate.');
  assertEqual(repairAction.calibration.averageMasteryDelta, 0.08, 'Ability lift calibration should expose average topic mastery delta.');
  assert(repairAction.expectedGain > repairAction.baseExpectedGain, 'Ability lift calibration should raise expected gain.');
  assertEqual(calibrationSnapshots.length, 0, 'Dashboard realtime calibration fallback should not write daily snapshots.');

  const refreshResult = await service.refreshReadinessActionCalibrationSnapshots('admin_manual');
  assertEqual(refreshResult.actionTypes, 1, 'Manual calibration refresh should return refreshed action type count.');
  assertEqual(refreshResult.clickedCount, 5, 'Manual calibration refresh should return clicked count.');
  assert(calibrationSnapshots.some((snapshot) => snapshot.actionType === 'repair_weak_subject' && snapshot.abilityLiftRate === 1 && snapshot.averageMasteryDelta === 0.08), 'Manual calibration refresh should persist a daily snapshot.');
}

async function testReadinessActionCalibrationReadsSnapshotFirst() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 701 : subject === 'physics' ? index + 721 : index + 741,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  let trainingEventQueried = false;
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.62 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.58 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.62 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.62, confidence: 0.55, attemptCount: 4 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => makeStableHighDifficultyRounds()
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    cscaReadinessActionCalibrationSnapshot: {
      findMany: async () => [{
        snapshotDate: new Date(),
        actionType: 'repair_weak_subject',
        clickedCount: 12,
        followThroughRate: 0.5,
        abilityLiftRate: 0.67,
        averageMasteryDelta: 0.09,
        multiplier: 1.2,
        status: 'positive'
      }]
    },
    cscaTrainingEvent: {
      findMany: async ({ where }) => {
        if (!where.userId) trainingEventQueried = true;
        return [];
      }
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 99,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 80,
        correctCount: 38,
        wrongCount: 10,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1007);
  const repairAction = dashboard.readiness.nextActions.find((action) => action.type === 'repair_weak_subject');
  assert(repairAction, 'Readiness should include repair action for weak mastery.');
  assertEqual(repairAction.calibration.sampleSize, 12, 'Snapshot calibration should expose persisted sample size.');
  assertEqual(repairAction.calibration.abilityLiftRate, 0.67, 'Snapshot calibration should expose persisted ability lift rate.');
  assertEqual(repairAction.calibration.averageMasteryDelta, 0.09, 'Snapshot calibration should expose persisted mastery delta.');
  assert(repairAction.expectedGain > repairAction.baseExpectedGain, 'Snapshot calibration should raise expected gain.');
  assertEqual(trainingEventQueried, false, 'Snapshot calibration should avoid realtime training event aggregation.');
}

async function testReadinessHighVolumeLowCoverageIsNotReady() {
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 10 }, (_, index) => ({
    id: subject === 'math' ? index + 201 : subject === 'physics' ? index + 221 : index + 241,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 4 ? 2 : 1
  })));
  const coveredTopicIds = new Set([201, 221, 241]);
  const snapshotRows = Array.from({ length: 10 }, (_, index) => ({
    localDate: new Date(new Date('2026-05-31T16:00:00.000Z').getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 12,
    correctCount: 11,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.9 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.9 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 110 } }),
      count: async () => 10
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .filter((topic) => coveredTopicIds.has(topic.id))
        .map((topic) => ({ topicId: topic.id, mastery: 0.9, confidence: 0.72, attemptCount: 20 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [makeHighDifficultyRound({ correctCount: 8, total: 8 })]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 94,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 86,
        correctCount: 41,
        wrongCount: 7,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1002);
  assert(dashboard.readiness.stage !== 'exam_ready', 'High volume with narrow topic coverage must not be exam-ready.');
  assertEqual(dashboard.readiness.dimensions.find((dimension) => dimension.key === 'coverage')?.status, 'weak', 'Low topic coverage should be a weak readiness dimension.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('覆盖')), 'Readiness should explain low coverage as a blocker.');
}

async function testReadinessBasicDifficultyOnlyIsNotReady() {
  const startDate = new Date('2026-05-29T16:00:00.000Z');
  const topics = ['math', 'physics', 'chemistry'].flatMap((subject) => Array.from({ length: 4 }, (_, index) => ({
    id: subject === 'math' ? index + 301 : subject === 'physics' ? index + 321 : index + 341,
    subject,
    title: `${subject}-${index + 1}`,
    weight: index < 2 ? 2 : 1
  })));
  const snapshotRows = Array.from({ length: 12 }, (_, index) => ({
    localDate: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000),
    activeScore: 120,
    answeredCount: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    practiceSeconds: 900,
    mockSeconds: 0,
    aiInteractionCount: 0,
    isStreakEligible: true
  }));
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => {
        if (where.subject === 'all') return snapshotRows;
        if (['math', 'physics', 'chemistry'].includes(where.subject)) {
          return snapshotRows.map((row) => ({ ...row, answeredCount: 4, correctCount: 4, masteryAvg: 0.88 }));
        }
        if (where.subject?.in) {
          return ['math', 'physics', 'chemistry'].flatMap((subject) => [
            { localDate: new Date('2026-06-01T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.82 },
            { localDate: new Date('2026-06-08T16:00:00.000Z'), subject, answeredCount: 10, masteryAvg: 0.88 }
          ]);
        }
        return [];
      },
      aggregate: async () => ({ _sum: { answeredCount: 120, correctCount: 108 } }),
      count: async () => 12
    },
    cscaExamTopic: {
      findMany: async ({ where }) => topics.filter((topic) => topic.subject === where.subject)
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => topics
        .filter((topic) => !where.subject || topic.subject === where.subject)
        .map((topic) => ({ topicId: topic.id, mastery: 0.88, confidence: 0.72, attemptCount: 8 }))
    },
    cscaAdaptiveRound: {
      findFirst: async () => null,
      findMany: async () => [{
        submittedAt: new Date('2026-06-08T11:00:00.000Z'),
        items: Array.from({ length: 12 }, () => ({
          plannedDifficulty: '基础',
          isCorrect: true,
          usedHint: false,
          usedExplanation: false
        }))
      }]
    },
    cscaAdaptiveSession: {
      findMany: async () => [{ subject: 'math' }, { subject: 'physics' }, { subject: 'chemistry' }]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 95,
        submittedAt: new Date('2026-06-08T10:00:00.000Z'),
        score: 88,
        correctCount: 42,
        wrongCount: 6,
        unansweredCount: 0,
        timeSpent: { 1: 60, 2: 70 },
        paper: { subject: 'math', questionCount: 48 }
      }]
    }
  }));

  const dashboard = await service.getDashboard(1003);
  assert(dashboard.readiness.stage !== 'exam_ready', 'High scores from basic questions only must not be exam-ready.');
  assertEqual(dashboard.readiness.confidence, 'low', 'Basic-only evidence should keep readiness confidence low.');
  assertEqual(dashboard.readiness.difficulty.independentHighDifficultyAttemptCount, 0, 'Readiness should expose missing independent high-difficulty evidence.');
  assert(dashboard.readiness.blockers.some((blocker) => blocker.includes('中高难题')), 'Readiness should explain missing high-difficulty evidence as a blocker.');
}

async function testCorrectEvidenceImprovesAndResolvesWrongPatterns() {
  const updates = [];
  const service = new CscaLearningService(makeBasePrisma({
    cscaWrongPattern: {
      findMany: async () => [
        {
          id: 21,
          userId: 808,
          subject: 'math',
          topicId: 7,
          patternType: 'calculation',
          recurrenceCount: 2,
          status: 'active',
          metadata: { correctEvidenceCount: 0 }
        },
        {
          id: 22,
          userId: 808,
          subject: 'math',
          topicId: 7,
          patternType: 'formula_or_rule',
          recurrenceCount: 3,
          status: 'improving',
          metadata: { correctEvidenceCount: 1 }
        }
      ],
      update: async ({ where, data }) => {
        updates.push({ where, data });
        return { id: where.id, ...data };
      }
    }
  }));

  await service.recordWrongPatternCorrectEvidence({
    userId: 808,
    subject: 'math',
    occurredAt: new Date('2026-06-08T08:00:00.000Z'),
    items: [{ questionId: 31, topicId: 7 }]
  });
  assertEqual(updates.length, 2, 'Correct evidence should update active and improving patterns for the same topic.');
  assertEqual(updates[0].data.status, 'improving', 'First correct evidence should move an active pattern to improving.');
  assertEqual(updates[0].data.metadata.correctEvidenceCount, 1, 'First correct evidence should be recorded.');
  assertEqual(updates[1].data.status, 'resolved', 'Second correct evidence should resolve an improving pattern.');
  assertEqual(updates[1].data.nextReviewAt, null, 'Resolved pattern should leave the active review queue.');
}

async function testCorrectEvidenceDoesNotVerifyReviewedPatterns() {
  const updates = [];
  const reviewedPattern = {
    id: 41,
    userId: 808,
    subject: 'math',
    topicId: 7,
    patternType: 'calculation',
    recurrenceCount: 2,
    status: 'improving',
    lastCorrectAt: null,
    metadata: { correctEvidenceCount: 1, lastReviewCompletedAt: '2026-06-08T08:00:00.000Z' }
  };
  const service = new CscaLearningService(makeBasePrisma({
    cscaWrongPattern: {
      findMany: async () => [reviewedPattern],
      update: async ({ where, data }) => {
        updates.push({ where, data });
        return { ...reviewedPattern, id: where.id, ...data };
      }
    }
  }));

  await service.recordWrongPatternCorrectEvidence({
    userId: 808,
    subject: 'math',
    occurredAt: new Date('2026-06-08T09:00:00.000Z'),
    items: [{ questionId: 31, topicId: 7 }]
  });
  assertEqual(updates.length, 1, 'Correct evidence should still update the reviewed pattern.');
  assertEqual(updates[0].data.status, 'improving', 'Ordinary correct evidence must not resolve a reviewed pattern that still needs verification.');
  assert(updates[0].data.nextReviewAt instanceof Date, 'Pending verification should remain in the review flow.');
  assertEqual(updates[0].data.metadata.verificationCompletedAt, undefined, 'Ordinary correct evidence must not write verification completion.');
}

async function testWrongPatternVerificationPassesAndFailsExplicitly() {
  const updates = [];
  const pattern = {
    id: 51,
    userId: 909,
    subject: 'math',
    topicId: 9,
    patternType: 'visual_interpretation',
    recurrenceCount: 4,
    status: 'improving',
    lastCorrectAt: null,
    nextReviewAt: new Date('2026-06-09T10:00:00.000Z'),
    metadata: { recentQuestionIds: [101, 102], reviewCount: 2, lastReviewCompletedAt: '2026-06-08T10:00:00.000Z' }
  };
  const service = new CscaLearningService(makeBasePrisma({
    cscaWrongPattern: {
      findFirst: async ({ where }) => where.id === 51 && where.userId === 909 ? pattern : null,
      update: async ({ where, data }) => {
        updates.push({ where, data });
        return { ...pattern, id: where.id, ...data };
      }
    }
  }));

  const passed = await service.recordWrongPatternVerification({
    userId: 909,
    subject: 'math',
    patternId: 51,
    roundId: 88,
    topicId: 9,
    patternType: 'visual_interpretation',
    passed: true,
    targetCorrectCount: 3,
    targetTotal: 3,
    overallCorrectCount: 4,
    overallTotal: 5,
    occurredAt: new Date('2026-06-08T11:00:00.000Z')
  });
  assertEqual(passed.verificationStatus, 'verified_repaired', 'Passing verification should mark the wrong pattern repaired.');
  assertEqual(updates[0].data.status, 'resolved', 'Passing verification should resolve the pattern.');
  assertEqual(updates[0].data.nextReviewAt, null, 'Passing verification should clear the next review date.');
  assertEqual(updates[0].data.metadata.lastVerificationTargetAccuracy, 100, 'Passing verification should record target accuracy.');
  assert(updates[0].data.metadata.verificationCompletedAt, 'Passing verification should write completion time.');

  const failed = await service.recordWrongPatternVerification({
    userId: 909,
    subject: 'math',
    patternId: 51,
    roundId: 89,
    topicId: 9,
    patternType: 'visual_interpretation',
    passed: false,
    targetCorrectCount: 2,
    targetTotal: 3,
    overallCorrectCount: 3,
    overallTotal: 5,
    occurredAt: new Date('2026-06-09T11:00:00.000Z')
  });
  assertEqual(failed.verificationStatus, 'pending_verification', 'Failing verification should keep the pattern pending verification.');
  assertEqual(updates[1].data.status, 'improving', 'Failing verification should return the pattern to improving.');
  assert(updates[1].data.nextReviewAt instanceof Date, 'Failing verification should schedule the next review.');
  assertEqual(updates[1].data.metadata.verificationCompletedAt, null, 'Failing verification should clear completion state.');
  assert(updates[1].data.metadata.verificationFailedAt, 'Failing verification should record failure time.');
}

async function testWrongPatternReviewQueueAndCompletion() {
  const updates = [];
  const duePattern = {
    id: 31,
    userId: 909,
    subject: 'math',
    topicId: 9,
    topic: { title: '函数图像' },
    patternType: 'visual_interpretation',
    recurrenceCount: 4,
    status: 'active',
    lastWrongAt: new Date('2026-06-07T10:00:00.000Z'),
    lastCorrectAt: null,
    nextReviewAt: new Date('2026-06-08T10:00:00.000Z'),
    metadata: { recentQuestionIds: [101, 102], reviewCount: 1, lastReviewCompletedAt: '2026-06-06T10:00:00.000Z' }
  };
  const service = new CscaLearningService(makeBasePrisma({
    cscaWrongPattern: {
      findMany: async ({ where }) => where.status?.in?.includes('active') ? [duePattern] : [],
      findFirst: async ({ where }) => where.id === 31 && where.userId === 909 ? duePattern : null,
      update: async ({ where, data }) => {
        updates.push({ where, data });
        return { ...duePattern, id: where.id, ...data };
      }
    }
  }));

  const queue = await service.getWrongPatternReviewQueue(909, { subject: 'math', language: 'zh', limit: 5 });
  assertEqual(queue.summary.total, 1, 'Review queue should expose due wrong patterns.');
  assertEqual(queue.summary.dueToday, 1, 'Review queue should count due items.');
  assertEqual(queue.items[0].topicTitle, '函数图像', 'Review queue item should keep topic context.');
  assertEqual(queue.items[0].recentQuestionIds.length, 2, 'Review queue item should expose recent question ids.');
  assertEqual(queue.items[0].verificationStatus, 'pending_verification', 'Reviewed patterns without later correct evidence should require verification.');
  assertEqual(queue.items[0].verificationRequired, true, 'Review queue should expose pending verification state.');

  const result = await service.completeWrongPatternReview(909, 31);
  assertEqual(result.status, 'improving', 'Completing a review should move the pattern to improving.');
  assertEqual(result.reviewCount, 2, 'Completing a review should increment metadata review count.');
  assertEqual(result.verificationRequired, true, 'Completing a review should require a later repair verification.');
  assert(result.verificationHref.includes('verify=31'), 'Completing a review should return a verification training href.');
  assert(result.verificationHref.includes('topicId=9'), 'Verification training href should preserve the reviewed topic.');
  assert(updates[0].data.nextReviewAt instanceof Date, 'Completing a review should schedule the next review.');
}

async function testMockTrendReturnsSubjectBackflow() {
  const service = new CscaLearningService(makeBasePrisma({
    cscaLearningDailySnapshot: {
      findMany: async ({ where }) => where.subject === 'all'
        ? [{
          localDate: new Date('2026-06-07T16:00:00.000Z'),
          activeScore: 120,
          answeredCount: 76,
          correctCount: 49,
          wrongCount: 27,
          unansweredCount: 20,
          practiceSeconds: 0,
          mockSeconds: 5400,
          aiInteractionCount: 0,
          isStreakEligible: true
        }]
        : [],
      aggregate: async () => ({ _sum: { answeredCount: 76, correctCount: 49 } }),
      count: async () => 1
    },
    mockExamAttempt: {
      findMany: async () => [
        {
          id: 91,
          submittedAt: new Date('2026-06-07T10:00:00.000Z'),
          score: 58,
          correctCount: 28,
          wrongCount: 12,
          unansweredCount: 8,
          timeSpent: { 1: 60, 2: 60 },
          paper: { subject: 'math', questionCount: 48 }
        },
        {
          id: 90,
          submittedAt: new Date('2026-06-05T10:00:00.000Z'),
          score: 72,
          correctCount: 34,
          wrongCount: 8,
          unansweredCount: 6,
          timeSpent: { 1: 90 },
          paper: { subject: 'physics', questionCount: 48 }
        }
      ]
    }
  }));

  const dashboard = await service.getDashboard(808);
  assertEqual(dashboard.mockTrend.latest?.id, 91, 'Mock trend should expose latest submitted mock attempt.');
  assertEqual(dashboard.mockTrend.recent.length, 2, 'Mock trend should expose recent attempts chronologically.');
  assertEqual(dashboard.mockTrend.subjectStats[0].subject, 'math', 'Mock trend should prioritize weakest subject for backflow.');
  assertEqual(dashboard.mockTrend.nextAction?.href, '/zh/csca-subjects/math', 'Mock trend should point back to subject training.');
}

async function main() {
  testReadinessCalibrationSchedulerUsesShanghaiTime();
  await testAdminTrainingObservabilityExposesHighDifficultyThresholdDistribution();
  await testAdminTrainingObservabilityExposesReadinessCalibrationHealthAlerts();
  await testAdminTrainingObservabilityExposesSampledThresholdRolloutReadiness();
  await testSnapshotPathWins();
  await testHistoricalFallback();
  await testCachedWeeklyInsight();
  await testGenerateWeeklyInsightEndpointDoesNotChargeOrCallProvider();
  await testActivityDoesNotAutoGenerateWithoutEnoughEvidence();
  await testActivityAutoGeneratesWhenEvidenceIsEnough();
  await testWrongPatternsAreAggregatedAndExposed();
  await testReadinessPrioritizesDueReviewsAfterBaseline();
  await testReadinessExamReadyWhenSignalsAreStable();
  await testReadinessHighDifficultyThresholdUsesSampledDistribution();
  await testReadinessWeakDifficultyTopicBlocksExamReady();
  await testReadinessMockExamSourceFeedsDifficultyTopics();
  await testReadinessRequiresBroadHighDifficultySubjects();
  await testReadinessPendingVerificationBlocksExamReady();
  await testReadinessActionClickIsRecorded();
  await testReadinessActionOutcomeTracksFollowThrough();
  await testReadinessActionCalibrationAdjustsExpectedGain();
  await testReadinessActionCalibrationUsesAbilityLift();
  await testReadinessActionCalibrationReadsSnapshotFirst();
  await testReadinessHighVolumeLowCoverageIsNotReady();
  await testReadinessBasicDifficultyOnlyIsNotReady();
  await testCorrectEvidenceImprovesAndResolvesWrongPatterns();
  await testCorrectEvidenceDoesNotVerifyReviewedPatterns();
  await testWrongPatternVerificationPassesAndFailsExplicitly();
  await testWrongPatternReviewQueueAndCompletion();
  await testMockTrendReturnsSubjectBackflow();
  console.log('CSCA learning dashboard rule tests passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
