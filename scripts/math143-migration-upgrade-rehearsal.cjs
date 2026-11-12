'use strict';
// Upgrade rehearsal on the throwaway RESTORED COPY only, never on a source/site DB.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, process.argv.includes('--layout') ? '.local/math143-layout-release' : process.argv.includes('--figures') ? '.local/math143-figures-release' : '.local/math143-release');
const evidence = JSON.parse(fs.readFileSync(path.join(directory, 'production-rehearsal-evidence.json'), 'utf8'));
assert.equal(evidence.status, 'pass', 'Complete the production-image rehearsal first');
const project = JSON.parse(fs.readFileSync(path.join(directory, 'latest-project.json'), 'utf8'));
assert.equal(project.project, evidence.project);
assert.match(project.project, /^moodlelike-math143-(?:(?:figures|layout)-)?rehearsal-\d+$/);
assert.equal(path.resolve(project.envFile), path.join(directory, project.project + '.env'));
assert.equal(path.resolve(project.composeFile), path.join(root, 'deploy/docker-compose.math143-rehearsal.yml'));
const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) if (/^MATH143_REHEARSAL_|^COMPOSE_/.test(key)) delete childEnv[key];
function docker(args) {
  const r = spawnSync('docker', args, { cwd: root, env: childEnv, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error('Local Docker upgrade drill failed: ' + r.stderr.slice(-1500));
  return r.stdout.trim();
}
function compose(args) { return docker(['compose', '--env-file', project.envFile, '-p', project.project, '-f', project.composeFile, ...args]); }
function db(code) {
  const wrapper = `const {PrismaClient}=require('./backend/node_modules/@prisma/client');const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='db'||u.pathname!=='/moodlelike_math143_rehearsal')throw Error('wrong_local_source');u.pathname='/moodlelike_math143_restore';const p=new PrismaClient({datasources:{db:{url:u.href}}});(async()=>{${code}})().then(v=>console.log(JSON.stringify(v))).finally(()=>p.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1});`;
  return JSON.parse(compose(['run', '--rm', '--no-deps', 'backend', 'node', '-e', wrapper]));
}
const production0098 = process.argv.includes('--layout');
const migrationNames = ['0100_verified_math_practice_identity','0101_verified_question_generation_tasks'];
if (production0098) migrationNames.unshift('0099_daily_learning_task_executions');
const migrationSqlList = migrationNames.map(name => "'" + name + "'").join(',');
const snapshotCode = `const {createHash}=require('node:crypto');const tables=await p.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','verified_question_generation_tasks'${production0098 ? ",'daily_learning_task_executions'" : ''}) ORDER BY tablename");const result=[];for(const {tablename:t} of tables){if(!/^[a-zA-Z0-9_]+$/.test(t))throw Error('invalid_table');const data=await p.$queryRawUnsafe('SELECT row_to_json(r)::text AS data FROM "'+t+'" r ORDER BY row_to_json(r)::text');result.push({table:t,count:data.length,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')});}return result;`;
const result = { schemaVersion: 'math143-additive-upgrade-rehearsal-v1', project: project.project,
  targetDatabase: 'moodlelike_math143_restore', productionOrSourceDatabaseTouched: false, images: evidence.images };
try {
  const context = docker(['context', 'show']);
  assert.match(JSON.parse(docker(['context', 'inspect', context]))[0].Endpoints.docker.Host, /^(?:npipe|unix):\/\//);
  compose(['up', '-d', '--wait', 'db']);
  const before = db(snapshotCode);
  // Remove ONLY the new objects and migration records in the disposable copy,
  // so the real deploy command must upgrade an already populated pre-plugin schema.
  db(`await p.$executeRawUnsafe('DROP INDEX IF EXISTS uq_verified_math_practice_identity');await p.$executeRawUnsafe('DROP TABLE verified_question_generation_tasks');${production0098 ? "await p.$executeRawUnsafe('DROP TABLE daily_learning_task_executions');" : ''}await p.$executeRawUnsafe("DELETE FROM _prisma_migrations WHERE migration_name IN (${migrationSqlList})");return true;`);
  if (production0098) {
    const preflight = fs.readFileSync(path.join(root, 'deploy/math143-migration-preflight.cjs')).toString('base64');
    compose(['run', '--rm', '--no-deps', '--entrypoint', 'node', 'migrate', '-e', `const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='db'||u.pathname!=='/moodlelike_math143_rehearsal')throw Error('wrong_local_source');u.pathname='/moodlelike_math143_restore';process.env.DATABASE_URL=u.href;process.argv.push('--local-rehearsal');require('fs').writeFileSync('/tmp/math143-preflight.cjs',Buffer.from('${preflight}','base64'));require('/tmp/math143-preflight.cjs');`]);
    result.readOnlyMigrationPreflight = 'pass';
  }
  const upgrade = `const {spawnSync}=require('node:child_process');const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='db'||u.pathname!=='/moodlelike_math143_rehearsal')throw Error('wrong_local_source');u.pathname='/moodlelike_math143_restore';process.env.DATABASE_URL=u.href;const r=spawnSync(process.execPath,['scripts/prisma-cli.cjs','migrate','deploy'],{env:process.env,stdio:'inherit'});process.exit(r.status??1);`;
  compose(['run', '--rm', '--no-deps', '--entrypoint', 'node', 'migrate', '-e', upgrade]);
  assert.deepEqual(db(snapshotCode), before, 'Existing bank/student/learning rows changed during upgrade');
  assert.equal(db("return p.verifiedQuestionGenerationTask.count();"), 0);
  const migrations = db(`return p.$queryRawUnsafe("SELECT migration_name FROM _prisma_migrations WHERE migration_name IN (${migrationSqlList}) AND finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name");`);
  assert.equal(migrations.length, migrationNames.length);
  result.upgradeFrom = production0098 ? '0098' : '0099';
  result.status = 'pass'; result.existingTablesUnchanged = before.length; result.tableSnapshots = before; result.newMigrationsApplied = migrations;
  console.log('MATH143_ADDITIVE_UPGRADE_OK: populated restored copy upgraded; ' + before.length + ' existing tables unchanged.');
} catch (error) { result.status = 'failed'; result.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(directory, 'migration-upgrade-evidence.json'), JSON.stringify(result, null, 2) + '\n');
  try { compose(['stop', 'db']); } catch (error) { console.error(error.message); }
}
