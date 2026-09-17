import type { AdminAuditEvent } from './api-types';

export type OrganizationGovernanceCategory = 'member' | 'invite' | 'credit' | 'provider' | 'organization' | 'other';

export type OrganizationGovernanceSummary = {
  category: OrganizationGovernanceCategory;
  categoryLabel: string;
  title: string;
  detail: string;
  target: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

export type OrganizationGovernanceDigest = {
  total: number;
  member: number;
  invite: number;
  credit: number;
  provider: number;
  organization: number;
  other: number;
};

const CATEGORY_LABELS: Record<OrganizationGovernanceCategory, string> = {
  member: '成员',
  invite: '邀请',
  credit: '额度',
  provider: 'Provider',
  organization: '机构',
  other: '其他'
};

function text(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function valueFrom(event: AdminAuditEvent, key: string) {
  return text(event.after?.[key] ?? event.before?.[key]);
}

function change(event: AdminAuditEvent, key: string, label: string) {
  const before = text(event.before?.[key]);
  const after = text(event.after?.[key]);
  if (!after && !before) return '';
  if (before === after) return `${label} ${after || before}`;
  if (!before) return `${label} ${after}`;
  if (!after) return `${label} 清空`;
  return `${label} ${before} -> ${after}`;
}

function compact(parts: string[]) {
  return parts.filter(Boolean).join('；') || '已记录后台操作。';
}

export function getOrganizationGovernanceCategory(event: AdminAuditEvent): OrganizationGovernanceCategory {
  if (event.resourceType === 'organization_member' || event.action.includes('.member')) return 'member';
  if (event.resourceType === 'organization_invite' || event.action.includes('.invite')) return 'invite';
  if (event.resourceType === 'organization_ai_credit_pool' || event.action.includes('.credit_pool')) return 'credit';
  if (event.resourceType === 'organization_llm_provider_config' || event.action.includes('.provider')) return 'provider';
  if (event.resourceType === 'organization' || event.action === 'organization.update' || event.action === 'organization.create') return 'organization';
  return 'other';
}

export function summarizeOrganizationGovernanceEvent(event: AdminAuditEvent): OrganizationGovernanceSummary {
  const category = getOrganizationGovernanceCategory(event);
  const actor = event.actorEmail || '未知操作人';
  const target = event.targetEmail || event.relatedUserEmail || valueFrom(event, 'email') || event.organizationName || event.resourceId || '-';
  const categoryLabel = CATEGORY_LABELS[category];

  if (category === 'member') {
    const title = event.action === 'organization.member.add' ? '新增或恢复成员' : '调整成员关系';
    return {
      category,
      categoryLabel,
      title,
      target,
      tone: event.after?.status === 'archived' || event.after?.status === 'disabled' ? 'warning' : 'success',
      detail: compact([
        change(event, 'role', '角色'),
        change(event, 'status', '状态'),
        change(event, 'cohortId', '分组'),
        `${actor} 操作`
      ])
    };
  }

  if (category === 'invite') {
    const actionTitle: Record<string, string> = {
      'organization.invite.create': '创建邀请',
      'organization.invite.archive': '归档邀请',
      'organization.invite.reissue': '重新生成邀请',
      'organization.invite.bulk_reissue': '批量重新生成邀请'
    };
    return {
      category,
      categoryLabel,
      title: actionTitle[event.action] ?? '更新邀请',
      target,
      tone: event.action.includes('archive') ? 'warning' : 'success',
      detail: compact([
        change(event, 'status', '状态'),
        change(event, 'role', '角色'),
        change(event, 'cohortId', '分组'),
        valueFrom(event, 'reissuedCount') ? `生成 ${valueFrom(event, 'reissuedCount')} 个新链接` : '',
        `${actor} 操作`
      ])
    };
  }

  if (category === 'credit') {
    return {
      category,
      categoryLabel,
      title: event.action.endsWith('.create') ? '配置额度池' : '调整额度池',
      target,
      tone: 'neutral',
      detail: compact([
        change(event, 'availableCredits', '可用额度'),
        change(event, 'reservedCredits', '预留额度'),
        change(event, 'perUserDailyLimit', '单人日限额'),
        change(event, 'status', '状态'),
        `${actor} 操作`
      ])
    };
  }

  if (category === 'provider') {
    return {
      category,
      categoryLabel,
      title: event.action.endsWith('.create') ? '配置 Provider' : '更新 Provider',
      target,
      tone: event.after?.status === 'active' ? 'success' : 'neutral',
      detail: compact([
        change(event, 'provider', '服务商'),
        change(event, 'model', '模型'),
        change(event, 'baseUrl', 'Base URL'),
        change(event, 'status', '状态'),
        valueFrom(event, 'apiKeyConfigured') ? 'API Key 已配置' : '',
        `${actor} 操作`
      ])
    };
  }

  if (category === 'organization') {
    return {
      category,
      categoryLabel,
      title: event.action.endsWith('.create') ? '创建机构' : '更新机构',
      target,
      tone: 'neutral',
      detail: compact([
        change(event, 'name', '名称'),
        change(event, 'slug', 'Slug'),
        change(event, 'status', '状态'),
        `${actor} 操作`
      ])
    };
  }

  return {
    category,
    categoryLabel,
    title: event.action,
    target,
    tone: 'neutral',
    detail: compact([event.resourceType, `${actor} 操作`])
  };
}

export function getOrganizationGovernanceDigest(events: AdminAuditEvent[]): OrganizationGovernanceDigest {
  return events.reduce<OrganizationGovernanceDigest>((digest, event) => {
    const category = getOrganizationGovernanceCategory(event);
    digest.total += 1;
    digest[category] += 1;
    return digest;
  }, { total: 0, member: 0, invite: 0, credit: 0, provider: 0, organization: 0, other: 0 });
}
