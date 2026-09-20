import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { MathContent } from '../components/MathContent';
import { UserAvatar } from '../components/UserAvatar';
import { AgentPastPaperWorkspace } from '../components/agent/AgentPastPaperWorkspace';
import { AgentLearningSettingsView } from '../components/agent/AgentLearningSettingsView';
import { AgentAdaptiveResultMessage, AgentMockExamResultMessage } from '../components/agent/AgentStructuredReportMessage';
import { useI18n } from '../i18n/useI18n';
import { isAgentWebEnabled } from '../lib/agent-feature';
import {
  actOnAgentIntervention,
  confirmAgentAttachmentEvidence,
  continueAgentFreePractice,
  createAgentConversation,
  endAgentFreePractice,
  getAgentConversation,
  getAgentJourneyOverview,
  getAgentJourneyState,
  getAgentRun,
  listAgentConversations,
  offerAgentIntervention,
  offerAgentInterventionVerification,
  recordAgentInterventionTeachingInteraction,
  previewAgentAttachment,
  rejectAgentAttachmentEvidence,
  revokeAgentAttachmentEvidence,
  settleAgentPractice,
  settleAgentMockExam,
  startAgentFreePractice,
  startAgentMockExam,
  startAgentPractice,
  startAgentInterventionVerification,
  streamAgentRunEvents,
  submitAgentMessage,
  type AgentAttachment,
  type AgentAttachmentEvidenceCandidate,
  type AgentArtifact,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentInterventionDelivery,
  type AgentInterventionVerification,
  type AgentJourneyOverview,
  type AgentJourneyResumeWorkspace,
  type AgentJourneyStage,
  type AgentJourneyState,
  type AgentMockExamLaunch,
  type AgentMockExamSettlement,
  type AgentPracticeLaunch,
  type AgentPastPaperResource,
  type AgentStreamEvent
} from '../lib/api-agent';
import { TeachingAssetRenderer } from '../components/agent/TeachingAssetRegistry';
import {
  AdaptiveRoundView,
  type AgentPracticeAssistanceCommand,
  type AgentPracticeAssistanceEvent,
  type AgentPracticeQuestionContext,
  type AgentPracticeTeachingEvent
} from './special-practice/adaptive/AdaptivePracticeViews';
import { MockExamTakingView } from './CscaMockExamPage';
import type { AdaptiveRoundReport, User } from '../lib/api';
import { routes } from '../lib/routes';
import { readMigratedLocalStorage, writeMigratedLocalStorage } from '../lib/storage-compat';
import '../styles/agent.css';

type AgentPageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onNavigate: (path: string) => void;
  onAuthRedirect: (path: string) => void;
};

const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);
const AGENT_TASK_RAIL_DEFAULT_WIDTH = 520;
const AGENT_TASK_RAIL_MIN_WIDTH = 380;
const AGENT_TASK_RAIL_STORAGE_KEY = 'moodlelike.agent.taskRailWidth';
const AGENT_TASK_RAIL_POSITION_STORAGE_KEY = 'moodlelike.agent.taskRailPosition';
const AGENT_JOURNEY_SECTION_STORAGE_KEY = 'moodlelike.agent.journeySection';
const AGENT_LEARNING_MODE_STORAGE_KEY = 'moodlelike.agent.learningMode';
const AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY = 'moodlelike.agent.freePracticeSubject';
const AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY = 'moodlelike.agent.freePracticeCount';
const LEGACY_AGENT_TASK_RAIL_STORAGE_KEY = 'cscalite.agent.taskRailWidth';
const LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY = 'cscalite.agent.taskRailPosition';
const LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY = 'cscalite.agent.journeySection';
const LEGACY_AGENT_LEARNING_MODE_STORAGE_KEY = 'cscalite.agent.learningMode';
const LEGACY_AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY = 'cscalite.agent.freePracticeSubject';
const LEGACY_AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY = 'cscalite.agent.freePracticeCount';
const AGENT_INITIAL_LOAD_RETRY_MAX_DELAY_MS = 5000;

type AgentJourneySection = 'today' | 'plan' | 'history' | 'weakness' | 'resources' | 'qa' | 'settings';

function clientRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function isAgentConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed');
}

function journeyDateLabel(value: string | null | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en', {
    month: 'short', day: 'numeric'
  }).format(date);
}

function formatFileSize(value: number | null) {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function subjectLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  if (value === 'math') return t('agent.subject.math', '数学');
  if (value === 'physics') return t('agent.subject.physics', '物理');
  if (value === 'chemistry') return t('agent.subject.chemistry', '化学');
  return t('agent.subject.general', '综合');
}

function taskLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  const labels: Record<string, string> = {
    diagnostic: t('agent.task.diagnostic', '短诊断'),
    review: t('agent.task.review', '错题复习'),
    targeted_practice: t('agent.task.targetedPractice', '针对性练习'),
    mock_exam: t('agent.task.mockExam', '在线模考'),
    concept_learning: t('agent.task.conceptLearning', '知识点讲解'),
    intervention_verification: t('agent.task.interventionVerification', '阶段验证'),
    free_practice: t('agent.task.freePractice', '自由练习')
  };
  return labels[String(value)] ?? t('agent.task.learning', '学习任务');
}

type AgentDecisionImpact = {
  status: 'stable_mastery_confirmed' | 'consolidation_required' | 'evidence_inconclusive' | 'verification_scheduled' | 'phase_recorded' | string;
  currentPhase?: 'immediate' | 'retention' | 'transfer';
  currentPhaseResult?: 'passed' | 'failed' | 'inconclusive' | null;
  completedPhaseCount?: number;
  passedPhaseCount?: number;
  nextDueAt?: string | null;
};

function decisionImpact(snapshot: Record<string, unknown> | null | undefined): AgentDecisionImpact | null {
  const value = snapshot?.decisionImpact;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const impact = value as Record<string, unknown>;
  return typeof impact.status === 'string' ? impact as AgentDecisionImpact : null;
}

function decisionImpactCopy(impact: AgentDecisionImpact | null, t: (key: string, fallback?: string) => string) {
  if (!impact) return null;
  if (impact.status === 'stable_mastery_confirmed') return {
    icon: 'lucide:badge-check',
    title: t('agent.journey.impactStable', '已确认稳定掌握'),
    body: t('agent.journey.impactStableBody', '三阶段验证通过，系统已将下一任务移向新的最高优先级差距。')
  };
  if (impact.status === 'consolidation_required') return {
    icon: 'lucide:rotate-ccw',
    title: t('agent.journey.impactConsolidate', '继续巩固'),
    body: t('agent.journey.impactConsolidateBody', '阶段验证尚未稳定，当前知识点仍保留在优先计划中。')
  };
  if (impact.status === 'evidence_inconclusive') return {
    icon: 'lucide:circle-help',
    title: t('agent.journey.impactInconclusive', '等待更多证据'),
    body: t('agent.journey.impactInconclusiveBody', '本轮证据不足，系统没有提高掌握判断。')
  };
  if (impact.status === 'verification_scheduled') return {
    icon: 'lucide:calendar-clock',
    title: t('agent.journey.impactScheduled', '后续验证已安排'),
    body: t('agent.journey.impactScheduledBody', '当前阶段已记录，保持或迁移验证将在到期后进入计划。')
  };
  return {
    icon: 'lucide:check-check',
    title: t('agent.journey.impactRecorded', '阶段结果已记录'),
    body: t('agent.journey.impactRecordedBody', '本次独立作答结果已进入学习决策。')
  };
}

function assessmentLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  if (value === 'correct') return t('agent.analysis.correct', '正确');
  if (value === 'incorrect') return t('agent.analysis.incorrect', '需要订正');
  if (value === 'partially_correct') return t('agent.analysis.partiallyCorrect', '部分正确');
  return t('agent.analysis.notAssessable', '暂不能判断');
}

function PastPaperResourceCards({ items, onOpen }: { items: AgentPastPaperResource[]; onOpen: (item: AgentPastPaperResource) => void }) {
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

type AgentLearningWorkspace = {
  artifactId?: string;
  verificationId?: string;
  conversationId: string;
  roundId: number;
  phase: 'practice' | 'report';
  taskType?: string;
  subject?: string;
};

type AgentMockExamWorkspace = {
  artifactId: string;
  conversationId: string;
  attemptId: number;
  phase: 'taking' | 'report';
  subject?: string;
  paperTitle?: string;
};

type AgentTaskLaunch = AgentPracticeLaunch | AgentMockExamLaunch;

function PlanArtifactCard({ artifact, onLaunch, onUseFreePractice }: { artifact: AgentArtifact; onLaunch: (launch: AgentTaskLaunch) => void; onUseFreePractice?: () => void }) {
  const { locale, t } = useI18n();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const snapshot = artifact.snapshot ?? {};
  const task = snapshot.task && typeof snapshot.task === 'object' ? snapshot.task as Record<string, unknown> : {};
  const review = snapshot.review && typeof snapshot.review === 'object' ? snapshot.review as Record<string, unknown> : null;
  const subject = subjectLabel(task.subject, t);
  const taskType = taskLabel(task.type, t);
  const minutes = Number(snapshot.estimatedMinutes ?? 0);
  const questionCount = Number(task.questionCount ?? 0);
  const confidence = String(snapshot.confidence ?? 'medium');
  const isFreePractice = task.type === 'free_practice';
  const isInterventionVerification = task.type === 'intervention_verification';
  const canStart = snapshot.canStart === true && Boolean(artifact.route) && artifact.status === 'ready';
  const canUseFreePractice = !isFreePractice && !canStart && !isInterventionVerification && artifact.status === 'ready' && Boolean(onUseFreePractice);
  const stateClass = artifact.status === 'completed'
    ? 'is-completed'
    : isFreePractice
      ? 'is-in-progress'
      : canStart
        ? 'is-actionable'
        : 'is-unavailable';
  return (
    <article className={`agent-plan-card ${stateClass}`} aria-label={isFreePractice ? t('agent.freePractice.taskAria', '自由练习任务') : t('agent.plan.aria', '今日学习方案')}>
      <div className="agent-plan-ribbon" aria-hidden="true" />
      <header className="agent-plan-head">
        <span className="agent-plan-subject" data-subject={String(task.subject ?? '')}>{subject.slice(0, 1)}</span>
        <div>
          <span className="agent-kicker"><Icon name={isFreePractice ? 'lucide:infinity' : 'lucide:sparkles'} />{isFreePractice ? t('agent.freePractice.taskKicker', '学生主动 · 自由练习') : t('agent.plan.kicker', '系统推荐 · 今日首选')}</span>
          <h3>{artifact.title}</h3>
          {artifact.summary && <p>{artifact.summary}</p>}
        </div>
      </header>
      <div className="agent-plan-metrics">
        <span><small>{t('agent.plan.task', '任务')}</small><strong>{taskType}</strong></span>
        <span><small>{t('agent.plan.subject', '科目')}</small><strong>{subject}</strong></span>
        <span><small>{t('agent.plan.duration', '预计')}</small><strong>{minutes ? `${minutes} min` : '—'}</strong></span>
        <span><small>{t('agent.plan.volume', '题量')}</small><strong>{questionCount || '—'}</strong></span>
      </div>
      <div className="agent-plan-reason">
        <Icon name="lucide:route" />
        <span>
          <small>{isFreePractice ? t('agent.freePractice.startBasis', '开始方式') : t('agent.plan.basis', '推荐依据')}</small>
          <strong>{isFreePractice ? t('agent.freePractice.studentChoice', '由你选择科目和本批题量') : <>{t('agent.plan.basisValue', '当前最高优先级学习差距')} · {t(`agent.confidence.${confidence}`, confidence)}</>}</strong>
          {review && <em>{String(review.title ?? '')} · {t('agent.plan.repeated', '累计错误')} {Number(review.recurrenceCount ?? 1)} {t('agent.plan.times', '次')}</em>}
        </span>
      </div>
      <footer>
        <span className="agent-source-note"><Icon name="lucide:shield-check" />{isFreePractice ? t('agent.freePractice.taskSource', '共用已发布题源与同一学习历程') : t('agent.plan.source', '来自学习证据、目标与已发布题源')}</span>
        <button
          type="button"
          disabled={(!canStart && !canUseFreePractice) || isStarting}
          onClick={() => {
            if (isStarting) return;
            if (canUseFreePractice) {
              onUseFreePractice?.();
              return;
            }
            if (!canStart) return;
            setIsStarting(true);
            setStartError('');
            const start = task.type === 'mock_exam' ? startAgentMockExam : startAgentPractice;
            void start(artifact.id, {
              clientRequestId: clientRequestId(),
              questionLanguage: locale === 'zh-CN' ? 'zh' : 'en'
            }).then(onLaunch).catch((nextError) => {
              setStartError(nextError instanceof Error ? nextError.message : t('agent.plan.startFailed', '暂时无法创建练习，请重试。'));
              setIsStarting(false);
            });
          }}
        >
          {isStarting
            ? t('agent.plan.starting', '正在创建练习')
            : artifact.status === 'completed'
              ? t('agent.plan.completed', '任务已完成')
              : artifact.status === 'failed'
                ? t('agent.plan.repairNeeded', '需要继续补强')
                : artifact.status === 'abandoned'
                  ? t('agent.plan.abandoned', '任务已放弃')
                  : artifact.status === 'superseded'
                    ? t('agent.plan.superseded', '方案已更新')
                    : isFreePractice
                      ? t('agent.freePractice.inProgress', '本次练习已开始')
                    : isInterventionVerification
                      ? t('agent.plan.useVerificationCard', '请在下方开始阶段验证')
                      : canStart
                        ? t('agent.plan.start', '开始这项任务')
                        : canUseFreePractice
                          ? t('agent.plan.useFreePractice', '改做自由练习')
                          : t('agent.plan.unavailable', '题源暂不足')}
          <Icon name={canStart ? 'lucide:arrow-right' : canUseFreePractice ? 'lucide:shuffle' : isFreePractice ? 'lucide:circle-check' : isInterventionVerification ? 'lucide:clock-3' : 'lucide:circle-alert'} />
        </button>
      </footer>
      {startError && <p className="agent-plan-error" role="alert">{startError}</p>}
    </article>
  );
}

function AgentJourneyPlanView({ conversation }: { conversation: AgentConversation | null }) {
  const { locale, t } = useI18n();
  const plans = (conversation?.artifacts ?? [])
    .filter((item) => item.type === 'learning_plan')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const current = plans[0];
  const snapshot = current?.snapshot ?? {};
  const task = snapshot.task && typeof snapshot.task === 'object' ? snapshot.task as Record<string, unknown> : {};
  const impact = decisionImpact(snapshot);
  const impactCopy = decisionImpactCopy(impact, t);
  return (
    <>
      <section className="agent-context-intro">
        <span className="agent-kicker">{t('agent.journey.planKicker', '当前计划')}</span>
        <h2>{t('agent.journey.planTitle', '围绕目标，只保留一个明确的下一步')}</h2>
        <p>{t('agent.journey.planBody', '这里读取 Agent 已生成并保存的方案，不用临时文案伪造进度。')}</p>
      </section>
      {current ? (
        <section className="agent-journey-plan-card" aria-label={t('agent.journey.currentPlan', '当前学习计划')}>
          <header><span><Icon name="lucide:calendar-check" /></span><small>{journeyDateLabel(current.createdAt, locale)}</small></header>
          <strong>{current.title}</strong>
          {current.summary && <p>{current.summary}</p>}
          <dl>
            <div><dt>{t('agent.plan.task', '任务')}</dt><dd>{taskLabel(task.type, t)}</dd></div>
            <div><dt>{t('agent.plan.subject', '科目')}</dt><dd>{subjectLabel(task.subject, t)}</dd></div>
            <div><dt>{t('agent.plan.duration', '预计')}</dt><dd>{Number(snapshot.estimatedMinutes ?? 0) ? `${Number(snapshot.estimatedMinutes)} min` : '—'}</dd></div>
            <div><dt>{t('agent.plan.volume', '题量')}</dt><dd>{Number(task.questionCount ?? 0) || '—'}</dd></div>
          </dl>
          {impact && impactCopy && (
            <section className={`agent-journey-impact is-${impact.status}`} aria-label={t('agent.journey.decisionImpact', '学习决策变化')}>
              <Icon name={impactCopy.icon} />
              <span><small>{t('agent.journey.decisionImpact', '学习决策变化')}</small><strong>{impactCopy.title}</strong><p>{impactCopy.body}</p></span>
              <em>{Math.max(0, Number(impact.passedPhaseCount ?? 0))}/{Math.max(1, Number(impact.completedPhaseCount ?? 0)) || 1}</em>
            </section>
          )}
          <footer><Icon name="lucide:shield-check" />{t('agent.plan.source', '来自学习证据、目标与已发布题源')}</footer>
        </section>
      ) : (
        <section className="agent-journey-empty"><Icon name="lucide:calendar-days" /><strong>{t('agent.journey.noPlan', '还没有可用计划')}</strong><p>{t('agent.journey.noPlanBody', '返回学习工作台生成今日方案，系统会先核对目标、证据和题源。')}</p></section>
      )}
      {plans.length > 1 && (
        <section className="agent-context-card agent-plan-versions">
          <header><Icon name="lucide:layers-3" /><strong>{t('agent.journey.planVersions', '计划版本')}</strong></header>
          {plans.slice(1, 4).map((item) => <p key={item.id}><b>{item.title}</b><span>{journeyDateLabel(item.createdAt, locale)}</span></p>)}
        </section>
      )}
    </>
  );
}

function AgentJourneyHistoryView({ stages, activeId, loading, onSelect }: { stages: AgentJourneyStage[]; activeId: string | null; loading: boolean; onSelect: (stage: AgentJourneyStage) => void }) {
  const { locale, t } = useI18n();
  return (
    <>
      <section className="agent-context-intro">
        <span className="agent-kicker">{t('agent.journey.historyKicker', '学习历程')}</span>
        <h2>{t('agent.journey.historyTitle', '看见做过什么，以及下一步如何变化')}</h2>
        <p>{t('agent.journey.historyBody', '内部会话只作为可恢复的学习阶段，不要求你管理多个聊天。')}</p>
      </section>
      <section className="agent-journey-history-view" aria-label={t('agent.journey.savedStages', '已保存的学习阶段')}>
        {loading ? <div className="agent-journey-loading"><Icon name="lucide:loader-circle" />{t('agent.journey.loadingHistory', '正在整理学习历程')}</div> : stages.length ? stages.map((stage) => {
          const detail = [
            subjectLabel(stage.subject, t), taskLabel(stage.taskType, t),
            stage.metrics.batchCount > 1 ? `${stage.metrics.batchCount} ${t('agent.freePractice.batches', '批')}` : '',
            stage.metrics.answeredQuestionCount ? `${stage.metrics.answeredQuestionCount} ${t('agent.freePractice.questions', '题')}` : '',
            stage.metrics.accuracy !== null ? `${stage.metrics.accuracy}%` : '',
            stage.metrics.assistanceCount ? `${stage.metrics.assistanceCount} ${t('agent.journey.assistanceUses', '次辅助')}` : '',
            stage.metrics.teachingCount ? `${stage.metrics.teachingCount} ${t('agent.journey.teachingUses', '次教学')}` : ''
          ].filter(Boolean).join(' · ');
          return (
            <button key={stage.id} type="button" className={stage.conversationId === activeId ? 'active' : ''} onClick={() => onSelect(stage)}>
              <span className={`agent-journey-stage-mark${stage.resume ? ' is-active' : ''}`}><Icon name={stage.resume ? 'lucide:play' : stage.kind === 'teaching' ? 'lucide:presentation' : stage.kind === 'mock_exam' ? 'lucide:timer' : stage.kind === 'past_paper' ? 'lucide:file-text' : 'lucide:clock-3'} /></span>
              <span><small>{journeyDateLabel(stage.updatedAt, locale)}{stage.resume ? ` · ${t('agent.journey.canResume', '可继续')}` : ''}</small><strong>{stage.title || t('agent.history.untitled', '学习阶段')}</strong><em>{detail}</em></span>
              <Icon name="lucide:chevron-right" />
            </button>
          );
        }) : <div className="agent-journey-empty"><Icon name="lucide:clock-3" /><strong>{t('agent.journey.emptyTitle', '历程会从第一次学习开始')}</strong><p>{t('agent.journey.empty', '完成第一项学习任务后，这里会形成学习历程。')}</p></div>}
      </section>
    </>
  );
}

function AgentJourneyWeaknessView({ overview, loading, error }: { overview: AgentJourneyOverview | null; loading: boolean; error: string }) {
  const { t } = useI18n();
  const topics = (overview?.weaknesses.subjects ?? []).flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subject: subject.subject })))
    .sort((left, right) => left.score - right.score || left.confidence - right.confidence)
    .slice(0, 8);
  const reviewQueue = overview?.weaknesses.reviewQueue ?? [];
  return (
    <>
      <section className="agent-context-intro">
        <span className="agent-kicker">{t('agent.journey.weaknessKicker', '真实学习证据')}</span>
        <h2>{t('agent.journey.weaknessTitle', '先处理最影响下一步的薄弱点')}</h2>
        <p>{t('agent.journey.weaknessBody', '这里只读取已投影的作答证据和复习队列，不根据聊天内容猜测掌握度。')}</p>
      </section>
      {loading ? <div className="agent-journey-loading"><Icon name="lucide:loader-circle" />{t('agent.journey.loadingWeakness', '正在读取学习证据')}</div> : error ? (
        <section className="agent-journey-empty"><Icon name="lucide:circle-alert" /><strong>{t('agent.journey.dataUnavailable', '暂时无法读取')}</strong><p>{error}</p></section>
      ) : topics.length || reviewQueue.length ? <>
        <section className="agent-journey-topic-list" aria-label={t('agent.journey.weakTopics', '薄弱知识点')}>
          {topics.map((topic) => <article key={`${topic.subject}-${topic.topicId}`}>
            <span data-subject={topic.subject}>{subjectLabel(topic.subject, t).slice(0, 1)}</span>
            <div><small>{subjectLabel(topic.subject, t)} · {topic.code}</small><strong>{topic.title}</strong><em>{topic.attemptCount} {t('agent.journey.attempts', '次作答')} · {Math.round(topic.score * 100)}%</em></div>
            <i style={{ '--agent-evidence-score': `${Math.max(4, Math.round(topic.score * 100))}%` } as CSSProperties} />
          </article>)}
        </section>
        {reviewQueue.length ? <section className="agent-context-card agent-review-queue"><header><Icon name="lucide:refresh-cw" /><strong>{t('agent.journey.reviewQueue', '待复习')}</strong></header>{reviewQueue.slice(0, 5).map((item) => <p key={item.reviewItemId}><b>{item.title}</b><span>{item.recurrenceCount} {t('agent.journey.recurrences', '次重复错误')}</span></p>)}</section> : null}
      </> : <section className="agent-journey-empty"><Icon name="lucide:scan-search" /><strong>{t('agent.journey.noWeakness', '还没有足够证据')}</strong><p>{t('agent.journey.noWeaknessBody', '完成诊断或练习后，薄弱知识点会出现在这里。')}</p></section>}
    </>
  );
}

function AgentJourneyResourcesView({ overview, loading, error, onOpen }: { overview: AgentJourneyOverview | null; loading: boolean; error: string; onOpen: (item: AgentPastPaperResource) => void }) {
  const { t } = useI18n();
  const items = overview?.resources.items ?? [];
  return (
    <>
      <section className="agent-context-intro">
        <span className="agent-kicker">{t('agent.journey.resourcesKicker', '可信学习资料')}</span>
        <h2>{t('agent.journey.resourcesTitle', '围绕目标科目使用已发布真题')}</h2>
        <p>{t('agent.journey.resourcesBody', '资料来自已发布题源；打开后仍在 Agent 内作答、求助和记录证据。')}</p>
      </section>
      {loading ? <div className="agent-journey-loading"><Icon name="lucide:loader-circle" />{t('agent.journey.loadingResources', '正在读取可信资料')}</div> : error ? (
        <section className="agent-journey-empty"><Icon name="lucide:circle-alert" /><strong>{t('agent.journey.dataUnavailable', '暂时无法读取')}</strong><p>{error}</p></section>
      ) : items.length ? <section className="agent-journey-resource-list" aria-label={t('agent.journey.availableResources', '可用学习资料')}>
        {items.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)}>
          <span><Icon name="lucide:file-check-2" /></span>
          <div><small>{subjectLabel(item.subject, t)}{item.examYear ? ` · ${item.examYear}` : ''}</small><strong>{item.title}</strong><em>{item.questionCount ? `${item.questionCount} ${t('agent.verification.questions', '题')}` : t('agent.journey.publishedResource', '已发布资料')}{item.hasAnswers ? ` · ${t('agent.pastPaper.answers', '含答案')}` : ''}</em></div>
          <Icon name="lucide:arrow-up-right" />
        </button>)}
      </section> : <section className="agent-journey-empty"><Icon name="lucide:library" /><strong>{t('agent.journey.noResources', '当前没有匹配资料')}</strong><p>{t('agent.journey.noResourcesBody', '发布与你目标科目匹配的真题后会显示在这里。')}</p></section>}
    </>
  );
}

function EvidenceCandidateCard({ candidate, onChanged }: { candidate: AgentAttachmentEvidenceCandidate; onChanged: () => Promise<void> }) {
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
      setError(nextError instanceof Error ? nextError.message : t('agent.evidence.actionFailed', '暂时无法更新这条证据。'));
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

function isDisplayableIntervention(item: AgentInterventionDelivery | null): item is AgentInterventionDelivery {
  if (!item) return false;
  return !INTERVENTION_PLACEHOLDER_PATTERN.test([
    item.content.title,
    item.content.body,
    item.content.topicTitle,
    item.reasonSummary,
    item.content.sourceId
  ].join(' '));
}

function isInterventionRelevantToReport(item: AgentInterventionDelivery, report: AdaptiveRoundReport) {
  const weakTopicIds = new Set(report.weakTopics.map((topic) => topic.topicId));
  return weakTopicIds.has(item.topicId);
}

function InterventionCard({ item, onChanged, onDismissed, onCompleted, onOpenTeaching, embedded = false }: {
  item: AgentInterventionDelivery;
  onChanged: (item: AgentInterventionDelivery) => void;
  onDismissed: () => void;
  onCompleted?: () => void;
  onOpenTeaching: (item: AgentInterventionDelivery) => void;
  embedded?: boolean;
}) {
  const { t } = useI18n();
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
      setError(nextError instanceof Error ? nextError.message : t('agent.intervention.actionFailed', '暂时无法更新这项讲解。'));
    } finally { setBusy(false); }
  };
  const isReading = item.status === 'in_progress';
  return (
    <article className={`agent-intervention-card${embedded ? ' is-embedded' : ''}${isReading ? ' is-reading' : ''}`}>
      <div className="agent-intervention-mark"><Icon name="lucide:book-open-check" /></div>
      <div className="agent-intervention-copy">
        <span className="agent-kicker">{embedded ? t('agent.intervention.reportKicker', '针对本轮 · 巩固建议') : t('agent.intervention.kicker', '学习间隔 · 系统建议')}</span>
        <h3>{item.content.title || item.content.topicTitle}</h3>
        <p>{isReading ? item.content.body : item.reasonSummary}</p>
        <small><Icon name="lucide:shield-check" />{item.content.sourceType === 'teaching_asset'
          ? t('agent.intervention.reviewedAsset', '内容来自已审核交互微课')
          : item.content.sourceType === 'concept_card'
            ? t('agent.intervention.reviewedCard', '内容来自已审核知识卡片')
            : t('agent.intervention.reviewedExplanation', '内容来自已审核标准解析')}</small>
        {error && <em role="alert">{error}</em>}
      </div>
      <div className="agent-intervention-actions">
        {isReading ? (
          <button type="button" disabled={busy} onClick={() => onOpenTeaching(item)}>{t('agent.intervention.continue', '继续学习')}</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void run('start')}>{t('agent.intervention.start', '开始学习')}</button>
        )}
        <button type="button" disabled={busy} onClick={() => void run('defer')}>{t('agent.intervention.later', '稍后')}</button>
        <button type="button" disabled={busy} onClick={() => void run('skip')}>{embedded ? t('agent.intervention.notNeeded', '不需要') : t('agent.intervention.skip', '跳过')}</button>
      </div>
    </article>
  );
}

function InterventionVerificationCard({ item, onOpen }: { item: AgentInterventionVerification; onOpen: (item: AgentInterventionVerification, path: string) => void }) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phaseCopy = item.phase === 'retention'
    ? {
        kicker: t('agent.verification.retentionKicker', '延迟保持验证'),
        title: t('agent.verification.retentionTitle', '隔一段时间后，确认这个知识点还记得'),
        body: t('agent.verification.retentionBody', '系统刻意延迟了这组题，用来区分短时记忆和稳定掌握。')
      }
    : item.phase === 'transfer'
      ? {
          kicker: t('agent.verification.transferKicker', '跨题型迁移验证'),
          title: t('agent.verification.transferTitle', '换一种题目结构，确认知识能真正迁移'),
          body: t('agent.verification.transferBody', '题目仍属于同一知识点，但任务结构与之前不同。')
        }
      : {
          kicker: t('agent.verification.kicker', '讲解后的独立验证'),
          title: t('agent.verification.title', '现在用一组短任务确认是否真正掌握'),
          body: t('agent.verification.body', '提交前不显示答案、解析或提示，结果将用于更新下一步方案。')
        };
  const start = async () => {
    if (busy) return;
    if (item.status === 'started' && item.route) return onOpen(item, item.route);
    setBusy(true);
    setError('');
    try {
      const started = await startAgentInterventionVerification(item.id, {
        clientRequestId: clientRequestId(), questionLanguage: locale === 'zh-CN' ? 'zh' : 'en'
      });
      if (!started.route) throw new Error(t('agent.verification.routeMissing', '验证任务入口暂不可用。'));
      onOpen(started, started.route);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('agent.verification.startFailed', '暂时无法开始验证。'));
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

function AgentEmptyState({ user, onPrompt }: { user: User; onPrompt: (value: string) => void }) {
  const { t } = useI18n();
  const displayName = user.displayName || user.email.split('@')[0];
  const primaryPrompt = t('agent.empty.primaryPrompt', '我今天该学什么？');
  return (
    <section className="agent-empty-state">
      <div className="agent-empty-intro">
        <UserAvatar user={user} size="lg" />
        <span className="agent-kicker"><Icon name="lucide:sparkles" />{t('agent.empty.kicker', 'CSCA 学习 Agent')}</span>
        <h1>{t('agent.empty.greeting', '你好')}，{displayName}</h1>
        <h2>{t('agent.empty.title', '今天不用自己猜下一步。')}</h2>
        <p>{t('agent.empty.body', '系统会结合你的目标、真实答题证据和当前题源，先给出一项最值得完成的学习任务。')}</p>
        <button type="button" className="agent-primary-action" onClick={() => onPrompt(primaryPrompt)}>
          <Icon name="lucide:wand-sparkles" />{primaryPrompt}<Icon name="lucide:arrow-right" />
        </button>
      </div>
      <div className="agent-method-strip" aria-label={t('agent.empty.methodAria', '方案生成过程')}>
        <span><b>01</b>{t('agent.empty.methodGoal', '确认目标')}</span>
        <span><b>02</b>{t('agent.empty.methodEvidence', '读取学习证据')}</span>
        <span><b>03</b>{t('agent.empty.methodPlan', '给出一个首选任务')}</span>
      </div>
    </section>
  );
}

function SubjectQaEmptyState() {
  const { t } = useI18n();
  return (
    <section className="agent-subject-qa-empty">
      <span><Icon name="lucide:messages-square" /></span>
      <p className="agent-kicker">{t('agent.subjectQa.kicker', '独立学科问答')}</p>
      <h1>{t('agent.subjectQa.title', '有学科问题，直接问。')}</h1>
      <p>{t('agent.subjectQa.body', '这里仅回答数学、物理和化学知识，不控制做题、学习计划、进度或账号设置。普通问答不会改变掌握度。')}</p>
      <div>
        <span><Icon name="lucide:sigma" />{t('subjects.math', '数学')}</span>
        <span><Icon name="lucide:atom" />{t('subjects.physics', '物理')}</span>
        <span><Icon name="lucide:flask-conical" />{t('subjects.chemistry', '化学')}</span>
      </div>
    </section>
  );
}

function AgentUnavailable({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="agent-gate-page">
      <section className="agent-gate-card">
        <span className="agent-gate-mark"><Icon name="lucide:bot" /></span>
        <p className="agent-kicker">Moodlelike Lab</p>
        <h1>{t('agent.disabled.title', '学习 Agent 正在内测。')}</h1>
        <p>{t('agent.disabled.body', '当前入口默认关闭，原有模考、科目训练、错题和真题功能不受影响。')}</p>
        <button type="button" onClick={() => onNavigate(routes.home)}>{t('common.backHome', '回到首页')}</button>
      </section>
    </div>
  );
}

type AgentErrorAction = {
  kind: 'send' | 'free-start' | 'free-continue' | 'free-end' | 'mock-continue';
  label: string;
  value?: string;
  surface?: 'learning_workspace' | 'subject_qa';
  subject?: 'math' | 'physics' | 'chemistry';
  questionCount?: number;
};

export function AgentPage({ currentUser, isResolvingAuth, onNavigate, onAuthRedirect }: AgentPageProps) {
  const { locale, t } = useI18n();
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState<AgentErrorAction | null>(null);
  const [intervention, setIntervention] = useState<AgentInterventionDelivery | null>(null);
  const [interventionVerification, setInterventionVerification] = useState<AgentInterventionVerification | null>(null);
  const [adaptiveReport, setAdaptiveReport] = useState<AdaptiveRoundReport | null>(null);
  const [teachingDeliveryId, setTeachingDeliveryId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('agentTeachingDeliveryId');
  });
  const [learningWorkspace, setLearningWorkspace] = useState<AgentLearningWorkspace | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const roundId = Number(params.get('agentRoundId'));
    const artifactId = params.get('agentArtifactId') || undefined;
    const verificationId = params.get('agentInterventionVerificationId') || undefined;
    const conversationId = params.get('agentConversationId') || params.get('conversation');
    if (!roundId || (!artifactId && !verificationId) || !conversationId) return null;
    return {
      artifactId, verificationId, conversationId, roundId,
      phase: params.get('agentView') === 'report' ? 'report' : 'practice',
      taskType: params.get('agentTaskType') || undefined,
      subject: params.get('agentSubject') || undefined
    };
  });
  const [mockExamWorkspace, setMockExamWorkspace] = useState<AgentMockExamWorkspace | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const attemptId = Number(params.get('agentMockExamAttemptId'));
    const artifactId = params.get('agentArtifactId');
    const conversationId = params.get('agentConversationId') || params.get('conversation');
    if (!attemptId || !artifactId || !conversationId) return null;
    return {
      artifactId, conversationId, attemptId,
      phase: params.get('agentView') === 'mock-report' ? 'report' : 'taking',
      subject: params.get('agentSubject') || undefined
    };
  });
  const [mockExamSettlement, setMockExamSettlement] = useState<AgentMockExamSettlement | null>(null);
  const [mockExamSettlementStatus, setMockExamSettlementStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [mockExamSettlementRevision, setMockExamSettlementRevision] = useState(0);
  const [pastPaperWorkspace, setPastPaperWorkspace] = useState<{ slug: string; conversationId: string; questionId?: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('agentPastPaper');
    const conversationId = params.get('conversation');
    const questionId = Number(params.get('agentQuestionId'));
    return slug && conversationId ? { slug, conversationId, ...(Number.isInteger(questionId) && questionId > 0 ? { questionId } : {}) } : null;
  });
  const [draftPageContext, setDraftPageContext] = useState<{
    route: string;
    entityRef: { type: 'past_paper'; id: string };
    selectedQuestionId: number;
  } | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const observedRunRef = useRef<string | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const taskRailDragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  }, []);

  function clearErrorNotice() {
    setError('');
    setErrorAction(null);
  }

  function showError(message: string, action?: AgentErrorAction) {
    setError(message);
    setErrorAction(action ?? null);
  }

  function runErrorAction(action: AgentErrorAction) {
    clearErrorNotice();
    if (action.kind === 'send') return void sendMessage(action.value, action.surface);
    if (action.kind === 'free-start') return void beginFreePractice();
    if (action.kind === 'free-continue') return void continueFreePracticeBatch(action.subject && action.questionCount ? { subject: action.subject, questionCount: action.questionCount } : undefined);
    if (action.kind === 'free-end') return void endFreePracticeJourney();
    return void continueAfterMockExam();
  }
  const [taskRailWidth, setTaskRailWidth] = useState(() => {
    if (typeof window === 'undefined') return AGENT_TASK_RAIL_DEFAULT_WIDTH;
    const saved = Number(readMigratedLocalStorage(AGENT_TASK_RAIL_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= AGENT_TASK_RAIL_MIN_WIDTH ? saved : AGENT_TASK_RAIL_DEFAULT_WIDTH;
  });
  const [isTaskRailResizing, setIsTaskRailResizing] = useState(false);
  const [taskRailPosition, setTaskRailPosition] = useState<'right' | 'center'>(() => {
    if (typeof window === 'undefined') return 'right';
    return readMigratedLocalStorage(AGENT_TASK_RAIL_POSITION_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY) === 'center' ? 'center' : 'right';
  });
  const [journeySection, setJourneySection] = useState<AgentJourneySection>(() => {
    if (typeof window === 'undefined') return 'today';
    const saved = readMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY);
    return saved === 'plan' || saved === 'history' || saved === 'weakness' || saved === 'resources' || saved === 'qa' || saved === 'settings' ? saved : 'today';
  });
  const [learningMode, setLearningMode] = useState<'recommended' | 'free'>(() => {
    if (typeof window === 'undefined') return 'recommended';
    return readMigratedLocalStorage(AGENT_LEARNING_MODE_STORAGE_KEY, LEGACY_AGENT_LEARNING_MODE_STORAGE_KEY) === 'free' ? 'free' : 'recommended';
  });
  const [sessionLearningModeOverride, setSessionLearningModeOverride] = useState<'free' | null>(null);
  const [defaultFreePracticeSubject, setDefaultFreePracticeSubject] = useState<'math' | 'physics' | 'chemistry'>(() => {
    if (typeof window === 'undefined') return 'math';
    const saved = readMigratedLocalStorage(AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY);
    return saved === 'physics' || saved === 'chemistry' ? saved : 'math';
  });
  const [defaultFreePracticeCount, setDefaultFreePracticeCount] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const saved = Number(readMigratedLocalStorage(AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY));
    return saved === 3 || saved === 10 ? saved : 5;
  });
  const [freePracticeSubject, setFreePracticeSubject] = useState<'math' | 'physics' | 'chemistry'>(() => {
    if (typeof window === 'undefined') return 'math';
    const saved = readMigratedLocalStorage(AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY);
    return saved === 'physics' || saved === 'chemistry' ? saved : 'math';
  });
  const [freePracticeCount, setFreePracticeCount] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const saved = Number(readMigratedLocalStorage(AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY));
    return saved === 3 || saved === 10 ? saved : 5;
  });
  const [isStartingFreePractice, setIsStartingFreePractice] = useState(false);
  const [freePracticeContinuationBusy, setFreePracticeContinuationBusy] = useState<'continue' | 'end' | null>(null);
  const [isAdjustingFreePractice, setIsAdjustingFreePractice] = useState(false);
  const [journeyState, setJourneyState] = useState<AgentJourneyState | null>(null);
  const [isJourneyHistoryLoading, setIsJourneyHistoryLoading] = useState(false);
  const [journeyOverview, setJourneyOverview] = useState<AgentJourneyOverview | null>(null);
  const [isJourneyOverviewLoading, setIsJourneyOverviewLoading] = useState(false);
  const [journeyOverviewError, setJourneyOverviewError] = useState('');
  const [practiceQuestionContext, setPracticeQuestionContext] = useState<AgentPracticeQuestionContext | null>(null);
  const [practiceAssistanceEvents, setPracticeAssistanceEvents] = useState<AgentPracticeAssistanceEvent[]>([]);
  const [practiceAssistanceCommand, setPracticeAssistanceCommand] = useState<AgentPracticeAssistanceCommand | null>(null);
  const [practiceAssistanceBusy, setPracticeAssistanceBusy] = useState<AgentPracticeAssistanceEvent['action'] | null>(null);
  const [practiceTeachingEvent, setPracticeTeachingEvent] = useState<AgentPracticeTeachingEvent | null>(null);
  const enabled = isAgentWebEnabled();

  const receivePracticeAssistance = useCallback((item: AgentPracticeAssistanceEvent) => {
    setPracticeAssistanceEvents((current) => {
      const existingIndex = current.findIndex((candidate) => candidate.id === item.id);
      if (existingIndex < 0) return [...current, item].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const next = [...current];
      next[existingIndex] = item;
      return next;
    });
    setPracticeAssistanceBusy(null);
  }, []);

  const requestPracticeAssistance = useCallback((action: AgentPracticeAssistanceEvent['action']) => {
    if (!practiceQuestionContext || practiceAssistanceBusy) return;
    setPracticeAssistanceBusy(action);
    setPracticeAssistanceCommand({ id: clientRequestId(), action });
  }, [practiceAssistanceBusy, practiceQuestionContext]);

  const settlePracticeAssistance = useCallback(() => setPracticeAssistanceBusy(null), []);

  const scrollConversationToLatest = useCallback(() => {
    const scroller = threadScrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    let settledFrame = 0;
    const layoutFrame = window.requestAnimationFrame(() => {
      scrollConversationToLatest();
      settledFrame = window.requestAnimationFrame(scrollConversationToLatest);
    });
    const settleTimers = [80, 240, 600].map((delay) => window.setTimeout(scrollConversationToLatest, delay));
    return () => {
      window.cancelAnimationFrame(layoutFrame);
      window.cancelAnimationFrame(settledFrame);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    activeConversationId,
    conversation?.id,
    conversation?.messages.length,
    conversation?.updatedAt,
    intervention?.id,
    interventionVerification?.id,
    isSending,
    practiceAssistanceBusy,
    practiceAssistanceEvents.length,
    practiceTeachingEvent?.id,
    learningWorkspace?.phase,
    learningWorkspace?.roundId,
    mockExamWorkspace?.phase,
    mockExamWorkspace?.attemptId,
    runStatus,
    scrollConversationToLatest,
    teachingDeliveryId
  ]);

  useEffect(() => {
    const scroller = threadScrollRef.current;
    const messageList = messageListRef.current;
    if (!scroller || !messageList || typeof ResizeObserver === 'undefined') return;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(scrollConversationToLatest);
    });
    observer.observe(scroller);
    observer.observe(messageList);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [conversation?.id, scrollConversationToLatest]);

  useEffect(() => {
    setAdaptiveReport(null);
    setPracticeQuestionContext(null);
    setPracticeAssistanceEvents([]);
    setPracticeAssistanceCommand(null);
    setPracticeAssistanceBusy(null);
    setPracticeTeachingEvent(null);
  }, [learningWorkspace?.roundId]);

  const syncWorkspaceUrl = useCallback((workspace: AgentLearningWorkspace | null, fallbackConversationId?: string) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    const conversationId = workspace?.conversationId || fallbackConversationId || activeConversationId;
    if (conversationId) params.set('conversation', conversationId);
    if (workspace) {
      params.set('agentConversationId', workspace.conversationId);
      if (workspace.artifactId) params.set('agentArtifactId', workspace.artifactId);
      if (workspace.verificationId) params.set('agentInterventionVerificationId', workspace.verificationId);
      params.set('agentRoundId', String(workspace.roundId));
      params.set('agentView', workspace.phase);
      if (workspace.taskType) params.set('agentTaskType', workspace.taskType);
      if (workspace.subject) params.set('agentSubject', workspace.subject);
    }
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`);
  }, [activeConversationId]);

  const syncTeachingWorkspaceUrl = useCallback((deliveryId: string | null, conversationId?: string) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const resolvedConversationId = conversationId || activeConversationId;
    if (resolvedConversationId) params.set('conversation', resolvedConversationId);
    if (deliveryId) params.set('agentTeachingDeliveryId', deliveryId);
    else params.delete('agentTeachingDeliveryId');
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`);
  }, [activeConversationId]);

  const openTeachingWorkspace = useCallback((item: AgentInterventionDelivery) => {
    if (!item.content.teachingAsset) return;
    setTeachingDeliveryId(item.id);
    syncTeachingWorkspaceUrl(item.id, activeConversationId || undefined);
  }, [activeConversationId, syncTeachingWorkspaceUrl]);

  const closeTeachingWorkspace = useCallback(() => {
    setTeachingDeliveryId(null);
    syncTeachingWorkspaceUrl(null, activeConversationId || undefined);
    focusComposer();
  }, [activeConversationId, focusComposer, syncTeachingWorkspaceUrl]);

  const openLearningWorkspace = useCallback((launch: AgentPracticeLaunch) => {
    const workspace: AgentLearningWorkspace = {
      artifactId: launch.artifactId,
      conversationId: launch.conversationId,
      roundId: launch.roundId,
      phase: 'practice',
      taskType: launch.workspace?.taskType ?? launch.taskType,
      subject: launch.workspace?.subject ?? launch.subject
    };
    setMockExamWorkspace(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    if (workspace.taskType === 'free_practice') {
      if (workspace.subject === 'math' || workspace.subject === 'physics' || workspace.subject === 'chemistry') setFreePracticeSubject(workspace.subject);
      if (launch.questionCount === 3 || launch.questionCount === 5 || launch.questionCount === 10) setFreePracticeCount(launch.questionCount);
    }
    setJourneySection('today');
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'today');
    setLearningWorkspace(workspace);
    syncWorkspaceUrl(workspace);
  }, [syncWorkspaceUrl]);

  const syncMockExamWorkspaceUrl = useCallback((workspace: AgentMockExamWorkspace | null, fallbackConversationId?: string) => {
    if (typeof window === 'undefined') return;
    const conversationId = workspace?.conversationId || fallbackConversationId || activeConversationId;
    const params = new URLSearchParams();
    if (conversationId) params.set('conversation', conversationId);
    if (workspace) {
      params.set('agentConversationId', workspace.conversationId);
      params.set('agentArtifactId', workspace.artifactId);
      params.set('agentMockExamAttemptId', String(workspace.attemptId));
      params.set('agentView', workspace.phase === 'report' ? 'mock-report' : 'mock-exam');
      params.set('agentTaskType', 'mock_exam');
      if (workspace.subject) params.set('agentSubject', workspace.subject);
    }
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`);
  }, [activeConversationId]);

  const openMockExamWorkspace = useCallback((launch: AgentMockExamLaunch) => {
    const workspace: AgentMockExamWorkspace = {
      artifactId: launch.artifactId,
      conversationId: launch.conversationId,
      attemptId: launch.attemptId,
      phase: 'taking',
      subject: launch.workspace.subject,
      paperTitle: launch.paperTitle
    };
    setLearningWorkspace(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    setMockExamSettlement(null);
    setMockExamWorkspace(workspace);
    syncMockExamWorkspaceUrl(workspace);
  }, [syncMockExamWorkspaceUrl]);

  const openTaskWorkspace = useCallback((launch: AgentTaskLaunch) => {
    if (launch.workspace.kind === 'mock_exam') openMockExamWorkspace(launch);
    else openLearningWorkspace(launch);
  }, [openLearningWorkspace, openMockExamWorkspace]);

  const openVerificationWorkspace = useCallback((item: AgentInterventionVerification, path: string, conversationId: string) => {
    const roundMatch = path.match(/\/practice\/rounds\/(\d+)/);
    if (!roundMatch) return;
    const workspace: AgentLearningWorkspace = {
      verificationId: item.id,
      conversationId,
      roundId: Number(roundMatch[1]),
      phase: path.includes('/report') ? 'report' : 'practice'
    };
    setLearningWorkspace(workspace);
    setTeachingDeliveryId(null);
    syncWorkspaceUrl(workspace);
  }, [syncWorkspaceUrl]);

  const openPastPaperWorkspace = useCallback((slug: string, conversationId: string, questionId?: number) => {
    setLearningWorkspace(null);
    setMockExamWorkspace(null);
    setTeachingDeliveryId(null);
    setPastPaperWorkspace({ slug, conversationId, ...(questionId ? { questionId } : {}) });
    const params = new URLSearchParams({ conversation: conversationId, agentPastPaper: slug });
    if (questionId) params.set('agentQuestionId', String(questionId));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  const closePastPaperWorkspace = useCallback((conversationId: string, prompt?: string, context?: { slug: string; questionId: number }) => {
    setPastPaperWorkspace(null);
    syncWorkspaceUrl(null, conversationId);
    if (prompt && context) {
      setJourneySection('today');
      writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'today');
      setDraft('');
      setDraftPageContext(null);
      void sendMessage(prompt, 'learning_workspace', null);
    } else {
      setDraftPageContext(null);
    }
  }, [syncWorkspaceUrl]);

  const restoreJourneyWorkspace = useCallback((workspace: AgentJourneyResumeWorkspace) => {
    setJourneySection('today');
    setLearningWorkspace(null);
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    if (workspace.kind === 'adaptive_round') {
      const restored: AgentLearningWorkspace = {
        artifactId: workspace.artifactId,
        verificationId: workspace.verificationId,
        conversationId: workspace.conversationId,
        roundId: workspace.roundId,
        phase: workspace.phase,
        taskType: workspace.taskType,
        subject: workspace.subject ?? undefined
      };
      setLearningWorkspace(restored);
      syncWorkspaceUrl(restored, workspace.conversationId);
      return;
    }
    if (workspace.kind === 'mock_exam') {
      const restored: AgentMockExamWorkspace = {
        artifactId: workspace.artifactId,
        conversationId: workspace.conversationId,
        attemptId: workspace.attemptId,
        phase: workspace.phase,
        subject: workspace.subject ?? undefined,
        paperTitle: workspace.paperTitle ?? undefined
      };
      setMockExamWorkspace(restored);
      syncMockExamWorkspaceUrl(restored, workspace.conversationId);
      return;
    }
    if (workspace.kind === 'past_paper') {
      setPastPaperWorkspace({ slug: workspace.slug, conversationId: workspace.conversationId, questionId: workspace.questionId });
      const params = new URLSearchParams({ conversation: workspace.conversationId, agentPastPaper: workspace.slug, agentQuestionId: String(workspace.questionId) });
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      return;
    }
    setTeachingDeliveryId(workspace.deliveryId);
    syncTeachingWorkspaceUrl(workspace.deliveryId, workspace.conversationId);
  }, [syncMockExamWorkspaceUrl, syncTeachingWorkspaceUrl, syncWorkspaceUrl]);

  const loadSummaries = useCallback(async () => {
    const items = await listAgentConversations();
    setConversations(items);
    return items;
  }, []);

  const loadJourneyState = useCallback(async () => {
    const result = await getAgentJourneyState();
    setJourneyState(result);
    return result;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const item = await getAgentConversation(id);
    setConversation(item);
    return item;
  }, []);

  const loadInterventionVerification = useCallback(async (conversationId: string) => {
    const result = await offerAgentInterventionVerification({ clientRequestId: clientRequestId(), conversationId });
    setInterventionVerification(result.item);
    return result.item;
  }, []);

  const runStatusLabel = useCallback((event: AgentStreamEvent) => {
    const labels: Record<string, string> = {
      'run.started': t('agent.status.started', '正在读取你的学习情况'),
      'plan.created': t('agent.status.planning', '正在确定今日优先任务'),
      'tool.started': t('agent.status.reading', '正在核对学习证据'),
      'tool.completed': t('agent.status.reading', '正在核对学习证据'),
      'artifact.created': t('agent.status.artifact', '今日方案已经生成'),
      'run.completed': t('agent.status.completed', '方案已就绪'),
      'run.failed': t('agent.status.failed', '本次分析没有完成')
    };
    return labels[event.type] ?? t('agent.status.running', '正在分析');
  }, [t]);

  const followRun = useCallback(async (runId: string, conversationId: string) => {
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    observedRunRef.current = runId;
    setRunStatus(t('agent.status.connecting', '正在连接学习分析'));
    let cursor = 0;
    for (let attempt = 0; attempt < 5 && !controller.signal.aborted; attempt += 1) {
      try {
        await streamAgentRunEvents(runId, cursor, controller.signal, (event) => {
          cursor = Math.max(cursor, event.sequence);
          setRunStatus(runStatusLabel(event));
        });
        const run = await getAgentRun(runId);
        if (TERMINAL_RUN_STATUSES.has(run.status)) {
          await Promise.all([loadConversation(conversationId), loadSummaries()]);
          setRunStatus(run.status === 'completed' ? t('agent.status.completed', '方案已就绪') : t('agent.status.failed', '本次分析没有完成'));
          setIsSending(false);
          return;
        }
      } catch (streamError) {
        if (controller.signal.aborted) return;
        setRunStatus(t('agent.status.reconnecting', '连接中断，正在恢复'));
      }
      await wait(500 + attempt * 300);
    }
    if (!controller.signal.aborted) {
      const run = await getAgentRun(runId).catch(() => null);
      if (run && TERMINAL_RUN_STATUSES.has(run.status)) {
        await Promise.all([loadConversation(conversationId), loadSummaries()]);
        setRunStatus(run.status === 'completed' ? t('agent.status.completed', '方案已就绪') : t('agent.status.failed', '本次分析没有完成'));
      } else {
        showError(t('agent.error.stream', '暂时无法同步分析进度，请稍后重试。'));
      }
      setIsSending(false);
    }
  }, [loadConversation, loadSummaries, runStatusLabel, t]);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  const clampTaskRailWidth = useCallback((width: number) => {
    if (typeof window === 'undefined') return Math.max(AGENT_TASK_RAIL_MIN_WIDTH, width);
    const viewportWidth = window.innerWidth;
    const conversationWidth = viewportWidth > 1200 ? 248 : viewportWidth > 980 ? 220 : 0;
    const minimumChatWidth = viewportWidth > 1200 ? 420 : viewportWidth > 720 ? 340 : 0;
    const availableWidth = viewportWidth - conversationWidth - minimumChatWidth;
    return Math.min(Math.max(AGENT_TASK_RAIL_MIN_WIDTH, availableWidth), Math.max(AGENT_TASK_RAIL_MIN_WIDTH, width));
  }, []);

  const persistTaskRailWidth = useCallback((width: number) => {
    if (typeof window !== 'undefined') writeMigratedLocalStorage(AGENT_TASK_RAIL_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_STORAGE_KEY, String(Math.round(width)));
  }, []);

  useEffect(() => {
    const handleResize = () => setTaskRailWidth((current) => clampTaskRailWidth(current));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampTaskRailWidth]);

  function handleTaskRailPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.innerWidth <= 720) return;
    taskRailDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: taskRailWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsTaskRailResizing(true);
    event.preventDefault();
  }

  function handleTaskRailPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = taskRailDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setTaskRailWidth(clampTaskRailWidth(drag.startWidth + drag.startX - event.clientX));
  }

  function finishTaskRailResize(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = taskRailDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextWidth = clampTaskRailWidth(drag.startWidth + drag.startX - event.clientX);
    taskRailDragRef.current = null;
    setTaskRailWidth(nextWidth);
    persistTaskRailWidth(nextWidth);
    setIsTaskRailResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleTaskRailResizeKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    const nextWidth = event.key === 'Home'
      ? AGENT_TASK_RAIL_DEFAULT_WIDTH
      : clampTaskRailWidth(taskRailWidth + (event.key === 'ArrowLeft' ? step : -step));
    setTaskRailWidth(nextWidth);
    persistTaskRailWidth(nextWidth);
  }

  function resetTaskRailWidth() {
    const nextWidth = clampTaskRailWidth(AGENT_TASK_RAIL_DEFAULT_WIDTH);
    setTaskRailWidth(nextWidth);
    persistTaskRailWidth(nextWidth);
  }

  function toggleTaskRailPosition() {
    setTaskRailPosition((current) => {
      const next = current === 'right' ? 'center' : 'right';
      writeMigratedLocalStorage(AGENT_TASK_RAIL_POSITION_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY, next);
      return next;
    });
  }

  useEffect(() => {
    if (!enabled || isResolvingAuth || !currentUser) return;
    let current = true;
    setIsLoading(true);
    clearErrorNotice();
    void (async () => {
      let retryAttempt = 0;
      while (current) {
        try {
          const [items, state] = await Promise.all([loadSummaries(), loadJourneyState().catch(() => null)]);
          if (!current) return;
          if (items[0]) {
            const params = new URLSearchParams(window.location.search);
            const requestedId = params.get('conversation');
            const selectedId = items.some((item) => item.id === requestedId)
              ? requestedId!
              : state?.activeWorkspace?.conversationId ?? items[0].id;
            setActiveConversationId(selectedId);
            await loadConversation(selectedId);
            if (!current) return;
            const hasExplicitContext = params.has('conversation')
              || params.has('agentRoundId')
              || params.has('agentMockExamAttemptId')
              || params.has('agentPastPaper')
              || params.has('agentTeachingDeliveryId');
            if (state?.activeWorkspace && !hasExplicitContext) restoreJourneyWorkspace(state.activeWorkspace);
          }
          clearErrorNotice();
          setIsLoading(false);
          return;
        } catch (loadError) {
          if (!current) return;
          if (!isAgentConnectionError(loadError)) {
            showError(loadError instanceof Error ? loadError.message : t('agent.error.load', '无法加载学习对话。'));
            setIsLoading(false);
            return;
          }
          showError(t('agent.error.reconnecting', '学习服务暂时未连接，恢复后会自动继续。'));
          setIsLoading(false);
          const retryDelay = Math.min(1000 * (2 ** retryAttempt), AGENT_INITIAL_LOAD_RETRY_MAX_DELAY_MS);
          retryAttempt += 1;
          await wait(retryDelay);
        }
      }
    })();
    return () => { current = false; };
  }, [currentUser?.id, enabled, isResolvingAuth, locale]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || journeySection !== 'history') return;
    let current = true;
    setIsJourneyHistoryLoading(true);
    void loadJourneyState()
      .catch(() => null)
      .finally(() => { if (current) setIsJourneyHistoryLoading(false); });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, journeySection, loadJourneyState]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || (journeySection !== 'weakness' && journeySection !== 'resources')) return;
    let current = true;
    setIsJourneyOverviewLoading(true);
    setJourneyOverviewError('');
    void getAgentJourneyOverview(locale === 'en' ? 'en' : 'zh-CN')
      .then((result) => { if (current) setJourneyOverview(result); })
      .catch((loadError) => { if (current) setJourneyOverviewError(loadError instanceof Error ? loadError.message : t('agent.journey.dataUnavailable', '暂时无法读取')); })
      .finally(() => { if (current) setIsJourneyOverviewLoading(false); });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, journeySection, locale, t]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || !conversation || isSending) return;
    const runId = [...conversation.messages].reverse().find((message) => message.runId)?.runId;
    if (!runId || observedRunRef.current === runId) return;
    observedRunRef.current = runId;
    void getAgentRun(runId).then((run) => {
      if (!TERMINAL_RUN_STATUSES.has(run.status)) {
        setIsSending(true);
        void followRun(runId, conversation.id);
      }
    }).catch(() => undefined);
  }, [conversation, currentUser?.id, followRun, isResolvingAuth, isSending]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || !mockExamWorkspace || mockExamWorkspace.phase !== 'report') {
      setMockExamSettlement(null);
      setMockExamSettlementStatus('idle');
      return;
    }
    let current = true;
    setMockExamSettlement(null);
    setMockExamSettlementStatus('loading');
    void settleAgentMockExam(mockExamWorkspace.attemptId)
      .then(async (result) => {
        if (!current) return;
        setMockExamSettlement(result);
        setMockExamSettlementStatus('ready');
        await loadConversation(mockExamWorkspace.conversationId).catch(() => undefined);
      })
      .catch(() => {
        if (current) setMockExamSettlementStatus('unavailable');
      });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, loadConversation, mockExamSettlementRevision, mockExamWorkspace?.attemptId, mockExamWorkspace?.conversationId, mockExamWorkspace?.phase]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || !conversation?.id || !conversation.messages.length || isSending) return;
    let current = true;
    void offerAgentIntervention({ clientRequestId: clientRequestId(), context: 'agent_conversation', conversationId: conversation.id, language: locale === 'zh-CN' ? 'zh-CN' : 'en' })
      .then((result) => { if (current) setIntervention(isDisplayableIntervention(result.item) ? result.item : null); })
      .catch(() => { if (current) setIntervention(null); });
    void offerAgentInterventionVerification({ clientRequestId: clientRequestId(), conversationId: conversation.id })
      .then((result) => { if (current) setInterventionVerification(result.item); })
      .catch(() => { if (current) setInterventionVerification(null); });
    return () => { current = false; };
  }, [conversation?.id, conversation?.messages.length, currentUser?.id, isResolvingAuth, isSending, locale]);

  async function chooseConversation(id: string) {
    if (id === activeConversationId && !learningWorkspace && !mockExamWorkspace && !pastPaperWorkspace) return;
    streamAbortRef.current?.abort();
    observedRunRef.current = null;
    setLearningWorkspace(null);
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    setDraftPageContext(null);
    syncWorkspaceUrl(null, id);
    setActiveConversationId(id);
    setConversation(null);
    clearErrorNotice();
    setIsLoading(true);
    try {
      await loadConversation(id);
    } catch (loadError) {
      showError(loadError instanceof Error ? loadError.message : t('agent.error.load', '无法加载学习对话。'));
    } finally {
      setIsLoading(false);
    }
  }

  function chooseJourneySection(section: AgentJourneySection) {
    setJourneySection(section);
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, section);
    if ((section === 'today' || section === 'plan') && conversations[0] && conversations[0].id !== activeConversationId) {
      void chooseConversation(conversations[0].id);
    }
  }

  function closeSettingsWorkspace() {
    chooseJourneySection('today');
    focusComposer();
  }

  async function sendMessage(
    value?: string,
    requestedSurface?: 'learning_workspace' | 'subject_qa',
    requestedPageContext?: {
      route: string;
      artifactId?: string;
      entityRef?: { type: 'adaptive_round' | 'intervention_verification' | 'mock_attempt' | 'past_paper'; id: string };
      selectedQuestionId?: number;
    } | null
  ) {
    const text = String(value ?? draft).trim();
    const surface = requestedSurface ?? (journeySection === 'qa' ? 'subject_qa' : 'learning_workspace');
    if (!text || isSending || !currentUser) return;
    clearErrorNotice();
    setIsSending(true);
    setRunStatus(surface === 'subject_qa' ? t('agent.subjectQa.preparing', '正在准备学科回答') : t('agent.status.queued', '正在准备分析'));
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await createAgentConversation({ title: text.slice(0, 60) });
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((items) => [created, ...items]);
      }
      const contextualPageContext = learningWorkspace && practiceQuestionContext
        ? {
            route: `${window.location.pathname}${window.location.search}`,
            ...(learningWorkspace.artifactId ? { artifactId: learningWorkspace.artifactId } : {}),
            entityRef: { type: 'adaptive_round' as const, id: String(practiceQuestionContext.roundId) },
            selectedQuestionId: practiceQuestionContext.questionId
          }
        : { route: `${window.location.pathname}${window.location.search}` };
      const submission = await submitAgentMessage(conversationId, {
        clientRequestId: clientRequestId(),
        text,
        locale: locale === 'zh-CN' ? 'zh-CN' : 'en',
        surface,
        attachmentIds: [],
        ...(surface === 'learning_workspace' && requestedPageContext !== null
          ? { pageContext: requestedPageContext ?? draftPageContext ?? contextualPageContext }
          : {})
      });
      setDraft('');
      setDraftPageContext(null);
      void followRun(submission.runId, conversationId);
      await loadConversation(conversationId).catch(() => {
        showError(t('agent.error.sentRefreshPending', '消息已经发送，但最新对话暂未刷新；分析完成后会自动同步。'));
      });
    } catch {
      showError(
        t('agent.error.sendRecoverable', '消息未发送；你的输入仍保留，可以再次发送。'),
        { kind: 'send', label: t('agent.error.retrySend', '再次发送'), value: text, surface }
      );
      setIsSending(false);
      setRunStatus('');
    }
  }

  function updateDefaultLearningMode(mode: 'recommended' | 'free') {
    setLearningMode(mode);
    setSessionLearningModeOverride(null);
    writeMigratedLocalStorage(AGENT_LEARNING_MODE_STORAGE_KEY, LEGACY_AGENT_LEARNING_MODE_STORAGE_KEY, mode);
  }

  function updateDefaultFreePracticeSubject(subject: 'math' | 'physics' | 'chemistry') {
    setDefaultFreePracticeSubject(subject);
    if (learningWorkspace?.taskType !== 'free_practice') setFreePracticeSubject(subject);
    writeMigratedLocalStorage(AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_SUBJECT_STORAGE_KEY, subject);
  }

  function updateDefaultFreePracticeCount(count: number) {
    setDefaultFreePracticeCount(count);
    if (learningWorkspace?.taskType !== 'free_practice') setFreePracticeCount(count);
    writeMigratedLocalStorage(AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY, LEGACY_AGENT_FREE_PRACTICE_COUNT_STORAGE_KEY, String(count));
  }

  function currentFreePracticeConfig() {
    const artifact = learningWorkspace?.artifactId
      ? conversation?.artifacts.find((item) => item.id === learningWorkspace.artifactId)
      : null;
    const snapshot = artifact?.snapshot ?? {};
    const task = snapshot.task && typeof snapshot.task === 'object' && !Array.isArray(snapshot.task)
      ? snapshot.task as Record<string, unknown>
      : {};
    const subject = learningWorkspace?.subject === 'math' || learningWorkspace?.subject === 'physics' || learningWorkspace?.subject === 'chemistry'
      ? learningWorkspace.subject
      : task.subject === 'math' || task.subject === 'physics' || task.subject === 'chemistry'
        ? task.subject
        : freePracticeSubject;
    const storedCount = Number(task.questionCount);
    const questionCount = storedCount === 3 || storedCount === 5 || storedCount === 10 ? storedCount : freePracticeCount;
    return { subject, questionCount };
  }

  function toggleFreePracticeAdjustment() {
    if (!isAdjustingFreePractice) {
      const current = currentFreePracticeConfig();
      setFreePracticeSubject(current.subject);
      setFreePracticeCount(current.questionCount);
    }
    setIsAdjustingFreePractice((value) => !value);
  }

  async function beginFreePractice() {
    if (isStartingFreePractice || !currentUser) return;
    clearErrorNotice();
    setIsStartingFreePractice(true);
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await createAgentConversation({ title: t('agent.freePractice.stageTitle', '自由练习') });
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((items) => [created, ...items]);
      }
      const launch = await startAgentFreePractice({
        clientRequestId: clientRequestId(), conversationId,
        subject: freePracticeSubject, questionCount: freePracticeCount,
        questionLanguage: locale === 'en' ? 'en' : 'zh'
      });
      await Promise.all([loadConversation(conversationId), loadSummaries()]);
      openLearningWorkspace(launch);
    } catch {
      showError(
        t('agent.freePractice.startRecoverable', '自由练习还没有开始；科目和题量已保留。'),
        { kind: 'free-start', label: t('agent.freePractice.retryStart', '重试开始') }
      );
    } finally {
      setIsStartingFreePractice(false);
    }
  }

  async function continueFreePracticeBatch(selection?: { subject: 'math' | 'physics' | 'chemistry'; questionCount: number }) {
    if (!learningWorkspace?.artifactId || freePracticeContinuationBusy) return;
    const next = selection ?? currentFreePracticeConfig();
    clearErrorNotice();
    setFreePracticeContinuationBusy('continue');
    try {
      await settleAgentPractice(learningWorkspace.roundId);
      const launch = await continueAgentFreePractice(learningWorkspace.artifactId, {
        clientRequestId: clientRequestId(), subject: next.subject, questionCount: next.questionCount,
        questionLanguage: locale === 'en' ? 'en' : 'zh'
      });
      setIsAdjustingFreePractice(false);
      await Promise.all([loadConversation(learningWorkspace.conversationId), loadSummaries(), loadJourneyState()]);
      openLearningWorkspace(launch);
    } catch {
      showError(
        t('agent.freePractice.continueRecoverable', '下一批尚未创建；本批结果已经保留。'),
        { kind: 'free-continue', label: t('agent.freePractice.retryContinue', '重试继续'), subject: next.subject, questionCount: next.questionCount }
      );
    } finally {
      setFreePracticeContinuationBusy(null);
    }
  }

  async function endFreePracticeJourney() {
    if (!learningWorkspace?.artifactId || freePracticeContinuationBusy) return;
    clearErrorNotice();
    setFreePracticeContinuationBusy('end');
    try {
      if (learningWorkspace.phase === 'report') await settleAgentPractice(learningWorkspace.roundId);
      await endAgentFreePractice(learningWorkspace.artifactId, { clientRequestId: clientRequestId() });
      const conversationId = learningWorkspace.conversationId;
      setLearningWorkspace(null);
      setIsAdjustingFreePractice(false);
      syncWorkspaceUrl(null, conversationId);
      await Promise.all([loadConversation(conversationId), loadSummaries(), loadJourneyState()]);
      focusComposer();
    } catch {
      showError(
        t('agent.freePractice.endRecoverable', '本次学习还没有结束；已完成批次不会丢失。'),
        { kind: 'free-end', label: t('agent.freePractice.retryEnd', '重试结束') }
      );
    } finally {
      setFreePracticeContinuationBusy(null);
    }
  }

  async function continueAfterMockExam() {
    if (!mockExamWorkspace || !mockExamSettlement?.learningReview.nextDecision?.primaryTask || isSending) return;
    const workspace = mockExamWorkspace;
    clearErrorNotice();
    setIsSending(true);
    setRunStatus(t('agent.status.queued', '正在准备分析'));
    try {
      const submission = await submitAgentMessage(workspace.conversationId, {
        clientRequestId: clientRequestId(),
        text: locale === 'zh-CN' ? '根据刚完成的模考安排下一步' : 'Plan my next step from the mock exam I just completed',
        locale: locale === 'zh-CN' ? 'zh-CN' : 'en',
        pageContext: {
          route: `${window.location.pathname}${window.location.search}`,
          entityRef: { type: 'mock_attempt', id: String(workspace.attemptId) }
        }
      });
      setMockExamWorkspace(null);
      setMockExamSettlement(null);
      setActiveConversationId(workspace.conversationId);
      syncMockExamWorkspaceUrl(null, workspace.conversationId);
      void followRun(submission.runId, workspace.conversationId);
      await loadConversation(workspace.conversationId).catch(() => {
        showError(t('agent.error.sentRefreshPending', '消息已经发送，但最新对话暂未刷新；分析完成后会自动同步。'));
      });
    } catch {
      showError(
        t('agent.mockExam.continueRecoverable', '下一项任务尚未生成；模考结果已经保留。'),
        { kind: 'mock-continue', label: t('agent.mockExam.retryContinue', '重试生成') }
      );
      setIsSending(false);
      setRunStatus('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  async function handleLearningWorkspaceNavigation(path: string) {
    if (!learningWorkspace) return;
    const roundMatch = path.match(/\/practice\/rounds\/(\d+)(\/report)?/);
    if (roundMatch) {
      const next: AgentLearningWorkspace = {
        ...learningWorkspace,
        roundId: Number(roundMatch[1]),
        phase: roundMatch[2] ? 'report' : 'practice'
      };
      setLearningWorkspace(next);
      syncWorkspaceUrl(next);
      return;
    }

    const localizedAgentPath = path.includes('/agent');
    if (localizedAgentPath) {
      const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
      const params = new URLSearchParams(query);
      const conversationId = params.get('conversation') || learningWorkspace.conversationId;
      const runId = params.get('run');
      setLearningWorkspace(null);
      setActiveConversationId(conversationId);
      syncWorkspaceUrl(null, conversationId);
      await loadConversation(conversationId).catch(() => undefined);
      if (runId) {
        setIsSending(true);
        void followRun(runId, conversationId);
      }
      return;
    }

    // Closing an Agent-owned round returns to its conversation. Legacy destinations
    // remain available only for capabilities that have not moved into the shell yet.
    if (path.includes('/csca-subjects/')) {
      setLearningWorkspace(null);
      syncWorkspaceUrl(null, learningWorkspace.conversationId);
      focusComposer();
      await loadConversation(learningWorkspace.conversationId).catch(() => undefined);
      return;
    }
    onNavigate(path);
  }

  async function handleMockExamWorkspaceNavigation(path: string) {
    if (!mockExamWorkspace) return;
    const attemptMatch = path.match(/\/csca-mock-exam\/attempts\/(\d+)(\/report)?/);
    if (attemptMatch) {
      const next: AgentMockExamWorkspace = {
        ...mockExamWorkspace,
        attemptId: Number(attemptMatch[1]),
        phase: attemptMatch[2] ? 'report' : 'taking'
      };
      setMockExamWorkspace(next);
      syncMockExamWorkspaceUrl(next);
      return;
    }
    const conversationId = mockExamWorkspace.conversationId;
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    syncMockExamWorkspaceUrl(null, conversationId);
    focusComposer();
    await loadConversation(conversationId).catch(() => undefined);
  }

  useEffect(() => {
    const hasOpenTask = journeySection === 'settings' || Boolean(teachingDeliveryId || learningWorkspace || mockExamWorkspace || pastPaperWorkspace);
    if (!hasOpenTask) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="dialog"], [aria-modal="true"]')) return;
      event.preventDefault();
      if (journeySection === 'settings') closeSettingsWorkspace();
      else if (teachingDeliveryId) closeTeachingWorkspace();
      else if (learningWorkspace) void handleLearningWorkspaceNavigation(`${routes.cscaSubjects}/close`);
      else if (mockExamWorkspace) void handleMockExamWorkspaceNavigation(routes.cscaMockExam);
      else if (pastPaperWorkspace) closePastPaperWorkspace(pastPaperWorkspace.conversationId);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [journeySection, learningWorkspace, mockExamWorkspace, pastPaperWorkspace, teachingDeliveryId]);

  const latestArtifact = useMemo(() => {
    const artifacts = conversation?.artifacts.filter((item) => item.type === 'learning_plan') ?? [];
    return artifacts[artifacts.length - 1] ?? null;
  }, [conversation]);
  const latestSnapshot = latestArtifact?.snapshot ?? {};
  const latestTask = latestSnapshot.task && typeof latestSnapshot.task === 'object'
    ? latestSnapshot.task as Record<string, unknown>
    : null;
  const isSubjectQa = journeySection === 'qa';
  const subjectQaMessages = conversation?.messages.filter((message) => message.content.surface === 'subject_qa') ?? [];
  const activityMessages = conversation?.messages.filter((message) => message.content.surface !== 'subject_qa' && message.role !== 'user') ?? [];
  const visibleMessages = isSubjectQa ? subjectQaMessages : activityMessages;
  const effectiveLearningMode = sessionLearningModeOverride ?? learningMode;
  const workspaceArtifactId = learningWorkspace?.artifactId ?? mockExamWorkspace?.artifactId;
  const workspaceArtifact = workspaceArtifactId
    ? conversation?.artifacts.find((item) => item.id === workspaceArtifactId) ?? null
    : null;
  const workspaceSnapshot = workspaceArtifact?.snapshot ?? {};
  const workspaceTask = workspaceSnapshot.task && typeof workspaceSnapshot.task === 'object'
    ? workspaceSnapshot.task as Record<string, unknown>
    : null;
  const workspaceTaskType = learningWorkspace?.taskType ?? String(workspaceTask?.type ?? '');
  const workspaceSubject = learningWorkspace?.subject ?? String(workspaceTask?.subject ?? '');
  const workspaceHeading = mockExamWorkspace
    ? mockExamWorkspace.phase === 'report'
      ? t('agent.mockExam.report', '模考报告与下一步')
      : mockExamWorkspace.paperTitle || `${t('agent.task.mockExam', '在线模考')} · ${subjectLabel(mockExamWorkspace.subject, t)}`
    : learningWorkspace?.phase === 'report'
    ? t('agent.workspace.report', '本轮结果与下一步')
    : workspaceTaskType
      ? `${taskLabel(workspaceTaskType, t)} · ${subjectLabel(workspaceSubject, t)}`
      : t('agent.workspace.practice', '在 Agent 内完成练习');

  const teachingWorkspace = intervention?.id === teachingDeliveryId
    && intervention.status === 'in_progress'
    && intervention.content.teachingAsset
    ? intervention
    : null;
  const hasPrimaryTaskWorkspace = Boolean(learningWorkspace || mockExamWorkspace || pastPaperWorkspace);
  const chatTeachingWorkspace = teachingWorkspace && hasPrimaryTaskWorkspace ? teachingWorkspace : null;
  const standaloneTeachingWorkspace = teachingWorkspace && !hasPrimaryTaskWorkspace ? teachingWorkspace : null;
  const visiblePracticeTeachingEvent = practiceTeachingEvent
    && learningWorkspace?.phase === 'practice'
    && practiceTeachingEvent.roundId === learningWorkspace.roundId
    && practiceTeachingEvent.questionId === practiceQuestionContext?.questionId
    ? practiceTeachingEvent
    : null;

  if (!enabled) return <AgentUnavailable onNavigate={onNavigate} />;
  if (isResolvingAuth) {
    return <div className="agent-gate-page"><div className="agent-loading-card"><Icon name="lucide:loader-circle" />{t('agent.loadingAccount', '正在确认账号')}</div></div>;
  }
  if (!currentUser) {
    return (
      <div className="agent-gate-page">
        <section className="agent-gate-card">
          <span className="agent-gate-mark"><Icon name="lucide:sparkles" /></span>
          <p className="agent-kicker">CSCA Learning Agent</p>
          <h1>{t('agent.auth.title', '登录后，让系统替你判断下一步。')}</h1>
          <p>{t('agent.auth.body', '学习方案需要读取你自己的目标、答题证据和题源状态，因此不会向未登录用户生成虚构建议。')}</p>
          <button type="button" onClick={() => onAuthRedirect(routes.agent)}>{t('agent.auth.action', '登录并进入')}</button>
        </section>
      </div>
    );
  }

  const hasTaskWorkspace = Boolean(
    journeySection !== 'qa' && (journeySection === 'settings'
    || standaloneTeachingWorkspace
    || learningWorkspace?.phase === 'practice'
    || mockExamWorkspace?.phase === 'taking'
    || pastPaperWorkspace)
  );
  const taskRailResizeHandle = (
    <div
      className="agent-task-rail-resizer"
      role="separator"
      aria-label={t('agent.workspace.resize', '调整任务面板宽度')}
      aria-orientation="vertical"
      aria-valuemin={AGENT_TASK_RAIL_MIN_WIDTH}
      aria-valuenow={Math.round(taskRailWidth)}
      tabIndex={0}
      title={t('agent.workspace.resizeHint', '拖动调整宽度，双击恢复默认')}
      onPointerDown={handleTaskRailPointerDown}
      onPointerMove={handleTaskRailPointerMove}
      onPointerUp={finishTaskRailResize}
      onPointerCancel={finishTaskRailResize}
      onDoubleClick={resetTaskRailWidth}
      onKeyDown={handleTaskRailResizeKey}
    ><span /></div>
  );

  return (
    <div className="agent-page">
      <div
        className={[
          hasTaskWorkspace ? 'agent-workspace is-task-active' : 'agent-workspace',
          hasTaskWorkspace && taskRailPosition === 'center' ? 'is-task-first' : '',
          isTaskRailResizing ? 'is-resizing-task-rail' : ''
        ].filter(Boolean).join(' ')}
        style={hasTaskWorkspace ? { '--agent-task-rail-width': `${taskRailWidth}px` } as CSSProperties : undefined}
      >
        <aside className="agent-conversation-rail" aria-label={t('agent.journey.aria', '学习旅程导航')}>
          <div className="agent-rail-brand">
            <span><Icon name="lucide:bot" /></span>
            <div><strong>{t('agent.brand.title', '学习 Agent')}</strong><small>{t('agent.brand.subtitle', '目标驱动的 CSCA 训练')}</small></div>
          </div>
          <nav className="agent-journey-nav" aria-label={t('agent.journey.navAria', '学习旅程')}>
            <button type="button" className={journeySection === 'today' ? 'active' : ''} aria-label={t('agent.journey.today', '今日任务')} aria-current={journeySection === 'today' ? 'page' : undefined} onClick={() => chooseJourneySection('today')}>
              <Icon name="lucide:target" /><span><strong>{t('agent.journey.today', '今日任务')}</strong><small>{t('agent.journey.todayHint', '继续当前优先行动')}</small></span>
            </button>
            <button type="button" className={journeySection === 'plan' ? 'active' : ''} aria-label={t('agent.journey.plan', '学习计划')} aria-current={journeySection === 'plan' ? 'page' : undefined} onClick={() => chooseJourneySection('plan')}>
              <Icon name="lucide:calendar-days" /><span><strong>{t('agent.journey.plan', '学习计划')}</strong><small>{t('agent.journey.planHint', '目标与近期安排')}</small></span>
            </button>
            <button type="button" className={journeySection === 'history' ? 'active' : ''} aria-label={t('agent.journey.history', '学习历程')} aria-current={journeySection === 'history' ? 'page' : undefined} onClick={() => chooseJourneySection('history')}>
              <Icon name="lucide:clock-3" /><span><strong>{t('agent.journey.history', '学习历程')}</strong><small>{t('agent.journey.historyHint', '按阶段回看')}</small></span>
            </button>
            <button type="button" className={journeySection === 'weakness' ? 'active' : ''} aria-label={t('agent.journey.weakness', '错题与薄弱点')} aria-current={journeySection === 'weakness' ? 'page' : undefined} onClick={() => chooseJourneySection('weakness')}>
              <Icon name="lucide:scan-search" /><span><strong>{t('agent.journey.weakness', '错题与薄弱点')}</strong><small>{t('agent.journey.weaknessHint', '来自真实作答证据')}</small></span>
            </button>
            <button type="button" className={journeySection === 'resources' ? 'active' : ''} aria-label={t('agent.journey.resources', '学习资料')} aria-current={journeySection === 'resources' ? 'page' : undefined} onClick={() => chooseJourneySection('resources')}>
              <Icon name="lucide:library" /><span><strong>{t('agent.journey.resources', '学习资料')}</strong><small>{t('agent.journey.resourcesHint', '真题与可信资料')}</small></span>
            </button>
            <button type="button" className={journeySection === 'qa' ? 'active' : ''} aria-label={t('agent.journey.subjectQa', '学科问答')} aria-current={journeySection === 'qa' ? 'page' : undefined} onClick={() => chooseJourneySection('qa')}>
              <Icon name="lucide:messages-square" /><span><strong>{t('agent.journey.subjectQa', '学科问答')}</strong><small>{t('agent.journey.subjectQaHint', '数学、物理与化学')}</small></span>
            </button>
            <button type="button" className={journeySection === 'settings' ? 'active' : ''} aria-label={t('agent.journey.settings', '学习设置')} aria-current={journeySection === 'settings' ? 'page' : undefined} onClick={() => chooseJourneySection('settings')}>
              <Icon name="lucide:settings" /><span><strong>{t('agent.journey.settings', '学习设置')}</strong><small>{t('agent.journey.settingsHint', '目标与学习偏好')}</small></span>
            </button>
          </nav>
          <div className="agent-rail-footer">
            <div className="agent-rail-trust"><Icon name="lucide:shield-check" /><span>{t('agent.history.trust', '只读取你的学习数据；不会直接修改掌握度或自动出题。')}</span></div>
            <button type="button" className="agent-account-card" aria-label={t('agent.account.settings', '个人设置')} onClick={() => onNavigate(`${routes.me}?section=settings`)}>
              <UserAvatar user={currentUser} size="sm" />
              <span>
                <strong>{currentUser.displayName || currentUser.email}</strong>
                <small>{t('agent.account.settings', '个人设置')}</small>
              </span>
              <Icon name="lucide:settings" />
            </button>
            <button type="button" className="agent-back-home" onClick={() => onNavigate(routes.home)}>
              <Icon name="lucide:arrow-left" />
              <span>{t('agent.account.backHome', '返回 Moodlelike 首页')}</span>
            </button>
          </div>
        </aside>

        <main className="agent-thread">
          {hasTaskWorkspace && taskRailPosition === 'center' ? taskRailResizeHandle : null}
          <header className="agent-thread-header">
            <div>
              <span className="agent-kicker">{isSubjectQa ? t('agent.subjectQa.kicker', '独立学科问答') : t('agent.thread.kicker', 'Learning workspace')}</span>
              <h2>{journeySection === 'history'
                ? t('agent.journey.history', '学习历程')
                : journeySection === 'plan'
                  ? t('agent.journey.plan', '学习计划')
                  : journeySection === 'weakness'
                    ? t('agent.journey.weakness', '错题与薄弱点')
                    : journeySection === 'resources'
                      ? t('agent.journey.resources', '学习资料')
                      : journeySection === 'qa'
                        ? t('agent.journey.subjectQa', '学科问答')
                      : journeySection === 'settings'
                        ? t('agent.journey.settings', '学习设置')
                  : t('agent.thread.title', '学习工作台')}</h2>
            </div>
            <span className={isSending ? 'agent-live-status running' : 'agent-live-status'} role="status" aria-live="polite"><i />{isSending ? runStatus : isSubjectQa ? t('agent.subjectQa.ready', '数理化问答边界已启用') : t('agent.status.ready', '学习数据已连接')}</span>
          </header>

          <div ref={threadScrollRef} className="agent-thread-scroll" aria-live="polite">
            {error && <div className="agent-inline-error" role="alert"><Icon name="lucide:circle-alert" /><span>{error}</span><div className="agent-inline-error-actions">{errorAction ? <button type="button" className="primary" onClick={() => runErrorAction(errorAction)}><Icon name="lucide:refresh-cw" />{errorAction.label}</button> : null}<button type="button" onClick={clearErrorNotice}>{t('agent.error.dismiss', '关闭')}</button></div></div>}
            {isLoading ? (
              <div className="agent-loading-card"><Icon name="lucide:loader-circle" />{t('agent.loadingConversation', '正在加载学习对话')}</div>
            ) : isSubjectQa && !visibleMessages.length ? (
              <SubjectQaEmptyState />
            ) : !isSubjectQa && !visibleMessages.length ? (
              <AgentEmptyState user={currentUser} onPrompt={(value) => void sendMessage(value)} />
            ) : (
              <div ref={messageListRef} className={`agent-message-list${isSubjectQa ? ' is-subject-qa' : ' is-activity-stream'}`} aria-label={isSubjectQa ? t('agent.subjectQa.conversation', '学科问答对话') : t('agent.activity.aria', 'Agent 学习动态')}>
                {!isSubjectQa && <section className="agent-activity-intro">
                  <span><Icon name="lucide:activity" /></span>
                  <div><strong>{t('agent.activity.title', 'Agent 动态')}</strong><small>{t('agent.activity.body', '推荐、题内辅助、讲解和学习结果会按发生顺序记录在这里。')}</small></div>
                </section>}
                {visibleMessages.map((message) => {
                  const artifactIds = message.content.artifactIds ?? [];
                  return (
                    <div key={message.id} className={`agent-message-block ${message.role}${isSubjectQa ? '' : ' agent-activity-event'}`}>
                      <div className="agent-message-avatar">
                        {message.role === 'user' ? <UserAvatar user={currentUser} size="sm" /> : <span><Icon name="lucide:sparkles" /></span>}
                      </div>
                      <div className="agent-message-content">
                        <span className="agent-message-author">{message.role === 'user' ? (currentUser.displayName || t('agent.message.you', '你')) : t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                        {isSubjectQa && message.role === 'assistant' && <small className="agent-subject-qa-disclosure"><Icon name={message.content.subjectQa?.generatedByAI === false || message.content.subjectQa?.decision === 'out_of_scope' ? 'lucide:circle-alert' : 'lucide:shield-check'} />{message.content.subjectQa?.generatedByAI === false ? t('agent.subjectQa.unavailable', '学科问答暂时不可用') : message.content.subjectQa?.decision === 'out_of_scope' ? t('agent.subjectQa.outOfScope', '已按学科边界处理') : t('agent.subjectQa.noMastery', '自由问答，不改变掌握度')}</small>}
                        <p>{isSubjectQa ? <MathContent text={message.content.text} /> : message.content.text}</p>
                        {!!message.content.attachmentAnalysisItems?.length && (
                          <div className="agent-analysis-items" aria-label={t('agent.analysis.items', '识别到的题目')}>
                            {message.content.attachmentAnalysisItems.map((item, index) => (
                              <article key={`${item.questionNumber || item.ordinal}-${index}`}>
                                <header>
                                  <strong>{item.questionNumber ? `${t('agent.evidence.question', '题目')} ${item.questionNumber}` : `${t('agent.evidence.question', '题目')} ${item.ordinal}`}</strong>
                                  <span data-assessment={item.assessment}>{assessmentLabel(item.assessment, t)}</span>
                                </header>
                                <p>{item.questionText}</p>
                                {item.studentAnswer && <small><b>{t('agent.analysis.studentAnswer', '学生答案')}</b>{item.studentAnswer}</small>}
                              </article>
                            ))}
                          </div>
                        )}
                        {!!message.content.errors?.length && (
                          <div className="agent-analysis-details">
                            {message.content.errors.map((item, index) => <p key={`${item.title}-${index}`}><strong>{item.title}</strong><span>{item.explanation}</span></p>)}
                          </div>
                        )}
                        {!!message.content.guidance?.length && (
                          <ul className="agent-analysis-guidance">{message.content.guidance.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                        )}
                        {!!message.content.pastPaperResources?.length && (
                          <PastPaperResourceCards items={message.content.pastPaperResources} onOpen={(item) => openPastPaperWorkspace(item.slug, message.conversationId)} />
                        )}
                        {!!message.content.pastPaperCitations?.length && (
                          <div className="agent-past-paper-citations" aria-label={t('agent.pastPaper.citations', '真题引用')}>
                            {message.content.pastPaperCitations.map((citation) => (
                              <button key={`${citation.paperSlug}-${citation.sourceQuestionId}`} type="button" onClick={() => openPastPaperWorkspace(citation.paperSlug, message.conversationId, citation.sourceQuestionId)}>
                                <Icon name="lucide:scan-search" />
                                <span><strong>{citation.paperTitle} · {t('agent.evidence.question', '题目')} {citation.questionNumber}</strong><small>{citation.pageNumber ? `${t('agent.attachment.page', '第')} ${citation.pageNumber} ${t('agent.attachment.pageUnit', '页')} · ` : ''}${citation.sourceLabel}</small></span>
                                <Icon name="lucide:arrow-up-right" />
                              </button>
                            ))}
                          </div>
                        )}
                        {!!message.content.citations?.length && (
                          <div className="agent-analysis-citations">
                            {message.content.citations.map((citation, index) => (
                              <span key={`${citation.attachmentId}-${citation.pageNumber}-${index}`}><Icon name="lucide:file-search" />{citation.attachmentName} · {t('agent.attachment.page', '第')} {citation.pageNumber} {t('agent.attachment.pageUnit', '页')}</span>
                            ))}
                          </div>
                        )}
                        {!!message.content.evidenceCandidates?.length && (
                          <div className="agent-evidence-list">
                            {message.content.evidenceCandidates.map((candidate) => <EvidenceCandidateCard key={candidate.id} candidate={candidate} onChanged={() => loadConversation(message.conversationId)} />)}
                          </div>
                        )}
                        {!message.content.evidenceCandidates?.length && message.content.evidenceCandidate && (
                          <EvidenceCandidateCard candidate={message.content.evidenceCandidate} onChanged={() => loadConversation(message.conversationId)} />
                        )}
                        {!!message.attachments?.length && (
                          <div className="agent-message-attachments">
                            {message.attachments.map(({ attachment, snapshot }) => {
                              const name = String(snapshot.name || attachment.name || t('agent.attachment.unnamed', '附件'));
                              return (
                                <button key={attachment.id} type="button" onClick={() => void previewAgentAttachment(attachment)}>
                                  <Icon name={attachment.kind === 'image' ? 'lucide:image' : 'lucide:file-text'} />
                                  <span><strong>{name}</strong><small>{formatFileSize(Number(snapshot.sizeBytes || attachment.sizeBytes))}</small></span>
                                  <Icon name="lucide:external-link" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {artifactIds.map((artifactId) => {
                          const artifact = conversation.artifacts.find((item) => item.id === artifactId);
                          return artifact ? <PlanArtifactCard
                            key={artifact.id}
                            artifact={artifact}
                            onLaunch={openTaskWorkspace}
                            onUseFreePractice={() => {
                              setSessionLearningModeOverride('free');
                              setJourneySection('today');
                              setFreePracticeSubject(defaultFreePracticeSubject);
                              setFreePracticeCount(defaultFreePracticeCount);
                            }}
                          /> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
                {!isSubjectQa && learningWorkspace?.phase === 'practice' && practiceQuestionContext && (
                  <section className="agent-practice-action-panel" aria-label={t('agent.practiceAssistance.context', '当前练习题上下文')}>
                    <div><Icon name="lucide:focus" /><span><strong>{t('agent.practiceAssistance.currentQuestion', '当前第 {current}/{total} 题').replace('{current}', String(practiceQuestionContext.questionNumber)).replace('{total}', String(practiceQuestionContext.questionCount))}</strong><small>{practiceQuestionContext.topicTitle} · {t('agent.practiceAssistance.activityHint', '题内帮助会记录在 Agent 动态中')}</small></span></div>
                    <nav>
                      <button type="button" disabled={Boolean(practiceAssistanceBusy) || practiceQuestionContext.availableActions.find((item) => item.action === 'recall_concept')?.enabled !== true} onClick={() => requestPracticeAssistance('recall_concept')}><Icon name="lucide:book-open" />{t('agent.practiceAssistance.recall', '回忆知识点')}</button>
                      <button type="button" disabled={Boolean(practiceAssistanceBusy) || practiceQuestionContext.answered || practiceQuestionContext.availableActions.find((item) => item.action === 'next_step_hint')?.enabled !== true} onClick={() => requestPracticeAssistance('next_step_hint')}><Icon name="lucide:route" />{t('agent.practiceAssistance.nextHint', '下一步提示')}</button>
                      <button type="button" disabled={Boolean(practiceAssistanceBusy)} onClick={() => requestPracticeAssistance('check_work')}><Icon name="lucide:scan-line" />{t('agent.practiceAssistance.checkWork', '检查手写过程')}</button>
                    </nav>
                  </section>
                )}
                {!isSubjectQa && practiceAssistanceEvents
                  .filter((item) => item.roundId === learningWorkspace?.roundId)
                  .map((item) => {
                    const title = item.action === 'recall_concept'
                      ? t('agent.practiceAssistance.concept', '知识点回忆')
                      : item.action === 'next_step_hint'
                        ? t('agent.practiceAssistance.hint', '渐进提示')
                        : t('agent.practiceAssistance.handwriting', '手写过程检查');
                    return (
                      <div key={item.id} className={`agent-message-block assistant agent-practice-assistance-message ${item.status === 'failed' ? 'is-error' : ''}`}>
                        <div className="agent-message-avatar"><span><Icon name={item.action === 'check_work' ? 'lucide:scan-line' : 'lucide:sparkles'} /></span></div>
                        <div className="agent-message-content">
                          <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                          <article>
                            <header><span>{t('agent.practiceAssistance.boundQuestion', '第 {number} 题').replace('{number}', String(item.questionNumber))}</span><strong>{title}</strong></header>
                            <p>{item.content}</p>
                            <small><Icon name={item.status === 'failed' ? 'lucide:circle-alert' : 'lucide:shield-check'} />{item.status === 'failed' ? t('agent.practiceAssistance.failedDisclosure', '本次辅助没有完成，可以重试') : item.generatedByAI ? t('agent.practiceAssistance.aiDisclosure', '受当前题与辅助层级约束的 AI 辅助') : t('agent.practiceAssistance.reviewedDisclosure', '来自已审核学习内容')}</small>
                          </article>
                        </div>
                      </div>
                    );
                  })}
                {!isSubjectQa && practiceAssistanceBusy && (
                  <div className="agent-message-block assistant is-thinking agent-practice-assistance-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:sparkles" /></span></div>
                    <div className="agent-message-content"><span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span><p><i /><i /><i />{practiceAssistanceBusy === 'check_work' ? t('agent.practiceAssistance.waitingUpload', '正在选择或检查手写图片') : t('agent.practiceAssistance.loading', '正在结合当前题准备帮助')}</p></div>
                  </div>
                )}
                {!isSubjectQa && visiblePracticeTeachingEvent && (
                  <div className="agent-message-block assistant agent-chat-teaching-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:book-open-check" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <section className="agent-chat-teaching-panel agent-intervention-teaching-wrap" aria-label={t('agent.practiceTeaching.aria', '当前题知识讲解')}>
                        <header className="agent-chat-teaching-header">
                          <div><span>{t('agent.practiceTeaching.kicker', '当前题辅助')}</span><strong>{t('agent.practiceTeaching.title', '讲解进入 Agent 动态，题目保持不动')}</strong><small>{t('agent.practiceTeaching.hint', '第 {number} 题答错后匹配的已审核交互微课').replace('{number}', String(visiblePracticeTeachingEvent.questionNumber))}</small></div>
                          <button type="button" onClick={() => setPracticeTeachingEvent(null)} aria-label={t('agent.practiceTeaching.dismiss', '收起知识讲解')}><Icon name="lucide:x" /></button>
                        </header>
                        <TeachingAssetRenderer asset={visiblePracticeTeachingEvent.asset} roundId={visiblePracticeTeachingEvent.roundId} questionId={visiblePracticeTeachingEvent.questionId} />
                      </section>
                    </div>
                  </div>
                )}
                {!isSubjectQa && learningWorkspace?.phase === 'report' && (
                  <div className="agent-message-block assistant agent-chat-report-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:chart-no-axes-combined" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <AgentAdaptiveResultMessage
                        roundId={learningWorkspace.roundId}
                        taskType={workspaceTaskType}
                        onReportLoaded={setAdaptiveReport}
                        onNavigate={(path) => void handleLearningWorkspaceNavigation(path)}
                        customActions={workspaceTaskType === 'free_practice' ? (
                          <div className="agent-report-free-actions">
                            <p className="agent-report-free-next-hint">{t('agent.freePractice.nextBatchHint', '继续下一批会沿用本批科目和题量；如需改变，只调整下一批。')}</p>
                            <div className="agent-report-actions">
                              <button type="button" className="primary" disabled={freePracticeContinuationBusy !== null} onClick={() => void continueFreePracticeBatch()}><Icon name={freePracticeContinuationBusy === 'continue' ? 'lucide:loader-circle' : 'lucide:play'} />{t('agent.freePractice.continueSame', '继续下一批')}</button>
                              <button type="button" disabled={freePracticeContinuationBusy !== null} onClick={toggleFreePracticeAdjustment}><Icon name="lucide:sliders-horizontal" />{t('agent.freePractice.adjust', '调整下一批')}</button>
                              <button type="button" className="quiet" disabled={freePracticeContinuationBusy !== null} onClick={() => void endFreePracticeJourney()}>{freePracticeContinuationBusy === 'end' ? t('agent.freePractice.ending', '正在结束') : t('agent.freePractice.end', '结束学习')}</button>
                            </div>
                            {isAdjustingFreePractice && <div className="agent-report-adjustment">
                              <label>{t('agent.freePractice.subject', '科目')}<span>{(['math', 'physics', 'chemistry'] as const).map((subject) => <button key={subject} type="button" className={freePracticeSubject === subject ? 'active' : ''} onClick={() => setFreePracticeSubject(subject)}>{subjectLabel(subject, t)}</button>)}</span></label>
                              <label>{t('agent.freePractice.batch', '题量')}<span>{([3, 5, 10] as const).map((count) => <button key={count} type="button" className={freePracticeCount === count ? 'active' : ''} onClick={() => setFreePracticeCount(count)}>{count}</button>)}</span></label>
                              <button type="button" className="confirm" disabled={freePracticeContinuationBusy !== null} onClick={() => void continueFreePracticeBatch({ subject: freePracticeSubject, questionCount: freePracticeCount })}>{t('agent.freePractice.startAdjusted', '按新设置开始')}<Icon name="lucide:arrow-right" /></button>
                            </div>}
                          </div>
                        ) : undefined}
                        renderFollowUp={intervention ? (report) => isInterventionRelevantToReport(intervention, report) ? (
                          <InterventionCard
                            embedded
                            item={intervention}
                            onChanged={setIntervention}
                            onDismissed={() => { setIntervention(null); closeTeachingWorkspace(); }}
                            onCompleted={() => conversation?.id && void loadInterventionVerification(conversation.id)}
                            onOpenTeaching={openTeachingWorkspace}
                          />
                        ) : null : undefined}
                      />
                    </div>
                  </div>
                )}
                {!isSubjectQa && mockExamWorkspace?.phase === 'report' && (
                  <div className="agent-message-block assistant agent-chat-report-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:clipboard-check" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <AgentMockExamResultMessage
                        attemptId={mockExamWorkspace.attemptId}
                        settlement={mockExamSettlement}
                        settlementStatus={mockExamSettlementStatus === 'ready' ? 'ready' : mockExamSettlementStatus === 'unavailable' ? 'unavailable' : 'loading'}
                        isContinuing={isSending}
                        onContinue={() => void continueAfterMockExam()}
                        onRetrySettlement={() => setMockExamSettlementRevision((current) => current + 1)}
                      />
                    </div>
                  </div>
                )}
                {isSending && (
                  <div className="agent-message-block assistant is-thinking">
                    <div className="agent-message-avatar"><span><Icon name="lucide:sparkles" /></span></div>
                    <div className="agent-message-content"><span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span><p><i /><i /><i />{runStatus}</p></div>
                  </div>
                )}
                {!isSubjectQa && intervention && learningWorkspace?.phase !== 'report' && (
                  <InterventionCard
                    item={intervention}
                    onChanged={setIntervention}
                    onDismissed={() => { setIntervention(null); closeTeachingWorkspace(); }}
                    onCompleted={() => conversation?.id && void loadInterventionVerification(conversation.id)}
                    onOpenTeaching={openTeachingWorkspace}
                  />
                )}
                {!isSubjectQa && chatTeachingWorkspace && (
                  <div className="agent-message-block assistant agent-chat-teaching-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:graduation-cap" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <section className="agent-chat-teaching-panel agent-intervention-teaching-wrap" aria-label={t('agent.intervention.chatWorkspaceAria', 'Agent 动态知识讲解')}>
                        <header className="agent-chat-teaching-header">
                          <div><span>{t('agent.intervention.chatKicker', '随时可用的学习辅助')}</span><strong>{chatTeachingWorkspace.content.title || chatTeachingWorkspace.content.topicTitle}</strong><small>{t('agent.intervention.chatHint', '当前任务保持在旁边；你可以边做边看，也可以稍后继续')}</small></div>
                          <button type="button" onClick={closeTeachingWorkspace} aria-label={t('agent.practiceTeaching.dismiss', '收起知识讲解')}><Icon name="lucide:x" /></button>
                        </header>
                        <TeachingAssetRenderer
                          asset={chatTeachingWorkspace.content.teachingAsset!}
                          recordInteraction={(input) => recordAgentInterventionTeachingInteraction(chatTeachingWorkspace.id, input)}
                          onCompleted={async () => {
                            await actOnAgentIntervention(chatTeachingWorkspace.id, { clientRequestId: clientRequestId(), action: 'complete' });
                            setIntervention(null);
                            closeTeachingWorkspace();
                            if (conversation?.id) await loadInterventionVerification(conversation.id);
                          }}
                        />
                      </section>
                    </div>
                  </div>
                )}
                {!isSubjectQa && interventionVerification && conversation && (
                  <InterventionVerificationCard
                    key={interventionVerification.id}
                    item={interventionVerification}
                    onOpen={(item, path) => openVerificationWorkspace(item, path, conversation.id)}
                  />
                )}
                <div className="agent-message-end" aria-hidden="true" />
              </div>
            )}
          </div>

          {isSubjectQa && <form className="agent-composer agent-subject-qa-composer" onSubmit={submit}>
            <label className="agent-composer-label" htmlFor="agent-message">{t('agent.subjectQa.composerLabel', '询问数学、物理或化学')}</label>
            <div className="agent-composer-box">
              <textarea
                ref={composerInputRef}
                id="agent-message"
                value={draft}
                rows={1}
                maxLength={8000}
                placeholder={t('agent.subjectQa.placeholder', '例如：为什么加速度可以是负数？')}
                disabled={isSending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <div className="agent-composer-toolbar">
                <div className="agent-composer-tools">
                  <span className="agent-mode-chip"><Icon name="lucide:shield-check" />{t('agent.subjectQa.scope', '仅限数学、物理和化学')}</span>
                </div>
                <button type="submit" className="agent-send-button" disabled={!draft.trim() || isSending} aria-label={t('agent.composer.send', '发送')}>
                  <Icon name={isSending ? 'lucide:loader-circle' : 'lucide:arrow-up'} />
                </button>
              </div>
            </div>
            <small>{t('agent.subjectQa.helper', '仅支持文字提问；自由问答不会改变掌握度。学习计划、做题、进度和设置请返回学习工作台。')}</small>
          </form>}
        </main>

        {journeySection === 'qa' ? null : journeySection === 'settings' ? (
          <aside className="agent-task-rail agent-settings-task-rail" aria-label={t('agent.settings.workspaceAria', 'Agent 学习设置工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div><span className="agent-kicker">{t('agent.settings.kicker', 'Agent 使用的信息')}</span><strong>{t('agent.settings.title', '目标、画像与学习时间')}</strong><small>{t('agent.settings.hint', '保存后用于后续方案；不会改写已经发生的学习证据')}</small></div>
              <div className="agent-task-rail-actions">
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                <button type="button" onClick={closeSettingsWorkspace} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body"><AgentLearningSettingsView
              defaultLearningMode={learningMode}
              defaultFreePracticeSubject={defaultFreePracticeSubject}
              defaultFreePracticeCount={defaultFreePracticeCount}
              onDefaultLearningModeChange={updateDefaultLearningMode}
              onDefaultFreePracticeSubjectChange={updateDefaultFreePracticeSubject}
              onDefaultFreePracticeCountChange={updateDefaultFreePracticeCount}
            /></div>
          </aside>
        ) : standaloneTeachingWorkspace ? (
          <aside className="agent-task-rail agent-teaching-task-rail" aria-label={t('agent.intervention.workspaceAria', 'Agent 知识讲解工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div>
                <span className="agent-kicker">{t('agent.intervention.workspaceKicker', '当前教学任务')}</span>
                <strong>{standaloneTeachingWorkspace.content.title || standaloneTeachingWorkspace.content.topicTitle}</strong>
                <small>{standaloneTeachingWorkspace.content.topicTitle} · {t('agent.intervention.workspaceHint', '完成讲解后将安排独立新题验证')}</small>
              </div>
              <div className="agent-task-rail-actions">
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                <button type="button" onClick={closeTeachingWorkspace} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body agent-intervention-teaching-wrap agent-teaching-task">
              <TeachingAssetRenderer
                asset={standaloneTeachingWorkspace.content.teachingAsset!}
                recordInteraction={(input) => recordAgentInterventionTeachingInteraction(standaloneTeachingWorkspace.id, input)}
                onCompleted={async () => {
                  await actOnAgentIntervention(standaloneTeachingWorkspace.id, { clientRequestId: clientRequestId(), action: 'complete' });
                  setIntervention(null);
                  closeTeachingWorkspace();
                  if (conversation?.id) await loadInterventionVerification(conversation.id);
                }}
              />
            </div>
          </aside>
        ) : learningWorkspace?.phase === 'practice' ? (
          <aside className="agent-task-rail" aria-label={t('agent.workspace.aria', 'Agent 学习任务工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div>
                <span className="agent-kicker">{t('agent.workspace.kicker', '当前学习任务')}</span>
                <strong>{workspaceHeading}</strong>
                {workspaceArtifact?.summary ? <small>{workspaceArtifact.summary}</small> : null}
              </div>
              <div className="agent-task-rail-actions">
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                {workspaceTaskType === 'free_practice' && <button type="button" disabled={freePracticeContinuationBusy !== null} onClick={() => void endFreePracticeJourney()} aria-label={t('agent.freePractice.end', '结束本次学习')} title={t('agent.freePractice.end', '结束本次学习')}><Icon name="lucide:square" /></button>}
                <button type="button" onClick={() => void handleLearningWorkspaceNavigation(`${routes.cscaSubjects}/close`)} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body">
              <AdaptiveRoundView
                roundId={String(learningWorkspace.roundId)}
                onNavigate={(path) => void handleLearningWorkspaceNavigation(path)}
                onRoundUnavailable={() => {
                  const conversationId = learningWorkspace.conversationId;
                  setLearningWorkspace(null);
                  setPracticeQuestionContext(null);
                  syncWorkspaceUrl(null, conversationId);
                  showError(t('agent.workspace.unavailable', '之前的学习任务已经失效，已返回学习工作台。你可以重新开始自由练习或获取新的推荐。'));
                  void loadJourneyState().catch(() => null);
                }}
                agentConversationId={learningWorkspace.conversationId}
                agentAssistanceCommand={practiceAssistanceCommand}
                onAgentQuestionContext={setPracticeQuestionContext}
                onAgentAssistance={receivePracticeAssistance}
                onAgentAssistanceSettled={settlePracticeAssistance}
                onAgentTeachingAsset={setPracticeTeachingEvent}
              />
            </div>
          </aside>
        ) : mockExamWorkspace?.phase === 'taking' ? (
          <aside className="agent-task-rail agent-mock-task-rail" aria-label={t('agent.mockExam.workspaceAria', 'Agent 在线模考工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div>
                <span className="agent-kicker">{t('agent.mockExam.kicker', '专注考试模式')}</span>
                <strong>{workspaceHeading}</strong>
                {workspaceArtifact?.summary ? <small>{workspaceArtifact.summary}</small> : null}
              </div>
              <div className="agent-task-rail-actions">
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                <button type="button" onClick={() => void handleMockExamWorkspaceNavigation(routes.cscaMockExam)} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body is-mock-exam">
              <MockExamTakingView attemptId={String(mockExamWorkspace.attemptId)} onNavigate={(path) => void handleMockExamWorkspaceNavigation(path)} />
            </div>
          </aside>
        ) : pastPaperWorkspace ? (
          <aside className="agent-task-rail agent-past-paper-task-rail" aria-label={t('agent.pastPaper.workspaceAria', 'Agent 真题工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div><span className="agent-kicker">{t('agent.pastPaper.kicker', '真题资料')}</span><strong>{t('agent.pastPaper.workspaceTitle', '阅读、定位与提问')}</strong></div>
              <div className="agent-task-rail-actions">
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                <button type="button" onClick={() => closePastPaperWorkspace(pastPaperWorkspace.conversationId)} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body">
              <AgentPastPaperWorkspace
                slug={pastPaperWorkspace.slug}
                conversationId={pastPaperWorkspace.conversationId}
                initialQuestionId={pastPaperWorkspace.questionId}
                onAsk={(prompt, context) => closePastPaperWorkspace(pastPaperWorkspace.conversationId, prompt, context)}
              />
            </div>
          </aside>
        ) : journeySection === 'today' && learningWorkspace?.phase === 'report' ? (
          <aside className="agent-context-rail agent-report-rail" aria-label={t('agent.reportRail.aria', '本轮结果与下一步')}>
            <section className="agent-report-rail-summary">
              <header><span><Icon name="lucide:chart-no-axes-combined" /></span><div><small>{t('agent.reportRail.kicker', '本轮概览')}</small><strong>{subjectLabel(workspaceSubject, t)} · {workspaceTaskType === 'free_practice' ? t('agent.freePractice.titleShort', '自由练习') : taskLabel(workspaceTaskType, t)}</strong></div></header>
              {adaptiveReport ? <>
                <div className="agent-report-rail-score"><strong>{adaptiveReport.summary.accuracy}%</strong><span>{t('agent.report.correct', '答对')} {adaptiveReport.summary.correctCount}/{adaptiveReport.summary.total}</span></div>
                <div className="agent-report-rail-topics">
                  <small>{t('agent.reportRail.focus', '优先巩固')}</small>
                  <div>{adaptiveReport.weakTopics.length ? adaptiveReport.weakTopics.slice(0, 3).map((topic) => <span key={topic.topicId}>{topic.title}</span>) : <span className="is-good">{t('agent.report.noObviousWeakness', '暂无明显薄弱点')}</span>}</div>
                </div>
              </> : <div className="agent-report-rail-loading"><Icon name="lucide:loader-circle" />{t('agent.report.loading', '正在整理本轮学习结果')}</div>}
            </section>

            {workspaceTaskType === 'free_practice' ? <section className="agent-report-rail-next">
              <header><small>{t('agent.reportRail.next', '下一步')}</small><strong>{t('agent.freePractice.nextBatch', '继续下一批')}</strong></header>
              <p>{t('agent.freePractice.nextBatchRailHint', '默认沿用本批科目和题量，也可以只调整下一批。')}</p>
              <div className="agent-report-rail-config"><span>{subjectLabel(currentFreePracticeConfig().subject, t)}</span><span>{currentFreePracticeConfig().questionCount} {t('agent.freePractice.questions', '题')}</span></div>
              <button type="button" className="primary" disabled={freePracticeContinuationBusy !== null} onClick={() => void continueFreePracticeBatch()}><Icon name={freePracticeContinuationBusy === 'continue' ? 'lucide:loader-circle' : 'lucide:play'} />{t('agent.freePractice.continueSame', '继续下一批')}</button>
              <button type="button" disabled={freePracticeContinuationBusy !== null} onClick={toggleFreePracticeAdjustment}><Icon name="lucide:sliders-horizontal" />{isAdjustingFreePractice ? t('agent.freePractice.finishAdjust', '收起调整') : t('agent.freePractice.adjust', '调整下一批')}</button>
              {isAdjustingFreePractice ? <div className="agent-report-rail-adjust">
                <label><small>{t('agent.freePractice.subject', '科目')}</small><span>{(['math', 'physics', 'chemistry'] as const).map((subject) => <button key={subject} type="button" className={freePracticeSubject === subject ? 'active' : ''} onClick={() => setFreePracticeSubject(subject)}>{subjectLabel(subject, t)}</button>)}</span></label>
                <label><small>{t('agent.freePractice.batch', '题量')}</small><span>{([3, 5, 10] as const).map((count) => <button key={count} type="button" className={freePracticeCount === count ? 'active' : ''} onClick={() => setFreePracticeCount(count)}>{count}</button>)}</span></label>
                <button type="button" className="confirm" disabled={freePracticeContinuationBusy !== null} onClick={() => void continueFreePracticeBatch({ subject: freePracticeSubject, questionCount: freePracticeCount })}>{t('agent.freePractice.startAdjusted', '按新设置开始')}<Icon name="lucide:arrow-right" /></button>
              </div> : null}
            </section> : null}

            <button type="button" className="agent-report-rail-qa" onClick={() => chooseJourneySection('qa')}><Icon name="lucide:messages-square" /><span><strong>{t('agent.reportRail.askTitle', '这轮有疑问？')}</strong><small>{t('agent.reportRail.askBody', '去学科问答，自由询问数学、物理或化学知识。')}</small></span><Icon name="lucide:arrow-right" /></button>
            <section className="agent-context-note"><Icon name="lucide:shield-check" /><p>{t('agent.reportRail.evidence', '报告来自本轮真实作答；自由问答不会直接修改掌握度。')}</p></section>
          </aside>
        ) : journeySection === 'today' && mockExamWorkspace?.phase === 'report' ? (
          <aside className="agent-context-rail agent-report-rail" aria-label={t('agent.mockExam.report', '模考报告与下一步')}>
            <section className="agent-report-rail-summary">
              <header><span><Icon name="lucide:clipboard-check" /></span><div><small>{t('agent.mockExam.report', '模考报告与下一步')}</small><strong>{mockExamSettlement?.paperTitle ?? t('agent.task.mockExam', '在线模考')}</strong></div></header>
              {mockExamSettlement ? <>
                <div className="agent-report-rail-score"><strong>{mockExamSettlement.score}</strong><span>{t('agent.report.correct', '答对')} {mockExamSettlement.correctCount}/{mockExamSettlement.correctCount + mockExamSettlement.wrongCount + mockExamSettlement.unansweredCount}</span></div>
                <div className="agent-report-rail-topics"><small>{t('agent.reportRail.focus', '优先巩固')}</small><div>{mockExamSettlement.learningReview.focusTopics.slice(0, 3).map((topic) => <span key={topic.title}>{topic.title}</span>)}</div></div>
              </> : <div className="agent-report-rail-loading"><Icon name="lucide:loader-circle" />{t('agent.mockExam.loadingReport', '正在整理模考结果')}</div>}
            </section>
            <button type="button" className="agent-report-rail-qa" onClick={() => chooseJourneySection('qa')}><Icon name="lucide:messages-square" /><span><strong>{t('agent.reportRail.askTitle', '这轮有疑问？')}</strong><small>{t('agent.reportRail.askBody', '去学科问答，自由询问数学、物理或化学知识。')}</small></span><Icon name="lucide:arrow-right" /></button>
          </aside>
        ) : <aside className={journeySection === 'today' ? `agent-context-rail${effectiveLearningMode === 'free' ? ' is-free-practice' : ''}` : 'agent-context-rail is-journey-view'} aria-label={journeySection === 'history' ? t('agent.journey.history', '学习历程') : journeySection === 'plan' ? t('agent.journey.plan', '学习计划') : journeySection === 'weakness' ? t('agent.journey.weakness', '错题与薄弱点') : journeySection === 'resources' ? t('agent.journey.resources', '学习资料') : t('agent.context.aria', '当前学习上下文')}>
          {journeySection === 'plan' ? <AgentJourneyPlanView conversation={conversation} /> : journeySection === 'history' ? (
            <AgentJourneyHistoryView
              stages={journeyState?.stages ?? []}
              activeId={activeConversationId}
              loading={isJourneyHistoryLoading}
              onSelect={(stage) => void chooseConversation(stage.conversationId).then(() => {
                if (stage.resume) restoreJourneyWorkspace(stage.resume);
              })}
            />
          ) : journeySection === 'weakness' ? (
            <AgentJourneyWeaknessView overview={journeyOverview} loading={isJourneyOverviewLoading} error={journeyOverviewError} />
          ) : journeySection === 'resources' ? (
            <AgentJourneyResourcesView overview={journeyOverview} loading={isJourneyOverviewLoading} error={journeyOverviewError} onOpen={(item) => activeConversationId && openPastPaperWorkspace(item.slug, activeConversationId)} />
          ) : <>
          {effectiveLearningMode === 'free' ? <>
            <section className="agent-context-intro">
              <span className="agent-kicker">{t('agent.freePractice.kicker', '学生主动学习')}</span>
              <h2>{t('agent.freePractice.title', '你决定现在练什么、练多少')}</h2>
              <p>{t('agent.freePractice.body', '每次只取一个小批次，做完可以继续，也可以随时结束；作答仍进入同一学习证据。')}</p>
              {sessionLearningModeOverride === 'free' && learningMode === 'recommended' ? (
                <button type="button" className="agent-session-mode-reset" onClick={() => setSessionLearningModeOverride(null)}>
                  <Icon name="lucide:undo-2" />{t('agent.freePractice.backToRecommendation', '返回系统推荐')}
                </button>
              ) : null}
            </section>
            <section className="agent-free-practice-card">
              <fieldset>
                <legend>{t('agent.freePractice.subject', '选择科目')}</legend>
                <div>{(['math', 'physics', 'chemistry'] as const).map((subject) => <button key={subject} type="button" className={freePracticeSubject === subject ? 'active' : ''} aria-pressed={freePracticeSubject === subject} onClick={() => setFreePracticeSubject(subject)}>{subjectLabel(subject, t)}</button>)}</div>
              </fieldset>
              <fieldset>
                <legend>{t('agent.freePractice.batch', '本批题量')}</legend>
                <div>{[3, 5, 10].map((count) => <button key={count} type="button" className={freePracticeCount === count ? 'active' : ''} aria-pressed={freePracticeCount === count} onClick={() => setFreePracticeCount(count)}>{count} {t('agent.freePractice.questions', '题')}</button>)}</div>
              </fieldset>
              <button type="button" className="agent-free-practice-start" disabled={isStartingFreePractice} onClick={() => void beginFreePractice()}>
                <Icon name={isStartingFreePractice ? 'lucide:loader-circle' : 'lucide:play'} />{isStartingFreePractice ? t('agent.freePractice.starting', '正在准备题目') : t('agent.freePractice.start', '开始自由练习')}
              </button>
              <p><Icon name="lucide:shield-check" />{sessionLearningModeOverride === 'free' && learningMode === 'recommended'
                ? t('agent.freePractice.sessionOverride', '只调整本次学习，不会修改你在学习设置中的默认模式。')
                : t('agent.freePractice.evidence', '自由练习与系统推荐共用题源、辅助规则和学习证据。')}</p>
            </section>
          </> : <>
            <section className="agent-context-intro">
              <span className="agent-kicker">{t('agent.context.kicker', '学习上下文')}</span>
              <h2>{t('agent.context.title', '为什么推荐这个下一步')}</h2>
              <p>{t('agent.context.body', '这里只展示有事实来源的状态；建议可以接受或忽略，默认学习方式可在学习设置中调整。')}</p>
            </section>
            <section className="agent-context-card">
              <header><Icon name="lucide:target" /><strong>{t('agent.context.currentTask', '当前推荐任务')}</strong></header>
              {latestTask ? <><b>{subjectLabel(latestTask.subject, t)} · {taskLabel(latestTask.type, t)}</b><span>{Number(latestSnapshot.estimatedMinutes ?? 0)} min · {t(`agent.confidence.${String(latestSnapshot.confidence ?? 'medium')}`, String(latestSnapshot.confidence ?? 'medium'))}</span></> : <p>{t('agent.context.waiting', '询问下一步后，这里会同步任务、预计时间和依据。')}</p>}
            </section>
            <section className="agent-context-card sources">
              <header><Icon name="lucide:database" /><strong>{t('agent.context.sources', '事实来源')}</strong></header>
              <ul><li><i />{t('agent.context.sourceGoal', '你的目标与考试日期')}</li><li><i />{t('agent.context.sourceEvidence', '练习、错题和模考证据')}</li><li><i />{t('agent.context.sourceSupply', '当前已发布合格题源')}</li></ul>
            </section>
            <section className="agent-context-note"><Icon name="lucide:info" /><p>{t('agent.context.note', 'Agent 不直接改写掌握度。每次状态变化必须来自真实学习事件。')}</p></section>
          </>}
          </>}
        </aside>}
      </div>
    </div>
  );
}
