import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  subject: z.enum(['math', 'physics', 'chemistry']).optional(),
  topicCode: z.string().trim().min(1).max(80).optional()
}).passthrough();

type Phase = 'immediate' | 'retention' | 'transfer';

export const INTERVENTION_PILOT_GATE_POLICY_VERSION = 'intervention-pilot-gate-v1';
export const INTERVENTION_PILOT_GATE_THRESHOLDS = {
  minimumLearners: 10,
  minimumCompletedDeliveries: 10,
  minimumImmediateConclusive: 8,
  minimumRetentionConclusive: 5,
  minimumTransferConclusive: 5,
  minimumStabilityAssessments: 5,
  deliveryCompletionRateFloor: 0.6,
  immediatePassRateFloor: 0.65,
  retentionPassRateFloor: 0.6,
  transferPassRateFloor: 0.6,
  stableRateFloor: 0.6,
  resourceFailureRateCeiling: 0.05
} as const;

type PilotGateInput = {
  learners: number;
  deliveryCount: number;
  deliveryCompleted: number;
  deliveryCompletionRate: number | null;
  verificationCount: number;
  contentUnavailable: number;
  verificationSupplyUnavailable: number;
  phases: Array<{ phase: Phase; passed: number; failed: number; passRate: number | null }>;
  stability: { stable: number; notStable: number; inconclusive: number };
};

export function evaluateInterventionPilotGate(input: PilotGateInput) {
  const thresholds = INTERVENTION_PILOT_GATE_THRESHOLDS;
  const sampleReasonCodes: string[] = [];
  const resourceReasonCodes: string[] = [];
  const qualityReasonCodes: string[] = [];
  const phase = (name: Phase) => input.phases.find((item) => item.phase === name) ?? { phase: name, passed: 0, failed: 0, passRate: null };
  const immediate = phase('immediate');
  const retention = phase('retention');
  const transfer = phase('transfer');
  const conclusive = (item: typeof immediate) => item.passed + item.failed;
  const stabilityAssessments = input.stability.stable + input.stability.notStable;
  if (input.learners < thresholds.minimumLearners) sampleReasonCodes.push('MINIMUM_LEARNERS_NOT_MET');
  if (input.deliveryCompleted < thresholds.minimumCompletedDeliveries) sampleReasonCodes.push('MINIMUM_COMPLETED_DELIVERIES_NOT_MET');
  if (conclusive(immediate) < thresholds.minimumImmediateConclusive) sampleReasonCodes.push('MINIMUM_IMMEDIATE_VERIFICATIONS_NOT_MET');
  if (conclusive(retention) < thresholds.minimumRetentionConclusive) sampleReasonCodes.push('MINIMUM_RETENTION_VERIFICATIONS_NOT_MET');
  if (conclusive(transfer) < thresholds.minimumTransferConclusive) sampleReasonCodes.push('MINIMUM_TRANSFER_VERIFICATIONS_NOT_MET');
  if (stabilityAssessments < thresholds.minimumStabilityAssessments) sampleReasonCodes.push('MINIMUM_STABILITY_ASSESSMENTS_NOT_MET');
  if (input.deliveryCount > 0 && input.contentUnavailable / input.deliveryCount > thresholds.resourceFailureRateCeiling) resourceReasonCodes.push('CONTENT_UNAVAILABLE_RATE_ABOVE_CEILING');
  if (input.verificationCount > 0 && input.verificationSupplyUnavailable / input.verificationCount > thresholds.resourceFailureRateCeiling) resourceReasonCodes.push('VERIFICATION_SUPPLY_UNAVAILABLE_RATE_ABOVE_CEILING');
  if (input.deliveryCompleted >= thresholds.minimumCompletedDeliveries && (input.deliveryCompletionRate ?? 0) < thresholds.deliveryCompletionRateFloor) qualityReasonCodes.push('DELIVERY_COMPLETION_RATE_BELOW_FLOOR');
  if (conclusive(immediate) >= thresholds.minimumImmediateConclusive && (immediate.passRate ?? 0) < thresholds.immediatePassRateFloor) qualityReasonCodes.push('IMMEDIATE_PASS_RATE_BELOW_FLOOR');
  if (conclusive(retention) >= thresholds.minimumRetentionConclusive && (retention.passRate ?? 0) < thresholds.retentionPassRateFloor) qualityReasonCodes.push('RETENTION_PASS_RATE_BELOW_FLOOR');
  if (conclusive(transfer) >= thresholds.minimumTransferConclusive && (transfer.passRate ?? 0) < thresholds.transferPassRateFloor) qualityReasonCodes.push('TRANSFER_PASS_RATE_BELOW_FLOOR');
  if (stabilityAssessments >= thresholds.minimumStabilityAssessments && input.stability.stable / stabilityAssessments < thresholds.stableRateFloor) qualityReasonCodes.push('STABLE_RATE_BELOW_FLOOR');
  const reasonCodes = [...resourceReasonCodes, ...qualityReasonCodes, ...sampleReasonCodes];
  const recommendation = resourceReasonCodes.length > 0
    ? 'repair_resources'
    : qualityReasonCodes.length > 0
      ? 'pause_quality'
      : sampleReasonCodes.length > 0
        ? 'collect_evidence'
        : 'expand_candidate';
  return {
    policyVersion: INTERVENTION_PILOT_GATE_POLICY_VERSION,
    qualified: recommendation === 'expand_candidate',
    recommendation,
    automaticActivation: false,
    reasonCodes,
    reasonGroups: { sample: sampleReasonCodes, resources: resourceReasonCodes, quality: qualityReasonCodes },
    thresholds
  };
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

@Injectable()
export class InterventionPilotObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async report(query: unknown) {
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('；'));
    }
    const input = parsed.data;
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const requestedTopic = input.topicCode
      ? await this.prisma.cscaExamTopic.findFirst({
          where: { code: input.topicCode, ...(input.subject ? { subject: input.subject } : {}) },
          select: { id: true }
        })
      : null;
    const interventions = await this.prisma.learningIntervention.findMany({
      where: {
        createdAt: { gte: since },
        ...(input.subject ? { subjectCode: input.subject } : {}),
        ...(input.topicCode ? { topicId: requestedTopic?.id ?? -1 } : {})
      },
      select: {
        id: true, userId: true, subjectCode: true, topicId: true, status: true, createdAt: true,
        deliveries: {
          select: {
            id: true, status: true, startedAt: true, completedAt: true,
            verifications: {
              select: {
                id: true, phase: true, status: true, startedAt: true, completedAt: true,
                outcome: { select: { result: true, independent: true } }
              }
            },
            stabilityAssessment: { select: { status: true, result: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10000
    });
    const topicIds = [...new Set(interventions.map((item) => item.topicId))];
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { id: { in: topicIds } },
      select: { id: true, code: true, title: true, subject: true }
    });
    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    const groups = new Map<string, typeof interventions>();
    for (const item of interventions) {
      const key = `${item.subjectCode}:${item.topicId}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    const rows = [...groups.values()].map((items) => {
      const sample = items[0];
      const topic = topicMap.get(sample.topicId);
      const deliveries = items.flatMap((item) => item.deliveries);
      const verifications = deliveries.flatMap((delivery) => delivery.verifications);
      const outcomes = verifications.flatMap((verification) => verification.outcome ? [verification.outcome] : []);
      const conclusive = outcomes.filter((outcome) => outcome.result === 'passed' || outcome.result === 'failed');
      const phases = (['immediate', 'retention', 'transfer'] as Phase[]).map((phase) => {
        const scoped = verifications.filter((verification) => verification.phase === phase);
        const scopedOutcomes = scoped.flatMap((verification) => verification.outcome ? [verification.outcome] : []);
        const scopedConclusive = scopedOutcomes.filter((outcome) => outcome.result === 'passed' || outcome.result === 'failed');
        return {
          phase,
          scheduled: scoped.filter((verification) => verification.status === 'scheduled').length,
          ready: scoped.filter((verification) => verification.status === 'recommended').length,
          started: scoped.filter((verification) => ['starting', 'started'].includes(verification.status)).length,
          supplyUnavailable: scoped.filter((verification) => verification.status === 'supply_unavailable').length,
          completed: scoped.filter((verification) => verification.status === 'completed').length,
          passed: scopedOutcomes.filter((outcome) => outcome.result === 'passed').length,
          failed: scopedOutcomes.filter((outcome) => outcome.result === 'failed').length,
          inconclusive: scopedOutcomes.filter((outcome) => outcome.result === 'inconclusive').length,
          passRate: rate(scopedOutcomes.filter((outcome) => outcome.result === 'passed').length, scopedConclusive.length)
        };
      });
      const stable = deliveries.filter((delivery) => delivery.stabilityAssessment?.result === 'stable').length;
      const notStable = deliveries.filter((delivery) => delivery.stabilityAssessment?.result === 'not_stable').length;
      const stabilityInconclusive = deliveries.filter((delivery) => delivery.stabilityAssessment?.result === 'inconclusive').length;
      const blockers = {
        contentUnavailable: deliveries.filter((delivery) => delivery.status === 'content_unavailable').length,
        deliveryNotStarted: deliveries.filter((delivery) => ['offered', 'deferred'].includes(delivery.status)).length,
        verificationSupplyUnavailable: verifications.filter((verification) => verification.status === 'supply_unavailable').length,
        verificationNotStarted: verifications.filter((verification) => ['scheduled', 'recommended'].includes(verification.status)).length,
        failed: outcomes.filter((outcome) => outcome.result === 'failed').length,
        evidenceInsufficient: outcomes.filter((outcome) => outcome.result === 'inconclusive').length
      };
      const status = stable > 0
        ? 'stable'
        : blockers.contentUnavailable > 0 || blockers.verificationSupplyUnavailable > 0
          ? 'blocked'
          : conclusive.length > 0 || deliveries.some((delivery) => delivery.status === 'completed')
            ? 'collecting'
            : 'not_started';
      const funnel = {
        proposed: items.length,
        deliveryOffered: deliveries.filter((delivery) => delivery.status !== 'content_unavailable').length,
        deliveryStarted: deliveries.filter((delivery) => Boolean(delivery.startedAt) || ['in_progress', 'completed'].includes(delivery.status)).length,
        deliveryCompleted: deliveries.filter((delivery) => delivery.status === 'completed' || Boolean(delivery.completedAt)).length,
        verificationStarted: verifications.filter((verification) => Boolean(verification.startedAt) || ['starting', 'started', 'completed'].includes(verification.status)).length,
        verificationCompleted: verifications.filter((verification) => verification.status === 'completed' || Boolean(verification.completedAt)).length,
        verificationPassed: outcomes.filter((outcome) => outcome.result === 'passed').length,
        stable
      };
      const rates = {
        deliveryStartRate: rate(funnel.deliveryStarted, deliveries.length),
        deliveryCompletionRate: rate(funnel.deliveryCompleted, deliveries.length),
        verificationPassRate: rate(funnel.verificationPassed, conclusive.length)
      };
      const stability = {
        stable, notStable, inconclusive: stabilityInconclusive,
        pending: deliveries.filter((delivery) => !delivery.stabilityAssessment || delivery.stabilityAssessment.status !== 'completed').length
      };
      const gate = evaluateInterventionPilotGate({
        learners: new Set(items.map((item) => item.userId)).size,
        deliveryCount: deliveries.length,
        deliveryCompleted: funnel.deliveryCompleted,
        deliveryCompletionRate: rates.deliveryCompletionRate,
        verificationCount: verifications.length,
        contentUnavailable: blockers.contentUnavailable,
        verificationSupplyUnavailable: blockers.verificationSupplyUnavailable,
        phases,
        stability
      });
      return {
        subject: sample.subjectCode,
        topicId: sample.topicId,
        topicCode: topic?.code ?? `topic-${sample.topicId}`,
        topicTitle: topic?.title ?? `Topic ${sample.topicId}`,
        status,
        learners: new Set(items.map((item) => item.userId)).size,
        funnel,
        rates,
        deliveryStatuses: countBy(deliveries.map((delivery) => delivery.status)),
        verificationStatuses: countBy(verifications.map((verification) => verification.status)),
        phases,
        stability,
        blockers,
        gate
      };
    }).sort((a, b) => {
      const order = { blocked: 0, collecting: 1, not_started: 2, stable: 3 } as const;
      return order[a.status as keyof typeof order] - order[b.status as keyof typeof order]
        || b.funnel.proposed - a.funnel.proposed;
    });

    const totals = rows.reduce((result, row) => ({
      proposed: result.proposed + row.funnel.proposed,
      deliveryCompleted: result.deliveryCompleted + row.funnel.deliveryCompleted,
      verificationCompleted: result.verificationCompleted + row.funnel.verificationCompleted,
      verificationPassed: result.verificationPassed + row.funnel.verificationPassed,
      stable: result.stable + row.funnel.stable,
      contentUnavailable: result.contentUnavailable + row.blockers.contentUnavailable,
      supplyUnavailable: result.supplyUnavailable + row.blockers.verificationSupplyUnavailable,
      evidenceInsufficient: result.evidenceInsufficient + row.blockers.evidenceInsufficient
    }), { proposed: 0, deliveryCompleted: 0, verificationCompleted: 0, verificationPassed: 0, stable: 0, contentUnavailable: 0, supplyUnavailable: 0, evidenceInsufficient: 0 });
    return {
      schemaVersion: '1' as const,
      window: { days: input.days, since: since.toISOString(), generatedAt: new Date().toISOString() },
      filters: { subject: input.subject ?? null, topicCode: input.topicCode ?? null },
      summary: {
        topicCount: rows.length,
        learnerCount: new Set(interventions.map((item) => item.userId)).size,
        statusCounts: countBy(rows.map((row) => row.status)),
        gateRecommendationCounts: countBy(rows.map((row) => row.gate.recommendation)),
        ...totals
      },
      gatePolicy: { policyVersion: INTERVENTION_PILOT_GATE_POLICY_VERSION, thresholds: INTERVENTION_PILOT_GATE_THRESHOLDS, automaticActivation: false },
      topics: rows
    };
  }
}
