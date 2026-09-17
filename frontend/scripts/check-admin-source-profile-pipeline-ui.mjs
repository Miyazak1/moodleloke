import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippets, label) {
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${label} is missing required marker: ${snippet}`);
  }
}

const libraryPanel = read('src/components/admin/ai-question-bank/SourceReferenceLibraryPanel.tsx');
const dataRefresh = read('src/components/admin/ai-question-bank/useSourceReferenceDataRefresh.ts');
const apiTypes = read('src/lib/api-types.ts');
const packageJson = JSON.parse(read('package.json'));
const rootPackageJson = JSON.parse(read('../package.json'));
const browserRunner = read('scripts/run-admin-source-profile-pipeline-browser.mjs');

assertIncludes(apiTypes, [
  'export type AdminAIQuestioningSourceProfilePipelineTask',
  'export type AdminAIQuestioningSourceProfilePipelineResult',
  '[key: string]: unknown',
  'result: AdminAIQuestioningSourceProfilePipelineResult | null',
  'pipelineTask?: AdminAIQuestioningSourceProfilePipelineTask | null',
  'pipelineMappedQuestionCount?: number',
  'lowConfidenceQuestionCount?: number',
  'outOfSyllabusQuestionCount?: number'
], 'source profile pipeline API types');

assertIncludes(dataRefresh, [
  'getAdminAIQuestioningSourceReferenceSummary',
  'listAdminAIQuestioningSourceDocuments',
  'listAdminAIQuestioningSourceQuestions',
  'listAdminAIQuestioningSourceAutoProfileTasks',
  'listAdminAIQuestioningSourceTopicTasks',
  'listAdminAIQuestioningStyleProfiles',
  'listAdminAIQuestioningExamSeriesProfiles',
  'listAdminAIQuestioningGenerationProfiles',
  'listAdminAIQuestioningTopicOptions',
  'refresh: true'
], 'source reference data refresh read model');

assertIncludes(libraryPanel, [
  "source_mapping_incomplete: '源题未闭环'",
  "summary_diagnostic: '当前事实源诊断'",
  "if (status === 'source_mapping_incomplete') return 'warning';",
  "sourcePipelineTone(pipelineDisplayStatus)",
  'pipelineMappingIncomplete',
  'pipelineDisplayStatus',
  'pipelineDisplayStage',
  'shouldPollSourceReference',
  'isRecentTransitionalPipelineBlock(pipelineTask)',
  'generation_profile_not_fresh',
  'pipelineMappingIncomplete ||',
  '(sourceReferenceSummary.autoPendingQuestionCount ?? 0) > 0',
  'onRefreshSourceReference();'
], 'source profile pipeline status and polling UI');

assertIncludes(libraryPanel, [
  'mappingGapDiagnosis',
  "label: '映射覆盖'",
  'percentFromRatio(coverage)',
  '源题已映射 ${mappedCount}',
  '未闭环 ${unmappedCount}',
  '低置信 ${numberFromUnknown(summary?.lowConfidenceQuestionCount',
  '疑似超纲 ${numberFromUnknown(summary?.outOfSyllabusQuestionCount',
  "label: '映射缺口'",
  "mappingGapDiagnosis.nextAction"
], 'source profile mapping diagnosis UI');

assertIncludes(libraryPanel, [
  "{ key: 'low-confidence', label: '低置信'",
  "{ key: 'out-of-syllabus', label: '疑似超纲'",
  "{ key: 'mapped', label: '源题已映射'",
  "{ key: 'succeeded', label: '阶段完成'",
  "pipelineTask.id.slice(0, 8)",
  "pipelineMappingIncomplete ? ` · 映射 ${pipelineMappedQuestionCount}/${sourceReferenceSummary.questionCount}`",
  "recentLabel=\"流水线详情\"",
  "title=\"只刷新真题参考库和当前画像进度，不刷新整页\"",
  '刷新进度',
  'onRefreshSourceReference();'
], 'source profile operator observability UI');

assert(
  packageJson.scripts['test:admin-source-profile-pipeline-ui'] === 'node scripts/check-admin-source-profile-pipeline-ui.mjs',
  'frontend package.json must expose test:admin-source-profile-pipeline-ui.'
);

assert(
  packageJson.scripts['test:admin-source-profile-pipeline-browser'] === 'node scripts/run-admin-source-profile-pipeline-browser.mjs',
  'frontend package.json must expose test:admin-source-profile-pipeline-browser.'
);

assertIncludes(browserRunner, [
  "E2E_PORT: process.env.E2E_PORT || '5198'",
  "E2E_REUSE_SERVER: process.env.E2E_REUSE_SERVER || 'false'",
  "'source profile pipeline'",
  "'--project=desktop'"
], 'source profile pipeline browser runner');

assert(
  rootPackageJson.scripts['verify:csca-source-profile-rollout']?.includes('npm --prefix frontend run test:admin-source-profile-pipeline-ui'),
  'root verify:csca-source-profile-rollout must run the source profile pipeline UI contract.'
);

assert(
  rootPackageJson.scripts['verify:csca-source-profile-rollout']?.includes('npm --prefix frontend run test:admin-source-profile-pipeline-browser'),
  'root verify:csca-source-profile-rollout must run the source profile pipeline browser regression.'
);

console.log('Admin source profile pipeline UI contract passed.');
