const { spawn } = require('node:child_process');
const net = require('node:net');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);

function parsePort(url) {
  const parsed = new URL(url);
  if (parsed.port) return Number(parsed.port);
  return parsed.protocol === 'https:' ? 443 : 80;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPortOpen(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 120)}`);
  }

  assert(
    response.status === expectedStatus,
    `${path} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${text.slice(0, 200)}`
  );
  return body;
}

async function waitForHealth(child) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend process exited before smoke checks could run with code ${child.exitCode}.`);
    }

    try {
      const health = await readJson('/api/v1/health');
      if (health.status === 'ok') return;
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Backend did not become healthy within ${startupTimeoutMs}ms. Last error: ${lastError?.message}`);
}

async function runChecks() {
  const health = await readJson('/api/v1/health');
  assert(health.status === 'ok', '/api/v1/health must return status "ok".');

  const ready = await readJson('/api/v1/ops/ready');
  assert(['ready', 'degraded'].includes(ready.status), '/api/v1/ops/ready must return ready or degraded.');
  assert(ready.checks?.app === true, '/api/v1/ops/ready must report app readiness.');

  const content = await readJson('/api/v1/content/home');
  assert(Array.isArray(content.items), '/api/v1/content/home must return an items array.');
  assert(content.items.length >= 7, '/api/v1/content/home must include at least seven V1 content blocks.');
  for (const key of ['home.hero', 'home.requirements', 'home.subjects', 'home.prep', 'home.practice', 'home.library', 'home.closing']) {
    assert(content.items.some((item) => item.key === key), `/api/v1/content/home is missing ${key}.`);
  }

  const search = await readJson('/api/v1/search?q=csca');
  assert(Array.isArray(search.items), '/api/v1/search?q=csca must return an items array.');
  assert(search.groups && typeof search.groups === 'object', '/api/v1/search?q=csca must return groups.');
  assert(typeof search.total === 'number', '/api/v1/search?q=csca must return total.');
  assert(typeof search.degraded === 'boolean', '/api/v1/search?q=csca must return degraded flag.');
  assert(!search.items.some((item) => String(item.href ?? '').startsWith('/schools')), 'Site search must not surface retired school pages.');
  assert(!('school' in search.groups), 'Site search groups must not include the retired school category.');

  const mockOverview = await readJson('/api/v1/csca-mock-exam/overview');
  assert(Array.isArray(mockOverview.subjectCards), '/api/v1/csca-mock-exam/overview must return subjectCards.');
  assert(mockOverview.subjectCards.some((item) => item.id === 'math'), '/api/v1/csca-mock-exam/overview must include math.');

  for (const subject of ['math', 'physics', 'chemistry']) {
    const subjectPapers = await readJson(`/api/v1/csca-mock-exam/subjects/${subject}`);
    assert(Array.isArray(subjectPapers.papers), `/api/v1/csca-mock-exam/subjects/${subject} must return papers.`);
    const freePaper = subjectPapers.papers.find((paper) => paper.isFree && !paper.isLocked);
    assert(freePaper?.slug, `/api/v1/csca-mock-exam/subjects/${subject} must include an unlocked free paper.`);
    assert(freePaper.questionCount === 48, `/api/v1/csca-mock-exam/subjects/${subject} free paper must expose 48 questions.`);

    const start = await readJson(`/api/v1/csca-mock-exam/papers/${freePaper.slug}/start`);
    assert(start.locked === false, '/api/v1/csca-mock-exam/papers/:slug/start must mark the free paper as unlocked.');
    assert(start.paper?.slug === freePaper.slug, '/api/v1/csca-mock-exam/papers/:slug/start must return the requested paper.');
  }

  const specialOverview = await readJson('/api/v1/csca-special-practice/overview');
  assert(Array.isArray(specialOverview.subjects), '/api/v1/csca-special-practice/overview must return subjects.');
  assert(specialOverview.subjects.some((item) => item.id === 'math'), '/api/v1/csca-special-practice/overview must include math.');

  const specialMath = await readJson('/api/v1/csca-special-practice/subjects/math');
  assert(Array.isArray(specialMath.modules), '/api/v1/csca-special-practice/subjects/math must return modules.');
  const firstTopic = specialMath.modules.flatMap((item) => item.topics ?? [])[0];
  assert(firstTopic?.slug, '/api/v1/csca-special-practice/subjects/math must include at least one topic.');

  const specialStart = await readJson(`/api/v1/csca-special-practice/topics/${firstTopic.slug}/start`);
  assert(specialStart.topic?.slug === firstTopic.slug, '/api/v1/csca-special-practice/topics/:slug/start must return the requested topic.');
  if (specialStart.availability?.isAvailable) {
    assert(specialStart.questionPreviewCount >= 1, '/api/v1/csca-special-practice/topics/:slug/start must expose a positive question count when available.');
  } else {
    assert(specialStart.availability?.code, '/api/v1/csca-special-practice/topics/:slug/start must explain unavailable special practice banks.');
  }
}

async function main() {
  const port = parsePort(baseUrl);
  if (await isPortOpen(port)) {
    throw new Error(`Smoke check expected to start the built backend, but port ${port} is already in use.`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`));

  try {
    await waitForHealth(child);
    await runChecks();
    console.log('CSCAlite endpoint smoke check passed.');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

main().catch((error) => {
  console.error(`CSCAlite smoke check failed: ${error.message}`);
  process.exit(1);
});
