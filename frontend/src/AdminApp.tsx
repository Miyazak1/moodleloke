import { lazy, Suspense, useEffect, useState } from 'react';
import { SiteHeaderControls } from './components/SiteHeaderControls';
import { useI18n } from './i18n/useI18n';
import { buildAdminAuthRedirectUrl } from './lib/app-navigation';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminOperationsPage } from './pages/AdminOperationsPage';
import { AdminQuestionEnginePage } from './pages/AdminQuestionEnginePage';

const AdminAIQuestionBankPage = lazy(() => import('./pages/AdminAIQuestionBankPage').then((module) => ({ default: module.AdminAIQuestionBankPage })));
const AdminTeachingAssetsPage = lazy(() => import('./pages/AdminTeachingAssetsPage').then((module) => ({ default: module.AdminTeachingAssetsPage })));
const AdminMockExamPage = lazy(() => import('./pages/AdminMockExamPage').then((module) => ({ default: module.AdminMockExamPage })));
const AdminPastPapersPage = lazy(() => import('./pages/AdminPastPapersPage').then((module) => ({ default: module.AdminPastPapersPage })));
const AdminSpecialPracticePage = lazy(() => import('./pages/AdminSpecialPracticePage').then((module) => ({ default: module.AdminSpecialPracticePage })));
const AdminOrganizationsPage = lazy(() => import('./pages/AdminOrganizationsPage').then((module) => ({ default: module.AdminOrganizationsPage })));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));

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

  function leaveAdmin(target: string) {
    window.location.assign(target);
  }

  function navigateAdmin(target: string) {
    window.history.pushState({}, '', target);
    setPath(normalizeAdminPath(target));
  }

  if (isResolvingAuth) {
    return <div className="page-loading" role="status" aria-live="polite">正在验证管理员身份…</div>;
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
            <span className="site-brand-mark" aria-hidden="true">CS</span>
            <span><strong>{t('homeNav.brand', 'CSCA 学习 Agent')}</strong></span>
          </button>
          <nav className="site-nav" aria-label={t('nav.aria', '主导航')}>
            <button type="button" className="site-link" onClick={() => leaveAdmin(routes.home)}>{t('nav.home', '首页')}</button>
            <button type="button" className="site-link" onClick={() => leaveAdmin(routes.agent)}>{t('homeNav.practice', '做题训练')}</button>
            <button type="button" className="site-link" onClick={() => leaveAdmin(`${routes.agent}?agentSection=weakness`)}>{t('homeNav.review', '错题复盘')}</button>
          </nav>
          <SiteHeaderControls currentUser={currentUser} isResolvingAuth={isResolvingAuth} currentPath={path} onNavigate={leaveAdmin} onCurrentUserChange={setCurrentUser} />
        </div>
      </header>
      <main className="site-main site-main-public site-main-admin">
        <Suspense fallback={<div className="page-loading" role="status">正在加载管理工作区…</div>}>
          {page}
        </Suspense>
      </main>
    </div>
  );
}
