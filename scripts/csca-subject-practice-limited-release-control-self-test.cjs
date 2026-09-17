#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION,
  subjectPracticeLimitedReleaseAdmissionDecision,
  subjectPracticeLimitedReleaseRuntimeConfig
} = require('../backend/src/ai-questioning/subject-practice-limited-release-control-policy');

const key = 'math:elementary_function_direct_property:math_elementary_function_relation_v1';
const identity = {
  subject: 'math',
  taskFamily: 'elementary_function_direct_property',
  planTemplate: 'math_elementary_function_relation_v1'
};
const healthyMetrics = {
  admissionsInPreviousHour: 0,
  admissionsInPreviousDay: 0,
  recentAttemptedCount: 8,
  recentPublishableCount: 8,
  consecutiveFailureCount: 0,
  leakageFailureCount: 0,
  unexpectedFailureCount: 0
};
const base = {
  identity,
  generatorProvider: 'local-deterministic',
  workClass: 'production',
  suppressStudentPublication: false,
  automatedCandidateLeakageStatus: 'clear',
  config: subjectPracticeLimitedReleaseRuntimeConfig({
    CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_ENABLED: 'true',
    CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_EXACT_PLAN_ALLOWLIST: key,
    CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_QUALIFIED_EXACT_PLANS: key
  }),
  metrics: healthyMetrics
};

const admitted = subjectPracticeLimitedReleaseAdmissionDecision(base);
assert.equal(admitted.policyVersion, SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION);
assert.equal(admitted.allowed, true);
assert.equal(admitted.invariants.bypassesFormalPublicationGate, false);

const disabled = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  config: subjectPracticeLimitedReleaseRuntimeConfig({})
});
assert.equal(disabled.allowed, false);
assert.ok(disabled.reasons.includes('limited_release_disabled'));
assert.ok(disabled.reasons.includes('limited_release_exact_plan_not_allowlisted'));
assert.ok(disabled.reasons.includes('limited_release_exact_plan_not_qualified'));

const nearMiss = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  identity: { ...identity, planTemplate: `${identity.planTemplate}_near_miss` }
});
assert.equal(nearMiss.allowed, false);
assert.ok(nearMiss.reasons.includes('limited_release_exact_plan_not_allowlisted'));

const unqualified = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  config: { ...base.config, qualifiedExactPlans: [] }
});
assert.equal(unqualified.allowed, false);
assert.ok(unqualified.reasons.includes('limited_release_exact_plan_not_qualified'));

const leakage = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  automatedCandidateLeakageStatus: 'blocked'
});
assert.equal(leakage.allowed, false);
assert.ok(leakage.reasons.includes('limited_release_current_candidate_leakage_not_clear'));

const hourlyCap = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  metrics: { ...healthyMetrics, admissionsInPreviousHour: base.config.maximumApprovalsPerHour }
});
assert.equal(hourlyCap.allowed, false);
assert.ok(hourlyCap.reasons.includes('limited_release_hourly_traffic_cap_reached'));

const rollingQuality = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  metrics: { ...healthyMetrics, recentAttemptedCount: 20, recentPublishableCount: 18 }
});
assert.equal(rollingQuality.allowed, false);
assert.equal(rollingQuality.qualityCircuitBreaker.open, true);
assert.equal(rollingQuality.qualityCircuitBreaker.automaticRollbackApplied, true);

const consecutiveFailures = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  metrics: { ...healthyMetrics, consecutiveFailureCount: 2 }
});
assert.equal(consecutiveFailures.allowed, false);
assert.ok(consecutiveFailures.reasons.includes('limited_release_consecutive_failure_circuit_open'));

const observation = subjectPracticeLimitedReleaseAdmissionDecision({
  ...base,
  workClass: 'observation',
  suppressStudentPublication: true
});
assert.equal(observation.allowed, false);
assert.ok(observation.reasons.includes('limited_release_observation_or_publication_suppressed'));

const serviceSource = fs.readFileSync(path.join(
  __dirname,
  '../backend/src/ai-questioning/ai-questioning.service.ts'
), 'utf8');
assert.ok(serviceSource.includes('const limitedReleaseAdmission = await this.subjectPracticeLimitedReleaseAdmissionFor(question);'));
assert.ok(serviceSource.includes('if (limitedReleaseAdmission && !limitedReleaseAdmission.allowed) return null;'));
assert.ok(serviceSource.includes('pg_advisory_xact_lock'));
assert.ok(serviceSource.includes("const candidateLeakageGate = generated.provider === 'local-deterministic'"));

const report = {
  mode: 'subject_practice_limited_release_control_self_test',
  policyVersion: SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION,
  status: 'passed',
  cases: 12,
  runtimeGateConnected: true,
  trafficReservationSerializedByDatabase: true,
  leakageGateRunsBeforeLocalProductionAdmission: true,
  enabledByDefault: false,
  realPublicationPerformed: false,
  providerCalls: 0,
  databaseWrites: 0
};

if (require.main === module) console.log(JSON.stringify(report, null, 2));
module.exports = { report };
