const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const boundary = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/product-boundary-audit.json'), 'utf8'));
const frontendReachability = JSON.parse(fs.readFileSync(path.join(root, 'frontend/artifacts/standalone-reachability.json'), 'utf8'));
const files = [...boundary.backend.reachable.map((item) => path.join(root, item)), ...frontendReachability.reachable.map((item) => path.join(root, 'frontend', item)), path.join(root, 'scripts/start-agent-dev.ps1'), path.join(root, 'scripts/start-backend-dev.cjs')].filter((item) => fs.existsSync(item));
const references = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of [/process.env.([A-Z][A-Z0-9_]+)/g, /process.env[['"]([A-Z][A-Z0-9_]+)['"]]/g, /import.meta.env.([A-Z][A-Z0-9_]+)/g, /$env:([A-Z][A-Z0-9_]+)/g]) {
    for (const match of text.matchAll(pattern)) { const key = match[1]; if (!references.has(key)) references.set(key, new Set()); references.get(key).add(path.relative(root, file).replaceAll('\\', '/')); }
  }
}
function parseExample(name) { const result = new Map(); for (const line of fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/)) { const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (match) result.set(match[1], match[2].replace(/^"|"$/g, '')); } return result; }
const development = parseExample('.env.example');
const production = parseExample('.env.production.example');
const requiredProduction = ['MOODLELIKE_ENV', 'DATABASE_URL', 'AUTH_SECRET', 'CORS_ORIGINS', 'PUBLIC_APP_ORIGIN', 'PUBLIC_API_ORIGIN'];
const secretPattern = /(SECRET|PASSWORD|TOKEN|API_KEY|API_KEYS|PRIVATE_KEY)$/;
const safePlaceholder = (value) => value === '' || /replace|example|change|placeholder/i.test(value);
const unsafeExampleValues = [];
for (const [key, value] of [...development, ...production]) if (secretPattern.test(key) && !safePlaceholder(value)) unsafeExampleValues.push(key);
const all = [...references].map(([key, sources]) => ({ key, category: secretPattern.test(key) ? 'secret' : key.startsWith('VITE_') ? 'frontend-public' : 'runtime-config', documentedDevelopment: development.has(key), documentedProduction: production.has(key), sources: [...sources].sort() })).sort((a, b) => a.key.localeCompare(b.key));
const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), reachableFilesScanned: files.length, runtimeVariableCount: all.length, requiredProduction, missingRequiredDevelopment: requiredProduction.filter((key) => !development.has(key)), missingRequiredProduction: requiredProduction.filter((key) => !production.has(key)), undocumentedRuntimeVariables: all.filter((item) => !item.documentedDevelopment && !item.documentedProduction).map((item) => item.key), unsafeExampleValues: [...new Set(unsafeExampleValues)].sort(), variables: all };
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/environment-contract.json'), JSON.stringify(report, null, 2) + '\n');
const rows = all.map((item) => '| ' + item.key + ' | ' + item.category + ' | ' + (item.documentedDevelopment ? 'yes' : 'no') + ' | ' + (item.documentedProduction ? 'yes' : 'no') + ' |');
fs.writeFileSync(path.join(root, 'artifacts/environment-contract.md'), ['# Environment variable inventory', '', 'Generated from the reachable Agent runtime. Values are never included.', '', '| Variable | Category | Dev example | Production example |', '| --- | --- | --- | --- |', ...rows, '', 'Undocumented variables use code defaults and remain compatibility debt; they are not automatically required.', ''].join('\n'));
if (report.missingRequiredDevelopment.length || report.missingRequiredProduction.length || report.unsafeExampleValues.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(JSON.stringify({ runtimeVariables: report.runtimeVariableCount, undocumented: report.undocumentedRuntimeVariables.length, unsafeExampleValues: 0 }));
