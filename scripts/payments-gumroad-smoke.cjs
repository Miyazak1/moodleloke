const assert = require('node:assert/strict');

const { PaymentsService } = require('../backend/dist/payments/payments.service');

function createPaymentState(overrides = {}) {
  const state = {
    order: {
      id: 55,
      userId: 7,
      status: 'PENDING',
      currency: 'USD',
      payableTotalCents: 4999,
      ...overrides.order
    },
    payment: {
      id: 10,
      userId: 7,
      orderId: 55,
      providerTxnId: 'gumroad_pending_55_smoke',
      amountCents: 4999,
      currency: 'USD',
      status: 'PENDING',
      failureReason: null,
      createdAt: new Date('2026-05-26T00:00:00.000Z'),
      ...overrides.payment
    },
    logs: [],
    createdPayments: [],
    updates: []
  };
  return state;
}

function createPrismaMock(state) {
  const tx = {
    payment: {
      create: async ({ data }) => {
        const payment = { id: 99, ...data };
        state.createdPayments.push(payment);
        return payment;
      },
      findUnique: async ({ where }) => {
        if (where.id === state.payment.id) return { ...state.payment, order: state.order };
        if (where.providerTxnId === state.payment.providerTxnId) return { ...state.payment, order: state.order };
        return null;
      },
      update: async ({ where, data }) => {
        assert.equal(where.id, state.payment.id);
        Object.assign(state.payment, data);
        state.updates.push({ model: 'payment', data });
        return state.payment;
      }
    },
    order: {
      update: async ({ where, data }) => {
        assert.equal(where.id, state.order.id);
        Object.assign(state.order, data);
        state.updates.push({ model: 'order', data });
        return state.order;
      }
    },
    paymentCallbackLog: {
      create: async ({ data }) => {
        state.logs.push(data);
        return { id: state.logs.length, ...data };
      }
    }
  };

  return {
    order: {
      findFirst: async ({ where }) => {
        if (where.id === state.order.id && where.userId === state.order.userId) return state.order;
        return null;
      },
      update: tx.order.update
    },
    payment: {
      create: tx.payment.create,
      findUnique: async ({ where }) => {
        if (where.providerTxnId === state.payment.providerTxnId) return { ...state.payment, order: state.order };
        return null;
      },
      findFirst: async ({ where }) => {
        if (
          where.orderId === state.order.id &&
          where.status === state.payment.status &&
          state.payment.providerTxnId.startsWith(where.providerTxnId.startsWith)
        ) {
          return { ...state.payment, order: state.order };
        }
        return null;
      }
    },
    paymentCallbackLog: tx.paymentCallbackLog,
    $transaction: async (callbackOrOperations) => {
      if (typeof callbackOrOperations === 'function') return callbackOrOperations(tx);
      return Promise.all(callbackOrOperations);
    }
  };
}

async function expectRejectsWithStatus(action, status) {
  let thrown = null;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'expected action to reject');
  assert.equal(thrown.getStatus?.(), status);
}

function callbackBody() {
  return {
    sale_id: 'gumroad-sale-1',
    order_id: '55',
    price_cents: '4999'
  };
}

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/cscalite';
  process.env.GUMROAD_ACCESS_TOKEN = 'gumroad-smoke-token';

  const paidState = createPaymentState();
  const paidService = new PaymentsService(createPrismaMock(paidState));
  paidService.fetchGumroadSale = async () => ({
    sale_id: 'gumroad-sale-1',
    order_id: '55',
    price_cents: '4999',
    refunded: false,
    chargebacked: false,
    disputed: false
  });
  const paid = await paidService.handleGumroadCallback(callbackBody());
  assert.equal(paid.paymentStatus, 'SUCCEEDED');
  assert.equal(paid.orderStatus, 'PAID');
  assert.equal(paidState.payment.providerTxnId, 'gumroad-sale-1');
  assert.equal(paidState.logs.at(-1).result, 'gumroad_paid');

  const disputedState = createPaymentState();
  const disputedService = new PaymentsService(createPrismaMock(disputedState));
  disputedService.fetchGumroadSale = async () => ({
    sale_id: 'gumroad-sale-1',
    order_id: '55',
    price_cents: '4999',
    refunded: false,
    chargebacked: false,
    disputed: true
  });
  await expectRejectsWithStatus(() => disputedService.handleGumroadCallback(callbackBody()), 403);
  assert.equal(disputedState.payment.status, 'PENDING');
  assert.equal(disputedState.order.status, 'PENDING');
  assert.equal(disputedState.logs.at(-1).result, 'gumroad_verification_failed');

  delete process.env.GUMROAD_ACCESS_TOKEN;
  const unverifiedState = createPaymentState();
  const unverifiedService = new PaymentsService(createPrismaMock(unverifiedState));
  await expectRejectsWithStatus(() => unverifiedService.handleGumroadCallback(callbackBody()), 403);
  assert.equal(unverifiedState.payment.status, 'PENDING');
  assert.equal(unverifiedState.logs.at(-1).result, 'gumroad_verification_not_configured');

  const freeState = createPaymentState({ order: { payableTotalCents: 0 } });
  const freeService = new PaymentsService(createPrismaMock(freeState));
  const free = await freeService.createPayment(7, 55);
  assert.equal(free.provider, 'free');
  assert.equal(free.status, 'SUCCEEDED');
  assert.equal(freeState.order.status, 'PAID');
  assert.equal(freeState.createdPayments.length, 1);
  assert.ok(freeState.createdPayments[0].providerTxnId.startsWith('free_'));

  console.log('CSCAlite Gumroad payment smoke passed.');
}

main().catch((error) => {
  console.error(`CSCAlite Gumroad payment smoke failed: ${error.message}`);
  process.exit(1);
});
