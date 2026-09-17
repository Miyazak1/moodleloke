const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const prisma = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const stamp = `ai-provider-smoke-${Date.now()}`;
const email = `${stamp}@cscalite.local`;
const password = 'AI-provider-smoke-12345';
const allowExternal = process.env.AI_PROVIDER_SMOKE_ALLOW_EXTERNAL === '1';
const requireAdmin = process.env.AI_PROVIDER_SMOKE_REQUIRE_ADMIN === '1';

let token;
let userId;
let smokeResult;

const SUPPORTED_EXTERNAL_PROVIDERS = new Set(['openai', 'openai-compatible']);
const SUPPORTED_PROMPT_VERSIONS = new Set(['coach-v1-basic', 'coach-v2-safety']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function enabled(value) {
  return value === 'true' || value === '1';
}

function rolloutPercent() {
  const value = Number(process.env.CSCA_AI_ROLLOUT_PERCENT ?? 100);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function rolloutBucket(userId) {
  let hash = 0;
  for (const char of String(userId)) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return hash % 100;
}

function rolloutAllowsUser(userId) {
  const percent = rolloutPercent();
  if (percent >= 100) return true;
  if (percent <= 0 || !userId) return false;
  return rolloutBucket(userId) < percent;
}

function expectedExternalReadyFromEnv() {
  const provider = process.env.CSCA_AI_PROVIDER || 'rule-fallback';
  const promptVersion = process.env.CSCA_AI_PROMPT_VERSION || 'coach-v2-safety';
  return (
    enabled(process.env.CSCA_AI_COACH_ENABLED) &&
    provider !== 'rule-fallback' &&
    SUPPORTED_EXTERNAL_PROVIDERS.has(provider) &&
    Boolean(process.env.DEEPSEEK_PERSONAL_API_KEYS || process.env.DEEPSEEK_API_KEYS || process.env.CSCA_AI_API_KEY) &&
    Boolean(process.env.CSCA_AI_MODEL || process.env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL) &&
    SUPPORTED_PROMPT_VERSIONS.has(promptVersion) &&
    rolloutPercent() > 0
  );
}

async function rawRequest(path, options = {}) {
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
  return { status: response.status, body, text };
}

async function request(path, options = {}) {
  const result = await rawRequest(path, options);
  const expected = options.expected || [200, 201];
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (!expectedList.includes(result.status)) {
    throw new Error(`${options.method || 'GET'} ${path} expected ${expectedList.join('/')} got ${result.status}: ${result.text.slice(0, 300)}`);
  }
  return result.body;
}

async function cleanupUser() {
  const user = userId ? { id: userId } : await prisma.user.findUnique({ where: { email }, select: { id: true } });
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

async function loginAdminIfConfigured() {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!adminEmail || !adminPassword) {
    if (requireAdmin) throw new Error('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required when AI_PROVIDER_SMOKE_REQUIRE_ADMIN=1.');
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

async function providerConfigIfAvailable() {
  const adminToken = await loginAdminIfConfigured();
  if (!adminToken) return { available: false, reason: 'admin credentials not configured' };

  const response = await rawRequest('/api/v1/admin/csca-special-practice/adaptive/ai/provider-config', {
    authToken: adminToken
  });
  if (response.status === 404 && !requireAdmin) {
    return { available: false, reason: 'provider-config endpoint not available on running backend' };
  }
  if (response.status !== 200) {
    throw new Error(`GET provider-config expected 200 got ${response.status}: ${response.text.slice(0, 300)}`);
  }
  const config = response.body;
  assert(typeof config.provider?.externalReady === 'boolean', 'Provider config must expose externalReady.');
  assert(Array.isArray(config.provider?.blockers), 'Provider config must expose blockers.');
  assert(config.usageMeter?.meteringMode === 'estimate', 'Provider config must expose usage meter estimate mode.');
  return { available: true, config, adminToken };
}

async function runHintInteraction(expectedExternalReady, providerConfigProbe) {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    authToken: null,
    body: { email, password }
  });
  token = registered.tokens?.accessToken;
  assert(token, 'Register must return an access token.');

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  assert(user, 'Registered user must exist.');
  userId = user.id;

  const entitlementBefore = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
  assert(Number.isInteger(entitlementBefore.balanceUnits), 'Entitlement summary must expose balanceUnits before AI call.');
  const expectedInteractionExternal = expectedExternalReady && rolloutAllowsUser(userId);
  if (expectedInteractionExternal) {
    assert(entitlementBefore.balanceUnits > 0, 'Live provider smoke needs at least one AI credit unit.');
  }

  const session = await request('/api/v1/csca-special-practice/adaptive/sessions', {
    method: 'POST',
    body: { subject: 'math' }
  });
  assert(session.mode === 'diagnostic', 'AI provider smoke expects a first diagnostic session.');

  const roundDetail = await request(`/api/v1/csca-special-practice/adaptive/sessions/${session.id}/rounds`, {
    method: 'POST'
  });
  assert(Array.isArray(roundDetail.questions) && roundDetail.questions.length === 20, 'Diagnostic round must return twenty questions.');

  const firstQuestion = roundDetail.questions[0];
  const hint = await request('/api/v1/csca-special-practice/adaptive/ai/hint', {
    method: 'POST',
    body: { roundId: roundDetail.round.id, questionId: firstQuestion.id }
  });
  assert(hint.id && hint.type === 'hint' && String(hint.output || '').length > 10, 'AI hint payload is invalid.');
  const feedback = await request(`/api/v1/csca-special-practice/adaptive/ai-interactions/${hint.id}/feedback`, {
    method: 'POST',
    body: { rating: 1, reason: 'ai-provider smoke low-feedback sample' }
  });
  assert(feedback.interactionId === hint.id && feedback.rating === 1, 'AI provider smoke feedback must link hint interaction.');

  const interaction = await prisma.cscaAIInteraction.findUnique({ where: { id: hint.id } });
  assert(interaction, 'AI hint interaction must be written.');
  assert(interaction.userId === userId, 'AI hint interaction must belong to smoke user.');
  assert(interaction.sessionId === session.id, 'AI hint interaction must keep sessionId.');
  assert(interaction.roundId === roundDetail.round.id, 'AI hint interaction must keep roundId.');
  assert(interaction.questionId === firstQuestion.id, 'AI hint interaction must keep questionId.');
  assert(interaction.type === 'hint', 'AI hint interaction type changed.');
  assert(interaction.tokenUsage?.meteringMode === 'estimate', 'AI hint interaction must keep usage metering metadata.');
  assert(interaction.tokenUsage?.abilityType === 'hint', 'AI hint interaction must keep ability type.');
  const feedbackCount = await prisma.cscaAIInteractionFeedback.count({ where: { interactionId: interaction.id, rating: 1 } });
  assert(feedbackCount === 1, 'AI provider smoke must persist low-feedback sample.');

  const entitlementAfter = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
  const hintLedgers = await prisma.cscaAIUsageLedger.findMany({
    where: { userId, abilityType: 'hint' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  if (expectedInteractionExternal) {
    assert(interaction.provider !== 'rule-fallback', `Live provider smoke expected external provider, got ${interaction.provider}.`);
    assert(interaction.status === 'success', `Live provider smoke expected success, got ${interaction.status}.`);
    assert(interaction.tokenUsage?.billable === true, 'Live provider usage must be billable.');
    assert(interaction.tokenUsage?.unitEstimate >= 1, 'Live provider usage must estimate at least one unit.');
    assert(hintLedgers.length === 1, `Live provider smoke must create one hint ledger row, got ${hintLedgers.length}.`);
    assert(hintLedgers[0].interactionId === interaction.id, 'Live provider ledger must link interaction.');
    assert(hintLedgers[0].unitsDelta === -1, 'Live provider ledger must consume the reserved unit.');
    assert(hintLedgers[0].reason === 'consume' && hintLedgers[0].status === 'posted', 'Live provider ledger must be posted consume.');
    assert(entitlementAfter.balanceUnits === entitlementBefore.balanceUnits - 1, 'Live provider call must decrement balance by one unit.');
  } else {
    assert(interaction.provider === 'rule-fallback', `Fallback smoke expected rule-fallback, got ${interaction.provider}.`);
    assert(interaction.promptVersion === 'coach-rule-v1', 'Fallback smoke must use rule prompt version.');
    assert(interaction.tokenUsage?.billable === false, 'Rule fallback usage must not be billable.');
    assert(interaction.costEstimate === 0, 'Rule fallback usage must keep zero cost estimate.');
    assert(hintLedgers.length === 0, `Rule fallback must not create hint ledger rows, got ${hintLedgers.length}.`);
    assert(entitlementAfter.balanceUnits === entitlementBefore.balanceUnits, 'Rule fallback must not change AI credit balance.');
  }

  const hintEvents = await prisma.cscaTrainingEvent.findMany({
    where: { userId, eventType: 'ai_hint_requested' }
  });
  const event = hintEvents.find((item) => item.metadata?.interactionId === interaction.id);
  assert(event, 'AI provider smoke must write ai_hint_requested event.');

  return {
    userId,
    sessionId: session.id,
    roundId: roundDetail.round.id,
    interactionId: interaction.id,
    provider: interaction.provider,
    model: interaction.model,
    promptVersion: interaction.promptVersion,
    status: interaction.status,
    billable: interaction.tokenUsage?.billable,
    estimatedTokens: interaction.tokenUsage?.totalTokensEstimate,
    balanceBefore: entitlementBefore.balanceUnits,
    balanceAfter: entitlementAfter.balanceUnits,
    hintLedgerCount: hintLedgers.length,
    rolloutPercent: rolloutPercent(),
    rolloutAllowed: rolloutAllowsUser(userId),
    feedbackId: feedback.id,
    providerConfigAvailable: providerConfigProbe.available
  };
}

async function adminObservabilityChecks(interaction, providerConfigProbe) {
  if (!providerConfigProbe.available) {
    return { skipped: true, reason: providerConfigProbe.reason };
  }

  const adminToken = providerConfigProbe.adminToken;
  const provider = encodeURIComponent(interaction.provider || 'rule-fallback');
  const status = encodeURIComponent(interaction.status || 'success');
  const overview = await request(`/api/v1/admin/csca-special-practice/adaptive/ai/observability?days=1&provider=${provider}&status=${status}&type=hint&subject=math`, {
    authToken: adminToken
  });
  assert(overview.summary?.interactions >= 1, 'Admin AI observability must include smoke interaction aggregate.');
  assert(typeof overview.rolloutHealth?.status === 'string', 'Admin AI observability must expose rolloutHealth status. Restart the backend if this endpoint is still serving an older build.');
  assert(Array.isArray(overview.rolloutHealth?.checks), 'Admin AI observability must expose rolloutHealth checks.');
  assert(overview.byProvider.some((item) => item.key === interaction.provider), 'Admin AI observability must group smoke provider.');
  assert(overview.byStatus.some((item) => item.key === interaction.status), 'Admin AI observability must group smoke status.');

  const reviewQueue = await request('/api/v1/admin/csca-special-practice/adaptive/ai/review-queue?reason=low_feedback&days=1&limit=100', {
    authToken: adminToken
  });
  const reviewItem = reviewQueue.items.find((item) => item.id === interaction.interactionId);
  assert(reviewItem, 'Admin AI review queue must include smoke low-feedback sample.');
  assert(reviewItem.reasons.includes('low_feedback'), 'Admin AI review queue item must expose low_feedback reason.');
  assert(reviewItem.suggestedAction, 'Admin AI review queue item must expose suggested action.');

  return {
    skipped: false,
    rolloutHealthStatus: overview.rolloutHealth.status,
    rolloutHealthRecommendation: overview.rolloutHealth.recommendation,
    overviewInteractions: overview.summary.interactions,
    reviewQueueCandidates: reviewQueue.summary.candidates,
    reviewItemId: reviewItem.id,
    reviewSuggestedAction: reviewItem.suggestedAction
  };
}

async function main() {
  try {
    const health = await request('/api/v1/health', { authToken: null });
    assert(health.status === 'ok', 'Backend health must be ok.');

    const providerConfigProbe = await providerConfigIfAvailable();
    const envExternalReady = expectedExternalReadyFromEnv();
    const configExternalReady = providerConfigProbe.available ? providerConfigProbe.config.provider.externalReady : undefined;
    const expectedExternalReady = providerConfigProbe.available ? configExternalReady : envExternalReady;

    if (providerConfigProbe.available) {
      assert(providerConfigProbe.config.provider.mode === (configExternalReady ? 'external' : 'rule-fallback'), 'Provider config mode must match externalReady.');
      assert(providerConfigProbe.config.provider.promptVersion, 'Provider config must expose active promptVersion.');
      if (!configExternalReady) assert(providerConfigProbe.config.provider.blockers.length > 0, 'Provider config must explain why external provider is not ready.');
    }

    if (expectedExternalReady && !allowExternal) {
      smokeResult = {
        ok: true,
        baseUrl,
        skippedLiveCall: true,
        reason: 'external provider is ready; set AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1 to spend one AI Coach unit and validate the live interaction',
        providerConfigAvailable: providerConfigProbe.available,
        provider: providerConfigProbe.available ? providerConfigProbe.config.provider.provider : process.env.CSCA_AI_PROVIDER,
        model: providerConfigProbe.available ? providerConfigProbe.config.provider.model : process.env.CSCA_AI_MODEL,
        promptVersion: providerConfigProbe.available ? providerConfigProbe.config.provider.promptVersion : (process.env.CSCA_AI_PROMPT_VERSION || 'coach-v2-safety'),
        rolloutPercent: providerConfigProbe.available ? providerConfigProbe.config.provider.rollout?.percent : rolloutPercent()
      };
      return;
    }

    smokeResult = {
      ok: true,
      baseUrl,
      expectedMode: expectedExternalReady ? 'external' : 'rule-fallback',
      providerConfig: providerConfigProbe.available
        ? {
            provider: providerConfigProbe.config.provider.provider,
            model: providerConfigProbe.config.provider.model,
            externalReady: providerConfigProbe.config.provider.externalReady,
            blockers: providerConfigProbe.config.provider.blockers,
            promptVersion: providerConfigProbe.config.provider.promptVersion,
            requestedPromptVersion: providerConfigProbe.config.provider.requestedPromptVersion,
            rollout: providerConfigProbe.config.provider.rollout,
            pricingConfigured: providerConfigProbe.config.usageMeter.pricingConfigured
          }
        : {
            available: false,
            reason: providerConfigProbe.reason,
            envExternalReady
          },
      interaction: await runHintInteraction(expectedExternalReady, providerConfigProbe)
    };
    smokeResult.adminObservability = await adminObservabilityChecks(smokeResult.interaction, providerConfigProbe);
  } finally {
    await cleanupUser();
    await prisma.$disconnect();
  }

  console.log(JSON.stringify({ ...smokeResult, cleanedUp: true }, null, 2));
  console.log(smokeResult?.skippedLiveCall ? 'AI provider readiness smoke check passed; live provider call skipped.' : 'AI provider smoke check passed.');
}

main().catch((error) => {
  console.error(`AI provider smoke check failed: ${error.message}`);
  process.exit(1);
});
