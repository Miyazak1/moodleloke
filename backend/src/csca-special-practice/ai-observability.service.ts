import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { PrismaService } from '../prisma/prisma.service';

type AIObservabilityQuery = {
  days?: string;
  from?: string;
  to?: string;
  provider?: string;
  status?: string;
  type?: string;
  subject?: string;
};

type InteractionRow = Awaited<ReturnType<PrismaService['cscaAIInteraction']['findMany']>>[number] & {
  feedback: Array<{ rating: number; reasonCode?: string | null }>;
};

type InteractionReviewRow = Awaited<ReturnType<PrismaService['cscaAIInteraction']['findMany']>>[number] & {
  feedback: Array<{ rating: number; reason: string | null; reasonCode?: string | null; createdAt: Date }>;
};

type AIReviewDecisionRow = {
  id: number;
  interactionId: number;
  actorId: number | null;
  decision: string;
  status: string;
  note: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type MetricBucket = {
  key: string;
  interactions: number;
  fallbackInteractions: number;
  externalInteractions: number;
  successfulInteractions: number;
  rejectedInteractions: number;
  errorInteractions: number;
  billableInteractions: number;
  estimatedTokens: number;
  estimatedCost: number;
  feedbackCount: number;
  lowFeedbackCount: number;
  averageRating: number | null;
};

type FeedbackReasonBucket = {
  reasonCode: string;
  count: number;
  lowFeedbackCount: number;
};

type RolloutHealthStatus = 'insufficient_data' | 'healthy' | 'watch' | 'pause_rollout';

function clampDays(value: unknown) {
  const parsed = Number(value ?? 14);
  if (!Number.isInteger(parsed) || parsed <= 0) return 14;
  return Math.min(parsed, 90);
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && isDateOnly) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function dateRange(query: AIObservabilityQuery) {
  const explicitFrom = parseDate(query.from);
  const explicitTo = parseDate(query.to, true);
  const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
  if (explicitFrom || explicitTo) {
    const end = explicitTo ?? new Date();
    const requestedStart = explicitFrom ?? new Date(end.getTime() - clampDays(query.days) * 24 * 60 * 60 * 1000);
    const start = end.getTime() - requestedStart.getTime() > maxRangeMs ? new Date(end.getTime() - maxRangeMs) : requestedStart;
    return { start, end };
  }
  const end = new Date();
  const start = new Date(end.getTime() - clampDays(query.days) * 24 * 60 * 60 * 1000);
  return { start, end };
}

function stringFilter(value: string | undefined) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function cleanNote(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 500) : null;
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readRate(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function aiSafetyThresholds() {
  return {
    minInteractions: readPositiveInt('CSCA_AI_ROLLOUT_MIN_INTERACTIONS', 20),
    minFeedback: readPositiveInt('CSCA_AI_ROLLOUT_MIN_FEEDBACK', 5),
    maxErrorRate: readRate('CSCA_AI_ROLLOUT_MAX_ERROR_RATE', 0.05),
    maxRejectionRate: readRate('CSCA_AI_ROLLOUT_MAX_REJECTION_RATE', 0.02),
    maxLowFeedbackRate: readRate('CSCA_AI_ROLLOUT_MAX_LOW_FEEDBACK_RATE', 0.2),
    minAverageRating: Math.max(1, Math.min(5, Number(process.env.CSCA_AI_ROLLOUT_MIN_AVERAGE_RATING ?? 3.5)))
  };
}

function parsePositiveId(value: unknown, message: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundException(message);
  return id;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isFallback(row: InteractionRow) {
  return row.provider === 'rule-fallback';
}

function isRejected(row: InteractionRow) {
  return /^provider_(output_rejected|hint_revealed_answer|output_too_long)/.test(row.status);
}

function isError(row: InteractionRow) {
  return row.status !== 'success' && !isRejected(row);
}

function tokenEstimate(row: InteractionRow) {
  const usage = row.tokenUsage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return 0;
  const value = (usage as { totalTokensEstimate?: unknown }).totalTokensEstimate;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isBillable(row: InteractionRow) {
  const usage = row.tokenUsage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return false;
  return Boolean((usage as { billable?: unknown }).billable);
}

function blankBucket(key: string): MetricBucket {
  return {
    key,
    interactions: 0,
    fallbackInteractions: 0,
    externalInteractions: 0,
    successfulInteractions: 0,
    rejectedInteractions: 0,
    errorInteractions: 0,
    billableInteractions: 0,
    estimatedTokens: 0,
    estimatedCost: 0,
    feedbackCount: 0,
    lowFeedbackCount: 0,
    averageRating: null
  };
}

function addRow(bucket: MetricBucket & { ratingSum?: number }, row: InteractionRow) {
  bucket.interactions += 1;
  bucket.fallbackInteractions += isFallback(row) ? 1 : 0;
  bucket.externalInteractions += isFallback(row) ? 0 : 1;
  bucket.successfulInteractions += row.status === 'success' ? 1 : 0;
  bucket.rejectedInteractions += isRejected(row) ? 1 : 0;
  bucket.errorInteractions += isError(row) ? 1 : 0;
  bucket.billableInteractions += isBillable(row) ? 1 : 0;
  bucket.estimatedTokens += tokenEstimate(row);
  bucket.estimatedCost += typeof row.costEstimate === 'number' && Number.isFinite(row.costEstimate) ? row.costEstimate : 0;
  bucket.feedbackCount += row.feedback.length;
  bucket.lowFeedbackCount += row.feedback.filter((item) => item.rating <= 2).length;
  bucket.ratingSum = (bucket.ratingSum ?? 0) + row.feedback.reduce((sum, item) => sum + item.rating, 0);
}

function finalizeBucket(bucket: MetricBucket & { ratingSum?: number }): MetricBucket {
  const averageRating = bucket.feedbackCount ? Number(((bucket.ratingSum ?? 0) / bucket.feedbackCount).toFixed(2)) : null;
  const { ratingSum: _ratingSum, ...rest } = bucket;
  return { ...rest, estimatedCost: Number(rest.estimatedCost.toFixed(6)), averageRating };
}

function aggregate(rows: InteractionRow[], keyOf: (row: InteractionRow) => string) {
  const buckets = new Map<string, MetricBucket & { ratingSum?: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!buckets.has(key)) buckets.set(key, blankBucket(key));
    addRow(buckets.get(key)!, row);
  }
  return Array.from(buckets.values()).map(finalizeBucket).sort((a, b) => a.key.localeCompare(b.key));
}

function feedbackReasonBreakdown(rows: InteractionRow[]): FeedbackReasonBucket[] {
  const buckets = new Map<string, FeedbackReasonBucket>();
  for (const row of rows) {
    for (const feedback of row.feedback) {
      const reasonCode = String(feedback.reasonCode ?? '').trim();
      if (!reasonCode) continue;
      if (!buckets.has(reasonCode)) buckets.set(reasonCode, { reasonCode, count: 0, lowFeedbackCount: 0 });
      const bucket = buckets.get(reasonCode)!;
      bucket.count += 1;
      if (feedback.rating <= 2) bucket.lowFeedbackCount += 1;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.lowFeedbackCount - a.lowFeedbackCount || b.count - a.count || a.reasonCode.localeCompare(b.reasonCode));
}

function rate(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function rolloutHealth(summary: MetricBucket & { fallbackRate: number; rejectionRate: number; errorRate: number; feedbackRate: number }) {
  const thresholds = aiSafetyThresholds();
  const lowFeedbackRate = rate(summary.lowFeedbackCount, summary.feedbackCount);
  const checks = [
    {
      key: 'error_rate',
      label: 'Provider error rate',
      value: summary.errorRate,
      threshold: thresholds.maxErrorRate,
      status: summary.errorRate > thresholds.maxErrorRate ? 'fail' : summary.errorRate > thresholds.maxErrorRate / 2 ? 'warn' : 'pass'
    },
    {
      key: 'rejection_rate',
      label: 'Provider rejection rate',
      value: summary.rejectionRate,
      threshold: thresholds.maxRejectionRate,
      status: summary.rejectionRate > thresholds.maxRejectionRate ? 'fail' : summary.rejectionRate > thresholds.maxRejectionRate / 2 ? 'warn' : 'pass'
    },
    {
      key: 'low_feedback_rate',
      label: 'Low feedback rate',
      value: lowFeedbackRate,
      threshold: thresholds.maxLowFeedbackRate,
      status: summary.feedbackCount >= thresholds.minFeedback && lowFeedbackRate > thresholds.maxLowFeedbackRate
        ? 'fail'
        : summary.feedbackCount >= thresholds.minFeedback && lowFeedbackRate > thresholds.maxLowFeedbackRate / 2
          ? 'warn'
          : 'pass'
    },
    {
      key: 'average_rating',
      label: 'Average feedback rating',
      value: summary.averageRating,
      threshold: thresholds.minAverageRating,
      status: summary.feedbackCount >= thresholds.minFeedback && typeof summary.averageRating === 'number' && summary.averageRating < thresholds.minAverageRating
        ? 'fail'
        : summary.feedbackCount >= thresholds.minFeedback && typeof summary.averageRating === 'number' && summary.averageRating < thresholds.minAverageRating + 0.5
          ? 'warn'
          : 'pass'
    }
  ];

  const failing = checks.filter((check) => check.status === 'fail');
  const warning = checks.filter((check) => check.status === 'warn');
  let status: RolloutHealthStatus = 'healthy';
  if (summary.interactions < thresholds.minInteractions) status = 'insufficient_data';
  else if (failing.length) status = 'pause_rollout';
  else if (warning.length) status = 'watch';

  return {
    status,
    recommendation: status === 'pause_rollout'
      ? 'pause_live_llm_rollout'
      : status === 'watch'
        ? 'hold_or_reduce_rollout'
        : status === 'insufficient_data'
          ? 'collect_more_samples'
          : 'continue_gradual_rollout',
    sampleSize: summary.interactions,
    feedbackSampleSize: summary.feedbackCount,
    lowFeedbackRate,
    thresholds,
    checks
  };
}

function clampLimit(value: unknown) {
  const parsed = Number(value ?? 30);
  if (!Number.isInteger(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 100);
}

function averageFeedback(row: InteractionReviewRow) {
  if (!row.feedback.length) return null;
  return Number((row.feedback.reduce((sum, item) => sum + item.rating, 0) / row.feedback.length).toFixed(2));
}

function reviewReasons(row: InteractionReviewRow) {
  const reasons = new Set<string>();
  const averageRating = averageFeedback(row);
  if (typeof averageRating === 'number' && averageRating <= 2) reasons.add('low_feedback');
  const reasonCodes = new Set(row.feedback.map((item) => item.reasonCode).filter(Boolean));
  if (reasonCodes.has('wrong_language')) reasons.add('language_quality_issue');
  if (reasonCodes.has('factually_wrong')) reasons.add('factual_quality_issue');
  if (reasonCodes.has('missed_my_mistake')) reasons.add('explanation_alignment_issue');
  if (reasonCodes.has('too_generic') || reasonCodes.has('not_grounded_in_round')) reasons.add('summary_grounding_issue');
  if (reasonCodes.has('too_verbose')) reasons.add('response_length_issue');
  if (reasonCodes.has('unclear') || reasonCodes.has('math_or_formula_unclear')) reasons.add('explanation_readability_issue');
  if (isRejected(row)) reasons.add('provider_rejected');
  if (isError(row)) reasons.add('provider_error');
  if (row.status === 'quota_exhausted') reasons.add('quota_exhausted');
  if (row.provider === 'rule-fallback' && row.status !== 'success') reasons.add('fallback_failure');
  return Array.from(reasons);
}

function suggestedAction(reasons: string[]) {
  if (reasons.includes('language_quality_issue')) return 'inspect_language_context_and_prompt';
  if (reasons.includes('factual_quality_issue')) return 'sample_output_and_compare_standard_answer';
  if (reasons.includes('explanation_alignment_issue')) return 'tune_wrong_answer_prompt_schema';
  if (reasons.includes('summary_grounding_issue')) return 'improve_round_summary_grounding';
  if (reasons.includes('response_length_issue')) return 'tighten_response_length_guidance';
  if (reasons.includes('explanation_readability_issue')) return 'review_explanation_readability';
  if (reasons.includes('provider_rejected')) return 'review_prompt_guard';
  if (reasons.includes('provider_error')) return 'check_provider_or_retry_policy';
  if (reasons.includes('low_feedback')) return 'sample_output_and_tune_prompt';
  if (reasons.includes('quota_exhausted')) return 'check_entitlement_messaging';
  if (reasons.includes('fallback_failure')) return 'inspect_rule_fallback';
  return 'monitor';
}

function previewText(value: string | null | undefined, max = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const REVIEW_DECISIONS = new Set([
  'accepted',
  'needs_prompt_update',
  'needs_question_fix',
  'pause_prompt_template',
  'resolved',
  'ignored'
]);

function parseReviewDecision(value: unknown) {
  const decision = String(value ?? '').trim();
  if (!REVIEW_DECISIONS.has(decision)) {
    throw new BadRequestException('AI 复核结论不在允许范围内。');
  }
  return decision;
}

function reviewStatus(decision: string) {
  return ['accepted', 'resolved', 'ignored'].includes(decision) ? 'closed' : 'open';
}

function mapDecisionRow(row: AIReviewDecisionRow) {
  return {
    id: row.id,
    interactionId: row.interactionId,
    actorId: row.actorId,
    decision: row.decision,
    status: row.status,
    note: row.note,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

@Injectable()
export class AIObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: AIObservabilityQuery = {}) {
    const { start, end } = dateRange(query);
    const rows = await this.prisma.cscaAIInteraction.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        provider: stringFilter(query.provider),
        status: stringFilter(query.status),
        type: stringFilter(query.type),
        subject: stringFilter(query.subject)
      },
      orderBy: { createdAt: 'asc' },
      include: { feedback: { select: { rating: true, reasonCode: true } } }
    }) as InteractionRow[];

    const [summary] = aggregate(rows, () => 'all');
    const emptySummary = finalizeBucket(blankBucket('all'));
    const current = summary ?? emptySummary;
    const recentFailures = rows
      .filter((row) => row.status !== 'success')
      .slice(-20)
      .reverse()
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        type: row.type,
        provider: row.provider,
        model: row.model,
        promptVersion: row.promptVersion,
        status: row.status,
        subject: row.subject,
        feedbackCount: row.feedback.length
      }));

    const summaryWithRates = {
      ...current,
      fallbackRate: rate(current.fallbackInteractions, current.interactions),
      rejectionRate: rate(current.rejectedInteractions, current.interactions),
      errorRate: rate(current.errorInteractions, current.interactions),
      feedbackRate: rate(current.feedbackCount, current.interactions)
    };

    return {
      range: {
        from: start.toISOString(),
        to: end.toISOString()
      },
      filters: {
        provider: stringFilter(query.provider) ?? null,
        status: stringFilter(query.status) ?? null,
        type: stringFilter(query.type) ?? null,
        subject: stringFilter(query.subject) ?? null
      },
      summary: summaryWithRates,
      rolloutHealth: rolloutHealth(summaryWithRates),
      byDay: aggregate(rows, (row) => dayKey(row.createdAt)),
      byProvider: aggregate(rows, (row) => row.provider ?? 'unknown'),
      byType: aggregate(rows, (row) => row.type),
      byStatus: aggregate(rows, (row) => row.status),
      reasonBreakdown: feedbackReasonBreakdown(rows),
      recentFailures
    };
  }

  async getReviewQueue(query: AIObservabilityQuery & { reason?: string; limit?: string } = {}) {
    const { start, end } = dateRange(query);
    const limit = clampLimit(query.limit);
    const rows = await this.prisma.cscaAIInteraction.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        provider: stringFilter(query.provider),
        status: stringFilter(query.status),
        type: stringFilter(query.type),
        subject: stringFilter(query.subject)
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { feedback: { select: { rating: true, reason: true, reasonCode: true, createdAt: true }, orderBy: { createdAt: 'desc' } } }
    }) as InteractionReviewRow[];
    const reasonFilter = stringFilter(query.reason);
    const candidates = rows
      .map((row) => {
        const reasons = reviewReasons(row);
        return { row, reasons };
      })
      .filter((item) => item.reasons.length > 0)
      .filter((item) => reasonFilter ? item.reasons.includes(reasonFilter) : true)
      .slice(0, limit);
    const latestDecisions = await this.latestReviewDecisions(candidates.map((item) => item.row.id));

    const reasonCounts = new Map<string, number>();
    for (const item of candidates) {
      for (const reason of item.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }

    return {
      range: {
        from: start.toISOString(),
        to: end.toISOString()
      },
      filters: {
        provider: stringFilter(query.provider) ?? null,
        status: stringFilter(query.status) ?? null,
        type: stringFilter(query.type) ?? null,
        subject: stringFilter(query.subject) ?? null,
        reason: reasonFilter ?? null
      },
      summary: {
        candidates: candidates.length,
        lowFeedback: candidates.filter((item) => item.reasons.includes('low_feedback')).length,
        providerRejected: candidates.filter((item) => item.reasons.includes('provider_rejected')).length,
        providerErrors: candidates.filter((item) => item.reasons.includes('provider_error')).length,
        quotaExhausted: candidates.filter((item) => item.reasons.includes('quota_exhausted')).length
      },
      byReason: Array.from(reasonCounts.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key)),
      items: candidates.map(({ row, reasons }) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        subject: row.subject,
        topicId: row.topicId,
        sessionId: row.sessionId,
        roundId: row.roundId,
        questionId: row.questionId,
        type: row.type,
        provider: row.provider,
        model: row.model,
        promptVersion: row.promptVersion,
        status: row.status,
        reasons,
        suggestedAction: suggestedAction(reasons),
        averageRating: averageFeedback(row),
        feedbackCount: row.feedback.length,
        latestFeedbackReason: row.feedback[0]?.reason ?? null,
        latestFeedbackReasonCode: row.feedback[0]?.reasonCode ?? null,
        outputPreview: previewText(row.output),
        tokenUsage: row.tokenUsage,
        costEstimate: row.costEstimate,
        latestDecision: latestDecisions.get(row.id) ? mapDecisionRow(latestDecisions.get(row.id)!) : null
      }))
    };
  }

  async recordReviewDecision(actorId: number | undefined, interactionIdValue: unknown, body: Record<string, unknown>) {
    const interactionId = parsePositiveId(interactionIdValue, 'AI 交互记录不存在。');
    const decision = parseReviewDecision(body.decision);
    const note = cleanNote(body.note);
    const interaction = await this.prisma.cscaAIInteraction.findUnique({
      where: { id: interactionId },
      select: {
        id: true,
        type: true,
        provider: true,
        model: true,
        promptVersion: true,
        inputHash: true,
        output: true,
        tokenUsage: true,
        costEstimate: true,
        status: true,
        subject: true,
        topicId: true,
        sessionId: true,
        questionId: true,
        roundId: true,
        userId: true,
        createdAt: true
      }
    });
    if (!interaction) throw new NotFoundException('AI 交互记录不存在。');
    const reasons = reviewReasons({ ...interaction, feedback: [] } as unknown as InteractionReviewRow);
    const status = reviewStatus(decision);
    const [created] = await this.prisma.$queryRaw<AIReviewDecisionRow[]>(Prisma.sql`
      INSERT INTO "csca_ai_review_decisions" (
        "interaction_id",
        "actor_id",
        "decision",
        "status",
        "note",
        "metadata"
      )
      VALUES (
        ${interactionId},
        ${actorId ?? null},
        ${decision},
        ${status},
        ${note},
        ${JSON.stringify({
          reasons,
          interaction: {
            type: interaction.type,
            provider: interaction.provider,
            model: interaction.model,
            promptVersion: interaction.promptVersion,
            status: interaction.status,
            subject: interaction.subject,
            questionId: interaction.questionId,
            roundId: interaction.roundId,
            userId: interaction.userId
          }
        })}::jsonb
      )
      RETURNING
        "id",
        "interaction_id" AS "interactionId",
        "actor_id" AS "actorId",
        "decision",
        "status",
        "note",
        "metadata",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
    `);
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'adaptive-ai',
      resourceType: 'ai_interaction_review',
      resourceId: interactionId,
      action: 'ai_review.decision',
      after: {
        interactionId,
        decision,
        status,
        note,
        provider: interaction.provider,
        model: interaction.model,
        promptVersion: interaction.promptVersion,
        interactionStatus: interaction.status,
        subject: interaction.subject,
        questionId: interaction.questionId,
        roundId: interaction.roundId
      }
    });
    return mapDecisionRow(created);
  }

  private async latestReviewDecisions(interactionIds: number[]) {
    if (!interactionIds.length) return new Map<number, AIReviewDecisionRow>();
    const rows = await this.prisma.$queryRaw<AIReviewDecisionRow[]>(Prisma.sql`
      SELECT
        "id",
        "interaction_id" AS "interactionId",
        "actor_id" AS "actorId",
        "decision",
        "status",
        "note",
        "metadata",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "csca_ai_review_decisions"
      WHERE "interaction_id" IN (${Prisma.join(interactionIds)})
      ORDER BY "interaction_id" ASC, "created_at" DESC, "id" DESC
    `);
    const latest = new Map<number, AIReviewDecisionRow>();
    for (const row of rows) {
      if (!latest.has(row.interactionId)) latest.set(row.interactionId, row);
    }
    return latest;
  }
}
