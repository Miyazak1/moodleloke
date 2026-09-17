#!/usr/bin/env node

const cp = require('node:child_process');
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

function positiveInt(name, fallback) {
  const value = Number(argValue(name, fallback));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function firstJsonObject(output) {
  const text = String(output ?? '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`No JSON object found in output: ${text.slice(0, 240)}`);
  return JSON.parse(text.slice(start));
}

function runJson(script, args = []) {
  let output;
  try {
    output = cp.execFileSync(process.execPath, [path.resolve(__dirname, script), ...args, '--json'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 80 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    output = String(error?.stdout || error?.output?.[1] || '');
    if (!output.trim()) throw error;
  }
  return firstJsonObject(output);
}

function runJsonAllowFailure(script, args = []) {
  try {
    return { ok: true, report: runJson(script, args) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function subjectScorecard(scorecard) {
  return arrayFrom(scorecard?.subjects).find((item) => cleanText(item.subject) === 'math') || null;
}

function compactScorecard(scorecard) {
  const subject = subjectScorecard(scorecard);
  const funnel = subject?.fourFunnel || {};
  return {
    overallStatus: scorecard?.status || null,
    runId: subject?.runId ?? null,
    runStatus: subject?.runStatus ?? null,
    blockedReason: subject?.blockedReason ?? null,
    scorecardStatus: subject?.scorecardStatus ?? null,
    published: funnel.cappedPublishedTotal ?? null,
    reconciledPublished: funnel.reconciledPublishedTotal ?? null,
    target: funnel.targetTotal ?? null,
    open: funnel.computedOpenTotal ?? null,
    reconciledOpen: funnel.reconciledOpenTotal ?? null,
    attemptCount: funnel.attemptCount ?? null,
    generatedCount: funnel.generatedCount ?? null,
    approvedGeneratedCount: funnel.approvedGeneratedCount ?? null,
    generatedToApprovedYield: funnel.generatedToApprovedYield ?? null,
    attemptToApprovedYield: funnel.attemptToApprovedYield ?? null,
    throughputStatus: subject?.throughputEfficiency?.status ?? null,
    throughputReasons: subject?.throughputEfficiency?.reasons ?? [],
    nextEfficiencyLever: subject?.throughputEfficiency?.nextEfficiencyLever ?? null,
    p0p1Count: arrayFrom(subject?.bottlenecks?.p0p1).length
  };
}

function compactNextAction(nextAction) {
  const first = arrayFrom(nextAction?.actionQueue?.items)[0] || null;
  return {
    decisionStatus: nextAction?.decision?.status ?? null,
    throughputStatus: nextAction?.throughputEfficiency?.status ?? null,
    nextEfficiencyLever: nextAction?.throughputEfficiency?.nextEfficiencyLever ?? null,
    firstQueueItem: first ? {
      role: first.role ?? null,
      status: first.status ?? null,
      actionType: first.actionType ?? null,
      executionReadiness: first.executionReadiness ?? null,
      sideEffectScope: first.sideEffectScope ?? null,
      target: first.target ?? null,
      operatorCommands: first.operatorCommands ?? null
    } : null
  };
}

function compactCalibration(calibration) {
  const summary = calibration?.summary || {};
  return {
    status: calibration?.status ?? null,
    runId: calibration?.runId ?? null,
    sampleCount: arrayFrom(calibration?.samples).length,
    cells: Object.entries(summary).map(([cellId, cell]) => ({
      cellId: Number(cellId),
      total: cell.total ?? 0,
      verdicts: cell.verdicts ?? {},
      gateReasons: cell.gateReasons ?? {},
      questionPlanAdheresCount: cell.questionPlanAdheresCount ?? 0,
      questionPlanAdherenceRate: Number(cell.total) > 0
        ? Number(((Number(cell.questionPlanAdheresCount) || 0) / Number(cell.total)).toFixed(4))
        : null,
      questionPlanFailureCodes: cell.questionPlanFailureCodes ?? {}
    }))
  };
}

function compactPreflight(preflight) {
  const admission = preflight?.runtimeState?.observationAdmission || {};
  const backendReadiness = preflight?.observationBackendReadiness || {};
  return {
    status: preflight?.status ?? null,
    failures: preflight?.failures ?? [],
    warnings: preflight?.warnings ?? [],
    waitReasons: preflight?.waitReasons ?? [],
    observationBackendReadiness: {
      source: backendReadiness.source ?? null,
      loaded: backendReadiness.loaded ?? null,
      productionCellId: backendReadiness.productionCellId ?? null,
      questionPlanEnabled: backendReadiness.questionPlanEnabled ?? admission.questionPlanEnabled ?? null,
      questionPlanCellAllowed: backendReadiness.questionPlanCellAllowed ?? null,
      questionPlanReadyForTarget: backendReadiness.questionPlanReadyForTarget ?? null,
      questionPlanCellAllowlist: backendReadiness.questionPlanCellAllowlist ?? admission.questionPlanCellAllowlist ?? null
    },
    runtimeState: preflight?.runtimeState ? {
      runningRunCount: preflight.runtimeState.runningRunCount,
      queuedRunCount: preflight.runtimeState.queuedRunCount,
      runningJobCount: preflight.runtimeState.runningJobCount,
      queuedJobCount: preflight.runtimeState.queuedJobCount,
      activeObservationTaskCount: preflight.runtimeState.activeObservationTaskCount,
      activeObservationJobCount: preflight.runtimeState.activeObservationJobCount,
      observationAdmission: {
        taskEnabled: admission.taskEnabled,
        executionEnabled: admission.executionEnabled,
        singletonConfirmed: admission.singletonConfirmed,
        observationOnlyMode: admission.observationOnlyMode,
        questionPlanEnabled: admission.questionPlanEnabled,
        questionPlanCellAllowlist: admission.questionPlanCellAllowlist,
        cooldownRemainingSeconds: admission.cooldownRemainingSeconds
      }
    } : null
  };
}

function compactCurrentPolicyRefresh(refresh) {
  return {
    mode: refresh?.mode ?? null,
    subject: refresh?.subject ?? null,
    statuses: refresh?.statuses ?? [],
    runCount: arrayFrom(refresh?.runs).length,
    runs: arrayFrom(refresh?.runs).map((run) => ({
      productionRunId: run.productionRunId,
      runStatus: run.runStatus,
      blockerCount: run.blockerCount,
      runPublishedTotal: run.runPublishedTotal,
      runOpenTotal: run.runOpenTotal
    }))
  };
}

function compactOwnerRevalidationPlan(plan) {
  const owner = plan?.ownerRevalidation || {};
  const dryRun = plan?.dryRunGateEvidence || {};
  return {
    status: plan?.status ?? null,
    runStatus: plan?.runStatus ?? null,
    blockedReason: plan?.blockedReason ?? null,
    candidateGateReadyButRunBlocked: plan?.candidateGateReadyButRunBlocked === true,
    recommendedNextAction: plan?.recommendedNextAction ?? null,
    noGoReasons: arrayFrom(plan?.noGoReasons),
    lowRiskCandidateIds: arrayFrom(owner.lowRiskCandidateIds),
    formalGatePublishableCandidateIds: arrayFrom(owner.formalGatePublishableCandidateIds),
    formalGateBlockedCandidateIds: arrayFrom(owner.formalGateBlockedCandidateIds),
    formalGateBlockedReasonCounts: owner.formalGateBlockedReasonCounts || {},
    dryRunGateEvidence: dryRun ? {
      productionImpact: dryRun.productionImpact ?? null,
      providerImpact: dryRun.providerImpact ?? null,
      found: dryRun.found ?? null,
      wouldAutoApprove: dryRun.wouldAutoApprove ?? null,
      blocked: dryRun.blocked ?? null
    } : null
  };
}

function compactObservationEvidence(result, freshnessWindowDays) {
  if (!result.ok) return { status: 'unavailable', error: result.error };
  const report = result.report || {};
  const completedAt = report.task?.completedAt ? Date.parse(report.task.completedAt) : null;
  const completedAgeDays = Number.isFinite(completedAt)
    ? Number(((Date.now() - completedAt) / 86_400_000).toFixed(2))
    : null;
  const freshLiveGateEvidenceForCompletion = completedAgeDays != null
    && completedAgeDays <= freshnessWindowDays
    && report.question?.gateDecision === 'publishable';
  return {
    status: report.status ?? null,
    taskId: report.taskId ?? null,
    freshnessWindowDays,
    completedAgeDays,
    freshLiveGateEvidenceForCompletion,
    task: report.task ? {
      status: report.task.status,
      productionRunId: report.task.productionRunId,
      productionCellId: report.task.productionCellId,
      completedAt: report.task.completedAt
    } : null,
    generationJob: report.generationJob ? {
      id: report.generationJob.id,
      status: report.generationJob.status,
      questionId: report.generationJob.questionId,
      schedulerHintAdherence: report.generationJob.schedulerHintAdherence,
      providerFailureCategory: report.generationJob.providerFailureCategory
    } : null,
    question: report.question ? {
      id: report.question.id,
      status: report.question.status,
      gateDecision: report.question.gateDecision
    } : null
  };
}

function preferredCellFrom(nextAction, fallback) {
  const target = nextAction?.decision?.recommended || {};
  return Number(target.candidateCellId) || Number(fallback) || null;
}

function diagnosticReasonCode(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const code = cleanText(value.code);
    const detail = cleanText(value.detail);
    return code ? (detail ? `${code}:${detail}` : code) : cleanText(JSON.stringify(value));
  }
  return cleanText(value);
}

function recommendationFor({ runId, cellId, scorecard, preflight, calibration, exactCellEnqueue, latestObservationEvidence, postfixEfficiency, observationBaseUrl }) {
  const score = compactScorecard(scorecard);
  const pre = compactPreflight(preflight);
  const postfixPassed = cleanText(postfixEfficiency?.status) === 'passed'
    && postfixEfficiency?.efficiencySatisfied === true;
  const validatedObservationCell = postfixPassed
    && latestObservationEvidence?.freshLiveGateEvidenceForCompletion === true;
  const exactPreflightFailures = arrayFrom(exactCellEnqueue?.preflight?.failures);
  const calibrationCells = compactCalibration(calibration).cells;
  const recoveryReasons = [];
  if (score.blockedReason) recoveryReasons.push(`run_safely_auto_disabled:${score.blockedReason}`);
  if (!validatedObservationCell && score.throughputStatus === 'below_acceptable_efficiency') recoveryReasons.push('math_throughput_below_acceptable_efficiency');
  if (!validatedObservationCell && (score.generatedToApprovedYield ?? 1) < 0.35) recoveryReasons.push('generated_to_approved_yield_below_threshold');
  if (!validatedObservationCell && (score.attemptToApprovedYield ?? 1) < 0.25) recoveryReasons.push('attempt_to_approved_yield_below_threshold');
  if (!latestObservationEvidence?.freshLiveGateEvidenceForCompletion) recoveryReasons.push('fresh_math_live_gate_evidence_missing_or_stale');
  const observationSubmissionBlockers = arrayFrom(pre.failures)
    .map(diagnosticReasonCode)
    .filter(Boolean)
    .map((failure) => `preflight:${failure}`);
  const observationOperationalWaits = arrayFrom(pre.waitReasons);
  if (['ready_after_observation_only_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(pre.status)) {
    observationOperationalWaits.push('observation_only_backend_start_required');
  }
  if (['ready_after_observation_question_plan_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(pre.status)) {
    observationOperationalWaits.push('observation_question_plan_backend_start_required');
  }
  const directEnqueueBlockers = exactPreflightFailures.map((failure) => `exact_enqueue:${failure}`);
  const baseUrlArg = observationBaseUrl ? ` --base-url=${observationBaseUrl}` : '';
  const preferredCellCalibration = calibrationCells.find((cell) => Number(cell.cellId) === Number(cellId)) || null;
  const dominantCalibration = preferredCellCalibration || calibrationCells
    .slice()
    .sort((left, right) => (right.total || 0) - (left.total || 0))[0] || null;
  return {
    status: validatedObservationCell
      ? 'validated_cell_select_next_guarded_family'
      : observationSubmissionBlockers.length
      ? 'guarded_observation_not_ready'
      : pre.status === 'eligible_for_backend_owned_observation_submission'
        ? 'ready_for_guarded_observation_authorization_review'
        : pre.status === 'ready_after_observation_only_question_plan_backend_start'
          ? 'ready_after_observation_only_question_plan_backend_start'
        : pre.status === 'ready_after_observation_question_plan_backend_start'
          ? 'ready_after_observation_question_plan_backend_start'
        : 'ready_after_observation_only_backend_start',
    recoveryReasons: Array.from(new Set(recoveryReasons)),
    validatedObservationCell,
    postfixEfficiency: {
      status: postfixEfficiency?.status ?? null,
      efficiencySatisfied: postfixEfficiency?.efficiencySatisfied ?? null,
      sampleCounts: postfixEfficiency?.sampleCounts ?? null,
      yields: postfixEfficiency?.yields ?? null,
      scope: postfixEfficiency?.scope ?? null
    },
    observationSubmissionBlockers: Array.from(new Set(observationSubmissionBlockers)),
    observationOperationalWaits: Array.from(new Set(observationOperationalWaits)),
    directEnqueueBlockers: Array.from(new Set(directEnqueueBlockers)),
    blockers: Array.from(new Set([...observationSubmissionBlockers, ...directEnqueueBlockers])),
    preferredRunId: runId,
    preferredCellId: cellId,
    calibrationFocus: dominantCalibration ? {
      cellId: dominantCalibration.cellId,
      verdicts: dominantCalibration.verdicts,
      questionPlanAdheresCount: dominantCalibration.questionPlanAdheresCount,
      questionPlanAdherenceRate: dominantCalibration.questionPlanAdherenceRate,
      questionPlanFailureCodes: dominantCalibration.questionPlanFailureCodes,
      topGateReasons: Object.entries(dominantCalibration.gateReasons || {})
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }))
    } : null,
    observationReadiness: {
      status: pre.status,
      readyAfterObservationOnlyBackendStart: ['ready_after_observation_only_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(pre.status),
      readyAfterObservationQuestionPlanBackendStart: ['ready_after_observation_question_plan_backend_start', 'ready_after_observation_only_question_plan_backend_start'].includes(pre.status),
      observationBackendReadiness: pre.observationBackendReadiness,
      warnings: pre.warnings,
      waitReasons: pre.waitReasons
    },
    authorizationBoundary: {
      doesNotAuthorizeProvider: true,
      doesNotAuthorizeDbWrites: true,
      freshExplicitAuthorizationRequiredBeforeApply: true,
      applySideEffects: 'backend_owned_math_observation_may_enqueue_and_process_one_generation_job_with_provider_and_db_side_effects'
    },
    operatorCommands: {
      startObservationBackend: `npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=${cellId}`,
      targetPromptContractSelfTest: `npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=${runId} --cell=${cellId} --json`,
      preflight: `npm.cmd run csca-ai-questioning:math-diversity-observation-preflight --${baseUrlArg} --cell=${cellId} --json`,
      previewObservationTask: `npm.cmd run csca-ai-questioning:math-diversity-observation-run -- --run=${runId} --cell=${cellId}${baseUrlArg} --json`,
      applyAfterFreshAuthorization: `npm.cmd run csca-ai-questioning:math-diversity-observation-run -- --run=${runId} --cell=${cellId}${baseUrlArg} --apply --confirm-math-diversity-observation-run --confirm-provider-recovery --confirm-run=${runId} --confirm-cell=${cellId} --wait --json`,
      evidenceAfterApply: `npm.cmd run csca-ai-questioning:math-diversity-observation-evidence -- --subject=math${baseUrlArg} --json`,
      completionGateAfterEvidence: `npm.cmd run csca-ai-questioning:math-observation-completion-gate -- --subject=math --run=${runId} --cell=${cellId} --json`,
      scorecardAfterEvidence: `npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --subjects=math --math-run=${runId} --sample=80 --json`
    }
  };
}

function main() {
  const runId = positiveInt('run', 1);
  const requestedCellId = Number(argValue('cell', '')) || null;
  const fallbackCellId = 13;
  const freshnessWindowDays = positiveInt('freshness-window-days', 2);
  const observationBaseUrl = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || '')).replace(/\/+$/, '');
  const json = hasFlag('json');

  const scorecard = runJson('csca-subject-practice-quality-scorecard.cjs', [
    '--subjects=math',
    `--math-run=${runId}`,
    '--sample=80'
  ]);
  const nextAction = runJson('csca-subject-practice-next-action.cjs', [
    '--subject=math',
    `--run=${runId}`,
    '--sample=80',
    '--days=30'
  ]);
  const exactCellEnqueue = runJson('csca-subject-practice-exact-cell-enqueue.cjs', [
    '--subject=math',
    `--run=${runId}`
  ]);
  const nextActionCellId = preferredCellFrom(nextAction, fallbackCellId) || fallbackCellId;
  const exactSelectionCellId = Number(exactCellEnqueue?.selection?.selectedCellId) || null;
  const calibration = runJson('csca-subject-practice-question-plan-calibration.cjs', [
    '--subject=math',
    `--run=${runId}`
  ]);
  const calibrationCellId = compactCalibration(calibration).cells
    .slice()
    .sort((left, right) => (Number(right.total) || 0) - (Number(left.total) || 0))
    .map((cell) => Number(cell.cellId) || null)
    .find(Boolean) || null;
  const cellId = requestedCellId || calibrationCellId || exactSelectionCellId || nextActionCellId;
  const preflight = runJson('csca-subject-practice-diversity-observation-preflight.cjs', [
    `--cell=${cellId}`,
    ...(observationBaseUrl ? [`--base-url=${observationBaseUrl}`] : [])
  ]);
  const currentPolicyRefresh = runJson('csca-subject-practice-production-current-policy-refresh.cjs', [
    '--subject=math',
    '--statuses=blocked,completed',
    '--days=30',
    '--limit=100'
  ]);
  const ownerRevalidationPlan = runJson('csca-subject-practice-owner-revalidation-plan.cjs', [
    '--subject=math',
    `--run=${runId}`,
    '--profile-replay-limit=10'
  ]);
  const observationEvidence = runJsonAllowFailure('csca-subject-practice-observation-evidence.cjs', [
    '--subject=math',
    '--allow-missing-latest-task'
  ]);
  const latestObservationEvidence = compactObservationEvidence(observationEvidence, freshnessWindowDays);
  const postfixEfficiency = runJson('csca-subject-practice-math-postfix-efficiency-gate.cjs', [
    `--run=${runId}`,
    `--cell=${cellId}`,
    '--hours=72'
  ]);

  const report = {
    mode: 'read_only_math_recovery_diagnostics',
    subject: 'math',
    productionRunId: runId,
    productionImpact: 'none_read_only_diagnostics',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    scorecard: compactScorecard(scorecard),
    nextAction: compactNextAction(nextAction),
    exactCellEnqueue: {
      requested: exactCellEnqueue.requested ?? null,
      selection: exactCellEnqueue.selection ? {
      selectedCellId: exactCellEnqueue.selection.selectedCellId,
      selectedBlueprintId: exactCellEnqueue.selection.selectedBlueprintId,
      consideredCells: arrayFrom(exactCellEnqueue.selection.consideredCells).slice(0, 3)
      } : null,
      preflight: exactCellEnqueue.preflight ?? null
    },
    questionPlanCalibration: compactCalibration(calibration),
    observationPreflight: compactPreflight(preflight),
    currentPolicyRefresh: compactCurrentPolicyRefresh(currentPolicyRefresh),
    ownerRevalidationPlan: compactOwnerRevalidationPlan(ownerRevalidationPlan),
    latestObservationEvidence,
    postfixEfficiency,
    recommendation: recommendationFor({
      runId,
      cellId,
      scorecard,
      preflight,
      calibration,
      exactCellEnqueue,
      latestObservationEvidence,
      postfixEfficiency,
      observationBaseUrl
    })
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Math recovery diagnostics: ${report.recommendation.status}`);
  console.log(`- run=#${runId}; scorecard=${report.scorecard.scorecardStatus}; throughput=${report.scorecard.throughputStatus}`);
  console.log(`- yields generated->approved=${report.scorecard.generatedToApprovedYield ?? 'n/a'} attempt->approved=${report.scorecard.attemptToApprovedYield ?? 'n/a'}`);
  console.log(`- preferred observation cell=#${report.recommendation.preferredCellId}; blockers=${report.recommendation.blockers.join(',') || 'none'}`);
  console.log(`- owner revalidation=${report.ownerRevalidationPlan.status}; formalGatePublishable=${report.ownerRevalidationPlan.formalGatePublishableCandidateIds.join(',') || 'none'}; next=${report.ownerRevalidationPlan.recommendedNextAction || 'none'}`);
  console.log(`- calibration focus=${JSON.stringify(report.recommendation.calibrationFocus)}`);
  console.log('- no Provider call or DB write was executed by this report.');
}

main();
