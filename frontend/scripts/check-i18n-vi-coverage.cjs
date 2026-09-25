const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const srcRoot = path.resolve(__dirname, '..', 'src');
const viMessagePath = path.join(srcRoot, 'i18n', 'messages', 'vi.ts');
const messageRoot = path.join(srcRoot, 'i18n', 'messages');
const localizedRoot = path.join(srcRoot, 'content', 'localized');
const specialPracticeRoot = path.join(srcRoot, 'pages', 'special-practice');
const allowedSharedMessageValues = new Set([
  'header.brandKicker',
  'home.aiCoachKicker',
  'homeLite.visual.mathMetricOneValue',
  'homeLite.visual.mathMetricTwoValue',
  'homeLite.visual.mathMetricThreeValue',
  'homeLite.visual.physicsMetricOneValue',
  'homeLite.visual.physicsMetricThreeValue',
  'homeLite.visual.chemMetricOneValue',
  'homeLite.visual.chemMetricThreeValue',
  'cscaPrep.csca',
  'mockExam.questionSuffix',
  'studyChina.cities.faqKicker',
  'studyChina.timeline.cscaLabel',
  'schoolDetail.countOnly'
]);

const failures = [];
if (!fs.existsSync(viMessagePath)) {
  failures.push('Missing src/i18n/messages/vi.ts');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const coverage = [];
for (const file of [...walk(localizedRoot), ...walk(specialPracticeRoot)]) {
  const source = fs.readFileSync(file, 'utf8');
  const localizedMapCount = (source.match(/(?:const|export\s+const)\s+\w+\s*:\s*LocalizedMap</g) ?? []).length;
  if (!localizedMapCount) continue;
  const viCount = (source.match(/\bvi\s*:/g) ?? []).length
    + (source.match(/['"]vi['"]\s*:/g) ?? []).length
    + (source.match(/\.\s*vi\s*=/g) ?? []).length;
  coverage.push({
    file: path.relative(process.cwd(), file),
    localizedMapCount,
    viCount
  });
}

if (failures.length) {
  console.error('i18n Vietnamese coverage check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

function stripImports(source) {
  return source.replace(/^import[\s\S]*?;\s*\r?\n/gm, '');
}

function transpileMessages() {
  const zhSource = stripImports(fs.readFileSync(path.join(messageRoot, 'zh-CN.ts'), 'utf8'))
    .replace(/export const zhCNMessages/, 'const zhCNMessages');
  const enSource = stripImports(fs.readFileSync(path.join(messageRoot, 'en.ts'), 'utf8'))
    .replace(/export const enMessages/, 'const enMessages');
  const viSource = stripImports(fs.readFileSync(viMessagePath, 'utf8'))
    .replace(/export const viMessages/, 'const viMessages');
  const source = `${zhSource}\n${enSource}\n${viSource}\nglobalThis.result = { zhCNMessages, enMessages, viMessages };`;
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const context = Object.create(null);
  vm.runInNewContext(output, context, { timeout: 1000 });
  return context.result;
}

function collectLeaves(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [[prefix, value]].filter(([key]) => key);
  return Object.entries(value).flatMap(([key, child]) => collectLeaves(child, prefix ? `${prefix}.${key}` : key));
}

const { zhCNMessages, enMessages, viMessages } = transpileMessages();
const zhLeaves = new Map(collectLeaves(zhCNMessages));
const enLeaves = new Map(collectLeaves(enMessages));
const viLeaves = new Map(collectLeaves(viMessages));
const inheritedMessages = [];

for (const [key, zhValue] of zhLeaves) {
  const viValue = viLeaves.get(key);
  const enValue = enLeaves.get(key);
  if (typeof viValue !== 'string' || allowedSharedMessageValues.has(key)) continue;
  if (viValue === zhValue) inheritedMessages.push(`${key} matches zh-CN`);
  if (typeof enValue === 'string' && viValue === enValue) inheritedMessages.push(`${key} matches en`);
}

if (inheritedMessages.length) {
  console.error('i18n Vietnamese coverage check failed:');
  console.error('Vietnamese messages must not silently inherit Chinese or English copy.');
  inheritedMessages.slice(0, 50).forEach((item) => console.error(`- ${item}`));
  if (inheritedMessages.length > 50) console.error(`- ...and ${inheritedMessages.length - 50} more`);
  process.exit(1);
}

const missing = coverage.filter((item) => item.viCount < item.localizedMapCount);
if (missing.length) {
  console.warn('i18n Vietnamese coverage report:');
  for (const item of missing) {
    console.warn(`- ${item.file}: ${item.viCount}/${item.localizedMapCount} localized maps include vi`);
  }
  console.warn('Vietnamese content is currently allowed to fall back while translation is in progress.');
} else {
  console.log('i18n Vietnamese coverage check passed.');
}
