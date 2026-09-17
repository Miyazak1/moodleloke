import type { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION =
  'subject-practice-math-derivative-independent-oracle-v1-integer-polynomial';

export type SubjectPracticeMathDerivativeIndependentOracleEvidence = {
  oracleVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  scopeId: string | null;
  scopeMatched: boolean;
  canonicalTask: Record<string, unknown> | null;
  selectedOptionId: string | null;
  trueOptionIds: string[];
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  method: 'independent_integer_polynomial_coefficient_accumulation';
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalize(value: unknown) {
  return String(value ?? '')
    .replace(/²/g, '^2').replace(/³/g, '^3').normalize('NFKC')
    .replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/\s+/g, ' ').trim();
}

function exactScope(questionPlan: unknown) {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  return String(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && String(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && String(plan?.taskFamily) === 'derivative_direct_evaluation'
    && String(plan?.planTemplate) === 'math_derivative_condition_chain_v1'
    && String(plan?.targetDifficulty).toLowerCase() === 'basic'
    && String(constraints?.exactDerivativeScope) === 'direct_polynomial_value';
}

function parseTask(prompt: unknown) {
  const text = normalize(prompt);
  const expression = text.match(/f\s*\(\s*x\s*\)\s*=\s*(.+?)(?=\s*(?:,|，|;|；|。|\?|？|求|计算|find\b|calculate\b|what\b))/i)?.[1];
  const point = text.match(/f\s*['′]\s*[（(]\s*([+-]?\d+)\s*[)）]/i)?.[1];
  if (!expression || point === undefined) return null;
  const compact = normalize(expression).replace(/\s+/g, '').replace(/X/g, 'x');
  if (!compact || /[^0-9x+\-*^.]/.test(compact) || /[()\/\.]/.test(compact)) return null;
  const terms = compact.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join('') !== compact) return null;
  let expected = 0n;
  const x = BigInt(point);
  for (const term of terms) {
    if (!term.includes('x')) {
      if (!/^[+-]?\d+$/.test(term)) return null;
      continue;
    }
    const match = term.match(/^([+-]?)(?:(\d+)\*?)?x(?:\^(\d+))?$/);
    if (!match) return null;
    const coefficient = BigInt(`${match[1] || '+'}${match[2] || '1'}`);
    const exponent = Number(match[3] || 1);
    if (!Number.isInteger(exponent) || exponent < 1 || exponent > 6) return null;
    expected += coefficient * BigInt(exponent) * (x ** BigInt(exponent - 1));
  }
  return { expression: compact, point, expected };
}

function optionInteger(value: unknown) {
  const text = normalize(value).replace(/^[A-D][.、:：]\s*/i, '').trim();
  return /^[+-]?\d+$/.test(text) ? BigInt(text) : null;
}

export function verifySubjectPracticeMathDerivativeWithIndependentOracle(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathDerivativeIndependentOracleEvidence {
  const matched = exactScope(context.questionPlan);
  const task = matched ? parseTask(candidate.prompt) : null;
  const reasonCodes: string[] = [];
  if (!matched) reasonCodes.push('math_derivative_oracle_plan_scope_mismatch');
  if (matched && !task) reasonCodes.push('math_derivative_oracle_prompt_unparsed');
  const optionValues = candidate.options.map((option) => ({ id: option.id, value: optionInteger(option.text) }));
  if (task && optionValues.some((option) => option.value === null)) {
    reasonCodes.push('math_derivative_oracle_option_unparsed');
  }
  const trueOptionIds = task && !optionValues.some((option) => option.value === null)
    ? optionValues.filter((option) => option.value === task.expected).map((option) => option.id)
    : [];
  const uniqueAnswer = Boolean(task) && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = Boolean(selectedOptionId) && selectedOptionId === candidate.correctAnswer;
  if (task && optionValues.every((option) => option.value !== null) && trueOptionIds.length !== 1) {
    reasonCodes.push(trueOptionIds.length
      ? 'math_derivative_oracle_multiple_true_options'
      : 'math_derivative_oracle_no_true_option');
  }
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('math_derivative_oracle_declared_answer_disagrees');
  const status = !matched || !task || optionValues.some((option) => option.value === null)
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    oracleVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION,
    status,
    scopeId: matched ? 'math-basic-derivative-v1:direct_polynomial_value' : null,
    scopeMatched: matched,
    canonicalTask: task ? { kind: 'direct_polynomial_value', expression: task.expression, point: task.point, expectedValue: task.expected.toString() } : null,
    selectedOptionId,
    trueOptionIds,
    uniqueAnswer,
    agreesWithGenerator,
    method: 'independent_integer_polynomial_coefficient_accumulation',
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}


