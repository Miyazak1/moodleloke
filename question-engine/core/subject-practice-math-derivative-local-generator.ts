import {
  GeneratedQuestionCandidate,
  QuestionGenerationBlueprint,
  QuestionOption,
  SubjectPracticeQuestionPlanAdherence,
  SubjectPracticeQuestionPlanPorts
} from './types';
import {
  MathDerivativeScope,
  solveSubjectPracticeMathDerivative,
  SubjectPracticeMathDerivativeSolverEvidence
} from './subject-practice-math-derivative-solver';
import {
  verifySubjectPracticeMathDerivativeWithIndependentOracle,
  SubjectPracticeMathDerivativeIndependentOracleEvidence
} from './subject-practice-math-derivative-independent-oracle';
import {
  verifySubjectPracticeMathDerivativeExplanation,
  SubjectPracticeMathDerivativeExplanationEvidence
} from './subject-practice-math-derivative-explanation-verifier';

export const SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION =
  'subject-practice-math-derivative-local-generator-v1-direct-polynomial-value';

export type SubjectPracticeMathDerivativeLocalGenerationResult = {
  generatorVersion: string;
  status: 'generated_and_triple_verified' | 'unsupported_question_plan' | 'self_verification_failed';
  candidate: GeneratedQuestionCandidate | null;
  solverEvidence: SubjectPracticeMathDerivativeSolverEvidence | null;
  oracleEvidence: SubjectPracticeMathDerivativeIndependentOracleEvidence | null;
  explanationEvidence: SubjectPracticeMathDerivativeExplanationEvidence | null;
  adherence: SubjectPracticeQuestionPlanAdherence | null;
  seed: number;
  exactScope: MathDerivativeScope | null;
  scopeId: string | null;
  providerImpact: 'none_no_provider_call';
  estimatedCostUsd: 0;
  productionImpact: 'none_shadow_only';
  automaticPublicationEligible: false;
  reasonCodes: string[];
};

type OptionValue = { value: bigint; intent: string };

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedSeed(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

function scopeFromPlan(
  questionPlan: unknown,
  validateSubjectPracticeQuestionPlan: SubjectPracticeQuestionPlanPorts['validate']
): MathDerivativeScope | null {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  return clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.subject).toLowerCase() === 'math'
    && clean(plan?.taskFamily) === 'derivative_direct_evaluation'
    && clean(plan?.planTemplate) === 'math_derivative_condition_chain_v1'
    && clean(plan?.targetDifficulty).toLowerCase() === 'basic'
    && clean(constraints?.exactDerivativeScope) === 'direct_polynomial_value'
    && validateSubjectPracticeQuestionPlan(questionPlan).valid
    ? 'direct_polynomial_value'
    : null;
}

function polynomialTerm(coefficient: number, exponent: number, first: boolean) {
  if (coefficient === 0) return '';
  const sign = coefficient < 0 ? '-' : first ? '' : '+';
  const magnitude = Math.abs(coefficient);
  const variable = exponent === 0 ? '' : exponent === 1 ? 'x' : `x^${exponent}`;
  return `${sign}${variable && magnitude === 1 ? '' : magnitude}${variable}`;
}

function polynomialText(terms: Array<{ coefficient: number; exponent: number }>) {
  let text = '';
  for (const term of terms) text += polynomialTerm(term.coefficient, term.exponent, text.length === 0);
  return text || '0';
}

function orderedOptions(values: OptionValue[], correctIndex: number) {
  const correct = values[0];
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, correct);
  const options: QuestionOption[] = ordered.map((item, index) => ({
    id: String.fromCharCode(65 + index),
    text: item.value.toString()
  }));
  return {
    options,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    optionMetadata: ordered.map((item, index) => ({
      optionId: String.fromCharCode(65 + index),
      distractorIntent: item.intent,
      misconceptionTags: item === correct ? [] : [item.intent]
    }))
  };
}

function distinctOptions(expected: bigint, derivativeAtNextPoint: bigint) {
  const candidates: OptionValue[] = [
    { value: expected + 1n, intent: 'arithmetic_plus_one' },
    { value: expected - 1n, intent: 'arithmetic_minus_one' },
    { value: -expected, intent: 'sign_error' },
    { value: derivativeAtNextPoint, intent: 'substituted_adjacent_point' },
    { value: expected + 2n, intent: 'coefficient_multiplier_error' },
    { value: 0n, intent: 'constant_function_assumption' }
  ];
  const seen = new Set([expected.toString()]);
  const distractors = candidates.filter((item) => {
    const key = item.value.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  return [{ value: expected, intent: 'correct_derivative_value' }, ...distractors];
}

function candidateFor(blueprint: QuestionGenerationBlueprint, seed: number) {
  const nonzero = [-3, -2, -1, 1, 2, 3];
  const a = nonzero[Math.floor(seed / 28) % nonzero.length];
  const b = (Math.floor(seed / 168) % 7) - 3;
  const c = (Math.floor(seed / 8) % 9) - 4;
  const d = (Math.floor(seed / 72) % 11) - 5;
  const point = (Math.floor(seed / 4) % 7) - 3;
  const degree = Math.floor(seed / 2) % 2 === 0 ? 2 : 3;
  const terms = degree === 3
    ? [{ coefficient: a, exponent: 3 }, { coefficient: b, exponent: 2 }, { coefficient: c, exponent: 1 }, { coefficient: d, exponent: 0 }]
    : [{ coefficient: a, exponent: 2 }, { coefficient: b, exponent: 1 }, { coefficient: d, exponent: 0 }];
  const derivativeTerms = terms
    .filter((term) => term.exponent > 0)
    .map((term) => ({ coefficient: term.coefficient * term.exponent, exponent: term.exponent - 1 }));
  const evaluate = (x: number) => derivativeTerms.reduce(
    (sum, term) => sum + BigInt(term.coefficient) * (BigInt(x) ** BigInt(term.exponent)),
    0n
  );
  const expected = evaluate(point);
  const expression = polynomialText(terms);
  const derivative = polynomialText(derivativeTerms);
  const prompt = `已知 f(x)=${expression}，求 f'(${point}) 的值。`;
  const promptEn = `Given f(x)=${expression}, find the value of f'(${point}).`;
  const explanation = `逐项求导得 f'(x)=${derivative}，代入 x=${point}，所以 f'(${point})=${expected}。`;
  const explanationEn = `Differentiate term by term to obtain f'(x)=${derivative}. Substituting x=${point} gives f'(${point})=${expected}.`;
  const rendered = orderedOptions(distinctOptions(expected, evaluate(point + 1)), seed % 4);
  const candidate: GeneratedQuestionCandidate = {
    subject: 'math', topicId: blueprint.topicId, blueprintId: blueprint.id, sourceType: 'ai',
    designedDifficulty: 'basic', questionType: 'single_choice', prompt,
    options: rendered.options, correctAnswer: rendered.correctAnswer, explanation,
    knowledgeTags: ['导数', '多项式求导', '函数值'], optionMetadata: rendered.optionMetadata,
    localizations: {
      zh: { prompt, options: rendered.options, explanation, knowledgeTags: ['导数', '多项式求导'] },
      en: { prompt: promptEn, options: rendered.options, explanation: explanationEn, knowledgeTags: ['Derivative', 'Polynomial differentiation'] }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
  return candidate;
}

export function createSubjectPracticeMathDerivativeLocalGenerator(
  ports: SubjectPracticeQuestionPlanPorts
) {
  return function generateSubjectPracticeMathDerivativeLocally(input: {
    blueprint: QuestionGenerationBlueprint;
    questionPlan: unknown;
    seed: number;
  }): SubjectPracticeMathDerivativeLocalGenerationResult {
  const seed = normalizedSeed(input.seed);
  const exactScope = scopeFromPlan(input.questionPlan, ports.validate);
  const blueprintSupported = clean(input.blueprint.subject).toLowerCase() === 'math'
    && clean(input.blueprint.difficulty).toLowerCase() === 'basic'
    && clean(input.blueprint.questionType).toLowerCase() === 'single_choice';
  if (!exactScope || !blueprintSupported) {
    return {
      generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan', candidate: null, solverEvidence: null, oracleEvidence: null,
      explanationEvidence: null, adherence: null, seed, exactScope, scopeId: null,
      providerImpact: 'none_no_provider_call', estimatedCostUsd: 0, productionImpact: 'none_shadow_only',
      automaticPublicationEligible: false,
      reasonCodes: ['math_derivative_local_generator_question_plan_not_supported']
    };
  }
  const candidate = candidateFor(input.blueprint, seed);
  const context = { questionPlan: input.questionPlan };
  const solverEvidence = solveSubjectPracticeMathDerivative(candidate, context);
  const oracleEvidence = verifySubjectPracticeMathDerivativeWithIndependentOracle(candidate, context);
  const explanationEvidence = verifySubjectPracticeMathDerivativeExplanation(candidate, context);
  const adherence = ports.adherenceFor(input.questionPlan, candidate);
  const tripleVerified = solverEvidence.status === 'verified'
    && oracleEvidence.status === 'verified'
    && explanationEvidence.status === 'verified'
    && adherence.adheres
    && solverEvidence.scopeId === oracleEvidence.scopeId
    && solverEvidence.selectedOptionId === oracleEvidence.selectedOptionId;
  return {
    generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
    status: tripleVerified ? 'generated_and_triple_verified' : 'self_verification_failed',
    candidate: tripleVerified ? candidate : null,
    solverEvidence,
    oracleEvidence,
    explanationEvidence,
    adherence,
    seed,
    exactScope,
    scopeId: tripleVerified ? solverEvidence.scopeId : null,
    providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only', automaticPublicationEligible: false,
    reasonCodes: tripleVerified ? [] : Array.from(new Set([
      'math_derivative_local_generator_triple_verification_failed',
      ...solverEvidence.reasonCodes,
      ...oracleEvidence.reasonCodes,
      ...explanationEvidence.reasonCodes,
      ...adherence.failureCodes
    ]))
  };
  };
}
