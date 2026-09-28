import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBanner } from './components/ErrorBanner';
import { LanguageSelector } from './components/LanguageSelector';
import type { User } from './lib/api';
import { buildAuthRedirectUrl, buildOnboardingUrl, safeAdminReturnPath, safeReturnPath } from './lib/app-navigation';
import { createAgentHostBridge } from './lib/agent-host-bridge';
import { isAgentPracticeWriteEnabled, isAgentWebEnabled } from './lib/agent-feature';
import { requestJson } from './lib/request';
import { EMAIL_UNVERIFIED_EVENT } from './lib/request';
import { routes } from './lib/routes';
import { resolveStandaloneHref, resolveStandaloneLocation, type StandaloneRoute } from './lib/standalone-route-policy';
import { useAuthSession } from './lib/use-auth-session';
import { useI18n } from './i18n/useI18n';

const AgentPage = lazy(() => import('./pages/AgentPage').then((module) => ({ default: module.AgentPage })));
const PublicHomePage = lazy(() => import('./pages/PublicHomePage').then((module) => ({ default: module.PublicHomePage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));
const StandaloneAccountPage = lazy(() => import('./pages/StandaloneAccountPage').then((module) => ({ default: module.StandaloneAccountPage })));
const StudentOnboardingPage = lazy(() => import('./pages/StudentOnboardingPage').then((module) => ({ default: module.StudentOnboardingPage })));

function readStandaloneRoute(): StandaloneRoute {
  return resolveStandaloneLocation(window.location.pathname, window.location.search, window.location.hash).route;
}

function readInitialAuthMode() {
  const resolution = resolveStandaloneLocation(window.location.pathname, window.location.search, window.location.hash);
  const search = new URL(resolution.href, window.location.origin).searchParams;
  return search.get('mode') === 'register' ? 'register' : 'login';
}

export default function StandaloneAgentApp() {
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const { locale } = useI18n();
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
    const handleEmailUnverified = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setError(detail?.message || '请先验证邮箱后继续使用。');
    };
    window.addEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
    return () => window.removeEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
  }, []);

  function navigate(next: string) {
    const resolution = resolveStandaloneHref(next, window.location.origin);
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
    : route === 'home'
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
      {(route !== 'home' && (!isAgent || !currentUser)) ? <div className="standalone-language-bar"><LanguageSelector compact /></div> : null}
      <main className={mainClassName}>
        <ErrorBanner message={error} />
        <Suspense fallback={<div className="page-loading" role="status" aria-live="polite">正在加载学习空间…</div>}>
          {route === 'home' && (
            <PublicHomePage currentUser={currentUser} onNavigate={navigate} />
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
            <StandaloneAccountPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
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
    </div>
  );
}
