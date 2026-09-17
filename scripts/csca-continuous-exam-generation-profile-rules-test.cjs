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

function assertOrder(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert(firstIndex >= 0, `${message} Missing first marker: ${first}`);
  assert(secondIndex >= 0, `${message} Missing second marker: ${second}`);
  assert(firstIndex < secondIndex, message);
}

function assertNotIncludes(source, snippet, message) {
  assert(!source.includes(snippet), message);
}

function countOccurrences(source, snippet) {
  return source.split(snippet).length - 1;
}

function sectionBetween(source, startMarker, endMarker, message) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `${message} Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(end > start, `${message} Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const schema = read('backend/prisma/schema.prisma');
const migration = read('backend/prisma/migrations/0066_exam_series_generation_profiles/migration.sql');
const activeUniquenessMigration = read('backend/prisma/migrations/0067_generation_profile_active_uniqueness/migration.sql');
const aiQuestioningService = read('backend/src/ai-questioning/ai-questioning.service.ts');
const aiQuestioningController = read('backend/src/ai-questioning/ai-questioning.controller.ts');
const questionVersionGovernance = read('backend/src/ai-questioning/question-version-governance.ts');
const mockExamService = read('backend/src/csca-mock-exam/csca-mock-exam.service.ts');
const adaptiveQuestionProvider = read('backend/src/csca-special-practice/adaptive-question-provider.service.ts');
const adaptivePlanner = read('backend/src/csca-special-practice/adaptive-planner.service.ts');
const adaptiveService = read('backend/src/csca-special-practice/csca-adaptive.service.ts');
const aiCoachService = read('backend/src/csca-special-practice/ai-coach.service.ts');
const specialPracticeService = read('backend/src/csca-special-practice/csca-special-practice.service.ts');
const meService = read('backend/src/me/me.service.ts');
const apiAdmin = read('frontend/src/lib/api-admin.ts');
const apiTypes = read('frontend/src/lib/api-types.ts');
const sourceReferenceActions = read('frontend/src/components/admin/ai-question-bank/useSourceReferenceActions.ts');
const sourceReferenceDataRefresh = read('frontend/src/components/admin/ai-question-bank/useSourceReferenceDataRefresh.ts');
const sourceReferenceProps = read('frontend/src/components/admin/ai-question-bank/sourceReferenceWorkspaceProps.ts');
const sourceReferenceWorkspace = read('frontend/src/components/admin/ai-question-bank/SourceReferenceWorkspace.tsx');
const sourceReferenceLibraryPanel = read('frontend/src/components/admin/ai-question-bank/SourceReferenceLibraryPanel.tsx');
const styleProfilePanel = read('frontend/src/components/admin/ai-question-bank/StyleProfilePanel.tsx');
const adminQuestionBankPage = read('frontend/src/pages/AdminAIQuestionBankPage.tsx');
const executablePlan = read('docs/continuous-exam-series-generation-profile-executable-plan-2026-07-14.md');
const autoProfileRefreshPlan = read('docs/auto-profile-refresh-and-question-version-governance-plan-2026-07-14.md');
const sourceProfileVisualizationPlan = read('docs/source-paper-profile-visualization-executable-plan-2026-07-14.md');
const generationProfileSmoke = read('scripts/csca-continuous-exam-generation-profile-smoke.cjs');
const packageJson = JSON.parse(read('package.json'));
const generateExamSeriesProfileSection = sectionBetween(
  aiQuestioningService,
  'async generateExamSeriesProfile',
  'async listExamSeriesProfiles',
  'Unable to isolate generateExamSeriesProfile section.'
);
const listQuestionLedgerSection = sectionBetween(
  aiQuestioningService,
  'async listQuestionLedger',
  'async refreshQuestionVersionGovernance',
  'Unable to isolate listQuestionLedger section.'
);
const generateGenerationProfileSection = sectionBetween(
  aiQuestioningService,
  'async generateGenerationProfile',
  'async listGenerationProfiles',
  'Unable to isolate generateGenerationProfile section.'
);
const activateGenerationProfileSection = sectionBetween(
  aiQuestioningService,
  'async activateGenerationProfile',
  'private async refreshVersionGovernanceAfterGenerationProfile',
  'Unable to isolate activateGenerationProfile section.'
);
const sourceReferenceSummarySection = sectionBetween(
  aiQuestioningService,
  'async sourceReferenceSummary',
  'async listSourceQuestions',
  'Unable to isolate sourceReferenceSummary section.'
);
const startSourceProfilePipelineSection = sectionBetween(
  aiQuestioningService,
  'private async startSourceProfilePipelineTask',
  'async startSourceProfilePipelineManualRebuild',
  'Unable to isolate source profile pipeline start section.'
);
const sourceProfilePipelineRunnerSection = sectionBetween(
  aiQuestioningService,
  'private async runSourceProfilePipelineTask',
  'private async sourceQuestionsForAutoProfile',
  'Unable to isolate source profile pipeline runner section.'
);
const deleteSourceDocumentsByIdsSection = sectionBetween(
  aiQuestioningService,
  'private async deleteSourceDocumentsByIds',
  'async sourceReferenceSummary',
  'Unable to isolate source document delete cleanup section.'
);
const scanSourceProfilePipelineSection = sectionBetween(
  aiQuestioningService,
  'private async scanSourceProfilePipeline',
  'private async runSourceProfilePipelineTask',
  'Unable to isolate source profile pipeline scanner section.'
);
const generationReadinessForUseCaseSection = sectionBetween(
  aiQuestioningService,
  'private async generationReadinessForUseCase',
  'async assertSubjectPracticeGenerationReady',
  'Unable to isolate generation readiness section.'
);
const insertQuestionSection = sectionBetween(
  aiQuestioningService,
  'private async insertQuestion',
  'private async recordQuestionAgentInteraction',
  'Unable to isolate insertQuestion section.'
);
const refreshSubjectPracticeProductionRunSection = sectionBetween(
  aiQuestioningService,
  'private async refreshSubjectPracticeProductionRun',
  'async processSubjectPracticeProductionRun',
  'Unable to isolate subject-practice production refresh section.'
);
const processSubjectPracticeProductionRunSection = sectionBetween(
  aiQuestioningService,
  'async processSubjectPracticeProductionRun',
  'async cancelSubjectPracticeProductionRun',
  'Unable to isolate subject-practice production process section.'
);
const processSubjectPracticeRepairBacklogSection = sectionBetween(
  aiQuestioningService,
  'private async processSubjectPracticeRepairBacklog',
  'private async maybeAutoRepairSubjectPracticeQuestion',
  'Unable to isolate subject-practice repair backlog section.'
);

for (const model of [
  'model CscaExamSeriesProfile',
  'model CscaGenerationProfile'
]) {
  assertIncludes(schema, model, `Prisma schema must include ${model}.`);
}

for (const table of [
  'CREATE TABLE IF NOT EXISTS "csca_exam_series_profiles"',
  'CREATE TABLE IF NOT EXISTS "csca_generation_profiles"'
]) {
  assertIncludes(migration, table, `Migration must create ${table}.`);
}

for (const index of [
  'idx_csca_exam_series_profiles_subject_status',
  'idx_csca_generation_profiles_use_case_status'
]) {
  assertIncludes(migration, index, `Migration must create ${index}.`);
}

for (const index of [
  'uniq_csca_exam_series_profiles_active',
  'uniq_csca_generation_profiles_active'
]) {
  assertIncludes(activeUniquenessMigration, index, `Migration must enforce active uniqueness with ${index}.`);
  assertIncludes(activeUniquenessMigration, 'WHERE "status" = \'active\'', `${index} must be a partial unique index for active rows only.`);
}

assertNotIncludes(aiQuestioningController, 'source-documents/import-mock-exam-paper', 'Admin controller must not expose mock exam paper imports into the source profile pipeline.');
assertIncludes(aiQuestioningController, 'exam-series-profiles/generate', 'Admin controller must expose exam series profile generation.');
assertIncludes(aiQuestioningController, 'exam-series-profiles/:id/activate', 'Admin controller must expose exam series profile activation.');
assertIncludes(aiQuestioningController, 'generation-profiles/generate', 'Admin controller must expose generation profile generation.');
assertIncludes(aiQuestioningController, 'generation-profiles/:id/activate', 'Admin controller must expose generation profile activation.');
assertIncludes(aiQuestioningController, 'question-version-governance/refresh', 'Admin controller must expose question version governance refresh.');
assertIncludes(aiQuestioningController, 'source-profile-pipeline/rebuild', 'Admin controller must expose source profile pipeline manual rebuild recovery.');

assertNotIncludes(aiQuestioningService, 'importMockExamPaperAsSourceDocument', 'Service must not import existing mock exam papers into the source profile pipeline.');
assertNotIncludes(aiQuestioningService, 'mock_exam_paper_asset', 'Mock exam assets must not masquerade as source profile documents.');
assertIncludes(aiQuestioningService, "const CSCA_SOURCE_DOCUMENT_TYPES = ['past_paper'] as const", 'AI source document imports must only accept true past-paper sourceType.');
assertIncludes(aiQuestioningService, 'normalizeSourceDocumentType(documentInput.sourceType)', 'JSON source document import must validate and normalize document.sourceType.');
assertIncludes(aiQuestioningService, 'AI 画像源卷只能导入真实 past_paper 真题', 'JSON source document import must reject mock/prediction/profile-polluting sources.');
assertIncludes(aiQuestioningService, 'generateExamSeriesProfile', 'Service must generate continuous exam-series profiles.');
assertIncludes(aiQuestioningService, 'schemaVersion: \'csca-exam-series-trend-profile-v1\'', 'Exam series profile must use a stable schema version.');
assertIncludes(aiQuestioningService, 'normalizedPaperTargetsFromProfile', 'Exam series profile must build normalized 48-question paper targets from raw trend distributions.');
assertIncludes(generateExamSeriesProfileSection, 'normalizedTargets', 'Exam series profile output must persist normalized targets for downstream generation.');
assertIncludes(generateExamSeriesProfileSection, 'onlineMockExam: normalizedPaperTargetsFromProfile(profileLike, 48)', 'Online mock exam trend profile must normalize raw distributions into a 48-question target.');
assertIncludes(generateExamSeriesProfileSection, 'answerDistribution', 'Exam series profile must include answer distribution so generated mock papers can avoid answer-key skew.');
assertIncludes(generateExamSeriesProfileSection, 'sessionSummary', 'Exam series profile must persist per-source session summaries for contribution charts.');
assertIncludes(styleProfilePanel, 'sourceContributionsFromSessionSummary', 'Trend profile UI must derive source/month contribution from sessionSummary.');
assertIncludes(styleProfilePanel, '源卷贡献（按样本题数）', 'Trend profile UI must show each source paper contribution to the total profile.');
assertIncludes(aiQuestioningService, 'generateGenerationProfile', 'Service must generate current generation profiles.');
assertIncludes(aiQuestioningService, 'schemaVersion: \'csca-generation-profile-v1\'', 'Generation profile must use a stable schema version.');
assertIncludes(generateGenerationProfileSection, 'normalizedTarget: normalizedProfileTarget', 'Online mock generation profile must carry the normalized 48-question target.');
assertIncludes(generateGenerationProfileSection, 'onlineMockTargetDistributions.answer', 'Online mock generation profile must include normalized answer target distribution.');
assertIncludes(generateGenerationProfileSection, "fallback: !seriesProfile && allowLegacyFallback && styleProfile ? 'manual_debug_legacy_style_profile' : 'none'", 'Generation profile metadata must only expose legacy style profile fallback for explicit manual debug.');
assertNotIncludes(generateGenerationProfileSection, "fallback: styleProfile ? 'legacy_style_profile' : 'none'", 'Generation profile metadata must not imply automatic legacy style fallback.');
assertIncludes(aiQuestioningService, 'assertGenerationProfileFreshBeforeActivation', 'Generation profile activation must have a hard freshness gate.');
assertIncludes(aiQuestioningService, 'activePastPaperSourceSnapshotHash', 'Readiness must compute the current active past-paper source snapshot.');
assertIncludes(aiQuestioningService, 'AND d."source_type" = \'past_paper\'', 'Continuous trend profile queries must be restricted to true past-paper source documents.');
assertIncludes(aiQuestioningService, 'AND d."status" = \'active\'', 'Continuous trend profile queries must be restricted to active source documents.');
assertIncludes(generateExamSeriesProfileSection, 'AND d."subject" = ${subject}', 'Exam series profile generation must not mix source documents from another subject.');
assertIncludes(generateExamSeriesProfileSection, 'AND d."source_type" = \'past_paper\'', 'Exam series profile generation must only aggregate true past-paper documents.');
assertIncludes(generateExamSeriesProfileSection, 'AND d."status" = \'active\'', 'Exam series profile generation must ignore archived/inactive source documents.');
assertIncludes(aiQuestioningService, 'series_profile_source_snapshot_stale', 'Readiness must block when the active series profile source snapshot is stale.');
assertIncludes(aiQuestioningService, 'series_profile_syllabus_snapshot_stale', 'Readiness must block when the active series profile syllabus snapshot is stale.');
assertIncludes(aiQuestioningService, 'generation_profile_source_snapshot_stale', 'Readiness must block when the generation profile source snapshot is stale.');
assertIncludes(aiQuestioningService, 'generation_profile_syllabus_snapshot_stale', 'Readiness must block when the generation profile syllabus snapshot is stale.');
assertOrder(
  generateGenerationProfileSection,
  'await this.assertGenerationProfileFreshBeforeActivation({',
  'UPDATE "csca_generation_profiles"',
  'Generation profile generation must prove freshness before superseding the old active profile.'
);
assertOrder(
  activateGenerationProfileSection,
  'await this.assertGenerationProfileFreshBeforeActivation({',
  'UPDATE "csca_generation_profiles"',
  'Manual generation profile activation must prove freshness before superseding the old active profile.'
);
assertIncludes(aiQuestioningService, 'legacy_style_profile 只能作为历史调试来源', 'Legacy style profile fallback must not be activatable as the current formal generation profile.');
assertIncludes(aiQuestioningService, 'activeSeriesProfile.id !== input.seriesProfileId', 'Generation profile freshness gate must require the latest active series profile id.');
assertIncludes(aiQuestioningService, 'input.sourceSnapshotHash !== currentSourceSnapshotHash', 'Generation profile freshness gate must compare source snapshot hash before activation.');
assertIncludes(aiQuestioningService, 'input.syllabusSnapshotHash !== currentSyllabusSnapshotHash', 'Generation profile freshness gate must compare syllabus snapshot hash before activation.');
assertIncludes(aiQuestioningService, 'source_document_reprofiled', 'Source profile pipeline actions must include source document reprofile triggers.');
assertIncludes(aiQuestioningService, 'source_document_deleted', 'Source profile pipeline actions must include source document delete triggers.');
assertIncludes(aiQuestioningService, 'startup_reconcile', 'Source profile pipeline actions must include startup reconcile triggers.');
assertIncludes(aiQuestioningService, '"status" IN (\'queued\', \'running\', \'waiting\')', 'Source profile pipeline dedupe must include waiting tasks.');
assertIncludes(startSourceProfilePipelineSection, 'COALESCE("filter_snapshot"->>\'syllabusVersion\', \'2025\') = ${syllabusVersion}', 'Source profile pipeline dedupe must be scoped by subject and syllabus version.');
assertNotIncludes(startSourceProfilePipelineSection, 'INTERVAL \'60 seconds\'', 'Source profile pipeline dedupe must not ignore long-running or long-waiting active tasks.');
assertIncludes(aiQuestioningService, 'const shouldResumeWaiting = existingTask.status === \'waiting\'', 'Source profile pipeline dedupe must resume existing waiting tasks when dependencies complete.');
assert(
  aiQuestioningService.includes('const shouldResumeWaiting = existingTask.status === \'waiting\'')
    && aiQuestioningService.includes("'source_auto_profile_completed'")
    && aiQuestioningService.includes("'source_document_deleted'")
    && aiQuestioningService.includes("'manual_rebuild'")
    && aiQuestioningService.includes("'startup_reconcile'")
    && aiQuestioningService.includes('].includes(trigger);'),
  'Source profile pipeline waiting resume must include source document delete recovery triggers.'
);
assertIncludes(startSourceProfilePipelineSection, "trigger === 'source_document_deleted'", 'Source document delete recovery must not resume a pipeline with a deleted source document id.');
assertIncludes(aiQuestioningService, 'this.startAiQuestioningTaskRunner(task.id, () => this.runSourceProfilePipelineTask(task.id, resumeBody))', 'Source profile pipeline waiting tasks must start a runner when resumed.');
assertIncludes(aiQuestioningService, 'startSourceProfilePipelineStartupReconcile', 'Service startup must reconcile source profile pipelines for active source documents.');
assertIncludes(aiQuestioningService, 'startSourceProfilePipelineManualRebuild', 'Service must expose a manual source profile pipeline rebuild recovery entrypoint.');
assertIncludes(aiQuestioningService, "action: 'startup_reconcile'", 'Startup reconcile must create source profile pipeline tasks with startup_reconcile action.');
assertIncludes(aiQuestioningService, "action: 'manual_rebuild'", 'Manual recovery must create source profile pipeline tasks with manual_rebuild action.');
assertIncludes(aiQuestioningService, "action: 'source_document_imported'", 'Importing an active past-paper source document must create source_document_imported pipeline tasks.');
assertIncludes(aiQuestioningService, "trigger: 'source_document_imported'", 'Importing an active past-paper source document must preserve source_document_imported trigger metadata.');
assertIncludes(aiQuestioningService, "action: 'source_document_reprofiled'", 'Reprocessing a source document must create source_document_reprofiled pipeline tasks.');
assertIncludes(aiQuestioningService, "trigger: 'source_document_reprofiled'", 'Reprocessing a source document must preserve source_document_reprofiled trigger metadata.');
assertIncludes(deleteSourceDocumentsByIdsSection, 'rebuildSourceProfilesAfterSourceDocumentDelete', 'Deleting source documents must rebuild source profiles from remaining active past-paper sources.');
assertIncludes(deleteSourceDocumentsByIdsSection, 'rebuildPipelines', 'Source document delete cleanup response must expose rebuild pipeline tasks.');
assertIncludes(aiQuestioningService, "action: 'source_document_deleted'", 'Source document deletion must create source_document_deleted pipeline tasks.');
assertIncludes(aiQuestioningService, "trigger: 'source_document_deleted'", 'Source document deletion must preserve source_document_deleted trigger metadata.');
assertIncludes(aiQuestioningService, "trigger: 'syllabus_applied'", 'Syllabus updates must create source profile pipeline tasks with syllabus_applied trigger metadata.');
assertIncludes(aiQuestioningService, 'subjectPracticeReadiness', 'Source profile pipeline must verify subject-practice readiness before succeeded.');
assertIncludes(aiQuestioningService, 'onlineMockExamReadiness', 'Source profile pipeline must verify online-mock readiness before succeeded.');
assertIncludes(aiQuestioningService, 'versionGovernance: {', 'Source profile pipeline result must expose version governance summaries.');
assertIncludes(aiQuestioningService, 'const eligibleQuestionCount = Math.max(0, scan.eligibleQuestionCount);', 'Source profile pipeline must calculate eligible source-question count before coverage.');
assertIncludes(aiQuestioningService, 'const mappingCoverage = eligibleQuestionCount > 0 ? scan.autoApprovedCount / eligibleQuestionCount : 0;', 'Source profile pipeline must calculate mapping coverage.');
assertIncludes(aiQuestioningService, 'if (mappingCoverage < requiredMappingCoverage)', 'Source profile pipeline must block when source-question mapping coverage is incomplete.');
assertIncludes(aiQuestioningService, "error: mappingGapReason ?? 'source_mapping_coverage_low'", 'Source profile pipeline must persist the specific blocked reason instead of collapsing every mapping gap into source_mapping_coverage_low.');
assertIncludes(aiQuestioningService, "out_of_syllabus_review_required", 'Source profile pipeline must distinguish syllabus gaps from generic low mapping coverage.');
assertIncludes(aiQuestioningService, "low_confidence_mapping_review_required", 'Source profile pipeline must distinguish low-confidence mapping gaps from generic low mapping coverage.');
assertIncludes(aiQuestioningService, 'mappingGapDiagnosis', 'Source profile pipeline blocked result must expose a structured mapping-gap diagnosis.');
assertIncludes(aiQuestioningService, 'residualUnmappedCount', 'Source profile pipeline mapping detail must separate residual unmapped questions from out-of-syllabus candidates.');
assertIncludes(aiQuestioningService, '"status" IN (\'succeeded\', \'blocked\', \'failed\')', 'Source reference summary must treat blocked pipeline tasks as terminal current state.');
assertIncludes(aiQuestioningService, '"latestTerminalAt"', 'Source reference summary must not let old succeeded tasks hide newer blocked tasks.');
assertIncludes(sourceReferenceSummarySection, '"pipelineMappedQuestionCount"', 'Source reference summary must expose pipeline-grade mapped question count.');
assertIncludes(sourceReferenceSummarySection, '"lowConfidenceQuestionCount"', 'Source reference summary must expose low-confidence source question count.');
assertIncludes(sourceReferenceSummarySection, '"outOfSyllabusQuestionCount"', 'Source reference summary must expose out-of-syllabus source question count.');
assertIncludes(sourceReferenceSummarySection, 'pipelineMappingIncomplete', 'Source reference summary must derive incomplete mapping from current source facts.');
assertIncludes(sourceReferenceSummarySection, "status: pipelineMappingIncomplete ? 'source_mapping_incomplete' : pipelineRow.status", 'Source reference summary must not expose a stale succeeded pipeline as completed when current mappings are incomplete.');
assertIncludes(sourceReferenceSummarySection, 'currentSourceMappingIncomplete', 'Source reference summary must diagnose incomplete current source mappings even when no pipeline task record exists.');
assertIncludes(sourceReferenceSummarySection, "action: 'summary_diagnostic'", 'Source reference summary must expose a diagnostic pipeline state when no source-profile task exists but current mappings are incomplete.');
assertIncludes(sourceReferenceSummarySection, 'mappingGapDiagnosis', 'Source reference summary must expose mapping-gap diagnosis when a historical pipeline is no longer complete.');
assertIncludes(sourceReferenceSummarySection, '查看未映射、低置信或疑似超纲题', 'Source reference summary must include an operator next action for incomplete mapping.');
assertIncludes(sourceReferenceLibraryPanel, 'mapping.outOfSyllabusCount', 'Source reference pipeline detail must distinguish out-of-syllabus candidates from low-confidence mapping gaps.');
assertIncludes(sourceReferenceLibraryPanel, 'mapping.gapReason', 'Source reference pipeline detail must show the dominant mapping-gap reason.');
assertIncludes(sourceReferenceLibraryPanel, 'mappingGapDiagnosis.nextAction', 'Source reference pipeline detail must fallback to structured mapping-gap diagnosis next action.');
assertIncludes(sourceReferenceLibraryPanel, "pipelineTask?.status === 'source_mapping_incomplete'", 'Source reference UI must treat source_mapping_incomplete as an incomplete pipeline state.');
assertIncludes(sourceReferenceLibraryPanel, 'summary_diagnostic', 'Source reference UI must label pipeline-less current source diagnostics.');
assertIncludes(sourceReferenceLibraryPanel, 'pipelineMappingIncomplete ||', 'Source reference UI must keep refreshing while current mappings are incomplete.');
assertIncludes(sourceReferenceLibraryPanel, 'sourceReferenceSummary.lowConfidenceQuestionCount', 'Source reference workflow summary must show low-confidence source question count.');
assertIncludes(sourceReferenceLibraryPanel, 'sourceReferenceSummary.outOfSyllabusQuestionCount', 'Source reference workflow summary must show out-of-syllabus source question count.');
assertIncludes(scanSourceProfilePipelineSection, 'WITH active_docs AS', 'Source profile pipeline scan must scope active documents before counting questions.');
assertIncludes(scanSourceProfilePipelineSection, 'AND sq."syllabus_version" = ${syllabusVersion}', 'Source profile pipeline scan must not count same-subject source documents from another syllabus version.');
assertIncludes(generationReadinessForUseCaseSection, 'AND sq."syllabus_version" = ${syllabusVersion}', 'Generation readiness must not count same-subject source documents from another syllabus version.');
assertIncludes(sourceProfilePipelineRunnerSection, "'source_profile_pipeline_ready'", 'Source profile pipeline must wake automatic replenishment after both generation profiles are ready.');
assertIncludes(sourceProfilePipelineRunnerSection, 'autoReplenishmentWake', 'Source profile pipeline result must expose automatic replenishment wake status.');
assertOrder(
  sourceProfilePipelineRunnerSection,
  "if (!subjectPracticeReadiness.ready || !onlineMockExamReadiness.ready)",
  "const subjectPracticePredictiveWake = autoProductionSetting.effectiveEnabled",
  'Source profile pipeline must only wake automatic replenishment after readiness has passed.'
);
assertIncludes(sourceProfilePipelineRunnerSection, "'source_profile_pipeline_ready'", 'Source profile pipeline predictive wake must preserve the ready trigger.');
assertIncludes(aiQuestioningService, 'activateExamSeriesProfile', 'Service must support activating a historical exam-series profile.');
assertIncludes(aiQuestioningService, 'activateGenerationProfile', 'Service must support activating a historical generation profile.');
assertIncludes(aiQuestioningService, 'refreshVersionGovernanceAfterGenerationProfile', 'Generation profile changes must trigger question version governance.');
assertIncludes(aiQuestioningService, 'refreshQuestionVersionGovernance', 'Service must support batch question version governance.');
assertIncludes(aiQuestioningService, 'generationReadinessForUseCase', 'Generation readiness must be evaluated per use case.');
assertIncludes(aiQuestioningService, 'assertOnlineMockExamGenerationReady', 'Service must expose online mock exam generation readiness.');
assertIncludes(aiQuestioningService, 'activeGenerationProfileForUseCase', 'Subject practice must resolve active generation profile by use case.');
assertIncludes(questionVersionGovernance, "STUDENT_CONSUMABLE_AI_VERSION_STATUSES = ['current', 'legacy_usable', 'manual_published']", 'Student-consumable AI version statuses must be centralized.');
assertIncludes(questionVersionGovernance, 'isStudentConsumableAiVersionStatus', 'Student-side services must share one AI version-governance predicate.');
assertIncludes(aiQuestioningService, "existingVersionStatus === 'manual_published'", 'Question version governance refresh must preserve manually published AI versions.');
assertIncludes(aiQuestioningService, "reason = cleanString(existingVersionGovernance.reason, 'manual_published_preserved')", 'Manual-published governance preservation must remain auditable.');
assertIncludes(aiQuestioningService, "classifiedBy: status === 'manual_published' ? cleanString(existingVersionGovernance.classifiedBy, 'manual') : 'system'", 'Manual-published governance must preserve human/manual classification ownership.');
assertIncludes(listQuestionLedgerSection, "${readyOnly}::boolean = false\n          OR COALESCE(q.\"generation_metadata\"->'versionGovernance'->>'status', 'unknown_legacy') IN ('current', 'legacy_usable', 'manual_published')", 'Ready-only formal AI asset ledger must hide stale, retired, and unknown-legacy AI versions while allowing manually published AI versions.');
assertIncludes(
  aiQuestioningService,
  "const useCase = aiQuestionScopeForBlueprint(blueprint).targetUseCase === 'online_mock_exam' ? 'online_mock_exam' : 'subject_practice';",
  'Blueprint profile selection must branch by target use case instead of hard-coding subject_practice.'
);
assertIncludes(
  aiQuestioningService,
  'if (!generationProfile)',
  'Profile selection must block when current generation profile is missing.'
);
assertIncludes(aiQuestioningService, '不能进入${useCaseLabel} AI 出题流程', 'Profile selection must explain that generation profile is mandatory.');
assertNotIncludes(aiQuestioningService, ': await this.activeStyleProfileForBlueprint(blueprint)', 'Automatic subject-practice generation must not fallback to legacy style profile.');

for (const snippet of [
  'generationProfileMetadata',
  'generationProfileId: profile.id',
  'seriesProfileId: profile.seriesProfileId',
  'sourceStyleProfileId: profile.sourceStyleProfileId',
  'sourceProfileIds',
  'profileWindow',
  'profilePolicyVersion',
  '...generationProfileMetadata(styled.generationProfile)',
  '...generationProfileMetadata(styledBlueprint.generationProfile)'
]) {
  assertIncludes(aiQuestioningService, snippet, `Subject-practice metadata lineage must include ${snippet}.`);
}
assertIncludes(aiQuestioningService, 'generationProfileLineageIsStale', 'Generation jobs must detect stale queued lineage before processing.');
assertIncludes(aiQuestioningService, 'function generationProfileStableSnapshotLineage', 'Legacy production refresh must compare stable source/syllabus snapshots instead of unstable regenerated profile ids.');
assertIncludes(aiQuestioningService, 'private async generationProfileByIdForUseCase', 'Subject-practice production jobs must be able to reload their pinned generation profile by id.');
assertIncludes(aiQuestioningService, 'const queuedProductionGenerationProfileId = isSubjectPracticeProductionJob', 'Subject-practice production jobs must pin processing to the queued run generation profile while other workflows keep active-profile freshness checks.');
assertIncludes(aiQuestioningService, 'const currentHasLineage = (Number.isInteger(currentGenerationProfileId) && currentGenerationProfileId > 0)', 'Generation jobs must treat current generation-profile lineage as mandatory.');
assertIncludes(aiQuestioningService, 'if (!queued.hasLineage) return currentHasLineage;', 'Generation jobs without queued lineage must be archived when a current generation profile exists.');
assertNotIncludes(aiQuestioningService, 'if (!queued.hasLineage) return false;', 'Generation jobs must not treat missing queued lineage as safe.');
assertIncludes(aiQuestioningService, "archiveGenerationJob(jobId, 'archived_stale_profile')", 'Generation jobs must archive queued work from superseded profiles.');
assertIncludes(aiQuestioningService, 'classifyInsertedQuestionVersionGovernance', 'Newly inserted AI questions must classify version governance immediately.');
assertIncludes(insertQuestionSection, 'const versionGovernance = await this.classifyInsertedQuestionVersionGovernance(question, metadataWithGenerationInteraction);', 'insertQuestion must compute version governance before the final metadata update.');
assertIncludes(insertQuestionSection, 'versionGovernance', 'insertQuestion must write versionGovernance into generation metadata.');
assertOrder(
  insertQuestionSection,
  'const metadataWithGenerationInteraction = agentRunMetadata(metadataWithSimilarity, { generationInteractionId });',
  'const versionGovernance = await this.classifyInsertedQuestionVersionGovernance(question, metadataWithGenerationInteraction);',
  'insertQuestion must classify version governance after generation interaction lineage is attached.'
);
assertIncludes(aiQuestioningService, 'const activeProfile = await this.activeGenerationProfileForUseCase(question.subject, question.syllabusVersion, targetUseCase);', 'Inserted question governance must compare against the active generation profile for its use case.');
assertIncludes(aiQuestioningService, 'return classifyQuestionVersionGovernance({', 'Inserted question governance must reuse the same classifier as batch governance.');
assertIncludes(aiQuestioningService, 'const currentVersionGovernance = versionGovernanceFromMetadata(row.generationMetadata);', 'Question approval must preserve existing version governance instead of overwriting it.');
assertIncludes(mockExamService, 'const currentVersionGovernance = recordFrom(generation.versionGovernance) ?? {};', 'Mock exam approval must preserve existing version governance instead of overwriting it.');
assertNotIncludes(aiQuestioningService, "versionGovernance: {\n                status: 'current',", 'Subject-practice approval must not replace full version governance with a shallow current status.');
assertNotIncludes(mockExamService, "versionGovernance: {\n              status: 'current',", 'Mock exam approval must not replace full version governance with a shallow current status.');

assertIncludes(mockExamService, 'activeGenerationProfileForMockExam', 'Online mock exam must resolve active generation profile.');
assertIncludes(mockExamService, 'this.aiQuestioningService.assertOnlineMockExamGenerationReady(subject, syllabusVersion)', 'Online mock exam automatic generation must require fresh online_mock_exam readiness.');
assertNotIncludes(mockExamService, 'const profile = await this.activeStyleProfileForMockExam(subject, syllabusVersion)', 'Online mock exam automatic generation must not fallback to legacy style profile.');
assertIncludes(mockExamService, 'mockExamGenerationProfileLineage', 'Online mock exam blueprint profile must expose generation profile lineage.');
assertIncludes(mockExamService, 'generationProfileId: lineage?.generationProfileId', 'Online mock exam style profile reference must include generationProfileId.');
assertIncludes(mockExamService, 'profileWindow: lineage?.profileWindow', 'Online mock exam style profile reference must include profile window.');
assertIncludes(mockExamService, 'sourceSnapshotHash: lineage?.sourceSnapshotHash', 'Online mock exam style profile reference must include source snapshot hash.');
assertIncludes(mockExamService, 'syllabusSnapshotHash: lineage?.syllabusSnapshotHash', 'Online mock exam style profile reference must include syllabus snapshot hash.');
assertIncludes(mockExamService, 'mockExamGenerationLineageFromSlotResults', 'Online mock generation parent jobs must read their queued generation lineage.');
assertIncludes(mockExamService, 'mockExamLineageIsStale', 'Online mock generation parent jobs must detect stale generation lineage.');
assertIncludes(mockExamService, 'generationLineage', 'Online mock generation parent slot results must persist generation lineage.');
assertIncludes(mockExamService, 'archived_stale_profile: 这条在线模考生成任务绑定的当前出题画像已经过期', 'Online mock generation parent jobs must not silently rebind to a newer generation profile.');
assertIncludes(mockExamService, '(draft.blueprint.profile as Record<string, unknown>).sourceStyleProfile = this.mockExamStyleProfileReference(styleProfile)', 'Online mock exam blueprint creation must persist generation-profile lineage.');
assertIncludes(mockExamService, 'const currentProfileReference = this.mockExamStyleProfileReference(styleProfile)', 'Online mock exam blueprint recalibration must compute the current generation-profile lineage reference.');
assertIncludes(mockExamService, 'const profilePatch = { sourceStyleProfile: currentProfileReference }', 'Online mock exam blueprint recalibration must refresh generation-profile lineage.');
assertIncludes(mockExamService, 'this.hasMockExamStyleProfileReference(detail.blueprint.profile, currentProfileReference)', 'Online mock exam blueprint reference checks must compare the current generation-profile lineage reference.');
assert(
  countOccurrences(mockExamService, "COALESCE(q.\"generation_metadata\"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')") >= 2
    && mockExamService.includes("COALESCE(\"generation_metadata\"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')"),
  'Online mock exam candidate promotion, approved slot loading, and draft assembly must all filter AI questions by version governance.'
);

for (const [label, source] of [
  ['adaptive question provider', adaptiveQuestionProvider],
  ['adaptive planner', adaptivePlanner],
  ['adaptive service', adaptiveService],
  ['AI coach service', aiCoachService],
  ['public special-practice service', specialPracticeService],
  ['me wrong-question service', meService]
]) {
  assertIncludes(source, 'isUsableQuestionVersion', `${label} must define or use version-governance filtering.`);
  assertIncludes(source, 'isStudentConsumableAiVersionStatus(status)', `${label} must use the centralized AI version-governance predicate.`);
}
assertIncludes(adaptiveQuestionProvider, 'isUsableQuestionVersion(row.generationMetadata)', 'Adaptive question provider must filter AI-backed subject-practice rows by version governance.');
assertIncludes(adaptivePlanner, 'isUsableQuestionVersion(row.generationMetadata)', 'Adaptive planner remediation sources must filter AI-backed rows by version governance.');
assertIncludes(adaptivePlanner, "variant.sourceType !== 'ai' || isUsableQuestionVersion(variant.generationMetadata)", 'Adaptive planner remediation variants must reject stale AI variants.');
assertIncludes(adaptiveService, 'isUsableQuestionVersion(question.generationMetadata)', 'Adaptive service question hydration must reject stale AI question versions.');
assertIncludes(aiCoachService, 'isUsableQuestionVersion(row.generationMetadata)', 'AI coach question context must reject stale AI-backed subject-practice rows.');
assertIncludes(specialPracticeService, 'isUsableQuestionVersion(row.generationMetadata)', 'Public special-practice question listing must filter AI-backed rows by version governance.');
assertIncludes(meService, 'isUsableQuestionVersion(row.generationMetadata)', 'Wrong-question special-practice rows must filter AI-backed rows by version governance.');
assertIncludes(meService, 'isUsableQuestionVersion(question.generationMetadata)', 'Wrong-question adaptive csca-question rows must filter AI-backed rows by version governance.');

assertIncludes(refreshSubjectPracticeProductionRunSection, 'q."review_metadata"->\'subjectPracticeAutoApproval\'->>\'status\' = \'published_to_subject_practice\'', 'Subject-practice production completion must count formally published approved questions, not raw candidates.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'q."review_metadata"->\'subjectPracticeAutoApproval\'->>\'targetUseCase\' = \'subject_practice\'', 'Subject-practice production published counts must be scoped to subject_practice.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'const planLineage = recordFrom(recordFrom(run.plan)?.generationProfileLineage);', 'Subject-practice production refresh must prefer the generation-profile lineage pinned on the run plan.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'const activeGenerationProfile = planLineage ? null : await this.activeGenerationProfileForUseCase(', 'Legacy subject-practice production runs may fall back to active generation-profile lineage only when no run-pinned lineage exists.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'const activeGenerationLineage = planLineage ?? generationProfileStableSnapshotLineage(activeGenerationMetadata);', 'Legacy subject-practice production runs must fall back to stable source/syllabus snapshot lineage, not regenerated active profile ids.');
assertIncludes(refreshSubjectPracticeProductionRunSection, '${activeQuestionLineageFilter}', 'Subject-practice production published/candidate counts must ignore questions outside the run-pinned or legacy snapshot lineage.');
assertIncludes(refreshSubjectPracticeProductionRunSection, '${activeJobLineageFilter}', 'Subject-practice production running-job counts must ignore jobs outside the run-pinned or legacy snapshot lineage.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'const publishedTotal = refreshedCells.reduce((sum, cell) => sum + Math.min(cell.targetCount, cell.publishedCount), 0);', 'Subject-practice production runs must cap progress by each cell target.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'const terminalIncompleteCells = refreshedCells.filter((cell) => subjectPracticeCellIsTerminalIncomplete(cell));', 'Subject-practice production runs must identify terminal incomplete cells explicitly.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'subjectPracticeCellIsTerminalIncomplete(cell) ? sum : sum + Math.max(0, cell.targetCount - cell.publishedCount)', 'Subject-practice production runs must keep running until every non-terminal target cell has enough published questions.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'openTotal <= 0', 'Subject-practice production runs may complete only when the open published-question target reaches zero.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'completedManualResumeLease', 'Subject-practice production completion must close the manual resume lease instead of leaving it active.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'subject_practice_production_run_completed', 'Subject-practice production completion must archive surplus queued/running jobs for the completed run.');
assertIncludes(refreshSubjectPracticeProductionRunSection, 'runAggregateChanged', 'Subject-practice production refresh must update run.updated_at when real aggregate/status values change, while keeping pure polling quiet.');
assertIncludes(aiQuestioningService, 'SUBJECT_PRACTICE_PRODUCTION_RUN_LOCK_NAMESPACE', 'Subject-practice production creation must use a database-level subject lock to prevent duplicate same-subject batches.');
assertIncludes(aiQuestioningService, 'pg_advisory_xact_lock(${SUBJECT_PRACTICE_PRODUCTION_RUN_LOCK_NAMESPACE}::int, hashtext(${subject})::int)', 'Subject-practice production creation must serialize same-subject inserts across backend processes.');
assertIncludes(aiQuestioningService, 'generationProfileLineage: planningGenerationLineage', 'Subject-practice production creation must audit the generation-profile lineage used for planning.');
assertIncludes(aiQuestioningService, 'generationProfileId: pinnedRunGenerationProfileId', 'Subject-practice production enqueue must pass the run-pinned generation profile to generated jobs.');
assertIncludes(aiQuestioningService, 'duplicateRunningRows', 'Subject-practice lifecycle reconciliation must detect duplicate running subject batches.');
assertIncludes(aiQuestioningService, 'duplicate_subject_production_run', 'Subject-practice lifecycle reconciliation must stop duplicate running subject batches.');
const autoToggleSection = adminQuestionBankPage.slice(
  adminQuestionBankPage.indexOf('function toggleSubjectAutoProduction'),
  adminQuestionBankPage.indexOf('function ', adminQuestionBankPage.indexOf('function toggleSubjectAutoProduction') + 1)
);
assert(
  autoToggleSection.includes('updateAdminSubjectPracticeAutoProductionSetting')
    && !autoToggleSection.includes('runAdminAdaptiveReplenishment'),
  'Subject auto-production toggle must not synchronously call adaptive replenishment; the backend setting update owns the automatic wake.'
);
assert(
  refreshSubjectPracticeProductionRunSection.includes('const candidateLimitReached = !hardBlocked')
    && refreshSubjectPracticeProductionRunSection.includes('slimSubjectPracticeProductionCellCandidates')
    && refreshSubjectPracticeProductionRunSection.includes('subjectPracticeProductionProProfile')
    && refreshSubjectPracticeProductionRunSection.includes('proCandidateLimitReached'),
  'Subject-practice production cells must clean up or escalate candidate pileups instead of growing indefinitely.'
);
assertIncludes(processSubjectPracticeProductionRunSection, 'processSubjectPracticeRepairBacklog', 'Subject-practice production must process abnormal candidate backlog before dispatching more generation jobs.');
assertIncludes(processSubjectPracticeProductionRunSection, "THEN 'no_progress'", 'Subject-practice production must block after repeated rounds without newly published questions.');
assertIncludes(processSubjectPracticeProductionRunSection, '"max_no_progress_rounds"', 'Subject-practice production no-progress blocking must use the configured max round guard.');
assertIncludes(processSubjectPracticeProductionRunSection, 'isSubjectPracticeManualResumeBlockReason(run.blockedReasonCode)', 'Manual subject-practice resume must reopen recoverable auto-disabled/no-progress blocks.');
assertIncludes(processSubjectPracticeProductionRunSection, 'isSubjectPracticeRecoverableReadinessBlockReason(run.blockedReasonCode)', 'Subject-practice production must reopen restored source/generation profile readiness blocks after readiness is healthy again.');
assertIncludes(processSubjectPracticeProductionRunSection, 'subjectPracticeRunLineageMatchesReadyProfile(runGenerationProfileLineage, readiness)', 'Restored profile-readiness resume must verify the run-pinned stable lineage still matches the active generation profile snapshots.');
assertIncludes(processSubjectPracticeProductionRunSection, '"no_progress_rounds" = 0', 'Manual subject-practice resume must start a fresh no-progress window.');
assertIncludes(aiQuestioningService, 'function subjectPracticeRunHasManualResumeLease', 'Subject-practice production must distinguish manual resume runs from unattended automatic runs.');
assertIncludes(aiQuestioningService, 'will drain and no next batch will be started', 'Auto-disabled lifecycle reconciliation must let already running production runs drain.');
assertIncludes(aiQuestioningService, 'production_run."status" = \'running\'', 'Auto production runner filters must keep already running production runs eligible even when the subject auto switch is off.');
assertIncludes(aiQuestioningService, 'drainingAutoDisabledRuns', 'Auto production runner lifecycle summaries must report draining disabled runs instead of stopped disabled runs.');
assertIncludes(aiQuestioningController, 'processSubjectPracticeProductionRun(id, body, user?.id)', 'Admin subject-practice process actions must pass the actor id so the backend can mark a manual resume lease.');
assertIncludes(processSubjectPracticeProductionRunSection, 'roundBacklogWaiting += runBacklogResult.waiting', 'Subject-practice no-progress accounting must treat waiting regenerate jobs as production activity.');
assertIncludes(processSubjectPracticeProductionRunSection, 'roundBacklogWaiting += backlogResult.waiting', 'Subject-practice no-progress accounting must include cell-scoped waiting regenerate jobs.');
assertIncludes(processSubjectPracticeProductionRunSection, '仍有 ${refreshed?.openTotal ?? 0} 道合格题缺口', 'Subject-practice production response must report remaining qualified published-question gaps.');
assertIncludes(aiQuestioningService, 'subjectPracticeAutoPublishable(refreshedCandidate)', 'Subject-practice backlog repair must first promote already publishable candidates.');
assertIncludes(aiQuestioningService, "action: 'repair_in_place'", 'Subject-practice backlog repair must optimize repairable candidates in place before replacement.');
assertIncludes(aiQuestioningService, "action: 'hard_regenerate'", 'Subject-practice backlog repair must regenerate only hard-failed candidates.');
assertIncludes(aiQuestioningService, 'function subjectPracticeProductionSoftCandidateBudget', 'Subject-practice production must use a remaining-gap soft budget for final-stage candidate dispatch.');
assertIncludes(aiQuestioningService, 'pressure.runningJobCount >= pressure.softCandidateBudget', 'Subject-practice hard regeneration must pause when active regenerate jobs already cover the remaining gap buffer.');
assertIncludes(aiQuestioningService, "reasonCode: 'active_regenerate_budget_reached'", 'Subject-practice hard regeneration skips must be auditable when the active soft budget is reached.');
assertIncludes(aiQuestioningService, 'function subjectPracticeProfileDifficultyEvidenceMismatch', 'Subject-practice auto-publish must compare inferred profile difficulty evidence with the target difficulty band.');
assertIncludes(aiQuestioningService, "profile_difficulty_evidence_mismatch", 'Subject-practice auto-publish must block and repair candidates whose inferred difficulty band differs from the production target.');

assertIncludes(generationProfileSmoke, "importAndRunRealFixture(", 'Generation profile smoke must use the shared real source JSON fixture runner.');
assertIncludes(generationProfileSmoke, "'docs/csca-math-past-paper-2025-12-en-source.json'", 'Generation profile smoke must import the real 48-question December 2025 math fixture.');
assertIncludes(generationProfileSmoke, "'docs/csca-math-past-paper-2026-03-en-source.json'", 'Generation profile smoke must import a second real 48-question math fixture to prove continuous-month profile refresh.');
assertIncludes(generationProfileSmoke, 'fixtureImport.createdQuestions === expectedCount', 'Generation profile smoke must prove each real fixture persists the expected source question count.');
assertIncludes(generationProfileSmoke, '"auto_profile_status" = \'pending\'', 'Generation profile smoke must prove imported source questions are initialized as pending auto-profile.');
assertIncludes(generationProfileSmoke, 'fixtureAutoProfileTask.succeeded === expectedCount', 'Generation profile smoke must prove each real fixture auto-profiles all source questions.');
assertIncludes(generationProfileSmoke, 'fixturePipelineTask?.result?.mapping?.mappedCount === expectedMappedCount', 'Generation profile smoke must prove the real fixture pipeline maps the active continuous-month source set.');
assertIncludes(generationProfileSmoke, 'fixturePipelineTask?.result?.profiles?.onlineMockExamGenerationProfile === \'succeeded\'', 'Generation profile smoke must prove the real fixture creates the online-mock generation profile.');
assertIncludes(generationProfileSmoke, 'function assertNormalizedPaperTarget', 'Generation profile smoke must verify normalized 48-question target distributions at runtime.');
assertIncludes(generationProfileSmoke, 'assertNormalizedPaperTarget(series.profile.trendProfile?.normalizedTargets?.onlineMockExam', 'Generation profile smoke must verify trend-profile normalized targets.');
assertIncludes(generationProfileSmoke, 'assertNormalizedPaperTarget(onlineMock.profile.targetPolicy?.normalizedTarget', 'Generation profile smoke must verify online-mock generation target policy quotas.');
assertIncludes(generationProfileSmoke, 'Second real fixture trend profile should cover two active 48-question past papers', 'Generation profile smoke must prove a second real past-paper month expands the active trend profile to 96 samples.');
assertIncludes(generationProfileSmoke, "profile.status === 'superseded'", 'Generation profile smoke must prove first-month generation profiles are superseded after the second real month import.');
assertIncludes(generationProfileSmoke, "pipelineTask?.action === 'summary_diagnostic'", 'Generation profile smoke must prove current source mapping gaps are diagnosed even when no pipeline task exists.');
assertIncludes(generationProfileSmoke, "pipelineTask.status === 'source_mapping_incomplete'", 'Generation profile smoke must prove pipeline-less source mapping gaps are exposed as source_mapping_incomplete.');
assertIncludes(generationProfileSmoke, "blockedPipelineTask?.status === 'blocked'", 'Generation profile smoke must prove incomplete source mapping coverage blocks the source profile pipeline.');
assertIncludes(generationProfileSmoke, "blockedPipelineTask?.error === 'source_mapping_coverage_low'", 'Generation profile smoke must prove incomplete source mapping coverage exposes source_mapping_coverage_low.');
assertIncludes(generationProfileSmoke, "blockedPipelineTask?.result?.mapping?.mappedCount === 8 && blockedPipelineTask?.result?.mapping?.unmappedCount === 2", 'Generation profile smoke must prove blocked source profile pipeline results preserve mapping gap counts.');
assertIncludes(generationProfileSmoke, 'Smoke superseding subject-practice profile', 'Generation profile smoke must create a newer active profile to test stale queued lineage.');
assertIncludes(generationProfileSmoke, "processedStaleLineage.items[0].promptMetadata?.archiveNote === 'archived_stale_profile'", 'Generation profile smoke must prove queued jobs from superseded generation profiles are archived before provider execution.');

for (const apiFunction of [
  'listAdminAIQuestioningExamSeriesProfiles',
  'generateAdminAIQuestioningExamSeriesProfile',
  'activateAdminAIQuestioningExamSeriesProfile',
  'listAdminAIQuestioningGenerationProfiles',
  'generateAdminAIQuestioningGenerationProfile',
  'activateAdminAIQuestioningGenerationProfile',
  'refreshAdminAIQuestioningQuestionVersionGovernance'
]) {
  assertIncludes(apiAdmin, apiFunction, `Frontend API must include ${apiFunction}.`);
}

assertIncludes(apiTypes, 'AdminAIQuestioningExamSeriesProfile', 'Frontend API types must include exam-series profile.');
assertIncludes(apiTypes, 'AdminAIQuestioningGenerationProfile', 'Frontend API types must include generation profile.');
assertIncludes(apiTypes, 'AdminAIQuestioningGenerationReadiness', 'Frontend API types must expose generation readiness details.');
assertIncludes(apiTypes, 'currentSourceSnapshotHash', 'Frontend readiness types must include current source snapshot hash.');
assertIncludes(apiTypes, 'activeGenerationSyllabusSnapshotHash', 'Frontend readiness types must include active generation syllabus snapshot hash.');

assertIncludes(sourceReferenceDataRefresh, 'listAdminAIQuestioningExamSeriesProfiles({ subject: subject || undefined, limit: 12 })', 'Source reference refresh must load recent exam-series profiles, not only active ones.');
assertIncludes(sourceReferenceDataRefresh, 'listAdminAIQuestioningGenerationProfiles({ subject: subject || undefined, limit: 12 })', 'Source reference refresh must load recent generation profiles, not only active ones.');
assertIncludes(sourceReferenceLibraryPanel, '只刷新真题参考库和当前画像进度，不刷新整页', 'Source reference refresh button must be explicitly scoped to status refresh.');
assertIncludes(sourceReferenceLibraryPanel, '刷新进度', 'Source reference document card must expose a local progress refresh action.');
assertIncludes(sourceReferenceLibraryPanel, 'onRefreshSourceReference();', 'Source reference local progress refresh must call the read-only refresh handler.');
for (const mutationName of [
  'generateAdminAIQuestioningStyleProfile',
  'generateAdminAIQuestioningExamSeriesProfile',
  'generateAdminAIQuestioningGenerationProfile',
  'activateAdminAIQuestioningExamSeriesProfile',
  'activateAdminAIQuestioningGenerationProfile',
  'refreshAdminAIQuestioningQuestionVersionGovernance',
  'startAdminAIQuestioningSourceProfilePipelineRebuild',
  'startAdminAIQuestioningSourceAutoProfileTask',
  'startAdminAIQuestioningSourceTopicTask',
  'importAdminAIQuestioningSourceDocument',
  'reprocessAdminAIQuestioningSourceDocument',
  'runAction('
]) {
  assertNotIncludes(sourceReferenceDataRefresh, mutationName, `Source reference refresh must stay read-only and must not call ${mutationName}.`);
}
assertOrder(sourceReferenceLibraryPanel, '刷新进度', '重新解析映射', 'Source reference progress refresh must be visually separated from destructive/reprocessing actions.');

assertIncludes(sourceReferenceActions, 'generateCurrentExamSeriesProfile', 'Source reference actions must generate exam-series profiles.');
assertIncludes(sourceReferenceActions, 'generateCurrentGenerationProfiles', 'Source reference actions must generate current generation profiles.');
assertIncludes(sourceReferenceActions, 'refreshQuestionVersionGovernance', 'Source reference actions must refresh question version governance.');
assertIncludes(sourceReferenceActions, 'activateExamSeriesProfile', 'Source reference actions must activate exam-series profiles.');
assertIncludes(sourceReferenceActions, 'activateGenerationProfile', 'Source reference actions must activate generation profiles.');
assertNotIncludes(sourceReferenceActions, 'importMockExamPaperAsSourceDocument', 'Source reference actions must not import mock exam papers as source documents.');
assertIncludes(sourceReferenceActions, 'startAdminAIQuestioningSourceProfilePipelineRebuild', 'Source reference actions must call the source profile pipeline rebuild API.');
assertIncludes(sourceReferenceActions, 'rebuildSourceProfilePipeline', 'Source reference actions must expose source profile pipeline rebuild.');

for (const source of [sourceReferenceProps, sourceReferenceWorkspace, styleProfilePanel]) {
  assertIncludes(source, 'onActivateExamSeriesProfile', 'Source reference workspace must pass exam-series activation through the UI.');
  assertIncludes(source, 'onActivateGenerationProfile', 'Source reference workspace must pass generation-profile activation through the UI.');
  assertIncludes(source, 'onRefreshQuestionVersionGovernance', 'Source reference workspace must pass question version governance refresh through the UI.');
}

for (const source of [sourceReferenceProps, sourceReferenceWorkspace]) {
  assertIncludes(source, 'onRebuildSourceProfilePipeline', 'Source reference workspace must pass source profile pipeline rebuild through the UI.');
  assertIncludes(source, 'isSourceProfilePipelineBusy', 'Source reference workspace must expose source profile pipeline rebuild busy state.');
}

assertNotIncludes(sourceReferenceLibraryPanel, '模考卷 ID', 'Source reference library UI must not expose mock exam paper import into source profile pipeline.');
assertNotIncludes(sourceReferenceLibraryPanel, '导入为源卷', 'Source reference library UI must not label mock exam assets as source documents.');
assertIncludes(sourceReferenceLibraryPanel, 'source_document_reprofiled', 'Source reference library UI must label source document reprofile pipeline triggers.');
assertIncludes(sourceReferenceLibraryPanel, 'source_document_deleted', 'Source reference library UI must label source document delete rebuild pipeline triggers.');
assertIncludes(sourceReferenceLibraryPanel, 'startup_reconcile', 'Source reference library UI must label startup reconcile pipeline triggers.');
assertIncludes(apiTypes, 'source_document_deleted', 'Frontend API types must include source document delete rebuild pipeline actions.');
assertIncludes(apiTypes, 'AdminAIQuestioningSourceDocumentCleanupResult', 'Frontend API types must expose source document cleanup rebuild pipeline results.');
assertIncludes(sourceReferenceActions, 'sourceDocumentCleanupRebuildHint', 'Source reference actions must show source document cleanup rebuild pipeline feedback.');
assertIncludes(sourceReferenceActions, '系统会自动重建画像', 'Source reference cleanup prompts must explain automatic rebuild after source document deletion.');
assertIncludes(sourceReferenceLibraryPanel, 'sourcePipelineDetailItems', 'Source reference library UI must expose source profile pipeline detail rows.');
assertIncludes(sourceReferenceLibraryPanel, '映射覆盖', 'Source reference library UI must show source profile mapping coverage.');
assertIncludes(sourceReferenceLibraryPanel, 'source_mapping_incomplete', 'Source reference library UI must avoid showing completed when mapping is incomplete.');
assertIncludes(sourceReferenceLibraryPanel, 'pipelineMappingIncomplete', 'Source reference library UI must derive incomplete mapping state from current summary.');
assertIncludes(sourceReferenceLibraryPanel, 'const pipelineMappedQuestionCount', 'Source reference library UI must normalize mapped counts to the pipeline-grade mapping metric.');
assertIncludes(sourceReferenceLibraryPanel, 'value: pipelineMappedQuestionCount', 'Source reference workflow summary must display pipeline-grade mapped question count.');
assertNotIncludes(sourceReferenceLibraryPanel, '映射 ${sourceReferenceSummary.mappedQuestionCount}/${sourceReferenceSummary.questionCount}', 'Source reference pipeline warning must not use legacy mapped count when reporting incomplete pipeline mappings.');
assertIncludes(sourceReferenceLibraryPanel, '出题就绪', 'Source reference library UI must show generation readiness by use case.');
assertIncludes(sourceReferenceLibraryPanel, 'readinessSnapshotDetail', 'Source reference library UI must summarize generation readiness snapshot consistency.');
assertIncludes(sourceReferenceLibraryPanel, '快照一致性', 'Source reference library UI must show source/syllabus snapshot consistency.');
assertIncludes(sourceReferenceLibraryPanel, '版本治理', 'Source reference library UI must show question version governance summaries.');
assertIncludes(sourceReferenceLibraryPanel, 'autoReplenishmentWake', 'Source reference library UI must show automatic replenishment wake status.');
assertIncludes(sourceReferenceLibraryPanel, '自动补题唤醒', 'Source reference library UI must label automatic replenishment wake details.');
assertIncludes(sourceReferenceLibraryPanel, '重跑画像流水线', 'Source reference library UI must expose source profile pipeline manual rebuild recovery.');
assertIncludes(apiAdmin, 'startAdminAIQuestioningSourceProfilePipelineRebuild', 'Admin API client must expose source profile pipeline rebuild.');
assertIncludes(styleProfilePanel, '设为当前趋势', 'Style profile panel must allow activating a historical exam-series profile.');
assertIncludes(styleProfilePanel, '设为当前出题画像', 'Style profile panel must allow activating a historical generation profile.');
assertIncludes(styleProfilePanel, '运行版本治理', 'Style profile panel must expose manual question version governance refresh.');
assertIncludes(styleProfilePanel, "profile.status === 'active'", 'Style profile panel must distinguish active profile from superseded history.');
assertIncludes(styleProfilePanel, '自动出题会暂停', 'Style profile panel must explain that missing or stale generation profiles block automatic generation.');
assertIncludes(styleProfilePanel, '48题目标：难度配额', 'Style profile panel must display normalized 48-question difficulty targets separately from raw trend ratios.');
assertIncludes(styleProfilePanel, '48题目标：题型配额', 'Style profile panel must display normalized 48-question form targets separately from raw trend ratios.');
assertIncludes(styleProfilePanel, '48题目标：答案配额', 'Style profile panel must display normalized answer targets for mock paper assembly.');
assertIncludes(styleProfilePanel, '目标答案配额', 'Current generation profile UI must display answer target quotas.');
assertNotIncludes(styleProfilePanel, 'fallback 到旧单卷画像', 'Style profile panel must not imply automatic generation can fallback to old single-paper profiles.');
assertIncludes(read('frontend/src/components/admin/ai-question-bank/sourceReferenceImport.ts'), "SOURCE_DOCUMENT_TYPES = ['past_paper']", 'Frontend JSON preflight must only accept true past-paper profile sources.');
assertIncludes(read('scripts/validate-csca-source-json.cjs'), "SOURCE_TYPES = new Set(['past_paper'])", 'Local source JSON validator must only accept true past-paper profile sources.');

for (const section of [
  '## 19. 相邻代码与功能影响矩阵',
  '## 20. 可执行工作拆分',
  '## 21. 后台 UI 调整清单',
  '## 22. 旧数据与开发阶段清理策略',
  '## 23. 本方案完成后的判断标准'
]) {
  assertIncludes(executablePlan, section, `Executable plan must include ${section}.`);
}
assertIncludes(executablePlan, 'normalizedTargets.onlineMockExam', 'Executable plan must document online mock normalized targets.');
assertIncludes(executablePlan, '48 题归一化目标配额', 'Executable plan must distinguish raw sample ratios from 48-question normalized targets.');
assertIncludes(executablePlan, 'source_document_deleted', 'Executable plan must document source document deletion rebuild triggers.');
assertIncludes(autoProfileRefreshPlan, '| 删除 active past paper 源卷 | `source_document_deleted` |', 'Auto profile refresh plan must document source document delete rebuild pipeline events.');
assertIncludes(executablePlan, '答案分布也要纳入趋势画像', 'Executable plan must require answer distribution normalization.');
assertNotIncludes(executablePlan, 'mock_exam: 0.55', 'Executable plan must not assign profile weights to mock exam assets.');
assertNotIncludes(executablePlan, 'prediction_paper: 0.7', 'Executable plan must not assign profile weights to prediction paper assets.');
assertNotIncludes(executablePlan, 'reference_paper: 0.4', 'Executable plan must not assign profile weights to reference paper assets.');
assertIncludes(executablePlan, '只有 `past_paper` 可以进入画像管线', 'Executable plan must state that only true past papers can enter the source profile pipeline.');
assertIncludes(executablePlan, '自动链路不得 fallback 到 active style profile', 'Executable plan must block automatic fallback to legacy single-paper style profiles.');
assertIncludes(executablePlan, 'legacy style profile：只允许手工诊断，不允许自动入库', 'Executable plan must isolate legacy style profiles from automatic production.');
assertNotIncludes(executablePlan, '兼容期可以 fallback', 'Executable plan must not retain compatibility fallback wording for automatic generation.');
assertNotIncludes(executablePlan, 'legacy_style_profile: 自动闭环但标记旧画像模式', 'Executable plan must not allow legacy style profiles to enter the automatic loop.');
assertIncludes(autoProfileRefreshPlan, '真题导入入口只接受 `past_paper`', 'Auto profile refresh plan must reject non-past-paper documents at the true source import boundary.');
assertIncludes(autoProfileRefreshPlan, '上传 mock_exam/prediction_paper 到真题画像入口会被拒绝', 'Auto profile refresh plan must treat mock/prediction inputs as rejected source-profile imports.');
assertNotIncludes(sourceProfileVisualizationPlan, '"sourceType": "mock_exam"', 'Source profile visualization examples must not present mock exams as source-profile documents.');
assertIncludes(sourceProfileVisualizationPlan, '"sourceType": "past_paper"', 'Source profile visualization examples must use true past-paper source documents.');

assert(
  packageJson.scripts['csca-generation-profile:rules'] === 'node scripts/csca-continuous-exam-generation-profile-rules-test.cjs',
  'package.json must expose csca-generation-profile:rules.'
);

console.log('CSCA continuous exam-series generation profile rules passed.');
