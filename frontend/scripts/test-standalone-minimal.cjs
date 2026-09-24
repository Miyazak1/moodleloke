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
  'src/components/agent/AgentAsyncState.tsx',
  'src/components/agent/AgentLearningCards.tsx',
  'src/components/agent/AgentStructuredReportMessage.tsx',
  'src/lib/agent-host-bridge.ts',
  'src/components/agent/AgentPastPaperWorkspace.tsx',
  'src/styles/agent-motion.css'
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
const agentPage = fs.readFileSync(path.join(root, 'src/pages/AgentPage.tsx'), 'utf8');
const agentSettings = fs.readFileSync(path.join(root, 'src/components/agent/AgentLearningSettingsView.tsx'), 'utf8');
const agentAsyncState = fs.readFileSync(path.join(root, 'src/components/agent/AgentAsyncState.tsx'), 'utf8');
const agentLearningCards = fs.readFileSync(path.join(root, 'src/components/agent/AgentLearningCards.tsx'), 'utf8');
const agentReport = fs.readFileSync(path.join(root, 'src/components/agent/AgentStructuredReportMessage.tsx'), 'utf8');
const agentHostBridge = fs.readFileSync(path.join(root, 'src/lib/agent-host-bridge.ts'), 'utf8');
const agentMotion = fs.readFileSync(path.join(root, 'src/styles/agent-motion.css'), 'utf8');
if (!main.includes("import App from './StandaloneAgentApp'")) throw new Error('StandaloneAgentApp is not the production entry.');
if (shell.includes('AppRouteRenderer')) throw new Error('Legacy route renderer leaked into standalone shell.');
if (!agentPage.includes('className="agent-jump-to-latest"')) throw new Error('Agent conversation must preserve a visible return-to-latest control.');
if (!agentPage.includes('role="radiogroup"') || !agentPage.includes('role="radio"')) throw new Error('Free-practice choices must expose single-selection semantics.');
if (!agentPage.includes('role="log"') || !agentPage.includes('aria-relevant="additions"')) throw new Error('Agent conversation must expose stable log semantics without announcing every stream container update.');
if (shell.includes('>Loading…<')) throw new Error('Standalone Agent shell must not expose an English-only loading fallback.');
if (!agentSettings.includes('recommendationReason') || agentSettings.includes('<p>{journeyOverview.nextDecision.reasonSummary}</p>')) throw new Error('Recommendation reasons must be localized instead of exposing internal decision text directly.');
if (!agentLearningCards.includes('localizedInterventionReason') || agentLearningCards.includes('isReading ? item.content.body : item.reasonSummary')) throw new Error('Intervention reasons must not expose internal policy text directly in the Chinese UI.');
for (const componentName of ['AgentJourneyResourcesView', 'EvidenceCandidateCard', 'InterventionCard', 'InterventionVerificationCard']) {
  if (!agentLearningCards.includes(`export function ${componentName}`) || agentPage.includes(`function ${componentName}`)) throw new Error(`${componentName} must stay outside the Agent page orchestrator.`);
}
if (!agentHostBridge.includes('export type AgentHostBridge') || !agentHostBridge.includes('requestAuthentication')) throw new Error('Agent host integration must expose an explicit navigation and authentication bridge.');
if (!shell.includes('createAgentHostBridge') || !shell.includes('host={agentHost}')) throw new Error('Standalone shell must consume the same host bridge expected from CSCALite.');
if (!agentReport.includes('localizedDecisionReason') || agentReport.includes('learningReview.nextDecision?.reasonSummary ?? \'\'}`')) throw new Error('Report recommendations must localize internal decision text.');
if (!agentAsyncState.includes("kind: 'loading' | 'error' | 'empty'") || !agentAsyncState.includes("role={kind === 'error' ? 'alert' : 'status'}")) throw new Error('Agent async states must share loading, error and empty semantics.');
for (const marker of ['--agent-motion-fast', '--agent-motion-panel', '@media (prefers-reduced-motion: reduce)']) {
  if (!agentMotion.includes(marker)) throw new Error(`Agent motion contract is missing ${marker}.`);
}
if (!agentMotion.includes('@media (pointer: coarse)') || !agentMotion.includes('min-height: 44px')) throw new Error('Agent touch targets must preserve the coarse-pointer size contract.');
if (!agentMotion.includes(':focus-visible') || !agentMotion.includes('outline-offset: 2px')) throw new Error('Agent controls must preserve a visible keyboard-focus contract.');
console.log('Standalone minimal contract passed.');
