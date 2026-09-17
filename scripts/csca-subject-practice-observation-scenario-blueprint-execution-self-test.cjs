#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  buildSubjectPracticeObservationCampaignManifest
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  buildSubjectPracticeObservationScenarioBlueprintIdeationPack,
  materializeSubjectPracticeObservationScenarioBlueprintResponsePack,
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');
const {
  executeSubjectPracticeObservationScenarioBlueprintPack,
  validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt,
  subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-execution-policy');
const {
  authorizationConsumptionPreflightFor,
  executionPreflightFor,
  providerNetworkPreflightFor
} = require('./csca-subject-practice-observation-scenario-blueprint-execute.cjs');

const scopes = [
  'uniform_speed', 'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time', 'displacement_from_initial_acceleration_time'
];
const tasks = [];
for (let round = 0; round < 8; round += 1) {
  for (const scope of scopes) tasks.push({
    ordinal: tasks.length + 1,
    subject: 'physics', productionRunId: 2, productionCellId: 24,
    taskFamily: 'kinematics_basic_direct_relation',
    planTemplate: 'physics_kinematics_basic_relation_v1',
    plannedScopeId: `physics-basic-kinematics-v2:${scope}`
  });
}
const manifest = buildSubjectPracticeObservationCampaignManifest(tasks, 'physics-dynamic-execution-fixture');
const pack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({ manifest });
const admission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
  ideationPack: pack, model: 'deepseek-v4-flash',
  maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.01
});
const interleavedHistory = {
  dimensionCounts: { scenarioDomain: 1 }, underrepresentedDimensions: {},
  concentrationWarnings: [], failureReasonCodes: []
};
const interleavedPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
  manifest,
  historySummaryByExactScope: {
    displacement_from_initial_acceleration_time: interleavedHistory,
    uniform_speed: interleavedHistory
  }
});
const interleavedAdmission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
  ideationPack: interleavedPack, model: 'deepseek-v4-flash',
  maximumCostUsdPerCall: 0.0025, maximumTotalCostUsd: 0.005
});
const structures = [
  ['port operations', 'cargo carrier', 'straight loading lane', 'transport cargo', '货运车', 'cargo carrier', '港区直线装卸通道', 'a straight port loading lane'],
  ['medical logistics', 'delivery robot', 'straight service corridor', 'deliver supplies', '配送机器人', 'delivery robot', '医院直线服务通道', 'a straight hospital service corridor'],
  ['ecological monitoring', 'survey rover', 'straight survey route', 'survey habitat', '生态巡检车', 'survey rover', '生态直线巡检路线', 'a straight ecological survey route'],
  ['infrastructure inspection', 'inspection trolley', 'straight inspection gallery', 'inspect infrastructure', '设施巡检车', 'inspection trolley', '设施直线巡检廊道', 'a straight infrastructure inspection gallery']
];
const validContent = JSON.stringify({
  candidates: structures.map((parts) => ({
    scenarioMode: 'real_world', scenarioDomain: parts[0], scenarioEntity: parts[1],
    environment: parts[2], scenarioAction: parts[3], informationForm: 'motion observations in text',
    questionPurpose: 'infer a direct kinematics relation', contextNecessity: 'required_for_solution',
    surface: { zhEntity: parts[4], enEntity: parts[5], zhSetting: parts[6], enSetting: parts[7] }
  }))
});

function gatewayResponse(index, overrides = {}) {
  return {
    requestId: `fixture-${index}`, taskType: 'question_generation', providerId: 'deepseek',
    model: 'deepseek-v4-flash', keyId: 'redacted-fixture', status: 'success',
    content: validContent, usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    latencyMs: 20, attempts: [{
      providerId: 'deepseek', model: 'deepseek-v4-flash', keyId: 'redacted-fixture',
      status: 'success', latencyMs: 20
    }],
    ...overrides
  };
}

async function runWith(responder, overrides = {}) {
  let callCount = 0;
  const result = await executeSubjectPracticeObservationScenarioBlueprintPack({
    ideationPack: overrides.ideationPack ?? pack,
    costAdmission: overrides.costAdmission ?? admission,
    authorizationDigest: overrides.authorizationDigest ?? admission.authorizationDigest,
    apply: overrides.apply ?? true,
    complete: async (request) => {
      callCount += 1;
      if (request.maxProviderAttempts !== 1) throw new Error('fixture_provider_attempt_limit_not_one');
      if (request.thinking !== 'disabled' || request.reasoningEffort !== undefined) {
        throw new Error('fixture_scenario_ideation_must_use_nonthinking_delivery');
      }
      if (request.temperature !== 0.35) throw new Error('fixture_scenario_ideation_temperature_must_be_compliance_weighted');
      return responder(callCount, request);
    }
  });
  return { result, callCount };
}

async function main() {
  const reachablePreflight = await providerNetworkPreflightFor('https://provider.invalid', async () => ({ status: 401 }));
  const blockedPreflight = await providerNetworkPreflightFor('https://provider.invalid', async () => {
    const error = new Error('blocked');
    error.code = 'EACCES';
    throw error;
  });
  const unconsumedAuthorization = authorizationConsumptionPreflightFor(
    'fixture-receipts', 'a'.repeat(64), () => false
  );
  const consumedAuthorization = authorizationConsumptionPreflightFor(
    'fixture-receipts', 'b'.repeat(64), () => true
  );
  const readyExecutionPreflight = executionPreflightFor({
    admissionReady: true, environmentReady: true, authorizationReady: true,
    outputProvided: true, outputReady: true
  });
  const localConflictExecutionPreflight = executionPreflightFor({
    admissionReady: true, environmentReady: true, authorizationReady: false,
    outputProvided: true, outputReady: false
  });
  const missingOutputExecutionPreflight = executionPreflightFor({
    admissionReady: true, environmentReady: true, authorizationReady: true,
    outputProvided: false, outputReady: false
  });
  const preview = await runWith((index) => gatewayResponse(index), { apply: false });
  const wrongDigest = await runWith((index) => gatewayResponse(index), { authorizationDigest: 'wrong' });
  const tamperedPack = await runWith((index) => gatewayResponse(index), {
    ideationPack: { ...pack, requests: pack.requests.slice().reverse() }
  });
  const success = await runWith((index) => gatewayResponse(index));
  let interleavedCallCount = 0;
  const interleavedExecution = await executeSubjectPracticeObservationScenarioBlueprintPack({
    ideationPack: interleavedPack,
    costAdmission: interleavedAdmission,
    authorizationDigest: interleavedAdmission.authorizationDigest,
    apply: true,
    complete: async () => {
      interleavedCallCount += 1;
      return gatewayResponse(interleavedCallCount);
    }
  });
  const interleavedVerifiedReceipt = validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({
    ideationPack: interleavedPack, executionReceipt: interleavedExecution
  });
  const gateFailure = await runWith((index) => gatewayResponse(index, { content: '{}' }));
  const semanticGateFailure = await runWith((index) => gatewayResponse(index, {
    content: validContent.replace('transport cargo', 'measure speed')
  }));
  const billedProviderFailure = await runWith((index) => gatewayResponse(index, {
    status: 'failed', content: '', errorCode: 'provider_schema_invalid',
    attempts: [{
      providerId: 'deepseek', model: 'deepseek-v4-flash', keyId: 'redacted-fixture',
      status: 'failed', errorCode: 'provider_schema_invalid', latencyMs: 20,
      usage: { promptTokens: 407, completionTokens: 1200, totalTokens: 1607 }
    }],
    usage: { promptTokens: 407, completionTokens: 1200, totalTokens: 1607 }
  }));
  const missingUsage = await runWith((index) => gatewayResponse(index, { usage: undefined }));
  const attemptOverflow = await runWith((index) => gatewayResponse(index, {
    attempts: [
      { providerId: 'deepseek', model: 'deepseek-v4-flash', keyId: 'a', status: 'failed', latencyMs: 10 },
      { providerId: 'deepseek', model: 'deepseek-v4-flash', keyId: 'b', status: 'success', latencyMs: 10 }
    ]
  }));
  const verifiedReceipt = validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({
    ideationPack: pack, executionReceipt: success.result
  });
  const tamperedResponseReceipt = validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({
    ideationPack: pack,
    executionReceipt: {
      ...success.result,
      responses: success.result.responses.map((entry, index) => index === 0
        ? { ...entry, rawResponse: '{}' }
        : entry)
    }
  });
  const relinkedProviderCall = {
    ...success.result,
    providerCalls: success.result.providerCalls.map((entry, index) => index === 0
      ? { ...entry, coveredRequestDigests: entry.coveredRequestDigests.slice(1) }
      : entry)
  };
  relinkedProviderCall.executionReceiptSha256 =
    subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For(relinkedProviderCall);
  const relinkedProviderCallReceipt = validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({
    ideationPack: pack, executionReceipt: relinkedProviderCall
  });
  const materialized = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest, ideationPack: pack, responses: verifiedReceipt.responses
  });
  const checks = {
    networkPreflightAcceptsAnyHttpResponseBeforeAuthorizationConsumption:
      reachablePreflight.reachable === true && reachablePreflight.httpStatus === 401,
    networkPreflightFailsClosedWithoutConsumingAuthorization:
      blockedPreflight.reachable === false && blockedPreflight.errorCode === 'EACCES',
    authorizationConsumptionIsVisibleBeforeApply:
      unconsumedAuthorization.ready === true
      && unconsumedAuthorization.alreadyConsumed === false
      && consumedAuthorization.ready === false
      && consumedAuthorization.alreadyConsumed === true,
    localConflictsFailBeforeNetworkPreflight:
      readyExecutionPreflight.ready === true
      && localConflictExecutionPreflight.ready === false
      && localConflictExecutionPreflight.blockers.includes('authorization_already_consumed')
      && localConflictExecutionPreflight.blockers.includes('response_output_already_exists'),
    missingOutputPathCannotReportApplyReady:
      missingOutputExecutionPreflight.ready === false
      && missingOutputExecutionPreflight.blockers.includes('response_output_path_required'),
    previewCannotCallProvider: preview.callCount === 0
      && preview.result.status === 'not_executed'
      && preview.result.blockers.includes('scenario_blueprint_execution_apply_not_confirmed'),
    wrongAuthorizationCannotCallProvider: wrongDigest.callCount === 0
      && wrongDigest.result.blockers.includes('scenario_blueprint_execution_authorization_digest_mismatch'),
    tamperedPackCannotCallProvider: tamperedPack.callCount === 0
      && tamperedPack.result.blockers.includes('scenario_blueprint_cost_request_pack_invalid'),
    exactAuthorizationExecutesStrictlySerialPack: success.callCount === 1
      && success.result.status === 'completed_response_pack_ready_for_materialization'
      && success.result.completedResponseCount === 4
      && success.result.providerCalls.length === 1
      && success.result.policyVersion === admission.executionPolicyVersion,
    successfulReceiptIsContentAndCostBound: /^[a-f0-9]{64}$/.test(success.result.executionReceiptSha256)
      && success.result.actualCostUsd > 0
      && success.result.actualCostUsd <= 0.01,
    responseGateFailureStopsImmediately: gateFailure.callCount === 1
      && gateFailure.result.completedResponseCount === 0
      && gateFailure.result.failures[0].reasonCode === 'scenario_blueprint_execution_response_gate_rejected'
      && gateFailure.result.failures[0].rejectedRawResponse === '{}'
      && /^[a-f0-9]{64}$/.test(gateFailure.result.failures[0].rejectedResponseContentSha256),
    rejectedCandidateFailureCodesAreReceiptBound:
      semanticGateFailure.callCount === 1
      && semanticGateFailure.result.failures[0].responseGateDiagnostics.candidateDiagnostics[0]
        .failureCodes.includes('scenario_blueprint_exact_solver_semantics_forbidden')
      && semanticGateFailure.result.failures[0].rejectedRawResponseRetainedUnderExecutionAuthorization === true,
    failedProviderUsageIsStillCostedAndReceiptBound: billedProviderFailure.callCount === 1
      && billedProviderFailure.result.status === 'stopped_on_first_failure'
      && billedProviderFailure.result.actualCostUsd > 0
      && billedProviderFailure.result.failures[0].actualCostUsd > 0
      && billedProviderFailure.result.failures[0].billedUsageRecorded === true,
    missingActualUsageStopsImmediately: missingUsage.callCount === 1
      && missingUsage.result.failures[0].reasonCode === 'scenario_blueprint_execution_actual_usage_missing',
    providerAttemptOverflowStopsImmediately: attemptOverflow.callCount === 1
      && attemptOverflow.result.failures[0].reasonCode === 'scenario_blueprint_execution_provider_attempt_limit_exceeded',
    executionNeverAuthorizesDownstreamWritesOrPublication:
      success.result.observationTaskWriteAuthorized === false
      && success.result.candidateWriteAuthorized === false
      && success.result.publicationAuthorized === false,
    completeReceiptRevalidatesForMaterialization:
      verifiedReceipt.status === 'verified_for_materialization'
      && verifiedReceipt.responses.length === 4,
    interleavedCompatibilityGroupsValidateByRequestDigest:
      interleavedPack.providerRequestCount === 2
      && interleavedCallCount === 2
      && interleavedExecution.status === 'completed_response_pack_ready_for_materialization'
      && interleavedVerifiedReceipt.status === 'verified_for_materialization'
      && interleavedVerifiedReceipt.responses.length === 4,
    receiptTamperFailsClosed:
      tamperedResponseReceipt.status === 'rejected'
      && tamperedResponseReceipt.responses.length === 0
      && tamperedResponseReceipt.blockers.includes('scenario_blueprint_execution_receipt_digest_invalid'),
    recomputedDigestCannotBypassProviderCallResponseLinkage:
      relinkedProviderCallReceipt.status === 'rejected'
      && relinkedProviderCallReceipt.blockers.includes('scenario_blueprint_execution_receipt_provider_call_invalid:1'),
    verifiedReceiptMaterializesCampaignAddendum:
      materialized.status === 'materialized_addendum_shadow_only'
      && materialized.addendum.entries.length === 32
  };
  const report = {
    mode: 'subject_practice_observation_scenario_blueprint_execution_self_test',
    reportVersion: 'subject-practice-observation-scenario-blueprint-execution-self-test-v12-compliance-weighted-sampling',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    successfulFixture: {
      gatewayRequestCount: success.result.gatewayRequestCount,
      providerTransportAttemptCount: success.result.providerTransportAttemptCount,
      actualCostUsd: success.result.actualCostUsd
    },
    realProviderCallCount: 0,
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
