import { lazy, Suspense, useEffect, useState } from 'react';
import { AppLoadingState } from './components/AppLoadingState';
import { ErrorBanner } from './components/ErrorBanner';
import { Icon } from './components/Icon';
import { LanguageSelector } from './components/LanguageSelector';
import { SiteHeaderControls } from './components/SiteHeaderControls';
import type { User } from './lib/api';
import { buildAuthRedirectUrl, buildOnboardingUrl, safeAdminReturnPath, safeReturnPath } from './lib/app-navigation';
import { createAgentHostBridge } from './lib/agent-host-bridge';
import { isAgentPracticeWriteEnabled, isAgentWebEnabled } from './lib/agent-feature';
import { requestJson } from './lib/request';
import { EMAIL_UNVERIFIED_EVENT } from './lib/request';
import { routes } from './lib/routes';
import { applyPublicMetadata } from './lib/public-metadata';
import { trackPublicEvent, trackPublicPageView, type PublicTelemetryRoute, type PublicTelemetryTarget } from './lib/public-telemetry';
import { resolveStandaloneHref, resolveStandaloneLocation, type StandaloneRoute } from './lib/standalone-route-policy';
import { useAuthSession } from './lib/use-auth-session';
import { useI18n } from './i18n/useI18n';

const AgentPage = lazy(() => import('./pages/AgentPage').then((module) => ({ default: module.AgentPage })));
const PublicHomePage = lazy(() => import('./pages/PublicHomePage').then((module) => ({ default: module.PublicHomePage })));
const PublicAboutPage = lazy(() => import('./pages/PublicAboutPage').then((module) => ({ default: module.PublicAboutPage })));
const CscaPrepPage = lazy(() => import('./pages/CscaPrepPage').then((module) => ({ default: module.CscaPrepPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));
const PublicMePage = lazy(() => import('./pages/PublicMePage').then((module) => ({ default: module.PublicMePage })));
const StudentOnboardingPage = lazy(() => import('./pages/StudentOnboardingPage').then((module) => ({ default: module.StudentOnboardingPage })));

function readStandaloneRoute(): StandaloneRoute {
  return resolveStandaloneLocation(window.location.pathname, window.location.search, window.location.hash).route;
}

function readInitialAuthMode() {
  const resolution = resolveStandaloneLocation(window.location.pathname, window.location.search, window.location.hash);
  const search = new URL(resolution.href, window.location.origin).searchParams;
  return search.get('mode') === 'register' ? 'register' : 'login';
}

function telemetryRoute(route: StandaloneRoute): PublicTelemetryRoute | null {
  if (route === 'csca-prep') return 'csca_prep';
  if (route === 'home' || route === 'about' || route === 'agent' || route === 'auth' || route === 'me' || route === 'onboarding') return route;
  return null;
}

export default function StandaloneAgentApp() {
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const { locale, t } = useI18n();
  const [route, setRoute] = useState<StandaloneRoute>(() => readStandaloneRoute());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      const resolution = resolveStandaloneLocation(window.location.pathname, window.location.search, window.location.hash);
      if (resolution.shouldCanonicalize) window.history.replaceState({}, '', resolution.href);
      setRoute(resolution.route);
    };
    syncRoute();
    const handlePopState = () => syncRoute();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    applyPublicMetadata(route, locale);
  }, [route, locale]);

  useEffect(() => {
    const safeRoute = telemetryRoute(route);
    if (!safeRoute) return;
    trackPublicPageView(safeRoute, locale);
    if (safeRoute === 'agent') {
      trackPublicEvent({ eventType: 'agent_entry', route: safeRoute, locale, component: 'agent_entry' });
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        trackPublicEvent({ eventType: 'auth_completed', route: safeRoute, locale, method: 'google', mode: readInitialAuthMode(), result: 'success', component: 'auth' });
      }
    }
    if (safeRoute === 'me' && new URLSearchParams(window.location.search).get('verified') === 'email') {
      trackPublicEvent({ eventType: 'email_verification_result', route: safeRoute, locale, method: 'email', result: 'success', component: 'auth' });
    }
  }, [route, locale]);

  useEffect(() => {
    const report = () => {
      const safeRoute = telemetryRoute(route);
      if (safeRoute) trackPublicEvent({ eventType: 'public_client_error', route: safeRoute, locale, component: 'route' });
    };
    window.addEventListener('error', report);
    window.addEventListener('unhandledrejection', report);
    return () => {
      window.removeEventListener('error', report);
      window.removeEventListener('unhandledrejection', report);
    };
  }, [route, locale]);

  useEffect(() => {
    const handleEmailUnverified = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setError(detail?.message || '请先验证邮箱后继续使用。');
    };
    window.addEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
    return () => window.removeEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
  }, []);

  function navigate(next: string) {
    const legacyLearningPath = String(next ?? '');
    const resolution = resolveStandaloneHref(legacyLearningPath, window.location.origin);
    const from = telemetryRoute(route);
    const target = telemetryRoute(resolution.route) as PublicTelemetryTarget | null;
    if (from && target && from !== target && (from === 'home' || from === 'about' || from === 'csca_prep' || from === 'auth')) {
      trackPublicEvent({ eventType: 'public_cta_click', route: from, locale, target });
    }
    window.history.pushState({}, '', resolution.href);
    window.dispatchEvent(new Event('moodlelike:navigation'));
    setRoute(resolution.route);
  }

  function completeAuth(user: User, redirectTo?: string, isRegistration = false) {
    setCurrentUser(user);
    setIsResolvingAuth(false);
    const adminReturnTo = user.role === 'admin' ? safeAdminReturnPath(redirectTo) : null;
    if (adminReturnTo) {
      window.location.assign(adminReturnTo);
      return;
    }
    if (isRegistration && user.role !== 'admin') {
      navigate(buildOnboardingUrl(safeReturnPath(redirectTo, routes.agent)));
      return;
    }
    navigate(safeReturnPath(redirectTo, routes.agent));
  }

  const isAgent = route === 'agent';
  const mainClassName = isAgent
    ? 'site-main site-main-agent'
    : route === 'home' || route === 'about' || route === 'csca-prep'
      ? 'site-main site-main-home'
      : 'site-main';
  const agentHost = createAgentHostBridge({
    navigate,
    requestAuthentication: (returnTo) => navigate(buildAuthRedirectUrl(returnTo)),
    getSnapshot: () => ({
      contractVersion: 'cscalite-agent-host-v1',
      identity: currentUser ? {
        id: String(currentUser.id),
        email: currentUser.email,
        role: currentUser.role,
        ...(currentUser.displayName ? { displayName: currentUser.displayName } : {}),
        emailVerified: Boolean(currentUser.emailVerifiedAt)
      } : null,
      isResolvingAuth,
      locale,
      features: {
        agentWeb: isAgentWebEnabled(),
        practiceWrite: isAgentPracticeWriteEnabled(),
        studentRuntimeQuestionGeneration: false
      }
    }),
    requestJson
  });
  return (
    <div className={isAgent ? 'site-shell site-shell-agent' : 'site-shell'}>
      {route === 'me' ? (
        <header className="site-header site-header-home account-site-header">
          <div className="site-header-inner">
            <button type="button" className="site-brand" onClick={() => navigate(routes.home)}>
              <img className="site-brand-logo" src="/logo-candidate-v2-csca.png" alt={t('homeNav.brand', 'CSCA 学习 Agent')} />
            </button>
            <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
              <button type="button" className="site-link" onClick={() => navigate(routes.home)}>{t('nav.home', '首页')}</button>
              <button type="button" className="site-link" onClick={() => navigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
              <button type="button" className="site-link" onClick={() => navigate(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
            </nav>
            <SiteHeaderControls
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              currentPath={window.location.pathname}
              onNavigate={navigate}
              onCurrentUserChange={setCurrentUser}
              showLanguage={false}
            />
          </div>
        </header>
      ) : null}
      {(route !== 'home' && route !== 'about' && route !== 'csca-prep' && route !== 'me' && (!isAgent || !currentUser)) ? <div className="standalone-language-bar"><LanguageSelector compact /></div> : null}
      <main className={mainClassName}>
        <ErrorBanner message={error} />
        <Suspense fallback={<AppLoadingState variant="page" />}>
          {route === 'home' && (
            <PublicHomePage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
          {route === 'csca-prep' && (
            <CscaPrepPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
          {route === 'about' && (
            <PublicAboutPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
          {route === 'agent' && (
            <AgentPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              host={agentHost}
            />
          )}
          {route === 'auth' && (
            <PublicAuthPage
              initialMode={readInitialAuthMode()}
              redirectTo={new URLSearchParams(window.location.search).get('redirect') ?? undefined}
              onBackHome={() => navigate(routes.agent)}
              onGoToMe={completeAuth}
            />
          )}
          {route === 'onboarding' && (
            <StudentOnboardingPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              returnTo={safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'), routes.agent)}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
          {route === 'me' && (
            <PublicMePage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
              onGoToMockExam={() => navigate(`${routes.agent}?agentSection=progress`)}
              onGoToAuth={() => navigate(routes.auth)}
              onOpenMockExamReport={() => navigate(`${routes.agent}?agentSection=progress`)}
              onOpenSpecialPracticeReport={() => navigate(`${routes.agent}?agentSection=progress`)}
              onOpenSpecialPracticeTopic={(subject) => navigate(`${routes.agent}?mode=free&subject=${encodeURIComponent(subject)}`)}
              onGoToSpecialPractice={() => navigate(routes.agent)}
              onGoToAdmin={() => window.location.assign(routes.adminAudit)}
              onNavigate={navigate}
            />
          )}
          {route === 'not-found' && (
            <section className="empty-state" role="alert">
              <h1>页面不存在</h1>
              <p>请检查访问地址。</p>
              <button type="button" onClick={() => navigate(routes.agent)}>返回做题</button>
            </section>
          )}
        </Suspense>
      </main>
      {route === 'me' ? (
        <footer className="site-footer site-footer-account">
          <div className="site-footer-account-inner">
            <div className="site-footer-account-brand">
              <img className="site-brand-logo site-brand-logo-footer" src="/logo-candidate-v2-csca.png" alt="CSCA" />
              <div><span>© {new Date().getFullYear()} · {t('footer.accountPrivacy', '账号信息仅用于登录、安全与学习记录。')}</span></div>
            </div>
            <nav aria-label={t('footer.accountAria', '账号页页脚导航')}>
              <button type="button" onClick={() => navigate(routes.home)}>{t('footer.backHome', '返回首页')}</button>
              <button type="button" onClick={() => navigate(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            </nav>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
