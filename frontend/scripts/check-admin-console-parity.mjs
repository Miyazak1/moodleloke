import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function readTree(relativePath) {
  return readdirSync(resolve(root, relativePath), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => readFileSync(resolve(entry.parentPath, entry.name), 'utf8'))
    .join('\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippets, label) {
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${label} is missing required marker: ${snippet}`);
  }
}

const shell = read('src/components/admin/AdminConsoleShell.tsx');
const appRouteRenderer = read('src/components/AppRouteRenderer.tsx');
const aiOperations = read('src/pages/AdminAIOperationsPage.tsx');
const questionBank = `${read('src/pages/AdminAIQuestionBankPage.tsx')}\n${readTree('src/components/admin/ai-question-bank')}`;
const cscaSyllabus = read('src/components/admin/ai-question-bank/CscaSyllabusWorkspace.tsx');
const organizations = read('src/pages/AdminOrganizationsPage.tsx');
const audit = read('src/pages/AdminAuditPage.tsx');
const adminConsoleCss = read('src/styles/admin-console.css');
const adminComponentsCss = read('src/styles/admin-components.css');
const adminWorkAggregatorCss = read('src/styles/admin-work.css');
const adminWorkCss = read('src/styles/admin-work.part-02.css');
const adminWorkbench = read('src/components/admin/AdminWorkbench.tsx');
const adminConsoleE2e = read('e2e/admin-console-parity.spec.ts');
const docs = read('../docs/admin-console-feature-parity-and-style-audit-2026-06-15.md');

assertIncludes(shell, [
  'brand-page brand-work-page admin-work-page',
  'c-admin-shell',
  'c-admin-shell__nav-button c-admin-control',
  "aiOperations: 'AI 运维'",
  "aiQuestionBank: 'AI 题库'",
  "aiQuestionBank', label: copy.aiQuestionBank",
  'routes.adminAIQuestionBank'
], 'AdminConsoleShell');

assertIncludes(appRouteRenderer, [
  'route === routes.adminAIQuestionBank',
  'AdminAIQuestionBankPage'
], 'AppRouteRenderer');

assertIncludes(aiOperations, [
  'getAdminAdaptiveAIObservability',
  'getAdminAdaptiveAIProviderConfig',
  'getAdminAIQuestioningOperationalReadiness',
  'getAdminAIQuestioningGenerationQueueHealth',
  'getAdminAdaptiveTrainingEventObservability',
  'getAdminReadinessEvidenceFiles',
  'recordAdminAIQuestioningOperationalReadinessEvent',
  "action: 'archive_failed'",
  "action: 'retry_failed'",
  'processAdminAIQuestioningGenerationJobs',
  'runAdminAIQuestioningPregeneration',
  'ensureAdminAIQuestioningBlueprintCoverage',
  'enqueueAdminAIQuestioningGenerationJobs',
  'dailyGovernance',
  'readinessCsv',
  'downloadReadinessSnapshot',
  'downloadEvidenceFile',
  'byFailureCategory',
  'byProviderFailureCategory',
  'blockedJobs',
  'staleRunningJobs',
  'job.topicTitle',
  'job.topicId',
  'LLM 使用量'
], 'AdminAIOperationsPage');

assertIncludes(questionBank, [
  'getAdminAIQuestioningBlueprintCoverage',
  'getAdminAIQuestioningTopicHealth',
  'runAdminAIQuestioningTopicAction',
  'getAdminAIQuestioningQuestions',
  'bulkAdminAIQuestioningQuestions',
  'reviewAdminAIQuestioningQuestion',
  'approveAdminAIQuestioningQuestion',
  'rejectAdminAIQuestioningQuestion',
  'archiveAdminAIQuestioningQuestion',
  'updateAdminAIQuestioningQuestion',
  'adminAIQuestioningCandidateQueueCsv',
  'adminAIQuestioningCandidateQueueJson',
  'getAdminAIQuestioningQuestionLedger',
  'getAdminAIQuestioningQualityGovernance',
  'getAdminAIQuestioningQualityTrend',
  'qualityCalibration',
  'qualityReplacementSummary',
  'sendAdminAIQuestioningQualityToReview',
  'resolveAdminAIQuestioningQuality',
  'applyAdminAIQuestioningQualityDisposition',
  'bulkAdminAIQuestioningQuality',
  'adminAIQuestioningQualityCalibrationCsv',
  'adminAIQuestioningQualityCalibrationJson',
  'getAdminAIQuestioningMisconceptions',
  'reviewAdminAIQuestioningMisconception',
  'updateAdminAIQuestioningMisconception',
  'mergeAdminAIQuestioningMisconception',
  'archiveAdminAIQuestioningMisconception',
  'restoreAdminAIQuestioningMisconception',
  'createAdminAIQuestioningConceptCardForMisconception',
  'createAdminAIQuestioningVariantForMisconception',
  'updateAdminAIQuestioningConceptCard',
  'publishAdminAIQuestioningConceptCard',
  'archiveAdminAIQuestioningConceptCard',
  'getAdminAIQuestioningRemediation',
  '质量校准摘要',
  '替代候选跟进',
  '质量修题'
], 'AdminAIQuestionBankPage');

assertIncludes(cscaSyllabus, [
  '管理 AI 出题使用的 CSCA 大纲',
  'previewAdminAIQuestioningSyllabusJsonImport',
  'createAdminAIQuestioningSyllabusJsonImport',
  'applyAdminAIQuestioningSyllabusJsonImport',
  'archiveAdminAIQuestioningSyllabusJsonImport',
  'createAdminAIQuestioningSyllabusJsonImportRecoveryDraft',
  'createAdminAIQuestioningSyllabusJsonImportReversePlan',
  'syllabusImportPreviewCsv',
  'syllabusImportPreviewReport',
  'reviewSyllabusStatus',
  'bulkAdminAIQuestioningQuestions'
], 'AdminCscaSyllabusPage');

assertIncludes(organizations, [
  '额度池',
  '机构 BYOK',
  'saveProviderConfig',
  'saveCreditPool',
  'upsertAdminAdaptiveAIOrganizationCreditPool',
  'upsertAdminAdaptiveAIOrganizationProvider',
  'previewAdminAdaptiveAIOrganizationMemberImport',
  'applyAdminAdaptiveAIOrganizationMemberImport',
  '治理日志'
], 'AdminOrganizationsPage');

assertIncludes(audit, [
  'LLM 使用量',
  'AdminTrendChart',
  'aiObservability.summary.externalInteractions',
  'recentFailures',
  'aiReviewQueue',
  'aiQuestioningQuestionLedger'
], 'AdminAuditPage');

assertIncludes(adminConsoleCss, [
  'var(--public-line',
  'var(--public-panel',
  'box-shadow: none',
  'border-radius: 12px'
], 'admin-console.css');

assertIncludes(adminWorkAggregatorCss, [
  "@import './admin-console.css';",
  "@import './admin-components.css';"
], 'admin-work.css');

assertIncludes(adminWorkbench, [
  'export function AdminButton',
  'c-admin-button',
  'c-admin-subnav',
  'c-admin-stat-strip',
  'c-admin-panel',
  'c-admin-action-bar',
  'c-admin-table-scroll'
], 'AdminWorkbench');

assertIncludes(adminComponentsCss, [
  '--admin-radius-control: 8px',
  '--admin-type-section-title: 20px',
  '--admin-type-body: 14px',
  '.c-admin-shell__sidebar',
  '.c-admin-shell__nav-button',
  '.c-admin-subnav__button',
  '.c-admin-stat-strip__item',
  '.c-admin-panel',
  '.c-admin-shell__account',
  '.metric-grid > article',
  '.c-admin-button',
  '.c-admin-table-scroll',
  'background-image: none'
], 'admin-components.css');
assert(!adminComponentsCss.includes('linear-gradient'), 'admin-components.css should keep admin controls aligned with the site style and avoid gradient buttons.');
assertIncludes(adminComponentsCss, [
  '.c-admin-operation-status__metrics span',
  'border-radius: 999px'
], 'admin-components.css status chips');
assert(!adminComponentsCss.includes('clamp('), 'admin-components.css should keep admin typography fixed and predictable, not viewport-scaled.');
assert(!adminComponentsCss.includes('border-left'), 'admin shell nav should not use a reinforced left border for selected state.');
assertIncludes(adminComponentsCss, [
  'max-height: none',
  'overflow: visible'
], 'admin-components.css sidebar');

assertIncludes(adminWorkCss, [
  '.admin-list.compact',
  '.admin-inline-editor',
  'border-top: 1px solid var(--public-line',
  ':not(.c-admin-control)'
], 'admin-work.part-02.css');

assertIncludes(adminConsoleE2e, [
  'AI operations keeps LLM usage, readiness, and generation queue panels',
  'AI question bank keeps candidate review, charts, quality calibration, and remediation surfaces',
  'CSCA syllabus remains under AI questioning and keeps import governance workflows',
  "page.goto('/admin/ai-question-bank')",
  "name: '进入共用准备'",
  'LLM usage',
  'Quality calibration summary',
  'Legacy impact diagnostics'
], 'admin-console-parity.spec.ts');

assert(!docs.includes('| Missing |'), 'Parity document should not leave any matrix row marked Missing.');
assert(!docs.includes('| Missing / degraded |'), 'Parity document should not leave degraded rows in the parity matrix.');
assert(!docs.includes('Needs parity check'), 'Parity document should not leave rows marked Needs parity check.');
assertIncludes(docs, [
  '| AI questioning operational readiness |',
  '| Daily governance workflow |',
  '| Generation job queue |',
  '| Quality calibration / replacement candidates |',
  '| Organization AI provider / BYOK |',
  'Restored'
], 'admin parity document');

console.log('Admin console parity check passed.');
