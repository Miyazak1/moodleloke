import {
  syllabusImportAppliedMigrationRows,
  syllabusImportMigrationRows,
  syllabusImportPreviewCsv,
  syllabusImportPreviewFilename,
  syllabusImportPreviewReport,
  syllabusImportRecoverySummary
} from '../src/lib/syllabus-imports.ts';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const preview = {
  payload: {
    schemaVersion: 'csca-syllabus-v1',
    subject: 'math',
    syllabusVersion: '2026 v1',
    sourceLabel: 'Official "Math"',
    sourceUrl: 'https://example.test/syllabus',
    verifiedAt: '2026-06-12T00:00:00.000Z',
    topicCount: 2
  },
  summary: {
    subject: 'math',
    syllabusVersion: '2026 v1',
    topicsInFile: 2,
    newTopics: 1,
    updatedTopics: 1,
    unchangedTopics: 0,
    missingFromFile: 1,
    questionsAffected: 7,
    approvedQuestionsBecomingPendingReview: 3
  },
  items: [
    {
      code: 'M-ALG-001',
      action: 'update',
      matchedBy: 'code',
      existingTopicId: 10,
      before: { title: 'Old, title', status: 'published' },
      after: { title: 'New "title"', status: 'published', allowedQuestionTypes: ['single_choice'] },
      affectedQuestionCount: 5,
      approvedQuestionsBecomingPendingReview: 2
    },
    {
      code: 'M-ALG-002',
      action: 'update',
      matchedBy: 'previous_code',
      previousCode: 'M-ALG-OLD',
      existingTopicId: 11,
      before: { title: 'Legacy Algebra', status: 'published' },
      after: { title: 'Migrated Algebra', status: 'published', previousCodes: ['M-ALG-OLD'] },
      affectedQuestionCount: 2,
      approvedQuestionsBecomingPendingReview: 1
    },
    {
      code: 'M-GEO-001',
      action: 'create',
      existingTopicId: null,
      before: null,
      after: { title: 'Geometry', status: 'draft' },
      affectedQuestionCount: 0,
      approvedQuestionsBecomingPendingReview: 0
    }
  ],
  missingFromFile: [
    {
      id: 8,
      code: 'M-OLD-001',
      title: 'Old topic',
      status: 'published',
      questionCount: 2,
      approvedQuestionCount: 1
    }
  ],
  errors: []
};

const csv = syllabusImportPreviewCsv(preview);
assert(csv.includes('section,code,action,matchedBy,previousCode,existingTopicId,titleBefore,titleAfter'), 'Syllabus preview CSV must include headers.');
assert(csv.includes('incoming,M-ALG-001,update,code,,10,"Old, title","New ""title""",published,published,5,2,'), 'Syllabus preview CSV must include escaped update rows.');
assert(csv.includes('incoming,M-ALG-002,update,previous_code,M-ALG-OLD,11,Legacy Algebra,Migrated Algebra,published,published,2,1,'), 'Syllabus preview CSV must include migrated-code rows.');
assert(csv.includes('incoming,M-GEO-001,create,,,'), 'Syllabus preview CSV must include create rows.');
assert(csv.includes('missing_from_file,M-OLD-001,missing,,,8,Old topic,,published,,2,1,'), 'Syllabus preview CSV must include missing-topic rows.');

const migrationRows = syllabusImportMigrationRows(preview);
assert(migrationRows.length === 1, 'Syllabus preview migration helper must expose migrated code rows.');
assert(migrationRows[0].previousCode === 'M-ALG-OLD' && migrationRows[0].nextCode === 'M-ALG-002', 'Syllabus preview migration helper must expose old and new codes.');
assert(migrationRows[0].affectedQuestionCount === 2, 'Syllabus preview migration helper must preserve affected question counts.');

const appliedMigrationRows = syllabusImportAppliedMigrationRows({
  ...preview,
  apply: {
    migrationCount: 1,
    migrations: [
      {
        previousCode: 'M-ALG-OLD',
        nextCode: 'M-ALG-002',
        existingTopicId: 11,
        titleBefore: 'Legacy Algebra',
        titleAfter: 'Migrated Algebra',
        affectedQuestionCount: 2,
        approvedQuestionsBecomingPendingReview: 1
      }
    ]
  }
});
assert(appliedMigrationRows.length === 1, 'Applied syllabus import helper must expose persisted migration rows.');
assert(appliedMigrationRows[0].previousCode === 'M-ALG-OLD' && appliedMigrationRows[0].existingTopicId === 11, 'Applied syllabus import helper must preserve persisted migration metadata.');

const recoverySummary = syllabusImportRecoverySummary({
  ...preview,
  recovery: {
    sourceImportId: 42,
    sourceImportStatus: 'applied',
    createdAt: '2026-06-12T00:00:00.000Z',
    createdBy: 3
  }
});
assert(recoverySummary?.sourceImportId === 42, 'Syllabus import recovery helper must expose source import id.');
assert(recoverySummary?.sourceImportStatus === 'applied', 'Syllabus import recovery helper must expose source import status.');

const report = syllabusImportPreviewReport(preview);
assert(report.summary.questionsAffected === 7, 'Syllabus preview JSON report must preserve summary.');
assert(report.incomingTopics.length === 3, 'Syllabus preview JSON report must preserve incoming topics.');
assert(report.incomingTopics.some((item) => item.matchedBy === 'previous_code' && item.previousCode === 'M-ALG-OLD'), 'Syllabus preview JSON report must preserve migrated-code metadata.');
assert(report.missingFromFile.length === 1, 'Syllabus preview JSON report must preserve missing topics.');
assert(typeof report.generatedAt === 'string' && report.generatedAt.includes('T'), 'Syllabus preview JSON report must include generatedAt.');

const appliedReport = syllabusImportPreviewReport({
  ...preview,
  apply: {
    migrationCount: 1,
    migrations: [
      {
        previousCode: 'M-ALG-OLD',
        nextCode: 'M-ALG-002',
        existingTopicId: 11,
        affectedQuestionCount: 2,
        approvedQuestionsBecomingPendingReview: 1
      }
    ]
  }
});
assert(appliedReport.apply?.migrationCount === 1, 'Applied syllabus JSON report must preserve apply summary.');
assert(appliedReport.apply?.migrations?.[0]?.previousCode === 'M-ALG-OLD', 'Applied syllabus JSON report must preserve persisted migration rows.');
const recoveryReport = syllabusImportPreviewReport({
  ...preview,
  recovery: {
    sourceImportId: 42,
    sourceImportStatus: 'applied'
  }
});
assert(recoveryReport.recovery?.sourceImportId === 42, 'Recovery syllabus JSON report must preserve recovery metadata.');

assert(
  syllabusImportPreviewFilename(preview, 'csv') === 'csca-syllabus-math-2026-v1-preview.csv',
  'Syllabus preview filename must be stable and filesystem-friendly.'
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const syllabusPageSource = readFileSync(resolve(__dirname, '../src/components/admin/ai-question-bank/CscaSyllabusWorkspace.tsx'), 'utf8');
assert(syllabusPageSource.includes('type="file"'), 'Syllabus workspace must expose a JSON file picker.');
assert(syllabusPageSource.includes('accept="application/json,.json"'), 'Syllabus file picker must restrict to JSON files.');
assert(syllabusPageSource.includes('readJsonFile'), 'Syllabus admin page must read selected JSON files into the editor.');
assert(syllabusPageSource.includes('getAdminAIQuestioningSyllabusJsonTemplate'), 'Syllabus admin page must let admins download a JSON template.');
assert(syllabusPageSource.includes('previewAdminAIQuestioningSyllabusJsonImport'), 'Syllabus admin page must preview JSON impact before saving or applying.');
assert(syllabusPageSource.includes('createAdminAIQuestioningSyllabusJsonImport'), 'Syllabus admin page must support saving an import draft.');
assert(syllabusPageSource.includes('applyAdminAIQuestioningSyllabusJsonImport'), 'Syllabus admin page must support applying a saved import draft.');
assert(syllabusPageSource.includes('createAdminAIQuestioningSyllabusJsonImportRecoveryDraft'), 'Syllabus admin page must support rebuilding a recovery draft from a saved import.');
assert(syllabusPageSource.includes('createAdminAIQuestioningSyllabusJsonImportReversePlan'), 'Syllabus admin page must support generating a dry-run reverse plan from an applied import.');
assert(syllabusPageSource.includes('recoveryDraftCreated'), 'Syllabus admin page must tell admins to review recovery drafts before applying.');
assert(syllabusPageSource.includes('reversePlanBody'), 'Syllabus admin page must explain that reverse plans are dry-run only.');
assert(syllabusPageSource.includes('selectedReversePlan'), 'Syllabus admin page must render the selected import reverse plan.');
assert(syllabusPageSource.includes('syllabusImportRecoverySummary'), 'Syllabus admin page must render recovery source metadata.');
assert(syllabusPageSource.includes('recoverySourceRow'), 'Syllabus admin page must expose recovery source copy.');
assert(syllabusPageSource.includes('selectedImportDetail'), 'Syllabus admin page must expose selected import detail copy.');
assert(syllabusPageSource.includes('selectedImportPreview'), 'Syllabus admin page must render saved import preview details.');
assert(syllabusPageSource.includes('selectedImportAppliedMigrations'), 'Syllabus admin page must render persisted applied migration details.');
assert(syllabusPageSource.includes('admin-syllabus-selected-import'), 'Syllabus admin page must expose a selected import investigation panel.');
assert(syllabusPageSource.includes('window.confirm(fillTemplate(copy.migrationConfirm'), 'Syllabus import apply must confirm code migrations before applying.');
assert(syllabusPageSource.includes("getAdminAIQuestioningQuestions({ ...params, status: 'pending_review', topicId, syllabusStatus, view: 'list' })"), 'Syllabus workspace must load affected pending-review questions with optional topic and syllabus-status filtering.');
assert(syllabusPageSource.includes('reviewTopicId'), 'Syllabus review queue must expose a topic-id filter.');
assert(syllabusPageSource.includes('reviewSyllabusStatus'), 'Syllabus review queue must expose a syllabus-status filter.');
assert(syllabusPageSource.includes('staleSyllabusStatus'), 'Syllabus review queue must expose stale/unpublished syllabus filtering copy.');
assert(syllabusPageSource.includes('currentSyllabusStatus'), 'Syllabus review queue must expose current syllabus filtering copy.');
assert(syllabusPageSource.includes('topicId, syllabusStatus'), 'Syllabus review queue must send topic-id and syllabus-status filters to the questions API.');
assert(syllabusPageSource.includes('reviewSourceType'), 'Syllabus review queue must expose a source-type filter.');
assert(syllabusPageSource.includes('filteredReviewQuestions'), 'Syllabus review queue must apply source-type filtering before rendering.');
assert(syllabusPageSource.includes('approveAdminAIQuestioningQuestion'), 'Syllabus review queue must support approving affected questions.');
assert(syllabusPageSource.includes('rejectAdminAIQuestioningQuestion'), 'Syllabus review queue must support rejecting affected questions.');
assert(syllabusPageSource.includes('archiveAdminAIQuestioningQuestion'), 'Syllabus review queue must support archiving affected questions.');
assert(syllabusPageSource.includes('bulkAdminAIQuestioningQuestions'), 'Syllabus review queue must expose bulk question governance actions.');
assert(syllabusPageSource.includes("bulkReviewQuestions('review')"), 'Syllabus review queue must support bulk re-review for selected candidates.');
assert(syllabusPageSource.includes("bulkReviewQuestions('reject')"), 'Syllabus review queue must support bulk reject for selected candidates.');
assert(syllabusPageSource.includes("bulkReviewQuestions('archive')"), 'Syllabus review queue must support bulk archive for selected candidates.');
assert(syllabusPageSource.includes('批量操作只用于审题、拒绝或归档；发布仍需逐题通过。'), 'Syllabus review queue must explain that bulk actions do not bulk-publish questions.');
assert(!syllabusPageSource.includes("bulkReviewQuestions('approve')"), 'Syllabus review queue must not bulk-approve publishable questions.');

console.log('Syllabus import export check passed.');
