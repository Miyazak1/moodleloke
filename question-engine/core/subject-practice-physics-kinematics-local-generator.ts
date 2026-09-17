import {
  GeneratedQuestionCandidate,
  QuestionGenerationBlueprint,
  QuestionOption,
  SubjectPracticeQuestionPlanAdherence,
  SubjectPracticeScenarioBlueprintShadowContext,
  SubjectPracticeScenarioValidation,
  SubjectPracticeQuestionPlanPorts
} from './types';
import {
  solveSubjectPracticePhysicsKinematics,
  SubjectPracticePhysicsKinematicsSolverEvidence
} from './subject-practice-physics-kinematics-solver';

export const SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION =
  'physics-kinematics-local-generator-v3-semantic-options';

export type SubjectPracticePhysicsKinematicsLocalRelation =
  | 'uniform_speed'
  | 'acceleration_from_velocity_change'
  | 'final_velocity_from_initial_acceleration_time'
  | 'displacement_from_initial_acceleration_time';

const SUPPORTED_RELATIONS = new Set<SubjectPracticePhysicsKinematicsLocalRelation>([
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
]);

type LocalGeneratorStatus = 'generated_and_self_verified' | 'unsupported_question_plan' | 'self_verification_failed';

export type SubjectPracticePhysicsKinematicsLocalGenerationResult = {
  generatorVersion: string;
  status: LocalGeneratorStatus;
  candidate: GeneratedQuestionCandidate | null;
  verification: SubjectPracticePhysicsKinematicsSolverEvidence | null;
  adherence: SubjectPracticeQuestionPlanAdherence | null;
  seed: number;
  relationKind: SubjectPracticePhysicsKinematicsLocalRelation;
  scopeId: string | null;
  providerImpact: 'none_no_provider_call';
  estimatedCostUsd: 0;
  productionImpact: 'none_shadow_only';
  reasonCodes: string[];
  scenarioRenderMode: 'controlled_catalog' | 'provisional_blueprint_shadow' | 'provisional_blueprint_shadow_rejected';
  provisionalScenarioContractDigest: string | null;
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedSeed(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

function rounded(value: number) {
  return Number(value.toFixed(6));
}

function orderedOptions(values: Array<{ zh: string; en: string; intent: string }>, correctIndex: number) {
  const correct = values[0];
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, correct);
  const zh: QuestionOption[] = ordered.map((value, index) => ({ id: String.fromCharCode(65 + index), text: value.zh }));
  const en: QuestionOption[] = ordered.map((value, index) => ({ id: String.fromCharCode(65 + index), text: value.en }));
  return {
    zh,
    en,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    optionMetadata: ordered.map((value, index) => ({
      optionId: String.fromCharCode(65 + index),
      distractorIntent: value.intent,
      misconceptionTags: value === correct ? [] : [value.intent]
    }))
  };
}

function numericOptions(
  expected: number,
  unit: string,
  correctIndex: number,
  relationKind: SubjectPracticePhysicsKinematicsLocalRelation
) {
  const scale = Math.max(1, Math.ceil(Math.abs(expected) * 0.1));
  const values = [expected, expected + scale, expected - scale, expected + 2 * scale].map(rounded);
  const intents = ['correct_direct_relation', 'additive_overestimate', 'additive_underestimate', 'double_offset_error'];
  const labels = relationKind === 'uniform_speed'
    ? { zh: '速度大小', en: 'Speed magnitude' }
    : relationKind === 'acceleration_from_velocity_change'
      ? { zh: '加速度', en: 'Acceleration' }
      : relationKind === 'final_velocity_from_initial_acceleration_time'
        ? { zh: '末速度', en: 'Final velocity' }
        : { zh: '位移', en: 'Displacement' };
  return orderedOptions(values.map((value, index) => ({
    zh: `${labels.zh}：${value} ${unit}`,
    en: `${labels.en}: ${value} ${unit}`,
    intent: intents[index]
  })), correctIndex);
}

function candidateFor(input: {
  blueprint: QuestionGenerationBlueprint;
  questionPlan: unknown;
  relationKind: SubjectPracticePhysicsKinematicsLocalRelation;
  seed: number;
  scenarioSurfaceOverride?: unknown;
}): GeneratedQuestionCandidate {
  const { blueprint, relationKind, seed } = input;
  const plan = recordFrom(input.questionPlan);
  const scenario = recordFrom(plan?.scenarioContract);
  const surface = recordFrom(input.scenarioSurfaceOverride) ?? recordFrom(scenario?.surface);
  const entityZh = clean(surface?.zhEntity) || '物体';
  const entityEn = clean(surface?.enEntity) || 'object';
  const settingZh = clean(surface?.zhSetting) || '直线运动情境';
  const settingEn = clean(surface?.enSetting) || 'a straight-line motion setting';
  const zhLead = `在${settingZh}中，${entityZh}`;
  const enLead = `During ${settingEn}, the ${entityEn}`;
  const correctIndex = seed % 4;
  const duration = 2 + (seed % 11);
  const initial = 1 + (Math.floor(seed / 11) % 29);
  const acceleration = 1 + (Math.floor(seed / (11 * 29)) % 7);
  let prompt = '';
  let promptEn = '';
  let explanation = '';
  let explanationEn = '';
  let expected = 0;
  let unit = 'm/s';

  if (relationKind === 'uniform_speed') {
    const speed = initial + acceleration;
    const distance = speed * duration;
    expected = speed;
    prompt = `${zhLead}沿直线做匀速运动，位移为 ${distance} m，用时为 ${duration} s，求其速度大小。`;
    promptEn = `${enLead} moves uniformly in a straight line through ${distance} m in ${duration} s. Find its speed.`;
    explanation = `对${entityZh}使用匀速关系 v=s/t；代入 s=${distance} m、t=${duration} s，可得速度大小为 ${expected} m/s，因此唯一匹配的选项正确。`;
    explanationEn = `For the ${entityEn}, apply the uniform-motion relation v=s/t. Substituting s=${distance} m and t=${duration} s gives a speed magnitude of ${expected} m/s, identifying the unique matching option.`;
  } else if (relationKind === 'acceleration_from_velocity_change') {
    const signedAcceleration = seed % 5 === 0 ? -acceleration : acceleration;
    const final = initial + signedAcceleration * duration;
    expected = signedAcceleration;
    unit = 'm/s^2';
    prompt = `${zhLead}沿直线运动，初速度为 ${initial} m/s，末速度为 ${final} m/s，用时为 ${duration} s，求这段时间内的加速度。`;
    promptEn = `${enLead} moves in a straight line with initial velocity ${initial} m/s and reaches ${final} m/s in ${duration} s. Find its acceleration.`;
    explanation = `${entityZh}的速度变化量为 (${final}-${initial}) m/s，持续时间为 ${duration} s；按 a=(v-u)/t，计算结果为 ${expected} m/s^2，因此唯一匹配的选项正确。`;
    explanationEn = `The ${entityEn}'s velocity changes by (${final}-${initial}) m/s over ${duration} s. By a=(v-u)/t, the resulting signed acceleration is ${expected} m/s^2, identifying the unique matching option.`;
  } else if (relationKind === 'final_velocity_from_initial_acceleration_time') {
    const signedAcceleration = seed % 7 === 0 ? -acceleration : acceleration;
    expected = initial + signedAcceleration * duration;
    prompt = `${zhLead}沿直线运动，初速度为 ${initial} m/s，加速度为 ${signedAcceleration} m/s^2，运动 ${duration} s，求最终速度。`;
    promptEn = `${enLead} moves in a straight line with initial velocity ${initial} m/s and acceleration ${signedAcceleration} m/s^2 for ${duration} s. Find its final velocity.`;
    explanation = `对${entityZh}使用 v=u+at；代入 u=${initial} m/s、a=${signedAcceleration} m/s^2、t=${duration} s，计算结果为 ${expected} m/s（末速度），因此唯一匹配的选项正确。`;
    explanationEn = `For the ${entityEn}, apply v=u+at. Substituting u=${initial} m/s, a=${signedAcceleration} m/s^2, and t=${duration} s gives the result ${expected} m/s as the final velocity, identifying the unique matching option.`;
  } else {
    expected = initial * duration + 0.5 * acceleration * duration ** 2;
    unit = 'm';
    prompt = `${zhLead}沿直线运动，初速度为 ${initial} m/s，加速度为 ${acceleration} m/s^2，运动 ${duration} s，求这段时间内的位移。`;
    promptEn = `${enLead} moves in a straight line with initial velocity ${initial} m/s and acceleration ${acceleration} m/s^2 for ${duration} s. Find its displacement.`;
    explanation = `对${entityZh}使用 s=ut+1/2at^2；代入 u=${initial} m/s、a=${acceleration} m/s^2、t=${duration} s，计算结果为 ${expected} m（位移），因此唯一匹配的选项正确。`;
    explanationEn = `For the ${entityEn}, apply s=ut+1/2at^2. Substituting u=${initial} m/s, a=${acceleration} m/s^2, and t=${duration} s gives the result ${expected} m as the displacement, identifying the unique matching option.`;
  }

  const options = numericOptions(expected, unit, correctIndex, relationKind);
  return {
    subject: 'physics',
    topicId: blueprint.topicId,
    blueprintId: blueprint.id,
    sourceType: 'ai',
    designedDifficulty: 'basic',
    questionType: 'single_choice',
    prompt,
    options: options.zh,
    correctAnswer: options.correctAnswer,
    explanation,
    knowledgeTags: ['运动学', '直线运动', relationKind],
    optionMetadata: options.optionMetadata,
    localizations: {
      zh: { prompt, options: options.zh, explanation, knowledgeTags: ['运动学', '直线运动'] },
      en: { prompt: promptEn, options: options.en, explanation: explanationEn, knowledgeTags: ['Kinematics', 'Linear motion'] }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
}

export function createSubjectPracticePhysicsKinematicsLocalGenerator(
  ports: SubjectPracticeQuestionPlanPorts & {
    validateScenario: (input: SubjectPracticeScenarioBlueprintShadowContext) => SubjectPracticeScenarioValidation;
  }
) {
  return function generateSubjectPracticePhysicsKinematicsLocally(input: {
    blueprint: QuestionGenerationBlueprint;
    questionPlan: unknown;
    seed: number;
    relationKind: SubjectPracticePhysicsKinematicsLocalRelation;
    scenarioBlueprintShadowContext?: SubjectPracticeScenarioBlueprintShadowContext;
  }): SubjectPracticePhysicsKinematicsLocalGenerationResult {
  const seed = normalizedSeed(input.seed);
  const plan = recordFrom(input.questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const scenarioValidation = input.scenarioBlueprintShadowContext
    ? ports.validateScenario(input.scenarioBlueprintShadowContext)
    : null;
  const provisionalContract = recordFrom(scenarioValidation?.provisionalScenarioContract);
  const provisionalBinding = recordFrom(input.scenarioBlueprintShadowContext?.binding);
  const provisionalBindingMatches = !input.scenarioBlueprintShadowContext || Boolean(
    scenarioValidation?.valid
    && clean(provisionalBinding?.subject).toLowerCase() === 'physics'
    && clean(provisionalBinding?.taskFamily) === clean(plan?.taskFamily)
    && clean(provisionalBinding?.planTemplate) === clean(plan?.planTemplate)
    && clean(provisionalBinding?.exactScope) === input.relationKind
    && clean(provisionalContract?.solverAction) === input.relationKind
  );
  const planSupported = clean(input.blueprint.subject).toLowerCase() === 'physics'
    && clean(input.blueprint.difficulty).toLowerCase() === 'basic'
    && clean(input.blueprint.questionType).toLowerCase() === 'single_choice'
    && clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.taskFamily) === 'kinematics_basic_direct_relation'
    && clean(plan?.planTemplate) === 'physics_kinematics_basic_relation_v1'
    && ports.validate(input.questionPlan).valid
    && Number(constraints?.maxIndependentRelations) === 1
    && constraints?.forbidMultiStageModelChain === true
    && clean(constraints?.exactPhysicsKinematicsScope) === input.relationKind
    && provisionalBindingMatches
    && SUPPORTED_RELATIONS.has(input.relationKind);
  if (!planSupported) {
    return {
      generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan', candidate: null, verification: null, adherence: null,
      seed, relationKind: input.relationKind, scopeId: null,
      providerImpact: 'none_no_provider_call', estimatedCostUsd: 0, productionImpact: 'none_shadow_only',
      reasonCodes: [
        'physics_kinematics_local_generator_question_plan_not_supported',
        ...(scenarioValidation?.blockers ?? [])
      ],
      scenarioRenderMode: input.scenarioBlueprintShadowContext
        ? 'provisional_blueprint_shadow_rejected'
        : 'controlled_catalog',
      provisionalScenarioContractDigest: null
    };
  }
  const candidate = candidateFor({
    blueprint: input.blueprint, questionPlan: input.questionPlan, relationKind: input.relationKind, seed,
    scenarioSurfaceOverride: provisionalContract?.surface
  });
  const verification = solveSubjectPracticePhysicsKinematics(candidate, { questionPlan: input.questionPlan });
  const adherence = ports.adherenceFor(input.questionPlan, candidate);
  const verified = verification.status === 'verified' && verification.verificationScope.matched && adherence.adheres;
  return {
    generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
    status: verified ? 'generated_and_self_verified' : 'self_verification_failed',
    candidate: verified ? candidate : null,
    verification,
    adherence,
    seed,
    relationKind: input.relationKind,
    scopeId: verification.verificationScope.scopeId,
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only',
    reasonCodes: verified ? [] : [
      'physics_kinematics_local_generator_self_verification_failed',
      ...verification.reasonCodes,
      ...verification.verificationScope.reasonCodes,
      ...adherence.failureCodes
    ],
    scenarioRenderMode: provisionalContract ? 'provisional_blueprint_shadow' : 'controlled_catalog',
    provisionalScenarioContractDigest: clean(provisionalContract?.scenarioContractDigest) || null
  };
  };
}
