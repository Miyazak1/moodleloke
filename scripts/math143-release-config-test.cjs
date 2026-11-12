'use strict';
// Render-only validation: never starts services or reads the real environment file.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, process.argv.includes('--layout') ? '.local/math143-layout-release' : process.argv.includes('--figures') ? '.local/math143-figures-release' : '.local/math143-release');
const rehearsal = JSON.parse(fs.readFileSync(path.join(directory, 'production-rehearsal-evidence.json'), 'utf8'));
assert.equal(rehearsal.status, 'pass');
const emptyEnv = path.join(directory, 'render-only.empty.env');
fs.writeFileSync(emptyEnv, '# Render-only; no credentials.\n');
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^COMPOSE_|^MATH143_/.test(key)) delete env[key];
Object.assign(env, { MATH143_RELEASE_BACKEND_IMAGE: rehearsal.images.backend, MATH143_RELEASE_FRONTEND_IMAGE: rehearsal.images.frontend, MATH143_RELEASE_MIGRATE_IMAGE: rehearsal.images.migrate });
function render(overlay = false, enabled) {
  const values = { ...env };
  if (enabled !== undefined) values.MATH143_GENERATION_ENABLED = enabled;
  const r = spawnSync('docker', ['compose', '--env-file', emptyEnv, '-p', 'math143-render-only', '-f', 'deploy/docker-compose.prod.yml',
    ...(overlay ? ['-f', 'deploy/docker-compose.math143-release.yml'] : []), 'config', '--no-env-resolution', '--format', 'json'],
  { cwd: root, env: values, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const baseline = render();
const disabled = render(true);
const enabled = render(true, 'true');
for (const config of [disabled, enabled]) {
  assert.deepEqual(config.services.db, baseline.services.db);
  assert.deepEqual(config.volumes, baseline.volumes);
  assert.deepEqual(config.networks, baseline.networks);
  assert.deepEqual(config.services.backend.volumes, baseline.services.backend.volumes);
  for (const key of Object.keys(baseline.services.backend.environment)) {
    if (/^QUESTION_ENGINE_|^MOODLELIKE_MATH_ENGINE_|^CSCA_AI_QUESTION_|^CSCA_AI_TOPIC_|^CSCA_SUBJECT_PRACTICE_/.test(key)) continue;
    assert.equal(config.services.backend.environment[key], baseline.services.backend.environment[key], key + ' changed');
  }
  assert.equal(config.services.backend.image, rehearsal.images.backend);
  assert.equal(config.services.frontend.image, rehearsal.images.frontend);
  assert.equal(config.services.migrate.image, rehearsal.images.migrate);
  assert.equal(config.services.backend.environment.MOODLELIKE_READING_PILOTS_ENABLED, 'false');
  assert.deepEqual(config.services.migrate.command, ['node', 'scripts/prisma-cli.cjs', 'migrate', 'deploy']);
  for (const flag of ['CSCA_AI_QUESTION_GENERATION_ENABLED','CSCA_AI_QUESTION_REVIEW_ENABLED','CSCA_AI_TOPIC_MAPPING_ENABLED','CSCA_AI_QUESTIONING_SCHEDULER_ENABLED','CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED','CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED']) {
    assert.equal(config.services.backend.environment[flag], 'false');
  }
}
assert.equal(disabled.services.backend.environment.QUESTION_ENGINE_PLUGIN_ENABLED, 'false');
assert.equal(disabled.services.backend.environment.MOODLELIKE_MATH_ENGINE_ENABLED, 'false');
assert.equal(enabled.services.backend.environment.QUESTION_ENGINE_PLUGIN_ENABLED, 'true');
assert.equal(enabled.services.backend.environment.MOODLELIKE_MATH_ENGINE_ENABLED, 'true');
assert.equal(enabled.services.backend.environment.QUESTION_ENGINE_PLUGIN_ID, 'verified-math-1.43');
fs.writeFileSync(path.join(directory, 'release-config-evidence.json'), JSON.stringify({ status: 'pass', checkedAt: new Date().toISOString(),
  renderOnly: true, realEnvRead: false, images: rehearsal.images,
  checks: ['default_generation_disabled', 'explicit_math_only_enablement', 'legacy_flags_disabled', 'schema_only_migration', 'existing_database_network_volumes_and_other_env_preserved'] }, null, 2) + '\n');
console.log('MATH143_RELEASE_CONFIG_OK: default off, explicit math-only activation, schema-only migration, resource identity preserved.');
