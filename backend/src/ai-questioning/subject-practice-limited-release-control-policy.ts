export const SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION =
  'subject-practice-limited-release-control-v1';

export const SUBJECT_PRACTICE_LIMITED_RELEASE_DEFAULTS = {
  maximumApprovalsPerHour: 3,
  maximumApprovalsPerDay: 12,
  qualityWindowSize: 20,
  minimumQualitySampleSize: 8,
  minimumPublishableRate: 0.95,
  maximumConsecutiveFailures: 2,
  maximumLeakageFailures: 0,
  maximumUnexpectedFailures: 0
} as const;

export type SubjectPracticeLimitedReleaseIdentity = {
  subject: string;
  taskFamily: string;
  planTemplate: string;
};

export type SubjectPracticeLimitedReleaseRuntimeConfig = {
  enabled: boolean;
  allowedExactPlans: string[];
  qualifiedExactPlans: string[];
  maximumApprovalsPerHour: number;
  maximumApprovalsPerDay: number;
  qualityWindowSize: number;
  minimumQualitySampleSize: number;
  minimumPublishableRate: number;
  maximumConsecutiveFailures: number;
  maximumLeakageFailures: number;
  maximumUnexpectedFailures: number;
};

export type SubjectPracticeLimitedReleaseMetrics = {
  admissionsInPreviousHour: number;
  admissionsInPreviousDay: number;
  recentAttemptedCount: number;
  recentPublishableCount: number;
  consecutiveFailureCount: number;
  leakageFailureCount: number;
  unexpectedFailureCount: number;
};

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function positiveInteger(value: unknown, fallback: number, maximum = 10_000) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function rate(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function enabled(value: unknown) {
  return value === true || value === 'true' || value === '1';
}

export function subjectPracticeLimitedReleaseExactPlanKey(
  identity: SubjectPracticeLimitedReleaseIdentity
) {
  return [identity.subject, identity.taskFamily, identity.planTemplate].map(clean).join(':');
}

function exactPlanList(value: unknown) {
  return Array.from(new Set(String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.split(':').length === 3 && !item.split(':').some((part) => !part))));
}

export function subjectPracticeLimitedReleaseRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): SubjectPracticeLimitedReleaseRuntimeConfig {
  const defaults = SUBJECT_PRACTICE_LIMITED_RELEASE_DEFAULTS;
  return {
    enabled: enabled(env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_ENABLED),
    allowedExactPlans: exactPlanList(env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_EXACT_PLAN_ALLOWLIST),
    qualifiedExactPlans: exactPlanList(env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_QUALIFIED_EXACT_PLANS),
    maximumApprovalsPerHour: positiveInteger(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_MAX_APPROVALS_PER_HOUR,
      defaults.maximumApprovalsPerHour,
      100
    ),
    maximumApprovalsPerDay: positiveInteger(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_MAX_APPROVALS_PER_DAY,
      defaults.maximumApprovalsPerDay,
      1_000
    ),
    qualityWindowSize: positiveInteger(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_QUALITY_WINDOW_SIZE,
      defaults.qualityWindowSize,
      200
    ),
    minimumQualitySampleSize: positiveInteger(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_MINIMUM_QUALITY_SAMPLE_SIZE,
      defaults.minimumQualitySampleSize,
      200
    ),
    minimumPublishableRate: rate(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_MINIMUM_PUBLISHABLE_RATE,
      defaults.minimumPublishableRate
    ),
    maximumConsecutiveFailures: positiveInteger(
      env.CSCA_SUBJECT_PRACTICE_LIMITED_RELEASE_MAXIMUM_CONSECUTIVE_FAILURES,
      defaults.maximumConsecutiveFailures,
      20
    ),
    maximumLeakageFailures: 0,
    maximumUnexpectedFailures: 0
  };
}

export function subjectPracticeLimitedReleaseAdmissionDecision(input: {
  identity: SubjectPracticeLimitedReleaseIdentity;
  generatorProvider: unknown;
  workClass: unknown;
  suppressStudentPublication: unknown;
  automatedCandidateLeakageStatus: unknown;
  config: SubjectPracticeLimitedReleaseRuntimeConfig;
  metrics: SubjectPracticeLimitedReleaseMetrics;
}) {
  const exactPlanKey = subjectPracticeLimitedReleaseExactPlanKey(input.identity);
  const config = input.config;
  const metrics = input.metrics;
  const reasons: string[] = [];
  if (!clean(input.identity.subject) || !clean(input.identity.taskFamily) || !clean(input.identity.planTemplate)) {
    reasons.push('limited_release_exact_identity_incomplete');
  }
  if (clean(input.generatorProvider) !== 'local-deterministic') reasons.push('limited_release_generator_not_local_deterministic');
  if (clean(input.workClass) === 'observation' || input.suppressStudentPublication === true) {
    reasons.push('limited_release_observation_or_publication_suppressed');
  }
  if (!config.enabled) reasons.push('limited_release_disabled');
  if (!config.allowedExactPlans.includes(exactPlanKey)) reasons.push('limited_release_exact_plan_not_allowlisted');
  if (!config.qualifiedExactPlans.includes(exactPlanKey)) reasons.push('limited_release_exact_plan_not_qualified');
  if (clean(input.automatedCandidateLeakageStatus) !== 'clear') {
    reasons.push('limited_release_current_candidate_leakage_not_clear');
  }
  if (metrics.admissionsInPreviousHour >= config.maximumApprovalsPerHour) {
    reasons.push('limited_release_hourly_traffic_cap_reached');
  }
  if (metrics.admissionsInPreviousDay >= config.maximumApprovalsPerDay) {
    reasons.push('limited_release_daily_traffic_cap_reached');
  }
  const recentPublishableRate = metrics.recentAttemptedCount > 0
    ? metrics.recentPublishableCount / metrics.recentAttemptedCount
    : null;
  const circuitReasons: string[] = [];
  if (metrics.leakageFailureCount > config.maximumLeakageFailures) {
    circuitReasons.push('limited_release_leakage_circuit_open');
  }
  if (metrics.unexpectedFailureCount > config.maximumUnexpectedFailures) {
    circuitReasons.push('limited_release_unexpected_failure_circuit_open');
  }
  if (metrics.consecutiveFailureCount >= config.maximumConsecutiveFailures) {
    circuitReasons.push('limited_release_consecutive_failure_circuit_open');
  }
  if (metrics.recentAttemptedCount >= config.minimumQualitySampleSize
    && recentPublishableRate !== null
    && recentPublishableRate < config.minimumPublishableRate) {
    circuitReasons.push('limited_release_publishable_rate_circuit_open');
  }
  reasons.push(...circuitReasons);
  const circuitBreakerOpen = circuitReasons.length > 0;
  return {
    policyVersion: SUBJECT_PRACTICE_LIMITED_RELEASE_CONTROL_POLICY_VERSION,
    exactPlanKey,
    allowed: reasons.length === 0,
    decision: reasons.length === 0 ? 'admit_single_candidate' : 'deny_fail_closed',
    reasons: Array.from(new Set(reasons)),
    traffic: {
      admissionsInPreviousHour: Math.max(0, Number(metrics.admissionsInPreviousHour) || 0),
      maximumApprovalsPerHour: config.maximumApprovalsPerHour,
      admissionsInPreviousDay: Math.max(0, Number(metrics.admissionsInPreviousDay) || 0),
      maximumApprovalsPerDay: config.maximumApprovalsPerDay
    },
    qualityCircuitBreaker: {
      open: circuitBreakerOpen,
      automaticRollbackApplied: circuitBreakerOpen,
      qualityWindowSize: config.qualityWindowSize,
      minimumQualitySampleSize: config.minimumQualitySampleSize,
      recentAttemptedCount: metrics.recentAttemptedCount,
      recentPublishableCount: metrics.recentPublishableCount,
      recentPublishableRate,
      minimumPublishableRate: config.minimumPublishableRate,
      consecutiveFailureCount: metrics.consecutiveFailureCount,
      maximumConsecutiveFailures: config.maximumConsecutiveFailures,
      leakageFailureCount: metrics.leakageFailureCount,
      unexpectedFailureCount: metrics.unexpectedFailureCount
    },
    invariants: {
      enabledByDefault: false,
      exactFamilyAllowlistRequired: true,
      separateQualificationAllowlistRequired: true,
      currentCandidateLeakageClearRequired: true,
      admissionIsPerCandidate: true,
      trafficSlotReservedBeforeApproval: true,
      automaticRollbackMeansStopFurtherAdmissions: true,
      bypassesFormalPublicationGate: false
    }
  } as const;
}
