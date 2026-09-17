import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION = 'math-line-relation-solver-v2';
export const SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION = 'math-line-relation-scope-v1';

export type MathLineRelationScope =
  | 'slope_from_two_distinct_points'
  | 'inclination_angle_from_line'
  | 'identify_parallel_or_perpendicular_line'
  | 'line_equation_from_point_and_slope';

type Fraction = { numerator: number; denominator: number };
type CanonicalLine = { a: number; b: number; c: number };

export type SubjectPracticeMathLineRelationSolverEvidence = {
  solverVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  taskFamily: 'math_line_relation_direct';
  scopeId: string | null;
  scopeMatched: boolean;
  exactScope: MathLineRelationScope | null;
  canonicalTask: Record<string, unknown> | null;
  optionVerdicts: Array<{
    optionId: string;
    verdict: 'true' | 'false' | 'unknown';
    semanticValue: Record<string, unknown> | null;
    reasonCode: string;
  }>;
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
  verificationScope: {
    scopeVersion: string;
    scopeId: string | null;
    matched: boolean;
    exactScope: MathLineRelationScope | null;
    reasonCodes: string[];
  };
};

const EXACT_SCOPES = new Set<MathLineRelationScope>([
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
]);

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[，]/g, ',')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[°º]/g, '°')
    .replace(/\s+/g, ' ')
    .trim();
}

function gcd(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function lcm(left: number, right: number) {
  return Math.abs(left * right) / gcd(left, right);
}

function fraction(numerator: number, denominator = 1): Fraction | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) return null;
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
}

function parseFraction(value: string): Fraction | null {
  const match = clean(value).replace(/\s+/g, '').match(/^([+-]?\d+)(?:\/([+-]?\d+))?$/);
  if (!match) return null;
  return fraction(Number(match[1]), match[2] ? Number(match[2]) : 1);
}

function equalFraction(left: Fraction, right: Fraction) {
  return left.numerator === right.numerator && left.denominator === right.denominator;
}

function negate(value: Fraction): Fraction {
  return { numerator: -value.numerator, denominator: value.denominator };
}

function canonicalLine(a: Fraction, b: Fraction, c: Fraction): CanonicalLine | null {
  const denominator = lcm(lcm(a.denominator, b.denominator), c.denominator);
  let values = [a, b, c].map((value) => value.numerator * (denominator / value.denominator));
  if (values.some((value) => !Number.isSafeInteger(value)) || (values[0] === 0 && values[1] === 0)) return null;
  const divisor = gcd(gcd(values[0], values[1]), values[2]);
  values = values.map((value) => value / divisor);
  const first = values.find((value) => value !== 0) ?? 1;
  if (first < 0) values = values.map((value) => -value);
  return { a: values[0], b: values[1], c: values[2] };
}

function parseLinearSide(side: string): { x: Fraction; y: Fraction; constant: Fraction } | null {
  const compact = clean(side).replace(/\s+/g, '').replace(/-/g, '+-');
  const terms = compact.split('+').filter(Boolean);
  let x = fraction(0)!;
  let y = fraction(0)!;
  let constant = fraction(0)!;
  for (const term of terms) {
    const variable = term.endsWith('x') ? 'x' : term.endsWith('y') ? 'y' : null;
    const raw = variable ? term.slice(0, -1) : term;
    const coefficient = parseFraction(raw === '' ? '1' : raw === '-' ? '-1' : raw);
    if (!coefficient) return null;
    const target = variable === 'x' ? x : variable === 'y' ? y : constant;
    const added = fraction(
      target.numerator * coefficient.denominator + coefficient.numerator * target.denominator,
      target.denominator * coefficient.denominator
    );
    if (!added) return null;
    if (variable === 'x') x = added;
    else if (variable === 'y') y = added;
    else constant = added;
  }
  return { x, y, constant };
}

function parseLine(value: string): CanonicalLine | null {
  const equation = clean(value)
    .replace(/^(?:line\s+[a-z]\s*:\s*|直线\s*[a-z]?\s*[:：]\s*)/i, '')
    .replace(/[。.]$/, '');
  const parts = equation.split('=');
  if (parts.length !== 2) return null;
  const left = parseLinearSide(parts[0]);
  const right = parseLinearSide(parts[1]);
  if (!left || !right) return null;
  const subtract = (a: Fraction, b: Fraction) => fraction(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator
  );
  const a = subtract(left.x, right.x);
  const b = subtract(left.y, right.y);
  const c = subtract(left.constant, right.constant);
  return a && b && c ? canonicalLine(a, b, c) : null;
}

function slopeOf(line: CanonicalLine): Fraction | null {
  return line.b === 0 ? null : fraction(-line.a, line.b);
}

function pointPair(prompt: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const matches = Array.from(clean(prompt).matchAll(/[A-Za-z\u4e00-\u9fff]*\s*\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)/g));
  if (matches.length !== 2) return null;
  const values = matches.map((item) => [Number(item[1]), Number(item[2])]);
  return values[0][0] === values[1][0] ? null : { x1: values[0][0], y1: values[0][1], x2: values[1][0], y2: values[1][1] };
}

function onePoint(prompt: string): { x: number; y: number } | null {
  const matches = Array.from(clean(prompt).matchAll(/[A-Za-z\u4e00-\u9fff]*\s*\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)/g));
  return matches.length === 1 ? { x: Number(matches[0][1]), y: Number(matches[0][2]) } : null;
}

function promptLine(prompt: string): CanonicalLine | null {
  const matches = clean(prompt).match(/[+-]?(?:\d+(?:\/\d+)?)?[xy](?:\s*[+-]\s*(?:\d+(?:\/\d+)?)?[xy])?(?:\s*[+-]\s*\d+(?:\/\d+)?)?\s*=\s*[+-]?\d+(?:\/\d+)?/ig) ?? [];
  return matches.length === 1 ? parseLine(matches[0]) : null;
}

function promptSlope(prompt: string): Fraction | null {
  const match = clean(prompt).match(/(?:slope|斜率)\s*(?:is|为|=|:|：)?\s*([+-]?\d+(?:\/[+-]?\d+)?)/i);
  return match ? parseFraction(match[1]) : null;
}

function optionAngle(text: string) {
  const match = clean(text).match(/^([+-]?\d+)\s*°$/);
  return match ? Number(match[1]) : null;
}

function expectedInclination(line: CanonicalLine): number | null {
  const slope = slopeOf(line);
  if (!slope) return null;
  const key = `${slope.numerator}/${slope.denominator}`;
  const exact: Record<string, number> = { '0/1': 0, '1/1': 45, '-1/1': 135 };
  return exact[key] ?? null;
}

function planScope(questionPlan: unknown) {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const exactScope = clean(constraints?.exactLineRelationScope) as MathLineRelationScope;
  const baseMatched = clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.subject).toLowerCase() === 'math'
    && clean(plan?.taskFamily) === 'math_line_relation_direct'
    && clean(plan?.planTemplate) === 'math_line_relation_direct_v1'
    && clean(plan?.targetDifficulty).toLowerCase() === 'basic'
    && EXACT_SCOPES.has(exactScope)
    && constraints?.forbidFigureDependency === true
    && constraints?.forbidMultiStageIntersection === true;
  return { exactScope: baseMatched ? exactScope : null, matched: baseMatched };
}

function relationRequested(prompt: string): 'parallel' | 'perpendicular' | null {
  const source = clean(prompt);
  const parallel = /parallel|平行/i.test(source);
  const perpendicular = /perpendicular|垂直/i.test(source);
  return parallel === perpendicular ? null : parallel ? 'parallel' : 'perpendicular';
}

function scopeIntentMatches(prompt: string, scope: MathLineRelationScope): boolean {
  const source = clean(prompt);
  if (scope === 'slope_from_two_distinct_points') return /(?:slope|斜率)/i.test(source);
  if (scope === 'inclination_angle_from_line') return /(?:inclination\s+angle|angle\s+of\s+inclination|倾斜角)/i.test(source);
  if (scope === 'identify_parallel_or_perpendicular_line') return Boolean(relationRequested(source));
  return /(?:equation|方程)/i.test(source) && /(?:slope|斜率)/i.test(source);
}

export function solveSubjectPracticeMathLineRelation(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathLineRelationSolverEvidence {
  const scope = planScope(context.questionPlan);
  const reasonCodes: string[] = [];
  let canonicalTask: Record<string, unknown> | null = null;
  let judge: ((text: string) => { truth: boolean; semantic: Record<string, unknown> } | null) | null = null;

  if (!scope.matched || !scope.exactScope) {
    reasonCodes.push('math_line_relation_solver_plan_scope_mismatch');
  } else if (!scopeIntentMatches(candidate.prompt, scope.exactScope)) {
    reasonCodes.push('math_line_relation_solver_prompt_intent_mismatch');
  } else if (scope.exactScope === 'slope_from_two_distinct_points') {
    const points = pointPair(candidate.prompt);
    const expected = points ? fraction(points.y2 - points.y1, points.x2 - points.x1) : null;
    if (points && expected) {
      canonicalTask = { kind: scope.exactScope, points, expectedSlope: expected };
      judge = (text) => {
        const parsed = parseFraction(text);
        return parsed ? { truth: equalFraction(parsed, expected), semantic: { kind: 'slope', value: parsed } } : null;
      };
    }
  } else if (scope.exactScope === 'inclination_angle_from_line') {
    const line = promptLine(candidate.prompt);
    const expected = line ? expectedInclination(line) : null;
    if (line && expected !== null) {
      canonicalTask = { kind: scope.exactScope, line, expectedAngleDegrees: expected };
      judge = (text) => {
        const parsed = optionAngle(text);
        return parsed === null ? null : { truth: parsed === expected, semantic: { kind: 'angle_degrees', value: parsed } };
      };
    }
  } else if (scope.exactScope === 'identify_parallel_or_perpendicular_line') {
    const reference = promptLine(candidate.prompt);
    const relation = relationRequested(candidate.prompt);
    if (reference && relation) {
      canonicalTask = { kind: scope.exactScope, referenceLine: reference, relation };
      judge = (text) => {
        const line = parseLine(text);
        if (!line) return null;
        const parallel = reference.a * line.b === line.a * reference.b;
        const coincident = line.a === reference.a && line.b === reference.b && line.c === reference.c;
        const perpendicular = reference.a * line.a + reference.b * line.b === 0;
        const truth = relation === 'parallel' ? parallel && !coincident : perpendicular;
        return { truth, semantic: { kind: 'canonical_line', line, parallel, perpendicular, coincident } };
      };
    }
  } else {
    const point = onePoint(candidate.prompt);
    const slope = promptSlope(candidate.prompt);
    if (point && slope) {
      canonicalTask = { kind: scope.exactScope, point, slope };
      judge = (text) => {
        const line = parseLine(text);
        if (!line) return null;
        const lineSlope = slopeOf(line);
        const containsPoint = line.a * point.x + line.b * point.y + line.c === 0;
        const truth = Boolean(lineSlope && equalFraction(lineSlope, slope) && containsPoint);
        return { truth, semantic: { kind: 'canonical_line', line, containsPoint, slope: lineSlope } };
      };
    }
  }

  if (scope.matched && !canonicalTask) reasonCodes.push('math_line_relation_solver_prompt_unparsed_or_outside_exact_scope');
  const optionVerdicts = candidate.options.map((option) => {
    const result = judge?.(option.text) ?? null;
    return {
      optionId: option.id,
      verdict: result ? (result.truth ? 'true' as const : 'false' as const) : 'unknown' as const,
      semanticValue: result?.semantic ?? null,
      reasonCode: result ? (result.truth ? 'math_line_relation_option_true' : 'math_line_relation_option_false') : 'math_line_relation_option_unparsed'
    };
  });
  const hasUnknown = optionVerdicts.some((option) => option.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((option) => option.verdict === 'true').map((option) => option.optionId);
  const uniqueAnswer = Boolean(canonicalTask) && !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  if (hasUnknown) reasonCodes.push('math_line_relation_solver_option_unparsed');
  if (canonicalTask && !hasUnknown && trueOptionIds.length !== 1) {
    reasonCodes.push(trueOptionIds.length ? 'math_line_relation_solver_multiple_true_options' : 'math_line_relation_solver_no_true_option');
  }
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('math_line_relation_solver_generator_disagreement');
  const status = !scope.matched || !canonicalTask || hasUnknown
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  const scopeId = scope.matched && canonicalTask ? `math-basic-line-relation-v1:${scope.exactScope}` : null;
  return {
    solverVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
    status,
    taskFamily: 'math_line_relation_direct',
    scopeId,
    scopeMatched: Boolean(scopeId),
    exactScope: scope.exactScope,
    canonicalTask,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes,
    verificationScope: {
      scopeVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION,
      scopeId,
      matched: Boolean(scopeId),
      exactScope: scope.exactScope,
      reasonCodes: scope.matched ? (canonicalTask ? [] : ['math_line_relation_scope_content_mismatch']) : ['math_line_relation_scope_plan_contract_missing']
    }
  };
}
