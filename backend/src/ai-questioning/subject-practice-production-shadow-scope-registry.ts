import { SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION } from './subject-practice-question-plan-policy';
import {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION
} from './subject-practice-math-solver';
import {
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION
} from './subject-practice-math-line-relation-solver';
import {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION
} from './subject-practice-math-derivative-solver';
import {
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION
} from './subject-practice-physics-kinematics-solver';
import {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION
} from './subject-practice-chemistry-acid-base-solver';
import { SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION } from './subject-practice-math-elementary-local-generator';
import { SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION } from './subject-practice-math-line-relation-local-generator';
import { SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION } from './subject-practice-math-derivative-local-generator';
import { SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION } from './subject-practice-physics-kinematics-local-generator';
import { SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION } from './subject-practice-chemistry-acid-base-local-generator';
import { SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION } from './subject-practice-math-elementary-explanation-verifier';
import { SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION } from './subject-practice-math-line-relation-explanation-verifier';
import { SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION } from './subject-practice-math-derivative-explanation-verifier';
import { SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION } from './subject-practice-physics-kinematics-explanation-verifier';
import { SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION } from './subject-practice-chemistry-acid-base-explanation-verifier';
import { SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION } from './subject-practice-math-elementary-independent-oracle';
import { SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION } from './subject-practice-math-line-relation-independent-oracle';
import { SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION } from './subject-practice-math-derivative-independent-oracle';
import { SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION } from './subject-practice-physics-kinematics-independent-oracle';
import { SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION } from './subject-practice-chemistry-acid-base-independent-oracle';
import { SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION } from './subject-practice-formal-verification-orchestrator';
import { SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION } from './question-generator-provider.service';
import {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} from './subject-practice-generator-source-isolation-policy';

export const SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION =
  'subject-practice-production-shadow-scope-registry-v7-math-derivative';

export type SubjectPracticeProductionShadowScopeContract = {
  registryVersion: string;
  subject: 'math' | 'physics' | 'chemistry';
  taskFamily: string;
  planTemplate: string;
  expectedScopeIds: string[];
  expectedBinding: {
    subject: 'math' | 'physics' | 'chemistry';
    taskFamily: string;
    planTemplate: string;
    questionPlanPolicyVersion: string;
    generatorVersion: string;
    solverVersion: string;
    verificationScopeVersion: string;
    explanationVerifierVersion: string;
    independentOracleVersion: string;
    sourceIsolationPolicyVersion: string;
    sourceIsolationBoundary: string;
    sourceIsolationAllowedInput: string;
    sourceIsolationOriginalQuestionContentOmitted: boolean;
    sourceIsolationReversibleSourceFieldsOmitted: boolean;
    sourceIsolationDeveloperUnseenRequired: boolean;
    sourceIsolationOfficialHoldoutRequired: boolean;
    sourceIsolationSourceLinkageIdentifiersOmitted: boolean;
    sourceIsolationProfileAggregationPolicyVersion: string;
    sourceIsolationProfileMinimumSampleSize: number;
    sourceIsolationProfileProjectionMode: string;
    sourceIsolationProjectionHashRecomputed: boolean;
    sourceIsolationKnownSourceCorpusComparisonPassed: boolean;
    sourceIsolationKnownSourceLeakMatchCount: number;
    formalVerificationOrchestratorVersion: string;
    localShadowRoutingVersion: string;
  };
};

const commonBinding = {
  questionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
  sourceIsolationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  sourceIsolationBoundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  sourceIsolationAllowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  sourceIsolationOriginalQuestionContentOmitted: true,
  sourceIsolationReversibleSourceFieldsOmitted: true,
  sourceIsolationDeveloperUnseenRequired: false,
  sourceIsolationOfficialHoldoutRequired: false,
  sourceIsolationSourceLinkageIdentifiersOmitted: true,
  sourceIsolationProfileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  sourceIsolationProfileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  sourceIsolationProfileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
  sourceIsolationProjectionHashRecomputed: true,
  sourceIsolationKnownSourceCorpusComparisonPassed: true,
  sourceIsolationKnownSourceLeakMatchCount: 0,
  formalVerificationOrchestratorVersion: SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION,
  localShadowRoutingVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION
};

const CONTRACTS: SubjectPracticeProductionShadowScopeContract[] = [
  {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    subject: 'math',
    taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1',
    expectedScopeIds: [
      'math-basic-elementary-rotation-v1:logarithmic:domain',
      'math-basic-elementary-rotation-v1:exponential:range',
      'math-basic-elementary-rotation-v1:radical:monotonicity',
      'math-basic-elementary-rotation-v1:power:function_value'
    ],
    expectedBinding: {
      ...commonBinding,
      subject: 'math',
      taskFamily: 'elementary_function_direct_property',
      planTemplate: 'math_elementary_function_relation_v1',
      generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
      solverVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
      verificationScopeVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION,
      explanationVerifierVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION,
      independentOracleVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION
    }
  },
  {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    subject: 'math',
    taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    expectedScopeIds: [
      'math-basic-line-relation-v1:slope_from_two_distinct_points',
      'math-basic-line-relation-v1:inclination_angle_from_line',
      'math-basic-line-relation-v1:identify_parallel_or_perpendicular_line',
      'math-basic-line-relation-v1:line_equation_from_point_and_slope'
    ],
    expectedBinding: {
      ...commonBinding,
      subject: 'math',
      taskFamily: 'math_line_relation_direct',
      planTemplate: 'math_line_relation_direct_v1',
      generatorVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION,
      solverVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
      verificationScopeVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION,
      explanationVerifierVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION,
      independentOracleVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION
    }
  },
  {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    subject: 'math',
    taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    expectedScopeIds: ['math-basic-derivative-v1:direct_polynomial_value'],
    expectedBinding: {
      ...commonBinding,
      subject: 'math',
      taskFamily: 'derivative_direct_evaluation',
      planTemplate: 'math_derivative_condition_chain_v1',
      generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
      solverVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
      verificationScopeVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION,
      explanationVerifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION,
      independentOracleVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION
    }
  },
  {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    subject: 'physics',
    taskFamily: 'kinematics_basic_direct_relation',
    planTemplate: 'physics_kinematics_basic_relation_v1',
    expectedScopeIds: [
      'physics-basic-kinematics-v2:uniform_speed',
      'physics-basic-kinematics-v2:acceleration_from_velocity_change',
      'physics-basic-kinematics-v2:final_velocity_from_initial_acceleration_time',
      'physics-basic-kinematics-v2:displacement_from_initial_acceleration_time'
    ],
    expectedBinding: {
      ...commonBinding,
      subject: 'physics',
      taskFamily: 'kinematics_basic_direct_relation',
      planTemplate: 'physics_kinematics_basic_relation_v1',
      generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
      solverVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
      verificationScopeVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION,
      explanationVerifierVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION,
      independentOracleVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION
    }
  },
  {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    subject: 'chemistry',
    taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    planTemplate: 'chemistry_strong_acid_base_single_relation_v1',
    expectedScopeIds: [
      'chemistry-strong-acid-base-v3:strong_acid_dilution:ph_value',
      'chemistry-strong-acid-base-v3:strong_acid_dilution:acid_base_character',
      'chemistry-strong-acid-base-v3:strong_base_dilution:ph_value',
      'chemistry-strong-acid-base-v3:strong_base_dilution:acid_base_character',
      'chemistry-strong-acid-base-v3:strong_acid_base_neutralization:ph_value',
      'chemistry-strong-acid-base-v3:strong_acid_base_neutralization:acid_base_character'
    ],
    expectedBinding: {
      ...commonBinding,
      subject: 'chemistry',
      taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      planTemplate: 'chemistry_strong_acid_base_single_relation_v1',
      generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
      solverVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
      verificationScopeVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION,
      explanationVerifierVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION,
      independentOracleVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
    }
  }
];

export function subjectPracticeProductionShadowScopeContracts() {
  return CONTRACTS.map((contract) => ({
    ...contract,
    expectedScopeIds: [...contract.expectedScopeIds],
    expectedBinding: { ...contract.expectedBinding }
  }));
}

export function subjectPracticeProductionShadowScopeContractFor(
  subject: unknown,
  taskFamily?: unknown,
  planTemplate?: unknown
) {
  const normalized = String(subject ?? '').trim().toLowerCase();
  const normalizedFamily = String(taskFamily ?? '').trim();
  const normalizedTemplate = String(planTemplate ?? '').trim();
  const candidates = CONTRACTS.filter((entry) => entry.subject === normalized
    && (!normalizedFamily || entry.taskFamily === normalizedFamily)
    && (!normalizedTemplate || entry.planTemplate === normalizedTemplate));
  const contract = candidates.length === 1 ? candidates[0] : null;
  return contract ? {
    ...contract,
    expectedScopeIds: [...contract.expectedScopeIds],
    expectedBinding: { ...contract.expectedBinding }
  } : null;
}
