import {
  subjectPracticeScenarioContractFor,
  validateSubjectPracticeScenarioContract,
  type SubjectPracticeScenarioContract
} from './subject-practice-scenario-diversity-policy';

export const SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION = 'subject-practice-question-plan-v1';
export const SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION = 'subject-practice-question-plan-policy-v1';
export const SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG = 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED';
export const SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG = 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST';
export const SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS = 2;
export const SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS = 1;

export type SubjectPracticeQuestionPlanDifficulty = 'basic' | 'medium' | 'hard';

export type SubjectPracticeBasicElementaryRotation = {
  policyVersion: 'math-basic-elementary-rotation-v1';
  rotationIndex: number;
  functionClass: 'logarithmic' | 'exponential' | 'radical' | 'power';
  propertyTarget: 'domain' | 'range' | 'monotonicity' | 'function_value';
  instruction: string;
};

const SUBJECT_PRACTICE_BASIC_ELEMENTARY_ROTATIONS: Array<Omit<SubjectPracticeBasicElementaryRotation, 'rotationIndex'>> = [
  {
    policyVersion: 'math-basic-elementary-rotation-v1',
    functionClass: 'logarithmic',
    propertyTarget: 'domain',
    instruction: 'Use one logarithmic function and ask only for its domain; all four options must be competing domain sets.'
  },
  {
    policyVersion: 'math-basic-elementary-rotation-v1',
    functionClass: 'exponential',
    propertyTarget: 'range',
    instruction: 'Use one exponential function, optionally with one vertical shift, and ask only for its range; all four options must be competing ranges.'
  },
  {
    policyVersion: 'math-basic-elementary-rotation-v1',
    functionClass: 'radical',
    propertyTarget: 'monotonicity',
    instruction: 'Use one square-root function and ask only for monotonicity on its stated domain; all four options must be competing monotonicity claims.'
  },
  {
    policyVersion: 'math-basic-elementary-rotation-v1',
    functionClass: 'power',
    propertyTarget: 'function_value',
    instruction: 'Use one power function and ask only for one direct function value; all four options must be competing numeric values.'
  }
];

export function subjectPracticeBasicElementaryRotationFor(value: unknown): SubjectPracticeBasicElementaryRotation {
  const numeric = Number(value);
  const normalized = Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  const rotationIndex = normalized % SUBJECT_PRACTICE_BASIC_ELEMENTARY_ROTATIONS.length;
  return { ...SUBJECT_PRACTICE_BASIC_ELEMENTARY_ROTATIONS[rotationIndex], rotationIndex };
}

export type SubjectPracticeQuestionPlanScopeRotation = {
  policyVersion: 'subject-practice-question-plan-scope-rotation-v1';
  rotationIndex: number;
  subject: 'math' | 'physics' | 'chemistry';
  taskFamily: string;
  planTemplate: string;
  instruction: string;
  functionClass?: SubjectPracticeBasicElementaryRotation['functionClass'];
  propertyTarget?: SubjectPracticeBasicElementaryRotation['propertyTarget'];
  lineRelationScope?: 'slope_from_two_distinct_points' | 'inclination_angle_from_line' | 'identify_parallel_or_perpendicular_line' | 'line_equation_from_point_and_slope';
  derivativeScope?: 'direct_polynomial_value';
  physicsKinematicsScope?: 'uniform_speed' | 'acceleration_from_velocity_change' | 'final_velocity_from_initial_acceleration_time' | 'displacement_from_initial_acceleration_time';
  chemistryRelationKind?: 'strong_acid_dilution' | 'strong_base_dilution' | 'strong_acid_base_neutralization';
  chemistryAnswerTarget?: 'ph_value' | 'acid_base_character';
};

export function subjectPracticeQuestionPlanScopeRotationFor(input: {
  subject?: string | null;
  topicTitle?: string | null;
  productionCellId?: number | string | null;
  targetDifficulty?: string | null;
  taskFamily?: string | null;
  planTemplate?: string | null;
  currentCandidateCount?: number | null;
}): SubjectPracticeQuestionPlanScopeRotation | null {
  const template = subjectPracticeQuestionPlanTemplateFor(input);
  if (!template) return null;
  const numeric = Number(input.currentCandidateCount);
  const count = Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  if (template.taskFamily === 'elementary_function_direct_property'
    && template.planTemplate === 'math_elementary_function_relation_v1') {
    const slot = subjectPracticeBasicElementaryRotationFor(count);
    return {
      policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
      rotationIndex: slot.rotationIndex,
      subject: 'math',
      taskFamily: template.taskFamily,
      planTemplate: template.planTemplate,
      instruction: slot.instruction,
      functionClass: slot.functionClass,
      propertyTarget: slot.propertyTarget
    };
  }
  if (template.taskFamily === 'math_line_relation_direct'
    && template.planTemplate === 'math_line_relation_direct_v1') {
    const scopes = [
      'slope_from_two_distinct_points',
      'inclination_angle_from_line',
      'identify_parallel_or_perpendicular_line',
      'line_equation_from_point_and_slope'
    ] as const;
    const rotationIndex = count % scopes.length;
    const lineRelationScope = scopes[rotationIndex];
    return {
      policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
      rotationIndex,
      subject: 'math',
      taskFamily: template.taskFamily,
      planTemplate: template.planTemplate,
      instruction: `Use exactly the ${lineRelationScope} line-relation scope; do not substitute another relation.`,
      lineRelationScope
    };
  }
  if (template.taskFamily === 'derivative_direct_evaluation'
    && template.planTemplate === 'math_derivative_condition_chain_v1'
    && template.targetDifficulty === 'basic') {
    return {
      policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
      rotationIndex: 0,
      subject: 'math',
      taskFamily: template.taskFamily,
      planTemplate: template.planTemplate,
      instruction: 'Use exactly the direct_polynomial_value derivative scope; do not substitute a chain-rule, domain-trap, tangent, monotonicity, parameter, or higher-derivative task.',
      derivativeScope: 'direct_polynomial_value'
    };
  }
  if (template.taskFamily === 'kinematics_basic_direct_relation'
    && template.planTemplate === 'physics_kinematics_basic_relation_v1') {
    const scopes = [
      'uniform_speed',
      'acceleration_from_velocity_change',
      'final_velocity_from_initial_acceleration_time',
      'displacement_from_initial_acceleration_time'
    ] as const;
    const rotationIndex = count % scopes.length;
    const physicsKinematicsScope = scopes[rotationIndex];
    return {
      policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
      rotationIndex,
      subject: 'physics',
      taskFamily: template.taskFamily,
      planTemplate: template.planTemplate,
      instruction: `Use exactly the ${physicsKinematicsScope} kinematics scope; do not substitute another relation.`,
      physicsKinematicsScope
    };
  }
  if (template.taskFamily === 'ph_dilution_strong_acid_base_neutralization'
    && template.planTemplate === 'chemistry_strong_acid_base_single_relation_v1') {
    const slots = [
      ['strong_acid_dilution', 'ph_value'],
      ['strong_acid_dilution', 'acid_base_character'],
      ['strong_base_dilution', 'ph_value'],
      ['strong_base_dilution', 'acid_base_character'],
      ['strong_acid_base_neutralization', 'ph_value'],
      ['strong_acid_base_neutralization', 'acid_base_character']
    ] as const;
    const rotationIndex = count % slots.length;
    const [chemistryRelationKind, chemistryAnswerTarget] = slots[rotationIndex];
    return {
      policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
      rotationIndex,
      subject: 'chemistry',
      taskFamily: template.taskFamily,
      planTemplate: template.planTemplate,
      instruction: `Use exactly the ${chemistryRelationKind} relation and ${chemistryAnswerTarget} answer target; do not substitute another scope.`,
      chemistryRelationKind,
      chemistryAnswerTarget
    };
  }
  return null;
}

export type SubjectPracticeQuestionPlanEvidenceSlot = {
  id: string;
  type: string;
  role: string;
  independentGroup?: string | null;
};

export type SubjectPracticeQuestionPlanReasoningStep = {
  id: string;
  operation: string;
  inputs: string[];
  output: string;
};

export type SubjectPracticeQuestionPlanRelation = {
  id: string;
  type: string;
  expression?: string | null;
  variables?: string[];
  roundTripCheck?: boolean;
};

export type SubjectPracticeQuestionPlan = {
  schemaVersion: string;
  policyVersion: string;
  subject: string;
  topicId?: number | null;
  topicTitle?: string | null;
  productionCellId?: number | string | null;
  targetDifficulty: SubjectPracticeQuestionPlanDifficulty | string;
  taskFamily: string;
  planTemplate: string;
  representationType: string;
  reasoningSteps: SubjectPracticeQuestionPlanReasoningStep[];
  evidenceSlots: SubjectPracticeQuestionPlanEvidenceSlot[];
  quantitativeRelations?: SubjectPracticeQuestionPlanRelation[];
  hypotheses?: string[];
  misconceptionTargets?: string[];
  answerDerivation?: string[];
  uniquenessConditions?: string[];
  renderConstraints?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  scenarioContract?: SubjectPracticeScenarioContract;
};

export type SubjectPracticeQuestionPlanTemplate = {
  policyVersion: string;
  subject: 'chemistry' | 'math' | 'physics';
  // Seed cell from the original calibration run; matching must also work for later production runs.
  productionCellId: string;
  topicTitleIncludes: string[];
  targetDifficulty: SubjectPracticeQuestionPlanDifficulty;
  taskFamily: string;
  planTemplate: string;
  representationType: 'text' | 'experiment';
  minimumEvidenceSlots: number;
  minimumIndependentEvidenceGroups: number;
  minimumReasoningSteps: number;
  minimumHypotheses?: number;
  minimumDiscriminatingEvidenceSlots?: number;
  minimumQuantitativeRelations?: number;
  minimumIndependentReactionEvidence?: number;
  requiresCausalPropagation?: boolean;
  requiresUniqueAnswer?: boolean;
};

export type SubjectPracticeQuestionPlanValidation = {
  policyVersion: string;
  schemaVersion: string;
  valid: boolean;
  failureCodes: string[];
  template: string | null;
  taskFamily: string | null;
};

export type SubjectPracticeQuestionPlanGate = {
  policyVersion: string;
  schemaVersion: string;
  featureFlag: string;
  cellAllowlistFlag: string;
  enabled: boolean;
  applicable: boolean;
  cellAllowed: boolean;
  mode: 'not_applicable' | 'disabled_shadow' | 'plan_required';
  generationAllowed: boolean;
  productionImpact: 'none_disabled_shadow' | 'fail_closed_when_enabled';
  providerImpact: 'none_no_provider_call';
  subject: string | null;
  productionCellId: string | null;
  targetDifficulty: string | null;
  taskFamily: string | null;
  planTemplate: string | null;
  validation: SubjectPracticeQuestionPlanValidation | null;
  targetProfileCompatibility: {
    evaluated: boolean;
    satisfiable: boolean;
    reasonCodes: string[];
    questionForm: string | null;
    cognitiveSkill: string | null;
    difficultyBand: string | null;
  };
  reasonCodes: string[];
};

export type SubjectPracticeQuestionPlanAdherence = {
  policyVersion: string;
  schemaVersion: string;
  validPlan: boolean;
  adheres: boolean;
  planTemplate: string | null;
  taskFamily: string | null;
  failureCodes: string[];
  features: {
    operationWords: number;
    observationWords: number;
    hypothesisMarkers: number;
    reasoningConnectors: number;
    quantitativeMarkers: number;
    reactionClues: number;
    gasSpeciesMarkers: number;
    gasControlMarkers: number;
    redoxReactionMarkers: number;
    redoxConceptMarkers: number;
    redoxQuantitativeChainMarkers: number;
    mathPropertySignals: number;
    mathStatementMarkers: number;
    mathTransformationSignals: number;
    mathOrderingSignals: number;
    mathParameterConstraintSignals: number;
    mathProbabilitySignals: number;
    mathProbabilityNormalMediumNoEventRisk: boolean;
    mathProbabilityNormalReferenceTableRisk: boolean;
    mathDerivativeSignals: number;
    mathDerivativeMediumDefinitionOnlyRisk: boolean;
    mathDerivativeHardCoefficientSolveOnlyRisk: boolean;
    mathDerivativeBasicAdvancedOperationRisk: boolean;
    mathVectorComplexSignals: number;
    mathVectorComplexBasicDefinitionOnlyRisk: boolean;
    mathGeometrySignals: number;
    mathAnalyticGeometryDefinitionOnlyRisk: boolean;
    mathAnalyticGeometryBasicGeneralCircleRisk: boolean;
    mathAnalyticGeometryHardConicRelationOnlyRisk: boolean;
    mathElementaryFunctionSignals: number;
    mathElementaryFunctionGenericClassificationRisk: boolean;
    mathElementaryFunctionBasicEquationSolveRisk: boolean;
    mathElementaryFunctionBasicMultipleObjectRisk: boolean;
    mathSequenceSignals: number;
    mathSequenceGenericClassificationRisk: boolean;
    mathStatisticsSignals: number;
    mathStatisticsBasicMultiStatisticComparisonRisk: boolean;
    mathStatisticsMediumPureLinearTransformRisk: boolean;
    mathStatisticsHardDirectCombinedVarianceRisk: boolean;
    mathSpatialSignals: number;
    mathSpatialMediumMultiPropositionOvercomplexRisk: boolean;
    mathSpatialHardConceptOnlyRisk: boolean;
    mathSpatialHardDirectCoordinateOnlyRisk: boolean;
    mathParameterInferenceRisk: boolean;
    mathOptionJudgement: boolean;
    mathEnumeratedConditionCount: number;
    mathFunctionPropertyStackCount: number;
    mathFunctionDistinctPropertyCount: number;
    mathFunctionObjectSignals: number;
    mathFunctionPointValueCount: number;
    mathFunctionNamedPointCount: number;
    mathFunctionMultipleNamedPointsRisk: boolean;
    mathBasicFunctionSolutionScaffoldRisk: boolean;
    mathFunctionBasicMultiConstraintDomainRisk: boolean;
    mathPureFunctionExternalContextRisk: boolean;
    mathHardFunctionGenericConceptRisk: boolean;
    mathMediumFunctionPropertyOverComplex: boolean;
    mathVectorComplexObjectCount: number;
    mathVectorComplexRelationCount: number;
    mathVectorComplexCoordinateGeometryDriftRisk: boolean;
    mathVectorComplexLocusParameterChainRisk: boolean;
    mathVectorComplexOneStepFormulaRisk: boolean;
    physicsKinematicsSignals: number;
    physicsGraphSignals: number;
    physicsUnitSignals: number;
    physicsEquationSignals: number;
    physicsOpticsSignals: number;
    physicsOpticsRelationSignals: number;
    physicsUnseenDiagramRisk: boolean;
    chemistryClassificationSignals: number;
    chemistryStateChangeEvidenceSignals: number;
    chemistryDefinitionOnlyClassificationRisk: boolean;
    chemistryPhConceptSignals: number;
    chemistryPhOperationErrorSignals: number;
    chemistryPhDirectionSignals: number;
    chemistryPhDirectCalculationRisk: boolean;
  };
  productionImpact: 'none_audit_or_gate_scaffold';
  providerImpact: 'none_no_provider_call';
};

export type SubjectPracticeQuestionPlanFailureRoute = {
  policyVersion: string;
  schemaVersion: string;
  stage: 'none' | 'plan_validation' | 'candidate_plan_adherence' | 'reviewer_or_gate' | 'delivery';
  action: 'none' | 'repair_plan' | 'repair_candidate_rendering' | 'route_to_existing_reviewer_gate_repair' | 'record_delivery_only';
  reasonCodes: string[];
  qualityMemoryEligible: boolean;
  deliveryMemoryEligible: boolean;
  productionImpact: 'none_audit_only';
  providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality';
};

export type SubjectPracticeQuestionPlanAttempt = {
  lifecycleVersion: 'subject-practice-question-plan-attempt-v1';
  policyVersion: string;
  schemaVersion: string;
  attemptId: string | null;
  attemptIndex: number;
  phase: 'enqueue' | 'candidate_evaluated';
  status:
    | 'not_applicable'
    | 'shadow_disabled'
    | 'plan_missing'
    | 'plan_invalid'
    | 'plan_target_profile_conflict'
    | 'plan_ready'
    | 'candidate_adheres'
    | 'candidate_needs_repair'
    | 'reviewer_or_gate_failed'
    | 'delivery_failed';
  planSource: 'none' | 'provided_or_scaffold';
  planTemplate: string | null;
  taskFamily: string | null;
  budget: {
    planRepairCount: number;
    candidateRepairCount: number;
    maxPlanRepairs: number;
    maxCandidateRepairs: number;
  };
  route: SubjectPracticeQuestionPlanFailureRoute | null;
  productionImpact: 'none_metadata_only';
  providerImpact: 'none_no_provider_call';
  updatedAt: string;
};

export type SubjectPracticeQuestionPlanRepairBudgetDecision = {
  policyVersion: string;
  status: 'not_applicable' | 'repair_allowed' | 'repair_budget_exhausted';
  action: SubjectPracticeQuestionPlanFailureRoute['action'];
  repairKind: 'none' | 'plan' | 'candidate';
  used: number;
  maximum: number;
  nextUsed: number;
  allowed: boolean;
  reasonCode: string | null;
  productionImpact: 'none_policy_only';
  providerImpact: 'none_no_provider_call';
};

export type SubjectPracticeQuestionPlanRepairResult = {
  policyVersion: 'subject-practice-question-plan-deterministic-repair-v1';
  status: 'not_required' | 'repaired' | 'repair_budget_exhausted' | 'unrepairable';
  originalValidation: SubjectPracticeQuestionPlanValidation;
  repairedPlan: SubjectPracticeQuestionPlan | null;
  validation: SubjectPracticeQuestionPlanValidation;
  attempts: Array<{
    attemptIndex: number;
    strategy: 'rebuild_registered_template_same_family' | 'rebuild_registered_template_default_family';
    candidateBuilt: boolean;
    validation: SubjectPracticeQuestionPlanValidation | null;
  }>;
  budget: {
    used: number;
    maximum: number;
  };
  reasonCode: string | null;
  productionImpact: 'none_deterministic_plan_only';
  providerImpact: 'none_no_provider_call';
};

export const SUBJECT_PRACTICE_CHEMISTRY_QUESTION_PLAN_TEMPLATES: SubjectPracticeQuestionPlanTemplate[] = [
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '593',
    topicTitleIncludes: ['lab', 'experiment', '实验', '仪器'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_experimental_evidence_chain',
    planTemplate: 'competing_hypothesis_discrimination_v1',
    representationType: 'experiment',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumHypotheses: 2,
    minimumDiscriminatingEvidenceSlots: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '596',
    topicTitleIncludes: ['organic', '有机'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_organic_combustion_reaction_evidence_calculation',
    planTemplate: 'organic_formula_reaction_unique_structure_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    minimumIndependentReactionEvidence: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '592',
    topicTitleIncludes: ['lab', 'experiment', '实验', '仪器'],
    targetDifficulty: 'medium',
    taskFamily: 'medium_lab_two_operation_evidence',
    planTemplate: 'two_linked_operations_causal_propagation_v1',
    representationType: 'experiment',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    requiresCausalPropagation: true,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '607',
    topicTitleIncludes: ['gas', '\u6c14\u4f53'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_gas_impurity_elimination',
    planTemplate: 'gas_impurity_control_competing_elimination_v1',
    representationType: 'experiment',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumHypotheses: 2,
    minimumDiscriminatingEvidenceSlots: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '610',
    topicTitleIncludes: ['redox', '\u6c27\u5316\u8fd8\u539f'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_redox_electron_transfer_quantitative_chain',
    planTemplate: 'redox_electron_transfer_quantitative_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '611',
    topicTitleIncludes: ['redox', '\u6c27\u5316\u8fd8\u539f'],
    targetDifficulty: 'basic',
    taskFamily: 'basic_redox_single_species_judgement',
    planTemplate: 'basic_redox_single_reaction_valence_rule_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '36',
    topicTitleIncludes: ['物质分类', '状态变化', '物理变化', '化学变化', 'classification', 'state change'],
    targetDifficulty: 'medium',
    taskFamily: 'classification_state_change_evidence_judgement',
    planTemplate: 'chemistry_medium_classification_evidence_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '41',
    topicTitleIncludes: ['ph', '酸碱', '溶液浓度'],
    targetDifficulty: 'basic',
    taskFamily: 'basic_ph_measurement_or_preparation_error_judgement',
    planTemplate: 'basic_ph_measurement_preparation_error_v1',
    representationType: 'experiment',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    requiresCausalPropagation: true,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'chemistry',
    productionCellId: '41',
    topicTitleIncludes: ['ph', '酸碱', '溶液浓度'],
    targetDifficulty: 'medium',
    taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    planTemplate: 'chemistry_strong_acid_base_single_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  }
];

export const SUBJECT_PRACTICE_MATH_QUESTION_PLAN_TEMPLATES: SubjectPracticeQuestionPlanTemplate[] = [
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '350',
    topicTitleIncludes: ['function', 'logarithm', 'exponential', '函数', '对数', '指数'],
    targetDifficulty: 'medium',
    taskFamily: 'medium_function_property_combination',
    planTemplate: 'math_medium_function_two_move_reasoning_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '350',
    topicTitleIncludes: ['function', 'logarithm', 'exponential', '函数', '对数', '指数'],
    targetDifficulty: 'medium',
    taskFamily: 'elementary_function_exp_log_ordering',
    planTemplate: 'math_medium_exp_log_ordering_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '350',
    topicTitleIncludes: ['function', 'quadratic', '函数', '二次函数', '参数'],
    targetDifficulty: 'medium',
    taskFamily: 'function_quadratic_parameter_property',
    planTemplate: 'math_medium_function_parameter_constraint_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '367',
    topicTitleIncludes: ['normal distribution', '正态分布'],
    targetDifficulty: 'basic',
    taskFamily: 'normal_distribution_z_score_probability',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '365',
    topicTitleIncludes: ['normal distribution', '正态分布'],
    targetDifficulty: 'medium',
    taskFamily: 'normal_distribution_z_score_probability',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '366',
    topicTitleIncludes: ['normal distribution', '正态分布'],
    targetDifficulty: 'hard',
    taskFamily: 'normal_distribution_z_score_probability',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '361',
    topicTitleIncludes: ['probability', 'combinatorics', 'normal distribution', '概率', '排列组合', '正态分布'],
    targetDifficulty: 'basic',
    taskFamily: 'probability_multi_event_counting',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '359',
    topicTitleIncludes: ['probability', 'combinatorics', 'normal distribution', '概率', '排列组合', '正态分布'],
    targetDifficulty: 'medium',
    taskFamily: 'probability_multi_event_counting',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '360',
    topicTitleIncludes: ['probability', 'combinatorics', 'normal distribution', '概率', '排列组合', '正态分布'],
    targetDifficulty: 'hard',
    taskFamily: 'probability_multi_event_counting',
    planTemplate: 'math_probability_counting_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '340',
    topicTitleIncludes: ['vector', 'complex', '向量', '复数'],
    targetDifficulty: 'basic',
    taskFamily: 'vector_coordinate_norm_dot_angle',
    planTemplate: 'math_vector_complex_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '338',
    topicTitleIncludes: ['vector', 'complex', '向量', '复数'],
    targetDifficulty: 'medium',
    taskFamily: 'vector_coordinate_norm_dot_angle',
    planTemplate: 'math_vector_complex_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '339',
    topicTitleIncludes: ['vector', 'complex', '向量', '复数'],
    targetDifficulty: 'hard',
    taskFamily: 'vector_coordinate_norm_dot_angle',
    planTemplate: 'math_vector_complex_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '349',
    topicTitleIncludes: ['derivative', 'calculus', '导数', '微积分'],
    targetDifficulty: 'basic',
    taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '347',
    topicTitleIncludes: ['derivative', 'calculus', '导数', '微积分'],
    targetDifficulty: 'medium',
    taskFamily: 'derivative_tangent_constraint',
    planTemplate: 'math_derivative_condition_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '348',
    topicTitleIncludes: ['derivative', 'calculus', '导数', '微积分'],
    targetDifficulty: 'hard',
    taskFamily: 'derivative_tangent_constraint',
    planTemplate: 'math_derivative_condition_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '343',
    topicTitleIncludes: ['analytic geometry', 'conic', 'circle', 'line', '平面解析几何', '解析几何', '圆锥曲线', '直线', '圆'],
    targetDifficulty: 'basic',
    taskFamily: 'circle_line_chord_length',
    planTemplate: 'math_analytic_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '341',
    topicTitleIncludes: ['analytic geometry', 'conic', 'circle', 'line', '平面解析几何', '解析几何', '圆锥曲线', '直线', '圆'],
    targetDifficulty: 'medium',
    taskFamily: 'circle_line_chord_length',
    planTemplate: 'math_analytic_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '342',
    topicTitleIncludes: ['analytic geometry', 'conic', 'circle', 'line', '平面解析几何', '解析几何', '圆锥曲线', '直线', '圆'],
    targetDifficulty: 'hard',
    taskFamily: 'circle_line_chord_length',
    planTemplate: 'math_analytic_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '352',
    topicTitleIncludes: ['function', '函数'],
    targetDifficulty: 'basic',
    taskFamily: 'basic_function_direct_property',
    planTemplate: 'math_function_property_by_difficulty_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '351',
    topicTitleIncludes: ['function', '函数'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_function_multi_condition_property',
    planTemplate: 'math_function_property_by_difficulty_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '355',
    topicTitleIncludes: ['elementary function', '基本初等函数', '初等函数', '指数', '对数', '幂函数'],
    targetDifficulty: 'basic',
    taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '353',
    topicTitleIncludes: ['elementary function', '基本初等函数', '初等函数', '指数', '对数', '幂函数'],
    targetDifficulty: 'medium',
    taskFamily: 'elementary_function_exp_log_ordering',
    planTemplate: 'math_medium_exp_log_ordering_chain_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '354',
    topicTitleIncludes: ['elementary function', '基本初等函数', '初等函数', '指数', '对数', '幂函数'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_elementary_function_parameter_or_inequality',
    planTemplate: 'math_elementary_function_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '358',
    topicTitleIncludes: ['sequence', '数列', '等差', '等比', '递推'],
    targetDifficulty: 'basic',
    taskFamily: 'arithmetic_sequence_two_condition_solve_a1_d',
    planTemplate: 'math_sequence_condition_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '356',
    topicTitleIncludes: ['sequence', '数列', '等差', '等比', '递推'],
    targetDifficulty: 'medium',
    taskFamily: 'arithmetic_sequence_two_condition_solve_a1_d',
    planTemplate: 'math_sequence_condition_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '357',
    topicTitleIncludes: ['sequence', '数列', '等差', '等比', '递推'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_sequence_multi_constraint_reasoning',
    planTemplate: 'math_sequence_condition_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '364',
    topicTitleIncludes: ['statistics', 'data', '数据', '统计', '数字特征', '平均数', '方差'],
    targetDifficulty: 'basic',
    taskFamily: 'direct_variance_formula',
    planTemplate: 'math_statistics_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '362',
    topicTitleIncludes: ['statistics', 'data', '数据', '统计', '数字特征', '平均数', '方差'],
    targetDifficulty: 'medium',
    taskFamily: 'combined_variance',
    planTemplate: 'math_statistics_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '363',
    topicTitleIncludes: ['statistics', 'data', '数据', '统计', '数字特征', '平均数', '方差'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_statistics_multi_step_inference',
    planTemplate: 'math_statistics_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '346',
    topicTitleIncludes: ['spatial geometry', 'solid geometry', '空间几何', '立体几何', '线面', '面面'],
    targetDifficulty: 'basic',
    taskFamily: 'spatial_coordinate_direct_metric',
    planTemplate: 'math_spatial_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '344',
    topicTitleIncludes: ['spatial geometry', 'solid geometry', '空间几何', '立体几何', '线面', '面面'],
    targetDifficulty: 'medium',
    taskFamily: 'medium_geometry_coordinate_vector_reasoning',
    planTemplate: 'math_spatial_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: '345',
    topicTitleIncludes: ['spatial geometry', 'solid geometry', '空间几何', '立体几何', '线面', '面面'],
    targetDifficulty: 'hard',
    taskFamily: 'hard_spatial_multi_constraint_vector_reasoning',
    planTemplate: 'math_spatial_geometry_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 4,
    minimumIndependentEvidenceGroups: 3,
    minimumReasoningSteps: 4,
    minimumQuantitativeRelations: 2,
    requiresUniqueAnswer: true
  }
];

export const SUBJECT_PRACTICE_QUESTION_PLAN_TEMPLATES: SubjectPracticeQuestionPlanTemplate[] = [
  ...SUBJECT_PRACTICE_CHEMISTRY_QUESTION_PLAN_TEMPLATES,
  ...SUBJECT_PRACTICE_MATH_QUESTION_PLAN_TEMPLATES,
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'physics',
    productionCellId: '24',
    topicTitleIncludes: ['kinematics', '运动学'],
    targetDifficulty: 'basic',
    taskFamily: 'kinematics_basic_direct_relation',
    planTemplate: 'physics_kinematics_basic_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 2,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 2,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'math',
    productionCellId: 'line-relation-shadow-v1',
    topicTitleIncludes: ['line relation', 'line slope', '直线关系', '直线斜率'],
    targetDifficulty: 'basic',
    taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    representationType: 'text',
    minimumEvidenceSlots: 1,
    minimumIndependentEvidenceGroups: 1,
    minimumReasoningSteps: 1,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  },
  {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: 'physics',
    productionCellId: '19',
    topicTitleIncludes: ['几何光学', '光学', 'optics', 'lens', 'refraction'],
    targetDifficulty: 'medium',
    taskFamily: 'waves_optics_interference_refraction',
    planTemplate: 'physics_medium_optics_two_relation_v1',
    representationType: 'text',
    minimumEvidenceSlots: 3,
    minimumIndependentEvidenceGroups: 2,
    minimumReasoningSteps: 3,
    minimumQuantitativeRelations: 1,
    requiresUniqueAnswer: true
  }
];

function cleanText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function arrayFrom<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function displayText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function countTerms(text: string, terms: string[]) {
  return terms.reduce((sum, term) => sum + text.split(term).length - 1, 0);
}

function countPattern(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

function uniquePatternGroup(text: string, pattern: RegExp, groupIndex = 1) {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    values.push(match[groupIndex] ?? match[0] ?? '');
  }
  return uniqueNonEmpty(values);
}

const QUESTION_PLAN_ADHERENCE_TERMS = {
  operations: [
    'heat', 'measure', 'weigh', 'dilute', 'read', 'dropwise', 'transfer', 'cool', 'stir', 'filter', 'distill',
    '\u52a0\u70ed', '\u91cf\u53d6', '\u79f0\u91cf', '\u7a00\u91ca', '\u8bfb\u53d6', '\u6ef4\u52a0', '\u8f6c\u5165', '\u51b7\u5374', '\u6405\u62cc', '\u8fc7\u6ee4', '\u84b8\u998f'
  ],
  observations: [
    'observe', 'observation', 'color change', 'precipitate', 'bubbles', 'gas', 'warm', 'heat released', 'decolor',
    '\u89c2\u5bdf', '\u73b0\u8c61', '\u53d8\u8272', '\u6c89\u6dc0', '\u6c14\u6ce1', '\u53d1\u70ed', '\u892a\u8272', '\u751f\u6210'
  ],
  hypotheses: [
    'hypothesis', 'cause', 'reason', 'compare', 'exclude', 'control variable', 'discriminate',
    '\u5047\u8bbe', '\u539f\u56e0', '\u4e3b\u56e0', '\u5bf9\u6bd4', '\u6392\u9664', '\u63a7\u5236\u53d8\u91cf'
  ],
  reasoning: [
    'because', 'therefore', 'so', 'combine', 'derive', 'infer', 'exclude', 'satisfy',
    '\u7531', '\u7ed3\u5408', '\u8bf4\u660e', '\u6392\u9664', '\u56e0\u6b64', '\u6545', '\u53ef\u5f97', '\u63a8\u5f97', '\u540c\u65f6\u6ee1\u8db3'
  ],
  quantitativeChinese: ['\u76f8\u5bf9\u5206\u5b50\u8d28\u91cf', '\u8d28\u91cf\u5206\u6570', '\u71c3\u70e7', '\u500d'],
  reactionChinese: ['\u78b3\u9178\u6c22\u94a0', '\u6eb4', '\u94f6\u955c', '\u4e0e\u94a0', '\u916f\u5316', '\u6c34\u89e3', '\u9ad8\u9530\u9178\u94be', '\u892a\u8272'],
  gasControl: [
    'impurity', 'dry', 'drying', 'collect', 'collection', 'washing', 'wash', 'tail-gas', 'absorption', 'absorb', 'verify', 'test',
    '\u9664\u6742', '\u5e72\u71e5', '\u6536\u96c6', '\u9a8c\u6ee1', '\u68c0\u9a8c', '\u5c3e\u6c14', '\u6d17\u6c14', '\u6392\u7a7a\u6c14', '\u6392\u6c34', '\u9664\u53bb', '\u6d53\u786b\u9178', '\u78b1\u77f3\u7070', '\u77f3\u7070\u6c34', '\u6e7f\u6da6', '\u77f3\u854a'
  ],
  redoxConcepts: [
    'redox', 'oxidation', 'reduction', 'oxidizing agent', 'reducing agent', 'electron transfer', 'transferred electrons', 'oxidized', 'reduced', 'coefficient', 'balance',
    '\u6c27\u5316\u8fd8\u539f', '\u7535\u5b50\u8f6c\u79fb', '\u8f6c\u79fb\u7535\u5b50', '\u5316\u5408\u4ef7', '\u4ef7\u6001', '\u6c27\u5316\u5242', '\u8fd8\u539f\u5242', '\u88ab\u6c27\u5316', '\u88ab\u8fd8\u539f', '\u6c27\u5316\u4e3a', '\u8fd8\u539f\u4e3a', '\u914d\u5e73', '\u7cfb\u6570'
  ],
  redoxQuantChain: [
    'amount of substance', 'mole', 'mol', 'mmol', 'electron count', 'transferred electrons', 'complete reaction', 'excess', 'consumed', 'generated', 'ratio',
    '\u7269\u8d28\u7684\u91cf', '\u8f6c\u79fb\u7535\u5b50', '\u7535\u5b50\u6570', '\u6469\u5c14', '\u6bd4\u4e3a', '\u4e4b\u6bd4', '\u5b8c\u5168\u53cd\u5e94', '\u6070\u597d', '\u8fc7\u91cf', '\u8017\u5c3d', '\u6d88\u8017', '\u751f\u6210', '\u6807\u51c6\u72b6\u51b5'
  ]
};

function candidateText(candidate: unknown) {
  const record = (candidate && typeof candidate === 'object' && !Array.isArray(candidate))
    ? candidate as Record<string, unknown>
    : {};
  return displayText([
    record.prompt,
    record.explanation,
    JSON.stringify(record.options ?? []),
    JSON.stringify(record.optionMetadata ?? [])
  ].join('\n'));
}

function questionPlanAdherenceFeatures(candidate: unknown) {
  const text = candidateText(candidate);
  const lower = text.toLowerCase();
  const candidateRecord = recordFrom(candidate);
  const promptOnly = displayText(candidateRecord?.prompt);
  const promptAndExplanation = displayText([
    candidateRecord?.prompt,
    candidateRecord?.explanation
  ].join('\n'));
  const studentFacingPropertyText = displayText([
    candidateRecord?.prompt,
    ...(Array.isArray(candidateRecord?.options)
      ? candidateRecord.options.map((option) => cleanText(recordFrom(option)?.text))
      : [])
  ].join('\n'));
  const studentFacingDistinctPropertyText = studentFacingPropertyText
    .replace(/在(?:其|该函数的|函数的)?定义域内|on\s+(?:its|the)\s+domain/gi, ' ');
  const mathPropertySignals = countPattern(text, /(定义域|值域|单调|奇函数|偶函数|对称|区间|根式|根号|分母|不为\s*0|不能为\s*0|不等于\s*0|√|sqrt|radical|denominator|domain|range|monotonic|parity|symmetric|vertex|discriminant|判别式|顶点|开口)/gi);
  const mathStatementMarkers = countPattern(text, /(下列|判断|正确|错误|充分|必要|恒成立|which|statement|true|false|option)/gi);
  const mathTransformationSignals = [
    /代入|定义|比较|排除|结合|合并|分组|加权|标准化|转化|列式|联立|因此|故|可得|because|therefore|combine|standardize|transform|compare|exclude/.test(lower),
    /f\(-?x\)|f\s*\(\s*-x\s*\)|奇函数|偶函数|对称|parity|symmetric/.test(lower),
    /导数|配方|判别式|图像|区间|derivative|complete square|discriminant|graph|interval/.test(lower)
  ].filter(Boolean).length;
  const mathOrderingSignals = countPattern(text, /(比较|大小|排序|由小到大|由大到小|>|<|log_|sqrt|√|\^|指数|对数|幂|order|greater|less)/gi);
  const mathProbabilitySignals = countPattern(text, /(概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score)/gi);
  const mathProbabilityEventLabelCount = countPattern(promptAndExplanation, /事件\s*[ABCD]|事件[一二三四]|event\s*[ABCD]|p\s*\(\s*[ABCD]|(?:^|[；;。:：\s])(?:[ABCD])\s*[:：]/gi);
  const mathProbabilityNormalHardInteractionCueCount = countPattern(promptAndExplanation, /(双尾|单尾|尾概率|分位数|反标准化|标准化|对称性|标准正态分布函数|Φ\s*\(|z\s*=|均值\s*[μmu]|标准差\s*[σsigma]|求.{0,12}(?:均值|标准差|μ|σ)|低于.{0,24}占.{0,80}高于.{0,24}占|高于.{0,24}占.{0,80}低于.{0,24}占|two[- ]?tail|one[- ]?tail|tail probability|quantile|inverse standardi[sz]ation|standardi[sz]ation|symmetry|standard normal|z[-_ ]?score|mean.{0,20}standard deviation|standard deviation.{0,20}mean)/gi);
  const mathProbabilityHardInteractionCueCount = countPattern(promptAndExplanation, /(分类|分情况|情况[一二三四]|按.{0,12}分类|补事件|补集|条件概率|给定|交集|并集|互斥|独立|限制|不放回.{0,20}(?:顺序|依次|先|后)|case split|complement|conditional|given|intersection|union|mutually exclusive|independent|restriction)/gi)
    + mathProbabilityNormalHardInteractionCueCount;
  const mathProbabilitySingleResultRisk = mathProbabilitySignals > 0
    && mathProbabilityEventLabelCount < 2
    && mathProbabilityHardInteractionCueCount < 1
    && /(概率是多少|概率为多少|求.{0,8}概率|what is.{0,20}probability|probability.{0,20}of)/i.test(promptAndExplanation);
  const mathProbabilityEventListOnlyRisk = mathProbabilitySignals > 0
    && mathProbabilityEventLabelCount >= 3
    && mathProbabilityHardInteractionCueCount < 1
    && !/(分别计数|分别统计|联立|交集|并集|条件概率|补事件|分类|分情况|calculate p|compute p|case split|intersection|conditional|complement)/i.test(promptAndExplanation);
  const mathProbabilityConcreteFrameSignals = countPattern(promptAndExplanation, /([0-9０-９]\s*个|[0-9０-９]\s*张|[0-9０-９]\s*次|[0-9０-９]\s*名|袋中|盒中|球|骰子|硬币|扑克牌|编号|随机抽取|无放回|有放回|掷|取出|从.{0,20}中|共有|总数|样本空间为|N\s*\(|normal\s*\(|z\s*=|Φ\s*\()/gi);
  const mathProbabilityNormalMediumNoEventRisk = /(正态分布|标准正态|N\s*\(|normal distribution|standard normal|Φ\s*\()/i.test(promptAndExplanation)
    && /(说法|判断|正确|下列|which statement|correct)/i.test(promptAndExplanation)
    && !/(P\s*\(|概率|大于|小于|高于|低于|超过|不超过|介于|之间|落在|至少|至多|z\s*=|分位数|tail|above|below|greater than|less than|between|probability|quantile)/i.test(promptOnly);
  const mathProbabilityNormalReferenceTableRisk = /(正态分布|标准正态|normal distribution|standard normal)/i.test(promptAndExplanation)
    && /(参考|函数值|table|lookup)/i.test(promptAndExplanation)
    && countPattern(promptAndExplanation, /Φ\s*\([^)）]{1,18}[)）]\s*=/gi) >= 3;
  const mathProbabilityConceptOnlyRisk = mathProbabilitySignals > 0
    && ((mathProbabilityConcreteFrameSignals < 1 && /(关于|说法|概念|要求|条件|特征|which statement|concept|definition)/i.test(promptAndExplanation))
      || /(适合|适用).{0,12}(?:古典概型|概率)|(?:古典概型|概率).{0,12}(?:适合|适用)|直接计算概率/i.test(promptAndExplanation));
  const mathDerivativeSignals = countPattern(text, /(导数|微积分|切线|斜率|单调|极值|最值|参数|区间|f'\s*\(|derivative|calculus|tangent|slope|monotonic|extremum|parameter|interval)/gi);
  const mathDerivativeMediumDefinitionOnlyRisk = mathDerivativeSignals > 0
    && /(导数的定义|几何意义|可导|以下结论|必然成立|definition of derivative|geometric meaning|differentiable|must be true)/i.test(promptAndExplanation)
    && !/(已知函数|设函数|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|求|计算|切线方程|斜率为|单调区间|极值|最值|参数|区间\s*[\[（(]|given function|find|compute|tangent line|slope is|monotonic interval|extremum|parameter)/i.test(promptOnly);
  const mathDerivativeHardCoefficientSolveOnlyRisk = mathDerivativeSignals > 0
    && /(求\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}\s*的值|求出\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}|solve for\s*[a-z](?:\s*,\s*[a-z]){1,3})/i.test(promptAndExplanation)
    && /(经过点|切线斜率|斜率分别|passes through|tangent slopes?)/i.test(promptAndExplanation)
    && !/(单调|递增|递减|极值|最值|恒成立|取值范围|参数范围|不等式|区间.{0,20}(?:成立|单调|递增|递减)|sign chart|monotonic|extremum|range of|for all|inequality)/i.test(promptAndExplanation);
  const mathDerivativeBasicAdvancedOperationRisk = mathDerivativeSignals > 0
    && /(链式|复合函数|商法则|乘积法则|求二阶导|二阶导数|ln|log|e\^|sin|cos|tan|sqrt|√|\/\s*\(|1\s*\/|chain rule|composite function|quotient rule|product rule|second derivative|trigonometric)/i.test(promptAndExplanation);
  const mathVectorComplexSignals = countPattern(text, /(向量|复数|坐标|数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|投影|轨迹|vector|complex|coordinate|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|projection|locus|\|[^|\n]{0,40}(?:z|向量|\\vec|overline)[^|\n]{0,40}\||\\overline|\\operatorname\{Re\}|Re\s*\()/gi);
  const mathVectorComplexBasicDefinitionOnlyRisk = mathVectorComplexSignals > 0
    && /(定义|概念|以下结论|结论正确|关于.{0,16}(?:复数相等|向量).{0,16}(?:定义|结论)|若复数\s*a\+bi\s*=\s*c\+di|definition|concept|which statement)/i.test(promptAndExplanation)
    && !/[0-9０-９]/.test(promptOnly)
    && !/(求|计算|模长|数量积|点积|夹角|共轭|实部|虚部|平行|垂直|坐标为|z\s*=|find|compute|modulus|dot product|conjugate|real part|imaginary part|parallel|perpendicular)/i.test(promptOnly);
  const mathGeometrySignals = countPattern(text, /(直线|圆|圆锥曲线|椭圆|抛物线|双曲线|斜率|距离|中点|切线|弦|交点|方程|参数|对称|line|circle|conic|ellipse|parabola|hyperbola|slope|distance|midpoint|tangent|chord|intersection|equation|parameter|symmetry)/gi);
  const mathAnalyticGeometryDefinitionOnlyRisk = mathGeometrySignals > 0
    && /(下列方程|哪个方程|表示.{0,16}(?:椭圆|抛物线|双曲线|圆)|焦点.{0,12}[xy]\s*轴|which equation|represents? an? (?:ellipse|parabola|hyperbola|circle))/i.test(promptOnly)
    && !/(已知|求|计算|距离|斜率|中点|切线|弦|交点|联立|参数|对称|find|compute|distance|slope|midpoint|tangent|chord|intersection|parameter|symmetry)/i.test(promptOnly);
  const mathAnalyticGeometryBasicGeneralCircleRisk = mathGeometrySignals > 0
    && /(圆的一般方程|x[²^]\s*\+?\s*y[²^]|x\^2\s*\+\s*y\^2|general equation of (?:a )?circle)/i.test(promptAndExplanation)
    && /(圆心|半径|center|radius)/i.test(promptAndExplanation)
    && /(配方|complete square|completing square|x[²^].{0,40}[+-]\s*\d+\s*x.{0,40}y[²^].{0,40}[+-]\s*\d+\s*y)/i.test(promptAndExplanation);
  const mathAnalyticGeometryHardConicRelationOnlyRisk = mathGeometrySignals > 0
    && /(相同的焦点|共享焦点|离心率|∠|夹角|same foc(?:us|i)|eccentricit)/i.test(promptAndExplanation)
    && /(e_?1|e1|e_?2|e2|离心率)/i.test(promptAndExplanation)
    && !/(参数|取值范围|范围|切线|弦长|面积|最值|最大|最小|定点|轨迹|parameter|range|max|min|tangent|chord|area|locus)/i.test(promptAndExplanation);
  const mathElementaryFunctionSignals = countPattern(text, /(初等函数|指数|对数|幂函数|根式|定义域|值域|函数值|单调|图像|交点|不等式|elementary function|exponential|logarithm|power function|radical|domain|range|function value|monotonic|graph|intersection|inequality)/gi);
  const mathElementaryFunctionGenericClassificationRisk = mathElementaryFunctionSignals > 0
    && /(下列函数中|哪个函数|哪一个函数|which function)/i.test(promptOnly)
    && /(奇函数|偶函数|增函数|减函数|单调|定义域|值域|odd function|even function|increasing|decreasing|monotonic|domain|range)/i.test(promptOnly)
    && !/(已知|设|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|y\s*=|求|计算|比较|交点|不等式|given|find|compute|compare|intersection|inequality)/i.test(promptOnly);
  const mathElementaryFunctionBasicEquationSolveRisk = /(指数|对数|幂函数|log|lg|ln|exponential|logarithm|power function)/i.test(promptAndExplanation)
    && /(解方程|方程的解|求\s*x|求出\s*x|x\s*的值(?!域)|solve(?:\s+for)?\s*x|equation)/i.test(promptAndExplanation);
  const mathElementaryFunctionNamedFunctions = new Set(
    Array.from(promptAndExplanation.matchAll(/\b([fgh])\s*\(\s*x\s*\)\s*=/gi))
      .map((match) => cleanText(match[1]).toLowerCase())
      .filter(Boolean)
  );
  const mathElementaryFunctionBasicMultipleObjectRisk = /(指数|对数|幂函数|log|lg|ln|exponential|logarithm|power function)/i.test(promptAndExplanation)
    && (
      mathElementaryFunctionNamedFunctions.size >= 2
      || /(?:设|已知)\s*a\s*=.{0,100}\bb\s*=.{0,100}\bc\s*=/i.test(promptAndExplanation)
      || /\b[a-c]\s*[<＜>\uff1e]\s*[a-c]\s*[<＜>\uff1e]\s*[a-c]\b/i.test(promptAndExplanation)
    );
  const mathSequenceSignals = countPattern(text, /(数列|等差|等比|通项|递推|前\s*n\s*项和|公差|公比|单调|求和|sequence|arithmetic sequence|geometric sequence|recurrence|common difference|common ratio|partial sum)/gi);
  const mathSequenceGenericClassificationRisk = /(下列.{0,12}数列|通项公式.{0,16}(?:表示|是).{0,8}(?:等差|等比)数列|哪个.{0,8}(?:是|表示).{0,8}(?:等差|等比)数列|which sequence|which formula)/i.test(promptOnly)
    && !/(已知|设|a_?\s*\d+|a_\{?\s*n\s*\}?|S_?\s*\d+|S_\{?\s*n\s*\}?|公差\s*[d=]|公比\s*[q=]|求|计算|find|compute)/i.test(promptOnly);
  const mathStatisticsSignals = countPattern(text, /(平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted)/gi);
  const mathStatisticsBasicMultiStatisticComparisonRisk = mathStatisticsSignals >= 4
    && /(两个|两组|甲班|乙班|甲组|乙组|A组|B组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && /(判断|说法|正确|下列|which statement|correct)/i.test(promptAndExplanation);
  const mathStatisticsMediumPureLinearTransformRisk = mathStatisticsSignals > 0
    && /(线性变换|每个数据|每个数|y[_ᵢi]?\s*=|y_i\s*=|yᵢ\s*=|linear transform|each data)/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|替换|比较|两组|两个|甲组|乙组|取值范围|参数|使得|missing|unknown|adjust|remove|add|replace|compare|two groups|parameter|range)/i.test(promptAndExplanation);
  const mathStatisticsHardDirectCombinedVarianceRisk = mathStatisticsSignals > 0
    && /(甲组|乙组|两个|两组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(合并后.{0,12}方差|合并.{0,20}方差|combined variance|pooled variance)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|最大|最小|取值范围|使得|至少|至多|missing|unknown|adjust|remove|add|range|min|max|at least|at most)/i.test(promptAndExplanation);
  const mathSpatialSignals = countPattern(text, /(空间|立体|平面|线面|面面|长方体|棱锥|棱柱|法向量|二面角|体积|投影|垂直|平行|夹角|space|spatial|solid geometry|plane|line-plane|normal vector|dihedral|volume|projection|perpendicular|parallel|angle)/gi);
  const mathSpatialMediumMultiPropositionOvercomplexRisk = mathSpatialSignals > 0
    && /(四面体|长方体|棱锥|棱柱|顶点坐标分别|tetrahedron|cuboid|pyramid|prism|vertices)/i.test(promptAndExplanation)
    && /(四个命题|命题中|下列关于|说法正确|which statement)/i.test(promptAndExplanation)
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptOnly);
  const mathSpatialHardConceptOnlyRisk = mathSpatialSignals > 0
    && (/(下列关于空间几何位置关系|关于.{0,24}空间.{0,24}位置关系|说法正确|命题中|position relations?)/i.test(promptAndExplanation)
      || /(对称关系|对称变换|symmetry relation|symmetric transformation)/i.test(promptAndExplanation))
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptAndExplanation);
  const mathSpatialHardDirectCoordinateOnlyRisk = mathSpatialSignals > 0
    && /(对称点|坐标是多少|求.{0,12}坐标|关于.{0,12}(?:x轴|y轴|z轴|坐标轴|坐标平面).{0,20}(?:对称|坐标)|coordinate of|symmetric point)/i.test(promptAndExplanation)
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|方程|垂直|平行|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|equation|perpendicular|parallel)/i.test(promptAndExplanation);
  const mathHasExplicitParameterWord = /(参数|parameter)/i.test(promptAndExplanation);
  const mathHasParameterVariable = /(a\s*[,，、]\s*b\s*(?:[∈∊]\s*r|为实数|是实数|in\s*r)|[ab]\s*(?:[∈∊]\s*r|为实数|是实数|in\s*r))/i.test(promptAndExplanation);
  const mathHasParameterSolving = /(求出\s*[ab]|求\s*[ab]|[ab]\s*=|判别式|顶点|vertex|discriminant)/i.test(promptAndExplanation);
  const mathParameterInferenceRisk = mathHasExplicitParameterWord || (mathHasParameterVariable && mathHasParameterSolving);
  const mathParameterConstraintSignals = countPattern(promptAndExplanation, /(参数|parameter|a\s*[∈∊]\s*r|b\s*[∈∊]\s*r|为实数|是实数|in\s*r|判别式|顶点|对称轴|恒成立|有解|无解|唯一|区间|单调|vertex|axis|discriminant|constraint|unique|interval|monotonic)/gi);
  // A numbered condition must start at a text boundary. Values such as f'(-3)
  // and coordinates such as (2, 4) are mathematical data, not list markers.
  const mathEnumeratedConditionCount = countPattern(
    promptAndExplanation,
    /[①②③④⑤⑥⑦⑧⑨]|(?:^|[\s\n])([1-9])\s*[.)、]/g
  );
  const mathFunctionPropertyStackCount = countPattern(promptAndExplanation, /(定义域|值域|单调|递增|递减|奇函数|偶函数|奇偶|对称|有界|最值|极值|domain|range|monotonic|increasing|decreasing|parity|odd function|even function|symmetric|bounded|extremum)/gi);
  const mathFunctionDistinctPropertyCount = [
    /定义域|domain/i,
    /值域|range/i,
    /单调|递增|递减|monotonic|increasing|decreasing/i,
    /奇函数|偶函数|奇偶|parity|odd function|even function/i,
    /对称|对称轴|symmetric|axis/i,
    /开口|opening/i,
    /有界|最值|极值|最大值|最小值|bounded|extremum|maximum|minimum/i
  ].reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  const mathStudentFacingDistinctPropertyCount = [
    /定义域|domain/i,
    /值域|range/i,
    /单调|递增|递减|monotonic|increasing|decreasing/i,
    /奇函数|偶函数|奇偶|parity|odd function|even function/i,
    /对称|对称轴|symmetric|axis/i,
    /开口|opening/i,
    /有界|最值|极值|最大值|最小值|bounded|extremum|maximum|minimum/i
  ].reduce((count, pattern) => count + (pattern.test(studentFacingDistinctPropertyText) ? 1 : 0), 0);
  const mathStudentFacingFunctionPropertyOverComplex = /(分段|piecewise|任意|所有|恒成立|对任意|for all|any real|all real)/i.test(studentFacingDistinctPropertyText)
    || countPattern(studentFacingDistinctPropertyText, /(定义域|值域|单调(?:递增|递减)?|递增|递减|奇函数|偶函数|奇偶|对称|有界|最值|极值|domain|range|monotonic(?:ally)?(?:\s+(?:increasing|decreasing))?|increasing|decreasing|parity|odd function|even function|symmetric|bounded|extremum)/gi) >= 8;
  const mathFunctionObjectSignals = countPattern(promptAndExplanation, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi);
  const mathFunctionPointValueCount = countPattern(promptAndExplanation, /\b[fgh]\s*\(\s*-?(?:\d+|[a-z])\s*\)\s*=|[fgh]\s*\(\s*-?(?:\d+|[a-z])\s*\)\s*=/gi);
  const mathFunctionNamedPointCount = countPattern(promptOnly, /(?:点\s*)?[A-Z]\s*[（(]\s*[^,，)）]{1,24}\s*[,，]\s*[^)）]{1,24}\s*[)）]/g);
  const mathFunctionMultipleNamedPointsRisk = mathFunctionNamedPointCount >= 2;
  const mathBasicFunctionSolutionScaffoldRisk = /(?:按上述方法|求定义域时需|解题时|解题步骤|只需.{0,48}(?:代入|计算|比较|检查|判断)|先(?:检查|判断|计算|求|利用).{0,80}(?:再|然后).{0,48}(?:计算|判断|求|选择|比较))/i.test(promptOnly);
  const mathFunctionBasicMultiConstraintDomainRisk = /(定义域|domain)/i.test(promptAndExplanation)
    && /(√|sqrt|根式|根号|radical)/i.test(promptAndExplanation)
    && /(1\s*\/|分母|denominator|不能为\s*0|不为\s*0|≠\s*0|!=\s*0)/i.test(promptAndExplanation);
  const mathPureFunctionExternalContextRisk = (mathPropertySignals > 0 || mathOrderingSignals > 0 || mathElementaryFunctionSignals > 0)
    && /(实验|传感器|响应值|输入信号|信号处理|建模|模型输出|建模拟合|拟合|测量|描点法|小组用|利润|收益|成本|价格|销量|销售|人口|水位|温度|细菌|生物|金融|finance|financial|profit|revenue|cost|price|sales|population|water level|temperature|bacteria|biology|sensor|experiment|measurement|signal[- ]?processing|model[- ]?fitting|input signal|model output)/i.test(promptAndExplanation);
  const mathHardFunctionGenericConceptRisk = /(关于.{0,12}函数性质|函数性质.{0,12}命题|函数性质.{0,12}说法|which statement|which proposition)/i.test(promptOnly)
    && countPattern(promptOnly, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi) < 1;
  const mathHardConditionStack = mathEnumeratedConditionCount >= 4
    && /(满足|条件|若|已知[^。？]*满足|given[^.?!]*(?:satisfies|conditions?))/i.test(promptAndExplanation);
  const mathHeavyPropertyStack = mathFunctionPropertyStackCount >= 8
    && /(分段|任意|所有|恒成立|参数|讨论|分类讨论|piecewise|for all|parameter|case)/i.test(promptAndExplanation);
  const mathMediumFunctionPropertyOverComplex = mathHardConditionStack
    || mathHeavyPropertyStack
    || (mathFunctionPointValueCount >= 3 && mathFunctionPropertyStackCount >= 2)
    || /(分段|piecewise|当\s*x\s*[<>≤≥=]|x\s*[<>≤≥]\s*0.{0,80}x\s*[<>≤≥]\s*0)/i.test(promptAndExplanation)
    || /(任意|所有|恒成立|对任意|for all|any real|all real)/i.test(promptAndExplanation);
  const mathDerivativeBasicDomainTrapRisk = /(无定义|不存在|不可导|定义域|间断|undefined|does not exist|domain|discontinu)/i.test(promptAndExplanation)
    || /1\s*\/\s*\(\s*x\s*[-−]\s*[0-9]+\s*\).{0,80}x\s*=\s*[0-9]+/i.test(promptAndExplanation);
  const mathDerivativeBasicOverComplexRisk = mathDerivativeSignals > 0
    && (mathMediumFunctionPropertyOverComplex
      || mathDerivativeBasicAdvancedOperationRisk
      || mathParameterInferenceRisk
      || mathParameterConstraintSignals >= 2
      || mathEnumeratedConditionCount >= 2
      || /(左右导数|连续性|可导性|连续.*可导|可导.*连续|left[- ]?hand|right[- ]?hand|continuity|differentiability)/i.test(promptAndExplanation));
  const mathVectorComplexObjectCount = uniqueNonEmpty([
    ...uniquePatternGroup(promptAndExplanation, /(?:向量|vector)\s*([a-zA-Z](?:_\d+)?)/gi),
    ...uniquePatternGroup(promptAndExplanation, /\\vec\{?\s*([a-zA-Z])\s*\}?/gi),
    ...uniquePatternGroup(promptAndExplanation, /\b([a-zA-Z])\s*=\s*\([^)]{1,40}\)/g),
    ...uniquePatternGroup(promptAndExplanation, /\b(z_?\d*)\b/gi)
  ]).length;
  const mathVectorComplexRelationCount = countPattern(promptAndExplanation, /(数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|投影|argument|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|projection|\\overline|Re\s*\(|\|[^|\n]{0,40}\|)/gi);
  const mathVectorComplexCoordinateGeometryDriftRisk = /(点\s*[A-ZＰＱP-Q]|直线\s*[a-zl]|点到直线|过\s*[A-Z].{0,8}[A-Z]|投影点|projection point|point-to-line|line through)/i.test(promptAndExplanation)
    && (/(距离|斜率|交点|垂足|直线方程|distance|slope|intersection|foot of perpendicular|line equation)/i.test(promptAndExplanation)
      || /(方向向量|点\s*[A-ZＰＱP-Q].{0,24}在\s*(?:直线\s*)?[a-zl]|p\s*q\s*[·.]\s*d\s*=\s*0|projection|direction vector)/i.test(promptAndExplanation));
  const mathVectorComplexLocusParameterChainRisk = /(轨迹|参数方程|参数链|分类讨论|locus|parametric|case analysis)/i.test(promptAndExplanation)
    || (mathParameterConstraintSignals >= 3 && /(取值范围|范围|存在|任意|所有|恒成立|range of|exists|for all|all real)/i.test(promptAndExplanation));
  const mathVectorComplexOneStepFormulaRisk = mathVectorComplexSignals > 0
    && mathVectorComplexRelationCount <= 2
    && mathTransformationSignals < 1
    && !/(再|然后|结合|联立|代入.*再|therefore|then|combine|substitute.*then)/i.test(promptAndExplanation);
  const mathVectorComplexHardDirectMetricRisk = mathVectorComplexSignals > 0
    && /(等于多少|求|计算|find|compute|equals?)/i.test(promptAndExplanation)
    && /(数量积|点积|模长|模|长度|dot product|modulus|norm|length|\|[^|\n]{0,40}\|)/i.test(promptAndExplanation)
    && !/(轨迹|交点|参数|取值范围|辐角|幅角|平行|垂直|argument|locus|intersection|parameter|range of|parallel|perpendicular)/i.test(promptAndExplanation);
  const physicsKinematicsSignals = countPattern(text, /(运动学|位移|路程|位置|速度|速率|加速度|匀速|匀变速|斜率|端点|kinematics|displacement|distance|position|velocity|speed|acceleration|uniform motion|slope|endpoint)/gi);
  const physicsGraphSignals = countPattern(text, /(?:^|[^A-Za-z])(?:v|s|x|a)[-\s]?t(?![A-Za-z])|运动图像|图像|斜率|面积|交点|graph|slope|area|intersection/gi);
  const physicsUnitSignals = countPattern(text, /(?:\d+(?:\.\d+)?\s*(?:m\/s(?:\^2|²)?|s|m))(?![A-Za-z])|(?:^|[^A-Za-z])m\/s(?:\^2|²)?(?![A-Za-z])/gi);
  const physicsEquationSignals = countPattern(text, /(=|>|<|Δ|v\s*=|s\s*=|x\s*=|a\s*=|t\s*=)/gi);
  const physicsOpticsSignals = countPattern(text, /(光学|光线|透镜|凸透镜|凹透镜|焦距|物距|像距|实像|虚像|放大|缩小|倒立|正立|折射|入射角|折射角|折射率|薄透镜|optics|ray|lens|focal length|object distance|image distance|real image|virtual image|magnification|refraction|incidence angle|refractive index)/gi);
  const physicsOpticsRelationSignals = countPattern(text, /(1\s*\/\s*f|1\s*\/\s*u|1\s*\/\s*v|u\s*[<>]=?|v\s*[<>]=?|f\s*[<>]=?|n\s*=|sin\s*[（(]?\s*[ir]|斯涅尔|薄透镜公式|透镜公式|放大率|移动|靠近|远离|增大|减小|变大|变小|thin lens|snell|magnification|move|closer|farther|increase|decrease)/gi);
  const physicsUnseenDiagramRisk = /(如图|见图|下图|图中|as shown|in the figure|diagram below)/i.test(promptAndExplanation)
    && !/(文字描述|坐标|光轴|从左到右|主光轴|text description|coordinate|optical axis)/i.test(promptOnly);
  const chemistryClassificationSignals = countPattern(text, /(纯净物|混合物|单质|化合物|氧化物|酸|碱|盐|物质分类|物理变化|化学变化|新物质|组成|类别|pure substance|mixture|element|compound|oxide|acid|base|salt|classification|physical change|chemical change|new substance)/gi);
  const chemistryStateChangeEvidenceSignals = countPattern(text, /(生成|产生|形成|沉淀|气泡|变色|发光|放热|吸热|熔化|凝固|汽化|液化|升华|溶解|燃烧|锈蚀|分解|反应前|反应后|现象|证据|produces?|forms?|precipitate|bubbles?|color change|heat|melting|freezing|vaporization|condensation|sublimation|dissolv|burn|rust|decompos|before|after|observation|evidence)/gi);
  const chemistryDefinitionOnlyClassificationRisk = chemistryClassificationSignals > 0
    && /(下列说法|下列物质|属于|分类正确|概念|定义|which statement|which substance|belongs to|definition)/i.test(promptOnly)
    && chemistryStateChangeEvidenceSignals < 2;
  const chemistryPhConceptSignals = countPattern(text, /(pH|pOH|H[+⁺]|OH[-−⁻]|氢离子|氢氧根|酸性|碱性|酸碱|浓度|稀释)/gi);
  const chemistryPhOperationErrorSignals = countPattern(text, /(pH\s*试纸|容量瓶|移液管|量筒|滴定管|刻度线|定容|润湿|洗涤|仰视|俯视|残留|转移|配制|测定|volumetric|pipette|burette|meniscus|wet(?:ted|ting)?|rinse|prepar(?:e|ation)|measure(?:ment)?)/gi);
  const chemistryPhDirectionSignals = countPattern(text, /(偏高|偏低|升高|降低|增大|减小|变大|变小|体积偏|浓度偏|稀释|higher|lower|increase|decrease|dilut)/gi);
  const chemistryPhDirectCalculationRisk = /(?:求|计算).{0,24}(?:pH|pOH|氢离子|氢氧根)|(?:pH|pOH).{0,24}(?:是多少|数值|calculate)|(?:混合|中和).{0,60}(?:pH|酸碱性)/i.test(promptAndExplanation);
  return {
    operationWords: countTerms(lower, QUESTION_PLAN_ADHERENCE_TERMS.operations),
    observationWords: countTerms(lower, QUESTION_PLAN_ADHERENCE_TERMS.observations),
    hypothesisMarkers: countTerms(lower, QUESTION_PLAN_ADHERENCE_TERMS.hypotheses),
    reasoningConnectors: countTerms(lower, QUESTION_PLAN_ADHERENCE_TERMS.reasoning),
    quantitativeMarkers: countPattern(text, /(\d+(?:\.\d+)?\s*(?:mL|mol|g|L|%)|CO2|H2O|NaHCO3|Br2|H2|O2|C\d*H\d*O?\d*)/gi)
      + countTerms(text, QUESTION_PLAN_ADHERENCE_TERMS.quantitativeChinese),
    reactionClues: countPattern(text, /(NaHCO3|Br2|Na|KMnO4|CCl4|CO2|H2|Ag|Cu\(OH\)2)/gi)
      + countTerms(text, QUESTION_PLAN_ADHERENCE_TERMS.reactionChinese),
    gasSpeciesMarkers: countPattern(text, /(Cl2|Cl\u2082|NH3|NH\u2083|CO2|CO\u2082|O2|O\u2082|H2|H\u2082|SO2|SO\u2082|NO2|NO\u2082|NO|HCl)/gi),
    gasControlMarkers: countTerms(text, QUESTION_PLAN_ADHERENCE_TERMS.gasControl),
    redoxReactionMarkers: countPattern(text, /(Fe|Cu|Pb|MnO2|MnO\u2082|Cl2|Cl\u2082|H2S|H\u2082S|SO2|SO\u2082|I2|I\u2082|Br2|Br\u2082|KMnO4|KMnO\u2084|KClO3|KClO\u2083|H2SO4|H\u2082SO\u2084|HCl|e[-\u2212])/gi),
    redoxConceptMarkers: countTerms(text, QUESTION_PLAN_ADHERENCE_TERMS.redoxConcepts),
    redoxQuantitativeChainMarkers: countPattern(text, /(\d+(?:\.\d+)?\s*(?:mol|mmol|mL|L)|mol\s*[A-Za-z]|e[-\u2212]|n\s*\(|V\/n|\/n|\u2192|\u2191|>|<)/gi)
      + countTerms(text, QUESTION_PLAN_ADHERENCE_TERMS.redoxQuantChain),
    mathPropertySignals,
    mathStatementMarkers,
    mathTransformationSignals,
    mathOrderingSignals,
    mathParameterConstraintSignals,
    mathProbabilitySignals,
    mathProbabilityEventLabelCount,
    mathProbabilityNormalHardInteractionCueCount,
    mathProbabilityHardInteractionCueCount,
    mathProbabilityConcreteFrameSignals,
    mathProbabilityNormalMediumNoEventRisk,
    mathProbabilityNormalReferenceTableRisk,
    mathProbabilityConceptOnlyRisk,
    mathProbabilitySingleResultRisk,
    mathProbabilityEventListOnlyRisk,
    mathDerivativeSignals,
    mathDerivativeMediumDefinitionOnlyRisk,
    mathDerivativeHardCoefficientSolveOnlyRisk,
    mathDerivativeBasicAdvancedOperationRisk,
    mathVectorComplexSignals,
    mathVectorComplexBasicDefinitionOnlyRisk,
    mathGeometrySignals,
    mathAnalyticGeometryDefinitionOnlyRisk,
    mathAnalyticGeometryBasicGeneralCircleRisk,
    mathAnalyticGeometryHardConicRelationOnlyRisk,
    mathElementaryFunctionSignals,
    mathElementaryFunctionGenericClassificationRisk,
    mathElementaryFunctionBasicEquationSolveRisk,
    mathElementaryFunctionBasicMultipleObjectRisk,
    mathSequenceSignals,
    mathSequenceGenericClassificationRisk,
    mathStatisticsSignals,
    mathStatisticsBasicMultiStatisticComparisonRisk,
    mathStatisticsMediumPureLinearTransformRisk,
    mathStatisticsHardDirectCombinedVarianceRisk,
    mathSpatialSignals,
    mathSpatialMediumMultiPropositionOvercomplexRisk,
    mathSpatialHardConceptOnlyRisk,
    mathSpatialHardDirectCoordinateOnlyRisk,
    mathParameterInferenceRisk,
    mathOptionJudgement: /(下列|判断|正确|错误|选项|（\s*）|\(\s*\)|which|statement|true|false|option)/i.test(text),
    mathEnumeratedConditionCount,
    mathFunctionPropertyStackCount,
    mathFunctionDistinctPropertyCount,
    mathStudentFacingDistinctPropertyCount,
    mathStudentFacingFunctionPropertyOverComplex,
    mathFunctionObjectSignals,
    mathFunctionPointValueCount,
    mathFunctionNamedPointCount,
    mathFunctionMultipleNamedPointsRisk,
    mathBasicFunctionSolutionScaffoldRisk,
    mathFunctionBasicMultiConstraintDomainRisk,
    mathPureFunctionExternalContextRisk,
    mathHardFunctionGenericConceptRisk,
    mathMediumFunctionPropertyOverComplex,
    mathDerivativeBasicDomainTrapRisk,
    mathDerivativeBasicOverComplexRisk,
    mathVectorComplexObjectCount,
    mathVectorComplexRelationCount,
    mathVectorComplexCoordinateGeometryDriftRisk,
    mathVectorComplexLocusParameterChainRisk,
    mathVectorComplexOneStepFormulaRisk,
    mathVectorComplexHardDirectMetricRisk,
    physicsKinematicsSignals,
    physicsGraphSignals,
    physicsUnitSignals,
    physicsEquationSignals,
    physicsOpticsSignals,
    physicsOpticsRelationSignals,
    physicsUnseenDiagramRisk,
    chemistryClassificationSignals,
    chemistryStateChangeEvidenceSignals,
    chemistryDefinitionOnlyClassificationRisk,
    chemistryPhConceptSignals,
    chemistryPhOperationErrorSignals,
    chemistryPhDirectionSignals,
    chemistryPhDirectCalculationRisk
  };
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function positiveInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function boundedRepairLimit(value: unknown, fallback: number, hardMaximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return fallback;
  return Math.min(number, hardMaximum);
}

export function subjectPracticeQuestionPlanEnabled(env: Record<string, string | undefined> = process.env) {
  return cleanText(env[SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]) === 'true';
}

export function subjectPracticeQuestionPlanCellAllowed(input: {
  productionCellId?: number | string | null;
  env?: Record<string, string | undefined>;
}) {
  const raw = cleanText((input.env ?? process.env)[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]);
  if (!raw) return true;
  const cellId = cleanText(input.productionCellId);
  if (!cellId) return false;
  const allowed = raw.split(/[,;\s]+/).map(cleanText).filter(Boolean);
  return allowed.includes('*') || allowed.includes(cellId);
}

export function buildSubjectPracticeQuestionPlan(input: {
  subject?: string | null;
  topicId?: number | null;
  topicTitle?: string | null;
  productionCellId?: number | string | null;
  targetDifficulty?: string | null;
  taskFamily?: string | null;
  planTemplate?: string | null;
  requiredSinglePropertyTarget?: string | null;
  requiredElementaryFunctionClass?: string | null;
  exactLineRelationScope?: string | null;
  exactDerivativeScope?: string | null;
  exactPhysicsKinematicsScope?: string | null;
  exactChemistryRelationKind?: string | null;
  exactChemistryAnswerTarget?: string | null;
  scenarioSeed?: number | string | null;
  requestedScenarioFamilyId?: string | null;
}): SubjectPracticeQuestionPlan | null {
  const template = subjectPracticeQuestionPlanTemplateFor(input);
  if (!template) return null;
  const requestedTaskFamily = cleanText(input.taskFamily);
  const effectiveTaskFamily = requestedTaskFamily && subjectPracticeQuestionPlanTemplateSupportsTaskFamily(template, requestedTaskFamily)
    ? requestedTaskFamily
    : template.taskFamily;
  const requiredSinglePropertyTargetCandidate = cleanText(input.requiredSinglePropertyTarget);
  const requiredSinglePropertyTarget = ['function_value', 'domain', 'range', 'monotonicity'].includes(requiredSinglePropertyTargetCandidate)
    ? requiredSinglePropertyTargetCandidate
    : null;
  const requiredElementaryFunctionClassCandidate = cleanText(input.requiredElementaryFunctionClass);
  const requiredElementaryFunctionClass = ['logarithmic', 'exponential', 'radical', 'power'].includes(requiredElementaryFunctionClassCandidate)
    ? requiredElementaryFunctionClassCandidate
    : null;
  const common = {
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    subject: template.subject,
    topicId: input.topicId ?? null,
    topicTitle: input.topicTitle ?? null,
    productionCellId: input.productionCellId ?? template.productionCellId,
    targetDifficulty: template.targetDifficulty,
    taskFamily: effectiveTaskFamily,
    planTemplate: template.planTemplate,
    representationType: template.representationType,
    renderConstraints: { questionType: 'single_choice', requiresImage: false, externalContextAllowed: false },
    budget: {
      maxPlanRepairs: SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS,
      maxCandidateRepairs: SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS
    }
  };
  const scenarioContractForExactScope = (exactScope: string) => subjectPracticeScenarioContractFor({
    subject: template.subject,
    taskFamily: effectiveTaskFamily,
    planTemplate: template.planTemplate,
    exactScope,
    seed: input.scenarioSeed,
    scenarioFamilyId: input.requestedScenarioFamilyId
  }) ?? undefined;
  if (template.planTemplate === 'math_line_relation_direct_v1') {
    const allowedScopes = [
      'slope_from_two_distinct_points',
      'inclination_angle_from_line',
      'identify_parallel_or_perpendicular_line',
      'line_equation_from_point_and_slope'
    ];
    const requestedScope = cleanText(input.exactLineRelationScope);
    const exactLineRelationScope = allowedScopes.includes(requestedScope)
      ? requestedScope
      : 'slope_from_two_distinct_points';
    return {
      ...common,
      scenarioContract: scenarioContractForExactScope(exactLineRelationScope),
      renderConstraints: {
        ...common.renderConstraints,
        exactLineRelationScope,
        forbidFigureDependency: true,
        forbidMultiStageIntersection: true,
        forbidVerticalLineUndefinedSlope: true,
        forbidCoincidentOrMultipleCorrectOptions: true,
        canonicalLineForm: 'integer_primitive_ax_plus_by_plus_c_equals_zero_sign_fixed',
        finalAnswerShape: 'one_unique_slope_exact_angle_relation_or_line_equation'
      },
      evidenceSlots: [
        { id: 'e1', type: 'explicit_line_data', role: 'two_points_line_equation_or_point_and_slope', independentGroup: 'l1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'apply_exact_line_relation', inputs: ['e1'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'line_relation_round_trip', expression: 'direction or normal vector relation checks every visible option', variables: ['x', 'y', 'a', 'b', 'c'], roundTripCheck: true }
      ],
      misconceptionTargets: ['delta x and delta y reversed', 'reciprocal used instead of negative reciprocal', 'coincident line accepted as distinct parallel line', 'constant sign error'],
      answerDerivation: ['apply exactly one explicit slope, inclination, parallel/perpendicular, or point-slope relation'],
      uniquenessConditions: ['all visible options are parsed and exactly one satisfies the selected exact scope']
    };
  }
  if (template.planTemplate === 'competing_hypothesis_discrimination_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'observation', role: 'supports_hypothesis_a', independentGroup: 'g1' },
        { id: 'e2', type: 'observation', role: 'supports_hypothesis_b', independentGroup: 'g2' },
        { id: 'e3', type: 'observation', role: 'discriminating_evidence', independentGroup: 'g3' }
      ],
      hypotheses: ['candidate cause A', 'candidate cause B'],
      reasoningSteps: [
        { id: 'r1', operation: 'compare_observations', inputs: ['e1', 'e2'], output: 'candidate_causes' },
        { id: 'r2', operation: 'eliminate_hypothesis', inputs: ['candidate_causes', 'e3'], output: 'single_cause' },
        { id: 'r3', operation: 'derive_answer', inputs: ['single_cause'], output: 'answer' }
      ],
      quantitativeRelations: [],
      misconceptionTargets: ['single-rule lab safety judgement', 'confusing correlation with cause'],
      answerDerivation: ['independent observations discriminate between competing causes'],
      uniquenessConditions: ['only one option explains all observations']
    };
  }
  if (template.planTemplate === 'organic_formula_reaction_unique_structure_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'quantitative_combustion', role: 'formula_relation', independentGroup: 'q1' },
        { id: 'e2', type: 'reaction_evidence', role: 'reaction_functional_group', independentGroup: 'r1' },
        { id: 'e3', type: 'reaction_evidence', role: 'reaction_isomer_exclusion', independentGroup: 'r2' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'derive_formula', inputs: ['e1'], output: 'formula_candidates' },
        { id: 'r2', operation: 'infer_functional_group', inputs: ['formula_candidates', 'e2'], output: 'functional_group_candidates' },
        { id: 'r3', operation: 'eliminate_isomers', inputs: ['functional_group_candidates', 'e3'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'combustion_formula_round_trip', expression: 'C,H,O balance', variables: ['C', 'H', 'O'], roundTripCheck: true }
      ],
      misconceptionTargets: ['using one reaction clue only', 'formula without unique structure'],
      answerDerivation: ['formula plus two independent reaction clues leaves one structure'],
      uniquenessConditions: ['all distractor structures violate at least one independent clue']
    };
  }
  if (template.planTemplate === 'gas_impurity_control_competing_elimination_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'gas_property', role: 'target_gas_property', independentGroup: 'g1' },
        { id: 'e2', type: 'impurity_control', role: 'remove_or_dry_impurity', independentGroup: 'g2' },
        { id: 'e3', type: 'observation', role: 'discriminating_evidence', independentGroup: 'g3' }
      ],
      hypotheses: ['candidate gas-handling sequence A', 'candidate gas-handling sequence B'],
      reasoningSteps: [
        { id: 'r1', operation: 'identify_target_and_impurity', inputs: ['e1', 'e2'], output: 'gas_constraints' },
        { id: 'r2', operation: 'eliminate_incompatible_sequence', inputs: ['gas_constraints', 'e3'], output: 'valid_sequence' },
        { id: 'r3', operation: 'derive_answer', inputs: ['valid_sequence'], output: 'answer' }
      ],
      quantitativeRelations: [],
      misconceptionTargets: ['single gas property rule without impurity control', 'confusing drying, collection, and tail-gas absorption'],
      answerDerivation: ['target gas property plus impurity-control evidence leaves one valid sequence'],
      uniquenessConditions: ['only one option satisfies target gas, impurity removal or drying, and final test or absorption']
    };
  }
  if (template.planTemplate === 'redox_electron_transfer_quantitative_chain_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'redox_reaction', role: 'oxidation_state_change', independentGroup: 'r1' },
        { id: 'e2', type: 'redox_reaction', role: 'electron_transfer_direction', independentGroup: 'r2' },
        { id: 'e3', type: 'quantitative_relation', role: 'electron_or_coefficient_round_trip', independentGroup: 'q1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'derive_oxidation_state_changes', inputs: ['e1'], output: 'oxidized_and_reduced_species' },
        { id: 'r2', operation: 'link_electron_transfer', inputs: ['oxidized_and_reduced_species', 'e2'], output: 'agent_roles' },
        { id: 'r3', operation: 'round_trip_quantitative_check', inputs: ['agent_roles', 'e3'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'electron_transfer_or_coefficient_balance', expression: 'electron count or coefficient consistency', variables: ['oxidation_state', 'coefficient', 'electron_count'], roundTripCheck: true }
      ],
      misconceptionTargets: ['direct valence label only', 'agent role without electron-count or coefficient consistency'],
      answerDerivation: ['oxidation-state changes and electron transfer are checked against a quantitative relation'],
      uniquenessConditions: ['only one option matches oxidation state, agent role, and quantitative consistency']
    };
  }
  if (template.planTemplate === 'basic_redox_single_reaction_valence_rule_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'redox_reaction', role: 'single_species_valence_change', independentGroup: 'r1' },
        { id: 'e2', type: 'redox_concept', role: 'single_target_oxidation_reduction_or_agent_role', independentGroup: 'r1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'derive_single_species_electron_direction', inputs: ['e1'], output: 'species_change' },
        { id: 'r2', operation: 'derive_answer', inputs: ['species_change', 'e2'], output: 'answer' }
      ],
      quantitativeRelations: [],
      misconceptionTargets: ['confusing oxidation with reduction', 'confusing oxidizing agent with reducing agent', 'adding mole or coefficient chains to a basic item'],
      answerDerivation: ['one visible species valence or electron-direction change determines one concept judgement'],
      uniquenessConditions: ['only one option matches the named species and target redox concept']
    };
  }
  if (template.planTemplate === 'chemistry_medium_classification_evidence_v1') {
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        requireConcreteMaterialOrProcess: true,
        requireClassificationRule: true,
        requireTwoIndependentEvidenceGroups: true,
        forbidDefinitionOnlyClassification: true,
        forbidDirectChangeCountingOnly: true,
        maxIndependentRelations: 2,
        finalAnswerShape: 'classification_or_state_change_judgement_supported_by_two_concrete_evidence_groups',
        preferredPromptSkeletons: [
          '给出同一物质在两个连续操作前后的可观察事实，先判断是否生成新物质，再判断对应物质类别或变化类别',
          '给出两个样品的组成或转化证据，用一个分类规则排除只符合单条事实的选项'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'material_or_process', role: 'named_material_composition_or_first_operation', independentGroup: 'c1' },
        { id: 'e2', type: 'observable_evidence', role: 'before_after_observation_or_composition_evidence', independentGroup: 'c2' },
        { id: 'e3', type: 'classification_rule', role: 'new_substance_or_composition_based_classification_rule', independentGroup: 'c2' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'identify_concrete_material_or_process', inputs: ['e1'], output: 'material_frame' },
        { id: 'r2', operation: 'apply_observation_or_composition_evidence', inputs: ['material_frame', 'e2'], output: 'evidence_based_change_or_composition' },
        { id: 'r3', operation: 'apply_classification_rule_and_eliminate_options', inputs: ['evidence_based_change_or_composition', 'e3'], output: 'answer' }
      ],
      quantitativeRelations: [],
      misconceptionTargets: ['definition-only category recall', 'counting listed changes without evidence', 'treating state change as proof of a new substance'],
      answerDerivation: ['combine the concrete before/after or composition evidence with the named classification rule'],
      uniquenessConditions: ['only one option agrees with both evidence groups and the classification rule']
    };
  }
  if (template.planTemplate === 'basic_ph_measurement_preparation_error_v1') {
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        requirePhMeasurementOrPreparationOperation: true,
        requireQualitativeErrorDirection: true,
        requireOperationToConcentrationToPhCausalChain: true,
        forbidDirectPhCalculation: true,
        maxChemistryReasoningMoves: 2,
        finalAnswerShape: 'one_ph_or_concentration_high_low_or_unchanged_judgement',
        preferredPromptSkeletons: [
          '改变 pH 试纸的润湿或取样操作，判断测得 pH 相对实际值偏高、偏低或不变',
          '改变容量瓶定容、转移或洗涤操作，判断浓度及 pH 的偏差方向'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'experimental_operation_deviation', role: 'one_visible_ph_measurement_or_solution_preparation_operation', independentGroup: 'ph1' },
        { id: 'e2', type: 'qualitative_direction_evidence', role: 'operation_changes_concentration_or_h_oh_then_ph_direction', independentGroup: 'ph1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'causal_propagation_from_operation_to_concentration_or_h_oh_direction', inputs: ['e1'], output: 'concentration_direction' },
        { id: 'r2', operation: 'map_concentration_direction_to_ph_bias', inputs: ['concentration_direction', 'e2'], output: 'answer' }
      ],
      quantitativeRelations: [],
      misconceptionTargets: ['reverse meniscus error direction', 'treat pH paper wetting as no dilution', 'confuse acid and base pH direction', 'replace qualitative error judgement with direct pH calculation'],
      answerDerivation: ['follow operation deviation to concentration or H+/OH- direction, then to one pH bias judgement'],
      uniquenessConditions: ['only one option has the correct causal direction for the stated operation']
    };
  }
  if (template.planTemplate === 'chemistry_strong_acid_base_single_relation_v1') {
    const exactChemistryRelationKind = [
      'strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'
    ].includes(cleanText(input.exactChemistryRelationKind)) ? cleanText(input.exactChemistryRelationKind) : null;
    const exactChemistryAnswerTarget = ['ph_value', 'acid_base_character'].includes(cleanText(input.exactChemistryAnswerTarget))
      ? cleanText(input.exactChemistryAnswerTarget)
      : null;
    return {
      ...common,
      scenarioContract: scenarioContractForExactScope(exactChemistryRelationKind || 'unspecified_scope'),
      renderConstraints: {
        ...common.renderConstraints,
        completeDissociationOnly: true,
        allowedSpecies: ['HCl', 'HNO3', 'NaOH', 'KOH'],
        allowedRelationKinds: ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'],
        allowedAnswerTargets: ['ph_value', 'acid_base_character'],
        exactChemistryRelationKind: exactChemistryRelationKind || undefined,
        exactChemistryAnswerTarget: exactChemistryAnswerTarget || undefined,
        requireVisibleQuantitiesAndUnits: true,
        requireTemperatureConvention25C: true,
        forbidWeakPolyproticBufferHydrolysisActivityAndTitration: true,
        maxIndependentRelations: 1,
        forbidMultiStageModelChain: true,
        finalAnswerShape: 'one_numeric_ph_or_acidic_neutral_basic_judgement',
        preferredPromptSkeletons: [
          '给出一元强酸或一元强碱的初始 pH 和稀释倍数，只求最终 pH 或酸碱性',
          '给出强酸或强碱浓度、初始体积和稀释后总体积，只求最终 pH 或酸碱性',
          '给出一元强酸与一元强碱各自浓度和体积，比较物质的量后只求混合液 pH 或酸碱性'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'strong_acid_base_quantity', role: 'visible_initial_ph_or_concentration_and_volume', independentGroup: 'ph1' },
        { id: 'e2', type: 'dilution_or_neutralization_relation', role: 'one_complete_dissociation_relation', independentGroup: 'ph1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'compute_diluted_concentration_or_excess_moles', inputs: ['e1', 'e2'], output: 'final_h_or_oh_concentration' },
        { id: 'r2', operation: 'map_concentration_to_ph_or_character', inputs: ['final_h_or_oh_concentration'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'strong_acid_base_ph_round_trip', expression: 'dilution or excess-mole concentration maps to one pH/character', variables: ['concentration', 'volume', 'pH'], roundTripCheck: true }
      ],
      misconceptionTargets: ['using initial pH as the requested result', 'ignoring total volume after neutralization', 'treating weak or polyprotic species as complete one-to-one dissociation'],
      answerDerivation: ['one complete-dissociation dilution or neutralization relation determines one pH or acid-base character'],
      uniquenessConditions: ['exactly one option matches the independently recomputed pH or character']
    };
  }
  if (template.planTemplate === 'math_medium_function_two_move_reasoning_v1') {
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidPiecewise: true,
        forbidDomainSplitDefinitions: true,
        forbidUniversalQuantifierProofs: true,
        maxEnumeratedConditions: 2,
        maxFunctionPropertyStack: 2,
        maxFunctionObjects: 1,
        minMediumFunctionVisibleMoves: 2,
        forbidMediumFunctionExternalContextWrapper: true,
        forbidMediumFunctionPropertyStackInflation: true,
        finalAnswerShape: 'single_property_judgement_or_short_value_check',
        preferredPromptSkeletons: [
          '已知非分段函数 f(x)=... 和明确区间 I，先判断单调/最值/奇偶中的一项，再用一个端点值或反例排除选项',
          '给出一个二次/根式/对数函数及一个区间条件，只用一条函数性质加一条短验证完成选项判断；题干不得包装成实验、模型或现实应用场景'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'function_object', role: 'one_explicit_function_object_not_piecewise', independentGroup: 'p1' },
        { id: 'e2', type: 'function_property', role: 'one_domain_range_monotonicity_parity_or_symmetry_claim', independentGroup: 'p2' },
        { id: 'e3', type: 'short_verification_or_counterexample', role: 'one_interval_check_value_check_or_counterexample_for_option_discrimination', independentGroup: 'p2' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'read_single_function_object', inputs: ['e1'], output: 'function_representation' },
        { id: 'r2', operation: 'apply_one_visible_function_property', inputs: ['function_representation', 'e2'], output: 'property_result' },
        { id: 'r3', operation: 'use_one_short_check_to_eliminate_options', inputs: ['property_result', 'e3'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'function_interval_or_order_round_trip', expression: 'domain/range/monotonicity/order consistency', variables: ['x', 'f(x)', 'interval'], roundTripCheck: true }
      ],
      misconceptionTargets: ['one-step function substitution', 'single property statement without a short verification', 'parameter inference mixed into medium function judgement', 'piecewise or universal-quantifier condition stack that belongs in hard difficulty'],
      answerDerivation: ['one visible function property is checked by one short interval, value, or counterexample move before eliminating options; do not combine parity, monotonicity, boundedness, point values, and range claims in the same item'],
      uniquenessConditions: ['only one option satisfies the single function object, one property claim, and one short verification; the stem has at most two enumerated conditions and no piecewise/domain-split definition']
    };
  }
  if (template.planTemplate === 'math_medium_exp_log_ordering_chain_v1') {
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidGenericFunctionListClassification: true,
        forbidElementaryFunctionExternalContextWrapper: true,
        requireMediumElementaryConcreteExpressionRelation: true,
        requireExpLogOrderingArchetypeRotation: true,
        expLogOrderingArchetypes: [
          'reference_interval_anchors',
          'common_base_or_exponent_transform',
          'inverse_monotonicity_bridge',
          'pairwise_identity_plus_bound'
        ],
        minimumStructuralAxesChanged: 2,
        forbidRepeatedMixedLogRootPowerTriple: true,
        maxFunctionObjects: 3,
        maxIndependentRelations: 2,
        finalAnswerShape: 'bounded_expression_relation_or_interval_judgement',
        preferredPromptSkeletons: [
          '用参考点 0/1/2 或相邻整数区间分离三个具体表达式，得到唯一严格次序',
          '先将至少两个表达式化为同底数、同指数或同次幂，再用一个独立界估排入第三个值',
          '利用一组具体指数—对数互逆关系或精确恒等变换，再补一步非小数界估完成排序'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'value_bound', role: 'logarithm_or_exponent_reference_bound', independentGroup: 'b1' },
        { id: 'e2', type: 'value_bound', role: 'power_or_root_reference_bound', independentGroup: 'b2' },
        { id: 'e3', type: 'ordering_check', role: 'strict_order_discrimination', independentGroup: 'b3' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'bound_each_expression', inputs: ['e1', 'e2'], output: 'comparable_intervals' },
        { id: 'r2', operation: 'compare_interval_order', inputs: ['comparable_intervals', 'e3'], output: 'strict_order' },
        { id: 'r3', operation: 'derive_answer', inputs: ['strict_order'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'exp_log_power_bound_round_trip', expression: 'log/exponent/root values fall in separated intervals', variables: ['a', 'b', 'c'], roundTripCheck: true }
      ],
      misconceptionTargets: ['reversing log base/value order', 'confusing exponent and root magnitudes', 'using decimals without interval evidence'],
      answerDerivation: ['each expression is bounded, then the separated bounds force one strict order'],
      uniquenessConditions: ['only one option matches the interval-backed strict ordering']
    };
  }
  if (template.planTemplate === 'math_medium_function_parameter_constraint_v1') {
    return {
      ...common,
      evidenceSlots: [
        { id: 'e1', type: 'parameter_condition', role: 'parameter_or_transformed_expression', independentGroup: 'p1' },
        { id: 'e2', type: 'function_property', role: 'vertex_discriminant_domain_or_monotonicity_constraint', independentGroup: 'p2' },
        { id: 'e3', type: 'option_elimination', role: 'unique_parameter_result_or_statement', independentGroup: 'p3' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'extract_parameter_condition', inputs: ['e1'], output: 'parameter_constraint' },
        { id: 'r2', operation: 'apply_function_property_constraint', inputs: ['parameter_constraint', 'e2'], output: 'admissible_parameter_set' },
        { id: 'r3', operation: 'eliminate_options_or_substitute_result', inputs: ['admissible_parameter_set', 'e3'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'parameter_constraint_round_trip', expression: 'parameter result satisfies the stated function property and rejects distractors', variables: ['a', 'b', 'x'], roundTripCheck: true }
      ],
      misconceptionTargets: ['solving a parameter from one condition only', 'using vertex or discriminant without checking the stated interval/property', 'accepting multiple parameter values as a unique answer'],
      answerDerivation: ['a parameter condition is combined with a function property constraint before option elimination'],
      uniquenessConditions: ['only one option satisfies the parameter constraint and the function property when substituted back']
    };
  }
  if (template.planTemplate === 'math_probability_counting_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const mediumPlan = template.targetDifficulty === 'medium';
    const basicPlan = template.targetDifficulty === 'basic';
    const normalDistributionPlan = /normal|正态|z[-_ ]?score|standard/i.test([cleanText(input.topicTitle), effectiveTaskFamily].join(' '));
    const slotLimit = basicPlan ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        requireConcreteSampleSpaceForBasic: !hardPlan && !mediumPlan,
        forbidBasicProbabilityTargetProfileInflation: basicPlan,
        minProbabilityReasoningLayers: hardPlan ? 3 : mediumPlan ? 2 : 1,
        requireHardProbabilityRestrictionRoundTrip: hardPlan,
        forbidSingleResultOnly: !hardPlan && mediumPlan,
        requireHardInteractionCue: hardPlan,
        forbidEventListOnly: hardPlan,
        requireNormalDistributionEvidence: normalDistributionPlan,
        requireVisibleStandardizationOrPhiRelation: normalDistributionPlan && !basicPlan,
        forbidLargeNormalReferenceTable: normalDistributionPlan && hardPlan,
        preferredPromptSkeletons: normalDistributionPlan
          ? hardPlan
            ? [
              '给出 X~N(mu,sigma^2) 和两个尾部/区间概率条件，先标准化再反推阈值或参数',
              '给出标准正态的对称/尾部关系和一个概率约束，完成一次反标准化并回代检查'
            ]
            : mediumPlan
              ? [
                '给出 X~N(mu,sigma^2)、一个阈值和一个 Phi/z 值，先标准化再判断区间概率',
                '给出标准正态变量 Z 与一个区间，结合对称性或查表值判断概率关系'
              ]
              : [
                '给出 X~N(mu,sigma^2) 和一个阈值事件，判断哪个 z 值或单侧概率说法正确',
                '给出标准正态 Z 与一个对称区间事件，判断 P(-a<Z<a) 或尾部概率说法'
              ]
          : hardPlan
            ? [
              '从有限样本空间中不放回抽取，先分情况/补事件，再加入至少/至多或顺序限制判断概率关系',
              '给出两个相关事件，计算交集/条件概率并用限制条件排除错误选项'
            ]
            : mediumPlan
              ? [
                '袋中/牌组/骰子给出总数，定义事件 A 与事件 B，比较 P(A)、P(B) 或 P(A∩B)',
                '先列总样本空间，再用补事件或两种情况得到一个概率关系'
              ]
              : [
                '袋中有 m 个红球和 n 个白球，随机取 1 个，给出一个事件并判断哪个概率说法正确',
                '掷一枚骰子或抽一张编号卡，给出一个具体事件并判断有利数/总数对应的概率说法'
              ],
        finalAnswerShape: hardPlan
          ? normalDistributionPlan
            ? 'inverse_standardization_tail_or_mu_sigma_probability_relation'
            : 'case_split_conditional_or_restriction_probability_relation'
          : mediumPlan
            ? normalDistributionPlan
              ? 'standardization_interval_probability_or_z_score_relation'
              : 'two_connected_event_or_counting_relation'
            : normalDistributionPlan
              ? 'one_threshold_interval_or_z_score_probability_claim_judgement'
              : 'one_clean_sample_space_event_probability_claim_judgement'
      },
      evidenceSlots: [
        { id: 'e1', type: 'sample_space_or_distribution', role: 'visible_probability_context', independentGroup: 'p1' },
        { id: 'e2', type: 'event_condition', role: 'counting_or_interval_condition', independentGroup: template.targetDifficulty === 'basic' ? 'p1' : 'p2' },
        { id: 'e3', type: 'combination_or_relation', role: 'second_case_complement_conditional_or_standardization', independentGroup: 'p3' },
        { id: 'e4', type: 'hard_constraint', role: 'case_split_restriction_interaction_parameter_or_conditional_relation', independentGroup: 'p4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'define_sample_space_or_standardize_distribution', inputs: ['e1'], output: 'probability_frame' },
        { id: 'r2', operation: 'apply_event_condition', inputs: ['probability_frame', 'e2'], output: 'intermediate_probability_or_count' },
        { id: 'r3', operation: 'combine_cases_or_relations', inputs: ['intermediate_probability_or_count', 'e3'], output: 'restricted_probability_or_relation' },
        { id: 'r4', operation: 'check_hard_constraint_round_trip', inputs: ['restricted_probability_or_relation', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'probability_count_or_interval_round_trip', expression: 'favorable cases or interval probability over total/sample distribution', variables: ['event', 'sample_space', 'probability'], roundTripCheck: true },
        { id: 'q2', type: 'hard_probability_constraint_round_trip', expression: 'case split, complement, conditional, parameter, or combined interval condition checks back against every option', variables: ['case', 'condition', 'parameter', 'probability'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: [
        'direct favorable/total count without stated sample space',
        'single-event probability only for a medium target',
        'same-color or favorable-count single result used as a medium target without a second event relation',
        'hard probability that only lists events A/B/C/D without case split, conditional, complement, or restriction reasoning',
        'larger numbers used to fake hard difficulty without case split or interacting restriction',
        'missing complement or conditional restriction',
        'normal-distribution wording without standardization or interval evidence'
      ],
      answerDerivation: hardPlan
        ? ['the probability frame, event condition, case split/complement/conditional relation, and hard interacting restriction are all combined before option elimination']
        : template.targetDifficulty === 'medium'
        ? ['the probability frame and first event condition are combined with a second visible event relation before selecting the answer; do not use a single-event probability as the whole item']
        : ['the probability frame and event condition determine one count, interval, or relation-backed probability'],
      uniquenessConditions: ['only one option matches all visible event conditions and probability relations']
    };
  }
  if (template.planTemplate === 'math_vector_complex_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const mediumPlan = template.targetDifficulty === 'medium';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        selfContainedCoordinatesOrComplexExpression: true,
        requireVisibleCoordinateModulusDotConjugateOrAngleRelation: true,
        maxVectorOrComplexObjects: basicPlan ? 1 : mediumPlan ? 2 : 3,
        maxIndependentRelations: basicPlan ? 1 : mediumPlan ? 2 : 3,
        forbidHiddenDiagramDependency: true,
        forbidCoordinateGeometryDistanceProjectionShell: !basicPlan,
        forbidLocusOrParameterChain: !hardPlan,
        forbidOneStepFormulaOnly: !basicPlan,
        forbidHardDirectMetricOnly: hardPlan,
        requireHardVectorComplexTwoVisibleRelations: hardPlan,
        preferredPromptSkeletons: basicPlan
          ? [
            '已知复数 z=a+bi，求 |z|、共轭或实部/虚部中的一个',
            '已知一个二维向量 a=(m,n)，求模长或与坐标轴的一个直接关系'
          ]
          : mediumPlan
            ? [
              '已知两个二维向量 a,b，先算数量积/模长，再判断垂直、夹角或短性质选项',
              '已知复数 z=a+bi 及其向量表示，结合模长/共轭/实部中的两条关系判断选项',
              '已知两个复数或向量对象，比较模长/数量积/夹角/共轭中的两个短关系并判断选项'
            ]
            : [
              '复数或向量含一个参数，必须同时给出模长/共轭/垂直/夹角中的两类可见关系，再排除选项',
              '先由一个向量/复数关系定参数，再用第二个角度/实部/点积关系作唯一判断；不要只求一个数量积或模长'
            ],
        finalAnswerShape: basicPlan
          ? 'single_metric_or_operation_value'
          : mediumPlan
            ? 'two_relation_short_claim_property_judgement_not_raw_metric_result'
            : 'multi_relation_parameter_locus_or_elimination_judgement'
      },
      evidenceSlots: [
        { id: 'e1', type: 'vector_or_complex_object', role: 'coordinate_complex_or_vector_definition', independentGroup: 'v1' },
        { id: 'e2', type: 'relation', role: 'parallel_perpendicular_modulus_conjugate_argument_dot_product_or_plane_normal_relation', independentGroup: template.targetDifficulty === 'basic' ? 'v1' : 'v2' },
        { id: 'e3', type: 'constraint_combination', role: 'parameter_locus_angle_or_intersection_condition', independentGroup: 'v3' },
        { id: 'e4', type: 'hard_constraint', role: 'second_relation_metric_locus_or_parameter_check', independentGroup: 'v4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'translate_to_coordinates_or_complex_relation', inputs: ['e1'], output: 'algebraic_representation' },
        { id: 'r2', operation: 'apply_relation_or_metric', inputs: ['algebraic_representation', 'e2'], output: 'intermediate_relation' },
        { id: 'r3', operation: 'combine_constraint_or_prepare_option_elimination', inputs: ['intermediate_relation', 'e3'], output: 'restricted_vector_or_complex_relation' },
        { id: 'r4', operation: 'check_second_relation_and_eliminate_options', inputs: ['restricted_vector_or_complex_relation', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'vector_or_complex_round_trip', expression: 'coordinate, modulus, dot product, conjugate, argument, or perpendicular/parallel relation', variables: ['vector', 'z', 'parameter'], roundTripCheck: true },
        { id: 'q2', type: 'hard_vector_complex_constraint_round_trip', expression: 'second relation, locus, intersection, or parameter constraint checks the same answer', variables: ['vector', 'z', 'parameter', 'locus'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: ['single dot product or modulus calculation labelled medium/hard', 'raw coordinate/length result used instead of a relation/property claim for a medium concept-judgement target', 'coordinate-geometry point-line distance or projection shell used instead of vector/complex relations', 'generic spatial line-plane concept judgement', 'ignoring perpendicular/parallel or conjugate relation', 'hidden diagram or parameter/locus computation absent from stem'],
      answerDerivation: hardPlan
        ? ['the vector or complex representation is checked against two visible relations or one relation plus a parameter/locus constraint before selecting the answer']
        : basicPlan
          ? ['one coordinate, vector, or complex expression is checked by one visible operation before selecting the answer']
          : ['the vector or complex representation is combined with a second visible relation or metric check before selecting the correct short statement; do not ask for a raw coordinate, length, hidden diagram, locus, or parameter chain to create difficulty'],
      uniquenessConditions: [basicPlan
        ? 'only one option satisfies the stated coordinate/vector/complex operation'
        : mediumPlan
          ? 'only one short claim option satisfies the two visible vector or complex relations, with no unstated diagram, raw metric-only answer, or parameter/locus dependency'
          : 'only one option satisfies all stated relations, including the explicit hard constraint']
    };
  }
  if (template.planTemplate === 'math_derivative_condition_chain_v1') {
    const basicPlan = template.targetDifficulty === 'basic';
    const mediumPlan = template.targetDifficulty === 'medium';
    const exactDerivativeScope = basicPlan
      && (!cleanText(input.exactDerivativeScope)
        || cleanText(input.exactDerivativeScope) === 'direct_polynomial_value')
      ? 'direct_polynomial_value'
      : undefined;
    return {
      ...common,
      scenarioContract: basicPlan && exactDerivativeScope
        ? scenarioContractForExactScope(exactDerivativeScope)
        : undefined,
      renderConstraints: {
        ...common.renderConstraints,
        exactDerivativeScope,
        forbidBasicDerivativeComplexity: basicPlan,
        forbidBasicDerivativeDomainTrap: basicPlan,
        forbidBasicDerivativeTargetProfileInflation: basicPlan,
        maxBasicDerivativeReasoningMoves: basicPlan ? 1 : undefined,
        forbidMediumDerivativeDefinitionOnly: mediumPlan,
        minDerivativeLinkedMoves: basicPlan ? 1 : mediumPlan ? 2 : 3,
        forbidPiecewiseParameterContinuityChain: !mediumPlan,
        forbidDerivativeOneStepOnly: !basicPlan,
        requireVisibleDerivativeConditionChain: !basicPlan,
        preferredPromptSkeletons: basicPlan
          ? [
            '已知 f(x)=...，求 f\'(a) 的值',
            '已知 f(x)=...，判断 f(x) 在一个给定区间上的单调性'
          ]
          : mediumPlan
            ? [
              '已知 f(x)=...，先求/给出 f\'(x)，再结合一个区间单调性或极值条件判断选项',
              '给出切线斜率条件，再用导数符号判断一个区间或极值结论'
            ]
            : [
              '已知 f(x)=... 含参数，结合导数符号表、区间结论和极值/切线条件排除选项',
              '先建立 f\'(x) 的符号变化，再联立参数或切线约束得到唯一判断'
            ],
        finalAnswerShape: basicPlan
          ? 'single_derivative_value_slope_or_sign_fact_no_domain_trap'
          : mediumPlan
            ? 'two_move_derivative_condition_judgement'
            : 'sign_interval_plus_constraint_derivative_chain'
      },
      evidenceSlots: [
        { id: 'e1', type: 'function_or_derivative_object', role: 'function_derivative_tangent_or_interval_definition', independentGroup: 'd1' },
        { id: 'e2', type: 'condition', role: 'tangent_slope_monotonicity_extremum_or_parameter_condition', independentGroup: template.targetDifficulty === 'basic' ? 'd1' : 'd2' },
        { id: 'e3', type: 'second_condition', role: 'linked_interval_extremum_intersection_or_sign_condition', independentGroup: 'd3' }
      ].slice(0, template.targetDifficulty === 'basic' ? 2 : 3),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'differentiate_or_read_derivative_condition', inputs: ['e1'], output: 'derivative_relation' },
        { id: 'r2', operation: 'apply_tangent_monotonicity_or_parameter_condition', inputs: ['derivative_relation', 'e2'], output: 'intermediate_constraint' },
        { id: 'r3', operation: 'combine_second_condition_or_eliminate_option', inputs: ['intermediate_constraint', 'e3'], output: 'answer' }
      ].slice(0, template.targetDifficulty === 'basic' ? 2 : 3),
      quantitativeRelations: [
        { id: 'q1', type: 'derivative_condition_round_trip', expression: 'derivative, tangent, monotonicity, extremum, interval, or parameter condition', variables: ['x', 'f(x)', "f'(x)", 'parameter'], roundTripCheck: true }
      ],
      misconceptionTargets: [
        'single derivative value labelled medium/hard',
        'basic derivative inflated into piecewise, parameter, continuity, or undefined-domain trap',
        'raw tangent slope without checking the tangent point or interval',
        'medium derivative target reduced to f\'(a) or one-step substitution',
        'hard derivative target without sign chart, interval conclusion, and parameter/extremum/tangent constraint',
        'parameter answer without derivative sign or extremum evidence'
      ],
      answerDerivation: template.targetDifficulty === 'hard'
        ? ['differentiate or read the derivative, analyze sign/interval behavior, then combine a parameter, tangent, or extremum constraint before selecting the answer']
        : template.targetDifficulty === 'medium'
        ? ['differentiate or read the derivative, then use one tangent, interval, extremum, or sign condition before option elimination; do not stop at a derivative value']
        : ['differentiate or read exactly one derivative value, tangent slope, or one-interval sign fact; do not use piecewise, parameter, continuity, or undefined-domain trap shells'],
      uniquenessConditions: ['only one option satisfies the derivative/tangent/interval condition when checked back']
    };
  }
  if (template.planTemplate === 'math_analytic_geometry_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidDefinitionOnlyConicClassification: !basicPlan,
        forbidGeneralCircleCompletionForBasic: basicPlan,
        requireHardAnalyticGeometrySecondConstraint: hardPlan,
        forbidHardAnalyticGeometryConicRelationOnly: hardPlan,
        maxIndependentRelations: basicPlan ? 1 : hardPlan ? 3 : 2,
        finalAnswerShape: basicPlan
          ? 'one_direct_coordinate_geometry_metric_or_substitution'
          : hardPlan
            ? 'multi_relation_analytic_geometry_unique_judgement'
            : 'two_relation_position_metric_or_conic_judgement',
        preferredPromptSkeletons: basicPlan
          ? [
            '给出直线方程和一个点，求斜率、截距或点到直线距离中的一个',
            '给出圆心和半径或圆方程标准式，求一条弦长/切线/点代入判断'
          ]
          : hardPlan
            ? [
              '直线与圆/圆锥曲线方程同时给出，加入参数、切线、弦长或范围条件后排除选项',
              '先由交点/距离/切线关系建立方程，再用第二个面积/范围/参数约束唯一判断'
            ]
            : [
              '给出直线和圆的方程，先判断位置关系，再求弦长、距离或切线条件',
              '给出圆锥曲线方程和一条直线/点，结合交点或对称关系判断选项'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'geometry_object', role: 'line_circle_conic_or_point_definition', independentGroup: 'g1' },
        { id: 'e2', type: 'position_or_metric_relation', role: 'slope_distance_tangent_chord_intersection_or_symmetry', independentGroup: template.targetDifficulty === 'basic' ? 'g1' : 'g2' },
        { id: 'e3', type: 'constraint_combination', role: 'parameter_conic_or_multi_relation_condition', independentGroup: 'g3' }
      ].slice(0, template.targetDifficulty === 'basic' ? 2 : 3),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'translate_geometry_to_equation_or_metric', inputs: ['e1'], output: 'algebraic_geometry_relation' },
        { id: 'r2', operation: 'apply_position_or_metric_condition', inputs: ['algebraic_geometry_relation', 'e2'], output: 'intermediate_geometry_result' },
        { id: 'r3', operation: 'combine_constraint_or_eliminate_option', inputs: ['intermediate_geometry_result', 'e3'], output: 'answer' }
      ].slice(0, template.targetDifficulty === 'basic' ? 2 : 3),
      quantitativeRelations: [
        { id: 'q1', type: 'analytic_geometry_round_trip', expression: 'line/circle/conic equation plus distance, tangent, chord, intersection, or parameter relation', variables: ['x', 'y', 'line', 'circle', 'parameter'], roundTripCheck: true }
      ],
      misconceptionTargets: ['unseen diagram dependency', 'single slope/distance substitution labelled medium/hard', 'using conic wording without a second algebraic relation'],
      answerDerivation: ['the geometry object is translated into algebraic evidence, then checked against a metric or position relation'],
      uniquenessConditions: ['only one option satisfies the self-contained algebraic geometry conditions']
    };
  }
  if (template.planTemplate === 'math_function_property_by_difficulty_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidPiecewise: !hardPlan,
        forbidDomainSplitDefinitions: !hardPlan,
        forbidUniversalQuantifierProofs: !hardPlan,
        maxEnumeratedConditions: basicPlan ? 1 : hardPlan ? 4 : 2,
        maxFunctionPropertyStack: basicPlan ? 1 : hardPlan ? 4 : 2,
        maxFunctionObjects: 1,
        forbidBasicFunctionSolutionScaffold: basicPlan,
        forbidBasicFunctionMixedRadicalAndDenominatorDomain: basicPlan,
        forbidHardFunctionGenericConceptOnly: hardPlan,
        minHardFunctionVisibleConstraints: hardPlan ? 2 : undefined,
        finalAnswerShape: basicPlan
          ? 'one_direct_function_property_or_value'
          : hardPlan
            ? 'concrete_function_multi_condition_unique_judgement'
            : 'single_property_judgement_with_one_short_verification',
        preferredPromptSkeletons: basicPlan
          ? [
            '给出一个显式函数 f(x)（一次/二次/幂函数），只问一个函数值、顶点/对称轴、单调区间或一个点是否在图像上',
            '给出一个只含单一根式或单一分母约束的函数，只判断一个直接定义域条件；不要同时混合根式与分母约束'
          ]
          : hardPlan
            ? [
              '已知具体函数 f(x)=... 和一个区间/参数/判别式条件，先建立性质约束，再回代检查唯一选项',
              '给出具体函数与两个独立条件（如单调区间+参数范围），完成多条件唯一判断；题干不得只是“关于函数性质”的泛泛命题'
            ]
            : [
              '一个非分段函数 + 一个区间性质 + 一个短值或反例检查，判断选项',
              '二次/根式/对数函数在给定区间上先判性质，再核对一个端点或交点'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'function_object', role: 'explicit_function_definition_domain_or_graph_feature', independentGroup: 'f1' },
        { id: 'e2', type: 'function_property', role: 'domain_range_monotonicity_symmetry_or_extremum_condition', independentGroup: template.targetDifficulty === 'basic' ? 'f1' : 'f2' },
        { id: 'e3', type: 'second_property_or_transformation', role: 'interval_parameter_discriminant_or_composition_condition', independentGroup: 'f3' },
        { id: 'e4', type: 'hard_constraint', role: 'multi_condition_option_elimination_or_parameter_round_trip', independentGroup: 'f4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'read_function_object', inputs: ['e1'], output: 'function_representation' },
        { id: 'r2', operation: 'apply_visible_function_property', inputs: ['function_representation', 'e2'], output: 'property_result' },
        { id: 'r3', operation: 'combine_second_property_or_transformation', inputs: ['property_result', 'e3'], output: 'restricted_function_result' },
        { id: 'r4', operation: 'check_hard_condition_and_eliminate_options', inputs: ['restricted_function_result', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'function_property_round_trip', expression: 'function definition plus visible property checks the selected result', variables: ['x', 'f(x)', 'parameter'], roundTripCheck: true },
        { id: 'q2', type: 'hard_function_constraint_round_trip', expression: 'second interval, parameter, discriminant, composition, or option-elimination condition checks back', variables: ['x', 'f(x)', 'parameter', 'interval'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: [
        'one-step substitution labelled as function reasoning',
        'basic domain item mixing radical and reciprocal-denominator constraints',
        'hard function item without a concrete function, interval, or parameter condition',
        'parameter result without checking the original property',
        'pure function property item wrapped in experiment, model fitting, finance, biology, or other external context'
      ],
      answerDerivation: hardPlan
        ? ['combine at least two function properties or one property plus a parameter/interval constraint before selecting the answer']
        : basicPlan
          ? ['apply exactly one visible direct property or value check to one explicit function object before selecting the answer']
          : ['apply the visible function property to the stated function object before selecting the answer'],
      uniquenessConditions: ['only one option satisfies the stated function object and property conditions']
    };
  }
  if (template.planTemplate === 'math_elementary_function_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      scenarioContract: scenarioContractForExactScope([
        requiredElementaryFunctionClass || 'unspecified_function',
        requiredSinglePropertyTarget || 'unspecified_property'
      ].join(':')),
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidGenericFunctionListClassification: template.targetDifficulty !== 'hard',
        forbidElementaryFunctionExternalContextWrapper: true,
        requireMediumElementaryConcreteExpressionRelation: template.targetDifficulty === 'medium',
        requireBasicElementarySingleObjectSingleTarget: basicPlan,
        singlePropertyTargetContractVersion: basicPlan ? 'math-basic-elementary-single-property-target-v1' : undefined,
        allowedSinglePropertyTargets: basicPlan ? ['function_value', 'domain', 'range', 'monotonicity'] : undefined,
        requiredSinglePropertyTarget: basicPlan ? requiredSinglePropertyTarget || undefined : undefined,
        requiredElementaryFunctionClass: basicPlan ? requiredElementaryFunctionClass || undefined : undefined,
        forbidCrossPropertyDistractors: basicPlan,
        forbidBasicElementaryEquationSolve: basicPlan,
        forbidBasicElementaryOrderingChain: basicPlan,
        forbidBasicElementaryParameterInference: basicPlan,
        forbidBasicElementaryTargetProfileInflation: basicPlan,
        maxFunctionPropertyStack: basicPlan ? 1 : undefined,
        maxEnumeratedConditions: basicPlan ? 1 : undefined,
        maxFunctionObjects: basicPlan ? 1 : hardPlan ? 4 : 3,
        maxIndependentRelations: basicPlan ? 1 : hardPlan ? 3 : 2,
        finalAnswerShape: basicPlan
          ? 'one_direct_elementary_function_property_or_value'
          : hardPlan
            ? 'multi_relation_elementary_function_unique_judgement'
            : 'bounded_expression_relation_or_interval_judgement',
        preferredPromptSkeletons: basicPlan
          ? [
            '给出一个指数/对数/幂/根式函数表达式，只求定义域、单调性或一个函数值中的一项；题干与解析均不得提及未考查性质',
            '给出 log_a x、a^x、x^n 或一个简单根式的具体参数，只判断一个直接性质；不要用“无需判断其他性质”等否定措辞列出其他性质'
          ]
          : hardPlan
            ? [
              '比较多个指数/对数/幂表达式，先用区间界定，再加入参数或不等式条件排除选项',
              '给出初等函数与反函数/图像交点/不等式，结合第二个约束判断唯一选项'
            ]
            : [
              '给出三个具体指数/对数/幂表达式，用单调性和区间边界建立一条大小关系',
              '给出一个具体初等函数和一个明确区间，先判定义域/单调性，再比较两个表达式；不要出“下列函数中哪个满足性质”的裸分类题'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'elementary_function_object', role: 'exponential_logarithmic_power_or_radical_expression', independentGroup: 'e1' },
        { id: 'e2', type: 'domain_order_or_graph_condition', role: 'domain_range_monotonicity_order_interval_or_graph_intersection', independentGroup: template.targetDifficulty === 'basic' ? 'e1' : 'e2' },
        { id: 'e3', type: 'second_relation', role: 'comparison_bound_transformation_inverse_or_inequality_condition', independentGroup: 'e3' },
        { id: 'e4', type: 'hard_constraint', role: 'parameter_interval_inequality_or_multi_expression_option_elimination', independentGroup: 'e4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'identify_elementary_function_domain_or_expression', inputs: ['e1'], output: 'function_frame' },
        { id: 'r2', operation: 'apply_domain_order_or_graph_condition', inputs: ['function_frame', 'e2'], output: 'intermediate_relation' },
        { id: 'r3', operation: 'combine_bound_transformation_or_inverse_relation', inputs: ['intermediate_relation', 'e3'], output: 'restricted_relation' },
        { id: 'r4', operation: 'check_hard_constraint_and_eliminate_options', inputs: ['restricted_relation', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'elementary_function_relation_round_trip', expression: 'domain, order, graph, inverse, or inequality relation checks the selected result', variables: ['x', 'log', 'exp', 'power'], roundTripCheck: true },
        { id: 'q2', type: 'hard_elementary_function_constraint_round_trip', expression: 'parameter, interval, inequality, or multi-expression comparison checks back against every option', variables: ['x', 'a', 'log', 'exp'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: ['ignoring domain restrictions', 'comparing logs or powers by decimal guessing only', 'medium elementary-function item as a generic function-list classification without a given expression relation', 'hard elementary-function item without a second bound or parameter relation'],
      answerDerivation: hardPlan
        ? ['combine domain/order evidence with a second bound, inverse, inequality, or parameter condition before option elimination']
        : ['use the elementary-function object and one visible relation to determine the answer'],
      uniquenessConditions: ['only one option satisfies all visible elementary-function relations']
    };
  }
  if (template.planTemplate === 'math_sequence_condition_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidGenericSequenceClassification: basicPlan,
        forbidBasicSequenceTargetProfileInflation: basicPlan,
        maxIndependentRelations: basicPlan ? 1 : hardPlan ? 3 : 2,
        finalAnswerShape: basicPlan
          ? 'one_direct_sequence_term_sum_or_ratio_value'
          : hardPlan
            ? 'sequence_relation_plus_parameter_case_or_inequality_judgement'
            : 'two_condition_sequence_relation_judgement',
        preferredPromptSkeletons: basicPlan
          ? [
            '已知等差数列首项 a_1 和公差 d，求一个指定项 a_n 或短和 S_n',
            '已知等比数列首项 a_1 和公比 q，求一个指定项或相邻项关系'
          ]
          : hardPlan
            ? [
              '给出递推关系、初值和参数/不等式限制，先定关系再判断指定项或选项',
              '由项与部分和的两条条件先求参数，再用一条范围/奇偶/单调限制排除选项'
            ]
            : [
              '已知 a_m 与 S_n 的两个条件，先求公差/公比，再判断 a_k 或 S_k',
              '递推关系 + 初值 + 指定项/部分和，要求两步代入或化简'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'sequence_object', role: 'arithmetic_geometric_recurrence_or_partial_sum_definition', independentGroup: 's1' },
        { id: 'e2', type: 'sequence_condition', role: 'term_sum_common_difference_common_ratio_or_recurrence_condition', independentGroup: template.targetDifficulty === 'basic' ? 's1' : 's2' },
        { id: 'e3', type: 'second_sequence_relation', role: 'second_term_sum_monotonicity_inequality_or_model_choice_condition', independentGroup: 's3' },
        { id: 'e4', type: 'hard_constraint', role: 'parameter_case_recurrence_closed_form_or_inequality_check', independentGroup: 's4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'translate_sequence_definition', inputs: ['e1'], output: 'sequence_model' },
        { id: 'r2', operation: 'apply_first_sequence_condition', inputs: ['sequence_model', 'e2'], output: 'sequence_parameter_or_relation' },
        { id: 'r3', operation: 'combine_second_sequence_relation', inputs: ['sequence_parameter_or_relation', 'e3'], output: 'requested_sequence_result' },
        { id: 'r4', operation: 'check_case_or_inequality_constraint', inputs: ['requested_sequence_result', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'sequence_relation_round_trip', expression: 'term, sum, recurrence, common difference, or common ratio relation checks the answer', variables: ['a_n', 'S_n', 'd', 'q'], roundTripCheck: true },
        { id: 'q2', type: 'hard_sequence_constraint_round_trip', expression: 'case, parameter, recurrence, closed-form, or inequality condition checks back against every option', variables: ['n', 'a_n', 'S_n', 'parameter'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: ['one-term arithmetic substitution labelled medium/hard', 'mixing arithmetic and geometric models', 'hard sequence item without recurrence, parameter, case, or inequality evidence'],
      answerDerivation: hardPlan
        ? ['derive the sequence relation and check a second case/parameter/inequality condition before selecting the answer']
        : ['derive the requested term, sum, or relation from the visible sequence condition'],
      uniquenessConditions: ['only one option satisfies the sequence model and all stated conditions']
    };
  }
  if (template.planTemplate === 'math_statistics_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidBasicMultiStatisticComparison: basicPlan,
        forbidPureLinearTransformOnly: template.targetDifficulty === 'medium',
        requireMediumStatisticsChangedSampleOrSecondRelation: template.targetDifficulty === 'medium',
        forbidHardDirectCombinedVarianceOnly: hardPlan,
        requireHardStatisticsSecondIndependentConstraint: hardPlan,
        forbidHardStatisticsDirectFormulaOnly: hardPlan,
        maxIndependentRelations: basicPlan ? 1 : hardPlan ? 3 : 2,
        finalAnswerShape: basicPlan
          ? 'one_direct_statistic_from_visible_data'
          : hardPlan
            ? 'statistic_plus_missing_group_change_or_parameter_judgement'
            : 'changed_sample_grouped_or_second_statistic_relation',
        preferredPromptSkeletons: basicPlan
          ? [
            '给出 5-7 个数据或频数表，求一个均值/中位数/众数/极差',
            '给出一组数据和一个缺失值条件，求一个单一统计量'
          ]
          : hardPlan
            ? [
              '给出分组/频数/缺失值条件，先求一个统计量，再用第二个独立条件排除选项',
              '两组数据有均值/方差/频数信息，再加入缺失或变更样本条件作唯一判断；不要只问合并后方差'
            ]
            : [
              '给出一组数据及新增/删除一个数据后的变化，判断均值或方差关系',
              '给出频数表和一个缺失频数，先补全再判断一个统计量'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'data_or_statistic_object', role: 'visible_data_set_frequency_table_or_summary_statistic', independentGroup: 't1' },
        { id: 'e2', type: 'statistic_condition', role: 'mean_median_mode_variance_standard_deviation_range_or_frequency_condition', independentGroup: template.targetDifficulty === 'basic' ? 't1' : 't2' },
        { id: 'e3', type: 'second_statistic_relation', role: 'changed_sample_grouped_weighted_or_comparison_condition', independentGroup: 't3' },
        { id: 'e4', type: 'hard_constraint', role: 'missing_value_group_change_parameter_or_multi_statistic_elimination', independentGroup: 't4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'read_data_or_summary_statistic', inputs: ['e1'], output: 'data_frame' },
        { id: 'r2', operation: 'apply_first_statistic_condition', inputs: ['data_frame', 'e2'], output: 'intermediate_statistic' },
        { id: 'r3', operation: 'combine_changed_sample_or_second_statistic', inputs: ['intermediate_statistic', 'e3'], output: 'requested_statistic_result' },
        { id: 'r4', operation: 'check_missing_value_group_or_parameter_constraint', inputs: ['requested_statistic_result', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'statistic_relation_round_trip', expression: 'mean, variance, standard deviation, range, or frequency relation checks the result', variables: ['x_i', 'mean', 'variance', 'frequency'], roundTripCheck: true },
        { id: 'q2', type: 'hard_statistic_constraint_round_trip', expression: 'missing value, group change, weighted table, or multi-statistic condition checks back against every option', variables: ['x_i', 'mean', 'variance', 'parameter'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: [
        'generic definition-only statistics concept judgement',
        'one-step average total subtraction labelled medium/hard',
        'pure variance linear-transform template without changed data, comparison, or grouped evidence',
        'variance comparison without changed data or grouped evidence',
        'hard statistics item without a second statistic or missing-value condition'
      ],
      answerDerivation: hardPlan
        ? ['combine at least two statistic conditions or one statistic plus a missing/group-change constraint before option elimination']
        : template.targetDifficulty === 'medium'
        ? ['use a visible data/statistic object plus one changed-sample, grouped, weighted, missing-value, frequency-adjustment, or comparison relation before option elimination']
        : ['use the visible data/statistic relation to compute or judge exactly one statistic'],
      uniquenessConditions: ['only one option satisfies the data set and all statistic conditions']
    };
  }
  if (template.planTemplate === 'math_spatial_geometry_relation_v1') {
    const hardPlan = template.targetDifficulty === 'hard';
    const basicPlan = template.targetDifficulty === 'basic';
    const slotLimit = template.targetDifficulty === 'basic' ? 2 : hardPlan ? 4 : 3;
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        pureMathStemOnly: true,
        forbidMediumMultiPropositionSolid: template.targetDifficulty === 'medium',
        forbidHardConceptOnlyPositionStatement: hardPlan,
        forbidHardDirectCoordinateOnly: hardPlan,
        requireHardSpatialSecondRelation: hardPlan,
        maxIndependentRelations: basicPlan ? 1 : hardPlan ? 3 : 2,
        finalAnswerShape: basicPlan
          ? 'one_direct_spatial_metric_or_position_fact'
          : hardPlan
            ? 'multi_relation_spatial_vector_metric_unique_judgement'
            : 'two_relation_spatial_vector_metric_judgement',
        preferredPromptSkeletons: basicPlan
          ? [
            '给出两个空间点坐标，求一条线段长度或一个直接向量关系',
            '给出一个简单线面/面面关系，判断平行或垂直中的一个'
          ]
          : hardPlan
            ? [
              '平面方程/法向量 + 直线方向向量 + 距离或夹角条件，先建参数再排除选项',
              '空间向量坐标 + 垂直/平行关系 + 角度/体积/距离约束，完成唯一判断'
            ]
            : [
              '给出三个空间点坐标，先写向量再判断垂直/夹角/距离中的一个关系',
              '直线方向向量与平面法向量同时给出，判断位置关系并核对一个短度量'
            ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'spatial_object', role: 'self_contained_point_line_plane_solid_or_coordinate_definition', independentGroup: 'p1' },
        { id: 'e2', type: 'spatial_relation', role: 'parallel_perpendicular_angle_projection_distance_volume_or_normal_vector_condition', independentGroup: template.targetDifficulty === 'basic' ? 'p1' : 'p2' },
        { id: 'e3', type: 'second_spatial_relation', role: 'line_plane_plane_plane_vector_or_derived_object_condition', independentGroup: 'p3' },
        { id: 'e4', type: 'hard_constraint', role: 'parameter_multi_object_angle_distance_or_case_condition', independentGroup: 'p4' }
      ].slice(0, slotLimit),
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'translate_spatial_configuration', inputs: ['e1'], output: 'spatial_model' },
        { id: 'r2', operation: 'apply_spatial_relation', inputs: ['spatial_model', 'e2'], output: 'intermediate_spatial_relation' },
        { id: 'r3', operation: 'combine_second_relation_or_vector_metric', inputs: ['intermediate_spatial_relation', 'e3'], output: 'requested_spatial_result' },
        { id: 'r4', operation: 'check_hard_spatial_constraint_and_eliminate_options', inputs: ['requested_spatial_result', 'e4'], output: 'answer' }
      ].slice(0, slotLimit),
      quantitativeRelations: [
        { id: 'q1', type: 'spatial_geometry_relation_round_trip', expression: 'line/plane/vector/solid relation checks the selected result', variables: ['point', 'line', 'plane', 'vector'], roundTripCheck: true },
        { id: 'q2', type: 'hard_spatial_constraint_round_trip', expression: 'second angle, projection, distance, volume, normal-vector, or parameter relation checks back against every option', variables: ['point', 'line', 'plane', 'parameter'], roundTripCheck: true }
      ].slice(0, hardPlan ? 2 : 1),
      misconceptionTargets: ['unseen diagram dependency', 'raw coordinate or distance substitution labelled medium/hard', 'hard spatial item without a second line/plane/vector relation'],
      answerDerivation: hardPlan
        ? ['translate the spatial configuration and combine two visible spatial relations or a parameter/vector constraint before selecting the answer']
        : ['use the self-contained spatial object and one visible relation to determine the answer'],
      uniquenessConditions: ['only one option satisfies the self-contained spatial geometry conditions']
    };
  }
  if (template.planTemplate === 'physics_medium_optics_two_relation_v1') {
    return {
      ...common,
      renderConstraints: {
        ...common.renderConstraints,
        requireTextCompleteOpticalSetup: true,
        requireTwoLinkedOpticalRelations: true,
        forbidUnseenDiagramDependency: true,
        maxIndependentRelations: 2,
        finalAnswerShape: 'one_unique_image_property_distance_or_refraction_judgement',
        preferredPromptSkeletons: [
          '文字给出凸透镜焦距、物距及物体移动方向，先由成像区间判断像的性质，再判断像距或像大小变化',
          '给出入射介质、折射介质和一个角度/折射率关系，先判断偏折方向，再比较角度或传播量变化'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'optical_setup', role: 'text_complete_lens_or_refraction_configuration', independentGroup: 'o1' },
        { id: 'e2', type: 'first_optical_relation', role: 'focal_interval_or_refraction_direction_relation', independentGroup: 'o1' },
        { id: 'e3', type: 'second_optical_relation', role: 'movement_image_change_angle_or_magnification_relation', independentGroup: 'o2' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'identify_optical_region_or_refraction_direction', inputs: ['e1', 'e2'], output: 'first_optical_conclusion' },
        { id: 'r2', operation: 'propagate_movement_or_second_relation', inputs: ['first_optical_conclusion', 'e3'], output: 'image_or_angle_change' },
        { id: 'r3', operation: 'check_relation_and_eliminate_options', inputs: ['image_or_angle_change'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'lens_or_refraction_round_trip', expression: '1/f=1/u+1/v or n1 sin(i)=n2 sin(r) checks the selected trend or value', variables: ['f', 'u', 'v', 'n', 'i', 'r'], roundTripCheck: true }
      ],
      misconceptionTargets: ['unseen diagram dependency', 'one-rule optics recall labelled medium', 'reversing image-distance or refraction-angle change'],
      answerDerivation: ['combine the optical region or refraction direction with one movement, image, angle, or magnification relation'],
      uniquenessConditions: ['only one option satisfies both linked optical relations']
    };
  }
  if (template.planTemplate === 'physics_kinematics_basic_relation_v1') {
    const exactPhysicsKinematicsScope = [
      'uniform_speed',
      'acceleration_from_velocity_change',
      'final_velocity_from_initial_acceleration_time',
      'displacement_from_initial_acceleration_time'
    ].includes(cleanText(input.exactPhysicsKinematicsScope)) ? cleanText(input.exactPhysicsKinematicsScope) : null;
    return {
      ...common,
      scenarioContract: scenarioContractForExactScope(exactPhysicsKinematicsScope || 'unspecified_scope'),
      renderConstraints: {
        ...common.renderConstraints,
        requirePhysicsSituation: true,
        requireUnitOrGraphEvidence: true,
        exactPhysicsKinematicsScope: exactPhysicsKinematicsScope || undefined,
        maxIndependentRelations: 1,
        forbidMultiStageModelChain: true,
        finalAnswerShape: 'one_direct_kinematics_value_direction_or_graph_fact',
        preferredPromptSkeletons: [
          '给出位移、时间、速度或加速度中的两个直接量，求第三个量并保留单位',
          '用文字完整描述一段 s-t 或 v-t 直线图像，判断斜率、方向或速度中的一个事实'
        ]
      },
      evidenceSlots: [
        { id: 'e1', type: 'physical_situation', role: 'one_self_contained_kinematics_object_or_motion_segment', independentGroup: 'k1' },
        { id: 'e2', type: 'quantity_or_graph_relation', role: 'one_displacement_time_velocity_acceleration_or_graph_slope_relation_with_units', independentGroup: 'k1' }
      ],
      hypotheses: [],
      reasoningSteps: [
        { id: 'r1', operation: 'identify_direct_kinematics_relation', inputs: ['e1', 'e2'], output: 'selected_relation' },
        { id: 'r2', operation: 'derive_one_value_direction_or_graph_fact', inputs: ['selected_relation'], output: 'answer' }
      ],
      quantitativeRelations: [
        { id: 'q1', type: 'kinematics_unit_or_graph_round_trip', expression: 'displacement/time/velocity/acceleration relation or graph slope checks the answer', variables: ['s', 't', 'v', 'a'], roundTripCheck: true }
      ],
      misconceptionTargets: ['confuse displacement with distance', 'confuse graph slope with graph height', 'omit or mismatch units'],
      answerDerivation: ['apply exactly one visible kinematics relation or one graph-slope interpretation'],
      uniquenessConditions: ['only one option matches the stated motion relation and units']
    };
  }
  return {
    ...common,
    evidenceSlots: [
      { id: 'e1', type: 'operation', role: 'first_operation_bias', independentGroup: 'g1' },
      { id: 'e2', type: 'operation', role: 'second_operation_result', independentGroup: 'g2' }
    ],
    hypotheses: [],
    reasoningSteps: [
      { id: 'r1', operation: 'causal_propagation', inputs: ['e1', 'e2'], output: 'result_bias' },
      { id: 'r2', operation: 'derive_answer', inputs: ['result_bias'], output: 'answer' }
    ],
    quantitativeRelations: [],
    misconceptionTargets: ['independent single-operation rule judgement'],
    answerDerivation: ['first operation error propagates into the second operation result'],
    uniquenessConditions: ['only one option has the correct causal direction']
  };
}

export function subjectPracticeQuestionPlanGateFor(input: {
  subject?: string | null;
  productionCellId?: number | string | null;
  topicTitle?: string | null;
  targetDifficulty?: string | null;
  taskFamily?: string | null;
  planTemplate?: string | null;
  questionPlan?: unknown;
  targetProfile?: unknown;
  env?: Record<string, string | undefined>;
}): SubjectPracticeQuestionPlanGate {
  const env = input.env ?? process.env;
  const globalEnabled = subjectPracticeQuestionPlanEnabled(env);
  const inputQuestionPlan = recordFrom(input.questionPlan);
  const template = subjectPracticeQuestionPlanTemplateFor({
    ...input,
    taskFamily: input.taskFamily ?? inputQuestionPlan?.taskFamily as string | null | undefined,
    planTemplate: input.planTemplate ?? inputQuestionPlan?.planTemplate as string | null | undefined
  });
  const applicable = Boolean(template);
  const rawCellAllowlist = cleanText(env[SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]);
  const guardedTemplateRequiresExplicitAllowlist = (
    ['math', 'physics'].includes(template?.subject ?? '')
    || [
      'basic_ph_measurement_preparation_error_v1',
      'chemistry_medium_classification_evidence_v1'
    ].includes(template?.planTemplate ?? '')
  ) && !rawCellAllowlist;
  const cellAllowed = !applicable || (!guardedTemplateRequiresExplicitAllowlist && subjectPracticeQuestionPlanCellAllowed({
    productionCellId: input.productionCellId ?? template?.productionCellId,
    env
  }));
  const requiresPlan = globalEnabled && applicable && cellAllowed;
  const validation = requiresPlan && input.questionPlan !== undefined && input.questionPlan !== null
    ? validateSubjectPracticeQuestionPlan(input.questionPlan)
    : null;
  const enabled = requiresPlan;
  const targetProfile = recordFrom(input.targetProfile);
  const targetQuestionForm = cleanText(targetProfile?.questionForm).toLowerCase();
  const targetCognitiveSkill = cleanText(targetProfile?.cognitiveSkill).toLowerCase();
  const targetDifficultyBand = cleanText(targetProfile?.difficultyBand).toLowerCase();
  const effectiveTaskFamily = template?.taskFamily ?? cleanText(input.taskFamily ?? validation?.taskFamily);
  const effectivePlanTemplate = template?.planTemplate ?? cleanText(input.planTemplate ?? validation?.template);
  const basicDirectPropertyMultiStepConflict = Boolean(
    targetProfile
    && effectivePlanTemplate === 'math_elementary_function_relation_v1'
    && effectiveTaskFamily === 'elementary_function_direct_property'
    && cleanText(input.targetDifficulty).toLowerCase() === 'basic'
    && targetDifficultyBand === 'basic'
    && ['multi_step_reasoning', 'complex_reasoning'].includes(targetCognitiveSkill)
  );
  const targetProfileCompatibility = {
    evaluated: Boolean(targetProfile),
    satisfiable: !basicDirectPropertyMultiStepConflict,
    reasonCodes: basicDirectPropertyMultiStepConflict
      ? ['question_plan_target_profile_basic_direct_property_multistep_conflict']
      : [],
    questionForm: targetQuestionForm || null,
    cognitiveSkill: targetCognitiveSkill || null,
    difficultyBand: targetDifficultyBand || null
  };
  const generationAllowed = !requiresPlan
    || (validation?.valid === true && targetProfileCompatibility.satisfiable);
  const reasonCodes: string[] = [];
  if (!applicable) reasonCodes.push('question_plan_not_applicable');
  if (applicable && !globalEnabled) reasonCodes.push('question_plan_feature_flag_disabled');
  if (applicable && globalEnabled && !cellAllowed) reasonCodes.push('question_plan_cell_not_enabled');
  if (requiresPlan && !validation) reasonCodes.push('question_plan_missing');
  if (requiresPlan && validation && !validation.valid) reasonCodes.push(...validation.failureCodes);
  reasonCodes.push(...targetProfileCompatibility.reasonCodes);

  return {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    featureFlag: SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
    cellAllowlistFlag: SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
    enabled,
    applicable,
    cellAllowed,
    mode: !applicable ? 'not_applicable' : requiresPlan ? 'plan_required' : 'disabled_shadow',
    generationAllowed,
    productionImpact: requiresPlan ? 'fail_closed_when_enabled' : 'none_disabled_shadow',
    providerImpact: 'none_no_provider_call',
    subject: cleanText(input.subject) || null,
    productionCellId: cleanText(input.productionCellId) || null,
    targetDifficulty: cleanText(input.targetDifficulty) || null,
    taskFamily: template?.taskFamily ?? (cleanText(input.taskFamily) || validation?.taskFamily || null),
    planTemplate: template?.planTemplate ?? (cleanText(input.planTemplate) || validation?.template || null),
    validation,
    targetProfileCompatibility,
    reasonCodes
  };
}

export function subjectPracticeQuestionPlanAdherenceFor(plan: unknown, candidate: unknown): SubjectPracticeQuestionPlanAdherence {
  const validation = validateSubjectPracticeQuestionPlan(plan);
  const features = questionPlanAdherenceFeatures(candidate);
  const planRecord = recordFrom(plan);
  const renderConstraints = recordFrom(planRecord?.renderConstraints) ?? {};
  const targetDifficulty = cleanText(planRecord?.targetDifficulty);
  const failureCodes: string[] = [];
  if (!validation.valid) failureCodes.push('candidate_plan_invalid');
  const template = validation.template;
  if (validation.valid && template === 'competing_hypothesis_discrimination_v1') {
    if (features.observationWords < 2) failureCodes.push('candidate_plan_observation_evidence_missing');
    if (features.hypothesisMarkers < 1) failureCodes.push('candidate_plan_competing_hypothesis_missing');
    if (features.reasoningConnectors < 2) failureCodes.push('candidate_plan_reasoning_chain_missing');
  } else if (validation.valid && template === 'organic_formula_reaction_unique_structure_v1') {
    if (features.quantitativeMarkers < 3) failureCodes.push('candidate_plan_quantitative_relation_missing');
    if (features.reactionClues < 2) failureCodes.push('candidate_plan_independent_reaction_clues_missing');
    if (features.reasoningConnectors < 2) failureCodes.push('candidate_plan_reasoning_chain_missing');
  } else if (validation.valid && template === 'two_linked_operations_causal_propagation_v1') {
    if (features.operationWords < 2) failureCodes.push('candidate_plan_two_operation_evidence_missing');
    if (features.reasoningConnectors < 1) failureCodes.push('candidate_plan_causal_propagation_missing');
  } else if (validation.valid && template === 'gas_impurity_control_competing_elimination_v1') {
    if (features.gasSpeciesMarkers < 2) failureCodes.push('candidate_plan_gas_species_evidence_missing');
    if (features.gasControlMarkers < 2) failureCodes.push('candidate_plan_impurity_control_evidence_missing');
    if (features.reasoningConnectors < 2) failureCodes.push('candidate_plan_reasoning_chain_missing');
  } else if (validation.valid && template === 'redox_electron_transfer_quantitative_chain_v1') {
    if (features.redoxReactionMarkers < 2) failureCodes.push('candidate_plan_redox_reaction_evidence_missing');
    if (features.redoxConceptMarkers < 2) failureCodes.push('candidate_plan_redox_concept_evidence_missing');
    if (features.quantitativeMarkers < 2 || features.redoxQuantitativeChainMarkers < 2) failureCodes.push('candidate_plan_quantitative_relation_missing');
    if (features.reasoningConnectors < 2) failureCodes.push('candidate_plan_reasoning_chain_missing');
  } else if (validation.valid && template === 'basic_redox_single_reaction_valence_rule_v1') {
    if (features.redoxReactionMarkers < 1) failureCodes.push('candidate_plan_basic_redox_reaction_evidence_missing');
    if (features.redoxConceptMarkers < 2) failureCodes.push('candidate_plan_basic_redox_concept_target_missing');
    if (features.redoxQuantitativeChainMarkers > 2) failureCodes.push('candidate_plan_basic_redox_quantitative_chain_forbidden');
  } else if (validation.valid && template === 'basic_ph_measurement_preparation_error_v1') {
    if (features.chemistryPhConceptSignals < 2) failureCodes.push('candidate_plan_chemistry_basic_ph_concept_evidence_missing');
    if (features.chemistryPhOperationErrorSignals < 2) failureCodes.push('candidate_plan_chemistry_basic_ph_operation_evidence_missing');
    if (features.chemistryPhDirectionSignals < 2 || features.reasoningConnectors < 1) failureCodes.push('candidate_plan_chemistry_basic_ph_causal_direction_missing');
    if (features.chemistryPhDirectCalculationRisk) failureCodes.push('candidate_plan_chemistry_basic_ph_direct_calculation_forbidden');
  } else if (validation.valid && template === 'chemistry_medium_classification_evidence_v1') {
    if (features.chemistryClassificationSignals < 3) failureCodes.push('candidate_plan_chemistry_classification_rule_evidence_missing');
    if (features.chemistryStateChangeEvidenceSignals < 2) failureCodes.push('candidate_plan_chemistry_state_change_evidence_missing');
    if (features.reasoningConnectors < 1) failureCodes.push('candidate_plan_chemistry_classification_reasoning_chain_missing');
    if (features.chemistryDefinitionOnlyClassificationRisk) failureCodes.push('candidate_plan_chemistry_definition_only_classification_forbidden');
  } else if (validation.valid && template === 'physics_kinematics_basic_relation_v1') {
    if (features.physicsKinematicsSignals < 2) failureCodes.push('candidate_plan_physics_basic_kinematics_relation_missing');
    if (features.physicsUnitSignals < 1 && features.physicsGraphSignals < 1) failureCodes.push('candidate_plan_physics_basic_unit_or_graph_evidence_missing');
  } else if (validation.valid && template === 'math_line_relation_direct_v1') {
    if (features.mathGeometrySignals < 2) failureCodes.push('candidate_plan_math_line_relation_evidence_missing');
    const candidateText = displayText(JSON.stringify(candidate));
    if (/(intersection|intersect|交点).{0,80}(perpendicular|垂直)|(perpendicular|垂直).{0,80}(intersection|intersect|交点)/i.test(candidateText)) {
      failureCodes.push('candidate_plan_math_line_relation_multistage_intersection_forbidden');
    }
  } else if (validation.valid && template === 'physics_medium_optics_two_relation_v1') {
    if (features.physicsOpticsSignals < 4) failureCodes.push('candidate_plan_physics_optics_setup_evidence_missing');
    if (features.physicsOpticsRelationSignals < 2) failureCodes.push('candidate_plan_physics_optics_second_relation_missing');
    if (features.reasoningConnectors < 1) failureCodes.push('candidate_plan_physics_optics_reasoning_chain_missing');
    if (features.physicsUnseenDiagramRisk) failureCodes.push('candidate_plan_physics_unseen_diagram_forbidden');
  } else if (validation.valid && template === 'math_medium_function_two_move_reasoning_v1') {
    const propertyShape = features.mathPropertySignals >= 3
      && (features.mathStatementMarkers >= 1 || features.mathTransformationSignals >= 1)
      && features.mathOptionJudgement;
    if (features.mathParameterInferenceRisk) failureCodes.push('candidate_plan_math_parameter_inference_forbidden');
    if (features.mathPureFunctionExternalContextRisk) failureCodes.push('candidate_plan_math_pure_function_external_context_forbidden');
    if (features.mathMediumFunctionPropertyOverComplex) failureCodes.push('candidate_plan_math_medium_function_overcomplex');
    if (!propertyShape) failureCodes.push('candidate_plan_math_function_two_move_evidence_missing');
    if (features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_second_reasoning_move_missing');
  } else if (validation.valid && template === 'math_medium_exp_log_ordering_chain_v1') {
    if (features.mathParameterInferenceRisk) failureCodes.push('candidate_plan_math_parameter_inference_forbidden');
    if (features.mathPureFunctionExternalContextRisk) failureCodes.push('candidate_plan_math_pure_function_external_context_forbidden');
    if (features.mathElementaryFunctionGenericClassificationRisk) failureCodes.push('candidate_plan_math_medium_elementary_function_generic_classification_forbidden');
    if (features.mathOrderingSignals < 4) failureCodes.push('candidate_plan_math_exp_log_ordering_chain_missing');
    if (features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_ordering_bound_move_missing');
    if (!features.mathOptionJudgement) failureCodes.push('candidate_plan_math_option_judgement_missing');
  } else if (validation.valid && template === 'math_medium_function_parameter_constraint_v1') {
    if (!features.mathParameterInferenceRisk) failureCodes.push('candidate_plan_math_parameter_constraint_missing');
    if (features.mathPureFunctionExternalContextRisk) failureCodes.push('candidate_plan_math_pure_function_external_context_forbidden');
    if (features.mathParameterConstraintSignals < 3) failureCodes.push('candidate_plan_math_parameter_constraint_evidence_missing');
    if (features.mathPropertySignals < 2) failureCodes.push('candidate_plan_math_parameter_function_property_missing');
    if (features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_parameter_reasoning_move_missing');
    if (!features.mathOptionJudgement) failureCodes.push('candidate_plan_math_option_judgement_missing');
  } else if (validation.valid && template === 'math_probability_counting_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 4 : 5;
    const effectiveProbabilitySignals = features.mathProbabilitySignals + Math.min(features.mathProbabilityNormalHardInteractionCueCount ?? 0, 3);
    if (effectiveProbabilitySignals < minimumSignals) failureCodes.push('candidate_plan_math_probability_event_evidence_missing');
    if (renderConstraints.requireConcreteSampleSpaceForBasic === true && features.mathProbabilityConceptOnlyRisk) failureCodes.push('candidate_plan_math_basic_probability_concept_only_forbidden');
    if (renderConstraints.requireConcreteSampleSpaceForBasic === true && features.mathProbabilityConcreteFrameSignals < 1) failureCodes.push('candidate_plan_math_basic_probability_sample_space_missing');
    if (renderConstraints.forbidSingleResultOnly === true && features.mathProbabilitySingleResultRisk) failureCodes.push('candidate_plan_math_probability_single_result_forbidden');
    if (renderConstraints.forbidEventListOnly === true && features.mathProbabilityEventListOnlyRisk) failureCodes.push('candidate_plan_math_hard_probability_event_list_only_forbidden');
    if (renderConstraints.forbidLargeNormalReferenceTable === true && features.mathProbabilityNormalReferenceTableRisk) failureCodes.push('candidate_plan_math_hard_normal_reference_table_forbidden');
    if (targetDifficulty === 'medium' && features.mathProbabilityNormalMediumNoEventRisk) failureCodes.push('candidate_plan_math_medium_normal_probability_no_event_forbidden');
    if (renderConstraints.requireHardInteractionCue === true && features.mathProbabilityHardInteractionCueCount < 1) failureCodes.push('candidate_plan_math_hard_probability_interaction_missing');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1 && (features.mathProbabilityNormalHardInteractionCueCount ?? 0) < 2) failureCodes.push('candidate_plan_math_probability_second_relation_missing');
    if (targetDifficulty === 'hard' && effectiveProbabilitySignals < 5) failureCodes.push('candidate_plan_math_hard_probability_case_or_condition_missing');
  } else if (validation.valid && template === 'math_vector_complex_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    const maxVectorOrComplexObjects = Number(renderConstraints.maxVectorOrComplexObjects) || 0;
    if (features.mathVectorComplexSignals < minimumSignals) failureCodes.push('candidate_plan_math_vector_complex_relation_evidence_missing');
    if (targetDifficulty === 'basic' && features.mathVectorComplexBasicDefinitionOnlyRisk) failureCodes.push('candidate_plan_math_basic_vector_complex_definition_only_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_vector_complex_second_move_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathVectorComplexSignals < 5) failureCodes.push('candidate_plan_math_hard_vector_complex_constraint_missing');
    if (renderConstraints.forbidHardDirectMetricOnly === true && features.mathVectorComplexHardDirectMetricRisk) failureCodes.push('candidate_plan_math_hard_vector_complex_direct_metric_forbidden');
    if (renderConstraints.forbidCoordinateGeometryDistanceProjectionShell === true && features.mathVectorComplexCoordinateGeometryDriftRisk) failureCodes.push('candidate_plan_math_vector_complex_coordinate_geometry_drift_forbidden');
    if (targetDifficulty === 'medium' && !features.mathOptionJudgement) failureCodes.push('candidate_plan_math_option_judgement_missing');
    if (renderConstraints.forbidLocusOrParameterChain === true && features.mathVectorComplexLocusParameterChainRisk) failureCodes.push('candidate_plan_math_vector_complex_locus_parameter_chain_forbidden');
    if (renderConstraints.forbidOneStepFormulaOnly === true && features.mathVectorComplexOneStepFormulaRisk) failureCodes.push('candidate_plan_math_vector_complex_one_step_formula_forbidden');
    if (maxVectorOrComplexObjects > 0 && features.mathVectorComplexObjectCount > maxVectorOrComplexObjects) failureCodes.push('candidate_plan_math_vector_complex_object_stack_over_limit');
  } else if (validation.valid && template === 'math_derivative_condition_chain_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    if (features.mathDerivativeSignals < minimumSignals) failureCodes.push('candidate_plan_math_derivative_condition_evidence_missing');
    if (renderConstraints.forbidBasicDerivativeComplexity === true && features.mathDerivativeBasicOverComplexRisk) failureCodes.push('candidate_plan_math_basic_derivative_complexity_forbidden');
    if (renderConstraints.forbidBasicDerivativeDomainTrap === true && features.mathDerivativeBasicDomainTrapRisk) failureCodes.push('candidate_plan_math_basic_derivative_domain_trap_forbidden');
    if (targetDifficulty === 'medium' && features.mathDerivativeMediumDefinitionOnlyRisk) failureCodes.push('candidate_plan_math_medium_derivative_definition_only_forbidden');
    if (targetDifficulty === 'hard' && features.mathDerivativeHardCoefficientSolveOnlyRisk) failureCodes.push('candidate_plan_math_hard_derivative_coefficient_solve_only_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_derivative_second_condition_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathDerivativeSignals < 5) failureCodes.push('candidate_plan_math_hard_derivative_constraint_missing');
  } else if (validation.valid && template === 'math_analytic_geometry_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    if (features.mathGeometrySignals < minimumSignals) failureCodes.push('candidate_plan_math_analytic_geometry_relation_evidence_missing');
    if (targetDifficulty === 'basic' && features.mathAnalyticGeometryBasicGeneralCircleRisk) failureCodes.push('candidate_plan_math_basic_analytic_geometry_general_circle_forbidden');
    if (targetDifficulty !== 'basic' && features.mathAnalyticGeometryDefinitionOnlyRisk) failureCodes.push('candidate_plan_math_medium_analytic_geometry_definition_only_forbidden');
    if (targetDifficulty === 'hard' && features.mathAnalyticGeometryHardConicRelationOnlyRisk) failureCodes.push('candidate_plan_math_hard_analytic_geometry_conic_relation_only_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_analytic_geometry_second_relation_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathGeometrySignals < 5) failureCodes.push('candidate_plan_math_hard_analytic_geometry_constraint_missing');
  } else if (validation.valid && template === 'math_function_property_by_difficulty_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : 4;
    const maxFunctionPropertyStack = Number(renderConstraints.maxFunctionPropertyStack) || 0;
    if (features.mathPropertySignals < minimumSignals) failureCodes.push('candidate_plan_math_function_property_evidence_missing');
    if (targetDifficulty === 'basic' && features.mathFunctionBasicMultiConstraintDomainRisk) failureCodes.push('candidate_plan_math_basic_function_multi_constraint_domain_forbidden');
    if (targetDifficulty === 'basic' && features.mathParameterInferenceRisk) failureCodes.push('candidate_plan_math_parameter_inference_forbidden');
    if (targetDifficulty === 'basic' && features.mathFunctionMultipleNamedPointsRisk) failureCodes.push('candidate_plan_math_basic_function_multiple_named_points_forbidden');
    if (targetDifficulty === 'basic' && renderConstraints.forbidBasicFunctionSolutionScaffold === true && features.mathBasicFunctionSolutionScaffoldRisk) failureCodes.push('candidate_plan_math_basic_function_solution_scaffold_forbidden');
    if (maxFunctionPropertyStack > 0 && features.mathFunctionDistinctPropertyCount > maxFunctionPropertyStack) failureCodes.push('candidate_plan_math_function_property_stack_over_limit');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_function_second_condition_missing');
    if (targetDifficulty === 'hard' && features.mathHardFunctionGenericConceptRisk) failureCodes.push('candidate_plan_math_hard_function_generic_concept_forbidden');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathPropertySignals < 5) failureCodes.push('candidate_plan_math_hard_function_constraint_missing');
    if (!features.mathOptionJudgement) failureCodes.push('candidate_plan_math_option_judgement_missing');
  } else if (validation.valid && template === 'math_elementary_function_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    const normalizedCandidateText = candidateText(candidate).toLowerCase();
    const requiredSinglePropertyTarget = cleanText(renderConstraints.requiredSinglePropertyTarget);
    const requiredElementaryFunctionClass = cleanText(renderConstraints.requiredElementaryFunctionClass);
    const requiredPropertyPattern = requiredSinglePropertyTarget === 'domain'
      ? /(定义域|domain)/i
      : requiredSinglePropertyTarget === 'range'
        ? /(值域|range)/i
        : requiredSinglePropertyTarget === 'monotonicity'
          ? /(单调|递增|递减|monotonic|increasing|decreasing)/i
          : requiredSinglePropertyTarget === 'function_value'
            ? /(函数值|function value|\b[fgh]\s*\(\s*-?\d+(?:\.\d+)?\s*\))/i
            : null;
    const requiredFunctionClassPattern = requiredElementaryFunctionClass === 'logarithmic'
      ? /(对数|log|lg|ln)/i
      : requiredElementaryFunctionClass === 'exponential'
        ? /(指数函数|exponential|(?:\d+(?:\.\d+)?|[a-z])\s*\^\s*\{?\s*x\s*\}?)/i
        : requiredElementaryFunctionClass === 'radical'
          ? /(根式|根号|radical|sqrt|√)/i
          : requiredElementaryFunctionClass === 'power'
            ? /(幂函数|power function|x\s*\^\s*\{?\s*-?\d)/i
            : null;
    if (features.mathElementaryFunctionSignals < minimumSignals) failureCodes.push('candidate_plan_math_elementary_function_relation_missing');
    if (targetDifficulty !== 'hard' && features.mathElementaryFunctionGenericClassificationRisk) failureCodes.push(targetDifficulty === 'basic'
      ? 'candidate_plan_math_basic_elementary_function_generic_classification_forbidden'
      : 'candidate_plan_math_medium_elementary_function_generic_classification_forbidden');
    if (targetDifficulty === 'basic' && features.mathElementaryFunctionBasicEquationSolveRisk) failureCodes.push('candidate_plan_math_basic_elementary_function_equation_solve_forbidden');
    if (targetDifficulty === 'basic' && features.mathElementaryFunctionBasicMultipleObjectRisk) failureCodes.push('candidate_plan_math_basic_elementary_function_multiple_objects_forbidden');
    if (targetDifficulty === 'basic' && features.mathParameterInferenceRisk) failureCodes.push('candidate_plan_math_parameter_inference_forbidden');
    if (targetDifficulty === 'basic' && features.mathPureFunctionExternalContextRisk) failureCodes.push('candidate_plan_math_pure_function_external_context_forbidden');
    if (targetDifficulty === 'basic' && (features.mathStudentFacingDistinctPropertyCount > 1 || features.mathStudentFacingFunctionPropertyOverComplex)) failureCodes.push('candidate_plan_math_basic_elementary_function_property_stack_forbidden');
    if (targetDifficulty === 'basic' && requiredPropertyPattern && !requiredPropertyPattern.test(normalizedCandidateText)) failureCodes.push('candidate_plan_math_basic_elementary_required_property_target_missing');
    if (targetDifficulty === 'basic' && requiredFunctionClassPattern && !requiredFunctionClassPattern.test(normalizedCandidateText)) failureCodes.push('candidate_plan_math_basic_elementary_required_function_class_missing');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_elementary_function_second_relation_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathElementaryFunctionSignals < 5) failureCodes.push('candidate_plan_math_hard_elementary_function_constraint_missing');
  } else if (validation.valid && template === 'math_sequence_condition_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    if (features.mathSequenceSignals < minimumSignals) failureCodes.push('candidate_plan_math_sequence_condition_evidence_missing');
    if (targetDifficulty === 'basic' && features.mathSequenceGenericClassificationRisk) failureCodes.push('candidate_plan_math_basic_sequence_generic_classification_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_sequence_second_relation_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathSequenceSignals < 5) failureCodes.push('candidate_plan_math_hard_sequence_constraint_missing');
  } else if (validation.valid && template === 'math_statistics_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    if (features.mathStatisticsSignals < minimumSignals) failureCodes.push('candidate_plan_math_statistics_relation_evidence_missing');
    if (targetDifficulty === 'basic' && features.mathStatisticsBasicMultiStatisticComparisonRisk) failureCodes.push('candidate_plan_math_basic_statistics_multi_statistic_comparison_forbidden');
    if (targetDifficulty === 'medium' && features.mathStatisticsMediumPureLinearTransformRisk) failureCodes.push('candidate_plan_math_medium_statistics_pure_linear_transform_forbidden');
    if (targetDifficulty === 'hard' && features.mathStatisticsHardDirectCombinedVarianceRisk) failureCodes.push('candidate_plan_math_hard_statistics_direct_combined_variance_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_statistics_second_relation_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathStatisticsSignals < 5) failureCodes.push('candidate_plan_math_hard_statistics_constraint_missing');
  } else if (validation.valid && template === 'math_spatial_geometry_relation_v1') {
    const minimumSignals = targetDifficulty === 'basic' ? 2 : targetDifficulty === 'medium' ? 3 : 4;
    if (features.mathSpatialSignals < minimumSignals) failureCodes.push('candidate_plan_math_spatial_geometry_relation_evidence_missing');
    if (targetDifficulty === 'medium' && features.mathSpatialMediumMultiPropositionOvercomplexRisk) failureCodes.push('candidate_plan_math_medium_spatial_multi_proposition_overcomplex_forbidden');
    if (targetDifficulty === 'hard' && features.mathSpatialHardConceptOnlyRisk) failureCodes.push('candidate_plan_math_hard_spatial_concept_only_forbidden');
    if (targetDifficulty === 'hard' && features.mathSpatialHardDirectCoordinateOnlyRisk) failureCodes.push('candidate_plan_math_hard_spatial_direct_coordinate_forbidden');
    if (targetDifficulty !== 'basic' && features.mathTransformationSignals < 1) failureCodes.push('candidate_plan_math_spatial_geometry_second_relation_missing');
    if (targetDifficulty === 'hard' && features.mathParameterConstraintSignals < 1 && features.mathSpatialSignals < 5) failureCodes.push('candidate_plan_math_hard_spatial_geometry_constraint_missing');
  }

  return {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    validPlan: validation.valid,
    adheres: validation.valid && failureCodes.length === 0,
    planTemplate: validation.template,
    taskFamily: validation.taskFamily,
    failureCodes,
    features,
    productionImpact: 'none_audit_or_gate_scaffold',
    providerImpact: 'none_no_provider_call'
  };
}

export function subjectPracticeQuestionPlanFailureRouteFor(input: {
  planValidation?: SubjectPracticeQuestionPlanValidation | null;
  adherence?: SubjectPracticeQuestionPlanAdherence | null;
  reviewStatus?: string | null;
  reviewReasonCodes?: unknown;
  providerFailureCategory?: string | null;
}): SubjectPracticeQuestionPlanFailureRoute {
  const providerFailureCategory = cleanText(input.providerFailureCategory);
  const reviewReasonCodes = (Array.isArray(input.reviewReasonCodes) ? input.reviewReasonCodes : [])
    .map((reason) => cleanText(reason))
    .filter(Boolean);
  const planValidation = input.planValidation ?? null;
  const adherence = input.adherence ?? null;
  const reviewStatus = cleanText(input.reviewStatus);
  if (providerFailureCategory) {
    return {
      policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
      schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
      stage: 'delivery',
      action: 'record_delivery_only',
      reasonCodes: [providerFailureCategory],
      qualityMemoryEligible: false,
      deliveryMemoryEligible: true,
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality'
    };
  }
  if (planValidation && !planValidation.valid) {
    return {
      policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
      schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
      stage: 'plan_validation',
      action: 'repair_plan',
      reasonCodes: planValidation.failureCodes,
      qualityMemoryEligible: true,
      deliveryMemoryEligible: false,
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality'
    };
  }
  if (adherence && !adherence.adheres) {
    return {
      policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
      schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
      stage: 'candidate_plan_adherence',
      action: 'repair_candidate_rendering',
      reasonCodes: adherence.failureCodes,
      qualityMemoryEligible: true,
      deliveryMemoryEligible: false,
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality'
    };
  }
  if (reviewStatus === 'failed' || reviewReasonCodes.length > 0) {
    return {
      policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
      schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
      stage: 'reviewer_or_gate',
      action: 'route_to_existing_reviewer_gate_repair',
      reasonCodes: reviewReasonCodes.length ? reviewReasonCodes : ['review_failed'],
      qualityMemoryEligible: true,
      deliveryMemoryEligible: false,
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality'
    };
  }
  return {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    stage: 'none',
    action: 'none',
    reasonCodes: [],
    qualityMemoryEligible: false,
    deliveryMemoryEligible: false,
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality'
  };
}

export function repairSubjectPracticeQuestionPlan(input: {
  questionPlan?: unknown;
  subject: string;
  topicId?: number | null;
  topicTitle?: string | null;
  productionCellId?: number | string | null;
  targetDifficulty?: string | null;
  taskFamily?: string | null;
}): SubjectPracticeQuestionPlanRepairResult {
  const originalPlan = recordFrom(input.questionPlan);
  const originalValidation = validateSubjectPracticeQuestionPlan(input.questionPlan);
  const originalBudget = recordFrom(originalPlan?.budget);
  const maximum = boundedRepairLimit(
    originalBudget?.maxPlanRepairs,
    SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS,
    SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS
  );
  const base = {
    policyVersion: 'subject-practice-question-plan-deterministic-repair-v1' as const,
    originalValidation,
    productionImpact: 'none_deterministic_plan_only' as const,
    providerImpact: 'none_no_provider_call' as const
  };
  if (originalValidation.valid) {
    return {
      ...base,
      status: 'not_required',
      repairedPlan: originalPlan as SubjectPracticeQuestionPlan,
      validation: originalValidation,
      attempts: [],
      budget: { used: 0, maximum },
      reasonCode: null
    };
  }
  if (maximum === 0) {
    return {
      ...base,
      status: 'repair_budget_exhausted',
      repairedPlan: null,
      validation: originalValidation,
      attempts: [],
      budget: { used: 0, maximum },
      reasonCode: 'question_plan_repair_budget_exhausted'
    };
  }
  const requestedTaskFamily = cleanText(input.taskFamily ?? originalPlan?.taskFamily) || null;
  const strategies: Array<{
    strategy: 'rebuild_registered_template_same_family' | 'rebuild_registered_template_default_family';
    taskFamily: string | null;
  }> = [
    { strategy: 'rebuild_registered_template_same_family', taskFamily: requestedTaskFamily },
    { strategy: 'rebuild_registered_template_default_family', taskFamily: null }
  ];
  const attempts: SubjectPracticeQuestionPlanRepairResult['attempts'] = [];
  const seen = new Set<string>();
  for (const entry of strategies) {
    if (attempts.length >= maximum) break;
    const candidate = buildSubjectPracticeQuestionPlan({
      subject: input.subject,
      topicId: input.topicId,
      topicTitle: input.topicTitle,
      productionCellId: input.productionCellId,
      targetDifficulty: input.targetDifficulty,
      taskFamily: entry.taskFamily
    });
    const identity = candidate ? `${candidate.planTemplate}:${candidate.taskFamily}` : `${entry.strategy}:none`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    let validation = candidate ? validateSubjectPracticeQuestionPlan(candidate) : null;
    if (candidate && entry.strategy === 'rebuild_registered_template_same_family' && requestedTaskFamily && candidate.taskFamily !== requestedTaskFamily) {
      validation = {
        ...(validation ?? originalValidation),
        valid: false,
        failureCodes: Array.from(new Set([
          ...(validation?.failureCodes ?? []),
          'plan_repair_requested_task_family_unavailable'
        ]))
      };
    }
    attempts.push({
      attemptIndex: attempts.length + 1,
      strategy: entry.strategy,
      candidateBuilt: Boolean(candidate),
      validation
    });
    if (candidate && validation?.valid) {
      return {
        ...base,
        status: 'repaired',
        repairedPlan: candidate,
        validation,
        attempts,
        budget: { used: attempts.length, maximum },
        reasonCode: null
      };
    }
  }
  const anyCandidateBuilt = attempts.some((attempt) => attempt.candidateBuilt);
  const exhausted = anyCandidateBuilt && attempts.length >= maximum;
  return {
    ...base,
    status: exhausted ? 'repair_budget_exhausted' : 'unrepairable',
    repairedPlan: null,
    validation: originalValidation,
    attempts,
    budget: { used: attempts.length, maximum },
    reasonCode: exhausted ? 'question_plan_repair_budget_exhausted' : 'question_plan_registered_template_unavailable'
  };
}

export function subjectPracticeQuestionPlanAttemptFor(input: {
  attemptId?: string | null;
  attemptIndex?: number | null;
  phase?: 'enqueue' | 'candidate_evaluated' | null;
  gate?: SubjectPracticeQuestionPlanGate | null;
  questionPlan?: unknown;
  adherence?: SubjectPracticeQuestionPlanAdherence | null;
  failureRoute?: SubjectPracticeQuestionPlanFailureRoute | null;
  previousAttempt?: unknown;
  planRepairCount?: number | null;
  now?: string | null;
}): SubjectPracticeQuestionPlanAttempt {
  const gate = input.gate ?? null;
  const plan = recordFrom(input.questionPlan);
  const budget = recordFrom(plan?.budget);
  const attemptIndex = positiveInt(input.attemptIndex, 1);
  const route = input.failureRoute ?? null;
  const phase = input.phase ?? 'enqueue';
  const previousAttempt = recordFrom(input.previousAttempt);
  const previousBudget = recordFrom(previousAttempt?.budget);
  const previousRoute = recordFrom(previousAttempt?.route);
  const maxPlanRepairs = boundedRepairLimit(
    budget?.maxPlanRepairs,
    boundedRepairLimit(previousBudget?.maxPlanRepairs, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS),
    SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS
  );
  const maxCandidateRepairs = boundedRepairLimit(
    budget?.maxCandidateRepairs,
    boundedRepairLimit(previousBudget?.maxCandidateRepairs, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS),
    SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS
  );
  let planRepairCount = Math.max(0, Math.floor(Number(previousBudget?.planRepairCount) || 0));
  let candidateRepairCount = Math.max(0, Math.floor(Number(previousBudget?.candidateRepairCount) || 0));
  if (phase === 'enqueue' && cleanText(previousRoute?.action) === 'repair_plan') planRepairCount += 1;
  if (phase === 'enqueue' && cleanText(previousRoute?.action) === 'repair_candidate_rendering') candidateRepairCount += 1;
  if (input.planRepairCount != null) {
    planRepairCount = Math.max(planRepairCount, Math.max(0, Math.floor(Number(input.planRepairCount) || 0)));
  }
  let status: SubjectPracticeQuestionPlanAttempt['status'] = 'not_applicable';
  if (gate?.applicable && !gate.enabled) status = 'shadow_disabled';
  if (gate?.applicable && gate.enabled && !plan) status = 'plan_missing';
  if (gate?.applicable && gate.enabled && plan && gate.validation && !gate.validation.valid) status = 'plan_invalid';
  if (gate?.applicable && gate.enabled && plan && gate.validation?.valid === true) status = 'plan_ready';
  if (gate?.applicable && gate.enabled && plan && gate.validation?.valid === true && !gate.generationAllowed) status = 'plan_target_profile_conflict';
  if (phase === 'candidate_evaluated' && route?.stage === 'delivery') status = 'delivery_failed';
  else if (phase === 'candidate_evaluated' && route?.stage === 'candidate_plan_adherence') status = 'candidate_needs_repair';
  else if (phase === 'candidate_evaluated' && route?.stage === 'reviewer_or_gate') status = 'reviewer_or_gate_failed';
  else if (phase === 'candidate_evaluated' && input.adherence?.adheres === true) status = 'candidate_adheres';

  return {
    lifecycleVersion: 'subject-practice-question-plan-attempt-v1',
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    attemptId: displayText(input.attemptId) || null,
    attemptIndex,
    phase,
    status,
    planSource: plan ? 'provided_or_scaffold' : 'none',
    planTemplate: gate?.planTemplate ?? input.adherence?.planTemplate ?? null,
    taskFamily: gate?.taskFamily ?? input.adherence?.taskFamily ?? null,
    budget: {
      planRepairCount,
      candidateRepairCount,
      maxPlanRepairs,
      maxCandidateRepairs
    },
    route,
    productionImpact: 'none_metadata_only',
    providerImpact: 'none_no_provider_call',
    updatedAt: displayText(input.now) || new Date().toISOString()
  };
}

export function subjectPracticeQuestionPlanRepairBudgetDecisionFor(input: {
  attempt?: unknown;
  failureRoute?: unknown;
}): SubjectPracticeQuestionPlanRepairBudgetDecision {
  const attempt = recordFrom(input.attempt);
  const budget = recordFrom(attempt?.budget);
  const failureRoute = recordFrom(input.failureRoute) ?? recordFrom(attempt?.route);
  const action = cleanText(failureRoute?.action) as SubjectPracticeQuestionPlanFailureRoute['action'];
  const repairKind = action === 'repair_plan'
    ? 'plan'
    : action === 'repair_candidate_rendering'
      ? 'candidate'
      : 'none';
  const used = repairKind === 'plan'
    ? Math.max(0, Math.floor(Number(budget?.planRepairCount) || 0))
    : repairKind === 'candidate'
      ? Math.max(0, Math.floor(Number(budget?.candidateRepairCount) || 0))
      : 0;
  const maximum = repairKind === 'plan'
    ? boundedRepairLimit(budget?.maxPlanRepairs, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_PLAN_REPAIRS)
    : repairKind === 'candidate'
      ? boundedRepairLimit(budget?.maxCandidateRepairs, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS, SUBJECT_PRACTICE_QUESTION_PLAN_MAX_CANDIDATE_REPAIRS)
      : 0;
  const allowed = repairKind !== 'none' && used < maximum;
  return {
    policyVersion: 'subject-practice-question-plan-repair-budget-v1',
    status: repairKind === 'none' ? 'not_applicable' : allowed ? 'repair_allowed' : 'repair_budget_exhausted',
    action: action || 'none',
    repairKind,
    used,
    maximum,
    nextUsed: allowed ? used + 1 : used,
    allowed,
    reasonCode: repairKind === 'none'
      ? null
      : allowed
        ? null
        : repairKind === 'plan'
          ? 'question_plan_repair_budget_exhausted'
          : 'question_plan_candidate_repair_budget_exhausted',
    productionImpact: 'none_policy_only',
    providerImpact: 'none_no_provider_call'
  };
}

export function subjectPracticeQuestionPlanTemplateFor(input: {
  subject?: string | null;
  productionCellId?: number | string | null;
  topicTitle?: string | null;
  targetDifficulty?: string | null;
  taskFamily?: string | null;
  planTemplate?: string | null;
}): SubjectPracticeQuestionPlanTemplate | null {
  const subject = cleanText(input.subject);
  const cellId = cleanText(input.productionCellId);
  const topicTitle = cleanText(input.topicTitle);
  const difficulty = cleanText(input.targetDifficulty);
  const taskFamily = cleanText(input.taskFamily);
  const planTemplate = cleanText(input.planTemplate);
  const candidates = SUBJECT_PRACTICE_QUESTION_PLAN_TEMPLATES.filter((template) => {
    if (subject && subject !== template.subject) return false;
    if (difficulty && difficulty !== template.targetDifficulty) return false;
    if (taskFamily && taskFamily !== template.taskFamily && !subjectPracticeQuestionPlanTemplateSupportsTaskFamily(template, taskFamily)) return false;
    if (planTemplate && planTemplate !== template.planTemplate) return false;
    const seedCellMatch = Boolean(cellId && cellId === template.productionCellId);
    const topicTitleMatch = Boolean(topicTitle && template.topicTitleIncludes.some((needle) => topicTitle.includes(needle)));
    if (!seedCellMatch && !topicTitleMatch) return false;
    return true;
  });
  const exactCellTemplate = candidates.find((template) => cellId && cellId === template.productionCellId);
  if (exactCellTemplate) return exactCellTemplate;
  return candidates
    .map((template, index) => ({
      template,
      index,
      topicSpecificity: topicTitle
        ? Math.max(0, ...template.topicTitleIncludes
          .filter((needle) => topicTitle.includes(needle))
          .map((needle) => needle.length))
        : 0
    }))
    .sort((left, right) => right.topicSpecificity - left.topicSpecificity || left.index - right.index)[0]?.template
    ?? null;
}

function subjectPracticeQuestionPlanTemplateSupportsTaskFamily(template: SubjectPracticeQuestionPlanTemplate, taskFamily?: string | null) {
  const family = cleanText(taskFamily);
  if (!family) return false;
  if (family === template.taskFamily) return true;
  const supported: Record<string, string[]> = {
    math_probability_counting_relation_v1: [
      'probability_multi_event_counting',
      'normal_distribution_z_score_probability'
    ],
    math_vector_complex_relation_v1: [
      'vector_coordinate_norm_dot_angle',
      'complex_mod_vector_dot_product',
      'complex_conjugate_linear_equation_solve',
      'vector_complex_two_object_relation_judgement',
      'complex_vector_conversion_then_property'
    ],
    math_derivative_condition_chain_v1: [
      'derivative_direct_evaluation',
      'derivative_tangent_constraint'
    ],
    math_analytic_geometry_relation_v1: [
      'coordinate_geometry_point_to_plane_distance',
      'circle_line_chord_length',
      'conic_shared_focus_relation',
      'spatial_coordinate_direct_metric'
    ],
    math_line_relation_direct_v1: [
      'math_line_relation_direct'
    ],
    math_function_property_by_difficulty_v1: [
      'function_monotonicity_parity_statement',
      'quadratic_function_properties',
      'rational_inequality_solution_boundary',
      'inequality_order_property_counterexample',
      'basic_function_direct_property',
      'hard_function_multi_condition_property'
    ],
    math_medium_function_two_move_reasoning_v1: [
      'function_monotonicity_parity_statement',
      'quadratic_function_properties',
      'medium_function_property_combination'
    ],
    math_medium_exp_log_ordering_chain_v1: [
      'elementary_function_exp_log_ordering',
      'logarithmic_equation_domain_solution'
    ],
    math_medium_function_parameter_constraint_v1: [
      'function_quadratic_parameter_property',
      'quadratic_function_properties'
    ],
    math_elementary_function_relation_v1: [
      'elementary_function_exp_log_ordering',
      'logarithmic_equation_domain_solution',
      'quadratic_function_properties',
      'elementary_function_direct_property',
      'hard_elementary_function_parameter_or_inequality'
    ],
    math_sequence_condition_relation_v1: [
      'arithmetic_sequence_two_condition_solve_a1_d',
      'geometric_sequence_two_condition_solve_q',
      'hard_sequence_multi_constraint_reasoning'
    ],
    math_statistics_relation_v1: [
      'combined_variance',
      'normal_distribution_z_score_probability',
      'mean_removed_value',
      'direct_variance_formula',
      'hard_statistics_multi_step_inference'
    ],
    math_spatial_geometry_relation_v1: [
      'coordinate_geometry_point_to_plane_distance',
      'spatial_coordinate_direct_metric',
      'spatial_line_plane_concept_judgement',
      'spatial_vector_angle_cosine',
      'medium_geometry_coordinate_vector_reasoning',
      'hard_spatial_multi_constraint_vector_reasoning'
    ],
    physics_kinematics_basic_relation_v1: [
      'kinematics_basic_direct_relation',
      'kinematics_motion_graph_interpretation'
    ],
    physics_medium_optics_two_relation_v1: [
      'waves_optics_interference_refraction'
    ],
    chemistry_medium_classification_evidence_v1: [
      'classification_state_change_evidence_judgement'
    ],
    basic_ph_measurement_preparation_error_v1: [
      'basic_ph_measurement_or_preparation_error_judgement'
    ],
    chemistry_strong_acid_base_single_relation_v1: [
      'ph_dilution_strong_acid_base_neutralization'
    ]
  };
  return (supported[template.planTemplate] ?? []).includes(family);
}

export function subjectPracticeQuestionPlanSupportsTaskFamily(plan: unknown, taskFamily?: string | null) {
  const record = (plan && typeof plan === 'object' && !Array.isArray(plan)) ? plan as Partial<SubjectPracticeQuestionPlan> : {};
  const family = cleanText(taskFamily);
  if (!family) return false;
  if (family === cleanText(record.taskFamily)) return true;
  const template = subjectPracticeQuestionPlanTemplateFor({
    subject: record.subject,
    productionCellId: record.productionCellId,
    topicTitle: record.topicTitle,
    targetDifficulty: record.targetDifficulty,
    planTemplate: record.planTemplate
  });
  return template ? subjectPracticeQuestionPlanTemplateSupportsTaskFamily(template, family) : false;
}

export function validateSubjectPracticeQuestionPlan(plan: unknown): SubjectPracticeQuestionPlanValidation {
  const record = (plan && typeof plan === 'object') ? plan as Partial<SubjectPracticeQuestionPlan> : {};
  const failureCodes: string[] = [];
  if (record.schemaVersion !== SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION) failureCodes.push('plan_schema_version_missing_or_mismatch');
  if (record.policyVersion !== SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION) failureCodes.push('plan_policy_version_missing_or_mismatch');
  if (!['chemistry', 'math', 'physics'].includes(cleanText(record.subject))) failureCodes.push('plan_subject_not_enabled');

  const template = subjectPracticeQuestionPlanTemplateFor({
    subject: record.subject,
    productionCellId: record.productionCellId,
    topicTitle: record.topicTitle,
    targetDifficulty: record.targetDifficulty,
    taskFamily: record.taskFamily,
    planTemplate: record.planTemplate
  });
  if (!template) failureCodes.push('plan_topic_template_incompatible');

  const evidenceSlots = arrayFrom(record.evidenceSlots);
  const reasoningSteps = arrayFrom(record.reasoningSteps);
  const quantitativeRelations = arrayFrom(record.quantitativeRelations);
  const hypotheses = arrayFrom(record.hypotheses);
  const uniquenessConditions = arrayFrom(record.uniquenessConditions);
  const answerDerivation = arrayFrom(record.answerDerivation);

  if (!evidenceSlots.length) failureCodes.push('plan_evidence_slots_missing');
  if (!reasoningSteps.length) failureCodes.push('plan_reasoning_steps_missing');

  if (template) {
    const independentGroups = uniqueNonEmpty(evidenceSlots.map((slot) => slot.independentGroup));
    const discriminatingEvidence = evidenceSlots.filter((slot) => cleanText(slot.role).includes('discriminat'));
    const reactionEvidenceGroups = uniqueNonEmpty(evidenceSlots
      .filter((slot) => cleanText(slot.type).includes('reaction') || cleanText(slot.role).includes('reaction'))
      .map((slot) => slot.independentGroup ?? slot.id));
    const causalSteps = reasoningSteps.filter((step) => cleanText(step.operation).includes('causal') || cleanText(step.operation).includes('propagat'));
    const allRelationRoundTrips = quantitativeRelations.every((relation) => relation.roundTripCheck === true);
    const connectedInputs = new Set(reasoningSteps.flatMap((step) => step.inputs.map(cleanText)));
    const evidenceIds = new Set(evidenceSlots.map((slot) => cleanText(slot.id)));
    const hasEvidenceBackedStep = Array.from(evidenceIds).some((id) => connectedInputs.has(id));

    if (evidenceSlots.length < template.minimumEvidenceSlots) failureCodes.push('plan_evidence_slots_missing');
    if (independentGroups.length < template.minimumIndependentEvidenceGroups) failureCodes.push('plan_independent_evidence_groups_missing');
    if (reasoningSteps.length < template.minimumReasoningSteps) failureCodes.push('plan_reasoning_path_too_short');
    if (!hasEvidenceBackedStep) failureCodes.push('plan_reasoning_graph_disconnected');
    if ((template.minimumHypotheses ?? 0) > 0 && hypotheses.length < (template.minimumHypotheses ?? 0)) failureCodes.push('plan_competing_hypotheses_missing');
    if ((template.minimumDiscriminatingEvidenceSlots ?? 0) > 0 && discriminatingEvidence.length < (template.minimumDiscriminatingEvidenceSlots ?? 0)) failureCodes.push('plan_discriminating_evidence_missing');
    if ((template.minimumQuantitativeRelations ?? 0) > 0 && quantitativeRelations.length < (template.minimumQuantitativeRelations ?? 0)) failureCodes.push('plan_quantitative_relation_missing');
    if (quantitativeRelations.length > 0 && !allRelationRoundTrips) failureCodes.push('plan_quantitative_relation_invalid');
    if ((template.minimumIndependentReactionEvidence ?? 0) > 0 && reactionEvidenceGroups.length < (template.minimumIndependentReactionEvidence ?? 0)) failureCodes.push('plan_independent_reaction_evidence_missing');
    if (template.requiresCausalPropagation && causalSteps.length < 1) failureCodes.push('plan_causal_propagation_missing');
    if (template.requiresUniqueAnswer && uniquenessConditions.length < 1) failureCodes.push('plan_answer_not_unique');
    if (!answerDerivation.length) failureCodes.push('plan_answer_derivation_missing');

    const scenarioContractRequired = [
      'elementary_function_direct_property',
      'math_line_relation_direct',
      'kinematics_basic_direct_relation',
      'ph_dilution_strong_acid_base_neutralization'
    ].includes(cleanText(record.taskFamily));
    if (scenarioContractRequired) {
      failureCodes.push(...validateSubjectPracticeScenarioContract({ questionPlan: record }).failureCodes);
    }
  }

  const renderConstraints = (record.renderConstraints && typeof record.renderConstraints === 'object')
    ? record.renderConstraints as Record<string, unknown>
    : {};
  if (renderConstraints.externalContextAllowed === true) failureCodes.push('plan_external_context_dependency');
  if (renderConstraints.requiresImage === true) failureCodes.push('plan_external_context_dependency');

  return {
    policyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    schemaVersion: SUBJECT_PRACTICE_QUESTION_PLAN_SCHEMA_VERSION,
    valid: failureCodes.length === 0,
    failureCodes,
    template: template?.planTemplate ?? null,
    taskFamily: template?.taskFamily ?? (cleanText(record.taskFamily) || null)
  };
}
