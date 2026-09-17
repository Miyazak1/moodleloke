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

const {
  subjectPracticeHardEvidenceSatisfiesVisibleCalculationContract,
  subjectPracticePrePublicationUniquenessDecision,
  subjectPracticeSoftProfileReasonsForGate
} = require('../backend/src/ai-questioning/ai-questioning.service');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { subjectPracticeBuildQuestionFingerprint } = require('../backend/src/ai-questioning/subject-practice-task-family-policy');
const { QuestionReviewerProviderService } = require('../backend/src/ai-questioning/question-reviewer-provider.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
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

function cleanPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function csvValues(value) {
  return cleanText(value)
    .split(',')
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function csvInts(value) {
  return csvValues(value)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function stringArray(value) {
  return arrayFrom(value).map((item) => cleanText(item)).filter(Boolean);
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called during reviewer-profile replay.');
    }
  };
}

function makeReviewer() {
  return new QuestionReviewerService(
    new QuestionValidatorService(),
    new QuestionReviewerProviderService(disabledGateway())
  );
}

function candidateFromRow(row) {
  const generation = recordFrom(row.generationMetadata);
  const localizations = recordFrom(generation.localizations);
  return {
    subject: row.subject,
    topicId: Number(row.topicId) || 0,
    blueprintId: Number(row.blueprintId) || 0,
    sourceType: 'ai',
    designedDifficulty: row.designedDifficulty,
    questionType: row.questionType,
    prompt: row.prompt,
    options: arrayFrom(row.options),
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
    knowledgeTags: arrayFrom(row.knowledgeTags).map((item) => cleanText(item)).filter(Boolean),
    optionMetadata: arrayFrom(row.optionMetadata),
    localizations: Object.keys(localizations).length ? localizations : undefined,
    syllabusVersion: cleanText(row.syllabusVersion)
  };
}

function reviewContextFromRow(row) {
  const generation = recordFrom(row.generationMetadata);
  const targetProfile = recordFrom(generation.targetProfile);
  const syllabusScope = recordFrom(generation.syllabusScope);
  const questionPlan = currentQuestionPlanForRow(row);
  return {
    subject: row.subject,
    intendedUse: 'subject_practice',
    topicId: Number(row.topicId) || undefined,
    topicTitle: cleanText(row.topicTitle) || cleanText(targetProfile.topicTitle) || undefined,
    syllabusVersion: cleanText(row.syllabusVersion) || undefined,
    examScope: cleanText(generation.examScope) || cleanText(targetProfile.examScope) || cleanText(syllabusScope.examScope) || null,
    targetProfile: Object.keys(targetProfile).length ? targetProfile : undefined,
    questionPlan: questionPlan ?? undefined,
    reviewProviderMode: 'deterministic_only'
  };
}

function currentQuestionPlanForRow(row) {
  const generation = recordFrom(row.generationMetadata);
  const storedPlan = recordFrom(generation.questionPlan);
  if (cleanText(storedPlan.planTemplate)) return storedPlan;
  const questionPlanGate = recordFrom(generation.questionPlanGate);
  const schedulerHint = recordFrom(generation.schedulerHint);
  const baseInput = {
    subject: row.subject,
    topicId: Number(row.topicId) || undefined,
    topicTitle: cleanText(row.topicTitle) || undefined,
    productionCellId: cleanText(generation.productionCellId) || undefined,
    targetDifficulty: row.designedDifficulty
  };
  const hintedPlan = buildSubjectPracticeQuestionPlan({
    ...baseInput,
    taskFamily: cleanText(generation.taskFamily) || cleanText(schedulerHint.preferredFamily) || undefined,
    planTemplate: cleanText(questionPlanGate.planTemplate) || undefined
  });
  return hintedPlan ?? buildSubjectPracticeQuestionPlan(baseInput);
}

function countBy(values) {
  const counts = {};
  for (const value of values.map((item) => cleanText(item) || 'none')) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

const PROFILE_HARD_SHAPE_REASONS = new Set([
  'profile_hard_calculation_evidence_missing',
  'profile_hard_multistep_evidence_missing',
  'profile_hard_quantitative_shape_mismatch',
  'profile_difficulty_evidence_mismatch'
]);

const OWNER_REVALIDATION_ALLOWED_STATUSES = new Set([
  'pending_review',
  'review_failed'
]);

function isProfileGateReason(reason) {
  const text = cleanText(reason);
  return text.startsWith('profile_') || text === 'style_alignment_failed';
}

function replayDelta(row, review, candidate) {
  const oldReview = recordFrom(row.reviewMetadata);
  const oldGate = recordFrom(oldReview.gate);
  const profile = recordFrom(review.profileAlignment);
  const evidence = recordFrom(profile.evidence);
  const oldGateReasons = stringArray(oldGate.reasons);
  const newProfileReasons = stringArray(profile.reasons);
  const actualDifficultyReasons = stringArray(evidence.actualDifficultyReasons);
  const targetProfile = recordFrom(recordFrom(row.generationMetadata).targetProfile);
  const topicText = [
    row.topicTitle,
    targetProfile.topicTitle,
    targetProfile.topicCode,
    targetProfile.gapKey
  ].map(cleanText).filter(Boolean).join(' ');
  const formalGateSoftReasons = subjectPracticeSoftProfileReasonsForGate(
    cleanText(row.subject).toLowerCase(), topicText, targetProfile, row.generationMetadata
  );
  const formalGateProfileOnlySoft = newProfileReasons.length > 0
    && Boolean(formalGateSoftReasons)
    && newProfileReasons.every((reason) => formalGateSoftReasons.has(reason));
  const oldHardShapeBlockers = oldGateReasons.filter((reason) => PROFILE_HARD_SHAPE_REASONS.has(reason));
  const oldNonProfileGateReasons = oldGateReasons.filter((reason) => !isProfileGateReason(reason));
  const remainingHardShapeBlockers = newProfileReasons.filter((reason) => PROFILE_HARD_SHAPE_REASONS.has(reason));
  const visibleHardEvidenceContract = subjectPracticeHardEvidenceSatisfiesVisibleCalculationContract(actualDifficultyReasons);
  const currentReviewerClean = review.status === 'passed'
    && review.decision === 'approve'
    && review.issues.length === 0
    && review.dimensions.every((dimension) => dimension.status !== 'failed');
  const currentQuestionPlan = currentQuestionPlanForRow(row);
  const currentQuestionPlanAdherence = currentQuestionPlan
    ? subjectPracticeQuestionPlanAdherenceFor(currentQuestionPlan, candidate)
    : null;
  return {
    id: Number(row.id),
    status: row.status,
    productionRunId: cleanText(recordFrom(row.generationMetadata).productionRunId),
    productionCellId: cleanText(recordFrom(row.generationMetadata).productionCellId),
    topicTitle: row.topicTitle,
    designedDifficulty: row.designedDifficulty,
    prompt: cleanText(row.prompt).slice(0, 220),
    oldGateDecision: cleanText(oldGate.decision),
    oldGatePublishable: oldGate.publishable === true || cleanText(oldGate.publishable) === 'true',
    oldGateReasons,
    oldProfileEvidence: recordFrom(recordFrom(oldReview.profileAlignment).evidence),
    replay: {
      status: review.status,
      decision: review.decision,
      score: review.score ?? null,
      sources: review.sources,
      issueCodes: review.issues.map((issue) => issue.code),
      dimensionFailures: review.dimensions.filter((dimension) => dimension.status === 'failed').map((dimension) => dimension.key),
      profileStatus: cleanText(profile.status),
      profileScore: typeof profile.score === 'number' ? profile.score : null,
      profileReasons: newProfileReasons,
      evidence: {
        inferredQuestionForm: evidence.inferredQuestionForm ?? null,
        inferredCognitiveSkill: evidence.inferredCognitiveSkill ?? null,
        inferredDifficultyBand: evidence.inferredDifficultyBand ?? null,
        inferredCalculationLoad: evidence.inferredCalculationLoad ?? null,
        actualDifficultyReasons,
        difficultyEvidencePolicyVersion: evidence.difficultyEvidencePolicyVersion ?? null,
        difficultyEvidencePatchVersion: evidence.difficultyEvidencePatchVersion ?? null
      }
    },
    delta: {
      oldHardShapeBlockers,
      remainingHardShapeBlockers,
      hardShapeSpecificBlockersCleared: oldHardShapeBlockers.length > 0 && remainingHardShapeBlockers.length === 0,
      remainingDifficultyComplexityMismatch: newProfileReasons.includes('difficulty_complexity_mismatch'),
      profileClean: newProfileReasons.length === 0,
      formalGateProfileOnlySoft,
      formalGateSoftReasons: formalGateSoftReasons ? Array.from(formalGateSoftReasons).sort() : [],
      visibleHardEvidenceContract,
      currentReviewerClean,
      currentQuestionPlanTemplate: cleanText(recordFrom(currentQuestionPlan).planTemplate) || null,
      currentQuestionPlanAdheres: currentQuestionPlanAdherence ? currentQuestionPlanAdherence.adheres === true : null,
      currentQuestionPlanFailureCodes: currentQuestionPlanAdherence ? stringArray(currentQuestionPlanAdherence.failureCodes) : [],
      oldNonProfileGateReasons,
      profileReasonsCleared: oldGateReasons.filter((reason) => !newProfileReasons.includes(reason))
    }
  };
}

function isOwnerRevalidationCandidate(item) {
  return OWNER_REVALIDATION_ALLOWED_STATUSES.has(cleanText(item.status))
    && item.delta.currentReviewerClean
    && item.delta.currentQuestionPlanAdheres !== false
    && item.replay.profileStatus !== 'failed'
    && !item.delta.remainingDifficultyComplexityMismatch
    && (
      item.delta.profileClean
      || item.delta.formalGateProfileOnlySoft
      || item.delta.hardShapeSpecificBlockersCleared
    );
}

function ownerRevalidationCandidatePriority(item) {
  return [
    item.delta.oldNonProfileGateReasons.length > 0 ? 1 : 0,
    item.delta.profileClean ? 0 : 1,
    item.delta.formalGateProfileOnlySoft ? 0 : 1,
    item.delta.hardShapeSpecificBlockersCleared ? 0 : 1,
    Number(item.id) || Number.MAX_SAFE_INTEGER
  ];
}

function compareOwnerRevalidationCandidates(left, right) {
  const leftPriority = ownerRevalidationCandidatePriority(left);
  const rightPriority = ownerRevalidationCandidatePriority(right);
  for (let index = 0; index < leftPriority.length; index += 1) {
    if (leftPriority[index] !== rightPriority[index]) return leftPriority[index] - rightPriority[index];
  }
  return 0;
}

function buildWhere({ subject, runId, cells, ids, statuses }) {
  const clauses = [
    Prisma.sql`q."source_type" = 'ai'`,
    Prisma.sql`q."source_question_id" IS NULL`,
    Prisma.sql`q."subject" = ${subject}`,
    Prisma.sql`COALESCE(q."generation_metadata"->>'intendedUse', q."generation_metadata"->'scope'->>'intendedUse', '') = 'subject_practice'`
  ];
  if (Number.isInteger(runId) && runId > 0) {
    clauses.push(Prisma.sql`q."generation_metadata"->>'productionRunId' = ${String(runId)}`);
  }
  if (cells.length) {
    clauses.push(Prisma.sql`q."generation_metadata"->>'productionCellId' IN (${Prisma.join(cells.map(String))})`);
  }
  if (ids.length) {
    clauses.push(Prisma.sql`q."id" IN (${Prisma.join(ids)})`);
  }
  if (statuses.length) {
    clauses.push(Prisma.sql`q."status" IN (${Prisma.join(statuses)})`);
  }
  return Prisma.join(clauses, ' AND ');
}

async function replayRows(prisma, options) {
  const reviewer = makeReviewer();
  const where = buildWhere(options);
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
           q."blueprint_id" AS "blueprintId", q."designed_difficulty" AS "designedDifficulty",
           q."question_type" AS "questionType", q."prompt", q."options",
           q."correct_answer" AS "correctAnswer", q."explanation",
           q."knowledge_tags" AS "knowledgeTags", q."option_metadata" AS "optionMetadata",
           q."syllabus_version" AS "syllabusVersion", q."generation_metadata" AS "generationMetadata",
           q."review_metadata" AS "reviewMetadata", q."status", q."updated_at" AS "updatedAt"
    FROM "csca_questions" q
    LEFT JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
    WHERE ${where}
    ORDER BY q."updated_at" DESC, q."id" DESC
    LIMIT ${options.limit}
  `);
  const replayRecords = [];
  for (const row of rows) {
    const candidate = candidateFromRow(row);
    const review = await reviewer.review(candidate, reviewContextFromRow(row));
    replayRecords.push({ row, candidate, item: replayDelta(row, review, candidate) });
  }
  const acceptedByCell = new Map();
  const ownerCandidates = replayRecords
    .filter((record) => isOwnerRevalidationCandidate(record.item))
    .sort((left, right) => compareOwnerRevalidationCandidates(left.item, right.item));
  const prePublicationOrderedCandidates = [...ownerCandidates]
    .sort((left, right) => Number(left.item.id) - Number(right.item.id));
  for (const record of prePublicationOrderedCandidates) {
    const cellId = cleanText(record.item.productionCellId) || 'unknown';
    const recent = acceptedByCell.get(cellId) || [];
    const comparable = {
      id: record.item.id,
      subject: record.candidate.subject,
      topicId: record.candidate.topicId,
      topicTitle: cleanText(record.row.topicTitle) || null,
      difficulty: record.candidate.designedDifficulty,
      fingerprint: subjectPracticeBuildQuestionFingerprint({
        subject: record.candidate.subject,
        topicId: record.candidate.topicId,
        topicTitle: cleanText(record.row.topicTitle) || null,
        difficulty: record.candidate.designedDifficulty,
        prompt: record.candidate.prompt,
        options: record.candidate.options,
        explanation: record.candidate.explanation
      }),
      prompt: record.candidate.prompt,
      options: record.candidate.options,
      explanation: record.candidate.explanation
    };
    const uniqueness = subjectPracticePrePublicationUniquenessDecision({
      candidate: comparable,
      recent
    });
    const signal = uniqueness.signal;
    const strictBatchUnique = signal.decision !== 'warn';
    record.item.delta.strictBatchUnique = strictBatchUnique;
    record.item.delta.strictBatchNearDuplicateSignal = signal;
    if (strictBatchUnique) {
      acceptedByCell.set(cellId, [...recent, comparable]);
    }
  }
  for (const record of replayRecords) {
    if (typeof record.item.delta.strictBatchUnique !== 'boolean') {
      record.item.delta.strictBatchUnique = false;
      record.item.delta.strictBatchNearDuplicateSignal = null;
    }
  }
  return replayRecords.map((record) => record.item);
}

async function sourceStatusCounts(prisma, options) {
  const where = buildWhere({
    ...options,
    statuses: []
  });
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(q."generation_metadata"->>'productionCellId', '') AS "productionCellId",
           q."status",
           COUNT(*)::int AS "count"
    FROM "csca_questions" q
    WHERE ${where}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  const byCell = {};
  const total = {};
  for (const row of rows) {
    const cellId = cleanText(row.productionCellId) || 'unknown';
    const status = cleanText(row.status) || 'unknown';
    const count = Number(row.count) || 0;
    byCell[cellId] ||= {};
    byCell[cellId][status] = (byCell[cellId][status] || 0) + count;
    total[status] = (total[status] || 0) + count;
  }
  return {
    total,
    byCell
  };
}

function statusTotal(counts) {
  return Object.values(recordFrom(counts)).reduce((total, count) => total + (Number(count) || 0), 0);
}

function summarize(items, sourceStatuses) {
  const ownerRevalidationCandidates = items
    .filter(isOwnerRevalidationCandidate)
    .sort(compareOwnerRevalidationCandidates);
  const ownerRevalidationCandidatesWithLegacyNonProfileReasons = ownerRevalidationCandidates
    .filter((item) => item.delta.oldNonProfileGateReasons.length > 0);
  const strictBatchUniqueCandidates = ownerRevalidationCandidates
    .filter((item) => item.delta.strictBatchUnique === true)
    .sort((left, right) => Number(left.id) - Number(right.id));
  const strictBatchNearDuplicateCandidates = ownerRevalidationCandidates
    .filter((item) => item.delta.strictBatchNearDuplicateSignal?.decision === 'warn')
    .sort((left, right) => Number(left.id) - Number(right.id));
  const currentQuestionPlanBlockedItems = items.filter((item) => item.delta.currentQuestionPlanAdheres === false);
  const sourceStatusTotal = statusTotal(sourceStatuses.total);
  const replayEligibleSourceCount = Array.from(OWNER_REVALIDATION_ALLOWED_STATUSES)
    .reduce((total, status) => total + (Number(recordFrom(sourceStatuses.total)[status]) || 0), 0);
  return {
    replayed: items.length,
    replayStatusCounts: countBy(items.map((item) => item.status)),
    sourceStatusCounts: recordFrom(sourceStatuses.total),
    sourceStatusCountsByCell: recordFrom(sourceStatuses.byCell),
    sourceCandidateCount: sourceStatusTotal,
    revalidationEligibleSourceCount: replayEligibleSourceCount,
    archivedSourceCount: Number(recordFrom(sourceStatuses.total).archived) || 0,
    policyLearningOnlySourceCount: Math.max(0, sourceStatusTotal - replayEligibleSourceCount),
    revalidationCandidateStatusPolicy: 'owner_revalidation_candidates_restricted_to_pending_review_or_review_failed',
    ownerRevalidationCandidateOrderingPolicy: 'nonlegacy_then_profile_clean_then_profile_only_soft_then_hard_shape_cleared_then_id_ascending_v1',
    oldGateReasonCounts: countBy(items.flatMap((item) => item.oldGateReasons)),
    replayProfileReasonCounts: countBy(items.flatMap((item) => item.replay.profileReasons)),
    replayDifficultyBandCounts: countBy(items.map((item) => item.replay.evidence.inferredDifficultyBand)),
    replayCalculationLoadCounts: countBy(items.map((item) => item.replay.evidence.inferredCalculationLoad)),
    hardShapeSpecificBlockerClearedCount: items.filter((item) => item.delta.hardShapeSpecificBlockersCleared).length,
    profileCleanCount: items.filter((item) => item.delta.profileClean).length,
    formalGateProfileOnlySoftCount: items.filter((item) => item.delta.formalGateProfileOnlySoft).length,
    profileWarningCount: items.filter((item) => item.replay.profileStatus === 'warning').length,
    remainingDifficultyComplexityMismatchCount: items.filter((item) => item.delta.remainingDifficultyComplexityMismatch).length,
    visibleHardEvidenceContractCount: items.filter((item) => item.delta.visibleHardEvidenceContract).length,
    remainingBlockingProfileCount: items.filter((item) => item.replay.profileStatus === 'failed').length,
    currentQuestionPlanBlockedCount: currentQuestionPlanBlockedItems.length,
    currentQuestionPlanBlockedIds: currentQuestionPlanBlockedItems.map((item) => item.id),
    currentQuestionPlanBlockedReasonCounts: countBy(
      currentQuestionPlanBlockedItems.flatMap((item) => item.delta.currentQuestionPlanFailureCodes)
    ),
    ownerRevalidationCandidateCount: ownerRevalidationCandidates.length,
    ownerRevalidationCandidateIds: ownerRevalidationCandidates.map((item) => item.id),
    strictBatchUniquenessPolicy: 'subject-practice-prepublication-uniqueness-v1_current_replay_cohort_question_id_ascending',
    strictBatchUniqueCandidateCount: strictBatchUniqueCandidates.length,
    strictBatchUniqueCandidateIds: strictBatchUniqueCandidates.map((item) => item.id),
    strictBatchNearDuplicateCandidateCount: strictBatchNearDuplicateCandidates.length,
    strictBatchNearDuplicateCandidateIds: strictBatchNearDuplicateCandidates.map((item) => item.id),
    strictBatchUniqueYield: items.length > 0 ? Number((strictBatchUniqueCandidates.length / items.length).toFixed(4)) : null,
    ownerRevalidationLegacyNonProfileRecheckCount: ownerRevalidationCandidatesWithLegacyNonProfileReasons.length,
    ownerRevalidationLegacyNonProfileRecheckIds: ownerRevalidationCandidatesWithLegacyNonProfileReasons.map((item) => item.id),
    ownerRevalidationLegacyNonProfileRecheckItems: ownerRevalidationCandidatesWithLegacyNonProfileReasons.map((item) => ({
      id: item.id,
      reasons: item.delta.oldNonProfileGateReasons
    })),
    ownerRevalidationLegacyNonProfileReasonCounts: countBy(
      ownerRevalidationCandidates.flatMap((item) => item.delta.oldNonProfileGateReasons)
    ),
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only'
  };
}

function runOwnerRevalidationOrderingSelfTest() {
  const candidate = (id, overrides = {}) => ({
    id,
    delta: {
      oldNonProfileGateReasons: [],
      profileClean: false,
      formalGateProfileOnlySoft: false,
      hardShapeSpecificBlockersCleared: false,
      ...overrides
    }
  });
  const orderedIds = [
    candidate(1, { oldNonProfileGateReasons: ['legacy_reason'], profileClean: true }),
    candidate(5, { formalGateProfileOnlySoft: true }),
    candidate(20, { profileClean: true }),
    candidate(10, { profileClean: true })
  ].sort(compareOwnerRevalidationCandidates).map((item) => item.id);
  const expected = '10,20,5,1';
  if (orderedIds.join(',') !== expected) {
    throw new Error(`Owner revalidation ordering expected ${expected}, got ${orderedIds.join(',')}.`);
  }
  const duplicateFixture = {
    id: 101,
    subject: 'math',
    topicId: 69,
    topicTitle: '基本初等函数',
    difficulty: 'basic',
    prompt: '已知函数 f(x)=log_2(x-1)，其定义域为（ ）',
    options: [{ id: 'A', text: '(1,+∞)' }, { id: 'B', text: '[1,+∞)' }],
    explanation: '由 x-1>0 得 x>1。'
  };
  const duplicateSignal = subjectPracticePrePublicationUniquenessDecision({
    candidate: { ...duplicateFixture, id: 102 },
    recent: [duplicateFixture]
  }).signal;
  if (duplicateSignal.decision !== 'warn') {
    throw new Error('Owner replay strict-batch fixture must detect a repeated candidate shell.');
  }
  console.log(JSON.stringify({
    mode: 'owner_revalidation_candidate_ordering_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    orderedIds,
    duplicateDecision: duplicateSignal.decision
  }, null, 2));
}

async function main() {
  if (hasFlag('self-test-owner-revalidation-ordering')) {
    runOwnerRevalidationOrderingSelfTest();
    return;
  }
  loadRootEnv();
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const runId = Number.parseInt(argValue('run', '0'), 10);
  const cells = csvValues(argValue('cells', ''));
  const ids = csvInts(argValue('ids', ''));
  const statuses = csvValues(argValue('statuses', 'pending_review,review_failed'));
  const limit = cleanPositiveInt(argValue('limit', '20'), 20, 1, 100);
  const json = hasFlag('json');
  const summaryOnly = hasFlag('summary-only');
  if (!subject) throw new Error('--subject is required.');
  if ((!Number.isInteger(runId) || runId <= 0) && ids.length === 0) {
    throw new Error('Provide --run=<id> or --ids=<question ids> for bounded replay.');
  }
  const prisma = new PrismaClient();
  try {
    const sourceStatuses = await sourceStatusCounts(prisma, { subject, runId, cells, ids, statuses, limit });
    const items = await replayRows(prisma, { subject, runId, cells, ids, statuses, limit });
    const report = {
      subject,
      mode: 'deterministic-reviewer-profile-replay',
      productionRunId: Number.isInteger(runId) && runId > 0 ? runId : null,
      cells,
      ids,
      statuses,
      limit,
      generatedAt: new Date().toISOString(),
      summary: summarize(items, sourceStatuses),
      items: summaryOnly ? undefined : items
    };
    if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
      return;
    }
    console.log(`Subject-practice reviewer/profile replay: ${subject} run=${report.productionRunId ?? 'ids-only'} cells=${cells.join(',') || 'any'}`);
    console.log(`Mode: deterministic-only reviewer; providerImpact=${report.summary.providerImpact}; dbImpact=${report.summary.dbImpact}`);
    console.log(`Replayed=${report.summary.replayed}; hardShapeSpecificBlockerCleared=${report.summary.hardShapeSpecificBlockerClearedCount}; profileClean=${report.summary.profileCleanCount}; remainingDifficultyComplexityMismatch=${report.summary.remainingDifficultyComplexityMismatchCount}; remainingBlockingProfile=${report.summary.remainingBlockingProfileCount}`);
    for (const item of items.slice(0, 12)) {
      console.log(`- #${item.id} cell=${item.productionCellId} ${item.designedDifficulty}: old=[${item.oldGateReasons.join(',') || 'none'}] newProfile=[${item.replay.profileReasons.join(',') || 'none'}] inferred=${item.replay.evidence.inferredQuestionForm}/${item.replay.evidence.inferredDifficultyBand}/${item.replay.evidence.inferredCalculationLoad}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
