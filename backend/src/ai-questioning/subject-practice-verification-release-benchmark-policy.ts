export const SUBJECT_PRACTICE_VERIFICATION_RELEASE_BENCHMARK_POLICY_VERSION = 'subject-practice-verification-release-benchmark-policy-v2';

export const SUBJECT_PRACTICE_VERIFICATION_RELEASE_THRESHOLDS = {
  minimumProgrammaticGold: 50,
  minimumScopedGold: 40,
  minimumMutationCases: 200,
  minimumOfficialHoldout: 40,
  minimumOfficialHoldoutPerScope: 8,
  minimumOfficialVerificationRate: 0.95,
  maximumOfficialAbstentionRate: 0.05,
  maximumFalseAccepts: 0
} as const;

export type SubjectPracticeVerificationReleaseBinding = {
  subject: string;
  taskFamily: string;
  solverVersion: string;
  verificationScopeVersion: string;
  questionPlanPolicyVersion: string;
  benchmarkVersion: string;
};

export type SubjectPracticeVerificationReleaseEvidence = {
  binding: SubjectPracticeVerificationReleaseBinding;
  isolation: {
    sealedBeforeSolverVersion: boolean;
    answersHiddenDuringDevelopment: boolean;
    developmentFixturesExcluded: boolean;
    immutableContentHashesPresent: boolean;
  };
  programmatic: {
    goldTotal: number;
    goldPassed: number;
    scopedGoldTotal: number;
    scopedGoldPassed: number;
  };
  mutation: {
    total: number;
    detected: number;
    falseAccepts: number;
    scopedFalseAccepts: number;
    mutationTypes: string[];
  };
  officialHoldout: {
    total: number;
    verified: number;
    abstained: number;
    falseAccepts: number;
    perScopeCounts: Record<string, number>;
  };
};

export type SubjectPracticeVerificationReleaseDecision = {
  policyVersion: string;
  status: 'qualified' | 'not_qualified';
  qualified: boolean;
  reasonCodes: string[];
  metrics: {
    programmaticGoldPassRate: number | null;
    scopedGoldPassRate: number | null;
    mutationDetectionRate: number | null;
    officialVerificationRate: number | null;
    officialAbstentionRate: number | null;
    officialScopeCount: number;
  };
  thresholds: typeof SUBJECT_PRACTICE_VERIFICATION_RELEASE_THRESHOLDS;
};

export const SUBJECT_PRACTICE_MATH_ELEMENTARY_REQUIRED_MUTATION_TYPES = [
  'generator_answer_flip',
  'second_true_option',
  'unsupported_function_form',
  'cross_property_true_option'
] as const;

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function sameBinding(expected: SubjectPracticeVerificationReleaseBinding, actual: SubjectPracticeVerificationReleaseBinding) {
  return (Object.keys(expected) as Array<keyof SubjectPracticeVerificationReleaseBinding>)
    .every((key) => Boolean(String(expected[key] ?? '').trim()) && expected[key] === actual[key]);
}

export function subjectPracticeVerificationReleaseDecision(input: {
  expectedBinding: SubjectPracticeVerificationReleaseBinding;
  expectedScopeIds: string[];
  requiredMutationTypes: string[];
  evidence: SubjectPracticeVerificationReleaseEvidence;
}): SubjectPracticeVerificationReleaseDecision {
  const { expectedBinding, evidence } = input;
  const thresholds = SUBJECT_PRACTICE_VERIFICATION_RELEASE_THRESHOLDS;
  const programmaticGoldTotal = finiteNonNegative(evidence.programmatic.goldTotal);
  const programmaticGoldPassed = finiteNonNegative(evidence.programmatic.goldPassed);
  const scopedGoldTotal = finiteNonNegative(evidence.programmatic.scopedGoldTotal);
  const scopedGoldPassed = finiteNonNegative(evidence.programmatic.scopedGoldPassed);
  const mutationTotal = finiteNonNegative(evidence.mutation.total);
  const mutationDetected = finiteNonNegative(evidence.mutation.detected);
  const officialTotal = finiteNonNegative(evidence.officialHoldout.total);
  const officialVerified = finiteNonNegative(evidence.officialHoldout.verified);
  const officialAbstained = finiteNonNegative(evidence.officialHoldout.abstained);
  const expectedScopeIds = Array.from(new Set((input.expectedScopeIds ?? []).map((value) => String(value ?? '').trim()).filter(Boolean)));
  const requiredMutationTypes = Array.from(new Set((input.requiredMutationTypes ?? []).map((value) => String(value ?? '').trim()).filter(Boolean)));
  const officialScopeCounts = expectedScopeIds.map((scopeId) => finiteNonNegative(evidence.officialHoldout.perScopeCounts?.[scopeId]));
  const metrics = {
    programmaticGoldPassRate: rate(programmaticGoldPassed, programmaticGoldTotal),
    scopedGoldPassRate: rate(scopedGoldPassed, scopedGoldTotal),
    mutationDetectionRate: rate(mutationDetected, mutationTotal),
    officialVerificationRate: rate(officialVerified, officialTotal),
    officialAbstentionRate: rate(officialAbstained, officialTotal),
    officialScopeCount: expectedScopeIds.filter((scopeId) => Object.prototype.hasOwnProperty.call(evidence.officialHoldout.perScopeCounts ?? {}, scopeId)).length
  };
  const reasonCodes: string[] = [];
  if (!sameBinding(expectedBinding, evidence.binding)) reasonCodes.push('verification_release_binding_mismatch');
  if (!evidence.isolation.sealedBeforeSolverVersion) reasonCodes.push('verification_release_holdout_not_presealed');
  if (!evidence.isolation.answersHiddenDuringDevelopment) reasonCodes.push('verification_release_holdout_answers_exposed_during_development');
  if (!evidence.isolation.developmentFixturesExcluded) reasonCodes.push('verification_release_development_fixtures_not_excluded');
  if (!evidence.isolation.immutableContentHashesPresent) reasonCodes.push('verification_release_content_hashes_missing');
  if (programmaticGoldTotal < thresholds.minimumProgrammaticGold || programmaticGoldPassed !== programmaticGoldTotal) {
    reasonCodes.push('verification_release_programmatic_gold_threshold_not_met');
  }
  if (scopedGoldTotal < thresholds.minimumScopedGold || scopedGoldPassed !== scopedGoldTotal) {
    reasonCodes.push('verification_release_scoped_gold_threshold_not_met');
  }
  const mutationTypes = new Set(evidence.mutation.mutationTypes ?? []);
  if (requiredMutationTypes.length === 0) {
    reasonCodes.push('verification_release_required_mutation_contract_missing');
  } else if (requiredMutationTypes.some((type) => !mutationTypes.has(type))) {
    reasonCodes.push('verification_release_required_mutation_type_missing');
  }
  if (mutationTotal < thresholds.minimumMutationCases
    || mutationDetected !== mutationTotal
    || finiteNonNegative(evidence.mutation.falseAccepts) > thresholds.maximumFalseAccepts
    || finiteNonNegative(evidence.mutation.scopedFalseAccepts) > thresholds.maximumFalseAccepts) {
    reasonCodes.push('verification_release_mutation_threshold_not_met');
  }
  if (officialTotal < thresholds.minimumOfficialHoldout) reasonCodes.push('verification_release_official_holdout_size_insufficient');
  if (expectedScopeIds.length === 0
    || metrics.officialScopeCount !== expectedScopeIds.length
    || officialScopeCounts.some((count) => count < thresholds.minimumOfficialHoldoutPerScope)) {
    reasonCodes.push('verification_release_official_scope_coverage_insufficient');
  }
  if (finiteNonNegative(evidence.officialHoldout.falseAccepts) > thresholds.maximumFalseAccepts) {
    reasonCodes.push('verification_release_official_false_accept_detected');
  }
  if (metrics.officialVerificationRate === null || metrics.officialVerificationRate < thresholds.minimumOfficialVerificationRate) {
    reasonCodes.push('verification_release_official_verification_rate_below_threshold');
  }
  if (metrics.officialAbstentionRate === null || metrics.officialAbstentionRate > thresholds.maximumOfficialAbstentionRate) {
    reasonCodes.push('verification_release_official_abstention_rate_above_threshold');
  }
  const qualified = reasonCodes.length === 0;
  return {
    policyVersion: SUBJECT_PRACTICE_VERIFICATION_RELEASE_BENCHMARK_POLICY_VERSION,
    status: qualified ? 'qualified' : 'not_qualified',
    qualified,
    reasonCodes,
    metrics,
    thresholds
  };
}
