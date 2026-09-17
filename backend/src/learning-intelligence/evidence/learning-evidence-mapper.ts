import { createHash } from 'node:crypto';
import { LearningEvidenceWriteInputV1 } from '../contracts/learning-intelligence.contracts';

export type TrustedQuestionEvidence = {
  sourceType: LearningEvidenceWriteInputV1['sourceType'];
  sourceId: string;
  sessionId?: string;
  userId: number;
  subjectCode: LearningEvidenceWriteInputV1['subjectCode'];
  questionId: string;
  questionVersion: number;
  answerKeyVersion: string;
  topicId: number;
  topicMappingVersion: string;
  outcome: LearningEvidenceWriteInputV1['outcome'];
  usedHint?: boolean;
  usedExplanation?: boolean;
  timeSpentSeconds?: number;
  difficulty?: string;
  questionQualityConfidence: number;
  occurredAt: Date;
  scoringRubricVersion?: string;
  metadata?: Record<string, unknown>;
};

function stableEventId(input: TrustedQuestionEvidence): string {
  const businessKey = [input.sourceType, input.sourceId, input.questionId, '1', '1'].join(':');
  return `le_${createHash('sha256').update(businessKey).digest('hex').slice(0, 48)}`;
}

export function mapTrustedQuestionEvidence(input: TrustedQuestionEvidence): LearningEvidenceWriteInputV1 {
  const usedExplanation = Boolean(input.usedExplanation);
  const usedHint = Boolean(input.usedHint);
  return {
    schemaVersion: '1',
    eventId: stableEventId(input),
    userId: input.userId,
    subjectCode: input.subjectCode,
    occurredAt: input.occurredAt.toISOString(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    attemptSequence: 1,
    sessionId: input.sessionId,
    questionId: input.questionId,
    questionVersion: input.questionVersion,
    answerKeyVersion: input.answerKeyVersion,
    topicMappingVersion: input.topicMappingVersion,
    scoringRubricVersion: input.scoringRubricVersion,
    exposureState: usedExplanation ? 'explanation_seen' : usedHint ? 'hint_seen' : 'answer_seen',
    topicEvidence: [{ topicId: input.topicId, role: 'primary', weight: 1 }],
    outcome: input.outcome,
    usedHint,
    usedExplanation,
    timeSpentSeconds: input.timeSpentSeconds,
    difficulty: input.difficulty,
    questionQualityConfidence: input.questionQualityConfidence,
    metadata: input.metadata
  };
}
