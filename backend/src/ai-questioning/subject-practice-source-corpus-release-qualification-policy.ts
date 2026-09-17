import { createHash } from 'node:crypto';
import {
  SubjectPracticeSourceCorpusCalibrationQualityQualification,
  subjectPracticeSourceCorpusCalibrationQualityQualificationMatches
} from './subject-practice-source-corpus-calibration-policy';
import {
  SubjectPracticeSourceCorpusScanEvidence,
  SubjectPracticeSourceCorpusScanTrustedProof,
  subjectPracticeSourceCorpusScanQualificationFor
} from './subject-practice-source-corpus-scan-policy';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_RELEASE_QUALIFICATION_POLICY_VERSION =
  'subject-practice-source-corpus-release-qualification-policy-v1';

const RELEASE_QUALIFICATION = Symbol('subject-practice-source-corpus-release-qualification');
const trustedReleaseQualifications = new WeakSet<object>();

export type SubjectPracticeSourceCorpusReleaseQualification = Readonly<{
  [RELEASE_QUALIFICATION]: true;
  policyVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_RELEASE_QUALIFICATION_POLICY_VERSION;
  layer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  subject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  targetContentSha256: string;
  sourceCorpusSnapshotSha256: string;
  inventoryManifestSha256: string;
  scanEvidencePayloadSha256: string;
  calibrationQualificationSha256: string;
  qualificationSha256: string;
}>;

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => typeof key === 'string' && entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalJsonValue(value))).digest('hex');
}

function validSha256(value: unknown) {
  return /^[a-f0-9]{64}$/.test(String(value ?? '').trim());
}

export function subjectPracticeSourceCorpusReleaseQualificationFor(input: {
  evidence: SubjectPracticeSourceCorpusScanEvidence;
  trustedProof?: SubjectPracticeSourceCorpusScanTrustedProof | null;
  calibrationQualification?: SubjectPracticeSourceCorpusCalibrationQualityQualification | null;
  expectedTargetContentSha256: string;
  expectedSourceCorpusSnapshotSha256: string;
  expectedInventoryManifestSha256: string;
  expectedCalibrationDatasetSnapshotSha256: string;
  expectedGeneratorVersionSetSha256: string;
  expectedRendererVersionSetSha256: string;
  expectedLengthPolicyQualificationSha256: string;
  expectedPrimaryReachableCellSetSha256: string;
}): SubjectPracticeSourceCorpusReleaseQualification | null {
  const scanQualification = subjectPracticeSourceCorpusScanQualificationFor({
    evidence: input.evidence,
    trustedProof: input.trustedProof,
    expectedTargetContentSha256: input.expectedTargetContentSha256,
    expectedSourceCorpusSnapshotSha256: input.expectedSourceCorpusSnapshotSha256,
    expectedInventoryManifestSha256: input.expectedInventoryManifestSha256
  });
  const calibrationQualified = subjectPracticeSourceCorpusCalibrationQualityQualificationMatches({
    qualification: input.calibrationQualification,
    expectedDatasetSnapshotSha256: input.expectedCalibrationDatasetSnapshotSha256,
    expectedInventoryManifestSha256: input.expectedInventoryManifestSha256,
    expectedInventorySnapshotSha256: input.expectedSourceCorpusSnapshotSha256,
    expectedGeneratorVersionSetSha256: input.expectedGeneratorVersionSetSha256,
    expectedRendererVersionSetSha256: input.expectedRendererVersionSetSha256,
    expectedLengthPolicyQualificationSha256: input.expectedLengthPolicyQualificationSha256,
    expectedPrimaryReachableCellSetSha256: input.expectedPrimaryReachableCellSetSha256
  });
  if (!scanQualification || !calibrationQualified || !input.calibrationQualification) return null;
  const body = {
    policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_RELEASE_QUALIFICATION_POLICY_VERSION as
      typeof SUBJECT_PRACTICE_SOURCE_CORPUS_RELEASE_QUALIFICATION_POLICY_VERSION,
    layer: input.evidence.layer,
    subject: input.evidence.subject,
    targetContentSha256: input.evidence.targetContentSha256,
    sourceCorpusSnapshotSha256: input.evidence.sourceCorpusSnapshotSha256,
    inventoryManifestSha256: input.evidence.inventoryManifestSha256,
    scanEvidencePayloadSha256: input.evidence.payloadSha256,
    calibrationQualificationSha256: input.calibrationQualification.qualificationSha256
  };
  const qualification = Object.freeze({
    [RELEASE_QUALIFICATION]: true as const,
    ...body,
    qualificationSha256: sha256(body)
  });
  trustedReleaseQualifications.add(qualification);
  return qualification;
}

export function subjectPracticeSourceCorpusReleaseQualificationMatches(input: {
  qualification?: SubjectPracticeSourceCorpusReleaseQualification | null;
  expectedLayer: SubjectPracticeSourceCorpusScanEvidence['layer'];
  expectedSubject: SubjectPracticeSourceCorpusScanEvidence['subject'];
  expectedTargetContentSha256: string;
  expectedSourceCorpusSnapshotSha256: string;
}) {
  const qualification = input.qualification;
  if (!qualification || !trustedReleaseQualifications.has(qualification)
    || !Object.isFrozen(qualification)) return false;
  const body = {
    policyVersion: qualification.policyVersion,
    layer: qualification.layer,
    subject: qualification.subject,
    targetContentSha256: qualification.targetContentSha256,
    sourceCorpusSnapshotSha256: qualification.sourceCorpusSnapshotSha256,
    inventoryManifestSha256: qualification.inventoryManifestSha256,
    scanEvidencePayloadSha256: qualification.scanEvidencePayloadSha256,
    calibrationQualificationSha256: qualification.calibrationQualificationSha256
  };
  return qualification[RELEASE_QUALIFICATION] === true
    && qualification.policyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_RELEASE_QUALIFICATION_POLICY_VERSION
    && qualification.layer === input.expectedLayer
    && qualification.subject === input.expectedSubject
    && qualification.targetContentSha256 === input.expectedTargetContentSha256
    && qualification.sourceCorpusSnapshotSha256 === input.expectedSourceCorpusSnapshotSha256
    && validSha256(qualification.targetContentSha256)
    && validSha256(qualification.inventoryManifestSha256)
    && validSha256(qualification.scanEvidencePayloadSha256)
    && validSha256(qualification.calibrationQualificationSha256)
    && qualification.qualificationSha256 === sha256(body);
}
