import { Injectable } from '@nestjs/common';
import {
  AiGatewayAttemptResult,
  AiGatewayErrorCode,
  AiKeyReservation,
  AiKeyReservationResult,
  AiProviderKey,
  AiProviderKeyRuntimeState
} from './ai-gateway.types';

type KeyRuntimeState = AiProviderKeyRuntimeState & { minuteBucket: number; dayBucket: number; roundRobin: number };

function nowMinute() {
  return Math.floor(Date.now() / 60000);
}

function nowDay() {
  return Math.floor(Date.now() / 86400000);
}

@Injectable()
export class AiGatewayKeyPoolService {
  private readonly states = new Map<string, KeyRuntimeState>();
  private sequence = 0;

  reserve(keys: AiProviderKey[]): AiKeyReservation | null {
    return this.reserveWithDiagnostics(keys).reservation ?? null;
  }

  reserveWithDiagnostics(keys: AiProviderKey[]): AiKeyReservationResult {
    const now = Date.now();
    const inspected = keys.map((key) => ({ key, state: this.stateFor(key) }));
    const enabled = inspected.filter(({ key, state }) => key.enabled && state.enabled);
    const cooled = enabled.filter(({ state }) => !state.cooldownUntil || state.cooldownUntil.getTime() <= now);
    const underConcurrency = cooled.filter(({ key, state }) => state.currentConcurrency < key.maxConcurrency);
    const underMinuteLimit = underConcurrency.filter(({ key, state }) => !key.requestsPerMinute || state.requestsInCurrentMinute < key.requestsPerMinute);
    const candidates = underMinuteLimit
      .filter(({ key, state }) => !key.requestsPerDay || state.requestsInCurrentDay < key.requestsPerDay)
      .sort((left, right) => {
        const leftScore = left.state.failuresInWindow * 1000 + left.state.averageLatencyMs + left.state.roundRobin;
        const rightScore = right.state.failuresInWindow * 1000 + right.state.averageLatencyMs + right.state.roundRobin;
        return leftScore - rightScore;
      });
    const selected = candidates[0];
    if (!selected) {
      return { miss: this.missFor({ inspected, enabled, cooled, underConcurrency, underMinuteLimit, now }) };
    }
    selected.state.currentConcurrency += 1;
    selected.state.requestsInCurrentMinute += 1;
    selected.state.requestsInCurrentDay += 1;
    selected.state.roundRobin = this.sequence++;
    let released = false;
    const reservation: AiKeyReservation = {
      key: selected.key,
      release: (result: AiGatewayAttemptResult) => {
        if (released) return;
        released = true;
        this.release(selected.key, result);
      }
    };
    return { reservation };
  }

  snapshot(providerId = 'deepseek') {
    return Array.from(this.states.values())
      .filter((state) => state.providerId === providerId)
      .map((state) => ({
        keyId: state.keyId,
        pool: state.pool,
        enabled: state.enabled,
        currentConcurrency: state.currentConcurrency,
        cooldownUntil: state.cooldownUntil?.toISOString(),
        lastSuccessAt: state.lastSuccessAt?.toISOString(),
        lastFailureAt: state.lastFailureAt?.toISOString(),
        averageLatencyMs: Math.round(state.averageLatencyMs)
      }));
  }

  private release(key: AiProviderKey, result: AiGatewayAttemptResult) {
    const state = this.stateFor(key);
    state.currentConcurrency = Math.max(0, state.currentConcurrency - 1);
    state.averageLatencyMs = state.averageLatencyMs
      ? Math.round((state.averageLatencyMs * 0.8) + (result.latencyMs * 0.2))
      : result.latencyMs;
    if (result.status === 'success') {
      state.lastSuccessAt = new Date();
      state.failuresInWindow = Math.max(0, state.failuresInWindow - 1);
      return;
    }
    state.failuresInWindow += 1;
    state.lastFailureAt = new Date();
    if (result.errorCode === 'provider_timeout') state.timeoutCountInWindow += 1;
    if (result.errorCode === 'provider_rate_limited') state.rateLimitCountInWindow += 1;
    this.applyCooldown(state, result.errorCode);
  }

  private missFor(input: {
    inspected: Array<{ key: AiProviderKey; state: KeyRuntimeState }>;
    enabled: Array<{ key: AiProviderKey; state: KeyRuntimeState }>;
    cooled: Array<{ key: AiProviderKey; state: KeyRuntimeState }>;
    underConcurrency: Array<{ key: AiProviderKey; state: KeyRuntimeState }>;
    underMinuteLimit: Array<{ key: AiProviderKey; state: KeyRuntimeState }>;
    now: number;
  }) {
    const configuredKeys = input.inspected.length;
    const enabledKeys = input.enabled.length;
    if (!configuredKeys) {
      return { reason: 'no_keys_configured' as const, retryable: false, configuredKeys, enabledKeys };
    }
    if (!enabledKeys) {
      return { reason: 'all_keys_disabled' as const, retryable: false, configuredKeys, enabledKeys };
    }
    if (!input.cooled.length) {
      const retryAfterMs = Math.max(
        100,
        Math.min(
          ...input.enabled
            .map(({ state }) => state.cooldownUntil?.getTime())
            .filter((value): value is number => Number.isFinite(value))
        ) - input.now
      );
      return { reason: 'all_keys_cooling_down' as const, retryable: true, retryAfterMs, configuredKeys, enabledKeys };
    }
    if (!input.underConcurrency.length) {
      return { reason: 'all_keys_at_concurrency' as const, retryable: true, retryAfterMs: 100, configuredKeys, enabledKeys };
    }
    if (!input.underMinuteLimit.length) {
      const nextMinuteMs = (nowMinute() + 1) * 60_000;
      return {
        reason: 'all_keys_rate_limited_minute' as const,
        retryable: true,
        retryAfterMs: Math.max(100, nextMinuteMs - input.now),
        configuredKeys,
        enabledKeys
      };
    }
    return { reason: 'all_keys_rate_limited_day' as const, retryable: false, configuredKeys, enabledKeys };
  }

  private applyCooldown(state: AiProviderKeyRuntimeState, errorCode?: AiGatewayErrorCode) {
    if (errorCode === 'provider_auth_error' || errorCode === 'provider_quota_exceeded') {
      state.enabled = false;
      state.cooldownReason = errorCode;
      return;
    }
    const seconds = errorCode === 'provider_rate_limited' ? 180 : errorCode === 'provider_timeout' || errorCode === 'provider_network_error' ? 60 : 0;
    if (seconds > 0 || state.failuresInWindow >= 3) {
      state.cooldownUntil = new Date(Date.now() + Math.max(seconds, 60) * 1000);
      state.cooldownReason = errorCode;
    }
  }

  private stateFor(key: AiProviderKey) {
    const existing = this.states.get(key.keyId);
    if (existing) {
      this.rollBuckets(existing);
      return existing;
    }
    const state: KeyRuntimeState = {
      keyId: key.keyId,
      providerId: key.providerId,
      pool: key.pool,
      enabled: key.enabled,
      currentConcurrency: 0,
      requestsInCurrentMinute: 0,
      requestsInCurrentDay: 0,
      failuresInWindow: 0,
      timeoutCountInWindow: 0,
      rateLimitCountInWindow: 0,
      averageLatencyMs: 0,
      lastSuccessAt: undefined,
      lastFailureAt: undefined,
      cooldownUntil: undefined,
      cooldownReason: undefined,
      minuteBucket: nowMinute(),
      dayBucket: nowDay(),
      roundRobin: this.sequence++
    };
    this.states.set(key.keyId, state);
    return state;
  }

  private rollBuckets(state: KeyRuntimeState) {
    if (state.minuteBucket !== nowMinute()) {
      state.minuteBucket = nowMinute();
      state.requestsInCurrentMinute = 0;
      state.failuresInWindow = Math.max(0, Math.floor(state.failuresInWindow / 2));
      state.timeoutCountInWindow = 0;
      state.rateLimitCountInWindow = 0;
    }
    if (state.dayBucket !== nowDay()) {
      state.dayBucket = nowDay();
      state.requestsInCurrentDay = 0;
    }
  }
}
