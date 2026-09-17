const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceDocker = args.includes('--docker');
const backupFile = args.find((arg) => !arg.startsWith('--')) || process.env.BACKUP_RESTORE_DRILL_FILE;
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function describeDatabase(value) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return {
      host: parsed.hostname || 'unknown-host',
      database: parsed.pathname.replace(/^\//, '') || 'unknown-db'
    };
  } catch {
    return { host: 'unparseable', database: 'unparseable' };
  }
}

function run(label, command, nextArgs, env) {
  console.log(`[restore-drill] ${label}`);
  const result = spawnSync(command, nextArgs, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function writeEvidence(evidence) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `restore-drill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`[restore-drill] evidence written: ${file}`);
}

function main() {
  assert(backupFile, 'Usage: npm run verify:backup-restore-drill -- <backup-file> [--dry-run], or set BACKUP_RESTORE_DRILL_FILE.');
  const resolved = path.resolve(root, backupFile);
  assert(resolved.startsWith(root), 'Backup file must be inside the workspace for the drill.');
  assert(fs.existsSync(resolved), `Backup file does not exist: ${resolved}`);
  assert(!/placeholder/i.test(path.basename(resolved)), 'Restore drill requires a real backup file, not the placeholder dump.');

  const stats = fs.statSync(resolved);
  assert(stats.size > 0, 'Backup file is empty.');

  const evidence = {
    kind: 'backup-restore-drill',
    timestamp: new Date().toISOString(),
    dryRun,
    backupFile: path.relative(root, resolved).replace(/\\/g, '/'),
    backupSizeBytes: stats.size,
    restoreTarget: describeDatabase(process.env.RESTORE_TEST_DATABASE_URL),
    usedDockerFallback: forceDocker || (!process.env.RESTORE_TEST_DATABASE_URL && !dryRun)
  };

  run('restore smoke', process.execPath, [
    'scripts/db-restore-smoke.cjs',
    path.relative(root, resolved),
    ...(dryRun ? ['--dry-run'] : []),
    ...(forceDocker ? ['--docker'] : [])
  ], {
    ...process.env,
    RELEASE_EVIDENCE_DIR: evidenceDir
  });
  evidence.completedAt = new Date().toISOString();
  writeEvidence(evidence);
  console.log('CSCAlite backup restore drill passed.');
}

try {
  main();
} catch (error) {
  console.error(`CSCAlite backup restore drill failed: ${error.message}`);
  process.exit(1);
}
