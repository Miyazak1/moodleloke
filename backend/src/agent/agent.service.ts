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
import { PastPapersService } from '../past-papers/past-papers.service';
import {
  AGENT_RUNTIME_SCHEMA_VERSION,
  CreateAgentConversationInputSchema,
  routeAgentIntent,
  SubmitAgentMessageInputSchema
} from './agent.types';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly runner: AgentRunnerService,
    private readonly events: AgentEventService,
    @Optional() private readonly learningRead?: LearningReadCapabilityService,
    @Optional() private readonly pastPapers?: PastPapersService
  ) {}

  async getJourneyOverview(userId: number, locale: string | undefined) {
    this.assertEnabled();
    if (!this.learningRead || !this.pastPapers) throw new ServiceUnavailableException('Agent journey data is unavailable.');
    const language = locale === 'en' ? 'en' as const : 'zh' as const;
    const [profile, mastery, reviewQueue] = await Promise.all([
      this.learningRead.getLearningProfile(userId),
      this.learningRead.getSubjectMastery(userId, { limit: 50 }),
      this.learningRead.getReviewQueue(userId, { language, limit: 12 })
    ]);
    const subjects = profile.targetSubjectCodes.length
      ? profile.targetSubjectCodes
      : ['math', 'physics', 'chemistry'] as const;
    const paperGroups = await Promise.all(subjects.map((subject) => this.pastPapers!.listPublic({
      subject,
      category: 'past-paper',
      locale: language
    })));
    const resources = paperGroups.flatMap((group) => group.items)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 12);
    return {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      weaknesses: {
        stateSource: mastery.stateSource,
        subjects: mastery.subjects,
        reviewQueue: reviewQueue.items
      },
      resources: {
        source: 'published_past_papers',
        subjectScope: subjects,
        items: resources
      }
    };
  }

  async createConversation(userId: number, raw: unknown) {
    this.assertEnabled();
    const input = CreateAgentConversationInputSchema.parse(raw ?? {});
    return this.prisma.agentConversation.create({
      data: { userId, title: input.title ?? null },
      select: { id: true, status: true, title: true, lastMessageAt: true, createdAt: true, updatedAt: true }
    });
  }

  listConversations(userId: number) {
    return this.prisma.agentConversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, status: true, title: true, lastMessageAt: true, createdAt: true, updatedAt: true }
    });
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
    const input = SubmitAgentMessageInputSchema.parse(raw);
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null, status: 'active' },
      select: { id: true }
    });
    if (!conversation) throw new NotFoundException('Agent conversation not found.');

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
      const storedAttachmentIds = (duplicate.content as Record<string, unknown> | null)?.attachmentIds;
      if (storedText !== input.text || JSON.stringify(storedAttachmentIds ?? []) !== JSON.stringify(attachmentIds) || !duplicate.runId) {
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
        await tx.agentConversation.updateMany({
          where: { id: conversationId, userId, deletedAt: null },
          data: { lastMessageAt: new Date() }
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

  private assertEnabled(): void {
    if (!this.flags.isWebEnabled()) {
      throw new ServiceUnavailableException('Web Agent is not enabled.');
    }
  }
}
