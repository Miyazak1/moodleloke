import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import {
  AdminActionBar,
  AdminPanel,
  AdminPanelHeader,
  AdminSubnav,
  AdminTableScroll
} from '../components/admin/AdminWorkbench';
import { MetricCard } from '../components/UiPrimitives';
import {
  assignAdminAdaptiveAIOrganizationAdmin,
  applyAdminAdaptiveAIOrganizationMemberImport,
  archiveAdminAdaptiveAIOrganizationInvite,
  bulkUpdateAdminAdaptiveAIOrganizationMembers,
  bulkReissueAdminAdaptiveAIOrganizationInvites,
  createAdminAdaptiveAIOrganizationInvite,
  getAdminAuditEvents,
  getAdminAdaptiveAIOrganizations,
  getAdminAdaptiveAIOrganizationInvites,
  getOrganizationAdaptiveAIOrganizations,
  previewAdminAdaptiveAIOrganizationMemberImport,
  previewOrganizationAdaptiveAIOrganizationMemberImport,
  reissueAdminAdaptiveAIOrganizationInvite,
  reissueOrganizationAdaptiveAIOrganizationInvite,
  upsertAdminAdaptiveAIOrganization,
  upsertAdminAdaptiveAIOrganizationCreditPool,
  upsertAdminAdaptiveAIOrganizationCohort,
  upsertAdminAdaptiveAIOrganizationMember,
  upsertAdminAdaptiveAIOrganizationProvider,
  upsertOrganizationAdaptiveAIOrganizationCreditPool,
  upsertOrganizationAdaptiveAIOrganizationCohort,
  upsertOrganizationAdaptiveAIOrganizationMember,
  upsertOrganizationAdaptiveAIOrganizationProvider,
  applyOrganizationAdaptiveAIOrganizationMemberImport,
  archiveOrganizationAdaptiveAIOrganizationInvite,
  bulkReissueOrganizationAdaptiveAIOrganizationInvites,
  bulkUpdateOrganizationAdaptiveAIOrganizationMembers,
  createOrganizationAdaptiveAIOrganizationInvite,
  getOrganizationAdaptiveAIOrganizationInvites
} from '../lib/api-admin';
import type {
  AdminAuditEvent,
  AdminAIOrganization,
  AdminAIOrganizationInviteHistory,
  AdminAIOrganizationMemberImportApplyResult,
  AdminAIOrganizationMemberImportPreview,
  User
} from '../lib/api-types';
import {
  organizationInviteHistoryCsv,
  organizationInviteLinksCsv,
  organizationInvitePath,
  organizationMemberBulkUpdateFailedResultCsv,
  organizationMemberBulkUpdateResultCsv,
  organizationMembersCsv,
  type OrganizationMemberBulkUpdateResultRow
} from '../lib/organization-invites';
import { getOrganizationGovernanceDigest, summarizeOrganizationGovernanceEvent } from '../lib/organization-governance';
import { useI18n } from '../i18n/useI18n';

type AdminOrganizationsPageProps = {
  currentUser?: User | null;
  onGoToAuth: () => void;
  onBackAudit?: () => void;
  onGoToUsers?: () => void;
  scope?: 'platform' | 'organization';
};

type OrganizationWorkspaceTab = 'overview' | 'members' | 'cohorts' | 'aiSettings' | 'auditLog';

const SAMPLE_CSV = 'email,role,cohortSlug,cohortName\nstudent@example.com,student,fall-2026,Fall 2026\n';
const ORGANIZATION_ROLE_OPTIONS = ['student', 'teacher', 'coach', 'viewer', 'admin', 'owner'];

function dateInputAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizedOrganizationRoleOption(role: string) {
  const normalized = role === 'manager' ? 'admin' : role;
  return ORGANIZATION_ROLE_OPTIONS.includes(normalized) ? normalized : 'student';
}

function organizationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function appendOrganizationStatus(current: string, next: string) {
  return [current, next].filter(Boolean).join('；');
}

export function AdminOrganizationsPage({ currentUser, onGoToAuth, onBackAudit, onGoToUsers, scope = 'platform' }: AdminOrganizationsPageProps) {
  const isPlatformScope = scope === 'platform';
  const isAdmin = currentUser?.role === 'admin';
  const hasPageAccess = isPlatformScope ? isAdmin : Boolean(currentUser);
  const { t } = useI18n();
  const orgText = (key: string, fallback: string) => isPlatformScope ? fallback : t(`organizationConsole.${key}`, fallback);
  const formatOrgText = (key: string, fallback: string, params?: Record<string, string | number>) => {
    const template = orgText(key, fallback);
    return Object.entries(params ?? {}).reduce(
      (message, [name, value]) => message.split(`{${name}}`).join(String(value)),
      template
    );
  };
  const orgStatus = (key: string, fallback: string, params?: Record<string, string | number>) => formatOrgText(`statusMessages.${key}`, fallback, params);
  const orgConfirm = (key: string, fallback: string, params?: Record<string, string | number>) => formatOrgText(`statusMessages.confirm.${key}`, fallback, params);
  const orgInline = (key: string, fallback: string, params?: Record<string, string | number>) => formatOrgText(`statusMessages.inline.${key}`, fallback, params);
  const organizationApi = useMemo(() => isPlatformScope ? {
    listOrganizations: getAdminAdaptiveAIOrganizations,
    upsertMember: upsertAdminAdaptiveAIOrganizationMember,
    bulkUpdateMembers: bulkUpdateAdminAdaptiveAIOrganizationMembers,
    upsertCohort: upsertAdminAdaptiveAIOrganizationCohort,
    createInvite: createAdminAdaptiveAIOrganizationInvite,
    getInvites: getAdminAdaptiveAIOrganizationInvites,
    archiveInvite: archiveAdminAdaptiveAIOrganizationInvite,
    reissueInvite: reissueAdminAdaptiveAIOrganizationInvite,
    bulkReissueInvites: bulkReissueAdminAdaptiveAIOrganizationInvites,
    previewImport: previewAdminAdaptiveAIOrganizationMemberImport,
    applyImport: applyAdminAdaptiveAIOrganizationMemberImport,
    upsertCreditPool: upsertAdminAdaptiveAIOrganizationCreditPool,
    upsertProvider: upsertAdminAdaptiveAIOrganizationProvider
  } : {
    listOrganizations: getOrganizationAdaptiveAIOrganizations,
    upsertMember: upsertOrganizationAdaptiveAIOrganizationMember,
    bulkUpdateMembers: bulkUpdateOrganizationAdaptiveAIOrganizationMembers,
    upsertCohort: upsertOrganizationAdaptiveAIOrganizationCohort,
    createInvite: createOrganizationAdaptiveAIOrganizationInvite,
    getInvites: getOrganizationAdaptiveAIOrganizationInvites,
    archiveInvite: archiveOrganizationAdaptiveAIOrganizationInvite,
    reissueInvite: reissueOrganizationAdaptiveAIOrganizationInvite,
    bulkReissueInvites: bulkReissueOrganizationAdaptiveAIOrganizationInvites,
    previewImport: previewOrganizationAdaptiveAIOrganizationMemberImport,
    applyImport: applyOrganizationAdaptiveAIOrganizationMemberImport,
    upsertCreditPool: upsertOrganizationAdaptiveAIOrganizationCreditPool,
    upsertProvider: upsertOrganizationAdaptiveAIOrganizationProvider
  }, [isPlatformScope]);
  const [organizations, setOrganizations] = useState<AdminAIOrganization[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [assigningOrganizationAdmin, setAssigningOrganizationAdmin] = useState(false);
  const [busyActions, setBusyActions] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState('');
  const [organizationLoadError, setOrganizationLoadError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [organizationAdminEmail, setOrganizationAdminEmail] = useState('');
  const [organizationAdminInvitePath, setOrganizationAdminInvitePath] = useState('');
  const [cohortName, setCohortName] = useState('');
  const [cohortSlug, setCohortSlug] = useState('');
  const [cohortSeatLimit, setCohortSeatLimit] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCohortId, setInviteCohortId] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('50');
  const [inviteExpiresAt, setInviteExpiresAt] = useState(dateInputAfterDays(30));
  const [inviteToken, setInviteToken] = useState('');
  const [inviteShortCode, setInviteShortCode] = useState('');
  const [inviteRequiresApproval, setInviteRequiresApproval] = useState(false);
  const [creditAvailable, setCreditAvailable] = useState('0');
  const [creditReserved, setCreditReserved] = useState('0');
  const [creditDailyLimit, setCreditDailyLimit] = useState('');
  const [provider, setProvider] = useState('openai');
  const [providerModel, setProviderModel] = useState('');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [preview, setPreview] = useState<AdminAIOrganizationMemberImportPreview | null>(null);
  const [applyResult, setApplyResult] = useState<AdminAIOrganizationMemberImportApplyResult | null>(null);
  const [inviteHistory, setInviteHistory] = useState<AdminAIOrganizationInviteHistory | null>(null);
  const [inviteHistoryStatus, setInviteHistoryStatus] = useState('all');
  const [inviteHistoryCohortId, setInviteHistoryCohortId] = useState('');
  const [inviteHistorySearch, setInviteHistorySearch] = useState('');
  const [governanceEvents, setGovernanceEvents] = useState<AdminAuditEvent[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [bulkMemberCohortId, setBulkMemberCohortId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');
  const [memberCohortFilter, setMemberCohortFilter] = useState('');
  const [lastBulkMemberResults, setLastBulkMemberResults] = useState<OrganizationMemberBulkUpdateResultRow[]>([]);
  const [showAdvancedMemberImport, setShowAdvancedMemberImport] = useState(false);

  const isActionBusy = (action: string) => busyActions.has(action);
  const beginAction = (action: string) => {
    setBusyActions((current) => new Set(current).add(action));
  };
  const endAction = (action: string) => {
    setBusyActions((current) => {
      const next = new Set(current);
      next.delete(action);
      return next;
    });
  };
  const busyClass = (action: string, base = '') => {
    const loadingClass = isActionBusy(action) ? 'admin-action-loading' : '';
    return [base, loadingClass].filter(Boolean).join(' ') || undefined;
  };
  const busyLabel = (action: string, label: string, activeLabel = `${label}中`) => (isActionBusy(action) ? activeLabel : label);
  const [activeTab, setActiveTab] = useState<OrganizationWorkspaceTab>('overview');

  const selected = useMemo(
    () => organizations.find((organization) => organization.id === selectedId) ?? organizations[0] ?? null,
    [organizations, selectedId]
  );
  const recentInviteAttempts = useMemo(
    () => (selected?.inviteAttempts ?? []).slice(0, 20),
    [selected?.inviteAttempts]
  );
  const failedInviteAttemptCount = useMemo(
    () => recentInviteAttempts.filter((attempt) => attempt.status === 'failed' || attempt.status === 'rate_limited').length,
    [recentInviteAttempts]
  );
  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    return (selected?.members ?? []).filter((member) => {
      const matchesKeyword = !keyword || [member.email, String(member.userId), member.role, member.status, member.cohortName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
      const matchesStatus = memberStatusFilter === 'all' || member.status === memberStatusFilter;
      const matchesCohort = !memberCohortFilter || String(member.cohortId ?? '') === memberCohortFilter;
      return matchesKeyword && matchesStatus && matchesCohort;
    });
  }, [memberSearch, memberStatusFilter, memberCohortFilter, selected?.members]);
  const visibleSelectedMemberCount = useMemo(() => {
    const visibleMemberIds = new Set(filteredMembers.map((member) => member.id));
    return selectedMemberIds.filter((id) => visibleMemberIds.has(id)).length;
  }, [filteredMembers, selectedMemberIds]);
  const governanceRows = useMemo(
    () => governanceEvents.map((event) => ({ event, summary: summarizeOrganizationGovernanceEvent(event) })),
    [governanceEvents]
  );
  const governanceDigest = useMemo(() => getOrganizationGovernanceDigest(governanceEvents), [governanceEvents]);
  const failedBulkMemberResults = useMemo(
    () => lastBulkMemberResults.filter((result) => result.result === 'failed'),
    [lastBulkMemberResults]
  );
  const organizationAdminMembers = useMemo(
    () => (selected?.members ?? []).filter((member) => member.role === 'owner' || member.role === 'admin'),
    [selected?.members]
  );

  useEffect(() => {
    setSelectedMemberIds([]);
  }, [selected?.id, memberSearch, memberStatusFilter, memberCohortFilter]);
  const pendingOrganizationAdminInvites = useMemo(
    () => (selected?.invites ?? []).filter((invite) => normalizedOrganizationRoleOption(invite.role) === 'admin' && invite.status === 'pending'),
    [selected?.invites]
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedMemberIds([]);
    setBulkMemberCohortId('');
    setLastBulkMemberResults([]);
    setCreditAvailable(String(selected.aiCreditPool?.availableCredits ?? 0));
    setCreditReserved(String(selected.aiCreditPool?.reservedCredits ?? 0));
    setCreditDailyLimit(selected.aiCreditPool?.perUserDailyLimit ? String(selected.aiCreditPool.perUserDailyLimit) : '');
    const activeProvider = selected.llmProviderConfigs[0] ?? null;
    setProvider(activeProvider?.provider ?? 'openai');
    setProviderModel(activeProvider?.model ?? '');
    setProviderBaseUrl(activeProvider?.baseUrl ?? '');
    setProviderApiKey('');
  }, [selected?.id]);

  useEffect(() => {
    if (!hasPageAccess) return;
    void loadOrganizations();
  }, [hasPageAccess, organizationApi]);

  useEffect(() => {
    if (!hasPageAccess) return;
    if (!selected?.id) return;
    void loadInviteHistory();
    if (isPlatformScope) {
      void loadGovernanceEvents(selected.id);
    } else {
      setGovernanceEvents([]);
    }
  }, [hasPageAccess, isPlatformScope, selected?.id, inviteHistoryStatus, inviteHistoryCohortId]);

  async function loadOrganizations() {
    setLoading(true);
    setOrganizationLoadError('');
    try {
      const result = await organizationApi.listOrganizations();
      setOrganizations(result.items);
      const currentOrganizationId = 'currentOrganizationId' in result && typeof result.currentOrganizationId === 'number'
        ? result.currentOrganizationId
        : null;
      setSelectedId((current) => current ?? currentOrganizationId ?? result.items[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : orgStatus('loadFailed', '机构数据加载失败。');
      setOrganizationLoadError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function createOrganization() {
    if (!orgName.trim()) {
      setStatus(orgStatus('nameRequired', '请先填写机构名称。'));
      return;
    }
    setCreatingOrganization(true);
    setStatus(orgStatus('creatingOrg', '正在创建机构...'));
    try {
      const organization = await upsertAdminAdaptiveAIOrganization({ name: orgName.trim(), slug: orgSlug.trim() || undefined, type: 'school', status: 'active' });
      setOrganizations((items) => [organization, ...items.filter((item) => item.id !== organization.id)]);
      setSelectedId(organization.id);
      setOrgName('');
      setOrgSlug('');
      setStatus(orgStatus('orgCreated', '机构已创建。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('orgCreateFailed', '机构创建失败。'));
    } finally {
      setCreatingOrganization(false);
    }
  }

  async function createCohort() {
    if (!selected) return;
    if (!cohortName.trim()) {
      setStatus(orgStatus('cohortNameRequired', '请先填写分组名称。'));
      return;
    }
    beginAction('create-cohort');
    setStatus(orgStatus('savingCohort', '正在保存分组...'));
    try {
      const organization = await organizationApi.upsertCohort(selected.id, {
        name: cohortName,
        slug: cohortSlug || undefined,
        status: 'active',
        seatLimit: cohortSeatLimit ? Number(cohortSeatLimit) : null
      });
      replaceOrganization(organization);
      setCohortName('');
      setCohortSlug('');
      setCohortSeatLimit('');
      setStatus(orgStatus('cohortSaved', '分组已保存。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('cohortSaveFailed', '分组保存失败。'));
    } finally {
      endAction('create-cohort');
    }
  }

  async function createInvite() {
    if (!selected) return;
    const email = inviteEmail.trim();
    const maxUses = email ? 1 : Number(inviteMaxUses);
    if (!Number.isInteger(maxUses) || maxUses <= 0 || maxUses > 1000) {
      setStatus(orgStatus('maxUsesInvalid', '最大使用次数必须在 1 到 1000 之间。'));
      return;
    }
    setCreatingInvite(true);
    setStatus(orgStatus('creatingInvite', '正在生成邀请...'));
    try {
      const result = await organizationApi.createInvite(selected.id, {
        email: email || null,
        role: 'student',
        cohortId: inviteCohortId ? Number(inviteCohortId) : null,
        maxUses,
        expiresAt: inviteExpiresAt ? new Date(`${inviteExpiresAt}T23:59:59`).toISOString() : null,
        requiresApproval: inviteRequiresApproval
      });
      replaceOrganization(result.organization);
      setInviteToken(result.invite.acceptPath);
      setInviteShortCode(result.invite.shortCode ?? '');
      setInviteEmail('');
      setInviteCohortId('');
      setInviteMaxUses('50');
      setInviteExpiresAt(dateInputAfterDays(30));
      setStatus(orgStatus('inviteCreated', '邀请已生成。复制链接后可以发给学生。'));
      void refreshInviteHistoryAfterMutation(result.organization.id).then((warning) => {
        if (warning) setStatus((current) => appendOrganizationStatus(current, orgStatus('inviteHistoryRefreshFailedInline', '邀请历史暂时无法刷新：{warning}', { warning })));
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('inviteCreateFailed', '邀请生成失败。'));
    } finally {
      setCreatingInvite(false);
    }
  }

  async function assignOrganizationAdmin() {
    if (!selected || !isPlatformScope) return;
    const email = organizationAdminEmail.trim();
    if (!email) {
      setStatus(orgStatus('adminEmailRequired', '请先填写机构管理员邮箱。'));
      return;
    }
    setAssigningOrganizationAdmin(true);
    setStatus(orgStatus('settingAdmin', '正在设置机构管理员...'));
    try {
      const result = await assignAdminAdaptiveAIOrganizationAdmin(selected.id, { email });
      replaceOrganization(result.organization);
      setOrganizationAdminEmail('');
      setOrganizationAdminInvitePath(result.assignment.acceptPath ?? '');
      if (result.assignment.status === 'invited') {
        setStatus(orgStatus('adminInviteCreated', '该邮箱尚未注册，已生成机构管理员邀请。'));
      } else if (result.assignment.status === 'promoted') {
        setStatus(orgStatus('studentPromotedToAdmin', '该邮箱已从本机构学生升级为机构管理员。'));
      } else {
        setStatus(orgStatus('adminSet', '机构管理员已设置。'));
      }
      void refreshInviteHistoryAfterMutation(result.organization.id).then((warning) => {
        if (warning) setStatus((current) => appendOrganizationStatus(current, orgStatus('inviteHistoryRefreshFailedInline', '邀请历史暂时无法刷新：{warning}', { warning })));
      });
      void refreshGovernanceEventsAfterMutation(result.organization.id).then(({ warning }) => {
        if (warning) setStatus((current) => appendOrganizationStatus(current, orgStatus('auditRefreshFailedInline', '治理日志暂时无法刷新：{warning}', { warning })));
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('adminSetFailed', '机构管理员设置失败。'));
    } finally {
      setAssigningOrganizationAdmin(false);
    }
  }

  async function copyOrganizationAdminInviteLink() {
    if (!organizationAdminInvitePath) return;
    const link = organizationAdminInvitePath.startsWith('http') ? organizationAdminInvitePath : `${window.location.origin}${organizationAdminInvitePath}`;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        setStatus(orgStatus('adminInviteCopied', '机构管理员邀请链接已复制。'));
      } catch (error) {
        setStatus(orgStatus('copyFailedManualLink', '自动复制失败，请手动复制链接：{message}', { message: error instanceof Error ? error.message : link }));
      }
    } else {
      setStatus(orgStatus('clipboardNotSupportedManual', '当前浏览器不支持自动复制，请手动复制链接。'));
    }
  }

  async function copyLatestInviteLink() {
    if (!inviteToken) return;
    const origin = window.location.origin;
    const link = inviteToken.startsWith('http') ? inviteToken : `${origin}${inviteToken}`;
    const text = inviteShortCode ? `${link}\n${orgStatus('shortInviteCodeLine', '短邀请码：{code}', { code: inviteShortCode })}` : link;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setStatus(orgStatus('inviteCopied', '邀请链接已复制。'));
      } catch (error) {
        setStatus(orgStatus('copyFailedManualLink', '自动复制失败，请手动复制链接：{message}', { message: error instanceof Error ? error.message : text }));
      }
    } else {
      setStatus(orgStatus('clipboardNotSupportedManual', '当前浏览器不支持自动复制，请手动复制链接。'));
    }
  }

  async function saveCreditPool() {
    if (!selected) return;
    beginAction('save-credit-pool');
    setStatus(orgStatus('savingCreditPool', '正在保存机构额度...'));
    try {
      const organization = await organizationApi.upsertCreditPool(selected.id, {
        availableCredits: Number(creditAvailable || 0),
        reservedCredits: Number(creditReserved || 0),
        perUserDailyLimit: creditDailyLimit ? Number(creditDailyLimit) : null,
        status: 'active'
      });
      replaceOrganization(organization);
      setStatus(orgStatus('creditPoolSaved', '机构额度池已保存。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('creditPoolSaveFailed', '机构额度池保存失败。'));
    } finally {
      endAction('save-credit-pool');
    }
  }

  async function saveProviderConfig() {
    if (!selected) return;
    if (!providerModel.trim()) {
      setStatus(orgStatus('modelRequired', '请先填写模型名称。'));
      return;
    }
    if (!providerApiKey.trim() && selected.llmProviderConfigs.length === 0) {
      setStatus(orgStatus('apiKeyRequired', '首次配置 provider 需要填写 API Key。'));
      return;
    }
    beginAction('save-provider');
    setStatus(orgStatus('savingProvider', '正在保存机构 provider...'));
    try {
      const organization = await organizationApi.upsertProvider(selected.id, {
        id: selected.llmProviderConfigs[0]?.id,
        provider,
        model: providerModel,
        baseUrl: providerBaseUrl || null,
        apiKey: providerApiKey || undefined,
        status: 'active'
      });
      replaceOrganization(organization);
      setProviderApiKey('');
      setStatus(orgStatus('providerSaved', '机构 provider 已保存。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('providerSaveFailed', '机构 provider 保存失败。'));
    } finally {
      endAction('save-provider');
    }
  }

  async function previewImport() {
    if (!selected) return;
    beginAction('preview-import');
    setStatus(orgStatus('precheckingCsv', '正在预检成员 CSV...'));
    try {
      const result = await organizationApi.previewImport(selected.id, { csv });
      setPreview(result);
      setApplyResult(null);
      setStatus(result.summary.errors > 0 ? orgStatus('precheckHasErrors', '预检发现错误，请先修正。') : orgStatus('precheckPassed', '预检通过，可以确认导入。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('precheckFailed', '成员 CSV 预检失败。'));
    } finally {
      endAction('preview-import');
    }
  }

  async function applyImport() {
    if (!selected || !preview || preview.summary.errors > 0) return;
    beginAction('apply-import');
    setStatus(orgStatus('importingMembers', '正在导入成员...'));
    try {
      const result = await organizationApi.applyImport(selected.id, { csv });
      replaceOrganization(result.organization);
      setApplyResult(result);
      setPreview(null);
      const inviteHistoryWarning = await refreshInviteHistoryAfterMutation(result.organization.id);
      setStatus(inviteHistoryWarning
        ? orgStatus('importMembersDoneWithInviteWarning', '已加入 {members} 人，生成 {invites} 个邀请；邀请历史暂时无法刷新：{warning}', {
          members: result.summary.upsertedMembers,
          invites: result.summary.createdInvites,
          warning: inviteHistoryWarning
        })
        : orgStatus('importMembersDone', '已加入 {members} 人，生成 {invites} 个邀请。', {
          members: result.summary.upsertedMembers,
          invites: result.summary.createdInvites
        }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('importMembersFailed', '成员导入失败。'));
    } finally {
      endAction('apply-import');
    }
  }

  function replaceOrganization(organization: AdminAIOrganization) {
    setOrganizations((items) => [organization, ...items.filter((item) => item.id !== organization.id)]);
    setSelectedId(organization.id);
  }

  async function copyInviteLinks() {
    if (!applyResult?.invites.length) return;
    const text = applyResult.invites.map((invite) => `${invite.email ?? ''}\t${organizationInvitePath(invite.token)}\t${invite.shortCode ?? ''}`).join('\n');
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setStatus(orgStatus('inviteCopied', '邀请链接已复制。'));
      } catch (error) {
        setStatus(orgStatus('copyInviteLinksFailed', '自动复制失败，请下载 CSV 或手动复制：{message}', { message: error instanceof Error ? error.message : '浏览器拒绝剪贴板访问。' }));
      }
    } else {
      setStatus(orgStatus('clipboardNotSupportedCsv', '当前浏览器不支持自动复制，请下载 CSV。'));
    }
  }

  function downloadInviteCsv() {
    if (!applyResult?.invites.length) return;
    const blob = new Blob([`${organizationInviteLinksCsv(applyResult.invites)}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected?.slug ?? 'organization'}-invites.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(orgStatus('inviteCsvDownloaded', '邀请 CSV 已下载。'));
  }

  function downloadInviteHistoryCsv() {
    if (!inviteHistory?.items.length) {
      setStatus(orgStatus('noInviteHistoryExport', '当前筛选没有可导出的邀请历史。'));
      return;
    }
    const blob = new Blob([`${organizationInviteHistoryCsv(inviteHistory.items)}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected?.slug ?? 'organization'}-invite-history.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(orgStatus('inviteHistoryCsvDownloaded', '邀请历史 CSV 已下载。'));
  }

  async function loadInviteHistory(organizationId = selected?.id ?? null) {
    if (!organizationId) return;
    try {
      const result = await organizationApi.getInvites(organizationId, {
        status: inviteHistoryStatus,
        cohortId: inviteHistoryCohortId ? Number(inviteHistoryCohortId) : null,
        search: inviteHistorySearch.trim() || undefined
      });
      setInviteHistory(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('inviteHistoryLoadFailed', '邀请历史加载失败。'));
    }
  }

  async function refreshInviteHistoryAfterMutation(organizationId: number) {
    try {
      const result = await organizationApi.getInvites(organizationId, {
        status: inviteHistoryStatus,
        cohortId: inviteHistoryCohortId ? Number(inviteHistoryCohortId) : null,
        search: inviteHistorySearch.trim() || undefined
      });
      setInviteHistory(result);
      return '';
    } catch (error) {
      return organizationErrorMessage(error, orgStatus('inviteHistoryRefreshFailed', '邀请历史刷新失败。'));
    }
  }

  async function loadGovernanceEvents(organizationId = selected?.id ?? null, limit = 20) {
    if (!organizationId) return [];
    try {
      const result = await getAdminAuditEvents({ organizationId, limit });
      setGovernanceEvents(result.items);
      return result.items;
    } catch (error) {
      setStatus(organizationErrorMessage(error, orgStatus('governanceLoadFailed', '治理日志加载失败。')));
      return [];
    }
  }

  async function refreshGovernanceEventsAfterMutation(organizationId: number, limit = 20) {
    try {
      const result = await getAdminAuditEvents({ organizationId, limit });
      setGovernanceEvents(result.items);
      return { items: result.items, warning: '' };
    } catch (error) {
      return {
        items: [] as AdminAuditEvent[],
        warning: organizationErrorMessage(error, orgStatus('governanceRefreshFailed', '治理日志刷新失败。'))
      };
    }
  }

  function auditPayloadPreview(value: Record<string, unknown> | undefined) {
    if (!value || Object.keys(value).length === 0) return '-';
    return JSON.stringify(value, null, 2);
  }

  function statusLabel(status: string) {
    if (status === 'pending') return orgText('pending', '未使用');
    if (status === 'used') return orgText('used', '已使用');
    if (status === 'expired') return orgText('expired', '已过期');
    if (status === 'archived') return orgText('archived', '已归档');
    return status;
  }

  async function archiveInvite(inviteId: number) {
    if (!selected) return;
    const action = `archive-invite-${inviteId}`;
    beginAction(action);
    setStatus(orgStatus('archivingInvite', '正在归档邀请...'));
    try {
      const result = await organizationApi.archiveInvite(selected.id, inviteId);
      replaceOrganization(result.organization);
      const inviteHistoryWarning = await refreshInviteHistoryAfterMutation(result.organization.id);
      setStatus(inviteHistoryWarning
        ? orgStatus('inviteArchivedWithWarning', '邀请已归档；邀请历史暂时无法刷新：{warning}', { warning: inviteHistoryWarning })
        : orgStatus('inviteArchived', '邀请已归档。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('inviteArchiveFailed', '邀请归档失败。'));
    } finally {
      endAction(action);
    }
  }

  async function reissueInvite(inviteId: number) {
    if (!selected) return;
    const action = `reissue-invite-${inviteId}`;
    beginAction(action);
    setStatus(orgStatus('reissuingInvite', '正在重新生成邀请...'));
    try {
      const result = await organizationApi.reissueInvite(selected.id, inviteId);
      replaceOrganization(result.organization);
      setInviteToken(result.invite.acceptPath);
      setInviteShortCode(result.invite.shortCode ?? '');
      const inviteHistoryWarning = await refreshInviteHistoryAfterMutation(result.organization.id);
      setStatus(inviteHistoryWarning
        ? orgStatus('inviteReissuedWithWarning', '已重新生成邀请链接；邀请历史暂时无法刷新：{warning}', { warning: inviteHistoryWarning })
        : orgStatus('inviteReissued', '已重新生成邀请链接，请复制后发给学生。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('inviteReissueFailed', '邀请重新生成失败。'));
    } finally {
      endAction(action);
    }
  }

  async function bulkReissueVisibleInvites() {
    if (!selected || !inviteHistory?.items.length) return;
    const inviteIds = inviteHistory.items.filter((invite) => invite.status !== 'archived').map((invite) => invite.id);
    if (inviteIds.length === 0) {
      setStatus(orgStatus('noInvitesForBulkReissue', '当前筛选没有可重新生成的邀请。'));
      return;
    }
    beginAction('bulk-reissue-invites');
    setStatus(orgStatus('bulkReissuingInvites', '正在批量重新生成邀请...'));
    try {
      const result = await organizationApi.bulkReissueInvites(selected.id, inviteIds);
      replaceOrganization(result.organization);
      const inviteHistoryWarning = await refreshInviteHistoryAfterMutation(result.organization.id);
      setApplyResult({
        organization: result.organization,
        summary: {
          total: result.invites.length,
          upsertedMembers: 0,
          createdInvites: result.invites.length
        },
        invites: result.invites.map((invite) => ({
          rowNumber: invite.sourceInviteId,
          email: invite.email,
          token: invite.token,
          shortCode: invite.shortCode
        }))
      });
      setStatus(inviteHistoryWarning
        ? orgStatus('bulkReissueDoneWithWarning', '已重新生成 {count} 个邀请链接；邀请历史暂时无法刷新：{warning}', { count: result.invites.length, warning: inviteHistoryWarning })
        : orgStatus('bulkReissueDone', '已重新生成 {count} 个邀请链接，请在“本次生成邀请”里复制或下载。', { count: result.invites.length }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('bulkReissueFailed', '批量重新生成邀请失败。'));
    } finally {
      endAction('bulk-reissue-invites');
    }
  }

  async function updateMember(
    member: AdminAIOrganization['members'][number],
    patch: { role?: string; status?: string; cohortId?: number | null }
  ) {
    if (!selected) return;
    const action = `update-member-${member.id}`;
    beginAction(action);
    setStatus(orgStatus('updatingMember', '正在更新成员...'));
    try {
      const organization = await organizationApi.upsertMember(selected.id, {
        userId: member.userId,
        role: patch.role ?? member.role,
        status: patch.status ?? member.status,
        cohortId: patch.cohortId === undefined ? member.cohortId ?? null : patch.cohortId
      });
      replaceOrganization(organization);
      const auditRefresh = await refreshGovernanceEventsAfterMutation(organization.id);
      setStatus(auditRefresh.warning
        ? orgStatus('memberUpdatedWithWarning', '成员信息已更新；治理日志暂时无法刷新：{warning}', { warning: auditRefresh.warning })
        : orgStatus('memberUpdated', '成员信息已更新，并写入治理日志。'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('memberUpdateFailed', '成员信息更新失败。'));
    } finally {
      endAction(action);
    }
  }

  function toggleMemberSelection(memberId: number, checked: boolean) {
    setSelectedMemberIds((current) => checked ? Array.from(new Set([...current, memberId])) : current.filter((id) => id !== memberId));
  }

  function toggleAllMembers(checked: boolean) {
    setSelectedMemberIds(checked ? filteredMembers.map((member) => member.id) : []);
  }

  function matchingMemberAuditEvent(events: AdminAuditEvent[], result: OrganizationMemberBulkUpdateResultRow, startedAt: number) {
    return events.find((event) => {
      if (event.action !== 'organization.member.update' && event.action !== 'organization.member.add') return false;
      if (Number(event.after?.userId ?? event.before?.userId) !== result.userId) return false;
      if (event.after?.status !== result.toStatus) return false;
      if (event.after?.role !== result.toRole) return false;
      const afterCohort = event.after?.cohortId ?? null;
      if (afterCohort !== (result.toCohortId ?? null)) return false;
      return new Date(event.createdAt).getTime() >= startedAt - 5000;
    });
  }

  async function bulkUpdateMembers(patch: { status?: string; cohortId?: number | null }) {
    if (!selected) return;
    const visibleMemberIds = new Set(filteredMembers.map((member) => member.id));
    const members = selected.members.filter((member) => selectedMemberIds.includes(member.id) && visibleMemberIds.has(member.id));
    if (members.length === 0) return setStatus(orgStatus('selectMembersFirst', '请先选择要调整的成员。'));
    if (!window.confirm(orgConfirm('bulkUpdateMembers', '确认批量更新当前筛选范围内的 {count} 名成员？', { count: members.length }))) return;
    beginAction('bulk-update-members');
    setStatus(orgStatus('bulkUpdateMembers', '正在批量更新成员...'));
    const startedAt = Date.now();
    try {
      const desired = members.map((member) => ({
        member,
        toRole: member.role,
        toStatus: patch.status ?? member.status,
        toCohortId: patch.cohortId === undefined ? member.cohortId ?? null : patch.cohortId
      }));
      const result = await organizationApi.bulkUpdateMembers(selected.id, {
        members: desired.map(({ member, toRole, toStatus, toCohortId }) => ({
          userId: member.userId,
          email: member.email,
          role: toRole,
          status: toStatus,
          cohortId: toCohortId
        }))
      });
      replaceOrganization(result.organization);
      const resultByUserId = new Map(result.results.map((item) => [item.userId, item]));
      const results: OrganizationMemberBulkUpdateResultRow[] = desired.map(({ member, toRole, toStatus, toCohortId }) => {
        const row = resultByUserId.get(member.userId);
        return {
          userId: member.userId,
          email: member.email,
          fromRole: member.role,
          toRole,
          fromStatus: member.status,
          toStatus,
          fromCohortId: member.cohortId ?? null,
          toCohortId,
          result: row?.result === 'success' ? 'success' : 'failed',
          error: row?.result === 'failed' ? row.error ?? orgStatus('memberUpdateFailedRow', '成员更新失败') : undefined
        };
      });
      const auditRefresh = await refreshGovernanceEventsAfterMutation(result.organization.id, 200);
      const resultsWithAuditIds = results.map((result) => {
        if (result.result !== 'success') return result;
        return { ...result, auditEventId: matchingMemberAuditEvent(auditRefresh.items, result, startedAt)?.id ?? null };
      });
      setLastBulkMemberResults(resultsWithAuditIds);
      setSelectedMemberIds([]);
      const successCount = resultsWithAuditIds.filter((result) => result.result === 'success').length;
      const failedCount = resultsWithAuditIds.length - successCount;
      setStatus(auditRefresh.warning
        ? orgStatus('bulkMemberDoneWithWarning', '批量成员操作完成：成功 {success}，失败 {failed}。治理日志暂时无法刷新：{warning}', {
          success: successCount,
          failed: failedCount,
          warning: auditRefresh.warning
        })
        : orgStatus('bulkMemberDone', '批量成员操作完成：成功 {success}，失败 {failed}。可下载本次结果明细。', {
          success: successCount,
          failed: failedCount
        }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('bulkMemberFailed', '批量成员操作失败。'));
    } finally {
      endAction('bulk-update-members');
    }
  }

  async function retryFailedBulkMemberResults() {
    if (!selected || failedBulkMemberResults.length === 0) return;
    if (!window.confirm(orgConfirm('retryFailedMembers', '确认重试上一次批量操作中的 {count} 个失败项？', { count: failedBulkMemberResults.length }))) return;
    beginAction('retry-bulk-members');
    setStatus(orgStatus('retryingFailedMembers', '正在重试失败成员...'));
    const startedAt = Date.now();
    try {
      const retryRows = failedBulkMemberResults.map((failed) => {
        const currentMember = selected.members.find((member) => member.userId === failed.userId);
        return { failed, currentMember };
      });
      const result = await organizationApi.bulkUpdateMembers(selected.id, {
        members: retryRows.map(({ failed, currentMember }) => ({
          userId: failed.userId,
          email: currentMember?.email ?? failed.email,
          role: failed.toRole,
          status: failed.toStatus,
          cohortId: failed.toCohortId ?? null
        }))
      });
      replaceOrganization(result.organization);
      const resultByUserId = new Map(result.results.map((item) => [item.userId, item]));
      const results: OrganizationMemberBulkUpdateResultRow[] = retryRows.map(({ failed, currentMember }) => {
        const row = resultByUserId.get(failed.userId);
        return {
          userId: failed.userId,
          email: currentMember?.email ?? failed.email,
          fromRole: currentMember?.role ?? failed.fromRole,
          toRole: failed.toRole,
          fromStatus: currentMember?.status ?? failed.fromStatus,
          toStatus: failed.toStatus,
          fromCohortId: currentMember?.cohortId ?? failed.fromCohortId ?? null,
          toCohortId: failed.toCohortId ?? null,
          result: row?.result === 'success' ? 'success' : 'failed',
          error: row?.result === 'failed' ? row.error ?? orgStatus('memberRetryFailedRow', '成员重试失败') : undefined
        };
      });
      const auditRefresh = await refreshGovernanceEventsAfterMutation(result.organization.id, 200);
      const resultsWithAuditIds = results.map((result) => {
        if (result.result !== 'success') return result;
        return { ...result, auditEventId: matchingMemberAuditEvent(auditRefresh.items, result, startedAt)?.id ?? null };
      });
      setLastBulkMemberResults(resultsWithAuditIds);
      const successCount = resultsWithAuditIds.filter((result) => result.result === 'success').length;
      const failedCount = resultsWithAuditIds.length - successCount;
      setStatus(auditRefresh.warning
        ? orgStatus('retryFailedMembersDoneWithWarning', '失败项重试完成：成功 {success}，仍失败 {failed}。治理日志暂时无法刷新：{warning}', {
          success: successCount,
          failed: failedCount,
          warning: auditRefresh.warning
        })
        : orgStatus('retryFailedMembersDone', '失败项重试完成：成功 {success}，仍失败 {failed}。可下载本次重试结果。', {
          success: successCount,
          failed: failedCount
        }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : orgStatus('retryFailedMembersFailed', '失败成员重试失败。'));
    } finally {
      endAction('retry-bulk-members');
    }
  }

  function downloadMemberCsv() {
    if (!selected) return;
    const csvText = `${organizationMembersCsv(selected.members)}\n`;
    const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected.slug}-members.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(orgStatus('membersCsvDownloaded', '成员 CSV 已下载。'));
  }

  function downloadBulkMemberResultCsv() {
    if (!selected || lastBulkMemberResults.length === 0) return;
    const csvText = `${organizationMemberBulkUpdateResultCsv(lastBulkMemberResults)}\n`;
    const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected.slug}-member-bulk-result.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(orgStatus('bulkResultCsvDownloaded', '批量成员操作结果 CSV 已下载。'));
  }

  function downloadFailedBulkMemberResultCsv() {
    if (!selected || failedBulkMemberResults.length === 0) return;
    const csvText = `${organizationMemberBulkUpdateFailedResultCsv(lastBulkMemberResults)}\n`;
    const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected.slug}-member-bulk-failed.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(orgStatus('failedItemsCsvDownloaded', '批量成员失败项 CSV 已下载。'));
  }

  const organizationTabs: Array<{ key: OrganizationWorkspaceTab; label: string; detail: string }> = [
    { key: 'overview', label: orgText('tabs.overview', '概览'), detail: orgText('tabs.overviewDetail', '规模、状态和下一步') },
    { key: 'members', label: orgText('tabs.members', '成员'), detail: `${filteredMembers.length}/${selected?.members.length ?? 0}` },
    { key: 'cohorts', label: orgText('tabs.cohorts', '分组与邀请'), detail: `${selected?.cohorts.length ?? 0} ${orgText('units.groups', '组')} · ${inviteHistory?.items.length ?? selected?.invites.length ?? 0} ${orgText('units.invites', '邀请')}` },
    { key: 'aiSettings', label: orgText('tabs.aiSettings', 'AI 设置'), detail: selected?.llmProviderConfigs[0]?.model ?? selected?.llmProviderConfigs[0]?.provider ?? orgText('notConfigured', '未配置') },
    { key: 'auditLog', label: orgText('tabs.auditLog', '治理日志'), detail: `${governanceEvents.length} ${orgText('units.records', '条')}` }
  ];
  const showOrganizationNoAccess = !isPlatformScope && hasPageAccess && !loading && !organizationLoadError && organizations.length === 0;
  const showOrganizationWorkspace = hasPageAccess && !showOrganizationNoAccess;

  return (
    <AdminPageShell
      current="organizations"
      currentUser={currentUser}
      kicker={isPlatformScope ? '机构治理' : t('organizationConsole.kicker')}
      title={isPlatformScope ? '管理团队、分组、邀请和机构 AI 配置。' : t('organizationConsole.workspaceTitle')}
      body={isPlatformScope ? '机构是运营对象，用户列表是个人对象。这里处理批量入组、班级分组、邀请链接、额度池和 BYOK 配置。' : t('organizationConsole.workspaceBody')}
      allowAccess={hasPageAccess}
      shellMode={isPlatformScope ? 'admin' : 'organization'}
      showAuthGate={isPlatformScope}
      onGoToAuth={onGoToAuth}
      onGoToAudit={isPlatformScope ? onBackAudit : undefined}
      onGoToUsers={isPlatformScope ? onGoToUsers : undefined}
    >
      {!hasPageAccess && (
        <section className="admin-empty-state">
          <strong>{isPlatformScope ? '需要管理员权限' : t('organizationConsole.needLoginTitle')}</strong>
          <span>{isPlatformScope ? '登录管理员账号后，才能管理机构、成员邀请、额度池和 BYOK 配置。' : t('organizationConsole.needLoginBody')}</span>
          <button type="button" onClick={onGoToAuth}>{t('common.login')}</button>
        </section>
      )}

      {showOrganizationNoAccess && (
        <section className="admin-empty-state">
          <strong>{t('organizationConsole.blockedTitle')}</strong>
          <span>{t('organizationConsole.noManagedOrgBody')}</span>
          <button type="button" onClick={onGoToAuth}>{t('organizationConsole.switchAccount')}</button>
        </section>
      )}

      {showOrganizationWorkspace && (
        <>
      <section className={`admin-work-grid ${isPlatformScope ? 'two' : ''}`}>
        {isPlatformScope && (
          <AdminPanel as="div">
            <AdminPanelHeader
              kicker="机构"
              title="创建或选择机构"
              actions={<button type="button" className="ghost-button" onClick={loadOrganizations} disabled={loading}>刷新</button>}
            />
            <div className="admin-inline-form">
              <input value={orgName} onChange={(event) => setOrgName(event.target.value)} placeholder="机构名称" disabled={creatingOrganization} />
              <input value={orgSlug} onChange={(event) => setOrgSlug(event.target.value)} placeholder="slug，可留空" disabled={creatingOrganization} />
              <button type="button" className="primary-button" onClick={() => void createOrganization()} disabled={creatingOrganization}>
                {creatingOrganization ? '创建中...' : '创建机构'}
              </button>
            </div>
            <div className="admin-list compact">
              {organizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  className={selected?.id === organization.id ? 'active organization-choice-active' : 'organization-choice'}
                  onClick={() => setSelectedId(organization.id)}
                >
                  <strong>
                    {organization.name}
                    {selected?.id === organization.id && <span className="organization-current-badge">当前操作</span>}
                  </strong>
                  <span>{organization.slug} · ID {organization.id} · {organization.members.length} members · {organization.cohorts.length} groups</span>
                </button>
              ))}
            </div>
          </AdminPanel>
        )}

        <AdminPanel as="div">
          <AdminPanelHeader
            kicker={isPlatformScope ? '概览' : t('organizationConsole.currentOrganization')}
            title={selected?.name ?? (loading ? orgText('loadingOrganization', '正在加载机构') : orgText('noManageableOrganization', '暂无可管理机构'))}
            actions={!isPlatformScope ? <button type="button" className="ghost-button" onClick={loadOrganizations} disabled={loading}>{t('organizationConsole.refresh')}</button> : undefined}
          />
          <div className="metric-grid three">
            <MetricCard label={orgText('members', '成员')} value={selected?.members.length ?? 0} />
            <MetricCard label={orgText('cohorts', '分组')} value={selected?.cohorts.length ?? 0} />
            <MetricCard label={orgText('invites', '邀请')} value={inviteHistory?.items.length ?? selected?.invites.length ?? 0} />
          </div>
          {status && <p className="form-hint">{status}</p>}
          {!loading && !selected && organizationLoadError && (
            <p className="admin-feedback">机构数据加载失败：{organizationLoadError}</p>
          )}
          {!loading && !selected && !organizationLoadError && (
            <p className="form-hint">{orgText('noManagedOrgHint', '当前账号还不是任何机构的管理员。请让平台管理员把该账号加入机构，并设置为 admin 或 owner。')}</p>
          )}
          {inviteToken && (
            <div className="admin-callout">
              <strong>新邀请链接</strong>
              <code>{inviteToken}</code>
            </div>
          )}
        </AdminPanel>
      </section>

      {selected && (
        <section className="organization-current-context" aria-label={orgText('currentOperationOrganization', '当前操作机构')}>
          <div>
            <span>{orgText('currentOperationOrganization', '当前操作机构')}</span>
            <strong>{selected.name}</strong>
            <code>{selected.slug}</code>
          </div>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>{orgText('status', '状态')}</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt>{orgText('members', '成员')}</dt>
              <dd>{selected.members.length}</dd>
            </div>
            <div>
              <dt>{orgText('cohorts', '分组')}</dt>
              <dd>{selected.cohorts.length}</dd>
            </div>
            <div>
              <dt>{orgText('invites', '邀请')}</dt>
              <dd>{inviteHistory?.items.length ?? selected.invites.length}</dd>
            </div>
          </dl>
        </section>
      )}

      {selected && (
        <AdminSubnav
          items={organizationTabs}
          activeKey={activeTab}
          ariaLabel={orgText('workspaceAria', '机构工作区')}
          className="admin-organization-subnav"
          onChange={setActiveTab}
        />
      )}

      {selected && activeTab === 'overview' && (
        <section className="admin-work-grid three organization-overview-grid">
          <AdminPanel as="div">
            <AdminPanelHeader kicker={orgText('nextStepKicker', '下一步')} title={orgText('nextStepTitle', '从一个机构上下文进入操作')} />
            <div className="admin-list compact">
              <button type="button" onClick={() => setActiveTab('members')}>
                <strong>{orgText('maintainMembers', '维护成员')}</strong>
                <span>{orgText('maintainMembersBody', '批量转组、停用、归档和导出成员 CSV。')}</span>
              </button>
              <button type="button" onClick={() => setActiveTab('cohorts')}>
                <strong>{orgText('cohortsAndInvites', '分组与邀请')}</strong>
                <span>{orgText('cohortsAndInvitesBody', '创建分组，生成邀请，查询邀请历史。')}</span>
              </button>
              <button type="button" onClick={() => setActiveTab('aiSettings')}>
                <strong>{orgText('configureAi', '配置机构 AI')}</strong>
                <span>{orgText('configureAiBody', '额度池、每日上限和 BYOK provider。')}</span>
              </button>
            </div>
          </AdminPanel>
          {isPlatformScope && (
            <AdminPanel as="div">
              <AdminPanelHeader kicker="机构管理员" title="按注册邮箱授权" />
              <p className="form-hint">该账号仍是普通用户，只能管理当前机构。未注册邮箱会生成绑定本机构的管理员邀请。</p>
              <div className="admin-inline-form">
                <input
                  type="email"
                  value={organizationAdminEmail}
                  onChange={(event) => setOrganizationAdminEmail(event.target.value)}
                  placeholder="负责人邮箱"
                  disabled={assigningOrganizationAdmin}
                />
                <button type="button" className="primary-button" onClick={() => void assignOrganizationAdmin()} disabled={assigningOrganizationAdmin}>
                  {assigningOrganizationAdmin ? '设置中...' : '设为机构管理员'}
                </button>
              </div>
              {organizationAdminInvitePath && (
                <div className="admin-callout">
                  <strong>管理员邀请链接</strong>
                  <code>{window.location.origin}{organizationAdminInvitePath}</code>
                  <button type="button" className="ghost-button" onClick={() => void copyOrganizationAdminInviteLink()}>复制链接</button>
                </div>
              )}
              <div className="admin-list compact">
                {organizationAdminMembers.map((member) => (
                  <button key={member.id} type="button" onClick={() => setActiveTab('members')}>
                    <strong>{member.email ?? `user-${member.userId}`}</strong>
                    <span>{member.role} · {member.status}</span>
                  </button>
                ))}
                {pendingOrganizationAdminInvites.map((invite) => (
                  <button key={invite.id} type="button" onClick={() => setActiveTab('cohorts')}>
                    <strong>{invite.email ?? '未指定邮箱'}</strong>
                    <span>管理员邀请 · {statusLabel(invite.status)} · {invite.usedCount}/{invite.maxUses}</span>
                  </button>
                ))}
                {organizationAdminMembers.length === 0 && pendingOrganizationAdminInvites.length === 0 && (
                  <button type="button" onClick={() => undefined}>
                    <strong>暂无机构管理员</strong>
                    <span>先输入学校负责人邮箱进行授权。</span>
                  </button>
                )}
              </div>
            </AdminPanel>
          )}
          <AdminPanel as="div" className="organization-metric-panel">
            <AdminPanelHeader kicker={orgText('aiSettings', 'AI 设置')} title={orgText('aiSummaryTitle', '额度和 Provider 摘要')} />
            <div className="metric-grid three organization-compact-metrics">
              <MetricCard label={orgText('availableCredits', '可用额度')} value={selected.aiCreditPool?.availableCredits ?? 0} />
              <MetricCard label={orgText('dailyLimit', '每日上限')} value={selected.aiCreditPool?.perUserDailyLimit ?? '-'} />
              <MetricCard label="Provider" value={selected.llmProviderConfigs[0]?.provider ?? '-'} />
            </div>
          </AdminPanel>
          <AdminPanel as="div" className="organization-metric-panel">
            <AdminPanelHeader
              kicker={orgText('governance', '治理')}
              title={orgText('recentChanges', '最近后台变更')}
              actions={<button type="button" className="ghost-button" onClick={() => setActiveTab('auditLog')}>{orgText('viewLogs', '查看日志')}</button>}
            />
            <div className="metric-grid three organization-compact-metrics">
              <MetricCard label={orgText('members', '成员')} value={governanceDigest.member} />
              <MetricCard label={orgText('invites', '邀请')} value={governanceDigest.invite} />
              <MetricCard label={orgText('aiSettings', 'AI 设置')} value={governanceDigest.credit + governanceDigest.provider} />
            </div>
          </AdminPanel>
        </section>
      )}

      {selected && activeTab === 'members' && (
        <AdminPanel>
          <AdminPanelHeader
            kicker={orgText('membersGovernance', '成员治理')}
            title={orgText('membersTitle', '调整成员状态、角色和分组')}
            actions={(
              <AdminActionBar>
              {lastBulkMemberResults.length > 0 && (
                <button type="button" className="ghost-button" onClick={downloadBulkMemberResultCsv}>{orgText('downloadBulkResult', '下载本次批量结果')}</button>
              )}
              {failedBulkMemberResults.length > 0 && (
                <>
                  <button type="button" className={busyClass('retry-bulk-members', 'ghost-button')} onClick={() => void retryFailedBulkMemberResults()} disabled={isActionBusy('retry-bulk-members')}>
                    {busyLabel('retry-bulk-members', orgText('retryFailedItems', '重试失败项'), orgText('retrying', '重试中...'))}
                  </button>
                  <button type="button" className="ghost-button" onClick={downloadFailedBulkMemberResultCsv}>{orgText('downloadFailedItems', '下载失败项')}</button>
                </>
              )}
              <button type="button" className="ghost-button" onClick={downloadMemberCsv}>{orgText('downloadMembersCsv', '下载成员 CSV')}</button>
              </AdminActionBar>
            )}
          />
          <p className="form-hint">{orgText('membersHint', '停用会保留成员记录但不再视为活跃成员；归档用于清理历史关系。每次调整都会写入治理日志。')}</p>
          <div className="admin-inline-form">
            <label>
              {orgText('searchMembers', '搜索成员')}
              <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={orgText('searchMembersPlaceholder', '邮箱、用户 ID、角色或分组')} />
            </label>
            <label>
              {orgText('status', '状态')}
              <select value={memberStatusFilter} onChange={(event) => setMemberStatusFilter(event.target.value)}>
                <option value="all">{orgText('allStatus', '全部状态')}</option>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label>
              {orgText('cohorts', '分组')}
              <select value={memberCohortFilter} onChange={(event) => setMemberCohortFilter(event.target.value)}>
                <option value="">{orgText('allCohorts', '全部分组')}</option>
                {selected.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                ))}
              </select>
            </label>
          </div>
          <AdminActionBar>
            <span className="form-hint">{orgText('selectedVisibleMembersPrefix', '当前筛选已选')} {visibleSelectedMemberCount} {orgText('selectedVisibleMembersSuffix', '名成员')}</span>
            <select value={bulkMemberCohortId} onChange={(event) => setBulkMemberCohortId(event.target.value)}>
              <option value="">{orgText('unassigned', '未分组')}</option>
              {selected.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
              ))}
            </select>
            <button type="button" className={busyClass('bulk-update-members', 'ghost-button')} onClick={() => void bulkUpdateMembers({ cohortId: bulkMemberCohortId ? Number(bulkMemberCohortId) : null })} disabled={isActionBusy('bulk-update-members') || visibleSelectedMemberCount === 0}>{busyLabel('bulk-update-members', orgText('bulkMoveCohort', '批量转组'), orgText('bulkProcessing', '批量处理中...'))}</button>
            <button type="button" className={busyClass('bulk-update-members', 'ghost-button')} onClick={() => void bulkUpdateMembers({ status: 'active' })} disabled={isActionBusy('bulk-update-members') || visibleSelectedMemberCount === 0}>{busyLabel('bulk-update-members', orgText('bulkActivate', '批量启用'), orgText('bulkProcessing', '批量处理中...'))}</button>
            <button type="button" className={busyClass('bulk-update-members', 'ghost-button')} onClick={() => void bulkUpdateMembers({ status: 'disabled' })} disabled={isActionBusy('bulk-update-members') || visibleSelectedMemberCount === 0}>{busyLabel('bulk-update-members', orgText('bulkDisable', '批量停用'), orgText('bulkProcessing', '批量处理中...'))}</button>
            <button type="button" className={busyClass('bulk-update-members', 'ghost-button')} onClick={() => void bulkUpdateMembers({ status: 'archived' })} disabled={isActionBusy('bulk-update-members') || visibleSelectedMemberCount === 0}>{busyLabel('bulk-update-members', orgText('bulkArchive', '批量归档'), orgText('bulkProcessing', '批量处理中...'))}</button>
          </AdminActionBar>
          <AdminTableScroll>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={filteredMembers.length > 0 && filteredMembers.every((member) => selectedMemberIds.includes(member.id))}
                      onChange={(event) => toggleAllMembers(event.target.checked)}
                    />
                  </th>
                  <th>{orgText('members', '成员')}</th>
                  <th>{orgText('role', '角色')}</th>
                  <th>{orgText('cohorts', '分组')}</th>
                  <th>{orgText('status', '状态')}</th>
                  <th>{orgText('action', '操作')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={(event) => toggleMemberSelection(member.id, event.target.checked)}
                      />
                    </td>
                    <td>
                      <div>{member.email ?? `user-${member.userId}`}</div>
                      <small>#{member.userId}</small>
                    </td>
                    <td>
                      <select value={normalizedOrganizationRoleOption(member.role)} onChange={(event) => void updateMember(member, { role: event.target.value })} disabled={isActionBusy(`update-member-${member.id}`)}>
                        {ORGANIZATION_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={member.cohortId ?? ''} onChange={(event) => void updateMember(member, { cohortId: event.target.value ? Number(event.target.value) : null })} disabled={isActionBusy(`update-member-${member.id}`)}>
                        <option value="">{orgText('unassigned', '未分组')}</option>
                        {selected.cohorts.map((cohort) => (
                          <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>{member.status}</td>
                    <td>
                      <AdminActionBar>
                        {member.status === 'active' ? (
                          <button type="button" className={busyClass(`update-member-${member.id}`, 'ghost-button')} onClick={() => void updateMember(member, { status: 'disabled' })} disabled={isActionBusy(`update-member-${member.id}`)}>{busyLabel(`update-member-${member.id}`, orgText('disable', '停用'), orgText('updating', '更新中...'))}</button>
                        ) : (
                          <button type="button" className={busyClass(`update-member-${member.id}`, 'ghost-button')} onClick={() => void updateMember(member, { status: 'active' })} disabled={isActionBusy(`update-member-${member.id}`)}>{busyLabel(`update-member-${member.id}`, orgText('activate', '启用'), orgText('updating', '更新中...'))}</button>
                        )}
                        {member.status !== 'archived' && (
                          <button type="button" className={busyClass(`update-member-${member.id}`, 'ghost-button')} onClick={() => void updateMember(member, { status: 'archived' })} disabled={isActionBusy(`update-member-${member.id}`)}>{busyLabel(`update-member-${member.id}`, orgText('archive', '归档'), orgText('updating', '更新中...'))}</button>
                        )}
                      </AdminActionBar>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6}>{selected.members.length === 0 ? orgText('noMembers', '暂无成员。可以通过 CSV 导入或邀请加入。') : orgText('noFilteredMembers', '当前筛选条件下没有成员。')}</td></tr>
                )}
              </tbody>
            </table>
          </AdminTableScroll>
        </AdminPanel>
      )}

      {selected && activeTab === 'cohorts' && (
        <section className="admin-work-grid two">
          <AdminPanel as="div">
            <AdminPanelHeader kicker={orgText('cohortsAndInvites', '分组与邀请')} title={orgText('cohortSetupTitle', '批量运营前先建分组')} />
            <div className="admin-inline-form">
              <input value={cohortName} onChange={(event) => setCohortName(event.target.value)} placeholder={orgText('cohortNamePlaceholder', '分组名称，例如 2026 春季班')} />
              <input value={cohortSlug} onChange={(event) => setCohortSlug(event.target.value)} placeholder={orgText('slugOptionalPlaceholder', 'slug，可留空')} />
              <input type="number" min="1" max="10000" value={cohortSeatLimit} onChange={(event) => setCohortSeatLimit(event.target.value)} placeholder={orgText('seatLimitPlaceholder', '席位上限，可留空')} />
              <button type="button" className={busyClass('create-cohort', 'primary-button')} onClick={() => void createCohort()} disabled={isActionBusy('create-cohort')}>
                {busyLabel('create-cohort', orgText('saveCohort', '保存分组'), orgText('saving', '保存中...'))}
              </button>
            </div>
            <div className="admin-inline-form">
              <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={orgText('inviteEmailPlaceholder', '指定邮箱，可留空生成通用邀请')} disabled={creatingInvite} />
              <select value={inviteCohortId} onChange={(event) => setInviteCohortId(event.target.value)} disabled={creatingInvite}>
                <option value="">{orgText('organizationInviteOption', '机构级邀请（不绑定分组）')}</option>
                {selected.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>{orgText('cohortOptionPrefix', '班级/分组：')}{cohort.name}{cohort.remainingSeats === null || cohort.remainingSeats === undefined ? '' : ` · ${orgText('remaining', '剩余')} ${cohort.remainingSeats}`}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="1000"
                value={inviteEmail.trim() ? '1' : inviteMaxUses}
                onChange={(event) => setInviteMaxUses(event.target.value)}
                placeholder={orgText('maxUsesPlaceholder', '最大使用次数')}
                disabled={creatingInvite || Boolean(inviteEmail.trim())}
              />
              <label className="admin-checkbox-line">
                <input type="checkbox" checked={inviteRequiresApproval} onChange={(event) => setInviteRequiresApproval(event.target.checked)} disabled={creatingInvite} />
                <span>{orgText('requiresApproval', '接受后待老师审核')}</span>
              </label>
              <input type="date" value={inviteExpiresAt} onChange={(event) => setInviteExpiresAt(event.target.value)} disabled={creatingInvite} />
              <button type="button" className="ghost-button" onClick={() => void createInvite()} disabled={creatingInvite}>
                {creatingInvite ? orgText('creating', '生成中...') : orgText('createInvite', '生成邀请')}
              </button>
            </div>
            <p className="form-hint">{orgText('inviteHint', '不选分组会生成机构级邀请；选择分组后，学生接受邀请会自动进入该班级/分组。指定邮箱的邀请固定为单人使用。')}</p>
            {inviteToken && (
              <div className="admin-callout">
                <strong>{orgText('newInviteLink', '新邀请链接')}</strong>
                <code>{window.location.origin}{inviteToken}</code>
                {inviteShortCode && <code>{orgText('shortCode', '短邀请码：')}{inviteShortCode}</code>}
                <button type="button" className="ghost-button" onClick={() => void copyLatestInviteLink()}>{orgText('copyLink', '复制链接')}</button>
              </div>
            )}
            <AdminTableScroll>
              <table className="admin-data-table">
                <thead><tr><th>{orgText('cohorts', '分组')}</th><th>slug</th><th>{orgText('members', '成员')}</th><th>{orgText('seats', '席位')}</th><th>{orgText('status', '状态')}</th></tr></thead>
                <tbody>
                  {selected.cohorts.map((cohort) => (
                    <tr key={cohort.id}><td>{cohort.name}</td><td>{cohort.slug}</td><td>{cohort.memberCount}</td><td>{cohort.seatLimit ? `${cohort.memberCount}+${cohort.pendingSeatCount ?? 0}/${cohort.seatLimit}` : orgText('unlimited', '不限')}</td><td>{cohort.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
          </AdminPanel>

          <AdminPanel as="div">
            <AdminPanelHeader
              kicker={orgText('bulkMembers', '批量成员')}
              title={orgText('importByEmailTitle', '优先用邮箱邀请导入')}
              actions={(
                <AdminActionBar>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowAdvancedMemberImport((value) => !value)}
                >
                  {showAdvancedMemberImport ? orgText('hideAdvancedFields', '收起高级补录字段') : orgText('advancedFields', '高级补录字段')}
                </button>
                <button type="button" className={busyClass('preview-import', 'primary-button')} onClick={() => void previewImport()} disabled={isActionBusy('preview-import')}>
                  {busyLabel('preview-import', orgText('precheck', '预检'), orgText('prechecking', '预检中...'))}
                </button>
                </AdminActionBar>
              )}
            />
            <p className="form-hint">
              {orgText('importHint', '默认按邮箱批量生成邀请或匹配已有账号；每次都先预检，确认分组、角色和错误行后再导入。')}
            </p>
            {showAdvancedMemberImport && (
              <div className="admin-callout">
                <strong>{orgText('advancedFields', '高级补录字段')}</strong>
                <span>
                  {orgText('advancedFieldsBody', 'CSV 仍支持 `userId`，只用于历史账号补录、迁移排障或精确绑定。常规运营请使用 `email,role,cohortSlug,cohortName`。')}
                </span>
              </div>
            )}
            <textarea className="admin-json-editor" value={csv} onChange={(event) => setCsv(event.target.value)} rows={8} />
            {preview && (
              <div className="admin-callout">
                <strong>{orgText('previewResult', '预检结果')}</strong>
                <span>{preview.summary.total} {orgText('rows', '行')} · {orgText('readyMembers', '入组')} {preview.summary.readyMembers} · {orgText('invites', '邀请')} {preview.summary.readyInvites} · {orgText('errors', '错误')} {preview.summary.errors}</span>
                <button type="button" className={busyClass('apply-import', 'primary-button')} disabled={preview.summary.errors > 0 || isActionBusy('apply-import')} onClick={() => void applyImport()}>
                  {busyLabel('apply-import', orgText('confirmImport', '确认导入'), orgText('importing', '导入中...'))}
                </button>
              </div>
            )}
            {applyResult && (
              <div className="admin-callout">
                <strong>{orgText('generatedInvites', '本次生成邀请')}</strong>
                {applyResult.invites.length === 0 ? (
                  <span>{orgText('noUnregisteredEmails', '没有未注册邮箱。')}</span>
                ) : (
                  <>
                    <AdminActionBar>
                      <button type="button" className="ghost-button" onClick={() => void copyInviteLinks()}>{orgText('copyAllLinks', '复制全部链接')}</button>
                      <button type="button" className="ghost-button" onClick={downloadInviteCsv}>{orgText('downloadCsv', '下载 CSV')}</button>
                    </AdminActionBar>
                    {applyResult.invites.map((invite) => <code key={`${invite.rowNumber}-${invite.email}`}>{invite.email}: {organizationInvitePath(invite.token)}{invite.shortCode ? ` · ${orgInline('shortCode', '短码 {code}', { code: invite.shortCode })}` : ''}</code>)}
                  </>
                )}
              </div>
            )}
          </AdminPanel>
        </section>
      )}

      {selected && activeTab === 'cohorts' && (
        <AdminPanel>
          <AdminPanelHeader
            kicker={orgText('inviteHistory', '邀请历史')}
            title={orgText('inviteHistoryTitle', '查看邀请状态')}
            actions={(
              <AdminActionBar>
              <button type="button" className="ghost-button" onClick={() => void loadInviteHistory()}>{orgText('refreshHistory', '刷新历史')}</button>
              <button type="button" className="ghost-button" onClick={downloadInviteHistoryCsv}>{orgText('downloadHistoryCsv', '下载历史 CSV')}</button>
              <button type="button" className={busyClass('bulk-reissue-invites', 'ghost-button')} onClick={() => void bulkReissueVisibleInvites()} disabled={isActionBusy('bulk-reissue-invites')}>
                {busyLabel('bulk-reissue-invites', orgText('bulkReissue', '批量重新生成'), orgText('creating', '生成中...'))}
              </button>
              </AdminActionBar>
            )}
          />
          <div className="admin-inline-form">
            <label>
              {orgText('status', '状态')}
              <select value={inviteHistoryStatus} onChange={(event) => setInviteHistoryStatus(event.target.value)}>
                <option value="all">{orgText('allActiveRecords', '全部有效记录')}</option>
                <option value="pending">{orgText('pending', '未使用')}</option>
                <option value="used">{orgText('used', '已使用')}</option>
                <option value="expired">{orgText('expired', '已过期')}</option>
                <option value="archived">{orgText('archived', '已归档')}</option>
              </select>
            </label>
            <label>
              {orgText('cohorts', '分组')}
              <select value={inviteHistoryCohortId} onChange={(event) => setInviteHistoryCohortId(event.target.value)}>
                <option value="">{orgText('allCohorts', '全部分组')}</option>
                {selected.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                ))}
              </select>
            </label>
            <label>
              {orgText('emailOrRole', '邮箱/角色')}
              <input value={inviteHistorySearch} onChange={(event) => setInviteHistorySearch(event.target.value)} placeholder={orgText('emailKeywordPlaceholder', '输入邮箱关键词')} />
            </label>
            <button type="button" className="primary-button" onClick={() => void loadInviteHistory()}>{orgText('query', '查询')}</button>
          </div>
          <p className="form-hint">{orgText('inviteHistoryHint', '邀请链接只在生成当次显示和下载。历史记录用于查看状态；如果链接丢失，请重新生成邀请。')}</p>
          <AdminTableScroll>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>{orgText('object', '对象')}</th>
                  <th>{orgText('cohorts', '分组')}</th>
                  <th>{orgText('status', '状态')}</th>
                  <th>{orgText('usage', '使用')}</th>
                  <th>{orgText('expiresAt', '到期')}</th>
                  <th>{orgText('creator', '创建人')}</th>
                  <th>{orgText('accepter', '接受人')}</th>
                  <th>{orgText('createdAt', '创建')}</th>
                  <th>{orgText('action', '操作')}</th>
                </tr>
              </thead>
              <tbody>
                {(inviteHistory?.items ?? selected.invites).map((invite) => {
                  const effectiveStatus = String('effectiveStatus' in invite ? invite.effectiveStatus : invite.status);
                  const cohortName = 'cohortName' in invite
                    ? String(invite.cohortName ?? '-')
                    : selected.cohorts.find((cohort) => cohort.id === invite.cohortId)?.name ?? '-';
                  return (
                    <tr key={invite.id}>
                      <td>{invite.email ?? orgText('genericInvite', '通用邀请')} · {invite.role}</td>
                      <td>{cohortName}</td>
                      <td>{statusLabel(effectiveStatus)}</td>
                      <td>{invite.usedCount}/{invite.maxUses}</td>
                      <td>{invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : orgText('longTerm', '长期有效')}</td>
                      <td>{'createdByEmail' in invite ? invite.createdByEmail ?? '-' : '-'}</td>
                      <td>{'acceptedByEmail' in invite ? invite.acceptedByEmail ?? '-' : '-'}</td>
                      <td>{new Date(invite.createdAt).toLocaleDateString()}</td>
                      <td>
                        <AdminActionBar>
                          {invite.status !== 'archived' && (
                            <button type="button" className={busyClass(`reissue-invite-${invite.id}`, 'ghost-button')} onClick={() => void reissueInvite(invite.id)} disabled={isActionBusy(`reissue-invite-${invite.id}`)}>
                              {busyLabel(`reissue-invite-${invite.id}`, orgText('reissue', '重新生成'), orgText('creating', '生成中...'))}
                            </button>
                          )}
                          {(effectiveStatus === 'pending' || effectiveStatus === 'expired') && (
                            <button type="button" className={busyClass(`archive-invite-${invite.id}`, 'ghost-button')} onClick={() => void archiveInvite(invite.id)} disabled={isActionBusy(`archive-invite-${invite.id}`)}>
                              {busyLabel(`archive-invite-${invite.id}`, orgText('archive', '归档'), orgText('archiving', '归档中...'))}
                            </button>
                          )}
                        </AdminActionBar>
                      </td>
                    </tr>
                  );
                })}
                {(inviteHistory?.items.length ?? selected.invites.length) === 0 && (
                  <tr><td colSpan={9}>{orgText('noInviteRecords', '暂无邀请记录。')}</td></tr>
                )}
              </tbody>
            </table>
          </AdminTableScroll>
        </AdminPanel>
      )}

      {selected && activeTab === 'cohorts' && (
        <AdminPanel>
          <AdminPanelHeader
            kicker={orgText('inviteSafety', '邀请安全')}
            title={orgText('recentShortCodeUsage', '近期短码使用记录')}
          />
          <p className="form-hint">
            {orgText('inviteSafetyHint', '这里只显示能归属到当前机构邀请码的记录；完全随机且未命中的短码只参与账户级限流，不归入机构记录。')}
          </p>
          <div className="metric-grid three">
            <MetricCard label={orgText('recentAttempts', '近期尝试')} value={recentInviteAttempts.length} />
            <MetricCard label={orgText('failedOrLimited', '失败或限流')} value={failedInviteAttemptCount} />
            <MetricCard label={orgText('recentStatus', '最近状态')} value={recentInviteAttempts[0]?.status ?? '-'} />
          </div>
          <AdminTableScroll>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>{orgText('time', '时间')}</th>
                  <th>{orgText('student', '学生')}</th>
                  <th>{orgText('invites', '邀请')}</th>
                  <th>{orgText('cohort', '班级')}</th>
                  <th>{orgText('method', '方式')}</th>
                  <th>{orgText('result', '结果')}</th>
                  <th>{orgText('reason', '原因')}</th>
                </tr>
              </thead>
              <tbody>
                {recentInviteAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{new Date(attempt.createdAt).toLocaleString()}</td>
                    <td>{attempt.userEmail ?? (attempt.userId ? `user-${attempt.userId}` : '-')}</td>
                    <td>{attempt.inviteEmail ?? orgText('genericInvite', '通用邀请')} · {attempt.inviteRole ?? '-'}</td>
                    <td>{attempt.cohortName ?? '-'}</td>
                    <td>{attempt.lookupMode === 'short_code' ? orgText('shortCodeMethod', '短码') : attempt.lookupMode}</td>
                    <td>{statusLabel(attempt.status)}</td>
                    <td>{attempt.reason ?? '-'}</td>
                  </tr>
                ))}
                {recentInviteAttempts.length === 0 && (
                  <tr><td colSpan={7}>{orgText('noInviteAttemptRecords', '暂无可归属到本机构的邀请码使用记录。')}</td></tr>
                )}
              </tbody>
            </table>
          </AdminTableScroll>
        </AdminPanel>
      )}

      {selected && activeTab === 'auditLog' && (
        <AdminPanel>
          <AdminPanelHeader
            kicker={orgText('auditLog', '治理日志')}
            title={orgText('auditLogTitle', '这个机构最近的后台操作')}
            actions={(
              <AdminActionBar>
              {onBackAudit && <button type="button" className="ghost-button" onClick={onBackAudit}>{orgInline('goAuditPage', '去审计页')}</button>}
              <button type="button" className="ghost-button" onClick={() => void loadGovernanceEvents()}>{orgText('refreshLog', '刷新日志')}</button>
              </AdminActionBar>
            )}
          />
          <p className="form-hint">{orgText('auditLogHint', '这里直接复用后台审计记录，只显示当前机构相关事件。列表先给运营摘要，展开后仍可核对原始 before/after。')}</p>
          <div className="metric-grid admin-governance-digest">
            <MetricCard label={orgText('memberChanges', '成员变更')} value={governanceDigest.member} />
            <MetricCard label={orgText('inviteChanges', '邀请变更')} value={governanceDigest.invite} />
            <MetricCard label={orgText('creditChanges', '额度变更')} value={governanceDigest.credit} />
            <MetricCard label={orgText('providerChanges', 'Provider 变更')} value={governanceDigest.provider} />
            <MetricCard label={orgText('other', '其他')} value={governanceDigest.organization + governanceDigest.other} />
          </div>
          <AdminTableScroll>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>{orgText('type', '类型')}</th>
                  <th>{orgText('summary', '摘要')}</th>
                  <th>{orgText('target', '对象')}</th>
                  <th>{orgText('actor', '操作人')}</th>
                  <th>{orgText('time', '时间')}</th>
                  <th>{orgText('details', '详情')}</th>
                </tr>
              </thead>
              <tbody>
                {governanceRows.map(({ event, summary }) => (
                  <tr key={event.id}>
                    <td><span className={`status-pill ${summary.tone === 'neutral' ? '' : summary.tone}`}>{summary.categoryLabel}</span></td>
                    <td>
                      <strong>{summary.title}</strong>
                      <small>{summary.detail}</small>
                    </td>
                    <td>
                      <div>{summary.target}</div>
                      <small>{[event.module, event.resourceType, event.resourceId].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>{event.actorEmail ?? '-'}</td>
                    <td>{new Date(event.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                      <details className="admin-audit-event-details">
                        <summary>{orgText('expand', '展开')}</summary>
                        <div className="admin-audit-event-diff">
                          <section>
                            <h4>{orgText('before', '变更前')}</h4>
                            <pre>{auditPayloadPreview(event.before)}</pre>
                          </section>
                          <section>
                            <h4>{orgText('after', '变更后')}</h4>
                            <pre>{auditPayloadPreview(event.after)}</pre>
                          </section>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {governanceEvents.length === 0 && (
                  <tr><td colSpan={6}>{orgText('noAuditLogs', '暂无治理日志。')}</td></tr>
                )}
              </tbody>
            </table>
          </AdminTableScroll>
        </AdminPanel>
      )}

      {selected && activeTab === 'aiSettings' && (
        <section className="admin-work-grid two">
          <AdminPanel as="div">
            <AdminPanelHeader
              kicker={orgText('creditPool', '机构额度')}
              title={orgText('teamAiCreditPool', '团队 AI 额度池')}
              actions={<button type="button" className={busyClass('save-credit-pool', 'primary-button')} onClick={() => void saveCreditPool()} disabled={isActionBusy('save-credit-pool')}>{busyLabel('save-credit-pool', orgText('saveCredits', '保存额度'), orgText('saving', '保存中...'))}</button>}
            />
            <div className="admin-inline-form">
              <label>
                {orgText('availableCredits', '可用额度')}
                <input value={creditAvailable} onChange={(event) => setCreditAvailable(event.target.value)} inputMode="numeric" />
              </label>
              <label>
                {orgText('reservedCredits', '预留额度')}
                <input value={creditReserved} onChange={(event) => setCreditReserved(event.target.value)} inputMode="numeric" />
              </label>
              <label>
                {orgText('perUserDailyLimit', '单人每日上限')}
                <input value={creditDailyLimit} onChange={(event) => setCreditDailyLimit(event.target.value)} inputMode="numeric" placeholder={orgText('optionalPlaceholder', '可留空')} />
              </label>
            </div>
            <p className="form-hint">{orgText('creditHint', '做题相关 AI 会优先使用机构额度池；学习面板的聚合分析不从这里扣费。')}</p>
          </AdminPanel>

          <AdminPanel as="div">
            <AdminPanelHeader
              kicker={orgText('orgByok', '机构 BYOK')}
              title={orgText('providerConfig', 'Provider 配置')}
              actions={<button type="button" className={busyClass('save-provider', 'primary-button')} onClick={() => void saveProviderConfig()} disabled={isActionBusy('save-provider')}>{busyLabel('save-provider', orgText('saveProvider', '保存 provider'), orgText('saving', '保存中...'))}</button>}
            />
            <div className="admin-inline-form">
              <label>
                Provider
                <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                  <option value="openai">openai</option>
                  <option value="openai-compatible">openai-compatible</option>
                </select>
              </label>
              <label>
                Model
                <input value={providerModel} onChange={(event) => setProviderModel(event.target.value)} placeholder={orgText('modelPlaceholder', '例如 gpt-4.1-mini')} />
              </label>
              <label>
                Base URL
                <input value={providerBaseUrl} onChange={(event) => setProviderBaseUrl(event.target.value)} placeholder={orgText('baseUrlPlaceholder', '兼容服务可填')} />
              </label>
              <label>
                API Key
                <input value={providerApiKey} onChange={(event) => setProviderApiKey(event.target.value)} placeholder={selected.llmProviderConfigs.length > 0 ? orgText('apiKeyKeepPlaceholder', '留空则不更换') : orgText('apiKeyRequiredPlaceholder', '首次配置必填')} />
              </label>
            </div>
            <p className="form-hint">{orgText('apiKeyHint', 'API Key 只写入加密存储，不会回显。')}</p>
          </AdminPanel>
        </section>
      )}
        </>
      )}
    </AdminPageShell>
  );
}

