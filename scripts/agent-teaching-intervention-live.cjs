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
  assert(process.env.NODE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'PR12C rehearsal is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), `PR12C rehearsal only accepts a local database, received ${databaseUrl.hostname || 'unset'}.`);
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

async function main() {
  assertLocalDatabase();
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Run node scripts/agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials });
  const token = login.tokens?.accessToken;
  const userId = Number(login.user?.id);
  assert(token && Number.isInteger(userId), 'Demo login failed.');
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'M-CALC-001' } });
  assert(topic?.status === 'published', 'Published M-CALC-001 topic is missing.');
  const asset = await prisma.teachingAsset.findUnique({ where: { stableKey: 'math.function-horizontal-shift' }, include: { versions: true } });
  assert(asset?.status === 'published' && asset.versions.some((item) => item.status === 'published' && item.language === 'zh-CN'), 'Published function-shift TeachingAsset is missing.');

  await prisma.learningIntervention.deleteMany({ where: { userId } });
  const proposal = await prisma.learningIntervention.create({
    data: {
      decisionKey: `pr12c-${randomUUID()}`, userId, subjectCode: 'math', topicId: topic.id,
      stateVersion: 'pr12c-live', policyVersion: 'intervention-shadow-v1', action: 'offer_micro_lesson',
      status: 'shadow_proposed', urgency: 'high', placement: 'between_sets',
      triggerCodes: ['repeated_misconception'], suppressionCodes: [],
      contentPlan: { preferredType: 'micro_lesson' }, reasonSummary: '同一知识点反复出错，建议在下一组题前完成短微课。',
      inputSnapshot: { source: 'pr12c_local_rehearsal' }, evidenceCutoffAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  const conversation = await request('/api/v1/agent/conversations', { method: 'POST', token, body: { title: 'PR12C proactive teaching rehearsal' } });
  const offered = await request('/api/v1/agent/interventions/offer', {
    method: 'POST', token, body: { clientRequestId: randomUUID(), context: 'after_round', conversationId: conversation.id, language: 'zh-CN' }
  });
  assert(offered.item?.interventionId === proposal.id, 'Expected proposal was not offered.');
  assert(offered.item.placement === 'between_sets', 'Proposal placement was not preserved.');
  assert(offered.item.content.sourceType === 'teaching_asset', 'Published TeachingAsset was not preferred.');
  assert(offered.item.content.teachingAsset === null, 'TeachingAsset payload was disclosed before the student started it.');

  const deliveryId = offered.item.id;
  const started = await request(`/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'start' }
  });
  const presentationText = JSON.stringify(started.content.teachingAsset);
  assert(started.status === 'in_progress' && started.content.teachingAsset?.stableKey === 'math.function-horizontal-shift', 'Started delivery did not reveal the safe TeachingAsset presentation.');
  assert(started.content.teachingAsset?.resolverVersion === 'teaching-asset-resolver-v2', 'Personalized TeachingAsset resolver version was not preserved.');
  assert(started.content.teachingAsset?.selectionDecision?.policyVersion === 'teaching-asset-selection-v1', 'TeachingAsset selection decision was not preserved.');
  assert(started.content.teachingAsset.selectionDecision.selectedVersionId === started.content.teachingAsset.versionId, 'TeachingAsset selection decision does not match the delivered version.');
  assert(!presentationText.includes('correctAnswer') && !presentationText.includes('correctFeedback') && !presentationText.includes('incorrectFeedback'), 'Started delivery leaked the active-prompt answer key.');
  await request(`/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, {
    method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), action: 'complete' }
  });
  const interactionPath = `/api/v1/agent/intervention-deliveries/${deliveryId}/teaching-interactions`;
  await request(interactionPath, { method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), action: 'completed' } });
  await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'opened' } });
  const wrong = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'active_prompt_answered', value: 'left' } });
  const correct = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'active_prompt_answered', value: 'right' } });
  assert(wrong.correct === false && correct.correct === true, 'Server-side active-prompt scoring failed.');
  const completedAsset = await request(interactionPath, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'completed' } });
  assert(completedAsset.status === 'completed' && completedAsset.masteryChanged === false && completedAsset.verificationRequired === true, 'TeachingAsset completion semantics are unsafe.');
  const completedDelivery = await request(`/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'complete' }
  });
  assert(completedDelivery.status === 'completed' && completedDelivery.masteryChanged === false, 'Delivery did not complete safely.');
  const verification = await request('/api/v1/agent/intervention-verifications/offer', {
    method: 'POST', token, body: { clientRequestId: randomUUID(), conversationId: conversation.id }
  });
  assert(verification.item?.deliveryId === deliveryId && verification.item.phase === 'immediate', `Immediate independent verification was not scheduled: ${JSON.stringify(verification.shortage)}`);
  assert(verification.item.questionCount === 3, 'Independent verification does not contain three fresh reviewed questions.');
  const exposure = await prisma.teachingAssetExposure.findFirst({ where: { userId, contextKey: `intervention_delivery:${deliveryId}` } });
  assert(exposure?.status === 'completed' && exposure.exposureLevel === 'A4' && exposure.source === 'agent_intervention', 'Governed A4 proactive exposure was not persisted.');
  const persistedDelivery = await prisma.learningInterventionDelivery.findUnique({ where: { id: deliveryId }, select: { contextSnapshot: true, steps: { where: { action: 'offer' }, take: 1 } } });
  assert(persistedDelivery?.contextSnapshot?.teachingAssetSelection?.selectedVersionId === started.content.teachingAsset.versionId, 'Delivery context did not persist the TeachingAsset selection decision.');
  assert(persistedDelivery?.steps?.[0]?.metadata?.teachingAssetSelection?.policyVersion === 'teaching-asset-selection-v1', 'Offer audit step did not persist the selection policy.');

  console.log(JSON.stringify({
    verdict: 'pass', conversationId: conversation.id, proposalId: proposal.id, deliveryId,
    placement: offered.item.placement, contentSource: offered.item.content.sourceType,
    selection: {
      resolverVersion: started.content.teachingAsset.resolverVersion,
      policyVersion: started.content.teachingAsset.selectionDecision.policyVersion,
      reasonCodes: started.content.teachingAsset.selectionDecision.reasonCodes,
      candidateCount: started.content.teachingAsset.selectionDecision.candidateCount,
      persisted: true
    },
    disclosure: { hiddenBeforeStart: true, answerKeyHidden: true },
    activePrompt: { wrong: wrong.correct, correct: correct.correct },
    completion: { requiresCompletedAsset: true, masteryChanged: completedAsset.masteryChanged, verificationRequired: completedAsset.verificationRequired, exposureLevel: exposure.exposureLevel },
    verification: { id: verification.item.id, phase: verification.item.phase, questionCount: verification.item.questionCount }
  }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
