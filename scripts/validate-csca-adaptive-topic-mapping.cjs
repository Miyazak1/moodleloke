const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const SOURCE_TOPIC = 'special_practice_topic';
const SOURCE_QUESTION = 'special_practice_question';
const SOURCE_MOCK_QUESTION = 'mock_exam_question';

function fail(message, details) {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
}

async function main() {
  const topics = await prisma.specialPracticeTopic.findMany({
    where: { status: 'published' },
    include: {
      questions: {
        where: { status: 'published' },
        select: { id: true }
      }
    },
    orderBy: [{ subject: 'asc' }, { module: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  });

  const examTopics = await prisma.$queryRaw`
    SELECT "id", "subject", "module", "code"
    FROM "csca_exam_topics"
    WHERE "status" = 'published'
    ORDER BY "subject" ASC, "module" ASC, "code" ASC
  `;

  const mockPapers = await prisma.mockExamPaper.findMany({
    where: { status: 'published' },
    include: {
      questions: {
        where: { status: 'published' },
        select: { id: true, orderNumber: true },
        orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
      }
    },
    orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  });

  const mappings = await prisma.$queryRaw`
    SELECT
      "source_type" AS "sourceType",
      "source_id" AS "sourceId",
      "topic_id" AS "topicId"
    FROM "csca_topic_mappings"
  `;

  const topicMappings = new Set();
  const questionMappings = new Set();
  const mockQuestionMappings = new Map();
  for (const mapping of mappings) {
    if (mapping.sourceType === SOURCE_TOPIC) topicMappings.add(`${mapping.sourceId}:${mapping.topicId}`);
    if (mapping.sourceType === SOURCE_QUESTION) questionMappings.add(`${mapping.sourceId}:${mapping.topicId}`);
    if (mapping.sourceType === SOURCE_MOCK_QUESTION) {
      const current = mockQuestionMappings.get(mapping.sourceId) ?? [];
      current.push(mapping.topicId);
      mockQuestionMappings.set(mapping.sourceId, current);
    }
  }

  const examTopicByCode = new Map(examTopics.map((topic) => [topic.code, topic]));
  const examTopicById = new Map(examTopics.map((topic) => [topic.id, topic]));
  const missingTopics = [];
  const missingQuestions = [];
  const missingMockQuestions = [];
  const subjectStats = new Map();

  for (const sourceTopic of topics) {
    const examTopic = examTopicByCode.get(sourceTopic.slug);
    const stats = subjectStats.get(sourceTopic.subject) ?? {
      publishedTopics: 0,
      mappedTopics: 0,
      publishedQuestions: 0,
      mappedQuestions: 0,
      publishedMockQuestions: 0,
      mappedMockQuestions: 0
    };
    stats.publishedTopics += 1;
    stats.publishedQuestions += sourceTopic.questions.length;

    if (!examTopic || !topicMappings.has(`${sourceTopic.id}:${examTopic.id}`)) {
      missingTopics.push({ id: sourceTopic.id, slug: sourceTopic.slug, subject: sourceTopic.subject });
      subjectStats.set(sourceTopic.subject, stats);
      continue;
    }

    stats.mappedTopics += 1;
    for (const question of sourceTopic.questions) {
      if (questionMappings.has(`${question.id}:${examTopic.id}`)) {
        stats.mappedQuestions += 1;
      } else {
        missingQuestions.push({ questionId: question.id, topicSlug: sourceTopic.slug, subject: sourceTopic.subject });
      }
    }
    subjectStats.set(sourceTopic.subject, stats);
  }

  for (const paper of mockPapers) {
    const stats = subjectStats.get(paper.subject) ?? {
      publishedTopics: 0,
      mappedTopics: 0,
      publishedQuestions: 0,
      mappedQuestions: 0,
      publishedMockQuestions: 0,
      mappedMockQuestions: 0
    };
    stats.publishedMockQuestions += paper.questions.length;

    for (const question of paper.questions) {
      const mappedTopicIds = mockQuestionMappings.get(question.id) ?? [];
      const hasSubjectMapping = mappedTopicIds.some((topicId) => examTopicById.get(topicId)?.subject === paper.subject);
      if (hasSubjectMapping) {
        stats.mappedMockQuestions += 1;
      } else {
        missingMockQuestions.push({
          paperId: paper.id,
          paperTitle: paper.title,
          questionId: question.id,
          orderNumber: question.orderNumber,
          subject: paper.subject
        });
      }
    }
    subjectStats.set(paper.subject, stats);
  }

  const summary = {
    examTopics: examTopics.length,
    publishedSpecialPracticeTopics: topics.length,
    publishedMockExamPapers: mockPapers.length,
    missingTopics,
    missingQuestions,
    missingMockQuestions,
    subjects: Object.fromEntries(subjectStats.entries())
  };

  if (missingTopics.length || missingQuestions.length || missingMockQuestions.length) {
    fail('CSCA adaptive topic mapping is incomplete.', summary);
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log('Validated CSCA adaptive topic mappings.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
