#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

function reportFromScript(relativePath, args = []) {
  return JSON.parse(execFileSync(
    process.execPath,
    [require.resolve(relativePath), ...args],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  ));
}

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
  subjectPracticeQuestionPlanScopeRotationFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  SUBJECT_PRACTICE_OBSERVATION_BATCH_EVIDENCE_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-evidence-policy');
const {
  SUBJECT_PRACTICE_OBSERVATION_BATCH_QUALIFICATION_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-qualification-policy');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-trusted-exporter');
const {
  subjectPracticeVerificationReleaseDecision
} = require('../backend/src/ai-questioning/subject-practice-verification-release-benchmark-policy');
const {
  subjectPracticeDeterministicFormalReleaseDecision
} = require('../backend/src/ai-questioning/subject-practice-scope-release-path-policy');
const {
  SUBJECT_PRACTICE_FAMILY_AUTOMATION_QUALIFICATION_POLICY_VERSION,
  subjectPracticeFamilyAutomationQualificationDecision
} = require('../backend/src/ai-questioning/subject-practice-family-automation-qualification-policy');
const {
  SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION,
  subjectPracticeLimitedReleaseRuntimeConfig
} = require('../backend/src/ai-questioning/subject-practice-limited-release-control-policy');
const {
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_THRESHOLDS
} = require('../backend/src/ai-questioning/subject-practice-dynamic-scenario-qualification-policy');
const {
  subjectPracticeLocalShadowCandidateSeedBindingFor,
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');
const { report: mathRelease } = require('./csca-subject-practice-verification-release-benchmark.cjs');
const { report: mathProgrammatic } = require('./csca-subject-practice-math-elementary-solver-benchmark.cjs');
const { report: physicsProgrammatic } = require('./csca-subject-practice-physics-kinematics-solver-benchmark.cjs');
const { report: chemistryProgrammatic } = require('./csca-subject-practice-chemistry-acid-base-solver-benchmark.cjs');
const { report: mathLocalGenerator } = require('./csca-subject-practice-math-elementary-local-generator-benchmark.cjs');
const { report: physicsLocalGenerator } = require('./csca-subject-practice-physics-kinematics-local-generator-benchmark.cjs');
const { report: chemistryLocalGenerator } = require('./csca-subject-practice-chemistry-acid-base-local-generator-benchmark.cjs');
const localGeneratorProductionProfileBinding = reportFromScript('./csca-subject-practice-local-generator-production-profile-binding-preflight.cjs');
const {
  selfTest: localGeneratorProductionProfileBindingSelfTest
} = require('./csca-subject-practice-local-generator-production-profile-binding-preflight.cjs');
const { runSelfTest: runPhysicsBlindAuditExportSelfTest } = require('./csca-subject-practice-physics-kinematics-local-audit-export.cjs');
const { runSelfTest: runPhysicsBlindAuditScoreSelfTest } = require('./csca-subject-practice-physics-kinematics-local-audit-score.cjs');
const { report: mathLineRelationLocalGenerator } = require('./csca-subject-practice-math-line-relation-local-generator-benchmark.cjs');
const { report: mathLineRelationMutation } = require('./csca-subject-practice-math-line-relation-mutation-benchmark.cjs');
const { report: mathLineRelationRandomizedProperty } = require('./csca-subject-practice-math-line-relation-independent-property-benchmark.cjs');
const { report: mathDerivativeLocalGenerator } = require('./csca-subject-practice-math-derivative-local-generator-benchmark.cjs');
const { report: mathDerivativeMutation } = require('./csca-subject-practice-math-derivative-mutation-benchmark.cjs');
const { report: sourceAudit } = require('./csca-subject-practice-physics-chemistry-source-audit.cjs');
const { report: postFreezeRandom } = require('./csca-subject-practice-post-freeze-random-property-benchmark.cjs');
const { report: generatorSourceIsolation } = require('./csca-subject-practice-generator-source-isolation-benchmark.cjs');
const { report: productionShadowRehearsal } = require('./csca-subject-practice-production-shadow-rehearsal.cjs');
const productionShadowEvidenceProtocol = reportFromScript('./csca-subject-practice-production-shadow-evidence-self-test.cjs');
const productionShadowTrustedExporter = reportFromScript('./csca-subject-practice-production-shadow-trusted-exporter-self-test.cjs');
const { report: observationBatchManifest } = require('./csca-subject-practice-observation-batch-manifest-self-test.cjs');
const { report: observationBatchEvidence } = require('./csca-subject-practice-observation-batch-evidence-self-test.cjs');
const { report: scenarioDiversity } = require('./csca-subject-practice-scenario-diversity-self-test.cjs');
const scenarioBlueprintProposalProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-self-test.cjs');
const scenarioBlueprintPromotionProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-promotion-self-test.cjs');
const scenarioBlueprintMemoryProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-memory-self-test.cjs');
const scenarioBlueprintIdeationProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-ideation-self-test.cjs');
const scenarioBlueprintResponseProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-response-self-test.cjs');
const scenarioBlueprintOrchestratorProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-orchestrator-self-test.cjs');
const scenarioBlueprintMaterializationProtocol = reportFromScript('./csca-subject-practice-scenario-blueprint-materialization-self-test.cjs');
const scenarioBlueprintObservationAddendumProtocol = reportFromScript('./csca-subject-practice-observation-scenario-blueprint-addendum-self-test.cjs');
const scenarioBlueprintObservationPackProtocol = reportFromScript('./csca-subject-practice-observation-scenario-blueprint-pack-self-test.cjs');
const scenarioBlueprintObservationExecutionProtocol = reportFromScript('./csca-subject-practice-observation-scenario-blueprint-execution-self-test.cjs');
const scenarioBlueprintSpendAuditProtocol = reportFromScript(
  './csca-subject-practice-scenario-blueprint-spend-audit.cjs', ['--self-test']
);
const scenarioBlueprintValidationLadderProtocol = reportFromScript(
  './csca-subject-practice-scenario-blueprint-validation-ladder.cjs', ['--self-test']
);
const readOnlyNoveltyEvidenceProtocol = reportFromScript('./csca-subject-practice-read-only-novelty-evidence-self-test.cjs');
const readOnlyDbNoveltyEvidence = require('../artifacts/ai-questioning/three-subject-read-only-db-novelty-evidence-20260914.json');
const {
  verifySubjectPracticeReadOnlyDbNoveltyEvidence
} = require('../backend/src/ai-questioning/subject-practice-read-only-db-novelty-evidence-policy');
const readOnlyDbNoveltyEvidenceVerification = verifySubjectPracticeReadOnlyDbNoveltyEvidence(readOnlyDbNoveltyEvidence);
const readOnlyDbNoveltyEvidencePolicyProtocol = reportFromScript('./csca-subject-practice-read-only-db-novelty-evidence-policy-self-test.cjs');
const {
  selfTest: observationBatchExporterSelfTest,
  preflight: observationBatchExporterPreflight
} = require('./csca-subject-practice-observation-batch-export.cjs');
const observationBatchQualification = reportFromScript('./csca-subject-practice-observation-batch-qualification-self-test.cjs');
const {
  selfTest: observationBatchQualificationExporterSelfTest,
  preflight: observationBatchQualificationExporterPreflight,
  verifyQualificationArtifact
} = require('./csca-subject-practice-observation-batch-qualification-export.cjs');
const mathDerivativeQualificationArtifact = require('../artifacts/local-shadow-7a03a8284e967af8a652-qualification.json');
const mathDerivativeQualificationArtifact2 = require('../artifacts/local-shadow-caf54b0a324507ead7a8-qualification.json');
const mathDerivativeQualificationArtifact3 = require('../artifacts/local-shadow-1fa10985986b8c21e5fb-qualification.json');
const mathDerivativeQualificationArtifact4 = require('../artifacts/local-shadow-b696a91854f8ffe44a9c-qualification.json');
const mathDerivativeQualificationArtifact5 = require('../artifacts/local-shadow-09113b3b0f6c6a6217f3-qualification.json');
const mathDerivativeQualificationArtifact6 = require('../artifacts/local-shadow-bc1318c74b4e791aac3f-qualification.json');
const mathDerivativeQualificationArtifact7 = require('../artifacts/local-shadow-46d1bf0cd596fb036bd5-qualification.json');
const mathDerivativeQualificationArtifact8 = require('../artifacts/local-shadow-656bdfbcb907bac310cd-qualification.json');
const mathDerivativeQualificationArtifact9 = require('../artifacts/local-shadow-7c2270b753e4a594e557-qualification.json');
const mathDerivativeQualificationArtifactVerification = verifyQualificationArtifact({
  artifact: mathDerivativeQualificationArtifact
});
const {
  buildSignedQualificationPortfolio
} = require('./csca-subject-practice-signed-qualification-portfolio.cjs');
const mathDerivativeSignedQualificationPortfolio = buildSignedQualificationPortfolio({
  artifacts: [
    mathDerivativeQualificationArtifact,
    mathDerivativeQualificationArtifact2,
    mathDerivativeQualificationArtifact3,
    mathDerivativeQualificationArtifact4,
    mathDerivativeQualificationArtifact5,
    mathDerivativeQualificationArtifact6,
    mathDerivativeQualificationArtifact7,
    mathDerivativeQualificationArtifact8,
    mathDerivativeQualificationArtifact9
  ],
  exactPlanKey: 'math:derivative_direct_evaluation:math_derivative_condition_chain_v1'
});
const { report: observationScopeBinding } = require('./csca-subject-practice-observation-scope-binding-self-test.cjs');
const familyQualificationBatch = reportFromScript('./csca-subject-practice-local-shadow-family-qualification-self-test.cjs');
const { report: familyQualificationMemoryRehearsal } = require('./csca-subject-practice-family-qualification-memory-rehearsal.cjs');
const { report: observationBatchResume } = require('./csca-subject-practice-observation-batch-resume-self-test.cjs');
const familyResumeRunner = JSON.parse(execFileSync(
  process.execPath,
  [require.resolve('./csca-subject-practice-local-shadow-family-resume-runner-self-test.cjs')],
  { encoding: 'utf8', maxBuffer: 1024 * 1024 }
));
const localShadowWaitPolling = JSON.parse(execFileSync(
  process.execPath,
  [require.resolve('./csca-subject-practice-local-shadow-wait-polling-self-test.cjs')],
  { encoding: 'utf8', maxBuffer: 1024 * 1024 }
));
const { subjectPracticeLocalGeneratorShadowRoutingPolicy } = require('../backend/src/ai-questioning/question-generator-provider.service');
const { preflight: productionShadowReadOnlyExporterPreflight } = require('./csca-subject-practice-production-shadow-export.cjs');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} = require('../backend/src/ai-questioning/subject-practice-generator-source-isolation-policy');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const { report: sourceCorpusScanProtocol } = require('./csca-subject-practice-source-corpus-scan-self-test.cjs');
const sourceCorpusCalibrationProtocol = reportFromScript('./csca-subject-practice-source-corpus-calibration-self-test.cjs');
const {
  report: sourceCorpusLengthPolicyProtocol
} = require('./csca-subject-practice-source-corpus-length-policy-self-test.cjs');
const {
  report: commonFragmentCorpusProtocol
} = require('./csca-subject-practice-common-fragment-corpus-self-test.cjs');
const { preflight: sourceCorpusLocalScanPreflight } = require('./csca-subject-practice-source-corpus-scan.cjs');
const { preflight: sourceCorpusDbInventoryPreflight } = require('./csca-subject-practice-source-corpus-db-inventory.cjs');
const {
  selfTest: sourceCorpusInventoryReconcileSelfTest
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');
const {
  runSelfTest: sourceCorpusConflictReviewSelfTest
} = require('./csca-subject-practice-source-corpus-conflict-review-export.cjs');
const {
  runSelfTest: sourceCorpusConflictReviewScoreSelfTest
} = require('./csca-subject-practice-source-corpus-conflict-review-score.cjs');
const {
  runSelfTest: sourceCorpusConflictResolutionSelfTest
} = require('./csca-subject-practice-source-corpus-conflict-resolution-materialize.cjs');
const {
  preflight: sourceCorpusDumpMirrorAuditPreflight,
  runSelfTest: sourceCorpusDumpMirrorAuditSelfTest
} = require('./csca-subject-practice-source-corpus-dump-mirror-audit.cjs');
const {
  runSelfTest: sourceCorpusTopologySelfTest
} = require('./csca-subject-practice-source-corpus-topology-self-test.cjs');
const {
  preflight: sourceCorpusTopologyReviewExportPreflight,
  runSelfTest: sourceCorpusTopologyReviewExportSelfTest
} = require('./csca-subject-practice-source-corpus-topology-review-export.cjs');
const {
  preflight: sourceCorpusTopologyReviewScorePreflight,
  runSelfTest: sourceCorpusTopologyReviewScoreSelfTest
} = require('./csca-subject-practice-source-corpus-topology-review-score.cjs');
const {
  preflight: sourceCorpusTopologyAttestationIssuePreflight,
  runSelfTest: sourceCorpusTopologyAttestationIssueSelfTest
} = require('./csca-subject-practice-source-corpus-topology-attestation-issue.cjs');
const {
  preflight: sourceCorpusTopologyQualifiedInventoryPreflight,
  runSelfTest: sourceCorpusTopologyQualifiedInventorySelfTest
} = require('./csca-subject-practice-source-corpus-topology-qualified-inventory.cjs');
const {
  preflight: sourceCorpusStructuredRebuildPreflight,
  runSelfTest: sourceCorpusStructuredRebuildSelfTest
} = require('./csca-subject-practice-source-corpus-structured-rebuild.cjs');
const sourceCorpusReleaseQualificationSelfTest = reportFromScript('./csca-subject-practice-source-corpus-release-qualification-self-test.cjs');
const {
  preflight: sourceCorpusLengthAxisCapacityPreflight,
  runSelfTest: sourceCorpusLengthAxisCapacitySelfTest
} = require('./csca-subject-practice-source-corpus-length-axis-capacity.cjs');
const {
  preflight: sourceCorpusTranslationWorkPackPreflight,
  runSelfTest: sourceCorpusTranslationWorkPackSelfTest
} = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');
const {
  preflight: sourceCorpusTranslationPromptPreflight,
  runSelfTest: sourceCorpusTranslationPromptSelfTest
} = require('./csca-subject-practice-source-corpus-translation-prompt.cjs');
const {
  preflight: sourceCorpusTranslationResponseGatePreflight,
  runSelfTest: sourceCorpusTranslationResponseGateSelfTest
} = require('./csca-subject-practice-source-corpus-translation-response-gate.cjs');
const {
  preflight: sourceCorpusTranslationHumanReviewPreflight,
  runSelfTest: sourceCorpusTranslationHumanReviewSelfTest
} = require('./csca-subject-practice-source-corpus-translation-human-review.cjs');
const {
  preflight: sourceCorpusTranslationRevisionMaterializePreflight,
  runSelfTest: sourceCorpusTranslationRevisionMaterializeSelfTest
} = require('./csca-subject-practice-source-corpus-translation-revision-materialize.cjs');
const {
  preflight: sourceCorpusTranslationProgressPreflight,
  runSelfTest: sourceCorpusTranslationProgressSelfTest
} = require('./csca-subject-practice-source-corpus-translation-progress.cjs');
const { preflight: localDbPartialGraphShadowPreflight } = require('./csca-subject-practice-local-db-partial-graph-shadow.cjs');
const { preflight: scopeOpportunityShadowPreflight } = require('./csca-subject-practice-scope-opportunity-shadow.cjs');
const {
  buildBootstrap: buildSourceCorpusCalibrationBootstrap,
  summaryFor: sourceCorpusCalibrationBootstrapSummary
} = require('./csca-subject-practice-source-corpus-calibration-bootstrap.cjs');
const { report: sourceCorpusStructureShadowProtocol } = require('./csca-subject-practice-source-corpus-structure-shadow-self-test.cjs');
const candidateOutputNoveltyResolutionProtocol = reportFromScript('./csca-subject-practice-candidate-output-novelty-resolution-self-test.cjs');
const candidateOutputNoveltyShadowProtocol = reportFromScript('./csca-subject-practice-candidate-output-novelty-self-test.cjs');

function emptyOfficialHoldout() {
  return { total: 0, verified: 0, abstained: 0, falseAccepts: 0, perScopeCounts: {} };
}

function missingSourceCorpusLayer() {
  return {
    status: 'missing',
    trustedAttestation: false,
    targetContentBound: false,
    targetContentSha256: '',
    sourceCorpusSnapshotId: '',
    sourceCorpusSnapshotSha256: '',
    corpusCoverageStatus: 'missing',
    corpusBuilderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    scannerPolicyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    matchingAlgorithmVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
    thresholdVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION,
    matchedCount: 0,
    qualification: null
  };
}

function programmaticEvidence(report) {
  return {
    goldTotal: report.goldCaseCount,
    goldPassed: report.goldVerifiedCount,
    scopedGoldTotal: report.goldCaseCount,
    scopedGoldPassed: report.goldVerifiedCount
  };
}

function mutationEvidence(report) {
  return {
    total: report.mutationCaseCount,
    detected: report.mutationDetectedCount,
    falseAccepts: report.mutationFalseAcceptCount,
    scopedFalseAccepts: report.mutationFalseAcceptCount,
    mutationTypes: Object.keys(report.mutationTypeCounts)
  };
}

function decisionFor({ subject, taskFamily, report, expectedScopeIds, actualQuestionPlanPolicyVersion }) {
  const expectedBinding = {
    subject,
    taskFamily,
    solverVersion: report.solverVersion,
    verificationScopeVersion: report.scopeVersion,
    questionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    benchmarkVersion: report.benchmarkVersion
  };
  const evidence = {
    binding: { ...expectedBinding, questionPlanPolicyVersion: actualQuestionPlanPolicyVersion },
    isolation: {
      sealedBeforeSolverVersion: false,
      answersHiddenDuringDevelopment: false,
      developmentFixturesExcluded: false,
      immutableContentHashesPresent: true
    },
    programmatic: programmaticEvidence(report),
    mutation: mutationEvidence(report),
    officialHoldout: emptyOfficialHoldout()
  };
  return {
    subject,
    taskFamily,
    expectedScopeIds,
    requiredMutationTypes: evidence.mutation.mutationTypes,
    evidence,
    decision: subjectPracticeVerificationReleaseDecision({
      expectedBinding,
      expectedScopeIds,
      requiredMutationTypes: evidence.mutation.mutationTypes,
      evidence
    })
  };
}

function formalDecisionFor({
  subject,
  taskFamily,
  planTemplate,
  programmatic,
  localGenerator,
  randomizedProperty,
  expectedScopeIds,
  semanticDiversityGatePassed,
  productionProfileBindingCurrent = true,
  productionShadowPortfolio = null
}) {
  const localScopeCounts = localGenerator?.scopeCounts ?? {};
  const localSampleCount = localGenerator?.sampleCount ?? 0;
  const localSelfVerifiedCount = localGenerator?.selfVerifiedCount ?? 0;
  const localSemanticUniqueCount = localGenerator?.uniqueSemanticFingerprintIgnoringOptionPositionCount ?? 0;
  const localPlanAdherentCount = localGenerator?.questionPlanAdherentCount ?? localSelfVerifiedCount;
  const reviewerProfileGateSatisfied = localGenerator?.reviewerProfileBlockingFreeCount === localSampleCount
    && localGenerator?.reviewerProfileDifficultyMatchedCount === localSampleCount;
  const explanationVerified = localSampleCount > 0
    && Boolean(localGenerator?.explanationVerifierVersion)
    && localGenerator?.explanationVerifiedCount === localSampleCount
    && localGenerator?.explanationMismatchCount === 0;
  const oracleVerified = localSampleCount > 0
    && Boolean(localGenerator?.independentOracleVersion)
    && localGenerator?.independentOracleComparedCount === localSampleCount
    && localGenerator?.independentOracleAgreementCount === localSampleCount
    && localGenerator?.independentOracleFalseAcceptCount === 0
    && localGenerator?.independentOracleSourceIndependence?.importsGenerator === false
    && localGenerator?.independentOracleSourceIndependence?.importsSolver === false;
  const evidence = {
    binding: {
      subject,
      taskFamily,
      planTemplate,
      questionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
      solverVersion: programmatic.solverVersion,
      verificationScopeVersion: programmatic.scopeVersion ?? mathRelease.expectedBinding.verificationScopeVersion,
      generatorVersion: localGenerator?.generatorVersion ?? '',
      benchmarkVersion: programmatic.benchmarkVersion
    },
    expectedScopeIds,
    commonGates: {
      syllabusScopeBound: true,
      questionPlanValid: true,
      candidatePlanAdherent: localSampleCount > 0 && localPlanAdherentCount === localSampleCount,
      deterministicValidatorBlockingFree: localSampleCount > 0
        && localGenerator.deterministicValidatorBlockingFreeCount === localSampleCount
        && reviewerProfileGateSatisfied
        && productionProfileBindingCurrent,
      productionProfileBindingCurrent,
      semanticDiversityGatePassed: semanticDiversityGatePassed
        ?? (localSampleCount > 0 && localSemanticUniqueCount === localSampleCount),
      publicationScopeIsCandidateExactNotFamilyWide: true
    },
    generatorSourceIsolation: {
      policyVersion: generatorSourceIsolation.policyVersion,
      status: generatorSourceIsolation.status === 'passed' ? 'enforced_structural_projection' : 'failed',
      boundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
      allowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
      originalQuestionContentOmitted: generatorSourceIsolation.results.every((item) => item.checks.providerMessageExcludesSentinel),
      reversibleSourceFieldsOmitted: generatorSourceIsolation.results.every((item) => item.checks.originalAndReversibleSourceFieldsForbidden),
      developerUnseenRequired: false,
      officialHoldoutRequiredForGeneratorIsolation: false,
      sourceLinkageIdentifiersOmitted: generatorSourceIsolation.results.every((item) => item.checks.sourceLinkageIdentifiersOmitted),
      profileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
      profileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
      profileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
      providerProjectionHashRecomputed: generatorSourceIsolation.results.every((item) => item.checks.providerProjectionDigestBound),
      knownSourceCorpusComparisonPassed: generatorSourceIsolation.knownSourceSmuggleRejected === true,
      knownSourceLeakMatchCount: generatorSourceIsolation.providerLeakCount,
      providerProjectionSha256Present: generatorSourceIsolation.results.every((item) => item.checks.providerProjectionDigestBound)
        && generatorSourceIsolation.policyVersion === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
      providerProjectionSha256: ''
    },
    fullSourceCorpusIsolation: {
      currentCorpusSnapshotBound: false,
      profileAssetContentSha256: '',
      profileAssetAdmission: missingSourceCorpusLayer(),
      generatorProjection: missingSourceCorpusLayer()
    },
    candidateOutputCorpusNovelty: {
      currentCorpusSnapshotBound: false,
      candidateContentSha256: '',
      candidateOutput: missingSourceCorpusLayer()
    },
    candidateVerification: {
      evidenceBoundary: 'prompt_and_visible_options_only',
      allVisibleOptionsParsed: localSampleCount > 0 && localSelfVerifiedCount === localSampleCount,
      exactlyOneTrueOption: localSampleCount > 0 && localSelfVerifiedCount === localSampleCount,
      agreesWithGenerator: localSampleCount > 0 && localSelfVerifiedCount === localSampleCount,
      exactScopeMatched: localSampleCount > 0 && localSelfVerifiedCount === localSampleCount,
      unsupportedInputsAbstain: true
    },
    explanationVerification: {
      status: explanationVerified ? 'verified' : 'missing',
      implementationId: explanationVerified ? localGenerator.explanationVerifierVersion : null,
      recomputedWithoutGeneratorExplanation: explanationVerified,
      formulaInputsUnitsAndConclusionChecked: explanationVerified,
      verifiedCount: explanationVerified ? localGenerator.explanationVerifiedCount : 0,
      mismatchCount: localGenerator?.explanationMismatchCount ?? 0
    },
    independentOracle: {
      status: oracleVerified ? 'verified' : 'missing',
      implementationId: localGenerator?.independentOracleVersion ?? null,
      sharesGeneratorCoreFunctions: localGenerator?.independentOracleSourceIndependence?.importsGenerator ?? false,
      sharesSolverCoreFunctions: localGenerator?.independentOracleSourceIndependence?.importsSolver ?? false,
      comparedCount: localGenerator?.independentOracleComparedCount ?? 0,
      agreementCount: localGenerator?.independentOracleAgreementCount ?? 0,
      falseAccepts: localGenerator?.independentOracleFalseAcceptCount ?? 0
    },
    randomizedPropertyTests: {
      generatedAfterSolverFreeze: randomizedProperty?.generatedAfterSolverFreeze === true,
      seedCommitmentPresent: randomizedProperty?.seedCommitmentPresent === true,
      perScopeCounts: randomizedProperty?.perScopeCounts
        ?? Object.fromEntries(expectedScopeIds.map((scopeId) => [scopeId, localScopeCounts[scopeId] ?? 0])),
      failedCount: randomizedProperty?.failedCount ?? 0
    },
    mutationTests: {
      total: programmatic.mutationCaseCount,
      detected: programmatic.mutationDetectedCount,
      falseAccepts: programmatic.mutationFalseAcceptCount,
      perTypeCounts: programmatic.mutationTypeCounts,
      requiredTypes: Object.keys(programmatic.mutationTypeCounts)
    },
    blindHumanAudit: {
      answerKeyHiddenUntilLocked: false,
      validEvidence: false,
      perScopeCounts: {},
      strictQualifiedRate: null
    },
    productionShadow: productionShadowPortfolio?.verifiedAccumulable === true ? {
      publicationSuppressed: true,
      observedCount: productionShadowPortfolio.candidateCount,
      perScopeCounts: productionShadowPortfolio.perScopeCounts,
      falseAccepts: productionShadowPortfolio.falseAccepts,
      scopeLeakageCount: productionShadowPortfolio.scopeLeakageCount,
      unexpectedConflictCount: productionShadowPortfolio.unexpectedFailureCount
    } : {
      publicationSuppressed: true,
      observedCount: 0,
      perScopeCounts: Object.fromEntries(expectedScopeIds.map((scopeId) => [scopeId, 0])),
      falseAccepts: 0,
      scopeLeakageCount: 0,
      unexpectedConflictCount: 0
    }
  };
  return {
    evidence,
    decision: subjectPracticeDeterministicFormalReleaseDecision(evidence)
  };
}

const physicsScopeIds = physicsProgrammatic.supportedRelations
  .map((relation) => `physics-basic-kinematics-v2:${relation}`);
const chemistryScopeIds = chemistryProgrammatic.supportedRelations.flatMap((relation) =>
  chemistryProgrammatic.supportedAnswerTargets.map((target) => `chemistry-strong-acid-base-v3:${relation}:${target}`));
const physics = decisionFor({
  subject: 'physics',
  taskFamily: 'kinematics_basic_direct_relation',
  report: physicsProgrammatic,
  expectedScopeIds: physicsScopeIds,
  actualQuestionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION
});
const chemistry = decisionFor({
  subject: 'chemistry',
  taskFamily: 'ph_dilution_strong_acid_base_neutralization',
  report: chemistryProgrammatic,
  expectedScopeIds: chemistryScopeIds,
  actualQuestionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION
});
const mathFormal = formalDecisionFor({
  subject: 'math',
  taskFamily: 'elementary_function_direct_property',
  planTemplate: 'math_elementary_function_relation_v1',
  programmatic: {
    ...mathProgrammatic,
    scopeVersion: mathRelease.expectedBinding.verificationScopeVersion
  },
  localGenerator: mathLocalGenerator,
  randomizedProperty: postFreezeRandom.subjects.math,
  expectedScopeIds: mathRelease.expectedScopeIds,
  productionProfileBindingCurrent: localGeneratorProductionProfileBinding.results
    ?.find((item) => item.subject === 'math')?.current === true
});
const physicsFormal = formalDecisionFor({
  subject: 'physics',
  taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1',
  programmatic: physicsProgrammatic,
  localGenerator: physicsLocalGenerator,
  randomizedProperty: postFreezeRandom.subjects.physics,
  expectedScopeIds: physicsScopeIds,
  productionProfileBindingCurrent: localGeneratorProductionProfileBinding.results
    ?.find((item) => item.subject === 'physics')?.current === true
});
const chemistryFormal = formalDecisionFor({
  subject: 'chemistry',
  taskFamily: 'ph_dilution_strong_acid_base_neutralization',
  planTemplate: 'chemistry_strong_acid_base_single_relation_v1',
  programmatic: chemistryProgrammatic,
  localGenerator: chemistryLocalGenerator,
  randomizedProperty: postFreezeRandom.subjects.chemistry,
  expectedScopeIds: chemistryScopeIds,
  productionProfileBindingCurrent: localGeneratorProductionProfileBinding.results
    ?.find((item) => item.subject === 'chemistry')?.current === true
});
const mathLineRelationScopeIds = mathLineRelationRandomizedProperty.scopeResults
  .map((item) => `math-basic-line-relation-v1:${item.scope}`);
const mathLineRelationFrequencyControlPolicy = Object.freeze({
  policyVersion: 'math-line-relation-frequency-control-policy-v1',
  fingerprint: 'solver_canonical_task_excluding_option_order_answer_position_and_language_surface',
  minimumPerScopeRate: 0.25,
  comparator: 'greater_than_or_equal'
});
const mathLineRelationMutationTypeCounts = {
  ...Object.fromEntries(Object.entries(mathLineRelationMutation.mutationCounts)
    .map(([type, value]) => [type, value.attempted])),
  ...Object.fromEntries(Object.entries(mathLineRelationMutation.domainMutationCounts)
    .map(([type, value]) => [type, value.attempted]))
};
const mathLineRelationFormal = formalDecisionFor({
  subject: 'math',
  taskFamily: 'math_line_relation_direct',
  planTemplate: 'math_line_relation_direct_v1',
  programmatic: {
    solverVersion: mathLineRelationLocalGenerator.solverVersion,
    scopeVersion: mathLineRelationLocalGenerator.scopeVersion,
    benchmarkVersion: 'math-line-relation-composite-readiness-evidence-v1',
    mutationCaseCount: mathLineRelationMutation.blockedMutations + mathLineRelationMutation.domainMutationBlocked,
    mutationDetectedCount: mathLineRelationMutation.blockedMutations + mathLineRelationMutation.domainMutationBlocked,
    mutationFalseAcceptCount: 0,
    mutationTypeCounts: mathLineRelationMutationTypeCounts
  },
  localGenerator: mathLineRelationLocalGenerator,
  randomizedProperty: {
    generatedAfterSolverFreeze: true,
    seedCommitmentPresent: /^[a-f0-9]{64}$/.test(mathLineRelationRandomizedProperty.seedManifest.rootSeedCommitmentSha256),
    perScopeCounts: Object.fromEntries(mathLineRelationRandomizedProperty.scopeResults
      .map((item) => [`math-basic-line-relation-v1:${item.scope}`, item.mathematicalSamples])),
    failedCount: mathLineRelationRandomizedProperty.failureCount
  },
  expectedScopeIds: mathLineRelationScopeIds,
  productionProfileBindingCurrent: false,
  semanticDiversityGatePassed: mathLineRelationLocalGenerator.results.every((item) =>
    item.uniqueCanonicalTaskFingerprints / item.generated
      >= mathLineRelationFrequencyControlPolicy.minimumPerScopeRate)
});
const mathDerivativeScopeIds = ['math-basic-derivative-v1:direct_polynomial_value'];
const mathDerivativeFormal = formalDecisionFor({
  subject: 'math',
  taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1',
  programmatic: {
    ...mathDerivativeLocalGenerator,
    mutationCaseCount: mathDerivativeMutation.attempted,
    mutationDetectedCount: mathDerivativeMutation.detected,
    mutationFalseAcceptCount: mathDerivativeMutation.falseAccepts,
    mutationTypeCounts: Object.fromEntries(Object.entries(mathDerivativeMutation.mutationCounts)
      .map(([type, value]) => [type, value.attempted]))
  },
  localGenerator: mathDerivativeLocalGenerator,
  randomizedProperty: postFreezeRandom.subjects.mathDerivative,
  expectedScopeIds: mathDerivativeScopeIds,
  productionProfileBindingCurrent: localGeneratorProductionProfileBinding.results
    ?.find((item) => item.subject === 'math' && item.productionCellId === 10)?.current === true,
  semanticDiversityGatePassed:
    mathDerivativeLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount
      / mathDerivativeLocalGenerator.sampleCount >= 0.25,
  productionShadowPortfolio: mathDerivativeSignedQualificationPortfolio
});
const entries = [
  {
    subject: 'math',
    taskFamily: mathRelease.expectedBinding.taskFamily,
    decision: mathRelease.decision,
    deterministicFormalPath: mathFormal,
    sourceCandidateCount: mathRelease.sourceAuditSummary.discoveredCandidateCount,
    localGeneration: {
      generatorVersion: mathLocalGenerator.generatorVersion,
      benchmarkVersion: mathLocalGenerator.benchmarkVersion,
      productionProfileBindingPolicyVersion: mathLocalGenerator.productionProfileBindingPolicyVersion,
      productionProfileBindingDigest: mathLocalGenerator.productionProfileBindingDigest,
      productionProfileBindingCurrent: mathFormal.evidence.commonGates.productionProfileBindingCurrent,
      samplesPerScope: mathLocalGenerator.samplesPerScope,
      minimumDevelopmentSamplesPerScope: 128,
      developmentSampleFloorSatisfied: mathLocalGenerator.samplesPerScope >= 128
        && Object.values(mathLocalGenerator.scopeCounts).every((count) => count >= 128),
      perScopeCounts: mathLocalGenerator.scopeCounts,
      sampleCount: mathLocalGenerator.sampleCount,
      selfVerifiedCount: mathLocalGenerator.selfVerifiedCount,
      reviewerProfileDifficultyMatchedCount: mathLocalGenerator.reviewerProfileDifficultyMatchedCount,
      reviewerProfileBlockingFreeCount: mathLocalGenerator.reviewerProfileBlockingFreeCount,
      semanticUniqueCount: mathLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount,
      providerCallCount: mathLocalGenerator.providerCallCount,
      estimatedCostUsd: mathLocalGenerator.estimatedCostUsd,
      releaseQualification: mathLocalGenerator.releaseQualification
    }
  },
  {
    ...physics,
    deterministicFormalPath: physicsFormal,
    sourceCandidateCount: sourceAudit.subjects.find((item) => item.subject === 'physics').visibleTargetFamilyCount,
    localGeneration: {
      generatorVersion: physicsLocalGenerator.generatorVersion,
      benchmarkVersion: physicsLocalGenerator.benchmarkVersion,
      productionProfileBindingPolicyVersion: physicsLocalGenerator.productionProfileBindingPolicyVersion,
      productionProfileBindingDigest: physicsLocalGenerator.productionProfileBindingDigest,
      productionProfileBindingCurrent: physicsFormal.evidence.commonGates.productionProfileBindingCurrent,
      samplesPerScope: physicsLocalGenerator.samplesPerScope,
      minimumDevelopmentSamplesPerScope: 128,
      developmentSampleFloorSatisfied: physicsLocalGenerator.samplesPerScope >= 128
        && Object.values(physicsLocalGenerator.scopeCounts).every((count) => count >= 128),
      perScopeCounts: physicsLocalGenerator.scopeCounts,
      sampleCount: physicsLocalGenerator.sampleCount,
      selfVerifiedCount: physicsLocalGenerator.selfVerifiedCount,
      reviewerProfileBasicCount: physicsLocalGenerator.reviewerProfileBasicCount,
      reviewerProfileDifficultyMatchedCount: physicsLocalGenerator.reviewerProfileDifficultyMatchedCount,
      reviewerProfileBlockingFreeCount: physicsLocalGenerator.reviewerProfileBlockingFreeCount,
      semanticUniqueCount: physicsLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount,
      providerCallCount: physicsLocalGenerator.providerCallCount,
      estimatedCostUsd: physicsLocalGenerator.estimatedCostUsd,
      releaseQualification: physicsLocalGenerator.releaseQualification
    }
  },
  {
    ...chemistry,
    deterministicFormalPath: chemistryFormal,
    sourceCandidateCount: sourceAudit.subjects.find((item) => item.subject === 'chemistry').visibleTargetFamilyCount,
    localGeneration: {
      generatorVersion: chemistryLocalGenerator.generatorVersion,
      benchmarkVersion: chemistryLocalGenerator.benchmarkVersion,
      productionProfileBindingPolicyVersion: chemistryLocalGenerator.productionProfileBindingPolicyVersion,
      productionProfileBindingDigest: chemistryLocalGenerator.productionProfileBindingDigest,
      productionProfileBindingCurrent: chemistryFormal.evidence.commonGates.productionProfileBindingCurrent,
      samplesPerScope: chemistryLocalGenerator.samplesPerScope,
      minimumDevelopmentSamplesPerScope: 128,
      developmentSampleFloorSatisfied: chemistryLocalGenerator.samplesPerScope >= 128
        && Object.values(chemistryLocalGenerator.scopeCounts).every((count) => count >= 128),
      perScopeCounts: chemistryLocalGenerator.scopeCounts,
      sampleCount: chemistryLocalGenerator.sampleCount,
      selfVerifiedCount: chemistryLocalGenerator.selfVerifiedCount,
      reviewerProfileDifficultyMatchedCount: chemistryLocalGenerator.reviewerProfileDifficultyMatchedCount,
      reviewerProfileBlockingFreeCount: chemistryLocalGenerator.reviewerProfileBlockingFreeCount,
      semanticUniqueCount: chemistryLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount,
      providerCallCount: chemistryLocalGenerator.providerCallCount,
      estimatedCostUsd: chemistryLocalGenerator.estimatedCostUsd,
      releaseQualification: chemistryLocalGenerator.releaseQualification
    }
  },
  {
    subject: 'math',
    taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    decision: mathLineRelationFormal.decision,
    deterministicFormalPath: mathLineRelationFormal,
    sourceCandidateCount: 12,
    evidenceIsolation: {
      inheritedFromOtherMathFamily: false,
      randomizedSeedManifest: mathLineRelationRandomizedProperty.seedManifest,
      sourceBindings: mathLineRelationRandomizedProperty.sourceBindings,
      mutationSourceBindings: mathLineRelationMutation.sourceBindings,
      evidenceClassification: mathLineRelationRandomizedProperty.evidenceClassification
    },
    frequencyControlPolicy: mathLineRelationFrequencyControlPolicy,
    perScopeDevelopmentReadiness: mathLineRelationLocalGenerator.results.map((item) => ({
      scopeId: `math-basic-line-relation-v1:${item.scope}`,
      generatedCount: item.generated,
      validatorBlockingFreeCount: item.validatorBlockingFree,
      independentRandomizedCount: mathLineRelationRandomizedProperty.scopeResults
        .find((scope) => scope.scope === item.scope)?.mathematicalSamples ?? 0,
      uniqueSemanticFingerprintIgnoringOptionPositionCount: item.uniqueSemanticFingerprintsIgnoringOptionPosition,
      uniqueSurfaceFingerprintCount: item.uniqueSurfaceFingerprints,
      uniqueCanonicalTaskFingerprintCount: item.uniqueCanonicalTaskFingerprints,
      minimumCanonicalTaskFingerprintRate: mathLineRelationFrequencyControlPolicy.minimumPerScopeRate,
      observedCanonicalTaskFingerprintRate: item.uniqueCanonicalTaskFingerprints / item.generated,
      frequencyControlPassed: item.uniqueCanonicalTaskFingerprints / item.generated
        >= mathLineRelationFrequencyControlPolicy.minimumPerScopeRate,
      productionShadowObservedCount: 0
    })),
    localGeneration: {
      generatorVersion: mathLineRelationLocalGenerator.generatorVersion,
      sampleCount: mathLineRelationLocalGenerator.sampleCount,
      selfVerifiedCount: mathLineRelationLocalGenerator.selfVerifiedCount,
      semanticUniqueCount: mathLineRelationLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount,
      providerCallCount: 0,
      estimatedCostUsd: mathLineRelationLocalGenerator.estimatedCostUsd,
      releaseQualification: false
    }
  },
  {
    subject: 'math',
    taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    decision: mathDerivativeFormal.decision,
    deterministicFormalPath: mathDerivativeFormal,
    sourceCandidateCount: 0,
    evidenceIsolation: {
      inheritedFromFullQuestionAgentResearch: false,
      fullQuestionAgentProductionEligible: false,
      generatedAfterSolverFreeze: postFreezeRandom.subjects.mathDerivative.generatedAfterSolverFreeze,
      seedCommitmentPresent: postFreezeRandom.subjects.mathDerivative.seedCommitmentPresent,
      evidenceClassification: 'sealed_post_freeze_random_property_shadow_evidence'
    },
    frequencyControlPolicy: {
      policyVersion: 'math-derivative-frequency-control-policy-v1',
      fingerprint: 'solver_canonical_task_excluding_option_order_answer_position_and_language_surface',
      minimumCanonicalTaskFingerprintRate: 0.25,
      observedCanonicalTaskFingerprintRate:
        mathDerivativeLocalGenerator.counts.uniqueCanonicalTaskFingerprints
          / mathDerivativeLocalGenerator.sampleCount,
      passed: mathDerivativeLocalGenerator.counts.uniqueCanonicalTaskFingerprints
        / mathDerivativeLocalGenerator.sampleCount >= 0.25
    },
    localGeneration: {
      generatorVersion: mathDerivativeLocalGenerator.generatorVersion,
      sampleCount: mathDerivativeLocalGenerator.sampleCount,
      selfVerifiedCount: mathDerivativeLocalGenerator.selfVerifiedCount,
      semanticUniqueCount: mathDerivativeLocalGenerator.uniqueSemanticFingerprintIgnoringOptionPositionCount,
      providerCallCount: mathDerivativeLocalGenerator.providerCallCount,
      estimatedCostUsd: mathDerivativeLocalGenerator.estimatedCostUsd,
      releaseQualification: false
    }
  }
];
const qualifiedCount = entries.filter((entry) => entry.decision.qualified).length;
const localGenerationEntries = entries.map((entry) => entry.localGeneration).filter(Boolean);
const zeroProviderSelfVerifiedCandidateCount = localGenerationEntries
  .reduce((sum, entry) => sum + entry.selfVerifiedCount, 0);
const familyAutomationQualificationMatrix = entries.map((entry) => {
  const evidence = entry.deterministicFormalPath.evidence;
  const contract = subjectPracticeProductionShadowScopeContracts().find((candidate) =>
    candidate.subject === entry.subject
      && candidate.taskFamily === entry.taskFamily
      && candidate.planTemplate === evidence.binding.planTemplate);
  const exactBindingMatched = Boolean(contract)
    && contract.expectedBinding.generatorVersion === evidence.binding.generatorVersion
    && contract.expectedBinding.solverVersion === evidence.binding.solverVersion
    && contract.expectedBinding.verificationScopeVersion === evidence.binding.verificationScopeVersion;
  const exactPlanKey = `${entry.subject}:${entry.taskFamily}:${evidence.binding.planTemplate}`;
  const signedQualificationPlan = entry.taskFamily === 'derivative_direct_evaluation'
    && mathDerivativeQualificationArtifactVerification.verified
    ? mathDerivativeQualificationArtifactVerification.qualification.perExactPlan?.[exactPlanKey]
    : null;
  const signedRealProductionShadow = entry.taskFamily === 'derivative_direct_evaluation'
    && mathDerivativeSignedQualificationPortfolio.verifiedAccumulable
    ? {
      publicationSuppressed: true,
      perScopeCounts: mathDerivativeSignedQualificationPortfolio.perScopeCounts,
      requestedCount: mathDerivativeSignedQualificationPortfolio.requestedCount,
      candidateCount: mathDerivativeSignedQualificationPortfolio.candidateCount,
      publishableCount: mathDerivativeSignedQualificationPortfolio.publishableCount,
      falseAccepts: mathDerivativeSignedQualificationPortfolio.falseAccepts,
      scopeLeakageCount: mathDerivativeSignedQualificationPortfolio.scopeLeakageCount,
      unexpectedFailureCount: mathDerivativeSignedQualificationPortfolio.unexpectedFailureCount
    }
    : null;
  const decision = subjectPracticeFamilyAutomationQualificationDecision({
    subject: entry.subject,
    taskFamily: entry.taskFamily,
    planTemplate: evidence.binding.planTemplate,
    expectedScopeIds: evidence.expectedScopeIds,
    contract: {
      registered: Boolean(contract),
      exactBindingMatched,
      localDeterministicRoute: Boolean(contract)
        && contract.expectedBinding.localShadowRoutingVersion === subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion,
      providerAttemptLimit: 0
    },
    runtimeIsolation: {
      generatorCannotReadOfficialQuestionContent: evidence.generatorSourceIsolation.originalQuestionContentOmitted,
      reversibleSourceFieldsOmitted: evidence.generatorSourceIsolation.reversibleSourceFieldsOmitted,
      sourceLinkageIdentifiersOmitted: evidence.generatorSourceIsolation.sourceLinkageIdentifiersOmitted,
      questionPlanRequired: evidence.commonGates.questionPlanValid,
      unsupportedInputAbstains: evidence.candidateVerification.unsupportedInputsAbstain
    },
    deterministicVerification: {
      solverVerified: evidence.candidateVerification.allVisibleOptionsParsed,
      independentOracleVerified: evidence.independentOracle.status === 'verified',
      explanationVerified: evidence.explanationVerification.status === 'verified',
      uniqueAnswerVerified: evidence.candidateVerification.exactlyOneTrueOption,
      generatorAnswerAgreementVerified: evidence.candidateVerification.agreesWithGenerator
    },
    offlineEvidence: {
      perScopeCounts: evidence.randomizedPropertyTests.perScopeCounts,
      failedCount: evidence.randomizedPropertyTests.failedCount,
      mutationPerTypeCounts: evidence.mutationTests.perTypeCounts,
      mutationFalseAccepts: evidence.mutationTests.falseAccepts
    },
    automatedLeakageGate: {
      available: true,
      failClosed: true,
      currentKnownCorpusCompared: signedQualificationPlan?.candidateLeakageBindingMatched === true,
      matchedCount: Number(signedQualificationPlan?.contentScore?.candidateLeakageFailureCount ?? 0)
    },
    realProductionShadow: signedRealProductionShadow ?? {
      publicationSuppressed: true,
      perScopeCounts: Object.fromEntries(evidence.expectedScopeIds.map((scopeId) => [scopeId, 0])),
      requestedCount: 0,
      candidateCount: 0,
      publishableCount: 0,
      falseAccepts: 0,
      scopeLeakageCount: 0,
      unexpectedFailureCount: 0
    },
    limitedReleaseControls: {
      exactFamilyAllowlist: true,
      smallTrafficCap: true,
      automaticRollback: true,
      qualityCircuitBreaker: true
    },
    advisoryEvidence: {
      humanBlindAuditComplete: false,
      corpusTopologyAttested: false,
      corpusConflictResolutionComplete: false,
      translationCoverageComplete: false
    }
  });
  return {
    subject: entry.subject,
    taskFamily: entry.taskFamily,
    planTemplate: evidence.binding.planTemplate,
    decision,
    signedQualificationArtifact: signedQualificationPlan ? {
      verificationStatus: mathDerivativeQualificationArtifactVerification.status,
      batchId: mathDerivativeQualificationArtifactVerification.batchId,
      manifestSha256: mathDerivativeQualificationArtifactVerification.manifestSha256,
      exactPlanKey,
      bridgeComplete: signedQualificationPlan.bridgeComplete,
      candidateIds: signedQualificationPlan.candidateIds,
      realProductionShadow: signedQualificationPlan.realProductionShadow
    } : null
  };
});
const localScopeRotationCases = [
  { subject: 'math', topicTitle: '基本初等函数', productionCellId: 16, targetDifficulty: 'basic', period: 4 },
  { subject: 'math', topicTitle: 'Line relation', productionCellId: 'line-relation-shadow-v1', targetDifficulty: 'basic', period: 4 },
  { subject: 'math', topicTitle: '导数与微积分初步', productionCellId: 10, targetDifficulty: 'basic', period: 1 },
  { subject: 'physics', topicTitle: '运动学', productionCellId: 24, targetDifficulty: 'basic', period: 4 },
  { subject: 'chemistry', topicTitle: '溶液浓度与 pH 计算', productionCellId: 42, targetDifficulty: 'medium', period: 6 }
].map((item) => {
  const rotations = Array.from({ length: item.period }, (_, currentCandidateCount) => subjectPracticeQuestionPlanScopeRotationFor({
    ...item,
    currentCandidateCount
  }));
  const uniqueScopeCount = new Set(rotations.map((rotation) => JSON.stringify({
    functionClass: rotation?.functionClass,
    propertyTarget: rotation?.propertyTarget,
    lineRelationScope: rotation?.lineRelationScope,
    derivativeScope: rotation?.derivativeScope,
    physicsKinematicsScope: rotation?.physicsKinematicsScope,
    chemistryRelationKind: rotation?.chemistryRelationKind,
    chemistryAnswerTarget: rotation?.chemistryAnswerTarget
  }))).size;
  return {
    subject: item.subject,
    taskFamily: rotations.find(Boolean)?.taskFamily ?? null,
    planTemplate: rotations.find(Boolean)?.planTemplate ?? null,
    period: item.period,
    rotationCount: rotations.filter(Boolean).length,
    uniqueScopeCount,
    completeAndBalanced: rotations.filter(Boolean).length === item.period
      && uniqueScopeCount === item.period
  };
});
const observationBatchExporter = observationBatchExporterSelfTest();
const observationBatchQualificationExporter = observationBatchQualificationExporterSelfTest();
const localShadowCandidateSeedFixture = subjectPracticeLocalShadowCandidateSeedBindingFor({
  observationBatchId: 'local-shadow-0123456789abcdefabcd',
  taskOrdinal: 1,
  productionRunId: 3,
  productionCellId: 42
});
const localShadowCandidateSeedRepeat = subjectPracticeLocalShadowCandidateSeedBindingFor({
  observationBatchId: 'local-shadow-0123456789abcdefabcd',
  taskOrdinal: 1,
  productionRunId: 3,
  productionCellId: 42
});
const localShadowCandidateSeedRotated = subjectPracticeLocalShadowCandidateSeedBindingFor({
  observationBatchId: 'local-shadow-0123456789abcdefabcd',
  taskOrdinal: 2,
  productionRunId: 3,
  productionCellId: 42
});
const report = {
  mode: 'subject_practice_three_subject_release_readiness',
  reportVersion: 'three-subject-release-readiness-v178-five-family-engine-core',
  status: qualifiedCount === entries.length ? 'all_subjects_qualified' : 'release_evidence_incomplete',
  qualifiedCount,
  automaticPublicationEligibleCount: 0,
  automaticPublicationReason: 'limited_release_gate_connected_but_runtime_default_disabled_and_no_student_publication_authorized',
  deterministicFormalQualifiedCount: entries.filter((entry) => entry.deterministicFormalPath.decision.qualified).length,
  localGeneratorProductionProfileBinding,
  localGeneratorProductionProfileBindingProtocol: localGeneratorProductionProfileBindingSelfTest(),
  familyAutomationQualification: {
    policyVersion: SUBJECT_PRACTICE_FAMILY_AUTOMATION_QUALIFICATION_POLICY_VERSION,
    status: familyAutomationQualificationMatrix.every((entry) => entry.decision.automaticShadowEligible)
      ? 'all_registered_families_automatic_shadow_eligible'
      : 'automatic_shadow_prerequisites_incomplete',
    automaticShadowEligibleCount: familyAutomationQualificationMatrix
      .filter((entry) => entry.decision.automaticShadowEligible).length,
    limitedReleaseEligibleCount: familyAutomationQualificationMatrix
      .filter((entry) => entry.decision.limitedReleaseEligible).length,
    humanReviewRequired: false,
    officialQuestionContentRuntimeIsolationRequired: true,
    manualCorpusAndTranslationEvidenceClassification: 'non_blocking_enhancement',
    entries: familyAutomationQualificationMatrix
  },
  limitedReleaseRuntimeControl: {
    policyVersion: SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION,
    runtimeGateConnected: true,
    appliesOnlyToLocalDeterministicProductionCandidates: true,
    currentConfig: subjectPracticeLimitedReleaseRuntimeConfig(),
    exactPlanAllowlistRequired: true,
    separateQualifiedPlanAllowlistRequired: true,
    serializedTrafficReservation: 'postgres_advisory_transaction_lock',
    automaticRollbackBehavior: 'stop_further_admissions_when_quality_circuit_opens',
    currentCandidateKnownCorpusLeakageClearRequired: true,
    bypassesExistingFormalPublicationGate: false,
    publicationEnabledByThisReport: false
  },
  zeroProviderSelfVerifiedCandidateCount,
  physicsBlindAuditProtocol: {
    exportSelfTest: runPhysicsBlindAuditExportSelfTest(),
    scoreSelfTest: runPhysicsBlindAuditScoreSelfTest(),
    realHumanReviewPresent: false,
    formalQualificationEligible: false
  },
  localGenerationCostEvidence: {
    providerCallCount: localGenerationEntries.reduce((sum, entry) => sum + entry.providerCallCount, 0),
    estimatedCostUsd: localGenerationEntries.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0),
    avoidedProviderCallOpportunityCount: zeroProviderSelfVerifiedCandidateCount,
    realizedSavings: false,
    reason: 'shadow_fixture_candidates_have_not_replaced_like_for_like_production_provider_calls'
  },
  localGeneratorScopeRotation: {
    policyVersion: 'subject-practice-question-plan-scope-rotation-v1',
    status: localScopeRotationCases.every((item) => item.completeAndBalanced) ? 'passed' : 'failed',
    selectionBasis: 'current_candidate_count_mod_exact_scope_period',
    preventsHashedJobIdScopeDrift: true,
    providerImpact: 'none_no_provider_call',
    cases: localScopeRotationCases
  },
  localShadowBatchPreflight: {
    reportVersion: 'subject-practice-local-shadow-batch-preflight-v8-targeted-contract-runtime-bound',
    command: 'npm.cmd run csca-ai-questioning:local-shadow-batch-preflight -- --per-family=8',
    databaseImpact: 'read_only_preflight_only',
    providerImpact: 'none_no_provider_call',
    executionAuthorized: false,
    requiresObservationOnlyRuntime: true,
    requiresLocalGeneratorShadowEnabled: true,
    requiresExactCellAllowlist: true,
    requiresCandidateSeedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
  },
  localShadowCandidateSeedPolicy: {
    policyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    identityInputs: ['observationBatchId', 'taskOrdinal', 'productionRunId', 'productionCellId'],
    databaseGeneratedIdentityInputs: [],
    databaseIdentityIndependent: localShadowCandidateSeedFixture.databaseIdentityIndependent === true,
    deterministicReplay: localShadowCandidateSeedFixture.seed === localShadowCandidateSeedRepeat.seed,
    ordinalRotation: localShadowCandidateSeedFixture.seed !== localShadowCandidateSeedRotated.seed,
    sharedByOfflineAndRuntimeGeneration: true,
    boundIntoQualificationAuthorizationPlan: true,
    staleRuntimeFailsClosed: true
  },
  campaignBoundObservationManifest: {
    currentPolicyVersion: 'subject-practice-observation-batch-manifest-v11-campaign-bound',
    legacyPolicyVersionStillAccepted: 'subject-practice-observation-batch-manifest-v10-production-profile-bound',
    explicitCampaignIdRequiredForDynamicAddendum: true,
    campaignIdBoundIntoManifestShaAndBatchId: true,
    repeatedPreviewWithSameCampaignIsDeterministic: true,
    differentCampaignCreatesIndependentBatchIdentity: true,
    targetBackendCapabilityRequired: true,
    publicationImpact: 'none'
  },
  automatedCandidateLeakageGate: {
    policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
    integrationBoundary: 'after_local_generation_before_question_insert_and_automatic_gate',
    sourceQueryBoundary: 'separate_post_generation_active_database_source_corpus',
    sourceContentExposedToGenerator: false,
    missingCorpusBehavior: 'fail_closed_review_failed_regenerate',
    blockedOrAmbiguousBehavior: 'fail_closed_review_failed_regenerate',
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
    sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
    sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
    scannedRevisionCountMustEqualSnapshotRevisionCount: true,
    observationEvidencePolicyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_EVIDENCE_POLICY_VERSION,
    observationQualificationPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_QUALIFICATION_POLICY_VERSION,
    productionShadowEvidenceProtocolVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
    trustedExporterVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION,
    signedEventMustExactlyMatchTaskLeakageEvidence: true,
    currentKnownCorpusCounts: { math: 151, physics: 138, chemistry: 136 },
    runtimeCandidateEvidencePresent: false,
    providerImpact: 'none_no_provider_call',
    status: 'implemented_real_corpus_available_pending_first_shadow_candidate'
  },
  readOnlyDbCandidateNoveltyEvidence: {
    ...readOnlyDbNoveltyEvidence,
    protocolSelfTest: readOnlyNoveltyEvidenceProtocol,
    policySelfTest: readOnlyDbNoveltyEvidencePolicyProtocol,
    verification: readOnlyDbNoveltyEvidenceVerification,
    totalEvaluatedCandidateCount: readOnlyDbNoveltyEvidence.subjects
      .reduce((sum, entry) => sum + entry.evaluatedCandidateCount, 0),
    allSubjectEvidenceDigestsPresent: readOnlyDbNoveltyEvidence.subjects
      .every((entry) => /^[a-f0-9]{64}$/.test(entry.evidenceDigest)),
    replacesRuntimeProductionShadowEvidence: false,
    limitedReleaseGateImpact: 'none_nonqualifying_measurement_only'
  },
  scenarioDiversityShadow: {
    ...scenarioDiversity,
    integrationBoundary: 'question_plan_candidate_metadata_and_sealed_observation_batch_evidence',
    thresholdStatus: 'frozen_independent_holdout_required',
    qualificationPolicyVersion: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
    calibrationBatchId: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
    frozenThresholds: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_THRESHOLDS,
    releaseGateImpact: 'blocks_hmac_qualification_export_until_independent_holdout_passes',
    formalGeneratorOfficialQuestionVisibility: false
  },
  scenarioBlueprintProposalShadow: {
    ...scenarioBlueprintProposalProtocol,
    exactSolverSemanticsForbiddenAtProposalGate: true,
    exactSolverSemanticAliasesForbiddenAtProposalGate: true,
    compatibleScopeReuseRequiresSolverNeutralBlueprints: true,
    currentSeedCatalogRole: 'seed_catalog_and_protocol_fixture_not_closed_world',
    connectedToProductionGeneration: false,
    changesCurrentObservationManifest: false,
    promotionThresholdsFrozen: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintPromotionShadow: {
    ...scenarioBlueprintPromotionProtocol,
    creativeSpecificityRequired: true,
    instructionLikePromptCopyFailsPromotion: true,
    physicsLiveInstructionLikePurposeCount: 4,
    chemistryLiveInstructionLikePurposeCount: 0,
    liveExecutionAcceptanceDoesNotImplyStablePromotion: true,
    connectedToProductionGeneration: false,
    performancePromotionThresholdsFrozen: false,
    automaticStablePromotionAllowed: false,
    humanReviewRequired: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintMemoryShadow: {
    ...scenarioBlueprintMemoryProtocol,
    historyInput: 'fingerprints_dimensions_lifecycle_and_failure_codes_only',
    selectionQuotaFrozen: false,
    selectionAuthorizesGeneration: false,
    connectedToProductionGeneration: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintIdeationShadow: {
    ...scenarioBlueprintIdeationProtocol,
    exactResponseGateShapeMirroredInProviderPrompt: true,
    exactCandidateAndSurfaceKeysRequired: true,
    schemaDescriptionCopyingForbidden: true,
    renameInvariantBatchUniquenessExplicit: true,
    fullExactBindingRetainedLocally: true,
    providerSeesExactScope: false,
    providerSeesTaskFamilyOrPlanTemplate: false,
    providerProjectionIsSubjectContextClassOnly: true,
    promptOnly: true,
    providerCallAuthorized: false,
    connectedToProductionGeneration: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintResponseShadow: {
    ...scenarioBlueprintResponseProtocol,
    allOrNothing: true,
    cherryPickingAllowed: false,
    connectedToProductionGeneration: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintOrchestratorShadow: {
    ...scenarioBlueprintOrchestratorProtocol,
    responseThenHistoryRanking: true,
    selectionQuotaFrozen: false,
    selectionAuthorizesGeneration: false,
    connectedToProductionGeneration: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintMaterializationShadow: {
    ...scenarioBlueprintMaterializationProtocol,
    contextActionSeparatedFromSolverAction: true,
    deterministicPolicyOwnsPlausibility: true,
    connectedToLocalShadowGenerators: true,
    shadowEvidenceBindsContractSurfaceAndSolver: true,
    connectedToProductionGeneration: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintObservationAddendumShadow: {
    ...scenarioBlueprintObservationAddendumProtocol,
    physicsLiveAddendumMaterialized: true,
    physicsLiveAddendumSha256: '23b9b4db9a9c3a94975d0db424453663da380235729a1ff7095b3daf37a7059a',
    physicsLiveEntryCount: 32,
    chemistryLiveAddendumMaterialized: true,
    chemistryLiveAddendumSha256: '9f4105e5a0f3de668cfaa59e463718b94d8c717b8c445614efcb6733cb1ca2aa',
    chemistryLiveEntryCount: 48,
    latestTargetBackendPreviewBaseUrl: 'http://127.0.0.1:3002',
    latestTargetBackendPreviewReady: true,
    latestTargetBackendCellAllowlist: '24,42',
    futureApplyMustRevalidateTargetBackendAndActiveTasks: true,
    localObservationBatchExecutionAuthorized: false,
    manifestVersionChanged: false,
    compactPerTaskEnvelope: true,
    fullBatchCoverageRequired: true,
    maximumScenarioFamilyShare: 0.25,
    authorizationPlanBindsScenarioBlueprintRoot: true,
    connectedToSuppressedLocalObservationRoute: true,
    hmacQualificationAllowedBeforeCalibration: false,
    staleBackendCapabilityMismatchFailsClosed: true,
    connectedToStudentPublication: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintObservationPackShadow: {
    ...scenarioBlueprintObservationPackProtocol,
    sharedContractValidationOrder: ['physics_canary', 'chemistry_after_physics_acceptance'],
    chemistryExactOutputContractPackPrepared: true,
    chemistryProspectiveTaskCount: 48,
    chemistryProspectiveProviderCallCount: 1,
    chemistryProviderCallDeferredUntilPhysicsContractAccepted: true,
    exactScopeRequestAmortization: true,
    compatibleScopeProviderRequestReuse: true,
    retryPackInstanceCanonicalizedBeforeHashing: true,
    retryPackInstanceBoundDuringMaterialization: true,
    physicsLogicalRequestCount: 4,
    physicsProviderRequestCount: 1,
    physicsProviderCallsPerQuestion: 0.03125,
    chemistryInstancePackMaterializesAllFortyEightOrdinals: true,
    outputBudgetCalibration: {
      representativeFourBlueprintUtf16Characters: 1837,
      conservativeTwoCharactersPerTokenEstimate: 919,
      currentMaximumOutputTokens: 1200,
      reductionDeferredUntilAcceptedLiveResponse: true
    },
    responseCandidatesReusedByDeterministicRotation: true,
    costAdmissionModel: 'deepseek-v4-flash',
    pricingBasis: 'official_peak_cache_miss',
    hardMaximumCostUsdPerCall: 0.0025,
    hardMaximumTotalCostUsd: 0.01,
    serialExecutionRequired: true,
    stopOnFirstFailure: true,
    providerCallsAreOnlyProspectiveAndSeparatelyAuthorized: true,
    dollarSavingsClaimed: false,
    connectedToStudentPublication: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintObservationExecutionShadow: {
    ...scenarioBlueprintObservationExecutionProtocol,
    defaultMode: 'read_only_preview',
    exactAuthorizationDigestRequired: true,
    authorizationDigestSingleUseReceipt: true,
    authorizationConsumptionVisibleDuringPreview: true,
    outputCollisionVisibleDuringPreview: true,
    outputPathRequiredForApplyReady: true,
    previewWithoutOutputPathNeverReportsReady: true,
    localAuthorizationAndOutputConflictsCheckedBeforeNetwork: true,
    environmentKeyPreflightBeforeAuthorizationConsumption: true,
    anonymousNetworkPreflightBeforeAuthorizationConsumption: true,
    immutableRetryPackInstanceSupported: true,
    executionOrder: 'strictly_serial_stop_on_first_failure',
    providerAttemptLimitPerRequest: 1,
    thinkingMode: 'disabled',
    responseGateAppliedAfterEveryRequest: true,
    rejectedRawResponseRetainedUnderExecutionAuthorization: true,
    rejectedCandidateFailureCodesReceiptBound: true,
    actualUsageCostEvidenceRequired: true,
    executionReceiptRevalidatedBeforeCampaignMaterialization: true,
    campaignMaterializationRejectsLooseResponseFiles: true,
    responseEvidenceDigestRecomputed: true,
    providerCallCoverageMatchesAdmissionGroups: true,
    logicalResponsesValidatedByUniqueRequestDigest: true,
    interleavedCompatibilityGroupsSupported: true,
    providerCallContentHashMatchesEveryLogicalResponse: true,
    recomputedPlainDigestCannotBypassSemanticLinkage: true,
    actualTokenCostRecomputed: true,
    connectedToObservationTaskWrites: false,
    connectedToCandidateWrites: false,
    connectedToStudentPublication: false,
    releaseGateImpact: 'none_shadow_only'
  },
  scenarioBlueprintSpendAudit: {
    ...scenarioBlueprintSpendAuditProtocol,
    scansLocalAuthorizationReceiptsOnly: true,
    executionReceiptDigestRecomputedBeforeCostClassification: true,
    legacyProviderAttemptWithoutUsageIsNeverReportedAsZero: true,
    unresolvedCostSeparatedFromRecordedActualCost: true,
    conservativeEnvelopeIsNotReportedAsActualBilling: true,
    candidateContentIncluded: false,
    connectedToStudentPublication: false,
    releaseGateImpact: 'none_cost_observability_only'
  },
  scenarioBlueprintValidationLadder: {
    ...scenarioBlueprintValidationLadderProtocol,
    liveCanarySubject: 'physics',
    liveCanaryAcceptedResponseCount: 4,
    liveCanaryProviderCallCount: 1,
    liveCanaryActualCostUsd: 0.00075768,
    liveCanaryReceiptDigestVerified: true,
    nextEligibleSubject: 'chemistry',
    followerRequiresSeparateExactAuthorization: true,
    observationTaskWriteAuthorized: false,
    candidateWriteAuthorized: false,
    connectedToStudentPublication: false,
    releaseGateImpact: 'none_live_blueprint_contract_evidence_only'
  },
  productionCandidateFunnelAudit: {
    semanticsVersion: 'subject-practice-production-diagnostics-funnel-v2-gate-outcome-aware',
    pendingReviewAutomaticallyCountedAsRejected: false,
    explicitGateRejectSeparatedFromPublishablePending: true,
    gatePassYieldReportedSeparatelyFromPublishYield: true,
    productionImpact: 'none_read_only_audit_semantics'
  },
  zeroProviderObservationCostAdmission: {
    policyVersion: 'guarded-observation-zero-provider-cost-reservation-v1',
    providerBoundaryVersion: 'guarded-observation-provider-boundary-v2',
    generationJobAdmissionVersion: 'subject-practice-observation-execution-admission-v2-zero-provider-generation-job',
    requiredExecutionRoute: 'local_deterministic_zero_provider',
    requiredMaximumEstimatedCostUsd: 0,
    requiredMaximumReservedCostUsd: 0,
    providerAttemptLimit: 0,
    exactPlanSupportRequired: true,
    runtimeRouteRevalidationRequired: true,
    generationJobUsesSameRouteAwareCostContract: true,
    executionRoutePersistedInGenerationJobMetadata: true,
    status: 'implemented_and_targeted_tests_passed'
  },
  localShadowObservationBackendStartup: {
    command: 'npm.cmd run backend:dev:observation:local-shadow -- --port=3001 --question-plan-cell-allowlist=<exact-cell-id-list>',
    observationOnlyModeForced: true,
    questionPlanForcedOn: true,
    localDeterministicGeneratorForcedOn: true,
    exactCellAllowlistRequiredBeforeProcessSpawn: true,
    allowlistAcceptsOnlyPositiveIntegerCellIds: true,
    configuredPortRangeValidated: '1_to_65535',
    runtimeFailureGuidanceUsesRequestedBaseUrlPort: true,
    submitsTasksByItself: false,
    providerCallsByItself: false,
    status: 'implemented_and_targeted_tests_passed'
  },
  localZeroProviderBatchExecution: {
    protocolVersion: 'subject-practice-local-shadow-three-subject-run-v2',
    targetedFamilyRunnerVersion:
      'subject-practice-local-shadow-family-qualification-run-v6-math-derivative-runtime-bound',
    targetedAuthorizationProtocolVersion:
      'subject-practice-local-shadow-family-qualification-run-v4-runtime-contract-bound',
    exactRegistryRoutingAndFamilyComponentVersionsBoundIntoAuthorization: true,
    previewNotReadyCannotReachSubmissionPath: true,
    freshRuntimeRevalidationImmediatelyBeforeFirstSubmission: true,
    resumeUsesSameExactRuntimeContract: true,
    command: 'npm.cmd run csca-ai-questioning:local-shadow-three-subject-run -- --count-per-subject=1',
    defaultMode: 'read_only_preview',
    exactAuthorizationDigestRequired: true,
    executionOrder: 'strictly_serial_stop_on_first_non_success',
    providerAttemptLimit: 0,
    providerKeysRequired: false,
    observationOnlyRuntimeRequired: true,
    exactCellAllowlistRequired: true,
    studentPublicationSuppressed: true,
    waitPollingProtocol: localShadowWaitPolling,
    status: 'three_subject_generators_db_novelty_clear_exact_generator_version_bound_new_v8_batch_not_authorized'
  },
  sealedObservationBatchEvidence: {
    manifestProtocol: observationBatchManifest,
    completeBatchEvidenceProtocol: observationBatchEvidence,
    readOnlyBatchExporterProtocol: observationBatchExporter,
    readOnlyBatchExporterPreflight: observationBatchExporterPreflight(),
    taskToSignedCandidateQualificationProtocol: observationBatchQualification,
    oneTransactionQualificationExporterProtocol: observationBatchQualificationExporter,
    oneTransactionQualificationExporterPreflight: observationBatchQualificationExporterPreflight(),
    manifestAuthoritativeScopeBindingProtocol: observationScopeBinding,
    fullFamilyQualificationBatchProtocol: familyQualificationBatch,
    fullFamilyQualificationMemoryRehearsal: familyQualificationMemoryRehearsal,
    interruptedBatchResumePlannerProtocol: observationBatchResume,
    interruptedBatchResumeRunnerProtocol: familyResumeRunner,
    exactBatchTaskQueryEndpointImplemented: true,
    exactBatchTaskQueryMaximumCount: 64,
    interruptedBatchRunnerIntegrationComplete: true,
    initialAndResumeBatchExecutionShareVerifiedCore: true,
    contentFreeOrdinalProgressEventsImplemented: true,
    executionLatencyMetricsSeparateWaitSubmitAndReuse: true,
    unsignedQualificationPrecheckUsesFormalThresholds: true,
    unsignedPrecheckCannotAuthorizePublication: true,
    failedBatchCannotReceiveExportCommandOrOrdinalRetry: true,
    resumeRequiresExactBatchIdAndConfirmationDigest: true,
    resumeSubmitsOnlyMissingOrdinals: true,
    alreadyTerminalBatchSubmitsNoTasks: true,
    serverSubmissionRequiresManifestForLocalZeroProviderRoute: true,
    databaseUniqueness: 'batch_id_plus_task_ordinal',
    terminalFailuresRemainInDenominator: true,
    callerSelectedCandidateIdsCannotDefineBatchRates: true,
    databaseSelectionBoundary: 'sealed_batch_id_only',
    status: observationBatchManifest.status === 'passed'
      && observationBatchEvidence.status === 'passed'
      && observationBatchExporter.status === 'passed'
      && observationBatchQualification.status === 'passed'
      && observationBatchQualificationExporter.status === 'passed'
      && observationScopeBinding.status === 'passed'
      && familyQualificationBatch.status === 'passed'
      && familyQualificationMemoryRehearsal.status === 'passed'
      && observationBatchResume.status === 'passed'
      && familyResumeRunner.status === 'passed'
      && localShadowWaitPolling.status === 'passed'
      ? observationBatchQualificationExporterPreflight().hmacSecretConfigured
        ? 'end_to_end_read_only_qualification_export_ready'
        : 'end_to_end_read_only_qualification_export_implemented_hmac_configuration_required'
      : 'protocol_self_test_failed'
  },
  generatorSourceIsolation,
  sourceCorpusScanProtocol,
  sourceCorpusCalibrationProtocol,
  sourceCorpusLengthPolicyProtocol,
  commonFragmentCorpusProtocol,
  sourceCorpusStructureShadowProtocol,
  candidateOutputNoveltyResolutionProtocol,
  candidateOutputNoveltyShadowProtocol,
  sourceCorpusCalibrationBootstrap: sourceCorpusCalibrationBootstrapSummary(
    buildSourceCorpusCalibrationBootstrap(process.cwd())
  ),
  sourceCorpusLocalScanPreflight: sourceCorpusLocalScanPreflight(),
  sourceCorpusDbInventoryPreflight: sourceCorpusDbInventoryPreflight(),
  sourceCorpusInventoryReconcileProtocol: sourceCorpusInventoryReconcileSelfTest(),
  sourceCorpusConflictReviewProtocol: sourceCorpusConflictReviewSelfTest(),
  sourceCorpusConflictReviewScoreProtocol: sourceCorpusConflictReviewScoreSelfTest(),
  sourceCorpusConflictResolutionProtocol: sourceCorpusConflictResolutionSelfTest(),
  sourceCorpusDumpMirrorAuditProtocol: sourceCorpusDumpMirrorAuditSelfTest(),
  sourceCorpusDumpMirrorAuditPreflight: sourceCorpusDumpMirrorAuditPreflight(),
  sourceCorpusTopologyProtocol: {
    ...sourceCorpusTopologySelfTest(),
    realTopologyQualificationPresent: false,
    formalQualificationEligible: false,
    reason: 'signed_real_environment_topology_evidence_not_present'
  },
  sourceCorpusTopologyReviewExportProtocol: sourceCorpusTopologyReviewExportSelfTest(),
  sourceCorpusTopologyReviewExportPreflight: sourceCorpusTopologyReviewExportPreflight(),
  sourceCorpusTopologyReviewScoreProtocol: sourceCorpusTopologyReviewScoreSelfTest(),
  sourceCorpusTopologyReviewScorePreflight: sourceCorpusTopologyReviewScorePreflight(),
  sourceCorpusTopologyAttestationIssueProtocol: sourceCorpusTopologyAttestationIssueSelfTest(),
  sourceCorpusTopologyAttestationIssuePreflight: sourceCorpusTopologyAttestationIssuePreflight(),
  sourceCorpusTopologyQualifiedInventoryProtocol: sourceCorpusTopologyQualifiedInventorySelfTest(),
  sourceCorpusTopologyQualifiedInventoryPreflight: sourceCorpusTopologyQualifiedInventoryPreflight(),
  sourceCorpusStructuredRebuildProtocol: sourceCorpusStructuredRebuildSelfTest(),
  sourceCorpusStructuredRebuildPreflight: sourceCorpusStructuredRebuildPreflight(),
  sourceCorpusReleaseQualificationProtocol: sourceCorpusReleaseQualificationSelfTest,
  sourceCorpusLengthAxisCapacityProtocol: sourceCorpusLengthAxisCapacitySelfTest(),
  sourceCorpusLengthAxisCapacityPreflight: sourceCorpusLengthAxisCapacityPreflight(),
  sourceCorpusTranslationWorkPackProtocol: sourceCorpusTranslationWorkPackSelfTest(),
  sourceCorpusTranslationWorkPackPreflight: sourceCorpusTranslationWorkPackPreflight(),
  sourceCorpusTranslationPromptProtocol: sourceCorpusTranslationPromptSelfTest(),
  sourceCorpusTranslationPromptPreflight: sourceCorpusTranslationPromptPreflight(),
  sourceCorpusTranslationResponseGateProtocol: sourceCorpusTranslationResponseGateSelfTest(),
  sourceCorpusTranslationResponseGatePreflight: sourceCorpusTranslationResponseGatePreflight(),
  sourceCorpusTranslationHumanReviewProtocol: sourceCorpusTranslationHumanReviewSelfTest(),
  sourceCorpusTranslationHumanReviewPreflight: sourceCorpusTranslationHumanReviewPreflight(),
  sourceCorpusTranslationRevisionMaterializeProtocol: sourceCorpusTranslationRevisionMaterializeSelfTest(),
  sourceCorpusTranslationRevisionMaterializePreflight: sourceCorpusTranslationRevisionMaterializePreflight(),
  sourceCorpusTranslationProgressProtocol: sourceCorpusTranslationProgressSelfTest(),
  sourceCorpusTranslationProgressPreflight: sourceCorpusTranslationProgressPreflight(),
  localDbPartialGraphShadowPreflight: localDbPartialGraphShadowPreflight(),
  scopeOpportunityShadowPreflight: scopeOpportunityShadowPreflight(),
  productionShadowRehearsal,
  productionShadowEvidenceProtocol,
  productionShadowTrustedExporter,
  mathDerivativeSignedQualificationPortfolio,
  trustedShadowCandidateLeakageBinding: {
    required: true,
    evidenceProtocolVersion: productionShadowEvidenceProtocol.fixtureScore.protocolVersion,
    trustedExporterVersion: productionShadowTrustedExporter.exporterVersion,
    candidateLeakageFailureCount: productionShadowTrustedExporter.trustedScore.candidateLeakageFailureCount,
    missingPersistedLeakageEvidenceRejected:
      productionShadowTrustedExporter.checks.persistedCandidateLeakageEvidenceRequired === true,
    blockedOrAmbiguousLeakageCannotQualify:
      productionShadowEvidenceProtocol.checks.candidateLeakageFailureIsCountedAndNonqualifying === true,
    exporterSecretEnvironmentVariable: 'CSCA_PRODUCTION_SHADOW_EXPORTER_HMAC_SECRET',
    exporterSecretConfigured: String(process.env.CSCA_PRODUCTION_SHADOW_EXPORTER_HMAC_SECRET ?? '').trim().length >= 32
  },
  trustedShadowScenarioBinding: {
    requiredBeforeSignedExport: true,
    evidenceProtocolVersion: productionShadowEvidenceProtocol.fixtureScore.protocolVersion,
    trustedExporterVersion: productionShadowTrustedExporter.exporterVersion,
    persistedScenarioEvidenceRequired:
      productionShadowTrustedExporter.checks.persistedScenarioEvidenceRequired === true,
    hmacPayloadIncludesScenarioEvidence: true,
    scenarioFailureCountedByEvidenceProtocol:
      productionShadowEvidenceProtocol.checks.scenarioFailureObservedWithoutPrematureReleaseGate === true,
    thresholdStatus: 'frozen_independent_holdout_required',
    qualificationPolicyVersion: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
    calibrationBatchId: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
    frozenThresholds: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_THRESHOLDS,
    hmacQualificationExportRequiresIndependentHoldout: true,
    localShadowCandidateSeedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    sealedCandidateIdentityRequiredBeforeSignedExport: true
  },
  localGeneratorShadowRouting: subjectPracticeLocalGeneratorShadowRoutingPolicy(),
  productionShadowScopeRegistry: {
    registryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    contracts: subjectPracticeProductionShadowScopeContracts().map((contract) => ({
      subject: contract.subject,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      exactScopeCount: contract.expectedScopeIds.length,
      expectedBinding: contract.expectedBinding
    }))
  },
  productionShadowReadOnlyExporter: productionShadowReadOnlyExporterPreflight(),
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_read_only_benchmark_composition',
  entries
};

if (require.main === module) {
  const compact = process.argv.includes('--compact');
  const derivativeEntry = entries.find((entry) => entry.taskFamily === 'derivative_direct_evaluation');
  const derivativeAutomation = familyAutomationQualificationMatrix
    .find((entry) => entry.taskFamily === 'derivative_direct_evaluation');
  const output = compact ? {
    reportVersion: report.reportVersion,
    status: report.status,
    qualifiedCount: report.qualifiedCount,
    automaticPublicationEligibleCount: report.automaticPublicationEligibleCount,
    zeroProviderSelfVerifiedCandidateCount: report.zeroProviderSelfVerifiedCandidateCount,
    familyAutomationQualification: {
      status: report.familyAutomationQualification.status,
      automaticShadowEligibleCount: report.familyAutomationQualification.automaticShadowEligibleCount,
      limitedReleaseEligibleCount: report.familyAutomationQualification.limitedReleaseEligibleCount
    },
    derivative: derivativeEntry ? {
      formalDecision: derivativeEntry.decision,
      localGeneration: derivativeEntry.localGeneration,
      automationDecision: derivativeAutomation?.decision ?? null,
      signedQualificationPortfolio: {
        status: report.mathDerivativeSignedQualificationPortfolio.status,
        portfolioSha256: report.mathDerivativeSignedQualificationPortfolio.portfolioSha256,
        batchCount: report.mathDerivativeSignedQualificationPortfolio.batchCount,
        perScopeCounts: report.mathDerivativeSignedQualificationPortfolio.perScopeCounts,
        remainingPerScope: report.mathDerivativeSignedQualificationPortfolio.remainingPerScope,
        formalShadowThresholdSatisfied:
          report.mathDerivativeSignedQualificationPortfolio.formalShadowThresholdSatisfied
      }
    } : null,
    productionShadowScopeRegistry: {
      registryVersion: report.productionShadowScopeRegistry.registryVersion,
      contractCount: report.productionShadowScopeRegistry.contracts.length,
      exactScopeCount: report.productionShadowScopeRegistry.contracts
        .reduce((sum, contract) => sum + contract.exactScopeCount, 0)
    },
    localGeneratorProductionProfileBinding: {
      status: report.localGeneratorProductionProfileBinding.status,
      checkedCount: report.localGeneratorProductionProfileBinding.checkedCount,
      matchedCount: report.localGeneratorProductionProfileBinding.matchedCount
    },
    familyQualificationMemoryRehearsal: {
      version: report.sealedObservationBatchEvidence.fullFamilyQualificationMemoryRehearsal.reportVersion,
      status: report.sealedObservationBatchEvidence.fullFamilyQualificationMemoryRehearsal.status,
      familyCount: report.sealedObservationBatchEvidence.fullFamilyQualificationMemoryRehearsal.familyCount,
      deferredFamilyCount: report.sealedObservationBatchEvidence.fullFamilyQualificationMemoryRehearsal.deferredFamilyCount
    }
  } : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (process.argv.includes('--require-qualified') && qualifiedCount !== entries.length) process.exitCode = 1;
}

module.exports = { report };
