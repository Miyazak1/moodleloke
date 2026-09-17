import { createHash } from 'node:crypto';
import type {
  CscaSubjectCode,
  LearningDecisionVersionVectorV1,
  LearningPrescriptionV1,
  TargetGapItemV1,
  TargetGapSnapshotV1
} from '../contracts/learning-intelligence.contracts';

export const LEARNING_DECISION_POLICY_VERSION = 'ls-v1-prescription-rules-2' as const;
export const LEARNING_ITEM_CALIBRATION_VERSION = 'not-enabled' as const;
export const LEARNING_FORECAST_MODEL_VERSION = 'score-readiness-shadow-gate-v1' as const;

export type DecisionTopicInput = {
  topicId: number;
  subject: CscaSubjectCode;
  mastery: number | null;
  confidence: number;
  independence: number | null;
  difficultyCeiling: string | null;
  retention: number | null;
  fluency: number | null;
  transfer: number | null;
  evidenceCount: number;
  incorrectCount: number;
  stateVersion: string | null;
  stateEventSequence: bigint | null;
};

export type InterventionDecisionSignal = {
  assessmentId: string;
  deliveryId: string;
  subject: CscaSubjectCode;
  topicId: number;
  kind: 'stable' | 'not_stable' | 'inconclusive' | 'verification_due' | 'verification_scheduled';
  phase: 'immediate' | 'retention' | 'transfer' | null;
  verificationId: string | null;
  dueAt: Date | null;
  effectiveAt: Date;
  evidenceSequence: bigint | null;
  evidenceTrusted: boolean;
  supplyGap: boolean;
};

export type LearningDecisionInput = {
  userId: number;
  goalId: string;
  examDate: Date;
  subjectPriorities: Array<{ subject: CscaSubjectCode; priority: number }>;
  topics: DecisionTopicInput[];
  dueReviewTopicIds: number[];
  recentMockSubjects: CscaSubjectCode[];
  interventionSignals: InterventionDecisionSignal[];
  defaultSessionMinutes: number | null;
  versions: LearningDecisionVersionVectorV1;
  evidenceCutoffAt: Date;
  generatedAt: Date;
  versionHash: string;
};

function clamp(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(6));
}

function confidenceLabel(value: number): 'low' | 'medium' | 'high' {
  return value >= 0.7 ? 'high' : value >= 0.4 ? 'medium' : 'low';
}

function gap(
  input: LearningDecisionInput,
  type: TargetGapItemV1['type'],
  subject: CscaSubjectCode,
  topicIds: number[],
  severity: number,
  confidence: number,
  reasonCodes: string[],
  recommendedAction: TargetGapItemV1['recommendedAction'],
  intervention?: { verificationId: string; phase: 'retention' | 'transfer' }
): TargetGapItemV1 {
  const identity = [type, subject, ...topicIds.slice().sort((a, b) => a - b), intervention?.verificationId ?? ''].join(':');
  return {
    gapId: `gap_${input.versionHash.slice(0, 16)}_${createHash('sha256').update(identity).digest('hex').slice(0, 16)}`,
    type,
    subject,
    topicIds: topicIds.slice().sort((a, b) => a - b),
    severity: clamp(severity),
    confidence: confidenceLabel(confidence),
    estimatedScoreImpact: null,
    evidenceRefs: topicIds.map((topicId) => `topic-state:${subject}:${topicId}`),
    reasonCodes,
    recommendedAction,
    ...(intervention ? {
      interventionVerificationId: intervention.verificationId,
      interventionVerificationPhase: intervention.phase
    } : {})
  };
}

function effectiveSignalForTopic(input: LearningDecisionInput, topic: DecisionTopicInput) {
  return input.interventionSignals
    .filter((signal) => signal.subject === topic.subject && signal.topicId === topic.topicId)
    .filter((signal) => signal.evidenceTrusted)
    .filter((signal) => topic.stateEventSequence === null || signal.evidenceSequence === null
      || signal.evidenceSequence >= topic.stateEventSequence)
    .filter((signal) => signal.kind === 'stable' || signal.kind === 'not_stable' || signal.kind === 'inconclusive')
    .sort((left, right) => right.effectiveAt.getTime() - left.effectiveAt.getTime() || right.assessmentId.localeCompare(left.assessmentId))[0];
}

export function computeTargetGaps(input: LearningDecisionInput): TargetGapItemV1[] {
  const gaps: Array<TargetGapItemV1 & { rank: number }> = [];
  const priorityBySubject = new Map(input.subjectPriorities.map((item) => [item.subject, item.priority]));
  const dueReview = new Set(input.dueReviewTopicIds);
  const dueVerificationByTopic = new Map<string, InterventionDecisionSignal>();

  for (const signal of input.interventionSignals
    .filter((item) => item.kind === 'verification_due' && item.evidenceTrusted
      && item.verificationId && (item.phase === 'retention' || item.phase === 'transfer'))
    .sort((left, right) => (left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0)
      || (priorityBySubject.get(left.subject) ?? 99) - (priorityBySubject.get(right.subject) ?? 99)
      || left.topicId - right.topicId || left.verificationId!.localeCompare(right.verificationId!))) {
    const topicKey = `${signal.subject}:${signal.topicId}`;
    if (!dueVerificationByTopic.has(topicKey)) dueVerificationByTopic.set(topicKey, signal);
  }

  for (const signal of dueVerificationByTopic.values()) {
    const verificationPhase = signal.phase === 'transfer' ? 'transfer' : 'retention';
    const reason = verificationPhase === 'transfer' ? 'INTERVENTION_TRANSFER_DUE' : 'INTERVENTION_RETENTION_DUE';
    const item = gap(input, verificationPhase === 'transfer' ? 'transfer' : 'retention', signal.subject, [signal.topicId], 1, 1,
      [reason], 'intervention_verification', { verificationId: signal.verificationId!, phase: verificationPhase });
    const overdueDays = Math.max(0, input.generatedAt.getTime() - (signal.dueAt?.getTime() ?? input.generatedAt.getTime())) / 86_400_000;
    const overdueBoost = Math.min(0.5, overdueDays / 14);
    const subjectBoost = 0.001 / Math.max(1, priorityBySubject.get(signal.subject) ?? 99);
    gaps.push({ ...item, evidenceRefs: [`intervention-verification:${signal.verificationId}`], rank: 3 + overdueBoost + subjectBoost });
  }

  for (const { subject } of input.subjectPriorities) {
    const topics = input.topics.filter((topic) => topic.subject === subject);
    const missing = topics.filter((topic) => topic.evidenceCount === 0 && effectiveSignalForTopic(input, topic)?.kind !== 'stable').map((topic) => topic.topicId);
    if (!topics.length || missing.length) {
      const ratio = topics.length ? missing.length / topics.length : 1;
      const item = gap(input, 'coverage', subject, missing.slice(0, 20), Math.max(0.45, ratio), 0.2,
        ['SYLLABUS_COVERAGE_INCOMPLETE', 'EVIDENCE_INSUFFICIENT'], 'diagnostic');
      gaps.push({ ...item, rank: 1.15 * item.severity });
    }

    for (const topic of topics.filter((item) => item.evidenceCount > 0)) {
      const subjectWeight = 1 / Math.max(1, priorityBySubject.get(subject) ?? 1);
      const interventionSignal = effectiveSignalForTopic(input, topic);
      if (interventionSignal?.kind === 'not_stable') {
        const action = interventionSignal.phase === 'retention' ? 'review'
          : interventionSignal.phase === 'transfer' ? 'targeted_practice' : 'concept_learning';
        const item = gap(input, interventionSignal.phase === 'retention' ? 'retention' : interventionSignal.phase === 'transfer' ? 'transfer' : 'mastery',
          subject, [topic.topicId], 1, Math.max(topic.confidence, 0.7),
          ['INTERVENTION_NOT_STABLE', `INTERVENTION_${String(interventionSignal.phase ?? 'immediate').toUpperCase()}_FAILED`], action);
        gaps.push({ ...item, evidenceRefs: [`intervention-assessment:${interventionSignal.assessmentId}`], rank: 2.2 + subjectWeight * 0.1 });
        continue;
      }
      if (interventionSignal?.kind === 'inconclusive' && !interventionSignal.supplyGap) {
        const item = gap(input, 'evidence', subject, [topic.topicId], 0.8, Math.min(topic.confidence, 0.5),
          ['INTERVENTION_EVIDENCE_INCONCLUSIVE'], 'diagnostic');
        gaps.push({ ...item, evidenceRefs: [`intervention-assessment:${interventionSignal.assessmentId}`], rank: 1.9 + subjectWeight * 0.1 });
        continue;
      }
      if (topic.evidenceCount < 3 || topic.confidence < 0.35) {
        const item = gap(input, 'evidence', subject, [topic.topicId], Math.max(0.5, 1 - topic.confidence), topic.confidence,
          ['EVIDENCE_INSUFFICIENT'], 'diagnostic');
        gaps.push({ ...item, rank: item.severity * (1 + subjectWeight * 0.15) });
        continue;
      }
      if (interventionSignal?.kind !== 'stable' && (topic.mastery ?? 0) < 0.65) {
        const repeated = topic.incorrectCount >= 2;
        const item = gap(input, 'mastery', subject, [topic.topicId], (0.65 - (topic.mastery ?? 0)) / 0.65,
          topic.confidence, repeated ? ['MASTERY_BELOW_BASELINE', 'MISCONCEPTION_REPEATED'] : ['MASTERY_BELOW_BASELINE'],
          repeated ? 'concept_learning' : 'targeted_practice');
        gaps.push({ ...item, rank: item.severity * (1 + subjectWeight * 0.2) + (repeated ? 0.25 : 0) });
      }
      if ((topic.independence ?? 0) < 0.55 || !topic.difficultyCeiling) {
        const item = gap(input, 'difficulty', subject, [topic.topicId], Math.max(0.35, 0.55 - (topic.independence ?? 0)),
          topic.confidence, ['INDEPENDENCE_OR_DIFFICULTY_LIMIT'], 'targeted_practice');
        gaps.push({ ...item, rank: item.severity * 0.9 });
      }
      if (interventionSignal?.kind !== 'stable' && (dueReview.has(topic.topicId) || (topic.retention ?? 1) < 0.55)) {
        const item = gap(input, 'retention', subject, [topic.topicId], dueReview.has(topic.topicId) ? 0.8 : 0.55 - (topic.retention ?? 0),
          topic.confidence, dueReview.has(topic.topicId) ? ['REVIEW_DUE', 'RETENTION_AT_RISK'] : ['RETENTION_AT_RISK'], 'review');
        gaps.push({ ...item, rank: item.severity + (dueReview.has(topic.topicId) ? 0.2 : 0) });
      }
      if ((topic.fluency ?? 1) < 0.5) {
        const item = gap(input, 'fluency', subject, [topic.topicId], 0.5 - (topic.fluency ?? 0), topic.confidence,
          ['FLUENCY_BELOW_BASELINE'], 'targeted_practice');
        gaps.push({ ...item, rank: item.severity * 0.75 });
      }
      if (interventionSignal?.kind !== 'stable' && (topic.transfer ?? 1) < 0.5) {
        const item = gap(input, 'transfer', subject, [topic.topicId], 0.5 - (topic.transfer ?? 0), topic.confidence,
          ['TRANSFER_BELOW_BASELINE'], 'targeted_practice');
        gaps.push({ ...item, rank: item.severity * 0.8 });
      }
    }

    const daysToExam = Math.ceil((input.examDate.getTime() - input.generatedAt.getTime()) / 86_400_000);
    if (daysToExam <= 45 && !input.recentMockSubjects.includes(subject)) {
      const item = gap(input, 'exam_execution', subject, [], daysToExam <= 14 ? 0.8 : 0.55, 0.35,
        ['EXAM_APPROACHING', 'RECENT_MOCK_MISSING'], 'mock_exam');
      gaps.push({ ...item, rank: item.severity * 0.85 });
    }
  }

  return gaps
    .sort((a, b) => b.rank - a.rank || a.subject.localeCompare(b.subject) || a.type.localeCompare(b.type) || (a.topicIds[0] ?? 0) - (b.topicIds[0] ?? 0))
    .slice(0, 12)
    .map(({ rank: _rank, ...item }) => item);
}

export function buildTargetGapSnapshot(input: LearningDecisionInput): TargetGapSnapshotV1 {
  return {
    schemaVersion: '1',
    gapSnapshotId: `tgap_${input.versionHash.slice(0, 32)}`,
    goalId: input.goalId,
    userId: input.userId,
    versions: input.versions,
    gaps: computeTargetGaps(input),
    evidenceCutoffAt: input.evidenceCutoffAt.toISOString(),
    createdAt: input.generatedAt.toISOString()
  };
}

export function buildLearningPrescription(input: LearningDecisionInput, gaps: TargetGapItemV1[]): LearningPrescriptionV1 {
  const primary = gaps[0];
  const fallbackSubject = input.subjectPriorities.slice().sort((a, b) => a.priority - b.priority || a.subject.localeCompare(b.subject))[0]?.subject ?? 'math';
  const taskType = primary?.recommendedAction ?? 'targeted_practice';
  const subject = primary?.subject ?? fallbackSubject;
  const sessionMinutes = Math.min(30, Math.max(10, input.defaultSessionMinutes ?? 15));
  const questionCount = taskType === 'concept_learning' || taskType === 'mock_exam'
    ? undefined
    : Math.min(10, Math.max(3, Math.floor(sessionMinutes / 3)));
  const reasonCodes = primary?.reasonCodes ?? ['MAINTENANCE_PRACTICE'];
  const confidence = primary?.confidence ?? 'medium';
  const topicIds = primary?.topicIds ?? [];
  const objective = primary
    ? `${taskType}:${subject}${topicIds.length ? `:${topicIds.join(',')}` : ''}`
    : `maintain:${subject}`;

  return {
    schemaVersion: '1',
    prescriptionId: `rx_${input.versionHash.slice(0, 32)}`,
    userId: input.userId,
    versions: input.versions,
    objective,
    reasonCodes,
    reasonSummary: primary
      ? `The highest-priority ${primary.type} gap should be addressed with ${taskType}.`
      : 'Current evidence supports a short maintenance practice session.',
    confidence,
    estimatedMinutes: taskType === 'mock_exam' ? Math.max(30, sessionMinutes) : sessionMinutes,
    tasks: [{
      type: taskType,
      subject,
      topicIds,
      ...(taskType === 'targeted_practice' ? { difficulty: primary?.type === 'difficulty' ? 'foundation' : 'medium' } : {}),
      ...(questionCount ? { questionCount } : {}),
      ...(primary?.interventionVerificationId ? {
        interventionVerificationId: primary.interventionVerificationId,
        interventionVerificationPhase: primary.interventionVerificationPhase
      } : {}),
      priority: 1
    }],
    alternatives: [
      { label: 'Use a shorter session', adjustment: 'shorter' },
      { label: 'Switch subject', adjustment: 'different_subject' }
    ],
    validUntil: new Date(input.generatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: input.generatedAt.toISOString()
  };
}
