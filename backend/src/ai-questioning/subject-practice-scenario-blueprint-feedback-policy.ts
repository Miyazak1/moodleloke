import { createHash } from 'node:crypto';
import {
  subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For
} from './subject-practice-observation-scenario-blueprint-execution-policy';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_COMPATIBILITY_POLICY_VERSION,
  subjectPracticeScenarioBlueprintCompatibilityFor
} from './subject-practice-scenario-blueprint-compatibility-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_FEEDBACK_POLICY_VERSION =
  'subject-practice-scenario-blueprint-feedback-v3-actionable-compact-codes';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requestPackCoreFrom(pack: RecordValue) {
  return {
    policyVersion: pack.policyVersion,
    stage: pack.stage,
    batchId: pack.batchId,
    manifestSha256: pack.manifestSha256,
    expectedTaskCount: pack.expectedTaskCount,
    candidatesPerExactScope: pack.candidatesPerExactScope,
    packInstanceId: pack.packInstanceId,
    requestCount: pack.requestCount,
    requests: pack.requests,
    providerRequestCount: pack.providerRequestCount,
    providerRequestGroups: pack.providerRequestGroups
  };
}

const SAFE_HISTORY_CODE = /^[a-z0-9_:-]{1,100}$/;

export function subjectPracticeScenarioBlueprintFeedbackFor(input: {
  ideationPack?: unknown;
  executionReceipt?: unknown;
}) {
  const pack = recordFrom(input.ideationPack);
  const receipt = recordFrom(input.executionReceipt);
  const blockers: string[] = [];
  const computedPackSha = pack ? digestFor(requestPackCoreFrom(pack)) : '';
  const computedReceiptSha = subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For(receipt);
  if (!pack || clean(pack.requestPackSha256) !== computedPackSha) {
    blockers.push('scenario_blueprint_feedback_request_pack_digest_invalid');
  }
  if (!receipt || clean(receipt.executionReceiptSha256) !== computedReceiptSha) {
    blockers.push('scenario_blueprint_feedback_execution_receipt_digest_invalid');
  }
  if (!pack || !receipt
    || clean(receipt.requestPackSha256) !== clean(pack.requestPackSha256)
    || clean(receipt.batchId) !== clean(pack.batchId)) {
    blockers.push('scenario_blueprint_feedback_pack_receipt_binding_invalid');
  }
  const failures = Array.isArray(receipt?.failures) ? receipt.failures.map(recordFrom).filter(Boolean) as RecordValue[] : [];
  if (receipt?.status !== 'stopped_on_first_failure' || failures.length !== 1) {
    blockers.push('scenario_blueprint_feedback_rejected_execution_required');
  }
  const failure = failures[0] ?? null;
  const rawResponse = typeof failure?.rejectedRawResponse === 'string' ? failure.rejectedRawResponse : '';
  if (!rawResponse
    || failure?.rejectedRawResponseRetainedUnderExecutionAuthorization !== true
    || clean(failure?.rejectedResponseContentSha256) !== digestFor(rawResponse)) {
    blockers.push('scenario_blueprint_feedback_rejected_response_evidence_invalid');
  }
  let candidates: unknown[] = [];
  if (rawResponse) {
    try {
      const parsed = recordFrom(JSON.parse(rawResponse));
      candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    } catch {
      blockers.push('scenario_blueprint_feedback_rejected_response_json_invalid');
    }
  }
  const requests = Array.isArray(pack?.requests) ? pack.requests.map(recordFrom).filter(Boolean) as RecordValue[] : [];
  const failedRequest = requests.find((entry) => clean(entry.requestDigest) === clean(failure?.requestDigest));
  const request = recordFrom(failedRequest?.request);
  const requestPayload = recordFrom(request?.requestPayload);
  const binding = recordFrom(requestPayload?.binding);
  if (!failedRequest || !binding || candidates.length !== Number(request?.requestedCandidateCount)) {
    blockers.push('scenario_blueprint_feedback_failed_request_binding_invalid');
  }
  const compatibilityFailureCodes = candidates.flatMap((proposal) =>
    subjectPracticeScenarioBlueprintCompatibilityFor({ subject: binding?.subject, proposal }).reasonCodes);
  const recordedDiagnostics = recordFrom(failure?.responseGateDiagnostics);
  const candidateDiagnostics = Array.isArray(recordedDiagnostics?.candidateDiagnostics)
    ? recordedDiagnostics.candidateDiagnostics.map(recordFrom).filter(Boolean) as RecordValue[]
    : [];
  const recordedFailureCodes = candidateDiagnostics.flatMap((diagnostic) =>
    Array.isArray(diagnostic.failureCodes) ? diagnostic.failureCodes.map(clean) : []);
  const detailedFailureCodes = [...new Set([
    ...compatibilityFailureCodes.map(clean),
    ...recordedFailureCodes
  ].filter((code) => SAFE_HISTORY_CODE.test(code)))].sort();
  const actionableMappings = [
    ['scenario_blueprint_chemistry_unsupported_procedure', 'avoid_unsupported_solution_methods'],
    ['scenario_blueprint_chemistry_multi_sample_structure', 'require_single_sample_only'],
    ['scenario_blueprint_chemistry_non_solution_observation', 'avoid_non_solution_observation'],
    ['scenario_blueprint_chemistry_entity_incompatible', 'require_liquid_solution_entity'],
    ['scenario_blueprint_chemistry_action_incompatible', 'require_single_sample_solution_action'],
    ['scenario_blueprint_chemistry_context_signal_missing', 'require_chemical_solution_context'],
    ['scenario_blueprint_numeric_content_forbidden', 'avoid_numbers_and_number_words'],
    ['scenario_blueprint_question_purpose_not_specific', 'require_specific_question_purpose']
  ] as const;
  const failureReasonCodes = actionableMappings
    .filter(([sourceCode]) => detailedFailureCodes.includes(sourceCode))
    .map(([, actionableCode]) => actionableCode);
  if (!failureReasonCodes.length) {
    blockers.push('scenario_blueprint_feedback_no_safe_structural_failure_signal');
  }
  const concentrationWarnings: string[] = [];
  const providerCalls = Array.isArray(receipt?.providerCalls) ? receipt.providerCalls.map(recordFrom).filter(Boolean) as RecordValue[] : [];
  const providerCall = providerCalls.find((call) => clean(call.providerRequestDigest) === clean(failure?.requestDigest));
  const coveredDigests = Array.isArray(providerCall?.coveredRequestDigests)
    ? providerCall.coveredRequestDigests.map(clean)
    : [clean(failure?.requestDigest)];
  const coveredScopes = requests
    .filter((entry) => coveredDigests.includes(clean(entry.requestDigest)))
    .map((entry) => clean(entry.exactScope))
    .filter(Boolean);
  if (!coveredScopes.length) blockers.push('scenario_blueprint_feedback_covered_scope_missing');
  const historySummary = {
    dimensionCounts: {},
    underrepresentedDimensions: {},
    concentrationWarnings,
    failureReasonCodes
  };
  const uniqueBlockers = [...new Set(blockers)];
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_FEEDBACK_POLICY_VERSION,
    compatibilityPolicyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_COMPATIBILITY_POLICY_VERSION,
    status: uniqueBlockers.length ? 'rejected' : 'structural_feedback_ready',
    blockers: uniqueBlockers,
    historySummaryByExactScope: uniqueBlockers.length
      ? {}
      : Object.fromEntries(coveredScopes.map((scope) => [scope, historySummary])),
    sourceEvidence: uniqueBlockers.length ? null : {
      requestPackSha256: clean(pack?.requestPackSha256),
      executionReceiptSha256: clean(receipt?.executionReceiptSha256),
      rejectedResponseContentSha256: clean(failure?.rejectedResponseContentSha256),
      failedRequestDigest: clean(failure?.requestDigest),
      detailedFailureCodesSha256: digestFor(detailedFailureCodes)
    },
    rawResponseIncluded: false,
    officialQuestionContentIncluded: false,
    historicalQuestionContentIncluded: false,
    providerCallAuthorized: false,
    observationTaskWriteAuthorized: false,
    candidateWriteAuthorized: false,
    publicationAuthorized: false
  };
}
