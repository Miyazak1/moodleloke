#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  generateSubjectPracticeMathDerivativeLocally
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const {
  buildSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');

const blueprint = {
  id: 95001, topicId: 96001, subject: 'math', difficulty: 'basic',
  questionType: 'single_choice', syllabusVersion: 'math-derivative-mutation-v1'
};
const questionPlan = buildSubjectPracticeQuestionPlan({
  subject: 'math', targetDifficulty: 'basic', topicTitle: '导数与微积分初步',
  productionCellId: 10, taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1',
  exactDerivativeScope: 'direct_polynomial_value'
});
const verify = (candidate) => verifySubjectPracticeFormalCandidate({
  candidate, taskFamily: 'derivative_direct_evaluation', questionPlan
});
const replaceOptions = (candidate, options) => ({ ...candidate, options });

const mutationTypes = [
  'declared_answer_rotation',
  'duplicate_true_option',
  'correct_value_removed',
  'explanation_derivation_removed',
  'unsupported_expression_injected'
];
const mutationCounts = Object.fromEntries(mutationTypes.map((type) => [type, { attempted: 0, detected: 0 }]));
const failures = [];
const casesPerType = 64;

for (let seed = 0; seed < casesPerType; seed += 1) {
  const generated = generateSubjectPracticeMathDerivativeLocally({ blueprint, questionPlan, seed });
  if (generated.status !== 'generated_and_triple_verified' || !generated.candidate) {
    failures.push({ seed, stage: 'fixture_generation', reasonCodes: generated.reasonCodes });
    continue;
  }
  const candidate = generated.candidate;
  const correctIndex = candidate.options.findIndex((option) => option.id === candidate.correctAnswer);
  const wrongAnswer = candidate.options.find((option) => option.id !== candidate.correctAnswer).id;
  const duplicateIndex = correctIndex === 0 ? 1 : 0;
  const expected = BigInt(candidate.options[correctIndex].text);
  const mutations = {
    declared_answer_rotation: { ...candidate, correctAnswer: wrongAnswer },
    duplicate_true_option: replaceOptions(candidate, candidate.options.map((option, index) =>
      index === duplicateIndex ? { ...option, text: expected.toString() } : option)),
    correct_value_removed: replaceOptions(candidate, candidate.options.map((option, index) =>
      index === correctIndex ? { ...option, text: (expected + 10000n).toString() } : option)),
    explanation_derivation_removed: { ...candidate, explanation: '结论略。' },
    unsupported_expression_injected: {
      ...candidate,
      prompt: candidate.prompt.replace(/f\(x\)=.+?(?=，)/, 'f(x)=(x+1)^2')
    }
  };
  for (const [type, mutated] of Object.entries(mutations)) {
    mutationCounts[type].attempted += 1;
    const evidence = verify(mutated);
    if (evidence && evidence.status !== 'verified') mutationCounts[type].detected += 1;
    else failures.push({ seed, stage: type, status: evidence?.status ?? 'missing' });
  }
}

const attempted = Object.values(mutationCounts).reduce((sum, item) => sum + item.attempted, 0);
const detected = Object.values(mutationCounts).reduce((sum, item) => sum + item.detected, 0);
const checks = {
  everyTypeMeetsFixedDenominator: Object.values(mutationCounts).every((item) => item.attempted === casesPerType),
  everyMutationDetected: attempted === detected,
  minimumQualificationThresholdCovered: Object.values(mutationCounts).every((item) => item.detected >= 32),
  noFalseAccepts: failures.length === 0,
  providerDatabaseAndPublicationImpactNone: true
};
const report = {
  mode: 'subject_practice_math_derivative_mutation_benchmark',
  reportVersion: 'subject-practice-math-derivative-mutation-benchmark-v1',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  casesPerType,
  mutationCounts,
  attempted,
  detected,
  falseAccepts: attempted - detected,
  failures: failures.slice(0, 20),
  providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
  databaseImpact: 'none_fixture_only', publicationImpact: 'none_shadow_only'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
