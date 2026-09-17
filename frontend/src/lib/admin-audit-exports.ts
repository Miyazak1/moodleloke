import type { AdminAIQuestioningQualityMetric, AdminAIQuestioningQuestion, AdminAuditEvent } from './api-types';
import type { AdminAuditEventSummary } from './admin-audit-summaries';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonCell(value: unknown) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

export function adminAuditEventsCsv(
  events: AdminAuditEvent[],
  locale: string,
  summarize: (event: AdminAuditEvent, locale: string) => AdminAuditEventSummary | null = () => null
) {
  const rows = [
    [
      'id',
      'createdAt',
      'title',
      'summary',
      'summaryRows',
      'module',
      'resourceType',
      'resourceId',
      'action',
      'actorEmail',
      'organizationId',
      'organizationName',
      'organizationSlug',
      'targetEmail',
      'relatedUserId',
      'relatedUserEmail',
      'before',
      'after'
    ],
    ...events.map((event) => {
      const summary = summarize(event, locale);
      return [
        event.id,
        event.createdAt,
        summary?.title ?? event.action,
        summary?.detail ?? '',
        summary?.rows.join('\n') ?? '',
        event.module,
        event.resourceType,
        event.resourceId ?? '',
        event.action,
        event.actorEmail ?? '',
        event.organizationId ?? '',
        event.organizationName ?? '',
        event.organizationSlug ?? '',
        event.targetEmail ?? '',
        event.relatedUserId ?? '',
        event.relatedUserEmail ?? '',
        jsonCell(event.before),
        jsonCell(event.after)
      ];
    })
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function adminAuditEventsFilename(filters: { organizationId?: string; organizationOnly?: boolean; resourceType?: string }) {
  const parts = ['admin-audit'];
  if (filters.organizationId) parts.push(`org-${filters.organizationId}`);
  if (filters.organizationOnly) parts.push('organization');
  if (filters.resourceType) parts.push(filters.resourceType.replace(/[^a-zA-Z0-9._-]+/g, '-'));
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join('-')}.csv`;
}

function qualityReasons(metric: AdminAIQuestioningQualityMetric) {
  return metric.qualitySummary?.reasons?.join('; ') || metric.reviewReason || '';
}

function qualityProblemOptions(metric: AdminAIQuestioningQualityMetric) {
  return metric.qualitySummary?.evidence.problemOptions.map((item) => {
    const tags = item.misconceptionTags.length ? ` tags=${item.misconceptionTags.join('|')}` : '';
    return `${item.optionId}:${item.signal ?? 'risk'} count=${item.count} wrong=${item.wrongSelectionRate}${tags}`;
  }).join('; ') || '';
}

function difficultyDrift(metric: AdminAIQuestioningQualityMetric) {
  return Boolean(metric.empiricalDifficulty) && metric.empiricalDifficulty !== metric.designedDifficulty;
}

function replacementQuestion(metric: AdminAIQuestioningQualityMetric, questions: AdminAIQuestioningQuestion[] = []) {
  const replacementId = metric.qualityGovernance?.replacementQuestionId;
  return typeof replacementId === 'number' ? questions.find((question) => question.id === replacementId) : undefined;
}

function replacementFollowUp(metric: AdminAIQuestioningQualityMetric, questions: AdminAIQuestioningQuestion[] = []) {
  const governance = metric.qualityGovernance;
  if (!governance?.replacementQuestionId) return governance?.disposition === 'regenerate' ? 'needs_candidate' : '';
  if (governance.replacementPublishedQuestionId || governance.disposition === 'replaced') return 'published_replacement';
  const candidate = replacementQuestion(metric, questions);
  const status = candidate?.status ?? metric.replacementCandidateStatus ?? '';
  if (['rejected', 'archived'].includes(status)) return 'stale_regenerate_again';
  return 'review_replacement_candidate';
}

function replacementCandidateStatus(metric: AdminAIQuestioningQualityMetric, questions: AdminAIQuestioningQuestion[] = []) {
  return replacementQuestion(metric, questions)?.status ?? metric.replacementCandidateStatus ?? '';
}

export function adminAIQuestioningQualityCalibrationCsv(metrics: AdminAIQuestioningQualityMetric[], questions: AdminAIQuestioningQuestion[] = []) {
  const rows = [
    [
      'questionId',
      'subject',
      'topicId',
      'status',
      'sourceQuestionId',
      'generatedVariantOf',
      'designedDifficulty',
      'empiricalDifficulty',
      'difficultyDrift',
      'difficultyConfidence',
      'attemptCount',
      'correctRate',
      'unansweredRate',
      'medianSeconds',
      'needsReview',
      'reviewReason',
      'severity',
      'recommendedAction',
      'reasons',
      'mostSelectedWrongOption',
      'problemOptions',
      'actionTarget',
      'governanceStatus',
      'governanceDisposition',
      'replacementQuestionId',
      'replacementCandidateStatus',
      'replacementFollowUp',
      'replacementPublishedQuestionId',
      'assignedTo',
      'updatedAt'
    ],
    ...metrics.map((metric) => [
      metric.questionId,
      metric.subject,
      metric.topicId,
      metric.questionStatus,
      metric.sourceQuestionId ?? '',
      metric.generatedVariantOf ?? '',
      metric.designedDifficulty,
      metric.empiricalDifficulty ?? '',
      difficultyDrift(metric) ? 'yes' : 'no',
      metric.difficultyConfidence ?? '',
      metric.attemptCount,
      metric.correctRate ?? '',
      metric.unansweredRate ?? '',
      metric.medianSeconds ?? '',
      metric.needsReview ? 'yes' : 'no',
      metric.reviewReason ?? '',
      metric.qualitySummary?.severity ?? '',
      metric.qualitySummary?.recommendedAction ?? '',
      qualityReasons(metric),
      metric.mostSelectedWrongOption ?? '',
      qualityProblemOptions(metric),
      'admin-ai-questioning-quality-governance',
      metric.qualityGovernance?.status ?? '',
      metric.qualityGovernance?.disposition ?? '',
      metric.qualityGovernance?.replacementQuestionId ?? '',
      replacementCandidateStatus(metric, questions),
      replacementFollowUp(metric, questions),
      metric.qualityGovernance?.replacementPublishedQuestionId ?? '',
      metric.qualityGovernance?.assignedTo ?? '',
      metric.updatedAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function adminAIQuestioningQualityCalibrationJson(metrics: AdminAIQuestioningQualityMetric[], questions: AdminAIQuestioningQuestion[] = []) {
  const summary = {
    total: metrics.length,
    difficultyDrift: metrics.filter(difficultyDrift).length,
    distractorIssues: metrics.filter((metric) => (
      (metric.qualitySummary?.evidence.problemOptions.length ?? 0) > 0 ||
      (metric.optionSelectionStats ?? []).some((item) => item.qualitySignal && item.qualitySignal !== 'normal')
    )).length,
    regenerate: metrics.filter((metric) => metric.qualitySummary?.recommendedAction === 'regenerate').length,
    lowConfidence: metrics.filter((metric) => typeof metric.difficultyConfidence === 'number' && metric.difficultyConfidence < 0.5).length,
    highRisk: metrics.filter((metric) => metric.qualitySummary?.severity === 'high').length,
    staleReplacementCandidates: metrics.filter((metric) => replacementFollowUp(metric, questions) === 'stale_regenerate_again').length,
    reviewableReplacementCandidates: metrics.filter((metric) => replacementFollowUp(metric, questions) === 'review_replacement_candidate').length,
    publishedReplacements: metrics.filter((metric) => replacementFollowUp(metric, questions) === 'published_replacement').length
  };
  return JSON.stringify({
    reportType: 'ai-questioning-quality-calibration',
    generatedAt: new Date().toISOString(),
    summary,
    actionTarget: 'admin-ai-questioning-quality-governance',
    metrics: metrics.map((metric) => ({
      ...metric,
      replacementCandidateStatus: replacementCandidateStatus(metric, questions),
      replacementFollowUp: replacementFollowUp(metric, questions)
    }))
  }, null, 2);
}

export function adminAIQuestioningQualityCalibrationFilename(subject: string | undefined, extension: 'csv' | 'json') {
  const safeSubject = subject?.trim() ? subject.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') : 'all-subjects';
  return `ai-questioning-quality-calibration-${safeSubject}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function objectValue(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function reviewIssueCodes(question: AdminAIQuestioningQuestion) {
  const issues = objectValue(question.reviewMetadata, 'issues');
  return Array.isArray(issues)
    ? issues.map((issue) => objectValue(issue, 'code')).filter(Boolean).join('; ')
    : '';
}

function reviewIssueCount(question: AdminAIQuestioningQuestion) {
  const issues = objectValue(question.reviewMetadata, 'issues');
  return Array.isArray(issues) ? issues.length : 0;
}

function reviewStatus(question: AdminAIQuestioningQuestion) {
  return objectValue(question.reviewMetadata, 'status') ?? objectValue(question.reviewMetadata, 'approvalGate') ?? '';
}

function replacementSourceQuestionId(question: AdminAIQuestioningQuestion) {
  const metadataSource = objectValue(question.generationMetadata, 'sourceQuestionId');
  return question.generatedVariantOf ?? (typeof metadataSource === 'number' ? metadataSource : '');
}

function isReplacementCandidate(question: AdminAIQuestioningQuestion) {
  return Boolean(question.generatedVariantOf) || objectValue(question.generationMetadata, 'purpose') === 'quality_replacement';
}

export function adminAIQuestioningCandidateQueueCsv(questions: AdminAIQuestioningQuestion[], filter: string) {
  const rows = [
    [
      'id',
      'subject',
      'topicId',
      'blueprintId',
      'status',
      'sourceType',
      'sourceQuestionId',
      'generatedVariantOf',
      'isReplacementCandidate',
      'replacementSourceQuestionId',
      'designedDifficulty',
      'empiricalDifficulty',
      'difficultyConfidence',
      'questionType',
      'syllabusVersion',
      'reviewStatus',
      'reviewIssueCodes',
      'reviewIssueCount',
      'filter',
      'actionTarget',
      'prompt',
      'correctAnswer',
      'optionMetadata',
      'generationMetadata',
      'reviewMetadata',
      'createdAt',
      'updatedAt'
    ],
    ...questions.map((question) => [
      question.id,
      question.subject,
      question.topicId,
      question.blueprintId ?? '',
      question.status,
      question.sourceType,
      question.sourceQuestionId ?? '',
      question.generatedVariantOf ?? '',
      isReplacementCandidate(question) ? 'yes' : 'no',
      replacementSourceQuestionId(question),
      question.designedDifficulty,
      question.empiricalDifficulty ?? '',
      question.difficultyConfidence ?? '',
      question.questionType,
      question.syllabusVersion,
      reviewStatus(question),
      reviewIssueCodes(question),
      reviewIssueCount(question),
      filter,
      'admin-ai-questioning-candidates',
      question.prompt,
      question.correctAnswer,
      jsonCell(question.optionMetadata),
      jsonCell(question.generationMetadata),
      jsonCell(question.reviewMetadata),
      question.createdAt,
      question.updatedAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function adminAIQuestioningCandidateQueueJson(questions: AdminAIQuestioningQuestion[], filter: string) {
  const summary = {
    total: questions.length,
    replacementCandidates: questions.filter(isReplacementCandidate).length,
    pendingReview: questions.filter((question) => question.status === 'pending_review').length,
    reviewFailed: questions.filter((question) => question.status === 'review_failed').length,
    approved: questions.filter((question) => question.status === 'approved').length,
    draft: questions.filter((question) => question.status === 'draft').length
  };
  return JSON.stringify({
    reportType: 'ai-questioning-candidate-queue',
    generatedAt: new Date().toISOString(),
    filter,
    summary,
    actionTarget: 'admin-ai-questioning-candidates',
    questions
  }, null, 2);
}

export function adminAIQuestioningCandidateQueueFilename(subject: string | undefined, filter: string, extension: 'csv' | 'json') {
  const safeSubject = subject?.trim() ? subject.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') : 'all-subjects';
  const safeFilter = filter.trim() ? filter.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') : 'all';
  return `ai-questioning-candidates-${safeSubject}-${safeFilter}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
