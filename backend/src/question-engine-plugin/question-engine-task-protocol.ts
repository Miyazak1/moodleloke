import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { QuestionEngineCapability, QuestionEnginePluginDescriptor } from './question-engine-plugin.types';

export const QUESTION_ENGINE_TASK_PROTOCOL_VERSION = 'question-engine-task-v1' as const;
export const QUESTION_ENGINE_TASK_MAX_TTL_SECONDS = 300;

export type QuestionEngineTaskEnvelope = {
  schemaVersion: typeof QUESTION_ENGINE_TASK_PROTOCOL_VERSION;
  taskId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  capability: QuestionEngineCapability;
  plugin: Pick<QuestionEnginePluginDescriptor, 'id' | 'version' | 'apiVersion'>;
  payloadSha256: string;
  replyAudience: 'moodlelike-question-engine-host';
  keyId: string;
  signatureHmacSha256: string;
};

export type QuestionEngineTaskResultEnvelope = {
  schemaVersion: typeof QUESTION_ENGINE_TASK_PROTOCOL_VERSION;
  taskId: string;
  requestNonce: string;
  completedAt: string;
  capability: QuestionEngineCapability;
  plugin: Pick<QuestionEnginePluginDescriptor, 'id' | 'version' | 'apiVersion'>;
  worker: { id: string; version: string };
  status: 'succeeded' | 'failed';
  resultSha256: string;
  errorCode?: string;
  audience: 'moodlelike-question-engine-host';
  keyId: string;
  signatureHmacSha256: string;
};

type UnsignedEnvelope = Omit<QuestionEngineTaskEnvelope, 'signatureHmacSha256'>;
type UnsignedResultEnvelope = Omit<QuestionEngineTaskResultEnvelope, 'signatureHmacSha256'>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, next]) => next !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, next]) => [key, stableValue(next)]));
  }
  return value;
}

function canonical(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function validSecret(secret: string) {
  const value = secret.trim();
  return value.length >= 32 && !/^(replace|replaceme|change-me)/i.test(value);
}

function digestPayload(payload: unknown) {
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

function signature(unsigned: UnsignedEnvelope, secret: string) {
  return createHmac('sha256', secret).update(canonical(unsigned)).digest('hex');
}

function resultSignature(unsigned: UnsignedResultEnvelope, secret: string) {
  return createHmac('sha256', secret).update(canonical(unsigned)).digest('hex');
}

function equalSignature(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueQuestionEngineTaskEnvelope(input: {
  capability: QuestionEngineCapability;
  plugin: QuestionEnginePluginDescriptor;
  payload: unknown;
  secret: string;
  keyId: string;
  now?: Date;
  ttlSeconds?: number;
}): QuestionEngineTaskEnvelope {
  if (!validSecret(input.secret)) throw new Error('question_engine_task_secret_invalid');
  const keyId = input.keyId.trim();
  if (!keyId || !/^[a-z0-9._-]{1,64}$/i.test(keyId)) throw new Error('question_engine_task_key_id_invalid');
  const ttlSeconds = Math.floor(input.ttlSeconds ?? 60);
  if (ttlSeconds < 1 || ttlSeconds > QUESTION_ENGINE_TASK_MAX_TTL_SECONDS) throw new Error('question_engine_task_ttl_invalid');
  const now = input.now ?? new Date();
  const unsigned: UnsignedEnvelope = {
    schemaVersion: QUESTION_ENGINE_TASK_PROTOCOL_VERSION,
    taskId: randomUUID(),
    nonce: randomBytes(24).toString('base64url'),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    capability: input.capability,
    plugin: { id: input.plugin.id, version: input.plugin.version, apiVersion: input.plugin.apiVersion },
    payloadSha256: digestPayload(input.payload),
    replyAudience: 'moodlelike-question-engine-host',
    keyId
  };
  return { ...unsigned, signatureHmacSha256: signature(unsigned, input.secret) };
}

export function verifyQuestionEngineTaskEnvelope(input: {
  envelope: QuestionEngineTaskEnvelope;
  capability: QuestionEngineCapability;
  plugin: QuestionEnginePluginDescriptor;
  payload: unknown;
  secret: string;
  keyId: string;
  now?: Date;
  claimedNonces?: Set<string>;
}): { valid: true; replayKey: string } | { valid: false; reason: string } {
  const envelope = input.envelope;
  if (!validSecret(input.secret)) return { valid: false, reason: 'task_secret_invalid' };
  if (!envelope || envelope.schemaVersion !== QUESTION_ENGINE_TASK_PROTOCOL_VERSION) return { valid: false, reason: 'schema_version_invalid' };
  if (envelope.capability !== input.capability) return { valid: false, reason: 'capability_mismatch' };
  if (envelope.plugin.id !== input.plugin.id || envelope.plugin.version !== input.plugin.version || envelope.plugin.apiVersion !== input.plugin.apiVersion) {
    return { valid: false, reason: 'plugin_identity_mismatch' };
  }
  if (envelope.keyId !== input.keyId.trim()) return { valid: false, reason: 'key_id_mismatch' };
  if (envelope.replyAudience !== 'moodlelike-question-engine-host') return { valid: false, reason: 'reply_audience_invalid' };
  if (!/^[0-9a-f-]{36}$/i.test(envelope.taskId) || !/^[A-Za-z0-9_-]{24,64}$/.test(envelope.nonce)) return { valid: false, reason: 'task_identity_invalid' };
  if (envelope.payloadSha256 !== digestPayload(input.payload)) return { valid: false, reason: 'payload_digest_mismatch' };
  const issuedAt = Date.parse(envelope.issuedAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt
    || expiresAt - issuedAt > QUESTION_ENGINE_TASK_MAX_TTL_SECONDS * 1000) return { valid: false, reason: 'task_time_window_invalid' };
  if (issuedAt > now + 30_000) return { valid: false, reason: 'task_issued_in_future' };
  if (expiresAt <= now) return { valid: false, reason: 'task_expired' };
  const { signatureHmacSha256, ...unsigned } = envelope;
  if (!equalSignature(signature(unsigned, input.secret), signatureHmacSha256)) return { valid: false, reason: 'signature_invalid' };
  const replayKey = `${envelope.keyId}:${envelope.nonce}`;
  if (input.claimedNonces?.has(replayKey)) return { valid: false, reason: 'task_replayed' };
  input.claimedNonces?.add(replayKey);
  return { valid: true, replayKey };
}

export function questionEngineTaskSigningConfigured(env: NodeJS.ProcessEnv = process.env) {
  return validSecret(String(env.QUESTION_ENGINE_TASK_HMAC_SECRET ?? ''))
    && /^[a-z0-9._-]{1,64}$/i.test(String(env.QUESTION_ENGINE_TASK_KEY_ID ?? '').trim());
}

export function issueQuestionEngineTaskResultEnvelope(input: {
  task: QuestionEngineTaskEnvelope;
  capability: QuestionEngineCapability;
  plugin: QuestionEnginePluginDescriptor;
  worker: { id: string; version: string };
  status: 'succeeded' | 'failed';
  result: unknown;
  errorCode?: string;
  secret: string;
  keyId: string;
  now?: Date;
}): QuestionEngineTaskResultEnvelope {
  if (!validSecret(input.secret)) throw new Error('question_engine_task_secret_invalid');
  const keyId = input.keyId.trim();
  if (!keyId || !/^[a-z0-9._-]{1,64}$/i.test(keyId)) throw new Error('question_engine_task_key_id_invalid');
  if (input.task.capability !== input.capability) throw new Error('question_engine_result_capability_mismatch');
  if (input.task.plugin.id !== input.plugin.id || input.task.plugin.version !== input.plugin.version
    || input.task.plugin.apiVersion !== input.plugin.apiVersion) throw new Error('question_engine_result_plugin_mismatch');
  const workerId = input.worker.id.trim();
  const workerVersion = input.worker.version.trim();
  if (!/^[a-z0-9._-]{1,64}$/i.test(workerId) || !/^[a-z0-9._+-]{1,64}$/i.test(workerVersion)) {
    throw new Error('question_engine_result_worker_identity_invalid');
  }
  const errorCode = input.errorCode?.trim();
  if (input.status === 'failed' && !errorCode) throw new Error('question_engine_result_error_code_missing');
  if (errorCode && !/^[a-z0-9._-]{1,96}$/i.test(errorCode)) throw new Error('question_engine_result_error_code_invalid');
  const unsigned: UnsignedResultEnvelope = {
    schemaVersion: QUESTION_ENGINE_TASK_PROTOCOL_VERSION,
    taskId: input.task.taskId,
    requestNonce: input.task.nonce,
    completedAt: (input.now ?? new Date()).toISOString(),
    capability: input.capability,
    plugin: { id: input.plugin.id, version: input.plugin.version, apiVersion: input.plugin.apiVersion },
    worker: { id: workerId, version: workerVersion },
    status: input.status,
    resultSha256: digestPayload(input.result),
    ...(errorCode ? { errorCode } : {}),
    audience: 'moodlelike-question-engine-host',
    keyId
  };
  return { ...unsigned, signatureHmacSha256: resultSignature(unsigned, input.secret) };
}

export function verifyQuestionEngineTaskResultEnvelope(input: {
  envelope: QuestionEngineTaskResultEnvelope;
  task: QuestionEngineTaskEnvelope;
  capability: QuestionEngineCapability;
  plugin: QuestionEnginePluginDescriptor;
  result: unknown;
  secret: string;
  keyId: string;
  acceptedWorkerVersions?: string[];
  now?: Date;
}): { valid: true; replayKey: string } | { valid: false; reason: string } {
  const envelope = input.envelope;
  if (!validSecret(input.secret)) return { valid: false, reason: 'task_secret_invalid' };
  if (!envelope || envelope.schemaVersion !== QUESTION_ENGINE_TASK_PROTOCOL_VERSION) return { valid: false, reason: 'schema_version_invalid' };
  if (envelope.taskId !== input.task.taskId || envelope.requestNonce !== input.task.nonce) return { valid: false, reason: 'task_binding_mismatch' };
  if (envelope.capability !== input.capability || input.task.capability !== input.capability) return { valid: false, reason: 'capability_mismatch' };
  if (envelope.plugin.id !== input.plugin.id || envelope.plugin.version !== input.plugin.version
    || envelope.plugin.apiVersion !== input.plugin.apiVersion) return { valid: false, reason: 'plugin_identity_mismatch' };
  if (envelope.keyId !== input.keyId.trim()) return { valid: false, reason: 'key_id_mismatch' };
  if (envelope.audience !== 'moodlelike-question-engine-host') return { valid: false, reason: 'result_audience_invalid' };
  if (!/^[a-z0-9._-]{1,64}$/i.test(envelope.worker?.id ?? '')
    || !/^[a-z0-9._+-]{1,64}$/i.test(envelope.worker?.version ?? '')) return { valid: false, reason: 'worker_identity_invalid' };
  if (input.acceptedWorkerVersions) {
    const acceptedWorkerVersions = new Set(input.acceptedWorkerVersions.map((value) => value.trim()).filter(Boolean));
    if (!acceptedWorkerVersions.size) return { valid: false, reason: 'worker_version_policy_missing' };
    if (!acceptedWorkerVersions.has(envelope.worker.version)) return { valid: false, reason: 'worker_version_not_accepted' };
  }
  if (envelope.status !== 'succeeded' && envelope.status !== 'failed') return { valid: false, reason: 'result_status_invalid' };
  if (envelope.status === 'failed' && !/^[a-z0-9._-]{1,96}$/i.test(envelope.errorCode ?? '')) {
    return { valid: false, reason: 'result_error_code_invalid' };
  }
  if (envelope.resultSha256 !== digestPayload(input.result)) return { valid: false, reason: 'result_digest_mismatch' };
  const completedAt = Date.parse(envelope.completedAt);
  const issuedAt = Date.parse(input.task.issuedAt);
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(completedAt) || !Number.isFinite(issuedAt) || completedAt < issuedAt - 30_000 || completedAt > now + 30_000) {
    return { valid: false, reason: 'result_time_invalid' };
  }
  const { signatureHmacSha256, ...unsigned } = envelope;
  if (!equalSignature(resultSignature(unsigned, input.secret), signatureHmacSha256)) return { valid: false, reason: 'signature_invalid' };
  return { valid: true, replayKey: `${envelope.keyId}:result:${envelope.requestNonce}` };
}
