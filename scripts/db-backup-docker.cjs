const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const jsonOutput = args.has('--json');
const projectName = process.env.DOCKER_COMPOSE_PROJECT || process.env.CSC_DOCKER_PROJECT || 'cscalite-verify';
const containerName = process.env.DOCKER_BACKUP_CONTAINER || `${projectName}-db-1`;
const backupDir = path.resolve(root, process.env.BACKUP_DIR || path.join('.tmp', 'backups'));
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));
const outputFile = path.resolve(root, process.env.DOCKER_BACKUP_OUTPUT_FILE || buildBackupPath());

function buildBackupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDir, `cscalite-docker-${stamp}.dump`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafeOutputPath(file) {
  assert(file.startsWith(root), 'Docker backup output file must be inside the workspace.');
  assert(!file.includes(`${path.sep}node_modules${path.sep}`), 'Docker backup output file cannot be inside node_modules.');
}

function inspectContainer() {
  const result = spawnSync('docker', [
    'inspect',
    '--format',
    '{{.Name}}\t{{.State.Status}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.service"}}\t{{index .Config.Labels "com.docker.compose.project.config_files"}}',
    containerName
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `Docker container not found: ${containerName}`);
  const [name, status, composeProject, composeService, configFiles] = result.stdout.trim().replace(/^\//, '').split('\t');
  return { name, status, composeProject, composeService, configFiles };
}

function assertSafeContainer(info) {
  assert(info.status === 'running', `Docker backup container must be running; ${containerName} is ${info.status}.`);
  assert(info.composeService === 'db', `Docker backup container must be a compose db service; got ${info.composeService || 'unknown'}.`);
  assert(info.composeProject === projectName, `Docker backup container must belong to ${projectName}; got ${info.composeProject || 'unknown'}.`);
  assert(/cscalite[\\/]+deploy[\\/]+docker-compose\.prod\.yml/i.test(info.configFiles || ''), 'Docker backup container must come from CSCAlite deploy/docker-compose.prod.yml.');
}

function writeEvidence(evidence) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `docker-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  return file;
}

function backupFromContainer(info) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    const output = fs.createWriteStream(outputFile, { flags: 'wx' });
    const child = spawn('docker', [
      'exec',
      containerName,
      'sh',
      '-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-privileges -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => process.stderr.write(`[docker-backup] ${chunk}`));
    child.on('error', reject);
    child.on('close', (code) => {
      output.end();
      if (code !== 0) {
        fs.rmSync(outputFile, { force: true });
        reject(new Error(`docker pg_dump failed with exit code ${code}`));
        return;
      }
      const stats = fs.statSync(outputFile);
      if (stats.size <= 0) {
        fs.rmSync(outputFile, { force: true });
        reject(new Error('Docker backup file is empty.'));
        return;
      }
      resolve({
        kind: 'docker-backup',
        timestamp: new Date().toISOString(),
        container: info.name,
        composeProject: info.composeProject,
        composeService: info.composeService,
        backupFile: path.relative(root, outputFile).replace(/\\/g, '/'),
        backupSizeBytes: stats.size
      });
    });
  });
}

async function main() {
  assertSafeOutputPath(outputFile);
  const info = inspectContainer();
  assertSafeContainer(info);
  const evidenceBase = {
    kind: 'docker-backup',
    timestamp: new Date().toISOString(),
    dryRun,
    container: info.name,
    composeProject: info.composeProject,
    composeService: info.composeService,
    backupFile: path.relative(root, outputFile).replace(/\\/g, '/')
  };

  if (dryRun) {
    const evidenceFile = writeEvidence(evidenceBase);
    console.log(`[docker-backup] dry-run target: ${outputFile}`);
    console.log(`[docker-backup] evidence written: ${evidenceFile}`);
    return;
  }

  const evidence = await backupFromContainer(info);
  const evidenceFile = writeEvidence(evidence);
  if (jsonOutput) {
    console.log(JSON.stringify({ ...evidence, evidenceFile }, null, 2));
  } else {
    console.log(`[docker-backup] backup written: ${outputFile}`);
    console.log(`[docker-backup] evidence written: ${evidenceFile}`);
  }
}

main().catch((error) => {
  console.error(`CSCAlite Docker backup failed: ${error.message}`);
  process.exit(1);
});
