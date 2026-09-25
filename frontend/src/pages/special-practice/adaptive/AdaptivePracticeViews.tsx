import { useEffect, useRef, useState, type ReactNode } from 'react';
import '../../../styles/special-practice.css';
import { Icon } from '../../../components/Icon';
import { MathContent } from '../../../components/MathContent';
import { GhostButton } from '../../../components/UiPrimitives';
import {
  checkAdaptivePracticeAnswer,
  completeAdaptiveConceptCard,
  createAdaptivePracticeRound,
  createAdaptivePracticeSession,
  getAdaptiveAIExplanation,
  getAdaptiveAIEntitlement,
  getAdaptiveAIHint,
  getAdaptiveAIRoundSummary,
  getAdaptivePracticeMastery,
  getAdaptivePracticeOverview,
  getAdaptivePracticeRound,
  getAdaptivePracticeRoundReport,
  patchAdaptivePracticeRound,
  submitAdaptiveAIFeedback,
  type AdaptiveAIFeedbackReasonCode,
  submitAdaptivePracticeRound,
  type AdaptiveAIEntitlement,
  type AdaptiveAIInteraction,
  type AdaptiveMasteryTopic,
  type AdaptivePracticeCheckResult,
  type AdaptiveQuestion,
  type AdaptiveRoundDetail,
  type AdaptiveRoundReport,
  type AdaptiveTrainingOverview,
  type User
} from '../../../lib/api';
import { adaptivePracticePoolExhaustedCopy, isAdaptivePracticePoolExhaustedError } from '../../../lib/adaptive-practice-pool';
import { ApiError } from '../../../lib/request';
import { readMigratedLocalStorage, writeMigratedLocalStorage } from '../../../lib/storage-compat';
import {
  abandonAgentTask,
  actOnAgentIntervention,
  analyzeAgentAttachment,
  getAgentAttachmentAnalysis,
  getAgentTeachingAssetForQuestion,
  getAgentLearningAssistance,
  offerAgentIntervention,
  offerAgentInterventionVerification,
  recordAgentInterventionTeachingInteraction,
  reportAgentLearningContentIssue,
  requestAgentLearningAssistance,
  settleAgentInterventionVerification,
  settleAgentPractice,
  uploadAgentPracticeQuestionAttachment,
  type AgentTeachingAsset,
  type AgentInterventionDelivery,
  type LearningAssistanceAvailability
} from '../../../lib/api-agent';
import { routes } from '../../../lib/routes';
import { pickLocalized, type LocalizedMap } from '../../../i18n/locale-utils';
import { type Locale } from '../../../i18n/locales';
import { useI18n } from '../../../i18n/useI18n';
import { CSCA_PRACTICE_TOPIC_LABELS } from '../../../content/localized/csca-subjects';
import { FunctionShiftMicroLesson } from './FunctionShiftMicroLesson';

export type AgentPracticeQuestionContext = {
  roundId: number;
  questionId: number;
  questionSource?: 'special_practice' | 'csca_question';
  questionNumber: number;
  questionCount: number;
  subject: 'math' | 'physics' | 'chemistry';
  topicTitle: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  selectedAnswer?: string;
  answered: boolean;
  correctAnswer?: string;
  isCorrect?: boolean;
  explanation?: string;
  knowledgeTags?: string[];
  availableActions: LearningAssistanceAvailability['availableActions'];
};

export type AgentPracticeAssistanceEvent = {
  id: string;
  roundId: number;
  questionId: number;
  questionNumber: number;
  action: 'recall_concept' | 'next_step_hint' | 'check_work';
  content: string;
  createdAt: string;
  generatedByAI: boolean;
  status?: 'completed' | 'failed';
};

export type AgentPracticeTeachingEvent = {
  roundId: number;
  questionId: number;
  questionNumber: number;
  asset: AgentTeachingAsset;
};

export type AgentPracticeAssistanceCommand = {
  id: string;
  action: AgentPracticeAssistanceEvent['action'];
};

const SUBJECT_LABELS: LocalizedMap<Record<string, string>> = {
  'zh-CN': {
    math: '数学',
    physics: '物理',
    chemistry: '化学'
  },
  en: {
    math: 'Math',
    physics: 'Physics',
    chemistry: 'Chemistry'
  },
  vi: {
    math: 'Toán',
    physics: 'Vật lý',
    chemistry: 'Hóa học'
  }
};

const SUBJECT_ACCENTS: Record<string, { icon: string; color: string }> = {
  math: { icon: 'lucide:function-square', color: 'math' },
  physics: { icon: 'lucide:atom', color: 'physics' },
  chemistry: { icon: 'lucide:flask-conical', color: 'chemistry' }
};

const SHOW_AI_GENERATED_QUESTION_BADGE = import.meta.env.DEV
  ? import.meta.env.VITE_SHOW_AI_GENERATED_QUESTION_BADGE !== 'false'
  : import.meta.env.VITE_SHOW_AI_GENERATED_QUESTION_BADGE === 'true';

const ADAPTIVE_COPY = {
  tryMock: '体验完整模考',
  enterMock: '进入在线模考',
  subjectsUnit: '科',
  topicsUnit: '知识点',
  questionsUnit: '题',
  loading: '正在加载',
  loadFailed: '加载失败',
  backToPractice: '返回练习',
  checkFailed: '判题请求失败，未消耗 AI 额度，请重试。',
  exit: '退出',
  questionProgress: (current: number, total: number) => `第 ${current} / ${total} 题`,
  correctCount: (count: number) => `正确 ${count}`,
  wrongCount: (count: number) => `错误 ${count}`,
  currentQuestionTime: (time: string) => `本题 ${time}`,
  answeredProgress: (count: number, total: number) => `${count}/${total} 已答`,
  resume: '继续',
  pause: '暂停',
  questionNavigation: '题目导航',
  correct: '正确',
  wrongLabel: '错误',
  unansweredLabel: '未答',
  yourAnswer: '你的答案',
  answerCorrect: '答对了',
  answerIncorrect: (answer: string) => `答错了，正确答案是 ${answer}`,
  answerResultMeta: (accuracy: string, time: string) => `当前正确率 ${accuracy} / 本题用时 ${time}`,
  hideExplanation: '收起解析',
  viewExplanation: '查看解析',
  correctAnswer: (answer: string) => `正确答案 ${answer}`,
  selectedAnswer: (answer: string) => `你的答案 ${answer || '未选择'}`,
  previous: '上一题',
  next: '下一题',
  finishRound: '完成本轮',
  paused: '已暂停',
  pausedBody: '计时已暂停，点击继续后恢复答题。',
  review: '复盘',
  reviewTitle: (hasWrong: boolean) => (hasWrong ? '优先复盘错题' : '本轮重点回顾'),
  explanation: '解析',
  aiCreditsTitle: 'AI Coach 额度',
  aiCreditsBalance: '剩余额度',
  aiCreditsUsed: (used: number, granted: number) => `已用 ${used} / 累计 ${granted}`,
  aiCreditsFree: (count: number) => `新用户默认 ${count} 次免费额度；购买和管理员发放都会进入同一余额。`,
  aiCreditsLoading: '正在读取额度...',
  aiCreditsDisabled: 'AI Coach 暂未开放，训练和标准解析仍可使用。',
  aiCreditsLow: '额度偏低，建议先补充，避免 AI Coach 降级。',
  aiCreditsEmpty: '额度已用完，AI Coach 会降级为标准解析和本地规则提示。',
  buyAICredits: '购买 AI 额度',
  refreshCredits: '刷新额度',
  aiCreditPurchaseFailed: 'AI 额度购买暂未开放。',
  aiCreditFetchFailed: 'AI 额度暂时无法读取。',
  aiCreditFallback: '额度不足时仍可继续答题和查看标准解析；购买后可继续使用 AI Coach。',
  aiCreditQuotaError: 'AI Coach 额度不足，已保留标准解析；购买额度后可继续使用提示、错因分析和本轮总结。'
};

function adaptiveText(locale: string, zh: string, en: string, vi: string) {
  if (locale === 'vi') return vi;
  if (locale === 'en') return en;
  return zh;
}

type AdaptiveQuestionLanguage = 'zh' | 'en';

function defaultQuestionLanguage(locale: string): AdaptiveQuestionLanguage {
  return locale === 'zh-CN' ? 'zh' : 'en';
}

function normalizeQuestionLanguage(value: unknown, locale = 'zh-CN'): AdaptiveQuestionLanguage {
  const language = String(value ?? '').trim().toLowerCase();
  if (language === 'zh' || language.startsWith('zh-')) return 'zh';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return defaultQuestionLanguage(locale);
}

function adaptiveQuestionLanguageStorageKey(subject: string) {
  return `moodlelike:adaptive-question-language:${subject}`;
}

function legacyAdaptiveQuestionLanguageStorageKey(subject: string) {
  return `cscalite:adaptive-question-language:${subject}`;
}

function readStoredQuestionLanguage(subject: string, locale: string) {
  if (typeof window === 'undefined') return defaultQuestionLanguage(locale);
  return normalizeQuestionLanguage(readMigratedLocalStorage(adaptiveQuestionLanguageStorageKey(subject), legacyAdaptiveQuestionLanguageStorageKey(subject)), locale);
}

function writeStoredQuestionLanguage(subject: string, language: AdaptiveQuestionLanguage) {
  if (typeof window === 'undefined') return;
  writeMigratedLocalStorage(adaptiveQuestionLanguageStorageKey(subject), legacyAdaptiveQuestionLanguageStorageKey(subject), language);
}

function coachResponseLanguage(locale: string) {
  if (locale === 'vi') return 'vi';
  return locale === 'zh-CN' ? 'zh' : 'en';
}

function questionLanguageLabel(language: unknown, locale: string) {
  return normalizeQuestionLanguage(language, locale) === 'zh'
    ? adaptiveText(locale, '中文题', 'Chinese questions', 'Câu hỏi tiếng Trung')
    : 'English questions';
}

function adaptiveCopy(locale: string) {
  return {
    tryMock: adaptiveText(locale, ADAPTIVE_COPY.tryMock, 'Try full mock exam', 'Thử đề thi đầy đủ'),
    enterMock: adaptiveText(locale, ADAPTIVE_COPY.enterMock, 'Enter online mock exam', 'Vào thi thử trực tuyến'),
    subjectsUnit: adaptiveText(locale, ADAPTIVE_COPY.subjectsUnit, 'subjects', 'môn'),
    topicsUnit: adaptiveText(locale, ADAPTIVE_COPY.topicsUnit, 'topics', 'chủ đề'),
    questionsUnit: adaptiveText(locale, ADAPTIVE_COPY.questionsUnit, 'questions', 'câu'),
    exit: adaptiveText(locale, ADAPTIVE_COPY.exit, 'Exit', 'Thoát'),
    questionProgress: (current: number, total: number) => adaptiveText(locale, ADAPTIVE_COPY.questionProgress(current, total), `Question ${current} / ${total}`, `Câu ${current} / ${total}`),
    correctCount: (count: number) => adaptiveText(locale, ADAPTIVE_COPY.correctCount(count), `Correct ${count}`, `Đúng ${count}`),
    wrongCount: (count: number) => adaptiveText(locale, ADAPTIVE_COPY.wrongCount(count), `Wrong ${count}`, `Sai ${count}`),
    currentQuestionTime: (time: string) => adaptiveText(locale, ADAPTIVE_COPY.currentQuestionTime(time), `This question ${time}`, `Câu này ${time}`),
    answeredProgress: (count: number, total: number) => adaptiveText(locale, ADAPTIVE_COPY.answeredProgress(count, total), `${count}/${total} answered`, `${count}/${total} đã trả lời`),
    resume: adaptiveText(locale, ADAPTIVE_COPY.resume, 'Resume', 'Tiếp tục'),
    pause: adaptiveText(locale, ADAPTIVE_COPY.pause, 'Pause', 'Tạm dừng'),
    questionNavigation: adaptiveText(locale, ADAPTIVE_COPY.questionNavigation, 'Question navigation', 'Điều hướng câu hỏi'),
    correct: adaptiveText(locale, ADAPTIVE_COPY.correct, 'Correct', 'Đúng'),
    wrongLabel: adaptiveText(locale, ADAPTIVE_COPY.wrongLabel, 'Wrong', 'Sai'),
    unansweredLabel: adaptiveText(locale, ADAPTIVE_COPY.unansweredLabel, 'Unanswered', 'Chưa trả lời'),
    yourAnswer: adaptiveText(locale, ADAPTIVE_COPY.yourAnswer, 'Your answer', 'Đáp án của bạn'),
    answerCorrect: adaptiveText(locale, ADAPTIVE_COPY.answerCorrect, 'Correct', 'Đúng rồi'),
    answerIncorrect: (answer: string) => adaptiveText(locale, ADAPTIVE_COPY.answerIncorrect(answer), `Wrong, the correct answer is ${answer}`, `Sai rồi, đáp án đúng là ${answer}`),
    answerResultMeta: (accuracy: string, time: string) => adaptiveText(locale, ADAPTIVE_COPY.answerResultMeta(accuracy, time), `Current accuracy ${accuracy} / This question ${time}`, `Độ chính xác hiện tại ${accuracy} / Câu này ${time}`),
    hideExplanation: adaptiveText(locale, ADAPTIVE_COPY.hideExplanation, 'Hide explanation', 'Ẩn giải thích'),
    viewExplanation: adaptiveText(locale, ADAPTIVE_COPY.viewExplanation, 'View explanation', 'Xem giải thích'),
    correctAnswer: (answer: string) => adaptiveText(locale, ADAPTIVE_COPY.correctAnswer(answer), `Correct answer ${answer}`, `Đáp án đúng ${answer}`),
    selectedAnswer: (answer: string) => adaptiveText(locale, ADAPTIVE_COPY.selectedAnswer(answer), `Your answer ${answer || 'not selected'}`, `Đáp án của bạn ${answer || 'chưa chọn'}`),
    previous: adaptiveText(locale, ADAPTIVE_COPY.previous, 'Previous', 'Câu trước'),
    next: adaptiveText(locale, ADAPTIVE_COPY.next, 'Next', 'Câu sau'),
    finishRound: adaptiveText(locale, ADAPTIVE_COPY.finishRound, 'Finish round', 'Hoàn thành vòng này'),
    finishingRound: adaptiveText(locale, '提交中...', 'Submitting...', 'Đang nộp...'),
    paused: adaptiveText(locale, ADAPTIVE_COPY.paused, 'Paused', 'Đã tạm dừng'),
    pausedBody: adaptiveText(locale, ADAPTIVE_COPY.pausedBody, 'Timer is paused. Resume to continue answering.', 'Đồng hồ đã tạm dừng. Bấm tiếp tục để làm bài.'),
    review: adaptiveText(locale, ADAPTIVE_COPY.review, 'Review', 'Ôn lại'),
    reviewTitle: (hasWrong: boolean) => adaptiveText(locale, ADAPTIVE_COPY.reviewTitle(hasWrong), hasWrong ? 'Review wrong answers first' : 'Key review for this round', hasWrong ? 'Ưu tiên ôn câu sai' : 'Trọng tâm ôn lại vòng này'),
    explanation: adaptiveText(locale, ADAPTIVE_COPY.explanation, 'Explanation', 'Giải thích'),
    buyAICredits: adaptiveText(locale, ADAPTIVE_COPY.buyAICredits, 'Buy AI credits', 'Nạp lượt AI'),
    aiCreditFallback: adaptiveText(locale, ADAPTIVE_COPY.aiCreditFallback, 'You can still answer questions and view standard explanations when credits are low. Buy credits to keep using AI Coach.', 'Khi thiếu lượt, bạn vẫn có thể làm bài và xem giải thích tiêu chuẩn. Nạp lượt để tiếp tục dùng AI Coach.'),
    aiCreditQuotaError: adaptiveText(locale, ADAPTIVE_COPY.aiCreditQuotaError, 'AI Coach credits are insufficient. Standard explanations remain available; buy credits to keep using hints, mistake analysis, and round summaries.', 'Không đủ lượt AI Coach. Giải thích tiêu chuẩn vẫn được giữ lại; nạp lượt để tiếp tục dùng gợi ý, phân tích lỗi và tổng kết vòng.')
  };
}
const SETTLEMENT_AUTO_WINDOW_MS = 30 * 60 * 1000;

function isFreshSettlementReport(report: AdaptiveRoundReport) {
  const submittedAt = report.round.submittedAt ? Date.parse(report.round.submittedAt) : NaN;
  if (!Number.isFinite(submittedAt)) return false;
  const age = Date.now() - submittedAt;
  return age >= -60_000 && age <= SETTLEMENT_AUTO_WINDOW_MS;
}

function subjectPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}`;
}

function adaptiveRoundPath(subject: string, id: number) {
  return `${routes.cscaSubjects}/${subject}/practice/rounds/${id}`;
}

function adaptiveRoundReportPath(subject: string, id: number) {
  return `${routes.cscaSubjects}/${subject}/practice/rounds/${id}/report`;
}

function agentRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function waitFor(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function agentReturnQuery() {
  if (typeof window === 'undefined') return '';
  const current = new URLSearchParams(window.location.search);
  const conversationId = current.get('agentContextId') || current.get('agentConversationId');
  const artifactId = current.get('agentArtifactId');
  const verificationId = current.get('agentInterventionVerificationId');
  if (!conversationId || (!artifactId && !verificationId)) return '';
  const params = new URLSearchParams({ agentContextId: conversationId });
  if (artifactId) params.set('agentArtifactId', artifactId);
  if (verificationId) params.set('agentInterventionVerificationId', verificationId);
  return `?${params.toString()}`;
}

function subjectLabel(subject: string, locale: string) {
  const labels = pickLocalized(SUBJECT_LABELS, locale as Locale);
  return labels[subject] ?? subject;
}

function practiceTopicLabel(code: string, title: string, locale: string) {
  const labels = CSCA_PRACTICE_TOPIC_LABELS[locale as keyof typeof CSCA_PRACTICE_TOPIC_LABELS];
  return labels?.[code] ?? title;
}

function adaptiveTopicLabel(question: Pick<AdaptiveQuestion, 'topicCode' | 'topicTitle'>, locale: string) {
  return practiceTopicLabel(question.topicCode, question.topicTitle, locale);
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function accuracyLabel(correct: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((correct / total) * 100)}%`;
}

function friendlyPracticeError(error: unknown, fallback: string, locale = 'zh-CN') {
  const message = error instanceof Error ? error.message : '';
  if (!message || message === 'Failed to fetch') return fallback;
  if (message.includes('请先登录')) return adaptiveText(locale, '请先登录。', 'Please sign in first.', 'Vui lòng đăng nhập trước.');
  if (error instanceof ApiError) {
    if (error.status === 401) return adaptiveText(locale, '登录状态已失效，请重新登录。', 'Your session has expired. Please sign in again.', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    if (error.code === 'EMAIL_UNVERIFIED') return adaptiveText(locale, '请先完成邮箱验证。', 'Please verify your email first.', 'Vui lòng xác minh email trước.');
    if (error.status === 403) return adaptiveText(locale, '当前账号暂时不能执行这项操作。', 'This action is not available for the current account.', 'Tài khoản hiện tại chưa thể thực hiện thao tác này.');
    if (error.status === 404) return adaptiveText(locale, '这项练习内容已失效，请返回后重新选择。', 'This practice content is no longer available. Go back and choose again.', 'Nội dung luyện tập này không còn khả dụng. Hãy quay lại và chọn lại.');
    if (error.status === 409) return adaptiveText(locale, '练习状态已更新，请刷新后继续。', 'The practice state has changed. Refresh before continuing.', 'Trạng thái luyện tập đã thay đổi. Hãy tải lại trước khi tiếp tục.');
    if (error.status === 429) return adaptiveText(locale, '操作过于频繁，请稍后再试。', 'Too many requests. Please try again shortly.', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
    return fallback;
  }
  return message;
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /quota|额度|余额|insufficient|entitlement/i.test(message);
}

function adaptiveRoundMode(round: { plannerSnapshot: unknown }) {
  const snapshot = round.plannerSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'regular';
  const mode = (snapshot as { mode?: unknown }).mode;
  return mode === 'verification' || mode === 'intervention_verification' ? mode : 'regular';
}

function adaptiveRoundFocusTitle(round: { plannerSnapshot: unknown }, locale: string) {
  const snapshot = round.plannerSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return '';
  const focus = (snapshot as { focus?: unknown }).focus;
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) return '';
  const record = focus as { topicCode?: unknown; topicTitle?: unknown };
  return record.topicCode && record.topicTitle
    ? practiceTopicLabel(String(record.topicCode), String(record.topicTitle), locale)
    : String(record.topicTitle ?? '');
}

function adaptiveRoundFocusTopicId(round: { plannerSnapshot: unknown }) {
  const snapshot = round.plannerSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const focus = (snapshot as { focus?: unknown }).focus;
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) return null;
  const topicId = Number((focus as { topicId?: unknown }).topicId);
  return Number.isInteger(topicId) && topicId > 0 ? topicId : null;
}

function adaptiveRoundInterventionPhase(round: { plannerSnapshot: unknown }) {
  const snapshot = round.plannerSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'immediate';
  const focus = (snapshot as { focus?: unknown }).focus;
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) return 'immediate';
  const phase = (focus as { phase?: unknown }).phase;
  return phase === 'retention' || phase === 'transfer' ? phase : 'immediate';
}

function verificationTargetPassed(report: AdaptiveRoundReport) {
  if (adaptiveRoundMode(report.round) !== 'verification') return false;
  const focusTopicId = adaptiveRoundFocusTopicId(report.round);
  const targetItems = focusTopicId ? report.items.filter((item) => item.topicId === focusTopicId) : report.items;
  if (!targetItems.length) return false;
  const correct = targetItems.filter((item) => item.isCorrect).length;
  return correct / targetItems.length >= 0.8;
}

function pendingConceptCardIds(report: AdaptiveRoundReport | null, completed: Record<number, string>) {
  return (report?.remediationPlan?.conceptCards ?? [])
    .filter((card) => !(completed[card.id] ?? card.completedAt))
    .map((card) => card.id);
}

type CoachFeedbackState = {
  status: 'submitting' | 'awaiting_reason' | 'submitted' | 'error';
  rating?: number;
  reasonCode?: AdaptiveAIFeedbackReasonCode;
};

type CoachFeedbackKind = 'explanation' | 'summary';

type CoachFeedbackReasonOption = {
  code: AdaptiveAIFeedbackReasonCode;
  label: string;
};

function coachFeedbackSubmittedText(locale: Locale, reasonCode?: AdaptiveAIFeedbackReasonCode) {
  return reasonCode
    ? adaptiveText(locale, '已收到反馈，我们会优先检查这类 AI 解析。', 'Feedback received. We will prioritize reviewing this type of AI explanation.', 'Đã nhận phản hồi. Chúng tôi sẽ ưu tiên kiểm tra loại giải thích AI này.')
    : adaptiveText(locale, '已收到反馈，我们会用它检查和改进 AI 解析质量。', 'Feedback received. We use it to review and improve AI explanation quality.', 'Đã nhận phản hồi. Chúng tôi dùng phản hồi này để kiểm tra và cải thiện chất lượng giải thích AI.');
}

function coachFeedbackReasonTitle(locale: Locale) {
  return adaptiveText(locale, '哪里不对？', 'What was wrong?', 'Vấn đề là gì?');
}

function coachFeedbackReasons(locale: Locale, kind: CoachFeedbackKind): CoachFeedbackReasonOption[] {
  if (kind === 'summary') {
    return [
      { code: 'too_generic', label: adaptiveText(locale, '建议太泛', 'Too generic', 'Gợi ý quá chung') },
      { code: 'not_grounded_in_round', label: adaptiveText(locale, '没对应本轮错误', 'Not tied to this round', 'Chưa bám vào lỗi vòng này') },
      { code: 'wrong_language', label: adaptiveText(locale, '语言不对', 'Wrong language', 'Sai ngôn ngữ') },
      { code: 'next_step_unclear', label: adaptiveText(locale, '下一步不清楚', 'Next step unclear', 'Bước tiếp theo chưa rõ') }
    ];
  }
  return [
    { code: 'unclear', label: adaptiveText(locale, '没看懂', 'Unclear', 'Chưa rõ') },
    { code: 'too_verbose', label: adaptiveText(locale, '太啰嗦', 'Too verbose', 'Quá dài dòng') },
    { code: 'wrong_language', label: adaptiveText(locale, '语言不对', 'Wrong language', 'Sai ngôn ngữ') },
    { code: 'missed_my_mistake', label: adaptiveText(locale, '没讲到我的错误', 'Missed my mistake', 'Chưa nói đúng lỗi của tôi') },
    { code: 'math_or_formula_unclear', label: adaptiveText(locale, '公式/步骤不清楚', 'Formula or steps unclear', 'Công thức hoặc bước giải chưa rõ') },
    { code: 'factually_wrong', label: adaptiveText(locale, '内容有错误', 'Factually wrong', 'Nội dung sai') }
  ];
}

type RoundMotivation = {
  tone: 'diagnostic' | 'excellent' | 'steady' | 'focused' | 'reset';
  kicker: string;
  title: string;
  body: string;
  longTerm: string;
  chips: string[];
};

function buildRoundMotivation(report: AdaptiveRoundReport, locale: string): RoundMotivation {
  const { accuracy, correctCount, total, unansweredCount, totalSeconds } = report.summary;
  const isDiagnostic = report.session.mode === 'diagnostic';
  const averageSeconds = total > 0 ? Math.round(totalSeconds / total) : 0;
  const firstWeakTopic = report.weakTopics[0];
  const weakTopic = firstWeakTopic ? practiceTopicLabel(firstWeakTopic.code, firstWeakTopic.title, locale) : undefined;
  const trend = report.trend && report.trend.sampleSize >= 3 ? report.trend : null;
  const trendChip = trend && trend.averageAccuracy !== null
    ? adaptiveText(locale, `近 ${trend.sampleSize} 轮均值 ${trend.averageAccuracy}%`, `${trend.sampleSize}-round avg ${trend.averageAccuracy}%`, `Trung bình ${trend.sampleSize} vòng ${trend.averageAccuracy}%`)
    : adaptiveText(locale, '继续积累趋势', 'Keep building trend data', 'Tiếp tục tích lũy xu hướng');
  const difficultyChip = trend && trend.currentDifficultyLabel
    ? adaptiveText(locale, `本轮难度 ${trend.currentDifficultyLabel}`, `Difficulty ${trend.currentDifficultyLabel}`, `Độ khó ${trend.currentDifficultyLabel}`)
    : null;
  const repeatedTopic = trend?.repeatedWeakTopics[0];
  const repeatedTopicTitle = repeatedTopic ? practiceTopicLabel(repeatedTopic.code, repeatedTopic.title, locale) : undefined;
  const repeatedTopicLine = trend && repeatedTopic
    ? adaptiveText(locale, `最近几轮里，“${repeatedTopicTitle}”反复出现了 ${repeatedTopic.count} 次，系统会把它当作优先回收点。`, `"${repeatedTopicTitle}" has appeared ${repeatedTopic.count} times recently, so the system will prioritize it.`, `"${repeatedTopicTitle}" đã xuất hiện ${repeatedTopic.count} lần gần đây, nên hệ thống sẽ ưu tiên củng cố.`)
    : '';
  const difficultyLine = trend
    ? trend.difficultyDirection === 'increased'
      ? trend.accuracyDelta !== null && trend.accuracyDelta < 0
        ? adaptiveText(locale, '这轮正确率回落时，难度也提高了，所以它更像一次挑战压力测试，不应直接理解成退步。', 'Accuracy dipped while difficulty increased, so treat this more like a pressure test than a setback.', 'Độ chính xác giảm trong khi độ khó tăng, nên hãy xem đây như bài kiểm tra áp lực hơn là tụt lùi.')
        : adaptiveText(locale, '本轮难度比上一轮更高，如果还能保持稳定，就说明掌握度更可信。', 'This round was harder than the last one; staying stable makes mastery more credible.', 'Vòng này khó hơn vòng trước; nếu vẫn ổn định thì mức nắm vững đáng tin hơn.')
      : trend?.difficultyDirection === 'decreased'
        ? adaptiveText(locale, '本轮难度已经降低，重点是重新找回可稳定完成的节奏。', 'Difficulty has been lowered; the priority is rebuilding a stable completion rhythm.', 'Độ khó đã giảm; ưu tiên là lấy lại nhịp làm bài ổn định.')
        : adaptiveText(locale, '本轮难度和上一轮接近，可以更直接观察稳定性。', 'Difficulty is close to the last round, so stability is easier to read.', 'Độ khó gần với vòng trước, nên có thể quan sát độ ổn định rõ hơn.')
    : '';
  const trendLine = trend
    ? trend.direction === 'improving'
      ? adaptiveText(locale, '最近几轮已经出现向上趋势，下一步要看这种稳定性是否能延续到更高难度。', 'Recent rounds are trending upward; next, check whether that stability holds at higher difficulty.', 'Các vòng gần đây đang đi lên; bước tiếp theo là xem độ ổn định này có giữ được khi khó hơn không.')
      : trend.direction === 'declining'
        ? difficultyLine || adaptiveText(locale, '最近几轮有回落迹象，这通常说明需要降低坡度，把基础判断重新稳住。', 'Recent rounds show some decline, which usually means lowering the slope and stabilizing basic judgment.', 'Các vòng gần đây có dấu hiệu giảm, thường nghĩa là cần giảm độ dốc và ổn định lại phán đoán cơ bản.')
        : adaptiveText(locale, '最近几轮整体比较平稳，真正的目标是继续减少同类错误和波动。', 'Recent rounds are steady overall; the real goal is reducing repeated errors and swings.', 'Các vòng gần đây nhìn chung ổn định; mục tiêu thật là giảm lỗi lặp lại và dao động.')
    : adaptiveText(locale, '长期训练会看连续多轮的稳定度。现在先继续积累样本，系统会逐步判断真实趋势。', 'Long-term training looks at stability across rounds. Keep building samples so the system can judge the real trend.', 'Luyện dài hạn xem độ ổn định qua nhiều vòng. Hãy tiếp tục tích lũy mẫu để hệ thống đánh giá xu hướng thật.');
  const pace = averageSeconds <= 45
    ? adaptiveText(locale, '节奏偏快', 'Fast pace', 'Nhịp hơi nhanh')
    : averageSeconds <= 90
      ? adaptiveText(locale, '节奏正常', 'Steady pace', 'Nhịp ổn định')
      : adaptiveText(locale, '需要放慢审题', 'Slow down reading', 'Cần đọc chậm hơn');
  const correctChip = adaptiveText(locale, `正确 ${correctCount}/${total}`, `Correct ${correctCount}/${total}`, `Đúng ${correctCount}/${total}`);
  const unansweredChip = adaptiveText(locale, `未答 ${unansweredCount}`, `Unanswered ${unansweredCount}`, `Chưa trả lời ${unansweredCount}`);

  if (isDiagnostic) {
    return {
      tone: 'diagnostic',
      kicker: adaptiveText(locale, '诊断反馈', 'Diagnostic Feedback', 'Phản hồi chẩn đoán'),
      title: adaptiveText(locale, '起点已经建立，接下来才是真正训练。', 'Your starting point is set; real training begins next.', 'Điểm bắt đầu đã được thiết lập; luyện tập thật bắt đầu từ đây.'),
      body: weakTopic
        ? adaptiveText(locale, `系统已经看到你在“${weakTopic}”上需要更多证据，下一轮会先用短训练把这个点稳住。`, `The system needs more evidence on "${weakTopic}", so the next short round will stabilize it first.`, `Hệ thống cần thêm bằng chứng ở "${weakTopic}", nên vòng ngắn tiếp theo sẽ ổn định điểm này trước.`)
        : adaptiveText(locale, '这次诊断没有暴露特别集中的薄弱点，下一轮会用 5 题训练继续验证稳定性。', 'This diagnostic did not expose a concentrated weak spot, so the next 5-question round will keep verifying stability.', 'Bài chẩn đoán này chưa lộ điểm yếu tập trung, nên vòng 5 câu tiếp theo sẽ tiếp tục kiểm tra độ ổn định.'),
      longTerm: adaptiveText(locale, `诊断不是最终评价，它只是帮系统找到起跑线。${trendLine}`, `The diagnostic is not a final judgment; it only finds the starting line. ${trendLine}`, `Chẩn đoán không phải đánh giá cuối cùng; nó chỉ giúp hệ thống tìm vạch xuất phát. ${trendLine}`),
      chips: [correctChip, difficultyChip ?? pace, trendChip]
    };
  }

  if (unansweredCount > 0) {
    return {
      tone: 'focused',
      kicker: adaptiveText(locale, '节奏反馈', 'Pacing Feedback', 'Phản hồi nhịp làm bài'),
      title: adaptiveText(locale, '先把题目做完整，比硬冲难度更重要。', 'Finish the round first; that matters more than forcing difficulty.', 'Hoàn thành câu hỏi trước đã; điều đó quan trọng hơn việc ép tăng độ khó.'),
      body: adaptiveText(locale, `这一轮还有 ${unansweredCount} 题未答。下一轮建议先稳住读题和提交节奏，再看是否提高难度。`, `There were ${unansweredCount} unanswered questions. In the next round, stabilize reading and submission rhythm before raising difficulty.`, `Vòng này còn ${unansweredCount} câu chưa trả lời. Vòng sau nên ổn định nhịp đọc đề và nộp bài trước khi tăng độ khó.`),
      longTerm: adaptiveText(locale, `长期训练里，完整作答本身就是一个进步指标。${trendLine}`, `In long-term training, completing the round is itself progress. ${trendLine}`, `Trong luyện dài hạn, hoàn thành vòng làm bài cũng là một chỉ số tiến bộ. ${trendLine}`),
      chips: [unansweredChip, difficultyChip ?? pace, trendChip]
    };
  }

  if (accuracy >= 90) {
    return {
      tone: 'excellent',
      kicker: adaptiveText(locale, '挑战反馈', 'Challenge Feedback', 'Phản hồi thử thách'),
      title: adaptiveText(locale, '这一轮很稳，可以接受更高一点的挑战。', 'This round was solid; a higher challenge is reasonable.', 'Vòng này rất ổn, có thể nhận thử thách cao hơn một chút.'),
      body: adaptiveText(locale, '高正确率说明本轮内容已经比较稳。下一轮如果题目变难、错误变多，也不一定是退步，而是在测试更高难度下能不能保持稳定。', 'High accuracy means this content is stable. If the next round gets harder and errors rise, it may be testing higher-difficulty stability rather than showing regression.', 'Độ chính xác cao cho thấy nội dung vòng này khá ổn. Nếu vòng sau khó hơn và sai nhiều hơn, đó có thể là kiểm tra độ ổn định ở độ khó cao hơn, không nhất thiết là tụt lùi.'),
      longTerm: adaptiveText(locale, `长期目标不是每轮都满分，而是在难度逐步上升时还能保持判断力和节奏。${trendLine}`, `The long-term goal is not a perfect score every round, but keeping judgment and rhythm as difficulty rises. ${trendLine}`, `Mục tiêu dài hạn không phải vòng nào cũng tuyệt đối, mà là giữ phán đoán và nhịp làm bài khi độ khó tăng. ${trendLine}`),
      chips: [correctChip, difficultyChip ?? pace, trendChip]
    };
  }

  if (accuracy >= 70) {
    return {
      tone: 'steady',
      kicker: adaptiveText(locale, '稳定反馈', 'Stability Feedback', 'Phản hồi ổn định'),
      title: adaptiveText(locale, '这一轮整体不错，适合继续推进。', 'This round was good overall; keep moving.', 'Vòng này nhìn chung tốt, phù hợp để tiếp tục tiến lên.'),
      body: weakTopic
        ? adaptiveText(locale, `大部分题已经能处理，下一轮会继续观察“${weakTopic}”是否只是偶发错误。`, `Most questions were manageable. The next round will check whether "${weakTopic}" was only occasional.`, `Phần lớn câu đã xử lý được. Vòng sau sẽ xem "${weakTopic}" chỉ là lỗi ngẫu nhiên hay không.`)
        : adaptiveText(locale, '这一轮没有明显拖后腿的主题，下一轮可以继续混合验证。', 'No topic clearly dragged this round down, so the next round can continue mixed verification.', 'Vòng này không có chủ đề nào kéo tụt rõ ràng, nên vòng sau có thể tiếp tục kiểm tra hỗn hợp.'),
      longTerm: adaptiveText(locale, `这种阶段最重要的是连续稳定。${repeatedTopicLine || trendLine}`, `At this stage, consecutive stability matters most. ${repeatedTopicLine || trendLine}`, `Ở giai đoạn này, ổn định liên tục là quan trọng nhất. ${repeatedTopicLine || trendLine}`),
      chips: [correctChip, difficultyChip ?? pace, trendChip]
    };
  }

  if (accuracy >= 40) {
    return {
      tone: 'focused',
      kicker: adaptiveText(locale, '修正反馈', 'Correction Feedback', 'Phản hồi chỉnh sửa'),
      title: adaptiveText(locale, '这一轮问题比较集中，适合短轮修正。', 'The issues are fairly concentrated; short correction rounds fit well.', 'Vấn đề vòng này khá tập trung, phù hợp với vòng sửa ngắn.'),
      body: weakTopic
        ? adaptiveText(locale, `主要先处理“${weakTopic}”。下一轮不会盲目加难度，而是先确认你能不能把这个误区修回来。`, `Focus on "${weakTopic}" first. The next round will not blindly raise difficulty; it will check whether this misconception can be repaired.`, `Trước hết tập trung vào "${weakTopic}". Vòng sau sẽ không tăng độ khó mù quáng, mà kiểm tra bạn có sửa lại hiểu nhầm này được không.`)
        : adaptiveText(locale, '本轮错误还比较分散，下一轮会继续收集证据，帮你找到最值得先补的点。', 'Errors are still scattered, so the next round will collect more evidence and find the best repair point.', 'Lỗi vòng này còn phân tán, nên vòng sau sẽ thu thập thêm bằng chứng để tìm điểm cần bổ sung trước.'),
      longTerm: adaptiveText(locale, `长期进步常常来自反复修同一种小错误。${difficultyLine || repeatedTopicLine || trendLine}`, `Long-term progress often comes from repeatedly fixing the same small error. ${difficultyLine || repeatedTopicLine || trendLine}`, `Tiến bộ dài hạn thường đến từ việc sửa đi sửa lại cùng một lỗi nhỏ. ${difficultyLine || repeatedTopicLine || trendLine}`),
      chips: [correctChip, difficultyChip ?? pace, trendChip]
    };
  }

  return {
    tone: 'reset',
    kicker: adaptiveText(locale, '稳住反馈', 'Reset Feedback', 'Phản hồi ổn định lại'),
    title: adaptiveText(locale, '这一轮先当作定位，不急着硬冲。', 'Treat this round as positioning; no need to force ahead.', 'Hãy xem vòng này như định vị, chưa cần ép tiến quá nhanh.'),
    body: weakTopic
      ? adaptiveText(locale, `先从“${weakTopic}”降一点难度重新稳住。下一轮的目标不是立刻做难题，而是把基本判断做回来。`, `Start by lowering difficulty around "${weakTopic}" and stabilizing again. The next goal is restoring basic judgment, not jumping to hard questions.`, `Hãy bắt đầu bằng cách giảm độ khó quanh "${weakTopic}" và ổn định lại. Mục tiêu vòng sau là lấy lại phán đoán cơ bản, không phải làm ngay câu khó.`)
      : adaptiveText(locale, '这一轮暴露的问题还不够集中，下一轮会用更基础的题继续定位。', 'The issues are not concentrated enough yet, so the next round will use more basic questions to locate them.', 'Vấn đề vòng này chưa đủ tập trung, nên vòng sau sẽ dùng câu cơ bản hơn để định vị tiếp.'),
    longTerm: adaptiveText(locale, `长期训练允许有低分轮。重要的是系统能根据低分轮降低坡度，让你重新获得可完成的挑战。${trendLine}`, `Long-term training allows low-score rounds. What matters is lowering the slope and rebuilding achievable challenge. ${trendLine}`, `Luyện dài hạn cho phép có vòng điểm thấp. Quan trọng là hệ thống giảm độ dốc để bạn lấy lại thử thách có thể hoàn thành. ${trendLine}`),
    chips: [correctChip, difficultyChip ?? pace, trendChip]
  };
}

function masteryPercent(value: number | null | undefined, locale = 'zh-CN') {
  if (value === null || value === undefined) return adaptiveText(locale, '未诊断', 'Not diagnosed', 'Chưa chẩn đoán');
  return `${Math.round(value)}%`;
}

function subjectDescription(subject: { id: string; description?: string }, locale: string) {
  if (locale === 'en') {
    if (subject.id === 'math') return 'Adaptive CSCA math training across functions, geometry, algebra, probability, and statistics.';
    if (subject.id === 'physics') return 'Adaptive CSCA physics training across mechanics, electricity, waves, optics, heat, and modern physics.';
    if (subject.id === 'chemistry') return 'Adaptive CSCA chemistry training across concepts, reactions, solutions, and applications.';
  }
  if (locale === 'vi') {
    if (subject.id === 'math') return 'Luyện CSCA Toán thích ứng theo hàm số, hình học, đại số, xác suất và thống kê.';
    if (subject.id === 'physics') return 'Luyện CSCA Vật lý thích ứng theo cơ học, điện học, sóng, quang học, nhiệt học và vật lý hiện đại.';
    if (subject.id === 'chemistry') return 'Luyện CSCA Hóa học thích ứng theo khái niệm, phản ứng, dung dịch và ứng dụng.';
  }
  return subject.description ?? '';
}

const MATH_BLOCK_PATTERN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
const LATEX_COMMAND_PATTERN = /\\(?:frac|sqrt|log|ln|sin|cos|tan|cdot|times|pm|alpha|beta|theta|pi|infty|left|right|mathrm|quad|text|vec|bar|Delta|delta|lambda|varepsilon|omega|sum|lim)(?![A-Za-z])/;
const BARE_LATEX_SEGMENT_PATTERN = /[\\A-Za-z0-9_{}^=+\-*/().,|:;\s]+/g;

function wrapBareLatex(segment: string) {
  return segment.replace(BARE_LATEX_SEGMENT_PATTERN, (candidate) => {
    if (!LATEX_COMMAND_PATTERN.test(candidate)) return candidate;
    const leading = candidate.match(/^\s*/)?.[0] ?? '';
    const trailing = candidate.match(/\s*$/)?.[0] ?? '';
    const formula = candidate.trim().replace(/\\+$/, '');
    return formula ? `${leading}$${formula}$${trailing}` : candidate;
  });
}

function normalizeMathText(text: string) {
  const unescaped = text
    .replace(/\\\\(?=[A-Za-z()[\]{}])/g, '\\')
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, formula: string) => `$$${formula}$$`);
  return unescaped
    .split(MATH_BLOCK_PATTERN)
    .filter(Boolean)
    .map((part) => (part.startsWith('$') ? part : wrapBareLatex(part)))
    .join('');
}

function RichMathContent({ text }: { text: string }) {
  const normalizedText = normalizeMathText(text);
  const parts = normalizedText.split(/(\*\*[^*]+?\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const bold = part.startsWith('**') && part.endsWith('**');
        const value = bold ? part.slice(2, -2) : part;
        return bold
          ? <strong key={`${part}-${index}`} className="special-explanation-inline-strong"><MathContent text={value} /></strong>
          : <MathContent key={`${part}-${index}`} text={part} />;
      })}
    </>
  );
}

function localizeRoundSummaryOutput(text: string, locale: string) {
  if (locale === 'zh-CN') return text;
  return text
    .split(/\n+/)
    .map((line) => localizeRoundSummaryLine(line.trim(), locale))
    .filter(Boolean)
    .join('\n');
}

function localizeRoundSummaryLine(line: string, locale: string) {
  if (!line) return '';
  const countMatch = line.match(/^【本轮判断】\s*正确率\s*(\d+)%[，,]\s*答对\s*(\d+)\s*题[，,]\s*答错\s*(\d+)\s*题[，,]\s*未答\s*(\d+)\s*题。?$/);
  if (countMatch) {
    const [, accuracy, correct, wrong, unanswered] = countMatch;
    return locale === 'vi'
      ? `[Nhận định vòng này] Độ chính xác ${accuracy}%, đúng ${correct}, sai ${wrong}, chưa trả lời ${unanswered}.`
      : `[This round] Accuracy ${accuracy}%, correct ${correct}, wrong ${wrong}, unanswered ${unanswered}.`;
  }
  const focusMatch = line.match(/^【下一步重点】\s*优先关注[:：]\s*(.+?)。?$/);
  if (focusMatch) {
    const topics = focusMatch[1].replace(/、/g, locale === 'vi' ? ', ' : ', ');
    return locale === 'vi'
      ? `[Trọng tâm tiếp theo] Ưu tiên: ${topics}.`
      : `[Next focus] Prioritize: ${topics}.`;
  }
  if (/^【下一步重点】\s*本轮没有明显薄弱主题/.test(line)) {
    return locale === 'vi'
      ? '[Trọng tâm tiếp theo] Vòng này chưa có chủ đề yếu rõ ràng; có thể thử mức khó hơn.'
      : '[Next focus] No clear weak topic in this round; try a harder round.';
  }
  if (/^【一个动作】\s*直接开始下一轮/.test(line)) {
    return locale === 'vi'
      ? '[Một hành động] Bắt đầu vòng tiếp theo và xem khi độ khó tăng bạn còn ổn định không.'
      : '[One action] Start the next round and check whether stability holds as difficulty rises.';
  }
  if (/^【一个动作】\s*先复盘错题中的共同误区/.test(line)) {
    return locale === 'vi'
      ? '[Một hành động] Ôn điểm chung của các câu sai trước, rồi làm vòng 5 câu tiếp theo.'
      : '[One action] Review the shared pattern in wrong answers, then start the next 5-question round.';
  }
  return line
    .replace('【本轮判断】', locale === 'vi' ? '[Nhận định vòng này]' : '[This round]')
    .replace('【下一步重点】', locale === 'vi' ? '[Trọng tâm tiếp theo]' : '[Next focus]')
    .replace('【一个动作】', locale === 'vi' ? '[Một hành động]' : '[One action]');
}

function ExplanationText({ text }: { text: string }) {
  return (
    <div className="special-explanation-text">
      {text.split(/\n+/).filter(Boolean).map((line) => {
        const match = line.match(/^(【[^】]+】|\[[^\]]+\])(.*)$/);
        return (
          <p key={line}>
            {match ? <strong>{match[1]}</strong> : null}
            <RichMathContent text={match ? match[2].trimStart() : line} />
          </p>
        );
      })}
    </div>
  );
}
function LoadingState({ label }: { label?: string }) {
  const { locale } = useI18n();
  return (
    <div className="page-stack brand-page special-practice-page special-loading-skeleton" aria-label={label ?? adaptiveText(locale, ADAPTIVE_COPY.loading, 'Loading', 'Đang tải')}>
      <section className="special-hero">
        <div>
          <span className="special-skeleton-line short" />
          <span className="special-skeleton-line hero-title" />
          <span className="special-skeleton-line wide" />
          <div className="special-hero-actions">
            <span className="special-skeleton-button" />
            <span className="special-skeleton-button secondary" />
          </div>
        </div>
        <aside className="special-status-card">
          <span className="special-skeleton-line short" />
          <div className="special-status-metrics">
            <strong><span className="special-skeleton-line metric" /></strong>
            <strong><span className="special-skeleton-line metric" /></strong>
            <strong><span className="special-skeleton-line metric" /></strong>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  const { locale } = useI18n();
  return (
    <section className="school-empty-state">
      <h1>{adaptiveText(locale, ADAPTIVE_COPY.loadFailed, 'Load failed', 'Tải thất bại')}</h1>
      <p>{message}</p>
      <GhostButton onClick={onBack}>{adaptiveText(locale, ADAPTIVE_COPY.backToPractice, 'Back to practice', 'Quay lại luyện tập')}</GhostButton>
    </section>
  );
}

function StructuredExplanation({ interaction, locale }: { interaction: AdaptiveAIInteraction; locale: string }) {
  const structured = interaction.structuredExplanation;
  if (!structured) return <ExplanationText text={interaction.output} />;
  const items = [
    {
      key: 'whyWrong',
      icon: 'lucide:circle-alert',
      title: adaptiveText(locale, '为什么错', 'Why it was wrong', 'Vì sao sai'),
      body: structured.whyWrong
    },
    {
      key: 'correctApproach',
      icon: 'lucide:route',
      title: adaptiveText(locale, '正确思路', 'Correct approach', 'Cách nghĩ đúng'),
      body: structured.correctApproach
    },
    {
      key: 'quickMethod',
      icon: 'lucide:zap',
      title: adaptiveText(locale, '快速解法', 'Quick method', 'Cách làm nhanh'),
      body: structured.quickMethod
    },
    {
      key: 'avoidNextTime',
      icon: 'lucide:shield-check',
      title: adaptiveText(locale, '下次如何避免', 'Avoid next time', 'Lần sau tránh thế nào'),
      body: structured.avoidNextTime
    }
  ];
  return (
    <div className="special-ai-structured-explanation">
      {items.map((item) => (
        <section key={item.key}>
          <h4><Icon name={item.icon} />{item.title}</h4>
          <p><MathContent text={item.body} /></p>
        </section>
      ))}
    </div>
  );
}

function AICreditPanel({
  entitlement,
  compact = false,
  onBuy,
  onRefresh,
  isBuying = false
}: {
  entitlement: AdaptiveAIEntitlement | null | undefined;
  compact?: boolean;
  onBuy: () => void;
  onRefresh?: () => void;
  isBuying?: boolean;
}) {
  const { locale } = useI18n();
  const isLoading = entitlement === undefined;
  const isUnavailable = entitlement === null;
  const balance = entitlement?.balanceUnits ?? 0;
  const organization = entitlement?.organization ?? null;
  const unlimitedLabel = adaptiveText(locale, '不限', 'Unlimited', 'Không giới hạn');
  const isDisabled = entitlement?.enabled === false;
  const isUnlimited = Boolean(entitlement?.unlimited);
  const isEmpty = !isLoading && !isUnavailable && !isDisabled && !isUnlimited && balance <= 0;
  const isLow = !isLoading && !isUnavailable && !isDisabled && !isUnlimited && balance > 0 && balance <= 3;

  return (
    <section className={['special-ai-credit-panel', compact ? 'compact' : '', isEmpty ? 'empty' : '', isLow ? 'low' : ''].filter(Boolean).join(' ')}>
      <div className="special-ai-credit-head">
        <span>{adaptiveText(locale, ADAPTIVE_COPY.aiCreditsTitle, 'AI Coach credits', 'Lượt AI Coach')}</span>
        <strong>{isLoading || isUnavailable ? '--' : isUnlimited ? unlimitedLabel : balance}{!isUnlimited && <small>{adaptiveText(locale, '次', 'credits', 'lượt')}</small>}</strong>
      </div>
      <div className="special-ai-credit-metrics">
        <span>{adaptiveText(locale, '个人额度', 'Personal credits', 'Lượt cá nhân')}</span>
        <span>{entitlement ? isUnlimited ? unlimitedLabel : adaptiveText(locale, ADAPTIVE_COPY.aiCreditsUsed(entitlement.lifetimeUsed, entitlement.lifetimeGranted), `Used ${entitlement.lifetimeUsed} / Granted ${entitlement.lifetimeGranted}`, `Đã dùng ${entitlement.lifetimeUsed} / Đã cấp ${entitlement.lifetimeGranted}`) : isLoading ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditsLoading, 'Loading credits...', 'Đang tải lượt...') : adaptiveText(locale, ADAPTIVE_COPY.aiCreditFetchFailed, 'AI credits cannot be loaded.', 'Tạm thời chưa đọc được lượt AI.')}</span>
      </div>
      {organization && (
        <div className="special-ai-credit-metrics">
          <span>{adaptiveText(locale, '机构额度', 'Organization credits', 'Lượt tổ chức')}</span>
          <span>{organization.name} · {organization.balanceUnits}{adaptiveText(locale, ' 次可用', ' available', ' lượt còn')}</span>
        </div>
      )}
      <p>
        {isLoading
          ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditsLoading, 'Loading credits...', 'Đang tải lượt...')
          : isUnavailable
            ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditFetchFailed, 'AI credits cannot be loaded.', 'Tạm thời chưa đọc được lượt AI.')
            : isDisabled
            ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditsDisabled, 'AI Coach is not enabled yet; training and standard explanations still work.', 'AI Coach chưa mở; luyện tập và giải thích tiêu chuẩn vẫn dùng được.')
            : isUnlimited
              ? adaptiveText(locale, '该测试账号已开通不限 AI 额度。', 'This test account has unlimited AI credits.', 'Tài khoản kiểm thử này có lượt AI không giới hạn.')
            : isEmpty
              ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditsEmpty, 'Credits are used up; AI Coach falls back to standard explanations and local hints.', 'Đã hết lượt; AI Coach sẽ hạ xuống giải thích tiêu chuẩn và gợi ý cục bộ.')
              : isLow
                ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditsLow, 'Credits are low; consider topping up before AI Coach degrades.', 'Lượt còn ít; nên nạp thêm để tránh AI Coach bị hạ cấp.')
                : organization
                  ? adaptiveText(locale, `已加入 ${organization.name}，AI 会优先使用机构额度；机构额度不可用时再使用个人额度。`, `You are in ${organization.name}; organization credits are used first, then personal credits if needed.`, `Bạn đã tham gia ${organization.name}; hệ thống dùng lượt tổ chức trước, sau đó mới dùng lượt cá nhân nếu cần.`)
                  : adaptiveText(locale, ADAPTIVE_COPY.aiCreditsFree(entitlement.initialFreeUnits), `New users get ${entitlement.initialFreeUnits} free credits by default; purchases and admin grants share the same balance.`, `Người dùng mới mặc định có ${entitlement.initialFreeUnits} lượt miễn phí; lượt mua và cấp bởi quản trị dùng chung số dư.`)}
      </p>
      <div className="special-ai-credit-actions">
        <button type="button" onClick={onBuy} disabled={isBuying}>{isBuying ? adaptiveText(locale, '处理中...', 'Processing...', 'Đang xử lý...') : adaptiveText(locale, ADAPTIVE_COPY.buyAICredits, 'Buy AI credits', 'Nạp lượt AI')}</button>
        {onRefresh && <GhostButton onClick={onRefresh}>{adaptiveText(locale, ADAPTIVE_COPY.refreshCredits, 'Refresh credits', 'Làm mới lượt')}</GhostButton>}
      </div>
    </section>
  );
}

async function startAICreditCheckout(_onNavigate: (path: string) => void, locale: string, setError?: (message: string | null) => void) {
  setError?.(adaptiveText(locale, ADAPTIVE_COPY.aiCreditPurchaseFailed, 'AI credit purchases are not open yet.', 'Chưa mở mua lượt AI.'));
  return false;
}

export function AdaptiveLoginPrompt({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  return (
    <section className="school-empty-state">
      <h1>{adaptiveText(locale, '登录后开始科目练习', 'Log in to start subject practice', 'Đăng nhập để bắt đầu luyện theo môn')}</h1>
      <p>{adaptiveText(locale, '科目练习需要保存你的掌握度、错题和下一轮推荐，因此需要先登录。', 'Subject practice needs to save mastery, mistakes, and next-round recommendations, so login is required.', 'Luyện theo môn cần lưu mức nắm vững, lỗi sai và đề xuất vòng tiếp theo, vì vậy bạn cần đăng nhập trước.')}</p>
      <button type="button" onClick={() => onNavigate(routes.login)}>{adaptiveText(locale, '去登录', 'Log in', 'Đăng nhập')}</button>
    </section>
  );
}

export function AdaptiveOverviewView({ currentUser, isResolvingAuth = false, onNavigate }: { currentUser: User | null; isResolvingAuth?: boolean; onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [overview, setOverview] = useState<AdaptiveTrainingOverview | null>(null);
  const [entitlement, setEntitlement] = useState<AdaptiveAIEntitlement | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);
  const hasAuth = Boolean(currentUser && !isResolvingAuth);

  useEffect(() => {
    let alive = true;
    if (isResolvingAuth) return () => { alive = false; };
    void getAdaptivePracticeOverview(hasAuth)
      .then((result) => { if (alive) setOverview(result); })
      .catch((nextError) => { if (alive) setError(friendlyPracticeError(nextError, adaptiveText(locale, '科目练习无法加载。', 'Subject practice could not be loaded.', 'Không thể tải luyện tập theo môn.'), locale)); });
    if (hasAuth) {
      void getAdaptiveAIEntitlement()
        .then((result) => { if (alive) setEntitlement(result); })
        .catch(() => { if (alive) setEntitlement(null); });
    } else {
      setEntitlement(null);
    }
    return () => { alive = false; };
  }, [hasAuth, isResolvingAuth, locale]);

  if (error) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaPrep)} />;
  if (!overview) return <LoadingState label={adaptiveText(locale, '正在加载科目练习', 'Loading subject practice', 'Đang tải luyện tập theo môn')} />;
  const copy = adaptiveCopy(locale);
  const mathSubject = overview.subjects.find((subject) => subject.id === 'math');
  const mathNeedsDiagnostic = mathSubject?.nextAction === 'start_diagnostic';
  const buyCredits = async () => {
    if (isBuyingCredits) return;
    setIsBuyingCredits(true);
    const success = await startAICreditCheckout(onNavigate, locale, setError);
    if (!success) setIsBuyingCredits(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page">
      <section className="special-hero">
        <div>
          <p className="page-kicker">{adaptiveText(locale, 'CSCA 科目练习', 'CSCA Subject Practice', 'Luyện tập theo môn CSCA')}</p>
          <h1>{adaptiveText(locale, '先诊断水平，再自动安排训练。', 'Diagnose your level first, then train by recommendation.', 'Chẩn đoán trình độ trước, sau đó luyện theo đề xuất tự động.')}</h1>
          <p className="page-body">{adaptiveText(locale, '每个学科首次进入先完成 20 题诊断，系统混合考点和难度建立画像；诊断完成后，再进入 5 题一轮的智能练习。', 'Start each subject with a 20-question diagnostic. The system mixes topics and difficulty to build your profile, then moves into 5-question adaptive rounds.', 'Mỗi môn bắt đầu bằng bài chẩn đoán 20 câu. Hệ thống trộn chủ đề và độ khó để tạo hồ sơ, sau đó chuyển sang các vòng luyện thích ứng 5 câu.')}</p>
          <div className="special-hero-actions">
            <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{mathNeedsDiagnostic ? adaptiveText(locale, '开始数学诊断', 'Start math diagnostic', 'Bắt đầu chẩn đoán Toán') : adaptiveText(locale, '继续数学训练', 'Continue math training', 'Tiếp tục luyện Toán')}</button>
            <GhostButton onClick={() => onNavigate(routes.cscaMockExam)}>{copy.tryMock}</GhostButton>
          </div>
        </div>
        <aside className="special-status-card">
          <span>{adaptiveText(locale, '训练题库', 'Practice Bank', 'Ngân hàng luyện tập')}</span>
          <div className="special-status-metrics">
            <strong>{overview.subjects.length}<small>{copy.subjectsUnit}</small></strong>
            <strong>{overview.subjects.reduce((sum, subject) => sum + subject.topicCount, 0)}<small>{copy.topicsUnit}</small></strong>
            <strong>{overview.subjects.reduce((sum, subject) => sum + subject.questionCount, 0)}<small>{copy.questionsUnit}</small></strong>
          </div>
          <div className="special-status-features">
            <em>{adaptiveText(locale, `${overview.diagnosticRoundSize} 题诊断`, `${overview.diagnosticRoundSize}-question diagnostic`, `Chẩn đoán ${overview.diagnosticRoundSize} câu`)}</em>
            <em>{adaptiveText(locale, `${overview.roundSize} 题训练`, `${overview.roundSize}-question rounds`, `Vòng luyện ${overview.roundSize} câu`)}</em>
            <em>{adaptiveText(locale, '按掌握度推荐', 'Recommended by mastery', 'Đề xuất theo mức nắm vững')}</em>
          </div>
          {hasAuth && <AICreditPanel entitlement={entitlement} compact onBuy={() => { void buyCredits(); }} isBuying={isBuyingCredits} />}
        </aside>
      </section>

      <section className="special-subject-grid">
        {overview.subjects.map((subject) => (
          <article key={subject.id} className={`special-subject-card ${SUBJECT_ACCENTS[subject.id]?.color ?? ''}`}>
            <div className="special-subject-card-head">
              <Icon name={SUBJECT_ACCENTS[subject.id]?.icon ?? 'lucide:book-open-check'} />
              <div>
                <h2>{subjectLabel(subject.id, locale)}</h2>
                <span>{adaptiveText(locale, `${subject.topicCount} 个内部考点`, `${subject.topicCount} internal topics`, `${subject.topicCount} chủ đề nội bộ`)}</span>
              </div>
            </div>
            <p>{subjectDescription({ id: subject.id, description: '' }, locale)}</p>
            <div className="special-subject-metrics">
              <span>{adaptiveText(locale, `${subject.questionCount} 道题`, `${subject.questionCount} questions`, `${subject.questionCount} câu`)}</span>
              <span>{subject.nextAction === 'start_diagnostic' ? adaptiveText(locale, '诊断 未完成', 'Diagnostic not done', 'Chưa chẩn đoán') : adaptiveText(locale, `掌握度 ${masteryPercent(subject.averageMastery, locale)}`, `Mastery ${masteryPercent(subject.averageMastery, locale)}`, `Mức nắm vững ${masteryPercent(subject.averageMastery, locale)}`)}</span>
            </div>
            <button type="button" onClick={() => onNavigate(subjectPath(subject.id))}>
              {subject.nextAction === 'start_diagnostic' ? adaptiveText(locale, '进入诊断', 'Enter diagnostic', 'Vào chẩn đoán') : adaptiveText(locale, '继续训练', 'Continue training', 'Tiếp tục luyện')}
            </button>
          </article>
        ))}
      </section>

      <section className="special-mock-cta">
        <div>
          <p className="page-kicker">{adaptiveText(locale, '完整检验', 'Full Check', 'Kiểm tra đầy đủ')}</p>
          <h2>{adaptiveText(locale, '训练负责补弱项，模考负责测节奏。', 'Training repairs weak spots; mock exams test pacing.', 'Luyện tập sửa điểm yếu; thi thử kiểm tra nhịp làm bài.')}</h2>
          <p>{adaptiveText(locale, '科目练习会把每一轮安排得更短、更聚焦；当掌握度稳定后，再进入完整模考检查 60 分钟节奏。', 'Subject practice keeps each round short and focused. Once mastery stabilizes, use a full mock to check the 60-minute rhythm.', 'Luyện theo môn giữ mỗi vòng ngắn và tập trung. Khi mức nắm vững ổn định, hãy dùng đề thi thử đầy đủ để kiểm tra nhịp 60 phút.')}</p>
        </div>
        <button type="button" onClick={() => onNavigate(routes.cscaMockExam)}>{copy.enterMock}</button>
      </section>
    </div>
  );
}

export function AdaptiveSubjectDashboardView({ subject, currentUser, isResolvingAuth = false, onNavigate }: { subject: string; currentUser: User | null; isResolvingAuth?: boolean; onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [overview, setOverview] = useState<AdaptiveTrainingOverview | null>(null);
  const [mastery, setMastery] = useState<AdaptiveMasteryTopic[]>([]);
  const [entitlement, setEntitlement] = useState<AdaptiveAIEntitlement | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [questionLanguage, setQuestionLanguage] = useState<AdaptiveQuestionLanguage>(() => readStoredQuestionLanguage(subject, locale));
  const hasAuth = Boolean(currentUser && !isResolvingAuth);

  useEffect(() => {
    setQuestionLanguage(readStoredQuestionLanguage(subject, locale));
  }, [locale, subject]);

  useEffect(() => {
    let alive = true;
    if (isResolvingAuth) return () => { alive = false; };
    void getAdaptivePracticeOverview(hasAuth)
      .then((result) => { if (alive) setOverview(result); })
      .catch((nextError) => { if (alive) setError(friendlyPracticeError(nextError, adaptiveText(locale, '科目练习无法加载。', 'Subject practice could not be loaded.', 'Không thể tải luyện tập theo môn.'), locale)); });
    if (hasAuth) {
      void getAdaptivePracticeMastery(subject)
        .then((result) => { if (alive) setMastery(result.items); })
        .catch(() => undefined);
      void getAdaptiveAIEntitlement()
        .then((result) => { if (alive) setEntitlement(result); })
        .catch(() => { if (alive) setEntitlement(null); });
    }
    return () => { alive = false; };
  }, [subject, hasAuth, isResolvingAuth, locale]);

  async function startRound(focusTopicId?: number) {
    if (!hasAuth || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const subjectState = overview?.subjects.find((item) => item.id === subject);
      const needsDiagnostic = subjectState?.nextAction === 'start_diagnostic';
      const activeLanguage = normalizeQuestionLanguage(subjectState?.questionLanguage, locale);
      const reusableActiveSessionId = subjectState?.activeSessionId && activeLanguage === questionLanguage
        ? subjectState.activeSessionId
        : null;
      const sessionId = reusableActiveSessionId ?? (await createAdaptivePracticeSession({ subject, mode: needsDiagnostic ? 'diagnostic' : 'practice', questionLanguage })).id;
      const round = await createAdaptivePracticeRound(sessionId, needsDiagnostic ? {} : { focusTopicId });
      onNavigate(adaptiveRoundPath(subject, round.round.id));
    } catch (nextError) {
      setError(friendlyPracticeError(nextError, adaptiveText(locale, '暂时无法开始科目练习。', 'Subject practice cannot start right now.', 'Tạm thời chưa thể bắt đầu luyện theo môn.'), locale));
    } finally {
      setIsStarting(false);
    }
  }

  if (isResolvingAuth) return <LoadingState label={adaptiveText(locale, '正在确认登录状态', 'Checking sign-in status', 'Đang kiểm tra trạng thái đăng nhập')} />;
  if (!hasAuth) return <AdaptiveLoginPrompt onNavigate={onNavigate} />;
  if (error && !overview) return <ErrorState message={error} onBack={() => onNavigate(subjectPath(subject))} />;
  if (!overview) return <LoadingState label={adaptiveText(locale, '正在加载学科训练', 'Loading subject training', 'Đang tải luyện tập theo môn')} />;

  const subjectSummary = overview.subjects.find((item) => item.id === subject);
  if (!subjectSummary) return <ErrorState message={adaptiveText(locale, '科目练习不存在。', 'Subject practice was not found.', 'Không tìm thấy luyện tập theo môn.')} onBack={() => onNavigate(routes.cscaSubjects)} />;
  const needsDiagnostic = subjectSummary.nextAction === 'start_diagnostic';
  const weak = [...mastery].sort((a, b) => a.mastery - b.mastery || a.confidence - b.confidence).slice(0, 5);
  const average = subjectSummary.averageMastery === null ? null : Math.round(subjectSummary.averageMastery);
  const currentRoundSize = needsDiagnostic ? overview.diagnosticRoundSize : overview.roundSize;
  const hasActiveRound = Boolean(subjectSummary.activeSessionId);
  const activeQuestionLanguage = normalizeQuestionLanguage(subjectSummary.questionLanguage, locale);
  const hasActiveRoundInDifferentLanguage = Boolean(subjectSummary.activeSessionId && activeQuestionLanguage !== questionLanguage);
  const selectedQuestionLanguageLabel = questionLanguageLabel(questionLanguage, locale);
  const primaryActionLabel = isStarting
    ? adaptiveText(locale, '正在创建...', 'Creating...', 'Đang tạo...')
    : needsDiagnostic
      ? adaptiveText(locale, `开始 ${overview.diagnosticRoundSize} 题诊断`, `Start ${overview.diagnosticRoundSize}-question diagnostic`, `Bắt đầu chẩn đoán ${overview.diagnosticRoundSize} câu`)
      : hasActiveRoundInDifferentLanguage
        ? adaptiveText(locale, selectedQuestionLanguageLabel === 'English questions' ? `用 ${selectedQuestionLanguageLabel} 开始训练` : `用${selectedQuestionLanguageLabel}开始训练`, `Start in ${selectedQuestionLanguageLabel}`, `Bắt đầu bằng ${selectedQuestionLanguageLabel}`)
        : hasActiveRound
        ? adaptiveText(locale, '继续未完成训练', 'Continue unfinished training', 'Tiếp tục vòng luyện chưa hoàn thành')
        : adaptiveText(locale, '开始下一轮训练', 'Start next round', 'Bắt đầu vòng tiếp theo');
  const guidanceTitle = needsDiagnostic
    ? adaptiveText(locale, `${overview.diagnosticRoundSize} 题混合诊断，不按专题手动选择。`, `${overview.diagnosticRoundSize}-question mixed diagnostic, no manual topic picking.`, `Bài chẩn đoán hỗn hợp ${overview.diagnosticRoundSize} câu, không cần tự chọn chuyên đề.`)
    : hasActiveRound
      ? adaptiveText(locale, '继续上次未完成的训练。', 'Continue the unfinished round.', 'Tiếp tục vòng luyện còn dang dở.')
      : weak.length
        ? adaptiveText(locale, `下一轮优先处理 ${weak[0].title}`, `Next round focuses on ${weak[0].title}`, `Vòng tiếp theo ưu tiên ${weak[0].title}`)
        : adaptiveText(locale, '下一轮训练已经准备好。', 'The next round is ready.', 'Vòng luyện tiếp theo đã sẵn sàng.');
  const guidanceBody = needsDiagnostic
    ? adaptiveText(locale, '第一次进入本科目时，系统会混合考点和难度来建立初始掌握度。完成后，后续再进入就直接做正式训练。', 'The first visit mixes topics and difficulty to estimate initial mastery. After that, this subject opens directly into regular training.', 'Lần đầu vào môn này, hệ thống trộn chủ đề và độ khó để ước tính mức nắm vững ban đầu. Sau khi hoàn thành, các lần sau sẽ vào luyện chính thức.')
    : hasActiveRound
      ? adaptiveText(locale, '继续作答后，系统会按本轮结果更新你的掌握度、错题和下一轮推荐。', 'After you continue, the system updates mastery, mistakes, and next-round recommendations from this round.', 'Sau khi tiếp tục làm bài, hệ thống sẽ cập nhật mức nắm vững, lỗi sai và đề xuất vòng sau theo kết quả vòng này.')
      : adaptiveText(locale, '系统会综合薄弱主题、最近错误和复习间隔，不需要你在开始前做复杂选择。', 'The system combines weak topics, recent mistakes, and review intervals, so you do not need complex setup before starting.', 'Hệ thống kết hợp chủ đề yếu, lỗi gần đây và khoảng ôn tập, nên bạn không cần chọn phức tạp trước khi bắt đầu.');
  const aiCreditSummary = entitlement === undefined
    ? adaptiveText(locale, '读取中', 'Loading', 'Đang tải')
    : entitlement === null
      ? adaptiveText(locale, '暂不可读', 'Unavailable', 'Tạm chưa đọc được')
      : entitlement.enabled
        ? entitlement.unlimited
          ? adaptiveText(locale, '不限', 'Unlimited', 'Không giới hạn')
          : adaptiveText(locale, `${entitlement.balanceUnits} 次`, `${entitlement.balanceUnits} credits`, `${entitlement.balanceUnits} lượt`)
        : adaptiveText(locale, '未开放', 'Not enabled', 'Chưa mở');
  const chooseQuestionLanguage = (language: AdaptiveQuestionLanguage) => {
    setQuestionLanguage(language);
    writeStoredQuestionLanguage(subject, language);
  };

  return (
    <div className="page-stack brand-page special-practice-page">
      <section className="special-subject-hero special-subject-hero-guided">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath(subject))}>{adaptiveText(locale, '← 返回科目学习', '← Back to subject hub', '← Quay lại trang môn học')}</GhostButton>
        <div className="special-guided-hero-main">
          <div>
            <p className="page-kicker">{adaptiveText(locale, `CSCA ${subjectLabel(subject, locale)} 科目练习`, `CSCA ${subjectLabel(subject, locale)} Practice`, `Luyện ${subjectLabel(subject, locale)} CSCA`)}</p>
            <h1>{needsDiagnostic ? adaptiveText(locale, `先完成 ${overview.diagnosticRoundSize} 题诊断。`, `Complete the ${overview.diagnosticRoundSize}-question diagnostic first.`, `Hoàn thành bài chẩn đoán ${overview.diagnosticRoundSize} câu trước.`) : average === null ? adaptiveText(locale, '系统会安排下一轮训练。', 'The system will prepare the next training round.', 'Hệ thống sẽ sắp xếp vòng luyện tiếp theo.') : adaptiveText(locale, `当前掌握度 ${average}%，继续按推荐训练。`, `Current mastery is ${average}%. Continue with the recommendation.`, `Mức nắm vững hiện tại ${average}%. Tiếp tục luyện theo đề xuất.`)}</h1>
            <p className="page-body">{needsDiagnostic ? adaptiveText(locale, '这一步只做一次，用来估计本科目的真实水平。', 'This step happens once to estimate your real level in this subject.', 'Bước này chỉ làm một lần để ước tính trình độ thực tế của bạn trong môn này.') : adaptiveText(locale, `每轮 ${overview.roundSize} 题，系统根据近期表现自动调度。`, `${overview.roundSize} questions per round, scheduled from recent performance.`, `Mỗi vòng ${overview.roundSize} câu, hệ thống tự điều phối theo kết quả gần đây.`)}</p>
            <div className="special-hero-actions">
              <div className="adaptive-language-choice" aria-label={adaptiveText(locale, '题目语言', 'Question language', 'Ngôn ngữ câu hỏi')}>
                <strong>{adaptiveText(locale, '题目语言', 'Question language', 'Ngôn ngữ câu hỏi')}</strong>
                <div>
                  <button type="button" className={questionLanguage === 'zh' ? 'active' : undefined} onClick={() => chooseQuestionLanguage('zh')} disabled={isStarting}>中文题</button>
                  <button type="button" className={questionLanguage === 'en' ? 'active' : undefined} onClick={() => chooseQuestionLanguage('en')} disabled={isStarting}>English questions</button>
                </div>
              </div>
              <button type="button" onClick={() => startRound()} disabled={isStarting}>{primaryActionLabel}</button>
              <GhostButton onClick={() => onNavigate(subjectPath(subject))}>{adaptiveText(locale, '回到科目页', 'Back to subject page', 'Quay lại trang môn học')}</GhostButton>
            </div>
          </div>
          <div className="special-guided-status-strip" aria-label={adaptiveText(locale, '科目训练状态', 'Subject training status', 'Trạng thái luyện theo môn')}>
            <span><strong>{currentRoundSize}</strong>{needsDiagnostic ? adaptiveText(locale, '诊断题量', 'diagnostic questions', 'câu chẩn đoán') : adaptiveText(locale, '本轮题量', 'questions this round', 'câu vòng này')}</span>
            <span><strong>{average === null ? adaptiveText(locale, '未诊断', 'Not diagnosed', 'Chưa chẩn đoán') : `${average}%`}</strong>{adaptiveText(locale, '掌握度', 'mastery', 'mức nắm vững')}</span>
            <span><strong>{questionLanguageLabel(questionLanguage, locale)}</strong>{adaptiveText(locale, '题目语言', 'Question language', 'Ngôn ngữ câu hỏi')}</span>
            <span><strong>{aiCreditSummary}</strong>AI Coach</span>
          </div>
        </div>
      </section>

      {error && <p className="admin-inline-danger">{error}</p>}
      <section className="special-mock-cta special-subject-mock-cta special-guided-next-card">
        <div>
          <p className="page-kicker">{needsDiagnostic ? adaptiveText(locale, '首次诊断', 'First Diagnostic', 'Chẩn đoán đầu tiên') : adaptiveText(locale, '系统推荐', 'System Recommendation', 'Đề xuất hệ thống')}</p>
          <h2>{guidanceTitle}</h2>
          <p>{guidanceBody}</p>
        </div>
        <button type="button" onClick={() => startRound()} disabled={isStarting}>{primaryActionLabel}</button>
      </section>

      {needsDiagnostic ? (
        <details className="special-topic-panel special-guided-details">
          <summary>{adaptiveText(locale, '查看诊断如何安排', 'See how the diagnostic is arranged', 'Xem cách sắp xếp bài chẩn đoán')}</summary>
          <div className="special-section-head">
            <div>
              <p className="page-kicker">{adaptiveText(locale, '诊断规则', 'Diagnostic Rules', 'Quy tắc chẩn đoán')}</p>
              <h2>{adaptiveText(locale, '第一次不按专题练，先测整体水平。', 'The first round tests overall level, not a manually chosen topic.', 'Lần đầu kiểm tra trình độ tổng thể, không luyện theo chuyên đề tự chọn.')}</h2>
            </div>
          </div>
          <div className="special-topic-grid">
            <article className="special-topic-card">
              <div><Icon name="lucide:shuffle" /><strong>{adaptiveText(locale, '混合考点', 'Mixed topics', 'Trộn chủ đề')}</strong></div>
              <p>{adaptiveText(locale, '题目会覆盖本科目的多个内部考点，避免只测到某一个专题。', 'Questions cover multiple internal topics in this subject, so the diagnostic is not limited to one area.', 'Câu hỏi bao phủ nhiều chủ đề nội bộ của môn này, tránh chỉ kiểm tra một chuyên đề.')}</p>
              <div className="special-topic-badges"><span>{adaptiveText(locale, `${subjectSummary.topicCount} 个考点池`, `${subjectSummary.topicCount} topic pools`, `${subjectSummary.topicCount} nhóm chủ đề`)}</span></div>
            </article>
            <article className="special-topic-card">
              <div><Icon name="lucide:gauge" /><strong>{adaptiveText(locale, '难度分布', 'Difficulty mix', 'Phân bố độ khó')}</strong></div>
              <p>{adaptiveText(locale, '基础、中等、较难和挑战题会按比例出现，用来估计初始水平。', 'Foundation, medium, harder, and challenge questions appear in proportion to estimate your starting level.', 'Câu cơ bản, trung bình, khó hơn và thử thách sẽ xuất hiện theo tỷ lệ để ước tính trình độ ban đầu.')}</p>
              <div className="special-topic-badges"><span>{adaptiveText(locale, '20 题更稳定', '20 questions is steadier', '20 câu ổn định hơn')}</span></div>
            </article>
            <article className="special-topic-card">
              <div><Icon name="lucide:route" /><strong>{adaptiveText(locale, '诊断后训练', 'Training after diagnostic', 'Luyện sau chẩn đoán')}</strong></div>
              <p>{adaptiveText(locale, '提交诊断后，本科目后续入口会自动切换为 5 题一轮的正式训练。', 'After submission, this subject switches to regular 5-question training rounds.', 'Sau khi nộp bài, môn này sẽ chuyển sang các vòng luyện chính thức 5 câu.')}</p>
              <div className="special-topic-badges"><span>{adaptiveText(locale, '只需一次', 'Only once', 'Chỉ cần một lần')}</span></div>
            </article>
          </div>
        </details>
      ) : (
      <details className="special-topic-panel special-guided-details">
        <summary>{adaptiveText(locale, '查看掌握度详情', 'View mastery details', 'Xem chi tiết mức nắm vững')}</summary>
        <div className="special-section-head">
          <div>
            <p className="page-kicker">{adaptiveText(locale, '掌握度地图', 'Mastery Map', 'Bản đồ nắm vững')}</p>
            <h2>{adaptiveText(locale, '主题仍然存在，但由系统负责调度。', 'Topics are still visible, but scheduling is handled by the system.', 'Chủ đề vẫn hiển thị, nhưng hệ thống phụ trách điều phối.')}</h2>
          </div>
        </div>
        <div className="special-topic-grid">
          {(weak.length ? weak : mastery.slice(0, 8)).map((item) => (
            <button
              key={item.topicId}
              type="button"
              className="special-topic-card special-topic-action-card"
              onClick={() => startRound(item.topicId)}
              disabled={isStarting}
            >
              <div>
                <Icon name="lucide:target" />
                <strong>{item.title}</strong>
              </div>
              <p>{item.module ?? item.code}</p>
              <div className="special-topic-badges">
                <span>{adaptiveText(locale, `掌握 ${Math.round(item.mastery * 100)}%`, `Mastery ${Math.round(item.mastery * 100)}%`, `Nắm vững ${Math.round(item.mastery * 100)}%`)}</span>
                <span>{adaptiveText(locale, `证据 ${Math.round(item.confidence * 100)}%`, `Evidence ${Math.round(item.confidence * 100)}%`, `Bằng chứng ${Math.round(item.confidence * 100)}%`)}</span>
              </div>
              <em>{isStarting ? adaptiveText(locale, '正在创建...', 'Creating...', 'Đang tạo...') : adaptiveText(locale, '优先练这个', 'Practice this first', 'Ưu tiên luyện mục này')}</em>
            </button>
          ))}
          {!mastery.length && (
            <article className="special-topic-card">
              <div><Icon name="lucide:radar" /><strong>{adaptiveText(locale, '暂无掌握度', 'No mastery yet', 'Chưa có dữ liệu nắm vững')}</strong></div>
              <p>{adaptiveText(locale, '完成第一轮后，这里会出现系统识别出的薄弱点。', 'After the first round, system-identified weak points appear here.', 'Sau vòng đầu tiên, các điểm yếu do hệ thống nhận diện sẽ xuất hiện ở đây.')}</p>
            </article>
          )}
        </div>
      </details>
      )}
    </div>
  );
}

export function AdaptiveRoundView({
  roundId,
  onNavigate,
  agentContextId,
  agentAssistanceCommand,
  onAgentQuestionContext,
  onAgentAssistance,
  onAgentAssistanceSettled,
  onAgentTeachingAsset,
  onOpenAgentHelp,
  onRoundUnavailable
}: {
  roundId: string;
  onNavigate: (path: string) => void;
  agentContextId?: string;
  agentAssistanceCommand?: AgentPracticeAssistanceCommand | null;
  onAgentQuestionContext?: (context: AgentPracticeQuestionContext | null) => void;
  onAgentAssistance?: (event: AgentPracticeAssistanceEvent) => void;
  onAgentAssistanceSettled?: () => void;
  onAgentTeachingAsset?: (event: AgentPracticeTeachingEvent) => void;
  onOpenAgentHelp?: () => void;
  onRoundUnavailable?: () => void;
}) {
  const [detail, setDetail] = useState<AdaptiveRoundDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [checks, setChecks] = useState<Record<string, AdaptivePracticeCheckResult>>({});
  const [checkingAnswers, setCheckingAnswers] = useState<Record<string, boolean>>({});
  const [coachInteractions, setCoachInteractions] = useState<Record<string, AdaptiveAIInteraction[]>>({});
  const [conceptReminders, setConceptReminders] = useState<Record<string, string>>({});
  const [assistanceAvailability, setAssistanceAvailability] = useState<Record<string, LearningAssistanceAvailability>>({});
  const [assistanceReportState, setAssistanceReportState] = useState<Record<string, 'sending' | 'sent'>>({});
  const [handwritingReviews, setHandwritingReviews] = useState<Record<string, { status: 'uploading' | 'analyzing' | 'completed' | 'failed'; fileName: string; result?: Record<string, any>; error?: string }>>({});
  const [coachFeedback, setCoachFeedback] = useState<Record<string, CoachFeedbackState>>({});
  const [entitlement, setEntitlement] = useState<AdaptiveAIEntitlement | null | undefined>(undefined);
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);
  const [coachLoading, setCoachLoading] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const roundVersionRef = useRef<number | null>(null);
  const autoSavePromiseRef = useRef<Promise<void> | null>(null);
  const pendingDraftRef = useRef<{ answers: Record<string, string>; timeSpent: Record<string, number>; currentQuestion: number } | null>(null);
  const timeSpentRef = useRef<Record<string, number>>({});
  const handwritingInputRef = useRef<HTMLInputElement | null>(null);
  const handwritingPickerPendingRef = useRef(false);
  const handwritingPickerFocusTimerRef = useRef<number | null>(null);
  const handledAssistanceCommandRef = useRef<string | null>(null);
  const hydratedAssistanceRoundRef = useRef<number | null>(null);
  const onNavigateRef = useRef(onNavigate);
  const onRoundUnavailableRef = useRef(onRoundUnavailable);
  const { locale } = useI18n();
  const isAgentLearningRound = Boolean(agentContextId);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onRoundUnavailableRef.current = onRoundUnavailable;
  }, [onNavigate, onRoundUnavailable]);

  useEffect(() => {
    timeSpentRef.current = timeSpent;
  }, [timeSpent]);

  useEffect(() => {
    const settleCancelledPicker = () => {
      if (!handwritingPickerPendingRef.current) return;
      if (handwritingPickerFocusTimerRef.current !== null) window.clearTimeout(handwritingPickerFocusTimerRef.current);
      handwritingPickerFocusTimerRef.current = window.setTimeout(() => {
        handwritingPickerFocusTimerRef.current = null;
        if (!handwritingPickerPendingRef.current || handwritingInputRef.current?.files?.length) return;
        handwritingPickerPendingRef.current = false;
        handwritingInputRef.current?.remove();
        handwritingInputRef.current = null;
        onAgentAssistanceSettled?.();
      }, 200);
    };
    window.addEventListener('focus', settleCancelledPicker);
    return () => {
      window.removeEventListener('focus', settleCancelledPicker);
      if (handwritingPickerFocusTimerRef.current !== null) window.clearTimeout(handwritingPickerFocusTimerRef.current);
      handwritingInputRef.current?.remove();
      handwritingInputRef.current = null;
    };
  }, [onAgentAssistanceSettled]);

  async function refreshEntitlement() {
    try {
      const result = await getAdaptiveAIEntitlement();
      setEntitlement(result);
      return result;
    } catch {
      setEntitlement(null);
      return null;
    }
  }

  async function buyCredits() {
    if (isBuyingCredits) return;
    setIsBuyingCredits(true);
    const success = await startAICreditCheckout(onNavigate, locale, setError);
    if (!success) setIsBuyingCredits(false);
  }

  useEffect(() => {
    let alive = true;
    void getAdaptivePracticeRound(roundId)
      .then((result) => {
        if (!alive) return;
        setDetail(result);
        const restoredAnswers = result.questions.reduce<Record<string, string>>((items, question) => {
          if (question.selectedAnswer) items[String(question.id)] = question.selectedAnswer;
          return items;
        }, { ...(result.round.answers ?? {}) });
        const restoredChecks = result.questions.reduce<Record<string, AdaptivePracticeCheckResult>>((items, question) => {
          if (!question.selectedAnswer || question.isCorrect === null || question.isCorrect === undefined || !question.correctAnswer) return items;
          items[String(question.id)] = {
            questionId: question.id,
            selected: question.selectedAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: question.isCorrect,
            explanation: question.explanation ?? '',
            knowledgeTags: question.knowledgeTags ?? []
          };
          return items;
        }, {});
        setAnswers(restoredAnswers);
        setChecks(restoredChecks);
        setTimeSpent(result.round.timeSpent ?? {});
        setCurrentIndex(Math.max(0, Math.min(result.questions.length - 1, (result.round.currentQuestion || 1) - 1)));
        roundVersionRef.current = result.round.version;
        if (result.round.submittedAt) onNavigateRef.current(`${adaptiveRoundReportPath(result.session.subject, result.round.id)}${agentReturnQuery()}`);
      })
      .catch((nextError) => {
        if (!alive) return;
        setError(friendlyPracticeError(nextError, adaptiveText(locale, '科目练习无法加载。', 'Subject practice could not be loaded.', 'Không thể tải luyện tập theo môn.'), locale));
        if (nextError instanceof ApiError && (nextError.status === 403 || nextError.status === 404)) {
          onRoundUnavailableRef.current?.();
        }
      });
    if (!isAgentLearningRound) {
      void getAdaptiveAIEntitlement()
        .then((result) => { if (alive) setEntitlement(result); })
        .catch(() => { if (alive) setEntitlement(null); });
    }
    return () => { alive = false; };
  }, [isAgentLearningRound, roundId, locale]);

  const currentQuestion = detail?.questions[currentIndex] ?? null;
  const currentQuestionLanguage = normalizeQuestionLanguage(detail?.session.questionLanguage, locale);
  const currentCoachLanguage = coachResponseLanguage(locale);
  async function refreshLearningAssistance(question = currentQuestion) {
    if (!detail || !question || !isAgentLearningRound) return null;
    const result = await getAgentLearningAssistance(detail.round.id, question.id);
    const key = String(question.id);
    setAssistanceAvailability((current) => ({ ...current, [key]: result }));
    const restoredConcept = result.history?.filter((item) => item.action === 'recall_concept').slice(-1)[0];
    if (restoredConcept) {
      setConceptReminders((current) => ({ ...current, [key]: restoredConcept.content }));
      onAgentAssistance?.({
        id: restoredConcept.toolCallId,
        roundId: detail.round.id,
        questionId: question.id,
        questionNumber: Math.max(1, detail.questions.findIndex((item) => item.id === question.id) + 1),
        action: 'recall_concept',
        content: restoredConcept.content,
        createdAt: restoredConcept.createdAt,
        generatedByAI: restoredConcept.generatedByAI
      });
    }
    const restoredHint = result.history?.filter((item) => item.action === 'next_step_hint').slice(-1)[0];
    if (restoredHint) {
      setCoachInteractions((current) => {
        if ((current[key] ?? []).some((item) => item.type === 'hint')) return current;
        const syntheticId = -Math.max(1, result.history?.findIndex((item) => item.toolCallId === restoredHint.toolCallId) ?? 1) - 1;
        return { ...current, [key]: [...(current[key] ?? []), { id: syntheticId, type: 'hint', provider: null, model: null, output: restoredHint.content, createdAt: restoredHint.createdAt }] };
      });
      onAgentAssistance?.({
        id: restoredHint.toolCallId,
        roundId: detail.round.id,
        questionId: question.id,
        questionNumber: Math.max(1, detail.questions.findIndex((item) => item.id === question.id) + 1),
        action: 'next_step_hint',
        content: restoredHint.content,
        createdAt: restoredHint.createdAt,
        generatedByAI: restoredHint.generatedByAI
      });
    }
    return result;
  }

  async function reviewHandwrittenWork(file: File) {
    if (!detail || !currentQuestion || !isAgentLearningRound || isInterventionVerification) return;
    const key = String(currentQuestion.id);
    setHandwritingReviews((current) => ({ ...current, [key]: { status: 'uploading', fileName: file.name } }));
    try {
      const attachment = await uploadAgentPracticeQuestionAttachment(detail.round.id, currentQuestion.id, file);
      if (attachment.status !== 'ready') throw new Error(attachment.error?.message || adaptiveText(locale, '图片尚未准备好。', 'The image is not ready.', 'Ảnh chưa sẵn sàng.'));
      const queued = await analyzeAgentAttachment(attachment.id, {
        clientRequestId: agentRequestId(),
        mode: 'handwritten_solution_review',
        roundId: detail.round.id,
        questionId: currentQuestion.id,
        responseDepth: 'guided',
        language: locale === 'zh-CN' ? 'zh' : locale === 'vi' ? 'vi' : 'en'
      });
      setHandwritingReviews((current) => ({ ...current, [key]: { status: 'analyzing', fileName: file.name } }));
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const analysis = attempt ? await getAgentAttachmentAnalysis(queued.id) : queued;
        if (analysis.status === 'completed') {
          setHandwritingReviews((current) => ({ ...current, [key]: { status: 'completed', fileName: file.name, result: analysis.result || {} } }));
          const result = analysis.result || {};
          const firstError = result.firstError && typeof result.firstError === 'object' ? result.firstError as Record<string, unknown> : null;
          const feedback = result.feedback && typeof result.feedback === 'object' ? result.feedback as Record<string, unknown> : null;
          const content = [
            String(result.summary || ''),
            firstError?.title ? `${String(firstError.title)}：${String(firstError.explanation || '')}` : '',
            feedback?.nextHint ? `${adaptiveText(locale, '下一步线索', 'Next hint', 'Gợi ý tiếp theo')}：${String(feedback.nextHint)}` : ''
          ].filter(Boolean).join('\n\n');
          onAgentAssistance?.({
            id: `handwriting:${analysis.id}`,
            roundId: detail.round.id,
            questionId: currentQuestion.id,
            questionNumber: currentIndex + 1,
            action: 'check_work',
            content,
            createdAt: new Date().toISOString(),
            generatedByAI: true
          });
          await refreshLearningAssistance(currentQuestion);
          return;
        }
        if (analysis.status === 'failed' || analysis.status === 'timeout') throw new Error(analysis.error?.message || adaptiveText(locale, '手写过程分析失败。', 'Handwriting review failed.', 'Phân tích bài viết tay thất bại.'));
        await waitFor(1500);
      }
      throw new Error(adaptiveText(locale, '分析仍在进行，请稍后重试。', 'Analysis is still running. Try again shortly.', 'Phân tích vẫn đang chạy. Vui lòng thử lại sau.'));
    } catch (nextError) {
      const errorMessage = nextError instanceof Error ? nextError.message : adaptiveText(locale, '手写过程分析失败。', 'Handwriting review failed.', 'Phân tích bài viết tay thất bại.');
      setHandwritingReviews((current) => ({ ...current, [key]: {
        status: 'failed', fileName: file.name,
        error: errorMessage
      } }));
      onAgentAssistance?.({ id: `handwriting-error:${detail.round.id}:${currentQuestion.id}:${Date.now()}`, roundId: detail.round.id, questionId: currentQuestion.id, questionNumber: currentIndex + 1, action: 'check_work', content: errorMessage, createdAt: new Date().toISOString(), generatedByAI: false, status: 'failed' });
    } finally {
      onAgentAssistanceSettled?.();
    }
  }

  function openHandwritingPicker() {
    handwritingInputRef.current?.remove();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.className = 'agent-handwriting-input';
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.display = 'none';
    const finish = (file?: File) => {
      if (handwritingInputRef.current !== input) return;
      handwritingPickerPendingRef.current = false;
      handwritingInputRef.current = null;
      input.remove();
      if (file) void reviewHandwrittenWork(file);
      else onAgentAssistanceSettled?.();
    };
    input.addEventListener('change', () => finish(input.files?.[0]), { once: true });
    input.addEventListener('cancel', () => finish(), { once: true });
    document.body.appendChild(input);
    handwritingInputRef.current = input;
    handwritingPickerPendingRef.current = true;
    try {
      input.click();
    } catch {
      finish();
    }
  }

  useEffect(() => {
    if (!isAgentLearningRound || !detail || hydratedAssistanceRoundRef.current === detail.round.id) return;
    hydratedAssistanceRoundRef.current = detail.round.id;
    void Promise.all(detail.questions.map((question) => refreshLearningAssistance(question).catch(() => null)));
  }, [detail?.round.id, isAgentLearningRound]);

  useEffect(() => {
    if (!isAgentLearningRound || !detail || !currentQuestion) return;
    const currentCheck = checks[String(currentQuestion.id)];
    onAgentQuestionContext?.({
      roundId: detail.round.id,
      questionId: currentQuestion.id,
      questionSource: currentQuestion.questionSource === 'csca_question' ? 'csca_question' : 'special_practice',
      questionNumber: currentIndex + 1,
      questionCount: detail.questions.length,
      subject: detail.session.subject,
      topicTitle: adaptiveTopicLabel(currentQuestion, locale),
      prompt: currentQuestion.prompt,
      options: currentQuestion.options.map((option) => ({ id: option.id, text: option.text })),
      selectedAnswer: currentCheck?.selected || answers[String(currentQuestion.id)] || undefined,
      answered: Boolean(currentCheck || answers[String(currentQuestion.id)]),
      correctAnswer: currentCheck?.correctAnswer,
      isCorrect: currentCheck?.isCorrect,
      explanation: currentCheck?.explanation,
      knowledgeTags: currentCheck?.knowledgeTags,
      availableActions: assistanceAvailability[String(currentQuestion.id)]?.availableActions ?? []
    });
  }, [answers, assistanceAvailability, currentIndex, currentQuestion, detail, isAgentLearningRound, locale, onAgentQuestionContext]);

  useEffect(() => {
    if (!agentAssistanceCommand || handledAssistanceCommandRef.current === agentAssistanceCommand.id || !detail || !currentQuestion) return;
    if (adaptiveRoundMode(detail.round) === 'intervention_verification') return;
    handledAssistanceCommandRef.current = agentAssistanceCommand.id;
    if (agentAssistanceCommand.action === 'recall_concept') void recallConcept();
    else if (agentAssistanceCommand.action === 'next_step_hint') void askCoach('hint');
    else openHandwritingPicker();
  }, [agentAssistanceCommand, currentQuestion, detail]);

  useEffect(() => {
    if (!isAgentLearningRound || !detail || !currentQuestion || checks[String(currentQuestion.id)]?.isCorrect !== false) return;
    let alive = true;
    void getAgentTeachingAssetForQuestion(detail.round.id, currentQuestion.id, locale)
      .then((result) => {
        if (alive && result.item) onAgentTeachingAsset?.({
          roundId: detail.round.id,
          questionId: currentQuestion.id,
          questionNumber: currentIndex + 1,
          asset: result.item
        });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [detail?.round.id, currentQuestion?.id, currentIndex, checks, isAgentLearningRound, locale, onAgentTeachingAsset]);

  useEffect(() => {
    if (!detail || !currentQuestion || isPaused || isFinishing) return;
    const timer = window.setInterval(() => {
      setTimeSpent((current) => ({ ...current, [String(currentQuestion.id)]: (current[String(currentQuestion.id)] ?? 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [detail, currentQuestion, isPaused, isFinishing]);

  function saveDraft() {
    if (!detail || isFinishing) return null;
    pendingDraftRef.current = {
      answers: { ...answers },
      timeSpent: { ...timeSpentRef.current },
      currentQuestion: currentIndex + 1
    };
    if (autoSavePromiseRef.current) return autoSavePromiseRef.current;
    const drainDrafts = async () => {
      while (pendingDraftRef.current) {
        const draft = pendingDraftRef.current;
        pendingDraftRef.current = null;
        const nextRound = await patchAdaptivePracticeRound(detail.round.id, {
          ...draft,
          expectedVersion: roundVersionRef.current ?? undefined
        });
        roundVersionRef.current = nextRound.version;
      }
    };
    const savePromise = drainDrafts()
      .catch((nextError) => {
        setError(friendlyPracticeError(nextError, adaptiveText(locale, '本轮保存失败，请检查网络后继续。', 'Saving this round failed. Check your connection before continuing.', 'Lưu vòng này thất bại. Hãy kiểm tra mạng trước khi tiếp tục.'), locale));
      })
      .finally(() => {
        if (autoSavePromiseRef.current === savePromise) autoSavePromiseRef.current = null;
      });
    autoSavePromiseRef.current = savePromise;
    return savePromise;
  }

  useEffect(() => {
    if (!detail || isFinishing) return;
    const timer = window.setTimeout(() => {
      saveDraft();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, currentIndex, detail, isFinishing]);

  useEffect(() => {
    if (!detail || isFinishing) return;
    const timer = window.setInterval(() => {
      saveDraft();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [answers, currentIndex, detail, isFinishing]);

  async function choose(question: AdaptiveQuestion, selected: string) {
    const questionKey = String(question.id);
    if (!detail || isPaused || isFinishing || checkingAnswers[questionKey] || checks[questionKey]) return;
    setError(null);
    setAnswers((current) => ({ ...current, [questionKey]: selected }));
    if (adaptiveRoundMode(detail.round) === 'intervention_verification') return;
    setCheckingAnswers((current) => ({ ...current, [questionKey]: true }));
    try {
      const checked = await checkAdaptivePracticeAnswer(detail.round.id, {
        questionId: question.id,
        questionSource: question.questionSource === 'csca_question' ? 'csca_question' : 'special_practice',
        selected,
        language: currentCoachLanguage,
        questionLanguage: currentQuestionLanguage
      });
      setChecks((current) => ({ ...current, [questionKey]: checked }));
      const questionIndex = detail.questions.findIndex((item) => item.id === question.id);
      onAgentQuestionContext?.({
        roundId: detail.round.id,
        questionId: question.id,
        questionSource: question.questionSource === 'csca_question' ? 'csca_question' : 'special_practice',
        questionNumber: Math.max(1, questionIndex + 1),
        questionCount: detail.questions.length,
        subject: detail.session.subject,
        topicTitle: adaptiveTopicLabel(question, locale),
        prompt: question.prompt,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
        selectedAnswer: checked.selected,
        answered: true,
        correctAnswer: checked.correctAnswer,
        isCorrect: checked.isCorrect,
        explanation: checked.explanation,
        knowledgeTags: checked.knowledgeTags,
        availableActions: assistanceAvailability[questionKey]?.availableActions ?? []
      });
    } catch (nextError) {
      setAnswers((current) => {
        const next = { ...current };
        delete next[questionKey];
        return next;
      });
      setError(friendlyPracticeError(nextError, adaptiveText(locale, ADAPTIVE_COPY.checkFailed, 'Answer checking failed. No AI credits were consumed; please try again.', 'Chấm đáp án thất bại. Chưa tiêu hao lượt AI; vui lòng thử lại.'), locale));
    } finally {
      setCheckingAnswers((current) => ({ ...current, [questionKey]: false }));
    }
  }

  async function finish() {
    if (!detail || isFinishing) return;
    setIsFinishing(true);
    setError(null);
    try {
      await autoSavePromiseRef.current;
      const saved = await patchAdaptivePracticeRound(detail.round.id, { answers, timeSpent, currentQuestion: currentIndex + 1, expectedVersion: roundVersionRef.current ?? undefined });
      roundVersionRef.current = saved.version;
      const report = await submitAdaptivePracticeRound(detail.round.id, currentCoachLanguage);
      onNavigate(`${adaptiveRoundReportPath(detail.session.subject, report.round.id)}${agentReturnQuery()}`);
    } catch (nextError) {
      setError(friendlyPracticeError(nextError, adaptiveText(locale, '提交本轮失败，请稍后再试。', 'Submitting this round failed. Please try again later.', 'Nộp vòng này thất bại, vui lòng thử lại sau.'), locale));
      setIsFinishing(false);
    }
  }

  async function exitRound() {
    if (!detail || isExiting) return;
    const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const artifactId = params?.get('agentArtifactId');
    if (artifactId && !window.confirm(adaptiveText(locale, '退出会将这项 Agent 任务标记为已放弃，确定退出吗？', 'Exit and mark this Agent task as abandoned?', 'Thoát và đánh dấu nhiệm vụ Agent này là đã bỏ?'))) return;
    setIsExiting(true);
    try {
      if (artifactId) {
        await abandonAgentTask(artifactId, globalThis.crypto?.randomUUID?.() ?? `agent-abandon-${roundId}-${Date.now()}`);
      }
      onNavigate(subjectPath(detail.session.subject));
    } catch (nextError) {
      setError(friendlyPracticeError(nextError, adaptiveText(locale, '暂时无法退出这项任务，请重试。', 'Could not exit this task. Please retry.', 'Tạm thời chưa thể thoát nhiệm vụ này.'), locale));
      setIsExiting(false);
    }
  }

  async function askCoach(type: 'hint' | 'explain') {
    if (!detail || !currentQuestion || coachLoading || isFinishing) return;
    const key = String(currentQuestion.id);
    if (type === 'hint' && answers[key]) return;
    setCoachLoading(type);
    setError(null);
    try {
      let assistanceResult: Awaited<ReturnType<typeof requestAgentLearningAssistance>> | null = null;
      let interaction: AdaptiveAIInteraction;
      if (type === 'hint' && isAgentLearningRound) {
        assistanceResult = await requestAgentLearningAssistance(detail.round.id, currentQuestion.id, {
          clientRequestId: globalThis.crypto?.randomUUID?.() ?? `agent-hint-${detail.round.id}-${currentQuestion.id}-${Date.now()}`,
          action: 'next_step_hint', language: currentCoachLanguage, questionLanguage: currentQuestionLanguage
        });
        interaction = assistanceResult.interaction ?? { id: -Date.now(), type: 'hint', provider: null, model: null, output: assistanceResult.content, createdAt: assistanceResult.exposure.recordedAt };
      } else if (type === 'hint') {
        interaction = await getAdaptiveAIHint({ roundId: detail.round.id, questionId: currentQuestion.id, language: currentCoachLanguage, questionLanguage: currentQuestionLanguage });
      } else {
        interaction = await getAdaptiveAIExplanation({ roundId: detail.round.id, questionId: currentQuestion.id, selected: answers[key], language: currentCoachLanguage, questionLanguage: currentQuestionLanguage });
      }
      setCoachInteractions((current) => {
        const existing = current[key] ?? [];
        const nextItems = existing.filter((item) => item.type !== interaction.type);
        return { ...current, [key]: [...nextItems, interaction] };
      });
      if (isAgentLearningRound && assistanceResult) {
        onAgentAssistance?.({
          id: assistanceResult.toolCallId,
          roundId: detail.round.id,
          questionId: currentQuestion.id,
          questionNumber: currentIndex + 1,
          action: 'next_step_hint',
          content: assistanceResult.content,
          createdAt: assistanceResult.exposure.recordedAt,
          generatedByAI: assistanceResult.generatedByAI
        });
        await refreshLearningAssistance();
      }
      void refreshEntitlement();
    } catch (nextError) {
      const errorMessage = isQuotaError(nextError) ? adaptiveCopy(locale).aiCreditQuotaError : friendlyPracticeError(nextError, adaptiveText(locale, 'AI Coach 暂时不可用，已保留标准解析。', 'AI Coach is temporarily unavailable; standard explanation is still available.', 'AI Coach tạm thời chưa khả dụng; phần giải thích tiêu chuẩn vẫn được giữ lại.'), locale);
      setError(errorMessage);
      if (isAgentLearningRound && type === 'hint') onAgentAssistance?.({ id: `hint-error:${detail.round.id}:${currentQuestion.id}:${Date.now()}`, roundId: detail.round.id, questionId: currentQuestion.id, questionNumber: currentIndex + 1, action: 'next_step_hint', content: errorMessage, createdAt: new Date().toISOString(), generatedByAI: false, status: 'failed' });
    } finally {
      setCoachLoading(null);
      if (isAgentLearningRound) onAgentAssistanceSettled?.();
    }
  }

  async function recallConcept() {
    if (!detail || !currentQuestion || coachLoading || isFinishing) return;
    const key = String(currentQuestion.id);
    setCoachLoading('concept');
    setError(null);
    try {
      const result = await requestAgentLearningAssistance(detail.round.id, currentQuestion.id, {
        clientRequestId: globalThis.crypto?.randomUUID?.() ?? `agent-concept-${detail.round.id}-${currentQuestion.id}-${Date.now()}`,
        action: 'recall_concept', language: currentCoachLanguage, questionLanguage: currentQuestionLanguage
      });
      setConceptReminders((current) => ({ ...current, [key]: result.content }));
      onAgentAssistance?.({
        id: result.toolCallId,
        roundId: detail.round.id,
        questionId: currentQuestion.id,
        questionNumber: currentIndex + 1,
        action: 'recall_concept',
        content: result.content,
        createdAt: result.exposure.recordedAt,
        generatedByAI: result.generatedByAI
      });
      await refreshLearningAssistance(currentQuestion);
    } catch (nextError) {
      const errorMessage = friendlyPracticeError(nextError, adaptiveText(locale, '知识点提醒暂时不可用。', 'Concept recall is temporarily unavailable.', 'Nhắc lại khái niệm tạm thời chưa khả dụng.'), locale);
      setError(errorMessage);
      onAgentAssistance?.({ id: `concept-error:${detail.round.id}:${currentQuestion.id}:${Date.now()}`, roundId: detail.round.id, questionId: currentQuestion.id, questionNumber: currentIndex + 1, action: 'recall_concept', content: errorMessage, createdAt: new Date().toISOString(), generatedByAI: false, status: 'failed' });
    } finally {
      setCoachLoading(null);
      onAgentAssistanceSettled?.();
    }
  }

  async function reportLearningContentIssue() {
    if (!detail || !currentQuestion || !isAgentLearningRound) return;
    const key = String(currentQuestion.id);
    if (assistanceReportState[key]) return;
    setAssistanceReportState((current) => ({ ...current, [key]: 'sending' }));
    try {
      await reportAgentLearningContentIssue(detail.round.id, currentQuestion.id, {
        clientRequestId: globalThis.crypto?.randomUUID?.() ?? `agent-content-report-${detail.round.id}-${currentQuestion.id}-${Date.now()}`,
        reason: 'unclear'
      });
      setAssistanceReportState((current) => ({ ...current, [key]: 'sent' }));
    } catch (nextError) {
      setAssistanceReportState((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setError(friendlyPracticeError(nextError, adaptiveText(locale, '反馈提交失败，请重试。', 'Feedback could not be submitted. Please retry.', 'Không thể gửi phản hồi, vui lòng thử lại.'), locale));
    }
  }

  async function rateCoach(interaction: AdaptiveAIInteraction, rating: number) {
    const current = coachFeedback[interaction.id];
    if (current?.status === 'submitting' || current?.status === 'submitted') return;
    setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: 'submitting', rating } }));
    try {
      await submitAdaptiveAIFeedback(interaction.id, { rating });
      setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: rating <= 2 ? 'awaiting_reason' : 'submitted', rating } }));
    } catch {
      setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: 'error', rating } }));
    }
  }

  async function submitCoachFeedbackReason(interaction: AdaptiveAIInteraction, reasonCode: AdaptiveAIFeedbackReasonCode) {
    const current = coachFeedback[interaction.id];
    if (current?.status === 'submitting' || current?.status === 'submitted') return;
    setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: 'submitting', rating: 2, reasonCode } }));
    try {
      await submitAdaptiveAIFeedback(interaction.id, { rating: 2, reasonCode });
      setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: 'submitted', rating: 2, reasonCode } }));
    } catch {
      setCoachFeedback((items) => ({ ...items, [interaction.id]: { status: 'error', rating: 2, reasonCode } }));
    }
  }

  function renderCoachFeedback(interaction: AdaptiveAIInteraction, kind: CoachFeedbackKind = 'explanation') {
    const state = coachFeedback[interaction.id];
    const isSubmitting = state?.status === 'submitting';
    const isSubmitted = state?.status === 'submitted';
    const isAwaitingReason = state?.status === 'awaiting_reason';
    const selectedRating = state?.rating;
    const reasons = coachFeedbackReasons(locale, kind);
    return (
      <div className="special-ai-feedback-block">
        <div className="special-ai-feedback" aria-label={adaptiveText(locale, 'AI Coach 反馈', 'AI Coach feedback', 'Phản hồi AI Coach')}>
          <GhostButton
            className={`special-ai-feedback-button is-positive${(isSubmitted || isAwaitingReason) && selectedRating === 5 ? ' selected' : ''}`}
            onClick={() => rateCoach(interaction, 5)}
            disabled={isSubmitting || isSubmitted || isAwaitingReason}
            aria-label={adaptiveText(locale, '这条 AI 解析有用', 'This AI explanation is useful', 'Phần giải thích AI này hữu ích')}
            title={adaptiveText(locale, '有用', 'Useful', 'Hữu ích')}
          >
            <Icon name="lucide:check-circle-2" color="currentColor" />
            <span>{adaptiveText(locale, '有帮助', 'Helpful', 'Hữu ích')}</span>
          </GhostButton>
          <GhostButton
            className={`special-ai-feedback-button is-negative${(isSubmitted || isAwaitingReason) && selectedRating === 2 ? ' selected' : ''}`}
            onClick={() => rateCoach(interaction, 2)}
            disabled={isSubmitting || isSubmitted || isAwaitingReason}
            aria-label={adaptiveText(locale, '这条 AI 解析没用', 'This AI explanation is not useful', 'Phần giải thích AI này chưa hữu ích')}
            title={adaptiveText(locale, '没用', 'Not useful', 'Chưa hữu ích')}
          >
            <Icon name="lucide:circle-alert" color="currentColor" />
            <span>{adaptiveText(locale, '需改进', 'Needs work', 'Cần sửa')}</span>
          </GhostButton>
        </div>
        {isAwaitingReason && (
          <div className="special-ai-feedback-reasons" aria-label={coachFeedbackReasonTitle(locale)}>
            <p>{coachFeedbackReasonTitle(locale)}</p>
            <div>
              {reasons.map((reason) => (
                <button
                  key={reason.code}
                  type="button"
                  className="special-ai-feedback-reason"
                  onClick={() => submitCoachFeedbackReason(interaction, reason.code)}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isSubmitting && <p className="special-ai-feedback-note">{adaptiveText(locale, '正在提交反馈...', 'Submitting feedback...', 'Đang gửi phản hồi...')}</p>}
        {isSubmitted && <p className="special-ai-feedback-note success">{coachFeedbackSubmittedText(locale, state.reasonCode)}</p>}
        {state?.status === 'error' && <p className="special-ai-feedback-note error">{adaptiveText(locale, '反馈没发出去，请再点一次。', 'Feedback was not sent. Please try once more.', 'Chưa gửi được phản hồi, vui lòng bấm lại.')}</p>}
      </div>
    );
  }

  if (error && !detail) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaSubjects)} />;
  if (!detail || !currentQuestion) return <LoadingState label={adaptiveText(locale, '正在进入科目练习', 'Entering subject practice', 'Đang vào luyện theo môn')} />;

  const currentQuestionKey = String(currentQuestion.id);
  const currentCheck = checks[currentQuestionKey];
  const selectedAnswer = answers[currentQuestionKey];
  const isCheckingCurrentAnswer = Boolean(checkingAnswers[currentQuestionKey]);
  const currentCoachItems = coachInteractions[currentQuestionKey] ?? [];
  const currentHint = currentCoachItems.find((item) => item.type === 'hint');
  const currentAssistance = assistanceAvailability[currentQuestionKey];
  const currentHandwritingReview = handwritingReviews[currentQuestionKey];
  const assistanceAction = (action: 'recall_concept' | 'next_step_hint' | 'show_full_solution') => currentAssistance?.availableActions.find((item) => item.action === action);
  const recommendedAssistanceLabel = currentAssistance?.recommendedAction === 'recall_concept'
    ? adaptiveText(locale, '先回忆知识点', 'Recall the concept first', 'Nhắc lại khái niệm trước')
    : currentAssistance?.recommendedAction === 'next_step_hint'
      ? adaptiveText(locale, '尝试下一步提示', 'Try a next-step hint', 'Thử gợi ý bước tiếp theo')
      : currentAssistance?.recommendedAction === 'show_full_solution'
        ? adaptiveText(locale, '现在可以查看解析', 'The solution is now available', 'Bây giờ có thể xem lời giải')
        : adaptiveText(locale, '先独立作答', 'Try independently first', 'Hãy tự làm trước');
  const assistanceBillingLabel = currentAssistance?.billing?.unlimited
    ? adaptiveText(locale, 'AI 辅助不限次数', 'Unlimited AI assistance', 'Hỗ trợ AI không giới hạn')
    : currentAssistance?.billing?.enabled
      ? adaptiveText(locale, `AI 生成可能消耗额度 · 剩余 ${currentAssistance.billing.balanceUnits}`, `AI generation may use a credit · ${currentAssistance.billing.balanceUnits} left`, `Tạo bằng AI có thể dùng lượt · còn ${currentAssistance.billing.balanceUnits}`)
      : adaptiveText(locale, '知识点提醒与标准解析不消耗 AI 额度', 'Concept recall and standard solutions do not use AI credits', 'Nhắc khái niệm và lời giải chuẩn không dùng lượt AI');
  const progress = Math.round(((currentIndex + 1) / detail.questions.length) * 100);
  const currentSeconds = currentQuestion ? (timeSpent[currentQuestionKey] ?? 0) : 0;
  const totalSeconds = Object.values(timeSpent).reduce((sum, value) => sum + value, 0);
  const correctCount = Object.values(checks).filter((item) => item.isCorrect).length;
  const wrongCount = Object.values(checks).filter((item) => !item.isCorrect).length;
  const answeredCount = Object.keys(answers).length;
  const aiCreditLabel = entitlement === undefined ? adaptiveText(locale, 'AI 额度读取中', 'Loading AI credits', 'Đang tải lượt AI') : entitlement === null ? adaptiveText(locale, 'AI 额度暂不可读', 'AI credits unavailable', 'Tạm chưa đọc được lượt AI') : entitlement.unlimited ? adaptiveText(locale, 'AI 不限', 'AI unlimited', 'AI không giới hạn') : adaptiveText(locale, `AI ${entitlement.balanceUnits} 次`, `AI ${entitlement.balanceUnits} credits`, `AI ${entitlement.balanceUnits} lượt`);
  const aiCreditEmpty = entitlement ? entitlement.enabled && !entitlement.unlimited && entitlement.balanceUnits <= 0 : false;
  const copy = adaptiveCopy(locale);
  const currentTopicTitle = adaptiveTopicLabel(currentQuestion, locale);
  const roundMode = adaptiveRoundMode(detail.round);
  const isVerificationRound = roundMode === 'verification';
  const isInterventionVerification = roundMode === 'intervention_verification';
  const interventionVerificationPhase = isInterventionVerification ? adaptiveRoundInterventionPhase(detail.round) : 'immediate';
  const verificationFocusTitle = isVerificationRound ? adaptiveRoundFocusTitle(detail.round, locale) : '';

  return (
    <div className="special-taking-shell">
      <header className="special-taking-bar">
        <GhostButton onClick={() => { void exitRound(); }} disabled={isExiting}>{isExiting ? adaptiveText(locale, '正在退出…', 'Exiting…', 'Đang thoát…') : copy.exit}</GhostButton>
        <div>
          <span>{copy.questionProgress(currentIndex + 1, detail.questions.length)}</span>
          <b>{subjectLabel(detail.session.subject, locale)} / {currentTopicTitle}</b>
          <i><em style={{ width: `${progress}%` }} /></i>
        </div>
        <div className="special-taking-status special-taking-status-compact">
          {isVerificationRound && <span>{verificationFocusTitle ? adaptiveText(locale, `错因验证：${verificationFocusTitle}`, `Mistake check: ${verificationFocusTitle}`, `Xác minh lỗi: ${verificationFocusTitle}`) : adaptiveText(locale, '错因验证', 'Mistake check', 'Xác minh lỗi')}</span>}
          {isInterventionVerification && <span>{interventionVerificationPhase === 'retention'
            ? adaptiveText(locale, '延迟保持验证', 'Delayed retention check', 'Kiểm tra duy trì có độ trễ')
            : interventionVerificationPhase === 'transfer'
              ? adaptiveText(locale, '跨题型迁移验证', 'Cross-structure transfer check', 'Kiểm tra chuyển giao khác cấu trúc')
              : adaptiveText(locale, '讲解后独立验证', 'Independent post-lesson check', 'Xác minh độc lập sau bài học')}</span>}
          <strong>{copy.answeredProgress(answeredCount, detail.questions.length)}</strong>
          <span className="special-taking-question-time">{copy.currentQuestionTime(formatSeconds(currentSeconds))}</span>
          {!isInterventionVerification && !isAgentLearningRound && <span className={aiCreditEmpty ? 'special-ai-credit-chip empty' : 'special-ai-credit-chip'}>{aiCreditLabel}</span>}
          <button type="button" className={isPaused ? 'active' : ''} onClick={() => setIsPaused((value) => !value)} disabled={isFinishing}>{isPaused ? copy.resume : copy.pause}</button>
          <details className="special-taking-status-more">
            <summary>{adaptiveText(locale, '状态', 'Status', 'Trạng thái')}</summary>
            <div>
              {!isInterventionVerification && <span>{copy.correctCount(correctCount)}</span>}
              {!isInterventionVerification && <span>{copy.wrongCount(wrongCount)}</span>}
              <span>{adaptiveText(locale, `总用时 ${formatSeconds(totalSeconds)}`, `Total time ${formatSeconds(totalSeconds)}`, `Tổng thời gian ${formatSeconds(totalSeconds)}`)}</span>
            </div>
          </details>
        </div>
      </header>
      <main className="special-taking-main">
        {error && <p className="admin-inline-danger">{error}</p>}
        <details className="special-question-nav" aria-label={copy.questionNavigation}>
          <summary className="special-question-nav-head">
            <strong>{copy.questionNavigation}</strong>
            <span>{isInterventionVerification
              ? copy.answeredProgress(answeredCount, detail.questions.length)
              : adaptiveText(locale, `${ADAPTIVE_COPY.answeredProgress(answeredCount, detail.questions.length)} · 正确 ${correctCount} · 错误 ${wrongCount}`, `${answeredCount}/${detail.questions.length} answered · Correct ${correctCount} · Wrong ${wrongCount}`, `${answeredCount}/${detail.questions.length} đã trả lời · Đúng ${correctCount} · Sai ${wrongCount}`)}</span>
          </summary>
          <div className="special-question-nav-grid">
            {detail.questions.map((question, index) => {
              const check = checks[String(question.id)];
              const answered = Boolean(answers[String(question.id)]);
              const className = [
                index === currentIndex ? 'current' : '',
                check?.isCorrect ? 'correct' : '',
                check && !check.isCorrect ? 'wrong' : '',
                answered && !check ? 'answered' : ''
              ].filter(Boolean).join(' ');
              return <button key={question.id} type="button" className={className} onClick={() => setCurrentIndex(index)} disabled={isFinishing}>{index + 1}</button>;
            })}
          </div>
        </details>
        <section className="special-question-card">
          <div className="special-question-head">
            <div>
              <p className="page-kicker">Q{currentIndex + 1} / {currentQuestion.difficulty} / {currentTopicTitle}</p>
              {SHOW_AI_GENERATED_QUESTION_BADGE && currentQuestion.generatedQuestion?.badgeLabel && (
                <span className="adaptive-generated-question-badge">{currentQuestion.generatedQuestion.badgeLabel}</span>
              )}
              <h1><MathContent text={currentQuestion.prompt} /></h1>
            </div>
            <span className="special-question-timer">{formatSeconds(currentSeconds)}</span>
          </div>
          <div className="special-answer-options">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              const isRight = currentCheck?.correctAnswer === option.id;
              const isWrong = currentCheck && isSelected && !currentCheck.isCorrect;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={[isSelected ? 'selected' : '', isRight ? 'right' : '', isWrong ? 'wrong' : ''].filter(Boolean).join(' ')}
                  onClick={() => choose(currentQuestion, option.id)}
                  disabled={isPaused || isFinishing || Boolean(currentCheck) || isCheckingCurrentAnswer}
                >
                  <b>{option.id}</b>
                  <span><MathContent text={option.text} /></span>
                  {isRight && <em>{copy.correct}</em>}
                  {isWrong && <em>{copy.yourAnswer}</em>}
                  {isCheckingCurrentAnswer && isSelected && <em>{adaptiveText(locale, '判题中...', 'Checking...', 'Đang chấm...')}</em>}
                </button>
              );
            })}
          </div>
          {currentCheck && (
            <div className={currentCheck.isCorrect ? 'special-answer-result correct' : 'special-answer-result wrong'}>
              <div>
                <strong>{currentCheck.isCorrect ? copy.answerCorrect : copy.answerIncorrect(currentCheck.correctAnswer)}</strong>
                <span>{copy.answerResultMeta(accuracyLabel(correctCount, Object.keys(checks).length), formatSeconds(currentSeconds))}</span>
              </div>
            </div>
          )}
          {!isInterventionVerification && isAgentLearningRound && (
            <button type="button" className="agent-assistance-bridge" onClick={onOpenAgentHelp}>
              <Icon name="lucide:message-circle-question" />
              <span><strong>{adaptiveText(locale, '打开本题问答', 'Open question help', 'Mở hỏi đáp câu này')}</strong><small>{adaptiveText(locale, '在右侧询问本题，或使用知识点、提示和手写检查。', 'Ask about this question on the right, or use concept, hint, and handwriting tools.', 'Hỏi về câu này ở bên phải hoặc dùng công cụ khái niệm, gợi ý và chữ viết tay.')}</small></span>
              <em>{adaptiveText(locale, '打开', 'Open', 'Mở')}</em>
            </button>
          )}
          {!isInterventionVerification && !isAgentLearningRound && currentHandwritingReview && (
            <div className={`agent-handwriting-review ${currentHandwritingReview.status}`} role="status">
              <div className="agent-handwriting-review-head">
                <span><Icon name="lucide:scan-line" />{adaptiveText(locale, '手写过程检查', 'Handwritten work review', 'Kiểm tra bài viết tay')}</span>
                <small>{currentHandwritingReview.fileName}</small>
              </div>
              {currentHandwritingReview.status === 'uploading' && <p>{adaptiveText(locale, '正在安全上传图片…', 'Uploading the image securely…', 'Đang tải ảnh lên an toàn…')}</p>}
              {currentHandwritingReview.status === 'analyzing' && <p>{adaptiveText(locale, '正在结合当前题目识别步骤，并定位第一处可确认的问题…', 'Reading the steps against this question and locating the first confirmable issue…', 'Đang đối chiếu các bước với câu hỏi và tìm lỗi đầu tiên có thể xác nhận…')}</p>}
              {currentHandwritingReview.status === 'failed' && <p className="error">{currentHandwritingReview.error}</p>}
              {currentHandwritingReview.status === 'completed' && currentHandwritingReview.result && (
                <>
                  <p>{String(currentHandwritingReview.result.summary || '')}</p>
                  {currentHandwritingReview.result.firstError && (
                    <article><strong>{String(currentHandwritingReview.result.firstError.title || adaptiveText(locale, '第一处问题', 'First issue', 'Vấn đề đầu tiên'))}</strong><span>{String(currentHandwritingReview.result.firstError.explanation || '')}</span></article>
                  )}
                  {currentHandwritingReview.result.feedback?.nextHint && <article className="hint"><strong>{adaptiveText(locale, '下一步线索', 'Next hint', 'Gợi ý tiếp theo')}</strong><span>{String(currentHandwritingReview.result.feedback.nextHint)}</span></article>}
                  {Array.isArray(currentHandwritingReview.result.uncertainties) && currentHandwritingReview.result.uncertainties.length > 0 && (
                    <details><summary>{adaptiveText(locale, '查看识别不确定项', 'Review recognition uncertainties', 'Xem các điểm nhận dạng chưa chắc chắn')}</summary><ul>{currentHandwritingReview.result.uncertainties.map((item: unknown, index: number) => <li key={index}>{String(item)}</li>)}</ul></details>
                  )}
                  <small>{adaptiveText(locale, '本次检查只作为 A3 引导辅助，不会直接修改成绩或掌握度。', 'This A3 guided review does not directly change scores or mastery.', 'Kiểm tra A3 này không trực tiếp thay đổi điểm hay mức độ nắm vững.')}</small>
                </>
              )}
            </div>
          )}
          {!isInterventionVerification && !isAgentLearningRound && !selectedAnswer && !currentHint && (
            <div className="special-coach-inline">
              <span>{isAgentLearningRound ? adaptiveText(locale, '学习辅助', 'Learning assistance', 'Hỗ trợ học tập') : 'AI Coach'}</span>
              <p>{conceptReminders[currentQuestionKey] ?? (aiCreditEmpty ? copy.aiCreditFallback : adaptiveText(locale, '卡住时再看提示，先保留独立思考空间。', 'Use a hint only when stuck, and keep space for independent thinking first.', 'Chỉ xem gợi ý khi bị kẹt, trước hết hãy giữ không gian tự suy nghĩ.'))}</p>
              <div>
                <GhostButton className="special-hint-trigger" onClick={() => askCoach('hint')} disabled={isFinishing || Boolean(coachLoading)}>
                  <Icon name={coachLoading === 'hint' ? 'lucide:sparkles' : 'lucide:messages-square'} color="currentColor" />
                  {coachLoading === 'hint' ? adaptiveText(locale, '生成中...', 'Generating...', 'Đang tạo...') : adaptiveText(locale, '给我提示', 'Give me a hint', 'Cho tôi gợi ý')}
                </GhostButton>
                {aiCreditEmpty && <GhostButton onClick={() => { void buyCredits(); }} disabled={isBuyingCredits}>{isBuyingCredits ? adaptiveText(locale, '处理中...', 'Processing...', 'Đang xử lý...') : copy.buyAICredits}</GhostButton>}
              </div>
              {coachLoading === 'hint' && (
                <div className="special-explanation-loading special-hint-loading" role="status" aria-label={adaptiveText(locale, 'AI 正在生成提示', 'AI is generating a hint', 'AI đang tạo gợi ý')}>
                  <span className="special-explanation-loading-dots" aria-hidden="true"><i /><i /><i /></span>
                  <p>{adaptiveText(locale, '正在根据这道题生成不直接透露答案的提示...', 'Generating a hint without giving away the answer...', 'Đang tạo gợi ý mà không tiết lộ đáp án...')}</p>
                  <div className="special-explanation-loading-steps" aria-hidden="true">
                    <span>{adaptiveText(locale, '读取题干', 'Reading the prompt', 'Đọc đề bài')}</span>
                    <span>{adaptiveText(locale, '定位突破口', 'Finding the entry point', 'Tìm điểm bắt đầu')}</span>
                    <span>{adaptiveText(locale, '生成提示', 'Drafting the hint', 'Soạn gợi ý')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isInterventionVerification && !isAgentLearningRound && currentHint && (
            <div className={`special-explanation-box special-coach-panel${isAgentLearningRound ? ' agent-assistance-result' : ''}`}>
              <div className="special-explanation-summary">
                <span>{isAgentLearningRound ? adaptiveText(locale, '学习辅助', 'Learning assistance', 'Hỗ trợ học tập') : 'AI Coach'}</span>
                <span>{adaptiveText(locale, '已有提示', 'Hint ready', 'Đã có gợi ý')}</span>
              </div>
              {isAgentLearningRound && conceptReminders[currentQuestionKey] && (
                <div className="agent-assistance-concept"><Icon name="lucide:book-open" /><p>{conceptReminders[currentQuestionKey]}</p></div>
              )}
              <article key={currentHint.id} className="special-review-explanation">
                <h3>{adaptiveText(locale, '提示', 'Hint', 'Gợi ý')}</h3>
                <ExplanationText text={currentHint.output} />
                {currentHint.id > 0 && renderCoachFeedback(currentHint)}
              </article>
              {isAgentLearningRound && (
                <div className="agent-assistance-meta">
                  <span><Icon name="lucide:badge-info" />{assistanceBillingLabel}</span>
                  <button type="button" onClick={() => { void reportLearningContentIssue(); }} disabled={assistanceReportState[currentQuestionKey] === 'sending' || assistanceReportState[currentQuestionKey] === 'sent'}>
                    {assistanceReportState[currentQuestionKey] === 'sent' ? adaptiveText(locale, '已收到反馈', 'Feedback received', 'Đã nhận phản hồi') : assistanceReportState[currentQuestionKey] === 'sending' ? adaptiveText(locale, '提交中...', 'Sending...', 'Đang gửi...') : adaptiveText(locale, '内容有问题', 'Report an issue', 'Báo nội dung có vấn đề')}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <footer className="special-taking-footer">
          <button
            type="button"
            className="special-footer-back"
            disabled={currentIndex === 0 || isFinishing}
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            aria-label={copy.previous}
          >
            <Icon name="lucide:arrow-left" />
            <span>{copy.previous}</span>
          </button>
          <span className="special-footer-progress">
            <strong>{currentIndex + 1}</strong>
            <small>/ {detail.questions.length}</small>
          </span>
          {currentIndex < detail.questions.length - 1 ? (
            <button type="button" className="special-footer-primary" onClick={() => setCurrentIndex((index) => Math.min(detail.questions.length - 1, index + 1))} disabled={isFinishing}>
              <span>{copy.next}</span>
              <Icon name="lucide:arrow-right" />
            </button>
          ) : (
            <button type="button" className="special-footer-primary" onClick={finish} disabled={isFinishing}>{isFinishing ? copy.finishingRound : copy.finishRound}</button>
          )}
        </footer>
      </main>
      {isPaused && (
        <div className="special-pause-overlay" role="status">
          <div><Icon name="lucide:pause" /><strong>{copy.paused}</strong><span>{copy.pausedBody}</span></div>
        </div>
      )}
    </div>
  );
}

function RoundTeachingIntervention({ item, conversationId, onChanged, onCompleted }: {
  item: AgentInterventionDelivery;
  conversationId: string;
  onChanged: (item: AgentInterventionDelivery | null) => void;
  onCompleted: () => void;
}) {
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(action: 'start' | 'defer' | 'skip') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await actOnAgentIntervention(item.id, { clientRequestId: globalThis.crypto?.randomUUID?.() ?? `intervention-${action}-${Date.now()}`, action });
      onChanged(action === 'start' ? updated : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : adaptiveText(locale, '暂时无法更新讲解。', 'Could not update the lesson.', 'Không thể cập nhật bài giảng.'));
    } finally { setBusy(false); }
  }
  if (item.status === 'in_progress' && item.content.teachingAsset) return (
    <section className="special-report-intervention">
      <FunctionShiftMicroLesson
        asset={item.content.teachingAsset}
        recordInteraction={(input) => recordAgentInterventionTeachingInteraction(item.id, input)}
        onCompleted={async () => {
          await actOnAgentIntervention(item.id, { clientRequestId: globalThis.crypto?.randomUUID?.() ?? `intervention-complete-${Date.now()}`, action: 'complete' });
          await offerAgentInterventionVerification({ clientRequestId: globalThis.crypto?.randomUUID?.() ?? `verification-offer-${Date.now()}`, conversationId });
          onCompleted();
        }}
      />
      {error && <p role="alert">{error}</p>}
    </section>
  );
  return (
    <section className="agent-intervention-card special-report-intervention">
      <div className="agent-intervention-mark"><Icon name="lucide:book-open-check" /></div>
      <div className="agent-intervention-copy"><span className="page-kicker">{adaptiveText(locale, '组间教学 · 系统建议', 'Between-set lesson · Recommended', 'Bài học giữa các lượt · Đề xuất')}</span><h2>{item.content.title || item.content.topicTitle}</h2><p>{item.reasonSummary}</p><small><Icon name="lucide:shield-check" />{adaptiveText(locale, '来自已审核教学资产，完成后安排独立新题验证。', 'Reviewed teaching asset; fresh independent questions follow.', 'Nội dung đã duyệt; sau đó xác minh bằng câu hỏi mới độc lập.')}</small>{error && <em role="alert">{error}</em>}</div>
      <div className="agent-intervention-actions"><button type="button" disabled={busy} onClick={() => void act('start')}>{adaptiveText(locale, '开始微课', 'Start lesson', 'Bắt đầu bài học')}</button><button type="button" disabled={busy} onClick={() => void act('defer')}>{adaptiveText(locale, '稍后', 'Later', 'Để sau')}</button><button type="button" disabled={busy} onClick={() => void act('skip')}>{adaptiveText(locale, '跳过', 'Skip', 'Bỏ qua')}</button></div>
    </section>
  );
}

export function AdaptiveRoundReportView({ roundId, onNavigate, onAgentIntervention, agentManagedFooter }: {
  roundId: string;
  onNavigate: (path: string) => void;
  onAgentIntervention?: (item: AgentInterventionDelivery | null) => void;
  agentManagedFooter?: ReactNode;
}) {
  const { locale } = useI18n();
  const isAgentManagedReport = Boolean(agentManagedFooter);
  const [report, setReport] = useState<AdaptiveRoundReport | null>(null);
  const [coachSummary, setCoachSummary] = useState<AdaptiveAIInteraction | null>(null);
  const [coachSummaryFeedback, setCoachSummaryFeedback] = useState<CoachFeedbackState | null>(null);
  const [coachSummaryError, setCoachSummaryError] = useState<string | null>(null);
  const [preparedNextRound, setPreparedNextRound] = useState<AdaptiveRoundDetail | null>(null);
  const [nextRoundError, setNextRoundError] = useState<string | null>(null);
  const [nextRoundPoolExhausted, setNextRoundPoolExhausted] = useState(false);
  const [entitlement, setEntitlement] = useState<AdaptiveAIEntitlement | null | undefined>(undefined);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [isCoachLoadingSlow, setIsCoachLoadingSlow] = useState(false);
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [completedConceptCards, setCompletedConceptCards] = useState<Record<number, string>>({});
  const [conceptCardBusyId, setConceptCardBusyId] = useState<number | null>(null);
  const [conceptCardError, setConceptCardError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentReturnError, setAgentReturnError] = useState<string | null>(null);
  const [isReturningToAgent, setIsReturningToAgent] = useState(false);
  const [teachingIntervention, setTeachingIntervention] = useState<AgentInterventionDelivery | null>(null);
  const [teachingInterventionCompleted, setTeachingInterventionCompleted] = useState(false);
  const autoSettlementRoundRef = useRef<number | null>(null);
  const copy = adaptiveCopy(locale);
  const poolExhaustedCopy = adaptivePracticePoolExhaustedCopy(locale);
  const agentReturnContext = (() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('agentContextId') || params.get('agentConversationId');
    const artifactId = params.get('agentArtifactId');
    const verificationId = params.get('agentInterventionVerificationId');
    return conversationId && (artifactId || verificationId) ? { conversationId, artifactId, verificationId } : null;
  })();

  async function returnToAgent() {
    if (!agentReturnContext || isReturningToAgent) return;
    setIsReturningToAgent(true);
    setAgentReturnError(null);
    try {
      if (agentReturnContext.verificationId) await settleAgentInterventionVerification(agentReturnContext.verificationId);
      else await settleAgentPractice(roundId);
      onNavigate(routes.agent);
    } catch (nextError) {
      setAgentReturnError(friendlyPracticeError(nextError, adaptiveText(locale, '暂时无法返回 Agent 更新方案，请重试。', 'Could not return to the Agent to update the plan. Please retry.', 'Tạm thời chưa thể quay lại Agent để cập nhật kế hoạch.'), locale));
      setIsReturningToAgent(false);
    }
  }

  async function refreshEntitlement() {
    try {
      const result = await getAdaptiveAIEntitlement();
      setEntitlement(result);
      return result;
    } catch {
      setEntitlement(null);
      return null;
    }
  }

  async function buyCredits() {
    if (isBuyingCredits) return;
    setIsBuyingCredits(true);
    const success = await startAICreditCheckout(onNavigate, locale, setError);
    if (!success) setIsBuyingCredits(false);
  }

  async function prepareNextRound(reportValue = report, completedOverride = completedConceptCards) {
    if (!reportValue || isStartingNext || preparedNextRound || nextRoundPoolExhausted) return;
    const mode = adaptiveRoundMode(reportValue.round);
    if (mode === 'intervention_verification') return;
    if (mode === 'verification' && !verificationTargetPassed(reportValue)) return;
    if (pendingConceptCardIds(reportValue, completedOverride).length) return;
    setIsStartingNext(true);
    setNextRoundError(null);
    setNextRoundPoolExhausted(false);
    try {
      const reportQuestionLanguage = normalizeQuestionLanguage(reportValue.session.questionLanguage, locale);
      const session = await createAdaptivePracticeSession({ subject: reportValue.session.subject, mode: 'practice', questionLanguage: reportQuestionLanguage });
      const round = await createAdaptivePracticeRound(session.id);
      setPreparedNextRound(round);
    } catch (nextError) {
      if (isAdaptivePracticePoolExhaustedError(nextError)) {
        setNextRoundPoolExhausted(true);
        setNextRoundError(null);
      } else {
        setNextRoundError(friendlyPracticeError(nextError, adaptiveText(locale, '暂时无法准备下一轮训练。', 'The next training round cannot be prepared right now.', 'Tạm thời chưa thể chuẩn bị vòng luyện tiếp theo.'), locale));
      }
    } finally {
      setIsStartingNext(false);
    }
  }

  async function markConceptCardComplete(cardId: number) {
    if (!report) return;
    setConceptCardBusyId(cardId);
    setConceptCardError(null);
    try {
      const result = await completeAdaptiveConceptCard(report.round.id, cardId);
      const nextCompleted = { ...completedConceptCards, [cardId]: result.completedAt };
      setCompletedConceptCards(nextCompleted);
      if (!pendingConceptCardIds(report, nextCompleted).length) {
        void prepareNextRound(report, nextCompleted);
      }
    } catch (nextError) {
      setConceptCardError(friendlyPracticeError(nextError, adaptiveText(locale, '概念卡完成状态暂时保存失败。', 'Could not save concept-card completion right now.', 'Tạm thời chưa lưu được trạng thái thẻ khái niệm.'), locale));
    } finally {
      setConceptCardBusyId(null);
    }
  }

  useEffect(() => {
    let alive = true;
    void getAdaptivePracticeRoundReport(roundId, coachResponseLanguage(locale))
      .then(async (result) => {
        if (!alive) return;
        setReport(result);
        setCompletedConceptCards({});
        setConceptCardError(null);
        if (agentReturnContext?.verificationId) void settleAgentInterventionVerification(agentReturnContext.verificationId).catch(() => undefined);
        else if (agentReturnContext) {
          await settleAgentPractice(result.round.id).catch(() => undefined);
          const offered = await offerAgentIntervention({
            clientRequestId: globalThis.crypto?.randomUUID?.() ?? `after-round-intervention-${result.round.id}-${Date.now()}`,
            context: 'after_round', conversationId: agentReturnContext.conversationId,
            language: locale === 'zh-CN' ? 'zh-CN' : locale === 'vi' ? 'vi' : 'en'
          }).catch(() => null);
          if (alive) {
            if (onAgentIntervention) onAgentIntervention(offered?.item ?? null);
            else setTeachingIntervention(offered?.item ?? null);
          }
        }
      })
      .catch((nextError) => { if (alive) setError(friendlyPracticeError(nextError, adaptiveText(locale, '科目练习报告无法加载。', 'Subject practice report could not be loaded.', 'Không thể tải báo cáo luyện theo môn.'), locale)); });
    void getAdaptiveAIEntitlement()
      .then((result) => { if (alive) setEntitlement(result); })
      .catch(() => { if (alive) setEntitlement(null); });
    return () => { alive = false; };
  }, [roundId, locale]);

  useEffect(() => {
    if (!report || autoSettlementRoundRef.current === report.round.id) return;
    let alive = true;
    autoSettlementRoundRef.current = report.round.id;
    const isIndependentVerification = adaptiveRoundMode(report.round) === 'intervention_verification';
    const shouldAutoSettle = isFreshSettlementReport(report) && !isIndependentVerification;
    setCoachSummary(null);
    setCoachSummaryFeedback(null);
    setCoachSummaryError(null);
    setPreparedNextRound(null);
    setNextRoundError(null);
    setNextRoundPoolExhausted(false);
    setIsCoachLoading(false);
    setIsCoachLoadingSlow(false);
    setIsStartingNext(false);
    if (!shouldAutoSettle) return () => { alive = false; };

    setIsCoachLoading(true);
    const reportQuestionLanguage = normalizeQuestionLanguage(report.session.questionLanguage, locale);
    const reportCoachLanguage = coachResponseLanguage(locale);
    void getAdaptiveAIRoundSummary({ roundId: report.round.id, language: reportCoachLanguage, questionLanguage: reportQuestionLanguage })
      .then((summary) => {
        if (!alive) return;
        setCoachSummary(summary);
        void refreshEntitlement();
      })
      .catch((nextError) => {
        if (!alive) return;
        setCoachSummaryError(isQuotaError(nextError) ? adaptiveText(locale, ADAPTIVE_COPY.aiCreditQuotaError, 'AI Coach credits are insufficient. Standard explanations remain available; buy credits to keep using hints, mistake analysis, and round summaries.', 'Không đủ lượt AI Coach. Giải thích tiêu chuẩn vẫn được giữ lại; nạp lượt để tiếp tục dùng gợi ý, phân tích lỗi và tổng kết vòng.') : friendlyPracticeError(nextError, adaptiveText(locale, 'AI 总结暂时不可用。', 'AI summary is temporarily unavailable.', 'Tạm thời chưa thể dùng tổng kết AI.'), locale));
      })
      .finally(() => {
        if (alive) setIsCoachLoading(false);
      });

    if (!isAgentManagedReport && !pendingConceptCardIds(report, {}).length) void prepareNextRound(report, {});

    return () => { alive = false; };
  }, [report, locale, isAgentManagedReport]);

  useEffect(() => {
    if (!isCoachLoading || coachSummary) {
      setIsCoachLoadingSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setIsCoachLoadingSlow(true);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [coachSummary, isCoachLoading]);

  if (error) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaSubjects)} />;
  if (!report) return <LoadingState label={adaptiveText(locale, '正在生成科目练习报告', 'Generating subject practice report', 'Đang tạo báo cáo luyện theo môn')} />;

  const currentReport = report;
  const wrongItems = currentReport.items.filter((item) => !item.isCorrect);
  const reviewItems = wrongItems.length ? wrongItems : currentReport.items.slice(0, 3);
  const subject = currentReport.session.subject;
  const reportQuestionLanguage = normalizeQuestionLanguage(currentReport.session.questionLanguage, locale);
  const reportCoachLanguage = coachResponseLanguage(locale);
  const isDiagnostic = currentReport.session.mode === 'diagnostic';
  const reportRoundMode = adaptiveRoundMode(currentReport.round);
  const isVerificationRound = reportRoundMode === 'verification';
  const isInterventionVerification = reportRoundMode === 'intervention_verification';
  const interventionVerificationPhase = isInterventionVerification ? adaptiveRoundInterventionPhase(currentReport.round) : 'immediate';
  const verificationFocusTitle = isVerificationRound ? adaptiveRoundFocusTitle(currentReport.round, locale) : '';
  const verificationPassed = isVerificationRound ? verificationTargetPassed(currentReport) : false;
  const pendingConceptCards = pendingConceptCardIds(currentReport, completedConceptCards);
  const hasPendingConceptCards = pendingConceptCards.length > 0;
  const diagnosticCoverage = isDiagnostic ? currentReport.diagnosticCoverage : null;
  const isFreshReport = isFreshSettlementReport(currentReport);
  const reportTitle = isDiagnostic
    ? adaptiveText(locale, '诊断完成', 'Diagnostic complete', 'Hoàn thành chẩn đoán')
    : isInterventionVerification
      ? interventionVerificationPhase === 'retention'
        ? adaptiveText(locale, '保持验证完成', 'Retention check complete', 'Hoàn thành kiểm tra duy trì')
        : interventionVerificationPhase === 'transfer'
          ? adaptiveText(locale, '迁移验证完成', 'Transfer check complete', 'Hoàn thành kiểm tra chuyển giao')
          : adaptiveText(locale, '独立验证完成', 'Independent check complete', 'Hoàn thành xác minh độc lập')
    : isVerificationRound
      ? adaptiveText(locale, '错因验证完成', 'Mistake check complete', 'Hoàn thành xác minh lỗi')
      : adaptiveText(locale, '科目练习完成', 'Subject practice complete', 'Hoàn thành luyện theo môn');
  const reportBody = isDiagnostic
    ? adaptiveText(locale, '系统已经建立本科目的初始掌握度，后续会直接进入 5 题一轮的正式训练。', 'The system has built initial mastery for this subject. Future sessions go directly into 5-question training rounds.', 'Hệ thống đã tạo mức nắm vững ban đầu cho môn này. Các lần sau sẽ vào thẳng vòng luyện 5 câu.')
    : isInterventionVerification
      ? interventionVerificationPhase === 'retention'
        ? adaptiveText(locale, '这组题检查间隔一段时间后是否仍能独立作答，用来区分短时记忆与稳定保持。', 'This set checks whether you can still answer independently after a delay, separating short-term memory from retention.', 'Bộ câu hỏi kiểm tra khả năng trả lời độc lập sau một khoảng trễ, phân biệt trí nhớ ngắn hạn và duy trì.')
        : interventionVerificationPhase === 'transfer'
          ? adaptiveText(locale, '这组题用不同任务结构检查同一知识能否迁移应用。', 'This set checks whether the same knowledge transfers to a different task structure.', 'Bộ câu hỏi kiểm tra khả năng chuyển cùng kiến thức sang cấu trúc nhiệm vụ khác.')
          : adaptiveText(locale, '这组题用于检查讲解后的真实掌握情况；系统会依据独立作答证据安排下一步。', 'This set checked genuine understanding after the lesson. The system will plan the next step from independent-answer evidence.', 'Bộ câu hỏi này kiểm tra mức hiểu thật sau bài học; hệ thống sẽ lập bước tiếp theo từ bằng chứng trả lời độc lập.')
    : isVerificationRound
      ? verificationPassed
        ? adaptiveText(locale, '这轮是在用同类新题检查错因是否修好，目前结果比较稳。', 'This round used similar new questions to check whether the mistake pattern is repaired; the result looks stable.', 'Vòng này dùng câu mới cùng dạng để kiểm tra lỗi đã sửa chưa; kết quả khá ổn.')
        : adaptiveText(locale, '这轮验证说明同类问题还不稳，建议回到错题复盘再看一遍错因。', 'This check shows the same pattern is still unstable; review the mistake cause again before more training.', 'Vòng xác minh cho thấy dạng lỗi này chưa ổn; nên ôn lại nguyên nhân lỗi trước khi luyện thêm.')
    : currentReport.summary.accuracy >= 80
      ? adaptiveText(locale, '这一轮表现稳定，可以继续挑战或进入模考。', 'This round was stable. You can keep challenging yourself or enter a mock exam.', 'Vòng này khá ổn định. Bạn có thể tiếp tục thử thách hoặc vào đề thi thử.')
      : adaptiveText(locale, '系统会优先把下一轮安排到薄弱点。', 'The system will prioritize weak spots in the next round.', 'Hệ thống sẽ ưu tiên điểm yếu ở vòng tiếp theo.');
  const nextActionTitle = isDiagnostic
    ? adaptiveText(locale, '下一步开始 5 题正式训练。', 'Next, start regular 5-question training.', 'Tiếp theo, bắt đầu vòng luyện chính thức 5 câu.')
    : hasPendingConceptCards
      ? adaptiveText(locale, '先看概念卡，再进入同类变式题。', 'Review the concept card before similar variants.', 'Xem thẻ khái niệm trước khi làm câu biến thể.')
      : nextRoundPoolExhausted
        ? poolExhaustedCopy.title
        : isInterventionVerification
          ? adaptiveText(locale, '返回 Agent 查看验证结论。', 'Return to the Agent for the result.', 'Quay lại Agent để xem kết luận.')
        : isVerificationRound
          ? verificationPassed
            ? adaptiveText(locale, '可以回到正常训练。', 'Return to regular training.', 'Có thể quay lại luyện thường.')
            : adaptiveText(locale, '先回到错题复盘。', 'Review the mistake first.', 'Ôn lại câu sai trước.')
          : currentReport.nextRecommendation === 'continue_weak_topics'
            ? adaptiveText(locale, '下一轮优先补薄弱点。', 'Next round focuses on weak spots.', 'Vòng sau ưu tiên bổ sung điểm yếu.')
            : adaptiveText(locale, '下一轮可以略微挑战。', 'The next round can be a little more challenging.', 'Vòng sau có thể tăng thử thách một chút.');
  const nextActionKicker = isDiagnostic
    ? adaptiveText(locale, '下一步', 'Next Step', 'Bước tiếp theo')
    : isVerificationRound || isInterventionVerification
      ? adaptiveText(locale, '验证结果', 'Check Result', 'Kết quả xác minh')
      : adaptiveText(locale, '继续训练', 'Continue Training', 'Tiếp tục luyện');
  const nextActionBody = (() => {
    if (isInterventionVerification) return adaptiveText(locale, '验证结论已由服务端根据完整独立作答和学习证据生成。返回 Agent 后，系统会决定继续推进、补充讲解还是稍后再验证。', 'The server derived the result from complete independent answers and learning evidence. Return to the Agent to decide whether to advance, reteach, or check again later.', 'Máy chủ đã tạo kết luận từ câu trả lời độc lập và bằng chứng học tập. Quay lại Agent để quyết định tiếp tục, giảng lại hay xác minh sau.');
    if (hasPendingConceptCards) return adaptiveText(locale, '系统已经识别到重复错因。先把下面的概念卡看完并标记已看懂，下一轮会优先安排同类变式题。', 'The system found a repeated mistake pattern. Review the concept card below and mark it done; the next round will prioritize similar variant questions.', 'Hệ thống đã phát hiện lỗi lặp lại. Hãy xem thẻ khái niệm bên dưới và đánh dấu đã hiểu; vòng sau sẽ ưu tiên câu biến thể cùng dạng.');
    if (isStartingNext) return adaptiveText(locale, '系统正在根据本轮表现准备接下来的 5 题，你可以先看本轮反馈。', 'The system is preparing the next 5 questions from this round. You can review feedback first.', 'Hệ thống đang chuẩn bị 5 câu tiếp theo dựa trên vòng này. Bạn có thể xem phản hồi trước.');
    if (preparedNextRound) return adaptiveText(locale, '下一轮 5 题已经准备好，进入后会继续根据本轮画像调整难度和主题。', 'The next 5-question round is ready and will adjust difficulty and topics from this profile.', 'Vòng 5 câu tiếp theo đã sẵn sàng và sẽ điều chỉnh độ khó, chủ đề theo hồ sơ vòng này.');
    if (nextRoundPoolExhausted) return poolExhaustedCopy.reportBody;
    if (nextRoundError) return adaptiveText(locale, '下一轮暂时没有准备好，可以点击按钮重试。', 'The next round is not ready yet. Use the button to retry.', 'Vòng tiếp theo chưa sẵn sàng, bạn có thể bấm nút để thử lại.');
    if (isDiagnostic) return adaptiveText(locale, '诊断已经完成，正式训练会更短，每轮 5 题，根据本轮画像继续调整。', 'The diagnostic is complete. Regular training is shorter, 5 questions per round, and keeps adapting from this profile.', 'Chẩn đoán đã hoàn thành. Luyện chính thức ngắn hơn, mỗi vòng 5 câu, và tiếp tục thích ứng theo hồ sơ này.');
    if (isVerificationRound) return verificationPassed
      ? adaptiveText(locale, verificationFocusTitle ? `“${verificationFocusTitle}”这类错因暂时通过验证，可以回到正常训练继续扩大覆盖面。` : '这类错因暂时通过验证，可以回到正常训练继续扩大覆盖面。', verificationFocusTitle ? `"${verificationFocusTitle}" looks repaired for now. Return to regular training to broaden coverage.` : 'This mistake pattern looks repaired for now. Return to regular training to broaden coverage.', verificationFocusTitle ? `"${verificationFocusTitle}" tạm thời đã qua xác minh. Hãy quay lại luyện thường để mở rộng độ phủ.` : 'Dạng lỗi này tạm thời đã qua xác minh. Hãy quay lại luyện thường để mở rộng độ phủ.')
      : adaptiveText(locale, verificationFocusTitle ? `“${verificationFocusTitle}”还没有稳定，先回错题里看原题、错因和解析，再做下一次验证。` : '这类错因还没有稳定，先回错题里看原题、错因和解析，再做下一次验证。', verificationFocusTitle ? `"${verificationFocusTitle}" is not stable yet. Review the original mistake, cause, and explanation before checking again.` : 'This mistake pattern is not stable yet. Review the original mistake, cause, and explanation before checking again.', verificationFocusTitle ? `"${verificationFocusTitle}" chưa ổn định. Hãy ôn lại câu gốc, nguyên nhân lỗi và giải thích trước khi xác minh lại.` : 'Dạng lỗi này chưa ổn định. Hãy ôn lại câu gốc, nguyên nhân lỗi và giải thích trước khi xác minh lại.');
    if (currentReport.nextRecommendation === 'continue_weak_topics') return adaptiveText(locale, '系统会优先选择本轮暴露出的知识点，先把不稳的地方补回来。', 'The system will prioritize topics exposed in this round and repair unstable areas first.', 'Hệ thống sẽ ưu tiên các chủ đề lộ ra ở vòng này để củng cố phần chưa ổn trước.');
    return adaptiveText(locale, '本轮整体稳定，下一轮会继续验证熟练度，并逐步混入更有区分度的题。', 'This round was stable overall. The next round will verify fluency and gradually add more discriminating questions.', 'Vòng này nhìn chung ổn định. Vòng sau sẽ kiểm tra độ thành thạo và dần thêm câu có độ phân hóa cao hơn.');
  })();
  const motivation = buildRoundMotivation(currentReport, locale);
  const aiSummaryHint = entitlement?.enabled && !entitlement.unlimited && entitlement.balanceUnits <= 0
    ? copy.aiCreditFallback
    : isFreshReport
      ? adaptiveText(locale, '系统正在把错因、下一轮重点和一个具体动作压缩成 3 条建议。', 'The system is compressing causes, next focus, and one action into three suggestions.', 'Hệ thống đang tóm tắt nguyên nhân lỗi, trọng tâm vòng sau và một hành động cụ thể thành 3 gợi ý.')
      : adaptiveText(locale, '历史复盘不会自动消耗 AI 额度；这里保留已生成的本轮建议。', 'Historical reviews do not automatically consume AI credits; generated advice remains here.', 'Bản ôn lịch sử không tự động tiêu hao lượt AI; các gợi ý đã tạo sẽ được giữ lại ở đây.');
  const nextRoundButtonLabel = isStartingNext
    ? adaptiveText(locale, '正在准备下一轮...', 'Preparing next round...', 'Đang chuẩn bị vòng tiếp theo...')
    : hasPendingConceptCards
      ? adaptiveText(locale, '先完成概念卡', 'Finish concept card first', 'Hoàn thành thẻ khái niệm trước')
    : isVerificationRound && !verificationPassed
      ? adaptiveText(locale, '回到错题复盘', 'Back to mistake review', 'Quay lại ôn câu sai')
    : nextRoundPoolExhausted
      ? poolExhaustedCopy.actionLabel
    : preparedNextRound
      ? isDiagnostic ? adaptiveText(locale, '开始正式训练', 'Start regular training', 'Bắt đầu luyện chính thức') : adaptiveText(locale, '开始下一轮', 'Start next round', 'Bắt đầu vòng tiếp theo')
      : nextRoundError
        ? adaptiveText(locale, '重试准备下一轮', 'Retry next round', 'Thử chuẩn bị lại vòng sau')
        : adaptiveText(locale, '准备下一轮', 'Prepare next round', 'Chuẩn bị vòng tiếp theo');

  async function generateCoachSummary() {
    if (isCoachLoading) return;
    setIsCoachLoading(true);
    setCoachSummaryError(null);
    setCoachSummaryFeedback(null);
    try {
      setCoachSummary(await getAdaptiveAIRoundSummary({ roundId: currentReport.round.id, language: reportCoachLanguage, questionLanguage: reportQuestionLanguage }));
      void refreshEntitlement();
    } catch (nextError) {
      setCoachSummaryError(isQuotaError(nextError) ? copy.aiCreditQuotaError : friendlyPracticeError(nextError, adaptiveText(locale, 'AI 总结暂时不可用。', 'AI summary is temporarily unavailable.', 'Tạm thời chưa thể dùng tổng kết AI.'), locale));
    } finally {
      setIsCoachLoading(false);
    }
  }

  async function rateCoachSummary(rating: number) {
    if (!coachSummary || coachSummaryFeedback?.status === 'submitting' || coachSummaryFeedback?.status === 'submitted') return;
    setCoachSummaryFeedback({ status: 'submitting', rating });
    try {
      await submitAdaptiveAIFeedback(coachSummary.id, { rating });
      setCoachSummaryFeedback({ status: rating <= 2 ? 'awaiting_reason' : 'submitted', rating });
    } catch {
      setCoachSummaryFeedback({ status: 'error', rating });
    }
  }

  async function submitCoachSummaryFeedbackReason(reasonCode: AdaptiveAIFeedbackReasonCode) {
    if (!coachSummary || coachSummaryFeedback?.status === 'submitting' || coachSummaryFeedback?.status === 'submitted') return;
    setCoachSummaryFeedback({ status: 'submitting', rating: 2, reasonCode });
    try {
      await submitAdaptiveAIFeedback(coachSummary.id, { rating: 2, reasonCode });
      setCoachSummaryFeedback({ status: 'submitted', rating: 2, reasonCode });
    } catch {
      setCoachSummaryFeedback({ status: 'error', rating: 2, reasonCode });
    }
  }

  async function startNextRound() {
    if (isStartingNext) return;
    if (nextRoundPoolExhausted) return;
    if (pendingConceptCardIds(currentReport, completedConceptCards).length) {
      setConceptCardError(adaptiveText(locale, '先看完概念卡并标记已看懂，再进入同类变式题。', 'Review the concept card and mark it done before starting similar variants.', 'Hãy xem thẻ khái niệm và đánh dấu đã hiểu trước khi làm câu biến thể.'));
      return;
    }
    if (isVerificationRound && !verificationPassed) {
      const params = new URLSearchParams({ section: 'practice', subject, due: '1' });
      onNavigate(`${routes.me}?${params.toString()}#wrong-bank`);
      return;
    }
    if (preparedNextRound) {
      onNavigate(adaptiveRoundPath(subject, preparedNextRound.round.id));
      return;
    }
    setIsStartingNext(true);
    setNextRoundError(null);
    setNextRoundPoolExhausted(false);
    try {
      const session = await createAdaptivePracticeSession({ subject, mode: 'practice', questionLanguage: reportQuestionLanguage });
      const round = await createAdaptivePracticeRound(session.id);
      setPreparedNextRound(round);
      onNavigate(adaptiveRoundPath(subject, round.round.id));
    } catch (nextError) {
      if (isAdaptivePracticePoolExhaustedError(nextError)) {
        setNextRoundPoolExhausted(true);
        setNextRoundError(null);
      } else {
        setNextRoundError(friendlyPracticeError(nextError, adaptiveText(locale, '暂时无法准备下一轮训练。', 'The next training round cannot be prepared right now.', 'Tạm thời chưa thể chuẩn bị vòng luyện tiếp theo.'), locale));
      }
    } finally {
      setIsStartingNext(false);
    }
  }

  return (
    <div className="page-stack brand-page special-practice-page special-report-page">
      <section className="special-complete-hero special-report-hero-guided">
        <div className="special-score-core">
          <Icon name="lucide:radar" />
          <p className="page-kicker">{adaptiveText(locale, `${reportTitle} / 第 ${report.round.roundIndex} 轮`, `${reportTitle} / Round ${report.round.roundIndex}`, `${reportTitle} / Vòng ${report.round.roundIndex}`)}</p>
          <h1>{reportTitle}</h1>
          <p className="special-report-score-line"><strong>{report.summary.accuracy}%</strong><span>{adaptiveText(locale, `正确 ${report.summary.correctCount}/${report.summary.total}`, `Correct ${report.summary.correctCount}/${report.summary.total}`, `Đúng ${report.summary.correctCount}/${report.summary.total}`)}</span></p>
          <p>{reportBody}</p>
        </div>
        <aside className="special-report-next-card">
          <p className="page-kicker">{adaptiveText(locale, '下一步', 'Next Step', 'Bước tiếp theo')}</p>
          <h2>{nextActionTitle}</h2>
          <p>{nextActionBody}</p>
        </aside>
        <article className={`special-report-motivation-card ${motivation.tone}`}>
          <div>
            <p className="page-kicker">{motivation.kicker}</p>
            <h2>{motivation.title}</h2>
            <p>{motivation.body}</p>
            <p className="special-report-long-term">{motivation.longTerm}</p>
          </div>
          <div className="special-report-motivation-chips" aria-label={adaptiveText(locale, '本轮反馈信号', 'This round feedback signals', 'Tín hiệu phản hồi vòng này')}>
            {motivation.chips.map((chip) => <span key={chip}>{chip}</span>)}
          </div>
        </article>
        <dl className="special-score-strip special-report-data-strip" aria-label={adaptiveText(locale, '本轮数据', 'This round data', 'Dữ liệu vòng này')}>
          <div><dt>{copy.correct}</dt><dd>{report.summary.correctCount}</dd></div>
          <div><dt>{copy.wrongLabel}</dt><dd>{report.summary.wrongCount}</dd></div>
          <div><dt>{copy.unansweredLabel}</dt><dd>{report.summary.unansweredCount}</dd></div>
          <div><dt>{adaptiveText(locale, '总用时', 'Total time', 'Tổng thời gian')}</dt><dd>{formatSeconds(report.summary.totalSeconds)}</dd></div>
        </dl>
      </section>

      {diagnosticCoverage && (
        <section className="special-diagnostic-coverage" aria-label={adaptiveText(locale, '诊断维度覆盖', 'Diagnostic dimension coverage', 'Mức phủ chiều chẩn đoán')}>
          <div className="special-diagnostic-coverage-head">
            <div>
              <p className="page-kicker">{adaptiveText(locale, '诊断证据', 'Diagnostic Evidence', 'Bằng chứng chẩn đoán')}</p>
              <h2>{adaptiveText(locale, '已形成本科目的初始维度画像。', 'Initial dimension profile is ready.', 'Hồ sơ chiều ban đầu đã sẵn sàng.')}</h2>
              <p>{adaptiveText(locale, '后续正式训练会继续补充尚未覆盖或证据不足的维度。', 'Regular training will keep filling dimensions that are uncovered or low-confidence.', 'Các vòng luyện tiếp theo sẽ tiếp tục bổ sung chiều chưa phủ hoặc còn ít bằng chứng.')}</p>
            </div>
            <div className="special-diagnostic-coverage-meter">
              <strong>{diagnosticCoverage.coverageRate}%</strong>
              <span>{adaptiveText(locale, `已覆盖 ${diagnosticCoverage.coveredCount}/${diagnosticCoverage.totalCount} 个维度`, `${diagnosticCoverage.coveredCount}/${diagnosticCoverage.totalCount} dimensions covered`, `Đã phủ ${diagnosticCoverage.coveredCount}/${diagnosticCoverage.totalCount} chiều`)}</span>
            </div>
          </div>
          <div className="special-diagnostic-coverage-grid">
            <article>
              <header>
                <Icon name="lucide:check-circle-2" />
                <div>
                  <h3>{adaptiveText(locale, '已覆盖维度', 'Covered dimensions', 'Chiều đã phủ')}</h3>
                  <p>{adaptiveText(locale, '本轮已经收集到作答证据。', 'Answer evidence was collected this round.', 'Vòng này đã thu được bằng chứng trả lời.')}</p>
                </div>
              </header>
              <div className="special-diagnostic-dimension-list">
                {diagnosticCoverage.coveredDimensions.slice(0, 8).map((dimension) => (
                  <span key={dimension.topicId}>
                    <b>{practiceTopicLabel(dimension.code, dimension.title, locale)}</b>
                    <small>{adaptiveText(locale, `${dimension.correctCount}/${dimension.attemptCount} 正确 · 证据 ${Math.round(dimension.confidence * 100)}%`, `${dimension.correctCount}/${dimension.attemptCount} correct · evidence ${Math.round(dimension.confidence * 100)}%`, `${dimension.correctCount}/${dimension.attemptCount} đúng · bằng chứng ${Math.round(dimension.confidence * 100)}%`)}</small>
                  </span>
                ))}
                {!diagnosticCoverage.coveredDimensions.length && <p>{adaptiveText(locale, '本轮还没有形成可用覆盖证据。', 'No usable coverage evidence yet.', 'Vòng này chưa có bằng chứng phủ khả dụng.')}</p>}
              </div>
            </article>
            <article>
              <header>
                <Icon name="lucide:scan-search" />
                <div>
                  <h3>{adaptiveText(locale, '待补证据维度', 'Dimensions needing evidence', 'Chiều cần thêm bằng chứng')}</h3>
                  <p>{adaptiveText(locale, `${diagnosticCoverage.lowConfidenceCount} 个维度证据仍偏少。`, `${diagnosticCoverage.lowConfidenceCount} dimensions still need stronger evidence.`, `${diagnosticCoverage.lowConfidenceCount} chiều vẫn cần thêm bằng chứng.`)}</p>
                </div>
              </header>
              <div className="special-diagnostic-dimension-list pending">
                {diagnosticCoverage.insufficientDimensions.slice(0, 8).map((dimension) => (
                  <span key={dimension.topicId}>
                    <b>{practiceTopicLabel(dimension.code, dimension.title, locale)}</b>
                    <small>{dimension.reason === 'not_covered'
                      ? adaptiveText(locale, '未覆盖', 'Not covered', 'Chưa phủ')
                      : adaptiveText(locale, `证据 ${Math.round(dimension.confidence * 100)}%`, `Evidence ${Math.round(dimension.confidence * 100)}%`, `Bằng chứng ${Math.round(dimension.confidence * 100)}%`)}</small>
                  </span>
                ))}
                {!diagnosticCoverage.insufficientDimensions.length && <p>{adaptiveText(locale, '暂无明显待补维度。', 'No obvious evidence gaps for now.', 'Hiện chưa có khoảng thiếu bằng chứng rõ ràng.')}</p>}
              </div>
            </article>
          </div>
        </section>
      )}

      {!isInterventionVerification && <section
        className={[
          'special-report-ai-card',
          coachSummary ? 'ready' : '',
          isCoachLoading && !coachSummary ? 'loading' : '',
        ].filter(Boolean).join(' ')}
        aria-live="polite"
      >
        <span className="special-report-ai-icon"><Icon name="lucide:sparkles" /></span>
        <div className="special-report-ai-copy">
          <p className="page-kicker">{adaptiveText(locale, 'AI 总结', 'AI Summary', 'Tổng kết AI')}</p>
          <h2>{coachSummary ? adaptiveText(locale, 'AI 已生成 3 条复盘建议。', 'AI has generated three review suggestions.', 'AI đã tạo 3 gợi ý ôn tập.') : isCoachLoading ? adaptiveText(locale, '正在生成本轮 AI 分析。', 'Generating AI analysis for this round.', 'Đang tạo phân tích AI cho vòng này.') : coachSummaryError ? adaptiveText(locale, 'AI 分析暂时不可用。', 'AI analysis is temporarily unavailable.', 'Tạm thời chưa thể dùng phân tích AI.') : isFreshReport ? adaptiveText(locale, '正在等待 AI 分析。', 'Waiting for AI analysis.', 'Đang chờ phân tích AI.') : adaptiveText(locale, '本轮 AI 分析未自动生成。', 'AI analysis was not generated automatically for this round.', 'Phân tích AI vòng này chưa được tạo tự động.')}</h2>
          <p>{coachSummary ? adaptiveText(locale, '先看建议，再决定是否展开逐题明细。', 'Read the suggestions first, then decide whether to open item details.', 'Xem gợi ý trước, rồi quyết định có mở chi tiết từng câu không.') : coachSummaryError ? adaptiveText(locale, '标准报告仍可使用，下一轮训练不会被阻塞。', 'The standard report still works and the next round is not blocked.', 'Báo cáo tiêu chuẩn vẫn dùng được và vòng tiếp theo không bị chặn.') : aiSummaryHint}</p>
          {!coachSummary && !coachSummaryError && (
            <ul className="special-report-ai-promises" aria-label={adaptiveText(locale, 'AI 总结会包含', 'AI summary includes', 'Tổng kết AI bao gồm')}>
              <li>{adaptiveText(locale, '错因归纳', 'Mistake causes', 'Tóm tắt nguyên nhân lỗi')}</li>
              <li>{adaptiveText(locale, '下一轮重点', 'Next-round focus', 'Trọng tâm vòng sau')}</li>
              <li>{adaptiveText(locale, '一个具体动作', 'One concrete action', 'Một hành động cụ thể')}</li>
            </ul>
          )}
        </div>
        {isCoachLoading && !coachSummary && (
          <div className="special-report-loading" role="status" aria-label={adaptiveText(locale, 'AI 正在生成本轮分析', 'AI is generating this round analysis', 'AI đang tạo phân tích vòng này')}>
            <span />
          </div>
        )}
        {isCoachLoadingSlow && !coachSummary && (
          <p className="special-report-loading-note">{adaptiveText(locale, 'AI 分析还在生成，你可以先查看本轮数据，下一轮也会继续准备。', 'AI analysis is still generating. You can review this round while the next round keeps preparing.', 'Phân tích AI vẫn đang tạo. Bạn có thể xem dữ liệu vòng này trong lúc vòng sau tiếp tục được chuẩn bị.')}</p>
        )}
        {coachSummaryError && !coachSummary && <p className="special-report-inline-error">{coachSummaryError}</p>}
        {coachSummary && (
          <div className="special-report-ai-output">
            <ExplanationText text={localizeRoundSummaryOutput(coachSummary.output, locale)} />
            <div className="special-ai-feedback-block">
              <div className="special-ai-feedback" aria-label={adaptiveText(locale, 'AI 总结反馈', 'AI summary feedback', 'Phản hồi tổng kết AI')}>
                <button
                  type="button"
                  className={`special-ai-feedback-button is-positive${(coachSummaryFeedback?.status === 'submitted' || coachSummaryFeedback?.status === 'awaiting_reason') && coachSummaryFeedback.rating === 5 ? ' selected' : ''}`}
                  onClick={() => rateCoachSummary(5)}
                  disabled={coachSummaryFeedback?.status === 'submitting' || coachSummaryFeedback?.status === 'submitted' || coachSummaryFeedback?.status === 'awaiting_reason'}
                  aria-label={adaptiveText(locale, '这条 AI 总结有用', 'This AI summary is useful', 'Tổng kết AI này hữu ích')}
                  title={adaptiveText(locale, '有用', 'Useful', 'Hữu ích')}
                >
                  <Icon name="lucide:check-circle-2" color="currentColor" />
                  <span>{adaptiveText(locale, '有帮助', 'Helpful', 'Hữu ích')}</span>
                </button>
                <button
                  type="button"
                  className={`special-ai-feedback-button is-negative${(coachSummaryFeedback?.status === 'submitted' || coachSummaryFeedback?.status === 'awaiting_reason') && coachSummaryFeedback.rating === 2 ? ' selected' : ''}`}
                  onClick={() => rateCoachSummary(2)}
                  disabled={coachSummaryFeedback?.status === 'submitting' || coachSummaryFeedback?.status === 'submitted' || coachSummaryFeedback?.status === 'awaiting_reason'}
                  aria-label={adaptiveText(locale, '这条 AI 总结没用', 'This AI summary is not useful', 'Tổng kết AI này chưa hữu ích')}
                  title={adaptiveText(locale, '没用', 'Not useful', 'Chưa hữu ích')}
                >
                  <Icon name="lucide:circle-alert" color="currentColor" />
                  <span>{adaptiveText(locale, '需改进', 'Needs work', 'Cần sửa')}</span>
                </button>
              </div>
              {coachSummaryFeedback?.status === 'awaiting_reason' && (
                <div className="special-ai-feedback-reasons" aria-label={coachFeedbackReasonTitle(locale)}>
                  <p>{coachFeedbackReasonTitle(locale)}</p>
                  <div>
                    {coachFeedbackReasons(locale, 'summary').map((reason) => (
                      <button
                        key={reason.code}
                        type="button"
                        className="special-ai-feedback-reason"
                        onClick={() => submitCoachSummaryFeedbackReason(reason.code)}
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {coachSummaryFeedback?.status === 'submitting' && <p className="special-ai-feedback-note">{adaptiveText(locale, '正在提交反馈...', 'Submitting feedback...', 'Đang gửi phản hồi...')}</p>}
              {coachSummaryFeedback?.status === 'submitted' && <p className="special-ai-feedback-note success">{coachFeedbackSubmittedText(locale, coachSummaryFeedback.reasonCode)}</p>}
              {coachSummaryFeedback?.status === 'error' && <p className="special-ai-feedback-note error">{adaptiveText(locale, '反馈没发出去，请再点一次。', 'Feedback was not sent. Please try once more.', 'Chưa gửi được phản hồi, vui lòng bấm lại.')}</p>}
            </div>
          </div>
        )}
      </section>}

      <section className="special-report-action-panel" aria-label={adaptiveText(locale, '下一步行动', 'Next action', 'Hành động tiếp theo')}>
        <div>
          <p className="page-kicker">{nextActionKicker}</p>
          <h2>{nextActionTitle}</h2>
          <p>{nextActionBody}</p>
          {nextRoundError && <p className="special-report-inline-error">{nextRoundError}</p>}
        </div>
        {agentManagedFooter ? agentManagedFooter : <div className="special-report-action-buttons">
          {agentReturnContext && (
            <button type="button" onClick={() => { void returnToAgent(); }} disabled={isReturningToAgent}>
              {isReturningToAgent
                ? adaptiveText(locale, '正在更新方案...', 'Updating plan...', 'Đang cập nhật kế hoạch...')
                : adaptiveText(locale, '返回 Agent 更新下一步', 'Return to Agent for the next step', 'Quay lại Agent để cập nhật bước tiếp theo')}
            </button>
          )}
          {!isInterventionVerification && <button type="button" onClick={startNextRound} disabled={isStartingNext || hasPendingConceptCards || nextRoundPoolExhausted}>{nextRoundButtonLabel}</button>}
          <GhostButton onClick={() => onNavigate(subjectPath(subject))}>{adaptiveText(locale, '回到科目页', 'Back to subject page', 'Quay lại trang môn học')}</GhostButton>
          <GhostButton onClick={() => onNavigate(routes.cscaMockExam)}>{copy.enterMock}</GhostButton>
        </div>}
        {agentReturnError && <p className="special-report-inline-error">{agentReturnError}</p>}
      </section>

      {agentReturnContext && !onAgentIntervention && teachingIntervention && !teachingInterventionCompleted && (
        <RoundTeachingIntervention
          item={teachingIntervention}
          conversationId={agentReturnContext.conversationId}
          onChanged={setTeachingIntervention}
          onCompleted={() => { setTeachingInterventionCompleted(true); setTeachingIntervention(null); }}
        />
      )}
      {teachingInterventionCompleted && <section className="special-report-intervention-complete"><Icon name="lucide:badge-check" /><div><h2>{adaptiveText(locale, '微课已完成，独立验证已安排。', 'Lesson complete; independent verification scheduled.', 'Đã hoàn thành bài học; đã lên lịch xác minh độc lập.')}</h2><p>{adaptiveText(locale, '完成微课不会直接提高掌握度。返回 Agent 后开始新题验证。', 'The lesson did not directly change mastery. Return to the Agent for fresh-question verification.', 'Bài học không trực tiếp thay đổi mức độ nắm vững. Quay lại Agent để xác minh bằng câu hỏi mới.')}</p></div></section>}

      <details className="special-report-planner-details">
        <summary>{adaptiveText(locale, '查看下一轮依据', 'View next-round basis', 'Xem căn cứ vòng tiếp theo')}</summary>
        <div className="special-report-grid">
        <article>
          <h2>{isDiagnostic ? adaptiveText(locale, '训练起点', 'Training starting point', 'Điểm bắt đầu luyện tập') : adaptiveText(locale, '下一轮依据', 'Next-round basis', 'Căn cứ vòng tiếp theo')}</h2>
          <p>{isDiagnostic ? adaptiveText(locale, '下一轮会根据诊断暴露出的薄弱主题和掌握度缺口安排正式训练。', 'The next round uses weak topics and mastery gaps from the diagnostic to arrange regular training.', 'Vòng tiếp theo sẽ dùng chủ đề yếu và khoảng thiếu nắm vững từ chẩn đoán để sắp xếp luyện chính thức.') : report.nextRecommendation === 'continue_weak_topics' ? adaptiveText(locale, '下一轮会优先复习本轮暴露出的薄弱主题。', 'The next round will review weak topics exposed in this round first.', 'Vòng sau sẽ ưu tiên ôn các chủ đề yếu lộ ra ở vòng này.') : adaptiveText(locale, '本轮整体稳定，可以安排更有挑战的题目。', 'This round was stable overall, so more challenging questions can be scheduled.', 'Vòng này nhìn chung ổn định, có thể sắp xếp câu thử thách hơn.')}</p>
        </article>
        <article>
          <h2>{adaptiveText(locale, '薄弱主题', 'Weak topics', 'Chủ đề yếu')}</h2>
          <div className="special-weak-tags">
            {report.weakTopics.slice(0, 5).map((topic) => <span key={`${topic.topicId}-${topic.code}`}>{practiceTopicLabel(topic.code, topic.title, locale)}</span>)}
            {!report.weakTopics.length && <p>{adaptiveText(locale, '本轮没有明显薄弱主题。', 'No obvious weak topic in this round.', 'Vòng này chưa có chủ đề yếu rõ ràng.')}</p>}
          </div>
        </article>
        {report.remediationPlan?.triggered && (
          <article>
            <h2>{adaptiveText(locale, '补救安排', 'Repair plan', 'Kế hoạch củng cố')}</h2>
            <div className="special-concept-card-list">
              {report.remediationPlan.conceptCards.slice(0, 2).map((card) => {
                const completedAt = completedConceptCards[card.id] ?? card.completedAt ?? null;
                const isBusy = conceptCardBusyId === card.id;
                return (
                  <section key={`concept-${card.id}`} className={completedAt ? 'special-concept-card completed' : 'special-concept-card'}>
                    <p className="page-kicker">{card.misconceptionLabel ?? adaptiveText(locale, '错因概念卡', 'Mistake concept card', 'Thẻ khái niệm lỗi')}</p>
                    <h3>{card.title}</h3>
                    <ExplanationText text={card.body} />
                    <button
                      type="button"
                      className="special-concept-card-action"
                      onClick={() => { void markConceptCardComplete(card.id); }}
                      disabled={Boolean(completedAt) || isBusy}
                    >
                      <Icon name={completedAt ? 'lucide:check-circle-2' : isBusy ? 'lucide:sparkles' : 'lucide:check'} color="currentColor" />
                      {completedAt
                        ? adaptiveText(locale, '已完成', 'Completed', 'Đã hoàn thành')
                        : isBusy
                          ? adaptiveText(locale, '保存中...', 'Saving...', 'Đang lưu...')
                          : adaptiveText(locale, '标记已看懂', 'Mark reviewed', 'Đánh dấu đã hiểu')}
                    </button>
                  </section>
                );
              })}
              {report.remediationPlan.variantPractice.availableCount > 0 && (
                <p className="special-concept-card-next">
                  {adaptiveText(
                    locale,
                    `${report.remediationPlan.variantPractice.availableCount} 道同类变式题已准备好。`,
                    `${report.remediationPlan.variantPractice.availableCount} similar variant question(s) are ready.`,
                    `${report.remediationPlan.variantPractice.availableCount} câu biến thể cùng dạng đã sẵn sàng.`
                  )}
                </p>
              )}
              {!report.remediationPlan.conceptCards.length && report.remediationPlan.variantPractice.availableCount === 0 && (
                <p className="special-concept-card-next">{adaptiveText(locale, '系统已记录这个错因，下一轮会优先补相近知识点。', 'The system recorded this mistake pattern and will prioritize nearby topics next round.', 'Hệ thống đã ghi nhận dạng lỗi này và sẽ ưu tiên chủ đề gần đó ở vòng sau.')}</p>
              )}
            </div>
            {conceptCardError && <p className="special-report-inline-error">{conceptCardError}</p>}
          </article>
        )}
        {!isInterventionVerification && <article>
          <AICreditPanel entitlement={entitlement} compact onBuy={() => { void buyCredits(); }} onRefresh={() => { void refreshEntitlement(); }} isBuying={isBuyingCredits} />
        </article>}
        </div>
      </details>

      <details className="special-review-panel special-report-review-details">
        <summary>{adaptiveText(locale, '查看题目明细', 'View question details', 'Xem chi tiết câu hỏi')}</summary>
        <div className="special-section-head">
          <div><p className="page-kicker">{copy.review}</p><h2>{copy.reviewTitle(Boolean(wrongItems.length))}</h2></div>
        </div>
        <div className="special-review-list">
          {reviewItems.map((item) => (
            <article key={item.id} className={item.isCorrect ? 'correct' : 'wrong'}>
              <header>
                <span>{item.position ?? item.orderNumber}</span>
                <strong><MathContent text={item.prompt} /></strong>
                <div className="special-review-meta">
                  <em>{item.isCorrect ? adaptiveText(locale, '正确', 'Correct', 'Đúng') : item.isUnanswered ? adaptiveText(locale, `未作答 / 正确 ${item.correctAnswer}`, `Unanswered / Correct ${item.correctAnswer}`, `Chưa trả lời / Đúng ${item.correctAnswer}`) : adaptiveText(locale, `你的答案 ${item.selectedAnswer} / 正确 ${item.correctAnswer}`, `Your answer ${item.selectedAnswer} / Correct ${item.correctAnswer}`, `Đáp án của bạn ${item.selectedAnswer} / Đúng ${item.correctAnswer}`)}</em>
                  <small>{adaptiveTopicLabel(item, locale)}</small>
                </div>
              </header>
              <section className="special-review-explanation">
                <h3>{copy.explanation}</h3>
                <ExplanationText text={item.explanation} />
              </section>
              <div className="special-review-tags">
                {[...new Set(item.knowledgeTags)].map((tag) => <b key={`${item.id}-${tag}`}>{tag}</b>)}
                {item.mastery !== null && <b>{adaptiveText(locale, `掌握 ${Math.round(item.mastery * 100)}%`, `Mastery ${Math.round(item.mastery * 100)}%`, `Nắm vững ${Math.round(item.mastery * 100)}%`)}</b>}
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
