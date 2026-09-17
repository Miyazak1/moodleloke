'use strict';

const path = require('node:path');

const CSCALITE_HOST_ADAPTER_VERSION = 'cscalite-question-engine-host-adapter-v1';

function createCscaliteHostAdapter(root) {
  const questionPlanPolicy = require(path.join(
    root,
    'backend/src/ai-questioning/subject-practice-question-plan-policy.ts'
  ));
  const scenarioPolicy = require(path.join(
    root,
    'backend/src/ai-questioning/subject-practice-scenario-blueprint-materialization-policy.ts'
  ));
  return Object.freeze({
    adapterVersion: CSCALITE_HOST_ADAPTER_VERSION,
    buildQuestionPlan: questionPlanPolicy.buildSubjectPracticeQuestionPlan,
    ports: Object.freeze({
      validate: questionPlanPolicy.validateSubjectPracticeQuestionPlan,
      adherenceFor: questionPlanPolicy.subjectPracticeQuestionPlanAdherenceFor,
      validateScenario: scenarioPolicy.validateSubjectPracticeProvisionalScenarioContract
    }),
    capabilities: Object.freeze({
      questionPlanBuild: true,
      questionPlanValidation: true,
      questionPlanAdherence: true,
      provisionalScenarioValidation: true,
      databaseAccess: false,
      providerAccess: false,
      publicationAccess: false
    })
  });
}

module.exports = Object.freeze({
  CSCALITE_HOST_ADAPTER_VERSION,
  createCscaliteHostAdapter
});
