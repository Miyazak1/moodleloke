import type {
  AdminAIQuestioningSourceDocument,
  AdminAIQuestioningSourceAutoProfileTask,
  AdminAIQuestioningSourceQuestion,
  AdminAIQuestioningSourceTopicTask
} from '../../../lib/api-types';
import { AdminPanel, AdminPanelHeader } from '../AdminWorkbench';
import { SourceQuestionMappingCard } from './SourceQuestionMappingCard';

export type SourceQuestionManagerPanelProps = {
  documents: AdminAIQuestioningSourceDocument[];
  sourceQuestions: AdminAIQuestioningSourceQuestion[];
  sourceQuestionsTotal: number;
  sourceAutoProfileTasks: AdminAIQuestioningSourceAutoProfileTask[];
  sourceTopicTasks: AdminAIQuestioningSourceTopicTask[];
  page: number;
  pageSize: number;
  pageStart: number;
  pageEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  sourceQuestionDocumentId: number | null;
  sourceQuestionReviewStatus: string;
  sourceReferenceControlsBusy: boolean;
  isActionBusy: (actionId: string) => boolean;
  onDocumentChange: (documentId: number | null) => void;
  onReviewStatusChange: (status: string) => void;
  onStartAutoProfile: () => void;
  onRetryAutoProfile: () => void;
  onAutoMapAndApprove: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function SourceQuestionManagerPanel({
  documents,
  sourceQuestions,
  sourceQuestionsTotal,
  sourceAutoProfileTasks,
  sourceTopicTasks,
  page,
  pageSize,
  pageStart,
  pageEnd,
  canGoPrevious,
  canGoNext,
  sourceQuestionDocumentId,
  sourceQuestionReviewStatus,
  sourceReferenceControlsBusy,
  isActionBusy,
  onDocumentChange,
  onReviewStatusChange,
  onStartAutoProfile,
  onRetryAutoProfile,
  onAutoMapAndApprove,
  onPreviousPage,
  onNextPage
}: SourceQuestionManagerPanelProps) {
  const isSourceWriteBusy = sourceReferenceControlsBusy;
  const autoProfileTaskLabel = (task: AdminAIQuestioningSourceAutoProfileTask) => {
    if (task.action === 'retry_failed_samples') return '重试失败样本';
    if (task.action === 'auto_profile_filtered') return '自动画像';
    return task.action;
  };
  const autoProfileTaskStatus = (task: AdminAIQuestioningSourceAutoProfileTask) => {
    if (task.status === 'queued') return '排队中';
    if (task.status === 'running') return '处理中';
    if (task.status === 'succeeded') return task.failed > 0 ? '已完成，有失败' : '已完成';
    if (task.status === 'failed') return '失败';
    return task.status;
  };
  const sourceTaskLabel = (task: AdminAIQuestioningSourceTopicTask) => {
    if (task.action === 'suggest_filtered') return '自动映射';
    if (task.action === 'apply_high_confidence') return '自动纳入高置信';
    if (task.action === 'auto_map_profile') return '自动映射入画像';
    return task.action;
  };
  const sourceTaskStatus = (task: AdminAIQuestioningSourceTopicTask) => {
    if (task.status === 'queued') return '排队中';
    if (task.status === 'running') return '处理中';
    if (task.status === 'succeeded') return task.failed > 0 ? '已完成，有失败' : '已完成';
    if (task.status === 'failed') return '失败';
    return task.status;
  };
  return (
    <AdminPanel className="admin-source-question-manager-panel">
      <AdminPanelHeader
        kicker="自动画像流水线"
        title={`样本处理 ${pageStart}-${pageEnd} / ${sourceQuestionsTotal}`}
      >
        <p>导入后系统会自动映射知识点、纳入高置信样本并刷新画像；低置信和冲突样本只保留原因，不进入画像。</p>
      </AdminPanelHeader>

      <div className="admin-list compact">
      <div className="admin-source-question-toolbar">
        <strong>筛选样本</strong>
        <div className="admin-inline-actions">
          <select
            value={sourceQuestionDocumentId ?? ''}
            onChange={(event) => onDocumentChange(event.target.value ? Number(event.target.value) : null)}
            aria-label="真题文档筛选"
          >
            <option value="">全部文档</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
          <select
            value={sourceQuestionReviewStatus}
            onChange={(event) => onReviewStatusChange(event.target.value)}
            aria-label="真题样本状态筛选"
          >
            <option value="">全部样本</option>
            <option value="needs_review">需复核</option>
            <option value="mapped">已映射</option>
            <option value="approved">已确认可用</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
        <details className="admin-source-question-maintenance">
          <summary>异常维护入口</summary>
          <p className="form-hint">默认不需要操作。只有自动任务卡住、旧数据需要重跑，或你想立刻重试临时失败样本时才使用。</p>
          <div className="admin-inline-actions">
            <button
              type="button"
              className={isActionBusy('source-question-topic-auto-profile') ? 'ghost-button admin-action-loading' : undefined}
              onClick={onAutoMapAndApprove}
              disabled={isSourceWriteBusy}
              title="为当前筛选范围内未映射样本调用 AI 映射知识点，并自动纳入高置信结果用于真题画像"
            >
              {isActionBusy('source-question-topic-auto-profile') ? '自动处理中' : '重跑映射入画像'}
            </button>
            <button
              type="button"
              className={isActionBusy('source-question-auto-profile') ? 'ghost-button admin-action-loading' : undefined}
              onClick={onStartAutoProfile}
              disabled={isSourceWriteBusy}
              title="重新处理当前筛选下仍待自动画像的样本；导入新 JSON 时系统会自动启动一次"
            >
              {isActionBusy('source-question-auto-profile') ? '处理中' : '重跑待处理样本'}
            </button>
            <button
              type="button"
              className={isActionBusy('source-question-auto-profile-retry') ? 'ghost-button admin-action-loading' : 'ghost-button'}
              onClick={onRetryAutoProfile}
              disabled={isSourceWriteBusy}
              title="立即重试已经进入 retry_pending 的临时失败样本；低可信、冲突和 usage policy 阻断样本不会重试"
            >
              {isActionBusy('source-question-auto-profile-retry') ? '重试中' : '重试临时失败'}
            </button>
          </div>
        </details>
        {sourceAutoProfileTasks.length > 0 && (
          <div className="admin-source-task-strip">
            <strong>最近自动画像任务</strong>
            {sourceAutoProfileTasks.slice(0, 3).map((task) => (
              <span key={task.id} className={task.status === 'running' || task.status === 'queued' ? 'admin-task-chip admin-task-chip-active' : 'admin-task-chip'}>
                {autoProfileTaskLabel(task)} · {autoProfileTaskStatus(task)} · 纳入 {task.succeeded} · 排除/跳过 {task.skipped} · 失败 {task.failed}
                {task.error ? ` · ${task.error}` : ''}
              </span>
            ))}
          </div>
        )}
        {sourceTopicTasks.length > 0 && (
          <div className="admin-source-task-strip">
            <strong>最近映射任务</strong>
            {sourceTopicTasks.slice(0, 3).map((task) => (
              <span key={task.id} className={task.status === 'running' || task.status === 'queued' ? 'admin-task-chip admin-task-chip-active' : 'admin-task-chip'}>
                {sourceTaskLabel(task)} · {sourceTaskStatus(task)} · 成功 {task.succeeded} · 跳过 {task.skipped} · 失败 {task.failed}
                {task.error ? ` · ${task.error}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
      {sourceQuestions.length === 0 && <p className="form-hint">暂无可展示样本题。</p>}
      {sourceQuestions.map((question) => {
        return (
          <SourceQuestionMappingCard
            key={question.id}
            question={question}
          />
        );
      })}
      {sourceQuestionsTotal > pageSize && (
        <div className="admin-filter-actions admin-candidate-pagination">
          <span>
            第 {page + 1} 页 · 当前 {pageStart}-{pageEnd} / 共 {sourceQuestionsTotal} 题
          </span>
          <button type="button" className="ghost-button" onClick={onPreviousPage} disabled={!canGoPrevious}>
            上一页
          </button>
          <button type="button" className="ghost-button" onClick={onNextPage} disabled={!canGoNext}>
            下一页
          </button>
        </div>
      )}
      </div>
    </AdminPanel>
  );
}
