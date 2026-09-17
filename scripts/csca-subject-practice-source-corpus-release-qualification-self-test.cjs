#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const {
  buildSubjectPracticeSourceCorpusScanEvidence,
  createSubjectPracticeSourceCorpusScanAttestation,
  scanSubjectPracticeContentAgainstSourceCorpus,
  verifySubjectPracticeSourceCorpusScanAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  subjectPracticeSourceCorpusReleaseQualificationFor,
  subjectPracticeSourceCorpusReleaseQualificationMatches
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-release-qualification-policy');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} = require('../backend/src/ai-questioning/subject-practice-generator-source-isolation-policy');
const {
  subjectPracticeDeterministicFormalReleaseDecision
} = require('../backend/src/ai-questioning/subject-practice-scope-release-path-policy');
const {
  qualityQualification,
  qualityScore,
  lengthPolicyExpectedBindings,
  lengthPolicyQualification
} = require('./csca-subject-practice-source-corpus-calibration-self-test.cjs');

const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const secret = 'fixture-release-scan-secret-0000000001';
const scannerId = 'fixture-release-scanner';
const keyId = 'fixture-release-key';
const sourceTexts = [
  'Solve a linear equation with one unknown.',
  'A body moves with constant acceleration.',
  'Calculate the pH after strong acid and base mixing.'
];
const targetText = 'Generate a fresh task from aggregate syllabus constraints.';
const targetContentSha256 = sha(targetText);

function targetFieldNames(layer) {
  if (layer === 'profile_asset_admission') return ['approved_profile_asset'];
  if (layer === 'generator_projection') return ['system', 'user'];
  return ['candidate_prompt', 'candidate_options'];
}

function evidenceFor(layer, subject) {
  return buildSubjectPracticeSourceCorpusScanEvidence({
    layer,
    subject,
    targetContentSha256,
    providerProjectionSha256: layer === 'generator_projection' ? targetContentSha256 : null,
    sourceCorpusSnapshotId: 'fixture-calibrated-complete-corpus',
    sourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256,
    sourceCorpusEntryCount: sourceTexts.length,
    corpusCoverageStatus: 'all_system_known_source_exam_reference',
    inventoryManifestSha256: lengthPolicyExpectedBindings.inventoryManifestSha256,
    corpusFieldCoverage: { prompt: true, options: true, answer: true, explanation: true, localizations: true },
    corpusSubjectCounts: { math: 1, physics: 1, chemistry: 1 },
    corpusLanguageCounts: { en: 2, zh: 1 },
    targetFieldNames: targetFieldNames(layer),
    requiredLanguages: ['en', 'zh'],
    thresholdCalibrationStatus: 'three_subject_labeled_calibration_passed',
    ...scanSubjectPracticeContentAgainstSourceCorpus({
      targetFields: targetFieldNames(layer).map((field) => ({ field, text: targetText })),
      sourceTexts
    }),
    scannedAt: '2026-09-13T12:00:00.000Z'
  });
}

function qualificationFor(layer, subject, overrides = {}) {
  const evidence = evidenceFor(layer, subject);
  const attestation = createSubjectPracticeSourceCorpusScanAttestation({
    evidence, scannerId, keyId,
    issuedAt: '2026-09-13T12:01:00.000Z',
    expiresAt: '2026-09-14T12:01:00.000Z', secret
  });
  const trustedProof = verifySubjectPracticeSourceCorpusScanAttestation({
    evidence, attestation, secret, allowedScannerIds: [scannerId], allowedKeyIds: [keyId],
    now: '2026-09-13T13:00:00.000Z'
  });
  return subjectPracticeSourceCorpusReleaseQualificationFor({
    evidence, trustedProof, calibrationQualification: qualityQualification,
    expectedTargetContentSha256: targetContentSha256,
    expectedSourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256,
    expectedInventoryManifestSha256: lengthPolicyExpectedBindings.inventoryManifestSha256,
    expectedCalibrationDatasetSnapshotSha256: qualityScore.datasetSnapshotSha256,
    expectedGeneratorVersionSetSha256: lengthPolicyExpectedBindings.generatorVersionSetSha256,
    expectedRendererVersionSetSha256: lengthPolicyExpectedBindings.rendererVersionSetSha256,
    expectedLengthPolicyQualificationSha256: lengthPolicyQualification.qualificationSha256,
    expectedPrimaryReachableCellSetSha256: qualityQualification.primaryReachableCellSetSha256,
    ...overrides
  });
}

const layers = ['profile_asset_admission', 'generator_projection', 'candidate_output'];
const subjects = ['math', 'physics', 'chemistry'];
const fixtureQualificationsBySubject = Object.fromEntries(subjects.map((subject) => [
  subject,
  Object.fromEntries(layers.map((layer) => [
    layer === 'profile_asset_admission' ? 'profileAssetAdmission'
      : layer === 'generator_projection' ? 'generatorProjection' : 'candidateOutput',
    qualificationFor(layer, subject)
  ]))
]));

const valid = fixtureQualificationsBySubject.math.generatorProjection;
const copied = valid ? Object.freeze({ ...valid }) : null;

function releaseLayer(qualification) {
  return {
    status: 'pass', trustedAttestation: true, targetContentBound: true,
    targetContentSha256: qualification?.targetContentSha256 ?? '',
    sourceCorpusSnapshotId: 'fixture-calibrated-complete-corpus',
    sourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256,
    corpusCoverageStatus: 'all_system_known_source_exam_reference',
    corpusBuilderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    scannerPolicyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    matchingAlgorithmVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
    thresholdVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION,
    matchedCount: 0,
    qualification
  };
}

function completeFormalEvidence() {
  const qualifications = fixtureQualificationsBySubject.math;
  return {
    binding: {
      subject: 'math', taskFamily: 'fixture_family', planTemplate: 'fixture_plan',
      questionPlanPolicyVersion: 'fixture_plan_policy', solverVersion: 'fixture_solver',
      verificationScopeVersion: 'fixture_scope', generatorVersion: 'fixture_generator',
      benchmarkVersion: 'fixture_benchmark'
    },
    expectedScopeIds: ['scope:a'],
    commonGates: {
      syllabusScopeBound: true, questionPlanValid: true, candidatePlanAdherent: true,
      deterministicValidatorBlockingFree: true, semanticDiversityGatePassed: true,
      publicationScopeIsCandidateExactNotFamilyWide: true
    },
    generatorSourceIsolation: {
      policyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
      status: 'enforced_structural_projection',
      boundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
      allowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
      originalQuestionContentOmitted: true, reversibleSourceFieldsOmitted: true,
      developerUnseenRequired: false, officialHoldoutRequiredForGeneratorIsolation: false,
      sourceLinkageIdentifiersOmitted: true,
      profileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
      profileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
      profileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
      providerProjectionHashRecomputed: true, knownSourceCorpusComparisonPassed: true,
      knownSourceLeakMatchCount: 0, providerProjectionSha256Present: true,
      providerProjectionSha256: qualifications.generatorProjection.targetContentSha256
    },
    fullSourceCorpusIsolation: {
      currentCorpusSnapshotBound: true,
      profileAssetContentSha256: qualifications.profileAssetAdmission.targetContentSha256,
      profileAssetAdmission: releaseLayer(qualifications.profileAssetAdmission),
      generatorProjection: releaseLayer(qualifications.generatorProjection)
    },
    candidateOutputCorpusNovelty: {
      currentCorpusSnapshotBound: true,
      candidateContentSha256: qualifications.candidateOutput.targetContentSha256,
      candidateOutput: releaseLayer(qualifications.candidateOutput)
    },
    candidateVerification: {
      evidenceBoundary: 'prompt_and_visible_options_only', allVisibleOptionsParsed: true,
      exactlyOneTrueOption: true, agreesWithGenerator: true, exactScopeMatched: true,
      unsupportedInputsAbstain: true
    },
    explanationVerification: {
      status: 'verified', implementationId: 'fixture_explanation',
      recomputedWithoutGeneratorExplanation: true, formulaInputsUnitsAndConclusionChecked: true,
      verifiedCount: 128, mismatchCount: 0
    },
    independentOracle: {
      status: 'verified', implementationId: 'fixture_oracle', sharesGeneratorCoreFunctions: false,
      sharesSolverCoreFunctions: false, comparedCount: 128, agreementCount: 128, falseAccepts: 0
    },
    randomizedPropertyTests: {
      generatedAfterSolverFreeze: true, seedCommitmentPresent: true,
      perScopeCounts: { 'scope:a': 128 }, failedCount: 0
    },
    mutationTests: {
      total: 200, detected: 200, falseAccepts: 0,
      perTypeCounts: { answer_flip: 100, scope_escape: 100 },
      requiredTypes: ['answer_flip', 'scope_escape']
    },
    blindHumanAudit: {
      answerKeyHiddenUntilLocked: true, validEvidence: true,
      perScopeCounts: { 'scope:a': 8 }, strictQualifiedRate: 1
    },
    productionShadow: {
      publicationSuppressed: true, observedCount: 100,
      perScopeCounts: { 'scope:a': 100 }, falseAccepts: 0,
      scopeLeakageCount: 0, unexpectedConflictCount: 0
    }
  };
}

const formalEvidence = completeFormalEvidence();
const formalDecision = subjectPracticeDeterministicFormalReleaseDecision(formalEvidence);
const copiedQualificationDecision = subjectPracticeDeterministicFormalReleaseDecision({
  ...formalEvidence,
  fullSourceCorpusIsolation: {
    ...formalEvidence.fullSourceCorpusIsolation,
    generatorProjection: releaseLayer(copied)
  }
});
const swappedTargetDecision = subjectPracticeDeterministicFormalReleaseDecision({
  ...formalEvidence,
  candidateOutputCorpusNovelty: {
    ...formalEvidence.candidateOutputCorpusNovelty,
    candidateContentSha256: sha('different-candidate')
  }
});
const checks = {
  calibratedScanMintsReleaseQualification: valid !== null,
  allSubjectsAndLayersCovered: subjects.every((subject) => Object.values(
    fixtureQualificationsBySubject[subject]
  ).every(Boolean)),
  missingCalibrationCannotQualify: qualificationFor('generator_projection', 'math', {
    calibrationQualification: null
  }) === null,
  snapshotMismatchCannotQualify: qualificationFor('generator_projection', 'math', {
    expectedSourceCorpusSnapshotSha256: sha('stale-corpus')
  }) === null,
  copiedQualificationRejected: !subjectPracticeSourceCorpusReleaseQualificationMatches({
    qualification: copied,
    expectedLayer: 'generator_projection', expectedSubject: 'math',
    expectedTargetContentSha256: targetContentSha256,
    expectedSourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256
  }),
  exactOpaqueQualificationMatches: subjectPracticeSourceCorpusReleaseQualificationMatches({
    qualification: valid,
    expectedLayer: 'generator_projection', expectedSubject: 'math',
    expectedTargetContentSha256: targetContentSha256,
    expectedSourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256
  }),
  wrongSubjectRejected: !subjectPracticeSourceCorpusReleaseQualificationMatches({
    qualification: valid,
    expectedLayer: 'generator_projection', expectedSubject: 'physics',
    expectedTargetContentSha256: targetContentSha256,
    expectedSourceCorpusSnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256
  }),
  formalPathAcceptsExactCompositeQualifications: formalDecision.status === 'formal_qualified',
  formalPathRejectsCopiedQualification: copiedQualificationDecision.reasonCodes
    .includes('formal_release_full_source_corpus_scan_missing_or_failed'),
  formalPathRejectsTargetSubstitution: swappedTargetDecision.reasonCodes
    .includes('formal_release_candidate_output_source_similarity_scan_missing_or_failed')
};

const report = {
  mode: 'subject_practice_source_corpus_release_qualification_self_test',
  reportVersion: 'subject-practice-source-corpus-release-qualification-self-test-v1',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none_protocol_only'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = {
  report,
  fixtureQualificationsBySubject,
  fixtureCorpusSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256
};
