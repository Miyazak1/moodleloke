import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayCostService } from './ai-gateway-cost.service';

type AiGatewayMonitorQuery = {
  days?: string;
  from?: string;
  to?: string;
  limit?: string;
};

type AiGatewayMetricRow = Record<string, unknown>;

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

function toStringOrNull(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseDate(value: string | undefined, label: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} must be a valid ISO date.`);
  }
  return parsed;
}

function parseRange(query: AiGatewayMonitorQuery) {
  const explicitFrom = parseDate(query.from, 'from');
  const explicitTo = parseDate(query.to, 'to');
  const now = new Date();
  const days = clampInt(query.days, 7, 1, 90);
  const to = explicitTo ?? now;
  const from = explicitFrom ?? new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  if (from >= to) {
    throw new BadRequestException('from must be earlier than to.');
  }
  return { from, to, days };
}

function successRate(successCalls: number, calls: number) {
  if (!calls) return 0;
  return Math.round((successCalls / calls) * 10000) / 10000;
}

function mapCost(costService: AiGatewayCostService, estimatedCostUsd: number) {
  return {
    estimatedCostUsd,
    estimatedCostDisplay: costService.convertUsdToDisplay(estimatedCostUsd),
    ...costService.metadata()
  };
}

@Injectable()
export class AiGatewayMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costService: AiGatewayCostService
  ) {}

  async summary(query: AiGatewayMonitorQuery = {}) {
    const range = parseRange(query);
    const rows = await this.prisma.$queryRaw<AiGatewayMetricRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "calls",
        COUNT(*) FILTER (WHERE status = 'success')::int AS "successCalls",
        COALESCE(SUM(prompt_tokens), 0)::bigint AS "promptTokens",
        COALESCE(SUM(completion_tokens), 0)::bigint AS "completionTokens",
        COALESCE(SUM(total_tokens), 0)::bigint AS "totalTokens",
        COALESCE(ROUND(AVG(latency_ms)), 0)::int AS "averageLatencyMs",
        COALESCE(SUM(estimated_cost), 0) AS "estimatedCostUsd"
      FROM ai_gateway_call_logs
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
    `);
    const row = rows[0] ?? {};
    const calls = toNumber(row.calls);
    const successCalls = toNumber(row.successCalls);
    const estimatedCostUsd = toNumber(row.estimatedCostUsd);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      summary: {
        calls,
        successCalls,
        failedCalls: Math.max(0, calls - successCalls),
        successRate: successRate(successCalls, calls),
        promptTokens: toNumber(row.promptTokens),
        completionTokens: toNumber(row.completionTokens),
        totalTokens: toNumber(row.totalTokens),
        averageLatencyMs: toNumber(row.averageLatencyMs),
        ...mapCost(this.costService, estimatedCostUsd)
      }
    };
  }

  async byTask(query: AiGatewayMonitorQuery = {}) {
    const range = parseRange(query);
    const rows = await this.prisma.$queryRaw<AiGatewayMetricRow[]>(Prisma.sql`
      SELECT
        task_type AS "taskType",
        source_module AS "sourceModule",
        provider_id AS "providerId",
        model,
        COUNT(*)::int AS "calls",
        COUNT(*) FILTER (WHERE status = 'success')::int AS "successCalls",
        COALESCE(SUM(total_tokens), 0)::bigint AS "totalTokens",
        COALESCE(ROUND(AVG(latency_ms)), 0)::int AS "averageLatencyMs",
        COALESCE(SUM(estimated_cost), 0) AS "estimatedCostUsd"
      FROM ai_gateway_call_logs
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY task_type, source_module, provider_id, model
      ORDER BY "calls" DESC, "estimatedCostUsd" DESC
    `);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      items: rows.map((row) => {
        const calls = toNumber(row.calls);
        const successCalls = toNumber(row.successCalls);
        const estimatedCostUsd = toNumber(row.estimatedCostUsd);
        return {
          taskType: toStringOrNull(row.taskType),
          sourceModule: toStringOrNull(row.sourceModule),
          providerId: toStringOrNull(row.providerId),
          model: toStringOrNull(row.model),
          calls,
          successCalls,
          failedCalls: Math.max(0, calls - successCalls),
          successRate: successRate(successCalls, calls),
          totalTokens: toNumber(row.totalTokens),
          averageLatencyMs: toNumber(row.averageLatencyMs),
          estimatedCostUsd,
          estimatedCostDisplay: this.costService.convertUsdToDisplay(estimatedCostUsd)
        };
      }),
      cost: this.costService.metadata()
    };
  }

  async byKey(query: AiGatewayMonitorQuery = {}) {
    const range = parseRange(query);
    const rows = await this.prisma.$queryRaw<AiGatewayMetricRow[]>(Prisma.sql`
      WITH grouped AS (
        SELECT
          provider_id AS "providerId",
          key_id AS "keyId",
          COUNT(*)::int AS "calls",
          COUNT(*) FILTER (WHERE status = 'success')::int AS "successCalls",
          COALESCE(SUM(total_tokens), 0)::bigint AS "totalTokens",
          COALESCE(ROUND(AVG(latency_ms)), 0)::int AS "averageLatencyMs",
          COALESCE(SUM(estimated_cost), 0) AS "estimatedCostUsd"
        FROM ai_gateway_call_logs
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY provider_id, key_id
      ),
      latest_error AS (
        SELECT DISTINCT ON (provider_id, key_id)
          provider_id AS "providerId",
          key_id AS "keyId",
          error_code AS "latestErrorCode",
          created_at AS "latestErrorAt"
        FROM ai_gateway_call_logs
        WHERE created_at >= ${range.from}
          AND created_at < ${range.to}
          AND status <> 'success'
        ORDER BY provider_id, key_id, created_at DESC
      )
      SELECT
        grouped.*,
        latest_error."latestErrorCode",
        latest_error."latestErrorAt"
      FROM grouped
      LEFT JOIN latest_error
        ON latest_error."providerId" = grouped."providerId"
        AND latest_error."keyId" = grouped."keyId"
      ORDER BY grouped."calls" DESC, grouped."estimatedCostUsd" DESC
    `);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      items: rows.map((row) => {
        const calls = toNumber(row.calls);
        const successCalls = toNumber(row.successCalls);
        const estimatedCostUsd = toNumber(row.estimatedCostUsd);
        return {
          providerId: toStringOrNull(row.providerId),
          keyId: toStringOrNull(row.keyId),
          calls,
          successCalls,
          failedCalls: Math.max(0, calls - successCalls),
          successRate: successRate(successCalls, calls),
          totalTokens: toNumber(row.totalTokens),
          averageLatencyMs: toNumber(row.averageLatencyMs),
          estimatedCostUsd,
          estimatedCostDisplay: this.costService.convertUsdToDisplay(estimatedCostUsd),
          latestErrorCode: toStringOrNull(row.latestErrorCode),
          latestErrorAt: row.latestErrorAt instanceof Date ? row.latestErrorAt.toISOString() : null
        };
      }),
      cost: this.costService.metadata()
    };
  }

  async errors(query: AiGatewayMonitorQuery = {}) {
    const range = parseRange(query);
    const limit = clampInt(query.limit, 50, 1, 200);
    const rows = await this.prisma.$queryRaw<AiGatewayMetricRow[]>(Prisma.sql`
      SELECT
        id,
        request_id AS "requestId",
        task_type AS "taskType",
        source_module AS "sourceModule",
        provider_id AS "providerId",
        model,
        key_id AS "keyId",
        status,
        error_code AS "errorCode",
        error_message AS "errorMessage",
        latency_ms AS "latencyMs",
        created_at AS "createdAt"
      FROM ai_gateway_call_logs
      WHERE created_at >= ${range.from}
        AND created_at < ${range.to}
        AND status <> 'success'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      items: rows.map((row) => ({
        id: toNumber(row.id),
        requestId: toStringOrNull(row.requestId),
        taskType: toStringOrNull(row.taskType),
        sourceModule: toStringOrNull(row.sourceModule),
        providerId: toStringOrNull(row.providerId),
        model: toStringOrNull(row.model),
        keyId: toStringOrNull(row.keyId),
        status: toStringOrNull(row.status),
        errorCode: toStringOrNull(row.errorCode),
        errorMessage: toStringOrNull(row.errorMessage),
        latencyMs: toNumber(row.latencyMs),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : null
      }))
    };
  }
}
