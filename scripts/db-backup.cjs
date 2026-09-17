const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const databaseUrl = process.env.DATABASE_URL;
const backupDir = path.resolve(root, process.env.BACKUP_DIR || path.join('.tmp', 'backups'));

function sanitizeDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '[unparseable DATABASE_URL]';
  }
}

function buildBackupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDir, `cscalite-${stamp}.dump`);
}

if (!databaseUrl) {
  console.error('DATABASE_URL is required for database backup.');
  process.exit(1);
}

const outputFile = buildBackupPath();
console.log(`Backup target database: ${sanitizeDatabaseUrl(databaseUrl)}`);
console.log(`Backup output: ${outputFile}`);

if (dryRun) {
  console.log('Dry run only; pg_dump was not executed.');
  process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });

const result = spawnSync(
  'pg_dump',
  ['--format=custom', '--no-owner', '--no-privileges', '--file', outputFile, '--dbname', databaseUrl],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
