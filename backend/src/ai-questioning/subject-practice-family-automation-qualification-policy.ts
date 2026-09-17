export const SUBJECT_PRACTICE_FAMILY_AUTOMATION_QUALIFICATION_POLICY_VERSION =
  'subject-practice-family-automation-qualification-v1';

export const SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS = {
  minimumOfflineCasesPerScope: 128,
  minimumMutationCasesPerType: 32,
  minimumRealShadowCasesPerScope: 8,
  minimumRealShadowCandidateYieldRate: 0.95,
  minimumRealShadowPublishableRate: 0.95,
  maximumFalseAccepts: 0,
  maximumScopeLeakage: 0,
  maximumUnexpectedFailures: 0
} as const;

export type SubjectPracticeFamilyAutomationEvidence = {
  subject: string;
  taskFamily: string;
  planTemplate: string;
  expectedScopeIds: string[];
  contract: {
    registered: boolean;
    exactBindingMatched: boolean;
    localDeterministicRoute: boolean;
    providerAttemptLimit: number;
  };
  runtimeIsolation: {
    generatorCannotReadOfficialQuestionContent: boolean;
    reversibleSourceFieldsOmitted: boolean;
    sourceLinkageIdentifiersOmitted: boolean;
    questionPlanRequired: boolean;
    unsupportedInputAbstains: boolean;
  };
  deterministicVerification: {
    solverVerified: boolean;
    independentOracleVerified: boolean;
    explanationVerified: boolean;
    uniqueAnswerVerified: boolean;
    generatorAnswerAgreementVerified: boolean;
  };
  offlineEvidence: {
    perScopeCounts: Record<string, number>;
    failedCount: number;
    mutationPerTypeCounts: Record<string, number>;
    mutationFalseAccepts: number;
  };
  automatedLeakageGate: {
    available: boolean;
    failClosed: boolean;
    currentKnownCorpusCompared: boolean;
    matchedCount: number;
  };
  realProductionShadow: {
    publicationSuppressed: boolean;
    perScopeCounts: Record<string, number>;
    requestedCount: number;
    candidateCount: number;
    publishableCount: number;
    falseAccepts: number;
    scopeLeakageCount: number;
    unexpectedFailureCount: number;
  };
  limitedReleaseControls: {
    exactFamilyAllowlist: boolean;
    smallTrafficCap: boolean;
    automaticRollback: boolean;
    qualityCircuitBreaker: boolean;
  };
  advisoryEvidence?: {
    humanBlindAuditComplete?: boolean;
    corpusTopologyAttested?: boolean;
    corpusConflictResolutionComplete?: boolean;
    translationCoverageComplete?: boolean;
  };
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function subjectPracticeFamilyAutomationQualificationDecision(
  evidence: SubjectPracticeFamilyAutomationEvidence
) {
  const thresholds = SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS;
  const expectedScopeIds = Array.from(new Set((evidence.expectedScopeIds ?? []).map(clean).filter(Boolean)));
  const shadowBlockers: string[] = [];
  if (!clean(evidence.subject) || !clean(evidence.taskFamily) || !clean(evidence.planTemplate)) {
    shadowBlockers.push('family_identity_incomplete');
  }
  if (!evidence.contract.registered || !evidence.contract.exactBindingMatched) {
    shadowBlockers.push('exact_registered_contract_missing');
  }
  if (!evidence.contract.localDeterministicRoute || evidence.contract.providerAttemptLimit !== 0) {
    shadowBlockers.push('zero_provider_local_route_not_proven');
  }
  if (!evidence.runtimeIsolation.generatorCannotReadOfficialQuestionContent
    || !evidence.runtimeIsolation.reversibleSourceFieldsOmitted
    || !evidence.runtimeIsolation.sourceLinkageIdentifiersOmitted) {
    shadowBlockers.push('formal_generation_source_isolation_not_proven');
  }
  if (!evidence.runtimeIsolation.questionPlanRequired) shadowBlockers.push('question_plan_not_mandatory');
  if (!evidence.runtimeIsolation.unsupportedInputAbstains) shadowBlockers.push('unsupported_input_fail_open');
  if (!evidence.deterministicVerification.solverVerified
    || !evidence.deterministicVerification.independentOracleVerified
    || !evidence.deterministicVerification.explanationVerified
    || !evidence.deterministicVerification.uniqueAnswerVerified
    || !evidence.deterministicVerification.generatorAnswerAgreementVerified) {
    shadowBlockers.push('deterministic_verification_chain_incomplete');
  }
  const offlineCounts = expectedScopeIds.map((scopeId) => finiteNonNegative(evidence.offlineEvidence.perScopeCounts?.[scopeId]));
  if (!expectedScopeIds.length
    || offlineCounts.some((count) => count < thresholds.minimumOfflineCasesPerScope)
    || finiteNonNegative(evidence.offlineEvidence.failedCount) > 0) {
    shadowBlockers.push('offline_per_scope_threshold_not_met');
  }
  const mutationTypeCounts = Object.values(evidence.offlineEvidence.mutationPerTypeCounts ?? {})
    .map(finiteNonNegative);
  if (!mutationTypeCounts.length
    || mutationTypeCounts.some((count) => count < thresholds.minimumMutationCasesPerType)
    || finiteNonNegative(evidence.offlineEvidence.mutationFalseAccepts) > thresholds.maximumFalseAccepts) {
    shadowBlockers.push('mutation_fail_closed_threshold_not_met');
  }

  const automaticShadowEligible = shadowBlockers.length === 0;
  const limitedReleaseBlockers = [...shadowBlockers];
  if (!evidence.automatedLeakageGate.available
    || !evidence.automatedLeakageGate.failClosed
    || !evidence.automatedLeakageGate.currentKnownCorpusCompared
    || finiteNonNegative(evidence.automatedLeakageGate.matchedCount) > 0) {
    limitedReleaseBlockers.push('automated_candidate_leakage_gate_missing_or_failed');
  }
  const realShadowCounts = expectedScopeIds.map((scopeId) =>
    finiteNonNegative(evidence.realProductionShadow.perScopeCounts?.[scopeId]));
  const requestedCount = finiteNonNegative(evidence.realProductionShadow.requestedCount);
  const candidateCount = finiteNonNegative(evidence.realProductionShadow.candidateCount);
  const publishableCount = finiteNonNegative(evidence.realProductionShadow.publishableCount);
  const candidateYieldRate = rate(candidateCount, requestedCount);
  const publishableRate = rate(publishableCount, requestedCount);
  if (!evidence.realProductionShadow.publicationSuppressed
    || !realShadowCounts.length
    || realShadowCounts.some((count) => count < thresholds.minimumRealShadowCasesPerScope)
    || candidateYieldRate === null
    || candidateYieldRate < thresholds.minimumRealShadowCandidateYieldRate
    || publishableRate === null
    || publishableRate < thresholds.minimumRealShadowPublishableRate
    || finiteNonNegative(evidence.realProductionShadow.falseAccepts) > thresholds.maximumFalseAccepts
    || finiteNonNegative(evidence.realProductionShadow.scopeLeakageCount) > thresholds.maximumScopeLeakage
    || finiteNonNegative(evidence.realProductionShadow.unexpectedFailureCount) > thresholds.maximumUnexpectedFailures) {
    limitedReleaseBlockers.push('real_production_shadow_threshold_not_met');
  }
  if (!evidence.limitedReleaseControls.exactFamilyAllowlist
    || !evidence.limitedReleaseControls.smallTrafficCap
    || !evidence.limitedReleaseControls.automaticRollback
    || !evidence.limitedReleaseControls.qualityCircuitBreaker) {
    limitedReleaseBlockers.push('limited_release_operational_controls_incomplete');
  }
  const limitedReleaseEligible = limitedReleaseBlockers.length === 0;
  return {
    policyVersion: SUBJECT_PRACTICE_FAMILY_AUTOMATION_QUALIFICATION_POLICY_VERSION,
    qualificationScope: 'exact_subject_task_family_plan_template',
    status: limitedReleaseEligible
      ? 'limited_release_eligible'
      : automaticShadowEligible
        ? 'automatic_shadow_eligible'
        : 'blocked',
    automaticShadowEligible,
    limitedReleaseEligible,
    shadowBlockers,
    limitedReleaseBlockers,
    metrics: {
      minimumOfflineCasesPerScope: offlineCounts.length ? Math.min(...offlineCounts) : null,
      minimumMutationCasesPerType: mutationTypeCounts.length ? Math.min(...mutationTypeCounts) : null,
      minimumRealShadowCasesPerScope: realShadowCounts.length ? Math.min(...realShadowCounts) : null,
      candidateYieldRate,
      publishableRate,
      providerAttemptLimit: evidence.contract.providerAttemptLimit
    },
    nonBlockingEnhancements: {
      humanBlindAuditComplete: evidence.advisoryEvidence?.humanBlindAuditComplete === true,
      corpusTopologyAttested: evidence.advisoryEvidence?.corpusTopologyAttested === true,
      corpusConflictResolutionComplete: evidence.advisoryEvidence?.corpusConflictResolutionComplete === true,
      translationCoverageComplete: evidence.advisoryEvidence?.translationCoverageComplete === true,
      requiredForAutomaticShadow: false,
      requiredForLimitedRelease: false
    }
  };
}
