import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LearningCapabilityRegistryService } from '../learning-intelligence/capabilities/learning-capability-registry.service';
import type {
  LearningCapabilityResponse,
  LearningReadCapabilityName
} from '../learning-intelligence/capabilities/learning-read-capability.contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AgentEventService } from './agent-event.service';

const AGENT_READ_ALLOWLIST = new Set<LearningReadCapabilityName>([
  'get_learning_profile',
  'get_score_goal',
  'get_target_gap',
  'get_learning_prescription',
  'get_score_readiness',
  'get_review_queue',
  'get_subject_mastery',
  'list_mock_exam_attempts',
  'search_past_papers',
  'get_question_supply_status',
  'get_intervention_stability'
]);

export type AgentToolContext = {
  runId: string;
  conversationId: string;
  userId: number;
  traceId: string;
  locale: 'zh-CN' | 'en';
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class AgentToolExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: LearningCapabilityRegistryService,
    private readonly events: AgentEventService
  ) {}

  listAllowedTools(): readonly LearningReadCapabilityName[] {
    return [...AGENT_READ_ALLOWLIST];
  }

  async execute(
    context: AgentToolContext,
    tool: LearningReadCapabilityName,
    input: Record<string, unknown> = {}
  ): Promise<LearningCapabilityResponse> {
    if (!AGENT_READ_ALLOWLIST.has(tool)) throw new Error('AGENT_TOOL_NOT_ALLOWED');
    const definition = this.registry.getDefinition(tool);
    if (!definition || !definition.channels.includes('web_agent')) throw new Error('AGENT_TOOL_NOT_AVAILABLE');
    const idempotencyKeyHash = createHash('sha256')
      .update(canonicalJson({ runId: context.runId, tool, version: definition.version, input }))
      .digest('hex');

    let call = await this.prisma.agentToolCall.findFirst({
      where: { userId: context.userId, toolName: tool, toolVersion: definition.version, idempotencyKeyHash }
    });
    if (call?.status === 'completed' && call.output) return call.output as unknown as LearningCapabilityResponse;

    if (!call) {
      call = await this.prisma.agentToolCall.create({
        data: {
          runId: context.runId,
          userId: context.userId,
          toolName: tool,
          toolVersion: definition.version,
          idempotencyKeyHash,
          input: input as Prisma.InputJsonValue
        }
      });
    }

    await this.prisma.$transaction((tx) => this.events.append(tx, {
      runId: context.runId,
      conversationId: context.conversationId,
      eventKey: `tool:${tool}:started`,
      eventType: 'tool.started',
      data: { tool, toolVersion: definition.version }
    }));

    const response = await this.registry.invoke(tool, {
      requestId: `${context.runId}:${tool}`.slice(0, 120),
      traceId: context.traceId,
      actorUserId: context.userId,
      channel: 'web_agent',
      locale: context.locale,
      grantedScopes: [definition.scope]
    }, input);

    await this.prisma.$transaction(async (tx) => {
      await tx.agentToolCall.update({
        where: { id: call!.id },
        data: response.ok
          ? { status: 'completed', output: response as unknown as Prisma.InputJsonValue, completedAt: new Date(), errorCode: null }
          : { status: 'failed', output: response as unknown as Prisma.InputJsonValue, completedAt: new Date(), errorCode: response.error.code }
      });
      await this.events.append(tx, {
        runId: context.runId,
        conversationId: context.conversationId,
        eventKey: `tool:${tool}:${response.ok ? 'completed' : 'failed'}`,
        eventType: response.ok ? 'tool.completed' : 'tool.failed',
        data: response.ok
          ? { tool, toolVersion: definition.version }
          : { tool, toolVersion: definition.version, errorCode: response.error.code, retryable: response.error.retryable }
      });
    });
    return response;
  }
}
