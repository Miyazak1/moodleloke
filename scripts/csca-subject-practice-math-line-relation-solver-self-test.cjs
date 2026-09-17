#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  solveSubjectPracticeMathLineRelation,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const {
  verifySubjectPracticeMathLineRelationWithIndependentOracle,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');

const optionIds = ['A', 'B', 'C', 'D'];

function plan(exactLineRelationScope) {
  return {
    schemaVersion: 'subject-practice-question-plan-v1',
    policyVersion: 'subject-practice-question-plan-policy-v1',
    subject: 'math',
    targetDifficulty: 'basic',
    taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    renderConstraints: {
      exactLineRelationScope,
      forbidFigureDependency: true,
      forbidMultiStageIntersection: true
    }
  };
}

function candidate(prompt, optionTexts, correctAnswer = 'A') {
  return {
    subject: 'math', topicId: 1, blueprintId: 1, sourceType: 'ai',
    designedDifficulty: 'basic', questionType: 'single_choice', prompt,
    options: optionTexts.map((text, index) => ({ id: optionIds[index], text })),
    correctAnswer, explanation: 'deterministic fixture', knowledgeTags: [], optionMetadata: [],
    syllabusVersion: 'fixture-v1'
  };
}

const fixtures = [
  {
    id: 'slope',
    scope: 'slope_from_two_distinct_points',
    candidate: candidate('Given points P(1,2) and Q(4,8), find the slope of line PQ.', ['2', '1/2', '-2', '3'])
  },
  {
    id: 'inclination',
    scope: 'inclination_angle_from_line',
    candidate: candidate('For line l: x-y=0, find its inclination angle.', ['45°', '0°', '90°', '135°'])
  },
  {
    id: 'parallel',
    scope: 'identify_parallel_or_perpendicular_line',
    candidate: candidate('Which line is parallel to line l: 2x-y+3=0?', ['4x-2y+1=0', '2x-y+3=0', 'x+2y=0', 'x-y=0'])
  },
  {
    id: 'point-slope',
    scope: 'line_equation_from_point_and_slope',
    candidate: candidate('Which equation is the line through P(2,3) with slope -1/2?', ['x+2y-8=0', 'x+2y-7=0', '2x+y-7=0', 'x-2y+4=0'])
  },
  {
    id: 'fractional-coefficient-parallel',
    scope: 'identify_parallel_or_perpendicular_line',
    candidate: candidate('Which line is parallel to line l: 1/2x+1/3y=2?', ['3/2x+y=1', '1/2x+1/3y=2', '1/3x-1/2y=0', 'x+y=0'])
  }
];

const fixtureResults = fixtures.map((fixture) => {
  const context = { questionPlan: plan(fixture.scope) };
  const solver = solveSubjectPracticeMathLineRelation(fixture.candidate, context);
  const oracle = verifySubjectPracticeMathLineRelationWithIndependentOracle(fixture.candidate, context);
  return {
    id: fixture.id,
    solverStatus: solver.status,
    oracleStatus: oracle.status,
    solverSelected: solver.selectedOptionId,
    oracleSelected: oracle.selectedOptionId,
    solverScopeId: solver.scopeId,
    oracleScopeId: oracle.scopeId,
    solverReasons: solver.reasonCodes,
    oracleReasons: oracle.reasonCodes,
    passed: solver.status === 'verified'
      && oracle.status === 'verified'
      && solver.selectedOptionId === 'A'
      && oracle.selectedOptionId === 'A'
      && solver.scopeId === oracle.scopeId
  };
});

function bothReject(mutatedCandidate, scope) {
  const context = { questionPlan: plan(scope) };
  return solveSubjectPracticeMathLineRelation(mutatedCandidate, context).status !== 'verified'
    && verifySubjectPracticeMathLineRelationWithIndependentOracle(mutatedCandidate, context).status !== 'verified';
}

const duplicateCorrect = structuredClone(fixtures[0].candidate);
duplicateCorrect.options[1].text = '2/1';
const wrongAnswer = structuredClone(fixtures[2].candidate);
wrongAnswer.correctAnswer = 'D';
const verticalPoints = candidate('Given points P(1,2) and Q(1,8), find the slope of line PQ.', ['0', '1', '-1', '2']);
const unsupportedAngle = candidate('For line l: 2x-y=0, find its inclination angle.', ['45°', '0°', '90°', '135°']);
const unrelatedEquationWithAngleOptions = candidate('The solution set of x-y=0 is:', ['45°', '0°', '90°', '135°']);
const unrelatedTwoPointDistance = candidate('Find the distance between P(1,2) and Q(4,8).', ['2', '1/2', '-2', '3']);
const badPlan = { questionPlan: { ...plan(fixtures[0].scope), taskFamily: 'other' } };

const mutations = {
  duplicateCorrectBlocked: bothReject(duplicateCorrect, fixtures[0].scope),
  wrongDeclaredAnswerBlocked: bothReject(wrongAnswer, fixtures[2].scope),
  verticalSlopeExcluded: bothReject(verticalPoints, fixtures[0].scope),
  approximateAngleExcluded: bothReject(unsupportedAngle, fixtures[1].scope),
  unrelatedEquationCannotMasqueradeAsInclination: bothReject(unrelatedEquationWithAngleOptions, fixtures[1].scope),
  unrelatedTwoPointTaskCannotMasqueradeAsSlope: bothReject(unrelatedTwoPointDistance, fixtures[0].scope),
  missingExactPlanContractBlocked:
    solveSubjectPracticeMathLineRelation(fixtures[0].candidate, badPlan).status === 'unparsed'
    && verifySubjectPracticeMathLineRelationWithIndependentOracle(fixtures[0].candidate, badPlan).status === 'unparsed'
};

const checks = {
  allFourScopesVerifiedIncludingFractionalCoefficients: fixtureResults.every((item) => item.passed),
  allMutationsBlocked: Object.values(mutations).every(Boolean),
  solverAndOracleAreVersioned: /-v\d+$/.test(SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION)
    && /-v\d+$/.test(SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION)
};
const report = {
  mode: 'subject_practice_math_line_relation_solver_self_test',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks, fixtureResults, mutations,
  providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only', publicationImpact: 'none'
};
if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
