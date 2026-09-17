import { createHash } from 'node:crypto';
import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AICoachService } from '../csca-special-practice/ai-coach.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { LearningAssistanceAction, ReportLearningContentIssueInputSchema, RequestLearningAssistanceInputSchema } from './agent.types';
import { AgentPracticeQuestionContextService } from './agent-practice-question-context.service';

const TOOL_NAME = 'request_learning_assistance';
const REPORT_TOOL_NAME = 'report_learning_content_issue';
const TOOL_VERSION = '1.0';
const POLICY_VERSION = 'learning-assistance-v1';

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function idempotencyHash(userId: number, toolName: string, key: string): string {
  return createHash('sha256').update(`${userId}:${toolName}:${TOOL_VERSION}:${key}`).digest('hex');
}

@Injectable()
export class AgentLearningAssistanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coach: AICoachService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly questionContext: AgentPracticeQuestionContextService
  ) {}

  async availability(userId: number, roundIdValue: string, questionIdValue: string) {
    const context = await this.context(userId, roundIdValue, questionIdValue);
    const [history, entitlement] = await Promise.all([
      this.history(context),
      this.coach.entitlementSummary(userId).catch(() => null)
    ]);
    return {
      ...this.buildAvailability(context),
      history,
      billing: entitlement ? {
        enabled: entitlement.enabled,
        unlimited: entitlement.unlimited,
        balanceUnits: entitlement.balanceUnits,
        aiActionMayConsumeCredits: true
      } : null
    };
  }

  async request(userId: number, roundIdValue: string, questionIdValue: string, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_LEARNING_ASSISTANCE_DISABLED', message: 'Agent 学习辅助能力暂未开放。' });
    }
    const input = RequestLearningAssistanceInputSchema.parse(body);
    const context = await this.context(userId, roundIdValue, questionIdValue);
    const availability = this.buildAvailability(context);
    const action = availability.availableActions.find((item) => item.action === input.action);
    const keyHash = idempotencyHash(userId, TOOL_NAME, input.clientRequestId);
    let call = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName: TOOL_NAME, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    const priorInput = objectValue(call?.input);
    if (call && (
      String(priorInput.roundId) !== String(context.roundId)
      || String(priorInput.questionId) !== String(context.questionId)
      || String(priorInput.action) !== input.action
    )) {
      throw new ConflictException('clientRequestId was already used for another learning assistance request.');
    }
    if (call?.status === 'completed' && call.output) return call.output;
    if (!action?.enabled) {
      throw new ConflictException({ code: action?.reasonCode ?? 'ASSISTANCE_ACTION_UNAVAILABLE', message: '当前学习状态不允许使用这项辅助。' });
    }
    if (!call) {
      try {
        call = await this.prisma.agentToolCall.create({
          data: {
            runId: context.artifact.runId,
            userId,
            toolName: TOOL_NAME,
            toolVersion: TOOL_VERSION,
            idempotencyKeyHash: keyHash,
            input: { ...input, roundId: context.roundId, questionId: context.questionId, artifactId: context.artifact.id }
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        call = await this.prisma.agentToolCall.findFirst({
          where: { userId, toolName: TOOL_NAME, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
        });
      }
    }
    if (!call) throw new ConflictException('Unable to reserve learning assistance action.');
    const claimed = await this.prisma.agentToolCall.updateMany({
      where: { id: call.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'running', errorCode: null, completedAt: null }
    });
    if (claimed.count !== 1) {
      const latest = await this.prisma.agentToolCall.findUnique({ where: { id: call.id } });
      if (latest?.status === 'completed' && latest.output) return latest.output;
      throw new ConflictException({ code: 'LEARNING_ASSISTANCE_IN_PROGRESS', message: '这项辅助正在生成，请稍后重试。' });
    }

    try {
      const generated = await this.generate(userId, input.action, input, context);
      const exposure = {
        action: input.action,
        level: action.level,
        recordedAt: new Date().toISOString()
      };
      const output = {
        ...this.buildAvailability({
          ...context,
          item: {
            ...context.item,
            usedHint: context.item.usedHint || input.action === 'next_step_hint',
            usedExplanation: context.item.usedExplanation || input.action === 'show_full_solution'
          }
        }),
        requestId: input.clientRequestId,
        toolCallId: call.id,
        action: input.action,
        level: action.level,
        content: generated.content,
        generatedByAI: generated.generatedByAI,
        interaction: generated.interaction,
        exposure
      };
      await this.prisma.$transaction(async (tx) => {
        if (input.action === 'show_full_solution') {
          await tx.cscaAdaptiveRoundItem.update({ where: { id: context.item.id }, data: { usedExplanation: true } });
        }
        await tx.cscaTrainingEvent.create({
          data: {
            userId,
            subject: context.subject,
            sessionId: context.sessionId,
            roundId: context.roundId,
            questionId: context.questionId,
            eventType: 'learning_assistance_exposed',
            source: 'agent',
            metadata: { toolCallId: call.id, artifactId: context.artifact.id, action: input.action, level: action.level, policyVersion: POLICY_VERSION }
          }
        });
        await tx.agentToolCall.update({ where: { id: call!.id }, data: { status: 'completed', output, completedAt: new Date(), errorCode: null } });
      });
      return output;
    } catch (error) {
      await this.prisma.agentToolCall.updateMany({
        where: { id: call.id, status: { not: 'completed' } },
        data: { status: 'failed', errorCode: error instanceof Error ? error.name.slice(0, 80) : 'LEARNING_ASSISTANCE_FAILED', completedAt: new Date() }
      });
      throw error;
    }
  }

  async report(userId: number, roundIdValue: string, questionIdValue: string, body: unknown) {
    if (!this.flags.isWebEnabled() || !this.flags.isPracticeWriteEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_LEARNING_ASSISTANCE_DISABLED', message: 'Agent 学习辅助能力暂未开放。' });
    }
    const input = ReportLearningContentIssueInputSchema.parse(body);
    const context = await this.context(userId, roundIdValue, questionIdValue);
    const keyHash = idempotencyHash(userId, REPORT_TOOL_NAME, input.clientRequestId);
    let call = await this.prisma.agentToolCall.findFirst({
      where: { userId, toolName: REPORT_TOOL_NAME, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
    });
    if (!call) {
      try {
        call = await this.prisma.agentToolCall.create({
          data: {
            runId: context.artifact.runId, userId, toolName: REPORT_TOOL_NAME, toolVersion: TOOL_VERSION,
            idempotencyKeyHash: keyHash,
            input: { ...input, roundId: context.roundId, questionId: context.questionId, artifactId: context.artifact.id }
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        call = await this.prisma.agentToolCall.findFirst({
          where: { userId, toolName: REPORT_TOOL_NAME, toolVersion: TOOL_VERSION, idempotencyKeyHash: keyHash }
        });
      }
    }
    if (!call) throw new ConflictException('Unable to reserve content issue report.');
    const priorInput = objectValue(call.input);
    if (
      String(priorInput.roundId) !== String(context.roundId)
      || String(priorInput.questionId) !== String(context.questionId)
      || String(priorInput.reason) !== input.reason
      || String(priorInput.note ?? '') !== String(input.note ?? '')
    ) {
      throw new ConflictException('clientRequestId was already used for another content issue report.');
    }
    if (call.status === 'completed' && call.output) return call.output;
    const claimed = await this.prisma.agentToolCall.updateMany({
      where: { id: call.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'running', errorCode: null, completedAt: null }
    });
    if (claimed.count !== 1) {
      const latest = await this.prisma.agentToolCall.findUnique({ where: { id: call.id } });
      if (latest?.status === 'completed' && latest.output) return latest.output;
      throw new ConflictException({ code: 'CONTENT_ISSUE_REPORT_IN_PROGRESS', message: '问题反馈正在提交。' });
    }
    const output = { schemaVersion: '1' as const, reportId: call.id, status: 'received' as const };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.cscaTrainingEvent.create({
          data: {
            userId, subject: context.subject, sessionId: context.sessionId, roundId: context.roundId,
            questionId: context.questionId, eventType: 'learning_content_issue_reported', source: 'agent',
            metadata: { reportId: call.id, artifactId: context.artifact.id, reason: input.reason, note: input.note ?? null, policyVersion: POLICY_VERSION }
          }
        });
        await tx.agentToolCall.update({ where: { id: call.id }, data: { status: 'completed', output, completedAt: new Date() } });
      });
      return output;
    } catch (error) {
      await this.prisma.agentToolCall.updateMany({
        where: { id: call.id, status: { not: 'completed' } },
        data: { status: 'failed', errorCode: error instanceof Error ? error.name.slice(0, 80) : 'CONTENT_ISSUE_REPORT_FAILED', completedAt: new Date() }
      });
      throw error;
    }
  }

  private async generate(userId: number, action: LearningAssistanceAction, input: { language?: string; questionLanguage?: string }, context: Awaited<ReturnType<AgentLearningAssistanceService['context']>>) {
    if (action === 'next_step_hint') {
      const interaction = await this.coach.hint(userId, {
        roundId: context.roundId,
        questionId: context.questionId,
        language: input.language,
        questionLanguage: input.questionLanguage
      });
      return { content: interaction.output, generatedByAI: interaction.provider !== 'fallback', interaction };
    }
    if (action === 'show_full_solution') {
      return { content: context.question.explanation, generatedByAI: false, interaction: null };
    }
    const tags = Array.isArray(context.question.knowledgeTags) ? context.question.knowledgeTags.map(String).filter(Boolean) : [];
    const topic = String(context.question.topicTitle ?? tags[0] ?? '当前知识点');
    const content = input.language === 'en'
      ? `Recall the definition, conditions, and common boundary cases of “${topic}”. Before calculating, name the exact concept this question is testing.${tags.length ? ` Focus: ${tags.slice(0, 3).join(', ')}.` : ''}`
      : `先回忆“${topic}”的定义、适用条件和常见边界。动笔前，用一句话说清这题具体在考什么。${tags.length ? `重点：${tags.slice(0, 3).join('、')}。` : ''}`;
    return { content, generatedByAI: false, interaction: null };
  }

  private async context(userId: number, roundIdValue: string, questionIdValue: string) {
    return this.questionContext.resolve(userId, roundIdValue, questionIdValue, 'zh');
  }

  private async history(context: Awaited<ReturnType<AgentLearningAssistanceService['context']>>) {
    const calls = await this.prisma.agentToolCall.findMany({
      where: { runId: context.artifact.runId, userId: context.artifact.userId, toolName: TOOL_NAME, status: 'completed' },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    return calls.flatMap((call) => {
      const input = objectValue(call.input);
      const output = objectValue(call.output);
      if (Number(input.roundId) !== context.roundId || Number(input.questionId) !== context.questionId) return [];
      const action = String(output.action);
      if (!['recall_concept', 'next_step_hint', 'show_full_solution'].includes(action) || !String(output.content ?? '').trim()) return [];
      return [{
        toolCallId: call.id,
        action,
        level: String(output.level),
        content: String(output.content),
        generatedByAI: output.generatedByAI === true,
        createdAt: call.completedAt?.toISOString() ?? call.createdAt.toISOString()
      }];
    });
  }

  private buildAvailability(context: Awaited<ReturnType<AgentLearningAssistanceService['context']>>) {
    const planner = objectValue(context.round.plannerSnapshot);
    const independentVerification = planner.mode === 'intervention_verification';
    const answered = Boolean(context.item.selectedAnswer || context.round.submittedAt);
    const closed = Boolean(context.round.submittedAt);
    const actions = [
      { action: 'recall_concept' as const, level: 'A1' as const, enabled: !independentVerification && !closed, reasonCode: independentVerification ? 'INDEPENDENT_VERIFICATION' : closed ? 'ROUND_SUBMITTED' : null, generatedByAI: false, confirmationRequired: false },
      { action: 'next_step_hint' as const, level: 'A2' as const, enabled: !independentVerification && !closed && !answered, reasonCode: independentVerification ? 'INDEPENDENT_VERIFICATION' : closed ? 'ROUND_SUBMITTED' : answered ? 'ANSWER_ALREADY_RECORDED' : null, generatedByAI: true, confirmationRequired: false },
      { action: 'show_full_solution' as const, level: 'A6' as const, enabled: !independentVerification && answered, reasonCode: independentVerification ? 'INDEPENDENT_VERIFICATION' : answered ? null : 'ANSWER_REQUIRED', generatedByAI: false, confirmationRequired: false }
    ];
    const recommendedAction = actions.find((item) => item.action === (answered ? 'show_full_solution' : context.item.usedHint ? 'next_step_hint' : 'recall_concept'))?.enabled
      ? (answered ? 'show_full_solution' : context.item.usedHint ? 'next_step_hint' : 'recall_concept')
      : actions.find((item) => item.enabled)?.action ?? null;
    const contextVersion = createHash('sha256').update(`${context.round.id}:${context.round.version}:${context.item.id}:${context.item.updatedAt.toISOString()}`).digest('hex').slice(0, 16);
    return {
      schemaVersion: '1' as const,
      roundId: context.roundId,
      questionId: context.questionId,
      policyVersion: POLICY_VERSION,
      contextVersion,
      recommendedAction,
      maxAllowedLevel: answered ? 'A6' as const : 'A2' as const,
      exposures: { usedHint: context.item.usedHint, usedExplanation: context.item.usedExplanation },
      availableActions: actions
    };
  }
}
