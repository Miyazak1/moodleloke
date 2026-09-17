import { type User } from '../lib/api';
import { useI18n } from '../i18n/useI18n';
import { InlineActions } from './UiPrimitives';

const ADMIN_AUTH_COPY = {
  zh: {
    identity: '当前身份',
    role: '角色',
    access: '后台访问',
    noPermission: '当前账号没有后台权限。',
    switchHint: '请切换管理员账号后继续。',
    switchAccount: '切换账号',
    loginTitle: '请先登录管理员账号。',
    loginHint: '登录后才能查看后台内容和操作。',
    login: '去登录'
  },
  en: {
    identity: 'Current Identity',
    role: 'Role',
    access: 'Admin Access',
    noPermission: 'This account does not have admin access.',
    switchHint: 'Switch to an admin account to continue.',
    switchAccount: 'Switch account',
    loginTitle: 'Log in with an admin account first.',
    loginHint: 'Admin content and actions are available after login.',
    login: 'Log in'
  }
} as const;

export function AdminAuthGate({
  currentUser,
  onGoToAuth
}: {
  currentUser?: User | null;
  onGoToAuth: () => void;
}) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? ADMIN_AUTH_COPY.en : ADMIN_AUTH_COPY.zh;

  if (currentUser?.role === 'admin') {
    return (
      <section className="admin-identity-notice">
        <p className="page-kicker">{copy.identity}</p>
        <strong>{currentUser.email}</strong>
        <span>{copy.role}: {currentUser.role}</span>
      </section>
    );
  }

  if (currentUser) {
    return (
      <section className="admin-identity-notice warning">
        <p className="page-kicker">{copy.access}</p>
        <strong>{copy.noPermission}</strong>
        <span>{currentUser.email} · {copy.switchHint}</span>
        <InlineActions>
          <button type="button" onClick={onGoToAuth}>{copy.switchAccount}</button>
        </InlineActions>
      </section>
    );
  }

  return (
    <section className="admin-identity-notice warning">
      <p className="page-kicker">{copy.access}</p>
      <strong>{copy.loginTitle}</strong>
      <span>{copy.loginHint}</span>
      <InlineActions>
        <button type="button" onClick={onGoToAuth}>{copy.login}</button>
      </InlineActions>
    </section>
  );
}
