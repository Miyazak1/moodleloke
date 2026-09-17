const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));
const backupDir = path.resolve(root, process.env.BACKUP_DIR || path.join('.tmp', 'backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `cscalite-docker-release-window-${stamp}.dump`);
const restoreDryRun = process.env.VERIFY_RELEASE_WINDOW_LOCAL_RESTORE_DRY_RUN === 'true';

function run(label, command, args, env = {}) {
  console.log(`\n[release-window-local] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...env
    }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function writeEvidence() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `release-window-local-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const stats = fs.existsSync(backupFile) ? fs.statSync(backupFile) : undefined;
  fs.writeFileSync(file, `${JSON.stringify({
    kind: 'release-window-local',
    timestamp: new Date().toISOString(),
    localStagingBaseUrl: process.env.LOCAL_STAGING_BASE_URL || 'http://127.0.0.1:18080',
    backupFile: path.relative(root, backupFile).replace(/\\/g, '/'),
    backupSizeBytes: stats?.size,
    restoreDryRun,
    completed: true
  }, null, 2)}\n`);
  console.log(`[release-window-local] evidence written: ${file}`);
}

function main() {
  const localEnv = {
    LOCAL_STAGING_BASE_URL: process.env.LOCAL_STAGING_BASE_URL || 'http://127.0.0.1:18080',
    DOCKER_BACKUP_OUTPUT_FILE: backupFile,
    OPS_METRICS_TOKEN: process.env.OPS_METRICS_TOKEN || 'local-staging-metrics-token',
    STAGING_METRICS_TOKEN: process.env.STAGING_METRICS_TOKEN || process.env.OPS_METRICS_TOKEN || 'local-staging-metrics-token'
  };
  const candidateEnv = {
    ...localEnv,
    STAGING_BASE_URL: '',
    LOCAL_STAGING_BASE_URL: ''
  };

  run('release candidate gate', 'npm', ['run', 'verify:release-candidate'], candidateEnv);
  run('local Docker staging gate', 'npm', ['run', 'verify:docker:staging-local'], localEnv);
  run('Docker database backup', 'npm', ['run', 'db:backup:docker'], localEnv);
  run(
    restoreDryRun ? 'backup restore drill dry-run' : 'backup restore drill',
    'npm',
    ['run', 'verify:backup-restore-drill', '--', path.relative(root, backupFile), ...(restoreDryRun ? ['--dry-run'] : ['--docker'])],
    localEnv
  );
  writeEvidence();
  console.log('CSCAlite local release-window verification passed.');
}

try {
  main();
} catch (error) {
  console.error(`CSCAlite local release-window verification failed: ${error.message}`);
  process.exit(1);
}
