const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

const coreExact = new Set([
  'dev', 'frontend:dev', 'frontend:build', 'backend:build', 'prisma:generate', 'prisma:validate',
  'demo:seed', 'agent:build', 'audit:product-boundaries', 'audit:command-surface',
  'audit:prisma-retention', 'audit:environment-contract', 'security:audit-dependencies',
  'release:check', 'ci:contracts', 'ci:golden'
]);
const corePrefixes = ['local:', 'test:', 'data:', 'question-engine:'];
const platformPrefixes = [
  'mock-exams:', 'special-practice:', 'csca-adaptive:', 'csca-ai-gateway:',
  'csca-generation-profile:', 'csca-source-profile-visualization:', 'csca:',
  'csca-source-json:', 'csca-syllabus:', 'csca-learning:', 'csca-readiness:',
  'csca-mock-exam-history:', 'csca-mock-exam-ai-generation:', 'csca-wrong-questions:',
  'csca-byok:', 'organization-', 'admin-audit:', 'governance-gates:',
  'ai-provider:', 'ai-credits:'
];
const legacyExact = new Set(['backend:build:with-prisma', 'admin:bootstrap', 'schools:import']);
const legacyPrefixes = ['backend:dev', 'db:', 'verify:'];

function classify(name) {
  if (coreExact.has(name) || corePrefixes.some((prefix) => name.startsWith(prefix))) return 'product-core';
  if (name.startsWith('csca-ai-questioning:')) return 'question-production';
  if (platformPrefixes.some((prefix) => name.startsWith(prefix))) return 'platform-contracts';
  if (legacyExact.has(name) || legacyPrefixes.some((prefix) => name.startsWith(prefix))) return 'compatibility-operations';
  return 'unclassified';
}

const categories = {
  'product-core': [],
  'question-production': [],
  'platform-contracts': [],
  'compatibility-operations': [],
  unclassified: []
};
const missingFileReferences = [];
const missingScriptReferences = [];
const byCommand = new Map();

for (const [name, command] of Object.entries(scripts)) {
  categories[classify(name)].push(name);
  const names = byCommand.get(command) || [];
  names.push(name);
  byCommand.set(command, names);

  for (const match of command.matchAll(/\b((?:[A-Za-z0-9._-]+\/)*scripts\/[A-Za-z0-9._/-]+\.(?:cjs|mjs|js|ts))\b/g)) {
    if (!fs.existsSync(path.join(root, match[1]))) missingFileReferences.push({ script: name, file: match[1] });
  }
  for (const match of command.matchAll(/\bnpm(?:\.cmd)?\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    if (!scripts[match[1]]) missingScriptReferences.push({ script: name, target: match[1] });
  }
}
for (const names of Object.values(categories)) names.sort();

const allowedDuplicate = [
  'csca-ai-questioning:guarded-observation-run',
  'csca-ai-questioning:math-diversity-observation-run'
];
const duplicateCommands = [...byCommand.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([command, names]) => ({ command, names: [...names].sort() }))
  .sort((left, right) => left.names[0].localeCompare(right.names[0]));
const unexpectedDuplicates = duplicateCommands.filter(({ names }) => JSON.stringify(names) !== JSON.stringify(allowedDuplicate));

const report = {
  schemaVersion: '1',
  total: Object.keys(scripts).length,
  budget: 331,
  counts: Object.fromEntries(Object.entries(categories).map(([name, values]) => [name, values.length])),
  categories,
  duplicateCommands,
  missingFileReferences,
  missingScriptReferences
};

if (report.total > report.budget) throw new Error('Root command surface exceeded budget: ' + report.total + ' > ' + report.budget);
if (categories.unclassified.length) throw new Error('Unclassified root commands: ' + categories.unclassified.join(', '));
if (missingFileReferences.length) throw new Error('Root commands reference missing files: ' + JSON.stringify(missingFileReferences));
if (missingScriptReferences.length) throw new Error('Root commands reference missing npm scripts: ' + JSON.stringify(missingScriptReferences));
if (unexpectedDuplicates.length) throw new Error('Unexpected duplicate root commands: ' + JSON.stringify(unexpectedDuplicates));

const output = path.join(root, 'artifacts', 'command-surface.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ total: report.total, budget: report.budget, counts: report.counts, duplicateAliases: duplicateCommands.length }));
