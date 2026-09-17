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

function asPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function firstJsonObject(output) {
  const text = String(output ?? '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`No JSON object found in output: ${text.slice(0, 240)}`);
  return JSON.parse(text.slice(start));
}

async function requestObservationBackendJson(baseUrl, pathname, token, options = {}) {
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
    body = { raw: text.slice(0, 240) };
  }
  if (!response.ok) {
    const error = new Error(`${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
    error.statusCode = response.status;
    throw error;
  }
  return body;
}

async function resolveSharedObservationAdminToken(baseUrl, options = {}) {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) {
    return {
      status: 'available',
      source: process.env.CSCA_OBSERVATION_ADMIN_TOKEN ? 'CSCA_OBSERVATION_ADMIN_TOKEN' : 'CSCA_READINESS_EVIDENCE_TOKEN',
      env: { CSCA_OBSERVATION_ADMIN_TOKEN: configured }
    };
  }
  if (!options.allowLogin) {
    return {
      status: 'skipped_preview_no_configured_token',
      source: 'preview_does_not_login_with_admin_password',
      env: {}
    };
  }
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!baseUrl || !email || !password) {
    return {
      status: 'unavailable',
      source: 'missing_admin_credentials',
      env: {}
    };
  }
  try {
    const login = await requestObservationBackendJson(baseUrl, '/api/v1/auth/login', '', {
      method: 'POST',
      body: { email, password }
    });
    const token = login.tokens?.accessToken;
    if (!token) {
      return {
        status: 'unavailable',
        source: 'admin_login_without_access_token',
        env: {}
      };
    }
    return {
      status: 'available',
      source: 'single_harness_admin_login_reused_for_child_processes',
      env: { CSCA_OBSERVATION_ADMIN_TOKEN: token }
    };
  } catch (error) {
    return {
      status: Number(error?.statusCode) === 429 ? 'auth_rate_limited' : 'unavailable',
      source: 'single_harness_admin_login_failed',
      errorMessage: cleanText(error?.message || error),
      env: {}
    };
  }
}

function runNodeJson(script, args, label, options = {}) {
  try {
    const output = cp.execFileSync(process.execPath, [scriptPath(script), ...args, '--json'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        ...(options.env || {})
      },
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

function assertExactApplyScope({ runId, cellId, confirmedRunId, confirmedCellId }) {
  assert(Number.isInteger(runId) && runId > 0, 'One-shot apply requires a positive --run value.');
  assert(Number.isInteger(cellId) && cellId > 0, 'One-shot apply requires a positive --cell value.');
  assert(confirmedRunId === runId, `One-shot apply requires --confirm-run=${runId}.`);
  assert(confirmedCellId === cellId, `One-shot apply requires --confirm-cell=${cellId}.`);
}

function assertApplyAuthorization({ runId, cellId, taskFamily, validationProtocolVersion, maxEstimatedCostUsd }) {
  assert(hasFlag('apply'), 'One-shot harness is preview-only unless --apply is present.');
  assert(hasFlag('confirm-one-math-observation-harness'), 'One-shot apply requires --confirm-one-math-observation-harness.');
  assert(hasFlag('confirm-runtime-clean'), 'One-shot apply requires --confirm-runtime-clean immediately before submission.');
  assert(hasFlag('confirm-provider-recovery'), 'One-shot apply requires --confirm-provider-recovery after a successful provider recovery probe.');
  assert(hasFlag('confirm-no-student-publication'), 'One-shot apply requires --confirm-no-student-publication.');
  assertExactApplyScope({
    runId,
    cellId,
    confirmedRunId: Number(argValue('confirm-run', '')),
    confirmedCellId: Number(argValue('confirm-cell', ''))
  });
  assert(cleanText(taskFamily), 'One-shot apply requires a resolved exact-cell task family.');
  assert(
    cleanText(argValue('confirm-task-family', '')) === cleanText(taskFamily),
    `One-shot apply requires --confirm-task-family=${taskFamily}.`
  );
  if (validationProtocolVersion) {
    assert(
      cleanText(argValue('confirm-validation-protocol-version', '')) === validationProtocolVersion,
      `One-shot apply requires --confirm-validation-protocol-version=${validationProtocolVersion}.`
    );
  }
  assert(Number.isFinite(maxEstimatedCostUsd) && maxEstimatedCostUsd > 0, 'One-shot apply requires a positive --max-estimated-cost-usd.');
}

function exactTargetPlanFrom(preview) {
  const questionPlan = preview?.questionPlanPreview?.questionPlan || {};
  const promptContract = preview?.promptContractPreview || {};
  return {
    taskFamily: cleanText(questionPlan.taskFamily || promptContract.userPayloadQuestionPlanTaskFamily),
    planTemplate: cleanText(questionPlan.planTemplate || promptContract.userPayloadQuestionPlanTemplate),
    promptContractStatus: promptContract.status ?? null,
    promptCharacters: Number(promptContract.totalPromptCharacters) || null,
    promptCharacterBudget: Number(promptContract.promptCharacterBudget) || null,
    maximumReservedCostUsd: Number(promptContract.executionCostPolicy?.costReservation?.maximumReservedCostUsd) || null
  };
}

function taskIdFrom(report) {
  return cleanText(report?.task?.id || report?.taskId || '');
}

function providerRecovered(providerRecoveryState) {
  return providerRecoveryState?.hardStop?.active === false
    || providerRecoveryState?.hardStop?.recoveredAfterHardStop === true
    || providerRecoveryState?.status === 'provider_recovered_after_hard_stop';
}

function mathAllExactPromptContractsReady(readiness) {
  const total = Number(readiness?.totalCellCount) || 0;
  return readiness?.status === 'passed'
    && total > 0
    && Number(readiness?.planReadyCount) === total
    && Number(readiness?.compatibleSchedulerHintCount) === total
    && Number(readiness?.promptContractPassedCount) === total
    && Number(readiness?.promptContractMissingRequiredPhraseCount) === 0
    && Number(readiness?.promptContractIssueCount) === 0
    && Number(readiness?.rejectedSchedulerHintCount) === 0
    && Number(readiness?.fallbackIncompatibleCount) === 0;
}

function selectedTargetFrom(acceptance, fallbackRunId, fallbackCellId) {
  const target = acceptance?.mathSingleRunReadiness?.target
    || acceptance?.mathObservationNextAction?.target
    || {};
  return {
    runId: asPositiveInt(target.productionRunId, fallbackRunId),
    cellId: asPositiveInt(target.productionCellId, fallbackCellId),
    blueprintId: asPositiveInt(target.blueprintId, null),
    selectionRationale: target.selectionRationale ?? null
  };
}

function runSelfTest() {
  const failures = [];
  const cases = [
    {
      label: 'missing_apply',
      flags: [],
      expected: 'One-shot harness is preview-only unless --apply is present.'
    },
    {
      label: 'missing_harness_confirmation',
      flags: ['--apply'],
      expected: 'One-shot apply requires --confirm-one-math-observation-harness.'
    },
    {
      label: 'missing_runtime_clean_confirmation',
      flags: ['--apply', '--confirm-one-math-observation-harness'],
      expected: 'One-shot apply requires --confirm-runtime-clean immediately before submission.'
    },
    {
      label: 'missing_provider_recovery_confirmation',
      flags: ['--apply', '--confirm-one-math-observation-harness', '--confirm-runtime-clean'],
      expected: 'One-shot apply requires --confirm-provider-recovery after a successful provider recovery probe.'
    },
    {
      label: 'missing_no_student_publication_confirmation',
      flags: ['--apply', '--confirm-one-math-observation-harness', '--confirm-runtime-clean', '--confirm-provider-recovery'],
      expected: 'One-shot apply requires --confirm-no-student-publication.'
    }
  ];
  const originalArgv = process.argv;
  try {
    for (const item of cases) {
      process.argv = ['node', 'script', ...item.flags];
      try {
        assertApplyAuthorization({ runId: 156, cellId: 338, taskFamily: 'fixture_family', maxEstimatedCostUsd: 0.01 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        assert(message === item.expected, `${item.label} expected "${item.expected}", got "${message}".`);
        failures.push({ label: item.label, status: 'passed', message });
        continue;
      }
      throw new Error(`${item.label} unexpectedly passed.`);
    }
    process.argv = [
      'node',
      'script',
      '--apply',
      '--confirm-one-math-observation-harness',
      '--confirm-runtime-clean',
      '--confirm-provider-recovery',
      '--confirm-no-student-publication',
      '--confirm-run=156',
      '--confirm-cell=338'
    ];
    try {
      assertApplyAuthorization({ runId: 156, cellId: 338, taskFamily: 'fixture_family', maxEstimatedCostUsd: 0.01 });
      throw new Error('missing_task_family_confirmation unexpectedly passed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(message === 'One-shot apply requires --confirm-task-family=fixture_family.', `missing_task_family_confirmation got "${message}".`);
      failures.push({ label: 'missing_task_family_confirmation', status: 'passed', message });
    }
    process.argv.push('--confirm-task-family=fixture_family');
    try {
      assertApplyAuthorization({ runId: 156, cellId: 338, taskFamily: 'fixture_family', maxEstimatedCostUsd: Number.NaN });
      throw new Error('missing_cost_cap unexpectedly passed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(message === 'One-shot apply requires a positive --max-estimated-cost-usd.', `missing_cost_cap got "${message}".`);
      failures.push({ label: 'missing_cost_cap', status: 'passed', message });
    }
    try {
      assertApplyAuthorization({
        runId: 156,
        cellId: 338,
        taskFamily: 'fixture_family',
        validationProtocolVersion: 'fixture-validation-v2',
        maxEstimatedCostUsd: 0.01
      });
      throw new Error('missing_validation_protocol_confirmation unexpectedly passed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(message === 'One-shot apply requires --confirm-validation-protocol-version=fixture-validation-v2.', `missing_validation_protocol_confirmation got "${message}".`);
      failures.push({ label: 'missing_validation_protocol_confirmation', status: 'passed', message });
    }
    process.argv.push('--confirm-validation-protocol-version=fixture-validation-v2');
    assertApplyAuthorization({
      runId: 156,
      cellId: 338,
      taskFamily: 'fixture_family',
      validationProtocolVersion: 'fixture-validation-v2',
      maxEstimatedCostUsd: 0.01
    });
    assertApplyAuthorization({ runId: 156, cellId: 338, taskFamily: 'fixture_family', maxEstimatedCostUsd: 0.01 });
  } finally {
    process.argv = originalArgv;
  }
  return {
    mode: 'math_one_shot_harness_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    networkImpact: 'none_no_http_request',
    failureCaseCount: failures.length,
    failures,
    passCase: {
      runId: 156,
      cellId: 338,
      taskFamily: 'fixture_family'
    }
  };
}

async function main() {
  const json = hasFlag('json');
  if (hasFlag('self-test')) {
    const report = runSelfTest();
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Math one-shot harness self-test passed.');
    return;
  }

  const baseUrl = cleanText(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');
  const configuredRunId = asPositiveInt(argValue('run', '156'), 156);
  const configuredCellId = asPositiveInt(argValue('cell', ''), null);
  const maxEstimatedCostUsd = Number(argValue('max-estimated-cost-usd', ''));
  const validationBatchId = cleanText(argValue('validation-batch-id', '')) || null;
  const timeoutMs = Math.max(60_000, Math.min(30 * 60_000, Number(argValue('timeout-ms', '900000')) || 900_000));
  const previewAuth = await resolveSharedObservationAdminToken(baseUrl, { allowLogin: false });
  const previewChildEnv = {
    ...previewAuth.env,
    ...(previewAuth.status !== 'available'
      ? { CSCA_OBSERVATION_BACKEND_READINESS_SKIP: '1' }
      : {})
  };

  const acceptance = runNodeJson('csca-subject-practice-no-provider-acceptance.cjs', [
    `--base-url=${baseUrl}`
  ], 'no-provider acceptance', { env: previewChildEnv });
  const target = selectedTargetFrom(acceptance, configuredRunId, configuredCellId);
  if (configuredCellId && configuredCellId !== target.cellId) {
    target.cellId = configuredCellId;
    target.selectionRationale = 'operator_selected_exact_cell';
  }
  const exactTargetPreview = runNodeJson('csca-subject-practice-exact-cell-enqueue.cjs', [
    '--subject=math',
    `--run=${target.runId}`,
    `--cell=${target.cellId}`,
    '--include-prompt-contract'
  ], 'exact target plan preview');
  const exactTargetPlan = exactTargetPlanFrom(exactTargetPreview);
  const validationProtocolVersion = validationProtocolForTarget({
    subject: 'math',
    productionRunId: target.runId,
    productionCellId: target.cellId,
    taskFamily: exactTargetPlan.taskFamily
  });
  const mathQuestionPlanRetryFeedbackCoverage = acceptance.mathQuestionPlanRetryFeedbackCoverage ?? null;
  const mathQuestionPlanSkeletonCoverage = acceptance.mathScorecard?.mathQuestionPlanSkeletonCoverage ?? null;
  const mathAllExactCellQuestionPlanReadiness = acceptance.mathAllExactCellQuestionPlanReadiness ?? null;
  const mathAllExactPromptContractsReadyForApply = mathAllExactPromptContractsReady(mathAllExactCellQuestionPlanReadiness);
  if (hasFlag('apply')) {
    assertApplyAuthorization({
      runId: target.runId,
      cellId: target.cellId,
      taskFamily: exactTargetPlan.taskFamily,
      validationProtocolVersion,
      maxEstimatedCostUsd
    });
    assert(mathAllExactPromptContractsReadyForApply, 'One-shot apply requires all math exact-cell QuestionPlan prompt contracts to pass no-provider acceptance before provider spend.');
  }
  const sharedAuth = hasFlag('apply')
    ? await resolveSharedObservationAdminToken(baseUrl, { allowLogin: true })
    : previewAuth;
  const childEnv = {
    ...sharedAuth.env,
    ...(!hasFlag('apply') && sharedAuth.status !== 'available'
      ? { CSCA_OBSERVATION_BACKEND_READINESS_SKIP: '1' }
      : {})
  };
  const providerRecoveryState = runNodeJson('csca-ai-gateway-provider-recovery-state.cjs', [], 'provider recovery state');
  const preflight = runNodeJson('csca-subject-practice-diversity-observation-preflight.cjs', [
      `--base-url=${baseUrl}`,
      `--cell=${target.cellId}`
    ], 'math observation preflight', { env: childEnv });
  const postfixEfficiencyPreview = runNodeJson('csca-subject-practice-math-postfix-efficiency-gate.cjs', [
    `--run=${target.runId}`,
    `--cell=${target.cellId}`,
    '--hours=72'
  ], 'math post-fix efficiency gate preview');
  const singleShotPreEvidence = {
    mathQuestionPlanRetryFeedbackCoverageStatus: acceptance.mathQuestionPlanRetryFeedbackCoverageStatus ?? null,
    mathQuestionPlanRetryFeedbackCoverage,
    mathQuestionPlanSkeletonCoverageStatus: mathQuestionPlanSkeletonCoverage?.status ?? null,
    mathQuestionPlanSkeletonCoverage,
    mathAllExactCellQuestionPlanReadinessStatus: mathAllExactCellQuestionPlanReadiness?.status ?? null,
    mathAllExactCellQuestionPlanReadiness,
    mathAllExactPromptContractsReadyForApply,
    postfixEfficiencyStatus: postfixEfficiencyPreview.status ?? null,
    postfixEfficiencySampleCounts: postfixEfficiencyPreview.sampleCounts ?? null,
    postfixEfficiencyYields: postfixEfficiencyPreview.yields ?? null,
    studentPublicationPolicy: 'observation_only_no_student_pool_publication'
  };
  const directPreflightBackendReadiness = preflight.observationBackendReadiness ?? {};
  const directPreflightBlockers = [
    ...(preflight.status === 'eligible_for_backend_owned_observation_submission'
      ? []
      : [`preflight:${preflight.status ?? 'unknown'}`]),
    ...(directPreflightBackendReadiness.loaded === true
      ? []
      : ['observation_backend_readiness_not_loaded']),
    ...(directPreflightBackendReadiness.questionPlanReadyForTarget === true
      ? []
      : ['observation_question_plan_not_ready_for_target_cell'])
  ];

  const preview = {
    mode: 'math_one_shot_harness_preview',
    status: hasFlag('apply') ? 'apply_requested' : 'preview_only',
    productionImpact: hasFlag('apply')
      ? 'bounded_one_backend_owned_math_observation_task_after_confirmations'
      : 'none_preview_only',
    providerImpact: hasFlag('apply')
      ? 'one_backend_owned_provider_generation_possible_after_confirmations'
      : 'none_no_provider_call',
    dbImpact: hasFlag('apply')
      ? 'one_observation_task_and_generation_evidence_possible_after_confirmations'
      : 'read_only_audit_state',
    studentConsumableImpact: 'none_does_not_publish_to_student_pool',
    standaloneProviderExecution: false,
    target: {
      subject: 'math',
      productionRunId: target.runId,
      productionCellId: target.cellId,
      blueprintId: target.blueprintId,
      selectionRationale: target.selectionRationale,
      taskFamily: exactTargetPlan.taskFamily,
      planTemplate: exactTargetPlan.planTemplate,
      validationProtocolVersion
    },
    readiness: {
      noProviderAcceptanceStatus: acceptance.status ?? null,
      mathSingleRunReadinessStatus: acceptance.mathSingleRunReadiness?.status ?? null,
      mathSingleRunBlockers: acceptance.mathSingleRunReadiness?.blockers ?? [],
      directPreflightBlockers,
      preflightStatus: preflight.status ?? null,
      preflightFailures: preflight.failures ?? [],
      preflightWaitReasons: preflight.waitReasons ?? [],
      preflightWarnings: preflight.warnings ?? [],
      preflightSource: preflight.source ?? 'direct_target_cell_preflight',
      preflightObservationBackendReadiness: preflight.observationBackendReadiness ?? null,
      observationBackendReadiness: acceptance.observationBackendReadiness ?? null,
      providerRecoveryStatus: providerRecoveryState.status ?? null,
      providerHardStopActive: providerRecoveryState.hardStop?.active ?? null,
      providerRecoveredAfterHardStop: providerRecoveryState.hardStop?.recoveredAfterHardStop ?? null,
      mathQuestionPlanRetryFeedbackCoverageStatus: singleShotPreEvidence.mathQuestionPlanRetryFeedbackCoverageStatus,
      mathQuestionPlanRetryFeedbackCoverage,
      mathQuestionPlanSkeletonCoverageStatus: singleShotPreEvidence.mathQuestionPlanSkeletonCoverageStatus,
      mathQuestionPlanSkeletonCoverage,
      mathAllExactCellQuestionPlanReadinessStatus: singleShotPreEvidence.mathAllExactCellQuestionPlanReadinessStatus,
      mathAllExactCellQuestionPlanReadiness,
      mathAllExactPromptContractsReadyForApply,
      exactTargetPromptContractStatus: exactTargetPlan.promptContractStatus,
      exactTargetPromptCharacters: exactTargetPlan.promptCharacters,
      exactTargetPromptCharacterBudget: exactTargetPlan.promptCharacterBudget,
      exactTargetMaximumReservedCostUsd: exactTargetPlan.maximumReservedCostUsd,
      postfixEfficiencyStatus: postfixEfficiencyPreview.status ?? null,
      postfixEfficiencySatisfied: postfixEfficiencyPreview.efficiencySatisfied === true,
      postfixEfficiencyReasons: postfixEfficiencyPreview.reasons ?? [],
      postfixEfficiencySampleCounts: postfixEfficiencyPreview.sampleCounts ?? null,
      postfixEfficiencyYields: postfixEfficiencyPreview.yields ?? null
    },
    singleShotPreEvidence,
    postfixEfficiencyPreview,
    auth: {
      status: sharedAuth.status,
      source: sharedAuth.source,
      errorMessage: sharedAuth.errorMessage ?? null,
      tokenValueHidden: sharedAuth.status === 'available'
    },
    authorizationRequiredForApply: [
      '--apply',
      '--confirm-one-math-observation-harness',
      '--confirm-runtime-clean',
      '--confirm-provider-recovery',
      '--confirm-no-student-publication',
      `--confirm-run=${target.runId}`,
      `--confirm-cell=${target.cellId}`,
      `--confirm-task-family=${exactTargetPlan.taskFamily || 'EXACT_TASK_FAMILY'}`,
      ...(validationProtocolVersion ? [`--confirm-validation-protocol-version=${validationProtocolVersion}`] : []),
      '--max-estimated-cost-usd=EXPLICIT_PER_CALL_CAP'
    ],
    requiredObservationBackendCommandBeforeApply: [
      'npm.cmd run backend:dev:observation --',
      '--port=3001',
      '--enable-question-plan',
      `--question-plan-cell-allowlist=${target.cellId}`
    ].join(' '),
    liveCommandAfterSuccessfulProviderRecovery: [
      'npm.cmd run csca-ai-questioning:math-one-shot-harness --',
      `--base-url=${baseUrl}`,
      `--run=${target.runId}`,
      `--cell=${target.cellId}`,
      '--apply',
      '--wait',
      '--confirm-one-math-observation-harness',
      '--confirm-runtime-clean',
      '--confirm-provider-recovery',
      '--confirm-no-student-publication',
      `--confirm-run=${target.runId}`,
      `--confirm-cell=${target.cellId}`,
      `--confirm-task-family=${exactTargetPlan.taskFamily || 'EXACT_TASK_FAMILY'}`,
      ...(validationProtocolVersion ? [`--confirm-validation-protocol-version=${validationProtocolVersion}`] : []),
      `--max-estimated-cost-usd=${Number.isFinite(maxEstimatedCostUsd) && maxEstimatedCostUsd > 0 ? maxEstimatedCostUsd : 'EXPLICIT_PER_CALL_CAP'}`,
      '--json'
    ].join(' '),
    forbiddenActions: [
      'standalone_provider_execution',
      'multiple_observation_tasks',
      'student_pool_publication',
      'skipping_provider_recovery_state_check',
      'skipping_completion_gate'
    ]
  };

  if (!hasFlag('apply')) {
    if (json) console.log(JSON.stringify(preview, null, 2));
    else {
      console.log(`Math one-shot harness: ${preview.status}`);
      console.log(`- target=math run #${target.runId}, cell #${target.cellId}, family=${exactTargetPlan.taskFamily || 'unresolved'}`);
      console.log(`- readiness=${preview.readiness.mathSingleRunReadinessStatus}, providerHardStop=${preview.readiness.providerHardStopActive}`);
      console.log(`- mathRetryFeedback=${preview.readiness.mathQuestionPlanRetryFeedbackCoverageStatus}, mathSkeleton=${preview.readiness.mathQuestionPlanSkeletonCoverageStatus}`);
      console.log(`- postfixEfficiency=${preview.readiness.postfixEfficiencyStatus}, studentPublication=${preview.singleShotPreEvidence.studentPublicationPolicy}`);
      console.log(`- liveCommand=${preview.liveCommandAfterSuccessfulProviderRecovery}`);
    }
    return;
  }

  assert(sharedAuth.status === 'available', `One-shot apply requires an admin token before submission, got ${sharedAuth.status}.`);
  const runtimePrecheck = runNodeJson('csca-ai-gateway-provider-recovery-probe.cjs', [
    '--runtime-precheck-only'
  ], 'provider recovery runtime precheck');
  assert(
    runtimePrecheck.status === 'runtime_precheck_passed_live_provider_not_called',
    `Runtime precheck must pass immediately before one-shot apply, got ${runtimePrecheck.status}.`
  );
  assert(preflight.status === 'eligible_for_backend_owned_observation_submission', `Preflight must be eligible before apply, got ${preflight.status}.`);
  assert((preflight.failures ?? []).length === 0, `Preflight failures must be empty before apply: ${JSON.stringify(preflight.failures)}`);
  assert(providerRecovered(providerRecoveryState), 'Provider recovery state must show a successful post-hard-stop recovery before one-shot apply.');

  const submitted = runNodeJson('csca-subject-practice-math-diversity-observation-run.cjs', [
    `--base-url=${baseUrl}`,
    `--run=${target.runId}`,
    `--cell=${target.cellId}`,
    `--timeout-ms=${timeoutMs}`,
    `--max-estimated-cost-usd=${maxEstimatedCostUsd}`,
    ...(validationBatchId ? [`--validation-batch-id=${validationBatchId}`] : []),
    '--apply',
    '--wait',
    '--confirm-math-diversity-observation-run',
    '--confirm-provider-recovery',
    `--confirm-run=${target.runId}`,
    `--confirm-cell=${target.cellId}`,
    `--confirm-task-family=${exactTargetPlan.taskFamily}`,
    ...(validationProtocolVersion ? [`--confirm-validation-protocol-version=${validationProtocolVersion}`] : [])
  ], 'math observation apply and wait', { env: childEnv });
  const taskId = taskIdFrom(submitted);
  assert(taskId, 'Submitted observation did not return a task id.');

  const evidence = runNodeJson('csca-subject-practice-observation-evidence.cjs', [
    '--subject=math',
    `--task=${taskId}`
  ], 'math observation evidence');
  const gate = runNodeJson('csca-subject-practice-math-observation-completion-gate.cjs', [
    '--subject=math',
    `--task=${taskId}`,
    `--run=${target.runId}`,
    `--cell=${target.cellId}`
  ], 'math observation completion gate');
  const postfixEfficiency = runNodeJson('csca-subject-practice-math-postfix-efficiency-gate.cjs', [
    `--task=${taskId}`,
    `--run=${target.runId}`,
    `--cell=${target.cellId}`
  ], 'math post-fix efficiency gate');

  const report = {
    mode: 'math_one_shot_harness',
    status: gate.status === 'passed' || gate.status === 'passed_fresh_quality_evidence_efficiency_still_needs_scale'
      ? 'completed_with_gate_evidence'
      : 'completed_needs_attention',
    productionImpact: 'bounded_one_backend_owned_math_observation_task',
    providerImpact: 'backend_owned_observation_provider_call_only',
    dbImpact: 'observation_task_generation_job_gateway_logs_and_read_only_gate_evidence',
    studentConsumableImpact: 'none_does_not_publish_to_student_pool',
    standaloneProviderExecution: false,
    target: preview.target,
    submittedTaskId: taskId,
    submitted,
    evidence,
    gate,
    postfixEfficiency,
    nextStep: postfixEfficiency.status === 'passed'
      ? 'continue_three_subject_scorecard_monitoring'
      : gate.status === 'passed' || gate.status === 'passed_fresh_quality_evidence_efficiency_still_needs_scale'
        ? 'continue_scaled_math_observation_until_postfix_efficiency_gate_passes'
        : 'inspect_gate_missing_requirements_before_any_second_live_task'
  };

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Math one-shot harness: ${report.status}`);
    console.log(`- task=${taskId}`);
    console.log(`- gate=${gate.status}`);
    console.log(`- postfixEfficiency=${postfixEfficiency.status}`);
    console.log(`- next=${report.nextStep}`);
  }
  if (gate.status !== 'passed' && gate.status !== 'passed_fresh_quality_evidence_efficiency_still_needs_scale') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    mode: 'math_one_shot_harness',
    message: error instanceof Error ? error.message : String(error),
    providerImpact: 'none_before_confirmed_apply_or_backend_owned_only_after_confirmed_apply',
    studentConsumableImpact: 'none_does_not_publish_to_student_pool',
    standaloneProviderExecution: false
  }, null, 2));
  process.exitCode = 1;
});
