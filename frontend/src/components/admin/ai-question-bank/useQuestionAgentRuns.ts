import { useState, type Dispatch, type SetStateAction } from 'react';
import { getAdminAIQuestioningQuestionAgentRuns } from '../../../lib/api-admin';
import type { AdminAIQuestioningAgentRun } from '../../../lib/api-types';
import { compactError } from './pageUtils';

type UseQuestionAgentRunsOptions = {
  setBusyActions: Dispatch<SetStateAction<Set<string>>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useQuestionAgentRuns({
  setBusyActions,
  setError
}: UseQuestionAgentRunsOptions) {
  const [questionAgentRuns, setQuestionAgentRuns] = useState<Record<number, AdminAIQuestioningAgentRun[]>>({});

  async function loadQuestionAgentRuns(questionId: number, force = false) {
    if (!force && questionAgentRuns[questionId]) return;
    const actionId = `agent-runs-${questionId}`;
    setBusyActions((current) => new Set(current).add(actionId));
    setError(null);
    try {
      const result = await getAdminAIQuestioningQuestionAgentRuns(questionId);
      setQuestionAgentRuns((current) => ({
        ...current,
        [questionId]: result.items
      }));
    } catch (nextError) {
      setError(`加载 Q${questionId} Agent 运行记录失败：${compactError(nextError)}`);
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  return {
    questionAgentRuns,
    loadQuestionAgentRuns
  };
}
