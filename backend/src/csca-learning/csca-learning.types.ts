export type CscaLearningSubject = 'math' | 'physics' | 'chemistry';

export type LearningActivitySource = 'adaptive_practice' | 'adaptive_diagnostic' | 'mock_exam';

export type RecordLearningActivityInput = {
  userId: number;
  subject: string;
  source: LearningActivitySource;
  occurredAt?: Date;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  practiceSeconds?: number;
  mockSeconds?: number;
  aiInteractionCount?: number;
};

export type RecordWrongPatternItemInput = {
  questionId: number;
  questionSource?: string | null;
  topicId?: number | null;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  isUnanswered?: boolean;
  knowledgeTags?: string[];
  secondsSpent?: number;
};

export type RecordWrongPatternsInput = {
  userId: number;
  subject: string;
  source: LearningActivitySource;
  occurredAt?: Date;
  items: RecordWrongPatternItemInput[];
};

export type RecordWrongPatternCorrectEvidenceInput = {
  userId: number;
  subject: string;
  occurredAt?: Date;
  items: Array<{
    questionId: number;
    questionSource?: string | null;
    topicId?: number | null;
    knowledgeTags?: string[];
    secondsSpent?: number;
  }>;
};

export type RecordWrongPatternVerificationInput = {
  userId: number;
  subject: string;
  patternId: number;
  roundId?: number;
  topicId?: number | null;
  patternType?: string | null;
  occurredAt?: Date;
  passed: boolean;
  targetCorrectCount: number;
  targetTotal: number;
  overallCorrectCount: number;
  overallTotal: number;
};

export type LearningDashboardSubject = {
  subject: CscaLearningSubject;
  label: string;
  masteryAvg: number | null;
  answeredCount: number;
  accuracy: number | null;
  weakTopicCount: number;
  href: string;
};

export type LearningReadinessStage = 'diagnosing' | 'building' | 'repairing' | 'reinforcing' | 'exam_ready';
export type LearningReadinessDimensionKey = 'coverage' | 'mastery' | 'mock' | 'review' | 'rhythm' | 'evidence';
export type LearningReadinessDimensionStatus = 'strong' | 'steady' | 'weak' | 'insufficient';
export type LearningReadinessActionType =
  | 'start_diagnostic'
  | 'review_due_patterns'
  | 'continue_active_round'
  | 'repair_weak_subject'
  | 'resume_mock_attempt'
  | 'start_mock_exam'
  | 'keep_training';

export type ReadinessActionCalibrationSnapshotRefreshResult = {
  snapshotDate: string;
  windowDays: number;
  actionTypes: number;
  clickedCount: number;
  followedCount: number;
  abilityLiftCount: number;
  source: 'admin_manual' | 'scheduled';
  items: Array<{
    actionType: LearningReadinessActionType;
    clickedCount: number;
    followedCount: number;
    abilityLiftCount: number;
    followThroughRate: number | null;
    abilityLiftRate: number | null;
    averageMasteryDelta: number | null;
    multiplier: number;
    status: 'insufficient' | 'positive' | 'neutral' | 'needs_calibration';
  }>;
};

export type LearningReadiness = {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceReason: string;
  scoreExplanation: string;
  stage: LearningReadinessStage;
  title: string;
  body: string;
  dimensions: Array<{
    key: LearningReadinessDimensionKey;
    label: string;
    score: number;
    maxScore: number;
    status: LearningReadinessDimensionStatus;
    evidence: string;
  }>;
  coverage: {
    overallRate: number | null;
    highWeightCoverageRate: number | null;
    blindSpotCount: number;
    subjects: Array<{
      subject: CscaLearningSubject;
      subjectLabel: string;
      totalTopicCount: number;
      coveredTopicCount: number;
      coverageRate: number | null;
      highWeightCoverageRate: number | null;
      confidenceReadyTopicCount: number;
      lowConfidenceTopicCount: number;
      blindSpotCount: number;
      blindSpots: Array<{
        topicId: number;
        title: string;
        weight: number;
        reason: 'not_covered' | 'low_confidence';
      }>;
    }>;
  };
  difficulty: {
    attemptedCount: number;
    highDifficultyAttemptCount: number;
    independentHighDifficultyAttemptCount: number;
    highDifficultySubjectReadyCount: number;
    highDifficultySubjectThresholds: Array<{
      subject: CscaLearningSubject;
      attemptCount: number;
      requiredCount: number;
      recommendedCount: number;
      sampleSize: number;
      source: 'default' | 'env_override' | 'sampled_distribution';
      ready: boolean;
    }>;
    highDifficultyAccuracy: number | null;
    averageDifficultyRank: number | null;
    topicSignalCount: number;
    lowDifficultyAdjustedTopicCount: number;
    averageDifficultyAdjustedAccuracy: number | null;
    weakDifficultyTopics: Array<{
      topicId: number;
      subject: CscaLearningSubject;
      topicTitle: string;
      attemptCount: number;
      difficultyAdjustedAccuracy: number;
      averageDifficultyRank: number | null;
      sourceWeight: number;
    }>;
  };
  blockers: string[];
  nextMilestone: string;
  nextAction: {
    type: LearningReadinessActionType;
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  };
  nextActions: Array<{
    type: LearningReadinessActionType;
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
    expectedGain: number;
    baseExpectedGain: number;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    calibration: {
      multiplier: number;
      status: 'insufficient' | 'positive' | 'neutral' | 'needs_calibration';
      sampleSize: number;
      followThroughRate: number | null;
      abilityLiftRate: number | null;
      averageMasteryDelta: number | null;
    };
  }>;
  actionOutcome: {
    windowDays: number;
    clickedCount: number;
    followedCount: number;
    followThroughRate: number;
    abilityLiftCount: number;
    abilityLiftRate: number;
    averageMasteryDelta: number | null;
    averageExpectedGain: number | null;
    averageScoreDelta: number | null;
    topActionType: LearningReadinessActionType | null;
    lastClickedAt: string | null;
    status: 'no_data' | 'watching' | 'positive' | 'needs_calibration';
  };
};

export type LearningDashboardResponse = {
  summary: {
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number | null;
    practiceMinutesThisWeek: number;
    currentStreakDays: number;
    longestStreakDays: number;
    activeDaysLast30: number;
    totalActiveDays: number;
  };
  heatmap: Array<{
    date: string;
    level: 0 | 1 | 2 | 3 | 4;
    answeredCount: number;
    practiceMinutes: number;
    accuracy: number | null;
    isStreakEligible: boolean;
  }>;
  trend: Array<{
    date: string;
    answeredCount: number;
    accuracy: number | null;
    practiceMinutes: number;
  }>;
  subjects: LearningDashboardSubject[];
  masteryTrend: Array<{
    subject: CscaLearningSubject;
    subjectLabel: string;
    currentMastery: number | null;
    previousMastery: number | null;
    delta: number | null;
    weakTopicCount: number;
    answeredCount: number;
    points: Array<{
      date: string;
      mastery: number;
    }>;
  }>;
  wrongPatternTrend: Array<{
    patternType: string;
    label: string;
    activeCount: number;
    dueCount: number;
    recurrenceCount: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  rhythmEvaluation: {
    status: 'strong' | 'steady' | 'building' | 'at_risk';
    title: string;
    body: string;
    action: string;
    activeDaysLast30: number;
    activeDaysLast7: number;
    answeredLast14: number;
    answeredPrevious16: number;
    accuracyDelta: number | null;
  };
  mockTrend: {
    latest: {
      id: number;
      subject: CscaLearningSubject;
      subjectLabel: string;
      score: number;
      accuracy: number | null;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      total: number;
      totalSeconds: number;
      submittedAt: string | null;
      reportHref: string;
    } | null;
    recent: Array<{
      id: number;
      subject: CscaLearningSubject;
      subjectLabel: string;
      score: number;
      accuracy: number | null;
      unansweredCount: number;
      totalSeconds: number;
      submittedAt: string | null;
    }>;
    subjectStats: Array<{
      subject: CscaLearningSubject;
      subjectLabel: string;
      attemptCount: number;
      averageScore: number;
      latestScore: number;
      unansweredCount: number;
      href: string;
    }>;
    nextAction: {
      title: string;
      body: string;
      ctaLabel: string;
      href: string;
    } | null;
  };
  wrongPatterns: Array<{
    id: number;
    subject: CscaLearningSubject;
    subjectLabel: string;
    topicId: number | null;
    topicTitle: string;
    patternType: string;
    label: string;
    recurrenceCount: number;
    status: string;
    priority: 'high' | 'medium' | 'low';
    lastWrongAt: string | null;
    lastCorrectAt: string | null;
    nextReviewAt: string | null;
    lastReviewCompletedAt: string | null;
    verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
    verificationRequired: boolean;
    verificationHref: string;
    href: string;
  }>;
  readiness: LearningReadiness;
  nextAction: {
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  } | null;
  learningSummary: {
    status: 'ready' | 'empty';
    summary: string | null;
    actions: string[];
    generatedAt: string | null;
    source: 'rule_engine' | 'llm_polished';
  };
  aiInsight: {
    status: 'ready' | 'fallback' | 'empty' | 'generating';
    summary: string | null;
    actions: string[];
    generatedAt: string | null;
    provider: string | null;
    model: string | null;
  };
};

export type CscaWrongPatternReviewQueueItem = {
  id: number;
  subject: CscaLearningSubject;
  subjectLabel: string;
  topicId: number | null;
  topicTitle: string;
  patternType: string;
  label: string;
  recurrenceCount: number;
  status: string;
  priority: 'high' | 'medium' | 'low';
  lastWrongAt: string | null;
  lastCorrectAt: string | null;
  nextReviewAt: string | null;
  due: boolean;
  lastReviewCompletedAt: string | null;
  verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
  verificationRequired: boolean;
  verificationHref: string;
  recentQuestionIds: number[];
  href: string;
};

export type CscaWrongPatternReviewQueueResponse = {
  summary: {
    total: number;
    dueToday: number;
    highPriority: number;
    subjects: Array<{
      subject: CscaLearningSubject;
      subjectLabel: string;
      count: number;
    }>;
  };
  items: CscaWrongPatternReviewQueueItem[];
};
