const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const root = path.resolve(__dirname, '..');
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));
const baseUrl = (process.env.CSCA_READINESS_EVIDENCE_BASE_URL || process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
const token = process.env.CSCA_READINESS_EVIDENCE_TOKEN || '';
const phase = process.env.CSCA_READINESS_EVIDENCE_PHASE || process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) || 'manual';
const days = Number(process.env.CSCA_READINESS_EVIDENCE_DAYS || 30);
const stamp = `readiness-evidence-${Date.now()}`;
const forbiddenSecretValues = [
  process.env.CSCA_READINESS_EVIDENCE_TOKEN,
  process.env.ADMIN_BOOTSTRAP_PASSWORD,
  process.env.AUTH_SECRET,
  process.env.JWT_SECRET
].filter(Boolean);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretLeak(label, value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of forbiddenSecretValues) {
    if (source.includes(secret)) throw new Error(`${label} leaked a configured secret`);
  }
}

async function requestJson(pathname, authToken, options = {}) {
  assert(baseUrl, 'CSCA_READINESS_EVIDENCE_BASE_URL or SMOKE_BASE_URL is required for live evidence collection.');
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      'x-request-id': `${stamp}-${pathname.replace(/[^a-z0-9]/gi, '-')}`
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  assertNoSecretLeak(pathname, text);
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${pathname} returned non-JSON response: ${text.slice(0, 200)}`);
  }
  return { status: response.status, body };
}

async function resolveAdminToken() {
  if (!baseUrl) return '';
  if (token) return token;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return '';
  const result = await requestJson('/api/v1/auth/login', '', {
    method: 'POST',
    body: { email, password }
  });
  assert(result.status === 200 || result.status === 201, `admin login expected success, got ${result.status}`);
  assert(result.body.tokens?.accessToken, 'admin login did not return an access token');
  return result.body.tokens.accessToken;
}

function pickObservability(input) {
  const rollout = input.readinessSampledThresholdRollout || {};
  const health = input.readinessCalibrationHealth || {};
  const thresholds = input.readinessDifficultyThresholds || {};
  const actions = input.readinessActions || {};
  const evidence = input.readinessEvidence || {};
  return {
    range: input.range,
    sampledThresholdRollout: rollout,
    calibrationHealth: health,
    difficultyThresholds: thresholds,
    recommendationActions: {
      clickedCount: actions.clickedCount ?? 0,
      followedCount: actions.followedCount ?? 0,
      followThroughRate: actions.followThroughRate ?? 0,
      status: actions.status ?? 'no_data',
      byActionType: actions.byActionType ?? []
    },
    evidenceSufficiency: {
      sampleSize: evidence.sampleSize ?? 0,
      averageScore: evidence.averageScore ?? null,
      lowCount: evidence.lowCount ?? 0,
      lowRate: evidence.lowRate ?? 0,
      status: evidence.status ?? 'no_data',
      topGaps: evidence.topGaps ?? []
    }
  };
}

function buildFixtureObservability() {
  return {
    range: { from: null, to: null },
    readinessSampledThresholdRollout: {
      status: 'blocked',
      checklist: [
        { key: 'sample_size', status: 'blocked', detail: '0/3' },
        { key: 'calibration_health', status: 'pending', detail: 'fixture' },
        { key: 'impact_limit', status: 'pending', detail: 'fixture' },
        { key: 'sampled_mode', status: 'pending', detail: 'static' }
      ],
      metrics: {
        mode: 'static',
        sampledReadySubjects: 0,
        totalSubjects: 3,
        insufficientSubjects: ['math', 'physics', 'chemistry'],
        impactedUserSubjectCount: 0,
        maxImpactUserSubjectCount: 5,
        maxRecommendedCount: 0,
        minSampleSize: 8,
        blockingCalibrationAlertCount: 0
      }
    },
    readinessCalibrationHealth: {
      status: 'watching',
      snapshotCount: 0,
      latestSnapshotDate: null,
      staleDays: null,
      alerts: []
    },
    readinessDifficultyThresholds: {
      mode: 'static',
      minSampleSize: 8,
      bySubject: []
    },
    readinessActions: {
      clickedCount: 0,
      followedCount: 0,
      followThroughRate: 0,
      status: 'no_data',
      byActionType: []
    },
    readinessEvidence: {
      sampleSize: 0,
      averageScore: null,
      lowCount: 0,
      lowRate: 0,
      status: 'no_data',
      topGaps: []
    }
  };
}

function buildEvidence(observability, source) {
  const summary = pickObservability(observability);
  const rollout = summary.sampledThresholdRollout;
  return {
    kind: 'csca-readiness-sampled-threshold-evidence',
    phase,
    source,
    baseUrl: source === 'live-admin' ? baseUrl : null,
    generatedAt: new Date().toISOString(),
    days,
    conclusion: {
      rolloutStatus: rollout.status ?? 'unknown',
      launchable: rollout.status === 'ready',
      mode: rollout.metrics?.mode ?? summary.difficultyThresholds.mode ?? 'unknown',
      sampledReadySubjects: rollout.metrics?.sampledReadySubjects ?? 0,
      totalSubjects: rollout.metrics?.totalSubjects ?? 0,
      impactedUserSubjectCount: rollout.metrics?.impactedUserSubjectCount ?? 0,
      maxImpactUserSubjectCount: rollout.metrics?.maxImpactUserSubjectCount ?? null,
      calibrationHealthStatus: summary.calibrationHealth.status ?? 'unknown',
      blockingCalibrationAlertCount: rollout.metrics?.blockingCalibrationAlertCount ?? summary.calibrationHealth.alerts?.length ?? 0
    },
    checklist: rollout.checklist ?? [],
    observability: summary,
    operatorNotes: {
      expectedReview: 'Compare pre_rollout and post_rollout evidence files before keeping sampled mode enabled long-term.',
      rollbackTrigger: 'Rollback to CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=static if rollout is blocked, calibration health needs attention, impact exceeds limit, or user/support feedback regresses.'
    }
  };
}

function writeEvidence(evidence) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `csca-readiness-${phase}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const source = JSON.stringify(evidence, null, 2);
  assertNoSecretLeak('readiness evidence', source);
  fs.writeFileSync(file, `${source}\n`);
  return file;
}

async function main() {
  const authToken = await resolveAdminToken();
  const live = Boolean(baseUrl && authToken);
  const observability = live
    ? (await requestJson(`/api/v1/admin/csca-special-practice/adaptive/events/observability?days=${Number.isFinite(days) ? days : 30}`, authToken)).body
    : buildFixtureObservability();
  const evidence = buildEvidence(observability, live ? 'live-admin' : 'fixture');
  const file = writeEvidence(evidence);
  console.log(`CSCA readiness evidence written: ${file}`);
  if (!live) {
    console.log('CSCA readiness evidence used fixture mode. Set CSCA_READINESS_EVIDENCE_BASE_URL and CSCA_READINESS_EVIDENCE_TOKEN, or ADMIN_BOOTSTRAP_EMAIL/PASSWORD, for live Admin API evidence.');
  }
}

main().catch((error) => {
  console.error(`CSCA readiness evidence failed: ${error.message || error}`);
  process.exit(1);
});
