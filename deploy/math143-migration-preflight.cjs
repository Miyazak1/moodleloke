'use strict';
// Run from the migration image with the existing production connection, read-only.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('/app/backend/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'db');
assert.equal(url.pathname, process.argv.includes('--local-rehearsal') ? '/moodlelike_math143_restore' : '/moodlelike');
const root = '/app/backend/prisma/migrations';
const expected = ['0099_daily_learning_task_executions', '0100_verified_math_practice_identity', '0101_verified_question_generation_tasks'];
const p = new PrismaClient();
async function main() {
  const rows = await p.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
  });
  assert(!rows.some(row => !row.finished_at && !row.rolled_back_at), 'An unresolved migration exists');
  const applied = rows.filter(row => row.finished_at && !row.rolled_back_at);
  assert.equal(applied.at(-1)?.migration_name, '0098_agent_conversation_lifecycle', 'Production baseline changed');
  const names = fs.readdirSync(root).filter(name => fs.existsSync(path.join(root, name, 'migration.sql'))).sort();
  const sha = data => createHash('sha256').update(data).digest('hex');
  for (const row of applied) {
    assert(names.includes(row.migration_name), 'Unknown applied migration: ' + row.migration_name);
    const sql = fs.readFileSync(path.join(root, row.migration_name, 'migration.sql'));
    assert([sha(sql), sha(sql.toString('utf8').replace(/\r\n/g, '\n'))].includes(row.checksum), 'Applied migration content differs: ' + row.migration_name);
  }
  const done = new Set(applied.map(row => row.migration_name));
  const pending = names.filter(name => !done.has(name));
  assert.deepEqual(pending, expected, 'Unexpected pending migrations');
  console.log(JSON.stringify({ status: 'pass', readOnly: true, database: url.pathname, baseline: '0098', appliedChecksumsMatch: applied.length, pending }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => p.$disconnect());
