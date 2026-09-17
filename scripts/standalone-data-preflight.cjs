const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parsePostgresUrl, sanitizeUrl, postgresToolUrl } = require('./lib/standalone-data-migration-policy.cjs');
const { criticalTables, assessDataPreflight } = require('./lib/standalone-data-preflight-policy.cjs');

const root = path.resolve(__dirname, '..');
const databaseUrl = process.env.DATABASE_URL || '';
const label = (process.env.DATA_PREFLIGHT_LABEL || 'source').replace(/[^a-zA-Z0-9._-]/g, '-');
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
if (!databaseUrl) { console.error('Set DATABASE_URL. This command performs read-only metadata and aggregate checks.'); process.exit(1); }
let parsed;
try { parsed = parsePostgresUrl(databaseUrl, 'DATABASE_URL'); } catch (error) { console.error(error.message); process.exit(1); }
function toolUrl() { const url = new URL(postgresToolUrl(databaseUrl)); if (toolContainer) { url.hostname = 'localhost'; url.port = '5432'; } return url.toString(); }
function sql(query) {
  const args = ['--dbname', toolUrl(), '--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--command', 'BEGIN READ ONLY; ' + query + ' COMMIT;'];
  const executable = toolContainer ? 'docker' : 'psql';
  const commandArgs = toolContainer ? ['exec', toolContainer, 'psql', ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd: root, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'psql exited with ' + result.status);
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).find((line) => line !== 'BEGIN' && line !== 'COMMIT') || '';
}
function quoteIdentifier(value) { return '"' + String(value).replaceAll('"', '""') + '"'; }
try {
  const critical = criticalTables.map((name) => "('" + name.replaceAll("'", "''") + "')").join(',');
  const base = JSON.parse(sql("WITH critical(name) AS (VALUES " + critical + ") SELECT json_build_object('serverVersionNum', current_setting('server_version_num')::int, 'database', current_database(), 'databaseBytes', pg_database_size(current_database()), 'publicTableCount', (SELECT count(*) FROM pg_tables WHERE schemaname='public'), 'unvalidatedConstraints', COALESCE((SELECT json_agg(json_build_object('constraint', conname, 'table', conrelid::regclass::text) ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated), '[]'::json), 'criticalTablesMissing', COALESCE((SELECT json_agg(name ORDER BY name) FROM critical WHERE to_regclass('public.' || quote_ident(name)) IS NULL), '[]'::json), 'approximateRows', COALESCE((SELECT json_object_agg(relname, n_live_tup) FROM pg_stat_user_tables WHERE schemaname='public'), '{}'::json))::text;"));
  const hasMigrationTable = !(base.criticalTablesMissing || []).includes('_prisma_migrations');
  base.failedMigrationCount = hasMigrationTable ? Number(sql('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')) : -1;
  const sequenceRows = sql("SELECT COALESCE(json_agg(json_build_object('schema', ns.nspname, 'sequence', seq.relname, 'tableSchema', tn.nspname, 'table', tab.relname, 'column', att.attname)), '[]'::json)::text FROM pg_class seq JOIN pg_namespace ns ON ns.oid=seq.relnamespace JOIN pg_depend dep ON dep.objid=seq.oid AND dep.deptype IN ('a','i') JOIN pg_class tab ON tab.oid=dep.refobjid JOIN pg_namespace tn ON tn.oid=tab.relnamespace JOIN pg_attribute att ON att.attrelid=tab.oid AND att.attnum=dep.refobjsubid WHERE seq.relkind='S' AND tn.nspname='public';");
  const sequences = JSON.parse(sequenceRows || '[]');
  base.sequenceLag = [];
  for (const item of sequences) {
    const statement = 'SELECT CASE WHEN last_value < COALESCE((SELECT max(' + quoteIdentifier(item.column) + ') FROM ' + quoteIdentifier(item.tableSchema) + '.' + quoteIdentifier(item.table) + '), 0) THEN 1 ELSE 0 END FROM ' + quoteIdentifier(item.schema) + '.' + quoteIdentifier(item.sequence) + ';';
    if (Number(sql(statement)) === 1) base.sequenceLag.push({ table: item.table, column: item.column, sequence: item.sequence });
  }
  const assessment = assessDataPreflight(base);
  const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), label, database: parsed.host + ':' + parsed.port + '/' + parsed.database, connection: sanitizeUrl(databaseUrl), readOnly: true, ...base, ...assessment };
  const out = path.join(root, 'artifacts', 'data-preflight-' + label + '.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, database: report.database, publicTableCount: report.publicTableCount, blockers: report.blockers.length, warnings: report.warnings.length, artifact: out }));
  process.exit(report.status === 'passed' ? 0 : 2);
} catch (error) { console.error('Data preflight failed: ' + error.message); process.exit(1); }
