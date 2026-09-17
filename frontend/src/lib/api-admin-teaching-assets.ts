import { requestJson } from './request';

export type AdminTeachingAssetTopic = { id: number; code: string; title: string; subject: string; syllabusVersion?: string; status?: string };
export type AdminTeachingAssetVersion = {
  id: string; version: number; status: 'draft' | 'review' | 'approved' | 'published' | 'retired'; language: 'zh-CN' | 'en' | 'vi';
  difficultyBand: string; estimatedMinutes: number; renderer: 'interactive_component'; componentKey: string; componentVersion: string;
  payloadSchemaVersion: string; payload: Record<string, unknown>; fallbackPayload: Record<string, unknown>; sourceRefs: Array<{ type: string; id: string; version: string }>;
  reviewState: string; reviewedByUserId?: number | null; reviewedAt?: string | null; publishedAt?: string | null; retiredAt?: string | null; updatedAt: string;
};
export type AdminTeachingAsset = {
  id: string; stableKey: string; type: 'micro_lesson'; subjectCode: 'math' | 'physics' | 'chemistry'; status: string; updatedAt: string;
  versions: AdminTeachingAssetVersion[];
  topics: Array<{ topicId?: number; topic: AdminTeachingAssetTopic }>;
  _count?: { exposures: number };
};
export type AdminTeachingAssetVersionInput = {
  language: 'zh-CN' | 'en' | 'vi'; difficultyBand: string; estimatedMinutes: number; renderer: 'interactive_component';
  componentKey: string; componentVersion: '1'; payloadSchemaVersion: string; payload: Record<string, unknown>;
  fallbackPayload: Record<string, unknown>; sourceRefs: Array<{ type: string; id: string; version: string }>; topicIds: number[];
};
export type TeachingAssetEffectivenessMetrics = {
  exposureContexts: number; uniqueLearners: number; completedContexts: number; skippedContexts: number; completionRate: number | null;
  sources: Record<string, number>;
  activePrompt: { attempts: number; firstAttempts: number; firstTryCorrectRate: number | null; passedContexts: number };
  independentVerification: { total: number; conclusive: number; passed: number; failed: number; inconclusive: number; passRate: number | null; phases: Array<{ phase: string; total: number; passed: number; failed: number; inconclusive: number }> };
  stability: { stable: number; notStable: number; inconclusive: number; pending: number };
  operationalSignal: { policyVersion: string; signal: 'insufficient_data' | 'healthy' | 'watch' | 'review'; reasonCodes: string[]; automaticAction: false };
};
export type AdminTeachingAssetAnalytics = {
  schemaVersion: '1'; asset: { id: string; stableKey: string; subjectCode: string };
  window: { days: number; since: string; generatedAt: string };
  aggregate: TeachingAssetEffectivenessMetrics;
  versions: Array<{ id: string; version: number; language: string; status: string; publishedAt?: string | null; metrics: TeachingAssetEffectivenessMetrics }>;
};
export type AdminTeachingAssetQualityAlert = {
  alertKey: string; fingerprint: string; signal: 'insufficient_data' | 'watch' | 'review'; severity: 'info' | 'medium' | 'high'; reasonCodes: string[];
  asset: { id: string; stableKey: string; subjectCode: string; topics: Array<{ title: string; code: string }> };
  version: { id: string; version: number; language: string; publishedAt?: string | null };
  metrics: TeachingAssetEffectivenessMetrics;
  comparison: { versionId: string; version: number; verificationPassRate: number | null; firstTryCorrectRate: number | null; regression: boolean } | null;
  workflow: { status: 'open' | 'acknowledged' | 'resolved'; reason: string; actorId: number | null; updatedAt: string | null };
};
export type AdminTeachingAssetQualityQueue = { schemaVersion: '1'; policyVersion: string; windowDays: number; summary: { total: number; open: number; acknowledged: number; resolved: number; review: number; watch: number; insufficientData: number }; items: AdminTeachingAssetQualityAlert[] };
export type AdminTeachingAssetRoutingDiagnostics = {
  schemaVersion: '1'; policyVersion: string; currentMode: 'legacy' | 'shadow' | 'active';
  rollout: { subjects: string[]; percent: number };
  window: { days: number; since: string; generatedAt: string };
  gate: { qualified: boolean; minimumDecisions: number; reasonCodes: string[]; automaticActivation: false };
  metrics: { decisions: number; coverageRate: number | null; fallbackRate: number | null; divergenceRate: number | null; explorationRate: number | null; alternateAfterIneffectiveCount: number; p95LatencyMs: number | null; modes: Record<string, number> };
  subjects: Array<{ subject: string; decisions: number; coverageRate: number | null; divergenceRate: number | null }>;
  learningOutcomes: {
    schemaVersion: '1'; observations: number; policyVersion: string; evidenceQualified: boolean;
    cohorts: Record<'baseline' | 'active', { deliveries: number; completedDeliveries: number; completionRate: number | null; independentVerifications: number; conclusiveVerifications: number; verificationPassRate: number | null; stabilityAssessments: number; stableCount: number; notStableCount: number; stableRate: number | null }>;
    comparison: { verificationPassRateDelta: number | null; stableRateDelta: number | null; completionRateDelta: number | null; consecutiveActiveImmediateFailures: number };
    circuit: { status: 'monitoring' | 'healthy' | 'tripped'; reasonCodes: string[] };
    circuitStates: Record<string, { status: 'monitoring' | 'tripped'; reasonCodes: string[]; evaluatedAt: string | null; manualReset: boolean }>;
  };
  recent: Array<{ studentRef: string; subject: string | null; contextType: string; contextKey: string; routingMode: string; legacyVersionId: string | null; personalizedVersionId: string | null; servedVersionId: string | null; diverged: boolean; personalizedFallback: boolean; boundedExploration: boolean; reasonCodes: string[]; latencyMs: number | null; createdAt: string }>;
};

export function listAdminTeachingAssets(filters: { subject?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.subject) query.set('subject', filters.subject);
  if (filters.status) query.set('status', filters.status);
  return requestJson<{ schemaVersion: '1'; items: AdminTeachingAsset[]; topics: AdminTeachingAssetTopic[]; componentKeys: string[] }>(`/api/v1/admin/teaching-assets${query.size ? `?${query}` : ''}`, { withAuth: true });
}
export function getAdminTeachingAsset(id: string) { return requestJson<{ schemaVersion: '1'; item: AdminTeachingAsset }>(`/api/v1/admin/teaching-assets/${encodeURIComponent(id)}`, { withAuth: true }); }
export function getAdminTeachingAssetAnalytics(id: string, days = 30) { return requestJson<AdminTeachingAssetAnalytics>(`/api/v1/admin/teaching-assets/${encodeURIComponent(id)}/analytics?days=${days}`, { withAuth: true }); }
export function listAdminTeachingAssetQualityAlerts(days = 30) { return requestJson<AdminTeachingAssetQualityQueue>(`/api/v1/admin/teaching-assets/quality-alerts?days=${days}`, { withAuth: true }); }
export function getAdminTeachingAssetRoutingDiagnostics(days = 30) { return requestJson<AdminTeachingAssetRoutingDiagnostics>(`/api/v1/admin/teaching-assets/routing-diagnostics?days=${days}`, { withAuth: true }); }
export function resetAdminTeachingAssetRoutingCircuit(subject: 'math' | 'physics' | 'chemistry', reason: string) { return requestJson<AdminTeachingAssetRoutingDiagnostics>(`/api/v1/admin/teaching-assets/routing-circuit/${subject}/reset`, { method: 'POST', withAuth: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); }
export function actOnAdminTeachingAssetQualityAlert(alertKey: string, action: 'acknowledge' | 'resolve' | 'reopen', reason: string) { return requestJson<AdminTeachingAssetQualityQueue>(`/api/v1/admin/teaching-assets/quality-alerts/${encodeURIComponent(alertKey)}/actions`, { method: 'POST', withAuth: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) }); }
export function createAdminTeachingAsset(input: AdminTeachingAssetVersionInput & { stableKey: string; type: 'micro_lesson'; subjectCode: 'math' | 'physics' | 'chemistry' }) {
  return requestJson<{ schemaVersion: '1'; item: AdminTeachingAsset }>('/api/v1/admin/teaching-assets', { method: 'POST', withAuth: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}
export function updateAdminTeachingAssetVersion(id: string, input: AdminTeachingAssetVersionInput) {
  return requestJson<{ schemaVersion: '1'; item: AdminTeachingAsset }>(`/api/v1/admin/teaching-assets/versions/${encodeURIComponent(id)}`, { method: 'PATCH', withAuth: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}
export function createAdminTeachingAssetVersion(id: string) {
  return requestJson<{ schemaVersion: '1'; item: AdminTeachingAsset }>(`/api/v1/admin/teaching-assets/${encodeURIComponent(id)}/versions`, { method: 'POST', withAuth: true });
}
export function transitionAdminTeachingAssetVersion(id: string, action: 'submit' | 'approve' | 'return' | 'publish' | 'retire') {
  return requestJson<{ schemaVersion: '1'; item: AdminTeachingAsset }>(`/api/v1/admin/teaching-assets/versions/${encodeURIComponent(id)}/${action}`, { method: 'POST', withAuth: true });
}
