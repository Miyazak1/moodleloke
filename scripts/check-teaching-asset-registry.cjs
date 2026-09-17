const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const backendRegistry = read('backend/src/agent/teaching-asset-registry.ts');
const frontendRegistry = read('frontend/src/components/agent/TeachingAssetRegistry.tsx');
const agentPage = read('frontend/src/pages/AgentPage.tsx');
const teachingService = read('backend/src/agent/agent-teaching-asset.service.ts');
const keys = ['math.function-horizontal-shift@1', 'physics.newton-second-law@1', 'chemistry.acid-base-neutralization@1'];

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
console.log('Teaching asset registry contract passed.');
