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
  required('automatic_question_generation_isolated', !bool(env.CSCA_AI_QUESTION_GENERATION_ENABLED) && !bool(env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED) && !bool(env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED) && !bool(env.CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED), 'Automatic question production must stay disabled in the student runtime.');

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
  return { schemaVersion: 'moodlelike-integration-preflight-v1', mode, status: blockers.length ? 'blocked' : warnings.length ? 'ready_with_warnings' : 'ready', checks, blockerCount: blockers.length, warningCount: warnings.length };
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
  console.log('Moodlelike integration preflight self-test passed.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const envArg = args.find((item) => item.startsWith('--env-file='));
  const fileValues = envArg ? parseEnv(fs.readFileSync(path.resolve(root, envArg.slice('--env-file='.length)), 'utf8')) : {};
  const env = { ...fileValues, ...process.env };
  const modeArg = args.find((item) => item.startsWith('--mode='));
  const report = evaluate(env, { mode: modeArg?.slice('--mode='.length), template: args.includes('--template') });
  if (args.includes('--probe-database')) report.databaseProbe = await probeDatabase(env);
  if (args.includes('--probe-deepseek')) report.deepSeekProbe = await probeDeepSeek(env);
  if (report.databaseProbe?.status === 'block' || report.deepSeekProbe?.status === 'block') report.status = 'blocked';
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'blocked') process.exitCode = 1;
}

if (require.main === module) void main();
module.exports = { parseEnv, evaluate, probeDatabase, probeDeepSeek };
