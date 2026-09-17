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

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function countBy(values) {
  const counts = {};
  for (const value of values.map(cleanText).filter(Boolean)) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function routeFromFormalGateBlockReasons(reasons) {
  const text = reasons.map(cleanText).join(' ');
  if (/profile_|difficulty_evidence|hard_|medium_|calculation|multistep|quantitative_shape/i.test(text)) {
    return 'question_plan_evidence_slots_or_difficulty_rubric';
  }
  if (/similarity|past_paper|source/i.test(text)) {
    return 'source_similarity_or_legacy_full_recheck';
  }
  if (/near[_-]?duplicate|duplicate|task_family|family_overrepresented/i.test(text)) {
    return 'diversity_or_near_duplicate_recovery';
  }
  if (/answer|uniqueness|explanation|validator|quality_attention/i.test(text)) {
    return 'reviewer_validator_calibration';
  }
  if (/provider_|gateway_|schema|timeout|network|empty_output|rate_limited|cooldown/i.test(text)) {
    return 'delivery_or_provider_contract';
  }
  return reasons.length ? 'formal_gate_calibration_required' : null;
}

function positiveIntArg(name, fallback, min, max) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function runScorecard(subject, options) {
  const args = [
    path.resolve(__dirname, 'csca-subject-practice-quality-scorecard.cjs'),
    `--subjects=${subject}`,
    '--json',
    `--sample=${options.sample}`,
    `--days=${options.days}`,
    `--profile-replay-limit=${options.profileReplayLimit}`
  ];
  if (options.runOverride) args.push(`--${subject}-run=${options.runOverride}`);
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`quality scorecard did not emit valid JSON: ${error.message}\n${stdout.slice(0, 500)}`);
  }
}

function runOwnerRevalidationDryRun(subject, productionRunId, candidateIds) {
  if (!candidateIds.length) return null;
  const args = [
    path.resolve(__dirname, 'csca-subject-practice-owner-revalidation-apply.cjs'),
    `--subject=${subject}`,
    `--run=${productionRunId}`,
    `--candidate-ids=${candidateIds.join(',')}`,
    '--json'
  ];
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, args, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 30 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    const stderr = cleanText(error?.stderr || error?.message || '');
    const databaseUnavailable = /Can't reach database server|database.*unavailable|ECONNREFUSED|P1001/i.test(stderr);
    return {
      mode: 'subject_practice_owner_revalidation_dry_run_unavailable',
      status: 'operational_wait',
      providerImpact: 'none_no_provider_call',
      productionImpact: 'none_read_only_execution_plan',
      dbImpact: 'read_only_attempted',
      errorCategory: databaseUnavailable ? 'database_unavailable' : 'dry_run_unavailable',
      operationalWaitCodes: databaseUnavailable ? ['database_unavailable'] : ['owner_revalidation_dry_run_unavailable'],
      errorMessage: stderr.slice(0, 500)
    };
  }
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`owner revalidation dry-run did not emit valid JSON: ${error.message}\n${stdout.slice(0, 500)}`);
  }
}

function uniqueSorted(ids) {
  return Array.from(new Set(ids.map(asNumber).filter((id) => id > 0))).sort((left, right) => left - right);
}

function buildPlan(subjectSummary, options) {
  const closure = recordFrom(subjectSummary.closureOpportunities);
  const cells = arrayFrom(closure.ownerRevalidationPlan).map(recordFrom);
  const lowRiskCells = cells
    .map((cell) => ({
      cellId: asNumber(cell.cellId),
      topicTitle: cleanText(cell.topicTitle),
      difficulty: cleanText(cell.difficulty),
      openCount: asNumber(cell.openCount),
      plannedCandidateIds: uniqueSorted(cell.plannedCandidateIds ?? []),
      lowRiskPlannedCandidateIds: uniqueSorted(cell.lowRiskPlannedCandidateIds ?? []),
      legacyNonProfileRecheckIds: uniqueSorted(cell.legacyNonProfileRecheckIds ?? []),
      legacyNonProfileRecheckItems: arrayFrom(cell.legacyNonProfileRecheckItems).map((item) => ({
        id: asNumber(recordFrom(item).id),
        reasons: arrayFrom(recordFrom(item).reasons).map(cleanText).filter(Boolean)
      })).filter((item) => item.id > 0)
    }))
    .filter((cell) => cell.lowRiskPlannedCandidateIds.length > 0 || cell.legacyNonProfileRecheckIds.length > 0);
  const lowRiskCandidateIds = uniqueSorted(lowRiskCells.flatMap((cell) => cell.lowRiskPlannedCandidateIds));
  const legacyRecheckCandidateIds = uniqueSorted(lowRiskCells.flatMap((cell) => cell.legacyNonProfileRecheckIds));
  const dryRun = runOwnerRevalidationDryRun(cleanText(subjectSummary.subject), asNumber(subjectSummary.runId), lowRiskCandidateIds);
  const dryRunRecord = recordFrom(dryRun);
  const dryRunOperationalWait = cleanText(dryRunRecord.status) === 'operational_wait';
  const dryRunItems = arrayFrom(recordFrom(dryRun).items).map(recordFrom);
  const dryRunPublishableIds = uniqueSorted(dryRunItems
    .filter((item) => cleanText(item.action) === 'would_auto_approve_via_existing_gate')
    .map((item) => item.id));
  const dryRunBlockedIds = uniqueSorted(dryRunItems
    .filter((item) => cleanText(item.action) === 'blocked_after_owner_revalidation')
    .map((item) => item.id));
  const dryRunBlockedItems = dryRunItems
    .filter((item) => cleanText(item.action) === 'blocked_after_owner_revalidation')
    .map((item) => ({
      id: asNumber(item.id),
      cellId: asNumber(item.productionCellId),
      gateDecision: cleanText(item.gateDecision) || null,
      reviewDecision: cleanText(item.reviewDecision) || null,
      reasons: arrayFrom(item.reasons).map(cleanText).filter(Boolean),
      blockReasons: arrayFrom(item.blockReasons).map(cleanText).filter(Boolean)
    }))
    .filter((item) => item.id > 0);
  const dryRunBlockReasons = dryRunBlockedItems.flatMap((item) => item.blockReasons);
  const authorizedLowRiskCandidateIds = dryRunOperationalWait ? [] : dryRun ? dryRunPublishableIds : lowRiskCandidateIds;
  const formalGateBlockedRoute = authorizedLowRiskCandidateIds.length === 0 && dryRunBlockedItems.length > 0
    ? routeFromFormalGateBlockReasons(dryRunBlockReasons)
    : null;
  const attention = arrayFrom(subjectSummary.attention).map(cleanText).filter(Boolean);
  const noGoReasons = [];
  if (cleanText(subjectSummary.runStatus) !== 'running') noGoReasons.push(`run_status_${cleanText(subjectSummary.runStatus) || 'unknown'}`);
  if (cleanText(subjectSummary.blockedReason)) noGoReasons.push(`run_blocked_${cleanText(subjectSummary.blockedReason)}`);
  if (attention.some((item) => /^p0p1:/.test(item))) noGoReasons.push('p0p1_attention_present');
  if (lowRiskCandidateIds.length === 0) noGoReasons.push('no_low_risk_owner_revalidation_candidates');
  if (dryRunOperationalWait) noGoReasons.push(`owner_revalidation_dry_run_${cleanText(dryRunRecord.errorCategory) || 'unavailable'}`);
  if (authorizedLowRiskCandidateIds.length === 0) noGoReasons.push('no_formal_gate_publishable_owner_revalidation_candidates');
  if (asNumber(closure.ownerRevalidationLowRiskPlannedCandidateCount) !== lowRiskCandidateIds.length) {
    noGoReasons.push('low_risk_count_mismatch');
  }
  if (dryRun && arrayFrom(dryRun.missingOrIneligibleCandidateIds).length > 0) {
    noGoReasons.push('owner_revalidation_dry_run_missing_or_ineligible');
  }
  const status = noGoReasons.length
    ? 'not_ready'
    : authorizedLowRiskCandidateIds.length === lowRiskCandidateIds.length
      ? 'ready_for_authorized_low_risk_revalidation'
      : 'partial_ready_for_authorized_formal_gate_revalidation';
  const candidateGateReadyButRunBlocked = authorizedLowRiskCandidateIds.length > 0
    && noGoReasons.some((reason) => /^run_status_|^run_blocked_/.test(reason))
    && !noGoReasons.some((reason) => /no_low_risk|no_formal_gate|missing_or_ineligible|count_mismatch/.test(reason));
  return {
    mode: 'subject_practice_owner_revalidation_plan',
    status,
    subject: cleanText(subjectSummary.subject),
    productionRunId: asNumber(subjectSummary.runId),
    runStatus: cleanText(subjectSummary.runStatus),
    blockedReason: cleanText(subjectSummary.blockedReason) || null,
    scorecardStatus: cleanText(subjectSummary.scorecardStatus),
    productionImpact: 'none_read_only_execution_plan',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_scorecard_input',
    applyImpactNotExercised: 'requires_separate_explicit_authorization',
    dryRunGateEvidence: dryRun
      ? dryRunOperationalWait
        ? {
          mode: cleanText(dryRunRecord.mode),
          status: cleanText(dryRunRecord.status),
          providerImpact: cleanText(dryRunRecord.providerImpact),
          productionImpact: cleanText(dryRunRecord.productionImpact),
          dbImpact: cleanText(dryRunRecord.dbImpact),
          errorCategory: cleanText(dryRunRecord.errorCategory),
          operationalWaitCodes: arrayFrom(dryRunRecord.operationalWaitCodes).map(cleanText).filter(Boolean),
          errorMessage: cleanText(dryRunRecord.errorMessage),
          found: 0,
          blocked: 0,
          wouldAutoApprove: 0,
          publishableCandidateIds: [],
          blockedCandidateIds: [],
          blockedReasonCounts: {},
          blockedItems: [],
          blockedRoute: null,
          missingOrIneligibleCandidateIds: []
        }
        : {
        mode: cleanText(dryRunRecord.mode),
        providerImpact: cleanText(dryRunRecord.providerImpact),
        productionImpact: cleanText(dryRunRecord.productionImpact),
        found: asNumber(recordFrom(dryRun.summary).found),
        blocked: dryRunBlockedIds.length,
        wouldAutoApprove: dryRunPublishableIds.length,
        publishableCandidateIds: dryRunPublishableIds,
        blockedCandidateIds: dryRunBlockedIds,
        blockedReasonCounts: countBy(dryRunBlockReasons),
        blockedItems: dryRunBlockedItems,
        blockedRoute: formalGateBlockedRoute,
        missingOrIneligibleCandidateIds: uniqueSorted(dryRun.missingOrIneligibleCandidateIds ?? [])
      }
      : null,
    sourceScorecardPolicy: {
      command: 'csca-ai-questioning:subject-practice-quality-scorecard',
      profileReplayLimit: options.profileReplayLimit,
      candidateSelectionPolicy: 'prefer_current_reviewer_clean_without_legacy_non_profile_reasons_then_require_formal_gate_dry_run'
    },
    fourFunnel: {
      published: asNumber(subjectSummary.published),
      target: asNumber(subjectSummary.target),
      open: asNumber(subjectSummary.open),
      generatedToApprovedYield: subjectSummary.generatedToApprovedYield ?? null,
      attemptToApprovedYield: subjectSummary.attemptToApprovedYield ?? null,
      countIntegrityWarnings: arrayFrom(subjectSummary.countIntegrityWarnings).map(cleanText).filter(Boolean)
    },
    closureScope: cleanText(closure.scope),
    ownerRevalidation: {
      openCount: asNumber(closure.ownerRevalidationOpenCount),
      candidateCount: asNumber(closure.ownerRevalidationCandidateCount),
      plannedCandidateCount: asNumber(closure.ownerRevalidationPlannedCandidateCount),
      lowRiskPlannedCandidateCount: lowRiskCandidateIds.length,
      formalGatePublishablePlannedCandidateCount: authorizedLowRiskCandidateIds.length,
      unplannedOpenCount: asNumber(closure.ownerRevalidationUnplannedOpenCount),
      legacyNonProfileRecheckCount: legacyRecheckCandidateIds.length,
      lowRiskCandidateIds,
      formalGatePublishableCandidateIds: authorizedLowRiskCandidateIds,
      formalGateBlockedCandidateIds: dryRunBlockedIds,
      formalGateBlockedReasonCounts: countBy(dryRunBlockReasons),
      formalGateBlockedRoute,
      legacyRecheckCandidateIds,
      cells: lowRiskCells
    },
    candidateGateReadyButRunBlocked,
    noGoReasons,
    authorizationBoundary: {
      allowedWork: 'low_risk_owner_revalidation_only',
      allowedSubject: cleanText(subjectSummary.subject),
      allowedProductionRunId: asNumber(subjectSummary.runId),
      allowedCandidateIds: authorizedLowRiskCandidateIds,
      excludedCandidateIds: legacyRecheckCandidateIds,
      excludedCandidatePolicy: 'legacy_non_profile_recheck_requires_full_automatic_gate_and_source_similarity_authorization',
      legacyFullRecheckApplyFlag: '--allow-legacy-full-recheck',
      legacyFullRecheckAuthorizationRequired: legacyRecheckCandidateIds.length > 0,
      requiresExplicitAuthorization: true,
      requiresExactCandidateWhitelist: true,
      forbiddenActions: [
        'provider_call',
        'new_candidate_generation',
        'publish_without_automatic_gate_pass',
        'skip_source_similarity_check',
        'include_legacy_non_profile_recheck_in_low_risk_apply',
        'student_pool_manual_override'
      ]
    },
    recommendedNextAction: candidateGateReadyButRunBlocked
      ? 'do_not_apply_candidate_gate_ready_but_run_blocked_unblock_run_or_use_fresh_observation_path'
      : noGoReasons.includes('no_formal_gate_publishable_owner_revalidation_candidates') && formalGateBlockedRoute
      ? `do_not_apply_route_to_${formalGateBlockedRoute}`
      : noGoReasons.length
        ? 'do_not_apply_resolve_no_go_or_refresh_scorecard'
        : 'request_authorization_for_exact_low_risk_owner_revalidation_candidate_whitelist'
  };
}

function main() {
  const requestedSubjects = cleanText(argValue('subjects', '')).split(',').map((item) => cleanText(item).toLowerCase()).filter(Boolean);
  const subject = cleanText(argValue('subject', requestedSubjects[0] || 'chemistry')).toLowerCase();
  const json = hasFlag('json');
  const options = {
    sample: positiveIntArg('sample', 10, 1, 80),
    days: positiveIntArg('days', 30, 1, 90),
    profileReplayLimit: positiveIntArg('profile-replay-limit', 10, 1, 40),
    runOverride: cleanText(argValue('run', argValue(`${subject}-run`, '')))
  };
  const scorecard = runScorecard(subject, options);
  const summary = recordFrom(arrayFrom(scorecard.summary).find((item) => cleanText(item.subject) === subject));
  if (!summary.subject) throw new Error(`No scorecard summary found for subject=${subject}.`);
  const plan = buildPlan(summary, options);
  if (json) {
    console.log(JSON.stringify(plan, jsonReplacer, 2));
    return;
  }
  console.log(`Subject-practice owner revalidation plan: ${plan.status}`);
  console.log(`Scope: ${plan.subject} #${plan.productionRunId}, run=${plan.runStatus}, blocked=${plan.blockedReason ?? 'none'}`);
  console.log(`Low-risk candidates=${plan.ownerRevalidation.lowRiskPlannedCandidateCount}: ${plan.ownerRevalidation.lowRiskCandidateIds.join(',') || 'none'}`);
  if (plan.ownerRevalidation.legacyRecheckCandidateIds.length) {
    console.log(`Excluded legacy/full-recheck candidates=${plan.ownerRevalidation.legacyRecheckCandidateIds.join(',')}`);
  }
  if (plan.noGoReasons.length) console.log(`NO-GO=${plan.noGoReasons.join(',')}`);
  console.log(`Next=${plan.recommendedNextAction}`);
}

main();
