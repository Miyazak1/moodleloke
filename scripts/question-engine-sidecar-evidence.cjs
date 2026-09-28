const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROTOCOL = 'question-engine-task-v1';
const PHASES = new Set([
  'baseline',
  'open-compatibility-window',
  'upgrade-worker',
  'close-compatibility-window',
  'rollback',
  'rollback-finalize'
]);
const CAPABILITIES = new Set(['question.generate', 'question.review', 'question.topic-map']);

function valueArg(args, name, fallback = '') {
  const prefix = `--${name}=`;
  return args.find((item) => item.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function safeVersion(value) {
  const normalized = String(value || '').trim();
  if (!/^[a-z0-9._+-]{1,64}$/i.test(normalized)) throw new Error('expected_version_invalid');
  return normalized;
}

function requiredCapabilities(value) {
  const capabilities = [...new Set(String(value || '')
    .split(',').map((item) => item.trim()).filter(Boolean))];
  if (!capabilities.length || capabilities.some((item) => !CAPABILITIES.has(item))) {
    throw new Error('required_capabilities_invalid');
  }
  return capabilities;
}

function parseJsonFile(file, label) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error(`${label}_invalid`);
  const raw = fs.readFileSync(resolved, 'utf8');
  return { raw, value: JSON.parse(raw), digest: crypto.createHash('sha256').update(raw).digest('hex') };
}

function normalizeProbe(value) {
  const probe = value?.questionEngineWorkerProbe ?? value;
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)) throw new Error('probe_evidence_invalid');
  return probe;
}

function normalizeReadiness(value) {
  const readiness = value?.questionEngine ?? value;
  if (!readiness || typeof readiness !== 'object' || Array.isArray(readiness)) throw new Error('readiness_evidence_invalid');
  return readiness;
}

function buildQuestionEngineSidecarEvidence(input) {
  const phase = String(input.phase || '').trim();
  if (!PHASES.has(phase)) throw new Error('phase_invalid');
  const expectedVersion = safeVersion(input.expectedVersion);
  const required = requiredCapabilities(input.requiredCapabilities);
  const probe = normalizeProbe(input.probe);
  const actualCapabilities = Array.isArray(probe.capabilities)
    ? [...new Set(probe.capabilities.map(String).filter((item) => CAPABILITIES.has(item)))]
    : [];
  const probeBlockers = Array.isArray(probe.blockers)
    ? probe.blockers.map(String).filter(Boolean).slice(0, 30)
    : [];
  const worker = probe.worker && typeof probe.worker === 'object' && !Array.isArray(probe.worker)
    ? probe.worker : null;
  const checks = [
    { id: 'probe_passed', pass: probe.status === 'pass', actual: String(probe.status || 'missing') },
    { id: 'protocol_match', pass: probe.protocol === PROTOCOL, actual: String(probe.protocol || 'missing') },
    { id: 'worker_identity_present', pass: Boolean(worker && String(worker.id || '').trim()), actual: worker ? String(worker.id || 'missing') : 'missing' },
    { id: 'worker_version_match', pass: Boolean(worker && String(worker.version || '') === expectedVersion), actual: worker ? String(worker.version || 'missing') : 'missing' },
    { id: 'required_capabilities_present', pass: required.every((item) => actualCapabilities.includes(item)), actual: actualCapabilities },
    { id: 'probe_blockers_empty', pass: probeBlockers.length === 0, actual: probeBlockers }
  ];

  let readiness = null;
  if (input.readiness) {
    const value = normalizeReadiness(input.readiness);
    const runtimeWorker = value.runtime?.worker;
    const circuit = value.runtime?.transport?.circuit;
    const runtimeBlockers = Array.isArray(runtimeWorker?.blockers)
      ? runtimeWorker.blockers.map(String).filter(Boolean).slice(0, 30)
      : [];
    readiness = {
      status: String(value.status || 'missing'),
      workerStatus: String(runtimeWorker?.status || 'missing'),
      workerVersion: String(runtimeWorker?.worker?.version || 'missing'),
      circuitOpen: circuit?.open === true,
      blockers: runtimeBlockers
    };
    checks.push(
      { id: 'runtime_readiness_ready', pass: value.status === 'ready', actual: readiness.status },
      { id: 'runtime_worker_healthy', pass: runtimeWorker?.status === 'healthy', actual: readiness.workerStatus },
      { id: 'runtime_worker_version_match', pass: runtimeWorker?.worker?.version === expectedVersion, actual: readiness.workerVersion },
      { id: 'runtime_circuit_closed', pass: circuit?.open === false, actual: readiness.circuitOpen },
      { id: 'runtime_blockers_empty', pass: runtimeBlockers.length === 0, actual: runtimeBlockers }
    );
  }

  const blockers = checks.filter((check) => !check.pass).map((check) => check.id);
  return {
    schemaVersion: 'question-engine-sidecar-rehearsal-evidence-v1',
    generatedAt: new Date().toISOString(),
    phase,
    status: blockers.length ? 'blocked' : 'passed',
    safety: {
      callsProvider: false,
      writesDatabase: false,
      publishesQuestions: false,
      storesRawPayloads: false,
      storesEndpointsOrSecrets: false
    },
    expected: { protocol: PROTOCOL, workerVersion: expectedVersion, capabilities: required },
    observed: {
      probe: {
        status: String(probe.status || 'missing'),
        latencyMs: Number.isFinite(Number(probe.latencyMs)) ? Number(probe.latencyMs) : null,
        protocol: String(probe.protocol || 'missing'),
        worker: worker ? { id: String(worker.id || 'missing'), version: String(worker.version || 'missing') } : null,
        capabilities: actualCapabilities,
        blockers: probeBlockers
      },
      readiness
    },
    checks,
    blockers,
    sourceDigests: input.sourceDigests || {}
  };
}

function main() {
  const args = process.argv.slice(2);
  const probeFile = valueArg(args, 'probe-file');
  if (!probeFile) throw new Error('probe_file_required');
  const probe = parseJsonFile(probeFile, 'probe_file');
  const readinessFile = valueArg(args, 'readiness-file');
  const readiness = readinessFile ? parseJsonFile(readinessFile, 'readiness_file') : null;
  const evidence = buildQuestionEngineSidecarEvidence({
    phase: valueArg(args, 'phase'),
    expectedVersion: valueArg(args, 'expected-version'),
    requiredCapabilities: valueArg(args, 'required-capabilities', 'question.generate,question.review,question.topic-map'),
    probe: probe.value,
    readiness: readiness?.value,
    sourceDigests: {
      probeSha256: probe.digest,
      ...(readiness ? { readinessSha256: readiness.digest } : {})
    }
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  const output = valueArg(args, 'output');
  if (output) fs.writeFileSync(path.resolve(output), serialized, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(serialized);
  if (evidence.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildQuestionEngineSidecarEvidence };
