const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

const root = path.resolve(__dirname, '..');
loadEnv(root);

const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));
const composeTemplate = [
  '{{.Names}}',
  '{{.Image}}',
  '{{.Status}}',
  '{{.Ports}}',
  '{{.Label "com.docker.compose.project"}}',
  '{{.Label "com.docker.compose.service"}}',
  '{{.Label "com.docker.compose.project.config_files"}}',
  '{{.Label "com.docker.compose.project.working_dir"}}'
].join('\t');

function runDockerPs() {
  const result = spawnSync('docker', ['ps', '-a', '--format', composeTemplate], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `docker ps failed with exit code ${result.status}`);
  }
  return result.stdout.trim();
}

function normalize(value) {
  return (value || '').replace(/\\/g, '/').toLowerCase();
}

function classify(container) {
  const name = normalize(container.name);
  const project = normalize(container.composeProject);
  const configFiles = normalize(container.configFiles);
  const workingDir = normalize(container.workingDir);

  if (project === 'cscalite-verify' && configFiles.includes('/cscalite/deploy/docker-compose.prod.yml')) {
    return 'cscalite-local-staging';
  }
  if (project === 'cscalite' && configFiles.includes('/cscalite/docker-compose.yml')) {
    return 'cscalite-dev-db';
  }
  if ((project === 'scripts' && workingDir.includes('/cscalite/scripts')) || name.includes('cscalite-prisma-e2e')) {
    return 'cscalite-historical-test';
  }
  if (name.includes('cscalite') || configFiles.includes('/cscalite/')) {
    return 'cscalite-other';
  }
  return 'external';
}

function parseContainers(output) {
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, image, status, ports, composeProject, composeService, configFiles, workingDir] = line.split('\t');
    const container = {
      name,
      image,
      status,
      ports,
      composeProject,
      composeService,
      configFiles,
      workingDir
    };
    return { ...container, classification: classify(container) };
  });
}

function writeEvidence(containers) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `docker-status-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    kind: 'docker-status',
    timestamp: new Date().toISOString(),
    containers
  }, null, 2)}\n`);
  return file;
}

function printSummary(containers) {
  const groups = new Map();
  for (const container of containers) {
    if (!groups.has(container.classification)) groups.set(container.classification, []);
    groups.get(container.classification).push(container);
  }

  for (const [classification, items] of groups) {
    console.log(`\n[${classification}]`);
    for (const item of items) {
      console.log(`- ${item.name} | ${item.composeProject || '-'}:${item.composeService || '-'} | ${item.status} | ${item.ports || '-'}`);
    }
  }

  console.log('\nCleanup note: this script is read-only and does not stop or delete containers.');
  console.log('For local staging only, use: docker compose -p cscalite-verify -f deploy/docker-compose.prod.yml down');
}

function main() {
  const containers = parseContainers(runDockerPs());
  printSummary(containers);
  const evidenceFile = writeEvidence(containers);
  console.log(`\nCSCAlite Docker status evidence written: ${evidenceFile}`);
}

try {
  main();
} catch (error) {
  console.error(`CSCAlite Docker status failed: ${error.message}`);
  process.exit(1);
}
