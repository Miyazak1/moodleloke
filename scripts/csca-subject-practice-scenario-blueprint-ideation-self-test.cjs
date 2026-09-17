#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeScenarioBlueprintIdeationRequestFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');

const binding = {
  subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed',
  difficultyBand: 'basic', targetCognitiveSkill: 'direct_relation_application'
};
const historySummary = {
  dimensionCounts: { scenarioDomain: 6, scenarioEntity: 6, environment: 6, scenarioAction: 4, questionPurpose: 2 },
  underrepresentedDimensions: { scenarioDomain: ['agricultural_monitoring'], environment: ['field_lane'], questionPurpose: ['compare_motion_observations'] },
  concentrationWarnings: ['warehouse_logistics_overrepresented'],
  failureReasonCodes: ['rename_only_structure']
};

function main() {
  const ready = subjectPracticeScenarioBlueprintIdeationRequestFor({ binding, historySummary, requestedCandidateCount: 4 });
  const repeat = subjectPracticeScenarioBlueprintIdeationRequestFor({ binding, historySummary, requestedCandidateCount: 4 });
  const alternateScope = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: { ...binding, exactScope: 'displacement_from_initial_acceleration_time' },
    historySummary,
    requestedCandidateCount: 4
  });
  const reorderedHistory = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding,
    historySummary: {
      failureReasonCodes: [...historySummary.failureReasonCodes].reverse(),
      concentrationWarnings: [...historySummary.concentrationWarnings].reverse(),
      underrepresentedDimensions: {
        questionPurpose: [...historySummary.underrepresentedDimensions.questionPurpose],
        environment: [...historySummary.underrepresentedDimensions.environment],
        scenarioDomain: [...historySummary.underrepresentedDimensions.scenarioDomain]
      },
      dimensionCounts: {
        questionPurpose: 2, scenarioAction: 4, environment: 6, scenarioEntity: 6, scenarioDomain: 6
      }
    },
    requestedCandidateCount: 4
  });
  const sourceContentRejected = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding, historySummary: { ...historySummary, officialQuestionContent: 'forbidden' }
  });
  const answerRejected = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: { ...binding, answer: 'forbidden' }, historySummary
  });
  const countRejected = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding, historySummary, requestedCandidateCount: 20
  });
  const mathRejected = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: { ...binding, subject: 'math', taskFamily: 'elementary_function_direct_property', planTemplate: 'math_elementary_function_relation_v1' },
    historySummary
  });
  const malformedHistoryRejected = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding, historySummary: { ...historySummary, dimensionCounts: { scenarioDomain: 'six' } }
  });
  const chemistryReady = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: {
      subject: 'chemistry', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      planTemplate: 'chemistry_strong_acid_base_single_relation_v1', exactScope: 'strong_acid_dilution',
      difficultyBand: 'medium', targetCognitiveSkill: 'direct_relation_application'
    },
    historySummary: { dimensionCounts: {}, underrepresentedDimensions: {}, concentrationWarnings: [], failureReasonCodes: [] },
    requestedCandidateCount: 4
  });
  const checks = {
    validStructuralInputBuildsBoundedPrompt:
      ready.status === 'ready_for_separately_authorized_shadow_ideation'
      && ready.promptCharacterCount <= ready.maximumPromptCharacters
      && ready.recommendedMaximumOutputTokens === 1_000,
    requestDigestIsCanonicalAndDeterministic:
      ready.requestDigest === repeat.requestDigest
      && ready.requestDigest === reorderedHistory.requestDigest,
    promptForbidsQuestionsAnswersOptionsAndNumbers:
      ready.systemPrompt.includes('no question, answer, options')
      && ready.systemPrompt.includes('number, quantity, or parameter')
      && ready.userPrompt.includes('<=120 chars')
      && ready.userPrompt.includes('no digits/number words')
      && ready.userPrompt.includes('deliver supplies')
      && ready.userPrompt.includes('speed, velocity, acceleration, displacement'),
    promptRequiresCreativeSpecificityBeforePaidMaterialization: (() => {
      const parsedPrompt = JSON.parse(ready.userPrompt);
      return parsedPrompt.fieldRules.questionPurpose.includes('specific scenario decision')
        && parsedPrompt.fieldRules.purposeBan.includes('calculated target')
        && parsedPrompt.outputContract.purposeRule.includes('never instruction text');
    })(),
    promptMirrorsStrictResponseGateContract: (() => {
      const parsedPrompt = JSON.parse(ready.userPrompt);
      const contract = parsedPrompt.outputContract;
      return contract.rawJsonOnly.includes('no markdown')
        && contract.topLevelKeys === 'candidates only'
        && contract.candidateCount === 4
        && contract.exactCandidateKeys === [
          'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment', 'scenarioAction',
          'informationForm', 'questionPurpose', 'contextNecessity', 'surface'
        ].join(',')
        && contract.exactSurfaceKeys === ['zhEntity', 'enEntity', 'zhSetting', 'enSetting'].join(',')
        && contract.fixedValues.scenarioMode.includes('real_world')
        && contract.fixedValues.contextNecessity === 'exactly required_for_solution'
        && contract.batchUniqueness.includes('after ignoring entity names');
    })(),
    chemistryPromptDoesNotInviteMultiSampleComparison: (() => {
      const parsedPrompt = JSON.parse(chemistryReady.userPrompt);
      return parsedPrompt.fieldRules.scenarioEntity.includes('exactly one liquid')
        && parsedPrompt.fieldRules.scenarioAction.includes('no named test method')
        && parsedPrompt.fieldRules.scopeBoundary.includes('no titration')
        && parsedPrompt.fieldRules.scopeBoundary.includes('indicator')
        && parsedPrompt.fieldRules.scopeBoundary.includes('buffer')
        && parsedPrompt.outputContract.purposeRule.includes('never compare samples')
        && !parsedPrompt.outputContract.purposeRule.includes('decision/check/compare');
    })(),
    promptSeparatesCreativityFromScientificTruth:
      ready.modelScientificAuthority === false
      && ready.systemPrompt.includes('downstream deterministic solver and oracle'),
    providerPromptOmitsExactSolverBinding:
      ready.userPrompt === alternateScope.userPrompt
      && ready.requestDigest !== alternateScope.requestDigest
      && !ready.userPrompt.includes('uniform_speed')
      && !ready.userPrompt.includes('kinematics_basic_direct_relation')
      && !ready.userPrompt.includes('physics_kinematics_basic_relation_v1')
      && ready.providerVisibleBindingProjection.scenarioContextClass === 'motion_observation_context',
    onlyStructuralHistoryIsIncluded:
      ready.officialQuestionContentIncluded === false
      && ready.historicalQuestionContentIncluded === false,
    requestDoesNotAuthorizeProviderOrGeneration:
      ready.providerCallAuthorized === false
      && ready.productionGenerationAuthorized === false
      && ready.publicationAuthorized === false,
    sourceContentKeyFailsClosed:
      sourceContentRejected.failureCodes.includes('scenario_ideation_question_or_source_content_forbidden'),
    answerFieldFailsClosed:
      answerRejected.failureCodes.includes('scenario_ideation_question_or_source_content_forbidden'),
    candidateCountIsBounded:
      countRejected.failureCodes.includes('scenario_ideation_candidate_count_out_of_bounds'),
    abstractMathIsNotForcedIntoDynamicContext:
      mathRejected.failureCodes.includes('scenario_ideation_binding_invalid_or_unsupported'),
    malformedCoverageSummaryFailsClosed:
      malformedHistoryRejected.failureCodes.includes('scenario_ideation_history_summary_not_structural')
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_ideation_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-ideation-self-test-v9-method-neutral-chemistry',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_prompt_only', databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
