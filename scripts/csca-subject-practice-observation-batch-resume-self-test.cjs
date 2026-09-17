#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  SUBJECT_PRACTICE_OBSERVATION_BATCH_RESUME_POLICY_VERSION,
  subjectPracticeObservationBatchResumePlan
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-resume-policy');

const scopeIds = [
  'math-basic-elementary-rotation-v1:logarithmic:domain',
  'math-basic-elementary-rotation-v1:exponential:range',
  'math-basic-elementary-rotation-v1:radical:monotonicity',
  'math-basic-elementary-rotation-v1:power:function_value'
];

function manifestFor() {
  return buildSubjectPracticeObservationBatchManifest(scopeIds.map((plannedScopeId, index) => ({
    ordinal: index + 1,
    subject: 'math',
    productionRunId: 1,
    productionCellId: 16,
    taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1',
    plannedScopeId
  })));
}

function taskFor(manifest, ordinal, status) {
  return {
    id: `task-${ordinal}`,
    status,
    filterSnapshot: {
      sealedObservationBatch: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: ordinal })
    },
    result: status === 'succeeded' ? { generatedQuestionId: ordinal } : null,
    error: status === 'failed' ? 'fixture_failure' : null
  };
}

function rejects(fn, pattern) {
  try {
    fn();
    return false;
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
}

const manifest = manifestFor();
const partial = subjectPracticeObservationBatchResumePlan({
  manifest,
  existingTasks: [
    taskFor(manifest, 1, 'succeeded'),
    taskFor(manifest, 2, 'failed'),
    taskFor(manifest, 3, 'running')
  ]
});
const resumedAfterActive = subjectPracticeObservationBatchResumePlan({
  manifest,
  existingTasks: [
    taskFor(manifest, 1, 'succeeded'),
    taskFor(manifest, 2, 'failed'),
    taskFor(manifest, 3, 'cancelled')
  ]
});
const complete = subjectPracticeObservationBatchResumePlan({
  manifest,
  existingTasks: scopeIds.map((_, index) => taskFor(manifest, index + 1, index === 1 ? 'failed' : 'succeeded'))
});
const foreignManifest = buildSubjectPracticeObservationBatchManifest([{
  ordinal: 1,
  subject: 'physics',
  productionRunId: 2,
  productionCellId: 24,
  taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1',
  plannedScopeId: 'physics-basic-kinematics-v2:uniform_speed'
}]);
const checks = {
  partialWaitsForActiveWithoutResubmitting:
    partial.status === 'wait_for_existing_active_task'
    && partial.counts.reuseTerminal === 2
    && partial.counts.waitExisting === 1
    && partial.counts.submitMissing === 1,
  terminalFailurePreservedInDenominator:
    partial.items.find((item) => item.ordinal === 2)?.action === 'reuse_terminal'
    && partial.items.find((item) => item.ordinal === 2)?.existingStatus === 'failed'
    && partial.terminalFailuresRemainInDenominator === true,
  resumesOnlyMissingOrdinalAfterActiveTerminates:
    resumedAfterActive.status === 'ready_to_submit_missing_ordinals'
    && resumedAfterActive.items.filter((item) => item.action === 'submit_missing').map((item) => item.ordinal).join(',') === '4',
  completeBatchDoesNoMoreWork:
    complete.status === 'batch_already_terminal'
    && complete.counts.reuseTerminal === 4
    && complete.counts.submitMissing === 0,
  duplicateOrdinalRejected: rejects(() => subjectPracticeObservationBatchResumePlan({
    manifest,
    existingTasks: [taskFor(manifest, 1, 'succeeded'), taskFor(manifest, 1, 'failed')]
  }), /duplicate_ordinal/),
  foreignManifestRejected: rejects(() => subjectPracticeObservationBatchResumePlan({
    manifest,
    existingTasks: [taskFor(foreignManifest, 1, 'succeeded')]
  }), /manifest_binding_mismatch/),
  unknownStatusRejected: rejects(() => subjectPracticeObservationBatchResumePlan({
    manifest,
    existingTasks: [taskFor(manifest, 1, 'paused')]
  }), /task_status_invalid/),
  missingTaskIdRejected: rejects(() => subjectPracticeObservationBatchResumePlan({
    manifest,
    existingTasks: [{ ...taskFor(manifest, 1, 'succeeded'), id: '' }]
  }), /task_id_invalid/)
};

const report = {
  mode: 'subject_practice_observation_batch_resume_self_test',
  policyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_RESUME_POLICY_VERSION,
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  partialPlan: {
    status: partial.status,
    counts: partial.counts
  },
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
