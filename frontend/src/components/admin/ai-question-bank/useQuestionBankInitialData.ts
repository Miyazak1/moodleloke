import { useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  getAdminAIQuestioningBlueprintCoverage,
  getAdminAIQuestioningGenerationQueueHealth,
  getAdminAIQuestioningSourceReferenceSummary,
  getAdminAIQuestioningTopicHealth
} from '../../../lib/api-admin';
import { GENERATION_QUEUE_HEALTH_LIMIT, INITIAL_TOPIC_HEALTH_LIMIT } from './questionBankConfig';
import { compactError, formatSettledFailureMessage, isFulfilled, summarizeSettledFailures } from './pageUtils';
import type { QuestionBankState } from './types';
import type { QuestionBankUseCase } from './types';

type UseQuestionBankInitialDataOptions = {
  isAdmin: boolean;
  subject: string;
  useCase: QuestionBankUseCase;
  refreshNonce: number;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useQuestionBankInitialData({
  isAdmin,
  subject,
  useCase,
  refreshNonce,
  setData,
  setIsLoading,
  setError
}: UseQuestionBankInitialDataOptions) {
  useEffect(() => {
    if (!isAdmin) return;
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    const requestLabels = [
      '蓝图覆盖',
      '知识点健康',
      '生成队列',
      '真题画像摘要'
    ];
    const requests = [
      getAdminAIQuestioningBlueprintCoverage({ subject: subject || undefined }),
      getAdminAIQuestioningTopicHealth({ subject: subject || undefined, limit: INITIAL_TOPIC_HEALTH_LIMIT }),
      getAdminAIQuestioningGenerationQueueHealth({ subject: subject || undefined, useCase, limit: GENERATION_QUEUE_HEALTH_LIMIT }),
      getAdminAIQuestioningSourceReferenceSummary({ subject: subject || undefined, syllabusVersion: '2025' })
    ] as const;
    void Promise.allSettled(requests)
      .then((results) => {
        if (!isCurrent) return;
        const [
          coverageResult,
          topicHealthResult,
          generationQueueResult,
          sourceReferenceSummaryResult
        ] = results;
        setData((current) => ({
          ...current,
          coverage: isFulfilled(coverageResult) ? coverageResult.value : current.coverage,
          topicHealth: isFulfilled(topicHealthResult) ? topicHealthResult.value : current.topicHealth,
          generationQueue: isFulfilled(generationQueueResult) ? generationQueueResult.value : current.generationQueue,
          sourceReferenceSummary: isFulfilled(sourceReferenceSummaryResult) ? sourceReferenceSummaryResult.value.summary : current.sourceReferenceSummary
        }));
        const failureSummary = summarizeSettledFailures(results, requestLabels);
        setError(formatSettledFailureMessage(failureSummary, {
          scope: 'AI 题库管理面板',
          retryHint: '可先处理已加载模块，或稍后刷新。'
        }));
      })
      .catch((nextError) => {
        if (!isCurrent) return;
        setError(compactError(nextError));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [
    isAdmin,
    refreshNonce,
    setData,
    setError,
    setIsLoading,
    subject,
    useCase
  ]);
}
