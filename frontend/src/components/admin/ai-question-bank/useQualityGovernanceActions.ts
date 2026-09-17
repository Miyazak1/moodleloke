import {
  applyAdminAIQuestioningQualityDisposition,
  bulkAdminAIQuestioningQuality
} from '../../../lib/api-admin';
import type { AdminRunAction, QuestionBankUseCase } from './types';

export type QualityGovernanceBulkAction =
  | 'send_to_review'
  | 'resolve'
  | 'archive'
  | 'manual_fix'
  | 'reduce_exposure'
  | 'regenerate';

export type QualityGovernanceDisposition =
  | 'archive'
  | 'manual_fix'
  | 'reduce_exposure'
  | 'regenerate';

type UseQualityGovernanceActionsOptions = {
  subject: string;
  useCase: QuestionBankUseCase;
  runAction: AdminRunAction;
};

export function useQualityGovernanceActions({ subject, useCase, runAction }: UseQualityGovernanceActionsOptions) {
  function runQualityBulk(action: QualityGovernanceBulkAction, label: string) {
    return runAction(`quality-bulk-${action}`, label, () => bulkAdminAIQuestioningQuality({
      action,
      subject: subject || undefined,
      useCase,
      limit: 20,
      reason: `admin_${action}_from_question_bank`
    }));
  }

  function runQualityDisposition(questionId: number, disposition: QualityGovernanceDisposition, label: string) {
    return runAction(`quality-${disposition}-${questionId}`, label, () => applyAdminAIQuestioningQualityDisposition(questionId, {
      disposition,
      note: `admin_${disposition}_from_question_bank`
    }));
  }

  return {
    runQualityBulk,
    runQualityDisposition
  };
}
