import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiProviderKey, AiRuntimeProviderConfig, AiTaskPolicy, AiTaskType } from './ai-gateway.types';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';
type PlatformKeyPool = 'background' | 'personal' | 'legacy';

const TASK_POLICIES: Record<AiTaskType, Omit<AiTaskPolicy, 'taskType'>> = {
  ai_coach_hint: { priority: 100, runtimeClass: 'realtime', defaultTimeoutMs: 15000, maxRetries: 1, responseFormat: 'text' },
  ai_coach_explanation: { priority: 95, runtimeClass: 'realtime', defaultTimeoutMs: 15000, maxRetries: 1, responseFormat: 'text' },
  wrong_question_explanation: { priority: 90, runtimeClass: 'realtime', defaultTimeoutMs: 15000, maxRetries: 1, responseFormat: 'json' },
  question_review: { priority: 60, runtimeClass: 'background', defaultTimeoutMs: 30000, maxRetries: 2, responseFormat: 'json' },
  question_repair: { priority: 55, runtimeClass: 'background', defaultTimeoutMs: 60000, maxRetries: 2, responseFormat: 'json' },
  question_generation: { priority: 50, runtimeClass: 'background', defaultTimeoutMs: 90000, maxRetries: 2, responseFormat: 'json' },
  topic_mapping: { priority: 45, runtimeClass: 'background', defaultTimeoutMs: 30000, maxRetries: 1, responseFormat: 'json' },
  translation: { priority: 40, runtimeClass: 'background', defaultTimeoutMs: 30000, maxRetries: 2, responseFormat: 'either' },
  admin_assistant: { priority: 45, runtimeClass: 'background', defaultTimeoutMs: 30000, maxRetries: 1, responseFormat: 'text' },
  batch_backfill: { priority: 20, runtimeClass: 'background', defaultTimeoutMs: 90000, maxRetries: 3, responseFormat: 'json' }
};

function enabled(value: string | undefined, fallback = true) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\/+$/, '');
}

function splitKeys(value: string | undefined) {
  return (value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function keyId(providerId: string, source: string, apiKey: string, index: number) {
  const digest = createHash('sha256').update(`${providerId}:${source}:${apiKey}`).digest('hex').slice(0, 12);
  return `${providerId}-${source}-${index + 1}-${digest}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function poolForTask(taskType: AiTaskType): PlatformKeyPool {
  if (taskType === 'ai_coach_hint' || taskType === 'ai_coach_explanation' || taskType === 'wrong_question_explanation') {
    return 'personal';
  }
  return 'background';
}

function poolModel(pool: PlatformKeyPool) {
  if (pool === 'background') return process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_DEEPSEEK_MODEL;
  if (pool === 'personal') return process.env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_DEEPSEEK_MODEL;
  return process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_DEEPSEEK_MODEL;
}

function poolBaseUrl(pool: PlatformKeyPool) {
  if (pool === 'background') return process.env.DEEPSEEK_BACKGROUND_BASE_URL || process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  if (pool === 'personal') return process.env.DEEPSEEK_PERSONAL_BASE_URL || process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  return process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
}

@Injectable()
export class AiGatewayConfigService {
  isEnabled() {
    return enabled(process.env.AI_GATEWAY_ENABLED, true);
  }

  ledgerEnabled() {
    return enabled(process.env.AI_GATEWAY_LEDGER_ENABLED, true);
  }

  globalConcurrency() {
    return readPositiveInt('AI_GATEWAY_GLOBAL_CONCURRENCY', 5);
  }

  realtimeConcurrency() {
    return readPositiveInt('AI_GATEWAY_REALTIME_CONCURRENCY', readPositiveInt('AI_GATEWAY_STUDENT_REALTIME_CONCURRENCY', 3));
  }

  backgroundConcurrency() {
    return readPositiveInt('AI_GATEWAY_BACKGROUND_CONCURRENCY', 2);
  }

  concurrencyQueueTimeoutMs() {
    return readPositiveInt('AI_GATEWAY_QUEUE_TIMEOUT_MS', 5000);
  }

  realtimeQueueTimeoutMs() {
    return readPositiveInt('AI_GATEWAY_REALTIME_QUEUE_TIMEOUT_MS', this.concurrencyQueueTimeoutMs());
  }

  backgroundQueueTimeoutMs() {
    return readPositiveInt('AI_GATEWAY_BACKGROUND_QUEUE_TIMEOUT_MS', 120000);
  }

  realtimeKeyWaitTimeoutMs() {
    return readPositiveInt('AI_GATEWAY_REALTIME_KEY_WAIT_TIMEOUT_MS', Math.min(2000, this.realtimeQueueTimeoutMs()));
  }

  backgroundKeyWaitTimeoutMs() {
    return readPositiveInt('AI_GATEWAY_BACKGROUND_KEY_WAIT_TIMEOUT_MS', this.backgroundQueueTimeoutMs());
  }

  deepSeekKeyConcurrency() {
    return readPositiveInt('DEEPSEEK_KEY_CONCURRENCY', 2);
  }

  deepSeekKeyConcurrencyForPool(pool: PlatformKeyPool) {
    if (pool === 'background') return readPositiveInt('DEEPSEEK_BACKGROUND_KEY_CONCURRENCY', this.deepSeekKeyConcurrency());
    if (pool === 'personal') return readPositiveInt('DEEPSEEK_PERSONAL_KEY_CONCURRENCY', this.deepSeekKeyConcurrency());
    return this.deepSeekKeyConcurrency();
  }

  deepSeekRequestsPerMinute() {
    return readPositiveInt('DEEPSEEK_REQUESTS_PER_MINUTE', 60);
  }

  deepSeekRequestsPerMinuteForPool(pool: PlatformKeyPool) {
    if (pool === 'background') return readPositiveInt('DEEPSEEK_BACKGROUND_REQUESTS_PER_MINUTE', this.deepSeekRequestsPerMinute());
    if (pool === 'personal') return readPositiveInt('DEEPSEEK_PERSONAL_REQUESTS_PER_MINUTE', this.deepSeekRequestsPerMinute());
    return this.deepSeekRequestsPerMinute();
  }

  deepSeekRequestsPerDay() {
    return readPositiveInt('DEEPSEEK_REQUESTS_PER_DAY', 5000);
  }

  deepSeekRequestsPerDayForPool(pool: PlatformKeyPool) {
    if (pool === 'background') return readPositiveInt('DEEPSEEK_BACKGROUND_REQUESTS_PER_DAY', this.deepSeekRequestsPerDay());
    if (pool === 'personal') return readPositiveInt('DEEPSEEK_PERSONAL_REQUESTS_PER_DAY', this.deepSeekRequestsPerDay());
    return this.deepSeekRequestsPerDay();
  }

  getTaskPolicy(taskType: AiTaskType): AiTaskPolicy {
    const policy = TASK_POLICIES[taskType];
    const studentTimeout = readPositiveInt('AI_GATEWAY_STUDENT_TIMEOUT_MS', policy.defaultTimeoutMs);
    const backgroundTimeout = readPositiveInt('AI_GATEWAY_BACKGROUND_TIMEOUT_MS', policy.defaultTimeoutMs);
    const defaultTimeout = readPositiveInt('AI_GATEWAY_DEFAULT_TIMEOUT_MS', policy.defaultTimeoutMs);
    const runtimeTimeout = policy.runtimeClass === 'realtime' ? studentTimeout : backgroundTimeout;
    return {
      taskType,
      ...policy,
      defaultTimeoutMs: runtimeTimeout || defaultTimeout
    };
  }

  modelForTask(taskType: AiTaskType, modelHint?: string) {
    if (modelHint) return modelHint;
    const pool = poolForTask(taskType);
    if (taskType === 'question_generation') return process.env.CSCA_AI_QUESTION_GENERATION_MODEL || poolModel(pool);
    if (taskType === 'question_review') return process.env.CSCA_AI_QUESTION_REVIEW_MODEL || poolModel(pool);
    if (taskType === 'topic_mapping') return process.env.CSCA_AI_TOPIC_MAPPING_MODEL || process.env.CSCA_AI_QUESTION_REVIEW_MODEL || poolModel(pool);
    return process.env.CSCA_AI_MODEL || poolModel(pool);
  }

  baseUrlForTask(taskType: AiTaskType) {
    const pool = poolForTask(taskType);
    if (taskType === 'question_generation') return normalizeBaseUrl(process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL || poolBaseUrl(pool), DEFAULT_DEEPSEEK_BASE_URL);
    if (taskType === 'question_review') return normalizeBaseUrl(process.env.CSCA_AI_QUESTION_REVIEW_BASE_URL || poolBaseUrl(pool), DEFAULT_DEEPSEEK_BASE_URL);
    if (taskType === 'topic_mapping') {
      return normalizeBaseUrl(process.env.CSCA_AI_TOPIC_MAPPING_BASE_URL || process.env.CSCA_AI_QUESTION_REVIEW_BASE_URL || poolBaseUrl(pool), DEFAULT_DEEPSEEK_BASE_URL);
    }
    if (pool === 'background' && process.env.DEEPSEEK_BACKGROUND_BASE_URL) return normalizeBaseUrl(process.env.DEEPSEEK_BACKGROUND_BASE_URL, DEFAULT_DEEPSEEK_BASE_URL);
    if (pool === 'personal' && process.env.DEEPSEEK_PERSONAL_BASE_URL) return normalizeBaseUrl(process.env.DEEPSEEK_PERSONAL_BASE_URL, DEFAULT_DEEPSEEK_BASE_URL);
    if (process.env.DEEPSEEK_BASE_URL) return normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL, DEFAULT_DEEPSEEK_BASE_URL);
    return normalizeBaseUrl(process.env.CSCA_AI_BASE_URL, DEFAULT_DEEPSEEK_BASE_URL);
  }

  platformKeysForTask(taskType: AiTaskType, modelHint?: string): AiProviderKey[] {
    const pool = poolForTask(taskType);
    const dedicated = pool === 'background'
      ? splitKeys(process.env.DEEPSEEK_BACKGROUND_API_KEYS)
      : splitKeys(process.env.DEEPSEEK_PERSONAL_API_KEYS);
    const legacyGlobal = splitKeys(process.env.DEEPSEEK_API_KEYS);
    const legacy =
      taskType === 'question_generation'
        ? [process.env.CSCA_AI_QUESTION_GENERATION_API_KEY, process.env.CSCA_AI_API_KEY]
        : taskType === 'question_review'
          ? [process.env.CSCA_AI_QUESTION_REVIEW_API_KEY, process.env.CSCA_AI_API_KEY]
          : taskType === 'topic_mapping'
            ? [process.env.CSCA_AI_TOPIC_MAPPING_API_KEY, process.env.CSCA_AI_QUESTION_REVIEW_API_KEY, process.env.CSCA_AI_API_KEY]
            : [process.env.CSCA_AI_API_KEY];
    const selectedPool: PlatformKeyPool = dedicated.length ? pool : legacyGlobal.length ? 'legacy' : pool;
    const keys = dedicated.length ? dedicated : legacyGlobal.length ? legacyGlobal : unique(legacy.filter((item): item is string => Boolean(item)));
    const baseUrl = this.baseUrlForTask(taskType);
    const model = this.modelForTask(taskType, modelHint);
    return keys.map((apiKey, index) => ({
      keyId: keyId('deepseek', `env-${selectedPool}`, apiKey, index),
      providerId: 'deepseek',
      source: 'env',
      pool: selectedPool,
      apiKey,
      baseUrl,
      model,
      enabled: true,
      maxConcurrency: this.deepSeekKeyConcurrencyForPool(selectedPool),
      requestsPerMinute: this.deepSeekRequestsPerMinuteForPool(selectedPool),
      requestsPerDay: this.deepSeekRequestsPerDayForPool(selectedPool)
    }));
  }

  keyFromOverride(config: AiRuntimeProviderConfig): AiProviderKey {
    const providerId = this.normalizeProviderId(config.providerId || config.provider || 'deepseek');
    return {
      keyId: keyId(providerId, config.source, config.apiKey, config.providerConfigId ?? 0),
      providerId,
      source: config.source === 'organization' ? 'organization' : 'database',
      pool: config.source === 'organization' ? 'organization' : 'legacy',
      apiKey: config.apiKey,
      baseUrl: normalizeBaseUrl(config.baseUrl, DEFAULT_DEEPSEEK_BASE_URL),
      model: config.model,
      organizationId: config.organizationId,
      enabled: true,
      maxConcurrency: this.deepSeekKeyConcurrency(),
      requestsPerMinute: this.deepSeekRequestsPerMinute(),
      requestsPerDay: this.deepSeekRequestsPerDay()
    };
  }

  normalizeProviderId(provider: string) {
    const normalized = provider.trim().toLowerCase();
    if (!normalized || normalized === 'openai-compatible' || normalized === 'openai') return 'deepseek';
    return normalized;
  }
}
