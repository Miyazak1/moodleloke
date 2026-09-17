#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { buildSubjectPracticeObservationBatchManifest } = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  buildSubjectPracticeObservationScenarioBlueprintIdeationPack,
  materializeSubjectPracticeObservationScenarioBlueprintResponsePack,
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor,
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');
const {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');
const {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-response-policy');
const {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-policy');

const physicsScopes = [
  'uniform_speed', 'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time', 'displacement_from_initial_acceleration_time'
];
const chemistrySlots = [
  ['strong_acid_dilution', 'ph_value'], ['strong_acid_dilution', 'acid_base_character'],
  ['strong_base_dilution', 'ph_value'], ['strong_base_dilution', 'acid_base_character'],
  ['strong_acid_base_neutralization', 'ph_value'], ['strong_acid_base_neutralization', 'acid_base_character']
];

function repeatedTasks(scopes, repeats, base) {
  const tasks = [];
  for (let round = 0; round < repeats; round += 1) {
    for (const scope of scopes) tasks.push({ ...base, ordinal: tasks.length + 1, plannedScopeId: scope });
  }
  return tasks;
}

const physicsManifest = buildSubjectPracticeObservationBatchManifest(repeatedTasks(
  physicsScopes.map((scope) => `physics-basic-kinematics-v2:${scope}`), 8,
  { subject: 'physics', productionRunId: 2, productionCellId: 24,
    taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'physics_kinematics_basic_relation_v1' }
));
const chemistryManifest = buildSubjectPracticeObservationBatchManifest(repeatedTasks(
  chemistrySlots.map(([relation, target]) => `chemistry-strong-acid-base-v3:${relation}:${target}`), 8,
  { subject: 'chemistry', productionRunId: 3, productionCellId: 42,
    taskFamily: 'ph_dilution_strong_acid_base_neutralization', planTemplate: 'chemistry_strong_acid_base_single_relation_v1' }
));

const structures = [
  ['port operations', 'cargo carrier', 'straight loading lane', 'transport cargo', '货运车', 'cargo carrier', '港区直线装卸通道', 'a straight port loading lane'],
  ['medical logistics', 'delivery robot', 'straight service corridor', 'deliver supplies', '配送机器人', 'delivery robot', '医院直线服务通道', 'a straight hospital service corridor'],
  ['ecological monitoring', 'survey rover', 'straight survey route', 'survey habitat', '生态巡检车', 'survey rover', '生态直线巡检路线', 'a straight ecological survey route'],
  ['infrastructure inspection', 'inspection trolley', 'straight inspection gallery', 'inspect infrastructure', '设施巡检车', 'inspection trolley', '设施直线巡检廊道', 'a straight infrastructure inspection gallery']
];
const chemistryStructures = [
  ['water quality analysis', 'reference solution', 'sample preparation bench', 'prepare an analysis sample', '参比溶液', 'reference solution', '水质样品配制台', 'a water analysis preparation bench'],
  ['food analysis', 'test solution', 'quality testing bench', 'prepare a test sample', '检测溶液', 'test solution', '食品检测配制台', 'a food testing preparation bench'],
  ['materials testing', 'conditioning solution', 'materials test bench', 'condition a test sample', '调理溶液', 'conditioning solution', '材料检测配制台', 'a materials testing preparation bench'],
  ['environmental treatment', 'bench sample', 'treatment test bench', 'prepare a treatment sample', '小试样品', 'bench sample', '环境处理小试台', 'an environmental treatment test bench']
];

function responsesFor(pack, subject) {
  return pack.requests.map((entry) => ({
    requestDigest: entry.requestDigest,
    rawResponse: JSON.stringify({
      candidates: (subject === 'physics' ? structures : chemistryStructures).map((parts) => ({
        scenarioMode: subject === 'physics' ? 'real_world' : 'experimental',
        scenarioDomain: parts[0], scenarioEntity: parts[1], environment: parts[2],
        scenarioAction: parts[3],
        informationForm: subject === 'physics' ? 'motion observations in text' : 'procedure observations in text',
        questionPurpose: subject === 'physics' ? 'infer a direct kinematics relation' : 'infer a direct chemical relation',
        contextNecessity: 'required_for_solution',
        surface: { zhEntity: parts[4], enEntity: parts[5], zhSetting: parts[6], enSetting: parts[7] }
      }))
    })
  }));
}

function main() {
  const physicsPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({ manifest: physicsManifest });
  const retryPhysicsPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
    manifest: physicsManifest, packInstanceId: 'physics-retry-1'
  });
  const uppercaseRetryPhysicsPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
    manifest: physicsManifest, packInstanceId: 'PHYSICS-RETRY-1'
  });
  const chemistryPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({ manifest: chemistryManifest });
  const retryChemistryPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
    manifest: chemistryManifest, packInstanceId: 'chemistry-v1-safe-vocabulary'
  });
  const physicsResponses = responsesFor(physicsPack, 'physics');
  const chemistryResponses = responsesFor(chemistryPack, 'chemistry');
  const retryChemistryResponses = responsesFor(retryChemistryPack, 'chemistry');
  const retryPhysicsResponses = responsesFor(retryPhysicsPack, 'physics');
  const physicsResult = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: physicsManifest, ideationPack: physicsPack, responses: physicsResponses
  });
  const chemistryResult = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: chemistryManifest, ideationPack: chemistryPack, responses: chemistryResponses
  });
  const retryPhysicsResult = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: physicsManifest, ideationPack: retryPhysicsPack, responses: retryPhysicsResponses
  });
  const retryChemistryResult = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: chemistryManifest, ideationPack: retryChemistryPack, responses: retryChemistryResponses
  });
  const missingResponse = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: physicsManifest, ideationPack: physicsPack, responses: physicsResponses.slice(0, 3)
  });
  const tamperedPack = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest: physicsManifest, ideationPack: { ...physicsPack, manifestSha256: 'tampered' }, responses: physicsResponses
  });
  const physicsCost = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: physicsPack, model: 'deepseek-v4-flash',
    maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.01
  });
  const chemistryCost = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: chemistryPack, model: 'deepseek-v4-flash',
    maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.0075
  });
  const insufficientCostCap = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: physicsPack, model: 'deepseek-v4-flash',
    maximumCostUsdPerCall: 0.0001, maximumTotalCostUsd: 0.0004
  });
  const disallowedReasoner = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: physicsPack, model: 'deepseek-v4-pro',
    maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.01
  });
  const tamperedCostPack = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: {
      ...physicsPack,
      requests: physicsPack.requests.map((entry, index) => index === 0
        ? { ...entry, request: { ...entry.request, systemPrompt: 'tampered prompt' } }
        : entry)
    },
    model: 'deepseek-v4-flash', maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.01
  });
  const checks = {
    physicsRequestsAreAmortizedPerExactScope:
      physicsPack.requestCount === 4
      && physicsPack.expectedTaskCount === 32
      && physicsPack.providerRequestCount === 1
      && physicsPack.providerCallsPerQuestion === 0.03125,
    chemistryRequestsReuseRelationAcrossAnswerTargets:
      chemistryPack.requestCount === 3
      && chemistryPack.expectedTaskCount === 48
      && chemistryPack.providerRequestCount === 1
      && chemistryPack.providerCallsPerQuestion === 0.020833,
    physicsResponsePackCreatesFullAddendum:
      physicsResult.status === 'materialized_addendum_shadow_only'
      && physicsResult.addendum.entries.length === 32
      && physicsResult.candidateBlueprintCount === 16
      && physicsResult.addendum.maximumFamilyShare <= 0.25,
    chemistryResponsePackCreatesFullAddendum:
      chemistryResult.status === 'materialized_addendum_shadow_only'
      && chemistryResult.addendum.entries.length === 48
      && chemistryResult.candidateBlueprintCount === 12
      && chemistryResult.addendum.maximumFamilyShare <= 0.25,
    everyPhysicsTaskGetsScopeMatchedContext:
      physicsResult.addendum.entries.every((entry, index) =>
        entry.scenarioBlueprintShadowContext.binding.exactScope
          === physicsManifest.tasks[index].plannedScopeId.split(':').at(-1)),
    missingResponseRejectsWholePack:
      missingResponse.status === 'rejected'
      && missingResponse.addendum === null,
    requestPackTamperRejected:
      tamperedPack.status === 'rejected'
      && tamperedPack.blockers.includes('scenario_blueprint_response_pack_request_pack_invalid'),
    noStageAuthorizesProviderOrPublication:
      physicsPack.providerCallAuthorized === false
      && physicsResult.publicationAuthorized === false
      && physicsResult.releaseQualification === false,
    costEfficiencyIsExplicitNotDollarClaim:
      physicsPack.providerCallsRequiredIfSeparatelyAuthorized === 1
      && chemistryPack.providerCallsRequiredIfSeparatelyAuthorized === 1
      && physicsResult.databaseImpact === 'none',
    conservativeFlashCostFitsBoundedPackCaps:
      physicsCost.status === 'ready_for_exact_cost_authorization'
      && physicsCost.maximumEstimatedCostUsdPerCall <= 0.0025
      && physicsCost.maximumEstimatedTotalCostUsd <= 0.01
      && chemistryCost.status === 'ready_for_exact_cost_authorization'
      && chemistryCost.maximumEstimatedTotalCostUsd <= 0.0075,
    insufficientCostCapFailsClosed:
      insufficientCostCap.status === 'rejected'
      && insufficientCostCap.blockers.includes('scenario_blueprint_cost_per_call_estimate_exceeds_cap'),
    nonFlashModelNotAllowedForLowCostIdeation:
      disallowedReasoner.status === 'rejected'
      && disallowedReasoner.blockers.includes('scenario_blueprint_cost_model_not_allowed'),
    costAdmissionRecomputesRequestPackDigest:
      tamperedCostPack.status === 'rejected'
      && tamperedCostPack.blockers.includes('scenario_blueprint_cost_request_pack_invalid'),
    costPlanStillRequiresExactAuthorization:
      physicsCost.providerCallAuthorized === false
      && /^[a-f0-9]{64}$/.test(physicsCost.authorizationDigest),
    authorizationDigestBindsRuntimePolicyVersions:
      physicsCost.executionPolicyVersion
        === SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION
      && physicsCost.ideationPolicyVersion === SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION
      && physicsCost.responsePolicyVersion === SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION
      && physicsCost.proposalPolicyVersion === SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
      && physicsCost.samplingTemperature === 0.35,
    retryInstanceChangesOnlyPackIdentity:
      retryPhysicsPack.requestPackSha256 !== physicsPack.requestPackSha256
      && retryPhysicsPack.packInstanceId === 'physics-retry-1'
      && JSON.stringify(retryPhysicsPack.requests) === JSON.stringify(physicsPack.requests),
    retryInstanceIsCanonicalAcrossLetterCase:
      uppercaseRetryPhysicsPack.packInstanceId === 'physics-retry-1'
      && uppercaseRetryPhysicsPack.requestPackSha256 === retryPhysicsPack.requestPackSha256,
    retryPackCanMaterializeUnderItsOwnFrozenIdentity:
      retryPhysicsResult.status === 'materialized_addendum_shadow_only'
      && retryPhysicsResult.addendum.entries.length === 32
      && retryPhysicsResult.materializationPolicyVersion
        === 'subject-practice-observation-scenario-blueprint-response-pack-materialization-v2-retry-instance-bound',
    chemistryInstancePackMaterializesAllFortyEightOrdinals:
      retryChemistryResult.status === 'materialized_addendum_shadow_only'
      && retryChemistryResult.addendum.entries.length === 48
      && retryChemistryResult.requestCount === 3
      && retryChemistryResult.candidateBlueprintCount === 12,
    compatibleScopesReuseOnlyByteIdenticalProviderPrompts:
      physicsPack.providerRequestGroups.every((group) => {
        const covered = physicsPack.requests.filter((entry) =>
          group.coveredRequestDigests.includes(entry.requestDigest));
        return new Set(covered.map((entry) => JSON.stringify({
          systemPrompt: entry.request.systemPrompt,
          userPrompt: entry.request.userPrompt,
          recommendedMaximumOutputTokens: entry.request.recommendedMaximumOutputTokens
        }))).size === 1;
      })
  };
  const report = {
    mode: 'subject_practice_observation_scenario_blueprint_pack_self_test',
    reportVersion: 'subject-practice-observation-scenario-blueprint-pack-self-test-v6-chemistry-instance-materialization',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    efficiency: {
      physics: { taskCount: 32, logicalRequestCount: 4, providerRequestCount: 1, providerCallsPerQuestion: 0.03125 },
      chemistry: { taskCount: 48, logicalRequestCount: 3, providerRequestCount: 1, providerCallsPerQuestion: 0.020833 }
    },
    costAdmission: {
      model: physicsCost.model,
      physicsMaximumEstimatedCostUsdPerCall: physicsCost.maximumEstimatedCostUsdPerCall,
      physicsMaximumEstimatedTotalCostUsd: physicsCost.maximumEstimatedTotalCostUsd,
      chemistryMaximumEstimatedTotalCostUsd: chemistryCost.maximumEstimatedTotalCostUsd,
      hardPolicyMaximumCostUsdPerCall: physicsCost.hardPolicyMaximumCostUsdPerCall,
      hardPolicyMaximumTotalCostUsd: physicsCost.hardPolicyMaximumTotalCostUsd
    },
    providerCallCount: 0, estimatedCostUsd: 0,
    databaseImpact: 'none', publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
