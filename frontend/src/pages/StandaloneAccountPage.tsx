import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/UserAvatar';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api-types';
import { getMe, logout, resendEmailVerification, updateMeProfile } from '../lib/auth';
import { routes } from '../lib/routes';
import '../styles/standalone-account.css';

type Props = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

export function StandaloneAccountPage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: Props) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setDisplayName(currentUser?.displayName || ''), [currentUser?.displayName]);

  if (isResolvingAuth) return <div className="standalone-account-state" role="status">{t('me.common.loading', '正在读取账号…')}</div>;
  if (!currentUser) {
    return <div className="standalone-account-state"><h1>{t('me.auth.title', '登录后管理个人设置')}</h1><button type="button" onClick={() => onNavigate(routes.auth)}>{t('agent.auth.action', '登录并进入')}</button></div>;
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || name.length > 40) {
      setStatus(t('me.status.displayNameInvalid', '显示名需要 1-40 个字符。'));
      return;
    }
    setPending('profile');
    try {
      await updateMeProfile({ displayName: name });
      const user = await getMe();
      onCurrentUserChange(user);
      setStatus(t('me.status.displayNameUpdated', '显示名已更新。'));
    } catch {
      setStatus(t('me.status.displayNameSaveFailed', '显示名暂时无法保存。'));
    } finally {
      setPending(null);
    }
  }

  async function resendVerification() {
    setPending('verification');
    try {
      const result = await resendEmailVerification();
      setStatus(result.alreadyVerified ? t('me.status.emailAlreadyVerified', '邮箱已经完成验证。') : t('me.status.verificationSent', '验证邮件已发送，请检查收件箱。'));
    } catch {
      setStatus(t('me.status.verificationSendFailed', '验证邮件暂时无法发送。'));
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    setPending('logout');
    await logout();
    onCurrentUserChange(null);
    onNavigate(routes.agent);
  }

  return (
    <div className="standalone-account-page">
      <header className="standalone-account-header">
        <button type="button" className="back" onClick={() => onNavigate(routes.agent)}><Icon name="lucide:arrow-left" color="currentColor" />{t('agent.account.back', '返回学习 Agent')}</button>
        <div><p>{t('agent.account.kicker', '个人设置')}</p><h1>{t('agent.account.title', '账号设置')}</h1><span>{t('agent.account.body', '这里只管理你的身份与登录安全；学习目标与学习方式在 Agent 的学习设置中管理。')}</span></div>
      </header>

      {status && <div className="standalone-account-status" role="status">{status}</div>}

      <div className="standalone-account-grid">
        <section className="standalone-account-card profile">
          <div className="identity"><UserAvatar user={currentUser} /><div><strong>{currentUser.displayName || currentUser.email}</strong><span>{currentUser.email}</span></div></div>
          <form onSubmit={(event) => void saveProfile(event)}>
            <label><span>{t('me.settings.displayName', '显示名')}</span><input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <button type="submit" disabled={pending === 'profile'}>{pending === 'profile' ? t('me.common.saving', '保存中…') : t('me.actions.saveAccount', '保存账号资料')}</button>
          </form>
        </section>

        <section className="standalone-account-card">
          <header><Icon name={currentUser.emailVerifiedAt ? 'lucide:badge-check' : 'lucide:mail-warning'} color="currentColor" /><div><h2>{t('agent.account.security', '登录与验证')}</h2><p>{currentUser.emailVerifiedAt ? t('me.profile.emailVerified', '邮箱已验证') : t('me.profile.emailUnverified', '邮箱未验证')}</p></div></header>
          <div className="actions">{!currentUser.emailVerifiedAt && <button type="button" onClick={() => void resendVerification()} disabled={pending === 'verification'}>{t('me.actions.resendVerification', '重新发送验证邮件')}</button>}<button type="button" className="secondary" onClick={() => onNavigate(routes.auth + '?mode=forgot')}>{t('auth.forgotPassword', '重置密码')}</button></div>
        </section>

        <section className="standalone-account-card boundary">
          <Icon name="lucide:sliders-horizontal" color="currentColor" /><div><h2>{t('agent.account.learningSettings', '学习设置留在 Agent')}</h2><p>{t('agent.account.learningSettingsBody', '学习模式、目标、科目、语言和时间容量会改变 Agent 决策，因此统一在学习工作区维护。')}</p><button type="button" className="secondary" onClick={() => onNavigate(`${routes.agent}?agentSection=settings`)}>{t('agent.account.openLearningSettings', '返回 Agent 设置')}</button></div>
        </section>
      </div>

      <footer className="standalone-account-footer"><button type="button" className="danger" disabled={pending === 'logout'} onClick={() => void signOut()}>{t('header.logout', '退出登录')}</button></footer>
    </div>
  );
}
