const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const allowedLargeBranchFiles = new Set([
  path.join(root, 'pages', 'CscaSpecialPracticePage.tsx')
]);
const adaptivePracticeViewsPath = path.join(root, 'pages', 'special-practice', 'adaptive', 'AdaptivePracticeViews.tsx');

const localeBranchBaselines = new Map(Object.entries({}));

const englishContentBaselines = new Map(Object.entries({
  [path.join(root, 'pages', 'CscaSpecialPracticePage.tsx')]: 28,
  [path.join(root, 'pages', 'CscaSubjectPage.tsx')]: 2
}));

const checks = [
  {
    name: 'language-specific page component',
    pattern: /\b(?:English|Chinese|Zh|En)[A-Z][A-Za-z0-9]*Page\b|\b[A-Z][A-Za-z0-9]*Page(?:Zh|En)\b/g,
    severity: 'error'
  },
  {
    name: 'page-level locale JSX branch',
    pattern: /locale\s*={0,2}={0,1}\s*['"]en['"]\s*\?\s*<[A-Z]/g,
    severity: 'error'
  },
  {
    name: 'locale ternary missing Vietnamese branch',
    pattern: /(?:locale|lang)\s*={0,2}={0,1}\s*['"]en['"][^\n]*\?[^\n]*:[^\n]*[\u4e00-\u9fff]/g,
    severity: 'error',
    ignoreWhen: (text) => /\bvi\b/.test(text)
  },
  {
    name: 'pickLocalized argument order',
    pattern: /pickLocalized\(\s*(?:locale|lang)\s*,/g,
    severity: 'error'
  }
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

const files = walk(root);
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  for (const check of checks) {
    const matches = source.matchAll(check.pattern);
    for (const match of matches) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      const lineText = lines[line - 1] ?? match[0];
      if (check.ignoreWhen?.(lineText)) continue;
      findings.push({ file, line, check: check.name, text: match[0] });
    }
  }

  if (file === adaptivePracticeViewsPath) {
    lines.forEach((lineText, index) => {
      if (lineText.includes('ADAPTIVE_COPY.') && !lineText.includes('adaptiveText(')) {
        findings.push({
          file,
          line: index + 1,
          check: 'adaptive copy missing locale wrapper',
          text: lineText.trim()
        });
      }
    });
  }

  const branchCount = (source.match(/locale\s*={0,2}={0,1}\s*['"]en['"]/g) ?? []).length;
  const branchBaseline = localeBranchBaselines.get(file);
  if (branchBaseline !== undefined) {
    if (branchCount > branchBaseline) {
      findings.push({
        file,
        line: 1,
        check: 'high-density locale branching increased',
        text: `${branchCount} locale === en checks, baseline ${branchBaseline}`
      });
    }
  } else if (!allowedLargeBranchFiles.has(file) && branchCount > 20) {
    findings.push({ file, line: 1, check: 'high-density locale branching', text: `${branchCount} locale === en checks` });
  }

  const englishContentCount = (source.match(/\b(?:ENGLISH|EN)_[A-Z0-9_]{2,}/g) ?? []).length;
  const englishContentBaseline = englishContentBaselines.get(file) ?? 0;
  if (englishContentCount > englishContentBaseline) {
    findings.push({
      file,
      line: 1,
      check: 'english-only content map increased',
      text: `${englishContentCount} EN/ENGLISH content identifiers, baseline ${englishContentBaseline}`
    });
  }
}

if (findings.length) {
  console.error('i18n debt check failed:');
  for (const item of findings) {
    console.error(`- ${path.relative(process.cwd(), item.file)}:${item.line} ${item.check}: ${item.text}`);
  }
  process.exit(1);
}

console.log('i18n debt check passed.');
