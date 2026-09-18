import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBanner } from './components/ErrorBanner';
import { useI18n } from './i18n/useI18n';
import type { User } from './lib/api';
import { buildAuthRedirectUrl, buildOnboardingUrl } from './lib/app-navigation';
import { buildLocalizedPath, parseLocalizedPath, stripLocaleFromPath } from './lib/locale-routing';
import { EMAIL_UNVERIFIED_EVENT } from './lib/request';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';

const AgentPage = lazy(() => import('./pages/AgentPage').then((module) => ({ default: module.AgentPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));
const StandaloneAccountPage = lazy(() => import('./pages/StandaloneAccountPage').then((module) => ({ default: module.StandaloneAccountPage })));
const StudentOnboardingPage = lazy(() => import('./pages/StudentOnboardingPage').then((module) => ({ default: module.StudentOnboardingPage })));

type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me';

function readStandaloneRoute(): StandaloneRoute {
  const route = parseLocalizedPath(window.location.pathname).route;
  if (route === routes.auth || route === routes.login || route === routes.register) return 'auth';
  if (route === routes.onboarding) return 'onboarding';
  if (route === routes.me) return 'me';
  return 'agent';
}

function canonicalPath(route: StandaloneRoute) {
  if (route === 'auth') return routes.auth;
  if (route === 'onboarding') return routes.onboarding;
  if (route === 'me') return routes.me;
  return routes.agent;
}

export default function StandaloneAgentApp() {
  const { locale, setLocale } = useI18n();
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const [route, setRoute] = useState<StandaloneRoute>(() => readStandaloneRoute());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentLocale = parseLocalizedPath(window.location.pathname).locale;
    if (currentLocale && currentLocale !== locale) setLocale(currentLocale);
    const currentRoute = readStandaloneRoute();
    const internalPath = stripLocaleFromPath(window.location.pathname);
    if (currentRoute === 'agent' && internalPath !== routes.agent) {
      window.history.replaceState(window.history.state, '', buildLocalizedPath(currentLocale || locale, routes.agent));
    }
    setRoute(currentRoute);
  }, [locale, setLocale]);

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
    const internalPath = stripLocaleFromPath(nextUrl.pathname);
    let nextRoute: StandaloneRoute = 'agent';
    if (internalPath === routes.auth || internalPath === routes.login || internalPath === routes.register) nextRoute = 'auth';
    else if (internalPath === routes.onboarding) nextRoute = 'onboarding';
    else if (internalPath === routes.me) nextRoute = 'me';
    const localizedPath = buildLocalizedPath(locale, canonicalPath(nextRoute));
    window.history.pushState({}, '', localizedPath + nextUrl.search + nextUrl.hash);
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
  return (
    <div className={isAgent ? 'site-shell site-shell-agent' : 'site-shell'}>
      <main className={isAgent ? 'site-main site-main-agent' : 'site-main'}>
        <ErrorBanner message={error} />
        <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
          {route === 'agent' && (
            <AgentPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onNavigate={navigate}
              onAuthRedirect={(returnTo) => navigate(buildAuthRedirectUrl(returnTo))}
            />
          )}
          {route === 'auth' && (
            <PublicAuthPage
              initialMode={parseLocalizedPath(window.location.pathname).route === routes.register ? 'register' : 'login'}
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
        </Suspense>
      </main>
    </div>
  );
}
