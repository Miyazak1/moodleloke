import { useEffect, useState, type FormEvent } from 'react';
import type { AgentLearningSettings, MyAICredits, User } from '../../lib/api-types';
import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';
import { StudentProfileFields, type StudentProfileDraft } from '../StudentProfileFields';

type SettingsPanel = 'account' | 'learning' | 'goal' | 'schedule' | 'organization';
type SubjectCode = 'math' | 'physics' | 'chemistry';

type ScoreGoalPayload = {
  schemaVersion: '1';
  examSystemCode: 'csca';
  examBatchCode: string;
  examDate: string;
  subjectGoals: Array<{ subject: SubjectCode; targetScore: number; priority: number }>;
  expectedGoalVersion: string;
  expectedScoringPolicyVersion: string;
};

type AvailabilityPayload = {
  schemaVersion: '1';
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: number[];
  defaultSessionMinutes: number | null;
  expectedAvailabilityVersion: string;
};

type Props = {
  user: User;
  aiCredits: MyAICredits | null;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  studentProfileDraft: StudentProfileDraft;
  onStudentProfileChange: (draft: StudentProfileDraft) => void;
  agentSettings: AgentLearningSettings | null;
  inviteInput: string;
  onInviteInputChange: (value: string) => void;
  isSavingName: boolean;
  isSavingStudentProfile: boolean;
  isSavingGoal: boolean;
  isSavingAvailability: boolean;
  isJoiningOrganization: boolean;
  onSaveName: () => Promise<void>;
  onSaveStudentProfile: () => Promise<void>;
  onSaveGoal: (payload: ScoreGoalPayload) => Promise<void>;
  onSaveAvailability: (payload: AvailabilityPayload) => Promise<void>;
  onJoinOrganization: () => Promise<void>;
  onLogout: () => Promise<void>;
  onGoToAdmin: () => void;
  status: string | null;
};

const SUBJECTS: Array<{ code: SubjectCode; icon: string; labelKey: string }> = [
  { code: 'math', icon: 'lucide:sigma', labelKey: 'nav.math' },
  { code: 'physics', icon: 'lucide:atom', labelKey: 'nav.physics' },
  { code: 'chemistry', icon: 'lucide:flask-conical', labelKey: 'nav.chemistry' }
];

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function weekdayLabel(locale: string, day: number) {
  const monday = new Date(Date.UTC(2024, 0, day));
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(monday);
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

export function AccountSettingsWorkspace(props: Props) {
  const { locale, t } = useI18n();
  const [panel, setPanel] = useState<SettingsPanel>('account');
  const [examDate, setExamDate] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectCode[]>([]);
  const [targetScores, setTargetScores] = useState<Record<SubjectCode, string>>({ math: '80', physics: '80', chemistry: '80' });
  const [timezone, setTimezone] = useState(browserTimezone());
  const [weeklyMinutes, setWeeklyMinutes] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('');
  const [studyDays, setStudyDays] = useState<number[]>([]);

  useEffect(() => {
    const goal = props.agentSettings?.scoreGoal.goal;
    setExamDate(goal?.examDate ?? (props.studentProfileDraft.targetExamMonth ? `${props.studentProfileDraft.targetExamMonth}-01` : ''));
    const subjects = goal?.subjects.map((item) => item.subject) ?? props.studentProfileDraft.targetSubjectCodes.filter((item): item is SubjectCode => SUBJECTS.some((subject) => subject.code === item));
    setSelectedSubjects(subjects);
    setTargetScores((current) => ({
      ...current,
      ...Object.fromEntries((goal?.subjects ?? []).map((item) => [item.subject, String(item.targetScore)]))
    }));
  }, [props.agentSettings?.scoreGoal.goal, props.studentProfileDraft.targetExamMonth, props.studentProfileDraft.targetSubjectCodes]);

  useEffect(() => {
    const availability = props.agentSettings?.studyAvailability;
    setTimezone(availability?.timezone || browserTimezone());
    setWeeklyMinutes(availability?.weeklyMinutesGoal ? String(availability.weeklyMinutesGoal) : '');
    setSessionMinutes(availability?.defaultSessionMinutes ? String(availability.defaultSessionMinutes) : '');
    setStudyDays(availability?.preferredStudyDays ?? []);
  }, [props.agentSettings?.studyAvailability]);

  const organizationName = props.aiCredits?.organization?.name
    ?? props.aiCredits?.organizationOptions?.find((item) => item.current)?.name
    ?? null;
  const creditLabel = props.aiCredits
    ? props.aiCredits.unlimited ? t('me.credit.unlimited', '不限') : `${props.aiCredits.balanceUnits} ${t('me.units.times', '次')}`
    : t('me.common.notLoaded', '暂未读取');

  const nav: Array<{ key: SettingsPanel; icon: string; title: string; note: string; agent?: boolean }> = [
    { key: 'account', icon: 'lucide:user-round', title: t('me.settings.accountPanel', '账号资料'), note: t('me.settings.accountPanelNote', '姓名、邮箱与登录') },
    { key: 'learning', icon: 'lucide:graduation-cap', title: t('me.settings.learningPanel', '学习画像'), note: t('me.settings.learningPanelNote', '阶段、语言与方向'), agent: true },
    { key: 'goal', icon: 'lucide:target', title: t('me.settings.goalPanel', '考试目标'), note: t('me.settings.goalPanelNote', '日期、科目与目标分'), agent: true },
    { key: 'schedule', icon: 'lucide:calendar-clock', title: t('me.settings.schedulePanel', '学习时间'), note: t('me.settings.schedulePanelNote', '每周容量与单次时长'), agent: true },
    { key: 'organization', icon: 'lucide:building-2', title: t('me.settings.organizationPanel', '机构与额度'), note: t('me.settings.organizationPanelNote', '邀请码和额度来源') }
  ];

  async function submitGoal(event: FormEvent) {
    event.preventDefault();
    if (!examDate || !selectedSubjects.length) return;
    const subjectGoals = selectedSubjects.map((subject, index) => ({
      subject,
      targetScore: Number(targetScores[subject]),
      priority: index + 1
    }));
    if (subjectGoals.some((item) => !Number.isFinite(item.targetScore) || item.targetScore < 1 || item.targetScore > 100)) return;
    await props.onSaveGoal({
      schemaVersion: '1',
      examSystemCode: 'csca',
      examBatchCode: `csca-${examDate.slice(0, 7)}`,
      examDate,
      subjectGoals,
      expectedGoalVersion: props.agentSettings?.scoreGoal.goal?.goalVersion ?? 'unset',
      expectedScoringPolicyVersion: props.agentSettings?.currentScoringPolicyVersion ?? 'csca-score-unverified-v1'
    });
  }

  async function submitAvailability(event: FormEvent) {
    event.preventDefault();
    await props.onSaveAvailability({
      schemaVersion: '1',
      timezone,
      weeklyMinutesGoal: weeklyMinutes ? Number(weeklyMinutes) : null,
      preferredStudyDays: [...studyDays].sort((a, b) => a - b),
      defaultSessionMinutes: sessionMinutes ? Number(sessionMinutes) : null,
      expectedAvailabilityVersion: props.agentSettings?.studyAvailability.availabilityVersion ?? 'unset'
    });
  }

  return (
    <section className="me-settings-workspace">
      <aside className="me-settings-sidebar" aria-label={t('me.settings.sections', '设置分类')}>
        <div className="me-settings-sidebar-head">
          <span><Icon name="lucide:settings-2" color="currentColor" /></span>
          <div><strong>{t('me.nav.settings', '个人设置')}</strong><small>{t('me.settings.sidebarNote', '管理你和学习 Agent 使用的信息')}</small></div>
        </div>
        <nav>
          {nav.map((item) => (
            <button key={item.key} type="button" className={panel === item.key ? 'active' : ''} onClick={() => setPanel(item.key)} aria-current={panel === item.key ? 'page' : undefined}>
              <Icon name={item.icon} color="currentColor" />
              <span><strong>{item.title}</strong><small>{item.note}</small></span>
              {item.agent && <em>Agent</em>}
            </button>
          ))}
        </nav>
        <div className="me-settings-privacy-note"><Icon name="lucide:shield-check" color="currentColor" /><span>{t('me.settings.privacyNote', 'Agent 只读取已保存的信息；学习证据仍按用户隔离。')}</span></div>
      </aside>

      <div className="me-settings-panel">
        {props.status && <p className="me-settings-inline-status" role="status">{props.status}</p>}
        {panel === 'account' && (
          <section>
            <header className="me-settings-panel-head"><div><p className="page-kicker">{t('me.settings.accountKicker', '账号')}</p><h3>{t('me.settings.accountTitle', '个人资料与登录')}</h3><p>{t('me.settings.accountBody', '维护公开显示名和登录状态。学习设置不会影响你的登录凭据。')}</p></div>{props.user.role === 'admin' && <button type="button" className="ghost" onClick={props.onGoToAdmin}>{t('me.actions.enterAdmin', '进入后台')}</button>}</header>
            <div className="me-settings-form-grid">
              <label><span>{t('me.settings.displayName', '显示名')}</span><input value={props.displayName} maxLength={40} onChange={(event) => props.onDisplayNameChange(event.target.value)} /></label>
              <label><span>{t('me.settings.email', '邮箱')}</span><input readOnly value={props.user.email} /></label>
            </div>
            <div className="me-settings-summary-row">
              <div><Icon name={props.user.emailVerifiedAt ? 'lucide:badge-check' : 'lucide:circle-alert'} color="currentColor" /><span><strong>{props.user.emailVerifiedAt ? t('me.profile.emailVerified', '邮箱已验证') : t('me.profile.emailUnverified', '邮箱未验证')}</strong><small>{t('me.settings.emailStatusNote', '用于登录、找回密码和重要通知')}</small></span></div>
              <div><Icon name="lucide:sparkles" color="currentColor" /><span><strong>{creditLabel}</strong><small>{t('me.settings.aiCredit', 'AI 可用额度')}</small></span></div>
            </div>
            <footer className="me-settings-panel-actions"><button type="button" disabled={props.isSavingName} onClick={() => void props.onSaveName()}><Icon name="lucide:save" color="currentColor" />{props.isSavingName ? t('me.common.saving', '保存中...') : t('me.actions.saveAccount', '保存账号资料')}</button><button type="button" className="danger-quiet" onClick={() => void props.onLogout()}>{t('header.logout', '退出登录')}</button></footer>
          </section>
        )}

        {panel === 'learning' && (
          <section>
            <header className="me-settings-panel-head"><div><p className="page-kicker">{t('me.settings.agentContextKicker', 'Agent 学习上下文')}</p><h3>{t('me.settings.learningTitle', '学习画像')}</h3><p>{t('me.settings.learningBody', '这些信息帮助系统选择合适的内容、语言和解释方式，不用于身份核验。')}</p></div><span className="me-agent-read-badge"><Icon name="lucide:bot" color="currentColor" />{t('me.settings.agentReads', 'Agent 使用')}</span></header>
            <div className="me-settings-subsection"><h4>{t('me.settings.studyBasicTitle', '基本学习信息')}</h4><p>{t('me.settings.studyBasicBody', '更新你的学习阶段、年级和所在地区。')}</p><StudentProfileFields draft={props.studentProfileDraft} onChange={props.onStudentProfileChange} section="basic" /></div>
            <div className="me-settings-subsection"><h4>{t('me.settings.contentPreferenceTitle', '内容与升学方向')}</h4><p>{t('me.settings.contentPreferenceBody', '用于题目语言、讲解深度与长期学习建议。')}</p><StudentProfileFields draft={props.studentProfileDraft} onChange={props.onStudentProfileChange} section="agent-context" /></div>
            <footer className="me-settings-panel-actions"><span>{t('me.settings.studySaveHint', '保存后，后续推荐与 Agent 会使用这些设置。')}</span><button type="button" disabled={props.isSavingStudentProfile} onClick={() => void props.onSaveStudentProfile()}><Icon name="lucide:save" color="currentColor" />{props.isSavingStudentProfile ? t('me.common.saving', '保存中...') : t('me.actions.saveStudyProfile', '保存学习画像')}</button></footer>
          </section>
        )}

        {panel === 'goal' && (
          <form onSubmit={(event) => void submitGoal(event)}>
            <header className="me-settings-panel-head"><div><p className="page-kicker">{t('me.settings.goalKicker', '目标驱动')}</p><h3>{t('me.settings.goalTitle', 'CSCA 考试目标')}</h3><p>{t('me.settings.goalBody', '这是 Agent 制定学习方案的正式目标来源。修改后会创建新版本，不覆盖历史。')}</p></div><span className="me-agent-read-badge"><Icon name="lucide:bot" color="currentColor" />{t('me.settings.agentCoreInput', 'Agent 核心输入')}</span></header>
            <div className="me-settings-form-grid single"><label><span>{t('me.settings.examDate', '预计考试日期')}</span><input type="date" required value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label></div>
            <fieldset className="me-goal-subjects"><legend>{t('me.settings.subjectTargets', '科目与目标分')}</legend>{SUBJECTS.map((subject) => { const selected = selectedSubjects.includes(subject.code); return <div key={subject.code} className={selected ? 'selected' : ''}><label className="me-goal-subject-toggle"><input type="checkbox" checked={selected} onChange={(event) => setSelectedSubjects(event.target.checked ? [...selectedSubjects, subject.code] : selectedSubjects.filter((item) => item !== subject.code))} /><Icon name={subject.icon} color="currentColor" /><strong>{t(subject.labelKey)}</strong></label><label><span>{t('me.settings.targetScore', '目标分')}</span><input type="number" min="1" max="100" step="1" required={selected} disabled={!selected} value={targetScores[subject.code]} onChange={(event) => setTargetScores({ ...targetScores, [subject.code]: event.target.value })} /></label></div>; })}</fieldset>
            <div className="me-settings-info"><Icon name="lucide:info" color="currentColor" /><span>{t('me.settings.scoreShadowNote', '当前用于差距分析和任务规划；正式预计分数仍需经过评分量尺校准后才会展示。')}</span></div>
            <footer className="me-settings-panel-actions"><span>{props.agentSettings?.scoreGoal.status === 'configured' ? t('me.settings.goalVersioned', '已配置版本化目标') : t('me.settings.goalUnset', '尚未设置正式考试目标')}</span><button type="submit" disabled={props.isSavingGoal || !examDate || !selectedSubjects.length}><Icon name="lucide:target" color="currentColor" />{props.isSavingGoal ? t('me.common.saving', '保存中...') : t('me.actions.saveGoal', '保存考试目标')}</button></footer>
          </form>
        )}

        {panel === 'schedule' && (
          <form onSubmit={(event) => void submitAvailability(event)}>
            <header className="me-settings-panel-head"><div><p className="page-kicker">{t('me.settings.scheduleKicker', '可执行计划')}</p><h3>{t('me.settings.scheduleTitle', '学习时间与节奏')}</h3><p>{t('me.settings.scheduleBody', 'Agent 会在真实时间容量内安排任务；临时变化仍可在对话中直接告诉它。')}</p></div><span className="me-agent-read-badge"><Icon name="lucide:bot" color="currentColor" />{t('me.settings.agentCoreInput', 'Agent 核心输入')}</span></header>
            <div className="me-settings-form-grid"><label><span>{t('me.settings.timezone', '时区')}</span><input required value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Shanghai" /></label><label><span>{t('me.settings.weeklyMinutes', '每周学习分钟')}</span><input type="number" min="1" max="10080" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} placeholder="300" /></label><label><span>{t('me.settings.sessionMinutes', '默认单次时长')}</span><input type="number" min="1" max="480" value={sessionMinutes} onChange={(event) => setSessionMinutes(event.target.value)} placeholder="25" /></label></div>
            <fieldset className="me-study-days"><legend>{t('me.settings.studyDays', '通常可学习的星期')}</legend><div>{WEEKDAYS.map((day) => { const selected = studyDays.includes(day); return <button type="button" key={day} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => setStudyDays(selected ? studyDays.filter((item) => item !== day) : [...studyDays, day])}>{weekdayLabel(locale, day)}</button>; })}</div></fieldset>
            <div className="me-settings-info"><Icon name="lucide:clock-3" color="currentColor" /><span>{t('me.settings.temporaryConstraintNote', '“今天只有 10 分钟”属于本次对话约束，不会覆盖这里的长期设置。')}</span></div>
            <footer className="me-settings-panel-actions"><span>{props.agentSettings?.studyAvailability.source === 'user' ? t('me.settings.scheduleConfigured', '正在使用你的长期时间设置') : t('me.settings.scheduleUnset', '当前使用系统默认时间')}</span><button type="submit" disabled={props.isSavingAvailability}><Icon name="lucide:save" color="currentColor" />{props.isSavingAvailability ? t('me.common.saving', '保存中...') : t('me.actions.saveSchedule', '保存学习时间')}</button></footer>
          </form>
        )}

        {panel === 'organization' && (
          <section>
            <header className="me-settings-panel-head"><div><p className="page-kicker">{t('me.settings.organizationKicker', '机构')}</p><h3>{t('me.settings.organizationTitle', '机构与 AI 额度')}</h3><p>{t('me.settings.organizationBody', '加入学校或学习机构后，可按机构规则使用共享额度与班级能力。')}</p></div></header>
            <div className="me-organization-current"><Icon name="lucide:building-2" color="currentColor" /><div><small>{t('me.settings.currentOrganization', '当前机构')}</small><strong>{organizationName ?? t('me.settings.noOrganization', '未加入机构')}</strong><span>{t('me.settings.availableCredit', '当前可用 AI 额度')}: {creditLabel}</span></div></div>
            <div className="me-settings-subsection"><h4>{t('me.settings.organizationInvite', '机构邀请码')}</h4><p>{t('me.settings.inviteHelp', '粘贴邀请链接、token 或短邀请码。加入前不会改变当前机构。')}</p><div className="me-invite-row"><input value={props.inviteInput} placeholder={t('me.settings.invitePlaceholder', '粘贴邀请链接、token 或短邀请码')} onChange={(event) => props.onInviteInputChange(event.target.value)} /><button type="button" disabled={props.isJoiningOrganization} onClick={() => void props.onJoinOrganization()}>{props.isJoiningOrganization ? t('me.common.joining', '加入中...') : t('me.actions.joinOrganization', '加入机构')}</button></div></div>
          </section>
        )}
      </div>
    </section>
  );
}

