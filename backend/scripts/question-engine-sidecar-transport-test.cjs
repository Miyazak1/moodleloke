const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { QuestionEngineSidecarTransportService } = require('../dist/backend/src/question-engine-plugin/question-engine-sidecar-transport.service.js');
const { QuestionEngineNonceStoreService } = require('../dist/backend/src/question-engine-plugin/question-engine-nonce-store.service.js');
const { issueQuestionEngineTaskResultEnvelope } = require('../dist/backend/src/question-engine-plugin/question-engine-task-protocol.js');

const secret = 'test-question-engine-sidecar-secret-123456789';
const keyId = 'sidecar-test-key';
const plugin = {
  id: 'moodlelike-ai-questioning', displayName: 'Moodlelike AI Questioning', version: '1.0.0', apiVersion: '1',
  capabilities: ['question.generate', 'question.review', 'question.topic-map'], executionBoundary: 'in-process-adapter', activationMode: 'configuration-restart'
};

async function testTransport() {
  let mode = 'success';
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(request.headers['x-question-engine-protocol'], 'question-engine-task-v1');
    assert.equal(request.headers['idempotency-key'], body.envelope.taskId);
    if (mode === 'http-error') {
      response.writeHead(503).end('unavailable');
      return;
    }
    if (mode === 'timeout') await new Promise((resolve) => setTimeout(resolve, 800));
    const result = { accepted: true, value: 42 };
    const envelope = issueQuestionEngineTaskResultEnvelope({
      task: body.envelope, capability: 'question.generate', plugin,
      worker: { id: 'test-worker', version: mode === 'old-version' ? '0.9.0' : '1.0.0' },
      status: mode === 'failed-task' ? 'failed' : 'succeeded', result,
      errorCode: mode === 'failed-task' ? 'provider_contract_failed' : undefined,
      secret, keyId
    });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ envelope, result: mode === 'tampered' ? { ...result, value: 43 } : result }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  Object.assign(process.env, {
    QUESTION_ENGINE_EXECUTION_MODE: 'sidecar',
    QUESTION_ENGINE_SIDECAR_URL: `http://127.0.0.1:${address.port}/v1/tasks/execute`,
    QUESTION_ENGINE_TASK_HMAC_SECRET: secret,
    QUESTION_ENGINE_TASK_KEY_ID: keyId,
    QUESTION_ENGINE_SIDECAR_TIMEOUT_MS: '2000',
    QUESTION_ENGINE_SIDECAR_CIRCUIT_FAILURE_THRESHOLD: '2',
    QUESTION_ENGINE_SIDECAR_CIRCUIT_RESET_MS: '30000',
    QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0'
  });
  try {
    const claims = [];
    const transport = new QuestionEngineSidecarTransportService({ claim: async (replayKey) => { claims.push(replayKey); return true; } });
    const result = await transport.execute({ capability: 'question.generate', plugin, payload: { blueprintId: 42 } });
    assert.deepEqual(result, { accepted: true, value: 42 });
    assert.equal(claims.length, 1);
    assert.match(claims[0], /:result:/);
    assert.equal(transport.getOperationalStatus().circuit.open, false);
    assert.match(transport.getOperationalStatus().lastSuccessAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(transport.getOperationalStatus().lastFailure, null);

    mode = 'old-version';
    await assert.rejects(transport.execute({ capability: 'question.generate', plugin, payload: {} }), /worker_version_not_accepted/);
    process.env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS = '1.0.0,0.9.0';
    assert.deepEqual(await transport.execute({ capability: 'question.generate', plugin, payload: {} }), { accepted: true, value: 42 });
    process.env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS = '1.0.0';

    mode = 'tampered';
    await assert.rejects(transport.execute({ capability: 'question.generate', plugin, payload: { blueprintId: 42 } }), /result_rejected:result_digest_mismatch/);

    mode = 'failed-task';
    await assert.rejects(transport.execute({ capability: 'question.generate', plugin, payload: {} }), /sidecar_task_failed:provider_contract_failed/);
    assert.equal(transport.getOperationalStatus().circuit.consecutiveFailures, 0);
    assert.deepEqual(
      {
        code: transport.getOperationalStatus().lastFailure?.code,
        affectsCircuit: transport.getOperationalStatus().lastFailure?.affectsCircuit
      },
      { code: 'question_engine_sidecar_task_failed:provider_contract_failed', affectsCircuit: false }
    );

    mode = 'success';
    const replayTransport = new QuestionEngineSidecarTransportService({ claim: async () => false });
    await assert.rejects(replayTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /result_replayed/);

    mode = 'http-error';
    const circuitTransport = new QuestionEngineSidecarTransportService({ claim: async () => true });
    await assert.rejects(circuitTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /sidecar_http_503/);
    await assert.rejects(circuitTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /sidecar_http_503/);
    assert.equal(circuitTransport.getCircuitStatus().open, true);
    await assert.rejects(circuitTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /circuit_open/);

    mode = 'timeout';
    process.env.QUESTION_ENGINE_SIDECAR_TIMEOUT_MS = '500';
    const timeoutTransport = new QuestionEngineSidecarTransportService({ claim: async () => true });
    await assert.rejects(timeoutTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /sidecar_timeout/);
    await assert.rejects(timeoutTransport.execute({ capability: 'question.generate', plugin, payload: {} }), /sidecar_timeout/);
    assert.equal(timeoutTransport.getCircuitStatus().open, true);
    assert.deepEqual(
      {
        code: timeoutTransport.getOperationalStatus().lastFailure?.code,
        affectsCircuit: timeoutTransport.getOperationalStatus().lastFailure?.affectsCircuit
      },
      { code: 'question_engine_sidecar_timeout', affectsCircuit: true }
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function testRedisNonceClaim() {
  let setCount = 0;
  let cachedValue = null;
  const redis = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      const command = chunk.toString('utf8');
      if (command.includes('moodlelike:question-engine:nonce:')) {
        assert.match(command, /\r\nNX\r\n/);
        assert.match(command, /\r\nPX\r\n/);
        setCount += 1;
        socket.write(setCount === 1 ? '+OK\r\n' : '$-1\r\n');
        return;
      }
      assert.match(command, /moodlelike:question-engine:result:/);
      if (command.includes('\r\nGET\r\n')) {
        socket.write(cachedValue === null ? '$-1\r\n' : `$${Buffer.byteLength(cachedValue)}\r\n${cachedValue}\r\n`);
        return;
      }
      cachedValue = '{"ok":true}';
      socket.write('+OK\r\n');
    });
  });
  redis.listen(0, '127.0.0.1');
  await once(redis, 'listening');
  const address = redis.address();
  process.env.QUESTION_ENGINE_NONCE_REDIS_URL = `redis://127.0.0.1:${address.port}`;
  process.env.QUESTION_ENGINE_NONCE_REDIS_TIMEOUT_MS = '1000';
  try {
    const store = new QuestionEngineNonceStoreService();
    assert.equal(await store.claim('key:nonce', 30_000), true);
    assert.equal(await store.claim('key:nonce', 30_000), false);
    assert.equal(await store.getCompletedResult('task-1'), null);
    assert.equal(await store.cacheCompletedResult('task-1', '{"ok":true}', 30_000), true);
    assert.equal(await store.getCompletedResult('task-1'), '{"ok":true}');
  } finally {
    redis.close();
    await once(redis, 'close');
  }
}

(async () => {
  await testTransport();
  await testRedisNonceClaim();
  console.log('Question-engine sidecar transport tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
