import { Injectable } from '@nestjs/common';
import type { QuestionEnginePluginAdapter } from './question-engine-plugin.contract';
import {
  QUESTION_ENGINE_PLUGIN_API_VERSION,
  type QuestionEngineCapability,
  type QuestionEngineCapabilityRuntimeStatus,
  type QuestionEnginePluginDescriptor,
  type QuestionEnginePluginRuntimeStatus
} from './question-engine-plugin.types';

const PLUGIN_ID = 'moodlelike-ai-questioning';
const SUPPORTED_PROVIDERS = new Set(['deepseek', 'openai', 'openai-compatible']);

export const BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR: QuestionEnginePluginDescriptor = {
  id: PLUGIN_ID,
  displayName: 'Moodlelike AI Questioning',
  version: '1.0.0',
  apiVersion: QUESTION_ENGINE_PLUGIN_API_VERSION,
  capabilities: ['question.generate', 'question.review', 'question.topic-map'],
  executionBoundary: 'in-process-adapter',
  activationMode: 'configuration-restart'
};

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function firstValue(...values: Array<string | undefined>) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
}

function keyConfigured(...values: Array<string | undefined>) {
  const value = firstValue(...values);
  return Boolean(value) && !/^(replace|replaceme|change-me)/i.test(value);
}

function capabilityStatus(input: {
  capability: QuestionEngineCapability;
  selected: boolean;
  hostEnabled: boolean;
  featureEnabled: boolean;
  provider: string;
  model: string;
  keyConfigured: boolean;
  productionRunnerEnabled?: boolean;
}): QuestionEngineCapabilityRuntimeStatus {
  const providerConfigured = input.provider !== 'rule-fallback'
    && SUPPORTED_PROVIDERS.has(input.provider)
    && Boolean(input.model)
    && input.keyConfigured;
  const pluginEnabled = input.selected && input.hostEnabled;
  const runnerReady = input.productionRunnerEnabled ?? true;
  const executionEnabled = pluginEnabled && input.featureEnabled && providerConfigured && runnerReady;
  const blockers = [
    !input.selected ? 'plugin_not_selected' : null,
    !input.hostEnabled ? 'plugin_host_disabled' : null,
    input.provider === 'rule-fallback' ? 'external_provider_not_selected' : null,
    input.provider !== 'rule-fallback' && !SUPPORTED_PROVIDERS.has(input.provider) ? 'provider_unsupported' : null,
    !input.model ? 'model_missing' : null,
    !input.keyConfigured ? 'provider_key_missing' : null,
    !input.featureEnabled ? `${input.capability.replace(/[^a-z0-9]+/gi, '_')}_disabled` : null,
    input.productionRunnerEnabled === false ? 'production_runner_disabled' : null
  ].filter((value): value is string => Boolean(value));
  return {
    capability: input.capability,
    enabled: pluginEnabled && input.featureEnabled,
    provider: input.provider,
    model: input.model,
    providerConfigured,
    executionEnabled,
    status: !pluginEnabled || !input.featureEnabled ? 'disabled' : executionEnabled ? 'ready' : 'blocked',
    blockers
  };
}

@Injectable()
export class BuiltinAIQuestioningAdapter implements QuestionEnginePluginAdapter {
  describe(): QuestionEnginePluginDescriptor {
    return BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR;
  }

  runtimeStatus(input: { selectedPluginId: string; hostEnabled: boolean }): QuestionEnginePluginRuntimeStatus {
    const descriptor = this.describe();
    const selected = input.selectedPluginId === descriptor.id;
    const generationProvider = firstValue(
      process.env.AI_DEFAULT_PROVIDER,
      process.env.CSCA_AI_QUESTION_GENERATION_PROVIDER,
      process.env.CSCA_AI_PROVIDER,
      'rule-fallback'
    );
    const generationModel = firstValue(
      process.env.CSCA_AI_QUESTION_GENERATION_MODEL,
      process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL,
      process.env.DEEPSEEK_DEFAULT_MODEL,
      process.env.CSCA_AI_MODEL,
      'deepseek-v4-flash'
    );
    const reviewProvider = firstValue(
      process.env.AI_DEFAULT_PROVIDER,
      process.env.CSCA_AI_QUESTION_REVIEW_PROVIDER,
      process.env.CSCA_AI_PROVIDER,
      'rule-fallback'
    );
    const reviewModel = firstValue(
      process.env.CSCA_AI_QUESTION_REVIEW_MODEL,
      process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL,
      process.env.DEEPSEEK_DEFAULT_MODEL,
      process.env.CSCA_AI_MODEL,
      'deepseek-v4-flash'
    );
    const topicProvider = firstValue(
      process.env.AI_DEFAULT_PROVIDER,
      process.env.CSCA_AI_TOPIC_MAPPING_PROVIDER,
      process.env.CSCA_AI_QUESTION_REVIEW_PROVIDER,
      process.env.CSCA_AI_PROVIDER,
      'rule-fallback'
    );
    const topicModel = firstValue(
      process.env.CSCA_AI_TOPIC_MAPPING_MODEL,
      process.env.CSCA_AI_QUESTION_REVIEW_MODEL,
      process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL,
      process.env.DEEPSEEK_DEFAULT_MODEL,
      process.env.CSCA_AI_MODEL,
      'deepseek-v4-flash'
    );
    const generationKeyConfigured = keyConfigured(
      process.env.CSCA_AI_QUESTION_GENERATION_API_KEY,
      process.env.CSCA_AI_API_KEY,
      process.env.DEEPSEEK_BACKGROUND_API_KEYS,
      process.env.DEEPSEEK_API_KEYS
    );
    const reviewKeyConfigured = keyConfigured(
      process.env.CSCA_AI_QUESTION_REVIEW_API_KEY,
      process.env.CSCA_AI_API_KEY,
      process.env.DEEPSEEK_BACKGROUND_API_KEYS,
      process.env.DEEPSEEK_API_KEYS
    );
    const topicKeyConfigured = keyConfigured(
      process.env.CSCA_AI_TOPIC_MAPPING_API_KEY,
      process.env.CSCA_AI_QUESTION_REVIEW_API_KEY,
      process.env.CSCA_AI_API_KEY,
      process.env.DEEPSEEK_BACKGROUND_API_KEYS,
      process.env.DEEPSEEK_API_KEYS
    );
    const productionRunnerEnabled = enabled(process.env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED)
      || enabled(process.env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED);
    const pluginEnabled = input.hostEnabled && selected;
    const topicFeatureEnabled = process.env.CSCA_AI_TOPIC_MAPPING_ENABLED === undefined
      ? enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED) || enabled(process.env.CSCA_AI_QUESTION_GENERATION_ENABLED)
      : enabled(process.env.CSCA_AI_TOPIC_MAPPING_ENABLED);
    const capabilityStates = [
      capabilityStatus({
        capability: 'question.generate', selected, hostEnabled: input.hostEnabled,
        featureEnabled: enabled(process.env.CSCA_AI_QUESTION_GENERATION_ENABLED),
        provider: generationProvider, model: generationModel, keyConfigured: generationKeyConfigured,
        productionRunnerEnabled
      }),
      capabilityStatus({
        capability: 'question.review', selected, hostEnabled: input.hostEnabled,
        featureEnabled: enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED),
        provider: reviewProvider, model: reviewModel, keyConfigured: reviewKeyConfigured
      }),
      capabilityStatus({
        capability: 'question.topic-map', selected, hostEnabled: input.hostEnabled,
        featureEnabled: topicFeatureEnabled,
        provider: topicProvider, model: topicModel, keyConfigured: topicKeyConfigured
      })
    ];
    const generation = capabilityStates[0];
    const generationWritesEnabled = generation.executionEnabled;

    return {
      descriptor,
      selected,
      enabled: pluginEnabled,
      provider: generation.provider,
      model: generation.model,
      providerConfigured: generation.providerConfigured,
      productionRunnerEnabled,
      generationWritesEnabled,
      status: !pluginEnabled ? 'disabled' : generationWritesEnabled ? 'ready' : 'blocked',
      blockers: generation.blockers,
      capabilityStates
    };
  }
}
