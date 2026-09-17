import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiGatewayConcurrencyService } from './ai-gateway-concurrency.service';
import { AiGatewayConfigService } from './ai-gateway-config.service';
import { AiGatewayCostService } from './ai-gateway-cost.service';
import { AiGatewayKeyPoolService } from './ai-gateway-key-pool.service';
import { AiGatewayLedgerService } from './ai-gateway-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiGatewayAttempt,
  AiGatewayErrorCode,
  AiGatewayHealthSnapshot,
  AiGatewayProviderHardStopState,
  AiGatewayRequest,
  AiGatewayResponse,
  AiGatewayStatus,
  AiKeyReservation,
  AiKeyReservationMiss,
  AiKeyReservationResult,
  AiProviderResponse
} from './ai-gateway.types';
import { DeepSeekProvider } from './providers/deepseek.provider';

const PROVIDER_HARD_STOP_LEDGER_TASK_TYPES = new Set<AiGatewayRequest['taskType']>([
  'question_generation',
  'question_review',
  'question_repair',
  'topic_mapping',
  'translation',
  'batch_backfill'
]);

const PROVIDER_HARD_STOP_LEDGER_WINDOW_MS = 24 * 60 * 60 * 1000;

function statusFromError(errorCode?: AiGatewayErrorCode): AiGatewayStatus {
  if (errorCode === 'provider_timeout' || errorCode === 'gateway_concurrency_timeout') return 'timeout';
  if (errorCode === 'provider_rate_limited' || errorCode === 'gateway_key_rate_limited') return 'rate_limited';
  if (
    errorCode === 'provider_unavailable'
    || errorCode === 'provider_quota_exceeded'
    || errorCode === 'gateway_no_key_available'
    || errorCode === 'gateway_key_concurrency_saturated'
    || errorCode === 'gateway_key_cooldown'
    || errorCode === 'gateway_key_disabled'
    || errorCode === 'gateway_no_provider'
  ) return 'provider_unavailable';
  return 'failed';
}

function isRetriable(errorCode?: AiGatewayErrorCode) {
  return errorCode === 'provider_timeout'
    || errorCode === 'provider_network_error'
    || errorCode === 'provider_unavailable'
    || errorCode === 'provider_rate_limited'
    || errorCode === 'provider_empty_output'
    || errorCode === 'provider_schema_invalid'
    || errorCode === 'gateway_no_key_available'
    || errorCode === 'gateway_key_concurrency_saturated'
    || errorCode === 'gateway_key_rate_limited'
    || errorCode === 'gateway_key_cooldown';
}

function tryParseJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function errorCodeForKeyMiss(miss: AiKeyReservationMiss): AiGatewayErrorCode {
  if (miss.reason === 'all_keys_at_concurrency') return 'gateway_key_concurrency_saturated';
  if (miss.reason === 'all_keys_rate_limited_minute' || miss.reason === 'all_keys_rate_limited_day') return 'gateway_key_rate_limited';
  if (miss.reason === 'all_keys_cooling_down') return 'gateway_key_cooldown';
  if (miss.reason === 'all_keys_disabled') return 'gateway_key_disabled';
  return 'gateway_no_key_available';
}

function messageForKeyMiss(miss: AiKeyReservationMiss) {
  return `No AI provider key is currently reservable: ${miss.reason}. configuredKeys=${miss.configuredKeys}, enabledKeys=${miss.enabledKeys}.`;
}

function messagesForProviderAttempt(request: AiGatewayRequest, attempts: AiGatewayAttempt[]): AiGatewayRequest['messages'] {
  if (request.responseFormat !== 'json') return request.messages;
  const previousEmptyFinal = attempts.some((attempt) => attempt.errorCode === 'provider_empty_output');
  const previousSchemaInvalid = attempts.some((attempt) => attempt.errorCode === 'provider_schema_invalid');
  if (!previousEmptyFinal && !previousSchemaInvalid) return request.messages;
  return [
    ...request.messages,
    {
      role: 'system',
      content: previousSchemaInvalid
        ? 'Retry delivery contract: the previous provider attempt returned truncated or invalid final JSON. For this retry, return a shorter complete valid JSON object directly in message.content, using exactly the requested root schema. Keep prompt, options, explanation, and localizations concise; do not return markdown, prose, or an envelope object.'
        : 'Retry delivery contract: the previous provider attempt returned empty final output. For this retry, return the complete valid JSON object directly in message.content. Do not return reasoning-only output, markdown, or prose.'
    }
  ];
}

function shouldUseProviderHardStopLedger(request: AiGatewayRequest, policy: { runtimeClass: string }) {
  return policy.runtimeClass === 'background'
    && !request.providerConfigOverride?.apiKey
    && !request.bypassProviderHardStopLedger
    && PROVIDER_HARD_STOP_LEDGER_TASK_TYPES.has(request.taskType);
}

function serializeProviderHardStopState(state: AiGatewayProviderHardStopState) {
  return {
    active: state.active,
    providerId: state.providerId,
    latestHardStopAt: state.latestHardStopAt?.toISOString(),
    latestRecoverySuccessAt: state.latestRecoverySuccessAt?.toISOString(),
    errorCode: state.errorCode,
    errorMessage: state.errorMessage,
    sourceModule: state.sourceModule,
    taskType: state.taskType,
    subject: state.subject,
    topicId: state.topicId,
    blueprintId: state.blueprintId
  };
}

function messageForProviderHardStopLedger(state: AiGatewayProviderHardStopState) {
  const topic = state.subject || state.topicId || state.blueprintId
    ? ` subject=${state.subject ?? 'unknown'}, topicId=${state.topicId ?? 'unknown'}, blueprintId=${state.blueprintId ?? 'unknown'}`
    : '';
  const latest = state.latestHardStopAt ? ` at ${state.latestHardStopAt.toISOString()}` : '';
  return `AI provider background pool is in ledger hard-stop from ${state.errorCode ?? 'unknown_error'}${latest}.${topic}`;
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly config: AiGatewayConfigService,
    private readonly concurrency: AiGatewayConcurrencyService,
    private readonly keyPool: AiGatewayKeyPoolService,
    private readonly ledger: AiGatewayLedgerService,
    private readonly cost: AiGatewayCostService,
    private readonly deepSeekProvider: DeepSeekProvider
  ) {}

  async complete(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    const requestId = request.requestId || randomUUID();
    const startedAt = Date.now();
    const policy = this.config.getTaskPolicy(request.taskType);
    const timeoutMs = request.timeoutMs ?? policy.defaultTimeoutMs;
    const attempts: AiGatewayAttempt[] = [];
    let response: AiGatewayResponse | null = null;

    if (!this.config.isEnabled()) {
      response = this.failureResponse(request, requestId, startedAt, attempts, 'gateway_no_provider', 'AI Gateway is disabled.');
      await this.writeLedger(request, response);
      return response;
    }

    if (shouldUseProviderHardStopLedger(request, policy)) {
      const hardStop = await this.providerHardStopState();
      if (hardStop.active) {
        response = this.failureResponse(
          request,
          requestId,
          startedAt,
          attempts,
          'gateway_key_cooldown',
          messageForProviderHardStopLedger(hardStop)
        );
        await this.writeLedger({
          ...request,
          metadata: {
            ...request.metadata,
            providerHardStopLedger: serializeProviderHardStopState(hardStop)
          }
        }, response);
        return response;
      }
    }

    let concurrencyReservation: Awaited<ReturnType<AiGatewayConcurrencyService['reserve']>> | null = null;
    try {
      concurrencyReservation = await this.concurrency.reserve(policy);
    } catch {
      response = this.failureResponse(request, requestId, startedAt, attempts, 'gateway_concurrency_timeout', 'AI Gateway concurrency queue timed out.');
      await this.writeLedger(request, response);
      return response;
    }

    try {
      const configuredMaxAttempts = Math.max(1, policy.maxRetries + 1);
      const requestedMaxProviderAttempts = Number(request.maxProviderAttempts);
      const maxAttempts = Number.isInteger(requestedMaxProviderAttempts) && requestedMaxProviderAttempts > 0
        ? Math.min(configuredMaxAttempts, requestedMaxProviderAttempts)
        : configuredMaxAttempts;
      const keyWaitTimeoutMs = policy.runtimeClass === 'realtime'
        ? this.config.realtimeKeyWaitTimeoutMs()
        : this.config.backgroundKeyWaitTimeoutMs();
      const keyWaitDeadline = Date.now() + Math.max(0, keyWaitTimeoutMs);
      let index = 0;
      while (index < maxAttempts) {
        const reservationResult = this.reserveKeyWithDiagnostics(request);
        const reservation = reservationResult.reservation;
        if (!reservation) {
          const miss = reservationResult.miss;
          const errorCode = errorCodeForKeyMiss(miss);
          if (miss.retryable && Date.now() < keyWaitDeadline) {
            const remainingMs = keyWaitDeadline - Date.now();
            const waitMs = Math.max(25, Math.min(miss.retryAfterMs ?? 250, remainingMs, 5000));
            await sleep(waitMs);
            continue;
          }
          attempts.push({
            providerId: 'deepseek',
            model: this.config.modelForTask(request.taskType, request.modelHint),
            keyId: 'none',
            status: 'failed',
            errorCode,
            latencyMs: 0
          });
          if (index + 1 >= maxAttempts || !miss.retryable || !isRetriable(errorCode)) {
            response = this.failureResponse(request, requestId, startedAt, attempts, errorCode, messageForKeyMiss(miss));
            break;
          }
          index += 1;
          continue;
        }

        index += 1;
        const model = request.modelHint || reservation.key.model || this.config.modelForTask(request.taskType);
        const attemptStartedAt = Date.now();
        let providerResponse: AiProviderResponse;
        try {
          providerResponse = await this.deepSeekProvider.complete({
            requestId,
            taskType: request.taskType,
            messages: messagesForProviderAttempt(request, attempts),
            model,
            apiKey: reservation.key.apiKey,
            baseUrl: reservation.key.baseUrl,
            temperature: request.temperature,
            thinking: request.thinking,
            reasoningEffort: request.reasoningEffort,
            maxTokens: request.maxTokens,
            responseFormat: request.responseFormat,
            timeoutMs
          });
        } catch (error) {
          this.logger.warn(`AI provider threw unexpectedly: ${error instanceof Error ? error.message : String(error)}`);
          providerResponse = { status: 'failed', content: '', errorCode: 'gateway_unknown_error', errorMessage: 'AI provider failed unexpectedly.' };
        }
        const latencyMs = Date.now() - attemptStartedAt;
        const attempt: AiGatewayAttempt = {
          providerId: reservation.key.providerId,
          model,
          keyId: reservation.key.keyId,
          status: providerResponse.status,
          errorCode: providerResponse.errorCode,
          latencyMs,
          usage: providerResponse.usage
        };
        attempts.push(attempt);
        await reservation.release({ status: providerResponse.status, latencyMs, errorCode: providerResponse.errorCode });

        if (providerResponse.status === 'success') {
          response = {
            requestId,
            taskType: request.taskType,
            providerId: reservation.key.providerId,
            model,
            keyId: reservation.key.keyId,
            status: 'success',
            content: providerResponse.content,
            json: request.responseFormat === 'json' ? tryParseJson(providerResponse.content) : undefined,
            usage: providerResponse.usage,
            latencyMs: Date.now() - startedAt,
            attempts,
            raw: providerResponse.raw
          };
          break;
        }

        if (!isRetriable(providerResponse.errorCode) || index + 1 >= maxAttempts) {
          response = this.failureResponse(request, requestId, startedAt, attempts, providerResponse.errorCode ?? 'gateway_unknown_error', providerResponse.errorMessage);
          break;
        }
      }
    } finally {
      concurrencyReservation.release();
    }

    const finalResponse = response ?? this.failureResponse(request, requestId, startedAt, attempts, 'gateway_unknown_error', 'AI Gateway did not produce a response.');
    await this.writeLedger(request, finalResponse);
    return finalResponse;
  }

  async health(): Promise<AiGatewayHealthSnapshot> {
    const keys = this.keyPool.snapshot('deepseek');
    const providerStatus = keys.length && keys.every((key) => !key.enabled || key.cooldownUntil) ? 'degraded' : 'healthy';
    return {
      status: providerStatus,
      providers: [{ providerId: 'deepseek', status: providerStatus, keys }],
      queues: this.concurrency.snapshot()
    };
  }

  hasConfiguredKey(taskType: AiGatewayRequest['taskType'], modelHint?: string) {
    return this.config.platformKeysForTask(taskType, modelHint).length > 0;
  }

  private reserveKey(request: AiGatewayRequest): AiKeyReservation | null {
    return this.reserveKeyWithDiagnostics(request).reservation ?? null;
  }

  private reserveKeyWithDiagnostics(request: AiGatewayRequest): AiKeyReservationResult {
    if (request.providerConfigOverride?.apiKey) {
      return this.keyPool.reserveWithDiagnostics([this.config.keyFromOverride(request.providerConfigOverride)]);
    }
    return this.keyPool.reserveWithDiagnostics(this.config.platformKeysForTask(request.taskType, request.modelHint));
  }

  private async providerHardStopState() {
    return this.ledger.providerHardStopState({
      providerId: 'deepseek',
      windowMs: PROVIDER_HARD_STOP_LEDGER_WINDOW_MS,
      taskTypes: Array.from(PROVIDER_HARD_STOP_LEDGER_TASK_TYPES)
    });
  }

  private failureResponse(
    request: AiGatewayRequest,
    requestId: string,
    startedAt: number,
    attempts: AiGatewayAttempt[],
    errorCode: AiGatewayErrorCode,
    errorMessage?: string
  ): AiGatewayResponse {
    const lastAttempt = attempts[attempts.length - 1];
    return {
      requestId,
      taskType: request.taskType,
      providerId: lastAttempt?.providerId ?? 'deepseek',
      model: lastAttempt?.model ?? this.config.modelForTask(request.taskType, request.modelHint),
      keyId: lastAttempt?.keyId ?? 'none',
      status: statusFromError(errorCode),
      content: '',
      usage: lastAttempt?.usage,
      latencyMs: Date.now() - startedAt,
      attempts,
      errorCode,
      errorMessage
    };
  }

  private async writeLedger(request: AiGatewayRequest, response: AiGatewayResponse) {
    const attemptsWithUsage = response.attempts.filter((attempt) => attempt.usage);
    const providerTransportAttempts = response.attempts.filter((attempt) => attempt.keyId !== 'none');
    const billedUsage = attemptsWithUsage.length
      ? attemptsWithUsage.reduce((total, attempt) => ({
        promptTokens: total.promptTokens + Number(attempt.usage?.promptTokens ?? 0),
        completionTokens: total.completionTokens + Number(attempt.usage?.completionTokens ?? 0),
        totalTokens: total.totalTokens + Number(attempt.usage?.totalTokens ?? 0)
      }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
      : response.usage;
    const costEstimate = this.cost.estimate({
      model: response.model,
      promptTokens: billedUsage?.promptTokens,
      completionTokens: billedUsage?.completionTokens
    });
    await this.ledger.record({
      requestId: response.requestId,
      taskType: request.taskType,
      sourceModule: request.sourceModule,
      providerId: response.providerId,
      model: response.model,
      keyId: response.keyId,
      userId: request.userId,
      organizationId: request.organizationId ?? request.providerConfigOverride?.organizationId,
      status: response.status,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
      latencyMs: response.latencyMs,
      promptTokens: billedUsage?.promptTokens,
      completionTokens: billedUsage?.completionTokens,
      totalTokens: billedUsage?.totalTokens,
      estimatedCost: costEstimate?.estimatedCostUsd,
      metadata: {
        ...request.metadata,
        gatewayProviderAttemptLimit: request.maxProviderAttempts ?? null,
        gatewayProviderAttemptCount: providerTransportAttempts.length,
        gatewayAttemptRecordCount: response.attempts.length,
        gatewayProviderAttempts: response.attempts.map((attempt) => ({
          providerId: attempt.providerId,
          model: attempt.model,
          keyId: attempt.keyId,
          status: attempt.status,
          errorCode: attempt.errorCode ?? null,
          latencyMs: attempt.latencyMs,
          usage: attempt.usage ?? null
        }))
      },
      createdAt: new Date()
    });
  }
}

export function createStandaloneAiGatewayService(options: { prisma?: PrismaService } = {}) {
  const config = new AiGatewayConfigService();
  const concurrency = new AiGatewayConcurrencyService(config);
  const keyPool = new AiGatewayKeyPoolService();
  const ledger = new AiGatewayLedgerService(options.prisma, config);
  const cost = new AiGatewayCostService();
  const deepSeekProvider = new DeepSeekProvider();
  return new AiGatewayService(config, concurrency, keyPool, ledger, cost, deepSeekProvider);
}
