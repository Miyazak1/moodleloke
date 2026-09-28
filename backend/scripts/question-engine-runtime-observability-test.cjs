const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { BuiltinAIQuestioningAdapter } = require('../dist/backend/src/question-engine-plugin/builtin-ai-questioning.adapter.js');
const { QuestionEnginePluginRegistryService } = require('../dist/backend/src/question-engine-plugin/question-engine-plugin-registry.service.js');
const { QuestionEngineWorkerHealthService } = require('../dist/backend/src/question-engine-plugin/question-engine-worker-health.service.js');
const { HealthController } = require('../dist/backend/src/health/health.controller.js');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  server.close();
  await once(server, 'close');
}

async function main() {
  let workerVersion = '1.0.0';
  const server = http.createServer((_request, response) => {
    const serialized = JSON.stringify({
      status: 'ready', protocol: 'question-engine-task-v1',
      worker: { id: 'runtime-test-worker', version: workerVersion },
      capabilities: ['question.generate', 'question.review', 'question.topic-map']
    });
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(serialized) });
    response.end(serialized);
  });
  const baseUrl = await listen(server);
  Object.assign(process.env, {
    QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'moodlelike-ai-questioning',
    QUESTION_ENGINE_EXECUTION_MODE: 'sidecar', QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED: 'true',
    QUESTION_ENGINE_SIDECAR_URL: `${baseUrl}/v1/tasks/execute`, QUESTION_ENGINE_WORKER_HEALTH_URL: `${baseUrl}/health`,
    QUESTION_ENGINE_TASK_HMAC_SECRET: 'runtime-observability-secret-1234567890', QUESTION_ENGINE_TASK_KEY_ID: 'runtime-test',
    QUESTION_ENGINE_NONCE_REDIS_URL: 'redis://redis:6379', QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0',
    QUESTION_ENGINE_WORKER_CAPABILITIES: 'question.generate,question.review,question.topic-map',
    CSCA_AI_QUESTION_GENERATION_ENABLED: 'true', CSCA_AI_QUESTION_REVIEW_ENABLED: 'true', CSCA_AI_TOPIC_MAPPING_ENABLED: 'true',
    CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'true', AI_DEFAULT_PROVIDER: 'deepseek',
    DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-chat', DEEPSEEK_BACKGROUND_API_KEYS: 'sk-test',
    DATABASE_URL: 'postgresql://test:test@db:5432/test', AUTH_SECRET: 'x'.repeat(40),
    ADMIN_BOOTSTRAP_EMAIL: 'admin@example.test', CORS_ORIGINS: 'https://example.test',
    AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true',
    CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
    CSCA_TARGET_GAP_ENABLED: 'true', CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true'
  });
  const transport = {
    getOperationalStatus: () => ({
      circuit: { open: false, consecutiveFailures: 0, threshold: 3, resetMs: 30000 },
      lastSuccessAt: null, lastFailure: null
    })
  };
  const health = new QuestionEngineWorkerHealthService();
  const registry = new QuestionEnginePluginRegistryService(new BuiltinAIQuestioningAdapter(), transport, health);
  try {
    const status = await registry.getStatusWithRuntime(true);
    assert.equal(status.runtime.worker.status, 'healthy');
    assert.equal(status.runtime.worker.worker.version, '1.0.0');
    assert.equal(status.runtime.transport.circuit.open, false);
    const ready = await registry.getProductionReadinessWithRuntime(true);
    assert.equal(ready.status, 'ready');

    workerVersion = '2.0.0';
    const incompatible = await registry.getProductionReadinessWithRuntime(true);
    assert.equal(incompatible.status, 'blocked');
    assert.ok(incompatible.blockers.includes('sidecar_worker:worker_version_not_accepted'));

    workerVersion = '1.0.0';
    const openCircuitRegistry = new QuestionEnginePluginRegistryService(new BuiltinAIQuestioningAdapter(), {
      getOperationalStatus: () => ({
        circuit: { open: true, consecutiveFailures: 3, threshold: 3, resetMs: 30000 },
        lastSuccessAt: null,
        lastFailure: { at: new Date().toISOString(), code: 'question_engine_sidecar_timeout', affectsCircuit: true }
      })
    }, health);
    const circuitBlocked = await openCircuitRegistry.getProductionReadinessWithRuntime(true);
    assert.equal(circuitBlocked.status, 'blocked');
    assert.ok(circuitBlocked.blockers.includes('sidecar_transport_circuit_open'));

    const controller = new HealthController(
      { ping: async () => ({ connected: true, latencyMs: 1 }) },
      { getProductionReadinessWithRuntime: async () => circuitBlocked, getProductionReadiness: () => circuitBlocked }
    );
    const opsReady = await controller.ready();
    assert.equal(opsReady.status, 'degraded');
    assert.equal(opsReady.questionEngine.runtime.transport.circuit.open, true);
  } finally {
    await close(server);
  }
  console.log('Question-engine runtime observability tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
