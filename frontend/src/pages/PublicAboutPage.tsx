import { Icon } from '../components/Icon';
import { SiteHeaderControls } from '../components/SiteHeaderControls';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { routes } from '../lib/routes';
import { trackPublicEvent } from '../lib/public-telemetry';
import '../styles/about.css';

type PublicAboutPageProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

const SECTIONS = [
  { id: 'product', icon: 'lucide:route', title: 'productTitle', body: 'productBody' },
  { id: 'ai', icon: 'lucide:sparkles', title: 'aiTitle', body: 'aiBody' },
  { id: 'privacy', icon: 'lucide:shield-check', title: 'privacyTitle', body: 'privacyBody' },
  { id: 'content', icon: 'lucide:database', title: 'contentTitle', body: 'contentBody' }
] as const;

export function PublicAboutPage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: PublicAboutPageProps) {
  const { t } = useI18n();

  return (
    <div className="public-about-shell">
      <header className="site-header site-header-home public-home-header">
        <div className="site-header-inner">
          <button type="button" className="site-brand" onClick={() => onNavigate(routes.home)}>
            <img className="site-brand-logo" src="/logo-candidate-v2-csca.png" alt="CSCAPilot" />
            <span className="site-brand-parent">by Holalobe</span>
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.home)}>{t('nav.home', '首页')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.cscaPrep)}>{t('homeNav.cscaPrep', 'CSCA 准备')}</button>
            <button type="button" className="site-link" onClick={() => onNavigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
          </nav>
          <SiteHeaderControls currentUser={currentUser} isResolvingAuth={isResolvingAuth} currentPath={routes.about} onNavigate={onNavigate} onCurrentUserChange={onCurrentUserChange} />
        </div>
      </header>

      <main className="public-about-main">
        <section className="public-about-hero">
          <span>{t('about.eyebrow', '产品与信任')}</span>
          <h1>{t('about.title', '关于 CSCAPilot')}</h1>
          <p>{t('about.intro', 'CSCAPilot 是 Holalobe 旗下的 CSCA 学习产品，围绕真实作答连接诊断、练习、解析与复盘。')}</p>
          <div className="public-about-actions">
            <button type="button" className="primary" onClick={() => onNavigate(routes.agent)}>{t('about.enterAgent', '进入学习 Agent')}<Icon name="lucide:arrow-right" /></button>
            <button type="button" onClick={() => onNavigate(routes.cscaPrep)}>{t('about.viewPrep', '查看 CSCA 备考说明')}</button>
          </div>
        </section>

        <aside className="public-about-notice" aria-label={t('about.independentTitle', '独立产品说明')}>
          <Icon name="lucide:badge-info" />
          <div><strong>{t('about.independentTitle', '独立产品说明')}</strong><p>{t('about.independentBody', 'CSCAPilot 是独立学习与备考工具，不是 CSCA 官方报名网站。考试日期、费用、报名与规则请以 CSCA 官方发布为准。')}</p></div>
          <a href="https://csca.cn/about/examintro" target="_blank" rel="noreferrer" onClick={() => trackPublicEvent({ eventType: 'public_cta_click', route: 'about', target: 'official_csca' })}>{t('about.officialLink', '查看 CSCA 官方信息')}<Icon name="lucide:arrow-up-right" /></a>
        </aside>

        <section className="public-about-grid" aria-label={t('about.detailsAria', 'CSCAPilot 服务说明')}>
          {SECTIONS.map((section) => (
            <article id={section.id} key={section.id}>
              <Icon name={section.icon} />
              <h2>{t(`about.${section.title}`, '')}</h2>
              <p>{t(`about.${section.body}`, '')}</p>
            </article>
          ))}
        </section>

        <section className="public-about-support">
          <div><span>{t('about.supportKicker', '支持与说明')}</span><h2>{t('about.supportTitle', '需要帮助时，从账号与学习入口继续。')}</h2><p>{t('about.supportBody', '登录后可在个人设置管理账号，在学习 Agent 中继续练习与查看学习记录。')}</p></div>
          <div><button type="button" onClick={() => onNavigate(routes.me)}>{t('about.personalSettings', '个人设置')}</button><button type="button" className="primary" onClick={() => onNavigate(routes.agent)}>{t('about.learningWorkspace', '学习 Agent')}</button></div>
        </section>
      </main>

      <footer className="public-about-footer">
        <span>© {new Date().getFullYear()} CSCAPilot · by Holalobe</span>
        <button type="button" onClick={() => onNavigate(routes.home)}>{t('footer.backHome', '返回首页')}</button>
      </footer>
    </div>
  );
}
