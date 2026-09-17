require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { MeService } = require('../backend/src/me/me.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function makeService() {
  const topic = { id: 11, subject: 'math', module: '函数', slug: 'math-functions', title: '函数基础' };
  const question = {
    id: 101,
    topicId: 11,
    orderNumber: 1,
    prompt: 'f(x)=x+1, f(2)=?',
    options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }],
    correctAnswer: 'B',
    explanation: 'Substitute x=2.',
    knowledgeTags: ['函数'],
    status: 'published',
    topic
  };
  const governedQuestion = {
    ...question,
    id: 102,
    prompt: 'Governed AI-backed question'
  };
  const examTopic = { id: 501, subject: 'math', module: '函数', code: 'math.functions', title: '函数' };
  const directQuestion = {
    id: 901,
    topicId: 501,
    prompt: 'Direct unified-bank function question',
    options: [{ id: 'A', text: '1' }, { id: 'D', text: '4' }],
    correctAnswer: 'D',
    explanation: 'Direct unified-bank explanation.',
    knowledgeTags: ['函数'],
    status: 'approved',
    syllabusVersion: '2026',
    generationMetadata: {
      versionGovernance: { status: 'current' }
    },
    topic: { ...examTopic, status: 'published', syllabusVersion: '2026' }
  };
  const mockPaper = { id: 31, subject: 'math', slug: 'math-mock-1', title: '数学模拟卷 1', questionCount: 48 };
  const mockQuestion = {
    id: 301,
    paperId: 31,
    orderNumber: 1,
    prompt: 'Mock function question',
    options: [{ id: 'A', text: '1' }, { id: 'C', text: '3' }],
    correctAnswer: 'C',
    explanation: 'Mock explanation.',
    knowledgeTags: ['函数'],
    status: 'published'
  };
  const prisma = {
    specialPracticeSession: {
      findMany: async () => [{
        id: 201,
        userId: 7,
        topicId: 11,
        answers: { 101: 'A', 102: 'A' },
        timeSpent: { 101: 25, 102: 20 },
        questionSnapshot: null,
        completedAt: new Date('2026-06-09T01:00:00.000Z'),
        topic
      }]
    },
    specialPracticeQuestion: {
      findMany: async ({ where }) => {
        if (where?.id?.in) return [question, governedQuestion].filter((item) => where.id.in.includes(item.id));
        if (where?.topicId === 11) return [question, governedQuestion];
        return [];
      }
    },
    cscaQuestion: {
      findMany: async ({ where }) => {
        if (where?.id?.in) return [directQuestion].filter((item) => where.id.in.includes(item.id));
        if (where?.sourceType === 'ai' && where?.sourceQuestionId?.in?.includes(102)) {
          return [{
            id: 902,
            sourceType: 'ai',
            sourceQuestionId: 102,
            topicId: 501,
            status: 'pending_review',
            syllabusVersion: '2026',
            topic: { ...examTopic, status: 'published', syllabusVersion: '2026' }
          }];
        }
        return [];
      }
    },
    cscaAdaptiveRound: {
      findMany: async () => [
        {
          id: 401,
          sessionId: 301,
          submittedAt: new Date('2026-06-09T03:00:00.000Z'),
          session: { id: 301, userId: 7, subject: 'math', mode: 'diagnostic' },
          items: [{ id: 1, questionId: 101, topicId: 501, position: 1, selectedAnswer: 'A', isCorrect: false, usedExplanation: true, timeSpentSeconds: 30 }]
        },
        {
          id: 402,
          sessionId: 302,
          submittedAt: new Date('2026-06-09T02:00:00.000Z'),
          session: { id: 302, userId: 7, subject: 'math', mode: 'practice' },
          items: [
            { id: 2, questionId: 101, questionSource: 'special_practice', topicId: 501, position: 1, selectedAnswer: null, isCorrect: null, usedExplanation: false, timeSpentSeconds: 10 },
            { id: 3, questionId: 901, questionSource: 'csca_question', topicId: 501, position: 2, selectedAnswer: 'A', isCorrect: false, usedExplanation: false, timeSpentSeconds: 22 },
            { id: 4, questionId: 102, questionSource: 'special_practice', topicId: 501, position: 3, selectedAnswer: 'A', isCorrect: false, usedExplanation: false, timeSpentSeconds: 18 }
          ]
        }
      ]
    },
    cscaExamTopic: {
      findMany: async () => [examTopic]
    },
    mockExamAttempt: {
      findMany: async () => [{
        id: 601,
        userId: 7,
        paperId: 31,
        answers: { 301: 'A' },
        timeSpent: { 301: 45 },
        questionSnapshot: null,
        submittedAt: new Date('2026-06-09T04:00:00.000Z'),
        paper: mockPaper
      }]
    },
    mockExamQuestion: {
      findMany: async () => [mockQuestion]
    },
    cscaTopicMapping: {
      findMany: async () => [{ sourceId: 301, topic: examTopic, confidence: 1, id: 1 }]
    },
    cscaWrongPattern: {
      findMany: async () => [{
        id: 701,
        userId: 7,
        subject: 'math',
        topicId: 501,
        patternType: 'formula_or_rule',
        metadata: { recentQuestionIds: [101] },
        status: 'active',
        nextReviewAt: new Date('2026-06-10T00:00:00.000Z'),
        lastWrongAt: new Date('2026-06-09T04:00:00.000Z')
      }]
    },
    cscaAIInteraction: {
      findMany: async () => [{
        id: 801,
        userId: 7,
        type: 'explain_wrong_answer',
        status: 'success',
        roundId: 401,
        questionId: 101,
        structuredOutput: {
          whyWrong: '你把函数输出值看成了输入值。',
          correctApproach: '把 x=2 代入 f(x)=x+1。',
          quickMethod: '看到 f(2) 就直接代入 2。',
          avoidNextTime: '下次先圈出函数括号里的输入。'
        },
        createdAt: new Date('2026-06-09T03:05:00.000Z')
      }]
    }
  };
  return new MeService(prisma, { listPublishedSchoolRecordsByIds: async () => [] });
}

async function testUnifiedSources() {
  const service = makeService();
  const response = await service.listCscaWrongQuestions(7);
  const sourceTypes = response.items.map((item) => item.sourceType).sort();
  assertEqual(response.items.length, 5, 'Unified wrong bank should include five visible wrong-question items across sources.');
  assert(sourceTypes.includes('diagnostic'), 'Unified wrong bank should include adaptive diagnostic misses.');
  assert(sourceTypes.includes('adaptive_round'), 'Unified wrong bank should include adaptive practice misses.');
  assert(sourceTypes.includes('mock_exam'), 'Unified wrong bank should include mock exam misses.');
  assert(sourceTypes.includes('special_practice'), 'Unified wrong bank should include legacy special practice misses.');
  assert(response.items.some((item) => item.questionId === 901 && item.sourceType === 'adaptive_round'), 'Unified wrong bank should include direct unified-bank adaptive misses.');
  assert(!response.items.some((item) => item.questionId === 102), 'Unified wrong bank should exclude AI-backed special-practice misses that are under governance review.');
  assert(response.items.every((item) => item.itemKey && item.practicePath.startsWith('/csca-subjects/')), 'Every wrong item should expose a stable key and subject backflow path.');
  assert(response.items.some((item) => item.status === 'viewed_explanation'), 'Adaptive items should preserve viewed explanation status.');
  assert(response.items.some((item) => item.nextReviewAt === '2026-06-10T00:00:00.000Z'), 'Wrong items should inherit next review timing from wrong patterns.');
  assert(response.items.some((item) => item.patternType === 'formula_or_rule' && item.patternConfidence >= 0.9), 'Wrong items should expose stable mistake attribution from wrong patterns.');
  assert(response.summary.patternTypes.some((item) => item.patternType === 'formula_or_rule' && item.count >= 3), 'Wrong bank summary should group items by mistake type.');
  assert(response.reviewPacks.some((pack) => pack.patternType === 'formula_or_rule' && pack.count >= 3 && pack.dueCount >= 1), 'Wrong bank should expose mistake review packs.');
  const diagnostic = response.items.find((item) => item.sourceType === 'diagnostic');
  assertEqual(diagnostic?.aiExplanationId, 801, 'Unified wrong bank should bind latest AI explanation id to adaptive wrong items.');
  assertEqual(diagnostic?.structuredExplanation?.quickMethod, '看到 f(2) 就直接代入 2。', 'Unified wrong bank should expose structured AI explanation fields.');
}

async function testServerSideFilters() {
  const service = makeService();
  const mockOnly = await service.listCscaWrongQuestions(7, { sourceType: 'mock_exam' });
  assertEqual(mockOnly.items.length, 1, 'Source filter should narrow to mock exam wrong items.');
  assertEqual(mockOnly.items[0].sourceType, 'mock_exam', 'Source filter should keep the requested source.');

  const byTag = await service.listCscaWrongQuestions(7, { knowledgeTag: '函数' });
  assertEqual(byTag.items.length, 5, 'Knowledge tag filter should include all matching visible sources.');

  const byTopic = await service.listCscaWrongQuestions(7, { topicSlug: 'math.functions' });
  assertEqual(byTopic.items.length, 4, 'Topic filter should work for mapped CSCA exam topics.');

  const byPattern = await service.listCscaWrongQuestions(7, { patternType: 'formula_or_rule' });
  assertEqual(byPattern.items.length, 5, 'Mistake pattern filter should include matching attributed visible items.');
  assert(byPattern.items.every((item) => item.patternType === 'formula_or_rule'), 'Mistake pattern filter should keep only the requested pattern type.');
}

async function main() {
  await testUnifiedSources();
  await testServerSideFilters();
  console.log('CSCA wrong question rule tests passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
