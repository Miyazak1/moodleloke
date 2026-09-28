import { useEffect, useState } from 'react';
import { LanguageSelector } from './components/LanguageSelector';
import { buildAdminAuthRedirectUrl } from './lib/app-navigation';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminOperationsPage } from './pages/AdminOperationsPage';
import { AdminQuestionEnginePage } from './pages/AdminQuestionEnginePage';

function normalizeAdminPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/admin';
  return normalized === '/admin' ? routes.adminAudit : normalized;
}

export default function AdminApp() {
  const { currentUser, isResolvingAuth } = useAuthSession(true);
  const [path, setPath] = useState(() => normalizeAdminPath(window.location.pathname));

  useEffect(() => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      window.history.replaceState({}, '', routes.adminAudit);
      setPath(routes.adminAudit);
    }
    const sync = () => setPath(normalizeAdminPath(window.location.pathname));
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

  if (path !== routes.adminAudit && path !== routes.adminContent && path !== routes.adminAiOperations) {
    return (
      <main className="empty-state" role="alert">
        <h1>后台模块尚未迁入</h1>
        <p>当前仅开放已经完成权限与数据闭环验收的运营总览、内容管理和题目引擎状态模块。</p>
        <button type="button" onClick={() => navigateAdmin(routes.adminAudit)}>进入运营总览</button>
        <button type="button" onClick={() => leaveAdmin(routes.home)}>返回首页</button>
      </main>
    );
  }

  const authRedirect = buildAdminAuthRedirectUrl(path);

  return (
    <>
      <div className="standalone-language-bar"><LanguageSelector compact /></div>
      {path === routes.adminAudit ? (
        <AdminOperationsPage
          currentUser={currentUser}
          onGoToContent={() => navigateAdmin(routes.adminContent)}
          onGoToAuth={() => leaveAdmin(authRedirect)}
        />
      ) : path === routes.adminContent ? (
        <AdminContentPage
          currentUser={currentUser}
          onBackAudit={() => navigateAdmin(routes.adminAudit)}
          onBackHome={() => leaveAdmin(routes.home)}
          onGoToSchools={() => undefined}
          onGoToUsers={() => undefined}
          onGoToAuth={() => leaveAdmin(authRedirect)}
        />
      ) : (
        <AdminQuestionEnginePage
          currentUser={currentUser}
          onGoToAudit={() => navigateAdmin(routes.adminAudit)}
          onGoToContent={() => navigateAdmin(routes.adminContent)}
          onGoToAuth={() => leaveAdmin(authRedirect)}
        />
      )}
    </>
  );
}
