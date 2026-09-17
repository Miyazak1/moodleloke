const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const hostPort = process.env.PHASE3B_HOST_PORT || '57432';
const sourceDatabase = 'source_phase3b';
const targetDatabase = 'target_phase3b';
const password = 'phase3b-local-only';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const container = 'moodlelike-phase3b-' + process.pid + '-' + Date.now();
const runId = 'phase3b-' + stamp;
const migrationRoot = path.join(root, '.local', 'data-migrations');
const evidenceRoot = path.join(root, 'artifacts');
const sourceUrl = 'postgresql://postgres:' + password + '@localhost:' + hostPort + '/' + sourceDatabase + '?schema=public';
const targetUrl = 'postgresql://postgres:' + password + '@localhost:' + hostPort + '/' + targetDatabase + '?schema=public';
const manifestRelative = path.join('.local', 'data-migrations', runId, 'manifest.json');
const plan = { mode: apply ? 'apply' : 'plan', isolation: 'disposable-docker-container', image: 'postgres:16-alpine', hostPort, sourceDatabase, targetDatabase, steps: ['start-disposable-postgres', 'deploy-97-prisma-migrations-to-source', 'run-clean-and-blocked-preflight-probes', 'seed-source-and-target-probes', 'run-migration-apply', 'verify-schema-and-probes', 'run-rollback-apply', 'verify-exact-rollback', 'remove-disposable-container'] };
console.log(JSON.stringify(plan, null, 2));
if (!apply) { console.log('Plan only; Docker and databases were not touched.'); process.exit(0); }

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || root, env: options.env || process.env, encoding: options.capture ? 'utf8' : undefined, stdio: options.capture ? 'pipe' : 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error((options.label || command) + ' failed: ' + (result.error?.message || result.stderr || 'exit ' + result.status));
  return options.capture ? String(result.stdout || '').trim() : '';
}
function docker(args, options = {}) { return run('docker', args, options); }
function query(database, sql) { return docker(['exec', container, 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { capture: true, label: 'PostgreSQL verification' }); }
function runNode(script, args, extraEnv) { return run(process.execPath, [path.join(root, 'scripts', script), ...args], { env: { ...process.env, ...extraEnv }, label: script }); }

let created = false;
const evidence = { schemaVersion: '1', runId, startedAt: new Date().toISOString(), containerImage: 'postgres:16-alpine', sourceDatabase, targetDatabase, checks: {} };
try {
  fs.mkdirSync(migrationRoot, { recursive: true });
  fs.mkdirSync(evidenceRoot, { recursive: true });
  docker(['run', '-d', '--name', container, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=' + sourceDatabase, '-p', '127.0.0.1:' + hostPort + ':5432', '--mount', 'type=bind,source=' + migrationRoot + ',target=/migration', 'postgres:16-alpine'], { capture: true, label: 'Start disposable PostgreSQL' });
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const check = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', sourceDatabase], { stdio: 'ignore', shell: false });
    if (check.status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready.');
  docker(['exec', container, 'createdb', '-U', 'postgres', targetDatabase], { label: 'Create target database' });
  const prismaCli = path.join(root, 'backend', 'node_modules', 'prisma', 'build', 'index.js');
  run(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', path.join(root, 'backend', 'prisma', 'schema.prisma')], { cwd: path.join(root, 'backend'), env: { ...process.env, DATABASE_URL: sourceUrl }, label: 'Deploy Prisma migrations' });
  const preflightEnv = { DATABASE_URL: sourceUrl, MOODLELIKE_PG_TOOL_CONTAINER: container };
  runNode('standalone-data-preflight.cjs', [], { ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-clean-baseline' });
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE TABLE phase3c_invalid_probe(id integer); ALTER TABLE phase3c_invalid_probe ADD CONSTRAINT phase3c_probe_not_valid CHECK (id > 0) NOT VALID;'], { label: 'Create blocked preflight probe' });
  const blockedProbe = spawnSync(process.execPath, [path.join(root, 'scripts', 'standalone-data-preflight.cjs')], { cwd: root, env: { ...process.env, ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-blocked-probe' }, stdio: 'inherit', shell: false });
  if (blockedProbe.status !== 2) throw new Error('Data preflight did not block an unvalidated constraint.');
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP TABLE phase3c_invalid_probe;'], { label: 'Remove blocked preflight probe' });
  runNode('standalone-data-preflight.cjs', [], { ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-source' });
  evidence.checks.preflightCleanStatus = 'passed';
  evidence.checks.preflightBlockedProbeStatus = 'blocked';
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE phase3b_source_probe(id integer PRIMARY KEY, label text NOT NULL); INSERT INTO phase3b_source_probe VALUES (1, 'alpha'), (2, 'beta');"], { label: 'Seed source probe' });
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE phase3b_target_sentinel(id integer PRIMARY KEY, label text NOT NULL); INSERT INTO phase3b_target_sentinel VALUES (1, 'before');"], { label: 'Seed rollback sentinel' });
  const toolEnv = { CSCALITE_SOURCE_DATABASE_URL: sourceUrl, MOODLELIKE_TARGET_DATABASE_URL: targetUrl, CONFIRM_MOODLELIKE_TARGET_DATABASE: targetDatabase, MOODLELIKE_MIGRATION_RUN_ID: runId, MOODLELIKE_PG_TOOL_CONTAINER: container, MOODLELIKE_PG_TOOL_CONTAINER_MOUNT: '/migration' };
  runNode('standalone-data-migration.cjs', ['--apply'], toolEnv);
  evidence.checks.sourceTableCount = Number(query(sourceDatabase, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
  evidence.checks.migratedTableCount = Number(query(targetDatabase, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
  evidence.checks.migratedProbeRows = Number(query(targetDatabase, 'SELECT count(*) FROM phase3b_source_probe;'));
  evidence.checks.targetSentinelAfterMigration = query(targetDatabase, "SELECT COALESCE(to_regclass('public.phase3b_target_sentinel')::text, 'missing');");
  evidence.checks.prismaMigrationRows = Number(query(targetDatabase, 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;'));
  if (evidence.checks.migratedProbeRows !== 2 || evidence.checks.targetSentinelAfterMigration !== 'missing' || evidence.checks.sourceTableCount !== evidence.checks.migratedTableCount) throw new Error('Migration verification did not produce an exact source copy.');
  runNode('standalone-data-rollback.cjs', ['--apply', '--manifest=' + manifestRelative], { MOODLELIKE_TARGET_DATABASE_URL: targetUrl, CONFIRM_MOODLELIKE_TARGET_DATABASE: targetDatabase, MOODLELIKE_PG_TOOL_CONTAINER: container, MOODLELIKE_PG_TOOL_CONTAINER_MOUNT: '/migration' });
  evidence.checks.rollbackSentinelRows = Number(query(targetDatabase, 'SELECT count(*) FROM phase3b_target_sentinel;'));
  evidence.checks.sourceProbeAfterRollback = query(targetDatabase, "SELECT COALESCE(to_regclass('public.phase3b_source_probe')::text, 'missing');");
  if (evidence.checks.rollbackSentinelRows !== 1 || evidence.checks.sourceProbeAfterRollback !== 'missing') throw new Error('Rollback verification failed.');
  Object.assign(evidence, { status: 'passed', completedAt: new Date().toISOString(), manifest: manifestRelative });
  fs.writeFileSync(path.join(evidenceRoot, 'phase3b-data-rehearsal.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('Phase 3B data rehearsal passed.');
} catch (error) {
  Object.assign(evidence, { status: 'failed', failedAt: new Date().toISOString(), error: error.message });
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, 'phase3b-data-rehearsal.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) { const removed = spawnSync('docker', ['rm', '-f', container], { stdio: 'inherit', shell: false }); if (removed.status !== 0) console.error('Manual cleanup required for disposable container: ' + container); }
}
