const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'StandaloneAgentApp.tsx'), 'utf8');
const agentPage = fs.readFileSync(path.join(root, 'src', 'pages', 'AgentPage.tsx'), 'utf8');
const accountPage = fs.readFileSync(path.join(root, 'src', 'pages', 'StandaloneAccountPage.tsx'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src', 'pages', 'StudentOnboardingPage.tsx'), 'utf8');

const checks = [
  [main.includes("import App from './StandaloneAgentApp'"), 'main.tsx must load StandaloneAgentApp'],
  [!main.includes("import App from './App'"), 'main.tsx must not load the legacy site App'],
  [!shell.includes('AppRouteRenderer'), 'standalone shell must not depend on AppRouteRenderer'],
  [shell.includes("import('./pages/AgentPage')"), 'AgentPage must be route-lazy-loaded'],
  [shell.includes("import('./pages/StandaloneAccountPage')"), 'standalone account page must be route-lazy-loaded'],
  [!shell.includes("import('./pages/PublicMePage')"), 'legacy PublicMePage must not be loaded'],
  [shell.includes("type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me'"), 'standalone route allowlist must stay explicit'],
  [shell.includes('const preserveSuffix = isKnownStandalonePath'), 'unknown legacy paths must not retain stale query parameters'],
  [!agentPage.includes('!hasExplicitContext) restoreJourneyWorkspace'), 'a clean /agent route must show an explicit resume entry instead of auto-opening a task'],
  [agentPage.includes("params.get('agentSection')"), 'Agent sections must support explicit deep-link intent'],
  [accountPage.includes('`${routes.agent}?agentSection=settings`'), 'the account page learning-settings action must open Agent learning settings'],
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
