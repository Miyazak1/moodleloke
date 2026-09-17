import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
} from './subject-practice-scenario-blueprint-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_PROMOTION_POLICY_VERSION =
  'subject-practice-scenario-blueprint-promotion-evidence-v2-creative-specificity';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function finiteRate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function creativeSpecificityFor(blueprint: RecordValue | null) {
  const creativeBlueprint = recordFrom(blueprint?.creativeBlueprint);
  const questionPurpose = clean(creativeBlueprint?.questionPurpose);
  const instructionLikePurpose = /generic (?:laboratory )?observations|calculated target|without naming/.test(
    questionPurpose
  );
  const purposeDistinctFromAction = Boolean(questionPurpose)
    && questionPurpose !== clean(creativeBlueprint?.scenarioAction);
  return {
    questionPurposePresent: Boolean(questionPurpose),
    instructionLikePurpose,
    purposeDistinctFromAction,
    passed: Boolean(questionPurpose) && !instructionLikePurpose && purposeDistinctFromAction
  };
}

export function subjectPracticeScenarioBlueprintPromotionEvidenceFor(input: {
  blueprint?: unknown;
  novelty?: unknown;
  qualification?: unknown;
  stability?: unknown;
}) {
  const blueprint = recordFrom(input.blueprint);
  const novelty = recordFrom(input.novelty);
  const qualification = recordFrom(input.qualification);
  const stability = recordFrom(input.stability);
  const blockers: string[] = [];
  if (clean(blueprint?.policyVersion) !== SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
    || clean(blueprint?.status) !== 'provisional_candidate'
    || !clean(blueprint?.blueprintDigest)
    || !clean(blueprint?.blueprintFingerprint)
    || !clean(blueprint?.renameInvariantFingerprint)) {
    blockers.push('promotion_blueprint_provisional_identity_invalid');
  }
  const creativeSpecificity = creativeSpecificityFor(blueprint);
  if (!creativeSpecificity.passed) blockers.push('promotion_blueprint_creative_specificity_missing');
  if (clean(novelty?.status) !== 'novel_candidate'
    || novelty?.historyInputAccepted !== true
    || novelty?.exactDuplicate !== false
    || novelty?.renameOnly !== false) {
    blockers.push('promotion_blueprint_novelty_not_clear');
  }
  const requiredQualificationStrings = [
    'observationBatchId', 'manifestPolicyVersion', 'productionProfileBindingDigest',
    'generatorVersion', 'solverVersion', 'oracleVersion', 'qualificationEvidenceDigest'
  ];
  if (!qualification || requiredQualificationStrings.some((key) => !clean(qualification[key]))) {
    blockers.push('promotion_qualification_identity_incomplete');
  }
  if (qualification?.publicationSuppressed !== true) blockers.push('promotion_publication_suppression_required');
  if (qualification?.hmacAttested !== true) blockers.push('promotion_hmac_attestation_required');
  if (qualification?.batchQualified !== true) blockers.push('promotion_sealed_batch_qualification_required');
  const candidateYieldRate = finiteRate(qualification?.candidateYieldRate);
  const publishableRate = finiteRate(qualification?.publishableRate);
  if (candidateYieldRate === null || candidateYieldRate < 0.95) blockers.push('promotion_candidate_yield_threshold_not_met');
  if (publishableRate === null || publishableRate < 0.95) blockers.push('promotion_publishable_threshold_not_met');
  const leakageFailureCount = nonNegativeInteger(qualification?.leakageFailureCount);
  const scopeBindingFailureCount = nonNegativeInteger(qualification?.scopeBindingFailureCount);
  const unexpectedFailureCount = nonNegativeInteger(qualification?.unexpectedFailureCount);
  if (leakageFailureCount === null || leakageFailureCount !== 0) blockers.push('promotion_leakage_failure_present');
  if (scopeBindingFailureCount === null || scopeBindingFailureCount !== 0) blockers.push('promotion_scope_binding_failure_present');
  if (unexpectedFailureCount === null || unexpectedFailureCount !== 0) blockers.push('promotion_unexpected_failure_present');
  const seedCommitments = Array.isArray(stability?.independentSeedCommitments)
    ? stability.independentSeedCommitments.map(clean).filter(Boolean)
    : [];
  const distinctSeedCommitments = [...new Set(seedCommitments)];
  if (distinctSeedCommitments.length < 2) blockers.push('promotion_multiple_independent_seed_commitments_required');
  if (stability?.solverOracleStableAcrossSeeds !== true) blockers.push('promotion_solver_oracle_seed_stability_required');
  if (stability?.contextNecessityStableAcrossSeeds !== true) blockers.push('promotion_context_necessity_seed_stability_required');
  if (stability?.renameOnlyClearAcrossSeeds !== true) blockers.push('promotion_rename_only_seed_stability_required');
  const boundEvidence = {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_PROMOTION_POLICY_VERSION,
    blueprintDigest: clean(blueprint?.blueprintDigest),
    blueprintFingerprint: clean(blueprint?.blueprintFingerprint),
    renameInvariantFingerprint: clean(blueprint?.renameInvariantFingerprint),
    creativeSpecificity,
    observationBatchId: clean(qualification?.observationBatchId),
    manifestPolicyVersion: clean(qualification?.manifestPolicyVersion),
    productionProfileBindingDigest: clean(qualification?.productionProfileBindingDigest),
    generatorVersion: clean(qualification?.generatorVersion),
    solverVersion: clean(qualification?.solverVersion),
    oracleVersion: clean(qualification?.oracleVersion),
    qualificationEvidenceDigest: clean(qualification?.qualificationEvidenceDigest),
    candidateYieldRate,
    publishableRate,
    leakageFailureCount,
    scopeBindingFailureCount,
    unexpectedFailureCount,
    distinctSeedCommitments,
    solverOracleStableAcrossSeeds: stability?.solverOracleStableAcrossSeeds === true,
    contextNecessityStableAcrossSeeds: stability?.contextNecessityStableAcrossSeeds === true,
    renameOnlyClearAcrossSeeds: stability?.renameOnlyClearAcrossSeeds === true
  };
  const complete = blockers.length === 0;
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_PROMOTION_POLICY_VERSION,
    status: complete ? 'ready_for_promotion_threshold_calibration' : 'promotion_evidence_incomplete',
    blockers: [...new Set(blockers)],
    promotionEvidenceDigest: digestFor(boundEvidence),
    boundEvidence,
    multipleIndependentSeedFloor: 2,
    performancePromotionThresholdsFrozen: false,
    automaticStablePromotionAllowed: false,
    stableScenarioFamilyCreated: false,
    humanReviewRequired: false,
    manualApprovalCanOverrideEvidence: false,
    modelMayApproveScientificCorrectness: false,
    officialQuestionContentRequired: false,
    creativeSpecificityRequired: true,
    publicationAuthorized: false,
    productionGateImpact: 'none_shadow_only'
  };
}

export { creativeSpecificityFor };
