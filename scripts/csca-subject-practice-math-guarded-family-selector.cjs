#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { validationProtocolForTarget } = require('./lib/subject-practice-validation-protocol.cjs');

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

function positiveInt(name, fallback) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function runNodeJson(args, label, allowNonZero = false) {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stdout = cleanText(result.stdout);
  if (!stdout) throw new Error(`${label} returned no JSON${result.stderr ? `: ${cleanText(result.stderr)}` : ''}`);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
  if (!allowNonZero && result.status !== 0) {
    throw new Error(`${label} exited ${result.status}: ${cleanText(result.stderr)}`);
  }
  return parsed;
}

const TRANSFERABLE_EVIDENCE = Object.freeze({
  elementary_function_exp_log_ordering: {
    level: 'historical_live_publishable_plus_fixed_eval',
    score: 50,
    fixtureQuestionIds: [16338],
    reviewerPatch: 'math-exp-log-ordering-difficulty-evidence-patch-v1',
    questionPlanVerdict: 'candidate_matches_exp_log_ordering_plan_shape'
  },
  elementary_function_direct_property: {
    level: 'fixed_eval_task_family_plus_question_plan',
    score: 25,
    fixtureQuestionIds: [],
    reviewerPatch: null,
    questionPlanVerdict: 'candidate_matches_elementary_function_relation_plan_shape'
  }
});

function transferableEvidenceFor(family, verification) {
  const configured = TRANSFERABLE_EVIDENCE[family] ?? {
    level: 'question_plan_only_no_transferable_live_fixture',
    score: 0,
    fixtureQuestionIds: [],
    reviewerPatch: null,
    questionPlanVerdict: null
  };
  if (family === 'elementary_function_direct_property') {
    const verified = verification.mathQuestionPlanShadowPassed
      && verification.fixedEvalPassed
      && verification.elementaryDirectPropertyFixtureCount >= 1;
    return { ...configured, verified, score: verified ? configured.score : 0 };
  }
  if (family !== 'elementary_function_exp_log_ordering') return { ...configured, verified: false, score: 0 };
  const verified = verification.mathQuestionPlanShadowPassed
    && verification.fixedEvalPassed
    && verification.expLogOrderingVerdictCount >= 1
    && verification.expLogReviewerPatchCount >= 1;
  return {
    ...configured,
    verified,
    score: verified ? configured.score : 0
  };
}

function scorePreview(report, validatedCellIds, evidenceVerification) {
  const selection = recordFrom(report.selection);
  const cell = recordFrom(arrayFrom(selection.consideredCells)[0]);
  const planPreview = recordFrom(report.questionPlanPreview);
  const plan = recordFrom(planPreview.questionPlan);
  const exactGate = recordFrom(planPreview.exactObservationGate);
  const exactAttempt = recordFrom(planPreview.exactObservationAttempt);
  const prompt = recordFrom(report.promptContractPreview);
  const executionCostPolicy = recordFrom(prompt.executionCostPolicy);
  const family = cleanText(plan.taskFamily);
  const evidence = transferableEvidenceFor(family, evidenceVerification);
  const cellId = Number(selection.selectedCellId) || Number(cell.id) || null;
  const difficulty = cleanText(cell.difficultyBand);
  const planReady = exactAttempt.status === 'plan_ready' && recordFrom(exactGate.validation).valid === true;
  const promptReady = prompt.status === 'passed' && arrayFrom(prompt.missingRequiredPhrases).length === 0;
  const alreadyValidated = validatedCellIds.has(cellId);
  const attempts = Number(recordFrom(cell.productionDiagnostics).jobAttemptCount) || 0;
  let score = Number(evidence.score) || 0;
  if (planReady) score += 25;
  if (promptReady) score += 20;
  if (difficulty === 'medium') score += 10;
  else if (difficulty === 'basic') score += 8;
  else if (difficulty === 'hard') score -= 10;
  if (attempts === 0) score += 5;
  if (alreadyValidated) score -= 1000;
  return {
    cellId,
    blueprintId: Number(selection.selectedBlueprintId) || null,
    topicTitle: cleanText(cell.topicTitle),
    difficulty,
    runCellStatus: cleanText(cell.status),
    taskFamily: family || null,
    planTemplate: cleanText(plan.planTemplate) || null,
    planReady,
    promptReady,
    promptMissingRequiredPhraseCount: arrayFrom(prompt.missingRequiredPhrases).length,
    promptCharacterCount: Number(prompt.totalPromptCharacters) || null,
    promptCharacterBudget: Number(prompt.promptCharacterBudget) || null,
    promptBudgetStatus: cleanText(prompt.promptBudgetStatus) || null,
    executionCostPolicy: Object.keys(executionCostPolicy).length ? executionCostPolicy : null,
    transferableEvidence: evidence,
    alreadyValidated,
    score,
    eligibleForNoProviderCalibration: !alreadyValidated && planReady && promptReady,
    liveExecutionAllowed: false,
    liveExecutionBlockers: [
      'selector_is_read_only_and_does_not_authorize_provider_calls',
      ...(cleanText(recordFrom(report.requested).runStatus) === 'running' ? [] : [`run_not_running:${cleanText(recordFrom(report.requested).runStatus) || 'unknown'}`]),
      'fresh_explicit_authorization_required_before_any_live_request'
    ]
  };
}

function main() {
  const runId = positiveInt('run', 1);
  const explicitlyRequestedValidatedCellId = Number(argValue('validated-cell', '')) || null;
  const json = hasFlag('json');
  const audit = runNodeJson([
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--json',
    '--subject=math',
    `--run=${runId}`,
    '--sample=40',
    '--days=30'
  ], 'math production audit');
  const mathQuestionPlanShadowFixture = runNodeJson([
    path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs'),
    '--self-test-math-question-plan-shadow',
    '--json'
  ], 'math QuestionPlan shadow fixture');
  const fixedEval = runNodeJson([
    path.resolve(__dirname, 'csca-subject-practice-fixed-eval.cjs'),
    '--json'
  ], 'subject-practice fixed eval');
  const profilePatchCheck = arrayFrom(fixedEval.checks)
    .find((check) => cleanText(check.label) === 'profile_difficulty_patch_fixed_eval');
  const taskFamilyCheck = arrayFrom(fixedEval.checks)
    .find((check) => cleanText(check.label) === 'task_family_fingerprint_fixed_eval');
  const elementaryDirectPropertyFixtureCount = arrayFrom(recordFrom(taskFamilyCheck).samples)
    .filter((sample) => cleanText(sample.taskFamily) === 'elementary_function_direct_property').length;
  const expLogOrderingVerdictCount = Number(arrayFrom(mathQuestionPlanShadowFixture.verdictCounts)
    .find((item) => cleanText(item.verdict) === 'candidate_matches_exp_log_ordering_plan_shape')?.count) || 0;
  const expLogReviewerPatchCount = Number(arrayFrom(recordFrom(profilePatchCheck).patchCounts)
    .find((item) => cleanText(item.patchVersion) === 'math-exp-log-ordering-difficulty-evidence-patch-v1')?.count) || 0;
  const evidenceVerification = {
    mathQuestionPlanShadowPassed: cleanText(mathQuestionPlanShadowFixture.status) === 'passed',
    fixedEvalPassed: cleanText(fixedEval.status) === 'passed',
    expLogOrderingVerdictCount,
    expLogReviewerPatchCount,
    elementaryDirectPropertyFixtureCount,
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call'
  };
  const cells = arrayFrom(audit.cells);
  const postfixByCell = cells.map((cell) => {
    const report = runNodeJson([
      path.resolve(__dirname, 'csca-subject-practice-math-postfix-efficiency-gate.cjs'),
      `--run=${runId}`,
      `--cell=${cell.id}`,
      '--hours=72',
      '--json'
    ], `cell #${cell.id} postfix gate`, true);
    return {
      cellId: Number(cell.id),
      status: cleanText(report.status),
      efficiencySatisfied: report.efficiencySatisfied === true,
      sampleCounts: report.sampleCounts ?? null,
      yields: report.yields ?? null,
      reasons: arrayFrom(report.reasons)
    };
  });
  const previews = cells.map((cell) => runNodeJson([
    path.resolve(__dirname, 'csca-subject-practice-exact-cell-enqueue.cjs'),
    '--json',
    '--subject=math',
    `--run=${runId}`,
    `--cell=${cell.id}`,
    '--include-prompt-contract'
  ], `math cell #${cell.id} exact preview`));
  const previewByCell = new Map(previews.map((preview) => [Number(recordFrom(preview.selection).selectedCellId), preview]));
  const validatedEvidenceByCell = new Map(postfixByCell
    .filter((item) => item.efficiencySatisfied)
    .map((item) => {
      const preview = previewByCell.get(item.cellId);
      const taskFamily = cleanText(recordFrom(recordFrom(preview).questionPlanPreview).questionPlan?.taskFamily);
      const scorecard = taskFamily
        ? runNodeJson([
          path.resolve(__dirname, 'csca-subject-practice-observation-scorecard.cjs'),
          '--subject=math',
          `--run=${runId}`,
          `--cell=${item.cellId}`,
          `--task-family=${taskFamily}`,
          '--json'
        ], `cell #${item.cellId} exact-family scorecard`)
        : null;
      const funnels = recordFrom(scorecard?.funnels);
      const safety = recordFrom(scorecard?.safety);
      const effectiveProviderSampleCount = Number(funnels.effectiveProviderSampleCount ?? funnels.providerAttemptedTaskCount ?? 0);
      const exactFamilyEvidenceSatisfied = effectiveProviderSampleCount >= 3
        && Number(funnels.deliveredTaskCount) >= 3
        && Number(funnels.publishableGateCount) >= 2
        && Number(funnels.questionPlanAdheredCount) >= 2
        && Number(safety.studentPublicationViolationCount) === 0;
      return [item.cellId, {
        taskFamily: taskFamily || null,
        evidenceScope: scorecard?.evidenceScope ?? null,
        scorecardStatus: scorecard?.status ?? null,
        funnels: scorecard?.funnels ?? null,
        exactFamilyEvidenceSatisfied
      }];
    }));
  const familyAwarePostfixByCell = postfixByCell.map((item) => ({
    ...item,
    exactFamilyEvidence: validatedEvidenceByCell.get(item.cellId) ?? null,
    exactFamilyEvidenceSatisfied: validatedEvidenceByCell.get(item.cellId)?.exactFamilyEvidenceSatisfied === true
  }));
  const validatedCells = familyAwarePostfixByCell.filter((item) => item.efficiencySatisfied && item.exactFamilyEvidenceSatisfied);
  const validatedCellIds = new Set(validatedCells.map((item) => item.cellId));
  const requestedValidatedCell = explicitlyRequestedValidatedCellId
    ? familyAwarePostfixByCell.find((item) => item.cellId === explicitlyRequestedValidatedCellId) ?? null
    : validatedCells[0] ?? null;
  const candidates = previews
    .map((preview) => scorePreview(preview, validatedCellIds, evidenceVerification))
    .filter((candidate) => candidate.eligibleForNoProviderCalibration)
    .sort((left, right) => right.score - left.score || left.cellId - right.cellId);
  const selected = candidates[0] ?? null;
  const selectedHistoricalProtocolScorecard = selected
    ? runNodeJson([
      path.resolve(__dirname, 'csca-subject-practice-observation-scorecard.cjs'),
      '--subject=math',
      `--run=${runId}`,
      `--cell=${selected.cellId}`,
      `--task-family=${selected.taskFamily}`,
      '--current-protocol-cohort',
      '--json'
    ], `selected cell #${selected.cellId} current-protocol exact-family scorecard`)
    : null;
  const selectedValidationProtocolVersion = selected ? validationProtocolForTarget({
    subject: 'math', productionRunId: runId, productionCellId: selected.cellId, taskFamily: selected.taskFamily
  }) : null;
  const selectedCurrentProtocolScorecard = selectedValidationProtocolVersion
    ? runNodeJson([
      path.resolve(__dirname, 'csca-subject-practice-observation-scorecard.cjs'),
      '--subject=math',
      `--run=${runId}`,
      `--cell=${selected.cellId}`,
      `--task-family=${selected.taskFamily}`,
      `--validation-protocol-version=${selectedValidationProtocolVersion}`,
      '--current-protocol-cohort',
      '--json'
    ], `selected cell #${selected.cellId} versioned exact-family scorecard`)
    : selectedHistoricalProtocolScorecard;
  const selectedHistoricalContinuation = recordFrom(selectedHistoricalProtocolScorecard?.continuation);
  const selectedHistoricalFunnels = recordFrom(selectedHistoricalProtocolScorecard?.funnels);
  const selectedCurrentProtocolContinuation = recordFrom(selectedCurrentProtocolScorecard?.continuation);
  const selectedCurrentProtocolFunnels = recordFrom(selectedCurrentProtocolScorecard?.funnels);
  const selectedLocalPreProviderDiagnosticCount = Number(selectedCurrentProtocolFunnels.localPreProviderDiagnosticCount || 0);
  const currentProtocolContinuationEligible = cleanText(selectedCurrentProtocolContinuation.status) === 'eligible_for_one_more_guarded_observation'
    && selectedCurrentProtocolContinuation.doesNotAuthorizeExecution === true
    && selectedCurrentProtocolContinuation.requiresFreshExplicitAuthorization === true;
  const historicalProtocolQualityStopped = [
    'stop_quality_threshold_not_met',
    'stop_provider_sample_budget_exhausted'
  ].includes(cleanText(selectedHistoricalContinuation.status));
  const locallyCalibrated = Boolean(selected
    && selected.planReady
    && selected.promptReady
    && selected.transferableEvidence?.verified === true
    && evidenceVerification.mathQuestionPlanShadowPassed
    && evidenceVerification.fixedEvalPassed);
  const localRepairComplete = historicalProtocolQualityStopped
    && locallyCalibrated
    && selected?.executionCostPolicy?.status === 'guarded_compact_non_thinking_policy_active'
    && selected?.executionCostPolicy?.reasoningPolicyVersion === 'question-generation-reasoning-effort-v3'
    && Number(selected?.executionCostPolicy?.outputTokenCeiling) === 3000;
  const versionedProtocolReady = localRepairComplete
    && Boolean(selectedValidationProtocolVersion)
    && Number(selectedCurrentProtocolFunnels.effectiveProviderSampleCount || 0) === 0
    && currentProtocolContinuationEligible;
  const report = {
    mode: 'read_only_math_guarded_family_selector',
    status: versionedProtocolReady
      ? 'selected_versioned_validation_protocol_ready_for_authorization_review'
      : localRepairComplete
      ? 'selected_local_repair_completed_new_protocol_required'
      : historicalProtocolQualityStopped
      ? 'selected_requires_local_repair_after_bounded_failure'
      : locallyCalibrated
      ? 'selected_and_locally_calibrated'
      : selected
        ? 'selected_for_no_provider_calibration'
        : 'no_guarded_family_ready',
    productionImpact: 'none_read_only_selection',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_audit_and_exact_cell_previews',
    studentConsumableImpact: 'none',
    productionRunId: runId,
    runStatus: cleanText(recordFrom(audit.run).status) || null,
    runBlockedReasonCode: cleanText(recordFrom(audit.run).blockedReasonCode) || null,
    validatedCell: requestedValidatedCell
      ? {
        cellId: requestedValidatedCell.cellId,
        postfixGateStatus: requestedValidatedCell.status,
        excludedFromSelection: requestedValidatedCell.efficiencySatisfied && requestedValidatedCell.exactFamilyEvidenceSatisfied,
        reason: requestedValidatedCell.efficiencySatisfied && requestedValidatedCell.exactFamilyEvidenceSatisfied
        ? 'already_met_stage_threshold_do_not_repeat_provider_spend'
        : requestedValidatedCell.efficiencySatisfied
          ? 'cell_level_postfix_passed_but_exact_planned_family_evidence_not_satisfied'
          : 'postfix_gate_not_passed_not_treated_as_completed'
      }
      : null,
    validatedCells,
    validationDiscovery: {
      policy: 'all_current_run_cells_evaluated_by_postfix_gate_then_exact_planned_family_evidence_required',
      evaluatedCellCount: postfixByCell.length,
      validatedCellCount: validatedCells.length,
      cellLevelPostfixSatisfiedCount: postfixByCell.filter((item) => item.efficiencySatisfied).length,
      providerImpact: 'none_no_provider_call'
    },
    selectionPolicy: {
      version: 'math-guarded-family-selection-v2-dynamic-validation',
      primary: 'prefer_transferable_live_publishable_and_fixed_eval_evidence',
      secondary: 'require_valid_question_plan_and_complete_prompt_contract',
      difficultyBias: 'medium_then_basic_while_hard_is_deferred',
      costPolicy: 'no_provider_during_selection_or_calibration',
      authorizationBoundary: 'selection_does_not_authorize_live_generation_or_student_publication'
    },
    evidenceVerification,
    selectedExactFamilyCurrentProtocolEvidence: selectedCurrentProtocolScorecard
      ? {
        evidenceScope: selectedCurrentProtocolScorecard.evidenceScope,
        protocolCohort: selectedCurrentProtocolScorecard.protocolCohort,
        protocolCohortCounts: selectedCurrentProtocolScorecard.protocolCohortCounts,
        scorecardStatus: selectedCurrentProtocolScorecard.status,
        funnels: selectedCurrentProtocolScorecard.funnels,
        cost: selectedCurrentProtocolScorecard.cost,
        continuation: selectedCurrentProtocolScorecard.continuation,
        continuationEligibleForAuthorizationReview: currentProtocolContinuationEligible,
        doesNotAuthorizeExecution: true
      }
      : null,
    selectedExactFamilyHistoricalProtocolEvidence: selectedHistoricalProtocolScorecard
      ? {
        scorecardStatus: selectedHistoricalProtocolScorecard.status,
        funnels: selectedHistoricalProtocolScorecard.funnels,
        cost: selectedHistoricalProtocolScorecard.cost,
        continuation: selectedHistoricalProtocolScorecard.continuation,
        preservedForAudit: true
      }
      : null,
    selected,
    candidates,
    localCalibration: selected
      ? {
        status: locallyCalibrated ? 'passed' : 'needs_fixture_or_contract_work',
        planReady: selected.planReady,
        promptReady: selected.promptReady,
        promptCharacterCount: selected.promptCharacterCount,
        promptCharacterBudget: selected.promptCharacterBudget,
        promptBudgetStatus: selected.promptBudgetStatus,
        transferableEvidenceVerified: selected.transferableEvidence?.verified === true,
        fixedEvalPassed: evidenceVerification.fixedEvalPassed,
        questionPlanShadowPassed: evidenceVerification.mathQuestionPlanShadowPassed,
        providerImpact: 'none_no_provider_call',
        studentConsumableImpact: 'none'
      }
      : null,
    nextAction: selected
      ? {
        code: versionedProtocolReady
          ? 'bounded_versioned_three_sample_coordinator_ready_for_authorization_review'
          : localRepairComplete
          ? 'define_new_versioned_validation_protocol_after_local_repair'
          : historicalProtocolQualityStopped
          ? 'repair_selected_family_after_bounded_quality_failure'
          : locallyCalibrated
          ? 'bounded_three_sample_coordinator_ready_for_authorization_review'
          : 'calibrate_selected_family_with_existing_fixtures_and_fixed_eval',
        cellId: selected.cellId,
        taskFamily: selected.taskFamily,
        planTemplate: selected.planTemplate,
        providerCallAllowed: false,
        studentPublicationAllowed: false,
        validationProtocolVersion: selectedValidationProtocolVersion,
        requiredBeforeFutureLiveValidation: versionedProtocolReady ? [
          'obtain_fresh_exact_authorization_naming_the_fixed_validation_protocol_before_any_provider_call'
        ] : localRepairComplete ? [
          'define_a_new_versioned_protocol_cohort_that_excludes_the_failed_pre_repair_samples',
          'rerun_bounded_coordinator_and_scorecard_self_tests_for_that_protocol_version',
          'obtain_fresh_exact_authorization_before_any_provider_call'
        ] : historicalProtocolQualityStopped ? [
          'repair_prompt_plan_and_output_compaction_without_provider',
          'rerun_fixed_eval_prompt_contract_and_no_provider_acceptance',
          'obtain_a_new_continuation_eligible_protocol_cohort_before_any_paid_validation'
        ] : [
          'selected_family_fixed_eval_passes',
          'exact_cell_question_plan_and_prompt_contract_remain_ready',
          'exact_family_current_protocol_continuation_is_eligible_for_authorization_review',
          'bounded_coordinator_preview_matches_exact_family_and_cost_limits',
          'run_block_or_observation_only_target_is_resolved_without_enabling_unbounded_production',
          'fresh_explicit_authorization_names_the_selected_family_and_call_limit'
        ]
      }
      : null,
    futureLiveValidationPlan: locallyCalibrated
      ? {
        status: versionedProtocolReady
          ? 'bounded_versioned_coordinator_ready_for_authorization_review_not_authorized'
          : localRepairComplete
          ? 'blocked_new_versioned_protocol_required_after_local_repair'
          : historicalProtocolQualityStopped
          ? 'blocked_bounded_quality_threshold_not_met_local_repair_required'
          : 'bounded_coordinator_ready_for_authorization_review_not_authorized',
        target: {
          subject: 'math',
          productionRunId: runId,
          productionCellId: selected.cellId,
          taskFamily: selected.taskFamily,
          planTemplate: selected.planTemplate,
          validationProtocolVersion: selectedValidationProtocolVersion
        },
        maximumProviderCalls: 3,
        maximumEstimatedCostUsd: 0.02,
        maximumTotalEstimatedCostUsd: 0.02,
        maximumEstimatedCostUsdPerCall: 0.006,
        currentProtocolContinuationStatus: cleanText(selectedCurrentProtocolContinuation.status) || null,
        currentProtocolContinuationEligibleForAuthorizationReview: currentProtocolContinuationEligible,
        currentProtocolEffectiveProviderSampleCount: Number(selectedCurrentProtocolFunnels.effectiveProviderSampleCount || 0),
        excludedLocalPreProviderDiagnosticCount: selectedLocalPreProviderDiagnosticCount,
        providerAdmissionPolicy: {
          promptCharacterBudget: selected.promptCharacterBudget,
          promptBudgetStatus: selected.promptBudgetStatus,
          policyStatus: selected.executionCostPolicy?.status ?? null,
          policyVersion: selected.executionCostPolicy?.reasoningPolicyVersion ?? null,
          thinkingMode: selected.executionCostPolicy?.thinkingMode ?? null,
          reasoningEffort: selected.executionCostPolicy?.reasoningEffort ?? null,
          outputTokenCeiling: selected.executionCostPolicy?.outputTokenCeiling ?? null,
          temperature: selected.executionCostPolicy?.temperaturePolicy ?? null,
          executionShape: 'bounded_coordinator_strictly_serial_three_backend_owned_observation_tasks_with_one_job_each'
        },
        requiredGatePublishableCount: 2,
        requiredQuestionPlanAdherenceCount: 2,
        requiredDeliverySuccessCount: 3,
        requiredStudentPublishedCount: 0,
        executionAllowed: false,
        authorizationRequired: versionedProtocolReady || !historicalProtocolQualityStopped,
        authorizationBoundary: versionedProtocolReady
          ? `a_fresh_user_authorization_must_name_${selectedValidationProtocolVersion}_math_${selected.taskFamily}_three_provider_calls_0.006_usd_per_call_and_0.02_usd_total`
          : localRepairComplete
          ? 'local_repair_is_complete_but_a_new_versioned_cohort_and_fresh_exact_authorization_are_required_before_provider_use'
          : historicalProtocolQualityStopped
          ? 'no_new_provider_authorization_should_be_requested_until_local_repair_and_a_new_eligible_protocol_cohort_exist'
          : `a_future_user_authorization_must_name_math_${selected.taskFamily}_three_provider_calls_0.006_usd_per_call_and_0.02_usd_total`,
        operatorCommands: {
          preview: [
            'npm.cmd run csca-ai-questioning:math-bounded-family-validation --',
            `--run=${runId}`,
            `--cell=${selected.cellId}`,
            '--max-provider-calls=3',
            '--max-total-estimated-cost-usd=0.02',
            '--max-estimated-cost-usd-per-call=0.006',
            '--json'
          ].join(' '),
          applyAfterFreshAuthorization: versionedProtocolReady || !historicalProtocolQualityStopped ? [
            'npm.cmd run csca-ai-questioning:math-bounded-family-validation --',
            '--base-url=http://127.0.0.1:3001',
            `--run=${runId}`,
            `--cell=${selected.cellId}`,
            '--max-provider-calls=3',
            '--max-total-estimated-cost-usd=0.02',
            '--max-estimated-cost-usd-per-call=0.006',
            '--apply',
            '--confirm-bounded-math-family-validation',
            '--confirm-runtime-clean',
            '--confirm-provider-recovery',
            '--confirm-no-student-publication',
            `--confirm-run=${runId}`,
            `--confirm-cell=${selected.cellId}`,
            `--confirm-task-family=${selected.taskFamily}`,
            ...(selectedValidationProtocolVersion
              ? [`--confirm-validation-protocol-version=${selectedValidationProtocolVersion}`]
              : []),
            '--confirm-max-provider-calls=3',
            '--confirm-max-total-estimated-cost-usd=0.02',
            '--confirm-max-estimated-cost-usd-per-call=0.006',
            ...(selectedLocalPreProviderDiagnosticCount > 0
              ? [`--confirm-excluded-local-pre-provider-diagnostics=${selectedLocalPreProviderDiagnosticCount}`]
              : []),
            '--json'
          ].join(' ') : null
        }
      }
      : null
  };
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Math guarded-family selector: ${report.status}`);
    console.log(`- validated cells: ${validatedCells.map((item) => `#${item.cellId}`).join(', ') || 'none'}`);
    console.log(`- selected: ${selected ? `#${selected.cellId} ${selected.taskFamily} score=${selected.score}` : 'none'}`);
    console.log('- provider impact: none');
  }
  if (!selected) process.exitCode = 1;
}

main();
