export type AuditItem = {
  id: string;
  title: string;
  status: string;
  detail: string;
};

export type AuditSummary = {
  schoolsTotal: number;
  schoolsVerified: number;
  schoolsPending: number;
  adminAuditEventCount: number;
  latestAdminAuditEventAt: string | null;
  schoolChangeCount: number;
  latestSchoolChangeAt: string | null;
  mockExamAttemptCount: number;
  specialPracticeSessionCount: number;
};

export type AdminAuditEvent = {
  id: number;
  actorId?: number;
  actorEmail?: string;
  organizationId?: number;
  organizationName?: string;
  organizationSlug?: string;
  relatedUserId?: number;
  relatedUserEmail?: string;
  targetEmail?: string;
  module: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
};

export type AdminReadinessEvidenceFile = {
  name: string;
  kind: string;
  phase: string | null;
  source: string | null;
  status: string | null;
  generatedAt: string | null;
  sizeBytes: number;
  modifiedAt: string;
};

export type AdminReadinessEvidenceDetail = {
  file: AdminReadinessEvidenceFile;
  content: Record<string, unknown>;
};
