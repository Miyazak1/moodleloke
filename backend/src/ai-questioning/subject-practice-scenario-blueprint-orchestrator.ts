import { createHash } from 'node:crypto';
import {
  subjectPracticeScenarioBlueprintMemoryRankingFor
} from './subject-practice-scenario-blueprint-memory-policy';
import {
  subjectPracticeScenarioBlueprintResponseGateFor
} from './subject-practice-scenario-blueprint-response-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION =
  'subject-practice-scenario-blueprint-orchestrator-v1-shadow-only';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function subjectPracticeScenarioBlueprintIdeationCycleFor(input: {
  ideationRequest?: unknown;
  rawResponse?: unknown;
  historicalSummaries?: unknown[];
}) {
  const response = subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: input.ideationRequest,
    rawResponse: input.rawResponse
  });
  if (response.status !== 'accepted_provisional_blueprint_batch') {
    return {
      orchestratorVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION,
      status: 'rejected_response_batch',
      blockers: response.blockers,
      responseStatus: response.status,
      memoryStatus: 'not_run_response_rejected',
      selectedBlueprintFingerprint: null,
      selectedBlueprintDigest: null,
      cycleEvidenceDigest: null,
      providerCallAuthorized: false,
      productionGenerationAuthorized: false,
      publicationAuthorized: false,
      rawResponseRetained: false,
      productionGateImpact: 'none_shadow_only'
    };
  }
  const memory = subjectPracticeScenarioBlueprintMemoryRankingFor({
    candidates: response.blueprints,
    historicalSummaries: input.historicalSummaries
  });
  if (memory.status !== 'ranked_shadow_only') {
    return {
      orchestratorVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION,
      status: 'rejected_memory_input',
      blockers: [memory.status],
      responseStatus: response.status,
      memoryStatus: memory.status,
      selectedBlueprintFingerprint: null,
      selectedBlueprintDigest: null,
      cycleEvidenceDigest: null,
      providerCallAuthorized: false,
      productionGenerationAuthorized: false,
      publicationAuthorized: false,
      rawResponseRetained: false,
      productionGateImpact: 'none_shadow_only'
    };
  }
  const selectedFingerprint = clean(memory.suggestedSelection);
  const selected = response.blueprints.find((item) => item.blueprintFingerprint === selectedFingerprint);
  if (!selectedFingerprint || !selected) {
    return {
      orchestratorVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION,
      status: 'no_novel_blueprint_candidate',
      blockers: ['all_response_candidates_duplicate_or_rename_only_against_history'],
      responseStatus: response.status,
      memoryStatus: memory.status,
      acceptedResponseCandidateCount: response.acceptedCandidateCount,
      rankableNovelCandidateCount: 0,
      selectedBlueprintFingerprint: null,
      selectedBlueprintDigest: null,
      cycleEvidenceDigest: null,
      providerCallAuthorized: false,
      productionGenerationAuthorized: false,
      publicationAuthorized: false,
      rawResponseRetained: false,
      productionGateImpact: 'none_shadow_only'
    };
  }
  const rankable = memory.rankedCandidates.filter((item) => item.decision === 'rankable_novel_candidate');
  const cycleEvidence = {
    orchestratorVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION,
    responseEvidenceDigest: response.responseEvidenceDigest,
    memoryPolicyVersion: memory.policyVersion,
    historicalSummaryCount: memory.historicalSummaryCount,
    rankedCandidates: memory.rankedCandidates.map((item) => ({
      blueprintFingerprint: item.blueprintFingerprint,
      decision: item.decision,
      rankingScore: item.rankingScore
    })),
    selectedBlueprintFingerprint: selectedFingerprint,
    selectedBlueprintDigest: selected.blueprintDigest
  };
  return {
    orchestratorVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION,
    status: 'selected_provisional_blueprint_shadow_only',
    blockers: [],
    responseStatus: response.status,
    memoryStatus: memory.status,
    acceptedResponseCandidateCount: response.acceptedCandidateCount,
    rankableNovelCandidateCount: rankable.length,
    selectedBlueprintFingerprint: selectedFingerprint,
    selectedBlueprintDigest: selected.blueprintDigest,
    cycleEvidenceDigest: digestFor(cycleEvidence),
    selectionBasis: 'validated_response_then_structural_history_coverage_ranking',
    selectionQuotaFrozen: false,
    providerCallAuthorized: false,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    rawResponseRetained: false,
    selectedSurfaceEmitted: false,
    productionGateImpact: 'none_shadow_only'
  };
}
