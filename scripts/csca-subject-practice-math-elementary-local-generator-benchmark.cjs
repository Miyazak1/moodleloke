#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticeMathElementaryLocally
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  subjectPracticeDeterministicProfileReviewForCandidate
} = require('../backend/src/ai-questioning/question-reviewer.service');
const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION,
  verifySubjectPracticeMathElementaryExplanation
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-explanation-verifier');
const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION,
  verifySubjectPracticeMathElementaryWithIndependentOracle
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-independent-oracle');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  bindings: productionProfileBindings
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const slots = [
  ['logarithmic', 'domain'],
  ['exponential', 'range'],
  ['radical', 'monotonicity'],
  ['power', 'function_value']
];
const samplesPerScope = 128;

function questionPlan(functionClass, propertyTarget) {
  return buildSubjectPracticeQuestionPlan({
    subject: 'math',
    topicId: 69,
    topicTitle: '基本初等函数',
    productionCellId: 16,
    targetDifficulty: 'basic',
    taskFamily: 'elementary_function_direct_property',
    requiredElementaryFunctionClass: functionClass,
    requiredSinglePropertyTarget: propertyTarget
  });
}

const blueprint = {
  id: 16,
  subject: 'math',
  topicId: 69,
  topicCode: productionProfileBindings.math.topicCode,
  topicModule: '函数',
  topicTitle: '基本初等函数',
  syllabusVersion: '2025',
  examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: [],
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'concept_identification',
  constraints: {}
};

const validator = new QuestionValidatorService();
const samples = [];
const productionTargetProfile = productionProfileBindings.math.targetProfile;
for (const [functionClass, propertyTarget] of slots) {
  const plan = questionPlan(functionClass, propertyTarget);
  for (let seed = 0; seed < samplesPerScope; seed += 1) {
    const generated = generateSubjectPracticeMathElementaryLocally({ blueprint, questionPlan: plan, seed });
    const deterministicReview = generated.candidate
      ? validator.review(generated.candidate, {
        subject: 'math',
        intendedUse: 'subject_practice',
        topicId: 69,
        topicTitle: '基本初等函数',
        syllabusVersion: '2025',
        questionPlan: plan
      })
      : null;
    const deterministicProfileReview = generated.candidate
      ? subjectPracticeDeterministicProfileReviewForCandidate(generated.candidate, {
        subject: 'math', intendedUse: 'subject_practice', topicId: 69,
        topicTitle: '基本初等函数', examScope: blueprint.examScope, syllabusVersion: '2025', topicStatus: 'published',
        styleProfile: { id: 663, confidence: 'high', profile: {} },
        targetProfile: productionTargetProfile,
        questionPlan: plan
      })
      : null;
    const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate) : null;
    const explanationVerification = generated.candidate
      ? verifySubjectPracticeMathElementaryExplanation(generated.candidate, { questionPlan: plan })
      : null;
    const independentOracle = generated.candidate
      ? verifySubjectPracticeMathElementaryWithIndependentOracle(generated.candidate, { questionPlan: plan })
      : null;
    samples.push({ functionClass, propertyTarget, seed, plan, generated, deterministicReview, deterministicProfileReview, adherence, explanationVerification, independentOracle });
  }
}

const fingerprints = samples.map((sample) => sample.generated.candidate
  ? crypto.createHash('sha256').update(JSON.stringify({
    prompt: sample.generated.candidate.prompt,
    options: sample.generated.candidate.options
  })).digest('hex')
  : null).filter(Boolean);
const semanticFingerprints = samples.map((sample) => sample.generated.candidate
  ? crypto.createHash('sha256').update(JSON.stringify({
    prompt: sample.generated.candidate.prompt,
    optionTextsIgnoringPosition: sample.generated.candidate.options.map((option) => option.text).sort()
  })).digest('hex')
  : null).filter(Boolean);
const selfVerifiedCount = samples.filter((sample) => sample.generated.status === 'generated_and_self_verified').length;
const validatorBlockingFreeCount = samples.filter((sample) => sample.deterministicReview
  && !sample.deterministicReview.issues.some((issue) => issue.severity === 'error')).length;
const reviewerProfileDifficultyMatchedCount = samples.filter((sample) => sample.deterministicProfileReview
  ?.profileAlignment?.evidence?.inferredDifficultyBand === productionTargetProfile.difficultyBand).length;
const reviewerProfileBlockingFreeCount = samples.filter((sample) => sample.deterministicProfileReview
  && sample.deterministicProfileReview.issue === null).length;
const questionPlanAdherentCount = samples.filter((sample) => sample.adherence?.adheres === true).length;
const explanationVerifiedCount = samples.filter((sample) => sample.explanationVerification?.status === 'verified').length;
const explanationMismatchCount = samples.reduce((sum, sample) => sum + (sample.explanationVerification?.mismatchCount ?? 1), 0);
const independentOracleComparedCount = samples.filter((sample) => sample.generated.candidate && sample.independentOracle).length;
const independentOracleAgreementCount = samples.filter((sample) => sample.independentOracle?.status === 'verified'
  && sample.independentOracle.selectedOptionId === sample.generated.verification?.selectedOptionId
  && sample.independentOracle.scopeId === sample.generated.scopeId).length;
const oracleSource = fs.readFileSync(path.resolve(__dirname, '../backend/src/ai-questioning/subject-practice-math-elementary-independent-oracle.ts'), 'utf8');
const independentOracleSourceIndependence = {
  importsGenerator: /from ['"].*math-elementary-local-generator['"]/.test(oracleSource),
  importsSolver: /from ['"].*subject-practice-math-solver['"]/.test(oracleSource)
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
  malformedOption.options.find((option) => option.id === malformedOption.correctAnswer).text = '无法解析的选项';
  const unsupportedPrompt = clone(candidate);
  unsupportedPrompt.prompt = '请根据函数图像综合判断它的零点、奇偶性与周期性。';
  return [
    ['generator_answer_flip', answerFlip],
    ['second_true_option', duplicateTrue],
    ['malformed_true_option', malformedOption],
    ['unsupported_cross_property_prompt', unsupportedPrompt]
  ].map(([type, mutated]) => ({
    type,
    evidence: verifySubjectPracticeMathElementaryWithIndependentOracle(mutated, { questionPlan: sample.plan })
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
  const scopeId = sample.generated.scopeId ?? 'missing';
  counts[scopeId] = (counts[scopeId] || 0) + 1;
  return counts;
}, {});
const adherenceBySlot = samples.reduce((counts, sample) => {
  const key = `${sample.functionClass}:${sample.propertyTarget}`;
  const current = counts[key] || { total: 0, adherent: 0, failureCodes: {} };
  current.total += 1;
  if (sample.adherence?.adheres) current.adherent += 1;
  for (const code of sample.adherence?.failureCodes ?? []) {
    current.failureCodes[code] = (current.failureCodes[code] || 0) + 1;
  }
  counts[key] = current;
  return counts;
}, {});
const semanticDiversityBySlot = slots.reduce((counts, [functionClass, propertyTarget]) => {
  const slotSamples = samples.filter((sample) => sample.functionClass === functionClass && sample.propertyTarget === propertyTarget);
  const slotFingerprints = slotSamples.map((sample) => crypto.createHash('sha256').update(JSON.stringify({
    prompt: sample.generated.candidate?.prompt ?? null,
    optionTextsIgnoringPosition: sample.generated.candidate?.options.map((option) => option.text).sort() ?? []
  })).digest('hex'));
  counts[`${functionClass}:${propertyTarget}`] = {
    total: slotSamples.length,
    uniqueIgnoringOptionPosition: new Set(slotFingerprints).size
  };
  return counts;
}, {});
const failures = samples.filter((sample) => sample.generated.status !== 'generated_and_self_verified'
  || !sample.deterministicReview
  || sample.deterministicReview.issues.some((issue) => issue.severity === 'error')
  || sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand !== productionTargetProfile.difficultyBand
  || sample.deterministicProfileReview?.issue !== null
  || sample.adherence?.adheres !== true
  || sample.explanationVerification?.status !== 'verified'
  || sample.independentOracle?.status !== 'verified');
const observedDeepSeekMeanCostUsd = 0.00195972 / 3;
const passed = selfVerifiedCount === samples.length
  && validatorBlockingFreeCount === samples.length
  && reviewerProfileDifficultyMatchedCount === samples.length
  && reviewerProfileBlockingFreeCount === samples.length
  && questionPlanAdherentCount === samples.length
  && explanationVerifiedCount === samples.length
  && explanationMismatchCount === 0
  && independentOracleComparedCount === samples.length
  && independentOracleAgreementCount === samples.length
  && independentOracleFalseAcceptCount === 0
  && !independentOracleSourceIndependence.importsGenerator
  && !independentOracleSourceIndependence.importsSolver
  && new Set(fingerprints).size === samples.length
  && new Set(semanticFingerprints).size === samples.length
  && ['A', 'B', 'C', 'D'].every((id) => answerPositionCounts[id] === samples.length / 4)
  && Object.keys(scopeCounts).length === slots.length
  && Object.values(scopeCounts).every((count) => count === samplesPerScope);

const report = {
  mode: 'subject_practice_math_elementary_local_generator_benchmark',
  status: passed ? 'local_generator_shadow_benchmark_passed' : 'local_generator_shadow_benchmark_failed',
  generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
  benchmarkVersion: 'math-elementary-local-generator-benchmark-v10-production-profile-bound',
  productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  productionProfileBindingDigest: productionProfileBindings.math.bindingDigest,
  productionRunId: productionProfileBindings.math.productionRunId,
  productionCellId: productionProfileBindings.math.productionCellId,
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
  questionPlanAdherentCount,
  explanationVerifierVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION,
  explanationVerifiedCount,
  explanationMismatchCount,
  independentOracleVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION,
  independentOracleComparedCount,
  independentOracleAgreementCount,
  independentOracleFalseAcceptCount,
  independentOracleMutationCaseCount: independentOracleMutationResults.length,
  independentOracleSourceIndependence,
  uniquePromptOptionFingerprintCount: new Set(fingerprints).size,
  uniqueSemanticFingerprintIgnoringOptionPositionCount: new Set(semanticFingerprints).size,
  answerPositionCounts,
  scopeCounts,
  adherenceBySlot,
  semanticDiversityBySlot,
  comparisonBaseline: {
    source: 'math_rotation_v3_observed_three_call_batch',
    observedMeanProviderCostUsdPerCandidate: observedDeepSeekMeanCostUsd,
    projectedAvoidedProviderCostUsdForBenchmarkVolume: observedDeepSeekMeanCostUsd * samples.length,
    realizedSavings: false
  },
  releaseQualification: false,
  releaseQualificationReason: 'shadow_local_generation_requires_source_isolation_regression_and_suppressed_production_shadow_before_release_policy_decision',
  failures: failures.slice(0, 12).map((sample) => ({
    functionClass: sample.functionClass,
    propertyTarget: sample.propertyTarget,
    seed: sample.seed,
    generationStatus: sample.generated.status,
    generationReasons: sample.generated.reasonCodes,
    validatorStatus: sample.deterministicReview?.status ?? null,
    validatorErrors: sample.deterministicReview?.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code) ?? [],
    reviewerInferredDifficultyBand: sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand ?? null,
    reviewerProfileIssue: sample.deterministicProfileReview?.issue?.code ?? null,
    questionPlanAdheres: sample.adherence?.adheres ?? null,
    questionPlanFailureCodes: sample.adherence?.failureCodes ?? [],
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
