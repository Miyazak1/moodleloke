const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (line) process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

function reasonsFor(row) {
  const reasons = [];
  if (row.questionType !== 'single-choice') reasons.push('question_type_not_single_choice');
  if (!Array.isArray(row.options)) return [...reasons, 'options_not_array'];
  const valid = row.options.filter((option) => {
    return option && typeof option === 'object' && !Array.isArray(option)
      && String(option.id ?? '').trim() && String(option.text ?? '').trim();
  });
  if (row.options.length !== 4) reasons.push('option_count_not_four');
  if (valid.length !== row.options.length) reasons.push('blank_or_invalid_option');
  if (new Set(valid.map((option) => String(option.id).trim())).size !== 4) reasons.push('option_ids_not_four_unique_values');
  if (!valid.some((option) => String(option.id).trim() === String(row.correctAnswer ?? '').trim())) reasons.push('correct_answer_not_in_options');
  return [...new Set(reasons)];
}

function short(value, max = 100) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function selfTest() {
  const valid = { questionType: 'single-choice', options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctAnswer: 'A' };
  const ten = { ...valid, options: Array.from({ length: 10 }, (_, index) => ({ id: String(index), text: String(index) })) };
  if (reasonsFor(valid).length) throw new Error('valid four-option fixture was rejected');
  if (!reasonsFor(ten).includes('option_count_not_four')) throw new Error('ten-option fixture was not rejected');
  console.log('external OER quarantine eligibility self-test: ok');
}

async function main() {
  if (hasFlag('self-test')) return selfTest();
  const apply = hasFlag('apply');
  if (apply && !hasFlag('confirm-archive')) {
    throw new Error('Apply mode requires both --apply and --confirm-archive. Run without them for a read-only plan.');
  }
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.cscaQuestion.findMany({
      where: { sourceType: 'external_oer', status: 'approved', topic: { status: 'published' } },
      select: { id: true, subject: true, topicId: true, questionType: true, prompt: true, options: true, correctAnswer: true },
      orderBy: [{ subject: 'asc' }, { id: 'asc' }]
    });
    const findings = rows.map((row) => ({ row, reasons: reasonsFor(row) })).filter((item) => item.reasons.length);
    const activeRefs = findings.length ? await prisma.$queryRaw(Prisma.sql`
      SELECT DISTINCT item."question_id" AS "questionId"
      FROM "csca_adaptive_round_items" item
      JOIN "csca_adaptive_rounds" round_row ON round_row."id" = item."round_id"
      WHERE item."question_source" = 'csca_question'
        AND item."question_id" IN (${Prisma.join(findings.map((item) => item.row.id))})
        AND round_row."submitted_at" IS NULL
    `) : [];
    const deferredIds = new Set(activeRefs.map((item) => Number(item.questionId)));
    const archivable = findings.filter((item) => !deferredIds.has(item.row.id));
    const bySubject = Object.fromEntries(['math', 'physics', 'chemistry'].map((subject) => [
      subject,
      findings.filter((item) => item.row.subject === subject).length
    ]));
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'plan',
      scannedApprovedExternalOer: rows.length,
      nonstandard: findings.length,
      archivable: archivable.length,
      deferredBecauseActiveRound: deferredIds.size,
      bySubject,
      samples: findings.slice(0, 12).map((item) => ({
        id: item.row.id, subject: item.row.subject, topicId: item.row.topicId,
        optionCount: Array.isArray(item.row.options) ? item.row.options.length : null,
        reasons: item.reasons, prompt: short(item.row.prompt)
      }))
    }, null, 2));
    if (!apply) {
      console.log('Plan only: no rows changed. To archive eligible rows, rerun with --apply --confirm-archive.');
      return;
    }
    if (!archivable.length) return;
    const now = new Date().toISOString();
    const result = await prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = 'archived',
          "version" = "version" + 1,
          "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
            studentEligibilityQuarantine: {
              status: 'archived',
              reason: 'nonstandard_student_choice_contract',
              archivedAt: now,
              source: 'quarantine_nonstandard_external_oer'
            }
          })}::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" IN (${Prisma.join(archivable.map((item) => item.row.id))})
        AND "source_type" = 'external_oer'
        AND "status" = 'approved'
    `);
    console.log(`Archived ${result} nonstandard external_oer questions. Active-round references were left approved and will be blocked from new selection.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
