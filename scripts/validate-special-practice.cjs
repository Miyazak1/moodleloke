const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const SUBJECTS = ['math', 'physics', 'chemistry'];
const LETTERS = new Set(['A', 'B', 'C', 'D']);
const FORBIDDEN_MARKETING_WORDS = ['真题', '官方题库'];
const MIN_EXPLANATION_LENGTH = 14;

function fail(message) {
  throw new Error(message);
}

function normalizePrompt(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase();
}

async function main() {
  const warnings = [];
  const seenPrompts = new Map();
  for (const subject of SUBJECTS) {
    const topics = await prisma.specialPracticeTopic.findMany({
      where: { subject, status: 'published' },
      include: { questions: { where: { status: 'published' }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
    if (topics.length < 8) fail(`${subject} must have at least 8 published topics.`);
    const modules = new Set(topics.map((topic) => topic.module));
    if (modules.size < 4) fail(`${subject} must have at least 4 modules.`);
    topics.forEach((topic) => {
      if (topic.questionCount < 10) fail(`${topic.slug} must declare at least 10 questions.`);
      if (topic.questions.length < 10) fail(`${topic.slug} must have at least 10 published questions.`);
      const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
      if (FORBIDDEN_MARKETING_WORDS.some((word) => `${topic.title}${topic.description}`.includes(word))) {
        fail(`${topic.slug} contains misleading wording like 真题/官方题库.`);
      }
      topic.questions.forEach((question, index) => {
        if (question.orderNumber !== index + 1) fail(`${topic.slug} order must be continuous at #${index + 1}.`);
        const options = Array.isArray(question.options) ? question.options : [];
        const tags = Array.isArray(question.knowledgeTags) ? question.knowledgeTags : [];
        if (options.length !== 4) fail(`${topic.slug} #${question.orderNumber} must have 4 options.`);
        if (options.some((option) => !option?.id || !String(option.text ?? '').trim())) fail(`${topic.slug} #${question.orderNumber} has empty option.`);
        if (!LETTERS.has(question.correctAnswer)) fail(`${topic.slug} #${question.orderNumber} invalid correctAnswer.`);
        if (!question.prompt?.trim() || !question.explanation?.trim() || !tags.length) fail(`${topic.slug} #${question.orderNumber} incomplete content.`);
        if (question.explanation.trim().length < MIN_EXPLANATION_LENGTH) fail(`${topic.slug} #${question.orderNumber} explanation is too short.`);
        if (FORBIDDEN_MARKETING_WORDS.some((word) => `${question.prompt}${question.explanation}`.includes(word))) {
          fail(`${topic.slug} #${question.orderNumber} contains misleading wording like 真题/官方题库.`);
        }
        const normalizedPrompt = normalizePrompt(question.prompt);
        const previous = seenPrompts.get(normalizedPrompt);
        if (previous) warnings.push(`${topic.slug} #${question.orderNumber} duplicates prompt from ${previous}.`);
        seenPrompts.set(normalizedPrompt, `${topic.slug} #${question.orderNumber}`);
        answerCounts[question.correctAnswer] += 1;
      });
      const maxAnswerCount = Math.max(...Object.values(answerCounts));
      if (maxAnswerCount === topic.questions.length) fail(`${topic.slug} answer distribution is degenerate.`);
      if (maxAnswerCount / topic.questions.length > 0.7) {
        warnings.push(`${topic.slug} answer distribution is skewed: ${JSON.stringify(answerCounts)}.`);
      }
    });
  }
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  console.log('Validated CSCA special practice topics and questions.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
