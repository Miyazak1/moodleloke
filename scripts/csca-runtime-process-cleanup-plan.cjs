#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

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
  return Array.isArray(value) ? value : value ? [value] : [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function classifyProcess(commandLine, processName = '') {
  const text = cleanText(commandLine);
  if (/^cmd\.exe$/i.test(cleanText(processName))) return 'windows_cmd_wrapper';
  if (/Codex\\runtimes\\cua_node|trusted-worker\.js|kernel\.js/i.test(text)) return 'codex_runtime';
  if (/csca-runtime-process-cleanup-plan\.cjs|csca-ai-questioning:runtime-process-cleanup-plan/i.test(text)) return 'diagnostic_process';
  if (/csca-runtime-process-audit\.cjs|csca-ai-questioning:runtime-process-audit/i.test(text)) return 'diagnostic_process';
  if (/backend:dev:observation|start-observation-backend-dev\.cjs/i.test(text)) return 'observation_backend_runner';
  if (/playwright(?:\.js)?\s+test|npx-cli\.js"?\s+playwright\s+test/i.test(text)) return 'test_runner';
  if (/npm-cli\.js"?\s+run\s+dev:force(?:\s|$)|npm\s+run\s+dev:force(?:\s|$)/i.test(text)) return 'frontend_dev_runner';
  if (/npm-cli\.js"?\s+run\s+dev:local|npm\s+run\s+dev:local/i.test(text)) return 'dev_local_runner';
  if (/npm-cli\.js"?\s+run\s+dev(?:\s|$)|npm\s+run\s+dev(?:\s|$)/i.test(text)) return 'root_dev_runner';
  if (/start-backend-dev\.cjs|npm-cli\.js"?\s+run\s+backend:dev|npm\s+run\s+backend:dev|npm-cli\.js"?\s+run\s+start:watch|nest\.js"?\s+start\s+--watch/i.test(text)) return 'backend_dev_runner';
  if (/backend[\\/]dist[\\/]main/i.test(text)) return 'backend_dist_runner';
  if (/frontend[\\/].*vite|vite\.js|npm-cli\.js"?\s+run\s+frontend:dev|frontend\s+run\s+dev/i.test(text)) return 'frontend_dev_runner';
  if (/CSCAlite|csca/i.test(text)) return 'cscalite_node_process';
  return 'other_node_process';
}

function inspectWindowsNodeProcesses() {
  const command = [
    'Get-CimInstance Win32_Process -Filter "name = \'node.exe\' or name = \'cmd.exe\'"',
    '| Select-Object ProcessId,ParentProcessId,Name,CreationDate,CommandLine',
    '| ConvertTo-Json -Depth 4'
  ].join(' ');
  const stdout = execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command
  ], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return arrayFrom(JSON.parse(stdout || '[]'));
}

function categoryProtectedFromCleanup(category) {
  return category === 'codex_runtime'
    || category === 'frontend_dev_runner'
    || category === 'diagnostic_process'
    || category === 'test_runner'
    || category === 'windows_cmd_wrapper'
    || category === 'cscalite_node_process';
}

function normalizeProcesses(rawProcesses) {
  const processes = rawProcesses.map((row) => {
    const commandLine = cleanText(row.CommandLine);
    const category = classifyProcess(commandLine, row.Name);
    const processId = Number(row.ProcessId) || null;
    return {
      processId,
      parentProcessId: Number(row.ParentProcessId) || null,
      name: cleanText(row.Name) || null,
      creationDate: cleanText(row.CreationDate) || null,
      category,
      protected: false,
      commandLine
    };
  });
  const processById = new Map();
  const processByParent = new Map();
  for (const processInfo of processes) {
    if (processInfo.processId) processById.set(processInfo.processId, processInfo);
    const parent = processInfo.parentProcessId;
    if (!parent) continue;
    const children = processByParent.get(parent) || [];
    children.push(processInfo);
    processByParent.set(parent, children);
  }
  const observationTreeProcessIds = new Set();
  const observationCandidates = processes.filter((item) => item.category === 'observation_backend_runner');
  const observationCandidateIds = new Set(observationCandidates.map((item) => item.processId).filter(Boolean));
  const roots = observationCandidates.filter((item) => {
    const visited = new Set();
    let ancestor = processById.get(item.parentProcessId);
    while (ancestor?.processId && !visited.has(ancestor.processId)) {
      if (observationCandidateIds.has(ancestor.processId)) return false;
      visited.add(ancestor.processId);
      ancestor = processById.get(ancestor.parentProcessId);
    }
    return true;
  });
  const stack = [...roots];
  while (stack.length) {
    const current = stack.pop();
    if (!current?.processId || observationTreeProcessIds.has(current.processId)) continue;
    observationTreeProcessIds.add(current.processId);
    for (const child of processByParent.get(current.processId) || []) stack.push(child);
  }
  for (const processInfo of processes) {
    const isObservationTree = processInfo.processId && observationTreeProcessIds.has(processInfo.processId);
    processInfo.observationBackendTree = Boolean(isObservationTree);
    processInfo.protected = categoryProtectedFromCleanup(processInfo.category) || isObservationTree || !processInfo.processId;
  }
  return processes;
}

function buildCleanupPlan(processes) {
  const backendCategories = new Set(['dev_local_runner', 'root_dev_runner', 'backend_dev_runner', 'backend_dist_runner']);
  const stopCandidates = processes
    .filter((item) => !item.protected && backendCategories.has(item.category))
    .sort((left, right) => Number(left.processId) - Number(right.processId));
  const stopProcessIds = stopCandidates.map((item) => item.processId);
  return {
    strategy: 'stop_all_duplicate_or_mixed_backend_runners_then_start_one_observation_backend',
    rationale: [
      'multiple_backend_runners_can_refresh_gateway_cooldown_or_consume_provider_keys',
      'provider_recovery_probe_should_run_after_runtime_is_quiet',
      'math_live_gate_should_run_only_after_recovery_probe_success'
    ],
    protectedCategories: [
      'codex_runtime',
      'frontend_dev_runner',
      'diagnostic_process',
      'observation_backend_runner',
      'cscalite_node_process'
    ],
    stopProcessIds,
    stopCandidates,
    applyCommand: stopProcessIds.length
      ? `npm.cmd run csca-ai-questioning:runtime-process-cleanup-plan -- --apply --confirm-runtime-cleanup --confirm-stop-pids=${stopProcessIds.join(',')} --json`
      : null,
    postCleanupCommands: {
      audit: 'npm.cmd run csca-ai-questioning:runtime-process-audit -- --json',
      startObservationBackend: 'npm.cmd run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=338',
      providerRecoveryProbeAfterExplicitAuthorization: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --allow-live-provider --confirm-runtime-clean'
    }
  };
}

function csvInts(value) {
  return cleanText(value)
    .split(',')
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function applyCleanup(stopProcessIds, expectedProcessIds) {
  if (!hasFlag('confirm-runtime-cleanup')) {
    throw new Error('Refusing to stop processes without --confirm-runtime-cleanup.');
  }
  const expected = [...expectedProcessIds].sort((left, right) => left - right).join(',');
  const actual = [...stopProcessIds].sort((left, right) => left - right).join(',');
  if (!actual || actual !== expected) {
    throw new Error(`Refusing to stop processes without exact --confirm-stop-pids=${expected || '<none>'}.`);
  }
  const powershellList = stopProcessIds.join(',');
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Stop-Process -Id ${powershellList} -ErrorAction Stop`
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function buildReport() {
  let rawProcesses = [];
  let inspectionError = null;
  try {
    rawProcesses = inspectWindowsNodeProcesses();
  } catch (error) {
    inspectionError = cleanText(error?.stderr || error?.message || error);
  }

  const processes = normalizeProcesses(rawProcesses);
  const cleanupPlan = buildCleanupPlan(processes);
  let applyResult = null;
  if (hasFlag('apply')) {
    applyCleanup(cleanupPlan.stopProcessIds, csvInts(argValue('confirm-stop-pids', '')));
    applyResult = {
      status: 'stopped_confirmed_processes',
      stoppedProcessIds: cleanupPlan.stopProcessIds
    };
  }

  const duplicateOrMixedBackendRisk = cleanupPlan.stopProcessIds.length > 0;
  const applyPreflight = {
    dryRunByDefault: !hasFlag('apply'),
    applyRequested: hasFlag('apply'),
    confirmRuntimeCleanup: hasFlag('confirm-runtime-cleanup'),
    requiredConfirmStopPids: cleanupPlan.stopProcessIds,
    providedConfirmStopPids: csvInts(argValue('confirm-stop-pids', '')),
    candidateCount: cleanupPlan.stopProcessIds.length,
    protectedProcessCount: processes.filter((item) => item.protected).length
  };
  return {
    mode: 'csca_runtime_process_cleanup_plan',
    status: inspectionError
      ? 'process_inspection_unavailable'
      : duplicateOrMixedBackendRisk
        ? 'cleanup_plan_ready'
        : 'no_duplicate_backend_cleanup_needed',
    productionImpact: hasFlag('apply') ? 'stops_selected_local_backend_processes_only' : 'none_dry_run_cleanup_plan_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_db_access',
    inspectionError: inspectionError || null,
    duplicateOrMixedBackendRisk,
    applyPreflight,
    cleanupPlan,
    applyResult,
    safetyBoundary: [
      'dry_run_by_default',
      'does_not_call_provider',
      'does_not_read_or_write_database',
      'does_not_authorize_student_publication',
      'apply_requires_exact_confirm_stop_pids'
    ],
    processes: hasFlag('include-all') ? processes : undefined
  };
}

function selfTest() {
  const processes = normalizeProcesses([
    { ProcessId: 101, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'node scripts/csca-runtime-process-cleanup-plan.cjs --json' },
    { ProcessId: 102, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'C:\\Users\\Administrator\\AppData\\Local\\OpenAI\\Codex\\runtimes\\cua_node\\bin\\node.exe trusted-worker.js' },
    { ProcessId: 103, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'node D:\\CODE\\CSCAlite\\frontend\\node_modules\\.bin\\vite.js --port 5187' },
    { ProcessId: 104, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'npm run dev:local' },
    { ProcessId: 105, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'npm run backend:dev' },
    { ProcessId: 106, ParentProcessId: 1, CreationDate: 'now', CommandLine: 'node --enable-source-maps D:\\CODE\\CSCAlite\\backend\\dist\\main' },
    { ProcessId: 201, ParentProcessId: 1, Name: 'node.exe', CreationDate: 'now', CommandLine: 'npm run backend:dev:observation -- --port=3001 --enable-question-plan --question-plan-cell-allowlist=338' },
    { ProcessId: 202, ParentProcessId: 201, Name: 'cmd.exe', CreationDate: 'now', CommandLine: 'cmd.exe /d /s /c node scripts/start-observation-backend-dev.cjs --port=3001 --enable-question-plan --question-plan-cell-allowlist=338' },
    { ProcessId: 203, ParentProcessId: 202, Name: 'node.exe', CreationDate: 'now', CommandLine: 'node scripts/start-observation-backend-dev.cjs --port=3001 --enable-question-plan --question-plan-cell-allowlist=338' },
    { ProcessId: 204, ParentProcessId: 203, Name: 'cmd.exe', CreationDate: 'now', CommandLine: 'cmd.exe /d /s /c npm run dev' },
    { ProcessId: 205, ParentProcessId: 204, Name: 'node.exe', CreationDate: 'now', CommandLine: 'npm run dev' },
    { ProcessId: 206, ParentProcessId: 205, Name: 'cmd.exe', CreationDate: 'now', CommandLine: 'cmd.exe /d /s /c npm run start:dev' },
    { ProcessId: 207, ParentProcessId: 206, Name: 'node.exe', CreationDate: 'now', CommandLine: 'npm run start:dev' },
    { ProcessId: 208, ParentProcessId: 207, Name: 'cmd.exe', CreationDate: 'now', CommandLine: 'cmd.exe /d /s /c node --enable-source-maps D:\\CODE\\CSCAlite\\backend\\dist\\main' },
    { ProcessId: 209, ParentProcessId: 208, Name: 'node.exe', CreationDate: 'now', CommandLine: 'node --enable-source-maps D:\\CODE\\CSCAlite\\backend\\dist\\main' }
  ]);
  const plan = buildCleanupPlan(processes);
  assert(plan.stopProcessIds.join(',') === '104,105,106', `Unexpected stop ids: ${plan.stopProcessIds.join(',')}`);
  assert(plan.applyCommand.includes('--confirm-runtime-cleanup'), 'Apply command must include runtime cleanup confirmation.');
  assert(plan.applyCommand.includes('--confirm-stop-pids=104,105,106'), 'Apply command must include exact stop PID confirmation.');
  assert(processes.find((item) => item.processId === 101)?.protected === true, 'Diagnostic process must be protected.');
  assert(processes.find((item) => item.processId === 102)?.protected === true, 'Codex runtime process must be protected.');
  assert(processes.find((item) => item.processId === 103)?.protected === true, 'Frontend dev process must be protected.');
  assert(processes.find((item) => item.processId === 209)?.observationBackendTree === true, 'Observation backend child process must be recognized.');
  assert(processes.find((item) => item.processId === 209)?.protected === true, 'Observation backend child process must be protected.');
  console.log('CSCA runtime process cleanup plan self-test passed.');
}

if (hasFlag('self-test')) {
  selfTest();
  process.exit(0);
}

try {
  const report = buildReport();
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`CSCA runtime process cleanup plan: ${report.status}`);
    console.log(`- stop candidates: ${report.cleanupPlan.stopProcessIds.join(',') || 'none'}`);
    console.log(`- apply command: ${report.cleanupPlan.applyCommand || 'none'}`);
  }
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
