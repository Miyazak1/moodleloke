const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const compose = read('deploy/docker-compose.prod.yml');
const backendImage = read('deploy/backend.Dockerfile');
const frontendImage = read('deploy/frontend.Dockerfile');
const productionExample = read('.env.production.example');
const cookies = read('backend/src/auth/auth.cookies.ts');
const request = read('frontend/src/lib/request.ts');
const authService = read('backend/src/auth/auth.service.ts');
const activeIdentitySurfaces = [
  authService,
  read('backend/src/auth/auth-email.sender.ts'),
  cookies,
  read('backend/src/common/structured-error.filter.ts'),
  read('backend/src/csca-special-practice/ai-entitlement.service.ts'),
  request,
  read('scripts/cookie-only-smoke.cjs')
].join('\n');

for (const [name, contents] of [['production Compose', compose], ['backend image', backendImage], ['frontend image', frontendImage]]) {
  expect(!/cscalite|cscapilot|CSC_DOCKER/i.test(contents), `${name} restored a former product deployment identity.`);
}
for (const marker of [
  'moodlelike-backend:migrate', 'moodlelike-backend:prod', 'moodlelike-frontend:prod',
  'moodlelike-postgres-data', 'moodlelike-backups', 'moodlelike-uploads', 'MOODLELIKE_HTTP_PORT'
]) expect(compose.includes(marker), `Production Compose is missing Moodlelike identity marker: ${marker}`);

for (const cookieName of ['moodlelike_refresh', 'moodlelike_csrf', 'moodlelike_oauth_state']) {
  expect(productionExample.includes(cookieName), `Production example is missing Cookie identity: ${cookieName}`);
  expect(cookies.includes(cookieName), `Backend Cookie default is missing: ${cookieName}`);
}
expect(frontendImage.includes('moodlelike_csrf') && request.includes('moodlelike_csrf'), 'Frontend CSRF Cookie defaults are not aligned.');
for (const former of ['cscalite_refresh', 'cscalite_csrf', 'cscalite_oauth_state', 'www.cscapilot.com', '/cscalite?schema=']) {
  expect(!productionExample.includes(former), `Production example retains former deployment identity: ${former}`);
}
expect(!authService.includes('CSCAPilot'), 'Authentication email copy must use the Moodlelike product identity.');
expect(!/CSCAPilot|cscalite\.local|cscalite_(?:refresh|csrf|oauth_state)/i.test(activeIdentitySurfaces), 'Active authentication/session surfaces retain a former product identity.');
expect(read('DEPLOYMENT_IDENTITY.md').includes('Changing a Compose volume name does not migrate data.'), 'Deployment identity documentation must preserve the data-cutover warning.');

console.log('Moodlelike deployment identity contract passed.');
