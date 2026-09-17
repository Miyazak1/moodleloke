const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const root = path.resolve(__dirname, '..');
const configuredStagingBaseUrl = process.env.STAGING_BASE_URL || '';
const configuredLocalStagingBaseUrl = process.env.LOCAL_STAGING_BASE_URL || '';
const localMode = Boolean(!configuredStagingBaseUrl && configuredLocalStagingBaseUrl);
const baseUrl = (configuredStagingBaseUrl || configuredLocalStagingBaseUrl || '').replace(/\/+$/, '');
const optional = process.argv.includes('--optional');
const full = process.argv.includes('--full');
const metricsToken = process.env.OPS_METRICS_TOKEN || process.env.STAGING_METRICS_TOKEN;
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));
const forbiddenSecretValues = [
  process.env.AUTH_SECRET,
  process.env.JWT_SECRET,
  process.env.PAYMENT_CALLBACK_SECRET,
  process.env.OPS_METRICS_TOKEN,
  process.env.STAGING_METRICS_TOKEN,
  process.env.STAGING_SMOKE_PASSWORD
].filter(Boolean);
const evidence = {
  kind: full ? (localMode ? 'staging-full-local' : 'staging-full') : (localMode ? 'staging-local' : 'staging'),
  baseUrl,
  localMode,
  timestamp: new Date().toISOString(),
  routes: [],
  ops: {},
  auth: undefined
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretLeak(label, value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of forbiddenSecretValues) {
    if (source.includes(secret)) {
      throw new Error(`${label} leaked a configured secret`);
    }
  }
}

async function readText(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.text();
  assertNoSecretLeak(path, body);
  return { response, body };
}

function collectSetCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const combined = response.headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,=\s]+=)/).map((value) => value.trim()) : [];
}

function applySetCookies(jar, response) {
  for (const item of collectSetCookies(response)) {
    const [pair] = item.split(';');
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (!name) continue;
    if (!value) delete jar[name.trim()];
    else jar[name.trim()] = value;
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');
}

function findCookie(response, name) {
  return collectSetCookies(response).find((cookie) => cookie.startsWith(`${name}=`));
}

async function readJson(path, options = {}) {
  const { response, body } = await readText(path, options);
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`${path} did not return JSON: ${body.slice(0, 300)}`);
  }
  return { response, body: json };
}

function assertSecurityHeaders(response) {
  const expected = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
  for (const [header, value] of Object.entries(expected)) {
    assert(response.headers.get(header) === value, `${header} expected ${value}, got ${response.headers.get(header)}`);
  }
  const csp = response.headers.get('content-security-policy-report-only') || response.headers.get('content-security-policy');
  assert(csp && csp.includes("default-src 'self'"), 'CSP header is missing default-src self');
}

async function checkFrontendRoutes() {
  const routes = [
    '/',
    '/csca-prep',
    '/csca-subjects/math',
    '/csca-mock-exam',
    '/past-papers',
    '/services/consulting',
    '/services/ai-coach',
    '/auth',
    '/me',
    '/admin/audit',
    '/admin/ai',
    '/admin/ai-question-bank',
    '/admin/mock-exams',
    '/admin/past-papers',
    '/admin/special-practice'
  ];
  for (const path of routes) {
    const { response, body } = await readText(path);
    assert(response.status === 200, `${path} expected 200, got ${response.status}`);
    assert(/CSCAlite|<div id="root"/.test(body), `${path} is missing the frontend app shell marker`);
    evidence.routes.push({ path, status: response.status });
  }
}

async function checkOpsEndpoints() {
  const health = await readJson('/api/v1/health', { headers: { 'x-request-id': 'staging-health-smoke' } });
  assert(health.response.status === 200, `/api/v1/health expected 200, got ${health.response.status}`);
  assert(health.body.status === 'ok', '/api/v1/health must be ok');
  assertSecurityHeaders(health.response);
  evidence.ops.health = health.body;

  const ready = await readJson('/api/v1/ops/ready', { headers: { 'x-request-id': 'staging-ready-smoke' } });
  assert(ready.response.status === 200, `/api/v1/ops/ready expected 200, got ${ready.response.status}`);
  assert(['ready', 'degraded'].includes(ready.body.status), `/api/v1/ops/ready returned unexpected status ${ready.body.status}`);
  assert(ready.body.appVersion, '/api/v1/ops/ready must include appVersion');
  assertNoSecretLeak('/api/v1/ops/ready', ready.body);
  evidence.ops.ready = ready.body;

  const deniedMetrics = await readJson('/api/v1/ops/metrics');
  assert([401, 404].includes(deniedMetrics.response.status), `/api/v1/ops/metrics without token expected 401 or 404, got ${deniedMetrics.response.status}`);
  assertNoSecretLeak('/api/v1/ops/metrics denied', deniedMetrics.body);
  evidence.ops.metricsDeniedStatus = deniedMetrics.response.status;

  if (full) {
    assert(metricsToken, 'full staging verification requires OPS_METRICS_TOKEN or STAGING_METRICS_TOKEN');
    assert(deniedMetrics.response.status === 401, `full staging verification requires metrics to be enabled and token-protected, got ${deniedMetrics.response.status}`);
  }

  if (metricsToken && deniedMetrics.response.status === 401) {
    const allowedMetrics = await readJson('/api/v1/ops/metrics', {
      headers: { Authorization: `Bearer ${metricsToken}` }
    });
    assert(allowedMetrics.response.status === 200, `/api/v1/ops/metrics with token expected 200, got ${allowedMetrics.response.status}`);
    assert(typeof allowedMetrics.body.requests?.total === 'number', 'metrics response must include request count');
    assertNoSecretLeak('/api/v1/ops/metrics allowed', allowedMetrics.body);
    evidence.ops.metricsAllowed = {
      status: allowedMetrics.response.status,
      requestsTotal: allowedMetrics.body.requests.total
    };
  }
}

async function checkFullAuthFlow() {
  if (!localMode) {
    assert(baseUrl.startsWith('https://'), 'full staging verification requires an HTTPS STAGING_BASE_URL');
  }

  const jar = {};
  const email = process.env.STAGING_SMOKE_EMAIL || `release-smoke-${Date.now()}@cscalite.local`;
  const password = process.env.STAGING_SMOKE_PASSWORD || `Smoke${Date.now()}Pass`;
  const authPath = process.env.STAGING_SMOKE_EMAIL ? '/api/v1/auth/login' : '/api/v1/auth/register';
  const authResponse = await fetch(`${baseUrl}${authPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      'x-request-id': 'staging-cookie-login'
    },
    body: JSON.stringify({ email, password })
  });
  const authBody = await authResponse.json().catch(() => ({}));
  assert(authResponse.ok, `${authPath} expected success, got ${authResponse.status} ${JSON.stringify(authBody)}`);
  assert(authBody.tokens?.accessToken, 'auth response must include an access token');
  assert(authBody.tokens?.refreshToken, 'auth response must keep compatible refreshToken JSON field');
  applySetCookies(jar, authResponse);

  const refreshCookie = findCookie(authResponse, process.env.AUTH_REFRESH_COOKIE_NAME || 'cscalite_refresh');
  const csrfCookie = findCookie(authResponse, process.env.AUTH_CSRF_COOKIE_NAME || 'cscalite_csrf');
  assert(refreshCookie && /HttpOnly/i.test(refreshCookie) && /SameSite=Lax/i.test(refreshCookie), 'refresh cookie must be HttpOnly and SameSite=Lax');
  assert(localMode || /Secure/i.test(refreshCookie), 'refresh cookie must be Secure outside local Docker staging');
  assert(csrfCookie && !/HttpOnly/i.test(csrfCookie), 'csrf cookie must be readable');
  assert(localMode || /Secure/i.test(csrfCookie), 'csrf cookie must be Secure outside local Docker staging');

  const csrfName = process.env.AUTH_CSRF_COOKIE_NAME || 'cscalite_csrf';
  const csrfHeader = process.env.AUTH_CSRF_HEADER_NAME || 'x-csrf-token';
  const missingCsrf = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      Origin: baseUrl,
      'x-request-id': 'staging-cookie-refresh-missing-csrf'
    }
  });
  assert(missingCsrf.status === 403, `cookie refresh without CSRF expected 403, got ${missingCsrf.status}`);

  const cookieRefresh = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeader]: decodeURIComponent(jar[csrfName]),
      Origin: baseUrl,
      'x-request-id': 'staging-cookie-refresh'
    }
  });
  const cookieRefreshBody = await cookieRefresh.json().catch(() => ({}));
  assert(cookieRefresh.ok && cookieRefreshBody.tokens?.accessToken, `cookie refresh expected success, got ${cookieRefresh.status}`);
  applySetCookies(jar, cookieRefresh);

  const bearerFallback = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authBody.tokens.refreshToken}`,
      Origin: baseUrl,
      'x-request-id': 'staging-bearer-refresh-disabled'
    }
  });
  assert(bearerFallback.status === 401, `cookie-only staging expected Bearer refresh 401, got ${bearerFallback.status}`);

  const crossOrigin = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeader]: decodeURIComponent(jar[csrfName]),
      Origin: 'https://evil.example',
      'x-request-id': 'staging-cookie-refresh-cross-origin'
    }
  });
  assert(crossOrigin.status === 403, `cross-origin cookie refresh expected 403, got ${crossOrigin.status}`);

  const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      [csrfHeader]: decodeURIComponent(jar[csrfName]),
      Origin: baseUrl,
      'x-request-id': 'staging-cookie-logout'
    }
  });
  assert(logout.ok, `cookie logout expected success, got ${logout.status}`);

  evidence.auth = {
    mode: 'cookie-only',
    authPath,
    email,
    cookieRefreshStatus: cookieRefresh.status,
    bearerFallbackStatus: bearerFallback.status,
    crossOriginStatus: crossOrigin.status,
    logoutStatus: logout.status
  };
}

function writeEvidence() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${evidence.kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const source = JSON.stringify(evidence, null, 2);
  assertNoSecretLeak('release evidence', source);
  fs.writeFileSync(file, `${source}\n`);
  console.log(`CSCAlite release evidence written: ${file}`);
}

async function main() {
  if (!baseUrl) {
    if (optional) {
      console.log('CSCAlite staging verification skipped because STAGING_BASE_URL/LOCAL_STAGING_BASE_URL is not configured.');
      return;
    }
    throw new Error('STAGING_BASE_URL is required, for example https://staging.example.com; use LOCAL_STAGING_BASE_URL=http://localhost:18080 for local Docker staging.');
  }
  await checkFrontendRoutes();
  await checkOpsEndpoints();
  if (full) await checkFullAuthFlow();
  writeEvidence();
  console.log(`CSCAlite staging verification passed for ${baseUrl}.`);
}

main().catch((error) => {
  console.error(`CSCAlite staging verification failed: ${error.message}`);
  process.exit(1);
});
