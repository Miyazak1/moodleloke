export const AGENT_DAILY_PLAN_POLICY_VERSION = 'agent-daily-plan-v3-feedback-aware' as const;

type Subject = 'math' | 'physics' | 'chemistry';

export type DailyReviewCandidate = {
  reviewItemId: string | number;
  patternType: string;
  topicId?: number;
  subject: string;
  title: string;
  dueAt: string | null;
  priority: number;
  recurrenceCount: number;
  status: string;
  consecutiveVerificationPassCount?: number;
  requiredConsecutiveVerificationPassCount?: number;
};

export type DailyPrescriptionCandidate = {
  prescriptionId: string;
  reasonCodes: string[];
  confidence: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
  primaryTask: null | {
    type: 'diagnostic' | 'review' | 'targeted_practice' | 'mock_exam' | 'concept_learning' | 'intervention_verification';
    subject: Subject;
    topicIds: number[];
    questionCount?: number;
  };
};

export type DailyLearningProgressInput = {
  targetMinutes: number | null;
  answeredCount: number;
  correctCount: number;
  practiceSeconds: number;
  mockSeconds: number;
  completedTaskCount?: number;
  successfulTaskCount?: number;
};

export type WeeklyLearningProgressInput = {
  targetMinutes: number | null;
  targetDays: number | null;
  completedMinutes: number;
  activeDays: number;
  elapsedDays: number;
  remainingStudyDays?: number | null;
  requiredTodayMinutes?: number | null;
  recommendedTodayMinutes?: number | null;
  sessionLimitMinutes?: number | null;
};

export function buildWeeklyLearningProgress(input?: WeeklyLearningProgressInput) {
  const targetMinutes = input?.targetMinutes && input.targetMinutes > 0 ? Math.round(input.targetMinutes) : null;
  const targetDays = input?.targetDays && input.targetDays > 0 ? Math.min(7, Math.round(input.targetDays)) : null;
  const completedMinutes = Math.max(0, Math.round(input?.completedMinutes ?? 0));
  const activeDays = Math.min(7, Math.max(0, Math.floor(input?.activeDays ?? 0)));
  const elapsedDays = Math.min(7, Math.max(1, Math.floor(input?.elapsedDays ?? 1)));
  const remainingStudyDays = input?.remainingStudyDays && input.remainingStudyDays > 0
    ? Math.min(7, Math.round(input.remainingStudyDays))
    : null;
  const requiredTodayMinutes = input?.requiredTodayMinutes && input.requiredTodayMinutes > 0
    ? Math.round(input.requiredTodayMinutes)
    : null;
  const recommendedTodayMinutes = input?.recommendedTodayMinutes && input.recommendedTodayMinutes > 0
    ? Math.round(input.recommendedTodayMinutes)
    : null;
  const sessionLimitMinutes = input?.sessionLimitMinutes && input.sessionLimitMinutes > 0
    ? Math.round(input.sessionLimitMinutes)
    : null;
  const configured = targetMinutes !== null || targetDays !== null;
  const minutesMet = targetMinutes === null || completedMinutes >= targetMinutes;
  const daysMet = targetDays === null || activeDays >= targetDays;
  const expectedMinutes = targetMinutes === null ? null : Math.round(targetMinutes * elapsedDays / 7);
  const expectedDays = targetDays === null ? null : targetDays * elapsedDays / 7;
  const behind = (expectedMinutes !== null && completedMinutes < expectedMinutes * 0.8)
    || (expectedDays !== null && activeDays + 0.25 < expectedDays);
  return {
    targetMinutes,
    completedMinutes,
    remainingMinutes: targetMinutes === null ? null : Math.max(0, targetMinutes - completedMinutes),
    targetDays,
    activeDays,
    remainingStudyDays,
    requiredTodayMinutes,
    recommendedTodayMinutes,
    sessionLimitMinutes,
    capacityStatus: requiredTodayMinutes !== null && recommendedTodayMinutes !== null && requiredTodayMinutes > recommendedTodayMinutes
      ? 'limited' as const
      : requiredTodayMinutes !== null
        ? 'sufficient' as const
        : 'unset' as const,
    status: !configured
      ? 'unset' as const
      : minutesMet && daysMet
        ? 'goal_met' as const
        : completedMinutes === 0 && activeDays === 0 && elapsedDays === 1
          ? 'not_started' as const
          : behind
            ? 'behind' as const
            : 'on_track' as const
  };
}

export type AgentDailyPlanTask = {
  taskId: string;
  kind: 'mistake_review' | 'spaced_verification' | 'prescription' | 'free_practice';
  subject: Subject;
  title: string | null;
  topicId: number | null;
  estimatedMinutes: number;
  reasonCodes: string[];
  action: 'open_weakness' | 'start_verification' | 'start_prescription' | 'start_free_practice';
  review: null | {
    reviewItemId: number;
    patternType: string;
    dueAt: string | null;
    recurrenceCount: number;
    consecutivePassCount: number;
    requiredPassCount: number;
  };
  prescription: null | {
    prescriptionId: string;
    taskType: NonNullable<DailyPrescriptionCandidate['primaryTask']>['type'];
    topicIds: number[];
    questionCount: number | null;
    confidence: DailyPrescriptionCandidate['confidence'];
  };
  freePractice: null | {
    questionCount: 3 | 5 | 10;
  };
  execution: {
    status: 'ready' | 'review_only' | 'blocked';
    supplyStatus: 'sufficient' | 'limited' | 'empty' | 'unknown' | 'not_required';
    requestedCount: number | null;
    availableCount: number | null;
  };
};

export type DailyTaskSupply = {
  status: 'sufficient' | 'limited' | 'empty' | 'unknown' | 'not_required';
  requestedCount: number | null;
  availableCount: number | null;
};

export type DailyPlanExecutionFeedback = {
  startedCount: number;
  completedCount: number;
  positiveOutcomeCount: number;
  taskPerformance?: Array<{
    taskKind: AgentDailyPlanTask['kind'];
    subject: Subject;
    startedCount: number;
    completedCount: number;
    positiveOutcomeCount: number;
  }>;
};

function taskPerformanceScore(input: DailyPlanExecutionFeedback | undefined, taskKind: AgentDailyPlanTask['kind'], subject: Subject) {
  const signal = input?.taskPerformance?.find((item) => item.taskKind === taskKind && item.subject === subject);
  if (!signal || signal.startedCount < 3) return null;
  const completionRate = signal.completedCount / Math.max(1, signal.startedCount);
  const positiveRate = signal.positiveOutcomeCount / Math.max(1, signal.completedCount);
  return completionRate * 40 + positiveRate * 60;
}

export function resolveDailyPlanAdjustment(input?: DailyPlanExecutionFeedback) {
  const startedCount = Math.max(0, Math.floor(input?.startedCount ?? 0));
  const completedCount = Math.min(startedCount, Math.max(0, Math.floor(input?.completedCount ?? 0)));
  const positiveOutcomeCount = Math.min(completedCount, Math.max(0, Math.floor(input?.positiveOutcomeCount ?? 0)));
  const completionRate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : null;
  const positiveOutcomeRate = completedCount > 0 ? Math.round((positiveOutcomeCount / completedCount) * 100) : null;
  if (startedCount >= 3 && completedCount * 2 < startedCount) {
    return {
      mode: 'reduced_load' as const,
      taskLimit: 1,
      reasonCode: 'LOW_RECENT_COMPLETION' as const,
      evidence: { startedCount, completedCount, positiveOutcomeCount, completionRate, positiveOutcomeRate }
    };
  }
  if (completedCount >= 3 && positiveOutcomeCount * 2 < completedCount) {
    return {
      mode: 'reinforcement' as const,
      taskLimit: 1,
      reasonCode: 'LOW_RECENT_POSITIVE_OUTCOME' as const,
      evidence: { startedCount, completedCount, positiveOutcomeCount, completionRate, positiveOutcomeRate }
    };
  }
  return {
    mode: 'standard' as const,
    taskLimit: 3,
    reasonCode: null,
    evidence: { startedCount, completedCount, positiveOutcomeCount, completionRate, positiveOutcomeRate }
  };
}

const readySupply: DailyTaskSupply = {
  status: 'not_required',
  requestedCount: null,
  availableCount: null
};

function taskExecution(supply: DailyTaskSupply | undefined, reviewOnlyAllowed = false): AgentDailyPlanTask['execution'] {
  const resolved = supply ?? readySupply;
  const ready = resolved.status === 'sufficient' || resolved.status === 'not_required';
  return {
    status: ready ? 'ready' : reviewOnlyAllowed ? 'review_only' : 'blocked',
    supplyStatus: resolved.status,
    requestedCount: resolved.requestedCount,
    availableCount: resolved.availableCount
  };
}

function dueAtOrBefore(value: string | null, now: Date) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

function targetKey(subject: Subject, topicId: number | null) {
  return topicId ? `${subject}:topic:${topicId}` : null;
}

function supportedSubject(value: string): Subject | null {
  return value === 'math' || value === 'physics' || value === 'chemistry' ? value : null;
}

export function buildAgentDailyPlan(input: {
  now: Date;
  localDate?: string;
  reviewQueue: DailyReviewCandidate[];
  prescription: DailyPrescriptionCandidate | null;
  completedPrescriptionIds?: string[];
  progress?: DailyLearningProgressInput;
  weeklyProgress?: WeeklyLearningProgressInput;
  fallbackPractice?: {
    subject: Subject;
    questionCount: 3 | 5 | 10;
  };
  taskSupply?: {
    reviews?: Record<string, DailyTaskSupply>;
    prescription?: DailyTaskSupply;
  };
  executionFeedback?: DailyPlanExecutionFeedback;
}) {
  const adjustment = resolveDailyPlanAdjustment(input.executionFeedback);
  const tasks: AgentDailyPlanTask[] = [];
  const occupiedTargets = new Set<string>();
  const dueReviews = input.reviewQueue
    .filter((item) => dueAtOrBefore(item.dueAt, input.now))
    .sort((left, right) => {
      const leftVerification = left.status === 'improving' && (left.consecutiveVerificationPassCount ?? 0) > 0 ? 1 : 0;
      const rightVerification = right.status === 'improving' && (right.consecutiveVerificationPassCount ?? 0) > 0 ? 1 : 0;
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : 0;
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : 0;
      const leftSubject = supportedSubject(left.subject);
      const rightSubject = supportedSubject(right.subject);
      const leftKind = leftVerification ? 'spaced_verification' : 'mistake_review';
      const rightKind = rightVerification ? 'spaced_verification' : 'mistake_review';
      const leftEffectiveness = leftSubject ? taskPerformanceScore(input.executionFeedback, leftKind, leftSubject) : null;
      const rightEffectiveness = rightSubject ? taskPerformanceScore(input.executionFeedback, rightKind, rightSubject) : null;
      return rightVerification - leftVerification
        || leftDue - rightDue
        || right.priority - left.priority
        || right.recurrenceCount - left.recurrenceCount
        || (rightEffectiveness ?? -1) - (leftEffectiveness ?? -1);
    });

  for (const item of dueReviews) {
    const subject = supportedSubject(item.subject);
    if (!subject) continue;
    const reviewItemId = Number(item.reviewItemId);
    if (!Number.isInteger(reviewItemId) || reviewItemId <= 0) continue;
    const key = targetKey(subject, item.topicId ?? null);
    if (key && occupiedTargets.has(key)) continue;
    const consecutivePassCount = Math.max(0, item.consecutiveVerificationPassCount ?? 0);
    const spacedVerification = item.status === 'improving' && consecutivePassCount > 0;
    const execution = taskExecution(input.taskSupply?.reviews?.[String(reviewItemId)], !spacedVerification);
    if (key && execution.status !== 'blocked') occupiedTargets.add(key);
    tasks.push({
      taskId: `review:${reviewItemId}`,
      kind: spacedVerification ? 'spaced_verification' : 'mistake_review',
      subject,
      title: item.title,
      topicId: item.topicId ?? null,
      estimatedMinutes: spacedVerification ? 10 : 12,
      reasonCodes: spacedVerification ? ['SPACED_VERIFICATION_DUE'] : ['MISTAKE_REVIEW_DUE'],
      action: spacedVerification ? 'start_verification' : 'open_weakness',
      review: {
        reviewItemId,
        patternType: item.patternType,
        dueAt: item.dueAt,
        recurrenceCount: item.recurrenceCount,
        consecutivePassCount,
        requiredPassCount: Math.max(1, item.requiredConsecutiveVerificationPassCount ?? 2)
      },
      prescription: null,
      freePractice: null,
      execution
    });
  }

  const prescriptionTask = input.prescription?.primaryTask;
  if (input.prescription && prescriptionTask && !input.completedPrescriptionIds?.includes(input.prescription.prescriptionId)) {
    const prescriptionTarget = targetKey(prescriptionTask.subject, prescriptionTask.topicIds[0] ?? null);
    if (!prescriptionTarget || !occupiedTargets.has(prescriptionTarget)) {
      tasks.push({
        taskId: `prescription:${input.prescription.prescriptionId}`,
        kind: 'prescription',
        subject: prescriptionTask.subject,
        title: null,
        topicId: prescriptionTask.topicIds[0] ?? null,
        estimatedMinutes: input.prescription.estimatedMinutes,
        reasonCodes: input.prescription.reasonCodes,
        action: 'start_prescription',
        review: null,
        prescription: {
          prescriptionId: input.prescription.prescriptionId,
          taskType: prescriptionTask.type,
          topicIds: prescriptionTask.topicIds,
          questionCount: prescriptionTask.questionCount ?? null,
          confidence: input.prescription.confidence
        },
        freePractice: null,
        execution: taskExecution(input.taskSupply?.prescription)
      });
    }
  }

  const targetMinutes = input.progress?.targetMinutes && input.progress.targetMinutes > 0
    ? Math.round(input.progress.targetMinutes)
    : null;
  const completedSeconds = Math.max(0, input.progress?.practiceSeconds ?? 0)
    + Math.max(0, input.progress?.mockSeconds ?? 0);
  const completedMinutes = completedSeconds > 0 ? Math.max(1, Math.round(completedSeconds / 60)) : 0;
  const remainingMinutes = targetMinutes === null ? null : Math.max(0, targetMinutes - completedMinutes);
  const allExistingTasksBlocked = tasks.length > 0 && tasks.every((task) => task.execution.status === 'blocked');
  if (input.fallbackPractice
    && tasks.every((task) => task.execution.status === 'blocked')
    && (allExistingTasksBlocked || (remainingMinutes !== null && remainingMinutes > 0))) {
    tasks.push({
      taskId: `free-practice:${input.localDate ?? input.now.toISOString().slice(0, 10)}:${input.fallbackPractice.subject}`,
      kind: 'free_practice',
      subject: input.fallbackPractice.subject,
      title: null,
      topicId: null,
      estimatedMinutes: Math.max(8, input.fallbackPractice.questionCount * 2),
      reasonCodes: ['DAILY_TIME_REMAINING'],
      action: 'start_free_practice',
      review: null,
      prescription: null,
      freePractice: { questionCount: input.fallbackPractice.questionCount },
      execution: {
        status: 'ready',
        supplyStatus: 'sufficient',
        requestedCount: input.fallbackPractice.questionCount,
        availableCount: input.fallbackPractice.questionCount
      }
    });
  }
  const blockedTasks = tasks.filter((task) => task.execution.status === 'blocked');
  const actionableTasks = tasks.filter((task) => task.execution.status !== 'blocked');
  const readyTasks = actionableTasks.reduce<AgentDailyPlanTask[]>((selected, task) => {
    if (selected.length >= adjustment.taskLimit) return selected;
    if (!selected.length || remainingMinutes === null) return [...selected, task];
    const selectedMinutes = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    return selectedMinutes + task.estimatedMinutes <= Math.max(remainingMinutes, selected[0].estimatedMinutes)
      ? [...selected, task]
      : selected;
  }, []);
  const answeredCount = Math.max(0, Math.floor(input.progress?.answeredCount ?? 0));
  const correctCount = Math.min(answeredCount, Math.max(0, Math.floor(input.progress?.correctCount ?? 0)));
  const completedTaskCount = Math.max(0, Math.floor(input.progress?.completedTaskCount ?? 0));
  const successfulTaskCount = Math.min(completedTaskCount, Math.max(0, Math.floor(input.progress?.successfulTaskCount ?? 0)));
  return {
    policyVersion: AGENT_DAILY_PLAN_POLICY_VERSION,
    date: input.localDate ?? input.now.toISOString().slice(0, 10),
    primaryTask: readyTasks[0] ?? null,
    queuedTasks: readyTasks.slice(1),
    blockedTasks,
    adjustment,
    progress: {
      targetMinutes,
      completedMinutes,
      remainingMinutes,
      answeredCount,
      correctCount,
      accuracy: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null,
      completedTaskCount,
      successfulTaskCount,
      status: answeredCount === 0 && completedMinutes === 0
        ? 'not_started' as const
        : targetMinutes !== null && completedMinutes >= targetMinutes
          ? 'goal_met' as const
          : 'in_progress' as const
    },
    weeklyProgress: buildWeeklyLearningProgress(input.weeklyProgress),
    plannedMinutes: readyTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    deferredTaskCount: Math.max(0, tasks.length - readyTasks.length),
    scheduledVerificationCount: input.reviewQueue.filter((item) => item.status === 'improving' && !dueAtOrBefore(item.dueAt, input.now)).length,
    source: 'rules_and_learning_evidence' as const
  };
}
