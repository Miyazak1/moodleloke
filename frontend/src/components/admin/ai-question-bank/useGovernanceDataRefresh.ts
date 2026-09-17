import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  getAdminAIQuestioningMisconceptions,
  getAdminAIQuestioningQuality,
  getAdminAIQuestioningQualityGovernance,
  getAdminAIQuestioningQualityTrend,
  getAdminAIQuestioningRemediation
} from '../../../lib/api-admin';
import { compactError, formatSettledFailureMessage, isFulfilled, summarizeSettledFailures } from './pageUtils';
import type { QuestionBankState, QuestionBankUseCase } from './types';

type UseGovernanceDataRefreshOptions = {
  isAdmin: boolean;
  subject: string;
  useCase: QuestionBankUseCase;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setError: (value: string | null) => void;
};

export function useGovernanceDataRefresh({
  isAdmin,
  subject,
  useCase,
  setData,
  setError
}: UseGovernanceDataRefreshOptions) {
  const requestSeqRef = useRef(0);

  return useCallback(async (options: { includeRemediation?: boolean } = {}) => {
    if (!isAdmin) return;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const includeRemediation = options.includeRemediation ?? useCase === 'subject_practice';
    const requests = [
      getAdminAIQuestioningQualityGovernance({ subject: subject || undefined, useCase }),
      getAdminAIQuestioningQuality({ subject: subject || undefined, useCase, limit: 20 }),
      getAdminAIQuestioningQualityTrend({ subject: subject || undefined, useCase, days: 14 }),
      includeRemediation
        ? getAdminAIQuestioningRemediation({ subject: subject || undefined })
        : Promise.resolve(null),
      includeRemediation
        ? getAdminAIQuestioningMisconceptions({ subject: subject || undefined, limit: 12 })
        : Promise.resolve(null)
    ] as const;

    try {
      const [
        qualityGovernanceResult,
        qualityMetricsResult,
        qualityTrendResult,
        remediationResult,
        misconceptionsResult
      ] = await Promise.allSettled(requests);
      if (requestSeq !== requestSeqRef.current) return;
      setData((current) => ({
        ...current,
        qualityGovernance: isFulfilled(qualityGovernanceResult) ? qualityGovernanceResult.value : current.qualityGovernance,
        qualityMetrics: isFulfilled(qualityMetricsResult) ? qualityMetricsResult.value : current.qualityMetrics,
        qualityTrend: isFulfilled(qualityTrendResult) ? qualityTrendResult.value : current.qualityTrend,
        remediation: isFulfilled(remediationResult) && remediationResult.value ? remediationResult.value : current.remediation,
        misconceptions: isFulfilled(misconceptionsResult) && misconceptionsResult.value ? misconceptionsResult.value : current.misconceptions
      }));
      const failureSummary = summarizeSettledFailures(
        [qualityGovernanceResult, qualityMetricsResult, qualityTrendResult, remediationResult, misconceptionsResult],
        ['质量治理', '质量指标', '质量趋势', '错因补救', '错因标签']
      );
      setError(formatSettledFailureMessage(failureSummary, {
        scope: '质量与错因治理',
        retryHint: '可稍后进入当前板块刷新重试。'
      }));
    } catch (nextError) {
      if (requestSeq !== requestSeqRef.current) return;
      setError(`质量与错因治理局部刷新失败：${compactError(nextError)}`);
    }
  }, [isAdmin, setData, setError, subject, useCase]);
}
