export const SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION =
  'subject-practice-dynamic-scenario-qualification-v1-frozen-holdout';

export const SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID =
  'local-shadow-1ac41c6df96cab5f5394';

export const SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_THRESHOLDS = Object.freeze({
  minimumCaseCount: 48,
  minimumScenarioFamilyCoverageCount: 12,
  minimumScenarioFingerprintCoverageCount: 12,
  maximumSingleScenarioFamilyShare: 0.125,
  maximumScenarioFingerprintDuplicateRate: 0.75,
  maximumRenameOnlyStructureRate: 0,
  maximumDecorativeBackgroundRate: 0,
  maximumScenarioConsistencyFailureRate: 0
});

type Metrics = Record<string, unknown>;

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function subjectPracticeDynamicScenarioQualificationDecision(input: {
  batchId?: unknown;
  metrics?: unknown;
}) {
  const metrics = input.metrics && typeof input.metrics === 'object' && !Array.isArray(input.metrics)
    ? input.metrics as Metrics
    : {};
  const thresholds = SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_THRESHOLDS;
  const expectedCount = finite(metrics.expectedCount);
  const observedEvidenceCount = finite(metrics.observedEvidenceCount);
  const applicableScenarioCount = finite(metrics.applicableScenarioCount);
  const familyCoverage = finite(metrics.scenarioFamilyCoverageCount);
  const fingerprintCoverage = finite(metrics.scenarioFingerprintCoverageCount);
  const maximumFamilyShare = finite(metrics.singleScenarioFamilyMaximumShare);
  const duplicateRate = finite(metrics.scenarioFingerprintDuplicateRate);
  const renameOnlyRate = finite(metrics.renameOnlyStructureRate);
  const decorativeRate = finite(metrics.decorativeBackgroundRate);
  const inconsistencyRate = finite(metrics.scenarioConsistencyFailureRate);
  const reasons: string[] = [];
  if (String(input.batchId ?? '').trim() === SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID) {
    reasons.push('dynamic_scenario_holdout_batch_required');
  }
  if (expectedCount === null || expectedCount < thresholds.minimumCaseCount) {
    reasons.push('dynamic_scenario_case_count_below_frozen_minimum');
  }
  if (metrics.completeEvidenceCoverage !== true
    || observedEvidenceCount !== expectedCount
    || applicableScenarioCount !== expectedCount) {
    reasons.push('dynamic_scenario_complete_applicable_evidence_required');
  }
  if (familyCoverage === null || familyCoverage < thresholds.minimumScenarioFamilyCoverageCount) {
    reasons.push('dynamic_scenario_family_coverage_below_frozen_minimum');
  }
  if (fingerprintCoverage === null || fingerprintCoverage < thresholds.minimumScenarioFingerprintCoverageCount) {
    reasons.push('dynamic_scenario_fingerprint_coverage_below_frozen_minimum');
  }
  if (maximumFamilyShare === null || maximumFamilyShare > thresholds.maximumSingleScenarioFamilyShare) {
    reasons.push('dynamic_scenario_single_family_share_above_frozen_maximum');
  }
  if (duplicateRate === null || duplicateRate > thresholds.maximumScenarioFingerprintDuplicateRate) {
    reasons.push('dynamic_scenario_fingerprint_duplicate_rate_above_frozen_maximum');
  }
  if (renameOnlyRate === null || renameOnlyRate > thresholds.maximumRenameOnlyStructureRate) {
    reasons.push('dynamic_scenario_rename_only_rate_above_frozen_maximum');
  }
  if (decorativeRate === null || decorativeRate > thresholds.maximumDecorativeBackgroundRate) {
    reasons.push('dynamic_scenario_decorative_background_rate_above_frozen_maximum');
  }
  if (inconsistencyRate === null || inconsistencyRate > thresholds.maximumScenarioConsistencyFailureRate) {
    reasons.push('dynamic_scenario_consistency_failure_rate_above_frozen_maximum');
  }
  return {
    policyVersion: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
    stage: 'frozen_holdout_qualification',
    status: reasons.length ? 'not_qualified' : 'qualified',
    thresholds,
    calibrationBatchId: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
    evaluatedBatchId: String(input.batchId ?? '').trim() || null,
    reasons: [...new Set(reasons)],
    releaseQualification: reasons.length === 0,
    studentPublicationAuthorized: false
  };
}
