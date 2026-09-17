const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const backupFile = args.find((arg) => !arg.startsWith('--'));
const databaseUrl = process.env.DATABASE_URL;

function parseDatabase(value) {
  try {
    const parsed = new URL(value);
    return {
      host: parsed.hostname || '',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '')
    };
  } catch {
    return null;
  }
}

function describeDatabase(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname || 'unknown-host'}/${parsed.pathname.replace(/^\//, '') || 'unknown-db'}`;
  } catch {
    return '[unparseable DATABASE_URL]';
  }
}

function assertRestoreTargetAllowed(value) {
  const target = parseDatabase(value);
  if (!target) {
    console.error('Refusing to restore because DATABASE_URL is not parseable.');
    process.exit(1);
  }

  const searchable = `${target.host}/${target.database}`.toLowerCase();
  const explicitlyDisposable = /(?:test|restore|staging|stage|dev|local|demo)/i.test(searchable);
  if (explicitlyDisposable) return;

  const looksProduction = /(?:prod|production|cscalite)/i.test(searchable);
  if (!looksProduction) return;

  if (
    process.env.ALLOW_PRODUCTION_DB_RESTORE === '1' &&
    process.env.CONFIRM_RESTORE_DATABASE === target.database
  ) {
    return;
  }

  console.error(
    [
      `Refusing to restore to possible production database: ${target.host}/${target.database}.`,
      'Use a restore, staging, test, dev, or local database for normal restore drills.',
      'For an emergency production restore, set ALLOW_PRODUCTION_DB_RESTORE=1 and CONFIRM_RESTORE_DATABASE to the exact database name.'
    ].join('\n')
  );
  process.exit(1);
}

if (!databaseUrl) {
  console.error('DATABASE_URL is required for database restore.');
  process.exit(1);
}

if (!backupFile) {
  console.error('Usage: npm run db:restore -- <backup-file> [--dry-run]');
  process.exit(1);
}

const resolvedBackupFile = path.resolve(root, backupFile);
console.log(`Restore target database: ${describeDatabase(databaseUrl)}`);
console.log(`Restore source: ${resolvedBackupFile}`);

if (dryRun) {
  console.log('Dry run only; pg_restore was not executed.');
  process.exit(0);
}

if (process.env.ALLOW_DB_RESTORE !== '1') {
  console.error('Refusing to restore without ALLOW_DB_RESTORE=1.');
  process.exit(1);
}

assertRestoreTargetAllowed(databaseUrl);

if (!fs.existsSync(resolvedBackupFile)) {
  console.error(`Backup file does not exist: ${resolvedBackupFile}`);
  process.exit(1);
}

const result = spawnSync(
  'pg_restore',
  ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', databaseUrl, resolvedBackupFile],
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
