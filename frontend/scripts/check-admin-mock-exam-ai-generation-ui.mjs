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

function assertExcludes(source, snippets, label) {
  for (const snippet of snippets) {
    assert(!source.includes(snippet), `${label} must not include marker: ${snippet}`);
  }
}

const manualMockPage = read('src/pages/AdminMockExamPage.tsx');
const aiQuestionBankPage = read('src/pages/AdminAIQuestionBankPage.tsx');
const mockProductionPanel = read('src/components/admin/ai-question-bank/MockExamProductionPanel.tsx');
const candidateReviewPanel = read('src/components/admin/ai-question-bank/CandidateReviewPanel.tsx');
const questionBankOverview = read('src/components/admin/ai-question-bank/QuestionBankOverviewSummary.tsx');
const api = read('src/lib/api-admin.ts');
const apiTypes = read('src/lib/api-types.ts');
const rootPackage = read('../package.json');
const runbook = read('../docs/ops-runbook.md');

assertIncludes(aiQuestionBankPage, [
  'createAdminMockExamBlueprintFromPaper',
  'createAdminMockExamGenerationJob',
  'processAdminMockExamGenerationJob',
  'assembleAdminMockExamGenerationJobDraft',
  "activeUseCase === 'online_mock_exam'",
  "activeTab === 'online-mock'",
  '<MockExamProductionPanel'
], 'AdminAIQuestionBankPage online mock generation line');

assertIncludes(mockProductionPanel, [
  '自动循环生成、优化和复审',
  '直到每个题位都有 1 道门禁通过题',
  '启动自动补齐',
  '自动补齐中',
  '装配已完成草稿卷'
], 'MockExamProductionPanel');

assertIncludes(candidateReviewPanel, [
  '候选治理与兜底',
  '待治理候选',
  '这里只展示未入库的异常候选',
  '门禁通过题会自动进入当前业务线题库资产'
], 'CandidateReviewPanel online mock governance mode');

assertIncludes(questionBankOverview, [
  '1 共用准备',
  '2 科目训练线',
  '3 在线模考线',
  "onOpenTab('shared-prep')",
  "onOpenTab('subject-practice')",
  "onOpenTab('online-mock')"
], 'AI question bank overview split workflow');

assertExcludes(manualMockPage, [
  'createAdminMockExamBlueprintFromPaper',
  'createAdminMockExamGenerationJob',
  'processAdminMockExamGenerationJob',
  'assembleAdminMockExamGenerationJobDraft',
  'updateAdminMockExamBlueprintSlot',
  'createGenerationJob()',
  'processGenerationJob()',
  'assembleGenerationDraft()'
], 'AdminMockExamPage manual bank boundary');

assertIncludes(api, [
  'getAdminMockExamBlueprints',
  'getAdminMockExamBlueprint',
  'createAdminMockExamBlueprintFromPaper',
  'updateAdminMockExamBlueprintSlot',
  'createAdminMockExamGenerationJob',
  'processAdminMockExamGenerationJob',
  'assembleAdminMockExamGenerationJobDraft',
  '/api/v1/admin/mock-exam/blueprints',
  '/api/v1/admin/mock-exam/generation-jobs/',
  '/assemble-draft'
], 'api-admin mock exam AI generation functions');

assertIncludes(apiTypes, [
  'export type AdminMockExamBlueprint',
  'export type AdminMockExamBlueprintSlot',
  'export type AdminMockExamGenerationJob',
  'candidateQuestionId?: number | null',
  'assembledQuestionId?: number | null',
  'assembledOrderNumber?: number | null',
  'generationJobs?: AdminMockExamGenerationJob[]'
], 'api-types mock exam AI generation types');

assertIncludes(rootPackage, [
  '"csca-mock-exam-ai-generation:smoke"',
  '"verify:csca-source-profile-rollout"',
  'csca-mock-exam-ai-generation:smoke'
], 'root package rollout gates');

assertIncludes(runbook, [
  'npm run csca-mock-exam-ai-generation:smoke',
  'Approve only candidates that pass review',
  'paper remains `draft` and is not learner-visible'
], 'ops runbook mock exam AI generation rollout');

console.log('Admin mock exam AI generation UI contract passed.');
