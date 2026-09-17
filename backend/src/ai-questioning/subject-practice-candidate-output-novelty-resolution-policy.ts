import { createHash } from 'node:crypto';
import {
  SubjectPracticeCandidateOutputNoveltyEvidence,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} from './subject-practice-candidate-output-novelty-policy';
import {
  SubjectPracticeFormalGraphDistinctOpaqueProof,
  SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
  subjectPracticeFormalGraphDistinctOpaqueProofValid
} from './subject-practice-canonical-task-graph-policy';
import {
  SubjectPracticeCommonFragmentCorpusProof,
  subjectPracticeCommonFragmentCorpusProofMatches,
  subjectPracticeCommonFragmentDescriptorSetSha256
} from './subject-practice-common-fragment-corpus-policy';
import {
  SubjectPracticeSourceCorpusLengthQualification,
  subjectPracticeSourceCorpusLengthQualificationMatches
} from './subject-practice-source-corpus-length-policy';
import {
  SubjectPracticeSourceCorpusCalibrationQualityQualification,
  subjectPracticeSourceCorpusCalibrationQualityQualificationMatches,
  subjectPracticeSourceCorpusCalibrationReachableCellSetSha256
} from './subject-practice-source-corpus-calibration-policy';

export const SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION =
  'subject-practice-candidate-novelty-resolution-shadow-policy-v7';
export const SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_PROOF_VERSION =
  'subject-practice-candidate-novelty-graph-distinct-opaque-proof-v2';
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION =
  'subject-practice-complete-corpus-common-fragment-opaque-proof-v4';
export const SUBJECT_PRACTICE_COMMON_FRAGMENT_PROVISIONAL_MINIMUM_INDEPENDENT_LINEAGES = 20;

type GraphDistinctProof = Readonly<{
  kind: 'formal_graph_distinct_proof';
  proofVersion: typeof SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_PROOF_VERSION;
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceRevisionMatchSha256: string;
  candidateContentSha256: string;
  corpusSnapshotSha256: string;
  graphPolicyVersion: string;
  candidateTaskGraphSha256: string;
  sourceTaskGraphSha256: string;
  candidateSolutionGraphSha256: string;
  sourceSolutionGraphSha256: string;
  distinctWitnessSha256: string;
  distinctWitnessKind: 'different_givens' | 'different_target' | 'different_relation' | 'different_solution_parameters';
  verificationStatus: 'verified_distinct';
}>;

type CommonFragmentProof = Readonly<{
  kind: 'complete_corpus_low_information_fragment_proof';
  proofVersion: typeof SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION;
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceDocumentIdentityHash: string;
  sourceRevisionMatchSha256: string;
  candidateContentSha256: string;
  corpusSnapshotSha256: string;
  corpusCoverageStatus: 'complete' | 'partial';
  corpusQualificationSha256: string;
  thresholdCalibrationQualificationSha256: string;
  lengthPolicyQualificationSha256: string;
  commonFragmentCorpusProofSha256: string;
  capabilityChainSha256: string;
  fragmentClass: 'short_symbolic' | 'standard_unit' | 'standard_angle' | 'syllabus_term';
  fragmentSetSha256: string;
  maximumNormalizedFragmentLength: number;
  independentLineageDocumentCount: number;
}>;

export type SubjectPracticeCandidateNoveltyResolutionProof = GraphDistinctProof | CommonFragmentProof;

const trustedGraphDistinctResolutionProofs = new WeakSet<object>();
const trustedCommonFragmentProofs = new WeakSet<object>();

const sha256Pattern = /^[a-f0-9]{64}$/;
const validSha256 = (value: unknown) => sha256Pattern.test(String(value ?? '').trim());
const commonFragmentCapabilityChainSha256 = (input: {
  corpusQualificationSha256: string;
  commonFragmentCorpusProofSha256: string;
  lengthPolicyQualificationSha256: string;
  thresholdCalibrationQualificationSha256: string;
}) => createHash('sha256').update(JSON.stringify({
  corpusQualificationSha256: input.corpusQualificationSha256,
  commonFragmentCorpusProofSha256: input.commonFragmentCorpusProofSha256,
  lengthPolicyQualificationSha256: input.lengthPolicyQualificationSha256,
  thresholdCalibrationQualificationSha256: input.thresholdCalibrationQualificationSha256
})).digest('hex');

export function createSubjectPracticeCandidateNoveltyGraphDistinctProof(input: {
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceRevisionMatchSha256: string;
  candidateContentSha256: string;
  corpusSnapshotSha256: string;
  formalGraphDistinctProof: SubjectPracticeFormalGraphDistinctOpaqueProof;
}): GraphDistinctProof | null {
  const formalProof = input.formalGraphDistinctProof;
  if (!validSha256(input.sourceRevisionMatchSha256)
    || !validSha256(input.candidateContentSha256)
    || !validSha256(input.corpusSnapshotSha256)
    || !input.sourceQuestionRevisionId.trim()
    || !input.lineageHash.trim()
    || !subjectPracticeFormalGraphDistinctOpaqueProofValid({
      proof: formalProof,
      sourceTaskGraphSha256: formalProof?.sourceTaskGraphSha256,
      candidateTaskGraphSha256: formalProof?.candidateTaskGraphSha256,
      sourceSolutionGraphSha256: formalProof?.sourceSolutionGraphSha256,
      candidateSolutionGraphSha256: formalProof?.candidateSolutionGraphSha256
    })) return null;
  const proof = Object.freeze({
    kind: 'formal_graph_distinct_proof' as const,
    proofVersion: SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_PROOF_VERSION,
    sourceQuestionRevisionId: input.sourceQuestionRevisionId.trim(),
    lineageHash: input.lineageHash.trim(),
    sourceRevisionMatchSha256: input.sourceRevisionMatchSha256,
    candidateContentSha256: input.candidateContentSha256,
    corpusSnapshotSha256: input.corpusSnapshotSha256,
    graphPolicyVersion: SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
    candidateTaskGraphSha256: formalProof.candidateTaskGraphSha256,
    sourceTaskGraphSha256: formalProof.sourceTaskGraphSha256,
    candidateSolutionGraphSha256: formalProof.candidateSolutionGraphSha256,
    sourceSolutionGraphSha256: formalProof.sourceSolutionGraphSha256,
    distinctWitnessSha256: formalProof.distinctWitnessSha256,
    distinctWitnessKind: formalProof.distinctWitnessKind,
    verificationStatus: 'verified_distinct' as const
  });
  trustedGraphDistinctResolutionProofs.add(proof);
  return proof;
}

export function createSubjectPracticeCandidateNoveltyCommonFragmentProof(input: {
  sourceRevisionMatch: SubjectPracticeCandidateOutputNoveltyEvidence['nonClearRevisionMatches'][number];
  candidateContentSha256: string;
  corpusSnapshotSha256: string;
  corpusProof: SubjectPracticeCommonFragmentCorpusProof;
  lengthQualification: SubjectPracticeSourceCorpusLengthQualification;
  calibrationQualification: SubjectPracticeSourceCorpusCalibrationQualityQualification;
}): CommonFragmentProof | null {
  const match = input.sourceRevisionMatch;
  const corpusProof = input.corpusProof;
  const lengthQualification = input.lengthQualification;
  const calibrationQualification = input.calibrationQualification;
  const expectedFragmentSetSha256 = subjectPracticeCommonFragmentDescriptorSetSha256(
    match?.weakFragmentDescriptors ?? []
  );
  const corpusProofValid = subjectPracticeCommonFragmentCorpusProofMatches({
    proof: corpusProof,
    expectedCorpusSnapshotSha256: input.corpusSnapshotSha256,
    expectedSourceQuestionRevisionId: match?.sourceQuestionRevisionId ?? '',
    expectedLineageHash: match?.lineageHash ?? '',
    expectedSourceDocumentIdentityHash: match?.sourceDocumentIdentityHash ?? '',
    expectedFragmentSetSha256
  });
  const lengthQualificationValid = subjectPracticeSourceCorpusLengthQualificationMatches({
    qualification: lengthQualification,
    expectedInventoryManifestSha256: corpusProof.inventoryManifestSha256,
    expectedInventorySnapshotSha256: input.corpusSnapshotSha256,
    expectedGeneratorVersionSetSha256: lengthQualification.generatorVersionSetSha256,
    expectedRendererVersionSetSha256: lengthQualification.rendererVersionSetSha256
  });
  const calibrationQualificationValid =
    subjectPracticeSourceCorpusCalibrationQualityQualificationMatches({
      qualification: calibrationQualification,
      expectedDatasetSnapshotSha256: calibrationQualification.datasetSnapshotSha256,
      expectedInventoryManifestSha256: corpusProof.inventoryManifestSha256,
      expectedInventorySnapshotSha256: input.corpusSnapshotSha256,
      expectedGeneratorVersionSetSha256: lengthQualification.generatorVersionSetSha256,
      expectedRendererVersionSetSha256: lengthQualification.rendererVersionSetSha256,
      expectedLengthPolicyQualificationSha256: lengthQualification.qualificationSha256,
      expectedPrimaryReachableCellSetSha256:
        subjectPracticeSourceCorpusCalibrationReachableCellSetSha256(
          lengthQualification.reachableCellKeys
        )
    });
  if (!match || match.status !== 'ambiguous'
    || match.reasonCodes.length !== 1
    || match.reasonCodes[0] !== 'candidate_novelty_common_symbolic_fragment_only'
    || !match.weakFragmentDescriptors.length
    || !validSha256(input.candidateContentSha256)
    || !validSha256(input.corpusSnapshotSha256)
    || lengthQualification.structuredCorpusQualificationSha256
      !== corpusProof.corpusQualificationSha256
    || calibrationQualification.lengthPolicyQualificationSha256
      !== lengthQualification.qualificationSha256
    || !corpusProofValid || !lengthQualificationValid || !calibrationQualificationValid) return null;
  const capabilityBindings = {
    corpusQualificationSha256: corpusProof.corpusQualificationSha256,
    commonFragmentCorpusProofSha256: corpusProof.proofSha256,
    lengthPolicyQualificationSha256: lengthQualification.qualificationSha256,
    thresholdCalibrationQualificationSha256: calibrationQualification.qualificationSha256
  };
  const proof = Object.freeze({
    kind: 'complete_corpus_low_information_fragment_proof' as const,
    proofVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION,
    sourceQuestionRevisionId: match.sourceQuestionRevisionId,
    lineageHash: match.lineageHash,
    sourceDocumentIdentityHash: match.sourceDocumentIdentityHash,
    sourceRevisionMatchSha256: match.matchSha256,
    candidateContentSha256: input.candidateContentSha256,
    corpusSnapshotSha256: input.corpusSnapshotSha256,
    corpusCoverageStatus: 'complete' as const,
    ...capabilityBindings,
    capabilityChainSha256: commonFragmentCapabilityChainSha256(capabilityBindings),
    fragmentClass: corpusProof.fragmentClass,
    fragmentSetSha256: corpusProof.fragmentSetSha256,
    maximumNormalizedFragmentLength: corpusProof.maximumNormalizedFragmentLength,
    independentLineageDocumentCount: Math.min(
      corpusProof.minimumIndependentLineageCount,
      corpusProof.minimumIndependentDocumentCount
    )
  });
  trustedCommonFragmentProofs.add(proof);
  return proof;
}

function commonBindingsValid(
  proof: SubjectPracticeCandidateNoveltyResolutionProof,
  match: SubjectPracticeCandidateOutputNoveltyEvidence['nonClearRevisionMatches'][number],
  candidateContentSha256: string,
  corpusSnapshotSha256: string
) {
  return proof.sourceQuestionRevisionId === match.sourceQuestionRevisionId
    && proof.lineageHash === match.lineageHash
    && proof.sourceRevisionMatchSha256 === match.matchSha256
    && proof.candidateContentSha256 === candidateContentSha256
    && proof.corpusSnapshotSha256 === corpusSnapshotSha256
    && validSha256(proof.sourceRevisionMatchSha256)
    && validSha256(proof.candidateContentSha256)
    && validSha256(proof.corpusSnapshotSha256);
}




export function resolveSubjectPracticeCandidateOutputNovelty(input: {
  noveltyEvidence: SubjectPracticeCandidateOutputNoveltyEvidence;
  candidateContentSha256: string;
  corpusSnapshotSha256: string;
  proofs: SubjectPracticeCandidateNoveltyResolutionProof[];
}) {
  const evidenceCompatible = input.noveltyEvidence.policyVersion
      === SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
    && input.noveltyEvidence.structuredCorpusSchemaVersion
      === SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    && validSha256(input.candidateContentSha256)
    && validSha256(input.corpusSnapshotSha256);
  const duplicateProofRevisionIds = Array.from(new Set(input.proofs.map((proof) => proof.sourceQuestionRevisionId)
    .filter((revisionId, index, values) => values.indexOf(revisionId) !== index))).sort();
  const validProofKindsByRevision = new Map<string, SubjectPracticeCandidateNoveltyResolutionProof['kind']>();
  let invalidProofCount = 0;

  for (const proof of input.proofs) {
    const match = input.noveltyEvidence.nonClearRevisionMatches.find((item) =>
      item.sourceQuestionRevisionId === proof.sourceQuestionRevisionId);
    let valid = Boolean(match && match.status === 'ambiguous' && evidenceCompatible
      && !duplicateProofRevisionIds.includes(proof.sourceQuestionRevisionId)
      && commonBindingsValid(proof, match!, input.candidateContentSha256, input.corpusSnapshotSha256));
    if (valid && proof.kind === 'formal_graph_distinct_proof') {
      valid = trustedGraphDistinctResolutionProofs.has(proof)
        && match!.reasonCodes.includes('candidate_novelty_weak_same_revision_signal_requires_review')
        && !match!.reasonCodes.includes('candidate_novelty_common_symbolic_fragment_only')
        && proof.proofVersion === SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_PROOF_VERSION
        && proof.verificationStatus === 'verified_distinct'
        && proof.graphPolicyVersion === SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION
        && validSha256(proof.candidateTaskGraphSha256)
        && validSha256(proof.sourceTaskGraphSha256)
        && validSha256(proof.candidateSolutionGraphSha256)
        && validSha256(proof.sourceSolutionGraphSha256)
        && validSha256(proof.distinctWitnessSha256)
        && proof.candidateTaskGraphSha256 !== proof.sourceTaskGraphSha256;
    } else if (valid && proof.kind === 'complete_corpus_low_information_fragment_proof') {
      valid = trustedCommonFragmentProofs.has(proof)
        && proof.proofVersion === SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION
        && match!.reasonCodes.length === 1
        && match!.reasonCodes[0] === 'candidate_novelty_common_symbolic_fragment_only'
        && proof.sourceDocumentIdentityHash === match!.sourceDocumentIdentityHash
        && proof.corpusCoverageStatus === 'complete'
        && validSha256(proof.corpusQualificationSha256)
        && validSha256(proof.thresholdCalibrationQualificationSha256)
        && validSha256(proof.lengthPolicyQualificationSha256)
        && validSha256(proof.commonFragmentCorpusProofSha256)
        && validSha256(proof.capabilityChainSha256)
        && proof.capabilityChainSha256 === commonFragmentCapabilityChainSha256(proof)
        && validSha256(proof.fragmentSetSha256)
        && proof.maximumNormalizedFragmentLength <= 24
        && proof.independentLineageDocumentCount
          >= SUBJECT_PRACTICE_COMMON_FRAGMENT_PROVISIONAL_MINIMUM_INDEPENDENT_LINEAGES;
    }
    if (valid) validProofKindsByRevision.set(proof.sourceQuestionRevisionId, proof.kind);
    else invalidProofCount += 1;
  }

  const ambiguousMatches = input.noveltyEvidence.nonClearRevisionMatches.filter((match) => match.status === 'ambiguous');
  const unresolvedRevisionIds = ambiguousMatches.filter((match) =>
    !validProofKindsByRevision.has(match.sourceQuestionRevisionId))
    .map((match) => match.sourceQuestionRevisionId).sort();
  const strongBlockPresent = input.noveltyEvidence.status === 'blocked'
    || input.noveltyEvidence.nonClearRevisionMatches.some((match) => match.status === 'block');
  const status = strongBlockPresent ? 'blocked'
    : !evidenceCompatible || duplicateProofRevisionIds.length || unresolvedRevisionIds.length ? 'ambiguous'
      : 'clear';
  const reasonCodes = strongBlockPresent
    ? ['candidate_novelty_resolution_strong_block_cannot_be_overridden']
    : !evidenceCompatible ? ['candidate_novelty_resolution_evidence_binding_invalid']
      : duplicateProofRevisionIds.length ? ['candidate_novelty_resolution_duplicate_proof_revision']
        : unresolvedRevisionIds.length ? ['candidate_novelty_resolution_revision_unresolved']
          : ['candidate_novelty_resolution_all_weak_revisions_resolved'];
  const resolutionSetSha256 = createHash('sha256').update(JSON.stringify({
    candidateContentSha256: input.candidateContentSha256,
    corpusSnapshotSha256: input.corpusSnapshotSha256,
    noveltyRevisionMatchSetSha256: input.noveltyEvidence.revisionMatchSetSha256,
    resolved: Array.from(validProofKindsByRevision.entries()).sort(([left], [right]) => left.localeCompare(right)),
    unresolvedRevisionIds
  })).digest('hex');

  return {
    policyVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION,
    status,
    reasonCodes,
    ambiguousRevisionCount: ambiguousMatches.length,
    resolvedRevisionCount: validProofKindsByRevision.size,
    unresolvedRevisionCount: unresolvedRevisionIds.length,
    invalidProofCount,
    duplicateProofRevisionCount: duplicateProofRevisionIds.length,
    unresolvedRevisionIds,
    resolutionSetSha256,
    strongBlockOverrideForbidden: true as const,
    everyWeakRevisionRequiresIndependentResolution: true as const,
    repairFeedbackMayExposeSourceIdentityOrText: false as const,
    formalQualificationEligible: false as const,
    qualificationBoundary: 'shadow_only_common_fragment_threshold_and_corpus_trust_not_formally_frozen' as const
  };
}
