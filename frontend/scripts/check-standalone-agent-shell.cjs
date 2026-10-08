const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'StandaloneAgentApp.tsx'), 'utf8');
const adminApp = fs.readFileSync(path.join(root, 'src', 'AdminApp.tsx'), 'utf8');
const agentPage = fs.readFileSync(path.join(root, 'src', 'pages', 'AgentPage.tsx'), 'utf8');
const accountPage = fs.readFileSync(path.join(root, 'src', 'pages', 'PublicMePage.tsx'), 'utf8');
const authPage = fs.readFileSync(path.join(root, 'src', 'pages', 'PublicAuthPage.tsx'), 'utf8');
const publicHomePage = fs.readFileSync(path.join(root, 'src', 'pages', 'PublicHomePage.tsx'), 'utf8');
const publicAboutPage = fs.readFileSync(path.join(root, 'src', 'pages', 'PublicAboutPage.tsx'), 'utf8');
const siteHeaderControls = fs.readFileSync(path.join(root, 'src', 'components', 'SiteHeaderControls.tsx'), 'utf8');
const loadingState = fs.readFileSync(path.join(root, 'src', 'components', 'AppLoadingState.tsx'), 'utf8');
const loadingStyles = fs.readFileSync(path.join(root, 'src', 'styles', 'loading.css'), 'utf8');
const homePage = fs.readFileSync(path.join(root, 'src', 'pages', 'HomePage.tsx'), 'utf8');
const contentController = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'content', 'content.controller.ts'), 'utf8');
const adminAuditController = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'admin-audit', 'admin-audit.controller.ts'), 'utf8');
const adminAuditService = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'admin-audit', 'admin-audit.service.ts'), 'utf8');
const questionEngineController = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'question-engine-plugin', 'question-engine-plugin.controller.ts'), 'utf8');
const questionEngineRegistry = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'question-engine-plugin', 'question-engine-plugin-registry.service.ts'), 'utf8');
const questionGeneratorProvider = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'ai-questioning', 'question-generator-provider.service.ts'), 'utf8');
const questionReviewerProvider = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'ai-questioning', 'question-reviewer-provider.service.ts'), 'utf8');
const questionTopicMapperProvider = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'ai-questioning', 'question-topic-mapper-provider.service.ts'), 'utf8');
const aiQuestioningModule = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'ai-questioning', 'ai-questioning.module.ts'), 'utf8');
const appModule = fs.readFileSync(path.join(root, '..', 'backend', 'src', 'app.module.ts'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src', 'pages', 'StudentOnboardingPage.tsx'), 'utf8');
const i18nProvider = fs.readFileSync(path.join(root, 'src', 'i18n', 'I18nProvider.tsx'), 'utf8');
const adaptivePractice = fs.readFileSync(path.join(root, 'src', 'pages', 'special-practice', 'adaptive', 'AdaptivePracticeViews.tsx'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const checks = [
  [main.includes("import('./StandaloneAgentApp')"), 'main.tsx must dynamically load StandaloneAgentApp'],
  [main.includes("import('./AdminApp')") && main.includes('isAdminPath'), 'admin paths must bootstrap the isolated AdminApp'],
  [!main.includes("import App from './App'"), 'main.tsx must not load the legacy site App'],
  [adminApp.includes('AdminContentPage') && adminApp.includes('AdminOperationsPage') && adminApp.includes('AdminQuestionEnginePage') && adminApp.includes('buildAdminAuthRedirectUrl'), 'AdminApp must mount the guarded operations, content, and question-engine workspaces'],
  [adminApp.includes('AdminMockExamPage') && adminApp.includes('AdminPastPapersPage') && adminApp.includes('AdminSpecialPracticePage') && adminApp.includes('AdminOrganizationsPage') && adminApp.includes('AdminUsersPage'), 'AdminApp must mount the inherited learning-content and account-management workspaces'],
  [adminApp.includes('site-main-public site-main-admin') && adminApp.includes('SiteHeaderControls'), 'AdminApp must retain the shared CSCALite header and constrained public-shell layout'],
  [adminApp.includes('ADMIN_PAGE_PRELOADERS') && adminApp.includes('requestIdleCallback'), 'AdminApp must preload lazy workspaces while the browser is idle'],
  [adminApp.includes('onAdminNavigate={navigateAdmin}') && siteHeaderControls.includes('onAdminNavigate'), 'admin account-menu navigation must stay inside the client shell'],
  [adminApp.includes('<AppLoadingState variant="admin"') && shell.includes('<AppLoadingState variant="page"'), 'lazy routes must use the branded loading state'],
  [loadingState.includes('aria-busy="true"') && loadingStyles.includes('prefers-reduced-motion'), 'the branded loading state must remain accessible and respect reduced motion'],
  [adminApp.includes('ADMIN_PATHS.has(path)'), 'unknown admin routes must fail closed'],
  [adminAuditController.includes("@Get('api/v1/admin/ops/overview')"), 'the admin operations overview must use its canonical API route'],
  [!adminAuditController.includes("'admin/audit'") && !adminAuditController.includes("'admin/audit-logs'"), 'unprefixed legacy audit API aliases must stay removed'],
  [adminAuditService.includes('activeAgentConversationCount') && adminAuditService.includes("module: 'content'"), 'the operations overview must report Agent and content activity'],
  [appModule.includes('AdminAuditModule') && appModule.includes('QuestionEnginePluginModule'), 'the backend must mount guarded admin operations and question-engine modules'],
  [questionEngineController.includes("@Get('api/v1/admin/question-engine/plugins/status')") && questionEngineController.includes('RequiredAdminGuard'), 'question-engine status must use a guarded canonical route'],
  [questionEngineRegistry.includes("fallbackMode: 'verified-bank-only'") && questionEngineRegistry.includes('arbitraryRuntimeCodeLoading: false'), 'question-engine plugins must fail safely without arbitrary runtime code loading'],
  [questionEngineRegistry.includes("enforcedCapabilities: ['question.generate', 'question.review', 'question.topic-map']"), 'the plugin registry must disclose every enforced capability'],
  [questionGeneratorProvider.includes("allowsProductionCapability('question.generate')"), 'production question generation must pass through the plugin capability gate'],
  [questionReviewerProvider.includes("allowsProductionCapability('question.review')"), 'provider question review must pass through the plugin capability gate'],
  [questionTopicMapperProvider.includes("allowsProductionCapability('question.topic-map')"), 'provider topic mapping must pass through the plugin capability gate'],
  [aiQuestioningModule.includes('QuestionEnginePluginModule'), 'AIQuestioningModule must import the question-engine plugin boundary'],
  [!shell.includes('AppRouteRenderer'), 'standalone shell must not depend on AppRouteRenderer'],
  [/run-agent-playwright\.cjs/.test(packageJson.scripts['test:i18n']), 'i18n browser checks must use the managed Vite runner so Windows exits cleanly'],
  [shell.includes("import('./pages/AgentPage')"), 'AgentPage must be route-lazy-loaded'],
  [shell.includes("import('./pages/PublicHomePage')"), 'the inherited public home must be route-lazy-loaded'],
  [shell.includes("import('./pages/PublicAboutPage')") && shell.includes("route === 'about'"), 'the public trust and disclosure page must be route-lazy-loaded'],
  [publicAboutPage.includes("t('about.independentBody'") && publicAboutPage.includes('https://csca.cn/about/examintro'), 'the public about page must disclose its independent status and link to official CSCA information'],
  [shell.includes("route === 'home'"), 'the root route must render the inherited public home'],
  [shell.includes("route !== 'home'"), 'the public home must not receive a duplicate shell language selector'],
  [publicHomePage.includes('getPublicContent({ locale })'), 'the public home must load locale-aware CMS content'],
  [publicHomePage.includes('SiteHeaderControls') && siteHeaderControls.includes('site-language-button') && siteHeaderControls.includes('site-account-menu'), 'the public shell must retain the inherited CSCALite language and signed-in account controls'],
  [homePage.includes('copy.hero.title') && homePage.includes('copy.practice.title'), 'the inherited home must render CMS-managed copy'],
  [!/(routes\.(cscaPrep|cscaExamTime|cscaMockExam|cscaSubjects)|href=["'`]\/csca-|href=["'`]\/schools|href=["'`]\/services\/consulting)/.test(homePage), 'the inherited home must not link to retired CSCALITE student or consulting routes'],
  [contentController.includes("@Get('api/v1/content/home')") && !contentController.includes("'public-content'"), 'public home content must use only the canonical API route'],
  [appModule.includes('ContentModule'), 'the backend application must mount ContentModule'],
  [shell.includes("import('./pages/PublicMePage')"), 'the inherited personal learning center must be route-lazy-loaded'],
  [accountPage.includes('AccountSectionNav') && accountPage.includes('AccountSettingsWorkspace'), 'the personal learning center must retain its overview, records, review, and settings structure'],
  [shell.includes("from './lib/standalone-route-policy'"), 'standalone shell must use the shared route policy'],
  [shell.includes('resolveStandaloneHref(legacyLearningPath, window.location.origin)'), 'internal navigation must resolve through the shared route policy'],
  [shell.includes("route === 'not-found'"), 'unknown paths must render a not-found state'],
  [authPage.includes("mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset'"), 'the canonical auth page must preserve login, register, forgot, and reset modes'],
  [shell.includes('initialMode={readInitialAuthMode()}'), 'direct /register visits must retain registration mode before history canonicalization runs'],
  [shell.includes('returnTo={safeReturnPath('), 'onboarding return paths must use the shared standalone allowlist'],
  [!fs.existsSync(path.join(root, 'src', 'lib', 'locale-routing.ts')), 'locale-prefixed routing must stay removed'],
  [!i18nProvider.includes('buildLocalizedPath') && !i18nProvider.includes('getLocaleFromPathname'), 'language selection must not rewrite browser routes'],
  [!shell.includes('/zh/') && !shell.includes('stripLocaleFromPath'), 'standalone routes must not accept locale prefixes'],
  [!adaptivePractice.includes('className="agent-handwriting-input"'), 'the practice card must not render a persistent file input'],
  [adaptivePractice.includes("document.createElement('input')") && adaptivePractice.includes("input.className = 'agent-handwriting-input'"), 'handwriting upload must create a temporary picker only after the explicit review action'],
  [!shell.includes("let nextRoute: StandaloneRoute = 'agent'"), 'unknown internal paths must not silently fall back to Agent'],
  [!agentPage.includes('!hasExplicitContext) restoreJourneyWorkspace'), 'a clean /agent route must show an explicit resume entry instead of auto-opening a task'],
  [agentPage.includes("params.get('agentSection')"), 'Agent sections must support explicit deep-link intent'],
  [accountPage.includes('<AccountSettingsWorkspace'), 'the account page must expose the inherited settings workspace'],
  [!onboarding.includes('onNavigate(routes.adminAudit)'), 'onboarding must not navigate to retired in-app admin routes'],
  [!onboarding.includes('onNavigate(routes.cscaMockExam)'), 'onboarding must not navigate to retired CSCA site routes'],
  [onboarding.includes("window.location.assign('/authoring.html')"), 'admin onboarding must enter the standalone authoring document']
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log('Standalone Agent shell contract passed.');
