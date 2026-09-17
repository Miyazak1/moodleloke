export const ORGANIZATION_ROLES = ['owner', 'admin', 'teacher', 'coach', 'viewer', 'student'] as const;

export type OrganizationRole = typeof ORGANIZATION_ROLES[number];

export const ORGANIZATION_CAPABILITIES = [
  'manage_billing_pool',
  'manage_provider',
  'manage_members',
  'manage_cohorts',
  'view_learning_reports',
  'assign_practice',
  'use_ai_pool'
] as const;

export type OrganizationCapability = typeof ORGANIZATION_CAPABILITIES[number];

const ROLE_ALIASES: Record<string, OrganizationRole> = {
  manager: 'admin',
  tutor: 'coach'
};

const ROLE_CAPABILITIES: Record<OrganizationRole, ReadonlySet<OrganizationCapability>> = {
  owner: new Set([
    'manage_billing_pool',
    'manage_provider',
    'manage_members',
    'manage_cohorts',
    'view_learning_reports',
    'assign_practice',
    'use_ai_pool'
  ]),
  admin: new Set([
    'manage_billing_pool',
    'manage_members',
    'manage_cohorts',
    'view_learning_reports',
    'assign_practice',
    'use_ai_pool'
  ]),
  teacher: new Set(['view_learning_reports', 'assign_practice', 'use_ai_pool']),
  coach: new Set(['view_learning_reports', 'assign_practice', 'use_ai_pool']),
  viewer: new Set(['view_learning_reports']),
  student: new Set(['use_ai_pool'])
};

export function normalizeOrganizationRole(value: unknown, fallback: OrganizationRole = 'student'): OrganizationRole | null {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!raw) return fallback;
  const aliased = ROLE_ALIASES[raw] ?? raw;
  return ORGANIZATION_ROLES.includes(aliased as OrganizationRole) ? (aliased as OrganizationRole) : null;
}

export function organizationRoleAllows(role: unknown, capability: OrganizationCapability) {
  const normalized = normalizeOrganizationRole(role, 'student');
  return normalized ? ROLE_CAPABILITIES[normalized].has(capability) : false;
}

export function organizationRoleCapabilities(role: unknown) {
  const normalized = normalizeOrganizationRole(role, 'student');
  return normalized ? Array.from(ROLE_CAPABILITIES[normalized]) : [];
}
