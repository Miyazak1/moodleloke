import type {
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningCandidateBulkTask,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningQualityGovernance,
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningQuestion,
  AdminAIQuestioningQuestionLedgerItem,
  AdminAIQuestioningRemediation,
  AdminAIQuestioningSourceDocument,
  AdminAIQuestioningSourceDocumentProfileVisualization,
  AdminAIQuestioningSourceQuestion,
  AdminAIQuestioningSourceReferenceSummary,
  AdminAIQuestioningSourceAutoProfileTask,
  AdminAIQuestioningSourceTopicTask,
  AdminAIQuestioningExamSeriesProfile,
  AdminAIQuestioningGenerationProfile,
  AdminAIQuestioningStyleProfile,
  AdminAIQuestioningTopicHealth,
  AdminAIQuestioningTopicOption
} from '../../../lib/api-types';

export type QuestionBankUseCase = 'subject_practice' | 'online_mock_exam';

export type QuestionBankTab = 'overview' | 'shared-prep' | 'subject-practice' | 'online-mock';

export type QuestionBankTabItem = {
  key: QuestionBankTab;
  label: string;
  detail: string;
};

export type QuestionBankSummary = {
  total: number;
  published: number;
  practiceReady: number;
  used: number;
  pending: number;
  candidateWork: number;
  topicWork: number;
  qualityWork: number;
  remediationWork: number;
};

export type QuestionBankState = {
  coverage: AdminAIQuestioningBlueprintCoverage;
  topicHealth: AdminAIQuestioningTopicHealth;
  generationQueue: AdminAIQuestioningGenerationQueueHealth;
  candidates: AdminAIQuestioningQuestion[];
  candidatesTotal: number;
  candidateBulkTasks: AdminAIQuestioningCandidateBulkTask[];
  publishedItems: AdminAIQuestioningQuestionLedgerItem[];
  publishedTotal: number;
  ledgerItems: AdminAIQuestioningQuestionLedgerItem[];
  ledgerTotal: number;
  sourceDocuments: AdminAIQuestioningSourceDocument[];
  sourceDocumentProfileVisualizations: Record<number, AdminAIQuestioningSourceDocumentProfileVisualization>;
  sourceQuestions: AdminAIQuestioningSourceQuestion[];
  sourceQuestionsTotal: number;
  sourceAutoProfileTasks: AdminAIQuestioningSourceAutoProfileTask[];
  sourceTopicTasks: AdminAIQuestioningSourceTopicTask[];
  sourceReferenceSummary: AdminAIQuestioningSourceReferenceSummary['summary'];
  styleProfiles: AdminAIQuestioningStyleProfile[];
  examSeriesProfiles: AdminAIQuestioningExamSeriesProfile[];
  generationProfiles: AdminAIQuestioningGenerationProfile[];
  topicOptions: AdminAIQuestioningTopicOption[];
  qualityGovernance: AdminAIQuestioningQualityGovernance;
  qualityMetrics: AdminAIQuestioningQualityMetric[];
  qualityTrend: AdminAIQuestioningQualityTrend;
  remediation: AdminAIQuestioningRemediation;
  misconceptions: AdminAIQuestioningMisconceptions;
};

export type AdminRunActionOptions = {
  refresh?: (() => void | Promise<void>) | false;
};

export type AdminRunAction = (
  actionId: string,
  label: string,
  action: () => Promise<unknown>,
  options?: AdminRunActionOptions
) => Promise<void>;

export type QuestionEditDraft = {
  prompt: string;
  options: Array<{ id: string; text: string }>;
  optionsJson: string;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string;
  optionMetadataJson: string;
  note: string;
};

export type MisconceptionEditDraft = {
  label: string;
  description: string;
};

export type ConceptCardEditDraft = {
  title: string;
  body: string;
  note: string;
};
