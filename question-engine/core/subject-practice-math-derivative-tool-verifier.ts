import type { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_DERIVATIVE_TOOL_VERIFIER_VERSION =
  'subject-practice-math-derivative-tool-verifier-v1-direct-polynomial-value';

type Rational = { numerator: bigint; denominator: bigint };

export type SubjectPracticeMathDerivativeToolVerification = {
  verifierVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  verificationScopeId: 'math-derivative-tool-v1:direct-polynomial-value' | null;
  parsed: boolean;
  normalizedExpression: string | null;
  evaluationPoint: string | null;
  expectedValue: string | null;
  selectedOptionId: string | null;
  trueOptionIds: string[];
  agreesWithGenerator: boolean;
  reasonCodes: string[];
  inputBoundary: 'visible_prompt_and_options_only';
  generatorExplanationTrusted: false;
  providerImpact: 'none_no_provider_call';
  automaticPublicationEligible: false;
  productionImpact: 'none_isolated_research_tool_evidence_only';
};

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function rational(numerator: bigint, denominator = 1n): Rational | null {
  if (denominator === 0n) return null;
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: sign * denominator / divisor };
}

function parseRational(value: unknown): Rational | null {
  const text = String(value ?? '').trim().replace(/[−–—]/g, '-');
  if (/^[+-]?\d+$/.test(text)) return rational(BigInt(text));
  const fraction = text.match(/^([+-]?\d+)\/(\d+)$/);
  if (fraction) return rational(BigInt(fraction[1]), BigInt(fraction[2]));
  const decimal = text.match(/^([+-]?)(\d+)\.(\d+)$/);
  if (!decimal) return null;
  const denominator = 10n ** BigInt(decimal[3].length);
  const numerator = BigInt(`${decimal[1]}${decimal[2]}${decimal[3]}`);
  return rational(numerator, denominator);
}

function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator
  ) as Rational;
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator) as Rational;
}

function power(value: Rational, exponent: number): Rational {
  return rational(value.numerator ** BigInt(exponent), value.denominator ** BigInt(exponent)) as Rational;
}

function equal(left: Rational, right: Rational) {
  return left.numerator === right.numerator && left.denominator === right.denominator;
}

function format(value: Rational) {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator}/${value.denominator}`;
}

function normalizeMath(value: unknown) {
  return String(value ?? '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .normalize('NFKC')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/\s+/g, ' ')
    .trim();
}

function expressionAndPoint(prompt: unknown) {
  const text = normalizeMath(prompt);
  const expressionMatch = text.match(/f\s*\(\s*x\s*\)\s*=\s*(.+?)(?=\s*(?:，|,|；|;|。|\?|？|求|计算|find\b|calculate\b|what\b))/i);
  const pointMatch = text.match(/f\s*['′]\s*[（(]\s*([+-]?\d+(?:\/\d+|\.\d+)?)\s*[)）]/i);
  if (!expressionMatch || !pointMatch) return null;
  return { expression: expressionMatch[1].trim(), point: pointMatch[1] };
}

function parsePolynomial(expression: string): Array<{ coefficient: Rational; exponent: number }> | null {
  const normalized = normalizeMath(expression).replace(/\s+/g, '').replace(/X/g, 'x');
  if (!normalized || /[^0-9x+\-*/^.]/.test(normalized) || /[()]/.test(normalized)) return null;
  const terms = normalized.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join('') !== normalized) return null;
  const parsed: Array<{ coefficient: Rational; exponent: number }> = [];
  for (const term of terms) {
    if (!term.includes('x')) {
      const coefficient = parseRational(term);
      if (!coefficient) return null;
      parsed.push({ coefficient, exponent: 0 });
      continue;
    }
    const match = term.match(/^([+-]?)(?:(\d+(?:\/\d+|\.\d+)?)\*?)?x(?:\^(\d+))?$/);
    if (!match) return null;
    const coefficient = parseRational(`${match[1] || '+'}${match[2] || '1'}`);
    const exponent = Number(match[3] || 1);
    if (!coefficient || !Number.isInteger(exponent) || exponent < 1 || exponent > 6) return null;
    parsed.push({ coefficient, exponent });
  }
  return parsed;
}

function derivativeAt(terms: Array<{ coefficient: Rational; exponent: number }>, point: Rational) {
  return terms.reduce((sum, term) => {
    if (term.exponent === 0) return sum;
    return add(sum, multiply(
      multiply(term.coefficient, rational(BigInt(term.exponent)) as Rational),
      power(point, term.exponent - 1)
    ));
  }, rational(0n) as Rational);
}

function optionValue(value: unknown) {
  const normalized = normalizeMath(value)
    .replace(/^[A-D][.、:：]\s*/i, '')
    .replace(/^(?:f\s*['′]\s*\([^)]*\)|答案|answer)\s*=\s*/i, '')
    .trim();
  return parseRational(normalized);
}

function unparsed(reasonCodes: string[]): SubjectPracticeMathDerivativeToolVerification {
  return {
    verifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_TOOL_VERIFIER_VERSION,
    status: 'unparsed', verificationScopeId: null, parsed: false,
    normalizedExpression: null, evaluationPoint: null, expectedValue: null,
    selectedOptionId: null, trueOptionIds: [], agreesWithGenerator: false,
    reasonCodes, inputBoundary: 'visible_prompt_and_options_only', generatorExplanationTrusted: false,
    providerImpact: 'none_no_provider_call', automaticPublicationEligible: false,
    productionImpact: 'none_isolated_research_tool_evidence_only'
  };
}

export function verifySubjectPracticeMathDerivativeToolCandidate(input: {
  candidate: GeneratedQuestionCandidate;
  taskFamily?: unknown;
  questionPlan?: unknown;
}): SubjectPracticeMathDerivativeToolVerification {
  const plan = input.questionPlan && typeof input.questionPlan === 'object' && !Array.isArray(input.questionPlan)
    ? input.questionPlan as Record<string, unknown>
    : {};
  if (String(input.candidate.subject).toLowerCase() !== 'math'
    || String(input.taskFamily ?? '') !== 'derivative_direct_evaluation'
    || String(plan.planTemplate ?? '') !== 'math_derivative_condition_chain_v1'
    || String(plan.targetDifficulty ?? '') !== 'basic') {
    return unparsed(['derivative_tool_scope_not_registered']);
  }
  const visible = expressionAndPoint(input.candidate.prompt);
  if (!visible) return unparsed(['derivative_tool_visible_expression_or_point_missing']);
  const polynomial = parsePolynomial(visible.expression);
  const point = parseRational(visible.point);
  if (!polynomial || !point) return unparsed(['derivative_tool_expression_outside_supported_polynomial_grammar']);
  if (!Array.isArray(input.candidate.options) || input.candidate.options.length !== 4) {
    return unparsed(['derivative_tool_four_options_required']);
  }
  const parsedOptions = input.candidate.options.map((option) => ({ id: String(option.id), value: optionValue(option.text) }));
  if (parsedOptions.some((option) => !option.value)) return unparsed(['derivative_tool_numeric_options_required']);
  const expected = derivativeAt(polynomial, point);
  const trueOptionIds = parsedOptions
    .filter((option) => equal(option.value as Rational, expected))
    .map((option) => option.id);
  const selectedOptionId = trueOptionIds.length === 1 ? trueOptionIds[0] : null;
  const agreesWithGenerator = Boolean(selectedOptionId) && selectedOptionId === String(input.candidate.correctAnswer);
  const reasonCodes: string[] = [];
  if (trueOptionIds.length !== 1) reasonCodes.push('derivative_tool_answer_not_unique');
  if (trueOptionIds.length === 1 && !agreesWithGenerator) reasonCodes.push('derivative_tool_declared_answer_disagrees');
  const status = trueOptionIds.length === 1 && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    verifierVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_TOOL_VERIFIER_VERSION,
    status,
    verificationScopeId: 'math-derivative-tool-v1:direct-polynomial-value',
    parsed: true,
    normalizedExpression: normalizeMath(visible.expression).replace(/\s+/g, ''),
    evaluationPoint: format(point),
    expectedValue: format(expected),
    selectedOptionId,
    trueOptionIds,
    agreesWithGenerator,
    reasonCodes,
    inputBoundary: 'visible_prompt_and_options_only',
    generatorExplanationTrusted: false,
    providerImpact: 'none_no_provider_call',
    automaticPublicationEligible: false,
    productionImpact: 'none_isolated_research_tool_evidence_only'
  };
}


