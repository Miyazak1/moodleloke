import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { SiteHeaderControls } from '../components/SiteHeaderControls';
import { DEFAULT_CSCA_EXAM_SCHEDULE, mergeCscaExamScheduleFromBlocks, type CscaExamSchedule } from '../content/csca-exam';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { getPublicContent } from '../lib/api-content';
import { routes } from '../lib/routes';
import { trackPublicEvent } from '../lib/public-telemetry';
import '../styles/csca-prep.css';

type CscaPrepPageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

const SUBJECTS = [
  { key: 'math', icon: 'lucide:sigma', color: 'blue', fallback: '数学' },
  { key: 'physics', icon: 'lucide:atom', color: 'mint', fallback: '物理' },
  { key: 'chemistry', icon: 'lucide:flask-conical', color: 'coral', fallback: '化学' }
] as const;

export function CscaPrepPage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: CscaPrepPageProps) {
  const { locale, t } = useI18n();
  const [schedule, setSchedule] = useState<CscaExamSchedule>(DEFAULT_CSCA_EXAM_SCHEDULE);

  useEffect(() => {
    let active = true;
    void getPublicContent({ locale })
      .then(({ items }) => { if (active) setSchedule(mergeCscaExamScheduleFromBlocks(items)); })
      .catch(() => { if (active) setSchedule(DEFAULT_CSCA_EXAM_SCHEDULE); });
    return () => { active = false; };
  }, [locale]);

  const nextExamWindow = (() => {
    const announced = new Date(`${schedule.nextExamDate}T00:00:00Z`);
    const now = new Date();
    if (Number.isFinite(announced.getTime()) && announced.getTime() >= now.getTime()) {
      return {
        label: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(announced),
        confirmed: true
      };
    }
    const regularMonths = [0, 2, 3, 5, 11];
    const nextMonth = regularMonths.find((month) => month > now.getUTCMonth());
    const year = nextMonth === undefined ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    return {
      label: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, nextMonth ?? regularMonths[0], 1))),
      confirmed: false
    };
  })();
  const officialSourceUrl = schedule.sourceUrl.includes('apply4ch.com') ? 'https://csca.cn/about/examintro' : schedule.sourceUrl;
  const verifiedDate = (() => {
    const date = new Date(`${schedule.lastVerifiedAt}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? schedule.lastVerifiedAt
      : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
  })();
  const subjectRows = schedule.subjects.filter((item) => ['数学', '物理', '化学'].some((name) => item.name.includes(name)));
  const prepSteps = [
    ['stepSchoolLabel', 'stepSchoolTitle', 'stepSchoolBody', 'stepSchoolAction', routes.agent],
    ['stepRequirementsLabel', 'stepRequirementsTitle', 'stepRequirementsBody', 'stepRequirementsAction', `${routes.agent}?agentSection=progress`],
    ['stepMockLabel', 'stepMockTitle', 'stepMockBody', 'stepMockAction', `${routes.agent}?mode=free&subject=math`],
    ['stepReviewLabel', 'stepReviewTitle', 'stepReviewBody', 'stepReviewAction', `${routes.agent}?agentSection=resources`]
  ] as const;
  const faqs = [1, 2, 3, 4, 5, 6].map((number) => ({
    question: t(`cscaPrep.faq${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][number - 1]}Question`, ''),
    answer: t(`cscaPrep.faq${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][number - 1]}Answer`, '')
  }));

  return (
    <div className="csca-prep-shell">
      <header className="site-header site-header-home public-home-header">
        <div className="site-header-inner">
          <button type="button" className="site-brand" onClick={() => onNavigate(routes.home)}>
            <img className="site-brand-logo" src="/logo-candidate-v2-csca.png" alt="CSCAPilot" />
            <span className="site-brand-parent">by Holalobe</span>
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.home)}>{t('nav.home', '首页')}</button>
            <button type="button" className="site-link active" onClick={() => onNavigate(routes.cscaPrep)}>{t('homeNav.cscaPrep', 'CSCA 准备')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(`${routes.agent}?agentSection=resources`)}>{t('homeNav.resources', '真题资料')}</button>
          </nav>
          <SiteHeaderControls currentUser={currentUser} isResolvingAuth={isResolvingAuth} currentPath={routes.cscaPrep} onNavigate={onNavigate} onCurrentUserChange={onCurrentUserChange} />
        </div>
      </header>

      <main className="csca-prep-main">
        <section className="csca-prep-hero">
          <div className="csca-prep-hero-copy">
            <span className="csca-prep-kicker">{t('cscaPrep.heroKicker', 'CSCA 备考路径')}</span>
            <h1>{t('cscaPrep.heroTitle', '先快速诊断，再进入三科练习。')}</h1>
            <p>{t('cscaPrep.heroBody', 'CSCAPilot 学习 Agent 把真实作答诊断、科目短题和错题复盘连成一条路径。')}</p>
            <div className="csca-prep-actions">
              <button type="button" className="primary" onClick={() => onNavigate(routes.agent)}><Icon name="lucide:play" />{t('cscaPrep.heroPrimary', '进入学习 Agent')}</button>
              <button type="button" onClick={() => onNavigate(`${routes.agent}?mode=free&subject=math`)}><Icon name="lucide:book-open-check" />{t('cscaPrep.heroSecondary', '查看科目学习')}</button>
              <a href="#exam-info"><Icon name="lucide:calendar-days" />{t('cscaPrep.heroTertiary', '考试时间换算')}</a>
            </div>
          </div>
          <div className="csca-prep-route-card" aria-label={t('cscaPrep.pathAria', 'CSCA 备考路径')}>
            <span>{t('cscaPrep.labKicker', 'Practice Lab')}</span>
            <h2>{t('cscaPrep.labTitle', '三科结果汇成下一组练习')}</h2>
            <div className="csca-prep-route-lines">
              {SUBJECTS.map((subject, index) => <div key={subject.key} className={subject.color}><b>{String(index + 1).padStart(2, '0')}</b><Icon name={subject.icon} /><strong>{t(`subjects.${subject.key}`, subject.fallback)}</strong><i /></div>)}
              <div className="result"><Icon name="lucide:route" /><strong>{t('cscaPrep.stepRequirementsTitle', '交卷后看薄弱点')}</strong><Icon name="lucide:arrow-right" /></div>
            </div>
          </div>
        </section>

        <section className="csca-prep-intro">
          <div>
            <span className="csca-prep-kicker">{t('cscaPrep.whatIsKicker', 'CSCA 是什么')}</span>
            <h2>{t('cscaPrep.whatIsTitle', '备考页只做一件事：让下一步练习更清楚。')}</h2>
          </div>
          <p>{t('cscaPrep.whatIsBody', '先完成一次真实作答诊断，看清三科薄弱点和解析，再由 Agent 安排对应科目训练。')}</p>
        </section>

        <section id="exam-info" className="csca-prep-info-grid" aria-label={t('cscaPrep.keyInfoAria', 'CSCA 考试关键信息')}>
          <article className="featured"><Icon name="lucide:calendar-check" /><span>{t('cscaPrep.nextExam', '下一次考试')}</span><strong>{nextExamWindow.label}</strong><small>{nextExamWindow.confirmed ? t('homeLite.intro.confirmedDate', '已公布日期') : t('homeLite.intro.pendingDate', '具体日期与报名时间待官方公布')}</small></article>
          <article><Icon name="lucide:clock-3" /><span>{t('cscaPrep.regularSchedule', '常规安排')}</span><strong>{schedule.regularScheduleText}</strong><small>{t('cscaPrep.beijingTime', '北京时间')}</small></article>
          <article><Icon name="lucide:clipboard-check" /><span>{t('cscaPrep.examFormatKicker', '考试形式')}</span><strong>{schedule.examFormat.mode}</strong><small>{schedule.examFormat.delivery}</small></article>
          <article><Icon name="lucide:badge-dollar-sign" /><span>{t('cscaPrep.feesKicker', '考试费用')}</span><strong>{schedule.fees[0]?.value}</strong><small>{schedule.fees[1]?.label}: {schedule.fees[1]?.value}</small></article>
        </section>

        <section className="csca-prep-section">
          <div className="csca-prep-section-heading"><span className="csca-prep-kicker">{t('cscaPrep.subjectsKicker', '考试科目')}</span><h2>{t('cscaPrep.subjectsTitle', '数学、物理、化学分开练，但结果回到同一份报告。')}</h2><p>{t('cscaPrep.subjectsBody', '学习 Agent 用真实作答诊断薄弱点，再安排短题训练和复盘。')}</p></div>
          <div className="csca-prep-subjects">
            {SUBJECTS.map((subject, index) => {
              const row = subjectRows[index];
              return <article key={subject.key} className={subject.color}><div><Icon name={subject.icon} /><span>0{index + 1}</span></div><h3>{t(`subjects.${subject.key}`, subject.fallback)}</h3><p>{row?.syllabusItems.join(' · ')}</p><dl><div><dt>{t('cscaPrep.examLanguage', '考试语言')}</dt><dd>{row?.language ?? '—'}</dd></div><div><dt>{t('cscaPrep.duration', '时长')}</dt><dd>{row?.durationMinutes ?? 60} {t('cscaPrep.minutes', '分钟')}</dd></div><div><dt>{t('cscaPrep.questionCount', '题数')}</dt><dd>{row?.questions ?? '—'}</dd></div></dl><button type="button" onClick={() => onNavigate(`${routes.agent}?mode=free&subject=${subject.key}`)}>{t('cscaPrep.stepMockAction', '查看科目学习')}<Icon name="lucide:arrow-right" /></button></article>;
            })}
          </div>
        </section>

        <section className="csca-prep-section csca-prep-steps">
          <div className="csca-prep-section-heading"><span className="csca-prep-kicker">{t('cscaPrep.prepStepsKicker', '准备步骤')}</span><h2>{t('cscaPrep.prepStepsTitle', '把诊断、练习、复盘和验证连起来。')}</h2><p>{t('cscaPrep.prepStepsBody', '沿着清楚的路径完成定位、学习与复盘。')}</p></div>
          <div className="csca-prep-step-list">{prepSteps.map(([label, title, body, action, href], index) => <article key={label}><b>{String(index + 1).padStart(2, '0')}</b><div><span>{t(`cscaPrep.${label}`, '')}</span><h3>{t(`cscaPrep.${title}`, '')}</h3><p>{t(`cscaPrep.${body}`, '')}</p></div><button type="button" onClick={() => onNavigate(href)}>{t(`cscaPrep.${action}`, '')}<Icon name="lucide:arrow-right" /></button></article>)}</div>
        </section>

        <section className="csca-prep-section csca-prep-faq">
          <div className="csca-prep-section-heading"><span className="csca-prep-kicker">{t('cscaPrep.faqKicker', '常见问题')}</span><h2>{t('cscaPrep.faqTitle', '把考试信息和申请判断放在一起看。')}</h2></div>
          <div>{faqs.map((faq, index) => <details key={faq.question} open={index === 0}><summary>{faq.question}<Icon name="lucide:chevron-down" /></summary><p>{faq.answer}</p></details>)}</div>
        </section>

        <section className="csca-prep-source"><Icon name="lucide:badge-info" /><div><span className="csca-prep-kicker">{t('cscaPrep.sourceKicker', '官方信息')}</span><h2>{t('cscaPrep.sourceTitle', '考试安排最终以官方发布为准。')}</h2><p>{t('cscaPrep.sourceBody', '本页用于组织练习路径和时间提醒。')}</p><small className="csca-prep-verified">{t('cscaPrep.lastVerified', '本页信息最近核验：')} {verifiedDate}</small><strong className="csca-prep-independent">{t('cscaPrep.independentNotice', 'CSCAPilot 是独立学习与备考工具，不是 CSCA 官方报名网站。')}</strong></div><a href={officialSourceUrl} target="_blank" rel="noreferrer" onClick={() => trackPublicEvent({ eventType: 'public_cta_click', route: 'csca_prep', target: 'official_csca' })}>{schedule.sourceLabel}<Icon name="lucide:arrow-up-right" /></a></section>
      </main>

      <footer className="csca-prep-footer"><img className="site-brand-logo site-brand-logo-footer" src="/logo-candidate-v2-csca.png" alt="CSCAPilot" /><span>© {new Date().getFullYear()} CSCAPilot · by Holalobe</span><button type="button" onClick={() => onNavigate(routes.about)}>{t('homeFooter.trustTitle', '服务与信任')}</button><button type="button" onClick={() => onNavigate(routes.agent)}>{t('cscaPrep.practiceAction', '进入学习 Agent')}<Icon name="lucide:arrow-right" /></button></footer>
    </div>
  );
}
