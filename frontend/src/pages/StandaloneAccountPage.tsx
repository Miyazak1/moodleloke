import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/UserAvatar';
import { useI18n } from '../i18n/useI18n';
import type { MyAICredits, User } from '../lib/api-types';
import { acceptOrganizationInvite, acceptOrganizationInviteCode, getMyAICredits } from '../lib/api-me';
import { getMe, logout, resendEmailVerification, updateMeProfile } from '../lib/auth';
import { routes } from '../lib/routes';
import '../styles/standalone-account.css';

type Props = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

function inviteValue(value: string) {
  const text = value.trim();
  if (!text) return '';
  try {
    const url = new URL(text, window.location.origin);
    return url.searchParams.get('token')?.trim() || text;
  } catch {
    return text;
  }
}

function isShortCode(value: string) {
  return /^[2-9A-HJ-NP-Z]{8,12}$/.test(value.replace(/[\s-]+/g, '').toUpperCase());
}

export function StandaloneAccountPage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: Props) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [credits, setCredits] = useState<MyAICredits | null>(null);
  const [invite, setInvite] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setDisplayName(currentUser?.displayName || ''), [currentUser?.displayName]);

  useEffect(() => {
    if (isResolvingAuth || !currentUser || !currentUser.emailVerifiedAt) {
      setCredits(null);
      return;
    }
    let current = true;
    void getMyAICredits().then((value) => {
      if (current) setCredits(value);
    }).catch(() => {
      if (current) setCredits(null);
    });
    return () => { current = false; };
  }, [currentUser?.emailVerifiedAt, currentUser?.id, isResolvingAuth]);

  if (isResolvingAuth) return <div className="standalone-account-state" role="status">{t('me.common.loading', '正在读取账号…')}</div>;
  if (!currentUser) {
    return <div className="standalone-account-state"><h1>{t('me.auth.title', '登录后管理个人设置')}</h1><button type="button" onClick={() => onNavigate(routes.auth)}>{t('agent.auth.action', '登录并进入')}</button></div>;
  }

  const organizationName = credits?.organization?.name || credits?.organizationOptions?.find((item) => item.current)?.name || t('me.settings.noOrganization', '未加入机构');
  const creditLabel = !currentUser.emailVerifiedAt
    ? t('me.credit.verifyToLoad', '验证邮箱后读取')
    : credits
      ? (credits.unlimited ? t('me.credit.unlimited', '不限') : String(credits.balanceUnits ?? 0))
      : t('me.common.notLoaded', '暂未读取');

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

  async function joinOrganization(event: FormEvent) {
    event.preventDefault();
    const token = inviteValue(invite);
    if (!token) {
      setStatus(t('me.status.inviteRequired', '请输入机构邀请码、邀请链接或 token。'));
      return;
    }
    setPending('organization');
    try {
      const result = isShortCode(token) ? await acceptOrganizationInviteCode(token) : await acceptOrganizationInvite(token);
      setInvite('');
      setStatus(t('me.status.joinedOrganization', '已加入 {name}。').replace('{name}', result.organization.name));
      setCredits(await getMyAICredits());
    } catch {
      setStatus(t('me.status.inviteFailed', '机构邀请码暂时无法使用。'));
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
        <div><p>{t('agent.account.kicker', '个人设置')}</p><h1>{t('agent.account.title', '账号与机构')}</h1><span>{t('agent.account.body', '这里只管理你的身份、登录和机构关系；学习目标与学习方式在 Agent 的学习设置中管理。')}</span></div>
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

        <section className="standalone-account-card organization">
          <header><Icon name="lucide:building-2" color="currentColor" /><div><h2>{t('me.settings.organizationTitle', '机构与 AI 额度')}</h2><p>{organizationName}</p></div><strong className="credit">{creditLabel}</strong></header>
          <form onSubmit={(event) => void joinOrganization(event)}><input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder={t('me.settings.invitePlaceholder', '粘贴邀请链接、token 或短邀请码')} /><button type="submit" disabled={pending === 'organization'}>{pending === 'organization' ? t('me.common.joining', '加入中…') : t('me.actions.joinOrganization', '加入机构')}</button></form>
        </section>

        <section className="standalone-account-card boundary">
          <Icon name="lucide:sliders-horizontal" color="currentColor" /><div><h2>{t('agent.account.learningSettings', '学习设置留在 Agent')}</h2><p>{t('agent.account.learningSettingsBody', '学习模式、目标、科目、语言和时间容量会改变 Agent 决策，因此统一在学习工作区维护。')}</p><button type="button" className="secondary" onClick={() => onNavigate(routes.agent)}>{t('agent.account.openLearningSettings', '返回 Agent 设置')}</button></div>
        </section>
      </div>

      <footer className="standalone-account-footer"><button type="button" className="danger" disabled={pending === 'logout'} onClick={() => void signOut()}>{t('header.logout', '退出登录')}</button></footer>
    </div>
  );
}
