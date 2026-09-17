import { Fragment } from 'react';
import type { ReactNode } from 'react';
import {
  AdminActionBar,
  AdminPanel,
  AdminPanelHeader,
  AdminTableScroll
} from '../AdminWorkbench';
import { MathContent } from '../../MathContent';
import type {
  AdminAIQuestioningAgentRun,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type { BulkApproveScope, CandidateBulkProgress } from './candidateBulkActions';
import type { QuestionEditDraft } from './types';
import {
  agentRunSummary,
  agentRunTypeLabel,
  approvedCandidateLabel,
  canApproveCandidate,
  canArchiveCandidate,
  canEditCandidate,
  canRejectCandidate,
  canReviewCandidate,
  statusLabel
} from './candidateReviewHelpers';
import { questionOptionsFromUnknown, recordFrom } from './questionData';
import {
  candidateAgentEvidence,
  candidateLocalization,
  candidateReviewExplanation,
  candidateUsesFallback,
  gateBlocksPublish,
  questionProductionVersionEvidence,
  subjectPracticeAutomationEvidence,
  styleProfileFreshnessText
} from './questionEvidence';
import {
  gateLabel,
  metadataText,
  subjectDisplayName,
  sourceSimilarityText
} from './questionFormatting';
import { formatDate } from './pageUtils';

type CandidateReviewToolbarProps = {
  approveVerb: string;
  governanceMode?: boolean;
  pageLabel: string;
  bulkApproveScope: BulkApproveScope;
  canGoPrevious: boolean;
  canGoNext: boolean;
  controlsBusy: boolean;
  refreshBusy: boolean;
  publishAllBusy: boolean;
  bulkReviewBusy: boolean;
  bulkApproveBusy: boolean;
  bulkRejectBusy: boolean;
  hasVisibleRows: boolean;
  canPublishAll: boolean;
  total: number;
  selectedCount: number;
  totalSelectedCount: number;
  selectedReviewableCount: number;
  selectedPublishableCount: number;
  selectedRejectableCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onScopeChange: (scope: BulkApproveScope) => void;
  onPublishAll: () => void;
  onSelectPage: () => void;
  onClearSelection: () => void;
  onBulkReview: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
};

function bulkScopeLabel(scope: BulkApproveScope) {
  return scope === 'gate_passed' ? '门禁通过' : '门禁通过 + 质量关注';
}

function candidateGovernanceBucket(evidence: ReturnType<typeof candidateAgentEvidence>, isFallback: boolean) {
  const issueCodes = evidence.issues.map((issue) => metadataText(issue.code)).filter(Boolean);
  const reasonCodes = evidence.gate.reasons;
  const allCodes = [...issueCodes, ...reasonCodes, ...evidence.profileAlignment.reasons].join(' ');
  const structuralSignals = [
    'question_form_mismatch',
    'cognitive_skill_mismatch',
    'difficulty_band_mismatch',
    'difficulty_mismatch',
    'near_duplicate_prompt_risk',
    'duplicate_prompt_risk',
    'source_similarity',
    'past_paper_similarity',
    'topic_mismatch',
    'knowledge_mismatch',
    'subject_mismatch',
    'prompt_leakage',
    'trivial_arithmetic_candidate',
    'style_alignment_failed',
    'profile_alignment_failed'
  ];
  const repairableSignals = [
    'equivalent_option',
    'duplicate_option',
    'option_conflict',
    'correct_answer',
    'answer_mismatch',
    'explanation',
    'distractor',
    'localization',
    'bilingual',
    'weak_syllabus_signal'
  ];
  const hasStructuralSignal = structuralSignals.some((signal) => allCodes.includes(signal));
  const hasRepairableSignal = repairableSignals.some((signal) => allCodes.includes(signal));
  if (isFallback || hasStructuralSignal || (evidence.gate.decision === 'regenerate' && !hasRepairableSignal)) {
    return {
      label: '结构废题',
      detail: '题型/能力/相似度/难度等结构性问题，不建议在原题上继续修；系统应换题重生，人工侧可拒绝或归档。',
      tone: 'danger'
    };
  }
  if (evidence.gate.publishable) {
    return {
      label: '门禁已过',
      detail: '正常情况下会自动进入当前业务线题库资产；若仍留在待治理列表，请刷新或检查映射/自动入库记录。',
      tone: 'ok'
    };
  }
  if (hasRepairableSignal || evidence.gate.decision === 'needs_edit' || evidence.gate.decision === 'human_review' || evidence.gate.decision === 'quality_attention') {
    return {
      label: '可修复',
      detail: '主要是选项、答案、解析、双语或弱贴合问题，可以编辑后复审。',
      tone: 'warning'
    };
  }
  return {
    label: '待判定',
    detail: '证据不足，先复审或查看运行记录。',
    tone: 'info'
  };
}

function CandidateReviewToolbar({
  approveVerb,
  governanceMode = false,
  pageLabel,
  bulkApproveScope,
  canGoPrevious,
  canGoNext,
  controlsBusy,
  refreshBusy,
  publishAllBusy,
  bulkReviewBusy,
  bulkApproveBusy,
  bulkRejectBusy,
  hasVisibleRows,
  canPublishAll,
  total,
  selectedCount,
  totalSelectedCount,
  selectedReviewableCount,
  selectedPublishableCount,
  selectedRejectableCount,
  onPreviousPage,
  onNextPage,
  onRefresh,
  onScopeChange,
  onPublishAll,
  onSelectPage,
  onClearSelection,
  onBulkReview,
  onBulkApprove,
  onBulkReject,
  onExportCsv,
  onExportJson
}: CandidateReviewToolbarProps) {
  return (
    <div className="admin-candidate-toolbar">
      <div className="admin-candidate-toolbar-row">
        <span className="admin-candidate-page-label">{pageLabel}</span>
        <button type="button" className="ghost-button" onClick={onPreviousPage} disabled={!canGoPrevious}>
          上一页
        </button>
        <button type="button" className="ghost-button" onClick={onNextPage} disabled={!canGoNext}>
          下一页
        </button>
        <button
          type="button"
          className={refreshBusy ? 'admin-action-loading' : 'ghost-button'}
          onClick={onRefresh}
          disabled={refreshBusy}
        >
          {refreshBusy ? '刷新中' : '刷新候选'}
        </button>
      </div>
      {!governanceMode && (
      <div className="admin-candidate-toolbar-row">
        <div className="admin-candidate-publish-scope" role="group" aria-label="批量通过范围">
          <button
            type="button"
            className="ghost-button"
            data-active={bulkApproveScope === 'gate_passed'}
            onClick={() => onScopeChange('gate_passed')}
            disabled={publishAllBusy || bulkApproveBusy}
          >
            门禁通过
          </button>
          <button
            type="button"
            className="ghost-button"
            data-active={bulkApproveScope === 'include_human_review'}
            onClick={() => onScopeChange('include_human_review')}
            disabled={publishAllBusy || bulkApproveBusy}
          >
            含质量关注
          </button>
        </div>
        <button
          type="button"
          className={publishAllBusy ? 'admin-action-loading' : undefined}
          onClick={onPublishAll}
          disabled={total === 0 || controlsBusy || !canPublishAll}
          title={canPublishAll
            ? '按当前筛选和通过范围处理全部可处理候选题；后台会分批执行，离开页面也会继续'
            : '当前状态下没有可处理候选题，请切回待审核或复审失败。'}
        >
          {publishAllBusy ? '处理中' : `${approveVerb}全部可处理题`}
        </button>
        <span className="admin-muted-inline">
          发布全部可发布题：后台会分批执行，进度会显示在下方。
        </span>
      </div>
      )}
      <AdminActionBar className="admin-candidate-compact-actions">
        <button type="button" className="ghost-button" onClick={onSelectPage} disabled={!hasVisibleRows || controlsBusy}>
          全选本页
        </button>
        <button type="button" className="ghost-button" onClick={onClearSelection} disabled={totalSelectedCount === 0 || controlsBusy}>
          清空
        </button>
        <button
          type="button"
          className={bulkReviewBusy ? 'admin-action-loading' : undefined}
          onClick={onBulkReview}
          disabled={selectedReviewableCount === 0 || controlsBusy}
          title={selectedCount > 0 && selectedReviewableCount === 0 ? '已选题目已经通过、拒绝或归档，不能在候选队列复审。' : undefined}
        >
          {bulkReviewBusy ? '复审中' : '复审'}
        </button>
        {!governanceMode && (
          <button
            type="button"
            className={bulkApproveBusy ? 'admin-action-loading' : undefined}
            onClick={onBulkApprove}
            disabled={selectedPublishableCount === 0 || controlsBusy}
            title={selectedCount > 0 && selectedPublishableCount === 0 ? '当前通过范围内没有可处理题，可能被门禁、状态或 fallback 规则拦截' : bulkApproveScope === 'gate_passed' ? '只通过当前门禁通过的题；建议重生、需修改、质量关注和 fallback 会被跳过' : '会通过当前门禁通过和质量关注的题；建议重生、需修改和 fallback 会被跳过'}
          >
            {bulkApproveBusy ? '处理中' : `${approveVerb}所选`}
          </button>
        )}
        <button
          type="button"
          className={bulkRejectBusy ? 'admin-action-loading' : undefined}
          onClick={onBulkReject}
          disabled={selectedRejectableCount === 0 || controlsBusy}
          title={selectedCount > 0 && selectedRejectableCount === 0 ? '已选题目已经通过、拒绝或归档，不能在候选队列拒绝。' : undefined}
        >
          {bulkRejectBusy ? '拒绝中' : '拒绝'}
        </button>
        <button type="button" className="ghost-button" onClick={onExportCsv} disabled={!hasVisibleRows}>
          CSV
        </button>
        <button type="button" className="ghost-button" onClick={onExportJson} disabled={!hasVisibleRows}>
          JSON
        </button>
      </AdminActionBar>
      {totalSelectedCount > selectedCount && (
        <p className="form-hint">翻页会清空勾选；「{approveVerb}所选 / 复审 / 拒绝」只处理本页已选题，「{approveVerb}全部可处理题」按当前筛选范围处理。</p>
      )}
    </div>
  );
}

function CandidateBulkProgressLine({ progress }: { progress: CandidateBulkProgress }) {
  const actionLabel = progress.action === 'approve'
    ? '批量通过入库'
    : progress.action === 'review'
      ? '批量复审'
      : progress.action === 'reject'
        ? '批量拒绝'
        : '批量归档';

  const failureMessages = progress.failureMessages ?? [];

  return (
    <div className="admin-topic-bulk-progress">
      <p>
        {actionLabel}：
        题目 {progress.completed}/{progress.total}
        {' · '}成功 {progress.succeeded}
        {' · '}失败 {progress.failed}
        {progress.skipped > 0 ? ` · 已跳过 ${progress.skipped}` : ''}
        {progress.currentQuestionId
          ? ` · 正在处理 Q${progress.currentQuestionId}`
          : progress.failed > 0 || failureMessages.length > 0
            ? ' · 已完成，存在失败项'
            : ' · 已完成'}
      </p>
      {progress.skipped > 0 && (
        <p className="form-hint">跳过通常表示题目状态、fallback 或当前通过范围不允许直接入库。</p>
      )}
      {failureMessages.length > 0 && (
        <details className="admin-bulk-failure-details" open={failureMessages.length <= 3}>
          <summary>查看失败原因</summary>
          <ul>
            {failureMessages.slice(0, 8).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          {failureMessages.length > 8 && <p className="form-hint">还有 {failureMessages.length - 8} 条失败记录，请导出或缩小范围后重试。</p>}
        </details>
      )}
    </div>
  );
}

type CandidateQuestionPreviewProps = {
  question: AdminAIQuestioningQuestion;
  isFallback: boolean;
  evidence: ReturnType<typeof candidateAgentEvidence>;
  reviewExplanation: ReturnType<typeof candidateReviewExplanation>;
  agentRuns: AdminAIQuestioningAgentRun[];
  agentRunsBusy: boolean;
  onLoadAgentRuns: () => void;
};

function CandidateQuestionPreview({
  question,
  isFallback,
  evidence,
  reviewExplanation,
  agentRuns,
  agentRunsBusy,
  onLoadAgentRuns
}: CandidateQuestionPreviewProps) {
  const options = questionOptionsFromUnknown(question.options);
  const englishLocalization = recordFrom(candidateLocalization(question, 'en'));
  const englishOptions = questionOptionsFromUnknown(englishLocalization.options);
  const production = questionProductionVersionEvidence(question);
  const governanceBucket = candidateGovernanceBucket(evidence, isFallback);
  const automation = subjectPracticeAutomationEvidence(question);
  const automationMessages = [
    automation.repair.status
      ? `自动修复：${automation.repair.status}${automation.repair.attempt ? ` · 第 ${automation.repair.attempt} 次` : ''}${automation.repair.error ? ` · ${automation.repair.error}` : ''}`
      : '',
    automation.regenerate.status
      ? `硬伤替代：${automation.regenerate.status}${automation.regenerate.jobIds.length ? ` · 新任务 #${automation.regenerate.jobIds.join(' #')}` : ''}${automation.regenerate.error ? ` · ${automation.regenerate.error}` : ''}`
      : ''
  ].filter(Boolean);

  return (
    <>
      <strong>Q{question.id}</strong>
      <p><MathContent text={question.prompt} /></p>
      {options.length > 0 && (
        <div className="admin-question-candidate-options" aria-label={`Q${question.id} 选项`}>
          {options.map((option) => (
            <span key={`${question.id}-${option.id}`} data-correct={option.id === question.correctAnswer ? 'true' : 'false'}>
              <b>{option.id}</b>
              <span className="admin-question-option-text"><MathContent text={option.text} /></span>
            </span>
          ))}
        </div>
      )}
      <div className="admin-question-candidate-answer">
        <span>答案：{question.correctAnswer || '-'}</span>
        <p>解析：<MathContent text={question.explanation || '暂无解析'} /></p>
      </div>
      {metadataText(englishLocalization.prompt, '') && (
        <details className="admin-candidate-localization">
          <summary>查看英文同题版本</summary>
          <p><MathContent text={metadataText(englishLocalization.prompt)} /></p>
          {englishOptions.length > 0 && (
            <div className="admin-question-candidate-options">
              {englishOptions.map((option) => (
                <span key={`${question.id}-en-${option.id}`} data-correct={option.id === question.correctAnswer ? 'true' : 'false'}>
                  <b>{option.id}</b>
                  <span className="admin-question-option-text"><MathContent text={option.text} /></span>
                </span>
              ))}
            </div>
          )}
          <div className="admin-question-candidate-answer">
            <span>Answer: {question.correctAnswer || '-'}</span>
            <p>Explanation: <MathContent text={metadataText(englishLocalization.explanation, 'No English explanation yet')} /></p>
          </div>
        </details>
      )}
      <div className="admin-agent-evidence-strip">
        <span>生成时间：{formatDate(production.generatedAt, '-')}</span>
        <span>更新：{formatDate(production.updatedAt, '-')}</span>
        <span>题版 v{production.questionVersion}</span>
        <span>生成Schema：{production.generationSchemaVersion}</span>
        <span>大纲 {production.syllabusVersion}</span>
        <span>G Prompt：{production.generatorPromptVersion}</span>
        <span>R Prompt：{production.reviewerPromptVersion}</span>
        {production.styleProfileVersion && <span>画像 v{production.styleProfileVersion}</span>}
        <span>生成：{evidence.generator.name} / {evidence.generator.model}</span>
        <span>审题：{evidence.reviewer.name}{evidence.reviewer.score === null ? '' : ` / ${evidence.reviewer.score} 分`}</span>
        <span>难度：{question.designedDifficulty || '-'}</span>
        {evidence.intendedUse && <span>用途：{evidence.intendedUse}</span>}
        <span>{evidence.styleProfile.used ? `画像 #${evidence.styleProfile.profileId} · 样本 ${evidence.styleProfile.sampleSize ?? '-'}` : '未使用画像'}</span>
        <span>画像对齐：{evidence.profileAlignment.score === null ? evidence.profileAlignment.status : `${evidence.profileAlignment.score} 分`}</span>
        {evidence.styleProfile.used && (
          <span data-stale={evidence.styleProfile.freshness.stale ? 'true' : 'false'}>{styleProfileFreshnessText(evidence.styleProfile.freshness)}</span>
        )}
        <span data-gate={evidence.gate.decision}>{gateLabel(evidence.gate.decision)}</span>
      </div>
      <div className={`admin-candidate-review-summary ${reviewExplanation.tone}`}>
        <b>{reviewExplanation.title}</b>
        <span>{reviewExplanation.detail}</span>
      </div>
      <div className={`admin-candidate-review-summary ${governanceBucket.tone}`}>
        <b>治理分流：{governanceBucket.label}</b>
        <span>{governanceBucket.detail}</span>
      </div>
      {automation.hasEvidence && (
        <div className="admin-candidate-review-summary info">
          <b>自动处理</b>
          <span>{automationMessages.join('；') || '已有自动处理记录。'}</span>
        </div>
      )}
      <details className="admin-agent-evidence-details">
        <summary>查看审题证据</summary>
        <div className="admin-agent-evidence-grid">
          <div>
            <strong>Agent</strong>
            <p>Generator：{evidence.generator.provider} / {evidence.generator.model}</p>
            <p>Reviewer：{evidence.reviewer.provider} / {evidence.reviewer.model}</p>
            <p>画像：{evidence.styleProfile.used ? `#${evidence.styleProfile.profileId} · ${evidence.styleProfile.confidence || '-'} · ${evidence.styleProfile.sampleSize ?? '-'} 样本` : `未使用 · ${evidence.styleProfile.sourceKind}`}</p>
            {evidence.styleProfile.used && (
              <p>画像状态：{styleProfileFreshnessText(evidence.styleProfile.freshness)}</p>
            )}
            <p>真题相似度：{sourceSimilarityText(evidence.styleProfile.maxSimilarity)}</p>
            {evidence.styleProfile.matches.length > 0 && (
              <p>相近样本：{evidence.styleProfile.matches.slice(0, 2).map((match) => `#${match.sourceQuestionId ?? '-'} ${match.questionNumber} · ${sourceSimilarityText(match.similarity)}`).join(' / ')}</p>
            )}
            <p>运行记录：G#{evidence.generator.interactionId} · R#{evidence.reviewer.interactionId}</p>
            <p>Reviewer 决策：{evidence.reviewer.decision} · 状态：{evidence.reviewer.status}</p>
            {evidence.intendedUse && <p>用途：{evidence.intendedUse}</p>}
            <p>画像对齐：{evidence.profileAlignment.status} · {evidence.profileAlignment.score === null ? '-' : `${evidence.profileAlignment.score} 分`}</p>
            {evidence.profileAlignment.reasons.length > 0 && (
              <p className="admin-agent-raw-tags">画像偏差：{evidence.profileAlignment.reasons.join(' / ')}</p>
            )}
            <p>目标画像：{[
              metadataText(evidence.profileAlignment.targetProfile.questionForm),
              metadataText(evidence.profileAlignment.targetProfile.cognitiveSkill),
              metadataText(evidence.profileAlignment.targetProfile.readingLoad),
              metadataText(evidence.profileAlignment.targetProfile.calculationLoad)
            ].filter(Boolean).join(' · ') || '-'}</p>
          </div>
          <div>
            <strong>门禁</strong>
            <p>{gateLabel(evidence.gate.decision)}</p>
            <p>{reviewExplanation.gateReasons.length ? reviewExplanation.gateReasons.join(' / ') : '无拦截原因'}</p>
            {evidence.gate.reasons.length > 0 && (
              <p className="admin-agent-raw-tags">原始：{evidence.gate.reasons.join(' / ')}</p>
            )}
          </div>
          <div>
            <strong>Rubric</strong>
            <p>考纲 {metadataText(evidence.rubric.syllabusAlignment)} · 答案 {metadataText(evidence.rubric.answerCorrectness)} · 选项 {metadataText(evidence.rubric.optionQuality)}</p>
            <p>解析 {metadataText(evidence.rubric.explanationQuality)} · 难度 {metadataText(evidence.rubric.difficultyMatch)} · 语言 {metadataText(evidence.rubric.languageQuality)}</p>
          </div>
          <div>
            <strong>主要问题</strong>
            <p>{reviewExplanation.issueTexts.length ? reviewExplanation.issueTexts.join(' / ') : '暂无问题'}</p>
            {evidence.issues.length > 0 && (
              <p className="admin-agent-raw-tags">
                原始：{evidence.issues.slice(0, 4).map((issue) => `${metadataText(issue.severity)}:${metadataText(issue.code)}`).join(' / ')}
              </p>
            )}
          </div>
        </div>
        <div className="admin-agent-runs-panel">
          <div className="admin-agent-runs-header">
            <strong>运行记录</strong>
            <button
              type="button"
              className={agentRunsBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
              onClick={onLoadAgentRuns}
              disabled={agentRunsBusy}
            >
              {agentRunsBusy ? '加载中' : agentRuns.length > 0 ? '刷新记录' : '加载详情'}
            </button>
          </div>
          {agentRuns.length > 0 ? (
            <div className="admin-agent-runs-list">
              {agentRuns.map((run) => {
                const summary = agentRunSummary(run);
                return (
                  <div key={run.id} className="admin-agent-run-item">
                    <div>
                      <b>#{run.id} · {agentRunTypeLabel(run.type)}</b>
                      <span>{summary.agentName} · {run.provider || '-'} / {run.model || '-'}</span>
                    </div>
                    <p>
                      状态 {run.status}
                      {summary.decision !== '-' ? ` · 决策 ${summary.decision}` : ''}
                      {summary.score ? ` · ${summary.score}` : ''}
                      {summary.issues.length ? ` · ${summary.issues.join(' / ')}` : ''}
                    </p>
                    <small>{run.promptVersion || '-'} · {run.createdAt}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="form-hint">新生成或复审后的题会有完整运行记录；旧题可能只有 metadata 里的简要证据。</p>
          )}
        </div>
      </details>
      <small>{question.subject} · topic #{question.topicId} · 难度 {question.designedDifficulty || '-'}{isFallback ? ' · fallback 需重生' : ' · 真实 AI 候选'}</small>
    </>
  );
}

type CandidateQuestionActionsProps = {
  governanceMode?: boolean;
  isEditing: boolean;
  approvedLabel: string | null;
  approveLabel: string;
  canReview: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  reviewTitle?: string;
  editTitle?: string;
  approveTitle?: string;
  rejectTitle?: string;
  archiveTitle?: string;
  reviewBusy: boolean;
  editBusy: boolean;
  approveBusy: boolean;
  rejectBusy: boolean;
  archiveBusy: boolean;
  deleteBusy: boolean;
  controlsBusy: boolean;
  onReview: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

function CandidateQuestionActions({
  governanceMode = false,
  isEditing,
  approvedLabel,
  approveLabel,
  canReview,
  canEdit,
  canApprove,
  canReject,
  canArchive,
  reviewTitle,
  editTitle,
  approveTitle,
  rejectTitle,
  archiveTitle,
  reviewBusy,
  editBusy,
  approveBusy,
  rejectBusy,
  archiveBusy,
  deleteBusy,
  controlsBusy,
  onReview,
  onEdit,
  onApprove,
  onReject,
  onArchive,
  onDelete
}: CandidateQuestionActionsProps) {
  return (
    <div className="admin-inline-actions">
      <button
        type="button"
        className="ghost-button"
        onClick={onReview}
        disabled={controlsBusy || reviewBusy || !canReview}
        title={reviewTitle}
      >
        {reviewBusy ? '复审中' : '复审'}
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={onEdit}
        disabled={controlsBusy || editBusy || !canEdit}
        title={editTitle}
      >
        {isEditing ? '正在编辑' : '编辑'}
      </button>
      {approvedLabel ? (
        <span className="admin-inline-status">{approvedLabel}</span>
      ) : (
        <button
          type="button"
          className={approveBusy ? 'admin-action-loading' : undefined}
          onClick={onApprove}
          disabled={controlsBusy || approveBusy || !canApprove}
          title={approveTitle}
        >
          {approveBusy && <span className="admin-button-spinner" aria-hidden="true" />}
          {approveBusy ? '处理中' : governanceMode ? '人工兜底入库' : approveLabel}
        </button>
      )}
      <button
        type="button"
        className="ghost-button"
        onClick={onReject}
        disabled={controlsBusy || rejectBusy || !canReject}
        title={rejectTitle}
      >
        {rejectBusy ? '拒绝中' : '拒绝'}
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={onArchive}
        disabled={controlsBusy || archiveBusy || !canArchive}
        title={archiveTitle}
      >
        {archiveBusy ? '归档中' : '归档'}
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={onDelete}
        disabled={controlsBusy || deleteBusy}
        title="删除这道 AI 生成题及其生成任务、曝光记录和已入库 AI 专项映射；不会删除大纲、真题画像或手工题。"
      >
        {deleteBusy ? '删除中' : '删除生成题'}
      </button>
    </div>
  );
}

type CandidateQuestionRowProps = {
  approveVerb: string;
  governanceMode?: boolean;
  question: AdminAIQuestioningQuestion;
  selected: boolean;
  isEditing: boolean;
  editingDraft: QuestionEditDraft | null;
  agentRuns: AdminAIQuestioningAgentRun[];
  controlsBusy: boolean;
  isActionBusy: (id: string) => boolean;
  onToggle: (id: number) => void;
  onReview: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onEdit: (question: AdminAIQuestioningQuestion) => void;
  onApprove: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onReject: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onArchive: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onDeleteGenerated: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onLoadAgentRuns: (question: AdminAIQuestioningQuestion, hasRuns: boolean) => void;
  renderEditor: (question: AdminAIQuestioningQuestion, draft: QuestionEditDraft) => ReactNode;
};

function CandidateQuestionRow({
  approveVerb,
  governanceMode = false,
  question,
  selected,
  isEditing,
  editingDraft,
  agentRuns,
  controlsBusy,
  isActionBusy,
  onToggle,
  onReview,
  onEdit,
  onApprove,
  onReject,
  onArchive,
  onDeleteGenerated,
  onLoadAgentRuns,
  renderEditor
}: CandidateQuestionRowProps) {
  const isFallback = candidateUsesFallback(question);
  const reviewActionId = `review-${question.id}`;
  const approveActionId = `approve-${question.id}`;
  const rejectActionId = `reject-${question.id}`;
  const archiveActionId = `archive-${question.id}`;
  const deleteActionId = `delete-generated-${question.id}`;
  const reviewActionBusy = isActionBusy(reviewActionId);
  const editActionBusy = isActionBusy(`candidate-edit-${question.id}`);
  const approveActionBusy = isActionBusy(approveActionId);
  const rejectActionBusy = isActionBusy(rejectActionId);
  const archiveActionBusy = isActionBusy(archiveActionId);
  const deleteActionBusy = isActionBusy(deleteActionId);
  const approvedLabel = approvedCandidateLabel(question);
  const agentEvidence = candidateAgentEvidence(question);
  const canReview = canReviewCandidate(question);
  const canEdit = canEditCandidate(question);
  const canApprove = canApproveCandidate(question);
  const canReject = canRejectCandidate(question);
  const canArchive = canArchiveCandidate(question);
  const approveLabel = agentEvidence.gate.decision === 'human_review' || agentEvidence.gate.decision === 'quality_attention'
    ? `质量关注${approveVerb}`
    : `${approveVerb}入库`;
  const agentRunsBusy = isActionBusy(`agent-runs-${question.id}`);
  const reviewExplanation = candidateReviewExplanation(question, agentEvidence);
  const finalStatusTitle = '这道题已经通过、拒绝或归档，候选队列里不能继续做这个动作。';
  const reviewTitle = canReview ? undefined : finalStatusTitle;
  const editTitle = canEdit ? undefined : finalStatusTitle;
  const approveTitle = isFallback
    ? 'fallback 题不能入库，请重新生成真实 AI 候选'
    : gateBlocksPublish(question)
      ? `审题门禁未通过：${agentEvidence.gate.reasons.join('、') || agentEvidence.gate.decision}`
      : governanceMode
        ? '候选治理台以查看失败原因、复审、编辑、拒绝和归档为主；此按钮仅用于管理员兜底入库，仍会执行硬门禁。'
      : !canApprove
        ? '只有草稿、待审核、复审失败的候选题可以通过入库'
        : undefined;
  const rejectTitle = canReject ? undefined : finalStatusTitle;
  const archiveTitle = canArchive ? undefined : '这道题已经归档。';

  return (
    <Fragment>
      <tr>
        <td>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(question.id)}
            disabled={controlsBusy}
            aria-label={`选择 Q${question.id}`}
          />
        </td>
        <td>
          <CandidateQuestionPreview
            question={question}
            isFallback={isFallback}
            evidence={agentEvidence}
            reviewExplanation={reviewExplanation}
            agentRuns={agentRuns}
            agentRunsBusy={agentRunsBusy}
            onLoadAgentRuns={() => onLoadAgentRuns(question, agentRuns.length > 0)}
          />
        </td>
        <td>{subjectDisplayName(question.subject)}</td>
        <td>
          {statusLabel(question.status)}
          {isFallback && <p className="form-hint">不可入库，请重新生成</p>}
        </td>
        <td>{question.blueprintId ? `B${question.blueprintId}` : '-'}</td>
        <td>{question.designedDifficulty} · {question.empiricalDifficulty || '-'}</td>
        <td>
          <CandidateQuestionActions
            governanceMode={governanceMode}
            isEditing={isEditing}
            approvedLabel={approvedLabel}
            approveLabel={approveLabel}
            canReview={canReview}
            canEdit={canEdit}
            canApprove={canApprove}
            canReject={canReject}
            canArchive={canArchive}
            reviewTitle={reviewTitle}
            editTitle={editTitle}
            approveTitle={approveTitle}
            rejectTitle={rejectTitle}
            archiveTitle={archiveTitle}
            reviewBusy={reviewActionBusy}
            editBusy={editActionBusy}
            approveBusy={approveActionBusy}
            rejectBusy={rejectActionBusy}
            archiveBusy={archiveActionBusy}
            deleteBusy={deleteActionBusy}
            controlsBusy={controlsBusy}
            onReview={() => onReview(question, reviewActionId)}
            onEdit={() => onEdit(question)}
            onApprove={() => onApprove(question, approveActionId)}
            onReject={() => onReject(question, rejectActionId)}
            onArchive={() => onArchive(question, archiveActionId)}
            onDelete={() => onDeleteGenerated(question, deleteActionId)}
          />
        </td>
      </tr>
      {isEditing && editingDraft && (
        <tr className="admin-candidate-editor-row">
          <td colSpan={7}>{renderEditor(question, editingDraft)}</td>
        </tr>
      )}
    </Fragment>
  );
}

export type CandidateReviewPanelProps = {
  workflowLabel?: string;
  destinationLabel?: string;
  approveVerb?: string;
  governanceMode?: boolean;
  total: number;
  subject: string;
  currentStatus: string;
  pageLabel: string;
  pageIndex: number;
  pageStart: number;
  pageEnd: number;
  pageSize: number;
  rows: AdminAIQuestioningQuestion[];
  selectedCandidateIds: Set<number>;
  selectedCount: number;
  totalSelectedCount: number;
  selectedReviewableCount: number;
  selectedPublishableCount: number;
  selectedRejectableCount: number;
  selectedApproveBlockedCount: number;
  selectedReviewFailedCount: number;
  filterControls?: ReactNode;
  filterSummary?: string;
  allRowsSelected: boolean;
  controlsBusy: boolean;
  refreshBusy: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  bulkApproveScope: BulkApproveScope;
  bulkProgress: CandidateBulkProgress | null;
  editingQuestionId: number | null;
  editingDraft: QuestionEditDraft | null;
  agentRunsByQuestionId: Record<number, AdminAIQuestioningAgentRun[]>;
  isActionBusy: (id: string) => boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
  onScopeChange: (scope: BulkApproveScope) => void;
  onPublishAll: () => void;
  onSelectPage: () => void;
  onClearSelection: () => void;
  onBulkReview: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onToggleCandidate: (id: number) => void;
  onToggleVisibleRows: () => void;
  onReview: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onEdit: (question: AdminAIQuestioningQuestion) => void;
  onApprove: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onReject: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onArchive: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onDeleteGenerated: (question: AdminAIQuestioningQuestion, actionId: string) => void;
  onLoadAgentRuns: (question: AdminAIQuestioningQuestion, hasRuns: boolean) => void;
  renderEditor: (question: AdminAIQuestioningQuestion, draft: QuestionEditDraft) => ReactNode;
};

export function CandidateReviewPanel({
  workflowLabel = 'AI 题',
  destinationLabel = '最终题库',
  approveVerb = '通过',
  governanceMode = false,
  total,
  subject,
  currentStatus,
  pageLabel,
  pageIndex,
  pageStart,
  pageEnd,
  pageSize,
  rows,
  selectedCandidateIds,
  selectedCount,
  totalSelectedCount,
  selectedReviewableCount,
  selectedPublishableCount,
  selectedRejectableCount,
  selectedApproveBlockedCount,
  selectedReviewFailedCount,
  filterControls,
  filterSummary,
  allRowsSelected,
  controlsBusy,
  refreshBusy,
  canGoPrevious,
  canGoNext,
  bulkApproveScope,
  bulkProgress,
  editingQuestionId,
  editingDraft,
  agentRunsByQuestionId,
  isActionBusy,
  onPreviousPage,
  onNextPage,
  onRefresh,
  onScopeChange,
  onPublishAll,
  onSelectPage,
  onClearSelection,
  onBulkReview,
  onBulkApprove,
  onBulkReject,
  onExportCsv,
  onExportJson,
  onToggleCandidate,
  onToggleVisibleRows,
  onReview,
  onEdit,
  onApprove,
  onReject,
  onArchive,
  onDeleteGenerated,
  onLoadAgentRuns,
  renderEditor
}: CandidateReviewPanelProps) {
  const publishAllBusy = isActionBusy('candidate-bulk-all-approve');
  const bulkReviewBusy = isActionBusy('candidate-bulk-review');
  const bulkApproveBusy = isActionBusy('candidate-bulk-approve');
  const bulkRejectBusy = isActionBusy('candidate-bulk-reject');
  const canPublishAllFromCurrentFilter = ['', 'pending_review', 'review_failed'].includes(currentStatus);

  return (
    <AdminPanel className="admin-question-bank-candidates-section">
      <AdminPanelHeader
        kicker={governanceMode ? `${workflowLabel}候选治理与兜底` : `${workflowLabel}候选审核队列`}
        title={governanceMode ? `${total} 道待治理候选` : `${total} 道候选题`}
        actions={(
          <CandidateReviewToolbar
            approveVerb={approveVerb}
            governanceMode={governanceMode}
            pageLabel={pageLabel}
            bulkApproveScope={bulkApproveScope}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            controlsBusy={controlsBusy}
            refreshBusy={refreshBusy}
            publishAllBusy={publishAllBusy}
            bulkReviewBusy={bulkReviewBusy}
            bulkApproveBusy={bulkApproveBusy}
            bulkRejectBusy={bulkRejectBusy}
            hasVisibleRows={rows.length > 0}
            canPublishAll={canPublishAllFromCurrentFilter}
            total={total}
            selectedCount={selectedCount}
            totalSelectedCount={totalSelectedCount}
          selectedReviewableCount={selectedReviewableCount}
          selectedPublishableCount={selectedPublishableCount}
          selectedRejectableCount={selectedRejectableCount}
          onPreviousPage={onPreviousPage}
            onNextPage={onNextPage}
            onRefresh={onRefresh}
            onScopeChange={onScopeChange}
            onPublishAll={onPublishAll}
            onSelectPage={onSelectPage}
            onClearSelection={onClearSelection}
            onBulkReview={onBulkReview}
            onBulkApprove={onBulkApprove}
            onBulkReject={onBulkReject}
            onExportCsv={onExportCsv}
            onExportJson={onExportJson}
          />
        )}
      >
        <p className="admin-candidate-summary">
          {governanceMode
            ? `${filterSummary ?? `当前学科：${subject ? subjectDisplayName(subject) : '全部学科'}`} · 本页已选 ${selectedCount} 题 · 这里只展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档；门禁通过题会自动进入当前业务线题库资产（${destinationLabel}）。`
            : `当前学科：${subject ? subjectDisplayName(subject) : '全部学科'} · 本页已选 ${selectedCount} 题 · 通过范围：${bulkScopeLabel(bulkApproveScope)} · 通过后进入${destinationLabel}`}
          {selectedApproveBlockedCount > 0 ? ` · ${selectedApproveBlockedCount} 题会被跳过` : ''}
          {selectedReviewFailedCount > 0 ? ` · ${selectedReviewFailedCount} 题需先通过门禁` : ''}
        </p>
        {filterControls}
        {bulkProgress && <CandidateBulkProgressLine progress={bulkProgress} />}
      </AdminPanelHeader>
      <AdminTableScroll>
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allRowsSelected}
                  onChange={onToggleVisibleRows}
                  disabled={rows.length === 0 || controlsBusy}
                  aria-label="选择或取消当前显示的候选题"
                />
              </th>
              <th>题目</th>
              <th>学科</th>
              <th>状态</th>
              <th>蓝图</th>
              <th>难度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((question) => (
                <CandidateQuestionRow
                  approveVerb={approveVerb}
                  governanceMode={governanceMode}
                  key={question.id}
                question={question}
                selected={selectedCandidateIds.has(question.id)}
                isEditing={editingQuestionId === question.id}
                editingDraft={editingQuestionId === question.id ? editingDraft : null}
                agentRuns={agentRunsByQuestionId[question.id] ?? []}
                controlsBusy={controlsBusy}
                isActionBusy={isActionBusy}
                onToggle={onToggleCandidate}
                onReview={onReview}
                onEdit={onEdit}
                onApprove={onApprove}
                onReject={onReject}
                onArchive={onArchive}
                onDeleteGenerated={onDeleteGenerated}
                onLoadAgentRuns={onLoadAgentRuns}
                renderEditor={renderEditor}
              />
            ))}
          </tbody>
        </table>
      </AdminTableScroll>
      {rows.length === 0 && <p className="form-hint">当前筛选下没有候选题。</p>}
      {total > pageSize && (
        <div className="admin-filter-actions admin-candidate-pagination">
          <span>
            第 {pageIndex + 1} 页 · 当前 {pageStart}-{pageEnd} / 共 {total} 题
          </span>
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
