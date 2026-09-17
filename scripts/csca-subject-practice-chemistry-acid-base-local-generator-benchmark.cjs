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
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  subjectPracticeDeterministicProfileReviewForCandidate
} = require('../backend/src/ai-questioning/question-reviewer.service');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION,
  verifySubjectPracticeChemistryAcidBaseExplanation
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-explanation-verifier');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION,
  verifySubjectPracticeChemistryAcidBaseWithIndependentOracle
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  bindings: productionProfileBindings
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const relations = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'];
const targets = ['ph_value', 'acid_base_character'];
const samplesPerScope = 128;
const blueprint = {
  id: 42,
  subject: 'chemistry',
  topicId: 51,
  topicCode: 'C-BASIC-003',
  topicModule: '溶液',
  topicTitle: productionProfileBindings.chemistry.topicTitle,
  syllabusVersion: '2025',
  examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['medium'],
  excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve'],
  difficulty: 'medium',
  questionType: 'single_choice',
  skill: 'standard_application',
  constraints: {}
};
const validator = new QuestionValidatorService();
const samples = [];
const productionTargetProfile = productionProfileBindings.chemistry.targetProfile;
for (const relationKind of relations) {
  for (const answerTarget of targets) {
    const questionPlan = buildSubjectPracticeQuestionPlan({
      subject: 'chemistry', topicId: 51, topicTitle: blueprint.topicTitle, productionCellId: 42,
      targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      exactChemistryRelationKind: relationKind,
      exactChemistryAnswerTarget: answerTarget
    });
    for (let seed = 0; seed < samplesPerScope; seed += 1) {
      const generated = generateSubjectPracticeChemistryAcidBaseLocally({ blueprint, questionPlan, seed, relationKind, answerTarget });
      const deterministicReview = generated.candidate ? validator.review(generated.candidate, {
        subject: 'chemistry', intendedUse: 'subject_practice', topicId: 51,
        topicTitle: blueprint.topicTitle, syllabusVersion: '2025', questionPlan
      }) : null;
      const deterministicProfileReview = generated.candidate
        ? subjectPracticeDeterministicProfileReviewForCandidate(generated.candidate, {
          subject: 'chemistry', intendedUse: 'subject_practice', topicId: 51,
          topicTitle: blueprint.topicTitle, examScope: blueprint.examScope, syllabusVersion: '2025', topicStatus: 'published',
          styleProfile: { id: 699, confidence: 'high', profile: {} },
          targetProfile: productionTargetProfile,
          questionPlan
        })
        : null;
      const explanationVerification = generated.candidate
        ? verifySubjectPracticeChemistryAcidBaseExplanation(generated.candidate, {
          taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan
        })
        : null;
      const independentOracle = generated.candidate
        ? verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(generated.candidate, { questionPlan })
        : null;
      samples.push({ relationKind, answerTarget, seed, questionPlan, generated, deterministicReview, deterministicProfileReview, explanationVerification, independentOracle });
    }
  }
}

function fingerprint(candidate, ignoreOptionPosition) {
  if (!candidate) return null;
  return crypto.createHash('sha256').update(JSON.stringify({
    prompt: candidate.prompt,
    options: ignoreOptionPosition ? candidate.options.map((option) => option.text).sort() : candidate.options
  })).digest('hex');
}

const exactFingerprints = samples.map((sample) => fingerprint(sample.generated.candidate, false)).filter(Boolean);
const semanticFingerprints = samples.map((sample) => fingerprint(sample.generated.candidate, true)).filter(Boolean);
const selfVerifiedCount = samples.filter((sample) => sample.generated.status === 'generated_and_self_verified').length;
const validatorBlockingFreeCount = samples.filter((sample) => sample.deterministicReview
  && !sample.deterministicReview.issues.some((issue) => issue.severity === 'error')).length;
const reviewerProfileDifficultyMatchedCount = samples.filter((sample) => sample.deterministicProfileReview
  ?.profileAlignment?.evidence?.inferredDifficultyBand === productionTargetProfile.difficultyBand).length;
const reviewerProfileBlockingFreeCount = samples.filter((sample) => sample.deterministicProfileReview
  && sample.deterministicProfileReview.issue === null).length;
const explanationVerifiedCount = samples.filter((sample) => sample.explanationVerification?.status === 'verified').length;
const explanationMismatchCount = samples.reduce((sum, sample) => sum + (sample.explanationVerification?.mismatchCount ?? 1), 0);
const independentOracleComparedCount = samples.filter((sample) => sample.generated.candidate && sample.independentOracle).length;
const independentOracleAgreementCount = samples.filter((sample) => sample.independentOracle?.status === 'verified'
  && sample.independentOracle.selectedOptionId === sample.generated.verification?.selectedOptionId
  && sample.independentOracle.scopeId === sample.generated.scopeId).length;
const oracleSource = fs.readFileSync(path.resolve(__dirname, '../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle.ts'), 'utf8');
const independentOracleSourceIndependence = {
  importsGenerator: /from ['"].*chemistry-acid-base-local-generator['"]/.test(oracleSource),
  importsSolver: /from ['"].*chemistry-acid-base-solver['"]/.test(oracleSource)
};
function clone(value) { return JSON.parse(JSON.stringify(value)); }
const independentOracleMutationResults = samples.flatMap((sample) => {
  const candidate = sample.generated.candidate;
  if (!candidate) return [];
  const answerFlip = clone(candidate);
  answerFlip.correctAnswer = answerFlip.correctAnswer === 'A' ? 'B' : 'A';
  const duplicateTrue = clone(candidate);
  const correctText = duplicateTrue.options.find((option) => option.id === duplicateTrue.correctAnswer).text;
  duplicateTrue.options.find((option) => option.id !== duplicateTrue.correctAnswer).text = correctText;
  const malformedOption = clone(candidate);
  malformedOption.options.find((option) => option.id === malformedOption.correctAnswer).text = '无法解析的化学结论';
  const unsupportedPrompt = clone(candidate);
  unsupportedPrompt.prompt = '向醋酸缓冲溶液中滴加强碱，根据滴定曲线判断等当点。';
  return [
    ['generator_answer_flip', answerFlip],
    ['second_true_option', duplicateTrue],
    ['malformed_true_option', malformedOption],
    ['unsupported_weak_buffer_titration_prompt', unsupportedPrompt]
  ].map(([type, mutated]) => ({
    type,
    evidence: verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(mutated, { questionPlan: sample.questionPlan })
  }));
});
const independentOracleFalseAcceptCount = independentOracleMutationResults
  .filter((item) => item.evidence.status === 'verified').length;
const answerPositionCounts = samples.reduce((counts, sample) => {
  const answer = sample.generated.candidate?.correctAnswer ?? 'missing';
  counts[answer] = (counts[answer] || 0) + 1;
  return counts;
}, {});
const scopeCounts = samples.reduce((counts, sample) => {
  const scope = sample.generated.scopeId ?? 'missing';
  counts[scope] = (counts[scope] || 0) + 1;
  return counts;
}, {});
const semanticDiversityBySlot = relations.flatMap((relationKind) => targets.map((answerTarget) => {
  const slotSamples = samples.filter((sample) => sample.relationKind === relationKind && sample.answerTarget === answerTarget);
  return {
    relationKind,
    answerTarget,
    total: slotSamples.length,
    uniqueIgnoringOptionPosition: new Set(slotSamples.map((sample) => fingerprint(sample.generated.candidate, true))).size
  };
}));
const failures = samples.filter((sample) => sample.generated.status !== 'generated_and_self_verified'
  || !sample.deterministicReview
  || sample.deterministicReview.issues.some((issue) => issue.severity === 'error')
  || sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand !== productionTargetProfile.difficultyBand
  || sample.deterministicProfileReview?.issue !== null
  || sample.explanationVerification?.status !== 'verified'
  || sample.independentOracle?.status !== 'verified');
const scopeInputMismatch = generateSubjectPracticeChemistryAcidBaseLocally({
  blueprint,
  questionPlan: samples[0].questionPlan,
  seed: 0,
  relationKind: 'strong_base_dilution',
  answerTarget: 'ph_value'
});
const scopeInputMismatchRejected = scopeInputMismatch.status === 'unsupported_question_plan'
  && scopeInputMismatch.candidate === null;
const passed = selfVerifiedCount === samples.length
  && validatorBlockingFreeCount === samples.length
  && reviewerProfileDifficultyMatchedCount === samples.length
  && reviewerProfileBlockingFreeCount === samples.length
  && explanationVerifiedCount === samples.length
  && explanationMismatchCount === 0
  && independentOracleComparedCount === samples.length
  && independentOracleAgreementCount === samples.length
  && independentOracleFalseAcceptCount === 0
  && scopeInputMismatchRejected
  && !independentOracleSourceIndependence.importsGenerator
  && !independentOracleSourceIndependence.importsSolver
  && new Set(exactFingerprints).size === samples.length
  && new Set(semanticFingerprints).size === samples.length
  && ['A', 'B', 'C', 'D'].every((id) => answerPositionCounts[id] === samples.length / 4)
  && Object.keys(scopeCounts).length === 6
  && Object.values(scopeCounts).every((count) => count === samplesPerScope);
const report = {
  mode: 'subject_practice_chemistry_acid_base_local_generator_benchmark',
  status: passed ? 'local_generator_shadow_benchmark_passed' : 'local_generator_shadow_benchmark_failed',
  generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
  benchmarkVersion: 'chemistry-acid-base-local-generator-benchmark-v7-production-profile-bound',
  productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  productionProfileBindingDigest: productionProfileBindings.chemistry.bindingDigest,
  productionRunId: productionProfileBindings.chemistry.productionRunId,
  productionCellId: productionProfileBindings.chemistry.productionCellId,
  productionImpact: 'none_fixture_only_shadow',
  providerImpact: 'none_no_provider_call',
  providerCallCount: 0,
  estimatedCostUsd: 0,
  publicationImpact: 'none',
  samplesPerScope,
  sampleCount: samples.length,
  selfVerifiedCount,
  deterministicValidatorBlockingFreeCount: validatorBlockingFreeCount,
  reviewerProfileDifficultyMatchedCount,
  reviewerProfileBlockingFreeCount,
  explanationVerifierVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION,
  explanationVerifiedCount,
  explanationMismatchCount,
  independentOracleVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION,
  independentOracleComparedCount,
  independentOracleAgreementCount,
  independentOracleFalseAcceptCount,
  independentOracleMutationCaseCount: independentOracleMutationResults.length,
  independentOracleSourceIndependence,
  scopeInputMismatchRejected,
  scopeInputMismatchReasonCodes: scopeInputMismatch.reasonCodes,
  uniquePromptOptionFingerprintCount: new Set(exactFingerprints).size,
  uniqueSemanticFingerprintIgnoringOptionPositionCount: new Set(semanticFingerprints).size,
  answerPositionCounts,
  scopeCounts,
  semanticDiversityBySlot,
  costEvidence: {
    avoidedProviderCallOpportunityCount: samples.length,
    realizedProviderSpendUsd: 0,
    dollarSavingsClaimed: false,
    reason: 'no_like_for_like_live_provider_cost_baseline_for_this_exact_chemistry_family'
  },
  releaseQualification: false,
  releaseQualificationReason: 'shadow_local_generation_requires_source_isolation_regression_and_suppressed_production_shadow_before_release_policy_decision',
  failures: failures.slice(0, 20).map((sample) => ({
    relationKind: sample.relationKind,
    answerTarget: sample.answerTarget,
    seed: sample.seed,
    generationStatus: sample.generated.status,
    generationReasons: sample.generated.reasonCodes,
    validatorErrors: sample.deterministicReview?.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code) ?? [],
    reviewerInferredDifficultyBand: sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand ?? null,
    reviewerProfileIssue: sample.deterministicProfileReview?.issue?.code ?? null,
    explanationStatus: sample.explanationVerification?.status ?? null,
    explanationFailureCodes: sample.explanationVerification?.reasonCodes ?? [],
    independentOracleStatus: sample.independentOracle?.status ?? null,
    independentOracleFailureCodes: sample.independentOracle?.reasonCodes ?? []
  }))
};

if (require.main === module) {
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

module.exports = { report };
