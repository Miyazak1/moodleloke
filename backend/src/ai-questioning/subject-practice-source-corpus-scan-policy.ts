import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  requiredSubjectPracticeSourceCorpusIdsFromTopology,
  SubjectPracticeSourceCorpusTopologyQualification
} from './subject-practice-source-corpus-topology-policy';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION =
  'subject-practice-source-corpus-scan-policy-v4';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION =
  'subject-practice-source-corpus-normalization-v2';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION =
  'subject-practice-source-corpus-fieldwise-fivegram-source-coverage-adaptive-contiguous-v2';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION =
  'subject-practice-source-corpus-threshold-v2';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_ATTESTATION_VERSION =
  'subject-practice-source-corpus-scan-attestation-v2';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION =
  'subject-practice-source-corpus-builder-v5';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION =
  'subject-practice-source-corpus-inventory-v2';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION =
  'subject-practice-source-corpus-canonicalization-v1';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_CALIBRATION_VERSION =
  'subject-practice-source-corpus-threshold-calibration-v1';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_TARGET_FIELDS = Object.freeze({
  profile_asset_admission: ['approved_profile_asset'],
  generator_projection: ['system', 'user'],
  candidate_output: ['candidate_prompt', 'candidate_options']
} as const);

export const SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS = Object.freeze({
  maximumFiveGramSimilarity: 0.82,
  maximumSourceCoverage: 0.75,
  maximumContiguousMatchCharacters: 32,
  maximumContiguousSourceRatio: 0.8,
  maximumMatchedCount: 0,
  minimumComparableCharacters: 12
});

const TRUSTED_SCAN_PROOF = Symbol('subject-practice-source-corpus-scan-proof');
const VERIFIED_SCAN_QUALIFICATION = Symbol('subject-practice-source-corpus-scan-qualification');

export type SubjectPracticeSourceCorpusScanEvidence = {
  schemaVersion: 'subject-practice-source-corpus-scan-evidence-v1';
  layer: 'profile_asset_admission' | 'generator_projection' | 'candidate_output';
  subject: 'math' | 'physics' | 'chemistry';
  targetContentSha256: string;
  providerProjectionSha256: string | null;
  sourceCorpusSnapshotId: string;
  sourceCorpusSnapshotSha256: string;
  sourceCorpusEntryCount: number;
  corpusCoverageStatus: 'all_system_known_source_exam_reference' | 'partial';
  corpusBuilderVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION;
  corpusInventorySchemaVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION;
  corpusCanonicalizationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION;
  inventoryManifestSha256: string;
  corpusFieldCoverage: {
    prompt: boolean;
    options: boolean;
    answer: boolean;
    explanation: boolean;
    localizations: boolean;
  };
  corpusSubjectCounts: Record<string, number>;
  corpusLanguageCounts: Record<string, number>;
  targetFieldNames: string[];
  requiredLanguages: string[];
  thresholdCalibrationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_CALIBRATION_VERSION;
  thresholdCalibrationStatus: 'three_subject_labeled_calibration_passed' | 'fixture_only';
  scannerPolicyVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION;
  normalizationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION;
  matchingAlgorithmVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION;
  thresholdVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION;
  maxSimilarity: number;
  maxSourceCoverage: number;
  maxContiguousMatch: number;
  matchedCount: number;
  status: 'pass' | 'fail';
  scannedAt: string;
  payloadSha256: string;
};

export type SubjectPracticeSourceCorpusScanAttestation = {
  schemaVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_ATTESTATION_VERSION;
  evidencePayloadSha256: string;
  sourceCorpusSnapshotSha256: string;
  scannerId: string;
  keyId: string;
  layer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  subject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  targetContentSha256: string;
  providerProjectionSha256: string | null;
  issuedAt: string;
  expiresAt: string;
  signatureHmacSha256: string;
};

export type SubjectPracticeSourceCorpusScanTrustedProof = {
  readonly [TRUSTED_SCAN_PROOF]: true;
  readonly evidencePayloadSha256: string;
  readonly sourceCorpusSnapshotSha256: string;
  readonly scannerId: string;
  readonly keyId: string;
  readonly layer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  readonly subject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  readonly targetContentSha256: string;
  readonly providerProjectionSha256: string | null;
  readonly expiresAt: string;
};

export type SubjectPracticeSourceCorpusScanQualification = {
  readonly [VERIFIED_SCAN_QUALIFICATION]: true;
  readonly layer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  readonly subject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  readonly targetContentSha256: string;
  readonly providerProjectionSha256: string | null;
  readonly sourceCorpusSnapshotId: string;
  readonly sourceCorpusSnapshotSha256: string;
  readonly scannerPolicyVersion: string;
};

export type SubjectPracticeSourceCorpusInventorySource = {
  sourceId: string;
  kind: 'local_file' | 'database_query' | 'remote_sync';
  locatorFingerprintSha256: string;
  expectedCount: number;
  observedCount: number;
  highWatermark: string;
  updatedAt: string;
  extractedFields: string[];
  status: 'complete' | 'failed';
};

export type SubjectPracticeSourceCorpusInventoryManifest = {
  schemaVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION;
  canonicalizationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION;
  builderVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION;
  topologyEvidencePayloadSha256: string;
  topologySnapshotId: string;
  requiredSourceDerivation: 'signed_topology_qualification' | 'caller_declared_unqualified';
  requiredSourceIds: string[];
  sources: SubjectPracticeSourceCorpusInventorySource[];
  coverageStatus: 'all_system_known_source_exam_reference' | 'partial';
  reasonCodes: string[];
  manifestSha256: string;
};

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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function validSha256(value: unknown) {
  return /^[a-f0-9]{64}$/.test(clean(value));
}

function validIsoTimestamp(value: unknown) {
  const text = clean(value);
  return Boolean(text && Number.isFinite(Date.parse(text)) && new Date(text).toISOString() === text);
}

function exactStringSet(left: readonly string[], right: readonly string[]) {
  const normalizedLeft = Array.from(new Set(left.map(clean).filter(Boolean))).sort();
  const normalizedRight = Array.from(new Set(right.map(clean).filter(Boolean))).sort();
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function buildSubjectPracticeSourceCorpusInventoryManifest(input: {
  requiredSourceIds?: string[];
  sources: SubjectPracticeSourceCorpusInventorySource[];
  topology?: {
    qualification: SubjectPracticeSourceCorpusTopologyQualification | null | undefined;
    expectedEvidencePayloadSha256: string;
    expectedEnvironmentId: string;
    now: string;
  };
}): SubjectPracticeSourceCorpusInventoryManifest {
  const topologyRequiredSourceIds = input.topology
    ? requiredSubjectPracticeSourceCorpusIdsFromTopology(input.topology) : null;
  const callerRequiredSourceIds = Array.from(new Set((input.requiredSourceIds ?? []).map(clean).filter(Boolean))).sort();
  const requiredSourceIds = topologyRequiredSourceIds ?? callerRequiredSourceIds;
  const sources = [...input.sources].sort((left, right) => clean(left.sourceId).localeCompare(clean(right.sourceId)));
  const reasonCodes: string[] = [];
  if (!topologyRequiredSourceIds) reasonCodes.push('source_corpus_inventory_topology_qualification_missing');
  if (topologyRequiredSourceIds && input.requiredSourceIds
    && !exactStringSet(callerRequiredSourceIds, topologyRequiredSourceIds)) {
    reasonCodes.push('source_corpus_inventory_caller_required_sources_disagree_with_topology');
  }
  if (!requiredSourceIds.length) reasonCodes.push('source_corpus_inventory_required_sources_missing');
  if (new Set(sources.map((source) => clean(source.sourceId))).size !== sources.length) {
    reasonCodes.push('source_corpus_inventory_duplicate_source');
  }
  if (!exactStringSet(sources.map((source) => source.sourceId), requiredSourceIds)) {
    reasonCodes.push('source_corpus_inventory_source_set_mismatch');
  }
  for (const sourceId of requiredSourceIds) {
    const source = sources.find((entry) => clean(entry.sourceId) === sourceId);
    if (!source) { reasonCodes.push('source_corpus_inventory_source_missing'); continue; }
    if (source.status !== 'complete') reasonCodes.push('source_corpus_inventory_source_failed');
    if (!validSha256(source.locatorFingerprintSha256)) reasonCodes.push('source_corpus_inventory_locator_hash_invalid');
    if (!Number.isInteger(source.expectedCount) || source.expectedCount < 0
      || !Number.isInteger(source.observedCount) || source.observedCount < 0
      || source.expectedCount !== source.observedCount) reasonCodes.push('source_corpus_inventory_count_mismatch');
    if (!clean(source.highWatermark) || !validIsoTimestamp(source.updatedAt)) {
      reasonCodes.push('source_corpus_inventory_freshness_missing');
    }
    if (!exactStringSet(source.extractedFields, ['prompt', 'options', 'answer', 'explanation', 'localizations'])) {
      reasonCodes.push('source_corpus_inventory_field_coverage_incomplete');
    }
  }
  const payload: Omit<SubjectPracticeSourceCorpusInventoryManifest, 'manifestSha256'> = {
    schemaVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION,
    canonicalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION,
    builderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    topologyEvidencePayloadSha256: topologyRequiredSourceIds
      ? clean(input.topology?.expectedEvidencePayloadSha256) : '',
    topologySnapshotId: topologyRequiredSourceIds
      ? clean(input.topology?.qualification?.topologySnapshotId) : '',
    requiredSourceDerivation: topologyRequiredSourceIds
      ? 'signed_topology_qualification' as const : 'caller_declared_unqualified' as const,
    requiredSourceIds,
    sources,
    coverageStatus: reasonCodes.length ? 'partial' as const : 'all_system_known_source_exam_reference' as const,
    reasonCodes: Array.from(new Set(reasonCodes)).sort()
  };
  return {
    ...payload,
    manifestSha256: sha256(JSON.stringify(canonicalJsonValue(payload)))
  };
}

export function normalizeSubjectPracticeSourceCorpusText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[⇌↔]/g, ' reversiblearrow ')
    .replace(/[→⟶]/g, ' arrow ')
    .replace(/≥|>=/g, ' greaterorequal ')
    .replace(/≤|<=/g, ' lessorequal ')
    .replace(/≠|!=/g, ' notequal ')
    .replace(/[−–—-]/g, ' minus ')
    .replace(/[×·⋅*]/g, ' times ')
    .replace(/[÷/]/g, ' divide ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equal ')
    .replace(/[\p{P}\s]+/gu, '');
}

function ngrams(value: string, size = 5) {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) result.add(value.slice(index, index + size));
  return result;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function longestContiguousMatch(left: string, right: string, cap = 256) {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  const maximum = Math.min(shorter.length, cap);
  let low = 0;
  let high = maximum;
  while (low < high) {
    const length = Math.ceil((low + high + 1) / 2);
    const chunks = new Set<string>();
    for (let index = 0; index <= shorter.length - length; index += 1) chunks.add(shorter.slice(index, index + length));
    let found = false;
    for (let index = 0; index <= longer.length - length; index += 1) {
      if (chunks.has(longer.slice(index, index + length))) { found = true; break; }
    }
    if (found) low = length; else high = length - 1;
  }
  return low;
}

export function scanSubjectPracticeContentAgainstSourceCorpus(input: {
  targetText?: string;
  targetFields?: Array<{ field: string; text: string }>;
  sourceTexts: string[];
}) {
  const targetFields = input.targetFields?.length
    ? input.targetFields
    : [{ field: 'target', text: String(input.targetText ?? '') }];
  const normalizedTargetFields = targetFields.map((targetField) => {
    const text = normalizeSubjectPracticeSourceCorpusText(targetField.text);
    return { field: targetField.field, text, ngrams: ngrams(text) };
  });
  let maxSimilarity = 0;
  let maxSourceCoverage = 0;
  let maxContiguousMatch = 0;
  let matchedCount = 0;
  for (const rawSource of input.sourceTexts) {
    const source = normalizeSubjectPracticeSourceCorpusText(rawSource);
    if (source.length < SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters) continue;
    const sourceNgrams = ngrams(source);
    let sourceMatched = false;
    for (const targetField of normalizedTargetFields) {
      const similarity = jaccard(targetField.ngrams, sourceNgrams);
      let intersection = 0;
      for (const item of sourceNgrams) if (targetField.ngrams.has(item)) intersection += 1;
      const sourceCoverage = sourceNgrams.size ? intersection / sourceNgrams.size : 0;
      const contiguous = longestContiguousMatch(targetField.text, source);
      const adaptiveContiguousThreshold = Math.min(
        SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumContiguousMatchCharacters,
        Math.max(
          SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters,
          Math.ceil(source.length * SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumContiguousSourceRatio)
        )
      );
      maxSimilarity = Math.max(maxSimilarity, similarity);
      maxSourceCoverage = Math.max(maxSourceCoverage, sourceCoverage);
      maxContiguousMatch = Math.max(maxContiguousMatch, contiguous);
      if (similarity > SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumFiveGramSimilarity
        || sourceCoverage >= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumSourceCoverage
        || contiguous >= adaptiveContiguousThreshold) sourceMatched = true;
    }
    if (sourceMatched) matchedCount += 1;
  }
  return { maxSimilarity, maxSourceCoverage, maxContiguousMatch, matchedCount };
}

function evidencePayload(input: Omit<SubjectPracticeSourceCorpusScanEvidence, 'payloadSha256'>) {
  return JSON.stringify(canonicalJsonValue(input));
}

export function buildSubjectPracticeSourceCorpusScanEvidence(
  input: Omit<SubjectPracticeSourceCorpusScanEvidence, 'schemaVersion' | 'scannerPolicyVersion' | 'normalizationVersion' |
    'matchingAlgorithmVersion' | 'thresholdVersion' | 'corpusBuilderVersion' | 'corpusInventorySchemaVersion' |
    'corpusCanonicalizationVersion' | 'thresholdCalibrationVersion' | 'status' | 'payloadSha256'>
): SubjectPracticeSourceCorpusScanEvidence {
  const status = input.matchedCount <= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumMatchedCount
    && Number.isFinite(input.maxSimilarity) && input.maxSimilarity >= 0 && input.maxSimilarity <= 1
    && Number.isFinite(input.maxSourceCoverage) && input.maxSourceCoverage >= 0 && input.maxSourceCoverage <= 1
    && Number.isFinite(input.maxContiguousMatch) && input.maxContiguousMatch >= 0
    && Number.isInteger(input.matchedCount) && input.matchedCount >= 0
    && input.maxSimilarity <= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumFiveGramSimilarity
    && input.maxSourceCoverage < SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumSourceCoverage
    && input.maxContiguousMatch <= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumContiguousMatchCharacters
    && input.sourceCorpusEntryCount > 0
    && input.targetFieldNames.length > 0
    && exactStringSet(input.targetFieldNames, SUBJECT_PRACTICE_SOURCE_CORPUS_TARGET_FIELDS[input.layer])
    && Object.values(input.corpusFieldCoverage).every(Boolean)
    && validSha256(input.inventoryManifestSha256)
    && Number(input.corpusSubjectCounts[input.subject] ?? 0) > 0
    && input.requiredLanguages.length > 0
    && input.requiredLanguages.every((language) => Number(input.corpusLanguageCounts[clean(language).toLowerCase()] ?? 0) > 0)
    && (input.layer === 'generator_projection'
      ? validSha256(input.providerProjectionSha256) && input.providerProjectionSha256 === input.targetContentSha256
      : input.providerProjectionSha256 === null)
    ? 'pass' as const : 'fail' as const;
  const payload: Omit<SubjectPracticeSourceCorpusScanEvidence, 'payloadSha256'> = {
    schemaVersion: 'subject-practice-source-corpus-scan-evidence-v1' as const,
    ...input,
    corpusBuilderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    corpusInventorySchemaVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION,
    corpusCanonicalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION,
    scannerPolicyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    matchingAlgorithmVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
    thresholdVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION,
    thresholdCalibrationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_CALIBRATION_VERSION,
    status
  };
  return { ...payload, payloadSha256: sha256(evidencePayload(payload)) };
}

function attestationMessage(input: Omit<SubjectPracticeSourceCorpusScanAttestation, 'signatureHmacSha256'>) {
  return JSON.stringify(canonicalJsonValue(input));
}

export function createSubjectPracticeSourceCorpusScanAttestation(input: {
  evidence: SubjectPracticeSourceCorpusScanEvidence;
  scannerId: string;
  keyId: string;
  issuedAt: string;
  expiresAt: string;
  secret: string;
}): SubjectPracticeSourceCorpusScanAttestation {
  if (clean(input.secret).length < 32) throw new Error('source_corpus_scan_attestation_secret_too_short');
  const unsigned: Omit<SubjectPracticeSourceCorpusScanAttestation, 'signatureHmacSha256'> = {
    schemaVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_ATTESTATION_VERSION,
    evidencePayloadSha256: input.evidence.payloadSha256,
    sourceCorpusSnapshotSha256: input.evidence.sourceCorpusSnapshotSha256,
    scannerId: clean(input.scannerId),
    keyId: clean(input.keyId),
    layer: input.evidence.layer,
    subject: input.evidence.subject,
    targetContentSha256: input.evidence.targetContentSha256,
    providerProjectionSha256: input.evidence.providerProjectionSha256,
    issuedAt: clean(input.issuedAt),
    expiresAt: clean(input.expiresAt)
  };
  if (!validSha256(unsigned.evidencePayloadSha256) || !validSha256(unsigned.sourceCorpusSnapshotSha256)
    || !unsigned.scannerId || !unsigned.keyId || !validIsoTimestamp(unsigned.issuedAt)
    || !validIsoTimestamp(unsigned.expiresAt) || Date.parse(unsigned.expiresAt) <= Date.parse(unsigned.issuedAt)) {
    throw new Error('source_corpus_scan_attestation_invalid');
  }
  return {
    ...unsigned,
    signatureHmacSha256: createHmac('sha256', clean(input.secret)).update(attestationMessage(unsigned)).digest('hex')
  };
}

export function verifySubjectPracticeSourceCorpusScanAttestation(input: {
  evidence: SubjectPracticeSourceCorpusScanEvidence;
  attestation: SubjectPracticeSourceCorpusScanAttestation;
  secret: string;
  allowedScannerIds: string[];
  allowedKeyIds: string[];
  now: string;
}): SubjectPracticeSourceCorpusScanTrustedProof | null {
  const { payloadSha256, ...payload } = input.evidence ?? {} as SubjectPracticeSourceCorpusScanEvidence;
  if (!input.evidence || sha256(evidencePayload(payload as Omit<SubjectPracticeSourceCorpusScanEvidence, 'payloadSha256'>)) !== payloadSha256
    || clean(input.secret).length < 32
    || input.attestation?.schemaVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_ATTESTATION_VERSION
    || input.attestation.evidencePayloadSha256 !== payloadSha256
    || input.attestation.sourceCorpusSnapshotSha256 !== input.evidence.sourceCorpusSnapshotSha256
    || input.attestation.layer !== input.evidence.layer
    || input.attestation.subject !== input.evidence.subject
    || input.attestation.targetContentSha256 !== input.evidence.targetContentSha256
    || input.attestation.providerProjectionSha256 !== input.evidence.providerProjectionSha256
    || !input.allowedScannerIds.includes(clean(input.attestation.scannerId))
    || !input.allowedKeyIds.includes(clean(input.attestation.keyId))
    || !validIsoTimestamp(input.now)
    || !validIsoTimestamp(input.attestation.issuedAt)
    || !validIsoTimestamp(input.attestation.expiresAt)
    || Date.parse(input.now) < Date.parse(input.attestation.issuedAt)
    || Date.parse(input.now) >= Date.parse(input.attestation.expiresAt)
    || !validSha256(input.attestation.signatureHmacSha256)) return null;
  const unsigned = {
    schemaVersion: input.attestation.schemaVersion,
    evidencePayloadSha256: input.attestation.evidencePayloadSha256,
    sourceCorpusSnapshotSha256: input.attestation.sourceCorpusSnapshotSha256,
    scannerId: input.attestation.scannerId,
    keyId: input.attestation.keyId,
    layer: input.attestation.layer,
    subject: input.attestation.subject,
    targetContentSha256: input.attestation.targetContentSha256,
    providerProjectionSha256: input.attestation.providerProjectionSha256,
    expiresAt: input.attestation.expiresAt,
    issuedAt: input.attestation.issuedAt
  };
  const expected = Buffer.from(createHmac('sha256', clean(input.secret)).update(attestationMessage(unsigned)).digest('hex'), 'hex');
  const actual = Buffer.from(input.attestation.signatureHmacSha256, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return {
    [TRUSTED_SCAN_PROOF]: true,
    evidencePayloadSha256: payloadSha256,
    sourceCorpusSnapshotSha256: input.evidence.sourceCorpusSnapshotSha256,
    scannerId: input.attestation.scannerId,
    keyId: input.attestation.keyId,
    layer: input.attestation.layer,
    subject: input.attestation.subject,
    targetContentSha256: input.attestation.targetContentSha256,
    providerProjectionSha256: input.attestation.providerProjectionSha256,
    expiresAt: input.attestation.expiresAt
  };
}

export function subjectPracticeSourceCorpusScanEvidenceQualifies(input: {
  evidence: SubjectPracticeSourceCorpusScanEvidence;
  trustedProof?: SubjectPracticeSourceCorpusScanTrustedProof | null;
  expectedTargetContentSha256: string;
  expectedSourceCorpusSnapshotSha256: string;
  expectedInventoryManifestSha256: string;
}) {
  const evidence = input.evidence;
  return Boolean(evidence
    && evidence.status === 'pass'
    && evidence.scannerPolicyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION
    && evidence.normalizationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
    && evidence.matchingAlgorithmVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION
    && evidence.thresholdVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION
    && evidence.corpusBuilderVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION
    && evidence.corpusInventorySchemaVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_INVENTORY_SCHEMA_VERSION
    && evidence.corpusCanonicalizationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_CANONICALIZATION_VERSION
    && evidence.inventoryManifestSha256 === input.expectedInventoryManifestSha256
    && validSha256(evidence.inventoryManifestSha256)
    && evidence.targetContentSha256 === input.expectedTargetContentSha256
    && evidence.sourceCorpusSnapshotSha256 === input.expectedSourceCorpusSnapshotSha256
    && evidence.sourceCorpusEntryCount > 0
    && evidence.corpusCoverageStatus === 'all_system_known_source_exam_reference'
    && exactStringSet(evidence.targetFieldNames, SUBJECT_PRACTICE_SOURCE_CORPUS_TARGET_FIELDS[evidence.layer])
    && Object.values(evidence.corpusFieldCoverage).every(Boolean)
    && Number(evidence.corpusSubjectCounts[evidence.subject] ?? 0) > 0
    && evidence.requiredLanguages.length > 0
    && evidence.requiredLanguages.every((language) => Number(evidence.corpusLanguageCounts[clean(language).toLowerCase()] ?? 0) > 0)
    && evidence.thresholdCalibrationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_CALIBRATION_VERSION
    && evidence.thresholdCalibrationStatus === 'three_subject_labeled_calibration_passed'
    && Number.isFinite(evidence.maxSimilarity) && evidence.maxSimilarity >= 0 && evidence.maxSimilarity <= 1
    && Number.isFinite(evidence.maxSourceCoverage) && evidence.maxSourceCoverage >= 0 && evidence.maxSourceCoverage <= 1
    && Number.isFinite(evidence.maxContiguousMatch) && evidence.maxContiguousMatch >= 0
    && evidence.matchedCount === 0
    && (evidence.layer === 'generator_projection'
      ? validSha256(evidence.providerProjectionSha256)
        && evidence.providerProjectionSha256 === evidence.targetContentSha256
      : evidence.providerProjectionSha256 === null)
    && input.trustedProof?.[TRUSTED_SCAN_PROOF] === true
    && input.trustedProof.evidencePayloadSha256 === evidence.payloadSha256
    && input.trustedProof.sourceCorpusSnapshotSha256 === evidence.sourceCorpusSnapshotSha256
    && input.trustedProof.layer === evidence.layer
    && input.trustedProof.subject === evidence.subject
    && input.trustedProof.targetContentSha256 === evidence.targetContentSha256
    && input.trustedProof.providerProjectionSha256 === evidence.providerProjectionSha256);
}

export function subjectPracticeSourceCorpusScanQualificationFor(input: {
  evidence: SubjectPracticeSourceCorpusScanEvidence;
  trustedProof?: SubjectPracticeSourceCorpusScanTrustedProof | null;
  expectedTargetContentSha256: string;
  expectedSourceCorpusSnapshotSha256: string;
  expectedInventoryManifestSha256: string;
}): SubjectPracticeSourceCorpusScanQualification | null {
  if (!subjectPracticeSourceCorpusScanEvidenceQualifies(input)) return null;
  return {
    [VERIFIED_SCAN_QUALIFICATION]: true,
    layer: input.evidence.layer,
    subject: input.evidence.subject,
    targetContentSha256: input.evidence.targetContentSha256,
    providerProjectionSha256: input.evidence.providerProjectionSha256,
    sourceCorpusSnapshotId: input.evidence.sourceCorpusSnapshotId,
    sourceCorpusSnapshotSha256: input.evidence.sourceCorpusSnapshotSha256,
    scannerPolicyVersion: input.evidence.scannerPolicyVersion
  };
}

export function subjectPracticeSourceCorpusScanQualificationMatches(input: {
  qualification: SubjectPracticeSourceCorpusScanQualification | null | undefined;
  expectedLayer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  expectedSubject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  expectedSourceCorpusSnapshotSha256: string;
}) {
  const qualification = input.qualification;
  return Boolean(qualification
    && qualification[VERIFIED_SCAN_QUALIFICATION] === true
    && qualification.layer === input.expectedLayer
    && qualification.subject === input.expectedSubject
    && qualification.sourceCorpusSnapshotSha256 === input.expectedSourceCorpusSnapshotSha256
    && qualification.scannerPolicyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION);
}
