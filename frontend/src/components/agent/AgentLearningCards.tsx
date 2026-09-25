import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import {
  actOnAgentIntervention,
  confirmAgentAttachmentEvidence,
  rejectAgentAttachmentEvidence,
  revokeAgentAttachmentEvidence,
  startAgentInterventionVerification,
  type AgentAttachmentEvidenceCandidate,
  type AgentInterventionDelivery,
  type AgentInterventionVerification,
  type AgentJourneyOverview,
  type AgentPastPaperResource
} from '../../lib/api-agent';
import type { AdaptiveRoundReport } from '../../lib/api';
import { ApiError } from '../../lib/request';
import { Icon } from '../Icon';
import { AgentAsyncState } from './AgentAsyncState';

function clientRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeAgentActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError || (error instanceof Error && error.message === 'Failed to fetch')) return fallback;
  return error instanceof Error && error.message ? error.message : fallback;
}

function subjectLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  if (value === 'math') return t('agent.subject.math', '数学');
  if (value === 'physics') return t('agent.subject.physics', '物理');
  if (value === 'chemistry') return t('agent.subject.chemistry', '化学');
  return t('agent.subject.general', '综合');
}

export function PastPaperResourceCards({ items, onOpen }: { items: AgentPastPaperResource[]; onOpen: (item: AgentPastPaperResource) => void }) {
  const { t } = useI18n();
  return (
    <div className="agent-past-paper-cards" aria-label={t('agent.pastPaper.results', '真题检索结果')}>
      {items.map((item) => (
        <article key={item.id}>
          <span className="agent-past-paper-card-mark"><Icon name="lucide:file-text" /></span>
          <div>
            <small>{subjectLabel(item.subject, t)}{item.examYear ? ` · ${item.examYear}` : ''}</small>
            <strong>{item.title}</strong>
            <p>{[item.questionCount ? `${item.questionCount} ${t('agent.verification.questions', '题')}` : '', item.pageCount ? `${item.pageCount} ${t('agent.attachment.pages', '页')}` : '', item.hasAnswers ? t('agent.pastPaper.answers', '含答案') : '', item.hasSolutions ? t('agent.pastPaper.solutions', '含解析') : ''].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => onOpen(item)}>{t('agent.pastPaper.open', '在 Agent 内打开')}<Icon name="lucide:arrow-right" /></button>
        </article>
      ))}
    </div>
  );
}

export function AgentJourneyResourcesView({ overview, loading, error, onOpen, onRetry }: { overview: AgentJourneyOverview | null; loading: boolean; error: string; onOpen: (item: AgentPastPaperResource) => void; onRetry: () => void }) {
  const { t } = useI18n();
  const items = overview?.resources.items ?? [];
  return (
    <>
      <section className="agent-context-intro">
        <span className="agent-kicker">{t('agent.journey.resourcesKicker', '可信学习资料')}</span>
        <h2>{t('agent.journey.resourcesTitle', '围绕目标科目使用已发布真题')}</h2>
        <p>{t('agent.journey.resourcesBody', '资料来自已发布题源；打开后仍在 Agent 内作答、求助和记录证据。')}</p>
      </section>
      {loading ? <AgentAsyncState kind="loading" title={t('agent.journey.loadingResources', '正在读取可信资料')} body={t('agent.journey.loadingResourcesBody', '正在查找与你目标科目匹配的已发布真题。')} /> : error ? (
        <AgentAsyncState kind="error" title={t('agent.journey.dataUnavailable', '暂时无法读取学习资料')} body={error} actionLabel={t('agent.journey.retry', '重试读取')} onAction={onRetry} />
      ) : items.length ? <section className="agent-journey-resource-list" aria-label={t('agent.journey.availableResources', '可用学习资料')}>
        {items.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)}>
          <span><Icon name="lucide:file-check-2" /></span>
          <div><small>{subjectLabel(item.subject, t)}{item.examYear ? ` · ${item.examYear}` : ''}</small><strong>{item.title}</strong><em>{item.questionCount ? `${item.questionCount} ${t('agent.verification.questions', '题')}` : t('agent.journey.publishedResource', '已发布资料')}{item.hasAnswers ? ` · ${t('agent.pastPaper.answers', '含答案')}` : ''}</em></div>
          <span className="agent-resource-open">{t('agent.journeyAction.openResource', '打开')}<Icon name="lucide:arrow-right" /></span>
        </button>)}
      </section> : <AgentAsyncState kind="empty" title={t('agent.journey.noResources', '当前没有匹配资料')} body={t('agent.journey.noResourcesBody', '与你目标科目匹配的真题发布后，会自动显示在这里。')} />}
    </>
  );
}

export function EvidenceCandidateCard({ candidate, onChanged }: { candidate: AgentAttachmentEvidenceCandidate; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const topics = candidate.sourceSnapshot?.availableTopics ?? [];
  const trustedMatch = candidate.sourceSnapshot?.trustedMatch;
  const analysisItem = candidate.sourceSnapshot?.analysis;
  const isTrusted = trustedMatch?.status === 'verified_answer';
  const [topicId, setTopicId] = useState(String(candidate.confirmedTopicId ?? candidate.suggestedTopicId ?? topics[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: 'confirm' | 'reject' | 'revoke') => {
    if (busy) return;
    if (action === 'confirm' && !Number(topicId)) return setError(t('agent.evidence.topicRequired', '请先确认对应知识点。'));
    setBusy(true);
    setError('');
    try {
      if (action === 'confirm') await confirmAgentAttachmentEvidence(candidate.id, { clientRequestId: clientRequestId(), topicId: Number(topicId), confirmRecognition: true, confirmAssessment: true });
      if (action === 'reject') await rejectAgentAttachmentEvidence(candidate.id, { clientRequestId: clientRequestId(), reason: 'student_rejected_ai_interpretation' });
      if (action === 'revoke') await revokeAgentAttachmentEvidence(candidate.id, { clientRequestId: clientRequestId(), reason: 'student_requested_retraction' });
      await onChanged();
    } catch (nextError) {
      setError(safeAgentActionError(nextError, t('agent.evidence.actionFailed', '暂时无法更新这条证据。')));
    } finally { setBusy(false); }
  };
  const itemHeading = candidate.analysisItemId ? <div className="agent-evidence-item-heading">
    <span>{analysisItem?.questionNumber ? `${t('agent.evidence.question', '题目')} ${analysisItem.questionNumber}` : `${t('agent.evidence.question', '题目')} ${analysisItem?.ordinal ?? ''}`}</span>
    {analysisItem?.pageNumber && <small>{t('agent.attachment.page', '第')} {analysisItem.pageNumber} {t('agent.attachment.pageUnit', '页')}{analysisItem.region ? ` · ${t('agent.evidence.regionLocated', '已定位区域')}` : ` · ${t('agent.evidence.pageLocated', '页码定位')}`}</small>}
  </div> : null;
  if (candidate.status === 'blocked') return (
    <div className="agent-evidence-card blocked">{itemHeading}<div className="agent-evidence-blocked-copy"><Icon name="lucide:shield-alert" /><span><strong>{t('agent.evidence.blocked', '未写入学习档案')}</strong><small>{t('agent.evidence.blockedReason', '信息不足或无法可靠判断，这次分析仅供参考。')}</small></span></div></div>
  );
  return (
    <div className={`agent-evidence-card ${candidate.status}`}>
      {itemHeading}
      <div className="agent-evidence-copy">
        <Icon name="lucide:badge-check" />
        <span>
          <strong>{candidate.status === 'pending_confirmation' ? t('agent.evidence.pending', '确认是否记入学习档案') : candidate.status === 'confirmed' ? t('agent.evidence.confirmed', '已记入学习档案') : candidate.status === 'revoked' ? t('agent.evidence.revoked', '证据已撤销') : t('agent.evidence.rejected', '已忽略')}</strong>
          <small>{isTrusted ? t('agent.evidence.trustedDisclosure', '已匹配可信题源 · 答案键验证 · 可撤销') : t('agent.evidence.disclosure', 'AI 判断 · 学生确认 · 低权重 · 可撤销')}</small>
        </span>
      </div>
      {isTrusted && <div className="agent-evidence-source"><Icon name="lucide:book-check" /><span><small>{t('agent.evidence.matchedSource', '匹配题源')}</small><strong>{trustedMatch.sourceTitle}</strong></span><em>{Math.round(trustedMatch.promptScore * 100)}%</em></div>}
      {candidate.status === 'pending_confirmation' && <>
        <label><span>{t('agent.evidence.topic', '对应知识点')}</span><select value={topicId} disabled={isTrusted} onChange={(event) => setTopicId(event.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
        <div className="agent-evidence-actions"><button type="button" disabled={busy} onClick={() => void run('confirm')}>{t('agent.evidence.confirm', '确认并更新方案')}</button><button type="button" disabled={busy} onClick={() => void run('reject')}>{t('agent.evidence.reject', '判断不准确')}</button></div>
      </>}
      {candidate.status === 'confirmed' && <button type="button" className="agent-evidence-revoke" disabled={busy} onClick={() => void run('revoke')}>{t('agent.evidence.revoke', '撤销这条证据')}</button>}
      {error && <small className="agent-evidence-error">{error}</small>}
    </div>
  );
}

const INTERVENTION_PLACEHOLDER_PATTERN = /(?:local\s+demo\s+data|golden\s+path|placeholder|fixture|seed(?:ed)?\s+data|test\s+data)/i;
const ACTIVE_INTERVENTION_STATUSES = new Set(['offered', 'in_progress', 'deferred']);

export function isDisplayableIntervention(item: AgentInterventionDelivery | null): item is AgentInterventionDelivery {
  if (!item) return false;
  return ACTIVE_INTERVENTION_STATUSES.has(item.status) && !INTERVENTION_PLACEHOLDER_PATTERN.test([
    item.content.title, item.content.body, item.content.topicTitle, item.reasonSummary, item.content.sourceId
  ].join(' '));
}

export function isInterventionRelevantToReport(item: AgentInterventionDelivery, report: AdaptiveRoundReport) {
  return new Set(report.weakTopics.map((topic) => topic.topicId)).has(item.topicId);
}

function localizedInterventionReason(item: AgentInterventionDelivery, locale: string) {
  if (!locale.toLowerCase().startsWith('zh')) return item.reasonSummary;
  const triggers = new Set(item.triggerCodes);
  if (triggers.has('MISCONCEPTION_REPEATED') || triggers.has('EXPLANATION_FAILED')) return '同一知识点近期反复出错，建议先看一段针对性讲解，再用新题验证。';
  if (triggers.has('STATE_EVIDENCE_CONFLICT')) return '近期作答与原有掌握判断不一致，需要先核对错因并重新验证。';
  if (triggers.has('PRACTICE_YIELD_LOW') || triggers.has('MASTERY_BELOW_BASELINE')) return '继续做相似题的提升有限，先梳理方法和关键概念会更有效。';
  if (triggers.has('ASSISTANCE_DEPENDENCE')) return '近期正确答案较依赖提示，建议先强化独立回忆和完整作答。';
  if (triggers.has('RETENTION_AT_RISK')) return '这个知识点存在遗忘风险，建议安排一次延迟复习。';
  if (triggers.has('EVIDENCE_INSUFFICIENT')) return '当前证据还不足以可靠判断，先继续完成独立作答。';
  return item.reasonSummary;
}

export function InterventionCard({ item, onChanged, onDismissed, onCompleted, onOpenTeaching, embedded = false }: {
  item: AgentInterventionDelivery;
  onChanged: (item: AgentInterventionDelivery) => void;
  onDismissed: () => void;
  onCompleted?: () => void;
  onOpenTeaching: (item: AgentInterventionDelivery) => void;
  embedded?: boolean;
}) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: 'start' | 'complete' | 'defer' | 'skip') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = await actOnAgentIntervention(item.id, { clientRequestId: clientRequestId(), action });
      if (action === 'complete') { onDismissed(); onCompleted?.(); }
      else if (action === 'defer' || action === 'skip') onDismissed();
      else {
        onChanged(updated);
        if (updated.content.teachingAsset) onOpenTeaching(updated);
      }
    } catch (nextError) {
      setError(safeAgentActionError(nextError, t('agent.intervention.actionFailed', '暂时无法更新这项讲解。')));
    } finally { setBusy(false); }
  };
  const isReading = item.status === 'in_progress';
  return (
    <article className={`agent-intervention-card${embedded ? ' is-embedded' : ''}${isReading ? ' is-reading' : ''}`}>
      <div className="agent-intervention-mark"><Icon name="lucide:book-open-check" /></div>
      <div className="agent-intervention-copy">
        <span className="agent-kicker">{embedded ? t('agent.intervention.reportKicker', '针对本轮 · 巩固建议') : t('agent.intervention.kicker', '学习间隔 · 系统建议')}</span>
        <h3>{item.content.title || item.content.topicTitle}</h3>
        <p>{isReading ? item.content.body : localizedInterventionReason(item, locale)}</p>
        <small><Icon name="lucide:shield-check" />{item.content.sourceType === 'teaching_asset'
          ? t('agent.intervention.reviewedAsset', '内容来自已审核交互微课')
          : item.content.sourceType === 'concept_card'
            ? t('agent.intervention.reviewedCard', '内容来自已审核知识卡片')
            : t('agent.intervention.reviewedExplanation', '内容来自已审核标准解析')}</small>
        {error && <em role="alert">{error}</em>}
      </div>
      <div className="agent-intervention-actions">
        {isReading
          ? <button type="button" disabled={busy} onClick={() => onOpenTeaching(item)}>{t('agent.intervention.continue', '继续学习')}</button>
          : <button type="button" disabled={busy} onClick={() => void run('start')}>{t('agent.intervention.start', '开始学习')}</button>}
        <button type="button" disabled={busy} onClick={() => void run('defer')}>{t('agent.intervention.later', '稍后')}</button>
        <button type="button" disabled={busy} onClick={() => void run('skip')}>{embedded ? t('agent.intervention.notNeeded', '不需要') : t('agent.intervention.skip', '跳过')}</button>
      </div>
    </article>
  );
}

export function InterventionVerificationCard({ item, questionLanguage, onOpen }: { item: AgentInterventionVerification; questionLanguage: 'zh' | 'en'; onOpen: (item: AgentInterventionVerification, path: string) => void }) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phaseCopy = item.phase === 'retention'
    ? { kicker: t('agent.verification.retentionKicker', '延迟保持验证'), title: t('agent.verification.retentionTitle', '隔一段时间后，确认这个知识点还记得'), body: t('agent.verification.retentionBody', '系统刻意延迟了这组题，用来区分短时记忆和稳定掌握。') }
    : item.phase === 'transfer'
      ? { kicker: t('agent.verification.transferKicker', '跨题型迁移验证'), title: t('agent.verification.transferTitle', '换一种题目结构，确认知识能真正迁移'), body: t('agent.verification.transferBody', '题目仍属于同一知识点，但任务结构与之前不同。') }
      : { kicker: t('agent.verification.kicker', '讲解后的独立验证'), title: t('agent.verification.title', '现在用一组短任务确认是否真正掌握'), body: t('agent.verification.body', '提交前不显示答案、解析或提示，结果将用于更新下一步方案。') };
  const start = async () => {
    if (busy) return;
    if (item.status === 'started' && item.route) return onOpen(item, item.route);
    setBusy(true);
    setError('');
    try {
      const started = await startAgentInterventionVerification(item.id, { clientRequestId: clientRequestId(), questionLanguage });
      if (!started.route) throw new Error(t('agent.verification.routeMissing', '验证任务入口暂不可用。'));
      onOpen(started, started.route);
    } catch (nextError) {
      setError(safeAgentActionError(nextError, t('agent.verification.startFailed', '暂时无法开始验证。')));
      setBusy(false);
    }
  };
  return (
    <article className="agent-verification-card">
      <span className="agent-verification-index">03</span>
      <div>
        <span className="agent-kicker">{phaseCopy.kicker}</span>
        <h3>{phaseCopy.title}</h3>
        <p>{item.topicTitle} · {item.questionCount} {t('agent.verification.questions', '题')}。{phaseCopy.body}</p>
        <small><Icon name="lucide:shield-check" />{t('agent.verification.source', '仅使用已审核、未曝光的可信题目')}</small>
        {error && <em role="alert">{error}</em>}
      </div>
      <button type="button" disabled={busy} onClick={() => void start()}>
        {busy ? t('agent.verification.starting', '正在准备') : item.status === 'started' ? t('agent.verification.continue', '继续验证') : t('agent.verification.start', '开始验证')}
        <Icon name="lucide:arrow-right" />
      </button>
    </article>
  );
}
