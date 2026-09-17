import type { Dispatch, SetStateAction } from 'react';
import type {
  AdminAIQuestioningAgentRun,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type { CandidateReviewPanelProps } from './CandidateReviewPanel';
import type { CandidateBulkProgress, BulkApproveScope } from './candidateBulkActions';
import {
  canBulkApproveCandidate,
  canRejectCandidate,
  canReviewCandidate
} from './candidateReviewHelpers';
import type { QuestionEditDraft } from './types';

type CandidateBulkActions = {
  runAllFiltered: (action: 'approve', label: string) => Promise<void>;
  runSelected: (action: 'review' | 'approve' | 'reject', label: string) => Promise<void>;
};

type CandidateQuestionActions = {
  editingQuestionId: number | null;
  editingDraft: QuestionEditDraft | null;
  review: (item: AdminAIQuestioningQuestion, actionId: string) => Promise<void>;
  openEditor: (item: AdminAIQuestioningQuestion) => void;
  approve: (item: AdminAIQuestioningQuestion, actionId: string) => Promise<void>;
  reject: (item: AdminAIQuestioningQuestion, actionId: string) => Promise<void>;
  archive: (item: AdminAIQuestioningQuestion, actionId: string) => Promise<void>;
  deleteGenerated: (item: AdminAIQuestioningQuestion, actionId: string) => Promise<void>;
  renderEditor: CandidateReviewPanelProps['renderEditor'];
};

type CandidateReviewPanelState = {
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageStart: number;
  pageEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  visibleRows: AdminAIQuestioningQuestion[];
  visibleRowIds: number[];
  selectedIds: Set<number>;
  selectedCount: number;
  selectedPublishableCount: number;
  selectedApproveBlockedCount: number;
  selectedReviewFailedCount: number;
  allVisibleRowsSelected: boolean;
  bulkApproveScope: BulkApproveScope;
  setBulkApproveScope: (scope: BulkApproveScope) => void;
  selectVisibleRows: () => void;
  clearSelection: () => void;
  toggleCandidate: (id: number) => void;
  toggleVisibleRows: () => void;
};

type BuildCandidateReviewPanelPropsParams = {
  workflowLabel?: string;
  destinationLabel?: string;
  approveVerb?: string;
  governanceMode?: boolean;
  total: number;
  subject: string;
  status: string;
  filterControls?: CandidateReviewPanelProps['filterControls'];
  filterSummary?: string;
  pageSize: number;
  controlsBusy: boolean;
  refreshBusy: boolean;
  bulkProgress: CandidateBulkProgress | null;
  candidateReview: CandidateReviewPanelState;
  candidateBulkActions: CandidateBulkActions;
  candidateQuestionActions: CandidateQuestionActions;
  questionAgentRuns: Record<number, AdminAIQuestioningAgentRun[]>;
  isActionBusy: (id: string) => boolean;
  onRefresh: () => void;
  loadQuestionAgentRuns: (questionId: number, hasRuns: boolean) => Promise<void>;
  exportCandidateQueue: (format: 'csv' | 'json') => void;
};

export function buildCandidateReviewPanelProps({
  workflowLabel,
  destinationLabel,
  approveVerb,
  governanceMode,
  total,
  subject,
  status,
  filterControls,
  filterSummary,
  pageSize,
  controlsBusy,
  refreshBusy,
  bulkProgress,
  candidateReview,
  candidateBulkActions,
  candidateQuestionActions,
  questionAgentRuns,
  isActionBusy,
  onRefresh,
  loadQuestionAgentRuns,
  exportCandidateQueue
}: BuildCandidateReviewPanelPropsParams): CandidateReviewPanelProps {
  return {
    workflowLabel,
    destinationLabel,
    approveVerb,
    governanceMode,
    total,
    subject,
    currentStatus: status,
    filterControls,
    filterSummary,
    pageLabel: `第 ${candidateReview.page + 1} 页 · ${candidateReview.pageStart}-${candidateReview.pageEnd} / ${total}`,
    pageIndex: candidateReview.page,
    pageStart: candidateReview.pageStart,
    pageEnd: candidateReview.pageEnd,
    pageSize,
    rows: candidateReview.visibleRows,
    selectedCandidateIds: candidateReview.selectedIds,
    selectedCount: candidateReview.visibleRowIds.filter((id) => candidateReview.selectedIds.has(id)).length,
    totalSelectedCount: candidateReview.selectedCount,
    selectedReviewableCount: candidateReview.visibleRows.filter((question) => (
      candidateReview.selectedIds.has(question.id) && canReviewCandidate(question)
    )).length,
    selectedPublishableCount: candidateReview.visibleRows.filter((question) => (
      candidateReview.selectedIds.has(question.id) && canBulkApproveCandidate(question, candidateReview.bulkApproveScope)
    )).length,
    selectedRejectableCount: candidateReview.visibleRows.filter((question) => (
      candidateReview.selectedIds.has(question.id) && canRejectCandidate(question)
    )).length,
    selectedApproveBlockedCount: candidateReview.visibleRows.filter((question) => (
      candidateReview.selectedIds.has(question.id) && !canBulkApproveCandidate(question, candidateReview.bulkApproveScope)
    )).length,
    selectedReviewFailedCount: candidateReview.visibleRows.filter((question) => (
      candidateReview.selectedIds.has(question.id) && question.status === 'review_failed'
    )).length,
    allRowsSelected: candidateReview.allVisibleRowsSelected,
    controlsBusy,
    refreshBusy,
    canGoPrevious: candidateReview.canGoPrevious,
    canGoNext: candidateReview.canGoNext,
    bulkApproveScope: candidateReview.bulkApproveScope,
    bulkProgress,
    editingQuestionId: candidateQuestionActions.editingQuestionId,
    editingDraft: candidateQuestionActions.editingDraft,
    agentRunsByQuestionId: questionAgentRuns,
    isActionBusy,
    onPreviousPage: () => {
      candidateReview.clearSelection();
      candidateReview.setPage((value) => Math.max(0, value - 1));
    },
    onNextPage: () => {
      candidateReview.clearSelection();
      candidateReview.setPage((value) => value + 1);
    },
    onRefresh,
    onScopeChange: candidateReview.setBulkApproveScope,
    onPublishAll: () => void candidateBulkActions.runAllFiltered('approve', '通过全部可入库题'),
    onSelectPage: candidateReview.selectVisibleRows,
    onClearSelection: candidateReview.clearSelection,
    onBulkReview: () => void candidateBulkActions.runSelected('review', '批量复审'),
    onBulkApprove: () => void candidateBulkActions.runSelected('approve', '批量通过并发布'),
    onBulkReject: () => void candidateBulkActions.runSelected('reject', '批量拒绝'),
    onExportCsv: () => exportCandidateQueue('csv'),
    onExportJson: () => exportCandidateQueue('json'),
    onToggleCandidate: candidateReview.toggleCandidate,
    onToggleVisibleRows: candidateReview.toggleVisibleRows,
    onReview: (item, actionId) => void candidateQuestionActions.review(item, actionId),
    onEdit: candidateQuestionActions.openEditor,
    onApprove: (item, actionId) => void candidateQuestionActions.approve(item, actionId),
    onReject: (item, actionId) => void candidateQuestionActions.reject(item, actionId),
    onArchive: (item, actionId) => void candidateQuestionActions.archive(item, actionId),
    onDeleteGenerated: (item, actionId) => void candidateQuestionActions.deleteGenerated(item, actionId),
    onLoadAgentRuns: (item, hasRuns) => void loadQuestionAgentRuns(item.id, hasRuns),
    renderEditor: candidateQuestionActions.renderEditor
  };
}
