const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateMigrationInputs, publicIdentity, sanitizeUrl, safeRunDirectory, dumpArgs, restoreArgs, resetPublicSchemaArgs } = require('./lib/standalone-data-migration-policy.cjs');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const sourceUrl = process.env.CSCALITE_SOURCE_DATABASE_URL || '';
const targetUrl = process.env.MOODLELIKE_TARGET_DATABASE_URL || '';
const confirmTarget = process.env.CONFIRM_MOODLELIKE_TARGET_DATABASE || '';
const allowRemoteTarget = process.env.ALLOW_REMOTE_MOODLELIKE_TARGET === '1';
if (!sourceUrl || !targetUrl) {
  console.error('Set CSCALITE_SOURCE_DATABASE_URL and MOODLELIKE_TARGET_DATABASE_URL. Default mode is plan-only.');
  process.exit(1);
}
let validated;
try { validated = validateMigrationInputs({ sourceUrl, targetUrl, confirmTarget, allowRemoteTarget }); }
catch (error) { console.error(error.message); process.exit(1); }

const runId = process.env.MOODLELIKE_MIGRATION_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const runDir = safeRunDirectory(root, runId);
const targetBackup = path.join(runDir, 'target-before.dump');
const sourceDump = path.join(runDir, 'source-cscalite.dump');
const manifestPath = path.join(runDir, 'manifest.json');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', source: sanitizeUrl(sourceUrl), target: sanitizeUrl(targetUrl), runDir, steps: ['backup-target', 'dump-source', 'reset-target-public-schema', 'restore-source-to-target', 'write-manifest'] }, null, 2));
if (!apply) { console.log('Plan only; no database command executed.'); process.exit(0); }

fs.mkdirSync(runDir, { recursive: true });
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
const toolMount = process.env.MOODLELIKE_PG_TOOL_CONTAINER_MOUNT || '/migration';
function containerArgs(args) {
  return args.map((arg) => {
    if (typeof arg !== 'string') return arg;
    if (arg.startsWith(path.resolve(root, '.local', 'data-migrations'))) return toolMount + arg.slice(path.resolve(root, '.local', 'data-migrations').length).replaceAll('\\', '/');
    if (arg.startsWith('postgres://') || arg.startsWith('postgresql://')) { const url = new URL(arg); url.hostname = 'localhost'; url.port = '5432'; return url.toString(); }
    return arg;
  });
}
function run(command, args, step) {
  const executable = toolContainer ? 'docker' : command;
  const commandArgs = toolContainer ? ['exec', toolContainer, command, ...containerArgs(args)] : args;
  const result = spawnSync(executable, commandArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error(step + ' failed: ' + (result.error?.message || 'exit ' + result.status));
}
const manifest = { schemaVersion: '1', runId, status: 'started', startedAt: new Date().toISOString(), source: publicIdentity(validated.source), target: publicIdentity(validated.target), targetDatabase: validated.target.database, targetBackup, sourceDump };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
try {
  run('pg_dump', dumpArgs(targetUrl, targetBackup), 'Target pre-migration backup');
  run('pg_dump', dumpArgs(sourceUrl, sourceDump), 'Source export');
  run('psql', resetPublicSchemaArgs(targetUrl), 'Target public schema reset');
  run('pg_restore', restoreArgs(targetUrl, sourceDump), 'Source restore into target');
  Object.assign(manifest, { status: 'completed', completedAt: new Date().toISOString() });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Migration completed. Rollback manifest: ' + manifestPath);
} catch (error) {
  Object.assign(manifest, { status: 'failed', failedAt: new Date().toISOString(), error: error.message });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.error(error.message); process.exit(1);
}
