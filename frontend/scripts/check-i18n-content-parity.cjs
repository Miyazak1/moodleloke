const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '..', 'src', 'pages', 'CscaSubjectPage.tsx');
const source = fs.readFileSync(pagePath, 'utf8');
const formulaContentPath = path.resolve(__dirname, '..', 'src', 'content', 'localized', 'csca-formulas.ts');
const formulaContentSource = fs.readFileSync(formulaContentPath, 'utf8');

function readConstArray(name, text = source) {
  const marker = `const ${name}`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const valueStart = text.indexOf('=', start);
  if (valueStart < 0) throw new Error(`Missing value for ${name}`);
  const arrayStart = text.indexOf('[', valueStart);
  if (arrayStart < 0) throw new Error(`Missing array for ${name}`);

  let depth = 0;
  for (let index = arrayStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) return text.slice(arrayStart, index + 1);
  }
  throw new Error(`Unclosed array for ${name}`);
}

function readPhysicsFormulaCopySections() {
  const copyStart = formulaContentSource.indexOf('export const CSCA_FORMULA_COPY');
  if (copyStart < 0) throw new Error('Missing CSCA_FORMULA_COPY');
  const physicsStart = formulaContentSource.indexOf('physics:', copyStart);
  if (physicsStart < 0) throw new Error('Missing CSCA_FORMULA_COPY.en.physics');
  const sectionsStart = formulaContentSource.indexOf('sections:', physicsStart);
  if (sectionsStart < 0) throw new Error('Missing CSCA_FORMULA_COPY.en.physics.sections');
  const arrayStart = formulaContentSource.indexOf('[', sectionsStart);
  if (arrayStart < 0) throw new Error('Missing array for CSCA_FORMULA_COPY.en.physics.sections');

  let depth = 0;
  for (let index = arrayStart; index < formulaContentSource.length; index += 1) {
    const char = formulaContentSource[index];
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) return formulaContentSource.slice(arrayStart, index + 1);
  }

  throw new Error('Unclosed array for CSCA_FORMULA_COPY.en.physics.sections');
}

function countTopLevelSections(text) {
  return (text.match(/\btitle:\s*['"]/g) ?? []).length;
}

function countItems(text) {
  return (text.match(/\bname:\s*['"]/g) ?? []).length;
}

const parityPairs = [
  ['PHYSICS_FORMULA_SECTIONS', 'CSCA_FORMULA_COPY.en.physics.sections', readPhysicsFormulaCopySections]
];

const failures = [];
for (const [baseName, localizedName, readLocalized] of parityPairs) {
  const base = readConstArray(baseName);
  const localized = readLocalized();
  const baseSections = countTopLevelSections(base);
  const localizedSections = countTopLevelSections(localized);
  const baseItems = countItems(base);
  const localizedItems = countItems(localized);

  if (baseSections !== localizedSections || baseItems !== localizedItems) {
    failures.push(`${localizedName} does not match ${baseName}: sections ${localizedSections}/${baseSections}, items ${localizedItems}/${baseItems}`);
  }
}

if (failures.length) {
  console.error('i18n content parity check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('i18n content parity check passed.');
