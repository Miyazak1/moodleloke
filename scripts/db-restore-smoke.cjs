const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceDocker = args.includes('--docker') || process.env.RESTORE_SMOKE_FORCE_DOCKER === 'true';
const backupFile = args.find((arg) => !arg.startsWith('--'));
let restoreUrl =
  (forceDocker && !dryRun ? undefined : process.env.RESTORE_TEST_DATABASE_URL) ||
  (dryRun ? 'postgresql://postgres:postgres@localhost:5432/cscalite_restore_test?schema=public' : undefined);
let dockerContainerName;

function run(label, command, nextArgs, env) {
  console.log(`[restore-smoke] ${label}`);
  const result = spawnSync(command, nextArgs, {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function runCapture(label, command, nextArgs, env) {
  console.log(`[restore-smoke] ${label}`);
  const result = spawnSync(command, nextArgs, {
    cwd: root,
    encoding: 'utf8',
    env,
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSafeRestoreUrl(value) {
  if (!value) throw new Error('RESTORE_TEST_DATABASE_URL is required.');
  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, '');
  if (!/test|restore|staging/i.test(databaseName)) {
    throw new Error('RESTORE_TEST_DATABASE_URL database name must include test, restore, or staging.');
  }
}

function describeDatabase(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname || 'unknown-host'}/${parsed.pathname.replace(/^\//, '') || 'unknown-db'}`;
  } catch {
    return '[unparseable RESTORE_TEST_DATABASE_URL]';
  }
}

async function countKeyTables() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: restoreUrl } } });
  const keyTables = [
    'users',
    'schools',
    'school_programs',
    'school_csca_rules',
    'school_scholarships',
    'content_blocks',
    'admin_audit_logs',
    'refresh_sessions',
    'mock_exam_papers',
    'mock_exam_questions',
    'special_practice_topics',
    'special_practice_questions'
  ];
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'users',
          'schools',
          'school_programs',
          'school_csca_rules',
          'school_scholarships',
          'content_blocks',
          'admin_audit_logs',
          'refresh_sessions',
          'mock_exam_papers',
          'mock_exam_questions',
          'special_practice_topics',
          'special_practice_questions'
        )
      ORDER BY table_name
    `;
    console.log(`[restore-smoke] restored key tables: ${tables.map((row) => row.table_name).join(', ') || 'none'}`);
    const present = new Set(tables.map((row) => row.table_name));
    const missing = keyTables.filter((table) => !present.has(table));
    if (missing.length) throw new Error(`Missing key CSCAlite tables after restore: ${missing.join(', ')}`);

    for (const table of keyTables) {
      const counts = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const count = Number(counts[0]?.count ?? 0);
      console.log(`[restore-smoke] ${table} rows: ${count}`);
      await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT 1`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function startDockerRestoreDatabase() {
  dockerContainerName = `cscalite-restore-smoke-${Date.now()}`;
  runCapture('start temporary Docker Postgres', 'docker', [
    'run',
    '-d',
    '--rm',
    '--name',
    dockerContainerName,
    '-e',
    'POSTGRES_PASSWORD=postgres',
    '-e',
    'POSTGRES_DB=cscalite_restore_test',
    '-v',
    `${root}:/workspace:ro`,
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine'
  ]);

  const deadline = Date.now() + Number(process.env.RESTORE_SMOKE_DOCKER_TIMEOUT_MS || 60000);
  while (Date.now() < deadline) {
    const ready = spawnSync('docker', ['exec', dockerContainerName, 'pg_isready', '-U', 'postgres', '-d', 'cscalite_restore_test'], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    if (ready.status === 0) {
      const portOutput = runCapture('resolve temporary Docker Postgres port', 'docker', ['port', dockerContainerName, '5432/tcp']);
      const port = portOutput.match(/:(\d+)\s*$/)?.[1];
      if (!port) throw new Error(`Could not parse Docker Postgres port: ${portOutput}`);
      restoreUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/cscalite_restore_test?schema=public`;
      return;
    }
    await delay(1000);
  }
  throw new Error('temporary Docker Postgres did not become ready.');
}

function toContainerBackupPath(file) {
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(root)) {
    throw new Error('Backup file must be inside the workspace for Docker restore smoke.');
  }
  return `/workspace/${path.relative(root, resolved).replace(/\\/g, '/')}`;
}

function restoreIntoDockerDatabase(file) {
  const resolved = path.resolve(root, file);
  if (!fs.existsSync(resolved)) throw new Error(`Backup file does not exist: ${resolved}`);
  run('restore into temporary Docker database', 'docker', [
    'exec',
    dockerContainerName,
    'pg_restore',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    'postgresql://postgres:postgres@127.0.0.1:5432/cscalite_restore_test',
    toContainerBackupPath(file)
  ]);
}

function stopDockerRestoreDatabase() {
  if (!dockerContainerName) return;
  spawnSync('docker', ['stop', dockerContainerName], {
    cwd: root,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });
}

async function main() {
  if (!backupFile) throw new Error('Usage: npm run db:restore:smoke -- <backup-file> [--dry-run]');
  if (!restoreUrl && !dryRun) {
    await startDockerRestoreDatabase();
  }
  assertSafeRestoreUrl(restoreUrl);
  const resolvedBackup = path.resolve(root, backupFile);
  if (fs.existsSync(resolvedBackup)) {
    const stats = fs.statSync(resolvedBackup);
    console.log(`[restore-smoke] backup file: ${resolvedBackup}`);
    console.log(`[restore-smoke] backup size bytes: ${stats.size}`);
  } else {
    console.log(`[restore-smoke] backup file: ${resolvedBackup}`);
    console.log('[restore-smoke] backup file does not exist; dry-run can still validate target selection.');
  }
  console.log(`[restore-smoke] restore target: ${describeDatabase(restoreUrl)}`);

  const env = {
    ...process.env,
    DATABASE_URL: restoreUrl,
    ALLOW_DB_RESTORE: '1'
  };

  if (dryRun) {
    run('restore dry-run', process.execPath, ['scripts/db-restore.cjs', backupFile, '--dry-run'], env);
    console.log('CSCAlite restore smoke dry-run passed.');
    return;
  }

  if (dockerContainerName) {
    restoreIntoDockerDatabase(backupFile);
  } else {
    run('restore into test database', process.execPath, ['scripts/db-restore.cjs', backupFile], env);
  }
  run('migration status on restored database', process.execPath, ['scripts/prisma-cli.cjs', 'migrate', 'status'], env);
  await countKeyTables();
  run('validate restored mock exams', process.execPath, ['scripts/validate-mock-exams.cjs'], env);
  run('validate restored special practice', process.execPath, ['scripts/validate-special-practice.cjs'], env);
  console.log('CSCAlite restore smoke passed.');
}

main().catch((error) => {
  console.error(`CSCAlite restore smoke failed: ${error.message}`);
  process.exitCode = 1;
}).finally(() => {
  stopDockerRestoreDatabase();
});
