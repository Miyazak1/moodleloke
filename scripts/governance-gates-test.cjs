const fs = require('node:fs');
const path = require('node:path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

function script(name) {
  const value = scripts[name];
  assert(typeof value === 'string' && value.trim(), `Missing npm script: ${name}`);
  return value;
}

function assertIncludes(scriptName, required) {
  const value = script(scriptName);
  for (const command of required) {
    assert(value.includes(command), `${scriptName} must include: ${command}`);
  }
}

assertIncludes('verify:governance', [
  'backend:build',
  'npm --prefix frontend run build',
  'organization-permissions:rules',
  'organization-governance:smoke',
  'admin-audit:organization-filter-smoke',
  'npm --prefix frontend run test:organization-invites',
  'npm --prefix frontend run test:organization-governance',
  'npm --prefix frontend run test:admin-audit-summaries',
  'npm --prefix frontend run test:syllabus-imports'
]);

assertIncludes('verify:security', [
  'verify:backend',
  'verify:db-security',
  'verify:supply-chain',
  'csca-byok:security',
  'organization-permissions:rules',
  'organization-governance:smoke',
  'admin-audit:organization-filter-smoke',
  'production-env-smoke.cjs'
]);

assertIncludes('verify:local', [
  'verify:csca-ai-questioning',
  'verify:governance',
  'csca-readiness:release-gate',
  'csca-wrong-questions:rules'
]);

assertIncludes('csca-syllabus:recovery-drill', [
  'csca-syllabus-recovery-drill.cjs'
]);

const runbook = fs.readFileSync(path.join(root, 'docs', 'ops-runbook.md'), 'utf8');
assert(runbook.includes('admin-audit templates'), 'Ops runbook must mention admin-audit templates in governance verification.');
assert(runbook.includes('organization-permissions:rules'), 'Ops runbook must mention organization permission checks in security verification.');
assert(runbook.includes('verify:governance'), 'Ops runbook must document the governance gate.');
assert(runbook.includes('verify:security'), 'Ops runbook must document the security gate.');
assert(runbook.includes('csca-syllabus:recovery-drill'), 'Ops runbook must document the CSCA syllabus recovery drill.');
assert(runbook.includes('reverse plan'), 'Ops runbook must document the syllabus reverse-plan safety boundary.');

console.log('Governance gate manifest check passed.');
