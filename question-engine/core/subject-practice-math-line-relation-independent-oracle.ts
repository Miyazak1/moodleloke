import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION =
  'math-line-relation-independent-vector-oracle-v3';

type Ratio = { top: bigint; bottom: bigint };
type RawLine = { a: Ratio; b: Ratio; c: Ratio };
type ExactPoint = { x: bigint; y: bigint };
type MathLineRelationScope =
  | 'slope_from_two_distinct_points'
  | 'inclination_angle_from_line'
  | 'identify_parallel_or_perpendicular_line'
  | 'line_equation_from_point_and_slope';

export type SubjectPracticeMathLineRelationIndependentOracleEvidence = {
  oracleVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  exactScope: MathLineRelationScope | null;
  scopeId: string | null;
  scopeMatched: boolean;
  canonicalTask: Record<string, unknown> | null;
  optionVerdicts: Array<{
    optionId: string;
    verdict: 'true' | 'false' | 'unknown';
    reasonCode: string;
  }>;
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  method: 'independent_direction_normal_vector_cross_dot';
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

const ALLOWED = new Set<MathLineRelationScope>([
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
]);

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function tidy(value: unknown) {
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

function absolute(value: bigint) {
  return value < 0n ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function normalizedRatio(top: bigint, bottom = 1n): Ratio | null {
  if (bottom === 0n) return null;
  const sign = bottom < 0n ? -1n : 1n;
  const divisor = gcd(top, bottom);
  return { top: sign * top / divisor, bottom: absolute(bottom) / divisor };
}

function ratio(raw: string): Ratio | null {
  const match = tidy(raw).replace(/\s+/g, '').match(/^([+-]?\d+)(?:\/([+-]?\d+))?$/);
  if (!match) return null;
  const top = BigInt(match[1]);
  const bottom = match[2] ? BigInt(match[2]) : 1n;
  return normalizedRatio(top, bottom);
}

function addRatio(left: Ratio, right: Ratio): Ratio | null {
  return normalizedRatio(
    left.top * right.bottom + right.top * left.bottom,
    left.bottom * right.bottom
  );
}

function subtractRatio(left: Ratio, right: Ratio): Ratio | null {
  return normalizedRatio(
    left.top * right.bottom - right.top * left.bottom,
    left.bottom * right.bottom
  );
}

function multiplyRatio(left: Ratio, right: Ratio): Ratio | null {
  return normalizedRatio(left.top * right.top, left.bottom * right.bottom);
}

function negateRatio(value: Ratio): Ratio {
  return { top: -value.top, bottom: value.bottom };
}

function isZero(value: Ratio) {
  return value.top === 0n;
}

function sameMagnitude(left: Ratio, right: Ratio) {
  return absolute(left.top * right.bottom) === absolute(right.top * left.bottom);
}

function ratioEvidence(value: Ratio) {
  return { numerator: value.top.toString(), denominator: value.bottom.toString() };
}

function pointEvidence(value: ExactPoint) {
  return { x: value.x.toString(), y: value.y.toString() };
}

function determinantZero(x1: Ratio, y1: Ratio, x2: Ratio, y2: Ratio) {
  const left = multiplyRatio(x1, y2);
  const right = multiplyRatio(y1, x2);
  const result = left && right ? subtractRatio(left, right) : null;
  return Boolean(result && isZero(result));
}

function dotZero(x1: Ratio, y1: Ratio, x2: Ratio, y2: Ratio) {
  const left = multiplyRatio(x1, x2);
  const right = multiplyRatio(y1, y2);
  const result = left && right ? addRatio(left, right) : null;
  return Boolean(result && isZero(result));
}

function sideCoefficients(side: string): RawLine | null {
  const chunks = tidy(side).replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
  const totals: RawLine = {
    a: normalizedRatio(0n)!,
    b: normalizedRatio(0n)!,
    c: normalizedRatio(0n)!
  };
  for (const chunk of chunks) {
    const key = chunk.endsWith('x') ? 'a' : chunk.endsWith('y') ? 'b' : 'c';
    const raw = key === 'c' ? chunk : chunk.slice(0, -1);
    const parsed = ratio(raw === '' ? '1' : raw === '-' ? '-1' : raw);
    if (!parsed) return null;
    const total = addRatio(totals[key], parsed);
    if (!total) return null;
    totals[key] = total;
  }
  return totals;
}

function equation(text: string): RawLine | null {
  const source = tidy(text)
    .replace(/^(?:line\s+[a-z]\s*:\s*|直线\s*[a-z]?\s*[:：]\s*)/i, '')
    .replace(/[。.]$/, '');
  const halves = source.split('=');
  if (halves.length !== 2) return null;
  const left = sideCoefficients(halves[0]);
  const right = sideCoefficients(halves[1]);
  if (!left || !right) return null;
  const a = subtractRatio(left.a, right.a);
  const b = subtractRatio(left.b, right.b);
  const c = subtractRatio(left.c, right.c);
  if (!a || !b || !c || (isZero(a) && isZero(b))) return null;
  return { a, b, c };
}

function lineInPrompt(prompt: string): RawLine | null {
  const hits = tidy(prompt).match(/[+-]?(?:\d+(?:\/\d+)?)?[xy](?:\s*[+-]\s*(?:\d+(?:\/\d+)?)?[xy])?(?:\s*[+-]\s*\d+(?:\/\d+)?)?\s*=\s*[+-]?\d+(?:\/\d+)?/ig) ?? [];
  return hits.length === 1 ? equation(hits[0]) : null;
}

function exactPlanScope(questionPlan: unknown): MathLineRelationScope | null {
  const plan = object(questionPlan);
  const constraints = object(plan?.renderConstraints);
  const scope = tidy(constraints?.exactLineRelationScope) as MathLineRelationScope;
  return tidy(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && tidy(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && tidy(plan?.subject).toLowerCase() === 'math'
    && tidy(plan?.taskFamily) === 'math_line_relation_direct'
    && tidy(plan?.planTemplate) === 'math_line_relation_direct_v1'
    && tidy(plan?.targetDifficulty).toLowerCase() === 'basic'
    && constraints?.forbidFigureDependency === true
    && constraints?.forbidMultiStageIntersection === true
    && ALLOWED.has(scope)
    ? scope
    : null;
}

function points(prompt: string) {
  const hits = Array.from(tidy(prompt).matchAll(/[A-Za-z\u4e00-\u9fff]*\s*\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)/g));
  return hits.map((hit) => ({ x: BigInt(hit[1]), y: BigInt(hit[2]) }));
}

function requestedRelation(prompt: string): 'parallel' | 'perpendicular' | null {
  const source = tidy(prompt);
  const p = /parallel|平行/i.test(source);
  const q = /perpendicular|垂直/i.test(source);
  return p === q ? null : p ? 'parallel' : 'perpendicular';
}

function scopeIntentMatches(prompt: string, scope: MathLineRelationScope): boolean {
  const source = tidy(prompt);
  if (scope === 'slope_from_two_distinct_points') return /(?:slope|斜率)/i.test(source);
  if (scope === 'inclination_angle_from_line') return /(?:inclination\s+angle|angle\s+of\s+inclination|倾斜角)/i.test(source);
  if (scope === 'identify_parallel_or_perpendicular_line') return Boolean(requestedRelation(source));
  return /(?:equation|方程)/i.test(source) && /(?:slope|斜率)/i.test(source);
}

function statedSlope(prompt: string): Ratio | null {
  const match = tidy(prompt).match(/(?:slope|斜率)\s*(?:is|为|=|:|：)?\s*([+-]?\d+(?:\/[+-]?\d+)?)/i);
  return match ? ratio(match[1]) : null;
}

function angle(text: string) {
  const match = tidy(text).match(/^([+-]?\d+)\s*°$/);
  return match ? Number(match[1]) : null;
}

export function verifySubjectPracticeMathLineRelationWithIndependentOracle(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathLineRelationIndependentOracleEvidence {
  const scope = exactPlanScope(context.questionPlan);
  const reasonCodes: string[] = [];
  let canonicalTask: Record<string, unknown> | null = null;
  let decide: ((text: string) => boolean | null) | null = null;

  if (!scope) {
    reasonCodes.push('math_line_relation_oracle_plan_scope_mismatch');
  } else if (!scopeIntentMatches(candidate.prompt, scope)) {
    reasonCodes.push('math_line_relation_oracle_prompt_intent_mismatch');
  } else if (scope === 'slope_from_two_distinct_points') {
    const pair = points(candidate.prompt);
    if (pair.length === 2 && pair[0].x !== pair[1].x) {
      const dx = pair[1].x - pair[0].x;
      const dy = pair[1].y - pair[0].y;
      canonicalTask = { kind: scope, directionVector: { dx: dx.toString(), dy: dy.toString() } };
      decide = (text) => {
        const candidateRatio = ratio(text);
        return candidateRatio ? dy * candidateRatio.bottom === dx * candidateRatio.top : null;
      };
    }
  } else if (scope === 'inclination_angle_from_line') {
    const line = lineInPrompt(candidate.prompt);
    if (line) {
      const dx = line.b;
      const dy = negateRatio(line.a);
      const expected = isZero(dy) ? 0 : sameMagnitude(dx, dy) ? (dx.top * dy.top > 0n ? 45 : 135) : null;
      if (expected !== null) {
        canonicalTask = {
          kind: scope,
          normalVector: { a: ratioEvidence(line.a), b: ratioEvidence(line.b) },
          directionVector: { dx: ratioEvidence(dx), dy: ratioEvidence(dy) },
          expectedAngleDegrees: expected
        };
        decide = (text) => {
          const value = angle(text);
          return value === null ? null : value === expected;
        };
      }
    }
  } else if (scope === 'identify_parallel_or_perpendicular_line') {
    const reference = lineInPrompt(candidate.prompt);
    const relation = requestedRelation(candidate.prompt);
    if (reference && relation) {
      const ar = reference.a; const br = reference.b; const cr = reference.c;
      canonicalTask = {
        kind: scope,
        referenceNormalVector: { a: ratioEvidence(ar), b: ratioEvidence(br) },
        relation
      };
      decide = (text) => {
        const option = equation(text);
        if (!option) return null;
        const ao = option.a; const bo = option.b; const co = option.c;
        const normalsParallel = determinantZero(ar, br, ao, bo);
        const coincident = normalsParallel
          && determinantZero(ar, cr, ao, co)
          && determinantZero(br, cr, bo, co);
        return relation === 'parallel'
          ? normalsParallel && !coincident
          : dotZero(ar, br, ao, bo);
      };
    }
  } else {
    const point = points(candidate.prompt);
    const wanted = statedSlope(candidate.prompt);
    if (point.length === 1 && wanted) {
      const desiredDx = wanted.bottom;
      const desiredDy = wanted.top;
      canonicalTask = {
        kind: scope,
        point: pointEvidence(point[0]),
        desiredDirectionVector: { dx: desiredDx.toString(), dy: desiredDy.toString() }
      };
      decide = (text) => {
        const option = equation(text);
        if (!option) return null;
        const optionDx = option.b;
        const optionDy = negateRatio(option.a);
        const desiredDxRatio = normalizedRatio(desiredDx)!;
        const desiredDyRatio = normalizedRatio(desiredDy)!;
        const sameDirection = determinantZero(desiredDxRatio, desiredDyRatio, optionDx, optionDy);
        const ax = multiplyRatio(option.a, normalizedRatio(point[0].x)!);
        const by = multiplyRatio(option.b, normalizedRatio(point[0].y)!);
        const sum = ax && by ? addRatio(ax, by) : null;
        const total = sum ? addRatio(sum, option.c) : null;
        const containsPoint = Boolean(total && isZero(total));
        return sameDirection && containsPoint;
      };
    }
  }

  if (scope && !canonicalTask) reasonCodes.push('math_line_relation_oracle_prompt_unparsed_or_outside_exact_scope');
  const optionVerdicts = candidate.options.map((option) => {
    const truth = decide?.(option.text) ?? null;
    return {
      optionId: option.id,
      verdict: truth === null ? 'unknown' as const : truth ? 'true' as const : 'false' as const,
      reasonCode: truth === null ? 'math_line_relation_oracle_option_unparsed' : truth ? 'math_line_relation_oracle_option_true' : 'math_line_relation_oracle_option_false'
    };
  });
  const hasUnknown = optionVerdicts.some((option) => option.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((option) => option.verdict === 'true').map((option) => option.optionId);
  const uniqueAnswer = Boolean(canonicalTask) && !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  if (hasUnknown) reasonCodes.push('math_line_relation_oracle_option_unparsed');
  if (canonicalTask && !hasUnknown && trueOptionIds.length !== 1) {
    reasonCodes.push(trueOptionIds.length ? 'math_line_relation_oracle_multiple_true_options' : 'math_line_relation_oracle_no_true_option');
  }
  const status = !scope || !canonicalTask || hasUnknown
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    oracleVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION,
    status,
    exactScope: scope,
    scopeId: scope ? `math-basic-line-relation-v1:${scope}` : null,
    scopeMatched: Boolean(scope),
    canonicalTask,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    method: 'independent_direction_normal_vector_cross_dot',
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
