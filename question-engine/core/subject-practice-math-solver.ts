import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION = 'math-elementary-direct-property-solver-v1';
export const SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION = 'math-elementary-direct-property-verification-scope-v1';

type Interval = {
  lower: number | '-infinity';
  upper: number | 'infinity';
  lowerClosed: boolean;
  upperClosed: boolean;
};

type IntervalEndpoint = number | '-infinity' | 'infinity';

export type ElementaryFunctionModel =
  | { kind: 'logarithmic'; base: number; offset: number }
  | { kind: 'exponential'; base: number }
  | { kind: 'radical'; coefficient: number; offset: number }
  | { kind: 'positive_integer_power'; exponent: number };

export type SubjectPracticeMathSolverOptionVerdict = {
  optionId: string;
  verdict: 'true' | 'false' | 'unknown';
  property: 'domain' | 'range' | 'monotonicity' | 'function_value' | 'unknown';
  reasonCode: string;
  semanticValue: {
    kind: 'interval'; lower: IntervalEndpoint; upper: IntervalEndpoint; lowerClosed: boolean; upperClosed: boolean;
  } | {
    kind: 'monotonicity'; direction: 'increasing' | 'decreasing'; interval: Interval;
  } | {
    kind: 'function_value'; input: number; value: number;
  } | null;
};

export type SubjectPracticeMathSolverEvidence = {
  solverVersion: string;
  taskFamily: 'elementary_function_direct_property';
  status: 'verified' | 'conflict' | 'unparsed';
  parsed: boolean;
  functionKind: ElementaryFunctionModel['kind'] | null;
  canonicalTask: {
    model: ElementaryFunctionModel;
    propertyTarget: 'domain' | 'range' | 'monotonicity' | 'function_value';
    evaluationInput: number | null;
  } | null;
  optionVerdicts: SubjectPracticeMathSolverOptionVerdict[];
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
  verificationScope: SubjectPracticeMathVerificationScope;
};

export type SubjectPracticeMathVerificationScope = {
  scopeVersion: string;
  scopeId: string | null;
  status: 'matched' | 'mismatch' | 'missing_plan_contract';
  matched: boolean;
  plannedFunctionClass: string | null;
  plannedPropertyTarget: string | null;
  observedFunctionClass: string | null;
  observedPropertyTargets: string[];
  reasonCodes: string[];
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const VERIFIABLE_ROTATION_PAIRS = new Set([
  'logarithmic:domain',
  'exponential:range',
  'radical:monotonicity',
  'power:function_value'
]);

function solverFunctionClass(model: ElementaryFunctionModel | null) {
  if (!model) return null;
  return model.kind === 'positive_integer_power' ? 'power' : model.kind;
}

function verificationScopeFor(
  questionPlan: unknown,
  model: ElementaryFunctionModel | null,
  optionVerdicts: SubjectPracticeMathSolverOptionVerdict[]
): SubjectPracticeMathVerificationScope {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const plannedFunctionClass = normalized(constraints?.requiredElementaryFunctionClass).toLowerCase() || null;
  const plannedPropertyTarget = normalized(constraints?.requiredSinglePropertyTarget).toLowerCase() || null;
  const observedFunctionClass = solverFunctionClass(model);
  const observedPropertyTargets = Array.from(new Set(optionVerdicts
    .map((item) => item.property)
    .filter((property) => property !== 'unknown'))).sort();
  const contractPresent = Boolean(
    plan
    && normalized(plan.schemaVersion) === 'subject-practice-question-plan-v1'
    && normalized(plan.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && normalized(plan.planTemplate) === 'math_elementary_function_relation_v1'
    && normalized(plan.taskFamily) === 'elementary_function_direct_property'
    && normalized(plan.targetDifficulty).toLowerCase() === 'basic'
    && normalized(constraints?.singlePropertyTargetContractVersion) === 'math-basic-elementary-single-property-target-v1'
    && plannedFunctionClass
    && plannedPropertyTarget
  );
  const pair = `${plannedFunctionClass ?? ''}:${plannedPropertyTarget ?? ''}`;
  const reasonCodes: string[] = [];
  if (!contractPresent) reasonCodes.push('math_solver_verification_scope_plan_contract_missing');
  if (contractPresent && !VERIFIABLE_ROTATION_PAIRS.has(pair)) reasonCodes.push('math_solver_verification_scope_rotation_pair_not_allowlisted');
  if (contractPresent && observedFunctionClass !== plannedFunctionClass) reasonCodes.push('math_solver_verification_scope_function_class_mismatch');
  if (contractPresent && (observedPropertyTargets.length !== 1 || observedPropertyTargets[0] !== plannedPropertyTarget)) {
    reasonCodes.push('math_solver_verification_scope_property_target_mismatch');
  }
  const matched = contractPresent && reasonCodes.length === 0;
  return {
    scopeVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION,
    scopeId: contractPresent ? `math-basic-elementary-rotation-v1:${pair}` : null,
    status: !contractPresent ? 'missing_plan_contract' : matched ? 'matched' : 'mismatch',
    matched,
    plannedFunctionClass,
    plannedPropertyTarget,
    observedFunctionClass,
    observedPropertyTargets,
    reasonCodes
  };
}

function normalized(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[，]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function finiteNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signedOffset(sign: string | undefined, raw: string | undefined) {
  const value = raw ? finiteNumber(raw) : 0;
  if (value === null) return null;
  return sign === '-' ? -value : value;
}

function parseElementaryFunction(prompt: string): ElementaryFunctionModel | null {
  const source = normalized(prompt).replace(/[{}]/g, '');
  const log = source.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*(?:log|lg)\s*_?\s*([0-9]+(?:\.[0-9]+)?)\s*\(\s*x\s*([+-])?\s*([0-9]+(?:\.[0-9]+)?)?\s*\)/i);
  if (log) {
    const base = finiteNumber(log[1]);
    const offset = signedOffset(log[2], log[3]);
    if (base !== null && base > 0 && base !== 1 && offset !== null) return { kind: 'logarithmic', base, offset };
  }
  const exponential = source.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*\^\s*x/i);
  if (exponential) {
    const base = finiteNumber(exponential[1]);
    if (base !== null && base > 0 && base !== 1) return { kind: 'exponential', base };
  }
  const radical = source.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*(?:√|sqrt|\\sqrt)\s*[({]?\s*([+-]?[0-9]+(?:\.[0-9]+)?)?\s*\*?\s*x\s*([+-])?\s*([0-9]+(?:\.[0-9]+)?)?\s*[)}]?/i);
  if (radical) {
    const coefficient = radical[1] ? finiteNumber(radical[1]) : 1;
    const offset = signedOffset(radical[2], radical[3]);
    if (coefficient !== null && coefficient !== 0 && offset !== null) return { kind: 'radical', coefficient, offset };
  }
  const power = source.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*x\s*\^\s*([1-9][0-9]*)/i);
  if (power) return { kind: 'positive_integer_power', exponent: Number(power[1]) };
  return null;
}

function allRealInterval(): Interval {
  return { lower: '-infinity', upper: 'infinity', lowerClosed: false, upperClosed: false };
}

function lowerBoundInterval(lower: number, closed: boolean): Interval {
  return { lower, upper: 'infinity', lowerClosed: closed, upperClosed: false };
}

function upperBoundInterval(upper: number, closed: boolean): Interval {
  return { lower: '-infinity', upper, lowerClosed: false, upperClosed: closed };
}

function parseEndpoint(value: string): IntervalEndpoint | null {
  const compact = value.replace(/\s+/g, '').toLowerCase();
  if (['+∞', '∞', '+infinity', 'infinity'].includes(compact)) return 'infinity';
  if (['-∞', '-infinity'].includes(compact)) return '-infinity';
  return finiteNumber(compact);
}

function parseInterval(value: string, variable = 'x'): Interval | null {
  const source = normalized(value);
  if (/^(?:定义域|值域|domain|range)?\s*(?:为|是|:)?\s*(?:r|ℝ|全体实数|实数集)$/i.test(source)
    || /(?:定义域|domain).*?(?:为|是|is|:)\s*(?:r|ℝ|全体实数|实数集)$/i.test(source)) return allRealInterval();
  const interval = source.match(/([（(\[])\s*([+-]?(?:[0-9]+(?:\.[0-9]+)?|∞|infinity))\s*,\s*([+-]?(?:[0-9]+(?:\.[0-9]+)?|∞|infinity))\s*([\]）)])/i);
  if (interval) {
    const lower = parseEndpoint(interval[2]);
    const upper = parseEndpoint(interval[3]);
    if (lower === null || upper === null || lower === 'infinity' || upper === '-infinity') return null;
    const opening = interval[1];
    const closing = interval[4];
    return {
      lower,
      upper,
      lowerClosed: opening === '[',
      upperClosed: closing === ']'
    };
  }
  const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const comparison = source.match(new RegExp(`${escapedVariable}\\s*(>=|<=|>|<|≥|≤)\\s*([+-]?[0-9]+(?:\\.[0-9]+)?)`, 'i'));
  if (!comparison) return null;
  const boundary = finiteNumber(comparison[2]);
  if (boundary === null) return null;
  if (comparison[1] === '>' || comparison[1] === '≥' || comparison[1] === '>=') {
    return lowerBoundInterval(boundary, comparison[1] !== '>');
  }
  return {
    lower: '-infinity',
    upper: boundary,
    lowerClosed: false,
    upperClosed: comparison[1] !== '<'
  };
}

function sameEndpoint(first: IntervalEndpoint, second: IntervalEndpoint) {
  return typeof first === 'number' && typeof second === 'number'
    ? Math.abs(first - second) <= 1e-9
    : first === second;
}

function sameInterval(first: Interval | null, second: Interval) {
  return Boolean(first
    && sameEndpoint(first.lower, second.lower)
    && sameEndpoint(first.upper, second.upper)
    && first.lowerClosed === second.lowerClosed
    && first.upperClosed === second.upperClosed);
}

function endpointOrder(value: IntervalEndpoint) {
  if (value === '-infinity') return Number.NEGATIVE_INFINITY;
  if (value === 'infinity') return Number.POSITIVE_INFINITY;
  return value;
}

function intervalIsNonEmpty(interval: Interval) {
  const lower = endpointOrder(interval.lower);
  const upper = endpointOrder(interval.upper);
  return lower < upper || (lower === upper && interval.lowerClosed && interval.upperClosed);
}

function intervalSubsetOf(actual: Interval, expected: Interval) {
  if (!intervalIsNonEmpty(actual)) return false;
  const actualLower = endpointOrder(actual.lower);
  const expectedLower = endpointOrder(expected.lower);
  const actualUpper = endpointOrder(actual.upper);
  const expectedUpper = endpointOrder(expected.upper);
  const lowerContained = actualLower > expectedLower
    || (actualLower === expectedLower && (!actual.lowerClosed || expected.lowerClosed));
  const upperContained = actualUpper < expectedUpper
    || (actualUpper === expectedUpper && (!actual.upperClosed || expected.upperClosed));
  return lowerContained && upperContained;
}

function monotonicityClaimInterval(source: string, domain: Interval) {
  if (/定义域内|on\s+(?:its|the)\s+domain/i.test(source)) return domain;
  const parsed = parseInterval(source);
  if (parsed) return parsed;
  if (/(?:在|on)\s*(?:r|ℝ|全体实数|all real numbers)(?:\s*上|\b)/i.test(source)) return allRealInterval();
  return null;
}

function domainFor(model: ElementaryFunctionModel): Interval | null {
  if (model.kind === 'logarithmic') return lowerBoundInterval(-model.offset, false);
  if (model.kind === 'radical') {
    const boundary = -model.offset / model.coefficient;
    return model.coefficient > 0 ? lowerBoundInterval(boundary, true) : upperBoundInterval(boundary, true);
  }
  if (model.kind === 'exponential' || model.kind === 'positive_integer_power') return allRealInterval();
  return null;
}

function rangeFor(model: ElementaryFunctionModel): Interval | null {
  if (model.kind === 'logarithmic') return allRealInterval();
  if (model.kind === 'exponential') return lowerBoundInterval(0, false);
  if (model.kind === 'radical') return lowerBoundInterval(0, true);
  if (model.kind === 'positive_integer_power') return model.exponent % 2 === 0 ? lowerBoundInterval(0, true) : allRealInterval();
  return null;
}

function monotonicityFor(model: ElementaryFunctionModel): 'increasing' | 'decreasing' | 'neither' {
  if (model.kind === 'logarithmic' || model.kind === 'exponential') return model.base > 1 ? 'increasing' : 'decreasing';
  if (model.kind === 'radical') return model.coefficient > 0 ? 'increasing' : 'decreasing';
  return model.exponent % 2 === 1 ? 'increasing' : 'neither';
}

function evaluateAt(model: ElementaryFunctionModel, input: number) {
  if (model.kind === 'logarithmic') {
    const argument = input + model.offset;
    return argument > 0 ? Math.log(argument) / Math.log(model.base) : null;
  }
  if (model.kind === 'exponential') return model.base ** input;
  if (model.kind === 'radical') {
    const argument = model.coefficient * input + model.offset;
    return argument >= 0 ? Math.sqrt(argument) : null;
  }
  return input ** model.exponent;
}

function promptTarget(prompt: string): 'domain' | 'range' | 'monotonicity' | 'function_value' | null {
  const source = normalized(prompt).toLowerCase();
  const matches = [
    { property: 'domain' as const, match: /定义域|domain/.test(source) },
    { property: 'range' as const, match: /值域|range/.test(source) },
    { property: 'monotonicity' as const, match: /单调|monotonic/.test(source) },
    { property: 'function_value' as const, match: /f\s*\(\s*[+-]?[0-9]+(?:\.[0-9]+)?\s*\)|函数值|function value/.test(source) }
  ].filter((item) => item.match);
  return matches.length === 1 ? matches[0].property : null;
}

function evaluationInputFromPrompt(prompt: string) {
  const matches = Array.from(normalized(prompt).matchAll(/f\s*\(\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\)/gi));
  const value = matches.at(-1)?.[1];
  return value === undefined ? null : finiteNumber(value);
}

function optionProperty(value: string, fallback: ReturnType<typeof promptTarget>) {
  const source = normalized(value).toLowerCase();
  const monotonicityClaim = /单调|monotonic|递增|递减|increasing|decreasing/.test(source);
  const functionValueClaim = /f\s*\(\s*[+-]?[0-9]+(?:\.[0-9]+)?\s*\)\s*=/.test(source);
  const properties = [
    { property: 'domain' as const, match: /定义域\s*(?:为|是|:)|domain\s*(?:is|=|:)/.test(source) },
    { property: 'range' as const, match: /值域\s*(?:为|是|:)|range\s*(?:is|=|:)/.test(source) },
    { property: 'monotonicity' as const, match: monotonicityClaim },
    { property: 'function_value' as const, match: functionValueClaim }
  ].filter((item) => item.match);
  if (properties.length > 1) return 'unknown' as const;
  return properties[0]?.property ?? fallback ?? 'unknown';
}

function optionVerdict(model: ElementaryFunctionModel, optionId: string, optionText: string, fallback: ReturnType<typeof promptTarget>): SubjectPracticeMathSolverOptionVerdict {
  const source = normalized(optionText);
  const property = optionProperty(source, fallback);
  if (property === 'domain' || property === 'range') {
    const expected = property === 'domain' ? domainFor(model) : rangeFor(model);
    const actual = parseInterval(source, property === 'domain' ? 'x' : 'y');
    if (!expected || !actual) return { optionId, verdict: 'unknown', property, reasonCode: `math_solver_${property}_claim_unparsed`, semanticValue: null };
    return {
      optionId,
      verdict: sameInterval(actual, expected) ? 'true' : 'false',
      property,
      reasonCode: sameInterval(actual, expected) ? `math_solver_${property}_matches` : `math_solver_${property}_mismatch`,
      semanticValue: { kind: 'interval', ...actual }
    };
  }
  if (property === 'monotonicity') {
    const declaresIncreasing = /单调递增|递增|increasing/i.test(source);
    const declaresDecreasing = /单调递减|递减|decreasing/i.test(source);
    if (declaresIncreasing === declaresDecreasing) return { optionId, verdict: 'unknown', property, reasonCode: 'math_solver_monotonicity_claim_unparsed', semanticValue: null };
    const modelDomain = domainFor(model);
    const claimedInterval = modelDomain ? monotonicityClaimInterval(source, modelDomain) : null;
    if (!modelDomain || !claimedInterval) return { optionId, verdict: 'unknown', property, reasonCode: 'math_solver_monotonicity_interval_unparsed', semanticValue: null };
    if (!intervalSubsetOf(claimedInterval, modelDomain)) {
      return { optionId, verdict: 'false', property, reasonCode: 'math_solver_monotonicity_interval_outside_domain', semanticValue: { kind: 'monotonicity', direction: declaresIncreasing ? 'increasing' : 'decreasing', interval: claimedInterval } };
    }
    const expected = monotonicityFor(model);
    const truth = declaresIncreasing ? expected === 'increasing' : expected === 'decreasing';
    return { optionId, verdict: truth ? 'true' : 'false', property, reasonCode: truth ? 'math_solver_monotonicity_matches' : 'math_solver_monotonicity_direction_mismatch', semanticValue: { kind: 'monotonicity', direction: declaresIncreasing ? 'increasing' : 'decreasing', interval: claimedInterval } };
  }
  if (property === 'function_value') {
    const valueClaim = source.match(/f\s*\(\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\)\s*=\s*([+-]?[0-9]+(?:\.[0-9]+)?)/i);
    if (!valueClaim) return { optionId, verdict: 'unknown', property, reasonCode: 'math_solver_function_value_claim_unparsed', semanticValue: null };
    const input = finiteNumber(valueClaim[1]);
    const claimed = finiteNumber(valueClaim[2]);
    if (input === null || claimed === null) return { optionId, verdict: 'unknown', property, reasonCode: 'math_solver_function_value_claim_unparsed', semanticValue: null };
    const expected = evaluateAt(model, input);
    const truth = expected !== null && Number.isFinite(expected) && Math.abs(expected - claimed) <= 1e-9;
    return { optionId, verdict: truth ? 'true' : 'false', property, reasonCode: truth ? 'math_solver_function_value_matches' : 'math_solver_function_value_mismatch', semanticValue: { kind: 'function_value', input, value: claimed } };
  }
  return { optionId, verdict: 'unknown', property: 'unknown', reasonCode: 'math_solver_option_claim_unparsed', semanticValue: null };
}

export function solveElementaryFunctionDirectProperty(
  candidate: Pick<GeneratedQuestionCandidate, 'subject' | 'prompt' | 'options' | 'correctAnswer'>,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathSolverEvidence {
  const model = normalized(candidate.subject).toLowerCase() === 'math' ? parseElementaryFunction(candidate.prompt) : null;
  if (!model) {
    const optionVerdicts = candidate.options.map((option) => ({
      optionId: option.id,
      verdict: 'unknown' as const,
      property: 'unknown' as const,
      reasonCode: 'math_solver_function_unparsed',
      semanticValue: null
    }));
    return {
      solverVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
      taskFamily: 'elementary_function_direct_property',
      status: 'unparsed',
      parsed: false,
      functionKind: null,
      canonicalTask: null,
      optionVerdicts,
      trueOptionIds: [],
      selectedOptionId: null,
      uniqueAnswer: false,
      agreesWithGenerator: false,
      evidenceBoundary: 'prompt_and_visible_options_only',
      providerImpact: 'none_no_provider_call',
      productionGateImpact: 'none_shadow_only',
      reasonCodes: ['math_solver_function_unparsed'],
      verificationScope: verificationScopeFor(context.questionPlan, null, optionVerdicts)
    };
  }
  const target = promptTarget(candidate.prompt);
  const optionVerdicts = candidate.options.map((option) => optionVerdict(model, option.id, option.text, target));
  const unparsedOptionIds = optionVerdicts.filter((item) => item.verdict === 'unknown').map((item) => item.optionId);
  const trueOptionIds = optionVerdicts.filter((item) => item.verdict === 'true').map((item) => item.optionId);
  const uniqueAnswer = unparsedOptionIds.length === 0 && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const status = unparsedOptionIds.length > 0 ? 'unparsed' : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  const reasonCodes = Array.from(new Set([
    ...optionVerdicts.map((item) => item.reasonCode),
    ...(unparsedOptionIds.length ? ['math_solver_option_set_incomplete'] : []),
    ...(!unparsedOptionIds.length && trueOptionIds.length !== 1 ? ['math_solver_true_option_count_not_one'] : []),
    ...(uniqueAnswer && !agreesWithGenerator ? ['math_solver_generator_answer_disagrees'] : [])
  ]));
  return {
    solverVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
    taskFamily: 'elementary_function_direct_property',
    status,
    parsed: unparsedOptionIds.length === 0,
    functionKind: model.kind,
    canonicalTask: target ? {
      model,
      propertyTarget: target,
      evaluationInput: target === 'function_value' ? evaluationInputFromPrompt(candidate.prompt) : null
    } : null,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes,
    verificationScope: verificationScopeFor(context.questionPlan, model, optionVerdicts)
  };
}
