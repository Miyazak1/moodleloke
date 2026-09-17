import type { AdminAIQuestioningCandidateBulkTask, AdminAIQuestioningQuestion } from '../../../lib/api-types';
import type { AdminRunAction } from './types';
import type { QuestionBankUseCase } from './types';
import type { BulkApproveScope, CandidateBulkProgress } from './candidateBulkActions';
import {
  bulkQuestionFailureSummary,
  bulkQuestionSuccessCount
} from './candidateBulkActions';
import {
  canArchiveCandidate,
  canBulkApproveCandidate,
  canRejectCandidate,
  canReviewCandidate
} from './candidateReviewHelpers';

type BulkQuestionAction = 'review' | 'approve' | 'reject' | 'archive';

type BulkQuestionsApi = (payload: {
  action: BulkQuestionAction;
  subject?: string;
  status?: string;
  queue?: 'candidate';
  useCase?: QuestionBankUseCase;
  mockExamBlueprintId?: number;
  mockExamSourcePaperId?: number;
  gateScope?: BulkApproveScope;
  limit?: number;
  questionIds?: number[];
  reason?: string;
}) => Promise<{
  action: string;
  requested: number;
  succeeded: number;
  failed: number;
  items: AdminAIQuestioningQuestion[];
  errors: Array<{ id: number; message: string }>;
}>;

type StartBulkTaskApi = (payload: {
  action: BulkQuestionAction;
  subject?: string;
  status?: string;
  queue?: 'candidate';
  useCase?: QuestionBankUseCase;
  mockExamBlueprintId?: number;
  mockExamSourcePaperId?: number;
  gateScope?: BulkApproveScope;
  limit?: number;
  expectedTotal?: number;
  questionIds?: number[];
  reason?: string;
}) => Promise<{ task: AdminAIQuestioningCandidateBulkTask }>;

type UseCandidateBulkActionsParams = {
  candidates: AdminAIQuestioningQuestion[];
  selectedCandidateIds: Set<number>;
  subject: string;
  status: string;
  useCase?: QuestionBankUseCase;
  mockExamBlueprintId?: number;
  mockExamSourcePaperId?: number;
  candidatesTotal: number;
  bulkApproveScope: BulkApproveScope;
  bulkAllLimit: number;
  runAction: AdminRunAction;
  bulkQuestions: BulkQuestionsApi;
  startBulkTask: StartBulkTaskApi;
  setProgress: (progress: CandidateBulkProgress | null) => void;
  onRefresh: () => void | Promise<void>;
};

export function useCandidateBulkActions({
  candidates,
  selectedCandidateIds,
  subject,
  status,
  useCase,
  mockExamBlueprintId,
  mockExamSourcePaperId,
  candidatesTotal,
  bulkApproveScope,
  bulkAllLimit,
  runAction,
  bulkQuestions,
  startBulkTask,
  setProgress,
  onRefresh
}: UseCandidateBulkActionsParams) {
  function canProcessQuestion(question: AdminAIQuestioningQuestion, action: BulkQuestionAction) {
    if (action === 'approve') return canBulkApproveCandidate(question, bulkApproveScope);
    if (action === 'review') return canReviewCandidate(question);
    if (action === 'reject') return canRejectCandidate(question);
    if (action === 'archive') return canArchiveCandidate(question);
    return false;
  }

  function blockedMessage(action: BulkQuestionAction, skipped: number) {
    if (action === 'approve') return `已选题目里没有可入库题：${skipped} 道题被门禁、状态或 fallback 规则拦截。`;
    if (action === 'review') return `已选题目里没有可复审题：${skipped} 道题已经通过、拒绝或归档。`;
    if (action === 'reject') return `已选题目里没有可拒绝题：${skipped} 道题已经通过、拒绝或归档。`;
    return `已选题目里没有可归档题：${skipped} 道题已经归档。`;
  }

  async function processQuestions(
    action: BulkQuestionAction,
    selectedQuestions: AdminAIQuestioningQuestion[]
  ) {
    const skipped = selectedQuestions.filter((question) => !canProcessQuestion(question, action)).length;
    const questionIds = selectedQuestions
      .filter((question) => canProcessQuestion(question, action))
      .map((question) => question.id);

    if (questionIds.length === 0) {
      if (skipped > 0) throw new Error(blockedMessage(action, skipped));
      return null;
    }

    setProgress({
      action,
      total: questionIds.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      skipped,
      currentQuestionId: questionIds[0] ?? null,
      failureMessages: []
    });

    const result = await bulkQuestions({
      action,
      questionIds,
      limit: questionIds.length,
      gateScope: action === 'approve' ? bulkApproveScope : undefined,
      reason: action === 'reject' ? 'admin_bulk_rejected_from_question_bank' : undefined
    });
    const succeeded = bulkQuestionSuccessCount([result]);
    const failed = result.failed ?? 0;

    const failures = bulkQuestionFailureSummary([result]);

    setProgress({
      action,
      total: questionIds.length,
      completed: Math.min(questionIds.length, succeeded + failed),
      succeeded,
      failed,
      skipped,
      currentQuestionId: null,
      failureMessages: failures
    });

    if (succeeded > 0) await onRefresh();
    if (failures.length > 0) {
      throw new Error(`${failures.length} 题未处理成功：${failures.slice(0, 6).join('；')}${failures.length > 6 ? '；……' : ''}`);
    }
    return `批量处理完成：成功 ${succeeded} 题，失败 ${failed} 题${skipped ? `，跳过 ${skipped} 题` : ''}。`;
  }

  function runSelected(action: BulkQuestionAction, label: string) {
    const selectedQuestions = candidates.filter((question) => selectedCandidateIds.has(question.id));
    return runAction(
      `candidate-bulk-${action}`,
      `${label}（${selectedQuestions.length}题）`,
      () => processQuestions(action, selectedQuestions),
      { refresh: false }
    );
  }

  function runAllFiltered(action: BulkQuestionAction, label: string) {
    return runAction(`candidate-bulk-all-${action}`, `${label}（当前筛选）`, async () => {
      const expectedTotal = candidatesTotal;
      setProgress({
        action,
        total: expectedTotal,
        completed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        currentQuestionId: null,
        failureMessages: []
      });

      const result = await startBulkTask({
        action,
        subject: subject || undefined,
        status: status || undefined,
        queue: status ? undefined : 'candidate',
        useCase,
        mockExamBlueprintId,
        mockExamSourcePaperId,
        gateScope: action === 'approve' ? bulkApproveScope : undefined,
        limit: bulkAllLimit,
        expectedTotal,
        reason: action === 'reject' ? 'admin_bulk_rejected_from_question_bank' : undefined
      });

      setProgress({
        action,
        total: expectedTotal,
        completed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        currentQuestionId: null,
        failureMessages: []
      });

      await onRefresh();
      return `已创建后台任务 ${result.task.id.slice(0, 8)}，系统会自动处理当前筛选范围内的全部可处理题。`;
    }, { refresh: false });
  }

  return {
    runSelected,
    runAllFiltered
  };
}
