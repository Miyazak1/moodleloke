import type {
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningQualityGovernance,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningRemediation,
  AdminAIQuestioningSourceReferenceSummary,
  AdminAIQuestioningTopicHealth
} from '../../../lib/api-types';

export const EMPTY_COVERAGE: AdminAIQuestioningBlueprintCoverage = {
  summary: {
    publishedTopicCount: 0,
    coveredTopicCount: 0,
    missingTopicCount: 0,
    activeBlueprintCount: 0,
    pausedBlueprintCount: 0,
    archivedBlueprintCount: 0
  },
  missingTopics: []
};

export const EMPTY_TOPIC_HEALTH: AdminAIQuestioningTopicHealth = {
  summary: {
    total: 0,
    missingBlueprintCount: 0,
    needsCandidateCount: 0,
    needsPublishCount: 0,
    needsQualityReviewCount: 0,
    healthyCount: 0
  },
  items: []
};

export const EMPTY_GENERATION_QUEUE: AdminAIQuestioningGenerationQueueHealth = {
  status: 'healthy',
  recommendedAction: 'monitor',
  summary: {
    total: 0,
    queued: 0,
    running: 0,
    failed: 0,
    succeeded: 0,
    blocked: 0,
    staleRunning: 0
  },
  byStatus: [],
  byFailureCategory: [],
  byProviderFailureCategory: [],
  blockedJobs: [],
  staleRunningJobs: [],
  recent: []
};

export const EMPTY_QUALITY_GOVERNANCE: AdminAIQuestioningQualityGovernance = {
  summary: {
    total: 0,
    needsReviewCount: 0,
    variantCount: 0,
    highSeverityCount: 0,
    recommendedActionCount: 0,
    sla: {
      overdueUnassignedCount: 0,
      overdueAssignedCount: 0,
      dueSoonCount: 0,
      escalationCount: 0,
      sampleQuestionIds: []
    }
  },
  byReason: [],
  byAction: [],
  byAssignee: [],
  bySeverity: []
};

export const EMPTY_QUALITY_TREND: AdminAIQuestioningQualityTrend = {
  days: 14,
  subject: null,
  summary: {
    attemptCount: 0,
    uniqueQuestionCount: 0,
    needsReviewCount: 0,
    highSeverityCount: 0,
    assignedReviewCount: 0,
    regenerationRequiredCount: 0
  },
  byDay: [],
  bySubject: []
};

export const EMPTY_REMEDIATION: AdminAIQuestioningRemediation = {
  summary: {
    conceptCardDrafts: 0,
    variantBlueprints: 0,
    variantCandidates: 0,
    pendingVariantCandidates: 0
  },
  items: []
};

export const EMPTY_MISCONCEPTIONS: AdminAIQuestioningMisconceptions = {
  summary: {
    total: 0,
    active: 0,
    needsReview: 0,
    archived: 0
  },
  governance: {
    summary: {
      possibleDuplicateCount: 0,
      missingConceptCardCount: 0,
      orphanTagCount: 0,
      totalActionable: 0
    },
    suggestions: []
  },
  items: []
};

export const EMPTY_SOURCE_REFERENCE_SUMMARY: AdminAIQuestioningSourceReferenceSummary['summary'] = {
  documentCount: 0,
  questionCount: 0,
  approvedQuestionCount: 0,
  mappedQuestionCount: 0,
  needsReviewQuestionCount: 0,
  rejectedQuestionCount: 0,
  unmappedQuestionCount: 0,
  autoPendingQuestionCount: 0,
  autoProcessingQuestionCount: 0,
  autoApprovedQuestionCount: 0,
  autoExcludedQuestionCount: 0,
  autoRetryPendingQuestionCount: 0,
  autoRetryExhaustedQuestionCount: 0,
  syllabusVersion: '2025',
  canGenerateProfile: false,
  recommendedAction: 'import_source_questions',
  pipelineTask: null
};
