const { execFileSync } = require('node:child_process');
const path = require('node:path');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveIntArg(name, fallback, min, max) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function runNodeJson(args, label) {
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
}

function runNodeJsonAllowFailure(args, label) {
  try {
    return runNodeJson(args, label);
  } catch (error) {
    const stdout = cleanText(error?.stdout);
    if (stdout) {
      try {
        return JSON.parse(stdout);
      } catch {}
    }
    throw error;
  }
}

function phaseByName(readiness, name) {
  return arrayFrom(recordFrom(readiness).phases).find((phase) => cleanText(phase.phase) === name) ?? null;
}

function subjectReadiness(report, subject) {
  return arrayFrom(recordFrom(report).subjects).find((item) => cleanText(item.subject) === subject) ?? null;
}

function acceptedQualityAudit(review) {
  return new Set([
    'true_positive_repeated_shell',
    'true_positive_overrepresented_family',
    'acceptable_to_guarded_smoke'
  ]).has(cleanText(recordFrom(review).decision));
}

function assertCondition(failures, condition, code, detail) {
  if (!condition) failures.push({ code, detail });
}

function main() {
  const sample = positiveIntArg('sample', 40, 1, 50);
  const days = positiveIntArg('days', 30, 1, 60);
  const chemistryDays = positiveIntArg('chemistry-days', 1, 1, 60);
  const chemistryRun = cleanText(argValue('chemistry-run', 'latest'));
  const mathRun = cleanText(argValue('math-run', 'latest'));
  const mathObservationCell = positiveIntArg('math-observation-cell', 13, 1, 1000000);
  const qualityAuditLedger = cleanText(argValue('quality-audit-ledger', argValue('manual-review-ledger', '')));
  const json = hasFlag('json');

  const readinessArgs = [
    path.resolve(__dirname, 'csca-subject-practice-diversity-readiness.cjs'),
    `--sample=${sample}`,
    `--days=${days}`,
    `--chemistry-days=${chemistryDays}`
  ];
  if (chemistryRun) readinessArgs.push(`--chemistry-run=${chemistryRun}`);
  if (qualityAuditLedger) readinessArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const readiness = runNodeJson(readinessArgs, 'three-subject diversity readiness');

  const auditArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--subject=math',
    `--sample=${sample}`,
    `--days=${days}`,
    '--json'
  ];
  if (mathRun) auditArgs.push(`--run=${mathRun}`);
  if (qualityAuditLedger) auditArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const mathAudit = runNodeJson(auditArgs, 'math production audit');

  const mathPostfixEfficiency = /^\d+$/.test(mathRun)
    ? runNodeJsonAllowFailure([
      path.resolve(__dirname, 'csca-subject-practice-math-postfix-efficiency-gate.cjs'),
      `--run=${mathRun}`,
      `--cell=${mathObservationCell}`,
      '--hours=72',
      '--json'
    ], 'math postfix efficiency gate')
    : null;

  const failures = [];
  const chemistry = subjectReadiness(readiness, 'chemistry');
  const math = subjectReadiness(readiness, 'math');
  const physics = subjectReadiness(readiness, 'physics');
  const mathFamilyVisibility = phaseByName(math, 'phase_1_family_visibility');
  const mathSoftCap = phaseByName(math, 'phase_2_math_soft_cap');
  const mathCandidateReplay = phaseByName(math, 'phase_2_math_candidate_replay_guardrail');
  const mathScheduler = phaseByName(math, 'phase_5_math_scheduler_hint');
  const mathSchedulerAdherence = phaseByName(math, 'phase_5_math_scheduler_hint_adherence');
  const mathNearDuplicate = phaseByName(math, 'phase_6_near_duplicate_fallback');
  const studentBoundary = phaseByName(math, 'student_consumable_current_policy_boundary');
  const chemistryRegression = phaseByName(chemistry, 'phase_3_chemistry_regression_protection');
  const physicsVisibility = phaseByName(physics, 'phase_4_physics_visibility');
  const physicsDifficultyWatch = phaseByName(physics, 'phase_4_physics_difficulty_watch');
  const recentFormalWindow = recordFrom(recordFrom(mathAudit).recentFormalWindow);
  const mathSoftCapDryRun = recordFrom(recentFormalWindow.mathSoftCapDryRun);
  const calibration = recordFrom(mathSoftCapDryRun.calibration);
  const incrementalSamples = arrayFrom(calibration.incrementalSamples);
  const storedObservationSummary = recordFrom(recentFormalWindow.storedDiversityObservationSummary);
  const candidateObservationReplay = recordFrom(recentFormalWindow.candidateDiversityObservationReplay);
  const schedulerHintAdherence = recordFrom(recentFormalWindow.schedulerHintAdherence);

  assertCondition(failures, cleanText(readiness.mode) === 'audit_only', 'readiness_not_audit_only', readiness.mode);
  assertCondition(failures, cleanText(readiness.productionImpact) === 'none_audit_only', 'readiness_has_production_impact', readiness.productionImpact);
  assertCondition(failures, cleanText(readiness.providerFailurePolicy) === 'excluded_from_diversity_quality_memory', 'provider_failure_policy_not_excluded', readiness.providerFailurePolicy);
  assertCondition(failures, ['ready_for_next_phase', 'calibrated_with_guardrails'].includes(cleanText(readiness.status)), 'three_subject_readiness_not_ready', readiness.status);
  assertCondition(failures, cleanText(recordFrom(chemistry).status) === 'ready_for_next_phase', 'chemistry_not_ready', recordFrom(chemistry).status);
  assertCondition(failures, cleanText(recordFrom(chemistryRegression).status) === 'protected', 'chemistry_regression_not_protected', recordFrom(chemistryRegression).status);
  assertCondition(failures, ['ready_for_next_phase', 'calibrated_with_guardrails'].includes(cleanText(recordFrom(physics).status)), 'physics_not_ready', recordFrom(physics).status);
  assertCondition(failures, ['ready', 'needs_guarded_observation_window'].includes(cleanText(recordFrom(physicsVisibility).status)), 'physics_visibility_not_ready', recordFrom(physicsVisibility).status);
  if (physicsDifficultyWatch) {
    assertCondition(failures, ['clear', 'quality_sampling_required', 'quality_sampling_in_progress', 'quality_sampling_complete_with_findings', 'quality_sampling_complete_no_confirmed_issue'].includes(cleanText(recordFrom(physicsDifficultyWatch).status)), 'physics_difficulty_watch_not_audit_only', recordFrom(physicsDifficultyWatch).status);
  }
  assertCondition(failures, ['ready_for_next_phase', 'calibrated_with_guardrails'].includes(cleanText(recordFrom(math).status)), 'math_not_ready', recordFrom(math).status);
  const mathFamilyVisibilityAccepted = cleanText(recordFrom(mathFamilyVisibility).status) === 'ready'
    || (cleanText(recordFrom(mathFamilyVisibility).status) === 'insufficient_window'
      && cleanText(mathPostfixEfficiency?.status) === 'passed');
  assertCondition(failures, mathFamilyVisibilityAccepted, 'math_family_visibility_not_ready', {
    visibilityStatus: recordFrom(mathFamilyVisibility).status,
    postfixEfficiencyStatus: mathPostfixEfficiency?.status ?? null,
    observationCellId: mathObservationCell
  });
  assertCondition(failures, cleanText(recordFrom(mathSoftCap).status) === 'eligible_for_guarded_default_off_smoke', 'math_soft_cap_not_guarded_smoke_eligible', recordFrom(mathSoftCap).status);
  assertCondition(failures, ['ready_for_guarded_flag_smoke', 'observe_before_flag_enable'].includes(cleanText(recordFrom(mathCandidateReplay).status)), 'math_candidate_replay_guardrail_not_ready', recordFrom(mathCandidateReplay).status);
  assertCondition(failures, cleanText(recordFrom(mathScheduler).status) === 'audit_ready', 'math_scheduler_not_audit_ready', recordFrom(mathScheduler).status);
  assertCondition(failures, ['pending_observation', 'observing', 'needs_prompt_tuning'].includes(cleanText(recordFrom(mathSchedulerAdherence).status)), 'math_scheduler_adherence_not_observable', recordFrom(mathSchedulerAdherence).status);
  assertCondition(failures, cleanText(recordFrom(mathNearDuplicate).status) === 'audit_ready', 'math_near_duplicate_not_audit_ready', recordFrom(mathNearDuplicate).status);
  assertCondition(failures, !['needs_attention', 'missing_calibration', 'needs_classifier_work'].includes(cleanText(recordFrom(studentBoundary).status)), 'student_boundary_not_protected', recordFrom(studentBoundary).status);

  assertCondition(failures, cleanText(mathSoftCapDryRun.mode) === 'audit_only', 'math_soft_cap_dry_run_not_audit_only', mathSoftCapDryRun.mode);
  assertCondition(failures, calibration.productionFlagEnabled === false, 'math_soft_cap_flag_enabled', calibration.productionFlagEnabled);
  assertCondition(failures, cleanText(calibration.featureFlag) === 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED', 'unexpected_feature_flag', calibration.featureFlag);
  assertCondition(failures, cleanText(calibration.providerFailurePolicy) === 'excluded_provider_and_schema_failures_not_counted_as_family_quality', 'calibration_provider_failure_policy_not_excluded', calibration.providerFailurePolicy);
  assertCondition(failures, cleanText(calibration.studentConsumableScope) === 'formal_published_subject_practice_window_only', 'calibration_student_scope_changed', calibration.studentConsumableScope);
  assertCondition(failures, cleanText(calibration.productionDecisionScope) === 'task_family_recent_window_cap_only', 'calibration_decision_scope_changed', calibration.productionDecisionScope);
  assertCondition(failures, cleanText(storedObservationSummary.mode) === 'audit_only', 'stored_observation_summary_not_audit_only', storedObservationSummary.mode);
  assertCondition(failures, cleanText(storedObservationSummary.productionImpact) === 'none_audit_only_for_reporting', 'stored_observation_summary_has_production_impact', storedObservationSummary.productionImpact);
  assertCondition(failures, cleanText(storedObservationSummary.providerFailurePolicy) === 'excluded_provider_and_schema_failures_not_counted_as_family_quality', 'stored_observation_provider_failure_policy_changed', storedObservationSummary.providerFailurePolicy);
  assertCondition(failures, Number(storedObservationSummary.featureFlagEnabledCount) === 0, 'stored_observation_contains_enabled_flag_samples', storedObservationSummary.featureFlagEnabledCount);
  assertCondition(failures, cleanText(candidateObservationReplay.mode) === 'audit_only', 'candidate_observation_replay_not_audit_only', candidateObservationReplay.mode);
  assertCondition(failures, cleanText(candidateObservationReplay.productionImpact) === 'none_audit_only', 'candidate_observation_replay_has_production_impact', candidateObservationReplay.productionImpact);
  assertCondition(failures, cleanText(candidateObservationReplay.providerFailurePolicy) === 'excluded_provider_and_schema_failures_not_counted_as_family_quality', 'candidate_observation_provider_failure_policy_changed', candidateObservationReplay.providerFailurePolicy);
  assertCondition(failures, candidateObservationReplay.featureFlagEnabled === false, 'candidate_observation_replay_flag_enabled', candidateObservationReplay.featureFlagEnabled);
  assertCondition(failures, Number(candidateObservationReplay.currentFlagRegenerateCount) === 0, 'candidate_observation_replay_would_block_with_current_flag', candidateObservationReplay.currentFlagRegenerateCount);
  assertCondition(failures, cleanText(schedulerHintAdherence.mode) === 'audit_only', 'scheduler_hint_adherence_not_audit_only', schedulerHintAdherence.mode);
  assertCondition(failures, cleanText(schedulerHintAdherence.productionImpact) === 'none_audit_only', 'scheduler_hint_adherence_has_production_impact', schedulerHintAdherence.productionImpact);
  assertCondition(failures, cleanText(schedulerHintAdherence.providerFailurePolicy) === 'provider_failures_do_not_emit_candidate_scheduler_adherence', 'scheduler_hint_adherence_provider_failure_policy_changed', schedulerHintAdherence.providerFailurePolicy);
  assertCondition(failures, Number(calibration.incrementalUnreviewedCount) === 0, 'incremental_samples_unreviewed', calibration.incrementalUnreviewedCount);
  assertCondition(failures, Number(calibration.incrementalReviewedRejectedCount) === 0, 'quality_audit_rejected_incremental_sample', calibration.incrementalReviewedRejectedCount);
  assertCondition(failures, arrayFrom(calibration.blockerReasons).length === 0, 'calibration_blockers_present', calibration.blockerReasons);
  assertCondition(failures, ['eligible_for_guarded_default_off_flag_smoke_after_quality_audit', 'eligible_for_limited_default_off_flag_smoke'].includes(cleanText(calibration.recommendationCode)), 'calibration_not_smoke_eligible', calibration.recommendationCode);
  assertCondition(
    failures,
    incrementalSamples.every((sampleItem) => acceptedQualityAudit(recordFrom(sampleItem).qualityAudit)),
    'incremental_sample_missing_accepted_quality_audit',
    incrementalSamples.map((sampleItem) => ({ id: sampleItem.id, qualityAudit: recordFrom(sampleItem).qualityAudit }))
  );

  const report = {
    mode: 'read_only_smoke',
    subject: 'math',
    status: failures.length ? 'failed' : 'passed',
    productionImpact: 'none_audit_only',
    featureFlag: 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED',
    productionFlagEnabled: calibration.productionFlagEnabled === true,
    providerFailurePolicy: 'excluded_from_diversity_quality_memory',
    chemistryRun: chemistryRun || null,
    evidence: {
      readinessStatus: readiness.status,
      mathSoftCapStatus: recordFrom(mathSoftCap).status,
      mathCandidateReplayStatus: recordFrom(mathCandidateReplay).status,
      mathSchedulerStatus: recordFrom(mathScheduler).status,
      mathSchedulerAdherenceStatus: recordFrom(mathSchedulerAdherence).status,
      mathNearDuplicateStatus: recordFrom(mathNearDuplicate).status,
      studentBoundaryStatus: recordFrom(studentBoundary).status,
      chemistryRegressionStatus: recordFrom(chemistryRegression).status,
      physicsVisibilityStatus: recordFrom(physicsVisibility).status,
      mathPostfixEfficiencyStatus: mathPostfixEfficiency?.status ?? null,
      mathPostfixEfficiencyScope: mathPostfixEfficiency?.scope ?? null,
      mathPostfixEfficiencyYields: mathPostfixEfficiency?.yields ?? null,
      physicsDifficultyWatchStatus: recordFrom(physicsDifficultyWatch).status ?? null,
      physicsDifficultyFindingCount: Number(recordFrom(recordFrom(physicsDifficultyWatch).evidence).difficultyFindingCount) || 0,
      incrementalCount: Number(calibration.incrementalCount) || 0,
      incrementalReviewedCount: Number(calibration.incrementalReviewedCount) || 0,
      incrementalUnreviewedCount: Number(calibration.incrementalUnreviewedCount) || 0,
      incrementalNearDuplicateSupportCount: Number(calibration.incrementalNearDuplicateSupportCount) || 0,
      recommendationCode: calibration.recommendationCode,
      storedObservationCount: Number(storedObservationSummary.observedCount) || 0,
      storedObservationObserveOnlyCount: Number(storedObservationSummary.observeOnlyCount) || 0,
      storedObservationWouldRegenerateIfFlagEnabledCount: Number(storedObservationSummary.wouldRegenerateIfFlagEnabledCount) || 0,
      candidateReplayCandidateCount: Number(candidateObservationReplay.candidateCount) || 0,
      candidateReplayEvaluatedCount: Number(candidateObservationReplay.evaluatedCount) || 0,
      candidateReplayWouldRegenerateIfFlagEnabledCount: Number(candidateObservationReplay.wouldRegenerateIfFlagEnabledCount) || 0,
      candidateReplayCurrentFlagRegenerateCount: Number(candidateObservationReplay.currentFlagRegenerateCount) || 0,
      schedulerCurrentPolicyVersion: cleanText(schedulerHintAdherence.currentSchedulerPolicyVersion) || null,
      schedulerTotalHintedCandidateCount: Number(schedulerHintAdherence.totalHintedCandidateCount) || Number(schedulerHintAdherence.hintedCandidateCount) || 0,
      schedulerHintedCandidateCount: Number(schedulerHintAdherence.hintedCandidateCount) || 0,
      schedulerLegacyHintedCandidateCount: Number(schedulerHintAdherence.legacyHintedCandidateCount) || 0,
      schedulerPreferredMatchRatio: Number(schedulerHintAdherence.preferredMatchRatio) || 0,
      schedulerAvoidedFamilyHitRatio: Number(schedulerHintAdherence.avoidedFamilyHitRatio) || 0,
      qualityAuditLedger: calibration.qualityAuditLedger ?? null
    },
    failures
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Math diversity soft-cap guarded smoke: ${report.status}`);
    console.log(`- readiness: ${report.evidence.readinessStatus}`);
    console.log(`- math soft-cap: ${report.evidence.mathSoftCapStatus}, candidateReplay=${report.evidence.mathCandidateReplayStatus}, flagEnabled=${report.productionFlagEnabled}, recommendation=${report.evidence.recommendationCode}`);
    console.log(`- incremental review: ${report.evidence.incrementalReviewedCount}/${report.evidence.incrementalCount} reviewed, unreviewed=${report.evidence.incrementalUnreviewedCount}, nearDuplicateSupport=${report.evidence.incrementalNearDuplicateSupportCount}`);
    console.log(`- stored observations: observed=${report.evidence.storedObservationCount}, observeOnly=${report.evidence.storedObservationObserveOnlyCount}, wouldRegenerateIfFlagEnabled=${report.evidence.storedObservationWouldRegenerateIfFlagEnabledCount}`);
    console.log(`- candidate replay: candidates=${report.evidence.candidateReplayCandidateCount}, evaluated=${report.evidence.candidateReplayEvaluatedCount}, wouldRegenerateIfFlagEnabled=${report.evidence.candidateReplayWouldRegenerateIfFlagEnabledCount}, currentFlagRegenerate=${report.evidence.candidateReplayCurrentFlagRegenerateCount}`);
    console.log(`- scheduler=${report.evidence.mathSchedulerStatus}, adherence=${report.evidence.mathSchedulerAdherenceStatus}, currentPolicy=${report.evidence.schedulerCurrentPolicyVersion || 'n/a'}, hinted=${report.evidence.schedulerHintedCandidateCount}/${report.evidence.schedulerTotalHintedCandidateCount}, legacy=${report.evidence.schedulerLegacyHintedCandidateCount}, preferredMatchRatio=${report.evidence.schedulerPreferredMatchRatio}, avoidHitRatio=${report.evidence.schedulerAvoidedFamilyHitRatio}, nearDuplicate=${report.evidence.mathNearDuplicateStatus}, studentBoundary=${report.evidence.studentBoundaryStatus}`);
    console.log(`- chemistryRegression=${report.evidence.chemistryRegressionStatus}, physicsVisibility=${report.evidence.physicsVisibilityStatus}, physicsDifficultyWatch=${report.evidence.physicsDifficultyWatchStatus || 'n/a'}(${report.evidence.physicsDifficultyFindingCount})`);
    if (failures.length) {
      console.log('Failures');
      for (const failure of failures) console.log(`- ${failure.code}: ${JSON.stringify(failure.detail)}`);
    }
  }

  if (failures.length) process.exitCode = 1;
}

main();
