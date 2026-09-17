import type { AdminAIQuestioningSyllabusJsonImportPreview } from './api-types';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonCell(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

export function syllabusImportMigrationRows(preview: AdminAIQuestioningSyllabusJsonImportPreview) {
  return preview.items
    .filter((item) => item.matchedBy === 'previous_code' && item.previousCode)
    .map((item) => ({
      previousCode: item.previousCode ?? '',
      nextCode: item.code,
      existingTopicId: item.existingTopicId,
      titleBefore: String(item.before?.title ?? ''),
      titleAfter: String(item.after.title ?? ''),
      affectedQuestionCount: item.affectedQuestionCount,
      approvedQuestionsBecomingPendingReview: item.approvedQuestionsBecomingPendingReview
    }));
}

export function syllabusImportAppliedMigrationRows(preview: AdminAIQuestioningSyllabusJsonImportPreview | unknown) {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return [];
  const apply = (preview as { apply?: unknown }).apply;
  if (!apply || typeof apply !== 'object' || Array.isArray(apply)) return [];
  const migrations = (apply as { migrations?: unknown }).migrations;
  if (!Array.isArray(migrations)) return [];
  return migrations.map((item) => {
    const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return {
      previousCode: String(record.previousCode ?? ''),
      nextCode: String(record.nextCode ?? ''),
      existingTopicId: typeof record.existingTopicId === 'number' ? record.existingTopicId : null,
      titleBefore: String(record.titleBefore ?? ''),
      titleAfter: String(record.titleAfter ?? ''),
      affectedQuestionCount: Number(record.affectedQuestionCount ?? 0) || 0,
      approvedQuestionsBecomingPendingReview: Number(record.approvedQuestionsBecomingPendingReview ?? 0) || 0
    };
  }).filter((item) => item.previousCode && item.nextCode);
}

export function syllabusImportRecoverySummary(preview: AdminAIQuestioningSyllabusJsonImportPreview | unknown) {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return null;
  const recovery = (preview as { recovery?: unknown }).recovery;
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) return null;
  const record = recovery as Record<string, unknown>;
  const sourceImportId = Number(record.sourceImportId ?? 0) || 0;
  if (!sourceImportId) return null;
  return {
    sourceImportId,
    sourceImportStatus: String(record.sourceImportStatus ?? ''),
    createdAt: String(record.createdAt ?? ''),
    createdBy: typeof record.createdBy === 'number' ? record.createdBy : null
  };
}

export function syllabusImportPreviewCsv(preview: AdminAIQuestioningSyllabusJsonImportPreview) {
  const rows = [
    ['section', 'code', 'action', 'matchedBy', 'previousCode', 'existingTopicId', 'titleBefore', 'titleAfter', 'statusBefore', 'statusAfter', 'affectedQuestionCount', 'approvedToReview', 'details'],
    ...preview.items.map((item) => [
      'incoming',
      item.code,
      item.action,
      item.matchedBy ?? '',
      item.previousCode ?? '',
      item.existingTopicId ?? '',
      item.before?.title ?? '',
      item.after.title ?? '',
      item.before?.status ?? '',
      item.after.status ?? '',
      item.affectedQuestionCount,
      item.approvedQuestionsBecomingPendingReview,
      jsonCell({ before: item.before, after: item.after })
    ]),
    ...preview.missingFromFile.map((item) => [
      'missing_from_file',
      item.code,
      'missing',
      '',
      '',
      item.id,
      item.title,
      '',
      item.status,
      '',
      item.questionCount,
      item.approvedQuestionCount,
      ''
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function syllabusImportPreviewReport(preview: AdminAIQuestioningSyllabusJsonImportPreview) {
  const apply = preview && typeof preview === 'object' && 'apply' in preview
    ? (preview as AdminAIQuestioningSyllabusJsonImportPreview & { apply?: unknown }).apply
    : undefined;
  const recovery = preview && typeof preview === 'object' && 'recovery' in preview
    ? (preview as AdminAIQuestioningSyllabusJsonImportPreview & { recovery?: unknown }).recovery
    : undefined;
  return {
    generatedAt: new Date().toISOString(),
    payload: preview.payload,
    summary: preview.summary,
    incomingTopics: preview.items,
    missingFromFile: preview.missingFromFile,
    errors: preview.errors,
    ...(apply ? { apply } : {}),
    ...(recovery ? { recovery } : {})
  };
}

export function syllabusImportPreviewFilename(preview: AdminAIQuestioningSyllabusJsonImportPreview, extension: 'csv' | 'json') {
  const subject = preview.payload.subject || preview.summary.subject || 'csca';
  const version = String(preview.payload.syllabusVersion || preview.summary.syllabusVersion || 'syllabus').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `csca-syllabus-${subject}-${version}-preview.${extension}`;
}
