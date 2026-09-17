import type {
  AdminAIQuestioningQualityGovernance,
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type {
  QualityBulkAction,
  QualityCalibrationSummary,
  QualityMetricDisposition,
  QualityReplacementSummary,
  QualityWorkspaceProps
} from './QualityWorkspace';
import type { AdminRunAction } from './types';

type BuildQualityWorkspacePropsParams = {
  governance: AdminAIQuestioningQualityGovernance;
  trend: AdminAIQuestioningQualityTrend;
  metrics: AdminAIQuestioningQualityMetric[];
  calibration: QualityCalibrationSummary;
  replacementSummary: QualityReplacementSummary;
  questionById: Map<number, AdminAIQuestioningQuestion>;
  controlsBusy: boolean;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  refreshQuality: () => Promise<unknown>;
  runQualityBulk: (action: QualityBulkAction, label: string) => Promise<void>;
  exportQualityMetrics: (extension: 'csv' | 'json') => void;
  sendToReview: (questionId: number) => Promise<unknown>;
  resolveQuality: (questionId: number) => Promise<unknown>;
  runQualityDisposition: (
    questionId: number,
    disposition: QualityMetricDisposition,
    label: string
  ) => Promise<void>;
};

export function buildQualityWorkspaceProps({
  governance,
  trend,
  metrics,
  calibration,
  replacementSummary,
  questionById,
  controlsBusy,
  isActionBusy,
  runAction,
  refreshQuality,
  runQualityBulk,
  exportQualityMetrics,
  sendToReview,
  resolveQuality,
  runQualityDisposition
}: BuildQualityWorkspacePropsParams): QualityWorkspaceProps {
  return {
    governance,
    trend,
    metricsCount: metrics.length,
    calibration,
    replacementSummary,
    questionById,
    controlsBusy,
    isActionBusy,
    runAction,
    onRefreshQuality: refreshQuality,
    onBulkQuality: runQualityBulk,
    onExportQualityMetrics: exportQualityMetrics,
    metrics,
    onSendToReview: sendToReview,
    onResolve: resolveQuality,
    onApplyDisposition: runQualityDisposition
  };
}
