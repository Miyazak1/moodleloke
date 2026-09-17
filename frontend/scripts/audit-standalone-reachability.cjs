const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(frontendRoot, 'src');
const entry = path.join(srcRoot, 'main.tsx');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
const importPatterns = [
  /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /@import\s+(?:url\()?['"]?([^'"\)\s;]+)['"]?\)?/g
];

function normalize(value) {
  return path.resolve(value);
}

function resolveRelative(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...sourceExtensions.map((extension) => base + extension), ...sourceExtensions.map((extension) => path.join(base, 'index' + extension))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function dependencies(file) {
  const text = fs.readFileSync(file, 'utf8');
  const result = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const resolved = resolveRelative(file, match[1]);
      if (resolved && normalize(resolved).startsWith(normalize(srcRoot) + path.sep)) result.add(normalize(resolved));
    }
  }
  return result;
}

const reachable = new Set();
const queue = [normalize(entry)];
while (queue.length) {
  const file = queue.shift();
  if (!file || reachable.has(file)) continue;
  reachable.add(file);
  for (const dependency of dependencies(file)) {
    if (!reachable.has(dependency)) queue.push(dependency);
  }
}

function allSourceFiles(dir) {
  const result = [];
  for (const entryName of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entryName);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) result.push(...allSourceFiles(fullPath));
    else if (sourceExtensions.includes(path.extname(fullPath))) result.push(normalize(fullPath));
  }
  return result;
}

const allFiles = allSourceFiles(srcRoot);
const unreachable = allFiles.filter((file) => !reachable.has(file));
const relative = (file) => path.relative(frontendRoot, file).replaceAll('\\', '/');
const report = {
  schemaVersion: '1',
  entry: relative(entry),
  generatedAt: new Date().toISOString(),
  totals: { all: allFiles.length, reachable: reachable.size, unreachable: unreachable.length },
  reachable: [...reachable].map(relative).sort(),
  unreachable: unreachable.map(relative).sort()
};

const reportDir = path.join(frontendRoot, 'artifacts');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'standalone-reachability.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(reportDir, 'standalone-unreachable.txt'), report.unreachable.join('\n') + '\n');
console.log(JSON.stringify(report.totals));
console.log('Wrote frontend/artifacts/standalone-reachability.json');
