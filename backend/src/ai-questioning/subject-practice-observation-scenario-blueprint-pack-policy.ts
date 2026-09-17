import { createHash } from 'node:crypto';
import {
  SubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor
} from './subject-practice-observation-batch-manifest-policy';
import {
  buildSubjectPracticeObservationScenarioBlueprintAddendum,
  subjectPracticeObservationExactScopeForPlannedScope
} from './subject-practice-observation-scenario-blueprint-addendum-policy';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION,
  subjectPracticeScenarioBlueprintIdeationRequestFor
} from './subject-practice-scenario-blueprint-ideation-policy';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION,
  subjectPracticeScenarioBlueprintResponseGateFor
} from './subject-practice-scenario-blueprint-response-policy';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
} from './subject-practice-scenario-blueprint-policy';
import { subjectPracticeScenarioBlueprintIdeationCycleFor } from './subject-practice-scenario-blueprint-orchestrator';
import { subjectPracticeScenarioBlueprintMaterializationFor } from './subject-practice-scenario-blueprint-materialization-policy';
import { AiGatewayCostService } from '../ai-gateway/ai-gateway-cost.service';

export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-pack-v2-compatible-scope-response-reuse';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_LEGACY_PACK_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-pack-v1-scope-amortized';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_COST_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-cost-admission-v4-sampling-bound';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION =
  'subject-practice-observation-scenario-blueprint-execution-v6-compliance-weighted-sampling';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-response-pack-materialization-v2-retry-instance-bound';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_COST_USD_PER_CALL = 0.0025;
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_TOTAL_COST_USD = 0.01;
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_SAMPLING_TEMPERATURE = 0.35;

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

function bindingForTask(task: SubjectPracticeObservationBatchManifest['tasks'][number], exactScope: string) {
  return {
    subject: task.subject,
    taskFamily: task.taskFamily,
    planTemplate: task.planTemplate,
    exactScope,
    difficultyBand: task.subject === 'physics' ? 'basic' : 'medium',
    targetCognitiveSkill: 'direct_relation_application'
  };
}

function emptyHistorySummary() {
  return {
    dimensionCounts: {}, underrepresentedDimensions: {},
    concentrationWarnings: [], failureReasonCodes: []
  };
}

function providerRequestGroupsFor(requests: Array<Record<string, unknown>>) {
  const grouped = new Map<string, { compatibilityDigest: string; entries: Array<Record<string, unknown>> }>();
  for (const entry of requests) {
    const request = recordFrom(entry.request);
    const payload = recordFrom(request?.requestPayload);
    const binding = recordFrom(payload?.binding);
    const compatibilityCore = {
      subject: clean(binding?.subject),
      taskFamily: clean(binding?.taskFamily),
      planTemplate: clean(binding?.planTemplate),
      difficultyBand: clean(binding?.difficultyBand),
      targetCognitiveSkill: clean(binding?.targetCognitiveSkill),
      historySummary: payload?.historySummary,
      requestedCandidateCount: Number(payload?.requestedCandidateCount)
    };
    const compatibilityDigest = digestFor(compatibilityCore);
    const providerPromptDigest = digestFor({
      systemPrompt: request?.systemPrompt,
      userPrompt: request?.userPrompt,
      recommendedMaximumOutputTokens: request?.recommendedMaximumOutputTokens
    });
    const groupingKey = `${compatibilityDigest}:${providerPromptDigest}`;
    const group = grouped.get(groupingKey) ?? { compatibilityDigest, entries: [] };
    group.entries.push(entry);
    grouped.set(groupingKey, group);
  }
  return [...grouped.values()].map(({ compatibilityDigest, entries }, index) => ({
    ordinal: index + 1,
    compatibilityDigest,
    providerRequestDigest: clean(entries[0]?.requestDigest),
    coveredRequestDigests: entries.map((entry) => clean(entry.requestDigest)),
    coveredExactScopes: entries.map((entry) => clean(entry.exactScope))
  }));
}

export function buildSubjectPracticeObservationScenarioBlueprintIdeationPack(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  historySummaryByExactScope?: Record<string, unknown>;
  candidatesPerExactScope?: number;
  packInstanceId?: string;
}) {
  const envelope = subjectPracticeObservationBatchEnvelopeFor({ manifest: input.manifest, taskOrdinal: 1 });
  const candidatesPerExactScope = Number(input.candidatesPerExactScope ?? 4);
  if (!Number.isInteger(candidatesPerExactScope) || candidatesPerExactScope < 4 || candidatesPerExactScope > 6) {
    throw new Error('scenario_blueprint_pack_candidates_per_scope_must_be_four_to_six');
  }
  const packInstanceId = String(input.packInstanceId ?? '').trim().toLowerCase();
  if (packInstanceId && !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(packInstanceId)) {
    throw new Error('scenario_blueprint_pack_instance_id_invalid');
  }
  const groups = new Map<string, typeof envelope.manifest.tasks>();
  for (const task of envelope.manifest.tasks) {
    const exactScope = subjectPracticeObservationExactScopeForPlannedScope(task.subject, task.plannedScopeId);
    if (!exactScope) throw new Error('scenario_blueprint_pack_manifest_scope_not_supported');
    const group = groups.get(exactScope) ?? [];
    group.push(task);
    groups.set(exactScope, group);
  }
  const requests = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([exactScope, tasks]) => {
    const binding = bindingForTask(tasks[0], exactScope);
    const historySummary = input.historySummaryByExactScope?.[exactScope] ?? emptyHistorySummary();
    const request = subjectPracticeScenarioBlueprintIdeationRequestFor({
      binding, historySummary, requestedCandidateCount: candidatesPerExactScope
    });
    if (request.status !== 'ready_for_separately_authorized_shadow_ideation') {
      throw new Error(`scenario_blueprint_pack_request_rejected:${request.failureCodes?.join(',') ?? 'unknown'}`);
    }
    return {
      exactScope,
      taskOrdinals: tasks.map((task) => task.ordinal),
      requestDigest: request.requestDigest,
      request
    };
  });
  const providerRequestGroups = providerRequestGroupsFor(requests);
  const core = {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION,
    stage: 'request_pack_only',
    batchId: envelope.batchId,
    manifestSha256: envelope.manifestSha256,
    expectedTaskCount: envelope.expectedTaskCount,
    candidatesPerExactScope,
    packInstanceId: packInstanceId || undefined,
    requestCount: requests.length,
    requests,
    providerRequestCount: providerRequestGroups.length,
    providerRequestGroups
  };
  return {
    ...core,
    requestPackSha256: digestFor(core),
    providerCallsRequiredIfSeparatelyAuthorized: providerRequestGroups.length,
    providerCallsPerQuestion: Number((providerRequestGroups.length / envelope.expectedTaskCount).toFixed(6)),
    providerCallAuthorized: false,
    databaseImpact: 'none',
    publicationAuthorized: false
  };
}

export function subjectPracticeObservationScenarioBlueprintCostAdmissionFor(input: {
  ideationPack?: unknown;
  model?: unknown;
  maximumCostUsdPerCall?: unknown;
  maximumTotalCostUsd?: unknown;
}) {
  const pack = recordFrom(input.ideationPack);
  const requests = Array.isArray(pack?.requests) ? pack.requests.map(recordFrom) : [];
  const legacyPack = clean(pack?.policyVersion)
    === SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_LEGACY_PACK_POLICY_VERSION;
  const providerRequestGroups = legacyPack
    ? requests.filter(Boolean).map((entry, index) => ({
      ordinal: index + 1,
      compatibilityDigest: digestFor({ legacyRequestDigest: clean(entry?.requestDigest) }),
      providerRequestDigest: clean(entry?.requestDigest),
      coveredRequestDigests: [clean(entry?.requestDigest)],
      coveredExactScopes: [clean(entry?.exactScope)]
    }))
    : providerRequestGroupsFor(requests.filter(Boolean) as RecordValue[]);
  const model = clean(input.model);
  const maximumCostUsdPerCall = Number(input.maximumCostUsdPerCall);
  const maximumTotalCostUsd = Number(input.maximumTotalCostUsd);
  const blockers: string[] = [];
  const requestPackCore = pack ? legacyPack ? {
    policyVersion: pack.policyVersion,
    stage: pack.stage,
    batchId: pack.batchId,
    manifestSha256: pack.manifestSha256,
    expectedTaskCount: pack.expectedTaskCount,
    candidatesPerExactScope: pack.candidatesPerExactScope,
    requestCount: pack.requestCount,
    requests: pack.requests
  } : {
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
  } : null;
  if (![SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION,
    SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_LEGACY_PACK_POLICY_VERSION].includes(clean(pack?.policyVersion))
    || !clean(pack?.requestPackSha256)
    || !requestPackCore
    || digestFor(requestPackCore) !== clean(pack?.requestPackSha256)
    || Number(pack?.requestCount) !== requests.length
    || (!legacyPack && Number(pack?.providerRequestCount) !== providerRequestGroups.length)
    || (!legacyPack && JSON.stringify(pack?.providerRequestGroups) !== JSON.stringify(providerRequestGroups))
    || requests.length < 1 || requests.length > 4) {
    blockers.push('scenario_blueprint_cost_request_pack_invalid');
  }
  if (model !== 'deepseek-v4-flash') {
    blockers.push('scenario_blueprint_cost_model_not_allowed');
  }
  if (!Number.isFinite(maximumCostUsdPerCall) || maximumCostUsdPerCall <= 0
    || maximumCostUsdPerCall > SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_COST_USD_PER_CALL) {
    blockers.push('scenario_blueprint_cost_per_call_cap_invalid');
  }
  if (!Number.isFinite(maximumTotalCostUsd) || maximumTotalCostUsd <= 0
    || maximumTotalCostUsd > SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_TOTAL_COST_USD) {
    blockers.push('scenario_blueprint_cost_total_cap_invalid');
  }
  const costService = new AiGatewayCostService();
  const requestEstimates = providerRequestGroups.map((group) => {
    const entry = requests.find((candidate) => clean(candidate?.requestDigest) === group.providerRequestDigest);
    const request = recordFrom(entry?.request);
    const conservativePromptTokens = Math.ceil(Number(request?.promptCharacterCount ?? 0));
    const maximumCompletionTokens = Number(request?.recommendedMaximumOutputTokens ?? 0);
    const cost = costService.estimate({
      model, promptTokens: conservativePromptTokens, completionTokens: maximumCompletionTokens
    });
    return {
      exactScope: clean(entry?.exactScope),
      requestDigest: clean(entry?.requestDigest),
      coveredRequestDigests: group.coveredRequestDigests,
      coveredExactScopes: group.coveredExactScopes,
      conservativePromptTokens,
      maximumCompletionTokens,
      maximumEstimatedCostUsd: cost?.estimatedCostUsd ?? null,
      pricing: cost?.pricing ?? null
    };
  });
  const estimatesValid = requestEstimates.every((entry) =>
    entry.exactScope && entry.requestDigest
    && entry.conservativePromptTokens > 0 && entry.maximumCompletionTokens > 0
    && Number.isFinite(entry.maximumEstimatedCostUsd));
  if (!estimatesValid) blockers.push('scenario_blueprint_cost_estimate_unavailable');
  const maximumEstimatedCostUsdPerCall = estimatesValid
    ? Math.max(...requestEstimates.map((entry) => Number(entry.maximumEstimatedCostUsd)))
    : null;
  const maximumEstimatedTotalCostUsd = estimatesValid
    ? Number(requestEstimates.reduce((sum, entry) => sum + Number(entry.maximumEstimatedCostUsd), 0).toFixed(8))
    : null;
  if (maximumEstimatedCostUsdPerCall != null
    && maximumEstimatedCostUsdPerCall > maximumCostUsdPerCall + Number.EPSILON) {
    blockers.push('scenario_blueprint_cost_per_call_estimate_exceeds_cap');
  }
  if (maximumEstimatedTotalCostUsd != null
    && maximumEstimatedTotalCostUsd > maximumTotalCostUsd + Number.EPSILON) {
    blockers.push('scenario_blueprint_cost_total_estimate_exceeds_cap');
  }
  if (Number.isFinite(maximumCostUsdPerCall) && Number.isFinite(maximumTotalCostUsd)
    && maximumCostUsdPerCall * providerRequestGroups.length > maximumTotalCostUsd + Number.EPSILON) {
    blockers.push('scenario_blueprint_cost_reserved_call_sum_exceeds_total_cap');
  }
  const authorizationCore = {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_COST_POLICY_VERSION,
    executionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_EXECUTION_CONTRACT_VERSION,
    ideationPolicyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION,
    responsePolicyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION,
    proposalPolicyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION,
    requestPackSha256: clean(pack?.requestPackSha256),
    batchId: clean(pack?.batchId),
    manifestSha256: clean(pack?.manifestSha256),
    model,
    maximumProviderCalls: providerRequestGroups.length,
    maximumCostUsdPerCall,
    maximumTotalCostUsd,
    maximumEstimatedCostUsdPerCall,
    maximumEstimatedTotalCostUsd,
    responseMode: 'json',
    thinkingMode: 'disabled',
    reasoningEffort: 'none',
    samplingTemperature: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_SAMPLING_TEMPERATURE,
    serialExecutionRequired: true,
    stopOnFirstFailure: true
  };
  const uniqueBlockers = [...new Set(blockers)];
  return {
    ...authorizationCore,
    authorizationDigest: digestFor(authorizationCore),
    status: uniqueBlockers.length ? 'rejected' : 'ready_for_exact_cost_authorization',
    blockers: uniqueBlockers,
    requestEstimates,
    providerRequestGroups,
    hardPolicyMaximumCostUsdPerCall:
      SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_COST_USD_PER_CALL,
    hardPolicyMaximumTotalCostUsd:
      SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MAXIMUM_TOTAL_COST_USD,
    providerCallAuthorized: false,
    databaseImpact: 'none',
    publicationAuthorized: false
  };
}

function historyEntryFor(blueprint: RecordValue) {
  return {
    blueprintFingerprint: blueprint.blueprintFingerprint,
    renameInvariantFingerprint: blueprint.renameInvariantFingerprint,
    canonicalDimensions: blueprint.canonicalDimensions,
    lifecycleStatus: 'provisional',
    failureCodes: []
  };
}

export function materializeSubjectPracticeObservationScenarioBlueprintResponsePack(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  ideationPack?: unknown;
  responses?: unknown;
}) {
  const pack = recordFrom(input.ideationPack);
  const packedRequests = Array.isArray(pack?.requests) ? pack.requests.map(recordFrom).filter(Boolean) : [];
  const historySummaryByExactScope = Object.fromEntries(packedRequests.map((entry) => {
    const request = recordFrom(entry?.request);
    const payload = recordFrom(request?.requestPayload);
    return [clean(entry?.exactScope), payload?.historySummary ?? emptyHistorySummary()];
  }));
  const expectedPack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
    manifest: input.manifest,
    historySummaryByExactScope,
    candidatesPerExactScope: Number(pack?.candidatesPerExactScope ?? 4),
    packInstanceId: clean(pack?.packInstanceId) || undefined
  });
  const responseRows = Array.isArray(input.responses) ? input.responses.map(recordFrom) : [];
  const recordedProviderCallOrdinals = new Set(responseRows.map((row) =>
    Number(recordFrom(row?.evidence)?.providerCallOrdinal)).filter((value) => Number.isInteger(value) && value > 0));
  const providerCallCountRecorded = recordedProviderCallOrdinals.size || responseRows.length;
  const blockers: string[] = [];
  if (!pack
    || clean(pack.policyVersion) !== clean(expectedPack.policyVersion)
    || clean(pack.batchId) !== expectedPack.batchId
    || clean(pack.manifestSha256) !== expectedPack.manifestSha256
    || clean(pack.requestPackSha256) !== expectedPack.requestPackSha256) {
    blockers.push('scenario_blueprint_response_pack_request_pack_invalid');
  }
  const contextsByScope = new Map<string, RecordValue[]>();
  for (const requestEntry of expectedPack.requests) {
    const responseRow = responseRows.find((row) => clean(row?.requestDigest) === requestEntry.requestDigest);
    if (!responseRow || typeof responseRow.rawResponse !== 'string') {
      blockers.push(`scenario_blueprint_response_missing:${requestEntry.exactScope}`);
      continue;
    }
    const gated = subjectPracticeScenarioBlueprintResponseGateFor({
      ideationRequest: requestEntry.request,
      rawResponse: responseRow.rawResponse
    });
    if (gated.status !== 'accepted_provisional_blueprint_batch') {
      blockers.push(`scenario_blueprint_response_rejected:${requestEntry.exactScope}`);
      continue;
    }
    const selectedContexts: RecordValue[] = [];
    const selectionHistory: RecordValue[] = [];
    for (let index = 0; index < expectedPack.candidatesPerExactScope; index += 1) {
      const cycle = subjectPracticeScenarioBlueprintIdeationCycleFor({
        ideationRequest: requestEntry.request,
        rawResponse: responseRow.rawResponse,
        historicalSummaries: selectionHistory
      });
      const selected = gated.blueprints.find((candidate) =>
        candidate.blueprintFingerprint === cycle.selectedBlueprintFingerprint);
      if (!selected || cycle.status !== 'selected_provisional_blueprint_shadow_only') {
        blockers.push(`scenario_blueprint_response_insufficient_novel_candidates:${requestEntry.exactScope}`);
        break;
      }
      const materialized = subjectPracticeScenarioBlueprintMaterializationFor({
        binding: requestEntry.request.binding,
        selectedBlueprint: selected,
        ideationCycle: cycle
      });
      if (materialized.status !== 'materialized_provisional_scenario_contract') {
        blockers.push(`scenario_blueprint_response_materialization_failed:${requestEntry.exactScope}`);
        break;
      }
      selectedContexts.push({
        binding: requestEntry.request.binding,
        selectedBlueprint: selected,
        ideationCycle: cycle,
        provisionalScenarioContract: materialized.provisionalScenarioContract
      });
      selectionHistory.push(historyEntryFor(selected));
    }
    contextsByScope.set(requestEntry.exactScope, selectedContexts);
  }
  if (responseRows.length !== expectedPack.requestCount) blockers.push('scenario_blueprint_response_pack_count_mismatch');
  if (blockers.length) {
    return {
      policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION,
      materializationPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
      status: 'rejected', blockers: [...new Set(blockers)], addendum: null,
      providerCallCountRecorded,
      databaseImpact: 'none', publicationAuthorized: false, releaseQualification: false
    };
  }
  const usageByScope = new Map<string, number>();
  const entries = expectedPack.requests.flatMap((requestEntry) => requestEntry.taskOrdinals.map((taskOrdinal) => {
    const contexts = contextsByScope.get(requestEntry.exactScope) ?? [];
    const used = usageByScope.get(requestEntry.exactScope) ?? 0;
    usageByScope.set(requestEntry.exactScope, used + 1);
    return {
      taskOrdinal,
      scenarioBlueprintShadowContext: contexts[used % contexts.length]
    };
  })).sort((left, right) => left.taskOrdinal - right.taskOrdinal);
  try {
    const addendum = buildSubjectPracticeObservationScenarioBlueprintAddendum({
      manifest: input.manifest, entries
    });
    return {
      policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION,
      materializationPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
      status: 'materialized_addendum_shadow_only', blockers: [], addendum,
      requestCount: expectedPack.requestCount,
      candidateBlueprintCount: expectedPack.requestCount * expectedPack.candidatesPerExactScope,
      providerCallCountRecorded,
      providerCallsPerQuestion: expectedPack.providerCallsPerQuestion,
      databaseImpact: 'none', publicationAuthorized: false, releaseQualification: false
    };
  } catch (error) {
    return {
      policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_PACK_POLICY_VERSION,
      materializationPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
      status: 'rejected', blockers: [error instanceof Error ? error.message : 'scenario_blueprint_addendum_failed'],
      addendum: null, providerCallCountRecorded,
      databaseImpact: 'none', publicationAuthorized: false, releaseQualification: false
    };
  }
}
