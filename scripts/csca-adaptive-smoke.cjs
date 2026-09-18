const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const prisma = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const stamp = `adaptive-smoke-${Date.now()}`;
const email = `${stamp}@moodlelike.local`;
const password = 'Adaptive-smoke-12345';

let token;
let userId;
let smokeResult;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `${stamp}-${path.replace(/[^a-z0-9]/gi, '-')}`
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
  }
  const expected = options.expected || [200, 201];
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (!expectedList.includes(response.status)) {
    throw new Error(`${options.method || 'GET'} ${path} expected ${expectedList.join('/')} got ${response.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

async function cleanupUser() {
  const user = userId ? { id: userId } : await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const sessions = await prisma.cscaAdaptiveSession.findMany({
    where: { userId: user.id },
    select: { id: true }
  });
  const sessionIds = sessions.map((session) => session.id);
  const rounds = sessionIds.length
    ? await prisma.cscaAdaptiveRound.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true } })
    : [];
  const roundIds = rounds.map((round) => round.id);

  await prisma.cscaAIInteractionFeedback.deleteMany({ where: { userId: user.id } });
  await prisma.cscaAIInteractionFeedback.deleteMany({ where: { interaction: { userId: user.id } } });
  await prisma.cscaAIInteraction.deleteMany({ where: { userId: user.id } });
  await prisma.cscaTrainingEvent.deleteMany({ where: { userId: user.id } });
  await prisma.userCscaTopicMastery.deleteMany({ where: { userId: user.id } });
  await prisma.cscaQuestionExposure.deleteMany({ where: { userId: user.id } });
  if (roundIds.length) await prisma.cscaAdaptiveRoundItem.deleteMany({ where: { roundId: { in: roundIds } } });
  if (sessionIds.length) await prisma.cscaAdaptiveRound.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.cscaAdaptiveSession.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
}

async function main() {
  try {
    const health = await request('/api/v1/health');
    assert(health.status === 'ok', 'Backend health must be ok.');

    const registered = await request('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password }
    });
    token = registered.tokens?.accessToken;
    assert(token, 'Register must return an access token.');

    const user = await prisma.user.findUnique({ where: { email } });
    assert(user, 'Registered user must exist.');
    userId = user.id;

    const overview = await request('/api/v1/csca-special-practice/adaptive/overview');
    assert(Array.isArray(overview.subjects) && overview.subjects.length === 3, 'Adaptive overview must return three subjects.');
    assert(overview.roundSize === 5 && overview.diagnosticRoundSize === 20, 'Adaptive overview must expose practice and diagnostic sizes.');
    assert(overview.subjects.find((subject) => subject.id === 'math')?.nextAction === 'start_diagnostic', 'New users must start with diagnostic.');
    const entitlement = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    assert(entitlement.enabled === true, 'AI entitlement summary must be enabled for smoke users.');
    assert(Number.isInteger(entitlement.balanceUnits), 'AI entitlement summary must expose balanceUnits.');
    assert(entitlement.balanceUnits === entitlement.initialFreeUnits, 'AI entitlement balance must start from initial free units.');
    const focusTopic = await prisma.cscaExamTopic.findFirst({
      where: { subject: 'math', status: 'published' },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }]
    });
    assert(focusTopic?.id, 'Smoke must find a math focus topic.');

    const session = await request('/api/v1/csca-special-practice/adaptive/sessions', {
      method: 'POST',
      body: { subject: 'math' }
    });
    assert(session.id, 'Adaptive session must return an id.');
    assert(session.mode === 'diagnostic', 'First adaptive session must be diagnostic.');

    const roundDetail = await request(`/api/v1/csca-special-practice/adaptive/sessions/${session.id}/rounds`, {
      method: 'POST'
    });
    assert(roundDetail.round?.id, 'Adaptive round must return an id.');
    assert(Array.isArray(roundDetail.questions) && roundDetail.questions.length === 20, 'Diagnostic round must return twenty questions.');
    assert(roundDetail.round.plannerSnapshot?.strategy === 'diagnostic_baseline_balanced', 'Diagnostic round must use the balanced baseline strategy.');

    const firstQuestion = roundDetail.questions[0];
    const secondQuestion = roundDetail.questions[1];
    const selected = firstQuestion.options[0].id;
    await request('/api/v1/csca-special-practice/adaptive/ai/explain', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: secondQuestion.id },
      expected: 400
    });
    await request('/api/v1/csca-special-practice/adaptive/ai/round-summary', {
      method: 'POST',
      body: { roundId: roundDetail.round.id },
      expected: 400
    });
    const hint = await request('/api/v1/csca-special-practice/adaptive/ai/hint', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: firstQuestion.id }
    });
    assert(hint.id && hint.type === 'hint' && String(hint.output || '').length > 10, 'AI hint payload is invalid.');

    const check = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}/check`, {
      method: 'POST',
      body: { questionId: firstQuestion.id, selected }
    });
    assert(check.questionId === firstQuestion.id && typeof check.isCorrect === 'boolean', 'Check answer payload is invalid.');

    const answers = Object.fromEntries(roundDetail.questions.map((question) => [String(question.id), question.options[0].id]));
    const timeSpent = Object.fromEntries(roundDetail.questions.map((question, index) => [String(question.id), 8 + index]));
    const patched = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}`, {
      method: 'PATCH',
      body: {
        answers,
        timeSpent,
        currentQuestion: 20,
        expectedVersion: roundDetail.round.version
      }
    });
    assert(patched.version === roundDetail.round.version + 1, 'Patch round must increment version.');

    await request('/api/v1/csca-special-practice/adaptive/ai/hint', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: firstQuestion.id },
      expected: 400
    });

    const feedback = await request(`/api/v1/csca-special-practice/adaptive/ai-interactions/${hint.id}/feedback`, {
      method: 'POST',
      body: { rating: 5, reason: 'adaptive smoke' }
    });
    assert(feedback.interactionId === hint.id, 'AI feedback payload is invalid.');

    const explanation = await request('/api/v1/csca-special-practice/adaptive/ai/explain', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: firstQuestion.id, selected }
    });
    assert(explanation.id && explanation.type === 'explain_wrong_answer' && String(explanation.output || '').length > 20, 'AI explanation payload is invalid.');

    const coachedRound = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}`);
    const coachedQuestion = coachedRound.questions.find((question) => question.id === firstQuestion.id);
    assert(coachedQuestion?.usedHint === true, 'AI hint must mark the round item as usedHint.');
    assert(coachedQuestion?.usedExplanation === true, 'AI explanation must mark the round item as usedExplanation.');

    const report = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}/submit`, {
      method: 'POST'
    });
    assert(report.summary?.total === 20 && Array.isArray(report.items), 'Diagnostic submit report payload is invalid.');
    assert(report.remediationPlan && typeof report.remediationPlan.triggered === 'boolean', 'Adaptive report must expose a remediation plan contract.');
    assert(Array.isArray(report.remediationPlan.conceptCards), 'Adaptive remediation plan must expose concept card candidates.');
    assert(report.remediationPlan.variantPractice && Array.isArray(report.remediationPlan.variantPractice.questionIds), 'Adaptive remediation plan must expose variant practice candidates.');

    const roundSummary = await request('/api/v1/csca-special-practice/adaptive/ai/round-summary', {
      method: 'POST',
      body: { roundId: roundDetail.round.id }
    });
    assert(roundSummary.id && roundSummary.type === 'round_summary' && String(roundSummary.output || '').length > 10, 'AI round summary payload is invalid.');
    await request('/api/v1/csca-special-practice/adaptive/ai/hint', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: firstQuestion.id },
      expected: 400
    });

    const interactions = await prisma.cscaAIInteraction.findMany({
      where: {
        userId,
        id: { in: [hint.id, explanation.id, roundSummary.id] }
      },
      orderBy: { id: 'asc' }
    });
    assert(interactions.length === 3, 'AI interactions must be written to the database.');
    const hintInteraction = interactions.find((interaction) => interaction.id === hint.id);
    const explanationInteraction = interactions.find((interaction) => interaction.id === explanation.id);
    const summaryInteraction = interactions.find((interaction) => interaction.id === roundSummary.id);
    assert(hintInteraction?.sessionId === session.id, 'AI hint interaction must keep sessionId.');
    assert(hintInteraction?.roundId === roundDetail.round.id, 'AI hint interaction must keep roundId.');
    assert(hintInteraction?.questionId === firstQuestion.id, 'AI hint interaction must keep questionId.');
    assert(explanationInteraction?.sessionId === session.id, 'AI explanation interaction must keep sessionId.');
    assert(explanationInteraction?.roundId === roundDetail.round.id, 'AI explanation interaction must keep roundId.');
    assert(explanationInteraction?.questionId === firstQuestion.id, 'AI explanation interaction must keep questionId.');
    assert(summaryInteraction?.sessionId === session.id, 'AI round summary interaction must keep sessionId.');
    assert(summaryInteraction?.roundId === roundDetail.round.id, 'AI round summary interaction must keep roundId.');
    assert(hintInteraction?.tokenUsage?.meteringMode === 'estimate', 'AI hint interaction must keep usage metering metadata.');
    if (hintInteraction?.provider === 'rule-fallback') {
      assert(hintInteraction?.tokenUsage?.billable === false, 'Rule fallback AI usage must not be billable.');
      assert(hintInteraction?.costEstimate === 0, 'Rule fallback AI usage must keep zero cost estimate.');
    } else {
      assert(hintInteraction?.tokenUsage?.billable === true, 'External AI usage must be billable.');
      assert(hintInteraction?.tokenUsage?.unitEstimate >= 1, 'External AI usage must estimate at least one unit.');
      assert(hintInteraction?.model, 'External AI usage must record model.');
    }
    const aiLedgerCount = await prisma.cscaAIUsageLedger.count({
      where: { userId, interactionId: { in: [hint.id, explanation.id, roundSummary.id] } }
    });
    if (hintInteraction?.provider === 'rule-fallback') {
      assert(aiLedgerCount === 0, 'Rule fallback AI usage must not write usage ledger rows.');
    } else {
      assert(aiLedgerCount === 3, 'External AI usage must write one usage ledger row per AI interaction.');
    }
    const entitlementAfterAI = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    const feedbackCount = await prisma.cscaAIInteractionFeedback.count({
      where: { interactionId: hint.id, userId }
    });
    assert(feedbackCount === 1, 'AI feedback must be written to the database.');
    const trainingEventsAfterDiagnostic = await prisma.cscaTrainingEvent.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const eventTypesAfterDiagnostic = trainingEventsAfterDiagnostic.map((event) => event.eventType);
    assert(eventTypesAfterDiagnostic.includes('diagnostic_session_started'), 'Diagnostic session start must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('diagnostic_round_started'), 'Diagnostic round start must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('ai_hint_requested'), 'AI hint request must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('ai_explanation_requested'), 'AI explanation request must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('ai_round_summary_requested'), 'AI round summary request must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('ai_feedback_submitted'), 'AI feedback submission must be tracked.');
    assert(eventTypesAfterDiagnostic.includes('diagnostic_round_completed'), 'Diagnostic round completion must be tracked.');

    const mastery = await request('/api/v1/csca-special-practice/adaptive/mastery?subject=math');
    assert(Array.isArray(mastery.items) && mastery.items.length >= 12, 'Adaptive mastery payload is invalid.');
    const overviewAfterDiagnostic = await request('/api/v1/csca-special-practice/adaptive/overview');
    assert(overviewAfterDiagnostic.subjects.find((subject) => subject.id === 'math')?.nextAction === 'continue_training', 'Diagnostic completion must unlock practice training.');

    const practiceSession = await request('/api/v1/csca-special-practice/adaptive/sessions', {
      method: 'POST',
      body: { subject: 'math', mode: 'practice' }
    });
    assert(practiceSession.mode === 'practice', 'After diagnostic, new adaptive sessions must be practice mode.');
    const practiceRound = await request(`/api/v1/csca-special-practice/adaptive/sessions/${practiceSession.id}/rounds`, {
      method: 'POST',
      body: { focusTopicId: focusTopic.id }
    });
    assert(Array.isArray(practiceRound.questions) && practiceRound.questions.length === 5, 'Practice round must return five questions.');
    assert(practiceRound.round.plannerSnapshot?.plannedTopics?.[0]?.topicId === focusTopic.id, 'Focused practice round must prioritize the requested topic.');
    const practiceEventCount = await prisma.cscaTrainingEvent.count({
      where: { userId, eventType: { in: ['practice_session_started', 'practice_round_started'] } }
    });
    assert(practiceEventCount === 2, 'Practice session and round starts must be tracked.');

    smokeResult = {
      ok: true,
      baseUrl,
      userId,
      sessionId: session.id,
      roundId: roundDetail.round.id,
      questionCount: roundDetail.questions.length,
      practiceRoundId: practiceRound.round.id,
      practiceQuestionCount: practiceRound.questions.length,
      provider: hint.provider,
      aiEntitlementBalanceBefore: entitlement.balanceUnits,
      aiEntitlementBalanceAfterAI: entitlementAfterAI.balanceUnits,
      aiLedgerCount,
      aiInteractionCount: 3,
      aiInteractions: interactions.map((interaction) => ({
        type: interaction.type,
        provider: interaction.provider,
        model: interaction.model,
        status: interaction.status,
        billable: interaction.tokenUsage?.billable === true
      })),
      trainingEventCount: await prisma.cscaTrainingEvent.count({ where: { userId } }),
      reportAccuracy: report.summary.accuracy
    };
  } finally {
    await cleanupUser();
    await prisma.$disconnect();
  }

  console.log(JSON.stringify({ ...smokeResult, cleanedUp: true }, null, 2));
  console.log('CSCA adaptive training smoke check passed.');
}

main().catch((error) => {
  console.error(`CSCA adaptive training smoke check failed: ${error.message}`);
  process.exit(1);
});
