const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const surface = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'command-surface.json'), 'utf8'));
const compatibility = surface.categories?.['compatibility-operations'] || [];
const blocked = [
  'db:backup:docker', 'verify:ci', 'verify:ops', 'verify:staging', 'verify:staging:full',
  'verify:docker:status', 'verify:docker:staging-local', 'verify:docker',
  'verify:release-candidate', 'verify:release-window', 'verify:release-window:local',
  'verify:local', 'verify:launch', 'verify:release'
].sort();
const controlledWrites = [
  'admin:bootstrap', 'db:cleanup-security', 'db:migrate', 'db:migrate:dev',
  'db:restore', 'db:seed', 'schools:import'
].sort();

const categories = {
  blockedLegacyRelease: [],
  controlledDataWrite: [],
  localOrDisposableDataSafety: [],
  legacyRuntime: [],
  retainedValidation: [],
  unclassified: []
};
for (const name of compatibility) {
  if (blocked.includes(name)) categories.blockedLegacyRelease.push(name);
  else if (controlledWrites.includes(name)) categories.controlledDataWrite.push(name);
  else if (name.startsWith('backend:dev')) categories.legacyRuntime.push(name);
  else if (name.startsWith('db:') || name === 'verify:backup-restore-drill') categories.localOrDisposableDataSafety.push(name);
  else if (name.startsWith('verify:')) categories.retainedValidation.push(name);
  else categories.unclassified.push(name);
}
for (const names of Object.values(categories)) names.sort();

const expectedBlockedCommand = (name) => 'node scripts/blocked-compatibility-operation.cjs ' + name;
for (const name of blocked) {
  if (pkg.scripts?.[name] !== expectedBlockedCommand(name)) throw new Error('Blocked operation became executable: ' + name);
}
if (categories.unclassified.length) throw new Error('Unclassified compatibility operations: ' + categories.unclassified.join(', '));
if (JSON.stringify(categories.controlledDataWrite) !== JSON.stringify(controlledWrites)) throw new Error('Controlled data-write registry drifted.');
if (compatibility.length !== 46) throw new Error('Compatibility operation budget drifted: ' + compatibility.length + ' !== 46');

const report = {
  schemaVersion: '1',
  total: compatibility.length,
  counts: Object.fromEntries(Object.entries(categories).map(([name, values]) => [name, values.length])),
  categories
};
const output = path.join(root, 'artifacts', 'compatibility-operations.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ total: report.total, counts: report.counts }));
