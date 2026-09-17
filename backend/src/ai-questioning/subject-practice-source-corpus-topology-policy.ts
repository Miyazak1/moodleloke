import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_POLICY_VERSION =
  'subject-practice-source-corpus-topology-policy-v1';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_EVIDENCE_SCHEMA_VERSION =
  'subject-practice-source-corpus-topology-evidence-v1';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_ATTESTATION_SCHEMA_VERSION =
  'subject-practice-source-corpus-topology-attestation-v1';

const TOPOLOGY_QUALIFICATION = Symbol('subject-practice-source-corpus-topology-qualification');
const issuedQualifications = new WeakSet<object>();

export type SubjectPracticeSourceCorpusTopologySource = {
  sourceId: string;
  kind: 'local_file' | 'database_query' | 'remote_sync';
  role: 'independent_source' | 'backup_mirror';
  canonicalSystemId: string;
  locatorFingerprintSha256: string;
  discoveryEvidenceSha256: string;
  mirrorOfSourceId: string | null;
  mirrorRelationEvidenceSha256: string | null;
  active: boolean;
};

export type SubjectPracticeSourceCorpusTopologyEvidence = {
  schemaVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_EVIDENCE_SCHEMA_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_POLICY_VERSION;
  environmentId: string;
  topologySnapshotId: string;
  discoverySurfaceIds: string[];
  sources: SubjectPracticeSourceCorpusTopologySource[];
  capturedAt: string;
  payloadSha256: string;
};

export type SubjectPracticeSourceCorpusTopologyAttestation = {
  schemaVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_ATTESTATION_SCHEMA_VERSION;
  evidencePayloadSha256: string;
  topologySnapshotId: string;
  reviewerId: string;
  keyId: string;
  issuedAt: string;
  expiresAt: string;
  signatureHmacSha256: string;
};

export type SubjectPracticeSourceCorpusTopologyQualification = {
  readonly [TOPOLOGY_QUALIFICATION]: true;
  readonly evidencePayloadSha256: string;
  readonly topologySnapshotId: string;
  readonly environmentId: string;
  readonly requiredSourceIds: readonly string[];
  readonly excludedMirrorSourceIds: readonly string[];
  readonly reviewerId: string;
  readonly keyId: string;
  readonly expiresAt: string;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalJsonValue(value))).digest('hex');
}

function validSha256(value: unknown) {
  return /^[a-f0-9]{64}$/.test(clean(value));
}

function validIsoTimestamp(value: unknown) {
  const text = clean(value);
  return Boolean(text && Number.isFinite(Date.parse(text)) && new Date(text).toISOString() === text);
}

function sortedUnique(values: readonly string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort();
}

function evidencePayload(evidence: Omit<SubjectPracticeSourceCorpusTopologyEvidence, 'payloadSha256'>) {
  return JSON.stringify(canonicalJsonValue(evidence));
}

function validateSources(sources: readonly SubjectPracticeSourceCorpusTopologySource[]) {
  const ids = sources.map((source) => clean(source.sourceId));
  if (!sources.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error('source_corpus_topology_source_ids_invalid');
  }
  const byId = new Map(sources.map((source) => [clean(source.sourceId), source]));
  const activeIndependentSystems = new Set<string>();
  let activeIndependentCount = 0;
  for (const source of sources) {
    const canonicalSystemId = clean(source.canonicalSystemId);
    if (!['local_file', 'database_query', 'remote_sync'].includes(source.kind)
      || !['independent_source', 'backup_mirror'].includes(source.role)
      || typeof source.active !== 'boolean'
      || !canonicalSystemId || !validSha256(source.locatorFingerprintSha256)
      || !validSha256(source.discoveryEvidenceSha256)) {
      throw new Error('source_corpus_topology_source_binding_invalid');
    }
    if (source.role === 'independent_source') {
      if (source.mirrorOfSourceId !== null || source.mirrorRelationEvidenceSha256 !== null) {
        throw new Error('source_corpus_topology_independent_source_cannot_be_mirror');
      }
      if (source.active) {
        activeIndependentCount += 1;
        if (activeIndependentSystems.has(canonicalSystemId)) {
          throw new Error('source_corpus_topology_duplicate_active_independent_system');
        }
        activeIndependentSystems.add(canonicalSystemId);
      }
      continue;
    }
    const primary = byId.get(clean(source.mirrorOfSourceId));
    if (!primary || primary.role !== 'independent_source' || !primary.active
      || primary.canonicalSystemId !== source.canonicalSystemId
      || !validSha256(source.mirrorRelationEvidenceSha256)) {
      throw new Error('source_corpus_topology_mirror_binding_invalid');
    }
  }
  if (!activeIndependentCount) throw new Error('source_corpus_topology_active_independent_source_missing');
}

export function buildSubjectPracticeSourceCorpusTopologyEvidence(input: {
  environmentId: string;
  topologySnapshotId: string;
  discoverySurfaceIds: string[];
  sources: SubjectPracticeSourceCorpusTopologySource[];
  capturedAt: string;
}): SubjectPracticeSourceCorpusTopologyEvidence {
  const environmentId = clean(input.environmentId);
  const topologySnapshotId = clean(input.topologySnapshotId);
  const discoverySurfaceIds = sortedUnique(input.discoverySurfaceIds);
  const sources = [...input.sources]
    .map((source) => ({ ...source, sourceId: clean(source.sourceId), canonicalSystemId: clean(source.canonicalSystemId) }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  if (!environmentId || !topologySnapshotId || !discoverySurfaceIds.length
    || discoverySurfaceIds.length !== input.discoverySurfaceIds.length
    || !validIsoTimestamp(input.capturedAt)) {
    throw new Error('source_corpus_topology_evidence_header_invalid');
  }
  validateSources(sources);
  const payload: Omit<SubjectPracticeSourceCorpusTopologyEvidence, 'payloadSha256'> = {
    schemaVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_EVIDENCE_SCHEMA_VERSION,
    policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_POLICY_VERSION,
    environmentId,
    topologySnapshotId,
    discoverySurfaceIds,
    sources,
    capturedAt: input.capturedAt
  };
  return { ...payload, payloadSha256: sha256(evidencePayload(payload)) };
}

function attestationMessage(attestation: Omit<SubjectPracticeSourceCorpusTopologyAttestation, 'signatureHmacSha256'>) {
  return JSON.stringify(canonicalJsonValue(attestation));
}

export function createSubjectPracticeSourceCorpusTopologyAttestation(input: {
  evidence: SubjectPracticeSourceCorpusTopologyEvidence;
  reviewerId: string;
  keyId: string;
  issuedAt: string;
  expiresAt: string;
  secret: string;
}): SubjectPracticeSourceCorpusTopologyAttestation {
  if (clean(input.secret).length < 32) throw new Error('source_corpus_topology_attestation_secret_too_short');
  const unsigned: Omit<SubjectPracticeSourceCorpusTopologyAttestation, 'signatureHmacSha256'> = {
    schemaVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_ATTESTATION_SCHEMA_VERSION,
    evidencePayloadSha256: input.evidence.payloadSha256,
    topologySnapshotId: input.evidence.topologySnapshotId,
    reviewerId: clean(input.reviewerId),
    keyId: clean(input.keyId),
    issuedAt: clean(input.issuedAt),
    expiresAt: clean(input.expiresAt)
  };
  if (!validSha256(unsigned.evidencePayloadSha256) || !unsigned.reviewerId || !unsigned.keyId
    || !validIsoTimestamp(unsigned.issuedAt) || !validIsoTimestamp(unsigned.expiresAt)
    || Date.parse(unsigned.expiresAt) <= Date.parse(unsigned.issuedAt)) {
    throw new Error('source_corpus_topology_attestation_invalid');
  }
  return {
    ...unsigned,
    signatureHmacSha256: createHmac('sha256', clean(input.secret))
      .update(attestationMessage(unsigned)).digest('hex')
  };
}

export function verifySubjectPracticeSourceCorpusTopologyAttestation(input: {
  evidence: SubjectPracticeSourceCorpusTopologyEvidence;
  attestation: SubjectPracticeSourceCorpusTopologyAttestation;
  secret: string;
  allowedReviewerIds: string[];
  allowedKeyIds: string[];
  now: string;
}): SubjectPracticeSourceCorpusTopologyQualification | null {
  try {
    const { payloadSha256, ...payload } = input.evidence;
    validateSources(input.evidence.sources);
    if (input.evidence.schemaVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_EVIDENCE_SCHEMA_VERSION
      || input.evidence.policyVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_POLICY_VERSION
      || sha256(evidencePayload(payload)) !== payloadSha256
      || clean(input.secret).length < 32
      || input.attestation.schemaVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_TOPOLOGY_ATTESTATION_SCHEMA_VERSION
      || input.attestation.evidencePayloadSha256 !== payloadSha256
      || input.attestation.topologySnapshotId !== input.evidence.topologySnapshotId
      || !input.allowedReviewerIds.includes(clean(input.attestation.reviewerId))
      || !input.allowedKeyIds.includes(clean(input.attestation.keyId))
      || !validIsoTimestamp(input.now) || !validIsoTimestamp(input.attestation.issuedAt)
      || !validIsoTimestamp(input.attestation.expiresAt)
      || Date.parse(input.now) < Date.parse(input.attestation.issuedAt)
      || Date.parse(input.now) >= Date.parse(input.attestation.expiresAt)
      || !validSha256(input.attestation.signatureHmacSha256)) return null;
    const unsigned: Omit<SubjectPracticeSourceCorpusTopologyAttestation, 'signatureHmacSha256'> = {
      schemaVersion: input.attestation.schemaVersion,
      evidencePayloadSha256: input.attestation.evidencePayloadSha256,
      topologySnapshotId: input.attestation.topologySnapshotId,
      reviewerId: input.attestation.reviewerId,
      keyId: input.attestation.keyId,
      issuedAt: input.attestation.issuedAt,
      expiresAt: input.attestation.expiresAt
    };
    const expected = Buffer.from(createHmac('sha256', clean(input.secret))
      .update(attestationMessage(unsigned)).digest('hex'), 'hex');
    const actual = Buffer.from(input.attestation.signatureHmacSha256, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const qualification: SubjectPracticeSourceCorpusTopologyQualification = Object.freeze({
      [TOPOLOGY_QUALIFICATION]: true as const,
      evidencePayloadSha256: payloadSha256,
      topologySnapshotId: input.evidence.topologySnapshotId,
      environmentId: input.evidence.environmentId,
      requiredSourceIds: Object.freeze(input.evidence.sources
        .filter((source) => source.active && source.role === 'independent_source')
        .map((source) => source.sourceId).sort()),
      excludedMirrorSourceIds: Object.freeze(input.evidence.sources
        .filter((source) => source.active && source.role === 'backup_mirror')
        .map((source) => source.sourceId).sort()),
      reviewerId: input.attestation.reviewerId,
      keyId: input.attestation.keyId,
      expiresAt: input.attestation.expiresAt
    });
    issuedQualifications.add(qualification);
    return qualification;
  } catch {
    return null;
  }
}

export function subjectPracticeSourceCorpusTopologyQualificationMatches(input: {
  qualification: SubjectPracticeSourceCorpusTopologyQualification | null | undefined;
  expectedEvidencePayloadSha256: string;
  expectedEnvironmentId: string;
  now: string;
}) {
  const qualification = input.qualification;
  return Boolean(qualification && issuedQualifications.has(qualification)
    && qualification[TOPOLOGY_QUALIFICATION] === true
    && qualification.evidencePayloadSha256 === input.expectedEvidencePayloadSha256
    && qualification.environmentId === clean(input.expectedEnvironmentId)
    && validIsoTimestamp(input.now)
    && Date.parse(input.now) < Date.parse(qualification.expiresAt));
}

export function requiredSubjectPracticeSourceCorpusIdsFromTopology(input: {
  qualification: SubjectPracticeSourceCorpusTopologyQualification | null | undefined;
  expectedEvidencePayloadSha256: string;
  expectedEnvironmentId: string;
  now: string;
}) {
  if (!subjectPracticeSourceCorpusTopologyQualificationMatches(input)) return null;
  return [...input.qualification!.requiredSourceIds];
}
