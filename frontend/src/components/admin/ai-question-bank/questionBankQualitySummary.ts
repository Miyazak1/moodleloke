import type {
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type {
  QualityCalibrationSummary,
  QualityReplacementSummary
} from './QualityWorkspace';

export function buildQuestionById(questions: AdminAIQuestioningQuestion[]) {
  const byId = new Map<number, AdminAIQuestioningQuestion>();
  questions.forEach((question) => byId.set(question.id, question));
  return byId;
}

export function buildQualityCalibrationSummary(
  metrics: AdminAIQuestioningQualityMetric[]
): QualityCalibrationSummary {
  const difficultyDrift = metrics.filter((metric) => (
    Boolean(metric.empiricalDifficulty) && metric.empiricalDifficulty !== metric.designedDifficulty
  ));
  const distractorIssues = metrics.filter((metric) => (
    (metric.qualitySummary?.evidence.problemOptions.length ?? 0) > 0 ||
    (metric.optionSelectionStats ?? []).some((option) => option.qualitySignal && option.qualitySignal !== 'normal')
  ));
  const regenerate = metrics.filter((metric) => metric.qualitySummary?.recommendedAction === 'regenerate');
  const lowConfidence = metrics.filter((metric) => typeof metric.difficultyConfidence === 'number' && metric.difficultyConfidence < 0.5);
  const highRisk = metrics.filter((metric) => metric.qualitySummary?.severity === 'high');

  return {
    total: metrics.length,
    difficultyDrift,
    distractorIssues,
    regenerate,
    lowConfidence,
    highRisk
  };
}

export function buildQualityReplacementSummary(
  metrics: AdminAIQuestioningQualityMetric[],
  questionById: Map<number, AdminAIQuestioningQuestion>
): QualityReplacementSummary {
  const replacementCandidateStatus = (metric: AdminAIQuestioningQualityMetric) => {
    const replacementId = metric.qualityGovernance?.replacementQuestionId;
    const replacement = typeof replacementId === 'number' ? questionById.get(replacementId) : undefined;
    return replacement?.status ?? metric.replacementCandidateStatus ?? '';
  };
  const needsCandidate = metrics.filter((metric) => (
    metric.qualitySummary?.recommendedAction === 'regenerate' &&
    !metric.qualityGovernance?.replacementQuestionId
  ));
  const draftedUnpublished = metrics.filter((metric) => (
    metric.qualityGovernance?.disposition === 'regenerate' &&
    Boolean(metric.qualityGovernance.replacementQuestionId) &&
    !metric.qualityGovernance.replacementPublishedQuestionId &&
    !['rejected', 'archived'].includes(replacementCandidateStatus(metric))
  ));
  const staleCandidate = metrics.filter((metric) => (
    metric.qualityGovernance?.disposition === 'regenerate' &&
    Boolean(metric.qualityGovernance.replacementQuestionId) &&
    !metric.qualityGovernance.replacementPublishedQuestionId &&
    ['rejected', 'archived'].includes(replacementCandidateStatus(metric))
  ));
  const published = metrics.filter((metric) => (
    metric.qualityGovernance?.disposition === 'replaced' ||
    Boolean(metric.qualityGovernance?.replacementPublishedQuestionId)
  ));

  return {
    needsCandidate,
    draftedUnpublished,
    staleCandidate,
    published
  };
}
