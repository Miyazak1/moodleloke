require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const fs = require('fs');
const path = require('path');
const { CscaMockExamService } = require('../backend/src/csca-mock-exam/csca-mock-exam.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function makeService() {
  const paper = {
    id: 11,
    subject: 'math',
    slug: 'math-mock-2',
    title: '数学模拟卷 2',
    description: 'Math paper',
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: '免费',
    isFree: true,
    isLocked: false
  };
  const attempts = [
    {
      id: 39,
      paper,
      score: null,
      correctCount: null,
      wrongCount: null,
      unansweredCount: 47,
      startedAt: new Date('2026-06-09T05:22:30.000Z'),
      submittedAt: null
    },
    {
      id: 31,
      paper: { ...paper, id: 10, slug: 'math-mock-1', title: '数学模拟卷 1' },
      score: 25,
      correctCount: 12,
      wrongCount: 36,
      unansweredCount: 0,
      startedAt: new Date('2026-06-09T02:00:00.000Z'),
      submittedAt: new Date('2026-06-09T02:17:34.000Z')
    }
  ];
  const prisma = {
    mockExamAttempt: {
      findMany: async (args) => {
        assertEqual(args.where.userId, 7, 'listMyAttempts must scope attempts to the current user.');
        assertEqual(args.take, 20, 'listMyAttempts must keep the account page history bounded.');
        return attempts;
      }
    }
  };
  return new CscaMockExamService(prisma, {}, {}, {});
}

async function testAttemptHistoryPaths() {
  const service = makeService();
  const result = await service.listMyAttempts(7);
  assertEqual(result.items.length, 2, 'listMyAttempts should return mapped attempts.');

  const active = result.items[0];
  assertEqual(active.id, 39, 'Active attempt should be preserved.');
  assertEqual(active.attemptPath, '/csca-mock-exam/attempts/39', 'Active attempts must expose a direct CBT resume path.');
  assertEqual(active.reportPath, null, 'Active attempts must not expose a report path before submit.');

  const submitted = result.items[1];
  assertEqual(submitted.id, 31, 'Submitted attempt should be preserved.');
  assertEqual(submitted.attemptPath, '/csca-mock-exam/attempts/31', 'Submitted attempts should still expose their attempt path.');
  assertEqual(submitted.reportPath, '/csca-mock-exam/attempts/31/report', 'Submitted attempts must use the current mock exam report route.');
  assert(!String(submitted.reportPath).startsWith('/zh/mock-exam'), 'Submitted report paths must not use the retired mock-exam route.');
}

function testMockExamGenerationSafetyBoundary() {
  const serviceSource = fs.readFileSync(path.join(__dirname, '../backend/src/csca-mock-exam/csca-mock-exam.service.ts'), 'utf8');
  assert(serviceSource.includes('processAdminGenerationJob'), 'Mock exam AI generation must have an explicit admin job processor.');
  assert(serviceSource.includes("publishPolicy: 'candidate_review_required'"), 'Mock exam AI generation must write candidates into a review-required flow.');
  assert(serviceSource.includes("formalMockPaperMutation: 'forbidden_until_reviewed'"), 'Mock exam AI generation must not mutate formal mock papers before review.');
  assert(serviceSource.includes('candidateQuestionId'), 'Mock exam generation job results must track generated candidate question IDs.');
  assert(serviceSource.includes('assembleAdminGenerationJobDraft'), 'Mock exam AI generation must assemble reviewed candidates through an explicit draft-paper action.');
  assert(serviceSource.includes("AND \"status\" = 'approved'"), 'Mock exam draft assembly must require approved AI candidates.');
  assert(serviceSource.includes("\"generation_metadata\"->>'sourceKind' = 'mock_exam_blueprint_slot'"), 'Mock exam draft assembly must only accept mock-exam-sourced AI candidates.');
  assert(serviceSource.includes("status: 'draft'"), 'Mock exam draft assembly must keep the assembled mock paper hidden as a draft.');
  assert(serviceSource.includes('assembledQuestionId'), 'Mock exam draft assembly must keep slot-to-question provenance.');
}

testAttemptHistoryPaths().then(() => {
  testMockExamGenerationSafetyBoundary();
  console.log('CSCA mock exam history rules passed.');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
