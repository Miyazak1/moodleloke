import { useState } from 'react';

export function useSourceReferenceState(
  sourceQuestions: unknown[],
  total: number,
  pageSize: number
) {
  const [page, setPage] = useState(0);
  const [reviewStatus, setReviewStatus] = useState('');
  const [documentId, setDocumentId] = useState<number | null>(null);

  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min(total, page * pageSize + sourceQuestions.length);
  const canGoPrevious = page > 0;
  const canGoNext = pageEnd < total;

  return {
    page,
    setPage,
    reviewStatus,
    setReviewStatus,
    documentId,
    setDocumentId,
    pageStart,
    pageEnd,
    canGoPrevious,
    canGoNext
  };
}
