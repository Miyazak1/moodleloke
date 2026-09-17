#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
  solveElementaryFunctionDirectProperty
} = require('../backend/src/ai-questioning/subject-practice-math-solver');

function intervalBoundary(boundary, closed) {
  return `${closed ? '[' : '('}${boundary},+∞)`;
}

function functionArgument(boundary) {
  if (boundary === 0) return 'x';
  return boundary > 0 ? `x-${boundary}` : `x+${Math.abs(boundary)}`;
}

function candidate(prompt, options, correctAnswer = 'A') {
  return {
    subject: 'math',
    prompt,
    options: options.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
    correctAnswer
  };
}

function verificationQuestionPlan(functionClass, propertyTarget) {
  return {
    schemaVersion: 'subject-practice-question-plan-v1',
    policyVersion: 'subject-practice-question-plan-policy-v1',
    subject: 'math',
    targetDifficulty: 'basic',
    taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1',
    renderConstraints: {
      singlePropertyTargetContractVersion: 'math-basic-elementary-single-property-target-v1',
      requiredElementaryFunctionClass: functionClass,
      requiredSinglePropertyTarget: propertyTarget
    }
  };
}

function questionPlanForFixtureId(id) {
  if (id.startsWith('log-domain-')) return verificationQuestionPlan('logarithmic', 'domain');
  if (id.startsWith('exponential-range-')) return verificationQuestionPlan('exponential', 'range');
  if (id.startsWith('radical-monotonicity-')) return verificationQuestionPlan('radical', 'monotonicity');
  if (id.startsWith('power-value-')) return verificationQuestionPlan('power', 'function_value');
  return null;
}

const gold = [];
for (const base of [0.5, 2, 3]) {
  for (const boundary of [-3, -1, 0, 2, 4]) {
    const argument = functionArgument(boundary);
    gold.push({
      id: `log-domain-${base}-${boundary}`,
      candidate: candidate(
        `已知函数 f(x)=log_${base}(${argument})，请选择正确的定义域。`,
        [intervalBoundary(boundary, false), intervalBoundary(boundary, true), `(-∞,${boundary})`, 'R']
      )
    });
  }
}
for (const boundary of [-4, -1, 0, 2, 5]) {
  const argument = functionArgument(boundary);
  gold.push({
    id: `radical-domain-${boundary}`,
    candidate: candidate(
      `已知函数 f(x)=√(${argument})，请选择正确的定义域。`,
      [intervalBoundary(boundary, true), intervalBoundary(boundary, false), `(-∞,${boundary}]`, 'R']
    )
  });
}
for (const coefficient of [2, 3]) {
  for (const boundary of [-2, 0, 3]) {
    const offset = -coefficient * boundary;
    const expression = `${coefficient}x${offset > 0 ? `+${offset}` : offset < 0 ? offset : ''}`;
    gold.push({
      id: `scaled-radical-domain-${coefficient}-${boundary}`,
      candidate: candidate(
        `已知函数 f(x)=√(${expression})，请选择正确的定义域。`,
        [intervalBoundary(boundary, true), intervalBoundary(boundary, false), `(-∞,${boundary}]`, 'R']
      )
    });
  }
}
for (const coefficient of [2, 3, -2, -3]) {
  for (const boundary of [-2, 0, 3]) {
    const offset = -coefficient * boundary;
    const expression = `${coefficient}x${offset > 0 ? `+${offset}` : offset < 0 ? offset : ''}`;
    const increasing = coefficient > 0;
    gold.push({
      id: `radical-monotonicity-${coefficient}-${boundary}`,
      candidate: candidate(
        `已知函数 f(x)=√(${expression})，判断它在给定区间上的单调性。`,
        increasing
          ? [
            '在定义域内单调递增',
            '在定义域内单调递减',
            '在 R 上单调递增',
            `在 (-∞,${boundary}] 上单调递增`
          ]
          : [
            '在定义域内单调递减',
            '在定义域内单调递增',
            '在 R 上单调递减',
            `在 [${boundary},+∞) 上单调递减`
          ]
      )
    });
  }
}
for (const base of [0.25, 0.5, 2, 3, 10]) {
  gold.push({
    id: `exponential-range-${base}`,
    candidate: candidate(
      `已知指数函数 f(x)=${base}^x，请选择正确的值域。`,
      ['值域为 (0,+∞)', '值域为 [0,+∞)', '值域为 R', '值域为 (1,+∞)']
    )
  });
}
for (const exponent of [1, 2, 3, 4]) {
  for (const input of [-2, -1, 2, 3]) {
    const answer = input ** exponent;
    gold.push({
      id: `power-value-${exponent}-${input}`,
      candidate: candidate(
        `已知函数 f(x)=x^${exponent}，求 f(${input}) 的值。`,
        [`f(${input})=${answer}`, `f(${input})=${answer + 1}`, `f(${input})=${answer - 1}`, `f(${input})=${-answer || 2}`]
      )
    });
  }
}

const mutations = gold.flatMap((fixture) => {
  const answerFlip = structuredClone(fixture.candidate);
  answerFlip.correctAnswer = 'B';
  const secondTrue = structuredClone(fixture.candidate);
  secondTrue.options[1].text = secondTrue.options[0].text;
  const unsupported = structuredClone(fixture.candidate);
  unsupported.prompt = '已知分段函数或三角函数 f(x)，请选择正确结论。';
  const crossPropertyTrue = structuredClone(fixture.candidate);
  crossPropertyTrue.options[1].text = fixture.id.startsWith('log-domain-')
    ? '值域为 R'
    : fixture.id.startsWith('exponential-range-')
      ? '定义域为 R'
      : fixture.id.startsWith('power-value-')
        ? '定义域为 R'
        : '值域为 [0,+∞)';
  return [
    { id: `${fixture.id}:answer-flip`, mutation: 'generator_answer_flip', candidate: answerFlip },
    { id: `${fixture.id}:second-true`, mutation: 'second_true_option', candidate: secondTrue },
    { id: `${fixture.id}:unsupported`, mutation: 'unsupported_function_form', candidate: unsupported },
    { id: `${fixture.id}:cross-property-true`, mutation: 'cross_property_true_option', candidate: crossPropertyTrue }
  ];
});

const goldResults = gold.map((fixture) => ({
  ...fixture,
  evidence: solveElementaryFunctionDirectProperty(fixture.candidate, { questionPlan: questionPlanForFixtureId(fixture.id) })
}));
const mutationResults = mutations.map((fixture) => ({
  ...fixture,
  evidence: solveElementaryFunctionDirectProperty(fixture.candidate, { questionPlan: questionPlanForFixtureId(fixture.id) })
}));
const goldVerified = goldResults.filter((item) => item.evidence.status === 'verified').length;
const scopedGoldResults = goldResults.filter((item) => questionPlanForFixtureId(item.id));
const scopedGoldMatched = scopedGoldResults.filter((item) => item.evidence.verificationScope.status === 'matched').length;
const mutationFalseAccepts = mutationResults.filter((item) => item.evidence.status === 'verified').length;
const scopedMutationFalseAccepts = mutationResults.filter((item) => item.evidence.status === 'verified' && item.evidence.verificationScope.status === 'matched').length;
const mutationDetected = mutationResults.length - mutationFalseAccepts;
const passed = goldVerified === goldResults.length
  && scopedGoldMatched === scopedGoldResults.length
  && mutationFalseAccepts === 0
  && scopedMutationFalseAccepts === 0;

const report = {
  mode: 'subject_practice_math_elementary_solver_programmatic_mutation_benchmark',
  status: passed ? 'solver_subset_benchmark_passed_not_family_release_qualified' : 'solver_subset_benchmark_failed',
  solverVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
  benchmarkVersion: 'math-elementary-direct-property-programmatic-mutation-v3',
  scope: 'restricted_log_domain_linear_radical_domain_and_monotonicity_exponential_range_and_positive_integer_power_value',
  releaseQualification: false,
  releaseQualificationReason: 'subset_coverage_only_no_frozen_official_holdout_and_no_family_total_grammar',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only',
  goldCaseCount: goldResults.length,
  goldVerifiedCount: goldVerified,
  goldVerificationRate: goldResults.length ? goldVerified / goldResults.length : null,
  scopedRotationGoldCaseCount: scopedGoldResults.length,
  scopedRotationGoldMatchedCount: scopedGoldMatched,
  scopedRotationGoldMatchRate: scopedGoldResults.length ? scopedGoldMatched / scopedGoldResults.length : null,
  mutationCaseCount: mutationResults.length,
  mutationDetectedCount: mutationDetected,
  mutationFalseAcceptCount: mutationFalseAccepts,
  scopedRotationMutationFalseAcceptCount: scopedMutationFalseAccepts,
  mutationDetectionRate: mutationResults.length ? mutationDetected / mutationResults.length : null,
  mutationTypeCounts: mutations.reduce((counts, item) => {
    counts[item.mutation] = (counts[item.mutation] || 0) + 1;
    return counts;
  }, {}),
  failures: [
    ...goldResults.filter((item) => item.evidence.status !== 'verified').map((item) => ({ id: item.id, expected: 'verified', actual: item.evidence.status, evidence: item.evidence })),
    ...scopedGoldResults.filter((item) => item.evidence.verificationScope.status !== 'matched').map((item) => ({ id: item.id, expected: 'verification_scope_matched', actual: item.evidence.verificationScope.status, evidence: item.evidence })),
    ...mutationResults.filter((item) => item.evidence.status === 'verified').map((item) => ({ id: item.id, expected: 'conflict_or_unparsed', actual: item.evidence.status, evidence: item.evidence }))
  ].slice(0, 20)
};

if (require.main === module) {
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

module.exports = { report };
