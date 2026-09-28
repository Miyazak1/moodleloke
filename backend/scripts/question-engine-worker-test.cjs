const assert = require('node:assert/strict');
const { once } = require('node:events');
const { BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR: plugin } = require('../dist/backend/src/question-engine-plugin/builtin-ai-questioning.adapter.js');
const { issueQuestionEngineTaskEnvelope, verifyQuestionEngineTaskResultEnvelope } = require('../dist/backend/src/question-engine-plugin/question-engine-task-protocol.js');
const { QuestionEngineSidecarTransportService } = require('../dist/backend/src/question-engine-plugin/question-engine-sidecar-transport.service.js');
const { createQuestionEngineWorkerServer } = require('../dist/backend/src/question-engine-worker/main.js');
const { createQuestionEngineWorkerCapabilityHandler, questionEngineWorkerCapabilities } = require('../dist/backend/src/question-engine-worker/capability-handler.js');

const secret = 'test-question-engine-worker-secret-1234567890';
const keyId = 'worker-test-key';

class MemoryStore {
  constructor() { this.nonces = new Set(); this.results = new Map(); }
  async claim(key) { if (this.nonces.has(key)) return false; this.nonces.add(key); return true; }
  async getCompletedResult(taskId) { return this.results.get(taskId) ?? null; }
  async cacheCompletedResult(taskId, value) { if (this.results.has(taskId)) return false; this.results.set(taskId, value); return true; }
}

async function main() {
  Object.assign(process.env, {
    QUESTION_ENGINE_TASK_HMAC_SECRET: secret,
    QUESTION_ENGINE_TASK_KEY_ID: keyId,
    QUESTION_ENGINE_WORKER_ID: 'test-worker',
    QUESTION_ENGINE_WORKER_VERSION: '1.0.0',
    QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0'
  });
  let executions = 0;
  process.env.QUESTION_ENGINE_WORKER_CAPABILITIES = 'question.generate,invalid,question.review,question.topic-map';
  assert.deepEqual(questionEngineWorkerCapabilities(), ['question.generate', 'question.review', 'question.topic-map']);
  const dispatched = [];
  const capabilityHandler = createQuestionEngineWorkerCapabilityHandler({
    generator: { generate: async () => { dispatched.push('generate'); return { provider: 'fake-generator' }; } },
    reviewer: {
      review: async () => { dispatched.push('review'); return { provider: { provider: 'fake-reviewer' } }; },
      reviewBlindAnswer: async () => { dispatched.push('reviewBlindAnswer'); return { status: 'completed' }; }
    },
    topicMapper: { suggest: async () => { dispatched.push('suggest'); return { suggestions: [] }; } }
  });
  assert.equal((await capabilityHandler({ capability: 'question.generate', payload: { operation: 'generate', blueprint: {}, fallback: {} } })).status, 'succeeded');
  assert.equal((await capabilityHandler({ capability: 'question.review', payload: { operation: 'review', candidate: {} } })).status, 'succeeded');
  assert.equal((await capabilityHandler({ capability: 'question.review', payload: { operation: 'reviewBlindAnswer', candidate: {} } })).status, 'succeeded');
  assert.equal((await capabilityHandler({ capability: 'question.topic-map', payload: { operation: 'suggest', question: {}, topics: [] } })).status, 'succeeded');
  assert.deepEqual(dispatched, ['generate', 'review', 'reviewBlindAnswer', 'suggest']);
  const store = new MemoryStore();
  const server = createQuestionEngineWorkerServer({
    store,
    supportedCapabilities: ['question.generate'],
    handler: async ({ payload }) => { executions += 1; return { status: 'succeeded', result: { accepted: true, payload } }; }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert.equal(health.status, 'ready');
    assert.deepEqual(health.capabilities, ['question.generate']);

    Object.assign(process.env, {
      QUESTION_ENGINE_EXECUTION_MODE: 'sidecar',
      QUESTION_ENGINE_SIDECAR_URL: `${baseUrl}/v1/tasks/execute`,
      QUESTION_ENGINE_SIDECAR_TIMEOUT_MS: '2000'
    });
    const transport = new QuestionEngineSidecarTransportService({ claim: async () => true });
    assert.deepEqual(
      await transport.execute({ capability: 'question.generate', plugin, payload: { blueprintId: 7 } }),
      { accepted: true, payload: { blueprintId: 7 } }
    );

    const payload = { blueprintId: 42 };
    const envelope = issueQuestionEngineTaskEnvelope({ capability: 'question.generate', plugin, payload, secret, keyId });
    const send = (nextPayload = payload, headers = {}) => fetch(`${baseUrl}/v1/tasks/execute`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-question-engine-protocol': 'question-engine-task-v1',
        'idempotency-key': envelope.taskId,
        ...headers
      },
      body: JSON.stringify({ envelope, payload: nextPayload })
    });
    const firstResponse = await send();
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    assert.equal(first.envelope.status, 'succeeded');
    assert.equal(verifyQuestionEngineTaskResultEnvelope({
      envelope: first.envelope, task: envelope, capability: 'question.generate', plugin,
      result: first.result, secret, keyId
    }).valid, true);

    const duplicateResponse = await send();
    assert.equal(duplicateResponse.status, 200);
    assert.deepEqual(await duplicateResponse.json(), first);
    assert.equal(executions, 2, 'completed task must be served from the idempotent result cache');

    const tampered = await send({ blueprintId: 43 });
    assert.equal(tampered.status, 401);
    assert.match((await tampered.json()).error, /payload_digest_mismatch/);

    const wrongIdempotency = await send(payload, { 'idempotency-key': 'wrong' });
    assert.equal(wrongIdempotency.status, 400);

    const reviewPayload = { candidateId: 'candidate-1' };
    const reviewTask = issueQuestionEngineTaskEnvelope({ capability: 'question.review', plugin, payload: reviewPayload, secret, keyId });
    const reviewResponse = await fetch(`${baseUrl}/v1/tasks/execute`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-question-engine-protocol': 'question-engine-task-v1',
        'idempotency-key': reviewTask.taskId
      },
      body: JSON.stringify({ envelope: reviewTask, payload: reviewPayload })
    });
    assert.equal(reviewResponse.status, 200);
    const review = await reviewResponse.json();
    assert.equal(review.envelope.status, 'failed');
    assert.equal(review.envelope.errorCode, 'capability_not_wired');
  } finally {
    server.close();
    await once(server, 'close');
  }

  process.env.QUESTION_ENGINE_TASK_HMAC_SECRET = 'short';
  const blockedServer = createQuestionEngineWorkerServer({ store: new MemoryStore() });
  blockedServer.listen(0, '127.0.0.1');
  await once(blockedServer, 'listening');
  const blockedAddress = blockedServer.address();
  try {
    const blockedHealth = await fetch(`http://127.0.0.1:${blockedAddress.port}/health`);
    assert.equal(blockedHealth.status, 503);
    assert.equal((await blockedHealth.json()).status, 'blocked');
  } finally {
    blockedServer.close();
    await once(blockedServer, 'close');
  }

  process.env.QUESTION_ENGINE_TASK_HMAC_SECRET = secret;
  const unavailableStoreServer = createQuestionEngineWorkerServer({
    store: {
      claim: async () => { throw new Error('redis_unavailable'); },
      getCompletedResult: async () => { throw new Error('redis_unavailable'); },
      cacheCompletedResult: async () => { throw new Error('redis_unavailable'); }
    },
    supportedCapabilities: ['question.generate'],
    handler: async () => ({ status: 'succeeded', result: { shouldNotEscape: true } })
  });
  unavailableStoreServer.listen(0, '127.0.0.1');
  await once(unavailableStoreServer, 'listening');
  const unavailableAddress = unavailableStoreServer.address();
  try {
    const payload = { blueprintId: 99 };
    const envelope = issueQuestionEngineTaskEnvelope({ capability: 'question.generate', plugin, payload, secret, keyId });
    const response = await fetch(`http://127.0.0.1:${unavailableAddress.port}/v1/tasks/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-question-engine-protocol': 'question-engine-task-v1', 'idempotency-key': envelope.taskId },
      body: JSON.stringify({ envelope, payload })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'worker_state_store_unavailable');
  } finally {
    unavailableStoreServer.close();
    await once(unavailableStoreServer, 'close');
  }
  console.log('Question-engine worker protocol tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
