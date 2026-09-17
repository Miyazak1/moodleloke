const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const frontendRoot = path.join(root, 'frontend');
const backendRoot = path.join(root, 'backend');
const backendSrc = path.join(backendRoot, 'src');
const normalize = (value) => path.resolve(value);
const relativeRoot = (value) => path.relative(root, value).replaceAll('\\', '/');

function walk(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) output.push(...walk(full, extensions));
    else if (extensions.includes(path.extname(full))) output.push(normalize(full));
  }
  return output;
}

function classifyFrontend(file) {
  if (/^src\/(AuthoringApp\.tsx|main-authoring\.tsx|components\/(admin|Admin)|pages\/Admin|styles\/(admin|authoring-entry)|lib\/(admin-|api-admin-teaching-assets|ai-questioning-readiness-exports|organization-governance|syllabus-imports))/.test(file)) return 'admin-authoring';
  if (/^src\/(pages\/special-practice|styles\/(visualizers|special-practice-visualizers)|components\/(NewtonSecondLawCanvas|SolidGeometryCanvas))/.test(file)) return 'teaching-assets';
  return 'obsolete-candidate';
}

const frontendReachabilityPath = path.join(frontendRoot, 'artifacts', 'standalone-reachability.json');
if (!fs.existsSync(frontendReachabilityPath)) throw new Error('Run npm --prefix frontend run audit:standalone-reachability first.');
const frontendReachability = JSON.parse(fs.readFileSync(frontendReachabilityPath, 'utf8'));
const frontendGroups = { 'student-agent': frontendReachability.reachable, 'admin-authoring': [], 'teaching-assets': [], 'obsolete-candidate': [] };
for (const file of frontendReachability.unreachable) frontendGroups[classifyFrontend(file)].push(file);

const backendExtensions = ['.ts', '.tsx', '.js', '.json'];
function resolveBackendImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...backendExtensions.map((ext) => base + ext), ...backendExtensions.map((ext) => path.join(base, 'index' + ext))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

const importPatterns = [
  /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g
];
function backendDependencies(file) {
  const text = fs.readFileSync(file, 'utf8');
  const dependencies = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const resolved = resolveBackendImport(file, match[1]);
      if (resolved && normalize(resolved).startsWith(normalize(backendSrc) + path.sep)) dependencies.add(normalize(resolved));
    }
  }
  return dependencies;
}

const backendEntry = normalize(path.join(backendSrc, 'app.module.ts'));
const backendReachable = new Set();
const queue = [backendEntry];
while (queue.length) {
  const file = queue.shift();
  if (!file || backendReachable.has(file)) continue;
  backendReachable.add(file);
  for (const dependency of backendDependencies(file)) if (!backendReachable.has(dependency)) queue.push(dependency);
}
const allBackend = walk(backendSrc, ['.ts', '.tsx']);
const backendUnreachable = allBackend.filter((file) => !backendReachable.has(file));
function topLevelBackendArea(file) {
  const relative = path.relative(backendSrc, file).replaceAll('\\', '/');
  return relative.includes('/') ? relative.split('/')[0] : '(root)';
}
const backendAreas = {};
for (const file of allBackend) {
  const area = topLevelBackendArea(file);
  backendAreas[area] ||= { total: 0, reachable: 0, unreachable: 0 };
  backendAreas[area].total += 1;
  if (backendReachable.has(file)) backendAreas[area].reachable += 1;
  else backendAreas[area].unreachable += 1;
}

const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
const reachableBackendText = [...backendReachable].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const prismaModels = models.map((model) => {
  const accessor = model[0].toLowerCase() + model.slice(1);
  const accessorMatches = reachableBackendText.match(new RegExp('\\.' + accessor + '\\b', 'g')) || [];
  const typeMatches = reachableBackendText.match(new RegExp('\\b' + model + '\\b', 'g')) || [];
  return { model, accessor, prismaAccessorMentions: accessorMatches.length, typeMentions: typeMatches.length, reviewCandidate: accessorMatches.length === 0 && typeMatches.length === 0 };
});

const report = {
  schemaVersion: '1',
  generatedAt: new Date().toISOString(),
  frontend: {
    totals: Object.fromEntries(Object.entries(frontendGroups).map(([key, files]) => [key, files.length])),
    groups: frontendGroups
  },
  backend: {
    entry: relativeRoot(backendEntry),
    totals: { all: allBackend.length, reachable: backendReachable.size, unreachable: backendUnreachable.length },
    areas: backendAreas,
    reachable: [...backendReachable].map(relativeRoot).sort(),
    unreachable: backendUnreachable.map(relativeRoot).sort()
  },
  prisma: {
    totalModels: prismaModels.length,
    reviewCandidates: prismaModels.filter((item) => item.reviewCandidate).length,
    models: prismaModels
  }
};

const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'product-boundary-audit.json'), JSON.stringify(report, null, 2) + '\n');
const lines = [
  '# Product boundary audit',
  '',
  'Generated: ' + report.generatedAt,
  '',
  '## Frontend',
  '',
  ...Object.entries(report.frontend.totals).map(([key, count]) => '- ' + key + ': ' + count),
  '',
  '## Backend areas',
  '',
  '| Area | Total | Reachable | Unreachable |',
  '| --- | ---: | ---: | ---: |',
  ...Object.entries(backendAreas).sort(([a], [b]) => a.localeCompare(b)).map(([area, value]) => '| ' + area + ' | ' + value.total + ' | ' + value.reachable + ' | ' + value.unreachable + ' |'),
  '',
  '## Prisma review candidates',
  '',
  'Static absence is not deletion authority; relations, raw SQL and migration compatibility still require review.',
  '',
  ...prismaModels.filter((item) => item.reviewCandidate).map((item) => '- ' + item.model)
];
fs.writeFileSync(path.join(artifactDir, 'product-boundary-audit.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ frontend: report.frontend.totals, backend: report.backend.totals, prisma: { totalModels: report.prisma.totalModels, reviewCandidates: report.prisma.reviewCandidates } }));
console.log('Wrote artifacts/product-boundary-audit.json and .md');
