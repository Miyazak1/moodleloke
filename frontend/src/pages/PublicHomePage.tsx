import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { LanguageSelector } from '../components/LanguageSelector';
import { HOME_COPY, mergeHomeCopyFromBlocks, type HomeCopy } from '../content/public-site';
import { DEFAULT_CSCA_EXAM_SCHEDULE, mergeCscaExamScheduleFromBlocks, type CscaExamSchedule } from '../content/csca-exam';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { getPublicContent } from '../lib/api-content';
import { routes } from '../lib/routes';
import { HomePage } from './HomePage';

type PublicHomePageProps = {
  currentUser: User | null;
  onNavigate: (path: string) => void;
};

export function PublicHomePage({ currentUser, onNavigate }: PublicHomePageProps) {
  const { locale, t } = useI18n();
  const [copy, setCopy] = useState<HomeCopy>(HOME_COPY);
  const [examSchedule, setExamSchedule] = useState<CscaExamSchedule>(DEFAULT_CSCA_EXAM_SCHEDULE);

  useEffect(() => {
    let active = true;
    void getPublicContent({ locale })
      .then(({ items }) => {
        if (!active) return;
        setCopy(mergeHomeCopyFromBlocks(items));
        setExamSchedule(mergeCscaExamScheduleFromBlocks(items));
      })
      .catch(() => {
        if (!active) return;
        setCopy(HOME_COPY);
        setExamSchedule(DEFAULT_CSCA_EXAM_SCHEDULE);
      });
    return () => { active = false; };
  }, [locale]);

  return (
    <>
      <header className="site-header site-header-home public-home-header">
        <div className="site-header-inner">
          <button type="button" className="site-brand" onClick={() => onNavigate(routes.home)}>
            <span className="site-brand-mark" aria-hidden="true">CS</span>
            <span><strong>CSCA 学习 Agent</strong></span>
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(`${routes.agent}?agentSection=resources`)}>{t('homeNav.resources', '真题资料')}</button>
          </nav>
          <div className="site-account-group">
            <LanguageSelector compact />
            <button type="button" className="site-login-button" onClick={() => onNavigate(currentUser ? routes.me : `${routes.auth}?redirect=${encodeURIComponent(routes.agent)}`)}>
              {currentUser ? t('homeNav.account', '我的账号') : t('common.login', '登录')}
            </button>
          </div>
        </div>
      </header>
      <HomePage
        copy={copy}
        featuredSchools={[]}
        currentUser={currentUser}
        examSchedule={examSchedule}
        onGoToSchools={() => onNavigate(routes.agent)}
        onGoToConsulting={() => onNavigate(routes.agent)}
        onNavigate={onNavigate}
        onOpenSchoolDetail={() => onNavigate(routes.agent)}
      />
      <footer className="public-home-footer">
        <div className="public-home-footer-inner">
          <div className="public-home-footer-brand">
            <span className="site-brand-mark" aria-hidden="true">CS</span>
            <span>
              <strong>CSCA 学习 Agent</strong>
              <small>{t('homeFooter.focus', '专注数学、物理、化学做题训练')}</small>
            </span>
          </div>
          <nav className="public-home-footer-nav" aria-label={t('footer.aria', '页脚导航')}>
            <button type="button" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" onClick={() => onNavigate(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
            <button type="button" onClick={() => onNavigate(`${routes.agent}?agentSection=resources`)}>{t('homeNav.resources', '真题资料')}</button>
          </nav>
          <button className="public-home-footer-action" type="button" onClick={() => onNavigate(routes.agent)}>
            {t('homeFooter.start', '开始学习')}<Icon name="lucide:arrow-right" />
          </button>
        </div>
        <div className="public-home-footer-note">
          <span>{t('footer.legal', '原创模拟与备考练习，帮助学生把 CSCA 准备做得更清楚。')}</span>
          <span>© {new Date().getFullYear()} Moodlelike</span>
        </div>
      </footer>
    </>
  );
}
