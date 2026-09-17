const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const SOURCE_TOPIC = 'special_practice_topic';
const SOURCE_QUESTION = 'special_practice_question';
const SOURCE_MOCK_QUESTION = 'mock_exam_question';
const MOCK_TAG_TOPIC_CODE_ALIASES = {
  chemistry: {
    '物质结构': 'chemistry-atomic-structure',
    '有机化学': 'chemistry-organic-basic'
  }
};

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text.length ? text : null;
}

function topicWeight(topic) {
  const label = `${topic.frequencyLabel ?? ''}${topic.difficultyLabel ?? ''}`;
  if (label.includes('高')) return 3;
  if (label.includes('中')) return 2;
  return 1;
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function tagsFromValue(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function resolveTopicFromTags(subject, tags, topics) {
  const normalizedTags = Array.from(new Set(tags.map(normalized).filter(Boolean)));
  if (!normalizedTags.length) return null;

  const aliases = MOCK_TAG_TOPIC_CODE_ALIASES[subject] ?? {};
  const aliasTopic = normalizedTags
    .map((tag) => aliases[tag])
    .filter(Boolean)
    .map((code) => topics.find((topic) => topic.code === code))
    .find(Boolean);
  if (aliasTopic) return { topic: aliasTopic, confidence: 0.95 };

  const exact = topics.find((topic) => {
    const title = normalized(topic.title);
    const module = normalized(topic.module);
    const code = normalized(topic.code);
    return normalizedTags.some((tag) => tag === title || tag === module || tag === code);
  });
  if (exact) return { topic: exact, confidence: 1 };

  const fuzzy = topics.find((topic) => {
    const candidates = [topic.title, topic.module, topic.code].map(normalized).filter(Boolean);
    return normalizedTags.some((tag) => {
      if (tag.length < 2) return false;
      return candidates.some((candidate) => candidate.includes(tag) || tag.includes(candidate));
    });
  });
  return fuzzy ? { topic: fuzzy, confidence: 0.85 } : null;
}

async function upsertMapping(sourceType, sourceId, topicId, confidence = 1) {
  const existing = await prisma.$queryRaw`
    SELECT "id"
    FROM "csca_topic_mappings"
    WHERE "source_type" = ${sourceType}
      AND "source_id" = ${sourceId}
      AND "topic_id" = ${topicId}
    LIMIT 1
  `;
  if (existing.length) {
    await prisma.$executeRaw`
      UPDATE "csca_topic_mappings"
      SET "confidence" = ${confidence}, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing[0].id}
    `;
    return 'updated';
  }
  await prisma.$executeRaw`
    INSERT INTO "csca_topic_mappings" ("source_type", "source_id", "topic_id", "confidence")
    VALUES (${sourceType}, ${sourceId}, ${topicId}, ${confidence})
  `;
  return 'created';
}

async function replacePrimaryMapping(sourceType, sourceId, topicId, confidence = 1) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "csca_topic_mappings"
    WHERE "source_type" = ${sourceType}
      AND "source_id" = ${sourceId}
      AND "topic_id" <> ${topicId}
  `;
  const result = await upsertMapping(sourceType, sourceId, topicId, confidence);
  return { result, deleted };
}

async function upsertExamTopic(sourceTopic) {
  const existing = await prisma.$queryRaw`
    SELECT "id"
    FROM "csca_exam_topics"
    WHERE "code" = ${sourceTopic.slug}
    LIMIT 1
  `;
  const description = cleanText(sourceTopic.description);
  const examScope = cleanText(sourceTopic.overview) ?? description;
  const weight = topicWeight(sourceTopic);
  if (existing.length) {
    await prisma.$executeRaw`
      UPDATE "csca_exam_topics"
      SET
        "subject" = ${sourceTopic.subject},
        "module" = ${sourceTopic.module},
        "title" = ${sourceTopic.title},
        "description" = ${description},
        "exam_scope" = ${examScope},
        "weight" = ${weight},
        "status" = ${sourceTopic.status},
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing[0].id}
    `;
    return { id: existing[0].id, action: 'updated' };
  }
  const inserted = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject",
      "module",
      "code",
      "title",
      "description",
      "exam_scope",
      "weight",
      "status"
    )
    VALUES (
      ${sourceTopic.subject},
      ${sourceTopic.module},
      ${sourceTopic.slug},
      ${sourceTopic.title},
      ${description},
      ${examScope},
      ${weight},
      ${sourceTopic.status}
    )
    RETURNING "id"
  `;
  return { id: inserted[0].id, action: 'created' };
}

async function main() {
  const topics = await prisma.specialPracticeTopic.findMany({
    where: { status: 'published' },
    include: {
      questions: {
        where: { status: 'published' },
        orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
      }
    },
    orderBy: [{ subject: 'asc' }, { module: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  });

  let topicsCreated = 0;
  let topicsUpdated = 0;
  let topicMappingsCreated = 0;
  let topicMappingsUpdated = 0;
  let questionMappingsCreated = 0;
  let questionMappingsUpdated = 0;
  let mockQuestionMappingsCreated = 0;
  let mockQuestionMappingsUpdated = 0;
  let mockQuestionMappingsDeleted = 0;
  const unmappedMockQuestions = [];

  for (const sourceTopic of topics) {
    const examTopic = await upsertExamTopic(sourceTopic);

    if (examTopic.action === 'created') topicsCreated += 1;
    else topicsUpdated += 1;

    const topicMappingResult = await upsertMapping(SOURCE_TOPIC, sourceTopic.id, examTopic.id, 1);
    if (topicMappingResult === 'created') topicMappingsCreated += 1;
    else topicMappingsUpdated += 1;

    for (const question of sourceTopic.questions) {
      const questionMappingResult = await upsertMapping(SOURCE_QUESTION, question.id, examTopic.id, 1);
      if (questionMappingResult === 'created') questionMappingsCreated += 1;
      else questionMappingsUpdated += 1;
    }
  }

  const examTopics = await prisma.$queryRaw`
    SELECT "id", "subject", "module", "code", "title"
    FROM "csca_exam_topics"
    WHERE "status" = 'published'
    ORDER BY "subject" ASC, "module" ASC, "weight" DESC, "id" ASC
  `;
  const examTopicsBySubject = new Map();
  for (const topic of examTopics) {
    const current = examTopicsBySubject.get(topic.subject) ?? [];
    current.push(topic);
    examTopicsBySubject.set(topic.subject, current);
  }

  const mockPapers = await prisma.mockExamPaper.findMany({
    where: { status: 'published' },
    include: {
      questions: {
        where: { status: 'published' },
        select: { id: true, orderNumber: true, knowledgeTags: true },
        orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
      }
    },
    orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  });

  for (const paper of mockPapers) {
    const subjectTopics = examTopicsBySubject.get(paper.subject) ?? [];
    for (const question of paper.questions) {
      const resolved = resolveTopicFromTags(paper.subject, tagsFromValue(question.knowledgeTags), subjectTopics);
      if (!resolved) {
        unmappedMockQuestions.push({
          paperId: paper.id,
          paperTitle: paper.title,
          questionId: question.id,
          orderNumber: question.orderNumber,
          subject: paper.subject,
          tags: tagsFromValue(question.knowledgeTags)
        });
        continue;
      }

      const mapping = await replacePrimaryMapping(SOURCE_MOCK_QUESTION, question.id, resolved.topic.id, resolved.confidence);
      if (mapping.result === 'created') mockQuestionMappingsCreated += 1;
      else mockQuestionMappingsUpdated += 1;
      mockQuestionMappingsDeleted += Number(mapping.deleted ?? 0);
    }
  }

  console.log(JSON.stringify({
    scannedPublishedTopics: topics.length,
    scannedPublishedMockPapers: mockPapers.length,
    scannedPublishedMockQuestions: mockPapers.reduce((total, paper) => total + paper.questions.length, 0),
    topicsCreated,
    topicsUpdated,
    topicMappingsCreated,
    topicMappingsUpdated,
    questionMappingsCreated,
    questionMappingsUpdated,
    mockQuestionMappingsCreated,
    mockQuestionMappingsUpdated,
    mockQuestionMappingsDeleted,
    unmappedMockQuestions: unmappedMockQuestions.length,
    unmappedMockQuestionSamples: unmappedMockQuestions.slice(0, 10)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
