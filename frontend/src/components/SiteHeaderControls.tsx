import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { logout } from '../lib/auth';
import { routes } from '../lib/routes';
import { Icon } from './Icon';
import { UserAvatar } from './UserAvatar';

type SiteHeaderControlsProps = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  onCurrentUserChange: (user: User | null) => void;
};

export function SiteHeaderControls({
  currentUser,
  isResolvingAuth,
  currentPath,
  onNavigate,
  onCurrentUserChange
}: SiteHeaderControlsProps) {
  const { locale, localeOption, locales, setLocale, t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languageOpen && !accountOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setLanguageOpen(false);
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen, languageOpen]);

  const goTo = (path: string) => {
    setAccountOpen(false);
    if (path.startsWith('/admin') || path.startsWith('/organization')) {
      window.location.assign(path);
      return;
    }
    onNavigate(path);
  };

  const menuItemClassName = (path: string) => [
    'site-account-menu-item',
    currentPath === path ? 'active' : ''
  ].filter(Boolean).join(' ');

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      onCurrentUserChange(null);
      setAccountOpen(false);
      onNavigate(routes.home);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="site-account-group" ref={controlsRef}>
      <div className="site-language-selector">
        <button
          type="button"
          className="site-language-button"
          aria-label={t('header.languageLabel', '选择语言')}
          aria-haspopup="menu"
          aria-expanded={languageOpen}
          onClick={() => {
            setLanguageOpen((value) => !value);
            setAccountOpen(false);
          }}
        >
          <span>{localeOption.shortCode}</span>
          <strong>{localeOption.nativeName}</strong>
          <Icon name="lucide:chevron-down" />
        </button>
        {languageOpen ? (
          <div className="site-language-menu" role="menu" aria-label={t('header.languageLabel', '选择语言')}>
            {locales.map((item) => (
              <button
                key={item.code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === item.code}
                disabled={!item.enabled}
                className={[locale === item.code ? 'active' : '', !item.enabled ? 'is-unavailable' : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  if (!item.enabled) return;
                  setLocale(item.code);
                  setLanguageOpen(false);
                }}
              >
                <span>{item.shortCode}</span>
                <strong>{item.nativeName}</strong>
                {!item.enabled ? <em>{t('common.disabledLocale', '即将开放')}</em> : null}
                {locale === item.code ? <Icon name="lucide:check" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!currentUser ? (
        <div className="site-auth-actions">
          <button
            type="button"
            className="site-login-button"
            disabled={isResolvingAuth}
            onClick={() => onNavigate(`${routes.auth}?redirect=${encodeURIComponent(routes.agent)}`)}
          >
            {isResolvingAuth ? t('common.confirming', '确认中') : t('common.login', '登录')}
          </button>
        </div>
      ) : (
        <div className="site-account-menu-wrap">
          <button
            type="button"
            className="site-avatar-button"
            aria-label={t('header.myAccount', '我的账号')}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => {
              setAccountOpen((value) => !value);
              setLanguageOpen(false);
            }}
          >
            <UserAvatar user={currentUser} size="sm" />
            <Icon name="lucide:chevron-down" />
          </button>
          {accountOpen ? (
            <div className="site-account-menu" role="menu">
              <div className="site-account-menu-head">
                <UserAvatar user={currentUser} size="sm" />
                <div>
                  <strong>{currentUser.displayName || (currentUser.role === 'admin' ? t('header.adminAccount', '管理员账号') : currentUser.email.split('@')[0])}</strong>
                  <small>{currentUser.email}</small>
                </div>
              </div>
              {currentUser.role === 'admin' ? (
                <>
                  <span className="site-account-menu-label">{t('header.admin', '后台')}</span>
                  <button type="button" role="menuitem" className={menuItemClassName(routes.adminAudit)} onClick={() => goTo(routes.adminAudit)}>
                    <Icon name="lucide:layout-dashboard" />
                    {t('header.adminDashboard', '后台管理')}
                  </button>
                  <button type="button" role="menuitem" className={menuItemClassName(routes.adminContent)} onClick={() => goTo(routes.adminContent)}>
                    <Icon name="lucide:file-pen-line" />
                    {t('header.contentAdmin', '内容管理')}
                  </button>
                  <button type="button" role="menuitem" className={menuItemClassName(routes.adminPastPapers)} onClick={() => goTo(routes.adminPastPapers)}>
                    <Icon name="lucide:file-up" />
                    {t('header.pastPapersAdmin', '真题资料')}
                  </button>
                  <button type="button" role="menuitem" className={menuItemClassName(routes.adminMockExams)} onClick={() => goTo(routes.adminMockExams)}>
                    <Icon name="lucide:clipboard-check" />
                    {t('header.mockExamAdmin', '模考题库')}
                  </button>
                  <span className="site-menu-separator" />
                </>
              ) : null}
              <span className="site-account-menu-label">{t('header.mine', '我的')}</span>
              <button type="button" role="menuitem" className={menuItemClassName(routes.me)} onClick={() => goTo(routes.me)}>
                <Icon name="lucide:user-round" />
                {t('header.myAccount', '我的账号')}
              </button>
              <span className="site-menu-separator" />
              <button type="button" role="menuitem" className="site-menu-danger" disabled={isLoggingOut} onClick={() => void handleLogout()}>
                <Icon name="lucide:log-out" />
                {t('header.logout', '退出登录')}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
