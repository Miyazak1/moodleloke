import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';

const SupplyIdentityFields = {
  source: z.enum(['agent_today_plan', 'intervention_verification']),
  subjectCode: z.enum(['math', 'physics', 'chemistry']),
  topicIds: z.array(z.coerce.number().int().positive()).max(20).default([]),
  difficulty: z.string().trim().min(1).max(24).optional(),
  taskType: z.string().trim().min(1).max(48),
  verificationPhase: z.enum(['immediate', 'retention', 'transfer']).optional(),
  constraints: z.record(z.string(), z.unknown()).optional()
} as const;

const SupplyGapSchema = z.object({
  ...SupplyIdentityFields,
  requestedCount: z.coerce.number().int().min(1).max(100),
  availableCount: z.coerce.number().int().min(0).max(100_000),
  sourceEntityType: z.string().trim().min(1).max(60).optional(),
  sourceEntityId: z.string().trim().min(1).max(120).optional()
}).strict().superRefine((value, context) => {
  if (value.availableCount >= value.requestedCount) {
    context.addIssue({ code: 'custom', path: ['availableCount'], message: 'A supply request requires a real shortage.' });
  }
  if (value.source === 'intervention_verification' && !value.verificationPhase) {
    context.addIssue({ code: 'custom', path: ['verificationPhase'], message: 'Verification phase is required.' });
  }
});

const SupplyRecoverySchema = z.object({
  ...SupplyIdentityFields,
  requestedCount: z.coerce.number().int().min(1).max(100),
  availableCount: z.coerce.number().int().min(1).max(100_000),
  confirmationKind: z.enum(['domain_preflight_passed', 'task_started'])
}).strict().superRefine((value, context) => {
  if (value.availableCount < value.requestedCount) {
    context.addIssue({ code: 'custom', path: ['availableCount'], message: 'Recovery confirmation requires sufficient supply.' });
  }
  if (value.source === 'intervention_verification' && !value.verificationPhase) {
    context.addIssue({ code: 'custom', path: ['verificationPhase'], message: 'Verification phase is required.' });
  }
});

const ListSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).optional(),
  subjectCode: z.enum(['math', 'physics', 'chemistry']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const ActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve', 'dismiss', 'reopen']),
  reason: z.string().trim().min(3).max(500)
}).strict();

type SupplyGapInput = z.infer<typeof SupplyGapSchema>;
type SupplyIdentityInput = Pick<SupplyGapInput, 'source' | 'subjectCode' | 'topicIds' | 'difficulty' | 'taskType' | 'verificationPhase' | 'constraints'>;
type SupplyRequestStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

const ACTION_TARGETS: Record<z.infer<typeof ActionSchema>['action'], SupplyRequestStatus> = {
  acknowledge: 'acknowledged',
  resolve: 'resolved',
  dismiss: 'dismissed',
  reopen: 'open'
};

function canonicalJson(value: unknown): Prisma.JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJson(item)])
    );
  }
  return null;
}

@Injectable()
export class QuestionSupplyRequestService {
  private readonly logger = new Logger(QuestionSupplyRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService
  ) {}

  async recordBestEffort(inputValue: unknown) {
    if (!this.flags.isQuestionSupplyRequestEnabled()) return null;
    const parsed = SupplyGapSchema.safeParse(inputValue);
    if (!parsed.success) {
      this.logger.warn(`Ignored invalid question supply gap: ${parsed.error.issues.map((issue) => issue.path.join('.') || '$').join(',')}`);
      return null;
    }
    try {
      return await this.observe(parsed.data);
    } catch (error) {
      this.logger.warn(`Question supply gap recording failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async recordRecoveryBestEffort(inputValue: unknown) {
    if (!this.flags.isQuestionSupplyRequestEnabled()) return null;
    const parsed = SupplyRecoverySchema.safeParse(inputValue);
    if (!parsed.success) {
      this.logger.warn(`Ignored invalid question supply recovery: ${parsed.error.issues.map((issue) => issue.path.join('.') || '$').join(',')}`);
      return null;
    }
    try {
      return await this.confirmRecovery(parsed.data);
    } catch (error) {
      this.logger.warn(`Question supply recovery recording failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async list(queryValue: unknown) {
    const query = ListSchema.parse(queryValue ?? {});
    const items = await this.prisma.questionSupplyRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.subjectCode ? { subjectCode: query.subjectCode } : {})
      },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 10 },
        fulfillmentPlans: { orderBy: { requestCycle: 'desc' }, take: 3 }
      },
      orderBy: [{ observationCount: 'desc' }, { lastObservedAt: 'desc' }],
      take: query.limit
    });
    return { schemaVersion: '1', items };
  }

  async act(requestId: string, actorUserId: number, bodyValue: unknown) {
    const body = ActionSchema.parse(bodyValue);
    const target = ACTION_TARGETS[body.action];
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.questionSupplyRequest.findUnique({ where: { id: requestId } });
      if (!current) throw new NotFoundException('题库补充需求不存在。');
      this.assertTransition(current.status as SupplyRequestStatus, target);
      const now = new Date();
      const startsNewCycle = target === 'open' && (current.status === 'resolved' || current.status === 'dismissed');
      const claimed = await tx.questionSupplyRequest.updateMany({
        where: { id: current.id, status: current.status },
        data: {
          status: target,
          ...(startsNewCycle ? { cycle: { increment: 1 } } : {}),
          acknowledgedAt: target === 'acknowledged' ? now : target === 'open' ? null : current.acknowledgedAt,
          resolvedAt: target === 'resolved' || target === 'dismissed' ? now : null,
          resolutionNote: target === 'resolved' || target === 'dismissed' ? body.reason : null
        }
      });
      if (claimed.count !== 1) {
        throw new ConflictException({ code: 'QUESTION_SUPPLY_REQUEST_CONCURRENT_UPDATE', message: '需求状态已变化，请刷新后重试。' });
      }
      await tx.questionSupplyRequestEvent.create({
        data: {
          requestId: current.id,
          actorUserId,
          action: body.action,
          fromStatus: current.status,
          toStatus: target,
          reason: body.reason,
          metadata: { schemaVersion: '1', requestCycle: startsNewCycle ? current.cycle + 1 : current.cycle }
        }
      });
      return tx.questionSupplyRequest.findUniqueOrThrow({ where: { id: current.id } });
    });
  }

  private requestKey(input: SupplyIdentityInput, topicIds: number[]): string {
    const identity = {
      schemaVersion: '1',
      source: input.source,
      subjectCode: input.subjectCode,
      topicIds,
      difficulty: input.difficulty ?? null,
      taskType: input.taskType,
      verificationPhase: input.verificationPhase ?? null,
      sourcePolicy: 'reviewed_published_only',
      constraints: canonicalJson(input.constraints ?? {})
    };
    return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  }

  private async confirmRecovery(input: z.infer<typeof SupplyRecoverySchema>) {
    const topicIds = [...new Set(input.topicIds)].sort((left, right) => left - right);
    const requestKey = this.requestKey(input, topicIds);
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.questionSupplyRequest.findUnique({ where: { requestKey } });
      if (!request || request.status === 'dismissed') return null;
      let status = request.status;
      if (status === 'open' || status === 'acknowledged') {
        const resolved = await tx.questionSupplyRequest.updateMany({
          where: { id: request.id, cycle: request.cycle, status },
          data: {
            status: 'resolved', resolvedAt: new Date(),
            resolutionNote: '领域执行前检查已确认审核库存满足当前需求。'
          }
        });
        if (resolved.count === 1) {
          await tx.questionSupplyRequestEvent.create({
            data: {
              requestId: request.id, action: 'execution_inventory_reconciled', fromStatus: status, toStatus: 'resolved',
              reason: '领域执行前检查已确认审核库存满足当前需求。',
              metadata: { requestCycle: request.cycle, requestedCount: input.requestedCount, availableCount: input.availableCount }
            }
          });
          status = 'resolved';
          const plan = await tx.questionSupplyFulfillmentPlan.findUnique({
            where: { requestId_requestCycle: { requestId: request.id, requestCycle: request.cycle } }
          });
          if (plan && !['completed', 'cancelled'].includes(plan.status)) {
            await tx.questionSupplyFulfillmentPlan.update({
              where: { id: plan.id },
              data: { status: 'completed', completedAt: new Date(), leaseOwner: null, leaseUntil: null, lastErrorCode: null }
            });
            await tx.questionSupplyFulfillmentEvent.create({
              data: {
                planId: plan.id, action: 'execution_inventory_reconciled', fromStatus: plan.status, toStatus: 'completed',
                metadata: { requestedCount: input.requestedCount, availableCount: input.availableCount }
              }
            });
          }
        } else {
          const latest = await tx.questionSupplyRequest.findUnique({ where: { id: request.id }, select: { status: true } });
          status = latest?.status ?? status;
        }
      }
      if (status !== 'resolved') return null;
      return tx.questionSupplyRecoveryConfirmation.upsert({
        where: {
          requestId_requestCycle_confirmationKind: {
            requestId: request.id, requestCycle: request.cycle, confirmationKind: input.confirmationKind
          }
        },
        create: {
          requestId: request.id, requestCycle: request.cycle, confirmationKind: input.confirmationKind,
          source: input.source, subjectCode: input.subjectCode,
          requestedCount: input.requestedCount, availableCount: input.availableCount,
          metadata: { schemaVersion: '1', automaticQuestionGenerationInvoked: false, aiInvoked: false }
        },
        update: {}
      });
    });
  }

  private async observe(input: SupplyGapInput, retry = true): Promise<unknown> {
    const topicIds = [...new Set(input.topicIds)].sort((left, right) => left - right);
    const requestKey = this.requestKey(input, topicIds);
    const now = new Date();
    const normalizedConstraints = canonicalJson(input.constraints ?? {}) as Prisma.InputJsonObject;
    const contextSnapshot: Prisma.InputJsonValue = {
      schemaVersion: '1',
      ...(input.sourceEntityType ? { sourceEntityType: input.sourceEntityType } : {}),
      ...(input.sourceEntityId ? { sourceEntityId: input.sourceEntityId } : {}),
      constraints: normalizedConstraints,
      automaticQuestionGenerationInvoked: false,
      aiInvoked: false
    };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.questionSupplyRequest.findUnique({ where: { requestKey } });
        if (!existing) {
          const created = await tx.questionSupplyRequest.create({
            data: {
              requestKey,
              source: input.source,
              subjectCode: input.subjectCode,
              topicIds,
              difficulty: input.difficulty ?? null,
              taskType: input.taskType,
              verificationPhase: input.verificationPhase ?? null,
              priority: input.source === 'intervention_verification' ? 'high' : 'normal',
              requestedCount: input.requestedCount,
              availableCount: input.availableCount,
              lastContextSnapshot: contextSnapshot,
              firstObservedAt: now,
              lastObservedAt: now,
              events: {
                create: {
                  action: 'observed',
                  fromStatus: null,
                  toStatus: 'open',
                  metadata: { requestedCount: input.requestedCount, availableCount: input.availableCount }
                }
              }
            }
          });
          return created;
        }
        const reopens = existing.status === 'resolved' || existing.status === 'dismissed';
        const updated = await tx.questionSupplyRequest.update({
          where: { id: existing.id },
          data: {
            status: reopens ? 'open' : existing.status,
            requestedCount: input.requestedCount,
            availableCount: input.availableCount,
            observationCount: { increment: 1 },
            ...(reopens ? { cycle: { increment: 1 } } : {}),
            lastContextSnapshot: contextSnapshot,
            lastObservedAt: now,
            ...(reopens ? { acknowledgedAt: null, resolvedAt: null, resolutionNote: null } : {})
          }
        });
        if (reopens) {
          await tx.questionSupplyRequestEvent.create({
            data: {
              requestId: existing.id,
              action: 'reopened_by_observation',
              fromStatus: existing.status,
              toStatus: 'open',
              metadata: { requestedCount: input.requestedCount, availableCount: input.availableCount, requestCycle: existing.cycle + 1 }
            }
          });
        }
        return updated;
      });
    } catch (error) {
      if (retry && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.observe(input, false);
      }
      throw error;
    }
  }

  private assertTransition(from: SupplyRequestStatus, to: SupplyRequestStatus) {
    const allowed: Record<SupplyRequestStatus, SupplyRequestStatus[]> = {
      open: ['acknowledged', 'resolved', 'dismissed'],
      acknowledged: ['open', 'resolved', 'dismissed'],
      resolved: ['open'],
      dismissed: ['open']
    };
    if (!allowed[from]?.includes(to)) {
      throw new ConflictException({ code: 'QUESTION_SUPPLY_REQUEST_INVALID_TRANSITION', message: `不能从 ${from} 变更为 ${to}。` });
    }
  }
}
