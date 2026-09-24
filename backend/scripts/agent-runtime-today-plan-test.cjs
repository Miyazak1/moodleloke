const assert = require('node:assert/strict');
const { AgentEventService } = require('../dist/backend/src/agent/agent-event.service');
const { AgentRunnerService } = require('../dist/backend/src/agent/agent-runner.service');
const { AgentService, dedupeReviewQueue } = require('../dist/backend/src/agent/agent.service');
const { AgentToolExecutorService } = require('../dist/backend/src/agent/agent-tool-executor.service');
const { AgentRuntimeFeatureFlagsService } = require('../dist/backend/src/agent/agent-runtime-feature-flags.service');
const { AgentPracticeActionService } = require('../dist/backend/src/agent/agent-practice-action.service');
const {
  normalizeAttachmentAssessment,
  normalizeAttachmentContentType,
  normalizeAttachmentSubject
} = require('../dist/backend/src/agent/agent-attachment-analysis.service');
const { routeAgentIntent, SubmitAgentMessageInputSchema } = require('../dist/backend/src/agent/agent.types');
const { decideWrongPatternVerification } = require('../dist/backend/src/csca-learning/wrong-pattern-verification.policy');

function runtimeStore(overrides = {}) {
  const state = {
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: { schemaVersion: '1', intent: 'today_plan', text: '今天学什么', locale: 'zh-CN', clientRequestId: 'client-1' }
    },
    events: [], artifacts: [], messages: [], operations: [], ...overrides
  };
  const db = {
    state,
    async $transaction(callback) { return callback(db); },
    async $executeRaw() { return 1; },
    agentRun: {
      async updateMany({ where, data }) {
        if (where.id && where.id !== state.run.id) return { count: 0 };
        if (where.userId && where.userId !== state.run.userId) return { count: 0 };
        if (where.status && where.status !== state.run.status) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          state.run[key] = value && typeof value === 'object' && 'increment' in value
            ? Number(state.run[key] || 0) + value.increment : value;
        }
        state.operations.push(`run:${state.run.status}`);
        return { count: 1 };
      },
      async findFirst({ where }) {
        if (where.id !== state.run.id || where.userId !== state.run.userId) return null;
        return state.run;
      }
    },
    agentOutbox: {
      async findFirst({ where }) {
        if (where.eventKey) return state.events.find((event) => event.runId === where.runId && event.eventKey === where.eventKey) || null;
        return state.events.filter((event) => event.runId === where.runId && event.sequence != null)
          .sort((a, b) => b.sequence - a.sequence)[0] || null;
      },
      async create({ data }) {
        const event = { id: `event-${state.events.length + 1}`, createdAt: new Date(), ...data };
        state.events.push(event);
        state.operations.push(`event:${event.eventType}`);
        return event;
      }
    },
    agentArtifact: {
      async upsert({ where, create }) {
        const key = where.runId_type_version;
        let artifact = state.artifacts.find((item) => item.runId === key.runId && item.type === key.type && item.version === key.version);
        if (!artifact) {
          artifact = { id: `artifact-${state.artifacts.length + 1}`, ...create };
          state.artifacts.push(artifact);
          state.operations.push('artifact:persisted');
        }
        return artifact;
      }
    },
    agentMessage: {
      async findMany() {
        return state.messages.slice().reverse().map((item) => ({ role: item.role, content: item.content, runId: item.runId ?? null }));
      },
      async upsert({ where, create }) {
        const key = where.conversationId_clientMessageId;
        let message = state.messages.find((item) => item.conversationId === key.conversationId && item.clientMessageId === key.clientMessageId);
        if (!message) {
          message = { id: `message-${state.messages.length + 1}`, ...create };
          state.messages.push(message);
          state.operations.push('message:persisted');
        }
        return message;
      }
    },
    agentConversation: { async updateMany() { return { count: 1 }; } },
    mockExamAttempt: {
      async findFirst({ where }) {
        return (state.mockAttempts ?? []).find((item) => item.id === where.id && item.userId === where.userId && item.submittedAt) ?? null;
      }
    }
  };
  return db;
}

function successfulTools() {
  const called = [];
  return {
    called,
    async execute(_context, name) {
      called.push(name);
      const data = {
        get_learning_profile: { educationStageCode: 'high_school', gradeCode: '12', targetSubjectCodes: ['math'] },
        get_score_goal: { status: 'configured', goal: { goalId: 'goal-1' } },
        get_target_gap: { status: 'ready', snapshot: { gapSnapshotId: 'gap-1' } },
        get_learning_prescription: {
          status: 'ready', goalId: 'goal-1', prescription: {
            prescriptionId: 'rx-1', versions: { evidence: 'e1' }, objective: 'targeted_practice:math:10',
            reasonCodes: ['MASTERY_GAP'], confidence: 'high', estimatedMinutes: 18,
            tasks: [{ type: 'targeted_practice', subject: 'math', topicIds: [10], difficulty: 'medium', questionCount: 5, priority: 1 }],
            validUntil: '2026-09-14T00:00:00.000Z'
          }
        },
        get_score_readiness: {
          status: 'ready', visibility: 'shadow', forecasts: [{
            forecastId: 'forecast-1', goalId: 'goal-1', userId: 7, subjectCode: 'math', targetScore: 90,
            readinessState: 'insufficient', expectedScoreBand: null, targetAttainmentProbability: null,
            confidence: 'insufficient', reasonCodes: ['FORECAST_MODEL_NOT_CALIBRATED'],
            nextValidationAction: 'diagnostic'
          }]
        },
        get_review_queue: { items: [{ reviewItemId: 31, patternType: 'concept_gap', topicId: 10, subject: 'math', title: 'Functions', priority: 3, recurrenceCount: 3, status: 'active', dueAt: null, href: '/review' }] },
        get_subject_mastery: { stateSource: 'user_csca_topic_mastery_v1', subjects: [{ subject: 'math', evidenceCount: 5, score: 0.52, topics: [{ topicId: 10, code: 'functions', title: 'Functions', score: 0.52, confidence: 0.8, status: 'needs_attention', attemptCount: 5, correctCount: 2, lastPracticedAt: null, updatedAt: '2026-09-14T00:00:00.000Z' }] }] },
        list_mock_exam_attempts: { items: [{ attemptId: 'mock-1', paperSlug: 'math-mock-1', title: 'Math Mock 1', subject: 'math', status: 'submitted', answeredCount: 48, questionCount: 48, score: 82, updatedAt: '2026-09-14T00:00:00.000Z', attemptPath: '/mock/1', reportPath: '/mock/1/report' }] },
        search_past_papers: { items: [{ id: 1, slug: 'chemistry-2026', title: 'CSCA 2026 Chemistry Past Paper', category: 'past-paper', subject: 'chemistry', examYear: 2026, language: 'en', questionCount: 48, hasAnswers: true, hasSolutions: false, isFree: true, fileCount: 2, href: '/past-papers/download/chemistry-2026' }] },
        get_question_supply_status: { status: 'sufficient', availableCount: 8, canCreatePractice: true },
        get_intervention_stability: {
          verificationId: 'verification-1', deliveryId: 'delivery-1', subjectCode: 'math', currentPhase: 'immediate',
          currentPhaseStatus: 'completed', currentPhaseResult: 'passed', stabilityStatus: 'pending',
          stabilityResult: null, policyVersion: 'stability-v1', evaluatedAt: null,
          nextDueAt: '2026-09-14T00:00:00.000Z', phases: [
            { phase: 'immediate', status: 'completed', result: 'passed', accuracy: 1, dueAt: '2026-09-13T00:00:00.000Z', evaluatedAt: '2026-09-13T00:05:00.000Z' }
          ]
        }
      }[name];
      return { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null };
    }
  };
}

async function testTodayPlanCompletesInOrder() {
  const prisma = runtimeStore();
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const recovered = [];
  const runner = new AgentRunnerService(prisma, tools, events, undefined, {
    async recordRecoveryBestEffort(input) { recovered.push(input); }
  });
  await runner.run('run-1', 7);
  assert.equal(prisma.state.run.status, 'completed');
  assert.equal(prisma.state.artifacts.length, 1);
  assert.equal(prisma.state.artifacts[0].route, '/agent');
  assert.deepEqual(tools.called, [
    'get_learning_profile', 'get_score_goal', 'get_target_gap', 'get_learning_prescription',
    'get_score_readiness', 'get_question_supply_status'
  ]);
  assert.equal(prisma.state.artifacts[0].snapshot.scoreReadiness.visibility, 'shadow');
  assert.match(prisma.state.messages[0].content.text, /尚不展示未经校准的分数或达标概率/);
  assert.deepEqual(prisma.state.events.map((event) => event.sequence), [1, 2, 3, 4]);
  assert.deepEqual(prisma.state.events.map((event) => event.eventType), [
    'run.started', 'plan.created', 'artifact.created', 'run.completed'
  ]);
  assert.ok(prisma.state.operations.indexOf('artifact:persisted') < prisma.state.operations.indexOf('event:run.completed'));
  assert.ok(prisma.state.operations.indexOf('message:persisted') < prisma.state.operations.indexOf('event:run.completed'));
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].confirmationKind, 'domain_preflight_passed');
  assert.equal(recovered[0].availableCount, 8);
}

async function testLlmRoutingCanRecognizeNaturalPlanRequestWithoutChoosingTools() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: { schemaVersion: '1', intent: 'unsupported', text: '我现在最应该先处理哪一块', locale: 'zh-CN', clientRequestId: 'client-1' }
    },
    messages: [{ role: 'user', content: { text: '我现在最应该先处理哪一块' } }]
  });
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const routerCalls = [];
  const router = {
    async route(input) {
      routerCalls.push(input);
      return { intent: 'today_plan', source: 'llm', confidence: 0.92, reasonCode: 'planning_request', routerVersion: 'agent-intent-router-v1' };
    }
  };
  await new AgentRunnerService(prisma, tools, events, undefined, undefined, router).run('run-1', 7);
  assert.equal(routerCalls.length, 1);
  assert.equal(prisma.state.run.status, 'completed');
  assert.equal(prisma.state.artifacts.length, 1);
  const planEvent = prisma.state.events.find((event) => event.eventType === 'plan.created');
  assert.equal(planEvent.payload.intent, 'today_plan');
  assert.equal(planEvent.payload.source, 'llm');
}

async function testAttachmentRunHandsOffWithoutMisleadingAssistantMessage() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: { schemaVersion: '1', intent: 'unsupported', text: '请分析附件', locale: 'zh-CN', clientRequestId: 'client-1', attachmentIds: ['attachment-1'] }
    }
  });
  const tools = successfulTools();
  let routed = 0;
  const router = { async route() { routed += 1; throw new Error('attachment messages must bypass the chat router'); } };
  await new AgentRunnerService(prisma, tools, new AgentEventService(prisma), undefined, undefined, router).run('run-1', 7);
  assert.equal(prisma.state.run.status, 'completed');
  assert.equal(prisma.state.messages.length, 0);
  assert.equal(tools.called.length, 0);
  assert.equal(routed, 0);
  assert.equal(prisma.state.events.find((event) => event.eventType === 'plan.created').payload.intent, 'attachment_analysis');
}

async function testUpdatingDecisionDoesNotCreateArtifact() {
  const prisma = runtimeStore();
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_target_gap'
    ? { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data: { status: 'updating', snapshot: null }, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, events).run('run-1', 7);
  assert.equal(prisma.state.run.status, 'completed');
  assert.equal(prisma.state.artifacts.length, 0);
  assert.equal(tools.called.includes('get_question_supply_status'), false);
}

async function testVerificationReturnUsesOwnedStabilityContext() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '下一步', locale: 'zh-CN', clientRequestId: 'client-1',
        pageContext: { route: '/verification', entityRef: { type: 'intervention_verification', id: 'verification-1' } }
      }
    }
  });
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const replays = [];
  await new AgentRunnerService(prisma, tools, events, {
    async replayUserSubject(userId, subjectCode) { replays.push({ userId, subjectCode }); }
  }).run('run-1', 7);
  assert.deepEqual(replays, [{ userId: 7, subjectCode: 'math' }]);
  assert.equal(tools.called[0], 'get_intervention_stability');
  assert.equal(prisma.state.artifacts[0].snapshot.interventionStability.verificationId, 'verification-1');
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.status, 'verification_scheduled');
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.completedPhaseCount, 1);
  assert.match(prisma.state.messages[0].content.text, /即时独立验证 3\/3 题通过/);
  assert.match(prisma.state.messages[0].content.text, /尚不等于稳定掌握/);
  assert.match(prisma.state.messages[0].content.text, /后续保持验证将在到期后提供/);
}

async function testFailedVerificationDoesNotOverstateMastery() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '下一步', locale: 'zh-CN', clientRequestId: 'client-failed-verification',
        pageContext: { route: '/verification', entityRef: { type: 'intervention_verification', id: 'verification-1' } }
      }
    }
  });
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_intervention_stability'
    ? {
        ok: true, tool: name, toolVersion: '1.0', requestId: 'request', usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null,
        data: {
          verificationId: 'verification-1', deliveryId: 'delivery-1', subjectCode: 'math', currentPhase: 'immediate', currentPhaseStatus: 'completed',
          currentPhaseResult: 'failed', stabilityStatus: 'completed', stabilityResult: 'not_stable', policyVersion: 'stability-v1',
          evaluatedAt: '2026-09-13T00:05:00.000Z', nextDueAt: null,
          phases: [{ phase: 'immediate', status: 'completed', result: 'failed', accuracy: 1 / 3, dueAt: '2026-09-13T00:00:00.000Z', evaluatedAt: '2026-09-13T00:05:00.000Z' }]
        }
      }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, new AgentEventService(prisma), { async replayUserSubject() {} }).run('run-1', 7);
  assert.match(prisma.state.messages[0].content.text, /即时独立验证仅答对 1\/3 题/);
  assert.match(prisma.state.messages[0].content.text, /不会据此提高掌握判断/);
  assert.match(prisma.state.messages[0].content.text, /掌握尚不稳定/);
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.status, 'consolidation_required');
}

async function testRetentionReturnNamesTransferAsNextStage() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '下一步', locale: 'zh-CN', clientRequestId: 'client-retention-verification',
        pageContext: { route: '/verification', entityRef: { type: 'intervention_verification', id: 'verification-retention' } }
      }
    }
  });
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_intervention_stability'
    ? {
        ok: true, tool: name, toolVersion: '1.0', requestId: 'request', usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null,
        data: {
          verificationId: 'verification-retention', deliveryId: 'delivery-1', subjectCode: 'math', currentPhase: 'retention', currentPhaseStatus: 'completed',
          currentPhaseResult: 'passed', stabilityStatus: 'pending', stabilityResult: null, policyVersion: 'stability-v1',
          evaluatedAt: null, nextDueAt: '2026-09-14T00:00:00.000Z',
          phases: [{ phase: 'retention', status: 'completed', result: 'passed', accuracy: 1, dueAt: '2026-09-13T00:00:00.000Z', evaluatedAt: '2026-09-13T00:05:00.000Z' }]
        }
      }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, new AgentEventService(prisma), { async replayUserSubject() {} }).run('run-1', 7);
  assert.match(prisma.state.messages[0].content.text, /保持验证 3\/3 题通过/);
  assert.match(prisma.state.messages[0].content.text, /后续迁移验证将在到期后提供/);
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.status, 'verification_scheduled');
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.currentPhase, 'retention');
}

async function testTransferReturnCanConfirmStableMastery() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '下一步', locale: 'zh-CN', clientRequestId: 'client-transfer-verification',
        pageContext: { route: '/verification', entityRef: { type: 'intervention_verification', id: 'verification-transfer' } }
      }
    }
  });
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_intervention_stability'
    ? {
        ok: true, tool: name, toolVersion: '1.0', requestId: 'request', usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null,
        data: {
          verificationId: 'verification-transfer', deliveryId: 'delivery-1', subjectCode: 'math', currentPhase: 'transfer', currentPhaseStatus: 'completed',
          currentPhaseResult: 'passed', stabilityStatus: 'completed', stabilityResult: 'stable', policyVersion: 'stability-v1',
          evaluatedAt: '2026-09-14T00:05:00.000Z', nextDueAt: null,
          phases: [{ phase: 'transfer', status: 'completed', result: 'passed', accuracy: 1, dueAt: '2026-09-14T00:00:00.000Z', evaluatedAt: '2026-09-14T00:05:00.000Z' }]
        }
      }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, new AgentEventService(prisma), { async replayUserSubject() {} }).run('run-1', 7);
  assert.match(prisma.state.messages[0].content.text, /迁移验证 3\/3 题通过/);
  assert.match(prisma.state.messages[0].content.text, /三阶段验证已确认稳定掌握/);
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.status, 'stable_mastery_confirmed');
  assert.equal(prisma.state.artifacts[0].snapshot.decisionImpact.passedPhaseCount, 1);
}

async function testMockExamContinuationProjectsEvidenceBeforeCreatingNextArtifact() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '根据刚完成的模考安排下一步', locale: 'zh-CN', clientRequestId: 'client-1',
        pageContext: { route: '/agent?agentView=mock-report', entityRef: { type: 'mock_attempt', id: '91' } }
      }
    },
    mockAttempts: [{ id: 91, userId: 7, submittedAt: new Date('2026-09-15T08:30:00.000Z') }]
  });
  const tools = successfulTools();
  let projected = 0;
  await new AgentRunnerService(
    prisma,
    tools,
    new AgentEventService(prisma),
    { async processPending() { projected += 1; } }
  ).run('run-1', 7);
  assert.equal(projected, 1);
  assert.equal(prisma.state.run.status, 'completed');
  assert.equal(prisma.state.artifacts.length, 1);
  assert.equal(prisma.state.artifacts[0].domainEntityId, 'rx-1');
  assert.equal(prisma.state.artifacts[0].snapshot.generatedFrom, 'learning_prescription');
  assert.equal(prisma.state.artifacts[0].snapshot.canStart, true);
}

async function testMockExamContinuationRejectsUnownedContext() {
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: {
        schemaVersion: '1', intent: 'today_plan', text: '根据刚完成的模考安排下一步', locale: 'zh-CN', clientRequestId: 'client-1',
        pageContext: { route: '/agent?agentView=mock-report', entityRef: { type: 'mock_attempt', id: '999' } }
      }
    }
  });
  let projected = 0;
  await new AgentRunnerService(
    prisma,
    successfulTools(),
    new AgentEventService(prisma),
    { async processPending() { projected += 1; } }
  ).run('run-1', 7);
  assert.equal(prisma.state.run.status, 'failed');
  assert.equal(projected, 0);
  assert.equal(prisma.state.artifacts.length, 0);
}

async function testReviewPrescriptionBindsConcreteWrongPattern() {
  const prisma = runtimeStore();
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_learning_prescription'
    ? { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data: { status: 'ready', goalId: 'goal-1', prescription: {
        prescriptionId: 'rx-review', versions: {}, objective: 'review:math:10', reasonCodes: ['DUE_REVIEW'], confidence: 'high', estimatedMinutes: 12,
        tasks: [{ type: 'review', subject: 'math', topicIds: [10], questionCount: 5, priority: 1 }], validUntil: '2099-01-01T00:00:00.000Z'
      } }, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, events).run('run-1', 7);
  assert.equal(prisma.state.artifacts[0].snapshot.review.reviewItemId, 31);
  assert.equal(prisma.state.artifacts[0].snapshot.canStart, true);
  assert.ok(tools.called.includes('get_review_queue'));
}

async function testDueInterventionVerificationDoesNotDependOnQuestionSupply() {
  const prisma = runtimeStore();
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_learning_prescription'
    ? { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data: { status: 'ready', goalId: 'goal-1', prescription: {
        prescriptionId: 'rx-verification', versions: {}, objective: 'intervention_verification:math:10',
        reasonCodes: ['INTERVENTION_RETENTION_DUE'], confidence: 'high', estimatedMinutes: 12,
        tasks: [{
          type: 'intervention_verification', subject: 'math', topicIds: [10], questionCount: 4, priority: 1,
          interventionVerificationId: 'verification-retention', interventionVerificationPhase: 'retention'
        }],
        validUntil: '2099-01-01T00:00:00.000Z'
      } }, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null }
    : original(context, name, input);
  await new AgentRunnerService(prisma, tools, events).run('run-1', 7);
  assert.equal(prisma.state.artifacts[0].snapshot.task.type, 'intervention_verification');
  assert.equal(prisma.state.artifacts[0].snapshot.canStart, true);
  assert.equal(prisma.state.artifacts[0].route, null);
  assert.equal(tools.called.includes('get_question_supply_status'), false,
    'staged verification is already materialized and must remain isolated from question supply');
  assert.match(prisma.state.messages[0].content.text, /到期验证卡会显示在方案下方/);
}

async function testSupplyShortageCreatesOnlyAnOperationalRequest() {
  const prisma = runtimeStore();
  const events = new AgentEventService(prisma);
  const tools = successfulTools();
  const original = tools.execute;
  tools.execute = async (context, name, input) => name === 'get_question_supply_status'
    ? { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data: {
        status: 'insufficient', availableCount: 2, canCreatePractice: false
      }, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null }
    : original(context, name, input);
  const observed = [];
  const supplyRequests = { async recordBestEffort(input) { observed.push(input); } };
  await new AgentRunnerService(prisma, tools, events, undefined, supplyRequests).run('run-1', 7);
  assert.equal(prisma.state.artifacts[0].route, null);
  assert.equal(prisma.state.artifacts[0].snapshot.canStart, false);
  assert.equal(observed.length, 1);
  assert.deepEqual(observed[0].topicIds, [10]);
  assert.equal(observed[0].requestedCount, 5);
  assert.equal(observed[0].availableCount, 2);
  assert.equal(observed[0].source, 'agent_today_plan');
}

async function testGroundedReadRoutesUseOnlyServerCapabilities() {
  const cases = [
    ['learning_status', '我的学习情况', 'get_subject_mastery', /Functions/],
    ['review_queue', '看看我的错题', 'get_review_queue', /错误重复 3 次/],
    ['mock_exams', '看看模考记录', 'list_mock_exam_attempts', /得分 82/],
    ['past_papers', '找 2026 化学真题', 'search_past_papers', /chemistry-2026/]
  ];
  for (const [intent, text, expectedTool, expectedText] of cases) {
    const prisma = runtimeStore({
      run: {
        id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
        inputSnapshot: { schemaVersion: '1', intent, text, locale: 'zh-CN', clientRequestId: `client-${intent}` }
      }
    });
    const tools = successfulTools();
    await new AgentRunnerService(prisma, tools, new AgentEventService(prisma)).run('run-1', 7);
    assert.equal(prisma.state.run.status, 'completed');
    assert.deepEqual(tools.called, [expectedTool]);
    assert.match(prisma.state.messages[0].content.text, expectedText);
    assert.equal(prisma.state.artifacts.length, 0);
  }
}

async function testGroundedReadRoutesHaveHonestEmptyStates() {
  const cases = [
    ['learning_status', 'get_subject_mastery', { subjects: [] }, /没有足够的已作答证据/],
    ['review_queue', 'get_review_queue', { items: [] }, /没有待处理的错题复习项/],
    ['mock_exams', 'list_mock_exam_attempts', { items: [] }, /没有模考记录/],
    ['past_papers', 'search_past_papers', { items: [] }, /没有找到符合/]
  ];
  for (const [intent, toolName, data, expectedText] of cases) {
    const prisma = runtimeStore({
      run: {
        id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
        inputSnapshot: { schemaVersion: '1', intent, text: '查询', locale: 'zh-CN', clientRequestId: `empty-${intent}` }
      }
    });
    const tools = {
      called: [],
      async execute(_context, name) {
        this.called.push(name);
        assert.equal(name, toolName);
        return { ok: true, tool: name, toolVersion: '1.0', requestId: 'request', data, usage: { creditsCharged: 0, meteringSource: 'none' }, confirmation: null };
      }
    };
    await new AgentRunnerService(prisma, tools, new AgentEventService(prisma)).run('run-1', 7);
    assert.match(prisma.state.messages[0].content.text, expectedText);
    assert.equal(prisma.state.artifacts.length, 0);
  }
}

async function testConversationReadIsUserScoped() {
  let observedWhere;
  const prisma = {
    agentConversation: {
      async findFirst({ where }) {
        observedWhere = where;
        return null;
      }
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {});
  await assert.rejects(() => service.getConversation(99, 'foreign-conversation'), /not found/i);
  assert.equal(observedWhere.userId, 99);
  assert.equal(observedWhere.deletedAt, null);
}

async function testJourneyOverviewUsesLearningCapabilitiesAndPublishedResources() {
  const calls = [];
  const learningRead = {
    async getLearningProfile(userId) {
      calls.push(['profile', userId]);
      return { targetSubjectCodes: ['math', 'physics'] };
    },
    async getSubjectMastery(userId, input) {
      calls.push(['mastery', userId, input]);
      return { stateSource: 'user_csca_topic_mastery_v1', subjects: [{ subject: 'math', evidenceCount: 4, topics: [] }] };
    },
    async getReviewQueue(userId, input) {
      calls.push(['review', userId, input]);
      return { items: [{ reviewItemId: 'review-1', subject: 'math', title: 'Functions' }] };
    },
    async getScoreGoal(userId) {
      calls.push(['score-goal', userId]);
      return { goal: null };
    }
  };
  const pastPapers = {
    async listPublic(input) {
      calls.push(['papers', input]);
      return { items: [{ id: input.subject === 'math' ? 1 : 2, slug: `${input.subject}-paper`, subject: input.subject }] };
    }
  };
  const prisma = {
    cscaExamTopic: {
      async groupBy(input) {
        calls.push(['topics', input]);
        return [
          { subject: 'math', _count: { _all: 12 } },
          { subject: 'physics', _count: { _all: 10 } }
        ];
      }
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {}, learningRead, pastPapers);
  const overview = await service.getJourneyOverview(7, 'en');
  assert.equal(overview.weaknesses.stateSource, 'user_csca_topic_mastery_v1');
  assert.equal(overview.weaknesses.reviewQueue[0].reviewItemId, 'review-1');
  assert.deepEqual(overview.resources.subjectScope, ['math', 'physics']);
  assert.deepEqual(overview.resources.items.map((item) => item.slug), ['math-paper', 'physics-paper']);
  assert.deepEqual(calls.find((item) => item[0] === 'review')[2], { language: 'en', limit: 40 });
  assert.equal(calls.filter((item) => item[0] === 'papers').length, 2);
  assert.deepEqual(calls.find((item) => item[0] === 'score-goal'), ['score-goal', 7]);
}

async function testPrescriptionExposureIsOwnedAndIdempotent() {
  const writes = [];
  let shown = null;
  const prisma = {
    learningPrescription: {
      async findFirst({ where }) {
        assert.deepEqual(where, { id: 'prescription-1', userId: 7 });
        return { id: 'prescription-1' };
      }
    },
    learningPrescriptionOutcome: {
      async findFirst({ where }) {
        assert.equal(where.prescriptionId, 'prescription-1');
        assert.equal(where.userId, 7);
        assert.equal(where.decision, 'shown');
        return shown;
      },
      async create(input) {
        writes.push(input);
        shown = { id: 'shown-1', createdAt: new Date('2026-09-23T08:00:00.000Z') };
        return { createdAt: shown.createdAt };
      }
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {});
  const first = await service.recordPrescriptionExposure(7, 'prescription-1', { clientRequestId: 'shown:1', surface: 'agent_learning_plan' });
  const duplicate = await service.recordPrescriptionExposure(7, 'prescription-1', { clientRequestId: 'shown:1', surface: 'agent_learning_plan' });
  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].data.metadata, { clientRequestId: 'shown:1', surface: 'agent_learning_plan' });
}

async function testLearningContextHasDedicatedCreationBoundary() {
  const writes = [];
  const prisma = {
    agentConversation: {
      async create(input) {
        writes.push(input);
        return { id: 'learning-context-1', createdAt: new Date('2026-09-22T00:00:00.000Z') };
      }
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {});
  const context = await service.createLearningContext(17, { kind: 'past_paper', resourceId: 'paper-1' });
  assert.equal(context.contextId, 'learning-context-1');
  assert.equal(context.kind, 'past_paper');
  assert.equal(context.resourceId, 'paper-1');
  assert.deepEqual(writes[0].data, { userId: 17, title: '__learning_workspace__' });
  await assert.rejects(
    () => service.createConversation(17, { title: '__learning_workspace__' }),
    /Reserved learning workspace title/
  );
}

async function testConversationScopesAreExplicitAtCreation() {
  const writes = [];
  let existingPractice = null;
  const prisma = {
    agentConversation: {
      async findFirst(input) {
        assert.deepEqual(input.where, {
          userId: 17, scopeType: 'practice_question_qa', scopeRoundId: 81, scopeQuestionId: 101,
          status: 'active', deletedAt: null
        });
        return existingPractice;
      },
      async create(input) {
        writes.push(input.data);
        return {
          id: `conversation-${writes.length}`, status: 'active', title: input.data.title,
          scopeType: input.data.scopeType, scopeRoundId: input.data.scopeRoundId, scopeQuestionId: input.data.scopeQuestionId,
          lastMessageAt: null, createdAt: new Date(), updatedAt: new Date()
        };
      }
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {});
  const independent = await service.createConversation(17, {
    title: '独立学科问答', scope: { type: 'independent_subject_qa' }
  });
  assert.equal(independent.scopeType, 'independent_subject_qa');
  assert.deepEqual(writes[0], {
    userId: 17, title: '独立学科问答', scopeType: 'independent_subject_qa', scopeRoundId: null, scopeQuestionId: null,
    purgeAfter: null
  });

  const practice = await service.createConversation(17, {
    title: '第 1 题问答', scope: { type: 'practice_question_qa', roundId: 81, questionId: 101 }
  });
  assert.equal(practice.scopeType, 'practice_question_qa');
  assert.deepEqual({ ...writes[1], purgeAfter: undefined }, {
    userId: 17, title: '第 1 题问答', scopeType: 'practice_question_qa', scopeRoundId: 81, scopeQuestionId: 101,
    purgeAfter: undefined
  });
  assert.ok(writes[1].purgeAfter instanceof Date);

  existingPractice = { ...practice, id: 'existing-practice' };
  const reused = await service.createConversation(17, {
    title: '重复打开', scope: { type: 'practice_question_qa', roundId: 81, questionId: 101 }
  });
  assert.equal(reused.id, 'existing-practice');
  assert.equal(writes.length, 2);
}

async function testDuplicateSubmissionIsScopedAndIdempotent() {
  const calls = [];
  const prisma = {
    agentConversation: { async findFirst(args) { calls.push(args); return { id: 'conv-1' }; } },
    agentAttachment: { async findMany({ where }) { return where.id.in.includes('attachment-1') ? [{ id: 'attachment-1', sizeBytes: 1024 }] : []; } },
    agentMessage: { async findFirst() { return { id: 'message-1', runId: 'run-1', content: { text: '请分析', attachmentIds: ['attachment-1'] } }; } },
    agentRun: { async findFirst(args) { calls.push(args); return { id: 'run-1', status: 'completed' }; } }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, { dispatch() {} }, {});
  const result = await service.submitMessage(7, 'conv-1', { clientRequestId: 'client-1', text: '请分析', attachmentIds: ['attachment-1'] });
  assert.equal(result.runId, 'run-1');
  assert.equal(calls[0].where.userId, 7);
  assert.equal(calls[1].where.userId, 7);
  await assert.rejects(
    () => service.submitMessage(7, 'conv-1', { clientRequestId: 'client-1', text: '不同内容', attachmentIds: ['attachment-1'] }),
    /clientRequestId/
  );
  await assert.rejects(
    () => service.submitMessage(7, 'conv-1', { clientRequestId: 'client-1', text: '请分析', attachmentIds: [] }),
    /clientRequestId/
  );
}

async function testAllowlistAndFlag() {
  assert.equal(routeAgentIntent('我今天该学什么'), 'today_plan');
  assert.equal(routeAgentIntent('tell me a joke'), 'unsupported');
  assert.equal(new AgentRuntimeFeatureFlagsService({}).isWebEnabled(), false);
  assert.equal(new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true' }).isWebEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }).isPracticeWriteEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }).isTeachingAssetEnabled(), false);
  assert.equal(new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', CSCA_AGENT_TEACHING_ASSET_ENABLED: 'true' }).isTeachingAssetEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({}).isLlmRouterEnabled(), false);
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_LLM_ROUTER_ENABLED: 'true' }).isLlmRouterEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({}).isLlmGroundedResponseEnabled(), false);
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_LLM_GROUNDED_RESPONSE_ENABLED: 'true' }).isLlmGroundedResponseEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_ATTACHMENTS_ENABLED: 'true' }).isAttachmentsEnabled(), true);
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_ATTACHMENT_ANALYSIS_ENABLED: 'true' }).isAttachmentAnalysisEnabled(), true);
  const executor = new AgentToolExecutorService({}, {}, {});
  await assert.rejects(
    () => executor.execute({ runId: 'r', conversationId: 'c', userId: 1, traceId: 't', locale: 'zh-CN' }, 'generate_questions', {}),
    /AGENT_TOOL_NOT_ALLOWED/
  );
}

function practiceActionStore({ stale = false, review = false, taskType = null } = {}) {
  const resolvedTaskType = taskType || (review ? 'review' : 'targeted_practice');
  const reviewLike = review || resolvedTaskType === 'concept_learning';
  const artifact = {
    id: 'artifact-1', userId: 7, runId: 'run-1', conversationId: 'conv-1', type: 'learning_plan', status: 'ready',
    domainEntityId: 'rx-1', snapshot: {
      prescriptionId: 'rx-1', validUntil: '2099-01-01T00:00:00.000Z', canStart: true,
      task: { type: resolvedTaskType, subject: 'math', topicIds: [10], questionCount: 5 },
      ...(reviewLike ? { review: { reviewItemId: 31, topicId: 10, patternType: 'concept_gap', title: 'Functions', recurrenceCount: 3 } } : {})
    }
  };
  const state = {
    artifact, calls: [], outcomes: [], round: null, mockAttempt: null,
    pattern: reviewLike ? {
      id: 31, topicId: 10, patternType: 'concept_gap', status: 'improving',
      nextReviewAt: new Date('2026-09-25T08:00:00.000Z'),
      metadata: { consecutiveVerificationPassCount: 0, requiredConsecutiveVerificationPassCount: 2 }
    } : null
  };
  const db = {
    state,
    async $transaction(callback) { return callback(db); },
    agentArtifact: {
      async findFirst({ where }) { return where.id === artifact.id && where.userId === artifact.userId ? artifact : null; },
      async update({ data }) { Object.assign(artifact, data); return artifact; }
    },
    learningDecisionCurrent: {
      async findFirst() { return stale ? null : { prescription: { validUntil: new Date('2099-01-01T00:00:00.000Z') } }; }
    },
    learningPrescriptionOutcome: {
      async findFirst({ where }) {
        return state.outcomes.find((item) =>
          (!where.userId || item.userId === where.userId)
          && (!where.prescriptionId || item.prescriptionId === where.prescriptionId)
          && (!where.domainEntityType || item.domainEntityType === where.domainEntityType)
          && (!where.domainEntityId || item.domainEntityId === where.domainEntityId)
          && (!where.decision || (typeof where.decision === 'string' ? item.decision === where.decision : where.decision.in.includes(item.decision)))
        ) || null;
      },
      async create({ data }) { const outcome = { id: `outcome-${state.outcomes.length + 1}`, createdAt: new Date(), ...data }; state.outcomes.push(outcome); return outcome; }
    },
    cscaWrongPattern: {
      async findFirst({ where }) {
        return state.pattern && where.id === state.pattern.id && where.userId === 7 ? state.pattern : null;
      }
    },
    cscaAdaptiveRound: {
      async findFirst({ where }) { return state.round && where.id === state.round.id ? state.round : null; }
    },
    mockExamAttempt: {
      async findFirst({ where }) { return state.mockAttempt && where.id === state.mockAttempt.id && where.userId === 7 ? state.mockAttempt : null; }
    },
    agentToolCall: {
      async findFirst({ where }) { return state.calls.find((item) => item.idempotencyKeyHash === where.idempotencyKeyHash) || null; },
      async create({ data }) { const call = { id: `call-${state.calls.length + 1}`, status: 'pending', output: null, createdAt: new Date(), ...data }; state.calls.push(call); return call; },
      async update({ where, data }) { const call = state.calls.find((item) => item.id === where.id); Object.assign(call, data); return call; },
      async updateMany({ where, data }) {
        const call = state.calls.find((item) => item.id === where.id);
        if (!call) return { count: 0 };
        if (typeof where.status === 'string' && call.status !== where.status) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(call.status)) return { count: 0 };
        if (where.status?.not && call.status === where.status.not) return { count: 0 };
        Object.assign(call, data);
        return { count: 1 };
      }
    }
  };
  return db;
}

async function testPracticeActionIsConstrainedAndIdempotent() {
  const prisma = practiceActionStore();
  const adaptiveCalls = [];
  const adaptive = {
    async createSession(userId, input) { adaptiveCalls.push(['session', userId, input]); return { id: 51 }; },
    async createRound(userId, sessionId, input) {
      adaptiveCalls.push(['round', userId, sessionId, input]);
      return { session: { id: 51, mode: 'practice', subject: 'math', questionLanguage: 'zh' }, round: { id: 81 }, questions: Array(5).fill({}) };
    }
  };
  const service = new AgentPracticeActionService(
    prisma,
    adaptive,
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  const first = await service.start(7, 'artifact-1', { clientRequestId: 'launch-1', questionLanguage: 'zh' });
  const duplicate = await service.start(7, 'artifact-1', { clientRequestId: 'launch-1', questionLanguage: 'zh' });
  assert.equal(first.roundId, 81);
  assert.deepEqual(duplicate, first);
  assert.equal(adaptiveCalls.length, 2);
  assert.equal(prisma.state.calls.length, 1);
  assert.equal(prisma.state.outcomes.length, 1);
  assert.equal(prisma.state.artifact.status, 'started');
  assert.match(first.route, /^\/agent\?/);
  assert.match(first.route, /agentContextId=conv-1/);
  assert.equal(first.workspace.kind, 'adaptive_round');
  assert.equal(first.workspace.taskType, 'targeted_practice');
  assert.equal(first.workspace.subject, 'math');
  assert.match(first.legacyRoute, /^\/csca-subjects\/math\/practice\/rounds\/81/);
}

async function testPracticeActionRejectsStalePlan() {
  const prisma = practiceActionStore({ stale: true });
  const service = new AgentPracticeActionService(
    prisma,
    { async createSession() { throw new Error('must not run'); } },
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  await assert.rejects(() => service.start(7, 'artifact-1', { clientRequestId: 'launch-stale' }), /方案已经过期/);
  assert.equal(prisma.state.calls.length, 0);
  assert.equal(prisma.state.outcomes[0].decision, 'superseded');
  assert.equal(prisma.state.artifact.status, 'superseded');
}

async function testReviewLaunchAndSettlementAreBoundAndIdempotent() {
  const prisma = practiceActionStore({ review: true });
  let roundInput = null;
  const adaptive = {
    async createSession() { return { id: 52 }; },
    async createRound(_userId, _sessionId, input) {
      roundInput = input;
      return { session: { id: 52, mode: 'practice', subject: 'math', questionLanguage: 'zh' }, round: { id: 82 }, questions: Array(5).fill({}) };
    }
  };
  const service = new AgentPracticeActionService(
    prisma,
    adaptive,
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  const launch = await service.start(7, 'artifact-1', { clientRequestId: 'review-launch' });
  assert.equal(launch.toolName, 'start_review_practice');
  assert.equal(launch.reviewItemId, 31);
  assert.deepEqual(roundInput.verification, { reviewItemId: 31, topicId: 10, patternType: 'concept_gap' });
  prisma.state.round = {
    id: 82,
    submittedAt: new Date(),
    plannerSnapshot: { mode: 'verification', focus: { topicId: 10, reviewItemId: 31, patternType: 'concept_gap' } },
    session: { subject: 'math' },
    items: [{ topicId: 10, isCorrect: true }, { topicId: 10, isCorrect: true }, { topicId: 10, isCorrect: false }]
  };
  const first = await service.settle(7, '82');
  const duplicate = await service.settle(7, '82');
  assert.equal(first.decision, 'failed');
  assert.deepEqual(first.verificationResult, {
    verdict: 'needs_consolidation', currentRoundPassed: false, reviewItemId: 31, topicId: 10,
    patternType: 'concept_gap', consecutivePassCount: 0, requiredPassCount: 2,
    nextReviewAt: '2026-09-25T08:00:00.000Z', nextAction: 'review_then_retry'
  });
  assert.deepEqual(duplicate, first);
  assert.equal(prisma.state.outcomes.filter((item) => item.decision === 'failed').length, 1);
  assert.equal(prisma.state.artifact.status, 'failed');
}

async function testConceptLearningUsesNativeAgentWorkspace() {
  const prisma = practiceActionStore({ taskType: 'concept_learning' });
  const service = new AgentPracticeActionService(
    prisma,
    {
      async createSession() { return { id: 54 }; },
      async createRound() { return { session: { id: 54, mode: 'practice', subject: 'math', questionLanguage: 'zh' }, round: { id: 84 }, questions: Array(5).fill({}) }; }
    },
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  const launch = await service.start(7, 'artifact-1', { clientRequestId: 'concept-learning-launch' });
  assert.equal(launch.taskType, 'concept_learning');
  assert.equal(launch.toolName, 'start_review_practice');
  assert.match(launch.route, /^\/agent\?/);
  assert.equal(launch.workspace.taskType, 'concept_learning');
  assert.equal(launch.reviewItemId, 31);
}

async function testMockExamUsesNativeAgentWorkspaceAndSettles() {
  const prisma = practiceActionStore({ taskType: 'mock_exam' });
  let created = 0;
  const mockExam = {
    async listSubjectPapers() {
      return {
        papers: [{ slug: 'math-mock-1', title: '数学模考 1', isLocked: false }],
        recommendation: { mode: 'initial_diagnostic', target: { type: 'paper', paperSlug: 'math-mock-1' } }
      };
    },
    async createAttempt() {
      created += 1;
      return { id: 91, paper: { slug: 'math-mock-1', title: '数学模考 1' } };
    },
    async getAttempt() { throw new Error('must not resume'); },
    async getReport() {
      return { knowledgeStats: [{ tag: '一次函数', total: 4, wrong: 2 }, { tag: '集合', total: 3, wrong: 0 }] };
    }
  };
  prisma.learningEvidenceEvent = { async count() { return 4; } };
  let projectionRuns = 0;
  const projector = { async processPending() { projectionRuns += 1; return { processed: 4 }; } };
  const decisions = {
    async recompute() {
      return {
        gap: {
          gapSnapshotId: 'gap-2', goalId: 'goal-1',
          gaps: [
            { type: 'mastery', subject: 'math', severity: 0.8, confidence: 'high', topicIds: [10], recommendedAction: 'targeted_practice', reasonCodes: ['MASTERY_GAP'] },
            { type: 'coverage', subject: 'physics', severity: 0.4, confidence: 'medium', topicIds: [20], recommendedAction: 'diagnostic', reasonCodes: ['COVERAGE_GAP'] }
          ]
        },
        prescription: {
          prescriptionId: 'rx-2', reasonSummary: '先修复一次函数薄弱点。', confidence: 'high', estimatedMinutes: 20,
          tasks: [{ type: 'targeted_practice', subject: 'math', topicIds: [10], questionCount: 5, priority: 1 }]
        }
      };
    }
  };
  const service = new AgentPracticeActionService(
    prisma,
    { async createSession() { throw new Error('adaptive practice must not start'); } },
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} },
    mockExam,
    projector,
    decisions
  );
  const launch = await service.start(7, 'artifact-1', { clientRequestId: 'mock-launch', questionLanguage: 'zh' }, 'mock_exam');
  const duplicate = await service.start(7, 'artifact-1', { clientRequestId: 'mock-launch', questionLanguage: 'zh' }, 'mock_exam');
  assert.deepEqual(duplicate, launch);
  assert.equal(created, 1);
  assert.equal(launch.toolName, 'start_mock_exam');
  assert.equal(launch.attemptId, 91);
  assert.equal(launch.workspace.kind, 'mock_exam');
  assert.match(launch.route, /^\/agent\?/);
  assert.equal(launch.legacyRoute, '/csca-mock-exam/attempts/91');

  prisma.state.mockAttempt = {
    id: 91, userId: 7, submittedAt: new Date('2026-09-15T08:30:00.000Z'),
    score: 75, correctCount: 36, wrongCount: 10, unansweredCount: 2,
    paper: { subject: 'math', slug: 'math-mock-1', title: '数学模考 1' }
  };
  const settled = await service.settleMockExam(7, '91');
  const settledAgain = await service.settleMockExam(7, '91');
  assert.deepEqual(settledAgain, settled);
  assert.equal(settled.score, 75);
  assert.equal(settled.learningReview.status, 'ready');
  assert.equal(settled.learningReview.evidence.acceptedCount, 4);
  assert.equal(settled.learningReview.focusTopics[0].title, '一次函数');
  assert.equal(settled.learningReview.targetGap.subjectGapCount, 1);
  assert.equal(settled.learningReview.nextDecision.primaryTask.type, 'targeted_practice');
  assert.equal(settled.learningReview.provenance.nextTaskSource, 'learning_prescription');
  assert.equal(projectionRuns, 1);
  assert.equal(prisma.state.artifact.status, 'completed');
  assert.equal(prisma.state.outcomes.filter((item) => item.decision === 'completed').length, 1);
}

async function testMockExamResumesOwnedAttemptWithoutCreatingAnother() {
  const prisma = practiceActionStore({ taskType: 'mock_exam' });
  let created = 0;
  const service = new AgentPracticeActionService(
    prisma,
    {},
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} },
    {
      async listSubjectPapers() {
        return {
          papers: [{ slug: 'math-mock-1', title: '数学模考 1', isLocked: false }],
          recommendation: { mode: 'resume_attempt', target: { type: 'attempt', attemptId: 92 } }
        };
      },
      async getAttempt() { return { attempt: { id: 92, paper: { slug: 'math-mock-1', title: '数学模考 1' } } }; },
      async createAttempt() { created += 1; throw new Error('must not create'); }
    }
  );
  const launch = await service.start(7, 'artifact-1', { clientRequestId: 'mock-resume' }, 'mock_exam');
  assert.equal(launch.attemptId, 92);
  assert.equal(launch.mode, 'resume_attempt');
  assert.equal(created, 0);
}

async function testAbandonRecordsOneTerminalOutcome() {
  const prisma = practiceActionStore();
  const service = new AgentPracticeActionService(
    prisma,
    {},
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  const first = await service.abandon(7, 'artifact-1', { clientRequestId: 'abandon-1' });
  const duplicate = await service.abandon(7, 'artifact-1', { clientRequestId: 'abandon-2' });
  assert.equal(first.decision, 'abandoned');
  assert.equal(duplicate.decision, 'abandoned');
  assert.equal(prisma.state.outcomes.filter((item) => item.decision === 'abandoned').length, 1);
}

async function testSubmittedPracticeCompletes() {
  const prisma = practiceActionStore();
  const service = new AgentPracticeActionService(
    prisma,
    {
      async createSession() { return { id: 53 }; },
      async createRound() { return { session: { id: 53, mode: 'practice', subject: 'math', questionLanguage: 'zh' }, round: { id: 83 }, questions: Array(5).fill({}) }; }
    },
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  await service.start(7, 'artifact-1', { clientRequestId: 'practice-complete' });
  prisma.state.round = {
    id: 83,
    submittedAt: new Date(),
    plannerSnapshot: { mode: 'regular' },
    session: { subject: 'math' },
    items: [{ topicId: 10, isCorrect: false }]
  };
  const result = await service.settle(7, '83');
  assert.equal(result.decision, 'completed');
  assert.equal(prisma.state.artifact.status, 'completed');
}

async function testConversationListKeepsIndependentSubjectQaSeparate() {
  let query = null;
  const service = new AgentService(
    { agentConversation: { async findMany(input) {
      query = input;
      return [
        { id: 'global-qa', status: 'active', title: '加速度问题', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      ];
    } } },
    {},
    {},
    {}
  );
  const result = await service.listConversations(7);
  assert.deepEqual(result.map((item) => item.id), ['global-qa']);
  assert.deepEqual(query.orderBy, [
    { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    { createdAt: 'desc' }
  ]);
  assert.deepEqual(query.where, { userId: 7, deletedAt: null, scopeType: 'independent_subject_qa' });
  assert.equal(query.take, 50);
  assert.equal('messages' in query.select, false);
}

async function testCurrentDiagnosticPrescriptionMaterializesAndStarts() {
  let storedArtifact = null;
  let artifactCreates = 0;
  const prisma = {
    async $transaction(callback) { return callback(prisma); },
    learningDecisionCurrent: {
      async findFirst({ where }) {
        assert.deepEqual(where, { userId: 7, prescriptionId: 'rx-current' });
        return {
          prescription: {
            id: 'rx-current', goalId: 'goal-1', versions: { decisionPolicyVersion: 'v1' },
            objective: 'diagnostic:chemistry:3', reasonCodes: ['EVIDENCE_INSUFFICIENT'],
            reasonSummary: '先完成化学短诊断。', confidence: 'low', estimatedMinutes: 10,
            tasks: [{ type: 'diagnostic', subject: 'chemistry', topicIds: [3], questionCount: 3, priority: 1 }],
            validUntil: new Date('2099-01-01T00:00:00.000Z')
          }
        };
      }
    },
    agentArtifact: {
      async findFirst() { return storedArtifact; },
      async findUnique() { return storedArtifact; },
      async create({ data }) { artifactCreates += 1; storedArtifact = { createdAt: new Date(), snapshot: data.snapshot, ...data }; return storedArtifact; }
    },
    agentConversation: { async create() { return { id: 'context-current' }; } },
    agentRun: { async create() { return { id: 'run-current' }; } }
  };
  const service = new AgentPracticeActionService(
    prisma,
    {},
    new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
    { async append() {} }
  );
  const starts = [];
  service.start = async (userId, artifactId, input, expectedKind) => {
    starts.push({ userId, artifactId, input, expectedKind });
    return { artifactId, conversationId: 'context-current', roundId: 91, taskType: 'diagnostic', workspace: { kind: 'adaptive_round', phase: 'practice' } };
  };
  const first = await service.startPrescription(7, 'rx-current', { clientRequestId: 'accept-current', questionLanguage: 'zh' });
  const second = await service.startPrescription(7, 'rx-current', { clientRequestId: 'accept-current', questionLanguage: 'zh' });
  assert.equal(first.roundId, 91);
  assert.deepEqual(second, first);
  assert.equal(artifactCreates, 1);
  assert.equal(storedArtifact.type, 'learning_plan');
  assert.equal(storedArtifact.domainEntityId, 'rx-current');
  assert.equal(storedArtifact.snapshot.task.type, 'diagnostic');
  assert.equal(starts[0].expectedKind, 'practice');
  assert.equal(starts[0].input.clientRequestId, 'accept-current');
}

async function testPracticeQuestionQaUsesServerOwnedContextAndRejectsConversationReuse() {
  const contextEvents = [];
  const prisma = {
    cscaTrainingEvent: { async create(input) { contextEvents.push(input.data); return input.data; } }
  };
  const questionContext = {
    async resolve(userId, roundId, questionId, language, questionSource) {
      assert.equal(userId, 7);
      assert.equal(roundId, 81);
      assert.equal(questionId, 101);
      assert.equal(language, 'zh');
      assert.equal(questionSource, 'csca_question');
      return {
        artifact: { id: 'artifact-owned' },
        roundId: 81,
        questionId: 101,
        subject: 'math',
        item: { position: 2, selectedAnswer: 'B', isCorrect: true },
        question: {
          questionSource: 'csca_question', topicTitle: '一次函数', prompt: '服务端可信题干',
          options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
          correctAnswer: 'B', explanation: '服务端审核解析', knowledgeTags: ['斜率']
        }
      };
    }
  };
  const service = new AgentService(prisma, { isWebEnabled: () => true }, {}, {}, undefined, undefined, undefined, undefined, questionContext);
  const tampered = SubmitAgentMessageInputSchema.parse({
    clientRequestId: 'qa-owned-1', text: '为什么 B 对？', locale: 'zh-CN', surface: 'subject_qa', attachmentIds: [],
    pageContext: {
      route: '/agent', entityRef: { type: 'adaptive_round', id: '999' }, selectedQuestionId: 999,
      questionContext: {
        roundId: 81, questionId: 101, questionSource: 'csca_question', questionNumber: 9, subject: 'physics', topicTitle: '伪造知识点',
        prompt: '客户端伪造题干', options: [{ id: 'A', text: '伪造选项' }], selectedAnswer: 'A', answered: true,
        correctAnswer: 'A', isCorrect: true, explanation: '客户端伪造解析', knowledgeTags: ['伪造']
      }
    }
  });
  const authoritative = await service.authoritativeSubjectQaInput(7, tampered);
  assert.equal(authoritative.pageContext.artifactId, 'artifact-owned');
  assert.deepEqual(authoritative.pageContext.entityRef, { type: 'adaptive_round', id: '81' });
  assert.equal(authoritative.pageContext.selectedQuestionId, 101);
  assert.equal(authoritative.pageContext.questionContext.subject, 'math');
  assert.equal(authoritative.pageContext.questionContext.questionNumber, 2);
  assert.equal(authoritative.pageContext.questionContext.prompt, '服务端可信题干');
  assert.equal(authoritative.pageContext.questionContext.correctAnswer, 'B');
  assert.equal(authoritative.pageContext.questionContext.explanation, '服务端审核解析');

  const unansweredService = new AgentService(
    prisma, { isWebEnabled: () => true }, {}, {}, undefined, undefined, undefined, undefined,
    { async resolve(...args) { return { ...(await questionContext.resolve(...args)), item: { position: 2, selectedAnswer: null, isCorrect: null } }; } }
  );
  const unanswered = await unansweredService.authoritativeSubjectQaInput(7, tampered);
  assert.equal(unanswered.pageContext.questionContext.answered, false);
  assert.equal('correctAnswer' in unanswered.pageContext.questionContext, false);
  assert.equal('explanation' in unanswered.pageContext.questionContext, false);

  await assert.rejects(
    () => service.assertSubjectQaConversationScope(7, {
      id: 'conversation-stale', scopeType: 'practice_question_qa', scopeRoundId: 81, scopeQuestionId: 100
    }, authoritative.pageContext),
    (error) => error?.response?.code === 'AGENT_QA_CONTEXT_MISMATCH'
  );
  assert.equal(contextEvents[0].eventType, 'agent_subject_qa_context_mismatch');
  assert.deepEqual(contextEvents[0].metadata.requestedBinding, { roundId: 81, questionId: 101 });
  await service.assertSubjectQaConversationScope(7, {
    id: 'conversation-current', scopeType: 'practice_question_qa', scopeRoundId: 81, scopeQuestionId: 101
  }, authoritative.pageContext);
  await service.assertSubjectQaConversationScope(7, {
    id: 'conversation-independent', scopeType: 'independent_subject_qa', scopeRoundId: null, scopeQuestionId: null
  }, undefined);
}

async function testSubjectQaHistoryIsLimitedToTheCurrentQuestion() {
  const currentQuestion = { roundId: 81, questionId: 101, questionNumber: 1, subject: 'math', topicTitle: '函数', prompt: '当前题', options: [], answered: false };
  const prisma = runtimeStore({
    run: {
      id: 'run-1', userId: 7, conversationId: 'conv-1', traceId: 'trace-1', status: 'queued',
      inputSnapshot: { schemaVersion: '1', intent: 'subject_qa', text: '当前题怎么做？', locale: 'zh-CN', surface: 'subject_qa', pageContext: { questionContext: currentQuestion } }
    },
    messages: [
      { role: 'user', runId: 'run-old', content: { surface: 'subject_qa', text: '上一题问题', pageContext: { questionContext: { roundId: 80, questionId: 99 } } } },
      { role: 'assistant', runId: 'run-old', content: { surface: 'subject_qa', text: '上一题回答' } },
      { role: 'user', runId: 'run-current', content: { surface: 'subject_qa', text: '当前题之前的问题', pageContext: { questionContext: { roundId: 81, questionId: 101 } } } },
      { role: 'assistant', runId: 'run-current', content: { surface: 'subject_qa', text: '当前题之前的回答' } },
      { role: 'user', runId: 'run-1', content: { surface: 'subject_qa', text: '当前题怎么做？', pageContext: { questionContext: currentQuestion } } }
    ]
  });
  let observed = null;
  const subjectQa = {
    async answer(input) {
      observed = input;
      return { text: '只基于当前题回答', decision: 'answer', subject: 'math', generatedByAI: true };
    }
  };
  await new AgentRunnerService(prisma, {}, new AgentEventService(prisma), undefined, undefined, undefined, undefined, undefined, subjectQa).run('run-1', 7);
  assert.deepEqual(observed.history, [
    { role: 'user', text: '当前题之前的问题' },
    { role: 'assistant', text: '当前题之前的回答' }
  ]);
  assert.deepEqual(observed.questionContext, currentQuestion);
  assert.equal(prisma.state.run.status, 'completed');
}

async function testReviewSettlementDistinguishesRepairFromInsufficientEvidence() {
  async function settleWith({ items, status, consecutiveVerificationPassCount }) {
    const prisma = practiceActionStore({ review: true });
    const service = new AgentPracticeActionService(
      prisma,
      {
        async createSession() { return { id: 62 }; },
        async createRound() { return { session: { id: 62, mode: 'practice', subject: 'math', questionLanguage: 'zh' }, round: { id: 92 }, questions: Array(3).fill({}) }; }
      },
      new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true' }),
      { async append() {} }
    );
    await service.start(7, 'artifact-1', { clientRequestId: `review-${status}-${items.length}` });
    prisma.state.pattern.status = status;
    prisma.state.pattern.metadata = { consecutiveVerificationPassCount, requiredConsecutiveVerificationPassCount: 2 };
    prisma.state.pattern.nextReviewAt = status === 'resolved' ? null : new Date('2026-09-28T08:00:00.000Z');
    prisma.state.round = {
      id: 92, submittedAt: new Date(),
      plannerSnapshot: { mode: 'verification', focus: { topicId: 10, reviewItemId: 31, patternType: 'concept_gap' } },
      session: { subject: 'math' }, items
    };
    return service.settle(7, '92');
  }

  const repaired = await settleWith({
    items: [{ topicId: 10, isCorrect: true }, { topicId: 10, isCorrect: true }, { topicId: 10, isCorrect: true }],
    status: 'resolved', consecutiveVerificationPassCount: 2
  });
  assert.equal(repaired.decision, 'completed');
  assert.equal(repaired.verificationResult.verdict, 'repaired');
  assert.equal(repaired.verificationResult.nextAction, 'broaden_coverage');

  const insufficient = await settleWith({
    items: [{ topicId: 10, isCorrect: true }, { topicId: 10, isCorrect: true }],
    status: 'improving', consecutiveVerificationPassCount: 1
  });
  assert.equal(insufficient.decision, 'failed');
  assert.equal(insufficient.verificationResult.verdict, 'insufficient_evidence');
  assert.equal(insufficient.verificationResult.nextAction, 'retry_verification');
}

function testAttachmentAnalysisEnumNormalization() {
  assert.equal(normalizeAttachmentSubject('Mathematics'), 'math');
  assert.equal(normalizeAttachmentSubject('化学'), 'chemistry');
  assert.equal(normalizeAttachmentSubject('astronomy'), 'unknown');
  assert.equal(normalizeAttachmentContentType('student_work'), 'question_and_answer');
  assert.equal(normalizeAttachmentContentType('handwritten-answer'), 'student_answer');
  assert.equal(normalizeAttachmentContentType('unsupported-value'), 'unknown');
  assert.equal(normalizeAttachmentAssessment('partly correct'), 'partially_correct');
  assert.equal(normalizeAttachmentAssessment('not sure'), 'not_assessable');
}

function testReviewQueueDedupesOneLearningTargetIntoOneAction() {
  const result = dedupeReviewQueue([
    { reviewItemId: 71, subject: 'physics', topicId: 47, patternType: 'concept_confusion', recurrenceCount: 3, priority: 3 },
    { reviewItemId: 72, subject: 'physics', topicId: 47, patternType: 'pacing', recurrenceCount: 1, priority: 1 },
    { reviewItemId: 73, subject: 'physics', topicId: 48, patternType: 'calculation_error', recurrenceCount: 2, priority: 2 },
    { reviewItemId: 74, subject: 'chemistry', patternType: 'concept_confusion', recurrenceCount: 2, priority: 2 },
    { reviewItemId: 75, subject: 'chemistry', patternType: 'pacing', recurrenceCount: 4, priority: 3 }
  ]);
  assert.deepEqual(result.map((item) => item.reviewItemId), [71, 73, 74, 75]);
}

function testWrongPatternVerificationRequiresSeparatedConsecutivePasses() {
  const first = decideWrongPatternVerification({ passed: true, occurredAt: new Date('2026-09-20T08:00:00.000Z'), metadata: {} });
  assert.equal(first.resolved, false);
  assert.equal(first.consecutivePassCount, 1);
  const immediateRepeat = decideWrongPatternVerification({ passed: true, occurredAt: new Date('2026-09-20T12:00:00.000Z'), metadata: first.metadata });
  assert.equal(immediateRepeat.resolved, false);
  assert.equal(immediateRepeat.consecutivePassCount, 1);
  const separated = decideWrongPatternVerification({ passed: true, occurredAt: new Date('2026-09-22T08:00:00.000Z'), metadata: immediateRepeat.metadata });
  assert.equal(separated.resolved, true);
  assert.equal(separated.consecutivePassCount, 2);
  const failed = decideWrongPatternVerification({ passed: false, occurredAt: new Date('2026-09-24T08:00:00.000Z'), metadata: separated.metadata });
  assert.equal(failed.resolved, false);
  assert.equal(failed.consecutivePassCount, 0);
}

async function testEventReplayIsUserScopedAndResumesAfterCursor() {
  const createdAt = new Date('2026-09-23T08:00:00.000Z');
  const outbox = [
    { id: 'event-1', runId: 'run-replay', conversationId: 'context-1', sequence: 1, eventType: 'run.started', payload: {}, createdAt },
    { id: 'event-2', runId: 'run-replay', conversationId: 'context-1', sequence: 2, eventType: 'answer.delta', payload: { delta: '继续' }, createdAt }
  ];
  const prisma = {
    agentRun: {
      async findFirst({ where, select }) {
        if (where.id !== 'run-replay' || where.userId !== 7) return null;
        return select?.status ? { status: 'completed' } : { id: 'run-replay', conversationId: 'context-1' };
      }
    },
    agentOutbox: {
      async findMany({ where }) {
        return outbox.filter((item) => item.runId === where.runId && item.sequence > where.sequence.gt);
      }
    }
  };
  const events = new AgentEventService(prisma);
  await assert.rejects(() => events.stream(8, 'run-replay', 0), (error) => error?.status === 404);
  const stream = await events.stream(7, 'run-replay', 1);
  const received = await new Promise((resolve, reject) => {
    const items = [];
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for replay completion.')), 2000);
    stream.subscribe({
      next: (item) => items.push(item),
      error: (error) => { clearTimeout(timeout); reject(error); },
      complete: () => { clearTimeout(timeout); resolve(items); }
    });
  });
  assert.deepEqual(received.map((item) => Number(item.id)), [2]);
  assert.equal(received[0].data.data.delta, '继续');
}

async function main() {
  await testTodayPlanCompletesInOrder();
  await testLlmRoutingCanRecognizeNaturalPlanRequestWithoutChoosingTools();
  await testAttachmentRunHandsOffWithoutMisleadingAssistantMessage();
  await testUpdatingDecisionDoesNotCreateArtifact();
  await testVerificationReturnUsesOwnedStabilityContext();
  await testFailedVerificationDoesNotOverstateMastery();
  await testRetentionReturnNamesTransferAsNextStage();
  await testTransferReturnCanConfirmStableMastery();
  await testMockExamContinuationProjectsEvidenceBeforeCreatingNextArtifact();
  await testMockExamContinuationRejectsUnownedContext();
  await testReviewPrescriptionBindsConcreteWrongPattern();
  await testDueInterventionVerificationDoesNotDependOnQuestionSupply();
  await testSupplyShortageCreatesOnlyAnOperationalRequest();
  await testGroundedReadRoutesUseOnlyServerCapabilities();
  await testGroundedReadRoutesHaveHonestEmptyStates();
  await testConversationReadIsUserScoped();
  await testLearningContextHasDedicatedCreationBoundary();
  await testConversationScopesAreExplicitAtCreation();
  await testJourneyOverviewUsesLearningCapabilitiesAndPublishedResources();
  await testPrescriptionExposureIsOwnedAndIdempotent();
  await testDuplicateSubmissionIsScopedAndIdempotent();
  await testPracticeQuestionQaUsesServerOwnedContextAndRejectsConversationReuse();
  await testSubjectQaHistoryIsLimitedToTheCurrentQuestion();
  await testAllowlistAndFlag();
  await testPracticeActionIsConstrainedAndIdempotent();
  await testCurrentDiagnosticPrescriptionMaterializesAndStarts();
  await testPracticeActionRejectsStalePlan();
  await testReviewLaunchAndSettlementAreBoundAndIdempotent();
  await testReviewSettlementDistinguishesRepairFromInsufficientEvidence();
  await testConceptLearningUsesNativeAgentWorkspace();
  await testMockExamUsesNativeAgentWorkspaceAndSettles();
  await testMockExamResumesOwnedAttemptWithoutCreatingAnother();
  await testAbandonRecordsOneTerminalOutcome();
  await testSubmittedPracticeCompletes();
  await testConversationListKeepsIndependentSubjectQaSeparate();
  testAttachmentAnalysisEnumNormalization();
  testReviewQueueDedupesOneLearningTargetIntoOneAction();
  testWrongPatternVerificationRequiresSeparatedConsecutivePasses();
  await testEventReplayIsUserScopedAndResumesAfterCursor();
  console.log('Agent runtime today-plan tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
