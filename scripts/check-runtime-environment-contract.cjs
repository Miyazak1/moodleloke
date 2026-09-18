const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const activeDefinition = (text, name) => new RegExp(`^${name}=`, 'm').test(text);

const development = read('.env.example');
const production = read('.env.production.example');
const localRunner = read('scripts/moodlelike-local.cjs');
const compose = read('deploy/docker-compose.prod.yml');
const dockerfile = read('deploy/backend.Dockerfile');
const runtimeHelper = read('backend/src/common/runtime-environment.ts');

expect(activeDefinition(development, 'MOODLELIKE_ENV'), '.env.example must define MOODLELIKE_ENV.');
expect(activeDefinition(production, 'MOODLELIKE_ENV'), '.env.production.example must define MOODLELIKE_ENV.');
expect(!activeDefinition(development, 'CSC_ENV') && !activeDefinition(production, 'CSC_ENV'), 'Example environments must not actively define deprecated CSC_ENV.');
expect(localRunner.includes("MOODLELIKE_ENV: 'development'") && !localRunner.includes("CSC_ENV: 'development'"), 'Local delivery must write only the canonical Moodlelike environment selector.');
expect(compose.includes('MOODLELIKE_ENV: production') && !compose.includes('CSC_ENV: production'), 'Compose must use MOODLELIKE_ENV.');
expect(dockerfile.includes('ENV MOODLELIKE_ENV=production') && !dockerfile.includes('ENV CSC_ENV=production'), 'Backend image must use MOODLELIKE_ENV.');
for (const marker of ['process.env.MOODLELIKE_ENV', 'process.env.CSC_ENV', 'process.env.NODE_ENV']) {
  expect(runtimeHelper.includes(marker), `Runtime environment helper must preserve safety signal: ${marker}`);
}

const protectedScripts = [
  'scripts/agent-demo-seed.cjs',
  'scripts/agent-teaching-assets-admin-live.cjs',
  'scripts/agent-multisubject-teaching-assets-live.cjs',
  'scripts/agent-teaching-asset-live.cjs',
  'scripts/agent-teaching-routing-shadow-live.cjs',
  'scripts/agent-teaching-browser-demo-prepare.cjs',
  'scripts/agent-teaching-stability-demo-advance.cjs',
  'scripts/agent-teaching-intervention-live.cjs',
  'scripts/csca-byok-security-check.cjs'
];
for (const relativePath of protectedScripts) {
  expect(read(relativePath).includes('process.env.MOODLELIKE_ENV'), `Production safeguard does not recognize MOODLELIKE_ENV: ${relativePath}`);
}

console.log('Moodlelike runtime environment contract passed.');
