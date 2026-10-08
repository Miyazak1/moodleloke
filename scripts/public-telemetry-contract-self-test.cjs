'use strict';

const assert = require('node:assert/strict');
const { TrainingEventService } = require('../backend/dist/backend/src/csca-special-practice/training-event.service.js');
const { resetRateLimitForTests } = require('../backend/dist/backend/src/common/rate-limit.js');

async function main() {
  resetRateLimitForTests();
  const created = [];
  const prisma = {
    cscaTrainingEvent: {
      create: async ({ data }) => {
        created.push(data);
        return { id: created.length, ...data };
      }
    }
  };
  const service = new TrainingEventService(prisma);
  const visitId = '5de65d6b-77cb-4ef8-8dc2-e7ad18c94d81';
  const result = await service.recordPublicSiteEvent(null, {
    eventType: 'auth_completed', visitId, route: 'auth', locale: 'zh-CN',
    method: 'email', mode: 'register', result: 'success', component: 'auth'
  });
  assert.deepEqual(result, { received: true });
  assert.equal(created.length, 1);
  assert.equal(created[0].source, 'public_site');
  assert.equal(created[0].userId, null);
  assert.deepEqual(Object.keys(created[0].metadata).sort(), ['component', 'locale', 'method', 'mode', 'result', 'route', 'schemaVersion', 'visitId'].sort());

  await assert.rejects(
    service.recordPublicSiteEvent(null, { eventType: 'public_page_view', visitId, route: 'home', email: 'must-not-be-accepted@example.com' }),
    /unsupported fields/i
  );
  await assert.rejects(
    service.recordPublicSiteEvent(null, { eventType: 'password_captured', visitId, route: 'auth' }),
    /eventType/i
  );
  await assert.rejects(
    service.recordPublicSiteEvent(null, { eventType: 'public_page_view', visitId: 'fingerprint', route: 'home' }),
    /visitId/i
  );

  const now = new Date('2026-10-08T00:00:00.000Z');
  const row = (eventType, metadata) => ({
    id: 1, userId: null, subject: null, sessionId: null, roundId: null, questionId: null,
    eventType, source: 'public_site', metadata: { schemaVersion: '1', visitId, ...metadata }, createdAt: now
  });
  const overview = service.publicSiteObservability([
    row('public_page_view', { route: 'home' }),
    row('agent_entry', { route: 'agent' }),
    row('auth_started', { route: 'auth', mode: 'register' }),
    row('auth_completed', { route: 'auth', mode: 'register', result: 'success' }),
    row('email_verification_result', { route: 'me', result: 'success' })
  ]);
  assert.equal(overview.uniqueVisits, 1);
  assert.equal(overview.agentVisitCount, 1);
  assert.equal(overview.agentEntryRate, 1);
  assert.equal(overview.registrationCompletions, 1);
  assert.equal(overview.verificationSuccesses, 1);
  console.log('Public telemetry contract self-test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
