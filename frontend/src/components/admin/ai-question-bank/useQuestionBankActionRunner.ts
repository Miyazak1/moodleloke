import { useCallback, useState } from 'react';
import type { AdminRunAction } from './types';
import { compactError } from './pageUtils';

export function useQuestionBankActionRunner() {
  const [busyActions, setBusyActions] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const requestRefresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const isActionBusy = useCallback((actionId: string) => busyActions.has(actionId), [busyActions]);

  const runAction: AdminRunAction = useCallback(async (actionId, label, action, options) => {
    setBusyActions((current) => new Set(current).add(actionId));
    setFeedback(null);
    setError(null);
    try {
      const result = await action();
      if (options?.refresh === false) {
        setFeedback(typeof result === 'string' ? result : `${label} 已完成。`);
        return;
      }
      try {
        if (typeof options?.refresh === 'function') {
          await options.refresh();
        } else {
          requestRefresh();
        }
      } catch (refreshError) {
        setFeedback(`${typeof result === 'string' ? result : `${label} 已完成。`} 数据刷新暂时失败：${compactError(refreshError)}`);
        return;
      }
      setFeedback(typeof result === 'string' ? result : `${label} 已完成。`);
    } catch (nextError) {
      setError(`${label} 失败：${compactError(nextError)}`);
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }, [requestRefresh]);

  return {
    busyActions,
    setBusyActions,
    error,
    setError,
    feedback,
    setFeedback,
    refreshNonce,
    requestRefresh,
    isActionBusy,
    runAction
  };
}
