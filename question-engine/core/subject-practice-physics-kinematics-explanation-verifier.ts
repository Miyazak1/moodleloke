import { GeneratedQuestionCandidate } from './types';
import {
  solveSubjectPracticePhysicsKinematics,
  SubjectPracticePhysicsKinematicsSolverEvidence
} from './subject-practice-physics-kinematics-solver';

export const SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION = 'physics-kinematics-explanation-verifier-v1';

type ExplanationCheck = {
  language: 'zh' | 'en';
  formulaMatched: boolean;
  promptInputsCovered: boolean;
  conclusionMatched: boolean;
  conclusionValue: number | null;
  conclusionUnit: string | null;
  reasonCodes: string[];
};

export type SubjectPracticePhysicsKinematicsExplanationEvidence = {
  verifierVersion: string;
  status: 'verified' | 'failed' | 'unparsed';
  solverEvidence: SubjectPracticePhysicsKinematicsSolverEvidence;
  recomputedWithoutGeneratorExplanation: true;
  formulaInputsUnitsAndConclusionChecked: true;
  checks: ExplanationCheck[];
  mismatchCount: number;
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function normalized(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＝]/g, '=')
    .replace(/[×·]/g, '*')
    .replace(/²/g, '^2')
    .replace(/\s+/g, '')
    .trim();
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1e-8, Math.abs(right) * 1e-8);
}

function formulaToken(relationKind: SubjectPracticePhysicsKinematicsSolverEvidence['relationKind']) {
  if (relationKind === 'uniform_speed') return 'v=s/t';
  if (relationKind === 'acceleration_from_velocity_change') return 'a=(v-u)/t';
  if (relationKind === 'final_velocity_from_initial_acceleration_time') return 'v=u+at';
  if (relationKind === 'displacement_from_initial_acceleration_time') return 's=ut+1/2at^2';
  return null;
}

function expectedUnit(relationKind: SubjectPracticePhysicsKinematicsSolverEvidence['relationKind']) {
  if (relationKind === 'acceleration_from_velocity_change') return 'm/s^2';
  if (relationKind === 'displacement_from_initial_acceleration_time') return 'm';
  if (relationKind) return 'm/s';
  return null;
}

function promptInputNumbers(prompt: string) {
  const values: string[] = [];
  const pattern = /([+-]?\d+(?:\.\d+)?)\s*(?:m\s*\/\s*s\^?2|m\s*\/\s*s|m|s)(?![a-z/^])/gi;
  for (const match of prompt.matchAll(pattern)) values.push(String(Number(match[1])));
  return Array.from(new Set(values));
}

function containsNumber(text: string, value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9.])${escaped}(?![0-9.])`).test(text);
}

function conclusionFrom(explanation: string) {
  const matches = Array.from(explanation.matchAll(/([+-]?\d+(?:\.\d+)?)\s*(m\s*\/\s*s\^?2|m\s*\/\s*s|m)(?![a-z/^])/gi));
  const match = matches.at(-1);
  if (!match) return { value: null, unit: null };
  return {
    value: Number(match[1]),
    unit: normalized(match[2]).toLowerCase()
  };
}

function checkExplanation(input: {
  language: 'zh' | 'en';
  text: string;
  prompt: string;
  relationKind: SubjectPracticePhysicsKinematicsSolverEvidence['relationKind'];
  expectedValue: number | null;
}): ExplanationCheck {
  const text = normalized(input.text);
  const token = formulaToken(input.relationKind);
  const unit = expectedUnit(input.relationKind);
  const conclusion = conclusionFrom(input.text);
  const formulaMatched = Boolean(token && text.includes(token));
  const promptInputsCovered = promptInputNumbers(input.prompt).every((value) => containsNumber(text, value));
  const conclusionMatched = input.expectedValue !== null
    && conclusion.value !== null
    && conclusion.unit === unit
    && sameNumber(conclusion.value, input.expectedValue);
  const reasonCodes: string[] = [];
  if (!formulaMatched) reasonCodes.push(`physics_explanation_${input.language}_formula_missing_or_wrong`);
  if (!promptInputsCovered) reasonCodes.push(`physics_explanation_${input.language}_prompt_input_missing`);
  if (!conclusionMatched) reasonCodes.push(`physics_explanation_${input.language}_conclusion_or_unit_mismatch`);
  return {
    language: input.language,
    formulaMatched,
    promptInputsCovered,
    conclusionMatched,
    conclusionValue: conclusion.value,
    conclusionUnit: conclusion.unit,
    reasonCodes
  };
}

export function verifySubjectPracticePhysicsKinematicsExplanation(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticePhysicsKinematicsExplanationEvidence {
  const solverEvidence = solveSubjectPracticePhysicsKinematics(candidate, context);
  const english = candidate.localizations?.en;
  const checks = [
    checkExplanation({
      language: 'zh', text: candidate.explanation, prompt: candidate.prompt,
      relationKind: solverEvidence.relationKind, expectedValue: solverEvidence.expectedSiValue
    }),
    checkExplanation({
      language: 'en', text: english?.explanation ?? '', prompt: english?.prompt ?? candidate.prompt,
      relationKind: solverEvidence.relationKind, expectedValue: solverEvidence.expectedSiValue
    })
  ];
  const reasonCodes = checks.flatMap((check) => check.reasonCodes);
  if (solverEvidence.status !== 'verified' || !solverEvidence.verificationScope.matched) {
    reasonCodes.unshift('physics_explanation_answer_recomputation_not_verified');
  }
  const status = solverEvidence.status === 'unparsed'
    ? 'unparsed'
    : reasonCodes.length === 0
      ? 'verified'
      : 'failed';
  return {
    verifierVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_EXPLANATION_VERIFIER_VERSION,
    status,
    solverEvidence,
    recomputedWithoutGeneratorExplanation: true,
    formulaInputsUnitsAndConclusionChecked: true,
    checks,
    mismatchCount: reasonCodes.length,
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
