#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { subjectPracticeScenarioBlueprintIdeationRequestFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');
const { subjectPracticeScenarioBlueprintResponseGateFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-response-policy');
const { subjectPracticeScenarioBlueprintIdeationCycleFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-orchestrator');
const { subjectPracticeScenarioBlueprintMaterializationFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-materialization-policy');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { generateSubjectPracticePhysicsKinematicsLocally } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const { generateSubjectPracticeChemistryAcidBaseLocally } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const { subjectPracticeScenarioBlueprintShadowEvidenceFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-shadow-evidence-policy');
const { QuestionGeneratorProviderService } = require('../backend/src/ai-questioning/question-generator-provider.service');
const {
  subjectPracticeLocalShadowCandidateSeedBindingFor
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');

const binding = {
  subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed',
  difficultyBand: 'basic', targetCognitiveSkill: 'direct_relation_application'
};
const proposals = [
  {
    scenarioMode: 'real_world', scenarioDomain: 'harbor logistics', scenarioEntity: 'autonomous carrier',
    environment: 'straight loading lane', scenarioAction: 'transport along a marked route',
    informationForm: 'motion observations in text', questionPurpose: 'infer a direct kinematics relation',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '自动运输车', enEntity: 'autonomous carrier', zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor' }
  },
  {
    scenarioMode: 'real_world', scenarioDomain: 'agricultural monitoring', scenarioEntity: 'field rover',
    environment: 'straight crop inspection lane', scenarioAction: 'inspect a marked crop row',
    informationForm: 'sensor observations in text', questionPurpose: 'infer a motion relation for inspection timing',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '田间巡检车', enEntity: 'field rover', zhSetting: '笔直作物巡检通道', enSetting: 'a straight crop inspection lane' }
  }
];
const request = subjectPracticeScenarioBlueprintIdeationRequestFor({
  binding,
  historySummary: { dimensionCounts: {}, underrepresentedDimensions: {}, concentrationWarnings: [], failureReasonCodes: [] },
  requestedCandidateCount: 2
});
const response = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse: JSON.stringify({ candidates: proposals }) });
const cycle = subjectPracticeScenarioBlueprintIdeationCycleFor({
  ideationRequest: request, rawResponse: JSON.stringify({ candidates: proposals }), historicalSummaries: []
});
const selectedBlueprint = response.blueprints.find((item) => item.blueprintFingerprint === cycle.selectedBlueprintFingerprint);

const chemistryBinding = {
  subject: 'chemistry', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
  planTemplate: 'chemistry_strong_acid_base_single_relation_v1', exactScope: 'strong_acid_dilution',
  difficultyBand: 'medium', targetCognitiveSkill: 'quantitative_relation_application'
};
const chemistryProposals = [
  {
    scenarioMode: 'experimental', scenarioDomain: 'materials testing', scenarioEntity: 'solution sample',
    environment: 'controlled preparation bench', scenarioAction: 'prepare a process sample for comparison',
    informationForm: 'procedure observations in text', questionPurpose: 'infer a direct chemical relation',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '溶液样品', enEntity: 'solution sample', zhSetting: '受控配制台', enSetting: 'a controlled preparation bench' }
  },
  {
    scenarioMode: 'experimental', scenarioDomain: 'sensor calibration', scenarioEntity: 'reference solution',
    environment: 'calibration preparation station', scenarioAction: 'prepare a reference sample for measurement',
    informationForm: 'preparation observations in text', questionPurpose: 'infer a chemical relation for calibration',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '参比溶液', enEntity: 'reference solution', zhSetting: '校准配制台', enSetting: 'a calibration preparation station' }
  }
];
const chemistryRequest = subjectPracticeScenarioBlueprintIdeationRequestFor({
  binding: chemistryBinding,
  historySummary: { dimensionCounts: {}, underrepresentedDimensions: {}, concentrationWarnings: [], failureReasonCodes: [] },
  requestedCandidateCount: 2
});
const chemistryRawResponse = JSON.stringify({ candidates: chemistryProposals });
const chemistryResponse = subjectPracticeScenarioBlueprintResponseGateFor({
  ideationRequest: chemistryRequest, rawResponse: chemistryRawResponse
});
const chemistryCycle = subjectPracticeScenarioBlueprintIdeationCycleFor({
  ideationRequest: chemistryRequest, rawResponse: chemistryRawResponse, historicalSummaries: []
});
const chemistrySelectedBlueprint = chemistryResponse.blueprints
  .find((item) => item.blueprintFingerprint === chemistryCycle.selectedBlueprintFingerprint);

async function main() {
  const materialized = subjectPracticeScenarioBlueprintMaterializationFor({ binding, selectedBlueprint, ideationCycle: cycle });
  const chemistryMaterialized = subjectPracticeScenarioBlueprintMaterializationFor({
    binding: chemistryBinding,
    selectedBlueprint: chemistrySelectedBlueprint,
    ideationCycle: chemistryCycle
  });
  const tamperedBlueprint = subjectPracticeScenarioBlueprintMaterializationFor({
    binding, selectedBlueprint: { ...selectedBlueprint, blueprintDigest: 'tampered' }, ideationCycle: cycle
  });
  const tamperedCycle = subjectPracticeScenarioBlueprintMaterializationFor({
    binding, selectedBlueprint, ideationCycle: { ...cycle, selectedBlueprintFingerprint: 'blueprint-other' }
  });
  const changedScope = subjectPracticeScenarioBlueprintMaterializationFor({
    binding: { ...binding, exactScope: 'displacement_from_initial_acceleration_time' },
    selectedBlueprint,
    ideationCycle: cycle
  });
  const contract = materialized.provisionalScenarioContract;
  const physicsQuestionPlan = buildSubjectPracticeQuestionPlan({
    subject: 'physics', topicId: 78, topicTitle: 'Kinematics', productionCellId: 24,
    targetDifficulty: 'basic', taskFamily: binding.taskFamily,
    exactPhysicsKinematicsScope: binding.exactScope
  });
  const physicsBlueprint = {
    id: 24, subject: 'physics', topicId: 78, topicCode: 'P-MECH-001', topicModule: 'Mechanics',
    topicTitle: 'Kinematics', syllabusVersion: '2025', examScope: 'Basic linear motion.',
    allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'], excludedScope: [],
    difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
  };
  const physicsContext = {
    binding, selectedBlueprint, ideationCycle: cycle, provisionalScenarioContract: contract
  };
  const physicsRendered = generateSubjectPracticePhysicsKinematicsLocally({
    blueprint: physicsBlueprint, questionPlan: physicsQuestionPlan, seed: 7,
    relationKind: 'uniform_speed', scenarioBlueprintShadowContext: physicsContext
  });
  const physicsTampered = generateSubjectPracticePhysicsKinematicsLocally({
    blueprint: physicsBlueprint, questionPlan: physicsQuestionPlan, seed: 7,
    relationKind: 'uniform_speed', scenarioBlueprintShadowContext: {
      ...physicsContext,
      provisionalScenarioContract: { ...contract, surface: { ...contract.surface, zhEntity: '篡改实体' } }
    }
  });
  const chemistryQuestionPlan = buildSubjectPracticeQuestionPlan({
    subject: 'chemistry', topicId: 51, topicTitle: 'Strong acid-base pH', productionCellId: 42,
    targetDifficulty: 'medium', taskFamily: chemistryBinding.taskFamily,
    exactChemistryRelationKind: chemistryBinding.exactScope, exactChemistryAnswerTarget: 'ph_value'
  });
  const chemistryBlueprint = {
    id: 42, subject: 'chemistry', topicId: 51, topicCode: 'C-ACID-001', topicModule: 'Solutions',
    topicTitle: 'Strong acid-base pH', syllabusVersion: '2025', examScope: 'Strong acid-base dilution.',
    allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'], excludedScope: [],
    difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
  };
  const chemistryContract = chemistryMaterialized.provisionalScenarioContract;
  const chemistryRendered = generateSubjectPracticeChemistryAcidBaseLocally({
    blueprint: chemistryBlueprint, questionPlan: chemistryQuestionPlan, seed: 11,
    relationKind: 'strong_acid_dilution', answerTarget: 'ph_value',
    scenarioBlueprintShadowContext: {
      binding: chemistryBinding, selectedBlueprint: chemistrySelectedBlueprint,
      ideationCycle: chemistryCycle, provisionalScenarioContract: chemistryContract
    }
  });
  const physicsShadowEvidence = subjectPracticeScenarioBlueprintShadowEvidenceFor({
    scenarioBlueprintShadowContext: physicsContext, generationResult: physicsRendered
  });
  const chemistryShadowContext = {
    binding: chemistryBinding, selectedBlueprint: chemistrySelectedBlueprint,
    ideationCycle: chemistryCycle, provisionalScenarioContract: chemistryContract
  };
  const chemistryShadowEvidence = subjectPracticeScenarioBlueprintShadowEvidenceFor({
    scenarioBlueprintShadowContext: chemistryShadowContext, generationResult: chemistryRendered
  });
  const tamperedShadowEvidence = subjectPracticeScenarioBlueprintShadowEvidenceFor({
    scenarioBlueprintShadowContext: physicsContext,
    generationResult: { ...physicsRendered, provisionalScenarioContractDigest: 'tampered' }
  });
  const previousShadowFlag = process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED;
  process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED = 'true';
  const provider = new QuestionGeneratorProviderService(
    { build: () => ({ messages: [], metadata: { test: true } }) },
    { hasConfiguredKey: () => false, invoke: () => { throw new Error('provider_must_not_be_called'); } }
  );
  const providerBlueprint = {
    ...physicsBlueprint,
    constraints: { expansion: { questionPlan: physicsQuestionPlan } }
  };
  const fallback = physicsRendered.candidate;
  const candidateSeedBinding = (taskOrdinal) => subjectPracticeLocalShadowCandidateSeedBindingFor({
    observationBatchId: 'local-shadow-abcdef0123456789abcd',
    taskOrdinal,
    productionRunId: 2,
    productionCellId: 24
  });
  const providerRendered = await provider.generate(providerBlueprint, fallback, {
    gatewayMetadata: {
      workClass: 'observation', observationTaskId: 'shadow-test', generationJobId: 1,
      productionRunId: 2, productionCellId: 24, suppressStudentPublication: true,
      publicationPolicy: 'observation_gate_evidence_only_no_student_publication',
      observationCandidateSeedBinding: candidateSeedBinding(1),
      scenarioBlueprintShadowContext: physicsContext
    }
  });
  const providerRejectedTamper = await provider.generate(providerBlueprint, fallback, {
    gatewayMetadata: {
      workClass: 'observation', observationTaskId: 'shadow-test-2', generationJobId: 2,
      productionRunId: 2, productionCellId: 24, suppressStudentPublication: true,
      publicationPolicy: 'observation_gate_evidence_only_no_student_publication',
      observationCandidateSeedBinding: candidateSeedBinding(2),
      scenarioBlueprintShadowContext: {
        ...physicsContext,
        provisionalScenarioContract: { ...contract, scenarioContractDigest: 'tampered' }
      }
    }
  });
  if (previousShadowFlag === undefined) delete process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED;
  else process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED = previousShadowFlag;
  const checks = {
    selectedBlueprintMaterializes:
      materialized.status === 'materialized_provisional_scenario_contract'
      && /^[a-f0-9]{64}$/.test(contract.scenarioContractDigest),
    contextAndSolverActionsAreSeparated:
      contract.contextAction === selectedBlueprint.creativeBlueprint.scenarioAction
      && contract.solverAction === 'uniform_speed',
    deterministicPolicyOwnsScientificConstraints:
      materialized.modelControlsSolverAction === false
      && materialized.deterministicPolicyControlsSolverAction === true
      && materialized.deterministicPolicyControlsPlausibility === true
      && contract.plausibility.exactKinematicsScope === 'uniform_speed',
    chemistryConstraintsAreDeterministicallyDerived:
      chemistryMaterialized.status === 'materialized_provisional_scenario_contract'
      && chemistryMaterialized.provisionalScenarioContract.solverAction === 'strong_acid_dilution'
      && chemistryMaterialized.provisionalScenarioContract.plausibility.temperatureC === 25
      && chemistryMaterialized.provisionalScenarioContract.plausibility.completeDissociationOnly === true
      && chemistryMaterialized.deterministicPolicyControlsPlausibility === true,
    blueprintIdentityIsBound:
      contract.blueprintBinding.blueprintDigest === selectedBlueprint.blueprintDigest
      && contract.blueprintBinding.ideationCycleEvidenceDigest === cycle.cycleEvidenceDigest,
    sourceIsolationIsPreserved:
      contract.sourceIsolation.officialQuestionContentUsed === false
      && contract.sourceIsolation.reversibleSourceFieldsUsed === false,
    blueprintTamperRejected:
      tamperedBlueprint.blockers.includes('scenario_blueprint_materialization_blueprint_identity_invalid'),
    cycleSelectionTamperRejected:
      tamperedCycle.blockers.includes('scenario_blueprint_materialization_selection_mismatch'),
    bindingScopeCannotBeChangedAfterSelection:
      changedScope.blockers.includes('scenario_blueprint_materialization_blueprint_identity_invalid'),
    physicsBlueprintRendersThroughVerifiedLocalGenerator:
      physicsRendered.status === 'generated_and_self_verified'
      && physicsRendered.scenarioRenderMode === 'provisional_blueprint_shadow'
      && physicsRendered.provisionalScenarioContractDigest === contract.scenarioContractDigest
      && physicsRendered.candidate.prompt.includes(contract.surface.zhEntity)
      && physicsRendered.candidate.localizations.en.prompt.includes(contract.surface.enEntity),
    chemistryBlueprintRendersThroughVerifiedLocalGenerator:
      chemistryRendered.status === 'generated_and_self_verified'
      && chemistryRendered.scenarioRenderMode === 'provisional_blueprint_shadow'
      && chemistryRendered.provisionalScenarioContractDigest === chemistryContract.scenarioContractDigest
      && chemistryRendered.candidate.prompt.includes(chemistryContract.surface.zhEntity)
      && chemistryRendered.candidate.localizations.en.prompt.includes(chemistryContract.surface.enEntity),
    tamperedProvisionalContractCannotRender:
      physicsTampered.status === 'unsupported_question_plan'
      && physicsTampered.scenarioRenderMode === 'provisional_blueprint_shadow_rejected'
      && physicsTampered.reasonCodes.includes('provisional_scenario_contract_digest_invalid')
      && physicsTampered.candidate === null,
    physicsShadowEvidenceBindsRenderedSurfaceAndSolver:
      physicsShadowEvidence.status === 'shadow_candidate_evidence_complete'
      && physicsShadowEvidence.bilingualSurfaceMatched === true
      && physicsShadowEvidence.solverVerified === true,
    chemistryShadowEvidenceBindsRenderedSurfaceAndSolver:
      chemistryShadowEvidence.status === 'shadow_candidate_evidence_complete'
      && chemistryShadowEvidence.bilingualSurfaceMatched === true
      && chemistryShadowEvidence.solverVerified === true,
    generationDigestTamperRejectedByShadowEvidence:
      tamperedShadowEvidence.status === 'rejected'
      && tamperedShadowEvidence.blockers.includes('scenario_blueprint_shadow_generation_digest_mismatch'),
    providerRouteAcceptsVerifiedDynamicScenarioWithoutGateway:
      providerRendered.status === 'success'
      && providerRendered.provider === 'local-deterministic'
      && providerRendered.gatewayAttempts.length === 0
      && providerRendered.promptMetadata.localShadowGeneration.scenarioBlueprintShadowEvidence.status
        === 'shadow_candidate_evidence_complete',
    providerRouteRejectsTamperedDynamicScenarioWithoutFallback:
      providerRejectedTamper.status === 'local_generator_verification_failed'
      && providerRejectedTamper.gatewayAttempts.length === 0
      && providerRejectedTamper.promptMetadata.localShadowGeneration.scenarioRenderMode
        === 'provisional_blueprint_shadow_rejected',
    materializationAuthorizesNothing:
      materialized.productionGenerationAuthorized === false
      && materialized.publicationAuthorized === false
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_materialization_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-materialization-self-test-v3-provider-route-bridge',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_no_database_connection',
    productionImpact: 'connected_to_suppressed_local_observation_provider_route_only'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
