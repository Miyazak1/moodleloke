import {
  AdminActionBar,
  AdminPanel,
  AdminPanelHeader
} from '../AdminWorkbench';
import { MathContent } from '../../MathContent';
import type { AdminAIQuestioningQuestionLedgerItem } from '../../../lib/api-types';
import { questionOptionsFromUnknown, recordFrom } from './questionData';
import {
  candidateAgentEvidence,
  candidateLocalization,
  candidateReviewExplanation,
  hasLocalizationContent,
  isMockExamCandidate,
  mockExamAssemblyEvidence,
  questionProductionVersionEvidence,
  styleProfileFreshnessText
} from './questionEvidence';
import {
  gateLabel,
  metadataText,
  sourceSimilarityText,
  subjectDisplayName
} from './questionFormatting';
import { formatDate } from './pageUtils';

type RunAdminAction = (actionId: string, label: string, action: () => Promise<unknown>) => Promise<void>;

function versionGovernanceLabel(question: AdminAIQuestioningQuestionLedgerItem) {
  const governance = question.versionGovernance ?? recordFrom(recordFrom(question.generationMetadata).versionGovernance);
  const status = metadataText(governance.status, 'unknown_legacy');
  const labels: Record<string, string> = {
    current: '当前画像',
    legacy_usable: '旧题可用',
    manual_published: '人工发布',
    stale_needs_review: '需版本复核',
    retired: '已退役',
    unknown_legacy: '未知旧题'
  };
  return {
    status,
    label: labels[status] ?? status,
    reason: metadataText(governance.reason, '-'),
    classifiedAt: metadataText(governance.classifiedAt, '')
  };
}

type PublishedQuestionCardProps = {
  question: AdminAIQuestioningQuestionLedgerItem;
  isActionBusy: (actionId: string) => boolean;
  runAction: RunAdminAction;
  onReviewQuestion: (questionId: number) => Promise<unknown>;
  onConfirmSyllabusQuestion: (questionId: number) => Promise<unknown>;
  onArchiveQuestion: (questionId: number) => Promise<unknown>;
  onDeleteGeneratedQuestion: (questionId: number) => Promise<unknown>;
};

export type PublishedQuestionPanelProps = {
  workflowLabel?: string;
  destinationLabel?: string;
  items: AdminAIQuestioningQuestionLedgerItem[];
  total: number;
  pageSize: number;
  pageStart: number;
  pageEnd: number;
  isLoading: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isActionBusy: (actionId: string) => boolean;
  runAction: RunAdminAction;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onReviewQuestion: (questionId: number) => Promise<unknown>;
  onConfirmSyllabusQuestion: (questionId: number) => Promise<unknown>;
  onArchiveQuestion: (questionId: number) => Promise<unknown>;
  onDeleteGeneratedQuestion: (questionId: number) => Promise<unknown>;
};

function PublishedQuestionCard({
  question,
  isActionBusy,
  runAction,
  onReviewQuestion,
  onConfirmSyllabusQuestion,
  onArchiveQuestion,
  onDeleteGeneratedQuestion
}: PublishedQuestionCardProps) {
  const options = questionOptionsFromUnknown(question.options);
  const agentEvidence = candidateAgentEvidence(question);
  const reviewExplanation = candidateReviewExplanation(question, agentEvidence);
  const reviewActionId = `published-review-${question.id}`;
  const confirmSyllabusActionId = `published-confirm-syllabus-${question.id}`;
  const archiveActionId = `published-archive-${question.id}`;
  const deleteActionId = `published-delete-generated-${question.id}`;
  const reviewBusy = isActionBusy(reviewActionId);
  const confirmSyllabusBusy = isActionBusy(confirmSyllabusActionId);
  const archiveBusy = isActionBusy(archiveActionId);
  const deleteBusy = isActionBusy(deleteActionId);
  const syllabusGovernance = recordFrom(recordFrom(question.reviewMetadata).syllabusGovernance);
  const needsSyllabusConfirmation = syllabusGovernance.status === 'needs_review';
  const chineseLocalization = recordFrom(candidateLocalization(question, 'zh'));
  const englishLocalization = recordFrom(candidateLocalization(question, 'en'));
  const chineseOptions = questionOptionsFromUnknown(chineseLocalization.options);
  const englishOptions = questionOptionsFromUnknown(englishLocalization.options);
  const hasChineseLocalization = hasLocalizationContent(chineseLocalization);
  const hasEnglishLocalization = hasLocalizationContent(englishLocalization);
  const mockExamCandidate = isMockExamCandidate(question);
  const mockExamAssembly = mockExamAssemblyEvidence(question);
  const production = questionProductionVersionEvidence(question);
  const versionGovernance = versionGovernanceLabel(question);
  const readyLabel = mockExamCandidate
    ? mockExamAssembly.assembled
      ? `模考草稿 · 已装配 #${mockExamAssembly.targetPaperId ?? '-'}`
      : '模考候选 · 可装配'
    : question.isPracticeReady
      ? `已进入训练 #${question.sourceQuestionId}`
      : '映射异常 · 未入正式题库';

  return (
    <article className="admin-published-question-card">
      <div className="admin-published-question-head">
        <div>
          <strong>Q{question.id} · {question.topicTitle}</strong>
          <p>{subjectDisplayName(question.subject)} · {question.topicCode || `topic #${question.topicId}`} · 蓝图 B{question.blueprintId ?? '-'} · 难度 {question.designedDifficulty || '-'}</p>
        </div>
        <span data-ready={question.isPracticeReady || mockExamCandidate ? 'true' : 'false'}>
          {readyLabel}
        </span>
        <span data-ready={versionGovernance.status === 'current' || versionGovernance.status === 'legacy_usable' || versionGovernance.status === 'manual_published' ? 'true' : 'false'} title={`原因：${versionGovernance.reason}${versionGovernance.classifiedAt ? ` · ${versionGovernance.classifiedAt}` : ''}`}>
          版本：{versionGovernance.label}
        </span>
      </div>
      <div className="admin-published-question-body">
        <p><MathContent text={question.prompt} /></p>
        {options.length > 0 && (
          <div className="admin-question-candidate-options" aria-label={`Q${question.id} 选项`}>
            {options.map((option) => (
              <span key={`published-${question.id}-${option.id}`} data-correct={option.id === question.correctAnswer ? 'true' : 'false'}>
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
        {(hasChineseLocalization || hasEnglishLocalization) ? (
          <details className="admin-candidate-localization">
            <summary>查看中英文同题版本</summary>
            {hasChineseLocalization && (
              <div className="admin-published-localization-block">
                <strong>中文版本</strong>
                <p><MathContent text={metadataText(chineseLocalization.prompt, '暂无中文题干')} /></p>
                {chineseOptions.length > 0 && (
                  <div className="admin-question-candidate-options">
                    {chineseOptions.map((option) => (
                      <span key={`published-${question.id}-zh-${option.id}`} data-correct={option.id === question.correctAnswer ? 'true' : 'false'}>
                        <b>{option.id}</b>
                        <span className="admin-question-option-text"><MathContent text={option.text} /></span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="admin-question-candidate-answer">
                  <span>答案：{question.correctAnswer || '-'}</span>
                  <p>解析：<MathContent text={metadataText(chineseLocalization.explanation, '暂无中文解析')} /></p>
                </div>
              </div>
            )}
            {hasEnglishLocalization && (
              <div className="admin-published-localization-block">
                <strong>English version</strong>
                <p><MathContent text={metadataText(englishLocalization.prompt, 'No English prompt yet')} /></p>
                {englishOptions.length > 0 && (
                  <div className="admin-question-candidate-options">
                    {englishOptions.map((option) => (
                      <span key={`published-${question.id}-en-${option.id}`} data-correct={option.id === question.correctAnswer ? 'true' : 'false'}>
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
              </div>
            )}
          </details>
        ) : (
          <p className="form-hint">这道题库资产缺少双语版本 metadata；如需中英文同题，请重新生成或后续补翻译。</p>
        )}
        <div className="admin-agent-evidence-strip">
          <span>正式入库：{formatDate(question.formalAssetUpdatedAt, '-')}</span>
          <span>生成时间：{formatDate(production.generatedAt, '-')}</span>
          <span>更新：{formatDate(production.updatedAt, '-')}</span>
          <span>题版 v{production.questionVersion}</span>
          <span>生成Schema：{production.generationSchemaVersion}</span>
          <span>大纲 {production.syllabusVersion}</span>
          <span>G Prompt：{production.generatorPromptVersion}</span>
          <span>R Prompt：{production.reviewerPromptVersion}</span>
          {production.styleProfileVersion && <span>画像 v{production.styleProfileVersion}</span>}
          <span>生成：{agentEvidence.generator.name} / {agentEvidence.generator.model}</span>
          <span>审题：{agentEvidence.reviewer.name}{agentEvidence.reviewer.score === null ? '' : ` / ${agentEvidence.reviewer.score} 分`}</span>
          <span>题库：{question.generationSourceLabel}</span>
          <span>难度：{question.designedDifficulty || '-'}</span>
          {agentEvidence.intendedUse && <span>用途：{agentEvidence.intendedUse}</span>}
          <span>{agentEvidence.styleProfile.used ? `画像 #${agentEvidence.styleProfile.profileId} · 样本 ${agentEvidence.styleProfile.sampleSize ?? '-'}` : '未使用画像'}</span>
          <span>画像对齐：{agentEvidence.profileAlignment.score === null ? agentEvidence.profileAlignment.status : `${agentEvidence.profileAlignment.score} 分`}</span>
          {agentEvidence.styleProfile.used && (
            <span data-stale={agentEvidence.styleProfile.freshness.stale ? 'true' : 'false'}>{styleProfileFreshnessText(agentEvidence.styleProfile.freshness)}</span>
          )}
          <span>相似度：{sourceSimilarityText(agentEvidence.styleProfile.maxSimilarity)}</span>
        </div>
        <details className="admin-agent-evidence-details">
          <summary>查看生产与审题证据</summary>
          <div className="admin-agent-evidence-grid">
            <div>
              <strong>Agent</strong>
              <p>Generator：{agentEvidence.generator.provider} / {agentEvidence.generator.model}</p>
              <p>Reviewer：{agentEvidence.reviewer.provider} / {agentEvidence.reviewer.model}</p>
              {agentEvidence.intendedUse && <p>用途：{agentEvidence.intendedUse}</p>}
              <p>画像：{agentEvidence.styleProfile.used ? `#${agentEvidence.styleProfile.profileId} · ${agentEvidence.styleProfile.confidence || '-'} · ${agentEvidence.styleProfile.sampleSize ?? '-'} 样本` : `未使用 · ${agentEvidence.styleProfile.sourceKind}`}</p>
              {agentEvidence.styleProfile.used && (
                <p>画像状态：{styleProfileFreshnessText(agentEvidence.styleProfile.freshness)}</p>
              )}
              {agentEvidence.styleProfile.matches.length > 0 && (
                <p>相近样本：{agentEvidence.styleProfile.matches.slice(0, 2).map((match) => `#${match.sourceQuestionId ?? '-'} ${match.questionNumber} · ${sourceSimilarityText(match.similarity)}`).join(' / ')}</p>
              )}
              <p>运行记录：G#{agentEvidence.generator.interactionId} · R#{agentEvidence.reviewer.interactionId}</p>
              <p>画像对齐：{agentEvidence.profileAlignment.status} · {agentEvidence.profileAlignment.score === null ? '-' : `${agentEvidence.profileAlignment.score} 分`}</p>
              {agentEvidence.profileAlignment.reasons.length > 0 && (
                <p className="admin-agent-raw-tags">画像偏差：{agentEvidence.profileAlignment.reasons.join(' / ')}</p>
              )}
            </div>
            <div>
              <strong>门禁</strong>
              <p>{gateLabel(agentEvidence.gate.decision)}</p>
              <p>{reviewExplanation.gateReasons.length ? reviewExplanation.gateReasons.join(' / ') : '无拦截原因'}</p>
              <p>真题相似度：{sourceSimilarityText(agentEvidence.styleProfile.maxSimilarity)}</p>
            </div>
            <div>
              <strong>Rubric</strong>
              <p>考纲 {metadataText(agentEvidence.rubric.syllabusAlignment)} · 答案 {metadataText(agentEvidence.rubric.answerCorrectness)} · 选项 {metadataText(agentEvidence.rubric.optionQuality)}</p>
              <p>解析 {metadataText(agentEvidence.rubric.explanationQuality)} · 难度 {metadataText(agentEvidence.rubric.difficultyMatch)} · 语言 {metadataText(agentEvidence.rubric.languageQuality)}</p>
            </div>
            <div>
              <strong>主要问题</strong>
              <p>{reviewExplanation.issueTexts.length ? reviewExplanation.issueTexts.join(' / ') : '暂无问题'}</p>
              {agentEvidence.issues.length > 0 && (
                <p className="admin-agent-raw-tags">
                  原始：{agentEvidence.issues.slice(0, 4).map((issue) => `${metadataText(issue.severity)}:${metadataText(issue.code)}`).join(' / ')}
                </p>
              )}
            </div>
          </div>
        </details>
      </div>
      <div className="admin-published-question-foot">
        <p>
          题库资产 {formatDate(question.formalAssetUpdatedAt, '-')} · 曝光 {question.exposureCount} · 作答 {question.attemptCount} · 正确 {question.correctCount} · 正确率 {question.accuracy === null ? '-' : `${question.accuracy}%`} · 最近使用 {formatDate(question.lastUsedAt)}
        </p>
        <AdminActionBar>
          <button
            type="button"
            className={reviewBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
            onClick={() => void runAction(reviewActionId, `复审题库资产 Q${question.id}`, () => onReviewQuestion(question.id))}
            disabled={reviewBusy}
          >
            {reviewBusy ? '复审中' : '复审'}
          </button>
          {needsSyllabusConfirmation && (
            <button
              type="button"
              className={confirmSyllabusBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
              onClick={() => void runAction(confirmSyllabusActionId, `确认题目 Q${question.id} 仍适用当前大纲`, () => onConfirmSyllabusQuestion(question.id))}
              disabled={confirmSyllabusBusy}
              title="仅用于大纲版本治理：确认这道已审核题仍符合当前知识点和大纲版本。"
            >
              {confirmSyllabusBusy ? '确认中' : '确认仍适用'}
            </button>
          )}
          <button
            type="button"
            className={archiveBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
            onClick={() => void runAction(archiveActionId, `归档已审核题 Q${question.id}`, () => onArchiveQuestion(question.id))}
            disabled={archiveBusy}
            title="训练题会同步归档训练题库映射；在线模考题只归档可装配题库资产，不影响真题画像源"
          >
            {archiveBusy ? '下架中' : '下架/归档'}
          </button>
          <button
            type="button"
            className={deleteBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
            onClick={() => {
              const confirmed = window.confirm(`确定删除已入库 AI 题 Q${question.id} 吗？这会删除 AI 题、生成任务、曝光记录，以及关联的训练题/模考候选映射；不会删除大纲、真题画像或手工题。`);
              if (!confirmed) return;
              void runAction(deleteActionId, `删除已入库 AI 题 Q${question.id}`, () => onDeleteGeneratedQuestion(question.id));
            }}
            disabled={deleteBusy}
            title="硬删除这道 AI 生成资产和它的生成链路记录，用于清理旧生成结果后重新测试。"
          >
            {deleteBusy ? '删除中' : '删除生成题'}
          </button>
        </AdminActionBar>
      </div>
    </article>
  );
}

export function PublishedQuestionPanel({
  workflowLabel = 'AI',
  destinationLabel = '最终题库',
  items,
  total,
  pageSize,
  pageStart,
  pageEnd,
  isLoading,
  canGoPrevious,
  canGoNext,
  isActionBusy,
  runAction,
  onPreviousPage,
  onNextPage,
  onReviewQuestion,
  onConfirmSyllabusQuestion,
  onArchiveQuestion,
  onDeleteGeneratedQuestion
}: PublishedQuestionPanelProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker={`${workflowLabel}题库资产`} title={`已入库/可装配 AI 题 ${pageStart}-${pageEnd} / ${total}`}>
        <p>这里展示已经通过门禁并进入当前业务线题库资产池的 AI 题；当前线资产会进入{destinationLabel}，科目训练题可被用户侧训练抽取，在线模考题仅用于装配草稿卷，不作为真题画像来源。</p>
      </AdminPanelHeader>
      {items.length === 0 && !isLoading && <p className="form-hint">当前范围还没有已入库/可装配 AI 题。门禁通过并完成入库后，这里才会出现可用资产。</p>}
      <div className="admin-published-question-list">
        {items.map((question) => (
          <PublishedQuestionCard
            key={question.id}
            question={question}
            isActionBusy={isActionBusy}
            runAction={runAction}
            onReviewQuestion={onReviewQuestion}
            onConfirmSyllabusQuestion={onConfirmSyllabusQuestion}
            onArchiveQuestion={onArchiveQuestion}
            onDeleteGeneratedQuestion={onDeleteGeneratedQuestion}
          />
        ))}
      </div>
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
