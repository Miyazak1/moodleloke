const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function assertRouteContract() {
  const agent = read('backend/src/agent/agent.controller.ts');
  const practice = read('backend/src/csca-special-practice/csca-special-practice.controller.ts');
  const auth = read('frontend/src/pages/PublicAuthPage.tsx');
  const requiredAgentRoutes = [
    "@Get('journey/overview')\n  @Access('user')",
    "@Post('journey/prescriptions/:prescriptionId/start')\n  @Access('user')",
    "@Get('journey/state')\n  @Access('user')"
  ];
  for (const contract of requiredAgentRoutes) assert.ok(agent.includes(contract), `missing Agent activation contract: ${contract}`);
  const requiredPracticeRoutes = [
    /@Post\(\['csca-special-practice\/adaptive\/sessions',[^\n]+\n\s+@Access\('user'\)/,
    /@Post\(\['csca-special-practice\/adaptive\/rounds\/:id\/check',[^\n]+\n\s+@Access\('user'\)/,
    /@Post\(\['csca-special-practice\/adaptive\/rounds\/:id\/submit',[^\n]+\n\s+@Access\('user'\)/
  ];
  for (const contract of requiredPracticeRoutes) assert.match(practice, contract, `missing practice activation contract: ${contract}`);
  assert.ok(agent.includes("@Access('verifiedUser')"), 'Agent controller must retain verified-user default for AI and attachment endpoints');
  assert.ok(practice.includes("@Access('verifiedUser')"), 'Practice controller must retain verified-user default outside the first-round path');
  assert.ok(auth.includes('continued_unverified'), 'auth flow must retain the explicit continue-unverified path');
}

async function assertMilestones() {
  const { TrainingEventService } = require('../backend/dist/backend/src/csca-special-practice/training-event.service.js');
  const events = [];
  const users = [
    { id: 11, createdAt: new Date('2026-10-01T00:00:00.000Z'), emailVerifiedAt: null },
    { id: 12, createdAt: new Date('2026-10-02T00:00:00.000Z'), emailVerifiedAt: new Date('2026-10-02T00:05:00.000Z') }
  ];
  const tx = {
    $executeRaw: async () => 1,
    cscaTrainingEvent: {
      findFirst: async ({ where }) => events.find((event) => event.userId === where.userId && event.eventType === where.eventType && event.source === where.source) ?? null,
      create: async ({ data }) => {
        const event = { id: events.length + 1, createdAt: new Date('2026-10-01T00:10:00.000Z'), ...data };
        events.push(event);
        return { id: event.id };
      }
    }
  };
  const prisma = {
    $transaction: async (callback) => callback(tx),
    user: { findMany: async () => users },
    cscaTrainingEvent: {
      findMany: async () => events
    }
  };
  const service = new TrainingEventService(prisma);
  const first = await service.recordActivationMilestone({ userId: 11, eventType: 'first_answer_submitted' });
  const duplicate = await service.recordActivationMilestone({ userId: 11, eventType: 'first_answer_submitted' });
  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(events.length, 1, 'activation milestone must be idempotent per user and event type');

  events.push(
    { id: 2, userId: 11, eventType: 'onboarding_skipped', source: 'activation', createdAt: new Date('2026-10-01T00:02:00.000Z') },
    { id: 3, userId: 11, eventType: 'agent_entry', source: 'public_site', createdAt: new Date('2026-10-01T00:04:00.000Z') },
    { id: 4, userId: 11, eventType: 'first_round_completed', source: 'activation', createdAt: new Date('2026-10-01T00:20:00.000Z') }
  );
  const activation = await service.activationObservability(new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-08T00:00:00.000Z'));
  assert.equal(activation.cohortRegistered, 2);
  assert.equal(activation.emailVerified, 1);
  assert.equal(activation.onboardingReached, 1);
  assert.equal(activation.agentEntered, 1);
  assert.equal(activation.firstAnswerSubmitted, 1);
  assert.equal(activation.firstRoundCompleted, 1);
  assert.equal(activation.funnel.length, 6);
}

async function main() {
  assertRouteContract();
  await assertMilestones();
  console.log('New-user activation contract self-test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
