export type OrganizationInviteExportRow = {
  rowNumber: number;
  email: string | null;
  token: string;
  shortCode?: string | null;
};

export type OrganizationInviteHistoryExportRow = {
  id: number;
  email: string | null;
  role: string;
  effectiveStatus: string;
  cohortName?: string | null;
  cohortSlug?: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdByEmail?: string | null;
  acceptedByEmail?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMemberExportRow = {
  id: number;
  userId: number;
  email: string | null;
  role: string;
  status: string;
  cohortId?: number | null;
  cohortName?: string | null;
};

export type OrganizationMemberBulkUpdateResultRow = {
  userId: number;
  email: string | null;
  fromRole: string;
  toRole: string;
  fromStatus: string;
  toStatus: string;
  fromCohortId?: number | null;
  toCohortId?: number | null;
  result: 'success' | 'failed';
  error?: string;
  auditEventId?: number | null;
};

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function organizationInvitePath(token: string) {
  return `/organizations/invite?token=${encodeURIComponent(token)}`;
}

export function organizationInviteLinksCsv(invites: OrganizationInviteExportRow[]) {
  const rows = [
    ['rowNumber', 'email', 'invitePath', 'shortCode'],
    ...invites.map((invite) => [
      invite.rowNumber,
      invite.email ?? '',
      organizationInvitePath(invite.token),
      invite.shortCode ?? ''
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function organizationInviteHistoryCsv(invites: OrganizationInviteHistoryExportRow[]) {
  const rows = [
    ['id', 'email', 'role', 'status', 'cohortName', 'cohortSlug', 'usedCount', 'maxUses', 'expiresAt', 'createdBy', 'acceptedBy', 'acceptedAt', 'createdAt', 'updatedAt'],
    ...invites.map((invite) => [
      invite.id,
      invite.email ?? '',
      invite.role,
      invite.effectiveStatus,
      invite.cohortName ?? '',
      invite.cohortSlug ?? '',
      invite.usedCount,
      invite.maxUses,
      invite.expiresAt ?? '',
      invite.createdByEmail ?? '',
      invite.acceptedByEmail ?? '',
      invite.acceptedAt ?? '',
      invite.createdAt,
      invite.updatedAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function organizationMembersCsv(members: OrganizationMemberExportRow[]) {
  const rows = [
    ['id', 'userId', 'email', 'role', 'status', 'cohortId', 'cohortName'],
    ...members.map((member) => [
      member.id,
      member.userId,
      member.email ?? '',
      member.role,
      member.status,
      member.cohortId ?? '',
      member.cohortName ?? ''
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function organizationMemberBulkUpdateResultCsv(results: OrganizationMemberBulkUpdateResultRow[]) {
  const rows = [
    ['userId', 'email', 'fromRole', 'toRole', 'fromStatus', 'toStatus', 'fromCohortId', 'toCohortId', 'result', 'error', 'auditEventId'],
    ...results.map((result) => [
      result.userId,
      result.email ?? '',
      result.fromRole,
      result.toRole,
      result.fromStatus,
      result.toStatus,
      result.fromCohortId ?? '',
      result.toCohortId ?? '',
      result.result,
      result.error ?? '',
      result.auditEventId ?? ''
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function organizationMemberBulkUpdateFailedResultCsv(results: OrganizationMemberBulkUpdateResultRow[]) {
  return organizationMemberBulkUpdateResultCsv(results.filter((result) => result.result === 'failed'));
}

