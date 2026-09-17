export const TEACHING_ASSET_ROUTING_OUTCOME_POLICY_VERSION = 'teaching-asset-routing-outcome-v1';

export type TeachingRoutingOutcomeObservation = {
  routingMode: 'legacy' | 'shadow' | 'active';
  deliveryCompleted: boolean;
  outcomes: Array<{ phase: string; result: string; independent: boolean; accuracy: number }>;
  stability: { status: string; result: string | null } | null;
  occurredAt: Date;
};

type Cohort = 'baseline' | 'active';

function summarize(items: TeachingRoutingOutcomeObservation[]) {
  const independent = items.flatMap((item) => item.outcomes).filter((item) => item.independent);
  const conclusive = independent.filter((item) => item.result === 'passed' || item.result === 'failed');
  const passed = conclusive.filter((item) => item.result === 'passed').length;
  const stability = items.map((item) => item.stability).filter((item): item is NonNullable<typeof item> => Boolean(item?.status === 'completed'));
  const stable = stability.filter((item) => item.result === 'stable').length;
  return {
    deliveries: items.length,
    completedDeliveries: items.filter((item) => item.deliveryCompleted).length,
    completionRate: items.length ? items.filter((item) => item.deliveryCompleted).length / items.length : null,
    independentVerifications: independent.length,
    conclusiveVerifications: conclusive.length,
    verificationPassRate: conclusive.length ? passed / conclusive.length : null,
    stabilityAssessments: stability.length,
    stableCount: stable,
    notStableCount: stability.filter((item) => item.result === 'not_stable').length,
    stableRate: stability.length ? stable / stability.length : null
  };
}

function immediateResult(item: TeachingRoutingOutcomeObservation) {
  return item.outcomes.find((outcome) => outcome.independent && outcome.phase === 'immediate' && (outcome.result === 'passed' || outcome.result === 'failed'))?.result ?? null;
}

export function evaluateTeachingAssetRoutingOutcomes(observations: TeachingRoutingOutcomeObservation[]) {
  const groups: Record<Cohort, TeachingRoutingOutcomeObservation[]> = { baseline: [], active: [] };
  for (const item of observations) groups[item.routingMode === 'active' ? 'active' : 'baseline'].push(item);
  const baseline = summarize(groups.baseline);
  const active = summarize(groups.active);
  const recentActive = [...groups.active].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  let consecutiveImmediateFailures = 0;
  for (const item of recentActive) {
    const result = immediateResult(item);
    if (!result) continue;
    if (result !== 'failed') break;
    consecutiveImmediateFailures += 1;
  }
  const reasonCodes: string[] = [];
  if (active.conclusiveVerifications >= 8 && (active.verificationPassRate ?? 1) < 0.35) reasonCodes.push('active_verification_emergency_floor');
  if (baseline.conclusiveVerifications >= 20 && active.conclusiveVerifications >= 20 && (baseline.verificationPassRate ?? 0) - (active.verificationPassRate ?? 0) >= 0.15) reasonCodes.push('active_verification_regression');
  if (active.stabilityAssessments >= 8 && (active.stableRate ?? 1) < 0.5) reasonCodes.push('active_stability_emergency_floor');
  if (baseline.stabilityAssessments >= 12 && active.stabilityAssessments >= 12 && (baseline.stableRate ?? 0) - (active.stableRate ?? 0) >= 0.2) reasonCodes.push('active_stability_regression');
  if (consecutiveImmediateFailures >= 5) reasonCodes.push('active_consecutive_immediate_failures');
  const evidenceQualified = baseline.deliveries >= 20 && active.deliveries >= 20 && baseline.conclusiveVerifications >= 10 && active.conclusiveVerifications >= 10;
  return {
    policyVersion: TEACHING_ASSET_ROUTING_OUTCOME_POLICY_VERSION,
    cohorts: { baseline, active },
    comparison: {
      verificationPassRateDelta: baseline.verificationPassRate === null || active.verificationPassRate === null ? null : active.verificationPassRate - baseline.verificationPassRate,
      stableRateDelta: baseline.stableRate === null || active.stableRate === null ? null : active.stableRate - baseline.stableRate,
      completionRateDelta: baseline.completionRate === null || active.completionRate === null ? null : active.completionRate - baseline.completionRate,
      consecutiveActiveImmediateFailures: consecutiveImmediateFailures
    },
    evidenceQualified,
    circuit: { status: reasonCodes.length ? 'tripped' as const : evidenceQualified ? 'healthy' as const : 'monitoring' as const, reasonCodes }
  };
}
