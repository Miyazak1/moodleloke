import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { AdminStatsStrip } from '../components/admin/AdminWorkbench';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminFormField, GhostButton, InlineActions, StatusPill } from '../components/UiPrimitives';
import { useI18n } from '../i18n/useI18n';
import { adminText, selectAdminCopy, usesLatinAdminCopy } from '../lib/admin-locale';
import { createAdminUser, getAdminUsers, grantAdminAdaptiveAIUnits, setAdminUserStatus, type AdminUser, type User } from '../lib/api';

type UserStatusAction = 'disable' | 'restore';
type UserBusyAction = 'create-user' | 'grant-credits' | `status-${string}`;

const ADMIN_USERS_COPY = {
  zh: {
    statuses: { active: '启用', disabled: '已停用' },
    roles: { admin: '管理员' },
    dateLocale: 'zh-CN',
    invalidEmail: '邮箱需要包含 @。',
    shortPassword: '初始密码至少需要 8 位。',
    loadFailed: '后台用户列表暂时无法加载。',
    enterValidEmail: '请输入有效邮箱。',
    created: '已新增管理员 {email}。',
    createFailed: '新增管理员失败。',
    updated: '{email} 已更新为{status}。',
    updateFailed: '更新用户状态失败。',
    invalidGrantUnits: '发放额度必须是正整数。',
    grantFailed: 'AI 额度发放失败。',
    granted: '已向 {email} 发放 {units} 个 AI 额度，当前余额 {balance}。',
    kicker: '后台用户',
    adminTitle: '先看访问状态，再处理管理员账号。',
    guestTitle: '用户管理',
    adminBody: '这里集中查看后台账号状态、创建管理员，并停用或恢复访问。所有账号操作都会进入审计链路。',
    guestBody: '请先登录管理员账号后继续。',
    successTitle: '操作成功',
    loadingTitle: '正在读取用户列表',
    loadingBody: '后台正在连接真实用户数据。',
    errorTitle: '用户操作暂时失败',
    login: '去登录',
    statsLabel: '用户统计',
    allAccounts: '全部账号',
    active: '启用',
    disabled: '已停用',
    admins: '管理员',
    currentAccount: '当前账号',
    listKicker: '账号列表',
    accountCount: '{filtered} / {total} 个账号',
    collapseCreate: '收起新增',
    addAdmin: '新增管理员',
    createKicker: '新增管理员',
    createTitle: '创建后台访问账号',
    auditTrail: '审计留痕',
    email: '邮箱',
    displayName: '显示名',
    displayNameHint: '为空时默认使用邮箱前缀。',
    initialPassword: '初始密码',
    passwordHint: '至少 8 位；创建后请让管理员尽快自行更换。',
    processing: '处理中...',
    createAdmin: '创建管理员',
    grantKicker: 'AI Coach 额度',
    grantTitle: '给 {email} 发放训练额度',
    aiCredits: 'AI额度',
    creditMeta: '已用 {used} / 累计 {granted}',
    grantCredits: '发放额度',
    grantUnits: '额度数量',
    grantReason: '发放备注',
    grantReasonHint: '例如：灰度试用、人工补偿、活动赠送。',
    closeGrant: '取消发放',
    grantSubmit: '确认发放',
    searchAccount: '搜索账号',
    searchPlaceholder: '邮箱、角色、状态或账号 ID',
    statusFilter: '状态筛选',
    allStatuses: '全部状态',
    roleFilter: '角色筛选',
    allRoles: '全部角色',
    clearFilters: '清空筛选',
    emptyTitle: '还没有后台账号',
    emptyBody: '可以通过“新增管理员”创建第一个后台访问账号。',
    noMatchTitle: '没有符合筛选的账号',
    noMatchBody: '试着清空搜索词、状态或角色筛选。',
    tableLabel: '后台用户列表',
    account: '账号',
    role: '角色',
    status: '状态',
    updatedAt: '最近更新',
    action: '操作',
    accountMeta: '账号 #{index} · 创建 {date}',
    disable: '停用',
    restore: '恢复',
    cannotDisableCurrent: '不能停用当前登录账号',
    disableTitle: '停用 {email}',
    restoreTitle: '恢复 {email}',
    disableBody: '停用后，该账号将不能继续作为管理员访问后台。当前登录管理员和最后一个启用管理员不能被停用，后端会再次校验。',
    restoreBody: '恢复后，该账号将重新获得后台访问权限，请确认这是可信任的管理员账号。',
    confirmDisable: '确认停用',
    confirmRestore: '确认恢复'
  },
  en: {
    statuses: { active: 'Active', disabled: 'Disabled' },
    roles: { admin: 'Admin' },
    dateLocale: 'en-US',
    invalidEmail: 'Email must include @.',
    shortPassword: 'Initial password must be at least 8 characters.',
    loadFailed: 'Admin user list could not be loaded right now.',
    enterValidEmail: 'Enter a valid email.',
    created: 'Admin {email} created.',
    createFailed: 'Could not create the admin user.',
    updated: '{email} updated to {status}.',
    updateFailed: 'Could not update user status.',
    invalidGrantUnits: 'Grant units must be a positive integer.',
    grantFailed: 'Could not grant AI credits.',
    granted: 'Granted {units} AI credits to {email}. Current balance: {balance}.',
    kicker: 'Admin Users',
    adminTitle: 'Review access status before managing admin accounts.',
    guestTitle: 'User Management',
    adminBody: 'View backend account status, create admins, and disable or restore access. All account operations enter the audit trail.',
    guestBody: 'Log in with an admin account to continue.',
    successTitle: 'Success',
    loadingTitle: 'Loading user list',
    loadingBody: 'Connecting to live admin user data.',
    errorTitle: 'User action failed',
    login: 'Log in',
    statsLabel: 'User statistics',
    allAccounts: 'All accounts',
    active: 'Active',
    disabled: 'Disabled',
    admins: 'Admins',
    currentAccount: 'Current account',
    listKicker: 'Account List',
    accountCount: '{filtered} / {total} accounts',
    collapseCreate: 'Collapse form',
    addAdmin: 'Add admin',
    createKicker: 'Add Admin',
    createTitle: 'Create backend access account',
    auditTrail: 'Audit trail',
    email: 'Email',
    displayName: 'Display name',
    displayNameHint: 'If empty, the email prefix is used by default.',
    initialPassword: 'Initial password',
    passwordHint: 'At least 8 characters; ask the admin to change it soon after creation.',
    processing: 'Processing...',
    createAdmin: 'Create admin',
    grantKicker: 'AI Coach Credits',
    grantTitle: 'Grant training credits to {email}',
    aiCredits: 'AI credits',
    creditMeta: 'Used {used} / Granted {granted}',
    grantCredits: 'Grant credits',
    grantUnits: 'Credit units',
    grantReason: 'Grant note',
    grantReasonHint: 'For example: pilot trial, manual compensation, campaign gift.',
    closeGrant: 'Cancel grant',
    grantSubmit: 'Confirm grant',
    searchAccount: 'Search account',
    searchPlaceholder: 'Email, role, status, or account ID',
    statusFilter: 'Status filter',
    allStatuses: 'All statuses',
    roleFilter: 'Role filter',
    allRoles: 'All roles',
    clearFilters: 'Clear filters',
    emptyTitle: 'No backend accounts yet',
    emptyBody: 'Use "Add admin" to create the first backend access account.',
    noMatchTitle: 'No accounts match the filters',
    noMatchBody: 'Try clearing the search term, status, or role filter.',
    tableLabel: 'Admin user list',
    account: 'Account',
    role: 'Role',
    status: 'Status',
    updatedAt: 'Last updated',
    action: 'Action',
    accountMeta: 'Account #{index} · Created {date}',
    disable: 'Disable',
    restore: 'Restore',
    cannotDisableCurrent: 'The current signed-in account cannot be disabled',
    disableTitle: 'Disable {email}',
    restoreTitle: 'Restore {email}',
    disableBody: 'After disabling, this account can no longer access admin tools. The current signed-in admin and the last active admin cannot be disabled; the backend validates this again.',
    restoreBody: 'After restore, this account regains backend access. Confirm this is a trusted admin account.',
    confirmDisable: 'Confirm disable',
    confirmRestore: 'Confirm restore'
  }
} as const;

type AdminUsersCopy = (typeof ADMIN_USERS_COPY)[keyof typeof ADMIN_USERS_COPY];

function fillAdminUserTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function formatDate(value: string, copy: AdminUsersCopy) {
  return new Date(value).toLocaleString(copy.dateLocale);
}

function getStatusLabel(status: string, copy: AdminUsersCopy) {
  return copy.statuses[status as keyof typeof copy.statuses] || status;
}

function getRoleLabel(role: string, copy: AdminUsersCopy) {
  return copy.roles[role as keyof typeof copy.roles] || role;
}

function formatAdminUsersError(nextError: unknown, fallback: string, locale: string) {
  const message = (nextError as Error).message || fallback;
  return usesLatinAdminCopy(locale) ? fallback : message;
}

export function AdminUsersPage({
  onBackAudit,
  onGoToContent,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToSpecialPractice,
  onGoToAuth,
  currentUser
}: {
  onBackAudit: () => void;
  onGoToContent: () => void;
  onGoToSchools: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToAuth: () => void;
  currentUser?: User | null;
}) {
  const { locale } = useI18n();
  const copy = selectAdminCopy(locale, ADMIN_USERS_COPY);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<UserBusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingStatusUser, setPendingStatusUser] = useState<AdminUser | null>(null);
  const [pendingStatusAction, setPendingStatusAction] = useState<UserStatusAction | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [newUser, setNewUser] = useState({ email: '', password: '', displayName: '' });
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantDraft, setGrantDraft] = useState({ units: '20', reason: '' });

  const emailError = newUser.email.trim() && !newUser.email.includes('@') ? copy.invalidEmail : '';
  const passwordError = newUser.password && newUser.password.length < 8 ? copy.shortPassword : '';
  const isSaving = busyAction !== null;
  const canCreateUser = newUser.email.includes('@') && newUser.password.length >= 8 && !isSaving;
  const grantUnits = Number(grantDraft.units);
  const canGrantCredits = Boolean(grantUser) && Number.isInteger(grantUnits) && grantUnits > 0 && !isSaving;

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.status === 'active').length,
    disabled: items.filter((item) => item.status === 'disabled').length,
    admins: items.filter((item) => item.role === 'admin').length,
    current: items.some((item) => item.id === currentUser?.id) ? 1 : 0
  }), [currentUser?.id, items]);

  const roles = useMemo(() => Array.from(new Set(items.map((item) => item.role))).filter(Boolean), [items]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesRole = roleFilter === 'all' || item.role === roleFilter;
      const haystack = [item.email, item.role, item.status, item.id].join(' ').toLowerCase();
      return matchesStatus && matchesRole && (!keyword || haystack.includes(keyword));
    });
  }, [items, query, roleFilter, statusFilter]);

  const currentAccountQuery = currentUser?.email || '';
  const isCurrentFilterActive = Boolean(currentAccountQuery && query.trim().toLowerCase() === currentAccountQuery.toLowerCase());

  const isActionBusy = (action: UserBusyAction) => busyAction === action;
  const busyLabel = (action: UserBusyAction, label: string) => {
    if (!isActionBusy(action)) return label;
    return adminText(locale, { zh: `${label}中`, en: `${label}...`, vi: `${label}...` });
  };
  const busyClass = (action: UserBusyAction, base = '') => {
    const loadingClass = isActionBusy(action) ? 'admin-action-loading' : '';
    return [base, loadingClass].filter(Boolean).join(' ') || undefined;
  };
  const statusBusyKey = (id: string): UserBusyAction => `status-${id}`;

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setIsLoading(false);
      setError(null);
      setItems([]);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    void getAdminUsers()
      .then((response) => {
        if (!isCurrent) return;
        setItems(response.items);
      })
      .catch((nextError) => {
        if (!isCurrent) return;
        setError(formatAdminUsersError(nextError, copy.loadFailed, locale));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [currentUser?.role]);

  async function createUser() {
    if (!newUser.email.includes('@')) {
      setError(copy.enterValidEmail);
      return;
    }
    if (newUser.password.length < 8) {
      setError(copy.shortPassword);
      return;
    }
    setBusyAction('create-user');
    setError(null);
    setFeedback(null);
    try {
      const created = await createAdminUser({
        email: newUser.email.trim(),
        password: newUser.password,
        displayName: newUser.displayName.trim() || undefined
      });
      setItems((current) => [created, ...current]);
      setNewUser({ email: '', password: '', displayName: '' });
      setIsCreateOpen(false);
      setFeedback(fillAdminUserTemplate(copy.created, { email: created.email }));
    } catch (nextError) {
      setError(formatAdminUsersError(nextError, copy.createFailed, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function updateStatus(item: AdminUser, action: UserStatusAction) {
    const nextStatus = action === 'disable' ? 'disabled' : 'active';
    const actionKey = statusBusyKey(item.id);
    setPendingStatusUser(null);
    setPendingStatusAction(null);
    setBusyAction(actionKey);
    setError(null);
    setFeedback(null);
    try {
      const next = await setAdminUserStatus(item.id, nextStatus);
      setItems((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
      setFeedback(fillAdminUserTemplate(copy.updated, { email: next.email, status: getStatusLabel(next.status, copy) }));
    } catch (nextError) {
      setError(formatAdminUsersError(nextError, copy.updateFailed, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function grantCredits() {
    if (!grantUser || !Number.isInteger(grantUnits) || grantUnits <= 0) {
      setError(copy.invalidGrantUnits);
      return;
    }
    setBusyAction('grant-credits');
    setError(null);
    setFeedback(null);
    try {
      const result = await grantAdminAdaptiveAIUnits(grantUser.id, {
        units: grantUnits,
        reason: grantDraft.reason.trim() || undefined,
        source: 'admin_manual_grant'
      });
      setItems((current) => current.map((entry) => entry.id === grantUser.id
        ? {
            ...entry,
            aiBalanceUnits: result.balanceUnits,
            aiLifetimeGranted: result.lifetimeGranted,
            aiLifetimeUsed: result.lifetimeUsed
          }
        : entry));
      setFeedback(fillAdminUserTemplate(copy.granted, { email: result.email, units: result.grantedUnits, balance: result.balanceUnits }));
      setGrantUser(null);
      setGrantDraft({ units: '20', reason: '' });
    } catch (nextError) {
      setError(formatAdminUsersError(nextError, copy.grantFailed, locale));
    } finally {
      setBusyAction(null);
    }
  }

  function openStatusConfirm(item: AdminUser, action: UserStatusAction) {
    setPendingStatusUser(item);
    setPendingStatusAction(action);
  }

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
    setRoleFilter('all');
  }

  function renderUserRow(item: AdminUser, index: number) {
    const isCurrentUser = item.id === currentUser?.id;
    const isActive = item.status === 'active';
    const nextAction: UserStatusAction = isActive ? 'disable' : 'restore';
    const aiBalance = item.aiBalanceUnits ?? 0;
    const aiGranted = item.aiLifetimeGranted ?? 0;
    const aiUsed = item.aiLifetimeUsed ?? 0;
    const actionKey = statusBusyKey(item.id);
    const statusLabel = nextAction === 'disable' ? copy.disable : copy.restore;
    return (
      <article key={item.id} className="admin-table-row admin-user-row" role="row">
        <div className="admin-user-account">
          <strong>{item.email}</strong>
          <p>{fillAdminUserTemplate(copy.accountMeta, { index: String(index + 1).padStart(2, '0'), date: formatDate(item.createdAt, copy) })}</p>
          {isCurrentUser && <span className="admin-current-user-badge">{copy.currentAccount}</span>}
        </div>
        <span className="admin-user-table-cell">
          <em>{copy.role}</em>
          <span>{getRoleLabel(item.role, copy)}</span>
        </span>
        <span className="admin-user-table-cell">
          <em>{copy.status}</em>
          <StatusPill tone={isActive ? 'success' : 'muted'}>{getStatusLabel(item.status, copy)}</StatusPill>
        </span>
        <div className="admin-ai-credit-cell admin-user-table-cell">
          <em>{copy.aiCredits}</em>
          <strong>{aiBalance}</strong>
          <small>{fillAdminUserTemplate(copy.creditMeta, { used: aiUsed, granted: aiGranted })}</small>
        </div>
        <span className="admin-user-table-cell">
          <em>{copy.updatedAt}</em>
          <span>{formatDate(item.updatedAt, copy)}</span>
        </span>
        <div className="admin-user-actions">
          <GhostButton onClick={() => { setGrantUser(item); setGrantDraft({ units: '20', reason: '' }); }} disabled={isSaving}>
            {copy.grantCredits}
          </GhostButton>
          <GhostButton
            className={busyClass(actionKey)}
            onClick={() => openStatusConfirm(item, nextAction)}
            disabled={isSaving || (isCurrentUser && nextAction === 'disable')}
          >
            {busyLabel(actionKey, statusLabel)}
          </GhostButton>
          {isCurrentUser && nextAction === 'disable' && <small>{copy.cannotDisableCurrent}</small>}
        </div>
      </article>
    );
  }

  const hasBlockingError = Boolean(error && !isLoading && items.length === 0);
  const hasInlineError = Boolean(error && !hasBlockingError);

  return (
    <AdminPageShell
      current="users"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.adminTitle : copy.guestTitle}
      body={currentUser?.role === 'admin' ? copy.adminBody : copy.guestBody}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToContent={onGoToContent}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToSpecialPractice={onGoToSpecialPractice}
    >
      {currentUser?.role === 'admin' && feedback && <section className="admin-feedback success"><strong>{copy.successTitle}</strong><p>{feedback}</p></section>}
      {currentUser?.role === 'admin' && isLoading && <section className="school-empty-state"><strong>{copy.loadingTitle}</strong><p>{copy.loadingBody}</p></section>}
      {currentUser?.role === 'admin' && hasInlineError && (
        <section className="admin-feedback">
          <strong>{copy.errorTitle}</strong>
          <p>{error}</p>
        </section>
      )}
      {currentUser?.role === 'admin' && hasBlockingError && (
        <section className="school-empty-state">
          <strong>{copy.errorTitle}</strong>
          <p>{error}</p>
          <InlineActions>
            <button type="button" onClick={onGoToAuth}>{copy.login}</button>
          </InlineActions>
        </section>
      )}

      {currentUser?.role === 'admin' && !isLoading && !hasBlockingError && (
        <section className="admin-users-workbench">
          <AdminStatsStrip
            ariaLabel={copy.statsLabel}
            className="admin-workbench-stats"
            items={[
              { key: 'all', label: copy.allAccounts, value: stats.total, active: statusFilter === 'all' && roleFilter === 'all' },
              { key: 'active', label: copy.active, value: stats.active, active: statusFilter === 'active' },
              { key: 'disabled', label: copy.disabled, value: stats.disabled, active: statusFilter === 'disabled' },
              { key: 'admins', label: copy.admins, value: stats.admins, active: roleFilter === 'admin' },
              { key: 'current', label: copy.currentAccount, value: stats.current, active: isCurrentFilterActive }
            ]}
            onSelect={(key) => {
              if (key === 'all') {
                setStatusFilter('all');
                setRoleFilter('all');
              }
              if (key === 'active') setStatusFilter(statusFilter === 'active' ? 'all' : 'active');
              if (key === 'disabled') setStatusFilter(statusFilter === 'disabled' ? 'all' : 'disabled');
              if (key === 'admins') setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin');
              if (key === 'current') setQuery(currentUser?.email || '');
            }}
          />

          <div className="admin-users-toolbar">
            <div>
              <p className="page-kicker">{copy.listKicker}</p>
              <h2>{fillAdminUserTemplate(copy.accountCount, { filtered: filteredItems.length, total: items.length })}</h2>
            </div>
            <button type="button" onClick={() => setIsCreateOpen((current) => !current)}>
              {isCreateOpen ? copy.collapseCreate : copy.addAdmin}
            </button>
          </div>

          {isCreateOpen && (
            <article className="admin-user-create-panel">
              <div className="admin-form-head">
                <div>
                  <p className="page-kicker">{copy.createKicker}</p>
                  <h2>{copy.createTitle}</h2>
                </div>
                <span>{copy.auditTrail}</span>
              </div>
              <div className="admin-form-grid">
                <AdminFormField label={copy.email}>
                  <input value={newUser.email} onChange={(event) => { setNewUser((current) => ({ ...current, email: event.target.value })); setError(null); }} />
                  {emailError && <small className="admin-field-hint danger">{emailError}</small>}
                </AdminFormField>
                <AdminFormField label={copy.displayName}>
                  <input value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} />
                  <small className="admin-field-hint">{copy.displayNameHint}</small>
                </AdminFormField>
              </div>
              <AdminFormField label={copy.initialPassword}>
                <input type="password" value={newUser.password} onChange={(event) => { setNewUser((current) => ({ ...current, password: event.target.value })); setError(null); }} autoComplete="new-password" />
                <small className={passwordError ? 'admin-field-hint danger' : 'admin-field-hint'}>{passwordError || copy.passwordHint}</small>
              </AdminFormField>
              <InlineActions>
                <button type="button" className={busyClass('create-user')} onClick={() => void createUser()} disabled={!canCreateUser}>
                  {busyLabel('create-user', copy.createAdmin)}
                </button>
              </InlineActions>
            </article>
          )}

          {grantUser && (
            <article className="admin-user-create-panel admin-ai-credit-panel">
              <div className="admin-form-head">
                <div>
                  <p className="page-kicker">{copy.grantKicker}</p>
                  <h2>{fillAdminUserTemplate(copy.grantTitle, { email: grantUser.email })}</h2>
                </div>
                <span>{grantUser.aiBalanceUnits ?? 0}</span>
              </div>
              <div className="admin-form-grid">
                <AdminFormField label={copy.grantUnits}>
                  <input
                    inputMode="numeric"
                    value={grantDraft.units}
                    onChange={(event) => {
                      setGrantDraft((current) => ({ ...current, units: event.target.value.replace(/[^\d]/g, '') }));
                      setError(null);
                    }}
                  />
                  {grantDraft.units && (!Number.isInteger(grantUnits) || grantUnits <= 0) && <small className="admin-field-hint danger">{copy.invalidGrantUnits}</small>}
                </AdminFormField>
                <AdminFormField label={copy.grantReason}>
                  <input value={grantDraft.reason} onChange={(event) => setGrantDraft((current) => ({ ...current, reason: event.target.value }))} />
                  <small className="admin-field-hint">{copy.grantReasonHint}</small>
                </AdminFormField>
              </div>
              <InlineActions>
                <GhostButton onClick={() => setGrantUser(null)}>{copy.closeGrant}</GhostButton>
                <button type="button" className={busyClass('grant-credits')} onClick={() => void grantCredits()} disabled={!canGrantCredits}>
                  {busyLabel('grant-credits', copy.grantSubmit)}
                </button>
              </InlineActions>
            </article>
          )}

          <div className="admin-users-filter-panel">
            <AdminFormField label={copy.searchAccount}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
            </AdminFormField>
            <AdminFormField label={copy.statusFilter}>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">{copy.allStatuses}</option>
                <option value="active">{copy.active}</option>
                <option value="disabled">{copy.disabled}</option>
              </select>
            </AdminFormField>
            <AdminFormField label={copy.roleFilter}>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">{copy.allRoles}</option>
                {roles.map((role) => <option key={role} value={role}>{getRoleLabel(role, copy)}</option>)}
              </select>
            </AdminFormField>
            <GhostButton onClick={clearFilters}>{copy.clearFilters}</GhostButton>
          </div>

          {items.length === 0 && (
            <section className="school-empty-state">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyBody}</p>
            </section>
          )}

          {items.length > 0 && filteredItems.length === 0 && (
            <section className="school-empty-state">
              <strong>{copy.noMatchTitle}</strong>
              <p>{copy.noMatchBody}</p>
              <InlineActions>
                <button type="button" onClick={clearFilters}>{copy.clearFilters}</button>
              </InlineActions>
            </section>
          )}

          {filteredItems.length > 0 && (
            <section className="admin-table-wrap admin-users-table-wrap">
              <div className="admin-table admin-users-table" role="table" aria-label={copy.tableLabel}>
                <div className="admin-table-row admin-table-head admin-user-row" role="row">
                  <span role="columnheader">{copy.account}</span>
                  <span role="columnheader">{copy.role}</span>
                  <span role="columnheader">{copy.status}</span>
                  <span role="columnheader">{copy.aiCredits}</span>
                  <span role="columnheader">{copy.updatedAt}</span>
                  <span role="columnheader">{copy.action}</span>
                </div>
                {filteredItems.map((item, index) => renderUserRow(item, index))}
              </div>
            </section>
          )}
        </section>
      )}

      {pendingStatusUser && pendingStatusAction && (
        <ConfirmDialog
          title={fillAdminUserTemplate(pendingStatusAction === 'disable' ? copy.disableTitle : copy.restoreTitle, { email: pendingStatusUser.email })}
          body={
            pendingStatusAction === 'disable'
              ? copy.disableBody
              : copy.restoreBody
          }
          confirmLabel={pendingStatusAction === 'disable' ? copy.confirmDisable : copy.confirmRestore}
          tone={pendingStatusAction === 'disable' ? 'danger' : 'neutral'}
          isBusy={isActionBusy(statusBusyKey(pendingStatusUser.id))}
          onCancel={() => { setPendingStatusUser(null); setPendingStatusAction(null); }}
          onConfirm={() => void updateStatus(pendingStatusUser, pendingStatusAction)}
        />
      )}
    </AdminPageShell>
  );
}
