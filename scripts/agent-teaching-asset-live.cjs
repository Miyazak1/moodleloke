const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();
const prisma = new PrismaClient();
const base = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';
const stableKey = 'math.function-horizontal-shift';

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertLocalDatabase() {
  assert(process.env.NODE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'TeachingAsset live rehearsal is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), `TeachingAsset live rehearsal only accepts a local database, received ${databaseUrl.hostname || 'unset'}.`);
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

async function waitRun(token, runId) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/agent/runs/${runId}`, { token });
    if (run.status === 'completed') return run;
    if (run.status === 'failed') throw new Error(`Agent run failed: ${run.errorCode || 'unknown'}`);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error('Agent run timed out.');
}

async function main() {
  assertLocalDatabase();
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Run node scripts/agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials });
  const token = login.tokens?.accessToken;
  assert(token, 'Login did not return an access token.');

  const published = await request(`/api/v1/agent/teaching-assets/${stableKey}?language=zh-CN`, { token });
  const publishedText = JSON.stringify(published);
  assert(published.item?.stableKey === stableKey, 'Published TeachingAsset is unavailable.');
  assert(!publishedText.includes('correctAnswer') && !publishedText.includes('correctFeedback') && !publishedText.includes('incorrectFeedback'), 'Published payload leaked the active-prompt answer key.');
  await request(`/api/v1/agent/teaching-assets/${stableKey}?language=en`, { token, expected: [404] });

  const conversation = await request('/api/v1/agent/conversations', { method: 'POST', token, body: { title: 'PR12B TeachingAsset golden path' } });
  const submission = await request(`/api/v1/agent/conversations/${conversation.id}/messages`, {
    method: 'POST', token,
    body: { clientRequestId: randomUUID(), text: '我今天学什么？', locale: 'zh-CN', attachmentIds: [] }
  });
  const run = await waitRun(token, submission.runId);
  const artifact = run.artifacts?.find((item) => item.type === 'learning_plan');
  assert(artifact?.snapshot?.canStart === true, 'Today-plan did not create a startable learning_plan artifact.');
  const launch = await request(`/api/v1/agent/artifacts/${artifact.id}/start-practice`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), questionLanguage: 'zh' }
  });

  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'M-CALC-001' } });
  assert(topic?.status === 'published', 'Published M-CALC-001 topic is missing.');
  const question = await prisma.cscaQuestion.findFirst({
    where: { topicId: topic.id, subject: 'math', status: { in: ['approved', 'published'] } },
    orderBy: { id: 'asc' }
  });
  assert(question, 'No approved question is available for M-CALC-001.');
  const round = await prisma.cscaAdaptiveRound.findUnique({ where: { id: launch.roundId }, include: { items: { orderBy: { position: 'asc' } } } });
  assert(round?.items?.length, 'Agent-created practice round has no items.');
  const targetItem = round.items.find((item) => item.questionSource === 'csca_question' && item.questionId === question.id) || round.items[0];
  const plannerSnapshot = round.plannerSnapshot && typeof round.plannerSnapshot === 'object' && !Array.isArray(round.plannerSnapshot)
    ? { ...round.plannerSnapshot, mode: 'agent_teaching_asset_demo' }
    : { mode: 'agent_teaching_asset_demo' };
  await prisma.$transaction([
    prisma.cscaAdaptiveRound.update({ where: { id: round.id }, data: { plannerSnapshot } }),
    prisma.cscaAdaptiveRoundItem.update({
      where: { id: targetItem.id },
      data: { questionId: question.id, questionSource: 'csca_question', topicId: topic.id, selectedAnswer: '__demo_incorrect__', isCorrect: false }
    })
  ]);

  const contextualPath = `/api/v1/agent/practice-rounds/${round.id}/questions/${question.id}/teaching-asset?language=zh-CN`;
  const contextual = await request(contextualPath, { token });
  const contextualText = JSON.stringify(contextual);
  assert(contextual.item?.stableKey === stableKey && contextual.gapReason === null, `Contextual resolver did not select ${stableKey}.`);
  assert(!contextualText.includes('correctAnswer') && !contextualText.includes('correctFeedback') && !contextualText.includes('incorrectFeedback'), 'Contextual payload leaked the active-prompt answer key.');
  const versionId = contextual.item.versionId;
  const interactionPath = `/api/v1/agent/teaching-assets/${versionId}/interactions`;
  const contextKey = `adaptive_round:${round.id}:question:${question.id}`;
  const userId = Number(login.user.id);
  assert(Number.isInteger(userId) && userId > 0, 'Login returned an invalid user id.');
  await prisma.$transaction([
    prisma.teachingInteractionEvent.deleteMany({ where: { userId, assetVersionId: versionId, contextKey } }),
    prisma.teachingAssetExposure.deleteMany({ where: { userId, assetVersionId: versionId, contextKey } })
  ]);
  const priorEventCount = await prisma.teachingInteractionEvent.count({ where: { userId, assetVersionId: versionId, contextKey } });
  await request(interactionPath, {
    method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), roundId: round.id, questionId: question.id, action: 'completed' }
  });
  const openedRequestId = randomUUID();
  const opened = await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: openedRequestId, roundId: round.id, questionId: question.id, action: 'opened' }
  });
  const openedReplay = await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: openedRequestId, roundId: round.id, questionId: question.id, action: 'opened' }
  });
  assert(opened.eventId === openedReplay.eventId, 'Teaching interaction idempotency replay created a second event.');
  const wrong = await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), roundId: round.id, questionId: question.id, action: 'active_prompt_answered', value: 'left' }
  });
  const correct = await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), roundId: round.id, questionId: question.id, action: 'active_prompt_answered', value: 'right' }
  });
  assert(wrong.correct === false && correct.correct === true, 'Server-side active-prompt scoring did not distinguish wrong and correct answers.');
  const completed = await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), roundId: round.id, questionId: question.id, action: 'completed' }
  });
  assert(completed.status === 'completed' && completed.masteryChanged === false && completed.verificationRequired === true, 'Completion semantics are unsafe or incomplete.');

  const exposure = await prisma.teachingAssetExposure.findUnique({
    where: { userId_assetVersionId_contextKey: { userId, assetVersionId: versionId, contextKey } }
  });
  const events = await prisma.teachingInteractionEvent.findMany({ where: { userId, assetVersionId: versionId, contextKey } });
  assert(exposure?.status === 'completed' && exposure.exposureLevel === 'A4', 'A4 TeachingAsset exposure was not completed.');
  assert(events.length === priorEventCount + 4, `Expected four new unique interaction events, received ${events.length - priorEventCount}.`);
  await request(interactionPath, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), roundId: round.id, questionId: question.id, action: 'opened' }
  });
  const terminalExposure = await prisma.teachingAssetExposure.findUnique({
    where: { userId_assetVersionId_contextKey: { userId, assetVersionId: versionId, contextKey } }
  });
  assert(terminalExposure?.status === 'completed', 'A later open event regressed a completed TeachingAsset exposure.');

  console.log(JSON.stringify({
    verdict: 'pass', conversationId: conversation.id, runId: run.id, artifactId: artifact.id, roundId: round.id,
    topic: { id: topic.id, code: topic.code }, questionId: question.id,
    asset: { stableKey, versionId, renderer: contextual.item.renderer, component: contextual.item.component },
    privacy: { answerKeyHidden: true, untranslatedAssetSuppressed: true }, idempotency: { eventId: opened.eventId },
    activePrompt: { wrong: wrong.correct, correct: correct.correct },
    completion: { requiresPassedPrompt: true, masteryChanged: completed.masteryChanged, verificationRequired: completed.verificationRequired, exposureLevel: exposure.exposureLevel, terminalStatusPreserved: true },
    interactionEventCount: events.length + 1, newInteractionEventCount: events.length + 1 - priorEventCount
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
