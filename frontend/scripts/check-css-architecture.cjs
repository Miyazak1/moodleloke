const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stylesDir = path.join(root, 'src', 'styles');
const indexPath = path.join(stylesDir, 'index.css');
const basePath = path.join(stylesDir, 'base.css');
const accountCssPath = path.join(stylesDir, 'account.css');
const accountComponentsPath = path.join(stylesDir, 'account-components.css');

const allowedGlobalImports = new Set([
  './base.css',
  './shared-components.css',
  './layout.css',
  './brand.css',
  './public-shell.css'
]);

const legacyLargeFiles = new Set([
  'account.css',
  'account.part',
  'admin-work.css',
  'admin-work.part',
  'home.css',
  'home.part',
  'mock-exam.css',
  'mock-exam.part',
  'school.css',
  'school.part',
  'scholarships.css',
  'scholarships.part',
  'special-practice.css',
  'special-practice.part',
  'study-china.css',
  'study-china.part',
  'subject-learning.css',
  'subject-learning.part'
]);

const warnLineLimit = 1000;
const failLineLimit = 2000;

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

const failures = [];
const warnings = [];
const baseCss = fs.readFileSync(basePath, 'utf8');
const accountCss = fs.existsSync(accountCssPath) ? fs.readFileSync(accountCssPath, 'utf8') : '';
const accountComponentsCss = fs.existsSync(accountComponentsPath) ? fs.readFileSync(accountComponentsPath, 'utf8') : '';

const indexImports = readLines(indexPath)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^@import\s+['"](.+)['"];?$/);
    if (!match) {
      failures.push(`styles/index.css contains a non-import line: ${line}`);
      return null;
    }
    return match[1];
  })
  .filter(Boolean);

for (const importPath of indexImports) {
  if (!allowedGlobalImports.has(importPath)) {
    failures.push(`styles/index.css must stay global-only; move ${importPath} into its page or feature module.`);
  }
}

for (const marker of ['input[type="file"]', '::file-selector-button']) {
  if (!baseCss.includes(marker)) {
    failures.push(`styles/base.css must keep shared upload file input styling (${marker}).`);
  }
}

if (!accountCss.includes("@import './account-components.css';")) {
  failures.push('styles/account.css must import account-components.css after legacy account slices.');
}

if (!accountComponentsCss.includes('Account component layer')) {
  failures.push('styles/account-components.css must remain the documented account component layer.');
}

const accountComponentBans = [
  ['linear-gradient', 'do not add gradient surfaces to account-components.css'],
  ['border-radius: 999', 'do not add pill-shaped 999px controls to account-components.css'],
  ['clamp(', 'do not use viewport-scaled typography/sizing in account-components.css']
];

for (const [needle, message] of accountComponentBans) {
  if (accountComponentsCss.includes(needle)) {
    failures.push(`${message} (${needle}).`);
  }
}

function listCssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(absolute);
    if (!entry.isFile() || !entry.name.endsWith('.css')) return [];
    return [absolute];
  });
}

const cssFiles = listCssFiles(stylesDir).filter((file) => path.relative(stylesDir, file) !== 'index.css');
for (const filePath of cssFiles) {
  const file = path.relative(stylesDir, filePath).replace(/\\/g, '/');
  const topLevelName = file.split('/')[0];
  const partFamily = file.replace(/\.part-\d+\.css$/, '.part');
  const lineCount = readLines(filePath).length;
  const isLegacy = legacyLargeFiles.has(file) || legacyLargeFiles.has(topLevelName) || legacyLargeFiles.has(partFamily);
  if (lineCount > failLineLimit && !isLegacy) {
    failures.push(`${file} has ${lineCount} lines; split it before adding more page scope.`);
  } else if (lineCount > warnLineLimit) {
    const prefix = isLegacy ? 'legacy large CSS' : 'large CSS';
    warnings.push(`${prefix}: ${file} has ${lineCount} lines.`);
  }
}

for (const warning of warnings) {
  console.warn(`[css-architecture] ${warning}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`[css-architecture] ${failure}`);
  }
  process.exit(1);
}

console.log(`[css-architecture] OK: ${indexImports.length} global imports, ${warnings.length} large-file warnings.`);
