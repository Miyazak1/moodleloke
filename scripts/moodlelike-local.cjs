const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadRootEnv } = require('../backend/scripts/load-root-env.cjs');

loadRootEnv();

const root = path.resolve(__dirname, '..');
const command = process.argv[2] || 'start';
const onWindows = process.platform === 'win32';
const npmCommand = onWindows ? 'npm.cmd' : 'npm';
const dockerCommand = onWindows ? 'docker.exe' : 'docker';
const backendUrl = 'http://localhost:3100';
const frontendUrl = 'http://localhost:5190';
const localDirectory = path.join(root, '.local');
const demoCredentialPath = path.join(localDirectory, 'agent-demo-credentials.json');
const demoSessionPath = path.join(localDirectory, 'agent-demo-session.json');
const runtimeEnv = {
  ...process.env,
  NODE_ENV: 'development',
  MOODLELIKE_ENV: 'development',
  PORT: '3100',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:56432/moodlelike?schema=public',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:57379',
  AUTH_SECRET: process.env.AUTH_SECRET || 'moodlelike-local-development-secret-change-before-production',
  CORS_ORIGINS: process.env.CORS_ORIGINS || frontendUrl,
  PUBLIC_APP_ORIGIN: process.env.PUBLIC_APP_ORIGIN || frontendUrl,
  PUBLIC_API_ORIGIN: process.env.PUBLIC_API_ORIGIN || backendUrl,
  VITE_API_BASE_URL: backendUrl,
  VITE_STANDALONE_AGENT: '1',
  MOODLELIKE_HOST_INTEGRATION_MODE: 'standalone',
  MOODLELIKE_HOST_CONTRACT_VERSION: 'cscalite-agent-host-v1',
  AGENT_WEB_ENABLED: 'true',
  VITE_AGENT_WEB_ENABLED: 'true',
  VITE_AGENT_DISABLED_REDIRECT_URL: '/',
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_TARGET_GAP_ENABLED: 'true',
  CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'true',
  CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true',
  CSCA_AGENT_TEACHING_ASSET_ENABLED: 'true',
  CSCA_AI_QUESTION_GENERATION_ENABLED: 'false',
  CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'false',
  CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'false',
  CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED: 'false'
};

function fail(message) { throw new Error(message); }

class HttpResponseError extends Error {
  constructor(url, status, text) {
    super(url + ' returned HTTP ' + status + ': ' + text.slice(0, 200));
    this.name = 'HttpResponseError';
    this.status = status;
  }
}

function run(label, executable, args, options = {}) {
  process.stdout.write('[moodlelike] ' + label + '\n');
  const result = spawnSync(executable, args, {
    cwd: options.cwd || root,
    env: runtimeEnv,
    stdio: 'inherit',
    shell: options.shell ?? (onWindows && /\.cmd$/i.test(executable))
  });
  if (result.error) fail(label + ' failed: ' + result.error.message);
  if ((result.status ?? 1) !== 0) fail(label + ' exited with code ' + result.status + '.');
}

function probe(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, env: runtimeEnv, encoding: 'utf8', shell: onWindows && /\.cmd$/i.test(executable) });
  return { ok: !result.error && result.status === 0, output: String(result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] || null };
}

function dependencyState() {
  return {
    root: fs.existsSync(path.join(root, 'node_modules', '.package-lock.json')),
    backend: fs.existsSync(path.join(root, 'backend', 'node_modules', '.package-lock.json')),
    frontend: fs.existsSync(path.join(root, 'frontend', 'node_modules', '.package-lock.json'))
  };
}

function doctor() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const npm = probe(npmCommand, ['--version']);
  const docker = probe(dockerCommand, ['version', '--format', '{{.Server.Version}}']);
  const compose = probe(dockerCommand, ['compose', 'version', '--short']);
  const dependencies = dependencyState();
  const report = { schemaVersion: '1', node: process.versions.node, nodeSupported: nodeMajor === 22, npm, docker, compose, dependencies };
  console.log(JSON.stringify(report, null, 2));
  if (!report.nodeSupported) fail('Node.js 22 is required.');
  if (!npm.ok) fail('npm is not available.');
  if (!docker.ok || !compose.ok) fail('Docker Desktop with Compose is required and must be running.');
  return report;
}

function ensureDependencies() {
  const state = dependencyState();
  if (!state.root) run('installing root dependencies', npmCommand, ['ci']);
  if (!state.backend) run('installing backend dependencies', npmCommand, ['ci', '--prefix', 'backend']);
  if (!state.frontend) run('installing frontend dependencies', npmCommand, ['ci', '--prefix', 'frontend']);
}

function setup() {
  if (runtimeEnv.NODE_ENV === 'production' || runtimeEnv.MOODLELIKE_ENV === 'production' || runtimeEnv.CSC_ENV === 'production') fail('Local setup is disabled in production mode.');
  doctor();
  ensureDependencies();
  run('starting isolated PostgreSQL and Redis', dockerCommand, ['compose', 'up', '-d', '--wait', 'postgres', 'redis']);
  run('applying committed database migrations', npmCommand, ['run', 'db:migrate']);
  run('building stable backend runtime', npmCommand, ['run', 'backend:build']);
  run('creating idempotent local demo evidence', process.execPath, [path.join(root, 'scripts', 'agent-demo-seed.cjs'), '--apply']);
  run('publishing reviewed teaching visualizers', npmCommand, ['--prefix', 'backend', 'run', 'seed:teaching-assets']);
  console.log('[moodlelike] local setup complete; no CSCALite database or volume was used.');
}

async function response(url, options = {}) {
  const result = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeoutMs || 10000) });
  const text = await result.text();
  let body = text;
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!result.ok) throw new HttpResponseError(url, result.status, text);
  return body;
}

function integrationPreflight() {
  run('running non-destructive integration preflight', process.execPath, ['scripts/moodlelike-integration-preflight.cjs']);
}

function integrationProbe(kind) {
  run(`running read-only ${kind} integration probe`, process.execPath, ['scripts/moodlelike-integration-preflight.cjs', `--probe-${kind}`]);
}

async function reachable(url) {
  try { await response(url, { timeoutMs: 1500 }); return true; } catch { return false; }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail('Timed out waiting for ' + url);
}

async function verifyRuntimeShell() {
  const health = await response(backendUrl + '/api/v1/health');
  if (health.status !== 'ok' || health.service !== 'moodlelike-backend') fail('Unexpected backend identity or health response.');
  const html = await response(frontendUrl + '/agent');
  if (typeof html !== 'string' || !/<html|<!doctype/i.test(html)) fail('Frontend Agent route did not return an HTML shell.');
  return health;
}

function readDemoSession(expectedEmail) {
  try {
    const session = JSON.parse(fs.readFileSync(demoSessionPath, 'utf8'));
    if (session.email !== expectedEmail || typeof session.accessToken !== 'string' || !session.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

function writeDemoSession(email, accessToken) {
  fs.mkdirSync(localDirectory, { recursive: true });
  const temporaryPath = demoSessionPath + '.tmp';
  fs.writeFileSync(temporaryPath, JSON.stringify({ schemaVersion: '1', email, accessToken }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, demoSessionPath);
}

async function authenticatedDemo(credentials) {
  const cached = readDemoSession(credentials.email);
  if (cached) {
    try {
      const headers = { authorization: 'Bearer ' + cached.accessToken };
      const me = await response(backendUrl + '/api/v1/auth/me', { headers });
      return { headers, me, source: 'cached-session' };
    } catch (error) {
      if (!(error instanceof HttpResponseError) || (error.status !== 401 && error.status !== 403)) throw error;
      try { fs.unlinkSync(demoSessionPath); } catch {}
    }
  }

  const login = await response(backendUrl + '/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials)
  });
  const token = login.tokens && login.tokens.accessToken;
  if (!token) fail('Demo login did not return an access token.');
  writeDemoSession(credentials.email, token);
  const headers = { authorization: 'Bearer ' + token };
  const me = await response(backendUrl + '/api/v1/auth/me', { headers });
  return { headers, me, source: 'new-login' };
}

async function verify() {
  const health = await verifyRuntimeShell();
  if (!fs.existsSync(demoCredentialPath)) fail('Demo credentials are missing. Run npm run local:setup.');
  const credentials = JSON.parse(fs.readFileSync(demoCredentialPath, 'utf8'));
  let authenticated;
  try {
    authenticated = await authenticatedDemo(credentials);
  } catch (error) {
    if (error instanceof HttpResponseError && error.status === 429) {
      fail('Demo login is temporarily rate-limited by earlier verification attempts. The services are healthy; wait for the 15-minute auth window or restart the local backend once. Future checks reuse a cached session.');
    }
    throw error;
  }
  const { headers, me, source } = authenticated;
  await response(backendUrl + '/api/v1/agent/conversations', { headers });
  const report = { schemaVersion: '1', verdict: 'pass', backend: health.service, database: 'reachable-through-authenticated-demo', frontend: 'agent-shell-ok', demoUser: me.email || credentials.email, authentication: source };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function start() {
  const backendUp = await reachable(backendUrl + '/api/v1/health');
  const frontendUp = await reachable(frontendUrl + '/agent');
  if (backendUp && frontendUp) {
    await verifyRuntimeShell();
    console.log('[moodlelike] services were already running and are healthy; skipped setup and rebuild, and did not repeat the demo login.');
    return;
  }

  if (!backendUp && !frontendUp) {
    setup();
  } else {
    console.log('[moodlelike] one service is already healthy; reusing it and starting only the missing service.');
  }

  const children = [];
  if (!backendUp) children.push({ name: 'backend', process: spawn(npmCommand, ['--prefix', 'backend', 'run', 'start:prod'], { cwd: root, env: runtimeEnv, stdio: 'inherit', shell: onWindows }) });
  if (!frontendUp) children.push({ name: 'frontend', process: spawn(npmCommand, ['run', 'frontend:dev'], { cwd: root, env: runtimeEnv, stdio: 'inherit', shell: onWindows }) });
  const stop = () => children.forEach((child) => { if (!child.process.killed) child.process.kill('SIGTERM'); });
  process.once('SIGINT', () => { stop(); process.exit(130); });
  process.once('SIGTERM', () => { stop(); process.exit(143); });
  const earlyExit = new Promise((_, reject) => children.forEach((child) => child.process.once('exit', (code) => reject(new Error(child.name + ' exited early with code ' + code)))));
  try {
    await Promise.race([Promise.all([waitFor(backendUrl + '/api/v1/health', 90000), waitFor(frontendUrl + '/agent', 90000)]), earlyExit]);
    await verify();
    console.log('[moodlelike] ready: ' + frontendUrl + '/agent');
    await earlyExit;
  } finally {
    stop();
  }
}

Promise.resolve()
  .then(() => {
    if (command === 'doctor') return doctor();
    if (command === 'setup') return setup();
    if (command === 'verify') return verify();
    if (command === 'preflight') return integrationPreflight();
    if (command === 'probe-database') return integrationProbe('database');
    if (command === 'probe-deepseek') return integrationProbe('deepseek');
    if (command === 'start') return start();
    fail('Unknown command: ' + command + '. Use doctor, setup, preflight, probe-database, probe-deepseek, start, or verify.');
  })
  .catch((error) => { console.error('[moodlelike] ' + (error.message || error)); process.exitCode = 1; });
