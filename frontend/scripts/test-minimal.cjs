const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const requiredFiles = [
  'src/App.tsx',
  'src/main.tsx',
  'src/lib/routes.ts',
  'src/lib/app-navigation.ts',
  'src/pages/HomePage.tsx',
  'src/pages/CscaPrepPage.tsx',
  'src/pages/CscaExamTimePage.tsx',
  'src/pages/CscaSubjectPage.tsx',
  'src/pages/CscaSpecialPracticePage.tsx',
  'src/pages/CscaMockExamPage.tsx',
  'src/pages/PastPaperPages.tsx',
  'src/pages/ConsultingPage.tsx',
  'src/pages/AIServicePage.tsx',
  'src/pages/PublicAuthPage.tsx',
  'src/pages/PublicMePage.tsx',
  'src/components/account/AccountSettingsWorkspace.tsx',
  'src/pages/AdminAuditPage.tsx',
  'src/pages/AdminAIOperationsPage.tsx',
  'src/pages/AdminAIQuestionBankPage.tsx',
  'src/pages/AdminContentPage.tsx',
  'src/pages/AdminMockExamPage.tsx',
  'src/pages/AdminPastPapersPage.tsx',
  'src/pages/AdminSpecialPracticePage.tsx',
  'src/pages/AdminOrganizationsPage.tsx',
  'src/pages/AdminUsersPage.tsx',
  'src/components/Icon.tsx',
  'src/components/StatusPanel.tsx',
  'src/components/AppRouteRenderer.tsx',
  'src/lib/app-nav-items.ts',
  'src/i18n/I18nProvider.tsx',
  'src/i18n/useI18n.ts',
  'src/i18n/locales.ts',
  'src/i18n/messages/zh-CN.ts',
  'src/i18n/messages/en.ts'
];

const requiredAppSnippets = [
  'HomePage',
  'CscaPrepPage',
  'CscaSubjectPage',
  'CscaMockExamPage',
  'PastPaperPages',
  'ConsultingPage',
  'AIServicePage',
  'PublicAuthPage',
  'PublicMePage',
  'AdminAuditPage',
  'AdminAIOperationsPage',
  'AdminAIQuestionBankPage',
  'AdminContentPage',
  'AdminMockExamPage',
  'AdminPastPapersPage',
  'AdminSpecialPracticePage',
  'AdminOrganizationsPage',
  'AdminUsersPage',
  'primaryNavItems',
  'utilityNavItems',
  'Icon',
  'site-footer',
  'site-auth-actions',
  'site-avatar-button',
  'site-account-menu',
  'expanded-footer',
  'CSCA 准备',
  'AI 服务'
];

const requiredHomeSnippets = [
  'data-home-hero="csca-mock-first"',
  '开始免费模考',
  '进入科目训练',
  'home-route-band',
  'home-practice-board',
  'home-exam-slice',
  'home-page',
  'home-subject-lanes',
  'home-path-canvas',
  'home-footer-cta',
  '先做一套 CSCA 模考'
];

const requiredRouteSnippets = [
  "home: '/'",
  "cscaPrep: '/csca-prep'",
  "cscaSubjects: '/csca-subjects'",
  "cscaMockExam: '/csca-mock-exam'",
  "pastPapers: '/past-papers'",
  "consulting: '/services/consulting'",
  "aiCoachService: '/services/ai-coach'",
  "auth: '/auth'",
  "me: '/me'",
  "adminAudit: '/admin/audit'",
  "adminAiOperations: '/admin/ai'",
  "adminAIQuestionBank: '/admin/ai-question-bank'",
  "adminContent: '/admin/content'",
  "adminMockExams: '/admin/mock-exams'",
  "adminPastPapers: '/admin/past-papers'",
  "adminSpecialPractice: '/admin/special-practice'",
  "adminOrganizations: '/admin/organizations'",
  "adminUsers: '/admin/users'"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readStylesSurface() {
  const stylesDir = path.join(root, 'src/styles');
  const splitStyles = fs.existsSync(stylesDir)
    ? fs
        .readdirSync(stylesDir)
        .filter((file) => file.endsWith('.css'))
        .sort()
        .map((file) => read(`src/styles/${file}`))
    : [];

  return [read('src/styles.css'), ...splitStyles].join('\n');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Missing frontend minimal files:');
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const app = read('src/App.tsx');
const main = read('src/main.tsx');
const appRouteSurface = [
  app,
  read('src/components/AppRouteRenderer.tsx'),
  read('src/lib/app-nav-items.ts')
].join('\n');
for (const snippet of requiredAppSnippets) {
  assert(appRouteSurface.includes(snippet), `app route surface is missing required route/page marker: ${snippet}`);
}
assert(app.includes('site-header-home'), 'src/App.tsx is missing S22 homepage header marker: site-header-home');
assert(app.includes('isAccountMenuOpen'), 'src/App.tsx must keep the account avatar dropdown state.');
assert(app.includes('后台管理'), 'src/App.tsx must keep admin access inside the account dropdown menu.');
assert(app.includes('expanded-footer'), 'src/App.tsx must keep the S23 expanded footer marker.');
assert(main.includes('I18nProvider'), 'src/main.tsx must wrap the app in I18nProvider.');
assert(!app.includes('const ICONIFY_BASE'), 'src/App.tsx should use the shared Icon component instead of redefining Iconify URLs.');
assert(!app.includes('site-account-auth'), 'src/App.tsx should not render the old verbose account pill.');

const locales = read('src/i18n/locales.ts');
assert(locales.includes("DEFAULT_LOCALE: Locale = 'zh-CN'"), 'i18n default locale must remain zh-CN.');
assert(locales.includes("code: 'en'") && locales.includes('enabled: true'), 'English must stay enabled in locale config.');

const header = read('src/components/SiteHeader.tsx');
assert(header.includes('LanguageSelector'), 'SiteHeader must render the language selector.');
assert(header.includes('site-language-menu'), 'SiteHeader must keep the language dropdown menu marker.');

const apiContent = read('src/lib/api-content.ts');
assert(apiContent.includes('locale?: string'), 'content API helper must accept locale.');
assert(apiContent.includes('toQueryString(params)'), 'content API helper must send locale as query params.');

const home = read('src/pages/HomePage.tsx');
for (const snippet of requiredHomeSnippets) {
  assert(home.includes(snippet), `src/pages/HomePage.tsx is missing S22 homepage marker: ${snippet}`);
}
assert(!home.includes('home-tool-search'), 'src/pages/HomePage.tsx must not use the withdrawn tool-search hero.');
assert(!home.includes('ProductHero'), 'src/pages/HomePage.tsx must not use the withdrawn product-tool hero component.');
assert(!home.includes('onSearch'), 'src/pages/HomePage.tsx must not accept a hero search callback.');
assert(!home.includes('SchoolDecisionCard'), 'src/pages/HomePage.tsx should use lightweight marketing case cards, not database decision cards.');

const routes = read('src/lib/routes.ts');
for (const snippet of requiredRouteSnippets) {
  assert(routes.includes(snippet), `src/lib/routes.ts is missing required route marker: ${snippet}`);
}

const publicLearningApi = [
  read('src/lib/api-special-practice.ts'),
  read('src/lib/api-mock-exam.ts'),
  read('src/lib/api-past-papers.ts')
].join('\n');
for (const snippet of ['getSpecialPracticeOverview', 'createAdaptivePracticeSession', 'createAdaptivePracticeRound', 'getMockExamOverview', 'createMockExamAttempt', 'getPastPapers', 'downloadPastPaperFile']) {
  assert(publicLearningApi.includes(snippet), `frontend learning API surface is missing required operation: ${snippet}`);
}

const accountSettings = read('src/components/account/AccountSettingsWorkspace.tsx');
const meApi = read('src/lib/api-me.ts');
for (const snippet of ['账号资料', '学习画像', '考试目标', '学习时间', '机构与额度', 'Agent 核心输入']) {
  assert(accountSettings.includes(snippet), `personal settings workspace is missing section marker: ${snippet}`);
}
for (const snippet of ['getMyAgentLearningSettings', 'updateMyAgentScoreGoal', 'updateMyAgentStudyAvailability']) {
  assert(meApi.includes(snippet), `personal settings API is missing operation: ${snippet}`);
}

const adminApi = read('src/lib/api-admin.ts');
for (const snippet of ['getAdminAIQuestioningOperationalReadiness', 'getAdminMockExamPapers', 'getAdminSpecialPracticeTopics', 'getAdminAdaptiveAIOrganizations']) {
  assert(adminApi.includes(snippet), `frontend admin API surface is missing required operation: ${snippet}`);
}

const navigation = read('src/lib/app-navigation.ts');
for (const retiredRoute of ['routes.schools', 'routes.search', 'routes.adminSchools', 'routes.adminScholarships']) {
  assert(!navigation.includes(retiredRoute), `frontend known-route surface must not restore retired route: ${retiredRoute}`);
}

const statusPanel = read('src/components/StatusPanel.tsx');
for (const snippet of ['status-panel', 'status-panel-warning', 'status-panel-danger']) {
  assert(statusPanel.includes(snippet), `src/components/StatusPanel.tsx is missing S21 status marker: ${snippet}`);
}

const styles = readStylesSurface();
for (const snippet of ['status-panel', 'site-account-secondary.active', 'site-auth-actions', 'site-avatar-button', 'site-account-menu', 'site-avatar-admin', 'grid-template-areas', 'S21', 'S22', 'home-hero', 'home-footer-cta', 'site-main-home', 'site-footer', 'home-route-band', 'home-practice-board', 'home-subject-lanes', 'home-path-canvas', 'home-exam-slice', 'overflow-x: hidden', '--brand-primary']) {
  assert(styles.includes(snippet), `frontend styles surface is missing frontend design marker: ${snippet}`);
}
assert(!styles.includes('.marketing-home {\n  display: grid;\n  gap: 0;\n  background: #fff;'), 'src/styles.css must not restore a white homepage content background.');
assert(!styles.includes('.marketing-practice-band {\n  width: 100vw;'), 'src/styles.css must avoid 100vw homepage bands that create horizontal scroll.');
for (const duolingoColor of ['#58cc02', '#46a900', '#45bf00']) {
  assert(!styles.includes(duolingoColor), `src/styles.css must not keep Duolingo-like color ${duolingoColor}.`);
}
for (const legacyBrightGreen of ['#5fcd44', '#72e249', '#59c53a']) {
  assert(!styles.includes(legacyBrightGreen), `src/styles.css must not keep old bright-green CTA color ${legacyBrightGreen}.`);
}
console.log('CSCAlite frontend minimal check passed.');
