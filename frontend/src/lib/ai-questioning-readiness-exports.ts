import type { AdminAIQuestioningOperationalReadiness } from './api-types';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonCell(value: unknown) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

function readinessScope(readiness: AdminAIQuestioningOperationalReadiness) {
  const subject = readiness.subject?.trim() || 'all-subjects';
  const useCase = readiness.useCase?.trim();
  return useCase ? `${useCase}:${subject}` : subject;
}

export function aiQuestioningReadinessCsv(readiness: AdminAIQuestioningOperationalReadiness) {
  const rows = [
    ['section', 'key', 'status', 'count', 'action', 'details'],
    [
      'summary',
      readinessScope(readiness),
      readiness.status,
      readiness.score,
      readiness.nextAction,
      jsonCell({
        generatedAt: readiness.generatedAt,
        subject: readiness.subject,
        useCase: readiness.useCase,
        blockers: readiness.blockers.length,
        warnings: readiness.warnings.length
      })
    ],
    ...(readiness.latestAuditEvent ? [[
      'audit',
      'latest',
      readiness.status,
      '',
      readiness.latestAuditEvent.action,
      jsonCell({
        actorId: readiness.latestAuditEvent.actorId,
        actorEmail: readiness.latestAuditEvent.actorEmail,
        module: readiness.latestAuditEvent.module,
        resourceType: readiness.latestAuditEvent.resourceType,
        resourceId: readiness.latestAuditEvent.resourceId,
        createdAt: readiness.latestAuditEvent.createdAt
      })
    ]] : []),
    ...readiness.blockers.map((item) => [
      'blocker',
      item.key,
      readiness.status,
      item.count,
      item.action,
      ''
    ]),
    ...readiness.warnings.map((item) => [
      'warning',
      item.key,
      readiness.status,
      item.count,
      item.action,
      ''
    ]),
    ...Object.entries(readiness.dimensions).map(([key, value]) => [
      'dimension',
      key,
      typeof value === 'object' && value && 'status' in value ? String(value.status) : '',
      '',
      typeof value === 'object' && value && 'recommendedAction' in value ? String(value.recommendedAction) : '',
      jsonCell(value)
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function aiQuestioningReadinessJson(readiness: AdminAIQuestioningOperationalReadiness) {
  return JSON.stringify({
    reportType: 'ai-questioning-operational-readiness',
    exportedAt: new Date().toISOString(),
    readiness
  }, null, 2);
}

export function aiQuestioningReadinessFilename(
  readiness: AdminAIQuestioningOperationalReadiness,
  extension: 'csv' | 'json'
) {
  const scope = readinessScope(readiness).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const day = new Date().toISOString().slice(0, 10);
  return `ai-questioning-readiness-${scope}-${day}.${extension}`;
}

const READINESS_ACTION_TARGETS: Record<string, string> = {
  monitor: 'admin-ai-questioning-workflow',
  retry_or_clear_generation_queue: 'admin-ai-questioning-generation-governance',
  retry_failed: 'admin-ai-questioning-generation-governance',
  inspect_generation_queue: 'admin-ai-questioning-generation-governance',
  refresh_syllabus_governance: 'admin-ai-questioning-syllabus-tools',
  review_syllabus_pending_questions: 'admin-ai-questioning-syllabus-governance',
  assign_or_resolve_quality_reviews: 'admin-ai-questioning-quality-governance',
  review_quality_governance: 'admin-ai-questioning-quality-governance',
  ensure_blueprint_coverage: 'admin-ai-questioning-primary-actions',
  run_pregeneration: 'admin-ai-questioning-primary-actions',
  review_candidate_questions: 'admin-ai-questioning-candidates'
};

export function aiQuestioningReadinessActionTarget(action: string) {
  return READINESS_ACTION_TARGETS[action] ?? 'admin-audit-questioning';
}
