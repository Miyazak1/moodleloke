import type { GeneratedQuestionCandidate } from './types';
import { verifySubjectPracticeMathDerivativeToolCandidate } from './subject-practice-math-derivative-tool-verifier';

export const SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION =
  'subject-practice-math-derivative-explanation-verifier-v1';

export type SubjectPracticeMathDerivativeExplanationEvidence = {
  verifierVersion: string;
  status: 'verified' | 'failed' | 'unparsed';
  scopeId: string | null;
  evidenceBoundary: 'candidate_explanation_checked_against_visible_prompt_solution';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

export function verifySubjectPracticeMathDerivativeExplanation(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathDerivativeExplanationEvidence {
  const solved = verifySubjectPracticeMathDerivativeToolCandidate({
    candidate,
    taskFamily: 'derivative_direct_evaluation',
    questionPlan: context.questionPlan
  });
  const explanation = String(candidate.explanation ?? '').replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
  const expected = solved.expectedValue?.replace('-', '\\-');
  const hasDerivativeStep = /f\s*['′]\s*\(\s*x\s*\)\s*=/.test(explanation);
  const hasExpectedConclusion = expected
    ? new RegExp(`f\\s*['′]\\s*\\([^)]*\\)\\s*=\\s*${expected}(?:\\D|$)`).test(explanation)
    : false;
  const reasonCodes: string[] = [];
  if (solved.status !== 'verified') reasonCodes.push('math_derivative_explanation_visible_solution_unavailable');
  if (!hasDerivativeStep) reasonCodes.push('math_derivative_explanation_derivative_step_missing');
  if (!hasExpectedConclusion) reasonCodes.push('math_derivative_explanation_expected_value_missing');
  const status = solved.status !== 'verified'
    ? 'unparsed'
    : hasDerivativeStep && hasExpectedConclusion ? 'verified' : 'failed';
  return {
    verifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_EXPLANATION_VERIFIER_VERSION,
    status,
    scopeId: solved.verificationScopeId
      ? 'math-basic-derivative-v1:direct_polynomial_value'
      : null,
    evidenceBoundary: 'candidate_explanation_checked_against_visible_prompt_solution',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes
  };
}


