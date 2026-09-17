const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/standalone-ci.yml'), 'utf8');
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, 'frontend/package.json'), 'utf8'));
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const marker of ['npm run security:audit-dependencies', 'npm run ci:contracts', 'npm run ci:golden', 'playwright install --with-deps chromium', 'actions/upload-artifact@v4']) {
  if (!workflow.includes(marker)) throw new Error('Standalone CI is missing: ' + marker);
}
for (const script of ['test:e2e:golden:student', 'test:e2e:golden:teaching', 'test:e2e:golden:authoring', 'test:e2e:golden']) {
  if (!frontendPackage.scripts[script]) throw new Error('Frontend golden-path script is missing: ' + script);
}
for (const script of ['ci:contracts', 'ci:golden', 'security:audit-dependencies', 'test:teaching-assets', 'test:authoring-boundary', 'test:repository-ownership']) {
  if (!rootPackage.scripts[script]) throw new Error('Root CI gate is missing: ' + script);
}
if (/DATABASE_URL:s*postgres/i.test(workflow) || /OPENAI_API_KEY:s*S+/i.test(workflow)) throw new Error('CI workflow must not embed service credentials.');
console.log('Standalone CI contract passed.');
