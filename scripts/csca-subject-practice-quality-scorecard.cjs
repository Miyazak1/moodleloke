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

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function positiveIntArg(name, fallback, min, max) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function runNodeJson(args, label) {
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${error.message}\n${stdout.slice(0, 500)}`);
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

function topRows(rows, key, limit = 5) {
  return [...rows]
    .sort((left, right) => asNumber(right[key]) - asNumber(left[key]) || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle)))
    .slice(0, limit);
}

function uniqueCellsById(cells) {
  const seen = new Set();
  const result = [];
  for (const cell of cells) {
    const id = asNumber(cell.cellId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(cell);
  }
  return result;
}

function replayOpportunityRows(openCells, limit) {
  const topOpen = topRows(openCells, 'openCount', limit);
  const rejectedContentGate = [...openCells]
    .filter((cell) => ['content_gate', 'unclassified_candidate_rejection'].includes(cleanText(cell.primaryBottleneck))
      && asNumber(cell.rejectedGeneratedCount) > 0)
    .sort((left, right) => (
      asNumber(right.rejectedGeneratedCount) - asNumber(left.rejectedGeneratedCount)
      || asNumber(right.generatedQuestionCount) - asNumber(left.generatedQuestionCount)
      || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle))
    ))
    .slice(0, limit);
  const publishedCountReconciliation = [...openCells]
    .filter((cell) => cleanText(cell.primaryBottleneck) === 'published_count_reconciliation')
    .sort((left, right) => (
      asNumber(right.openCount) - asNumber(left.openCount)
      || asNumber(right.generatedQuestionCount) - asNumber(left.generatedQuestionCount)
      || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle))
    ))
    .slice(0, limit);
  return uniqueCellsById([...topOpen, ...rejectedContentGate, ...publishedCountReconciliation]);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + asNumber(row[key]), 0);
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = cleanText(row[key]) || 'unknown';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
}

function mergeCountObjects(objects) {
  const counts = new Map();
  for (const object of objects.map(recordFrom)) {
    for (const [key, value] of Object.entries(object)) {
      const text = cleanText(key);
      if (!text) continue;
      counts.set(text, (counts.get(text) ?? 0) + asNumber(value));
    }
  }
  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(3)) : null;
}

function belowThreshold(value, threshold) {
  return value != null && value < threshold;
}

function prePublicationUniquenessEfficiencyFor(evidence, generatedCount) {
  const value = recordFrom(evidence);
  const checkedCount = asNumber(value.checkedCount);
  const passedCount = asNumber(value.passedCount);
  const blockedCount = asNumber(value.blockedCount);
  const legacyMissingEligibleEvidenceCount = asNumber(value.legacyMissingEligibleEvidenceCount);
  const evidenceEligibleCount = asNumber(value.evidenceEligibleCount);
  const status = blockedCount > 0
    ? 'near_duplicate_generation_waste_detected'
    : checkedCount > 0
      ? 'active_no_stored_near_duplicate_blocks'
      : legacyMissingEligibleEvidenceCount > 0
        ? 'legacy_candidates_predate_uniqueness_evidence'
        : 'no_eligible_prepublication_evidence';
  return {
    mode: 'subject_practice_prepublication_uniqueness_efficiency',
    status,
    policyVersion: cleanText(value.policyVersion) || 'subject-practice-prepublication-uniqueness-v1',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_existing_audit_payload',
    checkedCount,
    passedCount,
    blockedCount,
    legacyMissingEligibleEvidenceCount,
    evidenceEligibleCount,
    evidenceCoverage: value.evidenceCoverage ?? null,
    checkedBlockRate: value.checkedBlockRate ?? null,
    blockedPerGeneratedCandidate: ratio(blockedCount, generatedCount),
    blockedCandidatesWereAlreadyProviderGenerated: true,
    legacyMissingEvidenceIsNotRetroactiveFailure: true,
    nextEfficiencyLever: blockedCount > 0
      ? 'rotate_question_plan_skeleton_and_distractor_structure_before_more_provider_spend'
      : legacyMissingEligibleEvidenceCount > 0 && checkedCount === 0
        ? 'monitor_new_candidates_under_prepublication_uniqueness_policy'
        : 'continue_current_prepublication_uniqueness_policy',
    byCell: arrayFrom(value.byCell),
    samples: arrayFrom(value.samples)
  };
}

function throughputEfficiencyFor({ run, fourFunnel, dispatchCapacity, openCells, providerErrors, p0p1, blockedReason }) {
  const thresholds = {
    minimumDeliveryYield: 0.65,
    minimumGeneratedToApprovedYield: 0.35,
    minimumAttemptToApprovedYield: 0.25,
    minimumActiveUtilizationWhenOpen: 0.8
  };
  const activeJobLimit = asNumber(dispatchCapacity.activeJobLimit);
  const activeProductionJobCount = asNumber(dispatchCapacity.activeProductionJobCount);
  const activeCapacityRemaining = asNumber(dispatchCapacity.activeCapacityRemaining);
  const activeUtilization = activeJobLimit > 0 ? Number((activeProductionJobCount / activeJobLimit).toFixed(3)) : null;
  const openTotal = Number.isFinite(Number(fourFunnel.reconciledOpenTotal))
    ? asNumber(fourFunnel.reconciledOpenTotal)
    : asNumber(fourFunnel.computedOpenTotal);
  const deliveryIssueCount = arrayFrom(providerErrors)
    .filter((item) => /provider_|gateway_|timeout|network|rate_limited|cooldown|unavailable/i.test(cleanText(item.errorCode)))
    .reduce((total, item) => total + asNumber(item.count), 0);
  const deliveryIssueShareOfAttempts = ratio(deliveryIssueCount, fourFunnel.attemptCount);
  const deliveryIssueDominatesAttempts = deliveryIssueCount >= 10
    && (fourFunnel.attemptCount <= 0 || (deliveryIssueShareOfAttempts ?? 0) >= 0.5);
  const reasons = [];
  if (blockedReason) reasons.push(`run_blocked:${blockedReason}`);
  if (arrayFrom(p0p1).length) reasons.push(`p0p1_attention:${arrayFrom(p0p1).length}`);
  if (belowThreshold(fourFunnel.deliveryYield, thresholds.minimumDeliveryYield)) reasons.push('delivery_yield_below_threshold');
  if (belowThreshold(fourFunnel.generatedToApprovedYield, thresholds.minimumGeneratedToApprovedYield)) reasons.push('generated_to_approved_yield_below_threshold');
  if (belowThreshold(fourFunnel.attemptToApprovedYield, thresholds.minimumAttemptToApprovedYield)) reasons.push('attempt_to_approved_yield_below_threshold');
  if (activeJobLimit > 0 && activeProductionJobCount > activeJobLimit) reasons.push('active_capacity_over_limit');
  if (cleanText(dispatchCapacity.activeCapacityStatus) === 'active_capacity_exhausted_by_existing_jobs') reasons.push('active_capacity_exhausted');
  if (openTotal > 0 && activeCapacityRemaining > 0 && activeUtilization != null && activeUtilization < thresholds.minimumActiveUtilizationWhenOpen) {
    reasons.push('active_capacity_underfilled_with_open_cells');
  }
  if (deliveryIssueCount > 0) reasons.push('provider_delivery_noise_present');
  let status = 'closed_or_no_open_work';
  if (openTotal > 0) {
    status = reasons.some((reason) => /yield_below|run_blocked|p0p1|active_capacity_exhausted|active_capacity_over_limit/.test(reason))
      ? 'below_acceptable_efficiency'
      : reasons.includes('active_capacity_underfilled_with_open_cells') || reasons.includes('provider_delivery_noise_present')
        ? 'acceptable_with_operator_actions'
        : 'acceptable';
  }
  return {
    mode: 'audit_only_subject_practice_throughput_efficiency',
    status,
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    thresholds,
    reasons,
    activeUtilization,
    activeJobLimit,
    activeProductionJobCount,
    activeCapacityRemaining,
    openCellCount: arrayFrom(openCells).length,
    openTotal,
    deliveryIssueCount,
    deliveryIssueShareOfAttempts,
    deliveryIssueDominatesAttempts,
    yieldEvidence: {
      deliveryYield: fourFunnel.deliveryYield,
      generatedToApprovedYield: fourFunnel.generatedToApprovedYield,
      attemptToApprovedYield: fourFunnel.attemptToApprovedYield,
      attemptCount: fourFunnel.attemptCount,
      generatedCount: fourFunnel.generatedCount,
      approvedGeneratedCount: fourFunnel.approvedGeneratedCount
    },
    nextEfficiencyLever: reasons.includes('active_capacity_over_limit')
      ? 'stop_or_recover_over_limit_jobs_before_more_provider_spend'
      : deliveryIssueDominatesAttempts
        ? 'prove_provider_recovery_before_more_provider_spend'
      : reasons.some((reason) => /run_blocked|yield_below/.test(reason))
      ? 'tighten_question_plan_or_reviewer_profile_calibration_before_more_provider_spend'
      : reasons.includes('active_capacity_underfilled_with_open_cells')
        ? 'fill_available_capacity_with_exact_enqueue_or_process_existing_queued_job'
        : reasons.includes('provider_delivery_noise_present')
          ? 'watch_provider_backoff_or_switch_provider_if_recent_failures_continue'
          : null,
    evidenceLimit: 'historical_current_run_funnel_and_audit_only_capacity_not_future_provider_success'
  };
}

function postProviderRecoveryEfficiencyLeverFor({
  throughputEfficiency,
  questionPlanOpenCount,
  reviewerProfileOpenCount,
  reviewerValidatorOpenCount,
  reviewerGateOrQuestionPlanOpenCount,
  runnerDispatchOpenCount,
  openTotal
}) {
  const contentQualityOpenCount = questionPlanOpenCount
    + reviewerProfileOpenCount
    + reviewerValidatorOpenCount
    + reviewerGateOrQuestionPlanOpenCount;
  if (contentQualityOpenCount > 0) {
    return {
      lever: 'tighten_question_plan_or_reviewer_profile_calibration_after_provider_recovery',
      reason: 'content_quality_routes_remain_after_provider_delivery_noise_is_removed',
      contentQualityOpenCount,
      routeOpenCounts: {
        questionPlanOpenCount,
        reviewerProfileOpenCount,
        reviewerValidatorOpenCount,
        reviewerGateOrQuestionPlanOpenCount
      }
    };
  }
  if (runnerDispatchOpenCount > 0) {
    return {
      lever: 'fill_available_capacity_with_exact_enqueue_or_process_existing_queued_job_after_provider_recovery',
      reason: 'open_cells_need_runner_dispatch_after_provider_recovery',
      runnerDispatchOpenCount
    };
  }
  if (openTotal > 0 && throughputEfficiency?.nextEfficiencyLever) {
    return {
      lever: throughputEfficiency.nextEfficiencyLever,
      reason: 'primary_efficiency_lever_remains_after_provider_recovery'
    };
  }
  return null;
}

function routeFromReasons(reasons) {
  const text = reasons.map((item) => cleanText(item.reason ?? item.errorCode ?? item.value)).join(' ');
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
  return null;
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

let cachedQuestionPlanPolicy = undefined;
function questionPlanPolicy() {
  if (cachedQuestionPlanPolicy !== undefined) return cachedQuestionPlanPolicy;
  try {
    require('../backend/node_modules/ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node'
      }
    });
    cachedQuestionPlanPolicy = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
  } catch (error) {
    cachedQuestionPlanPolicy = { error: compactErrorMessage(error) };
  }
  return cachedQuestionPlanPolicy;
}

function mathQuestionPlanSkeletonCoverageFor(subject, openCells) {
  if (cleanText(subject) !== 'math') return null;
  const policy = questionPlanPolicy();
  const buildSubjectPracticeQuestionPlan = policy.buildSubjectPracticeQuestionPlan;
  if (typeof buildSubjectPracticeQuestionPlan !== 'function') {
    return {
      mode: 'audit_only_math_question_plan_skeleton_coverage',
      status: 'unavailable',
      productionImpact: 'none_audit_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_existing_audit_payload_only',
      error: cleanText(policy.error) || 'question_plan_policy_unavailable'
    };
  }
  const cells = arrayFrom(openCells)
    .map((cell) => {
      const plan = buildSubjectPracticeQuestionPlan({
        subject: 'math',
        topicTitle: cleanText(cell.topicTitle),
        productionCellId: String(asNumber(cell.cellId)),
        targetDifficulty: cleanText(cell.difficulty)
      });
      const skeletons = arrayFrom(recordFrom(plan).renderConstraints?.preferredPromptSkeletons)
        .map(cleanText)
        .filter(Boolean);
      return {
        cellId: asNumber(cell.cellId),
        topicTitle: cleanText(cell.topicTitle),
        difficulty: cleanText(cell.difficulty),
        planTemplate: cleanText(recordFrom(plan).planTemplate) || null,
        taskFamily: cleanText(recordFrom(plan).taskFamily) || null,
        skeletonCount: skeletons.length,
        skeletonPreview: skeletons.slice(0, 2)
      };
    });
  const missingSkeletonCells = cells.filter((cell) => cell.skeletonCount <= 0);
  const templateCounts = countBy(cells, 'planTemplate');
  return {
    mode: 'audit_only_math_question_plan_skeleton_coverage',
    status: missingSkeletonCells.length
      ? 'skeleton_gaps_present'
      : 'all_open_math_cells_have_preferred_prompt_skeletons',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_existing_audit_payload_only',
    openCellCount: cells.length,
    coveredOpenCellCount: cells.length - missingSkeletonCells.length,
    missingSkeletonCellCount: missingSkeletonCells.length,
    templateCounts,
    missingSkeletonCells: missingSkeletonCells.slice(0, 10),
    sampleCells: cells.slice(0, 8)
  };
}

function calibrationVerdictsForCell(cell) {
  return recordFrom(recordFrom(cell.questionPlanCalibration).verdicts);
}

function calibrationHasLikelyPlanShape(cell) {
  const verdicts = calibrationVerdictsForCell(cell);
  return Object.keys(verdicts).some((verdict) => /^maybe_.*(?:plan|profile_mismatch|electron_balance|quant_chain)/.test(verdict));
}

function calibrationHasEvidenceSlotGap(cell) {
  const verdicts = calibrationVerdictsForCell(cell);
  return Object.keys(verdicts).some((verdict) => /likely_|missing|insufficient|needs_/.test(verdict));
}

function mechanismRouteForCell(cell) {
  if (asNumber(cell.staleRunningJobCount) > 0) return 'runner_stale_recovery';
  const primary = cleanText(cell.primaryBottleneck);
  if (primary === 'published_count_reconciliation') return 'published_count_reconciliation';
  if (primary === 'provider_or_schema') return 'delivery_or_provider_contract';
  if (primary === 'unclassified_candidate_rejection') return 'unclassified_candidate_review_replay';
  if (primary === 'content_gate') {
    const reasonRoute = routeFromReasons(arrayFrom(cell.topGateReasons));
    if (reasonRoute === 'question_plan_evidence_slots_or_difficulty_rubric' && calibrationHasLikelyPlanShape(cell)) {
      return 'reviewer_profile_difficulty_calibration';
    }
    if (reasonRoute === 'question_plan_evidence_slots_or_difficulty_rubric' && calibrationHasEvidenceSlotGap(cell)) {
      return 'question_plan_evidence_slots_or_difficulty_rubric';
    }
    return routeFromReasons(arrayFrom(cell.topGateReasons)) ?? 'reviewer_gate_or_question_plan_calibration';
  }
  if (asNumber(cell.openCount) > 0 && asNumber(cell.activeJobCount) === 0) return 'runner_dispatch_or_cell_scheduling';
  return 'monitor_only';
}

function shouldReplayProfileForCell(cell, run) {
  if (asNumber(run.id) <= 0) return false;
  const primary = cleanText(cell.primaryBottleneck);
  if (primary === 'published_count_reconciliation') return true;
  return ['content_gate', 'unclassified_candidate_rejection'].includes(primary)
    && asNumber(cell.rejectedGeneratedCount) > 0;
}

function auditForSubject(subject, options) {
  const auditScript = path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs');
  const runOverride = cleanText(argValue(`${subject}-run`, subject === 'chemistry' ? options.chemistryRun : ''));
  const args = [
    auditScript,
    `--subject=${subject}`,
    `--run=${runOverride || 'latest'}`,
    `--sample=${options.sample}`,
    `--days=${subject === 'chemistry' ? options.chemistryDays : options.days}`,
    '--json'
  ];
  if (options.qualityAuditLedger) args.push(`--quality-audit-ledger=${options.qualityAuditLedger}`);
  return runNodeJson(args, `${subject} production audit`);
}

function currentProfileReplayForCell(subject, runId, cellId, options) {
  if (options.skipProfileReplay || !runId || !cellId) return null;
  const replayScript = path.resolve(__dirname, 'csca-subject-practice-reviewer-profile-replay.cjs');
  try {
    const report = runNodeJson([
      replayScript,
      `--subject=${subject}`,
      `--run=${runId}`,
      `--cells=${cellId}`,
      `--limit=${options.profileReplayLimit}`,
      '--json',
      '--summary-only'
    ], `${subject} reviewer/profile replay`);
    return {
      status: 'available',
      summary: recordFrom(report.summary),
      providerImpact: cleanText(recordFrom(report.summary).providerImpact) || 'none_no_provider_call',
      dbImpact: cleanText(recordFrom(report.summary).dbImpact) || 'read_only'
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error?.message ?? String(error),
      providerImpact: 'none_no_provider_call_expected',
      dbImpact: 'read_only_expected'
    };
  }
}

function mechanismRouteFromCurrentProfileReplay(replay) {
  if (!replay || replay.status !== 'available') return null;
  const summary = recordFrom(replay.summary);
  const replayed = asNumber(summary.replayed);
  if (replayed <= 0) return null;
  const remainingBlocking = asNumber(summary.remainingBlockingProfileCount);
  const remainingDifficulty = asNumber(summary.remainingDifficultyComplexityMismatchCount);
  const profileClean = asNumber(summary.profileCleanCount);
  const formalGateProfileOnlySoft = asNumber(summary.formalGateProfileOnlySoftCount);
  const hardShapeCleared = asNumber(summary.hardShapeSpecificBlockerClearedCount);
  if (remainingBlocking > 0) return 'reviewer_profile_difficulty_calibration';
  if (remainingDifficulty >= Math.max(1, Math.ceil(replayed * 0.4))) return 'question_plan_evidence_slots_or_difficulty_rubric';
  if (profileClean > 0 || formalGateProfileOnlySoft > 0 || hardShapeCleared > 0) return 'owner_revalidation_formal_gate_dry_run_required';
  return null;
}

function isOwnerRevalidationRoute(route) {
  return [
    'owner_current_policy_revalidation_candidate',
    'owner_revalidation_formal_gate_dry_run_required'
  ].includes(cleanText(route));
}

function questionPlanVisibilityForSubject(subject, recentFormalWindow, readiness) {
  const scopedSubject = cleanText(subject);
  const questionPlanApplicability = recordFrom(recentFormalWindow.questionPlanApplicability);
  const questionPlanCalibration = recordFrom(recentFormalWindow.questionPlanCalibration);
  const questionPlanExecution = recordFrom(recentFormalWindow.questionPlanExecution);
  const mathQuestionPlanShadow = recordFrom(recentFormalWindow.mathQuestionPlanShadow);
  const physicsQuestionPlanShadow = recordFrom(recentFormalWindow.physicsQuestionPlanShadow);
  const questionPlanPhases = arrayFrom(recordFrom(readiness).phases)
    .map(recordFrom)
    .filter((phase) => /question_plan/.test(cleanText(phase.phase)))
    .map((phase) => ({
      phase: cleanText(phase.phase),
      status: cleanText(phase.status)
    }));
  const subjectShadow = scopedSubject === 'math'
    ? mathQuestionPlanShadow
    : scopedSubject === 'physics'
      ? physicsQuestionPlanShadow
      : {};
  const subjectShadowMode = cleanText(subjectShadow.mode);
  const subjectShadowVisible = Boolean(subjectShadowMode)
    && cleanText(subjectShadow.productionImpact) === 'none_audit_only'
    && cleanText(subjectShadow.providerImpact) === 'none_no_provider_call'
    && (
      cleanText(subjectShadow.gateApplicability) === 'not_connected_to_subjectPracticeQuestionPlanGateFor'
      || cleanText(subjectShadow.gateApplicability) === 'guarded_allowlist_available_subjectPracticeQuestionPlanGateFor'
    )
    && subjectShadow.featureFlagEnabled === false;
  const chemistryApplicabilityVisible = scopedSubject === 'chemistry'
    && Boolean(cleanText(questionPlanApplicability.mode) || asNumber(questionPlanApplicability.cellCount) > 0)
    && cleanText(questionPlanApplicability.productionImpact) === 'none_audit_only'
    && cleanText(questionPlanApplicability.providerImpact) === 'none_no_provider_call';
  const chemistryCalibrationVisible = scopedSubject === 'chemistry'
    && Boolean(cleanText(questionPlanCalibration.mode) || asNumber(questionPlanCalibration.sampleCount) > 0)
    && cleanText(questionPlanCalibration.productionImpact) === 'none_audit_only';
  const chemistryExecutionVisible = scopedSubject === 'chemistry'
    && Boolean(cleanText(questionPlanExecution.mode) || asNumber(questionPlanExecution.observedCount) > 0)
    && cleanText(questionPlanExecution.productionImpact) === 'none_audit_only';
  const subjectShadowSampleCount = asNumber(subjectShadow.sampleCount);
  const subjectShadowApplicableCellCount = asNumber(subjectShadow.applicableCellCount);
  const chemistryEvidenceCount = asNumber(questionPlanCalibration.sampleCount)
    + asNumber(questionPlanExecution.observedCount)
    + asNumber(questionPlanApplicability.applicableCount);
  const visible = scopedSubject === 'chemistry'
    ? chemistryApplicabilityVisible || chemistryCalibrationVisible || chemistryExecutionVisible
    : subjectShadowVisible;
  const coverageStatus = !visible
    ? 'missing'
    : scopedSubject === 'chemistry'
      ? chemistryEvidenceCount > 0
        ? 'sampled_or_applicable_current_window'
        : 'boundary_visible_no_current_samples'
      : subjectShadowSampleCount > 0
        ? 'sampled_current_window'
        : subjectShadowApplicableCellCount > 0
          ? 'applicable_cell_without_current_samples'
          : 'boundary_visible_no_applicable_current_run_cells';
  return {
    mode: 'audit_only_question_plan_visibility',
    subject: scopedSubject,
    status: visible ? 'visible' : 'missing',
    coverageStatus,
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    gateImpact: 'none_with_current_flags_or_shadow_disconnected',
    currentPolicyImpact: 'none',
    readinessPhases: questionPlanPhases,
    chemistry: scopedSubject === 'chemistry'
      ? {
        applicabilityVisible: chemistryApplicabilityVisible,
        calibrationVisible: chemistryCalibrationVisible,
        executionVisible: chemistryExecutionVisible,
        applicableCellCount: asNumber(questionPlanApplicability.applicableCount),
        calibrationSampleCount: asNumber(questionPlanCalibration.sampleCount),
        executionObservedCount: asNumber(questionPlanExecution.observedCount),
        executionNeedsRepairCount: asNumber(questionPlanExecution.needsRepairCount),
        executionDeliveryRouteCount: asNumber(questionPlanExecution.deliveryRouteCount)
      }
      : null,
    math: scopedSubject === 'math'
      ? {
        shadowVisible: subjectShadowVisible,
        mode: subjectShadowMode || null,
        applicableCellCount: asNumber(mathQuestionPlanShadow.applicableCellCount),
        sampleCount: asNumber(mathQuestionPlanShadow.sampleCount),
        featureFlagEnabled: mathQuestionPlanShadow.featureFlagEnabled === true,
        gateApplicability: cleanText(mathQuestionPlanShadow.gateApplicability) || null,
        verdictCounts: arrayFrom(mathQuestionPlanShadow.verdictCounts)
      }
      : null,
    physics: scopedSubject === 'physics'
      ? {
        shadowVisible: subjectShadowVisible,
        mode: subjectShadowMode || null,
        applicableCellCount: asNumber(physicsQuestionPlanShadow.applicableCellCount),
        sampleCount: asNumber(physicsQuestionPlanShadow.sampleCount),
        featureFlagEnabled: physicsQuestionPlanShadow.featureFlagEnabled === true,
        gateApplicability: cleanText(physicsQuestionPlanShadow.gateApplicability) || null,
        verdictCounts: arrayFrom(physicsQuestionPlanShadow.verdictCounts)
      }
      : null
  };
}

function subjectScorecard(audit, options = {}) {
  const run = audit.run && typeof audit.run === 'object' ? audit.run : {};
  const diagnostics = arrayFrom(audit.productionDiagnostics);
  const diagnosticByCellId = new Map(diagnostics.map((cell) => [String(cell.cellId), cell]));
  const cells = arrayFrom(audit.cells).map((cell) => ({
    ...cell,
    ...(diagnosticByCellId.get(String(cell.id)) ?? {}),
    cellId: asNumber(cell.id)
  }));
  const quality = audit.quality && typeof audit.quality === 'object' ? audit.quality : {};
  const provider = audit.provider && typeof audit.provider === 'object' ? audit.provider : {};
  const recentFormalWindow = audit.recentFormalWindow && typeof audit.recentFormalWindow === 'object' ? audit.recentFormalWindow : {};
  const prePublicationUniquenessEvidence = recordFrom(audit.prePublicationUniqueness);
  const questionPlanCalibrationSummary = recordFrom(recordFrom(recentFormalWindow.questionPlanCalibration).summary);
  const readiness = recentFormalWindow.diversityEngineReadiness && typeof recentFormalWindow.diversityEngineReadiness === 'object'
    ? recentFormalWindow.diversityEngineReadiness
    : {};
  const questionPlanVisibility = questionPlanVisibilityForSubject(cleanText(run.subject), recentFormalWindow, readiness);
  const attemptCount = sum(diagnostics, 'jobAttemptCount');
  const generatedCount = sum(diagnostics, 'generatedQuestionCount');
  const approvedGeneratedCount = sum(diagnostics, 'approvedGeneratedCount');
  const rejectedGeneratedCount = sum(diagnostics, 'rejectedGeneratedCount');
  const prePublicationUniqueness = prePublicationUniquenessEfficiencyFor(
    prePublicationUniquenessEvidence,
    generatedCount
  );
  const countIntegrityWarnings = [];
  if (attemptCount > 0 && generatedCount > attemptCount) {
    countIntegrityWarnings.push('generated_count_exceeds_job_attempt_count_use_as_historical_funnel_signal');
  }
  const cellsWithCalibration = cells.map((cell) => ({
    ...cell,
    questionPlanCalibration: recordFrom(questionPlanCalibrationSummary[String(cell.cellId)])
  }));
  const storedOpenCells = cellsWithCalibration.filter((cell) => asNumber(cell.openCount) > 0);
  const openCells = cellsWithCalibration.filter((cell) => (
    Number.isFinite(Number(cell.reconciledOpenCount))
      ? asNumber(cell.reconciledOpenCount) > 0
      : asNumber(cell.openCount) > 0
  ));
  const publishedCountReconciliationCells = storedOpenCells.filter((cell) => recordFrom(cell.publishedCountReconciliation));
  const activeCells = cellsWithCalibration.filter((cell) => asNumber(cell.activeJobCount) > 0);
  const staleCells = cellsWithCalibration.filter((cell) => asNumber(cell.staleRunningJobCount) > 0);
  const p0p1 = arrayFrom(quality.p0p1).map(cleanText).filter(Boolean);
  const providerErrors = arrayFrom(provider.providerErrors);
  const dispatchCapacity = recordFrom(provider.dispatchCapacity);
  const contentGateCells = openCells.filter((cell) => cleanText(cell.primaryBottleneck) === 'content_gate');
  const unclassifiedRejectedCells = openCells.filter((cell) => cleanText(cell.primaryBottleneck) === 'unclassified_candidate_rejection');
  const deliveryCells = openCells.filter((cell) => cleanText(cell.primaryBottleneck) === 'provider_or_schema');
  const routeCounts = countBy(openCells.map((cell) => ({ route: mechanismRouteForCell(cell) })), 'route');
  function summarizeOpenCell(cell) {
    const storedMechanismRoute = mechanismRouteForCell(cell);
    const shouldReplay = shouldReplayProfileForCell(cell, run);
    const currentProfileReplay = shouldReplay
      ? currentProfileReplayForCell(cleanText(run.subject), asNumber(run.id), asNumber(cell.cellId), options)
      : null;
    const currentMechanismRoute = mechanismRouteFromCurrentProfileReplay(currentProfileReplay);
    return {
      cellId: asNumber(cell.cellId),
      topicTitle: cleanText(cell.topicTitle),
      difficulty: cleanText(cell.difficulty),
      openCount: Number.isFinite(Number(cell.reconciledOpenCount))
        ? asNumber(cell.reconciledOpenCount)
        : asNumber(cell.openCount),
      storedOpenCount: asNumber(cell.openCount),
      reconciledOpenCount: Number.isFinite(Number(cell.reconciledOpenCount))
        ? asNumber(cell.reconciledOpenCount)
        : null,
      jobAttemptCount: asNumber(cell.jobAttemptCount),
      generatedQuestionCount: asNumber(cell.generatedQuestionCount),
      approvedGeneratedCount: asNumber(cell.approvedGeneratedCount),
      rejectedGeneratedCount: asNumber(cell.rejectedGeneratedCount),
      classifiedRejectedCount: asNumber(cell.classifiedRejectedCount),
      unclassifiedRejectedCount: asNumber(cell.unclassifiedRejectedCount),
      publishYield: cell.publishYield ?? null,
      primaryBottleneck: cleanText(cell.primaryBottleneck),
      mechanismRoute: currentMechanismRoute ?? storedMechanismRoute,
      storedMechanismRoute,
      currentProfileReplay,
      questionPlanCalibration: recordFrom(questionPlanCalibrationSummary[String(cell.cellId)]),
      topGateReasons: arrayFrom(cell.topGateReasons).slice(0, 5),
      topJobErrors: arrayFrom(cell.topJobErrors).slice(0, 5)
    };
  }
  const topOpenCellSummaries = topRows(openCells, 'openCount', 5).map(summarizeOpenCell);
  const replayOpportunityCellSummaries = replayOpportunityRows(openCells, Math.max(5, options.profileReplayLimit)).map(summarizeOpenCell);
  const replayOpportunitySummaryByCellId = new Map(
    replayOpportunityCellSummaries.map((cell) => [String(asNumber(cell.cellId)), cell])
  );
  const opportunityRows = uniqueCellsById([...openCells, ...publishedCountReconciliationCells]).map((cell) => {
    const replayedCell = replayOpportunitySummaryByCellId.get(String(asNumber(cell.cellId)));
    const replaySummary = recordFrom(recordFrom(replayedCell?.currentProfileReplay).summary);
    return {
      cellId: asNumber(cell.cellId),
      topicTitle: cleanText(cell.topicTitle),
      difficulty: cleanText(cell.difficulty),
      route: cleanText(replayedCell?.mechanismRoute ?? mechanismRouteForCell(cell)),
      openCount: asNumber(cell.openCount),
      ownerRevalidationCandidateIds: arrayFrom(replaySummary.ownerRevalidationCandidateIds)
        .map((id) => asNumber(id))
        .filter((id) => id > 0),
      sourceCandidateCount: asNumber(replaySummary.sourceCandidateCount),
      revalidationEligibleSourceCount: asNumber(replaySummary.revalidationEligibleSourceCount),
      archivedSourceCount: asNumber(replaySummary.archivedSourceCount),
      policyLearningOnlySourceCount: asNumber(replaySummary.policyLearningOnlySourceCount),
      sourceStatusCounts: recordFrom(replaySummary.sourceStatusCounts),
      ownerRevalidationLegacyNonProfileRecheckIds: arrayFrom(replaySummary.ownerRevalidationLegacyNonProfileRecheckIds)
        .map((id) => asNumber(id))
        .filter((id) => id > 0),
      ownerRevalidationLegacyNonProfileRecheckItems: arrayFrom(replaySummary.ownerRevalidationLegacyNonProfileRecheckItems)
        .map((item) => ({
          id: asNumber(recordFrom(item).id),
          reasons: arrayFrom(recordFrom(item).reasons).map(cleanText).filter(Boolean)
        }))
        .filter((item) => item.id > 0),
      ownerRevalidationLegacyNonProfileReasonCounts: recordFrom(replaySummary.ownerRevalidationLegacyNonProfileReasonCounts)
    };
  });
  const ownerRevalidationOpenCount = opportunityRows
    .filter((cell) => isOwnerRevalidationRoute(cell.route))
    .reduce((total, cell) => total + cell.openCount, 0);
  const questionPlanOpenCount = opportunityRows
    .filter((cell) => cell.route === 'question_plan_evidence_slots_or_difficulty_rubric')
    .reduce((total, cell) => total + cell.openCount, 0);
  const reviewerProfileOpenCount = opportunityRows
    .filter((cell) => cell.route === 'reviewer_profile_difficulty_calibration')
    .reduce((total, cell) => total + cell.openCount, 0);
  const publishedCountReconciliationOpenCount = opportunityRows
    .filter((cell) => cell.route === 'published_count_reconciliation')
    .reduce((total, cell) => total + cell.openCount, 0);
  const openCountForRoute = (route) => opportunityRows
    .filter((cell) => cell.route === route)
    .reduce((total, cell) => total + cell.openCount, 0);
  const deliveryOpenCount = openCountForRoute('delivery_or_provider_contract');
  const diversitySchedulerOpenCount = openCountForRoute('diversity_window_or_scheduler');
  const reviewerValidatorOpenCount = openCountForRoute('reviewer_validator_calibration');
  const reviewerGateOrQuestionPlanOpenCount = openCountForRoute('reviewer_gate_or_question_plan_calibration');
  const runnerDispatchOpenCount = openCountForRoute('runner_dispatch_or_cell_scheduling');
  const runnerStaleRecoveryOpenCount = openCountForRoute('runner_stale_recovery');
  const monitorOnlyOpenCount = openCountForRoute('monitor_only');
  const otherOpenCount = Math.max(
    0,
    (Number.isFinite(Number(run.reconciledOpenTotal))
      ? asNumber(run.reconciledOpenTotal)
      : asNumber(run.computedOpenTotal))
      - ownerRevalidationOpenCount
      - questionPlanOpenCount
      - reviewerProfileOpenCount
      - deliveryOpenCount
      - diversitySchedulerOpenCount
      - reviewerValidatorOpenCount
      - reviewerGateOrQuestionPlanOpenCount
      - runnerDispatchOpenCount
      - runnerStaleRecoveryOpenCount
      - monitorOnlyOpenCount
  );
  const ownerRevalidationCandidateIds = Array.from(new Set(
    opportunityRows
      .filter((cell) => isOwnerRevalidationRoute(cell.route))
      .flatMap((cell) => cell.ownerRevalidationCandidateIds)
  )).sort((left, right) => left - right);
  const sourceCandidateCount = sum(opportunityRows, 'sourceCandidateCount');
  const revalidationEligibleSourceCount = sum(opportunityRows, 'revalidationEligibleSourceCount');
  const archivedSourceCount = sum(opportunityRows, 'archivedSourceCount');
  const policyLearningOnlySourceCount = sum(opportunityRows, 'policyLearningOnlySourceCount');
  const policyLearningOnlyOpenCount = opportunityRows
    .filter((cell) => cell.policyLearningOnlySourceCount > 0 && cell.revalidationEligibleSourceCount <= 0)
    .reduce((total, cell) => total + cell.openCount, 0);
  const sourceStatusCounts = mergeCountObjects(opportunityRows.map((cell) => cell.sourceStatusCounts));
  const ownerRevalidationPlan = opportunityRows
    .filter((cell) => isOwnerRevalidationRoute(cell.route))
    .map((cell) => {
      const legacyIdSet = new Set(cell.ownerRevalidationLegacyNonProfileRecheckIds);
      const prioritizedCandidateIds = [
        ...cell.ownerRevalidationCandidateIds.filter((id) => !legacyIdSet.has(id)),
        ...cell.ownerRevalidationCandidateIds.filter((id) => legacyIdSet.has(id))
      ];
      const plannedCandidateIds = prioritizedCandidateIds.slice(0, cell.openCount);
      const legacyNonProfileRecheckIds = plannedCandidateIds
        .filter((id) => cell.ownerRevalidationLegacyNonProfileRecheckIds.includes(id));
      const legacyNonProfileRecheckItems = cell.ownerRevalidationLegacyNonProfileRecheckItems
        .filter((item) => plannedCandidateIds.includes(item.id));
      const lowRiskPlannedCandidateIds = plannedCandidateIds.filter((id) => !legacyIdSet.has(id));
      return {
        cellId: cell.cellId,
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        openCount: cell.openCount,
        candidateCount: cell.ownerRevalidationCandidateIds.length,
        candidateSelectionPolicy: 'prefer_current_reviewer_clean_without_legacy_non_profile_reasons_then_require_formal_gate_dry_run',
        formalGateDryRunRequired: true,
        plannedCandidateIds,
        lowRiskPlannedCandidateIds,
        lowRiskPlannedCandidateCount: lowRiskPlannedCandidateIds.length,
        plannedOpenCount: Math.min(cell.openCount, cell.ownerRevalidationCandidateIds.length),
        unplannedOpenCount: Math.max(0, cell.openCount - cell.ownerRevalidationCandidateIds.length),
        overflowCandidateCount: Math.max(0, cell.ownerRevalidationCandidateIds.length - cell.openCount),
        legacyNonProfileRecheckCount: legacyNonProfileRecheckIds.length,
        legacyNonProfileRecheckIds,
        legacyNonProfileRecheckItems,
        legacyNonProfileReasonCounts: countBy(
          legacyNonProfileRecheckItems.flatMap((item) => item.reasons).map((reason) => ({ reason })),
          'reason'
        ).reduce((record, item) => {
          record[item.value] = item.count;
          return record;
        }, {})
      };
    });
  const ownerRevalidationPlannedCandidateCount = ownerRevalidationPlan
    .reduce((total, cell) => total + cell.plannedCandidateIds.length, 0);
  const ownerRevalidationLowRiskPlannedCandidateCount = ownerRevalidationPlan
    .reduce((total, cell) => total + cell.lowRiskPlannedCandidateCount, 0);
  const ownerRevalidationUnplannedOpenCount = ownerRevalidationPlan
    .reduce((total, cell) => total + cell.unplannedOpenCount, 0);
  const ownerRevalidationLegacyNonProfileRecheckCount = ownerRevalidationPlan
    .reduce((total, cell) => total + cell.legacyNonProfileRecheckCount, 0);
  const ownerRevalidationLegacyNonProfileReasonCounts = mergeCountObjects(
    ownerRevalidationPlan.map((cell) => cell.legacyNonProfileReasonCounts)
  );
  const blockedReason = cleanText(run.blockedReasonCode);
  const attention = [];
  if (blockedReason) attention.push(`run_blocked:${blockedReason}`);
  if (p0p1.length) attention.push(`p0p1:${p0p1.length}`);
  if (staleCells.length) attention.push(`stale_running_cells:${staleCells.length}`);
  if (contentGateCells.length) attention.push(`content_gate_bottleneck_cells:${contentGateCells.length}`);
  if (unclassifiedRejectedCells.length) attention.push(`unclassified_candidate_rejection_cells:${unclassifiedRejectedCells.length}`);
  if (deliveryCells.length) attention.push(`delivery_bottleneck_cells:${deliveryCells.length}`);
  if (prePublicationUniqueness.blockedCount > 0) {
    attention.push(`prepublication_near_duplicate_blocks:${prePublicationUniqueness.blockedCount}`);
  }
  const status = p0p1.length || blockedReason || staleCells.length
    ? 'needs_attention'
    : asNumber(run.computedOpenTotal) > 0
      ? 'monitoring_required'
      : 'closed_for_current_run';
  const fourFunnel = {
    targetTotal: asNumber(run.targetTotal),
    cappedPublishedTotal: asNumber(run.cappedPublishedTotal),
    computedOpenTotal: asNumber(run.computedOpenTotal),
    reconciledPublishedTotal: asNumber(run.reconciledPublishedTotal),
    reconciledOpenTotal: asNumber(run.reconciledOpenTotal),
    dispatchableOpenTotal: asNumber(run.dispatchableOpenTotal),
    reconciledDispatchableOpenTotal: asNumber(run.reconciledDispatchableOpenTotal),
    attemptCount,
    generatedCount,
    approvedGeneratedCount,
    rejectedGeneratedCount,
    generatedPerAttempt: ratio(generatedCount, attemptCount),
    deliveryYield: generatedCount <= attemptCount ? ratio(generatedCount, attemptCount) : null,
    generatedToApprovedYield: ratio(approvedGeneratedCount, generatedCount),
    attemptToApprovedYield: ratio(approvedGeneratedCount, attemptCount),
    formalQuestionCount: asNumber(quality.formalQuestionCount),
    sampledCount: asNumber(quality.sampledCount),
    countIntegrityWarnings
  };
  const throughputEfficiency = throughputEfficiencyFor({
    run,
    fourFunnel,
    dispatchCapacity,
    openCells,
    providerErrors,
    p0p1,
    blockedReason
  });
  const postProviderRecoveryEfficiencyLever = postProviderRecoveryEfficiencyLeverFor({
    throughputEfficiency,
    questionPlanOpenCount,
    reviewerProfileOpenCount,
    reviewerValidatorOpenCount,
    reviewerGateOrQuestionPlanOpenCount,
    runnerDispatchOpenCount,
    openTotal: fourFunnel.reconciledOpenTotal
  });
  const throughputEfficiencyWithRecoveryLevers = {
    ...throughputEfficiency,
    postProviderRecoveryEfficiencyLever
  };
  const mathQuestionPlanSkeletonCoverage = mathQuestionPlanSkeletonCoverageFor(cleanText(run.subject), openCells);
  return {
    subject: cleanText(run.subject),
    runId: asNumber(run.id),
    runStatus: cleanText(run.status),
    blockedReason: blockedReason || null,
    scorecardStatus: status,
    attention,
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    fourFunnel,
    throughputEfficiency: throughputEfficiencyWithRecoveryLevers,
    prePublicationUniqueness,
    bottlenecks: {
      primaryBottlenecks: countBy(openCells, 'primaryBottleneck'),
      topOpenCells: topOpenCellSummaries,
      mechanismRoutes: routeCounts,
      topOpenCellMechanismRoutes: countBy(topOpenCellSummaries, 'mechanismRoute'),
      dispatchCapacity,
      closureOpportunities: {
        scope: 'top_open_and_rejected_candidate_cells_current_replay',
        replayedCellCount: replayOpportunityCellSummaries.length,
        ownerRevalidationOpenCount,
        ownerRevalidationCandidateCount: ownerRevalidationCandidateIds.length,
        ownerRevalidationCandidateIds,
        ownerRevalidationPlannedCandidateCount,
        ownerRevalidationLowRiskPlannedCandidateCount,
        ownerRevalidationUnplannedOpenCount,
        sourceCandidateCount,
        revalidationEligibleSourceCount,
        archivedSourceCount,
        policyLearningOnlySourceCount,
        policyLearningOnlyOpenCount,
        sourceStatusCounts,
        revalidationCandidateStatusPolicy: 'owner_revalidation_candidates_restricted_to_pending_review_or_review_failed',
        ownerRevalidationLegacyNonProfileRecheckCount,
        ownerRevalidationLegacyNonProfileReasonCounts,
        ownerRevalidationPlan,
        authorizationBoundary: {
          doesNotAuthorizeApply: true,
          requiresFormalGateDryRun: true,
          plannerCommand: 'csca-ai-questioning:subject-practice-owner-revalidation-plan',
          allowedCandidateIdsSource: 'planner.dryRunGateEvidence.publishableCandidateIds',
          legacyFullRecheckApplyFlag: '--allow-legacy-full-recheck',
          legacyFullRecheckAuthorizationRequired: ownerRevalidationLegacyNonProfileRecheckCount > 0,
          forbiddenShortcut: 'do_not_apply_scorecard_ownerRevalidationCandidateIds_directly'
        },
        questionPlanOpenCount,
        reviewerProfileOpenCount,
        publishedCountReconciliationOpenCount,
        deliveryOpenCount,
        diversitySchedulerOpenCount,
        reviewerValidatorOpenCount,
        reviewerGateOrQuestionPlanOpenCount,
        runnerDispatchOpenCount,
        runnerStaleRecoveryOpenCount,
        monitorOnlyOpenCount,
        otherOpenCount,
        productionImpact: 'none_audit_only',
        providerImpact: 'none_no_provider_call'
      },
      providerErrors: providerErrors.slice(0, 6),
      p0p1
    },
    readiness: {
      status: cleanText(readiness.status) || null,
      phases: arrayFrom(readiness.phases).map((phase) => ({
        phase: cleanText(phase.phase),
        status: cleanText(phase.status)
      }))
    },
    questionPlanVisibility,
    mathQuestionPlanSkeletonCoverage,
    activeWork: {
      activeCellCount: activeCells.length,
      staleCellCount: staleCells.length,
      activeCells: activeCells.slice(0, 6).map((cell) => ({
        cellId: asNumber(cell.cellId),
        topicTitle: cleanText(cell.topicTitle),
        difficulty: cleanText(cell.difficulty),
        queuedJobCount: asNumber(cell.queuedJobCount),
        activeRunningJobCount: asNumber(cell.activeRunningJobCount),
        staleRunningJobCount: asNumber(cell.staleRunningJobCount)
      }))
    }
  };
}

function aggregateStatus(subjects) {
  if (subjects.some((subject) => subject.scorecardStatus === 'needs_attention')) return 'needs_attention';
  if (subjects.some((subject) => subject.scorecardStatus === 'monitoring_required')) return 'monitoring_required';
  return 'closed_for_current_runs';
}

function runPrePublicationUniquenessEfficiencySelfTest() {
  const blocked = prePublicationUniquenessEfficiencyFor({
    policyVersion: 'subject-practice-prepublication-uniqueness-v1',
    checkedCount: 4,
    passedCount: 3,
    blockedCount: 1,
    legacyMissingEligibleEvidenceCount: 0,
    evidenceEligibleCount: 4,
    evidenceCoverage: 1,
    checkedBlockRate: 0.25
  }, 5);
  const legacy = prePublicationUniquenessEfficiencyFor({
    checkedCount: 0,
    passedCount: 0,
    blockedCount: 0,
    legacyMissingEligibleEvidenceCount: 3,
    evidenceEligibleCount: 3,
    evidenceCoverage: 0
  }, 3);
  const active = prePublicationUniquenessEfficiencyFor({
    checkedCount: 2,
    passedCount: 2,
    blockedCount: 0,
    legacyMissingEligibleEvidenceCount: 0,
    evidenceEligibleCount: 2,
    evidenceCoverage: 1
  }, 2);
  if (blocked.status !== 'near_duplicate_generation_waste_detected'
    || blocked.blockedPerGeneratedCandidate !== 0.2
    || blocked.nextEfficiencyLever !== 'rotate_question_plan_skeleton_and_distractor_structure_before_more_provider_spend'
    || legacy.status !== 'legacy_candidates_predate_uniqueness_evidence'
    || legacy.nextEfficiencyLever !== 'monitor_new_candidates_under_prepublication_uniqueness_policy'
    || active.status !== 'active_no_stored_near_duplicate_blocks') {
    throw new Error('Pre-publication uniqueness efficiency self-test failed.');
  }
  return {
    mode: 'subject_practice_prepublication_uniqueness_efficiency_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    caseCount: 3
  };
}

function main() {
  if (hasFlag('self-test-prepublication-uniqueness')) {
    console.log(JSON.stringify(runPrePublicationUniquenessEfficiencySelfTest(), null, 2));
    return;
  }
  const sample = positiveIntArg('sample', 40, 1, 50);
  const days = positiveIntArg('days', 30, 1, 60);
  const chemistryDays = positiveIntArg('chemistry-days', 2, 1, 60);
  const chemistryRun = cleanText(argValue('chemistry-run', 'latest'));
  const qualityAuditLedger = cleanText(argValue('quality-audit-ledger', argValue('manual-review-ledger', '')));
  const profileReplayLimit = positiveIntArg('profile-replay-limit', 10, 1, 40);
  const skipProfileReplay = hasFlag('skip-profile-replay');
  const subjects = cleanText(argValue('subjects', argValue('subject', 'chemistry,math,physics')))
    .split(',')
    .map((subject) => cleanText(subject).toLowerCase())
    .filter((subject) => ['chemistry', 'math', 'physics'].includes(subject));
  const audits = subjects.map((subject) => auditForSubject(subject, {
    sample,
    days,
    chemistryDays,
    chemistryRun,
    qualityAuditLedger
  }));
  const subjectScorecards = audits.map((audit) => subjectScorecard(audit, { profileReplayLimit, skipProfileReplay }));
  const summary = subjectScorecards.map((subject) => ({
    subject: subject.subject,
    runId: subject.runId,
    runStatus: subject.runStatus,
    blockedReason: subject.blockedReason,
    scorecardStatus: subject.scorecardStatus,
    published: subject.fourFunnel.cappedPublishedTotal,
    reconciledPublished: subject.fourFunnel.reconciledPublishedTotal,
    target: subject.fourFunnel.targetTotal,
    open: subject.fourFunnel.computedOpenTotal,
    reconciledOpen: subject.fourFunnel.reconciledOpenTotal,
    attemptCount: subject.fourFunnel.attemptCount,
    generatedCount: subject.fourFunnel.generatedCount,
    approvedGeneratedCount: subject.fourFunnel.approvedGeneratedCount,
    generatedPerAttempt: subject.fourFunnel.generatedPerAttempt,
    deliveryYield: subject.fourFunnel.deliveryYield,
    generatedToApprovedYield: subject.fourFunnel.generatedToApprovedYield,
    attemptToApprovedYield: subject.fourFunnel.attemptToApprovedYield,
    countIntegrityWarnings: subject.fourFunnel.countIntegrityWarnings,
    mechanismRoutes: subject.bottlenecks.mechanismRoutes,
    topOpenCellMechanismRoutes: subject.bottlenecks.topOpenCellMechanismRoutes,
    closureOpportunities: subject.bottlenecks.closureOpportunities,
    throughputEfficiency: subject.throughputEfficiency,
    prePublicationUniqueness: subject.prePublicationUniqueness,
    questionPlanVisibility: subject.questionPlanVisibility,
    mathQuestionPlanSkeletonCoverage: subject.mathQuestionPlanSkeletonCoverage,
    attention: subject.attention
  }));
  const report = {
    mode: 'subject_practice_quality_scorecard',
    scope: 'chemistry_math_physics_subject_practice',
    status: aggregateStatus(subjectScorecards),
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_audit_state',
    providerFailurePolicy: 'delivery_failures_reported_separately_not_quality_memory',
    currentProfileReplayPolicy: skipProfileReplay
      ? 'disabled_by_flag'
      : `top_open_and_rejected_content_gate_cells_deterministic_only_limit_${profileReplayLimit}`,
    studentConsumableScope: 'formal_published_subject_practice_pool_only',
    doesNotProve: [
      'future_provider_delivery_success',
      'broad_student_consumable_quality_without_continued_sampling',
      'question_plan_live_quality_gain_across_all_cells'
    ],
    ...(hasFlag('summary-only') ? { subjects: [] } : { subjects: subjectScorecards }),
    summary
  };
  if (hasFlag('json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Subject-practice quality scorecard: ${report.status}`);
  for (const item of report.summary) {
    console.log(`- ${item.subject} #${item.runId}: ${item.scorecardStatus}, ${item.published}/${item.target}, open=${item.open}, attempts=${item.attemptCount}, generated=${item.generatedCount}, approved=${item.approvedGeneratedCount}, yields=${item.deliveryYield ?? 'n/a'}/${item.generatedToApprovedYield ?? 'n/a'}/${item.attemptToApprovedYield ?? 'n/a'}`);
    if (item.countIntegrityWarnings.length) console.log(`  countWarnings=${item.countIntegrityWarnings.join(',')}`);
    if (item.throughputEfficiency) {
      console.log(`  throughput=${item.throughputEfficiency.status}, activeUtilization=${item.throughputEfficiency.activeUtilization ?? 'n/a'}, lever=${item.throughputEfficiency.nextEfficiencyLever ?? 'none'}`);
    }
    if (item.prePublicationUniqueness) {
      console.log(`  prePublicationUniqueness=${item.prePublicationUniqueness.status}, checked=${item.prePublicationUniqueness.checkedCount}, blocked=${item.prePublicationUniqueness.blockedCount}, coverage=${item.prePublicationUniqueness.evidenceCoverage ?? 'n/a'}, lever=${item.prePublicationUniqueness.nextEfficiencyLever}`);
    }
    if (item.mechanismRoutes.length) console.log(`  routes=${item.mechanismRoutes.map((route) => `${route.value}:${route.count}`).join(',')}`);
    if (item.topOpenCellMechanismRoutes.length) console.log(`  topCellRoutes=${item.topOpenCellMechanismRoutes.map((route) => `${route.value}:${route.count}`).join(',')}`);
    if (item.closureOpportunities) console.log(`  closure=ownerRevalidationOpen:${item.closureOpportunities.ownerRevalidationOpenCount}, ownerRevalidationCandidates:${item.closureOpportunities.ownerRevalidationCandidateCount}, ownerRevalidationPlanned:${item.closureOpportunities.ownerRevalidationPlannedCandidateCount}, ownerRevalidationLowRisk:${item.closureOpportunities.ownerRevalidationLowRiskPlannedCandidateCount}, ownerRevalidationUnplanned:${item.closureOpportunities.ownerRevalidationUnplannedOpenCount}, sourceCandidates:${item.closureOpportunities.sourceCandidateCount}, revalidationEligibleSource:${item.closureOpportunities.revalidationEligibleSourceCount}, archivedSource:${item.closureOpportunities.archivedSourceCount}, policyLearningOnly:${item.closureOpportunities.policyLearningOnlySourceCount}, policyLearningOnlyOpen:${item.closureOpportunities.policyLearningOnlyOpenCount}, legacyRecheck:${item.closureOpportunities.ownerRevalidationLegacyNonProfileRecheckCount}, reviewerProfileOpen:${item.closureOpportunities.reviewerProfileOpenCount}, questionPlanOpen:${item.closureOpportunities.questionPlanOpenCount}, publishedCountReconciliationOpen:${item.closureOpportunities.publishedCountReconciliationOpenCount}, deliveryOpen:${item.closureOpportunities.deliveryOpenCount}, diversitySchedulerOpen:${item.closureOpportunities.diversitySchedulerOpenCount}, reviewerValidatorOpen:${item.closureOpportunities.reviewerValidatorOpenCount}, reviewerGateOrQuestionPlanOpen:${item.closureOpportunities.reviewerGateOrQuestionPlanOpenCount}, runnerDispatchOpen:${item.closureOpportunities.runnerDispatchOpenCount}, runnerStaleRecoveryOpen:${item.closureOpportunities.runnerStaleRecoveryOpenCount}, monitorOnlyOpen:${item.closureOpportunities.monitorOnlyOpenCount}, otherOpen:${item.closureOpportunities.otherOpenCount}`);
    if (item.questionPlanVisibility) {
      const visibility = item.questionPlanVisibility;
      const subjectDetail = visibility.chemistry || visibility.math || visibility.physics || {};
      console.log(`  questionPlanVisibility=${visibility.status}, coverage=${visibility.coverageStatus}, phases=${visibility.readinessPhases.map((phase) => `${phase.phase}:${phase.status}`).join(',') || 'none'}, samples=${subjectDetail.sampleCount ?? subjectDetail.calibrationSampleCount ?? 0}, gateImpact=${visibility.gateImpact}`);
    }
    if (item.attention.length) console.log(`  attention=${item.attention.join(',')}`);
  }
}

try {
  main();
} catch (error) {
  if (hasFlag('json')) {
    if (isDatabaseUnavailableError(error)) {
      console.log(JSON.stringify({
        mode: 'subject_practice_quality_scorecard',
        scope: 'chemistry_math_physics_subject_practice',
        status: 'operational_wait',
        scorecardStatus: 'runtime_unavailable',
        nextStep: 'start_database_then_rerun_subject_practice_quality_scorecard',
        operationalWaitCodes: ['database_unavailable'],
        productionImpact: 'none_audit_only',
        providerImpact: 'none_no_provider_call',
        dbImpact: 'read_failed_database_unavailable',
        providerFailurePolicy: 'delivery_failures_reported_separately_not_quality_memory',
        studentConsumableScope: 'formal_published_subject_practice_pool_only',
        doesNotProve: [
          'runtime_subject_practice_state',
          'student_consumable_quality',
          'question_plan_live_quality_gain_across_all_cells'
        ],
        subjects: [],
        summary: [],
        error: {
          code: 'database_unavailable',
          message: compactErrorMessage(error)
        }
      }, null, 2));
      process.exitCode = 0;
      return;
    }
    console.log(JSON.stringify({
      mode: 'subject_practice_quality_scorecard',
      status: 'failed',
      error: error?.message ?? String(error),
      productionImpact: 'none_audit_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_audit_state'
    }, null, 2));
  } else {
    console.error(error?.stack ?? error);
  }
  process.exitCode = 1;
}
