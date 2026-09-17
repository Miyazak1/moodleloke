#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const {
  buildSubjectPracticeSourceCorpusInventoryManifest,
  buildSubjectPracticeSourceCorpusScanEvidence,
  createSubjectPracticeSourceCorpusScanAttestation,
  scanSubjectPracticeContentAgainstSourceCorpus,
  subjectPracticeSourceCorpusScanEvidenceQualifies,
  subjectPracticeSourceCorpusScanQualificationFor,
  verifySubjectPracticeSourceCorpusScanAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  buildFixtureTopologyBinding
} = require('./csca-subject-practice-source-corpus-topology-fixture.cjs');

const secret = 'fixture-source-corpus-scanner-secret-0001';
const scannerId = 'fixture-independent-source-scanner-v1';
const keyId = 'fixture-key-1';
const sourceTexts = [
  'Let f of x equal two to the power x. Which statement about its range and monotonicity is correct?',
  'A particle starts from rest with constant acceleration. Find its final velocity after the stated time.',
  '将盐酸与氢氧化钠溶液混合，判断反应后溶液的酸碱性。'
];
const safeProjection = 'Generate a basic logarithmic function domain question using an approved aggregate profile.';
const copiedProjection = `Generate this item: ${sourceTexts[0]}`;
const shortSource = '求函数y=2^x的值域并判断其单调性';
const longPromptWithShortSource = `${'unrelated aggregate guidance '.repeat(200)} ${shortSource}`;
const safeMetrics = scanSubjectPracticeContentAgainstSourceCorpus({
  targetFields: [{ field: 'prompt', text: safeProjection }], sourceTexts
});
const copiedMetrics = scanSubjectPracticeContentAgainstSourceCorpus({
  targetFields: [{ field: 'prompt', text: copiedProjection }], sourceTexts
});
const shortEmbeddedMetrics = scanSubjectPracticeContentAgainstSourceCorpus({
  targetFields: [{ field: 'system', text: longPromptWithShortSource }], sourceTexts: [shortSource]
});
const corpusSha256 = crypto.createHash('sha256').update(JSON.stringify(sourceTexts)).digest('hex');
const targetSha256 = crypto.createHash('sha256').update(safeProjection).digest('hex');
const inventoryTopology = buildFixtureTopologyBinding([
  { sourceId: 'local_repository_source_json', kind: 'local_file' },
  { sourceId: 'production_csca_source_questions', kind: 'database_query' },
  { sourceId: 'remote_synced_source_inventory', kind: 'remote_sync' }
], 'scan-self-test');
const inventoryManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
  requiredSourceIds: ['local_repository_source_json', 'production_csca_source_questions', 'remote_synced_source_inventory'],
  topology: inventoryTopology.topology,
  sources: [
    ['local_repository_source_json', 'local_file', 3],
    ['production_csca_source_questions', 'database_query', 3],
    ['remote_synced_source_inventory', 'remote_sync', 3]
  ].map(([sourceId, kind, count]) => ({
    sourceId,
    kind,
    locatorFingerprintSha256: crypto.createHash('sha256').update(`${kind}:${sourceId}`).digest('hex'),
    expectedCount: count,
    observedCount: count,
    highWatermark: 'fixture-watermark-1',
    updatedAt: '2026-09-13T07:00:00.000Z',
    extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
    status: 'complete'
  }))
});
const missingRemoteInventoryManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
  requiredSourceIds: inventoryManifest.requiredSourceIds,
  topology: inventoryTopology.topology,
  sources: inventoryManifest.sources.filter((source) => source.sourceId !== 'remote_synced_source_inventory')
});
const countMismatchInventoryManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
  requiredSourceIds: inventoryManifest.requiredSourceIds,
  topology: inventoryTopology.topology,
  sources: inventoryManifest.sources.map((source) => source.sourceId === 'production_csca_source_questions'
    ? { ...source, observedCount: source.observedCount - 1 }
    : source)
});
const callerDeclaredOnlyManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
  requiredSourceIds: ['local_repository_source_json'],
  sources: inventoryManifest.sources.filter((source) => source.sourceId === 'local_repository_source_json')
});

function targetFieldNamesFor(layer) {
  if (layer === 'profile_asset_admission') return ['approved_profile_asset'];
  if (layer === 'generator_projection') return ['system', 'user'];
  return ['candidate_prompt', 'candidate_options'];
}

function evidenceFor(layer, subject = 'math') {
  return buildSubjectPracticeSourceCorpusScanEvidence({
    layer,
    subject,
    targetContentSha256: targetSha256,
    providerProjectionSha256: layer === 'generator_projection' ? targetSha256 : null,
    sourceCorpusSnapshotId: 'fixture-all-known-sources-1',
    sourceCorpusSnapshotSha256: corpusSha256,
    sourceCorpusEntryCount: sourceTexts.length,
    corpusCoverageStatus: 'all_system_known_source_exam_reference',
    inventoryManifestSha256: inventoryManifest.manifestSha256,
    corpusFieldCoverage: { prompt: true, options: true, answer: true, explanation: true, localizations: true },
    corpusSubjectCounts: { math: 1, physics: 1, chemistry: 1 },
    corpusLanguageCounts: { en: 2, zh: 1 },
    targetFieldNames: targetFieldNamesFor(layer),
    requiredLanguages: ['en', 'zh'],
    thresholdCalibrationStatus: 'three_subject_labeled_calibration_passed',
    ...safeMetrics,
    scannedAt: '2026-09-13T08:00:00.000Z'
  });
}

function attested(evidence) {
  const attestation = createSubjectPracticeSourceCorpusScanAttestation({
    evidence,
    scannerId,
    keyId,
    issuedAt: '2026-09-13T08:01:00.000Z',
    expiresAt: '2026-09-14T08:01:00.000Z',
    secret
  });
  const proof = verifySubjectPracticeSourceCorpusScanAttestation({
    evidence,
    attestation,
    secret,
    allowedScannerIds: [scannerId],
    allowedKeyIds: [keyId],
    now: '2026-09-13T09:00:00.000Z'
  });
  return { attestation, proof };
}

const profileEvidence = evidenceFor('profile_asset_admission');
const projectionEvidence = evidenceFor('generator_projection');
const candidateEvidence = evidenceFor('candidate_output');
const profileAttested = attested(profileEvidence);
const projectionAttested = attested(projectionEvidence);
const candidateAttested = attested(candidateEvidence);
const verificationContext = {
  allowedScannerIds: [scannerId],
  allowedKeyIds: [keyId],
  now: '2026-09-13T09:00:00.000Z'
};
const wrongSecretProof = verifySubjectPracticeSourceCorpusScanAttestation({
  evidence: projectionEvidence,
  attestation: projectionAttested.attestation,
  secret: 'fixture-source-corpus-scanner-wrong-0001',
  ...verificationContext
});
const tamperedEvidence = { ...projectionEvidence, matchedCount: 1 };
const tamperedProof = verifySubjectPracticeSourceCorpusScanAttestation({
  evidence: tamperedEvidence,
  attestation: projectionAttested.attestation,
  secret,
  ...verificationContext
});
const expiredProof = verifySubjectPracticeSourceCorpusScanAttestation({
  evidence: projectionEvidence,
  attestation: projectionAttested.attestation,
  secret,
  allowedScannerIds: [scannerId],
  allowedKeyIds: [keyId],
  now: '2026-09-15T09:00:00.000Z'
});
const qualifies = subjectPracticeSourceCorpusScanEvidenceQualifies({
  evidence: projectionEvidence,
  trustedProof: projectionAttested.proof,
  expectedTargetContentSha256: targetSha256,
  expectedSourceCorpusSnapshotSha256: corpusSha256,
  expectedInventoryManifestSha256: inventoryManifest.manifestSha256
});
const staleCorpusQualifies = subjectPracticeSourceCorpusScanEvidenceQualifies({
  evidence: projectionEvidence,
  trustedProof: projectionAttested.proof,
  expectedTargetContentSha256: targetSha256,
  expectedSourceCorpusSnapshotSha256: crypto.createHash('sha256').update('new-corpus').digest('hex'),
  expectedInventoryManifestSha256: inventoryManifest.manifestSha256
});
const fixtureQualifications = {
  profileAssetAdmission: subjectPracticeSourceCorpusScanQualificationFor({
    evidence: profileEvidence,
    trustedProof: profileAttested.proof,
    expectedTargetContentSha256: targetSha256,
    expectedSourceCorpusSnapshotSha256: corpusSha256,
    expectedInventoryManifestSha256: inventoryManifest.manifestSha256
  }),
  generatorProjection: subjectPracticeSourceCorpusScanQualificationFor({
    evidence: projectionEvidence,
    trustedProof: projectionAttested.proof,
    expectedTargetContentSha256: targetSha256,
    expectedSourceCorpusSnapshotSha256: corpusSha256,
    expectedInventoryManifestSha256: inventoryManifest.manifestSha256
  }),
  candidateOutput: subjectPracticeSourceCorpusScanQualificationFor({
    evidence: candidateEvidence,
    trustedProof: candidateAttested.proof,
    expectedTargetContentSha256: targetSha256,
    expectedSourceCorpusSnapshotSha256: corpusSha256,
    expectedInventoryManifestSha256: inventoryManifest.manifestSha256
  })
};
function fixtureQualificationPairFor(subject) {
  const profile = evidenceFor('profile_asset_admission', subject);
  const projection = evidenceFor('generator_projection', subject);
  const candidate = evidenceFor('candidate_output', subject);
  const profileSigned = attested(profile);
  const projectionSigned = attested(projection);
  const candidateSigned = attested(candidate);
  return {
    profileAssetAdmission: subjectPracticeSourceCorpusScanQualificationFor({
      evidence: profile,
      trustedProof: profileSigned.proof,
      expectedTargetContentSha256: targetSha256,
      expectedSourceCorpusSnapshotSha256: corpusSha256,
      expectedInventoryManifestSha256: inventoryManifest.manifestSha256
    }),
    generatorProjection: subjectPracticeSourceCorpusScanQualificationFor({
      evidence: projection,
      trustedProof: projectionSigned.proof,
      expectedTargetContentSha256: targetSha256,
      expectedSourceCorpusSnapshotSha256: corpusSha256,
      expectedInventoryManifestSha256: inventoryManifest.manifestSha256
    }),
    candidateOutput: subjectPracticeSourceCorpusScanQualificationFor({
      evidence: candidate,
      trustedProof: candidateSigned.proof,
      expectedTargetContentSha256: targetSha256,
      expectedSourceCorpusSnapshotSha256: corpusSha256,
      expectedInventoryManifestSha256: inventoryManifest.manifestSha256
    })
  };
}
const fixtureQualificationsBySubject = Object.fromEntries(
  ['math', 'physics', 'chemistry'].map((subject) => [subject, fixtureQualificationPairFor(subject)])
);

const checks = {
  safeAggregateProjectionPasses: safeMetrics.matchedCount === 0 && projectionEvidence.status === 'pass',
  copiedSourceQuestionFails: copiedMetrics.matchedCount > 0,
  shortSourceEmbeddedInLongPromptFails: shortEmbeddedMetrics.matchedCount === 1
    && shortEmbeddedMetrics.maxSourceCoverage >= 0.75,
  profileAndInvocationLayersDistinct: profileEvidence.layer === 'profile_asset_admission'
    && projectionEvidence.layer === 'generator_projection',
  validAttestationQualifies: projectionAttested.proof !== null && qualifies,
  opaqueLayerQualificationsCreated: fixtureQualifications.profileAssetAdmission !== null
    && fixtureQualifications.generatorProjection !== null
    && fixtureQualifications.candidateOutput !== null,
  completeControlledInventoryQualifies: inventoryManifest.coverageStatus === 'all_system_known_source_exam_reference',
  callerDeclaredRequiredSetCannotQualify: callerDeclaredOnlyManifest.coverageStatus === 'partial'
    && callerDeclaredOnlyManifest.requiredSourceDerivation === 'caller_declared_unqualified'
    && callerDeclaredOnlyManifest.reasonCodes.includes('source_corpus_inventory_topology_qualification_missing'),
  missingRemoteInventoryFailsClosed: missingRemoteInventoryManifest.coverageStatus === 'partial'
    && missingRemoteInventoryManifest.reasonCodes.includes('source_corpus_inventory_source_missing'),
  countMismatchInventoryFailsClosed: countMismatchInventoryManifest.coverageStatus === 'partial'
    && countMismatchInventoryManifest.reasonCodes.includes('source_corpus_inventory_count_mismatch'),
  wrongSecretRejected: wrongSecretProof === null,
  expiredAttestationRejected: expiredProof === null,
  evidenceMutationRejected: tamperedProof === null,
  corpusSnapshotChangeInvalidatesEvidence: !staleCorpusQualifies,
  contentAndCorpusHashesBound: projectionEvidence.providerProjectionSha256 === targetSha256
    && projectionEvidence.sourceCorpusSnapshotSha256 === corpusSha256,
  semanticOperatorsPreservedByNormalization: scanSubjectPracticeContentAgainstSourceCorpus({
    targetText: 'x >= 2 and y != 0',
    sourceTexts: ['x <= 2 and y = 0']
  }).maxSimilarity < 1,
  secretNotSerialized: !JSON.stringify({
    projectionEvidence,
    attestation: projectionAttested.attestation
  }).includes(secret)
};

const report = {
  mode: 'subject_practice_source_corpus_scan_self_test',
  reportVersion: 'subject-practice-source-corpus-scan-self-test-v4',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  safeMetrics,
  copiedMetrics,
  shortEmbeddedMetrics,
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_fixture_corpus_only',
  productionImpact: 'none_protocol_self_test_only'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = {
  report,
  fixtureQualifications,
  fixtureQualificationsBySubject,
  fixtureCorpusSha256: corpusSha256,
  fixtureInventoryManifestSha256: inventoryManifest.manifestSha256
};
