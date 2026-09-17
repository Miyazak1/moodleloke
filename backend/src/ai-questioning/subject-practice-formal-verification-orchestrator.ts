import { GeneratedQuestionCandidate } from './ai-questioning.types';
import {
  solveElementaryFunctionDirectProperty,
  SubjectPracticeMathSolverEvidence
} from './subject-practice-math-solver';
import {
  solveSubjectPracticeMathLineRelation,
  SubjectPracticeMathLineRelationSolverEvidence
} from './subject-practice-math-line-relation-solver';
import {
  solveSubjectPracticePhysicsKinematics,
  SubjectPracticePhysicsKinematicsSolverEvidence
} from './subject-practice-physics-kinematics-solver';
import {
  solveSubjectPracticeChemistryAcidBase,
  SubjectPracticeChemistryAcidBaseSolverEvidence
} from './subject-practice-chemistry-acid-base-solver';
import {
  verifySubjectPracticeMathElementaryExplanation,
  SubjectPracticeMathElementaryExplanationEvidence
} from './subject-practice-math-elementary-explanation-verifier';
import {
  verifySubjectPracticeMathLineRelationExplanation,
  SubjectPracticeMathLineRelationExplanationEvidence
} from './subject-practice-math-line-relation-explanation-verifier';
import {
  verifySubjectPracticePhysicsKinematicsExplanation,
  SubjectPracticePhysicsKinematicsExplanationEvidence
} from './subject-practice-physics-kinematics-explanation-verifier';
import {
  verifySubjectPracticeChemistryAcidBaseExplanation,
  SubjectPracticeChemistryAcidBaseExplanationEvidence
} from './subject-practice-chemistry-acid-base-explanation-verifier';
import {
  verifySubjectPracticeMathElementaryWithIndependentOracle,
  SubjectPracticeMathElementaryIndependentOracleEvidence
} from './subject-practice-math-elementary-independent-oracle';
import {
  verifySubjectPracticeMathLineRelationWithIndependentOracle,
  SubjectPracticeMathLineRelationIndependentOracleEvidence
} from './subject-practice-math-line-relation-independent-oracle';
import {
  verifySubjectPracticePhysicsKinematicsWithIndependentOracle,
  SubjectPracticePhysicsKinematicsIndependentOracleEvidence
} from './subject-practice-physics-kinematics-independent-oracle';
import {
  verifySubjectPracticeChemistryAcidBaseWithIndependentOracle,
  SubjectPracticeChemistryAcidBaseIndependentOracleEvidence
} from './subject-practice-chemistry-acid-base-independent-oracle';
import {
  solveSubjectPracticeMathDerivative,
  SubjectPracticeMathDerivativeSolverEvidence
} from './subject-practice-math-derivative-solver';
import {
  verifySubjectPracticeMathDerivativeExplanation,
  SubjectPracticeMathDerivativeExplanationEvidence
} from './subject-practice-math-derivative-explanation-verifier';
import {
  verifySubjectPracticeMathDerivativeWithIndependentOracle,
  SubjectPracticeMathDerivativeIndependentOracleEvidence
} from './subject-practice-math-derivative-independent-oracle';

export const SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION =
  'subject-practice-formal-verification-orchestrator-v2';

type SolverEvidence = SubjectPracticeMathSolverEvidence
  | SubjectPracticeMathLineRelationSolverEvidence
  | SubjectPracticeMathDerivativeSolverEvidence
  | SubjectPracticePhysicsKinematicsSolverEvidence
  | SubjectPracticeChemistryAcidBaseSolverEvidence;
type ExplanationEvidence = SubjectPracticeMathElementaryExplanationEvidence
  | SubjectPracticeMathLineRelationExplanationEvidence
  | SubjectPracticeMathDerivativeExplanationEvidence
  | SubjectPracticePhysicsKinematicsExplanationEvidence
  | SubjectPracticeChemistryAcidBaseExplanationEvidence;
type OracleEvidence = SubjectPracticeMathElementaryIndependentOracleEvidence
  | SubjectPracticeMathLineRelationIndependentOracleEvidence
  | SubjectPracticeMathDerivativeIndependentOracleEvidence
  | SubjectPracticePhysicsKinematicsIndependentOracleEvidence
  | SubjectPracticeChemistryAcidBaseIndependentOracleEvidence;

export type SubjectPracticeFormalVerificationBundle = {
  orchestratorVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  subject: 'math' | 'physics' | 'chemistry';
  taskFamily: string;
  planTemplate: string;
  scopeId: string | null;
  plannedScopeId: string | null;
  oracleScopeId: string | null;
  scopeMatchedAcrossVerifiers: boolean;
  solverVersion: string;
  explanationVerifierVersion: string;
  independentOracleVersion: string;
  solverEvidence: SolverEvidence;
  explanationEvidence: ExplanationEvidence;
  independentOracleEvidence: OracleEvidence;
  eligibleForProductionShadowObservation: boolean;
  automaticPublicationEligible: false;
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function verifySubjectPracticeFormalCandidate(input: {
  candidate: GeneratedQuestionCandidate;
  taskFamily: string;
  questionPlan?: unknown;
}): SubjectPracticeFormalVerificationBundle | null {
  const subject = clean(input.candidate.subject).toLowerCase();
  const taskFamily = clean(input.taskFamily);
  const planTemplate = clean(recordFrom(input.questionPlan)?.planTemplate);
  const context = { questionPlan: input.questionPlan };
  let solverEvidence: SolverEvidence;
  let explanationEvidence: ExplanationEvidence;
  let independentOracleEvidence: OracleEvidence;

  if (subject === 'math' && taskFamily === 'elementary_function_direct_property') {
    solverEvidence = solveElementaryFunctionDirectProperty(input.candidate, context);
    explanationEvidence = verifySubjectPracticeMathElementaryExplanation(input.candidate, context);
    independentOracleEvidence = verifySubjectPracticeMathElementaryWithIndependentOracle(input.candidate, context);
  } else if (subject === 'math' && taskFamily === 'math_line_relation_direct') {
    solverEvidence = solveSubjectPracticeMathLineRelation(input.candidate, context);
    explanationEvidence = verifySubjectPracticeMathLineRelationExplanation(input.candidate, context);
    independentOracleEvidence = verifySubjectPracticeMathLineRelationWithIndependentOracle(input.candidate, context);
  } else if (subject === 'math' && taskFamily === 'derivative_direct_evaluation') {
    solverEvidence = solveSubjectPracticeMathDerivative(input.candidate, context);
    explanationEvidence = verifySubjectPracticeMathDerivativeExplanation(input.candidate, context);
    independentOracleEvidence = verifySubjectPracticeMathDerivativeWithIndependentOracle(input.candidate, context);
  } else if (subject === 'physics' && taskFamily === 'kinematics_basic_direct_relation') {
    solverEvidence = solveSubjectPracticePhysicsKinematics(input.candidate, context);
    explanationEvidence = verifySubjectPracticePhysicsKinematicsExplanation(input.candidate, context);
    independentOracleEvidence = verifySubjectPracticePhysicsKinematicsWithIndependentOracle(input.candidate, context);
  } else if (subject === 'chemistry' && taskFamily === 'ph_dilution_strong_acid_base_neutralization') {
    const chemistryContext = { taskFamily, questionPlan: input.questionPlan };
    solverEvidence = solveSubjectPracticeChemistryAcidBase(input.candidate, chemistryContext);
    explanationEvidence = verifySubjectPracticeChemistryAcidBaseExplanation(input.candidate, chemistryContext);
    independentOracleEvidence = verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(input.candidate, chemistryContext);
  } else {
    return null;
  }

  const solverScopeId = solverEvidence.verificationScope.scopeId;
  const oracleScopeId = independentOracleEvidence.scopeId;
  const scopeMatchedAcrossVerifiers = solverEvidence.verificationScope.matched
    && independentOracleEvidence.scopeMatched
    && Boolean(solverScopeId)
    && solverScopeId === oracleScopeId;
  const reasonCodes = [
    ...solverEvidence.reasonCodes,
    ...explanationEvidence.reasonCodes,
    ...independentOracleEvidence.reasonCodes
  ];
  if (!planTemplate) reasonCodes.push('formal_verification_plan_template_missing');
  if (!scopeMatchedAcrossVerifiers) reasonCodes.push('formal_verification_cross_verifier_scope_mismatch');
  const fullyVerified = solverEvidence.status === 'verified'
    && explanationEvidence.status === 'verified'
    && independentOracleEvidence.status === 'verified'
    && scopeMatchedAcrossVerifiers
    && Boolean(planTemplate);
  const hasConflict = solverEvidence.status === 'conflict'
    || explanationEvidence.status === 'failed'
    || independentOracleEvidence.status === 'conflict';
  const status = fullyVerified ? 'verified' : hasConflict ? 'conflict' : 'unparsed';
  if (!fullyVerified) reasonCodes.push(`formal_verification_${status}`);

  return {
    orchestratorVersion: SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION,
    status,
    subject: subject as 'math' | 'physics' | 'chemistry',
    taskFamily,
    planTemplate,
    scopeId: scopeMatchedAcrossVerifiers ? solverScopeId : null,
    plannedScopeId: solverScopeId,
    oracleScopeId,
    scopeMatchedAcrossVerifiers,
    solverVersion: solverEvidence.solverVersion,
    explanationVerifierVersion: explanationEvidence.verifierVersion,
    independentOracleVersion: independentOracleEvidence.oracleVersion,
    solverEvidence,
    explanationEvidence,
    independentOracleEvidence,
    eligibleForProductionShadowObservation: fullyVerified,
    automaticPublicationEligible: false,
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
