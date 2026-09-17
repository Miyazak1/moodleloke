const assert = require('node:assert/strict');
const { evaluateTeachingAssetRoutingOutcomes } = require('../dist/backend/src/agent/teaching-asset-routing-outcome-policy');
const { TeachingAssetRoutingOutcomeService } = require('../dist/backend/src/agent/teaching-asset-routing-outcome.service');

function observation(routingMode, result = 'passed', stability = 'stable', age = 0) {
  return {
    routingMode, deliveryCompleted: true, occurredAt: new Date(Date.now() - age),
    outcomes: [{ phase: 'immediate', result, independent: true, accuracy: result === 'passed' ? 1 : 0 }],
    stability: { status: 'completed', result: stability }
  };
}

function testHealthyComparison() {
  const report = evaluateTeachingAssetRoutingOutcomes([
    ...Array.from({ length: 20 }, (_, index) => observation('shadow', index < 14 ? 'passed' : 'failed', index < 14 ? 'stable' : 'not_stable', index + 100)),
    ...Array.from({ length: 20 }, (_, index) => observation('active', index < 16 ? 'passed' : 'failed', index < 16 ? 'stable' : 'not_stable', index))
  ]);
  assert.equal(report.evidenceQualified, true);
  assert.equal(report.circuit.status, 'healthy');
  assert.ok(report.comparison.verificationPassRateDelta > 0);
}

function testRegressionTrips() {
  const report = evaluateTeachingAssetRoutingOutcomes([
    ...Array.from({ length: 20 }, (_, index) => observation('shadow', index < 18 ? 'passed' : 'failed', index < 18 ? 'stable' : 'not_stable', index + 100)),
    ...Array.from({ length: 20 }, (_, index) => observation('active', index < 6 ? 'passed' : 'failed', index < 6 ? 'stable' : 'not_stable', index))
  ]);
  assert.equal(report.circuit.status, 'tripped');
  assert.ok(report.circuit.reasonCodes.includes('active_verification_emergency_floor'));
  assert.ok(report.circuit.reasonCodes.includes('active_verification_regression'));
  assert.ok(report.circuit.reasonCodes.includes('active_stability_regression'));
}

function testFailureStreakTripsEarly() {
  const report = evaluateTeachingAssetRoutingOutcomes(Array.from({ length: 5 }, (_, index) => observation('active', 'failed', 'not_stable', index)));
  assert.equal(report.circuit.status, 'tripped');
  assert.ok(report.circuit.reasonCodes.includes('active_consecutive_immediate_failures'));
}

async function testPersistedCircuitGuard() {
  const events = [];
  let decisionWhere = null;
  const prisma = {
    cscaTrainingEvent: {
      findFirst: async () => events.at(-1) ?? null,
      findMany: async ({ where }) => { decisionWhere = where; return []; },
      create: async ({ data }) => { const row = { ...data, createdAt: new Date() }; events.push(row); return row; }
    },
    learningInterventionDelivery: { findMany: async () => [] }
  };
  const service = new TeachingAssetRoutingOutcomeService(prisma);
  assert.equal((await service.activeAllowed('math')).allowed, true);
  await prisma.cscaTrainingEvent.create({ data: { subject: 'math', metadata: { status: 'tripped', reasonCodes: ['test'] } } });
  assert.equal((await service.activeAllowed('math')).allowed, false);
  const reset = await service.resetCircuit('math', 7, 'Reviewed and safe to resume monitoring.');
  assert.equal((await service.activeAllowed('math')).allowed, true);
  await service.evaluateAndPersist('math');
  assert.ok(decisionWhere.createdAt.gte.getTime() >= reset.createdAt.getTime(), 'A manual reset must start a fresh automatic evaluation window.');
}

Promise.resolve().then(testHealthyComparison).then(testRegressionTrips).then(testFailureStreakTripsEarly).then(testPersistedCircuitGuard).then(() => {
  console.log('TEACHING_ASSET_ROUTING_OUTCOME_OK');
}).catch((error) => { console.error(error); process.exitCode = 1; });
