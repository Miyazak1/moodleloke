import { Injectable } from '@nestjs/common';
import { QUESTION_ENGINE_TASK_PROTOCOL_VERSION } from './question-engine-task-protocol';
import { acceptedQuestionEngineWorkerVersions } from './question-engine-sidecar-transport.service';
import type { QuestionEngineCapability, QuestionEngineWorkerRuntimeHealth } from './question-engine-plugin.types';

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), min), max) : fallback;
}

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function healthUrl(env: NodeJS.ProcessEnv = process.env) {
  const explicit = String(env.QUESTION_ENGINE_WORKER_HEALTH_URL ?? '').trim();
  const sidecar = String(env.QUESTION_ENGINE_SIDECAR_URL ?? '').trim();
  const url = new URL(explicit || sidecar);
  if (!explicit) {
    url.pathname = '/health';
    url.search = '';
    url.hash = '';
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('worker_health_url_invalid');
  }
  return url.toString();
}

function configuredCapabilities(env: NodeJS.ProcessEnv = process.env) {
  const supported = new Set<QuestionEngineCapability>(['question.generate', 'question.review', 'question.topic-map']);
  return [...new Set(String(env.QUESTION_ENGINE_WORKER_CAPABILITIES ?? '').split(',')
    .map((value) => value.trim())
    .filter((value): value is QuestionEngineCapability => supported.has(value as QuestionEngineCapability)))];
}

@Injectable()
export class QuestionEngineWorkerHealthService {
  private cached: { expiresAt: number; value: QuestionEngineWorkerRuntimeHealth } | null = null;
  private pending: Promise<QuestionEngineWorkerRuntimeHealth> | null = null;

  async inspect(force = false): Promise<QuestionEngineWorkerRuntimeHealth> {
    if (process.env.QUESTION_ENGINE_EXECUTION_MODE !== 'sidecar'
      || !enabled(process.env.QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED)) {
      return { status: 'not_applicable', checkedAt: new Date().toISOString(), latencyMs: 0, blockers: [] };
    }
    const now = Date.now();
    if (!force && this.cached && this.cached.expiresAt > now) return this.cached.value;
    if (this.pending) return this.pending;
    this.pending = this.probe().finally(() => { this.pending = null; });
    const value = await this.pending;
    const cacheMs = boundedNumber(process.env.QUESTION_ENGINE_WORKER_HEALTH_CACHE_MS, 5000, 500, 60_000);
    this.cached = { value, expiresAt: Date.now() + cacheMs };
    return value;
  }

  private async probe(): Promise<QuestionEngineWorkerRuntimeHealth> {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    let url: string;
    try {
      url = healthUrl();
    } catch (error) {
      return {
        status: 'blocked', checkedAt, latencyMs: Date.now() - startedAt,
        blockers: [error instanceof Error ? error.message : 'worker_health_url_invalid']
      };
    }
    const timeoutMs = boundedNumber(process.env.QUESTION_ENGINE_WORKER_HEALTH_TIMEOUT_MS, 3000, 500, 15_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
      let body: Record<string, unknown> | null = null;
      try {
        const parsed = await response.json();
        body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
      } catch { body = null; }
      if (!response.ok || !body) {
        return { status: 'unreachable', checkedAt, latencyMs: Date.now() - startedAt, blockers: [`worker_health_http_${response.status}`] };
      }
      const worker = body.worker && typeof body.worker === 'object' && !Array.isArray(body.worker)
        ? body.worker as Record<string, unknown> : null;
      const capabilities = Array.isArray(body.capabilities) ? body.capabilities.map(String) : [];
      const acceptedVersions = acceptedQuestionEngineWorkerVersions();
      const requiredCapabilities = configuredCapabilities();
      const blockers = [
        !['ready', 'ready_no_capabilities'].includes(String(body.status ?? '')) ? `worker_status_${String(body.status ?? 'missing')}` : null,
        body.protocol !== QUESTION_ENGINE_TASK_PROTOCOL_VERSION ? 'worker_protocol_mismatch' : null,
        !worker || !String(worker.id ?? '').trim() ? 'worker_identity_missing' : null,
        !worker || !acceptedVersions.includes(String(worker.version ?? '')) ? 'worker_version_not_accepted' : null,
        ...requiredCapabilities.filter((capability) => !capabilities.includes(capability)).map((capability) => `worker_capability_missing:${capability}`)
      ].filter((value): value is string => Boolean(value));
      return {
        status: blockers.length ? 'blocked' : 'healthy', checkedAt, latencyMs: Date.now() - startedAt,
        protocol: String(body.protocol ?? ''),
        worker: worker ? { id: String(worker.id ?? ''), version: String(worker.version ?? '') } : undefined,
        capabilities: capabilities.filter((value): value is QuestionEngineCapability => (
          ['question.generate', 'question.review', 'question.topic-map'] as string[]
        ).includes(value)),
        blockers
      };
    } catch (error) {
      return {
        status: 'unreachable', checkedAt, latencyMs: Date.now() - startedAt,
        blockers: [error instanceof Error && error.name === 'AbortError'
          ? 'worker_health_timeout'
          : 'worker_health_unavailable']
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
