import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import type { Locale } from '../../i18n/locales';
import { buildLocalizedPath } from '../../lib/locale-routing';
import { routes } from '../../lib/routes';
import type { User } from '../../lib/api';

export type AdminSectionKey =
  | 'audit'
  | 'aiOperations'
  | 'aiQuestionBank'
  | 'content'
  | 'teachingAssets'
  | 'mockExams'
  | 'pastPapers'
  | 'specialPractice'
  | 'organizations'
  | 'users';

type AdminConsoleShellProps = {
  current: AdminSectionKey;
  currentUser?: User | null;
  mode?: 'admin' | 'organization';
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  children: ReactNode;
  className?: string;
  heroClassName?: string;
  heroAside?: ReactNode;
  onGoToAudit?: () => void;
  onGoToAiOperations?: () => void;
  onGoToContent?: () => void;
  onGoToCityGuides?: () => void;
  onGoToTimelineWindows?: () => void;
  onGoToSchools?: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams?: () => void;
  onGoToPastPapers?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToOrganizations?: () => void;
  onGoToUsers?: () => void;
};

const ADMIN_CONSOLE_COPY = {
  zh: {
    product: '管理员后台',
    subtitle: 'Moodlelike Console',
    navLabel: '后台工作区导航',
    workspace: '工作区',
    account: '当前账号',
    signedOut: '未登录',
    role: '角色',
    status: '状态',
    adminReady: '管理员',
    noAdmin: '无后台权限',
    overviewGroup: '后台总览',
    aiGroup: 'AI 实验室',
    aiBadge: '隔离中',
    contentGroup: '内容配置',
    learningGroup: '固定题库',
    accountsGroup: '账号与机构',
    audit: '运营总览',
    aiOperations: 'AI 运维',
    aiQuestionBank: 'AI 题库',
    content: '内容管理',
    teachingAssets: '教学资产',
    mockExams: '模考题库',
    pastPapers: '真题资料',
    specialPractice: '专项题库',
    organizations: '机构团队',
    users: '用户列表'
  },
  en: {
    product: 'Admin Console',
    subtitle: 'Moodlelike Console',
    navLabel: 'Admin workspace navigation',
    workspace: 'Workspace',
    account: 'Current account',
    signedOut: 'Signed out',
    role: 'Role',
    status: 'Status',
    adminReady: 'Admin',
    noAdmin: 'No admin access',
    overviewGroup: 'Admin Overview',
    aiGroup: 'AI Lab',
    aiBadge: 'Isolated',
    contentGroup: 'Content Config',
    learningGroup: 'Fixed Question Banks',
    accountsGroup: 'Accounts & Organizations',
    audit: 'Operations Overview',
    aiOperations: 'AI Operations',
    aiQuestionBank: 'AI Question Bank',
    content: 'Content',
    teachingAssets: 'Teaching Assets',
    mockExams: 'Mock Exams',
    pastPapers: 'Past Papers',
    specialPractice: 'Special Practice',
    organizations: 'Organizations',
    users: 'Users'
  }
} as const;

function navigateTo(path: string, locale: Locale) {
  const target = buildLocalizedPath(locale, path);
  if (window.location.pathname === target) return;
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AdminConsoleShell({
  current,
  currentUser,
  mode = 'admin',
  kicker,
  title,
  body,
  children,
  className = '',
  heroClassName = '',
  heroAside,
  onGoToAudit,
  onGoToAiOperations,
  onGoToContent,
  onGoToMockExams,
  onGoToPastPapers,
  onGoToSpecialPractice,
  onGoToOrganizations,
  onGoToUsers
}: AdminConsoleShellProps) {
  const { locale, t } = useI18n();
  const copy = locale === 'en' ? ADMIN_CONSOLE_COPY.en : ADMIN_CONSOLE_COPY.zh;
  const rootClassName = ['admin-console-shell c-admin-shell page-stack brand-page brand-work-page admin-work-page', className].filter(Boolean).join(' ');
  const sectionClassName = ['admin-work-toolbar admin-console-workspace-header c-admin-shell__hero', heroClassName].filter(Boolean).join(' ');
  const isOrganizationMode = mode === 'organization';
  const isStandaloneAuthoring = window.location.pathname.endsWith('/authoring.html');
  const orgShellText = (key: string, fallback: string) => t(`organizationConsole.${key}`, fallback);
  const accountLabel = currentUser?.email ?? copy.signedOut;
  const accessLabel = isOrganizationMode ? (currentUser ? orgShellText('loginAccount', '登录账号') : copy.signedOut) : currentUser?.role === 'admin' ? copy.adminReady : copy.noAdmin;
  const productLabel = isStandaloneAuthoring ? 'Moodlelike Authoring' : isOrganizationMode ? orgShellText('product', '机构控制台') : copy.product;
  const subtitleLabel = isStandaloneAuthoring ? 'Question & Teaching Studio' : isOrganizationMode ? orgShellText('subtitle', 'Organization Console') : copy.subtitle;
  const navLabel = isOrganizationMode ? orgShellText('navLabel', '机构工作区导航') : copy.navLabel;
  const workspaceLabel = isOrganizationMode ? orgShellText('workspaceLabel', '工作区') : copy.workspace;
  const accountTopbarLabel = isOrganizationMode ? orgShellText('loginAccount', '登录账号') : copy.account;
  const statusLabel = isOrganizationMode ? orgShellText('status', '状态') : copy.status;

  const adminGroups = [
    {
      label: copy.overviewGroup,
      items: [
        { key: 'audit', label: copy.audit, onClick: onGoToAudit ?? (() => navigateTo(routes.adminAudit, locale)) }
      ]
    },
    {
      label: copy.learningGroup,
      items: [
        { key: 'mockExams', label: copy.mockExams, onClick: onGoToMockExams ?? (() => navigateTo(routes.adminLearningMockExams, locale)) },
        { key: 'pastPapers', label: copy.pastPapers, onClick: onGoToPastPapers ?? (() => navigateTo(routes.adminLearningPastPapers, locale)) },
        { key: 'specialPractice', label: copy.specialPractice, onClick: onGoToSpecialPractice ?? (() => navigateTo(routes.adminLearningSpecialPractice, locale)) }
      ]
    },
    {
      label: copy.contentGroup,
      items: [
        { key: 'content', label: copy.content, onClick: onGoToContent ?? (() => navigateTo(routes.adminContent, locale)) },
        { key: 'teachingAssets', label: copy.teachingAssets, onClick: () => navigateTo(routes.adminTeachingAssets, locale) }
      ]
    },
    {
      label: copy.accountsGroup,
      items: [
        { key: 'organizations', label: copy.organizations, onClick: onGoToOrganizations ?? (() => navigateTo(routes.adminAccountsOrganizations, locale)) },
        { key: 'users', label: copy.users, onClick: onGoToUsers ?? (() => navigateTo(routes.adminAccountsUsers, locale)) }
      ]
    },
    {
      label: copy.aiGroup,
      badge: copy.aiBadge,
      items: [
        { key: 'aiOperations', label: copy.aiOperations, onClick: onGoToAiOperations ?? (() => navigateTo(routes.adminAiOperations, locale)) },
        { key: 'aiQuestionBank', label: copy.aiQuestionBank, onClick: () => navigateTo(routes.adminAIQuestionBank, locale) }
      ]
    }
  ] as Array<{ label: string; badge?: string; items: Array<{ key: AdminSectionKey; label: string; onClick: () => void }> }>;
  const organizationGroups = [
    {
      label: orgShellText('workspaceGroup', '机构工作区'),
      items: [
        { key: 'organizations' as const, label: orgShellText('teamNav', '机构团队'), onClick: onGoToOrganizations ?? (() => navigateTo(routes.organization, locale)) }
      ]
    }
  ] as Array<{ label: string; items: Array<{ key: AdminSectionKey; label: string; onClick: () => void }> }>;
  const openAuthoringWorkspace = (workspace: 'questions' | 'teaching-assets') => {
    const url = new URL(window.location.href);
    url.pathname = '/authoring.html';
    url.searchParams.set('workspace', workspace);
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const authoringGroups = [{
    label: '内容生产',
    items: [
      { key: 'aiQuestionBank' as const, label: '题目生产与审核', onClick: () => openAuthoringWorkspace('questions') },
      { key: 'teachingAssets' as const, label: '教学资产管理', onClick: () => openAuthoringWorkspace('teaching-assets') }
    ]
  }];
  const groups = isStandaloneAuthoring ? authoringGroups : isOrganizationMode ? organizationGroups : adminGroups;

  const currentGroup = groups.find((group) => group.items.some((item) => item.key === current));

  return (
    <div className={rootClassName}>
      <aside className="admin-console-sidebar c-admin-shell__sidebar">
        <div className="admin-console-brand c-admin-shell__brand">
          <strong>{productLabel}</strong>
          <span>{subtitleLabel}</span>
        </div>
        <nav className="admin-console-nav c-admin-shell__nav" aria-label={navLabel}>
          {groups.map((group) => (
            <section key={group.label} className="admin-console-nav-group c-admin-shell__nav-group">
              <p>{group.label}{group.badge && <em>{group.badge}</em>}</p>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={['c-admin-shell__nav-button c-admin-control', current === item.key ? 'active' : ''].filter(Boolean).join(' ')}
                  aria-current={current === item.key ? 'page' : undefined}
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <div className="admin-console-main c-admin-shell__main">
        <header className="admin-console-topbar c-admin-shell__topbar">
          <div>
            <span>{workspaceLabel}</span>
            <strong>{currentGroup?.label ?? productLabel}</strong>
          </div>
          <div className="admin-console-account c-admin-shell__account">
            <span>{accountTopbarLabel}</span>
            <strong>{accountLabel}</strong>
            <em>{statusLabel}: {accessLabel}</em>
          </div>
        </header>

        <section className={sectionClassName}>
          <div>
            <p className="page-kicker">{kicker}</p>
            <h1>{title}</h1>
            <p className="page-body">{body}</p>
          </div>
          {heroAside}
        </section>

        {children}
      </div>
    </div>
  );
}

