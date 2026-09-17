const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exceptionFile = path.join(root, 'security', 'audit-exceptions.json');
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const minimumRank = severityRank.moderate;
const exceptionReviewWindowDays = Number(process.env.AUDIT_EXCEPTION_REVIEW_WINDOW_DAYS || 30);

function runAudit(scope, cwd, omitDev) {
  const command = `npm audit --json${omitDev ? ' --omit=dev' : ''}`;
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true
  });
  if (result.error) throw result.error;
  const output = result.stdout || result.stderr || '{}';
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error(`${scope} npm audit did not return JSON: ${output.slice(0, 300)}`);
  }
  return report;
}

function loadExceptions() {
  const source = JSON.parse(fs.readFileSync(exceptionFile, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  return source.exceptions.map((item) => {
    assert.ok(item.scope, 'audit exception scope is required');
    assert.ok(item.package, 'audit exception package is required');
    assert.ok(item.severity, 'audit exception severity is required');
    assert.ok(item.expiresOn, 'audit exception expiresOn is required');
    assert.ok(item.reason, 'audit exception reason is required');
    assert.ok(item.mitigation, 'audit exception mitigation is required');
    if (item.expiresOn < today) {
      throw new Error(`audit exception expired: ${item.scope}/${item.package}`);
    }
    const expiresMs = Date.parse(`${item.expiresOn}T00:00:00.000Z`);
    assert.ok(Number.isFinite(expiresMs), `audit exception expiresOn must be a YYYY-MM-DD date: ${item.scope}/${item.package}`);
    const daysUntilExpiry = Math.floor((expiresMs - todayMs) / 86400000);
    if (daysUntilExpiry <= exceptionReviewWindowDays) {
      throw new Error(`audit exception needs review within ${exceptionReviewWindowDays} days: ${item.scope}/${item.package} expires ${item.expiresOn}`);
    }
    return item;
  });
}

function relevantVulnerabilities(report) {
  return Object.values(report.vulnerabilities || {}).filter((item) => severityRank[item.severity] >= minimumRank);
}

function exceptionMatches(exception, scope, vulnerability) {
  return (
    exception.scope === scope &&
    exception.package === vulnerability.name &&
    severityRank[exception.severity] >= severityRank[vulnerability.severity]
  );
}

function assertNoUnrecorded(scope, report, exceptions) {
  const relevant = relevantVulnerabilities(report);
  const unrecorded = relevant.filter((vulnerability) => !exceptions.some((exception) => exceptionMatches(exception, scope, vulnerability)));
  if (unrecorded.length) {
    const summary = unrecorded.map((item) => `${item.name}:${item.severity}`).join(', ');
    throw new Error(`${scope} has unrecorded moderate/high audit findings: ${summary}`);
  }
  console.log(`[supply-chain] ${scope}: ${relevant.length} moderate/high findings, all recorded.`);
}

function assertClean(scope, report) {
  const relevant = relevantVulnerabilities(report);
  if (relevant.length) {
    const summary = relevant.map((item) => `${item.name}:${item.severity}`).join(', ');
    throw new Error(`${scope} has moderate/high audit findings: ${summary}`);
  }
  console.log(`[supply-chain] ${scope}: clean.`);
}

function printDevReport(report) {
  const relevant = relevantVulnerabilities(report);
  if (!relevant.length) {
    console.log('[supply-chain] backend-dev: clean.');
    return;
  }
  console.log(`[supply-chain] backend-dev: ${relevant.length} moderate/high findings reported only:`);
  for (const item of relevant) {
    console.log(`  - ${item.name}:${item.severity}`);
  }
}

function main() {
  const exceptions = loadExceptions();
  assertClean('root-prod', runAudit('root-prod', root, true));
  assertClean('frontend-prod', runAudit('frontend-prod', path.join(root, 'frontend'), true));
  assertNoUnrecorded('backend-prod', runAudit('backend-prod', path.join(root, 'backend'), true), exceptions);
  printDevReport(runAudit('backend-dev', path.join(root, 'backend'), false));
  console.log('CSCAlite supply-chain verification passed.');
}

main();
