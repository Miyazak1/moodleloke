const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const extractionArtifact = path.join(root, 'scripts', 'extract-agent-product.cjs');
if (fs.existsSync(extractionArtifact)) throw new Error('The standalone repository must not contain its historical extraction program.');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'moodlelike-agent') throw new Error('Unexpected repository package identity.');
if (/extract(ed|ion)|cscalite/i.test(pkg.description || '')) throw new Error('Package description still presents Moodlelike as an extraction artifact.');
if (Object.values(pkg.scripts || {}).some((value) => /extract-agent-product/i.test(value))) throw new Error('A package script still depends on the historical extraction program.');

const roots = [
  'package.json',
  'docker-compose.yml',
  'start-moodlelike-dev.bat',
  '.github',
  'deploy',
  'scripts',
  path.join('backend', 'src'),
  path.join('frontend', 'src')
];
const findings = [];
function scan(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolutePath)) scan(path.join(relativePath, name));
    return;
  }
  if (!/\.(?:cjs|mjs|js|jsx|ts|tsx|json|ya?ml|ps1|bat)$/i.test(absolutePath) && !/package\.json$/i.test(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (/[A-Z]:[\\/]CODE[\\/]CSCALITE/i.test(content)) findings.push(relativePath);
}
for (const relativePath of roots) scan(relativePath);
if (findings.length) throw new Error('Active repository surfaces contain a CSCALite workspace path: ' + findings.join(', '));

const ownership = fs.readFileSync(path.join(root, 'REPOSITORY_OWNERSHIP.md'), 'utf8');
for (const marker of ['authoritative source', 'No automatic back-sync', 'historical provenance']) {
  if (!ownership.includes(marker)) throw new Error('Repository ownership contract is missing: ' + marker);
}
console.log('Standalone repository ownership contract passed.');
