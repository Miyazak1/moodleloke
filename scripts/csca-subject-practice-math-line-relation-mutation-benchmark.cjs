#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
  generateSubjectPracticeMathLineRelationLocally
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-local-generator');
const {
  solveSubjectPracticeMathLineRelation
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const {
  verifySubjectPracticeMathLineRelationWithIndependentOracle
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');
const {
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');
const {
  buildSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const scopes = [
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
];
const blueprint = {
  id: 91002, topicId: 92001, subject: 'math', difficulty: 'basic',
  questionType: 'single_choice', syllabusVersion: 'line-relation-shadow-v1'
};
const plan = (exactLineRelationScope) => buildSubjectPracticeQuestionPlan({
  subject: 'math', targetDifficulty: 'basic', topicTitle: 'line relation',
  productionCellId: 'line-relation-shadow-v1', taskFamily: 'math_line_relation_direct',
  planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope
});
const clone = (value) => structuredClone(value);

function formalStatus(candidate, questionPlan) {
  return verifySubjectPracticeFormalCandidate({
    candidate,
    taskFamily: 'math_line_relation_direct',
    questionPlan
  })?.status ?? 'unparsed';
}

function deterministicStatuses(candidate, questionPlan) {
  return {
    solver: solveSubjectPracticeMathLineRelation(candidate, { questionPlan }).status,
    oracle: verifySubjectPracticeMathLineRelationWithIndependentOracle(candidate, { questionPlan }).status,
    formal: formalStatus(candidate, questionPlan)
  };
}

function optionIndexByIntent(candidate, pattern) {
  const metadata = candidate.optionMetadata.find((item) => pattern.test(String(item.distractorIntent ?? '')));
  return metadata ? candidate.options.findIndex((option) => option.id === metadata.optionId) : -1;
}

function lineText(a, b, c) {
  const term = (coefficient, variable, first) => {
    if (!coefficient) return '';
    const sign = coefficient < 0 ? '-' : first ? '' : '+';
    const magnitude = Math.abs(coefficient);
    return `${sign}${magnitude === 1 && variable ? '' : magnitude}${variable}`;
  };
  let body = term(a, 'x', true);
  body += term(b, 'y', body.length === 0);
  body += term(c, '', body.length === 0);
  return `${body}=0`;
}

function fileSha256(path) {
  return createHash('sha256').update(readFileSync(resolve(path))).digest('hex');
}

const mutationCounts = {
  declared_answer_rotation: { attempted: 0, blocked: 0 },
  extra_semantically_correct_option: { attempted: 0, blocked: 0 },
  correct_semantics_removed: { attempted: 0, blocked: 0 },
  explanation_derivation_removed: { attempted: 0, blocked: 0 }
};
const failures = [];
let baselineVerified = 0;

for (const scope of scopes) {
  for (let seed = 0; seed < 128; seed += 1) {
    const questionPlan = plan(scope);
    const generated = generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
    if (generated.status !== 'generated_and_triple_verified' || !generated.candidate) {
      failures.push({ scope, seed, mutation: 'baseline_generation', status: generated.status });
      continue;
    }
    baselineVerified += 1;
    const base = generated.candidate;
    const correctIndex = base.options.findIndex((option) => option.id === base.correctAnswer);
    const wrongIndex = (correctIndex + 1) % base.options.length;

    const declared = clone(base);
    declared.correctAnswer = declared.options[wrongIndex].id;
    mutationCounts.declared_answer_rotation.attempted += 1;
    const declaredStatuses = deterministicStatuses(declared, questionPlan);
    if (Object.values(declaredStatuses).every((status) => status !== 'verified')) mutationCounts.declared_answer_rotation.blocked += 1;
    else failures.push({ scope, seed, mutation: 'declared_answer_rotation', statuses: declaredStatuses });

    const extraCorrect = clone(base);
    extraCorrect.options[wrongIndex].text = extraCorrect.options[correctIndex].text;
    mutationCounts.extra_semantically_correct_option.attempted += 1;
    const extraStatuses = deterministicStatuses(extraCorrect, questionPlan);
    if (Object.values(extraStatuses).every((status) => status !== 'verified')) mutationCounts.extra_semantically_correct_option.blocked += 1;
    else failures.push({ scope, seed, mutation: 'extra_semantically_correct_option', statuses: extraStatuses });

    const removed = clone(base);
    removed.options[correctIndex].text = removed.options[wrongIndex].text;
    mutationCounts.correct_semantics_removed.attempted += 1;
    const removedStatuses = deterministicStatuses(removed, questionPlan);
    if (Object.values(removedStatuses).every((status) => status !== 'verified')) mutationCounts.correct_semantics_removed.blocked += 1;
    else failures.push({ scope, seed, mutation: 'correct_semantics_removed', statuses: removedStatuses });

    const noExplanation = clone(base);
    noExplanation.explanation = '';
    noExplanation.localizations.zh.explanation = '';
    noExplanation.localizations.en.explanation = '';
    mutationCounts.explanation_derivation_removed.attempted += 1;
    const noExplanationStatuses = deterministicStatuses(noExplanation, questionPlan);
    if (noExplanationStatuses.solver === 'verified'
      && noExplanationStatuses.oracle === 'verified'
      && noExplanationStatuses.formal !== 'verified') mutationCounts.explanation_derivation_removed.blocked += 1;
    else failures.push({ scope, seed, mutation: 'explanation_derivation_removed', statuses: noExplanationStatuses });
  }
}

const domainDefinitions = [
  {
    name: 'delta_x_delta_y_reversed', scope: 'slope_from_two_distinct_points',
    eligible: () => true,
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /delta_x_delta_y_reversed/);
      if (target < 0) return false;
      candidate.options[candidate.options.findIndex((option) => option.id === candidate.correctAnswer)].text = candidate.options[target].text;
      return true;
    }
  },
  {
    name: 'slope_sign_error', scope: 'slope_from_two_distinct_points',
    eligible: () => true,
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /slope_sign_error/);
      if (target < 0) return false;
      candidate.options[candidate.options.findIndex((option) => option.id === candidate.correctAnswer)].text = candidate.options[target].text;
      return true;
    }
  },
  {
    name: 'negative_slope_angle_mapped_to_45', scope: 'inclination_angle_from_line',
    eligible: (candidate) => candidate.options.find((option) => option.id === candidate.correctAnswer)?.text === '135°',
    mutate: (candidate) => {
      candidate.options[candidate.options.findIndex((option) => option.id === candidate.correctAnswer)].text = '45°';
      return true;
    }
  },
  {
    name: 'vertical_line_undefined_slope', scope: 'inclination_angle_from_line',
    eligible: () => true,
    mutate: (candidate) => {
      candidate.prompt = '直线 l: x-2=0 的倾斜角是多少？';
      return true;
    }
  },
  {
    name: 'parallel_misread_as_coincident', scope: 'identify_parallel_or_perpendicular_line',
    eligible: (candidate) => /correct_parallel_relation/.test(String(candidate.optionMetadata.find((item) => item.optionId === candidate.correctAnswer)?.distractorIntent ?? '')),
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /coincident_not_distinct_parallel/);
      if (target < 0) return false;
      candidate.correctAnswer = candidate.options[target].id;
      return true;
    }
  },
  {
    name: 'reciprocal_instead_of_negative_reciprocal', scope: 'identify_parallel_or_perpendicular_line',
    eligible: (candidate) => /correct_perpendicular_relation/.test(String(candidate.optionMetadata.find((item) => item.optionId === candidate.correctAnswer)?.distractorIntent ?? '')),
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /parallel_confusion/);
      if (target < 0) return false;
      candidate.correctAnswer = candidate.options[target].id;
      return true;
    }
  },
  {
    name: 'constant_term_sign_or_offset_error', scope: 'line_equation_from_point_and_slope',
    eligible: () => true,
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /constant_term_sign_or_offset_error/);
      if (target < 0) return false;
      candidate.correctAnswer = candidate.options[target].id;
      return true;
    }
  },
  {
    name: 'given_point_not_on_candidate_line', scope: 'line_equation_from_point_and_slope',
    eligible: () => true,
    mutate: (candidate) => {
      const target = optionIndexByIntent(candidate, /constant_term_sign_or_offset_error/);
      if (target < 0) return false;
      candidate.options[candidate.options.findIndex((option) => option.id === candidate.correctAnswer)].text = candidate.options[target].text;
      return true;
    }
  },
  {
    name: 'scaled_equivalent_creates_second_true_option', scope: 'line_equation_from_point_and_slope',
    eligible: () => true,
    mutate: (candidate, questionPlan) => {
      const evidence = solveSubjectPracticeMathLineRelation(candidate, { questionPlan });
      const semantic = evidence.optionVerdicts.find((item) => item.optionId === candidate.correctAnswer)?.semanticValue;
      const line = semantic?.line;
      if (!line || !Number.isInteger(line.a) || !Number.isInteger(line.b) || !Number.isInteger(line.c)) return false;
      const wrong = (candidate.options.findIndex((option) => option.id === candidate.correctAnswer) + 1) % candidate.options.length;
      candidate.options[wrong].text = lineText(2 * line.a, 2 * line.b, 2 * line.c);
      return true;
    }
  }
];

const domainMutationCounts = {};
for (const definition of domainDefinitions) {
  const questionPlan = plan(definition.scope);
  let attempted = 0;
  let blocked = 0;
  for (let seed = 0; seed < 4096 && attempted < 32; seed += 1) {
    const generated = generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
    if (generated.status !== 'generated_and_triple_verified' || !generated.candidate || !definition.eligible(generated.candidate)) continue;
    const mutated = clone(generated.candidate);
    if (!definition.mutate(mutated, questionPlan)) continue;
    attempted += 1;
    const statuses = deterministicStatuses(mutated, questionPlan);
    if (Object.values(statuses).every((status) => status !== 'verified')) blocked += 1;
    else failures.push({ scope: definition.scope, seed, mutation: definition.name, statuses });
  }
  domainMutationCounts[definition.name] = { exactScope: definition.scope, attempted, blocked };
}

const attemptedMutations = Object.values(mutationCounts).reduce((sum, item) => sum + item.attempted, 0);
const blockedMutations = Object.values(mutationCounts).reduce((sum, item) => sum + item.blocked, 0);
const domainMutationTotal = Object.values(domainMutationCounts).reduce((sum, item) => sum + item.attempted, 0);
const domainMutationBlocked = Object.values(domainMutationCounts).reduce((sum, item) => sum + item.blocked, 0);
const checks = {
  fixedBaselineComplete: baselineVerified === scopes.length * 128,
  allInjectedFaultsBlocked: attemptedMutations === scopes.length * 128 * 4 && blockedMutations === attemptedMutations,
  explanationVerifierIsNotRedundantWithAnswerSolvers: mutationCounts.explanation_derivation_removed.blocked === scopes.length * 128,
  everyDomainMutationHasMinimumPerType: Object.values(domainMutationCounts).every((item) => item.attempted === 32),
  everyDomainMutationBlocked: domainMutationBlocked === domainDefinitions.length * 32,
  domainMutationsReportedPerExactScope: new Set(Object.values(domainMutationCounts).map((item) => item.exactScope)).size === scopes.length,
  noProviderDatabaseOrPublication: true
};
const report = {
  mode: 'subject_practice_math_line_relation_mutation_benchmark',
  reportVersion: 'math-line-relation-mutation-benchmark-v2',
  mutationPolicyVersion: 'math-line-relation-domain-mutation-policy-v1',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  fixedDenominator: {
    baselineCandidates: scopes.length * 128,
    genericMutationCount: attemptedMutations,
    domainMutationTypes: domainDefinitions.length,
    domainMutationsPerType: 32,
    domainMutationTotal
  },
  baselineVerified, blockedMutations, mutationCounts,
  domainMutationBlocked, domainMutationCounts,
  sourceBindings: {
    questionPlanPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-question-plan-policy.ts'),
    generatorSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-local-generator.ts'),
    solverSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-solver.ts'),
    oracleSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle.ts'),
    explanationVerifierSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-explanation-verifier.ts'),
    orchestratorSha256: fileSha256('backend/src/ai-questioning/subject-practice-formal-verification-orchestrator.ts'),
    scopeRegistrySha256: fileSha256('backend/src/ai-questioning/subject-practice-production-shadow-scope-registry.ts')
  },
  failures: failures.slice(0, 20), failureCount: failures.length,
  providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
  databaseImpact: 'none_fixture_only', publicationImpact: 'none'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
