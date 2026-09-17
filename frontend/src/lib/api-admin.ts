import { requestJson, toQueryString } from './request';
import type {
  AdminAuditEvent,
  AdminAuditSummary,
  AdminAdaptiveReplenishmentInventory,
  AdminAdaptiveReplenishmentRunResult,
  AdminAdaptiveReplenishmentTeamScopes,
  AdminAdaptiveUsageAggregateRefreshResult,
  AdminAIEntitlementGrant,
  AdminAIQuestioningBlueprint,
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningCandidateBulkTask,
  AdminAIQuestioningGenerationJob,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningOperationalReadiness,
  AdminAIQuestioningPregenerationResult,
  AdminAIQuestioningQualityGovernance,
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningQuestion,
  AdminAIQuestioningAgentRun,
  AdminAIQuestioningQuestionLedgerItem,
  AdminAIQuestioningRemediation,
  AdminAIQuestioningReview,
  AdminAIQuestioningSourceDocument,
  AdminAIQuestioningSourceDocumentCleanupResult,
  AdminAIQuestioningSourceDocumentProfileVisualization,
  AdminAIQuestioningSourceProfilePipelineTask,
  AdminAIQuestioningSourceQuestion,
  AdminAIQuestioningSourceReferenceSummary,
  AdminAIQuestioningSourceAutoProfileTask,
  AdminAIQuestioningSourceTopicTask,
  AdminAIQuestioningExamSeriesProfile,
  AdminAIQuestioningGenerationProfile,
  AdminAIQuestioningStyleProfile,
  AdminAIQuestioningTopicOption,
  AdminAIQuestioningSyllabusBulkUpdatePreview,
  AdminAIQuestioningSyllabusGovernance,
  AdminAIQuestioningSyllabusJsonImport,
  AdminAIQuestioningSyllabusJsonImportApplyResult,
  AdminAIQuestioningSyllabusJsonImportPreview,
  AdminAIQuestioningSyllabusReversePlanResult,
  AdminAIQuestioningSyllabusTopicUpdatePreview,
  AdminAIQuestioningTopicDetail,
  AdminAIQuestioningTopicHealth,
  AdminSubjectPracticeProductionProcessResult,
  AdminSubjectPracticeAutoProductionSetting,
  AdminSubjectPracticeProductionRun,
  AdminSubjectPracticeProductionRunList,
  AdminAIObservability,
  AdminAIGatewayErrorList,
  AdminAIGatewayGroupedResult,
  AdminAIGatewayHealth,
  AdminAIGatewayKeyMetric,
  AdminAIGatewaySummary,
  AdminAIGatewayTaskMetric,
  AdminAIOrganization,
  AdminAIOrganizationAdminAssignmentResult,
  AdminAIOrganizationInviteBulkReissueResult,
  AdminAIOrganizationInviteHistory,
  AdminAIOrganizationInviteCreateResult,
  AdminAIOrganizationMemberImportApplyResult,
  AdminAIOrganizationMemberImportPreview,
  AdminAIProviderConfig,
  AdminAIReviewDecision,
  AdminAIReviewQueue,
  AdminContentBlock,
  AdminTrainingEventObservability,
  AdminMockExamImportResult,
  AdminMockExamImportValidation,
  AdminMockExamBlueprintSlot,
  AdminMockExamGenerationJob,
  AdminMockExamPaper,
  AdminMockExamBlueprintDetail,
  AdminMockExamPaperDetail,
  AdminMockExamQuestion,
  AdminReadinessActionCalibrationRefreshResult,
  AdminReadinessEvidenceDetail,
  AdminReadinessEvidenceFile,
  AdminSpecialPracticeImportResult,
  AdminSpecialPracticeImportValidation,
  AdminSpecialPracticeQuestion,
  AdminSpecialPracticeTopic,
  AdminSpecialPracticeTopicDetail,
  AdminUser,
  AuditItem
} from './api-types';

type AuthRequestOptions = RequestInit & {
  preserveAuthOnUnauthorized?: boolean;
};

export function authRequest<T>(path: string, options: AuthRequestOptions = {}) {
  return requestJson<T>(path, { ...options, withAuth: true });
}

export function getAdminAuditItems() {
  return authRequest<{ items: AuditItem[] }>('/api/v1/admin/audit-logs');
}

export function getAdminPracticeSummary() {
  return authRequest<AdminAuditSummary>('/api/v1/admin/practice/summary');
}

export function getAdminAuditEvents(params: { organizationId?: number | null; module?: string; resourceType?: string; action?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAuditEvent[] }>(`/api/v1/admin/audit-events${toQueryString(params)}`);
}

export function getAdminAdaptiveAIObservability(params: { days?: number; from?: string; to?: string; provider?: string; status?: string; type?: string; subject?: string } = {}) {
  return authRequest<AdminAIObservability>(`/api/v1/admin/csca-special-practice/adaptive/ai/observability${toQueryString(params)}`);
}

export function getAdminAdaptiveAIProviderConfig() {
  return authRequest<AdminAIProviderConfig>('/api/v1/admin/csca-special-practice/adaptive/ai/provider-config');
}

export type AdminQuestionSupplyFulfillmentPlan = {
  id: string;
  requestCycle: number;
  status: string;
  mode: 'shadow';
  attemptCount: number;
  lastErrorCode: string | null;
  updatedAt: string;
  request: {
    id: string;
    source: 'agent_today_plan' | 'intervention_verification';
    subjectCode: 'math' | 'physics' | 'chemistry';
    topicIds: number[];
    requestedCount: number;
    availableCount: number;
    status: string;
  };
};

export function getAdminQuestionSupplyFulfillmentPlans(limit = 50) {
  return authRequest<{ schemaVersion: '1'; mode: 'shadow'; items: AdminQuestionSupplyFulfillmentPlan[] }>(
    `/api/v1/admin/question-supply-requests/fulfillment/plans${toQueryString({ limit })}`
  );
}

export function runAdminQuestionSupplyFulfillment(limit = 25) {
  return authRequest<{
    schemaVersion: '1';
    mode: 'shadow';
    reconciled: Array<{ requestId: string; status: string; availableCount?: number; errorCode?: string }>;
    materialized: Array<{ requestId: string; planId: string; created: boolean }>;
    dispatched: Array<{ planId: string; status: string; errorCode?: string }>;
  }>('/api/v1/admin/question-supply-requests/fulfillment/run', {
    method: 'POST',
    body: JSON.stringify({ limit })
  });
}

export type AdminQuestionSupplyEvaluation = {
  schemaVersion: '1';
  mode: 'shadow';
  range: { days: number; from: string; to: string };
  summary: {
    requestRows: number;
    observations: number;
    duplicateAggregationRate: number | null;
    demandCycles: number;
    checkedCycles: number;
    validCheckedCycles: number;
    confirmedShortageCycles: number;
    shortageConfirmationRate: number | null;
    completedCycles: number;
    executableConfirmedCycles: number;
    recoveryExecutableRate: number | null;
    taskStartedCycles: number;
    taskStartedRate: number | null;
    dispatchFailureRate: number | null;
    recoveryMedianHours: number | null;
    recoveryP90Hours: number | null;
  };
  gate: {
    status: 'insufficient_sample' | 'hold' | 'shadow_evidence_ready';
    realAdapterAuthorized: false;
    blockers: string[];
  };
};

export function getAdminQuestionSupplyEvaluation(days = 30) {
  return authRequest<AdminQuestionSupplyEvaluation>(
    `/api/v1/admin/question-supply-requests/fulfillment/evaluation${toQueryString({ days })}`
  );
}

export type AdminQuestionSupplyAcceptanceReport = {
  schemaVersion: '1';
  mode: 'shadow';
  generatedAt: string;
  realAdapterAuthorized: false;
  overall: AdminQuestionSupplyEvaluation;
  subjects: Array<{ subjectCode: 'math' | 'physics' | 'chemistry'; evaluation: AdminQuestionSupplyEvaluation }>;
};

export type AdminQuestionSupplySchedulerStatus = {
  schemaVersion: '1';
  mode: 'shadow';
  enabled: boolean;
  realAdapterAuthorized: false;
  configuration: { intervalMinutes: number; batchSize: number };
  state: null | {
    lastStatus: 'idle' | 'running' | 'succeeded' | 'failed';
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
    lastSummary: Record<string, unknown>;
    lastErrorCode: string | null;
    leaseActive?: boolean;
    leaseUntil?: string | null;
  };
};

export function getAdminQuestionSupplyAcceptanceReport(days = 30) {
  return authRequest<AdminQuestionSupplyAcceptanceReport>(
    `/api/v1/admin/question-supply-requests/fulfillment/report${toQueryString({ days })}`
  );
}

export function getAdminQuestionSupplySchedulerStatus() {
  return authRequest<AdminQuestionSupplySchedulerStatus>(
    '/api/v1/admin/question-supply-requests/fulfillment/scheduler'
  );
}

export type AdminQuestionSupplyOperationsHealth = {
  schemaVersion: '1';
  mode: 'shadow';
  generatedAt: string;
  status: 'disabled' | 'healthy' | 'warning' | 'critical';
  realAdapterAuthorized: false;
  summary: {
    openRequests: number;
    staleOpenRequests: number;
    checks24h: number;
    checkFailures24h: number;
    checkFailureRate: number | null;
    failedPlans: number;
    expiredPlanLeases: number;
  };
  alerts: Array<{ severity: 'warning' | 'critical'; code: string; subjectCode?: string; count?: number }>;
  subjects: Array<{
    subjectCode: 'math' | 'physics' | 'chemistry';
    openRequests: number;
    staleOpenRequests: number;
    checks24h: number;
    checkFailures24h: number;
    completedCycles7d: number;
    failedPlans: number;
    latestCheckAt: string | null;
  }>;
  scheduler: AdminQuestionSupplySchedulerStatus;
  recentRuns: Array<{
    id: string;
    trigger: 'scheduled' | 'manual';
    status: 'running' | 'succeeded' | 'failed' | 'lease_expired';
    summary: Record<string, unknown>;
    errorCode: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
};

export function getAdminQuestionSupplyOperationsHealth() {
  return authRequest<AdminQuestionSupplyOperationsHealth>(
    '/api/v1/admin/question-supply-requests/fulfillment/operations-health'
  );
}

export function exportAdminQuestionSupplyEvidence(format: 'json' | 'csv', days = 30) {
  return authRequest<{
    schemaVersion: '1';
    file: { name: string; mimeType: string };
    content: string | Record<string, unknown>;
  }>(`/api/v1/admin/question-supply-requests/fulfillment/export${toQueryString({ days, format })}`);
}

export function getAdminAIGatewaySummary(params: { days?: number; from?: string; to?: string } = {}) {
  return authRequest<AdminAIGatewaySummary>(`/api/v1/admin/ai-gateway/summary${toQueryString(params)}`);
}

export function getAdminAIGatewayByTask(params: { days?: number; from?: string; to?: string } = {}) {
  return authRequest<AdminAIGatewayGroupedResult<AdminAIGatewayTaskMetric>>(`/api/v1/admin/ai-gateway/by-task${toQueryString(params)}`);
}

export function getAdminAIGatewayByKey(params: { days?: number; from?: string; to?: string } = {}) {
  return authRequest<AdminAIGatewayGroupedResult<AdminAIGatewayKeyMetric>>(`/api/v1/admin/ai-gateway/by-key${toQueryString(params)}`);
}

export function getAdminAIGatewayErrors(params: { days?: number; from?: string; to?: string; limit?: number } = {}) {
  return authRequest<AdminAIGatewayErrorList>(`/api/v1/admin/ai-gateway/errors${toQueryString(params)}`);
}

export function getAdminAIGatewayHealth() {
  return authRequest<AdminAIGatewayHealth>('/api/v1/admin/ai-gateway/health');
}

export function getAdminAdaptiveAIOrganizations() {
  return authRequest<{ items: AdminAIOrganization[] }>('/api/v1/admin/csca-special-practice/adaptive/ai/organizations');
}

export function upsertAdminAdaptiveAIOrganization(payload: { id?: number; slug?: string; name: string; type?: string; status?: string }) {
  return authRequest<AdminAIOrganization>('/api/v1/admin/csca-special-practice/adaptive/ai/organizations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertAdminAdaptiveAIOrganizationMember(organizationId: number, payload: { userId: number; role?: string; status?: string; cohortId?: number | null; expiresAt?: string | null }) {
  return authRequest<AdminAIOrganization>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function bulkUpdateAdminAdaptiveAIOrganizationMembers(organizationId: number, payload: { members: Array<{ userId: number; email?: string | null; role?: string; status?: string; cohortId?: number | null; expiresAt?: string | null }> }) {
  return authRequest<{
    organization: AdminAIOrganization;
    requested: number;
    succeeded: number;
    failed: number;
    results: Array<{ userId: number | null; email?: string | null; role?: string; status?: string; cohortId?: number | null; result: 'success' | 'failed'; error?: string }>;
  }>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/members/bulk`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertAdminAdaptiveAIOrganizationCohort(organizationId: number, payload: { id?: number; slug?: string; name: string; status?: string; seatLimit?: number | null; metadata?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganization>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/cohorts`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminAdaptiveAIOrganizationInvite(organizationId: number, payload: { email?: string | null; role?: string; cohortId?: number | null; maxUses?: number; expiresAt?: string | null; requiresApproval?: boolean; metadata?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganizationInviteCreateResult>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function assignAdminAdaptiveAIOrganizationAdmin(organizationId: number, payload: { email: string }) {
  return authRequest<AdminAIOrganizationAdminAssignmentResult>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/admins`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAdaptiveAIOrganizationInvites(organizationId: number, params: { status?: string; cohortId?: number | null; search?: string } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.cohortId) search.set('cohortId', String(params.cohortId));
  if (params.search) search.set('search', params.search);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return authRequest<AdminAIOrganizationInviteHistory>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/invites${suffix}`);
}

export function archiveAdminAdaptiveAIOrganizationInvite(organizationId: number, inviteId: number) {
  return authRequest<{ organization: AdminAIOrganization; invite: { id: number; status: string } }>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/invites/${inviteId}/archive`, {
    method: 'PATCH'
  });
}

export function reissueAdminAdaptiveAIOrganizationInvite(organizationId: number, inviteId: number) {
  return authRequest<AdminAIOrganizationInviteCreateResult>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/invites/${inviteId}/reissue`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function bulkReissueAdminAdaptiveAIOrganizationInvites(organizationId: number, inviteIds: number[]) {
  return authRequest<AdminAIOrganizationInviteBulkReissueResult>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/invites/bulk-reissue`, {
    method: 'POST',
    body: JSON.stringify({ inviteIds })
  });
}

export function previewAdminAdaptiveAIOrganizationMemberImport(organizationId: number, payload: { csv?: string; rows?: Array<Record<string, unknown>> }) {
  return authRequest<AdminAIOrganizationMemberImportPreview>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/member-imports/preview`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyAdminAdaptiveAIOrganizationMemberImport(organizationId: number, payload: { csv?: string; rows?: Array<Record<string, unknown>> }) {
  return authRequest<AdminAIOrganizationMemberImportApplyResult>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/member-imports/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertAdminAdaptiveAIOrganizationCreditPool(organizationId: number, payload: { availableCredits: number; reservedCredits?: number; perUserDailyLimit?: number | null; expiresAt?: string | null; status?: string }) {
  return authRequest<AdminAIOrganization>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/credit-pool`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertAdminAdaptiveAIOrganizationProvider(organizationId: number, payload: { id?: number; provider: string; model: string; apiKey?: string; baseUrl?: string | null; status?: string; usagePolicy?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganization>(`/api/v1/admin/csca-special-practice/adaptive/ai/organizations/${organizationId}/provider-configs`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getOrganizationAdaptiveAIOrganizations() {
  return authRequest<{ items: AdminAIOrganization[]; currentOrganizationId?: number | null }>('/api/v1/organization/me/organizations', { preserveAuthOnUnauthorized: true });
}

export function upsertOrganizationAdaptiveAIOrganizationMember(_organizationId: number, payload: { userId: number; role?: string; status?: string; cohortId?: number | null; expiresAt?: string | null }) {
  return authRequest<AdminAIOrganization>('/api/v1/organization/me/members', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function bulkUpdateOrganizationAdaptiveAIOrganizationMembers(_organizationId: number, payload: { members: Array<{ userId: number; email?: string | null; role?: string; status?: string; cohortId?: number | null; expiresAt?: string | null }> }) {
  return authRequest<{
    organization: AdminAIOrganization;
    requested: number;
    succeeded: number;
    failed: number;
    results: Array<{ userId: number | null; email?: string | null; role?: string; status?: string; cohortId?: number | null; result: 'success' | 'failed'; error?: string }>;
  }>('/api/v1/organization/me/members/bulk', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertOrganizationAdaptiveAIOrganizationCohort(_organizationId: number, payload: { id?: number; slug?: string; name: string; status?: string; seatLimit?: number | null; metadata?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganization>('/api/v1/organization/me/cohorts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createOrganizationAdaptiveAIOrganizationInvite(_organizationId: number, payload: { email?: string | null; role?: string; cohortId?: number | null; maxUses?: number; expiresAt?: string | null; requiresApproval?: boolean; metadata?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganizationInviteCreateResult>('/api/v1/organization/me/invites', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getOrganizationAdaptiveAIOrganizationInvites(_organizationId: number, params: { status?: string; cohortId?: number | null; search?: string } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.cohortId) search.set('cohortId', String(params.cohortId));
  if (params.search) search.set('search', params.search);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return authRequest<AdminAIOrganizationInviteHistory>(`/api/v1/organization/me/invites${suffix}`);
}

export function archiveOrganizationAdaptiveAIOrganizationInvite(_organizationId: number, inviteId: number) {
  return authRequest<{ organization: AdminAIOrganization; invite: { id: number; status: string } }>(`/api/v1/organization/me/invites/${inviteId}/archive`, {
    method: 'PATCH'
  });
}

export function reissueOrganizationAdaptiveAIOrganizationInvite(_organizationId: number, inviteId: number) {
  return authRequest<AdminAIOrganizationInviteCreateResult>(`/api/v1/organization/me/invites/${inviteId}/reissue`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function bulkReissueOrganizationAdaptiveAIOrganizationInvites(_organizationId: number, inviteIds: number[]) {
  return authRequest<AdminAIOrganizationInviteBulkReissueResult>('/api/v1/organization/me/invites/bulk-reissue', {
    method: 'POST',
    body: JSON.stringify({ inviteIds })
  });
}

export function previewOrganizationAdaptiveAIOrganizationMemberImport(_organizationId: number, payload: { csv?: string; rows?: Array<Record<string, unknown>> }) {
  return authRequest<AdminAIOrganizationMemberImportPreview>('/api/v1/organization/me/member-imports/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyOrganizationAdaptiveAIOrganizationMemberImport(_organizationId: number, payload: { csv?: string; rows?: Array<Record<string, unknown>> }) {
  return authRequest<AdminAIOrganizationMemberImportApplyResult>('/api/v1/organization/me/member-imports/apply', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertOrganizationAdaptiveAIOrganizationCreditPool(_organizationId: number, payload: { availableCredits: number; reservedCredits?: number; perUserDailyLimit?: number | null; expiresAt?: string | null; status?: string }) {
  return authRequest<AdminAIOrganization>('/api/v1/organization/me/credit-pool', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function upsertOrganizationAdaptiveAIOrganizationProvider(_organizationId: number, payload: { id?: number; provider: string; model: string; apiKey?: string; baseUrl?: string | null; status?: string; usagePolicy?: Record<string, unknown> }) {
  return authRequest<AdminAIOrganization>('/api/v1/organization/me/provider-configs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAdaptiveAIReviewQueue(params: { days?: number; from?: string; to?: string; provider?: string; status?: string; type?: string; subject?: string; reason?: string; limit?: number } = {}) {
  return authRequest<AdminAIReviewQueue>(`/api/v1/admin/csca-special-practice/adaptive/ai/review-queue${toQueryString(params)}`);
}

export function createAdminAdaptiveAIReviewDecision(interactionId: number, payload: { decision: string; note?: string }) {
  return authRequest<AdminAIReviewDecision>(`/api/v1/admin/csca-special-practice/adaptive/ai/review-queue/${interactionId}/decisions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningBlueprints(params: { subject?: string; status?: string } = {}) {
  return authRequest<{ items: AdminAIQuestioningBlueprint[] }>(`/api/v1/admin/ai-questioning/blueprints${toQueryString(params)}`);
}

export function getAdminAIQuestioningBlueprintCoverage(params: { subject?: string } = {}) {
  return authRequest<AdminAIQuestioningBlueprintCoverage>(`/api/v1/admin/ai-questioning/blueprint-coverage${toQueryString(params)}`);
}

export function ensureAdminAIQuestioningBlueprintCoverage(payload: { subject?: string; limit?: number; difficulty?: string; questionType?: string } = {}) {
  return authRequest<{ created: number; skipped: number; items: AdminAIQuestioningBlueprint[] }>('/api/v1/admin/ai-questioning/blueprint-coverage/ensure', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminAIQuestioningBlueprint(blueprintId: number, payload: {
  difficulty?: string;
  questionType?: string;
  skill?: string | null;
  instruction?: string;
  targetSkills?: string[];
  excludedScope?: string[];
  constraints?: Record<string, unknown>;
  note?: string;
}) {
  return authRequest<AdminAIQuestioningBlueprint>(`/api/v1/admin/ai-questioning/blueprints/${blueprintId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningTopicHealth(params: { subject?: string; limit?: number } = {}) {
  return authRequest<AdminAIQuestioningTopicHealth>(`/api/v1/admin/ai-questioning/topic-health${toQueryString(params)}`);
}

export function getAdminAdaptiveReplenishmentInventory(params: { subject?: string; topicId?: number; difficultyBand?: string; limit?: number } = {}) {
  return authRequest<AdminAdaptiveReplenishmentInventory>(`/api/v1/admin/ai-questioning/adaptive-replenishment/inventory${toQueryString(params)}`);
}

export function getAdminAdaptiveReplenishmentTeamScopes(params: { organizationId?: number; limit?: number } = {}) {
  return authRequest<AdminAdaptiveReplenishmentTeamScopes>(`/api/v1/admin/ai-questioning/adaptive-replenishment/team-scopes${toQueryString(params)}`);
}

export function runAdminAdaptiveReplenishment(payload: { subject?: string; limit?: number; maxSubjects?: number; maxJobs?: number; maxRounds?: number; topicLimit?: number; days?: number; force?: boolean; includeColdStart?: boolean; processImmediately?: boolean; batchTarget?: number } = {}) {
  return authRequest<AdminAdaptiveReplenishmentRunResult>('/api/v1/admin/ai-questioning/adaptive-replenishment/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function refreshAdminAdaptiveUsageAggregates(payload: { subject?: string; days?: number } = {}) {
  return authRequest<AdminAdaptiveUsageAggregateRefreshResult>('/api/v1/admin/ai-questioning/adaptive-replenishment/usage-aggregates/refresh', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningTopicDetail(topicId: number) {
  return authRequest<AdminAIQuestioningTopicDetail>(`/api/v1/admin/ai-questioning/topic-health/${topicId}/detail`);
}

export function getAdminSubjectPracticeProductionRuns(params: { subject?: string } = {}) {
  return authRequest<AdminSubjectPracticeProductionRunList>(`/api/v1/admin/ai-questioning/subject-practice-production-runs${toQueryString(params)}`);
}

export function getAdminSubjectPracticeProductionRun(runId: number) {
  return authRequest<AdminSubjectPracticeProductionRun>(`/api/v1/admin/ai-questioning/subject-practice-production-runs/${runId}`);
}

export function getAdminSubjectPracticeAutoProductionSetting(subject: string) {
  return authRequest<AdminSubjectPracticeAutoProductionSetting>(`/api/v1/admin/ai-questioning/subject-practice-auto-production-settings/${encodeURIComponent(subject)}`);
}

export function updateAdminSubjectPracticeAutoProductionSetting(subject: string, payload: { enabled?: boolean; batchTarget?: number }) {
  return authRequest<AdminSubjectPracticeAutoProductionSetting>(`/api/v1/admin/ai-questioning/subject-practice-auto-production-settings/${encodeURIComponent(subject)}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminSubjectPracticeProductionRun(payload: { subject: string; limit?: number; maxNoProgressRounds?: number; batchTarget?: number }) {
  return authRequest<AdminSubjectPracticeProductionRun>('/api/v1/admin/ai-questioning/subject-practice-production-runs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function processAdminSubjectPracticeProductionRun(runId: number, payload: { maxJobs?: number; maxJobsPerDifficulty?: number; untilComplete?: boolean; maxRounds?: number } = {}) {
  return authRequest<AdminSubjectPracticeProductionProcessResult>(`/api/v1/admin/ai-questioning/subject-practice-production-runs/${runId}/process`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningOperationalReadiness(params: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam' } = {}) {
  return authRequest<AdminAIQuestioningOperationalReadiness>(`/api/v1/admin/ai-questioning/operational-readiness${toQueryString(params)}`);
}

export function recordAdminAIQuestioningOperationalReadinessEvent(payload: { event: 'view_next_action' | 'download_csv' | 'download_json'; subject?: string | null; useCase?: 'subject_practice' | 'online_mock_exam' | null; targetId?: string; format?: 'csv' | 'json' }) {
  return authRequest<{
    ok: boolean;
    event: string;
    readiness: Record<string, unknown>;
    latestAuditEvent: AdminAIQuestioningOperationalReadiness['latestAuditEvent'];
  }>('/api/v1/admin/ai-questioning/operational-readiness/events', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function runAdminAIQuestioningTopicAction(topicId: number, payload: { action: 'ensure_blueprint' | 'generate_candidates' | 'expand_candidates' | 'review_candidates' | 'approve_candidates' | 'review_quality'; limit?: number; force?: boolean; processNow?: boolean; perBlueprint?: number; count?: number }) {
  return authRequest<{
    action: string;
    topicId: number;
    requested?: number;
    enqueued?: number;
    skipped?: number;
    waiting?: number;
    completed?: boolean;
    blocked?: boolean;
    message?: string;
    repairFirst?: {
      handled: number;
      approved: number;
      repaired: number;
      regenerated: number;
      skipped: number;
      waiting?: number;
    };
    processed?: {
      requested: number;
      succeeded: number;
      failed: number;
      skippedFulfilled?: number;
    };
    items?: unknown[];
  }>(`/api/v1/admin/ai-questioning/topics/${topicId}/actions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function runAdminAIQuestioningTopicBulkAction(payload: { action: 'ensure_blueprint' | 'generate_candidates' | 'expand_candidates'; topicIds: number[]; subject?: string; limit?: number; force?: boolean; processInBackground?: boolean; perBlueprint?: number; count?: number }) {
  return authRequest<{
    action: string;
    requested: number;
    succeeded: number;
    failed: number;
    enqueued: number;
    skipped: number;
    created: number;
    blocked?: number;
    message?: string;
    repairFirst?: {
      handled: number;
      approved: number;
      repaired: number;
      regenerated: number;
      skipped: number;
      waiting?: number;
    };
    processInBackground: boolean;
    background: { started: boolean; reason: string };
    items: unknown[];
    errors: Array<{ topicId: number; message: string }>;
  }>('/api/v1/admin/ai-questioning/topics/bulk-actions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function generateAdminAIQuestioningCandidate(blueprintId: number, payload: { force?: boolean } = {}) {
  return authRequest<{ question: AdminAIQuestioningQuestion; review: AdminAIQuestioningReview; generation?: unknown }>(`/api/v1/admin/ai-questioning/blueprints/${blueprintId}/generate`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function generateAdminAIQuestioningBatch(payload: { subject?: string; limit?: number; force?: boolean } = {}) {
  return authRequest<{ generated: number; items: Array<{ question: AdminAIQuestioningQuestion; review: AdminAIQuestioningReview; generation?: unknown }> }>('/api/v1/admin/ai-questioning/blueprints/generate-batch', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningSourceDocuments(params: { subject?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningSourceDocument[] }>(`/api/v1/admin/ai-questioning/source-documents${toQueryString(params)}`);
}

export function getAdminAIQuestioningSourceReferenceSummary(params: { subject?: string; syllabusVersion?: string; refresh?: boolean; bypassCache?: boolean } = {}) {
  return authRequest<AdminAIQuestioningSourceReferenceSummary>(`/api/v1/admin/ai-questioning/source-references/summary${toQueryString(params)}`);
}

export function importAdminAIQuestioningSourceDocument(payload: {
  document: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
}) {
  return authRequest<{
    document: AdminAIQuestioningSourceDocument;
    createdQuestions: number;
    needsReview: number;
    autoProfileTask?: AdminAIQuestioningSourceAutoProfileTask | null;
    autoProfileTaskError?: string | null;
    questions: AdminAIQuestioningSourceQuestion[];
  }>('/api/v1/admin/ai-questioning/source-documents/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function startAdminAIQuestioningSourceProfilePipelineRebuild(payload: {
  subject: string;
  syllabusVersion?: string;
  forceNewTask?: boolean;
}) {
  return authRequest<{
    task: AdminAIQuestioningSourceProfilePipelineTask | null;
    skipped?: string | null;
  }>('/api/v1/admin/ai-questioning/source-profile-pipeline/rebuild', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningSourceDocumentProfileVisualization(documentId: number) {
  return authRequest<AdminAIQuestioningSourceDocumentProfileVisualization>(
    `/api/v1/admin/ai-questioning/source-documents/${documentId}/profile-visualization`
  );
}

export function reprocessAdminAIQuestioningSourceDocument(documentId: number, payload: { syllabusVersion?: string; includeRejected?: boolean } = {}) {
  return authRequest<{
    document: AdminAIQuestioningSourceDocument;
    resetQuestions: number;
    autoProfileTask: AdminAIQuestioningSourceAutoProfileTask | null;
  }>(`/api/v1/admin/ai-questioning/source-documents/${documentId}/reprocess`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminAIQuestioningSourceDocument(documentId: number) {
  return authRequest<{
    document: AdminAIQuestioningSourceDocument;
    cleanup: AdminAIQuestioningSourceDocumentCleanupResult;
  }>(`/api/v1/admin/ai-questioning/source-documents/${documentId}`, {
    method: 'DELETE'
  });
}

export function cleanupAdminAIQuestioningSourceDocuments(payload: {
  subject: string;
  sourceType?: string;
  dryRun?: boolean;
  confirmText?: string;
}) {
  return authRequest<{
    subject: string;
    sourceType: string;
    dryRun: boolean;
    expectedConfirmText: string;
    selected?: AdminAIQuestioningSourceDocumentCleanupResult;
    cleanup?: AdminAIQuestioningSourceDocumentCleanupResult;
  }>('/api/v1/admin/ai-questioning/source-documents/cleanup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningSourceQuestions(params: { subject?: string; documentId?: number; topicId?: number; reviewStatus?: string; autoProfileStatus?: string; limit?: number; offset?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningSourceQuestion[]; total: number; limit: number; offset: number }>(`/api/v1/admin/ai-questioning/source-questions${toQueryString(params)}`);
}

export function listAdminAIQuestioningTopicOptions(params: { subject?: string; status?: string; syllabusVersion?: string; search?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningTopicOption[] }>(`/api/v1/admin/ai-questioning/topic-options${toQueryString(params)}`);
}

export function reviewAdminAIQuestioningSourceQuestion(questionId: number, payload: {
  reviewStatus?: 'needs_review' | 'parsed' | 'mapped' | 'approved' | 'rejected';
  topicId?: number | null;
  topicCodes?: string[];
  analysisStatus?: string;
  analysisConfidence?: number;
  analysisIssues?: string[];
} = {}) {
  return authRequest<{ question: AdminAIQuestioningSourceQuestion }>(`/api/v1/admin/ai-questioning/source-questions/${questionId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function bulkReviewAdminAIQuestioningSourceQuestions(payload: {
  ids: number[];
  review: {
    reviewStatus?: 'needs_review' | 'parsed' | 'mapped' | 'approved' | 'rejected';
    analysisStatus?: string;
    analysisConfidence?: number;
    analysisIssues?: string[];
  };
}) {
  return authRequest<{
    requested: number;
    succeeded: number;
    failed: number;
    results: Array<{ id: number; status: 'success' | 'failed'; question?: AdminAIQuestioningSourceQuestion; error?: string }>;
  }>('/api/v1/admin/ai-questioning/source-questions/bulk-review', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function suggestAdminAIQuestioningSourceQuestionTopics(payload: {
  ids?: number[];
  subject?: string;
  documentId?: number | null;
  reviewStatus?: string;
  onlyUnmapped?: boolean;
  limit?: number;
}) {
  return authRequest<{
    requested: number;
    succeeded: number;
    failed: number;
    results: Array<{ id: number; status: 'success' | 'failed'; question?: AdminAIQuestioningSourceQuestion; suggestions?: unknown[]; error?: string }>;
  }>('/api/v1/admin/ai-questioning/source-questions/topic-suggestions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyAdminAIQuestioningSourceQuestionTopicSuggestions(payload: {
  ids?: number[];
  subject?: string;
  documentId?: number | null;
  reviewStatus?: string;
  onlyUnmapped?: boolean;
  minConfidence?: number;
  approveAfterApply?: boolean;
  limit?: number;
}) {
  return authRequest<{
    requested: number;
    succeeded: number;
    skipped: number;
    failed: number;
    results: Array<{ id: number; status: 'success' | 'skipped' | 'failed'; question?: AdminAIQuestioningSourceQuestion; error?: string }>;
  }>('/api/v1/admin/ai-questioning/source-questions/apply-topic-suggestions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningSourceTopicTasks(params: { subject?: string; action?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningSourceTopicTask[] }>(`/api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks${toQueryString(params)}`);
}

export function getAdminAIQuestioningSourceTopicTask(taskId: string) {
  return authRequest<{ task: AdminAIQuestioningSourceTopicTask }>(`/api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks/${encodeURIComponent(taskId)}`);
}

export function startAdminAIQuestioningSourceTopicTask(payload: {
  action: 'suggest_filtered' | 'apply_high_confidence' | 'auto_map_profile';
  subject: string;
  documentId?: number | null;
  reviewStatus?: string;
  onlyUnmapped?: boolean;
  minConfidence?: number;
  approveAfterApply?: boolean;
  limit?: number;
  applyLimit?: number;
}) {
  return authRequest<{ task: AdminAIQuestioningSourceTopicTask }>('/api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningSourceAutoProfileTasks(params: { subject?: string; action?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningSourceAutoProfileTask[] }>(`/api/v1/admin/ai-questioning/source-questions/auto-profile-tasks${toQueryString(params)}`);
}

export function getAdminAIQuestioningSourceAutoProfileTask(taskId: string) {
  return authRequest<{ task: AdminAIQuestioningSourceAutoProfileTask }>(`/api/v1/admin/ai-questioning/source-questions/auto-profile-tasks/${encodeURIComponent(taskId)}`);
}

export function startAdminAIQuestioningSourceAutoProfileTask(payload: {
  action: 'auto_profile_filtered' | 'retry_failed_samples';
  subject: string;
  documentId?: number | null;
  syllabusVersion?: string;
  limit?: number;
  minConfidence?: number;
  minConfidenceGap?: number;
  maxAttempts?: number;
  autoRefreshStyleProfile?: boolean;
  autoRetry?: boolean;
}) {
  return authRequest<{ task: AdminAIQuestioningSourceAutoProfileTask }>('/api/v1/admin/ai-questioning/source-questions/auto-profile-tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningStyleProfiles(params: { subject?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningStyleProfile[] }>(`/api/v1/admin/ai-questioning/style-profiles${toQueryString(params)}`);
}

export function generateAdminAIQuestioningStyleProfile(payload: {
  subject: string;
  syllabusVersion?: string;
  scopeType?: 'subject' | 'module' | 'topic';
  scopeId?: number;
}) {
  return authRequest<{ profile: AdminAIQuestioningStyleProfile }>('/api/v1/admin/ai-questioning/style-profiles/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningExamSeriesProfiles(params: { subject?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningExamSeriesProfile[] }>(`/api/v1/admin/ai-questioning/exam-series-profiles${toQueryString(params)}`);
}

export function generateAdminAIQuestioningExamSeriesProfile(payload: {
  subject: string;
  syllabusVersion?: string;
  title?: string;
  sourceDocumentIds?: number[];
  includeUnconfirmed?: boolean;
}) {
  return authRequest<{ profile: AdminAIQuestioningExamSeriesProfile }>('/api/v1/admin/ai-questioning/exam-series-profiles/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function activateAdminAIQuestioningExamSeriesProfile(id: number) {
  return authRequest<{ profile: AdminAIQuestioningExamSeriesProfile }>(`/api/v1/admin/ai-questioning/exam-series-profiles/${id}/activate`, {
    method: 'POST'
  });
}

export function listAdminAIQuestioningGenerationProfiles(params: { subject?: string; status?: string; useCase?: 'subject_practice' | 'online_mock_exam'; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningGenerationProfile[] }>(`/api/v1/admin/ai-questioning/generation-profiles${toQueryString(params)}`);
}

export function generateAdminAIQuestioningGenerationProfile(payload: {
  subject: string;
  syllabusVersion?: string;
  useCase?: 'subject_practice' | 'online_mock_exam';
  title?: string;
  seriesProfileId?: number;
  sourceStyleProfileId?: number;
}) {
  return authRequest<{
    profile: AdminAIQuestioningGenerationProfile;
    versionGovernance?: { updated?: number; summary?: Record<string, number>; error?: string };
  }>('/api/v1/admin/ai-questioning/generation-profiles/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function activateAdminAIQuestioningGenerationProfile(id: number) {
  return authRequest<{
    profile: AdminAIQuestioningGenerationProfile;
    versionGovernance?: { updated?: number; summary?: Record<string, number>; error?: string };
  }>(`/api/v1/admin/ai-questioning/generation-profiles/${id}/activate`, {
    method: 'POST'
  });
}

export function listAdminAIQuestioningGenerationJobs(params: { subject?: string; status?: string; blueprintId?: number; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningGenerationJob[] }>(`/api/v1/admin/ai-questioning/generation-jobs${toQueryString(params)}`);
}

export function getAdminAIQuestioningGenerationQueueHealth(params: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam'; limit?: number; autoRecover?: boolean } = {}) {
  return authRequest<AdminAIQuestioningGenerationQueueHealth>(`/api/v1/admin/ai-questioning/generation-jobs/health${toQueryString(params)}`);
}

export function enqueueAdminAIQuestioningGenerationJobs(payload: { subject?: string; topicId?: number; blueprintIds?: number[]; limit?: number; force?: boolean } = {}) {
  return authRequest<{ requested: number; enqueued: number; skipped: number; items: AdminAIQuestioningGenerationJob[] }>('/api/v1/admin/ai-questioning/generation-jobs/enqueue', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function processAdminAIQuestioningGenerationJobs(payload: { limit?: number; retryFailed?: boolean; force?: boolean; jobIds?: number[]; useCase?: 'subject_practice' | 'online_mock_exam' } = {}) {
  return authRequest<{ requested: number; succeeded: number; failed: number; items: AdminAIQuestioningGenerationJob[]; errors: Array<{ id: number; message: string }> }>('/api/v1/admin/ai-questioning/generation-jobs/process', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function bulkAdminAIQuestioningGenerationJobs(payload: {
  action: 'retry_failed' | 'process_queue' | 'archive_failed' | 'archive_legacy_queued' | 'archive_legacy_failed' | 'archive_legacy_mock_failed';
  subject?: string;
  useCase?: 'subject_practice' | 'online_mock_exam';
  failureCategory?: string;
  jobIds?: number[];
  limit?: number;
}) {
  return authRequest<{
    action: string;
    requested: number;
    succeeded: number;
    failed: number;
    filters: Record<string, unknown>;
    items: AdminAIQuestioningGenerationJob[];
    errors: Array<{ id: number; message: string }>;
  }>('/api/v1/admin/ai-questioning/generation-jobs/bulk', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function runAdminAIQuestioningPregeneration(payload: { subject?: string; topicId?: number; limit?: number; perTopic?: number; force?: boolean; retryFailed?: boolean } = {}) {
  return authRequest<AdminAIQuestioningPregenerationResult>('/api/v1/admin/ai-questioning/pregeneration/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function retryAdminAIQuestioningGenerationJob(jobId: number) {
  return authRequest<AdminAIQuestioningGenerationJob>(`/api/v1/admin/ai-questioning/generation-jobs/${jobId}/retry`, {
    method: 'POST'
  });
}

export function pauseAdminAIQuestioningBlueprint(blueprintId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningBlueprint>(`/api/v1/admin/ai-questioning/blueprints/${blueprintId}/pause`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function resumeAdminAIQuestioningBlueprint(blueprintId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningBlueprint>(`/api/v1/admin/ai-questioning/blueprints/${blueprintId}/resume`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function confirmAdminAIQuestioningBlueprintSyllabus(blueprintId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningBlueprint>(`/api/v1/admin/ai-questioning/blueprints/${blueprintId}/confirm-syllabus`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningQuestions(params: { subject?: string; status?: string; syllabusStatus?: string; topicId?: number; queue?: 'candidate'; useCase?: 'subject_practice' | 'online_mock_exam'; mockExamBlueprintId?: number; mockExamSourcePaperId?: number; view?: 'list' | 'full'; summary?: boolean; limit?: number; offset?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningQuestion[]; total: number; limit: number; offset: number }>(`/api/v1/admin/ai-questioning/questions${toQueryString(params)}`);
}

export function getAdminAIQuestioningQuestion(questionId: number) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/questions/${questionId}`);
}

export function getAdminAIQuestioningQuestionLedger(params: { subject?: string; status?: string; versionStatus?: string; topicId?: number; useCase?: 'subject_practice' | 'online_mock_exam'; mockExamBlueprintId?: number; mockExamSourcePaperId?: number; readyOnly?: boolean; view?: 'list' | 'full'; summary?: boolean; limit?: number; offset?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningQuestionLedgerItem[]; total: number; limit: number; offset: number }>(`/api/v1/admin/ai-questioning/question-ledger${toQueryString(params)}`);
}

export function refreshAdminAIQuestioningQuestionVersionGovernance(payload: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam'; limit?: number; dryRun?: boolean } = {}) {
  return authRequest<{
    dryRun: boolean;
    subject: string | null;
    useCase: string | null;
    scanned: number;
    updated: number;
    summary: Record<string, number>;
    items: Array<{ questionId: number; subject: string; useCase: string; status: string; reason: string }>;
  }>('/api/v1/admin/ai-questioning/question-version-governance/refresh', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningQuestionAgentRuns(questionId: number) {
  return authRequest<{ questionId: number; items: AdminAIQuestioningAgentRun[] }>(`/api/v1/admin/ai-questioning/questions/${questionId}/agent-runs`);
}

export type AdminAIQuestioningDeleteQuestionResult = {
  questionId: number;
  targetUseCase: 'ai_generated_question';
  publishedPracticeQuestionIds: number[];
  deleted: {
    generatedQuestions: number;
    aiGenerationJobs: number;
    questionExposures: number;
    topicMappings: number;
    publishedPracticeQuestions: number;
  };
};

export function deleteAdminAIQuestioningGeneratedQuestion(questionId: number) {
  return authRequest<AdminAIQuestioningDeleteQuestionResult>(`/api/v1/admin/ai-questioning/questions/${questionId}`, {
    method: 'DELETE'
  });
}

export function bulkAdminAIQuestioningQuestions(payload: { action: 'review' | 'approve' | 'reject' | 'archive'; subject?: string; status?: string; queue?: 'candidate'; useCase?: 'subject_practice' | 'online_mock_exam'; mockExamBlueprintId?: number; mockExamSourcePaperId?: number; gateScope?: 'gate_passed' | 'include_human_review'; limit?: number; questionIds?: number[]; reason?: string }) {
  return authRequest<{ action: string; requested: number; succeeded: number; failed: number; items: AdminAIQuestioningQuestion[]; errors: Array<{ id: number; message: string }> }>('/api/v1/admin/ai-questioning/questions/bulk', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type AdminAIQuestioningCleanupResult = {
  targetUseCase: 'subject_practice';
  subject: string;
  topicId: number | null;
  expectedConfirmText: string;
  selected?: {
    questionIds: number[];
    jobIds: number[];
    publishedPracticeQuestionIds: number[];
  };
  deleted: {
    candidateQuestions: number;
    approvedAiQuestions: number;
    publishedPracticeQuestions: number;
    aiGenerationJobs: number;
    topicMappings: number;
    questionExposures: number;
    deletedQuestions?: number;
  };
  dryRun?: boolean;
};

export function cleanupAdminAIQuestioningSubjectPracticeScope(payload: {
  subject: string;
  topicId?: number;
  includeCandidates?: boolean;
  includeJobs?: boolean;
  includeApprovedAssets?: boolean;
  dryRun?: boolean;
  confirmText?: string;
}) {
  return authRequest<AdminAIQuestioningCleanupResult>('/api/v1/admin/ai-questioning/cleanup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listAdminAIQuestioningCandidateBulkTasks(params: { subject?: string; action?: string; taskStatus?: string; useCase?: 'subject_practice' | 'online_mock_exam'; mockExamBlueprintId?: number; mockExamSourcePaperId?: number; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningCandidateBulkTask[] }>(`/api/v1/admin/ai-questioning/questions/bulk-tasks${toQueryString(params)}`);
}

export function getAdminAIQuestioningCandidateBulkTask(taskId: string) {
  return authRequest<{ task: AdminAIQuestioningCandidateBulkTask }>(`/api/v1/admin/ai-questioning/questions/bulk-tasks/${encodeURIComponent(taskId)}`);
}

export function startAdminAIQuestioningCandidateBulkTask(payload: {
  action: 'review' | 'approve' | 'reject' | 'archive';
  subject?: string;
  status?: string;
  queue?: 'candidate';
  useCase?: 'subject_practice' | 'online_mock_exam';
  mockExamBlueprintId?: number;
  mockExamSourcePaperId?: number;
  gateScope?: 'gate_passed' | 'include_human_review';
  limit?: number;
  expectedTotal?: number;
  questionIds?: number[];
  reason?: string;
}) {
  return authRequest<{ task: AdminAIQuestioningCandidateBulkTask }>('/api/v1/admin/ai-questioning/questions/bulk-tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningSyllabusGovernance(params: { subject?: string } = {}) {
  return authRequest<AdminAIQuestioningSyllabusGovernance>(`/api/v1/admin/ai-questioning/syllabus-governance${toQueryString(params)}`);
}

export function refreshAdminAIQuestioningSyllabusGovernance(payload: { subject?: string } = {}) {
  return authRequest<{ refreshed: number; items: Array<{ id: number }> }>('/api/v1/admin/ai-questioning/syllabus-governance/refresh', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function confirmAdminAIQuestioningSyllabusQuestion(questionId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/syllabus-governance/questions/${questionId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function previewAdminAIQuestioningSyllabusJsonImport(payload: Record<string, unknown>) {
  return authRequest<AdminAIQuestioningSyllabusJsonImportPreview>('/api/v1/admin/ai-questioning/syllabus-imports/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningSyllabusJsonTemplate(params: { subject?: string } = {}) {
  return authRequest<Record<string, unknown>>(`/api/v1/admin/ai-questioning/syllabus-imports/template${toQueryString(params)}`);
}

export function listAdminAIQuestioningSyllabusJsonImports(params: { subject?: string; status?: string; limit?: number } = {}) {
  return authRequest<{ items: AdminAIQuestioningSyllabusJsonImport[] }>(`/api/v1/admin/ai-questioning/syllabus-imports${toQueryString(params)}`);
}

export function createAdminAIQuestioningSyllabusJsonImport(payload: Record<string, unknown>) {
  return authRequest<{ import: AdminAIQuestioningSyllabusJsonImport; preview: AdminAIQuestioningSyllabusJsonImportPreview }>('/api/v1/admin/ai-questioning/syllabus-imports', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningSyllabusJsonImport(importId: number) {
  return authRequest<AdminAIQuestioningSyllabusJsonImport>(`/api/v1/admin/ai-questioning/syllabus-imports/${importId}`);
}

export function applyAdminAIQuestioningSyllabusJsonImport(importId: number, payload: { missingTopicAction?: 'keep' | 'draft' | 'archive' } = {}) {
  return authRequest<AdminAIQuestioningSyllabusJsonImportApplyResult>(`/api/v1/admin/ai-questioning/syllabus-imports/${importId}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminAIQuestioningSyllabusJsonImportRecoveryDraft(importId: number) {
  return authRequest<{ import: AdminAIQuestioningSyllabusJsonImport; preview: AdminAIQuestioningSyllabusJsonImportPreview }>(`/api/v1/admin/ai-questioning/syllabus-imports/${importId}/recovery-draft`, {
    method: 'POST'
  });
}

export function createAdminAIQuestioningSyllabusJsonImportReversePlan(importId: number) {
  return authRequest<AdminAIQuestioningSyllabusReversePlanResult>(`/api/v1/admin/ai-questioning/syllabus-imports/${importId}/reverse-plan`, {
    method: 'POST'
  });
}

export function archiveAdminAIQuestioningSyllabusJsonImport(importId: number) {
  return authRequest<AdminAIQuestioningSyllabusJsonImport>(`/api/v1/admin/ai-questioning/syllabus-imports/${importId}/archive`, {
    method: 'POST'
  });
}

export type AdminAIQuestioningSyllabusTopicUpdatePayload = {
  syllabusVersion?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  status?: string;
};

export type AdminAIQuestioningSyllabusBulkUpdatePayload = AdminAIQuestioningSyllabusTopicUpdatePayload & {
  topicIds?: number[];
  topics?: Array<AdminAIQuestioningSyllabusTopicUpdatePayload & { topicId: number }>;
};

export function previewAdminAIQuestioningSyllabusTopicUpdate(topicId: number, payload: AdminAIQuestioningSyllabusTopicUpdatePayload) {
  return authRequest<AdminAIQuestioningSyllabusTopicUpdatePreview>(`/api/v1/admin/ai-questioning/syllabus-governance/topics/${topicId}/preview`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyAdminAIQuestioningSyllabusTopicUpdate(topicId: number, payload: AdminAIQuestioningSyllabusTopicUpdatePayload) {
  return authRequest<AdminAIQuestioningSyllabusTopicUpdatePreview>(`/api/v1/admin/ai-questioning/syllabus-governance/topics/${topicId}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function previewAdminAIQuestioningSyllabusBulkUpdate(payload: AdminAIQuestioningSyllabusBulkUpdatePayload) {
  return authRequest<AdminAIQuestioningSyllabusBulkUpdatePreview>('/api/v1/admin/ai-questioning/syllabus-governance/bulk-preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyAdminAIQuestioningSyllabusBulkUpdate(payload: AdminAIQuestioningSyllabusBulkUpdatePayload) {
  return authRequest<AdminAIQuestioningSyllabusBulkUpdatePreview>('/api/v1/admin/ai-questioning/syllabus-governance/bulk-apply', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningRemediation(params: { subject?: string } = {}) {
  return authRequest<AdminAIQuestioningRemediation>(`/api/v1/admin/ai-questioning/remediation${toQueryString(params)}`);
}

export function getAdminAIQuestioningMisconceptions(params: { subject?: string; status?: string; limit?: number } = {}) {
  return authRequest<AdminAIQuestioningMisconceptions>(`/api/v1/admin/ai-questioning/misconceptions${toQueryString(params)}`);
}

export function updateAdminAIQuestioningMisconception(misconceptionId: number, payload: { label: string; description?: string }) {
  return authRequest<AdminAIQuestioningMisconceptions['items'][number]>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function archiveAdminAIQuestioningMisconception(misconceptionId: number) {
  return authRequest<AdminAIQuestioningMisconceptions['items'][number]>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/archive`, {
    method: 'POST'
  });
}

export function restoreAdminAIQuestioningMisconception(misconceptionId: number) {
  return authRequest<AdminAIQuestioningMisconceptions['items'][number]>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/restore`, {
    method: 'POST'
  });
}

export function reviewAdminAIQuestioningMisconception(misconceptionId: number) {
  return authRequest<AdminAIQuestioningMisconceptions['items'][number]>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/needs-review`, {
    method: 'POST'
  });
}

export function mergeAdminAIQuestioningMisconception(misconceptionId: number, payload: { targetId: number; note?: string }) {
  return authRequest<{
    sourceId: number;
    target: AdminAIQuestioningMisconceptions['items'][number] | null;
    migrated: { conceptCards: number; questions: number; optionTags: number };
  }>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/merge`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminAIQuestioningConceptCardForMisconception(misconceptionId: number, payload: { title?: string; body?: string; note?: string } = {}) {
  return authRequest<{ created: boolean; item: AdminAIQuestioningRemediation['items'][number] }>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/concept-card`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminAIQuestioningVariantForMisconception(misconceptionId: number, payload: { note?: string } = {}) {
  return authRequest<{ created: boolean; blueprintId: number; questionId: number; status: string; sourceQuestionId: number }>(`/api/v1/admin/ai-questioning/misconceptions/${misconceptionId}/variant`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminAIQuestioningQuality(params: {
  subject?: string;
  useCase?: 'subject_practice' | 'online_mock_exam';
  needsReview?: boolean;
  assignedTo?: number;
  unassigned?: boolean;
  reviewReason?: string;
  recommendedAction?: string;
  severity?: string;
  limit?: number;
} = {}) {
  return authRequest<AdminAIQuestioningQualityMetric[]>(`/api/v1/admin/ai-questioning/quality${toQueryString(params)}`);
}

export function getAdminAIQuestioningQualityGovernance(params: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam' } = {}) {
  return authRequest<AdminAIQuestioningQualityGovernance>(`/api/v1/admin/ai-questioning/quality/governance${toQueryString(params)}`);
}

export function getAdminAIQuestioningQualityTrend(params: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam'; days?: number } = {}) {
  return authRequest<AdminAIQuestioningQualityTrend>(`/api/v1/admin/ai-questioning/quality/trend${toQueryString(params)}`);
}

export function refreshAdminAIQuestioningQuality(payload: { subject?: string; useCase?: 'subject_practice' | 'online_mock_exam' } = {}) {
  return authRequest<{ refreshed: number; items: AdminAIQuestioningQualityMetric[] }>('/api/v1/admin/ai-questioning/quality/refresh', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function resolveAdminAIQuestioningQuality(questionId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningQualityMetric>(`/api/v1/admin/ai-questioning/quality/${questionId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function sendAdminAIQuestioningQualityToReview(questionId: number, payload: { reason?: string } = {}) {
  return authRequest<AdminAIQuestioningQualityMetric>(`/api/v1/admin/ai-questioning/quality/${questionId}/send-to-review`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function assignAdminAIQuestioningQualityReview(questionId: number, payload: { assignedTo?: number; reason?: string; note?: string } = {}) {
  return authRequest<AdminAIQuestioningQualityMetric>(`/api/v1/admin/ai-questioning/quality/${questionId}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyAdminAIQuestioningQualityDisposition(questionId: number, payload: { disposition: 'archive' | 'manual_fix' | 'reduce_exposure' | 'regenerate'; note?: string }) {
  return authRequest<AdminAIQuestioningQualityMetric>(`/api/v1/admin/ai-questioning/quality/${questionId}/disposition`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function bulkAdminAIQuestioningQuality(payload: {
  action: 'send_to_review' | 'resolve' | 'archive' | 'manual_fix' | 'reduce_exposure' | 'regenerate';
  subject?: string;
  useCase?: 'subject_practice' | 'online_mock_exam';
  reason?: string;
  recommendedAction?: string;
  questionIds?: number[];
  limit?: number;
}) {
  return authRequest<{
    action: string;
    requested: number;
    succeeded: number;
    failed: number;
    filters: Record<string, unknown>;
    items: AdminAIQuestioningQualityMetric[];
    errors: Array<{ id: number; message: string }>;
  }>('/api/v1/admin/ai-questioning/quality/bulk', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function publishAdminAIQuestioningConceptCard(cardId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningRemediation['items'][number]>(`/api/v1/admin/ai-questioning/concept-cards/${cardId}/publish`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminAIQuestioningConceptCard(cardId: number, payload: { title: string; body: string; note?: string }) {
  return authRequest<AdminAIQuestioningRemediation['items'][number]>(`/api/v1/admin/ai-questioning/concept-cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function archiveAdminAIQuestioningConceptCard(cardId: number, payload: { note?: string } = {}) {
  return authRequest<AdminAIQuestioningRemediation['items'][number]>(`/api/v1/admin/ai-questioning/concept-cards/${cardId}/archive`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function reviewAdminAIQuestioningQuestion(questionId: number) {
  return authRequest<{ id: number; review: AdminAIQuestioningReview; status: string }>(`/api/v1/admin/ai-questioning/questions/${questionId}/review`, {
    method: 'POST'
  });
}

export function updateAdminAIQuestioningQuestion(questionId: number, payload: {
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  knowledgeTags?: string[];
  optionMetadata?: Array<{ optionId: string; distractorIntent?: string; misconceptionTags?: string[] }>;
  note?: string;
  allowHumanReview?: boolean;
}) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function approveAdminAIQuestioningQuestion(questionId: number, payload: { allowHumanReview?: boolean } = {}) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/questions/${questionId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function rejectAdminAIQuestioningQuestion(questionId: number, payload: { reason?: string } = {}) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/questions/${questionId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function archiveAdminAIQuestioningQuestion(questionId: number) {
  return authRequest<AdminAIQuestioningQuestion>(`/api/v1/admin/ai-questioning/questions/${questionId}/archive`, {
    method: 'POST'
  });
}

export function getAdminAdaptiveTrainingEventObservability(params: { days?: number; from?: string; to?: string; eventType?: string; subject?: string } = {}) {
  return authRequest<AdminTrainingEventObservability>(`/api/v1/admin/csca-special-practice/adaptive/events/observability${toQueryString(params)}`);
}

export function refreshAdminReadinessActionCalibrationSnapshots() {
  return authRequest<AdminReadinessActionCalibrationRefreshResult>('/api/v1/admin/csca-learning/readiness-action-calibration/refresh', {
    method: 'POST'
  });
}

export function getAdminReadinessEvidenceFiles() {
  return authRequest<{ items: AdminReadinessEvidenceFile[] }>('/api/v1/admin/csca-learning/readiness-evidence');
}

export function getAdminReadinessEvidenceFile(name: string) {
  return authRequest<AdminReadinessEvidenceDetail>(`/api/v1/admin/csca-learning/readiness-evidence/${encodeURIComponent(name)}`);
}

export function getAdminContentBlocks(params: { locale?: string } = {}) {
  return authRequest<{ items: AdminContentBlock[] }>(`/api/v1/admin/content/blocks${toQueryString(params)}`);
}

export function getAdminMockExamPapers() {
  return authRequest<{ items: AdminMockExamPaper[]; summary: { total: number; published: number; draft: number } }>('/api/v1/admin/mock-exam/papers');
}

export function getAdminMockExamPaper(id: number) {
  return authRequest<AdminMockExamPaperDetail>(`/api/v1/admin/mock-exam/papers/${id}`);
}

export function getAdminMockExamBlueprints(params: { subject?: string } = {}) {
  return authRequest<{ items: AdminMockExamBlueprintDetail['blueprint'][] }>(`/api/v1/admin/mock-exam/blueprints${toQueryString(params)}`);
}

export function getAdminMockExamBlueprint(id: number) {
  return authRequest<AdminMockExamBlueprintDetail>(`/api/v1/admin/mock-exam/blueprints/${id}`);
}

export function getAdminMockExamGenerationJobs(params: { blueprintId?: number; status?: string } = {}) {
  return authRequest<{ items: AdminMockExamGenerationJob[] }>(`/api/v1/admin/mock-exam/generation-jobs${toQueryString(params)}`);
}

export function createAdminMockExamBlueprintFromPaper(id: number, payload: { force?: boolean; title?: string; syllabusVersion?: string } = {}) {
  return authRequest<AdminMockExamBlueprintDetail & { created: boolean }>(`/api/v1/admin/mock-exam/papers/${id}/blueprint`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminMockExamGenerationJob(blueprintId: number, payload: { slotNumbers?: number[]; targetPaperId?: number; autoProcess?: boolean } = {}) {
  return authRequest<AdminMockExamGenerationJob>(`/api/v1/admin/mock-exam/blueprints/${blueprintId}/generation-jobs`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function processAdminMockExamGenerationJob(jobId: number, payload: { force?: boolean; background?: boolean } = {}) {
  return authRequest<AdminMockExamGenerationJob>(`/api/v1/admin/mock-exam/generation-jobs/${jobId}/process`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function assembleAdminMockExamGenerationJobDraft(jobId: number, payload: { title?: string; slug?: string; durationMinutes?: number; description?: string; priceLabel?: string } = {}) {
  return authRequest<{ job: AdminMockExamGenerationJob; paper: AdminMockExamPaper }>(`/api/v1/admin/mock-exam/generation-jobs/${jobId}/assemble-draft`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type AdminMockExamGenerationCleanupResult = {
  scope: 'single' | 'blueprint';
  deleted: {
    mockGenerationJobs: number;
    draftPapers: number;
    draftQuestions: number;
    aiGenerationJobs: number;
    aiBlueprints: number;
    candidateQuestions: number;
    topicMappings: number;
  };
  ids: {
    mockGenerationJobIds: number[];
    targetPaperIds: number[];
    candidateQuestionIds: number[];
    aiGenerationJobIds: number[];
    aiBlueprintIds: number[];
  };
};

export function cleanupAdminMockExamGenerationJob(jobId: number, payload: { force?: boolean } = {}) {
  return authRequest<AdminMockExamGenerationCleanupResult>(`/api/v1/admin/mock-exam/generation-jobs/${jobId}/cleanup`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function cleanupAdminMockExamBlueprintGenerationJobs(blueprintId: number, payload: { force?: boolean } = {}) {
  return authRequest<AdminMockExamGenerationCleanupResult>(`/api/v1/admin/mock-exam/blueprints/${blueprintId}/generation-jobs/cleanup`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminMockExamBlueprint(id: number, payload: Partial<AdminMockExamBlueprintDetail['blueprint']> & { expectedVersion?: number }) {
  return authRequest<AdminMockExamBlueprintDetail>(`/api/v1/admin/mock-exam/blueprints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function updateAdminMockExamBlueprintSlot(id: number, payload: Partial<AdminMockExamBlueprintSlot>) {
  return authRequest<AdminMockExamBlueprintSlot>(`/api/v1/admin/mock-exam/blueprint-slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function createAdminMockExamPaper(payload: Partial<AdminMockExamPaper> & { subject: string; slug: string; title: string }) {
  return authRequest<AdminMockExamPaper>('/api/v1/admin/mock-exam/papers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminMockExamPaper(id: number, payload: Partial<AdminMockExamPaper> & { expectedVersion?: number }) {
  return authRequest<AdminMockExamPaper>(`/api/v1/admin/mock-exam/papers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function publishAdminMockExamPaper(id: number, expectedVersion?: number) {
  return authRequest<AdminMockExamPaper>(`/api/v1/admin/mock-exam/papers/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function archiveAdminMockExamPaper(id: number, expectedVersion?: number) {
  return authRequest<AdminMockExamPaper>(`/api/v1/admin/mock-exam/papers/${id}/archive`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function duplicateAdminMockExamPaper(id: number) {
  return authRequest<AdminMockExamPaper>(`/api/v1/admin/mock-exam/papers/${id}/duplicate`, { method: 'POST' });
}

export function createAdminMockExamQuestion(paperId: number, payload: Partial<AdminMockExamQuestion>) {
  return authRequest<AdminMockExamQuestion>(`/api/v1/admin/mock-exam/papers/${paperId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminMockExamQuestion(questionId: number, payload: Partial<AdminMockExamQuestion> & { expectedVersion?: number }) {
  return authRequest<AdminMockExamQuestion>(`/api/v1/admin/mock-exam/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function archiveAdminMockExamQuestion(questionId: number, expectedVersion?: number) {
  return authRequest<AdminMockExamQuestion>(`/api/v1/admin/mock-exam/questions/${questionId}/archive`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function validateAdminMockExamImport(payload: unknown) {
  return authRequest<AdminMockExamImportValidation>('/api/v1/admin/mock-exam/import/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function importAdminMockExamPapers(payload: unknown) {
  return authRequest<AdminMockExamImportResult>('/api/v1/admin/mock-exam/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdminSpecialPracticeTopics() {
  return authRequest<{ items: AdminSpecialPracticeTopic[]; summary: { total: number; published: number; draft: number } }>('/api/v1/admin/special-practice/topics');
}

export function getAdminSpecialPracticeTopic(id: number) {
  return authRequest<AdminSpecialPracticeTopicDetail>(`/api/v1/admin/special-practice/topics/${id}`);
}

export function createAdminSpecialPracticeTopic(payload: Partial<AdminSpecialPracticeTopic> & { subject: string; module: string; slug: string; title: string }) {
  return authRequest<AdminSpecialPracticeTopic>('/api/v1/admin/special-practice/topics', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminSpecialPracticeTopic(id: number, payload: Partial<AdminSpecialPracticeTopic> & { expectedVersion?: number }) {
  return authRequest<AdminSpecialPracticeTopic>(`/api/v1/admin/special-practice/topics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function publishAdminSpecialPracticeTopic(id: number, expectedVersion?: number) {
  return authRequest<AdminSpecialPracticeTopic>(`/api/v1/admin/special-practice/topics/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function archiveAdminSpecialPracticeTopic(id: number, expectedVersion?: number) {
  return authRequest<AdminSpecialPracticeTopic>(`/api/v1/admin/special-practice/topics/${id}/archive`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function duplicateAdminSpecialPracticeTopic(id: number) {
  return authRequest<AdminSpecialPracticeTopic>(`/api/v1/admin/special-practice/topics/${id}/duplicate`, { method: 'POST' });
}

export function createAdminSpecialPracticeQuestion(topicId: number, payload: Partial<AdminSpecialPracticeQuestion>) {
  return authRequest<AdminSpecialPracticeQuestion>(`/api/v1/admin/special-practice/topics/${topicId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminSpecialPracticeQuestion(questionId: number, payload: Partial<AdminSpecialPracticeQuestion> & { expectedVersion?: number }) {
  return authRequest<AdminSpecialPracticeQuestion>(`/api/v1/admin/special-practice/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function archiveAdminSpecialPracticeQuestion(questionId: number, expectedVersion?: number) {
  return authRequest<AdminSpecialPracticeQuestion>(`/api/v1/admin/special-practice/questions/${questionId}/archive`, { method: 'POST', body: JSON.stringify({ expectedVersion }) });
}

export function validateAdminSpecialPracticeImport(payload: unknown) {
  return authRequest<AdminSpecialPracticeImportValidation>('/api/v1/admin/special-practice/import/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function importAdminSpecialPracticeTopics(payload: unknown) {
  return authRequest<AdminSpecialPracticeImportResult>('/api/v1/admin/special-practice/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAdminContentBlock(payload: {
  key: string;
  locale?: string;
  title: string;
  subtitle?: string;
  body: Record<string, unknown>;
  status: string;
  sortOrder: number;
}) {
  return authRequest<AdminContentBlock>('/api/v1/admin/content/blocks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminContentBlock(key: string, payload: {
  title: string;
  subtitle?: string;
  body: Record<string, unknown>;
  status: string;
  sortOrder: number;
  expectedVersion?: number;
}, params: { locale?: string } = {}) {
  return authRequest<AdminContentBlock>(`/api/v1/admin/content/blocks/${key}${toQueryString(params)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function publishAdminContentBlock(key: string, expectedVersion?: number, params: { locale?: string } = {}) {
  return authRequest<AdminContentBlock>(`/api/v1/admin/content/blocks/${key}/publish${toQueryString(params)}`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion })
  });
}

export function archiveAdminContentBlock(key: string, expectedVersion?: number, params: { locale?: string } = {}) {
  return authRequest<AdminContentBlock>(`/api/v1/admin/content/blocks/${key}${toQueryString(params)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion })
  });
}

export function getAdminUsers() {
  return authRequest<{ items: AdminUser[] }>('/api/v1/admin/users');
}

export function createAdminUser(payload: { email: string; password: string; displayName?: string }) {
  return authRequest<AdminUser>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function setAdminUserStatus(id: string, status: 'active' | 'disabled') {
  return authRequest<AdminUser>(`/api/v1/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export function grantAdminAdaptiveAIUnits(id: string, payload: { units: number; reason?: string; source?: string }) {
  return authRequest<AdminAIEntitlementGrant>(`/api/v1/admin/csca-special-practice/adaptive/ai/entitlements/${id}/grant`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
