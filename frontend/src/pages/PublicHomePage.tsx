import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { SiteHeaderControls } from '../components/SiteHeaderControls';
import { getHomeCopy, mergeHomeCopyFromBlocks, type HomeCopy } from '../content/public-site';
import { DEFAULT_CSCA_EXAM_SCHEDULE, mergeCscaExamScheduleFromBlocks, type CscaExamSchedule } from '../content/csca-exam';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { getPublicContent } from '../lib/api-content';
import { routes } from '../lib/routes';
import { HomePage } from './HomePage';

type PublicHomePageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

export function PublicHomePage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: PublicHomePageProps) {
  const { locale, t } = useI18n();
  const [copy, setCopy] = useState<HomeCopy>(() => getHomeCopy(locale));
  const [examSchedule, setExamSchedule] = useState<CscaExamSchedule>(DEFAULT_CSCA_EXAM_SCHEDULE);

  useEffect(() => {
    let active = true;
    const fallbackCopy = getHomeCopy(locale);
    setCopy(fallbackCopy);
    void getPublicContent({ locale })
      .then(({ items }) => {
        if (!active) return;
        const localizedItems = items.filter((item) => item.isFallback !== true && (!item.locale || item.locale === locale));
        setCopy(mergeHomeCopyFromBlocks(localizedItems, fallbackCopy));
        setExamSchedule(mergeCscaExamScheduleFromBlocks(items));
      })
      .catch(() => {
        if (!active) return;
        setCopy(fallbackCopy);
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
            <span><strong>{t('homeNav.brand', 'CSCA 学习 Agent')}</strong></span>
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(`${routes.agent}?agentSection=resources`)}>{t('homeNav.resources', '真题资料')}</button>
          </nav>
          <SiteHeaderControls
            currentUser={currentUser}
            isResolvingAuth={isResolvingAuth}
            currentPath={window.location.pathname}
            onNavigate={onNavigate}
            onCurrentUserChange={onCurrentUserChange}
          />
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
              <strong>CSCAPilot</strong>
              <small>{t('homeFooter.brandTagline', '专注 CSCA 数学、物理、化学学习与训练。')}</small>
            </span>
          </div>
          <div className="public-home-footer-column public-home-footer-product">
            <strong>{t('homeFooter.productTitle', '产品')}</strong>
            <button type="button" onClick={() => onNavigate(routes.agent)}>{t('homeFooter.productName', 'CSCA 学习 Agent')}<Icon name="lucide:arrow-up-right" /></button>
            <small>{t('homeFooter.productBody', '一个 Agent 串联诊断、训练与复盘。')}</small>
          </div>
          <nav className="public-home-footer-column public-home-footer-nav" aria-label={t('footer.aria', '页脚导航')}>
            <strong>{t('homeFooter.capabilitiesTitle', 'Agent 能力')}</strong>
            <button type="button" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" onClick={() => onNavigate(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
            <button type="button" onClick={() => onNavigate(`${routes.agent}?agentSection=resources`)}>{t('homeNav.resources', '真题资料')}</button>
          </nav>
          <div className="public-home-footer-column public-home-footer-trust">
            <strong>{t('homeFooter.trustTitle', '服务与信任')}</strong>
            <span>{t('homeFooter.aiDisclosure', 'AI 辅助学习说明')}</span>
            <span>{t('homeFooter.recordPrivacy', '账号与学习记录保护')}</span>
            <span>{t('homeFooter.originalContent', '原创训练内容')}</span>
          </div>
        </div>
        <div className="public-home-footer-note">
          <span className="public-home-footer-ai"><Icon name="lucide:sparkles" />{t('homeFooter.deepSeek', 'AI 能力由 DeepSeek 模型支持')}</span>
          <span>© {new Date().getFullYear()} CSCAPilot. {t('homeFooter.rights', '保留所有权利。')}</span>
        </div>
      </footer>
    </>
  );
}
