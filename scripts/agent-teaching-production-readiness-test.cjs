#!/usr/bin/env node

const assert = require('node:assert/strict');
const { evaluateRolloutConfiguration, parseArgs, positiveUserIds } = require('./agent-teaching-production-readiness.cjs');

function configuration(overrides = {}) {
  return {
    CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'shadow',
    CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: '',
    CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '0',
    CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE: 'shadow',
    CSCA_LEARNING_INTERVENTION_INTERNAL_USER_IDS: '',
    CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS: '',
    CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES: '',
    CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT: '0',
    CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'false',
    CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'false',
    ...overrides
  };
}

assert.deepEqual(evaluateRolloutConfiguration(configuration(), 'shadow').blockers, []);
assert.deepEqual(evaluateRolloutConfiguration(configuration(), 'auto').blockers, []);

const unsafeShadow = evaluateRolloutConfiguration(configuration({
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '5'
}), 'shadow');
assert(unsafeShadow.blockers.includes('SHADOW_REQUIRES_DELIVERY_DISABLED'));
assert(unsafeShadow.blockers.includes('SHADOW_REQUIRES_NO_ACTIVE_SUBJECTS'));
assert(unsafeShadow.blockers.includes('SHADOW_REQUIRES_ZERO_PERCENT'));

const internal = configuration({
  CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE: 'internal',
  CSCA_LEARNING_INTERVENTION_INTERNAL_USER_IDS: '7,11',
  CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS: 'math',
  CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES: 'M-FUNC-001',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'true'
});
assert.deepEqual(evaluateRolloutConfiguration(internal, 'internal').blockers, []);
assert.deepEqual(evaluateRolloutConfiguration(internal, 'auto').blockers, []);

const unsafeInternal = evaluateRolloutConfiguration({
  ...internal,
  CSCA_LEARNING_INTERVENTION_INTERNAL_USER_IDS: '',
  CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES: 'M-FUNC-001,M-FUNC-002'
}, 'internal');
assert(unsafeInternal.blockers.includes('INTERNAL_USER_ALLOWLIST_EMPTY'));
assert(unsafeInternal.blockers.includes('INTERNAL_TOPIC_MUST_BE_M_FUNC_001'));

const canary = configuration({
  CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'active',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '5',
  CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE: 'canary',
  CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS: 'math',
  CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES: 'M-FUNC-001',
  CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT: '5',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'true'
});
assert.deepEqual(evaluateRolloutConfiguration(canary, 'canary').blockers, []);
assert.deepEqual(evaluateRolloutConfiguration(canary, 'auto').blockers, []);

const unsafeCanary = evaluateRolloutConfiguration({
  ...canary,
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math,physics',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '6',
  CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT: '6',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'false'
}, 'canary');
assert(unsafeCanary.blockers.includes('CANARY_REQUIRES_VERIFICATION_ENABLED'));
assert(unsafeCanary.blockers.includes('CANARY_SCOPE_MUST_BE_MATH_ONLY'));
assert(unsafeCanary.blockers.includes('CANARY_PERCENT_MUST_BE_1_TO_5'));

assert.throws(() => parseArgs(['--expect-stage', 'public']), /auto, shadow, internal, canary/);
assert.equal(parseArgs(['--expect-stage', 'internal']).expectedStage, 'internal');
assert.equal(parseArgs(['--expect-stage', 'canary']).expectedStage, 'canary');
assert.deepEqual(positiveUserIds('7,11,7,invalid,-1'), [7, 11]);

console.log('AGENT_TEACHING_PRODUCTION_READINESS_POLICY_OK');
