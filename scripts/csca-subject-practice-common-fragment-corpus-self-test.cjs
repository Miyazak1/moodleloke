#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const {
  buildSubjectPracticeSourceCorpusInventoryManifest
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  createSubjectPracticeCommonFragmentCorpusQualification: createSubjectPracticeCommonFragmentCorpusQualificationWithTopology,
  subjectPracticeCommonFragmentCorpusQualificationMatches,
  createSubjectPracticeCommonFragmentCorpusProof,
  subjectPracticeCommonFragmentCorpusProofMatches,
  SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-common-fragment-corpus-policy');
const {
  buildFixtureTopologyBinding
} = require('./csca-subject-practice-source-corpus-topology-fixture.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const systems = ['local_file', 'production_database', 'remote_sync'];
const inventoryTopology = buildFixtureTopologyBinding([
  { sourceId: 'local', kind: 'local_file' },
  { sourceId: 'database', kind: 'database_query' },
  { sourceId: 'remote', kind: 'remote_sync' }
], 'common-fragment-self-test');

function createSubjectPracticeCommonFragmentCorpusQualification(input) {
  return createSubjectPracticeCommonFragmentCorpusQualificationWithTopology({
    ...input,
    topology: inventoryTopology.topology
  });
}

function inventorySource(sourceId, kind, count, status = 'complete') {
  return {
    sourceId,
    kind,
    locatorFingerprintSha256: sha256(`locator:${sourceId}`),
    expectedCount: count,
    observedCount: status === 'complete' ? count : 0,
    highWatermark: 'fixture-watermark-v1',
    updatedAt: '2026-09-13T00:00:00.000Z',
    extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
    status
  };
}

function manifest(count = 400, remoteStatus = 'complete') {
  return buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: ['local', 'database', 'remote'],
    topology: inventoryTopology.topology,
    sources: [
      inventorySource('local', 'local_file', count),
      inventorySource('database', 'database_query', count),
      inventorySource('remote', 'remote_sync', count, remoteStatus)
    ]
  });
}

function revisions(input = {}) {
  const sharedDocumentIdentity = input.sharedDocumentIdentity ?? false;
  return Array.from({ length: 1200 }, (_, index) => {
    const combinationIndex = Math.floor(index / 200);
    const sampleIndex = index % 200;
    return buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: systems[index % systems.length],
    documentId: `document-${index}`,
    questionOrdinal: String(index + 1),
    subject: ['math', 'physics', 'chemistry'][Math.floor(combinationIndex / 2)],
    language: combinationIndex % 2 ? 'zh' : 'en',
    prompt: `Question ${'p'.repeat(sampleIndex + 1)}`,
    options: ['x=1', index === 0 ? 'y=9' : `v=${'z'.repeat(sampleIndex + 1)}`, 'alpha', 'beta'],
    answer: `A${'a'.repeat(sampleIndex)}`,
    explanation: `Reason ${'e'.repeat(sampleIndex + 1)}`,
    localizations: {
      [combinationIndex % 2 ? 'en' : 'zh']: {
        prompt: `Localized ${'l'.repeat(sampleIndex + 1)}`,
        options: ['x=1', `w=${'q'.repeat(sampleIndex + 1)}`, 'gamma', 'delta'],
        answer: 'A',
        explanation: `Localized reason ${'r'.repeat(sampleIndex + 1)}`
      }
    },
    documentIdentityHash: sharedDocumentIdentity ? sha256('one-document') : sha256(`document-${index}`)
    });
  });
}

const completeManifest = manifest();
const corpus = revisions();
const qualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: completeManifest,
  sourceRevisions: corpus
});
if (!qualification) throw new Error('fixture_common_fragment_corpus_qualification_missing');
const qualificationMatches = subjectPracticeCommonFragmentCorpusQualificationMatches({
  qualification,
  expectedInventoryManifestSha256: completeManifest.manifestSha256,
  expectedCorpusSnapshotSha256: qualification.corpusSnapshotSha256
});
const source = corpus[0];
const commonDescriptor = {
  fragmentSha256: sha256('xequal1'),
  normalizedLength: 7,
  fragmentClass: 'short_symbolic'
};
const scarceDescriptor = {
  fragmentSha256: sha256('yequal9'),
  normalizedLength: 7,
  fragmentClass: 'short_symbolic'
};
const commonProof = createSubjectPracticeCommonFragmentCorpusProof({
  qualification,
  sourceQuestionRevisionId: source.sourceQuestionRevisionId,
  lineageHash: source.lineageHash,
  sourceDocumentIdentityHash: source.documentIdentityHash,
  fragmentDescriptors: [commonDescriptor]
});
if (!commonProof) throw new Error('fixture_common_fragment_corpus_proof_missing');
const proofMatches = subjectPracticeCommonFragmentCorpusProofMatches({
  proof: commonProof,
  expectedCorpusSnapshotSha256: qualification.corpusSnapshotSha256,
  expectedSourceQuestionRevisionId: source.sourceQuestionRevisionId,
  expectedLineageHash: source.lineageHash,
  expectedSourceDocumentIdentityHash: source.documentIdentityHash,
  expectedFragmentSetSha256: commonProof.fragmentSetSha256
});
const scarceProof = createSubjectPracticeCommonFragmentCorpusProof({
  qualification,
  sourceQuestionRevisionId: source.sourceQuestionRevisionId,
  lineageHash: source.lineageHash,
  sourceDocumentIdentityHash: source.documentIdentityHash,
  fragmentDescriptors: [scarceDescriptor]
});
const oneDocumentCorpus = revisions({ sharedDocumentIdentity: true });
const oneDocumentQualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: completeManifest,
  sourceRevisions: oneDocumentCorpus
});
const oneDocumentSource = oneDocumentCorpus[0];
const oneDocumentProof = oneDocumentQualification
  ? createSubjectPracticeCommonFragmentCorpusProof({
    qualification: oneDocumentQualification,
    sourceQuestionRevisionId: oneDocumentSource.sourceQuestionRevisionId,
    lineageHash: oneDocumentSource.lineageHash,
    sourceDocumentIdentityHash: oneDocumentSource.documentIdentityHash,
    fragmentDescriptors: [commonDescriptor]
  }) : null;
const mutatedCorpus = corpus.map((revision, index) => index === 0
  ? { ...revision, fields: { ...revision.fields, prompt: 'mutated without rebuilding hashes' } }
  : revision);
const mutatedQualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: completeManifest,
  sourceRevisions: mutatedCorpus
});
const duplicateDocumentIdentity = sha256('duplicate-source-document');
const duplicateSourceRevisions = systems.map((sourceSystem) =>
  buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem,
    documentId: `duplicate-${sourceSystem}`,
    questionOrdinal: '1',
    subject: 'math',
    language: 'en',
    prompt: 'Choose the common value.',
    options: ['x=1', 'x=2', 'x=3', 'x=4'],
    answer: 'A',
    explanation: 'The independent calculation gives x=1.',
    localizations: {},
    documentIdentityHash: duplicateDocumentIdentity
  }));
const duplicateSourceQualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: manifest(1),
  sourceRevisions: duplicateSourceRevisions
});
const conflictingSourceRevisions = duplicateSourceRevisions.map((revision, index) => index === 2
  ? buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: revision.sourceSystem,
    documentId: revision.documentId,
    questionOrdinal: revision.questionOrdinal,
    subject: revision.subject,
    language: revision.language,
    prompt: 'A conflicting prompt for the same logical question.',
    options: revision.fields.options,
    answer: revision.fields.answer,
    explanation: revision.fields.explanation,
    localizations: {},
    documentIdentityHash: duplicateDocumentIdentity
  })
  : revision);
const conflictingSourceQualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: manifest(1),
  sourceRevisions: conflictingSourceRevisions
});
const reorderedQualification = createSubjectPracticeCommonFragmentCorpusQualification({
  inventoryManifest: completeManifest,
  sourceRevisions: [...corpus].reverse()
});

const checks = {
  completeInventoryCreatesOpaqueQualification: qualificationMatches,
  structuredSnapshotOrderInvariant: reorderedQualification?.corpusSnapshotSha256
    === qualification.corpusSnapshotSha256,
  commonFragmentCountsIndependentLineagesAndDocuments: commonProof.minimumIndependentLineageCount === 1200
    && commonProof.minimumIndependentDocumentCount === 1200,
  scarceFragmentCannotQualify: scarceProof === null,
  repeatedOneDocumentCannotInflateIndependence: oneDocumentQualification !== null
    && oneDocumentProof === null,
  copiedQualificationRejected: !subjectPracticeCommonFragmentCorpusQualificationMatches({
    qualification: { ...qualification },
    expectedInventoryManifestSha256: completeManifest.manifestSha256,
    expectedCorpusSnapshotSha256: qualification.corpusSnapshotSha256
  }),
  copiedProofRejected: !subjectPracticeCommonFragmentCorpusProofMatches({
    proof: { ...commonProof },
    expectedCorpusSnapshotSha256: qualification.corpusSnapshotSha256,
    expectedSourceQuestionRevisionId: source.sourceQuestionRevisionId,
    expectedLineageHash: source.lineageHash,
    expectedSourceDocumentIdentityHash: source.documentIdentityHash,
    expectedFragmentSetSha256: commonProof.fragmentSetSha256
  }),
  partialInventoryRejected: createSubjectPracticeCommonFragmentCorpusQualification({
    inventoryManifest: manifest(400, 'failed'),
    sourceRevisions: corpus
  }) === null,
  manifestCountMismatchRejected: createSubjectPracticeCommonFragmentCorpusQualification({
    inventoryManifest: manifest(401),
    sourceRevisions: corpus
  }) === null,
  mutatedRevisionRejected: mutatedQualification === null,
  duplicateSourcesDoNotInflateLineageLengthDistribution: duplicateSourceQualification !== null
    && duplicateSourceQualification.revisionCount === 3
    && duplicateSourceQualification.independentLineageCount === 1
    && duplicateSourceQualification.duplicateRevisionCount === 2
    && duplicateSourceQualification.lengthObservationCount === 5,
  conflictingCrossSourceLineageRejected: conflictingSourceQualification === null,
  rawFragmentTextNotExposed: !JSON.stringify(qualification).includes('x=1')
    && !JSON.stringify(commonProof).includes('x=1'),
  proofBindsRevisionAndFragmentSet: proofMatches,
  policyVersioned: /-v\d+$/.test(SUBJECT_PRACTICE_COMMON_FRAGMENT_CORPUS_POLICY_VERSION)
};

const report = {
  mode: 'subject_practice_common_fragment_corpus_self_test',
  reportVersion: 'subject-practice-common-fragment-corpus-self-test-v4',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  revisionCount: qualification.revisionCount,
  fragmentStatisticCount: qualification.fragmentStatisticCount,
  commonFragmentMinimumIndependentLineages: commonProof.minimumIndependentLineageCount,
  commonFragmentMinimumIndependentDocuments: commonProof.minimumIndependentDocumentCount,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none_policy_self_test_only'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = {
  report,
  qualification,
  commonProof,
  completeManifest,
  inventoryTopology,
  source,
  commonDescriptor
};
