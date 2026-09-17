const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const backendSrc = path.join(root, 'backend', 'src');
const unsafeRawSqlPattern = /\$(?:queryRawUnsafe|executeRawUnsafe)\b|\b(?:queryRawUnsafe|executeRawUnsafe)\b/;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(ts|js|cjs|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const findings = [];
for (const file of walk(backendSrc)) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (unsafeRawSqlPattern.test(line)) {
      findings.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error('Unsafe raw SQL calls are not allowed in backend/src:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('CSCAlite database security static check passed.');
