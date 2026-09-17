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
  let stdout;
  let childExitStatus = null;
  try {
    stdout = execFileSync(process.execPath, args, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    stdout = String(error?.stdout || error?.output?.[1] || '');
    childExitStatus = Number(error?.status) || 1;
    if (!stdout.trim()) throw error;
  }
  try {
    const report = JSON.parse(stdout);
    if (childExitStatus !== null && report && typeof report === 'object') {
      report.childExitStatus = childExitStatus;
    }
    return report;
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
}

function subjectReadiness(report, subject) {
  return arrayFrom(recordFrom(report).subjects).find((item) => cleanText(item.subject) === subject) ?? null;
}

function phaseByName(readiness, name) {
  return arrayFrom(recordFrom(readiness).phases).find((phase) => cleanText(phase.phase) === name) ?? null;
}

function isolationSubject(report, subject) {
  return arrayFrom(recordFrom(report).bySubject).find((item) => cleanText(item.subject) === subject) ?? null;
}

function poolImpactSubject(report, subject) {
  return arrayFrom(recordFrom(recordFrom(report).poolImpact).bySubject).find((item) => cleanText(item.subject) === subject) ?? null;
}

function pushFailure(failures, condition, code, detail) {
  if (!condition) failures.push({ code, detail });
}

function summarizeReadiness(readiness) {
  return ['chemistry', 'math', 'physics'].map((subject) => {
    const item = subjectReadiness(readiness, subject);
    return {
      subject,
      status: recordFrom(item).status ?? null,
      phases: arrayFrom(recordFrom(item).phases).map((phase) => ({
        phase: phase.phase,
        status: phase.status
      }))
    };
  });
}

function main() {
  const mathRun = cleanText(argValue('math-run', 'latest'));
  const mathObservationCell = positiveIntArg('math-observation-cell', 13, 1, 1000000);
  const json = hasFlag('json');
  const sample = positiveIntArg('sample', 40, 1, 50);
  const days = positiveIntArg('days', 30, 1, 60);
  const chemistryDays = positiveIntArg('chemistry-days', 1, 1, 60);
  const chemistryRun = cleanText(argValue('chemistry-run', 'latest'));
  const limit = positiveIntArg('limit', 500, 1, 1000);
  const qualityAuditLedger = cleanText(argValue('quality-audit-ledger', argValue('manual-review-ledger', '')));

  const ledgerSmokeArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--validate-quality-audit-ledger',
    '--json'
  ];
  if (qualityAuditLedger) ledgerSmokeArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const ledgerSmoke = runNodeJson(ledgerSmokeArgs, 'diversity offline quality-audit ledger smoke');

  const readinessArgs = [
    path.resolve(__dirname, 'csca-subject-practice-diversity-readiness.cjs'),
    `--sample=${sample}`,
    `--days=${days}`,
    `--chemistry-days=${chemistryDays}`
  ];
  if (chemistryRun) readinessArgs.push(`--chemistry-run=${chemistryRun}`);
  if (qualityAuditLedger) readinessArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const readiness = runNodeJson(readinessArgs, 'three-subject diversity readiness');

  const mathSmokeArgs = [
    path.resolve(__dirname, 'csca-subject-practice-math-diversity-soft-cap-smoke.cjs'),
    '--json',
    `--sample=${sample}`,
    `--days=${days}`,
    `--chemistry-days=${chemistryDays}`
  ];
  if (chemistryRun) mathSmokeArgs.push(`--chemistry-run=${chemistryRun}`);
  if (mathRun) mathSmokeArgs.push(`--math-run=${mathRun}`);
  mathSmokeArgs.push(`--math-observation-cell=${mathObservationCell}`);
  if (qualityAuditLedger) mathSmokeArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const mathSmoke = runNodeJson(mathSmokeArgs, 'math diversity soft-cap smoke');

  const isolationArgs = [
    path.resolve(__dirname, 'csca-subject-practice-current-policy-isolation-smoke.cjs'),
    '--json',
    '--pool-impact',
    '--subjects=chemistry,math,physics',
    `--days=${days}`,
    `--limit=${limit}`
  ];
  const isolation = runNodeJson(isolationArgs, 'current-policy isolation smoke');

  const physicsVisualPolicyDryRunArgs = [
    path.resolve(__dirname, 'csca-subject-practice-current-policy-isolation-smoke.cjs'),
    '--json',
    '--pool-impact',
    '--enable-physics-visual-policy',
    '--subjects=physics',
    `--days=${days}`,
    `--limit=${limit}`
  ];
  const physicsVisualPolicyDryRun = runNodeJson(physicsVisualPolicyDryRunArgs, 'physics visual current-policy flag-on dry-run');

  const preflightArgs = [
    path.resolve(__dirname, 'csca-subject-practice-diversity-observation-preflight.cjs'),
    '--json',
    `--sample=${sample}`,
    `--days=${days}`,
    `--chemistry-days=${chemistryDays}`
  ];
  if (chemistryRun) preflightArgs.push(`--chemistry-run=${chemistryRun}`);
  if (qualityAuditLedger) preflightArgs.push(`--quality-audit-ledger=${qualityAuditLedger}`);
  const preflight = runNodeJson(preflightArgs, 'math diversity observation preflight');

  const questionPlanAuditArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--json',
    '--subject=chemistry',
    `--sample=${sample}`,
    `--days=${chemistryDays}`
  ];
  if (chemistryRun) questionPlanAuditArgs.push(`--run=${chemistryRun}`);
  const questionPlanAudit = runNodeJson(questionPlanAuditArgs, 'chemistry question-plan calibration audit');
  const questionPlanApplicability = recordFrom(recordFrom(questionPlanAudit).recentFormalWindow).questionPlanApplicability ?? null;
  const questionPlanCalibration = recordFrom(recordFrom(questionPlanAudit).recentFormalWindow).questionPlanCalibration ?? null;
  const questionPlanExecution = recordFrom(recordFrom(questionPlanAudit).recentFormalWindow).questionPlanExecution ?? null;
  const mathQuestionPlanAuditArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--json',
    '--subject=math',
    `--sample=${sample}`,
    `--days=${days}`
  ];
  if (mathRun) mathQuestionPlanAuditArgs.push(`--run=${mathRun}`);
  const mathQuestionPlanAudit = runNodeJson(mathQuestionPlanAuditArgs, 'math question-plan shadow audit');
  const mathQuestionPlanShadow = recordFrom(recordFrom(mathQuestionPlanAudit).recentFormalWindow).mathQuestionPlanShadow ?? null;
  const physicsQuestionPlanAuditArgs = [
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--json',
    '--subject=physics',
    `--sample=${sample}`,
    `--days=${days}`
  ];
  const physicsQuestionPlanAudit = runNodeJson(physicsQuestionPlanAuditArgs, 'physics question-plan shadow audit');
  const physicsQuestionPlanShadow = recordFrom(recordFrom(physicsQuestionPlanAudit).recentFormalWindow).physicsQuestionPlanShadow ?? null;

  const failures = [];
  const waits = [];
  const guardrailWarnings = [];
  const chemistry = subjectReadiness(readiness, 'chemistry');
  const math = subjectReadiness(readiness, 'math');
  const physics = subjectReadiness(readiness, 'physics');
  const chemistryRegression = phaseByName(chemistry, 'phase_3_chemistry_regression_protection');
  const mathVisibility = phaseByName(math, 'phase_1_family_visibility');
  const mathVisibilityStatus = cleanText(recordFrom(mathVisibility).status);
  const mathPostfixEfficiencyStatus = cleanText(recordFrom(mathSmoke.evidence).mathPostfixEfficiencyStatus);
  const mathSoftCap = phaseByName(math, 'phase_2_math_soft_cap');
  const mathCandidateReplay = phaseByName(math, 'phase_2_math_candidate_replay_guardrail');
  const mathScheduler = phaseByName(math, 'phase_5_math_scheduler_hint');
  const mathSchedulerAdherence = phaseByName(math, 'phase_5_math_scheduler_hint_adherence');
  const mathNearDuplicate = phaseByName(math, 'phase_6_near_duplicate_fallback');
  const mathStudentBoundary = phaseByName(math, 'student_consumable_current_policy_boundary');
  const physicsVisibility = phaseByName(physics, 'phase_4_physics_visibility');
  const physicsVisibilityStatus = cleanText(recordFrom(physicsVisibility).status);
  const physicsDifficultyWatch = phaseByName(physics, 'phase_4_physics_difficulty_watch');
  const physicsNearDuplicate = phaseByName(physics, 'phase_6_near_duplicate_fallback');
  const chemistryNearDuplicate = phaseByName(chemistry, 'phase_6_near_duplicate_fallback');
  const chemistryIsolation = isolationSubject(isolation, 'chemistry');
  const mathIsolation = isolationSubject(isolation, 'math');
  const physicsIsolation = isolationSubject(isolation, 'physics');
  const chemistryPoolImpact = poolImpactSubject(isolation, 'chemistry');
  const mathPoolImpact = poolImpactSubject(isolation, 'math');
  const physicsPoolImpact = poolImpactSubject(isolation, 'physics');
  const physicsVisualDryRunImpact = poolImpactSubject(physicsVisualPolicyDryRun, 'physics');
  const physicsVisualDryRunEmptyCellCount = Number(recordFrom(physicsVisualDryRunImpact).emptyCellCount) || 0;
  const physicsVisualDryRunLowCellCount = Number(recordFrom(physicsVisualDryRunImpact).lowCellCount) || 0;
  const physicsVisualCurrentPolicyEnabled = Boolean(recordFrom(recordFrom(isolation).poolImpact).policyFlags?.physicsVisualCurrentPolicyEnabled);
  const ledgerSummary = recordFrom(ledgerSmoke.qualityAuditLedger);

  pushFailure(failures, cleanText(ledgerSmoke.mode) === 'read_only_quality_audit_ledger_validation', 'ledger_smoke_not_read_only', ledgerSmoke.mode);
  pushFailure(failures, cleanText(ledgerSmoke.productionImpact) === 'none_audit_only', 'ledger_smoke_has_production_impact', ledgerSmoke.productionImpact);
  pushFailure(failures, cleanText(ledgerSmoke.providerFailurePolicy) === 'provider_failures_must_not_be_quality_audit_family_evidence', 'ledger_provider_boundary_policy_changed', ledgerSmoke.providerFailurePolicy);
  pushFailure(failures, cleanText(ledgerSummary.validationStatus) === 'valid', 'quality_audit_ledger_not_valid', ledgerSummary);
  pushFailure(failures, Number(ledgerSummary.validationIssueCount) === 0, 'quality_audit_ledger_validation_issues', ledgerSummary);
  pushFailure(failures, cleanText(readiness.mode) === 'audit_only', 'readiness_not_audit_only', readiness.mode);
  pushFailure(failures, cleanText(readiness.productionImpact) === 'none_audit_only', 'readiness_has_production_impact', readiness.productionImpact);
  pushFailure(failures, cleanText(readiness.providerFailurePolicy) === 'excluded_from_diversity_quality_memory', 'readiness_provider_failure_policy_changed', readiness.providerFailurePolicy);
  pushFailure(failures, ['ready_for_next_phase', 'calibrated_with_guardrails'].includes(cleanText(readiness.status)), 'readiness_not_phase_safe', readiness.status);

  pushFailure(failures, cleanText(recordFrom(chemistryRegression).status) === 'protected', 'chemistry_regression_not_protected', recordFrom(chemistryRegression).status);
  const mathVisibilityAccepted = mathVisibilityStatus === 'ready'
    || (mathVisibilityStatus === 'insufficient_window' && mathPostfixEfficiencyStatus === 'passed');
  pushFailure(failures, mathVisibilityAccepted, 'math_family_visibility_not_ready', {
    visibilityStatus: recordFrom(mathVisibility).status,
    postfixEfficiencyStatus: mathPostfixEfficiencyStatus || null,
    observationCellId: mathObservationCell
  });
  if (mathVisibilityStatus === 'insufficient_window' && mathPostfixEfficiencyStatus === 'passed') {
    waits.push({
      code: 'math_formal_family_window_missing_observation_gate_passed',
      observationCellId: mathObservationCell,
      postfixEfficiencyScope: recordFrom(mathSmoke.evidence).mathPostfixEfficiencyScope ?? null,
      postfixEfficiencyYields: recordFrom(mathSmoke.evidence).mathPostfixEfficiencyYields ?? null,
      recommendation: 'do_not_repeat_the_validated_basic_function_cell;_select_the_next_guarded_math_family'
    });
  }
  pushFailure(failures, cleanText(recordFrom(mathSoftCap).status) === 'eligible_for_guarded_default_off_smoke', 'math_soft_cap_not_guarded_default_off', recordFrom(mathSoftCap).status);
  pushFailure(failures, ['ready_for_guarded_flag_smoke', 'observe_before_flag_enable'].includes(cleanText(recordFrom(mathCandidateReplay).status)), 'math_candidate_replay_not_guarded', recordFrom(mathCandidateReplay).status);
  pushFailure(failures, cleanText(recordFrom(mathScheduler).status) === 'audit_ready', 'math_scheduler_not_audit_ready', recordFrom(mathScheduler).status);
  pushFailure(failures, ['pending_observation', 'observing', 'needs_prompt_tuning'].includes(cleanText(recordFrom(mathSchedulerAdherence).status)), 'math_scheduler_adherence_not_observable', recordFrom(mathSchedulerAdherence).status);
  pushFailure(failures, cleanText(recordFrom(mathNearDuplicate).status) === 'audit_ready', 'math_near_duplicate_not_audit_ready', recordFrom(mathNearDuplicate).status);
  pushFailure(failures, !['needs_attention', 'missing_calibration', 'needs_classifier_work'].includes(cleanText(recordFrom(mathStudentBoundary).status)), 'math_student_boundary_not_protected', recordFrom(mathStudentBoundary).status);
  pushFailure(
    failures,
    ['ready', 'needs_guarded_observation_window'].includes(physicsVisibilityStatus),
    'physics_visibility_not_ready',
    recordFrom(physicsVisibility).status
  );
  if (physicsVisibilityStatus === 'needs_guarded_observation_window') {
    waits.push({
      code: 'physics_guarded_observation_window_missing',
      evidence: recordFrom(physicsVisibility).evidence ?? null,
      recommendation: 'collect_a_guarded_formal_or_observation_window_before_physics_visibility_enablement'
    });
  }
  pushFailure(failures, ['clear', 'quality_sampling_required', 'quality_sampling_in_progress', 'quality_sampling_complete_with_findings', 'quality_sampling_complete_no_confirmed_issue'].includes(cleanText(recordFrom(physicsDifficultyWatch).status)), 'physics_difficulty_watch_policy_changed', recordFrom(physicsDifficultyWatch).status);
  pushFailure(failures, cleanText(recordFrom(physicsNearDuplicate).status) === 'audit_ready', 'physics_near_duplicate_not_audit_ready', recordFrom(physicsNearDuplicate).status);
  pushFailure(failures, cleanText(recordFrom(chemistryNearDuplicate).status) === 'audit_ready', 'chemistry_near_duplicate_not_audit_ready', recordFrom(chemistryNearDuplicate).status);

  pushFailure(failures, cleanText(mathSmoke.status) === 'passed', 'math_soft_cap_smoke_failed', mathSmoke.failures);
  pushFailure(failures, mathSmoke.productionFlagEnabled === false, 'math_soft_cap_flag_enabled', mathSmoke.productionFlagEnabled);
  pushFailure(failures, cleanText(mathSmoke.productionImpact) === 'none_audit_only', 'math_soft_cap_smoke_has_production_impact', mathSmoke.productionImpact);
  pushFailure(failures, cleanText(mathSmoke.providerFailurePolicy) === 'excluded_from_diversity_quality_memory', 'math_smoke_provider_failure_policy_changed', mathSmoke.providerFailurePolicy);

  pushFailure(failures, Number(isolation.unexpectedNonMathBlockedByCurrentPolicy) === 0, 'unexpected_non_math_current_policy_blockers', isolation.findings);
  pushFailure(failures, Number(recordFrom(chemistryIsolation).blockedByCurrentPolicy) === 0, 'chemistry_current_policy_regression', chemistryIsolation);
  pushFailure(failures, Number(recordFrom(mathIsolation).blockedByCurrentPolicy) === 0, 'math_current_policy_unexpected_in_recent_sample', mathIsolation);
  pushFailure(failures, Number(recordFrom(chemistryPoolImpact).emptyCellCount) === 0, 'chemistry_pool_empty_cell', chemistryPoolImpact);
  pushFailure(failures, Number(recordFrom(mathPoolImpact).emptyCellCount) === 0, 'math_pool_empty_cell', mathPoolImpact);
  pushFailure(failures, Number(recordFrom(physicsPoolImpact).emptyCellCount) === 0, 'physics_pool_empty_cell', physicsPoolImpact);
  pushFailure(
    failures,
    !physicsVisualCurrentPolicyEnabled || physicsVisualDryRunEmptyCellCount === 0,
    'physics_visual_policy_enabled_before_pool_impact_safe',
    physicsVisualPolicyDryRun.poolImpact
  );
  if (!physicsVisualCurrentPolicyEnabled && physicsVisualDryRunEmptyCellCount > 0) {
    guardrailWarnings.push({
      code: 'physics_visual_policy_flag_on_would_empty_cells',
      emptyCellCount: physicsVisualDryRunEmptyCellCount,
      lowCellCount: physicsVisualDryRunLowCellCount,
      recommendation: 'keep_CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED_disabled'
    });
  }

  const preflightWaitReasons = arrayFrom(preflight.waitReasons).map(cleanText);
  if (cleanText(preflight.status) === 'wait_for_existing_observation_or_math_work') {
    const waitCode = preflightWaitReasons.includes('observation_job_already_active')
      ? 'backend_owned_observation_job_wait'
      : preflightWaitReasons.includes('observation_task_already_active')
        ? 'backend_owned_observation_task_wait'
        : 'backend_owned_observation_admission_wait';
    waits.push({
      code: waitCode,
      reasons: preflightWaitReasons,
      runtimeState: preflight.runtimeState ?? null
    });
  } else if (cleanText(preflight.status) === 'wait_for_observation_cooldown') {
    waits.push({
      code: 'observation_cooldown_active',
      reasons: arrayFrom(preflight.waitReasons),
      observationCooldownState: preflight.observationCooldownState ?? null,
      providerRecoveryState: preflight.providerRecoveryState ?? null,
      observationNetworkRecoveryState: preflight.observationNetworkRecoveryState ?? null,
      runtimeState: preflight.runtimeState ?? null
    });
  } else if (cleanText(preflight.status) === 'wait_for_provider_network_recovery') {
    waits.push({
      code: 'provider_network_delivery_recovery_active',
      reasons: arrayFrom(preflight.waitReasons),
      observationNetworkRecoveryState: preflight.observationNetworkRecoveryState ?? null,
      providerRecoveryState: preflight.providerRecoveryState ?? null,
      runtimeState: preflight.runtimeState ?? null
    });
  } else if ([
    'ready_after_observation_only_backend_start',
    'ready_after_observation_only_question_plan_backend_start'
  ].includes(cleanText(preflight.status))) {
    waits.push({
      code: cleanText(preflight.status) === 'ready_after_observation_only_question_plan_backend_start'
        ? 'observation_only_question_plan_backend_start_required'
        : 'observation_only_backend_start_required',
      recommendation: preflight.recommendation ?? null,
      runtimeState: preflight.runtimeState ?? null
    });
  } else {
    pushFailure(
      failures,
      cleanText(preflight.status) === 'eligible_for_backend_owned_observation_submission',
      'math_observation_preflight_not_eligible_or_waiting',
      { status: preflight.status, failures: preflight.failures, waitReasons: preflight.waitReasons }
    );
  }
  pushFailure(failures, cleanText(preflight.providerFailurePolicy) === 'excluded_from_diversity_quality_memory', 'preflight_provider_failure_policy_changed', preflight.providerFailurePolicy);
  pushFailure(
    failures,
    !questionPlanApplicability || cleanText(questionPlanApplicability.productionImpact) === 'none_audit_only',
    'question_plan_applicability_has_production_impact',
    questionPlanApplicability
  );
  pushFailure(
    failures,
    !questionPlanApplicability || cleanText(questionPlanApplicability.providerImpact) === 'none_no_provider_call',
    'question_plan_applicability_provider_boundary_changed',
    questionPlanApplicability
  );
  pushFailure(
    failures,
    !questionPlanCalibration || cleanText(questionPlanCalibration.productionImpact) === 'none_audit_only',
    'question_plan_calibration_has_production_impact',
    questionPlanCalibration
  );
  pushFailure(
    failures,
    !questionPlanCalibration || cleanText(questionPlanCalibration.providerFailurePolicy) === 'excluded_from_plan_quality_calibration',
    'question_plan_calibration_provider_boundary_changed',
    questionPlanCalibration
  );
  pushFailure(
    failures,
    !questionPlanExecution || cleanText(questionPlanExecution.productionImpact) === 'none_audit_only',
    'question_plan_execution_has_production_impact',
    questionPlanExecution
  );
  pushFailure(
    failures,
    !questionPlanExecution || cleanText(questionPlanExecution.providerFailurePolicy) === 'delivery_failures_excluded_from_plan_quality_memory',
    'question_plan_execution_provider_boundary_changed',
    questionPlanExecution
  );
  pushFailure(
    failures,
    !mathQuestionPlanShadow || cleanText(mathQuestionPlanShadow.productionImpact) === 'none_audit_only',
    'math_question_plan_shadow_has_production_impact',
    mathQuestionPlanShadow
  );
  pushFailure(
    failures,
    !mathQuestionPlanShadow || cleanText(mathQuestionPlanShadow.providerImpact) === 'none_no_provider_call',
    'math_question_plan_shadow_provider_boundary_changed',
    mathQuestionPlanShadow
  );
  pushFailure(
    failures,
    !mathQuestionPlanShadow || cleanText(mathQuestionPlanShadow.gateApplicability) === 'guarded_allowlist_available_subjectPracticeQuestionPlanGateFor',
    'math_question_plan_shadow_gate_boundary_changed',
    mathQuestionPlanShadow
  );
  pushFailure(
    failures,
    !mathQuestionPlanShadow || mathQuestionPlanShadow.featureFlagEnabled === false,
    'math_question_plan_shadow_feature_flag_enabled',
    mathQuestionPlanShadow
  );
  pushFailure(
    failures,
    !physicsQuestionPlanShadow || cleanText(physicsQuestionPlanShadow.productionImpact) === 'none_audit_only',
    'physics_question_plan_shadow_has_production_impact',
    physicsQuestionPlanShadow
  );
  pushFailure(
    failures,
    !physicsQuestionPlanShadow || cleanText(physicsQuestionPlanShadow.providerImpact) === 'none_no_provider_call',
    'physics_question_plan_shadow_provider_boundary_changed',
    physicsQuestionPlanShadow
  );
  pushFailure(
    failures,
    !physicsQuestionPlanShadow
      || (
        cleanText(physicsQuestionPlanShadow.subjectBoundary) === 'physics_basic_kinematics_guarded_allowlist_available_other_families_shadow'
        && cleanText(physicsQuestionPlanShadow.gateApplicability) === 'basic_kinematics_guarded_allowlist_available_subjectPracticeQuestionPlanGateFor_other_families_shadow'
      ),
    'physics_question_plan_shadow_gate_boundary_changed',
    physicsQuestionPlanShadow
  );
  pushFailure(
    failures,
    !physicsQuestionPlanShadow || physicsQuestionPlanShadow.featureFlagEnabled === false,
    'physics_question_plan_shadow_feature_flag_enabled',
    physicsQuestionPlanShadow
  );

  const status = failures.length
    ? 'failed'
    : waits.length
      ? 'passed_with_operational_wait'
      : 'passed';
  const nextStep = failures.length
    ? 'fix_rollout_guardrail_failures_before_phase_progression'
    : waits.length
      ? waits.some((wait) => cleanText(wait.code) === 'observation_only_question_plan_backend_start_required')
        ? 'start_observation_only_question_plan_backend_then_rerun_preflight'
        : waits.some((wait) => cleanText(wait.code) === 'observation_only_backend_start_required')
        ? 'start_observation_only_backend_then_rerun_preflight'
        : waits.some((wait) => cleanText(wait.code) === 'math_formal_family_window_missing_observation_gate_passed')
          ? 'select_next_guarded_math_family_with_no_provider_calibration'
        : waits.some((wait) => cleanText(wait.code) === 'observation_cooldown_active')
          ? 'wait_for_observation_cooldown_then_rerun_preflight'
        : waits.some((wait) => cleanText(wait.code) === 'provider_network_delivery_recovery_active')
          ? 'wait_for_provider_network_recovery_then_rerun_preflight'
        : 'wait_for_existing_backend_owned_observation_then_rerun_preflight'
      : 'eligible_for_backend_owned_math_observation_submission';
  const report = {
    mode: 'read_only_rollout_gate',
    scope: 'chemistry_math_physics',
    status,
    nextStep,
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'excluded_from_diversity_quality_memory',
    featureFlags: {
      mathSoftCap: 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED',
      mathSoftCapEnabled: mathSmoke.productionFlagEnabled === true,
      physicsVisualCurrentPolicy: 'CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED',
      physicsVisualCurrentPolicyEnabled
    },
    evidence: {
      readinessStatus: readiness.status,
      qualityAuditLedger: ledgerSummary,
      subjects: summarizeReadiness(readiness),
      mathSmokeStatus: mathSmoke.status,
      mathCandidateReplayStatus: mathSmoke.evidence?.mathCandidateReplayStatus ?? null,
      mathSchedulerAdherenceStatus: mathSmoke.evidence?.mathSchedulerAdherenceStatus ?? null,
      preflightStatus: preflight.status,
      questionPlanApplicability,
      questionPlanCalibration,
      questionPlanExecution,
      mathQuestionPlanShadow,
      physicsQuestionPlanShadow,
      mathDuplicateBlockedOpenRuns: arrayFrom(recordFrom(preflight.runtimeState).duplicateBlockedOpenRuns),
      isolation: {
        bySubject: isolation.bySubject,
        poolImpact: recordFrom(isolation).poolImpact
          ? {
            bySubject: recordFrom(isolation).poolImpact.bySubject,
            reasonCounts: recordFrom(isolation).poolImpact.reasonCounts
          }
          : null
      },
      physicsVisualPolicyFlagOnDryRun: {
        mode: 'current_policy_pool_impact_dry_run',
        productionImpact: 'none_audit_only',
        flagEnabledForDryRun: true,
        bySubject: recordFrom(recordFrom(physicsVisualPolicyDryRun).poolImpact).bySubject ?? [],
        reasonCounts: recordFrom(recordFrom(physicsVisualPolicyDryRun).poolImpact).reasonCounts ?? [],
        emptyCells: recordFrom(recordFrom(physicsVisualPolicyDryRun).poolImpact).emptyCells ?? [],
        lowCells: recordFrom(recordFrom(physicsVisualPolicyDryRun).poolImpact).lowCells ?? []
      }
    },
    waits,
    guardrailWarnings,
    failures
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Subject-practice diversity rollout gate: ${status}`);
    console.log(`- nextStep: ${nextStep}`);
    console.log(`- readiness=${readiness.status}, ledger=${ledgerSummary.validationStatus || 'unknown'}(${Number(ledgerSummary.sampleCount ?? ledgerSummary.reviewCount) || 0}), mathSmoke=${mathSmoke.status}, preflight=${preflight.status}`);
    console.log(`- flags: mathSoftCap=${report.featureFlags.mathSoftCapEnabled}, physicsVisualCurrentPolicy=${report.featureFlags.physicsVisualCurrentPolicyEnabled}`);
    if (questionPlanCalibration) {
      console.log(`- question-plan calibration: samples=${Number(questionPlanCalibration.sampleCount) || 0}, productionImpact=${questionPlanCalibration.productionImpact}`);
    }
    if (questionPlanApplicability) {
      console.log(`- question-plan applicability: applicable=${Number(questionPlanApplicability.applicableCount) || 0}/${Number(questionPlanApplicability.cellCount) || 0}, providerImpact=${questionPlanApplicability.providerImpact}`);
    }
    if (questionPlanExecution) {
      console.log(`- question-plan execution: observed=${Number(questionPlanExecution.observedCount) || 0}/${Number(questionPlanExecution.candidateCount) || 0}, productionImpact=${questionPlanExecution.productionImpact}`);
    }
    if (mathQuestionPlanShadow) {
      console.log(`- math question-plan shadow: cells=${Number(mathQuestionPlanShadow.applicableCellCount) || 0}, samples=${Number(mathQuestionPlanShadow.sampleCount) || 0}, productionImpact=${mathQuestionPlanShadow.productionImpact}`);
    }
    if (physicsQuestionPlanShadow) {
      console.log(`- physics question-plan shadow: cells=${Number(physicsQuestionPlanShadow.applicableCellCount) || 0}, samples=${Number(physicsQuestionPlanShadow.sampleCount) || 0}, productionImpact=${physicsQuestionPlanShadow.productionImpact}`);
    }
    if (arrayFrom(report.evidence.mathDuplicateBlockedOpenRuns).length) {
      console.log(`- math duplicate-blocked open runs: ${arrayFrom(report.evidence.mathDuplicateBlockedOpenRuns).map((run) => `#${run.id}(open=${run.openTotal})`).join(', ')}`);
    }
    for (const subject of arrayFrom(report.evidence.isolation.bySubject)) {
      const impact = poolImpactSubject(isolation, subject.subject);
      console.log(`- isolation ${subject.subject}: blocked=${subject.blockedByCurrentPolicy}, emptyCells=${Number(recordFrom(impact).emptyCellCount) || 0}`);
    }
    console.log(`- physics visual flag-on dry-run: emptyCells=${physicsVisualDryRunEmptyCellCount}, lowCells=${physicsVisualDryRunLowCellCount}`);
    if (waits.length) {
      console.log('Operational waits');
      for (const wait of waits) {
        const recovery = recordFrom(wait.providerRecoveryState);
        const recoveryDetail = recovery.eligibleAfter
          ? `, eligibleAfter=${recovery.eligibleAfter}, remainingSeconds=${Number(recovery.remainingSeconds) || 0}`
          : '';
        const cooldown = recordFrom(wait.observationCooldownState);
        const cooldownDetail = cooldown.eligibleAfter
          ? `, observationCooldownEligibleAfter=${cooldown.eligibleAfter}, observationCooldownRemainingSeconds=${Number(cooldown.remainingSeconds) || 0}`
          : '';
        console.log(`- ${wait.code}: ${arrayFrom(wait.reasons).join(', ') || 'n/a'}${recoveryDetail}${cooldownDetail}`);
      }
    }
    if (guardrailWarnings.length) {
      console.log('Guardrail warnings');
      for (const warning of guardrailWarnings) console.log(`- ${warning.code}: ${warning.recommendation}`);
    }
    if (failures.length) {
      console.log('Failures');
      for (const failure of failures) console.log(`- ${failure.code}: ${JSON.stringify(failure.detail)}`);
    }
  }

  if (failures.length) process.exitCode = 1;
}

main();
