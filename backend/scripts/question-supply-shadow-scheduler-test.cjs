const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Prisma } = require('@prisma/client');
const { QuestionSupplyShadowSchedulerService } = require('../dist/backend/src/agent/question-supply-shadow-scheduler.service');

function flags(enabled = true) {
  return {
    isQuestionSupplyShadowSchedulerEnabled: () => enabled,
    isQuestionSupplyFulfillmentShadowEnabled: () => enabled
  };
}

function statePrisma(initial = null) {
  let state = initial;
  const runs = [];
  return {
    get state() { return state; },
    get runs() { return runs; },
    stealLease() { state = { ...state, leaseOwner: 'replacement-worker' }; },
    questionSupplySchedulerState: {
      findUnique: async () => state,
      updateMany: async ({ where, data }) => {
        if (!state || state.id !== where.id) return { count: 0 };
        if (where.leaseOwner && state.leaseOwner !== where.leaseOwner) return { count: 0 };
        if (where.OR) {
          const available = state.leaseOwner === null || (state.leaseUntil && state.leaseUntil < where.OR[1].leaseUntil.lt);
          if (!available) return { count: 0 };
        }
        state = { ...state, ...data };
        return { count: 1 };
      },
      create: async ({ data }) => {
        if (state) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.22.0' });
        state = { ...data };
        return state;
      }
    },
    questionSupplySchedulerRun: {
      create: async ({ data }) => {
        const run = { id: `run-${runs.length + 1}`, status: 'running', startedAt: new Date(), ...data };
        runs.push(run);
        return run;
      },
      updateMany: async ({ where, data }) => {
        const matches = runs.filter((run) => {
          if (where.id && run.id !== where.id) return false;
          if (where.workerId && run.workerId !== where.workerId) return false;
          if (where.schedulerId && run.schedulerId !== where.schedulerId) return false;
          if (where.status && run.status !== where.status) return false;
          if (where.startedAt?.lt && run.startedAt >= where.startedAt.lt) return false;
          return true;
        });
        matches.forEach((run) => Object.assign(run, data));
        return { count: matches.length };
      }
    }
  };
}

async function testDisabledIsNoop() {
  const prisma = statePrisma();
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(false), { run: async () => assert.fail('must not run') }, {});
  assert.equal((await service.runOnce()).status, 'disabled');
  assert.equal(prisma.state, null);
}

async function testLeaseAndSuccessSummary() {
  const prisma = statePrisma();
  const fulfillment = { run: async () => ({ reconciled: [1, 2], materialized: [{ created: true }, { created: false }], dispatched: [1] }) };
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(), fulfillment, { CSCA_QUESTION_SUPPLY_SHADOW_BATCH_SIZE: '10' });
  const result = await service.runOnce();
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.summary, { trigger: 'scheduled', reconciled: 2, materialized: 2, created: 1, dispatched: 1 });
  assert.equal(prisma.state.leaseOwner, null);
  assert.equal(prisma.state.lastStatus, 'succeeded');
  assert.equal(prisma.runs[0].status, 'succeeded');
}

async function testHeldLeaseSkipsSecondInstance() {
  const prisma = statePrisma({ id: 'shadow-reconciliation', leaseOwner: 'other', leaseUntil: new Date(Date.now() + 60_000) });
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(), { run: async () => assert.fail('must not run') }, {});
  assert.equal((await service.runOnce()).status, 'skipped_lease_held');
}

async function testFailureReleasesLease() {
  const prisma = statePrisma();
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(), { run: async () => { throw new Error('EXPECTED_FAILURE'); } }, {});
  const result = await service.runOnce();
  assert.equal(result.status, 'failed');
  assert.equal(prisma.state.lastStatus, 'failed');
  assert.equal(prisma.state.leaseOwner, null);
  assert.equal(prisma.state.lastErrorCode, 'EXPECTED_FAILURE');
  assert.equal(prisma.runs[0].status, 'failed');
}

async function testManualRunUsesSameLeaseAndPreservesActor() {
  const prisma = statePrisma();
  let invocation = null;
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(), {
    run: async (input, actorUserId) => {
      invocation = { input, actorUserId };
      return { schemaVersion: '1', mode: 'shadow', reconciled: [], materialized: [], dispatched: [] };
    }
  }, {});
  const result = await service.runOnce('manual', 42, { limit: 7 });
  assert.equal(result.status, 'succeeded');
  assert.equal(invocation.actorUserId, 42);
  assert.equal(invocation.input.limit, 7);
  assert.match(invocation.input.workerId, /question-supply-shadow-scheduler/);
  assert.equal(prisma.runs[0].trigger, 'manual');
}

async function testLostLeaseCannotRecordSuccess() {
  const prisma = statePrisma();
  const service = new QuestionSupplyShadowSchedulerService(prisma, flags(), {
    run: async () => {
      prisma.stealLease();
      return { schemaVersion: '1', mode: 'shadow', reconciled: [], materialized: [], dispatched: [] };
    }
  }, {});
  const result = await service.runOnce();
  assert.equal(result.status, 'lease_lost');
  assert.equal(prisma.runs[0].status, 'lease_expired');
  assert.equal(prisma.runs[0].errorCode, 'SCHEDULER_LEASE_LOST');
}

async function main() {
  await testDisabledIsNoop();
  await testLeaseAndSuccessSummary();
  await testHeldLeaseSkipsSecondInstance();
  await testFailureReleasesLease();
  await testManualRunUsesSameLeaseAndPreservesActor();
  await testLostLeaseCannotRecordSuccess();
  const source = readFileSync(require.resolve('../dist/backend/src/agent/question-supply-shadow-scheduler.service'), 'utf8');
  assert.doesNotMatch(source, /ai-questioning|generateQuestion|publishQuestion/i);
  console.log('QUESTION_SUPPLY_SHADOW_SCHEDULER_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
