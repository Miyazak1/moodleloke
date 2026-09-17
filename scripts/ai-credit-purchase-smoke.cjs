const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const prisma = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const stamp = `ai-credit-smoke-${Date.now()}`;
const email = `${stamp}@cscalite.local`;
const password = 'AI-credit-smoke-12345';

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

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    assert(user, 'Registered user must exist.');
    userId = user.id;

    const entitlementBefore = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    assert(Number.isInteger(entitlementBefore.balanceUnits), 'Entitlement summary must expose balanceUnits before purchase.');

    const cart = await request('/api/v1/commerce/cart/items', {
      method: 'POST',
      body: { type: 'AI_CREDITS', quantity: 1 }
    });
    const aiCartItem = cart.items.find((item) => item.type === 'AI_CREDITS');
    assert(aiCartItem, 'AI credit pack must be added to cart.');
    assert(cart.pricing.payableTotalCents === 990, 'AI credit pack payable total must be 990 cents.');
    assert(cart.pricing.pricingBreakdown.find((line) => line.type === 'AI_CREDITS')?.aiCreditUnits === 100, 'AI credit pricing line must expose 100 units.');

    const order = await request('/api/v1/commerce/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `${stamp}:checkout` }
    });
    assert(order.status === 'PENDING', 'AI credit order must start pending.');
    assert(order.items.find((item) => item.type === 'AI_CREDITS')?.aiCreditUnits === 100, 'AI credit order item must preserve credit units.');

    const payment = await request('/api/v1/commerce/payments', {
      method: 'POST',
      body: { orderId: order.id }
    });
    assert(payment.provider === 'mock', 'AI credit smoke expects local mock payment provider.');
    assert(payment.amountCents === 990, 'AI credit payment amount must match order payable total.');
    assert(payment.testCallbackSignature, 'Mock payment must return a test callback signature.');

    const callbackBody = {
      providerTxnId: payment.providerTxnId,
      orderId: order.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: 'SUCCEEDED',
      signature: payment.testCallbackSignature
    };
    const callback = await request('/api/v1/commerce/payments/callback', {
      method: 'POST',
      body: callbackBody
    });
    assert(callback.paymentStatus === 'SUCCEEDED' && callback.orderStatus === 'PAID', 'Payment callback must mark order paid.');

    const entitlementAfter = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    assert(entitlementAfter.balanceUnits === entitlementBefore.balanceUnits + 100, 'AI credit purchase must add 100 balance units.');
    assert(entitlementAfter.lifetimeGranted === entitlementBefore.lifetimeGranted + 100, 'AI credit purchase must increment lifetimeGranted.');

    const purchaseLedger = await prisma.cscaAIUsageLedger.findMany({
      where: {
        userId,
        abilityType: 'ai_credit_purchase'
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    assert(purchaseLedger.length === 1, `AI credit purchase must create one purchase ledger row, got ${purchaseLedger.length}.`);
    assert(purchaseLedger[0].unitsDelta === 100, 'AI credit purchase ledger must grant 100 units.');
    assert(purchaseLedger[0].metadata?.orderId === order.id, 'AI credit purchase ledger must record orderId.');
    assert(purchaseLedger[0].metadata?.paymentId === payment.paymentId, 'AI credit purchase ledger must record paymentId.');

    const repeatCallback = await request('/api/v1/commerce/payments/callback', {
      method: 'POST',
      body: callbackBody
    });
    assert(repeatCallback.idempotent === true, 'Repeated payment callback must be idempotent.');
    const entitlementAfterRepeat = await request('/api/v1/csca-special-practice/adaptive/ai/entitlement');
    assert(entitlementAfterRepeat.balanceUnits === entitlementAfter.balanceUnits, 'Repeated callback must not grant credits again.');
    const repeatedLedgerCount = await prisma.cscaAIUsageLedger.count({
      where: { userId, abilityType: 'ai_credit_purchase' }
    });
    assert(repeatedLedgerCount === 1, 'Repeated callback must not create another purchase ledger row.');

    smokeResult = {
      ok: true,
      baseUrl,
      userId,
      orderId: order.id,
      paymentId: payment.paymentId,
      initialBalance: entitlementBefore.balanceUnits,
      finalBalance: entitlementAfter.balanceUnits,
      grantedUnits: 100,
      ledgerId: purchaseLedger[0].id
    };
  } finally {
    await cleanupUser();
    await prisma.$disconnect();
  }

  console.log(JSON.stringify({ ...smokeResult, cleanedUp: true }, null, 2));
  console.log('AI credit purchase smoke check passed.');
}

main().catch((error) => {
  console.error(`AI credit purchase smoke check failed: ${error.message}`);
  process.exit(1);
});
