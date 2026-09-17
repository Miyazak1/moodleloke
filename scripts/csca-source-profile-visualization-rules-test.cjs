const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, message) {
  assert(source.includes(snippet), message);
}

const controller = read('backend/src/ai-questioning/ai-questioning.controller.ts');
const service = read('backend/src/ai-questioning/ai-questioning.service.ts');
const apiTypes = read('frontend/src/lib/api-types.ts');
const apiAdmin = read('frontend/src/lib/api-admin.ts');
const actions = read('frontend/src/components/admin/ai-question-bank/useSourceReferenceActions.ts');
const libraryPanel = read('frontend/src/components/admin/ai-question-bank/SourceReferenceLibraryPanel.tsx');
const styleProfilePanel = read('frontend/src/components/admin/ai-question-bank/StyleProfilePanel.tsx');
const visualizationPanel = read('frontend/src/components/admin/ai-question-bank/ProfileVisualizationPanel.tsx');
const css = read('frontend/src/styles/admin-work.part-01.css');
const frontendPackageJson = JSON.parse(read('frontend/package.json'));
const sourceProfilePipelineUiContract = read('frontend/scripts/check-admin-source-profile-pipeline-ui.mjs');
const sourceProfilePipelineBrowserRunner = read('frontend/scripts/run-admin-source-profile-pipeline-browser.mjs');
const continuousProfileSmoke = read('scripts/csca-continuous-exam-generation-profile-smoke.cjs');
const packageJson = JSON.parse(read('package.json'));

assertIncludes(controller, 'source-documents/:id/profile-visualization', 'Controller must expose source document profile visualization endpoint.');
assertIncludes(service, 'sourceDocumentProfileVisualization', 'Service must implement source document profile visualization.');
assertIncludes(service, 'visualizationDistribution(topics', 'Visualization service must aggregate topic distribution.');
assertIncludes(service, 'unknownDimensionCount', 'Visualization service must expose unknown dimension diagnostics.');
assertIncludes(service, 'healthScore', 'Visualization service must expose profile health score.');
assertIncludes(service, 'mappingCoverage >= requiredMappingCoverage', 'Pipeline must compute mapping coverage before declaring the source profile complete.');
assertIncludes(service, "out_of_syllabus_review_required", 'Pipeline must distinguish suspected out-of-syllabus gaps from generic unmapped coverage gaps.');
assertIncludes(service, "low_confidence_mapping_review_required", 'Pipeline must distinguish low-confidence mapping gaps from generic unmapped coverage gaps.');
assertIncludes(service, "mappingGapDiagnosis", 'Pipeline result must persist mapping-gap diagnosis for frontend observability.');
assertIncludes(service, 'requiredMappingCoverage,', 'Pipeline result must expose the mapping coverage threshold.');
assertIncludes(service, "status: 'blocked'", 'Pipeline must block, not succeed, when required mapping coverage is not met.');
assertIncludes(service, "error: mappingGapReason ?? 'source_mapping_coverage_low'", 'Pipeline task error must persist the specific mapping-gap reason instead of collapsing all blocked cases into generic coverage low.');

assertIncludes(apiTypes, 'AdminAIQuestioningSourceDocumentProfileVisualization', 'Frontend types must include source document visualization.');
assertIncludes(apiTypes, 'AdminAIQuestioningProfileDistributionItem', 'Frontend types must include distribution item.');
assertIncludes(apiAdmin, 'getAdminAIQuestioningSourceDocumentProfileVisualization', 'Frontend API must request source document visualization lazily.');
assertIncludes(apiAdmin, 'refresh?: boolean; bypassCache?: boolean', 'Source reference summary API must allow explicit cache bypass for operator refreshes.');

assertIncludes(actions, 'sourceDocumentProfileVisualizations', 'Visualization responses must be cached in question-bank state.');
assertIncludes(actions, 'source-document-visualization-', 'Visualization loading must have a distinct busy action.');
assertIncludes(libraryPanel, '查看画像图表', 'Source document list must expose visualization action.');
assertIncludes(libraryPanel, 'ProfileVisualizationPanel', 'Source document list must render visualization panel.');
assertIncludes(libraryPanel, "source_mapping_incomplete: '源题未闭环'", 'Source pipeline stage labels must make incomplete mapping visible instead of showing a generic completion state.');
assertIncludes(libraryPanel, "sourcePipelineTone(pipelineDisplayStatus)", 'Source pipeline status must drive visible tone for blocked/warning states.');
assertIncludes(libraryPanel, "label: '映射覆盖'", 'Source pipeline details must render mapping coverage as a first-class row.');
assertIncludes(libraryPanel, "label: '映射缺口'", 'Source pipeline details must render mapping-gap reason and next action.');
assertIncludes(libraryPanel, "低置信 ${numberFromUnknown(summary?.lowConfidenceQuestionCount", 'Source pipeline details must expose low-confidence mapping counts.');
assertIncludes(libraryPanel, "疑似超纲 ${numberFromUnknown(summary?.outOfSyllabusQuestionCount", 'Source pipeline details must expose suspected out-of-syllabus counts.');
assertIncludes(libraryPanel, "label: '低置信'", 'Source reference summary must show low-confidence sample count.');
assertIncludes(libraryPanel, "label: '疑似超纲'", 'Source reference summary must show suspected out-of-syllabus sample count.');
assertIncludes(libraryPanel, "pipelineTask.id.slice(0, 8)", 'Source pipeline card must expose the task id so operators can correlate frontend state with backend logs.');
assertIncludes(libraryPanel, "pipelineMappingIncomplete ? ` · 映射 ${pipelineMappedQuestionCount}/${sourceReferenceSummary.questionCount}`", 'Source pipeline card must show partial mapping progress when the pipeline is incomplete.');
assertIncludes(libraryPanel, 'isRecentTransitionalPipelineBlock(pipelineTask)', 'Source pipeline card must keep polling after recent transitional stale-profile blocks during multi-document imports.');
assertIncludes(libraryPanel, "'generation_profile_not_fresh'", 'Source pipeline polling must recognize transient generation-profile stale blocks.');
assertIncludes(styleProfilePanel, '查看趋势图表', 'Style profile panel must expose exam-series trend visualization.');
assertIncludes(styleProfilePanel, '查看出题图表', 'Style profile panel must expose generation-profile visualization.');
assertIncludes(styleProfilePanel, '稳定高频知识点', 'Trend visualization must show stable topic distribution.');
assertIncludes(styleProfilePanel, '轮换知识点', 'Trend visualization must show rotating topic distribution.');
assertIncludes(styleProfilePanel, '趋势画像', 'Generation visualization must show linked trend profile.');

for (const label of ['总题数', '待处理', '低置信度', '知识点覆盖', '难度分布', '题型分布', '认知技能', '答案分布']) {
  assertIncludes(visualizationPanel, label, `Visualization panel must render ${label}.`);
}

assertIncludes(css, 'admin-profile-chart-grid', 'Visualization CSS must define chart grid.');
assertIncludes(css, '@media (max-width: 900px)', 'Visualization CSS must include responsive layout.');

assert(
  packageJson.scripts['csca-source-profile-visualization:rules'] === 'node scripts/csca-source-profile-visualization-rules-test.cjs',
  'package.json must expose csca-source-profile-visualization:rules.'
);
assert(
  frontendPackageJson.scripts['test:admin-source-profile-pipeline-ui'] === 'node scripts/check-admin-source-profile-pipeline-ui.mjs',
  'frontend package.json must expose test:admin-source-profile-pipeline-ui.'
);
assert(
  frontendPackageJson.scripts['test:admin-source-profile-pipeline-browser'] === 'node scripts/run-admin-source-profile-pipeline-browser.mjs',
  'frontend package.json must expose test:admin-source-profile-pipeline-browser.'
);
assertIncludes(packageJson.scripts['verify:csca-source-profile-rollout'], 'npm --prefix frontend run test:admin-source-profile-pipeline-ui', 'Source profile rollout gate must include the frontend pipeline UI contract.');
assertIncludes(packageJson.scripts['verify:csca-source-profile-rollout'], 'npm --prefix frontend run test:admin-source-profile-pipeline-browser', 'Source profile rollout gate must include the frontend pipeline browser regression.');
assertIncludes(sourceProfilePipelineUiContract, "source_mapping_incomplete: '源题未闭环'", 'Frontend pipeline UI contract must guard incomplete mapping label.');
assertIncludes(sourceProfilePipelineUiContract, "summary_diagnostic: '当前事实源诊断'", 'Frontend pipeline UI contract must guard diagnostic fallback label.');
assertIncludes(sourceProfilePipelineUiContract, "label: '映射缺口'", 'Frontend pipeline UI contract must guard mapping-gap detail.');
assertIncludes(sourceProfilePipelineUiContract, 'shouldPollSourceReference', 'Frontend pipeline UI contract must guard source reference polling.');
assertIncludes(sourceProfilePipelineBrowserRunner, "E2E_PORT: process.env.E2E_PORT || '5198'", 'Frontend pipeline browser regression must use an isolated default port.');
assertIncludes(sourceProfilePipelineBrowserRunner, "E2E_REUSE_SERVER: process.env.E2E_REUSE_SERVER || 'false'", 'Frontend pipeline browser regression must not reuse stale dev servers by default.');
assertIncludes(sourceProfilePipelineBrowserRunner, "'source profile pipeline'", 'Frontend pipeline browser regression must run the source profile pipeline DOM test.');

assertIncludes(continuousProfileSmoke, 'setupBlockedSourceMappingDiagnosis', 'Continuous profile smoke must create diagnosis-specific blocked source profile samples.');
assertIncludes(continuousProfileSmoke, 'low_confidence_mapping_review_required', 'Continuous profile smoke must verify low-confidence mapping gaps at runtime.');
assertIncludes(continuousProfileSmoke, 'out_of_syllabus_review_required', 'Continuous profile smoke must verify suspected out-of-syllabus gaps at runtime.');
assertIncludes(continuousProfileSmoke, "task?.error === expectedReason", 'Continuous profile smoke must prove the task error carries the specific blocked reason.');

console.log('CSCA source profile visualization rules passed.');
