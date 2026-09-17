#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));
const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');
const {
  subjectPracticeObservationBatchEnvelopeFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  assertSubjectPracticeObservationScenarioBlueprintAddendum
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-addendum-policy');
const {
  subjectPracticeObservationScopeBindingFor,
  subjectPracticeObservationQuestionPlanRotationInputFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scope-binding-policy');
const {
  subjectPracticeLocalShadowCandidateSeedBindingFor,
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanGateFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle');
const {
  subjectPracticeScenarioBlueprintShadowEvidenceFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-shadow-evidence-policy');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const {
  SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
  applySubjectPracticeAutomatedCandidateLeakageGate,
  subjectPracticeAutomatedCandidateLeakageEvidenceForRows,
  subjectPracticeReviewGateDecisionForOfflineEvaluation,
  subjectPracticeSourceSimilarityForRows
} = require('../backend/src/ai-questioning/ai-questioning.service');
const {
  bindings: productionProfileBindings,
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const DEFAULT_MANIFEST = 'artifacts/ai-questioning/chemistry-dynamic-scenario-v4-method-neutral-20260914-manifest.json';
const DEFAULT_ADDENDUM = 'artifacts/ai-questioning/chemistry-dynamic-scenario-v4-method-neutral-20260914-addendum.json';

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function readJson(inputPath) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  return { absolutePath, value: JSON.parse(fs.readFileSync(absolutePath, 'utf8')) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fingerprint(candidate, ignoreOptionPosition = false) {
  if (!candidate) return null;
  return sha256({
    prompt: candidate.prompt,
    options: ignoreOptionPosition
      ? candidate.options.map((option) => option.text).sort()
      : candidate.options
  });
}

function countsFor(values) {
  return values.reduce((counts, value) => {
    const key = String(value ?? 'missing');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function loadDatabaseCorpusSnapshot(profileBinding, syllabusVersion) {
  const prisma = new PrismaClient();
  try {
    return await prisma.$transaction(async (tx) => {
      const sourceRows = await tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."document_id" AS "documentId", q."question_number" AS "questionNumber",
               q."subject", q."language", q."prompt_text" AS "promptText", q."options",
               q."correct_answer" AS "correctAnswer", q."explanation"
        FROM "csca_source_questions" q
        JOIN "csca_source_documents" d ON d."id" = q."document_id"
        WHERE q."subject" = 'chemistry'
          AND d."status" = 'active'
        ORDER BY q."document_id" ASC, q."id" ASC
      `);
      const duplicateRows = await tx.$queryRaw(Prisma.sql`
        SELECT "prompt"
        FROM "csca_questions"
        WHERE "topic_id" = ${profileBinding.topicId}
          AND "status" = 'approved'
        ORDER BY "updated_at" DESC, "id" DESC
        LIMIT 30
      `);
      const styleRows = await tx.$queryRaw(Prisma.sql`
        SELECT p."id", p."scope_type" AS "scopeType", p."scope_id" AS "scopeId",
               p."source_question_ids" AS "sourceQuestionIds", p."sample_size" AS "sampleSize",
               p."confidence", p."profile", p."profile_version" AS "profileVersion",
               p."source_question_snapshot_hash" AS "sourceQuestionSnapshotHash"
        FROM "csca_question_style_profiles" p
        WHERE p."status" = 'active'
          AND p."subject" = 'chemistry'
          AND p."syllabus_version" = ${syllabusVersion}
          AND ((p."scope_type" = 'topic' AND p."scope_id" = ${profileBinding.topicId})
            OR p."scope_type" = 'subject')
        ORDER BY CASE WHEN p."scope_type" = 'topic' THEN 0 ELSE 1 END,
                 p."generated_at" DESC,
                 p."id" DESC
        LIMIT 1
      `);
      return {
        sourceRows,
        duplicatePrompts: duplicateRows.map((row) => String(row.prompt ?? '')),
        styleProfile: styleRows[0] ?? null
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const manifestFile = readJson(argValue('manifest', DEFAULT_MANIFEST));
  const addendumFile = readJson(argValue('addendum', DEFAULT_ADDENDUM));
  const manifest = manifestFile.value;
  const addendum = assertSubjectPracticeObservationScenarioBlueprintAddendum({
    manifest,
    addendum: addendumFile.value
  });
  const profileBinding = productionProfileBindings.chemistry;
  const targetProfile = profileBinding.targetProfile;
  const withDatabaseCorpus = process.argv.includes('--with-database-corpus');
  const blueprint = {
    id: profileBinding.productionCellId,
    subject: 'chemistry',
    topicId: profileBinding.topicId,
    topicCode: profileBinding.topicCode,
    topicModule: '溶液',
    topicTitle: profileBinding.topicTitle,
    syllabusVersion: '2025',
    examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
    allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['medium'],
    excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve'],
    difficulty: 'medium',
    questionType: 'single_choice',
    skill: 'standard_application',
    constraints: { targetProfile }
  };
  const validator = new QuestionValidatorService();
  const reviewer = new QuestionReviewerService(validator, {});
  const databaseCorpus = withDatabaseCorpus
    ? await loadDatabaseCorpusSnapshot(profileBinding, blueprint.syllabusVersion)
    : null;
  const styleProfile = databaseCorpus
    ? databaseCorpus.styleProfile ? {
        id: databaseCorpus.styleProfile.id,
        confidence: databaseCorpus.styleProfile.confidence,
        profile: databaseCorpus.styleProfile.profile,
        profileVersion: databaseCorpus.styleProfile.profileVersion,
        scopeType: databaseCorpus.styleProfile.scopeType,
        scopeId: databaseCorpus.styleProfile.scopeId,
        sampleSize: databaseCorpus.styleProfile.sampleSize,
        snapshotHash: databaseCorpus.styleProfile.sourceQuestionSnapshotHash,
        sourceQuestionIds: databaseCorpus.styleProfile.sourceQuestionIds,
        referencePolicy: 'profile_only'
      }
      : null
    : { id: 699, confidence: 'high', profile: {}, referencePolicy: 'profile_only' };
  const entriesByOrdinal = new Map(addendum.entries.map((entry) => [entry.taskOrdinal, entry]));
  const samples = [];

  for (const descriptor of manifest.tasks) {
    const envelope = subjectPracticeObservationBatchEnvelopeFor({
      manifest,
      taskOrdinal: descriptor.ordinal
    });
    const binding = subjectPracticeObservationScopeBindingFor({ envelope });
    const entry = entriesByOrdinal.get(descriptor.ordinal);
    if (!entry) throw new Error(`scenario_blueprint_addendum_task_ordinal_missing:${descriptor.ordinal}`);
    const questionPlan = buildSubjectPracticeQuestionPlan({
      subject: descriptor.subject,
      topicId: profileBinding.topicId,
      topicTitle: profileBinding.topicTitle,
      productionCellId: descriptor.productionCellId,
      targetDifficulty: profileBinding.difficultyBand,
      taskFamily: descriptor.taskFamily,
      ...subjectPracticeObservationQuestionPlanRotationInputFor(binding)
    });
    const questionPlanGate = subjectPracticeQuestionPlanGateFor({
      subject: descriptor.subject,
      productionCellId: descriptor.productionCellId,
      topicTitle: profileBinding.topicTitle,
      targetDifficulty: profileBinding.difficultyBand,
      taskFamily: descriptor.taskFamily,
      planTemplate: descriptor.planTemplate,
      questionPlan,
      targetProfile,
      env: {
        CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED: 'true',
        CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST: String(descriptor.productionCellId)
      }
    });
    const candidateSeedBinding = subjectPracticeLocalShadowCandidateSeedBindingFor({
      observationBatchId: binding.batchId,
      taskOrdinal: binding.taskOrdinal,
      productionRunId: descriptor.productionRunId,
      productionCellId: descriptor.productionCellId
    });
    const generated = generateSubjectPracticeChemistryAcidBaseLocally({
      blueprint,
      questionPlan,
      seed: candidateSeedBinding.seed,
      relationKind: binding.rotation.chemistryRelationKind,
      answerTarget: binding.rotation.chemistryAnswerTarget,
      scenarioBlueprintShadowContext: entry.scenarioBlueprintShadowContext
    });
    const scenarioEvidence = subjectPracticeScenarioBlueprintShadowEvidenceFor({
      scenarioBlueprintShadowContext: entry.scenarioBlueprintShadowContext,
      generationResult: generated
    });
    const candidate = generated.candidate;
    const baseReview = candidate
      ? await reviewer.review(candidate, {
        subject: 'chemistry',
        intendedUse: 'subject_practice',
        topicId: profileBinding.topicId,
        topicTitle: profileBinding.topicTitle,
        examScope: blueprint.examScope,
        syllabusVersion: blueprint.syllabusVersion,
        topicStatus: 'published',
        styleProfile,
        targetProfile,
        questionPlan,
        duplicatePromptCount: databaseCorpus
          ? databaseCorpus.duplicatePrompts.filter((prompt) => prompt.trim().toLowerCase() === candidate.prompt.trim().toLowerCase()).length
          : 0,
        duplicatePrompts: databaseCorpus?.duplicatePrompts ?? [],
        reviewProviderMode: 'deterministic_only'
      })
      : null;
    const leakageEvidence = candidate && databaseCorpus
      ? subjectPracticeAutomatedCandidateLeakageEvidenceForRows(candidate, databaseCorpus.sourceRows)
      : null;
    const review = baseReview
      ? applySubjectPracticeAutomatedCandidateLeakageGate(baseReview, leakageEvidence)
      : null;
    const generationMetadataBase = candidate && review ? {
      generator: 'local-deterministic',
      model: generated.generatorVersion,
      sourceKind: 'syllabus',
      intendedUse: 'subject_practice',
      generationMode: 'subject_practice_production_matrix_observation',
      scope: {
        subject: 'chemistry',
        topicId: profileBinding.topicId,
        topicCode: profileBinding.topicCode,
        topicTitle: profileBinding.topicTitle,
        examScope: blueprint.examScope,
        intendedUse: 'subject_practice',
        targetUseCase: 'subject_practice'
      },
      syllabusScope: {
        subject: 'chemistry',
        topicId: profileBinding.topicId,
        topicCode: profileBinding.topicCode,
        topicTitle: profileBinding.topicTitle,
        examScope: blueprint.examScope
      },
      targetProfile,
      productionGapKey: targetProfile.gapKey,
      questionPlanGate,
      questionPlan,
      questionPlanAdherence: generated.adherence,
      formalVerificationBundle: review.formalVerificationBundle,
      scenarioContract: questionPlan.scenarioContract,
      scenarioEvidence,
      localShadowGeneration: {
        generatorVersion: generated.generatorVersion,
        status: generated.status,
        scenarioEvidence
      },
      styleProfile,
      localizations: candidate.localizations,
      fallbackUsed: false
    } : null;
    const sourceSimilarity = candidate && generationMetadataBase && databaseCorpus
      ? subjectPracticeSourceSimilarityForRows(candidate, generationMetadataBase, databaseCorpus.sourceRows)
      : null;
    const generationMetadata = generationMetadataBase
      ? { ...generationMetadataBase, ...(sourceSimilarity ? { sourceSimilarity } : {}) }
      : null;
    const reviewGate = review && generationMetadata
      ? subjectPracticeReviewGateDecisionForOfflineEvaluation(review, generationMetadata)
      : null;
    samples.push({
      ordinal: descriptor.ordinal,
      plannedScopeId: descriptor.plannedScopeId,
      scenarioFamilyId: entry.scenarioFamilyId,
      scenarioSeed: binding.scenarioSeed,
      candidateSeedBinding,
      questionPlanGate,
      generated,
      scenarioEvidence,
      leakageEvidence,
      sourceSimilarity,
      review,
      reviewGate,
      fingerprint: fingerprint(candidate),
      semanticFingerprint: fingerprint(candidate, true)
    });
  }

  const failureRows = samples.filter((sample) => (
    sample.questionPlanGate.generationAllowed !== true
    || sample.generated.status !== 'generated_and_self_verified'
    || sample.scenarioEvidence.status !== 'shadow_candidate_evidence_complete'
    || !sample.review
    || sample.review.status === 'failed'
    || sample.review.issues.some((issue) => issue.severity === 'error')
    || sample.reviewGate?.publishable !== true
  ));
  const fingerprints = samples.map((sample) => sample.fingerprint).filter(Boolean);
  const semanticFingerprints = samples.map((sample) => sample.semanticFingerprint).filter(Boolean);
  const passed = failureRows.length === 0
    && samples.length === manifest.tasks.length
    && new Set(fingerprints).size === samples.length
    && new Set(semanticFingerprints).size === samples.length;
  const report = {
    mode: 'subject_practice_chemistry_sealed_batch_offline_dry_run',
    policyVersion: 'subject-practice-chemistry-sealed-batch-offline-dry-run-v4-sealed-candidate-seed',
    status: passed ? 'sealed_batch_offline_gate_passed' : 'sealed_batch_offline_gate_failed',
    manifestPath: manifestFile.absolutePath,
    manifestSha256: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 }).manifestSha256,
    addendumPath: addendumFile.absolutePath,
    addendumSha256: addendum.addendumSha256,
    scenarioBlueprintRootSha256: addendum.scenarioBlueprintRootSha256,
    generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
    reviewGatePolicyVersion: SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
    chemistryAcidBaseSolverVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
    chemistryAcidBaseIndependentOracleVersion:
      SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION,
    localShadowCandidateSeedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    productionProfileBindingDigest: profileBinding.bindingDigest,
    providerCallCount: 0,
    estimatedCostUsd: 0,
    databaseImpact: withDatabaseCorpus ? 'read_only_repeatable_read_snapshot' : 'none_offline_only',
    publicationImpact: 'none_suppressed',
    sampleCount: samples.length,
    questionPlanGateAllowedCount: samples.filter((sample) => sample.questionPlanGate.generationAllowed).length,
    selfVerifiedCount: samples.filter((sample) => sample.generated.status === 'generated_and_self_verified').length,
    scenarioEvidenceCompleteCount: samples.filter((sample) => sample.scenarioEvidence.status === 'shadow_candidate_evidence_complete').length,
    deterministicReviewNonFailedCount: samples.filter((sample) => sample.review && sample.review.status !== 'failed').length,
    deterministicReviewErrorFreeCount: samples.filter((sample) => sample.review && !sample.review.issues.some((issue) => issue.severity === 'error')).length,
    gatePublishableCount: samples.filter((sample) => sample.reviewGate?.publishable === true).length,
    gateDecisionCounts: countsFor(samples.map((sample) => sample.reviewGate?.decision)),
    leakageGateStatusCounts: countsFor(samples.map((sample) => sample.leakageEvidence?.status ?? 'not_checked')),
    candidateNoveltyPolicyBinding: samples.some((sample) => sample.leakageEvidence) ? {
      candidateOutputNoveltyPolicyVersion: samples.find((sample) => sample.leakageEvidence)?.leakageEvidence?.policyVersion ?? null,
      candidateNoveltyCorpusSnapshotVersion:
        samples.find((sample) => sample.leakageEvidence)?.leakageEvidence?.sourceCorpusSnapshotVersion ?? null,
      candidateNoveltyMatchDigestVersion:
        samples.find((sample) => sample.leakageEvidence)?.leakageEvidence?.revisionMatchDigestVersion ?? null,
      structuredSourceCorpusSchemaVersion:
        samples.find((sample) => sample.leakageEvidence)?.leakageEvidence?.structuredCorpusSchemaVersion ?? null,
      sourceCorpusNormalizationVersion:
        samples.find((sample) => sample.leakageEvidence)?.leakageEvidence?.normalizationVersion ?? null
    } : null,
    sourceCorpusRevisionCount: databaseCorpus?.sourceRows.length ?? 0,
    sourceCorpusSnapshotSha256:
      samples.find((sample) => sample.leakageEvidence?.sourceCorpusSnapshotSha256)?.leakageEvidence?.sourceCorpusSnapshotSha256
      ?? null,
    approvedTopicPromptComparisonCount: databaseCorpus?.duplicatePrompts.length ?? 0,
    styleProfileId: databaseCorpus?.styleProfile?.id ?? null,
    styleProfileSourceSnapshotHash: databaseCorpus?.styleProfile?.sourceQuestionSnapshotHash ?? null,
    sourceSimilarityCheckedCount: samples.filter((sample) => sample.sourceSimilarity?.checked === true).length,
    maximumSourceSimilarity: Math.max(0, ...samples.map((sample) => Number(sample.sourceSimilarity?.maxSimilarity ?? 0))),
    uniquePromptOptionFingerprintCount: new Set(fingerprints).size,
    uniqueSemanticFingerprintIgnoringOptionPositionCount: new Set(semanticFingerprints).size,
    scopeCounts: countsFor(samples.map((sample) => sample.plannedScopeId)),
    scenarioFamilyCounts: countsFor(samples.map((sample) => sample.scenarioFamilyId)),
    failureCount: failureRows.length,
    failures: failureRows.slice(0, 20).map((sample) => ({
      ordinal: sample.ordinal,
      plannedScopeId: sample.plannedScopeId,
      scenarioFamilyId: sample.scenarioFamilyId,
      questionPlanFailureCodes: sample.questionPlanGate.reasonCodes,
      generationStatus: sample.generated.status,
      generationFailureCodes: sample.generated.reasonCodes,
      scenarioEvidenceBlockers: sample.scenarioEvidence.blockers,
      reviewStatus: sample.review?.status ?? null,
      reviewIssueCodes: sample.review?.issues.map((issue) => `${issue.severity}:${issue.code}`) ?? [],
      gateDecision: sample.reviewGate?.decision ?? null,
      gateReasonCodes: sample.reviewGate?.reasons ?? []
    })),
    releaseQualification: false,
    limitation: withDatabaseCorpus
      ? 'read-only corpus audit covers the current database snapshot but does not write observation evidence; exact authorized shadow execution remains required'
      : 'offline dry-run excludes database-backed novelty and source-corpus similarity checks; rerun with --with-database-corpus or execute the exact authorized shadow batch'
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue('out', '');
  if (outputPath) {
    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, serialized, { encoding: 'utf8', flag: 'wx' });
  }
  process.stdout.write(serialized);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
