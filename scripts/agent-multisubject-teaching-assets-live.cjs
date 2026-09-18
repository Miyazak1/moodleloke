const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();
const prisma = new PrismaClient();
const base = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';

function assert(value, message) { if (!value) throw new Error(message); }
function assertLocalDatabase() {
  assert(process.env.NODE_ENV !== 'production' && process.env.MOODLELIKE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'PR12D rehearsal is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), `PR12D rehearsal only accepts a local database, received ${databaseUrl.hostname || 'unset'}.`);
}
async function request(pathname, { method = 'GET', token, body, expected = [200, 201] } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : {}; } catch { result = text; }
  assert(expected.includes(response.status), `${pathname} returned HTTP ${response.status}: ${text.slice(0, 700)}`);
  return result;
}

const scenarios = [
  {
    subject: 'physics', topicCode: 'P-MECH-002', stableKey: 'physics.newton-second-law',
    componentKey: 'physics.newton-second-law', wrongAnswer: 'double', correctAnswer: 'half'
  },
  {
    subject: 'chemistry', topicCode: 'C-BASIC-003', stableKey: 'chemistry.acid-base-neutralization',
    componentKey: 'chemistry.acid-base-neutralization', wrongAnswer: 'acidic', correctAnswer: 'neutral'
  }
];

async function runScenario({ userId, token, ...scenario }) {
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: scenario.topicCode } });
  assert(topic?.status === 'published', `Published ${scenario.topicCode} topic is missing.`);
  const published = await request(`/api/v1/agent/teaching-assets/${scenario.stableKey}?language=zh-CN`, { token });
  const publicText = JSON.stringify(published);
  assert(published.item?.component?.key === scenario.componentKey, `${scenario.stableKey} did not resolve to its registered component.`);
  assert(!publicText.includes('correctAnswer') && !publicText.includes('correctFeedback') && !publicText.includes('incorrectFeedback'), `${scenario.stableKey} leaked its active-prompt answer key.`);

  await prisma.learningIntervention.deleteMany({ where: { userId } });
  const proposal = await prisma.learningIntervention.create({
    data: {
      decisionKey: `pr12d-${scenario.subject}-${randomUUID()}`, userId, subjectCode: scenario.subject, topicId: topic.id,
      stateVersion: 'pr12d-live', policyVersion: 'intervention-shadow-v1', action: 'offer_micro_lesson',
      status: 'shadow_proposed', urgency: 'high', placement: 'between_sets',
      triggerCodes: ['repeated_misconception'], suppressionCodes: [], contentPlan: { preferredType: 'micro_lesson' },
      reasonSummary: `${scenario.subject} repeated misconception rehearsal.`, inputSnapshot: { source: 'pr12d_local_rehearsal' },
      evidenceCutoffAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  const conversation = await request('/api/v1/agent/conversations', { method: 'POST', token, body: { title: `PR12D ${scenario.subject} teaching rehearsal` } });
  const offered = await request('/api/v1/agent/interventions/offer', {
    method: 'POST', token, body: { clientRequestId: randomUUID(), context: 'after_round', conversationId: conversation.id, language: 'zh-CN' }
  });
  assert(offered.item?.interventionId === proposal.id, `${scenario.subject} proposal was not offered.`);
  assert(offered.item.content.sourceType === 'teaching_asset' && offered.item.content.teachingAsset === null, `${scenario.subject} did not keep governed content hidden before start.`);

  const deliveryId = offered.item.id;
  const started = await request(`/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'start' }
  });
  const startedText = JSON.stringify(started.content.teachingAsset);
  assert(started.content.teachingAsset?.component?.key === scenario.componentKey, `${scenario.subject} delivery resolved the wrong renderer.`);
  assert(!startedText.includes('correctAnswer') && !startedText.includes('correctFeedback') && !startedText.includes('incorrectFeedback'), `${scenario.subject} delivery leaked answer metadata.`);
  const interactionPath = `/api/v1/agent/intervention-deliveries/${deliveryId}/teaching-interactions`;
  await request(interactionPath, { method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), action: 'completed' } });
  await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'opened' } });
  const wrong = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'active_prompt_answered', value: scenario.wrongAnswer } });
  const correct = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'active_prompt_answered', value: scenario.correctAnswer } });
  assert(wrong.correct === false && correct.correct === true, `${scenario.subject} server-side active-prompt scoring failed.`);
  const assetCompletion = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'completed' } });
  assert(assetCompletion.masteryChanged === false && assetCompletion.verificationRequired === true, `${scenario.subject} completion semantics are unsafe.`);
  const deliveryCompletion = await request(`/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'complete' }
  });
  assert(deliveryCompletion.status === 'completed' && deliveryCompletion.masteryChanged === false, `${scenario.subject} delivery did not complete safely.`);
  const verification = await request('/api/v1/agent/intervention-verifications/offer', {
    method: 'POST', token, body: { clientRequestId: randomUUID(), conversationId: conversation.id }
  });
  assert(verification.item?.deliveryId === deliveryId && verification.item.phase === 'immediate', `${scenario.subject} did not schedule immediate independent verification: ${JSON.stringify(verification.shortage)}`);
  assert(verification.item.questionCount === 3, `${scenario.subject} verification did not contain three fresh reviewed questions.`);
  const exposure = await prisma.teachingAssetExposure.findFirst({ where: { userId, contextKey: `intervention_delivery:${deliveryId}` } });
  assert(exposure?.status === 'completed' && exposure.exposureLevel === 'A4', `${scenario.subject} did not persist governed A4 exposure.`);
  return {
    subject: scenario.subject, topicCode: scenario.topicCode, stableKey: scenario.stableKey,
    componentKey: started.content.teachingAsset.component.key, hiddenBeforeStart: true, answerKeyHidden: true,
    activePrompt: { wrong: wrong.correct, correct: correct.correct }, masteryChanged: assetCompletion.masteryChanged,
    exposureLevel: exposure.exposureLevel, verification: { phase: verification.item.phase, questionCount: verification.item.questionCount }
  };
}

async function main() {
  assertLocalDatabase();
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Run node scripts/agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials });
  const token = login.tokens?.accessToken;
  const userId = Number(login.user?.id);
  assert(token && Number.isInteger(userId), 'Demo login failed.');
  const results = [];
  for (const scenario of scenarios) results.push(await runScenario({ ...scenario, userId, token }));
  console.log(JSON.stringify({ verdict: 'pass', schemaVersion: '1', results }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
