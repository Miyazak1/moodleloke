import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR } from '../question-engine-plugin/builtin-ai-questioning.adapter';
import {
  QuestionEngineNonceStoreService,
  questionEngineNonceStoreConfigured
} from '../question-engine-plugin/question-engine-nonce-store.service';
import type { QuestionEngineCapability } from '../question-engine-plugin/question-engine-plugin.types';
import {
  QUESTION_ENGINE_TASK_PROTOCOL_VERSION,
  issueQuestionEngineTaskResultEnvelope,
  questionEngineTaskSigningConfigured,
  verifyQuestionEngineTaskEnvelope,
  type QuestionEngineTaskEnvelope
} from '../question-engine-plugin/question-engine-task-protocol';
import {
  createQuestionEngineWorkerCapabilityHandler,
  questionEngineWorkerCapabilities
} from './capability-handler';

type ResultStore = Pick<QuestionEngineNonceStoreService, 'claim' | 'getCompletedResult' | 'cacheCompletedResult'>;
type WorkerResult = { status: 'succeeded' | 'failed'; result: unknown; errorCode?: string };
type WorkerHandler = (input: { capability: QuestionEngineCapability; payload: unknown; taskId: string }) => Promise<WorkerResult>;

function json(response: ServerResponse, status: number, body: unknown) {
  const serialized = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(serialized),
    'cache-control': 'no-store'
  });
  response.end(serialized);
}

function readJsonBody(request: IncomingMessage, maxBytes = 2 * 1024 * 1024) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    request.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.byteLength;
      if (size > maxBytes) {
        settled = true;
        request.resume();
        reject(new Error('request_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('request_json_invalid'));
      }
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function validWorkerIdentity(value: string) {
  return /^[a-z0-9._-]{1,64}$/i.test(value);
}

export function createQuestionEngineWorkerServer(options: {
  store?: ResultStore;
  handler?: WorkerHandler;
  supportedCapabilities?: QuestionEngineCapability[];
} = {}) {
  const store = options.store ?? new QuestionEngineNonceStoreService();
  const handler: WorkerHandler = options.handler ?? (async () => ({
    status: 'failed', result: null, errorCode: 'capability_not_wired'
  }));
  const supportedCapabilities = new Set(options.supportedCapabilities ?? []);
  const secret = String(process.env.QUESTION_ENGINE_TASK_HMAC_SECRET ?? '');
  const keyId = String(process.env.QUESTION_ENGINE_TASK_KEY_ID ?? '').trim();
  const workerId = String(process.env.QUESTION_ENGINE_WORKER_ID ?? 'moodlelike-question-worker').trim();
  const workerVersion = String(process.env.QUESTION_ENGINE_WORKER_VERSION ?? '1.0.0').trim();
  const configurationReady = questionEngineTaskSigningConfigured()
    && (Boolean(options.store) || questionEngineNonceStoreConfigured());
  if (!validWorkerIdentity(workerId) || !/^[a-z0-9._+-]{1,64}$/i.test(workerVersion)) {
    throw new Error('question_engine_worker_identity_invalid');
  }

  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      json(response, configurationReady ? 200 : 503, {
        status: configurationReady ? (supportedCapabilities.size ? 'ready' : 'ready_no_capabilities') : 'blocked',
        protocol: QUESTION_ENGINE_TASK_PROTOCOL_VERSION,
        worker: { id: workerId, version: workerVersion },
        capabilities: [...supportedCapabilities]
      });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/tasks/execute') {
      json(response, 404, { error: 'not_found' });
      return;
    }
    if (!configurationReady) {
      json(response, 503, { error: 'worker_configuration_invalid' });
      return;
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      json(response, 415, { error: 'content_type_required' });
      return;
    }
    if (request.headers['x-question-engine-protocol'] !== QUESTION_ENGINE_TASK_PROTOCOL_VERSION) {
      json(response, 400, { error: 'protocol_header_invalid' });
      return;
    }

    let body: { envelope?: QuestionEngineTaskEnvelope; payload?: unknown };
    try {
      body = await readJsonBody(request) as typeof body;
    } catch (error) {
      json(response, error instanceof Error && error.message === 'request_too_large' ? 413 : 400, {
        error: error instanceof Error ? error.message : 'request_invalid'
      });
      return;
    }
    const task = body?.envelope;
    const capability = task?.capability;
    if (!task || !capability || !BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR.capabilities.includes(capability)) {
      json(response, 400, { error: 'task_capability_invalid' });
      return;
    }
    if (request.headers['idempotency-key'] !== task.taskId) {
      json(response, 400, { error: 'idempotency_key_mismatch' });
      return;
    }
    const verified = verifyQuestionEngineTaskEnvelope({
      envelope: task,
      capability,
      plugin: BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR,
      payload: body.payload,
      secret,
      keyId
    });
    if (!verified.valid) {
      json(response, 401, { error: `task_rejected:${verified.reason}` });
      return;
    }

    try {
      const cached = await store.getCompletedResult(task.taskId);
      if (cached) {
        json(response, 200, JSON.parse(cached));
        return;
      }
      const ttlMs = Math.max(1000, Date.parse(task.expiresAt) - Date.now());
      if (!await store.claim(verified.replayKey, ttlMs)) {
        const racedResult = await store.getCompletedResult(task.taskId);
        if (racedResult) json(response, 200, JSON.parse(racedResult));
        else json(response, 409, { error: 'task_replayed_or_in_progress' });
        return;
      }

      let execution: WorkerResult;
      if (!supportedCapabilities.has(capability)) {
        execution = { status: 'failed', result: null, errorCode: 'capability_not_wired' };
      } else {
        try {
          execution = await handler({ capability, payload: body.payload, taskId: task.taskId });
        } catch {
          execution = { status: 'failed', result: null, errorCode: 'worker_execution_failed' };
        }
      }
      const envelope = issueQuestionEngineTaskResultEnvelope({
        task,
        capability,
        plugin: BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR,
        worker: { id: workerId, version: workerVersion },
        status: execution.status,
        result: execution.result,
        errorCode: execution.errorCode,
        secret,
        keyId
      });
      const result = { envelope, result: execution.result };
      const serialized = JSON.stringify(result);
      await store.cacheCompletedResult(task.taskId, serialized, 600_000);
      json(response, 200, result);
    } catch {
      json(response, 503, { error: 'worker_state_store_unavailable' });
    }
  });
}

if (require.main === module) {
  if (process.env.QUESTION_ENGINE_WORKER_ENABLED !== 'true') {
    throw new Error('question_engine_worker_not_enabled');
  }
  const port = Number(process.env.QUESTION_ENGINE_WORKER_PORT ?? 3100);
  const host = String(process.env.QUESTION_ENGINE_WORKER_HOST ?? '0.0.0.0');
  const supportedCapabilities = questionEngineWorkerCapabilities();
  const server = createQuestionEngineWorkerServer({
    supportedCapabilities,
    handler: createQuestionEngineWorkerCapabilityHandler()
  });
  server.listen(port, host, () => {
    process.stdout.write(`${JSON.stringify({ event: 'question_engine_worker_started', host, port })}\n`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
