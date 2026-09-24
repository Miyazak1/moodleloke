const assert = require('node:assert/strict');
const { AgentConversationLifecycleService } = require('../dist/backend/src/agent/agent-conversation-lifecycle.service');
const { agentConversationLifecyclePolicy } = require('../dist/backend/src/agent/agent-conversation-lifecycle.policy');

function candidate(id, overrides = {}) {
  return {
    id, status: 'archived', runs: [], outbox: [], attachments: [], ...overrides
  };
}

async function testDryRunAndBlocking() {
  const writes = [];
  let reads = 0;
  const prisma = { agentConversation: {
    async findMany() {
      reads += 1;
      return reads === 1
        ? [{ id: 'archive-1' }]
        : [
            candidate('purge-1'),
            candidate('running-1', { runs: [{ status: 'running' }] }),
            candidate('evidence-1', { attachments: [{ storageKey: null, _count: { examOutcomeEvidence: 1 } }] })
          ];
    },
    async updateMany(input) { writes.push(['update', input]); return { count: 1 }; },
    async deleteMany(input) { writes.push(['delete', input]); return { count: 1 }; }
  } };
  const report = await new AgentConversationLifecycleService(prisma).run({ dryRun: true, now: new Date('2026-09-23T00:00:00Z') });
  assert.equal(report.archiveCandidateCount, 1);
  assert.equal(report.purgeCandidateCount, 1);
  assert.equal(report.blockedCount, 2);
  assert.deepEqual(report.blockedIds.sort(), ['evidence-1', 'running-1']);
  assert.equal(writes.length, 0);
}

async function testApplyArchivesAndPurges() {
  const writes = [];
  let reads = 0;
  const prisma = { agentConversation: {
    async findMany() { reads += 1; return reads === 1 ? [{ id: 'archive-1' }] : [candidate('purge-1')]; },
    async updateMany(input) { writes.push(['update', input]); return { count: 1 }; },
    async deleteMany(input) { writes.push(['delete', input]); return { count: 1 }; }
  } };
  const report = await new AgentConversationLifecycleService(prisma).run({ now: new Date('2026-09-23T00:00:00Z') });
  assert.equal(report.archivedCount, 1);
  assert.equal(report.purgedCount, 1);
  assert.equal(writes.filter(([kind]) => kind === 'delete').length, 1);
  const claim = writes.find(([kind, input]) => kind === 'update' && input.data.status === 'purging');
  assert.equal(claim[1].where.status, 'archived');
}

function testPolicyBounds() {
  const policy = agentConversationLifecyclePolicy({
    AGENT_PRACTICE_QA_ARCHIVE_DAYS: '10', AGENT_PRACTICE_QA_PURGE_DAYS: '5', AGENT_PRACTICE_QA_ABANDONED_HOURS: '0'
  });
  assert.equal(policy.archiveDays, 10);
  assert.equal(policy.purgeDays, 11);
  assert.equal(policy.abandonedHours, 1);
  assert.equal(policy.purgeAfter(new Date('2026-01-01T00:00:00Z')).toISOString(), '2026-01-12T00:00:00.000Z');
}

Promise.resolve()
  .then(testDryRunAndBlocking)
  .then(testApplyArchivesAndPurges)
  .then(testPolicyBounds)
  .then(() => console.log('Agent conversation lifecycle tests passed.'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
