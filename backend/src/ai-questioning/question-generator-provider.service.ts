import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AiGatewayAttempt, AiGatewayMessage } from '../ai-gateway/ai-gateway.types';
import { GeneratedQuestionCandidate } from './ai-questioning.types';
import {
  QuestionGenerationBlueprint,
  QuestionPromptBuilderService,
  questionPromptCharacterBudgetForPlanTemplate
} from './question-prompt-builder.service';
import { generateSubjectPracticeMathElementaryLocally } from './subject-practice-math-elementary-local-generator';
import { generateSubjectPracticePhysicsKinematicsLocally } from './subject-practice-physics-kinematics-local-generator';
import { generateSubjectPracticeChemistryAcidBaseLocally } from './subject-practice-chemistry-acid-base-local-generator';
import { generateSubjectPracticeMathLineRelationLocally } from './subject-practice-math-line-relation-local-generator';
import { generateSubjectPracticeMathDerivativeLocally } from './subject-practice-math-derivative-local-generator';
import { subjectPracticeScenarioEvidenceFor } from './subject-practice-scenario-diversity-policy';
import { subjectPracticeScenarioBlueprintShadowEvidenceFor } from './subject-practice-scenario-blueprint-shadow-evidence-policy';
import {
  assertSubjectPracticeLocalShadowCandidateSeedBinding,
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} from './subject-practice-local-shadow-candidate-seed-policy';

type GenerationProviderResult = {
  candidate: GeneratedQuestionCandidate;
  rawOutput: unknown;
  normalizedOutput: GeneratedQuestionCandidate;
  promptMetadata: unknown;
  agent: {
    role: 'generator';
    name: string;
    provider: string;
    model: string;
    promptVersion: string;
  };
  provider: string;
  model: string;
  status: string;
  error?: string;
  gatewayAttempts?: Array<Pick<AiGatewayAttempt, 'providerId' | 'model' | 'keyId' | 'status' | 'errorCode' | 'latencyMs'>>;
};

type QuestionGeneratorProviderOptions = {
  gatewayMetadata?: Record<string, unknown>;
  maxProviderAttempts?: number;
};

export const SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION =
  'subject-practice-local-generator-shadow-routing-v4-math-derivative';

const SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_EXACT_PLANS = [
  'math:elementary_function_direct_property:math_elementary_function_relation_v1',
  'math:math_line_relation_direct:math_line_relation_direct_v1',
  'math:derivative_direct_evaluation:math_derivative_condition_chain_v1',
  'physics:kinematics_basic_direct_relation:physics_kinematics_basic_relation_v1',
  'chemistry:ph_dilution_strong_acid_base_neutralization:chemistry_strong_acid_base_single_relation_v1'
] as const;

export function subjectPracticeLocalGeneratorShadowPlanSupported(input: {
  subject?: unknown;
  taskFamily?: unknown;
  planTemplate?: unknown;
}) {
  const key = [input.subject, input.taskFamily, input.planTemplate]
    .map((value) => cleanText(value).toLowerCase())
    .join(':');
  return (SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_EXACT_PLANS as readonly string[]).includes(key);
}

export function subjectPracticeLocalGeneratorShadowRoutingPolicy() {
  return {
    routingVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION,
    enabled: enabled(process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED),
    enabledByDefault: false,
    allowedWorkClass: 'observation',
    publicationSuppressionRequired: true,
    providerFallbackOnLocalFailure: 'forbidden',
    reviewProviderModeWhenSelected: 'deterministic_only',
    supportedExactPlans: [...SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_EXACT_PLANS],
    providerImpactWhenSelected: 'none_no_generation_or_review_provider_call',
    automaticPublicationEligible: false,
    productionGateImpact: 'none_shadow_only'
  } as const;
}

export function subjectPracticeReviewProviderModeForGeneration(input: {
  isObservationJob: boolean;
  generatorProvider: string;
}) {
  return input.isObservationJob && input.generatorProvider === 'local-deterministic'
    ? 'deterministic_only' as const
    : 'default' as const;
}

const GENERATOR_AGENT_NAME = process.env.CSCA_AI_QUESTION_GENERATOR_AGENT || 'question-generator-v1';
const GENERATOR_PROMPT_VERSION = process.env.CSCA_AI_QUESTION_GENERATOR_PROMPT_VERSION || 'question-generator-v3-syllabus-style-profile';
const SUPPORTED_PROVIDERS = new Set(['deepseek', 'openai', 'openai-compatible']);
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_PRO_TIMEOUT_MS = 180000;
const DEFAULT_PRO_MAX_TOKENS = 16000;
const DEFAULT_TEMPERATURE = 0.35;
const RULE_MODEL = 'local-question-generator-v1';

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function providerName() {
  return process.env.AI_DEFAULT_PROVIDER || process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER || process.env.CSCA_AI_PROVIDER || 'rule-fallback';
}

function modelName() {
  return process.env.CSCA_AI_QUESTION_GENERATION_MODEL || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || process.env.CSCA_AI_MODEL || 'deepseek-v4-flash';
}

function proModelName() {
  return process.env.CSCA_AI_QUESTION_GENERATION_PRO_MODEL
    || process.env.CSCA_SUBJECT_PRACTICE_PRO_MODEL
    || process.env.DEEPSEEK_PRO_MODEL
    || 'deepseek-v4-pro';
}

function isProModel(model: string) {
  return /deepseek-v4-pro/i.test(model);
}

function timeoutMs(model: string) {
  const fallback = isProModel(model) ? DEFAULT_PRO_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const envName = isProModel(model)
    ? 'CSCA_AI_QUESTION_GENERATION_PRO_TIMEOUT_MS'
    : 'CSCA_AI_QUESTION_GENERATION_TIMEOUT_MS';
  const value = Number(process.env[envName] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function questionGenerationMaxTokensForModel(model: string) {
  const pro = isProModel(model);
  const fallback = pro ? DEFAULT_PRO_MAX_TOKENS : DEFAULT_MAX_TOKENS;
  const envName = pro
    ? 'CSCA_AI_QUESTION_GENERATION_PRO_MAX_TOKENS'
    : 'CSCA_AI_QUESTION_GENERATION_MAX_TOKENS';
  const value = Number(process.env[envName] ?? fallback);
  const upperBound = pro ? 32000 : 8000;
  return Number.isFinite(value) && value > 0
    ? Math.max(3000, Math.min(upperBound, Math.round(value)))
    : fallback;
}

function temperature() {
  const value = Number(process.env.CSCA_AI_QUESTION_GENERATION_TEMPERATURE ?? DEFAULT_TEMPERATURE);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : DEFAULT_TEMPERATURE;
}

function externalReady(hasConfiguredKey = true) {
  const provider = providerName();
  return enabled(process.env.CSCA_AI_QUESTION_GENERATION_ENABLED)
    && provider !== 'rule-fallback'
    && SUPPORTED_PROVIDERS.has(provider)
    && hasConfiguredKey;
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function generationTierFromBlueprint(blueprint: QuestionGenerationBlueprint) {
  const constraints = recordFrom(blueprint.constraints);
  const targetProfile = recordFrom(constraints?.targetProfile);
  return cleanText(
    targetProfile?.subjectPracticeGenerationTier
    || targetProfile?.generationTier
    || targetProfile?.modelTier
    || targetProfile?.preferredModelTier
    || constraints?.subjectPracticeGenerationTier
    || constraints?.generationTier
    || constraints?.modelTier
    || constraints?.preferredModelTier
  );
}

export function questionGenerationModelForBlueprint(blueprint: QuestionGenerationBlueprint) {
  return generationTierFromBlueprint(blueprint).toLowerCase() === 'pro' ? proModelName() : modelName();
}

export function questionGenerationReasoningPolicyFor(blueprint: QuestionGenerationBlueprint, model: string) {
  const planTemplate = questionPlanTemplateFromBlueprint(blueprint);
  const taskFamily = questionPlanTaskFamilyFromBlueprint(blueprint);
  if (/^deepseek-v4-(flash|pro)$/i.test(model)
    && planTemplate === 'math_elementary_function_relation_v1'
    && taskFamily === 'elementary_function_direct_property') {
    return {
      policyVersion: 'question-generation-reasoning-effort-v3',
      thinking: 'disabled' as const,
      reasoningEffort: undefined,
      temperature: temperature(),
      reason: 'basic_direct_property_uses_compact_non_thinking_generation'
    };
  }
  if (/^deepseek-v4-(flash|pro)$/i.test(model) && [
    'math_medium_exp_log_ordering_chain_v1',
    'math_elementary_function_relation_v1',
    'physics_medium_optics_two_relation_v1',
    'chemistry_medium_classification_evidence_v1'
  ].includes(planTemplate)) {
    return {
      policyVersion: 'question-generation-reasoning-effort-v2',
      thinking: 'enabled' as const,
      reasoningEffort: 'low' as const,
      temperature: undefined,
      reason: 'locally_calibrated_guarded_family_use_low_reasoning_with_full_output_ceiling'
    };
  }
  return {
    policyVersion: 'question-generation-reasoning-effort-v2',
    thinking: undefined,
    reasoningEffort: undefined,
    temperature: temperature(),
    reason: 'provider_default_reasoning_policy'
  };
}

function questionPlanTemplateFromBlueprint(blueprint: QuestionGenerationBlueprint) {
  const constraints = recordFrom(blueprint.constraints);
  const expansion = recordFrom(constraints?.expansion);
  const questionPlan = recordFrom(expansion?.questionPlan);
  return cleanText(questionPlan?.planTemplate);
}

function questionPlanTaskFamilyFromBlueprint(blueprint: QuestionGenerationBlueprint) {
  const constraints = recordFrom(blueprint.constraints);
  const expansion = recordFrom(constraints?.expansion);
  const questionPlan = recordFrom(expansion?.questionPlan);
  return cleanText(questionPlan?.taskFamily);
}

function questionPlanFromBlueprint(blueprint: QuestionGenerationBlueprint) {
  const constraints = recordFrom(blueprint.constraints);
  const expansion = recordFrom(constraints?.expansion);
  return recordFrom(expansion?.questionPlan);
}

function localShadowSeed(blueprint: QuestionGenerationBlueprint, metadata: Record<string, unknown>) {
  const binding = assertSubjectPracticeLocalShadowCandidateSeedBinding(
    metadata.observationCandidateSeedBinding
  );
  if (binding.productionRunId !== Number(metadata.productionRunId)
    || binding.productionCellId !== Number(metadata.productionCellId)) {
    throw new Error('local_shadow_candidate_seed_runtime_binding_mismatch');
  }
  return binding.seed;
}

function localShadowRoutingAllowed(options: QuestionGeneratorProviderOptions) {
  const metadata = options.gatewayMetadata ?? {};
  return enabled(process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED)
    && cleanText(metadata.workClass) === 'observation'
    && metadata.suppressStudentPublication === true
    && cleanText(metadata.publicationPolicy) === 'observation_gate_evidence_only_no_student_publication';
}

function unsupportedLocalShadowGeneration(seed: number, reasonCode = 'local_shadow_generator_exact_scope_not_registered') {
  return {
    generatorVersion: 'unsupported-local-shadow-generator',
    status: 'unsupported_question_plan' as const,
    candidate: null,
    seed,
    scopeId: null,
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only',
    reasonCodes: [reasonCode]
  };
}

function localShadowGenerationFor(
  blueprint: QuestionGenerationBlueprint,
  options: QuestionGeneratorProviderOptions
) {
  if (!localShadowRoutingAllowed(options)) return null;
  const questionPlan = questionPlanFromBlueprint(blueprint);
  const scenarioBlueprintShadowContext = recordFrom(options.gatewayMetadata?.scenarioBlueprintShadowContext) ?? undefined;
  const taskFamily = cleanText(questionPlan?.taskFamily);
  const planTemplate = cleanText(questionPlan?.planTemplate);
  const seed = localShadowSeed(blueprint, options.gatewayMetadata ?? {});
  if (cleanText(blueprint.subject).toLowerCase() === 'math'
    && taskFamily === 'elementary_function_direct_property'
    && planTemplate === 'math_elementary_function_relation_v1') {
    return generateSubjectPracticeMathElementaryLocally({ blueprint, questionPlan, seed });
  }
  if (cleanText(blueprint.subject).toLowerCase() === 'math'
    && taskFamily === 'math_line_relation_direct'
    && planTemplate === 'math_line_relation_direct_v1') {
    return generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
  }
  if (cleanText(blueprint.subject).toLowerCase() === 'math'
    && taskFamily === 'derivative_direct_evaluation'
    && planTemplate === 'math_derivative_condition_chain_v1') {
    return generateSubjectPracticeMathDerivativeLocally({ blueprint, questionPlan, seed });
  }
  if (cleanText(blueprint.subject).toLowerCase() === 'physics'
    && taskFamily === 'kinematics_basic_direct_relation'
    && planTemplate === 'physics_kinematics_basic_relation_v1') {
    const renderConstraints = recordFrom(questionPlan?.renderConstraints);
    const relations = [
      'uniform_speed',
      'acceleration_from_velocity_change',
      'final_velocity_from_initial_acceleration_time',
      'displacement_from_initial_acceleration_time'
    ] as const;
    const requestedRelation = cleanText(renderConstraints?.exactPhysicsKinematicsScope);
    const relationKind = relations.find((relation) => relation === requestedRelation);
    if (!relationKind) {
      return unsupportedLocalShadowGeneration(seed, 'local_shadow_generator_exact_physics_scope_missing_or_invalid');
    }
    return generateSubjectPracticePhysicsKinematicsLocally({
      blueprint,
      questionPlan,
      seed,
      relationKind,
      scenarioBlueprintShadowContext
    });
  }
  if (cleanText(blueprint.subject).toLowerCase() === 'chemistry'
    && taskFamily === 'ph_dilution_strong_acid_base_neutralization'
    && planTemplate === 'chemistry_strong_acid_base_single_relation_v1') {
    const renderConstraints = recordFrom(questionPlan?.renderConstraints);
    const slots = [
      ['strong_acid_dilution', 'ph_value'],
      ['strong_acid_dilution', 'acid_base_character'],
      ['strong_base_dilution', 'ph_value'],
      ['strong_base_dilution', 'acid_base_character'],
      ['strong_acid_base_neutralization', 'ph_value'],
      ['strong_acid_base_neutralization', 'acid_base_character']
    ] as const;
    const requestedRelation = cleanText(renderConstraints?.exactChemistryRelationKind);
    const requestedAnswerTarget = cleanText(renderConstraints?.exactChemistryAnswerTarget);
    const requestedSlot = slots.find(([relation, target]) => relation === requestedRelation && target === requestedAnswerTarget);
    if (!requestedSlot) {
      return unsupportedLocalShadowGeneration(seed, 'local_shadow_generator_exact_chemistry_scope_missing_or_invalid');
    }
    const [relationKind, answerTarget] = requestedSlot;
    return generateSubjectPracticeChemistryAcidBaseLocally({
      blueprint, questionPlan, seed, relationKind, answerTarget, scenarioBlueprintShadowContext
    });
  }
  return unsupportedLocalShadowGeneration(seed);
}

export function questionGenerationMaxTokensForBlueprint(blueprint: QuestionGenerationBlueprint, model: string) {
  if (/^deepseek-v4-flash$/i.test(model)
    && questionPlanTemplateFromBlueprint(blueprint) === 'math_elementary_function_relation_v1'
    && questionPlanTaskFamilyFromBlueprint(blueprint) === 'elementary_function_direct_property') {
    return 3000;
  }
  return questionGenerationMaxTokensForModel(model);
}

function providerPromptCharacterCount(messages: unknown) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((sum, message) => {
    const record = recordFrom(message);
    return sum + String(record?.content ?? '').length;
  }, 0);
}

function compactGatewayAttempts(attempts: AiGatewayAttempt[] | undefined) {
  return Array.isArray(attempts)
    ? attempts.map((attempt) => ({
      providerId: attempt.providerId,
      model: attempt.model,
      keyId: attempt.keyId,
      status: attempt.status,
      errorCode: attempt.errorCode,
      latencyMs: attempt.latencyMs
    }))
    : undefined;
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item)).filter(Boolean))).slice(0, 8);
}

function cleanOptions(value: unknown) {
  const optionItems = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? ['A', 'B', 'C', 'D'].map((id) => ({ id, text: (value as Record<string, unknown>)[id] }))
      : [];
  return optionItems
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: String.fromCharCode(65 + index), text: cleanText(item) };
      }
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
      return {
        id: cleanText(record.id || String.fromCharCode(65 + index)).slice(0, 4),
        text: cleanText(record.text)
      };
    })
    .filter((option) => option.id && option.text)
    .slice(0, 4);
}

function cleanOptionMetadata(value: unknown, optionIds: string[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
      const optionId = cleanText(record.optionId).slice(0, 4);
      if (!optionIds.includes(optionId)) return null;
      return {
        optionId,
        distractorIntent: cleanText(record.distractorIntent) || undefined,
        misconceptionTags: cleanTags(record.misconceptionTags)
      };
    })
    .filter(Boolean) as GeneratedQuestionCandidate['optionMetadata'];
}

function cleanLocalization(value: unknown, optionIds: string[]) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const options = cleanOptions(record.options).filter((option) => optionIds.includes(option.id));
  return {
    prompt: cleanText(record.prompt) || undefined,
    options: options.length === optionIds.length ? options : undefined,
    explanation: cleanText(record.explanation) || undefined,
    knowledgeTags: cleanTags(record.knowledgeTags)
  };
}

function cleanLocalizations(value: unknown, fallback: Pick<GeneratedQuestionCandidate, 'prompt' | 'options' | 'explanation' | 'knowledgeTags'>): GeneratedQuestionCandidate['localizations'] {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const optionIds = fallback.options.map((option) => option.id);
  const zh = cleanLocalization(record.zh, optionIds);
  const en = cleanLocalization(record.en, optionIds);
  return {
    zh: {
      prompt: zh.prompt ?? fallback.prompt,
      options: zh.options ?? fallback.options,
      explanation: zh.explanation ?? fallback.explanation,
      knowledgeTags: zh.knowledgeTags.length ? zh.knowledgeTags : fallback.knowledgeTags
    },
    en: {
      prompt: en.prompt,
      options: en.options,
      explanation: en.explanation,
      knowledgeTags: en.knowledgeTags
    }
  };
}

function parseGeneratedJson(output: string) {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function unwrapGeneratedQuestionRecord(record: Record<string, unknown>) {
  const candidateKeys = ['question', 'candidate', 'item', 'generatedQuestion', 'result', 'data'];
  const candidates = [
    record,
    ...candidateKeys
      .map((key) => recordFrom(record[key]))
      .filter((item): item is Record<string, unknown> => Boolean(item))
  ];
  return candidates.find((candidate) => {
    const localizations = recordFrom(candidate.localizations);
    const zh = recordFrom(localizations?.zh);
    return Boolean(candidate.prompt || candidate.options || candidate.correctAnswer || zh?.prompt || zh?.options);
  }) ?? record;
}

function generatorAgent(provider: string, model: string) {
  return {
    role: 'generator' as const,
    name: GENERATOR_AGENT_NAME,
    provider,
    model,
    promptVersion: GENERATOR_PROMPT_VERSION
  };
}

@Injectable()
export class QuestionGeneratorProviderService {
  private readonly gateway: AiGatewayService;

  constructor(
    private readonly promptBuilder: QuestionPromptBuilderService,
    gateway: AiGatewayService
  ) {
    this.gateway = gateway;
  }

  normalizeFromRecord(blueprint: QuestionGenerationBlueprint, record: Record<string, unknown>): GeneratedQuestionCandidate | null {
    const localizationsInput = recordFrom(record.localizations);
    const zhInput = recordFrom(localizationsInput?.zh);
    const options = cleanOptions(record.options ?? zhInput?.options);
    const optionIds = options.map((option) => option.id);
    const correctAnswer = cleanText(record.correctAnswer ?? record.answer ?? record.correct_answer).slice(0, 4);
    const prompt = cleanText(record.prompt ?? zhInput?.prompt);
    const explanation = cleanText(record.explanation ?? zhInput?.explanation);
    if (!prompt || options.length !== 4 || !optionIds.includes(correctAnswer) || !explanation) return null;
    const hasLocalizationInput = Boolean(localizationsInput && Object.keys(localizationsInput).length);
    const localizations = hasLocalizationInput
      ? cleanLocalizations(localizationsInput, {
        prompt,
        options,
        explanation,
        knowledgeTags: cleanTags(record.knowledgeTags ?? zhInput?.knowledgeTags)
      })
      : undefined;
    const zh = localizations?.zh;
    return {
      subject: blueprint.subject,
      topicId: blueprint.topicId,
      blueprintId: blueprint.id,
      sourceType: 'ai',
      designedDifficulty: blueprint.difficulty,
      questionType: blueprint.questionType,
      prompt: zh?.prompt ?? prompt,
      options: zh?.options?.length === 4 ? zh.options : options,
      correctAnswer,
      explanation: zh?.explanation ?? explanation,
      knowledgeTags: zh?.knowledgeTags?.length ? zh.knowledgeTags : cleanTags(record.knowledgeTags ?? zhInput?.knowledgeTags),
      optionMetadata: cleanOptionMetadata(record.optionMetadata, optionIds),
      localizations,
      syllabusVersion: blueprint.syllabusVersion
    };
  }

  async generate(
    blueprint: QuestionGenerationBlueprint,
    fallback: GeneratedQuestionCandidate,
    options: QuestionGeneratorProviderOptions = {}
  ): Promise<GenerationProviderResult> {
    const prompt = this.promptBuilder.build(blueprint);
    const generationTier = generationTierFromBlueprint(blueprint);
    const selectedModel = questionGenerationModelForBlueprint(blueprint);
    const reasoningPolicy = questionGenerationReasoningPolicyFor(blueprint, selectedModel);
    const selectedMaxTokens = questionGenerationMaxTokensForBlueprint(blueprint, selectedModel);
    const localShadowGeneration = localShadowGenerationFor(blueprint, options);
    if (localShadowGeneration) {
      const scenarioBlueprintShadowContext = recordFrom(options.gatewayMetadata?.scenarioBlueprintShadowContext);
      const scenarioBlueprintShadowEvidence = scenarioBlueprintShadowContext
        ? subjectPracticeScenarioBlueprintShadowEvidenceFor({
          scenarioBlueprintShadowContext,
          generationResult: localShadowGeneration
        })
        : null;
      const scenarioEvidence = scenarioBlueprintShadowEvidence ?? subjectPracticeScenarioEvidenceFor({
        questionPlan: questionPlanFromBlueprint(blueprint), candidate: localShadowGeneration.candidate
      });
      const scenarioConsistent = Boolean(localShadowGeneration.candidate && (
        scenarioBlueprintShadowEvidence
          ? scenarioBlueprintShadowEvidence.status === 'shadow_candidate_evidence_complete'
          : scenarioEvidence.status === 'consistent'
      ));
      const promptMetadata = {
        ...(recordFrom(prompt.metadata) ?? {}),
        localShadowGeneration: {
          routingVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION,
          candidateSeedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
          candidateSeedBinding: assertSubjectPracticeLocalShadowCandidateSeedBinding(
            options.gatewayMetadata?.observationCandidateSeedBinding
          ),
          generatorVersion: localShadowGeneration.generatorVersion,
          status: localShadowGeneration.status,
          seed: localShadowGeneration.seed,
          scopeId: localShadowGeneration.scopeId,
          scenarioRenderMode: 'scenarioRenderMode' in localShadowGeneration
            ? localShadowGeneration.scenarioRenderMode
            : 'controlled_catalog',
          provisionalScenarioContractDigest: 'provisionalScenarioContractDigest' in localShadowGeneration
            ? localShadowGeneration.provisionalScenarioContractDigest
            : null,
          providerCallCount: 0,
          estimatedCostUsd: 0,
          publicationSuppressed: true,
          reasonCodes: scenarioConsistent
            ? localShadowGeneration.reasonCodes
            : [...localShadowGeneration.reasonCodes, 'local_shadow_scenario_contract_inconsistent'],
          scenarioEvidence,
          scenarioBlueprintShadowEvidence
        }
      };
      if ((localShadowGeneration.status === 'generated_and_self_verified'
        || localShadowGeneration.status === 'generated_and_triple_verified')
        && localShadowGeneration.candidate
        && scenarioConsistent) {
        return {
          candidate: localShadowGeneration.candidate,
          rawOutput: localShadowGeneration.candidate,
          normalizedOutput: localShadowGeneration.candidate,
          promptMetadata,
          agent: generatorAgent('local-deterministic', localShadowGeneration.generatorVersion),
          provider: 'local-deterministic',
          model: localShadowGeneration.generatorVersion,
          status: 'success',
          gatewayAttempts: []
        };
      }
      return {
        candidate: fallback,
        rawOutput: null,
        normalizedOutput: fallback,
        promptMetadata,
        agent: generatorAgent('local-deterministic', localShadowGeneration.generatorVersion),
        provider: 'local-deterministic',
        model: localShadowGeneration.generatorVersion,
        status: 'local_generator_verification_failed',
        error: (scenarioConsistent
          ? localShadowGeneration.reasonCodes
          : [...localShadowGeneration.reasonCodes, 'local_shadow_scenario_contract_inconsistent']
        ).join(',') || 'Local shadow generator failed closed.',
        gatewayAttempts: []
      };
    }
    if (!externalReady(this.gateway.hasConfiguredKey('question_generation', selectedModel))) {
      return {
        candidate: fallback,
        rawOutput: fallback,
        normalizedOutput: fallback,
        promptMetadata: prompt.metadata,
        agent: generatorAgent('rule-fallback', RULE_MODEL),
        provider: 'rule-fallback',
        model: RULE_MODEL,
        status: 'generator_disabled'
      };
    }

    const planTemplate = questionPlanTemplateFromBlueprint(blueprint);
    const promptCharacterBudget = questionPromptCharacterBudgetForPlanTemplate(planTemplate);
    const promptCharacterCount = providerPromptCharacterCount(prompt.messages);
    if (promptCharacterBudget != null && promptCharacterCount > promptCharacterBudget) {
      return {
        candidate: fallback,
        rawOutput: null,
        normalizedOutput: fallback,
        promptMetadata: prompt.metadata,
        agent: generatorAgent('prompt-budget-gate', selectedModel),
        provider: 'prompt-budget-gate',
        model: selectedModel,
        status: 'generator_prompt_budget_exceeded',
        error: `generator_prompt_budget_exceeded: planTemplate=${planTemplate}; actualCharacters=${promptCharacterCount}; budgetCharacters=${promptCharacterBudget}`
      };
    }

    const response = await this.gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'question_generator',
      messages: prompt.messages as AiGatewayMessage[],
      modelHint: selectedModel || undefined,
      responseFormat: 'json',
      temperature: reasoningPolicy.temperature,
      thinking: reasoningPolicy.thinking,
      reasoningEffort: reasoningPolicy.reasoningEffort,
      maxTokens: selectedMaxTokens,
      maxProviderAttempts: options.maxProviderAttempts,
      timeoutMs: timeoutMs(selectedModel),
      metadata: {
        blueprintId: blueprint.id,
        subject: blueprint.subject,
        topicId: blueprint.topicId,
        questionType: blueprint.questionType,
        generationTier: generationTier || 'standard',
        reasoningPolicyVersion: reasoningPolicy.policyVersion,
        thinkingMode: reasoningPolicy.thinking ?? 'provider_default',
        reasoningEffort: reasoningPolicy.reasoningEffort ?? 'provider_default',
        reasoningPolicyReason: reasoningPolicy.reason,
        promptCharacterCount,
        promptCharacterBudget,
        outputTokenCeiling: selectedMaxTokens,
        ...(options.gatewayMetadata ?? {})
      }
    });
    if (response.status !== 'success') {
      return {
        candidate: fallback,
        rawOutput: null,
        normalizedOutput: fallback,
        promptMetadata: prompt.metadata,
        agent: generatorAgent(response.providerId, response.model),
        provider: response.providerId,
        model: response.model,
        status: response.errorCode ?? response.status,
        error: response.errorMessage ?? 'Generator provider failed.',
        gatewayAttempts: compactGatewayAttempts(response.attempts)
      };
    }
    const output = response.content.trim();
    const parsed = parseGeneratedJson(output);
    const candidateRecord = parsed ? unwrapGeneratedQuestionRecord(parsed) : null;
    const normalized = candidateRecord ? this.normalizeFromRecord(blueprint, candidateRecord) : null;
    if (!normalized) {
      return {
        candidate: fallback,
        rawOutput: parsed ?? output,
        normalizedOutput: fallback,
        promptMetadata: prompt.metadata,
        agent: generatorAgent(response.providerId, response.model),
        provider: response.providerId,
        model: response.model,
        status: 'provider_schema_invalid',
        error: 'Generator provider returned invalid question JSON.',
        gatewayAttempts: compactGatewayAttempts(response.attempts)
      };
    }
    return {
      candidate: normalized,
      rawOutput: parsed,
      normalizedOutput: normalized,
      promptMetadata: prompt.metadata,
      agent: generatorAgent(response.providerId, response.model),
      provider: response.providerId,
      model: response.model,
      status: 'success'
    };
  }
}
