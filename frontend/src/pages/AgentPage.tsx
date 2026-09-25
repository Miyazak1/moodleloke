import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { MathContent } from '../components/MathContent';
import { UserAvatar } from '../components/UserAvatar';
import { LanguageSelector } from '../components/LanguageSelector';
import { AgentPastPaperWorkspace } from '../components/agent/AgentPastPaperWorkspace';
import {
  AgentJourneyResourcesView,
  EvidenceCandidateCard,
  InterventionCard,
  InterventionVerificationCard,
  PastPaperResourceCards,
  isDisplayableIntervention,
  isInterventionRelevantToReport
} from '../components/agent/AgentLearningCards';
import { AgentLearningSettingsView } from '../components/agent/AgentLearningSettingsView';
import { AgentLearningTools } from '../components/agent/AgentLearningTools';
import { AgentWeaknessWorkspace, type WeaknessPracticeSelection } from '../components/agent/AgentWeaknessWorkspace';
import { AgentAdaptiveResultMessage, AgentMockExamResultMessage } from '../components/agent/AgentStructuredReportMessage';
import { useI18n } from '../i18n/useI18n';
import { agentDisabledRedirectUrl, isAgentWebEnabled } from '../lib/agent-feature';
import {
  actOnAgentIntervention,
  continueAgentFreePractice,
  createAgentConversation,
  endAgentFreePractice,
  getAgentConversation,
  getAgentJourneyOverview,
  getAgentJourneyState,
  getAgentInterventionDelivery,
  getAgentRun,
  listAgentConversations,
  offerAgentIntervention,
  offerAgentInterventionVerification,
  recordAgentPrescriptionExposure,
  recordAgentInterventionTeachingInteraction,
  previewAgentAttachment,
  settleAgentPractice,
  settleAgentMockExam,
  startAgentFreePractice,
  startAgentMockExam,
  startAgentPractice,
  startAgentPrescription,
  streamAgentRunEvents,
  submitAgentMessage,
  type AgentAttachment,
  type AgentArtifact,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentInterventionDelivery,
  type AgentInterventionVerification,
  type AgentJourneyOverview,
  type AgentJourneyResumeWorkspace,
  type AgentJourneyState,
  type AgentMessage,
  type AgentMockExamLaunch,
  type AgentMockExamSettlement,
  type AgentPracticeLaunch,
  type AgentStreamEvent,
  type AgentTaskSettlement
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
import { getMyStudentProfile } from '../lib/api-me';
import { routes } from '../lib/routes';
import {
  parseAgentWorkspaceRoute,
  replaceAgentJourneySectionRoute,
  replaceAgentWorkspaceRoute,
  type AgentJourneySection,
  type AgentMockExamWorkspace,
  type AgentPastPaperWorkspaceRoute,
  type AgentPracticeWorkspace
} from '../lib/agent-workspace-route';
import { readMigratedLocalStorage, removeMigratedLocalStorage, writeMigratedLocalStorage } from '../lib/storage-compat';
import { ApiError } from '../lib/request';
import type { AgentHostBridge } from '../lib/agent-host-bridge';
import '../styles/agent.css';
import '../styles/agent-motion.css';
import '../styles/content-typography.css';

type AgentPageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  host: AgentHostBridge;
};

const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);
const AGENT_TASK_RAIL_DEFAULT_WIDTH = 720;
const AGENT_TASK_RAIL_MIN_WIDTH = 480;
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

function formatAgentUserError(error: unknown, locale: string, fallback: string) {
  const copy = locale === 'zh-CN'
    ? {
        network: '暂时无法连接学习服务，请检查网络后重试。',
        session: '登录状态已失效，请重新登录后继续。',
        verify: '请先完成邮箱验证，再继续学习。',
        forbidden: '当前账号暂时不能执行这项操作。',
        unavailable: '这项学习内容暂时不可用，请返回后重新选择。',
        conflict: '学习状态已经更新，请刷新后重试。',
        limited: '操作过于频繁，请稍后再试。',
        supply: '当前科目暂时没有可用题目，你的选择已保留。'
      }
    : locale === 'vi'
      ? {
          network: 'Tạm thời không thể kết nối dịch vụ học tập. Hãy kiểm tra mạng rồi thử lại.',
          session: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.',
          verify: 'Hãy xác minh email trước khi tiếp tục học.',
          forbidden: 'Tài khoản hiện tại chưa thể thực hiện thao tác này.',
          unavailable: 'Nội dung học này tạm thời không khả dụng. Hãy quay lại và chọn lại.',
          conflict: 'Trạng thái học đã được cập nhật. Hãy tải lại rồi thử lại.',
          limited: 'Bạn thao tác quá nhanh. Hãy thử lại sau.',
          supply: 'Hiện chưa có câu hỏi phù hợp cho môn này. Lựa chọn của bạn đã được giữ lại.'
        }
      : {
          network: 'The learning service cannot be reached right now. Check your connection and try again.',
          session: 'Your session has expired. Sign in again to continue.',
          verify: 'Verify your email before continuing.',
          forbidden: 'This account cannot perform that action right now.',
          unavailable: 'This learning content is temporarily unavailable. Go back and choose again.',
          conflict: 'Your learning state has changed. Refresh and try again.',
          limited: 'Too many attempts. Please try again shortly.',
          supply: 'No questions are currently available for this subject. Your selection has been saved.'
        };
  if (isAgentConnectionError(error)) return copy.network;
  if (!(error instanceof ApiError)) return fallback;
  const code = String(error.code ?? '').toUpperCase();
  if (code === 'EMAIL_UNVERIFIED') return copy.verify;
  if (code === 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED') return copy.supply;
  if (error.status === 401) return copy.session;
  if (error.status === 403) return copy.forbidden;
  if (error.status === 404) return copy.unavailable;
  if (error.status === 409) return copy.conflict;
  if (error.status === 429) return copy.limited;
  // The caller knows which operation failed, so a safe operation-specific
  // message is more useful than a generic server failure for 5xx responses.
  if (error.status >= 500) return fallback;
  return fallback;
}

function practiceQaStorageKeys(questionKey: string) {
  return [`moodlelike.agent.practiceQaConversation.${questionKey}`, `cscalite.agent.practiceQaConversation.${questionKey}`] as const;
}

function conversationMatchesPracticeQuestion(conversation: AgentConversation, roundId: number, questionId: number) {
  if (conversation.status !== 'active') return false;
  if (conversation.scopeType) {
    return conversation.scopeType === 'practice_question_qa'
      && conversation.scopeRoundId === roundId
      && conversation.scopeQuestionId === questionId;
  }
  const firstUserMessage = conversation.messages.find((message) => message.role === 'user' && message.content.surface === 'subject_qa');
  if (!firstUserMessage) return true;
  const pageContext = firstUserMessage.content.pageContext && typeof firstUserMessage.content.pageContext === 'object'
    ? firstUserMessage.content.pageContext as { questionContext?: { roundId?: unknown; questionId?: unknown } }
    : null;
  return Number(pageContext?.questionContext?.roundId) === roundId
    && Number(pageContext?.questionContext?.questionId) === questionId;
}

function localizedTaskTitle(value: string | null | undefined, locale: string, t: (key: string, fallback?: string) => string) {
  if (!value) return '';
  if (locale !== 'zh-CN') return value;
  return value
    .replace(/\bchemistry\b/gi, t('agent.subject.chemistry', '化学'))
    .replace(/\bphysics\b/gi, t('agent.subject.physics', '物理'))
    .replace(/\bmath\b/gi, t('agent.subject.math', '数学'));
}

function assessmentLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  if (value === 'correct') return t('agent.analysis.correct', '正确');
  if (value === 'incorrect') return t('agent.analysis.incorrect', '需要订正');
  if (value === 'partially_correct') return t('agent.analysis.partiallyCorrect', '部分正确');
  return t('agent.analysis.notAssessable', '暂不能判断');
}

type AgentTaskLaunch = AgentPracticeLaunch | AgentMockExamLaunch;

function isActivelyResumableWorkspace(workspace: AgentJourneyResumeWorkspace | null | undefined): workspace is AgentJourneyResumeWorkspace {
  if (!workspace) return false;
  if (workspace.kind === 'adaptive_round') return workspace.phase === 'practice';
  if (workspace.kind === 'mock_exam') return workspace.phase === 'taking';
  return true;
}

function isUnavailableTeachingWorkspace(error: unknown) {
  return error instanceof ApiError
    && (error.code === 'INTERVENTION_CONTENT_UNAVAILABLE' || error.status === 404);
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
  const fallbackUrl = agentDisabledRedirectUrl();
  const leaveAgent = () => {
    if (/^https?:\/\//i.test(fallbackUrl)) window.location.assign(fallbackUrl);
    else onNavigate(fallbackUrl);
  };
  return (
    <div className="agent-gate-page">
      <section className="agent-gate-card">
        <span className="agent-gate-mark"><Icon name="lucide:bot" /></span>
        <p className="agent-kicker">Moodlelike Lab</p>
        <h1>{t('agent.disabled.title', '学习 Agent 正在内测。')}</h1>
        <p>{t('agent.disabled.body', '当前入口默认关闭，原有模考、科目训练、错题和真题功能不受影响。')}</p>
        <button type="button" onClick={leaveAgent}>{t('agent.disabled.fallback', '返回原做题入口')}</button>
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
  practiceSelection?: WeaknessPracticeSelection;
};

type AgentQaTimelineEntry =
  | { kind: 'message'; key: string; createdAt: string; order: number; message: AgentMessage }
  | { kind: 'assistance'; key: string; createdAt: string; order: number; item: AgentPracticeAssistanceEvent }
  | { kind: 'teaching'; key: string; createdAt: string; order: number; item: AgentPracticeTeachingEvent };

export function AgentPage({ currentUser, isResolvingAuth, host }: AgentPageProps) {
  const onNavigate = host.navigate;
  const onAuthRedirect = host.requestAuthentication;
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
  const [practiceSettlement, setPracticeSettlement] = useState<AgentTaskSettlement | null>(null);
  const [teachingDeliveryId, setTeachingDeliveryId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const route = parseAgentWorkspaceRoute(window.location.search);
    if (route?.kind === 'teaching') return route.deliveryId;
    return route?.kind === 'practice' ? route.teachingDeliveryId ?? null : null;
  });
  const [learningWorkspace, setLearningWorkspace] = useState<AgentPracticeWorkspace | null>(() => {
    if (typeof window === 'undefined') return null;
    const route = parseAgentWorkspaceRoute(window.location.search);
    return route?.kind === 'practice' ? route.workspace : null;
  });
  const [mockExamWorkspace, setMockExamWorkspace] = useState<AgentMockExamWorkspace | null>(() => {
    if (typeof window === 'undefined') return null;
    const route = parseAgentWorkspaceRoute(window.location.search);
    return route?.kind === 'mock_exam' ? route.workspace : null;
  });
  const [mockExamSettlement, setMockExamSettlement] = useState<AgentMockExamSettlement | null>(null);
  const [mockExamSettlementStatus, setMockExamSettlementStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [mockExamSettlementRevision, setMockExamSettlementRevision] = useState(0);
  const [pastPaperWorkspace, setPastPaperWorkspace] = useState<AgentPastPaperWorkspaceRoute | null>(() => {
    if (typeof window === 'undefined') return null;
    const route = parseAgentWorkspaceRoute(window.location.search);
    return route?.kind === 'past_paper' ? route.workspace : null;
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
  const threadContextRef = useRef('');
  const [isThreadFollowingLatest, setIsThreadFollowingLatest] = useState(true);
  const taskRailDragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const interventionOfferContextRef = useRef<string | null>(null);
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
    if (action.kind === 'send') return void sendMessage(action.value);
    if (action.kind === 'free-start') return void beginFreePractice(action.practiceSelection);
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
    if (typeof window === 'undefined') return 'center';
    return readMigratedLocalStorage(AGENT_TASK_RAIL_POSITION_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY) === 'right' ? 'right' : 'center';
  });
  const [journeySection, setJourneySection] = useState<AgentJourneySection>(() => {
    if (typeof window === 'undefined') return 'today';
    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get('agentSection');
    if (requestedSection === 'plan') return 'today';
    if (requestedSection === 'history' || requestedSection === 'progress') return 'settings';
    if (requestedSection === 'weakness' || requestedSection === 'resources' || requestedSection === 'qa' || requestedSection === 'settings') return requestedSection;
    if (params.has('agentPastPaper')) return 'resources';
    if (params.has('agentRoundId') || params.has('agentMockExamAttemptId') || params.has('agentTeachingDeliveryId')) return 'today';
    const saved = readMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY);
    if (saved === 'history' || saved === 'progress') return 'settings';
    return saved === 'weakness' || saved === 'resources' || saved === 'qa' || saved === 'settings' ? saved : 'today';
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
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  const [learningEntryError, setLearningEntryError] = useState('');
  const [freePracticeContinuationBusy, setFreePracticeContinuationBusy] = useState<'continue' | 'end' | null>(null);
  const [isAdjustingFreePractice, setIsAdjustingFreePractice] = useState(false);
  const [journeyState, setJourneyState] = useState<AgentJourneyState | null>(null);
  const [journeyOverview, setJourneyOverview] = useState<AgentJourneyOverview | null>(null);
  const [isJourneyOverviewLoading, setIsJourneyOverviewLoading] = useState(false);
  const [journeyOverviewError, setJourneyOverviewError] = useState('');
  const [preferredQuestionLanguage, setPreferredQuestionLanguage] = useState<'zh' | 'en' | null>(null);
  const [journeyOverviewRevision, setJourneyOverviewRevision] = useState(0);
  const [practiceQuestionContext, setPracticeQuestionContext] = useState<AgentPracticeQuestionContext | null>(null);
  const [practiceAssistanceEvents, setPracticeAssistanceEvents] = useState<AgentPracticeAssistanceEvent[]>([]);
  const [practiceAssistanceCommand, setPracticeAssistanceCommand] = useState<AgentPracticeAssistanceCommand | null>(null);
  const [practiceAssistanceBusy, setPracticeAssistanceBusy] = useState<AgentPracticeAssistanceEvent['action'] | null>(null);
  const [practiceTeachingEvent, setPracticeTeachingEvent] = useState<AgentPracticeTeachingEvent | null>(null);
  const [practiceTeachingCollapsed, setPracticeTeachingCollapsed] = useState(false);
  const [practiceHelpOpen, setPracticeHelpOpen] = useState(false);
  const [practiceAuxiliaryMode, setPracticeAuxiliaryMode] = useState<'qa' | 'tools'>('qa');
  const [practiceQaConversation, setPracticeQaConversation] = useState<AgentConversation | null>(null);
  const [practiceQaDraft, setPracticeQaDraft] = useState('');
  const [practiceQaSending, setPracticeQaSending] = useState(false);
  const [practiceQaError, setPracticeQaError] = useState('');
  const [streamingAnswer, setStreamingAnswer] = useState<{ runId: string; conversationId: string; text: string } | null>(null);
  const practiceQaInputRef = useRef<HTMLTextAreaElement | null>(null);
  const practiceQaStreamAbortRef = useRef<AbortController | null>(null);
  const practiceQaQuestionKey = practiceQuestionContext
    ? `${practiceQuestionContext.roundId}.${practiceQuestionContext.questionId}`
    : null;
  const practiceQaQuestionKeyRef = useRef<string | null>(practiceQaQuestionKey);
  const autoOpenedWrongQuestionRef = useRef<string | null>(null);
  practiceQaQuestionKeyRef.current = practiceQaQuestionKey;
  const enabled = isAgentWebEnabled();
  const questionLanguage = preferredQuestionLanguage ?? (locale === 'en' ? 'en' : 'zh');

  useEffect(() => {
    let current = true;
    if (!currentUser) {
      setPreferredQuestionLanguage(null);
      return () => { current = false; };
    }
    void getMyStudentProfile()
      .then((profile) => {
        if (!current) return;
        if (profile.preferredQuestionLanguageCode === 'en') setPreferredQuestionLanguage('en');
        else if (profile.preferredQuestionLanguageCode === 'zh-CN') setPreferredQuestionLanguage('zh');
        else setPreferredQuestionLanguage(null);
      })
      .catch(() => { if (current) setPreferredQuestionLanguage(null); });
    return () => { current = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    const saved = readMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY);
    if (saved === 'plan') writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'today');
    if (saved === 'history' || saved === 'progress') writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'settings');
    const params = new URLSearchParams(window.location.search);
    const legacySection = params.get('agentSection');
    if (legacySection !== 'plan' && legacySection !== 'history' && legacySection !== 'progress') return;
    if (legacySection === 'history' || legacySection === 'progress') {
      params.set('agentSection', 'settings');
      params.set('agentSettings', 'progress');
    } else params.delete('agentSection');
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`);
  }, []);

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

  const openPracticeHelp = useCallback(() => {
    setPracticeAuxiliaryMode('qa');
    setPracticeHelpOpen(true);
    setTaskRailPosition('center');
    writeMigratedLocalStorage(AGENT_TASK_RAIL_POSITION_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY, 'center');
    setPracticeQaError('');
    if (practiceQaQuestionKey && !practiceQaConversation) {
      const questionKey = practiceQaQuestionKey;
      const [primaryKey, legacyKey] = practiceQaStorageKeys(practiceQaQuestionKey);
      const storedId = readMigratedLocalStorage(primaryKey, legacyKey);
      if (storedId) {
        void getAgentConversation(storedId)
          .then((item) => {
            if (practiceQaQuestionKeyRef.current !== questionKey) return;
            const [roundId, questionId] = questionKey.split('.').map(Number);
            if (conversationMatchesPracticeQuestion(item, roundId, questionId)) setPracticeQaConversation(item);
            else removeMigratedLocalStorage(primaryKey, legacyKey);
          })
          .catch(() => removeMigratedLocalStorage(primaryKey, legacyKey));
      }
    }
    window.requestAnimationFrame(() => practiceQaInputRef.current?.focus());
  }, [practiceQaConversation, practiceQaQuestionKey]);

  const openPracticeTools = useCallback(() => {
    setPracticeAuxiliaryMode('tools');
    setPracticeHelpOpen(true);
    setTaskRailPosition('center');
    writeMigratedLocalStorage(AGENT_TASK_RAIL_POSITION_STORAGE_KEY, LEGACY_AGENT_TASK_RAIL_POSITION_STORAGE_KEY, 'center');
  }, []);

  const preparePracticeQaQuestion = useCallback((question: string) => {
    setPracticeQaDraft(question);
    window.requestAnimationFrame(() => practiceQaInputRef.current?.focus());
  }, []);

  const receivePracticeTeachingAsset = useCallback((event: AgentPracticeTeachingEvent) => {
    setPracticeTeachingEvent(event);
    setPracticeTeachingCollapsed(false);
  }, []);

  useEffect(() => {
    if (!practiceQuestionContext || practiceQuestionContext.isCorrect !== false) return;
    const questionKey = `${practiceQuestionContext.roundId}.${practiceQuestionContext.questionId}`;
    if (autoOpenedWrongQuestionRef.current === questionKey) return;
    autoOpenedWrongQuestionRef.current = questionKey;
    openPracticeHelp();
  }, [openPracticeHelp, practiceQuestionContext]);

  const followPracticeQaRun = useCallback(async (runId: string, conversationId: string, questionKey: string) => {
    practiceQaStreamAbortRef.current?.abort();
    const controller = new AbortController();
    practiceQaStreamAbortRef.current = controller;
    setStreamingAnswer({ runId, conversationId, text: '' });
    let cursor = 0;
    try {
      for (let attempt = 0; attempt < 5 && !controller.signal.aborted; attempt += 1) {
        try {
          await streamAgentRunEvents(runId, cursor, controller.signal, (event) => {
            cursor = Math.max(cursor, event.sequence);
            if (event.type !== 'answer.delta' || typeof event.data.delta !== 'string') return;
            setStreamingAnswer((current) => current?.runId === runId
              ? { ...current, text: current.text + event.data.delta }
              : current);
          });
        } catch {
          if (controller.signal.aborted) return;
        }
        const run = await getAgentRun(runId).catch(() => null);
        if (!run) {
          await wait(500 + attempt * 300);
          continue;
        }
        if (TERMINAL_RUN_STATUSES.has(run.status)) {
          const item = await getAgentConversation(conversationId);
          if (practiceQaQuestionKeyRef.current === questionKey) {
            setPracticeQaConversation(item);
            if (run.status !== 'completed') setPracticeQaError(t('agent.subjectQa.failed', '本题问答暂时没有完成，请重试。'));
          }
          setStreamingAnswer((current) => current?.runId === runId ? null : current);
          return;
        }
        await wait(500 + attempt * 300);
      }
      if (practiceQaQuestionKeyRef.current === questionKey) setPracticeQaError(t('agent.subjectQa.slow', '回答仍在生成，你可以稍后继续查看。'));
      setStreamingAnswer((current) => current?.runId === runId ? null : current);
    } catch (nextError) {
      if (practiceQaQuestionKeyRef.current === questionKey) setPracticeQaError(formatAgentUserError(nextError, locale, t('agent.subjectQa.failed', '本题问答暂时没有完成，请重试。')));
      setStreamingAnswer((current) => current?.runId === runId ? null : current);
    } finally {
      if (practiceQaQuestionKeyRef.current === questionKey) setPracticeQaSending(false);
    }
  }, [locale, t]);

  const sendPracticeQaMessage = useCallback(async () => {
    const text = practiceQaDraft.trim();
    const context = practiceQuestionContext;
    if (!text || !context || practiceQaSending || !currentUser) return;
    const questionKey = `${context.roundId}.${context.questionId}`;
    setPracticeQaSending(true);
    setPracticeQaError('');
    try {
      let conversationId = practiceQaConversation?.id;
      const [primaryKey, legacyKey] = practiceQaStorageKeys(questionKey);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!conversationId) {
          const created = await createAgentConversation({
            title: `${subjectLabel(context.subject, t)}${t('agent.practiceQa.titleSuffix', '练习问答')} · ${t('agent.practiceAssistance.boundQuestion', '第 {number} 题').replace('{number}', String(context.questionNumber))}`,
            scope: { type: 'practice_question_qa', roundId: context.roundId, questionId: context.questionId }
          });
          conversationId = created.id;
          writeMigratedLocalStorage(primaryKey, legacyKey, created.id);
        }
        try {
          const submission = await submitAgentMessage(conversationId, {
            clientRequestId: clientRequestId(),
            text,
            locale: locale === 'zh-CN' ? 'zh-CN' : 'en',
            surface: 'subject_qa',
            attachmentIds: [],
            pageContext: {
              route: `${window.location.pathname}${window.location.search}`,
              artifactId: learningWorkspace?.artifactId,
              entityRef: { type: 'adaptive_round', id: String(context.roundId) },
              selectedQuestionId: context.questionId,
              questionContext: {
                roundId: context.roundId,
                questionId: context.questionId,
                questionSource: context.questionSource,
                questionNumber: context.questionNumber,
                subject: context.subject,
                topicTitle: context.topicTitle,
                prompt: context.prompt,
                options: context.options,
                ...(context.selectedAnswer ? { selectedAnswer: context.selectedAnswer } : {}),
                answered: context.answered,
                ...(context.correctAnswer ? { correctAnswer: context.correctAnswer } : {}),
                ...(typeof context.isCorrect === 'boolean' ? { isCorrect: context.isCorrect } : {}),
                ...(context.explanation ? { explanation: context.explanation } : {}),
                ...(context.knowledgeTags?.length ? { knowledgeTags: context.knowledgeTags } : {})
              }
            }
          });
          setPracticeQaDraft('');
          const submittedConversation = await getAgentConversation(conversationId);
          if (practiceQaQuestionKeyRef.current === questionKey) setPracticeQaConversation(submittedConversation);
          void followPracticeQaRun(submission.runId, conversationId, questionKey);
          return;
        } catch (nextError) {
          if (!(nextError instanceof ApiError) || nextError.code !== 'AGENT_QA_CONTEXT_MISMATCH' || attempt > 0) throw nextError;
          removeMigratedLocalStorage(primaryKey, legacyKey);
          setPracticeQaConversation(null);
          conversationId = undefined;
        }
      }
    } catch (nextError) {
      if (practiceQaQuestionKeyRef.current === questionKey) {
        setPracticeQaSending(false);
        setPracticeQaError(formatAgentUserError(nextError, locale, t('agent.subjectQa.failed', '本题问答暂时没有完成，请重试。')));
      }
    }
  }, [currentUser, followPracticeQaRun, learningWorkspace?.artifactId, locale, practiceQaConversation?.id, practiceQaDraft, practiceQaSending, practiceQuestionContext, t]);

  useEffect(() => {
    setPracticeQaConversation(null);
    setPracticeQaDraft('');
    setPracticeQaSending(false);
    setPracticeQaError('');
    practiceQaStreamAbortRef.current?.abort();
    setStreamingAnswer((current) => current && current.conversationId === practiceQaConversation?.id ? null : current);
    if (!practiceHelpOpen || !practiceQaQuestionKey) return;
    const [primaryKey, legacyKey] = practiceQaStorageKeys(practiceQaQuestionKey);
    const storedId = readMigratedLocalStorage(primaryKey, legacyKey);
    if (!storedId) return;
    let alive = true;
    void getAgentConversation(storedId)
      .then((item) => {
        if (!alive) return;
        const [roundId, questionId] = practiceQaQuestionKey.split('.').map(Number);
        if (conversationMatchesPracticeQuestion(item, roundId, questionId)) setPracticeQaConversation(item);
        else removeMigratedLocalStorage(primaryKey, legacyKey);
      })
      .catch(() => removeMigratedLocalStorage(primaryKey, legacyKey));
    return () => { alive = false; };
  }, [practiceQaQuestionKey]);

  const updateThreadFollowState = useCallback(() => {
    const scroller = threadScrollRef.current;
    if (!scroller) return;
    const distanceFromLatest = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    setIsThreadFollowingLatest(distanceFromLatest <= 72);
  }, []);

  const scrollConversationToLatest = useCallback((smooth = false) => {
    const scroller = threadScrollRef.current;
    if (!scroller) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: smooth && !reducedMotion ? 'smooth' : 'auto'
    });
    setIsThreadFollowingLatest(true);
  }, []);

  const threadContextKey = [
    journeySection,
    activeConversationId ?? '',
    learningWorkspace?.roundId ?? '',
    mockExamWorkspace?.attemptId ?? '',
    practiceQaQuestionKey ?? ''
  ].join(':');

  useLayoutEffect(() => {
    const contextChanged = threadContextRef.current !== threadContextKey;
    threadContextRef.current = threadContextKey;
    if (!contextChanged && !isThreadFollowingLatest) return;
    let settledFrame = 0;
    const layoutFrame = window.requestAnimationFrame(() => {
      scrollConversationToLatest();
      settledFrame = window.requestAnimationFrame(() => scrollConversationToLatest());
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
    practiceQaConversation?.messages.length,
    practiceTeachingEvent?.id,
    learningWorkspace?.phase,
    learningWorkspace?.roundId,
    mockExamWorkspace?.phase,
    mockExamWorkspace?.attemptId,
    runStatus,
    isThreadFollowingLatest,
    scrollConversationToLatest,
    streamingAnswer?.text,
    teachingDeliveryId,
    threadContextKey
  ]);

  useEffect(() => {
    const scroller = threadScrollRef.current;
    const messageList = messageListRef.current;
    if (!scroller || !messageList || typeof ResizeObserver === 'undefined') return;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      if (!isThreadFollowingLatest) return;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => scrollConversationToLatest());
    });
    observer.observe(scroller);
    observer.observe(messageList);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [conversation?.id, isThreadFollowingLatest, scrollConversationToLatest]);

  useEffect(() => {
    setAdaptiveReport(null);
    setPracticeSettlement(null);
    setPracticeQuestionContext(null);
    setPracticeAssistanceEvents([]);
    setPracticeAssistanceCommand(null);
    setPracticeAssistanceBusy(null);
    setPracticeTeachingEvent(null);
    setPracticeTeachingCollapsed(false);
    setPracticeHelpOpen(false);
    setPracticeAuxiliaryMode('qa');
    setPracticeQaConversation(null);
    setPracticeQaDraft('');
    setPracticeQaSending(false);
    setPracticeQaError('');
  }, [learningWorkspace?.roundId, mockExamWorkspace?.attemptId]);

  const syncWorkspaceUrl = useCallback((workspace: AgentPracticeWorkspace | null) => {
    replaceAgentWorkspaceRoute(workspace ? { kind: 'practice', workspace } : null);
  }, []);

  const syncTeachingWorkspaceUrl = useCallback((deliveryId: string | null) => {
    if (learningWorkspace) {
      replaceAgentWorkspaceRoute({ kind: 'practice', workspace: learningWorkspace, ...(deliveryId ? { teachingDeliveryId: deliveryId } : {}) });
      return;
    }
    replaceAgentWorkspaceRoute(deliveryId ? { kind: 'teaching', deliveryId } : null);
  }, [learningWorkspace]);

  const openTeachingWorkspace = useCallback((item: AgentInterventionDelivery) => {
    if (!item.content.teachingAsset) return;
    setTeachingDeliveryId(item.id);
    syncTeachingWorkspaceUrl(item.id);
  }, [syncTeachingWorkspaceUrl]);

  const closeTeachingWorkspace = useCallback(() => {
    setTeachingDeliveryId(null);
    syncTeachingWorkspaceUrl(null);
    focusComposer();
  }, [focusComposer, syncTeachingWorkspaceUrl]);

  const openLearningWorkspace = useCallback((launch: AgentPracticeLaunch) => {
    const workspace: AgentPracticeWorkspace = {
      artifactId: launch.artifactId,
      contextId: launch.conversationId,
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

  const syncMockExamWorkspaceUrl = useCallback((workspace: AgentMockExamWorkspace | null) => {
    replaceAgentWorkspaceRoute(workspace ? { kind: 'mock_exam', workspace } : null);
  }, []);

  const openMockExamWorkspace = useCallback((launch: AgentMockExamLaunch) => {
    const workspace: AgentMockExamWorkspace = {
      artifactId: launch.artifactId,
      contextId: launch.conversationId,
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
    const workspace: AgentPracticeWorkspace = {
      verificationId: item.id,
      contextId: conversationId,
      roundId: Number(roundMatch[1]),
      phase: path.includes('/report') ? 'report' : 'practice'
    };
    setLearningWorkspace(workspace);
    setTeachingDeliveryId(null);
    syncWorkspaceUrl(workspace);
  }, [syncWorkspaceUrl]);

  const openPastPaperWorkspace = useCallback((slug: string, contextId?: string, questionId?: number) => {
    setJourneySection('resources');
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'resources');
    setPastPaperWorkspace({ slug, ...(contextId ? { contextId } : {}), ...(questionId ? { questionId } : {}) });
    replaceAgentWorkspaceRoute({ kind: 'past_paper', workspace: { slug, ...(contextId ? { contextId } : {}), ...(questionId ? { questionId } : {}) } });
  }, []);

  const handlePastPaperContextReady = useCallback((contextId: string) => {
    setPastPaperWorkspace((current) => current ? { ...current, contextId } : current);
    if (!pastPaperWorkspace?.slug) return;
    replaceAgentWorkspaceRoute({ kind: 'past_paper', workspace: { ...pastPaperWorkspace, contextId } });
  }, [pastPaperWorkspace?.slug]);

  const closePastPaperWorkspace = useCallback((_contextId?: string, prompt?: string, context?: { slug: string; questionId: number }) => {
    setPastPaperWorkspace(null);
    if (prompt && context) {
      setJourneySection('qa');
      writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'qa');
      setActiveConversationId(null);
      setConversation(null);
      setDraft(prompt);
      setDraftPageContext(null);
      replaceAgentJourneySectionRoute('qa');
      focusComposer();
    } else {
      setDraftPageContext(null);
      replaceAgentJourneySectionRoute('resources');
    }
  }, [focusComposer]);

  const restoreJourneyWorkspace = useCallback((workspace: AgentJourneyResumeWorkspace) => {
    setJourneySection('today');
    setLearningWorkspace(null);
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    if (workspace.kind === 'adaptive_round') {
      const restored: AgentPracticeWorkspace = {
        artifactId: workspace.artifactId,
        verificationId: workspace.verificationId,
        contextId: workspace.conversationId,
        roundId: workspace.roundId,
        phase: workspace.phase,
        taskType: workspace.taskType,
        subject: workspace.subject ?? undefined
      };
      setLearningWorkspace(restored);
      syncWorkspaceUrl(restored);
      return;
    }
    if (workspace.kind === 'mock_exam') {
      const restored: AgentMockExamWorkspace = {
        artifactId: workspace.artifactId,
        contextId: workspace.conversationId,
        attemptId: workspace.attemptId,
        phase: workspace.phase,
        subject: workspace.subject ?? undefined,
        paperTitle: workspace.paperTitle ?? undefined
      };
      setMockExamWorkspace(restored);
      syncMockExamWorkspaceUrl(restored);
      return;
    }
    if (workspace.kind === 'past_paper') {
      setPastPaperWorkspace({ slug: workspace.slug, contextId: workspace.conversationId, questionId: workspace.questionId });
      replaceAgentWorkspaceRoute({ kind: 'past_paper', workspace: { slug: workspace.slug, contextId: workspace.conversationId, questionId: workspace.questionId } });
      return;
    }
    setTeachingDeliveryId(workspace.deliveryId);
    syncTeachingWorkspaceUrl(workspace.deliveryId);
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
      'answer.delta': t('agent.subjectQa.streaming', 'AI 正在实时生成'),
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
    setStreamingAnswer({ runId, conversationId, text: '' });
    setRunStatus(t('agent.status.connecting', '正在连接学习分析'));
    let cursor = 0;
    for (let attempt = 0; attempt < 5 && !controller.signal.aborted; attempt += 1) {
      try {
        await streamAgentRunEvents(runId, cursor, controller.signal, (event) => {
          cursor = Math.max(cursor, event.sequence);
          setRunStatus(runStatusLabel(event));
          if (event.type === 'answer.delta' && typeof event.data.delta === 'string') {
            setStreamingAnswer((current) => current?.runId === runId
              ? { ...current, text: current.text + event.data.delta }
              : current);
          }
        });
        const run = await getAgentRun(runId);
        if (TERMINAL_RUN_STATUSES.has(run.status)) {
          await Promise.all([loadConversation(conversationId), loadSummaries()]);
          setRunStatus(run.status === 'completed' ? t('agent.status.completed', '方案已就绪') : t('agent.status.failed', '本次分析没有完成'));
          setStreamingAnswer((current) => current?.runId === runId ? null : current);
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
        setStreamingAnswer((current) => current?.runId === runId ? null : current);
      } else {
        showError(t('agent.error.stream', '暂时无法同步分析进度，请稍后重试。'));
        setStreamingAnswer((current) => current?.runId === runId ? null : current);
      }
      setIsSending(false);
    }
  }, [loadConversation, loadSummaries, runStatusLabel, t]);

  useEffect(() => () => {
    streamAbortRef.current?.abort();
    practiceQaStreamAbortRef.current?.abort();
  }, []);

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
    // Canonicalize a restored workspace before any asynchronous loading starts.
    // Doing this after the request could resurrect stale route parameters when
    // the workspace child had already reported that the round no longer exists.
    if (journeySection !== 'qa') {
      const initialWorkspaceRoute = parseAgentWorkspaceRoute(window.location.search);
      if (initialWorkspaceRoute) replaceAgentWorkspaceRoute(initialWorkspaceRoute);
    }
    void (async () => {
      let retryAttempt = 0;
      while (current) {
        try {
          const state = await loadJourneyState().catch(() => null);
          if (!current) return;
          const params = new URLSearchParams(window.location.search);

          if (journeySection === 'qa') {
            const items = await loadSummaries();
            if (!current) return;
            if (items[0]) {
              const requestedId = params.get('conversation');
              const selectedId = items.some((item) => item.id === requestedId)
                ? requestedId!
                : items[0].id;
              setActiveConversationId(selectedId);
              await loadConversation(selectedId);
              if (!current) return;
            } else {
              setActiveConversationId(null);
              setConversation(null);
            }
          } else {
            streamAbortRef.current?.abort();
            setConversation(null);
            setConversations([]);
            setActiveConversationId(null);
            if (params.has('conversation') || params.has('agentConversationId')) {
              const workspaceRoute = parseAgentWorkspaceRoute(window.location.search);
              if (!workspaceRoute) {
                replaceAgentJourneySectionRoute(journeySection);
              }
            }
          }
          clearErrorNotice();
          setIsLoading(false);
          return;
        } catch (loadError) {
          if (!current) return;
          if (!isAgentConnectionError(loadError)) {
            showError(formatAgentUserError(loadError, locale, t('agent.error.load', '无法加载学习对话。')));
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
  }, [currentUser?.id, enabled, isResolvingAuth, journeySection, locale]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || (journeySection !== 'settings' && journeySection !== 'weakness' && journeySection !== 'resources')) return;
    let current = true;
    setIsJourneyOverviewLoading(true);
    setJourneyOverviewError('');
    void getAgentJourneyOverview(locale === 'en' ? 'en' : 'zh-CN')
      .then((result) => { if (current) setJourneyOverview(result); })
      .catch((loadError) => { if (current) setJourneyOverviewError(formatAgentUserError(loadError, locale, t('agent.journey.dataUnavailable', '暂时无法读取'))); })
      .finally(() => { if (current) setIsJourneyOverviewLoading(false); });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, journeyOverviewRevision, journeySection, locale, t]);

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
        await loadJourneyState().catch(() => undefined);
      })
      .catch(() => {
        if (current) setMockExamSettlementStatus('unavailable');
      });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, loadJourneyState, mockExamSettlementRevision, mockExamWorkspace?.attemptId, mockExamWorkspace?.phase]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || !teachingDeliveryId) return;
    let current = true;
    void getAgentInterventionDelivery(teachingDeliveryId)
      .then((item) => {
        if (!current) return;
        if (isDisplayableIntervention(item)) {
          setIntervention(item);
          return;
        }
        setIntervention(null);
        setTeachingDeliveryId(null);
        syncTeachingWorkspaceUrl(null);
        setLearningEntryError(t('agent.learningEntry.staleTeaching', '上次讲解已经结束，已返回当前可开始的学习任务。'));
        void loadJourneyState().catch(() => undefined);
      })
      .catch((loadError) => {
        if (!current) return;
        setIntervention(null);
        if (isUnavailableTeachingWorkspace(loadError)) {
          setTeachingDeliveryId(null);
          syncTeachingWorkspaceUrl(null);
          setLearningEntryError(t('agent.learningEntry.staleTeaching', '上次讲解内容已失效，已返回当前可开始的学习任务。'));
          void loadJourneyState().catch(() => undefined);
          return;
        }
        setLearningEntryError(formatAgentUserError(loadError, locale, t('agent.learningEntry.resumeFailed', '暂时无法恢复上次学习，请重试。')));
      });
    return () => { current = false; };
  }, [currentUser?.id, isResolvingAuth, loadJourneyState, syncTeachingWorkspaceUrl, teachingDeliveryId, t]);

  useEffect(() => {
    // Generic interventions belong between completed sets. During an active
    // round the right rail is strictly scoped to the current question; its
    // teaching content is loaded through getAgentTeachingAssetForQuestion.
    const isTaskContext = journeySection === 'today' && learningWorkspace?.phase === 'report';
    const isSubjectQaContext = journeySection === 'qa' && Boolean(conversation?.messages.length);
    const contextId = isTaskContext ? learningWorkspace?.contextId : isSubjectQaContext ? conversation?.id : null;
    const hasEligibleContext = isTaskContext || isSubjectQaContext;
    if (isResolvingAuth || !currentUser || !contextId || !hasEligibleContext || isSending || teachingDeliveryId) return;
    const requestContextKey = `${isTaskContext ? 'learning' : 'subject-qa'}:${contextId}`;
    if (interventionOfferContextRef.current !== requestContextKey) {
      interventionOfferContextRef.current = requestContextKey;
      setInterventionVerification(null);
    }
    let current = true;
    void offerAgentIntervention({
      clientRequestId: clientRequestId(),
      context: isTaskContext ? 'after_round' : 'agent_conversation',
      conversationId: contextId,
      language: locale === 'zh-CN' ? 'zh-CN' : 'en'
    })
      .then((result) => {
        if (current && interventionOfferContextRef.current === requestContextKey && isDisplayableIntervention(result.item)) {
          setIntervention(result.item);
        }
      })
      .catch(() => undefined);
    void offerAgentInterventionVerification({ clientRequestId: clientRequestId(), conversationId: contextId })
      .then((result) => {
        if (current && interventionOfferContextRef.current === requestContextKey) setInterventionVerification(result.item);
      })
      .catch(() => undefined);
    return () => { current = false; };
  }, [conversation?.id, conversation?.messages.length, currentUser?.id, isResolvingAuth, isSending, journeySection, learningWorkspace?.contextId, learningWorkspace?.phase, locale, teachingDeliveryId]);

  async function chooseConversation(id: string) {
    if (id === activeConversationId && !learningWorkspace && !mockExamWorkspace && !pastPaperWorkspace) return;
    streamAbortRef.current?.abort();
    observedRunRef.current = null;
    setLearningWorkspace(null);
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    setPastPaperWorkspace(null);
    setTeachingDeliveryId(null);
    setIntervention(null);
    setInterventionVerification(null);
    setDraftPageContext(null);
    replaceAgentJourneySectionRoute('qa', id);
    setActiveConversationId(id);
    setConversation(null);
    clearErrorNotice();
    setIsLoading(true);
    try {
      await loadConversation(id);
    } catch (loadError) {
      showError(formatAgentUserError(loadError, locale, t('agent.error.load', '无法加载学习对话。')));
    } finally {
      setIsLoading(false);
    }
  }

  function chooseJourneySection(section: AgentJourneySection) {
    if (section !== 'resources') setPastPaperWorkspace(null);
    setJourneySection(section);
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, section);
    if (section === 'today' && learningWorkspace) syncWorkspaceUrl(learningWorkspace);
    else if (section === 'today' && mockExamWorkspace) syncMockExamWorkspaceUrl(mockExamWorkspace);
    else if (section === 'today' && teachingDeliveryId) syncTeachingWorkspaceUrl(teachingDeliveryId);
    else if (section === 'resources' && pastPaperWorkspace) replaceAgentWorkspaceRoute({ kind: 'past_paper', workspace: pastPaperWorkspace });
    else replaceAgentJourneySectionRoute(section, section === 'qa' ? activeConversationId : null);
  }

  function showJourneySection(section: AgentJourneySection) {
    setJourneySection(section);
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, section);
  }

  async function sendMessage(value?: string) {
    const text = String(value ?? draft).trim();
    const surface = 'subject_qa' as const;
    if (journeySection !== 'qa' || !text || isSending || !currentUser) return;
    clearErrorNotice();
    setIsSending(true);
    setRunStatus(t('agent.subjectQa.preparing', '正在准备学科回答'));
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await createAgentConversation({ title: text.slice(0, 60), scope: { type: 'independent_subject_qa' } });
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((items) => [created, ...items]);
      }
      const submission = await submitAgentMessage(conversationId, {
        clientRequestId: clientRequestId(),
        text,
        locale: locale === 'zh-CN' ? 'zh-CN' : 'en',
        surface,
        attachmentIds: []
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
    const subject = learningWorkspace?.subject === 'math' || learningWorkspace?.subject === 'physics' || learningWorkspace?.subject === 'chemistry'
      ? learningWorkspace.subject
      : freePracticeSubject;
    return { subject, questionCount: freePracticeCount };
  }

  function toggleFreePracticeAdjustment() {
    if (!isAdjustingFreePractice) {
      const current = currentFreePracticeConfig();
      setFreePracticeSubject(current.subject);
      setFreePracticeCount(current.questionCount);
    }
    setIsAdjustingFreePractice((value) => !value);
  }

  async function beginFreePractice(selection?: WeaknessPracticeSelection): Promise<boolean> {
    if (isStartingFreePractice || !currentUser) return false;
    const next = selection ?? { subject: freePracticeSubject, questionCount: freePracticeCount };
    clearErrorNotice();
    setIsStartingFreePractice(true);
    try {
      const launch = await startAgentFreePractice({
        clientRequestId: clientRequestId(),
        subject: next.subject, questionCount: next.questionCount,
        questionLanguage,
        ...(next.focusTopicId ? { focusTopicId: next.focusTopicId } : {}),
        ...(next.reviewItemId ? { reviewItemId: next.reviewItemId } : {}),
        ...(next.patternType ? { patternType: next.patternType } : {})
      });
      await loadJourneyState().catch(() => null);
      openLearningWorkspace(launch);
      return true;
    } catch (nextError) {
      const failureMessage = formatAgentUserError(
        nextError,
        locale,
        t('agent.freePractice.startRecoverable', '自由练习还没有开始；科目和题量已保留。')
      );
      showError(
        failureMessage,
        { kind: 'free-start', label: t('agent.freePractice.retryStart', '重试开始'), ...(selection ? { practiceSelection: selection } : {}) }
      );
      return false;
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
        questionLanguage
      });
      setIsAdjustingFreePractice(false);
      await loadJourneyState();
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
      setLearningWorkspace(null);
      setIsAdjustingFreePractice(false);
      syncWorkspaceUrl(null);
      await loadJourneyState();
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
      setMockExamWorkspace(null);
      setMockExamSettlement(null);
      syncMockExamWorkspaceUrl(null);
      await loadJourneyState();
      setIsSending(false);
      setRunStatus('');
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
      const next: AgentPracticeWorkspace = {
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
      setLearningWorkspace(null);
      syncWorkspaceUrl(null);
      await loadJourneyState().catch(() => undefined);
      return;
    }

    // Closing an Agent-owned round returns to its conversation. Legacy destinations
    // remain available only for capabilities that have not moved into the shell yet.
    if (path.includes('/csca-subjects/')) {
      setLearningWorkspace(null);
      syncWorkspaceUrl(null);
      await loadJourneyState().catch(() => undefined);
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
    setMockExamWorkspace(null);
    setMockExamSettlement(null);
    syncMockExamWorkspaceUrl(null);
    await loadJourneyState().catch(() => undefined);
  }

  async function startRecommendedDecision(prescriptionId: string) {
    if (isStartingLearning || isStartingFreePractice || !currentUser) return;
    clearErrorNotice();
    setLearningEntryError('');
    setIsStartingLearning(true);
    try {
      const launch = await startAgentPrescription(prescriptionId, {
        clientRequestId: clientRequestId(),
        questionLanguage
      });
      openTaskWorkspace(launch);
      await loadJourneyState().catch(() => undefined);
    } catch (nextError) {
      const message = formatAgentUserError(nextError, locale, t('agent.learningEntry.startFailed', '暂时无法开始学习，请重试。'));
      setLearningEntryError(message);
      showError(message);
    } finally {
      setIsStartingLearning(false);
    }
  }

  function followAdaptiveDecision() {
    const next = adaptiveReport?.learningDecision?.nextStep;
    if (next && (next.type === 'review_mistakes' || next.type === 'targeted_practice')) {
      void beginFreePractice({
        subject: next.subject,
        questionCount: next.questionCount,
        ...(next.topicId ? { focusTopicId: next.topicId } : {}),
        ...(next.reviewItemId && next.patternType ? { reviewItemId: next.reviewItemId, patternType: next.patternType } : {})
      });
      return;
    }
    if (next?.type === 'delayed_verification') return;
    void continueFreePracticeBatch();
  }

  function closeSettingsWorkspace() {
    setJourneySection('today');
    writeMigratedLocalStorage(AGENT_JOURNEY_SECTION_STORAGE_KEY, LEGACY_AGENT_JOURNEY_SECTION_STORAGE_KEY, 'today');
    if (learningWorkspace) syncWorkspaceUrl(learningWorkspace);
    else if (mockExamWorkspace) syncMockExamWorkspaceUrl(mockExamWorkspace);
    else if (teachingDeliveryId) syncTeachingWorkspaceUrl(teachingDeliveryId);
    else replaceAgentJourneySectionRoute('today');
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
      else if (pastPaperWorkspace) closePastPaperWorkspace(pastPaperWorkspace.contextId);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [journeySection, learningWorkspace, mockExamWorkspace, pastPaperWorkspace, teachingDeliveryId]);

  const latestArtifact = useMemo(() => {
    const artifacts = [...(journeyState?.plans ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return artifacts[0] ?? null;
  }, [journeyState?.plans]);
  const startablePlanArtifact = useMemo(() => {
    const artifacts = [...(journeyState?.plans ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return artifacts.find((item) => {
      const snapshot = item.snapshot ?? {};
      return item.type === 'learning_plan' && item.status === 'ready' && snapshot.canStart === true && Boolean(item.route);
    }) ?? null;
  }, [journeyState?.plans]);
  const latestSnapshot = latestArtifact?.snapshot ?? {};
  const latestTask = latestSnapshot.task && typeof latestSnapshot.task === 'object'
    ? latestSnapshot.task as Record<string, unknown>
    : null;
  const isSubjectQa = journeySection === 'qa';
  const isPracticeQa = !isSubjectQa
    && journeySection === 'today'
    && learningWorkspace?.phase === 'practice'
    && practiceHelpOpen
    && practiceAuxiliaryMode === 'qa';
  const isPracticeTools = !isSubjectQa
    && journeySection === 'today'
    && practiceHelpOpen
    && practiceAuxiliaryMode === 'tools'
    && (learningWorkspace?.phase === 'practice' || mockExamWorkspace?.phase === 'taking');
  const isJourneyOverview = journeySection === 'weakness'
    || journeySection === 'resources'
    || journeySection === 'settings';
  const subjectQaMessages = conversation?.messages.filter((message) => message.content.surface === 'subject_qa') ?? [];
  const practiceQaMessages = practiceQaConversation?.messages.filter((message) => message.content.surface === 'subject_qa') ?? [];
  const visibleMessages = isSubjectQa ? subjectQaMessages : isPracticeQa ? practiceQaMessages : [];
  const isQaChatSurface = isSubjectQa || isPracticeQa;
  const currentWorkspaceOutput = null;
  const effectiveLearningMode = sessionLearningModeOverride ?? learningMode;
  const resumableWorkspace = isActivelyResumableWorkspace(journeyState?.activeWorkspace) ? journeyState.activeWorkspace : null;
  const resumableStage = resumableWorkspace
    ? journeyState?.stages.find((stage) => stage.resume?.conversationId === resumableWorkspace.conversationId && stage.status === 'active') ?? null
    : null;
  const resumedTeachingContextId = resumableWorkspace?.kind === 'teaching'
    && resumableWorkspace.deliveryId === teachingDeliveryId
    ? resumableWorkspace.conversationId
    : null;
  const activeEvidenceContextId = learningWorkspace?.contextId ?? resumedTeachingContextId ?? conversation?.id ?? null;
  const resumableSubject = resumableWorkspace && 'subject' in resumableWorkspace ? resumableWorkspace.subject : resumableStage?.subject;
  const resumableTaskType = resumableWorkspace && 'taskType' in resumableWorkspace ? resumableWorkspace.taskType : resumableStage?.taskType;
  const resumableActionLabel = resumableWorkspace?.kind === 'teaching'
    ? t('agent.learningEntry.resumeTeaching', '继续知识讲解')
    : resumableWorkspace?.kind === 'past_paper'
      ? t('agent.learningEntry.resumePastPaper', '继续真题练习')
      : resumableWorkspace?.kind === 'mock_exam'
        ? t('agent.learningEntry.resumeMock', '继续在线模考')
        : t('agent.learningEntry.resumePractice', '继续上次做题');
  const resumableHeading = resumableWorkspace?.kind === 'teaching'
    ? t('agent.context.resumeTeachingHeading', '继续未完成的知识讲解')
    : resumableWorkspace?.kind === 'past_paper'
      ? t('agent.context.resumePastPaperHeading', '继续未完成的真题练习')
      : resumableWorkspace?.kind === 'mock_exam'
        ? t('agent.context.resumeMockHeading', '继续未完成的在线模考')
        : t('agent.context.resumePracticeHeading', '继续上次做到的题目');
  const resumableBody = resumableWorkspace?.kind === 'teaching'
    ? t('agent.learningEntry.resumeTeachingBody', '返回上次讲解进度；完成或退出后再继续做题。')
    : resumableWorkspace?.kind === 'past_paper'
      ? t('agent.learningEntry.resumePastPaperBody', '保留真题卷、题号和已提交的作答记录。')
      : resumableWorkspace?.kind === 'mock_exam'
        ? t('agent.learningEntry.resumeMockBody', '保留试卷位置和已完成的答题记录。')
        : t('agent.learningEntry.resumePracticeBody', '保留原科目、题目位置和作答状态。');
  const workspaceArtifactId = learningWorkspace?.artifactId ?? mockExamWorkspace?.artifactId;
  const workspaceArtifact = workspaceArtifactId
    ? (journeyState?.plans ?? []).find((item) => item.id === workspaceArtifactId) ?? null
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
  const learningToolScope = learningWorkspace?.phase === 'practice'
    ? `round.${learningWorkspace.roundId}.question.${practiceQuestionContext?.questionId ?? 'current'}`
    : mockExamWorkspace?.phase === 'taking'
      ? `mock.${mockExamWorkspace.attemptId}`
      : 'inactive';
  const learningToolPolicy = mockExamWorkspace?.phase === 'taking'
    ? {
        calculator: { enabled: false, reason: t('agent.tools.mockCalculatorRestricted', '在线模考按正式考试环境执行，当前不开放计算器。') },
        scratchpad: { enabled: true },
        converter: { enabled: false, reason: t('agent.tools.mockReferenceRestricted', '在线模考按正式考试环境执行，当前只开放草稿纸。') },
        reference: { enabled: false, reason: t('agent.tools.mockReferenceRestricted', '在线模考按正式考试环境执行，当前只开放草稿纸。') },
        graph: { enabled: false, reason: t('agent.tools.mockReferenceRestricted', '在线模考按正式考试环境执行，当前只开放草稿纸。') }
      }
    : {
        calculator: { enabled: true },
        scratchpad: { enabled: true },
        converter: { enabled: true },
        reference: { enabled: true },
        graph: { enabled: true }
      };
  const recommendationUnavailable = Boolean(latestTask) && !startablePlanArtifact && !resumableWorkspace;

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
  const currentPracticeAssistanceEvents = isPracticeQa && practiceQuestionContext
    ? practiceAssistanceEvents.filter((item) => item.roundId === practiceQuestionContext.roundId && item.questionId === practiceQuestionContext.questionId)
    : [];
  const firstGroundedPracticeAnswer = isPracticeQa
    ? practiceQaMessages.find((message) => message.role === 'assistant' && message.content.subjectQa?.decision === 'answer')
    : null;
  const visibleTimeline: AgentQaTimelineEntry[] = [
    ...visibleMessages.map((message) => ({
      kind: 'message' as const,
      key: `message:${message.id}`,
      createdAt: message.createdAt,
      order: message.role === 'user' ? 0 : 1,
      message
    })),
    ...currentPracticeAssistanceEvents.map((item) => ({
      kind: 'assistance' as const,
      key: `assistance:${item.id}`,
      createdAt: item.createdAt,
      order: 2,
      item
    })),
    ...(visiblePracticeTeachingEvent && firstGroundedPracticeAnswer ? [{
      kind: 'teaching' as const,
      key: `teaching:${visiblePracticeTeachingEvent.roundId}:${visiblePracticeTeachingEvent.questionId}`,
      createdAt: firstGroundedPracticeAnswer.createdAt,
      order: 2,
      item: visiblePracticeTeachingEvent
    }] : [])
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.order - right.order || left.key.localeCompare(right.key));

  async function startOrResumeLearning() {
    if (isStartingLearning || isStartingFreePractice) return;
    setLearningEntryError('');
    if (resumableWorkspace) {
      const workspace = resumableWorkspace;
      setIsStartingLearning(true);
      restoreJourneyWorkspace(workspace);
      if (workspace.kind === 'teaching') {
        try {
          const delivery = await getAgentInterventionDelivery(workspace.deliveryId);
          if (!isDisplayableIntervention(delivery)) {
            setIntervention(null);
            setTeachingDeliveryId(null);
            syncTeachingWorkspaceUrl(null);
            setLearningEntryError(t('agent.learningEntry.staleTeaching', '上次讲解已经结束，已返回当前可开始的学习任务。'));
            await loadJourneyState().catch(() => undefined);
            return;
          }
          setIntervention(delivery);
        } catch (resumeError) {
          if (isUnavailableTeachingWorkspace(resumeError)) {
            setTeachingDeliveryId(null);
            syncTeachingWorkspaceUrl(null);
            setLearningEntryError(t('agent.learningEntry.staleTeaching', '上次讲解内容已失效，已返回当前可开始的学习任务。'));
            await loadJourneyState().catch(() => undefined);
          } else {
            setLearningEntryError(formatAgentUserError(resumeError, locale, t('agent.learningEntry.resumeFailed', '暂时无法恢复上次学习，请重试。')));
          }
        } finally {
          setIsStartingLearning(false);
        }
        return;
      }
      window.setTimeout(() => setIsStartingLearning(false), 250);
      return;
    }
    if (effectiveLearningMode === 'free') {
      await beginFreePractice();
      return;
    }
    if (!startablePlanArtifact) {
      setSessionLearningModeOverride('free');
      setFreePracticeSubject(defaultFreePracticeSubject);
      setFreePracticeCount(defaultFreePracticeCount);
      return;
    }
    setIsStartingLearning(true);
    try {
      const task = startablePlanArtifact.snapshot.task && typeof startablePlanArtifact.snapshot.task === 'object'
        ? startablePlanArtifact.snapshot.task as Record<string, unknown>
        : {};
      const start = task.type === 'mock_exam' ? startAgentMockExam : startAgentPractice;
      const launch = await start(startablePlanArtifact.id, {
        clientRequestId: clientRequestId(),
        questionLanguage
      });
      openTaskWorkspace(launch);
      await loadJourneyState().catch(() => undefined);
    } catch (nextError) {
      setLearningEntryError(formatAgentUserError(nextError, locale, t('agent.learningEntry.startFailed', '暂时无法开始学习，请重试。')));
    } finally {
      setIsStartingLearning(false);
    }
  }

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
    journeySection === 'today' && (
      standaloneTeachingWorkspace
      || learningWorkspace?.phase === 'practice'
      || mockExamWorkspace?.phase === 'taking'
    )
  );
  const hasAuxiliaryTask = journeySection === 'today'
    && (learningWorkspace?.phase === 'practice' || mockExamWorkspace?.phase === 'taking');
  const isLearningSupportVisible = practiceHelpOpen || Boolean(
    learningWorkspace?.phase === 'practice'
      ? visiblePracticeTeachingEvent
      : intervention || interventionVerification || teachingDeliveryId
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
          isSubjectQa ? 'is-subject-qa' : '',
          isPracticeQa || isPracticeTools ? 'is-practice-help-open' : '',
          hasAuxiliaryTask && !isLearningSupportVisible ? 'is-practice-help-closed' : '',
          hasTaskWorkspace && taskRailPosition === 'center' ? 'is-task-first' : '',
          isJourneyOverview || (!isSubjectQa && !hasTaskWorkspace && !learningWorkspace && !mockExamWorkspace && !intervention && !interventionVerification && !currentWorkspaceOutput && !error) ? 'is-single-workbench' : '',
          isTaskRailResizing ? 'is-resizing-task-rail' : ''
        ].filter(Boolean).join(' ')}
        style={hasTaskWorkspace ? { '--agent-task-rail-width': `${taskRailWidth}px` } as CSSProperties : undefined}
      >
        <aside className="agent-conversation-rail" aria-label={t('agent.journey.aria', '学习旅程导航')}>
          <div className="agent-rail-brand">
            <span><Icon name="lucide:bot" /></span>
            <div><strong>{t('agent.brand.title', '学习 Agent')}</strong><small>{t('agent.brand.subtitle', '目标驱动的 CSCA 训练')}</small></div>
          </div>
          <LanguageSelector compact className="agent-mobile-language" />
          <nav className="agent-journey-nav" aria-label={t('agent.journey.navAria', '学习旅程')}>
            <button type="button" className={journeySection === 'today' ? 'active' : ''} aria-label={t('agent.journey.today', '做题')} aria-current={journeySection === 'today' ? 'page' : undefined} onClick={() => chooseJourneySection('today')}>
              <Icon name="lucide:target" /><span><strong>{t('agent.journey.today', '做题')}</strong><small>{t('agent.journey.todayHint', '系统推荐或自由练习')}</small></span>
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
          <button type="button" className="agent-mobile-account" aria-label={t('agent.account.settings', '个人设置')} onClick={() => onNavigate(`${routes.me}?section=settings`)}>
            <UserAvatar user={currentUser} size="sm" />
          </button>
          <div className="agent-rail-footer">
            <div className="agent-rail-trust"><Icon name="lucide:shield-check" /><span>{t('agent.history.trust', '只读取你的学习数据；不会直接修改掌握度或自动出题。')}</span></div>
            <LanguageSelector className="agent-language-selector" />
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
              <span className="agent-kicker">{isSubjectQa
                ? t('agent.subjectQa.kicker', '独立学科问答')
                : isPracticeQa
                  ? t('agent.practiceQa.kicker', '当前题目')
                  : isPracticeTools
                    ? t('agent.tools.kicker', '当前任务辅助')
                  : t('agent.thread.kicker', 'Learning workspace')}</span>
              <h2>{isPracticeQa && practiceQuestionContext
                ? t('agent.practiceQa.heading', '本题问答 · 第 {number} 题').replace('{number}', String(practiceQuestionContext.questionNumber))
                : isPracticeTools
                  ? t('agent.tools.heading', '学习工具')
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
            <div className="agent-thread-header-actions">
              {(isPracticeQa || isPracticeTools) && <nav className="agent-auxiliary-tabs" aria-label={t('agent.auxiliary.tabs', '切换学习辅助')}>
                {learningWorkspace?.phase === 'practice' && <button type="button" className={isPracticeQa ? 'active' : ''} onClick={openPracticeHelp}><Icon name="lucide:messages-square" />{t('agent.practiceQa.introTitle', '本题问答')}</button>}
                <button type="button" className={isPracticeTools ? 'active' : ''} onClick={openPracticeTools}><Icon name="lucide:wrench" />{t('agent.tools.shortTitle', '学习工具')}</button>
              </nav>}
              {!(isPracticeQa || isPracticeTools) && <span className={(isSending || practiceQaSending) ? 'agent-live-status running' : 'agent-live-status'} role="status" aria-live="polite"><i />{practiceQaSending ? t('agent.practiceQa.answering', '正在回答') : isSending ? runStatus : isQaChatSurface ? t('agent.subjectQa.ready', '数理化问答边界已启用') : t('agent.status.ready', '学习数据已连接')}</span>}
              {(isPracticeQa || isPracticeTools) && <button type="button" className="agent-practice-help-close" onClick={() => setPracticeHelpOpen(false)} aria-label={isPracticeQa ? t('agent.practiceQa.close', '关闭本题问答，返回做题') : t('agent.auxiliary.close', '关闭学习辅助，返回做题')} title={isPracticeQa ? t('agent.practiceQa.close', '关闭本题问答，返回做题') : t('agent.auxiliary.close', '关闭学习辅助，返回做题')}><Icon name="lucide:x" /></button>}
            </div>
          </header>

          <div ref={threadScrollRef} className="agent-thread-scroll" onScroll={updateThreadFollowState}>
            {error && <div className="agent-inline-error" role="alert"><Icon name="lucide:circle-alert" /><span>{error}</span><div className="agent-inline-error-actions">{errorAction ? <button type="button" className="primary" onClick={() => runErrorAction(errorAction)}><Icon name="lucide:refresh-cw" />{errorAction.label}</button> : null}<button type="button" onClick={clearErrorNotice}>{t('agent.error.dismiss', '关闭')}</button></div></div>}
            {isPracticeTools ? (
              <AgentLearningTools storageScope={learningToolScope} policy={learningToolPolicy} subject={learningWorkspace?.subject ?? mockExamWorkspace?.subject ?? workspaceSubject} />
            ) : isSubjectQa && isLoading ? (
              <div className="agent-loading-card"><Icon name="lucide:loader-circle" />{t('agent.loadingConversation', '正在加载学习对话')}</div>
            ) : isSubjectQa && !visibleMessages.length ? (
              <SubjectQaEmptyState />
            ) : (
              <div ref={messageListRef} className={`agent-message-list${isQaChatSurface ? ' is-subject-qa' : ' is-learning-support'}`} role="log" aria-live="polite" aria-relevant="additions" aria-label={isQaChatSurface ? t('agent.subjectQa.conversation', '学科问答对话') : t('agent.support.aria', '当前学习辅助')}>
                {!isSubjectQa && !isPracticeQa && <section className="agent-learning-support-intro">
                  <span><Icon name="lucide:focus" /></span>
                  <div><strong>{t('agent.support.title', '当前学习辅助')}</strong><small>{t('agent.support.body', '这里只保留与当前题目直接相关的提示、讲解和验证。完整记录可在学习历程中查看。')}</small></div>
                </section>}
                {isPracticeQa && practiceQuestionContext?.isCorrect === false && (
                  <div className="agent-message-block assistant agent-practice-question-invite-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:message-circle-question" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <section className="agent-practice-question-invite" aria-label={t('agent.practiceQa.inviteAria', '当前题提问引导')}>
                        <header><span>{t('agent.practiceQa.inviteKicker', '这道题没有答对')}</span><strong>{t('agent.practiceQa.inviteTitle', '哪里没想通，可以继续问我')}</strong></header>
                        <p>{t('agent.practiceQa.inviteBody', '我会只结合当前题回答，不会引用其他题目的记录。')}</p>
                        <div>
                          {practiceQuestionContext.selectedAnswer && <button type="button" onClick={() => preparePracticeQaQuestion(t('agent.practiceQa.whySelectedWrong', '为什么我选的 {answer} 错了？').replace('{answer}', practiceQuestionContext.selectedAnswer || ''))}>{t('agent.practiceQa.whyWrong', '为什么我的答案错了？')}</button>}
                          <button type="button" onClick={() => preparePracticeQaQuestion(t('agent.practiceQa.howToSolve', '这道题应该怎么判断？'))}>{t('agent.practiceQa.askApproach', '这题怎么判断？')}</button>
                          <button type="button" onClick={() => preparePracticeQaQuestion(t('agent.practiceQa.explainConcept', '讲讲这道题涉及的知识点。'))}>{t('agent.practiceQa.askConcept', '讲讲相关知识点')}</button>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
                {visibleTimeline.map((entry) => {
                  if (entry.kind === 'assistance') {
                    const item = entry.item;
                    const title = item.action === 'recall_concept'
                      ? t('agent.practiceAssistance.concept', '知识点回忆')
                      : item.action === 'next_step_hint'
                        ? t('agent.practiceAssistance.hint', '渐进提示')
                        : t('agent.practiceAssistance.handwriting', '手写过程检查');
                    return (
                      <div key={entry.key} className={`agent-message-block assistant agent-practice-assistance-message ${item.status === 'failed' ? 'is-error' : ''}`}>
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
                  }
                  if (entry.kind === 'teaching') {
                    const item = entry.item;
                    return (
                      <div key={entry.key} className="agent-message-block assistant agent-chat-teaching-message agent-practice-teaching-resource">
                        <div className="agent-message-avatar"><span><Icon name="lucide:book-open-check" /></span></div>
                        <div className="agent-message-content">
                          <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                          <section className="agent-chat-teaching-panel agent-intervention-teaching-wrap" aria-label={t('agent.practiceTeaching.aria', '当前题知识讲解')}>
                            <header className="agent-chat-teaching-header">
                              <div><span>{t('agent.practiceTeaching.kicker', '当前题辅助')}</span><strong>{t('agent.practiceTeaching.title', '当前题知识讲解')}</strong><small>{t('agent.practiceTeaching.hint', '第 {number} 题答错后匹配的已审核交互微课').replace('{number}', String(item.questionNumber))}</small></div>
                              <button type="button" className="agent-chat-teaching-toggle" onClick={() => setPracticeTeachingCollapsed((current) => !current)} aria-expanded={!practiceTeachingCollapsed}>
                                <Icon name={practiceTeachingCollapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'} />
                                <span>{practiceTeachingCollapsed ? t('agent.practiceTeaching.expand', '展开讲解') : t('agent.practiceTeaching.collapse', '收起讲解')}</span>
                              </button>
                            </header>
                            {!practiceTeachingCollapsed && <TeachingAssetRenderer asset={item.asset} roundId={item.roundId} questionId={item.questionId} />}
                          </section>
                        </div>
                      </div>
                    );
                  }
                  const message = entry.message;
                  return (
                    <div key={entry.key} className={`agent-message-block ${message.role}${isQaChatSurface ? '' : ' agent-current-workspace-output'}`}>
                      <div className="agent-message-avatar">
                        {message.role === 'user' ? <UserAvatar user={currentUser} size="sm" /> : <span><Icon name="lucide:sparkles" /></span>}
                      </div>
                      <div className="agent-message-content">
                        <span className="agent-message-author">{message.role === 'user' ? (currentUser.displayName || t('agent.message.you', '你')) : t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                        {isQaChatSurface && message.role === 'assistant' && <small className="agent-subject-qa-disclosure"><Icon name={message.content.subjectQa?.decision === 'unavailable' || message.content.subjectQa?.decision === 'out_of_scope' ? 'lucide:circle-alert' : 'lucide:shield-check'} />{message.content.subjectQa?.decision === 'unavailable' ? t('agent.subjectQa.unavailable', '学科问答暂时不可用') : message.content.subjectQa?.decision === 'out_of_scope' ? t('agent.subjectQa.outOfScope', '已按学科边界处理') : message.content.subjectQa?.generatedByAI === false ? t('agent.subjectQa.reviewedAnswer', '模型不可用，已使用当前题审核解析') : isPracticeQa ? t('agent.subjectQa.aiGroundedAnswer', 'AI 讲解 · 基于当前题已审核解析') : t('agent.subjectQa.noMastery', '自由问答，不改变掌握度')}</small>}
                        <p>{isQaChatSurface ? <MathContent text={message.content.text} /> : message.content.text}</p>
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
                          <PastPaperResourceCards items={message.content.pastPaperResources} onOpen={(item) => openPastPaperWorkspace(item.slug)} />
                        )}
                        {!!message.content.pastPaperCitations?.length && (
                          <div className="agent-past-paper-citations" aria-label={t('agent.pastPaper.citations', '真题引用')}>
                            {message.content.pastPaperCitations.map((citation) => (
                              <button key={`${citation.paperSlug}-${citation.sourceQuestionId}`} type="button" onClick={() => openPastPaperWorkspace(citation.paperSlug, undefined, citation.sourceQuestionId)}>
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
                      </div>
                    </div>
                  );
                })}
                {isQaChatSurface && streamingAnswer
                  && ((isPracticeQa && streamingAnswer.conversationId === practiceQaConversation?.id)
                    || (isSubjectQa && streamingAnswer.conversationId === conversation?.id)) && (
                  <div className={`agent-message-block assistant is-streaming${streamingAnswer.text ? '' : ' is-thinking'}`}>
                    <div className="agent-message-avatar"><span><Icon name="lucide:sparkles" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <small className="agent-subject-qa-disclosure"><Icon name="lucide:radio" />{t('agent.subjectQa.streaming', 'AI 正在实时生成')}</small>
                      {streamingAnswer.text
                        ? <p><MathContent text={streamingAnswer.text} /></p>
                        : <p className="agent-streaming-wait"><i /><i /><i />{t('agent.practiceQa.answering', '正在回答')}</p>}
                    </div>
                  </div>
                )}
                {isPracticeQa && practiceAssistanceBusy && (
                  <div className="agent-message-block assistant is-thinking agent-practice-assistance-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:sparkles" /></span></div>
                    <div className="agent-message-content"><span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span><p><i /><i /><i />{practiceAssistanceBusy === 'check_work' ? t('agent.practiceAssistance.waitingUpload', '正在选择或检查手写图片') : t('agent.practiceAssistance.loading', '正在结合当前题准备帮助')}</p></div>
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
                        onStartTargeted={(selection) => void beginFreePractice(selection)}
                        onContinue={workspaceTaskType === 'free_practice' ? () => void continueFreePracticeBatch() : undefined}
                        onOpenPlan={() => chooseJourneySection('settings')}
                        onOpenWeakness={() => chooseJourneySection('weakness')}
                        onSettlementLoaded={(result) => {
                          setPracticeSettlement(result);
                          void loadJourneyState().catch(() => undefined);
                        }}
                        renderFollowUp={intervention ? (report) => isInterventionRelevantToReport(intervention, report) ? (
                          <InterventionCard
                            embedded
                            item={intervention}
                            onChanged={setIntervention}
                            onDismissed={() => { setIntervention(null); closeTeachingWorkspace(); }}
                            onCompleted={() => activeEvidenceContextId && void loadInterventionVerification(activeEvidenceContextId)}
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
                {!isSubjectQa && intervention && learningWorkspace?.phase !== 'practice' && learningWorkspace?.phase !== 'report' && (
                  <InterventionCard
                    item={intervention}
                    onChanged={setIntervention}
                    onDismissed={() => { setIntervention(null); closeTeachingWorkspace(); }}
                    onCompleted={() => activeEvidenceContextId && void loadInterventionVerification(activeEvidenceContextId)}
                    onOpenTeaching={openTeachingWorkspace}
                  />
                )}
                {!isSubjectQa && chatTeachingWorkspace && (
                  <div className="agent-message-block assistant agent-chat-teaching-message">
                    <div className="agent-message-avatar"><span><Icon name="lucide:graduation-cap" /></span></div>
                    <div className="agent-message-content">
                      <span className="agent-message-author">{t('agent.message.agent', 'CSCA 学习 Agent')}</span>
                      <section className="agent-chat-teaching-panel agent-intervention-teaching-wrap" aria-label={t('agent.intervention.chatWorkspaceAria', '当前学习知识讲解')}>
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
                            if (activeEvidenceContextId) await loadInterventionVerification(activeEvidenceContextId);
                          }}
                        />
                      </section>
                    </div>
                  </div>
                )}
                {!isSubjectQa && interventionVerification && activeEvidenceContextId && (
                  <InterventionVerificationCard
                    key={interventionVerification.id}
                    item={interventionVerification}
                    questionLanguage={questionLanguage}
                    onOpen={(item, path) => openVerificationWorkspace(item, path, activeEvidenceContextId)}
                  />
                )}
                <div className="agent-message-end" aria-hidden="true" />
              </div>
            )}
          </div>

          {!isThreadFollowingLatest && <button type="button" className="agent-jump-to-latest" onClick={() => scrollConversationToLatest(true)}><Icon name="lucide:arrow-down" />{t('agent.conversation.latest', '回到最新')}</button>}

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
          {isPracticeQa && <form className="agent-composer agent-subject-qa-composer agent-practice-qa-composer" onSubmit={(event) => { event.preventDefault(); void sendPracticeQaMessage(); }}>
            <label className="agent-composer-label" htmlFor="agent-practice-question">{t('agent.practiceQa.composerLabel', '围绕当前题提问')}</label>
            {practiceQuestionContext && (
              <section className="agent-practice-action-panel" aria-label={t('agent.practiceAssistance.context', '当前练习题上下文')}>
                <div><Icon name="lucide:focus" /><span><strong>{t('agent.practiceAssistance.currentQuestion', '当前第 {current}/{total} 题').replace('{current}', String(practiceQuestionContext.questionNumber)).replace('{total}', String(practiceQuestionContext.questionCount))}</strong><small>{practiceQuestionContext.topicTitle} · {t('agent.practiceAssistance.activityHint', '题内帮助只绑定当前题')}</small></span></div>
                <nav>
                  <button type="button" disabled={Boolean(practiceAssistanceBusy) || practiceQuestionContext.availableActions.find((item) => item.action === 'recall_concept')?.enabled !== true} onClick={() => requestPracticeAssistance('recall_concept')}><Icon name="lucide:book-open" />{t('agent.practiceAssistance.recall', '回忆知识点')}</button>
                  <button type="button" disabled={Boolean(practiceAssistanceBusy) || practiceQuestionContext.answered || practiceQuestionContext.availableActions.find((item) => item.action === 'next_step_hint')?.enabled !== true} onClick={() => requestPracticeAssistance('next_step_hint')}><Icon name="lucide:route" />{t('agent.practiceAssistance.nextHint', '下一步提示')}</button>
                  <button type="button" disabled={Boolean(practiceAssistanceBusy)} onClick={() => requestPracticeAssistance('check_work')}><Icon name="lucide:scan-line" />{t('agent.practiceAssistance.checkWork', '检查手写过程')}</button>
                </nav>
              </section>
            )}
            <div className="agent-composer-box">
              <textarea
                ref={practiceQaInputRef}
                id="agent-practice-question"
                value={practiceQaDraft}
                rows={1}
                maxLength={8000}
                placeholder={t('agent.practiceQa.placeholder', '例如：这道题应该先判断哪个物理量？')}
                disabled={practiceQaSending}
                onChange={(event) => setPracticeQaDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendPracticeQaMessage();
                  }
                }}
              />
              <div className="agent-composer-toolbar">
                <div className="agent-composer-tools">
                  <span className="agent-mode-chip"><Icon name="lucide:link" />{t('agent.practiceQa.bound', '已绑定当前题')}</span>
                </div>
                <button type="submit" className="agent-send-button" disabled={!practiceQaDraft.trim() || practiceQaSending} aria-label={t('agent.composer.send', '发送')}>
                  <Icon name={practiceQaSending ? 'lucide:loader-circle' : 'lucide:arrow-up'} />
                </button>
              </div>
            </div>
            {practiceQaError ? <small className="agent-practice-qa-error" role="alert">{practiceQaError}</small> : <small>{t('agent.practiceQa.helper', '打开面板不会创建会话；只有发送文字后才保存到学科问答。')}</small>}
          </form>}
        </main>

        {journeySection === 'qa' ? null : journeySection === 'today' && standaloneTeachingWorkspace ? (
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
                  if (activeEvidenceContextId) await loadInterventionVerification(activeEvidenceContextId);
                }}
              />
            </div>
          </aside>
        ) : journeySection === 'today' && learningWorkspace?.phase === 'practice' ? (
          <aside className="agent-task-rail" aria-label={t('agent.workspace.aria', 'Agent 学习任务工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div>
                <span className="agent-kicker">{t('agent.workspace.kicker', '当前学习任务')}</span>
                <strong>{workspaceHeading}</strong>
                {workspaceArtifact?.summary ? <small>{workspaceArtifact.summary}</small> : null}
              </div>
              <div className="agent-task-rail-actions">
                <button type="button" className="agent-task-tools-button" onClick={openPracticeTools} aria-label={t('agent.tools.open', '打开学习工具')} title={t('agent.tools.open', '打开学习工具')}><Icon name="lucide:wrench" /><span>{t('agent.tools.shortTitle', '学习工具')}</span></button>
              </div>
            </div>
            <div className="agent-task-rail-body">
              <AdaptiveRoundView
                roundId={String(learningWorkspace.roundId)}
                onNavigate={(path) => void handleLearningWorkspaceNavigation(path)}
                onRoundUnavailable={() => {
                  setLearningWorkspace(null);
                  setPracticeQuestionContext(null);
                  syncWorkspaceUrl(null);
                  showError(t('agent.workspace.unavailable', '之前的学习任务已经失效，已返回学习工作台。你可以重新开始自由练习或获取新的推荐。'));
                  void loadJourneyState().catch(() => null);
                }}
                agentContextId={learningWorkspace.contextId}
                agentAssistanceCommand={practiceAssistanceCommand}
                onAgentQuestionContext={setPracticeQuestionContext}
                onAgentAssistance={receivePracticeAssistance}
                onAgentAssistanceSettled={settlePracticeAssistance}
                onOpenAgentHelp={openPracticeHelp}
                onAgentTeachingAsset={receivePracticeTeachingAsset}
              />
            </div>
          </aside>
        ) : journeySection === 'today' && mockExamWorkspace?.phase === 'taking' ? (
          <aside className="agent-task-rail agent-mock-task-rail" aria-label={t('agent.mockExam.workspaceAria', 'Agent 在线模考工作区')}>
            {taskRailPosition === 'right' ? taskRailResizeHandle : null}
            <div className="agent-task-rail-header">
              <div>
                <span className="agent-kicker">{t('agent.mockExam.kicker', '专注考试模式')}</span>
                <strong>{workspaceHeading}</strong>
                {workspaceArtifact?.summary ? <small>{workspaceArtifact.summary}</small> : null}
              </div>
              <div className="agent-task-rail-actions">
                <button type="button" className="agent-task-tools-button" onClick={openPracticeTools} aria-label={t('agent.tools.open', '打开学习工具')} title={t('agent.tools.open', '打开学习工具')}><Icon name="lucide:wrench" /><span>{t('agent.tools.shortTitle', '学习工具')}</span></button>
                <button type="button" onClick={toggleTaskRailPosition} aria-label={taskRailPosition === 'right' ? t('agent.workspace.moveTaskCenter', '将任务移到中间') : t('agent.workspace.moveChatCenter', '将工作台移到中间')} title={t('agent.workspace.swap', '交换工作台与任务位置')}><Icon name="lucide:arrow-left-right" /></button>
                <button type="button" onClick={() => void handleMockExamWorkspaceNavigation(routes.cscaMockExam)} aria-label={t('agent.workspace.close', '关闭任务面板')}><Icon name="lucide:x" /></button>
              </div>
            </div>
            <div className="agent-task-rail-body is-mock-exam">
              <MockExamTakingView attemptId={String(mockExamWorkspace.attemptId)} onNavigate={(path) => void handleMockExamWorkspaceNavigation(path)} />
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
                {adaptiveReport.learningDecision ? <div className="agent-report-rail-decision"><small>掌握判断 · 规则计算</small><strong>{adaptiveReport.learningDecision.headline}</strong><span>{adaptiveReport.learningDecision.adaptationPending ? '最新证据正在同步，建议已优先采用本轮作答。' : '知识状态已同步，AI 不直接修改掌握度。'}</span></div> : null}
                {practiceSettlement?.verificationResult ? <div className="agent-report-rail-decision" data-verdict={practiceSettlement.verificationResult.verdict}><small>独立验证</small><strong>{practiceSettlement.verificationResult.verdict === 'repaired' ? '已修复' : practiceSettlement.verificationResult.verdict === 'insufficient_evidence' ? '证据不足' : practiceSettlement.verificationResult.currentRoundPassed ? '本轮通过，待间隔验证' : '仍需巩固'}</strong><span>{practiceSettlement.verificationResult.consecutivePassCount}/{practiceSettlement.verificationResult.requiredPassCount} 次连续通过 · 目标题 {practiceSettlement.targetCorrectCount}/{practiceSettlement.targetTotal}</span></div> : null}
              </> : <div className="agent-report-rail-loading"><Icon name="lucide:loader-circle" />{t('agent.report.loading', '正在整理本轮学习结果')}</div>}
            </section>

            {workspaceTaskType === 'free_practice' ? <section className="agent-report-rail-next">
              <header><small>{t('agent.reportRail.next', '下一步')}</small><strong>{adaptiveReport?.learningDecision?.nextStep.label ?? t('agent.freePractice.nextBatch', '继续下一批')}</strong></header>
              <p>{adaptiveReport?.learningDecision?.nextStep.reason ?? t('agent.freePractice.nextBatchRailHint', '默认沿用本批科目和题量，也可以只调整下一批。')}</p>
              <div className="agent-report-rail-config"><span>{subjectLabel(currentFreePracticeConfig().subject, t)}</span><span>{currentFreePracticeConfig().questionCount} {t('agent.freePractice.questions', '题')}</span></div>
              <button type="button" className="primary" disabled={freePracticeContinuationBusy !== null || adaptiveReport?.learningDecision?.nextStep.type === 'delayed_verification'} onClick={followAdaptiveDecision}><Icon name={freePracticeContinuationBusy === 'continue' ? 'lucide:loader-circle' : adaptiveReport?.learningDecision?.nextStep.type === 'delayed_verification' ? 'lucide:calendar-clock' : 'lucide:play'} />{adaptiveReport?.learningDecision?.nextStep.type === 'review_mistakes' ? '开始针对练习' : adaptiveReport?.learningDecision?.nextStep.label ?? t('agent.freePractice.continueSame', '继续下一批')}</button>
              {(adaptiveReport?.learningDecision?.nextStep.type === 'review_mistakes' || adaptiveReport?.learningDecision?.nextStep.type === 'targeted_practice') ? <button type="button" disabled={freePracticeContinuationBusy !== null} onClick={() => void continueFreePracticeBatch()}><Icon name="lucide:arrow-right" />{t('agent.freePractice.continueSame', '继续下一批')}</button> : null}
              <button type="button" disabled={freePracticeContinuationBusy !== null} onClick={toggleFreePracticeAdjustment}><Icon name="lucide:sliders-horizontal" />{isAdjustingFreePractice ? t('agent.freePractice.finishAdjust', '收起调整') : t('agent.freePractice.adjust', '调整下一批')}</button>
              <button type="button" onClick={() => chooseJourneySection('settings')}><Icon name="lucide:calendar-range" />查看学习计划</button>
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
        ) : <aside className={journeySection === 'today' ? `agent-context-rail${effectiveLearningMode === 'free' ? ' is-free-practice' : ''}` : 'agent-context-rail is-journey-view'} aria-label={journeySection === 'weakness' ? t('agent.journey.weakness', '错题与薄弱点') : journeySection === 'resources' ? t('agent.journey.resources', '学习资料') : t('agent.context.aria', '当前学习上下文')}>
          {journeySection === 'settings' ? <>
            <section className="agent-context-intro">
              <span className="agent-kicker">{t('agent.settings.kicker', 'Agent 使用的信息')}</span>
              <h2>{t('agent.settings.title', '设置 Agent 如何安排学习')}</h2>
              <p>{t('agent.settings.hint', '管理学习计划、目标进度、长期学习方式、考试目标和时间安排；不会改变正在进行的练习。')}</p>
            </section>
            <AgentLearningSettingsView
              defaultLearningMode={learningMode}
              defaultFreePracticeSubject={defaultFreePracticeSubject}
              defaultFreePracticeCount={defaultFreePracticeCount}
              onDefaultLearningModeChange={updateDefaultLearningMode}
              onDefaultFreePracticeSubjectChange={updateDefaultFreePracticeSubject}
              onDefaultFreePracticeCountChange={updateDefaultFreePracticeCount}
              journeyOverview={journeyOverview}
              journeyOverviewLoading={isJourneyOverviewLoading}
              journeyOverviewError={journeyOverviewError}
              onJourneyOverviewRetry={() => setJourneyOverviewRevision((current) => current + 1)}
              plans={journeyState?.plans ?? []}
              startablePlanId={startablePlanArtifact?.id ?? null}
              planBusy={isStartingLearning || isStartingFreePractice || isSending}
              onStartPlan={() => void startOrResumeLearning()}
              onStartDecision={(prescriptionId) => void startRecommendedDecision(prescriptionId)}
              onStartDefaultFreePractice={() => void beginFreePractice({ subject: defaultFreePracticeSubject, questionCount: defaultFreePracticeCount })}
              onDecisionVisible={(prescriptionId) => {
                void recordAgentPrescriptionExposure(prescriptionId, {
                  clientRequestId: `agent-plan-shown:${prescriptionId}`,
                  surface: 'agent_learning_plan'
                }).catch(() => undefined);
              }}
              onGeneratePlan={() => chooseJourneySection('today')}
              onOpenWeakness={() => chooseJourneySection('weakness')}
              onGoPractice={() => chooseJourneySection('today')}
            />
          </> : journeySection === 'weakness' ? (
            <AgentWeaknessWorkspace
              overview={journeyOverview}
              loading={isJourneyOverviewLoading}
              error={journeyOverviewError}
              onRetry={() => setJourneyOverviewRevision((current) => current + 1)}
              onGoPractice={() => chooseJourneySection('today')}
              onStartPractice={beginFreePractice}
            />
          ) : journeySection === 'resources' ? (
            pastPaperWorkspace ? <section className="agent-resource-detail" aria-label={t('agent.pastPaper.workspaceAria', '真题资料详情')}>
              <header className="agent-resource-detail-header">
                <div><span className="agent-kicker">{t('agent.pastPaper.kicker', '真题资料')}</span><strong>{t('agent.pastPaper.workspaceTitle', '阅读、定位与提问')}</strong></div>
                <button type="button" onClick={() => closePastPaperWorkspace(pastPaperWorkspace.contextId)}><Icon name="lucide:arrow-left" />{t('agent.pastPaper.backToResources', '返回学习资料')}</button>
              </header>
              <AgentPastPaperWorkspace
                slug={pastPaperWorkspace.slug}
                conversationId={pastPaperWorkspace.contextId}
                initialQuestionId={pastPaperWorkspace.questionId}
                onContextReady={handlePastPaperContextReady}
                onAsk={(prompt, context) => closePastPaperWorkspace(pastPaperWorkspace.contextId, prompt, context)}
                onContinueLearning={() => {
                  closePastPaperWorkspace();
                  chooseJourneySection('today');
                }}
              />
            </section> : <AgentJourneyResourcesView overview={journeyOverview} loading={isJourneyOverviewLoading} error={journeyOverviewError} onRetry={() => setJourneyOverviewRevision((current) => current + 1)} onOpen={(item) => {
              openPastPaperWorkspace(item.slug);
            }} />
          ) : <>
          {effectiveLearningMode === 'free' ? <>
            <section className="agent-context-intro agent-workbench-heading">
              <div><span className="agent-kicker">{t('agent.freePractice.kicker', '学生主动学习')}</span>
              <h2>{t('agent.freePractice.title', '你决定现在练什么、练多少')}</h2>
              <p>{t('agent.freePractice.body', '每次只取一个小批次，做完可以继续，也可以随时结束；作答仍进入同一学习证据。')}</p></div>
              <span className={isSending ? 'agent-live-status running agent-workbench-status' : 'agent-live-status agent-workbench-status'} role="status" aria-live="polite"><i />{isSending ? runStatus : t('agent.status.ready', '学习数据已连接')}</span>
              {sessionLearningModeOverride === 'free' && learningMode === 'recommended' ? (
                <button type="button" className="agent-session-mode-reset" onClick={() => setSessionLearningModeOverride(null)}>
                  <Icon name="lucide:undo-2" />{t('agent.freePractice.backToRecommendation', '返回系统推荐')}
                </button>
              ) : null}
            </section>
            <section className="agent-free-practice-card">
              <fieldset>
                <legend id="agent-free-practice-subject-label">{t('agent.freePractice.subject', '选择科目')}</legend>
                <div role="radiogroup" aria-labelledby="agent-free-practice-subject-label">{(['math', 'physics', 'chemistry'] as const).map((subject) => <button key={subject} type="button" role="radio" className={freePracticeSubject === subject ? 'active' : ''} aria-checked={freePracticeSubject === subject} onClick={() => setFreePracticeSubject(subject)}>{subjectLabel(subject, t)}</button>)}</div>
              </fieldset>
              <fieldset>
                <legend id="agent-free-practice-count-label">{t('agent.freePractice.batch', '本批题量')}</legend>
                <div role="radiogroup" aria-labelledby="agent-free-practice-count-label">{[3, 5, 10].map((count) => <button key={count} type="button" role="radio" className={freePracticeCount === count ? 'active' : ''} aria-checked={freePracticeCount === count} onClick={() => setFreePracticeCount(count)}>{count} {t('agent.freePractice.questions', '题')}</button>)}</div>
              </fieldset>
              <button type="button" className="agent-free-practice-start" disabled={isStartingFreePractice || isStartingLearning} onClick={() => void startOrResumeLearning()}>
                <Icon name={isStartingFreePractice || isStartingLearning ? 'lucide:loader-circle' : resumableWorkspace ? 'lucide:rotate-ccw' : 'lucide:play'} />{isStartingLearning && resumableWorkspace ? t('agent.learningEntry.resuming', '正在恢复') : isStartingFreePractice || isStartingLearning ? t('agent.freePractice.starting', '正在准备题目') : resumableWorkspace ? resumableActionLabel : t('agent.freePractice.start', '开始自由练习')}
              </button>
              <p><Icon name="lucide:shield-check" />{sessionLearningModeOverride === 'free' && learningMode === 'recommended'
                ? t('agent.freePractice.sessionOverride', '只调整本次学习，不会修改你在学习设置中的默认模式。')
                : t('agent.freePractice.evidence', '自由练习与系统推荐共用题源、辅助规则和学习证据。')}</p>
            </section>
          </> : <>
            <section className="agent-context-intro agent-workbench-heading">
              <div><span className="agent-kicker">{t('agent.context.today', '今日学习')}</span>
              <h2>{resumableWorkspace ? resumableHeading : t('agent.context.startHeading', '今天从这一项开始')}</h2>
              <p>{resumableWorkspace ? resumableBody : t('agent.context.body', '根据你的目标、真实作答和当前题源安排下一步。')}</p></div>
              <span className={isSending ? 'agent-live-status running agent-workbench-status' : 'agent-live-status agent-workbench-status'} role="status" aria-live="polite"><i />{isSending ? runStatus : t('agent.status.ready', '学习数据已连接')}</span>
            </section>
            {resumableWorkspace && <section className="agent-learning-entry-card agent-primary-learning-card" data-state="resume">
              <div><span><Icon name="lucide:rotate-ccw" /></span><div><small>{t('agent.learningEntry.interrupted', '上次学习尚未完成')}</small><strong>{resumableStage?.title || `${subjectLabel(resumableSubject, t)} · ${taskLabel(resumableTaskType, t)}`}</strong></div></div>
              {resumableStage?.metrics.allocatedQuestionCount ? <div className="agent-resume-progress"><span><b>{resumableStage.metrics.answeredQuestionCount}</b>/{resumableStage.metrics.allocatedQuestionCount} {t('agent.freePractice.questions', '题')}</span><i><em style={{ width: `${Math.min(100, Math.round((resumableStage.metrics.answeredQuestionCount / resumableStage.metrics.allocatedQuestionCount) * 100))}%` }} /></i></div> : null}
              <p>{resumableBody}</p>
              <button type="button" disabled={isStartingLearning || isStartingFreePractice} onClick={() => void startOrResumeLearning()}><Icon name={isStartingLearning ? 'lucide:loader-circle' : 'lucide:rotate-ccw'} />{isStartingLearning ? t('agent.learningEntry.resuming', '正在恢复') : resumableActionLabel}</button>
              {learningEntryError ? <small role="alert">{learningEntryError}</small> : null}
            </section>}
            <div className={`agent-workbench-support-grid${resumableWorkspace ? '' : ' is-primary'}`}>
            <section className="agent-context-card agent-recommendation-card">
              <header><Icon name="lucide:target" /><strong>{resumableWorkspace ? t('agent.context.afterResume', '完成后建议') : t('agent.context.currentTask', '当前推荐任务')}</strong></header>
              {latestTask ? <>
                <h3>{localizedTaskTitle(latestArtifact?.title, locale, t) || `${subjectLabel(latestTask.subject, t)} · ${taskLabel(latestTask.type, t)}`}</h3>
                {latestArtifact?.summary ? <p>{latestArtifact.summary}</p> : null}
                <div className="agent-task-meta"><span>{subjectLabel(latestTask.subject, t)} · {taskLabel(latestTask.type, t)}</span><span>{Number(latestSnapshot.estimatedMinutes ?? 0)} min · {t(`agent.confidence.${String(latestSnapshot.confidence ?? 'medium')}`, String(latestSnapshot.confidence ?? 'medium'))}</span></div>
                {!resumableWorkspace ? <button type="button" className="agent-primary-start" disabled={isStartingLearning || isStartingFreePractice} onClick={() => void startOrResumeLearning()}><Icon name={isStartingLearning || isStartingFreePractice ? 'lucide:loader-circle' : recommendationUnavailable ? 'lucide:shuffle' : 'lucide:play'} />{isStartingLearning || isStartingFreePractice ? t('agent.learningEntry.preparing', '正在准备') : recommendationUnavailable ? t('agent.plan.useFreePractice', '改做自由练习') : t('agent.learningEntry.start', '开始学习')}</button> : null}
                {!resumableWorkspace && learningEntryError ? <small role="alert">{learningEntryError}</small> : null}
              </> : <><p>{t('agent.context.waiting', '完成一次真实练习后，这里会根据作答证据更新下一步。')}</p><button type="button" className="agent-generate-plan" disabled={isStartingLearning || isStartingFreePractice} onClick={() => void startOrResumeLearning()}><Icon name={isStartingLearning || isStartingFreePractice ? 'lucide:loader-circle' : 'lucide:play'} />{isStartingLearning || isStartingFreePractice ? t('agent.learningEntry.preparing', '正在准备') : t('agent.journeyAction.goPractice', '去做题')}</button></>}
            </section>
            <section className="agent-context-card sources">
              <header><Icon name="lucide:database" /><strong>{t('agent.context.sources', '事实来源')}</strong></header>
              <ul><li><i />{t('agent.context.sourceGoal', '你的目标与考试日期')}</li><li><i />{t('agent.context.sourceEvidence', '练习、错题和模考证据')}</li><li><i />{t('agent.context.sourceSupply', '当前已发布合格题源')}</li></ul>
            </section>
            </div>
            <section className="agent-context-note"><Icon name="lucide:info" /><p>{t('agent.context.note', 'Agent 不直接改写掌握度。每次状态变化必须来自真实学习事件。')}</p></section>
          </>}
          </>}
        </aside>}
      </div>
    </div>
  );
}
