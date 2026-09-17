const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateRollbackTarget, restoreArgs, resetPublicSchemaArgs } = require('./lib/standalone-data-migration-policy.cjs');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='));
const targetUrl = process.env.MOODLELIKE_TARGET_DATABASE_URL || '';
const confirmTarget = process.env.CONFIRM_MOODLELIKE_TARGET_DATABASE || '';
const allowRemoteTarget = process.env.ALLOW_REMOTE_MOODLELIKE_TARGET === '1';
if (!manifestArg || !targetUrl) { console.error('Usage: set MOODLELIKE_TARGET_DATABASE_URL and pass --manifest=<path>.'); process.exit(1); }
const manifestPath = path.resolve(root, manifestArg.slice('--manifest='.length));
const allowedRoot = path.resolve(root, '.local', 'data-migrations');
if (!manifestPath.startsWith(allowedRoot + path.sep) || !fs.existsSync(manifestPath)) { console.error('Rollback manifest must exist under .local/data-migrations.'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let target;
try { target = validateRollbackTarget({ targetUrl, confirmTarget, expectedIdentity: manifest.target, expectedDatabase: manifest.targetDatabase, allowRemoteTarget }); }
catch (error) { console.error(error.message); process.exit(1); }
const manifestDir = path.dirname(manifestPath);
const expectedBackup = path.join(manifestDir, 'target-before.dump');
if (path.resolve(manifest.targetBackup || '') !== expectedBackup) { console.error('Rollback backup path does not match the selected migration run.'); process.exit(1); }
if (!fs.existsSync(manifest.targetBackup)) { console.error('Target pre-migration backup is missing.'); process.exit(1); }
console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', target: manifest.target, backup: manifest.targetBackup, migrationRun: manifest.runId }, null, 2));
if (!apply) { console.log('Plan only; target database was not modified.'); process.exit(0); }
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
const toolMount = process.env.MOODLELIKE_PG_TOOL_CONTAINER_MOUNT || '/migration';
function containerArgs(args) { return args.map((arg) => { if (arg.startsWith(allowedRoot)) return toolMount + arg.slice(allowedRoot.length).replaceAll('\\', '/'); if (arg.startsWith('postgres://') || arg.startsWith('postgresql://')) { const url = new URL(arg); url.hostname = 'localhost'; url.port = '5432'; return url.toString(); } return arg; }); }
function run(command, args, step) { const executable = toolContainer ? 'docker' : command; const commandArgs = toolContainer ? ['exec', toolContainer, command, ...containerArgs(args)] : args; const result = spawnSync(executable, commandArgs, { cwd: root, stdio: 'inherit', shell: false }); if (result.error || result.status !== 0) throw new Error(step + ' failed: ' + (result.error?.message || 'exit ' + result.status)); }
try { run('psql', resetPublicSchemaArgs(targetUrl), 'Rollback target public schema reset'); run('pg_restore', restoreArgs(targetUrl, manifest.targetBackup), 'Rollback restore'); }
catch (error) { console.error(error.message); process.exit(1); }
manifest.rollback = { status: 'completed', completedAt: new Date().toISOString() };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Rollback completed.');
