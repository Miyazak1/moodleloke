const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { buildQuestionEngineSidecarRolloutPlan } = require('./question-engine-sidecar-rehearsal.cjs');
const { probeQuestionEngineWorker } = require('./moodlelike-integration-preflight.cjs');

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
  const plan = buildQuestionEngineSidecarRolloutPlan({ fromVersion: '1.0.0', toVersion: '1.1.0' });
  assert.equal(plan.safety.executesCommands, false);
  assert.equal(plan.safety.callsProvider, false);
  assert.equal(plan.phases[1].env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS, '1.0.0,1.1.0');
  assert.equal(plan.phases[3].env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS, '1.1.0');
  assert.equal(plan.rollback.env.QUESTION_ENGINE_WORKER_VERSION, '1.0.0');
  assert.equal(plan.rollback.finalizeEnv.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS, '1.0.0');
  assert.throws(() => buildQuestionEngineSidecarRolloutPlan({ fromVersion: '1.0.0', toVersion: '1.0.0' }), /must_differ/);

  let health = { status: 'ready', protocol: 'question-engine-task-v1', worker: { id: 'worker-a', version: '1.1.0' }, capabilities: ['question.generate', 'question.review'] };
  const server = http.createServer((_request, response) => {
    const body = JSON.stringify(health);
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  });
  const baseUrl = await listen(server);
  const env = {
    QUESTION_ENGINE_SIDECAR_URL: `${baseUrl}/v1/tasks/execute`,
    QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0,1.1.0',
    QUESTION_ENGINE_WORKER_CAPABILITIES: 'question.generate,question.review'
  };
  try {
    const ready = await probeQuestionEngineWorker(env);
    assert.equal(ready.status, 'pass');
    assert.equal(ready.worker.version, '1.1.0');

    health = { ...health, worker: { ...health.worker, version: '2.0.0' } };
    const incompatible = await probeQuestionEngineWorker(env);
    assert.equal(incompatible.status, 'block');
    assert.ok(incompatible.blockers.includes('worker_version_not_accepted'));

    health = { ...health, worker: { ...health.worker, version: '1.1.0' }, capabilities: ['question.generate'] };
    const missingCapability = await probeQuestionEngineWorker(env);
    assert.equal(missingCapability.status, 'block');
    assert.ok(missingCapability.blockers.includes('worker_capability_missing:question.review'));
  } finally {
    await close(server);
  }
  const unavailable = await probeQuestionEngineWorker({
    ...env, QUESTION_ENGINE_WORKER_HEALTH_URL: 'http://127.0.0.1:1/health'
  }, { timeoutMs: 500 });
  assert.equal(unavailable.status, 'block');
  console.log('Question-engine sidecar rehearsal tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
