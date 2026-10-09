#!/usr/bin/env node

const assert = require('node:assert/strict');
const { evaluateRolloutConfiguration, parseArgs } = require('./agent-teaching-production-readiness.cjs');

function configuration(overrides = {}) {
  return {
    CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'shadow',
    CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: '',
    CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '0',
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

const canary = configuration({
  CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE: 'active',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '5',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'true'
});
assert.deepEqual(evaluateRolloutConfiguration(canary, 'canary').blockers, []);
assert.deepEqual(evaluateRolloutConfiguration(canary, 'auto').blockers, []);

const unsafeCanary = evaluateRolloutConfiguration({
  ...canary,
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS: 'math,physics',
  CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT: '6',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'false'
}, 'canary');
assert(unsafeCanary.blockers.includes('CANARY_REQUIRES_VERIFICATION_ENABLED'));
assert(unsafeCanary.blockers.includes('CANARY_SCOPE_MUST_BE_MATH_ONLY'));
assert(unsafeCanary.blockers.includes('CANARY_PERCENT_MUST_BE_1_TO_5'));

assert.throws(() => parseArgs(['--expect-stage', 'public']), /auto, shadow, canary/);
assert.equal(parseArgs(['--expect-stage', 'canary']).expectedStage, 'canary');

console.log('AGENT_TEACHING_PRODUCTION_READINESS_POLICY_OK');
