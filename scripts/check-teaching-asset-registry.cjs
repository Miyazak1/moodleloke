const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const backendRegistry = read('backend/src/agent/teaching-asset-registry.ts');
const frontendRegistry = read('frontend/src/components/agent/TeachingAssetRegistry.tsx');
const agentPage = read('frontend/src/pages/AgentPage.tsx');
const teachingService = read('backend/src/agent/agent-teaching-asset.service.ts');
const visualizerCatalog = read('frontend/src/components/agent/TeachingVisualizerCatalog.tsx');
const seed = read('backend/scripts/seed-teaching-assets.cjs');
const deploy = read('scripts/deploy-migrate-and-seed.cjs');
const readiness = read('scripts/agent-teaching-production-readiness.cjs');
const readinessTest = read('scripts/agent-teaching-production-readiness-test.cjs');
const backendImage = read('deploy/backend.Dockerfile');
const keys = ['math.function-horizontal-shift@1', 'physics.newton-second-law@1', 'chemistry.acid-base-neutralization@1'];
const productionSlice = [
  ['M-FUNC-001', 'visualizer.math.function-transform'],
  ['M-FUNC-002', 'visualizer.math.elementary-functions'],
  ['M-INEQ-001', 'visualizer.math.inequality-solutions']
];

for (const key of keys) {
  if (!backendRegistry.includes("'" + key + "'")) throw new Error('Backend teaching registry is missing ' + key);
  if (!frontendRegistry.includes("'" + key + "'")) throw new Error('Frontend teaching registry is missing ' + key);
}
if (!backendRegistry.includes('preservesPrimaryTask: true')) throw new Error('Teaching assets must preserve the primary task.');
if (!backendRegistry.includes('completionChangesMastery: false')) throw new Error('Teaching completion must not become mastery evidence.');
if (!agentPage.includes('TeachingAssetRenderer')) throw new Error('AgentPage must render teaching assets through the registry.');
if (agentPage.includes("import { FunctionShiftMicroLesson }")) throw new Error('AgentPage must not import a concrete micro-lesson renderer.');
if (!agentPage.includes('chatTeachingWorkspace = teachingWorkspace && hasPrimaryTaskWorkspace ? teachingWorkspace : null')) throw new Error('Teaching content must stay in chat while a primary task is open.');
if (!teachingService.includes('getTeachingAssetCapability')) throw new Error('Backend presentation must publish registered capabilities.');
for (const [topicCode, componentKey] of productionSlice) {
  if (!backendRegistry.includes(`'${componentKey}'`)) throw new Error(`Backend teaching registry is missing ${componentKey}.`);
  if (!visualizerCatalog.includes(`'${componentKey}'`)) throw new Error(`Frontend visualizer catalog is missing ${componentKey}.`);
  if (!seed.includes(`['${topicCode}', '${componentKey}'`)) throw new Error(`Teaching seed must bind ${componentKey} to ${topicCode}.`);
}
if (!readiness.includes("topicCode: 'M-FUNC-001'") || !readiness.includes("componentKey: 'visualizer.math.function-transform'")) {
  throw new Error('The first production readiness slice must gate M-FUNC-001 and its function-transform asset.');
}
if (!readiness.includes('CANARY_PERCENT_MUST_BE_1_TO_5') || !readiness.includes('SHADOW_REQUIRES_DELIVERY_DISABLED') || !readiness.includes('INTERNAL_USER_ALLOWLIST_EMPTY') || !readiness.includes('INTERNAL_USERS_NOT_FOUND_OR_INACTIVE')) {
  throw new Error('The production readiness gate must enforce safe Shadow, allowlisted Internal, and 1%-5% Canary configurations.');
}
if (!readinessTest.includes('AGENT_TEACHING_PRODUCTION_READINESS_POLICY_OK')) {
  throw new Error('The production readiness rollout policy must have a contract test.');
}
if (!deploy.includes("['backend/scripts/seed-teaching-assets.cjs']")) {
  throw new Error('Production deployment must publish reviewed teaching assets after data ensures.');
}
if (!deploy.includes("['scripts/apply-math-function-verification-curation.cjs', '--apply', '--allow-absent']")) {
  throw new Error('Production deployment must apply the reviewed math function verification manifest.');
}
if (!backendImage.includes('docs/csca-math-function-verification-curation-v1.json')) {
  throw new Error('The deployment build image must contain the reviewed verification manifest.');
}
console.log('Teaching asset registry contract passed.');
