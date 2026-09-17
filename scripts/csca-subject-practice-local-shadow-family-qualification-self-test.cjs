#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const {
  scopeCounts,
  selectQualificationFamily
} = require('./lib/subject-practice-family-qualification-batch.cjs');
const {
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  observationBackendStartCommandFor,
  resumeContextFor,
  targetBackendFailureCodes
} = require('./csca-subject-practice-local-shadow-family-qualification-run.cjs');
const {
  subjectPracticeLocalGeneratorProductionProfileBindingForCell
} = require('../backend/src/ai-questioning/subject-practice-local-generator-production-profile-binding-policy');

const samplesPerScope = 8;
const contracts = subjectPracticeProductionShadowScopeContracts();
const cases = contracts.map((contract) => {
  const items = Array.from({ length: samplesPerScope }, () => contract.expectedScopeIds)
    .flat()
    .map((scopeId, index) => ({ ordinal: index + 1, scopeId, planValid: true }));
  const productionRunId = contract.subject === 'math' ? 1 : contract.subject === 'physics' ? 2 : 3;
  const productionCellId = contract.taskFamily === 'elementary_function_direct_property'
    ? 16
    : contract.taskFamily === 'derivative_direct_evaluation'
      ? 10
    : contract.subject === 'physics'
      ? 24
      : contract.subject === 'chemistry'
        ? 42
        : 91001;
  const family = {
    status: 'batch_plan_ready',
    subject: contract.subject,
    taskFamily: contract.taskFamily,
    planTemplate: contract.planTemplate,
    runId: productionRunId,
    cellId: productionCellId,
    currentCandidateCount: 0,
    items
  };
  const selected = selectQualificationFamily({ families: [family] }, contract, samplesPerScope);
  const productionProfileBinding = subjectPracticeLocalGeneratorProductionProfileBindingForCell({
    subject: contract.subject,
    productionRunId,
    productionCellId
  });
  const manifest = productionProfileBinding
    ? buildSubjectPracticeObservationBatchManifest(items.map((item, index) => ({
      ordinal: index + 1,
      subject: contract.subject,
      productionRunId: family.runId,
      productionCellId: family.cellId,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      plannedScopeId: item.scopeId
    })))
    : null;
  return {
    exactPlan: `${contract.subject}:${contract.taskFamily}:${contract.planTemplate}`,
    expectedScopeCount: contract.expectedScopeIds.length,
    taskCount: items.length,
    balanced: selected.status === 'qualification_batch_ready'
      && contract.expectedScopeIds.every((scopeId) => selected.scopeCounts[scopeId] === samplesPerScope),
    productionProfileBindingRegistered: Boolean(productionProfileBinding),
    manifestAccepted: manifest ? manifest.tasks.length === items.length : false
  };
});
const chemistry = cases.find((item) => item.exactPlan.startsWith('chemistry:'));
const resumeContract = contracts.find((contract) => contract.subject === 'math'
  && contract.taskFamily === 'elementary_function_direct_property');
if (!resumeContract) throw new Error('Math elementary direct-property contract fixture is missing.');
const resumeManifest = buildSubjectPracticeObservationBatchManifest(
  Array.from({ length: samplesPerScope }, () => resumeContract.expectedScopeIds)
    .flat()
    .map((plannedScopeId, index) => ({
      ordinal: index + 1,
      subject: resumeContract.subject,
      productionRunId: 1,
      productionCellId: 16,
      taskFamily: resumeContract.taskFamily,
      planTemplate: resumeContract.planTemplate,
      plannedScopeId
    }))
);
const resumeBatchId = subjectPracticeObservationBatchEnvelopeFor({
  manifest: resumeManifest,
  taskOrdinal: 1
}).batchId;
function resumeTask(ordinal, status) {
  return {
    id: `resume-task-${ordinal}`,
    status,
    filterSnapshot: {
      sealedObservationBatch: subjectPracticeObservationBatchEnvelopeFor({
        manifest: resumeManifest,
        taskOrdinal: ordinal
      })
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
const resumeContext = resumeContextFor(resumeBatchId, [
  resumeTask(1, 'succeeded'),
  resumeTask(2, 'failed')
]);
const statusSwappedResumeContext = resumeContextFor(resumeBatchId, [
  resumeTask(1, 'failed'),
  resumeTask(2, 'succeeded')
]);
const firstContract = contracts[0];
const badFamily = {
  status: 'batch_plan_ready',
  subject: firstContract.subject,
  taskFamily: firstContract.taskFamily,
  planTemplate: firstContract.planTemplate,
  items: firstContract.expectedScopeIds.map((scopeId, index) => ({ ordinal: index + 1, scopeId, planValid: true }))
};
const imbalanced = selectQualificationFamily({ families: [badFamily] }, firstContract, samplesPerScope);
const checks = {
  allProfileBoundFamiliesProduceBalancedQualificationBatch: cases
    .filter((item) => item.productionProfileBindingRegistered)
    .every((item) => item.balanced && item.manifestAccepted),
  unboundFamilyCannotCreateSealedManifest: cases.some((item) => item.exactPlan.includes('math_line_relation_direct')
    && item.balanced
    && !item.productionProfileBindingRegistered
    && !item.manifestAccepted),
  chemistryNeedsAndSupportsFortyEightTasks: chemistry?.taskCount === 48,
  maximumRemainsBounded: Math.max(...cases.map((item) => item.taskCount)) <= SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT,
  imbalancedScopeCoverageRejected: imbalanced.status === 'qualification_batch_invalid',
  resumeRecognizesFullFamilyThirtyTwoTaskManifest:
    resumeContext.resumePlan.expectedTaskCount === 32
    && resumeContext.authorizationPlan.samplesPerScope === 8
    && Object.values(resumeContext.authorizationPlan.scopeCounts).every((count) => count === 8),
  resumeReusesOnlyExistingAndSubmitsOnlyMissing:
    resumeContext.resumePlan.counts.reuseTerminal === 2
    && resumeContext.resumePlan.counts.waitExisting === 0
    && resumeContext.resumePlan.counts.submitMissing === 30,
  resumeDigestExcludesMutableTaskStatuses:
    resumeContext.resumeDigest === statusSwappedResumeContext.resumeDigest,
  resumeRejectsWrongRequestedBatch: rejects(
    () => resumeContextFor('local-shadow-00000000000000000000', [resumeTask(1, 'succeeded')]),
    /Requested batch id does not match/
  ),
  resumeAuthorizationIsZeroProviderCostAndPublicationSuppressed:
    resumeContext.authorizationPlan.providerAttemptLimit === 0
    && resumeContext.authorizationPlan.maximumEstimatedCostUsd === 0
    && resumeContext.authorizationPlan.publicationSuppressed === true,
  backendStartupGuidanceUsesRequestedBaseUrlPortAndExactCell:
    observationBackendStartCommandFor('http://127.0.0.1:3002', 24)
      === 'npm.cmd run backend:dev:observation:local-shadow -- --port=3002 --question-plan-cell-allowlist=24',
  staleDerivativeRuntimeFailsBeforeAnySubmission: [
    'target_backend_production_shadow_scope_registry_stale',
    'target_backend_local_generator_shadow_routing_stale',
    'target_backend_math_derivative_generator_stale',
    'target_backend_math_derivative_solver_stale',
    'target_backend_math_derivative_scope_stale',
    'target_backend_math_derivative_independent_oracle_stale'
  ].every((code) => targetBackendFailureCodes({}, 10, false, false, 'math', 'derivative_direct_evaluation').includes(code)),
  exactEightPerScope: cases.every((item) => Object.values(scopeCounts(
    Array.from({ length: samplesPerScope }, () => contracts.find((contract) =>
      `${contract.subject}:${contract.taskFamily}:${contract.planTemplate}` === item.exactPlan).expectedScopeIds)
      .flat().map((scopeId) => ({ scopeId }))
  )).every((count) => count === samplesPerScope))
};
const report = {
  mode: 'subject_practice_local_shadow_family_qualification_self_test',
  reportVersion: 'subject-practice-local-shadow-family-qualification-self-test-v3-math-derivative-runtime-bound',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  samplesPerScope,
  manifestMaximumTaskCount: SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT,
  cases,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}
module.exports = { report };
