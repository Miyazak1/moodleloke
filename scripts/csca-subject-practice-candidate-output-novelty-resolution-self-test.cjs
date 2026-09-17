#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  resolveSubjectPracticeCandidateOutputNovelty,
  createSubjectPracticeCandidateNoveltyGraphDistinctProof,
  createSubjectPracticeCandidateNoveltyCommonFragmentProof,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION,
  SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_PROOF_VERSION,
  SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-resolution-policy');
const {
  qualification: commonCorpusQualification,
  commonProof: commonCorpusProof,
  source: commonCorpusSource
} = require('./csca-subject-practice-common-fragment-corpus-self-test.cjs');
const {
  qualification: lengthPolicyQualification
} = require('./csca-subject-practice-source-corpus-length-policy-self-test.cjs');
const {
  qualityQualification: calibrationQualityQualification
} = require('./csca-subject-practice-source-corpus-calibration-self-test.cjs');
const {
  createSubjectPracticeFormalGraphDistinctOpaqueProof
} = require('../backend/src/ai-questioning/subject-practice-canonical-task-graph-policy');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const ids = ['A', 'B', 'C', 'D'];
function candidate(prompt, options) {
  return {
    subject: 'math', topicId: 1, blueprintId: 1, sourceType: 'ai', designedDifficulty: 'basic',
    questionType: 'single_choice', prompt, options: options.map((text, index) => ({ id: ids[index], text })),
    correctAnswer: 'A', explanation: 'An independent derivation verifies the selected option.',
    knowledgeTags: ['fixture'], optionMetadata: [], syllabusVersion: 'fixture-v1'
  };
}
function source(id, prompt, options) {
  return buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: 'local_file', documentId: `doc-${id}`, questionOrdinal: '1', subject: 'math', language: 'en',
    prompt, options, answer: 'A', explanation: `Distinct source explanation ${id}.`,
    documentIdentityHash: sha256(`identity-${id}`)
  });
}

const candidateContentSha256 = sha256('candidate-content');
const corpusSnapshotSha256 = sha256('corpus-snapshot');
const weakCandidate = candidate('Determine the requested relation from independent data.', ['x=1', 'x=2', 'y=1', 'y=2']);
const weakEvidence = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: weakCandidate,
  sourceRevisions: [
    source('weak-one', 'From arithmetic data, choose a requested relation.', ['x=1', '7', '8', '9']),
    source('weak-two', 'From geometry data, choose a requested relation.', ['x=2', '10', '11', '12'])
  ]
});
const commonOnlyEvidence = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: weakCandidate,
  sourceRevisions: [
    source('common-one', 'Find a value in an unrelated arithmetic problem.', ['x=1', '7', '8', '9']),
    source('common-two', 'Choose a value in a separate geometry problem.', ['x=2', '10', '11', '12'])
  ]
});
function graphProof(match, suffix) {
  const task = (value) => ({
    schemaVersion: 'subject-practice-canonical-task-graph-v1', subject: 'math',
    syllabusScope: 'fixture-scope', taskFamily: 'fixture-family', verificationScope: 'fixture-scope',
    typedGivens: [{ symbol: 'x', value }], target: { kind: 'value', expression: { symbol: 'x' } },
    assumptions: [], relationAst: { op: 'identity', value },
    optionSemantics: [{ semanticValue: value, isCorrect: true }],
    parserVersion: 'fixture-parser-v1', normalizerVersion: 'fixture-normalizer-v1'
  });
  const solution = (value) => ({
    schemaVersion: 'subject-practice-canonical-solution-graph-v1',
    steps: [{ rule: 'identity', inputs: [value], output: value }],
    derivedValues: [{ symbol: 'x', value }], finalSemanticAnswer: value,
    solverVersion: 'fixture-solver-v1', oracleVersion: 'fixture-oracle-v1'
  });
  const formalGraphDistinctProof = createSubjectPracticeFormalGraphDistinctOpaqueProof({
    sourceTaskGraph: task(`source-${suffix}`), candidateTaskGraph: task(`candidate-${suffix}`),
    sourceSolutionGraph: solution(`source-${suffix}`), candidateSolutionGraph: solution(`candidate-${suffix}`),
    verifierVersion: 'fixture-distinct-verifier-v1'
  });
  if (!formalGraphDistinctProof) throw new Error('fixture_formal_graph_distinct_proof_missing');
  return createSubjectPracticeCandidateNoveltyGraphDistinctProof({
    sourceQuestionRevisionId: match.sourceQuestionRevisionId,
    lineageHash: match.lineageHash,
    sourceRevisionMatchSha256: match.matchSha256,
    candidateContentSha256,
    corpusSnapshotSha256,
    formalGraphDistinctProof
  });
}
function commonProof(match, coverage = 'complete') {
  return {
    kind: 'complete_corpus_low_information_fragment_proof',
    proofVersion: SUBJECT_PRACTICE_COMMON_FRAGMENT_PROOF_VERSION,
    sourceQuestionRevisionId: match.sourceQuestionRevisionId,
    lineageHash: match.lineageHash,
    sourceRevisionMatchSha256: match.matchSha256,
    candidateContentSha256,
    corpusSnapshotSha256,
    corpusCoverageStatus: coverage,
    corpusQualificationSha256: sha256('corpus-qualification'),
    thresholdCalibrationQualificationSha256: sha256('threshold-calibration'),
    fragmentClass: 'short_symbolic',
    fragmentSetSha256: sha256(`fragment-${match.sourceQuestionRevisionId}`),
    maximumNormalizedFragmentLength: 3,
    independentLineageDocumentCount: 20
  };
}

const weakMatches = weakEvidence.nonClearRevisionMatches;
const commonOnlyMatches = commonOnlyEvidence.nonClearRevisionMatches;
const oneOfTwoResolved = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: weakEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: [graphProof(weakMatches[0], 'one')]
});
const allResolved = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: weakEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: weakMatches.map((match, index) => graphProof(match, index))
});
const partialCorpusProof = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: commonOnlyEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: commonOnlyMatches.map((match) => commonProof(match, 'partial'))
});
const completeCorpusProof = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: commonOnlyEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: commonOnlyMatches.map((match) => commonProof(match, 'complete'))
});
const graphCannotOverrideCommonOnly = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: commonOnlyEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: [graphProof(commonOnlyMatches[0], 'common-only')]
});
const wrongBinding = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: weakEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: [{ ...graphProof(weakMatches[0], 'wrong'), sourceRevisionMatchSha256: sha256('wrong-match') }]
});
const copiedGraphProof = { ...graphProof(weakMatches[0], 'copied') };
const copiedProofRejected = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: weakEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: [copiedGraphProof]
});
const trustedCommonCandidate = {
  ...candidate('Choose the correct result.', ['x=1', 'u=101', 'v=202', 'w=303']),
  explanation: 'Verified through a separate calculation.'
};
const trustedCommonEvidence = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: trustedCommonCandidate,
  sourceRevisions: [commonCorpusSource]
});
const trustedCommonMatch = trustedCommonEvidence.nonClearRevisionMatches[0];
const trustedCommonResolutionProof = createSubjectPracticeCandidateNoveltyCommonFragmentProof({
  sourceRevisionMatch: trustedCommonMatch,
  candidateContentSha256,
  corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
  corpusProof: commonCorpusProof,
  lengthQualification: lengthPolicyQualification,
  calibrationQualification: calibrationQualityQualification
});
const trustedCommonResolved = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: trustedCommonEvidence,
  candidateContentSha256,
  corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
  proofs: trustedCommonResolutionProof ? [trustedCommonResolutionProof] : []
});
const copiedTrustedCommonResolved = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: trustedCommonEvidence,
  candidateContentSha256,
  corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
  proofs: trustedCommonResolutionProof ? [{ ...trustedCommonResolutionProof }] : []
});
const copiedCalibrationCannotConstructCommonProof = createSubjectPracticeCandidateNoveltyCommonFragmentProof({
  sourceRevisionMatch: trustedCommonMatch,
  candidateContentSha256,
  corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
  corpusProof: commonCorpusProof,
  lengthQualification: lengthPolicyQualification,
  calibrationQualification: { ...calibrationQualityQualification }
});
const copiedLengthCannotConstructCommonProof = createSubjectPracticeCandidateNoveltyCommonFragmentProof({
  sourceRevisionMatch: trustedCommonMatch,
  candidateContentSha256,
  corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
  corpusProof: commonCorpusProof,
  lengthQualification: { ...lengthPolicyQualification },
  calibrationQualification: calibrationQualityQualification
});
const copiedCorpusStatisticsCannotConstructCommonProof =
  createSubjectPracticeCandidateNoveltyCommonFragmentProof({
    sourceRevisionMatch: trustedCommonMatch,
    candidateContentSha256,
    corpusSnapshotSha256: commonCorpusQualification.corpusSnapshotSha256,
    corpusProof: { ...commonCorpusProof },
    lengthQualification: lengthPolicyQualification,
    calibrationQualification: calibrationQualityQualification
  });
const snapshotDriftCannotConstructCommonProof = createSubjectPracticeCandidateNoveltyCommonFragmentProof({
  sourceRevisionMatch: trustedCommonMatch,
  candidateContentSha256,
  corpusSnapshotSha256: sha256('different-corpus-snapshot'),
  corpusProof: commonCorpusProof,
  lengthQualification: lengthPolicyQualification,
  calibrationQualification: calibrationQualityQualification
});
const strongEvidence = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: weakCandidate,
  sourceRevisions: [source('strong', weakCandidate.prompt, ['u', 'v', 'w', 'z'])]
});
const strongCannotBeOverridden = resolveSubjectPracticeCandidateOutputNovelty({
  noveltyEvidence: strongEvidence, candidateContentSha256, corpusSnapshotSha256,
  proofs: []
});

const checks = {
  fixtureHasTwoWeakRevisions: weakEvidence.status === 'ambiguous' && weakMatches.length === 2,
  partialResolutionRemainsAmbiguous: oneOfTwoResolved.status === 'ambiguous'
    && oneOfTwoResolved.resolvedRevisionCount === 1 && oneOfTwoResolved.unresolvedRevisionCount === 1,
  allWeakRevisionsRequireResolution: allResolved.status === 'clear'
    && allResolved.resolvedRevisionCount === 2 && allResolved.unresolvedRevisionCount === 0,
  partialCorpusCommonProofFailsClosed: partialCorpusProof.status === 'ambiguous'
    && partialCorpusProof.invalidProofCount === 2,
  plainCompleteCorpusCommonProofCannotResolveWithoutTrustedConstructor:
    completeCorpusProof.status === 'ambiguous' && completeCorpusProof.invalidProofCount === 2,
  graphProofCannotOverrideCommonOnlyReason: graphCannotOverrideCommonOnly.status === 'ambiguous'
    && graphCannotOverrideCommonOnly.invalidProofCount === 1,
  wrongMatchBindingFailsClosed: wrongBinding.status === 'ambiguous' && wrongBinding.invalidProofCount === 1,
  copiedGraphProofRejected: copiedProofRejected.status === 'ambiguous'
    && copiedProofRejected.invalidProofCount === 1,
  trustedCommonCapabilityChainResolvesCommonOnlyMatch: trustedCommonEvidence.status === 'ambiguous'
    && trustedCommonMatch.reasonCodes.length === 1
    && trustedCommonMatch.reasonCodes[0] === 'candidate_novelty_common_symbolic_fragment_only'
    && trustedCommonResolutionProof !== null
    && trustedCommonResolved.status === 'clear'
    && trustedCommonResolved.resolvedRevisionCount === 1,
  trustedCommonProofBindsDistinctCapabilityLayers: trustedCommonResolutionProof !== null
    && trustedCommonResolutionProof.corpusQualificationSha256
      === commonCorpusProof.corpusQualificationSha256
    && trustedCommonResolutionProof.commonFragmentCorpusProofSha256
      === commonCorpusProof.proofSha256
    && trustedCommonResolutionProof.corpusQualificationSha256
      !== trustedCommonResolutionProof.commonFragmentCorpusProofSha256
    && /^[a-f0-9]{64}$/.test(trustedCommonResolutionProof.capabilityChainSha256),
  copiedTrustedCommonResolutionProofRejected: copiedTrustedCommonResolved.status === 'ambiguous'
    && copiedTrustedCommonResolved.invalidProofCount === 1,
  copiedCalibrationCapabilityCannotConstructCommonProof:
    copiedCalibrationCannotConstructCommonProof === null,
  copiedLengthCapabilityCannotConstructCommonProof: copiedLengthCannotConstructCommonProof === null,
  copiedCorpusStatisticsProofCannotConstructCommonProof:
    copiedCorpusStatisticsCannotConstructCommonProof === null,
  corpusSnapshotDriftCannotConstructCommonProof: snapshotDriftCannotConstructCommonProof === null,
  strongBlockCannotBeOverridden: strongCannotBeOverridden.status === 'blocked'
    && strongCannotBeOverridden.strongBlockOverrideForbidden,
  resolutionRemainsShadowOnly: [oneOfTwoResolved, allResolved, partialCorpusProof, completeCorpusProof,
    trustedCommonResolved, copiedTrustedCommonResolved,
    graphCannotOverrideCommonOnly, wrongBinding, copiedProofRejected,
    strongCannotBeOverridden].every((item) => item.formalQualificationEligible === false),
  repairFeedbackCannotExposeSource: allResolved.repairFeedbackMayExposeSourceIdentityOrText === false,
  policyVersioned: /-v\d+$/.test(SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION)
};
const report = {
  mode: 'subject_practice_candidate_output_novelty_resolution_self_test',
  reportVersion: 'subject-practice-candidate-output-novelty-resolution-self-test-v7',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  weakRevisionCount: weakMatches.length,
  outcomes: {
    oneOfTwoResolved: oneOfTwoResolved.status,
    allResolved: allResolved.status,
    partialCorpusProof: partialCorpusProof.status,
    completeCorpusProof: completeCorpusProof.status,
    trustedCommonResolved: trustedCommonResolved.status,
    trustedCommonEvidenceStatus: trustedCommonEvidence.status,
    trustedCommonReasonCodes: trustedCommonMatch?.reasonCodes ?? [],
    trustedCommonResolutionProofCreated: Boolean(trustedCommonResolutionProof),
    wrongBinding: wrongBinding.status,
    strongCannotBeOverridden: strongCannotBeOverridden.status
  },
  providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only', publicationImpact: 'none_shadow_only'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
