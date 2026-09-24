import { routes, type PublicRoute } from './routes';

const adminRouteAliases: Partial<Record<string, PublicRoute>> = {
  [routes.adminLearningMockExams]: routes.adminMockExams,
  [routes.adminLearningPastPapers]: routes.adminPastPapers,
  [routes.adminLearningSpecialPractice]: routes.adminSpecialPractice,
  [routes.adminAccountsOrganizations]: routes.adminOrganizations,
  [routes.adminAccountsUsers]: routes.adminUsers
};

const adminCanonicalRoutes = new Set<PublicRoute>([
  routes.adminAudit,
  routes.adminAiOperations,
  routes.adminAIQuestionBank,
  routes.adminContent,
  routes.adminMockExams,
  routes.adminPastPapers,
  routes.adminSpecialPractice,
  routes.adminOrganizations,
  routes.adminUsers
]);

export function currentPath(): PublicRoute {
  const pathname = (window.location.pathname.replace(/\/+$/, '') || routes.home) as PublicRoute;
  if (pathname === routes.login || pathname === routes.register) {
    return routes.auth;
  }
  if (pathname === routes.adminAuditLogs) {
    return routes.adminAudit;
  }
  if (pathname === '/organizations/invite') {
    return routes.organizationInvite;
  }
  if (pathname === '/admin') {
    return routes.adminAudit;
  }
  if (pathname.startsWith('/admin/')) {
    if (adminRouteAliases[pathname]) {
      return adminRouteAliases[pathname]!;
    }
    if (adminCanonicalRoutes.has(pathname)) {
      return pathname;
    }
    return '/feature-coming-soon';
  }
  return pathname || routes.home;
}

export function isSchoolDetailRoute(_route: string) {
  return false;
}

export function isMockExamRoute(route: string) {
  return route === routes.cscaMockExam || route.startsWith(`${routes.cscaMockExam}/`);
}

export function isPastPaperRoute(route: string) {
  return route === routes.pastPapers || route.startsWith(`${routes.pastPapers}/`);
}

export function isCscaSubjectRoute(route: string) {
  return route === routes.cscaSubjects || route.startsWith(`${routes.cscaSubjects}/`);
}

export function isStudyChinaRoute(_route: string) {
  return false;
}

export function isMockExamTakingRoute(route: string) {
  return /^\/csca-mock-exam\/attempts\/\d+$/.test(route);
}

export function isKnownRoute(route: PublicRoute) {
  return (
    route === routes.home ||
    route === routes.cscaPrep ||
    route === routes.cscaExamTime ||
    isCscaSubjectRoute(route) ||
    isMockExamRoute(route) ||
    isPastPaperRoute(route) ||
    route === routes.consulting ||
    route === routes.aiCoachService ||
    route === routes.agent ||
    route === routes.adminAudit ||
    route === routes.adminAiOperations ||
    route === routes.adminAIQuestionBank ||
    route === routes.adminContent ||
    route === routes.adminMockExams ||
    route === routes.adminPastPapers ||
    route === routes.adminSpecialPractice ||
    route === routes.adminOrganizations ||
    route === routes.adminUsers ||
    Boolean(adminRouteAliases[route]) ||
    route === routes.organization ||
    route === routes.organizationInvite ||
    route === routes.auth ||
    route === routes.onboarding ||
    route === routes.me ||
    route === '/feature-coming-soon' ||
    route === '/404'
  );
}

export function isPublicBrandRoute(route: PublicRoute) {
  return (
    route === routes.cscaPrep ||
    route === routes.cscaExamTime ||
    isCscaSubjectRoute(route) ||
    isMockExamRoute(route) ||
    isPastPaperRoute(route) ||
    route === routes.consulting ||
    route === routes.aiCoachService ||
    route === routes.agent ||
    route === routes.auth ||
    route === routes.onboarding ||
    route === routes.me ||
    route === routes.adminAudit ||
    route === routes.adminAiOperations ||
    route === routes.adminAIQuestionBank ||
    route === routes.adminContent ||
    route === routes.adminMockExams ||
    route === routes.adminPastPapers ||
    route === routes.adminSpecialPractice ||
    route === routes.adminOrganizations ||
    route === routes.adminUsers ||
    Boolean(adminRouteAliases[route])
    || route === routes.organization
    || route === routes.organizationInvite
  );
}

export function buildAuthRedirectUrl(redirectTo: string) {
  return `${routes.auth}?redirect=${encodeURIComponent(redirectTo)}`;
}

export function safeReturnPath(value: string | null | undefined, fallback = routes.me) {
  const next = String(value ?? '').trim();
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next.startsWith(routes.onboarding) ? fallback : next.slice(0, 300);
}

export function buildOnboardingUrl(returnTo?: string) {
  const safeReturnTo = safeReturnPath(returnTo, routes.me);
  return `${routes.onboarding}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
