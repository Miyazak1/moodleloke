const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');

let subjectPracticeClassifyTaskFamily = null;
let subjectPracticeCurrentPolicyBlockReasons = null;
try {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      moduleResolution: 'node'
    }
  });
  ({
    subjectPracticeClassifyTaskFamily,
    subjectPracticeCurrentPolicyBlockReasons
  } = require('../backend/src/ai-questioning/subject-practice-task-family-policy'));
} catch {
  subjectPracticeClassifyTaskFamily = null;
  subjectPracticeCurrentPolicyBlockReasons = null;
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return;
  process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function subjectList() {
  return argValue('subjects', 'chemistry,math')
    .split(',')
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean);
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function topEntries(map, limit = 20) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .slice(0, limit);
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function short(value, max = 160) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function currentPolicyBlockReasons(row) {
  return subjectPracticeCurrentPolicyBlockReasons({
    subject: row.subject,
    designedDifficulty: row.designedDifficulty,
    prompt: row.prompt,
    options: row.options,
    explanation: row.explanation
  });
}

function allowedNonMathCurrentPolicyFinding(finding) {
  const subject = cleanText(finding.subject).toLowerCase();
  const reasons = Array.isArray(finding.blockReasons) ? finding.blockReasons.map(cleanText).filter(Boolean) : [];
  return subject === 'physics'
    && reasons.length > 0
    && reasons.every((reason) => [
      'physics_field_deflection_axis_conflict',
      'physics_potential_energy_sign_conflict',
      'unbacked_visual_reference'
    ].includes(reason));
}

function currentPolicyPoolImpact(rows, findings, options = {}) {
  const findingById = new Map(findings.map((finding) => [Number(finding.id), finding]));
  const lowRemainingThreshold = asNumber(options.lowRemainingThreshold) || 3;
  const cells = new Map();
  const reasonCounts = new Map();
  for (const row of rows) {
    if (cleanText(row.practiceStatus) !== 'published') continue;
    const subject = cleanText(row.subject).toLowerCase();
    const topicTitle = cleanText(row.topicTitle) || `topic_${row.topicId}`;
    const difficulty = cleanText(row.designedDifficulty) || 'unknown';
    const key = `${subject}|${topicTitle}|${difficulty}`;
    const entry = cells.get(key) ?? {
      subject,
      topicTitle,
      difficulty,
      total: 0,
      blocked: 0,
      remaining: 0,
      sampleBlockedIds: []
    };
    entry.total += 1;
    const finding = findingById.get(Number(row.id));
    if (finding) {
      entry.blocked += 1;
      if (entry.sampleBlockedIds.length < 5) entry.sampleBlockedIds.push(Number(row.id));
      for (const reason of arrayFrom(finding.blockReasons).map(cleanText).filter(Boolean)) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    } else {
      entry.remaining += 1;
    }
    cells.set(key, entry);
  }
  const allCells = Array.from(cells.values());
  const bySubject = options.subjects.map((subject) => {
    const subjectCells = allCells.filter((cell) => cell.subject === subject);
    const total = subjectCells.reduce((sum, cell) => sum + cell.total, 0);
    const blocked = subjectCells.reduce((sum, cell) => sum + cell.blocked, 0);
    return {
      subject,
      cells: subjectCells.length,
      total,
      blocked,
      remaining: total - blocked,
      emptyCellCount: subjectCells.filter((cell) => cell.remaining === 0).length,
      lowCellCount: subjectCells.filter((cell) => cell.remaining > 0 && cell.remaining < lowRemainingThreshold).length
    };
  });
  return {
    mode: 'current_policy_pool_impact_dry_run',
    lowRemainingThreshold,
    policyFlags: {
      physicsVisualCurrentPolicyEnabled: String(process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED ?? '').trim().toLowerCase() === 'true'
    },
    reasonCounts: topEntries(reasonCounts, 12).map(([reason, count]) => ({ reason, count })),
    bySubject,
    emptyCells: allCells
      .filter((cell) => cell.remaining === 0)
      .sort((left, right) => right.blocked - left.blocked || left.subject.localeCompare(right.subject) || left.topicTitle.localeCompare(right.topicTitle))
      .slice(0, 20),
    lowCells: allCells
      .filter((cell) => cell.remaining > 0 && cell.remaining < lowRemainingThreshold)
      .sort((left, right) => left.remaining - right.remaining || right.blocked - left.blocked || left.subject.localeCompare(right.subject) || left.topicTitle.localeCompare(right.topicTitle))
      .slice(0, 20),
    topBlockedCells: allCells
      .filter((cell) => cell.blocked > 0)
      .sort((left, right) => right.blocked - left.blocked || left.subject.localeCompare(right.subject) || left.topicTitle.localeCompare(right.topicTitle))
      .slice(0, 20)
  };
}

async function formalSubjectPracticeRows(prisma, options) {
  const createdAtPredicate = options.ignoreDays
    ? Prisma.empty
    : Prisma.sql`AND q."created_at" >= NOW() - (${options.days} * INTERVAL '1 day')`;
  return prisma.$queryRaw(Prisma.sql`
    SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
           q."source_question_id" AS "sourceQuestionId",
           q."designed_difficulty" AS "designedDifficulty", q."prompt", q."options",
           q."explanation", q."generation_metadata" AS "generationMetadata",
           spq."status" AS "practiceStatus"
    FROM "csca_questions" q
    JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
    LEFT JOIN "special_practice_questions" spq ON spq."id" = q."source_question_id"
    WHERE q."source_type" = 'ai'
      AND q."subject" IN (${Prisma.join(options.subjects)})
      AND q."status" = 'approved'
      ${createdAtPredicate}
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
    ORDER BY q."created_at" DESC, q."id" DESC
    LIMIT ${options.limit}
  `);
}

async function main() {
  loadDatabaseUrl();
  if (!subjectPracticeCurrentPolicyBlockReasons) {
    throw new Error('subjectPracticeCurrentPolicyBlockReasons is unavailable; run npm install in backend if ts-node dependencies are missing.');
  }
    const json = hasFlag('json');
    const poolImpact = hasFlag('pool-impact');
    if (hasFlag('enable-physics-visual-policy')) {
      process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED = 'true';
    }
    const days = cleanPositiveInt(argValue('days', '30'), 30, 1, 60);
    const limit = cleanPositiveInt(argValue('limit', '300'), 300, 1, 1000);
    const minNonMathSample = cleanPositiveInt(argValue('min-non-math-sample', '1'), 1, 0, 100);
    const lowRemainingThreshold = cleanPositiveInt(argValue('low-remaining-threshold', '3'), 3, 1, 100);
    const subjects = subjectList();
  const prisma = new PrismaClient();
  try {
    let rows = await formalSubjectPracticeRows(prisma, { subjects, days, limit });
    let sampleWindowFallback = null;
    const physicsVisualPolicyDryRun = hasFlag('enable-physics-visual-policy')
      && subjects.length === 1
      && subjects[0] === 'physics';
    if (physicsVisualPolicyDryRun && rows.filter((row) => cleanText(row.subject).toLowerCase() !== 'math').length < minNonMathSample) {
      const fallbackRows = await formalSubjectPracticeRows(prisma, { subjects, days, limit, ignoreDays: true });
      const fallbackNonMathCount = fallbackRows.filter((row) => cleanText(row.subject).toLowerCase() !== 'math').length;
      if (fallbackNonMathCount >= minNonMathSample) {
        rows = fallbackRows;
        sampleWindowFallback = {
          applied: true,
          reasonCode: 'physics_visual_policy_recent_window_empty_used_current_formal_pool',
          originalDays: days,
          fallbackScope: 'all_formal_subject_practice_physics_rows',
          originalSampled: 0,
          fallbackSampled: fallbackRows.length,
          productionImpact: 'none_read_only_pool_impact'
        };
      } else {
        sampleWindowFallback = {
          applied: false,
          reasonCode: 'physics_visual_policy_recent_window_empty_no_formal_fallback_rows',
          originalDays: days,
          fallbackScope: 'all_formal_subject_practice_physics_rows',
          originalSampled: rows.length,
          fallbackSampled: fallbackRows.length,
          productionImpact: 'none_read_only_pool_impact'
        };
      }
    }
    const findings = rows.flatMap((row) => {
      const blockReasons = currentPolicyBlockReasons(row);
      if (!blockReasons.length) return [];
      const family = subjectPracticeClassifyTaskFamily?.({
        prompt: row.prompt,
        options: row.options,
        explanation: row.explanation
      }) ?? 'unknown';
      return [{
        id: asNumber(row.id),
        subject: cleanText(row.subject),
        topicTitle: cleanText(row.topicTitle),
        difficulty: cleanText(row.designedDifficulty),
        sourceQuestionId: asNumber(row.sourceQuestionId),
        practiceStatus: cleanText(row.practiceStatus) || null,
        family,
        blockReasons,
        productionRunId: cleanText(row.generationMetadata?.productionRunId) || null,
        prompt: short(row.prompt, 180)
      }];
    });
    const nonMathRows = rows.filter((row) => cleanText(row.subject).toLowerCase() !== 'math');
    const nonMathFindings = findings.filter((finding) => cleanText(finding.subject).toLowerCase() !== 'math');
    const unexpectedNonMathFindings = nonMathFindings.filter((finding) => !allowedNonMathCurrentPolicyFinding(finding));
    const bySubject = subjects.map((subject) => {
      const subjectRows = rows.filter((row) => cleanText(row.subject).toLowerCase() === subject);
      const subjectFindings = findings.filter((finding) => cleanText(finding.subject).toLowerCase() === subject);
      return {
        subject,
        sampled: subjectRows.length,
        blockedByCurrentPolicy: subjectFindings.length
      };
    });
    const report = {
      days,
      limit,
      subjects,
      sampled: rows.length,
      nonMathSampled: nonMathRows.length,
      nonMathBlockedByCurrentPolicy: nonMathFindings.length,
      unexpectedNonMathBlockedByCurrentPolicy: unexpectedNonMathFindings.length,
      allowedNonMathCurrentPolicyReasons: [
        'physics_field_deflection_axis_conflict',
        'physics_potential_energy_sign_conflict',
        'unbacked_visual_reference'
      ],
      bySubject,
      sampleWindowFallback,
      findings,
      poolImpact: poolImpact
        ? currentPolicyPoolImpact(rows, findings, { subjects, lowRemainingThreshold })
        : null
    };
    if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
    } else {
      console.log('Subject-practice current-policy isolation smoke');
      console.log(`Scope: subjects=${subjects.join(',')}, days=${days}, limit=${limit}`);
      for (const item of bySubject) {
        console.log(`- ${item.subject}: sampled=${item.sampled}, blockedByCurrentPolicy=${item.blockedByCurrentPolicy}`);
      }
      for (const finding of findings.slice(0, 12)) {
        console.log(`  - #${finding.id} ${finding.subject}/${finding.topicTitle}/${finding.difficulty}: ${finding.blockReasons.join(',')} ${finding.family} :: ${finding.prompt}`);
      }
      if (poolImpact && report.poolImpact) {
        console.log('- pool impact:');
        for (const item of report.poolImpact.bySubject) {
          console.log(`  - ${item.subject}: total=${item.total}, blocked=${item.blocked}, remaining=${item.remaining}, emptyCells=${item.emptyCellCount}, lowCells=${item.lowCellCount}`);
        }
        if (report.poolImpact.emptyCells.length) {
          console.log(`  - empty cells: ${report.poolImpact.emptyCells.map((cell) => `${cell.subject}/${cell.topicTitle}/${cell.difficulty}:${cell.blocked}/${cell.total}`).join(', ')}`);
        }
      }
    }
    if (nonMathRows.length < minNonMathSample) {
      console.error(`Expected at least ${minNonMathSample} non-math formal subject-practice AI sample(s), got ${nonMathRows.length}.`);
      process.exitCode = 2;
    }
    if (unexpectedNonMathFindings.length) {
      console.error(`Current policy unexpectedly blocked ${unexpectedNonMathFindings.length} non-math formal subject-practice AI row(s); subject policy isolation is broken.`);
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
