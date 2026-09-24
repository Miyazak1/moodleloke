import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/useI18n';
import {
  getMyAgentLearningSettings,
  getMyStudentProfile,
  updateMyAgentLearningPreference,
  updateMyAgentScoreGoal,
  updateMyAgentStudyAvailability,
  updateMyStudentProfile
} from '../../lib/api-me';
import type { AgentLearningSettings } from '../../lib/api-types';
import type { AgentJourneyOverview, AgentJourneyState } from '../../lib/api-agent';
import {
  EMPTY_STUDENT_PROFILE_DRAFT,
  StudentProfileFields,
  studentProfileDraftPayload,
  studentProfileToDraft,
  type StudentProfileDraft
} from '../StudentProfileFields';
import { Icon } from '../Icon';
import { AgentAsyncState } from './AgentAsyncState';

type Panel = 'plan' | 'progress' | 'quality' | 'mode' | 'profile' | 'goal' | 'schedule';
type Subject = 'math' | 'physics' | 'chemistry';
type LearningMode = 'recommended' | 'free';

type AgentLearningSettingsViewProps = {
  defaultLearningMode: LearningMode;
  defaultFreePracticeSubject: Subject;
  defaultFreePracticeCount: number;
  onDefaultLearningModeChange: (mode: LearningMode) => void;
  onDefaultFreePracticeSubjectChange: (subject: Subject) => void;
  onDefaultFreePracticeCountChange: (count: number) => void;
  journeyOverview: AgentJourneyOverview | null;
  journeyOverviewLoading: boolean;
  journeyOverviewError: string;
  onJourneyOverviewRetry: () => void;
  plans: AgentJourneyState['plans'];
  startablePlanId: string | null;
  planBusy: boolean;
  onStartPlan: () => void;
  onStartDecision: (prescriptionId: string) => void;
  onStartDefaultFreePractice: () => void;
  onDecisionVisible: (prescriptionId: string) => void;
  onGeneratePlan: () => void;
  onOpenWeakness: () => void;
  onGoPractice: () => void;
};

const SUBJECTS: Array<{ code: Subject; icon: string; zh: string; en: string }> = [
  { code: 'math', icon: 'lucide:sigma', zh: '数学', en: 'Math' },
  { code: 'physics', icon: 'lucide:atom', zh: '物理', en: 'Physics' },
  { code: 'chemistry', icon: 'lucide:flask-conical', zh: '化学', en: 'Chemistry' }
];

const WEEKDAYS = [
  ['一', 'Mon'], ['二', 'Tue'], ['三', 'Wed'], ['四', 'Thu'], ['五', 'Fri'], ['六', 'Sat'], ['日', 'Sun']
] as const;

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

function fallbackSettings(): AgentLearningSettings {
  return {
    currentScoringPolicyVersion: 'csca-score-unverified-v1',
    scoreGoal: { status: 'unset', goal: null },
    studyAvailability: {
      availabilityVersion: 'unset', timezone: browserTimezone(), weeklyMinutesGoal: null,
      preferredStudyDays: [], defaultSessionMinutes: null, source: 'unset', effectiveAt: null
    },
    learningPreference: {
      preferenceVersion: 'unset', defaultLearningMode: 'recommended', defaultFreePracticeSubject: 'math',
      defaultFreePracticeCount: 5, source: 'default', updatedAt: null
    }
  };
}

function subjectLabel(subject: string, isZh: boolean) {
  if (subject === 'math') return isZh ? '数学' : 'Math';
  if (subject === 'physics') return isZh ? '物理' : 'Physics';
  if (subject === 'chemistry') return isZh ? '化学' : 'Chemistry';
  return isZh ? '综合' : 'General';
}

function taskLabel(task: unknown, isZh: boolean) {
  const value = String(task ?? '');
  const zh: Record<string, string> = { diagnostic: '短诊断', review: '错题复习', targeted_practice: '针对性练习', mock_exam: '在线模考', concept_learning: '知识点讲解', free_practice: '自由练习' };
  const en: Record<string, string> = { diagnostic: 'Diagnostic', review: 'Mistake review', targeted_practice: 'Targeted practice', mock_exam: 'Mock exam', concept_learning: 'Concept lesson', free_practice: 'Free practice' };
  return (isZh ? zh : en)[value] ?? (isZh ? '学习任务' : 'Learning task');
}

function recommendationReason(decision: NonNullable<AgentJourneyOverview['nextDecision']>, isZh: boolean, subject: string) {
  if (!isZh) return decision.reasonSummary;
  const reasons = new Set(decision.reasonCodes ?? []);
  if (reasons.has('INTERVENTION_RETENTION_DUE')) return `${subject}已有讲解内容到了延迟复习时间，需要用新题检查是否真正记住。`;
  if (reasons.has('INTERVENTION_TRANSFER_DUE')) return `${subject}已有讲解内容需要通过不同题型验证能否迁移运用。`;
  if (reasons.has('MISCONCEPTION_REPEATED')) return `${subject}近期重复出现同类错误，先梳理概念比继续做相似题更有效。`;
  if (reasons.has('REVIEW_DUE') || reasons.has('RETENTION_AT_RISK')) return `${subject}已有知识点进入复习窗口，及时回顾可以降低遗忘风险。`;
  if (reasons.has('EXAM_APPROACHING') || reasons.has('RECENT_MOCK_MISSING')) return `考试时间临近，${subject}还缺少近期完整模考证据。`;
  if (reasons.has('SYLLABUS_COVERAGE_INCOMPLETE')) return `${subject}仍有知识点缺少独立作答记录，先用短诊断补齐覆盖。`;
  if (reasons.has('EVIDENCE_INSUFFICIENT') || reasons.has('INTERVENTION_EVIDENCE_INCONCLUSIVE')) return `${subject}现有作答证据还不足以形成可靠判断，先完成一组短诊断。`;
  if (reasons.has('INDEPENDENCE_OR_DIFFICULTY_LIMIT')) return `${subject}当前独立作答或难度覆盖仍有缺口，建议用针对性练习继续验证。`;
  if (reasons.has('FLUENCY_BELOW_BASELINE')) return `${subject}的正确性已有基础，但完成速度和熟练度仍需加强。`;
  if (reasons.has('TRANSFER_BELOW_BASELINE')) return `${subject}在变式题中的迁移表现还不稳定，需要针对性练习。`;
  if (reasons.has('MASTERY_BELOW_BASELINE') || reasons.has('INTERVENTION_NOT_STABLE')) return `${subject}近期独立作答尚未稳定，建议先处理当前最明显的知识缺口。`;
  return `根据${subject}近期作答证据，这项任务是当前最值得优先完成的下一步。`;
}

export function AgentLearningSettingsView({
  defaultLearningMode,
  defaultFreePracticeSubject,
  defaultFreePracticeCount,
  onDefaultLearningModeChange,
  onDefaultFreePracticeSubjectChange,
  onDefaultFreePracticeCountChange,
  journeyOverview,
  journeyOverviewLoading,
  journeyOverviewError,
  onJourneyOverviewRetry,
  plans,
  startablePlanId,
  planBusy,
  onStartPlan,
  onStartDecision,
  onStartDefaultFreePractice,
  onDecisionVisible,
  onGeneratePlan,
  onOpenWeakness,
  onGoPractice
}: AgentLearningSettingsViewProps) {
  const { locale, t } = useI18n();
  const [panel, setPanel] = useState<Panel>(() => {
    if (typeof window === 'undefined') return 'plan';
    const requested = new URLSearchParams(window.location.search).get('agentSettings');
    return requested === 'progress' || requested === 'quality' || requested === 'mode' || requested === 'profile' || requested === 'goal' || requested === 'schedule' ? requested : 'plan';
  });
  const [profile, setProfile] = useState<StudentProfileDraft>(EMPTY_STUDENT_PROFILE_DRAFT);
  const [settings, setSettings] = useState<AgentLearningSettings | null>(null);
  const [examDate, setExamDate] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Record<Subject, string>>({ math: '80', physics: '80', chemistry: '80' });
  const [timezone, setTimezone] = useState(browserTimezone());
  const [weeklyMinutes, setWeeklyMinutes] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('');
  const [studyDays, setStudyDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Panel | null>(null);
  const [status, setStatus] = useState('');
  const visibleDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    const prescriptionId = panel === 'plan' ? journeyOverview?.nextDecision?.prescriptionId : null;
    if (!prescriptionId || visibleDecisionRef.current === prescriptionId) return;
    visibleDecisionRef.current = prescriptionId;
    onDecisionVisible(prescriptionId);
  }, [journeyOverview?.nextDecision?.prescriptionId, onDecisionVisible, panel]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    void Promise.all([getMyStudentProfile(), getMyAgentLearningSettings()])
      .then(([studentProfile, learningSettings]) => {
        if (!current) return;
        const draft = studentProfileToDraft(studentProfile);
        const goal = learningSettings.scoreGoal.goal;
        const availability = learningSettings.studyAvailability;
        setProfile(draft);
        setSettings(learningSettings);
        setExamDate(goal?.examDate ?? (draft.targetExamMonth ? `${draft.targetExamMonth}-01` : ''));
        setSubjects(goal?.subjects.map((item) => item.subject) ?? draft.targetSubjectCodes.filter((item): item is Subject => SUBJECTS.some((subject) => subject.code === item)));
        setScores((currentScores) => ({
          ...currentScores,
          ...Object.fromEntries((goal?.subjects ?? []).map((item) => [item.subject, String(item.targetScore)]))
        }));
        setTimezone(availability.timezone || browserTimezone());
        setWeeklyMinutes(availability.weeklyMinutesGoal ? String(availability.weeklyMinutesGoal) : '');
        setSessionMinutes(availability.defaultSessionMinutes ? String(availability.defaultSessionMinutes) : '');
        setStudyDays(availability.preferredStudyDays);
        const preference = learningSettings.learningPreference ?? fallbackSettings().learningPreference;
        onDefaultLearningModeChange(preference.defaultLearningMode);
        onDefaultFreePracticeSubjectChange(preference.defaultFreePracticeSubject);
        onDefaultFreePracticeCountChange(preference.defaultFreePracticeCount);
        setStatus('');
      })
      .catch(() => current && setStatus(t('me.status.partialLoadFailed', '个人学习设置暂时无法加载，请稍后重试。')))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [t]);

  async function saveLearningPreference(next: Partial<{
    defaultLearningMode: LearningMode;
    defaultFreePracticeSubject: Subject;
    defaultFreePracticeCount: 3 | 5 | 10;
  }>) {
    if (saving) return;
    const current = settings?.learningPreference ?? fallbackSettings().learningPreference;
    const payload = {
      schemaVersion: '1' as const,
      defaultLearningMode: next.defaultLearningMode ?? current.defaultLearningMode,
      defaultFreePracticeSubject: next.defaultFreePracticeSubject ?? current.defaultFreePracticeSubject,
      defaultFreePracticeCount: next.defaultFreePracticeCount ?? current.defaultFreePracticeCount,
      expectedPreferenceVersion: current.preferenceVersion
    };
    onDefaultLearningModeChange(payload.defaultLearningMode);
    onDefaultFreePracticeSubjectChange(payload.defaultFreePracticeSubject);
    onDefaultFreePracticeCountChange(payload.defaultFreePracticeCount);
    setSaving('mode');
    setStatus('');
    try {
      const saved = await updateMyAgentLearningPreference(payload);
      setSettings((value) => ({ ...(value ?? fallbackSettings()), learningPreference: saved }));
      onDefaultLearningModeChange(saved.defaultLearningMode);
      onDefaultFreePracticeSubjectChange(saved.defaultFreePracticeSubject);
      onDefaultFreePracticeCountChange(saved.defaultFreePracticeCount);
      setStatus(t('me.status.agentLearningPreferenceUpdated', '默认学习方式已保存，并会同步到其他设备和 Agent 插件。'));
    } catch {
      setStatus(t('me.status.agentLearningPreferenceSaveFailed', '默认学习方式暂时无法保存，请刷新后重试。'));
    } finally {
      setSaving(null);
    }
  }

  async function saveProfile() {
    setSaving('profile');
    setStatus('');
    try {
      const saved = await updateMyStudentProfile(studentProfileDraftPayload(profile));
      setProfile(studentProfileToDraft(saved));
      setStatus(t('me.status.studentProfileUpdated', '学习档案已更新，后续 Agent 决策会使用新信息。'));
    } catch {
      setStatus(t('me.status.studentProfileSaveFailed', '学习档案暂时无法保存。'));
    } finally {
      setSaving(null);
    }
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    const subjectGoals = subjects.map((subject, index) => ({ subject, targetScore: Number(scores[subject]), priority: index + 1 }));
    if (!examDate || !subjectGoals.length || subjectGoals.some((item) => !Number.isFinite(item.targetScore) || item.targetScore < 1 || item.targetScore > 100)) {
      setStatus(t('me.status.agentGoalSaveFailed', '请填写考试日期，并为所选科目设置 1–100 的目标分。'));
      return;
    }
    setSaving('goal');
    setStatus('');
    try {
      const next = await updateMyAgentScoreGoal({
        schemaVersion: '1', examSystemCode: 'csca', examBatchCode: `csca-${examDate.slice(0, 7)}`,
        examDate, subjectGoals,
        expectedGoalVersion: settings?.scoreGoal.goal?.goalVersion ?? 'unset',
        expectedScoringPolicyVersion: settings?.currentScoringPolicyVersion ?? 'csca-score-unverified-v1'
      });
      setSettings((current) => ({ ...(current ?? fallbackSettings()), scoreGoal: next }));
      setStatus(t('me.status.agentGoalUpdated', '考试目标已更新，Agent 将基于新版本重新制定后续方案。'));
    } catch {
      setStatus(t('me.status.agentGoalSaveFailed', '考试目标暂时无法保存，请刷新后重试。'));
    } finally {
      setSaving(null);
    }
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    const weekly = weeklyMinutes ? Number(weeklyMinutes) : null;
    const session = sessionMinutes ? Number(sessionMinutes) : null;
    if (!timezone || (weekly !== null && (!Number.isFinite(weekly) || weekly < 1 || weekly > 10080)) || (session !== null && (!Number.isFinite(session) || session < 1 || session > 480))) {
      setStatus(t('me.status.agentScheduleSaveFailed', '请检查时区和学习分钟数。'));
      return;
    }
    setSaving('schedule');
    setStatus('');
    try {
      const next = await updateMyAgentStudyAvailability({
        schemaVersion: '1', timezone, weeklyMinutesGoal: weekly,
        preferredStudyDays: [...studyDays].sort((a, b) => a - b), defaultSessionMinutes: session,
        expectedAvailabilityVersion: settings?.studyAvailability.availabilityVersion ?? 'unset'
      });
      setSettings((current) => ({ ...(current ?? fallbackSettings()), studyAvailability: next }));
      setStatus(t('me.status.agentScheduleUpdated', '学习时间已更新，后续方案会使用新的时间容量。'));
    } catch {
      setStatus(t('me.status.agentScheduleSaveFailed', '学习时间暂时无法保存，请刷新后重试。'));
    } finally {
      setSaving(null);
    }
  }

  const isZh = locale === 'zh-CN';
  const orderedPlans = [...plans].filter((item) => item.type === 'learning_plan').sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const currentPlan = orderedPlans[0];
  const planSnapshot = currentPlan?.snapshot ?? {};
  const planTask = planSnapshot.task && typeof planSnapshot.task === 'object' ? planSnapshot.task as Record<string, unknown> : {};
  const isCurrentPlanToday = currentPlan ? new Date(currentPlan.createdAt).toDateString() === new Date().toDateString() : false;
  const isCurrentPlanStartable = Boolean(currentPlan && isCurrentPlanToday && currentPlan.id === startablePlanId);
  const progressSubjects = journeyOverview?.progress?.subjects ?? [];
  const totalTopics = progressSubjects.reduce((sum, item) => sum + item.totalTopicCount, 0);
  const evidencedTopics = progressSubjects.reduce((sum, item) => sum + item.evidencedTopicCount, 0);
  const strongTopics = progressSubjects.reduce((sum, item) => sum + item.strongTopicCount, 0);
  const answerEvidence = progressSubjects.reduce((sum, item) => sum + item.answerEvidenceCount, 0);
  const decisionSupplyBlocked = journeyOverview?.nextDecision?.availability?.status === 'limited' || journeyOverview?.nextDecision?.availability?.status === 'empty';
  const recommendedTask = journeyOverview?.nextDecision?.primaryTask ?? null;
  const recommendedSubject = recommendedTask ? subjectLabel(recommendedTask.subject, isZh) : '';
  const recommendedTaskName = recommendedTask ? taskLabel(recommendedTask.type, isZh) : '';
  const recommendedQuestionCount = recommendedTask?.questionCount ?? null;
  const defaultSubjectName = subjectLabel(defaultFreePracticeSubject, isZh);
  const recommendationScopeCopy = isZh
    ? '系统会比较考试目标中的全部科目，选择当前更值得优先处理的一项；它不受自由练习默认科目限制。'
    : 'The system compares all subjects in your exam goal and picks the current priority. This is separate from your free-practice default.';
  const recommendedReason = journeyOverview?.nextDecision && recommendedTask
    ? recommendationReason(journeyOverview.nextDecision, isZh, recommendedSubject)
    : '';
  const hasFormalGoal = Boolean(
    journeyOverview?.goal?.examDate
    && journeyOverview.goal.subjects?.some((item) => typeof item.targetScore === 'number')
  );
  const planningStatus = journeyOverview?.planning?.status
    ?? (hasFormalGoal ? 'unavailable' : 'goal_unset');
  const examDateValue = journeyOverview?.goal?.examDate ? new Date(`${journeyOverview.goal.examDate}T00:00:00`) : null;
  const examDateLabel = examDateValue && !Number.isNaN(examDateValue.getTime())
    ? new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en', { year: 'numeric', month: 'long', day: 'numeric' }).format(examDateValue)
    : null;
  const daysRemaining = examDateValue && !Number.isNaN(examDateValue.getTime()) ? Math.max(0, Math.ceil((examDateValue.getTime() - Date.now()) / 86_400_000)) : null;

  function selectPanel(next: Panel) {
    setPanel(next);
    setStatus('');
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('agentSection', 'settings');
    if (next === 'plan') params.delete('agentSettings');
    else params.set('agentSettings', next);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }
  if (loading) return <AgentAsyncState kind="loading" title={t('me.common.loading', '正在读取个人学习设置')} body={t('me.settings.loadingBody', '正在同步你的学习偏好、目标和计划。')} />;

  return (
    <div className="agent-settings-workspace">
      <nav aria-label={t('me.settings.sections', '设置分类')}>
        {([
          ['plan', 'lucide:list-checks', t('agent.journey.plan', '学习计划')],
          ['progress', 'lucide:chart-no-axes-combined', t('agent.journey.progress', '目标进度')],
          ['quality', 'lucide:activity', '学习质量'],
          ['mode', 'lucide:route', t('me.settings.modePanel', '学习方式')],
          ['profile', 'lucide:graduation-cap', t('me.settings.learningPanel', '学习画像')],
          ['goal', 'lucide:target', t('me.settings.goalPanel', '考试目标')],
          ['schedule', 'lucide:calendar-clock', t('me.settings.schedulePanel', '学习时间')]
        ] as Array<[Panel, string, string]>).map(([key, icon, label]) => (
          <button key={key} type="button" className={panel === key ? 'active' : ''} aria-current={panel === key ? 'page' : undefined} onClick={() => selectPanel(key)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {status && <p className="agent-settings-status" role="status"><Icon name="lucide:info" />{status}</p>}

      {panel === 'plan' && <section className="agent-settings-plan" aria-label={t('agent.journey.plan', '学习计划')}>
        <header><span className="agent-kicker">{t('agent.journey.planKicker', '当前计划')}</span><h3>{t('agent.journey.planTitle', '围绕目标，只保留一个明确的下一步')}</h3><p>{t('agent.journey.planBody', '计划由目标、可用时间和真实作答证据共同决定；完成后会自动更新。')}</p></header>
        {journeyOverviewLoading ? <AgentAsyncState kind="loading" title={t('agent.progress.loading', '正在整理学习计划')} body={t('agent.journey.loadingPlanBody', '正在核对目标、可用时间和近期作答证据。')} /> : journeyOverviewError ? <AgentAsyncState kind="error" title={t('agent.journey.dataUnavailable', '暂时无法读取学习计划')} body={journeyOverviewError} actionLabel={t('agent.journey.retry', '重试读取')} onAction={onJourneyOverviewRetry} /> : recommendedTask ? <div className="agent-live-decision-card">
          <header><span><Icon name="lucide:route" /></span><div><small>{isZh ? '系统建议 · 不改变默认设置' : 'System recommendation · Defaults stay unchanged'}</small><strong>{isZh ? `建议先完成${recommendedSubject}${recommendedTaskName}` : `Recommended: ${recommendedSubject} ${recommendedTaskName}`}</strong></div></header>
          <div className="agent-live-decision-reason"><strong>{isZh ? '为什么推荐这一项' : 'Why this task'}</strong><p>{recommendedReason}</p><small>{recommendationScopeCopy}</small></div>
          <dl><div><dt>预计</dt><dd>{journeyOverview.nextDecision.estimatedMinutes} min</dd></div><div><dt>题量</dt><dd>{journeyOverview.nextDecision.primaryTask.questionCount ?? '—'}</dd></div><div><dt>可信度</dt><dd>{journeyOverview.nextDecision.confidence === 'high' ? '高' : journeyOverview.nextDecision.confidence === 'medium' ? '中' : '待积累'}</dd></div></dl>
          <div className="agent-live-decision-default"><Icon name="lucide:infinity" /><span><small>{isZh ? '你的自由练习默认仍为' : 'Your free-practice default remains'}</small><strong>{defaultSubjectName} · {defaultFreePracticeCount} {isZh ? '题' : 'questions'}</strong></span></div>
          <footer><span><Icon name={decisionSupplyBlocked ? 'lucide:triangle-alert' : 'lucide:shield-check'} />{decisionSupplyBlocked ? `题源不足：需要 ${journeyOverview.nextDecision.availability?.requestedCount ?? 0} 题，可用 ${journeyOverview.nextDecision.availability?.availableCount ?? 0} 题` : '规则决策，不由 AI 直接修改掌握度'}</span><div><button type="button" className="secondary" disabled={planBusy} onClick={onStartDefaultFreePractice}><Icon name="lucide:infinity" />{isZh ? `继续自由练${defaultSubjectName} ${defaultFreePracticeCount} 题` : `Free practice: ${defaultSubjectName} ${defaultFreePracticeCount}`}</button><button type="button" className="primary" disabled={planBusy} onClick={decisionSupplyBlocked ? onOpenWeakness : () => onStartDecision(journeyOverview.nextDecision!.prescriptionId)}><Icon name={planBusy ? 'lucide:loader-circle' : decisionSupplyBlocked ? 'lucide:book-open-check' : 'lucide:play'} />{planBusy ? '正在准备' : decisionSupplyBlocked ? '先去复盘' : isZh ? `按建议做${recommendedSubject}${recommendedQuestionCount ? ` ${recommendedQuestionCount} 题` : ''}` : `Start ${recommendedSubject}${recommendedQuestionCount ? ` ${recommendedQuestionCount}` : ''}`}</button></div></footer>
        </div> : null}
        {!journeyOverviewLoading && !journeyOverviewError && !journeyOverview?.nextDecision?.primaryTask && currentPlan ? <div className="agent-journey-plan-card">
          <header><span><Icon name="lucide:calendar-check" /></span><small>{isCurrentPlanToday ? t('agent.journeyAction.todayPlan', '今日计划') : t('agent.journeyAction.previousPlan', '过往计划')}</small></header>
          <strong>{currentPlan.title}</strong>
          {currentPlan.summary && <p>{currentPlan.summary}</p>}
          <dl><div><dt>{t('agent.plan.task', '任务')}</dt><dd>{taskLabel(planTask.type, isZh)}</dd></div><div><dt>{t('agent.plan.subject', '科目')}</dt><dd>{subjectLabel(String(planTask.subject ?? ''), isZh)}</dd></div><div><dt>{t('agent.plan.duration', '预计')}</dt><dd>{Number(planSnapshot.estimatedMinutes ?? 0) ? `${Number(planSnapshot.estimatedMinutes)} min` : '—'}</dd></div><div><dt>{t('agent.plan.volume', '题量')}</dt><dd>{Number(planTask.questionCount ?? 0) || '—'}</dd></div></dl>
          <div className="agent-plan-execution"><div><small>{isCurrentPlanStartable ? t('agent.journeyAction.ready', '可以开始') : t('agent.journeyAction.refreshRequired', '需要更新')}</small><strong>{isCurrentPlanStartable ? t('agent.journeyAction.readyBody', '直接进入任务，完成后按真实结果更新计划。') : t('agent.journeyAction.refreshBody', '这不是今天可执行的任务，请生成基于最新证据的计划。')}</strong></div><button type="button" className="primary" disabled={planBusy} onClick={isCurrentPlanStartable ? onStartPlan : onGeneratePlan}><Icon name={planBusy ? 'lucide:loader-circle' : isCurrentPlanStartable ? 'lucide:play' : 'lucide:refresh-cw'} />{planBusy ? t('agent.learningEntry.preparing', '正在准备') : isCurrentPlanStartable ? t('agent.journeyAction.startTask', '开始此任务') : t('agent.journeyAction.generateToday', '更新今日计划')}</button></div>
          <footer><Icon name="lucide:shield-check" />{t('agent.plan.source', '来自学习证据、目标与已发布题源')}</footer>
        </div> : !journeyOverviewLoading && !journeyOverviewError && !journeyOverview?.nextDecision?.primaryTask ? <div className="agent-journey-empty">
          <Icon name={planningStatus === 'goal_unset' ? 'lucide:target' : planningStatus === 'updating' ? 'lucide:refresh-cw' : planningStatus === 'disabled' ? 'lucide:toggle-left' : 'lucide:calendar-days'} />
          <strong>{planningStatus === 'goal_unset'
            ? (isZh ? '先设置正式考试目标' : 'Set your exam goal first')
            : planningStatus === 'updating'
              ? (isZh ? '最近作答正在同步' : 'Recent answers are syncing')
              : planningStatus === 'disabled'
                ? (isZh ? '当前环境尚未开启学习计划' : 'Learning plans are not enabled here')
                : (isZh ? '暂时无法生成可执行计划' : 'No executable plan is available yet')}</strong>
          <p>{planningStatus === 'goal_unset'
            ? (isZh ? '做题记录已经保留，但计划还需要考试日期、目标科目和目标分；继续重复做题不会补齐这些目标信息。' : 'Your practice is saved, but planning also needs an exam date, target subjects, and target scores. More practice alone cannot supply those goals.')
            : planningStatus === 'updating'
              ? (isZh ? '系统正在把最近完成的作答投影为学习证据。稍后重试即可，不需要重复做题。' : 'The system is projecting your latest answers into learning evidence. Retry shortly; you do not need to repeat the practice.')
              : planningStatus === 'disabled'
                ? (isZh ? '你的作答仍会保存，但此部署没有启用目标差距与计划生成链路。' : 'Your answers are saved, but target-gap and plan generation are disabled in this deployment.')
                : (isZh ? '目标或作答可能已经存在，但计划服务本次没有返回结果。请重试读取。' : 'Goals or answers may already exist, but planning did not return a result. Please retry.')}</p>
          {planningStatus === 'goal_unset'
            ? <button type="button" onClick={() => selectPanel('goal')}><Icon name="lucide:target" />{isZh ? '设置考试目标' : 'Set exam goal'}</button>
            : <button type="button" onClick={onJourneyOverviewRetry}><Icon name="lucide:refresh-cw" />{isZh ? '重新读取计划' : 'Retry plan'}</button>}
        </div> : null}
      </section>}

      {panel === 'progress' && <section className="agent-settings-progress" aria-label={t('agent.journey.progress', '目标进度')}>
        <header><span className="agent-kicker">{t('agent.progress.kicker', '目标进度')}</span><h3>{t('agent.progress.title', '离考试目标还有多远')}</h3><p>{t('agent.progress.body', '这里只统计知识点覆盖和独立作答证据；做完一批题不等于掌握。')}</p></header>
        {journeyOverviewLoading ? <AgentAsyncState kind="loading" title={t('agent.progress.loading', '正在整理学习进度')} body={t('agent.progress.loadingBody', '正在汇总知识点覆盖和独立作答证据。')} /> : journeyOverviewError ? <AgentAsyncState kind="error" title={t('agent.journey.dataUnavailable', '暂时无法读取学习进度')} body={journeyOverviewError} actionLabel={t('agent.journey.retry', '重试读取')} onAction={onJourneyOverviewRetry} /> : journeyOverview?.progress ? <>
          <div className="agent-goal-summary"><div><span><Icon name="lucide:flag" /></span><small>{t('agent.progress.examGoal', '考试目标')}</small><strong>{examDateLabel ?? t('agent.progress.examDateUnset', '尚未设置考试日期')}</strong></div><dl><div><dt>{t('agent.progress.daysRemaining', '距离考试')}</dt><dd>{daysRemaining === null ? '—' : `${daysRemaining} ${t('agent.progress.days', '天')}`}</dd></div><div><dt>{t('agent.progress.coverage', '知识点覆盖')}</dt><dd>{evidencedTopics}/{totalTopics || '—'}</dd></div><div><dt>{t('agent.progress.strongEvidence', '掌握证据较强')}</dt><dd>{strongTopics}/{totalTopics || '—'}</dd></div><div><dt>{t('agent.progress.answerEvidence', '有效作答证据')}</dt><dd>{answerEvidence}</dd></div></dl><button type="button" onClick={() => selectPanel('goal')}><Icon name="lucide:settings-2" />{t('agent.progress.adjustGoal', '调整目标')}</button></div>
          <div className="agent-subject-progress-list">{progressSubjects.map((item) => { const coverage = item.totalTopicCount ? Math.round(item.evidencedTopicCount / item.totalTopicCount * 100) : 0; const strong = item.totalTopicCount ? Math.round(item.strongTopicCount / item.totalTopicCount * 100) : 0; const target = journeyOverview.goal?.subjects.find((goal) => goal.subject === item.subject)?.targetScore; return <article key={item.subject}><header><span data-subject={item.subject}>{subjectLabel(item.subject, isZh).slice(0, 1)}</span><div><strong>{subjectLabel(item.subject, isZh)}</strong><small>{target === null || target === undefined ? t('agent.progress.targetScoreUnset', '未设置目标分') : `${t('agent.progress.targetScore', '目标')} ${target}`}</small></div><em>{item.answerEvidenceCount} {t('agent.progress.attemptEvidence', '次作答证据')}</em></header><div className="agent-progress-row"><span>{t('agent.progress.coveredTopics', '已覆盖知识点')} {item.evidencedTopicCount}/{item.totalTopicCount}</span><i><b style={{ width: `${coverage}%` }} /></i><strong>{coverage}%</strong></div><div className="agent-progress-row is-strong"><span>{t('agent.progress.strongTopics', '证据较强')} {item.strongTopicCount}/{item.totalTopicCount}</span><i><b style={{ width: `${strong}%` }} /></i><strong>{strong}%</strong></div><footer><span>{t('agent.progress.developingTopics', '学习中')} {item.developingTopicCount}</span><span>{t('agent.progress.attentionTopics', '需巩固')} {item.needsAttentionTopicCount}</span><span>{t('agent.progress.unverifiedTopics', '待验证')} {Math.max(0, item.insufficientEvidenceTopicCount)}</span></footer></article>; })}</div>
          <div className="agent-completion-rule"><Icon name="lucide:badge-check" /><div><strong>{t('agent.progress.completionRule', '什么才算知识点完成')}</strong><p>{t('agent.progress.completionRuleBody', '需要足够题量和题型覆盖、独立作答稳定、重复错误消失，并通过之后的保持或迁移验证。')}</p></div><button type="button" onClick={onOpenWeakness}>{t('agent.progress.viewGaps', '查看当前缺口')}<Icon name="lucide:arrow-right" /></button></div>
        </> : <div className="agent-journey-empty"><Icon name="lucide:flag" /><strong>{t('agent.progress.noProgress', '还没有可用的学习进度')}</strong><p>{t('agent.progress.noProgressBody', '先设置考试目标并完成一次练习。')}</p><button type="button" onClick={() => selectPanel('goal')}><Icon name="lucide:target" />{t('agent.progress.adjustGoal', '调整目标')}</button></div>}
      </section>}

      {panel === 'quality' && <section className="agent-settings-quality" aria-label="学习质量">
        <header><span className="agent-kicker">证据与校准</span><h3>推荐是否真的有效</h3><p>这里检查建议有没有被执行、执行后是否产生正向证据，以及后续独立验证是否支持原来的判断。</p></header>
        {journeyOverviewLoading ? <AgentAsyncState kind="loading" title="正在核对学习证据" body="正在检查建议执行、任务结果和后续独立验证。" /> : journeyOverviewError ? <AgentAsyncState kind="error" title="暂时无法读取学习质量" body={journeyOverviewError} actionLabel="重试读取" onAction={onJourneyOverviewRetry} /> : journeyOverview?.learningQuality ? (() => {
          const quality = journeyOverview.learningQuality;
          const statusCopy = quality.status === 'cold_start' ? ['尚未建立基线', '先完成一组覆盖多个知识点的独立练习。'] : quality.status === 'collecting' ? ['正在积累证据', '当前建议仍是低置信度，不会把少量作答当成稳定掌握。'] : quality.status === 'validating' ? ['正在验证效果', '已有个性化依据，仍需后续保持或迁移验证。'] : ['已形成可校准闭环', '建议、执行结果和后续独立验证已经可以互相校验。'];
          return <>
            <div className="agent-quality-status" data-status={quality.status}><span><Icon name={quality.status === 'calibrated' ? 'lucide:badge-check' : 'lucide:gauge'} /></span><div><small>{statusCopy[0]}</small><strong>{statusCopy[1]}</strong></div><em>{quality.evidence.acceptedCount} 条有效证据</em></div>
            <div className="agent-quality-metrics">
              <article><small>建议执行率</small><strong>{quality.recommendationFunnel.followThroughRate}%</strong><span>{quality.recommendationFunnel.acceptedCount}/{quality.recommendationFunnel.shownCount || quality.recommendationFunnel.publishedCount} 个已开始</span></article>
              <article><small>任务完成率</small><strong>{quality.recommendationFunnel.completionRate}%</strong><span>{quality.recommendationFunnel.completedCount}/{quality.recommendationFunnel.acceptedCount} 个完成</span></article>
              <article><small>正向结果</small><strong>{quality.recommendationFunnel.positiveOutcomeRate}%</strong><span>{quality.recommendationFunnel.positiveOutcomeCount}/{quality.recommendationFunnel.completedCount} 个产生正向证据</span></article>
            </div>
            <div className="agent-quality-validation">
              <header><div><small>后续独立验证</small><strong>不是答对一次就算掌握</strong></div><span>{quality.validation.stable} 个稳定 · {quality.validation.notStable} 个未稳定</span></header>
              <dl><div><dt>稳定通过</dt><dd>{quality.validation.stable}</dd></div><div><dt>仍未稳定</dt><dd>{quality.validation.notStable}</dd></div><div><dt>等待验证</dt><dd>{quality.validation.pending}</dd></div><div><dt>需重新校准</dt><dd>{quality.validation.contradictionCount}</dd></div></dl>
            </div>
            {quality.alerts.length ? <div className="agent-quality-alerts">{quality.alerts.map((alert) => <article key={alert.code} data-tone={alert.tone}><Icon name={alert.tone === 'warning' ? 'lucide:triangle-alert' : 'lucide:info'} /><div><strong>{alert.title}</strong><p>{alert.body}</p></div>{alert.action !== 'wait' ? <button type="button" onClick={alert.action === 'review' ? onOpenWeakness : onGoPractice}>{alert.action === 'review' ? '去复盘' : '去做题'}<Icon name="lucide:arrow-right" /></button> : <span>稍后自动更新</span>}</article>)}</div> : <div className="agent-quality-clear"><Icon name="lucide:circle-check-big" /><span><strong>当前没有发现阻断项</strong><small>题源、证据同步和掌握判断可以继续执行。</small></span></div>}
            <footer className="agent-quality-provenance"><Icon name="lucide:shield-check" /><span><strong>由规则和真实学习结果计算</strong><small>{quality.provenance.note}</small></span></footer>
          </>;
        })() : <div className="agent-journey-empty"><Icon name="lucide:activity" /><strong>学习质量尚未形成</strong><p>完成一次练习后，系统会开始跟踪建议执行与后续验证。</p><button type="button" onClick={onGoPractice}><Icon name="lucide:play" />去做题</button></div>}
      </section>}

      {panel === 'mode' && <section aria-label={t('me.settings.modePanel', '学习方式')}>
        <header><span className="agent-kicker">{t('me.settings.modeKicker', '默认学习入口')}</span><h3>{t('me.settings.modeTitle', '你希望 Agent 默认怎样开始')}</h3><p>{t('me.settings.modeBody', '智能推荐会比较全部考试目标并提出优先任务；自由练习则按你的默认科目和题量开始。两者不会互相修改设置。')}</p></header>
        <div className="agent-learning-mode agent-settings-learning-mode" aria-label={t('agent.mode.aria', '学习模式')}>
          <button type="button" disabled={saving === 'mode'} className={defaultLearningMode === 'recommended' ? 'active' : ''} aria-pressed={defaultLearningMode === 'recommended'} onClick={() => void saveLearningPreference({ defaultLearningMode: 'recommended' })}>
            <Icon name="lucide:sparkles" /><span><strong>{t('agent.mode.recommended', '智能推荐')}</strong><small>{t('agent.mode.recommendedHint', '跨全部考试目标选择优先任务')}</small></span>
          </button>
          <button type="button" disabled={saving === 'mode'} className={defaultLearningMode === 'free' ? 'active' : ''} aria-pressed={defaultLearningMode === 'free'} onClick={() => void saveLearningPreference({ defaultLearningMode: 'free' })}>
            <Icon name="lucide:infinity" /><span><strong>{t('agent.mode.free', '自由练习')}</strong><small>{t('agent.mode.freeHint', '按默认科目与题量开始')}</small></span>
          </button>
        </div>
        {defaultLearningMode === 'free' && <div className="agent-settings-free-defaults">
          <fieldset>
            <legend>{t('me.settings.defaultFreeSubject', '默认练习科目')}</legend>
            <div>{SUBJECTS.map((subject) => <button key={subject.code} type="button" disabled={saving === 'mode'} className={defaultFreePracticeSubject === subject.code ? 'selected' : ''} aria-pressed={defaultFreePracticeSubject === subject.code} onClick={() => void saveLearningPreference({ defaultFreePracticeSubject: subject.code })}><Icon name={subject.icon} />{isZh ? subject.zh : subject.en}</button>)}</div>
          </fieldset>
          <fieldset>
            <legend>{t('me.settings.defaultFreeBatch', '默认每批题量')}</legend>
            <div>{([3, 5, 10] as const).map((count) => <button key={count} type="button" disabled={saving === 'mode'} className={defaultFreePracticeCount === count ? 'selected' : ''} aria-pressed={defaultFreePracticeCount === count} onClick={() => void saveLearningPreference({ defaultFreePracticeCount: count })}>{count} {t('agent.freePractice.questions', '题')}</button>)}</div>
          </fieldset>
          <p className="agent-settings-free-scope"><Icon name="lucide:info" />{isZh ? `“${defaultSubjectName} · ${defaultFreePracticeCount} 题”只用于你主动开始自由练习时。系统建议会根据全部考试目标选择其他科目，是否采用由你决定。` : `“${defaultSubjectName} · ${defaultFreePracticeCount} questions” applies when you start free practice. System recommendations may suggest another exam subject, and you decide whether to follow them.`}</p>
        </div>}
        <div className="agent-settings-note"><Icon name="lucide:activity" /><span>{t('me.settings.modeNote', '做题区负责当前作答；讲解、动画和结果按当前学习状态呈现，学科问答独立保留。')}</span></div>
        <footer><small>{saving === 'mode' ? t('me.common.saving', '保存中…') : t('me.settings.modeSaved', '默认方式已保存到账号，可跨设备和 Agent 插件同步。')}</small></footer>
      </section>}

      {panel === 'profile' && <section aria-label={t('me.settings.learningPanel', '学习画像')}>
        <header><span className="agent-kicker">{t('me.settings.agentContextKicker', 'Agent 学习上下文')}</span><h3>{t('me.settings.learningTitle', '学习画像')}</h3><p>{t('me.settings.learningBody', '用于选择题目语言、解释方式和适合你的学习内容，不用于身份核验。')}</p></header>
        <div className="agent-settings-group"><h4>{t('me.settings.studyBasicTitle', '基本学习信息')}</h4><StudentProfileFields draft={profile} onChange={setProfile} section="basic" /></div>
        <div className="agent-settings-group"><h4>{t('me.settings.contentPreferenceTitle', '内容与升学方向')}</h4><StudentProfileFields draft={profile} onChange={setProfile} section="agent-context" /></div>
        <footer><small>{t('me.settings.studySaveHint', '保存后，后续推荐与 Agent 会使用这些设置。')}</small><button type="button" disabled={saving !== null} onClick={() => void saveProfile()}><Icon name="lucide:save" />{saving === 'profile' ? t('me.common.saving', '保存中…') : t('me.actions.saveStudyProfile', '保存学习画像')}</button></footer>
      </section>}

      {panel === 'goal' && <form aria-label={t('me.settings.goalPanel', '考试目标')} onSubmit={(event) => void saveGoal(event)}>
        <header><span className="agent-kicker">{t('me.settings.goalKicker', '目标驱动')}</span><h3>{t('me.settings.goalTitle', 'CSCA 考试目标')}</h3><p>{t('me.settings.goalBody', '这是 Agent 制定方案的正式目标来源；每次修改都会保存新版本。')}</p></header>
        <label className="agent-settings-field"><span>{t('me.settings.examDate', '预计考试日期')}</span><input type="date" required value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>
        <fieldset className="agent-settings-subjects"><legend>{t('me.settings.subjectTargets', '科目与目标分')}</legend>{SUBJECTS.map((subject) => { const selected = subjects.includes(subject.code); return <div key={subject.code} className={selected ? 'selected' : ''}><label><input type="checkbox" checked={selected} onChange={(event) => setSubjects(event.target.checked ? [...subjects, subject.code] : subjects.filter((item) => item !== subject.code))} /><Icon name={subject.icon} /><strong>{isZh ? subject.zh : subject.en}</strong></label><input aria-label={`${isZh ? subject.zh : subject.en} ${t('me.settings.targetScore', '目标分')}`} type="number" min="1" max="100" disabled={!selected} value={scores[subject.code]} onChange={(event) => setScores({ ...scores, [subject.code]: event.target.value })} /></div>; })}</fieldset>
        <div className="agent-settings-note"><Icon name="lucide:shield-check" /><span>{t('me.settings.scoreShadowNote', '目标分用于差距分析和任务规划；系统不会把未经校准的预测分伪装成真实成绩。')}</span></div>
        <footer><small>{settings?.scoreGoal.status === 'configured' ? t('me.settings.goalVersioned', '已配置版本化目标') : t('me.settings.goalUnset', '尚未设置正式考试目标')}</small><button type="submit" disabled={saving !== null || !examDate || !subjects.length}><Icon name="lucide:target" />{saving === 'goal' ? t('me.common.saving', '保存中…') : t('me.actions.saveGoal', '保存考试目标')}</button></footer>
      </form>}

      {panel === 'schedule' && <form aria-label={t('me.settings.schedulePanel', '学习时间')} onSubmit={(event) => void saveSchedule(event)}>
        <header><span className="agent-kicker">{t('me.settings.scheduleKicker', '可执行计划')}</span><h3>{t('me.settings.scheduleTitle', '学习时间与节奏')}</h3><p>{t('me.settings.scheduleBody', 'Agent 会在真实时间容量内安排任务；本次学习可在工作台内临时调整。')}</p></header>
        <div className="agent-settings-fields"><label><span>{t('me.settings.timezone', '时区')}</span><input required value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label><span>{t('me.settings.weeklyMinutes', '每周学习分钟')}</span><input type="number" min="1" max="10080" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} /></label><label><span>{t('me.settings.sessionMinutes', '默认单次时长')}</span><input type="number" min="1" max="480" value={sessionMinutes} onChange={(event) => setSessionMinutes(event.target.value)} /></label></div>
        <fieldset className="agent-settings-days"><legend>{t('me.settings.studyDays', '通常可学习的星期')}</legend><div>{WEEKDAYS.map(([zh, en], index) => { const day = index + 1; const selected = studyDays.includes(day); return <button key={day} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => setStudyDays(selected ? studyDays.filter((item) => item !== day) : [...studyDays, day])}>{isZh ? `周${zh}` : en}</button>; })}</div></fieldset>
        <div className="agent-settings-note"><Icon name="lucide:clock-3" /><span>{t('me.settings.temporaryConstraintNote', '本次学习的临时调整不会覆盖这里的长期设置。')}</span></div>
        <footer><small>{settings?.studyAvailability.source === 'user' ? t('me.settings.scheduleConfigured', '正在使用你的长期时间设置') : t('me.settings.scheduleUnset', '当前使用系统默认时间')}</small><button type="submit" disabled={saving !== null}><Icon name="lucide:save" />{saving === 'schedule' ? t('me.common.saving', '保存中…') : t('me.actions.saveSchedule', '保存学习时间')}</button></footer>
      </form>}
    </div>
  );
}
