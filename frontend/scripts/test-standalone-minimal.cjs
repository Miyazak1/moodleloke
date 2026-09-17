const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'src/main.tsx',
  'src/StandaloneAgentApp.tsx',
  'src/pages/AgentPage.tsx',
  'src/pages/StandaloneAccountPage.tsx',
  'src/pages/PublicAuthPage.tsx',
  'src/pages/StudentOnboardingPage.tsx',
  'src/components/agent/AgentLearningSettingsView.tsx',
  'src/components/agent/AgentPastPaperWorkspace.tsx'
];
const removedLegacy = [
  'src/App.tsx',
  'src/components/AppRouteRenderer.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/PublicMePage.tsx'
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) throw new Error('Missing standalone runtime file: ' + relativePath);
}
for (const relativePath of removedLegacy) {
  if (fs.existsSync(path.join(root, relativePath))) throw new Error('Legacy site file must stay removed: ' + relativePath);
}

const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/StandaloneAgentApp.tsx'), 'utf8');
if (!main.includes("import App from './StandaloneAgentApp'")) throw new Error('StandaloneAgentApp is not the production entry.');
if (shell.includes('AppRouteRenderer')) throw new Error('Legacy route renderer leaked into standalone shell.');
console.log('Standalone minimal contract passed.');
