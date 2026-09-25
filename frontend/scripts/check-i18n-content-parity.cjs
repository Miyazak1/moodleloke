const fs = require('node:fs');
const path = require('node:path');

const contentPath = path.resolve(__dirname, '..', 'src', 'content', 'localized', 'csca-subjects.ts');
if (!fs.existsSync(contentPath)) {
  console.error(`i18n content parity check failed: missing ${path.relative(process.cwd(), contentPath)}`);
  process.exit(1);
}

const source = fs.readFileSync(contentPath, 'utf8');

function readBalancedObject(startMarker, text = source) {
  const markerIndex = text.indexOf(startMarker);
  if (markerIndex < 0) throw new Error(`Missing ${startMarker}`);
  const objectStart = text.indexOf('{', markerIndex + startMarker.length);
  if (objectStart < 0) throw new Error(`Missing object for ${startMarker}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(objectStart, index + 1);
  }
  throw new Error(`Unclosed object for ${startMarker}`);
}

function countItems(block, field) {
  const match = block.match(new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  if (!match) return -1;
  return (match[1].match(/\{\s*(?:label:\s*['"][^'"]+['"],\s*)?title:/g) ?? []).length;
}

const failures = [];
const copy = readBalancedObject('export const CSCA_SUBJECT_COPY');
const english = readBalancedObject('en:', copy);
const vietnamese = readBalancedObject('vi:', copy);

for (const subject of ['math', 'physics', 'chemistry']) {
  const enSubject = readBalancedObject(`${subject}:`, english);
  const viSubject = readBalancedObject(`${subject}:`, vietnamese);
  for (const field of ['modules', 'tips']) {
    const enCount = countItems(enSubject, field);
    const viCount = countItems(viSubject, field);
    if (enCount < 1 || viCount < 1 || enCount !== viCount) {
      failures.push(`${subject}.${field} differs between en and vi (${enCount}/${viCount})`);
    }
  }
}

for (const requiredExport of ['CSCA_SUBJECT_LABELS', 'CSCA_PRACTICE_MODULE_LABELS', 'CSCA_PRACTICE_TOPIC_LABELS']) {
  if (!source.includes(`export const ${requiredExport}`)) failures.push(`Missing ${requiredExport}`);
}

if (failures.length) {
  console.error('i18n content parity check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('i18n content parity check passed for current standalone subject content.');
