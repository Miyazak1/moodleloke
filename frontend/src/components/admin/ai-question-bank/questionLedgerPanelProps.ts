import type { Dispatch, SetStateAction } from 'react';
import type { AdminAIQuestioningQuestionLedgerItem } from '../../../lib/api-types';
import type { LedgerPanelProps } from './LedgerPanel';
import type { PublishedQuestionPanelProps } from './PublishedQuestionPanel';
import type { AdminRunAction } from './types';

type PaginationView = {
  pageStart: number;
  pageEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

type BuildPublishedQuestionPanelPropsParams = {
  workflowLabel?: string;
  destinationLabel?: string;
  items: AdminAIQuestioningQuestionLedgerItem[];
  total: number;
  pageSize: number;
  pagination: PaginationView;
  isLoading: boolean;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  setPage: Dispatch<SetStateAction<number>>;
  reviewQuestion: (questionId: number) => Promise<unknown>;
  confirmSyllabusQuestion: (questionId: number) => Promise<unknown>;
  archiveQuestion: (questionId: number) => Promise<unknown>;
  deleteGeneratedQuestion: (questionId: number) => Promise<unknown>;
};

type BuildLedgerPanelPropsParams = {
  workflowLabel?: string;
  items: AdminAIQuestioningQuestionLedgerItem[];
  total: number;
  pageSize: number;
  pagination: PaginationView;
  isLoading: boolean;
  setPage: Dispatch<SetStateAction<number>>;
};

function previousPage(setPage: Dispatch<SetStateAction<number>>) {
  setPage((value) => Math.max(0, value - 1));
}

function nextPage(setPage: Dispatch<SetStateAction<number>>) {
  setPage((value) => value + 1);
}

export function buildPublishedQuestionPanelProps({
  workflowLabel,
  destinationLabel,
  items,
  total,
  pageSize,
  pagination,
  isLoading,
  isActionBusy,
  runAction,
  setPage,
  reviewQuestion,
  confirmSyllabusQuestion,
  archiveQuestion,
  deleteGeneratedQuestion
}: BuildPublishedQuestionPanelPropsParams): PublishedQuestionPanelProps {
  return {
    workflowLabel,
    destinationLabel,
    items,
    total,
    pageSize,
    pageStart: pagination.pageStart,
    pageEnd: pagination.pageEnd,
    isLoading,
    canGoPrevious: pagination.canGoPrevious,
    canGoNext: pagination.canGoNext,
    isActionBusy,
    runAction,
    onPreviousPage: () => previousPage(setPage),
    onNextPage: () => nextPage(setPage),
    onReviewQuestion: reviewQuestion,
    onConfirmSyllabusQuestion: confirmSyllabusQuestion,
    onArchiveQuestion: archiveQuestion,
    onDeleteGeneratedQuestion: deleteGeneratedQuestion
  };
}

export function buildLedgerPanelProps({
  workflowLabel,
  items,
  total,
  pageSize,
  pagination,
  isLoading,
  setPage
}: BuildLedgerPanelPropsParams): LedgerPanelProps {
  return {
    workflowLabel,
    items,
    total,
    pageSize,
    pageStart: pagination.pageStart,
    pageEnd: pagination.pageEnd,
    isLoading,
    canGoPrevious: pagination.canGoPrevious,
    canGoNext: pagination.canGoNext,
    onPreviousPage: () => previousPage(setPage),
    onNextPage: () => nextPage(setPage)
  };
}
