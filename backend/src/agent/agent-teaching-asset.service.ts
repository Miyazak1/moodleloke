import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { RecordTeachingDeliveryInteractionInputSchema, RecordTeachingInteractionInputSchema } from './agent.types';
import { selectTeachingAssetCandidate, TeachingAssetSelectionCandidate } from './teaching-asset-selection-policy';
import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';
import { getTeachingAssetCapability } from './teaching-asset-registry';

const RESOLVER_VERSION = 'teaching-asset-resolver-v2';
const LEGACY_RESOLVER_VERSION = 'teaching-asset-resolver-v1';
const COMPONENT_VERSION = '1';

const ActivePromptSchema = z.strictObject({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(500),
  options: z.array(z.strictObject({ id: z.string().min(1).max(20), label: z.string().min(1).max(200) })).min(2).max(6),
  correctAnswer: z.string().min(1).max(20),
  correctFeedback: z.string().min(1).max(500),
  incorrectFeedback: z.string().min(1).max(500)
});

const PayloadBaseShape = {
  schemaVersion: z.literal('1'),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  instructions: z.array(z.string().min(1).max(500)).min(1).max(8),
  activePrompt: ActivePromptSchema,
  verificationPolicy: z.strictObject({
    required: z.literal(true),
    mode: z.literal('next_fresh_question'),
    completionIsMasteryEvidence: z.literal(false)
  })
};

export const TeachingAssetPayloadSchema = z.union([
  z.strictObject({
    ...PayloadBaseShape,
    component: z.strictObject({ key: z.literal('math.function-horizontal-shift'), version: z.literal(COMPONENT_VERSION), props: z.strictObject({ baseExpression: z.literal('x^2'), shiftMin: z.number().int().min(-6).max(0), shiftMax: z.number().int().min(0).max(6), initialShift: z.number().int().min(-6).max(6) }) })
  }),
  z.strictObject({
    ...PayloadBaseShape,
    component: z.strictObject({ key: z.literal('physics.newton-second-law'), version: z.literal(COMPONENT_VERSION), props: z.strictObject({ forceMin: z.number().positive().max(30), forceMax: z.number().positive().max(50), initialForce: z.number().positive().max(30), massMin: z.number().positive().max(10), massMax: z.number().positive().max(20), initialMass: z.number().positive().max(10) }) })
  }),
  z.strictObject({
    ...PayloadBaseShape,
    component: z.strictObject({ key: z.literal('chemistry.acid-base-neutralization'), version: z.literal(COMPONENT_VERSION), props: z.strictObject({ acidMin: z.number().int().min(0).max(10), acidMax: z.number().int().min(1).max(20), initialAcid: z.number().int().min(0).max(20), baseMin: z.number().int().min(0).max(10), baseMax: z.number().int().min(1).max(20), initialBase: z.number().int().min(0).max(20) }) })
  })
]).superRefine((payload, context) => {
  if (payload.component.key === 'math.function-horizontal-shift') {
    const props = payload.component.props;
    if ('initialShift' in props && (props.initialShift < props.shiftMin || props.initialShift > props.shiftMax)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['component', 'props', 'initialShift'], message: 'Initial shift must be inside the allowed range.' });
    }
  }
  if (payload.component.key === 'physics.newton-second-law') {
    const props = payload.component.props;
    if ('initialForce' in props && (props.forceMin >= props.forceMax || props.massMin >= props.massMax || props.initialForce < props.forceMin || props.initialForce > props.forceMax || props.initialMass < props.massMin || props.initialMass > props.massMax)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['component', 'props'], message: 'Newton component ranges or initial values are invalid.' });
    }
  }
  if (payload.component.key === 'chemistry.acid-base-neutralization') {
    const props = payload.component.props;
    if ('initialAcid' in props && (props.acidMin >= props.acidMax || props.baseMin >= props.baseMax || props.initialAcid < props.acidMin || props.initialAcid > props.acidMax || props.initialBase < props.baseMin || props.initialBase > props.baseMax)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['component', 'props'], message: 'Neutralization component ranges or initial values are invalid.' });
    }
  }
  if (!payload.activePrompt.options.some((option) => option.id === payload.activePrompt.correctAnswer)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['activePrompt', 'correctAnswer'], message: 'Correct answer must reference an active-prompt option.' });
  }
});

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveInteger(value: unknown, message: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException(message);
  return parsed;
}

function languageVariants(value: unknown): string[] {
  const language = String(value ?? 'zh-CN').trim().toLowerCase();
  if (language === 'zh' || language === 'zh-cn') return ['zh-CN', 'zh'];
  if (language === 'en' || language.startsWith('en-')) return ['en'];
  if (language === 'vi' || language.startsWith('vi-')) return ['vi'];
  return [language];
}

@Injectable()
export class AgentTeachingAssetService {
  private readonly logger = new Logger(AgentTeachingAssetService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    @Optional() private readonly routingOutcomes?: TeachingAssetRoutingOutcomeService
  ) {}

  private async roundContext(userId: number, roundIdValue: unknown, questionIdValue: unknown) {
    const roundId = positiveInteger(roundIdValue, '训练轮次无效。');
    const questionId = positiveInteger(questionIdValue, '题目无效。');
    const accepted = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { userId, decision: 'accepted', domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId) },
      orderBy: { createdAt: 'desc' }
    });
    const artifactId = String(objectValue(accepted?.metadata).artifactId ?? '');
    const artifact = artifactId ? await this.prisma.agentArtifact.findFirst({ where: { id: artifactId, userId, type: 'learning_plan' } }) : null;
    if (!accepted || !artifact) throw new NotFoundException('该轮次不是当前用户的 Agent 学习任务。');
    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id: roundId, session: { userId } },
      include: { session: { select: { id: true, subject: true } }, items: true }
    });
    const item = round?.items.find((candidate) => candidate.questionId === questionId);
    if (!round || !item) throw new NotFoundException('训练题目不存在。');
    return { roundId, questionId, round, item, artifact, subject: round.session.subject, topicId: item.topicId };
  }

  private presentation(asset: any, version: any, topicTitle: string, resolverVersion = RESOLVER_VERSION) {
    const parsed = TeachingAssetPayloadSchema.safeParse(version.payload);
    if (!parsed.success || version.renderer !== 'interactive_component' || version.componentKey !== parsed.data.component.key || version.componentVersion !== COMPONENT_VERSION) return null;
    const payload = parsed.data;
    const capability = getTeachingAssetCapability(payload.component.key, payload.component.version);
    if (!capability) return null;
    return {
      id: asset.id,
      stableKey: asset.stableKey,
      type: asset.type,
      subjectCode: asset.subjectCode,
      versionId: version.id,
      version: version.version,
      language: version.language,
      difficultyBand: version.difficultyBand,
      estimatedMinutes: version.estimatedMinutes,
      renderer: version.renderer,
      payloadSchemaVersion: version.payloadSchemaVersion,
      resolverVersion,
      capability,
      topicTitle,
      title: payload.title,
      summary: payload.summary,
      instructions: payload.instructions,
      component: payload.component,
      activePrompt: {
        id: payload.activePrompt.id,
        prompt: payload.activePrompt.prompt,
        options: payload.activePrompt.options
      },
      verificationPolicy: payload.verificationPolicy,
      fallback: objectValue(version.fallbackPayload),
      sourceRefs: Array.isArray(version.sourceRefs) ? version.sourceRefs : [],
      reviewState: version.reviewState,
      publishedAt: version.publishedAt?.toISOString() ?? null
    };
  }

  private async recordRoutingDecision(userId: number, subject: string, topicId: number, routingContext: { type: string; key: string } | undefined, metadata: Record<string, unknown>) {
    if (!routingContext) return;
    try {
      const prior = await this.prisma.cscaTrainingEvent.findFirst({
        where: { userId, eventType: 'teaching_asset_routing_decision', source: 'agent', metadata: { path: ['contextKey'], equals: routingContext.key } },
        select: { id: true }
      });
      if (!prior) await this.prisma.cscaTrainingEvent.create({
        data: { userId, subject, eventType: 'teaching_asset_routing_decision', source: 'agent', metadata: { schemaVersion: '1', contextType: routingContext.type, contextKey: routingContext.key, topicId, ...metadata } }
      });
    } catch (error) {
      this.logger.warn(`TeachingAsset routing decision could not be recorded: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resolve(userId: number, topicId: number, subject: string, language: unknown, contentPlan?: unknown, routingContext?: { type: string; key: string }) {
    const startedAt = Date.now();
    const configuredMode = this.flags.teachingAssetRoutingMode();
    const rolloutMode = this.flags.teachingAssetRoutingModeFor(userId, subject);
    let mode = rolloutMode;
    let circuitReason: string | null = null;
    if (rolloutMode === 'active' && this.routingOutcomes) {
      try {
        const guard = await this.routingOutcomes.activeAllowed(subject);
        if (!guard.allowed) { mode = 'shadow'; circuitReason = 'learning_outcome_circuit_tripped'; }
      } catch {
        mode = 'shadow'; circuitReason = 'learning_outcome_circuit_check_unavailable';
      }
    }
    const languages = languageVariants(language);
    const assets = await this.prisma.teachingAsset.findMany({
      where: {
        status: 'published', subjectCode: subject,
        topics: { some: { topicId, relationship: 'primary', topic: { status: 'published' } } },
        versions: { some: { status: 'published', language: { in: languages } } }
      },
      include: {
        topics: { where: { topicId, relationship: 'primary' }, include: { topic: { select: { title: true } } }, take: 1 },
        versions: { where: { status: 'published', language: { in: languages } }, orderBy: [{ version: 'desc' }, { publishedAt: 'desc' }], take: 1 }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const renderable = assets.flatMap((asset) => {
      const version = asset.versions[0];
      const presentation = version ? this.presentation(asset, version, asset.topics[0]?.topic.title ?? '') : null;
      return version && presentation ? [{ asset, version, presentation }] : [];
    });
    if (!renderable.length) {
      if (mode !== 'legacy') await this.recordRoutingDecision(userId, subject, topicId, routingContext, {
        routingMode: mode, configuredMode, policyVersion: 'teaching-asset-selection-v1', legacyVersionId: null,
        personalizedVersionId: null, servedVersionId: null, diverged: false, personalizedFallback: true,
        boundedExploration: false, reasonCodes: ['no_renderable_candidate', ...(circuitReason ? [circuitReason] : [])], candidateCount: 0,
        eligibleCandidateCount: 0, latencyMs: Date.now() - startedAt, decision: null
      });
      return null;
    }
    const legacy = renderable[0];
    const versionIds = renderable.map((item) => item.version.id);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [exposures, deliveries] = await Promise.all([
      this.prisma.teachingAssetExposure.findMany({
        where: { assetVersionId: { in: versionIds }, lastExposedAt: { gte: since } },
        select: { userId: true, assetVersionId: true, status: true, completedAt: true, lastExposedAt: true }
      }),
      this.prisma.learningInterventionDelivery.findMany({
        where: { contentSourceType: 'teaching_asset', contentSourceVersion: { in: versionIds }, createdAt: { gte: since } },
        select: {
          userId: true, contentSourceVersion: true,
          outcomes: { select: { result: true, independent: true } },
          stabilityAssessment: { select: { status: true, result: true } }
        }
      })
    ]);
    const candidates: TeachingAssetSelectionCandidate[] = renderable.map(({ asset, version }) => {
      const scopedExposures = exposures.filter((item) => item.assetVersionId === version.id);
      const userExposures = scopedExposures.filter((item) => item.userId === userId);
      const scopedDeliveries = deliveries.filter((item) => item.contentSourceVersion === version.id);
      const userDeliveries = scopedDeliveries.filter((item) => item.userId === userId);
      const globalIndependent = scopedDeliveries.flatMap((item) => item.outcomes).filter((item) => item.independent);
      const globalConclusive = globalIndependent.filter((item) => item.result === 'passed' || item.result === 'failed');
      const userIndependent = userDeliveries.flatMap((item) => item.outcomes).filter((item) => item.independent);
      return {
        assetId: asset.id, versionId: version.id, stableKey: asset.stableKey,
        estimatedMinutes: version.estimatedMinutes, publishedAt: version.publishedAt,
        userEvidence: {
          exposureCount: userExposures.length,
          completedCount: userExposures.filter((item) => item.status === 'completed' || item.completedAt).length,
          skippedCount: userExposures.filter((item) => item.status === 'skipped').length,
          lastExposedAt: userExposures.reduce<Date | null>((latest, item) => !latest || item.lastExposedAt > latest ? item.lastExposedAt : latest, null),
          independentPassed: userIndependent.filter((item) => item.result === 'passed').length,
          independentFailed: userIndependent.filter((item) => item.result === 'failed').length,
          stable: userDeliveries.filter((item) => item.stabilityAssessment?.status === 'completed' && item.stabilityAssessment.result === 'stable').length,
          notStable: userDeliveries.filter((item) => item.stabilityAssessment?.status === 'completed' && item.stabilityAssessment.result === 'not_stable').length
        },
        globalEvidence: {
          exposureContexts: scopedExposures.length,
          uniqueLearners: new Set(scopedExposures.map((item) => item.userId)).size,
          completionRate: scopedExposures.length ? scopedExposures.filter((item) => item.status === 'completed' || item.completedAt).length / scopedExposures.length : null,
          conclusiveOutcomes: globalConclusive.length,
          verificationPassRate: globalConclusive.length ? globalConclusive.filter((item) => item.result === 'passed').length / globalConclusive.length : null
        }
      };
    });
    const plan = objectValue(contentPlan);
    const selected = selectTeachingAssetCandidate({ userId, topicId, depth: typeof plan.depth === 'string' ? plan.depth : null, candidates });
    const match = selected ? renderable.find((item) => item.version.id === selected.candidate.versionId) : null;
    const served = mode === 'active' ? match ?? null : legacy;
    const decisionMetadata = {
      routingMode: mode,
      configuredMode,
      policyVersion: selected?.decision.policyVersion ?? 'teaching-asset-selection-v1',
      legacyVersionId: legacy.version.id,
      personalizedVersionId: match?.version.id ?? null,
      servedVersionId: served?.version.id ?? null,
      diverged: Boolean(match && match.version.id !== legacy.version.id),
      personalizedFallback: !match,
      boundedExploration: selected?.decision.boundedExploration ?? false,
      reasonCodes: [...(selected?.decision.reasonCodes ?? ['no_eligible_personalized_candidate']), ...(circuitReason ? [circuitReason] : [])],
      candidateCount: candidates.length,
      eligibleCandidateCount: selected?.decision.eligibleCandidateCount ?? 0,
      latencyMs: Date.now() - startedAt,
      decision: selected?.decision ?? null
    };
    if (mode !== 'legacy') await this.recordRoutingDecision(userId, subject, topicId, routingContext, decisionMetadata);
    if (!served) return null;
    if (mode !== 'active') return { ...served.presentation, resolverVersion: LEGACY_RESOLVER_VERSION };
    return { ...served.presentation, selectionDecision: selected?.decision };
  }

  async resolvePublishedForTopic(userId: number, topicId: number, subject: string, language?: unknown, contentPlan?: unknown, routingContext?: { type: string; key: string }) {
    if (!this.flags.isTeachingAssetEnabled()) return null;
    return this.resolve(userId, topicId, subject, language, contentPlan, routingContext);
  }

  async forQuestion(userId: number, roundIdValue: unknown, questionIdValue: unknown, language?: unknown) {
    if (!this.flags.isTeachingAssetEnabled()) {
      return { schemaVersion: '1' as const, item: null, gapReason: 'FEATURE_DISABLED' };
    }
    const context = await this.roundContext(userId, roundIdValue, questionIdValue);
    if (context.round.plannerSnapshot && objectValue(context.round.plannerSnapshot).mode === 'intervention_verification') {
      return { schemaVersion: '1' as const, item: null, gapReason: 'INDEPENDENT_VERIFICATION' };
    }
    if (context.item.isCorrect !== false) {
      return { schemaVersion: '1' as const, item: null, gapReason: context.item.selectedAnswer ? 'CORRECT_ANSWER' : 'ANSWER_REQUIRED' };
    }
    const item = await this.resolve(userId, context.topicId, context.subject, language, undefined, { type: 'practice_question', key: `adaptive_round:${context.roundId}:question:${context.questionId}` });
    return { schemaVersion: '1' as const, item, gapReason: item ? null : 'NO_PUBLISHED_ASSET' };
  }

  async byStableKey(stableKey: string, language?: unknown) {
    if (!this.flags.isTeachingAssetEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_TEACHING_ASSET_DISABLED', message: '交互教学能力暂未开放。' });
    }
    const languages = languageVariants(language);
    const asset = await this.prisma.teachingAsset.findFirst({
      where: { stableKey, status: 'published', versions: { some: { status: 'published', language: { in: languages } } } },
      include: {
        topics: { where: { relationship: 'primary' }, include: { topic: { select: { title: true } } }, orderBy: { sortOrder: 'asc' }, take: 1 },
        versions: { where: { status: 'published', language: { in: languages } }, orderBy: [{ version: 'desc' }, { publishedAt: 'desc' }], take: 1 }
      }
    });
    const version = asset?.versions[0];
    const item = asset && version ? this.presentation(asset, version, asset.topics[0]?.topic.title ?? '') : null;
    if (!item) throw new NotFoundException('教学资产不存在或尚未发布。');
    return { schemaVersion: '1' as const, item };
  }

  async record(userId: number, assetVersionId: string, body: unknown) {
    if (!this.flags.isTeachingAssetEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_TEACHING_ASSET_DISABLED', message: '交互教学能力暂未开放。' });
    }
    const input = RecordTeachingInteractionInputSchema.parse(body);
    const context = await this.roundContext(userId, input.roundId, input.questionId);
    const version = await this.prisma.teachingAssetVersion.findFirst({
      where: {
        id: assetVersionId,
        status: 'published',
        asset: {
          status: 'published',
          topics: { some: { topicId: context.topicId, relationship: 'primary', topic: { status: 'published' } } }
        }
      },
      include: { asset: true }
    });
    if (!version) throw new NotFoundException('教学资产版本与当前题目不匹配。');
    const presentation = this.presentation(version.asset, version, '');
    if (!presentation) throw new ConflictException('教学资产版本无法由当前客户端安全渲染。');
    const prior = await this.prisma.teachingInteractionEvent.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } } });
    const contextKey = `adaptive_round:${context.roundId}:question:${context.questionId}`;
    if (prior) {
      if (prior.assetVersionId !== assetVersionId || prior.contextKey !== contextKey || prior.action !== input.action || String(objectValue(prior.payload).value ?? '') !== String(input.value ?? '')) {
        throw new ConflictException('clientRequestId was already used for another teaching interaction.');
      }
      return { schemaVersion: '1' as const, eventId: prior.id, ...objectValue(prior.result) };
    }
    if (input.action === 'completed') {
      const passedActivePrompt = await this.prisma.teachingInteractionEvent.findFirst({
        where: {
          userId, assetVersionId, contextKey, action: 'active_prompt_answered',
          result: { path: ['correct'], equals: true }
        },
        select: { id: true }
      });
      if (!passedActivePrompt) throw new ConflictException('请先通过微课中的即时检查。');
    }
    const payload = TeachingAssetPayloadSchema.parse(version.payload);
    const answerCorrect = input.action === 'active_prompt_answered' ? String(input.value ?? '') === payload.activePrompt.correctAnswer : null;
    const result = {
      status: input.action === 'completed' ? 'completed' : 'recorded',
      action: input.action,
      correct: answerCorrect,
      feedback: answerCorrect === null ? null : answerCorrect ? payload.activePrompt.correctFeedback : payload.activePrompt.incorrectFeedback,
      masteryChanged: false,
      verificationRequired: input.action === 'completed'
    };
    const status = input.action === 'completed' ? 'completed' : input.action === 'skipped' ? 'skipped' : input.action === 'active_prompt_answered' ? 'active_prompt_answered' : 'opened';
    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const created = await tx.teachingInteractionEvent.create({
          data: { userId, assetVersionId, contextKey, clientRequestId: input.clientRequestId, action: input.action, payload: { value: input.value ?? null }, result }
        });
        const exposure = await tx.teachingAssetExposure.upsert({
          where: { userId_assetVersionId_contextKey: { userId, assetVersionId, contextKey } },
          create: {
            userId, assetId: version.assetId, assetVersionId, contextKey, source: 'agent_practice', exposureLevel: 'A4', status,
            snapshot: presentation as unknown as Prisma.InputJsonValue, completedAt: input.action === 'completed' ? new Date() : null
          },
          update: { lastExposedAt: new Date() }
        });
        await tx.teachingAssetExposure.updateMany({
          where: { id: exposure.id, ...(input.action === 'completed' ? {} : { status: { not: 'completed' } }) },
          data: { status, lastExposedAt: new Date(), completedAt: input.action === 'completed' ? new Date() : undefined }
        });
        await tx.cscaTrainingEvent.create({
          data: {
            userId, subject: context.subject, sessionId: context.round.session.id, roundId: context.roundId, questionId: context.questionId,
            eventType: `teaching_asset_${input.action}`, source: 'agent',
            metadata: { assetId: version.assetId, assetVersionId, contextKey, exposureLevel: 'A4', masteryChanged: false, verificationRequired: result.verificationRequired, activePromptCorrect: answerCorrect }
          }
        });
        return created;
      });
      return { schemaVersion: '1' as const, eventId: event.id, ...result };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.teachingInteractionEvent.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } } });
        if (replay) return { schemaVersion: '1' as const, eventId: replay.id, ...objectValue(replay.result) };
      }
      throw error;
    }
  }

  async recordForDelivery(userId: number, deliveryId: string, body: unknown) {
    if (!this.flags.isTeachingAssetEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_TEACHING_ASSET_DISABLED', message: '交互教学能力暂未开放。' });
    }
    const input = RecordTeachingDeliveryInteractionInputSchema.parse(body);
    const delivery = await this.prisma.learningInterventionDelivery.findFirst({
      where: { id: deliveryId, userId, status: 'in_progress', contentSourceType: 'teaching_asset' },
      include: { intervention: true }
    });
    if (!delivery?.contentSourceVersion) throw new NotFoundException('当前主动讲解不存在或尚未开始。');
    const version = await this.prisma.teachingAssetVersion.findFirst({
      where: {
        id: delivery.contentSourceVersion,
        status: 'published',
        asset: {
          status: 'published',
          topics: { some: { topicId: delivery.intervention.topicId, relationship: 'primary', topic: { status: 'published' } } }
        }
      },
      include: { asset: true }
    });
    if (!version) throw new NotFoundException('主动讲解绑定的教学资产已不可用。');
    const presentation = this.presentation(version.asset, version, '');
    if (!presentation) throw new ConflictException('教学资产版本无法由当前客户端安全渲染。');
    const contextKey = `intervention_delivery:${delivery.id}`;
    const prior = await this.prisma.teachingInteractionEvent.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } } });
    if (prior) {
      if (prior.assetVersionId !== version.id || prior.contextKey !== contextKey || prior.action !== input.action || String(objectValue(prior.payload).value ?? '') !== String(input.value ?? '')) {
        throw new ConflictException('clientRequestId was already used for another teaching interaction.');
      }
      return { schemaVersion: '1' as const, eventId: prior.id, ...objectValue(prior.result) };
    }
    if (input.action === 'completed') {
      const passedActivePrompt = await this.prisma.teachingInteractionEvent.findFirst({
        where: { userId, assetVersionId: version.id, contextKey, action: 'active_prompt_answered', result: { path: ['correct'], equals: true } },
        select: { id: true }
      });
      if (!passedActivePrompt) throw new ConflictException('请先通过微课中的即时检查。');
    }
    const payload = TeachingAssetPayloadSchema.parse(version.payload);
    const answerCorrect = input.action === 'active_prompt_answered' ? String(input.value ?? '') === payload.activePrompt.correctAnswer : null;
    const result = {
      status: input.action === 'completed' ? 'completed' : 'recorded',
      action: input.action,
      correct: answerCorrect,
      feedback: answerCorrect === null ? null : answerCorrect ? payload.activePrompt.correctFeedback : payload.activePrompt.incorrectFeedback,
      masteryChanged: false,
      verificationRequired: input.action === 'completed'
    };
    const status = input.action === 'completed' ? 'completed' : input.action === 'active_prompt_answered' ? 'active_prompt_answered' : 'opened';
    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const created = await tx.teachingInteractionEvent.create({
          data: { userId, assetVersionId: version.id, contextKey, clientRequestId: input.clientRequestId, action: input.action, payload: { value: input.value ?? null }, result }
        });
        const exposure = await tx.teachingAssetExposure.upsert({
          where: { userId_assetVersionId_contextKey: { userId, assetVersionId: version.id, contextKey } },
          create: {
            userId, assetId: version.assetId, assetVersionId: version.id, contextKey, source: 'agent_intervention', exposureLevel: 'A4', status,
            snapshot: presentation as unknown as Prisma.InputJsonValue, completedAt: input.action === 'completed' ? new Date() : null
          },
          update: { lastExposedAt: new Date() }
        });
        await tx.teachingAssetExposure.updateMany({
          where: { id: exposure.id, ...(input.action === 'completed' ? {} : { status: { not: 'completed' } }) },
          data: { status, lastExposedAt: new Date(), completedAt: input.action === 'completed' ? new Date() : undefined }
        });
        await tx.cscaTrainingEvent.create({
          data: {
            userId, subject: delivery.intervention.subjectCode, eventType: `teaching_asset_${input.action}`, source: 'agent',
            metadata: { deliveryId: delivery.id, interventionId: delivery.interventionId, assetId: version.assetId, assetVersionId: version.id, contextKey, exposureLevel: 'A4', masteryChanged: false, verificationRequired: result.verificationRequired, activePromptCorrect: answerCorrect }
          }
        });
        return created;
      });
      return { schemaVersion: '1' as const, eventId: event.id, ...result };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.teachingInteractionEvent.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } } });
        if (replay) return { schemaVersion: '1' as const, eventId: replay.id, ...objectValue(replay.result) };
      }
      throw error;
    }
  }
}
