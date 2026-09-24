export type User = {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  emailVerifiedAt?: string;
  emailVerificationSentAt?: string;
  passwordConfigured?: boolean;
  googleLinked?: boolean;
};

export type AdminAIQuestioningBlueprint = {
  id: number;
  subject: string;
  topicId: number;
  difficulty: string;
  questionType: string;
  skill: string | null;
  source: string;
  constraints: unknown;
  status: string;
  topicCode?: string | null;
  topicModule?: string | null;
  topicTitle: string;
  syllabusVersion: string;
  examScope?: string | null;
  allowedQuestionTypes?: string[];
  difficultyRange?: string[];
  excludedScope?: string[];
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  topicStatus?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningBlueprintCoverage = {
  summary: {
    publishedTopicCount: number;
    coveredTopicCount: number;
    missingTopicCount: number;
    activeBlueprintCount: number;
    pausedBlueprintCount: number;
    archivedBlueprintCount: number;
  };
  missingTopics: Array<{
    id: number;
    subject: string;
    code: string;
    title: string;
    module: string | null;
    syllabusVersion: string;
  }>;
};

export type AdminAIQuestioningTopicHealth = {
  summary: {
    total: number;
    missingBlueprintCount: number;
    needsCandidateCount: number;
    needsPublishCount: number;
    needsQualityReviewCount: number;
    fulfillmentBlockedCount?: number;
    healthyCount: number;
  };
  items: Array<{
    topicId: number;
    subject: string;
    code: string;
    title: string;
    module: string | null;
    syllabusVersion: string;
    topicStatus: string;
    blueprintCount: number;
    activeBlueprintCount: number;
    pausedBlueprintCount: number;
    candidateCount: number;
    pendingReviewCount: number;
    approvedQuestionCount: number;
    publishedQuestionCount: number;
    bridgeQuestionCount: number;
    targetPracticeCount?: number;
    approvedPracticeCount?: number;
    openGapCount?: number;
    profileStatus?: 'available' | 'missing_profile' | 'incomplete_profile' | string;
    profileIssueReasons?: string[];
    subjectPracticeFulfillment?: {
      status: 'open' | 'fulfilled' | 'blocked' | string;
      reasonCode?: string;
      stagnantRounds?: number;
      openGapCount?: number;
      blockedAt?: string;
      message?: string;
    };
    qualityReviewCount: number;
    attemptCount: number;
    averageDifficultyConfidence: number | null;
    questionGap?: {
      topicId: number;
      currentCount: number;
      targetCount: number;
      difficultyPlan?: Array<{
        difficultyBand: string;
        targetCount: number;
        currentCount: number;
        neededCount: number;
        shortageRatio?: number;
      }>;
      gaps: Array<{
        gapKey: string;
        questionForm: string;
        cognitiveSkill: string;
        difficultyBand: string;
        readingLoad: string;
        calculationLoad: string;
        neededCount: number;
        reason: 'coverage' | 'low_quality_existing' | 'student_weakness' | 'mock_candidate_pool' | string;
      }>;
    };
    status: 'missing_blueprint' | 'needs_profile_rebuild' | 'needs_candidates' | 'needs_publish' | 'needs_quality_review' | 'healthy';
    action: 'ensure_blueprint' | 'generate_candidates' | 'expand_candidates' | 'review_candidates' | 'review_quality' | 'monitor';
  }>;
};

export type AdminAdaptiveReplenishmentInventory = {
  generatedAt: string;
  policyVersion: string;
  filters: {
    subject: string | null;
    topicId: number | null;
    difficultyBand: string | null;
    limit: number;
  };
  summary: {
    totalCells: number;
    criticalCells: number;
    warningCells: number;
    requiredPublishedCount: number;
    manualStock: number;
    aiFormalStock: number;
    globalEffectiveStock: number;
  };
  snapshotCount?: number;
  items: Array<{
    subject: string;
    topicId: number;
    topicCode: string | null;
    topicTitle: string;
    difficultyBand: string;
    questionType: string;
    manualStock: number;
    aiFormalStock: number;
    globalEffectiveStock: number;
    candidateCount: number;
    failedCount: number;
    exposureCount: number;
    attemptCount: number;
    uniqueUserCount: number;
    fallbackDrawCount: number;
    noQuestionErrorCount: number;
    safetyStock: number;
    cycleTargetStock: number;
    maxStockCap: number;
    requiredPublishedCount: number;
    pressureScore: number;
    riskLevel: string;
    riskReasons: string[];
  }>;
};

export type AdminAdaptiveReplenishmentTeamScopes = {
  generatedAt: string;
  items: Array<{
    type: string;
    name: string | null;
    subject?: string | null;
    status: string | null;
    organizationId?: number | null;
    organizationName?: string | null;
    organizationCohortId?: number | null;
    cohortId?: number;
    teamKey?: string | null;
    memberCount?: number;
  }>;
};

export type AdminAdaptiveReplenishmentRunResult = {
  generatedAt: string;
  requestedSubject: string | null;
  usage?: AdminAdaptiveUsageAggregateRefreshResult;
  processedSubjects: number;
  items: Array<{
    subject: string;
    action: string;
    reason: string;
    run?: AdminSubjectPracticeProductionRun | null | unknown;
    processResult?: AdminSubjectPracticeProductionProcessResult | unknown;
    inventory?: AdminAdaptiveReplenishmentInventory | null | unknown;
  }>;
};

export type AdminAdaptiveUsageAggregateRefreshResult = {
  subject: string | null;
  days: number;
  inserted: number;
  scopes?: {
    global: number;
    team: number;
    user: number;
    events?: number;
  };
  touchedCycles?: number;
  touchedCohorts?: number;
  expiredCohorts?: number;
  refreshedAt: string;
};

export type AdminSubjectPracticeProductionCell = {
  id: number;
  runId: number;
  subject: string;
  topicId: number;
  topicCode: string | null;
  topicTitle: string;
  difficultyBand: string;
  targetCount: number;
  candidateLimit: number;
  publishedCount: number;
  candidateCount: number;
  runningJobCount: number;
  failedCount: number;
  openCount: number;
  status: string;
  targetProfile: unknown;
  lastJobId: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubjectPracticeProductionRun = {
  id: number;
  subject: string;
  status: string;
  triggerType: string;
  syllabusVersion: string | null;
  targetPolicyVersion: string;
  targetTotal: number;
  publishedTotal: number;
  rawPublishedTotal?: number;
  overflowTotal?: number;
  candidateTotal: number;
  failedTotal: number;
  activeRunningJobTotal?: number;
  openTotal: number;
  noProgressRounds: number;
  maxNoProgressRounds: number;
  blockedReasonCode: string | null;
  blockedMessage: string | null;
  plan: unknown;
  result: unknown;
  cells: AdminSubjectPracticeProductionCell[];
  difficultyProgress: Array<{
    difficultyBand: string;
    target: number;
    published: number;
    rawPublished?: number;
    overflow?: number;
    open: number;
    cellsOpen: number;
    cellsFulfilled: number;
    cellsBlocked: number;
  }>;
  startedAt: string | null;
  completedAt: string | null;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubjectPracticeProductionRunList = {
  items: AdminSubjectPracticeProductionRun[];
  latest: AdminSubjectPracticeProductionRun | null;
  publishedTotal: number;
};

export type AdminSubjectPracticeAutoProductionSetting = {
  subject: string;
  enabled: boolean;
  batchTarget: number;
  globalEnabled: boolean;
  effectiveEnabled: boolean;
  updatedById: number | null;
  updatedAt: string | null;
};

export type AdminSubjectPracticeProductionProcessResult = {
  run: AdminSubjectPracticeProductionRun | null;
  enqueued: number;
  processed: number;
  rounds?: number;
  backlog?: {
    handled: number;
    approved: number;
    repaired: number;
    regenerated: number;
  };
  message: string;
};

export type AdminAIQuestioningOperationalReadiness = {
  subject: string | null;
  useCase?: 'subject_practice' | 'online_mock_exam' | string | null;
  status: 'ready' | 'needs_attention' | 'blocked' | string;
  score: number;
  nextAction: string;
  blockers: Array<{ key: string; count: number; action: string }>;
  warnings: Array<{ key: string; count: number; action: string }>;
  dimensions: {
    blueprintCoverage: AdminAIQuestioningBlueprintCoverage['summary'] & { status: string };
    topicBank: AdminAIQuestioningTopicHealth['summary'] & { status: string };
    generationQueue: AdminAIQuestioningGenerationQueueHealth['summary'] & { status: string; recommendedAction: string };
    syllabusGovernance: AdminAIQuestioningSyllabusGovernance['summary'] & { status: string };
    qualityGovernance: {
      status: string;
      needsReviewCount: number;
      highSeverityCount: number;
      escalationCount: number;
      dueSoonCount: number;
    };
  };
  latestAuditEvent: {
    id: number;
    actorId?: number;
    actorEmail?: string;
    module: string;
    resourceType: string;
    resourceId?: string;
    action: string;
    after?: unknown;
    createdAt: string;
  } | null;
  generatedAt: string;
};

export type AdminAIQuestioningTopicDetail = {
  topic: {
    id: number;
    subject: string;
    code: string;
    title: string;
    module: string | null;
    syllabusVersion: string;
    status: string;
  };
  health: AdminAIQuestioningTopicHealth['items'][number] | null;
  blueprints: AdminAIQuestioningBlueprint[];
  questions: AdminAIQuestioningQuestion[];
  quality: Array<{
    questionId: number;
    sourceQuestionId: number | null;
    designedDifficulty: string;
    empiricalDifficulty: string | null;
    difficultyConfidence: number | null;
    attemptCount: number;
    correctRate: number | null;
    unansweredRate: number | null;
    mostSelectedWrongOption: string | null;
    needsReview: boolean;
    reviewReason: string | null;
    qualityGovernance?: unknown;
    updatedAt: string;
  }>;
  remediation: Array<{
    id: number;
    kind: string;
    subject: string;
    topicId: number;
    title: string;
    status: string;
    sourceQuestionId: number | null;
    createdAt: string;
  }>;
};

export type AdminAIQuestioningQuestion = {
  id: number;
  subject: string;
  topicId: number;
  blueprintId: number | null;
  sourceType: string;
  sourceQuestionId: number | null;
  generatedVariantOf: number | null;
  designedDifficulty: string;
  empiricalDifficulty: string | null;
  difficultyConfidence: number | null;
  questionType: string;
  prompt: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: unknown;
  optionMetadata: unknown;
  syllabusVersion: string;
  generationMetadata: unknown;
  reviewMetadata: unknown;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningAgentRun = {
  id: number;
  type: string;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  inputHash: string | null;
  structuredOutput: unknown;
  status: string;
  createdAt: string;
};

export type AdminAIQuestioningQuestionLedgerItem = AdminAIQuestioningQuestion & {
  topicTitle: string;
  topicCode: string | null;
  provider: string | null;
  model: string | null;
  generationSourceLabel: string;
  sourceKind: string;
  fallbackUsed: boolean;
  versionGovernance?: {
    status?: string;
    reason?: string;
    classifiedAt?: string;
    classifiedBy?: string;
    targetUseCase?: string;
    activeGenerationProfileId?: number | null;
    questionGenerationProfileId?: number | null;
    activeSeriesProfileId?: number | null;
    questionSeriesProfileId?: number | null;
    sourceSnapshotMatch?: boolean;
    syllabusSnapshotMatch?: boolean;
  } | null;
  practiceQuestionStatus: string | null;
  formalAssetUpdatedAt: string | null;
  isPracticeReady: boolean;
  exposureCount: number;
  attemptCount: number;
  correctCount: number;
  accuracy: number | null;
  lastUsedAt: string | null;
};

export type AdminAIQuestioningReview = {
  status: 'passed' | 'needs_review' | 'failed';
  issues: Array<{
    code: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
  dimensions: Array<{
    key: string;
    status: 'passed' | 'warning' | 'failed' | 'not_checked';
    note: string;
  }>;
  sources: Array<'deterministic' | 'llm'>;
  provider?: {
    provider: string;
    model: string;
    status: string;
  };
  checkedAt: string;
};

export type AdminAIQuestioningSourceDocument = {
  id: number;
  subject: string;
  sourceType: string;
  title: string;
  examYear: number | null;
  examSession: string | null;
  language: string;
  fileHash: string;
  storageKey: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  licenseScope: string;
  usagePolicy: unknown;
  sourceCompleteness: null | {
    expectedQuestionCount: number | null;
    actualQuestionCount: number;
    excludedQuestionCount: number;
    excludedQuestions: Array<{
      questionNumber: string;
      reason: string;
    }>;
    missingQuestionNumbers: string[];
    completenessRatio: number | null;
    completenessStatus: 'complete' | 'partial_with_exclusions' | 'partial';
    note: string;
  };
  status: string;
  uploadedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningSourceQuestion = {
  id: number;
  documentId: number;
  subject: string;
  questionNumber: string;
  pageNumber: number | null;
  language: string;
  promptHash: string;
  promptText: string | null;
  options: unknown;
  correctAnswer: string | null;
  explanation: string | null;
  syllabusVersion: string;
  topicId: number | null;
  topicTitle: string | null;
  topicCode: string | null;
  topicCodes: string[];
  blueprintLikeTags: string[];
  analysis: unknown;
  analysisStatus: string;
  analysisConfidence: number | null;
  analysisIssues: unknown;
  reviewStatus: string;
  autoProfileStatus?: string;
  autoProfileAttempts?: number;
  autoProfileMaxAttempts?: number;
  autoProfileNextRetryAt?: string | null;
  autoProfileLastTriedAt?: string | null;
  autoProfileDecidedAt?: string | null;
  autoProfileFailureType?: string | null;
  autoProfileFailureReason?: string | null;
  autoProfileDecision?: unknown;
  autoProfileGateResult?: unknown;
  autoProfileTaskId?: string | null;
  sourceUsagePolicy?: unknown;
  sourceDisplayRestricted?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningTopicOption = {
  id: number;
  subject: string;
  code: string;
  title: string;
  module: string | null;
  syllabusVersion: string;
  status: string;
};

export type AdminAIQuestioningSourceReferenceSummary = {
  summary: {
    documentCount: number;
    questionCount: number;
    approvedQuestionCount: number;
    mappedQuestionCount: number;
    pipelineMappedQuestionCount?: number;
    needsReviewQuestionCount: number;
    rejectedQuestionCount: number;
    unmappedQuestionCount: number;
    lowConfidenceQuestionCount?: number;
    outOfSyllabusQuestionCount?: number;
    autoPendingQuestionCount?: number;
    autoProcessingQuestionCount?: number;
    autoApprovedQuestionCount?: number;
    autoExcludedQuestionCount?: number;
    autoRetryPendingQuestionCount?: number;
    autoRetryExhaustedQuestionCount?: number;
    syllabusVersion: string;
    canGenerateProfile: boolean;
    recommendedAction: 'generate_profile' | 'retry_auto_profile' | 'auto_profile_source_questions' | 'confirm_mapped_samples' | 'map_source_questions' | 'import_source_questions' | string;
    pipelineTask?: AdminAIQuestioningSourceProfilePipelineTask | null;
  };
};

export type AdminAIQuestioningProfileDistributionItem = {
  key: string;
  label: string;
  count: number;
  ratio: number;
};

export type AdminAIQuestioningSourceDocumentProfileVisualization = {
  document: AdminAIQuestioningSourceDocument;
  summary: {
    questionCount: number;
    mappedCount: number;
    autoApprovedCount: number;
    pendingCount: number;
    excludedCount: number;
    retryExhaustedCount?: number;
    processedCount: number;
    lowConfidenceCount: number;
    unknownDimensionCount: number;
    healthScore: number;
  };
  distributions: {
    topics: AdminAIQuestioningProfileDistributionItem[];
    difficulty: AdminAIQuestioningProfileDistributionItem[];
    questionForm: AdminAIQuestioningProfileDistributionItem[];
    cognitiveSkill: AdminAIQuestioningProfileDistributionItem[];
    readingLoad: AdminAIQuestioningProfileDistributionItem[];
    calculationLoad: AdminAIQuestioningProfileDistributionItem[];
    answers: AdminAIQuestioningProfileDistributionItem[];
    estimatedTime: AdminAIQuestioningProfileDistributionItem[];
    status: AdminAIQuestioningProfileDistributionItem[];
  };
  diagnostics: Array<{
    severity: 'info' | 'warning' | 'danger' | string;
    code: string;
    message: string;
  }>;
  sampleQuestions: Array<{
    id: number;
    questionNumber: string;
    topicCode: string | null;
    topicTitle: string | null;
    difficulty: string;
    questionForm: string;
    cognitiveSkill: string;
    readingLoad: string;
    calculationLoad: string;
    analysisConfidence: number | null;
    reviewStatus: string;
    autoProfileStatus: string;
  }>;
};

export type AdminAIQuestioningStyleProfile = {
  id: number;
  subject: string;
  syllabusVersion: string;
  scopeType: string;
  scopeId: number | null;
  scopeTitle: string | null;
  scopeCode: string | null;
  sourceQuestionIds: unknown[];
  sampleSize: number;
  confidence: string;
  profile: unknown;
  profileVersion: number;
  sourceQuestionSnapshotHash: string;
  status: string;
  generatedBy: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningExamSeriesProfile = {
  id: number;
  subject: string;
  syllabusVersion: string;
  title: string;
  sourceDocumentIds: unknown[];
  sourceStyleProfileIds: unknown[];
  sourceQuestionIds: unknown[];
  sessionSummary: unknown;
  trendProfile: unknown;
  sampleSize: number;
  confidence: string;
  status: string;
  generatedBy: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningGenerationProfile = {
  id: number;
  subject: string;
  syllabusVersion: string;
  useCase: string;
  title: string;
  seriesProfileId: number | null;
  sourceStyleProfileId: number | null;
  profile: unknown;
  targetPolicy: unknown;
  sampleSize: number;
  confidence: string;
  status: string;
  generatedBy: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningSourceTopicTask = {
  id: string;
  action: 'suggest_filtered' | 'apply_high_confidence' | 'auto_map_profile' | string;
  subject: string | null;
  documentId: number | null;
  reviewStatus: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  error: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningSourceAutoProfileTask = {
  id: string;
  action: 'auto_profile_filtered' | 'retry_failed_samples' | string;
  subject: string | null;
  documentId: number | null;
  autoProfileStatus: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  error: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningGenerationReadiness = {
  ready: boolean;
  subject: string;
  syllabusVersion: string;
  useCase: 'subject_practice' | 'online_mock_exam' | string;
  reasonCode: string | null;
  message: string | null;
  appliedSyllabus: boolean;
  sourceDocumentCount: number;
  sourceQuestionCount: number;
  approvedMappedQuestionCount: number;
  incompleteQuestionCount: number;
  activeStyleProfileCount: number;
  activeSeriesProfileCount: number;
  activeGenerationProfileCount: number;
  activeSeriesProfileId: number | null;
  activeGenerationProfileId: number | null;
  activeGenerationProfileSeriesId: number | null;
  currentSourceSnapshotHash?: string | null;
  activeSeriesSourceSnapshotHash?: string | null;
  activeGenerationSourceSnapshotHash?: string | null;
  currentSyllabusSnapshotHash?: string | null;
  activeSeriesSyllabusSnapshotHash?: string | null;
  activeGenerationSyllabusSnapshotHash?: string | null;
  profileFreshness: 'fresh' | 'missing' | 'stale' | 'conflict' | string;
};

export type AdminAIQuestioningSourceProfilePipelineResult = {
  stage?: string;
  reason?: string;
  subject?: string;
  syllabusVersion?: string;
  readiness?: {
    subjectPractice?: AdminAIQuestioningGenerationReadiness | null;
    onlineMockExam?: AdminAIQuestioningGenerationReadiness | null;
  };
  versionGovernance?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdminAIQuestioningSourceProfilePipelineTask = {
  id: string;
  action: 'source_document_imported' | 'source_document_reprofiled' | 'source_document_deleted' | 'source_auto_profile_completed' | 'syllabus_applied' | 'manual_rebuild' | 'startup_reconcile' | string;
  subject: string | null;
  documentId: number | null;
  syllabusVersion: string | null;
  status: 'queued' | 'running' | 'waiting' | 'blocked' | 'succeeded' | 'failed' | string;
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  error: string | null;
  result: AdminAIQuestioningSourceProfilePipelineResult | null;
  stage: string | null;
  reason: string | null;
  updatedAt: string;
};

export type AdminAIQuestioningSourceDocumentCleanupResult = {
  sourceDocuments: number;
  sourceQuestions: number;
  styleProfiles: number;
  examSeriesProfiles: number;
  generationProfiles: number;
  sourceProfileTasks: number;
  deletedSourceDocuments?: number;
  archivedStyleProfiles?: number;
  archivedExamSeriesProfiles?: number;
  archivedGenerationProfiles?: number;
  archivedSourceProfileTasks?: number;
  rebuildPipelines?: Array<{
    syllabusVersion: string;
    task: AdminAIQuestioningSourceProfilePipelineTask | null;
    skipped?: string | null;
  }>;
};

export type AdminAIQuestioningCandidateBulkTask = {
  id: string;
  action: 'review' | 'approve' | 'reject' | 'archive' | string;
  subject: string | null;
  questionStatus: string | null;
  queue: string | null;
  gateScope: string | null;
  limit: number | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  error: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningGenerationJob = {
  id: number;
  blueprintId: number;
  questionId: number | null;
  subject: string;
  topicId: number;
  topicTitle: string;
  provider: string | null;
  model: string | null;
  requestHash: string | null;
  promptMetadata: unknown;
  rawOutput: unknown;
  normalizedOutput: unknown;
  reviewResult: unknown;
  status: string;
  error: string | null;
  governance: {
    attemptCount: number;
    maxAttempts: number;
    failureCategory: string | null;
    providerFailureCategory: string | null;
    fallbackUsed: boolean;
    lastFailedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningGenerationQueueHealth = {
  status: 'healthy' | 'working' | 'needs_attention' | 'blocked' | string;
  recommendedAction: 'monitor' | 'process_queue' | 'retry_failed' | string;
  summary: {
    total: number;
    queued: number;
    running: number;
    failed: number;
    succeeded: number;
    blocked: number;
    staleRunning: number;
  };
  byStatus: Array<{ key: string; count: number }>;
  byFailureCategory: Array<{ key: string; count: number }>;
  byProviderFailureCategory: Array<{ key: string; count: number }>;
  blockedJobs: number[];
  staleRunningJobs: number[];
  recent: AdminAIQuestioningGenerationJob[];
};

export type AdminAIQuestioningPregenerationResult = {
  summary: {
    topicsScanned: number;
    topicsSelected: number;
    blueprintsCreated: number;
    jobsEnqueued: number;
    jobsSkipped: number;
    jobsProcessed: number;
    jobsSucceeded: number;
    jobsFailed: number;
    candidatesCreated: number;
  };
  topics: Array<{
    topicId: number;
    subject: string;
    statusBefore: string;
    action: string;
    blueprintCreated?: number;
    enqueued?: number;
    skipped?: number;
    jobIds?: number[];
  }>;
  processed: {
    requested: number;
    succeeded: number;
    failed: number;
    items: AdminAIQuestioningGenerationJob[];
    errors: Array<{ id: number; message: string }>;
  };
};

export type AdminAIQuestioningQualityMetric = {
  questionId: number;
  sourceQuestionId: number | null;
  generatedVariantOf: number | null;
  questionStatus: string;
  subject: string;
  topicId: number;
  designedDifficulty: string;
  empiricalDifficulty: string | null;
  difficultyConfidence: number | null;
  attemptCount: number;
  correctRate: number | null;
  medianSeconds: number | null;
  unansweredRate: number | null;
  markedRate: number | null;
  optionSelectionStats?: Array<{
    optionId: string;
    count: number;
    selectionRate?: number;
    wrongSelectionRate?: number;
    isCorrectOption: boolean;
    distractorIntent?: string | null;
    misconceptionTags?: string[];
    qualitySignal?: string;
  }> | null;
  mostSelectedWrongOption: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  replacementCandidateStatus?: string | null;
  qualityGovernance?: {
    status?: string;
    disposition?: string;
    reason?: string;
    note?: string;
    assignedTo?: number;
    assignedBy?: number | null;
    assignedAt?: string;
    replacementQuestionId?: number;
    replacementPublishedQuestionId?: number;
    decidedAt?: string;
  } | null;
  qualitySummary?: {
    severity: 'low' | 'medium' | 'high';
    reasons: string[];
    recommendedAction: string;
    evidence: {
      attemptCount: number;
      generatedVariantOf?: number | null;
      correctRate: number | null;
      unansweredRate: number | null;
      designedDifficulty: string;
      empiricalDifficulty: string | null;
      difficultyConfidence: number | null;
      mostSelectedWrongOption: string | null;
      optionSignals: Record<string, number>;
      problemOptions: Array<{
        optionId: string;
        signal?: string;
        count: number;
        wrongSelectionRate: number;
        distractorIntent: string | null;
        misconceptionTags: string[];
      }>;
    };
  };
  updatedAt: string;
};

export type AdminAIQuestioningQualityGovernance = {
  summary: {
    total: number;
    needsReviewCount: number;
    variantCount: number;
    highSeverityCount: number;
    recommendedActionCount: number;
    sla: {
      overdueUnassignedCount: number;
      overdueAssignedCount: number;
      dueSoonCount: number;
      escalationCount: number;
      sampleQuestionIds: number[];
    };
  };
  byReason: Array<{
    reason: string;
    count: number;
    needsReviewCount: number;
    variantCount: number;
    highSeverityCount: number;
    recommendedActions: Record<string, number>;
    sampleQuestionIds: number[];
  }>;
  byAction: Array<{
    action: string;
    count: number;
    needsReviewCount: number;
    variantCount: number;
    highSeverityCount: number;
    sampleQuestionIds: number[];
  }>;
  byAssignee: Array<{
    assigneeId: number | null;
    assigneeLabel: string;
    count: number;
    needsReviewCount: number;
    highSeverityCount: number;
    overdueCount: number;
    dueSoonCount: number;
    sampleQuestionIds: number[];
  }>;
  bySeverity: Array<{ key: string; count: number }>;
};

export type AdminAIQuestioningQualityTrend = {
  days: number;
  subject: string | null;
  summary: {
    attemptCount: number;
    uniqueQuestionCount: number;
    needsReviewCount: number;
    highSeverityCount: number;
    assignedReviewCount: number;
    regenerationRequiredCount: number;
  };
  byDay: Array<{
    day: string;
    subject: string;
    attemptCount: number;
    uniqueQuestionCount: number;
    correctRate: number | null;
    unansweredRate: number | null;
    needsReviewCount: number;
    highSeverityCount: number;
    assignedReviewCount: number;
    regenerationRequiredCount: number;
  }>;
  bySubject: Array<{
    subject: string;
    attemptCount: number;
    uniqueQuestionCount: number;
    correctRate: number | null;
    unansweredRate: number | null;
    needsReviewCount: number;
    highSeverityCount: number;
    assignedReviewCount: number;
    regenerationRequiredCount: number;
  }>;
};

export type AdminAIQuestioningSyllabusGovernance = {
  summary: {
    total: number;
    currentCount: number;
    staleCount: number;
    unpublishedTopicCount: number;
    pendingReviewCount: number;
  };
  items: Array<{
    questionId: number;
    subject: string;
    topicId: number;
    topicTitle: string;
    questionSyllabusVersion: string;
    topicSyllabusVersion: string;
    sourceUrl: string | null;
    sourceLabel: string | null;
    lastVerifiedAt: string | null;
    verifiedBy: number | null;
    verifiedByEmail: string | null;
    topicStatus: string;
    status: string;
    reason: string;
  }>;
};

export type AdminAIQuestioningSyllabusTopicUpdatePreview = {
  topic: {
    id: number;
    subject: string;
    code: string;
    title: string;
    status: string;
    syllabusVersion: string;
    sourceUrl: string | null;
    sourceLabel: string | null;
    lastVerifiedAt: string | null;
  };
  next: {
    status: string;
    syllabusVersion: string;
    sourceUrl: string | null;
    sourceLabel: string | null;
    lastVerifiedAt: string | null;
  };
  impact: {
    total: number;
    currentApprovedCount: number;
    staleAfterUpdateCount: number;
    alreadyPendingReviewCount: number;
    archivedOrRejectedCount: number;
  };
  sample: Array<{
    id: number;
    status: string;
    syllabusVersion: string;
    designedDifficulty: string;
    prompt: string;
  }>;
};

export type AdminAIQuestioningSyllabusBulkUpdatePreview = {
  summary: {
    topics: number;
    totalQuestions: number;
    currentApprovedCount: number;
    staleAfterUpdateCount: number;
    alreadyPendingReviewCount: number;
    archivedOrRejectedCount: number;
  };
  items: AdminAIQuestioningSyllabusTopicUpdatePreview[];
  before?: AdminAIQuestioningSyllabusTopicUpdatePreview[];
};

export type AdminAIQuestioningSyllabusJsonImportPreview = {
  payload: {
    schemaVersion: string;
    subject: 'math' | 'physics' | 'chemistry';
    syllabusVersion: string;
    sourceLabel: string | null;
    sourceUrl: string | null;
    verifiedAt: string | null;
    topicCount: number;
  };
  summary: {
    subject: 'math' | 'physics' | 'chemistry';
    syllabusVersion: string;
    topicsInFile: number;
    newTopics: number;
    updatedTopics: number;
    unchangedTopics: number;
    missingFromFile: number;
    questionsAffected: number;
    approvedQuestionsBecomingPendingReview: number;
  };
  items: Array<{
    code: string;
    action: 'create' | 'update' | 'unchanged';
    existingTopicId: number | null;
    matchedBy?: 'code' | 'previous_code';
    previousCode?: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    affectedQuestionCount: number;
    approvedQuestionsBecomingPendingReview: number;
  }>;
  missingFromFile: Array<{
    id: number;
    code: string;
    title: string;
    status: string;
    questionCount: number;
    approvedQuestionCount: number;
  }>;
  errors: string[];
};

export type AdminAIQuestioningSyllabusJsonImport = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry' | string;
  syllabusVersion: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  status: string;
  rawJson: unknown;
  previewSummary: AdminAIQuestioningSyllabusJsonImportPreview | unknown;
  appliedAt: string | null;
  appliedBy: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIQuestioningSyllabusJsonImportApplyResult = {
  import: AdminAIQuestioningSyllabusJsonImport;
  preview: AdminAIQuestioningSyllabusJsonImportPreview;
  apply: {
    missingTopicAction: 'keep' | 'draft' | 'archive';
    missingTopicsChanged: number;
    refreshedQuestionCount: number;
  };
};

export type AdminAIQuestioningSyllabusReversePlan = {
  mode: 'dry_run';
  importId: number;
  importStatus: string;
  subject: string;
  syllabusVersion: string;
  generatedAt: string;
  summary: {
    topicOperations: number;
    createOperations: number;
    restoreOperations: number;
    missingTopicOperations: number;
    codeMigrationOperations: number;
    canAutoPlanOperations: number;
    blockerCount: number;
    questionReviewCount: number;
    questionPendingReviewCount: number;
    questionAlreadyApprovedCount: number;
    manualReviewRequired: number;
    missingTopicAction: string;
    appliedAt: string | null;
    appliedBy: number | null;
  };
  guidance: string[];
  operations: Array<{
    code: string;
    action: string;
    operation: string;
    existingTopicId: number | null;
    previousCode: string | null;
    titleBefore: string | null;
    titleAfter: string | null;
    currentTitle: string | null;
    activeQuestionCount: number;
    approvedQuestionCount: number;
    canAutoPlan: boolean;
    blockers: string[];
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>;
  missingTopicOperations: Array<{
    topicId: number | null;
    code: string;
    title: string;
    operation: string;
    originalStatus: string;
    currentStatus: string | null;
    activeQuestionCount: number;
    approvedQuestionCount: number;
    canAutoPlan: boolean;
    blockers: string[];
  }>;
  questionReview: {
    metadataImportId: number;
    affectedByImportMetadata: number;
    pendingReviewCount: number;
    alreadyApprovedCount: number;
    recommendation: string;
  };
  blockers: string[];
};

export type AdminAIQuestioningSyllabusReversePlanResult = {
  import: AdminAIQuestioningSyllabusJsonImport;
  reversePlan: AdminAIQuestioningSyllabusReversePlan;
  preview: AdminAIQuestioningSyllabusJsonImportPreview | Record<string, unknown>;
};

export type AdminAIQuestioningRemediation = {
  summary: {
    conceptCardDrafts: number;
    variantBlueprints: number;
    variantCandidates: number;
    pendingVariantCandidates: number;
  };
  items: Array<{
    id: number;
    kind: string;
    subject: string;
    topicId: number;
    title: string;
    body?: string | null;
    status: string;
    sourceQuestionId: number | null;
    misconceptionLabel?: string | null;
    exampleJson?: unknown;
    reviewMetadata?: unknown;
    createdAt: string;
  }>;
};

export type AdminAIQuestioningMisconceptions = {
  summary: {
    total: number;
    active: number;
    needsReview: number;
    archived: number;
  };
  governance: {
    summary: {
      possibleDuplicateCount: number;
      missingConceptCardCount: number;
      orphanTagCount: number;
      totalActionable: number;
    };
    suggestions: Array<{
      issue: 'possible_duplicate' | 'missing_concept_card' | 'orphan_tag';
      severity: 'info' | 'warning';
      misconceptionId: number;
      targetId: number | null;
      label: string;
      targetLabel: string | null;
      subject: string;
      topicId: number | null;
      topicTitle: string | null;
      reason: string;
    }>;
  };
  items: Array<{
    id: number;
    slug: string;
    subject: string;
    topicId: number | null;
    topicTitle: string | null;
    label: string;
    description: string | null;
    status: string;
    conceptCardCount: number;
    publishedConceptCardCount: number;
    questionCount: number;
    optionCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type LearningDashboardSubject = {
  subject: 'math' | 'physics' | 'chemistry';
  label: string;
  masteryAvg: number | null;
  answeredCount: number;
  accuracy: number | null;
  weakTopicCount: number;
  href: string;
};

export type LearningDashboard = {
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
    subject: 'math' | 'physics' | 'chemistry';
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
      subject: 'math' | 'physics' | 'chemistry';
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
      subject: 'math' | 'physics' | 'chemistry';
      subjectLabel: string;
      score: number;
      accuracy: number | null;
      unansweredCount: number;
      totalSeconds: number;
      submittedAt: string | null;
    }>;
    subjectStats: Array<{
      subject: 'math' | 'physics' | 'chemistry';
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
    subject: 'math' | 'physics' | 'chemistry';
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
  readiness: {
    score: number;
    confidence?: 'low' | 'medium' | 'high';
    confidenceReason?: string;
    scoreExplanation?: string;
    stage: 'diagnosing' | 'building' | 'repairing' | 'reinforcing' | 'exam_ready';
    title: string;
    body: string;
    dimensions: Array<{
      key: 'coverage' | 'mastery' | 'mock' | 'review' | 'rhythm' | 'evidence';
      label: string;
      score: number;
      maxScore: number;
      status: 'strong' | 'steady' | 'weak' | 'insufficient';
      evidence: string;
    }>;
    coverage?: {
      overallRate: number | null;
      highWeightCoverageRate: number | null;
      blindSpotCount: number;
      subjects: Array<{
        subject: 'math' | 'physics' | 'chemistry';
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
    difficulty?: {
      attemptedCount: number;
      highDifficultyAttemptCount: number;
      independentHighDifficultyAttemptCount: number;
      highDifficultySubjectReadyCount: number;
      highDifficultySubjectThresholds: Array<{
        subject: 'math' | 'physics' | 'chemistry';
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
        subject: 'math' | 'physics' | 'chemistry';
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
      type: 'start_diagnostic' | 'review_due_patterns' | 'continue_active_round' | 'repair_weak_subject' | 'resume_mock_attempt' | 'start_mock_exam' | 'keep_training';
      title: string;
      body: string;
      ctaLabel: string;
      href: string;
    };
    nextActions?: Array<{
      type: 'start_diagnostic' | 'review_due_patterns' | 'continue_active_round' | 'repair_weak_subject' | 'resume_mock_attempt' | 'start_mock_exam' | 'keep_training';
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
    actionOutcome?: {
      windowDays: number;
      clickedCount: number;
      followedCount: number;
      followThroughRate: number;
      abilityLiftCount: number;
      abilityLiftRate: number;
      averageMasteryDelta: number | null;
      averageExpectedGain: number | null;
      averageScoreDelta: number | null;
      topActionType: 'start_diagnostic' | 'review_due_patterns' | 'continue_active_round' | 'repair_weak_subject' | 'resume_mock_attempt' | 'start_mock_exam' | 'keep_training' | null;
      lastClickedAt: string | null;
      status: 'no_data' | 'watching' | 'positive' | 'needs_calibration';
    };
  };
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

export type CscaReviewQueueItem = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
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

export type CscaReviewQueue = {
  summary: {
    total: number;
    dueToday: number;
    highPriority: number;
    subjects: Array<{
      subject: 'math' | 'physics' | 'chemistry';
      subjectLabel: string;
      count: number;
    }>;
  };
  items: CscaReviewQueueItem[];
};

export type School = {
  id: number;
  nameZh: string;
  nameEn?: string;
  schoolType: string;
  region?: string;
  city?: string;
  cityZh?: string;
  citySlug?: string;
  regionLabel?: string;
  rank?: number;
  cscaRequired: boolean;
  cscaRequirement?: string;
  cscaSubjects?: string[];
  languageRequirement?: string;
  applicationLevel?: string;
  languageOfInstruction?: string[];
  hskRequirement?: string;
  englishRequirement?: string;
  deadlineSummary?: string;
  tuitionSummary?: string;
  applicationFee?: string;
  officialWebsiteUrl?: string;
  admissionsWebsiteUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceNote?: string;
  qualityScore?: number;
  missingFields?: string[];
  completenessLabel?: string;
  featuredPrograms?: string[];
  scholarships?: string[];
  fitNotes?: string[];
  derivedTags?: string[];
  subjectTags?: string[];
  languageTags?: string[];
  tuitionBandLabel?: string;
  hasEnglishPrograms?: boolean;
  hasScholarships?: boolean;
  decisionSummary?: string;
  programCount?: number;
  undergraduateProgramCount?: number;
  postgraduateProgramCount?: number;
  englishProgramCount?: number;
  programSubjectTags?: string[];
  programTuitionBandLabel?: string;
  programQualityIssues?: string[];
  programs?: SchoolProgram[];
  cscaRules?: SchoolCscaRule[];
  scholarshipsDetailed?: SchoolScholarship[];
  upcomingDeadlines?: SchoolUpcomingDeadline[];
  requiredSubjectTags?: string[];
  quickFacts?: SchoolQuickFacts;
  detailDisplay?: SchoolDetailDisplay;
  scholarshipCount?: number;
  cscScholarshipCount?: number;
};

export type SchoolProgram = {
  id: number;
  version: number;
  schoolId: number;
  nameZh: string;
  nameEn?: string;
  degreeLevel?: string;
  durationYears?: string;
  fieldCategory?: string;
  teachingLanguage?: string;
  cscaSubjects?: string[];
  cscaRequirement?: string;
  hskRequirement?: string;
  englishRequirement?: string;
  tuitionAmount?: number;
  tuitionCurrency?: string;
  tuitionPeriod?: string;
  tuitionText?: string;
  scholarshipText?: string;
  openDate?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  applicationUrl?: string;
  applicationNote?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  isVerified?: boolean;
  hasScholarship?: boolean;
  badgeText?: string;
  displayTuition?: string;
  displaySubjects?: string[];
  displayGroup?: string;
  displayGroupLabel?: string;
};

export type SchoolCscaRule = {
  id: number;
  version: number;
  schoolId: number;
  programId?: number;
  title: string;
  category: string;
  scope?: string;
  cscaSubjects?: string[];
  languageCondition?: string;
  description?: string;
  importantNote?: string;
  applicablePrograms?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  isVerified?: boolean;
};

export type SchoolProgramDisplayGroup = {
  key: string;
  label: string;
  total: number;
  visibleCount?: number;
  hiddenNote?: string;
};

export type SchoolApplicationTimelineItem = {
  key: string;
  label: string;
  dateLabel?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  statusLabel?: string;
};

export type SchoolScholarship = {
  id: number;
  version: number;
  schoolId: number;
  programId?: number;
  name: string;
  type: string;
  coverage?: string;
  applicableDegree?: string;
  applicableProgram?: string;
  amountText?: string;
  requirementText?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  scholarshipSlug?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  isCsc?: boolean;
  isVerified?: boolean;
};

export type ScholarshipFundingLevel = 'full' | 'partial' | 'unknown';

export type PublicScholarship = {
  id: number;
  slug: string;
  title: string;
  schoolId: number;
  schoolName: string;
  schoolNameEn?: string;
  schoolRegion?: string;
  schools: Array<{ id: number; nameZh: string; nameEn?: string; region?: string }>;
  schoolCount: number;
  programId?: number;
  programName?: string;
  programNameEn?: string;
  programs: Array<{ id: number; schoolId: number; schoolName: string; nameZh: string; nameEn?: string; degreeLevel?: string; teachingLanguage?: string }>;
  type: string;
  typeLabel: string;
  fundingLevel: ScholarshipFundingLevel;
  coverage?: string;
  applicableDegree?: string;
  applicableProgram?: string;
  amountText?: string;
  requirementText?: string;
  bodySections: ScholarshipBodySection[];
  benefitItems: ScholarshipBenefitItem[];
  eligibilityItems: ScholarshipInfoItem[];
  applicationMaterials: ScholarshipInfoItem[];
  applicationSteps: ScholarshipInfoItem[];
  contactInfo?: ScholarshipContactInfo;
  actionLinks: ScholarshipActionLink[];
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  targetCountries: string[];
  targetRegions: string[];
  benefits: string[];
  deadline?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  tags: string[];
  summary: string;
};

export type ScholarshipBodySection = {
  title?: string;
  body?: string;
  paragraphs?: string[];
  items?: string[];
};

export type ScholarshipBenefitItem = {
  key?: string;
  label: string;
  included?: boolean;
  note?: string;
};

export type ScholarshipInfoItem = {
  label?: string;
  value?: string;
  body?: string;
};

export type ScholarshipContactInfo = {
  label?: string;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  note?: string;
};

export type ScholarshipActionLink = {
  label: string;
  url?: string;
  kind?: 'primary' | 'secondary' | 'source' | 'exam' | string;
};

export type ScholarshipStats = {
  total: number;
  fullFunding: number;
  government: number;
  countries: number;
  types: number;
};

export type ScholarshipListResult = {
  items: PublicScholarship[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: {
    types: ScholarshipTypeSummary[];
    countries: ScholarshipCountrySummary[];
    regions: Array<{ region: string; count: number }>;
    fundingLevels: Array<{ value: string; label: string; count: number }>;
  };
  stats: ScholarshipStats;
};

export type ScholarshipTypeSummary = {
  key: string;
  title: string;
  icon: string;
  tone: string;
  body: string;
  coverage: string;
  difficulty: string;
  count: number;
  full: number;
};

export type ScholarshipCountrySummary = {
  code: string;
  name: string;
  region: string;
  count: number;
};

export type ScholarshipCountriesResult = {
  hotCountries: ScholarshipCountrySummary[];
  countries: ScholarshipCountrySummary[];
  regions: Array<{ region: string; count: number }>;
  stats: ScholarshipStats;
};

export type ScholarshipDetailResult = {
  item: PublicScholarship;
  schools: Array<{ id: number; nameZh: string; nameEn?: string; region?: string }>;
  programs: Array<{ id: number; schoolId: number; schoolName: string; nameZh: string; nameEn?: string; degreeLevel?: string; teachingLanguage?: string }>;
  similar: PublicScholarship[];
};

export type AdminScholarship = {
  id: number;
  version: number;
  slug: string;
  title: string;
  type: string;
  fundingLevel: string;
  providerName?: string;
  providerNameEn?: string;
  providerLocation?: string;
  summary?: string;
  coverage?: string;
  applicableDegree?: string;
  applicableProgram?: string;
  amountText?: string;
  requirementText?: string;
  bodySections?: ScholarshipBodySection[];
  benefitItems?: ScholarshipBenefitItem[];
  eligibilityItems?: ScholarshipInfoItem[];
  applicationMaterials?: ScholarshipInfoItem[];
  applicationSteps?: ScholarshipInfoItem[];
  contactInfo?: ScholarshipContactInfo;
  actionLinks?: ScholarshipActionLink[];
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  targetCountries: string[];
  targetRegions: string[];
  benefits: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  schoolIds: number[];
  programIds: number[];
  schools: Array<{ id: number; nameZh: string; nameEn?: string; region?: string; status: string }>;
  programs: Array<{ id: number; schoolId: number; schoolName: string; nameZh: string; nameEn?: string; degreeLevel?: string; teachingLanguage?: string }>;
  createdAt: string;
  updatedAt: string;
};

export type SchoolUpcomingDeadline = {
  programId: number;
  programName: string;
  degreeLevel?: string;
  teachingLanguage?: string;
  applicationRound?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  daysUntilDeadline?: number;
  statusLabel: string;
};

export type SchoolQuickFacts = {
  location?: string;
  region?: string;
  tuition?: string;
  livingCost?: string;
  accommodation?: string;
  programCount: number;
  englishProgramCount: number;
};

export type SchoolDetailDisplay = {
  city?: string;
  regionLabel?: string;
  livingCostLabel?: string;
  displayProgramCount?: number;
  displayUndergraduateCount?: number;
  visibleProgramCount?: number;
  hiddenProgramNote?: string;
  displaySubjectTags?: string[];
  programFieldTags?: string[];
  programDisplayGroups?: SchoolProgramDisplayGroup[];
  applicationTimeline?: SchoolApplicationTimelineItem[];
};

export type SchoolDetail = School & {
  applicationPortalNotes?: string;
  campusHighlights?: string[];
  contactNotes?: string[];
};

export type SchoolSearchParams = {
  locale?: string;
  keyword?: string;
  region?: string;
  schoolType?: string;
  cscaRequired?: string;
  applicationLevel?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  quality?: 'real';
  language?: string;
  subject?: string;
  hsk?: string;
  hasTuition?: boolean;
  hasScholarship?: boolean;
  hasEnglishPrograms?: boolean;
  degreeLevel?: string;
  teachingLanguage?: string;
  programSubject?: string;
  fieldCategory?: string;
  hasProgramTuition?: boolean;
  hasUpcomingDeadline?: boolean;
  hasCsc?: boolean;
  hasCscaRules?: boolean;
  hasDetailedScholarship?: boolean;
};

export type SchoolListFacets = {
  regions: string[];
  schoolTypes: string[];
  cscaOptions: Array<{ value: 'true' | 'false'; label: string; count: number }>;
  applicationLevels: string[];
};

export type SchoolListResult = {
  items: School[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: SchoolListFacets;
  appliedFiltersSummary: string[];
};

export type PublicContentBlock = {
  key: string;
  locale?: string;
  requestedLocale?: string;
  isFallback?: boolean;
  title: string;
  subtitle?: string;
  body: Record<string, unknown>;
  updatedAt: string;
};

export type AdminContentBlock = PublicContentBlock & {
  id: string;
  status: string;
  sortOrder: number;
  version: number;
};

export type CityGuideContent = {
  summary?: string;
  overview?: string;
  bestFor?: string[];
  quickFacts?: Array<{ label: string; value: string; note?: string }>;
  budgetSummary?: { monthly: string; yearly: string; note: string };
  costProfiles?: Array<{ label: string; value: string; note: string }>;
  why?: string[];
  costBreakdown?: Array<{ label: string; value: string }>;
  lifeSections?: Array<{ title: string; body: string; icon?: string }>;
  transportNotes?: string[];
  applicationTips?: string[];
  applicationAdvice?: Array<{ title: string; body: string }>;
  relatedProgramKeywords?: string[];
  nextSteps?: Array<{ title: string; body: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  cityFaqs?: Array<{ question: string; answer: string }>;
};

export type CityGuide = {
  id?: number;
  slug: string;
  nameZh: string;
  nameEn: string;
  region: string;
  monthlyCost?: number;
  costLevel?: string;
  density?: string;
  tags: string[];
  content: CityGuideContent;
  nearby: string[];
  references: {
    schoolCount?: number;
    programCount?: number;
    englishProgramCount?: number;
    scholarshipCount?: number;
    cscaRequiredSchoolCount?: number;
  };
  status: 'draft' | 'published' | 'archived';
  sortOrder: number;
  version: number;
  updatedAt: string;
};

export type CityGuideAggregate = {
  actualSchoolCount: number;
  actualProgramCount: number;
  actualEnglishProgramCount: number;
  actualScholarshipCount: number;
  actualCscaRequiredSchoolCount: number;
  visibleSchools: Array<{ key: string; id: number; nameZh: string; nameEn?: string; region?: string; programCount?: number; englishProgramCount?: number; scholarshipCount?: number }>;
  visiblePrograms: Array<{ key: string; schoolId: number; schoolName: string; title: string; meta: string; tuition: string; deadline: string; tags: string[] }>;
  visibleScholarships: Array<{ key: string; schoolId: number; schoolName: string; title: string; meta: string; tags: string[] }>;
};

export type CityGuideDetail = {
  city: CityGuide;
  aggregate: CityGuideAggregate;
};

export type ApplicationTimelineWindow = {
  id?: number;
  month: string;
  title: string;
  applicationWindow: string;
  cscaWindow: string;
  status: 'draft' | 'published' | 'archived';
  sortOrder: number;
  version?: number;
  updatedAt?: string;
};

export type ApplicationTimelineProject = {
  key: string;
  schoolId: number;
  schoolName: string;
  schoolNameEn?: string;
  schoolRegion?: string;
  title: string;
  degree?: string;
  language?: string;
  field?: string;
  tuition?: string;
  deadlineDate?: string;
  deadline?: string;
  days?: number;
  status?: string;
  applicationRound?: string;
  tags: string[];
};

export type ApplicationTimelineSchool = {
  key: string;
  school: {
    id: number;
    nameZh: string;
    nameEn?: string;
    region?: string;
    programCount?: number;
    englishProgramCount?: number;
    scholarshipCount?: number;
    cscScholarshipCount?: number;
  };
  rows: ApplicationTimelineProject[];
  earliest: ApplicationTimelineProject;
};

export type ApplicationTimelineResponse = {
  stats: {
    deadlineItemCount: number;
    schoolCount: number;
    urgent7Count: number;
    urgent30Count: number;
    scholarshipSchoolCount: number;
    englishProgramSchoolCount: number;
  };
  windows: ApplicationTimelineWindow[];
  schools: ApplicationTimelineSchool[];
  programs: ApplicationTimelineProject[];
};

export type SearchType = 'content' | 'practice' | 'page';

export type SearchItem = {
  type: SearchType;
  title: string;
  subtitle?: string;
  snippet: string;
  href: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type SearchResult = {
  query: string;
  total: number;
  degraded: boolean;
  items: SearchItem[];
  groups: Record<SearchType, number>;
};

export type AuthResult = {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  verificationEmailSent?: boolean;
};

export type SpecialPracticeSubject = 'math' | 'physics' | 'chemistry';

export type SpecialPracticeAvailabilityStatus = 'available' | 'replenishing' | 'exhausted' | 'unavailable';

export type SpecialPracticeAvailability = {
  status: SpecialPracticeAvailabilityStatus;
  isAvailable: boolean;
  requiredQuestionCount: number;
  publishedQuestionCount: number;
  message: string;
  code: string;
};

export type SpecialPracticeSubjectCard = {
  id: SpecialPracticeSubject;
  title: string;
  description: string;
  tags: string[];
  topicCount: number;
  availableTopicCount?: number;
  questionCount: number;
  availability?: SpecialPracticeAvailability;
  freeTopicSlug: string | null;
};

export type SpecialPracticeTopic = {
  id: number;
  subject: SpecialPracticeSubject;
  module: string;
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  questionCount: number;
  publishedQuestionCount: number;
  sessionCount: number;
  availability?: SpecialPracticeAvailability;
  overview?: string;
  focusItems?: string[];
  difficultyLabel?: string;
  frequencyLabel?: string;
  studyAdvice?: string;
  relatedResources?: Array<{ label: string; path: string }>;
  relatedVisualizerSlug?: string;
};

export type SpecialPracticeOverview = {
  subjects: SpecialPracticeSubjectCard[];
  totals: { subjectCount: number; topicCount: number; questionCount: number };
  features: string[];
  mockExamPath: string;
  mockExamRule?: { durationMinutes: number; questionCount: number; totalScore: number; questionTypeLabel: string };
};

export type SpecialPracticeSubjectDetail = {
  subject: Pick<SpecialPracticeSubjectCard, 'id' | 'title' | 'description' | 'tags'>;
  stats: { topicCount: number; availableTopicCount?: number; questionCount: number; estimatedMinutes: number; availability?: SpecialPracticeAvailability };
  mockExamRule?: { durationMinutes: number; questionCount: number; totalScore: number; questionTypeLabel: string };
  modules: Array<{ module: string; topics: SpecialPracticeTopic[] }>;
};

export type SpecialPracticeStart = {
  topic: SpecialPracticeTopic;
  focus: string[];
  advice: string;
  questionPreviewCount: number;
  availability?: SpecialPracticeAvailability;
  availableLanguages?: string[];
  currentLanguage?: string;
};

export type SpecialPracticeQuestion = {
  id: number;
  orderNumber: number;
  difficulty: string;
  questionType: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
};

export type HomeMiniMockQuestion = SpecialPracticeQuestion & {
  subject: SpecialPracticeSubject;
  subjectTitle: string;
  topic: Pick<SpecialPracticeTopic, 'id' | 'slug' | 'title' | 'module'>;
  knowledgeTags: string[];
};

export type HomeMiniMock = {
  seed: string;
  targetQuestionCount: number;
  questionCount: number;
  perSubjectTarget: number;
  subjects: Array<{
    id: SpecialPracticeSubject;
    title: string;
    target: number;
    questionCount: number;
  }>;
  questions: HomeMiniMockQuestion[];
};

export type HomeMiniMockReport = {
  summary: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    answeredCount: number;
    total: number;
    accuracy: number;
  };
  subjectBreakdown: Array<{
    id: SpecialPracticeSubject;
    title: string;
    total: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    accuracy: number;
  }>;
  weakTags: Array<{ tag: string; total: number; wrong: number; subjects: string[] }>;
  items: Array<HomeMiniMockQuestion & {
    selected: string;
    correctAnswer: string;
    isCorrect: boolean;
    isUnanswered: boolean;
    explanation: string;
  }>;
};

export type SpecialPracticeSession = {
  id: number;
  topic: SpecialPracticeTopic;
  language: string;
  availableLanguages?: string[];
  startedAt: string;
  completedAt: string | null;
  answers: Record<string, string>;
  timeSpent: Record<string, number>;
  currentQuestion: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  version: number;
};

export type SpecialPracticeSessionDetail = {
  session: SpecialPracticeSession;
  questions: SpecialPracticeQuestion[];
};

export type SpecialPracticeCheckResult = {
  questionId: number;
  selected: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  knowledgeTags: string[];
};

export type SpecialPracticeReport = {
  session: SpecialPracticeSession;
  summary: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    total: number;
    accuracy: number;
    totalSeconds: number;
    averageSeconds: number;
  };
  weakTags: Array<{ tag: string; total: number; wrong: number }>;
  items: Array<SpecialPracticeQuestion & {
    selected: string;
    correctAnswer: string;
    isCorrect: boolean;
    isUnanswered: boolean;
    explanation: string;
    knowledgeTags: string[];
    secondsSpent: number;
  }>;
};

export type SpecialPracticeSessionHistory = {
  id: number;
  topic: Pick<SpecialPracticeTopic, 'id' | 'slug' | 'title' | 'subject' | 'module'>;
  subject: SpecialPracticeSubject;
  module: string;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  startedAt: string;
  completedAt: string | null;
  reportPath: string;
};

export type SpecialPracticeWrongQuestionItem = {
  sessionId: number;
  questionId: number;
  topic: Pick<SpecialPracticeTopic, 'id' | 'slug' | 'title' | 'subject' | 'module'>;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  selected: string;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  timeSpentSeconds: number;
  completedAt: string | null;
};

export type CscaWrongQuestionSourceType = 'adaptive_round' | 'diagnostic' | 'mock_exam' | 'special_practice';

export type CscaWrongQuestionItem = {
  itemKey: string;
  sourceType: CscaWrongQuestionSourceType;
  sourceId: number;
  questionId: number;
  subject: SpecialPracticeSubject | string;
  topicId: number | null;
  topicTitle: string;
  topic: {
    id: number | null;
    slug: string;
    title: string;
    subject: string;
    module: string;
  };
  prompt: string;
  options: Array<{ id: string; text: string }>;
  selected: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  aiExplanationId: number | null;
  structuredExplanation: {
    whyWrong: string;
    correctApproach: string;
    quickMethod: string;
    avoidNextTime: string;
  } | null;
  mistakePattern: {
    patternType: string;
    label: string;
    confidence: number;
    source: 'wrong_pattern' | 'rule' | string;
  };
  patternType: string;
  patternLabel: string;
  patternConfidence: number;
  status: 'unreviewed' | 'viewed_explanation' | 'retried' | 'mastered';
  knowledgeTags: string[];
  timeSpentSeconds: number;
  lastWrongAt: string | null;
  nextReviewAt: string | null;
  completedAt: string | null;
  reviewPath: string | null;
  practicePath: string;
  reviewPattern?: {
    id: number;
    status: string;
    patternType: string;
    nextReviewAt: string | null;
    lastReviewCompletedAt: string | null;
    verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
    verificationRequired: boolean;
    verificationHref: string;
  } | null;
};

export type CscaWrongQuestionReviewPack = {
  patternType: string;
  label: string;
  confidence: number;
  source: 'wrong_pattern' | 'rule' | string;
  count: number;
  dueCount: number;
  subjects: string[];
  topicTitles: string[];
  latestWrongAt: string | null;
  practicePath: string;
};

export type CscaWrongQuestionResponse = {
  summary: {
    total: number;
    unreviewed: number;
    dueForReview: number;
    patternTypes: Array<{
      patternType: string;
      label: string;
      count: number;
    }>;
  };
  reviewPacks: CscaWrongQuestionReviewPack[];
  items: CscaWrongQuestionItem[];
};

export type AdaptiveSubjectSummary = {
  id: SpecialPracticeSubject;
  title: string;
  topicCount: number;
  questionCount: number;
  averageMastery: number | null;
  activeSessionId: number | null;
  questionLanguage: string | null;
  nextAction: 'start_diagnostic' | 'continue_training' | string;
};

export type AdaptiveTrainingOverview = {
  subjects: AdaptiveSubjectSummary[];
  roundSize: number;
  diagnosticRoundSize: number;
  requiresLogin: boolean;
};

export type AdaptiveSession = {
  id: number;
  userId: number;
  subject: SpecialPracticeSubject;
  mode: string;
  status: string;
  questionLanguage: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdaptiveRound = {
  id: number;
  sessionId: number;
  roundIndex: number;
  status: string;
  plannerSnapshot: unknown;
  answers: Record<string, string>;
  timeSpent: Record<string, number>;
  currentQuestion: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  startedAt: string;
  submittedAt: string | null;
  version: number;
};

export type AdaptiveQuestion = SpecialPracticeQuestion & {
  topicId: number;
  topicCode: string;
  topicTitle: string;
  questionSource?: string;
  generatedQuestion?: {
    questionId: number;
    sourceQuestionId: number | null;
    blueprintId: number | null;
    sourceKind: string;
    provider: string | null;
    model: string | null;
    badgeLabel: string;
  } | null;
  position?: number;
  selectedAnswer?: string | null;
  isCorrect?: boolean | null;
  correctAnswer?: string;
  explanation?: string;
  knowledgeTags?: string[];
  usedHint?: boolean;
  usedExplanation?: boolean;
  timeSpentSeconds?: number;
};

export type AdaptiveSessionDetail = {
  session: AdaptiveSession;
  rounds: AdaptiveRound[];
};

export type AdaptiveRoundDetail = {
  session: AdaptiveSession;
  round: AdaptiveRound;
  questions: AdaptiveQuestion[];
};

export type AdaptivePracticeCheckResult = SpecialPracticeCheckResult;

export type AdaptiveRoundReport = {
  session: AdaptiveSession;
  round: AdaptiveRound;
  summary: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    total: number;
    accuracy: number;
    totalSeconds: number;
  };
  weakTopics: Array<{ topicId: number; code: string; title: string }>;
  diagnosticCoverage?: {
    subject: SpecialPracticeSubject;
    coveredCount: number;
    totalCount: number;
    coverageRate: number;
    confidenceReadyCount: number;
    lowConfidenceCount: number;
    coveredDimensions: Array<{
      topicId: number;
      code: string;
      title: string;
      attemptCount: number;
      correctCount: number;
      mastery: number;
      confidence: number;
    }>;
    insufficientDimensions: Array<{
      topicId: number;
      code: string;
      title: string;
      reason: 'not_covered' | 'low_confidence' | string;
      mastery: number;
      confidence: number;
    }>;
  } | null;
  nextRecommendation: string;
  learningDecision?: {
    schemaVersion: '1';
    policyVersion: string;
    generatedByAI: false;
    source: 'rules_and_learning_evidence';
    adaptationPending: boolean;
    status: 'needs_review' | 'needs_verification' | 'building' | 'verified_mastery';
    headline: string;
    explanation: string;
    evidenceBasis: {
      answeredCount: number;
      firstAttemptCount: number;
      independentCorrectCount: number;
      assistedCorrectCount: number;
      averageSeconds: number | null;
      stateSource: 'learning_state_v2' | 'legacy_mastery' | 'round_only' | 'mixed';
    };
    topics: Array<{
      topicId: number;
      code: string;
      title: string;
      status: 'needs_review' | 'needs_verification' | 'building' | 'verified_mastery';
      reasons: string[];
      total: number;
      correct: number;
      unanswered: number;
      independentCorrect: number;
      assistedCorrect: number;
      firstAttemptCount: number;
      averageSeconds: number | null;
      state: {
        source: 'learning_state_v2' | 'legacy_mastery' | 'round_only';
        mastery: number | null;
        confidence: number | null;
        independence: number | null;
        retention: number | null;
        fluency: number | null;
        transfer: number | null;
        consistency: number | null;
        coverage: number | null;
        evidenceCount: number;
        stateVersion: string | null;
      };
      reviewPattern: null | {
        id: number;
        patternType: string;
        status: string;
        recurrenceCount: number;
        nextReviewAt: string | null;
        consecutiveVerificationPassCount: number;
      };
    }>;
    nextStep: {
      type: 'review_mistakes' | 'targeted_practice' | 'delayed_verification' | 'continue_practice' | 'broaden_coverage';
      label: string;
      reason: string;
      subject: SpecialPracticeSubject;
      topicId: number | null;
      reviewItemId: number | null;
      patternType: string | null;
      dueAt: string | null;
      questionCount: number;
    };
  };
  remediationPlan?: {
    triggered: boolean;
    trigger: null | {
      repeatedTags: string[];
      repeatedPatterns: Array<{
        id: number;
        topicId: number | null;
        patternType: string;
        recurrenceCount: number;
        status: string;
      }>;
    };
      conceptCards: Array<{
        id: number;
        topicId: number;
        title: string;
        body: string;
        misconceptionLabel: string | null;
        completedAt?: string | null;
      }>;
    variantPractice: {
      availableCount: number;
      questionIds: number[];
      topicIds?: number[];
    };
    nextAction: string;
  };
  trend?: {
    sampleSize: number;
    recentRounds: Array<{
      roundId: number;
      roundIndex: number;
      mode: string;
      accuracy: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      total: number;
      totalSeconds: number;
      averageSeconds: number;
      averageDifficulty: number | null;
      difficultyLabel: string | null;
      submittedAt: string | null;
    }>;
    averageAccuracy: number | null;
    averageSeconds: number | null;
    previousAccuracy: number | null;
    accuracyDelta: number | null;
    direction: 'improving' | 'declining' | 'steady' | 'insufficient' | string;
    currentDifficulty: number | null;
    currentDifficultyLabel: string | null;
    previousDifficulty: number | null;
    difficultyDelta: number | null;
    difficultyDirection: 'increased' | 'decreased' | 'steady' | 'insufficient' | string;
    repeatedWeakTopics: Array<{ topicId: number; code: string; title: string; count: number }>;
  };
  items: Array<AdaptiveQuestion & {
    selectedAnswer: string | null;
    correctAnswer: string;
    isUnanswered: boolean;
    explanation: string;
    knowledgeTags: string[];
    timeSpentSeconds: number;
    mastery: number | null;
  }>;
};

export type AdaptiveMasteryTopic = {
  topicId: number;
  subject: SpecialPracticeSubject;
  code: string;
  title: string;
  module: string | null;
  mastery: number;
  confidence: number;
  attemptCount: number;
  correctCount: number;
  lastPracticedAt: string | null;
};

export type AdaptiveAIInteraction = {
  id: number;
  type: string;
  provider: string | null;
  model: string | null;
  output: string;
  structuredExplanation?: {
    whyWrong: string;
    correctApproach: string;
    quickMethod: string;
    avoidNextTime: string;
  } | null;
  createdAt: string;
};

export type AdaptiveAIEntitlement = {
  enabled: boolean;
  balanceUnits: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  initialFreeUnits: number;
  unlimited?: boolean;
  organization?: {
    id: number;
    slug: string;
    name: string;
    balanceUnits: number;
    reservedCredits: number;
    perUserDailyLimit: number | null;
    expiresAt: string | null;
    providerConfigured?: boolean;
    current?: boolean;
  } | null;
  organizationOptions?: Array<{
    id: number;
    slug: string;
    name: string;
    role: string;
    cohortId: number | null;
    cohortName: string | null;
    balanceUnits: number | null;
    reservedCredits: number | null;
    perUserDailyLimit: number | null;
    expiresAt: string | null;
    hasActivePool: boolean;
    current: boolean;
  }>;
};

export type MyAICredits = AdaptiveAIEntitlement & {
  lowBalanceThreshold: number;
  recentUsage: Array<{
    id: number;
    abilityType: string;
    label: string;
    unitsDelta: number;
    status: string;
    reason: string;
    createdAt: string;
  }>;
};

export type StudentProfile = {
  nationality: string | null;
  nationalityCode: string | null;
  country: string | null;
  countryCode: string | null;
  grade: string | null;
  gradeCode: string | null;
  genderCode: string | null;
  educationStageCode: string | null;
  graduationYear: number | null;
  targetExamDate: string | null;
  targetSubjectCodes: string[];
  preferredQuestionLanguageCode: string | null;
  examAttemptType: string | null;
  weeklyGoalDays: number | null;
  targetMajorCategoryCode: string | null;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
  currentOrganizationId: number | null;
  updatedAt: string | null;
};

export type AgentScoreGoal = {
  status: 'unset' | 'configured';
  goal: null | {
    goalId: string;
    examDate: string;
    examBatchCode: string;
    goalVersion: string;
    scoringPolicyVersion: string;
    subjects: Array<{ subject: 'math' | 'physics' | 'chemistry'; targetScore: number; priority: number }>;
  };
};

export type AgentStudyAvailability = {
  availabilityVersion: string;
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: number[];
  defaultSessionMinutes: number | null;
  source: 'user' | 'account_default' | 'unset';
  effectiveAt: string | null;
};

export type AgentLearningSettings = {
  currentScoringPolicyVersion: string;
  scoreGoal: AgentScoreGoal;
  studyAvailability: AgentStudyAvailability;
  learningPreference: {
    preferenceVersion: string;
    defaultLearningMode: 'recommended' | 'free';
    defaultFreePracticeSubject: 'math' | 'physics' | 'chemistry';
    defaultFreePracticeCount: 3 | 5 | 10;
    source: 'user' | 'default';
    updatedAt: string | null;
  };
};

export type AdaptiveAIFeedback = {
  id: number;
  interactionId: number;
  rating: number;
  reasonCode?: string | null;
  createdAt: string;
};

export type AdaptiveAIFeedbackReasonCode =
  | 'unclear'
  | 'too_verbose'
  | 'wrong_language'
  | 'missed_my_mistake'
  | 'math_or_formula_unclear'
  | 'factually_wrong'
  | 'too_generic'
  | 'not_grounded_in_round'
  | 'next_step_unclear'
  | 'other';

export type AdminSpecialPracticeTopic = SpecialPracticeTopic & {
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  questionTotal: number;
  sessionTotal: number;
  version: number;
};

export type AdminSpecialPracticeQuestion = SpecialPracticeQuestion & {
  topicId: number;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AdminSpecialPracticeTopicDetail = {
  topic: AdminSpecialPracticeTopic;
  questions: AdminSpecialPracticeQuestion[];
  issues: string[];
};

export type AdminSpecialPracticeImportPreview = {
  slug: string;
  title: string;
  subject: SpecialPracticeSubject;
  module: string;
  status: string;
  questionCount: number;
  action: 'create-draft' | 'update-draft';
  existingStatus: string | null;
  existingSessions: number;
};

export type AdminSpecialPracticeImportValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  previews: AdminSpecialPracticeImportPreview[];
};

export type AdminSpecialPracticeImportResult = {
  created: number;
  updated: number;
  questionsUpserted: number;
  previews: AdminSpecialPracticeImportPreview[];
};

export type MockExamSubjectId = 'math' | 'physics' | 'chemistry';

export type MockExamPaper = {
  id: number;
  subject: MockExamSubjectId;
  slug: string;
  title: string;
  description?: string;
  language: string;
  questionCount: number;
  durationMinutes: number;
  priceLabel?: string;
  isFree: boolean;
  isLocked: boolean;
};

export type PastPaperFile = {
  id: number;
  kind: 'paper' | 'answers' | 'solutions' | 'mark-scheme' | 'cover' | string;
  label: string;
  fileUrl: string;
  originalFilename?: string;
  mimeType: string;
  fileSizeBytes?: number;
  checksum?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PastPaper = {
  id: number;
  slug: string;
  title: string;
  category: 'past-paper' | 'mock-paper' | string;
  subject: MockExamSubjectId;
  examYear?: number;
  examMonth?: string;
  sessionLabel?: string;
  language: string;
  description?: string;
  questionCount?: number;
  pageCount?: number;
  hasAnswers: boolean;
  hasSolutions: boolean;
  coverUrl?: string;
  isFree: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  downloadCount: number;
  primaryFileUrl?: string;
  fileCount: number;
  citationIndexAvailable?: boolean;
  sourceDocumentId?: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PastPaperDetail = {
  paper: PastPaper;
  files: PastPaperFile[];
};

export type AdminPastPaper = PastPaper;

export type PastPaperSourceDocument = {
  id: number;
  subject: MockExamSubjectId;
  title: string;
  examYear?: number;
  examSession?: string;
  language: string;
  sourceLabel: string;
  questionCount: number;
  displayAllowed: boolean;
};

export type ResourceBundle = {
  id: number;
  slug: string;
  title: string;
  category: 'past-paper' | 'mock-paper' | string;
  subjectScope: MockExamSubjectId | 'mixed' | string;
  language: string;
  description?: string;
  coverUrl?: string;
  highlights: string[];
  tags: string[];
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  itemCount: number;
  fileCount: number;
  questionCount?: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ResourceBundleItem = {
  id: number;
  label: string;
  sortOrder: number;
  paper: PastPaper;
  files: PastPaperFile[];
};

export type ResourceBundleDetail = {
  bundle: ResourceBundle;
  items: ResourceBundleItem[];
};

export type AdminResourceBundle = ResourceBundle;

export type MockExamSubjectCard = {
  id: MockExamSubjectId;
  title: string;
  shortTitle: string;
  accent: string;
  description: string;
  tags: string[];
  paperCount: number;
  freeSlug: string | null;
  questionCount: number;
  durationMinutes: number;
};

export type MockExamOverview = {
  examDate: string;
  countdownLabel: string;
  subjectCards: MockExamSubjectCard[];
  stats: Array<{ value: string; label: string; detail: string }>;
  features: string[];
};

export type MockExamSubjectDetail = {
  subject: Omit<MockExamSubjectCard, 'paperCount' | 'freeSlug' | 'questionCount' | 'durationMinutes'>;
  papers: MockExamPaper[];
  pastPapers: PastPaper[];
  recommendation?: MockExamPaperRecommendation | null;
  bundle: { title: string; priceLabel: string; description: string };
};

export type MockExamPaperRecommendation = {
  mode: 'resume_attempt' | 'initial_diagnostic' | 'remediate_low_score' | 'mastery_bridge' | 'maintain_pace' | string;
  label: string;
  title: string;
  body: string;
  actionLabel: string;
  target: { type: 'attempt'; attemptId: number } | { type: 'paper'; paperSlug: string };
  paper: MockExamPaper | null;
  scoreLabel: string;
  masteryLabel: string;
};

export type MockExamStart = {
  paper: MockExamPaper;
  locked: boolean;
  rules: string[];
};

export type MockExamQuestion = {
  id: number;
  orderNumber: number;
  questionType: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
};

export type MockExamAttempt = {
  id: number;
  paper: MockExamPaper;
  language: string;
  startedAt: string;
  dueAt: string;
  submittedAt: string | null;
  answers: Record<string, string>;
  markedQuestions: number[];
  timeSpent: Record<string, number>;
  currentQuestion: number;
  version: number;
};

export type MockExamAttemptDetail = {
  attempt: MockExamAttempt;
  questions: MockExamQuestion[];
};

export type MockExamReport = {
  attempt: MockExamAttempt;
  summary: {
    score: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    total: number;
    totalSeconds: number;
    averageSeconds: number;
  };
  knowledgeStats: Array<{ tag: string; total: number; wrong: number }>;
  items: Array<MockExamQuestion & {
    selected: string;
    correctAnswer: string;
    isCorrect: boolean;
    isUnanswered: boolean;
    isMarked: boolean;
    explanation: string;
    knowledgeTags: string[];
    secondsSpent: number;
  }>;
};

export type MockExamAttemptHistory = {
  id: number;
  paper: MockExamPaper;
  score: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  unansweredCount: number | null;
  startedAt: string;
  submittedAt: string | null;
  attemptPath: string;
  reportPath: string | null;
};

export type AdminMockExamPaper = MockExamPaper & {
  description: string | null;
  priceLabel: string | null;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  questionTotal: number;
  attemptTotal: number;
  version: number;
};

export type AdminMockExamQuestion = MockExamQuestion & {
  paperId: number;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AdminMockExamBlueprintReport = {
  schemaVersion: 'mock-exam-blueprint-report-v1';
  status: 'empty' | 'needs_mapping' | 'review' | 'ready';
  generatedAt: string;
  questionCount: number;
  configuredQuestionCount: number;
  publishedQuestionCount: number;
  durationMinutes: number;
  estimatedTimeBudgetSeconds: number;
  topicCoverage: {
    mappedQuestionCount: number;
    unmappedQuestionCount: number;
    mappingCoverage: number;
    uniqueTopicCount: number;
    topTopics: Array<{ topicId: number; code: string; title: string; module: string | null; count: number }>;
  };
  distributions: {
    answers: Array<{ answer: string; count: number }>;
    statuses: Array<{ status: string; count: number }>;
    questionTypes: Array<{ questionType: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  };
  slotProfile: {
    segments: Array<{
      key: 'early' | 'middle' | 'late';
      label: string;
      questionCount: number;
      mappedQuestionCount: number;
      firstQuestionOrder: number | null;
      lastQuestionOrder: number | null;
      topTags: Array<{ tag: string; count: number }>;
      topTopics: Array<{ topicId: number; code: string; title: string; count: number }>;
    }>;
  };
  warnings: string[];
};

export type AdminMockExamBlueprint = {
  id: number;
  subject: MockExamSubjectId | string;
  title: string;
  syllabusVersion: string;
  sourceProfileIds: unknown[];
  sourcePaperId: number | null;
  questionCount: number;
  durationMinutes: number;
  totalScore: number;
  status: 'draft' | 'active' | 'archived' | string;
  profile: unknown;
  createdBy: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminMockExamBlueprintSlot = {
  id: number;
  blueprintId: number;
  slotNumber: number;
  topicIds: unknown[];
  module: string | null;
  difficultyBand: string;
  cognitiveSkill: string;
  readingLoad: string;
  calculationLoad: string;
  estimatedTimeSeconds: number;
  generationPromptHints: unknown[];
  reviewerChecklist: unknown[];
  status: 'draft' | 'ready' | 'blocked' | string;
  createdAt: string;
  updatedAt: string;
};

export type AdminMockExamGenerationJob = {
  id: number;
  blueprintId: number;
  targetPaperId: number | null;
  status: 'queued' | 'running' | 'needs_review' | 'needs_attention' | 'assembly_blocked' | 'completed' | 'failed' | string;
  provider: string | null;
  model: string | null;
  requestedSlotNumbers: unknown[];
  slotResults: Array<{
    slotId?: number;
    slotNumber?: number;
    aiBlueprintId?: number | null;
    aiGenerationJobId?: number | null;
    candidateQuestionId?: number | null;
    assembledQuestionId?: number | null;
    assembledOrderNumber?: number | null;
    status?: string;
    issues?: unknown[];
    topicIds?: unknown[];
    targetProfile?: unknown;
    candidateAttemptCount?: number;
    providerWaitCount?: number;
    waitReason?: string | null;
    nextAction?: string | null;
    diagnostics?: Record<string, unknown>;
  }>;
  diagnostics?: {
    requiredCount: number;
    approvedCount: number;
    waitReasons: Record<string, number>;
    primaryWaitReason: string | null;
    nextActions: string[];
    providerWaitCount: number;
    candidateAttemptCount: number;
  };
  error: string | null;
  createdBy: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMockExamBlueprintDetail = {
  blueprint: AdminMockExamBlueprint;
  slots: AdminMockExamBlueprintSlot[];
  generationJobs?: AdminMockExamGenerationJob[];
};

export type AdminMockExamPaperDetail = {
  paper: AdminMockExamPaper;
  questions: AdminMockExamQuestion[];
  issues: string[];
  blueprintReport?: AdminMockExamBlueprintReport;
  blueprints?: AdminMockExamBlueprint[];
};

export type AdminMockExamImportPreview = {
  slug: string;
  title: string;
  subject: MockExamSubjectId;
  status: string;
  questionCount: number;
  action: 'create-draft' | 'update-draft';
  existingStatus: string | null;
  existingAttempts: number;
};

export type AdminMockExamImportValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  previews: AdminMockExamImportPreview[];
};

export type AdminMockExamImportResult = {
  created: number;
  updated: number;
  questionsUpserted: number;
  previews: AdminMockExamImportPreview[];
};

export type AdminSchoolSummary = {
  id: number;
  version: number;
  nameZh: string;
  nameEn?: string;
  region?: string;
  cscaRequired: boolean;
  verificationStatus: 'verified' | 'pending' | 'sample';
  status: 'draft' | 'published' | 'archived';
  tuitionSummary?: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  completenessLabel?: string;
  missingFields?: string[];
};

export type AdminSchoolDetail = AdminSchoolSummary & {
  rank?: number;
  schoolType: string;
  cscaRequirement?: string;
  languageRequirement?: string;
  applicationFee?: string;
  officialWebsiteUrl?: string;
  admissionsWebsiteUrl?: string;
  source?: string;
  sourceId?: string;
  derivedTags?: string[];
  languageOfInstruction?: string[];
  scholarships?: string[];
  englishPrograms?: string;
  programFields?: string[];
  cscaRequirementNote?: string;
  programs?: SchoolProgram[];
  cscaRules?: SchoolCscaRule[];
  scholarshipsDetailed?: SchoolScholarship[];
};

export type SavedSchool = School & {
  savedAt: string;
};

export type CompareSchool = School & {
  comparedAt: string;
};

export type CompareDetailsResult = {
  items: CompareSchool[];
};

export type CommerceItemType = 'SCHOOL_SERVICE' | 'ADVISOR_PACKAGE' | 'AI_CREDITS';

export type PricingLine = {
  type: CommerceItemType;
  title: string;
  quantity: number;
  unitAmountCents: number;
  originalAmountCents: number;
  discountAmountCents: number;
  payableAmountCents: number;
  schoolId?: number;
  aiCreditUnits?: number;
};

export type PricingSummary = {
  currency: string;
  itemsTotalCents: number;
  discountTotalCents: number;
  payableTotalCents: number;
  pricingBreakdown: PricingLine[];
};

export type CartItem = {
  id: number;
  type: CommerceItemType;
  schoolId?: number;
  schoolName?: string;
  title: string;
  quantity: number;
  createdAt: string;
};

export type CartResult = {
  items: CartItem[];
  pricing: PricingSummary;
};

export type CommerceOrder = PricingSummary & {
  id: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  payment: null | {
    id: number;
    providerTxnId: string;
    amountCents: number;
    currency: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    createdAt: string;
  };
  items: Array<PricingLine & { id: number }>;
};

export type PaymentCreateResult = {
  provider?: 'mock' | 'gumroad' | 'free';
  paymentId: number;
  orderId: number;
  providerTxnId: string;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  checkoutUrl?: string;
  callbackSignaturePayload?: string;
  testCallbackSignature?: string;
};

export type AuditItem = {
  id: string;
  title: string;
  status: string;
  detail: string;
};

export type AdminAuditSummary = {
  schoolsTotal: number;
  schoolsVerified: number;
  schoolsPending: number;
  adminAuditEventCount: number;
  latestAdminAuditEventAt: string | null;
  schoolChangeCount: number;
  latestSchoolChangeAt: string | null;
  mockExamAttemptCount: number;
  specialPracticeSessionCount: number;
};

export type AdminAuditEvent = {
  id: number;
  actorId?: number;
  actorEmail?: string;
  organizationId?: number;
  organizationName?: string;
  organizationSlug?: string;
  relatedUserId?: number;
  relatedUserEmail?: string;
  targetEmail?: string;
  module: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
};

export type AdminReadinessEvidenceFile = {
  name: string;
  kind: string;
  phase: string | null;
  source: string | null;
  status: string | null;
  generatedAt: string | null;
  sizeBytes: number;
  modifiedAt: string;
};

export type AdminReadinessEvidenceDetail = {
  file: AdminReadinessEvidenceFile;
  content: Record<string, unknown>;
};

export type AdminAIMetricBucket = {
  key: string;
  interactions: number;
  fallbackInteractions: number;
  externalInteractions: number;
  successfulInteractions: number;
  rejectedInteractions: number;
  errorInteractions: number;
  billableInteractions: number;
  estimatedTokens: number;
  estimatedCost: number;
  feedbackCount: number;
  lowFeedbackCount: number;
  averageRating: number | null;
};

export type AdminAIRolloutHealth = {
  status: 'insufficient_data' | 'healthy' | 'watch' | 'pause_rollout';
  recommendation: string;
  sampleSize: number;
  feedbackSampleSize: number;
  lowFeedbackRate: number;
  thresholds: {
    minInteractions: number;
    minFeedback: number;
    maxErrorRate: number;
    maxRejectionRate: number;
    maxLowFeedbackRate: number;
    minAverageRating: number;
  };
  checks: Array<{
    key: string;
    label: string;
    value: number | null;
    threshold: number;
    status: 'pass' | 'warn' | 'fail';
  }>;
};

export type AdminAIObservability = {
  range: {
    from: string;
    to: string;
  };
  filters: {
    provider: string | null;
    status: string | null;
    type: string | null;
    subject: string | null;
  };
  summary: AdminAIMetricBucket & {
    fallbackRate: number;
    rejectionRate: number;
    errorRate: number;
    feedbackRate: number;
  };
  rolloutHealth: AdminAIRolloutHealth;
  byDay: AdminAIMetricBucket[];
  byProvider: AdminAIMetricBucket[];
  byType: AdminAIMetricBucket[];
  byStatus: AdminAIMetricBucket[];
  reasonBreakdown: Array<{
    reasonCode: string;
    count: number;
    lowFeedbackCount: number;
  }>;
  recentFailures: Array<{
    id: number;
    createdAt: string;
    type: string;
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
    status: string;
    subject: string | null;
    feedbackCount: number;
  }>;
};

export type AdminAIReviewQueue = {
  range: {
    from: string;
    to: string;
  };
  filters: {
    provider: string | null;
    status: string | null;
    type: string | null;
    subject: string | null;
    reason: string | null;
  };
  summary: {
    candidates: number;
    lowFeedback: number;
    providerRejected: number;
    providerErrors: number;
    quotaExhausted: number;
  };
  byReason: Array<{ key: string; count: number }>;
  items: Array<{
    id: number;
    createdAt: string;
    userId: number | null;
    subject: string | null;
    topicId: number | null;
    sessionId: number | null;
    roundId: number | null;
    questionId: number | null;
    type: string;
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
    status: string;
    reasons: string[];
    suggestedAction: string;
    averageRating: number | null;
    feedbackCount: number;
    latestFeedbackReason: string | null;
    latestFeedbackReasonCode: string | null;
    outputPreview: string;
    tokenUsage: unknown;
    costEstimate: number | null;
    latestDecision: AdminAIReviewDecision | null;
  }>;
};

export type AdminAIReviewDecision = {
  id: number;
  interactionId: number;
  actorId: number | null;
  decision: string;
  status: string;
  note: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIProviderConfig = {
  provider: {
    mode: 'external' | 'rule-fallback';
    externalReady: boolean;
    externalToggleEnabled: boolean;
    provider: string;
    supported: boolean;
    model: string;
    promptVersion: string;
    requestedPromptVersion: string;
    activePromptVersion: string;
    promptVersionSupported: boolean;
    supportedPromptVersions: string[];
    promptTemplateCheck: {
      version: string;
      valid: boolean;
      issues: string[];
    };
    apiKeyConfigured: boolean;
    baseUrlHost: string;
    timeoutMs: number;
    temperature: number;
    maxOutputChars: number;
    rollout: {
      percent: number;
      strategy: string;
    };
    fallbackModel: string;
    fallbackPromptVersion: string;
    blockers: string[];
  };
  usageMeter: {
    pricingConfigured: boolean;
    currency: string;
    inputCostPer1KTokens: number;
    outputCostPer1KTokens: number;
    unitTokenBudget: number;
    meteringMode: string;
  };
};

export type AdminAIGatewayCostMetadata = {
  costCurrency: string;
  displayCurrency: string;
  usdToDisplayRate: number;
  pricing: {
    deepseekChat: {
      inputPer1MTokens: number;
      outputPer1MTokens: number;
    };
    deepseekReasoner: {
      inputPer1MTokens: number;
      outputPer1MTokens: number;
    };
  };
};

export type AdminAIGatewaySummary = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  summary: AdminAIGatewayCostMetadata & {
    calls: number;
    successCalls: number;
    failedCalls: number;
    successRate: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
    estimatedCostDisplay: number;
  };
};

export type AdminAIGatewayGroupedResult<T> = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  items: T[];
  cost: AdminAIGatewayCostMetadata;
};

export type AdminAIGatewayTaskMetric = {
  taskType: string | null;
  sourceModule: string | null;
  providerId: string | null;
  model: string | null;
  calls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  totalTokens: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  estimatedCostDisplay: number;
};

export type AdminAIGatewayKeyMetric = {
  providerId: string | null;
  keyId: string | null;
  calls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  totalTokens: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  estimatedCostDisplay: number;
  latestErrorCode: string | null;
  latestErrorAt: string | null;
};

export type AdminAIGatewayErrorList = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  items: Array<{
    id: number;
    requestId: string | null;
    taskType: string | null;
    sourceModule: string | null;
    providerId: string | null;
    model: string | null;
    keyId: string | null;
    status: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    latencyMs: number;
    createdAt: string | null;
  }>;
};

export type AdminAIGatewayHealth = {
  status: string;
  providers: Array<{
    providerId: string;
    status: string;
    keys: Array<{
      keyId: string;
      providerId: string;
      enabled: boolean;
      currentConcurrency: number;
      requestsInCurrentMinute: number;
      requestsInCurrentDay: number;
      failuresInWindow: number;
      timeoutCountInWindow: number;
      rateLimitCountInWindow: number;
      averageLatencyMs: number;
      lastSuccessAt?: string;
      lastFailureAt?: string;
      cooldownUntil?: string;
      cooldownReason?: string;
    }>;
  }>;
  queues: unknown;
};

export type AdminTrainingEventObservability = {
  range: {
    from: string;
    to: string;
  };
  filters: {
    eventType: string | null;
    subject: string | null;
  };
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    diagnosticStarted: number;
    diagnosticCompleted: number;
    diagnosticCompletionRate: number;
    practiceStarted: number;
    practiceCompleted: number;
    practiceCompletionRate: number;
    aiEvents: number;
  };
  byDay: Array<{ key: string; count: number }>;
  byEventType: Array<{ key: string; count: number }>;
  bySubject: Array<{ key: string; count: number }>;
  readinessActions: {
    clickedCount: number;
    followedCount: number;
    followThroughRate: number;
    averageExpectedGain: number | null;
    status: 'no_data' | 'watching' | 'positive' | 'needs_calibration';
    byActionType: Array<{
      key: string;
      clickedCount: number;
      followedCount: number;
      followThroughRate: number;
      averageExpectedGain: number | null;
      status: 'no_data' | 'watching' | 'positive' | 'needs_calibration';
    }>;
    recentClicks: Array<{
      createdAt: string;
      userId: number | null;
      actionType: string;
      expectedGain: number | null;
      score: number | null;
      followed: boolean;
    }>;
  };
  readinessEvidence: {
    sampleSize: number;
    averageScore: number | null;
    lowCount: number;
    lowRate: number;
    status: 'no_data' | 'watching' | 'healthy' | 'needs_attention';
    byStatus: Array<{ key: string; count: number }>;
    topGaps: Array<{ key: string; count: number }>;
    recent: Array<{
      createdAt: string;
      userId: number | null;
      score: number;
      maxScore: number;
      status: string;
      weakDimensions: string[];
    }>;
  };
  readinessDifficultyThresholds: {
    mode: 'static' | 'sampled';
    minSampleSize: number;
    bySubject: Array<{
      subject: 'math' | 'physics' | 'chemistry';
      sampleSize: number;
      averageCount: number | null;
      p50Count: number | null;
      p60Count: number | null;
      p80Count: number | null;
      defaultRequiredCount: number;
      recommendedCount: number;
      requiredCount: number;
      source: 'default' | 'env_override' | 'sampled_distribution';
      canUseSampled: boolean;
      readyAtDefault: number;
      readyAtSampled: number;
      impactedUserSubjectCount: number;
    }>;
  };
  readinessCalibrationHealth: {
    status: 'healthy' | 'watching' | 'needs_attention' | 'blocked';
    snapshotCount: number;
    latestSnapshotDate: string | null;
    staleDays: number | null;
    alerts: Array<{
      code: 'calibration_snapshot_missing' | 'calibration_snapshot_stale' | 'calibration_snapshot_empty' | 'action_type_needs_calibration' | 'sampled_distribution_insufficient' | string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      actionType?: string;
      subject?: 'math' | 'physics' | 'chemistry';
      sampleSize?: number;
      minSampleSize?: number;
    }>;
  };
  readinessSampledThresholdRollout: {
    status: 'ready' | 'watching' | 'blocked';
    checklist: Array<{
      key: 'sample_size' | 'calibration_health' | 'impact_limit' | 'sampled_mode' | string;
      status: 'passed' | 'pending' | 'blocked';
      detail: string;
    }>;
    metrics: {
      mode: 'static' | 'sampled';
      sampledReadySubjects: number;
      totalSubjects: number;
      insufficientSubjects: Array<'math' | 'physics' | 'chemistry'>;
      impactedUserSubjectCount: number;
      maxImpactUserSubjectCount: number;
      maxRecommendedCount: number;
      minSampleSize: number;
      blockingCalibrationAlertCount: number;
    };
  };
  plannerAssistant: {
    total: number;
    accepted: number;
    adjustedByGuard: number;
    acceptanceRate: number;
    byStatus: Array<{ key: string; count: number }>;
    rejectedReasons: Array<{ key: string; count: number }>;
    recent: Array<{
      createdAt: string;
      userId: number | null;
      subject: string | null;
      roundId: number | null;
      status: string;
      providerStatus: string;
      rejectedReasons: string[];
      differenceCount: number;
    }>;
  };
  conceptCardEffect: {
    summary: {
      completedCards: number;
      cardsWithVariantAttempts: number;
      variantAttemptCount: number;
      variantCorrectCount: number;
      variantAccuracy: number | null;
    };
    recent: Array<{
      conceptCardId: number | null;
      sourceQuestionId: number | null;
      userId: number | null;
      subject: string | null;
      topicId: number | null;
      title: string;
      misconceptionLabel: string;
      completedAt: string;
      variantAttemptCount: number;
      variantCorrectCount: number;
      variantAccuracy: number | null;
      latestVariantAt: string | null;
    }>;
  };
  variantEffect: {
    summary: {
      variantQuestionCount: number;
      sourceQuestionCount: number;
      variantAttemptCount: number;
      variantCorrectCount: number;
      variantAccuracy: number | null;
      misconceptionTrackedCount: number;
      weakVariantCount: number;
    };
    recent: Array<{
      variantQuestionId: number;
      sourceQuestionId: number;
      subject: string | null;
      topicId: number | null;
      status: string;
      misconceptionLabel: string;
      misconceptionId: number | null;
      conceptCardId: number | null;
      attemptCount: number;
      correctCount: number;
      accuracy: number | null;
      uniqueUsers: number;
      latestAttemptAt: string;
      health: 'no_data' | 'watching' | 'improving' | 'mixed' | 'needs_review' | string;
    }>;
  };
  recentEvents: Array<{
    id: number;
    createdAt: string;
    userId: number | null;
    subject: string | null;
    sessionId: number | null;
    roundId: number | null;
    questionId: number | null;
    eventType: string;
    source: string;
    metadata: unknown;
  }>;
};

export type AdminReadinessActionCalibrationRefreshResult = {
  snapshotDate: string;
  windowDays: number;
  actionTypes: number;
  clickedCount: number;
  followedCount: number;
  abilityLiftCount: number;
  source: 'admin_manual' | 'scheduled';
  items: Array<{
    actionType: string;
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

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  aiBalanceUnits?: number;
  aiLifetimeGranted?: number;
  aiLifetimeUsed?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminAIEntitlementGrant = {
  userId: number;
  email: string;
  balanceUnits: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  grantedUnits: number;
  ledgerId: number;
  reason: string | null;
  source: string;
};

export type AdminAIOrganization = {
  id: number;
  slug: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  aiCreditPool: null | {
    id: number;
    availableCredits: number;
    reservedCredits: number;
    expiresAt: string | null;
    perUserDailyLimit: number | null;
    status: string;
    updatedAt: string;
  };
  members: Array<{
    id: number;
    userId: number;
    cohortId?: number | null;
    cohortName?: string | null;
    role: string;
    status: string;
    email: string | null;
  }>;
  cohorts: Array<{
    id: number;
    slug: string;
    name: string;
    status: string;
    memberCount: number;
    pendingSeatCount?: number;
    seatLimit?: number | null;
    remainingSeats?: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  invites: Array<{
    id: number;
    email: string | null;
    role: string;
    status: string;
    cohortId: number | null;
    maxUses: number;
    usedCount: number;
    expiresAt: string | null;
    createdBy?: number | null;
    createdByEmail?: string | null;
    acceptedBy?: number | null;
    acceptedByEmail?: string | null;
    acceptedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  inviteAttempts: Array<{
    id: number;
    userId: number | null;
    userEmail: string | null;
    inviteId: number | null;
    inviteEmail: string | null;
    inviteRole: string | null;
    cohortId: number | null;
    cohortName: string | null;
    lookupMode: string;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
  llmProviderConfigs: Array<{
    id: number;
    provider: string;
    model: string;
    baseUrl: string | null;
    status: string;
    usagePolicy: unknown;
    apiKeyConfigured: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type AdminAIOrganizationInviteCreateResult = {
  organization: AdminAIOrganization;
  invite: {
    id: number;
    email: string | null;
    role: string;
    cohortId: number | null;
    maxUses: number;
    expiresAt: string | null;
    token: string;
    shortCode: string | null;
    acceptPath: string;
  };
};

export type AdminAIOrganizationAdminAssignmentResult = {
  organization: AdminAIOrganization;
  assignment: {
    email: string;
    status: 'assigned' | 'promoted' | 'invited' | string;
    userId: number | null;
    inviteId: number | null;
    acceptPath: string | null;
  };
};

export type AdminAIOrganizationInviteBulkReissueResult = {
  organization: AdminAIOrganization;
  invites: Array<{
    sourceInviteId: number;
    id: number;
    email: string | null;
    token: string;
    shortCode: string | null;
    acceptPath: string;
  }>;
};

export type AdminAIOrganizationInviteHistory = {
  items: Array<{
    id: number;
    email: string | null;
    role: string;
    status: string;
    effectiveStatus: string;
    cohortId: number | null;
    cohortName: string | null;
    cohortSlug: string | null;
    maxUses: number;
    usedCount: number;
    expiresAt: string | null;
    createdBy: number | null;
    createdByEmail: string | null;
    acceptedBy: number | null;
    acceptedByEmail: string | null;
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    canRevealToken: false;
  }>;
  limit: number;
};

export type AdminAIOrganizationMemberImportRow = {
  rowNumber: number;
  userId: number | null;
  email: string | null;
  role: string;
  cohortSlug: string | null;
  cohortName: string | null;
  cohortId: number | null;
  action: 'skip' | 'upsert_member' | 'create_invite';
  existingMember: boolean;
  userFound: boolean;
  errors: string[];
};

export type AdminAIOrganizationMemberImportPreview = {
  rows: AdminAIOrganizationMemberImportRow[];
  summary: {
    total: number;
    readyMembers: number;
    readyInvites: number;
    skipped: number;
    errors: number;
  };
};

export type AdminAIOrganizationMemberImportApplyResult = {
  organization: AdminAIOrganization;
  summary: {
    total: number;
    upsertedMembers: number;
    createdInvites: number;
  };
  invites: Array<{
    rowNumber: number;
    email: string | null;
    token: string;
    shortCode: string | null;
  }>;
};

export type OrganizationInviteAcceptResult = {
  accepted: true;
  organization: {
    id: number;
    slug: string;
    name: string;
  };
  membership: {
    role: string;
    status: string;
    cohortId: number | null;
    cohortName: string | null;
  };
  invite: {
    id: number;
    status: string;
    usedCount: number;
    maxUses: number;
  };
};

export type SchoolChangeLog = {
  id: number;
  action: string;
  actorId?: number;
  actorEmail?: string;
  createdAt: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes: string[];
};
