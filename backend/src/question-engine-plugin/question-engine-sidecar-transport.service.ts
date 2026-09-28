import { Injectable } from '@nestjs/common';
import type { QuestionEngineCapability, QuestionEnginePluginDescriptor } from './question-engine-plugin.types';
import { QuestionEngineNonceStoreService } from './question-engine-nonce-store.service';
import {
  issueQuestionEngineTaskEnvelope,
  verifyQuestionEngineTaskResultEnvelope,
  type QuestionEngineTaskResultEnvelope
} from './question-engine-task-protocol';

type SidecarResponse = {
  envelope: QuestionEngineTaskResultEnvelope;
  result: unknown;
};

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), min), max) : fallback;
}

function endpoint() {
  const value = String(process.env.QUESTION_ENGINE_SIDECAR_URL ?? '').trim();
  if (!value) throw new Error('question_engine_sidecar_endpoint_not_configured');
  const url = new URL(value);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('question_engine_sidecar_endpoint_invalid');
  }
  return url.toString();
}

export function acceptedQuestionEngineWorkerVersions(env: NodeJS.ProcessEnv = process.env) {
  return [...new Set(String(env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9._+-]{1,64}$/i.test(value)))];
}

async function readBoundedText(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('question_engine_sidecar_response_too_large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('question_engine_sidecar_response_too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

@Injectable()
export class QuestionEngineSidecarTransportService {
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;
  private lastSuccessAt: string | null = null;
  private lastFailure: { at: string; code: string; affectsCircuit: boolean } | null = null;

  constructor(private readonly nonceStore: QuestionEngineNonceStoreService) {}

  getCircuitStatus(now = Date.now()) {
    const threshold = boundedNumber(process.env.QUESTION_ENGINE_SIDECAR_CIRCUIT_FAILURE_THRESHOLD, 3, 1, 20);
    const resetMs = boundedNumber(process.env.QUESTION_ENGINE_SIDECAR_CIRCUIT_RESET_MS, 30_000, 1_000, 300_000);
    const open = this.consecutiveFailures >= threshold && now - this.circuitOpenedAt < resetMs;
    return { open, consecutiveFailures: this.consecutiveFailures, threshold, resetMs };
  }

  getOperationalStatus() {
    return {
      circuit: this.getCircuitStatus(),
      lastSuccessAt: this.lastSuccessAt,
      lastFailure: this.lastFailure
    };
  }

  async execute<T>(input: {
    capability: QuestionEngineCapability;
    plugin: QuestionEnginePluginDescriptor;
    payload: unknown;
  }): Promise<T> {
    if (process.env.QUESTION_ENGINE_EXECUTION_MODE !== 'sidecar') {
      throw new Error('question_engine_sidecar_mode_not_enabled');
    }
    if (this.getCircuitStatus().open) throw new Error('question_engine_sidecar_circuit_open');

    const secret = String(process.env.QUESTION_ENGINE_TASK_HMAC_SECRET ?? '');
    const keyId = String(process.env.QUESTION_ENGINE_TASK_KEY_ID ?? '');
    const timeoutMs = boundedNumber(process.env.QUESTION_ENGINE_SIDECAR_TIMEOUT_MS, 15_000, 500, 120_000);
    const task = issueQuestionEngineTaskEnvelope({
      capability: input.capability,
      plugin: input.plugin,
      payload: input.payload,
      secret,
      keyId,
      ttlSeconds: Math.max(1, Math.min(300, Math.ceil(timeoutMs / 1000) + 15))
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(endpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'x-question-engine-protocol': task.schemaVersion,
          'idempotency-key': task.taskId
        },
        body: JSON.stringify({ envelope: task, payload: input.payload }),
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.recordFailure('question_engine_sidecar_timeout');
        throw new Error('question_engine_sidecar_timeout');
      }
      this.recordFailure('question_engine_sidecar_unavailable');
      throw new Error('question_engine_sidecar_unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.recordFailure(`question_engine_sidecar_http_${response.status}`);
      throw new Error(`question_engine_sidecar_http_${response.status}`);
    }
    let raw: string;
    try {
      raw = await readBoundedText(response, 2 * 1024 * 1024);
    } catch {
      this.recordFailure('question_engine_sidecar_response_too_large');
      throw new Error('question_engine_sidecar_response_too_large');
    }
    let body: SidecarResponse;
    try {
      body = JSON.parse(raw) as SidecarResponse;
    } catch {
      this.recordFailure('question_engine_sidecar_response_invalid');
      throw new Error('question_engine_sidecar_response_invalid');
    }
    const verified = verifyQuestionEngineTaskResultEnvelope({
      envelope: body.envelope,
      task,
      capability: input.capability,
      plugin: input.plugin,
      result: body.result,
      secret,
      keyId,
      acceptedWorkerVersions: acceptedQuestionEngineWorkerVersions()
    });
    if (!verified.valid) {
      this.recordFailure(`question_engine_sidecar_result_rejected:${verified.reason}`);
      throw new Error(`question_engine_sidecar_result_rejected:${verified.reason}`);
    }
    let claimed: boolean;
    try {
      claimed = await this.nonceStore.claim(verified.replayKey, 600_000);
    } catch {
      this.recordFailure('question_engine_sidecar_nonce_store_unavailable');
      throw new Error('question_engine_sidecar_nonce_store_unavailable');
    }
    if (!claimed) {
      this.recordFailure('question_engine_sidecar_result_replayed');
      throw new Error('question_engine_sidecar_result_replayed');
    }
    this.resetCircuit();
    if (body.envelope.status === 'failed') {
      this.recordTaskFailure(`question_engine_sidecar_task_failed:${body.envelope.errorCode}`);
      throw new Error(`question_engine_sidecar_task_failed:${body.envelope.errorCode}`);
    }
    this.lastSuccessAt = new Date().toISOString();
    return body.result as T;
  }

  private recordFailure(code: string) {
    this.consecutiveFailures += 1;
    this.circuitOpenedAt = Date.now();
    this.lastFailure = { at: new Date().toISOString(), code, affectsCircuit: true };
  }

  private recordTaskFailure(code: string) {
    this.lastFailure = { at: new Date().toISOString(), code, affectsCircuit: false };
  }

  private resetCircuit() {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
  }
}
