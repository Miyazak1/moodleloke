const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const prisma = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const stamp = `adaptive-release-smoke-${Date.now()}`;
const email = `${stamp}@moodlelike.local`;
const password = 'Adaptive-release-smoke-12345';
const requireAdmin = process.env.ADAPTIVE_RELEASE_SMOKE_REQUIRE_ADMIN === '1';

let token;
let userId;
let smokeResult;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const authToken = Object.prototype.hasOwnProperty.call(options, 'authToken') ? options.authToken : token;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
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
  const user = userId ? { id: userId } : await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const sessions = await prisma.cscaAdaptiveSession.findMany({ where: { userId: user.id }, select: { id: true } });
  const sessionIds = sessions.map((session) => session.id);
  const rounds = sessionIds.length
    ? await prisma.cscaAdaptiveRound.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true } })
    : [];
  const roundIds = rounds.map((round) => round.id);
  const interactions = await prisma.cscaAIInteraction.findMany({ where: { userId: user.id }, select: { id: true } });
  const interactionIds = interactions.map((interaction) => interaction.id);

  if (interactionIds.length) {
    await prisma.$executeRawUnsafe(`DELETE FROM "csca_ai_review_decisions" WHERE "interaction_id" IN (${interactionIds.map((id) => Number(id)).join(',')})`).catch(() => undefined);
  }
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

async function loginAdminIfConfigured() {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!adminEmail || !adminPassword) {
    if (requireAdmin) throw new Error('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required when ADAPTIVE_RELEASE_SMOKE_REQUIRE_ADMIN=1.');
    return null;
  }
  const loggedIn = await request('/api/v1/auth/login', {
    method: 'POST',
    authToken: null,
    body: { email: adminEmail, password: adminPassword }
  });
  const adminToken = loggedIn.tokens?.accessToken;
  assert(adminToken, 'Admin login must return an access token.');
  return adminToken;
}

async function main() {
  try {
    const health = await request('/api/v1/health', { authToken: null });
    assert(health.status === 'ok', 'Backend health must be ok.');

    const registered = await request('/api/v1/auth/register', {
      method: 'POST',
      authToken: null,
      body: { email, password }
    });
    token = registered.tokens?.accessToken;
    assert(token, 'Register must return an access token.');

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    assert(user, 'Registered smoke user must exist.');
    userId = user.id;

    const overview = await request('/api/v1/csca-special-practice/adaptive/overview');
    assert(overview.subjects.find((subject) => subject.id === 'math')?.nextAction === 'start_diagnostic', 'New release smoke user must start with math diagnostic.');

    const entitlementBefore = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    assert(Number.isInteger(entitlementBefore.balanceUnits), 'Release smoke must expose AI entitlement balance.');

    const session = await request('/api/v1/csca-special-practice/adaptive/sessions', {
      method: 'POST',
      body: { subject: 'math' }
    });
    assert(session.mode === 'diagnostic', 'Release smoke first session must be diagnostic.');

    const roundDetail = await request(`/api/v1/csca-special-practice/adaptive/sessions/${session.id}/rounds`, {
      method: 'POST'
    });
    assert(Array.isArray(roundDetail.questions) && roundDetail.questions.length === 20, 'Release smoke diagnostic must return twenty questions.');

    const firstQuestion = roundDetail.questions[0];
    const hint = await request('/api/v1/csca-special-practice/adaptive/ai/hint', {
      method: 'POST',
      body: { roundId: roundDetail.round.id, questionId: firstQuestion.id }
    });
    assert(hint.id && hint.type === 'hint', 'Release smoke hint must return an interaction.');

    const lowFeedback = await request(`/api/v1/csca-special-practice/adaptive/ai-interactions/${hint.id}/feedback`, {
      method: 'POST',
      body: { rating: 1, reason: 'release smoke low-feedback sample' }
    });
    assert(lowFeedback.interactionId === hint.id, 'Release smoke feedback must link hint interaction.');

    const selected = firstQuestion.options[0].id;
    await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}/check`, {
      method: 'POST',
      body: { questionId: firstQuestion.id, selected }
    });
    const answers = Object.fromEntries(roundDetail.questions.map((question) => [String(question.id), question.options[0].id]));
    const timeSpent = Object.fromEntries(roundDetail.questions.map((question, index) => [String(question.id), 9 + index]));
    const patched = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}`, {
      method: 'PATCH',
      body: {
        answers,
        timeSpent,
        currentQuestion: 20,
        expectedVersion: roundDetail.round.version
      }
    });
    const report = await request(`/api/v1/csca-special-practice/adaptive/rounds/${roundDetail.round.id}/submit`, {
      method: 'POST'
    });
    assert(report.summary?.total === 20, 'Release smoke diagnostic report must be created.');

    const overviewAfter = await request('/api/v1/csca-special-practice/adaptive/overview');
    assert(overviewAfter.subjects.find((subject) => subject.id === 'math')?.nextAction === 'continue_training', 'Release smoke diagnostic must unlock practice.');

    const practiceSession = await request('/api/v1/csca-special-practice/adaptive/sessions', {
      method: 'POST',
      body: { subject: 'math', mode: 'practice' }
    });
    const practiceRound = await request(`/api/v1/csca-special-practice/adaptive/sessions/${practiceSession.id}/rounds`, {
      method: 'POST'
    });
    assert(Array.isArray(practiceRound.questions) && practiceRound.questions.length === 5, 'Release smoke practice round must return five questions.');

    const adminToken = await loginAdminIfConfigured();
    let adminChecks = { skipped: true, reason: 'admin credentials not configured' };
    if (adminToken) {
      const providerConfig = await request('/api/v1/admin/csca-special-practice/adaptive/ai/provider-config', { authToken: adminToken });
      assert(typeof providerConfig.provider?.externalReady === 'boolean', 'Release smoke provider config must expose externalReady.');
      const reviewQueue = await request('/api/v1/admin/csca-special-practice/adaptive/ai/review-queue?reason=low_feedback&days=7', { authToken: adminToken });
      const reviewItem = reviewQueue.items.find((item) => item.id === hint.id);
      assert(reviewItem, 'Release smoke low-feedback hint must enter AI review queue.');
      const decision = await request(`/api/v1/admin/csca-special-practice/adaptive/ai/review-queue/${hint.id}/decisions`, {
        method: 'POST',
        authToken: adminToken,
        body: { decision: 'accepted', note: 'release smoke accepted sample' }
      });
      assert(decision.interactionId === hint.id && decision.decision === 'accepted', 'Release smoke review decision must be recorded.');
      const reviewQueueAfter = await request('/api/v1/admin/csca-special-practice/adaptive/ai/review-queue?reason=low_feedback&days=7', { authToken: adminToken });
      const reviewedItem = reviewQueueAfter.items.find((item) => item.id === hint.id);
      assert(reviewedItem?.latestDecision?.decision === 'accepted', 'Release smoke review queue must expose latest decision.');
      const auditCount = await prisma.adminAuditLog.count({
        where: {
          module: 'adaptive-ai',
          resourceType: 'ai_interaction_review',
          resourceId: String(hint.id),
          action: 'ai_review.decision'
        }
      });
      assert(auditCount >= 1, 'Release smoke review decision must be written to admin audit.');
      adminChecks = {
        skipped: false,
        providerMode: providerConfig.provider.mode,
        reviewDecisionId: decision.id,
        reviewDecision: decision.decision,
        auditCount
      };
    }

    smokeResult = {
      ok: true,
      baseUrl,
      userId,
      sessionId: session.id,
      diagnosticRoundId: roundDetail.round.id,
      practiceRoundId: practiceRound.round.id,
      hintInteractionId: hint.id,
      patchedVersion: patched.version,
      reportAccuracy: report.summary.accuracy,
      provider: hint.provider,
      entitlementBalanceBefore: entitlementBefore.balanceUnits,
      adminChecks
    };
  } finally {
    await cleanupUser();
    await prisma.$disconnect();
  }

  console.log(JSON.stringify({ ...smokeResult, cleanedUp: true }, null, 2));
  console.log('CSCA adaptive release smoke check passed.');
}

main().catch((error) => {
  console.error(`CSCA adaptive release smoke check failed: ${error.message}`);
  process.exit(1);
});
