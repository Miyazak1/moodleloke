const assert = require('node:assert/strict');
const { LearningEvidenceWriterService } = require('../dist/backend/src/learning-intelligence/evidence/learning-evidence-writer.service');
const { mapTrustedQuestionEvidence } = require('../dist/backend/src/learning-intelligence/evidence/learning-evidence-mapper');
const { projectLearningTopicState } = require('../dist/backend/src/learning-intelligence/projection/learning-state-projection.model');
const { LearningStateProjectorService } = require('../dist/backend/src/learning-intelligence/projection/learning-state-projector.service');
const { LearningStateShadowQueryService } = require('../dist/backend/src/learning-intelligence/projection/learning-state-shadow-query.service');
const { LearningIntelligenceFeatureFlagsService } = require('../dist/backend/src/learning-intelligence/learning-intelligence-feature-flags.service');
const { learningEvidenceReceipt } = require('../dist/backend/src/learning-intelligence/learning-evidence-writer.port');
const { CscaMockExamService } = require('../dist/backend/src/csca-mock-exam/csca-mock-exam.service');
const { CscaSpecialPracticeService } = require('../dist/backend/src/csca-special-practice/csca-special-practice.service');

function mappedEvidence(overrides = {}) {
  return mapTrustedQuestionEvidence({
    sourceType: 'adaptive', sourceId: 'round-1', sessionId: 'session-1', userId: 42, subjectCode: 'math',
    questionId: 'csca_question:7', questionVersion: 2, answerKeyVersion: 'q7:v2', topicId: 11,
    topicMappingVersion: 'mapping-1', outcome: 'correct', usedHint: false, usedExplanation: false,
    timeSpentSeconds: 75, difficulty: 'medium', questionQualityConfidence: 0.9,
    occurredAt: new Date('2026-09-12T08:00:00.000Z'), ...overrides
  });
}

async function testWriter() {
  const created = [];
  let duplicate = null;
  const tx = {
    $executeRaw: async () => 1,
    learningEvidenceEvent: {
      findFirst: async (args) => args.where?.OR ? duplicate : args.orderBy ? { eventSequence: 2n } : null,
      create: async ({ data }) => { created.push(data); return { id: 'evidence-3' }; }
    },
    learningStateProjectionCheckpoint: { findUnique: async () => ({ lastEvidenceVersion: 'state-2', lastEventSequence: 2n }) }
  };
  const writer = new LearningEvidenceWriterService();
  const input = mappedEvidence();
  const result = await writer.appendInTransaction(tx, input);
  assert.deepEqual(result, {
    evidenceId: 'evidence-3', eventId: input.eventId, evidenceVersion: '42:math:3',
    projectedStateVersion: 'state-2', adaptationPending: true, duplicate: false
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].eventSequence, 3n);
  assert.equal(created[0].firstAttempt, true);
  assert.equal(created[0].outbox.create.payload.eventSequence, '3');
  assert.equal(created[0].outbox.create.payload.userId, 42);
  assert.equal(JSON.stringify(created[0].outbox.create.payload).includes('selectedAnswer'), false, 'raw answers must not be copied to evidence metadata');

  duplicate = {
    id: 'evidence-3', eventId: input.eventId, eventSequence: 3n, userId: 42, subjectCode: 'math',
    sourceType: input.sourceType, sourceId: input.sourceId, questionId: input.questionId,
    attemptSequence: input.attemptSequence, schemaVersion: input.schemaVersion
  };
  const retried = await writer.appendInTransaction(tx, input);
  assert.equal(retried.duplicate, true);
  assert.equal(created.length, 1, 'retry must not append a second event or outbox row');
  assert.deepEqual(learningEvidenceReceipt([result]), {
    eventIds: [input.eventId], evidenceVersion: '42:math:3', projectedStateVersion: 'state-2', adaptationPending: true
  });

  duplicate = { ...duplicate, sourceId: 'different-round' };
  await assert.rejects(() => writer.appendInTransaction(tx, input), /LEARNING_EVIDENCE_IDEMPOTENCY_CONFLICT/);
}

function event(sequence, outcome, occurredAt, extra = {}) {
  return {
    schemaVersion: '1', eventId: `event-${sequence}`, eventSequence: String(sequence), userId: 42, subjectCode: 'math',
    occurredAt, recordedAt: occurredAt, sourceType: extra.sourceType ?? 'adaptive', sourceId: `round-${sequence}`,
    attemptSequence: 1, sessionId: `session-${sequence}`, questionId: `question-${sequence}`, questionVersion: 1,
    answerKeyVersion: 'v1', topicMappingVersion: 'mapping-v1', exposureState: extra.exposureState ?? 'answer_seen',
    topicEvidence: [{ topicId: 11, role: 'primary', weight: 1 }], outcome, firstAttempt: true,
    usedHint: extra.usedHint ?? false, usedExplanation: extra.usedExplanation ?? false,
    timeSpentSeconds: extra.timeSpentSeconds ?? 80, difficulty: extra.difficulty ?? 'medium',
    questionQualityConfidence: extra.questionQualityConfidence ?? 0.9
  };
}

function rowFromEvent(value) {
  return {
    ...value,
    eventSequence: BigInt(value.eventSequence),
    occurredAt: new Date(value.occurredAt),
    recordedAt: new Date(value.recordedAt),
    sessionId: value.sessionId ?? null,
    scoringRubricVersion: value.scoringRubricVersion ?? null,
    topicEvidence: value.topicEvidence,
    timeSpentSeconds: value.timeSpentSeconds ?? null,
    difficulty: value.difficulty ?? null,
    metadata: value.metadata ?? null
  };
}

function inMemoryPrisma(events) {
  const outboxes = new Map(events.map((e) => [`out-${e.eventSequence}`, {
    id: `out-${e.eventSequence}`, evidence: rowFromEvent(e), status: 'pending', attemptCount: 0,
    availableAt: new Date(0), createdAt: new Date(e.recordedAt), claimedAt: null, processedAt: null, lastErrorCode: null
  }]));
  const states = new Map();
  let checkpoint = null;
  const outboxApi = {
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of outboxes.values()) {
        if (where.id && row.id !== where.id) continue;
        if (where.status && row.status !== where.status) continue;
        if (where.claimedAt?.lt && !(row.claimedAt && row.claimedAt < where.claimedAt.lt)) continue;
        row.status = data.status ?? row.status;
        row.claimedAt = data.claimedAt === null ? null : data.claimedAt ?? row.claimedAt;
        row.processedAt = data.processedAt ?? row.processedAt;
        row.availableAt = data.availableAt ?? row.availableAt;
        row.lastErrorCode = data.lastErrorCode === null ? null : data.lastErrorCode ?? row.lastErrorCode;
        if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
        count += 1;
      }
      return { count };
    },
    findMany: async () => [...outboxes.values()].filter((row) => row.status === 'pending').sort((a, b) => b.id.localeCompare(a.id)).map(({ id }) => ({ id })),
    findFirst: async ({ where }) => {
      const row = outboxes.get(where.id);
      return row && row.status === where.status ? row : null;
    },
    update: async ({ where, data }) => {
      const row = outboxes.get(where.id);
      Object.assign(row, data);
      return row;
    },
    findUnique: async ({ where }) => {
      const row = outboxes.get(where.id);
      return row ? { attemptCount: row.attemptCount, evidence: row.evidence } : null;
    }
  };
  const checkpointApi = {
    findUnique: async () => checkpoint,
    upsert: async ({ create, update }) => {
      checkpoint = checkpoint ? { ...checkpoint, ...update } : { ...create };
      return checkpoint;
    },
    deleteMany: async () => { checkpoint = null; return { count: 1 }; },
    create: async ({ data }) => { checkpoint = { ...data }; return checkpoint; }
  };
  const stateApi = {
    findUnique: async ({ where }) => states.get(where.userId_subjectCode_topicId_modelVersion.topicId) ?? null,
    upsert: async ({ where, create, update }) => {
      const key = where.userId_subjectCode_topicId_modelVersion.topicId;
      const row = states.has(key) ? { ...states.get(key), ...update } : { ...create };
      states.set(key, row);
      return row;
    },
    deleteMany: async () => { const count = states.size; states.clear(); return { count }; },
    findMany: async () => [...states.values()]
  };
  const tx = {
    $executeRaw: async () => 1,
    learningEvidenceOutbox: outboxApi,
    learningStateProjectionCheckpoint: checkpointApi,
    userCscaTopicStateV2: stateApi,
    learningEvidenceEvent: { findMany: async () => events.map(rowFromEvent) }
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (work) => work(tx)
    },
    outboxes,
    states,
    checkpoint: () => checkpoint
  };
}

async function testProjectorOrderingIdempotencyAndReplay() {
  const events = [
    event(1, 'incorrect', '2026-09-10T08:00:00.000Z'),
    event(2, 'correct', '2026-09-12T08:00:00.000Z', { sourceType: 'review', difficulty: 'hard' })
  ];
  const store = inMemoryPrisma(events);
  const flags = new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true'
  });
  const interventionCalls = [];
  const interventions = { evaluateUserSubject: async (userId, subjectCode) => interventionCalls.push({ userId, subjectCode }) };
  const projector = new LearningStateProjectorService(store.prisma, flags, interventions);

  const first = await projector.processPending(10);
  assert.equal(first.processed, 1);
  assert.equal(first.deferred, 1, 'sequence 2 must wait until sequence 1 commits');
  assert.equal(store.checkpoint().lastEventSequence, 1n);
  assert.deepEqual(interventionCalls[0], { userId: 42, subjectCode: 'math' });

  const second = await projector.processPending(10);
  assert.equal(second.processed, 1);
  assert.equal(store.checkpoint().lastEventSequence, 2n);
  const projected = { ...store.states.get(11) };
  assert.equal(projected.evidenceCount, 2);
  assert.equal(projected.difficultyCeiling, 'hard');
  assert.ok(projected.retention > 0.5, 'delayed review evidence must update retention');

  const firstOutbox = store.outboxes.get('out-1');
  firstOutbox.status = 'pending';
  firstOutbox.availableAt = new Date(0);
  const duplicate = await projector.processPending(10);
  assert.equal(duplicate.duplicate, 1);
  assert.deepEqual(store.states.get(11), projected, 'at-least-once redelivery must not change state twice');

  const replayed = await projector.replayUserSubject(42, 'math');
  assert.equal(replayed.events, 2);
  assert.equal(replayed.topics, 1);
  assert.deepEqual(store.states.get(11), projected, 'full replay must deterministically reproduce projected state');
  assert.ok(interventionCalls.length >= 3, 'processed evidence and full replay must trigger shadow intervention evaluation');
}

async function testProjectionFailureRecovery() {
  const row = { id: 'out-fail', status: 'pending', attemptCount: 0, claimedAt: null, lastErrorCode: null };
  const api = {
    updateMany: async ({ where, data }) => {
      if (where.claimedAt) return { count: 0 };
      if (where.id !== row.id || row.status !== where.status) return { count: 0 };
      row.status = data.status;
      row.claimedAt = data.claimedAt === null ? null : data.claimedAt ?? row.claimedAt;
      row.lastErrorCode = data.lastErrorCode === null ? null : data.lastErrorCode ?? row.lastErrorCode;
      if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
      return { count: 1 };
    },
    findMany: async () => row.status === 'pending' ? [{ id: row.id }] : [],
    findUnique: async () => ({ attemptCount: row.attemptCount })
  };
  const prisma = {
    learningEvidenceOutbox: api,
    $transaction: async () => { throw new Error('database temporarily unavailable'); }
  };
  const flags = new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true'
  });
  const projector = new LearningStateProjectorService(prisma, flags);
  const retryable = await projector.processPending(1);
  assert.equal(retryable.failed, 1);
  assert.equal(row.status, 'pending');
  assert.equal(row.lastErrorCode, 'PROJECTION_FAILED');
  row.attemptCount = 7;
  const terminal = await projector.processPending(1);
  assert.equal(terminal.failed, 1);
  assert.equal(row.status, 'failed');
}

async function testInterventionFailureIsolation() {
  const store = inMemoryPrisma([event(1, 'incorrect', '2026-09-12T08:00:00.000Z')]);
  const flags = new LearningIntelligenceFeatureFlagsService({ CSCA_AGENT_FOUNDATION_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true' });
  const projector = new LearningStateProjectorService(store.prisma, flags, { evaluateUserSubject: async () => { throw new Error('shadow unavailable'); } });
  const result = await projector.processPending(1);
  assert.equal(result.processed, 1, 'shadow intervention failure must not fail evidence projection');
  assert.equal(store.checkpoint().lastEventSequence, 1n);
}

async function testShadowComparisonOwnership() {
  const calls = [];
  const prisma = {
    userCscaTopicMastery: {
      findMany: async (args) => { calls.push(args); return [{ topicId: 11, mastery: 0.6 }]; }
    },
    userCscaTopicStateV2: {
      findMany: async (args) => {
        calls.push(args);
        return [{ topicId: 11, mastery: 0.7, confidence: 0.5, independence: 0.6, retention: 0.55,
          fluency: 0.7, transfer: 0.5, consistency: 0.6, coverage: 0.4, evidenceCount: 4,
          stateVersion: 'state-4', lastEvidenceAt: new Date('2026-09-12T08:00:00.000Z') }];
      }
    }
  };
  const flags = new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true'
  });
  const query = new LearningStateShadowQueryService(prisma, flags);
  const comparison = await query.compareUserSubject(42, 'math');
  assert.equal(comparison.items[0].masteryDelta, 0.1);
  assert.ok(calls.every((call) => call.where.userId === 42), 'v1/v2 comparison must constrain the current user in both queries');
}

async function testSubmissionOwnershipQueries() {
  const mockCalls = [];
  const mockService = new CscaMockExamService({
    mockExamAttempt: {
      findFirst: async (args) => { mockCalls.push(args); return null; }
    }
  }, {}, {}, {}, {}, {}, {});
  await assert.rejects(() => mockService.findAttempt('17', 42), /模考记录不存在/);
  assert.deepEqual(mockCalls[0].where, { id: 17, userId: 42 });

  const specialCalls = [];
  const specialService = new CscaSpecialPracticeService({
    specialPracticeSession: {
      findFirst: async (args) => { specialCalls.push(args); return null; }
    }
  }, {}, {});
  await assert.rejects(() => specialService.findSession('18', 42), /专项练习记录不存在/);
  assert.deepEqual(specialCalls[0].where, { id: 18, OR: [{ userId: 42 }, { userId: null }] });
  await assert.rejects(() => specialService.findSession('18'), /专项练习记录不存在/);
  assert.deepEqual(specialCalls[1].where, { id: 18, userId: null });
}

function testPureProjectionQualityAndAssistance() {
  const base = event(1, 'correct', '2026-09-12T08:00:00.000Z');
  const independent = projectLearningTopicState(null, base, 1);
  const assisted = projectLearningTopicState(null, { ...base, usedExplanation: true, exposureState: 'explanation_seen' }, 1);
  const lowQuality = projectLearningTopicState(null, { ...base, questionQualityConfidence: 0.2 }, 1);
  assert.ok(independent.mastery > assisted.mastery);
  assert.ok(independent.independence > assisted.independence);
  assert.ok(independent.mastery > lowQuality.mastery);
  assert.deepEqual(projectLearningTopicState(null, base, 1), independent, 'projection must be deterministic');
}

async function main() {
  await testWriter();
  testPureProjectionQualityAndAssistance();
  await testProjectorOrderingIdempotencyAndReplay();
  await testProjectionFailureRecovery();
  await testInterventionFailureIsolation();
  await testShadowComparisonOwnership();
  await testSubmissionOwnershipQueries();
  console.log('LEARNING_EVIDENCE_SHADOW_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
