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
  buildSubjectPracticeSourceCorpusTopologyEvidence
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');

const MODE = 'subject_practice_source_corpus_topology_review_score_v1';
const PRIMARY_SURFACE_KEYS = Object.freeze([
  'repositorySourceRegistryAndFilesReviewed',
  'productionDatabaseSchemaAndInventoryReviewed',
  'deploymentStorageConfigurationReviewed',
  'runtimeRemoteSyncImplementationReviewed',
  'backupAndRestoreTopologyReviewed'
]);
const RESPONSE_KEYS = Object.freeze([
  'schemaVersion', 'topologyEvidencePayloadSha256', 'reviewerId', 'primarySurfaceReview',
  'confirmsAllActiveIndependentSourcesListed', 'confirmsBackupMirrorClassification',
  'decision', 'notes', 'lockedAt'
]);

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
  const serialized = Buffer.isBuffer(value) ? value
    : typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(text(value));
}

function validIsoTimestamp(value) {
  const normalized = text(value);
  return Boolean(normalized && Number.isFinite(Date.parse(normalized))
    && new Date(normalized).toISOString() === normalized);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function payloadValid(artifact) {
  if (!artifact || !validSha256(artifact.payloadSha256)) return false;
  const { payloadSha256, ...payload } = artifact;
  return sha256(payload) === payloadSha256;
}

function evidenceValid(evidence) {
  try {
    const rebuilt = buildSubjectPracticeSourceCorpusTopologyEvidence({
      environmentId: evidence.environmentId,
      topologySnapshotId: evidence.topologySnapshotId,
      discoverySurfaceIds: evidence.discoverySurfaceIds,
      sources: evidence.sources,
      capturedAt: evidence.capturedAt
    });
    return rebuilt.payloadSha256 === evidence.payloadSha256
      && rebuilt.schemaVersion === evidence.schemaVersion
      && rebuilt.policyVersion === evidence.policyVersion;
  } catch {
    return false;
  }
}

function scoreReview({ manifest, evidence, template, response }) {
  const invalidReasons = [];
  if (manifest?.schemaVersion !== 'subject-practice-source-corpus-topology-review-manifest-v1'
    || manifest.mode !== 'subject_practice_source_corpus_topology_review_export_v1'
    || !payloadValid(manifest)) invalidReasons.push('topology_review_manifest_invalid');
  if (!evidenceValid(evidence)
    || manifest?.topologyEvidencePayloadSha256 !== evidence?.payloadSha256) {
    invalidReasons.push('topology_review_evidence_invalid_or_unbound');
  }
  if (template?.schemaVersion !== 'subject-practice-source-corpus-topology-review-response-v1'
    || !exactKeys(template, RESPONSE_KEYS)
    || !exactKeys(template.primarySurfaceReview, PRIMARY_SURFACE_KEYS)
    || sha256(template) !== manifest?.reviewResponseTemplateSha256
    || template.topologyEvidencePayloadSha256 !== evidence?.payloadSha256) {
    invalidReasons.push('topology_review_template_invalid_or_unbound');
  }
  if (!exactKeys(response, RESPONSE_KEYS)
    || !exactKeys(response?.primarySurfaceReview, PRIMARY_SURFACE_KEYS)
    || response?.schemaVersion !== template?.schemaVersion
    || response?.topologyEvidencePayloadSha256 !== evidence?.payloadSha256) {
    invalidReasons.push('topology_review_response_shape_or_binding_invalid');
  }
  if (response?.lockedAt !== null && !validIsoTimestamp(response.lockedAt)) {
    invalidReasons.push('topology_review_locked_at_invalid');
  }
  if (validIsoTimestamp(response?.lockedAt) && validIsoTimestamp(evidence?.capturedAt)
    && Date.parse(response.lockedAt) < Date.parse(evidence.capturedAt)) {
    invalidReasons.push('topology_review_locked_before_evidence_capture');
  }
  if (invalidReasons.length) {
    return result('invalid_review_evidence', false, invalidReasons, manifest, evidence, response);
  }

  const incompleteReasons = [];
  if (!text(response.reviewerId)) incompleteReasons.push('topology_review_reviewer_missing');
  if (!validIsoTimestamp(response.lockedAt)) incompleteReasons.push('topology_review_not_locked');
  for (const key of PRIMARY_SURFACE_KEYS) {
    if (response.primarySurfaceReview[key] !== true) {
      incompleteReasons.push(`topology_review_primary_surface_unconfirmed:${key}`);
    }
  }
  if (response.confirmsAllActiveIndependentSourcesListed !== true) {
    incompleteReasons.push('topology_review_independent_source_set_unconfirmed');
  }
  if (response.confirmsBackupMirrorClassification !== true) {
    incompleteReasons.push('topology_review_backup_mirror_classification_unconfirmed');
  }
  if (response.decision !== 'approve_for_attestation') {
    incompleteReasons.push('topology_review_decision_not_approved');
  }
  if (incompleteReasons.length) {
    return result('review_incomplete', false, incompleteReasons, manifest, evidence, response);
  }
  return result('approved_for_separate_attestation', true, [], manifest, evidence, response);
}

function result(status, reviewQualified, reasonCodes, manifest, evidence, response) {
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-topology-review-score-v1',
    mode: MODE,
    status,
    reviewQualified,
    reasonCodes,
    topologyEvidencePayloadSha256: evidence?.payloadSha256 ?? '',
    reviewManifestPayloadSha256: manifest?.payloadSha256 ?? '',
    reviewResponseSha256: sha256(response ?? {}),
    reviewerId: text(response?.reviewerId),
    lockedAt: validIsoTimestamp(response?.lockedAt) ? response.lockedAt : null,
    topologyAttestationIssued: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_local_artifacts_only',
    publicationImpact: 'none'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    issuesAttestation: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function fixture() {
  const hash = (value) => sha256(value);
  const evidence = buildSubjectPracticeSourceCorpusTopologyEvidence({
    environmentId: 'fixture-production',
    topologySnapshotId: 'fixture-topology-review',
    discoverySurfaceIds: ['fixture-registry'],
    sources: [{
      sourceId: 'local', kind: 'local_file', role: 'independent_source',
      canonicalSystemId: 'local-system', locatorFingerprintSha256: hash('locator'),
      discoveryEvidenceSha256: hash('discovery'), mirrorOfSourceId: null,
      mirrorRelationEvidenceSha256: null, active: true
    }],
    capturedAt: '2026-09-13T08:00:00.000Z'
  });
  const template = {
    schemaVersion: 'subject-practice-source-corpus-topology-review-response-v1',
    topologyEvidencePayloadSha256: evidence.payloadSha256,
    reviewerId: '',
    primarySurfaceReview: Object.fromEntries(PRIMARY_SURFACE_KEYS.map((key) => [key, false])),
    confirmsAllActiveIndependentSourcesListed: false,
    confirmsBackupMirrorClassification: false,
    decision: 'needs_primary_topology_review',
    notes: '',
    lockedAt: null
  };
  const manifestPayload = {
    schemaVersion: 'subject-practice-source-corpus-topology-review-manifest-v1',
    mode: 'subject_practice_source_corpus_topology_review_export_v1',
    topologyEvidencePayloadSha256: evidence.payloadSha256,
    reviewResponseTemplateSha256: sha256(template)
  };
  const manifest = { ...manifestPayload, payloadSha256: sha256(manifestPayload) };
  const approved = {
    ...template,
    reviewerId: 'fixture-human-reviewer',
    primarySurfaceReview: Object.fromEntries(PRIMARY_SURFACE_KEYS.map((key) => [key, true])),
    confirmsAllActiveIndependentSourcesListed: true,
    confirmsBackupMirrorClassification: true,
    decision: 'approve_for_attestation',
    lockedAt: '2026-09-13T09:00:00.000Z'
  };
  return { evidence, template, manifest, approved };
}

function runSelfTest() {
  const { evidence, template, manifest, approved } = fixture();
  const positive = scoreReview({ manifest, evidence, template, response: approved });
  const blank = scoreReview({ manifest, evidence, template, response: template });
  const tamperedEvidence = scoreReview({
    manifest, evidence: { ...evidence, environmentId: 'tampered' }, template, response: approved
  });
  const missingSurface = scoreReview({
    manifest, evidence, template,
    response: {
      ...approved,
      primarySurfaceReview: { ...approved.primarySurfaceReview, runtimeRemoteSyncImplementationReviewed: false }
    }
  });
  const earlyLock = scoreReview({
    manifest, evidence, template,
    response: { ...approved, lockedAt: '2026-09-13T07:00:00.000Z' }
  });
  const checks = {
    completeLockedReviewPasses: positive.status === 'approved_for_separate_attestation'
      && positive.reviewQualified === true,
    scorerNeverIssuesAttestation: positive.topologyAttestationIssued === false
      && positive.formalReleaseEligible === false,
    blankTemplateRemainsIncomplete: blank.status === 'review_incomplete'
      && blank.reviewQualified === false,
    everyPrimarySurfaceRequired: missingSurface.status === 'review_incomplete',
    tamperedEvidenceRejected: tamperedEvidence.status === 'invalid_review_evidence',
    lockBeforeCaptureRejected: earlyLock.status === 'invalid_review_evidence',
    responseBindingIsHashed: validSha256(positive.reviewResponseSha256),
    defaultPreflightIsSideEffectFree: preflight().status === 'preflight_only_no_files_read_or_written'
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-topology-review-score-self-test-v1',
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
    throw new Error('source_corpus_topology_review_score_path_invalid');
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
  const names = ['manifest', 'evidence', 'template', 'response'];
  const args = Object.fromEntries(names.map((name) => [name, argValue(name)]));
  if (names.some((name) => !args[name])) throw new Error('source_corpus_topology_review_score_input_missing');
  const score = scoreReview(Object.fromEntries(names.map((name) => [
    name, JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, args[name]), 'utf8'))
  ])));
  const out = argValue('out');
  if (!out) return score;
  const outputPath = workspaceJson(workspaceRoot, out, true);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(score, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...score, outputPath };
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'invalid_review_evidence') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { MODE, scoreReview, preflight, runSelfTest, fixture };
