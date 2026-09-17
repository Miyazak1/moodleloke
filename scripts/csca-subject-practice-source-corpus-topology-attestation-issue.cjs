#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  createSubjectPracticeSourceCorpusTopologyAttestation,
  verifySubjectPracticeSourceCorpusTopologyAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');
const {
  scoreReview,
  fixture: reviewFixture
} = require('./csca-subject-practice-source-corpus-topology-review-score.cjs');

const MODE = 'subject_practice_source_corpus_topology_attestation_issue_v1';
const MAXIMUM_ATTESTATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function validIsoTimestamp(value) {
  const normalized = text(value);
  return Boolean(normalized && Number.isFinite(Date.parse(normalized))
    && new Date(normalized).toISOString() === normalized);
}

function list(value) {
  return Array.from(new Set(text(value).split(',').map((item) => item.trim()).filter(Boolean)));
}

function issueTopologyAttestation(input) {
  const reviewScore = scoreReview({
    manifest: input.manifest,
    evidence: input.evidence,
    template: input.template,
    response: input.response
  });
  if (reviewScore.status !== 'approved_for_separate_attestation' || reviewScore.reviewQualified !== true) {
    throw new Error('source_corpus_topology_attestation_review_not_approved');
  }
  const reviewerId = text(input.response.reviewerId);
  const keyId = text(input.keyId);
  if (!input.allowedReviewerIds.includes(reviewerId) || !input.allowedKeyIds.includes(keyId)) {
    throw new Error('source_corpus_topology_attestation_identity_not_allowed');
  }
  if (text(input.secret).length < 32) {
    throw new Error('source_corpus_topology_attestation_secret_missing_or_too_short');
  }
  if (!validIsoTimestamp(input.issuedAt) || !validIsoTimestamp(input.expiresAt)
    || Date.parse(input.issuedAt) < Date.parse(input.response.lockedAt)
    || Date.parse(input.expiresAt) <= Date.parse(input.issuedAt)
    || Date.parse(input.expiresAt) - Date.parse(input.issuedAt) > MAXIMUM_ATTESTATION_LIFETIME_MS) {
    throw new Error('source_corpus_topology_attestation_time_window_invalid');
  }
  const attestation = createSubjectPracticeSourceCorpusTopologyAttestation({
    evidence: input.evidence,
    reviewerId,
    keyId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    secret: input.secret
  });
  const qualification = verifySubjectPracticeSourceCorpusTopologyAttestation({
    evidence: input.evidence,
    attestation,
    secret: input.secret,
    allowedReviewerIds: input.allowedReviewerIds,
    allowedKeyIds: input.allowedKeyIds,
    now: input.issuedAt
  });
  if (!qualification) throw new Error('source_corpus_topology_attestation_post_issue_verification_failed');
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-topology-attestation-issue-v1',
    mode: MODE,
    status: 'attestation_issued_for_downstream_reverification',
    topologyEvidencePayloadSha256: input.evidence.payloadSha256,
    reviewScorePayloadSha256: reviewScore.payloadSha256,
    reviewResponseSha256: reviewScore.reviewResponseSha256,
    reviewerId,
    keyId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    requiredSourceIds: [...qualification.requiredSourceIds],
    excludedMirrorSourceIds: [...qualification.excludedMirrorSourceIds],
    attestation,
    qualificationSerialized: false,
    requiresDownstreamAttestationReverification: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_local_artifacts_only',
    publicationImpact: 'none'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function preflight(env = process.env) {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    topologySecretConfigured: text(env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET).length >= 32,
    reviewerAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS).length > 0,
    keyAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS).length > 0,
    maximumAttestationLifetimeHours: MAXIMUM_ATTESTATION_LIFETIME_MS / 3600000,
    issuesQualificationArtifact: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

function runSelfTest() {
  const { evidence, template, manifest, approved } = reviewFixture();
  const secret = 'fixture-topology-issuer-secret-0000000001';
  const base = {
    manifest, evidence, template, response: approved,
    keyId: 'fixture-topology-key',
    allowedReviewerIds: ['fixture-human-reviewer'],
    allowedKeyIds: ['fixture-topology-key'],
    issuedAt: '2026-09-13T09:05:00.000Z',
    expiresAt: '2026-09-20T09:05:00.000Z',
    secret
  };
  const issued = issueTopologyAttestation(base);
  const checks = {
    approvedReviewCanIssueBoundAttestation: issued.status === 'attestation_issued_for_downstream_reverification'
      && issued.topologyEvidencePayloadSha256 === evidence.payloadSha256,
    requiredSetDerivedFromOpaqueQualification: JSON.stringify(issued.requiredSourceIds) === JSON.stringify(['local']),
    qualificationIsNeverSerialized: issued.qualificationSerialized === false
      && !Object.keys(issued).includes('qualification'),
    downstreamMustReverify: issued.requiresDownstreamAttestationReverification === true,
    blankReviewRejected: throws(() => issueTopologyAttestation({ ...base, response: template })),
    reviewerOutsideAllowlistRejected: throws(() => issueTopologyAttestation({
      ...base, allowedReviewerIds: ['different-reviewer']
    })),
    keyOutsideAllowlistRejected: throws(() => issueTopologyAttestation({
      ...base, allowedKeyIds: ['different-key']
    })),
    shortSecretRejected: throws(() => issueTopologyAttestation({ ...base, secret: 'too-short' })),
    issueBeforeReviewLockRejected: throws(() => issueTopologyAttestation({
      ...base, issuedAt: '2026-09-13T08:30:00.000Z'
    })),
    lifetimeAboveSevenDaysRejected: throws(() => issueTopologyAttestation({
      ...base, expiresAt: '2026-09-20T09:05:00.001Z'
    })),
    secretNeverSerialized: !JSON.stringify(issued).includes(secret),
    defaultPreflightDoesNotIssue: preflight({}).status === 'preflight_only_no_files_read_or_written'
      && preflight({}).issuesQualificationArtifact === false
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-topology-attestation-issue-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

function workspaceJson(workspaceRoot, value, mustBeNew = false) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (mustBeNew ? fs.existsSync(target) : !fs.existsSync(target))) {
    throw new Error('source_corpus_topology_attestation_issue_path_invalid');
  }
  return target;
}

function argValue(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest();
  if (!process.argv.includes('--execute')) return preflight();
  const workspaceRoot = process.cwd();
  const fileNames = ['manifest', 'evidence', 'template', 'response'];
  const fileArgs = Object.fromEntries(fileNames.map((name) => [name, argValue(name)]));
  const keyId = argValue('key-id');
  const issuedAt = argValue('issued-at');
  const expiresAt = argValue('expires-at');
  const out = argValue('out');
  if (fileNames.some((name) => !fileArgs[name]) || !keyId || !issuedAt || !expiresAt || !out) {
    throw new Error('source_corpus_topology_attestation_issue_required_argument_missing');
  }
  const env = process.env;
  const issued = issueTopologyAttestation({
    ...Object.fromEntries(fileNames.map((name) => [
      name, JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, fileArgs[name]), 'utf8'))
    ])),
    keyId,
    issuedAt,
    expiresAt,
    secret: env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET,
    allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS),
    allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS)
  });
  const outputPath = workspaceJson(workspaceRoot, out, true);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(issued, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...issued, outputPath };
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { MODE, issueTopologyAttestation, preflight, runSelfTest };
