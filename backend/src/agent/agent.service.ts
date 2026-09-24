import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgentEventService } from './agent-event.service';
import { AgentRunnerService } from './agent-runner.service';
import { publicAgentAttachment } from './agent-attachment.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { LearningReadCapabilityService } from '../learning-intelligence/capabilities/learning-read-capability.service';
import { LearningDecisionService } from '../learning-intelligence/decision/learning-decision.service';
import { LEARNING_STATE_PROJECTOR_VERSION } from '../learning-intelligence/evidence/learning-evidence-writer.service';
import { LearningStateProjectorService } from '../learning-intelligence/projection/learning-state-projector.service';
import { PastPapersService } from '../past-papers/past-papers.service';
import { buildLearningQualitySnapshot } from './learning-quality.policy';
import { AgentPracticeQuestionContextService } from './agent-practice-question-context.service';
import { agentConversationLifecyclePolicy } from './agent-conversation-lifecycle.policy';
import {
  AGENT_RUNTIME_SCHEMA_VERSION,
  CreateAgentConversationInputSchema,
  CreateAgentLearningContextInputSchema,
  routeAgentIntent,
  SubmitAgentMessageInputSchema
} from './agent.types';

export function dedupeReviewQueue<T extends { subject: string; topicId?: number; patternType: string; recurrenceCount: number; priority?: number }>(items: T[]) {
  const byLearningTarget = new Map<string, T>();
  for (const item of items) {
    // A learner acts on one topic at a time. Multiple pattern classifiers for
    // the same topic are supporting evidence, not separate queue tasks.
    const key = item.topicId
      ? `${item.subject}:topic:${item.topicId}`
      : `${item.subject}:general:${item.patternType}`;
    const current = byLearningTarget.get(key);
    if (!current
      || item.recurrenceCount > current.recurrenceCount
      || (item.recurrenceCount === current.recurrenceCount && (item.priority ?? 0) > (current.priority ?? 0))) {
      byLearningTarget.set(key, item);
    }
  }
  return [...byLearningTarget.values()];
}

function recordValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function questionBinding(value: unknown) {
  const pageContext = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const context = pageContext.questionContext && typeof pageContext.questionContext === 'object' && !Array.isArray(pageContext.questionContext)
    ? pageContext.questionContext as Record<string, unknown>
    : null;
  const roundId = Number(context?.roundId);
  const questionId = Number(context?.questionId);
  return Number.isInteger(roundId) && roundId > 0 && Number.isInteger(questionId) && questionId > 0
    ? { roundId, questionId }
    : null;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly runner: AgentRunnerService,
    private readonly events: AgentEventService,
    @Optional() private readonly learningRead?: LearningReadCapabilityService,
    @Optional() private readonly pastPapers?: PastPapersService,
    @Optional() private readonly projector?: LearningStateProjectorService,
    @Optional() private readonly decisions?: LearningDecisionService,
    @Optional() private readonly practiceQuestionContext?: AgentPracticeQuestionContextService
  ) {}

  async getJourneyOverview(userId: number, locale: string | undefined) {
    this.assertEnabled();
    if (!this.learningRead || !this.pastPapers) throw new ServiceUnavailableException('Agent journey data is unavailable.');
    const language = locale === 'en' ? 'en' as const : 'zh' as const;
    await this.projector?.processPending(200).catch(() => undefined);
    const [profile, mastery, reviewQueue, scoreGoal, currentDecision] = await Promise.all([
      this.learningRead.getLearningProfile(userId),
      this.learningRead.getSubjectMastery(userId, { limit: 50 }),
      this.learningRead.getReviewQueue(userId, { language, limit: 40 }),
      this.learningRead.getScoreGoal(userId),
      this.decisions?.recompute(userId).catch(() => null) ?? null
    ]);
    const subjects = profile.targetSubjectCodes.length
      ? profile.targetSubjectCodes
      : ['math', 'physics', 'chemistry'] as const;
    const qualityWindowStart = new Date(Date.now() - 30 * 86_400_000);
    const [paperGroups, topicCounts, prescriptions, prescriptionOutcomes, validations, activePatterns, checkpoints, latestEvidence] = await Promise.all([
      Promise.all(subjects.map((subject) => this.pastPapers!.listPublic({
        subject,
        category: 'past-paper',
        locale: language
      }))),
      this.prisma.cscaExamTopic.groupBy({
        by: ['subject'],
        where: { subject: { in: [...subjects] }, status: 'published' },
        _count: { _all: true }
      }),
      this.prisma.learningPrescription?.findMany({
        where: { userId, createdAt: { gte: qualityWindowStart } },
        select: { id: true }, orderBy: { createdAt: 'desc' }, take: 100
      }) ?? Promise.resolve([]),
      this.prisma.learningPrescriptionOutcome?.findMany({
        where: { userId, createdAt: { gte: qualityWindowStart } },
        select: { prescriptionId: true, decision: true, metadata: true },
        orderBy: { createdAt: 'desc' }, take: 500
      }) ?? Promise.resolve([]),
      this.prisma.learningInterventionStabilityAssessment?.findMany({
        where: { userId, updatedAt: { gte: qualityWindowStart } },
        select: { status: true, result: true, intervention: { select: { subjectCode: true, topicId: true } } },
        orderBy: { updatedAt: 'desc' }, take: 200
      }) ?? Promise.resolve([]),
      this.prisma.cscaWrongPattern?.findMany({
        where: { userId, subject: { in: [...subjects] }, status: { in: ['active', 'improving'] } },
        select: { subject: true, topicId: true }
      }) ?? Promise.resolve([]),
      this.prisma.learningStateProjectionCheckpoint?.findMany({
        where: { userId, subjectCode: { in: [...subjects] }, projectorVersion: LEARNING_STATE_PROJECTOR_VERSION },
        select: { subjectCode: true, lastEventSequence: true }
      }) ?? Promise.resolve([]),
      Promise.all(subjects.map((subject) => this.prisma.learningEvidenceEvent?.findFirst({
        where: { userId, subjectCode: subject, retraction: { is: null } },
        select: { subjectCode: true, eventSequence: true }, orderBy: { eventSequence: 'desc' }
      }) ?? Promise.resolve(null)))
    ]);
    const resources = paperGroups.flatMap((group) => group.items)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 12);
    const primaryTask = currentDecision?.prescription?.tasks.slice().sort((left, right) => left.priority - right.priority)[0] ?? null;
    const baseSupply = primaryTask && ['diagnostic', 'review', 'targeted_practice', 'intervention_verification'].includes(primaryTask.type)
      ? await this.learningRead.getQuestionSupplyStatus({
          subject: primaryTask.subject,
          topicIds: primaryTask.topicIds,
          difficulty: primaryTask.difficulty,
          requestedCount: primaryTask.questionCount ?? 5
        }).catch(() => ({ status: 'unknown' as const, requestedCount: primaryTask.questionCount ?? 5, availableCount: null }))
      : primaryTask ? { status: 'not_required' as const, requestedCount: 0, availableCount: null } : null;
    const contentTopicIds = primaryTask?.topicIds ?? [];
    const contentSupply = contentTopicIds.length ? await Promise.all([
      this.prisma.teachingAsset?.count({
        where: { status: 'published', subjectCode: primaryTask!.subject, topics: { some: { topicId: { in: contentTopicIds }, relationship: 'primary' } }, versions: { some: { status: 'published' } } }
      }) ?? Promise.resolve(0),
      this.prisma.cscaConceptCard?.count({ where: { topicId: { in: contentTopicIds }, status: 'published' } }) ?? Promise.resolve(0),
      this.prisma.cscaQuestion?.count({ where: { topicId: { in: contentTopicIds }, status: { in: ['approved', 'published'] }, explanation: { not: '' } } }) ?? Promise.resolve(0)
    ]).then(([teachingAssetCount, conceptCardCount, explainedQuestionCount]) => ({ teachingAssetCount, conceptCardCount, explainedQuestionCount })).catch(() => ({ teachingAssetCount: 0, conceptCardCount: 0, explainedQuestionCount: 0 })) : null;
    const supply = baseSupply ? { ...baseSupply, ...(contentSupply ?? {}) } : null;
    const checkpointBySubject = new Map(checkpoints.map((item) => [item.subjectCode, item.lastEventSequence]));
    const projectionPending = latestEvidence.some((item) => item && (checkpointBySubject.get(item.subjectCode) ?? 0n) < item.eventSequence);
    const strongTopics = new Set(mastery.subjects.flatMap((subject) => subject.topics
      .filter((topic) => topic.status === 'strong').map((topic) => `${subject.subject}:${topic.topicId}`)));
    const weakTopics = new Set(mastery.subjects.flatMap((subject) => subject.topics
      .filter((topic) => topic.status === 'needs_attention').map((topic) => `${subject.subject}:${topic.topicId}`)));
    const stableTopics = new Set(validations.filter((item) => item.status === 'completed' && item.result === 'stable')
      .map((item) => `${item.intervention.subjectCode}:${item.intervention.topicId}`));
    const quality = buildLearningQualitySnapshot({
      evidenceCount: mastery.subjects.reduce((sum, subject) => sum + subject.evidenceCount, 0),
      evidencedTopicCount: mastery.subjects.reduce((sum, subject) => sum + subject.topics.filter((topic) => topic.attemptCount > 0).length, 0),
      totalTopicCount: topicCounts.reduce((sum, item) => sum + item._count._all, 0),
      projectionPending,
      decisionAvailable: Boolean(currentDecision?.prescription),
      prescriptions: prescriptions.map((item) => ({ prescriptionId: item.id })),
      outcomes: prescriptionOutcomes.map((item) => {
        const metadata = recordValue(item.metadata);
        return {
          prescriptionId: item.prescriptionId,
          decision: item.decision,
          targetAccuracy: typeof metadata.targetAccuracy === 'number' ? metadata.targetAccuracy : null,
          verification: metadata.verification === true
        };
      }),
      validations: validations.map((item) => ({ status: item.status, result: item.result })),
      contradictions: {
        strongWithActiveErrorCount: new Set(activePatterns.filter((item) => item.topicId && strongTopics.has(`${item.subject}:${item.topicId}`)).map((item) => `${item.subject}:${item.topicId}`)).size,
        weakWithStableValidationCount: [...stableTopics].filter((key) => weakTopics.has(key)).length
      },
      supply
    });
    return {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      goal: {
        examDate: scoreGoal.goal?.examDate ?? profile.targetExamDate,
        weeklyGoalDays: profile.weeklyGoalDays,
        totalTargetScore: scoreGoal.goal?.totalTargetScore ?? null,
        subjects: subjects.map((subject) => ({
          subject,
          targetScore: scoreGoal.goal?.subjects.find((item) => item.subject === subject)?.targetScore ?? null
        }))
      },
      progress: {
        subjects: mastery.subjects.map((subject) => ({
          subject: subject.subject,
          totalTopicCount: topicCounts.find((item) => item.subject === subject.subject)?._count._all ?? 0,
          evidencedTopicCount: subject.topics.filter((topic) => topic.attemptCount > 0).length,
          strongTopicCount: subject.topics.filter((topic) => topic.status === 'strong').length,
          developingTopicCount: subject.topics.filter((topic) => topic.status === 'developing').length,
          needsAttentionTopicCount: subject.topics.filter((topic) => topic.status === 'needs_attention').length,
          insufficientEvidenceTopicCount: subject.topics.filter((topic) => topic.status === 'insufficient_evidence').length,
          answerEvidenceCount: subject.evidenceCount
        }))
      },
      nextDecision: currentDecision?.prescription ? {
        prescriptionId: currentDecision.prescription.prescriptionId,
        reasonSummary: currentDecision.prescription.reasonSummary,
        reasonCodes: currentDecision.prescription.reasonCodes,
        confidence: currentDecision.prescription.confidence,
        estimatedMinutes: currentDecision.prescription.estimatedMinutes,
        primaryTask,
        availability: supply,
        source: 'learning_prescription' as const,
        generatedByAI: false as const
      } : null,
      learningQuality: quality,
      weaknesses: {
        stateSource: mastery.stateSource,
        subjects: mastery.subjects,
        reviewQueue: dedupeReviewQueue(reviewQueue.items).slice(0, 12)
      },
      resources: {
        source: 'published_past_papers',
        subjectScope: subjects,
        items: resources
      }
    };
  }

  async recordPrescriptionExposure(userId: number, prescriptionId: string, raw: unknown) {
    this.assertEnabled();
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const clientRequestId = typeof input.clientRequestId === 'string' ? input.clientRequestId.trim() : '';
    if (!clientRequestId || clientRequestId.length > 120) throw new ConflictException('clientRequestId is required.');
    const prescription = await this.prisma.learningPrescription.findFirst({ where: { id: prescriptionId, userId }, select: { id: true } });
    if (!prescription) throw new NotFoundException('学习建议不存在。');
    const existing = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { prescriptionId, userId, decision: 'shown' }, select: { id: true, createdAt: true }
    });
    if (existing) return { schemaVersion: '1', prescriptionId, recorded: false, shownAt: existing.createdAt.toISOString() };
    const created = await this.prisma.learningPrescriptionOutcome.create({
      data: {
        prescriptionId, userId, decision: 'shown',
        metadata: { clientRequestId, surface: typeof input.surface === 'string' ? input.surface.slice(0, 40) : 'agent_plan' }
      },
      select: { createdAt: true }
    });
    return { schemaVersion: '1', prescriptionId, recorded: true, shownAt: created.createdAt.toISOString() };
  }

  async createConversation(userId: number, raw: unknown) {
    this.assertEnabled();
    const input = CreateAgentConversationInputSchema.parse(raw ?? {});
    const scope = input.scope;
    const select = {
      id: true, status: true, title: true, scopeType: true, scopeRoundId: true, scopeQuestionId: true,
      lastMessageAt: true, archivedAt: true, purgeAfter: true, createdAt: true, updatedAt: true
    } as const;
    if (scope.type === 'practice_question_qa') {
      const existing = await this.prisma.agentConversation.findFirst({
        where: {
          userId,
          scopeType: 'practice_question_qa',
          scopeRoundId: scope.roundId,
          scopeQuestionId: scope.questionId,
          status: 'active',
          deletedAt: null
        },
        select
      });
      if (existing) return existing;
    }
    return this.prisma.agentConversation.create({
      data: {
        userId,
        title: input.title ?? null,
        scopeType: scope.type,
        scopeRoundId: scope.type === 'practice_question_qa' ? scope.roundId : null,
        scopeQuestionId: scope.type === 'practice_question_qa' ? scope.questionId : null,
        purgeAfter: scope.type === 'practice_question_qa' ? agentConversationLifecyclePolicy().purgeAfter() : null
      },
      select
    });
  }

  async createLearningContext(userId: number, raw: unknown) {
    this.assertEnabled();
    const input = CreateAgentLearningContextInputSchema.parse(raw ?? {});
    const context = await this.prisma.agentConversation.create({
      data: { userId, title: '__learning_workspace__' },
      select: { id: true, createdAt: true }
    });
    return {
      contextId: context.id,
      kind: input.kind,
      resourceId: input.resourceId ?? null,
      createdAt: context.createdAt
    };
  }

  async listConversations(userId: number) {
    const conversations = await this.prisma.agentConversation.findMany({
      where: { userId, deletedAt: null, scopeType: 'independent_subject_qa' },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        status: true,
        title: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return conversations;
  }

  async getConversation(userId: number, conversationId: string) {
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }, take: 200,
          include: { attachments: { include: { attachment: true }, orderBy: { createdAt: 'asc' } } }
        },
        artifacts: { orderBy: { createdAt: 'asc' } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }
      }
    });
    if (!conversation) throw new NotFoundException('Agent conversation not found.');
    return {
      ...conversation,
      attachments: conversation.attachments.map(publicAgentAttachment),
      messages: conversation.messages.map((message) => ({
        ...message,
        attachments: message.attachments.map((link) => ({
          ...link,
          attachment: publicAgentAttachment(link.attachment)
        }))
      }))
    };
  }

  async submitMessage(userId: number, conversationId: string, raw: unknown) {
    this.assertEnabled();
    let input = SubmitAgentMessageInputSchema.parse(raw);
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null, status: 'active' },
      select: { id: true, scopeType: true, scopeRoundId: true, scopeQuestionId: true }
    });
    if (!conversation) throw new NotFoundException('Agent conversation not found.');

    if (input.surface === 'subject_qa') {
      input = await this.authoritativeSubjectQaInput(userId, input);
      await this.assertSubjectQaConversationScope(userId, conversation, input.pageContext);
    } else if ((conversation.scopeType ?? 'learning_context') !== 'learning_context') {
      throw new ConflictException({
        code: 'AGENT_CONVERSATION_SCOPE_MISMATCH',
        message: '该会话仅用于学科问答，不能作为学习工作台上下文。'
      });
    }

    const attachmentIds = [...new Set(input.attachmentIds)];
    if (attachmentIds.length !== input.attachmentIds.length) throw new ConflictException('Duplicate attachmentIds are not allowed.');
    const attachments = attachmentIds.length ? await this.prisma.agentAttachment.findMany({
      where: { id: { in: attachmentIds }, userId, conversationId, deletedAt: null, status: 'ready' }
    }) : [];
    if (attachments.length !== attachmentIds.length) {
      throw new ConflictException({ code: 'ATTACHMENT_NOT_READY', message: '一个或多个附件尚未处理完成、已删除或不属于当前对话。' });
    }
    const totalAttachmentBytes = attachments.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
    if (totalAttachmentBytes > 100 * 1024 * 1024) throw new ConflictException({ code: 'ATTACHMENT_MESSAGE_TOO_LARGE', message: '单条消息附件总计不能超过 100 MB。' });

    const duplicate = await this.prisma.agentMessage.findFirst({
      where: { conversationId, clientMessageId: input.clientRequestId },
      select: { id: true, content: true, runId: true }
    });
    if (duplicate) {
      const storedText = (duplicate.content as Record<string, unknown> | null)?.text;
      const storedSurface = (duplicate.content as Record<string, unknown> | null)?.surface ?? 'learning_workspace';
      const storedAttachmentIds = (duplicate.content as Record<string, unknown> | null)?.attachmentIds;
      if (storedText !== input.text || storedSurface !== input.surface || JSON.stringify(storedAttachmentIds ?? []) !== JSON.stringify(attachmentIds) || !duplicate.runId) {
        throw new ConflictException('clientRequestId was already used with different content.');
      }
      const existingRun = await this.prisma.agentRun.findFirst({
        where: { id: duplicate.runId, userId, conversationId },
        select: { id: true, status: true }
      });
      if (!existingRun) throw new NotFoundException('Agent run not found.');
      return this.submission(duplicate.id, existingRun.id, existingRun.status);
    }

    const activeRun = await this.prisma.agentRun.findFirst({
      where: { conversationId, userId, status: { in: ['queued', 'running', 'waiting_confirmation'] } },
      select: { id: true }
    });
    if (activeRun) throw new ConflictException('This conversation already has an active run.');

    const traceId = randomUUID();
    let created: { run: { id: string; status: string }; message: { id: string } };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const run = await tx.agentRun.create({
          data: {
            conversationId,
            userId,
            traceId,
            inputSnapshot: {
              schemaVersion: AGENT_RUNTIME_SCHEMA_VERSION,
              intent: routeAgentIntent(input.text),
              text: input.text,
              locale: input.locale,
              surface: input.surface,
              clientRequestId: input.clientRequestId,
              attachmentIds,
              ...(input.pageContext ? { pageContext: input.pageContext } : {})
            } as Prisma.InputJsonValue
          },
          select: { id: true, status: true }
        });
        const message = await tx.agentMessage.create({
          data: {
            conversationId,
            role: 'user',
            clientMessageId: input.clientRequestId,
            runId: run.id,
            content: {
              schemaVersion: AGENT_RUNTIME_SCHEMA_VERSION,
              text: input.text,
              locale: input.locale,
              surface: input.surface,
              attachmentIds,
              ...(input.pageContext ? { pageContext: input.pageContext } : {})
            }
          },
          select: { id: true }
        });
        if (attachments.length) {
          await tx.agentMessageAttachment.createMany({
            data: attachments.map((attachment) => ({
              messageId: message.id,
              attachmentId: attachment.id,
              snapshot: {
                schemaVersion: '1',
                name: attachment.originalName,
                kind: attachment.kind,
                detectedMime: attachment.detectedMime,
                sizeBytes: attachment.sizeBytes,
                pageCount: attachment.pageCount,
                sha256: attachment.sha256
              }
            }))
          });
        }
        const activityAt = new Date();
        await tx.agentConversation.updateMany({
          where: { id: conversationId, userId, deletedAt: null },
          data: {
            lastMessageAt: activityAt,
            ...(conversation.scopeType === 'practice_question_qa'
              ? { purgeAfter: agentConversationLifecyclePolicy().purgeAfter(activityAt) }
              : {})
          }
        });
        return { run, message };
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error;
      const racedMessage = await this.prisma.agentMessage.findFirst({
        where: { conversationId, clientMessageId: input.clientRequestId },
        select: { id: true, content: true, runId: true }
      });
      const racedContent = racedMessage?.content as Record<string, unknown> | null;
      if (racedMessage?.runId
        && racedContent?.text === input.text
        && (racedContent?.surface ?? 'learning_workspace') === input.surface
        && JSON.stringify(racedContent?.attachmentIds ?? []) === JSON.stringify(attachmentIds)) {
        const racedRun = await this.prisma.agentRun.findFirst({
          where: { id: racedMessage.runId, conversationId, userId },
          select: { id: true, status: true }
        });
        if (racedRun) return this.submission(racedMessage.id, racedRun.id, racedRun.status);
      }
      throw new ConflictException('This conversation already has an active run.');
    }
    this.runner.dispatch(created.run.id, userId);
    return this.submission(created.message.id, created.run.id, created.run.status);
  }

  async getRun(userId: number, runId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      include: {
        artifacts: { orderBy: { createdAt: 'asc' } },
        toolCalls: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, toolName: true, toolVersion: true, status: true, errorCode: true, createdAt: true, completedAt: true }
        }
      }
    });
    if (!run) throw new NotFoundException('Agent run not found.');
    return run;
  }

  streamEvents(userId: number, runId: string, afterSequence: number) {
    return this.events.stream(userId, runId, afterSequence);
  }

  private submission(messageId: string, runId: string, status: string) {
    return { messageId, runId, status, eventsUrl: `/api/v1/agent/runs/${encodeURIComponent(runId)}/events` };
  }

  private async authoritativeSubjectQaInput(userId: number, input: ReturnType<typeof SubmitAgentMessageInputSchema.parse>) {
    const pageContext = input.pageContext;
    const requested = pageContext?.questionContext;
    if (!pageContext || !requested) return input;
    if (!this.practiceQuestionContext) {
      throw new ServiceUnavailableException({ code: 'AGENT_QUESTION_CONTEXT_UNAVAILABLE', message: '当前题上下文暂时无法验证，请稍后重试。' });
    }
    const resolved = await this.practiceQuestionContext.resolve(
      userId,
      requested.roundId,
      requested.questionId,
      input.locale === 'en' ? 'en' : 'zh',
      requested.questionSource
    );
    const answered = Boolean(resolved.item.selectedAnswer);
    const question = resolved.question;
    return {
      ...input,
      pageContext: {
        ...pageContext,
        route: pageContext.route,
        artifactId: resolved.artifact.id,
        entityRef: { type: 'adaptive_round' as const, id: String(resolved.roundId) },
        selectedQuestionId: resolved.questionId,
        questionContext: {
          roundId: resolved.roundId,
          questionId: resolved.questionId,
          questionSource: question.questionSource === 'csca_question' ? 'csca_question' as const : 'special_practice' as const,
          questionNumber: resolved.item.position,
          subject: resolved.subject as 'math' | 'physics' | 'chemistry',
          topicTitle: question.topicTitle,
          prompt: question.prompt,
          options: question.options.map((option) => ({ id: option.id, text: option.text })),
          ...(resolved.item.selectedAnswer ? { selectedAnswer: resolved.item.selectedAnswer } : {}),
          answered,
          ...(answered && question.correctAnswer ? { correctAnswer: question.correctAnswer } : {}),
          ...(answered && typeof resolved.item.isCorrect === 'boolean' ? { isCorrect: resolved.item.isCorrect } : {}),
          ...(answered && question.explanation ? { explanation: question.explanation } : {}),
          ...(answered && question.knowledgeTags?.length ? { knowledgeTags: question.knowledgeTags } : {})
        }
      }
    };
  }

  private async assertSubjectQaConversationScope(
    userId: number,
    conversation: { id: string; scopeType: string; scopeRoundId: number | null; scopeQuestionId: number | null },
    pageContext: unknown
  ) {
    const previousBinding = conversation.scopeType === 'practice_question_qa'
      && conversation.scopeRoundId
      && conversation.scopeQuestionId
      ? { roundId: conversation.scopeRoundId, questionId: conversation.scopeQuestionId }
      : null;
    const nextBinding = questionBinding(pageContext);
    const sameScope = (conversation.scopeType === 'independent_subject_qa' && !nextBinding)
      || (conversation.scopeType === 'practice_question_qa'
        && previousBinding?.roundId === nextBinding?.roundId
        && previousBinding?.questionId === nextBinding?.questionId);
    if (sameScope) return;
    const trainingEvents = (this.prisma as unknown as { cscaTrainingEvent?: { create(input: unknown): Promise<unknown> } }).cscaTrainingEvent;
    await trainingEvents?.create({
      data: {
        userId,
        eventType: 'agent_subject_qa_context_mismatch',
        source: 'agent',
        metadata: {
          schemaVersion: '1',
          conversationId: conversation.id,
          conversationScopeType: conversation.scopeType,
          previousBinding,
          requestedBinding: nextBinding
        }
      }
    }).catch(() => undefined);
    throw new ConflictException({
      code: 'AGENT_QA_CONTEXT_MISMATCH',
      message: '该问答会话属于另一道题，请为当前题重新开始问答。'
    });
  }

  private assertEnabled(): void {
    if (!this.flags.isWebEnabled()) {
      throw new ServiceUnavailableException('Web Agent is not enabled.');
    }
  }
}
