import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enMessages } from '../src/i18n/messages/en.ts';
import { zhCNMessages } from '../src/i18n/messages/zh-CN.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredKeys = new Set([
  'agent.task.freePractice',
  'agent.journey.subjectQa', 'agent.journey.subjectQaHint',
  'agent.context.today', 'agent.context.startHeading', 'agent.context.resumeTeachingHeading',
  'agent.context.resumePastPaperHeading', 'agent.context.resumeMockHeading',
  'agent.context.resumePracticeHeading', 'agent.context.afterResume',
  'agent.learningEntry.interrupted', 'agent.learningEntry.resumeTeaching',
  'agent.learningEntry.resumePastPaper', 'agent.learningEntry.resumeMock',
  'agent.learningEntry.resumePractice', 'agent.learningEntry.resumeTeachingBody',
  'agent.learningEntry.resumePastPaperBody', 'agent.learningEntry.resumeMockBody',
  'agent.learningEntry.resumePracticeBody', 'agent.learningEntry.resuming',
  'agent.learningEntry.preparing', 'agent.learningEntry.start',
  'agent.freePractice.kicker', 'agent.freePractice.title', 'agent.freePractice.body',
  'agent.freePractice.subject', 'agent.freePractice.batch', 'agent.freePractice.questions',
  'agent.freePractice.start', 'agent.freePractice.starting', 'agent.freePractice.evidence',
  'agent.subjectQa.kicker', 'agent.subjectQa.title', 'agent.subjectQa.body'
]);

const settingsSource = fs.readFileSync(path.join(root, 'src', 'components', 'agent', 'AgentLearningSettingsView.tsx'), 'utf8');
for (const match of settingsSource.matchAll(/\bt\(\s*['"]((?:agent|me)\.[^'"]+)['"]/g)) requiredKeys.add(match[1]);

function readMessage(tree, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], tree);
}

// Vietnamese parity is enforced separately by test:i18n-messages. Importing that
// layered catalog directly under Node would bypass Vite's extension resolution.
const locales = [['zh-CN', zhCNMessages], ['en', enMessages]];
const missing = locales.flatMap(([locale, tree]) => [...requiredKeys]
  .filter((key) => typeof readMessage(tree, key) !== 'string')
  .map((key) => `${locale}: ${key}`));

if (missing.length) {
  console.error('Agent i18n key check failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Agent i18n key check passed.');
