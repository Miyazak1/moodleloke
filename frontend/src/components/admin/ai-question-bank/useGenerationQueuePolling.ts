import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { getAdminAIQuestioningGenerationQueueHealth } from '../../../lib/api-admin';
import { GENERATION_QUEUE_HEALTH_LIMIT } from './questionBankConfig';
import type { QuestionBankState } from './types';
import type { QuestionBankUseCase } from './types';
import type { TopicBulkProgress } from './CoverageWorkPanel';

type UseGenerationQueuePollingOptions = {
  isAdmin: boolean;
  subject: string;
  useCase: QuestionBankUseCase;
  queuedCount: number;
  runningCount: number;
  isTopicBulkRunning: boolean;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setTopicBulkProgress?: Dispatch<SetStateAction<TopicBulkProgress | null>>;
  setPollingError?: Dispatch<SetStateAction<string | null>>;
  onQueueSettled?: () => void;
};

function pollingErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return '生成队列状态刷新失败。';
}

export function useGenerationQueuePolling({
  isAdmin,
  subject,
  useCase,
  queuedCount,
  runningCount,
  isTopicBulkRunning,
  setData,
  setTopicBulkProgress,
  setPollingError,
  onQueueSettled
}: UseGenerationQueuePollingOptions) {
  useEffect(() => {
    if (!isAdmin) return;
    const shouldPoll = queuedCount + runningCount > 0 || isTopicBulkRunning;
    if (!shouldPoll) return;
    let isCurrent = true;
    const refreshQueue = () => {
      void getAdminAIQuestioningGenerationQueueHealth({ subject: subject || undefined, useCase, limit: GENERATION_QUEUE_HEALTH_LIMIT })
        .then((generationQueue) => {
          if (!isCurrent) return;
          setPollingError?.(null);
          setData((current) => ({ ...current, generationQueue }));
          const activeCount = generationQueue.summary.queued + generationQueue.summary.running;
          if (activeCount === 0) {
            let clearedAwaitingQueue = false;
            setTopicBulkProgress?.((current) => {
              if (!current?.awaitingQueue) return current;
              clearedAwaitingQueue = true;
              return { ...current, awaitingQueue: false };
            });
            if (clearedAwaitingQueue) onQueueSettled?.();
          }
        })
        .catch((error) => {
          if (!isCurrent) return;
          setPollingError?.(pollingErrorMessage(error));
        });
    };
    const timer = window.setInterval(refreshQueue, 4000);
    refreshQueue();
    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [
    isAdmin,
    isTopicBulkRunning,
    queuedCount,
    runningCount,
    setData,
    setTopicBulkProgress,
    setPollingError,
    onQueueSettled,
    subject,
    useCase
  ]);
}
