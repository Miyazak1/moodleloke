import { AdminPanel, AdminPanelHeader } from '../AdminWorkbench';
import { MathContent } from '../../MathContent';
import type { AdminAIQuestioningQuestionLedgerItem } from '../../../lib/api-types';
import { formatDate } from './pageUtils';
import { isMockExamCandidate, mockExamAssemblyEvidence, questionProductionVersionEvidence } from './questionEvidence';
import { metadataText } from './questionFormatting';

export type LedgerPanelProps = {
  workflowLabel?: string;
  items: AdminAIQuestioningQuestionLedgerItem[];
  total: number;
  pageSize: number;
  pageStart: number;
  pageEnd: number;
  isLoading: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function practiceState(question: AdminAIQuestioningQuestionLedgerItem) {
  if (isMockExamCandidate(question)) {
    const assembly = mockExamAssemblyEvidence(question);
    if (assembly.assembled) return `已装配模考草稿 #${assembly.targetPaperId ?? '-'}`;
    return question.status === 'approved' ? '可装配模考草稿' : '模考候选';
  }
  if (question.practiceQuestionStatus) return `训练状态 ${statusLabel(question.practiceQuestionStatus)}`;
  if (question.isPracticeReady) return '可进入训练';
  return '暂不可训练';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审核',
    review_failed: '复审失败',
    approved: '已审核',
    rejected: '已拒绝',
    archived: '已归档',
    fallback: '需重生'
  };
  return labels[status] ?? status;
}

function versionGovernanceLabel(question: AdminAIQuestioningQuestionLedgerItem) {
  const status = metadataText(question.versionGovernance?.status, 'unknown_legacy');
  const labels: Record<string, string> = {
    current: '当前画像',
    legacy_usable: '旧题可用',
    manual_published: '人工发布',
    stale_needs_review: '需版本复核',
    retired: '已退役',
    unknown_legacy: '未知旧题'
  };
  return `${labels[status] ?? status}${question.versionGovernance?.reason ? ` · ${question.versionGovernance.reason}` : ''}`;
}

export function LedgerPanel({
  workflowLabel = 'AI',
  items,
  total,
  pageSize,
  pageStart,
  pageEnd,
  isLoading,
  canGoPrevious,
  canGoNext,
  onPreviousPage,
  onNextPage
}: LedgerPanelProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker={`${workflowLabel}题库台账`} title={`AI 生成题台账 ${pageStart}-${pageEnd} / ${total}`} />
      {items.length === 0 && !isLoading && <p className="form-hint">当前筛选下还没有 AI 生成题。</p>}
      {items.map((question) => (
        (() => {
          const production = questionProductionVersionEvidence(question);
          return (
            <article key={question.id} className="process-row admin-data-row">
              <span>Q{question.id}</span>
              <div>
                <strong><MathContent text={question.prompt} /></strong>
                <p>{question.subject} · {question.topicTitle} · {question.generationSourceLabel} · {question.provider || '-'} / {question.model || '-'}</p>
                <p>生成 {formatDate(production.generatedAt, '-')} · 更新 {formatDate(production.updatedAt, '-')} · 题版 v{production.questionVersion} · 生成Schema {production.generationSchemaVersion} · 大纲 {production.syllabusVersion}</p>
                <p>G Prompt {production.generatorPromptVersion} · R Prompt {production.reviewerPromptVersion}{production.styleProfileVersion ? ` · 画像 v${production.styleProfileVersion}` : ''}</p>
                <p>{practiceState(question)} · 候选状态 {statusLabel(question.status)} · 蓝图 B#{question.blueprintId ?? '-'}</p>
                <p>版本治理：{versionGovernanceLabel(question)}</p>
                <p>曝光 {question.exposureCount} · 作答 {question.attemptCount} · 正确率 {question.accuracy === null ? '-' : `${question.accuracy}%`}</p>
                <p>最近使用：{formatDate(question.lastUsedAt, '-')}</p>
              </div>
              <b>{question.exposureCount > 0 || question.attemptCount > 0 ? '已使用' : '未使用'}</b>
            </article>
          );
        })()
      ))}
      {total > pageSize && (
        <div className="admin-filter-actions">
          <button type="button" className="ghost-button" onClick={onPreviousPage} disabled={!canGoPrevious}>
            上一页
          </button>
          <button type="button" className="ghost-button" onClick={onNextPage} disabled={!canGoNext}>
            下一页
          </button>
        </div>
      )}
    </AdminPanel>
  );
}
