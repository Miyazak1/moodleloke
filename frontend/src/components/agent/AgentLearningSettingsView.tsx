import { useEffect, useState, type FormEvent } from 'react';
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
import {
  EMPTY_STUDENT_PROFILE_DRAFT,
  StudentProfileFields,
  studentProfileDraftPayload,
  studentProfileToDraft,
  type StudentProfileDraft
} from '../StudentProfileFields';
import { Icon } from '../Icon';

type Panel = 'mode' | 'profile' | 'goal' | 'schedule';
type Subject = 'math' | 'physics' | 'chemistry';
type LearningMode = 'recommended' | 'free';

type AgentLearningSettingsViewProps = {
  defaultLearningMode: LearningMode;
  defaultFreePracticeSubject: Subject;
  defaultFreePracticeCount: number;
  onDefaultLearningModeChange: (mode: LearningMode) => void;
  onDefaultFreePracticeSubjectChange: (subject: Subject) => void;
  onDefaultFreePracticeCountChange: (count: number) => void;
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

export function AgentLearningSettingsView({
  defaultLearningMode,
  defaultFreePracticeSubject,
  defaultFreePracticeCount,
  onDefaultLearningModeChange,
  onDefaultFreePracticeSubjectChange,
  onDefaultFreePracticeCountChange
}: AgentLearningSettingsViewProps) {
  const { locale, t } = useI18n();
  const [panel, setPanel] = useState<Panel>('mode');
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
  if (loading) return <div className="agent-settings-state"><Icon name="lucide:loader-circle" /><strong>{t('me.common.loading', '正在读取个人学习设置')}</strong></div>;

  return (
    <div className="agent-settings-workspace">
      <nav aria-label={t('me.settings.sections', '设置分类')}>
        {([
          ['mode', 'lucide:route', t('me.settings.modePanel', '学习方式')],
          ['profile', 'lucide:graduation-cap', t('me.settings.learningPanel', '学习画像')],
          ['goal', 'lucide:target', t('me.settings.goalPanel', '考试目标')],
          ['schedule', 'lucide:calendar-clock', t('me.settings.schedulePanel', '学习时间')]
        ] as Array<[Panel, string, string]>).map(([key, icon, label]) => (
          <button key={key} type="button" className={panel === key ? 'active' : ''} aria-current={panel === key ? 'page' : undefined} onClick={() => { setPanel(key); setStatus(''); }}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {status && <p className="agent-settings-status" role="status"><Icon name="lucide:info" />{status}</p>}

      {panel === 'mode' && <section aria-label={t('me.settings.modePanel', '学习方式')}>
        <header><span className="agent-kicker">{t('me.settings.modeKicker', '默认学习入口')}</span><h3>{t('me.settings.modeTitle', '你希望 Agent 默认怎样开始')}</h3><p>{t('me.settings.modeBody', '这是长期默认方式；当前练习的临时选择不会修改它。两种方式共用同一套题源、辅助规则和学习证据。')}</p></header>
        <div className="agent-learning-mode agent-settings-learning-mode" aria-label={t('agent.mode.aria', '学习模式')}>
          <button type="button" disabled={saving === 'mode'} className={defaultLearningMode === 'recommended' ? 'active' : ''} aria-pressed={defaultLearningMode === 'recommended'} onClick={() => void saveLearningPreference({ defaultLearningMode: 'recommended' })}>
            <Icon name="lucide:sparkles" /><span><strong>{t('agent.mode.recommended', '智能推荐')}</strong><small>{t('agent.mode.recommendedHint', '系统给出最值得做的下一步')}</small></span>
          </button>
          <button type="button" disabled={saving === 'mode'} className={defaultLearningMode === 'free' ? 'active' : ''} aria-pressed={defaultLearningMode === 'free'} onClick={() => void saveLearningPreference({ defaultLearningMode: 'free' })}>
            <Icon name="lucide:infinity" /><span><strong>{t('agent.mode.free', '自由练习')}</strong><small>{t('agent.mode.freeHint', '想练就练，随时停止')}</small></span>
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
