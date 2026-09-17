import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION = 'physics-kinematics-independent-oracle-v3';

type RelationKind =
  | 'uniform_speed'
  | 'acceleration_from_velocity_change'
  | 'final_velocity_from_initial_acceleration_time'
  | 'displacement_from_initial_acceleration_time';

type OracleModel = { relationKind: RelationKind; expected: number; unit: 'm' | 'm/s' | 'm/s^2' };

export type SubjectPracticePhysicsKinematicsIndependentOracleEvidence = {
  oracleVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  relationKind: RelationKind | null;
  expectedValue: number | null;
  expectedUnit: string | null;
  optionVerdicts: Array<{ optionId: string; verdict: 'true' | 'false' | 'unknown'; value: number | null; unit: string | null }>;
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

function compact(value: unknown) {
  return String(value ?? '').replace(/[−－]/g, '-').replace(/[＝]/g, '=').replace(/²/g, '^2').replace(/\s+/g, ' ').trim();
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrompt(prompt: string): OracleModel | null {
  const source = compact(prompt);
  if (/uniform(?:ly)? accelerated linear motion/i.test(source) && /from rest/i.test(source)
    && /velocity at (?:the )?end of/i.test(source)) {
    const accelerationMatch = source.match(/(?:acceleration(?: is)?(?: a\s*=)?|with\s+a\s*=)\s*([+-]?\d+(?:\.\d+)?)\s*m\/s\^?2/i);
    const durationMatch = source.match(/velocity at (?:the )?end of\s*([+-]?\d+(?:\.\d+)?)\s*(?:s|seconds?)/i);
    const acceleration = number(accelerationMatch?.[1] ?? '');
    const duration = number(durationMatch?.[1] ?? '');
    if (acceleration !== null && duration !== null && duration > 0) {
      return { relationKind: 'final_velocity_from_initial_acceleration_time', expected: acceleration * duration, unit: 'm/s' };
    }
  }
  let match = source.match(/初速度为 ([+-]?\d+(?:\.\d+)?) m\/s，末速度为 ([+-]?\d+(?:\.\d+)?) m\/s，用时为 ([+-]?\d+(?:\.\d+)?) s，求.{0,16}加速度/);
  if (match) {
    const initial = number(match[1]); const final = number(match[2]); const duration = number(match[3]);
    if (initial !== null && final !== null && duration !== null && duration > 0) {
      return { relationKind: 'acceleration_from_velocity_change', expected: (final - initial) / duration, unit: 'm/s^2' };
    }
  }
  match = source.match(/初速度为 ([+-]?\d+(?:\.\d+)?) m\/s，加速度为 ([+-]?\d+(?:\.\d+)?) m\/s\^2，运动 ([+-]?\d+(?:\.\d+)?) s，求最终速度/);
  if (match) {
    const initial = number(match[1]); const acceleration = number(match[2]); const duration = number(match[3]);
    if (initial !== null && acceleration !== null && duration !== null && duration > 0) {
      return { relationKind: 'final_velocity_from_initial_acceleration_time', expected: initial + acceleration * duration, unit: 'm/s' };
    }
  }
  match = source.match(/初速度为 ([+-]?\d+(?:\.\d+)?) m\/s，加速度为 ([+-]?\d+(?:\.\d+)?) m\/s\^2，运动 ([+-]?\d+(?:\.\d+)?) s，求.{0,16}位移/);
  if (match) {
    const initial = number(match[1]); const acceleration = number(match[2]); const duration = number(match[3]);
    if (initial !== null && acceleration !== null && duration !== null && duration > 0) {
      return { relationKind: 'displacement_from_initial_acceleration_time', expected: initial * duration + 0.5 * acceleration * duration ** 2, unit: 'm' };
    }
  }
  match = source.match(/位移为 ([+-]?\d+(?:\.\d+)?) m，用时为 ([+-]?\d+(?:\.\d+)?) s，求.{0,16}速度/);
  if (match) {
    const distance = number(match[1]); const duration = number(match[2]);
    if (distance !== null && duration !== null && duration > 0) {
      return { relationKind: 'uniform_speed', expected: distance / duration, unit: 'm/s' };
    }
  }
  return null;
}

function parseOption(text: string) {
  const match = compact(text).match(/^(?:(?:速度大小|加速度|末速度|位移)\s*[：:]\s*|(?:speed magnitude|acceleration|final velocity|displacement)\s*:\s*)?([+-]?\d+(?:\.\d+)?) (m\/s\^2|m\/s|m)$/i);
  if (!match) return null;
  const value = number(match[1]);
  return value === null ? null : { value, unit: match[2].toLowerCase() };
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-9);
}

function scopeMatched(questionPlan: unknown) {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  return Boolean(plan
    && compact(plan.schemaVersion) === 'subject-practice-question-plan-v1'
    && compact(plan.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && compact(plan.subject).toLowerCase() === 'physics'
    && compact(plan.taskFamily) === 'kinematics_basic_direct_relation'
    && compact(plan.planTemplate) === 'physics_kinematics_basic_relation_v1'
    && compact(plan.targetDifficulty).toLowerCase() === 'basic'
    && constraints?.maxIndependentRelations === 1
    && constraints?.forbidMultiStageModelChain === true);
}

export function verifySubjectPracticePhysicsKinematicsWithIndependentOracle(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticePhysicsKinematicsIndependentOracleEvidence {
  const model = parsePrompt(candidate.prompt);
  const planMatched = scopeMatched(context.questionPlan);
  const optionVerdicts = candidate.options.map((option) => {
    const parsed = model ? parseOption(option.text) : null;
    const verdict = !parsed || !model
      ? 'unknown' as const
      : parsed.unit === model.unit && sameNumber(parsed.value, model.expected)
        ? 'true' as const
        : 'false' as const;
    return { optionId: option.id, verdict, value: parsed?.value ?? null, unit: parsed?.unit ?? null };
  });
  const hasUnknown = optionVerdicts.some((option) => option.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((option) => option.verdict === 'true').map((option) => option.optionId);
  const uniqueAnswer = Boolean(model) && !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const reasonCodes: string[] = [];
  if (!model) reasonCodes.push('physics_independent_oracle_prompt_unparsed');
  if (!planMatched) reasonCodes.push('physics_independent_oracle_plan_scope_mismatch');
  if (hasUnknown) reasonCodes.push('physics_independent_oracle_option_unparsed');
  if (model && !hasUnknown && trueOptionIds.length !== 1) reasonCodes.push(trueOptionIds.length ? 'physics_independent_oracle_multiple_true_options' : 'physics_independent_oracle_no_true_option');
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('physics_independent_oracle_generator_disagreement');
  const status = !model || hasUnknown || !planMatched
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator
      ? 'verified'
      : 'conflict';
  return {
    oracleVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION,
    status,
    relationKind: model?.relationKind ?? null,
    expectedValue: model?.expected ?? null,
    expectedUnit: model?.unit ?? null,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    scopeId: model && planMatched ? `physics-basic-kinematics-v2:${model.relationKind}` : null,
    scopeMatched: Boolean(model && planMatched),
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes
  };
}
