import {
  API_BASE,
  ApiError,
  readStoredToken,
  refreshStoredAccessToken,
  requestJson
} from './request';

export type AgentMessageContent = {
  schemaVersion: '1';
  text: string;
  locale?: 'zh-CN' | 'en';
  surface?: 'learning_workspace' | 'subject_qa';
  subjectQa?: { decision: 'answer' | 'out_of_scope' | 'unavailable'; subject: 'math' | 'physics' | 'chemistry' | null; generatedByAI: boolean; masteryChanged: false };
  artifactIds?: string[];
  pageContext?: unknown;
  attachmentIds?: string[];
  attachmentAnalysisId?: string;
  assessment?: string;
  errors?: Array<{ title: string; explanation: string }>;
  guidance?: string[];
  citations?: Array<{ attachmentId: string; attachmentName: string; pageNumber: number; quote?: string | null }>;
  uncertainty?: string;
  attachmentAnalysisItems?: AgentAttachmentAnalysisItem[];
  evidenceCandidates?: AgentAttachmentEvidenceCandidate[];
  evidenceCandidate?: AgentAttachmentEvidenceCandidate;
  evidenceCandidateId?: string;
  evidenceCandidateAction?: string;
  decisionChanged?: boolean;
  pastPaperResources?: AgentPastPaperResource[];
  pastPaperQuestion?: AgentPastPaperQuestion & { paper: { slug: string; title: string; subject: string } };
  pastPaperCitations?: AgentPastPaperCitation[];
};

export type AgentPastPaperResource = {
  id: number;
  slug: string;
  title: string;
  subject: 'math' | 'physics' | 'chemistry' | string;
  examYear?: number;
  examMonth?: string;
  language: string;
  questionCount?: number;
  pageCount?: number;
  hasAnswers: boolean;
  hasSolutions: boolean;
  isFree: boolean;
  fileCount: number;
};

export type AgentPastPaperQuestionSummary = {
  id: number;
  questionNumber: string;
  pageNumber: number | null;
  promptPreview: string | null;
  canAnswer: boolean;
};

export type AgentPastPaperQuestion = {
  id: number;
  questionNumber: string;
  pageNumber: number | null;
  prompt: string;
  options: Array<{ key: string; text: string }>;
  correctAnswer: string | null;
  explanation: string | null;
  topicCodes: string[];
};

export type AgentPastPaperCitation = {
  paperSlug: string;
  paperTitle: string;
  sourceLabel: string;
  sourceQuestionId: number;
  questionNumber: string;
  pageNumber: number | null;
};

export type AgentPastPaperQuestionIndex = {
  schemaVersion: '1';
  status: 'ready' | 'unavailable';
  reasonCode: string | null;
  paper: { slug: string; title: string; subject: string };
  source: { label: string; questionCount: number } | null;
  questions: AgentPastPaperQuestionSummary[];
};

export type AgentPastPaperAssistanceAction = 'clarify_question' | 'recall_concept' | 'next_step_hint' | 'check_step' | 'show_full_solution';
export type AgentPastPaperAssistanceLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A6';
export type AgentPastPaperAssistanceAvailability = {
  schemaVersion: '1';
  policyVersion: string;
  questionId: number;
  recommendedAction: AgentPastPaperAssistanceAction;
  maxAllowedLevel: 'A3' | 'A6';
  availableActions: Array<{
    action: AgentPastPaperAssistanceAction;
    level: AgentPastPaperAssistanceLevel;
    enabled: boolean;
    reasonCode: string | null;
    generatedByAI: boolean;
    confirmationRequired: boolean;
  }>;
  history: Array<{
    toolCallId: string;
    action: AgentPastPaperAssistanceAction;
    level: AgentPastPaperAssistanceLevel;
    content: string;
    generatedByAI: boolean;
    createdAt: string;
  }>;
};

export type AgentPastPaperAssistanceResult = AgentPastPaperAssistanceAvailability & {
  requestId: string;
  toolCallId: string;
  action: AgentPastPaperAssistanceAction;
  level: AgentPastPaperAssistanceLevel;
  content: string;
  generatedByAI: boolean;
  citation: AgentPastPaperCitation;
  exposure: { action: AgentPastPaperAssistanceAction; level: AgentPastPaperAssistanceLevel; recordedAt: string; masteryChanged: false };
};

export type AgentPastPaperAttemptResult = {
  schemaVersion: '1';
  policyVersion: string;
  attempt: {
    id: string;
    status: 'in_progress' | 'submitting' | 'submitted';
    selectedAnswer: string | null;
    outcome: 'correct' | 'incorrect' | null;
    startedAt: string;
    submittedAt: string | null;
    timeSpentSeconds: number | null;
    usedAssistance: boolean;
    maxAssistanceLevel: AgentPastPaperAssistanceLevel | null;
    evidenceStatus: 'pending' | 'recorded' | 'not_eligible';
    evidenceReasonCode: string | null;
    adaptationPending: boolean;
  };
  question: Pick<AgentPastPaperQuestion, 'id' | 'questionNumber' | 'pageNumber' | 'prompt' | 'options'>;
  citation: AgentPastPaperCitation;
};

export type AgentPastPaperProgress = {
  schemaVersion: '1';
  policyVersion: string;
  paper: { id: number; slug: string; title: string; subject: string };
  status: 'not_started' | 'in_progress' | 'completed';
  totalQuestions: number;
  answerableQuestions: number;
  startedCount: number;
  submittedCount: number;
  correctCount: number;
  incorrectCount: number;
  assistedCount: number;
  evidenceCount: number;
  timeSpentSeconds: number;
  completionRate: number;
  nextQuestionId: number | null;
  items: Array<{
    questionId: number;
    questionNumber: string;
    canAnswer: boolean;
    attemptId: string | null;
    status: 'not_started' | 'in_progress' | 'submitting' | 'submitted';
    outcome: 'correct' | 'incorrect' | null;
    usedAssistance: boolean;
    evidenceStatus: 'pending' | 'recorded' | 'not_eligible' | null;
  }>;
};

export type AgentPastPaperReview = {
  schemaVersion: '1';
  policyVersion: string;
  paper: { id: number; slug: string; title: string; subject: string };
  summary: {
    submittedCount: number;
    correctCount: number;
    incorrectCount: number;
    accuracy: number;
    assistedCount: number;
    independentCount: number;
    evidenceCount: number;
    timeSpentSeconds: number;
  };
  focusTopics: Array<{ topicId: number; code: string; title: string; attemptedCount: number; incorrectCount: number; assistedCount: number }>;
  decision: {
    status: 'ready' | 'disabled' | 'goal_unset' | 'updating';
    prescriptionId: string | null;
    reasonSummary: string | null;
    confidence: 'low' | 'medium' | 'high' | null;
    estimatedMinutes: number | null;
    primaryTask: null | {
      type: 'diagnostic' | 'review' | 'targeted_practice' | 'mock_exam' | 'concept_learning' | 'intervention_verification';
      subject: 'math' | 'physics' | 'chemistry';
      topicIds: number[];
      difficulty?: string;
      questionCount?: number;
      priority: number;
    };
  };
  provenance: { resultSource: 'agent_past_paper_attempts'; nextTaskSource: 'learning_prescription' | null; automaticQuestionGenerationInvoked: false };
};

export type AgentInterventionDelivery = {
  schemaVersion: '1';
  id: string;
  interventionId: string;
  status: 'offered' | 'in_progress' | 'deferred' | 'completed' | 'skipped' | string;
  placement: 'after_round' | 'between_sets';
  subjectCode: 'math' | 'physics' | 'chemistry';
  topicId: number;
  action: string;
  urgency: string;
  reasonSummary: string;
  triggerCodes: string[];
  content: {
    sourceType: 'teaching_asset' | 'concept_card' | 'standard_explanation';
    sourceId: string;
    sourceVersion: string;
    title: string;
    body: string;
    example: unknown;
    topicTitle: string;
    teachingAsset: AgentTeachingAsset | null;
  };
  offeredAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  deferredUntil: string | null;
  skippedAt: string | null;
  masteryChanged: false;
};

export type AgentInterventionVerification = {
  schemaVersion: '2';
  id: string;
  deliveryId: string;
  status: 'recommended' | 'started' | 'completed' | string;
  phase: 'immediate' | 'retention' | 'transfer';
  dueAt: string;
  subjectCode: 'math' | 'physics' | 'chemistry';
  topicId: number;
  topicTitle: string;
  questionCount: number;
  selectionVersion: string;
  measurementVersion: string;
  reasonSummary: string;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
  route: string | null;
  outcome: null | { result: 'passed' | 'failed' | 'inconclusive'; correctCount: number; totalCount: number; accuracy: number; independent: boolean };
  stability: null | { status: 'pending' | 'completed'; result: 'stable' | 'not_stable' | 'inconclusive' | null; policyVersion: string };
};

export type LearningAssistanceAction = 'recall_concept' | 'next_step_hint' | 'show_full_solution';

export type LearningAssistanceAvailability = {
  schemaVersion: '1';
  roundId: number;
  questionId: number;
  policyVersion: string;
  contextVersion: string;
  recommendedAction: LearningAssistanceAction | null;
  maxAllowedLevel: 'A1' | 'A2' | 'A6';
  exposures: { usedHint: boolean; usedExplanation: boolean };
  billing?: null | { enabled: boolean; unlimited: boolean; balanceUnits: number; aiActionMayConsumeCredits: boolean };
  history?: Array<{
    toolCallId: string;
    action: LearningAssistanceAction;
    level: 'A1' | 'A2' | 'A6';
    content: string;
    generatedByAI: boolean;
    createdAt: string;
  }>;
  availableActions: Array<{
    action: LearningAssistanceAction;
    level: 'A1' | 'A2' | 'A6';
    enabled: boolean;
    reasonCode: string | null;
    generatedByAI: boolean;
    confirmationRequired: boolean;
  }>;
};

export type LearningAssistanceResult = LearningAssistanceAvailability & {
  requestId: string;
  toolCallId: string;
  action: LearningAssistanceAction;
  level: 'A1' | 'A2' | 'A6';
  content: string;
  generatedByAI: boolean;
  interaction: null | { id: number; type: string; provider: string; model: string; output: string; createdAt: string };
  exposure: { action: LearningAssistanceAction; level: 'A1' | 'A2' | 'A6'; recordedAt: string };
};

export type AgentTeachingAsset = {
  id: string;
  stableKey: string;
  type: string;
  subjectCode: 'math' | 'physics' | 'chemistry';
  versionId: string;
  version: number;
  language: string;
  difficultyBand: string;
  estimatedMinutes: number;
  renderer: 'interactive_component';
  payloadSchemaVersion: string;
  resolverVersion: string;
  selectionDecision?: {
    policyVersion: string;
    selectedVersionId: string;
    selectedScore: number;
    reasonCodes: string[];
    candidateCount: number;
    eligibleCandidateCount: number;
    boundedExploration: boolean;
    candidates: Array<{ stableKey: string; versionId: string; score: number; eligible: boolean; reasonCodes: string[] }>;
  };
  capability?: { kind: 'interactive_simulation' | 'animation' | 'video' | string; renderer: string; surface: 'assistant'; preservesPrimaryTask: true; completionChangesMastery: false };
  topicTitle: string;
  title: string;
  summary: string;
  instructions: string[];
  component:
    | { key: 'math.function-horizontal-shift'; version: '1'; props: { baseExpression: 'x^2'; shiftMin: number; shiftMax: number; initialShift: number } }
    | { key: 'physics.newton-second-law'; version: '1'; props: { forceMin: number; forceMax: number; initialForce: number; massMin: number; massMax: number; initialMass: number } }
    | { key: 'chemistry.acid-base-neutralization'; version: '1'; props: { acidMin: number; acidMax: number; initialAcid: number; baseMin: number; baseMax: number; initialBase: number } }
    | { key: `visualizer.${'math' | 'physics' | 'chemistry'}.${string}`; version: '1'; props: Record<string, never> };
  activePrompt: { id: string; prompt: string; options: Array<{ id: string; label: string }> };
  verificationPolicy: { required: true; mode: 'next_fresh_question'; completionIsMasteryEvidence: false };
  fallback: Record<string, unknown>;
  sourceRefs: Array<{ type: string; id: string; version: string }>;
  reviewState: string;
  publishedAt: string | null;
};

export type AgentTeachingInteractionResult = {
  schemaVersion: '1';
  eventId: string;
  status: 'recorded' | 'completed';
  action: 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed' | 'skipped';
  correct: boolean | null;
  feedback: string | null;
  masteryChanged: false;
  verificationRequired: boolean;
};

export type AgentAttachmentAnalysisItem = {
  ordinal: number;
  subject: string;
  questionNumber?: string;
  questionText: string;
  studentAnswer?: string;
  assessment: string;
  pageNumber: number | null;
  region: { pageNumber: number; x: number; y: number; width: number; height: number; coordinateSpace: 'normalized' } | null;
};

export type AgentAttachmentEvidenceCandidate = {
  id: string;
  analysisId: string;
  analysisItemId: string | null;
  attachmentId: string;
  conversationId: string;
  status: 'pending_confirmation' | 'confirmed' | 'rejected' | 'revoked' | 'blocked' | string;
  subjectCode: 'math' | 'physics' | 'chemistry' | null;
  suggestedTopicId: number | null;
  confirmedTopicId: number | null;
  outcome: 'correct' | 'incorrect' | 'partial' | null;
  confidence: number;
  gateReasons: string[];
  sourceSnapshot: {
    availableTopics?: Array<{ id: number; code: string; title: string; module?: string | null }>;
    attachment?: { id: string; name: string; sha256?: string | null; pageCount?: number | null };
    analysis?: {
      itemId?: string | null; ordinal?: number | null; questionNumber?: string | null;
      questionText?: string | null; studentAnswer?: string | null; pageNumber?: number | null;
      region?: { pageNumber: number; x: number; y: number; width: number; height: number; coordinateSpace: 'normalized' } | null;
      [key: string]: unknown;
    };
    trustedMatch?: {
      status: string;
      sourceType: string | null;
      sourceId: string | null;
      sourceVersion: number | null;
      sourceTitle: string | null;
      topicId: number | null;
      promptScore: number;
      runnerUpScore: number;
      verifiedOutcome: string | null;
      matcherVersion: string;
    };
  };
  evidenceId: string | null;
  decisionChanged?: boolean;
};

export type AgentAttachment = {
  id: string;
  conversationId: string;
  status: 'created' | 'uploading' | 'uploaded' | 'extracting' | 'ready' | 'failed' | 'rejected' | 'deleted' | string;
  kind: 'document' | 'image' | string;
  name: string;
  declaredMime: string | null;
  detectedMime: string | null;
  sizeBytes: number | null;
  pageCount: number | null;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  previewUrl: string | null;
  sent?: boolean;
};

export type AgentAttachmentLimits = {
  maxFileBytes: number;
  maxFilesPerMessage: number;
  maxMessageBytes: number;
  maxDocumentPages: number;
  acceptedMimeTypes: string[];
};

export type AgentAttachmentAnalysis = {
  id: string;
  conversationId: string;
  attachmentId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | string;
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  model: string | null;
  gatewayRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: AgentMessageContent;
  clientMessageId: string | null;
  runId: string | null;
  createdAt: string;
  attachments?: Array<{ attachment: AgentAttachment; snapshot: Record<string, unknown> }>;
};

export type AgentArtifact = {
  id: string;
  conversationId: string;
  runId: string;
  type: string;
  version: number;
  status: string;
  title: string;
  summary: string | null;
  domainEntityType: string | null;
  domainEntityId: string | null;
  route: string | null;
  snapshot: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentConversationSummary = {
  id: string;
  status: string;
  title: string | null;
  scopeType?: 'learning_context' | 'independent_subject_qa' | 'practice_question_qa';
  scopeRoundId?: number | null;
  scopeQuestionId?: number | null;
  archivedAt?: string | null;
  purgeAfter?: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentConversation = AgentConversationSummary & {
  messages: AgentMessage[];
  artifacts: AgentArtifact[];
  attachments?: AgentAttachment[];
};

export type AgentJourneyOverview = {
  schemaVersion: '1';
  generatedAt: string;
  goal: {
    examDate: string | null;
    weeklyGoalDays: number | null;
    totalTargetScore: number | null;
    subjects: Array<{
      subject: 'math' | 'physics' | 'chemistry';
      targetScore: number | null;
    }>;
  };
  progress: {
    subjects: Array<{
      subject: 'math' | 'physics' | 'chemistry';
      totalTopicCount: number;
      evidencedTopicCount: number;
      strongTopicCount: number;
      developingTopicCount: number;
      needsAttentionTopicCount: number;
      insufficientEvidenceTopicCount: number;
      answerEvidenceCount: number;
    }>;
  };
  planning?: {
    status: 'ready' | 'disabled' | 'goal_unset' | 'updating' | 'unavailable';
    reasonCode: 'formal_goal_required' | 'planning_disabled' | 'evidence_projection_pending' | 'planning_unavailable' | null;
  };
  nextDecision?: null | {
    prescriptionId: string;
    reasonSummary: string;
    reasonCodes: string[];
    confidence: 'low' | 'medium' | 'high';
    estimatedMinutes: number;
    source: 'learning_prescription';
    generatedByAI: false;
    availability?: null | {
      status: 'sufficient' | 'limited' | 'empty' | 'unknown' | 'not_required';
      requestedCount: number;
      availableCount: number | null;
      teachingAssetCount?: number;
      conceptCardCount?: number;
      explainedQuestionCount?: number;
    };
    primaryTask: null | {
      type: 'diagnostic' | 'review' | 'targeted_practice' | 'mock_exam' | 'concept_learning' | 'intervention_verification';
      subject: 'math' | 'physics' | 'chemistry';
      topicIds: number[];
      difficulty?: string;
      questionCount?: number;
      priority: number;
    };
  };
  learningQuality?: {
    schemaVersion: '1';
    policyVersion: 'learning-quality-v1';
    status: 'cold_start' | 'collecting' | 'validating' | 'calibrated';
    evidence: { acceptedCount: number; evidencedTopicCount: number; totalTopicCount: number; projectionPending: boolean };
    recommendationFunnel: {
      publishedCount: number; shownCount: number; acceptedCount: number; terminalCount: number;
      completedCount: number; positiveOutcomeCount: number; followThroughRate: number;
      completionRate: number; positiveOutcomeRate: number;
    };
    validation: {
      stable: number; notStable: number; inconclusive: number; pending: number; contradictionCount: number;
      strongWithActiveErrorCount: number; weakWithStableValidationCount: number;
    };
    supply: null | { status: 'sufficient' | 'limited' | 'empty' | 'unknown' | 'not_required'; requestedCount: number; availableCount: number | null; teachingAssetCount?: number; conceptCardCount?: number; explainedQuestionCount?: number };
    alerts: Array<{ code: string; tone: 'info' | 'warning'; title: string; body: string; action: 'practice' | 'review' | 'wait' }>;
    provenance: { generatedByAI: false; source: 'learning_evidence_and_outcomes'; note: string };
  };
  weaknesses: {
    stateSource: 'user_csca_topic_mastery_v1';
    subjects: Array<{
      subject: 'math' | 'physics' | 'chemistry';
      score?: number;
      evidenceCount: number;
      topics: Array<{
        topicId: number;
        code: string;
        title: string;
        score: number;
        confidence: number;
        status: string;
        attemptCount: number;
        correctCount: number;
        lastPracticedAt: string | null;
        updatedAt: string;
      }>;
    }>;
    reviewQueue: Array<{
      reviewItemId: string;
      patternType: string;
      topicId?: number;
      subject: 'math' | 'physics' | 'chemistry';
      title: string;
      dueAt: string | null;
      priority: number;
      recurrenceCount: number;
      status: string;
      consecutiveVerificationPassCount?: number;
      requiredConsecutiveVerificationPassCount?: number;
      lastVerificationPassedAt?: string | null;
      href: string;
    }>;
  };
  resources: {
    source: 'published_past_papers';
    subjectScope: Array<'math' | 'physics' | 'chemistry'>;
    items: AgentPastPaperResource[];
  };
};

export type AgentJourneyResumeWorkspace =
  | { kind: 'adaptive_round'; conversationId: string; artifactId?: string; verificationId?: string; roundId: number; phase: 'practice' | 'report'; taskType: string; subject: string | null }
  | { kind: 'mock_exam'; conversationId: string; artifactId: string; attemptId: number; phase: 'taking' | 'report'; subject: string | null; paperTitle: string | null }
  | { kind: 'past_paper'; conversationId: string; slug: string; questionId: number }
  | { kind: 'teaching'; conversationId: string; deliveryId: string };

export type AgentJourneyStage = {
  id: string;
  kind: 'practice' | 'free_practice' | 'mock_exam' | 'past_paper' | 'teaching';
  conversationId: string;
  journeyId: string;
  title: string;
  subject: string | null;
  taskType: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  metrics: {
    batchCount: number;
    completedBatchCount: number;
    allocatedQuestionCount: number;
    answeredQuestionCount: number;
    correctCount: number;
    accuracy: number | null;
    assistanceCount: number;
    teachingCount: number;
  };
  resume: AgentJourneyResumeWorkspace | null;
  provenance: {
    source: 'agent_artifacts' | 'agent_past_paper_attempts' | 'learning_intervention_deliveries';
    artifactIds: string[];
    domainEntityRefs: Array<{ type: string; id: string }>;
  };
};

export type AgentJourneyState = {
  schemaVersion: '1';
  generatedAt: string;
  activeWorkspace: AgentJourneyResumeWorkspace | null;
  plans: Array<Pick<AgentArtifact, 'id' | 'type' | 'status' | 'title' | 'summary' | 'route' | 'snapshot' | 'createdAt'>>;
  stages: AgentJourneyStage[];
};

export type AgentRun = {
  id: string;
  conversationId: string;
  userId: number;
  status: string;
  channel: string;
  traceId: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorRetryable: boolean | null;
  artifacts: AgentArtifact[];
  toolCalls: Array<{
    id: string;
    toolName: string;
    toolVersion: string;
    status: string;
    errorCode: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

export type AgentSubmission = {
  messageId: string;
  runId: string;
  status: string;
  eventsUrl: string;
};

export type AgentPracticeLaunch = {
  schemaVersion: '1';
  artifactId: string;
  conversationId: string;
  sessionId: number;
  roundId: number;
  mode: string;
  questionCount: number;
  subject: string;
  questionLanguage: string;
  toolName: string;
  taskType: 'diagnostic' | 'review' | 'targeted_practice' | 'concept_learning' | 'free_practice';
  reviewItemId?: number;
  route: string;
  legacyRoute: string;
  journeyId?: string;
  batchIndex?: number;
  workspace: {
    kind: 'adaptive_round';
    phase: 'practice';
    taskType: 'diagnostic' | 'review' | 'targeted_practice' | 'concept_learning' | 'free_practice';
    subject: 'math' | 'physics' | 'chemistry';
    reasonCodes: string[];
    objective: string | null;
  };
};

export type AgentMockExamLaunch = {
  schemaVersion: '1';
  artifactId: string;
  conversationId: string;
  attemptId: number;
  paperSlug: string;
  paperTitle: string;
  subject: 'math' | 'physics' | 'chemistry';
  questionLanguage: 'zh' | 'en';
  toolName: 'start_mock_exam';
  taskType: 'mock_exam';
  mode: 'resume_attempt' | 'initial_diagnostic' | 'remediate_low_score' | 'mastery_bridge' | 'maintain_pace';
  route: string;
  legacyRoute: string;
  workspace: {
    kind: 'mock_exam';
    phase: 'taking';
    taskType: 'mock_exam';
    subject: 'math' | 'physics' | 'chemistry';
    reasonCodes: string[];
    objective: string | null;
  };
};

export type AgentTaskSettlement = {
  schemaVersion: '1';
  artifactId: string;
  roundId: number;
  decision: 'completed' | 'failed';
  verification: boolean;
  targetCorrectCount: number;
  targetTotal: number;
  targetAccuracy: number;
  verificationResult?: {
    verdict: 'repaired' | 'needs_consolidation' | 'insufficient_evidence';
    currentRoundPassed: boolean;
    reviewItemId: number | null;
    topicId: number | null;
    patternType: string | null;
    consecutivePassCount: number;
    requiredPassCount: number;
    nextReviewAt: string | null;
    nextAction: 'broaden_coverage' | 'wait_for_spaced_verification' | 'review_then_retry' | 'retry_verification';
  };
  freePractice?: {
    journeyId: string;
    batchIndex: number;
    subject: 'math' | 'physics' | 'chemistry';
    questionCount: number;
    canContinue: boolean;
  };
};

export type AgentFreePracticeEnd = {
  schemaVersion: '1';
  journeyId: string;
  artifactId: string;
  status: 'ended';
  batchCount: number;
  completedBatchCount: number;
  totalQuestions: number;
  allocatedQuestionCount: number;
  endedAt: string;
};

export type AgentMockExamSettlement = {
  schemaVersion: '1';
  artifactId: string;
  attemptId: number;
  decision: 'completed';
  subject: 'math' | 'physics' | 'chemistry';
  paperSlug: string;
  paperTitle: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  submittedAt: string;
  learningReview: {
    status: 'ready' | 'goal_unset' | 'updating' | 'unavailable';
    evidence: { sourceType: 'mock_exam'; sourceId: string; acceptedCount: number };
    result: { score: number; correctCount: number; wrongCount: number; unansweredCount: number };
    focusTopics: Array<{ title: string; attemptedCount: number; incorrectCount: number; accuracy: number }>;
    targetGap: null | {
      gapSnapshotId: string;
      goalId: string;
      totalGapCount: number;
      subjectGapCount: number;
      priorityGapCount: number;
      topSubjectGaps: Array<{
        type: 'coverage' | 'mastery' | 'difficulty' | 'retention' | 'fluency' | 'transfer' | 'exam_execution' | 'evidence';
        severity: number;
        confidence: 'low' | 'medium' | 'high';
        topicIds: number[];
        recommendedAction: string;
        reasonCodes: string[];
      }>;
    };
    nextDecision: null | {
      prescriptionId: string;
      reasonSummary: string;
      confidence: 'low' | 'medium' | 'high';
      estimatedMinutes: number;
      primaryTask: null | {
        type: 'diagnostic' | 'review' | 'targeted_practice' | 'mock_exam' | 'concept_learning' | 'intervention_verification';
        subject: 'math' | 'physics' | 'chemistry';
        topicIds: number[];
        questionCount?: number;
        priority: number;
      };
    };
    provenance: {
      resultSource: 'submitted_mock_exam';
      nextTaskSource: 'learning_prescription' | null;
      automaticQuestionGenerationInvoked: false;
    };
  };
};

export type AgentStreamEvent = {
  eventId: string;
  runId: string;
  conversationId: string;
  sequence: number;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
};

export function createAgentConversation(input: {
  title?: string;
  scope?: { type: 'independent_subject_qa' } | { type: 'practice_question_qa'; roundId: number; questionId: number };
} = {}) {
  return requestJson<AgentConversationSummary>('/api/v1/agent/conversations', {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function listAgentConversations() {
  return requestJson<AgentConversationSummary[]>('/api/v1/agent/conversations', {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentConversation(conversationId: string) {
  return requestJson<AgentConversation>(`/api/v1/agent/conversations/${encodeURIComponent(conversationId)}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentJourneyOverview(locale: 'zh-CN' | 'en') {
  const query = new URLSearchParams({ locale: locale === 'en' ? 'en' : 'zh' });
  return requestJson<AgentJourneyOverview>(`/api/v1/agent/journey/overview?${query.toString()}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentJourneyState() {
  return requestJson<AgentJourneyState>('/api/v1/agent/journey/state', { withAuth: true });
}

export function submitAgentMessage(
  conversationId: string,
  input: {
    clientRequestId: string;
    text: string;
    locale: 'zh-CN' | 'en';
    surface?: 'learning_workspace' | 'subject_qa';
    attachmentIds?: string[];
    pageContext?: {
      route: string;
      artifactId?: string;
      entityRef?: { type: 'adaptive_round' | 'intervention_verification' | 'mock_attempt' | 'past_paper'; id: string };
      selectedQuestionId?: number;
      questionContext?: {
        roundId: number;
        questionId: number;
        questionSource?: 'special_practice' | 'csca_question';
        questionNumber: number;
        subject: 'math' | 'physics' | 'chemistry';
        topicTitle: string;
        prompt: string;
        options: Array<{ id: string; text: string }>;
        selectedAnswer?: string;
        answered: boolean;
        correctAnswer?: string;
        isCorrect?: boolean;
        explanation?: string;
        knowledgeTags?: string[];
      };
    };
  }
) {
  return requestJson<AgentSubmission>(`/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function getAgentRun(runId: string) {
  return requestJson<AgentRun>(`/api/v1/agent/runs/${encodeURIComponent(runId)}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentPastPaperQuestionIndex(slug: string) {
  return requestJson<AgentPastPaperQuestionIndex>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/questions`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentPastPaperProgress(slug: string, conversationId: string) {
  const query = new URLSearchParams({ conversationId });
  return requestJson<AgentPastPaperProgress>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/progress?${query}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentPastPaperReview(slug: string, conversationId: string) {
  const query = new URLSearchParams({ conversationId });
  return requestJson<AgentPastPaperReview>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/review?${query}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function getAgentPastPaperAssistance(slug: string, questionId: number, conversationId: string) {
  const query = new URLSearchParams({ conversationId });
  return requestJson<AgentPastPaperAssistanceAvailability>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/questions/${questionId}/assistance?${query}`, {
    withAuth: true,
    preserveAuthOnUnauthorized: true
  });
}

export function requestAgentPastPaperAssistance(
  slug: string,
  questionId: number,
  input: { clientRequestId: string; conversationId: string; action: AgentPastPaperAssistanceAction; studentWork?: string; confirmed?: boolean; language?: 'zh' | 'en' }
) {
  return requestJson<AgentPastPaperAssistanceResult>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/questions/${questionId}/assistance`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function startAgentPastPaperAttempt(slug: string, questionId: number, input: { clientRequestId: string; conversationId: string }) {
  return requestJson<AgentPastPaperAttemptResult>(`/api/v1/agent/past-papers/${encodeURIComponent(slug)}/questions/${questionId}/attempts/start`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function submitAgentPastPaperAttempt(attemptId: string, input: { clientRequestId: string; selectedAnswer: string }) {
  return requestJson<AgentPastPaperAttemptResult>(`/api/v1/agent/past-paper-attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function offerAgentIntervention(input: {
  clientRequestId: string;
  context: 'after_round' | 'agent_conversation';
  conversationId?: string;
  language?: 'zh-CN' | 'en' | 'vi';
}) {
  return requestJson<{ schemaVersion: '1'; item: AgentInterventionDelivery | null; suppressedReason: string | null }>('/api/v1/agent/interventions/offer', {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function recordAgentPrescriptionExposure(prescriptionId: string, input: { clientRequestId: string; surface: string }) {
  return requestJson<{ schemaVersion: '1'; prescriptionId: string; recorded: boolean; shownAt: string }>(`/api/v1/agent/journey/prescriptions/${encodeURIComponent(prescriptionId)}/exposure`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export type AgentLearningContext = {
  contextId: string;
  kind: 'practice' | 'mock_exam' | 'past_paper' | 'teaching';
  resourceId: string | null;
  createdAt: string;
};

export function createAgentLearningContext(input: { kind: AgentLearningContext['kind']; resourceId?: string }) {
  return requestJson<AgentLearningContext>('/api/v1/agent/learning-contexts', {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function getAgentInterventionDelivery(deliveryId: string) {
  return requestJson<AgentInterventionDelivery>(`/api/v1/agent/intervention-deliveries/${encodeURIComponent(deliveryId)}`, {
    withAuth: true
  });
}

export function recordAgentInterventionTeachingInteraction(
  deliveryId: string,
  input: { clientRequestId: string; action: 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed'; value?: string | number | boolean }
) {
  return requestJson<AgentTeachingInteractionResult>(`/api/v1/agent/intervention-deliveries/${encodeURIComponent(deliveryId)}/teaching-interactions`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function actOnAgentIntervention(
  deliveryId: string,
  input: { clientRequestId: string; action: 'start' | 'complete' | 'defer' | 'skip' }
) {
  return requestJson<AgentInterventionDelivery>(`/api/v1/agent/intervention-deliveries/${encodeURIComponent(deliveryId)}/actions`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function offerAgentInterventionVerification(input: { clientRequestId: string; conversationId?: string }) {
  return requestJson<{ schemaVersion: '2'; item: AgentInterventionVerification | null; shortage: null | { code: string; requested: number; available: number }; nextDueAt: string | null }>('/api/v1/agent/intervention-verifications/offer', {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function startAgentInterventionVerification(
  verificationId: string,
  input: { clientRequestId: string; questionLanguage: 'zh' | 'en' }
) {
  return requestJson<AgentInterventionVerification>(`/api/v1/agent/intervention-verifications/${encodeURIComponent(verificationId)}/start`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function settleAgentInterventionVerification(verificationId: string) {
  return requestJson<AgentInterventionVerification>(`/api/v1/agent/intervention-verifications/${encodeURIComponent(verificationId)}/settle`, {
    method: 'POST', withAuth: true
  });
}

export function startAgentPractice(
  artifactId: string,
  input: { clientRequestId: string; questionLanguage?: 'zh' | 'en' }
) {
  return requestJson<AgentPracticeLaunch>(`/api/v1/agent/artifacts/${encodeURIComponent(artifactId)}/start-practice`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function startAgentPrescription(
  prescriptionId: string,
  input: { clientRequestId: string; questionLanguage?: 'zh' | 'en' }
) {
  return requestJson<AgentPracticeLaunch | AgentMockExamLaunch>(`/api/v1/agent/journey/prescriptions/${encodeURIComponent(prescriptionId)}/start`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function startAgentFreePractice(input: {
  clientRequestId: string;
  conversationId?: string;
  subject: 'math' | 'physics' | 'chemistry';
  questionCount: number;
  questionLanguage: 'zh' | 'en';
  focusTopicId?: number;
  reviewItemId?: number;
  patternType?: string;
}) {
  return requestJson<AgentPracticeLaunch>('/api/v1/agent/free-practice/start', {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export function startAgentMockExam(
  artifactId: string,
  input: { clientRequestId: string; questionLanguage?: 'zh' | 'en' }
) {
  return requestJson<AgentMockExamLaunch>(`/api/v1/agent/artifacts/${encodeURIComponent(artifactId)}/start-mock-exam`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify(input)
  });
}

export async function uploadAgentAttachment(
  conversationId: string,
  file: File,
  onProgress?: (percent: number) => void
) {
  let token = readStoredToken();
  if (!token) token = await refreshStoredAccessToken({ clearOnFailure: false });
  if (!token) throw new ApiError('请先登录。', 401, 'auth_required');
  return new Promise<AgentAttachment>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/attachments`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    request.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new ApiError('附件上传失败，请检查网络。', 0, 'attachment_upload_failed'));
    request.onload = () => {
      let payload: any = null;
      try { payload = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && payload) return resolve(payload as AgentAttachment);
      const message = payload?.message?.message || payload?.message || payload?.error || `附件上传失败 (${request.status})`;
      reject(new ApiError(String(message), request.status, payload?.code || payload?.message?.code || 'attachment_upload_failed'));
    };
    request.send(file);
  });
}

export async function uploadAgentPracticeQuestionAttachment(
  roundId: number,
  questionId: number,
  file: File,
  onProgress?: (percent: number) => void
) {
  let token = readStoredToken();
  if (!token) token = await refreshStoredAccessToken({ clearOnFailure: false });
  if (!token) throw new ApiError('请先登录。', 401, 'auth_required');
  return new Promise<AgentAttachment>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/api/v1/agent/practice-rounds/${roundId}/questions/${questionId}/attachment`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    request.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new ApiError('手写过程上传失败，请检查网络。', 0, 'practice_attachment_upload_failed'));
    request.onload = () => {
      let payload: any = null;
      try { payload = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && payload) return resolve(payload as AgentAttachment);
      const message = payload?.message?.message || payload?.message || payload?.error || `手写过程上传失败 (${request.status})`;
      reject(new ApiError(String(message), request.status, payload?.code || payload?.message?.code || 'practice_attachment_upload_failed'));
    };
    request.send(file);
  });
}

export function listAgentAttachments(conversationId: string) {
  return requestJson<{ items: AgentAttachment[]; limits: AgentAttachmentLimits }>(`/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/attachments`, { withAuth: true });
}

export function retryAgentAttachment(attachmentId: string) {
  return requestJson<AgentAttachment>(`/api/v1/agent/attachments/${encodeURIComponent(attachmentId)}/retry`, { method: 'POST', withAuth: true });
}

export function deleteAgentAttachment(attachmentId: string) {
  return requestJson<{ id: string; status: string }>(`/api/v1/agent/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE', withAuth: true });
}

export function analyzeAgentAttachment(attachmentId: string, input: {
  clientRequestId: string;
  studentNote?: string;
  mode?: 'general_review' | 'document_qa' | 'document_summary' | 'image_question_analysis' | 'handwritten_solution_review' | 'question_extraction' | 'document_compare' | 'knowledge_mapping';
  roundId?: number;
  questionId?: number;
  responseDepth?: 'hint' | 'guided' | 'full';
  language?: 'zh' | 'en' | 'vi';
}) {
  return requestJson<AgentAttachmentAnalysis>(`/api/v1/agent/attachments/${encodeURIComponent(attachmentId)}/analyses`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function getAgentAttachmentAnalysis(analysisId: string) {
  return requestJson<AgentAttachmentAnalysis>(`/api/v1/agent/attachment-analyses/${encodeURIComponent(analysisId)}`, { withAuth: true });
}

export function listAgentAttachmentAnalyses(conversationId: string) {
  return requestJson<AgentAttachmentAnalysis[]>(`/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/attachment-analyses`, { withAuth: true });
}

export function retryAgentAttachmentAnalysis(analysisId: string) {
  return requestJson<AgentAttachmentAnalysis>(`/api/v1/agent/attachment-analyses/${encodeURIComponent(analysisId)}/retry`, { method: 'POST', withAuth: true });
}

export function getAgentAttachmentEvidenceCandidate(analysisId: string) {
  return requestJson<AgentAttachmentEvidenceCandidate | null>(`/api/v1/agent/attachment-analyses/${encodeURIComponent(analysisId)}/evidence-candidate`, { withAuth: true });
}

export function confirmAgentAttachmentEvidence(candidateId: string, input: { clientRequestId: string; topicId: number; confirmRecognition: true; confirmAssessment: true }) {
  return requestJson<AgentAttachmentEvidenceCandidate>(`/api/v1/agent/evidence-candidates/${encodeURIComponent(candidateId)}/confirm`, { method: 'POST', withAuth: true, body: JSON.stringify(input) });
}

export function rejectAgentAttachmentEvidence(candidateId: string, input: { clientRequestId: string; reason?: string }) {
  return requestJson<AgentAttachmentEvidenceCandidate>(`/api/v1/agent/evidence-candidates/${encodeURIComponent(candidateId)}/reject`, { method: 'POST', withAuth: true, body: JSON.stringify(input) });
}

export function revokeAgentAttachmentEvidence(candidateId: string, input: { clientRequestId: string; reason?: string }) {
  return requestJson<AgentAttachmentEvidenceCandidate>(`/api/v1/agent/evidence-candidates/${encodeURIComponent(candidateId)}/revoke`, { method: 'POST', withAuth: true, body: JSON.stringify(input) });
}

export async function previewAgentAttachment(attachment: AgentAttachment) {
  if (!attachment.previewUrl) return;
  let token = readStoredToken();
  if (!token) token = await refreshStoredAccessToken({ clearOnFailure: false });
  if (!token) throw new ApiError('请先登录。', 401, 'auth_required');
  const response = await fetch(`${API_BASE}${attachment.previewUrl}`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ApiError('附件预览失败。', response.status, 'attachment_preview_failed');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function settleAgentPractice(roundId: string | number) {
  return requestJson<AgentTaskSettlement>(`/api/v1/agent/practice-rounds/${encodeURIComponent(String(roundId))}/settle`, {
    method: 'POST',
    withAuth: true
  });
}

export function continueAgentFreePractice(artifactId: string, input: {
  clientRequestId: string;
  subject: 'math' | 'physics' | 'chemistry';
  questionCount: number;
  questionLanguage: 'zh' | 'en';
}) {
  return requestJson<AgentPracticeLaunch>(`/api/v1/agent/free-practice/${encodeURIComponent(artifactId)}/continue`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function endAgentFreePractice(artifactId: string, input: { clientRequestId: string }) {
  return requestJson<AgentFreePracticeEnd>(`/api/v1/agent/free-practice/${encodeURIComponent(artifactId)}/end`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function settleAgentMockExam(attemptId: string | number) {
  return requestJson<AgentMockExamSettlement>(`/api/v1/agent/mock-exam-attempts/${encodeURIComponent(String(attemptId))}/settle`, {
    method: 'POST',
    withAuth: true
  });
}

export function getAgentLearningAssistance(roundId: string | number, questionId: string | number) {
  return requestJson<LearningAssistanceAvailability>(`/api/v1/agent/practice-rounds/${encodeURIComponent(String(roundId))}/questions/${encodeURIComponent(String(questionId))}/assistance`, { withAuth: true });
}

export function requestAgentLearningAssistance(
  roundId: string | number,
  questionId: string | number,
  input: { clientRequestId: string; action: LearningAssistanceAction; language?: 'zh' | 'en' | 'vi'; questionLanguage?: 'zh' | 'en' }
) {
  return requestJson<LearningAssistanceResult>(`/api/v1/agent/practice-rounds/${encodeURIComponent(String(roundId))}/questions/${encodeURIComponent(String(questionId))}/assistance`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function reportAgentLearningContentIssue(
  roundId: string | number,
  questionId: string | number,
  input: { clientRequestId: string; reason: 'incorrect' | 'unclear' | 'answer_leak' | 'rendering' | 'other'; note?: string }
) {
  return requestJson<{ schemaVersion: '1'; reportId: string; status: 'received' }>(`/api/v1/agent/practice-rounds/${encodeURIComponent(String(roundId))}/questions/${encodeURIComponent(String(questionId))}/assistance/report`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function getAgentTeachingAssetForQuestion(roundId: string | number, questionId: string | number, language = 'zh-CN') {
  return requestJson<{ schemaVersion: '1'; item: AgentTeachingAsset | null; gapReason: string | null }>(`/api/v1/agent/practice-rounds/${encodeURIComponent(String(roundId))}/questions/${encodeURIComponent(String(questionId))}/teaching-asset?language=${encodeURIComponent(language)}`, { withAuth: true });
}

export function getAgentTeachingAsset(stableKey: string, language = 'zh-CN') {
  return requestJson<{ schemaVersion: '1'; item: AgentTeachingAsset }>(`/api/v1/agent/teaching-assets/${encodeURIComponent(stableKey)}?language=${encodeURIComponent(language)}`, { withAuth: true });
}

export function recordAgentTeachingInteraction(
  assetVersionId: string,
  input: {
    clientRequestId: string;
    roundId: number;
    questionId: number;
    action: 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed' | 'skipped';
    value?: string | number | boolean;
  }
) {
  return requestJson<AgentTeachingInteractionResult>(`/api/v1/agent/teaching-assets/${encodeURIComponent(assetVersionId)}/interactions`, {
    method: 'POST', withAuth: true, body: JSON.stringify(input)
  });
}

export function abandonAgentTask(artifactId: string, clientRequestId: string) {
  return requestJson<{ schemaVersion: '1'; artifactId: string; decision: string }>(`/api/v1/agent/artifacts/${encodeURIComponent(artifactId)}/abandon`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify({ clientRequestId })
  });
}

function parseSseBlock(block: string): AgentStreamEvent | null {
  const lines = block.split('\n');
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as AgentStreamEvent;
  } catch {
    return null;
  }
}

async function openAgentEventStream(runId: string, afterSequence: number, signal: AbortSignal, isRetry: boolean) {
  let token = readStoredToken();
  if (!token) token = await refreshStoredAccessToken({ clearOnFailure: false });
  if (!token) throw new ApiError('请先登录。', 401, 'auth_required');
  const response = await fetch(`${API_BASE}/api/v1/agent/runs/${encodeURIComponent(runId)}/events?after=${afterSequence}`, {
    method: 'GET',
    signal,
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'Last-Event-ID': String(afterSequence)
    }
  });
  if (response.status === 401 && !isRetry) {
    const refreshed = await refreshStoredAccessToken({ clearOnFailure: false });
    if (refreshed) return openAgentEventStream(runId, afterSequence, signal, true);
  }
  if (!response.ok || !response.body) {
    throw new ApiError(`Agent event stream failed: ${response.status}`, response.status, 'agent_stream_failed');
  }
  return response.body.getReader();
}

export async function streamAgentRunEvents(
  runId: string,
  afterSequence: number,
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  const reader = await openAgentEventStream(runId, afterSequence, signal, false);
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const event = parseSseBlock(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event) onEvent(event);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
}
