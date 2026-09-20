import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTeachingAssetService } from './agent-teaching-asset.service';

const OFFER_SCHEMA_VERSION = '1';
const CONTENT_RESOLVER_VERSION = 'reviewed-learning-content-v1';
const ACTIVE_MOCK_WINDOW_MS = 4 * 60 * 60 * 1000;
const DEFER_MS = 24 * 60 * 60 * 1000;

const OfferInputSchema = z.object({
  clientRequestId: z.string().trim().min(8).max(120),
  context: z.enum(['after_round', 'agent_conversation']),
  conversationId: z.string().trim().min(1).max(120).optional(),
  language: z.enum(['zh-CN', 'en', 'vi']).default('zh-CN')
}).strict();

const ActionInputSchema = z.object({
  clientRequestId: z.string().trim().min(8).max(120),
  action: z.enum(['start', 'complete', 'defer', 'skip'])
}).strict();

type ResolvedContent = {
  sourceType: 'teaching_asset' | 'concept_card' | 'standard_explanation';
  sourceId: string;
  sourceVersion: string;
  snapshot: Record<string, unknown>;
};

function jsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

const PLACEHOLDER_CONTENT_PATTERN = /(?:local\s+demo\s+data|golden\s+path|placeholder|fixture|seed(?:ed)?\s+data|test\s+data)/i;

function isPlaceholderContent(...values: unknown[]) {
  return PLACEHOLDER_CONTENT_PATTERN.test(values.map((value) => String(value ?? '')).join(' '));
}

@Injectable()
export class AgentInterventionDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    private readonly teachingAssets: AgentTeachingAssetService
  ) {}

  private async hasActiveFormalMock(userId: number, at = new Date()) {
    return Boolean(await this.prisma.mockExamAttempt.findFirst({
      where: { userId, submittedAt: null, updatedAt: { gte: new Date(at.getTime() - ACTIVE_MOCK_WINDOW_MS) } },
      select: { id: true }
    }));
  }

  private serialize(delivery: any) {
    const content = jsonObject(delivery.contentSnapshot);
    const contentVisible = delivery.status === 'in_progress' || delivery.status === 'completed';
    return {
      schemaVersion: OFFER_SCHEMA_VERSION,
      id: delivery.id,
      interventionId: delivery.interventionId,
      status: delivery.status,
      placement: delivery.placement,
      subjectCode: delivery.intervention.subjectCode,
      topicId: delivery.intervention.topicId,
      action: delivery.intervention.action,
      urgency: delivery.intervention.urgency,
      reasonSummary: delivery.intervention.reasonSummary,
      triggerCodes: Array.isArray(delivery.intervention.triggerCodes) ? delivery.intervention.triggerCodes : [],
      content: {
        sourceType: delivery.contentSourceType,
        sourceId: delivery.contentSourceId,
        sourceVersion: delivery.contentSourceVersion,
        title: String(content.title ?? ''),
        body: contentVisible ? String(content.body ?? '') : '',
        example: contentVisible ? content.example ?? null : null,
        topicTitle: String(content.topicTitle ?? ''),
        teachingAsset: delivery.contentSourceType === 'teaching_asset' && contentVisible ? content.teachingAsset ?? null : null
      },
      offeredAt: delivery.offeredAt,
      startedAt: delivery.startedAt,
      completedAt: delivery.completedAt,
      deferredUntil: delivery.deferredUntil,
      skippedAt: delivery.skippedAt,
      masteryChanged: false
    };
  }

  private includeIntervention() {
    return { intervention: true } as const;
  }

  async get(userId: number, deliveryId: string) {
    const delivery = await this.prisma.learningInterventionDelivery.findFirst({
      where: { id: deliveryId, userId }, include: this.includeIntervention()
    });
    if (!delivery) throw new NotFoundException('学习讲解建议不存在。');
    const content = jsonObject(delivery.contentSnapshot);
    if (isPlaceholderContent(content.title, content.body, content.topicTitle, delivery.contentSourceId)) {
      throw new NotFoundException('当前讲解内容不可用。');
    }
    return this.serialize(delivery);
  }

  private async resolveContent(userId: number, topicId: number, subject: string, language: unknown, contentPlan?: unknown, routingContext?: { type: string; key: string }): Promise<ResolvedContent | null> {
    const teachingAsset = await this.teachingAssets.resolvePublishedForTopic(userId, topicId, subject, language, contentPlan, routingContext);
    if (teachingAsset && !isPlaceholderContent(teachingAsset.title, teachingAsset.summary, teachingAsset.topicTitle, teachingAsset.stableKey)) return {
      sourceType: 'teaching_asset', sourceId: teachingAsset.id, sourceVersion: teachingAsset.versionId,
      snapshot: {
        schemaVersion: '1', resolverVersion: teachingAsset.resolverVersion, reviewStatus: teachingAsset.reviewState,
        title: teachingAsset.title, body: teachingAsset.summary, example: null, topicTitle: teachingAsset.topicTitle,
        teachingAsset
      }
    };
    const card = await this.prisma.cscaConceptCard.findFirst({
      where: { topicId, status: 'published', topic: { status: 'published' } },
      include: { topic: { select: { title: true, syllabusVersion: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    if (card && !isPlaceholderContent(card.title, card.body, card.source, card.topic.title)) return {
      sourceType: 'concept_card', sourceId: String(card.id), sourceVersion: card.updatedAt.toISOString(),
      snapshot: {
        schemaVersion: '1', resolverVersion: CONTENT_RESOLVER_VERSION, reviewStatus: card.status,
        title: card.title, body: card.body, example: card.exampleJson ?? null,
        topicTitle: card.topic.title, syllabusVersion: card.topic.syllabusVersion,
        source: card.source, reviewedAt: card.updatedAt.toISOString()
      }
    };

    const question = await this.prisma.cscaQuestion.findFirst({
      where: { topicId, status: 'approved', explanation: { not: '' }, topic: { status: 'published' } },
      include: { topic: { select: { title: true, syllabusVersion: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    if (!question || isPlaceholderContent(question.prompt, question.explanation, question.sourceType, question.topic.title)) return null;
    return {
      sourceType: 'standard_explanation', sourceId: String(question.id), sourceVersion: String(question.version),
      snapshot: {
        schemaVersion: '1', resolverVersion: CONTENT_RESOLVER_VERSION, reviewStatus: question.status,
        title: question.topic.title, body: question.explanation, example: null,
        topicTitle: question.topic.title, syllabusVersion: question.syllabusVersion,
        source: question.sourceType, reviewedAt: question.updatedAt.toISOString()
      }
    };
  }

  async offer(userId: number, body: unknown) {
    if (!this.flags.isEnabled('interventionDelivery')) {
      throw new ServiceUnavailableException({ code: 'LEARNING_INTERVENTION_DELIVERY_DISABLED', message: '学习讲解建议暂未开放。' });
    }
    const input = OfferInputSchema.parse(body);
    if (input.conversationId) {
      const conversation = await this.prisma.agentConversation.findFirst({ where: { id: input.conversationId, userId, deletedAt: null }, select: { id: true } });
      if (!conversation) throw new NotFoundException('学习对话不存在。');
    }
    if (await this.hasActiveFormalMock(userId)) return { schemaVersion: OFFER_SCHEMA_VERSION, item: null, suppressedReason: 'FORMAL_MOCK_ACTIVE' };

    const now = new Date();
    const existing = await this.prisma.learningInterventionDelivery.findFirst({
      where: {
        userId, channel: 'agent_web',
        OR: [
          { status: { in: ['offered', 'in_progress'] } },
          { status: 'deferred', deferredUntil: { lte: now } }
        ]
      },
      include: this.includeIntervention(), orderBy: { updatedAt: 'desc' }
    });
    if (existing) {
      const existingContent = jsonObject(existing.contentSnapshot);
      if (isPlaceholderContent(existingContent.title, existingContent.body, existingContent.topicTitle, existing.contentSourceId)) {
        return { schemaVersion: OFFER_SCHEMA_VERSION, item: null, suppressedReason: 'PLACEHOLDER_CONTENT_REJECTED' };
      }
      if (existing.status === 'deferred') {
        const updated = await this.prisma.$transaction(async (tx) => {
          const row = await tx.learningInterventionDelivery.update({
            where: { id: existing.id }, data: { status: 'offered', offeredAt: now, deferredUntil: null }, include: this.includeIntervention()
          });
          await tx.learningInterventionStep.upsert({
            where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
            create: { deliveryId: row.id, userId, clientRequestId: input.clientRequestId, action: 'reoffer', fromStatus: 'deferred', toStatus: 'offered', metadata: { context: input.context, conversationId: input.conversationId ?? null } },
            update: {}
          });
          return row;
        });
        return { schemaVersion: OFFER_SCHEMA_VERSION, item: this.serialize(updated), suppressedReason: null };
      }
      return { schemaVersion: OFFER_SCHEMA_VERSION, item: this.serialize(existing), suppressedReason: null };
    }

    const proposals = await this.prisma.learningIntervention.findMany({
      where: {
        userId, status: 'shadow_proposed', action: { not: 'continue_practice' }, expiresAt: { gt: now },
        deliveries: { none: { channel: 'agent_web' } }
      },
      orderBy: { createdAt: 'desc' }, take: 20
    });
    const urgencyRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const proposal = proposals.sort((left, right) =>
      (urgencyRank[right.urgency] ?? 0) - (urgencyRank[left.urgency] ?? 0)
      || right.createdAt.getTime() - left.createdAt.getTime()
    )[0];
    if (!proposal) return { schemaVersion: OFFER_SCHEMA_VERSION, item: null, suppressedReason: null };
    const content = await this.resolveContent(userId, proposal.topicId, proposal.subjectCode, input.language, proposal.contentPlan, { type: 'proactive_intervention', key: `intervention:${proposal.id}` });
    let delivery: any;
    try {
      delivery = await this.prisma.$transaction(async (tx) => {
        const row = await tx.learningInterventionDelivery.create({
        data: {
          interventionId: proposal.id, userId, channel: 'agent_web', placement: proposal.placement,
          status: content ? 'offered' : 'content_unavailable',
          ...(content ? {
            contentSourceType: content.sourceType, contentSourceId: content.sourceId,
            contentSourceVersion: content.sourceVersion, contentSnapshot: content.snapshot as Prisma.InputJsonValue,
            offeredAt: now
          } : {}),
          contextSnapshot: {
            schemaVersion: '1', context: input.context, conversationId: input.conversationId ?? null,
            proposalPlacement: proposal.placement, automaticQuestionGenerationInvoked: false,
            aiExplanationGenerated: false, masteryMutationAllowed: false,
            teachingAssetSelection: content?.sourceType === 'teaching_asset' ? jsonObject(content.snapshot.teachingAsset).selectionDecision ?? null : null
          }
        },
        include: this.includeIntervention()
      });
        await tx.learningInterventionStep.create({
          data: {
            deliveryId: row.id, userId, clientRequestId: input.clientRequestId,
            action: content ? 'offer' : 'content_missing', fromStatus: null,
            toStatus: content ? 'offered' : 'content_unavailable',
            metadata: {
              context: input.context,
              resolverVersion: content?.sourceType === 'teaching_asset' ? String(content.snapshot.resolverVersion ?? '') : CONTENT_RESOLVER_VERSION,
              teachingAssetSelection: content?.sourceType === 'teaching_asset' ? jsonObject(content.snapshot.teachingAsset).selectionDecision ?? null : null
            }
          }
        });
        return row;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      delivery = await this.prisma.learningInterventionDelivery.findFirst({
        where: { interventionId: proposal.id, channel: 'agent_web', userId }, include: this.includeIntervention()
      });
      if (!delivery) throw new ConflictException('学习讲解建议正在生成，请稍后重试。');
    }
    return {
      schemaVersion: OFFER_SCHEMA_VERSION,
      item: content ? this.serialize(delivery) : null,
      suppressedReason: content ? null : 'REVIEWED_CONTENT_UNAVAILABLE'
    };
  }

  async act(userId: number, deliveryId: string, body: unknown) {
    const input = ActionInputSchema.parse(body);
    const priorStep = await this.prisma.learningInterventionStep.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } }, include: { delivery: { include: this.includeIntervention() } }
    });
    if (priorStep) {
      if (priorStep.deliveryId !== deliveryId) throw new ConflictException('该请求标识已用于其他讲解。');
      return this.serialize(priorStep.delivery);
    }
    const delivery = await this.prisma.learningInterventionDelivery.findFirst({
      where: { id: deliveryId, userId }, include: this.includeIntervention()
    });
    if (!delivery) throw new NotFoundException('学习讲解建议不存在。');
    const canFinishExisting = delivery.status === 'in_progress' && ['complete', 'defer', 'skip'].includes(input.action);
    if (!this.flags.isEnabled('interventionDelivery') && !canFinishExisting) {
      throw new ServiceUnavailableException({ code: 'LEARNING_INTERVENTION_DELIVERY_DISABLED', message: '学习讲解建议暂未开放。' });
    }
    if (await this.hasActiveFormalMock(userId)) {
      throw new ConflictException({ code: 'FORMAL_MOCK_ACTIVE', message: '正式模考期间不会展示或推进知识讲解。' });
    }
    if (input.action === 'complete' && delivery.contentSourceType === 'teaching_asset') {
      const completedAsset = delivery.contentSourceVersion ? await this.prisma.teachingInteractionEvent.findFirst({
        where: {
          userId,
          assetVersionId: delivery.contentSourceVersion,
          contextKey: `intervention_delivery:${delivery.id}`,
          action: 'completed'
        },
        select: { id: true }
      }) : null;
      if (!completedAsset) throw new ConflictException({ code: 'TEACHING_ASSET_INCOMPLETE', message: '请先完成微课及即时检查。' });
    }
    const transitions: Record<string, Partial<Record<typeof input.action, string>>> = {
      offered: { start: 'in_progress', defer: 'deferred', skip: 'skipped' },
      in_progress: { complete: 'completed', defer: 'deferred', skip: 'skipped' },
      deferred: { start: 'in_progress', skip: 'skipped' }
    };
    const nextStatus = transitions[delivery.status]?.[input.action];
    if (!nextStatus) throw new BadRequestException({ code: 'INVALID_INTERVENTION_TRANSITION', message: `当前状态不能执行 ${input.action}。` });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.learningInterventionDelivery.updateMany({
        where: { id: delivery.id, userId, status: delivery.status },
        data: {
          status: nextStatus,
          ...(input.action === 'start' ? { startedAt: delivery.startedAt ?? now, deferredUntil: null } : {}),
          ...(input.action === 'complete' ? { completedAt: now } : {}),
          ...(input.action === 'defer' ? { deferredUntil: new Date(now.getTime() + DEFER_MS) } : {}),
          ...(input.action === 'skip' ? { skippedAt: now } : {})
        }
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'INTERVENTION_STATE_CHANGED', message: '讲解状态已更新，请刷新后重试。' });
      await tx.learningInterventionStep.create({
        data: { deliveryId: delivery.id, userId, clientRequestId: input.clientRequestId, action: input.action, fromStatus: delivery.status, toStatus: nextStatus, metadata: { masteryChanged: false } }
      });
      return tx.learningInterventionDelivery.findUniqueOrThrow({ where: { id: delivery.id }, include: this.includeIntervention() });
    });
    return this.serialize(updated);
  }
}
