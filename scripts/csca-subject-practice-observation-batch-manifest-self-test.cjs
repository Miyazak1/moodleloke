#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const assert = require('node:assert/strict');
const {
  buildSubjectPracticeObservationBatchManifest,
  buildSubjectPracticeObservationCampaignManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  assertSubjectPracticeObservationBatchEnvelope,
  SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT,
  subjectPracticeObservationExpectedGeneratorVersionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');

const tasks = [
  {
    ordinal: 1, subject: 'math', productionRunId: 1, productionCellId: 16,
    taskFamily: 'elementary_function_direct_property', planTemplate: 'math_elementary_function_relation_v1',
    plannedScopeId: 'math-basic-elementary-rotation-v1:power:function_value'
  },
  {
    ordinal: 2, subject: 'physics', productionRunId: 2, productionCellId: 24,
    taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'physics_kinematics_basic_relation_v1',
    plannedScopeId: 'physics-basic-kinematics-v2:uniform_speed'
  }
];
const manifest = buildSubjectPracticeObservationBatchManifest(tasks);
const envelope = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
const campaignManifest = buildSubjectPracticeObservationCampaignManifest(tasks, 'physics-dynamic-v1-20260914');
const campaignEnvelope = subjectPracticeObservationBatchEnvelopeFor({ manifest: campaignManifest, taskOrdinal: 1 });
const verified = assertSubjectPracticeObservationBatchEnvelope({
  envelope,
  currentTask: tasks[0]
});
assert.equal(verified.manifestSha256, envelope.manifestSha256);
assert.equal(verified.expectedTaskCount, 2);
assert.notEqual(campaignEnvelope.batchId, envelope.batchId);
assert.equal(campaignEnvelope.manifest.campaignId, 'physics-dynamic-v1-20260914');
assert.equal(subjectPracticeObservationBatchEnvelopeFor({
  manifest: buildSubjectPracticeObservationCampaignManifest(tasks, 'physics-dynamic-v1-20260914'),
  taskOrdinal: 1
}).batchId, campaignEnvelope.batchId);
assert.notEqual(subjectPracticeObservationBatchEnvelopeFor({
  manifest: buildSubjectPracticeObservationCampaignManifest(tasks, 'physics-dynamic-v2-20260914'),
  taskOrdinal: 1
}).batchId, campaignEnvelope.batchId);
assert.throws(() => buildSubjectPracticeObservationCampaignManifest(tasks, '../invalid'), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: { ...campaignEnvelope, manifest: { ...campaignManifest, campaignId: 'tampered-campaign' } },
  currentTask: tasks[0]
}), /binding_invalid/);

assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: { ...envelope, manifestSha256: '0'.repeat(64) }, currentTask: tasks[0]
}), /binding_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, scenarioSelectionPolicyVersion: 'tampered-selection-policy' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, productionProfileBindingPolicyVersion: 'tampered-production-profile-binding' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, localGeneratorRegistryPolicyVersion: 'tampered-generator-registry' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, difficultyEvidencePolicyVersion: 'tampered-difficulty-evidence' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, outputIdentityPolicyVersion: 'classifier-derived-family' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: { ...manifest, executionAdmissionPolicyVersion: 'pre-fix-zero-provider-job-admission' }
  },
  currentTask: tasks[0]
}), /header_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope, currentTask: { ...tasks[0], productionCellId: 17 }
}), /current_task_not_in_manifest/);
assert.throws(() => buildSubjectPracticeObservationBatchManifest([
  { ...tasks[0], ordinal: 2 }, { ...tasks[1], ordinal: 2 }
]), /ordinals_not_contiguous/);
const boundedTasks = Array.from(
  { length: SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT },
  (_, index) => ({ ...tasks[0], ordinal: index + 1 })
);
assert.equal(buildSubjectPracticeObservationBatchManifest(boundedTasks).tasks.length, 64);
assert.throws(() => buildSubjectPracticeObservationBatchManifest([
  ...boundedTasks,
  { ...tasks[0], ordinal: SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT + 1 }
]), /header_invalid/);
assert.equal(
  subjectPracticeObservationExpectedGeneratorVersionFor(tasks[1]),
  'physics-kinematics-local-generator-v3-semantic-options'
);
assert.equal(
  manifest.tasks[1].expectedGeneratorVersion,
  'physics-kinematics-local-generator-v3-semantic-options'
);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: {
      ...manifest,
      tasks: manifest.tasks.map((task, index) => index === 1
        ? { ...task, expectedGeneratorVersion: 'physics-kinematics-local-generator-v2-scenario' }
        : task)
    }
  },
  currentTask: tasks[0]
}), /task_invalid/);
assert.throws(() => assertSubjectPracticeObservationBatchEnvelope({
  envelope: {
    ...envelope,
    manifest: {
      ...manifest,
      tasks: manifest.tasks.map((task, index) => index === 0
        ? { ...task, productionProfileBindingDigest: '0'.repeat(64) }
        : task)
    }
  },
  currentTask: tasks[0]
}), /task_invalid/);
assert.throws(() => buildSubjectPracticeObservationBatchManifest([{
  ...tasks[0],
  planTemplate: 'unsupported_plan_template'
}]), /task_invalid/);

const report = {
  mode: 'subject_practice_observation_batch_manifest_self_test',
  reportVersion: 'subject-practice-observation-batch-manifest-self-test-v11-campaign-backward-compatible',
  status: 'passed',
  checks: {
    deterministicFullSha256Binding: true,
    scenarioPolicyAndSelectionBoundIntoManifestHash: true,
    executionAdmissionPolicyBoundIntoManifestHash: true,
    planBoundOutputIdentityPolicyBoundIntoManifestHash: true,
    localGeneratorRegistryPolicyBoundIntoManifestHash: true,
    difficultyEvidencePolicyBoundIntoManifestHash: true,
    productionProfileBindingPolicyBoundIntoManifestHash: true,
    exactProductionProfileDigestStoredInTaskDescriptor: true,
    productionProfileDigestTamperRejected: true,
    exactGeneratorVersionResolvedForSupportedPlan: true,
    exactGeneratorVersionStoredInHashedTaskDescriptor: true,
    taskDescriptorGeneratorVersionTamperRejected: true,
    unsupportedExactPlanRejected: true,
    contiguousUniqueOrdinalsRequired: true,
    currentTaskMustMatchPrecommittedDescriptor: true,
    taskCountBoundBeforeExecution: true,
    fullScopeQualificationBatchCapacity: SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT === 64,
    campaignIdentityCreatesDeterministicIndependentBatch: true,
    campaignTamperAndInvalidCampaignRejected: true
  },
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};
if (require.main === module) console.log(JSON.stringify(report, null, 2));
module.exports = { report };
