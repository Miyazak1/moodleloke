const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

function filesUnder(relativeDirectory) {
  const output = [];
  const visit = (absoluteDirectory) => {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) output.push(path.relative(root, absolutePath).replaceAll('\\', '/'));
    }
  };
  visit(path.join(root, relativeDirectory));
  return output.sort();
}

const frontendFiles = filesUnder('frontend/src');
const visibleBrandFiles = [
  ...frontendFiles,
  'backend/src/agent/agent-attachment-analysis.service.ts',
  'backend/src/common/ops-metrics.ts',
  'scripts/agent-demo-release-gate.cjs'
];
for (const relativePath of visibleBrandFiles) {
  expect(!/cscapilot/i.test(read(relativePath)), `Former visible product brand remains: ${relativePath}`);
}

const allowedLegacyStorageFiles = new Set([
  'frontend/src/i18n/locales.ts',
  'frontend/src/lib/request.ts',
  'frontend/src/lib/use-auth-session.ts',
  'frontend/src/pages/AgentPage.tsx',
  'frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx'
]);
for (const relativePath of frontendFiles) {
  const contents = read(relativePath);
  if (/cscalite[.:]/i.test(contents)) {
    expect(allowedLegacyStorageFiles.has(relativePath), `Legacy browser identity exists outside the migration allowlist: ${relativePath}`);
    expect(/legacy/i.test(contents), `Legacy browser key lacks an explicit migration marker: ${relativePath}`);
  }
}

const request = read('frontend/src/lib/request.ts');
for (const marker of ['moodlelike.accessToken', 'moodlelike.refreshToken', 'moodlelike:auth-changed', 'LEGACY_TOKEN_KEY', 'LEGACY_REFRESH_TOKEN_KEY']) {
  expect(request.includes(marker), `Authentication storage migration is missing: ${marker}`);
}
const storageCompat = read('frontend/src/lib/storage-compat.ts');
for (const marker of ['readMigratedLocalStorage', 'setItem(primaryKey, legacy)', 'removeItem(legacyKey)']) {
  expect(storageCompat.includes(marker), `Storage migration helper is incomplete: ${marker}`);
}
const provider = read('frontend/src/i18n/I18nProvider.tsx');
expect(provider.includes('LEGACY_LOCALE_STORAGE_KEY') && provider.includes('removeItem(LEGACY_LOCALE_STORAGE_KEY)'), 'Locale migration must consume and remove its legacy key.');
expect(read('BROWSER_IDENTITY_MIGRATION.md').includes('Logout clears both generations'), 'Browser identity documentation must preserve the logout-cleanup contract.');

console.log('Moodlelike browser identity contract passed.');
