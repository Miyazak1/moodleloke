import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CscaAdaptiveService } from '../csca-special-practice/csca-adaptive.service';
import { CscaMockExamService } from '../csca-mock-exam/csca-mock-exam.service';
import { LearningDecisionService } from '../learning-intelligence/decision/learning-decision.service';
import { LearningStateProjectorService } from '../learning-intelligence/projection/learning-state-projector.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentEventService } from './agent-event.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { AgentTaskActionInputSchema, ContinueAgentFreePracticeInputSchema, StartAgentFreePracticeInputSchema, StartAgentPracticeInputSchema } from './agent.types';

const TOOL_VERSION = '1.0';
const LEARNING_WORKSPACE_CONTAINER_TITLE = '__learning_workspace__';
const SUPPORTED_TASKS = new Set(['diagnostic', 'review', 'targeted_practice', 'concept_learning', 'mock_exam']);
const TERMINAL_DECISIONS = ['completed', 'failed', 'abandoned', 'superseded'];

type PlanTask = {
  type?: unknown;
  subject?: unknown;
  topicIds?: unknown;
  questionCount?: unknown;
};

type PlanSnapshot = Record<string, unknown> & {
  prescriptionId?: unknown;
  validUntil?: unknown;
  canStart?: unknown;
  task?: PlanTask;
  review?: unknown;
  launch?: unknown;
};

function objectValue(value: Prisma.JsonValue | null): PlanSnapshot {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PlanSnapshot
    : {};
}

function idempotencyHash(userId: number, toolName: string, key: string): string {
  return createHash('sha256').update(`${userId}:${toolName}:${TOOL_VERSION}:${key}`).digest('hex');
}

function positiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

@Injectable()
export class AgentPracticeActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adaptive: CscaAdaptiveService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly events: AgentEventService,
    private readonly mockExam: CscaMockExamService,
    private readonly projector?: LearningStateProjectorService,
    private readonly decisions?: LearningDecisionService
  ) {}

  async startFree(userId: number, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 练习创建能力暂未开放。' });
    }
    const input = StartAgentFreePracticeInputSchema.parse(body);
    const toolName = 'start_student_initiated_practice';
    const keyHash = idempotencyHash(userId, toolName, input.clientRequestId);
    const existing = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    if (existing?.status === 'completed' && existing.output) return existing.output;
    if (existing) throw new ConflictException({ code: 'AGENT_FREE_PRACTICE_CREATE_IN_PROGRESS', message: '自由练习正在创建，请稍后重试。' });

    const conversation = input.conversationId
      ? await this.prisma.agentConversation.findFirst({
          where: { id: input.conversationId, userId, deletedAt: null, status: 'active' },
          select: { id: true }
        })
      : await this.prisma.agentConversation.create({
          data: { userId, title: LEARNING_WORKSPACE_CONTAINER_TITLE },
          select: { id: true }
        });
    if (!conversation) throw new NotFoundException('Agent 学习工作台不存在。');

    const reserved = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.create({
        data: {
          conversationId: conversation.id,
          userId,
          status: 'running',
          traceId: randomUUID(),
          inputSnapshot: { schemaVersion: '1', intent: 'free_practice', source: 'student_initiated', ...input },
          startedAt: new Date(),
          attemptCount: 1
        }
      });
      const call = await tx.agentToolCall.create({
        data: {
          runId: run.id,
          userId,
          toolName,
          toolVersion: TOOL_VERSION,
          status: 'running',
          idempotencyKeyHash: keyHash,
          input
        }
      });
      return { run, call };
    }).catch(async (error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const raced = await this.prisma.agentToolCall.findFirst({
        where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
      });
      if (raced?.status === 'completed' && raced.output) return { output: raced.output } as const;
      throw new ConflictException({ code: 'AGENT_FREE_PRACTICE_CREATE_IN_PROGRESS', message: '自由练习正在创建，请稍后重试。' });
    });
    if ('output' in reserved) return reserved.output;

    try {
      const journeyId = randomUUID();
      const session = await this.adaptive.createSession(userId, {
        subject: input.subject,
        mode: 'practice',
        questionLanguage: input.questionLanguage
      });
      const round = await this.adaptive.createRound(userId, String(session.id), { questionCount: input.questionCount });
      const title = input.questionLanguage === 'zh'
        ? `${input.subject === 'math' ? '数学' : input.subject === 'physics' ? '物理' : '化学'}自由练习`
        : `${input.subject === 'math' ? 'Math' : input.subject === 'physics' ? 'Physics' : 'Chemistry'} free practice`;
      const artifact = await this.prisma.agentArtifact.create({
        data: {
          conversationId: conversation.id,
          runId: reserved.run.id,
          userId,
          type: 'learning_task',
          status: 'started',
          title,
          summary: input.questionLanguage === 'zh' ? `学生主动开始，可随时结束；本批 ${round.questions.length} 题。` : `Student-initiated and stoppable at any time; ${round.questions.length} questions in this batch.`,
          domainEntityType: 'csca_adaptive_round',
          domainEntityId: String(round.round.id),
          snapshot: {
            schemaVersion: '1',
            source: 'student_initiated',
            task: { type: 'free_practice', subject: input.subject, questionCount: round.questions.length },
            freePracticeJourneyId: journeyId,
            batchIndex: 1,
            journeyStatus: 'active',
            sessionId: round.session.id,
            roundId: round.round.id
          }
        }
      });
      const legacyRoute = `/csca-subjects/${encodeURIComponent(input.subject)}/practice/rounds/${round.round.id}?agentContextId=${encodeURIComponent(conversation.id)}&agentArtifactId=${encodeURIComponent(artifact.id)}`;
      const route = `/agent?agentContextId=${encodeURIComponent(conversation.id)}&agentArtifactId=${encodeURIComponent(artifact.id)}&agentRoundId=${round.round.id}&agentView=practice&agentTaskType=free_practice&agentSubject=${encodeURIComponent(input.subject)}`;
      const output = {
        schemaVersion: '1', artifactId: artifact.id, conversationId: conversation.id,
        sessionId: round.session.id, roundId: round.round.id, mode: round.session.mode,
        questionCount: round.questions.length, subject: round.session.subject,
        questionLanguage: round.session.questionLanguage, toolName, taskType: 'free_practice',
        route, legacyRoute, journeyId, batchIndex: 1,
        workspace: {
          kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: input.subject,
          reasonCodes: ['student_initiated'], objective: null
        }
      };
      await this.prisma.$transaction(async (tx) => {
        await tx.agentArtifact.update({ where: { id: artifact.id }, data: { snapshot: { ...objectValue(artifact.snapshot), launch: output } as Prisma.InputJsonValue } });
        await tx.agentToolCall.update({ where: { id: reserved.call.id }, data: { status: 'completed', output, completedAt: new Date() } });
        await tx.agentRun.update({ where: { id: reserved.run.id }, data: { status: 'completed', completedAt: new Date() } });
        await tx.agentMessage.create({
          data: {
            conversationId: conversation.id, role: 'assistant', runId: reserved.run.id,
            clientMessageId: `assistant:${reserved.run.id}`,
            content: {
              schemaVersion: '1',
              text: input.questionLanguage === 'zh' ? `已开始${title}。这不是强制计划，你可以做完本批继续，也可以随时结束。` : `${title} is ready. This is not a required plan: continue after this batch or stop whenever you want.`,
              artifactIds: [artifact.id], source: 'student_initiated'
            }
          }
        });
        await tx.agentConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        await this.events.append(tx, {
          runId: reserved.run.id, conversationId: conversation.id,
          eventKey: `practice:${artifact.id}:started`, eventType: 'practice.started',
          data: { artifactId: artifact.id, sessionId: round.session.id, roundId: round.round.id, subject: input.subject, source: 'student_initiated' }
        });
      });
      return output;
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.agentToolCall.updateMany({ where: { id: reserved.call.id }, data: { status: 'failed', errorCode: error instanceof Error ? error.name.slice(0, 80) : 'AGENT_FREE_PRACTICE_CREATE_FAILED', completedAt: new Date() } }),
        this.prisma.agentRun.updateMany({ where: { id: reserved.run.id }, data: { status: 'failed', errorCode: 'AGENT_FREE_PRACTICE_CREATE_FAILED', completedAt: new Date() } })
      ]);
      throw error;
    }
  }

  async continueFree(userId: number, artifactId: string, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 练习创建能力暂未开放。' });
    }
    const input = ContinueAgentFreePracticeInputSchema.parse(body);
    const previous = await this.prisma.agentArtifact.findFirst({
      where: { id: artifactId, userId, type: 'learning_task' }
    });
    if (!previous) throw new NotFoundException('自由练习批次不存在。');
    const previousSnapshot = objectValue(previous.snapshot);
    const previousTask = previousSnapshot.task && typeof previousSnapshot.task === 'object' && !Array.isArray(previousSnapshot.task)
      ? previousSnapshot.task as Record<string, unknown>
      : {};
    if (previousTask.type !== 'free_practice' || previousSnapshot.source !== 'student_initiated') {
      throw new BadRequestException({ code: 'NOT_FREE_PRACTICE', message: '当前任务不是学生主动发起的自由练习。' });
    }
    if (!['completed', 'failed'].includes(previous.status)) {
      throw new ConflictException({ code: 'FREE_PRACTICE_BATCH_NOT_SETTLED', message: '请先完成并结算当前批次。' });
    }
    if (previousSnapshot.journeyStatus === 'ended') {
      throw new ConflictException({ code: 'FREE_PRACTICE_JOURNEY_ENDED', message: '本次自由练习已经结束。' });
    }
    const journeyId = typeof previousSnapshot.freePracticeJourneyId === 'string' ? previousSnapshot.freePracticeJourneyId : previous.id;
    const journeyArtifacts = await this.prisma.agentArtifact.findMany({
      where: { conversationId: previous.conversationId, userId, type: 'learning_task' },
      select: { id: true, snapshot: true }
    });
    const existingSuccessor = journeyArtifacts.find((item) => objectValue(item.snapshot).previousArtifactId === previous.id);
    if (existingSuccessor) {
      const launch = objectValue(existingSuccessor.snapshot).launch;
      if (launch && typeof launch === 'object' && !Array.isArray(launch)) return launch;
      throw new ConflictException({ code: 'FREE_PRACTICE_SUCCESSOR_INCOMPLETE', message: '下一批练习正在恢复，请稍后重试。' });
    }

    const toolName = 'continue_student_initiated_practice';
    const keyHash = idempotencyHash(userId, toolName, input.clientRequestId);
    const existing = await this.prisma.agentToolCall.findFirst({ where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash } });
    if (existing?.status === 'completed' && existing.output) return existing.output;
    if (existing) throw new ConflictException({ code: 'AGENT_FREE_PRACTICE_END_IN_PROGRESS', message: '自由练习正在结束，请稍后重试。' });
    if (existing) throw new ConflictException({ code: 'AGENT_FREE_PRACTICE_CREATE_IN_PROGRESS', message: '下一批自由练习正在创建，请稍后重试。' });
    const reserved = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.create({ data: {
        conversationId: previous.conversationId, userId, status: 'running', traceId: randomUUID(),
        inputSnapshot: { schemaVersion: '1', intent: 'continue_free_practice', artifactId, journeyId, ...input },
        startedAt: new Date(), attemptCount: 1
      } });
      const call = await tx.agentToolCall.create({ data: {
        runId: run.id, userId, toolName, toolVersion: TOOL_VERSION, status: 'running', idempotencyKeyHash: keyHash, input
      } });
      return { run, call };
    });
    try {
      const session = await this.adaptive.createSession(userId, { subject: input.subject, mode: 'practice', questionLanguage: input.questionLanguage });
      const round = await this.adaptive.createRound(userId, String(session.id), { questionCount: input.questionCount });
      const batchIndex = positiveInteger(previousSnapshot.batchIndex) ? Number(previousSnapshot.batchIndex) + 1 : 2;
      const title = input.questionLanguage === 'zh'
        ? `${input.subject === 'math' ? '数学' : input.subject === 'physics' ? '物理' : '化学'}自由练习 · 第 ${batchIndex} 批`
        : `${input.subject === 'math' ? 'Math' : input.subject === 'physics' ? 'Physics' : 'Chemistry'} free practice · Batch ${batchIndex}`;
      const artifact = await this.prisma.agentArtifact.create({ data: {
        conversationId: previous.conversationId, runId: reserved.run.id, userId, type: 'learning_task', status: 'started', title,
        summary: input.questionLanguage === 'zh' ? `连续自由练习第 ${batchIndex} 批，共 ${round.questions.length} 题。` : `Continuous free practice batch ${batchIndex}, ${round.questions.length} questions.`,
        domainEntityType: 'csca_adaptive_round', domainEntityId: String(round.round.id),
        snapshot: {
          schemaVersion: '1', source: 'student_initiated', task: { type: 'free_practice', subject: input.subject, questionCount: round.questions.length },
          freePracticeJourneyId: journeyId, batchIndex, previousArtifactId: previous.id, journeyStatus: 'active',
          sessionId: round.session.id, roundId: round.round.id
        }
      } });
      const legacyRoute = `/csca-subjects/${encodeURIComponent(input.subject)}/practice/rounds/${round.round.id}?agentContextId=${encodeURIComponent(previous.conversationId)}&agentArtifactId=${encodeURIComponent(artifact.id)}`;
      const route = `/agent?agentContextId=${encodeURIComponent(previous.conversationId)}&agentArtifactId=${encodeURIComponent(artifact.id)}&agentRoundId=${round.round.id}&agentView=practice&agentTaskType=free_practice&agentSubject=${encodeURIComponent(input.subject)}`;
      const output = {
        schemaVersion: '1', artifactId: artifact.id, conversationId: previous.conversationId, sessionId: round.session.id, roundId: round.round.id,
        mode: round.session.mode, questionCount: round.questions.length, subject: round.session.subject, questionLanguage: round.session.questionLanguage,
        toolName, taskType: 'free_practice', route, legacyRoute, journeyId, batchIndex,
        workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: input.subject, reasonCodes: ['student_initiated', 'continuous_batch'], objective: null }
      };
      await this.prisma.$transaction(async (tx) => {
        await tx.agentArtifact.update({ where: { id: artifact.id }, data: { snapshot: { ...objectValue(artifact.snapshot), launch: output } as Prisma.InputJsonValue } });
        await tx.agentToolCall.update({ where: { id: reserved.call.id }, data: { status: 'completed', output, completedAt: new Date() } });
        await tx.agentRun.update({ where: { id: reserved.run.id }, data: { status: 'completed', completedAt: new Date() } });
        await tx.agentMessage.create({ data: {
          conversationId: previous.conversationId, role: 'assistant', runId: reserved.run.id, clientMessageId: `assistant:${reserved.run.id}`,
          content: { schemaVersion: '1', text: input.questionLanguage === 'zh' ? `已准备第 ${batchIndex} 批自由练习。科目和题量可以逐批调整。` : `Free-practice batch ${batchIndex} is ready. Subject and batch size can change between batches.`, artifactIds: [artifact.id], source: 'student_initiated' }
        } });
        await tx.agentConversation.update({ where: { id: previous.conversationId }, data: { lastMessageAt: new Date() } });
        await this.events.append(tx, { runId: reserved.run.id, conversationId: previous.conversationId, eventKey: `free-practice:${artifact.id}:continued`, eventType: 'free_practice.continued', data: { artifactId: artifact.id, previousArtifactId: previous.id, journeyId, batchIndex } });
      });
      return output;
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.agentToolCall.updateMany({ where: { id: reserved.call.id }, data: { status: 'failed', errorCode: 'AGENT_FREE_PRACTICE_CONTINUE_FAILED', completedAt: new Date() } }),
        this.prisma.agentRun.updateMany({ where: { id: reserved.run.id }, data: { status: 'failed', errorCode: 'AGENT_FREE_PRACTICE_CONTINUE_FAILED', completedAt: new Date() } })
      ]);
      throw error;
    }
  }

  async endFree(userId: number, artifactId: string, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 练习写入能力暂未开放。' });
    }
    const input = AgentTaskActionInputSchema.parse(body);
    const artifact = await this.prisma.agentArtifact.findFirst({ where: { id: artifactId, userId, type: 'learning_task' } });
    if (!artifact) throw new NotFoundException('自由练习批次不存在。');
    const snapshot = objectValue(artifact.snapshot);
    const task = snapshot.task && typeof snapshot.task === 'object' && !Array.isArray(snapshot.task) ? snapshot.task as Record<string, unknown> : {};
    if (task.type !== 'free_practice' || snapshot.source !== 'student_initiated') throw new BadRequestException({ code: 'NOT_FREE_PRACTICE', message: '当前任务不是自由练习。' });
    const journeyId = typeof snapshot.freePracticeJourneyId === 'string' ? snapshot.freePracticeJourneyId : artifact.id;
    if (snapshot.journeyStatus === 'ended') throw new ConflictException({ code: 'FREE_PRACTICE_JOURNEY_ENDED', message: '本次自由练习已经结束。' });
    const toolName = 'end_student_initiated_practice';
    const keyHash = idempotencyHash(userId, toolName, input.clientRequestId);
    const existing = await this.prisma.agentToolCall.findFirst({ where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash } });
    if (existing?.status === 'completed' && existing.output) return existing.output;
    const all = await this.prisma.agentArtifact.findMany({ where: { conversationId: artifact.conversationId, userId, type: 'learning_task' }, orderBy: { createdAt: 'asc' } });
    const journey = all.filter((item) => {
      const value = objectValue(item.snapshot);
      return (typeof value.freePracticeJourneyId === 'string' ? value.freePracticeJourneyId : item.id) === journeyId;
    });
    if (journey.some((item) => objectValue(item.snapshot).previousArtifactId === artifact.id)) throw new ConflictException({ code: 'FREE_PRACTICE_NOT_LATEST_BATCH', message: '请在最新一批练习中结束本次学习。' });
    const allocatedQuestionCount = journey.reduce((sum, item) => {
      const value = objectValue(item.snapshot);
      const valueTask = value.task && typeof value.task === 'object' && !Array.isArray(value.task) ? value.task as Record<string, unknown> : {};
      return sum + (positiveInteger(valueTask.questionCount) ?? 0);
    }, 0);
    const settledBatches = journey.filter((item) => {
      const value = objectValue(item.snapshot);
      return value.settlement && typeof value.settlement === 'object' && !Array.isArray(value.settlement);
    });
    const totalQuestions = settledBatches.reduce((sum, item) => {
      const settlement = objectValue(objectValue(item.snapshot).settlement as Prisma.JsonValue);
      return sum + (positiveInteger(settlement.targetTotal) ?? 0);
    }, 0);
    const reserved = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.create({ data: { conversationId: artifact.conversationId, userId, status: 'running', traceId: randomUUID(), inputSnapshot: { schemaVersion: '1', intent: 'end_free_practice', artifactId, journeyId }, startedAt: new Date(), attemptCount: 1 } });
      const call = await tx.agentToolCall.create({ data: { runId: run.id, userId, toolName, toolVersion: TOOL_VERSION, status: 'running', idempotencyKeyHash: keyHash, input } });
      return { run, call };
    }).catch(async (error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const raced = await this.prisma.agentToolCall.findFirst({ where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash } });
      if (raced?.status === 'completed' && raced.output) return { output: raced.output } as const;
      throw new ConflictException({ code: 'AGENT_FREE_PRACTICE_END_IN_PROGRESS', message: '自由练习正在结束，请稍后重试。' });
    });
    if ('output' in reserved) return reserved.output;
    const endedAt = new Date();
    const activeRoundId = positiveInteger(snapshot.roundId);
    const activeSessionId = positiveInteger(snapshot.sessionId);
    const output = {
      schemaVersion: '1', journeyId, artifactId, status: 'ended', batchCount: journey.length,
      completedBatchCount: settledBatches.length, totalQuestions, allocatedQuestionCount, endedAt: endedAt.toISOString()
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.agentArtifact.update({
        where: { id: artifact.id },
        data: {
          status: TERMINAL_DECISIONS.includes(artifact.status) ? artifact.status : 'abandoned',
          snapshot: { ...snapshot, journeyStatus: 'ended', endedAt: output.endedAt } as Prisma.InputJsonValue
        }
      });
      if (activeRoundId && activeSessionId) {
        await tx.cscaAdaptiveRound.updateMany({
          where: { id: activeRoundId, sessionId: activeSessionId, submittedAt: null },
          data: { status: 'abandoned' }
        });
        await tx.cscaAdaptiveSession.updateMany({
          where: { id: activeSessionId, userId, status: 'active' },
          data: { status: 'completed', completedAt: endedAt }
        });
      }
      await tx.agentToolCall.update({ where: { id: reserved.call.id }, data: { status: 'completed', output, completedAt: new Date() } });
      await tx.agentRun.update({ where: { id: reserved.run.id }, data: { status: 'completed', completedAt: new Date() } });
      await tx.agentMessage.create({ data: {
        conversationId: artifact.conversationId, role: 'assistant', runId: reserved.run.id, clientMessageId: `assistant:${reserved.run.id}`,
        content: { schemaVersion: '1', text: `本次自由练习已结束：完成 ${settledBatches.length} 批，共 ${totalQuestions} 题${settledBatches.length < journey.length ? '；未完成的当前批次不计入成绩' : ''}。作答证据已进入学习画像，之后可以从新的科目或题量重新开始。`, artifactIds: journey.map((item) => item.id), source: 'student_initiated' }
      } });
      await tx.agentConversation.update({ where: { id: artifact.conversationId }, data: { lastMessageAt: new Date() } });
      await this.events.append(tx, { runId: reserved.run.id, conversationId: artifact.conversationId, eventKey: `free-practice:${journeyId}:ended`, eventType: 'free_practice.ended', data: output });
    });
    return output;
  }

  async start(userId: number, artifactId: string, body: unknown, expectedKind: 'practice' | 'mock_exam' = 'practice') {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 练习创建能力暂未开放。' });
    }
    const input = StartAgentPracticeInputSchema.parse(body);
    const artifact = await this.prisma.agentArtifact.findFirst({
      where: { id: artifactId, userId, type: 'learning_plan' }
    });
    if (!artifact) throw new NotFoundException('学习方案不存在。');

    const snapshot = objectValue(artifact.snapshot);
    const task = snapshot.task && typeof snapshot.task === 'object' && !Array.isArray(snapshot.task)
      ? snapshot.task
      : {};
    const review = snapshot.review && typeof snapshot.review === 'object' && !Array.isArray(snapshot.review)
      ? snapshot.review as Record<string, unknown>
      : null;
    const taskType = String(task.type ?? '');
    if (expectedKind === 'mock_exam' && taskType !== 'mock_exam') {
      throw new BadRequestException({ code: 'AGENT_TASK_NOT_MOCK_EXAM', message: '当前推荐不是在线模考。' });
    }
    if (expectedKind === 'practice' && taskType === 'mock_exam') {
      throw new BadRequestException({ code: 'AGENT_TASK_NOT_PRACTICE', message: '在线模考必须通过模考启动接口创建。' });
    }
    const toolName = taskType === 'mock_exam'
      ? 'start_mock_exam'
      : taskType === 'review' || taskType === 'concept_learning'
        ? 'start_review_practice'
        : 'create_adaptive_practice';
    const keyHash = idempotencyHash(userId, toolName, input.clientRequestId);
    let call = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    if (call && String((call.input as Record<string, unknown>)?.artifactId ?? '') !== artifact.id) {
      throw new ConflictException('clientRequestId was already used for another learning plan.');
    }
    if (call?.status === 'completed' && call.output) return call.output;
    if (artifact.status === 'started' && snapshot.launch && typeof snapshot.launch === 'object' && !Array.isArray(snapshot.launch)) {
      return snapshot.launch;
    }
    if (TERMINAL_DECISIONS.includes(artifact.status)) {
      throw new ConflictException({ code: 'AGENT_TASK_TERMINAL', message: '这项任务已经结算，请让 Agent 更新下一步。' });
    }

    const subject = String(task.subject ?? '');
    if (!SUPPORTED_TASKS.has(taskType)) throw new BadRequestException({ code: 'AGENT_TASK_NOT_PRACTICE', message: '当前推荐不是可创建的自适应练习。' });
    if (!['math', 'physics', 'chemistry'].includes(subject)) throw new BadRequestException({ code: 'AGENT_TASK_SUBJECT_INVALID', message: '学习方案科目无效。' });
    if (snapshot.canStart !== true) throw new ConflictException({ code: 'AGENT_TASK_SUPPLY_UNAVAILABLE', message: '当前题源不足，无法创建这项练习。' });

    const prescriptionId = String(snapshot.prescriptionId ?? artifact.domainEntityId ?? '');
    const currentDecision = prescriptionId
      ? await this.prisma.learningDecisionCurrent.findFirst({
          where: { userId, prescriptionId },
          include: { prescription: { select: { validUntil: true } } }
        })
      : null;
    if (!currentDecision || currentDecision.prescription.validUntil.getTime() <= Date.now()) {
      await this.recordTerminalOutcome(userId, artifact, snapshot, 'superseded', null, { reason: 'prescription_not_current' });
      throw new ConflictException({ code: 'AGENT_PLAN_STALE', message: '这份方案已经过期，请让 Agent 重新分析下一步。' });
    }

    let verifiedReview: { id: number; topicId: number | null; patternType: string } | null = null;
    if (toolName === 'start_review_practice') {
      const reviewItemId = positiveInteger(review?.reviewItemId);
      if (!reviewItemId) throw new ConflictException({ code: 'AGENT_REVIEW_ITEM_UNAVAILABLE', message: '当前错题任务已变化，请让 Agent 重新分析。' });
      verifiedReview = await this.prisma.cscaWrongPattern.findFirst({
        where: { id: reviewItemId, userId, subject, status: { in: ['active', 'improving'] } },
        select: { id: true, topicId: true, patternType: true }
      });
      if (!verifiedReview || (review?.patternType && verifiedReview.patternType !== String(review.patternType))) {
        await this.recordTerminalOutcome(userId, artifact, snapshot, 'superseded', null, { reason: 'review_item_not_current' });
        throw new ConflictException({ code: 'AGENT_REVIEW_ITEM_UNAVAILABLE', message: '这项错题复习已经完成或发生变化，请让 Agent 更新方案。' });
      }
    }

    if (!call) {
      try {
        call = await this.prisma.agentToolCall.create({
          data: {
            runId: artifact.runId,
            userId,
            toolName,
            toolVersion: TOOL_VERSION,
            idempotencyKeyHash: keyHash,
            input: { artifactId: artifact.id, ...input }
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        call = await this.prisma.agentToolCall.findFirst({
          where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
        });
      }
    }
    if (!call) throw new ConflictException('Unable to reserve Agent practice action.');
    if (call.status === 'running' && call.createdAt.getTime() < Date.now() - 5 * 60 * 1000) {
      await this.prisma.agentToolCall.updateMany({
        where: { id: call.id, status: 'running' },
        data: { status: 'failed', errorCode: 'STALE_EXECUTION_RECOVERED', completedAt: new Date() }
      });
    }
    const claimed = await this.prisma.agentToolCall.updateMany({
      where: { id: call.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'running', errorCode: null, completedAt: null }
    });
    if (claimed.count !== 1) {
      const latest = await this.prisma.agentToolCall.findFirst({
        where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
      });
      if (latest?.status === 'completed' && latest.output) return latest.output;
      throw new ConflictException({ code: 'AGENT_PRACTICE_CREATE_IN_PROGRESS', message: '这项练习正在创建，请稍后重试。' });
    }

    try {
      const questionLanguage = input.questionLanguage ?? 'zh';
      if (taskType === 'mock_exam') {
        if (!this.mockExam) throw new ServiceUnavailableException({ code: 'AGENT_MOCK_EXAM_UNAVAILABLE', message: 'Agent 模考能力暂时不可用。' });
        const subjectDetail = await this.mockExam.listSubjectPapers(subject, questionLanguage === 'zh' ? 'zh-CN' : 'en', userId);
        const recommendation = subjectDetail.recommendation;
        const recommendedTarget = recommendation?.target;
        const fallbackPaper = subjectDetail.papers.find((paper) => !paper.isLocked) ?? subjectDetail.papers[0];
        let attempt;
        let paperSlug: string;
        let launchMode = recommendation?.mode ?? 'initial_diagnostic';
        if (recommendedTarget?.type === 'attempt') {
          const detail = await this.mockExam.getAttempt(String(recommendedTarget.attemptId), userId, questionLanguage);
          attempt = detail.attempt;
          paperSlug = detail.attempt.paper.slug;
          launchMode = 'resume_attempt';
        } else {
          paperSlug = recommendedTarget?.type === 'paper' ? recommendedTarget.paperSlug : fallbackPaper?.slug ?? '';
          if (!paperSlug) throw new ConflictException({ code: 'AGENT_MOCK_EXAM_SUPPLY_UNAVAILABLE', message: '当前没有可用的已发布模考。' });
          attempt = await this.mockExam.createAttempt(paperSlug, userId, { language: questionLanguage });
        }
        const legacyRoute = `/csca-mock-exam/attempts/${attempt.id}`;
        const route = `/agent?agentContextId=${encodeURIComponent(artifact.conversationId)}&agentArtifactId=${encodeURIComponent(artifact.id)}&agentMockExamAttemptId=${attempt.id}&agentView=mock-exam&agentTaskType=mock_exam&agentSubject=${encodeURIComponent(subject)}`;
        const output = {
          schemaVersion: '1', artifactId: artifact.id, conversationId: artifact.conversationId,
          attemptId: attempt.id, paperSlug, paperTitle: attempt.paper.title,
          subject, questionLanguage, toolName, taskType, mode: launchMode,
          route, legacyRoute,
          workspace: {
            kind: 'mock_exam', phase: 'taking', taskType, subject,
            reasonCodes: Array.isArray(snapshot.reasonCodes) ? snapshot.reasonCodes : [],
            objective: typeof snapshot.objective === 'string' ? snapshot.objective : null
          }
        };
        await this.prisma.$transaction(async (tx) => {
          await tx.agentToolCall.update({ where: { id: call!.id }, data: { status: 'completed', output, errorCode: null, completedAt: new Date() } });
          await tx.agentArtifact.update({ where: { id: artifact.id }, data: { status: 'started', snapshot: { ...snapshot, launch: output } as Prisma.InputJsonValue } });
          await tx.learningPrescriptionOutcome.create({
            data: {
              prescriptionId, userId, decision: 'accepted', taskIndex: 0,
              domainEntityType: 'mock_exam_attempt', domainEntityId: String(attempt.id),
              metadata: { artifactId: artifact.id, toolCallId: call!.id, paperSlug }
            }
          });
          await this.events.append(tx, {
            runId: artifact.runId, conversationId: artifact.conversationId,
            eventKey: `mock-exam:${artifact.id}:started`, eventType: 'mock_exam.started',
            data: { artifactId: artifact.id, attemptId: attempt.id, subject, paperSlug, mode: launchMode }
          });
        });
        return output;
      }
      const requestedMode = taskType === 'diagnostic' ? 'diagnostic' : 'practice';
      const session = await this.adaptive.createSession(userId, { subject, mode: requestedMode, questionLanguage });
      const questionCount = positiveInteger(snapshot.task?.questionCount) ?? 5;
      const topicIds = Array.isArray(task.topicIds) ? task.topicIds : [];
      const focusTopicId = taskType === 'diagnostic' ? undefined : verifiedReview?.topicId ?? positiveInteger(topicIds[0]);
      const roundInput = verifiedReview
        ? {
            questionCount,
            ...(focusTopicId ? { focusTopicId } : {}),
            verification: {
              reviewItemId: verifiedReview.id,
              ...(verifiedReview.topicId ? { topicId: verifiedReview.topicId } : {}),
              patternType: verifiedReview.patternType
            }
          }
        : focusTopicId ? { questionCount, focusTopicId } : { questionCount };
      const round = await this.adaptive.createRound(userId, String(session.id), roundInput);
      const legacyRoute = `/csca-subjects/${encodeURIComponent(subject)}/practice/rounds/${round.round.id}?agentContextId=${encodeURIComponent(artifact.conversationId)}&agentArtifactId=${encodeURIComponent(artifact.id)}`;
      const route = `/agent?agentContextId=${encodeURIComponent(artifact.conversationId)}&agentArtifactId=${encodeURIComponent(artifact.id)}&agentRoundId=${round.round.id}&agentView=practice&agentTaskType=${encodeURIComponent(taskType)}&agentSubject=${encodeURIComponent(subject)}`;
      const output = {
        schemaVersion: '1',
        artifactId: artifact.id,
        conversationId: artifact.conversationId,
        sessionId: round.session.id,
        roundId: round.round.id,
        mode: round.session.mode,
        questionCount: round.questions.length,
        subject: round.session.subject,
        questionLanguage: round.session.questionLanguage,
        toolName,
        taskType,
        ...(verifiedReview ? { reviewItemId: verifiedReview.id } : {}),
        route,
        legacyRoute,
        workspace: {
          kind: 'adaptive_round',
          phase: 'practice',
          taskType,
          subject,
          reasonCodes: Array.isArray(snapshot.reasonCodes) ? snapshot.reasonCodes : [],
          objective: typeof snapshot.objective === 'string' ? snapshot.objective : null
        }
      };
      await this.prisma.$transaction(async (tx) => {
        await tx.agentToolCall.update({
          where: { id: call!.id },
          data: { status: 'completed', output, errorCode: null, completedAt: new Date() }
        });
        await tx.agentArtifact.update({
          where: { id: artifact.id },
          data: { status: 'started', snapshot: { ...snapshot, launch: output } as Prisma.InputJsonValue }
        });
        await tx.learningPrescriptionOutcome.create({
          data: {
            prescriptionId,
            userId,
            decision: 'accepted',
            taskIndex: 0,
            domainEntityType: 'csca_adaptive_round',
            domainEntityId: String(round.round.id),
            metadata: { artifactId: artifact.id, sessionId: round.session.id, toolCallId: call!.id }
          }
        });
        await this.events.append(tx, {
          runId: artifact.runId,
          conversationId: artifact.conversationId,
          eventKey: `practice:${artifact.id}:started`,
          eventType: 'practice.started',
          data: { artifactId: artifact.id, sessionId: round.session.id, roundId: round.round.id, subject }
        });
      });
      return output;
    } catch (error) {
      await this.prisma.agentToolCall.updateMany({
        where: { id: call.id, status: { not: 'completed' } },
        data: { status: 'failed', errorCode: error instanceof Error ? error.name.slice(0, 80) : 'AGENT_PRACTICE_CREATE_FAILED', completedAt: new Date() }
      });
      throw error;
    }
  }

  async settle(userId: number, roundIdValue: string) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 练习结算能力暂未开放。' });
    }
    const roundId = positiveInteger(roundIdValue);
    if (!roundId) throw new BadRequestException('训练轮次无效。');
    const accepted = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { userId, decision: 'accepted', domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId) },
      orderBy: { createdAt: 'desc' }
    });
    const acceptedMetadata = objectValue(accepted?.metadata ?? null);
    const acceptedArtifactId = String(acceptedMetadata.artifactId ?? '');
    const prescribedArtifact = acceptedArtifactId
      ? await this.prisma.agentArtifact.findFirst({ where: { id: acceptedArtifactId, userId, type: 'learning_plan' } })
      : null;
    const freeArtifact = prescribedArtifact ? null : await this.prisma.agentArtifact.findFirst({
      where: { userId, type: 'learning_task', domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId) },
      orderBy: { createdAt: 'desc' }
    });
    const artifact = prescribedArtifact ?? freeArtifact;
    const artifactId = artifact?.id ?? '';
    if (!artifact || (!accepted && artifact.type !== 'learning_task')) throw new NotFoundException('该轮次不是当前用户的 Agent 学习任务。');

    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id: roundId, session: { userId } },
      include: { session: { select: { subject: true } }, items: { select: { topicId: true, isCorrect: true } } }
    });
    if (!round) throw new NotFoundException('训练轮次不存在。');
    if (!round.submittedAt) throw new ConflictException({ code: 'AGENT_TASK_NOT_SUBMITTED', message: '请先提交本轮训练。' });

    const planner = objectValue(round.plannerSnapshot);
    const focus = planner.focus && typeof planner.focus === 'object' && !Array.isArray(planner.focus)
      ? planner.focus as Record<string, unknown>
      : {};
    const focusTopicId = positiveInteger(focus.topicId);
    const targetItems = planner.mode === 'verification' && focusTopicId
      ? round.items.filter((item) => item.topicId === focusTopicId)
      : round.items;
    const targetCorrect = targetItems.filter((item) => item.isCorrect === true).length;
    const targetAccuracy = targetItems.length ? targetCorrect / targetItems.length : 0;
    const decision = planner.mode === 'verification' && targetAccuracy < 0.8 ? 'failed' : 'completed';
    const toolName = 'settle_learning_task';
    const keyHash = idempotencyHash(userId, toolName, String(roundId));
    const existingCall = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    if (existingCall?.status === 'completed' && existingCall.output) return existingCall.output;
    let call = existingCall;
    if (!call) {
      try {
        call = await this.prisma.agentToolCall.create({
          data: { runId: artifact.runId, userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash, input: { artifactId, roundId } }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        call = await this.prisma.agentToolCall.findFirst({ where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash } });
      }
    }
    if (!call) throw new ConflictException('Unable to reserve Agent task settlement.');
    const claimed = await this.prisma.agentToolCall.updateMany({ where: { id: call.id, status: { in: ['pending', 'failed'] } }, data: { status: 'running', errorCode: null, completedAt: null } });
    if (claimed.count !== 1) throw new ConflictException({ code: 'AGENT_TASK_SETTLEMENT_IN_PROGRESS', message: '任务正在结算，请稍后重试。' });

    const artifactSnapshot = objectValue(artifact.snapshot);
    const artifactTask = artifactSnapshot.task && typeof artifactSnapshot.task === 'object' && !Array.isArray(artifactSnapshot.task)
      ? artifactSnapshot.task as Record<string, unknown>
      : {};
    const isFreePractice = artifact.type === 'learning_task' && artifactTask.type === 'free_practice' && artifactSnapshot.source === 'student_initiated';
    const freePractice = isFreePractice ? {
      journeyId: typeof artifactSnapshot.freePracticeJourneyId === 'string' ? artifactSnapshot.freePracticeJourneyId : artifact.id,
      batchIndex: positiveInteger(artifactSnapshot.batchIndex) ?? 1,
      subject: round.session.subject,
      questionCount: round.items.length,
      canContinue: artifactSnapshot.journeyStatus !== 'ended'
    } : undefined;
    const output = {
      schemaVersion: '1', artifactId, roundId, decision,
      verification: planner.mode === 'verification',
      targetCorrectCount: targetCorrect,
      targetTotal: targetItems.length,
      targetAccuracy: Math.round(targetAccuracy * 100),
      ...(freePractice ? { freePractice } : {})
    };
    await this.prisma.$transaction(async (tx) => {
      const prior = accepted ? await tx.learningPrescriptionOutcome.findFirst({
        where: { prescriptionId: accepted.prescriptionId, userId, domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId), decision: { in: TERMINAL_DECISIONS } }
      }) : null;
      if (accepted && !prior) {
        await tx.learningPrescriptionOutcome.create({
          data: {
            prescriptionId: accepted.prescriptionId, userId, decision, taskIndex: accepted.taskIndex,
            domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId),
            metadata: { acceptedOutcomeId: accepted.id, ...output }
          }
        });
      }
      await tx.agentArtifact.update({
        where: { id: artifact.id },
        data: {
          status: decision,
          ...(isFreePractice ? { snapshot: { ...artifactSnapshot, settlement: output } as Prisma.InputJsonValue } : {})
        }
      });
      await tx.agentToolCall.update({ where: { id: call!.id }, data: { status: 'completed', output, completedAt: new Date(), errorCode: null } });
      if (isFreePractice) {
        await tx.agentMessage.create({ data: {
          conversationId: artifact.conversationId,
          role: 'assistant',
          runId: artifact.runId,
          clientMessageId: `assistant:free-practice-settled:${artifact.id}`,
          content: {
            schemaVersion: '1',
            text: `第 ${freePractice!.batchIndex} 批自由练习已完成：答对 ${targetCorrect}/${targetItems.length} 题，正确率 ${Math.round(targetAccuracy * 100)}%。你可以继续同样设置、调整科目或题量，也可以结束本次学习。`,
            artifactIds: [artifact.id],
            source: 'student_initiated',
            freePractice
          }
        } });
        await tx.agentConversation.update({ where: { id: artifact.conversationId }, data: { lastMessageAt: new Date() } });
      }
      await this.events.append(tx, {
        runId: artifact.runId, conversationId: artifact.conversationId,
        eventKey: `practice:${artifact.id}:settled`, eventType: 'practice.settled', data: output
      });
    });
    return output;
  }

  async settleMockExam(userId: number, attemptIdValue: string) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 模考结算能力暂未开放。' });
    }
    const attemptId = positiveInteger(attemptIdValue);
    if (!attemptId) throw new BadRequestException('模考记录无效。');
    const accepted = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { userId, decision: 'accepted', domainEntityType: 'mock_exam_attempt', domainEntityId: String(attemptId) },
      orderBy: { createdAt: 'desc' }
    });
    const acceptedMetadata = objectValue(accepted?.metadata ?? null);
    const artifactId = String(acceptedMetadata.artifactId ?? '');
    const artifact = artifactId ? await this.prisma.agentArtifact.findFirst({ where: { id: artifactId, userId, type: 'learning_plan' } }) : null;
    if (!accepted || !artifact) throw new NotFoundException('该模考不是当前用户的 Agent 学习任务。');
    const attempt = await this.prisma.mockExamAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { paper: { select: { subject: true, slug: true, title: true } } }
    });
    if (!attempt) throw new NotFoundException('模考记录不存在。');
    if (!attempt.submittedAt) throw new ConflictException({ code: 'AGENT_MOCK_EXAM_NOT_SUBMITTED', message: '请先完成并提交模考。' });

    const toolName = 'settle_mock_exam';
    const keyHash = idempotencyHash(userId, toolName, String(attemptId));
    const existingCall = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    if (existingCall?.status === 'completed' && existingCall.output) {
      const storedOutput = objectValue(existingCall.output);
      if (storedOutput.learningReview) return existingCall.output;
      const legacyBase = {
        schemaVersion: '1', artifactId, attemptId, decision: 'completed',
        subject: attempt.paper.subject, paperSlug: attempt.paper.slug, paperTitle: attempt.paper.title,
        score: attempt.score ?? 0, correctCount: attempt.correctCount ?? 0,
        wrongCount: attempt.wrongCount ?? 0, unansweredCount: attempt.unansweredCount ?? 0,
        submittedAt: attempt.submittedAt.toISOString()
      };
      const upgradedOutput = {
        ...legacyBase,
        learningReview: await this.buildMockExamLearningReview(userId, attemptId, attempt.paper.subject, legacyBase)
      };
      await this.prisma.agentToolCall.update({ where: { id: existingCall.id }, data: { output: upgradedOutput } });
      return upgradedOutput;
    }
    let call = existingCall;
    if (!call) {
      try {
        call = await this.prisma.agentToolCall.create({
          data: { runId: artifact.runId, userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash, input: { artifactId, attemptId } }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        call = await this.prisma.agentToolCall.findFirst({ where: { userId, toolName, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash } });
      }
    }
    if (!call) throw new ConflictException('Unable to reserve Agent mock exam settlement.');
    const claimed = await this.prisma.agentToolCall.updateMany({
      where: { id: call.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'running', errorCode: null, completedAt: null }
    });
    if (claimed.count !== 1) throw new ConflictException({ code: 'AGENT_TASK_SETTLEMENT_IN_PROGRESS', message: '模考正在结算，请稍后重试。' });

    const baseOutput = {
      schemaVersion: '1', artifactId, attemptId, decision: 'completed',
      subject: attempt.paper.subject, paperSlug: attempt.paper.slug, paperTitle: attempt.paper.title,
      score: attempt.score ?? 0, correctCount: attempt.correctCount ?? 0,
      wrongCount: attempt.wrongCount ?? 0, unansweredCount: attempt.unansweredCount ?? 0,
      submittedAt: attempt.submittedAt.toISOString()
    };
    const learningReview = await this.buildMockExamLearningReview(userId, attemptId, attempt.paper.subject, baseOutput);
    const output = { ...baseOutput, learningReview };
    await this.prisma.$transaction(async (tx) => {
      const prior = await tx.learningPrescriptionOutcome.findFirst({
        where: { prescriptionId: accepted.prescriptionId, userId, domainEntityType: 'mock_exam_attempt', domainEntityId: String(attemptId), decision: 'completed' }
      });
      if (!prior) {
        await tx.learningPrescriptionOutcome.create({
          data: {
            prescriptionId: accepted.prescriptionId, userId, decision: 'completed', taskIndex: accepted.taskIndex,
            domainEntityType: 'mock_exam_attempt', domainEntityId: String(attemptId),
            metadata: { acceptedOutcomeId: accepted.id, ...output }
          }
        });
      }
      await tx.agentArtifact.update({ where: { id: artifact.id }, data: { status: 'completed' } });
      await tx.agentToolCall.update({ where: { id: call!.id }, data: { status: 'completed', output, completedAt: new Date(), errorCode: null } });
      await this.events.append(tx, {
        runId: artifact.runId, conversationId: artifact.conversationId,
        eventKey: `mock-exam:${artifact.id}:settled`, eventType: 'mock_exam.settled', data: output
      });
    });
    return output;
  }

  private async buildMockExamLearningReview(
    userId: number,
    attemptId: number,
    subject: string,
    result: { score: number; correctCount: number; wrongCount: number; unansweredCount: number }
  ) {
    const evidenceCount = await this.prisma.learningEvidenceEvent?.count({
      where: { userId, sourceType: 'mock_exam', sourceId: String(attemptId), retraction: { is: null } }
    }).catch(() => 0) ?? 0;
    let focusTopics: Array<{ title: string; attemptedCount: number; incorrectCount: number; accuracy: number }> = [];
    try {
      const report = await this.mockExam.getReport(String(attemptId), userId, 'zh');
      focusTopics = (report.knowledgeStats ?? [])
        .map((item) => ({
          title: String(item.tag),
          attemptedCount: Number(item.total) || 0,
          incorrectCount: Number(item.wrong) || 0,
          accuracy: item.total ? Math.round(((item.total - item.wrong) / item.total) * 100) : 0
        }))
        .sort((left, right) => right.incorrectCount - left.incorrectCount || left.accuracy - right.accuracy || left.title.localeCompare(right.title))
        .slice(0, 5);
    } catch {
      // The submitted result remains authoritative even if the optional localized report cannot be rebuilt.
    }

    await this.projector?.processPending(200).catch(() => undefined);
    try {
      const computed = await this.decisions?.recompute(userId);
      const prescription = computed?.prescription ?? null;
      const primaryTask = prescription?.tasks.slice().sort((left, right) => left.priority - right.priority)[0] ?? null;
      const subjectGaps = computed?.gap.gaps
        .filter((item) => item.subject === subject)
        .sort((left, right) => right.severity - left.severity)
        .slice(0, 5) ?? [];
      return {
        status: computed ? 'ready' : 'goal_unset',
        evidence: { sourceType: 'mock_exam', sourceId: String(attemptId), acceptedCount: evidenceCount },
        result,
        focusTopics,
        targetGap: computed ? {
          gapSnapshotId: computed.gap.gapSnapshotId,
          goalId: computed.gap.goalId,
          totalGapCount: computed.gap.gaps.length,
          subjectGapCount: computed.gap.gaps.filter((item) => item.subject === subject).length,
          priorityGapCount: computed.gap.gaps.filter((item) => item.severity >= 0.65).length,
          topSubjectGaps: subjectGaps.map((item) => ({
            type: item.type,
            severity: item.severity,
            confidence: item.confidence,
            topicIds: item.topicIds,
            recommendedAction: item.recommendedAction,
            reasonCodes: item.reasonCodes
          }))
        } : null,
        nextDecision: prescription ? {
          prescriptionId: prescription.prescriptionId,
          reasonSummary: prescription.reasonSummary,
          confidence: prescription.confidence,
          estimatedMinutes: prescription.estimatedMinutes,
          primaryTask
        } : null,
        provenance: {
          resultSource: 'submitted_mock_exam',
          nextTaskSource: prescription ? 'learning_prescription' : null,
          automaticQuestionGenerationInvoked: false
        }
      };
    } catch (error) {
      const updating = error instanceof Error && error.message === 'LEARNING_DECISION_STATE_UPDATING';
      return {
        status: updating ? 'updating' : 'unavailable',
        evidence: { sourceType: 'mock_exam', sourceId: String(attemptId), acceptedCount: evidenceCount },
        result,
        focusTopics,
        targetGap: null,
        nextDecision: null,
        provenance: {
          resultSource: 'submitted_mock_exam',
          nextTaskSource: null,
          automaticQuestionGenerationInvoked: false
        }
      };
    }
  }

  async abandon(userId: number, artifactId: string, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_PRACTICE_WRITE_DISABLED', message: 'Agent 任务操作暂未开放。' });
    }
    const input = AgentTaskActionInputSchema.parse(body);
    const artifact = await this.prisma.agentArtifact.findFirst({ where: { id: artifactId, userId, type: 'learning_plan' } });
    if (!artifact) throw new NotFoundException('学习方案不存在。');
    if (TERMINAL_DECISIONS.includes(artifact.status)) {
      return { schemaVersion: '1', artifactId: artifact.id, decision: artifact.status };
    }
    const snapshot = objectValue(artifact.snapshot);
    const launch = snapshot.launch && typeof snapshot.launch === 'object' && !Array.isArray(snapshot.launch)
      ? snapshot.launch as Record<string, unknown>
      : {};
    const roundId = positiveInteger(launch.roundId);
    if (roundId) {
      const round = await this.prisma.cscaAdaptiveRound.findFirst({ where: { id: roundId, session: { userId } }, select: { submittedAt: true } });
      if (round?.submittedAt) return this.settle(userId, String(roundId));
    }
    return this.recordTerminalOutcome(userId, artifact, snapshot, 'abandoned', roundId ? String(roundId) : null, { clientRequestId: input.clientRequestId });
  }

  private async recordTerminalOutcome(
    userId: number,
    artifact: { id: string; runId: string; conversationId: string; domainEntityId: string | null },
    snapshot: PlanSnapshot,
    decision: 'abandoned' | 'superseded',
    domainEntityId: string | null,
    metadata: Record<string, unknown>
  ) {
    const prescriptionId = String(snapshot.prescriptionId ?? artifact.domainEntityId ?? '');
    if (!prescriptionId) return { decision };
    const domainType = domainEntityId ? 'csca_adaptive_round' : 'agent_artifact';
    const entityId = domainEntityId ?? artifact.id;
    const existing = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { prescriptionId, userId, decision, domainEntityType: domainType, domainEntityId: entityId }
    });
    if (!existing) {
      await this.prisma.learningPrescriptionOutcome.create({
        data: { prescriptionId, userId, decision, taskIndex: 0, domainEntityType: domainType, domainEntityId: entityId, metadata: { artifactId: artifact.id, ...metadata } }
      });
    }
    await this.prisma.agentArtifact.update({ where: { id: artifact.id }, data: { status: decision } });
    return { schemaVersion: '1', artifactId: artifact.id, decision };
  }
}
