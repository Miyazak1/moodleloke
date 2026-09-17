const path = require('node:path');

function parsePostgresUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(label + ' must be a valid PostgreSQL URL.'); }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error(label + ' must use postgres:// or postgresql://.');
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
  if (!parsed.hostname || !database) throw new Error(label + ' must include host and database name.');
  return { protocol: parsed.protocol, host: parsed.hostname.toLowerCase(), port: parsed.port || '5432', database, username: decodeURIComponent(parsed.username || ''), url: value };
}

function identity(database) { return database.host + ':' + database.port + '/' + database.database.toLowerCase(); }
function publicIdentity(database) { return database.host + ':' + database.port + '/' + database.database; }
function sanitizeUrl(value) {
  const parsed = new URL(value);
  if (parsed.username) parsed.username = 'user';
  if (parsed.password) parsed.password = '***';
  return parsed.toString();
}
function isLocalHost(host) { return host === 'localhost' || host === '127.0.0.1' || host === '::1'; }

function validateMigrationInputs({ sourceUrl, targetUrl, confirmTarget, allowRemoteTarget = false }) {
  const source = parsePostgresUrl(sourceUrl, 'CSCALITE_SOURCE_DATABASE_URL');
  const target = parsePostgresUrl(targetUrl, 'MOODLELIKE_TARGET_DATABASE_URL');
  if (identity(source) === identity(target)) throw new Error('Source and target databases must be different.');
  if (confirmTarget !== target.database) throw new Error('CONFIRM_MOODLELIKE_TARGET_DATABASE must exactly match the target database name.');
  if (!allowRemoteTarget && !isLocalHost(target.host)) throw new Error('Remote targets require ALLOW_REMOTE_MOODLELIKE_TARGET=1.');
  return { source, target };
}

function validateRollbackTarget({ targetUrl, confirmTarget, expectedIdentity, expectedDatabase, allowRemoteTarget = false }) {
  const target = parsePostgresUrl(targetUrl, 'MOODLELIKE_TARGET_DATABASE_URL');
  if (confirmTarget !== target.database) throw new Error('CONFIRM_MOODLELIKE_TARGET_DATABASE must exactly match the target database name.');
  if (expectedIdentity !== publicIdentity(target) || expectedDatabase !== target.database) throw new Error('Rollback target does not exactly match the migration manifest.');
  if (!allowRemoteTarget && !isLocalHost(target.host)) throw new Error('Remote targets require ALLOW_REMOTE_MOODLELIKE_TARGET=1.');
  return target;
}

function safeRunDirectory(root, runId) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('Migration run id contains unsupported characters.');
  const base = path.resolve(root, '.local', 'data-migrations');
  const runDir = path.resolve(base, runId);
  if (!runDir.startsWith(base + path.sep)) throw new Error('Migration run directory escaped the local migration root.');
  return runDir;
}

function postgresToolUrl(databaseUrl) { const parsed = new URL(databaseUrl); parsed.searchParams.delete('schema'); return parsed.toString(); }
function dumpArgs(databaseUrl, outputFile) { return ['--format=custom', '--no-owner', '--no-privileges', '--file', outputFile, '--dbname', postgresToolUrl(databaseUrl)]; }
function restoreArgs(databaseUrl, dumpFile) { return ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', postgresToolUrl(databaseUrl), dumpFile]; }
function resetPublicSchemaArgs(databaseUrl) { return ['--dbname', postgresToolUrl(databaseUrl), '--set', 'ON_ERROR_STOP=1', '--command', 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;']; }

module.exports = { parsePostgresUrl, identity, publicIdentity, sanitizeUrl, validateMigrationInputs, validateRollbackTarget, safeRunDirectory, postgresToolUrl, dumpArgs, restoreArgs, resetPublicSchemaArgs };
