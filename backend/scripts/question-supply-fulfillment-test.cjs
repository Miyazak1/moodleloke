const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { QuestionSupplyFulfillmentService } = require('../dist/backend/src/agent/question-supply-fulfillment.service');
const { QuestionSupplyShadowAdapter } = require('../dist/backend/src/agent/question-supply-shadow.adapter');
const { AgentRuntimeFeatureFlagsService } = require('../dist/backend/src/agent/agent-runtime-feature-flags.service');

function createStore(requestOverrides = {}) {
  const request = {
    id: 'request-1', requestKey: 'a'.repeat(64), cycle: 1, source: 'agent_today_plan',
    subjectCode: 'math', topicIds: [11], difficulty: 'medium', taskType: 'targeted_practice',
    verificationPhase: null, sourcePolicy: 'reviewed_published_only', status: 'open', priority: 'normal',
    requestedCount: 5, availableCount: 2, observationCount: 3,
    lastContextSnapshot: { schemaVersion: '1', constraints: {}, sourceEntityType: 'learning_prescription', sourceEntityId: 'rx-1' },
    firstObservedAt: new Date('2026-09-14T00:00:00.000Z'), lastObservedAt: new Date('2026-09-14T01:00:00.000Z'),
    acknowledgedAt: null, resolvedAt: null, resolutionNote: null, updatedAt: new Date(), ...requestOverrides
  };
  const state = { requests: [request], plans: [], requestEvents: [], planEvents: [], inventoryChecks: [] };
  const clonePlan = (item) => ({ ...item, demandSnapshot: structuredClone(item.demandSnapshot) });
  const db = {
    state,
    async $transaction(callback) { return callback(db); },
    questionSupplyRequest: {
      async findMany() {
        return state.requests.filter((item) => ['open', 'acknowledged'].includes(item.status)).map((item) => ({
          ...item,
          fulfillmentPlans: state.plans.filter((plan) => plan.requestId === item.id).map(clonePlan)
        }));
      },
      async updateMany({ where, data }) {
        const item = state.requests.find((candidate) => candidate.id === where.id);
        if (!item || (where.cycle && item.cycle !== where.cycle)) return { count: 0 };
        const accepted = !where.status || (where.status.in ? where.status.in.includes(item.status) : where.status === item.status);
        if (!accepted) return { count: 0 };
        Object.assign(item, data, { updatedAt: new Date() });
        return { count: 1 };
      }
    },
    questionSupplyRequestEvent: {
      async create({ data }) { state.requestEvents.push({ id: `re-${state.requestEvents.length + 1}`, ...data }); }
    },
    questionSupplyFulfillmentPlan: {
      async findUnique({ where }) {
        const key = where.requestId_requestCycle;
        return state.plans.find((item) => item.requestId === key.requestId && item.requestCycle === key.requestCycle) || null;
      },
      async findUniqueOrThrow(args) {
        const item = await this.findUnique(args);
        if (!item) throw new Error('not found');
        return item;
      },
      async create({ data }) {
        const nested = data.events?.create;
        const clean = { ...data };
        delete clean.events;
        const item = {
          id: `plan-${state.plans.length + 1}`, status: 'planned', mode: 'shadow', contractVersion: '1',
          attemptCount: 0, leaseOwner: null, leaseUntil: null, nextAttemptAt: new Date(0),
          lastErrorCode: null, dispatchedAt: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(), ...clean
        };
        state.plans.push(item);
        if (nested) state.planEvents.push({ id: `pe-${state.planEvents.length + 1}`, planId: item.id, ...nested });
        return item;
      },
      async findMany({ where }) {
        return state.plans.filter((item) => {
          const owner = state.requests.find((requestItem) => requestItem.id === item.requestId);
          if (!owner || !['open', 'acknowledged'].includes(owner.status)) return false;
          return ['planned', 'failed'].includes(item.status) || (item.status === 'leased' && item.leaseUntil < new Date());
        }).map(clonePlan);
      },
      async updateMany({ where, data }) {
        const item = state.plans.find((candidate) => candidate.id === where.id);
        if (!item || (where.status && item.status !== where.status) || (where.leaseOwner && item.leaseOwner !== where.leaseOwner)) return { count: 0 };
        if (where.updatedAt && item.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          item[key] = value && typeof value === 'object' && 'increment' in value ? Number(item[key] || 0) + value.increment : value;
        }
        item.updatedAt = new Date();
        return { count: 1 };
      },
      async update({ where, data }) {
        const item = state.plans.find((candidate) => candidate.id === where.id);
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      }
    },
    questionSupplyFulfillmentEvent: {
      async create({ data }) { state.planEvents.push({ id: `pe-${state.planEvents.length + 1}`, ...data }); }
    },
    questionSupplyInventoryCheck: {
      async create({ data }) {
        const item = { id: `ic-${state.inventoryChecks.length + 1}`, checkedAt: new Date(), ...data };
        state.inventoryChecks.push(item);
        return item;
      }
    },
    learningInterventionVerification: { async findUnique() { return null; } }
  };
  return db;
}

function enabledFlags() {
  return new AgentRuntimeFeatureFlagsService({
    CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true',
    CSCA_QUESTION_SUPPLY_FULFILLMENT_SHADOW_ENABLED: 'true'
  });
}

async function testPlanDispatchAndInventoryRecovery() {
  const prisma = createStore();
  let availableCount = 2;
  let dispatchCount = 0;
  const adapter = {
    async dispatch(demand) {
      dispatchCount += 1;
      assert.equal(demand.schemaVersion, '1');
      assert.equal(demand.deficitCount, 3);
      assert.equal('sourceEntityId' in demand, false, 'production contract must not expose student-linked entity references');
      return new QuestionSupplyShadowAdapter().dispatch(demand);
    }
  };
  const learningSupply = { async getQuestionSupplyStatus() { return { canCreatePractice: availableCount >= 5, availableCount }; } };
  const service = new QuestionSupplyFulfillmentService(prisma, enabledFlags(), learningSupply, {}, adapter);
  const first = await service.run({ limit: 10, workerId: 'test-worker' }, 99);
  assert.equal(first.materialized[0].created, true);
  assert.equal(first.dispatched[0].status, 'shadow_dispatched');
  assert.equal(first.reconciled[0].status, 'still_short');
  assert.equal(prisma.state.plans[0].status, 'shadow_dispatched');
  assert.equal(dispatchCount, 1);
  assert.equal(prisma.state.planEvents.some((item) => item.metadata?.generationInvoked === false), true);
  assert.equal(prisma.state.inventoryChecks[0].result, 'still_short');

  availableCount = 7;
  const second = await service.run({ limit: 10, workerId: 'test-worker' }, 99);
  assert.equal(second.materialized.length, 0, 'recovered inventory must resolve before new production work is materialized');
  assert.equal(second.dispatched.length, 0, 'a shadow-dispatched plan must not be dispatched repeatedly');
  assert.equal(second.reconciled[0].status, 'resolved');
  assert.equal(prisma.state.requests[0].status, 'resolved');
  assert.equal(prisma.state.plans[0].status, 'completed');
  assert.equal(prisma.state.requestEvents.at(-1).action, 'inventory_reconciled');
  assert.equal(prisma.state.inventoryChecks.at(-1).result, 'sufficient');
}

async function testVerificationUsesExactOwnedExposureCheck() {
  const prisma = createStore({
    source: 'intervention_verification', requestedCount: 3, availableCount: 0,
    verificationPhase: 'transfer', taskType: 'intervention_verification',
    lastContextSnapshot: {
      sourceEntityType: 'learning_intervention_verification', sourceEntityId: 'verification-1',
      constraints: { excludedTransferSignatures: ['skill:old'] }
    }
  });
  prisma.learningInterventionVerification.findUnique = async () => ({
    userId: 42, topicId: 11, phase: 'transfer', supplySnapshot: { excludedRefs: ['csca_question:1:v1'] }
  });
  let selectionInput;
  const provider = {
    async pickIndependentVerificationQuestions(...args) {
      selectionInput = args;
      return [{}, {}, {}];
    }
  };
  const service = new QuestionSupplyFulfillmentService(
    prisma, enabledFlags(), { async getQuestionSupplyStatus() { throw new Error('wrong checker'); } }, provider,
    new QuestionSupplyShadowAdapter()
  );
  const result = await service.run({ limit: 5 }, 99);
  assert.equal(result.reconciled[0].status, 'resolved');
  assert.equal(selectionInput[0], 42);
  assert.deepEqual(selectionInput[3], ['csca_question:1:v1']);
  assert.deepEqual(selectionInput[4], { requireDifferentTransferSignature: true, excludedTransferSignatures: ['skill:old'] });
}

async function testAdapterFailureIsRetriedSafely() {
  const prisma = createStore();
  const service = new QuestionSupplyFulfillmentService(
    prisma, enabledFlags(), { async getQuestionSupplyStatus() { return { canCreatePractice: false, availableCount: 2 }; } }, {},
    { async dispatch() { throw new Error('SHADOW_ADAPTER_TEMPORARY_FAILURE'); } }
  );
  const result = await service.run({ limit: 5, workerId: 'failure-worker' }, 99);
  assert.equal(result.dispatched[0].status, 'failed');
  assert.equal(prisma.state.plans[0].status, 'failed');
  assert.equal(prisma.state.plans[0].leaseOwner, null);
  assert.equal(prisma.state.plans[0].lastErrorCode, 'SHADOW_ADAPTER_TEMPORARY_FAILURE');
  assert.ok(prisma.state.plans[0].nextAttemptAt > new Date());
}

async function testDisabledGateAndSourceIsolation() {
  const prisma = createStore();
  const flags = new AgentRuntimeFeatureFlagsService({ CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true' });
  const service = new QuestionSupplyFulfillmentService(prisma, flags, {}, {}, new QuestionSupplyShadowAdapter());
  await assert.rejects(() => service.run({}, 99), /暂未开启/);
  const source = readFileSync(require.resolve('../dist/backend/src/agent/question-supply-fulfillment.service'), 'utf8');
  assert.doesNotMatch(source, /ai-questioning|AIQuestioningService|requestPracticeGeneration/);
}

async function main() {
  await testPlanDispatchAndInventoryRecovery();
  await testVerificationUsesExactOwnedExposureCheck();
  await testAdapterFailureIsRetriedSafely();
  await testDisabledGateAndSourceIsolation();
  console.log('QUESTION_SUPPLY_FULFILLMENT_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
