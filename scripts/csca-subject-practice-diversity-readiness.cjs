const { execFileSync } = require('node:child_process');
const path = require('node:path');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveIntArg(name, fallback, min, max) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function parseReadiness(stdout, subject) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse ${subject} readiness JSON: ${error.message}`);
  }
}

function readinessForSubject(subject, options) {
  const auditScript = path.resolve(__dirname, 'csca-subject-practice-production-audit.cjs');
  const args = [
    auditScript,
    `--subject=${subject}`,
    `--sample=${options.sample}`,
    `--days=${subject === 'chemistry' ? options.chemistryDays : options.days}`,
    '--readiness'
  ];
  if (subject === 'chemistry' && options.chemistryRun) args.push(`--run=${options.chemistryRun}`);
  if (options.qualityAuditLedger) args.push(`--quality-audit-ledger=${options.qualityAuditLedger}`);
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return parseReadiness(stdout, subject);
}

function aggregateStatus(subjects) {
  if (subjects.some((item) => item.status === 'needs_work')) return 'needs_work';
  if (subjects.some((item) => item.status === 'calibrated_with_guardrails')) return 'calibrated_with_guardrails';
  if (subjects.every((item) => item.status === 'ready_for_next_phase')) return 'ready_for_next_phase';
  return 'monitor';
}

function summarizeSubjects(subjects) {
  return subjects.map((item) => ({
    subject: item.subject,
    status: item.status,
    phases: Array.isArray(item.phases)
      ? item.phases.map((phase) => ({
        phase: phase.phase,
        status: phase.status
      }))
      : []
  }));
}

function main() {
  const sample = positiveIntArg('sample', 40, 1, 50);
  const days = positiveIntArg('days', 30, 1, 60);
  const chemistryDays = positiveIntArg('chemistry-days', 1, 1, 60);
  const chemistryRun = cleanText(argValue('chemistry-run', ''));
  const qualityAuditLedger = cleanText(argValue('quality-audit-ledger', argValue('manual-review-ledger', '')));
  const subjects = ['chemistry', 'math', 'physics'].map((subject) => readinessForSubject(subject, {
    sample,
    days,
    chemistryDays,
    chemistryRun,
    qualityAuditLedger
  }));
  const report = {
    mode: 'audit_only',
    scope: 'chemistry_math_physics',
    status: aggregateStatus(subjects),
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'excluded_from_diversity_quality_memory',
    subjects,
    summary: summarizeSubjects(subjects)
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
