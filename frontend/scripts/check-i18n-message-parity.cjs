const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const messagesDir = path.resolve(__dirname, '..', 'src', 'i18n', 'messages');
const baselineLocale = 'zh-CN';
const localeFiles = new Map([
  [baselineLocale, 'zh-CN.ts'],
  ['en', 'en.ts'],
  ['vi', 'vi.ts']
]);

function readMessageObject(fileName) {
  const source = fs.readFileSync(path.join(messagesDir, fileName), 'utf8');
  if (/export\s+\{\s*zhCNMessages\s+as\s+\w+Messages\s+\}\s+from\s+['"]\.\/zh-CN['"]/.test(source)) {
    return readMessageObject('zh-CN.ts');
  }
  if (/\.\.\.zhCNMessages/.test(source)) {
    return readMessageObject('zh-CN.ts');
  }
  const objectStart = source.indexOf('{');
  if (objectStart < 0) {
    throw new Error(`${fileName} does not contain a message object.`);
  }

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      const literal = source.slice(objectStart, index + 1);
      return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
    }
  }

  throw new Error(`${fileName} has an unclosed message object.`);
}

function collectLeafKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix].filter(Boolean);
  return Object.keys(value).flatMap((key) => collectLeafKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

const baseline = readMessageObject(localeFiles.get(baselineLocale));
const baselineKeys = new Set(collectLeafKeys(baseline));
const failures = [];

for (const [locale, fileName] of localeFiles) {
  if (locale === baselineLocale) continue;
  const messages = readMessageObject(fileName);
  const keys = new Set(collectLeafKeys(messages));
  const missing = [...baselineKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baselineKeys.has(key));

  if (missing.length || extra.length) {
    failures.push({ locale, missing, extra });
  }
}

if (failures.length) {
  console.error('i18n message parity check failed:');
  for (const failure of failures) {
    console.error(`- ${failure.locale}: ${failure.missing.length} missing, ${failure.extra.length} extra`);
    failure.missing.slice(0, 30).forEach((key) => console.error(`  missing ${key}`));
    failure.extra.slice(0, 30).forEach((key) => console.error(`  extra ${key}`));
    if (failure.missing.length > 30 || failure.extra.length > 30) console.error('  ...');
  }
  process.exit(1);
}

console.log('i18n message parity check passed.');
