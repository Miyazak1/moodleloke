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
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticePhysicsKinematicsLocally
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  subjectPracticeDeterministicProfileReviewForCandidate
} = require('../backend/src/ai-questioning/question-reviewer.service');
const {
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION,
  verifySubjectPracticePhysicsKinematicsExplanation
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-explanation-verifier');
const {
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION,
  verifySubjectPracticePhysicsKinematicsWithIndependentOracle
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-independent-oracle');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  bindings: productionProfileBindings
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const relations = [
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
];
const samplesPerScope = 128;
const blueprint = {
  id: 24,
  subject: 'physics',
  topicId: productionProfileBindings.physics.topicId,
  topicCode: 'P-MECH-001',
  topicModule: '力学',
  topicTitle: productionProfileBindings.physics.topicTitle,
  syllabusVersion: '2025',
  examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model'],
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'direct_application',
  constraints: {}
};
const validator = new QuestionValidatorService();
const samples = [];
const productionTargetProfile = productionProfileBindings.physics.targetProfile;

for (const relationKind of relations) {
  const questionPlan = buildSubjectPracticeQuestionPlan({
    subject: 'physics', topicId: productionProfileBindings.physics.topicId, topicTitle: blueprint.topicTitle,
    productionCellId: 24, targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
    exactPhysicsKinematicsScope: relationKind
  });
  for (let seed = 0; seed < samplesPerScope; seed += 1) {
    const generated = generateSubjectPracticePhysicsKinematicsLocally({ blueprint, questionPlan, seed, relationKind });
    const deterministicReview = generated.candidate ? validator.review(generated.candidate, {
      subject: 'physics', intendedUse: 'subject_practice', topicId: productionProfileBindings.physics.topicId,
      topicTitle: blueprint.topicTitle, syllabusVersion: '2025', questionPlan
    }) : null;
    const deterministicProfileReview = generated.candidate
      ? subjectPracticeDeterministicProfileReviewForCandidate(generated.candidate, {
        subject: 'physics', intendedUse: 'subject_practice', topicId: 78,
        topicTitle: '运动学', examScope: blueprint.examScope, syllabusVersion: '2025', topicStatus: 'published',
        styleProfile: { id: 674, confidence: 'high', profile: {} },
        targetProfile: productionTargetProfile,
        questionPlan
      })
      : null;
    const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(questionPlan, generated.candidate) : null;
    const explanationVerification = generated.candidate
      ? verifySubjectPracticePhysicsKinematicsExplanation(generated.candidate, { questionPlan })
      : null;
    const independentOracle = generated.candidate
      ? verifySubjectPracticePhysicsKinematicsWithIndependentOracle(generated.candidate, { questionPlan })
      : null;
    samples.push({ relationKind, seed, questionPlan, generated, deterministicReview, deterministicProfileReview, adherence, explanationVerification, independentOracle });
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
const reviewerProfileBasicCount = samples.filter((sample) => sample.deterministicProfileReview
  ?.profileAlignment?.evidence?.inferredDifficultyBand === 'basic').length;
const reviewerProfileDifficultyMatchedCount = reviewerProfileBasicCount;
const reviewerProfileBlockingFreeCount = samples.filter((sample) => sample.deterministicProfileReview
  && sample.deterministicProfileReview.issue === null).length;
const questionPlanAdherentCount = samples.filter((sample) => sample.adherence?.adheres === true).length;
const explanationVerifiedCount = samples.filter((sample) => sample.explanationVerification?.status === 'verified').length;
const explanationMismatchCount = samples.reduce((sum, sample) => sum + (sample.explanationVerification?.mismatchCount ?? 1), 0);
const independentOracleComparedCount = samples.filter((sample) => sample.generated.candidate && sample.independentOracle).length;
const independentOracleAgreementCount = samples.filter((sample) => sample.independentOracle?.status === 'verified'
  && sample.independentOracle.selectedOptionId === sample.generated.verification?.selectedOptionId
  && sample.independentOracle.scopeId === sample.generated.scopeId).length;
const oracleSource = fs.readFileSync(path.resolve(__dirname, '../backend/src/ai-questioning/subject-practice-physics-kinematics-independent-oracle.ts'), 'utf8');
const oracleSourceIndependence = {
  importsGenerator: /from ['"].*physics-kinematics-local-generator['"]/.test(oracleSource),
  importsSolver: /from ['"].*physics-kinematics-solver['"]/.test(oracleSource)
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
  const missingUnit = clone(candidate);
  missingUnit.options.find((option) => option.id === missingUnit.correctAnswer).text = missingUnit.options
    .find((option) => option.id === missingUnit.correctAnswer).text.replace(/\s+m(?:\/s(?:\^2)?)?$/i, '');
  const unsupportedPrompt = clone(candidate);
  unsupportedPrompt.prompt = 'A v-t graph is supplied. Determine the shaded area under the curve.';
  return [
    ['generator_answer_flip', answerFlip],
    ['second_true_option', duplicateTrue],
    ['missing_answer_unit', missingUnit],
    ['unsupported_relation_form', unsupportedPrompt]
  ].map(([type, mutated]) => ({
    type,
    evidence: verifySubjectPracticePhysicsKinematicsWithIndependentOracle(mutated, { questionPlan: sample.questionPlan })
  }));
});
const independentOracleFalseAcceptCount = independentOracleMutationResults
  .filter((item) => item.evidence.status === 'verified').length;
const answerPositionCounts = samples.reduce((counts, sample) => {
  const answer = sample.generated.candidate?.correctAnswer ?? 'missing';
  counts[answer] = (counts[answer] ?? 0) + 1;
  return counts;
}, {});
const scopeCounts = samples.reduce((counts, sample) => {
  const scopeId = sample.generated.scopeId ?? 'missing';
  counts[scopeId] = (counts[scopeId] ?? 0) + 1;
  return counts;
}, {});
const semanticDiversityByRelation = relations.map((relationKind) => {
  const relationSamples = samples.filter((sample) => sample.relationKind === relationKind);
  return {
    relationKind,
    total: relationSamples.length,
    uniqueIgnoringOptionPosition: new Set(relationSamples.map((sample) => fingerprint(sample.generated.candidate, true))).size
  };
});
const failures = samples.filter((sample) => sample.generated.status !== 'generated_and_self_verified'
  || !sample.deterministicReview
  || sample.deterministicReview.issues.some((issue) => issue.severity === 'error')
  || sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand !== 'basic'
  || sample.deterministicProfileReview?.issue !== null
  || sample.adherence?.adheres !== true
  || sample.explanationVerification?.status !== 'verified'
  || sample.independentOracle?.status !== 'verified');
const scopeInputMismatch = generateSubjectPracticePhysicsKinematicsLocally({
  blueprint,
  questionPlan: samples[0].questionPlan,
  seed: 0,
  relationKind: 'acceleration_from_velocity_change'
});
const scopeInputMismatchRejected = scopeInputMismatch.status === 'unsupported_question_plan'
  && scopeInputMismatch.candidate === null;
const passed = selfVerifiedCount === samples.length
  && validatorBlockingFreeCount === samples.length
  && reviewerProfileBasicCount === samples.length
  && reviewerProfileBlockingFreeCount === samples.length
  && questionPlanAdherentCount === samples.length
  && explanationVerifiedCount === samples.length
  && explanationMismatchCount === 0
  && independentOracleComparedCount === samples.length
  && independentOracleAgreementCount === samples.length
  && independentOracleFalseAcceptCount === 0
  && scopeInputMismatchRejected
  && !oracleSourceIndependence.importsGenerator
  && !oracleSourceIndependence.importsSolver
  && new Set(exactFingerprints).size === samples.length
  && new Set(semanticFingerprints).size === samples.length
  && ['A', 'B', 'C', 'D'].every((id) => answerPositionCounts[id] === samples.length / 4)
  && Object.keys(scopeCounts).length === relations.length
  && Object.values(scopeCounts).every((count) => count === samplesPerScope);

const report = {
  mode: 'subject_practice_physics_kinematics_local_generator_benchmark',
  status: passed ? 'local_generator_shadow_benchmark_passed' : 'local_generator_shadow_benchmark_failed',
  generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
  benchmarkVersion: 'physics-kinematics-local-generator-benchmark-v6-production-profile-bound',
  productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  productionProfileBindingDigest: productionProfileBindings.physics.bindingDigest,
  productionRunId: productionProfileBindings.physics.productionRunId,
  productionCellId: productionProfileBindings.physics.productionCellId,
  productionImpact: 'none_fixture_only_shadow',
  providerImpact: 'none_no_provider_call',
  providerCallCount: 0,
  estimatedCostUsd: 0,
  publicationImpact: 'none',
  samplesPerScope,
  sampleCount: samples.length,
  selfVerifiedCount,
  deterministicValidatorBlockingFreeCount: validatorBlockingFreeCount,
  reviewerProfileBasicCount,
  reviewerProfileDifficultyMatchedCount,
  reviewerProfileBlockingFreeCount,
  questionPlanAdherentCount,
  explanationVerifierVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION,
  explanationVerifiedCount,
  explanationMismatchCount,
  independentOracleVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION,
  independentOracleComparedCount,
  independentOracleAgreementCount,
  independentOracleFalseAcceptCount,
  independentOracleMutationCaseCount: independentOracleMutationResults.length,
  independentOracleSourceIndependence: oracleSourceIndependence,
  scopeInputMismatchRejected,
  scopeInputMismatchReasonCodes: scopeInputMismatch.reasonCodes,
  uniquePromptOptionFingerprintCount: new Set(exactFingerprints).size,
  uniqueSemanticFingerprintIgnoringOptionPositionCount: new Set(semanticFingerprints).size,
  answerPositionCounts,
  scopeCounts,
  semanticDiversityByRelation,
  releaseQualification: false,
  releaseQualificationReason: 'shadow_local_generation_requires_source_isolation_regression_and_suppressed_production_shadow_before_release_policy_decision',
  failures: failures.slice(0, 20).map((sample) => ({
    relationKind: sample.relationKind,
    seed: sample.seed,
    generationStatus: sample.generated.status,
    generationReasons: sample.generated.reasonCodes,
    validatorErrors: sample.deterministicReview?.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code) ?? [],
    reviewerProfileDifficulty: sample.deterministicProfileReview?.profileAlignment?.evidence?.inferredDifficultyBand ?? null,
    reviewerProfileReasons: sample.deterministicProfileReview?.profileAlignment?.reasons ?? [],
    reviewerProfileIssueCode: sample.deterministicProfileReview?.issue?.code ?? null,
    questionPlanAdheres: sample.adherence?.adheres ?? null,
    questionPlanFailureCodes: sample.adherence?.failureCodes ?? [],
    explanationStatus: sample.explanationVerification?.status ?? null,
    explanationFailureCodes: sample.explanationVerification?.reasonCodes ?? [],
    independentOracleStatus: sample.independentOracle?.status ?? null,
    independentOracleFailureCodes: sample.independentOracle?.reasonCodes ?? []
  }))
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

module.exports = { report };
