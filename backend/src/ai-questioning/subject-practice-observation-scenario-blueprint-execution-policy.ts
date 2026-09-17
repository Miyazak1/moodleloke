import { createHash } from 'node:crypto';
import { AiGatewayCostService } from '../ai-gateway/ai-gateway-cost.service';
import { AiGatewayRequest, AiGatewayResponse } from '../ai-gateway/ai-gateway.types';
import {
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION,
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_SAMPLING_TEMPERATURE,
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor
} from './subject-practice-observation-scenario-blueprint-pack-policy';
import { subjectPracticeScenarioBlueprintResponseGateFor } from './subject-practice-scenario-blueprint-response-policy';

export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_POLICY_VERSION =
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION;
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_RECEIPT_VALIDATION_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-receipt-validation-v2-request-digest-matched';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function executionReceiptCoreFrom(value: RecordValue) {
  return {
    policyVersion: value.policyVersion,
    requestPackSha256: value.requestPackSha256,
    authorizationDigest: value.authorizationDigest,
    batchId: value.batchId,
    model: value.model,
    maximumProviderCalls: value.maximumProviderCalls,
    maximumCostUsdPerCall: value.maximumCostUsdPerCall,
    maximumTotalCostUsd: value.maximumTotalCostUsd,
    samplingTemperature: value.samplingTemperature,
    executionOrder: value.executionOrder,
    providerAttemptLimitPerRequest: value.providerAttemptLimitPerRequest,
    databaseImpact: value.databaseImpact,
    publicationAuthorized: value.publicationAuthorized,
    status: value.status,
    executionStarted: value.executionStarted,
    gatewayRequestCount: value.gatewayRequestCount,
    providerTransportAttemptCount: value.providerTransportAttemptCount,
    actualCostUsd: value.actualCostUsd,
    completedResponseCount: value.completedResponseCount,
    expectedResponseCount: value.expectedResponseCount,
    failures: value.failures,
    providerCalls: value.providerCalls,
    responses: value.responses
  };
}

export function subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For(value: unknown) {
  const receipt = recordFrom(value);
  return receipt ? digestFor(executionReceiptCoreFrom(receipt)) : '';
}

function executionRequestFor(input: {
  request: RecordValue;
  requestDigest: string;
  model: string;
  batchId: string;
  maximumOutputTokens: number;
}): AiGatewayRequest {
  return {
    taskType: 'question_generation',
    sourceModule: 'subject_practice_observation_scenario_blueprint_execution',
    modelHint: input.model,
    responseFormat: 'json',
    temperature: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_SAMPLING_TEMPERATURE,
    thinking: 'disabled',
    maxTokens: input.maximumOutputTokens,
    maxProviderAttempts: 1,
    timeoutMs: 45_000,
    messages: [
      { role: 'system', content: String(input.request.systemPrompt ?? '') },
      { role: 'user', content: String(input.request.userPrompt ?? '') }
    ],
    metadata: {
      purpose: 'shadow_scenario_blueprint_ideation',
      batchId: input.batchId,
      requestDigest: input.requestDigest,
      providerAttemptLimit: 1,
      publicationSuppressed: true,
      officialQuestionContentIncluded: false,
      historicalQuestionContentIncluded: false
    }
  };
}

export async function executeSubjectPracticeObservationScenarioBlueprintPack(input: {
  ideationPack?: unknown;
  costAdmission?: unknown;
  authorizationDigest?: unknown;
  apply?: boolean;
  complete: (request: AiGatewayRequest) => Promise<AiGatewayResponse>;
}) {
  const pack = recordFrom(input.ideationPack);
  const suppliedAdmission = recordFrom(input.costAdmission);
  const requests = Array.isArray(pack?.requests) ? pack.requests.map(recordFrom) : [];
  const expectedAdmission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: input.ideationPack,
    model: suppliedAdmission?.model,
    maximumCostUsdPerCall: suppliedAdmission?.maximumCostUsdPerCall,
    maximumTotalCostUsd: suppliedAdmission?.maximumTotalCostUsd
  });
  const blockers: string[] = [];
  if (expectedAdmission.status !== 'ready_for_exact_cost_authorization') {
    blockers.push(...expectedAdmission.blockers);
  }
  if (clean(suppliedAdmission?.status) !== 'ready_for_exact_cost_authorization'
    || clean(suppliedAdmission?.authorizationDigest) !== expectedAdmission.authorizationDigest) {
    blockers.push('scenario_blueprint_execution_cost_admission_mismatch');
  }
  if (clean(input.authorizationDigest) !== expectedAdmission.authorizationDigest) {
    blockers.push('scenario_blueprint_execution_authorization_digest_mismatch');
  }
  if (input.apply !== true) blockers.push('scenario_blueprint_execution_apply_not_confirmed');
  const uniqueBlockers = [...new Set(blockers)];
  const baseReceipt = {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_POLICY_VERSION,
    requestPackSha256: clean(pack?.requestPackSha256),
    authorizationDigest: expectedAdmission.authorizationDigest,
    batchId: clean(pack?.batchId),
    model: expectedAdmission.model,
    maximumProviderCalls: expectedAdmission.maximumProviderCalls,
    maximumCostUsdPerCall: expectedAdmission.maximumCostUsdPerCall,
    maximumTotalCostUsd: expectedAdmission.maximumTotalCostUsd,
    samplingTemperature: expectedAdmission.samplingTemperature,
    executionOrder: 'strictly_serial_stop_on_first_failure',
    providerAttemptLimitPerRequest: 1,
    databaseImpact: 'none_standalone_gateway_without_prisma',
    publicationAuthorized: false
  };
  if (uniqueBlockers.length) {
    return {
      ...baseReceipt,
      status: 'not_executed', blockers: uniqueBlockers,
      executionStarted: false, gatewayRequestCount: 0,
      providerTransportAttemptCount: 0, actualCostUsd: 0,
      responses: []
    };
  }

  const costService = new AiGatewayCostService();
  const responses: Array<Record<string, unknown>> = [];
  const providerCalls: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  let actualCostUsd = 0;
  let providerTransportAttemptCount = 0;
  let gatewayRequestCount = 0;

  const providerRequestGroups = Array.isArray(expectedAdmission.providerRequestGroups)
    ? expectedAdmission.providerRequestGroups.map(recordFrom)
    : [];
  for (let index = 0; index < providerRequestGroups.length; index += 1) {
    const group = providerRequestGroups[index];
    const entry = requests.find((candidate) =>
      clean(candidate?.requestDigest) === clean(group?.providerRequestDigest));
    const request = recordFrom(entry?.request);
    const estimate = expectedAdmission.requestEstimates[index];
    const coveredRequestDigests = Array.isArray(group?.coveredRequestDigests)
      ? group.coveredRequestDigests.map(clean)
      : [];
    if (!group || !entry || !request || !estimate || coveredRequestDigests.length < 1
      || actualCostUsd + Number(estimate.maximumEstimatedCostUsd) > expectedAdmission.maximumTotalCostUsd + Number.EPSILON) {
      failures.push({ ordinal: index + 1, reasonCode: 'scenario_blueprint_execution_remaining_budget_insufficient' });
      break;
    }
    const requestDigest = clean(entry.requestDigest);
    gatewayRequestCount += 1;
    const gatewayResponse = await input.complete(executionRequestFor({
      request,
      requestDigest,
      model: expectedAdmission.model,
      batchId: clean(pack?.batchId),
      maximumOutputTokens: Number(request.recommendedMaximumOutputTokens)
    }));
    const transportAttempts = Array.isArray(gatewayResponse.attempts)
      ? gatewayResponse.attempts.filter((attempt) => attempt?.keyId !== 'none').length
      : 0;
    providerTransportAttemptCount += transportAttempts;
    if (transportAttempts > 1) {
      failures.push({ ordinal: index + 1, requestDigest, reasonCode: 'scenario_blueprint_execution_provider_attempt_limit_exceeded' });
      break;
    }
    const billedCost = costService.estimate({
      model: expectedAdmission.model,
      promptTokens: gatewayResponse.usage?.promptTokens,
      completionTokens: gatewayResponse.usage?.completionTokens
    });
    if (gatewayResponse.status !== 'success') {
      if (billedCost) {
        actualCostUsd = Number((actualCostUsd + billedCost.estimatedCostUsd).toFixed(8));
      }
      failures.push({
        ordinal: index + 1, requestDigest,
        reasonCode: clean(gatewayResponse.errorCode) || 'scenario_blueprint_execution_gateway_failed',
        requestId: gatewayResponse.requestId,
        model: gatewayResponse.model,
        promptTokens: gatewayResponse.usage?.promptTokens ?? null,
        completionTokens: gatewayResponse.usage?.completionTokens ?? null,
        actualCostUsd: billedCost?.estimatedCostUsd ?? null,
        billedUsageRecorded: Boolean(billedCost)
      });
      break;
    }
    if (!billedCost) {
      failures.push({ ordinal: index + 1, requestDigest, reasonCode: 'scenario_blueprint_execution_actual_usage_missing' });
      break;
    }
    actualCostUsd = Number((actualCostUsd + billedCost.estimatedCostUsd).toFixed(8));
    if (billedCost.estimatedCostUsd > expectedAdmission.maximumCostUsdPerCall + Number.EPSILON
      || actualCostUsd > expectedAdmission.maximumTotalCostUsd + Number.EPSILON) {
      failures.push({ ordinal: index + 1, requestDigest, reasonCode: 'scenario_blueprint_execution_actual_cost_cap_exceeded' });
      break;
    }
    const providerCallOrdinal = index + 1;
    providerCalls.push({
      ordinal: providerCallOrdinal,
      providerRequestDigest: requestDigest,
      coveredRequestDigests,
      requestId: gatewayResponse.requestId,
      model: gatewayResponse.model,
      promptTokens: gatewayResponse.usage?.promptTokens,
      completionTokens: gatewayResponse.usage?.completionTokens,
      actualCostUsd: billedCost.estimatedCostUsd,
      latencyMs: gatewayResponse.latencyMs,
      responseContentSha256: digestFor(gatewayResponse.content)
    });
    for (const coveredRequestDigest of coveredRequestDigests) {
      const coveredEntry = requests.find((candidate) => clean(candidate?.requestDigest) === coveredRequestDigest);
      const coveredRequest = recordFrom(coveredEntry?.request);
      const responseGate = coveredRequest ? subjectPracticeScenarioBlueprintResponseGateFor({
        ideationRequest: coveredRequest,
        rawResponse: gatewayResponse.content
      }) : null;
      if (!coveredEntry || !coveredRequest || responseGate?.status !== 'accepted_provisional_blueprint_batch') {
        failures.push({
          ordinal: index + 1,
          requestDigest: coveredRequestDigest,
          reasonCode: 'scenario_blueprint_execution_response_gate_rejected',
          responseFailureCodes: responseGate?.blockers ?? ['scenario_blueprint_execution_covered_request_missing'],
          responseGateDiagnostics: responseGate ? {
            policyVersion: responseGate.policyVersion,
            expectedCandidateCount: responseGate.expectedCandidateCount,
            observedCandidateCount: responseGate.observedCandidateCount,
            candidateDiagnostics: responseGate.candidateDiagnostics
          } : null,
          rejectedResponseContentSha256: digestFor(gatewayResponse.content),
          rejectedRawResponse: gatewayResponse.content,
          rejectedRawResponseRetainedUnderExecutionAuthorization: true
        });
        break;
      }
      responses.push({
        requestDigest: coveredRequestDigest,
        rawResponse: gatewayResponse.content,
        evidence: {
          providerCallOrdinal,
          providerRequestDigest: requestDigest,
          requestId: gatewayResponse.requestId,
          model: gatewayResponse.model,
          promptTokens: gatewayResponse.usage?.promptTokens,
          completionTokens: gatewayResponse.usage?.completionTokens,
          actualCostUsd: billedCost.estimatedCostUsd,
          latencyMs: gatewayResponse.latencyMs,
          responseEvidenceDigest: responseGate.responseEvidenceDigest
        }
      });
    }
    if (failures.length) break;
  }
  const completed = responses.length === requests.length && failures.length === 0;
  const receiptCore = executionReceiptCoreFrom({
    ...baseReceipt,
    status: completed ? 'completed_response_pack_ready_for_materialization' : 'stopped_on_first_failure',
    executionStarted: true,
    gatewayRequestCount,
    providerTransportAttemptCount,
    actualCostUsd,
    completedResponseCount: responses.length,
    expectedResponseCount: requests.length,
    failures,
    providerCalls,
    responses
  });
  return {
    ...receiptCore,
    executionReceiptSha256: digestFor(receiptCore),
    materializationAuthorized: completed,
    observationTaskWriteAuthorized: false,
    candidateWriteAuthorized: false,
    publicationAuthorized: false
  };
}

export function validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt(input: {
  ideationPack?: unknown;
  executionReceipt?: unknown;
}) {
  const pack = recordFrom(input.ideationPack);
  const receipt = recordFrom(input.executionReceipt);
  const blockers: string[] = [];
  if (!receipt || receipt.policyVersion !== SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_POLICY_VERSION) {
    blockers.push('scenario_blueprint_execution_receipt_policy_invalid');
  }
  const admission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: input.ideationPack,
    model: receipt?.model,
    maximumCostUsdPerCall: receipt?.maximumCostUsdPerCall,
    maximumTotalCostUsd: receipt?.maximumTotalCostUsd
  });
  if (admission.status !== 'ready_for_exact_cost_authorization'
    || clean(receipt?.requestPackSha256) !== admission.requestPackSha256
    || clean(receipt?.batchId) !== admission.batchId
    || clean(receipt?.authorizationDigest) !== admission.authorizationDigest) {
    blockers.push('scenario_blueprint_execution_receipt_admission_invalid');
  }
  const responses = Array.isArray(receipt?.responses) ? receipt.responses.map(recordFrom) : [];
  const providerCalls = Array.isArray(receipt?.providerCalls) ? receipt.providerCalls.map(recordFrom) : [];
  const failures = Array.isArray(receipt?.failures) ? receipt.failures : [];
  if (receipt?.status !== 'completed_response_pack_ready_for_materialization'
    || receipt?.executionStarted !== true
    || receipt?.materializationAuthorized !== true
    || receipt?.observationTaskWriteAuthorized !== false
    || receipt?.candidateWriteAuthorized !== false
    || receipt?.publicationAuthorized !== false
    || Number(receipt?.gatewayRequestCount) !== admission.maximumProviderCalls
    || Number(receipt?.providerTransportAttemptCount) !== admission.maximumProviderCalls
    || Number(receipt?.completedResponseCount) !== Number(pack?.requestCount)
    || Number(receipt?.expectedResponseCount) !== Number(pack?.requestCount)
    || Number(receipt?.samplingTemperature) !== Number(admission.samplingTemperature)
    || responses.length !== Number(pack?.requestCount)
    || providerCalls.length !== admission.maximumProviderCalls
    || failures.length !== 0) {
    blockers.push('scenario_blueprint_execution_receipt_not_complete');
  }
  const expectedDigest = receipt ? digestFor(executionReceiptCoreFrom(receipt)) : '';
  if (!receipt || clean(receipt.executionReceiptSha256) !== expectedDigest) {
    blockers.push('scenario_blueprint_execution_receipt_digest_invalid');
  }
  const costService = new AiGatewayCostService();
  let recomputedActualCostUsd = 0;
  for (let index = 0; index < providerCalls.length; index += 1) {
    const call = providerCalls[index];
    const expectedGroup = recordFrom(admission.providerRequestGroups[index]);
    const expectedCoveredRequestDigests = Array.isArray(expectedGroup?.coveredRequestDigests)
      ? expectedGroup.coveredRequestDigests.map(clean)
      : [];
    const recordedCoveredRequestDigests = Array.isArray(call?.coveredRequestDigests)
      ? call.coveredRequestDigests.map(clean)
      : [];
    const linkedResponses = responses.filter((response) =>
      Number(recordFrom(response?.evidence)?.providerCallOrdinal) === index + 1);
    const linkedResponseDigests = linkedResponses.map((response) => clean(response?.requestDigest));
    const linkedContentHashes = linkedResponses.map((response) =>
      typeof response?.rawResponse === 'string' ? digestFor(response.rawResponse) : '');
    const actualCost = costService.estimate({
      model: admission.model,
      promptTokens: call?.promptTokens as number,
      completionTokens: call?.completionTokens as number
    });
    if (!call || Number(call.ordinal) !== index + 1
      || !clean(call.requestId) || clean(call.model) !== admission.model
      || !expectedGroup
      || clean(call.providerRequestDigest) !== clean(expectedGroup.providerRequestDigest)
      || JSON.stringify(recordedCoveredRequestDigests) !== JSON.stringify(expectedCoveredRequestDigests)
      || JSON.stringify(linkedResponseDigests) !== JSON.stringify(expectedCoveredRequestDigests)
      || linkedContentHashes.some((hash) => hash !== clean(call.responseContentSha256))
      || !actualCost || Number(call.actualCostUsd) !== actualCost.estimatedCostUsd
      || actualCost.estimatedCostUsd > admission.maximumCostUsdPerCall + Number.EPSILON) {
      blockers.push(`scenario_blueprint_execution_receipt_provider_call_invalid:${index + 1}`);
      continue;
    }
    recomputedActualCostUsd = Number((recomputedActualCostUsd + actualCost.estimatedCostUsd).toFixed(8));
  }
  const expectedRequests = Array.isArray(pack?.requests) ? pack.requests.map(recordFrom) : [];
  for (let index = 0; index < expectedRequests.length; index += 1) {
    const requestEntry = expectedRequests[index];
    const request = recordFrom(requestEntry?.request);
    const expectedRequestDigest = clean(requestEntry?.requestDigest);
    const matchingResponses = responses.filter((candidate) =>
      clean(candidate?.requestDigest) === expectedRequestDigest);
    const response = matchingResponses.length === 1 ? matchingResponses[0] : null;
    const evidence = recordFrom(response?.evidence);
    if (!request || !response || !evidence
      || !clean(evidence.requestId)
      || clean(evidence.model) !== admission.model
      || !Number.isInteger(Number(evidence.providerCallOrdinal))
      || !providerCalls[Number(evidence.providerCallOrdinal) - 1]
      || clean(providerCalls[Number(evidence.providerCallOrdinal) - 1]?.requestId) !== clean(evidence.requestId)
      || clean(evidence.providerRequestDigest)
        !== clean(providerCalls[Number(evidence.providerCallOrdinal) - 1]?.providerRequestDigest)
      || Number(evidence.promptTokens)
        !== Number(providerCalls[Number(evidence.providerCallOrdinal) - 1]?.promptTokens)
      || Number(evidence.completionTokens)
        !== Number(providerCalls[Number(evidence.providerCallOrdinal) - 1]?.completionTokens)
      || Number(evidence.actualCostUsd)
        !== Number(providerCalls[Number(evidence.providerCallOrdinal) - 1]?.actualCostUsd)) {
      blockers.push(`scenario_blueprint_execution_receipt_response_identity_invalid:${index + 1}`);
      continue;
    }
    const gated = subjectPracticeScenarioBlueprintResponseGateFor({
      ideationRequest: request,
      rawResponse: response.rawResponse
    });
    if (gated.status !== 'accepted_provisional_blueprint_batch'
      || clean(evidence.responseEvidenceDigest) !== clean(gated.responseEvidenceDigest)) {
      blockers.push(`scenario_blueprint_execution_receipt_response_evidence_invalid:${index + 1}`);
    }
  }
  if (recomputedActualCostUsd !== Number(receipt?.actualCostUsd)
    || recomputedActualCostUsd > admission.maximumTotalCostUsd + Number.EPSILON) {
    blockers.push('scenario_blueprint_execution_receipt_total_cost_invalid');
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_POLICY_VERSION,
    receiptValidationPolicyVersion:
      SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_RECEIPT_VALIDATION_POLICY_VERSION,
    status: uniqueBlockers.length ? 'rejected' : 'verified_for_materialization',
    blockers: uniqueBlockers,
    executionReceiptSha256: clean(receipt?.executionReceiptSha256) || null,
    authorizationDigest: admission.authorizationDigest,
    requestPackSha256: admission.requestPackSha256,
    actualCostUsd: recomputedActualCostUsd,
    providerTransportAttemptCount: Number(receipt?.providerTransportAttemptCount ?? 0),
    responses: uniqueBlockers.length ? [] : responses,
    observationTaskWriteAuthorized: false,
    candidateWriteAuthorized: false,
    publicationAuthorized: false
  };
}
