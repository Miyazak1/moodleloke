const path = require('node:path');
const cp = require('node:child_process');
const { loadEnv } = require('./load-env.cjs');
const { validationProtocolForTarget } = require('./lib/subject-practice-validation-protocol.cjs');

loadEnv(path.resolve(__dirname, '..'));

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

function assertEstimatedCostCap(maximumReservedCostUsd, maxEstimatedCostUsd) {
  if (!Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd <= 0) {
    throw new Error('Apply requires a positive --max-estimated-cost-usd.');
  }
  if (!Number.isFinite(maximumReservedCostUsd) || maximumReservedCostUsd <= 0) {
    throw new Error('Apply refused because the guarded maximum cost reservation is unavailable.');
  }
  if (maximumReservedCostUsd > maxEstimatedCostUsd + Number.EPSILON) {
    throw new Error(`Apply refused because reserved maximum cost ${maximumReservedCostUsd.toFixed(8)} USD exceeds --max-estimated-cost-usd=${maxEstimatedCostUsd}.`);
  }
}

const baseUrl = argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const subject = String(argValue('subject', 'math')).trim().toLowerCase();
const OBSERVATION_ACTIONS = {
  math: 'math_scheduler_v2',
  physics: 'physics_scheduler_v2',
  chemistry: 'chemistry_scheduler_v2'
};

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function runLocalNodeJson(script, args, label) {
  const stdout = cp.execFileSync(process.execPath, [scriptPath(script), ...args, '--json'], {
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

async function requestJson(pathname, token, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${pathname} returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function resolveAdminToken() {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) return configured;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Admin token or ADMIN_BOOTSTRAP_EMAIL/PASSWORD is required.');
  const login = await requestJson('/api/v1/auth/login', '', { method: 'POST', body: { email, password } });
  const token = login.tokens?.accessToken;
  if (!token) throw new Error('Admin login did not return an access token.');
  return token;
}

async function waitForTask(taskId, token, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await requestJson(`/api/v1/admin/ai-questioning/subject-practice-observation-tasks/${taskId}`, token);
    if (['succeeded', 'failed', 'cancelled'].includes(response.task?.status)) return response;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timed out waiting for observation task ${taskId}.`);
}

async function assertApplyAdmission(token) {
  const status = await requestJson(`/api/v1/admin/ai-questioning/subject-practice-observation-tasks?subject=${encodeURIComponent(subject)}&limit=1`, token);
  const admitted = assertApplyAdmissionStatus(status, hasFlag('allow-shared-production-backend'));
  const runtimeProbe = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-runtime-probe', token, { method: 'POST', body: {} });
  assertBackendProviderNetworkProbe(runtimeProbe);
  return { ...admitted, runtimeProbe };
}

function assertBackendProviderNetworkProbe(runtimeProbe) {
  if (runtimeProbe?.status !== 'passed_backend_provider_network_reachable' || runtimeProbe?.reachable !== true) {
    throw new Error(`Apply refused because the observation backend cannot reach the Provider network: ${JSON.stringify(runtimeProbe)}.`);
  }
  if (runtimeProbe?.billingImpact !== 'none_no_tokens_or_provider_request') {
    throw new Error(`Apply refused because the observation runtime probe does not prove zero Provider billing impact: ${JSON.stringify(runtimeProbe)}.`);
  }
  return runtimeProbe;
}

function assertApplyAdmissionStatus(status, allowSharedProductionBackend = false) {
  const readiness = status.readiness || {};
  if (readiness.observationOnlyMode !== true && !allowSharedProductionBackend) {
    throw new Error(
      'Apply refused because backend readiness does not report observationOnlyMode=true. ' +
      'Start the validation backend with SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE=true, ' +
      'or pass --allow-shared-production-backend only when intentionally submitting to the shared production backend.'
    );
  }
  const readinessFailures = [];
  if (readiness.readyForSubmission !== true) readinessFailures.push('readyForSubmission=false');
  if (readiness.readyForExecution !== true) readinessFailures.push('readyForExecution=false');
  if (readinessFailures.length) {
    throw new Error(`Apply refused because observation backend is not ready: ${readinessFailures.join(',')}; reasons=${JSON.stringify(readiness.reasons || [])}.`);
  }
  return status;
}

function admissionEvidence(status, override = false) {
  const readiness = status?.readiness || {};
  return {
    observationOnlyMode: readiness.observationOnlyMode === true,
    sharedProductionBackendOverride: override === true,
    readyForSubmission: readiness.readyForSubmission === true,
    readyForExecution: readiness.readyForExecution === true,
    runtimeProbeStatus: status?.runtimeProbe?.status ?? null,
    backendProviderNetworkReachable: status?.runtimeProbe?.reachable === true,
    runtimeProbeBillingImpact: status?.runtimeProbe?.billingImpact ?? null
  };
}

function assertExactApplyScope({ productionRunId, productionCellId, confirmedRunId, confirmedCellId }) {
  if (!Number.isInteger(productionRunId) || productionRunId <= 0) {
    throw new Error('Apply requires a positive --run value.');
  }
  if (!Number.isInteger(productionCellId) || productionCellId <= 0) {
    throw new Error('Apply requires an exact positive --cell value.');
  }
  if (confirmedRunId !== productionRunId) {
    throw new Error(`Apply requires --confirm-run=${productionRunId}.`);
  }
  if (confirmedCellId !== productionCellId) {
    throw new Error(`Apply requires --confirm-cell=${productionCellId}.`);
  }
}

function assertProviderRecoveryConfirmed() {
  if (!hasFlag('confirm-provider-recovery')
    && process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY !== '1'
    && !(subject === 'math' && process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY === '1')) {
    throw new Error('Apply requires --confirm-provider-recovery after reviewing current Provider recovery state and, when recovering a hard-stop, a successful recovery probe.');
  }
}

function assertExactTaskFamilyConfirmation(taskFamily, confirmedTaskFamily) {
  const resolvedTaskFamily = cleanText(taskFamily);
  if (!resolvedTaskFamily) {
    throw new Error('Apply requires the exact-cell prompt contract to resolve a task family.');
  }
  if (cleanText(confirmedTaskFamily) !== resolvedTaskFamily) {
    throw new Error(`Apply requires --confirm-task-family=${resolvedTaskFamily}.`);
  }
}

function assertValidationProtocolConfirmation(validationProtocolVersion, confirmedValidationProtocolVersion) {
  if (!validationProtocolVersion) return;
  if (cleanText(confirmedValidationProtocolVersion) !== validationProtocolVersion) {
    throw new Error(`Apply requires --confirm-validation-protocol-version=${validationProtocolVersion}.`);
  }
}

function providerReadinessEvidenceFor(state) {
  const failures = [];
  if (state?.mode !== 'ai_gateway_provider_recovery_state') failures.push('provider_recovery_state_mode_invalid');
  if (state?.providerImpact !== 'none_no_provider_call') failures.push('provider_recovery_state_must_be_read_only');
  if (state?.status !== 'provider_hard_stop_clear' || state?.hardStop?.active === true) failures.push('provider_hard_stop_not_clear');
  if (Number(state?.keyPoolSummary?.enabledKeyCount) < 1) failures.push('no_enabled_question_generation_key');
  if (failures.length) {
    throw new Error(`Apply refused by current read-only Provider readiness evidence: ${failures.join(',')}.`);
  }
  return {
    status: 'passed',
    source: 'ai_gateway_provider_recovery_state_read_only',
    providerImpact: state.providerImpact,
    dbImpact: state.dbImpact ?? null,
    provider: state.providerConfig?.provider ?? null,
    model: state.providerConfig?.model ?? null,
    enabledKeyCount: Number(state.keyPoolSummary?.enabledKeyCount),
    hardStopActive: false,
    latestHardStopAt: state.hardStop?.latestHardStopAt ?? null,
    latestRecoverySuccessAt: state.hardStop?.latestRecoverySuccessAt ?? null,
    recoveredAfterHardStop: state.hardStop?.recoveredAfterHardStop === true
  };
}

function assertProviderReadinessEvidence() {
  return providerReadinessEvidenceFor(runLocalNodeJson(
    'csca-ai-gateway-provider-recovery-state.cjs',
    [],
    'read-only Provider recovery state'
  ));
}

function assertTargetPromptContractReady({ subject, productionRunId, productionCellId }) {
  const preview = runLocalNodeJson('csca-subject-practice-exact-cell-enqueue.cjs', [
    `--subject=${subject}`,
    `--run=${productionRunId}`,
    `--cell=${productionCellId}`,
    '--include-prompt-contract'
  ], 'target exact-cell prompt-contract preview');
  const promptContractPreview = preview.promptContractPreview || {};
  const questionPlanPreview = preview.questionPlanPreview || {};
  const exactObservationGate = questionPlanPreview.exactObservationGate || {};
  const exactObservationAttempt = questionPlanPreview.exactObservationAttempt || {};
  if (preview.providerImpact !== 'none_no_provider_call') {
    throw new Error(`Target prompt-contract precheck must not call provider, got ${preview.providerImpact}.`);
  }
  if (preview.productionImpact !== 'none_preview_only') {
    throw new Error(`Target prompt-contract precheck must stay preview-only, got ${preview.productionImpact}.`);
  }
  if (preview.dbImpact !== 'read_only_preview') {
    throw new Error(`Target prompt-contract precheck must stay read-only, got ${preview.dbImpact}.`);
  }
  if (exactObservationGate.generationAllowed !== true || exactObservationAttempt.status !== 'plan_ready') {
    throw new Error(`Target exact-cell QuestionPlan must be plan_ready before observation apply, got gate=${exactObservationGate.generationAllowed} attempt=${exactObservationAttempt.status}.`);
  }
  if (promptContractPreview.status !== 'passed' || promptContractPreview.userPayloadHasQuestionPlan !== true || (promptContractPreview.missingRequiredPhrases || []).length > 0) {
    throw new Error(`Target exact-cell prompt contract must pass before observation apply: ${JSON.stringify({
      status: promptContractPreview.status,
      userPayloadHasQuestionPlan: promptContractPreview.userPayloadHasQuestionPlan,
      missingRequiredPhrases: promptContractPreview.missingRequiredPhrases || []
    })}`);
  }
  const executionCostPolicy = promptContractPreview.executionCostPolicy || {};
  const basicDirectCompactPolicy = questionPlanPreview.questionPlan?.taskFamily === 'elementary_function_direct_property';
  const policyMatches = basicDirectCompactPolicy
    ? executionCostPolicy.status === 'guarded_compact_non_thinking_policy_active'
      && executionCostPolicy.thinkingMode === 'disabled'
      && executionCostPolicy.reasoningEffort === 'provider_default'
      && executionCostPolicy.temperaturePolicy === 'explicit'
      && executionCostPolicy.reasoningPolicyVersion === 'question-generation-reasoning-effort-v3'
      && Number(executionCostPolicy.outputTokenCeiling) === 3000
    : executionCostPolicy.status === 'guarded_low_reasoning_policy_active'
      && executionCostPolicy.thinkingMode === 'enabled'
      && executionCostPolicy.reasoningEffort === 'low'
      && executionCostPolicy.temperaturePolicy === 'omitted_for_thinking_mode'
      && executionCostPolicy.reasoningPolicyVersion === 'question-generation-reasoning-effort-v2'
      && Number(executionCostPolicy.outputTokenCeiling) === 8000;
  if (executionCostPolicy.model !== 'deepseek-v4-flash' || !policyMatches) {
    throw new Error(`Target exact-cell guarded execution cost policy must pass before observation apply: ${JSON.stringify(executionCostPolicy)}`);
  }
  const costReservation = executionCostPolicy.costReservation || {};
  if (costReservation.policyVersion !== 'guarded-observation-cost-reservation-v1'
    || !Number.isFinite(Number(costReservation.maximumReservedCostUsd))
    || Number(costReservation.maximumReservedCostUsd) <= 0) {
    throw new Error(`Target exact-cell guarded cost reservation is unavailable: ${JSON.stringify(costReservation)}`);
  }
  return {
    status: 'passed',
    productionImpact: preview.productionImpact,
    providerImpact: preview.providerImpact,
    dbImpact: preview.dbImpact,
    selectedCellId: preview.selection?.selectedCellId ?? null,
    selectedBlueprintId: preview.selection?.selectedBlueprintId ?? null,
    questionPlanTemplate: questionPlanPreview.questionPlan?.planTemplate ?? null,
    questionPlanTaskFamily: questionPlanPreview.questionPlan?.taskFamily ?? null,
    promptContractStatus: promptContractPreview.status ?? null,
    promptContractMissingRequiredPhraseCount: (promptContractPreview.missingRequiredPhrases || []).length,
    executionCostPolicy,
    costReservation
  };
}

function expectScopeFailure(label, scope, expectedMessage) {
  try {
    assertExactApplyScope(scope);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== expectedMessage) {
      throw new Error(`${label} failed with unexpected message: ${message}`);
    }
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectProviderRecoveryFailure() {
  const original = process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  const originalGeneric = process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  delete process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  delete process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  try {
    assertProviderRecoveryConfirmed();
  } catch (error) {
    if (original === undefined) delete process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
    else process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY = original;
    if (originalGeneric === undefined) delete process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
    else process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY = originalGeneric;
    const message = error instanceof Error ? error.message : String(error);
    if (message !== 'Apply requires --confirm-provider-recovery after reviewing current Provider recovery state and, when recovering a hard-stop, a successful recovery probe.') {
      throw new Error(`provider_recovery_missing failed with unexpected message: ${message}`);
    }
    return { label: 'provider_recovery_missing', status: 'passed', message };
  }
  if (original === undefined) delete process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  else process.env.CSCA_MATH_OBSERVATION_CONFIRM_PROVIDER_RECOVERY = original;
  if (originalGeneric === undefined) delete process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY;
  else process.env.CSCA_SUBJECT_PRACTICE_OBSERVATION_CONFIRM_PROVIDER_RECOVERY = originalGeneric;
  throw new Error('provider_recovery_missing unexpectedly passed.');
}

function expectTaskFamilyFailure(label, taskFamily, confirmedTaskFamily, expectedMessage) {
  try {
    assertExactTaskFamilyConfirmation(taskFamily, confirmedTaskFamily);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== expectedMessage) {
      throw new Error(`${label} failed with unexpected message: ${message}`);
    }
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectValidationProtocolFailure(label, validationProtocolVersion, confirmedValidationProtocolVersion, expectedMessage) {
  try {
    assertValidationProtocolConfirmation(validationProtocolVersion, confirmedValidationProtocolVersion);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== expectedMessage) throw new Error(`${label} failed with unexpected message: ${message}`);
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectCostCapFailure(label, maximumReservedCostUsd, maxEstimatedCostUsd, expectedFragment) {
  try {
    assertEstimatedCostCap(maximumReservedCostUsd, maxEstimatedCostUsd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedFragment)) throw new Error(`${label} failed with unexpected message: ${message}`);
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectProviderReadinessFailure(label, state, expectedFragment) {
  try {
    providerReadinessEvidenceFor(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedFragment)) throw new Error(`${label} failed with unexpected message: ${message}`);
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectBackendAdmissionFailure(label, status, expectedFragment) {
  try {
    assertApplyAdmissionStatus(status, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedFragment)) throw new Error(`${label} failed with unexpected message: ${message}`);
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function expectBackendNetworkProbeFailure(label, runtimeProbe, expectedFragment) {
  try {
    assertBackendProviderNetworkProbe(runtimeProbe);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedFragment)) throw new Error(`${label} failed with unexpected message: ${message}`);
    return { label, status: 'passed', message };
  }
  throw new Error(`${label} unexpectedly passed.`);
}

function runApplyScopeSelfTest() {
  const failures = [
    expectScopeFailure('missing_run', {
      productionRunId: 0,
      productionCellId: 350,
      confirmedRunId: 0,
      confirmedCellId: 350
    }, 'Apply requires a positive --run value.'),
    expectScopeFailure('missing_cell', {
      productionRunId: 156,
      productionCellId: undefined,
      confirmedRunId: 156,
      confirmedCellId: 0
    }, 'Apply requires an exact positive --cell value.'),
    expectScopeFailure('run_mismatch', {
      productionRunId: 156,
      productionCellId: 350,
      confirmedRunId: 155,
      confirmedCellId: 350
    }, 'Apply requires --confirm-run=156.'),
    expectScopeFailure('cell_mismatch', {
      productionRunId: 156,
      productionCellId: 350,
      confirmedRunId: 156,
      confirmedCellId: 351
    }, 'Apply requires --confirm-cell=350.'),
    expectTaskFamilyFailure(
      'missing_task_family_confirmation',
      'elementary_function_direct_property',
      '',
      'Apply requires --confirm-task-family=elementary_function_direct_property.'
    ),
    expectValidationProtocolFailure(
      'validation_protocol_mismatch',
      'math-elementary-direct-property-rotation-v3',
      'math-elementary-direct-property-compact-v3',
      'Apply requires --confirm-validation-protocol-version=math-elementary-direct-property-rotation-v3.'
    ),
    expectTaskFamilyFailure(
      'task_family_mismatch',
      'elementary_function_direct_property',
      'elementary_function_exp_log_ordering',
      'Apply requires --confirm-task-family=elementary_function_direct_property.'
    ),
    expectProviderRecoveryFailure(),
    expectProviderReadinessFailure('provider_hard_stop_active', {
      mode: 'ai_gateway_provider_recovery_state', providerImpact: 'none_no_provider_call',
      status: 'provider_hard_stop_active', hardStop: { active: true }, keyPoolSummary: { enabledKeyCount: 1 }
    }, 'provider_hard_stop_not_clear'),
    expectProviderReadinessFailure('provider_key_missing', {
      mode: 'ai_gateway_provider_recovery_state', providerImpact: 'none_no_provider_call',
      status: 'provider_hard_stop_clear', hardStop: { active: false }, keyPoolSummary: { enabledKeyCount: 0 }
    }, 'no_enabled_question_generation_key'),
    expectBackendAdmissionFailure('backend_submission_not_ready', {
      readiness: { observationOnlyMode: true, readyForSubmission: false, readyForExecution: true, reasons: ['background_capacity_below_two'] }
    }, 'readyForSubmission=false'),
    expectBackendAdmissionFailure('backend_execution_not_ready', {
      readiness: { observationOnlyMode: true, readyForSubmission: true, readyForExecution: false, reasons: ['single_backend_not_confirmed'] }
    }, 'readyForExecution=false'),
    expectBackendNetworkProbeFailure(
      'backend_provider_network_unreachable',
      {
        status: 'blocked_backend_provider_network_unreachable',
        reachable: false,
        billingImpact: 'none_no_tokens_or_provider_request',
        errorCode: 'EACCES'
      },
      'observation backend cannot reach the Provider network'
    ),
    expectBackendNetworkProbeFailure(
      'backend_probe_billing_boundary_missing',
      { status: 'passed_backend_provider_network_reachable', reachable: true },
      'does not prove zero Provider billing impact'
    ),
    expectCostCapFailure('missing_cost_cap', 0.004, 0, 'positive --max-estimated-cost-usd'),
    expectCostCapFailure('cost_cap_below_reservation', 0.004, 0.003, 'exceeds --max-estimated-cost-usd')
  ];
  assertExactApplyScope({
    productionRunId: 156,
    productionCellId: 350,
    confirmedRunId: 156,
    confirmedCellId: 350
  });
  assertExactTaskFamilyConfirmation('elementary_function_direct_property', 'elementary_function_direct_property');
  assertEstimatedCostCap(0.004, 0.01);
  const providerReadinessPass = providerReadinessEvidenceFor({
    mode: 'ai_gateway_provider_recovery_state',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_ai_gateway_call_logs',
    status: 'provider_hard_stop_clear',
    hardStop: { active: false, recoveredAfterHardStop: true },
    keyPoolSummary: { enabledKeyCount: 1 },
    providerConfig: { provider: 'deepseek', model: 'deepseek-v4-flash' }
  });
  const backendAdmissionPass = assertApplyAdmissionStatus({
    readiness: { observationOnlyMode: true, readyForSubmission: true, readyForExecution: true, reasons: [] }
  }, false);
  const backendProviderNetworkProbePass = assertBackendProviderNetworkProbe({
    status: 'passed_backend_provider_network_reachable',
    reachable: true,
    billingImpact: 'none_no_tokens_or_provider_request'
  });
  return {
    mode: 'math_observation_apply_scope_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    networkImpact: 'none_no_http_request',
    failureCaseCount: failures.length,
    providerRecoveryConfirmationRequired: true,
    estimatedCostCapRequired: true,
    providerReadinessEvidenceRequired: true,
    providerReadinessPass,
    backendAdmissionReady: backendAdmissionPass.readiness.readyForExecution === true,
    backendProviderNetworkProbeReady: backendProviderNetworkProbePass.reachable === true,
    passCase: {
      productionRunId: 156,
      productionCellId: 350,
      taskFamily: 'elementary_function_direct_property'
    },
    failures
  };
}

async function main() {
  const apply = hasFlag('apply');
  const wait = hasFlag('wait');
  const json = hasFlag('json');
  const taskId = argValue('task');
  if (!OBSERVATION_ACTIONS[subject]) throw new Error('--subject must be math, physics, or chemistry.');
  const productionRunId = Number(argValue('run', ''));
  const productionCellId = Number(argValue('cell', '')) || undefined;
  const maxEstimatedCostUsd = Number(argValue('max-estimated-cost-usd', ''));
  const validationBatchId = cleanText(argValue('validation-batch-id', '')) || null;
  const timeoutMs = Math.max(60_000, Math.min(30 * 60_000, Number(argValue('timeout-ms', '900000')) || 900_000));
  if (hasFlag('self-test-apply-scope')) {
    const report = runApplyScopeSelfTest();
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Math observation apply-scope self-test passed.');
    return;
  }
  if (hasFlag('self-test-target-prompt-contract')) {
    if (!Number.isInteger(productionRunId) || productionRunId <= 0) throw new Error('Target prompt-contract self-test requires a positive --run value.');
    if (!Number.isInteger(productionCellId) || productionCellId <= 0) throw new Error('Target prompt-contract self-test requires a positive --cell value.');
    const promptContractAdmission = assertTargetPromptContractReady({ subject, productionRunId, productionCellId });
    const report = {
      mode: 'subject_practice_observation_target_prompt_contract_self_test',
      status: 'passed',
      productionImpact: 'none_preview_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only_exact_cell_preview',
      networkImpact: 'none_no_http_request',
      target: {
        subject,
        productionRunId,
        productionCellId
      },
      promptContractAdmission
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(`${subject} observation target prompt-contract self-test passed for run #${productionRunId}, cell #${productionCellId}.`);
    return;
  }
  let report;
  if (taskId) {
    const token = await resolveAdminToken();
    report = wait
      ? await waitForTask(taskId, token, timeoutMs)
      : await requestJson(`/api/v1/admin/ai-questioning/subject-practice-observation-tasks/${taskId}`, token);
  } else if (apply) {
    const legacyMathConfirmation = subject === 'math' && hasFlag('confirm-math-diversity-observation-run');
    if (!hasFlag('confirm-subject-practice-guarded-observation-run') && !legacyMathConfirmation) {
      throw new Error('Apply requires --confirm-subject-practice-guarded-observation-run (legacy math alias: --confirm-math-diversity-observation-run).');
    }
    const confirmedRunId = Number(argValue('confirm-run', ''));
    const confirmedCellId = Number(argValue('confirm-cell', ''));
    const confirmedTaskFamily = cleanText(argValue('confirm-task-family', ''));
    assertExactApplyScope({ productionRunId, productionCellId, confirmedRunId, confirmedCellId });
    assertProviderRecoveryConfirmed();
    const providerReadinessEvidence = assertProviderReadinessEvidence();
    const promptContractAdmission = assertTargetPromptContractReady({ subject, productionRunId, productionCellId });
    assertExactTaskFamilyConfirmation(promptContractAdmission.questionPlanTaskFamily, confirmedTaskFamily);
    const validationProtocolVersion = validationProtocolForTarget({
      subject,
      productionRunId,
      productionCellId,
      taskFamily: promptContractAdmission.questionPlanTaskFamily
    });
    assertValidationProtocolConfirmation(validationProtocolVersion, argValue('confirm-validation-protocol-version', ''));
    if (providerReadinessEvidence.model !== promptContractAdmission.executionCostPolicy?.model) {
      throw new Error(`Apply refused because Provider readiness model ${providerReadinessEvidence.model ?? 'unknown'} does not match guarded execution model ${promptContractAdmission.executionCostPolicy?.model ?? 'unknown'}.`);
    }
    assertEstimatedCostCap(
      Number(promptContractAdmission.costReservation?.maximumReservedCostUsd),
      maxEstimatedCostUsd
    );
    const token = await resolveAdminToken();
    const admission = await assertApplyAdmission(token);
    report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token, {
      method: 'POST',
      body: {
        action: OBSERVATION_ACTIONS[subject],
        subject,
        productionRunId,
        ...(productionCellId ? { productionCellId } : {}),
        ...(promptContractAdmission.questionPlanTaskFamily
          ? { taskFamily: promptContractAdmission.questionPlanTaskFamily }
          : {}),
        maxEstimatedCostUsd,
        maximumReservedCostUsd: Number(promptContractAdmission.costReservation.maximumReservedCostUsd),
        costReservationPolicyVersion: promptContractAdmission.costReservation.policyVersion,
        ...(validationProtocolVersion ? { validationProtocolVersion } : {}),
        ...(validationBatchId ? { validationBatchId } : {}),
        suppressStudentPublication: true
      }
    });
    const admissionReport = admissionEvidence(admission, hasFlag('allow-shared-production-backend'));
    report = {
      ...report,
      admission: admissionReport,
      promptContractAdmission,
      providerReadinessEvidence
    };
    if (wait && report.task?.id) {
      report = {
        ...(await waitForTask(report.task.id, token, timeoutMs)),
        admission: admissionReport,
        promptContractAdmission,
        providerReadinessEvidence
      };
    }
  } else {
    const token = await resolveAdminToken();
    const status = await requestJson(`/api/v1/admin/ai-questioning/subject-practice-observation-tasks?subject=${encodeURIComponent(subject)}&limit=5`, token);
    const promptContractAdmission = Number.isInteger(productionRunId) && productionRunId > 0 && Number.isInteger(productionCellId)
      ? assertTargetPromptContractReady({ subject, productionRunId, productionCellId })
      : null;
    const historicalItems = Array.isArray(status.items) ? status.items : [];
      const requestedTargetItems = historicalItems.filter((item) => (
      Number(item.productionRunId) === productionRunId
      && (productionCellId === undefined || Number(item.productionCellId) === productionCellId)
    ));
    report = {
      mode: 'submit-preview',
      standaloneProviderExecution: false,
      studentPublicationPolicy: 'observation_gate_evidence_only_no_student_publication',
      requested: {
        action: OBSERVATION_ACTIONS[subject],
        subject,
        productionRunId,
        productionCellId: productionCellId ?? null,
        suppressStudentPublication: true
      },
      admission: admissionEvidence(status, false),
      ...status,
      requestedTargetExistingTaskCount: requestedTargetItems.length,
      requestedTargetExistingTasks: requestedTargetItems,
      historicalTaskCount: historicalItems.length,
      promptContractAdmission,
      validationProtocolVersion: promptContractAdmission ? validationProtocolForTarget({
        subject,
        productionRunId,
        productionCellId,
        taskFamily: promptContractAdmission.questionPlanTaskFamily
      }) : null,
      requestedMaxEstimatedCostUsd: Number.isFinite(maxEstimatedCostUsd) && maxEstimatedCostUsd > 0 ? maxEstimatedCostUsd : null,
      authorizationRequiredForApply: promptContractAdmission ? [
        `--confirm-run=${productionRunId}`,
        `--confirm-cell=${productionCellId}`,
        `--confirm-task-family=${promptContractAdmission.questionPlanTaskFamily || 'EXACT_TASK_FAMILY'}`,
        ...(validationProtocolForTarget({ subject, productionRunId, productionCellId, taskFamily: promptContractAdmission.questionPlanTaskFamily })
          ? [`--confirm-validation-protocol-version=${validationProtocolForTarget({ subject, productionRunId, productionCellId, taskFamily: promptContractAdmission.questionPlanTaskFamily })}`]
          : []),
        '--max-estimated-cost-usd=EXPLICIT_CAP'
      ] : []
    };
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Backend-owned ${subject} observation: ${report.task?.status || report.mode || 'status'}`);
    console.log(`- task=${report.task?.id || 'not-submitted'} run=#${report.task?.productionRunId || productionRunId}`);
    console.log(`- backend=${baseUrl} standaloneProviderExecution=false`);
    if (report.admission) console.log(`- observationOnlyMode=${report.admission.observationOnlyMode} sharedProductionBackendOverride=${report.admission.sharedProductionBackendOverride}`);
    console.log(`- studentPublicationPolicy=${report.studentPublicationPolicy || report.task?.filterSnapshot?.publicationPolicy || 'observation_gate_evidence_only_no_student_publication'}`);
    if (report.task?.result) console.log(`- result=${JSON.stringify(report.task.result)}`);
    if (!apply && !taskId) console.log(`Preview only. Add --apply --confirm-subject-practice-guarded-observation-run --confirm-provider-recovery --max-estimated-cost-usd=EXPLICIT_CAP --confirm-run=${productionRunId} --confirm-cell=${productionCellId ?? 'EXACT_CELL_ID'} --confirm-task-family=${report.promptContractAdmission?.questionPlanTaskFamily || 'EXACT_TASK_FAMILY'} after starting an observation-only backend and passing provider recovery; the CLI never calls a provider directly and submits suppressStudentPublication=true.`);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error), standaloneProviderExecution: false }, null, 2));
  process.exitCode = 1;
});
