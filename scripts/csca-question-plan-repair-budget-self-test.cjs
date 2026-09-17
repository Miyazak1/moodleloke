require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
  buildSubjectPracticeQuestionPlan,
  repairSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAttemptFor,
  subjectPracticeQuestionPlanFailureRouteFor,
  subjectPracticeQuestionPlanGateFor,
  subjectPracticeQuestionPlanRepairBudgetDecisionFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function main() {
  const plan = buildSubjectPracticeQuestionPlan({
    subject: 'chemistry',
    topicId: 7,
    topicTitle: 'lab experiment',
    productionCellId: 593,
    targetDifficulty: 'hard',
    taskFamily: 'hard_experimental_evidence_chain'
  });
  assert(plan, 'Registered hard-lab QuestionPlan fixture must exist.');
  const invalidPlan = { ...plan, evidenceSlots: [] };
  const repaired = repairSubjectPracticeQuestionPlan({
    questionPlan: invalidPlan,
    subject: 'chemistry',
    topicId: 7,
    topicTitle: 'lab experiment',
    productionCellId: 593,
    targetDifficulty: 'hard',
    taskFamily: 'hard_experimental_evidence_chain'
  });
  assertEqual(repaired.status, 'repaired', 'Registered same-family Plan repair must pass.');
  assertEqual(repaired.budget.used, 1, 'Same-family repair must consume one local attempt.');
  assertEqual(repaired.validation.valid, true, 'Repaired Plan must pass deterministic validation.');

  const fallback = repairSubjectPracticeQuestionPlan({
    questionPlan: { ...invalidPlan, taskFamily: 'unsupported_family' },
    subject: 'chemistry',
    topicTitle: 'lab experiment',
    productionCellId: 593,
    targetDifficulty: 'hard',
    taskFamily: 'unsupported_family'
  });
  assertEqual(fallback.status, 'repaired', 'Default registered-family fallback must repair on its bounded second strategy.');
  assertEqual(fallback.budget.used, 2, 'Default-family fallback must expose two consumed local attempts.');

  const zeroBudget = repairSubjectPracticeQuestionPlan({
    questionPlan: { ...invalidPlan, budget: { maxPlanRepairs: 0, maxCandidateRepairs: 1 } },
    subject: 'chemistry',
    topicTitle: 'lab experiment',
    productionCellId: 593,
    targetDifficulty: 'hard'
  });
  assertEqual(zeroBudget.status, 'repair_budget_exhausted', 'Zero Plan-repair budget must fail closed.');
  assertEqual(zeroBudget.attempts.length, 0, 'Zero Plan-repair budget must perform no rebuild.');

  const unavailable = repairSubjectPracticeQuestionPlan({
    questionPlan: { schemaVersion: 'invalid' },
    subject: 'unknown',
    topicTitle: 'unregistered topic',
    productionCellId: 999,
    targetDifficulty: 'hard'
  });
  assertEqual(unavailable.status, 'unrepairable', 'Unregistered Plan repair must remain fail-closed.');
  assertEqual(unavailable.providerImpact, 'none_no_provider_call', 'Unregistered Plan repair must not call Provider.');

  const gate = subjectPracticeQuestionPlanGateFor({
    subject: 'chemistry',
    topicTitle: 'lab experiment',
    productionCellId: 593,
    targetDifficulty: 'hard',
    questionPlan: plan,
    env: { [SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]: 'true' }
  });
  const candidateRoute = subjectPracticeQuestionPlanFailureRouteFor({
    adherence: { adheres: false, failureCodes: ['candidate_plan_observation_evidence_missing'] },
    reviewStatus: 'needs_review'
  });
  const originalFailure = subjectPracticeQuestionPlanAttemptFor({
    attemptId: 'qpa-repair-budget-original',
    attemptIndex: 1,
    phase: 'candidate_evaluated',
    gate,
    questionPlan: plan,
    adherence: { adheres: false },
    failureRoute: candidateRoute
  });
  assertEqual(subjectPracticeQuestionPlanRepairBudgetDecisionFor({ attempt: originalFailure }).status, 'repair_allowed', 'Original render failure must allow one rerender.');
  const rerenderQueued = subjectPracticeQuestionPlanAttemptFor({
    attemptId: 'qpa-repair-budget-rerender',
    attemptIndex: 2,
    phase: 'enqueue',
    gate,
    questionPlan: plan,
    previousAttempt: originalFailure
  });
  assertEqual(rerenderQueued.budget.candidateRepairCount, 1, 'Rerender enqueue must increment the lineage repair count.');
  const rerenderFailure = subjectPracticeQuestionPlanAttemptFor({
    attemptId: 'qpa-repair-budget-rerender',
    attemptIndex: 2,
    phase: 'candidate_evaluated',
    gate,
    questionPlan: plan,
    adherence: { adheres: false },
    failureRoute: candidateRoute,
    previousAttempt: rerenderQueued
  });
  const exhausted = subjectPracticeQuestionPlanRepairBudgetDecisionFor({ attempt: rerenderFailure });
  assertEqual(exhausted.status, 'repair_budget_exhausted', 'A second candidate rerender must be blocked.');
  assertEqual(exhausted.reasonCode, 'question_plan_candidate_repair_budget_exhausted', 'Exhausted rerender must expose the stable stop reason.');

  const report = {
    mode: 'question_plan_repair_budget_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    sampleCount: 7,
    checks: {
      sameFamilyRepair: repaired.status,
      defaultFamilyFallback: fallback.status,
      zeroBudget: zeroBudget.status,
      unavailableTemplate: unavailable.status,
      firstCandidateRerender: 'repair_allowed',
      secondCandidateRerender: exhausted.status,
      hardCaps: { maxPlanRepairs: 2, maxCandidateRepairs: 1 }
    }
  };
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else console.log(`QuestionPlan repair/budget self-test: ${report.status}, samples=${report.sampleCount}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
