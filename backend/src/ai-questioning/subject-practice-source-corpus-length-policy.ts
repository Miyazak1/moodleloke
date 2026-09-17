import { createHash } from 'node:crypto';
import {
  buildSubjectPracticeSourceCorpusInventoryManifest,
  SubjectPracticeSourceCorpusInventoryManifest,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
} from './subject-practice-source-corpus-scan-policy';
import {
  SubjectPracticeCommonFragmentCorpusQualification,
  subjectPracticeCommonFragmentCorpusLengthObservationSetMatches,
  subjectPracticeCommonFragmentCorpusQualificationMatches
} from './subject-practice-common-fragment-corpus-policy';
import { SubjectPracticeSourceCorpusTopologyQualification } from './subject-practice-source-corpus-topology-policy';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION =
  'subject-practice-source-corpus-language-field-length-policy-v3';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_QUALIFICATION_VERSION =
  'subject-practice-source-corpus-length-qualification-v3';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS = 200;

const SUBJECTS = ['math', 'physics', 'chemistry'] as const;
const LANGUAGES = ['en', 'zh'] as const;
const FIELDS = ['prompt', 'options', 'answer', 'explanation', 'localizations'] as const;
const BUCKETS = ['short', 'medium', 'long'] as const;
type Subject = typeof SUBJECTS[number];
type Language = typeof LANGUAGES[number];
type Field = typeof FIELDS[number];
type Bucket = typeof BUCKETS[number];

export type SubjectPracticeSourceLengthObservation = {
  sourceQuestionRevisionId: string;
  subject: Subject;
  language: Language;
  field: Field;
  normalizedCharacterCount: number;
  contentSha256: string;
};

export type SubjectPracticeGeneratedFieldContract = {
  contractId: string;
  subject: Subject;
  language: Language;
  field: Field;
  emitsField: boolean;
  minimumNormalizedCharacters: number | null;
  maximumNormalizedCharacters: number | null;
  generatorVersion: string;
  rendererVersion: string;
};

type AxisBoundary = {
  subject: Subject;
  language: Language;
  field: Field;
  observationCount: number;
  shortMaximumNormalizedCharacters: number;
  mediumMaximumNormalizedCharacters: number;
  distributionSha256: string;
};

export type SubjectPracticeSourceCorpusLengthQualification = Readonly<{
  qualificationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_QUALIFICATION_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION;
  inventoryManifestSha256: string;
  inventorySnapshotSha256: string;
  normalizationVersion: string;
  axisBoundaries: AxisBoundary[];
  reachableCellKeys: string[];
  unreachableCellProofs: Array<{
    cellKey: string;
    reason: 'field_not_emitted' | 'outside_bound_output_range' | 'empty_distribution_bucket';
    contractSetSha256: string;
  }>;
  generatorVersionSetSha256: string;
  rendererVersionSetSha256: string;
  structuredCorpusQualificationSha256: string;
  qualificationSha256: string;
}>;

const trustedQualifications = new WeakSet<object>();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: unknown) => String(value ?? '').trim();
const validSha256 = (value: unknown) => /^[a-f0-9]{64}$/.test(clean(value));
const axisKey = (subject: Subject, language: Language, field: Field) =>
  `${subject}:${language}:${field}`;
const cellKey = (subject: Subject, language: Language, field: Field, bucket: Bucket) =>
  `${axisKey(subject, language, field)}:${bucket}`;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

function quantile(sorted: number[], rate: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * rate) - 1))];
}

function bucketRange(boundary: AxisBoundary, bucket: Bucket): [number, number] {
  if (bucket === 'short') return [0, boundary.shortMaximumNormalizedCharacters];
  if (bucket === 'medium') {
    return [boundary.shortMaximumNormalizedCharacters + 1, boundary.mediumMaximumNormalizedCharacters];
  }
  return [boundary.mediumMaximumNormalizedCharacters + 1, Number.MAX_SAFE_INTEGER];
}

function rangesIntersect(left: [number, number], right: [number, number]) {
  return Math.max(left[0], right[0]) <= Math.min(left[1], right[1]);
}

export function createSubjectPracticeSourceCorpusLengthQualification(input: {
  inventoryManifest: SubjectPracticeSourceCorpusInventoryManifest;
  inventorySnapshotSha256: string;
  observations: SubjectPracticeSourceLengthObservation[];
  generatedFieldContracts: SubjectPracticeGeneratedFieldContract[];
  structuredCorpusQualification: SubjectPracticeCommonFragmentCorpusQualification;
  topology: {
    qualification: SubjectPracticeSourceCorpusTopologyQualification;
    expectedEvidencePayloadSha256: string;
    expectedEnvironmentId: string;
    now: string;
  };
}): SubjectPracticeSourceCorpusLengthQualification | null {
  const rebuiltManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: input.inventoryManifest.requiredSourceIds,
    sources: input.inventoryManifest.sources,
    topology: input.topology
  });
  if (rebuiltManifest.manifestSha256 !== input.inventoryManifest.manifestSha256
    || rebuiltManifest.coverageStatus !== 'all_system_known_source_exam_reference'
    || !validSha256(input.inventorySnapshotSha256)
    || !subjectPracticeCommonFragmentCorpusQualificationMatches({
      qualification: input.structuredCorpusQualification,
      expectedInventoryManifestSha256: rebuiltManifest.manifestSha256,
      expectedCorpusSnapshotSha256: input.inventorySnapshotSha256
    })
    || !subjectPracticeCommonFragmentCorpusLengthObservationSetMatches({
      qualification: input.structuredCorpusQualification,
      observations: input.observations
    })) return null;

  const observationIds = new Set<string>();
  for (const observation of input.observations) {
    const id = `${observation.sourceQuestionRevisionId}:${observation.subject}:${observation.language}:${observation.field}`;
    if (!clean(observation.sourceQuestionRevisionId) || observationIds.has(id)
      || !validSha256(observation.contentSha256)
      || !Number.isInteger(observation.normalizedCharacterCount)
      || observation.normalizedCharacterCount < 0) return null;
    observationIds.add(id);
  }

  const contractIds = new Set<string>();
  for (const contract of input.generatedFieldContracts) {
    if (!clean(contract.contractId) || contractIds.has(contract.contractId)
      || !clean(contract.generatorVersion) || !clean(contract.rendererVersion)) return null;
    contractIds.add(contract.contractId);
    if (contract.emitsField) {
      if (!Number.isInteger(contract.minimumNormalizedCharacters)
        || !Number.isInteger(contract.maximumNormalizedCharacters)
        || Number(contract.minimumNormalizedCharacters) < 0
        || Number(contract.maximumNormalizedCharacters) < Number(contract.minimumNormalizedCharacters)) return null;
    } else if (contract.minimumNormalizedCharacters !== null
      || contract.maximumNormalizedCharacters !== null) return null;
  }

  const axisBoundaries: AxisBoundary[] = [];
  const reachableCellKeys: string[] = [];
  const unreachableCellProofs: SubjectPracticeSourceCorpusLengthQualification['unreachableCellProofs'] = [];
  const contractSetSha256 = sha256(JSON.stringify(canonical(input.generatedFieldContracts)));
  for (const subject of SUBJECTS) for (const language of LANGUAGES) for (const field of FIELDS) {
    const lengths = input.observations.filter((item) =>
      item.subject === subject && item.language === language && item.field === field)
      .map((item) => item.normalizedCharacterCount).sort((left, right) => left - right);
    if (lengths.length < SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS) return null;
    const boundary: AxisBoundary = {
      subject, language, field, observationCount: lengths.length,
      shortMaximumNormalizedCharacters: quantile(lengths, 1 / 3),
      mediumMaximumNormalizedCharacters: quantile(lengths, 2 / 3),
      distributionSha256: sha256(JSON.stringify(lengths))
    };
    axisBoundaries.push(boundary);
    const contracts = input.generatedFieldContracts.filter((item) =>
      item.subject === subject && item.language === language && item.field === field);
    if (!contracts.length) return null;
    for (const bucket of BUCKETS) {
      const key = cellKey(subject, language, field, bucket);
      const emitted = contracts.filter((item) => item.emitsField);
      const reachable = emitted.some((contract) => rangesIntersect(
        bucketRange(boundary, bucket),
        [Number(contract.minimumNormalizedCharacters), Number(contract.maximumNormalizedCharacters)]
      ));
      if (reachable) reachableCellKeys.push(key);
      else unreachableCellProofs.push({
        cellKey: key,
        reason: emitted.length ? 'outside_bound_output_range' : 'field_not_emitted',
        contractSetSha256
      });
    }
  }

  const generatorVersions = Array.from(new Set(input.generatedFieldContracts.map((item) =>
    clean(item.generatorVersion)))).sort();
  const rendererVersions = Array.from(new Set(input.generatedFieldContracts.map((item) =>
    clean(item.rendererVersion)))).sort();
  const payload: Omit<SubjectPracticeSourceCorpusLengthQualification, 'qualificationSha256'> = {
    qualificationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_QUALIFICATION_VERSION,
    policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION,
    inventoryManifestSha256: rebuiltManifest.manifestSha256,
    inventorySnapshotSha256: input.inventorySnapshotSha256,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    axisBoundaries,
    reachableCellKeys: reachableCellKeys.sort(),
    unreachableCellProofs: unreachableCellProofs.sort((left, right) =>
      left.cellKey.localeCompare(right.cellKey)),
    generatorVersionSetSha256: sha256(JSON.stringify(generatorVersions)),
    rendererVersionSetSha256: sha256(JSON.stringify(rendererVersions)),
    structuredCorpusQualificationSha256: input.structuredCorpusQualification.qualificationSha256
  };
  const qualification = Object.freeze({
    ...payload,
    qualificationSha256: sha256(JSON.stringify(canonical(payload)))
  });
  trustedQualifications.add(qualification);
  return qualification;
}

export function subjectPracticeSourceCorpusLengthQualificationMatches(input: {
  qualification?: SubjectPracticeSourceCorpusLengthQualification | null;
  expectedInventoryManifestSha256: string;
  expectedInventorySnapshotSha256: string;
  expectedGeneratorVersionSetSha256: string;
  expectedRendererVersionSetSha256: string;
}) {
  const qualification = input.qualification;
  if (!qualification || !trustedQualifications.has(qualification)
    || !Object.isFrozen(qualification)) return false;
  const { qualificationSha256, ...payload } = qualification;
  return Boolean(qualification.policyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION
    && qualification.qualificationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_QUALIFICATION_VERSION
    && qualification.inventoryManifestSha256 === input.expectedInventoryManifestSha256
    && qualification.inventorySnapshotSha256 === input.expectedInventorySnapshotSha256
    && qualification.generatorVersionSetSha256 === input.expectedGeneratorVersionSetSha256
    && qualification.rendererVersionSetSha256 === input.expectedRendererVersionSetSha256
    && validSha256(qualification.structuredCorpusQualificationSha256)
    && qualification.axisBoundaries.length === SUBJECTS.length * LANGUAGES.length * FIELDS.length
    && qualification.reachableCellKeys.length + qualification.unreachableCellProofs.length
      === SUBJECTS.length * LANGUAGES.length * FIELDS.length * BUCKETS.length
    && qualificationSha256 === sha256(JSON.stringify(canonical(payload))));
}

export function classifySubjectPracticeSourceLengthWithQualification(input: {
  qualification?: SubjectPracticeSourceCorpusLengthQualification | null;
  subject: Subject;
  language: Language;
  field: Field;
  normalizedCharacterCount: number;
}): Bucket | null {
  const qualification = input.qualification;
  if (!qualification || !trustedQualifications.has(qualification)
    || !Number.isInteger(input.normalizedCharacterCount) || input.normalizedCharacterCount < 0) return null;
  const boundary = qualification.axisBoundaries.find((item) => item.subject === input.subject
    && item.language === input.language && item.field === input.field);
  if (!boundary) return null;
  if (input.normalizedCharacterCount <= boundary.shortMaximumNormalizedCharacters) return 'short';
  if (input.normalizedCharacterCount <= boundary.mediumMaximumNormalizedCharacters) return 'medium';
  return 'long';
}
