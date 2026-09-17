import { useI18n } from '../i18n/useI18n';
import { routes } from '../lib/routes';

type AdminNavActionsProps = {
  current: 'audit' | 'content' | 'mockExams' | 'pastPapers' | 'specialPractice' | 'users';
  onGoToAudit?: () => void;
  onGoToContent?: () => void;
  onGoToMockExams?: () => void;
  onGoToPastPapers?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToUsers?: () => void;
};

const ADMIN_NAV_COPY = {
  zh: {
    navLabel: '后台模块导航',
    overviewGroup: '总览',
    contentGroup: '内容',
    learningGroup: '训练',
    operationsGroup: '运营',
    audit: '审核总览',
    content: '内容管理',
    mockExams: '模考题库',
    pastPapers: '真题资料',
    specialPractice: '专项题库',
    users: '用户列表'
  },
  en: {
    navLabel: 'Admin module navigation',
    overviewGroup: 'Overview',
    contentGroup: 'Content',
    learningGroup: 'Training',
    operationsGroup: 'Operations',
    audit: 'Audit Overview',
    content: 'Content',
    mockExams: 'Mock Exams',
    pastPapers: 'Past Papers',
    specialPractice: 'Special Practice',
    users: 'Users'
  }
} as const;

function navigateTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AdminNavActions({
  current,
  onGoToAudit,
  onGoToContent,
  onGoToMockExams,
  onGoToPastPapers,
  onGoToSpecialPractice,
  onGoToUsers
}: AdminNavActionsProps) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? ADMIN_NAV_COPY.en : ADMIN_NAV_COPY.zh;
  const groups = [
    {
      label: copy.overviewGroup,
      items: [
        { key: 'audit', label: copy.audit, onClick: onGoToAudit ?? (() => navigateTo(routes.adminAudit)) }
      ]
    },
    {
      label: copy.contentGroup,
      items: [
        { key: 'content', label: copy.content, onClick: onGoToContent ?? (() => navigateTo(routes.adminContent)) }
      ]
    },
    {
      label: copy.learningGroup,
      items: [
        { key: 'mockExams', label: copy.mockExams, onClick: onGoToMockExams ?? (() => navigateTo(routes.adminMockExams)) },
        { key: 'pastPapers', label: copy.pastPapers, onClick: onGoToPastPapers ?? (() => navigateTo(routes.adminPastPapers)) },
        { key: 'specialPractice', label: copy.specialPractice, onClick: onGoToSpecialPractice ?? (() => navigateTo(routes.adminSpecialPractice)) }
      ]
    },
    {
      label: copy.operationsGroup,
      items: [
        { key: 'users', label: copy.users, onClick: onGoToUsers ?? (() => navigateTo(routes.adminUsers)) }
      ]
    }
  ] as Array<{ label: string; items: Array<{ key: typeof current; label: string; onClick: () => void }> }>;

  return (
    <nav className="admin-module-nav" aria-label={copy.navLabel}>
      {groups.map((group) => (
        <div className="admin-module-nav-group" key={group.label}>
          <span>{group.label}</span>
          <div>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={current === item.key ? 'active' : ''}
                aria-current={current === item.key ? 'page' : undefined}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
