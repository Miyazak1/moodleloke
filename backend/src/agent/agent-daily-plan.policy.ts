export const AGENT_DAILY_PLAN_POLICY_VERSION = 'agent-daily-plan-v1' as const;

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

export type AgentDailyPlanTask = {
  taskId: string;
  kind: 'mistake_review' | 'spaced_verification' | 'prescription';
  subject: Subject;
  title: string | null;
  topicId: number | null;
  estimatedMinutes: number;
  reasonCodes: string[];
  action: 'open_weakness' | 'start_verification' | 'start_prescription';
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
};

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
  reviewQueue: DailyReviewCandidate[];
  prescription: DailyPrescriptionCandidate | null;
}) {
  const tasks: AgentDailyPlanTask[] = [];
  const occupiedTargets = new Set<string>();
  const dueReviews = input.reviewQueue
    .filter((item) => dueAtOrBefore(item.dueAt, input.now))
    .sort((left, right) => {
      const leftVerification = left.status === 'improving' && (left.consecutiveVerificationPassCount ?? 0) > 0 ? 1 : 0;
      const rightVerification = right.status === 'improving' && (right.consecutiveVerificationPassCount ?? 0) > 0 ? 1 : 0;
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : 0;
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : 0;
      return rightVerification - leftVerification || leftDue - rightDue || right.priority - left.priority || right.recurrenceCount - left.recurrenceCount;
    });

  for (const item of dueReviews) {
    const subject = supportedSubject(item.subject);
    if (!subject) continue;
    const reviewItemId = Number(item.reviewItemId);
    if (!Number.isInteger(reviewItemId) || reviewItemId <= 0) continue;
    const key = targetKey(subject, item.topicId ?? null);
    if (key && occupiedTargets.has(key)) continue;
    if (key) occupiedTargets.add(key);
    const consecutivePassCount = Math.max(0, item.consecutiveVerificationPassCount ?? 0);
    const spacedVerification = item.status === 'improving' && consecutivePassCount > 0;
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
      prescription: null
    });
  }

  const prescriptionTask = input.prescription?.primaryTask;
  if (input.prescription && prescriptionTask) {
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
        }
      });
    }
  }

  const readyTasks = tasks.slice(0, 3);
  return {
    policyVersion: AGENT_DAILY_PLAN_POLICY_VERSION,
    date: input.now.toISOString().slice(0, 10),
    primaryTask: readyTasks[0] ?? null,
    queuedTasks: readyTasks.slice(1),
    scheduledVerificationCount: input.reviewQueue.filter((item) => item.status === 'improving' && !dueAtOrBefore(item.dueAt, input.now)).length,
    source: 'rules_and_learning_evidence' as const
  };
}
