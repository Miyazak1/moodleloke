const crypto = require('node:crypto');
const {
  buildSubjectPracticeSourceCorpusTopologyEvidence,
  createSubjectPracticeSourceCorpusTopologyAttestation,
  verifySubjectPracticeSourceCorpusTopologyAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');

const secret = 'fixture-inventory-topology-secret-000000001';
const now = '2026-09-13T09:00:00.000Z';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function buildFixtureTopologyBinding(sourceSpecs, suffix = 'default') {
  const evidence = buildSubjectPracticeSourceCorpusTopologyEvidence({
    environmentId: `fixture-inventory-${suffix}`,
    topologySnapshotId: `fixture-inventory-topology-${suffix}`,
    discoverySurfaceIds: ['fixture-source-registry'],
    sources: sourceSpecs.map((spec) => ({
      sourceId: spec.sourceId,
      kind: spec.kind,
      role: spec.role ?? 'independent_source',
      canonicalSystemId: spec.canonicalSystemId ?? `fixture-system-${spec.sourceId}`,
      locatorFingerprintSha256: hash(`locator:${suffix}:${spec.sourceId}`),
      discoveryEvidenceSha256: hash(`discovery:${suffix}:${spec.sourceId}`),
      mirrorOfSourceId: spec.mirrorOfSourceId ?? null,
      mirrorRelationEvidenceSha256: spec.role === 'backup_mirror'
        ? hash(`mirror:${suffix}:${spec.sourceId}:${spec.mirrorOfSourceId}`) : null,
      active: spec.active ?? true
    })),
    capturedAt: '2026-09-13T08:00:00.000Z'
  });
  const attestation = createSubjectPracticeSourceCorpusTopologyAttestation({
    evidence,
    reviewerId: 'fixture-inventory-topology-reviewer',
    keyId: 'fixture-inventory-topology-key',
    issuedAt: '2026-09-13T08:05:00.000Z',
    expiresAt: '2026-09-14T08:05:00.000Z',
    secret
  });
  const qualification = verifySubjectPracticeSourceCorpusTopologyAttestation({
    evidence,
    attestation,
    secret,
    allowedReviewerIds: ['fixture-inventory-topology-reviewer'],
    allowedKeyIds: ['fixture-inventory-topology-key'],
    now
  });
  if (!qualification) throw new Error('fixture_inventory_topology_qualification_missing');
  return {
    evidence,
    qualification,
    topology: {
      qualification,
      expectedEvidencePayloadSha256: evidence.payloadSha256,
      expectedEnvironmentId: evidence.environmentId,
      now
    }
  };
}

module.exports = { buildFixtureTopologyBinding };
