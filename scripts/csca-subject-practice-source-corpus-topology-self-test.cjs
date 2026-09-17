#!/usr/bin/env node

if (require.main === module) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const {
  buildSubjectPracticeSourceCorpusTopologyEvidence,
  createSubjectPracticeSourceCorpusTopologyAttestation,
  requiredSubjectPracticeSourceCorpusIdsFromTopology,
  subjectPracticeSourceCorpusTopologyQualificationMatches,
  verifySubjectPracticeSourceCorpusTopologyAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');

const secret = 'fixture-source-topology-secret-0000000001';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function source(sourceId, kind, role, canonicalSystemId, mirrorOfSourceId = null) {
  return {
    sourceId,
    kind,
    role,
    canonicalSystemId,
    locatorFingerprintSha256: hash(`locator:${sourceId}`),
    discoveryEvidenceSha256: hash(`discovery:${sourceId}`),
    mirrorOfSourceId,
    mirrorRelationEvidenceSha256: role === 'backup_mirror' ? hash(`mirror:${sourceId}:${mirrorOfSourceId}`) : null,
    active: true
  };
}

function evidenceFor(sources) {
  return buildSubjectPracticeSourceCorpusTopologyEvidence({
    environmentId: 'fixture-production',
    topologySnapshotId: 'fixture-topology-1',
    discoverySurfaceIds: ['repository-source-registry', 'database-schema-inventory', 'deployment-storage-config'],
    sources,
    capturedAt: '2026-09-13T08:00:00.000Z'
  });
}

function qualificationFor(evidence, override = {}) {
  const attestation = createSubjectPracticeSourceCorpusTopologyAttestation({
    evidence,
    reviewerId: 'fixture-topology-reviewer',
    keyId: 'fixture-topology-key-1',
    issuedAt: '2026-09-13T08:05:00.000Z',
    expiresAt: '2026-09-14T08:05:00.000Z',
    secret
  });
  return verifySubjectPracticeSourceCorpusTopologyAttestation({
    evidence,
    attestation,
    secret,
    allowedReviewerIds: ['fixture-topology-reviewer'],
    allowedKeyIds: ['fixture-topology-key-1'],
    now: '2026-09-13T09:00:00.000Z',
    ...override
  });
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

function runSelfTest() {
  const evidence = evidenceFor([
    source('local_repository_source_json', 'local_file', 'independent_source', 'local-curated-source'),
    source('production_csca_source_questions', 'database_query', 'independent_source', 'production-source-db'),
    source('online_database_dump', 'remote_sync', 'backup_mirror', 'production-source-db', 'production_csca_source_questions')
  ]);
  const qualification = qualificationFor(evidence);
  const requiredSourceIds = requiredSubjectPracticeSourceCorpusIdsFromTopology({
    qualification,
    expectedEvidencePayloadSha256: evidence.payloadSha256,
    expectedEnvironmentId: 'fixture-production',
    now: '2026-09-13T09:00:00.000Z'
  });
  const copiedQualification = qualification ? { ...qualification } : null;
  const tamperedEvidence = {
    ...evidence,
    sources: evidence.sources.filter((entry) => entry.sourceId !== 'production_csca_source_questions')
  };
  const checks = {
    signedTopologyQualifies: Boolean(qualification),
    requiredSetDerivedNotCallerSupplied: JSON.stringify(requiredSourceIds) === JSON.stringify([
      'local_repository_source_json', 'production_csca_source_questions'
    ]),
    backupMirrorExcluded: qualification?.excludedMirrorSourceIds.includes('online_database_dump') === true
      && !requiredSourceIds?.includes('online_database_dump'),
    copiedQualificationRejected: !subjectPracticeSourceCorpusTopologyQualificationMatches({
      qualification: copiedQualification,
      expectedEvidencePayloadSha256: evidence.payloadSha256,
      expectedEnvironmentId: 'fixture-production',
      now: '2026-09-13T09:00:00.000Z'
    }),
    tamperedEvidenceRejected: qualificationFor(tamperedEvidence) === null,
    wrongSecretRejected: qualificationFor(evidence, { secret: 'wrong-secret-that-is-still-long-enough-0001' }) === null,
    expiredAttestationRejected: qualificationFor(evidence, { now: '2026-09-15T09:00:00.000Z' }) === null,
    orphanMirrorRejected: throws(() => evidenceFor([
      source('local', 'local_file', 'independent_source', 'local'),
      source('orphan-dump', 'remote_sync', 'backup_mirror', 'missing', 'missing-primary')
    ])),
    mirrorCanonicalSystemMismatchRejected: throws(() => evidenceFor([
      source('database', 'database_query', 'independent_source', 'database-system'),
      source('dump', 'remote_sync', 'backup_mirror', 'other-system', 'database')
    ])),
    duplicateIndependentSystemRejected: throws(() => evidenceFor([
      source('database-a', 'database_query', 'independent_source', 'same-system'),
      source('database-b', 'remote_sync', 'independent_source', 'same-system')
    ])),
    invalidRuntimeSourceKindRejected: throws(() => evidenceFor([
      { ...source('unknown', 'local_file', 'independent_source', 'unknown-system'), kind: 'caller_invented' }
    ])),
    missingDiscoverySurfaceRejected: throws(() => buildSubjectPracticeSourceCorpusTopologyEvidence({
      environmentId: 'fixture-production',
      topologySnapshotId: 'fixture-topology-2',
      discoverySurfaceIds: [],
      sources: [source('local', 'local_file', 'independent_source', 'local')],
      capturedAt: '2026-09-13T08:00:00.000Z'
    }))
  };
  return {
    mode: 'subject_practice_source_corpus_topology_self_test',
    reportVersion: 'subject-practice-source-corpus-topology-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    fixtureRequiredSourceIds: requiredSourceIds,
    fixtureExcludedMirrorSourceIds: qualification?.excludedMirrorSourceIds ?? [],
    realTopologyQualificationPresent: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

const report = runSelfTest();
if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report, runSelfTest };
