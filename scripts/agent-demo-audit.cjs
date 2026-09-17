const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

loadEnv();

const prisma = new PrismaClient();
const expectedTools = {
  learning_status: ['get_subject_mastery'],
  review_queue: ['get_review_queue'],
  mock_exams: ['list_mock_exam_attempts'],
  past_papers: ['search_past_papers'],
  capability_help: [],
  unsupported: []
};
const evidenceChecks = {
  learning_status: /作答证据/,
  review_queue: /错误重复/,
  mock_exams: /得分\s*78/,
  past_papers: /本地演示/
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function percentile(values, ratio) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function snapshotIntent(run) {
  const planned = run.outbox.find((event) => event.eventKey === 'plan:created');
  return typeof planned?.payload?.intent === 'string'
    ? planned.payload.intent
    : typeof run.inputSnapshot?.intent === 'string' ? run.inputSnapshot.intent : 'unknown';
}

function answerFor(conversation, runId) {
  const message = conversation.messages.find((item) => item.runId === runId && item.role === 'assistant');
  return typeof message?.content?.text === 'string' ? message.content.text.trim() : '';
}

async function main() {
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Dedicated demo credentials are missing. Run agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const demoUser = await prisma.user.findUnique({ where: { email: credentials.email }, select: { id: true } });
  assert(demoUser, 'Dedicated demo user is missing. Run agent-demo-seed.cjs --apply first.');
  const conversations = await prisma.agentConversation.findMany({
    where: { userId: demoUser.id, title: { startsWith: 'Agent demo gate ' }, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      runs: {
        orderBy: { createdAt: 'asc' },
        include: {
          toolCalls: { orderBy: { createdAt: 'asc' } },
          outbox: { orderBy: { sequence: 'asc' } }
        }
      }
    }
  });
  assert(conversations.length === 5, `Expected five latest demo conversations, found ${conversations.length}.`);
  const runs = conversations.flatMap((conversation) => conversation.runs.map((run) => ({ conversation, run })));
  assert(runs.length === 30, `Expected 30 demo runs, found ${runs.length}.`);

  const rows = runs.map(({ conversation, run }) => {
    const intent = snapshotIntent(run);
    const tools = run.toolCalls.map((call) => call.toolName);
    const answer = answerFor(conversation, run.id);
    const expected = expectedTools[intent];
    assert(expected, `Unexpected routed intent ${intent} in run ${run.id}.`);
    assert(run.status === 'completed', `Run ${run.id} is ${run.status}.`);
    assert(run.toolCalls.every((call) => call.status === 'completed'), `Run ${run.id} has an incomplete tool call.`);
    assert(JSON.stringify(tools) === JSON.stringify(expected), `Run ${run.id} used ${JSON.stringify(tools)} for ${intent}.`);
    assert(answer, `Run ${run.id} has no assistant answer.`);
    assert(!/(undefined|\[object Object\]|failed to fetch|internal error)/i.test(answer), `Run ${run.id} contains a broken answer: ${answer.slice(0, 120)}`);
    if (evidenceChecks[intent]) {
      assert(evidenceChecks[intent].test(answer), `Run ${run.id} did not expose the expected seeded evidence for ${intent}: ${answer.slice(0, 160)}`);
    }
    const durationMs = run.startedAt && run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : null;
    assert(durationMs !== null && durationMs >= 0, `Run ${run.id} has invalid timing.`);
    return {
      runId: run.id,
      intent,
      tools,
      durationMs,
      answerLength: answer.length,
      answerPreview: answer.replace(/\s+/g, ' ').slice(0, 100)
    };
  });

  const runIds = new Set(rows.map((row) => row.runId));
  const earliest = new Date(Math.min(...conversations.map((item) => item.createdAt.getTime())) - 10_000);
  const latest = new Date(Math.max(...conversations.map((item) => item.updatedAt.getTime())) + 10_000);
  const gatewayCandidates = await prisma.aiGatewayCallLog.findMany({
    where: {
      createdAt: { gte: earliest, lte: latest },
      sourceModule: { in: ['agent_intent_router', 'agent_grounded_response'] }
    },
    select: {
      sourceModule: true,
      status: true,
      latencyMs: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      estimatedCost: true,
      metadata: true
    }
  });
  const gatewayCalls = gatewayCandidates.filter((call) => runIds.has(String(call.metadata?.runId ?? '')));
  const durations = rows.map((row) => row.durationMs);
  const sourceCounts = gatewayCalls.reduce((result, call) => {
    result[call.sourceModule] = (result[call.sourceModule] ?? 0) + 1;
    return result;
  }, {});
  assert(gatewayCalls.every((call) => call.status === 'success'), 'At least one model gateway call failed.');
  assert(sourceCounts.agent_intent_router === 30, `Expected 30 intent-router calls, found ${sourceCounts.agent_intent_router ?? 0}.`);
  assert(sourceCounts.agent_grounded_response === 20, `Expected 20 grounded-response calls, found ${sourceCounts.agent_grounded_response ?? 0}.`);
  const report = {
    schemaVersion: '1',
    suite: 'agent-demo-audit-v1',
    generatedAt: new Date().toISOString(),
    verdict: 'pass',
    rehearsals: conversations.length,
    runs: rows.length,
    completedRuns: rows.filter((row) => row.durationMs !== null).length,
    toolCalls: rows.reduce((sum, row) => sum + row.tools.length, 0),
    runLatencyMs: {
      min: Math.min(...durations),
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: Math.max(...durations)
    },
    gateway: {
      calls: gatewayCalls.length,
      successful: gatewayCalls.filter((call) => call.status === 'success').length,
      failed: gatewayCalls.filter((call) => call.status !== 'success').length,
      bySource: sourceCounts,
      promptTokens: gatewayCalls.reduce((sum, call) => sum + Number(call.promptTokens ?? 0), 0),
      completionTokens: gatewayCalls.reduce((sum, call) => sum + Number(call.completionTokens ?? 0), 0),
      totalTokens: gatewayCalls.reduce((sum, call) => sum + Number(call.totalTokens ?? 0), 0),
      estimatedCost: Number(gatewayCalls.reduce((sum, call) => sum + Number(call.estimatedCost ?? 0), 0).toFixed(8)),
      latencyMs: gatewayCalls.length ? {
        p50: percentile(gatewayCalls.map((call) => call.latencyMs), 0.5),
        p95: percentile(gatewayCalls.map((call) => call.latencyMs), 0.95),
        max: Math.max(...gatewayCalls.map((call) => call.latencyMs))
      } : null
    },
    answerSamples: rows.slice(0, 6).map(({ intent, answerLength, answerPreview }) => ({ intent, answerLength, answerPreview }))
  };
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
