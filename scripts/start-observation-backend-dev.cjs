const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

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

const root = path.resolve(__dirname, '..');
loadEnv(root);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const requestedPort = argValue('port', process.env.CSCA_OBSERVATION_BACKEND_PORT || '3001');
const portNumber = Number(requestedPort);
if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
  throw new Error('--port must be an integer from 1 to 65535.');
}
const port = String(portNumber);
const requestedQuestionPlanCellAllowlist = argValue(
  'question-plan-cell-allowlist',
  argValue('cell-allowlist', process.env.CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST || '')
);
const localShadowQualificationMode = hasFlag('local-shadow-qualification');
const transpileOnlyMode = hasFlag('transpile-only');
const localShadowCellIds = String(requestedQuestionPlanCellAllowlist).trim()
  ? String(requestedQuestionPlanCellAllowlist).split(/[,;\s]+/).filter(Boolean)
  : [];
if (localShadowQualificationMode && !localShadowCellIds.length) {
  throw new Error('--local-shadow-qualification requires --question-plan-cell-allowlist=<exact cell id list>.');
}
if (localShadowQualificationMode && localShadowCellIds.some((cellId) => !/^[1-9]\d*$/.test(cellId))) {
  throw new Error('--question-plan-cell-allowlist must contain only positive integer cell ids in local-shadow qualification mode.');
}
const questionPlanCellAllowlist = localShadowQualificationMode
  ? [...new Set(localShadowCellIds.map(Number))].join(',')
  : requestedQuestionPlanCellAllowlist;
const questionPlanEnabled = localShadowQualificationMode
  || hasFlag('enable-question-plan')
  || ['true', '1'].includes(String(process.env.CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED || '').toLowerCase());
const localGeneratorShadowEnabled = localShadowQualificationMode
  || hasFlag('enable-local-generator-shadow')
  || ['true', '1'].includes(String(process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED || '').toLowerCase());
const requestedCooldownMinutes = Number.parseInt(argValue('cooldown-minutes', ''), 10);
const observationCooldownMinutes = Number.isInteger(requestedCooldownMinutes) && requestedCooldownMinutes >= 1
  ? String(requestedCooldownMinutes)
  : process.env.SUBJECT_PRACTICE_OBSERVATION_GLOBAL_COOLDOWN_MINUTES;

const env = {
  ...process.env,
  PORT: port,
  SUBJECT_PRACTICE_OBSERVATION_TASK_ENABLED: 'true',
  SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ENABLED: 'true',
  SUBJECT_PRACTICE_OBSERVATION_SINGLETON_CONFIRMED: 'true',
  SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE: 'true',
  ...(observationCooldownMinutes ? { SUBJECT_PRACTICE_OBSERVATION_GLOBAL_COOLDOWN_MINUTES: observationCooldownMinutes } : {}),
  ...(questionPlanEnabled ? { CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED: 'true' } : {}),
  ...(localGeneratorShadowEnabled ? { CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED: 'true' } : {}),
  ...(questionPlanCellAllowlist ? { CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST: questionPlanCellAllowlist } : {}),
  CSCALITE_BACKEND_WATCH: process.env.CSCALITE_BACKEND_WATCH || '0'
};

console.log(`Starting CSCAlite observation-only backend on http://127.0.0.1:${port}`);
console.log('Observation-only mode is enabled; ordinary subject-practice production and predictive runners stay disabled in this process.');
if (localShadowQualificationMode) {
  console.log('Local-shadow qualification mode is enabled; QuestionPlan and deterministic local Generator are both forced on.');
}
if (questionPlanEnabled) {
  console.log(`QuestionPlan is enabled for this observation backend; cell allowlist=${questionPlanCellAllowlist || '(not set)'}.`);
}
if (localGeneratorShadowEnabled) {
  console.log('Local deterministic generator shadow is enabled; exact supported plans use zero Provider calls.');
}
if (observationCooldownMinutes) {
  console.log(`Observation submission cooldown=${observationCooldownMinutes} minute(s).`);
}
console.log('Use CSCA_OBSERVATION_BASE_URL to point observation CLI commands at this backend.');

if (transpileOnlyMode) {
  console.log('Transpile-only startup is enabled; runtime safety gates are unchanged and full type-check remains a separate prerequisite.');
}

const command = transpileOnlyMode ? process.execPath : npmCommand;
const commandArguments = transpileOnlyMode
  ? [
      '-r',
      path.join(root, 'backend', 'node_modules', 'ts-node', 'register', 'transpile-only'),
      path.join(root, 'backend', 'src', 'main.ts')
    ]
  : ['run', 'dev'];
const result = spawnSync(command, commandArguments, {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32' && !transpileOnlyMode
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
