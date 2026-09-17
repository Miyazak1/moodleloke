import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { useAuthSession } from './lib/use-auth-session';
import type { User } from './lib/api';

const AdminAIQuestionBankPage = lazy(() => import('./pages/AdminAIQuestionBankPage').then((module) => ({ default: module.AdminAIQuestionBankPage })));
const AdminTeachingAssetsPage = lazy(() => import('./pages/AdminTeachingAssetsPage').then((module) => ({ default: module.AdminTeachingAssetsPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));

type Workspace = 'questions' | 'teaching-assets';
function readWorkspace(): Workspace {
  return new URLSearchParams(window.location.search).get('workspace') === 'teaching-assets' ? 'teaching-assets' : 'questions';
}

export default function AuthoringApp() {
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const [workspace, setWorkspace] = useState<Workspace>(() => readWorkspace());
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const sync = () => setWorkspace(readWorkspace());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function completeAuth(user: User) {
    setCurrentUser(user);
    setIsResolvingAuth(false);
    setShowAuth(false);
  }

  if (isResolvingAuth) return <main className="authoring-access"><span className="authoring-spinner" /><p>正在验证内容生产权限…</p></main>;
  if (showAuth || !currentUser) return <Suspense fallback={<main className="authoring-access">Loading…</main>}><PublicAuthPage initialMode="login" redirectTo="/authoring.html" onBackHome={() => { window.location.href = '/'; }} onGoToMe={completeAuth} /></Suspense>;
  if (currentUser.role !== 'admin') return <main className="authoring-access"><Icon name="lucide:shield-alert" /><h1>当前账号没有内容生产权限</h1><p>{currentUser.email}</p><div><button type="button" onClick={() => setShowAuth(true)}>切换管理员账号</button><a href="/">返回学生 Agent</a></div></main>;

  return <Suspense fallback={<main className="authoring-access">正在加载内容生产工作区…</main>}>
    {workspace === 'teaching-assets'
      ? <AdminTeachingAssetsPage currentUser={currentUser} onGoToAuth={() => setShowAuth(true)} />
      : <AdminAIQuestionBankPage currentUser={currentUser} onGoToAuth={() => setShowAuth(true)} />}
  </Suspense>;
}
