import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateTeachingAssetRoutingOutcomes, TEACHING_ASSET_ROUTING_OUTCOME_POLICY_VERSION, TeachingRoutingOutcomeObservation } from './teaching-asset-routing-outcome-policy';

const CIRCUIT_EVENT = 'teaching_asset_routing_circuit_state';
const DECISION_EVENT = 'teaching_asset_routing_decision';

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function interventionId(value: unknown) {
  const match = /^intervention:(.+)$/.exec(String(value ?? ''));
  return match?.[1] ?? null;
}

@Injectable()
export class TeachingAssetRoutingOutcomeService {
  constructor(private readonly prisma: PrismaService) {}

  async currentCircuit(subject: string) {
    const row = await this.prisma.cscaTrainingEvent.findFirst({
      where: { eventType: CIRCUIT_EVENT, source: 'agent', subject },
      select: { metadata: true, createdAt: true }, orderBy: { createdAt: 'desc' }
    });
    const metadata = objectValue(row?.metadata);
    return {
      status: metadata.status === 'tripped' ? 'tripped' as const : 'monitoring' as const,
      reasonCodes: Array.isArray(metadata.reasonCodes) ? metadata.reasonCodes.map(String) : [],
      evaluatedAt: row?.createdAt ?? null,
      manualReset: metadata.manualReset === true
    };
  }

  async activeAllowed(subject: string) {
    const circuit = await this.currentCircuit(subject);
    return { allowed: circuit.status !== 'tripped', circuit };
  }

  async report(input: { days: number; subject?: string; after?: Date }) {
    const windowStart = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const since = input.after && input.after.getTime() > windowStart.getTime() ? input.after : windowStart;
    const decisions = await this.prisma.cscaTrainingEvent.findMany({
      where: { eventType: DECISION_EVENT, source: 'agent', createdAt: { gte: since }, ...(input.subject ? { subject: input.subject } : {}) },
      select: { subject: true, metadata: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5000
    });
    const routed = decisions.map((row) => ({ row, metadata: objectValue(row.metadata), interventionId: interventionId(objectValue(row.metadata).contextKey) })).filter((item) => item.interventionId);
    const ids = [...new Set(routed.map((item) => item.interventionId as string))];
    const deliveries = ids.length ? await this.prisma.learningInterventionDelivery.findMany({
      where: { interventionId: { in: ids }, contentSourceType: 'teaching_asset' },
      select: {
        interventionId: true, status: true,
        outcomes: { select: { result: true, accuracy: true, independent: true, verification: { select: { phase: true } } } },
        stabilityAssessment: { select: { status: true, result: true } }
      }
    }) : [];
    const byIntervention = new Map(deliveries.map((item) => [item.interventionId, item]));
    const observations: TeachingRoutingOutcomeObservation[] = routed.flatMap((item) => {
      const delivery = byIntervention.get(item.interventionId as string);
      const mode = item.metadata.routingMode;
      if (!delivery || (mode !== 'legacy' && mode !== 'shadow' && mode !== 'active')) return [];
      return [{
        routingMode: mode, deliveryCompleted: delivery.status === 'completed', occurredAt: item.row.createdAt,
        outcomes: delivery.outcomes.map((outcome) => ({ phase: outcome.verification.phase, result: outcome.result, independent: outcome.independent, accuracy: outcome.accuracy })),
        stability: delivery.stabilityAssessment
      }];
    });
    const evaluation = evaluateTeachingAssetRoutingOutcomes(observations);
    const subjects = input.subject ? [input.subject] : ['math', 'physics', 'chemistry'];
    const circuitStates = Object.fromEntries(await Promise.all(subjects.map(async (subject) => [subject, await this.currentCircuit(subject)])));
    return { schemaVersion: '1' as const, window: { days: input.days, since: since.toISOString() }, observations: observations.length, ...evaluation, circuitStates };
  }

  async evaluateAndPersist(subject: string) {
    const current = await this.currentCircuit(subject);
    const report = await this.report({ days: 30, subject, ...(current.manualReset && current.evaluatedAt ? { after: current.evaluatedAt } : {}) });
    if (report.circuit.status !== 'tripped') return report;
    const sameReasons = JSON.stringify(current.reasonCodes) === JSON.stringify(report.circuit.reasonCodes);
    if (current.status !== 'tripped' || !sameReasons) await this.prisma.cscaTrainingEvent.create({
      data: {
        subject, eventType: CIRCUIT_EVENT, source: 'agent',
        metadata: { schemaVersion: '1', status: 'tripped', policyVersion: TEACHING_ASSET_ROUTING_OUTCOME_POLICY_VERSION, reasonCodes: report.circuit.reasonCodes, cohorts: report.cohorts, comparison: report.comparison, automaticActivation: false }
      }
    });
    return report;
  }

  async resetCircuit(subject: string, actorId: number, reason: string) {
    return this.prisma.cscaTrainingEvent.create({
      data: { subject, eventType: CIRCUIT_EVENT, source: 'agent', metadata: { schemaVersion: '1', status: 'monitoring', policyVersion: TEACHING_ASSET_ROUTING_OUTCOME_POLICY_VERSION, reasonCodes: [], manualReset: true, actorId, reason } }
    });
  }
}
