#!/usr/bin/env node

const cp = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { validationProtocolForTarget } = require('./lib/subject-practice-validation-protocol.cjs');

loadEnv(path.resolve(__dirname, '..'));

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

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveInt(value, fallback = null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function roundUsd(value) {
  return Number(Number(value || 0).toFixed(9));
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function firstJsonObject(output) {
  const text = String(output ?? '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`No JSON object found: ${text.slice(0, 240)}`);
  return JSON.parse(text.slice(start));
}

function runNodeJson(script, args, label, options = {}) {
  try {
    const output = cp.execFileSync(process.execPath, [scriptPath(script), ...args, '--json'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, ...(options.env || {}) },
      encoding: 'utf8',
      maxBuffer: 80 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return firstJsonObject(output);
  } catch (error) {
    const stdout = String(error?.stdout || error?.output?.[1] || '');
    if (stdout.trim()) {
      const report = firstJsonObject(stdout);
      report.childExitStatus = Number(error?.status) || 1;
      return report;
    }
    throw new Error(`${label} failed: ${cleanText(error?.stderr || error?.message || error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactPlanFrom(preview) {
  const plan = preview?.questionPlanPreview?.questionPlan || {};
  const prompt = preview?.promptContractPreview || {};
  return {
    taskFamily: cleanText(plan.taskFamily || prompt.userPayloadQuestionPlanTaskFamily),
    planTemplate: cleanText(plan.planTemplate || prompt.userPayloadQuestionPlanTemplate),
    promptContractStatus: prompt.status ?? null,
    missingRequiredPhraseCount: Array.isArray(prompt.missingRequiredPhrases) ? prompt.missingRequiredPhrases.length : null,
    promptCharacters: Number(prompt.totalPromptCharacters) || null,
    promptCharacterBudget: Number(prompt.promptCharacterBudget) || null,
    executionCostPolicy: prompt.executionCostPolicy || null,
    maximumReservedCostUsd: positiveNumber(prompt.executionCostPolicy?.costReservation?.maximumReservedCostUsd)
  };
}

function scorecardSnapshot(report) {
  const observedTaskCount = Number(report?.funnels?.observedTaskCount || 0);
  const terminalTaskCount = Number(report?.funnels?.terminalTaskCount || 0);
  return {
    status: report?.status ?? null,
    continuationStatus: report?.continuation?.status ?? null,
    observedTaskCount,
    terminalTaskCount,
    activeTaskCount: Math.max(0, observedTaskCount - terminalTaskCount),
    providerAttemptedTaskCount: Number(report?.funnels?.providerAttemptedTaskCount || 0),
    effectiveProviderSampleCount: Number(report?.funnels?.effectiveProviderSampleCount ?? report?.funnels?.providerAttemptedTaskCount ?? 0),
    localPreProviderDiagnosticCount: Number(report?.funnels?.localPreProviderDiagnosticCount || 0),
    deliveredTaskCount: Number(report?.funnels?.deliveredTaskCount || 0),
    candidateCount: Number(report?.funnels?.candidateCount || 0),
    publishableGateCount: Number(report?.funnels?.publishableGateCount || 0),
    currentPolicyReplayStatus: report?.currentPolicyReplay?.status ?? null,
    currentPolicyOwnerEligibleCount: Number(report?.currentPolicyReplay?.currentOwnerEligibleCount || 0),
    currentPolicyStrictUniqueCount: Number(report?.currentPolicyReplay?.strictBatchUniqueCandidateCount || 0),
    currentPolicyStrictUsableYield: report?.currentPolicyReplay?.strictUsableYield ?? null,
    currentPolicyStrictUsableThresholdMet: report?.currentPolicyReplay?.strictUsableThresholdMet === true,
    totalEstimatedCostUsd: roundUsd(report?.cost?.totalEstimatedCostUsd),
    studentPublicationViolationCount: Number(report?.safety?.studentPublicationViolationCount || 0),
    studentPublicationSuppressionConfigurationViolationCount: Number(report?.safety?.studentPublicationSuppressionConfigurationViolationCount || 0),
    subjectActionProtocolViolationCount: Number(report?.safety?.subjectActionProtocolViolationCount || 0),
    providerAttemptLimitViolationCount: Number(report?.safety?.providerAttemptLimitViolationCount || 0),
    providerAttemptLimitPolicyViolationCount: Number(report?.safety?.providerAttemptLimitPolicyViolationCount || 0),
    missingProviderAttemptLimitCount: Number(report?.safety?.missingProviderAttemptLimitCount || 0),
    missingGuardedProviderCostAdmissionCount: Number(report?.safety?.missingGuardedProviderCostAdmissionCount || 0),
    guardedProviderCostAdmissionViolationCount: Number(report?.safety?.guardedProviderCostAdmissionViolationCount || 0),
    costCapViolationCount: Number(report?.cost?.costCapViolationCount || 0),
    legacyMissingCostCapCount: Number(report?.cost?.legacyMissingCostCapCount || 0),
    currentObservationProtocolSatisfied: report?.safety?.currentObservationProtocolSatisfied === true
  };
}

function batchDecision(input) {
  const providerCallsUsed = Math.max(0, input.current.effectiveProviderSampleCount - input.baseline.effectiveProviderSampleCount);
  const batchCostUsd = Math.max(0, roundUsd(input.current.totalEstimatedCostUsd - input.baseline.totalEstimatedCostUsd));
  const safetyViolationCount = input.current.studentPublicationViolationCount
    + input.current.studentPublicationSuppressionConfigurationViolationCount
    + input.current.subjectActionProtocolViolationCount
    + input.current.providerAttemptLimitViolationCount
    + input.current.providerAttemptLimitPolicyViolationCount
    + input.current.missingProviderAttemptLimitCount
    + input.current.missingGuardedProviderCostAdmissionCount
    + input.current.guardedProviderCostAdmissionViolationCount
    + input.current.costCapViolationCount
    + input.current.legacyMissingCostCapCount;
  const base = { providerCallsUsed, batchCostUsd, safetyViolationCount };
  if (safetyViolationCount > 0) return { ...base, status: 'stop_safety_violation', continueAllowed: false };
  if (batchCostUsd > input.maximumTotalCostUsd + Number.EPSILON) return { ...base, status: 'stop_total_cost_exceeded', continueAllowed: false };
  if (input.current.activeTaskCount > 0) return { ...base, status: 'wait_active_task', continueAllowed: false };
  if (providerCallsUsed >= input.maximumProviderCalls) {
    return {
      ...base,
      status: input.current.status === 'bounded_observation_passed'
        ? 'completed_bounded_observation_passed'
        : 'completed_provider_call_budget_exhausted',
      continueAllowed: false
    };
  }
  if (batchCostUsd + input.maximumPerCallCostUsd > input.maximumTotalCostUsd + Number.EPSILON) {
    return { ...base, status: 'stop_next_reservation_exceeds_total_cost', continueAllowed: false };
  }
  if (String(input.current.continuationStatus || '').startsWith('stop_')) {
    return { ...base, status: input.current.continuationStatus, continueAllowed: false };
  }
  return { ...base, status: 'eligible_for_next_serial_observation', continueAllowed: true };
}

function countedTerminalSampleDespiteChildExit(input) {
  if (!input.oneShot?.childExitStatus) return false;
  const effectiveSampleDelta = input.current.effectiveProviderSampleCount - input.before.effectiveProviderSampleCount;
  return effectiveSampleDelta === 1
    && input.current.activeTaskCount === 0
    && input.afterDecision.safetyViolationCount === 0;
}

function serialIterationIntegrity(input) {
  const observedTaskDelta = input.current.observedTaskCount - input.before.observedTaskCount;
  const effectiveProviderSampleDelta = input.current.effectiveProviderSampleCount - input.before.effectiveProviderSampleCount;
  const iterationCostUsd = roundUsd(input.current.totalEstimatedCostUsd - input.before.totalEstimatedCostUsd);
  const base = { observedTaskDelta, effectiveProviderSampleDelta, iterationCostUsd };
  if (observedTaskDelta !== 1) {
    return { ...base, status: 'stop_serial_observation_task_delta_invalid', satisfied: false };
  }
  if (effectiveProviderSampleDelta !== 1) {
    return { ...base, status: 'stop_serial_effective_provider_sample_delta_invalid', satisfied: false };
  }
  if (iterationCostUsd < 0) {
    return { ...base, status: 'stop_serial_iteration_cost_delta_negative', satisfied: false };
  }
  if (iterationCostUsd > input.maximumPerCallCostUsd + Number.EPSILON) {
    return { ...base, status: 'stop_serial_iteration_cost_cap_exceeded', satisfied: false };
  }
  return { ...base, status: 'serial_iteration_integrity_satisfied', satisfied: true };
}

function assertApplyAuthorization(config, exactPlan) {
  assert(hasFlag('apply'), 'Bounded family validation is preview-only unless --apply is present.');
  assert(hasFlag('confirm-bounded-math-family-validation'), 'Apply requires --confirm-bounded-math-family-validation.');
  assert(hasFlag('confirm-runtime-clean'), 'Apply requires --confirm-runtime-clean.');
  assert(hasFlag('confirm-provider-recovery'), 'Apply requires --confirm-provider-recovery.');
  assert(hasFlag('confirm-no-student-publication'), 'Apply requires --confirm-no-student-publication.');
  assert(Number(argValue('confirm-run', '')) === config.runId, `Apply requires --confirm-run=${config.runId}.`);
  assert(Number(argValue('confirm-cell', '')) === config.cellId, `Apply requires --confirm-cell=${config.cellId}.`);
  assert(cleanText(argValue('confirm-task-family', '')) === exactPlan.taskFamily, `Apply requires --confirm-task-family=${exactPlan.taskFamily}.`);
  assert(cleanText(argValue('confirm-validation-protocol-version', '')) === config.validationProtocolVersion, `Apply requires --confirm-validation-protocol-version=${config.validationProtocolVersion}.`);
  if (config.validationBatchId) {
    assert(cleanText(argValue('confirm-validation-batch-id', '')) === config.validationBatchId, `Apply requires --confirm-validation-batch-id=${config.validationBatchId}.`);
  }
  assert(Number(argValue('confirm-max-provider-calls', '')) === config.maximumProviderCalls, `Apply requires --confirm-max-provider-calls=${config.maximumProviderCalls}.`);
  assert(
    Number(argValue('confirm-max-total-estimated-cost-usd', '')) === config.maximumTotalCostUsd,
    `Apply requires --confirm-max-total-estimated-cost-usd=${config.maximumTotalCostUsd}.`
  );
  assert(
    Number(argValue('confirm-max-estimated-cost-usd-per-call', '')) === config.maximumPerCallCostUsd,
    `Apply requires --confirm-max-estimated-cost-usd-per-call=${config.maximumPerCallCostUsd}.`
  );
  if (config.localPreProviderDiagnosticCount > 0) {
    assert(
      Number(argValue('confirm-excluded-local-pre-provider-diagnostics', '')) === config.localPreProviderDiagnosticCount,
      `Apply requires --confirm-excluded-local-pre-provider-diagnostics=${config.localPreProviderDiagnosticCount}.`
    );
  }
  if (config.existingEffectiveProviderSampleCount > 0) {
    assert(
      Number(argValue('confirm-existing-effective-provider-samples', '')) === config.existingEffectiveProviderSampleCount,
      `Apply requires --confirm-existing-effective-provider-samples=${config.existingEffectiveProviderSampleCount}.`
    );
  }
}

function runSelfTest() {
  const baseline = scorecardSnapshot({
    status: 'insufficient_provider_samples',
    continuation: { status: 'eligible_for_one_more_guarded_observation' },
    funnels: { providerAttemptedTaskCount: 0, deliveredTaskCount: 0, candidateCount: 0, publishableGateCount: 0 },
    cost: { totalEstimatedCostUsd: 0, costCapViolationCount: 0 },
    safety: { studentPublicationViolationCount: 0, providerAttemptLimitViolationCount: 0 }
  });
  const fixture = (overrides = {}) => ({ ...baseline, ...overrides });
  const shared = {
    baseline,
    maximumProviderCalls: 3,
    maximumTotalCostUsd: 0.02,
    maximumPerCallCostUsd: 0.006,
    localPreProviderDiagnosticCount: 0
  };
  const cases = [
    [fixture(), 'eligible_for_next_serial_observation'],
    [fixture({ providerAttemptedTaskCount: 1, effectiveProviderSampleCount: 0, localPreProviderDiagnosticCount: 1 }), 'eligible_for_next_serial_observation'],
    [fixture({ providerAttemptedTaskCount: 2, effectiveProviderSampleCount: 2, totalEstimatedCostUsd: 0.01 }), 'eligible_for_next_serial_observation'],
    [fixture({ status: 'bounded_observation_passed', providerAttemptedTaskCount: 3, effectiveProviderSampleCount: 3, totalEstimatedCostUsd: 0.015 }), 'completed_bounded_observation_passed'],
    [fixture({ status: 'bounded_observation_failed', providerAttemptedTaskCount: 3, effectiveProviderSampleCount: 3, totalEstimatedCostUsd: 0.015 }), 'completed_provider_call_budget_exhausted'],
    [fixture({ providerAttemptedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.019 }), 'stop_next_reservation_exceeds_total_cost'],
    [fixture({ providerAttemptedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.021 }), 'stop_total_cost_exceeded'],
    [fixture({ observedTaskCount: 1, terminalTaskCount: 0, activeTaskCount: 1 }), 'wait_active_task'],
    [fixture({ studentPublicationViolationCount: 1 }), 'stop_safety_violation'],
    [fixture({ subjectActionProtocolViolationCount: 1 }), 'stop_safety_violation'],
    [fixture({ continuationStatus: 'stop_quality_threshold_not_met' }), 'stop_quality_threshold_not_met']
  ];
  const results = cases.map(([current, expected]) => {
    const actual = batchDecision({ ...shared, current });
    assert(actual.status === expected, `Expected ${expected}, got ${actual.status}.`);
    return { expected, status: 'passed' };
  });
  const countedOutcomeResults = [
    {
      expected: 'terminal_effective_quality_failure_is_counted',
      actual: countedTerminalSampleDespiteChildExit({
        oneShot: { childExitStatus: 1, status: 'completed_needs_attention' },
        before: fixture({ effectiveProviderSampleCount: 0 }),
        current: fixture({ effectiveProviderSampleCount: 1, observedTaskCount: 1, terminalTaskCount: 1, activeTaskCount: 0 }),
        afterDecision: { safetyViolationCount: 0 }
      }),
      value: true
    },
    {
      expected: 'non_effective_child_failure_still_stops',
      actual: countedTerminalSampleDespiteChildExit({
        oneShot: { childExitStatus: 1, status: 'completed_needs_attention' },
        before: fixture({ effectiveProviderSampleCount: 0 }),
        current: fixture({ effectiveProviderSampleCount: 0, observedTaskCount: 1, terminalTaskCount: 1, activeTaskCount: 0 }),
        afterDecision: { safetyViolationCount: 0 }
      }),
      value: false
    },
    {
      expected: 'safety_violation_still_stops',
      actual: countedTerminalSampleDespiteChildExit({
        oneShot: { childExitStatus: 1, status: 'completed_needs_attention' },
        before: fixture({ effectiveProviderSampleCount: 0 }),
        current: fixture({ effectiveProviderSampleCount: 1, observedTaskCount: 1, terminalTaskCount: 1, activeTaskCount: 0 }),
        afterDecision: { safetyViolationCount: 1 }
      }),
      value: false
    }
  ].map((testCase) => {
    assert(testCase.actual === testCase.value, `Unexpected counted terminal outcome for ${testCase.expected}.`);
    return { expected: testCase.expected, status: 'passed' };
  });
  const serialIntegrityCases = [
    {
      label: 'one_task_one_effective_sample_within_cost_cap',
      before: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      current: fixture({ observedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.00294 }),
      expected: 'serial_iteration_integrity_satisfied'
    },
    {
      label: 'missing_task_delta_rejected',
      before: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      current: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      expected: 'stop_serial_observation_task_delta_invalid'
    },
    {
      label: 'concurrent_task_delta_rejected',
      before: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      current: fixture({ observedTaskCount: 2, effectiveProviderSampleCount: 2, totalEstimatedCostUsd: 0.004 }),
      expected: 'stop_serial_observation_task_delta_invalid'
    },
    {
      label: 'local_only_failure_rejected_as_effective_sample',
      before: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      current: fixture({ observedTaskCount: 1, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      expected: 'stop_serial_effective_provider_sample_delta_invalid'
    },
    {
      label: 'multiple_provider_samples_in_one_iteration_rejected',
      before: fixture({ observedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.002 }),
      current: fixture({ observedTaskCount: 2, effectiveProviderSampleCount: 3, totalEstimatedCostUsd: 0.005 }),
      expected: 'stop_serial_effective_provider_sample_delta_invalid'
    },
    {
      label: 'negative_cost_delta_rejected',
      before: fixture({ observedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.003 }),
      current: fixture({ observedTaskCount: 2, effectiveProviderSampleCount: 2, totalEstimatedCostUsd: 0.002 }),
      expected: 'stop_serial_iteration_cost_delta_negative'
    },
    {
      label: 'per_call_cost_overrun_rejected',
      before: fixture({ observedTaskCount: 0, effectiveProviderSampleCount: 0, totalEstimatedCostUsd: 0 }),
      current: fixture({ observedTaskCount: 1, effectiveProviderSampleCount: 1, totalEstimatedCostUsd: 0.006000001 }),
      expected: 'stop_serial_iteration_cost_cap_exceeded'
    }
  ].map((testCase) => {
    const actual = serialIterationIntegrity({
      before: testCase.before,
      current: testCase.current,
      maximumPerCallCostUsd: 0.006
    });
    assert(actual.status === testCase.expected, `${testCase.label} expected ${testCase.expected}, got ${actual.status}.`);
    return { expected: testCase.label, status: 'passed' };
  });
  const originalArgv = process.argv;
  const authorizationConfig = {
    runId: 1,
    cellId: 16,
    validationProtocolVersion: 'math-elementary-direct-property-rotation-v3',
    maximumProviderCalls: 3,
    maximumTotalCostUsd: 0.02,
    maximumPerCallCostUsd: 0.006
  };
  const authorizationResults = [];
  try {
    process.argv = [
      'node', 'script', '--apply', '--confirm-bounded-math-family-validation',
      '--confirm-runtime-clean', '--confirm-provider-recovery', '--confirm-no-student-publication',
      '--confirm-run=1', '--confirm-cell=16',
      '--confirm-task-family=elementary_function_direct_property', '--confirm-max-provider-calls=3',
      '--confirm-validation-protocol-version=math-elementary-direct-property-rotation-v3',
      '--confirm-max-total-estimated-cost-usd=0.02'
    ];
    let message = '';
    try {
      assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert(message === 'Apply requires --confirm-max-estimated-cost-usd-per-call=0.006.', `Unexpected authorization failure: ${message}`);
    authorizationResults.push({ expected: 'missing_per_call_cost_confirmation_rejected', status: 'passed' });
    process.argv.push('--confirm-max-estimated-cost-usd-per-call=0.006');
    process.argv = process.argv.filter((arg) => !arg.startsWith('--confirm-validation-protocol-version='));
    let protocolMessage = '';
    try {
      assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    } catch (error) {
      protocolMessage = error instanceof Error ? error.message : String(error);
    }
    assert(protocolMessage === 'Apply requires --confirm-validation-protocol-version=math-elementary-direct-property-rotation-v3.', `Unexpected protocol authorization failure: ${protocolMessage}`);
    authorizationResults.push({ expected: 'missing_validation_protocol_confirmation_rejected', status: 'passed' });
    process.argv.push('--confirm-validation-protocol-version=math-elementary-direct-property-rotation-v3');
    assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    authorizationResults.push({ expected: 'complete_exact_authorization_accepted', status: 'passed' });
    authorizationConfig.localPreProviderDiagnosticCount = 1;
    let diagnosticMessage = '';
    try {
      assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    } catch (error) {
      diagnosticMessage = error instanceof Error ? error.message : String(error);
    }
    assert(
      diagnosticMessage === 'Apply requires --confirm-excluded-local-pre-provider-diagnostics=1.',
      `Unexpected local diagnostic authorization failure: ${diagnosticMessage}`
    );
    authorizationResults.push({ expected: 'missing_local_pre_provider_diagnostic_acknowledgement_rejected', status: 'passed' });
    process.argv.push('--confirm-excluded-local-pre-provider-diagnostics=1');
    authorizationConfig.existingEffectiveProviderSampleCount = 1;
    let existingSampleMessage = '';
    try {
      assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    } catch (error) {
      existingSampleMessage = error instanceof Error ? error.message : String(error);
    }
    assert(
      existingSampleMessage === 'Apply requires --confirm-existing-effective-provider-samples=1.',
      `Unexpected existing-sample authorization failure: ${existingSampleMessage}`
    );
    authorizationResults.push({ expected: 'missing_existing_effective_sample_acknowledgement_rejected', status: 'passed' });
    process.argv.push('--confirm-existing-effective-provider-samples=1');
    assertApplyAuthorization(authorizationConfig, { taskFamily: 'elementary_function_direct_property' });
    authorizationResults.push({ expected: 'exact_local_pre_provider_diagnostic_acknowledgement_accepted', status: 'passed' });
    authorizationResults.push({ expected: 'exact_existing_effective_sample_acknowledgement_accepted', status: 'passed' });
  } finally {
    process.argv = originalArgv;
  }
  return {
    mode: 'math_bounded_family_validation_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    networkImpact: 'none_no_http_request',
    caseCount: results.length + countedOutcomeResults.length + serialIntegrityCases.length + authorizationResults.length,
    results: [...results, ...countedOutcomeResults, ...serialIntegrityCases, ...authorizationResults]
  };
}

function loadExactPreview(config) {
  return runNodeJson('csca-subject-practice-exact-cell-enqueue.cjs', [
    '--subject=math',
    `--run=${config.runId}`,
    `--cell=${config.cellId}`,
    '--include-prompt-contract'
  ], 'exact-cell prompt preview');
}

function loadScorecard(config, exactPlan) {
  return runNodeJson('csca-subject-practice-observation-scorecard.cjs', [
    '--subject=math',
    `--run=${config.runId}`,
    `--cell=${config.cellId}`,
    `--task-family=${exactPlan.taskFamily}`,
    `--validation-protocol-version=${config.validationProtocolVersion}`,
    ...(config.validationBatchId ? [`--validation-batch-id=${config.validationBatchId}`] : []),
    '--current-protocol-cohort',
    `--minimum-provider-samples=${config.maximumProviderCalls}`,
    `--maximum-provider-samples=${config.maximumProviderCalls}`,
    '--minimum-delivery-yield=1',
    `--minimum-gate-yield=${2 / 3}`,
    `--minimum-question-plan-adherence-yield=${2 / 3}`,
    `--maximum-cumulative-cost-usd=${config.maximumTotalCostUsd}`,
    `--maximum-next-reserved-cost-usd=${config.maximumPerCallCostUsd}`,
    '--include-current-policy-replay'
  ], 'exact-family observation scorecard');
}

function main() {
  const json = hasFlag('json');
  if (hasFlag('self-test')) {
    const report = runSelfTest();
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Math bounded-family validation self-test passed.');
    return;
  }

  const config = {
    baseUrl: cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, ''),
    runId: positiveInt(argValue('run')),
    cellId: positiveInt(argValue('cell')),
    maximumProviderCalls: positiveInt(argValue('max-provider-calls', '3')),
    maximumTotalCostUsd: positiveNumber(argValue('max-total-estimated-cost-usd', '0.02')),
    maximumPerCallCostUsd: positiveNumber(argValue('max-estimated-cost-usd-per-call', '0.006')),
    validationBatchId: cleanText(argValue('validation-batch-id', '')) || null,
    timeoutMs: Math.max(60_000, Math.min(30 * 60_000, Number(argValue('timeout-ms', '900000')) || 900_000))
  };
  assert(config.runId, '--run is required.');
  assert(config.cellId, '--cell is required.');
  assert(config.maximumProviderCalls === 3, 'This validation protocol requires --max-provider-calls=3.');
  assert(config.maximumTotalCostUsd, '--max-total-estimated-cost-usd must be positive.');
  assert(config.maximumPerCallCostUsd, '--max-estimated-cost-usd-per-call must be positive.');
  assert(
    config.maximumPerCallCostUsd * config.maximumProviderCalls <= config.maximumTotalCostUsd + Number.EPSILON,
    'Three per-call caps must fit within --max-total-estimated-cost-usd.'
  );

  const exactPreview = loadExactPreview(config);
  const exactPlan = exactPlanFrom(exactPreview);
  assert(exactPlan.taskFamily, 'Exact-cell preview did not resolve a task family.');
  config.validationProtocolVersion = validationProtocolForTarget({
    subject: 'math', productionRunId: config.runId, productionCellId: config.cellId, taskFamily: exactPlan.taskFamily
  });
  assert(config.validationProtocolVersion, 'This bounded validator has no fixed validation protocol for the exact target.');
  assert(exactPlan.promptContractStatus === 'passed', `Exact-cell prompt contract must pass, got ${exactPlan.promptContractStatus}.`);
  assert(exactPlan.missingRequiredPhraseCount === 0, 'Exact-cell prompt contract has missing required phrases.');
  assert(exactPlan.maximumReservedCostUsd, 'Exact-cell cost reservation is unavailable.');
  assert(
    exactPlan.maximumReservedCostUsd <= config.maximumPerCallCostUsd + Number.EPSILON,
    `Reserved cost ${exactPlan.maximumReservedCostUsd} exceeds per-call cap ${config.maximumPerCallCostUsd}.`
  );

  const initialScorecardReport = loadScorecard(config, exactPlan);
  const baseline = scorecardSnapshot(initialScorecardReport);
  config.localPreProviderDiagnosticCount = baseline.localPreProviderDiagnosticCount;
  config.existingEffectiveProviderSampleCount = baseline.effectiveProviderSampleCount;
  const validationOrigin = {
    ...baseline,
    effectiveProviderSampleCount: 0,
    totalEstimatedCostUsd: 0
  };
  const initialDecision = batchDecision({
    baseline: validationOrigin,
    current: baseline,
    maximumProviderCalls: config.maximumProviderCalls,
    maximumTotalCostUsd: config.maximumTotalCostUsd,
    maximumPerCallCostUsd: config.maximumPerCallCostUsd
  });
  const authorizationFlags = [
    '--apply',
    '--confirm-bounded-math-family-validation',
    '--confirm-runtime-clean',
    '--confirm-provider-recovery',
    '--confirm-no-student-publication',
    `--confirm-run=${config.runId}`,
    `--confirm-cell=${config.cellId}`,
    `--confirm-task-family=${exactPlan.taskFamily}`,
    `--confirm-validation-protocol-version=${config.validationProtocolVersion}`,
    `--confirm-max-provider-calls=${config.maximumProviderCalls}`,
    `--confirm-max-total-estimated-cost-usd=${config.maximumTotalCostUsd}`,
    `--confirm-max-estimated-cost-usd-per-call=${config.maximumPerCallCostUsd}`
  ];
  if (config.validationBatchId) {
    authorizationFlags.push(`--confirm-validation-batch-id=${config.validationBatchId}`);
  }
  if (baseline.localPreProviderDiagnosticCount > 0) {
    authorizationFlags.push(`--confirm-excluded-local-pre-provider-diagnostics=${baseline.localPreProviderDiagnosticCount}`);
  }
  if (baseline.effectiveProviderSampleCount > 0) {
    authorizationFlags.push(`--confirm-existing-effective-provider-samples=${baseline.effectiveProviderSampleCount}`);
  }

  const preview = {
    mode: 'math_bounded_family_validation_preview',
    status: hasFlag('apply') ? 'apply_requested' : 'preview_only',
    productionImpact: hasFlag('apply') ? 'up_to_three_serial_backend_owned_observation_tasks' : 'none_preview_only',
    providerImpact: hasFlag('apply') ? 'up_to_three_provider_requests_with_one_attempt_per_task' : 'none_no_provider_call',
    dbImpact: hasFlag('apply') ? 'bounded_observation_task_job_candidate_and_gate_evidence' : 'read_only_exact_preview_and_scorecard',
    studentConsumableImpact: 'none_student_publication_suppressed',
    target: {
      subject: 'math',
      productionRunId: config.runId,
      productionCellId: config.cellId,
      taskFamily: exactPlan.taskFamily,
      validationProtocolVersion: config.validationProtocolVersion,
      validationBatchId: config.validationBatchId,
      planTemplate: exactPlan.planTemplate
    },
    limits: {
      maximumProviderCalls: config.maximumProviderCalls,
      maximumTotalEstimatedCostUsd: config.maximumTotalCostUsd,
      maximumEstimatedCostUsdPerCall: config.maximumPerCallCostUsd,
      exactPlanMaximumReservedCostUsd: exactPlan.maximumReservedCostUsd,
      executionShape: 'strictly_serial_one_terminal_task_before_next',
      minimumDeliveryYield: 1,
      minimumGateYield: 2 / 3,
      minimumQuestionPlanAdherenceYield: 2 / 3
    },
    exactPlan,
    baseline,
    baselineAdmission: {
      applyEligible: baseline.effectiveProviderSampleCount < config.maximumProviderCalls && baseline.activeTaskCount === 0,
      requirement: 'fewer_than_target_current_protocol_effective_provider_samples_and_no_active_task',
      existingEffectiveProviderSamplesRequireExactAcknowledgement: baseline.effectiveProviderSampleCount,
      excludedLocalPreProviderDiagnosticsRequireExactAcknowledgement: baseline.localPreProviderDiagnosticCount
    },
    initialDecision,
    authorizationRequiredForApply: authorizationFlags,
    stopConditions: [
      'three_new_effective_provider_samples_reached',
      'actual_batch_cost_exceeds_or_next_reservation_would_exceed_total_cap',
      'student_publication_provider_attempt_or_cost_cap_safety_violation',
      'active_task_remains_after_wait',
      'scorecard_continuation_returns_any_stop_status',
      'one_shot_child_returns_nonzero_without_one_new_terminal_effective_sample'
    ]
  };
  if (!hasFlag('apply')) {
    if (json) console.log(JSON.stringify(preview, null, 2));
    else console.log(`Preview: math run #${config.runId}, cell #${config.cellId}, family=${exactPlan.taskFamily}, calls<=${config.maximumProviderCalls}, totalCost<=${config.maximumTotalCostUsd} USD.`);
    return;
  }

  assertApplyAuthorization(config, exactPlan);
  assert(
    baseline.effectiveProviderSampleCount < config.maximumProviderCalls,
    `Apply requires fewer than ${config.maximumProviderCalls} existing current-protocol effective Provider samples for this exact family.`
  );
  const iterations = [];
  let current = baseline;
  let childFailure = null;
  let iterationIntegrityFailure = null;
  for (let index = baseline.effectiveProviderSampleCount + 1; index <= config.maximumProviderCalls; index += 1) {
    const before = current;
    const beforeDecision = batchDecision({
      baseline: validationOrigin,
      current,
      maximumProviderCalls: config.maximumProviderCalls,
      maximumTotalCostUsd: config.maximumTotalCostUsd,
      maximumPerCallCostUsd: config.maximumPerCallCostUsd
    });
    if (!beforeDecision.continueAllowed) break;
    const oneShot = runNodeJson('csca-subject-practice-math-one-shot-harness.cjs', [
      `--base-url=${config.baseUrl}`,
      `--run=${config.runId}`,
      `--cell=${config.cellId}`,
      `--timeout-ms=${config.timeoutMs}`,
      `--max-estimated-cost-usd=${config.maximumPerCallCostUsd}`,
      ...(config.validationBatchId ? [`--validation-batch-id=${config.validationBatchId}`] : []),
      '--apply',
      '--wait',
      '--confirm-one-math-observation-harness',
      '--confirm-runtime-clean',
      '--confirm-provider-recovery',
      '--confirm-no-student-publication',
      `--confirm-run=${config.runId}`,
      `--confirm-cell=${config.cellId}`,
      `--confirm-task-family=${exactPlan.taskFamily}`,
      `--confirm-validation-protocol-version=${config.validationProtocolVersion}`
    ], `serial observation ${index}`);
    const afterReport = loadScorecard(config, exactPlan);
    current = scorecardSnapshot(afterReport);
    const afterDecision = batchDecision({
      baseline: validationOrigin,
      current,
      maximumProviderCalls: config.maximumProviderCalls,
      maximumTotalCostUsd: config.maximumTotalCostUsd,
      maximumPerCallCostUsd: config.maximumPerCallCostUsd
    });
    const iterationIntegrity = serialIterationIntegrity({
      before,
      current,
      maximumPerCallCostUsd: config.maximumPerCallCostUsd
    });
    const countedTerminalOutcome = countedTerminalSampleDespiteChildExit({ oneShot, before, current, afterDecision });
    iterations.push({ index, oneShot, countedTerminalOutcome, iterationIntegrity, scorecard: current, decision: afterDecision });
    if (!iterationIntegrity.satisfied) {
      iterationIntegrityFailure = { index, ...iterationIntegrity };
      if (oneShot.childExitStatus) {
        childFailure = {
          index,
          childExitStatus: oneShot.childExitStatus,
          childStatus: oneShot.status ?? null,
          childMessage: oneShot.message ?? null
        };
      }
      break;
    }
    if (oneShot.childExitStatus && !countedTerminalOutcome) {
      childFailure = {
        index,
        childExitStatus: oneShot.childExitStatus,
        childStatus: oneShot.status ?? null,
        childMessage: oneShot.message ?? null
      };
      break;
    }
    if (!afterDecision.continueAllowed) break;
  }

  const calculatedFinalDecision = batchDecision({
    baseline: validationOrigin,
    current,
    maximumProviderCalls: config.maximumProviderCalls,
    maximumTotalCostUsd: config.maximumTotalCostUsd,
    maximumPerCallCostUsd: config.maximumPerCallCostUsd
  });
  const finalDecision = iterationIntegrityFailure ? {
    ...calculatedFinalDecision,
    status: iterationIntegrityFailure.status,
    continueAllowed: false,
    iterationIntegrityFailure,
    childFailure
  } : childFailure ? {
    ...calculatedFinalDecision,
    status: 'stop_one_shot_child_failed',
    continueAllowed: false,
    childFailure
  } : calculatedFinalDecision;
  const report = {
    ...preview,
    mode: 'math_bounded_family_validation',
    status: finalDecision.status,
    baseline,
    finalScorecard: current,
    finalDecision,
    childFailure,
    iterationIntegrityFailure,
    iterations,
    actualProviderCalls: finalDecision.providerCallsUsed,
    actualBatchCostUsd: finalDecision.batchCostUsd
  };
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(`Bounded validation ${report.status}: calls=${report.actualProviderCalls}, cost=${report.actualBatchCostUsd} USD.`);
  if (!['completed_bounded_observation_passed', 'completed_provider_call_budget_exhausted'].includes(report.status)) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: 'math_bounded_family_validation',
    message: error instanceof Error ? error.message : String(error),
    providerImpact: 'none_before_confirmed_apply_or_bounded_serial_backend_owned_after_apply',
    studentConsumableImpact: 'none_student_publication_suppressed'
  }, null, 2));
  process.exitCode = 1;
}
