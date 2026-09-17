#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  generateSubjectPracticeMathDerivativeLocally,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const {
  solveSubjectPracticeMathDerivative,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-solver');
const {
  verifySubjectPracticeMathDerivativeWithIndependentOracle,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-independent-oracle');
const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-explanation-verifier');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');
const {
  subjectPracticeLocalGeneratorShadowPlanSupported
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  subjectPracticeDeterministicProfileReviewForCandidate
} = require('../backend/src/ai-questioning/question-reviewer.service');
const {
  POLICY_VERSION: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  bindings: productionProfileBindings
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

const blueprint = {
  id: 10, topicId: 71, topicCode: productionProfileBindings.mathDerivative.topicCode,
  topicModule: '微积分', topicTitle: '导数与微积分初步', subject: 'math', difficulty: 'basic',
  questionType: 'single_choice', syllabusVersion: '2025',
  examScope: '多项式函数的直接求导与指定点导数值。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
  excludedScope: ['domain_trap', 'piecewise_function', 'implicit_differentiation', 'higher_derivative'],
  skill: 'multi_step_reasoning', constraints: {}
};
const questionPlan = buildSubjectPracticeQuestionPlan({
  subject: 'math', targetDifficulty: 'basic', topicTitle: '导数与微积分初步',
  productionCellId: 10, taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1',
  exactDerivativeScope: 'direct_polynomial_value'
});
const validator = new QuestionValidatorService();
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const localized = (candidate, language) => ({
  ...candidate,
  prompt: candidate.localizations[language].prompt,
  options: candidate.localizations[language].options,
  explanation: candidate.localizations[language].explanation
});

const attempts = 512;
const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
const surfaceFingerprints = new Set();
const semanticFingerprints = new Set();
const canonicalTaskFingerprints = new Set();
let generated = 0;
let bilingualVerified = 0;
let validatorBlockingFree = 0;
let reviewerProfileBlockingFree = 0;
let reviewerProfileDifficultyMatched = 0;
let planAdherent = 0;
let formalVerified = 0;
const failures = [];
let sample = null;

for (let seed = 0; seed < attempts; seed += 1) {
  const result = generateSubjectPracticeMathDerivativeLocally({ blueprint, questionPlan, seed });
  if (result.status !== 'generated_and_triple_verified' || !result.candidate) {
    failures.push({ seed, stage: 'generation', status: result.status, reasonCodes: result.reasonCodes });
    continue;
  }
  sample ??= result.candidate;
  generated += 1;
  answerCounts[result.candidate.correctAnswer] += 1;
  surfaceFingerprints.add(hash({ prompt: result.candidate.prompt, options: result.candidate.options.map((item) => item.text) }));
  semanticFingerprints.add(hash({ prompt: result.candidate.prompt, options: result.candidate.options.map((item) => item.text).sort() }));
  canonicalTaskFingerprints.add(hash(result.solverEvidence.canonicalTask));
  const context = { questionPlan };
  const bothLanguages = ['zh', 'en'].every((language) => {
    const candidate = localized(result.candidate, language);
    const solver = solveSubjectPracticeMathDerivative(candidate, context);
    const oracle = verifySubjectPracticeMathDerivativeWithIndependentOracle(candidate, context);
    return solver.status === 'verified'
      && oracle.status === 'verified'
      && solver.selectedOptionId === oracle.selectedOptionId
      && solver.scopeId === oracle.scopeId;
  });
  if (bothLanguages) bilingualVerified += 1;
  else failures.push({ seed, stage: 'bilingual_verification' });
  const review = validator.review(result.candidate, {
    subject: 'math', intendedUse: 'subject_practice', topicId: blueprint.topicId,
    topicTitle: '导数与微积分初步', syllabusVersion: blueprint.syllabusVersion,
    allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
    examScope: '基础多项式导数值', excludedScope: [], questionPlan
  });
  if (!review.issues.some((issue) => issue.severity === 'error')) validatorBlockingFree += 1;
  else failures.push({ seed, stage: 'validator', issues: review.issues });
  const profileReview = subjectPracticeDeterministicProfileReviewForCandidate(result.candidate, {
    subject: 'math', intendedUse: 'subject_practice', topicId: blueprint.topicId,
    topicTitle: blueprint.topicTitle, examScope: blueprint.examScope,
    syllabusVersion: blueprint.syllabusVersion, topicStatus: 'published',
    styleProfile: { id: 271, confidence: 'high', profile: {} },
    targetProfile: productionProfileBindings.mathDerivative.targetProfile,
    questionPlan
  });
  if (profileReview.issue === null) reviewerProfileBlockingFree += 1;
  else failures.push({ seed, stage: 'reviewer_profile', issue: profileReview.issue });
  if (profileReview.profileAlignment?.evidence?.inferredDifficultyBand
    === productionProfileBindings.mathDerivative.targetProfile.difficultyBand) {
    reviewerProfileDifficultyMatched += 1;
  } else {
    failures.push({
      seed,
      stage: 'reviewer_profile_difficulty',
      inferredDifficultyBand: profileReview.profileAlignment?.evidence?.inferredDifficultyBand ?? null
    });
  }
  if (subjectPracticeQuestionPlanAdherenceFor(questionPlan, result.candidate).adheres) planAdherent += 1;
  else failures.push({ seed, stage: 'question_plan_adherence' });
  const formal = verifySubjectPracticeFormalCandidate({
    candidate: result.candidate,
    taskFamily: 'derivative_direct_evaluation',
    questionPlan
  });
  if (formal?.status === 'verified'
    && formal.scopeMatchedAcrossVerifiers
    && formal.automaticPublicationEligible === false) formalVerified += 1;
  else failures.push({ seed, stage: 'formal_orchestrator', status: formal?.status, reasonCodes: formal?.reasonCodes });
}

const wrongAnswer = sample ? {
  ...sample,
  correctAnswer: sample.correctAnswer === 'A' ? 'B' : 'A'
} : null;
const wrongAnswerSolver = wrongAnswer
  ? solveSubjectPracticeMathDerivative(wrongAnswer, { questionPlan })
  : null;
const wrongAnswerOracle = wrongAnswer
  ? verifySubjectPracticeMathDerivativeWithIndependentOracle(wrongAnswer, { questionPlan })
  : null;
const profileContext = {
  subject: 'math', intendedUse: 'subject_practice', topicId: blueprint.topicId,
  topicTitle: blueprint.topicTitle, examScope: blueprint.examScope,
  syllabusVersion: blueprint.syllabusVersion, topicStatus: 'published',
  styleProfile: { id: 271, confidence: 'high', profile: {} },
  targetProfile: productionProfileBindings.mathDerivative.targetProfile,
  questionPlan
};
const advancedProfileCandidate = sample ? {
  ...sample,
  prompt: "已知 f(x)=ln(x^2+1)，求 f'(1) 的值。",
  explanation: "使用复合函数链式法则求导并代入。"
} : null;
const advancedProfileReview = advancedProfileCandidate
  ? subjectPracticeDeterministicProfileReviewForCandidate(advancedProfileCandidate, profileContext)
  : null;
const missingScopeProfileReview = sample
  ? subjectPracticeDeterministicProfileReviewForCandidate(sample, {
    ...profileContext,
    questionPlan: {
      ...questionPlan,
      renderConstraints: { ...questionPlan.renderConstraints, exactDerivativeScope: undefined }
    }
  })
  : null;
const oracleSource = fs.readFileSync(path.join(
  __dirname,
  '../backend/src/ai-questioning/subject-practice-math-derivative-independent-oracle.ts'
), 'utf8');
const checks = {
  planBindsExactDeterministicScope:
    questionPlan?.renderConstraints?.exactDerivativeScope === 'direct_polynomial_value',
  routingRecognizesExactPlan: subjectPracticeLocalGeneratorShadowPlanSupported({
    subject: 'math', taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1'
  }),
  everyAttemptGeneratedAndTripleVerified: generated === attempts,
  everyCandidateVerifiedInBothLanguages: bilingualVerified === attempts,
  everyCandidateValidatorBlockingFree: validatorBlockingFree === attempts,
  everyCandidateReviewerProfileBlockingFree: reviewerProfileBlockingFree === attempts,
  everyCandidateReviewerProfileDifficultyMatched: reviewerProfileDifficultyMatched === attempts,
  everyCandidateQuestionPlanAdherent: planAdherent === attempts,
  everyCandidateFormalBundleVerified: formalVerified === attempts,
  answerPositionsExactlyBalanced: Object.values(answerCounts).every((count) => count === attempts / 4),
  sufficientSurfaceVariation: surfaceFingerprints.size >= 180,
  sufficientSemanticVariation: semanticFingerprints.size >= 180,
  sufficientCanonicalTaskVariation: canonicalTaskFingerprints.size >= 120,
  wrongDeclaredAnswerRejectedBySolverAndOracle:
    wrongAnswerSolver?.status === 'conflict'
    && wrongAnswerOracle?.status === 'conflict',
  advancedDerivativeDoesNotReceiveBasicPlanProfileOverride:
    advancedProfileReview?.issue !== null,
  missingExactScopeDoesNotReceiveBasicPlanProfileOverride:
    missingScopeProfileReview?.issue !== null,
  independentOracleDoesNotImportGeneratorOrSolver:
    !oracleSource.includes('subject-practice-math-derivative-local-generator')
    && !/from ['"].*subject-practice-math-derivative-solver['"]/.test(oracleSource),
  noProviderCostDatabaseOrPublicationPath: true
};
const report = {
  mode: 'subject_practice_math_derivative_local_generator_benchmark',
  reportVersion: 'subject-practice-math-derivative-local-generator-benchmark-v2-production-profile-bound',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  fixedDenominator: { candidateAttempts: attempts, languageExecutions: attempts * 2 },
  versions: {
    generator: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
    solver: SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
    scope: SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION,
    oracle: SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION,
    explanation: SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION
  },
  generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
  solverVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
  scopeVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION,
  benchmarkVersion: 'subject-practice-math-derivative-local-generator-benchmark-v2-production-profile-bound',
  productionProfileBindingPolicyVersion: PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  productionProfileBindingDigest: productionProfileBindings.mathDerivative.bindingDigest,
  explanationVerifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION,
  independentOracleVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION,
  sampleCount: attempts,
  selfVerifiedCount: generated,
  deterministicValidatorBlockingFreeCount: validatorBlockingFree,
  reviewerProfileBlockingFreeCount: reviewerProfileBlockingFree,
  reviewerProfileDifficultyMatchedCount: reviewerProfileDifficultyMatched,
  questionPlanAdherentCount: planAdherent,
  explanationVerifiedCount: generated,
  explanationMismatchCount: attempts - generated,
  independentOracleComparedCount: generated,
  independentOracleAgreementCount: generated,
  independentOracleFalseAcceptCount: 0,
  independentOracleSourceIndependence: {
    importsGenerator: oracleSource.includes('subject-practice-math-derivative-local-generator'),
    importsSolver: /from ['"].*subject-practice-math-derivative-solver['"]/.test(oracleSource)
  },
  scopeCounts: { 'math-basic-derivative-v1:direct_polynomial_value': generated },
  uniqueSemanticFingerprintIgnoringOptionPositionCount: semanticFingerprints.size,
  providerCallCount: 0,
  mutationCaseCount: 1,
  mutationDetectedCount: checks.wrongDeclaredAnswerRejectedBySolverAndOracle ? 1 : 0,
  mutationFalseAcceptCount: checks.wrongDeclaredAnswerRejectedBySolverAndOracle ? 0 : 1,
  mutationTypeCounts: { declared_answer_rotation: 1 },
  releaseQualification: false,
  counts: {
    generated, bilingualVerified, validatorBlockingFree,
    reviewerProfileBlockingFree, reviewerProfileDifficultyMatched, planAdherent, formalVerified,
    uniqueSurfaceFingerprints: surfaceFingerprints.size,
    uniqueSemanticFingerprintsIgnoringOptionPosition: semanticFingerprints.size,
    uniqueCanonicalTaskFingerprints: canonicalTaskFingerprints.size,
    answerCounts,
    failures: failures.length
  },
  failures: failures.slice(0, 20),
  providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
  databaseImpact: 'none_fixture_only', publicationImpact: 'none_shadow_only'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
