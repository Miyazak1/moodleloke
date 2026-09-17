import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { z } from 'zod';
import { AdaptiveQuestionProviderService } from '../csca-special-practice/adaptive-question-provider.service';
import { LearningReadCapabilityService } from '../learning-intelligence/capabilities/learning-read-capability.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import {
  QUESTION_SUPPLY_DEMAND_VERSION,
  QUESTION_SUPPLY_PRODUCTION_ADAPTER,
  QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION,
  QuestionSupplyDemandV1,
  QuestionSupplyDemandV1Schema,
  QuestionSupplyProductionAdapter
} from './question-supply-fulfillment.contract';

const RunSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  workerId: z.string().trim().min(3).max(120).optional()
}).strict();

const LEASE_MS = 60_000;

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((item) => Number.isInteger(item) && item > 0)
    : [];
}

@Injectable()
export class QuestionSupplyFulfillmentService {
  private readonly logger = new Logger(QuestionSupplyFulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly learningSupply: LearningReadCapabilityService,
    private readonly verificationQuestions: AdaptiveQuestionProviderService,
    @Inject(QUESTION_SUPPLY_PRODUCTION_ADAPTER) private readonly adapter: QuestionSupplyProductionAdapter
  ) {}

  async run(bodyValue: unknown, actorUserId: number | null = null) {
    this.assertEnabled();
    const input = RunSchema.parse(bodyValue ?? {});
    const workerId = input.workerId ?? `${hostname()}:${process.pid}:${actorUserId === null ? 'system' : `admin-${actorUserId}`}`;
    const reconciled = await this.reconcile(input.limit);
    const materialized = await this.materialize(input.limit, actorUserId);
    const dispatched = await this.dispatch(input.limit, workerId);
    return { schemaVersion: '1', mode: 'shadow', materialized, dispatched, reconciled };
  }

  async listPlans(limitValue: unknown = 50) {
    const limit = z.coerce.number().int().min(1).max(200).parse(limitValue);
    const items = await this.prisma.questionSupplyFulfillmentPlan.findMany({
      include: {
        request: true,
        events: { orderBy: { createdAt: 'desc' }, take: 10 }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });
    return { schemaVersion: '1', mode: 'shadow', items };
  }

  private assertEnabled() {
    if (!this.flags.isQuestionSupplyFulfillmentShadowEnabled()) {
      throw new ServiceUnavailableException({
        code: 'QUESTION_SUPPLY_FULFILLMENT_SHADOW_DISABLED',
        message: '题源补库 Shadow 消费暂未开启。'
      });
    }
  }

  private buildDemand(request: any): QuestionSupplyDemandV1 {
    const context = jsonObject(request.lastContextSnapshot);
    const identity = `${request.requestKey}:${request.cycle}:${QUESTION_SUPPLY_DEMAND_VERSION}`;
    const demandKey = createHash('sha256').update(identity).digest('hex');
    return QuestionSupplyDemandV1Schema.parse({
      schemaVersion: QUESTION_SUPPLY_DEMAND_VERSION,
      demandKey,
      requestId: request.id,
      requestCycle: request.cycle,
      source: request.source,
      subjectCode: request.subjectCode,
      topicIds: numberArray(request.topicIds),
      difficulty: request.difficulty ?? null,
      taskType: request.taskType,
      verificationPhase: request.verificationPhase ?? null,
      sourcePolicy: request.sourcePolicy,
      requestedCount: request.requestedCount,
      lastKnownAvailableCount: request.availableCount,
      deficitCount: Math.max(1, request.requestedCount - request.availableCount),
      constraints: jsonObject(context.constraints),
      observedAt: request.lastObservedAt.toISOString()
    });
  }

  private async materialize(limit: number, actorUserId: number | null) {
    const requests = await this.prisma.questionSupplyRequest.findMany({
      where: { status: { in: ['open', 'acknowledged'] } },
      orderBy: [{ observationCount: 'desc' }, { lastObservedAt: 'asc' }],
      take: limit
    });
    const results: Array<{ requestId: string; planId: string; created: boolean }> = [];
    for (const request of requests) {
      const existing = await this.prisma.questionSupplyFulfillmentPlan.findUnique({
        where: { requestId_requestCycle: { requestId: request.id, requestCycle: request.cycle } }
      });
      if (existing) {
        results.push({ requestId: request.id, planId: existing.id, created: false });
        continue;
      }
      const demand = this.buildDemand(request);
      try {
        const plan = await this.prisma.questionSupplyFulfillmentPlan.create({
          data: {
            requestId: request.id,
            requestCycle: request.cycle,
            demandKey: demand.demandKey,
            adapterVersion: QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION,
            demandSnapshot: demand as unknown as Prisma.InputJsonValue,
            events: {
              create: {
                actorUserId,
                action: 'planned',
                fromStatus: null,
                toStatus: 'planned',
                metadata: { contractVersion: QUESTION_SUPPLY_DEMAND_VERSION, mode: 'shadow' }
              }
            }
          }
        });
        results.push({ requestId: request.id, planId: plan.id, created: true });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        const raced = await this.prisma.questionSupplyFulfillmentPlan.findUniqueOrThrow({
          where: { requestId_requestCycle: { requestId: request.id, requestCycle: request.cycle } }
        });
        results.push({ requestId: request.id, planId: raced.id, created: false });
      }
    }
    return results;
  }

  private async dispatch(limit: number, workerId: string) {
    const now = new Date();
    const candidates = await this.prisma.questionSupplyFulfillmentPlan.findMany({
      where: {
        request: { status: { in: ['open', 'acknowledged'] } },
        OR: [
          { status: 'planned', nextAttemptAt: { lte: now } },
          { status: 'failed', nextAttemptAt: { lte: now } },
          { status: 'leased', leaseUntil: { lt: now } }
        ]
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit
    });
    const results: Array<Record<string, unknown>> = [];
    for (const candidate of candidates) {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.questionSupplyFulfillmentPlan.updateMany({
          where: { id: candidate.id, status: candidate.status, updatedAt: candidate.updatedAt },
          data: {
            status: 'leased', leaseOwner: workerId, leaseUntil: new Date(Date.now() + LEASE_MS),
            attemptCount: { increment: 1 }, lastErrorCode: null
          }
        });
        if (result.count !== 1) return false;
        await tx.questionSupplyFulfillmentEvent.create({
          data: {
            planId: candidate.id, action: candidate.status === 'leased' ? 'lease_recovered' : 'leased',
            fromStatus: candidate.status, toStatus: 'leased', metadata: { workerId }
          }
        });
        return true;
      });
      if (!claimed) continue;
      try {
        const demand = QuestionSupplyDemandV1Schema.parse(candidate.demandSnapshot);
        const response = await this.adapter.dispatch(demand);
        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.questionSupplyFulfillmentPlan.updateMany({
            where: { id: candidate.id, status: 'leased', leaseOwner: workerId },
            data: {
              status: 'shadow_dispatched', adapterVersion: response.adapterVersion,
              dispatchedAt: new Date(), leaseOwner: null, leaseUntil: null, lastErrorCode: null
            }
          });
          if (updated.count !== 1) throw new Error('QUESTION_SUPPLY_FULFILLMENT_LEASE_LOST');
          await tx.questionSupplyFulfillmentEvent.create({
            data: {
              planId: candidate.id, action: 'shadow_dispatched', fromStatus: 'leased', toStatus: 'shadow_dispatched',
              metadata: { adapterVersion: response.adapterVersion, generationInvoked: response.generationInvoked }
            }
          });
        });
        results.push({ planId: candidate.id, status: 'shadow_dispatched' });
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'QUESTION_SUPPLY_FULFILLMENT_FAILED';
        const delaySeconds = Math.min(3600, 2 ** Math.min(candidate.attemptCount + 1, 10));
        const failureRecorded = await this.prisma.$transaction(async (tx) => {
          const failed = await tx.questionSupplyFulfillmentPlan.updateMany({
            where: { id: candidate.id, status: 'leased', leaseOwner: workerId },
            data: {
              status: 'failed', leaseOwner: null, leaseUntil: null, lastErrorCode: errorCode,
              nextAttemptAt: new Date(Date.now() + delaySeconds * 1000)
            }
          });
          if (failed.count !== 1) return false;
          await tx.questionSupplyFulfillmentEvent.create({
            data: {
              planId: candidate.id, action: 'dispatch_failed', fromStatus: 'leased', toStatus: 'failed',
              metadata: { errorCode, retryAfterSeconds: delaySeconds }
            }
          });
          return true;
        });
        results.push({
          planId: candidate.id,
          status: failureRecorded ? 'failed' : 'lease_lost',
          ...(failureRecorded ? { errorCode } : {})
        });
      }
    }
    return results;
  }

  private async reconcile(limit: number) {
    const requests = await this.prisma.questionSupplyRequest.findMany({
      where: { status: { in: ['open', 'acknowledged'] } },
      include: { fulfillmentPlans: true },
      orderBy: { lastObservedAt: 'asc' },
      take: limit
    });
    const results: Array<Record<string, unknown>> = [];
    for (const request of requests) {
      try {
        const inventory = await this.checkInventory(request);
        if (!inventory.sufficient) {
          await this.prisma.$transaction(async (tx) => {
            await tx.questionSupplyRequest.updateMany({
              where: { id: request.id, cycle: request.cycle, status: { in: ['open', 'acknowledged'] } },
              data: { availableCount: Math.min(inventory.availableCount, request.requestedCount - 1) }
            });
            await tx.questionSupplyInventoryCheck.create({
              data: {
                requestId: request.id, requestCycle: request.cycle, result: 'still_short',
                checkerVersion: inventory.checkerVersion, requestedCount: request.requestedCount,
                availableCount: inventory.availableCount
              }
            });
          });
          results.push({ requestId: request.id, status: 'still_short', availableCount: inventory.availableCount });
          continue;
        }
        await this.prisma.$transaction(async (tx) => {
          const resolved = await tx.questionSupplyRequest.updateMany({
            where: { id: request.id, cycle: request.cycle, status: { in: ['open', 'acknowledged'] } },
            data: { status: 'resolved', resolvedAt: new Date(), resolutionNote: '审核库存自动复核已满足当前需求。' }
          });
          if (resolved.count !== 1) return;
          await tx.questionSupplyInventoryCheck.create({
            data: {
              requestId: request.id, requestCycle: request.cycle, result: 'sufficient',
              checkerVersion: inventory.checkerVersion, requestedCount: request.requestedCount,
              availableCount: inventory.availableCount
            }
          });
          await tx.questionSupplyRequestEvent.create({
            data: {
              requestId: request.id, action: 'inventory_reconciled', fromStatus: request.status, toStatus: 'resolved',
              reason: '审核库存自动复核已满足当前需求。',
              metadata: { requestCycle: request.cycle, requestedCount: request.requestedCount, availableCount: inventory.availableCount }
            }
          });
          const plan = request.fulfillmentPlans.find((item) => item.requestCycle === request.cycle);
          if (plan && plan.status !== 'completed' && plan.status !== 'cancelled') {
            await tx.questionSupplyFulfillmentPlan.update({
              where: { id: plan.id },
              data: { status: 'completed', completedAt: new Date(), leaseOwner: null, leaseUntil: null, lastErrorCode: null }
            });
            await tx.questionSupplyFulfillmentEvent.create({
              data: {
                planId: plan.id, action: 'inventory_reconciled', fromStatus: plan.status, toStatus: 'completed',
                metadata: { requestedCount: request.requestedCount, availableCount: inventory.availableCount }
              }
            });
          }
        });
        results.push({ requestId: request.id, status: 'resolved', availableCount: inventory.availableCount });
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'QUESTION_SUPPLY_RECONCILIATION_FAILED';
        this.logger.warn(`Question supply reconciliation failed for ${request.id}: ${errorCode}`);
        await this.prisma.questionSupplyInventoryCheck.create({
          data: {
            requestId: request.id, requestCycle: request.cycle, result: 'check_failed',
            checkerVersion: 'unavailable', requestedCount: request.requestedCount,
            availableCount: null, errorCode
          }
        }).catch(() => undefined);
        results.push({ requestId: request.id, status: 'check_failed', errorCode });
      }
    }
    return results;
  }

  private async checkInventory(request: any): Promise<{ sufficient: boolean; availableCount: number; checkerVersion: string }> {
    const topicIds = numberArray(request.topicIds);
    if (request.source === 'agent_today_plan') {
      const status = await this.learningSupply.getQuestionSupplyStatus({
        subject: request.subjectCode,
        topicIds,
        ...(request.difficulty ? { difficulty: request.difficulty } : {}),
        requestedCount: request.requestedCount
      });
      return {
        sufficient: status.canCreatePractice, availableCount: status.availableCount,
        checkerVersion: 'learning-read-question-supply-v1'
      };
    }
    const context = jsonObject(request.lastContextSnapshot);
    const verificationId = context.sourceEntityType === 'learning_intervention_verification'
      ? String(context.sourceEntityId ?? '') : '';
    if (!verificationId) throw new Error('QUESTION_SUPPLY_VERIFICATION_CONTEXT_MISSING');
    const verification = await this.prisma.learningInterventionVerification.findUnique({
      where: { id: verificationId }, select: { userId: true, topicId: true, phase: true, supplySnapshot: true }
    });
    if (!verification) throw new Error('QUESTION_SUPPLY_VERIFICATION_NOT_FOUND');
    const supplySnapshot = jsonObject(verification.supplySnapshot);
    const constraints = jsonObject(context.constraints);
    const selected = await this.verificationQuestions.pickIndependentVerificationQuestions(
      verification.userId,
      verification.topicId,
      request.requestedCount,
      stringArray(supplySnapshot.excludedRefs),
      {
        requireDifferentTransferSignature: verification.phase === 'transfer',
        excludedTransferSignatures: stringArray(constraints.excludedTransferSignatures)
      }
    );
    return {
      sufficient: selected.length >= request.requestedCount, availableCount: selected.length,
      checkerVersion: `intervention-independent-selection-${verification.phase}-v1`
    };
  }
}
