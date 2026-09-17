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

function assertRegex(source, pattern, message) {
  assert(pattern.test(source), message);
}

const schema = read('backend/prisma/schema.prisma');
const migration = read('backend/prisma/migrations/0063_adaptive_predictive_replenishment_foundation/migration.sql');
const adaptiveService = read('backend/src/csca-special-practice/csca-adaptive.service.ts');
const aiQuestioningService = read('backend/src/ai-questioning/ai-questioning.service.ts');
const replenishmentService = read('backend/src/ai-questioning/adaptive-replenishment.service.ts');
const controller = read('backend/src/ai-questioning/ai-questioning.controller.ts');
const apiAdmin = read('frontend/src/lib/api-admin.ts');
const cscaSubjectPage = read('frontend/src/pages/CscaSubjectPage.tsx');
const adaptivePracticeViews = read('frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx');
const adaptivePracticePool = read('frontend/src/lib/adaptive-practice-pool.ts');
const publicRoutesSpec = read('frontend/e2e/public-routes.spec.ts');
const adminQuestionBankPage = read('frontend/src/pages/AdminAIQuestionBankPage.tsx');
const productionPanel = read('frontend/src/components/admin/ai-question-bank/SubjectPracticeProductionPanel.tsx');
const predictiveSmoke = read('scripts/csca-adaptive-predictive-replenishment-smoke.cjs');
const packageJson = JSON.parse(read('package.json'));

for (const model of [
  'model CscaLearningCohort',
  'model CscaStudentLearningCycle',
  'model CscaAdaptiveUsageAggregate',
  'model CscaAdaptiveInventorySnapshot',
  'model CscaAdaptiveInventoryEvent'
]) {
  assertIncludes(schema, model, `Prisma schema must include ${model}.`);
}

for (const table of [
  'CREATE TABLE "csca_learning_cohorts"',
  'CREATE TABLE "csca_student_learning_cycles"',
  'CREATE TABLE "csca_adaptive_usage_aggregates"',
  'CREATE TABLE "csca_adaptive_inventory_snapshots"',
  'CREATE TABLE "csca_adaptive_inventory_events"'
]) {
  assertIncludes(migration, table, `Migration must create ${table}.`);
}

assertIncludes(schema, 'userId               Int?     @map("user_id")', 'Usage aggregate must support user-level pressure.');
assertIncludes(schema, '@@index([organizationId, organizationCohortId, windowEnd]', 'Usage aggregate must support team/cohort pressure lookup.');
assertIncludes(schema, '@@index([userId, riskLevel, snapshotAt]', 'Inventory snapshots must support user-risk inspection.');

assertIncludes(adaptiveService, 'recordAdaptiveInventoryShortageEvents', 'Adaptive round creation must record shortage events.');
assertIncludes(adaptiveService, "'no_question_available'", 'Adaptive shortage events must use no_question_available event type.');
assertIncludes(adaptiveService, 'csca_adaptive_inventory_events', 'Adaptive shortage events must persist into inventory events.');
assertIncludes(adaptiveService, 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED', 'Adaptive round shortage must return a stable practice-pool-exhausted code.');
assertIncludes(adaptiveService, 'shortage: {', 'Adaptive round shortage response must include structured shortage diagnostics.');
assertIncludes(cscaSubjectPage, 'isAdaptivePracticePoolExhaustedError', 'Subject page must recognize adaptive practice pool exhaustion separately from generic errors.');
assertIncludes(cscaSubjectPage, 'adaptivePracticePoolExhaustedCopy', 'Subject page must show shared replenishing copy when adaptive practice pool is exhausted.');
assertIncludes(adaptivePracticeViews, 'nextRoundPoolExhausted', 'Adaptive report page must stop next-round preparation when practice pool is exhausted.');
assertIncludes(adaptivePracticeViews, 'isAdaptivePracticePoolExhaustedError', 'Adaptive report page must recognize the stable practice pool exhaustion code.');
assertIncludes(adaptivePracticeViews, 'adaptivePracticePoolExhaustedCopy', 'Adaptive report page must use shared replenishing copy when practice pool is exhausted.');
assertIncludes(adaptivePracticePool, 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED', 'Frontend practice-pool helper must keep the stable backend code.');
assertIncludes(adaptivePracticePool, '这组练习你已经刷完啦。', 'Frontend practice-pool helper must keep the cute replenishing message.');
assertIncludes(publicRoutesSpec, 'nextRoundPoolExhausted', 'Public route e2e coverage must include adaptive report pool-exhausted preparation.');

assertIncludes(aiQuestioningService, 'refreshAdaptiveUsageAggregates', 'AI questioning service must refresh adaptive usage aggregates.');
assertIncludes(aiQuestioningService, 'global_rolling_window', 'Usage aggregation must keep a global scope.');
assertIncludes(aiQuestioningService, 'team_rolling_window', 'Usage aggregation must keep a team scope.');
assertIncludes(aiQuestioningService, 'user_rolling_window', 'Usage aggregation must keep a user scope.');
assertIncludes(aiQuestioningService, 'adaptive_inventory_events', 'Usage aggregation must include inventory events.');
assertIncludes(aiQuestioningService, 'predictiveDemandTopicIds', 'Predictive demand topic selection must exist.');
assertIncludes(aiQuestioningService, 'runSubjectPracticePredictiveReplenishment', 'Predictive replenishment runner must exist.');
assertIncludes(aiQuestioningService, 'kickSubjectPracticePredictiveReplenishment', 'Scheduled predictive replenishment kick must exist.');
assertIncludes(aiQuestioningService, 'createSubjectPracticeProductionRun', 'Predictive replenishment must reuse subject-practice production runs.');
assertIncludes(aiQuestioningService, "triggerType: 'predictive_replenishment'", 'Created production run must be marked predictive_replenishment.');
assertIncludes(aiQuestioningService, 'csca_student_learning_cycles', 'Usage refresh must maintain student learning cycles.');
assertIncludes(aiQuestioningService, 'csca_learning_cohorts', 'Usage refresh must maintain team learning cohorts.');
assertIncludes(aiQuestioningService, 'expiredCohorts', 'Usage refresh must expire ended team learning cohorts.');
assertIncludes(aiQuestioningService, '"target_exam_at" + INTERVAL \'14 days\' < CURRENT_TIMESTAMP', 'Usage refresh must move cohorts past the exam grace window to inactive.');
assertIncludes(aiQuestioningService, 'learning_cohort."status" IN (\'cooling\', \'cooling_down\')', 'Predictive replenishment must treat cooling team cohorts as limited-pressure cohorts.');
assertIncludes(aiQuestioningService, 'COALESCE(aggregate."fallback_draw_count", 0) < 3', 'Cooling team cohorts must only trigger on severe fallback/no-question pressure.');
assertIncludes(aiQuestioningService, 'event_rows."organizationId" IS NULL', 'Global inventory-event pressure must not be polluted by team-only events.');
assertIncludes(aiQuestioningService, 'event_rows."userId" IS NOT NULL', 'Student shortage events may still contribute to global pressure, but team-only events must stay team-scoped.');
assertIncludes(aiQuestioningService, 'untilComplete: true', 'Predictive and scheduled subject production must continue toward cell targets.');
assertIncludes(aiQuestioningService, 'const maxRounds = cleanPositiveInt(body.maxRounds, 50, 1, 50);', 'Predictive replenishment API path must allow enough rounds to progress toward completion.');
assertIncludes(aiQuestioningService, 'const maxJobs = cleanPositiveInt(body.maxJobs, 30, 1, 30);', 'Predictive replenishment API path must allow the same job budget as manual subject-practice production.');
assertIncludes(aiQuestioningService, 'const inventoryGapItems = (inventory.items ?? [])', 'Predictive replenishment must derive production targets from inventory gaps.');
assertIncludes(aiQuestioningService, 'requiredPublishedCount > 0', 'Predictive replenishment must only create runs for inventory keys that still need formal published stock.');
assertIncludes(aiQuestioningService, 'globalEffectiveStock < maxStockCap', 'Predictive replenishment must stop creating runs when the inventory key has reached its max stock cap.');
assertIncludes(aiQuestioningService, 'learning_cohort."status" IN (\'inactive\', \'completed\', \'archived\')', 'Predictive replenishment must ignore inactive/completed/archived team cohort pressure.');
assertIncludes(aiQuestioningService, 'difficultyTargets,', 'Predictive replenishment must pass difficulty-level cycle targets into production runs.');
assertIncludes(aiQuestioningService, 'targetCount: Number(item.requiredPublishedCount ?? 0)', 'Predictive replenishment must create production cells for requiredPublishedCount, not full cycleTargetStock.');
assertIncludes(aiQuestioningService, 'requiredPublishedCount: Number(item.requiredPublishedCount ?? 0)', 'Predictive replenishment must preserve the required published gap in difficulty targets.');
assertIncludes(aiQuestioningService, 'if (!actionableItems.length && !difficultyTargets.length)', 'Inventory-gap predictive runs must not be blocked by old topic-health actionable-gap status.');
assertIncludes(aiQuestioningService, 'function subjectPracticeProductionCandidateLimit', 'Subject production must centralize finite candidate budget policy.');
assertIncludes(aiQuestioningService, 'Math.min(120, Math.max(12, neededCount * 6, Math.ceil(targetCount * 2)))', 'Subject production candidate budget must be finite and based on remaining target gap.');
assertIncludes(aiQuestioningService, "WHEN ${nextNoProgressRounds} >= \"max_no_progress_rounds\" THEN 'blocked'", 'Subject production must block after repeated no-progress rounds.');
assertIncludes(aiQuestioningService, 'publishedCount >= cell.targetCount', 'Subject production cells must be fulfilled by published formal stock, not candidate count.');
assertIncludes(aiQuestioningService, "openTotal <= 0", 'Subject production runs must complete only when open formal-stock gap is zero.');

assertIncludes(replenishmentService, 'persistSnapshot', 'Inventory service must support persisted snapshots.');
assertIncludes(replenishmentService, 'csca_adaptive_inventory_snapshots', 'Inventory service must write inventory snapshots.');
assertIncludes(replenishmentService, 'cycle-aware-predictive-replenishment-v1', 'Inventory service must expose a stable policy version.');
assertIncludes(replenishmentService, 'const allItems = rows.map((row) => {', 'Inventory summary must be calculated before pagination is applied.');
assertIncludes(replenishmentService, 'const summary = allItems.reduce(', 'Inventory summary must cover all matching cells, not just the returned page.');
assertIncludes(replenishmentService, 'const items = allItems.slice(0, limit);', 'Inventory endpoint must paginate only the returned items.');
assertIncludes(replenishmentService, 'for (const item of allItems)', 'Persisted inventory snapshots must cover all matching cells, not just the returned page.');
assertIncludes(replenishmentService, 'AND NOT EXISTS (', 'Manual stock must exclude AI-backed formal special-practice rows to avoid double counting.');
assertIncludes(replenishmentService, 'aiq."source_question_id" = spq."id"', 'Manual stock exclusion must detect special-practice rows already backed by AI formal questions.');
assertRegex(
  replenishmentService,
  /ai_formal_stock AS \([\s\S]*?COUNT\(DISTINCT spq\."id"\)::int AS "aiFormalStock"[\s\S]*?FROM "special_practice_questions" spq/,
  'AI formal inventory must count drawable special-practice rows, including legacy AI-backed rows without newer auto-approval metadata.'
);
assertIncludes(replenishmentService, 'AND aiq."syllabus_version" = topic."syllabus_version"', 'AI-backed stock attribution must stay scoped to the active syllabus version.');
assertRegex(
  replenishmentService,
  /ai_pipeline AS \([\s\S]*?WHERE q\."source_type" = 'ai'[\s\S]*?AND q\."syllabus_version" = topic\."syllabus_version"/,
  'AI candidate inventory must ignore stale candidates from old syllabus versions.'
);
assertRegex(
  replenishmentService,
  /WHERE aggregate\."user_id" IS NULL[\s\S]*aggregate\."organization_id" IS NULL/,
  'Inventory pressure must avoid double-counting global/team/user aggregates.'
);

assertIncludes(controller, 'adaptive-replenishment/inventory', 'Admin controller must expose predictive inventory endpoint.');
assertIncludes(controller, 'adaptive-replenishment/run', 'Admin controller must expose predictive run endpoint.');
assertIncludes(controller, 'usage-aggregates/refresh', 'Admin controller must expose usage aggregate refresh endpoint.');

assertIncludes(apiAdmin, 'getAdminAdaptiveReplenishmentInventory', 'Frontend API must read predictive inventory.');
assertIncludes(apiAdmin, 'runAdminAdaptiveReplenishment', 'Frontend API must trigger predictive replenishment.');
assertIncludes(apiAdmin, 'refreshAdminAdaptiveUsageAggregates', 'Frontend API must refresh usage aggregates.');
assertIncludes(apiAdmin, 'getAdminSubjectPracticeProductionRun', 'Frontend API must read a single subject-practice production run for live progress refresh.');

assertIncludes(productionPanel, '题库长期库存缺口', 'Production panel must display long-term predictive inventory gaps.');
assertIncludes(productionPanel, '本轮目标合格题', 'Production panel must distinguish the current production target from long-term inventory gaps.');
assertIncludes(productionPanel, '预测补题', 'Production panel must expose predictive replenishment action.');
assertIncludes(productionPanel, "run.status !== 'completed' && run.status !== 'cancelled' && run.openTotal > 0", 'Completed production runs must not display stale open/running cell details.');
assertIncludes(productionPanel, '只有门禁通过并进入科目训练题库的题才计入完成', 'Panel copy must communicate gate-passed-only completion.');
assertIncludes(adminQuestionBankPage, "activeTab !== 'subject-practice'", 'Admin page must scope production progress polling to the subject-practice workflow.');
assertIncludes(adminQuestionBankPage, 'getAdminSubjectPracticeProductionRuns({ subject })', 'Admin page must live-refresh the active subject-practice production run list.');
assertIncludes(adminQuestionBankPage, 'getAdminAdaptiveReplenishmentInventory({ subject, limit: 160 })', 'Admin page must live-refresh predictive inventory while production is active.');
assertIncludes(adminQuestionBankPage, 'refreshCandidateData({ includeCandidates: false, includeBulkTasks: false })', 'Admin page must live-refresh published assets and candidate governance while production is active.');
assert(!adminQuestionBankPage.includes('createAdminSubjectPracticeProductionRun'), 'Subject-practice create button must use the same predictive inventory batching path as automatic replenishment.');

assert(
  packageJson.scripts['csca-adaptive:predictive-replenishment-rules'] === 'node scripts/csca-adaptive-predictive-replenishment-rules-test.cjs',
  'package.json must expose csca-adaptive:predictive-replenishment-rules.'
);
assert(
  packageJson.scripts['csca-adaptive:predictive-replenishment-smoke'] === 'node scripts/csca-adaptive-predictive-replenishment-smoke.cjs',
  'package.json must expose csca-adaptive:predictive-replenishment-smoke.'
);

assertIncludes(predictiveSmoke, "production run should not complete before target counts are filled", 'Smoke must assert production runs do not complete before formal target counts are filled.');
assertIncludes(predictiveSmoke, "predictive replenishment should skip quiet topics without recent pressure", 'Smoke must assert low stock alone does not create predictive replenishment runs.');
assertIncludes(predictiveSmoke, "predictive replenishment must not create production runs without recent usage pressure", 'Smoke must assert predictive replenishment does not grow inventory without demand pressure.');
assertIncludes(predictiveSmoke, "usage refresh should persist an active student learning cycle", 'Smoke must assert usage refresh creates active student learning cycles from adaptive practice.');
assertIncludes(predictiveSmoke, "usage refresh should persist an active team learning cohort", 'Smoke must assert usage refresh creates active team learning cohorts from adaptive practice.');
assertIncludes(predictiveSmoke, "cooling team soft usage pressure must not drive predictive replenishment runs", 'Smoke must assert cooling teams do not replenish from soft pressure.');
assertIncludes(predictiveSmoke, "cooling team severe shortage pressure should create a predictive replenishment run", 'Smoke must assert cooling teams still replenish on severe shortage pressure.');
assertIncludes(predictiveSmoke, "inactive/completed team cohorts must not drive predictive replenishment runs", 'Smoke must assert ended team cohorts do not drive predictive replenishment.');
assertIncludes(predictiveSmoke, "inactive team-only shortage pressure must not bypass cohort status through global aggregates", 'Smoke must assert inactive team-only shortage events cannot bypass cohort status as global pressure.');
assertIncludes(predictiveSmoke, "expired team cohorts should be marked inactive during usage refresh", 'Smoke must assert usage refresh expires ended team cohorts.');
assertIncludes(predictiveSmoke, "stale shortage events outside the pressure window must not trigger predictive replenishment", 'Smoke must assert expired shortage pressure does not keep growing inventory after the learning window ends.');
assertIncludes(predictiveSmoke, "production run should block after a no-progress round", 'Smoke must assert production runs block on repeated no-progress.');
assertIncludes(predictiveSmoke, "production run should complete after all target counts are filled", 'Smoke must assert production runs complete after all difficulty targets are formally filled.');
assertIncludes(predictiveSmoke, "candidate budget should be derived from target gap and capped", 'Smoke must assert candidate budgets are finite and derived from the target gap.');
assertIncludes(predictiveSmoke, "AI-backed formal questions must not be double-counted as manual stock", 'Smoke must assert AI formal stock is not double-counted as manual stock.');
assertIncludes(predictiveSmoke, "Adaptive subject-practice provider should select predictive replenishment formal questions", 'Smoke must assert predictive replenishment formal questions are selectable by student-side adaptive practice.');
assertIncludes(predictiveSmoke, "predictive replenishment should stop after cycle targets are filled", 'Smoke must assert predictive replenishment stops after cycle targets are filled even if pressure events remain.');
assertIncludes(predictiveSmoke, "must not create another production run after cycle targets are filled", 'Smoke must assert completed cycle targets do not create another production run.');
assertIncludes(predictiveSmoke, "subjectPracticeAutoApproval", 'Smoke must insert formal subject-practice stock using the same auto-approval metadata required by production refresh.');

console.log('CSCA adaptive predictive replenishment rules passed.');
