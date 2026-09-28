const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function bool(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function configured(value) {
  const text = String(value ?? '').trim();
  return Boolean(text) && !/^(replace|replaceme|change-me|user:password|https:\/\/www\.example)/i.test(text);
}

function keyCount(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean).filter((item) => !/^replace/i.test(item)).length;
}

function firstValue(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) || '';
}

function evaluateQuestionEngine(env, options = {}) {
  const expectedMode = options.expectedMode || 'inactive';
  const checks = [];
  const add = (id, condition, message) => checks.push({ id, status: condition ? 'pass' : 'block', message });
  const hostEnabled = bool(env.QUESTION_ENGINE_PLUGIN_ENABLED);
  const generationRequested = bool(env.CSCA_AI_QUESTION_GENERATION_ENABLED)
    || bool(env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED)
    || bool(env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED);
  const reviewRequested = bool(env.CSCA_AI_QUESTION_REVIEW_ENABLED);
  const topicRequested = env.CSCA_AI_TOPIC_MAPPING_ENABLED === undefined
    ? generationRequested || reviewRequested
    : bool(env.CSCA_AI_TOPIC_MAPPING_ENABLED);
  const requiredCapabilities = [
    generationRequested ? 'question.generate' : null,
    reviewRequested ? 'question.review' : null,
    topicRequested ? 'question.topic-map' : null
  ].filter(Boolean);
  const activationRequested = hostEnabled || requiredCapabilities.length > 0;
  const executionMode = String(env.QUESTION_ENGINE_EXECUTION_MODE || 'in-process').trim();

  if (expectedMode === 'inactive') {
    add('question_engine_inactive', !activationRequested, 'Student runtime must keep the automatic-question plugin and production capabilities disabled.');
  } else {
    add('question_engine_execution_mode', ['in-process', 'sidecar'].includes(executionMode), 'Question-engine execution mode must be in-process or sidecar.');
    add('question_engine_host_enabled', hostEnabled, 'Question-engine production requires QUESTION_ENGINE_PLUGIN_ENABLED=true.');
    add('question_engine_plugin_selected', env.QUESTION_ENGINE_PLUGIN_ID === 'moodlelike-ai-questioning', 'Select the registered moodlelike-ai-questioning adapter.');
    add('question_engine_capability_selected', requiredCapabilities.length > 0, 'Enable at least one explicit question-engine capability.');

    const capabilityConfig = {
      'question.generate': {
        provider: firstValue(env.AI_DEFAULT_PROVIDER, env.CSCA_AI_QUESTION_GENERATION_PROVIDER, env.CSCA_AI_PROVIDER, 'rule-fallback'),
        model: firstValue(env.CSCA_AI_QUESTION_GENERATION_MODEL, env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL, env.DEEPSEEK_DEFAULT_MODEL, env.CSCA_AI_MODEL),
        keys: firstValue(env.CSCA_AI_QUESTION_GENERATION_API_KEY, env.CSCA_AI_API_KEY, env.DEEPSEEK_BACKGROUND_API_KEYS, env.DEEPSEEK_API_KEYS)
      },
      'question.review': {
        provider: firstValue(env.AI_DEFAULT_PROVIDER, env.CSCA_AI_QUESTION_REVIEW_PROVIDER, env.CSCA_AI_PROVIDER, 'rule-fallback'),
        model: firstValue(env.CSCA_AI_QUESTION_REVIEW_MODEL, env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL, env.DEEPSEEK_DEFAULT_MODEL, env.CSCA_AI_MODEL),
        keys: firstValue(env.CSCA_AI_QUESTION_REVIEW_API_KEY, env.CSCA_AI_API_KEY, env.DEEPSEEK_BACKGROUND_API_KEYS, env.DEEPSEEK_API_KEYS)
      },
      'question.topic-map': {
        provider: firstValue(env.AI_DEFAULT_PROVIDER, env.CSCA_AI_TOPIC_MAPPING_PROVIDER, env.CSCA_AI_QUESTION_REVIEW_PROVIDER, env.CSCA_AI_PROVIDER, 'rule-fallback'),
        model: firstValue(env.CSCA_AI_TOPIC_MAPPING_MODEL, env.CSCA_AI_QUESTION_REVIEW_MODEL, env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL, env.DEEPSEEK_DEFAULT_MODEL, env.CSCA_AI_MODEL),
        keys: firstValue(env.CSCA_AI_TOPIC_MAPPING_API_KEY, env.CSCA_AI_QUESTION_REVIEW_API_KEY, env.CSCA_AI_API_KEY, env.DEEPSEEK_BACKGROUND_API_KEYS, env.DEEPSEEK_API_KEYS)
      }
    };
    for (const capability of requiredCapabilities) {
      const config = capabilityConfig[capability];
      const id = capability.replace(/[^a-z0-9]+/gi, '_');
      add(`${id}_provider`, ['deepseek', 'openai', 'openai-compatible'].includes(config.provider), `${capability} requires a supported external provider.`);
      add(`${id}_model`, Boolean(config.model), `${capability} requires a model.`);
      add(`${id}_key`, configured(config.keys), `${capability} requires a non-placeholder server-side provider key.`);
    }
    if (generationRequested) {
      add('question_generate_runner', bool(env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED) || bool(env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED), 'question.generate requires an explicit production runner.');
    }
    if (executionMode === 'sidecar') {
      add('question_engine_sidecar_endpoint', configured(env.QUESTION_ENGINE_SIDECAR_URL), 'Sidecar mode requires QUESTION_ENGINE_SIDECAR_URL.');
      add('question_engine_task_secret', configured(env.QUESTION_ENGINE_TASK_HMAC_SECRET) && String(env.QUESTION_ENGINE_TASK_HMAC_SECRET).length >= 32, 'Sidecar mode requires a non-placeholder task HMAC secret of at least 32 characters.');
      add('question_engine_task_key_id', /^[a-z0-9._-]{1,64}$/i.test(String(env.QUESTION_ENGINE_TASK_KEY_ID || '').trim()), 'Sidecar mode requires a stable task signing key id.');
      add('question_engine_nonce_store', configured(env.QUESTION_ENGINE_NONCE_REDIS_URL || env.REDIS_URL), 'Sidecar mode requires a shared Redis nonce store.');
      add('question_engine_sidecar_activation', bool(env.QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED), 'Sidecar mode requires explicit QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=true.');
      const acceptedWorkerVersions = String(env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS || '').split(',').map((value) => value.trim()).filter(Boolean);
      add('question_engine_worker_version_policy', acceptedWorkerVersions.length > 0 && acceptedWorkerVersions.every((value) => /^[a-z0-9._+-]{1,64}$/i.test(value)), 'Sidecar mode requires at least one accepted Worker version.');
      const workerCapabilities = new Set(String(env.QUESTION_ENGINE_WORKER_CAPABILITIES || '').split(',').map((value) => value.trim()).filter(Boolean));
      for (const capability of requiredCapabilities) {
        add(`question_engine_worker_${capability.replace(/[^a-z0-9]+/gi, '_')}`, workerCapabilities.has(capability), `Worker must explicitly advertise ${capability}.`);
      }
    }
  }
  const blockers = checks.filter((item) => item.status === 'block');
  return {
    schemaVersion: 'question-engine-production-preflight-v1', expectedMode,
    status: blockers.length ? 'blocked' : expectedMode === 'inactive' ? 'inactive' : 'ready',
    activationRequested, requiredCapabilities, checks, blockerCount: blockers.length
  };
}

function evaluate(env, options = {}) {
  const mode = options.mode || env.MOODLELIKE_HOST_INTEGRATION_MODE || 'standalone';
  const template = Boolean(options.template);
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  const required = (id, condition, message) => add(id, condition ? 'pass' : 'block', message);
  const warn = (id, condition, message) => add(id, condition ? 'pass' : 'warn', message);

  required('host_mode', ['standalone', 'cscalite'].includes(mode), 'Host mode must be standalone or cscalite.');
  required('contract_version', env.MOODLELIKE_HOST_CONTRACT_VERSION === 'cscalite-agent-host-v1', 'Host contract must be cscalite-agent-host-v1.');
  required('agent_server_enabled', bool(env.AGENT_WEB_ENABLED), 'Backend Agent runtime must be enabled.');
  required('agent_browser_enabled', bool(env.VITE_AGENT_WEB_ENABLED), 'Browser Agent workspace must be built as enabled.');
  required('practice_write_enabled', bool(env.CSCA_AGENT_PRACTICE_WRITE_ENABLED), 'Practice write path must be enabled.');
  required('rollback_redirect', Boolean(String(env.VITE_AGENT_DISABLED_REDIRECT_URL ?? '').trim()), 'A disabled-state fallback route is required.');
  const questionEngine = evaluateQuestionEngine(env, { expectedMode: options.questionEngineProduction ? 'production' : 'inactive' });
  for (const check of questionEngine.checks) checks.push(check);
  if (!options.questionEngineProduction) {
    required('automatic_question_generation_isolated', !bool(env.CSCA_AI_QUESTION_GENERATION_ENABLED) && !bool(env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED) && !bool(env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED) && !bool(env.CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED), 'Automatic question production must stay disabled in the student runtime.');
  }

  if (!template) {
    required('database_url', configured(env.DATABASE_URL), 'DATABASE_URL must be configured.');
    required('auth_secret', configured(env.AUTH_SECRET) && String(env.AUTH_SECRET).length >= 32, 'AUTH_SECRET must be a non-placeholder value of at least 32 characters.');
    required('cors_origins', configured(env.CORS_ORIGINS), 'CORS_ORIGINS must name the browser host.');
  } else {
    warn('template_database_url', Boolean(env.DATABASE_URL), 'Template documents DATABASE_URL.');
    warn('template_auth_secret', Boolean(env.AUTH_SECRET), 'Template documents AUTH_SECRET.');
    warn('template_cors_origins', Boolean(env.CORS_ORIGINS), 'Template documents CORS_ORIGINS.');
  }

  required('ai_gateway', bool(env.AI_GATEWAY_ENABLED), 'AI Gateway must be enabled for question-scoped tutoring.');
  required('ai_provider', env.AI_DEFAULT_PROVIDER === 'deepseek', 'Student AI provider must resolve through the DeepSeek gateway.');
  required('deepseek_base_url', /^https:\/\//i.test(String(env.DEEPSEEK_PERSONAL_BASE_URL || env.DEEPSEEK_BASE_URL || '')), 'DeepSeek base URL must use HTTPS.');
  required('deepseek_model', (env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || env.DEEPSEEK_DEFAULT_MODEL) === 'deepseek-flash', 'Use the current deepseek-flash alias for V4.1 Flash.');
  if (!template) required('deepseek_personal_key', keyCount(env.DEEPSEEK_PERSONAL_API_KEYS || env.DEEPSEEK_API_KEYS) > 0, 'At least one personal DeepSeek key is required.');
  else warn('deepseek_personal_key_placeholder', 'DEEPSEEK_PERSONAL_API_KEYS' in env, 'Template documents the personal DeepSeek key pool.');
  warn('shared_rate_limit', env.RATE_LIMIT_STORE === 'redis' && configured(env.RATE_LIMIT_REDIS_URL), 'Multi-instance deployment should use Redis rate limiting.');
  if (mode === 'cscalite') {
    required('cscalite_rollback_target', String(env.VITE_AGENT_DISABLED_REDIRECT_URL || '').trim() !== '/', 'CSCALite mode must redirect disabled Agent traffic to the legacy practice entry.');
    required('secure_cookie', bool(env.AUTH_COOKIE_SECURE), 'CSCALite production integration requires secure auth cookies.');
  }

  const blockers = checks.filter((item) => item.status === 'block');
  const warnings = checks.filter((item) => item.status === 'warn');
  return { schemaVersion: 'moodlelike-integration-preflight-v1', mode, status: blockers.length ? 'blocked' : warnings.length ? 'ready_with_warnings' : 'ready', checks, questionEngine, blockerCount: blockers.length, warningCount: warnings.length };
}

async function probeDatabase(env) {
  const { PrismaClient } = require(path.join(root, 'backend', 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const startedAt = Date.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return { status: 'pass', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { status: 'block', latencyMs: Date.now() - startedAt, reason: String(error?.code || error?.name || 'database_probe_failed').slice(0, 80) };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function probeDeepSeek(env) {
  const apiKey = String(env.DEEPSEEK_PERSONAL_API_KEYS || env.DEEPSEEK_API_KEYS || '').split(',').map((item) => item.trim()).find(Boolean);
  if (!apiKey) return { status: 'block', reason: 'missing_key' };
  const baseUrl = String(env.DEEPSEEK_PERSONAL_BASE_URL || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-flash';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', signal: controller.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ model, stream: true, max_tokens: 8, temperature: 0, messages: [{ role: 'user', content: 'Reply with OK only.' }] })
    });
    if (!response.ok || !response.body) return { status: 'block', latencyMs: Date.now() - startedAt, reason: `http_${response.status}` };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (value) text += decoder.decode(value, { stream: !done });
      if (done || text.includes('[DONE]')) break;
    }
    return { status: text.includes('data:') ? 'pass' : 'block', latencyMs: Date.now() - startedAt, model, streamed: text.includes('data:') };
  } catch (error) {
    return { status: 'block', latencyMs: Date.now() - startedAt, reason: String(error?.name || 'deepseek_probe_failed').slice(0, 80) };
  } finally {
    clearTimeout(timeout);
  }
}

function questionEngineWorkerHealthUrl(env, explicitUrl = '') {
  const configuredHealthUrl = String(explicitUrl || env.QUESTION_ENGINE_WORKER_HEALTH_URL || '').trim();
  if (configuredHealthUrl) return new URL(configuredHealthUrl).toString();
  const sidecarUrl = String(env.QUESTION_ENGINE_SIDECAR_URL || '').trim();
  if (!sidecarUrl) throw new Error('question_engine_worker_health_url_missing');
  const url = new URL(sidecarUrl);
  url.pathname = '/health';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function probeQuestionEngineWorker(env, options = {}) {
  const startedAt = Date.now();
  const timeoutMs = Math.max(500, Math.min(15000, Number(options.timeoutMs || env.QUESTION_ENGINE_WORKER_HEALTH_TIMEOUT_MS || 3000)));
  let healthUrl;
  try {
    healthUrl = questionEngineWorkerHealthUrl(env, options.healthUrl);
  } catch (error) {
    return { status: 'block', latencyMs: Date.now() - startedAt, reason: error.message };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl || fetch)(healthUrl, {
      method: 'GET', signal: controller.signal, headers: { accept: 'application/json' }
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || !body || typeof body !== 'object') {
      return { status: 'block', latencyMs: Date.now() - startedAt, healthUrl, reason: `http_${response.status}` };
    }
    const acceptedVersions = String(env.QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS || '').split(',').map((value) => value.trim()).filter(Boolean);
    const requiredCapabilities = String(env.QUESTION_ENGINE_WORKER_CAPABILITIES || '').split(',').map((value) => value.trim()).filter(Boolean);
    const actualCapabilities = Array.isArray(body.capabilities) ? body.capabilities.map(String) : [];
    const blockers = [
      !['ready', 'ready_no_capabilities'].includes(body.status) ? `worker_status_${String(body.status || 'missing')}` : null,
      body.protocol !== 'question-engine-task-v1' ? 'worker_protocol_mismatch' : null,
      !body.worker || typeof body.worker.id !== 'string' || !body.worker.id ? 'worker_identity_missing' : null,
      !body.worker || !acceptedVersions.includes(String(body.worker.version || '')) ? 'worker_version_not_accepted' : null,
      ...requiredCapabilities.filter((capability) => !actualCapabilities.includes(capability)).map((capability) => `worker_capability_missing:${capability}`)
    ].filter(Boolean);
    return {
      status: blockers.length ? 'block' : 'pass', latencyMs: Date.now() - startedAt, healthUrl,
      protocol: body.protocol || null,
      worker: body.worker || null,
      capabilities: actualCapabilities,
      blockers
    };
  } catch (error) {
    return {
      status: 'block', latencyMs: Date.now() - startedAt, healthUrl,
      reason: error?.name === 'AbortError' ? 'question_engine_worker_health_timeout' : 'question_engine_worker_health_unavailable'
    };
  } finally {
    clearTimeout(timeout);
  }
}

function selfTest() {
  const ready = evaluate({
    MOODLELIKE_HOST_INTEGRATION_MODE: 'cscalite', MOODLELIKE_HOST_CONTRACT_VERSION: 'cscalite-agent-host-v1',
    AGENT_WEB_ENABLED: 'true', VITE_AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', VITE_AGENT_DISABLED_REDIRECT_URL: '/legacy-practice',
    CSCA_AI_QUESTION_GENERATION_ENABLED: 'false', CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'false', CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'false', CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED: 'false',
    DATABASE_URL: 'postgresql://user:pass@db:5432/app?sslmode=require', AUTH_SECRET: 'x'.repeat(40), CORS_ORIGINS: 'https://cscalite.example', AUTH_COOKIE_SECURE: 'true',
    AI_GATEWAY_ENABLED: 'true', AI_DEFAULT_PROVIDER: 'deepseek', DEEPSEEK_PERSONAL_BASE_URL: 'https://api.deepseek.com', DEEPSEEK_PERSONAL_DEFAULT_MODEL: 'deepseek-flash', DEEPSEEK_PERSONAL_API_KEYS: 'sk-test', RATE_LIMIT_STORE: 'redis', RATE_LIMIT_REDIS_URL: 'redis://redis:6379'
  });
  assert.equal(ready.status, 'ready');
  const blocked = evaluate({ MOODLELIKE_HOST_INTEGRATION_MODE: 'cscalite' });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.blockerCount >= 8);
  const questionEngineReady = evaluateQuestionEngine({
    QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'moodlelike-ai-questioning',
    CSCA_AI_QUESTION_GENERATION_ENABLED: 'true', CSCA_AI_QUESTION_REVIEW_ENABLED: 'true', CSCA_AI_TOPIC_MAPPING_ENABLED: 'true',
    CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'true', AI_DEFAULT_PROVIDER: 'deepseek',
    DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-flash', DEEPSEEK_BACKGROUND_API_KEYS: 'sk-test'
  }, { expectedMode: 'production' });
  assert.equal(questionEngineReady.status, 'ready');
  assert.deepEqual(questionEngineReady.requiredCapabilities, ['question.generate', 'question.review', 'question.topic-map']);
  const questionEngineBlocked = evaluateQuestionEngine({
    QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'unknown', CSCA_AI_QUESTION_GENERATION_ENABLED: 'true'
  }, { expectedMode: 'production' });
  assert.equal(questionEngineBlocked.status, 'blocked');
  assert.ok(questionEngineBlocked.blockerCount >= 4);
  const sidecarBlocked = evaluateQuestionEngine({
    QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'moodlelike-ai-questioning',
    QUESTION_ENGINE_EXECUTION_MODE: 'sidecar', QUESTION_ENGINE_SIDECAR_URL: 'http://question-engine-worker:3100',
    QUESTION_ENGINE_TASK_HMAC_SECRET: 'x'.repeat(40), QUESTION_ENGINE_TASK_KEY_ID: 'primary-v1', REDIS_URL: 'redis://redis:6379',
    CSCA_AI_QUESTION_REVIEW_ENABLED: 'true', AI_DEFAULT_PROVIDER: 'deepseek',
    DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-flash', DEEPSEEK_BACKGROUND_API_KEYS: 'sk-test'
  }, { expectedMode: 'production' });
  assert.equal(sidecarBlocked.status, 'blocked');
  assert.ok(sidecarBlocked.checks.some((item) => item.id === 'question_engine_sidecar_activation' && item.status === 'block'));
  const sidecarReady = evaluateQuestionEngine({
    QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'moodlelike-ai-questioning',
    QUESTION_ENGINE_EXECUTION_MODE: 'sidecar', QUESTION_ENGINE_SIDECAR_URL: 'http://question-engine-worker:3100/v1/tasks/execute',
    QUESTION_ENGINE_TASK_HMAC_SECRET: 'x'.repeat(40), QUESTION_ENGINE_TASK_KEY_ID: 'primary-v1', REDIS_URL: 'redis://redis:6379',
    QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED: 'true', QUESTION_ENGINE_WORKER_CAPABILITIES: 'question.review,question.topic-map',
    QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0',
    CSCA_AI_QUESTION_REVIEW_ENABLED: 'true', AI_DEFAULT_PROVIDER: 'deepseek',
    DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-flash', DEEPSEEK_BACKGROUND_API_KEYS: 'sk-test'
  }, { expectedMode: 'production' });
  assert.equal(sidecarReady.status, 'ready');
  console.log('Moodlelike integration preflight self-test passed.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const envArg = args.find((item) => item.startsWith('--env-file='));
  const fileValues = envArg ? parseEnv(fs.readFileSync(path.resolve(root, envArg.slice('--env-file='.length)), 'utf8')) : {};
  const env = { ...fileValues, ...process.env };
  const modeArg = args.find((item) => item.startsWith('--mode='));
  const report = evaluate(env, {
    mode: modeArg?.slice('--mode='.length),
    template: args.includes('--template'),
    questionEngineProduction: args.includes('--question-engine-production')
  });
  if (args.includes('--probe-database')) report.databaseProbe = await probeDatabase(env);
  if (args.includes('--probe-deepseek')) report.deepSeekProbe = await probeDeepSeek(env);
  if (args.includes('--probe-question-engine-worker')) {
    const healthUrlArg = args.find((item) => item.startsWith('--question-engine-health-url='));
    report.questionEngineWorkerProbe = await probeQuestionEngineWorker(env, {
      healthUrl: healthUrlArg?.slice('--question-engine-health-url='.length)
    });
  }
  if (report.databaseProbe?.status === 'block' || report.deepSeekProbe?.status === 'block'
    || report.questionEngineWorkerProbe?.status === 'block') report.status = 'blocked';
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'blocked') process.exitCode = 1;
}

if (require.main === module) void main();
module.exports = {
  parseEnv, evaluate, evaluateQuestionEngine, probeDatabase, probeDeepSeek,
  questionEngineWorkerHealthUrl, probeQuestionEngineWorker
};
