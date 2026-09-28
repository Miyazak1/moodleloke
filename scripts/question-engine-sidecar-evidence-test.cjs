const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildQuestionEngineSidecarEvidence } = require('./question-engine-sidecar-evidence.cjs');

const probe = {
  status: 'pass',
  latencyMs: 12,
  healthUrl: 'http://question-engine-worker:3100/health?token=must-not-leak',
  protocol: 'question-engine-task-v1',
  worker: { id: 'moodlelike-question-engine-worker', version: '1.1.0' },
  capabilities: ['question.generate', 'question.review', 'question.topic-map'],
  blockers: []
};

const readiness = {
  status: 'ready',
  runtime: {
    worker: {
      status: 'healthy',
      worker: { id: 'moodlelike-question-engine-worker', version: '1.1.0' },
      blockers: []
    },
    transport: { circuit: { open: false, consecutiveFailures: 0, threshold: 3, resetMs: 30000 } }
  }
};

const passed = buildQuestionEngineSidecarEvidence({
  phase: 'upgrade-worker',
  expectedVersion: '1.1.0',
  requiredCapabilities: 'question.generate,question.review,question.topic-map',
  probe,
  readiness,
  sourceDigests: { probeSha256: 'a'.repeat(64), readinessSha256: 'b'.repeat(64) }
});
assert.equal(passed.status, 'passed');
assert.equal(passed.blockers.length, 0);
assert.equal(passed.observed.probe.worker.version, '1.1.0');
assert.equal(JSON.stringify(passed).includes('question-engine-worker:3100'), false);
assert.equal(JSON.stringify(passed).includes('must-not-leak'), false);

const incompatible = buildQuestionEngineSidecarEvidence({
  phase: 'close-compatibility-window',
  expectedVersion: '1.1.0',
  requiredCapabilities: 'question.generate,question.review,question.topic-map',
  probe: { ...probe, worker: { ...probe.worker, version: '1.0.0' }, capabilities: ['question.generate'] },
  readiness: { ...readiness, status: 'blocked' }
});
assert.equal(incompatible.status, 'blocked');
assert.ok(incompatible.blockers.includes('worker_version_match'));
assert.ok(incompatible.blockers.includes('required_capabilities_present'));
assert.ok(incompatible.blockers.includes('runtime_readiness_ready'));

assert.throws(() => buildQuestionEngineSidecarEvidence({
  phase: 'production-cutover', expectedVersion: '1.1.0', requiredCapabilities: 'question.generate', probe
}), /phase_invalid/);
assert.throws(() => buildQuestionEngineSidecarEvidence({
  phase: 'baseline', expectedVersion: '1.1.0', requiredCapabilities: 'question.generate,unknown', probe
}), /required_capabilities_invalid/);

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moodlelike-qe-evidence-'));
try {
  const probeFile = path.join(fixtureDir, 'probe.json');
  const readinessFile = path.join(fixtureDir, 'ready.json');
  const outputFile = path.join(fixtureDir, 'evidence.json');
  fs.writeFileSync(probeFile, JSON.stringify({ questionEngineWorkerProbe: probe }));
  fs.writeFileSync(readinessFile, JSON.stringify({ questionEngine: readiness }));
  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'question-engine-sidecar-evidence.cjs'),
    '--phase=upgrade-worker',
    '--expected-version=1.1.0',
    `--probe-file=${probeFile}`,
    `--readiness-file=${readinessFile}`,
    `--output=${outputFile}`
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.equal(written.status, 'passed');
  assert.match(written.sourceDigests.probeSha256, /^[a-f0-9]{64}$/);
  assert.match(written.sourceDigests.readinessSha256, /^[a-f0-9]{64}$/);
  const overwrite = spawnSync(process.execPath, [
    path.join(__dirname, 'question-engine-sidecar-evidence.cjs'),
    '--phase=upgrade-worker',
    '--expected-version=1.1.0',
    `--probe-file=${probeFile}`,
    `--output=${outputFile}`
  ], { encoding: 'utf8' });
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /EEXIST/);
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log('Question-engine sidecar evidence tests passed.');
