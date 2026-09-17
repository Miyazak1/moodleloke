import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { CscaAdaptiveService } from '../csca-special-practice/csca-adaptive.service';
import { IndependentVerificationQuestion } from '../csca-special-practice/csca-adaptive.types';
import { AdaptiveQuestionProviderService } from '../csca-special-practice/adaptive-question-provider.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionSupplyRequestService } from './question-supply-request.service';
import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';

type VerificationPhase = 'immediate' | 'retention' | 'transfer';

const QUESTION_COUNT = 3;
const ACTIVE_MOCK_WINDOW_MS = 4 * 60 * 60 * 1000;
const TASK_EXPIRY_MS = 48 * 60 * 60 * 1000;
const STABILITY_POLICY_VERSION = 'intervention-stability-immediate-retention-transfer-v1';
const SELECTION_VERSION: Record<VerificationPhase, string> = {
  immediate: 'independent-reviewed-unexposed-v1',
  retention: 'delayed-retention-reviewed-unexposed-v1',
  transfer: 'cross-structure-reviewed-unexposed-v1'
};
const MEASUREMENT_VERSION: Record<VerificationPhase, string> = {
  immediate: 'intervention-immediate-outcome-v1',
  retention: 'intervention-delayed-retention-v1',
  transfer: 'intervention-cross-structure-transfer-v1'
};

const OfferSchema = z.object({
  clientRequestId: z.string().trim().min(8).max(120),
  conversationId: z.string().trim().min(1).max(120).optional()
}).strict();
const StartSchema = z.object({
  clientRequestId: z.string().trim().min(8).max(120),
  questionLanguage: z.enum(['zh', 'en']).default('zh')
}).strict();

function jsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function phaseOf(value: unknown): VerificationPhase {
  return value === 'retention' || value === 'transfer' ? value : 'immediate';
}
function retentionDelayMs() {
  const demoMinutes = Number(process.env.CSCA_INTERVENTION_RETENTION_DELAY_MINUTES ?? 0);
  if (process.env.NODE_ENV !== 'production' && Number.isFinite(demoMinutes) && demoMinutes >= 1) {
    return Math.min(1440, demoMinutes) * 60 * 1000;
  }
  const hours = Number(process.env.CSCA_INTERVENTION_RETENTION_DELAY_HOURS ?? 24);
  return Math.max(1, Math.min(168, Number.isFinite(hours) ? hours : 24)) * 60 * 60 * 1000;
}
function questionRefs(value: unknown) {
  return Array.isArray(value) ? value.map(jsonObject) : [];
}

@Injectable()
export class AgentInterventionVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    private readonly questions: AdaptiveQuestionProviderService,
    private readonly adaptive: CscaAdaptiveService,
    @Optional() private readonly supplyRequests?: QuestionSupplyRequestService,
    @Optional() private readonly routingOutcomes?: TeachingAssetRoutingOutcomeService
  ) {}

  private async assertNoActiveMock(userId: number) {
    const active = await this.prisma.mockExamAttempt.findFirst({
      where: { userId, submittedAt: null, updatedAt: { gte: new Date(Date.now() - ACTIVE_MOCK_WINDOW_MS) } }, select: { id: true }
    });
    if (active) throw new ConflictException({ code: 'FORMAL_MOCK_ACTIVE', message: '正式模考期间不会推荐或启动干预验证。' });
  }

  private includeContext() {
    return { sourceDelivery: { include: { intervention: true, stabilityAssessment: true } }, outcome: true } as const;
  }

  private serialize(item: any) {
    const refs = questionRefs(item.questionRefs);
    const snapshot = jsonObject(item.supplySnapshot);
    const stability = item.sourceDelivery?.stabilityAssessment;
    return {
      schemaVersion: '2', id: item.id, deliveryId: item.deliveryId, status: item.status,
      phase: phaseOf(item.phase), dueAt: item.dueAt,
      subjectCode: item.subjectCode, topicId: item.topicId,
      topicTitle: String(snapshot.topicTitle ?? ''), questionCount: refs.length,
      selectionVersion: item.selectionVersion, measurementVersion: item.measurementVersion,
      reasonSummary: item.sourceDelivery.intervention.reasonSummary,
      expiresAt: item.expiresAt, startedAt: item.startedAt, completedAt: item.completedAt,
      route: item.roundId
        ? `/csca-subjects/${encodeURIComponent(item.subjectCode)}/practice/rounds/${item.roundId}?${[
            item.conversationId ? `agentConversationId=${encodeURIComponent(item.conversationId)}` : '',
            `agentInterventionVerificationId=${encodeURIComponent(item.id)}`
          ].filter(Boolean).join('&')}` : null,
      outcome: item.outcome ? {
        result: item.outcome.result, correctCount: item.outcome.correctCount, totalCount: item.outcome.totalCount,
        accuracy: item.outcome.accuracy, independent: item.outcome.independent
      } : null,
      stability: stability ? { status: stability.status, result: stability.result, policyVersion: stability.policyVersion } : null
    };
  }

  private async priorSelectionContext(userId: number, deliveryId: string) {
    const previous = await this.prisma.learningInterventionVerification.findMany({
      where: { userId, deliveryId }, select: { questionRefs: true }, orderBy: { createdAt: 'asc' }
    });
    const refs = previous.flatMap((item) => questionRefs(item.questionRefs));
    return {
      excludedRefs: refs.map((ref) => `csca_question:${Number(ref.id)}:v${Number(ref.version)}`),
      excludedTransferSignatures: [...new Set(refs.map((ref) => String(ref.transferSignature ?? '')).filter(Boolean))]
    };
  }

  private async selectQuestions(userId: number, delivery: any, phase: VerificationPhase) {
    const prior = await this.priorSelectionContext(userId, delivery.id);
    if (phase === 'immediate' && delivery.contentSourceType === 'standard_explanation' && delivery.contentSourceId) {
      prior.excludedRefs.push(`csca_question:${delivery.contentSourceId}:v${delivery.contentSourceVersion}`);
    }
    const selected = await this.questions.pickIndependentVerificationQuestions(
      userId, delivery.intervention.topicId, QUESTION_COUNT, prior.excludedRefs,
      phase === 'transfer'
        ? { requireDifferentTransferSignature: true, excludedTransferSignatures: prior.excludedTransferSignatures }
        : {}
    );
    const topic = await this.prisma.cscaExamTopic.findFirst({
      where: { id: delivery.intervention.topicId, status: 'published' }, select: { title: true }
    });
    return { selected, topicTitle: topic?.title ?? '', ...prior };
  }

  private selectedRefs(selected: IndependentVerificationQuestion[]) {
    return selected.map((item) => ({
      type: item.questionSource, id: item.questionId, version: item.questionVersion,
      topicId: item.topicId, difficulty: item.questionDifficulty, transferSignature: item.transferSignature
    }));
  }

  private async recordSupplyGap(db: any, item: any, phase: VerificationPhase, available: number) {
    const existing = await db.learningInterventionStabilityAssessment.findUnique({
      where: { deliveryId: item.deliveryId }, select: { phaseResults: true, evidenceRefs: true }
    });
    const phaseResults = {
      ...jsonObject(existing?.phaseResults),
      [phase]: { result: 'supply_unavailable', available, requested: QUESTION_COUNT }
    };
    await db.learningInterventionStabilityAssessment.upsert({
      where: { deliveryId: item.deliveryId },
      create: {
        deliveryId: item.deliveryId, interventionId: item.interventionId, userId: item.userId,
        status: 'completed', result: 'inconclusive', policyVersion: STABILITY_POLICY_VERSION,
        phaseResults, evidenceRefs: existing?.evidenceRefs ?? [], evaluatedAt: new Date()
      },
      update: {
        status: 'completed', result: 'inconclusive', policyVersion: STABILITY_POLICY_VERSION,
        phaseResults,
        evaluatedAt: new Date()
      }
    });
  }

  private async requestSupply(item: any, phase: VerificationPhase, available: number, constraints: Record<string, unknown> = {}) {
    await this.supplyRequests?.recordBestEffort({
      source: 'intervention_verification',
      subjectCode: item.subjectCode ?? item.intervention?.subjectCode,
      topicIds: [Number(item.topicId ?? item.intervention?.topicId)],
      taskType: 'intervention_verification',
      verificationPhase: phase,
      requestedCount: QUESTION_COUNT,
      availableCount: available,
      sourceEntityType: 'learning_intervention_verification',
      sourceEntityId: String(item.id),
      constraints
    });
  }

  private async confirmSupplyRecovery(
    item: any,
    phase: VerificationPhase,
    available: number,
    confirmationKind: 'domain_preflight_passed' | 'task_started',
    constraints: Record<string, unknown> = {}
  ) {
    await this.supplyRequests?.recordRecoveryBestEffort?.({
      source: 'intervention_verification',
      subjectCode: item.subjectCode ?? item.intervention?.subjectCode,
      topicIds: [Number(item.topicId ?? item.intervention?.topicId)],
      taskType: 'intervention_verification', verificationPhase: phase,
      requestedCount: QUESTION_COUNT, availableCount: available, confirmationKind, constraints
    });
  }

  private async materializeScheduled(item: any, conversationId?: string) {
    const phase = phaseOf(item.phase);
    const selection = await this.selectQuestions(item.userId, item.sourceDelivery, phase);
    const status = selection.selected.length === QUESTION_COUNT ? 'recommended' : 'supply_unavailable';
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.learningInterventionVerification.updateMany({
        where: { id: item.id, userId: item.userId, status: 'scheduled', dueAt: { lte: new Date() } },
        data: {
          status, conversationId: conversationId ?? item.conversationId,
          questionRefs: this.selectedRefs(selection.selected),
          selectionConstraints: {
            requireDifferentTransferSignature: phase === 'transfer',
            excludedTransferSignatures: selection.excludedTransferSignatures
          },
          supplySnapshot: {
            schemaVersion: '2', phase, topicTitle: selection.topicTitle,
            requested: QUESTION_COUNT, available: selection.selected.length,
            excludedRefs: selection.excludedRefs, excludedTransferSignatures: selection.excludedTransferSignatures,
            automaticQuestionGenerationInvoked: false, aiInvoked: false
          },
          expiresAt: new Date(Date.now() + TASK_EXPIRY_MS)
        }
      });
      if (claimed.count === 1 && status === 'supply_unavailable') {
        await this.recordSupplyGap(tx, item, phase, selection.selected.length);
      }
    });
    if (status === 'supply_unavailable') {
      await this.requestSupply(item, phase, selection.selected.length, {
        requireDifferentTransferSignature: phase === 'transfer',
        excludedTransferSignatures: selection.excludedTransferSignatures
      });
    } else {
      await this.confirmSupplyRecovery(item, phase, selection.selected.length, 'domain_preflight_passed', {
        requireDifferentTransferSignature: phase === 'transfer',
        excludedTransferSignatures: selection.excludedTransferSignatures
      });
    }
    return this.prisma.learningInterventionVerification.findFirstOrThrow({
      where: { id: item.id, userId: item.userId }, include: this.includeContext()
    });
  }

  private async createImmediate(userId: number, delivery: any, input: z.infer<typeof OfferSchema>) {
    const selection = await this.selectQuestions(userId, delivery, 'immediate');
    const status = selection.selected.length === QUESTION_COUNT ? 'recommended' : 'supply_unavailable';
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const created = await tx.learningInterventionVerification.create({
          data: {
            deliveryId: delivery.id, interventionId: delivery.interventionId, userId,
            subjectCode: delivery.intervention.subjectCode, topicId: delivery.intervention.topicId,
            phase: 'immediate', status,
            selectionVersion: SELECTION_VERSION.immediate, measurementVersion: MEASUREMENT_VERSION.immediate,
            contentSourceVersion: delivery.contentSourceVersion || 'unknown',
            questionRefs: this.selectedRefs(selection.selected), selectionConstraints: {},
            supplySnapshot: {
              schemaVersion: '2', phase: 'immediate', topicTitle: selection.topicTitle,
              requested: QUESTION_COUNT, available: selection.selected.length, excludedRefs: selection.excludedRefs,
              automaticQuestionGenerationInvoked: false, aiInvoked: false
            },
            conversationId: input.conversationId ?? null, offerRequestId: input.clientRequestId,
            dueAt: new Date(), expiresAt: new Date(Date.now() + TASK_EXPIRY_MS)
          },
          include: this.includeContext()
        });
        if (status === 'supply_unavailable') {
          await this.recordSupplyGap(tx, created, 'immediate', selection.selected.length);
        }
        return created;
      });
      if (status === 'supply_unavailable') {
        await this.requestSupply(created, 'immediate', selection.selected.length);
      } else {
        await this.confirmSupplyRecovery(created, 'immediate', selection.selected.length, 'domain_preflight_passed');
      }
      return created;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.learningInterventionVerification.findFirst({
        where: { deliveryId: delivery.id, phase: 'immediate', userId }, include: this.includeContext()
      });
      if (!existing) throw new ConflictException('干预验证正在创建，请稍后重试。');
      return existing;
    }
  }

  async offer(userId: number, body: unknown) {
    if (!this.flags.isEnabled('interventionVerification')) {
      throw new ServiceUnavailableException({ code: 'LEARNING_INTERVENTION_VERIFICATION_DISABLED', message: '干预验证暂未开放。' });
    }
    const input = OfferSchema.parse(body);
    if (input.conversationId) {
      const owned = await this.prisma.agentConversation.findFirst({ where: { id: input.conversationId, userId, deletedAt: null }, select: { id: true } });
      if (!owned) throw new NotFoundException('学习对话不存在。');
    }
    await this.assertNoActiveMock(userId);
    let existing = await this.prisma.learningInterventionVerification.findFirst({
      where: { userId, OR: [
        { status: { in: ['recommended', 'starting'] }, expiresAt: { gt: new Date() } },
        { status: 'started' }, { status: 'scheduled' }
      ] },
      include: this.includeContext(), orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }]
    });
    if (existing?.status === 'scheduled') {
      if (existing.dueAt.getTime() > Date.now()) return { schemaVersion: '2', item: null, shortage: null, nextDueAt: existing.dueAt };
      existing = await this.materializeScheduled(existing, input.conversationId);
    }
    if (existing) {
      const shortage = existing.status === 'supply_unavailable'
        ? { code: phaseOf(existing.phase) === 'transfer' ? 'CROSS_STRUCTURE_SUPPLY_UNAVAILABLE' : 'REVIEWED_UNEXPOSED_SUPPLY_UNAVAILABLE', requested: QUESTION_COUNT, available: questionRefs(existing.questionRefs).length }
        : null;
      return { schemaVersion: '2', item: ['recommended', 'starting', 'started'].includes(existing.status) ? this.serialize(existing) : null, shortage, nextDueAt: null };
    }
    const delivery = await this.prisma.learningInterventionDelivery.findFirst({
      where: { userId, status: 'completed', verifications: { none: {} } },
      include: { intervention: true }, orderBy: { completedAt: 'desc' }
    });
    if (!delivery) return { schemaVersion: '2', item: null, shortage: null, nextDueAt: null };
    const created = await this.createImmediate(userId, delivery, input);
    return {
      schemaVersion: '2', item: created.status === 'recommended' ? this.serialize(created) : null,
      shortage: created.status === 'supply_unavailable'
        ? { code: 'REVIEWED_UNEXPOSED_SUPPLY_UNAVAILABLE', requested: QUESTION_COUNT, available: questionRefs(created.questionRefs).length } : null,
      nextDueAt: null
    };
  }

  async start(userId: number, verificationId: string, body: unknown) {
    if (!this.flags.isEnabled('interventionVerification')) throw new ServiceUnavailableException('干预验证暂未开放。');
    const input = StartSchema.parse(body);
    await this.assertNoActiveMock(userId);
    let verification = await this.prisma.learningInterventionVerification.findFirst({ where: { id: verificationId, userId }, include: this.includeContext() });
    if (!verification) throw new NotFoundException('干预验证任务不存在。');
    if (verification.startRequestId === input.clientRequestId && verification.status === 'started' && verification.roundId) return this.serialize(verification);
    if (verification.status === 'started' && verification.roundId) return this.serialize(verification);
    if (verification.status === 'starting') {
      const recoveredRound = await this.prisma.cscaAdaptiveRound.findFirst({
        where: { session: { userId }, plannerSnapshot: { path: ['focus', 'verificationId'], equals: verification.id } }, select: { id: true }
      });
      if (recoveredRound) {
        await this.prisma.learningInterventionVerification.updateMany({
          where: { id: verification.id, userId, status: 'starting', roundId: null }, data: { status: 'started', roundId: recoveredRound.id, startedAt: new Date() }
        });
        verification = await this.prisma.learningInterventionVerification.findFirstOrThrow({ where: { id: verification.id, userId }, include: this.includeContext() });
        return this.serialize(verification);
      }
      if (verification.updatedAt && verification.updatedAt.getTime() < Date.now() - 2 * 60 * 1000) {
        await this.prisma.learningInterventionVerification.updateMany({
          where: { id: verification.id, userId, status: 'starting', roundId: null }, data: { status: 'recommended', startRequestId: null }
        });
        verification = await this.prisma.learningInterventionVerification.findFirstOrThrow({ where: { id: verification.id, userId }, include: this.includeContext() });
      } else throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_START_IN_PROGRESS', message: '验证任务正在启动，请稍后重试。' });
    }
    if (verification.status !== 'recommended' || verification.dueAt.getTime() > Date.now() || verification.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_NOT_STARTABLE', message: '这项验证尚未到期或已经失效，请重新获取学习方案。' });
    }
    const refs = questionRefs(verification.questionRefs).map((ref) => ({
      questionId: Number(ref.id), questionSource: 'csca_question' as const, questionVersion: Number(ref.version),
      topicId: Number(ref.topicId), topicCode: '', topicTitle: '', questionDifficulty: String(ref.difficulty ?? '中等'),
      transferSignature: ref.transferSignature ? String(ref.transferSignature) : null
    } satisfies IndependentVerificationQuestion));
    if (refs.length !== QUESTION_COUNT || refs.some((item) => !Number.isInteger(item.questionId) || !Number.isInteger(item.questionVersion))) throw new BadRequestException('干预验证题引用无效。');
    const claimed = await this.prisma.learningInterventionVerification.updateMany({
      where: { id: verification.id, userId, status: 'recommended', roundId: null }, data: { status: 'starting', startRequestId: input.clientRequestId }
    });
    if (claimed.count !== 1) {
      const latest = await this.prisma.learningInterventionVerification.findFirst({ where: { id: verification.id, userId }, include: this.includeContext() });
      if (latest?.status === 'started' && latest.roundId) return this.serialize(latest);
      throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_STATE_CHANGED', message: '验证任务状态已变化，请刷新后重试。' });
    }
    try {
      const constraints = jsonObject(verification.selectionConstraints);
      const round = await this.adaptive.createInterventionVerificationRound(userId, {
        verificationId: verification.id, phase: phaseOf(verification.phase),
        subject: verification.subjectCode as 'math' | 'physics' | 'chemistry', topicId: verification.topicId,
        questionLanguage: input.questionLanguage, questions: refs,
        excludedTransferSignatures: Array.isArray(constraints.excludedTransferSignatures) ? constraints.excludedTransferSignatures.map(String) : []
      });
      await this.prisma.learningInterventionVerification.updateMany({
        where: { id: verification.id, userId, status: 'starting', startRequestId: input.clientRequestId },
        data: { status: 'started', roundId: round.round.id, startedAt: new Date() }
      });
      await this.confirmSupplyRecovery(
        verification,
        phaseOf(verification.phase),
        refs.length,
        'task_started',
        jsonObject(verification.selectionConstraints)
      );
    } catch (error) {
      const supplyChanged = error instanceof BadRequestException || error instanceof ConflictException;
      await this.prisma.learningInterventionVerification.updateMany({
        where: { id: verification.id, userId, status: 'starting', startRequestId: input.clientRequestId },
        data: supplyChanged ? { status: 'supply_unavailable' } : { status: 'recommended', startRequestId: null }
      });
      throw error;
    }
    verification = await this.prisma.learningInterventionVerification.findFirstOrThrow({ where: { id: verification.id, userId }, include: this.includeContext() });
    return this.serialize(verification);
  }

  private assessmentDecision(phaseResults: Record<string, { result?: string }>) {
    const results = Object.values(phaseResults).map((item) => item.result);
    if (results.includes('failed')) return { status: 'completed', result: 'not_stable' };
    if (results.includes('inconclusive')) return { status: 'completed', result: 'inconclusive' };
    if (['immediate', 'retention', 'transfer'].every((phase) => phaseResults[phase]?.result === 'passed')) {
      return { status: 'completed', result: 'stable' };
    }
    return { status: 'pending', result: null };
  }
  private nextPhase(phase: VerificationPhase, result: string): { phase: VerificationPhase; dueAt: Date } | null {
    if (result !== 'passed') return null;
    if (phase === 'immediate') return { phase: 'retention', dueAt: new Date(Date.now() + retentionDelayMs()) };
    if (phase === 'retention') return { phase: 'transfer', dueAt: new Date() };
    return null;
  }

  async settle(userId: number, verificationId: string) {
    if (!this.flags.isEnabled('interventionVerification')) throw new ServiceUnavailableException('干预验证暂未开放。');
    const verification = await this.prisma.learningInterventionVerification.findFirst({ where: { id: verificationId, userId }, include: this.includeContext() });
    if (!verification) throw new NotFoundException('干预验证任务不存在。');
    if (verification.outcome) return this.serialize(verification);
    if (!verification.roundId || verification.status !== 'started') throw new ConflictException('干预验证尚未开始。');
    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id: verification.roundId, session: { userId } }, include: { items: { orderBy: { position: 'asc' } } }
    });
    if (!round?.submittedAt) throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_NOT_SUBMITTED', message: '请先提交验证题。' });
    const correctCount = round.items.filter((item) => item.isCorrect === true).length;
    const totalCount = round.items.length;
    const answeredCount = round.items.filter((item) => item.isCorrect !== null).length;
    const independent = round.items.every((item) => !item.usedHint && !item.usedExplanation);
    const evidence = await this.prisma.learningEvidenceEvent.findMany({
      where: { userId, sourceId: String(round.id), questionId: { in: round.items.map((item) => `csca_question:${item.questionId}`) } },
      include: { retraction: true }, orderBy: { eventSequence: 'asc' }
    });
    const validEvidence = evidence.filter((item) => !item.retraction);
    const accuracy = totalCount ? correctCount / totalCount : 0;
    const result = !independent || validEvidence.length !== totalCount ? 'inconclusive' : answeredCount === totalCount && accuracy >= 2 / 3 ? 'passed' : 'failed';
    const phase = phaseOf(verification.phase);
    const next = this.nextPhase(phase, result);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.learningInterventionOutcome.upsert({
        where: { verificationId: verification.id },
        create: {
          verificationId: verification.id, deliveryId: verification.deliveryId, interventionId: verification.interventionId,
          userId, result, correctCount, totalCount, accuracy, independent,
          evidenceRefs: validEvidence.map((item) => ({ eventId: item.eventId, evidenceId: item.id, questionId: item.questionId })),
          measurementVersion: verification.measurementVersion,
          metadata: { phase, answeredCount, retractedEvidenceCount: evidence.length - validEvidence.length, masteryChangedByOutcomeWriter: false }
        }, update: {}
      });
      await tx.learningInterventionVerification.updateMany({
        where: { id: verification.id, userId, status: 'started' }, data: { status: 'completed', completedAt: new Date() }
      });
      const outcomes = await tx.learningInterventionOutcome.findMany({
        where: { deliveryId: verification.deliveryId }, include: { verification: { select: { phase: true } } }, orderBy: { evaluatedAt: 'asc' }
      });
      const phaseResults = Object.fromEntries(outcomes.map((item) => [phaseOf(item.verification.phase), {
        outcomeId: item.id, result: item.result, accuracy: item.accuracy, evaluatedAt: item.evaluatedAt.toISOString()
      }]));
      const decision = this.assessmentDecision(phaseResults);
      const evidenceRefs = outcomes.flatMap((item) => Array.isArray(item.evidenceRefs) ? item.evidenceRefs : []);
      await tx.learningInterventionStabilityAssessment.upsert({
        where: { deliveryId: verification.deliveryId },
        create: {
          deliveryId: verification.deliveryId, interventionId: verification.interventionId, userId,
          status: decision.status, result: decision.result, policyVersion: STABILITY_POLICY_VERSION,
          phaseResults, evidenceRefs, evaluatedAt: decision.status === 'completed' ? new Date() : null
        },
        update: {
          status: decision.status, result: decision.result, policyVersion: STABILITY_POLICY_VERSION,
          phaseResults, evidenceRefs, evaluatedAt: decision.status === 'completed' ? new Date() : null
        }
      });
      if (next) {
        await tx.learningInterventionVerification.upsert({
          where: { deliveryId_phase: { deliveryId: verification.deliveryId, phase: next.phase } },
          create: {
            deliveryId: verification.deliveryId, interventionId: verification.interventionId, userId,
            subjectCode: verification.subjectCode, topicId: verification.topicId, phase: next.phase, status: 'scheduled',
            selectionVersion: SELECTION_VERSION[next.phase], measurementVersion: MEASUREMENT_VERSION[next.phase],
            contentSourceVersion: verification.contentSourceVersion, questionRefs: [], selectionConstraints: {},
            supplySnapshot: { schemaVersion: '2', phase: next.phase, scheduledByVerificationId: verification.id, automaticQuestionGenerationInvoked: false, aiInvoked: false },
            conversationId: verification.conversationId, offerRequestId: `scheduled:${verification.id}:${next.phase}`,
            dueAt: next.dueAt, expiresAt: new Date(next.dueAt.getTime() + TASK_EXPIRY_MS)
          }, update: {}
        });
      }
      return saved;
    });
    await this.routingOutcomes?.evaluateAndPersist(verification.subjectCode).catch(() => undefined);
    const refreshed = await this.prisma.learningInterventionVerification.findFirstOrThrow({ where: { id: verification.id, userId }, include: this.includeContext() });
    return this.serialize({ ...refreshed, status: 'completed', outcome });
  }
}
