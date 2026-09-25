import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBanner } from './components/ErrorBanner';
import { LanguageSelector } from './components/LanguageSelector';
import type { User } from './lib/api';
import { buildAuthRedirectUrl, buildOnboardingUrl } from './lib/app-navigation';
import { createAgentHostBridge } from './lib/agent-host-bridge';
import { isAgentPracticeWriteEnabled, isAgentWebEnabled } from './lib/agent-feature';
import { requestJson } from './lib/request';
import { EMAIL_UNVERIFIED_EVENT } from './lib/request';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';
import { useI18n } from './i18n/useI18n';

const AgentPage = lazy(() => import('./pages/AgentPage').then((module) => ({ default: module.AgentPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));
const StandaloneAccountPage = lazy(() => import('./pages/StandaloneAccountPage').then((module) => ({ default: module.StandaloneAccountPage })));
const StudentOnboardingPage = lazy(() => import('./pages/StudentOnboardingPage').then((module) => ({ default: module.StudentOnboardingPage })));

type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me' | 'not-found';

function currentPathname() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return pathname || routes.home;
}

function readStandaloneRoute(): StandaloneRoute {
  const route = currentPathname();
  if (route === routes.auth || route === routes.login || route === routes.register) return 'auth';
  if (route === routes.onboarding) return 'onboarding';
  if (route === routes.me) return 'me';
  if (route === routes.agent || route === routes.home) return 'agent';
  return 'not-found';
}

function canonicalPath(route: StandaloneRoute) {
  if (route === 'auth') return routes.auth;
  if (route === 'onboarding') return routes.onboarding;
  if (route === 'me') return routes.me;
  return routes.agent;
}

export default function StandaloneAgentApp() {
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const { locale } = useI18n();
  const [route, setRoute] = useState<StandaloneRoute>(() => readStandaloneRoute());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => setRoute(readStandaloneRoute());
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
    const nextUrl = new URL(next, window.location.origin);
    const internalPath = nextUrl.pathname.replace(/\/+$/, '') || routes.home;
    let nextRoute: StandaloneRoute = 'agent';
    let isKnownStandalonePath = internalPath === routes.agent || internalPath === routes.home;
    if (internalPath === routes.auth || internalPath === routes.login || internalPath === routes.register) nextRoute = 'auth';
    else if (internalPath === routes.onboarding) nextRoute = 'onboarding';
    else if (internalPath === routes.me) nextRoute = 'me';
    if (nextRoute !== 'agent') isKnownStandalonePath = true;
    const preserveSuffix = isKnownStandalonePath && internalPath !== routes.home;
    window.history.pushState({}, '', canonicalPath(nextRoute) + (preserveSuffix ? nextUrl.search + nextUrl.hash : ''));
    window.dispatchEvent(new Event('moodlelike:navigation'));
    setRoute(nextRoute);
  }

  function completeAuth(user: User, redirectTo?: string, isRegistration = false) {
    setCurrentUser(user);
    setIsResolvingAuth(false);
    if (isRegistration && user.role !== 'admin') {
      navigate(buildOnboardingUrl(redirectTo || routes.agent));
      return;
    }
    navigate(redirectTo || routes.agent);
  }

  const isAgent = route === 'agent';
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
      {(!isAgent || !currentUser) ? <div className="standalone-language-bar"><LanguageSelector compact /></div> : null}
      <main className={isAgent ? 'site-main site-main-agent' : 'site-main'}>
        <ErrorBanner message={error} />
        <Suspense fallback={<div className="page-loading" role="status" aria-live="polite">正在加载学习空间…</div>}>
          {route === 'agent' && (
            <AgentPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              host={agentHost}
            />
          )}
          {route === 'auth' && (
            <PublicAuthPage
              initialMode={currentPathname() === routes.register ? 'register' : 'login'}
              redirectTo={new URLSearchParams(window.location.search).get('redirect') ?? undefined}
              onBackHome={() => navigate(routes.agent)}
              onGoToMe={completeAuth}
            />
          )}
          {route === 'onboarding' && (
            <StudentOnboardingPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              returnTo={new URLSearchParams(window.location.search).get('returnTo') ?? routes.agent}
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
