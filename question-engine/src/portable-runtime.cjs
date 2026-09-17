'use strict';

const path = require('node:path');
const { createPortableHostAdapter } = require('../adapters/portable-host.cjs');

const PORTABLE_API_VERSION = 'cscalite-question-engine-portable-api-v1';
const adapter = createPortableHostAdapter();
const coreRoot = path.resolve(__dirname, '..', 'dist', 'core');
const load = (name) => require(path.join(coreRoot, `${name}.js`));
const safeSeed = (value) => {
  const seed = Number(value);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  return seed;
};
const envelope = (family, result) => ({
  apiVersion: PORTABLE_API_VERSION,
  hostAdapterVersion: adapter.adapterVersion,
  mode: 'portable_offline_unpersisted_preview', family, ...result,
  providerCalls: 0, databaseReads: 0, databaseWrites: 0,
  observationTasksCreated: 0, studentPublicationAllowed: false,
  productionQualificationAllowed: false
});

function generatePreview(input = {}) {
  const family = String(input.family || '').trim();
  const seed = safeSeed(input.seed);
  let planInput;
  let blueprint;
  let result;
  if (family === 'math_derivative') {
    planInput = { subject: 'math', topicId: 71, topicTitle: '导数与微积分初步', productionCellId: 10,
      targetDifficulty: 'basic', taskFamily: 'derivative_direct_evaluation',
      exactDerivativeScope: 'direct_polynomial_value' };
    blueprint = { id: 10, subject: 'math', topicId: 71, topicTitle: '导数与微积分初步',
      syllabusVersion: '2025', difficulty: 'basic', questionType: 'single_choice', skill: 'multi_step_reasoning', constraints: {} };
    const generator = load('subject-practice-math-derivative-local-generator')
      .createSubjectPracticeMathDerivativeLocalGenerator(adapter.ports);
    result = generator({ blueprint, questionPlan: adapter.buildQuestionPlan(planInput), seed });
  } else if (family === 'math_elementary') {
    const functionClass = String(input.functionClass || '');
    const propertyTarget = String(input.propertyTarget || '');
    const pairs = new Set(['logarithmic:domain', 'exponential:range', 'radical:monotonicity', 'power:function_value']);
    if (!pairs.has(`${functionClass}:${propertyTarget}`)) throw new Error('question_engine_math_elementary_pair_not_registered');
    planInput = { subject: 'math', topicId: 69, topicTitle: '基本初等函数', productionCellId: 16,
      targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
      requiredElementaryFunctionClass: functionClass, requiredSinglePropertyTarget: propertyTarget };
    blueprint = { id: 16, subject: 'math', topicId: 69, topicTitle: '基本初等函数', syllabusVersion: '2025',
      difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {} };
    const generator = load('subject-practice-math-elementary-local-generator')
      .createSubjectPracticeMathElementaryLocalGenerator(adapter.ports.validate);
    result = generator({ blueprint, questionPlan: adapter.buildQuestionPlan(planInput), seed });
  } else if (family === 'math_line_relation') {
    const exactScope = String(input.exactScope || '');
    if (!/^(slope_from_two_distinct_points|inclination_angle_from_line|identify_parallel_or_perpendicular_line|line_equation_from_point_and_slope)$/.test(exactScope)) throw new Error('question_engine_math_line_relation_scope_invalid');
    planInput = { subject: 'math', topicTitle: 'line relation', productionCellId: 'line-relation-shadow-v1',
      targetDifficulty: 'basic', taskFamily: 'math_line_relation_direct',
      planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope: exactScope };
    blueprint = { id: 91001, topicId: 92001, subject: 'math', topicTitle: 'line relation',
      difficulty: 'basic', questionType: 'single_choice', syllabusVersion: 'line-relation-shadow-v1', skill: 'direct_application', constraints: {} };
    const generator = load('subject-practice-math-line-relation-local-generator')
      .createSubjectPracticeMathLineRelationLocalGenerator(adapter.ports);
    result = generator({ blueprint, questionPlan: adapter.buildQuestionPlan(planInput), seed });
  } else if (family === 'physics_kinematics') {
    const relationKind = String(input.relationKind || '');
    if (!/^(uniform_speed|acceleration_from_velocity_change|final_velocity_from_initial_acceleration_time|displacement_from_initial_acceleration_time)$/.test(relationKind)) throw new Error('question_engine_physics_relation_invalid');
    planInput = { subject: 'physics', topicId: 8, topicTitle: 'Kinematics', productionCellId: 24,
      targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation', exactPhysicsKinematicsScope: relationKind };
    blueprint = { id: 24, subject: 'physics', topicId: 8, topicTitle: 'Kinematics', syllabusVersion: '2025',
      difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {} };
    const generator = load('subject-practice-physics-kinematics-local-generator')
      .createSubjectPracticePhysicsKinematicsLocalGenerator(adapter.ports);
    result = generator({ blueprint, questionPlan: adapter.buildQuestionPlan(planInput), seed, relationKind });
  } else if (family === 'chemistry_acid_base') {
    const relationKind = String(input.relationKind || '');
    const answerTarget = String(input.answerTarget || '');
    if (!/^(strong_acid_dilution|strong_base_dilution|strong_acid_base_neutralization)$/.test(relationKind)
      || !/^(ph_value|acid_base_character)$/.test(answerTarget)) throw new Error('question_engine_chemistry_scope_invalid');
    planInput = { subject: 'chemistry', topicId: 51, topicTitle: '溶液浓度与pH计算', productionCellId: 42,
      targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      exactChemistryRelationKind: relationKind, exactChemistryAnswerTarget: answerTarget };
    blueprint = { id: 42, subject: 'chemistry', topicId: 51, topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025',
      difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {} };
    const generator = load('subject-practice-chemistry-acid-base-local-generator')
      .createSubjectPracticeChemistryAcidBaseLocalGenerator(adapter.ports);
    result = generator({ blueprint, questionPlan: adapter.buildQuestionPlan(planInput), seed, relationKind, answerTarget });
  } else throw new Error('question_engine_portable_family_not_registered');
  return envelope(family, result);
}

module.exports = Object.freeze({ PORTABLE_API_VERSION, generatePreview });
