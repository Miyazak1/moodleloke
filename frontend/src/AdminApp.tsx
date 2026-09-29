import { lazy, Suspense, useEffect, useState } from 'react';
import { AppLoadingState } from './components/AppLoadingState';
import { SiteHeaderControls } from './components/SiteHeaderControls';
import { useI18n } from './i18n/useI18n';
import { buildAdminAuthRedirectUrl } from './lib/app-navigation';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminOperationsPage } from './pages/AdminOperationsPage';
import { AdminQuestionEnginePage } from './pages/AdminQuestionEnginePage';

const loadAdminAIQuestionBankPage = () => import('./pages/AdminAIQuestionBankPage');
const loadAdminTeachingAssetsPage = () => import('./pages/AdminTeachingAssetsPage');
const loadAdminMockExamPage = () => import('./pages/AdminMockExamPage');
const loadAdminPastPapersPage = () => import('./pages/AdminPastPapersPage');
const loadAdminSpecialPracticePage = () => import('./pages/AdminSpecialPracticePage');
const loadAdminOrganizationsPage = () => import('./pages/AdminOrganizationsPage');
const loadAdminUsersPage = () => import('./pages/AdminUsersPage');

const ADMIN_PAGE_PRELOADERS = [
  loadAdminAIQuestionBankPage,
  loadAdminTeachingAssetsPage,
  loadAdminMockExamPage,
  loadAdminPastPapersPage,
  loadAdminSpecialPracticePage,
  loadAdminOrganizationsPage,
  loadAdminUsersPage
];

const AdminAIQuestionBankPage = lazy(() => loadAdminAIQuestionBankPage().then((module) => ({ default: module.AdminAIQuestionBankPage })));
const AdminTeachingAssetsPage = lazy(() => loadAdminTeachingAssetsPage().then((module) => ({ default: module.AdminTeachingAssetsPage })));
const AdminMockExamPage = lazy(() => loadAdminMockExamPage().then((module) => ({ default: module.AdminMockExamPage })));
const AdminPastPapersPage = lazy(() => loadAdminPastPapersPage().then((module) => ({ default: module.AdminPastPapersPage })));
const AdminSpecialPracticePage = lazy(() => loadAdminSpecialPracticePage().then((module) => ({ default: module.AdminSpecialPracticePage })));
const AdminOrganizationsPage = lazy(() => loadAdminOrganizationsPage().then((module) => ({ default: module.AdminOrganizationsPage })));
const AdminUsersPage = lazy(() => loadAdminUsersPage().then((module) => ({ default: module.AdminUsersPage })));

function normalizeAdminPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/admin';
  if (normalized === '/admin') return routes.adminAudit;
  if (normalized === routes.adminMockExams) return routes.adminLearningMockExams;
  if (normalized === routes.adminPastPapers) return routes.adminLearningPastPapers;
  if (normalized === routes.adminSpecialPractice) return routes.adminLearningSpecialPractice;
  if (normalized === routes.adminOrganizations) return routes.adminAccountsOrganizations;
  if (normalized === routes.adminUsers) return routes.adminAccountsUsers;
  return normalized;
}

const ADMIN_PATHS = new Set<string>([
  routes.adminAudit,
  routes.adminContent,
  routes.adminTeachingAssets,
  routes.adminAiOperations,
  routes.adminAIQuestionBank,
  routes.adminLearningMockExams,
  routes.adminLearningPastPapers,
  routes.adminLearningSpecialPractice,
  routes.adminAccountsOrganizations,
  routes.adminAccountsUsers
]);

export default function AdminApp() {
  const { currentUser, setCurrentUser, isResolvingAuth } = useAuthSession(true);
  const { t } = useI18n();
  const [path, setPath] = useState(() => normalizeAdminPath(window.location.pathname));

  useEffect(() => {
    const sync = () => {
      const normalized = normalizeAdminPath(window.location.pathname);
      if (window.location.pathname !== normalized) window.history.replaceState({}, '', normalized);
      setPath(normalized);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (isResolvingAuth || currentUser?.role !== 'admin') return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const preload = () => {
      void Promise.allSettled(ADMIN_PAGE_PRELOADERS.map((loadPage) => loadPage()));
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 1800 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(preload, 300);
    return () => window.clearTimeout(handle);
  }, [currentUser?.role, isResolvingAuth]);

  function leaveAdmin(target: string) {
    window.location.assign(target);
  }

  function navigateAdmin(target: string) {
    const normalized = normalizeAdminPath(target);
    window.history.pushState({}, '', normalized);
    setPath(normalized);
  }

  if (isResolvingAuth) {
    return <AppLoadingState variant="auth" />;
  }

  const authRedirect = buildAdminAuthRedirectUrl(path);
  const goAudit = () => navigateAdmin(routes.adminAudit);
  const goContent = () => navigateAdmin(routes.adminContent);
  const goMockExams = () => navigateAdmin(routes.adminLearningMockExams);
  const goSpecialPractice = () => navigateAdmin(routes.adminLearningSpecialPractice);
  const goUsers = () => navigateAdmin(routes.adminAccountsUsers);
  const goAiOperations = () => navigateAdmin(routes.adminAiOperations);
  const unavailableLegacySection = () => navigateAdmin(routes.adminContent);

  const page = !ADMIN_PATHS.has(path) ? (
    <section className="empty-state" role="alert">
      <h1>后台页面不存在</h1>
      <p>请通过左侧管理导航进入已经接入的工作区。</p>
      <button type="button" onClick={goAudit}>进入运营总览</button>
      <button type="button" onClick={() => leaveAdmin(routes.home)}>返回首页</button>
    </section>
  ) : path === routes.adminAudit ? (
    <AdminOperationsPage currentUser={currentUser} onGoToContent={goContent} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminContent ? (
    <AdminContentPage
      currentUser={currentUser}
      onBackAudit={goAudit}
      onBackHome={() => leaveAdmin(routes.home)}
      onGoToSchools={unavailableLegacySection}
      onGoToMockExams={goMockExams}
      onGoToSpecialPractice={goSpecialPractice}
      onGoToUsers={goUsers}
      onGoToAuth={() => leaveAdmin(authRedirect)}
    />
  ) : path === routes.adminTeachingAssets ? (
    <AdminTeachingAssetsPage currentUser={currentUser} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminAiOperations ? (
    <AdminQuestionEnginePage currentUser={currentUser} onGoToAudit={goAudit} onGoToContent={goContent} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminAIQuestionBank ? (
    <AdminAIQuestionBankPage currentUser={currentUser} onBackAudit={goAudit} onGoToAiOperations={goAiOperations} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminLearningMockExams ? (
    <AdminMockExamPage currentUser={currentUser} onBackAudit={goAudit} onGoToContent={goContent} onGoToSchools={unavailableLegacySection} onGoToSpecialPractice={goSpecialPractice} onGoToUsers={goUsers} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminLearningPastPapers ? (
    <AdminPastPapersPage currentUser={currentUser} onBackAudit={goAudit} onGoToContent={goContent} onGoToSchools={unavailableLegacySection} onGoToScholarships={unavailableLegacySection} onGoToMockExams={goMockExams} onGoToSpecialPractice={goSpecialPractice} onGoToUsers={goUsers} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminLearningSpecialPractice ? (
    <AdminSpecialPracticePage currentUser={currentUser} onBackAudit={goAudit} onGoToContent={goContent} onGoToSchools={unavailableLegacySection} onGoToMockExams={goMockExams} onGoToUsers={goUsers} onGoToAuth={() => leaveAdmin(authRedirect)} />
  ) : path === routes.adminAccountsOrganizations ? (
    <AdminOrganizationsPage currentUser={currentUser} onGoToAuth={() => leaveAdmin(authRedirect)} onBackAudit={goAudit} onGoToUsers={goUsers} />
  ) : (
    <AdminUsersPage currentUser={currentUser} onBackAudit={goAudit} onGoToContent={goContent} onGoToSchools={unavailableLegacySection} onGoToMockExams={goMockExams} onGoToSpecialPractice={goSpecialPractice} onGoToAuth={() => leaveAdmin(authRedirect)} />
  );

  return (
    <div className="site-shell site-shell-admin">
      <header className="site-header site-header-home admin-site-header">
        <div className="site-header-inner">
          <button type="button" className="site-brand" onClick={() => leaveAdmin(routes.home)}>
            <img className="site-brand-logo" src="/logo-candidate-v2-csca.png" alt={t('homeNav.brand', 'CSCA 学习 Agent')} />
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => leaveAdmin(routes.home)}>{t('nav.home', '首页')}</button>
            <button type="button" className="site-link" onClick={() => leaveAdmin(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" className="site-link" onClick={() => leaveAdmin(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
          </nav>
          <SiteHeaderControls currentUser={currentUser} isResolvingAuth={isResolvingAuth} currentPath={path} onNavigate={leaveAdmin} onAdminNavigate={navigateAdmin} onCurrentUserChange={setCurrentUser} />
        </div>
      </header>
      <main className="site-main site-main-public site-main-admin">
        <Suspense fallback={<AppLoadingState variant="admin" />}>
          {page}
        </Suspense>
      </main>
    </div>
  );
}
