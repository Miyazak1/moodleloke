const assert = require('node:assert/strict');
const { CscaSpecialPracticeService } = require('../dist/backend/src/csca-special-practice/csca-special-practice.service');

const subjects = ['math', 'physics', 'chemistry'];
const questions = subjects.flatMap((subject, subjectIndex) => Array.from({ length: 4 }, (_, questionIndex) => {
  const id = subjectIndex * 4 + questionIndex + 1;
  return {
    id,
    topicId: subjectIndex + 1,
    orderNumber: questionIndex + 1,
    difficulty: '基础',
    questionType: 'single-choice',
    prompt: `${subject} question ${questionIndex + 1}`,
    options: [
      { id: 'A', text: 'correct' },
      { id: 'B', text: 'wrong' },
      { id: 'C', text: 'wrong' },
      { id: 'D', text: 'wrong' }
    ],
    correctAnswer: 'A',
    explanation: 'Because A is correct.',
    knowledgeTags: [`${subject}-tag`],
    localizations: null,
    status: 'published',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    topic: {
      id: subjectIndex + 1,
      subject,
      module: `${subject}-module`,
      slug: `${subject}-topic`,
      title: `${subject} topic`,
      description: '',
      overview: null,
      focusItems: null,
      studyAdvice: null,
      difficultyLabel: null,
      frequencyLabel: null,
      relatedResources: null,
      relatedVisualizerSlug: null,
      localizations: null,
      estimatedMinutes: 20,
      questionCount: 4,
      sortOrder: subjectIndex,
      status: 'published',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };
}));

const prisma = {
  cscaQuestion: {
    findMany: async () => []
  },
  specialPracticeQuestion: {
    findMany: async (args) => {
      const ids = args?.where?.id?.in;
      if (Array.isArray(ids)) return questions.filter((question) => ids.includes(question.id));
      const subject = args?.where?.topic?.subject;
      return questions.filter((question) => question.topic.subject === subject);
    }
  }
};

async function main() {
  const service = new CscaSpecialPracticeService(prisma, null, null);
  const miniMock = await service.getHomeMiniMock({ seed: 'fallback-regression' });

  assert.equal(miniMock.questionCount, 12);
  assert.deepEqual(miniMock.subjects.map((subject) => subject.questionCount), [4, 4, 4]);
  assert.ok(miniMock.questions.every((question) => question.id < 0), 'fixed-bank IDs must use the negative namespace');

  const answers = Object.fromEntries(miniMock.questions.map((question) => [String(question.id), 'A']));
  const report = await service.scoreHomeMiniMock({
    questionIds: miniMock.questions.map((question) => question.id),
    answers
  });

  assert.equal(report.summary.total, 12);
  assert.equal(report.summary.correctCount, 12);
  assert.equal(report.summary.accuracy, 100);
  assert.deepEqual(report.subjectBreakdown.map((subject) => subject.total), [4, 4, 4]);
  console.log('home mini mock fixed-bank fallback: ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
