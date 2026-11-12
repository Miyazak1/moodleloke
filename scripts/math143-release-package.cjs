'use strict';
// Offline distribution of the already tested image combination, never deploys.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createGzip } = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, '.local/math143-layout-release');
const output = path.join(evidenceDir, 'upload');
const read = file => JSON.parse(fs.readFileSync(path.join(evidenceDir, file), 'utf8'));
function run(tool, args) {
  const result = spawnSync(tool, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 900000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, (result.stderr || '').slice(-1500));
  return result.stdout.trim();
}
async function main() {
  const rehearsal = read('production-rehearsal-evidence.json');
  const upgrade = read('migration-upgrade-evidence.json');
  const config = read('release-config-evidence.json');
  for (const e of [rehearsal, upgrade, config]) assert.equal(e.status, 'pass');
  assert.equal(upgrade.upgradeFrom, '0098');
  assert.deepEqual(upgrade.images, rehearsal.images); assert.deepEqual(config.images, rehearsal.images);
  const context = run('docker', ['context', 'show']);
  assert.match(JSON.parse(run('docker', ['context', 'inspect', context]))[0].Endpoints.docker.Host, /^(?:npipe|unix):\/\//);
  fs.mkdirSync(output, { recursive: true });
  const tags = { BACKEND: 'moodlelike-backend:math143-figures-rc-local', FRONTEND: 'moodlelike-frontend:math143-layout-rc-local', MIGRATE: 'moodlelike-backend:math143-migrate-local' };
  const images = Object.entries(tags).map(([key, tag]) => {
    const info = JSON.parse(run('docker', ['image', 'inspect', tag]))[0];
    assert.equal(info.Id, rehearsal.images[key.toLowerCase()]); assert.equal(info.Architecture, 'amd64'); assert.equal(info.Os, 'linux');
    return { key, tag, id: info.Id };
  });
  const raw = path.join(evidenceDir, 'images.tar');
  console.log('Saving three immutable local candidate images...');
  run('docker', ['image', 'save', '--output', raw, ...Object.values(tags)]);
  const manifests = JSON.parse(run('tar', ['-xOf', raw, 'manifest.json']));
  for (const image of images) {
    const m = manifests.find(m => m.RepoTags?.includes(image.tag)); assert(m);
    const digest = m.Config.match(/([a-f0-9]{64})(?:\.json)?$/)?.[1]; assert(digest);
    image.configDigest = 'sha256:' + digest;
  }
  await pipeline(fs.createReadStream(raw), createGzip({ level: 6 }), fs.createWriteStream(path.join(output, 'images.tar.gz')));
  fs.writeFileSync(path.join(output, 'image-identity.tsv'), images.map(i => [i.key, i.tag, i.id, i.configDigest].join('\t')).join('\n') + '\n');
  fs.writeFileSync(path.join(output, 'verify-images.sh'), `#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
out="candidate.env.tmp"
: > "$out"
while read -r key tag index_digest config_digest; do
  loaded=$(docker image inspect "$tag" --format '{{.Id}}')
  platform=$(docker image inspect "$tag" --format '{{.Os}}/{{.Architecture}}')
  test "$platform" = linux/amd64
  if [[ "$loaded" != "$index_digest" && "$loaded" != "$config_digest" ]]; then
    echo "Unexpected image identity: $tag" >&2; exit 1
  fi
  printf 'MATH143_RELEASE_%s_IMAGE=%s\\n' "$key" "$loaded" >> "$out"
done < image-identity.tsv
printf 'MATH143_GENERATION_ENABLED=false\\n' >> "$out"
mv -- "$out" candidate.env
echo 'Three images verified. candidate.env pins the actual loaded image IDs; generation is OFF.'
`);
  fs.copyFileSync(path.join(root, 'deploy/docker-compose.math143-release.yml'), path.join(output, 'release.yml'));
  fs.copyFileSync(path.join(root, 'deploy/math143-migration-preflight.cjs'), path.join(output, 'migration-preflight.cjs'));
  fs.copyFileSync(path.join(root, 'docs/math143-moodlelike-next-deployment.md'), path.join(output, 'DEPLOYMENT.md'));
  const fingerprintSql = `SET TIME ZONE 'UTC';
SELECT format('SELECT %L, count(*), md5(coalesce(string_agg(row_to_json(t)::text, E''\\n'' ORDER BY row_to_json(t)::text COLLATE "C"), '''')) FROM %I.%I t;', tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\\gexec
`;
  fs.writeFileSync(path.join(output, 'table-fingerprints.sql'), fingerprintSql);
  const manifest = { preparedAt: new Date().toISOString(), target: { project: 'moodlelike-next', directory: '/www/wwwroot/moodlelike-next', port: 18081, database: 'moodlelike', databaseVolume: 'moodlelike-next_moodlelike-postgres-data', evidence: 'User-provided server terminal screenshots' }, images,
    acceptance: { rehearsal: rehearsal.checks, browser: rehearsal.browser, upgradeFrom: upgrade.upgradeFrom, migrations: upgrade.newMigrationsApplied, existingLocalBusinessTablesUnchanged: upgrade.existingTablesUnchanged, providerCalls: 0 },
    scopeReviewRequired: true, cleanReviewedCommit: false, onlineBackupTaken: false, pushed: false, deployed: false, testSiteChanged: false };
  fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const files = fs.readdirSync(output).filter(f => f !== 'SHA256SUMS').sort();
  const checksums = [];
  for (const file of files) {
    const hash = createHash('sha256'); for await (const chunk of fs.createReadStream(path.join(output, file))) hash.update(chunk);
    checksums.push(hash.digest('hex') + '  ' + file);
  }
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), checksums.join('\n') + '\n');
  console.log(JSON.stringify({ status: 'prepared_not_deployed', output, files: [...files, 'SHA256SUMS'], imageArchiveBytes: fs.statSync(path.join(output, 'images.tar.gz')).size }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
