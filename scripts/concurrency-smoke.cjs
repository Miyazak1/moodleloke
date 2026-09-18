const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const net = require('node:net');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const port = Number(process.env.CONCURRENCY_SMOKE_PORT || 3020);
const baseUrl = process.env.CONCURRENCY_SMOKE_BASE_URL || `http://127.0.0.1:${port}`;
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const stamp = `concurrency-smoke-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
}

function requireEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.JWT_SECRET) missing.push('AUTH_SECRET or JWT_SECRET');
  if (!process.env.PAYMENT_CALLBACK_SECRET) missing.push('PAYMENT_CALLBACK_SECRET');
  if (missing.length) {
    throw new Error(`Concurrency smoke needs env: ${missing.join(', ')}`);
  }
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    token,
    body,
    headers = {},
    expectedStatus
  } = options;
  const statusExpectation = expectedStatus ?? (method === 'POST' ? [200, 201] : 200);
  const expectedStatuses = Array.isArray(statusExpectation) ? statusExpectation : [statusExpectation];
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `${stamp}-${method.toLowerCase()}-${path.replace(/[^a-z0-9]/gi, '-')}`,
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} returned non-JSON response: ${text.slice(0, 160)}`);
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected HTTP ${expectedStatuses.join('/')} got ${response.status}: ${text.slice(0, 240)}`);
  }
  return parsed;
}

async function waitUntilReady(child) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before concurrency smoke could run with code ${child.exitCode}.`);
    }
    try {
      const ready = await request('/api/v1/ops/ready');
      if (ready.status === 'ready') return;
      lastError = new Error(`/api/v1/ops/ready returned ${ready.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Backend did not become ready. Last error: ${lastError?.message}`);
}

async function registerStudent(label) {
  const email = `${stamp}-${label}@moodlelike.local`;
  const result = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'concurrency-smoke-pass' }
  });
  assert(result.tokens?.accessToken, `Register did not return an access token for ${email}`);
  return result.tokens.accessToken;
}

async function firstPublishedSchoolId() {
  const schools = await request('/api/v1/schools?pageSize=1');
  const schoolId = schools.items?.[0]?.id;
  assert(Number.isInteger(schoolId), 'Concurrency smoke needs at least one published school.');
  return schoolId;
}

async function publishedSchoolIds(limit) {
  const schools = await request(`/api/v1/schools?pageSize=${limit}`);
  const schoolIds = (schools.items ?? []).map((school) => school.id).filter((id) => Number.isInteger(id));
  assert(schoolIds.length >= limit, `Concurrency smoke needs at least ${limit} published schools.`);
  return schoolIds.slice(0, limit);
}

async function firstFreeMockPaperSlug() {
  const subject = await request('/api/v1/csca-mock-exam/subjects/math');
  const paper = subject.papers?.find((item) => item.isFree && !item.isLocked);
  assert(paper?.slug, 'Concurrency smoke needs at least one unlocked free math mock exam paper.');
  return paper.slug;
}

async function firstSpecialTopicSlug() {
  const subject = await request('/api/v1/csca-special-practice/subjects/math');
  const topic = subject.modules?.flatMap((item) => item.topics ?? [])?.[0];
  assert(topic?.slug, 'Concurrency smoke needs at least one published math special-practice topic.');
  return topic.slug;
}

function callbackSignaturePayload(input) {
  return `${input.providerTxnId}|${input.orderId}|${input.amountCents}|${input.currency}|${input.status}`;
}

function signCallbackPayload(input) {
  return createHmac('sha256', process.env.PAYMENT_CALLBACK_SECRET).update(callbackSignaturePayload(input)).digest('hex');
}

async function assertConcurrentCartAddAndCheckout(schoolId) {
  const token = await registerStudent('cart-checkout');
  await Promise.all(Array.from({ length: 10 }, () => (
    request('/api/v1/commerce/cart/items', {
      method: 'POST',
      token,
      body: { type: 'SCHOOL_SERVICE', schoolId }
    })
  )));
  const cart = await request('/api/v1/commerce/cart', { token });
  const matchingSchoolItems = cart.items.filter((item) => item.type === 'SCHOOL_SERVICE' && item.schoolId === schoolId);
  assert(matchingSchoolItems.length === 1, `Concurrent cart add should create one school-service row, got ${matchingSchoolItems.length}.`);

  const checkoutKey = `${stamp}:checkout:key`;
  const checkouts = await Promise.all(Array.from({ length: 5 }, () => (
    request('/api/v1/commerce/checkout', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': checkoutKey }
    })
  )));
  const orderIds = new Set(checkouts.map((order) => order.id));
  assert(orderIds.size === 1, `Concurrent checkout with the same idempotency key should return one order, got ${Array.from(orderIds).join(', ')}.`);

  const orders = await request('/api/v1/commerce/orders', { token });
  const matchingOrders = orders.items.filter((order) => order.id === checkouts[0].id);
  assert(matchingOrders.length === 1, 'Created checkout order must appear exactly once in order history.');
}

async function assertConcurrentCheckoutWithoutIdempotencyKey(schoolId) {
  const token = await registerStudent('checkout-no-key');
  await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token,
    body: { type: 'SCHOOL_SERVICE', schoolId }
  });

  const checkouts = await Promise.all(Array.from({ length: 2 }, () => (
    request('/api/v1/commerce/checkout', {
      method: 'POST',
      token,
      expectedStatus: [200, 201, 400]
    })
  )));
  const successful = checkouts.filter((item) => Number.isInteger(item.id));
  const rejected = checkouts.filter((item) => JSON.stringify(item).includes('购物车为空'));
  assert(successful.length === 1, `Concurrent checkout without idempotency key should create one order, got ${JSON.stringify(checkouts).slice(0, 360)}.`);
  assert(rejected.length === 1, `Concurrent checkout without idempotency key should reject the consumed cart once, got ${JSON.stringify(checkouts).slice(0, 360)}.`);

  const orders = await request('/api/v1/commerce/orders', { token });
  const matchingOrders = orders.items.filter((order) => order.id === successful[0].id);
  assert(matchingOrders.length === 1, 'No-key concurrent checkout order must appear exactly once in order history.');
}

async function assertConcurrentCompareLimit(schoolIds) {
  const token = await registerStudent('compare');
  const additions = await Promise.all(schoolIds.map((schoolId) => (
    request('/api/v1/me/compare', {
      method: 'POST',
      token,
      body: { schoolId },
      expectedStatus: [200, 201, 400]
    })
  )));
  const accepted = additions.filter((item) => item.saved === true);
  const rejected = additions.filter((item) => JSON.stringify(item).includes('最多只能对比'));
  assert(accepted.length === 4, `Concurrent compare add should accept exactly 4 schools, got ${accepted.length}.`);
  assert(rejected.length === schoolIds.length - 4, `Concurrent compare add should reject overflow requests, got ${rejected.length}.`);

  const compare = await request('/api/v1/me/compare', { token });
  assert(compare.items?.length === 4, `Compare list must contain exactly 4 schools after concurrent overflow, got ${compare.items?.length}.`);
  const uniqueIds = new Set(compare.items.map((item) => item.id));
  assert(uniqueIds.size === 4, 'Compare list must not contain duplicate schools.');
}

async function assertConcurrentPaymentCallbacks() {
  const token = await registerStudent('payment');
  await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token,
    body: { type: 'ADVISOR_PACKAGE', quantity: 1 }
  });
  const order = await request('/api/v1/commerce/checkout', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': `${stamp}:payment:checkout` }
  });
  const payment = await request('/api/v1/commerce/payments', {
    method: 'POST',
    token,
    body: { orderId: order.id }
  });
  const success = {
    providerTxnId: payment.providerTxnId,
    orderId: order.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: 'SUCCEEDED'
  };
  const callbackBody = { ...success, signature: signCallbackPayload(success) };
  const callbacks = await Promise.all(Array.from({ length: 5 }, () => (
    request('/api/v1/commerce/payments/callback', {
      method: 'POST',
      body: callbackBody
    })
  )));
  assert(callbacks.every((item) => item.paymentStatus === 'SUCCEEDED' && item.orderStatus === 'PAID'), 'Concurrent payment callbacks must all observe paid terminal state.');

  const failedAfterPaid = {
    ...success,
    status: 'FAILED'
  };
  const failedResult = await request('/api/v1/commerce/payments/callback', {
    method: 'POST',
    body: { ...failedAfterPaid, signature: signCallbackPayload(failedAfterPaid) }
  });
  assert(failedResult.paymentStatus === 'SUCCEEDED' && failedResult.orderStatus === 'PAID', 'FAILED callback after PAID must not regress terminal success.');
}

async function assertConcurrentMockExamSubmit(paperSlug) {
  const token = await registerStudent('mock-exam');
  const attempt = await request(`/api/v1/csca-mock-exam/papers/${encodeURIComponent(paperSlug)}/attempts`, { method: 'POST', token });
  const detail = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}`);
  const firstQuestion = detail.questions?.[0];
  assert(firstQuestion?.id, 'Mock exam concurrency smoke needs an attempt question.');
  const saved = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}`, {
    method: 'PATCH',
    body: {
      answers: { [firstQuestion.id]: 'A' },
      markedQuestions: [firstQuestion.id],
      timeSpent: { [firstQuestion.id]: 3 },
      currentQuestion: 1,
      expectedVersion: detail.attempt.version
    }
  });

  const reports = await Promise.all(Array.from({ length: 5 }, () => (
    request(`/api/v1/csca-mock-exam/attempts/${attempt.id}/submit`, { method: 'POST' })
  )));
  const submittedIds = new Set(reports.map((report) => report.attempt?.id));
  assert(submittedIds.size === 1 && submittedIds.has(attempt.id), 'Concurrent mock exam submits must all return the same attempt report.');

  await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}`, {
    method: 'PATCH',
    body: {
      answers: {},
      markedQuestions: [],
      timeSpent: {},
      currentQuestion: 1,
      expectedVersion: saved.version
    }
  });
  const stableReport = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}/report`);
  assert(stableReport.attempt.submittedAt, 'Mock exam report must remain submitted after a stale autosave attempt.');
}

async function assertConcurrentSpecialPracticeSubmit(topicSlug) {
  const token = await registerStudent('special-practice');
  const session = await request(`/api/v1/csca-special-practice/topics/${encodeURIComponent(topicSlug)}/sessions`, { method: 'POST', token });
  const detail = await request(`/api/v1/csca-special-practice/sessions/${session.id}`);
  const firstQuestion = detail.questions?.[0];
  assert(firstQuestion?.id, 'Special-practice concurrency smoke needs a session question.');
  const saved = await request(`/api/v1/csca-special-practice/sessions/${session.id}`, {
    method: 'PATCH',
    body: {
      answers: { [firstQuestion.id]: 'A' },
      timeSpent: { [firstQuestion.id]: 3 },
      currentQuestion: 1,
      expectedVersion: detail.session.version
    }
  });

  const reports = await Promise.all(Array.from({ length: 5 }, () => (
    request(`/api/v1/csca-special-practice/sessions/${session.id}/submit`, { method: 'POST' })
  )));
  const submittedIds = new Set(reports.map((report) => report.session?.id));
  assert(submittedIds.size === 1 && submittedIds.has(session.id), 'Concurrent special-practice submits must all return the same session report.');

  await request(`/api/v1/csca-special-practice/sessions/${session.id}`, {
    method: 'PATCH',
    body: {
      answers: {},
      timeSpent: {},
      currentQuestion: 1,
      expectedVersion: saved.version
    },
    expectedStatus: 400
  });
  const stableReport = await request(`/api/v1/csca-special-practice/sessions/${session.id}/report`);
  assert(stableReport.session.completedAt, 'Special-practice report must remain completed after a stale autosave attempt.');
}

async function runChecks() {
  const [schoolId, compareSchoolIds, paperSlug, topicSlug] = await Promise.all([
    firstPublishedSchoolId(),
    publishedSchoolIds(6),
    firstFreeMockPaperSlug(),
    firstSpecialTopicSlug()
  ]);
  await assertConcurrentCartAddAndCheckout(schoolId);
  await assertConcurrentCheckoutWithoutIdempotencyKey(schoolId);
  await assertConcurrentCompareLimit(compareSchoolIds);
  await assertConcurrentPaymentCallbacks();
  await assertConcurrentMockExamSubmit(paperSlug);
  await assertConcurrentSpecialPracticeSubmit(topicSlug);
}

async function cleanupSmokeData() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: stamp } },
      select: { id: true }
    });
    const userIds = users.map((user) => user.id);
    if (!userIds.length) return;

    await prisma.paymentCallbackLog.deleteMany({
      where: { payment: { userId: { in: userIds } } }
    });
    await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.schoolCompareItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.savedSchool.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.mockExamAttempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.specialPracticeSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  requireEnv();
  if (await isPortOpen(port)) {
    throw new Error(`Concurrency smoke port ${port} is already in use.`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      CSC_ENV: 'production',
      AUTH_SECRET: process.env.CONCURRENCY_SMOKE_AUTH_SECRET || 'concurrency-smoke-auth-secret-not-for-production-2026',
      JWT_SECRET: process.env.CONCURRENCY_SMOKE_AUTH_SECRET || 'concurrency-smoke-auth-secret-not-for-production-2026',
      PAYMENT_CALLBACK_SECRET: process.env.CONCURRENCY_SMOKE_PAYMENT_CALLBACK_SECRET || 'concurrency-smoke-payment-secret-not-for-production-2026',
      ALLOW_LOCAL_DATABASE_IN_PRODUCTION: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[concurrency-backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[concurrency-backend] ${chunk}`));

  try {
    await waitUntilReady(child);
    await runChecks();
    console.log('CSCAlite concurrency smoke passed.');
  } finally {
    try {
      await cleanupSmokeData();
    } catch (error) {
      console.warn(`Concurrency smoke cleanup skipped: ${error.message}`);
    }
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

main().catch((error) => {
  console.error(`CSCAlite concurrency smoke failed: ${error.message}`);
  process.exit(1);
});
