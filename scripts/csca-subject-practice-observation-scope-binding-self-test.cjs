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
  subjectPracticeObservationQuestionPlanRotationInputFor,
  subjectPracticeObservationScopeBindingFor,
  SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-scope-binding-policy');
const {
  buildSubjectPracticeQuestionPlan,
  SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
  SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
  subjectPracticeQuestionPlanGateFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');

const tasks = subjectPracticeProductionShadowScopeContracts().flatMap((contract) =>
  contract.expectedScopeIds.map((plannedScopeId) => ({
    subject: contract.subject,
    productionRunId: contract.subject === 'math' ? 1 : contract.subject === 'physics' ? 2 : 3,
    productionCellId: contract.taskFamily === 'derivative_direct_evaluation'
      ? 10
      : contract.subject === 'math' ? 16 : contract.subject === 'physics' ? 24 : 42,
    taskFamily: contract.taskFamily,
    planTemplate: contract.planTemplate,
    plannedScopeId
  }))
).map((task, index) => ({ ...task, ordinal: index + 1 }));
const manifest = buildSubjectPracticeObservationBatchManifest(tasks);
const bindings = tasks.map((task) => subjectPracticeObservationScopeBindingFor({
  envelope: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: task.ordinal })
}));
const sealedScopePlans = bindings.map((binding, index) => {
  const task = tasks[index];
  const targetDifficulty = task.subject === 'chemistry' ? 'medium' : 'basic';
  const topicTitle = task.taskFamily === 'derivative_direct_evaluation'
    ? '导数与微积分初步'
    : task.subject === 'physics' ? 'kinematics' : task.subject === 'chemistry' ? 'ph' : null;
  const plan = buildSubjectPracticeQuestionPlan({
    subject: task.subject,
    topicTitle,
    productionCellId: task.productionCellId,
    targetDifficulty,
    taskFamily: task.taskFamily,
    planTemplate: task.planTemplate,
    ...subjectPracticeObservationQuestionPlanRotationInputFor(binding)
  });
  return {
    subject: task.subject,
    plannedScopeId: binding.plannedScopeId,
    plan,
    gate: subjectPracticeQuestionPlanGateFor({
      subject: task.subject,
      topicTitle,
      productionCellId: task.productionCellId,
      targetDifficulty,
      taskFamily: task.taskFamily,
      questionPlan: plan,
      targetProfile: {},
      env: {
        [SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]: 'true',
        [SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]: '*'
      }
    })
  };
});
function scenarioSeedsFor(plannedScopeIds, subject, taskFamily, planTemplate, productionCellId) {
  const repeated = plannedScopeIds.map((plannedScopeId, index) => ({
    ordinal: index + 1,
    subject,
    productionRunId: subject === 'physics' ? 2 : 3,
    productionCellId,
    taskFamily,
    planTemplate,
    plannedScopeId
  }));
  const repeatedManifest = buildSubjectPracticeObservationBatchManifest(repeated);
  return repeated.map((task) => subjectPracticeObservationScopeBindingFor({
    envelope: subjectPracticeObservationBatchEnvelopeFor({ manifest: repeatedManifest, taskOrdinal: task.ordinal })
  }).scenarioSeed);
}
const physicsScenarioSeeds = scenarioSeedsFor(
  Array.from({ length: 8 }, () => 'physics-basic-kinematics-v2:uniform_speed'),
  'physics', 'kinematics_basic_direct_relation', 'physics_kinematics_basic_relation_v1', 24
);
const chemistryScenarioSeeds = scenarioSeedsFor(
  Array.from({ length: 8 }, (_, index) => `chemistry-strong-acid-base-v3:strong_acid_dilution:${index % 2 ? 'acid_base_character' : 'ph_value'}`),
  'chemistry', 'ph_dilution_strong_acid_base_neutralization', 'chemistry_strong_acid_base_single_relation_v1', 42
);
let tamperedRejected = false;
try {
  const tamperedManifest = buildSubjectPracticeObservationBatchManifest([
    { ...tasks[0], ordinal: 1, plannedScopeId: 'math-basic-elementary-rotation-v1:unknown:scope' }
  ]);
  subjectPracticeObservationScopeBindingFor({
    envelope: subjectPracticeObservationBatchEnvelopeFor({ manifest: tamperedManifest, taskOrdinal: 1 })
  });
} catch { tamperedRejected = true; }
const checks = {
  everyRegisteredScopeMapsToAuthoritativeRotation: bindings.length === tasks.length
    && bindings.every((binding) => binding.authoritative && Object.values(binding.rotation).some(Boolean)),
  scopeBindingIndependentOfPriorCandidateSuccess: bindings.every((binding) => binding.independentOfPriorCandidateSuccess),
  allFiveExactPlansCovered: new Set(bindings.map((binding) =>
    `${binding.subject}:${binding.taskFamily}:${binding.planTemplate}`)).size === 5,
  sealedScopeBuildsValidSubmissionQuestionPlan:
    sealedScopePlans
      .filter(({ subject, plan }) => subject === 'physics'
        || subject === 'chemistry'
        || plan?.taskFamily === 'derivative_direct_evaluation')
      .every(({ gate }) => gate.validation?.valid === true && gate.generationAllowed === true),
  submissionPlanPolicyVersionIsExplicit:
    SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION
      === 'subject-practice-observation-submission-plan-v2-sealed-scope-before-gate',
  physicsScenarioSeedUsesOccurrenceWithinExactScope:
    JSON.stringify(physicsScenarioSeeds) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]),
  chemistryScenarioSeedSharesRotationAcrossAnswerTargets:
    JSON.stringify(chemistryScenarioSeeds) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]),
  unregisteredScopeRejected: tamperedRejected
};
const report = {
  mode: 'subject_practice_observation_scope_binding_self_test',
  reportVersion: 'subject-practice-observation-scope-binding-self-test-v4-math-derivative',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  failedSealedScopePlans: sealedScopePlans
    .filter(({ subject, plan, gate }) => (subject === 'physics'
      || subject === 'chemistry'
      || plan?.taskFamily === 'derivative_direct_evaluation')
      && (gate.validation?.valid !== true || gate.generationAllowed !== true))
    .map(({ subject, plannedScopeId, gate }) => ({
      subject,
      plannedScopeId,
      mode: gate.mode,
      reasonCodes: gate.reasonCodes,
      validationFailureCodes: gate.validation?.failureCodes
    })),
  bindingCount: bindings.length,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};
if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}
module.exports = { report };
