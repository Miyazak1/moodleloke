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

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function get(value, pathText) {
  return pathText.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function short(value, max = 160) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function mergedGateReasons(existingReasons, blockReasons) {
  return Array.from(new Set([...arrayFrom(existingReasons).map(cleanText), ...blockReasons].filter(Boolean)));
}

function currentPolicyBlockReasons(row) {
  if (!subjectPracticeCurrentPolicyBlockReasons) return [];
  return subjectPracticeCurrentPolicyBlockReasons({
    subject: row.subject,
    designedDifficulty: row.designedDifficulty,
    prompt: row.prompt,
    options: row.options,
    explanation: row.explanation
  });
}

async function candidateRows(prisma, options) {
  const runlessFilter = options.runlessOnly
    ? Prisma.sql`AND COALESCE(q."generation_metadata"->>'productionRunId', '') = ''`
    : Prisma.empty;
  return prisma.$queryRaw(Prisma.sql`
    SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
           q."source_type" AS "sourceType", q."source_question_id" AS "sourceQuestionId",
           q."designed_difficulty" AS "designedDifficulty", q."prompt", q."options",
           q."correct_answer" AS "correctAnswer", q."explanation",
           q."generation_metadata" AS "generationMetadata", q."review_metadata" AS "reviewMetadata",
           q."status", q."created_at" AS "createdAt", q."updated_at" AS "updatedAt",
           spq."id" AS "practiceQuestionId", spq."status" AS "practiceStatus",
           spq."topic_id" AS "specialPracticeTopicId", spt."title" AS "specialPracticeTopicTitle",
           COUNT(mapping."id")::int AS "mappingCount",
           COUNT(mapping."id") FILTER (
             WHERE exam_topic."id" = q."topic_id"
               AND exam_topic."status" = 'published'
               AND exam_topic."syllabus_version" = q."syllabus_version"
           )::int AS "adaptiveEligibleMappingCount"
    FROM "csca_questions" q
    JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
    JOIN "special_practice_questions" spq ON spq."id" = q."source_question_id"
    LEFT JOIN "special_practice_topics" spt ON spt."id" = spq."topic_id"
    LEFT JOIN "csca_topic_mappings" mapping
      ON mapping."source_type" = 'special_practice_question'
     AND mapping."source_id" = spq."id"
    LEFT JOIN "csca_exam_topics" exam_topic ON exam_topic."id" = mapping."topic_id"
    WHERE q."source_type" = 'ai'
      AND q."subject" = ${options.subject}
      AND q."status" = 'approved'
      AND spq."status" = 'published'
      AND q."created_at" >= NOW() - (${options.days} * INTERVAL '1 day')
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
      ${runlessFilter}
    GROUP BY q."id", t."id", spq."id", spt."id"
    ORDER BY q."created_at" DESC, q."id" DESC
    LIMIT ${options.limit}
  `);
}

function cleanupMetadata(row, blockReasons, now) {
  const reviewMetadata = recordFrom(row.reviewMetadata);
  const gate = recordFrom(reviewMetadata.gate);
  return {
    ...reviewMetadata,
    gate: {
      ...gate,
      publishable: false,
      decision: 'regenerate',
      reasons: mergedGateReasons(gate.reasons, blockReasons),
      checkedAt: now,
      source: 'subject_practice_current_policy_cleanup'
    },
    subjectPracticeAutoApproval: {
      status: 'current_policy_rejected',
      targetUseCase: 'subject_practice',
      targetQuestionBank: 'special_practice_questions',
      archivedSourceQuestionId: asNumber(row.sourceQuestionId),
      reasonCodes: blockReasons,
      revalidatedAt: now
    },
    approvalGate: {
      status: 'blocked',
      reasons: blockReasons,
      decision: blockReasons[0] ?? 'subject_practice_current_policy_rejected',
      checkedAt: now,
      source: 'subject_practice_current_policy_cleanup'
    },
    publishedPracticeArchive: {
      sourceQuestionId: asNumber(row.sourceQuestionId),
      reason: 'subject_practice_current_policy_rejected',
      archivedAt: now
    }
  };
}

async function applyCleanup(prisma, findings) {
  if (!findings.length) return { archivedPracticeQuestions: 0, rejectedQuestions: 0, syncedTopics: 0 };
  const now = new Date().toISOString();
  const practiceQuestionIds = Array.from(new Set(findings.map((finding) => finding.practiceQuestionId).filter((id) => id > 0)));
  const topicIds = Array.from(new Set(findings.map((finding) => finding.specialPracticeTopicId).filter((id) => id > 0)));
  const tx = [];
  tx.push(prisma.$executeRaw(Prisma.sql`
    UPDATE "special_practice_questions"
    SET "status" = 'archived',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" IN (${Prisma.join(practiceQuestionIds)})
      AND "status" = 'published'
  `));
  tx.push(prisma.$executeRaw(Prisma.sql`
    UPDATE "csca_topic_mappings"
    SET "updated_at" = CURRENT_TIMESTAMP
    WHERE "source_type" = 'special_practice_question'
      AND "source_id" IN (${Prisma.join(practiceQuestionIds)})
  `));
  for (const finding of findings) {
    tx.push(prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = 'review_failed',
          "source_question_id" = NULL,
          "review_metadata" = ${JSON.stringify(cleanupMetadata(finding.row, finding.blockReasons, now))}::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${finding.questionId}
        AND "source_type" = 'ai'
        AND "subject" = 'math'
        AND "status" = 'approved'
        AND "source_question_id" = ${finding.practiceQuestionId}
    `));
  }
  if (topicIds.length) {
    tx.push(prisma.$executeRaw(Prisma.sql`
      UPDATE "special_practice_topics" topic
      SET "question_count" = counts."publishedCount",
          "updated_at" = CURRENT_TIMESTAMP
      FROM (
        SELECT topic_row."id", COUNT(question."id")::int AS "publishedCount"
        FROM "special_practice_topics" topic_row
        LEFT JOIN "special_practice_questions" question
          ON question."topic_id" = topic_row."id"
         AND question."status" = 'published'
        WHERE topic_row."id" IN (${Prisma.join(topicIds)})
        GROUP BY topic_row."id"
      ) counts
      WHERE topic."id" = counts."id"
    `));
  }
  const results = await prisma.$transaction(tx);
  return {
    archivedPracticeQuestions: Number(results[0] ?? 0),
    rejectedQuestions: results.slice(2, 2 + findings.length).reduce((sum, value) => sum + Number(value ?? 0), 0),
    syncedTopics: topicIds.length
  };
}

async function main() {
  loadDatabaseUrl();
  const subject = cleanText(argValue('subject', 'math')).toLowerCase();
  if (subject !== 'math') {
    throw new Error('This cleanup guard is intentionally math-only. Use --subject=math.');
  }
  if (!subjectPracticeCurrentPolicyBlockReasons) {
    throw new Error('subjectPracticeCurrentPolicyBlockReasons is unavailable; run npm install in backend if ts-node dependencies are missing.');
  }
  const apply = hasFlag('apply');
  const json = hasFlag('json');
  const days = cleanPositiveInt(argValue('days', '30'), 30, 1, 60);
  const limit = cleanPositiveInt(argValue('limit', '50'), 50, 1, 200);
  const runlessOnly = cleanText(argValue('runless-only', 'true')).toLowerCase() !== 'false';
  if (apply && !runlessOnly) {
    throw new Error('Apply mode is limited to --runless-only=true so production-run refresh remains the owner for run-tied questions.');
  }
  if (apply && !hasFlag('confirm-runless-cleanup')) {
    throw new Error('Apply mode requires --confirm-runless-cleanup after reviewing the dry-run output.');
  }
  const prisma = new PrismaClient();
  try {
    const rows = await candidateRows(prisma, { subject, days, limit, runlessOnly });
    const findings = rows.flatMap((row) => {
      const blockReasons = currentPolicyBlockReasons(row);
      if (!blockReasons.length) return [];
      const family = subjectPracticeClassifyTaskFamily?.({
        prompt: row.prompt,
        options: row.options,
        explanation: row.explanation
      }) ?? 'unknown';
      return [{
        questionId: asNumber(row.id),
        practiceQuestionId: asNumber(row.practiceQuestionId),
        specialPracticeTopicId: asNumber(row.specialPracticeTopicId),
        topicTitle: cleanText(row.topicTitle),
        specialPracticeTopicTitle: cleanText(row.specialPracticeTopicTitle),
        difficulty: cleanText(row.designedDifficulty),
        family,
        blockReasons,
        productionRunId: cleanText(get(row.generationMetadata, 'productionRunId')) || null,
        adaptiveEligibleMappingCount: asNumber(row.adaptiveEligibleMappingCount),
        prompt: short(row.prompt, 180),
        row
      }];
    });
    let applied = null;
    if (apply) {
      applied = await applyCleanup(prisma, findings);
    }
    const report = {
      subject,
      mode: apply ? 'apply' : 'dry-run',
      runlessOnly,
      days,
      scannedCandidates: rows.length,
      blockedCandidates: findings.length,
      applied,
      findings: findings.map(({ row: _row, ...finding }) => finding)
    };
    if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
    } else {
      console.log(`Subject-practice current-policy cleanup: ${subject} (${apply ? 'apply' : 'dry-run'})`);
      console.log(`Scope: days=${days}, limit=${limit}, runless-only=${runlessOnly}`);
      console.log(`Scanned candidates: ${rows.length}; blocked by current policy: ${findings.length}`);
      for (const finding of findings.slice(0, 20)) {
        console.log(`- #${finding.questionId} spq=${finding.practiceQuestionId} run=${finding.productionRunId ?? 'n/a'} mapEligible=${finding.adaptiveEligibleMappingCount} ${finding.topicTitle}/${finding.difficulty}: ${finding.blockReasons.join(',')} ${finding.family} :: ${finding.prompt}`);
      }
      if (!apply) console.log('Dry-run only. Re-run with --apply --confirm-runless-cleanup to archive listed runless special-practice rows and mark linked AI rows review_failed.');
      if (applied) console.log(`Applied: archivedPracticeQuestions=${applied.archivedPracticeQuestions}, rejectedQuestions=${applied.rejectedQuestions}, syncedTopics=${applied.syncedTopics}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
