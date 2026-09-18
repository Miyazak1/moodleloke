const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const root = path.resolve(__dirname, '..');
const localRoot = path.join(root, '.local');
const reportRoot = path.join(localRoot, 'agent-demo-release');
const credentialsPath = path.join(localRoot, 'agent-demo-credentials.json');
const requiredFixtures = [
  path.join(localRoot, 'agent-demo-fixtures', 'handwritten-function-answer.png'),
  path.join(localRoot, 'agent-demo-fixtures', 'function-answer.pdf')
];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;

function assert(value, message) {
  if (!value) throw new Error(message);
}

function parseArguments(argv) {
  const repetitionArgument = argv.find((item) => item.startsWith('--repetitions='));
  const configured = repetitionArgument?.split('=')[1] ?? process.env.AGENT_DEMO_RELEASE_REPETITIONS ?? '5';
  const repetitions = Number(configured);
  assert(Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 5, 'Repetitions must be an integer from 1 to 5.');
  return {
    execute: argv.includes('--execute'),
    selfTest: argv.includes('--self-test'),
    repetitions,
    resetEachRun: !argv.includes('--no-reset')
  };
}

function stagePlan(repetitions, resetEachRun) {
  const stages = [{ id: 'preflight', path: 'preflight', command: node, args: ['scripts/agent-demo-gate.cjs'] }];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    if (resetEachRun) {
      stages.push({ id: `reset-g1-${repetition}`, repetition, path: 'reset', command: node, args: ['scripts/agent-demo-seed.cjs', '--apply'] });
    }
    if (repetition === 1) stages.push({ id: 'session', repetition, path: 'session', internal: true });
    stages.push(
      { id: `g1-domain-${repetition}`, repetition, path: 'G1', command: node, args: ['scripts/agent-practice-assistance-live.cjs'] },
      { id: `g1-browser-${repetition}`, repetition, path: 'G1', command: npm, args: ['--prefix', 'frontend', 'run', 'test:e2e:agent:live'] }
    );
    if (resetEachRun) stages.push({ id: `reset-g2-${repetition}`, repetition, path: 'reset', command: node, args: ['scripts/agent-demo-seed.cjs', '--apply'] });
    stages.push({ id: `g2-attachment-${repetition}`, repetition, path: 'G2', command: npm, args: ['--prefix', 'frontend', 'run', 'test:e2e:agent:attachment:live'] });
    if (resetEachRun) stages.push({ id: `reset-g3-${repetition}`, repetition, path: 'reset', command: node, args: ['scripts/agent-demo-seed.cjs', '--apply'] });
    stages.push({ id: `g3-handwriting-${repetition}`, repetition, path: 'G3', command: npm, args: ['--prefix', 'frontend', 'run', 'test:e2e:agent:handwriting:live'] });
  }
  return stages;
}

async function createDemoSession() {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const backendUrl = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';
  const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await response.text();
  assert(response.ok, `Demo session login returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  const result = text ? JSON.parse(text) : {};
  assert(result.tokens?.accessToken, 'Demo session login did not return an access token.');
  return result.tokens.accessToken;
}

async function request(url, expectedContent) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  } catch (error) {
    throw new Error(`Cannot reach ${url}: ${error.message || error}`);
  }
  const text = await response.text();
  assert(response.ok, `${url} returned HTTP ${response.status}.`);
  if (expectedContent) assert(expectedContent.test(text), `${url} did not return the expected application content.`);
  return { url, status: response.status };
}

async function preflightFilesAndServices(resetEachRun) {
  if (!resetEachRun) {
    assert(fs.existsSync(credentialsPath), 'Missing demo credentials. Run node scripts/agent-demo-seed.cjs --apply.');
    requiredFixtures.forEach((filename) => assert(fs.existsSync(filename), `Missing demo fixture: ${path.relative(root, filename)}`));
  }
  const backendUrl = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';
  const frontendUrl = process.env.AGENT_DEMO_FRONTEND_URL || 'http://localhost:5187';
  const backend = await request(`${backendUrl}/api/v1/health`, /"status"\s*:\s*"ok"/);
  const frontend = await request(`${frontendUrl}/zh/agent`, /<html|<!doctype/i);
  return { backend, frontend, resetWillPrepareFixtures: resetEachRun, credentials: path.relative(root, credentialsPath), fixtures: requiredFixtures.map((item) => path.relative(root, item)) };
}

function runStage(stage, accessToken) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(stage.command, stage.args, {
      cwd: root,
      env: { ...process.env, ...(accessToken ? { AGENT_DEMO_ACCESS_TOKEN: accessToken } : {}), FORCE_COLOR: '0', NO_COLOR: '1' },
      windowsHide: true,
      shell: process.platform === 'win32' && stage.command === npm,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 200_000) output = output.slice(-200_000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill(), 8 * 60_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ...stage, status: 'failed', startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt.getTime(), exitCode: null, outputTail: String(error.message || error).slice(-4_000) });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        ...stage,
        status: code === 0 ? 'passed' : 'failed',
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        exitCode: code,
        signal: signal || null,
        outputTail: output.trim().slice(-4_000)
      });
    });
  });
}

function emptyEphemeralMetrics() {
  return { agentRuns: { total: 0, completed: 0, failed: 0 }, analyses: { total: 0, completed: 0, failed: 0 } };
}

function addEphemeralMetrics(target, source) {
  for (const group of ['agentRuns', 'analyses']) {
    for (const field of ['total', 'completed', 'failed']) target[group][field] += source[group][field];
  }
}

async function collectEphemeralMetrics() {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: credentials.email }, select: { id: true } });
    assert(user, 'Demo user is missing during rehearsal.');
    const [runs, analyses] = await Promise.all([
      prisma.agentRun.findMany({ where: { userId: user.id }, select: { status: true } }),
      prisma.agentAttachmentAnalysis.findMany({ where: { userId: user.id }, select: { status: true } })
    ]);
    return {
      agentRuns: { total: runs.length, completed: runs.filter((item) => item.status === 'completed').length, failed: runs.filter((item) => item.status === 'failed').length },
      analyses: { total: analyses.length, completed: analyses.filter((item) => item.status === 'completed').length, failed: analyses.filter((item) => item.status === 'failed').length }
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function collectMetrics(startedAt, ephemeralMetrics) {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: credentials.email }, select: { id: true } });
    assert(user, 'Demo user is missing after rehearsal.');
    const [calls, runs, analyses] = await Promise.all([
      prisma.aiGatewayCallLog.findMany({
        where: { userId: user.id, createdAt: { gte: startedAt } },
        select: { providerId: true, model: true, sourceModule: true, status: true, latencyMs: true, promptTokens: true, completionTokens: true, totalTokens: true, estimatedCost: true }
      }),
      prisma.agentRun.findMany({ where: { userId: user.id, createdAt: { gte: startedAt } }, select: { status: true } }),
      prisma.agentAttachmentAnalysis.findMany({ where: { userId: user.id, createdAt: { gte: startedAt } }, select: { status: true, intent: true } })
    ]);
    const byModel = {};
    const bySource = {};
    for (const call of calls) {
      const modelKey = `${call.providerId}/${call.model}`;
      byModel[modelKey] = (byModel[modelKey] || 0) + 1;
      bySource[call.sourceModule] = (bySource[call.sourceModule] || 0) + 1;
    }
    return {
      agentRuns: ephemeralMetrics?.agentRuns || { total: runs.length, completed: runs.filter((item) => item.status === 'completed').length, failed: runs.filter((item) => item.status === 'failed').length },
      analyses: ephemeralMetrics?.analyses || { total: analyses.length, completed: analyses.filter((item) => item.status === 'completed').length, failed: analyses.filter((item) => item.status === 'failed').length },
      gateway: {
        calls: calls.length,
        successful: calls.filter((item) => item.status === 'success').length,
        failed: calls.filter((item) => item.status !== 'success').length,
        promptTokens: calls.reduce((sum, item) => sum + Number(item.promptTokens || 0), 0),
        completionTokens: calls.reduce((sum, item) => sum + Number(item.completionTokens || 0), 0),
        totalTokens: calls.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0),
        estimatedCostUsd: Number(calls.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0).toFixed(8)),
        maximumLatencyMs: calls.reduce((maximum, item) => Math.max(maximum, item.latencyMs), 0),
        byModel,
        bySource
      }
    };
  } finally {
    await prisma.$disconnect();
  }
}

function markdown(report) {
  const pathRows = ['G1', 'G2', 'G3'].map((pathName) => {
    const rows = report.stages.filter((item) => item.path === pathName);
    return `| ${pathName} | ${rows.filter((item) => item.status === 'passed').length}/${rows.length} | ${rows.reduce((sum, item) => sum + item.durationMs, 0)} |`;
  }).join('\n');
  return `# Moodlelike Agent DEMO-V1 Release Gate\n\n- Verdict: **${report.verdict.toUpperCase()}**\n- Started: ${report.startedAt}\n- Completed: ${report.completedAt}\n- Repetitions: ${report.repetitions}\n- Reset each run: ${report.resetEachRun}\n- Commit: ${report.git.commit}\n\n| Path | Passed | Duration ms |\n|---|---:|---:|\n${pathRows}\n\n## Runtime metrics\n\n\`\`\`json\n${JSON.stringify(report.metrics, null, 2)}\n\`\`\`\n\n## Failed stage\n\n${report.failedStage ? `\`${report.failedStage.id}\`: ${report.failedStage.outputTail}` : 'None.'}\n`;
}

function saveReport(report) {
  fs.mkdirSync(reportRoot, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(reportRoot, `release-gate-${stamp}.json`);
  const markdownPath = path.join(reportRoot, `release-gate-${stamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown(report));
  return { jsonPath, markdownPath };
}

function gitSnapshot() {
  const { execFileSync } = require('node:child_process');
  const read = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  return { branch: read(['branch', '--show-current']), commit: read(['rev-parse', '--short', 'HEAD']), dirty: Boolean(read(['status', '--porcelain'])) };
}

function selfTest() {
  const parsed = parseArguments(['--execute', '--repetitions=2']);
  assert(parsed.execute && parsed.repetitions === 2 && parsed.resetEachRun, 'Argument parsing failed.');
  const stages = stagePlan(2, true);
  assert(stages.filter((item) => item.path === 'G1').length === 4, 'G1 must contain domain and browser checks for each repetition.');
  assert(stages.filter((item) => item.path === 'G2').length === 2, 'G2 repetition plan is incomplete.');
  assert(stages.filter((item) => item.path === 'G3').length === 2, 'G3 repetition plan is incomplete.');
  assert(stages.filter((item) => item.path === 'session').length === 1, 'The release gate must reuse one authenticated session.');
  assert(stages.filter((item) => item.path === 'reset').length === 6, 'Every golden path must start from the deterministic demo baseline.');
  assert(markdown({ verdict: 'pass', startedAt: 'a', completedAt: 'b', repetitions: 1, resetEachRun: true, git: { commit: 'test' }, stages: [], metrics: {}, failedStage: null }).includes('DEMO-V1'), 'Markdown rendering failed.');
  console.log(JSON.stringify({ verdict: 'pass', suite: 'agent-demo-release-gate-self-test', stages: stages.length }));
}

async function execute(options) {
  const startedAt = new Date();
  const report = {
    schemaVersion: '1',
    suite: 'agent-demo-release-gate-v1',
    verdict: 'running',
    startedAt: startedAt.toISOString(),
    completedAt: null,
    repetitions: options.repetitions,
    resetEachRun: options.resetEachRun,
    git: gitSnapshot(),
    preflight: null,
    stages: [],
    metrics: null,
    failedStage: null
  };
  let accessToken = process.env.AGENT_DEMO_ACCESS_TOKEN || '';
  const observed = emptyEphemeralMetrics();
  try {
    report.preflight = await preflightFilesAndServices(options.resetEachRun);
    for (const stage of stagePlan(options.repetitions, options.resetEachRun)) {
      console.log(`[${report.stages.length + 1}] ${stage.id} started`);
      let result;
      if (stage.internal === true) {
        const started = new Date();
        try {
          accessToken = accessToken || await createDemoSession();
          result = { ...stage, status: 'passed', startedAt: started.toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started.getTime(), exitCode: 0, signal: null, outputTail: 'Authenticated session acquired once and reused without exposing the token.' };
        } catch (error) {
          result = { ...stage, status: 'failed', startedAt: started.toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started.getTime(), exitCode: 1, signal: null, outputTail: String(error.message || error).slice(-4_000) };
        }
      } else {
        result = await runStage(stage, accessToken);
      }
      report.stages.push(result);
      console.log(`[${result.status.toUpperCase()}] ${stage.id} (${result.durationMs}ms)`);
      if (result.status !== 'passed') {
        report.failedStage = result;
        throw new Error(`${stage.id} failed: ${result.outputTail}`);
      }
      if (/^g1-browser-|^g2-attachment-|^g3-handwriting-/.test(stage.id)) {
        addEphemeralMetrics(observed, await collectEphemeralMetrics());
      }
    }
    report.metrics = await collectMetrics(startedAt, observed);
    assert(report.metrics.agentRuns.failed === 0, 'At least one Agent run failed during the release gate.');
    assert(report.metrics.analyses.failed === 0, 'At least one attachment analysis failed during the release gate.');
    assert(report.metrics.gateway.failed === 0, 'At least one AI Gateway call failed during the release gate.');
    report.verdict = 'pass';
  } catch (error) {
    report.verdict = 'fail';
    report.error = String(error.message || error);
    try { report.metrics = await collectMetrics(startedAt, observed); } catch (metricsError) { report.metricsError = String(metricsError.message || metricsError); }
  }
  report.completedAt = new Date().toISOString();
  const paths = saveReport(report);
  console.log(JSON.stringify({ verdict: report.verdict, report: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(root, value)])), metrics: report.metrics }, null, 2));
  if (report.verdict !== 'pass') process.exitCode = 1;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.selfTest) return selfTest();
  if (!options.execute) {
    console.log(JSON.stringify({ suite: 'agent-demo-release-gate-v1', mode: 'plan', repetitions: options.repetitions, resetEachRun: options.resetEachRun, stages: stagePlan(options.repetitions, options.resetEachRun).map(({ id, path: pathName }) => ({ id, path: pathName })) }, null, 2));
    console.log('Run with --execute to start the real DEMO-V1 gate. This calls the configured model API and writes a local report.');
    return;
  }
  await execute(options);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
