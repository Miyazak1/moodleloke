const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const iconSource = fs.readFileSync(path.join(sourceRoot, 'components', 'Icon.tsx'), 'utf8');
const defined = new Set([...iconSource.matchAll(/'(?<name>lucide:[a-z0-9-]+)'\s*:/g)].map((match) => match.groups.name));
const used = new Map();

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(filePath);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name) || filePath.endsWith(`${path.sep}Icon.tsx`)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(/lucide:[a-z0-9-]+/g)) {
      const locations = used.get(match[0]) ?? [];
      locations.push(path.relative(root, filePath));
      used.set(match[0], locations);
    }
  }
}

visit(sourceRoot);

const missing = [...used.keys()].filter((name) => !defined.has(name)).sort();
if (missing.length) {
  console.error('Icon registry is missing these used icons:');
  for (const name of missing) console.error(`- ${name}: ${[...new Set(used.get(name))].join(', ')}`);
  process.exit(1);
}

console.log(`Icon coverage OK: ${used.size} used icons are registered.`);
