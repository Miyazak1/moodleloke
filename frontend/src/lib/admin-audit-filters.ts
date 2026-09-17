export type AdminAuditFilterState = {
  organizationId: string;
  organizationOnly: boolean;
  resourceType: string;
  limit: string;
};

export const DEFAULT_ADMIN_AUDIT_FILTERS: AdminAuditFilterState = {
  organizationId: '',
  organizationOnly: false,
  resourceType: '',
  limit: '50'
};

const AUDIT_FILTER_KEYS = {
  organizationId: 'auditOrg',
  organizationOnly: 'auditScope',
  resourceType: 'auditType',
  limit: 'auditLimit'
} as const;

const ALLOWED_LIMITS = new Set(['50', '100', '200']);
export const ADMIN_AUDIT_RESOURCE_TYPES = [
  'syllabus-import',
  'organization_member',
  'organization_invite',
  'operational-readiness',
  'blueprint-coverage',
  'blueprint',
  'generation-job',
  'pregeneration',
  'topic',
  'question',
  'quality-metric'
] as const;
const ALLOWED_RESOURCE_TYPES = new Set<string>(ADMIN_AUDIT_RESOURCE_TYPES);

export type AdminAuditFilterTemplateId =
  | 'syllabus_imports'
  | 'organization_invites'
  | 'organization_members'
  | 'operational_readiness'
  | 'question_production'
  | 'candidate_review'
  | 'quality_governance';

export type AdminAuditFilterTemplate = {
  id: AdminAuditFilterTemplateId;
  resourceType: typeof ADMIN_AUDIT_RESOURCE_TYPES[number];
  organizationOnly: boolean;
};

export const ADMIN_AUDIT_FILTER_TEMPLATES: AdminAuditFilterTemplate[] = [
  { id: 'syllabus_imports', resourceType: 'syllabus-import', organizationOnly: false },
  { id: 'organization_invites', resourceType: 'organization_invite', organizationOnly: true },
  { id: 'organization_members', resourceType: 'organization_member', organizationOnly: true },
  { id: 'operational_readiness', resourceType: 'operational-readiness', organizationOnly: false },
  { id: 'question_production', resourceType: 'generation-job', organizationOnly: false },
  { id: 'candidate_review', resourceType: 'question', organizationOnly: false },
  { id: 'quality_governance', resourceType: 'quality-metric', organizationOnly: false }
];

function positiveIntText(value: string | null) {
  if (!value) return '';
  return /^\d+$/.test(value) && Number(value) > 0 ? value : '';
}

export function buildAdminAuditEventParams(filters: AdminAuditFilterState) {
  return {
    organizationId: filters.organizationId ? Number(filters.organizationId) : undefined,
    module: filters.organizationOnly ? 'organization' : undefined,
    resourceType: filters.resourceType || undefined,
    limit: Number(filters.limit || 50)
  };
}

export function parseAdminAuditFiltersFromSearch(search: string): AdminAuditFilterState {
  const params = new URLSearchParams(search);
  const organizationId = positiveIntText(params.get(AUDIT_FILTER_KEYS.organizationId));
  const organizationOnly = params.get(AUDIT_FILTER_KEYS.organizationOnly) === 'organization';
  const resourceTypeValue = params.get(AUDIT_FILTER_KEYS.resourceType) ?? '';
  const limitValue = params.get(AUDIT_FILTER_KEYS.limit) ?? '';
  return {
    organizationId,
    organizationOnly,
    resourceType: ALLOWED_RESOURCE_TYPES.has(resourceTypeValue) ? resourceTypeValue : '',
    limit: ALLOWED_LIMITS.has(limitValue) ? limitValue : DEFAULT_ADMIN_AUDIT_FILTERS.limit
  };
}

export function buildAdminAuditFilterSearch(currentSearch: string, filters: AdminAuditFilterState) {
  const params = new URLSearchParams(currentSearch);
  Object.values(AUDIT_FILTER_KEYS).forEach((key) => params.delete(key));
  if (filters.organizationId) params.set(AUDIT_FILTER_KEYS.organizationId, filters.organizationId);
  if (filters.organizationOnly) params.set(AUDIT_FILTER_KEYS.organizationOnly, 'organization');
  if (filters.resourceType) params.set(AUDIT_FILTER_KEYS.resourceType, filters.resourceType);
  if (filters.limit && filters.limit !== DEFAULT_ADMIN_AUDIT_FILTERS.limit) {
    params.set(AUDIT_FILTER_KEYS.limit, filters.limit);
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function applyAdminAuditFilterTemplate(
  current: AdminAuditFilterState,
  templateId: AdminAuditFilterTemplateId
): AdminAuditFilterState {
  const template = ADMIN_AUDIT_FILTER_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return current;
  return {
    ...current,
    organizationOnly: template.organizationOnly,
    resourceType: template.resourceType
  };
}
