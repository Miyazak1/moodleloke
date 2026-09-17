'use strict';

const PORTABLE_HOST_ADAPTER_VERSION = 'cscalite-question-engine-portable-host-adapter-v1-offline-only';
const SCHEMA = 'subject-practice-question-plan-v1';
const POLICY = 'subject-practice-question-plan-policy-v1';

function renderConstraintsFor(input) {
  if (input.taskFamily === 'elementary_function_direct_property') return {
    requiredElementaryFunctionClass: input.requiredElementaryFunctionClass,
    requiredSinglePropertyTarget: input.requiredSinglePropertyTarget,
    singlePropertyTargetContractVersion: 'math-basic-elementary-single-property-target-v1',
    forbidCrossPropertyDistractors: true, maxIndependentRelations: 1, maxFunctionObjects: 1
  };
  if (input.taskFamily === 'derivative_direct_evaluation') return {
    exactDerivativeScope: input.exactDerivativeScope
  };
  if (input.taskFamily === 'math_line_relation_direct') return {
    exactLineRelationScope: input.exactLineRelationScope, forbidFigureDependency: true,
    forbidMultiStageIntersection: true
  };
  if (input.taskFamily === 'kinematics_basic_direct_relation') return {
    exactPhysicsKinematicsScope: input.exactPhysicsKinematicsScope,
    maxIndependentRelations: 1, forbidMultiStageModelChain: true
  };
  if (input.taskFamily === 'ph_dilution_strong_acid_base_neutralization') return {
    completeDissociationOnly: true,
    allowedRelationKinds: ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'],
    allowedAnswerTargets: ['ph_value', 'acid_base_character'],
    exactChemistryRelationKind: input.exactChemistryRelationKind,
    exactChemistryAnswerTarget: input.exactChemistryAnswerTarget,
    requireVisibleQuantitiesAndUnits: true,
    requireTemperatureConvention25C: true,
    forbidWeakPolyproticBufferHydrolysisActivityAndTitration: true,
    maxIndependentRelations: 1, forbidMultiStageModelChain: true
  };
  return null;
}

function templateFor(input) {
  return input.planTemplate || ({
    elementary_function_direct_property: 'math_elementary_function_relation_v1',
    derivative_direct_evaluation: 'math_derivative_condition_chain_v1',
    math_line_relation_direct: 'math_line_relation_direct_v1',
    kinematics_basic_direct_relation: 'physics_kinematics_basic_relation_v1',
    ph_dilution_strong_acid_base_neutralization: 'chemistry_strong_acid_base_single_relation_v1'
  })[input.taskFamily];
}

function buildQuestionPlan(input) {
  const renderConstraints = renderConstraintsFor(input || {});
  const planTemplate = templateFor(input || {});
  if (!renderConstraints || !planTemplate) return null;
  return {
    schemaVersion: SCHEMA, policyVersion: POLICY, subject: input.subject,
    topicId: input.topicId ?? null, topicTitle: input.topicTitle || '',
    productionCellId: input.productionCellId ?? null, targetDifficulty: input.targetDifficulty,
    taskFamily: input.taskFamily, planTemplate, representationType: 'text', renderConstraints,
    budget: { maxPlanRepairs: 0, maxCandidateRepairs: 0 }, evidenceSlots: [], hypotheses: [],
    reasoningSteps: [], misconceptionTargets: [], answerDerivation: [], uniquenessConditions: []
  };
}

function validate(plan) {
  const valid = !!plan && plan.schemaVersion === SCHEMA && plan.policyVersion === POLICY
    && !!renderConstraintsFor({ ...plan, ...(plan.renderConstraints || {}) })
    && templateFor(plan) === plan.planTemplate;
  return { valid, errors: valid ? [] : ['portable_exact_plan_contract_not_satisfied'] };
}

function adherenceFor(plan, candidate) {
  const answerIds = new Set(Array.isArray(candidate?.options) ? candidate.options.map((item) => item.id) : []);
  const validCandidate = candidate?.sourceType === 'ai' && candidate?.questionType === 'single_choice'
    && answerIds.size === 4 && answerIds.has(candidate?.correctAnswer);
  const adheres = validate(plan).valid && validCandidate;
  return { adheres, failureCodes: adheres ? [] : ['portable_candidate_structure_or_plan_not_adherent'] };
}

function validateScenario() {
  return { status: 'unsupported_offline_portable_adapter', blockers: ['portable_scenario_materialization_not_available'] };
}

function createPortableHostAdapter() {
  return Object.freeze({
    adapterVersion: PORTABLE_HOST_ADAPTER_VERSION, buildQuestionPlan,
    ports: Object.freeze({ validate, adherenceFor, validateScenario }),
    capabilities: Object.freeze({
      offlineExactPlanPreview: true, productionQualification: false,
      scenarioMaterialization: false, databaseAccess: false, providerAccess: false, publicationAccess: false
    })
  });
}

module.exports = Object.freeze({ PORTABLE_HOST_ADAPTER_VERSION, createPortableHostAdapter });
