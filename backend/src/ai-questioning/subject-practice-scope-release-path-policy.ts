import {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} from './subject-practice-generator-source-isolation-policy';
import {
  SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION
} from './subject-practice-source-corpus-scan-policy';
import {
  SubjectPracticeSourceCorpusReleaseQualification,
  subjectPracticeSourceCorpusReleaseQualificationMatches
} from './subject-practice-source-corpus-release-qualification-policy';

export const SUBJECT_PRACTICE_SCOPE_RELEASE_PATH_POLICY_VERSION = 'subject-practice-scope-release-path-policy-v9';

export const SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS = {
  minimumRandomizedCasesPerScope: 128,
  minimumMutationCases: 200,
  minimumMutationCasesPerType: 32,
  minimumBlindAuditPerScope: 8,
  minimumBlindStrictQualifiedRate: 0.95,
  minimumProductionShadowCases: 100,
  maximumFalseAccepts: 0,
  maximumScopeLeakage: 0,
  maximumUnexpectedConflicts: 0
} as const;

export type SubjectPracticeScopeReleaseBinding = {
  subject: string;
  taskFamily: string;
  planTemplate: string;
  questionPlanPolicyVersion: string;
  solverVersion: string;
  verificationScopeVersion: string;
  generatorVersion: string;
  benchmarkVersion: string;
};

export type SubjectPracticeDeterministicFormalEvidence = {
  binding: SubjectPracticeScopeReleaseBinding;
  expectedScopeIds: string[];
  commonGates: {
    syllabusScopeBound: boolean;
    questionPlanValid: boolean;
    candidatePlanAdherent: boolean;
    deterministicValidatorBlockingFree: boolean;
    semanticDiversityGatePassed: boolean;
    publicationScopeIsCandidateExactNotFamilyWide: boolean;
  };
  generatorSourceIsolation: {
    policyVersion: string;
    status: 'enforced_structural_projection' | 'missing' | 'failed';
    boundary: string;
    allowedInput: string;
    originalQuestionContentOmitted: boolean;
    reversibleSourceFieldsOmitted: boolean;
    developerUnseenRequired: boolean;
    officialHoldoutRequiredForGeneratorIsolation: boolean;
    sourceLinkageIdentifiersOmitted: boolean;
    profileAggregationPolicyVersion: string;
    profileMinimumSampleSize: number;
    profileProjectionMode: string;
    providerProjectionHashRecomputed: boolean;
    knownSourceCorpusComparisonPassed: boolean;
    knownSourceLeakMatchCount: number;
    providerProjectionSha256Present: boolean;
    providerProjectionSha256: string;
  };
  fullSourceCorpusIsolation: {
    currentCorpusSnapshotBound: boolean;
    profileAssetContentSha256: string;
    profileAssetAdmission: SubjectPracticeSourceCorpusReleaseEvidence;
    generatorProjection: SubjectPracticeSourceCorpusReleaseEvidence;
  };
  candidateOutputCorpusNovelty: {
    currentCorpusSnapshotBound: boolean;
    candidateContentSha256: string;
    candidateOutput: SubjectPracticeSourceCorpusReleaseEvidence;
  };
  candidateVerification: {
    evidenceBoundary: string;
    allVisibleOptionsParsed: boolean;
    exactlyOneTrueOption: boolean;
    agreesWithGenerator: boolean;
    exactScopeMatched: boolean;
    unsupportedInputsAbstain: boolean;
  };
  explanationVerification: {
    status: 'verified' | 'missing' | 'failed';
    implementationId: string | null;
    recomputedWithoutGeneratorExplanation: boolean;
    formulaInputsUnitsAndConclusionChecked: boolean;
    verifiedCount: number;
    mismatchCount: number;
  };
  independentOracle: {
    status: 'verified' | 'missing' | 'failed';
    implementationId: string | null;
    sharesGeneratorCoreFunctions: boolean;
    sharesSolverCoreFunctions: boolean;
    comparedCount: number;
    agreementCount: number;
    falseAccepts: number;
  };
  randomizedPropertyTests: {
    generatedAfterSolverFreeze: boolean;
    seedCommitmentPresent: boolean;
    perScopeCounts: Record<string, number>;
    failedCount: number;
  };
  mutationTests: {
    total: number;
    detected: number;
    falseAccepts: number;
    perTypeCounts: Record<string, number>;
    requiredTypes: string[];
  };
  blindHumanAudit: {
    answerKeyHiddenUntilLocked: boolean;
    validEvidence: boolean;
    perScopeCounts: Record<string, number>;
    strictQualifiedRate: number | null;
  };
  productionShadow: {
    publicationSuppressed: boolean;
    observedCount: number;
    perScopeCounts: Record<string, number>;
    falseAccepts: number;
    scopeLeakageCount: number;
    unexpectedConflictCount: number;
  };
  officialHoldout?: {
    present: boolean;
    strengthensEvidenceOnly: true;
    total: number;
    verified: number;
    falseAccepts: number;
  };
};

export type SubjectPracticeDeterministicFormalDecision = {
  policyVersion: string;
  qualificationPath: 'deterministic_formal';
  status: 'formal_qualified' | 'not_qualified';
  qualified: boolean;
  reasonCodes: string[];
  expectedScopeIds: string[];
  metrics: {
    randomizedCaseCount: number;
    minimumRandomizedPerScope: number | null;
    mutationDetectionRate: number | null;
    oracleAgreementRate: number | null;
    explanationMismatchCount: number;
    blindStrictQualifiedRate: number | null;
    productionShadowCount: number;
    minimumProductionShadowPerScope: number | null;
    officialHoldoutPresent: boolean;
    generatorSourceIsolationSatisfied: boolean;
    fullSourceCorpusIsolationSatisfied: boolean;
    candidateOutputCorpusNoveltySatisfied: boolean;
  };
  confidenceEnhancements: {
    blindHumanAudit: {
      requiredForQualification: false;
      status: 'satisfied' | 'not_satisfied';
      reasonCode: 'confidence_enhancement_blind_human_audit_threshold_not_met' | null;
    };
    officialHoldout: {
      requiredForQualification: false;
      status: 'present' | 'not_present';
    };
  };
  thresholds: typeof SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS;
  productionGateImpact: 'none_shadow_policy_only';
};

type SubjectPracticeSourceCorpusReleaseEvidence = {
  status: 'pass' | 'fail' | 'missing';
  trustedAttestation: boolean;
  targetContentBound: boolean;
  targetContentSha256: string;
  sourceCorpusSnapshotId: string;
  sourceCorpusSnapshotSha256: string;
  corpusCoverageStatus: 'all_system_known_source_exam_reference' | 'partial' | 'missing';
  corpusBuilderVersion: string;
  scannerPolicyVersion: string;
  normalizationVersion: string;
  matchingAlgorithmVersion: string;
  thresholdVersion: string;
  matchedCount: number;
  qualification: SubjectPracticeSourceCorpusReleaseQualification | null;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function validUnitRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validBinding(binding: SubjectPracticeScopeReleaseBinding) {
  return Object.values(binding).every((value) => Boolean(clean(value)));
}

export function subjectPracticeDeterministicFormalReleaseDecision(
  evidence: SubjectPracticeDeterministicFormalEvidence
): SubjectPracticeDeterministicFormalDecision {
  const thresholds = SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS;
  const expectedScopeIds = Array.from(new Set((evidence.expectedScopeIds ?? []).map(clean).filter(Boolean)));
  const randomizedCounts = expectedScopeIds.map((scopeId) => finiteNonNegative(evidence.randomizedPropertyTests.perScopeCounts?.[scopeId]));
  const randomizedCaseCount = randomizedCounts.reduce((sum, count) => sum + count, 0);
  const minimumRandomizedPerScope = randomizedCounts.length ? Math.min(...randomizedCounts) : null;
  const mutationTotal = finiteNonNegative(evidence.mutationTests.total);
  const mutationDetected = finiteNonNegative(evidence.mutationTests.detected);
  const oracleCompared = finiteNonNegative(evidence.independentOracle.comparedCount);
  const oracleAgreement = finiteNonNegative(evidence.independentOracle.agreementCount);
  const requiredMutationTypes = Array.from(new Set((evidence.mutationTests.requiredTypes ?? []).map(clean).filter(Boolean)));
  const reasonCodes: string[] = [];

  if (!validBinding(evidence.binding)) reasonCodes.push('formal_release_binding_incomplete');
  if (expectedScopeIds.length === 0) reasonCodes.push('formal_release_scope_contract_missing');
  if (!evidence.commonGates.syllabusScopeBound) reasonCodes.push('formal_release_syllabus_scope_not_bound');
  if (!evidence.commonGates.questionPlanValid) reasonCodes.push('formal_release_question_plan_invalid');
  if (!evidence.commonGates.candidatePlanAdherent) reasonCodes.push('formal_release_candidate_plan_adherence_failed');
  if (!evidence.commonGates.deterministicValidatorBlockingFree) reasonCodes.push('formal_release_validator_blocking_error');
  if (!evidence.commonGates.semanticDiversityGatePassed) reasonCodes.push('formal_release_semantic_diversity_failed');
  if (!evidence.commonGates.publicationScopeIsCandidateExactNotFamilyWide) reasonCodes.push('formal_release_family_wide_promotion_forbidden');

  const generatorSourceIsolationSatisfied = evidence.generatorSourceIsolation.policyVersion
    === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION
    && evidence.generatorSourceIsolation.status === 'enforced_structural_projection'
    && evidence.generatorSourceIsolation.boundary === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY
    && evidence.generatorSourceIsolation.allowedInput === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT
    && evidence.generatorSourceIsolation.originalQuestionContentOmitted
    && evidence.generatorSourceIsolation.reversibleSourceFieldsOmitted
    && evidence.generatorSourceIsolation.developerUnseenRequired === false
    && evidence.generatorSourceIsolation.officialHoldoutRequiredForGeneratorIsolation === false
    && evidence.generatorSourceIsolation.sourceLinkageIdentifiersOmitted
    && evidence.generatorSourceIsolation.profileAggregationPolicyVersion
      === SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION
    && evidence.generatorSourceIsolation.profileMinimumSampleSize
      === SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
    && evidence.generatorSourceIsolation.profileProjectionMode === SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
    && evidence.generatorSourceIsolation.providerProjectionHashRecomputed
    && evidence.generatorSourceIsolation.knownSourceCorpusComparisonPassed
    && finiteNonNegative(evidence.generatorSourceIsolation.knownSourceLeakMatchCount) === 0
    && evidence.generatorSourceIsolation.providerProjectionSha256Present
    && /^[a-f0-9]{64}$/.test(clean(evidence.generatorSourceIsolation.providerProjectionSha256));
  if (!generatorSourceIsolationSatisfied) reasonCodes.push('formal_release_generator_source_isolation_missing_or_failed');
  const sourceCorpusLayerValid = (
    layer: SubjectPracticeSourceCorpusReleaseEvidence,
    expectedLayer: 'profile_asset_admission' | 'generator_projection' | 'candidate_output',
    expectedTargetContentSha256: string
  ) => layer.status === 'pass'
    && layer.trustedAttestation
    && layer.targetContentBound
    && Boolean(clean(layer.sourceCorpusSnapshotId))
    && /^[a-f0-9]{64}$/.test(clean(layer.targetContentSha256))
    && layer.targetContentSha256 === expectedTargetContentSha256
    && /^[a-f0-9]{64}$/.test(clean(layer.sourceCorpusSnapshotSha256))
    && layer.corpusCoverageStatus === 'all_system_known_source_exam_reference'
    && layer.corpusBuilderVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION
    && layer.scannerPolicyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION
    && layer.normalizationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
    && layer.matchingAlgorithmVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION
    && layer.thresholdVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION
    && finiteNonNegative(layer.matchedCount) === 0
    && subjectPracticeSourceCorpusReleaseQualificationMatches({
      qualification: layer.qualification,
      expectedLayer,
      expectedSubject: clean(evidence.binding.subject).toLowerCase() as 'math' | 'physics' | 'chemistry',
      expectedTargetContentSha256,
      expectedSourceCorpusSnapshotSha256: layer.sourceCorpusSnapshotSha256
    });
  const fullSourceCorpusIsolationSatisfied = evidence.fullSourceCorpusIsolation.currentCorpusSnapshotBound
    && /^[a-f0-9]{64}$/.test(clean(evidence.fullSourceCorpusIsolation.profileAssetContentSha256))
    && sourceCorpusLayerValid(evidence.fullSourceCorpusIsolation.profileAssetAdmission,
      'profile_asset_admission', evidence.fullSourceCorpusIsolation.profileAssetContentSha256)
    && sourceCorpusLayerValid(evidence.fullSourceCorpusIsolation.generatorProjection,
      'generator_projection', evidence.generatorSourceIsolation.providerProjectionSha256)
    && evidence.fullSourceCorpusIsolation.profileAssetAdmission.sourceCorpusSnapshotSha256
      === evidence.fullSourceCorpusIsolation.generatorProjection.sourceCorpusSnapshotSha256;
  if (!fullSourceCorpusIsolationSatisfied) reasonCodes.push('formal_release_full_source_corpus_scan_missing_or_failed');
  const candidateOutputCorpusNoveltySatisfied = evidence.candidateOutputCorpusNovelty.currentCorpusSnapshotBound
    && /^[a-f0-9]{64}$/.test(clean(evidence.candidateOutputCorpusNovelty.candidateContentSha256))
    && sourceCorpusLayerValid(evidence.candidateOutputCorpusNovelty.candidateOutput,
      'candidate_output', evidence.candidateOutputCorpusNovelty.candidateContentSha256)
    && evidence.candidateOutputCorpusNovelty.candidateOutput.sourceCorpusSnapshotSha256
      === evidence.fullSourceCorpusIsolation.generatorProjection.sourceCorpusSnapshotSha256;
  if (!candidateOutputCorpusNoveltySatisfied) {
    reasonCodes.push('formal_release_candidate_output_source_similarity_scan_missing_or_failed');
  }

  if (evidence.candidateVerification.evidenceBoundary !== 'prompt_and_visible_options_only') reasonCodes.push('formal_release_answer_boundary_not_independent');
  if (!evidence.candidateVerification.allVisibleOptionsParsed) reasonCodes.push('formal_release_visible_options_not_totally_parsed');
  if (!evidence.candidateVerification.exactlyOneTrueOption) reasonCodes.push('formal_release_unique_true_option_missing');
  if (!evidence.candidateVerification.agreesWithGenerator) reasonCodes.push('formal_release_generator_disagreement');
  if (!evidence.candidateVerification.exactScopeMatched) reasonCodes.push('formal_release_exact_scope_mismatch');
  if (!evidence.candidateVerification.unsupportedInputsAbstain) reasonCodes.push('formal_release_unsupported_input_fail_open');

  if (evidence.explanationVerification.status !== 'verified'
    || !clean(evidence.explanationVerification.implementationId)
    || !evidence.explanationVerification.recomputedWithoutGeneratorExplanation
    || !evidence.explanationVerification.formulaInputsUnitsAndConclusionChecked
    || finiteNonNegative(evidence.explanationVerification.verifiedCount) === 0
    || finiteNonNegative(evidence.explanationVerification.mismatchCount) > 0) {
    reasonCodes.push('formal_release_explanation_verification_missing_or_failed');
  }
  if (evidence.independentOracle.status !== 'verified'
    || !clean(evidence.independentOracle.implementationId)
    || evidence.independentOracle.sharesGeneratorCoreFunctions
    || evidence.independentOracle.sharesSolverCoreFunctions
    || oracleCompared === 0
    || oracleAgreement !== oracleCompared
    || finiteNonNegative(evidence.independentOracle.falseAccepts) > thresholds.maximumFalseAccepts) {
    reasonCodes.push('formal_release_independent_oracle_missing_or_failed');
  }
  if (!evidence.randomizedPropertyTests.generatedAfterSolverFreeze
    || !evidence.randomizedPropertyTests.seedCommitmentPresent
    || expectedScopeIds.length === 0
    || randomizedCounts.some((count) => count < thresholds.minimumRandomizedCasesPerScope)
    || finiteNonNegative(evidence.randomizedPropertyTests.failedCount) > 0) {
    reasonCodes.push('formal_release_randomized_property_threshold_not_met');
  }
  if (requiredMutationTypes.length === 0
    || requiredMutationTypes.some((type) => finiteNonNegative(evidence.mutationTests.perTypeCounts?.[type]) < thresholds.minimumMutationCasesPerType)
    || mutationTotal < thresholds.minimumMutationCases
    || mutationDetected !== mutationTotal
    || finiteNonNegative(evidence.mutationTests.falseAccepts) > thresholds.maximumFalseAccepts) {
    reasonCodes.push('formal_release_mutation_threshold_not_met');
  }
  const blindCounts = expectedScopeIds.map((scopeId) => finiteNonNegative(evidence.blindHumanAudit.perScopeCounts?.[scopeId]));
  const blindHumanAuditSatisfied = evidence.blindHumanAudit.answerKeyHiddenUntilLocked
    && evidence.blindHumanAudit.validEvidence
    && blindCounts.length > 0
    && blindCounts.every((count) => count >= thresholds.minimumBlindAuditPerScope)
    && validUnitRate(evidence.blindHumanAudit.strictQualifiedRate)
    && evidence.blindHumanAudit.strictQualifiedRate >= thresholds.minimumBlindStrictQualifiedRate;
  const productionShadowCounts = expectedScopeIds
    .map((scopeId) => finiteNonNegative(evidence.productionShadow.perScopeCounts?.[scopeId]));
  if (!evidence.productionShadow.publicationSuppressed
    || productionShadowCounts.length === 0
    || productionShadowCounts.some((count) => count < thresholds.minimumProductionShadowCases)
    || finiteNonNegative(evidence.productionShadow.observedCount) < productionShadowCounts.reduce((sum, count) => sum + count, 0)
    || finiteNonNegative(evidence.productionShadow.falseAccepts) > thresholds.maximumFalseAccepts
    || finiteNonNegative(evidence.productionShadow.scopeLeakageCount) > thresholds.maximumScopeLeakage
    || finiteNonNegative(evidence.productionShadow.unexpectedConflictCount) > thresholds.maximumUnexpectedConflicts) {
    reasonCodes.push('formal_release_production_shadow_threshold_not_met');
  }

  const qualified = reasonCodes.length === 0;
  return {
    policyVersion: SUBJECT_PRACTICE_SCOPE_RELEASE_PATH_POLICY_VERSION,
    qualificationPath: 'deterministic_formal',
    status: qualified ? 'formal_qualified' : 'not_qualified',
    qualified,
    reasonCodes,
    expectedScopeIds,
    metrics: {
      randomizedCaseCount,
      minimumRandomizedPerScope,
      mutationDetectionRate: rate(mutationDetected, mutationTotal),
      oracleAgreementRate: rate(oracleAgreement, oracleCompared),
      explanationMismatchCount: finiteNonNegative(evidence.explanationVerification.mismatchCount),
      blindStrictQualifiedRate: evidence.blindHumanAudit.strictQualifiedRate,
      productionShadowCount: finiteNonNegative(evidence.productionShadow.observedCount),
      minimumProductionShadowPerScope: productionShadowCounts.length ? Math.min(...productionShadowCounts) : null,
      officialHoldoutPresent: evidence.officialHoldout?.present === true,
      generatorSourceIsolationSatisfied,
      fullSourceCorpusIsolationSatisfied,
      candidateOutputCorpusNoveltySatisfied
    },
    confidenceEnhancements: {
      blindHumanAudit: {
        requiredForQualification: false,
        status: blindHumanAuditSatisfied ? 'satisfied' : 'not_satisfied',
        reasonCode: blindHumanAuditSatisfied ? null : 'confidence_enhancement_blind_human_audit_threshold_not_met'
      },
      officialHoldout: {
        requiredForQualification: false,
        status: evidence.officialHoldout?.present === true ? 'present' : 'not_present'
      }
    },
    thresholds,
    productionGateImpact: 'none_shadow_policy_only'
  };
}
