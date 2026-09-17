const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { QuestionSupplyRequestService } = require('../dist/backend/src/agent/question-supply-request.service');
const { AgentRuntimeFeatureFlagsService } = require('../dist/backend/src/agent/agent-runtime-feature-flags.service');

function store() {
  const state = { requests: [], events: [], confirmations: [] };
  const db = {
    state,
    async $transaction(callback) { return callback(db); },
    questionSupplyRequest: {
      async findUnique({ where }) {
        return state.requests.find((item) => item.id === where.id || item.requestKey === where.requestKey) || null;
      },
      async findUniqueOrThrow({ where }) {
        const item = state.requests.find((candidate) => candidate.id === where.id);
        if (!item) throw new Error('not found');
        return item;
      },
      async create({ data }) {
        const eventCreate = data.events?.create;
        const clean = { ...data };
        delete clean.events;
        const item = {
          id: `supply-${state.requests.length + 1}`,
          schemaVersion: '1', status: 'open', observationCount: 1, cycle: 1,
          acknowledgedAt: null, resolvedAt: null, resolutionNote: null,
          createdAt: new Date(), updatedAt: new Date(), ...clean
        };
        state.requests.push(item);
        if (eventCreate) state.events.push({ id: `event-${state.events.length + 1}`, requestId: item.id, ...eventCreate });
        return item;
      },
      async update({ where, data }) {
        const item = state.requests.find((candidate) => candidate.id === where.id);
        for (const [key, value] of Object.entries(data)) {
          item[key] = value && typeof value === 'object' && 'increment' in value ? Number(item[key] || 0) + value.increment : value;
        }
        return item;
      },
      async updateMany({ where, data }) {
        const item = state.requests.find((candidate) => candidate.id === where.id && candidate.status === where.status);
        if (!item) return { count: 0 };
        Object.assign(item, data);
        return { count: 1 };
      },
      async findMany({ where }) {
        return state.requests.filter((item) => (!where.status || item.status === where.status)
          && (!where.subjectCode || item.subjectCode === where.subjectCode));
      }
    },
    questionSupplyRequestEvent: {
      async create({ data }) {
        const event = { id: `event-${state.events.length + 1}`, createdAt: new Date(), ...data };
        state.events.push(event);
        return event;
      }
    },
    questionSupplyFulfillmentPlan: {
      async findUnique() { return null; }
    },
    questionSupplyRecoveryConfirmation: {
      async upsert({ where, create, update }) {
        const key = where.requestId_requestCycle_confirmationKind;
        const existing = state.confirmations.find((item) => item.requestId === key.requestId
          && item.requestCycle === key.requestCycle && item.confirmationKind === key.confirmationKind);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const item = { id: `confirmation-${state.confirmations.length + 1}`, ...create };
        state.confirmations.push(item);
        return item;
      }
    }
  };
  return db;
}

const gap = {
  source: 'agent_today_plan', subjectCode: 'math', topicIds: [8, 3, 8], difficulty: 'medium',
  taskType: 'targeted_practice', requestedCount: 5, availableCount: 2,
  sourceEntityType: 'learning_prescription', sourceEntityId: 'rx-1'
};

async function testDisabledIsNoop() {
  const prisma = store();
  const service = new QuestionSupplyRequestService(prisma, new AgentRuntimeFeatureFlagsService({}));
  assert.equal(await service.recordBestEffort(gap), null);
  assert.equal(prisma.state.requests.length, 0);
}

async function testCreateDeduplicateAndNoGeneratorSideEffect() {
  const prisma = store();
  const service = new QuestionSupplyRequestService(prisma, new AgentRuntimeFeatureFlagsService({ CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true' }));
  const first = await service.recordBestEffort(gap);
  const second = await service.recordBestEffort({ ...gap, sourceEntityId: 'rx-2', availableCount: 1, constraints: { b: true, a: ['x'] } });
  const third = await service.recordBestEffort({ ...gap, sourceEntityId: 'rx-3', availableCount: 1, constraints: { a: ['x'], b: true } });
  assert.equal(prisma.state.requests.length, 2, 'constraints define separate inventory demand cells');
  assert.equal(first.requestKey.length, 64);
  assert.equal(second.observationCount, 2, 'constraint object key order must not change the request key');
  assert.deepEqual(second.topicIds, [3, 8]);
  assert.equal(second.availableCount, 1);
  assert.equal(second.lastContextSnapshot.automaticQuestionGenerationInvoked, false);
  assert.equal(second.lastContextSnapshot.aiInvoked, false);
  assert.equal(third.requestKey, second.requestKey);
  assert.equal(prisma.state.events.length, 2, 'ordinary repeated observations are aggregated, not appended as noisy audit events');
  const source = readFileSync(require.resolve('../dist/backend/src/agent/question-supply-request.service'), 'utf8');
  assert.doesNotMatch(source, /AIQuestioning|GenerationCapability|requestPracticeGeneration|generateQuestion/);
}

async function testAdminLifecycleAndAutomaticReopen() {
  const prisma = store();
  const service = new QuestionSupplyRequestService(prisma, new AgentRuntimeFeatureFlagsService({ CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true' }));
  const created = await service.recordBestEffort(gap);
  await service.act(created.id, 99, { action: 'acknowledge', reason: '内容团队已领取' });
  const resolved = await service.act(created.id, 99, { action: 'resolve', reason: '已补充并审核五道题' });
  assert.equal(resolved.status, 'resolved');
  const reopened = await service.recordBestEffort({ ...gap, sourceEntityId: 'rx-3' });
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.cycle, 2);
  assert.equal(reopened.resolvedAt, null);
  assert.equal(prisma.state.events.at(-1).action, 'reopened_by_observation');
  assert.equal(prisma.state.events[1].actorUserId, 99);
  await assert.rejects(
    () => service.act(created.id, 99, { action: 'reopen', reason: '重复打开' }),
    /不能从 open 变更为 open/
  );
}

async function testInvalidAndNonShortageInputsAreIgnored() {
  const prisma = store();
  const service = new QuestionSupplyRequestService(prisma, new AgentRuntimeFeatureFlagsService({ CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true' }));
  assert.equal(await service.recordBestEffort({ ...gap, availableCount: 5 }), null);
  assert.equal(await service.recordBestEffort({ ...gap, source: 'intervention_verification' }), null);
  assert.equal(prisma.state.requests.length, 0);
}

async function testRecoveryConfirmationIsExactAndIdempotent() {
  const prisma = store();
  const service = new QuestionSupplyRequestService(prisma, new AgentRuntimeFeatureFlagsService({ CSCA_QUESTION_SUPPLY_REQUEST_ENABLED: 'true' }));
  await service.recordBestEffort(gap);
  const recovered = {
    source: gap.source, subjectCode: gap.subjectCode, topicIds: gap.topicIds, difficulty: gap.difficulty,
    taskType: gap.taskType, requestedCount: gap.requestedCount, availableCount: 7,
    confirmationKind: 'domain_preflight_passed'
  };
  await service.recordRecoveryBestEffort(recovered);
  await service.recordRecoveryBestEffort(recovered);
  assert.equal(prisma.state.requests[0].status, 'resolved');
  assert.equal(prisma.state.confirmations.length, 1);
  assert.equal(prisma.state.confirmations[0].metadata.automaticQuestionGenerationInvoked, false);
  assert.equal(prisma.state.events.some((item) => item.action === 'execution_inventory_reconciled'), true);
  assert.equal(await service.recordRecoveryBestEffort({ ...recovered, availableCount: 3 }), null);
}

async function main() {
  await testDisabledIsNoop();
  await testCreateDeduplicateAndNoGeneratorSideEffect();
  await testAdminLifecycleAndAutomaticReopen();
  await testInvalidAndNonShortageInputsAreIgnored();
  await testRecoveryConfirmationIsExactAndIdempotent();
  console.log('QUESTION_SUPPLY_REQUEST_OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
