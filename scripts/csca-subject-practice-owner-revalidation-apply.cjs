const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { loadRootEnv } = require('../backend/scripts/load-root-env.cjs');
const {
  contentForQuestion,
  digestFor,
  exactContentSetSha256For
} = require('./csca-subject-practice-owner-candidate-inspection.cjs');

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
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { QuestionGeneratorProviderService } = require('../backend/src/ai-questioning/question-generator-provider.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionPromptBuilderService } = require('../backend/src/ai-questioning/question-prompt-builder.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerProviderService } = require('../backend/src/ai-questioning/question-reviewer-provider.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');

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

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvInts(value) {
  return cleanText(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called during owner revalidation.');
    }
  };
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

function assertApplyAuthorizationPreconditions({ apply, confirmExactOwnerRevalidation, expectedContentSetSha256 }) {
  if (apply && !confirmExactOwnerRevalidation) {
    throw new Error('--confirm-exact-owner-revalidation is required with --apply.');
  }
  if (apply && !/^[a-f0-9]{64}$/.test(expectedContentSetSha256)) {
    throw new Error('--expected-content-set-sha256=<64 lowercase hex chars> is required with --apply.');
  }
}

function assertContentSetMatches(expectedContentSetSha256, actualContentSetSha256) {
  if (actualContentSetSha256 !== expectedContentSetSha256) {
    throw new Error(`Content precondition failed: expected ${expectedContentSetSha256}, actual ${actualContentSetSha256}. Rerun exact candidate inspection and review the changed content.`);
  }
}

function runContentPreconditionSelfTest() {
  const digest = 'a'.repeat(64);
  const failures = [];
  for (const fixture of [
    { label: 'missing_confirmation', input: { apply: true, confirmExactOwnerRevalidation: false, expectedContentSetSha256: digest } },
    { label: 'missing_digest', input: { apply: true, confirmExactOwnerRevalidation: true, expectedContentSetSha256: '' } }
  ]) {
    try {
      assertApplyAuthorizationPreconditions(fixture.input);
    } catch {
      failures.push(fixture.label);
    }
  }
  let mismatchRejected = false;
  try {
    assertContentSetMatches(digest, 'b'.repeat(64));
  } catch {
    mismatchRejected = true;
  }
  assertApplyAuthorizationPreconditions({ apply: true, confirmExactOwnerRevalidation: true, expectedContentSetSha256: digest });
  assertContentSetMatches(digest, digest);
  if (failures.length !== 2 || !mismatchRejected) throw new Error('Content precondition fail-closed fixtures did not all pass.');
  return {
    mode: 'owner_revalidation_content_precondition_self_test',
    status: 'passed',
    fixtureCount: 4,
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection'
  };
}

async function executeRevalidation(prisma, options) {
  const {
    runId,
    subject,
    candidateIds,
    apply,
    confirmExactOwnerRevalidation,
    allowLegacyFullRecheck,
    suppressStudentPublication,
    expectedContentSetSha256
  } = options;
  let contentPrecondition = {
    requiredForApply: true,
    checked: false,
    transactionIsolation: apply ? 'Serializable' : null,
    expectedContentSetSha256: expectedContentSetSha256 || null,
    actualContentSetSha256: null,
    matched: null
  };
  if (apply) {
    const questions = await prisma.cscaQuestion.findMany({
      where: { id: { in: candidateIds }, subject },
      select: {
        id: true,
        subject: true,
        topicId: true,
        blueprintId: true,
        designedDifficulty: true,
        questionType: true,
        prompt: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        knowledgeTags: true,
        generationMetadata: true,
        status: true
      },
      orderBy: { id: 'asc' }
    });
    const byId = new Map(questions.map((question) => [question.id, question]));
    const missingIds = candidateIds.filter((id) => !byId.has(id));
    if (missingIds.length) throw new Error(`Content precondition failed: missing candidate ids ${missingIds.join(',')}.`);
    const contents = candidateIds.map((id) => contentForQuestion(byId.get(id)));
    const wrongRunIds = contents
      .filter((content) => cleanText(content.productionRunId) !== String(runId))
      .map((content) => content.id);
    if (wrongRunIds.length) throw new Error(`Content precondition failed: candidate ids outside production run ${runId}: ${wrongRunIds.join(',')}.`);
    const contentItems = contents.map((content) => ({ ...content, contentSha256: digestFor(content) }));
    const actualContentSetSha256 = exactContentSetSha256For(contentItems);
    contentPrecondition = {
      ...contentPrecondition,
      checked: true,
      actualContentSetSha256,
      matched: actualContentSetSha256 === expectedContentSetSha256
    };
    assertContentSetMatches(expectedContentSetSha256, actualContentSetSha256);
  }
  const service = makeService(prisma);
  const serviceReport = await service.processSubjectPracticeOwnerRevalidationCandidates({
    runId,
    subject,
    candidateIds,
    apply,
    confirmExactOwnerRevalidation,
    allowLegacyFullRecheck,
    suppressStudentPublication
  });
  return { ...serviceReport, contentPrecondition };
}

async function main() {
  if (hasFlag('self-test-content-precondition')) {
    console.log(JSON.stringify(runContentPreconditionSelfTest(), null, 2));
    return;
  }
  loadRootEnv();
  const runId = Number.parseInt(argValue('run', argValue('production-run', '')), 10);
  const rawCandidateIds = csvInts(argValue('candidate-ids', ''));
  const candidateIds = [...new Set(rawCandidateIds)];
  const subject = cleanText(argValue('subject', '')).toLowerCase();
  const apply = hasFlag('apply');
  const confirmExactOwnerRevalidation = hasFlag('confirm-exact-owner-revalidation');
  const allowLegacyFullRecheck = hasFlag('allow-legacy-full-recheck');
  const suppressStudentPublication = hasFlag('suppress-student-publication');
  const outputJson = hasFlag('json');
  const expectedContentSetSha256 = cleanText(argValue('expected-content-set-sha256', '')).toLowerCase();
  if (!Number.isInteger(runId) || runId <= 0) {
    throw new Error('--run=<productionRunId> is required.');
  }
  if (!candidateIds.length) {
    throw new Error('--candidate-ids=<id,id,...> is required.');
  }
  if (candidateIds.length !== rawCandidateIds.length) {
    throw new Error('--candidate-ids must contain unique positive integer ids.');
  }
  if (!['math', 'physics', 'chemistry'].includes(subject)) {
    throw new Error('--subject=math|physics|chemistry is required.');
  }
  assertApplyAuthorizationPreconditions({ apply, confirmExactOwnerRevalidation, expectedContentSetSha256 });

  const prisma = new PrismaClient();
  try {
    const executionOptions = {
      runId,
      subject,
      candidateIds,
      apply,
      confirmExactOwnerRevalidation,
      allowLegacyFullRecheck,
      suppressStudentPublication,
      expectedContentSetSha256
    };
    const report = apply
      ? await prisma.$transaction(
        (transaction) => executeRevalidation(transaction, executionOptions),
        { isolationLevel: 'Serializable', maxWait: 5000, timeout: 30000 }
      )
      : await executeRevalidation(prisma, executionOptions);
    if (outputJson) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
      return;
    }
    console.log(`Mode: ${report.mode}`);
    console.log(`Run: ${report.productionRunId}`);
    console.log(`Subject: ${report.subject ?? 'any'}`);
    console.log(`Apply: ${report.apply}`);
    console.log(`Provider impact: ${report.providerImpact}`);
    console.log(`Allow legacy/full recheck: ${report.allowLegacyFullRecheck}`);
    console.log(`Suppress student publication: ${report.suppressStudentPublication}`);
    console.log(`Requested ids: ${report.requestedCandidateIds.join(',')}`);
    console.log(`Found ids: ${report.foundCandidateIds.join(',') || '(none)'}`);
    if (report.legacyFullRecheckCandidateIds?.length) {
      console.log(`Legacy/full-recheck ids: ${report.legacyFullRecheckCandidateIds.join(',')}`);
    }
    if (report.missingOrIneligibleCandidateIds.length) {
      console.log(`Missing/ineligible ids: ${report.missingOrIneligibleCandidateIds.join(',')}`);
    }
    console.log(
      `Summary: found=${report.summary.found}, blocked=${report.summary.blocked}, wouldAutoApprove=${report.summary.wouldAutoApprove}, appliedApproved=${report.summary.appliedApproved}, appliedReviewOnly=${report.summary.appliedReviewOnly}, failed=${report.summary.failed}`
    );
    for (const item of report.items) {
      const reasons = item.blockReasons.length ? ` blockReasons=${item.blockReasons.join('|')}` : '';
      console.log(
        `- #${item.id} cell=${item.productionCellId ?? 'n/a'} ${item.difficulty} action=${item.action} gate=${item.gateDecision}${reasons}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
