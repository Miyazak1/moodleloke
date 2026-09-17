import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION = 'math-elementary-independent-oracle-v1';

type FunctionClass = 'logarithmic' | 'exponential' | 'radical' | 'power';
type PropertyTarget = 'domain' | 'range' | 'monotonicity' | 'function_value';
type PlanBinding = { functionClass: FunctionClass; propertyTarget: PropertyTarget; scopeId: string };

export type SubjectPracticeMathElementaryIndependentOracleEvidence = {
  oracleVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  functionClass: FunctionClass | null;
  propertyTarget: PropertyTarget | null;
  optionVerdicts: Array<{ optionId: string; verdict: 'true' | 'false' | 'unknown' }>;
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  scopeId: string | null;
  scopeMatched: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

type Endpoint = number | 'negative_infinity' | 'positive_infinity';
type Interval = { lower: Endpoint; upper: Endpoint; lowerClosed: boolean; upperClosed: boolean };

const ALLOWED_PAIRS = new Set([
  'logarithmic:domain',
  'exponential:range',
  'radical:monotonicity',
  'power:function_value'
]);

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/\s+/g, ' ')
    .trim();
}

function numeric(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bindPlan(questionPlan: unknown): PlanBinding | null {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const functionClass = clean(constraints?.requiredElementaryFunctionClass).toLowerCase() as FunctionClass;
  const propertyTarget = clean(constraints?.requiredSinglePropertyTarget).toLowerCase() as PropertyTarget;
  const pair = `${functionClass}:${propertyTarget}`;
  if (!plan
    || clean(plan.schemaVersion) !== 'subject-practice-question-plan-v1'
    || clean(plan.policyVersion) !== 'subject-practice-question-plan-policy-v1'
    || clean(plan.subject).toLowerCase() !== 'math'
    || clean(plan.taskFamily) !== 'elementary_function_direct_property'
    || clean(plan.planTemplate) !== 'math_elementary_function_relation_v1'
    || clean(plan.targetDifficulty).toLowerCase() !== 'basic'
    || clean(constraints?.singlePropertyTargetContractVersion) !== 'math-basic-elementary-single-property-target-v1'
    || constraints?.forbidCrossPropertyDistractors !== true
    || Number(constraints?.maxIndependentRelations) !== 1
    || Number(constraints?.maxFunctionObjects) !== 1
    || !ALLOWED_PAIRS.has(pair)) return null;
  return { functionClass, propertyTarget, scopeId: `math-basic-elementary-rotation-v1:${pair}` };
}

function endpoint(text: string): Endpoint | null {
  const value = clean(text).toLowerCase();
  if (value === '-∞' || value === '-infinity') return 'negative_infinity';
  if (value === '+∞' || value === '∞' || value === '+infinity' || value === 'infinity') return 'positive_infinity';
  return numeric(value);
}

function interval(text: string): Interval | null {
  const source = clean(text);
  if (/^(?:值域为 )?(?:R|ℝ)$/.test(source)
    || /(?:定义域|domain).*(?:R|ℝ)$/.test(source)) {
    return { lower: 'negative_infinity', upper: 'positive_infinity', lowerClosed: false, upperClosed: false };
  }
  const match = source.match(/(?:值域为 )?([([])\s*([+-]?(?:\d+(?:\.\d+)?|∞|infinity))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|∞|infinity))\s*([\])])/i);
  if (!match) return null;
  const lower = endpoint(match[2]);
  const upper = endpoint(match[3]);
  if (lower === null || upper === null || lower === 'positive_infinity' || upper === 'negative_infinity') return null;
  return { lower, upper, lowerClosed: match[1] === '[', upperClosed: match[4] === ']' };
}

function rank(value: Endpoint) {
  if (value === 'negative_infinity') return Number.NEGATIVE_INFINITY;
  if (value === 'positive_infinity') return Number.POSITIVE_INFINITY;
  return value;
}

function sameEndpoint(left: Endpoint, right: Endpoint) {
  return typeof left === 'number' && typeof right === 'number'
    ? Math.abs(left - right) <= 1e-9
    : left === right;
}

function sameInterval(left: Interval, right: Interval) {
  return sameEndpoint(left.lower, right.lower)
    && sameEndpoint(left.upper, right.upper)
    && left.lowerClosed === right.lowerClosed
    && left.upperClosed === right.upperClosed;
}

function containedIn(actual: Interval, domain: Interval) {
  const actualLower = rank(actual.lower);
  const actualUpper = rank(actual.upper);
  const domainLower = rank(domain.lower);
  const domainUpper = rank(domain.upper);
  if (actualLower > actualUpper || (actualLower === actualUpper && (!actual.lowerClosed || !actual.upperClosed))) return false;
  const lowerOk = actualLower > domainLower
    || (actualLower === domainLower && (!actual.lowerClosed || domain.lowerClosed));
  const upperOk = actualUpper < domainUpper
    || (actualUpper === domainUpper && (!actual.upperClosed || domain.upperClosed));
  return lowerOk && upperOk;
}

function argumentBoundary(argument: string) {
  if (argument === 'x') return 0;
  const match = argument.match(/^x([+-])(\d+(?:\.\d+)?)$/);
  const amount = numeric(match?.[2]);
  if (!match || amount === null) return null;
  return match[1] === '-' ? amount : -amount;
}

function logVerdicts(prompt: string, options: GeneratedQuestionCandidate['options']) {
  const match = clean(prompt).match(/^已知函数 f\(x\)=log_([0-9]+(?:\.[0-9]+)?)\((x(?:[+-][0-9]+(?:\.[0-9]+)?)?)\)，请选择它的定义域。$/);
  const base = numeric(match?.[1]);
  const boundary = match ? argumentBoundary(match[2]) : null;
  if (base === null || base <= 0 || base === 1 || boundary === null) return null;
  const expected: Interval = { lower: boundary, upper: 'positive_infinity', lowerClosed: false, upperClosed: false };
  return options.map((option) => {
    const parsed = interval(option.text);
    return { optionId: option.id, verdict: !parsed ? 'unknown' as const : sameInterval(parsed, expected) ? 'true' as const : 'false' as const };
  });
}

function exponentialVerdicts(prompt: string, options: GeneratedQuestionCandidate['options']) {
  const source = clean(prompt);
  const legacy = source.match(/^已知指数函数 f\(x\)=([0-9]+(?:\.[0-9]+)?)\^x，请选择它的值域。$/);
  const outputSet = source.match(/^函数关系 f\(x\)=([0-9]+(?:\.[0-9]+)?)\^x 给出每个实数输入的输出；这些输出组成哪一个值域？$/);
  const match = legacy ?? outputSet;
  const base = numeric(match?.[1]);
  if (base === null || base <= 0 || base === 1) return null;
  const expected: Interval = { lower: 0, upper: 'positive_infinity', lowerClosed: false, upperClosed: false };
  return options.map((option) => {
    const parsed = interval(option.text);
    return { optionId: option.id, verdict: !parsed ? 'unknown' as const : sameInterval(parsed, expected) ? 'true' as const : 'false' as const };
  });
}

function radicalVerdicts(prompt: string, options: GeneratedQuestionCandidate['options']) {
  const match = clean(prompt).match(/^已知函数 f\(x\)=√\(([+-]?\d+(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?\)，判断它在给定区间上的单调性。$/);
  const coefficient = numeric(match?.[1]);
  const offset = numeric(match?.[2] ?? '0');
  if (coefficient === null || coefficient === 0 || offset === null) return null;
  const boundary = -offset / coefficient;
  const domain: Interval = coefficient > 0
    ? { lower: boundary, upper: 'positive_infinity', lowerClosed: true, upperClosed: false }
    : { lower: 'negative_infinity', upper: boundary, lowerClosed: false, upperClosed: true };
  const expectedDirection = coefficient > 0 ? '递增' : '递减';
  return options.map((option) => {
    const source = clean(option.text);
    const directionMatch = source.match(/单调(递增|递减)$/);
    if (!directionMatch) return { optionId: option.id, verdict: 'unknown' as const };
    let claimed: Interval | null = null;
    if (/在定义域内/.test(source)) claimed = domain;
    else if (/在 (?:R|ℝ) 上/.test(source)) {
      claimed = { lower: 'negative_infinity', upper: 'positive_infinity', lowerClosed: false, upperClosed: false };
    } else {
      const intervalMatch = source.match(/在 (.+?) 上单调/);
      claimed = intervalMatch ? interval(intervalMatch[1]) : null;
    }
    if (!claimed) return { optionId: option.id, verdict: 'unknown' as const };
    const truth = directionMatch[1] === expectedDirection && containedIn(claimed, domain);
    return { optionId: option.id, verdict: truth ? 'true' as const : 'false' as const };
  });
}

function powerVerdicts(prompt: string, options: GeneratedQuestionCandidate['options']) {
  const source = clean(prompt);
  const legacy = source.match(/^已知幂函数 f\(x\)=x\^(\d+)，求函数值 f\(([+-]?\d+(?:\.\d+)?)\)。$/);
  const substitution = source.match(/^把 x=([+-]?\d+(?:\.\d+)?) 代入幂函数 f\(x\)=x\^(\d+)。下列哪一项正确记录了所得函数值？$/);
  const semanticSubstitution = source.match(/^对幂函数 f\(x\)=x\^(\d+)，把 x=([+-]?\d+(?:\.\d+)?) 代入后，哪一条函数值等式成立？$/);
  const exponent = numeric(legacy?.[1] ?? substitution?.[2] ?? semanticSubstitution?.[1]);
  const input = numeric(legacy?.[2] ?? substitution?.[1] ?? semanticSubstitution?.[2]);
  if (exponent === null || !Number.isInteger(exponent) || exponent < 1 || input === null) return null;
  const expected = input ** exponent;
  return options.map((option) => {
    const claim = clean(option.text).match(/^f\(([+-]?\d+(?:\.\d+)?)\)=([+-]?\d+(?:\.\d+)?)$/);
    const claimInput = numeric(claim?.[1]);
    const claimValue = numeric(claim?.[2]);
    if (claimInput === null || claimValue === null) return { optionId: option.id, verdict: 'unknown' as const };
    const truth = Math.abs(claimInput - input) <= 1e-9 && Math.abs(claimValue - expected) <= 1e-9;
    return { optionId: option.id, verdict: truth ? 'true' as const : 'false' as const };
  });
}

export function verifySubjectPracticeMathElementaryWithIndependentOracle(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathElementaryIndependentOracleEvidence {
  const binding = bindPlan(context.questionPlan);
  const optionVerdicts = clean(candidate.subject).toLowerCase() !== 'math' || !binding
    ? null
    : binding.functionClass === 'logarithmic' ? logVerdicts(candidate.prompt, candidate.options)
      : binding.functionClass === 'exponential' ? exponentialVerdicts(candidate.prompt, candidate.options)
        : binding.functionClass === 'radical' ? radicalVerdicts(candidate.prompt, candidate.options)
          : powerVerdicts(candidate.prompt, candidate.options);
  const verdicts = optionVerdicts ?? candidate.options.map((option) => ({ optionId: option.id, verdict: 'unknown' as const }));
  const hasUnknown = verdicts.some((option) => option.verdict === 'unknown');
  const trueOptionIds = verdicts.filter((option) => option.verdict === 'true').map((option) => option.optionId);
  const uniqueAnswer = Boolean(optionVerdicts) && !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const reasonCodes: string[] = [];
  if (!binding) reasonCodes.push('math_independent_oracle_plan_scope_mismatch');
  if (binding && !optionVerdicts) reasonCodes.push('math_independent_oracle_prompt_unparsed');
  if (hasUnknown) reasonCodes.push('math_independent_oracle_option_unparsed');
  if (optionVerdicts && !hasUnknown && trueOptionIds.length !== 1) reasonCodes.push(trueOptionIds.length ? 'math_independent_oracle_multiple_true_options' : 'math_independent_oracle_no_true_option');
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('math_independent_oracle_generator_disagreement');
  const status = !binding || !optionVerdicts || hasUnknown
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    oracleVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION,
    status,
    functionClass: binding?.functionClass ?? null,
    propertyTarget: binding?.propertyTarget ?? null,
    optionVerdicts: verdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    scopeId: binding?.scopeId ?? null,
    scopeMatched: Boolean(binding && optionVerdicts),
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes
  };
}
