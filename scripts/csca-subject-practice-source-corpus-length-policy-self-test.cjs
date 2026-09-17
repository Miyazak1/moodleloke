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
  createSubjectPracticeSourceCorpusLengthQualification: createSubjectPracticeSourceCorpusLengthQualificationWithTopology,
  subjectPracticeSourceCorpusLengthQualificationMatches,
  SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-length-policy');
const {
  subjectPracticeCommonFragmentCorpusLengthObservations
} = require('../backend/src/ai-questioning/subject-practice-common-fragment-corpus-policy');
const {
  completeManifest,
  qualification: commonFragmentCorpusQualification,
  inventoryTopology
} = require('./csca-subject-practice-common-fragment-corpus-self-test.cjs');

function createSubjectPracticeSourceCorpusLengthQualification(input) {
  return createSubjectPracticeSourceCorpusLengthQualificationWithTopology({
    ...input,
    topology: inventoryTopology.topology
  });
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const subjects = ['math', 'physics', 'chemistry'];
const languages = ['en', 'zh'];
const fields = ['prompt', 'options', 'answer', 'explanation', 'localizations'];
const partialManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
  requiredSourceIds: completeManifest.requiredSourceIds,
  topology: inventoryTopology.topology,
  sources: completeManifest.sources.map((source) => source.kind === 'remote_sync'
    ? { ...source, observedCount: 0, status: 'failed' }
    : source)
});

const observations = subjectPracticeCommonFragmentCorpusLengthObservations(
  commonFragmentCorpusQualification
);
if (!observations) throw new Error('fixture_common_corpus_length_observations_missing');
const contracts = [];
for (const subject of subjects) for (const language of languages) for (const field of fields) {
  contracts.push({
    contractId: `${subject}:${language}:${field}`,
    subject, language, field, emitsField: true,
    minimumNormalizedCharacters: 1, maximumNormalizedCharacters: 60,
    generatorVersion: 'fixture-generator-v1', rendererVersion: 'fixture-renderer-v1'
  });
}

const inventorySnapshotSha256 = commonFragmentCorpusQualification.corpusSnapshotSha256;
const qualification = createSubjectPracticeSourceCorpusLengthQualification({
  inventoryManifest: completeManifest,
  inventorySnapshotSha256,
  observations,
  generatedFieldContracts: contracts,
  structuredCorpusQualification: commonFragmentCorpusQualification
});
if (!qualification) throw new Error('length_policy_fixture_qualification_missing');
const matches = (value, expected = qualification) =>
  subjectPracticeSourceCorpusLengthQualificationMatches({
    qualification: value,
    expectedInventoryManifestSha256: completeManifest.manifestSha256,
    expectedInventorySnapshotSha256: inventorySnapshotSha256,
    expectedGeneratorVersionSetSha256: expected.generatorVersionSetSha256,
    expectedRendererVersionSetSha256: expected.rendererVersionSetSha256
  });

const copied = { ...qualification };
const partialRejected = createSubjectPracticeSourceCorpusLengthQualification({
  inventoryManifest: partialManifest,
  inventorySnapshotSha256,
  observations,
  generatedFieldContracts: contracts,
  structuredCorpusQualification: commonFragmentCorpusQualification
});
const thinRejected = createSubjectPracticeSourceCorpusLengthQualification({
  inventoryManifest: completeManifest,
  inventorySnapshotSha256,
  observations: observations.filter((_, index) => index % 200 !== 199),
  generatedFieldContracts: contracts,
  structuredCorpusQualification: commonFragmentCorpusQualification
});
const drifted = createSubjectPracticeSourceCorpusLengthQualification({
  inventoryManifest: completeManifest,
  inventorySnapshotSha256,
  observations,
  generatedFieldContracts: contracts.map((contract) => ({
    ...contract, generatorVersion: 'fixture-generator-v2'
  })),
  structuredCorpusQualification: commonFragmentCorpusQualification
});
const fabricatedObservationsRejected = createSubjectPracticeSourceCorpusLengthQualification({
  inventoryManifest: completeManifest,
  inventorySnapshotSha256,
  observations: observations.map((observation, index) => index === 0
    ? { ...observation, normalizedCharacterCount: observation.normalizedCharacterCount + 1 }
    : observation),
  generatedFieldContracts: contracts,
  structuredCorpusQualification: commonFragmentCorpusQualification
});

const checks = {
  completeMachineDerivedQualificationCreated: matches(qualification),
  allThirtyLanguageFieldAxesPresent: qualification.axisBoundaries.length === 30,
  allNinetyCellsProvenReachableOrUnreachable:
    qualification.reachableCellKeys.length + qualification.unreachableCellProofs.length === 90,
  outputRangeDerivesUnreachableCells: qualification.unreachableCellProofs.length > 0
    && qualification.unreachableCellProofs.every((item) => item.reason === 'outside_bound_output_range'),
  copiedQualificationRejected: !matches(copied),
  partialInventoryRejected: partialRejected === null,
  thinAxisRejected: thinRejected === null,
  fabricatedLengthDistributionRejected: fabricatedObservationsRejected === null,
  generatorVersionDriftInvalidatesQualification: Boolean(drifted) && !matches(drifted),
  policyVersioned: /-v\d+$/.test(SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_POLICY_VERSION)
};

const report = {
  mode: 'subject_practice_source_corpus_length_policy_self_test',
  reportVersion: 'subject-practice-source-corpus-length-policy-self-test-v3',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  axisCount: qualification.axisBoundaries.length,
  reachableCellCount: qualification.reachableCellKeys.length,
  unreachableCellCount: qualification.unreachableCellProofs.length,
  fixtureQualificationFormalReleaseEligible: false,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report, qualification, completeManifest, inventorySnapshotSha256 };
