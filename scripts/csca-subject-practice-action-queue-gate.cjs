#!/usr/bin/env node

const cp = require('node:child_process');
const path = require('node:path');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function positiveInt(name, fallback) {
  const value = Number(argValue(name, fallback));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function runArgValue(name, fallback = 'latest') {
  const value = cleanText(argValue(name, fallback));
  return value || fallback;
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function compactErrorMessage(error) {
  return String(error?.message || error || '')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function isDatabaseUnavailableError(error) {
  const text = String(error?.stack || error?.message || error || '');
  return /Can't reach database server|PrismaClientInitializationError|P1001|ECONNREFUSED/i.test(text);
}

function runNextAction({ subject, runId, sample, days, baseUrl, observationCell }) {
  const args = [
    scriptPath('csca-subject-practice-next-action.cjs'),
    `--subject=${subject}`,
    `--run=${runId}`,
    `--sample=${sample}`,
    `--days=${days}`
  ];
  if (baseUrl) args.push(`--base-url=${baseUrl}`);
  if (subject === 'math' && Number(observationCell) > 0) args.push(`--observation-cell=${Number(observationCell)}`);
  args.push('--json');
  const output = cp.execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function actionCompletenessFor(item) {
  const actionType = cleanText(item?.actionType);
  const target = item?.target || {};
  const commands = item?.operatorCommands || {};
  const post = item?.postExecutionVerificationCommands || {};
  const missing = [];
  const isMathTarget = cleanText(target.subject) === 'math';
  if (!arrayFrom(item?.preAuthorizationChecks).length) missing.push('preAuthorizationChecks');
  if (!cleanText(item?.authorizationText)) missing.push('authorizationText');
  if (actionType === 'live_existing_queued_job') {
    if (!Number(target.productionCellId)) missing.push('target.productionCellId');
    if (!Number(target.jobId)) missing.push('target.jobId');
    if (!cleanText(commands.startObservationBackend)) missing.push('operatorCommands.startObservationBackend');
    if (!cleanText(commands.preview)) missing.push('operatorCommands.preview');
    if (!cleanText(commands.applyAfterAuthorization)) missing.push('operatorCommands.applyAfterAuthorization');
    if (!cleanText(commands.verifyEvidence)) missing.push('operatorCommands.verifyEvidence');
    if (isMathTarget && !cleanText(commands.targetPromptContractSelfTest)) missing.push('operatorCommands.targetPromptContractSelfTest');
    if (!cleanText(post.verifyEvidence)) missing.push('postExecutionVerificationCommands.verifyEvidence');
    if (isMathTarget && !cleanText(post.targetPromptContractSelfTest)) missing.push('postExecutionVerificationCommands.targetPromptContractSelfTest');
  } else if (actionType === 'submit_one_guarded_observation_task') {
    if (!Number(target.productionCellId)) missing.push('target.productionCellId');
    if (!cleanText(target.taskFamily)) missing.push('target.taskFamily');
    if (!Number(target.maxEstimatedCostUsd)) missing.push('target.maxEstimatedCostUsd');
    if (!Number(target.maximumReservedCostUsd)) missing.push('target.maximumReservedCostUsd');
    if (!cleanText(commands.startObservationBackend)) missing.push('operatorCommands.startObservationBackend');
    if (!cleanText(commands.targetPromptContractSelfTest)) missing.push('operatorCommands.targetPromptContractSelfTest');
    if (!cleanText(commands.preview)) missing.push('operatorCommands.preview');
    if (!cleanText(commands.applyAfterAuthorization)) missing.push('operatorCommands.applyAfterAuthorization');
    if (!cleanText(commands.observationScorecard)) missing.push('operatorCommands.observationScorecard');
    if (!cleanText(post.targetPromptContractSelfTest)) missing.push('postExecutionVerificationCommands.targetPromptContractSelfTest');
    if (!cleanText(post.observationScorecard)) missing.push('postExecutionVerificationCommands.observationScorecard');
  } else if (actionType === 'revalidate_existing_candidates_without_provider') {
    const rawCandidateIds = arrayFrom(target.candidateIds);
    const candidateIds = rawCandidateIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!candidateIds.length) missing.push('target.candidateIds');
    if (candidateIds.length !== rawCandidateIds.length) missing.push('target.candidateIdsExactPositiveIntegers');
    if (new Set(candidateIds).size !== candidateIds.length) missing.push('target.candidateIdsUnique');
    if (Number(target.providerCallLimit) !== 0) missing.push('target.providerCallLimitZero');
    const exactContentSetSha256 = cleanText(target.exactContentSetSha256).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(exactContentSetSha256)) missing.push('target.exactContentSetSha256');
    if (cleanText(target.publicationPolicy) !== 'existing_automatic_gate_only_after_exact_explicit_authorization') {
      missing.push('target.publicationPolicy');
    }
    if (!cleanText(commands.plan)) missing.push('operatorCommands.plan');
    if (!cleanText(commands.inspectCandidateContent)) missing.push('operatorCommands.inspectCandidateContent');
    if (!cleanText(commands.preview)) missing.push('operatorCommands.preview');
    if (!cleanText(commands.applyAfterAuthorization)) missing.push('operatorCommands.applyAfterAuthorization');
    if (!cleanText(commands.verifyScorecard)) missing.push('operatorCommands.verifyScorecard');
    if (!cleanText(commands.verifyProductionAudit)) missing.push('operatorCommands.verifyProductionAudit');
    if (!cleanText(commands.applyAfterAuthorization).includes('--confirm-exact-owner-revalidation')) {
      missing.push('operatorCommands.applyAfterAuthorizationExactConfirmation');
    }
    if (!cleanText(commands.applyAfterAuthorization).includes(`--expected-content-set-sha256=${exactContentSetSha256}`)) {
      missing.push('operatorCommands.applyAfterAuthorizationContentPrecondition');
    }
  } else if (/enqueue_one_exact_cell_job/.test(actionType)) {
    if (!Number(target.productionCellId)) missing.push('target.productionCellId');
    if (!Number(target.blueprintId)) missing.push('target.blueprintId');
    if (!cleanText(commands.previewNextCell)) missing.push('operatorCommands.previewNextCell');
    if (!cleanText(commands.applyAfterAuthorization)) missing.push('operatorCommands.applyAfterAuthorization');
    if (!cleanText(commands.queuedRevalidationAfterEnqueue)) missing.push('operatorCommands.queuedRevalidationAfterEnqueue');
    if (!cleanText(post.queuedRevalidationAfterEnqueue)) missing.push('postExecutionVerificationCommands.queuedRevalidationAfterEnqueue');
  } else {
    missing.push('recognizedActionType');
  }
  if (!cleanText(post.scorecard)) missing.push('postExecutionVerificationCommands.scorecard');
  if (!cleanText(post.actionQueueGate)) missing.push('postExecutionVerificationCommands.actionQueueGate');
  if (!cleanText(post.noProviderAcceptance)) missing.push('postExecutionVerificationCommands.noProviderAcceptance');
  return {
    complete: missing.length === 0,
    missing
  };
}

function classifyGate(nextAction) {
  const throughputStatus = cleanText(nextAction.throughputEfficiency?.status);
  const acceptableThroughput = new Set([
    'acceptable',
    'acceptable_with_operator_actions',
    'acceptable_with_bounded_stage_evidence',
    'acceptable_for_one_guarded_observation_only',
    'closed_or_no_open_work'
  ]).has(throughputStatus);
  const items = arrayFrom(nextAction.actionQueue?.items);
  const readyItems = items.filter((item) => cleanText(item.executionReadiness) === 'requires_fresh_explicit_authorization');
  const deferredItems = items.filter((item) => cleanText(item.executionReadiness) === 'deferred_until_provider_recovery');
  const readOnlyItems = items.filter((item) => cleanText(item.executionReadiness).startsWith('read_only_'));
  const noActionItems = items.filter((item) => cleanText(item.executionReadiness).startsWith('no_authorized'));
  const firstReadyItem = readyItems[0] || null;
  const zeroProviderExistingCandidateRecovery = cleanText(firstReadyItem?.actionType) === 'revalidate_existing_candidates_without_provider'
    && Number(firstReadyItem?.target?.providerCallLimit) === 0;
  if (!acceptableThroughput && !zeroProviderExistingCandidateRecovery) {
    return {
      status: 'below_acceptable_efficiency',
      recommendedAction: null,
      reason: throughputStatus || 'throughput_efficiency_missing'
    };
  }
  if (readyItems.length) {
    const readyItem = firstReadyItem;
    const completeness = actionCompletenessFor(readyItem);
    if (!completeness.complete) {
      return {
        status: 'action_queue_ready_item_incomplete',
        recommendedAction: null,
        reason: `missing:${completeness.missing.join(',')}`,
        incompleteAction: readyItem,
        missingFields: completeness.missing
      };
    }
    return {
      status: 'ready_for_explicit_authorization',
      recommendedAction: readyItem,
      reason: zeroProviderExistingCandidateRecovery
        ? 'existing_candidate_recovery_requires_no_provider_spend'
        : 'first_action_queue_item_ready_for_fresh_explicit_authorization'
    };
  }
  if (deferredItems.length) {
    return {
      status: 'deferred_until_provider_recovery',
      recommendedAction: deferredItems[0],
      reason: 'provider_delivery_backoff_or_provider_recovery_required'
    };
  }
  if (readOnlyItems.length) {
    return {
      status: 'read_only_progression_ready',
      recommendedAction: readOnlyItems[0],
      reason: 'bounded_stage_evidence_allows_read_only_progression_without_provider_authorization'
    };
  }
  return {
    status: noActionItems.length ? 'no_authorized_action_ready' : 'action_queue_missing_ready_item',
    recommendedAction: null,
    reason: noActionItems[0]?.status || 'no_queue_item_ready_for_authorization'
  };
}

function runSelfTest() {
  const completeLiveItem = {
    priority: 1,
    role: 'primary_next_action',
    actionType: 'live_existing_queued_job',
    executionReadiness: 'requires_fresh_explicit_authorization',
    target: { productionCellId: 610, jobId: 21292 },
    preAuthorizationChecks: ['run_action_queue_gate_with_require_ready'],
    authorizationText: 'Authorize exactly one live provider call for chemistry production run #200, job #21292, cell #610.',
    operatorCommands: {
      startObservationBackend: 'npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --cell-allowlist=610',
      preview: 'npm.cmd run csca-ai-questioning:question-plan-live-job -- --json',
      applyAfterAuthorization: 'authorized live-provider command placeholder for action-completeness self-test only',
      verifyEvidence: 'npm.cmd run csca-ai-questioning:question-plan-live-job -- --json'
    },
    postExecutionVerificationCommands: {
      verifyEvidence: 'npm.cmd run csca-ai-questioning:question-plan-live-job -- --json',
      scorecard: 'npm.cmd run csca-ai-questioning:subject-practice-quality-scorecard -- --json',
      actionQueueGate: 'npm.cmd run csca-ai-questioning:subject-practice-action-queue-gate -- --json',
      noProviderAcceptance: 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance -- --json'
    }
  };
  const completeMathLiveItem = {
    ...completeLiveItem,
    target: { subject: 'math', productionCellId: 338, jobId: 21293 },
    authorizationText: 'Authorize exactly one live provider call for math production run #156, job #21293, cell #338.',
    operatorCommands: {
      ...completeLiveItem.operatorCommands,
      targetPromptContractSelfTest: 'npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=156 --cell=338 --json'
    },
    postExecutionVerificationCommands: {
      ...completeLiveItem.postExecutionVerificationCommands,
      targetPromptContractSelfTest: 'npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=156 --cell=338 --json'
    }
  };
  const ready = classifyGate({
    throughputEfficiency: { status: 'acceptable_with_operator_actions' },
    actionQueue: {
      items: [completeLiveItem]
    }
  });
  assert(ready.status === 'ready_for_explicit_authorization', 'Ready queue item should pass the action queue gate.');
  assert(ready.recommendedAction?.target?.jobId === 21292, 'Ready gate should preserve the exact recommended job.');

  const mathReady = classifyGate({
    throughputEfficiency: { status: 'acceptable_with_operator_actions' },
    actionQueue: {
      items: [completeMathLiveItem]
    }
  });
  assert(mathReady.status === 'ready_for_explicit_authorization', 'Ready math live queue item should pass after target prompt contract self-test evidence is present.');
  assert(mathReady.recommendedAction?.operatorCommands?.targetPromptContractSelfTest, 'Ready math live queue item should preserve the target prompt contract self-test command.');

  const mathMissingPromptContract = classifyGate({
    throughputEfficiency: { status: 'acceptable_with_operator_actions' },
    actionQueue: {
      items: [
        {
          ...completeMathLiveItem,
          operatorCommands: {
            ...completeMathLiveItem.operatorCommands,
            targetPromptContractSelfTest: ''
          },
          postExecutionVerificationCommands: {
            ...completeMathLiveItem.postExecutionVerificationCommands,
            targetPromptContractSelfTest: ''
          }
        }
      ]
    }
  });
  assert(mathMissingPromptContract.status === 'action_queue_ready_item_incomplete', 'Math live queue item must not pass without target prompt contract self-test evidence.');
  assert(mathMissingPromptContract.missingFields.includes('operatorCommands.targetPromptContractSelfTest'), 'Math live queue item should report missing target prompt contract operator command.');
  assert(mathMissingPromptContract.missingFields.includes('postExecutionVerificationCommands.targetPromptContractSelfTest'), 'Math live queue item should report missing target prompt contract verification command.');

  const below = classifyGate({
    throughputEfficiency: { status: 'below_acceptable_efficiency' },
    actionQueue: {
      items: [completeLiveItem]
    }
  });
  assert(below.status === 'below_acceptable_efficiency', 'Below-threshold throughput must block ready authorization.');
  assert(below.recommendedAction === null, 'Below-threshold throughput must not recommend spending another live action.');

  const guardedObservationReady = classifyGate({
    throughputEfficiency: { status: 'acceptable_for_one_guarded_observation_only' },
    actionQueue: {
      items: [{
        priority: 1,
        role: 'primary_next_action',
        actionType: 'submit_one_guarded_observation_task',
        executionReadiness: 'requires_fresh_explicit_authorization',
        target: {
          subject: 'physics', productionCellId: 19, blueprintId: 19,
          taskFamily: 'physics_optics_two_relation', maxEstimatedCostUsd: 0.01, maximumReservedCostUsd: 0.00434
        },
        preAuthorizationChecks: ['run_guarded_observation_preview_and_confirm_cost_reservation_within_explicit_cap'],
        authorizationText: 'Authorize exactly one guarded Provider request and local evidence writes for physics cell #19 with no student publication.',
        operatorCommands: {
          startObservationBackend: 'start isolated observation backend',
          targetPromptContractSelfTest: 'verify exact physics prompt contract',
          preview: 'preview guarded physics observation',
          applyAfterAuthorization: 'apply guarded physics observation and wait for terminal task',
          observationScorecard: 'score guarded physics observation'
        },
        postExecutionVerificationCommands: {
          targetPromptContractSelfTest: 'verify exact physics prompt contract',
          observationScorecard: 'score guarded physics observation',
          scorecard: 'rerun scorecard',
          actionQueueGate: 'rerun action queue gate',
          noProviderAcceptance: 'rerun no-provider acceptance'
        }
      }]
    }
  });
  assert(guardedObservationReady.status === 'ready_for_explicit_authorization', 'One locally ready guarded observation task may cross the low-yield gate only with fresh exact authorization.');
  assert(guardedObservationReady.recommendedAction?.actionType === 'submit_one_guarded_observation_task', 'Guarded observation gate must preserve the bounded backend-owned task action type.');

  const existingCandidateReady = classifyGate({
    throughputEfficiency: { status: 'acceptable_for_one_guarded_observation_only' },
    actionQueue: {
      items: [{
        priority: 1,
        role: 'primary_next_action',
        actionType: 'revalidate_existing_candidates_without_provider',
        executionReadiness: 'requires_fresh_explicit_authorization',
        target: {
          subject: 'physics', productionRunId: 2, candidateIds: [587], providerCallLimit: 0,
          exactContentSetSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          publicationPolicy: 'existing_automatic_gate_only_after_exact_explicit_authorization'
        },
        preAuthorizationChecks: ['rerun exact deterministic preview'],
        authorizationText: 'Authorize exact deterministic revalidation for candidate #587 with no Provider call.',
        operatorCommands: {
          plan: 'read-only owner plan',
          inspectCandidateContent: 'read-only exact candidate content inspection',
          preview: 'deterministic dry run',
          applyAfterAuthorization: 'apply --confirm-exact-owner-revalidation --expected-content-set-sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          verifyScorecard: 'verify scorecard',
          verifyProductionAudit: 'verify production audit'
        },
        postExecutionVerificationCommands: {
          scorecard: 'rerun scorecard',
          actionQueueGate: 'rerun action queue gate',
          noProviderAcceptance: 'rerun no-provider acceptance'
        }
      }]
    }
  });
  assert(existingCandidateReady.status === 'ready_for_explicit_authorization', 'Exact existing-candidate revalidation should pass only with a zero-Provider and automatic-gate-only contract.');
  assert(existingCandidateReady.recommendedAction?.target?.candidateIds?.[0] === 587, 'Existing-candidate gate must preserve the exact candidate whitelist.');

  const lowEfficiencyExistingCandidateReady = classifyGate({
    throughputEfficiency: { status: 'below_acceptable_efficiency' },
    actionQueue: existingCandidateReady.recommendedAction
      ? { items: [existingCandidateReady.recommendedAction] }
      : { items: [] }
  });
  assert(lowEfficiencyExistingCandidateReady.status === 'ready_for_explicit_authorization', 'Low historical efficiency must block new Provider spend but not exact zero-Provider candidate recovery.');
  assert(lowEfficiencyExistingCandidateReady.reason === 'existing_candidate_recovery_requires_no_provider_spend', 'Zero-Provider recovery should expose its explicit low-cost bypass reason.');

  const missingContentDigest = classifyGate({
    throughputEfficiency: { status: 'acceptable_for_one_guarded_observation_only' },
    actionQueue: {
      items: [{
        ...existingCandidateReady.recommendedAction,
        target: { ...existingCandidateReady.recommendedAction.target, exactContentSetSha256: null }
      }]
    }
  });
  assert(missingContentDigest.status === 'action_queue_ready_item_incomplete', 'Existing-candidate recovery must fail closed without an exact inspected content-set digest.');
  assert(missingContentDigest.missingFields.includes('target.exactContentSetSha256'), 'Missing content digest should expose target.exactContentSetSha256.');

  const mismatchedApplyDigest = classifyGate({
    throughputEfficiency: { status: 'acceptable_for_one_guarded_observation_only' },
    actionQueue: {
      items: [{
        ...existingCandidateReady.recommendedAction,
        operatorCommands: {
          ...existingCandidateReady.recommendedAction.operatorCommands,
          applyAfterAuthorization: 'apply --confirm-exact-owner-revalidation --expected-content-set-sha256=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        }
      }]
    }
  });
  assert(mismatchedApplyDigest.status === 'action_queue_ready_item_incomplete', 'Apply command must bind the exact inspected content-set digest from the authorization target.');
  assert(mismatchedApplyDigest.missingFields.includes('operatorCommands.applyAfterAuthorizationContentPrecondition'), 'Mismatched apply digest should expose the content-precondition command failure.');

  const duplicateCandidateWhitelist = classifyGate({
    throughputEfficiency: { status: 'acceptable_for_one_guarded_observation_only' },
    actionQueue: {
      items: [{
        ...existingCandidateReady.recommendedAction,
        target: { ...existingCandidateReady.recommendedAction.target, candidateIds: [587, 587] }
      }]
    }
  });
  assert(duplicateCandidateWhitelist.status === 'action_queue_ready_item_incomplete', 'Existing-candidate whitelist must reject duplicate ids instead of silently normalizing authorization scope.');
  assert(duplicateCandidateWhitelist.missingFields.includes('target.candidateIdsUnique'), 'Duplicate existing-candidate whitelist should expose target.candidateIdsUnique.');

  const mathRecovery = classifyGate({
    throughputEfficiency: { status: 'below_acceptable_efficiency' },
    actionQueue: {
      items: [
        {
          priority: 1,
          role: 'primary_next_action',
          actionType: 'read_only_math_recovery_diagnostics',
          executionReadiness: 'read_only_operator_diagnostics_ready',
          target: { productionRunId: 156, blockedReason: 'subject_auto_production_disabled' }
        }
      ]
    }
  });
  assert(mathRecovery.status === 'below_acceptable_efficiency', 'Read-only math recovery diagnostics must not authorize live or enqueue execution.');
  assert(mathRecovery.recommendedAction === null, 'Math recovery diagnostics must remain informational until throughput is acceptable.');

  const incomplete = classifyGate({
    throughputEfficiency: { status: 'acceptable' },
    actionQueue: {
      items: [
        {
          priority: 1,
          role: 'primary_next_action',
          actionType: 'live_existing_queued_job',
          executionReadiness: 'requires_fresh_explicit_authorization',
          target: { productionCellId: 610, jobId: 21292 }
        }
      ]
    }
  });
  assert(incomplete.status === 'action_queue_ready_item_incomplete', 'Ready action items missing command evidence must not pass the gate.');
  assert(incomplete.missingFields.includes('authorizationText'), 'Incomplete ready item should report missing authorization text.');

  const deferred = classifyGate({
    throughputEfficiency: { status: 'acceptable' },
    actionQueue: {
      items: [
        {
          priority: 1,
          role: 'primary_next_action',
          actionType: 'wait_or_switch_provider_before_live_existing_queued_job',
          executionReadiness: 'deferred_until_provider_recovery',
          target: { productionCellId: 610, jobId: 21292 }
        }
      ]
    }
  });
  assert(deferred.status === 'deferred_until_provider_recovery', 'Provider backoff should defer the gate instead of passing readiness.');

  const noAction = classifyGate({
    throughputEfficiency: { status: 'closed_or_no_open_work' },
    actionQueue: {
      items: [
        {
          priority: 1,
          role: 'primary_next_action',
          status: 'no_safe_next_action_ready',
          executionReadiness: 'no_authorized_action_ready',
          target: null
        }
      ]
    }
  });
  assert(noAction.status === 'no_authorized_action_ready', 'A queue without ready or deferred actions should report no authorized action.');

  const readOnlyProgression = classifyGate({
    throughputEfficiency: { status: 'acceptable_with_bounded_stage_evidence' },
    actionQueue: {
      items: [
        {
          priority: 1,
          role: 'primary_next_action',
          actionType: 'read_only_math_guarded_family_selection',
          executionReadiness: 'read_only_guarded_family_selection_ready',
          target: { subject: 'math', productionRunId: 1, validatedProductionCellId: 17 }
        }
      ]
    }
  });
  assert(readOnlyProgression.status === 'read_only_progression_ready', 'A passed bounded stage must route to read-only progression without authorizing execution.');

  const report = {
    mode: 'subject_practice_action_queue_gate_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    cases: [
      ready.status,
      below.status,
      incomplete.status,
      deferred.status,
      noAction.status,
      readOnlyProgression.status
    ]
  };
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else console.log('Subject-practice action queue gate self-test passed.');
}

function printText(report) {
  console.log(`Subject-practice action queue gate: ${report.status}`);
  console.log(`- providerImpact=${report.providerImpact}; dbImpact=${report.dbImpact}; productionImpact=${report.productionImpact}`);
  console.log(`- subject=${report.subject}; run=${report.productionRunId}; throughput=${report.throughputEfficiencyStatus}; queueItems=${report.actionQueueItemCount}`);
  if (report.recommendedAction) {
    const target = report.recommendedAction.target || {};
    console.log(`- recommended: ${report.recommendedAction.actionType}, cell #${target.productionCellId ?? 'n/a'}${target.jobId ? `, job #${target.jobId}` : ''}${target.blueprintId ? `, blueprint #${target.blueprintId}` : ''}`);
    if (report.recommendedAction.authorizationText) console.log(`- authorization: ${report.recommendedAction.authorizationText}`);
  } else {
    console.log(`- recommended: none (${report.reason})`);
  }
}

function main() {
  if (hasFlag('self-test')) {
    runSelfTest();
    return;
  }
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const requestedRun = runArgValue('run', 'latest');
  const sample = positiveInt('sample', 60);
  const days = positiveInt('days', 2);
  const baseUrl = cleanText(argValue('base-url', ''));
  const observationCell = Number(argValue('observation-cell', '')) || null;
  const nextAction = runNextAction({ subject, runId: requestedRun, sample, days, baseUrl, observationCell });
  const runId = Number(nextAction.productionRunId) || requestedRun;
  const gate = classifyGate(nextAction);
  const actionQueueItems = arrayFrom(nextAction.actionQueue?.items);
  const report = {
    mode: 'subject_practice_action_queue_gate',
    status: gate.status,
    subject,
    productionRunId: runId,
    productionImpact: 'none_read_only_action_queue_gate',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only',
    doesNotAuthorizeExecution: true,
    applyImpactNotExercised: 'requires_separate_fresh_explicit_authorization',
    reason: gate.reason,
    throughputEfficiencyStatus: nextAction.throughputEfficiency?.status ?? null,
    throughputEfficiency: nextAction.throughputEfficiency ?? null,
    providerBackoff: nextAction.providerBackoff ?? null,
    dispatchCapacity: nextAction.dispatchCapacity ?? null,
    actionQueueMode: nextAction.actionQueue?.mode ?? null,
    actionQueueOrderingPolicy: nextAction.actionQueue?.orderingPolicy ?? null,
    actionQueueItemCount: actionQueueItems.length,
    recommendedAction: gate.recommendedAction,
    recommendedPreAuthorizationChecks: gate.recommendedAction?.preAuthorizationChecks ?? [],
    recommendedPostExecutionVerificationCommands: gate.recommendedAction?.postExecutionVerificationCommands ?? null,
    actionQueue: nextAction.actionQueue ?? null
  };
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else printText(report);
  if (hasFlag('require-ready') && report.status !== 'ready_for_explicit_authorization') {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  if (!isDatabaseUnavailableError(error)) {
    console.error(error);
    process.exit(1);
  }
  const subject = cleanText(argValue('subject', 'chemistry')).toLowerCase();
  const runId = runArgValue('run', 'latest');
  const report = {
    mode: 'subject_practice_action_queue_gate',
    status: 'operational_wait_database_unavailable',
    subject,
    productionRunId: runId,
    productionImpact: 'none_read_only_action_queue_gate',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_failed_database_unavailable',
    doesNotAuthorizeExecution: true,
    applyImpactNotExercised: 'requires_separate_fresh_explicit_authorization',
    reason: 'database_unavailable',
    operationalWaitCodes: ['database_unavailable'],
    throughputEfficiencyStatus: 'unverified_database_unavailable',
    recommendedAction: null,
    actionQueue: null,
    error: {
      code: 'database_unavailable',
      message: compactErrorMessage(error)
    }
  };
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Subject-practice action queue gate: ${report.status}`);
    console.log(`- providerImpact=${report.providerImpact}; dbImpact=${report.dbImpact}; productionImpact=${report.productionImpact}`);
    console.log('- recommended: none (database_unavailable)');
  }
  if (hasFlag('require-ready')) process.exitCode = 1;
}
