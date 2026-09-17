#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION,
  solveSubjectPracticePhysicsKinematics
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-solver');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const BENCHMARK_VERSION = 'physics-basic-kinematics-programmatic-mutation-v2';

const questionPlan = buildSubjectPracticeQuestionPlan({
  subject: 'physics',
  topicTitle: 'Kinematics',
  productionCellId: '24',
  targetDifficulty: 'basic',
  taskFamily: 'kinematics_basic_direct_relation'
});

function orderedOptions(values, correctIndex) {
  const correct = values[0];
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, correct);
  return {
    options: ordered.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
    correctAnswer: String.fromCharCode(65 + correctIndex)
  };
}

function candidate(prompt, values, correctIndex, explanation) {
  const ordered = orderedOptions(values, correctIndex);
  return {
    subject: 'physics',
    topicId: 8,
    blueprintId: 24,
    sourceType: 'ai',
    designedDifficulty: 'basic',
    questionType: 'single_choice',
    prompt,
    options: ordered.options,
    correctAnswer: ordered.correctAnswer,
    explanation,
    knowledgeTags: ['运动学', '直线运动'],
    optionMetadata: [],
    syllabusVersion: '2025'
  };
}

const goldCases = [];
for (let index = 0; index < 32; index += 1) {
  const duration = 2 + (index % 7);
  const speed = 2 + Math.floor(index / 7) + (index % 3);
  const distance = duration * speed;
  goldCases.push({
    id: `uniform-speed-${index}`,
    relationKind: 'uniform_speed',
    candidate: candidate(
      `一小车沿直线做匀速运动，位移为 ${distance} m，用时为 ${duration} s，它的速度大小为多少？`,
      [`${speed} m/s`, `${speed + 1} m/s`, `${distance + duration} m/s`, `${distance * duration} m/s`],
      index % 4,
      `由 v=s/t=${distance}/${duration}=${speed} m/s。`
    )
  });
}
for (let index = 0; index < 32; index += 1) {
  const initial = 1 + (index % 7);
  const duration = 2 + (index % 6);
  const acceleration = [-3, -2, -1, 1, 2, 3, 4, 5][index % 8];
  const final = initial + acceleration * duration;
  goldCases.push({
    id: `final-velocity-${index}`,
    relationKind: 'final_velocity_from_initial_acceleration_time',
    candidate: candidate(
      `一辆车的初速度为 ${initial} m/s，加速度为 ${acceleration} m/s^2，运动 ${duration} s，求最终速度。`,
      [`${final} m/s`, `${final + 1} m/s`, `${initial + acceleration} m/s`, `${acceleration * duration} m/s`],
      index % 4,
      `由 v=u+at=${initial}+${acceleration}×${duration}=${final} m/s。`
    )
  });
}
for (let index = 0; index < 32; index += 1) {
  const initial = 1 + (index % 5);
  const duration = 2 + (index % 6);
  const acceleration = 1 + (index % 4);
  const displacement = initial * duration + 0.5 * acceleration * duration ** 2;
  goldCases.push({
    id: `displacement-${index}`,
    relationKind: 'displacement_from_initial_acceleration_time',
    candidate: candidate(
      `A body has initial velocity ${initial} m/s and acceleration ${acceleration} m/s^2 for ${duration} s. What is its displacement?`,
      [`${displacement} m`, `${displacement + duration} m`, `${displacement + duration + 1} m`, `${-displacement} m`],
      index % 4,
      `s=ut+1/2at^2=${initial}×${duration}+1/2×${acceleration}×${duration}^2=${displacement} m.`
    )
  });
}
for (let index = 0; index < 32; index += 1) {
  const initial = 1 + (index % 6);
  const duration = 2 + (index % 5);
  const acceleration = [-3, -2, -1, 1, 2, 3, 4, 5][index % 8];
  const final = initial + acceleration * duration;
  goldCases.push({
    id: `acceleration-${index}`,
    relationKind: 'acceleration_from_velocity_change',
    candidate: candidate(
      `A cart has initial velocity ${initial} m/s and reaches final velocity ${final} m/s in ${duration} s. What is its acceleration?`,
      [`${acceleration} m/s^2`, `${acceleration + 0.5} m/s^2`, `${-acceleration} m/s^2`, `${acceleration * duration} m/s^2`],
      index % 4,
      `a=(v-u)/t=(${final}-${initial})/${duration}=${acceleration} m/s^2.`
    )
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutationsFor(gold) {
  const answerFlip = clone(gold.candidate);
  answerFlip.correctAnswer = answerFlip.correctAnswer === 'A' ? 'B' : 'A';
  const secondTrue = clone(gold.candidate);
  const correctText = secondTrue.options.find((option) => option.id === secondTrue.correctAnswer).text;
  const duplicateTarget = secondTrue.options.find((option) => option.id !== secondTrue.correctAnswer);
  duplicateTarget.text = correctText;
  const missingUnit = clone(gold.candidate);
  const correct = missingUnit.options.find((option) => option.id === missingUnit.correctAnswer);
  correct.text = correct.text.replace(/\s*(?:cm|km|m)(?:\s*\/\s*s(?:\^2)?)?\s*$/i, '');
  const unsupportedRelation = clone(gold.candidate);
  unsupportedRelation.prompt = 'A v-t graph is a straight line from (0 s, 2 m/s) to (4 s, 10 m/s). What displacement is represented by the area under the graph?';
  return [
    { type: 'generator_answer_flip', candidate: answerFlip },
    { type: 'second_true_option', candidate: secondTrue },
    { type: 'missing_answer_unit', candidate: missingUnit },
    { type: 'unsupported_relation_form', candidate: unsupportedRelation }
  ];
}

const goldResults = goldCases.map((gold) => ({
  ...gold,
  evidence: solveSubjectPracticePhysicsKinematics(gold.candidate, { questionPlan }),
  adherence: subjectPracticeQuestionPlanAdherenceFor(questionPlan, gold.candidate)
}));
const mutationResults = goldCases.flatMap((gold) => mutationsFor(gold).map((mutation) => ({
  goldId: gold.id,
  type: mutation.type,
  evidence: solveSubjectPracticePhysicsKinematics(mutation.candidate, { questionPlan })
})));
const goldVerified = goldResults.filter((item) => item.evidence.status === 'verified'
  && item.evidence.verificationScope.matched
  && item.evidence.relationKind === item.relationKind
  && item.adherence.adheres);
const mutationFalseAccepts = mutationResults.filter((item) => item.evidence.status === 'verified' && item.evidence.verificationScope.matched);
const relationCounts = goldVerified.reduce((counts, item) => {
  counts[item.relationKind] = (counts[item.relationKind] || 0) + 1;
  return counts;
}, {});
const mutationTypeCounts = mutationResults.reduce((counts, item) => {
  counts[item.type] = (counts[item.type] || 0) + 1;
  return counts;
}, {});
const passed = goldVerified.length === goldCases.length && mutationFalseAccepts.length === 0;
const report = {
  mode: 'subject_practice_physics_basic_kinematics_solver_programmatic_mutation_benchmark',
  status: passed ? 'solver_subset_benchmark_passed_not_family_release_qualified' : 'solver_subset_benchmark_failed',
  solverVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
  scopeVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION,
  benchmarkVersion: BENCHMARK_VERSION,
  supportedRelations: [
    'uniform_speed',
    'acceleration_from_velocity_change',
    'final_velocity_from_initial_acceleration_time',
    'displacement_from_initial_acceleration_time'
  ],
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_shadow',
  releaseQualification: false,
  releaseQualificationReason: 'restricted_four_relation_grammar_without_sealed_official_holdout_or_family_total_coverage',
  goldCaseCount: goldCases.length,
  goldVerifiedCount: goldVerified.length,
  goldVerificationRate: goldVerified.length / goldCases.length,
  relationCounts,
  mutationCaseCount: mutationResults.length,
  mutationDetectedCount: mutationResults.length - mutationFalseAccepts.length,
  mutationFalseAcceptCount: mutationFalseAccepts.length,
  mutationDetectionRate: (mutationResults.length - mutationFalseAccepts.length) / mutationResults.length,
  mutationTypeCounts,
  failures: [
    ...goldResults.filter((item) => !goldVerified.includes(item)).map((item) => ({ id: item.id, kind: 'gold', evidence: item.evidence })),
    ...mutationFalseAccepts.slice(0, 10).map((item) => ({ id: item.goldId, kind: item.type, evidence: item.evidence }))
  ]
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

module.exports = { report };
