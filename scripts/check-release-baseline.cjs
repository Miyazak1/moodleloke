const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const expected = ['LICENSE', 'SECURITY.md', 'RELEASE_BASELINE.md', 'ENVIRONMENT_CONTRACT.md', 'SOURCE_PROVENANCE.md', 'REPOSITORY_OWNERSHIP.md', 'LIVE_GOLDEN_PATH.md', 'COMMAND_SURFACE.md', 'COMPATIBILITY_OPERATIONS.md', 'VERSION', '.gitattributes', '.gitignore', '.env.example', '.env.production.example', 'artifacts/environment-contract.json', 'artifacts/command-surface.json', 'artifacts/compatibility-operations.json'];
for (const item of expected) if (!fs.existsSync(path.join(root, item))) throw new Error('Release baseline file missing: ' + item);
const packages = [['package.json', 'moodlelike-agent'], ['backend/package.json', '@moodlelike/backend'], ['frontend/package.json', '@moodlelike/frontend'], ['question-engine/package.json', '@moodlelike/question-engine']];
for (const [file, name] of packages) { const value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); if (value.name !== name || value.version !== '0.1.0-alpha.3' || value.private !== true) throw new Error('Package identity mismatch: ' + file); if (value.engines?.node !== '>=22 <23') throw new Error('Node engine missing: ' + file); }
const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const marker of ['node_modules/', '.env', '.local/', 'dist/', '*.log']) if (!ignore.includes(marker)) throw new Error('.gitignore missing: ' + marker);
const prohibited = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (['.git', '.local', 'node_modules', 'dist', 'test-results', 'playwright-report'].includes(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else { const rel = path.relative(root, full).replaceAll('\\', '/'); if ((entry.name.startsWith('.env') && !['.env.example', '.env.production.example'].includes(entry.name)) || /.(dump|pem|p12|pfx)$/i.test(entry.name)) prohibited.push(rel); } } }
walk(root);
if (prohibited.length) throw new Error('Prohibited release files: ' + prohibited.join(', '));
const provenance = fs.readFileSync(path.join(root, 'SOURCE_PROVENANCE.md'), 'utf8');
if (/[A-Z]:\\/i.test(provenance)) throw new Error('Source provenance must not expose a local absolute path.');
const envReport = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/environment-contract.json'), 'utf8'));
if (envReport.missingRequiredDevelopment.length || envReport.missingRequiredProduction.length || envReport.unsafeExampleValues.length) throw new Error('Environment contract has release blockers.');
console.log(JSON.stringify({ version: '0.1.0-alpha.3', packages: packages.length, environmentVariables: envReport.runtimeVariableCount, prohibitedFiles: 0 }));
