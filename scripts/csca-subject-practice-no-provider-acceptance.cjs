const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${error.message}\n${stdout.slice(0, 400)}`);
  }
}

function runNode(args, label) {
  return execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function runNodeJson(args, label) {
  try {
    return parseJson(runNode(args, label), label);
  } catch (error) {
    const stdout = String(error?.stdout || error?.output?.[1] || '');
    if (!stdout.trim()) throw error;
    const report = parseJson(stdout, label);
    if (report && typeof report === 'object') {
      report.childExitStatus = Number(error?.status) || 1;
    }
    return report;
  }
}

function isDatabaseUnavailableError(error) {
  const text = String(error?.stack || error?.message || error || '');
  return /Can't reach database server|PrismaClientInitializationError|P1001|ECONNREFUSED/i.test(text);
}

function compactErrorMessage(error) {
  return String(error?.message || error || '')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function pushCheck(checks, fn) {
  try {
    checks.push(fn());
  } catch (error) {
    checks.push({
      label: fn.name || 'unknown_check',
      status: 'failed',
      productionImpact: 'none_audit_or_fixture_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'unknown',
      error: compactErrorMessage(error)
    });
  }
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(arrayFrom(values).map(cleanText).filter(Boolean)));
}

const MATH_EXACT_PREVIEW_CELL_IDS = [
  352, 351, 350,
  355, 354, 353,
  361, 360, 359,
  340, 339, 338,
  349, 348, 347,
  343, 342, 341,
  358, 357, 356,
  364, 363, 362,
  367, 366, 365,
  346, 345, 344
];
const CURRENT_MATH_EXACT_PREVIEW_CELL_IDS = Array.from({ length: 17 }, (_, index) => index + 1);

function mathExactPreviewCellIds(runId) {
  const configured = uniqueStrings(cleanText(argValue('math-cell-ids', '')).split(','))
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  if (configured.length > 0) return configured;
  return Number(runId) === 1
    ? CURRENT_MATH_EXACT_PREVIEW_CELL_IDS
    : MATH_EXACT_PREVIEW_CELL_IDS;
}

function observationBackendBaseUrl() {
  const configured = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || ''));
  return configured ? configured.replace(/\/+$/, '') : '';
}

function observationBaseUrlArgs(baseUrl) {
  return baseUrl ? [`--base-url=${baseUrl}`] : [];
}

function extractUniqueMatches(source, pattern) {
  return Array.from(new Set([...String(source ?? '').matchAll(pattern)].map((match) => match[0]))).sort();
}

function isRecentIsoTimestamp(value, maxAgeMs) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function auditEvidenceText(evidence) {
  if (evidence == null) return '';
  if (typeof evidence === 'string') return evidence;
  if (typeof evidence !== 'object') return String(evidence);
  return Object.entries(evidence)
    .map(([key, value]) => `${key}=${value ?? 'null'}`)
    .join(', ');
}

function residualReviewerRouteFromGateReasons(reasons) {
  const text = arrayFrom(reasons)
    .map((item) => cleanText(item.reason ?? item.errorCode ?? item.value))
    .join(' ');
  if (/profile_|difficulty_evidence|hard_|medium_|calculation|multistep|quantitative_shape/i.test(text)) {
    return 'question_plan_evidence_slots_or_difficulty_rubric';
  }
  if (/subject_practice_task_family_overrepresented|diversity|near_duplicate|repeated/i.test(text)) {
    return 'diversity_window_or_scheduler';
  }
  if (/reviewer_needs_quality_attention|quality_attention|answer|uniqueness|explanation|validator/i.test(text)) {
    return 'reviewer_validator_calibration';
  }
  if (/provider_|gateway_|schema|timeout|network|empty_output|rate_limited|cooldown/i.test(text)) {
    return 'delivery_or_provider_contract';
  }
  return 'reviewer_gate_or_question_plan_calibration';
}

function compactSummaryReport(report) {
  const mathExactCellPreview = report.mathExactCellPreview ?? {};
  const mathScorecard = report.mathScorecard ?? {};
  const mathAllExactCellQuestionPlanReadiness = report.mathAllExactCellQuestionPlanReadiness ?? {};
  const providerRecoveryState = report.providerRecoveryState ?? {};
  const runtimeProcessAudit = report.runtimeProcessAudit ?? {};
  const coverage = mathScorecard.mathQuestionPlanSkeletonCoverage ?? {};
  const repairCoverage = report.mathCurrentHistoricalFailureRepairCoverage ?? {};
  const residualReviewerRouteReadiness = report.mathResidualReviewerRouteReadiness ?? {};
  const postfixEfficiencyGate = report.mathPostfixEfficiencyGate ?? {};
  const cellSummary = (cell) => ({
    cellId: cell.cellId ?? null,
    difficulty: cell.difficulty ?? null,
    schedulerPreferredFamily: cell.schedulerPreferredFamily ?? null,
    questionPlanTaskFamily: cell.questionPlanTaskFamily ?? null,
    questionPlanTemplate: cell.questionPlanTemplate ?? null,
    finalAnswerShape: cell.finalAnswerShape ?? null,
    exactObservationAttemptStatus: cell.exactObservationAttemptStatus ?? null,
    promptContractStatus: cell.promptContractStatus ?? null,
    promptContractMissingRequiredPhraseCount: cell.promptContractMissingRequiredPhraseCount ?? null,
    promptContractConflictResolution: cell.promptContractConflictResolution ?? null,
    promptContractPromptLengthTarget: cell.promptContractPromptLengthTarget ?? null,
    promptCharacterCount: cell.promptCharacterCount ?? null,
    promptCharacterBudget: cell.promptCharacterBudget ?? null,
    promptBudgetStatus: cell.promptBudgetStatus ?? null
  });
  return {
    mode: report.mode,
    status: report.status,
    goalCompletionStatus: report.goalCompletionStatus,
    nextStep: report.nextStep,
    productionImpact: report.productionImpact,
    actualRuntimeImpact: report.actualRuntimeImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    liveObservationSubmitted: report.liveObservationSubmitted,
    mathObservationPreflightStatus: report.mathObservationPreflightStatus,
    mathObservationReadyForFreshAuthorization: report.mathObservationReadyForFreshAuthorization,
    mathObservationLiveEligibleForFreshAuthorization: report.mathObservationLiveEligibleForFreshAuthorization,
    providerHardStopBeforeLive: report.providerHardStopBeforeLive,
    mathRecoveryDiagnosticsRequiredBeforeLive: report.mathRecoveryDiagnosticsRequiredBeforeLive,
    noLiveRecommendedBeforeRecovery: report.noLiveRecommendedBeforeRecovery,
    operationalWaitCodes: report.operationalWaitCodes,
    activeObservationTaskCount: report.activeObservationTaskCount,
    activeObservationJobCount: report.activeObservationJobCount,
    subjectPracticeNextActionStatus: report.subjectPracticeNextActionStatus,
    subjectPracticeNextActionRecommendedType: report.subjectPracticeNextActionRecommendedType,
    subjectPracticeThroughputEfficiencyStatus: report.subjectPracticeThroughputEfficiencyStatus,
    mathObservationOperatorCommands: report.mathObservationOperatorCommands ?? null,
    mathQuestionPlanRetryFeedbackCoverageStatus: report.mathQuestionPlanRetryFeedbackCoverageStatus,
    mathQuestionPlanRetryFeedbackCoverage: {
      policyFailureCodeCount: report.mathQuestionPlanRetryFeedbackCoverage?.policyFailureCodeCount ?? null,
      coveredFailureCodeCount: report.mathQuestionPlanRetryFeedbackCoverage?.coveredFailureCodeCount ?? null,
      missingFeedbackCodeCount: arrayFrom(report.mathQuestionPlanRetryFeedbackCoverage?.missingFeedbackCodes).length,
      genericQuestionPlanRetryVisible: report.mathQuestionPlanRetryFeedbackCoverage?.genericQuestionPlanRetryVisible ?? null
    },
    mathCurrentHistoricalFailureRepairCoverage: {
      status: repairCoverage.status ?? null,
      checkedHistoricalVerdictCount: repairCoverage.checkedHistoricalVerdictCount ?? null,
      coveredHistoricalVerdictCount: repairCoverage.coveredHistoricalVerdictCount ?? null,
      missingHistoricalVerdictCount: arrayFrom(repairCoverage.missingHistoricalVerdicts).length,
      alreadyMatchingPlanShapeVerdictCount: repairCoverage.alreadyMatchingPlanShapeVerdictCount ?? null,
      evidenceLimit: repairCoverage.evidenceLimit ?? null
    },
    mathResidualReviewerRouteReadiness: {
      status: residualReviewerRouteReadiness.status ?? null,
      residualRouteCellCount: residualReviewerRouteReadiness.residualRouteCellCount ?? null,
      exactPromptContractPassedCount: residualReviewerRouteReadiness.exactPromptContractPassedCount ?? null,
      issueCount: arrayFrom(residualReviewerRouteReadiness.issues).length,
      routeCounts: residualReviewerRouteReadiness.routeCounts ?? [],
      evidenceLimit: residualReviewerRouteReadiness.evidenceLimit ?? null
    },
    mathPostfixEfficiencyGate: {
      status: postfixEfficiencyGate.status ?? null,
      efficiencySatisfied: postfixEfficiencyGate.efficiencySatisfied ?? null,
      sampleCounts: postfixEfficiencyGate.sampleCounts ?? null,
      yields: postfixEfficiencyGate.yields ?? null,
      reasons: postfixEfficiencyGate.reasons ?? [],
      evidenceLimit: postfixEfficiencyGate.evidenceLimit ?? null
    },
    mathStageValidationEvidence: report.mathStageValidationEvidence ?? null,
    mathGuardedFamilySelection: report.mathGuardedFamilySelection ?? null,
    mathExactCellPreview: {
      status: mathExactCellPreview.status ?? null,
      selectedCellId: mathExactCellPreview.selectedCellId ?? null,
      selectedBlueprintId: mathExactCellPreview.selectedBlueprintId ?? null,
      questionPlanTemplate: mathExactCellPreview.questionPlanTemplate ?? null,
      questionPlanTaskFamily: mathExactCellPreview.questionPlanTaskFamily ?? null,
      exactObservationAttemptStatus: mathExactCellPreview.exactObservationAttemptStatus ?? null,
      promptContractPreview: mathExactCellPreview.promptContractPreview ?? null
    },
    mathScorecard: {
      status: mathScorecard.status ?? null,
      runStatus: mathScorecard.runStatus ?? null,
      blockedReason: mathScorecard.blockedReason ?? null,
      open: mathScorecard.open ?? null,
      generatedToApprovedYield: mathScorecard.generatedToApprovedYield ?? null,
      attemptToApprovedYield: mathScorecard.attemptToApprovedYield ?? null,
      deliveryIssueShareOfAttempts: mathScorecard.deliveryIssueShareOfAttempts ?? null,
      nextEfficiencyLever: mathScorecard.nextEfficiencyLever ?? null,
      postProviderRecoveryEfficiencyLever: mathScorecard.postProviderRecoveryEfficiencyLever ?? null,
      questionPlanOpenCount: mathScorecard.questionPlanOpenCount ?? null,
      reviewerValidatorOpenCount: mathScorecard.reviewerValidatorOpenCount ?? null,
      reviewerGateOrQuestionPlanOpenCount: mathScorecard.reviewerGateOrQuestionPlanOpenCount ?? null,
      mathQuestionPlanSkeletonCoverage: {
        status: coverage.status ?? null,
        openCellCount: coverage.openCellCount ?? null,
        coveredOpenCellCount: coverage.coveredOpenCellCount ?? null,
        missingSkeletonCellCount: coverage.missingSkeletonCellCount ?? null
      }
    },
    mathAllExactCellQuestionPlanReadiness: {
      status: mathAllExactCellQuestionPlanReadiness.status ?? null,
      runId: mathAllExactCellQuestionPlanReadiness.runId ?? null,
      totalCellCount: mathAllExactCellQuestionPlanReadiness.totalCellCount ?? null,
      planReadyCount: mathAllExactCellQuestionPlanReadiness.planReadyCount ?? null,
      compatibleSchedulerHintCount: mathAllExactCellQuestionPlanReadiness.compatibleSchedulerHintCount ?? null,
      promptContractPassedCount: mathAllExactCellQuestionPlanReadiness.promptContractPassedCount ?? null,
      promptContractMissingRequiredPhraseCount: mathAllExactCellQuestionPlanReadiness.promptContractMissingRequiredPhraseCount ?? null,
      promptContractIssueCount: mathAllExactCellQuestionPlanReadiness.promptContractIssueCount ?? null,
      promptBudgetCoverageCount: mathAllExactCellQuestionPlanReadiness.promptBudgetCoverageCount ?? null,
      promptBudgetPassedCount: mathAllExactCellQuestionPlanReadiness.promptBudgetPassedCount ?? null,
      promptBudgetExceededCount: mathAllExactCellQuestionPlanReadiness.promptBudgetExceededCount ?? null,
      maximumPromptCharacterCount: mathAllExactCellQuestionPlanReadiness.maximumPromptCharacterCount ?? null,
      rejectedSchedulerHintCount: mathAllExactCellQuestionPlanReadiness.rejectedSchedulerHintCount ?? null,
      fallbackIncompatibleCount: mathAllExactCellQuestionPlanReadiness.fallbackIncompatibleCount ?? null,
      issueCount: mathAllExactCellQuestionPlanReadiness.issueCount ?? null,
      normalDistributionCells: arrayFrom(mathAllExactCellQuestionPlanReadiness.normalDistributionCells).map(cellSummary),
      elementaryFunctionCells: arrayFrom(mathAllExactCellQuestionPlanReadiness.elementaryFunctionCells).map(cellSummary)
    },
    providerRecoveryState: {
      status: providerRecoveryState.status ?? null,
      hardStopActive: providerRecoveryState.hardStopActive ?? null,
      recoveredAfterHardStop: providerRecoveryState.recoveredAfterHardStop ?? null,
      latestHardStopAt: providerRecoveryState.latestHardStopAt ?? null,
      latestRecoverySuccessAt: providerRecoveryState.latestRecoverySuccessAt ?? null,
      errorCode: providerRecoveryState.errorCode ?? null,
      errorMessagePreview: providerRecoveryState.errorMessagePreview ?? null,
      nextSafeAction: providerRecoveryState.nextSafeAction ?? null
    },
    runtimeProcessAudit: {
      status: runtimeProcessAudit.status ?? null,
      checkStatus: runtimeProcessAudit.checkStatus ?? null,
      backendRunnerCount: runtimeProcessAudit.backendRunnerCount ?? null,
      duplicateOrMixedBackendRisk: runtimeProcessAudit.duplicateOrMixedBackendRisk ?? null,
      nextSafeAction: runtimeProcessAudit.nextSafeAction ?? null,
      inspectionError: runtimeProcessAudit.inspectionError ?? null
    },
    mathSingleRunReadiness: {
      status: report.mathSingleRunReadiness?.status ?? null,
      blockers: report.mathSingleRunReadiness?.blockers ?? [],
      readinessSignals: report.mathSingleRunReadiness?.readinessSignals ?? null,
      efficiencyBaseline: report.mathSingleRunReadiness?.efficiencyBaseline ?? null,
      nextSafeAction: report.mathSingleRunReadiness?.nextSafeAction ?? null,
      evidenceLimit: report.mathSingleRunReadiness?.evidenceLimit ?? null
    },
    completionSatisfied: report.completionSatisfied,
    completionAudit: arrayFrom(report.completionAudit).map((item) => ({
      requirement: item.requirement ?? null,
      status: item.status ?? null
    })),
    nextLiveValidation: {
      required: report.nextLiveValidation?.required ?? null,
      requiresFreshAuthorization: report.nextLiveValidation?.requiresFreshAuthorization ?? null,
      executionAllowed: report.nextLiveValidation?.executionAllowed ?? null,
      allowedScope: report.nextLiveValidation?.allowedScope ?? null,
      target: report.nextLiveValidation?.target ?? null,
      currentProtocolContinuationStatus: report.nextLiveValidation?.currentProtocolContinuationStatus ?? null,
      nextGuardedFamily: report.nextLiveValidation?.nextGuardedFamily ?? null
    },
    checks: arrayFrom(report.checks).map((check) => ({
      label: check.label ?? null,
      status: check.status ?? null,
      nextStep: check.nextStep ?? null
    }))
  };
}

function runObservationTaskRules() {
  const stdout = runNode([scriptPath('csca-subject-practice-observation-task-rules-test.cjs')], 'observation task rules');
  assert(stdout.includes('Subject-practice backend-owned observation task rules passed.'), 'Observation task rules did not report success.');
  return {
    label: 'observation_task_rules',
    status: 'passed',
    productionImpact: 'none_fixture_and_static_rules',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_static_and_fake_runtime_only'
  };
}

function runSubjectPracticeFixedEval() {
  const report = runNodeJson([scriptPath('csca-subject-practice-fixed-eval.cjs'), '--json'], 'subject-practice fixed eval');
  const checks = arrayFrom(report.checks);
  const taskFamilyCheck = checks.find((check) => check.label === 'task_family_fingerprint_fixed_eval') ?? {};
  const questionPlanCheck = checks.find((check) => check.label === 'question_plan_fixed_eval') ?? {};
  const profileCheck = checks.find((check) => check.label === 'profile_difficulty_patch_fixed_eval') ?? {};
  const questionPlanCheckLabels = new Set(arrayFrom(questionPlanCheck.checks).map((check) => cleanText(check.label)));
  const requiredQuestionPlanCheckLabels = [
    'math_question_plan_shadow',
    'physics_question_plan_shadow',
    'math_question_plan_calibration',
    'chemistry_current_question_plan_calibration',
    'chemistry_basic_ph_question_plan',
    'chemistry_question_plan_execution'
  ];
  assert(report.mode === 'subject_practice_fixed_eval', `Fixed eval mode drifted: ${report.mode}`);
  assert(report.status === 'passed', `Subject-practice fixed eval did not pass: ${report.status}`);
  assert(report.productionImpact === 'none_fixture_or_audit_only', `Fixed eval production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Fixed eval must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'none_fixture_only', `Fixed eval must remain DB-free, got ${report.dbImpact}`);
  assert(report.observationImpact === 'none_no_observation_task_submission', `Fixed eval observation impact drifted: ${report.observationImpact}`);
  assert(taskFamilyCheck.status === 'passed', 'Fixed eval must include a passing three-subject task-family/fingerprint eval.');
  assert(questionPlanCheck.status === 'passed', 'Fixed eval must include a passing QuestionPlan fixture eval.');
  for (const label of requiredQuestionPlanCheckLabels) {
    assert(questionPlanCheckLabels.has(label), `QuestionPlan fixture eval must include ${label}.`);
  }
  assert(profileCheck.status === 'passed', 'Fixed eval must include a passing profile difficulty patch fixture eval.');
  return {
    label: 'subject_practice_fixed_eval',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    observationImpact: report.observationImpact,
    taskFamilyFingerprint: taskFamilyCheck,
    questionPlan: questionPlanCheck,
    requiredQuestionPlanCheckLabels,
    profileDifficultyPatch: profileCheck
  };
}

function runMathQuestionPlanRetryFeedbackCoverage() {
  const policyPath = path.resolve(__dirname, '../backend/src/ai-questioning/subject-practice-question-plan-policy.ts');
  const servicePath = path.resolve(__dirname, '../backend/src/ai-questioning/ai-questioning.service.ts');
  const policySource = fs.readFileSync(policyPath, 'utf8');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');
  const mathFailureCodes = extractUniqueMatches(policySource, /candidate_plan_math_[a-z0-9_]+/g);
  const missingFeedbackCodes = mathFailureCodes.filter((code) => !serviceSource.includes(code));
  const hasGenericQuestionPlanRetry = serviceSource.includes('For math QuestionPlan retries, treat every candidate_plan_math_* reason code as a hard structural correction');
  return {
    label: 'math_question_plan_retry_feedback_coverage',
    status: missingFeedbackCodes.length === 0 && hasGenericQuestionPlanRetry ? 'passed' : 'needs_attention',
    productionImpact: 'none_static_source_coverage_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_static_source_only',
    policyFailureCodeCount: mathFailureCodes.length,
    coveredFailureCodeCount: mathFailureCodes.length - missingFeedbackCodes.length,
    missingFeedbackCodes,
    genericQuestionPlanRetryVisible: hasGenericQuestionPlanRetry,
    evidenceLimit: 'static coverage proves every current policy failure code can trigger retry feedback, not that future provider generations will pass'
  };
}

function runObservationPreflight(baseUrl, cellId = null) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-diversity-observation-preflight.cjs'),
    '--json',
    ...(cellId ? [`--cell=${cellId}`] : []),
    ...observationBaseUrlArgs(baseUrl)
  ], 'math observation preflight');
  const allowedStatuses = new Set([
    'eligible_for_backend_owned_observation_submission',
    'ready_after_observation_only_backend_start',
    'ready_after_observation_only_question_plan_backend_start',
    'ready_after_observation_question_plan_backend_start',
    'wait_for_existing_observation_or_math_work',
    'wait_for_provider_network_recovery',
    'wait_for_observation_cooldown',
    'failed'
  ]);
  assert(report.mode === 'read_only_preflight', `Preflight mode drifted: ${report.mode}`);
  assert(allowedStatuses.has(cleanText(report.status)), `Preflight status is not an accepted no-provider state: ${report.status}`);
  assert(report.providerFailurePolicy === 'excluded_from_diversity_quality_memory', `Preflight provider failure policy drifted: ${report.providerFailurePolicy}`);
  const runtimeState = report.runtimeState && typeof report.runtimeState === 'object' ? report.runtimeState : {};
  const observationAdmission = runtimeState.observationAdmission && typeof runtimeState.observationAdmission === 'object'
    ? runtimeState.observationAdmission
    : {};
  const backendReadiness = report.observationBackendReadiness && typeof report.observationBackendReadiness === 'object'
    ? report.observationBackendReadiness
    : {};
  const preflightEligible = report.status === 'eligible_for_backend_owned_observation_submission'
    && arrayFrom(report.failures).length === 0
    && arrayFrom(report.waitReasons).length === 0;
  const readyForSubmission = report.readyForSubmission === true
    || (preflightEligible
      && observationAdmission.taskEnabled === true
      && observationAdmission.singletonConfirmed === true
      && observationAdmission.observationOnlyMode === true);
  const readyForExecution = report.readyForExecution === true
    || (preflightEligible
      && observationAdmission.executionEnabled === true
      && observationAdmission.observationOnlyMode === true);
  assert(Object.prototype.hasOwnProperty.call(runtimeState, 'activeObservationTaskCount'), 'Preflight must expose activeObservationTaskCount.');
  assert(Object.prototype.hasOwnProperty.call(runtimeState, 'activeObservationJobCount'), 'Preflight must expose activeObservationJobCount.');
  return {
    label: 'math_observation_preflight',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_runtime_state',
    activeObservationTaskCount: Number(runtimeState.activeObservationTaskCount) || 0,
    activeObservationJobCount: Number(runtimeState.activeObservationJobCount) || 0,
    observationOnlyMode: observationAdmission.observationOnlyMode === true,
    backendReadinessLoaded: observationAdmission.backendReadinessLoaded === true || backendReadiness.loaded === true,
    backendReadinessSkipped: observationAdmission.backendReadinessSkipped === true || backendReadiness.source === 'target_backend_readiness_skipped',
    backendReadinessSource: observationAdmission.source ?? backendReadiness.source ?? null,
    backendReadinessError: observationAdmission.backendReadinessError ?? backendReadiness.error ?? null,
    questionPlanEnabled: observationAdmission.questionPlanEnabled === true || backendReadiness.questionPlanEnabled === true,
    questionPlanCellAllowed: backendReadiness.questionPlanCellAllowed === true,
    questionPlanReadyForTarget: backendReadiness.questionPlanReadyForTarget === true,
    questionPlanCellAllowlist: observationAdmission.questionPlanCellAllowlist ?? backendReadiness.questionPlanCellAllowlist ?? null,
    targetProductionCellId: backendReadiness.productionCellId ?? (cellId ? String(cellId) : null),
    readyForSubmission,
    readyForExecution,
    warnings: arrayFrom(report.warnings),
    waitReasons: arrayFrom(report.waitReasons)
  };
}

function runObservationEvidence() {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-observation-evidence.cjs'),
    '--json',
    '--allow-missing-latest-task'
  ], 'math observation evidence');
  assert(report.mode === 'read_only_observation_evidence', `Observation evidence mode drifted: ${report.mode}`);
  const providerFailuresAreDeliveryEvidenceOnly = report.providerFailuresAreDeliveryEvidenceOnly === true
    || report.interpretation?.providerFailuresAreDeliveryEvidenceOnly === true;
  const studentConsumableNotProvenByThisReport = report.studentConsumableNotProvenByThisReport === true
    || report.interpretation?.studentConsumableNotProvenByThisReport === true;
  assert(providerFailuresAreDeliveryEvidenceOnly, 'Observation evidence must keep provider failures as delivery evidence only.');
  assert(studentConsumableNotProvenByThisReport, 'Observation evidence must not claim student-consumable quality.');
  if (report.status === 'skipped_no_observation_task') {
    assert(report.providerImpact === 'none_no_provider_call', `Skipped observation evidence must remain no-provider, got ${report.providerImpact}`);
    return {
      label: 'math_observation_evidence',
      status: report.status,
      productionImpact: report.productionImpact,
      providerImpact: report.providerImpact,
      dbImpact: report.dbImpact,
      liveObservationSubmitted: false,
      mathPublishableEvidence: 'missing_no_observation_task'
    };
  }
  const isolation = report.isolation && typeof report.isolation === 'object' ? report.isolation : {};
  const latestChemistryRun = isolation.latestChemistryRun && typeof isolation.latestChemistryRun === 'object'
    ? isolation.latestChemistryRun
    : {};
  const taskStatus = report.task?.status ?? null;
  const gateDecision = report.question?.gateDecision ?? report.task?.result?.gateDecision ?? null;
  const deliveryFailure = report.interpretation?.deliveryFailure ?? report.task?.result?.deliveryFailure ?? null;
  const schedulerAdherenceStatus = report.task?.result?.schedulerAdherence?.status ?? report.generationJob?.schedulerHintAdherence?.status ?? null;
  const gatewayBinding = report.gatewayCandidateLogs?.binding ?? null;
  const observationJobCountForTask = Number(report.uniqueness?.observationJobCountForTask) || 0;
  const oneObservationJobForTask = report.uniqueness?.oneObservationJobForTask === true;
  const completedAt = report.task?.completedAt ?? report.task?.updatedAt ?? null;
  const hasFreshPublishableGateEvidence = taskStatus === 'succeeded'
    && gateDecision === 'publishable'
    && !deliveryFailure
    && Number(report.question?.id) > 0
    && oneObservationJobForTask
    && Boolean(gatewayBinding)
    && Boolean(schedulerAdherenceStatus)
    && isRecentIsoTimestamp(completedAt, 24 * 60 * 60 * 1000);
  assert(Object.prototype.hasOwnProperty.call(isolation, 'activeObservationTaskCount'), 'Observation evidence must expose activeObservationTaskCount.');
  assert(Object.prototype.hasOwnProperty.call(isolation, 'activeObservationJobCount'), 'Observation evidence must expose activeObservationJobCount.');
  return {
    label: 'math_observation_evidence',
    status: 'observed_latest_task',
    taskId: report.taskId ?? null,
    taskStatus,
    generationJobId: report.generationJob?.id ?? null,
    generatedQuestionId: report.question?.id ?? null,
    productionRunId: Number(report.task?.productionRunId) || null,
    productionCellId: Number(report.task?.productionCellId) || null,
    gateDecision,
    deliveryFailure,
    schedulerAdherenceStatus,
    gatewayBinding,
    observationJobCountForTask,
    oneObservationJobForTask,
    completedAt,
    latestChemistryRunId: latestChemistryRun.id ?? null,
    latestChemistryRunStatus: latestChemistryRun.status ?? null,
    latestChemistryRunPublished: Number(latestChemistryRun.published) || 0,
    latestChemistryRunOpen: Number(latestChemistryRun.open) || 0,
    latestChemistryRunBlockedReason: latestChemistryRun.blockedReason ?? null,
    productionImpact: 'none_read_only_evidence',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_observation_evidence',
    activeObservationTaskCount: Number(isolation.activeObservationTaskCount) || 0,
    activeObservationJobCount: Number(isolation.activeObservationJobCount) || 0,
    liveObservationSubmitted: false,
    mathPublishableEvidence: hasFreshPublishableGateEvidence
      ? 'fresh_live_publishable_gate_pass'
      : 'not_proven_by_observation_evidence'
  };
}

function runRolloutGate(baseUrl, mathRunId = 'latest') {
  if (baseUrl) process.env.CSCA_OBSERVATION_BASE_URL = baseUrl;
  const report = runNodeJson([
    scriptPath('csca-subject-practice-diversity-rollout-gate.cjs'),
    '--json',
    `--math-run=${mathRunId}`
  ], 'subject diversity rollout gate');
  assert(report.mode === 'read_only_rollout_gate', `Rollout gate mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_audit_only', `Rollout gate production impact drifted: ${report.productionImpact}`);
  assert(report.providerFailurePolicy === 'excluded_from_diversity_quality_memory', `Rollout gate provider failure policy drifted: ${report.providerFailurePolicy}`);
  return {
    label: 'subject_diversity_rollout_gate',
    status: report.status,
    nextStep: report.nextStep ?? null,
    productionImpact: report.productionImpact,
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_audit_state',
    waitCodes: arrayFrom(report.waits).map((wait) => wait.code).filter(Boolean),
    failures: arrayFrom(report.failures),
    childExitStatus: report.childExitStatus ?? null
  };
}

function runSubjectPracticeNextAction(subject = 'math', runId = 'latest', observationCellId = null) {
  const normalizedSubject = cleanText(subject).toLowerCase() || 'math';
  const report = runNodeJson([
    scriptPath('csca-subject-practice-next-action.cjs'),
    `--subject=${normalizedSubject}`,
    `--run=${runId}`,
    ...(normalizedSubject === 'math' && Number(observationCellId) > 0
      ? [`--observation-cell=${Number(observationCellId)}`]
      : []),
    '--json'
  ], 'subject practice next action');
  const decisionStatus = cleanText(report.decision?.status);
  const recommendedType = cleanText(report.decision?.recommended?.type);
  const throughputStatus = cleanText(report.throughputEfficiency?.status);
  const capacityFillStatus = cleanText(report.capacityFillOpportunity?.status);
  const allowedDecisionStatuses = new Set([
    'live_job_ready_for_preview_and_explicit_authorization',
    'provider_delivery_backoff_before_live_job',
    'provider_hard_stop_before_live_or_enqueue',
    'math_stage_validated_select_next_guarded_family',
    'math_recovery_diagnostics_required_before_live_or_enqueue',
    'enqueue_ready_for_explicit_authorization',
    'wait_for_existing_active_jobs_or_process_exact_job',
    'no_safe_next_action_ready'
  ]);
  const allowedRecommendationTypes = new Set([
    '',
    'live_existing_queued_job',
    'wait_or_switch_provider_before_live_existing_queued_job',
    'read_only_math_guarded_family_selection',
    'read_only_math_recovery_diagnostics',
    'enqueue_one_exact_cell_job'
  ]);
  const allowedThroughputStatuses = new Set([
    'acceptable',
    'acceptable_with_operator_actions',
    'acceptable_with_bounded_stage_evidence',
    'closed_or_no_open_work',
    'below_acceptable_efficiency'
  ]);
  const allowedCapacityFillStatuses = new Set([
    '',
    'capacity_fill_enqueue_ready_for_explicit_authorization',
    'no_capacity_fill_provider_hard_stop',
    'no_capacity_fill_slot_available',
    'no_capacity_fill_enqueue_ready'
  ]);
  assert(report.mode === 'subject_practice_next_action_preview', `Next-action mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_read_only_next_action_preview', `Next-action production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Next-action must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only', `Next-action DB impact drifted: ${report.dbImpact}`);
  assert(report.throughputEfficiency?.mode === 'audit_only_next_action_throughput_efficiency', `Next-action throughput mode drifted: ${report.throughputEfficiency?.mode}`);
  assert(report.actionQueue?.mode === 'ordered_subject_practice_next_action_queue', `Next-action queue mode drifted: ${report.actionQueue?.mode}`);
  assert(report.actionQueue?.productionImpact === 'none_read_only_action_queue', `Next-action queue production impact drifted: ${report.actionQueue?.productionImpact}`);
  assert(report.actionQueue?.providerImpact === 'none_no_provider_call', `Next-action queue must remain no-provider, got ${report.actionQueue?.providerImpact}`);
  assert(report.actionQueue?.dbImpact === 'read_only', `Next-action queue DB impact drifted: ${report.actionQueue?.dbImpact}`);
  assert(arrayFrom(report.actionQueue?.items).some((item) => cleanText(item.role) === 'primary_next_action'), 'Next-action queue must include a primary action item.');
  assert(allowedThroughputStatuses.has(throughputStatus), `Next-action throughput status is not acceptable for no-provider readiness: ${throughputStatus}`);
  assert(allowedDecisionStatuses.has(decisionStatus), `Next-action decision is not an accepted no-provider state: ${decisionStatus}`);
  assert(allowedRecommendationTypes.has(recommendedType), `Next-action recommendation type is not accepted: ${recommendedType}`);
  assert(allowedCapacityFillStatuses.has(capacityFillStatus), `Next-action capacity-fill status is not accepted: ${capacityFillStatus}`);
  assert(report.decision && typeof report.decision === 'object', 'Next-action must expose a machine-readable decision.');
  assert(report.dispatchCapacity && typeof report.dispatchCapacity === 'object', 'Next-action must expose dispatch capacity.');
  assert(report.providerBackoff && typeof report.providerBackoff === 'object', 'Next-action must expose Provider backoff state.');
  const status = throughputStatus === 'below_acceptable_efficiency'
    ? 'needs_attention'
    : 'passed';
  return {
    label: 'subject_practice_next_action_throughput',
    status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    target: {
      subject: report.subject ?? normalizedSubject,
      productionRunId: report.productionRunId ?? runId
    },
    decisionStatus,
    recommendedType: recommendedType || null,
    recommended: report.decision?.recommended ?? null,
    operatorCommands: report.decision?.operatorCommands ?? null,
    explicitAuthorizationRequired: report.decision?.explicitAuthorizationRequired ?? null,
    capacityFillStatus: capacityFillStatus || null,
    capacityFillRecommended: report.capacityFillOpportunity?.recommended ?? null,
    capacityFillOperatorCommands: report.capacityFillOpportunity?.operatorCommands ?? null,
    capacityFillExplicitAuthorizationRequired: report.capacityFillOpportunity?.explicitAuthorizationRequired ?? null,
    actionQueue: report.actionQueue ?? null,
    throughputEfficiency: report.throughputEfficiency,
    dispatchCapacity: report.dispatchCapacity,
    providerBackoff: report.providerBackoff,
    providerConfig: report.providerConfig ?? null
  };
}

function runProviderRecoveryState() {
  const report = runNodeJson([
    scriptPath('csca-ai-gateway-provider-recovery-state.cjs'),
    '--json'
  ], 'provider recovery state');
  assert(report.mode === 'ai_gateway_provider_recovery_state', `Provider recovery state mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_read_only_provider_recovery_state', `Provider recovery state production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Provider recovery state must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_ai_gateway_call_logs', `Provider recovery state DB impact drifted: ${report.dbImpact}`);
  assert(report.studentConsumableImpact === 'none', `Provider recovery state student impact drifted: ${report.studentConsumableImpact}`);
  return {
    label: 'provider_recovery_state',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    hardStopActive: report.hardStop?.active === true,
    recoveredAfterHardStop: report.hardStop?.recoveredAfterHardStop === true,
    latestHardStopAt: report.hardStop?.latestHardStopAt ?? null,
    latestRecoverySuccessAt: report.hardStop?.latestRecoverySuccessAt ?? null,
    errorCode: report.hardStop?.errorCode ?? null,
    errorMessagePreview: report.hardStop?.errorMessagePreview ?? null,
    latestRecoveryProbeCount: arrayFrom(report.latestRecoveryProbeRecords).length,
    nextSafeAction: report.nextSafeAction ?? null
  };
}

function runSubjectPracticeMathScorecard(runId = 156) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-quality-scorecard.cjs'),
    '--subjects=math',
    `--math-run=${runId}`,
    '--sample=80',
    '--skip-profile-replay',
    '--summary-only',
    '--json'
  ], 'subject practice math quality scorecard');
  assert(report.mode === 'subject_practice_quality_scorecard', `Math scorecard mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_audit_only', `Math scorecard production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Math scorecard must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_audit_state', `Math scorecard DB impact drifted: ${report.dbImpact}`);
  const summary = arrayFrom(report.summary).find((item) => cleanText(item.subject) === 'math') ?? {};
  const subject = arrayFrom(report.subjects).find((item) => cleanText(item.subject) === 'math') ?? {};
  const throughputEfficiency = summary.throughputEfficiency && typeof summary.throughputEfficiency === 'object'
    ? summary.throughputEfficiency
    : {};
  const postProviderRecoveryEfficiencyLever = throughputEfficiency.postProviderRecoveryEfficiencyLever
    && typeof throughputEfficiency.postProviderRecoveryEfficiencyLever === 'object'
    ? throughputEfficiency.postProviderRecoveryEfficiencyLever
    : null;
  const mathQuestionPlanSkeletonCoverage = subject.mathQuestionPlanSkeletonCoverage
    && typeof subject.mathQuestionPlanSkeletonCoverage === 'object'
    ? subject.mathQuestionPlanSkeletonCoverage
    : summary.mathQuestionPlanSkeletonCoverage && typeof summary.mathQuestionPlanSkeletonCoverage === 'object'
      ? summary.mathQuestionPlanSkeletonCoverage
      : null;
  return {
    label: 'subject_practice_math_scorecard',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    runStatus: summary.runStatus ?? null,
    blockedReason: summary.blockedReason ?? null,
    open: summary.reconciledOpen ?? null,
    generatedToApprovedYield: summary.generatedToApprovedYield ?? null,
    attemptToApprovedYield: summary.attemptToApprovedYield ?? null,
    deliveryIssueShareOfAttempts: throughputEfficiency.deliveryIssueShareOfAttempts ?? null,
    nextEfficiencyLever: throughputEfficiency.nextEfficiencyLever ?? null,
    postProviderRecoveryEfficiencyLever,
    attention: arrayFrom(summary.attention),
    questionPlanOpenCount: summary.closureOpportunities?.questionPlanOpenCount ?? null,
    reviewerValidatorOpenCount: summary.closureOpportunities?.reviewerValidatorOpenCount ?? null,
    reviewerGateOrQuestionPlanOpenCount: summary.closureOpportunities?.reviewerGateOrQuestionPlanOpenCount ?? null,
    mathQuestionPlanSkeletonCoverage,
    questionPlanVisibility: summary.questionPlanVisibility ?? null
  };
}

function runMathExactCellPreview(runId = 156) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-exact-cell-enqueue.cjs'),
    '--subject=math',
    `--run=${runId}`,
    '--include-prompt-contract',
    '--json'
  ], 'math exact cell enqueue preview');
  assert(report.mode === 'exact_subject_practice_cell_enqueue_preview', `Exact-cell preview mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_preview_only', `Exact-cell preview production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Exact-cell preview must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_preview', `Exact-cell preview DB impact drifted: ${report.dbImpact}`);
  const selectedCellId = Number(report.selection?.selectedCellId) || null;
  const selectedBlueprintId = Number(report.selection?.selectedBlueprintId) || null;
  assert(selectedCellId, 'Exact-cell preview must expose the next math observation cell.');
  assert(selectedBlueprintId, 'Exact-cell preview must expose the next math observation blueprint.');
  const questionPlanPreview = report.questionPlanPreview && typeof report.questionPlanPreview === 'object'
    ? report.questionPlanPreview
    : null;
  assert(questionPlanPreview, 'Exact-cell preview must expose the no-provider questionPlanPreview evidence.');
  assert(questionPlanPreview.providerImpact === 'none_no_provider_call', `QuestionPlan preview must remain no-provider, got ${questionPlanPreview.providerImpact}`);
  assert(questionPlanPreview.dbImpact === 'read_only_preview', `QuestionPlan preview DB impact drifted: ${questionPlanPreview.dbImpact}`);
  const questionPlan = questionPlanPreview.questionPlan && typeof questionPlanPreview.questionPlan === 'object'
    ? questionPlanPreview.questionPlan
    : {};
  const exactObservationGate = questionPlanPreview.exactObservationGate && typeof questionPlanPreview.exactObservationGate === 'object'
    ? questionPlanPreview.exactObservationGate
    : {};
  const exactObservationAttempt = questionPlanPreview.exactObservationAttempt && typeof questionPlanPreview.exactObservationAttempt === 'object'
    ? questionPlanPreview.exactObservationAttempt
    : {};
  const promptContractPreview = report.promptContractPreview && typeof report.promptContractPreview === 'object'
    ? report.promptContractPreview
    : null;
  if (selectedCellId === 338) {
    assert(questionPlan.planTemplate === 'math_vector_complex_relation_v1', `Math #338 QuestionPlan template drifted: ${questionPlan.planTemplate}`);
    assert(exactObservationGate.mode === 'plan_required', `Math #338 exact observation gate must require a plan, got ${exactObservationGate.mode}`);
    assert(exactObservationGate.generationAllowed === true, 'Math #338 exact observation gate must allow generation with the scaffolded plan.');
    assert(exactObservationAttempt.status === 'plan_ready', `Math #338 exact observation attempt must be plan_ready, got ${exactObservationAttempt.status}`);
    assert(promptContractPreview?.status === 'passed', `Math #338 prompt contract preview must pass, got ${promptContractPreview?.status}`);
    assert(promptContractPreview?.userPayloadHasQuestionPlan === true, 'Math #338 prompt contract preview must carry questionPlan in provider payload.');
    assert(arrayFrom(promptContractPreview?.missingRequiredPhrases).length === 0, 'Math #338 prompt contract preview must include all required vector/complex constraint phrases.');
  }
  return {
    label: 'math_exact_cell_enqueue_preview',
    status: 'passed',
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    runStatus: report.requested?.runStatus ?? null,
    selectedCellId,
    selectedBlueprintId,
    rationale: report.selection?.rationale ?? null,
    preflightStatus: report.preflight?.status ?? null,
    preflightFailures: arrayFrom(report.preflight?.failures),
    questionPlanPreviewSource: questionPlanPreview.source ?? null,
    schedulerHint: questionPlanPreview.schedulerHint ?? null,
    questionPlanTemplate: questionPlan.planTemplate ?? null,
    questionPlanTaskFamily: questionPlan.taskFamily ?? null,
    exactObservationGateMode: exactObservationGate.mode ?? null,
    exactObservationGateAllowed: exactObservationGate.generationAllowed ?? null,
    exactObservationAttemptStatus: exactObservationAttempt.status ?? null,
    promptContractPreview: promptContractPreview ? {
      status: promptContractPreview.status ?? null,
      userPayloadHasQuestionPlan: promptContractPreview.userPayloadHasQuestionPlan ?? null,
      userPayloadQuestionPlanTaskFamily: promptContractPreview.userPayloadQuestionPlanTaskFamily ?? null,
      userPayloadQuestionPlanTemplate: promptContractPreview.userPayloadQuestionPlanTemplate ?? null,
      conflictResolution: promptContractPreview.conflictResolution ?? null,
      promptLengthTarget: promptContractPreview.promptLengthTarget ?? null,
      missingRequiredPhraseCount: arrayFrom(promptContractPreview.missingRequiredPhrases).length
    } : null
  };
}

function runMathAllExactCellPreviewReadiness(runId = 156) {
  const rows = mathExactPreviewCellIds(runId).map((cellId) => {
    const report = runNodeJson([
      scriptPath('csca-subject-practice-exact-cell-enqueue.cjs'),
      '--subject=math',
      `--run=${runId}`,
      `--cell=${cellId}`,
      '--include-prompt-contract',
      '--json'
    ], `math exact cell ${cellId} enqueue preview`);
    assert(report.mode === 'exact_subject_practice_cell_enqueue_preview', `Exact-cell #${cellId} preview mode drifted: ${report.mode}`);
    assert(report.productionImpact === 'none_preview_only', `Exact-cell #${cellId} preview production impact drifted: ${report.productionImpact}`);
    assert(report.providerImpact === 'none_no_provider_call', `Exact-cell #${cellId} preview must remain no-provider, got ${report.providerImpact}`);
    assert(report.dbImpact === 'read_only_preview', `Exact-cell #${cellId} preview DB impact drifted: ${report.dbImpact}`);
    const questionPlanPreview = report.questionPlanPreview && typeof report.questionPlanPreview === 'object'
      ? report.questionPlanPreview
      : {};
    const questionPlan = questionPlanPreview.questionPlan && typeof questionPlanPreview.questionPlan === 'object'
      ? questionPlanPreview.questionPlan
      : {};
    const exactObservationGate = questionPlanPreview.exactObservationGate && typeof questionPlanPreview.exactObservationGate === 'object'
      ? questionPlanPreview.exactObservationGate
      : {};
    const exactObservationAttempt = questionPlanPreview.exactObservationAttempt && typeof questionPlanPreview.exactObservationAttempt === 'object'
      ? questionPlanPreview.exactObservationAttempt
      : {};
    const promptContractPreview = report.promptContractPreview && typeof report.promptContractPreview === 'object'
      ? report.promptContractPreview
      : {};
    return {
      cellId,
      topicTitle: report.selection?.consideredCells?.[0]?.topicTitle ?? null,
      difficulty: report.selection?.consideredCells?.[0]?.difficultyBand ?? null,
      source: questionPlanPreview.source ?? null,
      schedulerPreferredFamily: questionPlanPreview.schedulerHint?.preferredFamily ?? null,
      rejectedSchedulerHint: questionPlanPreview.rejectedSchedulerHint ?? null,
      questionPlanTaskFamily: questionPlan.taskFamily ?? null,
      questionPlanTemplate: questionPlan.planTemplate ?? null,
      finalAnswerShape: questionPlan.renderConstraints?.finalAnswerShape ?? null,
      exactObservationGateMode: exactObservationGate.mode ?? null,
      exactObservationGateAllowed: exactObservationGate.generationAllowed ?? null,
      exactObservationGateReasonCodes: arrayFrom(exactObservationGate.reasonCodes),
      exactObservationAttemptStatus: exactObservationAttempt.status ?? null,
      promptContractStatus: promptContractPreview.status ?? null,
      promptContractHasQuestionPlan: promptContractPreview.userPayloadHasQuestionPlan === true,
      promptContractQuestionPlanTemplate: promptContractPreview.userPayloadQuestionPlanTemplate ?? null,
      promptContractQuestionPlanTaskFamily: promptContractPreview.userPayloadQuestionPlanTaskFamily ?? null,
      promptContractMissingRequiredPhraseCount: arrayFrom(promptContractPreview.missingRequiredPhrases).length,
      promptContractMissingRequiredPhrases: arrayFrom(promptContractPreview.missingRequiredPhrases),
      promptContractConflictResolution: promptContractPreview.conflictResolution ?? null,
      promptContractPromptLengthTarget: promptContractPreview.promptLengthTarget ?? null,
      promptCharacterCount: Number(promptContractPreview.totalPromptCharacters) || null,
      promptCharacterBudget: Number(promptContractPreview.promptCharacterBudget) || null,
      promptBudgetStatus: promptContractPreview.promptBudgetStatus ?? null
    };
  });
  const issues = rows.filter((row) => {
    return row.exactObservationAttemptStatus !== 'plan_ready'
      || row.exactObservationGateAllowed !== true
      || row.source === 'policy_template_fallback_incompatible_scheduler_hint'
      || Boolean(row.rejectedSchedulerHint)
      || !row.schedulerPreferredFamily
      || arrayFrom(row.exactObservationGateReasonCodes).length > 0
      || row.promptContractStatus !== 'passed'
      || row.promptContractHasQuestionPlan !== true
      || Number(row.promptContractMissingRequiredPhraseCount) !== 0
      || !Number(row.promptCharacterBudget)
      || row.promptBudgetStatus !== 'passed';
  });
  assert(issues.length === 0, `Math all-cell exact preview readiness has ${issues.length} issue(s): ${JSON.stringify(issues.slice(0, 5))}`);
  return {
    label: 'math_all_exact_cell_question_plan_readiness',
    status: 'passed',
    productionImpact: 'none_read_only_preview',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_exact_cell_previews',
    runId,
    totalCellCount: rows.length,
    planReadyCount: rows.filter((row) => row.exactObservationAttemptStatus === 'plan_ready').length,
    compatibleSchedulerHintCount: rows.filter((row) => Boolean(row.schedulerPreferredFamily) && !row.rejectedSchedulerHint).length,
    promptContractPassedCount: rows.filter((row) => row.promptContractStatus === 'passed' && row.promptContractHasQuestionPlan === true).length,
    promptContractMissingRequiredPhraseCount: rows.reduce((sum, row) => sum + (Number(row.promptContractMissingRequiredPhraseCount) || 0), 0),
    promptContractIssueCount: rows.filter((row) => row.promptContractStatus !== 'passed' || row.promptContractHasQuestionPlan !== true || Number(row.promptContractMissingRequiredPhraseCount) !== 0).length,
    promptBudgetCoverageCount: rows.filter((row) => Number(row.promptCharacterBudget) > 0).length,
    promptBudgetPassedCount: rows.filter((row) => row.promptBudgetStatus === 'passed').length,
    promptBudgetExceededCount: rows.filter((row) => row.promptBudgetStatus === 'exceeded').length,
    maximumPromptCharacterCount: Math.max(0, ...rows.map((row) => Number(row.promptCharacterCount) || 0)),
    rejectedSchedulerHintCount: rows.filter((row) => Boolean(row.rejectedSchedulerHint)).length,
    fallbackIncompatibleCount: rows.filter((row) => row.source === 'policy_template_fallback_incompatible_scheduler_hint').length,
    issueCount: issues.length,
    issues,
    cells: rows,
    normalDistributionCells: rows.filter((row) => cleanText(row.topicTitle) === '正态分布的基本概念'),
    elementaryFunctionCells: rows.filter((row) => cleanText(row.topicTitle) === '基本初等函数')
  };
}

function runMathBasicFunctionExactPromptContract(runId = 1, cellId = 13) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-exact-cell-enqueue.cjs'),
    '--subject=math',
    `--run=${runId}`,
    `--cell=${cellId}`,
    '--include-prompt-contract',
    '--json'
  ], `math basic-function exact cell ${cellId} prompt contract preview`);
  assert(report.mode === 'exact_subject_practice_cell_enqueue_preview', `Math basic-function cell #${cellId} preview mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_preview_only', `Math basic-function cell #${cellId} preview production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Math basic-function cell #${cellId} preview must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_preview', `Math basic-function cell #${cellId} preview DB impact drifted: ${report.dbImpact}`);
  const questionPlanPreview = recordFrom(report.questionPlanPreview);
  const questionPlan = recordFrom(questionPlanPreview.questionPlan);
  const exactObservationGate = recordFrom(questionPlanPreview.exactObservationGate);
  const exactObservationAttempt = recordFrom(questionPlanPreview.exactObservationAttempt);
  const promptContractPreview = recordFrom(report.promptContractPreview);
  const requiredPhrases = arrayFrom(promptContractPreview.requiredPhrases);
  const expectedRequiredPhrases = [
    'treat one property rule plus one short option check as the reasoning path',
    'do not introduce two named points, a parameter point P(a,b), or a solve-for-parameter step'
  ];
  const conflictResolution = cleanText(promptContractPreview.conflictResolution);
  const issues = uniqueStrings([
    ...(Number(report.selection?.selectedCellId) === cellId ? [] : ['selected_cell_mismatch']),
    ...(questionPlan.planTemplate === 'math_function_property_by_difficulty_v1' ? [] : ['question_plan_template_mismatch']),
    ...(questionPlan.taskFamily === 'quadratic_function_properties' ? [] : ['question_plan_task_family_mismatch']),
    ...(exactObservationGate.mode === 'plan_required' ? [] : ['exact_observation_gate_not_plan_required']),
    ...(exactObservationGate.generationAllowed === true ? [] : ['exact_observation_gate_not_allowed']),
    ...(exactObservationAttempt.status === 'plan_ready' ? [] : ['exact_observation_attempt_not_plan_ready']),
    ...(promptContractPreview.status === 'passed' ? [] : ['prompt_contract_not_passed']),
    ...(promptContractPreview.userPayloadHasQuestionPlan === true ? [] : ['provider_payload_question_plan_missing']),
    ...(arrayFrom(promptContractPreview.missingRequiredPhrases).length === 0 ? [] : ['required_prompt_phrase_missing']),
    ...(expectedRequiredPhrases.every((phrase) => requiredPhrases.includes(phrase)) ? [] : ['basic_function_single_target_phrases_not_required']),
    ...(conflictResolution.includes('multi_step_reasoning complexity') ? [] : ['target_profile_conflict_resolution_missing'])
  ]);
  assert(issues.length === 0, `Math basic-function exact prompt contract has issue(s): ${issues.join(', ')}`);
  return {
    label: 'math_basic_function_exact_prompt_contract',
    status: 'passed',
    productionImpact: 'none_read_only_preview',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_exact_cell_preview',
    runId,
    cellId,
    questionPlanTemplate: questionPlan.planTemplate ?? null,
    questionPlanTaskFamily: questionPlan.taskFamily ?? null,
    exactObservationGateMode: exactObservationGate.mode ?? null,
    exactObservationGateAllowed: exactObservationGate.generationAllowed ?? null,
    exactObservationAttemptStatus: exactObservationAttempt.status ?? null,
    promptContractStatus: promptContractPreview.status ?? null,
    promptContractHasQuestionPlan: promptContractPreview.userPayloadHasQuestionPlan === true,
    promptContractMissingRequiredPhraseCount: arrayFrom(promptContractPreview.missingRequiredPhrases).length,
    requiredSingleTargetPhrasesPresent: expectedRequiredPhrases.every((phrase) => requiredPhrases.includes(phrase)),
    conflictResolution,
    issues
  };
}

function runBoundedMathFamilyValidationSelfTest() {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-math-bounded-family-validation.cjs'),
    '--self-test',
    '--json'
  ], 'bounded math-family validation self-test');
  assert(report.mode === 'math_bounded_family_validation_self_test', `Bounded math-family validation self-test mode drifted: ${report.mode}`);
  assert(report.status === 'passed', `Bounded math-family validation self-test did not pass: ${report.status}`);
  assert(report.providerImpact === 'none_no_provider_call', `Bounded math-family validation self-test must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'none_no_database_connection', `Bounded math-family validation self-test must remain DB-free, got ${report.dbImpact}`);
  assert(Number(report.caseCount) >= 12, `Bounded math-family validation self-test coverage is incomplete: ${report.caseCount}`);
  return {
    label: 'math_bounded_family_validation_self_test',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    caseCount: Number(report.caseCount)
  };
}

function runMathCurrentHistoricalFailureRepairCoverage(mathScorecard, mathAllExactCellReadiness) {
  const promptBuilderSource = fs.readFileSync(
    path.resolve(__dirname, '../backend/src/ai-questioning/question-prompt-builder.service.ts'),
    'utf8'
  );
  const exactCellSource = fs.readFileSync(
    path.resolve(__dirname, 'csca-subject-practice-exact-cell-enqueue.cjs'),
    'utf8'
  );
  const combinedSource = `${promptBuilderSource}\n${exactCellSource}`;
  const verdictCounts = arrayFrom(mathScorecard.questionPlanVisibility?.math?.verdictCounts)
    .map((item) => ({
      verdict: cleanText(item.verdict),
      count: Number(item.count) || 0
    }))
    .filter((item) => item.verdict && item.count > 0);
  const cells = arrayFrom(mathAllExactCellReadiness.cells);
  const cellMatches = (predicate) => cells.filter((cell) => (
    predicate(cell)
      && cell.exactObservationAttemptStatus === 'plan_ready'
      && cell.exactObservationGateAllowed === true
      && cell.promptContractStatus === 'passed'
      && cell.promptContractHasQuestionPlan === true
      && Number(cell.promptContractMissingRequiredPhraseCount) === 0
  ));
  const repairSpecs = [
    {
      verdict: 'needs_basic_probability_concept_only_repair',
      sourcePhrases: [
        'For basic probability, do not obey targetProfile',
        'one visible favorable-count/probability relation'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_probability_counting_relation_v1' && cell.difficulty === 'basic'
    },
    {
      verdict: 'needs_basic_derivative_complexity_repair',
      sourcePhrases: [
        'For basic derivative, do not obey targetProfile high-reading',
        'one visible derivative value, tangent slope'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_derivative_condition_chain_v1' && cell.difficulty === 'basic'
    },
    {
      verdict: 'needs_medium_derivative_definition_only_repair',
      sourcePhrases: [
        'For medium derivative plans, do not write definition-only differentiability',
        'exactly two visible derivative-linked moves'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_derivative_condition_chain_v1' && cell.difficulty === 'medium'
    },
    {
      verdict: 'needs_basic_sequence_generic_classification_repair',
      sourcePhrases: [
        'For basic sequence plans, do not obey targetProfile concept_check',
        'one visible sequence model'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_sequence_condition_relation_v1' && cell.difficulty === 'basic'
    },
    {
      verdict: 'needs_hard_spatial_concept_only_repair',
      sourcePhrases: [
        'For hard spatial-geometry plans, require a second visible line/plane/vector/angle/distance/volume/parameter relation',
        'generic position-relation concept statement'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_spatial_geometry_relation_v1' && cell.difficulty === 'hard'
    },
    {
      verdict: 'needs_pure_function_external_context_repair',
      sourcePhrases: [
        'do not add real-world contexts',
        'do not use real-world wrappers'
      ],
      matchCell: (cell) => [
        'math_function_property_by_difficulty_v1',
        'math_elementary_function_relation_v1'
      ].includes(cell.questionPlanTemplate)
    },
    {
      verdict: 'needs_medium_function_complexity_calibration',
      sourcePhrases: [
        'For math_medium_function_two_move_reasoning_v1 medium',
        'require exactly two visible moves'
      ],
      matchCell: (cell) => cell.questionPlanTemplate === 'math_function_property_by_difficulty_v1'
        || (cell.questionPlanTemplate === 'math_elementary_function_relation_v1' && cell.difficulty === 'medium')
    }
  ];
  const matchingPlanShapeVerdicts = verdictCounts.filter((item) => /^candidate_matches_/.test(item.verdict));
  const coveredRepairs = [];
  const missingRepairs = [];
  for (const spec of repairSpecs) {
    const verdict = verdictCounts.find((item) => item.verdict === spec.verdict);
    if (!verdict) continue;
    const missingSourcePhrases = spec.sourcePhrases.filter((phrase) => !combinedSource.includes(phrase));
    const matchedCells = cellMatches(spec.matchCell);
    const covered = missingSourcePhrases.length === 0 && matchedCells.length > 0;
    const item = {
      verdict: spec.verdict,
      historicalCount: verdict.count,
      sourcePhraseCount: spec.sourcePhrases.length,
      missingSourcePhrases,
      matchedCurrentExactCellIds: matchedCells.map((cell) => cell.cellId),
      currentExactCellPromptContractsPassed: matchedCells.length
    };
    if (covered) coveredRepairs.push(item);
    else missingRepairs.push(item);
  }
  const checkedHistoricalVerdictCount = coveredRepairs.length + missingRepairs.length;
  return {
    label: 'math_current_historical_failure_repair_coverage',
    status: missingRepairs.length === 0 ? 'passed' : 'needs_attention',
    productionImpact: 'none_static_source_and_read_only_preview',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_exact_cell_previews',
    checkedHistoricalVerdictCount,
    coveredHistoricalVerdictCount: coveredRepairs.length,
    missingHistoricalVerdicts: missingRepairs,
    coveredHistoricalVerdicts: coveredRepairs,
    alreadyMatchingPlanShapeVerdictCount: matchingPlanShapeVerdicts.length,
    alreadyMatchingPlanShapeVerdicts: matchingPlanShapeVerdicts,
    evidenceLimit: 'proves current source and exact-cell prompt contracts cover historical top repair verdicts, not that fresh provider output will pass the live gate'
  };
}

function runMathResidualReviewerRouteReadiness(runId, mathAllExactCellReadiness) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-production-audit.cjs'),
    '--subject=math',
    `--run=${runId}`,
    '--json'
  ], 'math production audit residual reviewer route readiness');
  assert(report.run?.subject === 'math', `Math production audit subject drifted: ${report.run?.subject}`);
  assert(Number(report.run?.id) === Number(runId), `Math production audit run drifted: ${report.run?.id}`);
  const exactByCellId = new Map(arrayFrom(mathAllExactCellReadiness.cells).map((cell) => [String(cell.cellId), cell]));
  const residualRoutes = new Set([
    'reviewer_validator_calibration',
    'reviewer_gate_or_question_plan_calibration'
  ]);
  const residualCells = arrayFrom(report.cells)
    .filter((cell) => {
      const diagnostics = recordFrom(cell.productionDiagnostics);
      const openCount = Number.isFinite(Number(cell.reconciledOpenCount))
        ? Number(cell.reconciledOpenCount)
        : Number(cell.openCount);
      return openCount > 0
        && cleanText(diagnostics.primaryBottleneck) === 'content_gate'
        && residualRoutes.has(residualReviewerRouteFromGateReasons(diagnostics.topGateReasons));
    })
    .map((cell) => {
      const diagnostics = recordFrom(cell.productionDiagnostics);
      const route = residualReviewerRouteFromGateReasons(diagnostics.topGateReasons);
      const exact = exactByCellId.get(String(cell.id)) ?? {};
      const exactPromptContractPassed = exact.exactObservationAttemptStatus === 'plan_ready'
        && exact.exactObservationGateAllowed === true
        && exact.promptContractStatus === 'passed'
        && exact.promptContractHasQuestionPlan === true
        && Number(exact.promptContractMissingRequiredPhraseCount) === 0;
      return {
        cellId: Number(cell.id) || null,
        topicTitle: cell.topicTitle ?? null,
        difficulty: cell.difficulty ?? null,
        route,
        rejectedGeneratedCount: Number(diagnostics.rejectedGeneratedCount) || 0,
        topGateReasons: arrayFrom(diagnostics.topGateReasons).slice(0, 5),
        exactPromptContractPassed,
        exactObservationAttemptStatus: exact.exactObservationAttemptStatus ?? null,
        exactObservationGateAllowed: exact.exactObservationGateAllowed ?? null,
        promptContractStatus: exact.promptContractStatus ?? null,
        promptContractMissingRequiredPhraseCount: exact.promptContractMissingRequiredPhraseCount ?? null,
        questionPlanTemplate: exact.questionPlanTemplate ?? null,
        questionPlanTaskFamily: exact.questionPlanTaskFamily ?? null
      };
    });
  const issues = residualCells.filter((cell) => cell.exactPromptContractPassed !== true);
  return {
    label: 'math_residual_reviewer_route_readiness',
    status: issues.length === 0 ? 'passed' : 'needs_attention',
    productionImpact: 'none_read_only_audit',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_production_audit_and_exact_cell_previews',
    runId,
    residualRouteCellCount: residualCells.length,
    exactPromptContractPassedCount: residualCells.filter((cell) => cell.exactPromptContractPassed).length,
    routeCounts: residualCells.reduce((counts, cell) => {
      const found = counts.find((item) => item.value === cell.route);
      if (found) found.count += 1;
      else counts.push({ value: cell.route, count: 1 });
      return counts;
    }, []),
    cells: residualCells,
    issues,
    evidenceLimit: 'proves residual reviewer/gate-route math cells have current exact prompt contracts ready; reviewer calibration and fresh live quality still require post-provider gate evidence'
  };
}

function runMathPostfixEfficiencyGate(runId = 156, cellId = null) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-math-postfix-efficiency-gate.cjs'),
    `--run=${runId}`,
    ...(Number(cellId) > 0 ? [`--cell=${Number(cellId)}`] : []),
    '--hours=72',
    '--json'
  ], 'math postfix efficiency gate');
  assert(report.mode === 'math_postfix_efficiency_gate', `Math postfix efficiency gate mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_read_only_postfix_observation_efficiency_gate', `Math postfix efficiency gate production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Math postfix efficiency gate must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_observation_tasks_generation_jobs_questions', `Math postfix efficiency gate DB impact drifted: ${report.dbImpact}`);
  assert(report.studentConsumableImpact === 'none_audit_only_reports_if_student_pool_publication_exists', `Math postfix efficiency gate student impact drifted: ${report.studentConsumableImpact}`);
  return {
    label: 'math_postfix_efficiency_gate',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    studentConsumableImpact: report.studentConsumableImpact,
    runId,
    efficiencySatisfied: report.efficiencySatisfied === true,
    thresholds: report.thresholds ?? null,
    sampleCounts: report.sampleCounts ?? null,
    yields: report.yields ?? null,
    reasons: arrayFrom(report.reasons),
    doesNotProve: arrayFrom(report.doesNotProve),
    scope: report.scope ?? null,
    evidenceLimit: report.evidenceLimit ?? null
  };
}

function runMathGuardedFamilySelector(runId = 1, validatedCellId = 13) {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-math-guarded-family-selector.cjs'),
    `--run=${runId}`,
    `--validated-cell=${validatedCellId}`,
    '--json'
  ], 'math guarded-family selector');
  assert(report.mode === 'read_only_math_guarded_family_selector', `Math guarded-family selector mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_read_only_selection', `Math guarded-family selector production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Math guarded-family selector must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'read_only_audit_and_exact_cell_previews', `Math guarded-family selector DB impact drifted: ${report.dbImpact}`);
  return {
    label: 'math_guarded_family_selector',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    runId,
    productionRunId: report.productionRunId ?? runId,
    validatedCell: report.validatedCell ?? null,
    validatedCells: arrayFrom(report.validatedCells),
    validationDiscovery: report.validationDiscovery ?? null,
    selectionPolicy: report.selectionPolicy ?? null,
    evidenceVerification: report.evidenceVerification ?? null,
    selected: report.selected ?? null,
    localCalibration: report.localCalibration ?? null,
    nextAction: report.nextAction ?? null,
    futureLiveValidationPlan: report.futureLiveValidationPlan ?? null
  };
}

function runRuntimeProcessAudit() {
  const report = runNodeJson([
    scriptPath('csca-runtime-process-audit.cjs'),
    '--json'
  ], 'runtime process audit');
  assert(report.mode === 'csca_runtime_process_audit', `Runtime process audit mode drifted: ${report.mode}`);
  assert(report.productionImpact === 'none_read_only_runtime_process_audit', `Runtime process audit production impact drifted: ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `Runtime process audit must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'none_no_db_access', `Runtime process audit must not touch DB, got ${report.dbImpact}`);
  return {
    label: 'runtime_process_audit',
    status: report.duplicateOrMixedBackendRisk ? 'needs_attention' : report.status === 'process_inspection_unavailable' ? 'operational_wait' : 'passed',
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    auditStatus: report.status,
    backendRunnerCount: report.backendRunnerCount ?? null,
    duplicateOrMixedBackendRisk: report.duplicateOrMixedBackendRisk === true,
    nextSafeAction: report.nextSafeAction ?? null,
    countByCategory: report.countByCategory ?? null,
    inspectionError: report.inspectionError ?? null
  };
}

function main() {
  const observationBaseUrl = observationBackendBaseUrl();
  const mathObservationRunId = Number(argValue('math-run', '1')) || 1;
  const mathBasicFunctionRunId = Number(argValue('math-basic-function-run', '1')) || 1;
  const mathBasicFunctionCellId = Number(argValue('math-basic-function-cell', '13')) || 13;
  const requestedMathObservationCellId = Number(argValue('math-observation-cell', String(mathBasicFunctionCellId))) || mathBasicFunctionCellId;
  if (hasFlag('math-basic-function-contract-only')) {
    const check = runMathBasicFunctionExactPromptContract(
      mathBasicFunctionRunId,
      mathBasicFunctionCellId
    );
    const report = {
      mode: 'subject_practice_no_provider_acceptance',
      status: check.status,
      acceptanceScope: 'math_basic_function_single_target_prompt_contract',
      productionImpact: 'none_read_only_preview',
      actualRuntimeImpact: 'none_no_mutation_no_provider_call',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_exact_cell_preview',
      studentConsumableImpact: 'none_does_not_publish_to_student_pool',
      check
    };
    console.log(JSON.stringify(report, null, hasFlag('json') ? 2 : 2));
    return;
  }
  const fixedEvalCheck = runSubjectPracticeFixedEval();
  const mathRetryFeedbackCoverageCheck = runMathQuestionPlanRetryFeedbackCoverage();
  const observationTaskRulesCheck = runObservationTaskRules();
  const boundedMathFamilyValidationSelfTestCheck = runBoundedMathFamilyValidationSelfTest();
  const observationEvidenceCheck = runObservationEvidence();
  const rolloutGateCheck = runRolloutGate(observationBaseUrl, mathObservationRunId);
  const nextActionCheck = runSubjectPracticeNextAction('math', mathObservationRunId, requestedMathObservationCellId);
  const providerRecoveryStateCheck = runProviderRecoveryState();
  const mathScorecardCheck = runSubjectPracticeMathScorecard(mathObservationRunId);
  const mathExactCellCheck = runMathExactCellPreview(mathObservationRunId);
  const mathAllExactCellReadinessCheck = runMathAllExactCellPreviewReadiness(mathObservationRunId);
  const mathBasicFunctionExactPromptContractCheck = runMathBasicFunctionExactPromptContract(
    mathBasicFunctionRunId,
    mathBasicFunctionCellId
  );
  const mathCurrentHistoricalFailureRepairCoverageCheck = runMathCurrentHistoricalFailureRepairCoverage(
    mathScorecardCheck,
    mathAllExactCellReadinessCheck
  );
  const mathResidualReviewerRouteReadinessCheck = runMathResidualReviewerRouteReadiness(
    mathObservationRunId,
    mathAllExactCellReadinessCheck
  );
  const mathObservationCellId = requestedMathObservationCellId || Number(mathExactCellCheck.selectedCellId) || 350;
  const mathPostfixEfficiencyGateCheck = runMathPostfixEfficiencyGate(mathObservationRunId, mathObservationCellId);
  const mathGuardedFamilySelectorCheck = runMathGuardedFamilySelector(mathObservationRunId, mathObservationCellId);
  const preflightCheck = runObservationPreflight(observationBaseUrl, mathObservationCellId);
  const runtimeProcessCheck = runRuntimeProcessAudit();
  const checks = [
    fixedEvalCheck,
    mathRetryFeedbackCoverageCheck,
    observationTaskRulesCheck,
    boundedMathFamilyValidationSelfTestCheck,
    preflightCheck,
    observationEvidenceCheck,
    rolloutGateCheck,
    nextActionCheck,
    providerRecoveryStateCheck,
    mathScorecardCheck,
    mathExactCellCheck,
    mathAllExactCellReadinessCheck,
    mathBasicFunctionExactPromptContractCheck,
    mathCurrentHistoricalFailureRepairCoverageCheck,
    mathResidualReviewerRouteReadinessCheck,
    mathPostfixEfficiencyGateCheck,
    mathGuardedFamilySelectorCheck,
    runtimeProcessCheck
  ];
  const rolloutGate = checks.find((check) => check.label === 'subject_diversity_rollout_gate') ?? {};
  const preflight = checks.find((check) => check.label === 'math_observation_preflight') ?? {};
  const observationEvidence = checks.find((check) => check.label === 'math_observation_evidence') ?? {};
  const fixedEval = checks.find((check) => check.label === 'subject_practice_fixed_eval') ?? {};
  const mathRetryFeedbackCoverage = checks.find((check) => check.label === 'math_question_plan_retry_feedback_coverage') ?? {};
  const nextAction = checks.find((check) => check.label === 'subject_practice_next_action_throughput') ?? {};
  const providerRecoveryState = checks.find((check) => check.label === 'provider_recovery_state') ?? {};
  const mathScorecard = checks.find((check) => check.label === 'subject_practice_math_scorecard') ?? {};
  const mathExactCell = checks.find((check) => check.label === 'math_exact_cell_enqueue_preview') ?? {};
  const mathAllExactCellReadiness = checks.find((check) => check.label === 'math_all_exact_cell_question_plan_readiness') ?? {};
  const mathBasicFunctionExactPromptContract = checks.find((check) => check.label === 'math_basic_function_exact_prompt_contract') ?? {};
  const mathCurrentHistoricalFailureRepairCoverage = checks.find((check) => check.label === 'math_current_historical_failure_repair_coverage') ?? {};
  const mathResidualReviewerRouteReadiness = checks.find((check) => check.label === 'math_residual_reviewer_route_readiness') ?? {};
  const mathPostfixEfficiencyGate = checks.find((check) => check.label === 'math_postfix_efficiency_gate') ?? {};
  const mathGuardedFamilySelector = checks.find((check) => check.label === 'math_guarded_family_selector') ?? {};
  const selectedGuardedMathFamily = recordFrom(mathGuardedFamilySelector.selected);
  const guardedValidatedCells = arrayFrom(mathGuardedFamilySelector.validatedCells);
  const currentGuardedValidatedCell = guardedValidatedCells.find(
    (cell) => Number(cell.cellId) === Number(mathObservationCellId)
  ) ?? null;
  const runtimeProcessAudit = checks.find((check) => check.label === 'runtime_process_audit') ?? {};
  const preflightWaitCodes = arrayFrom(preflight.waitReasons).map((reason) => `preflight:${reason}`);
  const preflightWarningCodes = arrayFrom(preflight.warnings).map((reason) => `preflight_warning:${reason}`);
  const preflightStatusWaitCodes = [
    ...(['ready_after_observation_only_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(preflight.status)
      ? ['preflight:observation_only_backend_start_required']
      : []),
    ...(['ready_after_observation_question_plan_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(preflight.status)
      ? ['preflight:observation_question_plan_backend_start_required']
      : [])
  ];
  const providerHardStopBeforeLive = cleanText(nextAction.decisionStatus) === 'provider_hard_stop_before_live_or_enqueue'
    || nextAction.providerBackoff?.hardStopActive === true;
  const hasFreshLiveMathGateEvidence = observationEvidence.mathPublishableEvidence === 'fresh_live_publishable_gate_pass'
    && Number(observationEvidence.productionRunId) === Number(mathObservationRunId)
    && Number(observationEvidence.productionCellId) === Number(mathObservationCellId);
  const latestSingleTaskSchedulerAdherenceSatisfied = cleanText(observationEvidence.schedulerAdherenceStatus) === 'preferred_family_match';
  const hasFreshCompleteSingleTaskMathEvidence = hasFreshLiveMathGateEvidence
    && latestSingleTaskSchedulerAdherenceSatisfied;
  const mathPostfixEfficiencySatisfied = mathPostfixEfficiencyGate.status === 'passed'
    && mathPostfixEfficiencyGate.efficiencySatisfied === true;
  const hasFreshBoundedMathStageEvidence = Number(mathGuardedFamilySelector.productionRunId) === Number(mathObservationRunId)
    && currentGuardedValidatedCell?.status === 'passed'
    && currentGuardedValidatedCell?.efficiencySatisfied === true
    && Number(currentGuardedValidatedCell?.sampleCounts?.deliveredCandidateCount) >= 3
    && Number(currentGuardedValidatedCell?.sampleCounts?.gatePublishableCount) >= 2
    && Number(currentGuardedValidatedCell?.sampleCounts?.studentPublishedCount) === 0
    && mathPostfixEfficiencySatisfied;
  const mathStageValidationSatisfied = hasFreshCompleteSingleTaskMathEvidence || hasFreshBoundedMathStageEvidence;
  const validatedObservationCell = mathStageValidationSatisfied && mathPostfixEfficiencySatisfied;
  const selectedFutureLiveValidationPlan = recordFrom(mathGuardedFamilySelector.futureLiveValidationPlan);
  const selectedFamilyCurrentProtocolContinuationStatus = cleanText(selectedFutureLiveValidationPlan.currentProtocolContinuationStatus);
  const selectedFamilyRequiresLocalRepair = mathGuardedFamilySelector.status === 'selected_requires_local_repair_after_bounded_failure';
  const selectedFamilyLocalRepairComplete = mathGuardedFamilySelector.status === 'selected_local_repair_completed_new_protocol_required';
  const selectedFamilyVersionedProtocolReady = mathGuardedFamilySelector.status === 'selected_versioned_validation_protocol_ready_for_authorization_review';
  const selectedFamilyNeedsLiveValidation = Number(selectedGuardedMathFamily.cellId) > 0
    && selectedGuardedMathFamily.alreadyValidated !== true
    && !selectedFamilyRequiresLocalRepair
    && !selectedFamilyLocalRepairComplete;
  const mathRecoveryDiagnosticsRequiredBeforeLive = cleanText(nextAction.decisionStatus) === 'math_recovery_diagnostics_required_before_live_or_enqueue'
    && !validatedObservationCell;
  const noLiveRecommendedBeforeRecovery = providerHardStopBeforeLive || mathRecoveryDiagnosticsRequiredBeforeLive;
  const operationalWaitCodes = uniqueStrings([
    ...arrayFrom(rolloutGate.waitCodes),
    ...preflightWaitCodes,
    ...preflightWarningCodes,
    ...preflightStatusWaitCodes,
    ...(preflight.backendReadinessSkipped ? ['preflight:target_backend_readiness_skipped'] : []),
    ...(preflight.backendReadinessError ? ['preflight:target_backend_readiness_unavailable'] : []),
    ...(providerHardStopBeforeLive ? ['provider_hard_stop:provider_hard_stop_before_live_or_enqueue'] : []),
    ...(providerRecoveryState.hardStopActive ? [`provider_recovery_state:${providerRecoveryState.errorCode || 'hard_stop_active'}`] : []),
    ...(mathRecoveryDiagnosticsRequiredBeforeLive ? ['math_recovery:diagnostics_required_before_live_or_enqueue'] : []),
    ...(runtimeProcessAudit.duplicateOrMixedBackendRisk ? ['runtime_process:duplicate_or_mixed_backend_processes'] : []),
    ...(runtimeProcessAudit.auditStatus === 'process_inspection_unavailable' ? ['runtime_process:inspection_unavailable'] : [])
  ]);
  const activeObservationTaskCount = Math.max(
    Number(preflight.activeObservationTaskCount) || 0,
    Number(observationEvidence.activeObservationTaskCount) || 0
  );
  const activeObservationJobCount = Math.max(
    Number(preflight.activeObservationJobCount) || 0,
    Number(observationEvidence.activeObservationJobCount) || 0
  );
  const latestChemistryRunProtected = observationEvidence.latestChemistryRunStatus === 'running'
    && !observationEvidence.latestChemistryRunBlockedReason;
  const mathObservationReadyForFreshAuthorization = preflight.status === 'eligible_for_backend_owned_observation_submission'
    && preflight.readyForSubmission === true
    && preflight.readyForExecution === true
    && preflight.questionPlanReadyForTarget === true;
  const mathObservationLiveEligibleForFreshAuthorization = mathObservationReadyForFreshAuthorization
    && !noLiveRecommendedBeforeRecovery;
  const requiredQuestionPlanCheckLabels = arrayFrom(fixedEval.requiredQuestionPlanCheckLabels);
  const questionPlanCheckLabels = new Set(arrayFrom(fixedEval.questionPlan?.checks).map((check) => cleanText(check.label)));
  const questionPlanFixedEvalSatisfied = fixedEval.questionPlan?.status === 'passed'
    && requiredQuestionPlanCheckLabels.every((label) => questionPlanCheckLabels.has(label));
  const noProviderNoSubmissionSatisfied = checks.every((check) => {
    const productionImpact = cleanText(check.productionImpact);
    const providerImpact = cleanText(check.providerImpact);
    const noSubmissionImpact = /^none_/.test(productionImpact)
      || (
        cleanText(check.label) === 'math_observation_preflight'
        && productionImpact === 'bounded_one_background_slot_backend_owned'
      );
    return noSubmissionImpact
      && (providerImpact === 'none_no_provider_call' || providerImpact === 'none_no_provider_call_expected');
  });
  const rolloutGateSatisfied = ['passed', 'passed_with_operational_wait'].includes(cleanText(rolloutGate.status))
    && arrayFrom(rolloutGate.failures).length === 0;
  const nextActionThroughputVisible = nextAction.throughputEfficiency?.mode === 'audit_only_next_action_throughput_efficiency'
    && nextAction.decisionStatus
    && nextAction.dispatchCapacity
    && nextAction.providerBackoff
    && nextAction.actionQueue?.mode === 'ordered_subject_practice_next_action_queue';
  const completionAudit = [
    {
      requirement: 'no_provider_no_submission_stage_acceptance',
      status: noProviderNoSubmissionSatisfied ? 'satisfied' : 'missing',
      evidence: checks.map((check) => ({
        label: check.label,
        status: check.status,
        productionImpact: check.productionImpact ?? null,
        providerImpact: check.providerImpact ?? null
      }))
    },
    {
      requirement: 'subject_diversity_rollout_gate_readiness_visible',
      status: rolloutGateSatisfied ? 'satisfied' : 'missing',
      evidence: {
        status: rolloutGate.status ?? null,
        nextStep: rolloutGate.nextStep ?? null,
        failures: rolloutGate.failures ?? []
      }
    },
    {
      requirement: 'task_family_fingerprint_fixed_eval_visible',
      status: fixedEval.taskFamilyFingerprint?.status === 'passed'
        ? 'satisfied'
        : 'missing',
      evidence: fixedEval.taskFamilyFingerprint ?? null
    },
    {
      requirement: 'question_plan_three_subject_shadow_fixed_eval_visible',
      status: questionPlanFixedEvalSatisfied ? 'satisfied' : 'missing',
      evidence: {
        status: fixedEval.questionPlan?.status ?? null,
        checkCount: fixedEval.questionPlan?.checkCount ?? null,
        requiredCheckLabels: requiredQuestionPlanCheckLabels,
        observedCheckLabels: Array.from(questionPlanCheckLabels),
        checks: fixedEval.questionPlan?.checks ?? []
      }
    },
    {
      requirement: 'math_question_plan_retry_feedback_coverage_visible',
      status: mathRetryFeedbackCoverage.status === 'passed'
        ? 'satisfied'
        : 'satisfied_with_attention',
      evidence: {
        status: mathRetryFeedbackCoverage.status ?? null,
        policyFailureCodeCount: mathRetryFeedbackCoverage.policyFailureCodeCount ?? null,
        coveredFailureCodeCount: mathRetryFeedbackCoverage.coveredFailureCodeCount ?? null,
        missingFeedbackCodes: mathRetryFeedbackCoverage.missingFeedbackCodes ?? [],
        genericQuestionPlanRetryVisible: mathRetryFeedbackCoverage.genericQuestionPlanRetryVisible ?? null,
        evidenceLimit: mathRetryFeedbackCoverage.evidenceLimit ?? null
      }
    },
    {
      requirement: 'profile_difficulty_patch_fixed_eval_visible',
      status: fixedEval.profileDifficultyPatch?.status === 'passed'
        ? 'satisfied'
        : 'missing',
      evidence: fixedEval.profileDifficultyPatch ?? null
    },
    {
      requirement: 'backend_owned_observation_uniqueness_visible',
      status: observationEvidence.oneObservationJobForTask === true ? 'satisfied' : 'not_applicable_or_missing',
      evidence: {
        latestObservationTaskId: observationEvidence.taskId ?? null,
        latestObservationJobCountForTask: observationEvidence.observationJobCountForTask ?? null
      }
    },
    {
      requirement: 'observation_gateway_binding_visible',
      status: observationEvidence.gatewayBinding ? 'satisfied' : 'not_applicable_or_missing',
      evidence: observationEvidence.gatewayBinding ?? null
    },
    {
      requirement: 'no_active_observation_work_leftover',
      status: activeObservationTaskCount === 0 && activeObservationJobCount === 0 ? 'satisfied' : 'missing',
      evidence: { activeObservationTaskCount, activeObservationJobCount }
    },
    {
      requirement: 'chemistry_current_run_not_blocked',
      status: latestChemistryRunProtected ? 'satisfied' : 'missing_or_unverified',
      evidence: {
        latestChemistryRunId: observationEvidence.latestChemistryRunId ?? null,
        latestChemistryRunStatus: observationEvidence.latestChemistryRunStatus ?? null,
        latestChemistryRunBlockedReason: observationEvidence.latestChemistryRunBlockedReason ?? null
      }
    },
    {
      requirement: 'subject_practice_next_action_throughput_efficiency_visible',
      status: nextAction.status === 'passed'
        ? 'satisfied'
        : nextActionThroughputVisible
          ? 'satisfied_with_attention'
          : 'missing',
      evidence: {
        target: nextAction.target ?? null,
        providerConfig: nextAction.providerConfig ?? null,
        decisionStatus: nextAction.decisionStatus ?? null,
        recommendedType: nextAction.recommendedType ?? null,
        explicitAuthorizationRequired: nextAction.explicitAuthorizationRequired ?? null,
        capacityFillStatus: nextAction.capacityFillStatus ?? null,
        capacityFillExplicitAuthorizationRequired: nextAction.capacityFillExplicitAuthorizationRequired ?? null,
        throughputStatus: nextAction.throughputEfficiency?.status ?? null,
        throughputMode: nextAction.throughputEfficiency?.mode ?? null,
        yieldEvidence: nextAction.throughputEfficiency?.yieldEvidence ?? null,
        primaryBottlenecks: nextAction.throughputEfficiency?.primaryBottlenecks ?? [],
        nextEfficiencyLever: nextAction.throughputEfficiency?.nextEfficiencyLever ?? null,
        actionQueueMode: nextAction.actionQueue?.mode ?? null,
        actionQueueItemCount: arrayFrom(nextAction.actionQueue?.items).length,
        dispatchCapacity: nextAction.dispatchCapacity ?? null,
        providerBackoff: nextAction.providerBackoff ?? null
      }
    },
    {
      requirement: 'provider_recovery_state_visible',
      status: providerRecoveryState.status
        ? providerRecoveryState.hardStopActive
          ? 'satisfied_with_attention'
          : 'satisfied'
        : 'missing',
      evidence: {
        status: providerRecoveryState.status ?? null,
        hardStopActive: providerRecoveryState.hardStopActive ?? null,
        recoveredAfterHardStop: providerRecoveryState.recoveredAfterHardStop ?? null,
        latestHardStopAt: providerRecoveryState.latestHardStopAt ?? null,
        latestRecoverySuccessAt: providerRecoveryState.latestRecoverySuccessAt ?? null,
        errorCode: providerRecoveryState.errorCode ?? null,
        latestRecoveryProbeCount: providerRecoveryState.latestRecoveryProbeCount ?? null,
        nextSafeAction: providerRecoveryState.nextSafeAction ?? null,
        dbImpact: providerRecoveryState.dbImpact ?? null
      }
    },
    {
      requirement: 'math_post_provider_recovery_efficiency_lever_visible',
      status: mathScorecard.postProviderRecoveryEfficiencyLever
        ? 'satisfied_with_attention'
        : 'missing',
      evidence: {
        runStatus: mathScorecard.runStatus ?? null,
        blockedReason: mathScorecard.blockedReason ?? null,
        open: mathScorecard.open ?? null,
        generatedToApprovedYield: mathScorecard.generatedToApprovedYield ?? null,
        attemptToApprovedYield: mathScorecard.attemptToApprovedYield ?? null,
        deliveryIssueShareOfAttempts: mathScorecard.deliveryIssueShareOfAttempts ?? null,
        nextEfficiencyLever: mathScorecard.nextEfficiencyLever ?? null,
        postProviderRecoveryEfficiencyLever: mathScorecard.postProviderRecoveryEfficiencyLever ?? null,
        questionPlanOpenCount: mathScorecard.questionPlanOpenCount ?? null,
        reviewerValidatorOpenCount: mathScorecard.reviewerValidatorOpenCount ?? null,
        reviewerGateOrQuestionPlanOpenCount: mathScorecard.reviewerGateOrQuestionPlanOpenCount ?? null
      }
    },
    {
      requirement: 'math_open_cell_preferred_prompt_skeleton_coverage_visible',
      status: mathScorecard.mathQuestionPlanSkeletonCoverage?.status === 'all_open_math_cells_have_preferred_prompt_skeletons'
        ? 'satisfied'
        : mathScorecard.mathQuestionPlanSkeletonCoverage
          ? 'satisfied_with_attention'
          : 'missing',
      evidence: {
        status: mathScorecard.mathQuestionPlanSkeletonCoverage?.status ?? null,
        openCellCount: mathScorecard.mathQuestionPlanSkeletonCoverage?.openCellCount ?? null,
        coveredOpenCellCount: mathScorecard.mathQuestionPlanSkeletonCoverage?.coveredOpenCellCount ?? null,
        missingSkeletonCellCount: mathScorecard.mathQuestionPlanSkeletonCoverage?.missingSkeletonCellCount ?? null,
        templateCounts: mathScorecard.mathQuestionPlanSkeletonCoverage?.templateCounts ?? []
      }
    },
    {
      requirement: 'math_exact_cell_prompt_contract_preview_visible',
      status: mathExactCell.promptContractPreview?.status === 'passed'
        && mathExactCell.promptContractPreview?.userPayloadHasQuestionPlan === true
        && Number(mathExactCell.promptContractPreview?.missingRequiredPhraseCount) === 0
        ? 'satisfied'
        : 'missing',
      evidence: {
        selectedCellId: mathExactCell.selectedCellId ?? null,
        selectedBlueprintId: mathExactCell.selectedBlueprintId ?? null,
        questionPlanTemplate: mathExactCell.questionPlanTemplate ?? null,
        questionPlanTaskFamily: mathExactCell.questionPlanTaskFamily ?? null,
        promptContractPreview: mathExactCell.promptContractPreview ?? null
      }
    },
    {
      requirement: 'math_basic_function_single_target_prompt_contract_visible',
      status: mathBasicFunctionExactPromptContract.status === 'passed'
        && mathBasicFunctionExactPromptContract.promptContractStatus === 'passed'
        && mathBasicFunctionExactPromptContract.promptContractHasQuestionPlan === true
        && Number(mathBasicFunctionExactPromptContract.promptContractMissingRequiredPhraseCount) === 0
        && mathBasicFunctionExactPromptContract.requiredSingleTargetPhrasesPresent === true
        && cleanText(mathBasicFunctionExactPromptContract.conflictResolution).includes('multi_step_reasoning complexity')
        ? 'satisfied'
        : 'missing',
      evidence: mathBasicFunctionExactPromptContract
    },
    {
      requirement: 'math_all_exact_cell_question_plan_readiness_visible',
      status: mathAllExactCellReadiness.status === 'passed'
        && Number(mathAllExactCellReadiness.totalCellCount) === Number(mathAllExactCellReadiness.planReadyCount)
        && Number(mathAllExactCellReadiness.totalCellCount) === Number(mathAllExactCellReadiness.compatibleSchedulerHintCount)
        && Number(mathAllExactCellReadiness.totalCellCount) === Number(mathAllExactCellReadiness.promptContractPassedCount)
        && Number(mathAllExactCellReadiness.promptContractMissingRequiredPhraseCount) === 0
        && Number(mathAllExactCellReadiness.promptContractIssueCount) === 0
        && Number(mathAllExactCellReadiness.totalCellCount) === Number(mathAllExactCellReadiness.promptBudgetCoverageCount)
        && Number(mathAllExactCellReadiness.totalCellCount) === Number(mathAllExactCellReadiness.promptBudgetPassedCount)
        && Number(mathAllExactCellReadiness.promptBudgetExceededCount) === 0
        && Number(mathAllExactCellReadiness.rejectedSchedulerHintCount) === 0
        && Number(mathAllExactCellReadiness.fallbackIncompatibleCount) === 0
        ? 'satisfied'
        : 'missing',
      evidence: {
        runId: mathAllExactCellReadiness.runId ?? null,
        totalCellCount: mathAllExactCellReadiness.totalCellCount ?? null,
        planReadyCount: mathAllExactCellReadiness.planReadyCount ?? null,
        compatibleSchedulerHintCount: mathAllExactCellReadiness.compatibleSchedulerHintCount ?? null,
        promptContractPassedCount: mathAllExactCellReadiness.promptContractPassedCount ?? null,
        promptContractMissingRequiredPhraseCount: mathAllExactCellReadiness.promptContractMissingRequiredPhraseCount ?? null,
        promptContractIssueCount: mathAllExactCellReadiness.promptContractIssueCount ?? null,
        promptBudgetCoverageCount: mathAllExactCellReadiness.promptBudgetCoverageCount ?? null,
        promptBudgetPassedCount: mathAllExactCellReadiness.promptBudgetPassedCount ?? null,
        promptBudgetExceededCount: mathAllExactCellReadiness.promptBudgetExceededCount ?? null,
        maximumPromptCharacterCount: mathAllExactCellReadiness.maximumPromptCharacterCount ?? null,
        rejectedSchedulerHintCount: mathAllExactCellReadiness.rejectedSchedulerHintCount ?? null,
        fallbackIncompatibleCount: mathAllExactCellReadiness.fallbackIncompatibleCount ?? null,
        issueCount: mathAllExactCellReadiness.issueCount ?? null,
        normalDistributionCells: mathAllExactCellReadiness.normalDistributionCells ?? [],
        elementaryFunctionCells: mathAllExactCellReadiness.elementaryFunctionCells ?? []
      }
    },
    {
      requirement: 'math_current_historical_failure_repair_coverage_visible',
      status: mathCurrentHistoricalFailureRepairCoverage.status === 'passed'
        && Number(mathCurrentHistoricalFailureRepairCoverage.checkedHistoricalVerdictCount) > 0
        && Number(mathCurrentHistoricalFailureRepairCoverage.missingHistoricalVerdicts?.length ?? 0) === 0
        ? 'satisfied'
        : mathCurrentHistoricalFailureRepairCoverage.status
          ? 'satisfied_with_attention'
          : 'missing',
      evidence: {
        status: mathCurrentHistoricalFailureRepairCoverage.status ?? null,
        checkedHistoricalVerdictCount: mathCurrentHistoricalFailureRepairCoverage.checkedHistoricalVerdictCount ?? null,
        coveredHistoricalVerdictCount: mathCurrentHistoricalFailureRepairCoverage.coveredHistoricalVerdictCount ?? null,
        missingHistoricalVerdicts: mathCurrentHistoricalFailureRepairCoverage.missingHistoricalVerdicts ?? [],
        alreadyMatchingPlanShapeVerdictCount: mathCurrentHistoricalFailureRepairCoverage.alreadyMatchingPlanShapeVerdictCount ?? null,
        evidenceLimit: mathCurrentHistoricalFailureRepairCoverage.evidenceLimit ?? null
      }
    },
    {
      requirement: 'math_residual_reviewer_route_readiness_visible',
      status: mathResidualReviewerRouteReadiness.status === 'passed'
        ? 'satisfied'
        : mathResidualReviewerRouteReadiness.status
          ? 'satisfied_with_attention'
          : 'missing',
      evidence: {
        status: mathResidualReviewerRouteReadiness.status ?? null,
        residualRouteCellCount: mathResidualReviewerRouteReadiness.residualRouteCellCount ?? null,
        exactPromptContractPassedCount: mathResidualReviewerRouteReadiness.exactPromptContractPassedCount ?? null,
        routeCounts: mathResidualReviewerRouteReadiness.routeCounts ?? [],
        issues: mathResidualReviewerRouteReadiness.issues ?? [],
        evidenceLimit: mathResidualReviewerRouteReadiness.evidenceLimit ?? null
      }
    },
    {
      requirement: 'math_postfix_efficiency_gate_passed',
      status: mathPostfixEfficiencyGate.status === 'passed'
        && mathPostfixEfficiencyGate.efficiencySatisfied === true
        ? 'satisfied'
        : 'missing',
      evidence: {
        status: mathPostfixEfficiencyGate.status ?? null,
        efficiencySatisfied: mathPostfixEfficiencyGate.efficiencySatisfied ?? null,
        thresholds: mathPostfixEfficiencyGate.thresholds ?? null,
        sampleCounts: mathPostfixEfficiencyGate.sampleCounts ?? null,
        yields: mathPostfixEfficiencyGate.yields ?? null,
        reasons: mathPostfixEfficiencyGate.reasons ?? [],
        doesNotProve: mathPostfixEfficiencyGate.doesNotProve ?? [],
        evidenceLimit: mathPostfixEfficiencyGate.evidenceLimit ?? null
      }
    },
    {
      requirement: 'next_guarded_math_family_selected_without_provider',
      status: ['selected_for_no_provider_calibration', 'selected_and_locally_calibrated', 'selected_requires_local_repair_after_bounded_failure', 'selected_local_repair_completed_new_protocol_required', 'selected_versioned_validation_protocol_ready_for_authorization_review'].includes(mathGuardedFamilySelector.status)
        && Number(selectedGuardedMathFamily.cellId) > 0
        && selectedGuardedMathFamily.planReady === true
        && selectedGuardedMathFamily.promptReady === true
        && selectedGuardedMathFamily.liveExecutionAllowed === false
        ? 'satisfied'
        : 'missing',
      evidence: {
        status: mathGuardedFamilySelector.status ?? null,
        selectionPolicy: mathGuardedFamilySelector.selectionPolicy ?? null,
        evidenceVerification: mathGuardedFamilySelector.evidenceVerification ?? null,
        selected: selectedGuardedMathFamily,
        nextAction: mathGuardedFamilySelector.nextAction ?? null
      }
    },
    {
      requirement: 'runtime_process_provider_recovery_precheck_visible',
      status: runtimeProcessAudit.status === 'passed'
        ? 'satisfied'
        : 'satisfied_with_attention',
      evidence: {
        auditStatus: runtimeProcessAudit.auditStatus ?? null,
        backendRunnerCount: runtimeProcessAudit.backendRunnerCount ?? null,
        duplicateOrMixedBackendRisk: runtimeProcessAudit.duplicateOrMixedBackendRisk ?? null,
        nextSafeAction: runtimeProcessAudit.nextSafeAction ?? null,
        inspectionError: runtimeProcessAudit.inspectionError ?? null
      }
    },
    {
      requirement: 'live_math_stage_gate_evidence',
      status: mathStageValidationSatisfied ? 'satisfied' : 'missing',
      evidence: {
        source: hasFreshCompleteSingleTaskMathEvidence
          ? 'latest_single_task_publishable_gate'
          : hasFreshBoundedMathStageEvidence
            ? 'fresh_bounded_stage_efficiency_gate'
            : 'missing',
        latestSingleTaskEvidence: {
          gateSatisfied: hasFreshLiveMathGateEvidence,
          completeEvidenceSatisfied: hasFreshCompleteSingleTaskMathEvidence,
          latestObservationTaskId: observationEvidence.taskId ?? null,
          generatedQuestionId: observationEvidence.generatedQuestionId ?? null,
          gateDecision: observationEvidence.gateDecision ?? null,
          schedulerAdherenceStatus: observationEvidence.schedulerAdherenceStatus ?? null,
          completedAt: observationEvidence.completedAt ?? null
        },
        boundedStageEvidence: currentGuardedValidatedCell,
        evidenceLimit: hasFreshBoundedMathStageEvidence && !hasFreshCompleteSingleTaskMathEvidence
          ? 'stage progression is supported by the aggregate gate; the historical latest-task scheduler-adherence field remains unrepaired'
          : null
      }
    }
  ];
  const nextLiveValidation = {
    required: selectedFamilyNeedsLiveValidation || !validatedObservationCell,
    requiresFreshAuthorization: selectedFamilyNeedsLiveValidation || !validatedObservationCell,
    executionAllowed: false,
    allowedScope: selectedFamilyLocalRepairComplete
      ? 'none_local_repair_complete_new_versioned_protocol_required_before_future_live_validation'
      : selectedFamilyRequiresLocalRepair
      ? 'none_selected_family_requires_local_repair_before_any_future_live_validation'
      : selectedFamilyNeedsLiveValidation
      ? 'future_exact_selected_family_bounded_observation_only_after_fresh_authorization'
      : validatedObservationCell
        ? 'none_current_and_selected_family_validation_satisfied'
        : 'one_backend_owned_math_observation_task',
    target: selectedFamilyNeedsLiveValidation || selectedFamilyRequiresLocalRepair || selectedFamilyLocalRepairComplete
      ? {
        subject: 'math',
        productionRunId: mathObservationRunId,
        productionCellId: Number(selectedGuardedMathFamily.cellId),
        blueprintId: Number(selectedGuardedMathFamily.blueprintId) || null,
        taskFamily: selectedGuardedMathFamily.taskFamily ?? null,
        planTemplate: selectedGuardedMathFamily.planTemplate ?? null,
        maximumProviderCalls: Number(selectedFutureLiveValidationPlan.maximumProviderCalls) || null,
        maximumEstimatedCostUsd: Number(selectedFutureLiveValidationPlan.maximumEstimatedCostUsd) || null,
        maximumTotalEstimatedCostUsd: Number(selectedFutureLiveValidationPlan.maximumTotalEstimatedCostUsd) || null,
        maximumEstimatedCostUsdPerCall: Number(selectedFutureLiveValidationPlan.maximumEstimatedCostUsdPerCall) || null,
        validationProtocolVersion: selectedFutureLiveValidationPlan.target?.validationProtocolVersion ?? null
      }
      : {
        subject: 'math',
        productionRunId: mathObservationRunId,
        productionCellId: mathObservationCellId
      },
    currentProtocolContinuationStatus: selectedFamilyCurrentProtocolContinuationStatus || null,
    nextGuardedFamily: selectedFamilyNeedsLiveValidation || selectedFamilyRequiresLocalRepair || selectedFamilyLocalRepairComplete ? selectedGuardedMathFamily : null,
    executionProtocol: selectedFamilyRequiresLocalRepair
      ? 'local_prompt_plan_profile_and_output_compaction_repair_no_provider'
      : selectedFamilyNeedsLiveValidation
      ? 'math_bounded_family_validation_strictly_serial_three_sample'
      : 'single_guarded_observation_legacy_path',
    operatorCommands: selectedFamilyNeedsLiveValidation
      ? selectedFutureLiveValidationPlan.operatorCommands ?? null
      : null,
    preconditions: selectedFamilyRequiresLocalRepair ? [
      'repair_prompt_plan_profile_alignment_and_output_compaction_without_provider',
      'rerun_fixed_eval_prompt_contract_and_no_provider_acceptance'
    ] : [
      'start_observation_only_backend_with_question_plan_for_target_cell',
      'rerun_preflight_until_eligible_for_backend_owned_observation_submission',
      'provider_hard_stop_cleared_by_later_gateway_success',
      'provider_recovery_probe_passed_after_runtime_cleanup',
      'latest_fresh_chemistry_run_not_blocked',
      'active_observation_task_count_zero',
      'active_observation_job_count_zero'
    ],
    stopAfter: selectedFamilyNeedsLiveValidation
      ? 'three_effective_provider_samples_or_earlier_coordinator_stop_condition'
      : 'one_terminal_observation_task_result',
    forbiddenActions: [
      'standalone_provider_execution',
      ...(selectedFamilyNeedsLiveValidation
        ? ['parallel_or_unbounded_observation_tasks', 'second_batch_with_existing_current_protocol_samples']
        : ['multiple_observation_tasks']),
      'ordinary_production_runner_bypass',
      'provider_delivery_failure_written_to_family_quality_memory',
      'student_pool_publication_without_automatic_gate_pass'
    ],
    successEvidence: selectedFamilyNeedsLiveValidation
      ? [
      'exact_family_exact_validation_protocol_effective_provider_sample_count_equals_three',
        'three_terminal_tasks_with_one_generation_job_each',
        'delivery_candidate_question_plan_and_publishable_gate_funnels_recorded',
        'actual_batch_cost_and_tokens_recorded',
        'all_per_call_and_aggregate_cost_caps_respected',
        'student_publication_count_zero'
      ]
      : [
        'fresh_generation_job_after_current_fix',
        'direct_gateway_metadata_observationTaskId',
        'one_generation_job_for_observationTaskId',
        'scheduler_adherence_recorded',
        'gate_decision_and_reasons_recorded',
        'math_postfix_efficiency_gate_passed',
        'chemistry_latest_run_still_not_blocked_after_task'
      ]
  };
  const completionSatisfied = completionAudit.every((item) => item.status === 'satisfied');
  const acceptanceStatus = completionSatisfied
    ? 'passed'
    : completionAudit.some((item) => item.status === 'missing')
      ? 'needs_attention'
      : 'operational_wait';
  const incompleteGoalCompletionStatus = !mathStageValidationSatisfied
    ? 'incomplete_missing_live_math_stage_gate_evidence'
    : mathPostfixEfficiencyGate.status !== 'passed'
      ? 'incomplete_missing_math_postfix_efficiency_gate'
      : 'incomplete_operational_attention_remaining';
  const readinessCommand = 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance';
  const completionGateCommand = 'npm.cmd run csca-ai-questioning:subject-practice-completion-gate';
  const recommendedObservationBaseUrl = observationBaseUrl || 'http://127.0.0.1:3001';
  const mathObservationCommandBaseUrlArg = ` --base-url=${recommendedObservationBaseUrl}`;
  const mathObservationFreshAuthorizationText = [
    `Authorize exactly one backend-owned math observation task for production run #${mathObservationRunId}, cell #${mathObservationCellId},`,
    `using observation-only backend ${recommendedObservationBaseUrl},`,
    'after runtime cleanup and a successful provider recovery probe,',
    'accepting at most one background generation job with Provider, DB, gateway, candidate, gate, and evidence side effects,',
    'then stop after one terminal observation task result and verify no student pool publication without an automatic gate pass.'
  ].join(' ');
  const mathObservationNextAction = {
    status: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? 'ready_for_fresh_exact_versioned_authorization'
        : selectedFamilyLocalRepairComplete
        ? 'define_new_versioned_math_validation_protocol_without_provider'
        : selectedFamilyRequiresLocalRepair
        ? 'selected_family_bounded_quality_failed_local_repair_required'
        : mathGuardedFamilySelector.status === 'selected_and_locally_calibrated'
        ? 'validated_cell_closed_next_guarded_family_locally_calibrated'
        : 'validated_cell_select_next_guarded_family'
      : completionSatisfied
      ? 'complete'
      : providerHardStopBeforeLive
        ? 'wait_for_provider_recovery_before_fresh_authorization'
        : mathRecoveryDiagnosticsRequiredBeforeLive
          ? 'run_math_recovery_diagnostics_before_fresh_authorization'
        : mathObservationLiveEligibleForFreshAuthorization
        ? 'ready_for_fresh_exact_authorization'
        : 'start_observation_only_backend_then_rerun_preflight',
    executionReadiness: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? 'requires_fresh_exact_versioned_authorization'
        : 'no_additional_live_call_required_for_validated_cell'
      : providerHardStopBeforeLive
      ? 'provider_hard_stop_requires_recovery'
      : mathRecoveryDiagnosticsRequiredBeforeLive
        ? 'math_recovery_diagnostics_required'
      : mathObservationLiveEligibleForFreshAuthorization
      ? 'requires_fresh_exact_authorization'
      : 'requires_observation_only_backend_preflight',
    sideEffectScope: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? 'none_until_fresh_exact_versioned_authorization_then_three_serial_backend_owned_math_observations'
        : 'none_select_next_family_with_read_only_calibration'
      : 'none_until_fresh_exact_authorization_then_one_backend_owned_math_observation_task',
    target: validatedObservationCell && Number(selectedGuardedMathFamily.cellId) > 0
      ? {
        subject: 'math',
        productionRunId: mathObservationRunId,
        productionCellId: Number(selectedGuardedMathFamily.cellId),
        blueprintId: Number(selectedGuardedMathFamily.blueprintId) || null,
        taskFamily: selectedGuardedMathFamily.taskFamily ?? null,
        planTemplate: selectedGuardedMathFamily.planTemplate ?? null,
        validationProtocolVersion: selectedFutureLiveValidationPlan.target?.validationProtocolVersion ?? null,
        selectionRationale: selectedGuardedMathFamily.transferableEvidence?.level ?? 'guarded_family_selector'
      }
      : {
        subject: 'math',
        productionRunId: mathObservationRunId,
        productionCellId: mathObservationCellId,
        blueprintId: Number(mathExactCell.selectedBlueprintId) || null,
        selectionRationale: mathExactCell.rationale ?? null
      },
    authorizationText: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? `The repaired family is isolated under validation protocol ${selectedFutureLiveValidationPlan.target?.validationProtocolVersion}; a future authorization must name this protocol, math run #${mathObservationRunId}, cell #${Number(selectedGuardedMathFamily.cellId)}, three serial Provider calls, 0.006 USD per call, 0.02 USD total, and no student publication.`
        : selectedFamilyRequiresLocalRepair
        ? 'The selected family exhausted its three effective samples below the quality threshold. Do not request or send another Provider call; repair the prompt, plan, profile alignment, and output compaction locally first.'
        : mathGuardedFamilySelector.status === 'selected_and_locally_calibrated'
        ? 'The validated basic-function cell is closed and the next guarded family is locally calibrated; do not call Provider unless a fresh authorization names the selected family and exact call limit.'
        : 'The current math observation cell already has fresh publishable evidence and a passing postfix efficiency gate; do not spend another Provider call on this cell before selecting the next guarded family.'
      : providerHardStopBeforeLive
      ? 'No live Provider call or DB enqueue is recommended while provider auth/quota hard-stop signals are active.'
      : mathRecoveryDiagnosticsRequiredBeforeLive
        ? 'No live Provider call or DB enqueue is recommended while math production is blocked or below the acceptable yield floor.'
      : mathObservationFreshAuthorizationText,
    operatorCommands: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? selectedFutureLiveValidationPlan.operatorCommands ?? null
        : {
        guardedFamilySelector: `npm.cmd run csca-ai-questioning:math-guarded-family-selector -- --run=${mathObservationRunId} --validated-cell=${mathObservationCellId} --json`,
        selectedFamilyFixedEval: 'npm.cmd run csca-ai-questioning:subject-practice-fixed-eval -- --json',
        selectedCellPromptPreview: Number(selectedGuardedMathFamily.cellId) > 0
          ? `npm.cmd run csca-ai-questioning:subject-practice-exact-cell-enqueue -- --subject=math --run=${mathObservationRunId} --cell=${Number(selectedGuardedMathFamily.cellId)} --include-prompt-contract --json`
          : null
      }
      : {
        runtimeProcessAudit: 'npm.cmd run csca-ai-questioning:runtime-process-audit -- --json',
        runtimeProcessCleanupPlan: 'npm.cmd run csca-ai-questioning:runtime-process-cleanup-plan -- --json',
        runtimePrecheckOnly: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --runtime-precheck-only --json',
        providerRecoveryProbeAfterRuntimeCleanup: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean',
        startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${mathObservationCellId}`,
        targetPromptContractSelfTest: `npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=${mathObservationRunId} --cell=${mathObservationCellId} --json`,
        preflight: `npm.cmd run csca-ai-questioning:math-diversity-observation-preflight --${mathObservationCommandBaseUrlArg} --cell=${mathObservationCellId} --json`,
        previewObservationTask: `npm.cmd run csca-ai-questioning:math-diversity-observation-run -- --run=${mathObservationRunId} --cell=${mathObservationCellId}${mathObservationCommandBaseUrlArg} --json`,
        evidenceAfterTerminalTask: `npm.cmd run csca-ai-questioning:math-diversity-observation-evidence -- --subject=math${mathObservationCommandBaseUrlArg} --json`,
        completionGateAfterTerminalTask: `npm.cmd run csca-ai-questioning:math-observation-completion-gate -- --subject=math --run=${mathObservationRunId} --cell=${mathObservationCellId} --json`,
        scorecardAfterEvidence: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=math --math-run=${mathObservationRunId} --sample=80 --json`,
        noProviderAcceptanceAfterEvidence: `npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance --${mathObservationCommandBaseUrlArg} --json`
      }
  };
  const mathContentSkeletonReady = mathScorecard.mathQuestionPlanSkeletonCoverage?.status === 'all_open_math_cells_have_preferred_prompt_skeletons';
  const mathExactCellPlanReady = mathExactCell.exactObservationGateAllowed === true
    && mathExactCell.exactObservationAttemptStatus === 'plan_ready';
  const providerRecoveryReadyForOneShot = providerRecoveryState.hardStopActive === false
    && providerHardStopBeforeLive === false
    && mathRecoveryDiagnosticsRequiredBeforeLive === false;
  const runtimeReadyForProviderRecoveryProbe = runtimeProcessAudit.status === 'passed';
  const observationBackendReadyForOneShot = mathObservationReadyForFreshAuthorization === true
    && activeObservationTaskCount === 0
    && activeObservationJobCount === 0;
  const mathSingleRunBlockers = uniqueStrings([
    ...(mathContentSkeletonReady ? [] : ['math_content_skeleton_coverage_missing_or_incomplete']),
    ...(mathExactCellPlanReady ? [] : ['selected_math_cell_question_plan_not_ready']),
    ...(providerRecoveryReadyForOneShot ? [] : ['provider_recovery_not_proven_after_hard_stop']),
    ...(runtimeReadyForProviderRecoveryProbe ? [] : ['runtime_process_cleanup_or_elevated_audit_required']),
    ...(observationBackendReadyForOneShot
      ? []
      : preflight.backendReadinessSkipped
        ? ['observation_backend_readiness_skipped_for_preview']
        : ['observation_backend_preflight_not_ready']),
    ...(mathStageValidationSatisfied ? [] : ['live_math_stage_gate_evidence_missing'])
  ]);
  const mathSingleRunReadinessStatus = mathStageValidationSatisfied
    ? hasFreshCompleteSingleTaskMathEvidence
      ? 'fresh_single_task_gate_evidence_verified'
      : 'fresh_bounded_stage_gate_evidence_verified'
    : !mathContentSkeletonReady || !mathExactCellPlanReady
      ? 'blocked_by_math_content_readiness'
      : !providerRecoveryReadyForOneShot
        ? 'blocked_by_provider_recovery'
        : !runtimeReadyForProviderRecoveryProbe
          ? 'blocked_by_runtime_process_cleanup'
          : !observationBackendReadyForOneShot
            ? 'blocked_by_observation_backend_preflight'
            : 'ready_for_one_authorized_observation_task';
  const mathSingleRunReadiness = {
    mode: 'audit_only_math_single_run_readiness',
    status: mathSingleRunReadinessStatus,
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_runtime_state_or_fixture_only',
    studentConsumableImpact: 'none_does_not_publish_to_student_pool',
    acceptableEfficiencyStillUnproven: !mathStageValidationSatisfied,
    blockers: mathSingleRunBlockers,
    readinessSignals: {
      mathContentSkeletonReady,
      mathExactCellPlanReady,
      providerRecoveryReadyForOneShot,
      runtimeReadyForProviderRecoveryProbe,
      observationBackendReadyForOneShot,
      hasFreshLiveMathGateEvidence,
      hasFreshCompleteSingleTaskMathEvidence,
      hasFreshBoundedMathStageEvidence,
      mathStageValidationSatisfied
    },
    efficiencyBaseline: {
      generatedToApprovedYield: mathScorecard.generatedToApprovedYield ?? null,
      attemptToApprovedYield: mathScorecard.attemptToApprovedYield ?? null,
      deliveryIssueShareOfAttempts: mathScorecard.deliveryIssueShareOfAttempts ?? null,
      nextEfficiencyLever: mathScorecard.nextEfficiencyLever ?? null,
      postProviderRecoveryEfficiencyLever: mathScorecard.postProviderRecoveryEfficiencyLever ?? null
    },
    target: mathObservationNextAction.target,
    nextSafeAction: validatedObservationCell
      ? selectedFamilyVersionedProtocolReady
        ? 'wait_for_fresh_exact_versioned_authorization_before_bounded_validation'
        : selectedFamilyLocalRepairComplete
        ? 'define_new_versioned_math_validation_protocol_without_provider'
        : selectedFamilyRequiresLocalRepair
        ? 'repair_selected_guarded_math_family_locally_after_bounded_quality_failure'
        : mathGuardedFamilySelector.status === 'selected_and_locally_calibrated'
        ? 'selected_guarded_math_family_locally_calibrated_wait_for_fresh_live_authorization'
        : mathGuardedFamilySelector.status === 'selected_for_no_provider_calibration'
          ? 'calibrate_selected_guarded_math_family_with_no_provider_fixed_eval'
          : 'select_next_guarded_math_family_with_no_provider_calibration'
      : ['fresh_single_task_gate_evidence_verified', 'fresh_bounded_stage_gate_evidence_verified'].includes(mathSingleRunReadinessStatus)
      ? 'run_completion_gate_and_compare_post_fix_yield'
      : mathSingleRunReadinessStatus === 'ready_for_one_authorized_observation_task'
        ? 'request_fresh_exact_authorization_then_submit_one_backend_owned_math_observation_task'
        : mathObservationNextAction.status,
    authorizationText: mathObservationNextAction.authorizationText,
    operatorCommands: mathObservationNextAction.operatorCommands,
    evidenceLimit: validatedObservationCell
      ? 'validated_cell_efficiency_does_not_transfer_as_live_quality_proof_for_the_selected_next_family'
      : 'does_not_prove_acceptable_math_efficiency_until_one_fresh_live_gate_result_exists'
  };
  const nextStep = validatedObservationCell
    ? selectedFamilyVersionedProtocolReady
      ? 'wait_for_fresh_exact_versioned_authorization_before_bounded_validation'
      : selectedFamilyLocalRepairComplete
      ? 'define_new_versioned_math_validation_protocol_without_provider'
      : selectedFamilyRequiresLocalRepair
      ? 'repair_selected_guarded_math_family_locally_after_bounded_quality_failure'
      : mathGuardedFamilySelector.status === 'selected_and_locally_calibrated'
      ? 'selected_guarded_math_family_locally_calibrated_wait_for_fresh_live_authorization'
      : mathGuardedFamilySelector.status === 'selected_for_no_provider_calibration'
        ? 'calibrate_selected_guarded_math_family_with_no_provider_fixed_eval'
        : 'select_next_guarded_math_family_with_no_provider_calibration'
    : completionSatisfied
    ? 'complete'
    : providerHardStopBeforeLive
      ? 'wait_for_provider_recovery_before_fresh_exact_authorization'
      : mathRecoveryDiagnosticsRequiredBeforeLive
        ? 'run_math_recovery_diagnostics_before_fresh_exact_authorization'
      : mathObservationLiveEligibleForFreshAuthorization
      ? 'submit_guarded_math_observation_after_fresh_exact_authorization'
      : rolloutGate.nextStep ?? 'start_observation_only_backend_then_rerun_preflight';
  const report = {
    mode: 'subject_practice_no_provider_acceptance',
    status: acceptanceStatus,
    acceptanceScope: 'mechanism_readiness_no_provider',
    goalCompletionStatus: completionSatisfied
      ? 'complete'
      : incompleteGoalCompletionStatus,
    nextStep,
    productionImpact: 'none_audit_or_fixture_only',
    actualRuntimeImpact: 'none_no_mutation_no_provider_call',
    liveSubmissionImpactNotExercised: 'bounded_one_background_slot_backend_owned',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_runtime_state_or_fixture_only',
    liveObservationSubmitted: false,
    observationBaseUrl: observationBaseUrl || null,
    mathObservationPreflightStatus: preflight.status ?? null,
    mathObservationReadyForFreshAuthorization,
    mathObservationLiveEligibleForFreshAuthorization,
    providerHardStopBeforeLive,
    mathRecoveryDiagnosticsRequiredBeforeLive,
    noLiveRecommendedBeforeRecovery,
    mathPublishableEvidence: mathStageValidationSatisfied
      ? hasFreshCompleteSingleTaskMathEvidence
        ? observationEvidence.mathPublishableEvidence
        : 'fresh_bounded_stage_gate_pass'
      : 'missing_fresh_live_gate_evidence',
    mathStageValidationEvidence: {
      satisfied: mathStageValidationSatisfied,
      source: hasFreshCompleteSingleTaskMathEvidence
        ? 'latest_single_task_publishable_gate'
        : hasFreshBoundedMathStageEvidence
          ? 'fresh_bounded_stage_efficiency_gate'
          : 'missing',
      hasFreshLiveMathGateEvidence,
      hasFreshCompleteSingleTaskMathEvidence,
      hasFreshBoundedMathStageEvidence,
      currentValidatedCell: currentGuardedValidatedCell,
      latestSingleTaskSchedulerAdherenceStatus: observationEvidence.schedulerAdherenceStatus ?? null,
      historicalLatestTaskMetadataRepaired: latestSingleTaskSchedulerAdherenceSatisfied
    },
    doesNotProve: [
      ...mathStageValidationSatisfied ? [] : ['math_candidates_publishable'],
      'math_generation_efficiency_at_scale',
      'student_consumable_quality',
      ...mathStageValidationSatisfied ? [] : ['provider_backed_fresh_gate_pass'],
      ...hasFreshBoundedMathStageEvidence && !hasFreshCompleteSingleTaskMathEvidence
        ? ['latest_single_task_scheduler_adherence_metadata_consistency']
        : [],
      ...(['selected_for_no_provider_calibration', 'selected_and_locally_calibrated', 'selected_requires_local_repair_after_bounded_failure', 'selected_local_repair_completed_new_protocol_required', 'selected_versioned_validation_protocol_ready_for_authorization_review'].includes(mathGuardedFamilySelector.status)
        ? ['selected_guarded_math_family_provider_backed_quality']
        : [])
    ],
    operationalWaitCodes,
    activeObservationTaskCount,
    activeObservationJobCount,
    observationBackendReadiness: {
      loaded: preflight.backendReadinessLoaded ?? null,
      skipped: preflight.backendReadinessSkipped ?? null,
      source: preflight.backendReadinessSource ?? null,
      error: preflight.backendReadinessError ?? null,
      targetProductionCellId: preflight.targetProductionCellId ?? null,
      questionPlanEnabled: preflight.questionPlanEnabled ?? null,
      questionPlanCellAllowed: preflight.questionPlanCellAllowed ?? null,
      questionPlanReadyForTarget: preflight.questionPlanReadyForTarget ?? null,
      questionPlanCellAllowlist: preflight.questionPlanCellAllowlist ?? null,
      warnings: preflight.warnings ?? []
    },
    latestObservationTaskId: observationEvidence.taskId ?? null,
    latestObservationGateDecision: observationEvidence.gateDecision ?? null,
    latestObservationDeliveryFailure: observationEvidence.deliveryFailure ?? null,
    latestObservationSchedulerAdherence: observationEvidence.schedulerAdherenceStatus ?? null,
    latestObservationGatewayBinding: observationEvidence.gatewayBinding ?? null,
    latestObservationJobCountForTask: observationEvidence.observationJobCountForTask ?? null,
    latestObservationOneJobForTask: observationEvidence.oneObservationJobForTask ?? null,
    latestChemistryRunId: observationEvidence.latestChemistryRunId ?? null,
    latestChemistryRunStatus: observationEvidence.latestChemistryRunStatus ?? null,
    latestChemistryRunPublished: observationEvidence.latestChemistryRunPublished ?? null,
    latestChemistryRunOpen: observationEvidence.latestChemistryRunOpen ?? null,
    latestChemistryRunBlockedReason: observationEvidence.latestChemistryRunBlockedReason ?? null,
    subjectPracticeNextActionStatus: nextAction.decisionStatus ?? null,
    subjectPracticeNextActionRecommendedType: nextAction.recommendedType ?? null,
    subjectPracticeNextActionOperatorCommands: nextAction.operatorCommands ?? null,
    subjectPracticeNextActionAuthorizationText: nextAction.explicitAuthorizationRequired ?? null,
    subjectPracticeCapacityFillStatus: nextAction.capacityFillStatus ?? null,
    subjectPracticeCapacityFillOperatorCommands: nextAction.capacityFillOperatorCommands ?? null,
    subjectPracticeCapacityFillAuthorizationText: nextAction.capacityFillExplicitAuthorizationRequired ?? null,
    subjectPracticeActionQueue: nextAction.actionQueue ?? null,
    subjectPracticeThroughputEfficiencyStatus: nextAction.throughputEfficiency?.status ?? null,
    subjectPracticeThroughputEfficiency: nextAction.throughputEfficiency ?? null,
    subjectPracticeDispatchCapacity: nextAction.dispatchCapacity ?? null,
    subjectPracticeProviderBackoff: nextAction.providerBackoff ?? null,
    mathQuestionPlanRetryFeedbackCoverageStatus: mathRetryFeedbackCoverage.status ?? null,
    mathQuestionPlanRetryFeedbackCoverage: {
      policyFailureCodeCount: mathRetryFeedbackCoverage.policyFailureCodeCount ?? null,
      coveredFailureCodeCount: mathRetryFeedbackCoverage.coveredFailureCodeCount ?? null,
      missingFeedbackCodes: mathRetryFeedbackCoverage.missingFeedbackCodes ?? [],
      genericQuestionPlanRetryVisible: mathRetryFeedbackCoverage.genericQuestionPlanRetryVisible ?? null,
      evidenceLimit: mathRetryFeedbackCoverage.evidenceLimit ?? null
    },
    mathCurrentHistoricalFailureRepairCoverageStatus: mathCurrentHistoricalFailureRepairCoverage.status ?? null,
    mathCurrentHistoricalFailureRepairCoverage: {
      status: mathCurrentHistoricalFailureRepairCoverage.status ?? null,
      checkedHistoricalVerdictCount: mathCurrentHistoricalFailureRepairCoverage.checkedHistoricalVerdictCount ?? null,
      coveredHistoricalVerdictCount: mathCurrentHistoricalFailureRepairCoverage.coveredHistoricalVerdictCount ?? null,
      missingHistoricalVerdicts: mathCurrentHistoricalFailureRepairCoverage.missingHistoricalVerdicts ?? [],
      coveredHistoricalVerdicts: mathCurrentHistoricalFailureRepairCoverage.coveredHistoricalVerdicts ?? [],
      alreadyMatchingPlanShapeVerdictCount: mathCurrentHistoricalFailureRepairCoverage.alreadyMatchingPlanShapeVerdictCount ?? null,
      alreadyMatchingPlanShapeVerdicts: mathCurrentHistoricalFailureRepairCoverage.alreadyMatchingPlanShapeVerdicts ?? [],
      evidenceLimit: mathCurrentHistoricalFailureRepairCoverage.evidenceLimit ?? null
    },
    mathResidualReviewerRouteReadinessStatus: mathResidualReviewerRouteReadiness.status ?? null,
    mathResidualReviewerRouteReadiness: {
      status: mathResidualReviewerRouteReadiness.status ?? null,
      runId: mathResidualReviewerRouteReadiness.runId ?? null,
      residualRouteCellCount: mathResidualReviewerRouteReadiness.residualRouteCellCount ?? null,
      exactPromptContractPassedCount: mathResidualReviewerRouteReadiness.exactPromptContractPassedCount ?? null,
      routeCounts: mathResidualReviewerRouteReadiness.routeCounts ?? [],
      cells: mathResidualReviewerRouteReadiness.cells ?? [],
      issues: mathResidualReviewerRouteReadiness.issues ?? [],
      evidenceLimit: mathResidualReviewerRouteReadiness.evidenceLimit ?? null
    },
    mathPostfixEfficiencyGateStatus: mathPostfixEfficiencyGate.status ?? null,
    mathPostfixEfficiencyGate: {
      status: mathPostfixEfficiencyGate.status ?? null,
      runId: mathPostfixEfficiencyGate.runId ?? null,
      efficiencySatisfied: mathPostfixEfficiencyGate.efficiencySatisfied ?? null,
      thresholds: mathPostfixEfficiencyGate.thresholds ?? null,
      sampleCounts: mathPostfixEfficiencyGate.sampleCounts ?? null,
      yields: mathPostfixEfficiencyGate.yields ?? null,
      reasons: mathPostfixEfficiencyGate.reasons ?? [],
      doesNotProve: mathPostfixEfficiencyGate.doesNotProve ?? [],
      scope: mathPostfixEfficiencyGate.scope ?? null,
      evidenceLimit: mathPostfixEfficiencyGate.evidenceLimit ?? null
    },
    mathGuardedFamilySelectionStatus: mathGuardedFamilySelector.status ?? null,
    mathGuardedFamilySelection: {
      validatedCell: mathGuardedFamilySelector.validatedCell ?? null,
      validatedCells: guardedValidatedCells,
      validationDiscovery: mathGuardedFamilySelector.validationDiscovery ?? null,
      selectionPolicy: mathGuardedFamilySelector.selectionPolicy ?? null,
      evidenceVerification: mathGuardedFamilySelector.evidenceVerification ?? null,
      selected: selectedGuardedMathFamily,
      localCalibration: mathGuardedFamilySelector.localCalibration ?? null,
      nextAction: mathGuardedFamilySelector.nextAction ?? null,
      futureLiveValidationPlan: mathGuardedFamilySelector.futureLiveValidationPlan ?? null
    },
    mathExactCellPreview: {
      status: mathExactCell.status ?? null,
      selectedCellId: mathExactCell.selectedCellId ?? null,
      selectedBlueprintId: mathExactCell.selectedBlueprintId ?? null,
      questionPlanPreviewSource: mathExactCell.questionPlanPreviewSource ?? null,
      questionPlanTemplate: mathExactCell.questionPlanTemplate ?? null,
      questionPlanTaskFamily: mathExactCell.questionPlanTaskFamily ?? null,
      exactObservationGateMode: mathExactCell.exactObservationGateMode ?? null,
      exactObservationGateAllowed: mathExactCell.exactObservationGateAllowed ?? null,
      exactObservationAttemptStatus: mathExactCell.exactObservationAttemptStatus ?? null,
      promptContractPreview: mathExactCell.promptContractPreview ?? null
    },
    mathBasicFunctionExactPromptContract,
    mathScorecard: {
      status: mathScorecard.status ?? null,
      runStatus: mathScorecard.runStatus ?? null,
      blockedReason: mathScorecard.blockedReason ?? null,
      open: mathScorecard.open ?? null,
      generatedToApprovedYield: mathScorecard.generatedToApprovedYield ?? null,
      attemptToApprovedYield: mathScorecard.attemptToApprovedYield ?? null,
      deliveryIssueShareOfAttempts: mathScorecard.deliveryIssueShareOfAttempts ?? null,
      nextEfficiencyLever: mathScorecard.nextEfficiencyLever ?? null,
      postProviderRecoveryEfficiencyLever: mathScorecard.postProviderRecoveryEfficiencyLever ?? null,
      attention: mathScorecard.attention ?? [],
      questionPlanOpenCount: mathScorecard.questionPlanOpenCount ?? null,
      reviewerValidatorOpenCount: mathScorecard.reviewerValidatorOpenCount ?? null,
      reviewerGateOrQuestionPlanOpenCount: mathScorecard.reviewerGateOrQuestionPlanOpenCount ?? null,
      mathQuestionPlanSkeletonCoverage: mathScorecard.mathQuestionPlanSkeletonCoverage ?? null
    },
    mathAllExactCellQuestionPlanReadiness: {
      status: mathAllExactCellReadiness.status ?? null,
      runId: mathAllExactCellReadiness.runId ?? null,
      totalCellCount: mathAllExactCellReadiness.totalCellCount ?? null,
      planReadyCount: mathAllExactCellReadiness.planReadyCount ?? null,
      compatibleSchedulerHintCount: mathAllExactCellReadiness.compatibleSchedulerHintCount ?? null,
      promptContractPassedCount: mathAllExactCellReadiness.promptContractPassedCount ?? null,
      promptContractMissingRequiredPhraseCount: mathAllExactCellReadiness.promptContractMissingRequiredPhraseCount ?? null,
      promptContractIssueCount: mathAllExactCellReadiness.promptContractIssueCount ?? null,
      promptBudgetCoverageCount: mathAllExactCellReadiness.promptBudgetCoverageCount ?? null,
      promptBudgetPassedCount: mathAllExactCellReadiness.promptBudgetPassedCount ?? null,
      promptBudgetExceededCount: mathAllExactCellReadiness.promptBudgetExceededCount ?? null,
      maximumPromptCharacterCount: mathAllExactCellReadiness.maximumPromptCharacterCount ?? null,
      rejectedSchedulerHintCount: mathAllExactCellReadiness.rejectedSchedulerHintCount ?? null,
      fallbackIncompatibleCount: mathAllExactCellReadiness.fallbackIncompatibleCount ?? null,
      issueCount: mathAllExactCellReadiness.issueCount ?? null,
      normalDistributionCells: mathAllExactCellReadiness.normalDistributionCells ?? [],
      elementaryFunctionCells: mathAllExactCellReadiness.elementaryFunctionCells ?? []
    },
    providerRecoveryState: {
      status: providerRecoveryState.status ?? null,
      hardStopActive: providerRecoveryState.hardStopActive ?? null,
      recoveredAfterHardStop: providerRecoveryState.recoveredAfterHardStop ?? null,
      latestHardStopAt: providerRecoveryState.latestHardStopAt ?? null,
      latestRecoverySuccessAt: providerRecoveryState.latestRecoverySuccessAt ?? null,
      errorCode: providerRecoveryState.errorCode ?? null,
      errorMessagePreview: providerRecoveryState.errorMessagePreview ?? null,
      latestRecoveryProbeCount: providerRecoveryState.latestRecoveryProbeCount ?? null,
      nextSafeAction: providerRecoveryState.nextSafeAction ?? null
    },
    runtimeProcessAudit: {
      status: runtimeProcessAudit.auditStatus ?? null,
      checkStatus: runtimeProcessAudit.status ?? null,
      backendRunnerCount: runtimeProcessAudit.backendRunnerCount ?? null,
      duplicateOrMixedBackendRisk: runtimeProcessAudit.duplicateOrMixedBackendRisk ?? null,
      nextSafeAction: runtimeProcessAudit.nextSafeAction ?? null,
      countByCategory: runtimeProcessAudit.countByCategory ?? null,
      inspectionError: runtimeProcessAudit.inspectionError ?? null
    },
    mathObservationNextAction,
    mathSingleRunReadiness,
    mathObservationFreshAuthorizationText: mathObservationNextAction.authorizationText,
    mathObservationOperatorCommands: mathObservationNextAction.operatorCommands,
    completionSatisfied,
    readinessCommand,
    completionGateCommand,
    completionAudit,
    nextLiveValidation,
    checks
  };
  if (hasFlag('summary-only')) console.log(JSON.stringify(compactSummaryReport(report), null, 2));
  else if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Subject-practice no-provider acceptance: ${report.status}`);
    for (const check of checks) {
      const suffix = check.nextStep ? `, next=${check.nextStep}` : '';
      console.log(`- ${check.label}: ${check.status}${suffix}`);
    }
    console.log(`Completion status: ${report.goalCompletionStatus}`);
    if (report.mathAllExactCellQuestionPlanReadiness?.status) {
      const readiness = report.mathAllExactCellQuestionPlanReadiness;
      console.log(`Math all-cell readiness: ${readiness.planReadyCount}/${readiness.totalCellCount} plan_ready, compatible scheduler hints=${readiness.compatibleSchedulerHintCount}, rejected=${readiness.rejectedSchedulerHintCount}, fallbackIncompatible=${readiness.fallbackIncompatibleCount}`);
    }
    console.log(`Readiness command: ${readinessCommand}`);
    console.log(`Completion gate command: ${completionGateCommand}`);
    for (const item of completionAudit) {
      const evidence = auditEvidenceText(item.evidence);
      const suffix = evidence ? ` (${evidence})` : '';
      console.log(`- ${item.requirement}: ${item.status}${suffix}`);
    }
  if (report.subjectPracticeNextActionStatus) {
      console.log(`Subject-practice next action: ${report.subjectPracticeNextActionStatus}, recommended=${report.subjectPracticeNextActionRecommendedType ?? 'none'}, throughput=${report.subjectPracticeThroughputEfficiencyStatus ?? 'unknown'}`);
      if (report.subjectPracticeProviderBackoff?.hardStopSourceSamples?.length) {
        const sample = report.subjectPracticeProviderBackoff.hardStopSourceSamples[0];
        console.log(`Subject-practice latest hard-stop source: ${sample.subject || 'unknown'} topic=${sample.topicId || 'n/a'} blueprint=${sample.blueprintId || 'n/a'} task=${sample.taskType || 'n/a'} code=${sample.errorCode || 'n/a'} at=${sample.createdAt || 'n/a'}`);
      }
      if (report.subjectPracticeActionQueue?.items?.length) console.log(`Subject-practice action queue: ${report.subjectPracticeActionQueue.items.length} item(s), ordering=${report.subjectPracticeActionQueue.orderingPolicy}`);
      if (report.subjectPracticeNextActionAuthorizationText) console.log(`Subject-practice next authorization: ${report.subjectPracticeNextActionAuthorizationText}`);
      if (report.subjectPracticeCapacityFillAuthorizationText) console.log(`Subject-practice capacity-fill authorization: ${report.subjectPracticeCapacityFillAuthorizationText}`);
    }
    if (report.providerRecoveryState?.status) {
      console.log(`Provider recovery state: ${report.providerRecoveryState.status}, hardStop=${report.providerRecoveryState.hardStopActive}, code=${report.providerRecoveryState.errorCode ?? 'none'}`);
      console.log(`Provider recovery next action: ${report.providerRecoveryState.nextSafeAction ?? 'none'}`);
    }
    if (report.mathQuestionPlanRetryFeedbackCoverageStatus) {
      const coverage = report.mathQuestionPlanRetryFeedbackCoverage ?? {};
      console.log(`Math retry feedback coverage: ${report.mathQuestionPlanRetryFeedbackCoverageStatus}, covered=${coverage.coveredFailureCodeCount ?? 'unknown'}/${coverage.policyFailureCodeCount ?? 'unknown'}, missing=${arrayFrom(coverage.missingFeedbackCodes).length}`);
    }
    if (report.mathCurrentHistoricalFailureRepairCoverageStatus) {
      const coverage = report.mathCurrentHistoricalFailureRepairCoverage ?? {};
      console.log(`Math historical repair coverage: ${report.mathCurrentHistoricalFailureRepairCoverageStatus}, covered=${coverage.coveredHistoricalVerdictCount ?? 'unknown'}/${coverage.checkedHistoricalVerdictCount ?? 'unknown'}, missing=${arrayFrom(coverage.missingHistoricalVerdicts).length}`);
    }
    if (report.mathResidualReviewerRouteReadinessStatus) {
      const readiness = report.mathResidualReviewerRouteReadiness ?? {};
      console.log(`Math residual reviewer-route readiness: ${report.mathResidualReviewerRouteReadinessStatus}, promptContracts=${readiness.exactPromptContractPassedCount ?? 'unknown'}/${readiness.residualRouteCellCount ?? 'unknown'}, issues=${arrayFrom(readiness.issues).length}`);
    }
    if (report.mathPostfixEfficiencyGateStatus) {
      const gate = report.mathPostfixEfficiencyGate ?? {};
      console.log(`Math post-fix efficiency gate: ${report.mathPostfixEfficiencyGateStatus}, terminal=${gate.sampleCounts?.terminalTaskCount ?? 'unknown'}/${gate.sampleCounts?.taskCount ?? 'unknown'}, gateYield=${gate.yields?.gatePublishableYield ?? 'n/a'}`);
    }
    if (report.mathScorecard?.postProviderRecoveryEfficiencyLever) {
      console.log(`Math post-provider-recovery lever: ${report.mathScorecard.postProviderRecoveryEfficiencyLever.lever}, open=${report.mathScorecard.open ?? 'unknown'}, qplanOpen=${report.mathScorecard.questionPlanOpenCount ?? 'unknown'}`);
    }
    if (report.mathScorecard?.mathQuestionPlanSkeletonCoverage) {
      const coverage = report.mathScorecard.mathQuestionPlanSkeletonCoverage;
      console.log(`Math skeleton coverage: ${coverage.status}, covered=${coverage.coveredOpenCellCount ?? 'unknown'}/${coverage.openCellCount ?? 'unknown'}, missing=${coverage.missingSkeletonCellCount ?? 'unknown'}`);
    }
    if (report.runtimeProcessAudit?.status) {
      console.log(`Runtime process audit: ${report.runtimeProcessAudit.status}, backendRunners=${report.runtimeProcessAudit.backendRunnerCount ?? 'unknown'}, duplicateOrMixed=${report.runtimeProcessAudit.duplicateOrMixedBackendRisk}`);
      console.log(`Runtime process next action: ${report.runtimeProcessAudit.nextSafeAction ?? 'none'}`);
    }
    console.log(`Next live validation: ${nextLiveValidation.allowedScope}, requiresFreshAuthorization=${nextLiveValidation.requiresFreshAuthorization}, target=${nextLiveValidation.target.subject}#${nextLiveValidation.target.productionRunId}/#${nextLiveValidation.target.productionCellId}`);
    console.log(`Math observation next action: ${mathObservationNextAction.status}, readiness=${mathObservationNextAction.executionReadiness}`);
    console.log(`Math single-run readiness: ${mathSingleRunReadiness.status}, blockers=${mathSingleRunReadiness.blockers.join('|') || 'none'}`);
    console.log(`Math observation authorization: ${mathObservationNextAction.authorizationText}`);
  }
  if (hasFlag('require-complete') && !completionSatisfied) {
    console.error('Subject-practice no-provider acceptance is not complete: fresh live math gate evidence is still missing.');
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  if (hasFlag('json') && isDatabaseUnavailableError(error)) {
    const checks = [];
    pushCheck(checks, runSubjectPracticeFixedEval);
    pushCheck(checks, runObservationTaskRules);
    pushCheck(checks, runBoundedMathFamilyValidationSelfTest);
    const report = {
      mode: 'subject_practice_no_provider_acceptance',
      status: 'operational_wait',
      acceptanceScope: 'mechanism_readiness_no_provider',
      goalCompletionStatus: 'incomplete_database_unavailable',
      nextStep: 'start_database_then_rerun_no_provider_acceptance',
      productionImpact: 'none_audit_or_fixture_only',
      actualRuntimeImpact: 'none_no_mutation_no_provider_call',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_failed_database_unavailable',
      liveObservationSubmitted: false,
      mathPublishableEvidence: 'unverified_database_unavailable',
      doesNotProve: [
        'runtime_subject_practice_state',
        'student_consumable_quality',
        'provider_backed_fresh_gate_pass'
      ],
      operationalWaitCodes: ['database_unavailable'],
      completionSatisfied: false,
      readinessCommand: 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance',
      completionGateCommand: 'npm.cmd run csca-ai-questioning:subject-practice-completion-gate',
      completionAudit: [
        {
          requirement: 'runtime_database_available_for_read_only_audit',
          status: 'missing',
          evidence: 'database_unavailable'
        },
        {
          requirement: 'no_provider_no_submission_stage_acceptance',
          status: checks.every((check) => check.status === 'passed') ? 'satisfied_static_only' : 'missing',
          evidence: checks
        }
      ],
      checks,
      error: {
        code: 'database_unavailable',
        message: compactErrorMessage(error)
      }
    };
    console.log(JSON.stringify(report, null, 2));
    if (hasFlag('require-complete')) process.exitCode = 1;
  } else {
  console.error(error);
  process.exit(1);
  }
}
