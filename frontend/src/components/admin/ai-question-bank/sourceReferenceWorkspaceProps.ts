import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SourceImportMessage } from './SourceImportPanel';
import type { SourceReferenceWorkspaceProps } from './SourceReferenceWorkspace';
import type { QuestionBankState } from './types';

type SourceReferenceWorkflowView = {
  canGenerateStyleProfile: boolean;
  styleProfileBlockedReason: string;
  sourceReferenceWorkflowTone: SourceReferenceWorkspaceProps['sourceReferenceWorkflowTone'];
};

type SourceReferenceStateView = {
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  reviewStatus: string;
  setReviewStatus: Dispatch<SetStateAction<string>>;
  documentId: number | null;
  setDocumentId: Dispatch<SetStateAction<number | null>>;
  pageStart: number;
  pageEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

type SourceReferenceActions = {
  generateCurrentStyleProfile: () => Promise<void>;
  generateCurrentExamSeriesProfile: () => Promise<void>;
  generateCurrentGenerationProfiles: () => Promise<void>;
  refreshQuestionVersionGovernance: () => Promise<void>;
  activateExamSeriesProfile: (profileId: number) => Promise<void>;
  activateGenerationProfile: (profileId: number) => Promise<void>;
  loadSourceImportJsonFile: (file: File) => Promise<void>;
  validateSourceImportJson: () => void;
  importSourceReferenceJson: () => Promise<void>;
  startAutoProfileSourceQuestions: () => Promise<void>;
  retryAutoProfileSourceQuestions: () => Promise<void>;
  autoMapAndApproveSourceQuestionsForProfile: () => Promise<void>;
  reprocessSourceDocument: (documentId: number, documentSubject?: string) => Promise<void>;
  deleteSourceDocument: (documentId: number, documentTitle?: string) => Promise<void>;
  cleanupCurrentSubjectSourceDocuments: () => Promise<void>;
  rebuildSourceProfilePipeline: () => Promise<void>;
  loadSourceDocumentProfileVisualization: (documentId: number) => Promise<void>;
};

type BuildSourceReferenceWorkspacePropsParams = {
  subject: string;
  onSubjectChange: (subject: string) => void;
  data: Pick<
    QuestionBankState,
    | 'sourceDocuments'
    | 'sourceDocumentProfileVisualizations'
    | 'sourceReferenceSummary'
    | 'styleProfiles'
    | 'examSeriesProfiles'
    | 'generationProfiles'
    | 'sourceQuestions'
    | 'sourceQuestionsTotal'
    | 'sourceAutoProfileTasks'
    | 'sourceTopicTasks'
  >;
  sourceImportJson: string;
  sourceImportMessage: SourceImportMessage | null;
  sourceImportFileInputRef: RefObject<HTMLInputElement | null>;
  workflowView: SourceReferenceWorkflowView;
  sourceReference: SourceReferenceStateView;
  sourceReferenceControlsBusy: boolean;
  isImportBusy: boolean;
  isStyleProfileBusy: boolean;
  isActionBusy: (id: string) => boolean;
  onRefreshSourceReference: () => void;
  sourceQuestionPageSize: number;
  sourceReferenceTemplate: (subject: string) => string;
  setSourceImportJson: Dispatch<SetStateAction<string>>;
  setSourceImportMessage: Dispatch<SetStateAction<SourceImportMessage | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  actions: SourceReferenceActions;
};

export function buildSourceReferenceWorkspaceProps({
  subject,
  onSubjectChange,
  data,
  sourceImportJson,
  sourceImportMessage,
  sourceImportFileInputRef,
  workflowView,
  sourceReference,
  sourceReferenceControlsBusy,
  isImportBusy,
  isStyleProfileBusy,
  isActionBusy,
  onRefreshSourceReference,
  sourceQuestionPageSize,
  sourceReferenceTemplate,
  setSourceImportJson,
  setSourceImportMessage,
  setError,
  actions
}: BuildSourceReferenceWorkspacePropsParams): SourceReferenceWorkspaceProps {
  return {
    subject,
    onSubjectChange,
    sourceDocuments: data.sourceDocuments,
    sourceDocumentProfileVisualizations: data.sourceDocumentProfileVisualizations,
    sourceReferenceSummary: data.sourceReferenceSummary,
    sourceAutoProfileTasks: data.sourceAutoProfileTasks,
    sourceImportJson,
    sourceImportMessage,
    sourceImportFileInputRef,
    canGenerateStyleProfile: workflowView.canGenerateStyleProfile,
    styleProfileBlockedReason: workflowView.styleProfileBlockedReason,
    sourceReferenceWorkflowTone: workflowView.sourceReferenceWorkflowTone,
    isImportBusy,
    isStyleProfileBusy,
    onGenerateStyleProfile: () => void actions.generateCurrentStyleProfile(),
    onChangeImportJson: (value) => {
      setSourceImportJson(value);
      setSourceImportMessage(null);
    },
    onLoadImportFile: (file) => void actions.loadSourceImportJsonFile(file),
    onChooseImportFile: () => sourceImportFileInputRef.current?.click(),
    onFillImportTemplate: () => {
      setSourceImportJson(sourceReferenceTemplate(subject || 'math'));
      setSourceImportMessage(null);
      setError(null);
    },
    onValidateImportJson: actions.validateSourceImportJson,
    onImportJson: () => void actions.importSourceReferenceJson(),
    onClearImportJson: () => {
      setSourceImportJson('');
      setSourceImportMessage(null);
      setError(null);
    },
    onSelectSourceDocument: (documentId) => {
      sourceReference.setDocumentId(documentId);
      sourceReference.setReviewStatus('');
      sourceReference.setPage(0);
    },
    onReprocessSourceDocument: (documentId, documentSubject) => void actions.reprocessSourceDocument(documentId, documentSubject),
    onDeleteSourceDocument: (documentId, documentTitle) => void actions.deleteSourceDocument(documentId, documentTitle),
    onCleanupCurrentSubjectSourceDocuments: () => void actions.cleanupCurrentSubjectSourceDocuments(),
    isSourceDocumentBusy: (documentId) => isActionBusy(`source-document-reprocess-${documentId}`),
    isSourceDocumentDeleteBusy: (documentId) => isActionBusy(`source-document-delete-${documentId}`),
    isSourceDocumentsCleanupBusy: isActionBusy(`source-documents-cleanup-${subject}`),
    onRebuildSourceProfilePipeline: () => void actions.rebuildSourceProfilePipeline(),
    isSourceProfilePipelineBusy: isActionBusy(`source-profile-pipeline-rebuild-${subject}`),
    onLoadSourceDocumentProfileVisualization: (documentId) => void actions.loadSourceDocumentProfileVisualization(documentId),
    isSourceDocumentVisualizationBusy: (documentId) => isActionBusy(`source-document-visualization-${documentId}`),
    onRefreshSourceReference,
    styleProfiles: data.styleProfiles,
    examSeriesProfiles: data.examSeriesProfiles,
    generationProfiles: data.generationProfiles,
    approvedQuestionCount: data.sourceReferenceSummary.autoApprovedQuestionCount ?? 0,
    onGenerateExamSeriesProfile: () => void actions.generateCurrentExamSeriesProfile(),
    onGenerateGenerationProfiles: () => void actions.generateCurrentGenerationProfiles(),
    onRefreshQuestionVersionGovernance: () => void actions.refreshQuestionVersionGovernance(),
    onActivateExamSeriesProfile: (profileId) => void actions.activateExamSeriesProfile(profileId),
    onActivateGenerationProfile: (profileId) => void actions.activateGenerationProfile(profileId),
    isExamSeriesProfileBusy: isActionBusy(`exam-series-profile-${subject}`),
    isGenerationProfileBusy: isActionBusy(`generation-profile-${subject}`),
    isQuestionVersionGovernanceBusy: isActionBusy(`question-version-governance-${subject}`),
    isExamSeriesProfileActivateBusy: (profileId) => isActionBusy(`exam-series-profile-activate-${profileId}`),
    isGenerationProfileActivateBusy: (profileId) => isActionBusy(`generation-profile-activate-${profileId}`),
    documents: data.sourceDocuments,
    sourceQuestions: data.sourceQuestions,
    sourceQuestionsTotal: data.sourceQuestionsTotal,
    sourceTopicTasks: data.sourceTopicTasks,
    page: sourceReference.page,
    pageSize: sourceQuestionPageSize,
    pageStart: sourceReference.pageStart,
    pageEnd: sourceReference.pageEnd,
    canGoPrevious: sourceReference.canGoPrevious,
    canGoNext: sourceReference.canGoNext,
    sourceQuestionDocumentId: sourceReference.documentId,
    sourceQuestionReviewStatus: sourceReference.reviewStatus,
    sourceReferenceControlsBusy,
    isActionBusy,
    onDocumentChange: sourceReference.setDocumentId,
    onReviewStatusChange: sourceReference.setReviewStatus,
    onStartAutoProfile: () => void actions.startAutoProfileSourceQuestions(),
    onRetryAutoProfile: () => void actions.retryAutoProfileSourceQuestions(),
    onAutoMapAndApprove: () => void actions.autoMapAndApproveSourceQuestionsForProfile(),
    onPreviousPage: () => sourceReference.setPage((value) => Math.max(0, value - 1)),
    onNextPage: () => sourceReference.setPage((value) => value + 1)
  };
}
