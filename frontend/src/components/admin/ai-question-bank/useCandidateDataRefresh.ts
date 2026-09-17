import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  getAdminAIQuestioningQuestionLedger,
  getAdminAIQuestioningQuestions,
  listAdminAIQuestioningCandidateBulkTasks
} from '../../../lib/api-admin';
import { candidateQuestionQueryFilter } from './candidateQueueFilters';
import { CANDIDATE_PAGE_SIZE, PAGE_SIZE } from './questionBankConfig';
import { compactError, formatSettledFailureMessage, isFulfilled, summarizeSettledFailures } from './pageUtils';
import type { QuestionBankState } from './types';
import type { QuestionBankUseCase } from './types';

type CandidateDataRefreshOptions = {
  candidatePage?: number;
  includeCandidates?: boolean;
  includeBulkTasks?: boolean;
  includePublishedLedger?: boolean;
  includeLedger?: boolean;
};

type UseCandidateDataRefreshOptions = {
  isAdmin: boolean;
  subject: string;
  status: string;
  useCase: QuestionBankUseCase;
  mockExamBlueprintId?: number;
  mockExamSourcePaperId?: number;
  candidateSubject?: string;
  candidateStatus?: string;
  candidateUseCase?: QuestionBankUseCase;
  candidateMockExamBlueprintId?: number;
  candidateMockExamSourcePaperId?: number;
  candidateRequiresMockExamScope?: boolean;
  candidatePage: number;
  publishedPage: number;
  ledgerPage: number;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setError: (value: string | null) => void;
  pruneSelectionToIds: (ids: number[]) => void;
};

export function useCandidateDataRefresh({
  isAdmin,
  subject,
  status,
  useCase,
  mockExamBlueprintId,
  mockExamSourcePaperId,
  candidateSubject,
  candidateStatus,
  candidateUseCase,
  candidateMockExamBlueprintId,
  candidateMockExamSourcePaperId,
  candidateRequiresMockExamScope,
  candidatePage,
  publishedPage,
  ledgerPage,
  setData,
  setError,
  pruneSelectionToIds
}: UseCandidateDataRefreshOptions) {
  const requestSeqRef = useRef({
    candidates: 0,
    candidateBulkTasks: 0,
    publishedLedger: 0,
    ledger: 0
  });

  return useCallback(async (options?: CandidateDataRefreshOptions) => {
    if (!isAdmin) return;
    const nextCandidatePage = options?.candidatePage ?? candidatePage;
    const includeCandidates = options?.includeCandidates ?? true;
    const includeBulkTasks = options?.includeBulkTasks ?? true;
    const includePublishedLedger = options?.includePublishedLedger ?? true;
    const includeLedger = options?.includeLedger ?? true;
    const requestSeq = {
      candidates: includeCandidates ? requestSeqRef.current.candidates + 1 : requestSeqRef.current.candidates,
      candidateBulkTasks: includeBulkTasks ? requestSeqRef.current.candidateBulkTasks + 1 : requestSeqRef.current.candidateBulkTasks,
      publishedLedger: includePublishedLedger ? requestSeqRef.current.publishedLedger + 1 : requestSeqRef.current.publishedLedger,
      ledger: includeLedger ? requestSeqRef.current.ledger + 1 : requestSeqRef.current.ledger
    };
    requestSeqRef.current = requestSeq;
    const hasMockExamScope = useCase !== 'online_mock_exam' || Boolean(mockExamBlueprintId || mockExamSourcePaperId);
    const effectiveCandidateSubject = candidateSubject ?? subject;
    const effectiveCandidateStatus = candidateStatus ?? status;
    const effectiveCandidateUseCase = candidateUseCase ?? useCase;
    const effectiveCandidateMockExamBlueprintId = candidateMockExamBlueprintId ?? mockExamBlueprintId;
    const effectiveCandidateMockExamSourcePaperId = candidateMockExamSourcePaperId ?? mockExamSourcePaperId;
    const candidateHasQueryableScope = !candidateRequiresMockExamScope
      || effectiveCandidateUseCase !== 'online_mock_exam'
      || Boolean(effectiveCandidateMockExamBlueprintId || effectiveCandidateMockExamSourcePaperId);
    const candidateFilter = candidateQuestionQueryFilter(effectiveCandidateStatus);
    const shouldLoadCandidates = includeCandidates && candidateHasQueryableScope && candidateFilter.shouldLoad;
    const emptyQuestionsResult = { items: [], total: 0, limit: CANDIDATE_PAGE_SIZE, offset: nextCandidatePage * CANDIDATE_PAGE_SIZE };
    const skippedQuestionsResult = null as typeof emptyQuestionsResult | null;
    const emptyLedgerResult = { items: [], total: 0, limit: PAGE_SIZE, offset: 0 };
    const skippedLedgerResult = null as typeof emptyLedgerResult | null;
    const emptyBulkTasksResult = { items: [] };
    const skippedBulkTasksResult = null as typeof emptyBulkTasksResult | null;
    const requests = [
      shouldLoadCandidates ? getAdminAIQuestioningQuestions({
        subject: effectiveCandidateSubject || undefined,
        status: candidateFilter.status,
        queue: candidateFilter.queue,
        useCase: effectiveCandidateUseCase,
        mockExamBlueprintId: effectiveCandidateMockExamBlueprintId,
        mockExamSourcePaperId: effectiveCandidateMockExamSourcePaperId,
        view: 'list',
        limit: CANDIDATE_PAGE_SIZE,
        offset: nextCandidatePage * CANDIDATE_PAGE_SIZE
      }) : Promise.resolve(includeCandidates ? emptyQuestionsResult : skippedQuestionsResult),
      includeBulkTasks && candidateHasQueryableScope ? listAdminAIQuestioningCandidateBulkTasks({
        subject: effectiveCandidateSubject || undefined,
        useCase: effectiveCandidateUseCase,
        mockExamBlueprintId: effectiveCandidateMockExamBlueprintId,
        mockExamSourcePaperId: effectiveCandidateMockExamSourcePaperId,
        limit: 8
      }) : Promise.resolve(includeBulkTasks ? emptyBulkTasksResult : skippedBulkTasksResult),
      includePublishedLedger && hasMockExamScope ? getAdminAIQuestioningQuestionLedger({
        subject: subject || undefined,
        status: 'approved',
        useCase,
        mockExamBlueprintId,
        mockExamSourcePaperId,
        readyOnly: true,
        view: 'list',
        limit: PAGE_SIZE,
        offset: publishedPage * PAGE_SIZE
      }) : Promise.resolve(includePublishedLedger ? emptyLedgerResult : skippedLedgerResult),
      includeLedger && hasMockExamScope ? getAdminAIQuestioningQuestionLedger({
        subject: subject || undefined,
        status: status && status !== 'fallback' ? status : undefined,
        useCase,
        mockExamBlueprintId,
        mockExamSourcePaperId,
        view: 'list',
        limit: PAGE_SIZE,
        offset: ledgerPage * PAGE_SIZE
      }) : Promise.resolve(includeLedger ? emptyLedgerResult : skippedLedgerResult)
    ] as const;

    try {
      const [candidatesResult, candidateBulkTasksResult, publishedLedgerResult, ledgerResult] = await Promise.allSettled(requests);
      const isCurrent = requestSeqRef.current;
      setData((current) => ({
        ...current,
        candidates: includeCandidates && requestSeq.candidates === isCurrent.candidates && isFulfilled(candidatesResult) && candidatesResult.value ? candidatesResult.value.items : current.candidates,
        candidatesTotal: includeCandidates && requestSeq.candidates === isCurrent.candidates && isFulfilled(candidatesResult) && candidatesResult.value ? candidatesResult.value.total : current.candidatesTotal,
        candidateBulkTasks: includeBulkTasks && requestSeq.candidateBulkTasks === isCurrent.candidateBulkTasks && isFulfilled(candidateBulkTasksResult) && candidateBulkTasksResult.value ? candidateBulkTasksResult.value.items : current.candidateBulkTasks,
        publishedItems: includePublishedLedger && requestSeq.publishedLedger === isCurrent.publishedLedger && isFulfilled(publishedLedgerResult) && publishedLedgerResult.value ? publishedLedgerResult.value.items : current.publishedItems,
        publishedTotal: includePublishedLedger && requestSeq.publishedLedger === isCurrent.publishedLedger && isFulfilled(publishedLedgerResult) && publishedLedgerResult.value ? publishedLedgerResult.value.total : current.publishedTotal,
        ledgerItems: includeLedger && requestSeq.ledger === isCurrent.ledger && isFulfilled(ledgerResult) && ledgerResult.value ? ledgerResult.value.items : current.ledgerItems,
        ledgerTotal: includeLedger && requestSeq.ledger === isCurrent.ledger && isFulfilled(ledgerResult) && ledgerResult.value ? ledgerResult.value.total : current.ledgerTotal
      }));
      if (includeCandidates && requestSeq.candidates === requestSeqRef.current.candidates && isFulfilled(candidatesResult) && candidatesResult.value) {
        pruneSelectionToIds(candidatesResult.value.items.map((item) => item.id));
      }
      const failureSummary = summarizeSettledFailures(
        [candidatesResult, candidateBulkTasksResult, publishedLedgerResult, ledgerResult],
        ['候选审核', '候选批量任务', '已审核题库', '题库台账']
      );
      setError(formatSettledFailureMessage(failureSummary, {
        scope: '题库列表',
        retryHint: '可稍后点刷新重试。'
      }));
    } catch (nextError) {
      if (requestSeq !== requestSeqRef.current) return;
      setError(`局部刷新失败：${compactError(nextError)}`);
    }
  }, [
    candidatePage,
    candidateMockExamBlueprintId,
    candidateMockExamSourcePaperId,
    candidateRequiresMockExamScope,
    candidateStatus,
    candidateSubject,
    candidateUseCase,
    isAdmin,
    ledgerPage,
    mockExamBlueprintId,
    mockExamSourcePaperId,
    pruneSelectionToIds,
    publishedPage,
    setData,
    setError,
    status,
    subject,
    useCase
  ]);
}
