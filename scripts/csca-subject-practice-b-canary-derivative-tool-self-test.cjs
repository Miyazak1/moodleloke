#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_TOOL_VERIFIER_VERSION,
  verifySubjectPracticeMathDerivativeToolCandidate
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-tool-verifier');

const questionPlan = {
  subject: 'math', productionCellId: 10, targetDifficulty: 'basic',
  taskFamily: 'derivative_direct_evaluation', planTemplate: 'math_derivative_condition_chain_v1'
};
const candidate = {
  subject: 'math', topicId: 71, blueprintId: 10, sourceType: 'ai', designedDifficulty: 'basic',
  questionType: 'single_choice', prompt: "已知函数 f(x)=3x^3-2x^2+x-5，求 f'(2) 的值。",
  options: [
    { id: 'A', text: '29' }, { id: 'B', text: '25' }, { id: 'C', text: '21' }, { id: 'D', text: '17' }
  ],
  correctAnswer: 'A', explanation: "f'(x)=9x^2-4x+1，所以 f'(2)=29，选 A。",
  knowledgeTags: ['derivative'], optionMetadata: [], syllabusVersion: '2025'
};

function verify(value, overrides = {}) {
  return verifySubjectPracticeMathDerivativeToolCandidate({
    candidate: value, taskFamily: 'derivative_direct_evaluation', questionPlan, ...overrides
  });
}

const verified = verify(candidate);
const wrongDeclaredAnswer = verify({ ...candidate, correctAnswer: 'B' });
const duplicateCorrectOption = verify({
  ...candidate,
  options: candidate.options.map((option) => option.id === 'D' ? { ...option, text: '29' } : option)
});
const fractional = verify({
  ...candidate,
  prompt: "已知函数 f(x)=1/2x^2-3x+4，求 f'(1/2) 的值。",
  options: [{ id: 'A', text: '-5/2' }, { id: 'B', text: '-2' }, { id: 'C', text: '5/2' }, { id: 'D', text: '3' }],
  correctAnswer: 'A'
});
const unicodeSuperscript = verify({ ...candidate, prompt: "已知函数 f(x)=3x³-2x²+x-5，求 f'(2) 的值。" });
const unsupportedChainRule = verify({ ...candidate, prompt: "已知函数 f(x)=(x^2+1)^3，求 f'(2) 的值。" });
const wrongFamily = verify(candidate, { taskFamily: 'derivative_tangent_constraint' });
const checks = {
  directPolynomialValueVerified: verified.status === 'verified'
    && verified.expectedValue === '29' && verified.selectedOptionId === 'A',
  declaredAnswerMutationDetected: wrongDeclaredAnswer.status === 'conflict'
    && wrongDeclaredAnswer.reasonCodes.includes('derivative_tool_declared_answer_disagrees'),
  duplicateTrueOptionDetected: duplicateCorrectOption.status === 'conflict'
    && duplicateCorrectOption.reasonCodes.includes('derivative_tool_answer_not_unique'),
  fractionalCoefficientAndPointAreExact: fractional.status === 'verified'
    && fractional.expectedValue === '-5/2',
  unicodeSuperscriptsAreNormalizedBeforeParsing: unicodeSuperscript.status === 'verified'
    && unicodeSuperscript.expectedValue === '29',
  unsupportedChainRuleAbstains: unsupportedChainRule.status === 'unparsed'
    && unsupportedChainRule.reasonCodes.includes('derivative_tool_expression_outside_supported_polynomial_grammar'),
  unregisteredFamilyAbstains: wrongFamily.status === 'unparsed'
    && wrongFamily.reasonCodes.includes('derivative_tool_scope_not_registered'),
  toolCannotAuthorizePublication: [verified, wrongDeclaredAnswer, duplicateCorrectOption, fractional, unicodeSuperscript, unsupportedChainRule, wrongFamily]
    .every((result) => result.automaticPublicationEligible === false),
  visibleInputOnlyAndNoProvider: verified.inputBoundary === 'visible_prompt_and_options_only'
    && verified.generatorExplanationTrusted === false && verified.providerImpact === 'none_no_provider_call'
};

const report = {
  mode: 'subject_practice_b_canary_derivative_tool_self_test',
  reportVersion: 'subject-practice-b-canary-derivative-tool-self-test-v1',
  verifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_TOOL_VERIFIER_VERSION,
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  target: {
    subject: 'math', productionRunId: 1, productionCellId: 10,
    taskFamily: 'derivative_direct_evaluation', planTemplate: 'math_derivative_condition_chain_v1'
  },
  routeClass: 'isolated_comparative_research_not_a_production_route',
  retainedProductionAsset: 'deterministic_visible_candidate_tool_verifier_only',
  fullQuestionAgentProductionEligible: false,
  providerCallCount: 0,
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none_isolated_research_evidence_only'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
