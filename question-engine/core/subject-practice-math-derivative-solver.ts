import type { GeneratedQuestionCandidate } from './types';
import { verifySubjectPracticeMathDerivativeToolCandidate } from './subject-practice-math-derivative-tool-verifier';

export const SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION =
  'subject-practice-math-derivative-solver-v1-direct-polynomial-value';
export const SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION =
  'subject-practice-math-derivative-scope-v1';

export type MathDerivativeScope = 'direct_polynomial_value';

export type SubjectPracticeMathDerivativeSolverEvidence = {
  solverVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  taskFamily: 'derivative_direct_evaluation';
  scopeId: string | null;
  canonicalTask: Record<string, unknown> | null;
  selectedOptionId: string | null;
  trueOptionIds: string[];
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  verificationScope: {
    scopeVersion: string;
    scopeId: string | null;
    matched: boolean;
    exactScope: MathDerivativeScope | null;
    reasonCodes: string[];
  };
  evidenceBoundary: 'visible_prompt_and_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactScope(questionPlan: unknown): MathDerivativeScope | null {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  return String(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && String(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && String(plan?.subject).toLowerCase() === 'math'
    && String(plan?.taskFamily) === 'derivative_direct_evaluation'
    && String(plan?.planTemplate) === 'math_derivative_condition_chain_v1'
    && String(plan?.targetDifficulty).toLowerCase() === 'basic'
    && String(constraints?.exactDerivativeScope) === 'direct_polynomial_value'
    ? 'direct_polynomial_value'
    : null;
}

export function solveSubjectPracticeMathDerivative(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathDerivativeSolverEvidence {
  const scope = exactScope(context.questionPlan);
  const scopeId = scope ? `math-basic-derivative-v1:${scope}` : null;
  const verification = verifySubjectPracticeMathDerivativeToolCandidate({
    candidate,
    taskFamily: 'derivative_direct_evaluation',
    questionPlan: context.questionPlan
  });
  const reasonCodes = [...verification.reasonCodes];
  if (!scope) reasonCodes.push('math_derivative_solver_plan_scope_mismatch');
  return {
    solverVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
    status: scope ? verification.status : 'unparsed',
    taskFamily: 'derivative_direct_evaluation',
    scopeId,
    canonicalTask: scope && verification.parsed
      ? {
        kind: scope,
        expression: verification.normalizedExpression,
        point: verification.evaluationPoint,
        expectedValue: verification.expectedValue
      }
      : null,
    selectedOptionId: verification.selectedOptionId,
    trueOptionIds: verification.trueOptionIds,
    uniqueAnswer: verification.trueOptionIds.length === 1,
    agreesWithGenerator: verification.agreesWithGenerator,
    verificationScope: {
      scopeVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION,
      scopeId,
      matched: Boolean(scope && verification.parsed),
      exactScope: scope,
      reasonCodes: scope ? [] : ['math_derivative_solver_plan_scope_mismatch']
    },
    evidenceBoundary: 'visible_prompt_and_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}


