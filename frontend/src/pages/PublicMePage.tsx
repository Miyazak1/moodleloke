import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import '../styles/account.css';
import {
  acceptOrganizationInvite,
  acceptOrganizationInviteCode,
  completeMyCscaReviewQueueItem,
  completeMyCscaWrongQuestionReview,
  getMyAICredits,
  getMyCscaReviewQueue,
  getMyCscaWrongQuestions,
  getMyLearningDashboard,
  getMyMockExamAttempts,
  getMySpecialPracticeSessions,
  recordMyReadinessActionClick,
  type CscaReviewQueue,
  type CscaWrongQuestionReviewPack,
  type CscaWrongQuestionItem,
  type LearningDashboard,
  type MockExamAttemptHistory,
  type MyAICredits,
  type SpecialPracticeSessionHistory,
  type User
} from '../lib/api';
import { AccountOverviewSection, type AccountOverviewTaskCard } from '../components/account/AccountOverviewSection';
import { AccountSectionNav } from '../components/account/AccountSectionNav';
import { AccountSettingsWorkspace } from '../components/account/AccountSettingsWorkspace';
import { Icon } from '../components/Icon';
import { MathContent } from '../components/MathContent';
import { UserAvatar } from '../components/UserAvatar';
import {
  EMPTY_STUDENT_PROFILE_DRAFT,
  studentProfileDraftPayload,
  studentProfileToDraft,
  type StudentProfileDraft
} from '../components/StudentProfileFields';
import { getMe, logout, resendEmailVerification, updateMeProfile } from '../lib/auth';
import { getMyAgentLearningSettings, getMyStudentProfile, updateMyAgentScoreGoal, updateMyAgentStudyAvailability, updateMyStudentProfile } from '../lib/api-me';
import type { AgentLearningSettings } from '../lib/api-types';
import {
  emptyAccountWrongQuestionFilters,
  readAccountSection,
  readAccountWrongQuestionFilters,
  writeAccountUrlState,
  type AccountAssetSectionKey,
  type AccountSectionKey,
  type AccountWrongQuestionFilters
} from '../lib/account-url-state';
import { routes } from '../lib/routes';
import { useI18n } from '../i18n/useI18n';
import type { Locale } from '../i18n/locales';

type PublicMePageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onGoToMockExam: () => void;
  onGoToAuth: () => void;
  onOpenMockExamReport: (path: string) => void;
  onOpenSpecialPracticeReport: (path: string) => void;
  onOpenSpecialPracticeTopic: (subject: string, slug: string) => void;
  onGoToSpecialPractice: () => void;
  onGoToAdmin: () => void;
  onNavigate: (path: string) => void;
};

const SECTION_KEYS: AccountSectionKey[] = ['overview', 'learning', 'practice', 'wrongQuestions', 'mockExams', 'settings'];
type HeatmapMode = 'day' | 'week' | 'month';
type HeatmapItem = NonNullable<LearningDashboard['heatmap']>[number];
type Translate = (key: string, fallback?: string) => string;

function intlLocale(locale: string) {
  if (locale === 'en') return 'en-US';
  if (locale === 'vi') return 'vi-VN';
  return 'zh-CN';
}

function formatDate(value: string | null | undefined, locale: Locale, emptyLabel: string) {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatAccuracy(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return '-';
  return `${Math.round(value ?? 0)}%`;
}

function percentText(value?: number | null) {
  return Number.isFinite(value ?? NaN) ? `${Math.round(value ?? 0)}%` : '-';
}

function localizedText(value: unknown, locale: Locale = 'zh-CN') {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const zhValue = record['zh-CN'] ?? record.zh;
    return String(record[locale] ?? (locale === 'zh-CN' ? zhValue : undefined) ?? record.en ?? zhValue ?? Object.values(record)[0] ?? '');
  }
  return '';
}

function previewText(value: unknown, locale: Locale, fallback: string, maxLength = 72) {
  const text = localizedText(value, locale).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function wrongQuestionPreviewTitle(item: CscaWrongQuestionItem, locale: Locale, fallback: string) {
  return previewText(item.topicTitle || item.topic.title || item.patternLabel, locale, fallback, 32);
}

function organizationInviteTokenFromInput(value: string) {
  const text = value.trim();
  if (!text) return '';
  try {
    const url = new URL(text, window.location.origin);
    return url.searchParams.get('token')?.trim() || text;
  } catch {
    return text;
  }
}

function isShortOrganizationInviteCode(value: string) {
  return /^[2-9A-HJ-NP-Z]{8,12}$/.test(value.trim().replace(/[\s-]+/g, '').toUpperCase());
}

function subjectLabel(subject: string, t: Translate) {
  if (subject === 'math') return t('nav.math', '数学');
  if (subject === 'physics') return t('nav.physics', '物理');
  if (subject === 'chemistry') return t('nav.chemistry', '化学');
  return subject;
}

function metricItems(dashboard: LearningDashboard | null, t: Translate) {
  const summary = dashboard?.summary;
  return [
    { label: t('me.metrics.totalAnswered', '累计作答'), value: summary?.totalAnswered ?? 0, suffix: t('me.units.questions', '题') },
    { label: t('me.metrics.accuracy', '正确率'), value: Math.round(summary?.accuracy ?? 0), suffix: '%' },
    { label: t('me.metrics.weeklyStudy', '本周学习'), value: summary?.practiceMinutesThisWeek ?? 0, suffix: t('me.units.minutes', '分钟') },
    { label: t('me.metrics.currentStreak', '当前连续'), value: summary?.currentStreakDays ?? 0, suffix: t('me.units.days', '天') }
  ];
}

function buildEmptyTrendWindow() {
  const today = new Date();
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    return {
      date: date.toISOString().slice(0, 10),
      answeredCount: 0,
      accuracy: null,
      practiceMinutes: 0
    };
  });
}

function buildActivityCells(heatmap: LearningDashboard['heatmap'] | undefined) {
  if (heatmap?.length) return heatmap;
  const today = new Date();
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (364 - index));
    return {
      date: date.toISOString().slice(0, 10),
      level: 0 as const,
      answeredCount: 0,
      practiceMinutes: 0,
      accuracy: null,
      isStreakEligible: false
    };
  });
}

function dateKeyFor(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseHeatmapDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function weekStartKey(date: string) {
  const parsed = parseHeatmapDate(date);
  if (!parsed) return '';
  const day = parsed.getDay();
  parsed.setDate(parsed.getDate() - ((day + 6) % 7));
  return dateKeyFor(parsed);
}

function weekEndLabel(key: string) {
  const parsed = parseHeatmapDate(key);
  if (!parsed) return '';
  parsed.setDate(parsed.getDate() + 6);
  return `${key.slice(5)}-${dateKeyFor(parsed).slice(5)}`;
}

function monthKey(date: string) {
  return date ? date.slice(0, 7) : '';
}

function heatmapLevel(answeredCount: number, activeUnits: number, mode: 'week' | 'month'): 0 | 1 | 2 | 3 | 4 {
  if (answeredCount <= 0 && activeUnits <= 0) return 0;
  if (mode === 'week') {
    if (activeUnits >= 5 || answeredCount >= 25) return 4;
    if (activeUnits >= 3 || answeredCount >= 15) return 3;
    if (activeUnits >= 1 || answeredCount >= 5) return 2;
    return 1;
  }
  if (activeUnits >= 16 || answeredCount >= 120) return 4;
  if (activeUnits >= 8 || answeredCount >= 60) return 3;
  if (activeUnits >= 3 || answeredCount >= 20) return 2;
  return 1;
}

function aggregateHeatmap(items: HeatmapItem[], mode: 'week' | 'month') {
  const buckets = new Map<string, {
    label: string;
    answeredCount: number;
    practiceMinutes: number;
    activeUnits: number;
    weightedCorrect: number;
  }>();
  for (const item of items) {
    const key = mode === 'week' ? weekStartKey(item.date) : monthKey(item.date);
    if (!key) continue;
    const bucket = buckets.get(key) ?? {
      label: mode === 'week' ? weekEndLabel(key) : key,
      answeredCount: 0,
      practiceMinutes: 0,
      activeUnits: 0,
      weightedCorrect: 0
    };
    bucket.answeredCount += item.answeredCount;
    bucket.practiceMinutes += item.practiceMinutes;
    bucket.activeUnits += item.isStreakEligible ? 1 : 0;
    bucket.weightedCorrect += item.accuracy === null ? 0 : (item.accuracy / 100) * item.answeredCount;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    key,
    label: value.label,
    level: heatmapLevel(value.answeredCount, value.activeUnits, mode),
    answeredCount: value.answeredCount,
    practiceMinutes: value.practiceMinutes,
    activeUnits: value.activeUnits,
    accuracy: value.answeredCount ? Math.round((value.weightedCorrect / value.answeredCount) * 100) : null
  }));
}

function monthLabel(date: string, locale: string) {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'short' }).format(parsed);
}

function calendarWeeks(items: HeatmapItem[]) {
  const blank = (index: number): HeatmapItem & { emptyKey: string } => ({
    date: '',
    level: 0,
    answeredCount: 0,
    practiceMinutes: 0,
    accuracy: null,
    isStreakEligible: false,
    emptyKey: `empty-${index}`
  });
  const firstDate = items.find((item) => item.date)?.date;
  const leading = firstDate ? new Date(`${firstDate}T00:00:00`).getDay() : 0;
  const cells = [...Array.from({ length: leading }, (_, index) => blank(index)), ...items];
  while (cells.length % 7 !== 0) cells.push(blank(cells.length));
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

function CalendarHeatmap({ items, title, locale, t }: { items: HeatmapItem[]; title: string; locale: Locale; t: Translate }) {
  const weeks = calendarWeeks(items);
  let previousMonth = '';
  const weekdayLabels = locale === 'en'
    ? { mon: 'Mon', wed: 'Wed', fri: 'Fri' }
    : locale === 'vi'
      ? { mon: 'T2', wed: 'T4', fri: 'T6' }
      : { mon: '一', wed: '三', fri: '五' };
  return (
    <div className="me-calendar-heatmap" aria-label={title} style={{ '--calendar-weeks': weeks.length } as CSSProperties}>
      <div className="me-calendar-months" aria-hidden="true">
        {weeks.map((week, index) => {
          const label = monthLabel(week.find((cell) => cell.date)?.date ?? '', locale);
          const nextLabel = label && label !== previousMonth ? label : '';
          if (label) previousMonth = label;
          return <span key={index}>{nextLabel}</span>;
        })}
      </div>
      <div className="me-calendar-body">
        <div className="me-calendar-days" aria-hidden="true">
          <span />
          <span>{weekdayLabels.mon}</span>
          <span />
          <span>{weekdayLabels.wed}</span>
          <span />
          <span>{weekdayLabels.fri}</span>
          <span />
        </div>
        <div className="me-learning-heatmap">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="me-learning-week">
              {week.map((item, dayIndex) => (
                <span
                  key={item.date || `${weekIndex}-${dayIndex}`}
                  className={`level-${item.level}${item.date ? '' : ' empty'}`}
                  title={item.date ? `${item.date} · ${item.answeredCount}${t('me.units.questions', '题')} · ${item.practiceMinutes}${t('me.units.minutes', '分钟')} · ${t('me.metrics.accuracy', '正确率')} ${percentText(item.accuracy)}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AggregateHeatmap({
  items,
  mode,
  title,
  locale,
  t
}: {
  items: ReturnType<typeof aggregateHeatmap>;
  mode: 'week' | 'month';
  title: string;
  locale: Locale;
  t: Translate;
}) {
  const unitLabel = t('me.heatmap.activeLearningDays', '有效学习天');
  return (
    <div className={`me-aggregate-heatmap ${mode}`} aria-label={title} style={{ '--aggregate-items': items.length } as CSSProperties}>
      <div className="me-aggregate-months" aria-hidden="true">
        {items.map((item, index) => {
          const previousMonth = index > 0 ? items[index - 1].key.slice(5, 7) : '';
          const month = item.key.slice(5, 7);
          const label = index === 0 || month !== previousMonth ? monthLabel(`${item.key.slice(0, 4)}-${month}-01`, locale) : '';
          return <span key={`${item.key}-${index}`}>{label}</span>;
        })}
      </div>
      <div className="me-aggregate-cells">
        {items.map((item) => (
          <span
            key={item.key}
            className={`level-${item.level}`}
            title={`${item.label} · ${item.answeredCount}${t('me.units.questions', '题')} · ${item.practiceMinutes}${t('me.units.minutes', '分钟')} · ${unitLabel} ${item.activeUnits} · ${t('me.metrics.accuracy', '正确率')} ${percentText(item.accuracy)}`}
          />
        ))}
      </div>
    </div>
  );
}

function LearningHeatmap({
  dashboard,
  title,
  body,
  locale,
  t,
  view,
  onViewChange
}: {
  dashboard: LearningDashboard | null;
  title: string;
  body: string;
  locale: Locale;
  t: Translate;
  view: HeatmapMode;
  onViewChange: (view: HeatmapMode) => void;
}) {
  const items = buildActivityCells(dashboard?.heatmap);
  return (
    <section className="me-learning-card">
      <div className="me-learning-card-head with-tabs">
        <div>
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
        <div className="me-learning-tabs" role="tablist" aria-label={title}>
          {(['day', 'week', 'month'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={view === key ? 'active' : ''}
              onClick={() => onViewChange(key)}
            >
              {key === 'day' ? t('me.heatmap.day', '天') : key === 'week' ? t('me.heatmap.week', '周') : t('me.heatmap.month', '月')}
            </button>
          ))}
        </div>
      </div>
      {view === 'day'
        ? <div className="me-activity-visual-scroll" tabIndex={0}><CalendarHeatmap items={items} title={title} locale={locale} t={t} /></div>
        : <AggregateHeatmap items={aggregateHeatmap(items, view)} mode={view} title={title} locale={locale} t={t} />}
    </section>
  );
}

function LearningTrendPanel({ dashboard, t }: { dashboard: LearningDashboard | null; t: Translate }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const trend = dashboard?.trend ?? buildEmptyTrendWindow();
  const trendItems = Array.from({ length: 30 }, (_, index) => {
    const item = trend.slice(-30)[index];
    if (!item) return null;
    const answeredCount = Number.isFinite(item.answeredCount) ? Math.max(0, item.answeredCount) : 0;
    const practiceMinutes = Number.isFinite(item.practiceMinutes) ? Math.max(0, item.practiceMinutes) : 0;
    const accuracy = typeof item.accuracy === 'number' && Number.isFinite(item.accuracy)
      ? Math.min(100, Math.max(0, item.accuracy))
      : null;
    return { ...item, answeredCount, practiceMinutes, accuracy };
  });
  const currentIndex = activeIndex ?? -1;
  const selectedItem = currentIndex >= 0 ? trendItems[currentIndex] : null;
  const activeItem = selectedItem && (selectedItem.answeredCount > 0 || selectedItem.accuracy !== null) ? selectedItem : null;
  const maxAnswered = Math.max(1, ...trendItems.map((item) => item?.answeredCount ?? 0));
  const totalAnswered = trendItems.reduce((sum, item) => sum + (item?.answeredCount ?? 0), 0);
  const activeDays = trendItems.filter((item) => (item?.answeredCount ?? 0) > 0 || (item?.practiceMinutes ?? 0) > 0).length;
  const accuracyItems = trendItems.filter((item): item is NonNullable<typeof item> => Boolean(item && typeof item.accuracy === 'number'));
  const averageAccuracy = accuracyItems.length
    ? Math.round(accuracyItems.reduce((sum, item) => sum + (item.accuracy ?? 0), 0) / accuracyItems.length)
    : null;
  const accuracyPoints = trendItems
    .map((item, index) => {
      if (!item || item.accuracy === null || item.answeredCount <= 0) return null;
      return { date: item.date, index, x: (index / 29) * 100, y: Math.min(100, Math.max(0, 100 - item.accuracy)) };
    })
    .filter((item): item is { date: string; index: number; x: number; y: number } => item !== null);
  const points = accuracyPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const activeLeft = currentIndex >= 0 ? (currentIndex / 29) * 100 : 0;
  const activeTop = activeItem?.accuracy == null ? 76 : Math.min(92, Math.max(8, 100 - activeItem.accuracy));
  const dateLabel = activeItem?.date ? activeItem.date.slice(5).replace('-', '/') : '';

  return (
    <section className="me-learning-card">
      <div className="me-learning-card-head">
        <strong>{t('me.trend.title', '最近 30 天趋势')}</strong>
        <p>{t('me.trend.body', '柱状表示题量，折线表示正确率。')}</p>
      </div>
      <div className="me-learning-trend-summary" aria-label={t('me.trend.summaryAria', '最近 30 天趋势摘要')}>
        <span><strong>{totalAnswered}</strong>{t('me.units.questions', '题')}</span>
        <span><strong>{percentText(averageAccuracy)}</strong>{t('me.trend.averageAccuracy', '平均正确率')}</span>
        <span><strong>{activeDays}</strong>{t('me.trend.activeDays', '天有练习')}</span>
      </div>
      <div
        className={`me-learning-trend${activeItem ? ' has-active' : ''}`}
        aria-label={t('me.trend.title', '最近 30 天趋势')}
        onMouseLeave={() => setActiveIndex(null)}
        style={{
          '--trend-active-left': `${activeLeft}%`,
          '--trend-active-top': `${activeTop}%`
        } as CSSProperties}
      >
        <div className="me-learning-trend-scale" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="me-learning-bars">
          {trendItems.map((item, index) => {
            const height = Math.max(7, ((item?.answeredCount ?? 0) / maxAnswered) * 100);
            const hasData = Boolean(item && (item.answeredCount > 0 || item.accuracy !== null));
            const isActive = index === currentIndex;
            return (
              <button
                key={item?.date ?? index}
                type="button"
                className={`${isActive && hasData ? 'active' : ''}${hasData ? '' : ' empty'}`.trim()}
                style={{ '--trend-bar-height': `${height}%` } as CSSProperties}
                title={hasData && item ? `${item.date} · ${item.answeredCount}${t('me.units.questions', '题')} · ${item.practiceMinutes}${t('me.units.minutes', '分钟')} · ${t('me.metrics.accuracy', '正确率')} ${percentText(item.accuracy)}` : undefined}
                aria-disabled={hasData ? undefined : true}
                tabIndex={hasData ? 0 : -1}
                onMouseEnter={() => setActiveIndex(hasData ? index : null)}
                onFocus={() => setActiveIndex(hasData ? index : null)}
                onBlur={() => setActiveIndex(null)}
              />
            );
          })}
        </div>
        {accuracyPoints.length > 1 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline className="glow" points={points} />
            <polyline points={points} />
          </svg>
        )}
        {activeItem && (
          <div className="me-learning-trend-tip" aria-live="polite">
            <span>{dateLabel}</span>
            <strong>{activeItem.answeredCount}{t('me.units.questions', '题')}</strong>
            <small>{percentText(activeItem.accuracy)} {t('me.metrics.accuracy', '正确率')} · {activeItem.practiceMinutes}{t('me.units.minutes', '分钟')}</small>
          </div>
        )}
      </div>
    </section>
  );
}

function stripLocalePrefix(href: string) {
  return href.replace(/^\/(?:zh|zh-CN|en|vi)(?=\/)/, '');
}

function isReviewDue(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function applyWrongQuestionDueFilter(items: CscaWrongQuestionItem[], filters: AccountWrongQuestionFilters) {
  return filters.dueOnly ? items.filter((item) => isReviewDue(item.nextReviewAt)) : items;
}

function chooseNextSection(dashboard: LearningDashboard | null, wrongCount: number): AccountAssetSectionKey {
  if (wrongCount > 0) return 'wrongQuestions';
  if ((dashboard?.summary?.totalAnswered ?? 0) < 20) return 'practice';
  return 'mockExams';
}

export function PublicMePage({
  currentUser,
  isResolvingAuth,
  onCurrentUserChange,
  onGoToMockExam,
  onGoToAuth,
  onOpenMockExamReport,
  onOpenSpecialPracticeReport,
  onOpenSpecialPracticeTopic,
  onGoToSpecialPractice,
  onGoToAdmin,
  onNavigate
}: PublicMePageProps) {
  const { locale, t } = useI18n();
  const [activeSection, setActiveSection] = useState<AccountSectionKey>(() => readAccountSection());
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [specialSessions, setSpecialSessions] = useState<SpecialPracticeSessionHistory[]>([]);
  const [mockAttempts, setMockAttempts] = useState<MockExamAttemptHistory[]>([]);
  const [wrongQuestions, setWrongQuestions] = useState<CscaWrongQuestionItem[]>([]);
  const [wrongQuestionReviewPacks, setWrongQuestionReviewPacks] = useState<CscaWrongQuestionReviewPack[]>([]);
  const [reviewQueue, setReviewQueue] = useState<CscaReviewQueue | null>(null);
  const [aiCredits, setAiCredits] = useState<MyAICredits | null>(null);
  const [activityView, setActivityView] = useState<HeatmapMode>('day');
  const [wrongQuestionFilters, setWrongQuestionFilters] = useState<AccountWrongQuestionFilters>(() => readAccountWrongQuestionFilters());
  const [expandedWrongQuestionKey, setExpandedWrongQuestionKey] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [studentProfileDraft, setStudentProfileDraft] = useState<StudentProfileDraft>(EMPTY_STUDENT_PROFILE_DRAFT);
  const [agentLearningSettings, setAgentLearningSettings] = useState<AgentLearningSettings | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWrongQuestions, setIsLoadingWrongQuestions] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingStudentProfile, setIsSavingStudentProfile] = useState(false);
  const [isSavingAgentGoal, setIsSavingAgentGoal] = useState(false);
  const [isSavingAgentAvailability, setIsSavingAgentAvailability] = useState(false);
  const [isJoiningOrganization, setIsJoiningOrganization] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const user = currentUser;

  useEffect(() => {
    setDisplayName(currentUser?.displayName ?? '');
  }, [currentUser?.displayName]);

  useEffect(() => {
    writeAccountUrlState(activeSection, wrongQuestionFilters, 'replace');
  }, [activeSection, wrongQuestionFilters]);

  useEffect(() => {
    if (isResolvingAuth || !user) return;
    let isCurrent = true;
    setIsLoading(true);
    void Promise.allSettled([
      getMyLearningDashboard(locale),
      getMyCscaReviewQueue({ language: locale }),
      getMySpecialPracticeSessions(),
      getMyMockExamAttempts(),
      getMyCscaWrongQuestions(),
      getMyAICredits(),
      getMyStudentProfile(),
      getMyAgentLearningSettings()
    ]).then((results) => {
      if (!isCurrent) return;
      const [dashboardResult, reviewQueueResult, practiceResult, mockResult, wrongResult, creditsResult, studentProfileResult, agentSettingsResult] = results;
      setDashboard(dashboardResult.status === 'fulfilled' ? dashboardResult.value : null);
      setReviewQueue(reviewQueueResult.status === 'fulfilled' ? reviewQueueResult.value : null);
      setSpecialSessions(practiceResult.status === 'fulfilled' ? practiceResult.value.items : []);
      setMockAttempts(mockResult.status === 'fulfilled' ? mockResult.value.items : []);
      setWrongQuestions(wrongResult.status === 'fulfilled' ? wrongResult.value.items : []);
      setWrongQuestionReviewPacks(wrongResult.status === 'fulfilled' ? wrongResult.value.reviewPacks ?? [] : []);
      setAiCredits(creditsResult.status === 'fulfilled' ? creditsResult.value : null);
      if (studentProfileResult.status === 'fulfilled') setStudentProfileDraft(studentProfileToDraft(studentProfileResult.value));
      setAgentLearningSettings(agentSettingsResult.status === 'fulfilled' ? agentSettingsResult.value : null);
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      setStatus(failedCount ? t('me.status.partialLoadFailed', '部分学习数据暂时无法加载，账号登录状态仍保留。请稍后刷新这一页。') : null);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [isResolvingAuth, locale, user]);

  const prioritySection = chooseNextSection(dashboard, wrongQuestions.length);
  const metrics = metricItems(dashboard, t);
  const latestPractice = specialSessions.slice(0, 8);
  const latestMocks = mockAttempts.slice(0, 8);
  const visibleWrongQuestions = useMemo(() => applyWrongQuestionDueFilter(wrongQuestions, wrongQuestionFilters), [wrongQuestionFilters, wrongQuestions]);
  const latestWrongQuestions = visibleWrongQuestions.slice(0, 10);
  const dueReviewItems = (reviewQueue?.items ?? []).filter((item) => item.due || isReviewDue(item.nextReviewAt));
  const visibleWrongQuestionReviewPacks = wrongQuestionReviewPacks.slice(0, 4);
  const wrongBankSummary = useMemo(() => {
    const topPack = [...wrongQuestionReviewPacks].sort((a, b) => b.dueCount - a.dueCount || b.count - a.count || b.confidence - a.confidence)[0] ?? null;
    return {
      total: wrongQuestions.length,
      dueCount: wrongQuestions.filter((item) => isReviewDue(item.nextReviewAt)).length,
      aiExplainedCount: wrongQuestions.filter((item) => item.structuredExplanation || item.aiExplanationId).length,
      topPack
    };
  }, [wrongQuestionReviewPacks, wrongQuestions]);
  const wrongQuestionFilterOptions = useMemo(() => {
    const modules = Array.from(new Set([...specialSessions.map((item) => item.module), ...wrongQuestions.map((item) => item.topic.module)].filter(Boolean))).sort();
    const topics = Array.from(new Map([...specialSessions.map((item) => item.topic), ...wrongQuestions.map((item) => item.topic)].map((topic) => [topic.slug, topic])).values())
      .sort((a, b) => localizedText(a.title, locale).localeCompare(localizedText(b.title, locale), intlLocale(locale)));
    const tags = Array.from(new Set(wrongQuestions.flatMap((item) => item.knowledgeTags))).sort((a, b) => localizedText(a, locale).localeCompare(localizedText(b, locale), intlLocale(locale)));
    const patternTypes = Array.from(new Map([
      ...wrongQuestionReviewPacks.map((pack) => [pack.patternType, { patternType: pack.patternType, label: pack.label }] as const),
      ...wrongQuestions.map((item) => [item.patternType, { patternType: item.patternType, label: item.patternLabel }] as const)
    ]).values()).sort((a, b) => localizedText(a.label, locale).localeCompare(localizedText(b.label, locale), intlLocale(locale)));
    return { modules, topics, tags, patternTypes };
  }, [locale, specialSessions, wrongQuestionReviewPacks, wrongQuestions]);
  const recentPracticePreview = latestPractice.slice(0, 4);
  const recentMockPreview = latestMocks.slice(0, 3);
  const recentWrongPreview = latestWrongQuestions.slice(0, 4);
  const organizationName = aiCredits?.organization?.name
    ?? aiCredits?.organizationOptions?.find((option) => option.current)?.name
    ?? null;
  const aiCreditLabel = aiCredits
    ? aiCredits.unlimited
      ? t('me.credit.unlimited', '不限')
      : `${aiCredits.balanceUnits} ${t('me.units.times', '次')}`
    : isLoading
      ? t('me.common.loading', '读取中')
      : t('me.common.notLoaded', '暂未读取');
  const displayTitle = user?.displayName || user?.email?.split('@')[0] || t('me.profile.defaultTitle', 'CSCA 学员');

  const navLabels: Record<AccountSectionKey, string> = {
    overview: t('me.nav.overview', '个人信息'),
    learning: t('me.nav.learning', '学习概览'),
    settings: t('me.nav.settings', '账号设置'),
    practice: t('me.nav.practice', '练习记录'),
    wrongQuestions: t('me.nav.wrongQuestions', '错题复盘'),
    mockExams: t('me.nav.mockExams', '在线模考')
  };
  const navMeta: Record<AccountSectionKey, number | null> = {
    overview: null,
    learning: null,
    settings: null,
    practice: specialSessions.length,
    wrongQuestions: wrongQuestions.length,
    mockExams: mockAttempts.length
  };

  const overviewSummary = useMemo(() => [
    { key: 'practice' as const, label: t('me.nav.practice', '练习记录'), value: specialSessions.length, note: t('me.summary.practiceNote', '科目训练沉淀') },
    { key: 'wrongQuestions' as const, label: t('me.nav.wrongQuestions', '错题复盘'), value: wrongQuestions.length, note: t('me.summary.wrongNote', '优先处理薄弱点') },
    { key: 'mockExams' as const, label: t('me.nav.mockExams', '在线模考'), value: mockAttempts.length, note: t('me.summary.mockNote', '检查节奏和综合水平') }
  ], [mockAttempts.length, specialSessions.length, t, wrongQuestions.length]);

  const taskCards: AccountOverviewTaskCard[] = [
    {
      key: 'practice',
      meta: specialSessions.length ? `${specialSessions.length} ${t('me.units.practiceSessions', '次练习')}` : t('me.tasks.startHere', '先从这里开始'),
      title: specialSessions.length ? t('me.tasks.continuePracticeTitle', '继续科目训练') : t('me.tasks.firstDiagnosticTitle', '先完成一次 20 题诊断'),
      body: t('me.tasks.practiceBody', '系统会根据薄弱知识点安排下一轮训练。'),
      onClick: onGoToSpecialPractice
    },
    {
      key: 'wrongQuestions',
      meta: wrongQuestions.length ? `${wrongQuestions.length} ${t('me.units.wrongQuestions', '道错题')}` : t('me.empty.noWrongShort', '暂无错题'),
      title: wrongQuestions.length ? t('me.tasks.reviewFrequentTitle', '先复盘高频错因') : t('me.tasks.wrongAutoArchiveTitle', '错题会自动归档'),
      body: t('me.tasks.wrongBody', '训练和模考的错题会放在这里，按知识点回到练习。'),
      onClick: () => setActiveSection('wrongQuestions')
    },
    {
      key: 'mockExams',
      meta: mockAttempts.length ? `${mockAttempts.length} ${t('me.units.mockAttempts', '次模考')}` : t('me.tasks.fullCheck', '完整检验'),
      title: t('me.tasks.mockPaceTitle', '用在线模考检查节奏'),
      body: t('me.tasks.mockBody', '完成科目训练后，用 60 分钟模考确认掌握度。'),
      onClick: onGoToMockExam
    }
  ];

  async function saveDisplayName() {
    const nextName = displayName.trim();
    if (!nextName || nextName.length > 40) {
      setStatus(t('me.status.displayNameInvalid', '显示名需要 1-40 个字符。'));
      return;
    }
    setIsSavingName(true);
    try {
      await updateMeProfile({ displayName: nextName });
      const nextUser = await getMe();
      onCurrentUserChange(nextUser);
      setStatus(t('me.status.displayNameUpdated', '显示名已更新。'));
    } catch {
      setStatus(t('me.status.displayNameSaveFailed', '显示名暂时无法保存。'));
    } finally {
      setIsSavingName(false);
    }
  }

  async function saveStudentProfile() {
    setIsSavingStudentProfile(true);
    try {
      const profile = await updateMyStudentProfile(studentProfileDraftPayload(studentProfileDraft));
      setStudentProfileDraft(studentProfileToDraft(profile));
      setStatus(t('me.status.studentProfileUpdated', '学习档案已更新。'));
    } catch {
      setStatus(t('me.status.studentProfileSaveFailed', '学习档案暂时无法保存。'));
    } finally {
      setIsSavingStudentProfile(false);
    }
  }

  async function saveAgentScoreGoal(payload: Parameters<typeof updateMyAgentScoreGoal>[0]) {
    setIsSavingAgentGoal(true);
    try {
      const scoreGoal = await updateMyAgentScoreGoal(payload);
      setAgentLearningSettings((current) => ({
        currentScoringPolicyVersion: current?.currentScoringPolicyVersion ?? 'csca-score-unverified-v1',
        scoreGoal,
        studyAvailability: current?.studyAvailability ?? {
          availabilityVersion: 'unset', timezone: 'Asia/Shanghai', weeklyMinutesGoal: null,
          preferredStudyDays: [], defaultSessionMinutes: null, source: 'unset', effectiveAt: null
        }
      }));
      setStudentProfileDraft((current) => ({
        ...current,
        targetExamMonth: payload.examDate.slice(0, 7),
        targetSubjectCodes: payload.subjectGoals.map((item) => item.subject)
      }));
      setStatus(t('me.status.agentGoalUpdated', '考试目标已更新，Agent 将基于新版本重新制定方案。'));
    } catch {
      setStatus(t('me.status.agentGoalSaveFailed', '考试目标暂时无法保存，请刷新后重试。'));
    } finally {
      setIsSavingAgentGoal(false);
    }
  }

  async function saveAgentStudyAvailability(payload: Parameters<typeof updateMyAgentStudyAvailability>[0]) {
    setIsSavingAgentAvailability(true);
    try {
      const studyAvailability = await updateMyAgentStudyAvailability(payload);
      setAgentLearningSettings((current) => ({
        currentScoringPolicyVersion: current?.currentScoringPolicyVersion ?? 'csca-score-unverified-v1',
        scoreGoal: current?.scoreGoal ?? { status: 'unset', goal: null },
        studyAvailability
      }));
      setStatus(t('me.status.agentScheduleUpdated', '学习时间已更新，后续方案会使用新的时间容量。'));
    } catch {
      setStatus(t('me.status.agentScheduleSaveFailed', '学习时间暂时无法保存，请检查时区和分钟数。'));
    } finally {
      setIsSavingAgentAvailability(false);
    }
  }

  async function handleResendVerification() {
    setIsResendingVerification(true);
    try {
      const result = await resendEmailVerification();
      setStatus(result.alreadyVerified
        ? t('me.status.emailAlreadyVerified', '邮箱已经完成验证。')
        : t('me.status.verificationSent', '验证邮件已发送，请检查收件箱。'));
    } catch {
      setStatus(t('me.status.verificationSendFailed', '验证邮件暂时无法发送，请稍后重试。'));
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function joinOrganization() {
    const token = organizationInviteTokenFromInput(inviteInput);
    if (!token) {
      setStatus(t('me.status.inviteRequired', '请输入机构邀请码、邀请链接或 token。'));
      return;
    }
    setIsJoiningOrganization(true);
    try {
      const result = isShortOrganizationInviteCode(token)
        ? await acceptOrganizationInviteCode(token)
        : await acceptOrganizationInvite(token);
      setInviteInput('');
      setStatus(t('me.status.joinedOrganization', '已加入 {name}。').replace('{name}', result.organization.name));
    } catch {
      setStatus(t('me.status.inviteFailed', '机构邀请码暂时无法使用。'));
    } finally {
      setIsJoiningOrganization(false);
    }
  }

  async function handleLogout() {
    await logout();
    onCurrentUserChange(null);
    onNavigate(routes.home);
  }

  async function refreshReviewContext() {
    const [queueResult, dashboardResult, wrongResult] = await Promise.allSettled([
      getMyCscaReviewQueue({ language: locale }),
      getMyLearningDashboard(locale),
      getMyCscaWrongQuestions({
        subject: wrongQuestionFilters.subject || undefined,
        module: wrongQuestionFilters.module || undefined,
        topicSlug: wrongQuestionFilters.topicSlug || undefined,
        knowledgeTag: wrongQuestionFilters.knowledgeTag || undefined,
        patternType: wrongQuestionFilters.patternType || undefined
      })
    ]);
    if (queueResult.status === 'fulfilled') setReviewQueue(queueResult.value);
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value);
    if (wrongResult.status === 'fulfilled') {
      setWrongQuestions(wrongResult.value.items);
      setWrongQuestionReviewPacks(wrongResult.value.reviewPacks ?? []);
    }
  }

  async function completeReviewQueueItem(item: CscaReviewQueue['items'][number]) {
    const actionKey = `review:${item.id}`;
    setPendingActionKey(actionKey);
    setStatus(null);
    try {
      const completed = await completeMyCscaReviewQueueItem(item.id);
      await refreshReviewContext();
      if (completed.verificationRequired && completed.verificationHref) {
        setStatus(t('me.status.reviewRecordedVerify', '已记录复盘，现在去做同类题验证是否真的修好。'));
        onNavigate(stripLocalePrefix(completed.verificationHref));
      } else {
        setStatus(completed.nextReviewAt
          ? t('me.status.reviewRecordedNext', '已记录复盘，下次复习：{date}。').replace('{date}', formatDate(completed.nextReviewAt, locale, t('me.common.notCompleted', '尚未完成')))
          : t('me.status.reviewRecorded', '已记录复盘。'));
      }
    } catch {
      setStatus(t('me.status.reviewUpdateFailed', '复盘状态暂时无法更新。'));
    } finally {
      setPendingActionKey((current) => current === actionKey ? null : current);
    }
  }

  async function completeWrongQuestionReview(item: CscaWrongQuestionItem) {
    if (item.reviewPattern) {
      const actionKey = `review:${item.reviewPattern.id}`;
      setPendingActionKey(actionKey);
      setStatus(null);
      try {
        const completed = await completeMyCscaReviewQueueItem(item.reviewPattern.id);
        await refreshReviewContext();
        if (completed.verificationRequired && completed.verificationHref) {
          setStatus(t('me.status.reviewRecordedVerify', '已记录复盘，现在去做同类题验证是否真的修好。'));
          onNavigate(stripLocalePrefix(completed.verificationHref));
        } else {
          setStatus(t('me.status.reviewRecorded', '已记录复盘。'));
        }
      } catch {
        setStatus(t('me.status.reviewUpdateFailed', '复盘状态暂时无法更新。'));
      } finally {
        setPendingActionKey((current) => current === actionKey ? null : current);
      }
      return;
    }

    const actionKey = `wrong-review:${item.itemKey}`;
    setPendingActionKey(actionKey);
    setStatus(null);
    try {
      const completed = await completeMyCscaWrongQuestionReview({
        subject: String(item.subject),
        topicId: item.topicId,
        patternType: item.patternType,
        questionId: item.questionId,
        sourceType: item.sourceType
      });
      await refreshReviewContext();
      if (completed.verificationRequired && completed.verificationHref) {
        setStatus(t('me.status.reviewRecordedVerify', '已记录复盘，现在去做同类题验证是否真的修好。'));
        onNavigate(stripLocalePrefix(completed.verificationHref));
      } else {
        setStatus(t('me.status.reviewRecorded', '已记录复盘。'));
      }
    } catch {
      setStatus(t('me.status.reviewUpdateFailed', '复盘状态暂时无法更新。'));
    } finally {
      setPendingActionKey((current) => current === actionKey ? null : current);
    }
  }

  async function reloadWrongQuestions(filters = wrongQuestionFilters) {
    setIsLoadingWrongQuestions(true);
    setStatus(null);
    try {
      const response = await getMyCscaWrongQuestions({
        subject: filters.subject || undefined,
        module: filters.module || undefined,
        topicSlug: filters.topicSlug || undefined,
        knowledgeTag: filters.knowledgeTag || undefined,
        patternType: filters.patternType || undefined
      });
      setWrongQuestions(response.items);
      setWrongQuestionReviewPacks(response.reviewPacks ?? []);
      setExpandedWrongQuestionKey(null);
    } catch {
      setStatus(t('me.status.wrongBankRefreshFailed', '错题本暂时无法刷新。'));
    } finally {
      setIsLoadingWrongQuestions(false);
    }
  }

  function updateWrongQuestionFilter(key: keyof AccountWrongQuestionFilters, value: string | boolean) {
    const nextFilters = { ...wrongQuestionFilters, [key]: value };
    setWrongQuestionFilters(nextFilters);
    setActiveSection('wrongQuestions');
    void reloadWrongQuestions(nextFilters);
  }

  function clearWrongQuestionFilters() {
    const nextFilters = emptyAccountWrongQuestionFilters();
    setWrongQuestionFilters(nextFilters);
    setActiveSection('wrongQuestions');
    void reloadWrongQuestions(nextFilters);
  }

  function openWrongQuestionPack(patternType: string) {
    updateWrongQuestionFilter('patternType', wrongQuestionFilters.patternType === patternType ? '' : patternType);
  }

  function openReadinessAction(action: LearningDashboard['readiness']['nextAction']) {
    void recordMyReadinessActionClick({
      type: action.type,
      href: action.href,
      stage: dashboard?.readiness.stage,
      score: dashboard?.readiness.score,
      dimensions: dashboard?.readiness.dimensions,
      source: 'me_overview'
    });
    onNavigate(stripLocalePrefix(action.href));
  }

  if (isResolvingAuth) {
    return (
      <div className="me-page brand-page">
        <section className="loading-state"><p>{t('me.auth.resolving', '正在确认登录状态...')}</p></section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="me-page brand-page">
        <section className="me-auth-gate">
          <p className="page-kicker">{t('me.auth.kicker', '我的账号')}</p>
          <h1>{t('me.auth.title', '登录后，把 CSCA 练习记录接起来。')}</h1>
          <p>{t('me.auth.body', '登录后可以保留在线模考、科目训练、错题复盘、AI 额度和机构邀请码记录。')}</p>
          <div className="inline-actions">
            <button type="button" onClick={onGoToAuth}>{t('me.auth.loginCta', '去登录 / 注册')}</button>
            <button type="button" onClick={onGoToSpecialPractice}>{t('me.auth.practiceCta', '先做科目训练')}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="me-page brand-page">
      <div className="me-account-workspace">
        <aside className="me-account-workspace-sidebar">
          <div className="me-account-workspace-sidebar-head">
            <strong>{t('me.profile.workspace', '个人主页')}</strong>
            <span>{t('me.nav.aria', '我的账号页内导航')}</span>
          </div>
          <AccountSectionNav
            activeSection={activeSection}
            ariaLabel={t('me.nav.aria', '我的账号页内导航')}
            labels={navLabels}
            navMeta={navMeta}
            sections={SECTION_KEYS}
            onSelect={setActiveSection}
          />
        </aside>

        <main className="me-account-workspace-main">
          {status && activeSection !== 'settings' && <p className="me-status-message" role="status">{status}</p>}

      {activeSection === 'overview' && (
        <div className="me-profile-overview-page">
          <div className="me-account-hero me-account-hero-bare">
            <UserAvatar user={user} size="lg" className="me-account-avatar" />
            <h1>{displayTitle}</h1>
            <p>{user.email}</p>
            <div className="me-account-badges">
              {user.role === 'admin' && <span>{t('me.profile.admin', '管理员')}</span>}
              <span>{user.emailVerifiedAt ? t('me.profile.emailVerified', '邮箱已验证') : t('me.profile.emailUnverified', '邮箱未验证')}</span>
            </div>
            <dl className="me-metric-row me-metric-row-compact" aria-label={t('me.profile.metricsAria', '账号学习状态')}>
              {metrics.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}{item.suffix}</dd>
                </div>
              ))}
            </dl>
          </div>

          {!user.emailVerifiedAt && (
            <section className="me-email-verification-warning" role="status">
              <p>{t('me.verification.warning', '邮箱未验证，部分账号安全功能可能受限。')}</p>
              <button type="button" disabled={isResendingVerification} onClick={() => void handleResendVerification()}>
                {isResendingVerification
                  ? t('me.verification.sending', '正在发送...')
                  : t('me.verification.resend', '重发验证邮件')}
              </button>
            </section>
          )}

          <section className="me-account-activity" aria-busy={isLoading}>
            <LearningHeatmap
              dashboard={dashboard}
              title={t('me.activity.title', '学习活动')}
              body={t('me.activity.body', '深色代表当天完成了更多真实训练。只浏览页面不会点亮。')}
              locale={locale}
              t={t}
              view={activityView}
              onViewChange={setActivityView}
            />
          </section>
        </div>
      )}

      {activeSection === 'learning' && (
        <div className="me-learning-overview-page">
          <section className="me-study-resource-strip" aria-label={t('me.resources.aria', '做题资源状态')}>
            <article>
              <span>{t('me.resources.aiCredit', 'AI Coach 额度')}</span>
              <strong>{aiCreditLabel}</strong>
              <p>{t('me.resources.aiCreditBody', '用于做题时的提示、错因解析和本轮总结。')}</p>
              <button type="button" onClick={() => setActiveSection('settings')}>{t('me.resources.manageCredit', '管理额度')}</button>
            </article>
            <article>
              <span>{t('me.resources.organizationInvite', '机构邀请码')}</span>
              <strong>{organizationName ?? t('me.resources.personalAccount', '个人账号')}</strong>
              <p>{t('me.resources.organizationInviteBody', '老师或机构发的邀请码在这里绑定，用于班级出题和额度。')}</p>
              <button type="button" onClick={() => setActiveSection('settings')}>{t('me.resources.enterInvite', '输入邀请码')}</button>
            </article>
            <article>
              <span>{t('me.resources.continueLearning', '继续做题')}</span>
              <strong>{wrongQuestions.length ? t('me.resources.reviewWrongFirst', '先复盘错题') : t('me.resources.enterPractice', '进入科目训练')}</strong>
              <p>{t('me.resources.continueBody', '练习、模考和错题本会自动沉淀到个人主页。')}</p>
              <button type="button" onClick={wrongQuestions.length ? () => setActiveSection('wrongQuestions') : onGoToSpecialPractice}>
                {wrongQuestions.length ? t('me.actions.viewWrong', '查看错题') : t('me.actions.startPractice', '开始训练')}
              </button>
            </article>
          </section>

        <AccountOverviewSection
          nextAction={{
            title: prioritySection === 'wrongQuestions' ? t('me.next.wrongTitle', '先处理错题复盘') : prioritySection === 'practice' ? t('me.next.practiceTitle', '先完成一轮科目训练') : t('me.next.mockTitle', '进入完整模考'),
            body: prioritySection === 'wrongQuestions'
              ? t('me.next.wrongBody', '错题会暴露最直接的薄弱点，先修复再继续刷题。')
              : prioritySection === 'practice'
                ? t('me.next.practiceBody', '先用小轮训练建立稳定手感，再进 60 分钟模考。')
                : t('me.next.mockBody', '已有练习基础后，用模考检查时间分配和综合掌握度。'),
            label: prioritySection === 'mockExams' ? t('me.actions.startMock', '开始模考') : t('me.actions.startHandling', '开始处理')
          }}
          nextStepLabel={t('me.next.label', '下一步建议')}
          prioritySection={prioritySection}
          summaryAriaLabel={t('me.summary.aria', '账号学习概览')}
          summaryItems={overviewSummary}
          taskCards={taskCards}
          onJumpToSection={setActiveSection}
          onRunNextAction={() => {
            if (prioritySection === 'mockExams') onGoToMockExam();
            else if (prioritySection === 'wrongQuestions') setActiveSection('wrongQuestions');
            else onGoToSpecialPractice();
          }}
        >
          <section className="me-overview-records" aria-label={t('me.overview.recordsAria', '学习记录和统计')}>
            <LearningTrendPanel dashboard={dashboard} t={t} />

            <section className="me-learning-dashboard-restored" aria-label={t('me.learningDashboard.aria', '做题学习仪表盘')}>
              <article className="me-readiness-panel">
                <div className="me-readiness-score" style={{ '--readiness-score': dashboard?.readiness.score ?? 0 } as CSSProperties}>
                  <strong>{dashboard?.readiness.score ?? 0}<span>/100</span></strong>
                  <small>{dashboard?.readiness.confidence ? t('me.readiness.confidence', '置信度 {value}').replace('{value}', dashboard.readiness.confidence) : t('me.readiness.calibrating', '待校准')}</small>
                </div>
                <div>
                  <p className="page-kicker">{t('me.readiness.kicker', '备考准备度')}</p>
                  <h3>{dashboard?.readiness.title ?? t('me.readiness.emptyTitle', '完成一次 20 题诊断后，这里会亮起来。')}</h3>
                  <p>{dashboard?.readiness.body ?? t('me.readiness.emptyBody', '准备度会综合题量、知识覆盖、模考、复盘和学习节奏，不是单纯正确率。')}</p>
                </div>
                {dashboard?.readiness.nextAction && (
                  <button type="button" onClick={() => openReadinessAction(dashboard.readiness.nextAction)}>
                    {dashboard.readiness.nextAction.ctaLabel}
                  </button>
                )}
                {dashboard?.readiness.dimensions?.length ? (
                  <div className="me-readiness-dimensions" aria-label={t('me.readiness.dimensionsAria', '准备度维度')}>
                    {dashboard.readiness.dimensions.map((dimension) => (
                      <section key={dimension.key}>
                        <span>{dimension.label}</span>
                        <strong>{dimension.score}/{dimension.maxScore}</strong>
                        <p>{dimension.evidence}</p>
                    </section>
                  ))}
                </div>
              ) : null}
              </article>

              <article className="me-review-queue-panel">
                <div className="me-record-head">
                  <div>
                    <p className="page-kicker">{t('me.reviewQueue.kicker', '今日复盘')}</p>
                    <h3>{dueReviewItems.length ? t('me.reviewQueue.dueTitle', '先处理到期错因') : t('me.reviewQueue.emptyTitle', '今天没有必须复盘的错因')}</h3>
                    <p>{dueReviewItems.length ? t('me.reviewQueue.dueBody', '按到期时间和重复次数安排，先修复这些再继续刷题。') : t('me.reviewQueue.emptyBody', '保持下一轮训练即可，新的错题会自动进入复盘队列。')}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>{t('me.reviewQueue.due', '到期')}</dt>
                      <dd>{reviewQueue?.summary.dueToday ?? dueReviewItems.length}</dd>
                    </div>
                    <div>
                      <dt>{t('me.reviewQueue.queue', '队列')}</dt>
                      <dd>{reviewQueue?.summary.total ?? 0}</dd>
                    </div>
                  </dl>
                </div>
                <div className="me-review-queue-list">
                  {dueReviewItems.slice(0, 4).map((item) => (
                    <section key={item.id}>
                      <div>
                        <span>{item.subjectLabel} · {item.label}</span>
                        <strong>{item.topicTitle}</strong>
                        <p>{item.recurrenceCount} {t('me.units.times', '次')} · {item.verificationRequired ? t('me.reviewQueue.waitingVerification', '待同类题验证') : t('me.reviewQueue.waitingReview', '待复盘确认')}</p>
                      </div>
                      <div>
                        <button type="button" onClick={() => setActiveSection('wrongQuestions')}>{t('me.actions.viewWrong', '查看错题')}</button>
                        {item.verificationRequired ? (
                          <button type="button" onClick={() => onNavigate(stripLocalePrefix(item.verificationHref))}>{t('me.actions.verifyRepair', '验证修复')}</button>
                        ) : (
                          <button type="button" disabled={pendingActionKey === `review:${item.id}`} onClick={() => void completeReviewQueueItem(item)}>
                            {pendingActionKey === `review:${item.id}` ? t('me.common.recording', '记录中...') : t('me.actions.understoodVerify', '已看懂，去验证')}
                          </button>
                        )}
                      </div>
                    </section>
                  ))}
                  {!dueReviewItems.length && <p>{t('me.reviewQueue.noDue', '暂无到期复盘。完成更多训练后，这里会按错因自动排队。')}</p>}
                </div>
              </article>

              <article className="me-ai-insight-panel me-learning-summary-panel">
                <div>
                  <p className="page-kicker">{t('me.aiInsight.kicker', 'AI 学习建议')}</p>
                  <h3>{dashboard?.aiInsight?.status === 'ready' ? t('me.aiInsight.readyTitle', '根据练习记录生成') : t('me.aiInsight.emptyTitle', '继续做题后会更具体')}</h3>
                  <p>{dashboard?.aiInsight?.summary || dashboard?.learningSummary?.summary || t('me.aiInsight.emptyBody', 'AI 会基于训练、模考和错题复盘整理下一步建议。')}</p>
                </div>
                {dashboard?.aiInsight?.actions?.length ? (
                  <ul>
                    {dashboard.aiInsight.actions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}
                  </ul>
                ) : null}
                <div className="me-compact-learning-stats">
                  <section>
                    <span>{t('me.mastery.kicker', '科目掌握')}</span>
                    <strong>{t('me.mastery.title', '薄弱科目和知识覆盖')}</strong>
                    <div>
                  {(dashboard?.masteryTrend ?? []).slice(0, 3).map((subject) => (
                        <p key={subject.subject}>
                          <b>{subject.subjectLabel}</b>
                          <i style={{ width: `${Math.max(6, subject.currentMastery ?? 0)}%` }} />
                          <em>{subject.currentMastery === null ? '-' : `${subject.currentMastery}%`} · {subject.weakTopicCount} {t('me.mastery.weakPoints', '个薄弱点')}</em>
                        </p>
                  ))}
                      {!dashboard?.masteryTrend?.length && <p>{t('me.mastery.empty', '完成科目训练后显示掌握变化。')}</p>}
                    </div>
                  </section>
                  <section>
                    <span>{t('me.mockTrend.kicker', '模考趋势')}</span>
                    <strong>{dashboard?.mockTrend?.latest
                      ? t('me.mockTrend.latest', '{subject} 最近 {score} 分')
                        .replace('{subject}', dashboard.mockTrend.latest.subjectLabel)
                        .replace('{score}', String(dashboard.mockTrend.latest.score))
                      : t('me.mockTrend.emptyTitle', '完成一次模考后显示节奏')}</strong>
                    <p>{dashboard?.mockTrend?.nextAction?.body ?? t('me.mockTrend.emptyBody', '用 60 分钟模考检查时间分配和综合掌握度。')}</p>
                  </section>
                </div>
              </article>
            </section>

            <article className="me-record-preview">
              <div className="me-record-head">
                <div>
                  <p className="page-kicker">{t('me.records.kicker', '学习记录')}</p>
                  <h3>{t('me.records.title', '最近练习、错题和模考')}</h3>
                </div>
                <button type="button" onClick={() => setActiveSection('practice')}>{t('me.actions.viewAll', '查看全部')}</button>
              </div>
              <div className="me-record-columns">
                <section>
                  <h4>{t('me.nav.practice', '练习记录')}</h4>
                  {recentPracticePreview.map((session) => (
                    <button key={session.id} type="button" onClick={() => onOpenSpecialPracticeReport(session.reportPath)}>
                      <strong>{localizedText(session.topic.title, locale) || t('me.common.subjectPractice', '科目训练')}</strong>
                      <span>{subjectLabel(session.subject, t)} · {session.completedAt ? formatAccuracy(session.accuracy) : t('me.common.inProgress', '进行中')}</span>
                    </button>
                  ))}
                  {!recentPracticePreview.length && <p>{t('me.empty.noPractice', '还没有练习记录。')}</p>}
                </section>
                <section>
                  <h4>{t('me.nav.wrongQuestions', '错题复盘')}</h4>
                  {recentWrongPreview.map((item) => (
                    <button key={item.itemKey} type="button" onClick={() => onOpenSpecialPracticeTopic(item.topic.subject, item.topic.slug)}>
                      <strong title={localizedText(item.prompt, locale)}>{wrongQuestionPreviewTitle(item, locale, t('me.common.wrongQuestionRecord', '错题记录'))}</strong>
                      <span>{subjectLabel(item.subject, t)} · {localizedText(item.patternLabel, locale)} · {t('me.common.answer', '答案')} {item.correctAnswer}</span>
                    </button>
                  ))}
                  {!recentWrongPreview.length && <p>{t('me.empty.noWrongShort', '暂无错题。')}</p>}
                </section>
                <section>
                  <h4>{t('me.nav.mockExams', '在线模考')}</h4>
                  {recentMockPreview.map((attempt) => (
                    <button key={attempt.id} type="button" onClick={() => onOpenMockExamReport(attempt.reportPath || attempt.attemptPath || routes.cscaMockExam)}>
                      <strong>{attempt.paper.title}</strong>
                      <span>{attempt.submittedAt ? `${attempt.score ?? 0}/100 · ${formatDate(attempt.submittedAt, locale, t('me.common.notCompleted', '尚未完成'))}` : t('me.common.inProgress', '进行中')}</span>
                    </button>
                  ))}
                  {!recentMockPreview.length && <p>{t('me.empty.noMock', '还没有模考记录。')}</p>}
                </section>
              </div>
            </article>
          </section>
        </AccountOverviewSection>
        </div>
      )}

      {activeSection === 'practice' && (
        <section className="me-section-card">
          <div className="me-section-head">
            <div>
              <p className="page-kicker">{t('me.nav.practice', '练习记录')}</p>
              <h2>{t('me.practice.title', '最近科目训练')}</h2>
            </div>
            <button type="button" onClick={onGoToSpecialPractice}>{t('me.actions.enterPractice', '进入科目训练')}</button>
          </div>
          <div className="me-practice-list">
            {latestPractice.map((session, index) => (
              <article key={session.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{localizedText(session.topic.title, locale)} · {session.completedAt ? formatAccuracy(session.accuracy) : t('me.common.inProgress', '进行中')}</strong>
                  <p>{subjectLabel(session.subject, t)} / {localizedText(session.module, locale)} · {formatDate(session.completedAt ?? session.startedAt, locale, t('me.common.notCompleted', '尚未完成'))}</p>
                </div>
                <button type="button" onClick={() => onOpenSpecialPracticeReport(session.reportPath)}>
                  {session.completedAt ? t('me.actions.report', '报告') : t('me.actions.continue', '继续')}
                </button>
              </article>
            ))}
            {!latestPractice.length && <p>{t('me.practice.empty', '还没有练习记录。先完成一次科目训练，这里会自动归档。')}</p>}
          </div>
        </section>
      )}

      {activeSection === 'wrongQuestions' && (
        <section className="me-section-card">
          <div className="me-section-head">
            <div>
              <p className="page-kicker">{t('me.nav.wrongQuestions', '错题复盘')}</p>
              <h2>{t('me.wrongBank.title', '统一错题本')}</h2>
              <p>{t('me.wrongBank.body', '训练和模考中的错题会放在一起，按错因、知识点和到期时间安排复盘。')}</p>
            </div>
            <button type="button" onClick={clearWrongQuestionFilters} disabled={isLoadingWrongQuestions}>{t('me.actions.resetFilters', '重置筛选')}</button>
          </div>

          <section className="me-wrong-bank-summary">
            <div>
              <span>{t('me.wrongBank.total', '错题总数')}</span>
              <strong>{wrongBankSummary.total}</strong>
            </div>
            <div>
              <span>{t('me.wrongBank.due', '到期复盘')}</span>
              <strong>{wrongBankSummary.dueCount}</strong>
            </div>
            <div>
              <span>{t('me.wrongBank.aiExplained', 'AI 解析')}</span>
              <strong>{wrongBankSummary.aiExplainedCount}</strong>
            </div>
          </section>

          {visibleWrongQuestionReviewPacks.length > 0 && (
            <section className="me-wrong-review-packs" aria-label={t('me.wrongBank.reviewPacks', '错因复习包')}>
              <div className="me-subsection-head">
                <div>
                  <strong>{t('me.wrongBank.reviewPacks', '错因复习包')}</strong>
                  <p>{t('me.wrongBank.reviewPacksBody', '同类错误先放在一起处理，优先看到期和高频错因。')}</p>
                </div>
              </div>
              <div className="me-wrong-review-pack-list">
                {visibleWrongQuestionReviewPacks.map((pack) => (
                  <button
                    key={pack.patternType}
                    type="button"
                    className={[
                      pack.dueCount ? 'due' : '',
                      wrongQuestionFilters.patternType === pack.patternType ? 'active' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => openWrongQuestionPack(pack.patternType)}
                  >
                    <span>{localizedText(pack.label, locale)}</span>
                    <strong>{pack.count}</strong>
                    <p>{pack.dueCount ? `${pack.dueCount} ${t('me.reviewQueue.due', '到期')} · ` : ''}{pack.topicTitles.slice(0, 2).map((title) => localizedText(title, locale)).join(' / ')}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="me-wrong-filters" aria-label={t('me.wrongFilters.aria', '错题筛选')}>
            <label>
              <span>{t('me.wrongFilters.subject', '科目')}</span>
              <select value={wrongQuestionFilters.subject} onChange={(event) => updateWrongQuestionFilter('subject', event.target.value)}>
                <option value="">{t('me.wrongFilters.allSubjects', '全部科目')}</option>
                {['math', 'physics', 'chemistry'].map((value) => <option key={value} value={value}>{subjectLabel(value, t)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('me.wrongFilters.module', '模块')}</span>
              <select value={wrongQuestionFilters.module} onChange={(event) => updateWrongQuestionFilter('module', event.target.value)}>
                <option value="">{t('me.wrongFilters.allModules', '全部模块')}</option>
                {wrongQuestionFilterOptions.modules.map((moduleName) => <option key={moduleName} value={moduleName}>{localizedText(moduleName, locale)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('me.wrongFilters.topic', '知识点')}</span>
              <select value={wrongQuestionFilters.topicSlug} onChange={(event) => updateWrongQuestionFilter('topicSlug', event.target.value)}>
                <option value="">{t('me.wrongFilters.allTopics', '全部知识点')}</option>
                {wrongQuestionFilterOptions.topics.map((topic) => <option key={topic.slug} value={topic.slug}>{localizedText(topic.title, locale)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('me.wrongFilters.tag', '标签')}</span>
              <select value={wrongQuestionFilters.knowledgeTag} onChange={(event) => updateWrongQuestionFilter('knowledgeTag', event.target.value)}>
                <option value="">{t('me.wrongFilters.allTags', '全部标签')}</option>
                {wrongQuestionFilterOptions.tags.map((tag) => <option key={tag} value={tag}>{localizedText(tag, locale)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('me.wrongFilters.pattern', '错因')}</span>
              <select value={wrongQuestionFilters.patternType} onChange={(event) => updateWrongQuestionFilter('patternType', event.target.value)}>
                <option value="">{t('me.wrongFilters.allPatterns', '全部错因')}</option>
                {wrongQuestionFilterOptions.patternTypes.map((pattern) => <option key={pattern.patternType} value={pattern.patternType}>{localizedText(pattern.label, locale)}</option>)}
              </select>
            </label>
            <label className="me-wrong-due-toggle">
              <input type="checkbox" checked={wrongQuestionFilters.dueOnly} onChange={(event) => updateWrongQuestionFilter('dueOnly', event.target.checked)} />
              <span>{t('me.wrongFilters.dueOnly', '只看到期复盘')}</span>
            </label>
          </div>

          <div className="me-wrong-list">
            {latestWrongQuestions.map((item) => {
              const itemKey = item.itemKey;
              const isExpanded = expandedWrongQuestionKey === itemKey;
              const reviewActionKey = item.reviewPattern ? `review:${item.reviewPattern.id}` : `wrong-review:${item.itemKey}`;
              return (
                <article key={item.itemKey} className={isExpanded ? 'expanded' : ''}>
                  <div className="me-wrong-summary">
                    <span>{subjectLabel(item.subject, t)} · {localizedText(item.topic.module, locale)}</span>
                    <strong><MathContent text={localizedText(item.prompt, locale)} /></strong>
                    <p>
                      {t('me.wrongDetail.yourAnswer', '你的答案')}: {item.selected || t('me.common.unanswered', '未作答')};{' '}
                      {t('me.wrongDetail.correctAnswer', '正确答案')}: {item.correctAnswer}.
                      {item.nextReviewAt ? ` ${t('me.wrongDetail.nextReview', '下次复盘：{date}').replace('{date}', formatDate(item.nextReviewAt, locale, t('me.common.notCompleted', '尚未完成')))} ` : ''}
                    </p>
                    <em>{localizedText(item.patternLabel, locale)} · {Math.round(item.patternConfidence * 100)}%</em>
                  </div>
                  <div className="me-wrong-actions">
                    <button type="button" onClick={() => setExpandedWrongQuestionKey(isExpanded ? null : itemKey)}>
                      {isExpanded ? t('me.actions.collapse', '收起') : t('me.actions.expandReview', '展开复盘')}
                    </button>
                    <button type="button" onClick={() => onOpenSpecialPracticeTopic(item.topic.subject, item.topic.slug)}>{t('me.actions.retryTopic', '重新练这个知识点')}</button>
                  </div>
                  {isExpanded && (
                    <div className="me-wrong-detail">
                      <section>
                        <h4>{t('me.wrongDetail.options', '选项回顾')}</h4>
                        <div className="me-wrong-options">
                          {item.options.map((option) => {
                            const isCorrect = option.id === item.correctAnswer;
                            const isSelected = option.id === item.selected || option.id === item.selectedAnswer;
                            return (
                              <p key={option.id} className={isCorrect ? 'correct' : isSelected ? 'wrong' : ''}>
                                <b>{option.id}</b>
                                <span><MathContent text={localizedText(option.text, locale)} /></span>
                                {isSelected && <em>{t('me.wrongDetail.yourAnswer', '你的答案')}</em>}
                                {isCorrect && <em>{t('me.wrongDetail.correctAnswer', '正确答案')}</em>}
                              </p>
                            );
                          })}
                        </div>
                      </section>
                      <section>
                        <h4>{t('me.wrongDetail.explanation', '解析')}</h4>
                        <p>{item.structuredExplanation?.correctApproach || item.explanation || t('me.wrongDetail.noExplanation', '暂无解析。')}</p>
                        {item.structuredExplanation && (
                          <div className="me-wrong-ai-grid">
                            <article><span>{t('me.wrongDetail.reason', '错因')}</span><p>{item.structuredExplanation.whyWrong}</p></article>
                            <article><span>{t('me.wrongDetail.quickMethod', '快法')}</span><p>{item.structuredExplanation.quickMethod}</p></article>
                            <article><span>{t('me.wrongDetail.avoidNextTime', '下次避免')}</span><p>{item.structuredExplanation.avoidNextTime}</p></article>
                          </div>
                        )}
                      </section>
                      {item.knowledgeTags.length > 0 && (
                        <section>
                          <h4>{t('me.wrongDetail.knowledgeTags', '知识点标签')}</h4>
                          <div className="me-wrong-tags">{item.knowledgeTags.map((tag) => <span key={tag}>{localizedText(tag, locale)}</span>)}</div>
                        </section>
                      )}
                      <section>
                        <h4>{t('me.nav.wrongQuestions', '错题复盘')}</h4>
                        {item.reviewPattern?.verificationStatus === 'verified_repaired' ? (
                          <p>{t('me.wrongDetail.verified', '已验证修复。')}</p>
                        ) : item.reviewPattern?.verificationRequired ? (
                          <button type="button" onClick={() => onNavigate(stripLocalePrefix(item.reviewPattern?.verificationHref ?? item.practicePath))}>{t('me.actions.verifyRepair', '验证修复')}</button>
                        ) : (
                          <button type="button" disabled={pendingActionKey === reviewActionKey} onClick={() => void completeWrongQuestionReview(item)}>
                            {pendingActionKey === reviewActionKey ? t('me.common.recording', '记录中...') : t('me.actions.understoodVerify', '已看懂，去验证')}
                          </button>
                        )}
                      </section>
                    </div>
                  )}
                </article>
              );
            })}
            {!latestWrongQuestions.length && (
              <div className="me-wrong-empty">
                <strong>{isLoadingWrongQuestions ? t('me.wrongBank.loading', '正在读取错题') : t('me.wrongBank.emptyFilteredTitle', '当前筛选下没有错题')}</strong>
                <p>{isLoadingWrongQuestions ? t('me.wrongBank.loadingBody', '会根据你的筛选条件刷新。') : t('me.wrongBank.emptyFilteredBody', '可以重置筛选，或继续完成更多科目训练后再回来复盘。')}</p>
                {!isLoadingWrongQuestions && <button type="button" onClick={clearWrongQuestionFilters}>{t('me.actions.resetFilters', '重置筛选')}</button>}
                </div>
            )}
          </div>
        </section>
      )}

      {activeSection === 'mockExams' && (
        <section className="me-section-card">
          <div className="me-section-head">
            <div>
              <p className="page-kicker">{t('me.nav.mockExams', '在线模考')}</p>
              <h2>{t('me.mock.title', '最近模考记录')}</h2>
            </div>
            <button type="button" onClick={onGoToMockExam}>{t('me.actions.startMock', '开始模考')}</button>
          </div>
          <div className="me-practice-list">
            {latestMocks.map((attempt, index) => (
              <article key={attempt.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{attempt.paper.title} · {attempt.submittedAt ? `${attempt.score ?? 0}/100` : t('me.common.inProgress', '进行中')}</strong>
                  <p>{attempt.submittedAt
                    ? t('me.mock.submittedAt', '交卷：{date}').replace('{date}', formatDate(attempt.submittedAt, locale, t('me.common.notCompleted', '尚未完成')))
                    : t('me.mock.startedAt', '开始：{date}').replace('{date}', formatDate(attempt.startedAt, locale, t('me.common.notCompleted', '尚未完成')))}</p>
                </div>
                <button type="button" onClick={() => onOpenMockExamReport(attempt.reportPath || attempt.attemptPath || routes.cscaMockExam)}>
                  {attempt.reportPath ? t('me.actions.report', '报告') : t('me.actions.continue', '继续')}
                </button>
              </article>
            ))}
            {!latestMocks.length && <p>{t('me.mock.empty', '还没有模考记录。完成一次完整模考后，这里会显示报告入口。')}</p>}
          </div>
        </section>
      )}

      {activeSection === 'settings' && (
        <section className="me-section-card me-settings-page">
          <div className="me-section-head">
            <div>
              <p className="page-kicker">{t('me.nav.settings', '账号设置')}</p>
              <h2>{t('me.settings.title', '个人设置')}</h2>
              <p>{t('me.settings.pageBody', '分别管理账号资料、学习画像，以及学习 Agent 制定方案所依赖的目标与时间。')}</p>
            </div>
          </div>
          <AccountSettingsWorkspace
            user={user}
            aiCredits={aiCredits}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            studentProfileDraft={studentProfileDraft}
            onStudentProfileChange={setStudentProfileDraft}
            agentSettings={agentLearningSettings}
            inviteInput={inviteInput}
            onInviteInputChange={setInviteInput}
            isSavingName={isSavingName}
            isSavingStudentProfile={isSavingStudentProfile}
            isSavingGoal={isSavingAgentGoal}
            isSavingAvailability={isSavingAgentAvailability}
            isJoiningOrganization={isJoiningOrganization}
            onSaveName={saveDisplayName}
            onSaveStudentProfile={saveStudentProfile}
            onSaveGoal={saveAgentScoreGoal}
            onSaveAvailability={saveAgentStudyAvailability}
            onJoinOrganization={joinOrganization}
            onLogout={handleLogout}
            onGoToAdmin={onGoToAdmin}
            status={status}
          />
        </section>
      )}
        </main>

      </div>
    </div>
  );
}

