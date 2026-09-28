const path = require('node:path');

function valueArg(args, name, fallback = '') {
  const prefix = `--${name}=`;
  return args.find((item) => item.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function version(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[a-z0-9._+-]{1,64}$/i.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function safeToken(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[a-z0-9._-]{1,80}$/i.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function safePath(value, label) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized || /[\r\n"'`$;&|<>]/.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function commandPrefix(input) {
  return `docker compose -p ${input.project} --profile question-engine --env-file ${input.envFile} -f ${input.composeFile}`;
}

function buildQuestionEngineSidecarRolloutPlan(input) {
  const fromVersion = version(input.fromVersion, 'from_version');
  const toVersion = version(input.toVersion, 'to_version');
  if (fromVersion === toVersion) throw new Error('worker_versions_must_differ');
  const project = safeToken(input.project || 'moodlelike-demo', 'project');
  const envFile = safePath(input.envFile || '.env', 'env_file');
  const composeFile = safePath(input.composeFile || 'deploy/docker-compose.prod.yml', 'compose_file');
  const prefix = commandPrefix({ project, envFile, composeFile });
  const probe = `${prefix} exec -T backend node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker`;
  return {
    schemaVersion: 'question-engine-sidecar-rollout-plan-v1',
    safety: {
      executesCommands: false,
      callsProvider: false,
      writesDatabase: false,
      publishesQuestions: false,
      productionHostModeMustRemain: 'in-process'
    },
    inputs: { fromVersion, toVersion, project, envFile, composeFile },
    phases: [
      {
        id: 'baseline',
        env: { QUESTION_ENGINE_WORKER_VERSION: fromVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: fromVersion },
        commands: [`${prefix} up -d --build question-engine-worker`, probe]
      },
      {
        id: 'open-compatibility-window',
        env: { QUESTION_ENGINE_WORKER_VERSION: fromVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: `${fromVersion},${toVersion}` },
        commands: [`${prefix} up -d --force-recreate backend`, probe]
      },
      {
        id: 'upgrade-worker',
        env: { QUESTION_ENGINE_WORKER_VERSION: toVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: `${fromVersion},${toVersion}` },
        commands: [`${prefix} up -d --build --force-recreate question-engine-worker`, probe]
      },
      {
        id: 'close-compatibility-window',
        env: { QUESTION_ENGINE_WORKER_VERSION: toVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: toVersion },
        commands: [`${prefix} up -d --force-recreate backend`, probe]
      }
    ],
    rollback: {
      env: { QUESTION_ENGINE_WORKER_VERSION: fromVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: `${fromVersion},${toVersion}` },
      commands: [
        `${prefix} up -d --force-recreate backend`,
        `${prefix} up -d --build --force-recreate question-engine-worker`,
        probe
      ],
      finalizeEnv: { QUESTION_ENGINE_WORKER_VERSION: fromVersion, QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: fromVersion },
      finalizeCommands: [`${prefix} up -d --force-recreate backend`, probe]
    }
  };
}

function printHuman(plan) {
  console.log(`# Question-engine sidecar rollout rehearsal: ${plan.inputs.fromVersion} -> ${plan.inputs.toVersion}`);
  console.log('# PLAN ONLY: no command was executed; keep QUESTION_ENGINE_EXECUTION_MODE=in-process.');
  for (const phase of plan.phases) {
    console.log(`\n## ${phase.id}`);
    for (const [key, value] of Object.entries(phase.env)) console.log(`${key}=${value}`);
    for (const command of phase.commands) console.log(command);
  }
  console.log('\n## rollback');
  for (const [key, value] of Object.entries(plan.rollback.env)) console.log(`${key}=${value}`);
  for (const command of plan.rollback.commands) console.log(command);
  console.log('\n## rollback-finalize');
  for (const [key, value] of Object.entries(plan.rollback.finalizeEnv)) console.log(`${key}=${value}`);
  for (const command of plan.rollback.finalizeCommands) console.log(command);
}

function main() {
  const args = process.argv.slice(2);
  const plan = buildQuestionEngineSidecarRolloutPlan({
    fromVersion: valueArg(args, 'from', '1.0.0'),
    toVersion: valueArg(args, 'to', '1.1.0'),
    project: valueArg(args, 'project', 'moodlelike-demo'),
    envFile: valueArg(args, 'env-file', '.env'),
    composeFile: valueArg(args, 'compose-file', 'deploy/docker-compose.prod.yml')
  });
  if (args.includes('--json')) console.log(JSON.stringify(plan, null, 2));
  else printHuman(plan);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildQuestionEngineSidecarRolloutPlan };
