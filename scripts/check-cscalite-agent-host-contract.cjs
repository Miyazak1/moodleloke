const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));
const contract = readJson('contracts/cscalite-agent-host.v1.json');
const contextContract = readJson('contracts/agent-context.v1.json');
const questionPluginContract = readJson('contracts/question-supply-plugin.v1.json');
const fixture = readJson('contracts/fixtures/cscalite-agent-host.v1.json');

assert.equal(contract.schemaVersion, 'cscalite-agent-host-v1');
assert.equal(contract.status, 'integration-frozen');
assert.equal(contract.routes.browserEntry, '/agent');
assert.equal(contract.routes.localePolicy.pathPrefixAllowed, false);
assert.deepEqual(contract.routes.localePolicy.supported, ['zh-CN', 'en', 'vi']);
assert.equal(contract.questionProductionIsolation.studentRuntimeMayGenerateQuestions, false);
assert.equal(contract.agentContext.conversationFallbackAllowed, false);
assert.equal(contract.agentContext.urlKey, 'agentContextId');
assert.equal(contextContract.schemaVersion, contract.agentContext.schemaVersion);
assert.equal(questionPluginContract.schemaVersion, contract.questionProductionIsolation.contractVersion);
assert.deepEqual(contract.routes.forbiddenTaskWorkspaceKeys.sort(), ['agentConversationId', 'conversation']);
assert.deepEqual(contract.frontendBridge.requiredCallbacks.sort(), ['getSnapshot', 'navigate', 'requestAuthentication', 'requestJson']);
assert.deepEqual(contract.frontendBridge.identityProps.sort(), ['currentUser', 'isResolvingAuth']);
assert.deepEqual(contract.errors.codes.sort(), [
  'auth_required', 'email_unverified', 'feature_disabled', 'question_supply_unavailable',
  'workspace_forbidden', 'workspace_stale'
].sort());

assert.equal(fixture.hostSnapshot.contractVersion, contract.schemaVersion);
assert.equal(fixture.hostSnapshot.features.studentRuntimeQuestionGeneration, false);
assert.ok(contract.routes.localePolicy.supported.includes(fixture.hostSnapshot.locale));
assert.equal(fixture.agentContext.status, 'active');
assert.ok(contract.agentContext.kinds.includes(fixture.agentContext.kind));
assert.equal(fixture.error.status, contract.errors.httpStatus[fixture.error.code]);
assert.equal(fixture.questionSupplyDemand.sourcePolicy, 'reviewed_published_only');
assert.equal(fixture.questionSupplyDemand.demandKey.length, 64);

for (const envFile of ['.env.example', '.env.production.example']) {
  const source = read(envFile);
  const required = {
    MOODLELIKE_HOST_INTEGRATION_MODE: 'standalone',
    MOODLELIKE_HOST_CONTRACT_VERSION: contract.schemaVersion,
    AGENT_WEB_ENABLED: 'true',
    VITE_AGENT_WEB_ENABLED: 'true',
    VITE_AGENT_PRACTICE_WRITE_ENABLED: 'true',
    CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true'
  };
  for (const [key, value] of Object.entries(required)) {
    assert.match(source, new RegExp(`^${key}="?${value}"?$`, 'm'), `${envFile} must bind ${key}=${value}`);
  }
  assert.match(source, /^VITE_AGENT_DISABLED_REDIRECT_URL=/m, `${envFile} must provide the rollback redirect`);
  assert.match(source, /^DEEPSEEK_PERSONAL_DEFAULT_MODEL="?deepseek-flash"?$/m, `${envFile} must use the current DeepSeek Flash API alias`);
  for (const key of contract.questionProductionIsolation.requiredDisabledFlags) {
    assert.match(source, new RegExp(`^${key}="?false"?$`, 'm'), `${envFile} must isolate automatic question production with ${key}=false`);
  }
}

const routeSource = read('frontend/src/lib/agent-workspace-route.ts');
for (const key of contract.routes.queryKeys.filter((key) => key !== 'agentSection')) {
  assert.match(routeSource, new RegExp(key), `workspace route must recognize ${key}`);
}
const workspaceParser = routeSource.slice(routeSource.indexOf('export function parseAgentWorkspaceRoute'), routeSource.indexOf('export function serializeAgentWorkspaceRoute'));
const workspaceSerializer = routeSource.slice(routeSource.indexOf('export function serializeAgentWorkspaceRoute'), routeSource.indexOf('export function replaceAgentWorkspaceRoute'));
for (const key of contract.routes.forbiddenTaskWorkspaceKeys) {
  assert.doesNotMatch(workspaceParser, new RegExp(`params\\.get\\(['"]${key}['"]`), `task workspace route must not accept ${key} as a context alias`);
  assert.doesNotMatch(workspaceSerializer, new RegExp(`params\\.set\\(['"]${key}['"]`), `task workspace route must not emit ${key}`);
}
assert.match(routeSource, /section === 'qa' && conversationId/, 'independent subject Q&A may persist its own conversation id');

const featureSource = read('frontend/src/lib/agent-feature.ts');
assert.match(featureSource, /VITE_AGENT_WEB_ENABLED/);
assert.match(featureSource, /VITE_AGENT_PRACTICE_WRITE_ENABLED/);
assert.match(featureSource, /VITE_AGENT_DISABLED_REDIRECT_URL/);

const hostBridgeSource = read(contract.frontendBridge.module);
const agentPageSource = read('frontend/src/pages/AgentPage.tsx');
const standaloneShellSource = read('frontend/src/StandaloneAgentApp.tsx');
for (const callback of contract.frontendBridge.requiredCallbacks) {
  assert.match(hostBridgeSource, new RegExp(`\\b${callback}\\b`), `host bridge must expose ${callback}`);
}
for (const field of contract.frontendBridge.snapshotFields) {
  assert.match(hostBridgeSource, new RegExp(`\\b${field}\\b`), `host bridge snapshot must expose ${field}`);
  assert.match(standaloneShellSource, new RegExp(`\\b${field}\\b`), `standalone shell must provide host snapshot field ${field}`);
}
for (const errorCode of contract.errors.codes) {
  assert.match(hostBridgeSource, new RegExp(`['"]${errorCode}['"]`), `host bridge must type error code ${errorCode}`);
}
for (const prop of contract.frontendBridge.identityProps) {
  assert.match(agentPageSource, new RegExp(`\\b${prop}\\b`), `AgentPage must receive host identity prop ${prop}`);
}
assert.match(agentPageSource, /host:\s*AgentHostBridge/, 'AgentPage must depend on the explicit host bridge');
assert.match(standaloneShellSource, /createAgentHostBridge/, 'standalone shell must use the production host bridge');
assert.match(standaloneShellSource, /host=\{agentHost\}/, 'standalone shell must pass the host bridge as one boundary');
assert.match(standaloneShellSource, /requestJson/, 'standalone shell must reuse the canonical authenticated transport');
assert.match(standaloneShellSource, /studentRuntimeQuestionGeneration:\s*false/, 'standalone shell must never advertise runtime question generation');
assert.match(agentPageSource, new RegExp(`className=["']${contract.css.rootNamespace}["']`), 'AgentPage must expose the frozen CSS root namespace');

const questionSupplySource = read('backend/src/agent/question-supply-fulfillment.contract.ts');
for (const symbol of [
  contract.questionProductionIsolation.catalogReadPort,
  contract.questionProductionIsolation.demandPort,
  'QUESTION_SUPPLY_PLUGIN_CONTRACT_VERSION'
]) {
  assert.match(questionSupplySource, new RegExp(`\\b${symbol}\\b`), `question plugin contract must expose ${symbol}`);
}
assert.match(questionSupplySource, /reviewed_published_only/, 'catalog reads must be restricted to reviewed and published questions');

for (const file of [
  'frontend/src/StandaloneAgentApp.tsx',
  'frontend/src/i18n/I18nProvider.tsx',
  'scripts/moodlelike-local.cjs',
  'docs/cscalite-agent-integration-runbook.md'
]) {
  assert.doesNotMatch(read(file), /\/zh\/agent/, `${file} must not retain a locale-prefixed Agent entry`);
}

const frontendDockerfile = read('deploy/frontend.Dockerfile');
for (const key of ['VITE_AGENT_WEB_ENABLED', 'VITE_AGENT_PRACTICE_WRITE_ENABLED', 'VITE_AGENT_DISABLED_REDIRECT_URL']) {
  assert.match(frontendDockerfile, new RegExp(`ARG ${key}=`), `frontend image must accept ${key} as a build argument`);
  assert.match(frontendDockerfile, new RegExp(`ENV ${key}=\\$\\{${key}\\}`), `frontend image must compile ${key} into the bundle`);
}

const productionCompose = read('deploy/docker-compose.prod.yml');
assert.match(productionCompose, /env_file:\s*\r?\n\s*- \.\.\/\.env/, 'production compose must load the canonical root environment file');
for (const key of ['VITE_AGENT_WEB_ENABLED', 'VITE_AGENT_PRACTICE_WRITE_ENABLED', 'VITE_AGENT_DISABLED_REDIRECT_URL']) {
  assert.match(productionCompose, new RegExp(`${key}: \\$\\{${key}:-`), `production compose must forward ${key}`);
}
assert.match(productionCompose, /api\/v1\/ops\/ready/, 'production container health must use the readiness endpoint');
assert.match(productionCompose, /body\.status==='ready'/, 'production container health must reject degraded readiness');

const packageJson = readJson('package.json');
assert.match(packageJson.scripts['ci:contracts'], /node scripts\/check-cscalite-agent-host-contract\.cjs/);
assert.match(packageJson.scripts['ci:contracts'], /node scripts\/moodlelike-integration-preflight\.cjs --self-test/);

console.log('CSCALite Agent host integration contract passed.');
