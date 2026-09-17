import { useCallback, useMemo, useState } from 'react';
import type { AdminAIQuestioningQuestion } from '../../../lib/api-types';
import type { BulkApproveScope } from './candidateBulkActions';
import { canBulkApproveCandidate } from './candidateReviewHelpers';
import { candidateUsesFallback } from './questionEvidence';

export function useCandidateReviewState(
  candidates: AdminAIQuestioningQuestion[],
  total: number,
  status: string,
  pageSize: number
) {
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkApproveScope, setBulkApproveScope] = useState<BulkApproveScope>('gate_passed');

  const queue = useMemo(() => {
    const nonFallbackCandidates = candidates.filter((item) => !candidateUsesFallback(item));
    const fallbackCandidates = candidates.filter(candidateUsesFallback);
    const visible = candidates.filter((item) => {
      const isFallback = candidateUsesFallback(item);
      if (status === 'fallback') return isFallback;
      if (isFallback) return false;
      return status ? item.status === status : ['pending_review', 'review_failed'].includes(item.status);
    });
    return {
      visible,
      pending: nonFallbackCandidates.filter((item) => item.status === 'pending_review').length,
      failed: nonFallbackCandidates.filter((item) => item.status === 'review_failed').length,
      approved: nonFallbackCandidates.filter((item) => item.status === 'approved').length,
      fallback: fallbackCandidates.length
    };
  }, [candidates, status]);

  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min(total, page * pageSize + queue.visible.length);
  const canGoPrevious = page > 0;
  const canGoNext = pageEnd < total;
  const visibleRows = queue.visible;
  const visibleRowIds = visibleRows.map((item) => item.id);
  const allVisibleRowsSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;
  const selectedPublishableCount = candidates.filter((question) => (
    selectedIds.has(question.id) && canBulkApproveCandidate(question, bulkApproveScope)
  )).length;
  const selectedApproveBlockedCount = candidates.filter((question) => (
    selectedIds.has(question.id) && !canBulkApproveCandidate(question, bulkApproveScope)
  )).length;
  const selectedReviewFailedCount = candidates.filter((question) => (
    selectedIds.has(question.id) && question.status === 'review_failed'
  )).length;

  function toggleCandidate(questionId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function selectVisibleRows() {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleRowIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleVisibleRows() {
    setSelectedIds((current) => {
      if (allVisibleRowsSelected) {
        const next = new Set(current);
        visibleRowIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...current, ...visibleRowIds]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetForFilterChange() {
    setPage(0);
    clearSelection();
  }

  const pruneSelectionToIds = useCallback((ids: number[]) => {
    setSelectedIds((current) => {
      const visibleIds = new Set(ids);
      const next = new Set<number>();
      current.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, []);

  return {
    queue,
    page,
    setPage,
    pageStart,
    pageEnd,
    canGoPrevious,
    canGoNext,
    visibleRows,
    visibleRowIds,
    selectedIds,
    selectedCount,
    selectedPublishableCount,
    selectedApproveBlockedCount,
    selectedReviewFailedCount,
    allVisibleRowsSelected,
    bulkApproveScope,
    setBulkApproveScope,
    toggleCandidate,
    selectVisibleRows,
    toggleVisibleRows,
    clearSelection,
    resetForFilterChange,
    pruneSelectionToIds
  };
}
