const assert = require('node:assert/strict');
const { AgentRuntimeFeatureFlagsService } = require('../dist/backend/src/agent/agent-runtime-feature-flags.service');
const { AgentTeachingAssetService } = require('../dist/backend/src/agent/agent-teaching-asset.service');
const { AdminTeachingAssetsService } = require('../dist/backend/src/agent/admin-teaching-assets.service');

function payload(title) {
  return {
    schemaVersion: '1', title, summary: `${title} summary`, instructions: ['Observe the change.'],
    component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
    activePrompt: { id: `${title}-check`, prompt: 'Where is the vertex?', options: [{ id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }], correctAnswer: 'right', correctFeedback: 'Correct', incorrectFeedback: 'Try again' },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
}

function asset(id, stableKey, updatedAt) {
  return {
    id, stableKey, type: 'micro_lesson', subjectCode: 'math', updatedAt,
    topics: [{ topic: { title: 'Functions' } }],
    versions: [{ id: `${id}-v1`, assetId: id, version: 1, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 6, renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1', payloadSchemaVersion: 'function-shift-v1', payload: payload(stableKey), fallbackPayload: { title: stableKey, body: 'fallback' }, sourceRefs: [], reviewState: 'approved', publishedAt: new Date('2026-09-01T00:00:00Z') }]
  };
}

function resolverPrisma(recorded) {
  const legacy = asset('legacy', 'math.legacy', new Date('2026-09-10T00:00:00Z'));
  const alternate = asset('alternate', 'math.alternate', new Date('2026-09-09T00:00:00Z'));
  return {
    teachingAsset: { findMany: async () => [legacy, alternate] },
    teachingAssetExposure: { findMany: async () => [{ userId: 42, assetVersionId: 'legacy-v1', status: 'completed', completedAt: new Date(), lastExposedAt: new Date() }] },
    learningInterventionDelivery: { findMany: async () => [{ userId: 42, contentSourceVersion: 'legacy-v1', outcomes: [{ result: 'failed', independent: true }], stabilityAssessment: { status: 'completed', result: 'not_stable' } }] },
    cscaTrainingEvent: {
      findFirst: async () => null,
      create: async ({ data }) => { recorded.push(data); return data; }
    }
  };
}

async function testShadowAndActiveModes() {
  const recorded = [];
  const shadowFlags = new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', CSCA_AGENT_TEACHING_ASSET_ENABLED: 'true', CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'shadow' });
  const shadow = new AgentTeachingAssetService(resolverPrisma(recorded), shadowFlags);
  const shadowResult = await shadow.resolvePublishedForTopic(42, 11, 'math', 'zh-CN', { depth: 'guided' }, { type: 'proactive_intervention', key: 'intervention:shadow-1' });
  assert.equal(shadowResult.versionId, 'legacy-v1');
  assert.equal(shadowResult.resolverVersion, 'teaching-asset-resolver-v1');
  assert.equal(recorded[0].metadata.personalizedVersionId, 'alternate-v1');
  assert.equal(recorded[0].metadata.diverged, true);
  assert.ok(recorded[0].metadata.reasonCodes.includes('alternate_after_ineffective_asset'));

  const activeFlags = new AgentRuntimeFeatureFlagsService({ AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', CSCA_AGENT_TEACHING_ASSET_ENABLED: 'true', CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'active', CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math', CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '100' });
  const active = new AgentTeachingAssetService(resolverPrisma(recorded), activeFlags);
  const activeResult = await active.resolvePublishedForTopic(42, 11, 'math', 'zh-CN', { depth: 'guided' }, { type: 'proactive_intervention', key: 'intervention:active-1' });
  assert.equal(activeResult.versionId, 'alternate-v1');
  assert.equal(activeResult.resolverVersion, 'teaching-asset-resolver-v2');
  assert.equal(activeResult.selectionDecision.policyVersion, 'teaching-asset-selection-v1');

  const guarded = new AgentTeachingAssetService(resolverPrisma(recorded), activeFlags, { activeAllowed: async () => ({ allowed: false, circuit: { status: 'tripped', reasonCodes: ['test'] } }) });
  const guardedResult = await guarded.resolvePublishedForTopic(42, 11, 'math', 'zh-CN', { depth: 'guided' }, { type: 'proactive_intervention', key: 'intervention:guarded-1' });
  assert.equal(guardedResult.versionId, 'legacy-v1');
  assert.equal(guardedResult.resolverVersion, 'teaching-asset-resolver-v1');
  assert.ok(recorded.at(-1).metadata.reasonCodes.includes('learning_outcome_circuit_tripped'));
  assert.equal(new AgentRuntimeFeatureFlagsService({}).teachingAssetRoutingMode(), 'legacy');
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'invalid' }).teachingAssetRoutingMode(), 'legacy');
  assert.equal(new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'active', CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'physics', CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '100' }).teachingAssetRoutingModeFor(42, 'math'), 'shadow');
}

async function testDiagnosticsGate() {
  const events = Array.from({ length: 50 }, (_, index) => ({
    userId: index + 1, subject: index % 3 === 0 ? 'physics' : 'math', createdAt: new Date(),
    metadata: {
      contextType: 'proactive_intervention', contextKey: `intervention:${index}`, routingMode: 'shadow',
      legacyVersionId: 'legacy-v1', personalizedVersionId: index < 5 ? null : 'alternate-v1', servedVersionId: 'legacy-v1',
      diverged: index >= 5, personalizedFallback: index < 5, boundedExploration: index < 10,
      reasonCodes: index >= 5 ? ['alternate_after_ineffective_asset'] : ['no_eligible_personalized_candidate'], latencyMs: 30
    }
  }));
  const service = new AdminTeachingAssetsService(
    { cscaTrainingEvent: { findMany: async () => events } },
    new AgentRuntimeFeatureFlagsService({ CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'shadow' }),
    { report: async () => ({ schemaVersion: '1', observations: 0, circuit: { status: 'monitoring', reasonCodes: [] } }) }
  );
  const report = await service.routingDiagnostics({ days: 30 });
  assert.equal(report.currentMode, 'shadow');
  assert.equal(report.metrics.decisions, 50);
  assert.equal(report.metrics.coverageRate, 0.9);
  assert.equal(report.metrics.explorationRate, 0.2);
  assert.equal(report.metrics.p95LatencyMs, 30);
  assert.equal(report.gate.qualified, true);
  assert.equal(report.learningOutcomes.circuit.status, 'monitoring');
  assert.ok(report.recent.every((item) => !('userId' in item) && item.studentRef.length === 10));
}

Promise.resolve().then(testShadowAndActiveModes).then(testDiagnosticsGate).then(() => {
  console.log('TEACHING_ASSET_ROUTING_SHADOW_OK');
}).catch((error) => { console.error(error); process.exitCode = 1; });
