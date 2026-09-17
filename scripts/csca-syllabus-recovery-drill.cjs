const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || '.tmp/release-evidence');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceFile = path.join(evidenceDir, `csca-syllabus-recovery-drill-${timestamp}.json`);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function tail(text, maxLines = 80) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - maxLines));
}

fs.mkdirSync(evidenceDir, { recursive: true });

const startedAt = new Date().toISOString();
const result = spawnSync(npmCommand, ['run', 'csca-ai-questioning:smoke'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  env: process.env
});
const finishedAt = new Date().toISOString();
const passed = result.status === 0;

const evidence = {
  reportType: 'csca-syllabus-recovery-drill',
  generatedAt: finishedAt,
  startedAt,
  finishedAt,
  status: passed ? 'passed' : 'failed',
  command: 'npm run csca-ai-questioning:smoke',
  scope: [
    'syllabus_json_import_preview',
    'syllabus_json_import_apply',
    'syllabus_reverse_plan_dry_run',
    'syllabus_recovery_draft',
    'admin_audit_recovery_and_reverse_plan',
    'stale_question_review_metadata'
  ],
  safetyBoundary: [
    'Runs only against the configured local/disposable verification database.',
    'Does not provide destructive rollback.',
    'Reverse-plan verification is dry-run only.',
    'Questions moved to pending_review remain manual-review items.'
  ],
  exitCode: result.status,
  signal: result.signal,
  error: result.error ? { name: result.error.name, message: result.error.message } : null,
  stdoutTail: tail(result.stdout),
  stderrTail: tail(result.stderr)
};

fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
console.log(`CSCA syllabus recovery drill evidence written: ${path.relative(root, evidenceFile)}`);
if (!passed) {
  console.error('CSCA syllabus recovery drill failed. See evidence file for output tail.');
  process.exit(result.status || 1);
}
console.log('CSCA syllabus recovery drill passed.');
