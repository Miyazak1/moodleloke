'use strict';
// Local inventory only; never reads .env, contacts a site, pushes or deploys.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const figuresMode = process.argv.includes('--figures');
const directory = path.join(root, figuresMode ? '.local/math143-figures-release' : '.local/math143-release');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function command(tool, args) {
  const result = spawnSync(tool, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(tool + ' inventory failed');
  return result.stdout.trim();
}
const evidencePath = path.join(directory, 'production-rehearsal-evidence.json');
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
if (evidence.status !== 'pass') throw Error('A passing production rehearsal is required before release inventory');
const upgrade = JSON.parse(fs.readFileSync(path.join(directory, 'migration-upgrade-evidence.json'), 'utf8'));
if (upgrade.status !== 'pass' || JSON.stringify(upgrade.images) !== JSON.stringify(evidence.images)) throw Error('A matching successful additive upgrade rehearsal is required');
const config = JSON.parse(fs.readFileSync(path.join(directory, 'release-config-evidence.json'), 'utf8'));
if (config.status !== 'pass' || JSON.stringify(config.images) !== JSON.stringify(evidence.images)) throw Error('Matching release configuration validation is required');
const audit = JSON.parse(fs.readFileSync(path.join(directory, 'dependency-audit-summary.json'), 'utf8'));
if (audit.reports.some(item => item.vulnerabilities.high || item.vulnerabilities.critical)) throw Error('High/critical dependency audit gate failed');
const context = command('docker', ['context', 'show']);
if (!/^(?:npipe|unix):\/\//.test(JSON.parse(command('docker', ['context', 'inspect', context]))[0].Endpoints.docker.Host)) throw Error('Refusing a remote Docker context');
const candidateTag = figuresMode ? 'math143-figures-rc-local' : 'math143-rc-local';
const imageTags = { backend: 'moodlelike-backend:' + candidateTag, frontend: 'moodlelike-frontend:' + candidateTag, migrate: 'moodlelike-backend:math143-migrate-local' };
const images = {};
for (const [key, tag] of Object.entries(imageTags)) {
  const info = JSON.parse(command('docker', ['image', 'inspect', tag]))[0];
  if (evidence.images[key] !== info.Id) throw Error('Image changed after successful rehearsal: ' + key);
  images[key] = { tag, id: info.Id, architecture: info.Architecture, os: info.Os, created: info.Created, sizeBytes: info.Size };
}
// Inventory the actual compiled/runtime payload, separately from workspace review files.
// New rehearsal tools in the workspace need not have been embedded in the app image.
const payloadScript = `const fs=require('fs'),path=require('path'),{createHash}=require('crypto');const files=[];function walk(p){for(const d of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(p,d.name);if(d.isDirectory()){if(d.name!=='node_modules')walk(f);}else if(d.isFile())files.push({path:f,sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')});}}for(const p of ['/app/backend/dist','/app/backend/prisma','/app/scripts','/app/question-engine/math-v143','/app/.local/math-lab/1.43.0'])walk(p);console.log(JSON.stringify(files));`;
const runtimePayload = JSON.parse(command('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'node', images.backend.id, '-e', figuresMode ? payloadScript.replace("'/app/question-engine/math-v143',", "'/app/question-engine/math-v143','/app/question-engine/figures','/app/question-engine/diagrams',") : payloadScript]));
const ignoredDirectories = new Set(['node_modules', 'dist', '.git', '.local', '.tmp', 'uploads', 'test-results', 'playwright-report']);
const files = [];
function inventory(relative) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw Error('Release input symlink requires review: ' + relative);
  if (stat.isDirectory()) {
    if (ignoredDirectories.has(path.basename(absolute))) return;
    for (const name of fs.readdirSync(absolute).sort()) inventory(relative + '/' + name);
  } else {
    if (/\.(?:dump|log|tsbuildinfo)$/.test(relative) || /(?:^|\/)\.env(?:\.|$)/.test(relative) && !/\.env\.(?:production\.)?example$/.test(relative)) return;
    files.push({ path: relative, bytes: stat.size, sha256: sha(fs.readFileSync(absolute)) });
  }
}
for (const entry of ['backend', 'frontend', 'scripts', 'question-engine', 'deploy', 'package.json', 'package-lock.json', '.dockerignore',
  'docs/csca-math-function-verification-curation-v1.json', 'artifacts/math-lab/csca-math-lab-1.43.0.zip']) inventory(entry);
files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  schemaVersion: 'math143-local-release-manifest-v1', generatedAt: new Date().toISOString(),
  baseCommit: command('git', ['rev-parse', 'HEAD']),
  workingTreeChanges: command('git', ['status', '--porcelain=v1', '--untracked-files=all']).split('\n').filter(Boolean),
  scopeReviewRequired: true,
  sourceScope: 'Workspace source and release-tool review inventory, including pre-existing edits; actual image runtime payload is inventoried separately. Not a clean reviewed commit.',
  sourceInventorySha256: sha(JSON.stringify(files)), files, images,
  runtimePayloadSha256: sha(JSON.stringify(runtimePayload)), runtimePayload,
  engine: require('../question-engine/math-v143/integration.json'),
  acceptance: { schemaVersion: evidence.schemaVersion, checks: evidence.checks, completedAt: evidence.completedAt,
    evidenceSha256: sha(fs.readFileSync(evidencePath)), backup: evidence.backup, additiveUpgrade: { status: upgrade.status, existingTablesUnchanged: upgrade.existingTablesUnchanged },
    releaseConfigChecks: config.checks, dependencyAudit: audit },
  deployed: false, pushed: false, onlineBackupTaken: false, remoteSitesContacted: false
};
fs.writeFileSync(path.join(directory, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: 'prepared_not_deployed', sourceFiles: files.length, images, manifest: path.relative(root, path.join(directory, 'release-manifest.json')) }, null, 2));
