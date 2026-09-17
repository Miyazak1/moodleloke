const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
const { loadRootEnv } = require('../backend/scripts/load-root-env.cjs');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const { AdaptiveReplenishmentService } = require('../backend/src/ai-questioning/adaptive-replenishment.service');
const {
  AIQuestioningService,
  SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION
} = require('../backend/src/ai-questioning/ai-questioning.service');
const { QuestionGeneratorProviderService } = require('../backend/src/ai-questioning/question-generator-provider.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionPromptBuilderService } = require('../backend/src/ai-questioning/question-prompt-builder.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerProviderService } = require('../backend/src/ai-questioning/question-reviewer-provider.service');
const {
  SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION
} = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  subjectPracticeClassifyTaskFamily,
  subjectPracticeCurrentPolicyBlockReasons
} = require('../backend/src/ai-questioning/subject-practice-task-family-policy');

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

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called during completed-run current-policy refresh.');
    }
  };
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function statusList() {
  return argValue('statuses', 'completed')
    .split(',')
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean);
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function get(value, pathText) {
  return pathText.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
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

function ownerRefreshBlockReasons(row) {
  const review = recordFrom(row.reviewMetadata);
  const reasons = [];
  const currentPolicyReasons = currentPolicyBlockReasons(row);
  if (cleanText(get(review, 'gate.policyVersion')) !== SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION) {
    reasons.push('review_gate_policy_stale');
  }
  if (cleanText(get(review, 'profileAlignment.evidence.difficultyEvidencePolicyVersion')) !== SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION) {
    reasons.push('difficulty_evidence_policy_stale');
  }
  reasons.push(...currentPolicyReasons);
  return Array.from(new Set(reasons));
}

function makeService(prisma) {
  const gateway = disabledGateway();
  const generatorProvider = new QuestionGeneratorProviderService(new QuestionPromptBuilderService(), gateway);
  const reviewerProvider = new QuestionReviewerProviderService(gateway);
  return new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    generatorProvider,
    new QuestionReviewerService(new QuestionValidatorService(), reviewerProvider),
    new QuestionTopicMapperProviderService(gateway),
    new QuestionQualityService(prisma),
    new AdaptiveReplenishmentService(prisma)
  );
}

async function blockerRows(prisma, options) {
  return prisma.$queryRaw(Prisma.sql`
    SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
           q."source_question_id" AS "sourceQuestionId", q."designed_difficulty" AS "designedDifficulty",
           q."prompt", q."options", q."explanation", q."generation_metadata" AS "generationMetadata",
           q."review_metadata" AS "reviewMetadata",
           run."id" AS "productionRunId", run."status" AS "runStatus",
           run."published_total" AS "runPublishedTotal", run."open_total" AS "runOpenTotal",
           spq."status" AS "practiceStatus"
    FROM "csca_questions" q
    JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
    JOIN "special_practice_questions" spq ON spq."id" = q."source_question_id"
    JOIN "csca_subject_practice_production_runs" run
      ON run."id"::text = q."generation_metadata"->>'productionRunId'
    WHERE q."source_type" = 'ai'
      AND q."subject" = ${options.subject}
      AND run."status" IN (${Prisma.join(options.statuses)})
      AND q."status" = 'approved'
      AND spq."status" = 'published'
      AND q."created_at" >= NOW() - (${options.days} * INTERVAL '1 day')
      AND q."generation_metadata"->>'productionRunId' IS NOT NULL
      AND q."generation_metadata"->>'productionRunId' <> ''
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
      AND q."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
    ORDER BY run."id" ASC, q."updated_at" ASC, q."id" ASC
    LIMIT ${options.limit}
  `);
}

function blockerFindings(rows) {
  return rows.flatMap((row) => {
    const blockReasons = ownerRefreshBlockReasons(row);
    if (!blockReasons.length) return [];
    const currentPolicyReasons = currentPolicyBlockReasons(row);
    const family = subjectPracticeClassifyTaskFamily({
      prompt: row.prompt,
      options: row.options,
      explanation: row.explanation
    });
    return [{
      id: asNumber(row.id),
      subject: cleanText(row.subject),
      productionRunId: asNumber(row.productionRunId),
      runStatus: cleanText(row.runStatus),
      runPublishedTotal: asNumber(row.runPublishedTotal),
      runOpenTotal: asNumber(row.runOpenTotal),
      sourceQuestionId: asNumber(row.sourceQuestionId),
      topicTitle: cleanText(row.topicTitle),
      difficulty: cleanText(row.designedDifficulty),
      family,
      blockReasons,
      currentPolicyReasons,
      prompt: short(row.prompt, 180)
    }];
  });
}

function summarizeByRun(findings) {
  const byRun = new Map();
  for (const finding of findings) {
    const entry = byRun.get(finding.productionRunId) ?? {
      productionRunId: finding.productionRunId,
      runStatus: finding.runStatus,
      runPublishedTotal: finding.runPublishedTotal,
      runOpenTotal: finding.runOpenTotal,
      blockerCount: 0,
      blockers: []
    };
    entry.blockerCount += 1;
    entry.blockers.push(finding);
    byRun.set(finding.productionRunId, entry);
  }
  return Array.from(byRun.values()).sort((left, right) => left.productionRunId - right.productionRunId);
}

async function main() {
  loadRootEnv();
  const subject = cleanText(argValue('subject', 'math')).toLowerCase();
  if (subject !== 'math') {
    throw new Error('Production current-policy refresh is intentionally math-only for now. Use --subject=math.');
  }
  const apply = hasFlag('apply');
  const json = hasFlag('json');
  const days = cleanPositiveInt(argValue('days', '30'), 30, 1, 60);
  const limit = cleanPositiveInt(argValue('limit', '100'), 100, 1, 200);
  const statuses = statusList();
  if (!statuses.length) {
    throw new Error('At least one --statuses value is required.');
  }
  if (apply && !hasFlag('confirm-production-run-refresh')) {
    throw new Error('Apply mode requires --confirm-production-run-refresh after reviewing the dry-run output.');
  }
  if (apply && statuses.some((status) => status !== 'completed')) {
    throw new Error('Apply mode is limited to --statuses=completed so blocked/running runs remain under their normal lifecycle owner.');
  }
  const prisma = new PrismaClient();
  try {
    const rows = await blockerRows(prisma, { subject, days, limit, statuses });
    const findings = blockerFindings(rows);
    const runs = summarizeByRun(findings);
    const nonCompletedRuns = runs.filter((run) => run.runStatus !== 'completed');
    if (apply && nonCompletedRuns.length) {
      throw new Error(`Apply mode only refreshes completed runs; non-completed blocker runs present: ${nonCompletedRuns.map((run) => `#${run.productionRunId}:${run.runStatus}`).join(', ')}`);
    }
    const applied = [];
    if (apply) {
      const service = makeService(prisma);
      for (const run of runs) {
        const result = await service.processSubjectPracticeProductionRun(run.productionRunId, {
          maxJobs: 1,
          maxJobsPerDifficulty: 1,
          untilComplete: false,
          maxRounds: 1,
          requireAutoProductionEnabled: true
        });
        applied.push({
          productionRunId: run.productionRunId,
          beforeStatus: run.runStatus,
          blockerCount: run.blockerCount,
          result
        });
      }
    }
    const report = {
      subject,
      mode: apply ? 'apply' : 'dry-run',
      days,
      statuses,
      scannedCandidates: rows.length,
      blockerCount: findings.length,
      runs,
      applied
    };
    if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
    } else {
      console.log(`Subject-practice production current-policy refresh: ${subject} (${apply ? 'apply' : 'dry-run'})`);
      console.log(`Scope: days=${days}, limit=${limit}, statuses=${statuses.join(',')}`);
      const currentPolicyCount = findings.filter((finding) => finding.currentPolicyReasons.length).length;
      const stalePolicyCount = findings.filter((finding) => finding.blockReasons.some((reason) => reason === 'review_gate_policy_stale' || reason === 'difficulty_evidence_policy_stale')).length;
      console.log(`Scanned run-tied candidates: ${rows.length}; owner-refresh blockers: ${findings.length}; current-policy blockers: ${currentPolicyCount}; stale-policy blockers: ${stalePolicyCount}; affected runs: ${runs.length}`);
      for (const run of runs) {
        console.log(`- run #${run.productionRunId} status=${run.runStatus} blockers=${run.blockerCount}, published=${run.runPublishedTotal}, open=${run.runOpenTotal}`);
        for (const blocker of run.blockers.slice(0, 8)) {
          console.log(`  - #${blocker.id} spq=${blocker.sourceQuestionId} ${blocker.topicTitle}/${blocker.difficulty}: ${blocker.blockReasons.join(',')} ${blocker.family} :: ${blocker.prompt}`);
        }
      }
      if (!apply && statuses.every((status) => status === 'completed')) {
        console.log('Dry-run only. Re-run with --apply --confirm-production-run-refresh to invoke the production-run refresh owner for listed completed runs.');
      } else if (!apply) {
        console.log('Dry-run only. Apply is limited to --statuses=completed; blocked/running runs remain under their normal lifecycle owner.');
      }
      for (const item of applied) {
        const run = item.result?.run;
        console.log(`Applied run #${item.productionRunId}: ${item.beforeStatus} -> ${run?.status ?? 'unknown'}, published=${run?.publishedTotal ?? 'n/a'}, open=${run?.openTotal ?? 'n/a'}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
