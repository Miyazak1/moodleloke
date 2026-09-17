import { LearningEvidenceEventV1 } from '../contracts/learning-intelligence.contracts';

export type LearningTopicState = {
  mastery: number;
  confidence: number;
  independence: number;
  difficultyCeiling: string | null;
  retention: number;
  fluency: number;
  transfer: number;
  consistency: number;
  coverage: number;
  misconceptionState: Record<string, unknown> | null;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
};

export const INITIAL_LEARNING_TOPIC_STATE: LearningTopicState = {
  mastery: 0.5,
  confidence: 0.1,
  independence: 0.5,
  difficultyCeiling: null,
  retention: 0.5,
  fluency: 0.5,
  transfer: 0.5,
  consistency: 0.5,
  coverage: 0,
  misconceptionState: null,
  evidenceCount: 0,
  lastEvidenceAt: null
};

function clamp(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(6));
}
function move(previous: number, signal: number, rate: number): number {
  return clamp(previous + (signal - previous) * rate);
}

function outcomeSignal(outcome: LearningEvidenceEventV1['outcome']): number {
  if (outcome === 'correct') return 1;
  if (outcome === 'partial') return 0.5;
  return 0;
}

function difficultyRank(value: string | undefined): number {
  const difficulty = String(value ?? '').toLowerCase();
  if (/challenge|hard|difficult|挑战|困难|较难/.test(difficulty)) return 3;
  if (/medium|中等|提高/.test(difficulty)) return 2;
  return difficulty ? 1 : 0;
}

export function projectLearningTopicState(
  previousValue: LearningTopicState | null,
  event: LearningEvidenceEventV1,
  topicWeight: number
): LearningTopicState {
  const previous = previousValue ?? INITIAL_LEARNING_TOPIC_STATE;
  const signal = outcomeSignal(event.outcome);
  const assistanceFactor = event.usedExplanation ? 0.25 : event.usedHint ? 0.55 : 1;
  const repeatFactor = event.firstAttempt ? 1 : 0.4;
  const effectiveWeight = clamp(event.questionQualityConfidence * topicWeight * repeatFactor);
  const masteryRate = Math.max(0.02, 0.22 * effectiveWeight * (signal > previous.mastery ? assistanceFactor : 1));
  const independentSignal = event.usedHint || event.usedExplanation ? Math.min(signal, 0.35) : signal;
  const fluencySignal = event.timeSpentSeconds === undefined
    ? 0.5
    : event.timeSpentSeconds <= 120 && signal === 1 ? 1 : signal === 1 ? 0.65 : 0.2;
  const isDelayedEvidence = previous.lastEvidenceAt
    ? new Date(event.occurredAt).getTime() - previous.lastEvidenceAt.getTime() >= 24 * 60 * 60 * 1000
    : false;
  const transferEligible = event.sourceType === 'mock_exam' || event.sourceType === 'diagnostic' || event.sourceType === 'verified_handwriting';
  const difficultyCeiling = signal === 1 && !event.usedHint && !event.usedExplanation && difficultyRank(event.difficulty) >= difficultyRank(previous.difficultyCeiling ?? undefined)
    ? event.difficulty ?? previous.difficultyCeiling
    : previous.difficultyCeiling;
  const incorrectCount = Number(previous.misconceptionState?.incorrectCount ?? 0) + (signal === 0 ? 1 : 0);

  return {
    mastery: move(previous.mastery, signal, masteryRate),
    confidence: clamp(previous.confidence + 0.04 * effectiveWeight),
    independence: move(previous.independence, independentSignal, 0.16 * effectiveWeight),
    difficultyCeiling,
    retention: isDelayedEvidence || event.sourceType === 'review'
      ? move(previous.retention, signal, 0.18 * effectiveWeight)
      : previous.retention,
    fluency: move(previous.fluency, fluencySignal, 0.12 * effectiveWeight),
    transfer: transferEligible ? move(previous.transfer, signal, 0.14 * effectiveWeight) : previous.transfer,
    consistency: move(previous.consistency, 1 - Math.abs(signal - previous.mastery), 0.12 * effectiveWeight),
    coverage: clamp(previous.coverage + 0.08 * effectiveWeight),
    misconceptionState: {
      incorrectCount,
      lastOutcome: event.outcome,
      lastQuestionId: event.questionId
    },
    evidenceCount: previous.evidenceCount + 1,
    lastEvidenceAt: new Date(event.occurredAt)
  };
}
