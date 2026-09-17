import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION = 'physics-basic-kinematics-solver-v4';
export const SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION = 'physics-basic-kinematics-verification-scope-v2';

type RelationKind =
  | 'uniform_speed'
  | 'acceleration_from_velocity_change'
  | 'final_velocity_from_initial_acceleration_time'
  | 'displacement_from_initial_acceleration_time';
type QuantityDimension = 'distance' | 'speed' | 'acceleration';

type ParsedRelation = {
  kind: RelationKind;
  dimension: QuantityDimension;
  expectedSiValue: number;
  inputs: Record<string, number>;
};

export type SubjectPracticePhysicsKinematicsOptionVerdict = {
  optionId: string;
  verdict: 'true' | 'false' | 'unknown';
  parsedDimension: QuantityDimension | null;
  normalizedSiValue: number | null;
  reasonCode: string;
};

export type SubjectPracticePhysicsKinematicsScope = {
  scopeVersion: string;
  scopeId: string | null;
  status: 'matched' | 'mismatch' | 'missing_plan_contract';
  matched: boolean;
  relationKind: RelationKind | null;
  reasonCodes: string[];
};

export type SubjectPracticePhysicsKinematicsSolverEvidence = {
  solverVersion: string;
  taskFamily: 'kinematics_basic_direct_relation';
  status: 'verified' | 'conflict' | 'unparsed';
  parsed: boolean;
  relationKind: RelationKind | null;
  expectedDimension: QuantityDimension | null;
  expectedSiValue: number | null;
  canonicalTask: {
    relationKind: RelationKind;
    dimension: QuantityDimension;
    expectedSiValue: number;
    inputs: Record<string, number>;
  } | null;
  optionVerdicts: SubjectPracticePhysicsKinematicsOptionVerdict[];
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
  verificationScope: SubjectPracticePhysicsKinematicsScope;
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalized(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[，]/g, ',')
    .replace(/米\s*\/\s*秒/g, 'm/s')
    .replace(/厘米\s*\/\s*秒/g, 'cm/s')
    .replace(/千米\s*\/\s*小时|公里\s*\/\s*小时/g, 'km/h')
    .replace(/秒/g, 's')
    .replace(/分钟/g, 'min')
    .replace(/小时/g, 'h')
    .replace(/²/g, '^2')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-9);
}

function speedUnitMultiplier(unit: string) {
  const value = normalized(unit).toLowerCase().replace(/\s+/g, '');
  if (value === 'm/s' || value === 'm*s^-1' || value === 'ms^-1') return 1;
  if (value === 'cm/s' || value === 'cm*s^-1' || value === 'cms^-1') return 0.01;
  if (value === 'km/h' || value === 'kmh^-1') return 1000 / 3600;
  return null;
}

function distanceUnitMultiplier(unit: string) {
  const value = normalized(unit).toLowerCase();
  if (/^(?:m|meter|meters|metre|metres)$/.test(value)) return 1;
  if (/^(?:cm|centimeter|centimeters|centimetre|centimetres)$/.test(value)) return 0.01;
  if (/^(?:km|kilometer|kilometers|kilometre|kilometres)$/.test(value)) return 1000;
  return null;
}

function timeUnitMultiplier(unit: string) {
  const value = normalized(unit).toLowerCase();
  if (/^(?:s|sec|secs|second|seconds)$/.test(value)) return 1;
  if (/^(?:min|minute|minutes)$/.test(value)) return 60;
  if (/^(?:h|hr|hrs|hour|hours)$/.test(value)) return 3600;
  return null;
}

function accelerationUnitMultiplier(unit: string) {
  const value = normalized(unit).toLowerCase().replace(/\s+/g, '');
  if (/^m(?:\/s\^?2|\*s\^-2|s\^-2)$/.test(value)) return 1;
  if (/^cm(?:\/s\^?2|\*s\^-2|s\^-2)$/.test(value)) return 0.01;
  return null;
}

const NUMBER = '([+-]?\\d+(?:\\.\\d+)?)';
const SPEED_UNIT = '(m\\s*\\/\\s*s|m\\s*(?:\\*|·)?\\s*s\\^-?1|cm\\s*\\/\\s*s|cm\\s*(?:\\*|·)?\\s*s\\^-?1|km\\s*\\/\\s*h)';
const DISTANCE_UNIT = '(km|m|cm|kilometers?|kilometres?|meters?|metres?|centimeters?|centimetres?)';
const TIME_UNIT = '(h|hr|hrs|hours?|min|minutes?|s|sec|secs|seconds?)';

function labelledQuantity(source: string, label: RegExp, unitPattern: string, multiplier: (unit: string) => number | null) {
  const labelSource = label.source.replace(/^\^|\$$/g, '');
  const match = source.match(new RegExp(`(?:${labelSource})[^0-9+\\-]{0,18}${NUMBER}\\s*${unitPattern}`, 'i'));
  if (!match) return null;
  const value = Number(match[1]);
  const factor = multiplier(match[2]);
  return Number.isFinite(value) && factor !== null ? value * factor : null;
}

function parseUniformSpeed(source: string): ParsedRelation | null {
  const asksSpeed = /(?:求|计算).{0,12}(?:速度|速率)|(?:速度|速率).{0,12}(?:是多少|为多少)|what\s+is.{0,12}(?:speed|velocity)|find.{0,12}(?:speed|velocity)/i.test(source);
  if (!asksSpeed || !/(位移|路程|距离|distance|displacement|travels?|moves?|covers?)/i.test(source)) return null;
  const distance = labelledQuantity(source, /位移(?:为|是|=)?|路程(?:为|是|=)?|距离(?:为|是|=)?|distance(?:\s+of)?|displacement(?:\s+of)?|travels?|moves?|covers?/i, DISTANCE_UNIT, distanceUnitMultiplier);
  const duration = labelledQuantity(source, /用时(?:为|是|=)?|时间(?:为|是|=)?|duration(?:\s+of)?|time(?:\s+of)?|in|over|during/i, TIME_UNIT, timeUnitMultiplier)
    ?? (() => {
      const match = source.match(new RegExp(`${NUMBER}\\s*${TIME_UNIT}\\s*(?:内|中)`, 'i'));
      if (!match) return null;
      const factor = timeUnitMultiplier(match[2]);
      return factor === null ? null : Number(match[1]) * factor;
    })();
  if (distance === null || duration === null || !Number.isFinite(distance) || !Number.isFinite(duration) || duration <= 0) return null;
  return { kind: 'uniform_speed', dimension: 'speed', expectedSiValue: distance / duration, inputs: { distanceMeters: distance, durationSeconds: duration } };
}

function parseAcceleration(source: string): ParsedRelation | null {
  const asksAcceleration = /(?:求|计算).{0,12}加速度|加速度.{0,12}(?:是多少|为多少)|what\s+is.{0,12}acceleration|find.{0,12}acceleration/i.test(source);
  if (!asksAcceleration) return null;
  const initial = labelledQuantity(source, /初速度(?:为|是|=)?|初始速度(?:为|是|=)?|initial\s+(?:velocity|speed)|starts?\s+at|from/i, SPEED_UNIT, speedUnitMultiplier);
  const final = labelledQuantity(source, /末速度(?:为|是|=)?|最终速度(?:为|是|=)?|final\s+(?:velocity|speed)|reaches?|to/i, SPEED_UNIT, speedUnitMultiplier);
  const duration = labelledQuantity(source, /用时(?:为|是|=)?|时间(?:为|是|=)?|duration(?:\s+of)?|time(?:\s+of)?|in|over|during/i, TIME_UNIT, timeUnitMultiplier);
  if (initial === null || final === null || duration === null || duration <= 0) return null;
  return {
    kind: 'acceleration_from_velocity_change',
    dimension: 'acceleration',
    expectedSiValue: (final - initial) / duration,
    inputs: { initialSpeedMetersPerSecond: initial, finalSpeedMetersPerSecond: final, durationSeconds: duration }
  };
}

function parseFinalVelocity(source: string): ParsedRelation | null {
  const asksFinalVelocity = /(?:求|计算).{0,12}(?:末速度|最终速度)|(?:末速度|最终速度).{0,12}(?:是多少|为多少)|what\s+is.{0,16}final\s+(?:velocity|speed)|find.{0,16}final\s+(?:velocity|speed)|(?:velocity|speed)\s+at\s+(?:the\s+)?end\s+of.{0,18}\s+is/i.test(source);
  if (!asksFinalVelocity) return null;
  const initial = labelledQuantity(source, /初速度(?:为|是|=)?|初始速度(?:为|是|=)?|initial\s+(?:velocity|speed)|starts?\s+at|from/i, SPEED_UNIT, speedUnitMultiplier)
    ?? (/(?:starts?|begins?|undergoes?).{0,60}from\s+rest|from\s+rest.{0,60}(?:starts?|begins?|undergoes?)/i.test(source) ? 0 : null);
  const acceleration = labelledQuantity(source, /加速度(?:为|是|=)?|acceleration(?:\s+of)?|with\s+a\s*=/i, '(m\\s*\\/\\s*s\\^?2|m\\s*(?:\\*|·)?\\s*s\\^-?2|cm\\s*\\/\\s*s\\^?2|cm\\s*(?:\\*|·)?\\s*s\\^-?2)', accelerationUnitMultiplier);
  const duration = labelledQuantity(source, /用时(?:为|是|=)?|时间(?:为|是|=)?|运动(?:了|时间为)?|duration(?:\s+of)?|time(?:\s+of)?|end\s+of|in|over|during|for/i, TIME_UNIT, timeUnitMultiplier);
  if (initial === null || acceleration === null || duration === null || duration <= 0) return null;
  return {
    kind: 'final_velocity_from_initial_acceleration_time',
    dimension: 'speed',
    expectedSiValue: initial + acceleration * duration,
    inputs: { initialSpeedMetersPerSecond: initial, accelerationMetersPerSecondSquared: acceleration, durationSeconds: duration }
  };
}

function parseDisplacement(source: string): ParsedRelation | null {
  const asksDisplacement = /(?:求|计算).{0,12}(?:位移|路程|距离)|(?:位移|路程|距离).{0,12}(?:是多少|为多少)|what\s+is.{0,16}(?:displacement|distance)|find.{0,16}(?:displacement|distance)/i.test(source);
  if (!asksDisplacement) return null;
  const initial = labelledQuantity(source, /初速度(?:为|是|=)?|初始速度(?:为|是|=)?|initial\s+(?:velocity|speed)|starts?\s+at|from/i, SPEED_UNIT, speedUnitMultiplier);
  const acceleration = labelledQuantity(source, /加速度(?:为|是|=)?|acceleration(?:\s+of)?/i, '(m\\s*\\/\\s*s\\^?2|m\\s*(?:\\*|·)?\\s*s\\^-?2|cm\\s*\\/\\s*s\\^?2|cm\\s*(?:\\*|·)?\\s*s\\^-?2)', accelerationUnitMultiplier);
  const duration = labelledQuantity(source, /用时(?:为|是|=)?|时间(?:为|是|=)?|运动(?:了|时间为)?|duration(?:\s+of)?|time(?:\s+of)?|in|over|during|for/i, TIME_UNIT, timeUnitMultiplier);
  if (initial === null || acceleration === null || duration === null || duration <= 0) return null;
  return {
    kind: 'displacement_from_initial_acceleration_time',
    dimension: 'distance',
    expectedSiValue: initial * duration + 0.5 * acceleration * duration ** 2,
    inputs: { initialSpeedMetersPerSecond: initial, accelerationMetersPerSecondSquared: acceleration, durationSeconds: duration }
  };
}

function parseRelation(prompt: string): ParsedRelation | null {
  const source = normalized(prompt);
  if (/(?:s|x|v|a)\s*[-–—]?\s*t\s*(?:图|图像|graph)|分段|piecewise|曲线|curve/i.test(source)) return null;
  return parseAcceleration(source) ?? parseFinalVelocity(source) ?? parseDisplacement(source) ?? parseUniformSpeed(source);
}

function parseOption(optionId: string, rawText: string, relation: ParsedRelation): SubjectPracticePhysicsKinematicsOptionVerdict {
  const source = normalized(rawText);
  const unitPattern = relation.dimension === 'speed'
    ? /(m\s*\/\s*s|m\s*(?:\*|·)?\s*s\^-?1|cm\s*\/\s*s|cm\s*(?:\*|·)?\s*s\^-?1|km\s*\/\s*h)/i
    : relation.dimension === 'acceleration'
      ? /(m\s*\/\s*s\^?2|m\s*(?:\*|·)?\s*s\^-?2|cm\s*\/\s*s\^?2|cm\s*(?:\*|·)?\s*s\^-?2)/i
      : /(km|cm|m|kilometers?|kilometres?|meters?|metres?|centimeters?|centimetres?)(?!\s*\/)/i;
  const numberMatch = source.match(/[+-]?\d+(?:\.\d+)?/);
  const unitMatch = source.match(unitPattern);
  if (!numberMatch || !unitMatch) {
    return { optionId, verdict: 'unknown', parsedDimension: null, normalizedSiValue: null, reasonCode: 'physics_solver_option_quantity_or_unit_unparsed' };
  }
  const multiplier = relation.dimension === 'speed'
    ? speedUnitMultiplier(unitMatch[1])
    : relation.dimension === 'acceleration'
      ? accelerationUnitMultiplier(unitMatch[1])
      : distanceUnitMultiplier(unitMatch[1]);
  if (multiplier === null) {
    return { optionId, verdict: 'unknown', parsedDimension: null, normalizedSiValue: null, reasonCode: 'physics_solver_option_unit_unsupported' };
  }
  const normalizedSiValue = Number(numberMatch[0]) * multiplier;
  const correct = sameNumber(normalizedSiValue, relation.expectedSiValue);
  return {
    optionId,
    verdict: correct ? 'true' : 'false',
    parsedDimension: relation.dimension,
    normalizedSiValue,
    reasonCode: correct ? 'physics_solver_quantity_matches' : 'physics_solver_quantity_mismatch'
  };
}

function verificationScopeFor(questionPlan: unknown, relation: ParsedRelation | null): SubjectPracticePhysicsKinematicsScope {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const contractPresent = Boolean(
    plan
    && normalized(plan.schemaVersion) === 'subject-practice-question-plan-v1'
    && normalized(plan.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && normalized(plan.planTemplate) === 'physics_kinematics_basic_relation_v1'
    && normalized(plan.taskFamily) === 'kinematics_basic_direct_relation'
    && normalized(plan.targetDifficulty).toLowerCase() === 'basic'
    && constraints?.maxIndependentRelations === 1
    && constraints?.forbidMultiStageModelChain === true
  );
  const reasonCodes: string[] = [];
  if (!contractPresent) reasonCodes.push('physics_solver_verification_scope_plan_contract_missing');
  if (contractPresent && !relation) reasonCodes.push('physics_solver_verification_scope_relation_unparsed');
  const matched = contractPresent && Boolean(relation) && reasonCodes.length === 0;
  return {
    scopeVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SCOPE_VERSION,
    scopeId: contractPresent && relation ? `physics-basic-kinematics-v2:${relation.kind}` : null,
    status: !contractPresent ? 'missing_plan_contract' : matched ? 'matched' : 'mismatch',
    matched,
    relationKind: relation?.kind ?? null,
    reasonCodes
  };
}

export function solveSubjectPracticePhysicsKinematics(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticePhysicsKinematicsSolverEvidence {
  const relation = parseRelation(candidate.prompt);
  const verificationScope = verificationScopeFor(context.questionPlan, relation);
  const optionVerdicts = relation
    ? candidate.options.map((option) => parseOption(option.id, option.text, relation))
    : candidate.options.map((option) => ({
      optionId: option.id,
      verdict: 'unknown' as const,
      parsedDimension: null,
      normalizedSiValue: null,
      reasonCode: 'physics_solver_relation_unparsed'
    }));
  const hasUnknown = optionVerdicts.some((item) => item.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((item) => item.verdict === 'true').map((item) => item.optionId);
  const uniqueAnswer = !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const reasonCodes: string[] = [];
  if (!relation) reasonCodes.push('physics_solver_relation_unparsed');
  if (hasUnknown) reasonCodes.push('physics_solver_option_unparsed');
  if (!hasUnknown && trueOptionIds.length !== 1) reasonCodes.push(trueOptionIds.length === 0
    ? 'physics_solver_no_true_option'
    : 'physics_solver_multiple_true_options');
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('physics_solver_generator_answer_disagrees');
  const status = !relation || hasUnknown
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator
      ? 'verified'
      : 'conflict';
  return {
    solverVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
    taskFamily: 'kinematics_basic_direct_relation',
    status,
    parsed: Boolean(relation) && !hasUnknown,
    relationKind: relation?.kind ?? null,
    expectedDimension: relation?.dimension ?? null,
    expectedSiValue: relation?.expectedSiValue ?? null,
    canonicalTask: relation ? {
      relationKind: relation.kind,
      dimension: relation.dimension,
      expectedSiValue: relation.expectedSiValue,
      inputs: { ...relation.inputs }
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
    verificationScope
  };
}
