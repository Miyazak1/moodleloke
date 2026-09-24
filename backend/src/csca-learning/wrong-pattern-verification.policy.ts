export const WRONG_PATTERN_MINIMUM_VERIFICATION_GAP_MS = 24 * 60 * 60 * 1000;
export const WRONG_PATTERN_REQUIRED_CONSECUTIVE_PASSES = 2;
export const WRONG_PATTERN_MINIMUM_TARGET_ITEMS = 3;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function decideWrongPatternVerification(input: {
  passed: boolean;
  occurredAt: Date;
  metadata: unknown;
}) {
  const metadata = record(input.metadata);
  const previousCount = Math.max(0, Math.floor(Number(metadata.consecutiveVerificationPassCount ?? 0) || 0));
  const previousPassedAt = validDate(metadata.lastVerificationPassedAt);
  const separatedFromPreviousPass = previousPassedAt
    ? input.occurredAt.getTime() - previousPassedAt.getTime() >= WRONG_PATTERN_MINIMUM_VERIFICATION_GAP_MS
    : false;
  const consecutivePassCount = input.passed
    ? previousCount === 0
      ? 1
      : separatedFromPreviousPass
        ? previousCount + 1
        : previousCount
    : 0;
  const resolved = input.passed && consecutivePassCount >= WRONG_PATTERN_REQUIRED_CONSECUTIVE_PASSES;
  return {
    resolved,
    consecutivePassCount,
    nextReviewDelayDays: resolved ? null : input.passed ? 3 : 2,
    metadata: {
      consecutiveVerificationPassCount: consecutivePassCount,
      requiredConsecutiveVerificationPassCount: WRONG_PATTERN_REQUIRED_CONSECUTIVE_PASSES,
      lastVerificationPassedAt: input.passed ? input.occurredAt.toISOString() : null,
      verificationCompletedAt: resolved ? input.occurredAt.toISOString() : null,
      verificationFailedAt: input.passed ? null : input.occurredAt.toISOString(),
      lastReviewCompletedAt: typeof metadata.lastReviewCompletedAt === 'string'
        ? metadata.lastReviewCompletedAt
        : input.occurredAt.toISOString()
    }
  };
}
