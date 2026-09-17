#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeScenarioBlueprintIdeationRequestFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');
const {
  subjectPracticeScenarioBlueprintResponseGateFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-response-policy');

const request = subjectPracticeScenarioBlueprintIdeationRequestFor({
  binding: {
    subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
    planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed',
    difficultyBand: 'basic', targetCognitiveSkill: 'direct_relation_application'
  },
  historySummary: {
    dimensionCounts: { scenarioDomain: 6 },
    underrepresentedDimensions: { scenarioDomain: ['agricultural_monitoring'] },
    concentrationWarnings: [], failureReasonCodes: []
  },
  requestedCandidateCount: 2
});
const first = {
  scenarioMode: 'real_world', scenarioDomain: 'harbor logistics',
  scenarioEntity: 'autonomous carrier', environment: 'straight loading lane',
  scenarioAction: 'transport along a marked route', informationForm: 'motion observations in text',
  questionPurpose: 'infer a direct kinematics relation', contextNecessity: 'required_for_solution',
  surface: { zhEntity: '自动运输车', enEntity: 'autonomous carrier', zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor' }
};
const second = {
  scenarioMode: 'real_world', scenarioDomain: 'agricultural monitoring',
  scenarioEntity: 'field rover', environment: 'straight crop inspection lane',
  scenarioAction: 'inspect a marked crop row', informationForm: 'sensor observations in text',
  questionPurpose: 'infer a motion relation for inspection timing', contextNecessity: 'required_for_solution',
  surface: { zhEntity: '田间巡检车', enEntity: 'field rover', zhSetting: '笔直作物巡检通道', enSetting: 'a straight crop inspection lane' }
};
function responseFor(candidates) {
  return JSON.stringify({ candidates });
}

function main() {
  const accepted = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: responseFor([first, second]) });
  const duplicate = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: responseFor([first, first]) });
  const renameOnly = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request,
    rawResponse: responseFor([first, { ...first, scenarioEntity: 'delivery robot', surface: { ...first.surface, zhEntity: '配送机器人', enEntity: 'delivery robot' } }])
  });
  const numeric = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request, rawResponse: responseFor([first, { ...second, scenarioAction: 'inspect for 20 seconds' }])
  });
  const answer = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request, rawResponse: responseFor([first, { ...second, answer: 'fast' }])
  });
  const copiedInstruction = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request,
    rawResponse: responseFor([first, {
      ...second,
      questionPurpose: 'interpret generic observations without naming a calculated target'
    }])
  });
  const actionAsPurpose = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request,
    rawResponse: responseFor([first, { ...second, questionPurpose: second.scenarioAction }])
  });
  const exactPhysicsSolverSemantics = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request,
    rawResponse: responseFor([first, {
      ...second,
      questionPurpose: 'calculate acceleration from the velocity change'
    }])
  });
  const physicsSolverAliasVariants = [
    'infer the rate of motion',
    'infer the change in position',
    'determine how quickly the carrier moves',
    '分析位置变化'
  ].map((questionPurpose) => subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: request,
    rawResponse: responseFor([first, { ...second, questionPurpose }])
  }));
  const chemistryRequest = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: {
      subject: 'chemistry', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      planTemplate: 'chemistry_strong_acid_base_single_relation_v1', exactScope: 'strong_acid_concentration',
      difficultyBand: 'medium', targetCognitiveSkill: 'direct_relation_application'
    },
    historySummary: {
      dimensionCounts: {}, underrepresentedDimensions: {}, concentrationWarnings: [], failureReasonCodes: []
    },
    requestedCandidateCount: 2
  });
  const chemistryFirst = {
    ...first,
    scenarioDomain: 'laboratory quality control', scenarioEntity: 'solution sample',
    environment: 'controlled laboratory workspace', scenarioAction: 'assess a prepared sample',
    informationForm: 'laboratory observations in text', questionPurpose: 'infer a direct chemical relation',
    surface: { zhEntity: '待测溶液样品', enEntity: 'solution sample', zhSetting: '受控实验室工作区', enSetting: 'a controlled laboratory workspace' }
  };
  const chemistrySecond = {
    ...second,
    scenarioDomain: 'process monitoring', scenarioEntity: 'process sample',
    environment: 'quality inspection station', scenarioAction: 'inspect a process sample',
    informationForm: 'process observations in text', questionPurpose: 'infer a chemical relation for quality assessment',
    surface: { zhEntity: '工艺样品', enEntity: 'process sample', zhSetting: '质量检验工位', enSetting: 'a quality inspection station' }
  };
  const exactChemistrySolverSemantics = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: chemistryRequest,
    rawResponse: responseFor([chemistryFirst, {
      ...chemistrySecond,
      scenarioAction: 'measure the pH after dilution'
    }])
  });
  const chemistrySolverAliasVariants = [
    'assess sample acidity',
    'infer hydronium behavior',
    'infer amount per litre',
    '分析溶液酸性'
  ].map((questionPurpose) => subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: chemistryRequest,
    rawResponse: responseFor([chemistryFirst, { ...chemistrySecond, questionPurpose }])
  }));
  const incompatibleChemistryContext = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: chemistryRequest,
    rawResponse: responseFor([chemistryFirst, {
      ...chemistrySecond,
      scenarioDomain: 'environmental monitoring',
      scenarioEntity: 'freshwater pond',
      scenarioAction: 'track a visible change across repeated visits',
      questionPurpose: 'explain the observed pattern using recorded conditions'
    }])
  });
  const liveRejectedCandidates = [
    {
      scenarioMode: 'experimental', scenarioDomain: 'titration monitoring',
      scenarioEntity: 'unknown liquid sample', environment: 'analytical laboratory bench',
      scenarioAction: 'analyze a liquid sample during a controlled procedure', informationForm: 'continuous instrument readings and observed endpoint change',
      questionPurpose: 'decide whether the procedure reached its intended completion point', contextNecessity: 'required_for_solution',
      surface: { zhEntity: '未知液体样品', enEntity: 'unknown liquid sample', zhSetting: '分析实验室工作台', enSetting: 'analytical laboratory bench' }
    },
    {
      scenarioMode: 'real_world', scenarioDomain: 'water quality assessment',
      scenarioEntity: 'treated water aliquot', environment: 'municipal water testing facility',
      scenarioAction: 'assess a treated water aliquot before release', informationForm: 'recorded sensor output and operator notes',
      questionPurpose: 'compare two aliquots to determine which requires further treatment', contextNecessity: 'required_for_solution',
      surface: { zhEntity: '处理后水样', enEntity: 'treated water aliquot', zhSetting: '市政水质检测设施', enSetting: 'municipal water testing facility' }
    },
    {
      scenarioMode: 'hypothetical', scenarioDomain: 'process stream adjustment',
      scenarioEntity: 'reagent solution', environment: 'simulated industrial process stream',
      scenarioAction: 'adjust a reagent solution to a target condition', informationForm: 'initial measured state and desired final state',
      questionPurpose: 'explain why the adjustment direction must change', contextNecessity: 'required_for_solution',
      surface: { zhEntity: '试剂溶液', enEntity: 'reagent solution', zhSetting: '模拟工业流程', enSetting: 'simulated industrial process stream' }
    },
    {
      scenarioMode: 'experimental', scenarioDomain: 'sample preparation verification',
      scenarioEntity: 'prepared solution batch', environment: 'controlled preparation hood',
      scenarioAction: 'inspect a prepared solution batch for consistency', informationForm: 'paired readings from replicate preparations',
      questionPurpose: 'check whether two prepared batches agree within acceptable variation', contextNecessity: 'required_for_solution',
      surface: { zhEntity: '配制的溶液批次', enEntity: 'prepared solution batch', zhSetting: '受控配制通风柜', enSetting: 'controlled preparation hood' }
    }
  ];
  const liveRejectedRequest = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding: chemistryRequest.binding,
    historySummary: chemistryRequest.requestPayload.historySummary,
    requestedCandidateCount: 4
  });
  const liveRejectedRegression = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: liveRejectedRequest,
    rawResponse: responseFor(liveRejectedCandidates)
  });
  const singleSampleReferenceCheck = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: chemistryRequest,
    rawResponse: responseFor([chemistryFirst, {
      ...chemistrySecond,
      scenarioAction: 'assess a process sample against a release standard',
      questionPurpose: 'check the measured observation against a reference specification'
    }])
  });
  const secondLiveRejectedRegression = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: liveRejectedRequest,
    rawResponse: responseFor([
      {
        scenarioMode: 'experimental', scenarioDomain: 'solution preparation',
        scenarioEntity: 'aqueous sample', environment: 'controlled laboratory bench',
        scenarioAction: 'prepare a single aqueous sample by dissolving a solute into a solvent portion',
        informationForm: 'observed change in a physical property of the resulting liquid',
        questionPurpose: 'decide whether the preparation step produced the intended solution state from the observed property change',
        contextNecessity: 'required_for_solution',
        surface: { zhEntity: '水溶液样品', enEntity: 'aqueous sample', zhSetting: '受控实验台', enSetting: 'controlled laboratory bench' }
      },
      {
        scenarioMode: 'real_world', scenarioDomain: 'water quality assessment',
        scenarioEntity: 'drinking water aliquot', environment: 'municipal water testing station',
        scenarioAction: 'assess a single water aliquot with a reagent strip',
        informationForm: 'color response of the strip after contact with the aliquot',
        questionPurpose: 'determine whether the water aliquot meets a treatment-process condition based on the strip response',
        contextNecessity: 'required_for_solution',
        surface: { zhEntity: '饮用水样', enEntity: 'drinking water aliquot', zhSetting: '市政水质检测站', enSetting: 'municipal water testing station' }
      },
      {
        scenarioMode: 'hypothetical', scenarioDomain: 'reagent solution stability',
        scenarioEntity: 'buffered reagent solution', environment: 'sealed storage vessel',
        scenarioAction: 'treat a single buffered reagent solution with a stabilizing additive',
        informationForm: 'qualitative observation of precipitate formation over time',
        questionPurpose: 'explain whether the additive maintained the intended solution behavior given the observed precipitate',
        contextNecessity: 'required_for_solution',
        surface: { zhEntity: '缓冲试剂溶液', enEntity: 'buffered reagent solution', zhSetting: '密封储存容器', enSetting: 'sealed storage vessel' }
      },
      {
        scenarioMode: 'experimental', scenarioDomain: 'sample analysis',
        scenarioEntity: 'process water sample', environment: 'analytical chemistry laboratory',
        scenarioAction: 'analyze a single process water sample using an indicator-based test',
        informationForm: 'recorded indicator color transition of the sample',
        questionPurpose: 'check whether the sample belongs to the expected process stream based on the indicator transition',
        contextNecessity: 'required_for_solution',
        surface: { zhEntity: '工艺水样', enEntity: 'process water sample', zhSetting: '分析化学实验室', enSetting: 'analytical chemistry laboratory' }
      }
    ])
  });
  const wrongCount = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: responseFor([first]) });
  const markdown = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: `\`\`\`json\n${responseFor([first, second])}\n\`\`\`` });
  const malformed = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: '{bad json' });
  const tamperedRequest = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: { ...request, status: 'rejected' }, rawResponse: responseFor([first, second])
  });
  const digestTamperedRequest = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: {
      ...request,
      requestPayload: {
        ...request.requestPayload,
        binding: { ...request.requestPayload.binding, exactScope: 'displacement_from_initial_acceleration_time' }
      }
    },
    rawResponse: responseFor([first, second])
  });
  const checks = {
    exactValidBatchAccepted:
      accepted.status === 'accepted_provisional_blueprint_batch'
      && accepted.acceptedCandidateCount === 2,
    acceptedBatchRetainsOnlyValidatedBlueprints:
      accepted.blueprints.every((item) => item.status === 'provisional_candidate')
      && accepted.rawResponseRetained === false,
    acceptedEvidenceBindsRequestAndAllOrdinals:
      /^[a-f0-9]{64}$/.test(accepted.responseEvidenceDigest),
    exactDuplicateRejectsEntireBatch:
      duplicate.blockers.includes('scenario_blueprint_response_within_batch_duplicate')
      && duplicate.acceptedCandidateCount === 0,
    renameOnlyRejectsEntireBatch:
      renameOnly.blockers.includes('scenario_blueprint_response_within_batch_rename_only')
      && renameOnly.cherryPickingAllowed === false,
    numericCandidateRejectsEntireBatch:
      numeric.blockers.includes('scenario_blueprint_response_candidate_invalid'),
    answerFieldRejectsEntireBatch:
      answer.blockers.includes('scenario_blueprint_response_candidate_invalid'),
    copiedPromptInstructionRejectsEntireBatchBeforeMaterialization:
      copiedInstruction.blockers.includes('scenario_blueprint_response_candidate_invalid')
      && copiedInstruction.candidateDiagnostics[1].failureCodes.includes('scenario_blueprint_question_purpose_not_specific'),
    questionPurposeMatchingActionRejectsEntireBatch:
      actionAsPurpose.blockers.includes('scenario_blueprint_response_candidate_invalid')
      && actionAsPurpose.candidateDiagnostics[1].failureCodes.includes('scenario_blueprint_question_purpose_not_specific'),
    exactPhysicsSolverSemanticsRejectEntireBatch:
      exactPhysicsSolverSemantics.blockers.includes('scenario_blueprint_response_candidate_invalid'),
    physicsSolverSemanticAliasesRejectEntireBatch:
      physicsSolverAliasVariants.every((result) =>
        result.blockers.includes('scenario_blueprint_response_candidate_invalid')),
    exactChemistrySolverSemanticsRejectEntireBatch:
      exactChemistrySolverSemantics.blockers.includes('scenario_blueprint_response_candidate_invalid'),
    chemistrySolverSemanticAliasesRejectEntireBatch:
      chemistrySolverAliasVariants.every((result) =>
        result.blockers.includes('scenario_blueprint_response_candidate_invalid')),
    chemistryIncompatibleContextRejectsEntireBatch:
      incompatibleChemistryContext.blockers.includes('scenario_blueprint_response_candidate_invalid')
      && incompatibleChemistryContext.candidateDiagnostics[1].failureCodes
        .includes('scenario_blueprint_chemistry_context_incompatible'),
    liveProviderFailureRejectsEntireBatchWithoutCherryPicking:
      liveRejectedRegression.acceptedCandidateCount === 0
      && liveRejectedRegression.cherryPickingAllowed === false
      && liveRejectedRegression.blockers.includes('scenario_blueprint_response_candidate_invalid'),
    liveProviderTitrationAndMultiSampleStructuresRejected:
      liveRejectedRegression.candidateDiagnostics[0].failureCodes
        .includes('scenario_blueprint_chemistry_unsupported_procedure')
      && liveRejectedRegression.candidateDiagnostics[1].failureCodes
        .includes('scenario_blueprint_chemistry_multi_sample_structure')
      && liveRejectedRegression.candidateDiagnostics[3].failureCodes
        .includes('scenario_blueprint_chemistry_multi_sample_structure')
      && [0, 1, 3].every((index) => liveRejectedRegression.candidateDiagnostics[index].failureCodes
        .includes('scenario_blueprint_chemistry_out_of_scope_structure')),
    liveProviderSingleSampleProcessBlueprintNotFalselyRejected:
      !liveRejectedRegression.candidateDiagnostics[2].failureCodes
        .includes('scenario_blueprint_chemistry_context_incompatible'),
    singleSampleReferenceCheckRemainsCompatible:
      singleSampleReferenceCheck.status === 'accepted_provisional_blueprint_batch'
      && singleSampleReferenceCheck.acceptedCandidateCount === 2,
    secondLiveProviderBatchRejectsAllMethodSpecificStructures:
      secondLiveRejectedRegression.acceptedCandidateCount === 0
      && secondLiveRejectedRegression.candidateDiagnostics.length === 4
      && secondLiveRejectedRegression.candidateDiagnostics.every((diagnostic) =>
        diagnostic.failureCodes.includes('scenario_blueprint_chemistry_unsupported_procedure')),
    exactCandidateCountRequired:
      wrongCount.blockers.includes('scenario_blueprint_response_candidate_count_mismatch'),
    markdownWrapperRejected:
      markdown.blockers.includes('scenario_blueprint_response_markdown_wrapper_forbidden'),
    malformedJsonRejected:
      malformed.blockers.includes('scenario_blueprint_response_json_invalid'),
    requestContractCannotBeBypassed:
      tamperedRequest.blockers.includes('scenario_blueprint_response_request_contract_invalid'),
    requestDigestIsRecomputedBeforeResponseAcceptance:
      digestTamperedRequest.blockers.includes('scenario_blueprint_response_request_contract_invalid'),
    responseGateAuthorizesNothing:
      accepted.providerCallAuthorized === false
      && accepted.productionGenerationAuthorized === false
      && accepted.publicationAuthorized === false
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_response_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-response-self-test-v8-two-live-chemistry-regressions',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
