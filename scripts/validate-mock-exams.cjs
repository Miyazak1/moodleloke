const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const LETTERS = new Set(['A', 'B', 'C', 'D']);

function fail(message) {
  throw new Error(message);
}

function validateQuestion(paper, question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const tags = Array.isArray(question.knowledgeTags) ? question.knowledgeTags : [];
  if (options.length !== 4) fail(`${paper.slug} #${question.orderNumber} must have 4 options.`);
  if (options.some((option) => !option?.id || !String(option.text ?? '').trim())) fail(`${paper.slug} #${question.orderNumber} has an empty option.`);
  if (!LETTERS.has(question.correctAnswer)) fail(`${paper.slug} #${question.orderNumber} has invalid correctAnswer.`);
  if (!options.some((option) => option && option.id === question.correctAnswer)) fail(`${paper.slug} #${question.orderNumber} answer is missing from options.`);
  if (!question.prompt?.trim()) fail(`${paper.slug} #${question.orderNumber} is missing prompt.`);
  if (!question.explanation?.trim()) fail(`${paper.slug} #${question.orderNumber} is missing explanation.`);
  if (!tags.length) fail(`${paper.slug} #${question.orderNumber} is missing knowledge tags.`);
}

async function main() {
  const papers = await prisma.mockExamPaper.findMany({
    where: { status: 'published' },
    include: { questions: { where: { status: 'published' }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] } },
    orderBy: [{ subject: 'asc' }, { slug: 'asc' }]
  });

  if (!papers.length) fail('No published mock papers found.');

  for (const paper of papers) {
    if (!paper.isFree || paper.isLocked) fail(`${paper.slug} must be free and unlocked.`);
    if (paper.questionCount !== 48) fail(`${paper.slug} questionCount must be 48.`);
    if (paper.questions.length !== 48) fail(`${paper.slug} must have 48 published questions, got ${paper.questions.length}.`);
    paper.questions.forEach((question, index) => {
      if (question.orderNumber !== index + 1) fail(`${paper.slug} orderNumber must be continuous at #${index + 1}.`);
      validateQuestion(paper, question);
    });
  }

  console.log(`Validated ${papers.length} free mock papers with 48 questions each.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
