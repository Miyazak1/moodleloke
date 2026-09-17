import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  getAdminAIQuestioningSourceReferenceSummary,
  listAdminAIQuestioningSourceAutoProfileTasks,
  listAdminAIQuestioningSourceDocuments,
  listAdminAIQuestioningSourceQuestions,
  listAdminAIQuestioningSourceTopicTasks,
  listAdminAIQuestioningExamSeriesProfiles,
  listAdminAIQuestioningGenerationProfiles,
  listAdminAIQuestioningStyleProfiles,
  listAdminAIQuestioningTopicOptions
} from '../../../lib/api-admin';
import { SOURCE_QUESTION_PAGE_SIZE } from './questionBankConfig';
import { compactError, formatSettledFailureMessage, isFulfilled, summarizeSettledFailures } from './pageUtils';
import type { QuestionBankState } from './types';

type SourceReferenceRefreshOverrides = {
  documentId?: number | null;
  reviewStatus?: string;
  page?: number;
};

type UseSourceReferenceDataRefreshOptions = {
  isAdmin: boolean;
  subject: string;
  sourceQuestionDocumentId: number | null;
  sourceQuestionReviewStatus: string;
  sourceQuestionPage: number;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setError: (value: string | null) => void;
};

export function useSourceReferenceDataRefresh({
  isAdmin,
  subject,
  sourceQuestionDocumentId,
  sourceQuestionReviewStatus,
  sourceQuestionPage,
  setData,
  setError
}: UseSourceReferenceDataRefreshOptions) {
  const requestSeqRef = useRef(0);

  return useCallback((overrides: SourceReferenceRefreshOverrides = {}) => {
    if (!isAdmin) return;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const documentId = Object.prototype.hasOwnProperty.call(overrides, 'documentId')
      ? overrides.documentId
      : sourceQuestionDocumentId;
    const reviewStatus = Object.prototype.hasOwnProperty.call(overrides, 'reviewStatus')
      ? overrides.reviewStatus
      : sourceQuestionReviewStatus;
    const nextPage = Object.prototype.hasOwnProperty.call(overrides, 'page')
      ? overrides.page ?? 0
      : sourceQuestionPage;
    const requests = [
      getAdminAIQuestioningSourceReferenceSummary({ subject: subject || undefined, syllabusVersion: '2025', refresh: true }),
      listAdminAIQuestioningSourceDocuments({ subject: subject || undefined, status: 'active', limit: 50 }),
      listAdminAIQuestioningSourceQuestions({
        subject: subject || undefined,
        documentId: documentId ?? undefined,
        reviewStatus: reviewStatus || undefined,
        limit: SOURCE_QUESTION_PAGE_SIZE,
        offset: nextPage * SOURCE_QUESTION_PAGE_SIZE
      }),
      listAdminAIQuestioningSourceAutoProfileTasks({ subject: subject || undefined, limit: 8 }),
      listAdminAIQuestioningSourceTopicTasks({ subject: subject || undefined, limit: 8 }),
      listAdminAIQuestioningStyleProfiles({ subject: subject || undefined, status: 'active', limit: 12 }),
      listAdminAIQuestioningExamSeriesProfiles({ subject: subject || undefined, limit: 12 }),
      listAdminAIQuestioningGenerationProfiles({ subject: subject || undefined, limit: 12 }),
      listAdminAIQuestioningTopicOptions({ subject: subject || undefined, status: 'published', syllabusVersion: '2025', limit: 160 })
    ] as const;

    void Promise.allSettled(requests)
      .then(([summaryResult, documentsResult, questionsResult, sourceAutoProfileTasksResult, sourceTopicTasksResult, profilesResult, seriesProfilesResult, generationProfilesResult, topicOptionsResult]) => {
        if (requestSeq !== requestSeqRef.current) return;
        setData((current) => ({
          ...current,
          sourceReferenceSummary: isFulfilled(summaryResult) ? summaryResult.value.summary : current.sourceReferenceSummary,
          sourceDocuments: isFulfilled(documentsResult) ? documentsResult.value.items : current.sourceDocuments,
          sourceQuestions: isFulfilled(questionsResult) ? questionsResult.value.items : current.sourceQuestions,
          sourceQuestionsTotal: isFulfilled(questionsResult) ? questionsResult.value.total : current.sourceQuestionsTotal,
          sourceAutoProfileTasks: isFulfilled(sourceAutoProfileTasksResult) ? sourceAutoProfileTasksResult.value.items : current.sourceAutoProfileTasks,
          sourceTopicTasks: isFulfilled(sourceTopicTasksResult) ? sourceTopicTasksResult.value.items : current.sourceTopicTasks,
          styleProfiles: isFulfilled(profilesResult) ? profilesResult.value.items : current.styleProfiles,
          examSeriesProfiles: isFulfilled(seriesProfilesResult) ? seriesProfilesResult.value.items : current.examSeriesProfiles,
          generationProfiles: isFulfilled(generationProfilesResult) ? generationProfilesResult.value.items : current.generationProfiles,
          topicOptions: isFulfilled(topicOptionsResult) ? topicOptionsResult.value.items : current.topicOptions
        }));
        const failureSummary = summarizeSettledFailures(
          [summaryResult, documentsResult, questionsResult, sourceAutoProfileTasksResult, sourceTopicTasksResult, profilesResult, seriesProfilesResult, generationProfilesResult, topicOptionsResult],
          ['真题画像摘要', '真题文档', '真题样本', '自动画像任务', '真题映射任务', '单卷画像', '连续趋势画像', '当前出题画像', '知识点选项']
        );
        setError(formatSettledFailureMessage(failureSummary, {
          scope: '真题画像',
          retryHint: '可稍后点刷新重试。'
        }));
      })
      .catch((nextError) => {
        if (requestSeq !== requestSeqRef.current) return;
        setError(`真题画像局部刷新失败：${compactError(nextError)}`);
      });
  }, [
    isAdmin,
    setData,
    setError,
    sourceQuestionDocumentId,
    sourceQuestionPage,
    sourceQuestionReviewStatus,
    subject
  ]);
}
