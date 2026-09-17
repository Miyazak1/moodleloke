export type AiTaskType =
  | 'ai_coach_hint'
  | 'ai_coach_explanation'
  | 'wrong_question_explanation'
  | 'question_generation'
  | 'question_review'
  | 'question_repair'
  | 'topic_mapping'
  | 'translation'
  | 'admin_assistant'
  | 'batch_backfill';

export type AiTaskRuntimeClass = 'realtime' | 'background';

export type AiGatewayResponseFormat = 'text' | 'json';

export interface AiTaskPolicy {
  taskType: AiTaskType;
  priority: number;
  runtimeClass: AiTaskRuntimeClass;
  defaultTimeoutMs: number;
  maxRetries: number;
  responseFormat: AiGatewayResponseFormat | 'either';
}

export interface AiGatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRuntimeProviderConfig {
  source: 'platform' | 'organization' | 'override';
  providerId?: string;
  provider?: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  organizationId?: number;
  providerConfigId?: number;
}

export interface AiGatewayRequest {
  taskType: AiTaskType;
  sourceModule: string;
  messages: AiGatewayMessage[];
  modelHint?: string;
  providerHint?: string;
  responseFormat?: AiGatewayResponseFormat;
  temperature?: number;
  thinking?: 'enabled' | 'disabled';
  reasoningEffort?: 'low' | 'high' | 'max';
  maxTokens?: number;
  maxProviderAttempts?: number;
  timeoutMs?: number;
  userId?: number;
  organizationId?: number;
  requestId?: string;
  idempotencyKey?: string;
  providerConfigOverride?: AiRuntimeProviderConfig;
  bypassProviderHardStopLedger?: boolean;
  metadata?: Record<string, unknown>;
}

export type AiGatewayStatus =
  | 'success'
  | 'failed'
  | 'fallback'
  | 'cancelled'
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable';

export type AiGatewayErrorCode =
  | 'provider_auth_error'
  | 'provider_rate_limited'
  | 'provider_timeout'
  | 'provider_network_error'
  | 'provider_unavailable'
  | 'provider_bad_request'
  | 'provider_schema_invalid'
  | 'provider_empty_output'
  | 'provider_output_rejected'
  | 'provider_quota_exceeded'
  | 'gateway_no_provider'
  | 'gateway_no_key_available'
  | 'gateway_key_concurrency_saturated'
  | 'gateway_key_rate_limited'
  | 'gateway_key_cooldown'
  | 'gateway_key_disabled'
  | 'gateway_concurrency_timeout'
  | 'gateway_cancelled'
  | 'gateway_unknown_error';

export interface AiGatewayUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiGatewayAttempt {
  providerId: string;
  model: string;
  keyId: string;
  status: 'success' | 'failed';
  errorCode?: AiGatewayErrorCode;
  latencyMs: number;
  usage?: AiGatewayUsage;
}

export interface AiGatewayResponse {
  requestId: string;
  taskType: AiTaskType;
  providerId: string;
  model: string;
  keyId: string;
  status: AiGatewayStatus;
  content: string;
  json?: unknown;
  usage?: AiGatewayUsage;
  latencyMs: number;
  attempts: AiGatewayAttempt[];
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
  raw?: unknown;
}

export interface AiProviderRequest {
  requestId: string;
  taskType: AiTaskType;
  messages: AiGatewayMessage[];
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  thinking?: 'enabled' | 'disabled';
  reasoningEffort?: 'low' | 'high' | 'max';
  maxTokens?: number;
  responseFormat?: AiGatewayResponseFormat;
  timeoutMs: number;
}

export interface AiProviderResponse {
  status: 'success' | 'failed';
  content: string;
  raw?: unknown;
  usage?: AiGatewayUsage;
  providerStatusCode?: number;
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
}

export interface AiProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unavailable';
}

export interface AiProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly protocol: 'openai-compatible' | 'native';

  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
  healthCheck(): Promise<AiProviderHealth>;
}

export interface AiProviderKey {
  keyId: string;
  providerId: string;
  source: 'env' | 'database' | 'organization';
  pool: 'background' | 'personal' | 'legacy' | 'organization';
  apiKey: string;
  baseUrl: string;
  model?: string;
  organizationId?: number;
  enabled: boolean;
  maxConcurrency: number;
  requestsPerMinute?: number;
  requestsPerDay?: number;
}

export interface AiProviderKeyRuntimeState {
  keyId: string;
  providerId: string;
  pool: AiProviderKey['pool'];
  enabled: boolean;
  currentConcurrency: number;
  requestsInCurrentMinute: number;
  requestsInCurrentDay: number;
  failuresInWindow: number;
  timeoutCountInWindow: number;
  rateLimitCountInWindow: number;
  averageLatencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  cooldownUntil?: Date;
  cooldownReason?: AiGatewayErrorCode;
}

export type AiGatewayAttemptResult = {
  status: 'success' | 'failed';
  latencyMs: number;
  errorCode?: AiGatewayErrorCode;
};

export interface AiKeyReservation {
  key: AiProviderKey;
  release(result: AiGatewayAttemptResult): Promise<void> | void;
}

export type AiKeyReservationMissReason =
  | 'no_keys_configured'
  | 'all_keys_disabled'
  | 'all_keys_cooling_down'
  | 'all_keys_at_concurrency'
  | 'all_keys_rate_limited_minute'
  | 'all_keys_rate_limited_day';

export interface AiKeyReservationMiss {
  reason: AiKeyReservationMissReason;
  retryable: boolean;
  retryAfterMs?: number;
  configuredKeys: number;
  enabledKeys: number;
}

export type AiKeyReservationResult =
  | { reservation: AiKeyReservation; miss?: never }
  | { reservation?: never; miss: AiKeyReservationMiss };

export interface AiConcurrencyReservation {
  runtimeClass: AiTaskRuntimeClass;
  release(): void;
}

export interface AiGatewayLedgerEntry {
  requestId: string;
  taskType: AiTaskType;
  sourceModule: string;
  providerId: string;
  model: string;
  keyId: string;
  userId?: number;
  organizationId?: number;
  status: AiGatewayStatus;
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AiGatewayProviderHardStopState {
  active: boolean;
  providerId: string;
  latestHardStopAt?: Date;
  latestRecoverySuccessAt?: Date;
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
  sourceModule?: string;
  taskType?: AiTaskType | string;
  subject?: string;
  topicId?: string;
  blueprintId?: string;
}

export interface AiGatewayHealthSnapshot {
  status: 'healthy' | 'degraded' | 'unavailable';
  providers: AiProviderHealthSnapshot[];
  queues: {
    realtimeRunning: number;
    realtimeQueued: number;
    backgroundRunning: number;
    backgroundQueued: number;
  };
}

export interface AiProviderHealthSnapshot {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  keys: Array<{
    keyId: string;
    pool: AiProviderKey['pool'];
    enabled: boolean;
    currentConcurrency: number;
    cooldownUntil?: string;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    averageLatencyMs: number;
  }>;
}
