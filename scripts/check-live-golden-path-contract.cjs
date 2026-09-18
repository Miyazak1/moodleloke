const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contracts = [
  ['scripts/agent-demo-gate.cjs', ['http://localhost:3100', 'http://localhost:5190']],
  ['frontend/playwright.agent-live.config.ts', ['http://localhost:5190']],
  ['frontend/playwright.agent-readonly-live.config.ts', ['http://localhost:5190']],
  ['frontend/playwright.agent-attachment-live.config.ts', ['http://localhost:5190']],
  ['frontend/e2e/agent-live.spec.ts', ['http://localhost:3100']],
  ['frontend/e2e/agent-readonly-live.spec.ts', ['http://localhost:3100']],
  ['frontend/e2e/agent-attachment-live.spec.ts', ['http://localhost:3100']],
  ['frontend/e2e/agent-teaching-live.spec.ts', ['http://localhost:3100']],
  ['frontend/e2e/agent-handwriting-guided-live.spec.ts', ['http://localhost:3100']]
];

for (const [relativePath, expectedMarkers] of contracts) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const marker of expectedMarkers) {
    if (!content.includes(marker)) throw new Error(relativePath + ' is missing standalone endpoint ' + marker);
  }
  for (const legacyEndpoint of ['http://localhost:3000', 'http://localhost:5187']) {
    if (content.includes(legacyEndpoint)) throw new Error(relativePath + ' still uses legacy endpoint ' + legacyEndpoint);
  }
}

const operationalDocs = [
  'LIVE_GOLDEN_PATH.md',
  'Labs/docs/27-AGENT-PRIVATE-ATTACHMENT-FOUNDATION.md',
  'Labs/docs/51-AGENT-FIXED-EVAL-AND-DEMO-GATE.md',
  'Labs/docs/53-AGENT-BROWSER-GOLDEN-PATH.md',
  'Labs/docs/54-AGENT-ATTACHMENT-BROWSER-GOLDEN-PATH.md'
];
for (const relativePath of operationalDocs) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const legacyMarker of ['E:\\CODE\\CSCALITE', 'start-cscalite-dev.bat', 'http://localhost:3000', 'http://localhost:5187']) {
    if (content.includes(legacyMarker)) throw new Error(relativePath + ' still contains legacy operating instruction: ' + legacyMarker);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'frontend', 'package.json'), 'utf8'));
for (const script of ['test:e2e:agent:live', 'test:e2e:agent:readonly-live', 'test:e2e:agent:attachment:live']) {
  if (!pkg.scripts?.[script]) throw new Error('Missing live browser script: ' + script);
}

console.log('Standalone live golden-path contract passed.');
