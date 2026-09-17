import { createHash } from 'node:crypto';
import {
  buildSubjectPracticeSourceCorpusInventoryManifest,
  SubjectPracticeSourceCorpusInventoryManifest
} from './subject-practice-source-corpus-scan-policy';
import {
  isSubjectPracticeCandidateNoveltyCommonSymbolicFragment,
  SubjectPracticeStructuredSourceQuestionRevision,
  subjectPracticeStructuredSourceQuestionRevisionValid,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} from './subject-practice-candidate-output-novelty-policy';
import { normalizeSubjectPracticeSourceCorpusText } from './subject-practice-source-corpus-scan-policy';
import { SubjectPracticeSourceCorpusTopologyQualification } from './subject-practice-source-corpus-topology-policy';

export const SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION =
  'subject-practice-common-fragment-complete-corpus-policy-v4';
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_QUALIFICATION_VERSION =
  'subject-practice-common-fragment-complete-corpus-opaque-qualification-v4';
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_PROOF_VERSION =
  'subject-practice-common-fragment-corpus-statistics-opaque-proof-v4';
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_MINIMUM_INDEPENDENT_LINEAGES = 20;
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_MAXIMUM_NORMALIZED_LENGTH = 24;

type FragmentClass = 'short_symbolic';
type LengthField = 'prompt' | 'options' | 'answer' | 'explanation' | 'localizations';

export type SubjectPracticeCommonFragmentCorpusLengthObservation = {
  sourceQuestionRevisionId: string;
  subject: string;
  language: string;
  field: LengthField;
  normalizedCharacterCount: number;
  contentSha256: string;
};

type FragmentStatistic = Readonly<{
  fragmentSha256: string;
  normalizedLength: number;
  independentLineageCount: number;
  independentDocumentCount: number;
  occurrenceRevisionCount: number;
}>;

export type SubjectPracticeCommonFragmentCorpusQualification = Readonly<{
  kind: 'subject_practice_common_fragment_complete_corpus_qualification';
  qualificationVersion: typeof SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_QUALIFICATION_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION;
  structuredCorpusSchemaVersion: typeof SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION;
  inventoryManifestSha256: string;
  corpusSnapshotSha256: string;
  structuredRevisionSetSha256: string;
  revisionCount: number;
  independentLineageCount: number;
  duplicateRevisionCount: number;
  fragmentStatisticCount: number;
  fragmentStatisticsSha256: string;
  lengthObservationCount: number;
  lengthObservationSetSha256: string;
  qualificationSha256: string;
}>;

export type SubjectPracticeCommonFragmentCorpusProof = Readonly<{
  kind: 'subject_practice_common_fragment_corpus_statistics_proof';
  proofVersion: typeof SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_PROOF_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION;
  inventoryManifestSha256: string;
  corpusSnapshotSha256: string;
  structuredRevisionSetSha256: string;
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceDocumentIdentityHash: string;
  fragmentClass: FragmentClass;
  fragmentSetSha256: string;
  maximumNormalizedFragmentLength: number;
  minimumIndependentLineageCount: number;
  minimumIndependentDocumentCount: number;
  fragmentStatisticsSha256: string;
  corpusQualificationSha256: string;
  proofSha256: string;
}>;

type PrivateCorpusDetails = {
  revisionBindings: Map<string, { lineageHash: string; documentIdentityHash: string; fragmentHashes: Set<string> }>;
  fragmentStatistics: Map<string, FragmentStatistic>;
  lengthObservations: SubjectPracticeCommonFragmentCorpusLengthObservation[];
};

const trustedCorpusQualifications = new WeakSet<object>();
const trustedCorpusProofs = new WeakSet<object>();
const privateCorpusDetails = new WeakMap<object, PrivateCorpusDetails>();
const clean = (value: unknown) => String(value ?? '').trim();
const validSha256 = (value: unknown) => /^[a-f0-9]{64}$/.test(clean(value));

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

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function subjectPracticeCommonFragmentDescriptorSetSha256(input: Array<{
  fragmentSha256: string;
  normalizedLength: number;
  fragmentClass: FragmentClass;
}>) {
  return sha256([...input].sort((left, right) => left.fragmentSha256.localeCompare(right.fragmentSha256)));
}

function sourceKind(sourceSystem: SubjectPracticeStructuredSourceQuestionRevision['sourceSystem']) {
  if (sourceSystem === 'local_file') return 'local_file' as const;
  if (sourceSystem === 'production_database') return 'database_query' as const;
  return 'remote_sync' as const;
}

function revisionCommonFragments(revision: SubjectPracticeStructuredSourceQuestionRevision) {
  const values = [
    ...revision.fields.options,
    ...revision.fields.localizations.flatMap((localized) => localized.options)
  ].map((value) => normalizeSubjectPracticeSourceCorpusText(value))
    .filter((value) => value
      && isSubjectPracticeCandidateNoveltyCommonSymbolicFragment(value));
  return Array.from(new Set(values)).sort();
}

function revisionLengthObservations(
  revision: SubjectPracticeStructuredSourceQuestionRevision
): SubjectPracticeCommonFragmentCorpusLengthObservation[] {
  const rawByField: Record<LengthField, string> = {
    prompt: revision.fields.prompt,
    options: JSON.stringify(canonical(revision.fields.options)),
    answer: revision.fields.answer,
    explanation: revision.fields.explanation,
    localizations: JSON.stringify(canonical(revision.fields.localizations))
  };
  return (Object.entries(rawByField) as Array<[LengthField, string]>).map(([field, raw]) => {
    const normalized = normalizeSubjectPracticeSourceCorpusText(raw);
    return {
      sourceQuestionRevisionId: revision.sourceQuestionRevisionId,
      subject: revision.subject,
      language: revision.language,
      field,
      normalizedCharacterCount: normalized.length,
      contentSha256: createHash('sha256').update(normalized).digest('hex')
    };
  });
}

function sortedLengthObservations(observations: SubjectPracticeCommonFragmentCorpusLengthObservation[]) {
  return [...observations].sort((left, right) =>
    left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId)
    || left.field.localeCompare(right.field));
}

export function createSubjectPracticeCommonFragmentCorpusQualification(input: {
  inventoryManifest: SubjectPracticeSourceCorpusInventoryManifest;
  sourceRevisions: SubjectPracticeStructuredSourceQuestionRevision[];
  topology: {
    qualification: SubjectPracticeSourceCorpusTopologyQualification;
    expectedEvidencePayloadSha256: string;
    expectedEnvironmentId: string;
    now: string;
  };
}): SubjectPracticeCommonFragmentCorpusQualification | null {
  const manifest = input.inventoryManifest;
  const rebuiltManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: manifest?.requiredSourceIds ?? [],
    sources: manifest?.sources ?? [],
    topology: input.topology
  });
  const sourceIds = (manifest?.sources ?? []).map((source) => source.sourceId).sort();
  const requiredSourceIds = [...(manifest?.requiredSourceIds ?? [])].sort();
  if (!manifest || rebuiltManifest.manifestSha256 !== manifest.manifestSha256
    || rebuiltManifest.coverageStatus !== 'all_system_known_source_exam_reference'
    || sourceIds.length !== requiredSourceIds.length
    || sourceIds.some((sourceId, index) => sourceId !== requiredSourceIds[index])) return null;

  const revisionIds = new Set<string>();
  const observedByKind = new Map<string, number>();
  const rawContentSha256ByLineage = new Map<string, string>();
  const canonicalRevisionByLineage = new Map<string, SubjectPracticeStructuredSourceQuestionRevision>();
  for (const revision of input.sourceRevisions) {
    if (!subjectPracticeStructuredSourceQuestionRevisionValid(revision)
      || revisionIds.has(revision.sourceQuestionRevisionId)) return null;
    revisionIds.add(revision.sourceQuestionRevisionId);
    const existingContentSha256 = rawContentSha256ByLineage.get(revision.lineageHash);
    if (existingContentSha256 && existingContentSha256 !== revision.fieldHashes.rawContentSha256) return null;
    rawContentSha256ByLineage.set(revision.lineageHash, revision.fieldHashes.rawContentSha256);
    const existingCanonical = canonicalRevisionByLineage.get(revision.lineageHash);
    if (!existingCanonical
      || revision.sourceQuestionRevisionId.localeCompare(existingCanonical.sourceQuestionRevisionId) < 0) {
      canonicalRevisionByLineage.set(revision.lineageHash, revision);
    }
    const kind = sourceKind(revision.sourceSystem);
    observedByKind.set(kind, (observedByKind.get(kind) ?? 0) + 1);
  }
  for (const kind of ['local_file', 'database_query', 'remote_sync'] as const) {
    const manifestCount = manifest.sources.filter((source) => source.kind === kind)
      .reduce((sum, source) => sum + source.observedCount, 0);
    if ((observedByKind.get(kind) ?? 0) !== manifestCount) return null;
  }
  if (input.sourceRevisions.length !== manifest.sources.reduce((sum, source) => sum + source.observedCount, 0)
    || input.sourceRevisions.length === 0) return null;

  const sortedRevisions = [...input.sourceRevisions].sort((left, right) =>
    left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  const structuredRevisionSetSha256 = sha256(sortedRevisions);
  const corpusSnapshotSha256 = sha256({
    inventoryManifestSha256: manifest.manifestSha256,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    structuredRevisionSetSha256
  });

  const revisionBindings = new Map<string, {
    lineageHash: string;
    documentIdentityHash: string;
    fragmentHashes: Set<string>;
  }>();
  const mutableStatistics = new Map<string, {
    normalizedLength: number;
    lineages: Set<string>;
    documents: Set<string>;
    revisions: Set<string>;
  }>();
  for (const revision of sortedRevisions) {
    const fragments = revisionCommonFragments(revision);
    const fragmentHashes = new Set<string>();
    for (const fragment of fragments) {
      const fragmentSha256 = createHash('sha256').update(fragment).digest('hex');
      fragmentHashes.add(fragmentSha256);
      const statistic = mutableStatistics.get(fragmentSha256) ?? {
        normalizedLength: fragment.length,
        lineages: new Set<string>(),
        documents: new Set<string>(),
        revisions: new Set<string>()
      };
      if (statistic.normalizedLength !== fragment.length) return null;
      statistic.lineages.add(revision.lineageHash);
      statistic.documents.add(revision.documentIdentityHash);
      statistic.revisions.add(revision.sourceQuestionRevisionId);
      mutableStatistics.set(fragmentSha256, statistic);
    }
    revisionBindings.set(revision.sourceQuestionRevisionId, {
      lineageHash: revision.lineageHash,
      documentIdentityHash: revision.documentIdentityHash,
      fragmentHashes
    });
  }
  const fragmentStatistics = Array.from(mutableStatistics.entries()).map(([fragmentSha256, statistic]) => ({
    fragmentSha256,
    normalizedLength: statistic.normalizedLength,
    independentLineageCount: statistic.lineages.size,
    independentDocumentCount: statistic.documents.size,
    occurrenceRevisionCount: statistic.revisions.size
  })).sort((left, right) => left.fragmentSha256.localeCompare(right.fragmentSha256));
  const fragmentStatisticsSha256 = sha256(fragmentStatistics);
  const canonicalLineageRevisions = Array.from(canonicalRevisionByLineage.values()).sort((left, right) =>
    left.lineageHash.localeCompare(right.lineageHash));
  const lengthObservations = sortedLengthObservations(canonicalLineageRevisions.flatMap(revisionLengthObservations));
  const lengthObservationSetSha256 = sha256(lengthObservations);
  const qualificationBody = {
    kind: 'subject_practice_common_fragment_complete_corpus_qualification' as const,
    qualificationVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_QUALIFICATION_VERSION,
    policyVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    inventoryManifestSha256: manifest.manifestSha256,
    corpusSnapshotSha256,
    structuredRevisionSetSha256,
    revisionCount: sortedRevisions.length,
    independentLineageCount: canonicalLineageRevisions.length,
    duplicateRevisionCount: sortedRevisions.length - canonicalLineageRevisions.length,
    fragmentStatisticCount: fragmentStatistics.length,
    fragmentStatisticsSha256,
    lengthObservationCount: lengthObservations.length,
    lengthObservationSetSha256
  } as const;
  const qualification = Object.freeze({
    ...qualificationBody,
    qualificationSha256: sha256(qualificationBody)
  });
  trustedCorpusQualifications.add(qualification);
  privateCorpusDetails.set(qualification, {
    revisionBindings,
    fragmentStatistics: new Map(fragmentStatistics.map((statistic) => [statistic.fragmentSha256, statistic])),
    lengthObservations
  });
  return qualification;
}

export function subjectPracticeCommonFragmentCorpusQualificationMatches(input: {
  qualification: SubjectPracticeCommonFragmentCorpusQualification | null | undefined;
  expectedInventoryManifestSha256: string;
  expectedCorpusSnapshotSha256: string;
}) {
  const qualification = input.qualification;
  if (!qualification || !trustedCorpusQualifications.has(qualification)
    || !Object.isFrozen(qualification)) return false;
  const { qualificationSha256, ...body } = qualification;
  return qualification.qualificationVersion === SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_QUALIFICATION_VERSION
    && qualification.policyVersion === SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION
    && qualification.structuredCorpusSchemaVersion === SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    && qualification.inventoryManifestSha256 === input.expectedInventoryManifestSha256
    && qualification.corpusSnapshotSha256 === input.expectedCorpusSnapshotSha256
    && validSha256(qualification.structuredRevisionSetSha256)
    && validSha256(qualification.fragmentStatisticsSha256)
    && validSha256(qualification.lengthObservationSetSha256)
    && Number.isInteger(qualification.independentLineageCount)
    && qualification.independentLineageCount > 0
    && qualification.independentLineageCount <= qualification.revisionCount
    && qualification.duplicateRevisionCount
      === qualification.revisionCount - qualification.independentLineageCount
    && qualification.lengthObservationCount === qualification.independentLineageCount * 5
    && qualification.qualificationSha256 === sha256(body);
}

export function subjectPracticeCommonFragmentCorpusLengthObservations(
  qualification: SubjectPracticeCommonFragmentCorpusQualification | null | undefined
) {
  if (!qualification || !trustedCorpusQualifications.has(qualification)) return null;
  const observations = privateCorpusDetails.get(qualification)?.lengthObservations;
  return observations ? observations.map((observation) => ({ ...observation })) : null;
}

export function subjectPracticeCommonFragmentCorpusLengthObservationSetMatches(input: {
  qualification: SubjectPracticeCommonFragmentCorpusQualification | null | undefined;
  observations: SubjectPracticeCommonFragmentCorpusLengthObservation[];
}) {
  const qualification = input.qualification;
  return Boolean(qualification
    && trustedCorpusQualifications.has(qualification)
    && input.observations.length === qualification.lengthObservationCount
    && sha256(sortedLengthObservations(input.observations)) === qualification.lengthObservationSetSha256);
}

export function createSubjectPracticeCommonFragmentCorpusProof(input: {
  qualification: SubjectPracticeCommonFragmentCorpusQualification;
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceDocumentIdentityHash: string;
  fragmentDescriptors: Array<{
    fragmentSha256: string;
    normalizedLength: number;
    fragmentClass: FragmentClass;
  }>;
}): SubjectPracticeCommonFragmentCorpusProof | null {
  const qualification = input.qualification;
  const details = privateCorpusDetails.get(qualification);
  const revision = details?.revisionBindings.get(clean(input.sourceQuestionRevisionId));
  const descriptorHashes = input.fragmentDescriptors.map((descriptor) => clean(descriptor.fragmentSha256));
  if (!qualification || !trustedCorpusQualifications.has(qualification) || !details || !revision
    || revision.lineageHash !== clean(input.lineageHash)
    || revision.documentIdentityHash !== clean(input.sourceDocumentIdentityHash)
    || !descriptorHashes.length || new Set(descriptorHashes).size !== descriptorHashes.length) return null;
  const statistics = input.fragmentDescriptors.map((descriptor) => {
    if (descriptor.fragmentClass !== 'short_symbolic'
      || !validSha256(descriptor.fragmentSha256)
      || !Number.isInteger(descriptor.normalizedLength)
      || descriptor.normalizedLength < 1
      || descriptor.normalizedLength > SUBJECT_PRACTICE_COMMON_FRAGMENT_MAXIMUM_NORMALIZED_LENGTH
      || !revision.fragmentHashes.has(descriptor.fragmentSha256)) return null;
    const statistic = details.fragmentStatistics.get(descriptor.fragmentSha256);
    return statistic && statistic.normalizedLength === descriptor.normalizedLength ? statistic : null;
  });
  if (statistics.some((statistic) => !statistic)) return null;
  const provenStatistics = statistics as FragmentStatistic[];
  const minimumIndependentLineageCount = Math.min(...provenStatistics.map((item) => item.independentLineageCount));
  const minimumIndependentDocumentCount = Math.min(...provenStatistics.map((item) => item.independentDocumentCount));
  if (minimumIndependentLineageCount < SUBJECT_PRACTICE_COMMON_FRAGMENT_MINIMUM_INDEPENDENT_LINEAGES
    || minimumIndependentDocumentCount < SUBJECT_PRACTICE_COMMON_FRAGMENT_MINIMUM_INDEPENDENT_LINEAGES) return null;
  const sortedDescriptors = [...input.fragmentDescriptors].sort((left, right) =>
    left.fragmentSha256.localeCompare(right.fragmentSha256));
  const proofBody = {
    kind: 'subject_practice_common_fragment_corpus_statistics_proof' as const,
    proofVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_PROOF_VERSION,
    policyVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION,
    inventoryManifestSha256: qualification.inventoryManifestSha256,
    corpusSnapshotSha256: qualification.corpusSnapshotSha256,
    structuredRevisionSetSha256: qualification.structuredRevisionSetSha256,
    sourceQuestionRevisionId: clean(input.sourceQuestionRevisionId),
    lineageHash: clean(input.lineageHash),
    sourceDocumentIdentityHash: clean(input.sourceDocumentIdentityHash),
    fragmentClass: 'short_symbolic' as const,
    fragmentSetSha256: subjectPracticeCommonFragmentDescriptorSetSha256(sortedDescriptors),
    maximumNormalizedFragmentLength: Math.max(...sortedDescriptors.map((item) => item.normalizedLength)),
    minimumIndependentLineageCount,
    minimumIndependentDocumentCount,
    fragmentStatisticsSha256: qualification.fragmentStatisticsSha256,
    corpusQualificationSha256: qualification.qualificationSha256
  } as const;
  const proof = Object.freeze({ ...proofBody, proofSha256: sha256(proofBody) });
  trustedCorpusProofs.add(proof);
  return proof;
}

export function subjectPracticeCommonFragmentCorpusProofMatches(input: {
  proof: SubjectPracticeCommonFragmentCorpusProof | null | undefined;
  expectedCorpusSnapshotSha256: string;
  expectedSourceQuestionRevisionId: string;
  expectedLineageHash: string;
  expectedSourceDocumentIdentityHash: string;
  expectedFragmentSetSha256: string;
}) {
  const proof = input.proof;
  if (!proof || !trustedCorpusProofs.has(proof) || !Object.isFrozen(proof)) return false;
  const { proofSha256, ...body } = proof;
  return proof.proofVersion === SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_PROOF_VERSION
    && proof.policyVersion === SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION
    && proof.corpusSnapshotSha256 === input.expectedCorpusSnapshotSha256
    && proof.sourceQuestionRevisionId === input.expectedSourceQuestionRevisionId
    && proof.lineageHash === input.expectedLineageHash
    && proof.sourceDocumentIdentityHash === input.expectedSourceDocumentIdentityHash
    && proof.fragmentSetSha256 === input.expectedFragmentSetSha256
    && proof.minimumIndependentLineageCount >= SUBJECT_PRACTICE_COMMON_FRAGMENT_MINIMUM_INDEPENDENT_LINEAGES
    && proof.minimumIndependentDocumentCount >= SUBJECT_PRACTICE_COMMON_FRAGMENT_MINIMUM_INDEPENDENT_LINEAGES
    && proof.maximumNormalizedFragmentLength <= SUBJECT_PRACTICE_COMMON_FRAGMENT_MAXIMUM_NORMALIZED_LENGTH
    && validSha256(proof.corpusQualificationSha256)
    && proof.proofSha256 === sha256(body);
}
