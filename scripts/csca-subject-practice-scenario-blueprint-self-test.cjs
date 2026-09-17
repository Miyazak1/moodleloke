#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION,
  subjectPracticeScenarioBlueprintNoveltyFor,
  subjectPracticeScenarioBlueprintProposalFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-policy');

const physicsBinding = {
  subject: 'physics',
  taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1',
  exactScope: 'uniform_speed'
};
const proposal = {
  scenarioMode: 'real_world',
  scenarioDomain: 'harbor logistics',
  scenarioEntity: 'autonomous carrier',
  environment: 'straight loading lane',
  scenarioAction: 'transport along a marked route',
  informationForm: 'motion observations in text',
  questionPurpose: 'infer a direct kinematics relation',
  contextNecessity: 'required_for_solution',
  surface: {
    zhEntity: '自动运输车',
    enEntity: 'autonomous carrier',
    zhSetting: '港区直线装卸通道',
    enSetting: 'a straight loading lane in a harbor'
  }
};

function main() {
  const accepted = subjectPracticeScenarioBlueprintProposalFor({ binding: physicsBinding, proposal });
  const exactNovelty = subjectPracticeScenarioBlueprintNoveltyFor({
    blueprint: accepted,
    historicalSummaries: [{
      blueprintFingerprint: accepted.blueprintFingerprint,
      renameInvariantFingerprint: accepted.renameInvariantFingerprint
    }]
  });
  const renamed = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: {
      ...proposal,
      scenarioEntity: 'delivery robot',
      surface: { ...proposal.surface, zhEntity: '配送机器人', enEntity: 'delivery robot' }
    }
  });
  const renameNovelty = subjectPracticeScenarioBlueprintNoveltyFor({
    blueprint: renamed,
    historicalSummaries: [{
      blueprintFingerprint: accepted.blueprintFingerprint,
      renameInvariantFingerprint: accepted.renameInvariantFingerprint
    }]
  });
  const novel = subjectPracticeScenarioBlueprintNoveltyFor({ blueprint: accepted, historicalSummaries: [] });
  const numericRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: { ...proposal, scenarioAction: 'travel for 20 seconds' }
  });
  const truthRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: { ...proposal, answer: 'fast' }
  });
  const nonStringRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: { ...proposal, scenarioAction: { action: 'transport' } }
  });
  const overlongRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: { ...proposal, scenarioAction: 'x'.repeat(121) }
  });
  const nonStringSurfaceRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: physicsBinding,
    proposal: { ...proposal, surface: { ...proposal.surface, enSetting: ['loading lane'] } }
  });
  const mathRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: {
      subject: 'math',
      taskFamily: 'elementary_function_direct_property',
      planTemplate: 'math_elementary_function_relation_v1',
      exactScope: 'range'
    },
    proposal
  });
  const contentHistoryRejected = subjectPracticeScenarioBlueprintNoveltyFor({
    blueprint: accepted,
    historicalSummaries: [{
      blueprintFingerprint: 'x',
      renameInvariantFingerprint: 'y',
      prompt: 'forbidden question content'
    }]
  });
  const malformedHistoryRejected = subjectPracticeScenarioBlueprintNoveltyFor({
    blueprint: accepted,
    historicalSummaries: 'not-an-array'
  });
  const chemistryAccepted = subjectPracticeScenarioBlueprintProposalFor({
    binding: {
      subject: 'chemistry',
      taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      planTemplate: 'chemistry_strong_acid_base_single_relation_v1',
      exactScope: 'strong_acid_dilution'
    },
    proposal: {
      scenarioMode: 'experimental',
      scenarioDomain: 'materials testing',
      scenarioEntity: 'solution sample',
      environment: 'controlled preparation bench',
      scenarioAction: 'prepare a process sample for comparison',
      informationForm: 'procedure observations in text',
      questionPurpose: 'infer a direct chemical relation',
      contextNecessity: 'required_for_solution',
      surface: {
        zhEntity: '溶液样品',
        enEntity: 'solution sample',
        zhSetting: '受控配制台',
        enSetting: 'a controlled preparation bench'
      }
    }
  });
  const missingScopeRejected = subjectPracticeScenarioBlueprintProposalFor({
    binding: { ...physicsBinding, exactScope: '' },
    proposal
  });
  const checks = {
    validPhysicsBlueprintBecomesProvisionalOnly:
      accepted.status === 'provisional_candidate'
      && accepted.eligibleForProductionGeneration === false
      && accepted.eligibleForStablePromotion === false,
    proposalContainsNoModelScientificAuthority:
      accepted.modelMayChooseScientificTruth === false
      && accepted.numericContentAllowedAtProposalStage === false
      && accepted.requiresSolverOracleValidation === true,
    fingerprintsAreDeterministicAndVersioned:
      accepted.blueprintFingerprint.startsWith('blueprint-')
      && accepted.renameInvariantFingerprint.startsWith('blueprint-structure-')
      && accepted.policyVersion === SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION,
    exactHistoryDuplicateRejected: exactNovelty.status === 'rejected_exact_duplicate',
    entityRenameOnlyRejected:
      renamed.status === 'provisional_candidate'
      && renamed.blueprintFingerprint !== accepted.blueprintFingerprint
      && renamed.renameInvariantFingerprint === accepted.renameInvariantFingerprint
      && renameNovelty.status === 'rejected_rename_only',
    emptyStructuralHistoryAcceptsNovelCandidate:
      novel.status === 'novel_candidate' && novel.noveltyScore === 1,
    numericProposalRejected:
      numericRejected.failureCodes.includes('scenario_blueprint_numeric_content_forbidden'),
    answerOrOptionFieldRejected:
      truthRejected.failureCodes.includes('scenario_blueprint_unknown_or_truth_bearing_field'),
    requiredFieldsMustBeStrings:
      nonStringRejected.failureCodes.includes('scenario_blueprint_field_type_invalid'),
    proposalFieldsHaveExplicitLengthBound:
      overlongRejected.failureCodes.includes('scenario_blueprint_field_length_exceeded'),
    surfaceFieldsMustBeStrings:
      nonStringSurfaceRejected.failureCodes.includes('scenario_blueprint_surface_field_type_invalid'),
    abstractMathRemainsOutsideDynamicScenarioPath:
      mathRejected.failureCodes.includes('dynamic_scenario_binding_not_supported'),
    validChemistryBlueprintBecomesProvisionalOnly:
      chemistryAccepted.status === 'provisional_candidate'
      && chemistryAccepted.eligibleForProductionGeneration === false,
    exactScopeBindingIsRequired:
      missingScopeRejected.failureCodes.includes('scenario_blueprint_exact_scope_missing'),
    historyMayNotContainQuestionContent:
      contentHistoryRejected.status === 'rejected_history_input_not_structural_only'
      && contentHistoryRejected.historyInputAccepted === false,
    malformedHistoryFailsClosedWithoutThrowing:
      malformedHistoryRejected.status === 'rejected_history_input_not_structural_only'
      && malformedHistoryRejected.historyInputAccepted === false
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-self-test-v2-strict-string-bounds',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
  return report;
}

if (require.main === module) main();

module.exports = { main };
