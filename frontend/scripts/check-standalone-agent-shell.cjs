const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'StandaloneAgentApp.tsx'), 'utf8');

const checks = [
  [main.includes("import App from './StandaloneAgentApp'"), 'main.tsx must load StandaloneAgentApp'],
  [!main.includes("import App from './App'"), 'main.tsx must not load the legacy site App'],
  [!shell.includes('AppRouteRenderer'), 'standalone shell must not depend on AppRouteRenderer'],
  [shell.includes("import('./pages/AgentPage')"), 'AgentPage must be route-lazy-loaded'],
  [shell.includes("import('./pages/StandaloneAccountPage')"), 'standalone account page must be route-lazy-loaded'],
  [!shell.includes("import('./pages/PublicMePage')"), 'legacy PublicMePage must not be loaded'],
  [shell.includes("type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me'"), 'standalone route allowlist must stay explicit']
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log('Standalone Agent shell contract passed.');
