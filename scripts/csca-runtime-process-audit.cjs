#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..').toLowerCase();

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function classifyProcess(commandLine, processName = '') {
  const text = cleanText(commandLine);
  if (/^cmd\.exe$/i.test(cleanText(processName))) return 'windows_cmd_wrapper';
  if (/Codex\\runtimes\\cua_node|trusted-worker\.js|kernel\.js/i.test(text)) return 'codex_runtime';
  if (/csca-runtime-process-audit\.cjs|csca-ai-questioning:runtime-process-audit/i.test(text)) return 'diagnostic_process';
  if (/backend:dev:observation|start-observation-backend-dev\.cjs/i.test(text)) return 'observation_backend_runner';
  if (/playwright(?:\.js)?\s+test|npx-cli\.js"?\s+playwright\s+test/i.test(text)) return 'test_runner';
  if (/npm-cli\.js"?\s+run\s+dev:force(?:\s|$)|npm\s+run\s+dev:force(?:\s|$)/i.test(text)) return 'frontend_dev_runner';
  if (/npm-cli\.js"?\s+run\s+dev:local(?:\s|$)|npm\s+run\s+dev:local(?:\s|$)/i.test(text)) return 'dev_local_runner';
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

function categoryExcludedFromRisk(category) {
  return category === 'codex_runtime'
    || category === 'frontend_dev_runner'
    || category === 'diagnostic_process'
    || category === 'test_runner'
    || category === 'windows_cmd_wrapper'
    || category === 'cscalite_node_process';
}

function buildReport() {
  let rawProcesses = [];
  let inspectionError = null;
  try {
    rawProcesses = inspectWindowsNodeProcesses();
  } catch (error) {
    inspectionError = cleanText(error?.stderr || error?.message || error);
  }

  const processes = rawProcesses.map((row) => {
    const commandLine = cleanText(row.CommandLine);
    const category = classifyProcess(commandLine, row.Name);
    return {
      processId: Number(row.ProcessId) || null,
      parentProcessId: Number(row.ParentProcessId) || null,
      name: cleanText(row.Name) || null,
      creationDate: cleanText(row.CreationDate) || null,
      category,
      excludedFromRisk: false,
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
  const foreignWorkspaceProcessIds = new Set(processes
    .filter((item) => /[\\/]code[\\/](?!cscalite(?:[\\/]|$))/i.test(item.commandLine)
      && !item.commandLine.toLowerCase().includes(WORKSPACE_ROOT))
    .map((item) => item.processId)
    .filter(Boolean));
  let foreignExpanded = true;
  while (foreignExpanded) {
    foreignExpanded = false;
    for (const processInfo of processes) {
      if (foreignWorkspaceProcessIds.has(processInfo.processId)) continue;
      if (foreignWorkspaceProcessIds.has(processInfo.parentProcessId)
        || (processInfo.processId && (processByParent.get(processInfo.processId) || [])
          .some((child) => foreignWorkspaceProcessIds.has(child.processId)))) {
        foreignWorkspaceProcessIds.add(processInfo.processId);
        foreignExpanded = true;
      }
    }
  }
  for (const processInfo of processes) {
    const isObservationTree = processInfo.processId && observationTreeProcessIds.has(processInfo.processId);
    const isForeignWorkspaceTree = processInfo.processId
      && foreignWorkspaceProcessIds.has(processInfo.processId);
    processInfo.observationBackendTree = Boolean(isObservationTree);
    processInfo.foreignWorkspaceTree = Boolean(isForeignWorkspaceTree);
    processInfo.excludedFromRisk = categoryExcludedFromRisk(processInfo.category)
      || isObservationTree
      || isForeignWorkspaceTree;
  }
  const riskProcesses = processes.filter((item) => !item.excludedFromRisk);
  const countByCategory = Object.fromEntries(
    Array.from(new Set(processes.map((item) => item.category))).sort().map((category) => [
      category,
      processes.filter((item) => item.category === category).length
    ])
  );
  const backendRunnerCount = riskProcesses
    .filter((item) => /dev_local_runner|root_dev_runner|backend_dev_runner|backend_dist_runner/.test(item.category))
    .length;
  const riskCountByCategory = Object.fromEntries(
    Array.from(new Set(riskProcesses.map((item) => item.category))).sort().map((category) => [
      category,
      riskProcesses.filter((item) => item.category === category).length
    ])
  );
  const devLocalCount = riskCountByCategory.dev_local_runner || 0;
  const rootDevCount = riskCountByCategory.root_dev_runner || 0;
  const backendDevCount = riskCountByCategory.backend_dev_runner || 0;
  const backendDistCount = riskCountByCategory.backend_dist_runner || 0;
  const duplicateOrMixedBackendRisk = devLocalCount > 1
    || rootDevCount > 1
    || backendDevCount > 1
    || (observationTreeProcessIds.size > 0 && backendRunnerCount > 0)
    || backendRunnerCount > 1
    || (backendDistCount > 0 && devLocalCount + rootDevCount + backendDevCount > 0);
  const status = inspectionError
    ? 'process_inspection_unavailable'
    : duplicateOrMixedBackendRisk
      ? 'attention_duplicate_or_mixed_backend_processes'
      : 'clear_single_or_no_backend_runner';

  return {
    mode: 'csca_runtime_process_audit',
    status,
    productionImpact: 'none_read_only_runtime_process_audit',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_db_access',
    inspectionMethod: 'windows_wmi_node_process_commandline_read_only',
    inspectionError: inspectionError || null,
    backendRunnerCount,
    observationBackendProcessCount: observationTreeProcessIds.size,
    observationBackendTreeCount: roots.length,
    observationBackendRootProcessIds: roots.map((item) => item.processId).filter(Boolean),
    foreignWorkspaceProcessCount: foreignWorkspaceProcessIds.size,
    duplicateOrMixedBackendRisk,
    countByCategory,
    riskCountByCategory,
    nextSafeAction: duplicateOrMixedBackendRisk
      ? 'operator_stop_duplicate_or_old_backend_processes_before_provider_recovery_probe'
      : inspectionError
        ? 'rerun_process_audit_from_an_elevated_local_shell_before_provider_recovery_probe'
        : 'runtime_process_state_does_not_block_provider_recovery_probe',
    safetyBoundary: [
      'does_not_stop_processes',
      'does_not_call_provider',
      'does_not_read_or_write_database',
      'does_not_authorize_student_publication'
    ],
    riskProcesses,
    processes: hasFlag('include-all') ? processes : undefined
  };
}

const report = buildReport();
if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`CSCA runtime process audit: ${report.status}`);
  console.log(`- backend runners: ${report.backendRunnerCount}; duplicateOrMixedBackendRisk=${report.duplicateOrMixedBackendRisk}`);
  console.log(`- next: ${report.nextSafeAction}`);
}
