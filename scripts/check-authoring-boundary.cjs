const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const html = read('frontend/authoring.html');
const main = read('frontend/src/main-authoring.tsx');
const app = read('frontend/src/AuthoringApp.tsx');
const studentMain = read('frontend/src/main.tsx');
const vite = read('frontend/vite.config.mjs');
const i18nProvider = read('frontend/src/i18n/I18nProvider.tsx');
const consoleShell = read('frontend/src/components/admin/AdminConsoleShell.tsx');
const teachingController = read('backend/src/agent/admin-teaching-assets.controller.ts');
const questioningController = read('backend/src/ai-questioning/ai-questioning.controller.ts');

if (!html.includes('/src/main-authoring.tsx')) throw new Error('authoring.html must have its own entry.');
if (!main.includes("import AuthoringApp from './AuthoringApp'")) throw new Error('Authoring entry must load AuthoringApp.');
if (!vite.includes("authoring: resolve(process.cwd(), 'authoring.html')")) throw new Error('Vite must build authoring as a separate HTML entry.');
if (!i18nProvider.includes('isStandaloneDocument')) throw new Error('Standalone HTML entries must not be rewritten behind locale route prefixes.');
if (!app.includes("currentUser.role !== 'admin'")) throw new Error('Authoring UI must enforce the admin role boundary.');
if (!app.includes("import('./pages/AdminAIQuestionBankPage')") || !app.includes("import('./pages/AdminTeachingAssetsPage')")) throw new Error('Authoring must lazy-load question and teaching workspaces.');
for (const forbidden of ['AdminUsersPage', 'AdminOrganizationsPage', 'AdminContentPage', 'CartPage', 'HomePage']) if (app.includes(forbidden)) throw new Error('Forbidden workspace leaked into AuthoringApp: ' + forbidden);
if (studentMain.includes('AuthoringApp') || studentMain.includes('main-authoring')) throw new Error('Student Agent entry must not import authoring.');
if (!consoleShell.includes('isStandaloneAuthoring ? authoringGroups')) throw new Error('Authoring navigation must use its reduced workspace list.');
if (!teachingController.includes('@UseGuards(RequiredAdminGuard)')) throw new Error('Teaching asset API must require admin authorization.');
if (!questioningController.includes('@UseGuards(RequiredAdminGuard)')) throw new Error('Question authoring API must require admin authorization.');
console.log('Independent authoring boundary contract passed.');
