import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayErrorCode, AiGatewayLedgerEntry, AiGatewayProviderHardStopState } from './ai-gateway.types';
import { AiGatewayConfigService } from './ai-gateway-config.service';

type AiGatewayCallLogRecord = {
  id?: number;
  createdAt: Date;
  taskType?: string | null;
  sourceModule?: string | null;
  errorCode?: AiGatewayErrorCode | string | null;
  errorMessage?: string | null;
  metadata?: unknown;
};

type AiGatewayCallLogClient = {
  create(input: { data: Record<string, unknown> }): Promise<unknown>;
  findFirst(input: Record<string, unknown>): Promise<AiGatewayCallLogRecord | null>;
};

function readMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return value === undefined || value === null ? undefined : String(value);
}

@Injectable()
export class AiGatewayLedgerService {
  private readonly logger = new Logger(AiGatewayLedgerService.name);

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: AiGatewayConfigService
  ) {}

  async record(entry: AiGatewayLedgerEntry) {
    if (this.config && !this.config.ledgerEnabled()) return;
    const data = {
      requestId: entry.requestId,
      taskType: entry.taskType,
      sourceModule: entry.sourceModule,
      providerId: entry.providerId,
      model: entry.model,
      keyId: entry.keyId,
      userId: entry.userId ?? null,
      organizationId: entry.organizationId ?? null,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      latencyMs: entry.latencyMs,
      promptTokens: entry.promptTokens ?? null,
      completionTokens: entry.completionTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      estimatedCost: entry.estimatedCost ?? null,
      metadata: entry.metadata ?? undefined,
      createdAt: entry.createdAt
    };
    const client = this.prisma as unknown as { aiGatewayCallLog?: AiGatewayCallLogClient } | undefined;
    if (client?.aiGatewayCallLog) {
      try {
        await client.aiGatewayCallLog.create({ data });
        return;
      } catch (error) {
        this.logger.warn(`Failed to write ai_gateway_call_logs entry: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.logger.log(JSON.stringify({ event: 'ai_gateway_ledger', ...data }));
  }

  async providerHardStopState(input: {
    providerId?: string;
    windowMs?: number;
    taskTypes?: string[];
  } = {}): Promise<AiGatewayProviderHardStopState> {
    const providerId = input.providerId || 'deepseek';
    if (this.config && !this.config.ledgerEnabled()) return { active: false, providerId };
    const client = this.prisma as unknown as { aiGatewayCallLog?: AiGatewayCallLogClient } | undefined;
    if (!client?.aiGatewayCallLog) return { active: false, providerId };

    const windowMs = Math.max(60_000, input.windowMs ?? 24 * 60 * 60 * 1000);
    const since = new Date(Date.now() - windowMs);
    const taskTypeFilter = input.taskTypes?.length ? { taskType: { in: input.taskTypes } } : {};
    try {
      const latestHardStop = await client.aiGatewayCallLog.findFirst({
        where: {
          providerId,
          createdAt: { gte: since },
          ...taskTypeFilter,
          OR: [
            { errorCode: { in: ['provider_auth_error', 'provider_quota_exceeded', 'gateway_key_disabled'] } },
            {
              errorCode: 'provider_bad_request',
              errorMessage: { contains: 'insufficient balance', mode: 'insensitive' }
            }
          ]
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          createdAt: true,
          taskType: true,
          sourceModule: true,
          errorCode: true,
          errorMessage: true,
          metadata: true
        }
      });
      if (!latestHardStop) return { active: false, providerId };

      const latestRecoverySuccess = await client.aiGatewayCallLog.findFirst({
        where: {
          providerId,
          createdAt: { gt: latestHardStop.createdAt },
          ...taskTypeFilter,
          status: 'success'
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, createdAt: true }
      });

      const metadata = latestHardStop.metadata;
      return {
        active: !latestRecoverySuccess,
        providerId,
        latestHardStopAt: latestHardStop.createdAt,
        latestRecoverySuccessAt: latestRecoverySuccess?.createdAt,
        errorCode: latestHardStop.errorCode as AiGatewayErrorCode | undefined,
        errorMessage: latestHardStop.errorMessage ?? undefined,
        sourceModule: latestHardStop.sourceModule ?? undefined,
        taskType: latestHardStop.taskType ?? undefined,
        subject: readMetadataString(metadata, 'subject'),
        topicId: readMetadataString(metadata, 'topicId'),
        blueprintId: readMetadataString(metadata, 'blueprintId')
      };
    } catch (error) {
      this.logger.warn(`Failed to read AI provider hard-stop state: ${error instanceof Error ? error.message : String(error)}`);
      return { active: false, providerId };
    }
  }
}
