import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type QualityMetricRow = {
  questionId: number;
  sourceQuestionId: number | null;
  generatedVariantOf: number | null;
  questionStatus: string;
  subject: string;
  topicId: number;
  designedDifficulty: string;
  empiricalDifficulty: string | null;
  difficultyConfidence: number | null;
  attemptCount: number;
  correctRate: number | null;
  medianSeconds: number | null;
  unansweredRate: number | null;
  markedRate: number | null;
  optionSelectionStats: unknown;
  mostSelectedWrongOption: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  qualityGovernance: unknown;
  replacementCandidateStatus: string | null;
  updatedAt: Date;
};

type AggregateRow = {
  questionId: number;
  sourceQuestionId: number | null;
  generatedVariantOf: number | null;
  subject: string;
  topicId: number;
  designedDifficulty: string;
  attemptCount: bigint | number;
  correctRate: number | null;
  medianSeconds: number | null;
  unansweredRate: number | null;
};

type OptionSelectionRow = {
  questionId: number;
  correctAnswer: string;
  optionMetadata: unknown;
  subject: string;
  topicId: number;
  selectedAnswer: string | null;
  count: bigint | number;
};

type OptionQualityStat = {
  optionId: string;
  count: number;
  selectionRate?: number;
  wrongSelectionRate?: number;
  isCorrectOption: boolean;
  distractorIntent?: string | null;
  misconceptionTags?: string[];
  qualitySignal?: string;
};

function difficultyRank(value?: string | null) {
  const text = String(value ?? '').trim();
  if (text.includes('挑战') || text.toLowerCase().includes('challenge')) return 4;
  if (text.includes('较难') || text.includes('提高') || text.toLowerCase().includes('advanced')) return 3;
  if (text.includes('中') || text.toLowerCase().includes('medium')) return 2;
  return 1;
}

function empiricalDifficultyFromRate(correctRate: number | null) {
  if (correctRate === null) return null;
  if (correctRate >= 0.78) return '基础';
  if (correctRate >= 0.58) return '中等';
  if (correctRate >= 0.38) return '较难';
  return '挑战';
}

export function reviewReasonForMetric(input: {
  attemptCount: number;
  designedDifficulty: string;
  empiricalDifficulty: string | null;
  correctRate: number | null;
  unansweredRate: number | null;
  isVariant?: boolean;
}) {
  if (input.isVariant && input.attemptCount >= 5 && input.correctRate !== null) {
    if (input.correctRate <= 0.4) return 'weak_variant_effect';
    if ((input.unansweredRate ?? 0) >= 0.35) return 'high_variant_unanswered_rate';
    if (input.correctRate >= 0.95) return 'variant_too_easy';
  }
  if (input.attemptCount < 20 || input.correctRate === null || !input.empiricalDifficulty) return null;
  if (input.attemptCount >= 80 && (input.correctRate <= 0.2 || input.correctRate >= 0.92 || (input.unansweredRate ?? 0) >= 0.3)) return 'high_exposure_anomaly';
  if (input.correctRate >= 0.95) return 'correct_rate_too_high';
  if (input.correctRate <= 0.15) return 'correct_rate_too_low';
  if ((input.unansweredRate ?? 0) >= 0.35) return 'high_unanswered_rate';
  const designedRank = difficultyRank(input.designedDifficulty);
  const empiricalRank = difficultyRank(input.empiricalDifficulty);
  if (Math.abs(designedRank - empiricalRank) >= 2) return 'difficulty_mismatch';
  return null;
}

function mapMetric(row: QualityMetricRow) {
  return {
    questionId: row.questionId,
    sourceQuestionId: row.sourceQuestionId,
    generatedVariantOf: row.generatedVariantOf,
    questionStatus: row.questionStatus,
    subject: row.subject,
    topicId: row.topicId,
    designedDifficulty: row.designedDifficulty,
    empiricalDifficulty: row.empiricalDifficulty,
    difficultyConfidence: row.difficultyConfidence,
    attemptCount: row.attemptCount,
    correctRate: row.correctRate,
    medianSeconds: row.medianSeconds,
    unansweredRate: row.unansweredRate,
    markedRate: row.markedRate,
    optionSelectionStats: row.optionSelectionStats,
    mostSelectedWrongOption: row.mostSelectedWrongOption,
    needsReview: row.needsReview,
    reviewReason: row.reviewReason,
    qualityGovernance: row.qualityGovernance,
    replacementCandidateStatus: row.replacementCandidateStatus,
    qualitySummary: qualitySummary(row),
    updatedAt: row.updatedAt.toISOString()
  };
}

type QualityMetric = ReturnType<typeof mapMetric>;

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dateFrom(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampLimit(value: unknown, fallback = 20, max = 100) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function cleanSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'unknown';
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function optionMetadataItems(value: unknown): Array<{
  optionId: string;
  distractorIntent?: string;
  misconceptionTags?: string[];
  evidence?: Record<string, unknown>;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const optionId = cleanText(record.optionId);
      if (!optionId) return null;
      return {
        optionId,
        distractorIntent: cleanText(record.distractorIntent) || undefined,
        misconceptionTags: Array.isArray(record.misconceptionTags)
          ? Array.from(new Set(record.misconceptionTags.map((tag) => cleanText(tag)).filter(Boolean))).slice(0, 8)
          : [],
        evidence: record.evidence && typeof record.evidence === 'object' && !Array.isArray(record.evidence)
          ? record.evidence as Record<string, unknown>
          : undefined
      };
    })
    .filter(Boolean) as ReturnType<typeof optionMetadataItems>;
}

function optionQualitySignal(input: { isCorrectOption: boolean; wrongSelectionRate: number; count: number; attemptCount: number; hasMetadata: boolean }) {
  if (input.isCorrectOption) return 'correct_option';
  if (!input.hasMetadata) return 'missing_metadata';
  if (input.attemptCount >= 20 && input.wrongSelectionRate >= 0.5) return 'dominant_distractor';
  if (input.attemptCount >= 20 && input.count === 0) return 'unused_distractor';
  return 'normal';
}

function reviewReasonWithOptionQuality(existingReason: string | null, optionStats: Array<{ qualitySignal: string }>) {
  if (existingReason) return existingReason;
  if (optionStats.some((item) => item.qualitySignal === 'missing_metadata')) return 'missing_option_metadata';
  if (optionStats.some((item) => item.qualitySignal === 'dominant_distractor')) return 'dominant_distractor';
  if (optionStats.some((item) => item.qualitySignal === 'unused_distractor')) return 'unused_distractor';
  return null;
}

function optionStatsFrom(value: unknown): OptionQualityStat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const optionId = cleanText(record.optionId);
      if (!optionId) return null;
      return {
        optionId,
        count: Number(record.count ?? 0),
        selectionRate: typeof record.selectionRate === 'number' ? record.selectionRate : undefined,
        wrongSelectionRate: typeof record.wrongSelectionRate === 'number' ? record.wrongSelectionRate : undefined,
        isCorrectOption: record.isCorrectOption === true,
        distractorIntent: typeof record.distractorIntent === 'string' ? record.distractorIntent : null,
        misconceptionTags: Array.isArray(record.misconceptionTags) ? record.misconceptionTags.map((tag) => cleanText(tag)).filter(Boolean) : [],
        qualitySignal: typeof record.qualitySignal === 'string' ? record.qualitySignal : undefined
      };
    })
    .filter(Boolean) as OptionQualityStat[];
}

export function qualitySummary(row: QualityMetricRow) {
  const optionStats = optionStatsFrom(row.optionSelectionStats);
  const signalCounts = optionStats.reduce<Record<string, number>>((acc, item) => {
    const key = item.qualitySignal || 'normal';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const problemOptions = optionStats
    .filter((item) => item.qualitySignal && item.qualitySignal !== 'normal' && item.qualitySignal !== 'correct_option')
    .map((item) => ({
      optionId: item.optionId,
      signal: item.qualitySignal,
      count: item.count,
      wrongSelectionRate: item.wrongSelectionRate ?? 0,
      distractorIntent: item.distractorIntent ?? null,
      misconceptionTags: item.misconceptionTags ?? []
    }));
  const highExposureAnomaly = row.attemptCount >= 80 && (
    row.correctRate !== null && (row.correctRate <= 0.2 || row.correctRate >= 0.92)
    || (row.unansweredRate ?? 0) >= 0.3
    || signalCounts.dominant_distractor
  );
  const reasons = [
    row.reviewReason,
    highExposureAnomaly ? 'high_exposure_anomaly' : null,
    row.correctRate !== null && row.correctRate <= 0.15 ? 'very_low_correct_rate' : null,
    row.correctRate !== null && row.correctRate >= 0.95 ? 'very_high_correct_rate' : null,
    row.generatedVariantOf && row.reviewReason === 'weak_variant_effect' ? 'variant_underperforming' : null,
    row.generatedVariantOf && row.reviewReason === 'high_variant_unanswered_rate' ? 'variant_high_unanswered_rate' : null,
    row.generatedVariantOf && row.reviewReason === 'variant_too_easy' ? 'variant_too_easy' : null,
    (row.unansweredRate ?? 0) >= 0.35 ? 'high_unanswered_rate' : null,
    signalCounts.missing_metadata ? 'missing_option_metadata' : null,
    signalCounts.dominant_distractor ? 'dominant_distractor' : null,
    signalCounts.unused_distractor ? 'unused_distractor' : null
  ].filter(Boolean) as string[];
  const isWeakVariant = row.generatedVariantOf !== null && (
    row.reviewReason === 'weak_variant_effect'
    || row.reviewReason === 'high_variant_unanswered_rate'
  );
  const severity = row.needsReview || reasons.length
    ? (highExposureAnomaly
        || row.attemptCount >= 20 && (row.correctRate !== null && (row.correctRate <= 0.15 || row.correctRate >= 0.95) || (row.unansweredRate ?? 0) >= 0.35 || signalCounts.dominant_distractor)
        || isWeakVariant
        ? 'high'
        : 'medium')
    : 'low';
  const recommendedAction = isWeakVariant
    ? 'reduce_exposure'
    : highExposureAnomaly
      ? 'reduce_exposure'
    : severity === 'high'
    ? (signalCounts.dominant_distractor || row.correctRate !== null && row.correctRate <= 0.15 ? 'regenerate' : 'manual_fix')
    : severity === 'medium'
      ? 'send_to_review'
      : 'monitor';
  return {
    severity,
    reasons: Array.from(new Set(reasons)),
    recommendedAction,
    evidence: {
      attemptCount: row.attemptCount,
      generatedVariantOf: row.generatedVariantOf,
      correctRate: row.correctRate,
      unansweredRate: row.unansweredRate,
      designedDifficulty: row.designedDifficulty,
      empiricalDifficulty: row.empiricalDifficulty,
      difficultyConfidence: row.difficultyConfidence,
      mostSelectedWrongOption: row.mostSelectedWrongOption,
      optionSignals: signalCounts,
      problemOptions
    }
  };
}

export function summarizeQualityGovernance(metrics: QualityMetric[]) {
  const byReason = new Map<string, {
    reason: string;
    count: number;
    needsReviewCount: number;
    variantCount: number;
    highSeverityCount: number;
    recommendedActions: Record<string, number>;
    sampleQuestionIds: number[];
  }>();
  const byAction = new Map<string, {
    action: string;
    count: number;
    needsReviewCount: number;
    variantCount: number;
    highSeverityCount: number;
    sampleQuestionIds: number[];
  }>();
  const byAssignee = new Map<string, {
    assigneeId: number | null;
    assigneeLabel: string;
    count: number;
    needsReviewCount: number;
    highSeverityCount: number;
    overdueCount: number;
    dueSoonCount: number;
    sampleQuestionIds: number[];
  }>();
  const bySeverity = new Map<string, number>();
  const now = new Date();
  const sla = {
    overdueUnassignedCount: 0,
    overdueAssignedCount: 0,
    dueSoonCount: 0,
    escalationCount: 0,
    sampleQuestionIds: [] as number[]
  };

  for (const metric of metrics) {
    const summary = metric.qualitySummary;
    const action = summary?.recommendedAction ?? 'monitor';
    const severity = summary?.severity ?? 'low';
    const governance = recordFrom(metric.qualityGovernance);
    const governanceStatus = String(governance.status ?? '');
    const assignedAt = dateFrom(governance.assignedAt);
    const metricUpdatedAt = dateFrom(metric.updatedAt);
    const ageHours = metricUpdatedAt ? (now.getTime() - metricUpdatedAt.getTime()) / 36e5 : 0;
    const assignedAgeHours = assignedAt ? (now.getTime() - assignedAt.getTime()) / 36e5 : 0;
    const isActionableReview = metric.needsReview || severity === 'high';
    const overdueUnassigned = isActionableReview && governanceStatus !== 'assigned' && governanceStatus !== 'resolved' && governanceStatus !== 'replaced' && ageHours >= 24;
    const overdueAssigned = isActionableReview && governanceStatus === 'assigned' && assignedAgeHours >= 48;
    const dueSoon = isActionableReview && !overdueUnassigned && !overdueAssigned && (
      governanceStatus === 'assigned' ? assignedAgeHours >= 36 : ageHours >= 12
    );
    if (overdueUnassigned) sla.overdueUnassignedCount += 1;
    if (overdueAssigned) sla.overdueAssignedCount += 1;
    if (dueSoon) sla.dueSoonCount += 1;
    if (overdueUnassigned || overdueAssigned) {
      sla.escalationCount += 1;
      if (sla.sampleQuestionIds.length < 5) sla.sampleQuestionIds.push(metric.questionId);
    }
    const assignedTo = Number(governance.assignedTo);
    const assigneeId = Number.isInteger(assignedTo) && assignedTo > 0 ? assignedTo : null;
    const assigneeKey = assigneeId === null ? 'unassigned' : String(assigneeId);
    const assigneeBucket = byAssignee.get(assigneeKey) ?? {
      assigneeId,
      assigneeLabel: assigneeId === null ? 'unassigned' : `#${assigneeId}`,
      count: 0,
      needsReviewCount: 0,
      highSeverityCount: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      sampleQuestionIds: []
    };
    assigneeBucket.count += 1;
    if (metric.needsReview) assigneeBucket.needsReviewCount += 1;
    if (severity === 'high') assigneeBucket.highSeverityCount += 1;
    if (overdueUnassigned || overdueAssigned) assigneeBucket.overdueCount += 1;
    if (dueSoon) assigneeBucket.dueSoonCount += 1;
    if (assigneeBucket.sampleQuestionIds.length < 5) assigneeBucket.sampleQuestionIds.push(metric.questionId);
    byAssignee.set(assigneeKey, assigneeBucket);
    bySeverity.set(severity, (bySeverity.get(severity) ?? 0) + 1);
    const reasons = summary?.reasons?.length ? summary.reasons : [metric.reviewReason || 'no_active_reason'];

    const actionBucket = byAction.get(action) ?? {
      action,
      count: 0,
      needsReviewCount: 0,
      variantCount: 0,
      highSeverityCount: 0,
      sampleQuestionIds: []
    };
    actionBucket.count += 1;
    if (metric.needsReview) actionBucket.needsReviewCount += 1;
    if (metric.generatedVariantOf) actionBucket.variantCount += 1;
    if (severity === 'high') actionBucket.highSeverityCount += 1;
    if (actionBucket.sampleQuestionIds.length < 5) actionBucket.sampleQuestionIds.push(metric.questionId);
    byAction.set(action, actionBucket);

    for (const reason of reasons) {
      const bucket = byReason.get(reason) ?? {
        reason,
        count: 0,
        needsReviewCount: 0,
        variantCount: 0,
        highSeverityCount: 0,
        recommendedActions: {},
        sampleQuestionIds: []
      };
      bucket.count += 1;
      if (metric.needsReview) bucket.needsReviewCount += 1;
      if (metric.generatedVariantOf) bucket.variantCount += 1;
      if (severity === 'high') bucket.highSeverityCount += 1;
      bucket.recommendedActions[action] = (bucket.recommendedActions[action] ?? 0) + 1;
      if (bucket.sampleQuestionIds.length < 5) bucket.sampleQuestionIds.push(metric.questionId);
      byReason.set(reason, bucket);
    }
  }

  const sortBuckets = <T extends { count: number; highSeverityCount: number }>(items: T[]) => (
    items.sort((a, b) => b.highSeverityCount - a.highSeverityCount || b.count - a.count)
  );
  return {
    summary: {
      total: metrics.length,
      needsReviewCount: metrics.filter((metric) => metric.needsReview).length,
      variantCount: metrics.filter((metric) => Boolean(metric.generatedVariantOf)).length,
      highSeverityCount: metrics.filter((metric) => metric.qualitySummary?.severity === 'high').length,
      recommendedActionCount: Array.from(byAction.keys()).length,
      sla
    },
    byReason: sortBuckets(Array.from(byReason.values())),
    byAction: sortBuckets(Array.from(byAction.values())),
    byAssignee: Array.from(byAssignee.values()).sort((a, b) => b.overdueCount - a.overdueCount || b.highSeverityCount - a.highSeverityCount || b.needsReviewCount - a.needsReviewCount || b.count - a.count),
    bySeverity: Array.from(bySeverity.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  };
}

function cleanDays(value: unknown, fallback = 14) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 1), 90);
}

@Injectable()
export class QuestionQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMetric(questionIdValue: unknown, body: Record<string, unknown> = {}) {
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(questionId) || questionId <= 0) throw new NotFoundException('题目质量指标不存在。');
    const note = cleanText(body.note) || 'admin_resolved';
    const [row] = await this.prisma.$queryRaw<QualityMetricRow[]>(Prisma.sql`
      UPDATE "csca_question_quality_metrics"
      SET "needs_review" = false,
          "review_reason" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "question_id" = ${questionId}
      RETURNING "question_id" AS "questionId", NULL::int AS "sourceQuestionId", NULL::int AS "generatedVariantOf", ''::text AS "questionStatus", ''::text AS "subject", 0::int AS "topicId",
                ''::text AS "designedDifficulty", "empirical_difficulty" AS "empiricalDifficulty",
                "difficulty_confidence" AS "difficultyConfidence", "attempt_count" AS "attemptCount",
                "correct_rate" AS "correctRate", "median_seconds" AS "medianSeconds",
                "unanswered_rate" AS "unansweredRate", "marked_rate" AS "markedRate",
                "option_selection_stats" AS "optionSelectionStats", "most_selected_wrong_option" AS "mostSelectedWrongOption",
                "needs_review" AS "needsReview", "review_reason" AS "reviewReason", NULL::jsonb AS "qualityGovernance", "updated_at" AS "updatedAt"
    `);
    if (!row) throw new NotFoundException('题目质量指标不存在。');
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_questions"
      SET "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
        qualityGovernance: {
          status: 'resolved',
          note,
          decidedAt: new Date().toISOString()
        }
      })}::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
    `);
    const items = await this.listMetrics({ questionIds: [questionId] });
    return items[0] ?? mapMetric(row);
  }

  async sendMetricToReview(questionIdValue: unknown, body: Record<string, unknown> = {}) {
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(questionId) || questionId <= 0) throw new NotFoundException('题目质量指标不存在。');
    const reason = cleanText(body.reason) || 'admin_quality_review';
    const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id" FROM "csca_question_quality_metrics" WHERE "question_id" = ${questionId} LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('题目质量指标不存在。');
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_question_quality_metrics"
      SET "needs_review" = true,
          "review_reason" = ${reason},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "question_id" = ${questionId}
    `);
    const [question] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = CASE WHEN "status" = 'approved' THEN 'pending_review' ELSE "status" END,
          "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
            qualityGovernance: {
              status: 'needs_review',
              reason,
              decidedAt: new Date().toISOString()
            }
          })}::jsonb,
          "version" = "version" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
        AND "status" NOT IN ('rejected', 'archived')
      RETURNING "id"
    `);
    if (!question) throw new BadRequestException('该题目已被否决或归档，不能送回复核。');
    const items = await this.listMetrics({ questionIds: [questionId] });
    return items[0];
  }

  async assignMetricReview(questionIdValue: unknown, body: Record<string, unknown> = {}, actorId?: number) {
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(questionId) || questionId <= 0) throw new NotFoundException('题目质量指标不存在。');
    const assignedTo = Number(body.assignedTo ?? body.assigneeId ?? actorId);
    if (!Number.isInteger(assignedTo) || assignedTo <= 0) throw new BadRequestException('请提供有效的复核负责人。');
    const reason = cleanText(body.reason) || 'assigned_quality_review';
    const note = cleanText(body.note) || 'admin_assigned_quality_review';
    const metricRows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "question_id" AS "id" FROM "csca_question_quality_metrics" WHERE "question_id" = ${questionId} LIMIT 1
    `);
    if (!metricRows[0]) throw new NotFoundException('题目质量指标不存在。');
    const assignedAt = new Date().toISOString();
    const governance = {
      status: 'assigned',
      reason,
      note,
      assignedTo,
      assignedBy: actorId ?? null,
      assignedAt
    };
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_question_quality_metrics"
      SET "needs_review" = true,
          "review_reason" = ${reason},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "question_id" = ${questionId}
    `);
    const [question] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = CASE WHEN "status" = 'approved' THEN 'pending_review' ELSE "status" END,
          "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
            qualityGovernance: governance
          })}::jsonb,
          "version" = "version" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
        AND "status" NOT IN ('rejected', 'archived')
      RETURNING "id"
    `);
    if (!question) throw new BadRequestException('该题目已被否决或归档，不能分派复核。');
    const items = await this.listMetrics({ questionIds: [questionId] });
    return items[0];
  }

  async applyDisposition(questionIdValue: unknown, body: Record<string, unknown> = {}) {
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(questionId) || questionId <= 0) throw new NotFoundException('题目质量指标不存在。');
    const disposition = cleanText(body.disposition);
    if (!['archive', 'manual_fix', 'reduce_exposure', 'regenerate'].includes(disposition)) {
      throw new BadRequestException('质量分流动作只能是 archive/manual_fix/reduce_exposure/regenerate。');
    }
    const note = cleanText(body.note) || `admin_quality_${disposition}`;
    const metricRows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "question_id" AS "id" FROM "csca_question_quality_metrics" WHERE "question_id" = ${questionId} LIMIT 1
    `);
    if (!metricRows[0]) throw new NotFoundException('题目质量指标不存在。');

    const questionStatus = disposition === 'archive'
      ? 'archived'
      : disposition === 'manual_fix' || disposition === 'regenerate'
        ? 'pending_review'
        : null;
    const metricNeedsReview = disposition === 'manual_fix' || disposition === 'regenerate';
    const metricReason = disposition === 'manual_fix'
      ? 'manual_fix_required'
      : disposition === 'regenerate'
        ? 'regeneration_required'
        : null;
    const replacementQuestionId = disposition === 'regenerate'
      ? await this.createReplacementCandidate(questionId, note)
      : null;
    const governance = {
      status: disposition === 'archive' || disposition === 'reduce_exposure' ? 'resolved' : 'needs_review',
      disposition,
      note,
      replacementQuestionId,
      decidedAt: new Date().toISOString()
    };

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_question_quality_metrics"
      SET "needs_review" = ${metricNeedsReview},
          "review_reason" = ${metricReason},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "question_id" = ${questionId}
    `);
    const [question] = await this.prisma.$queryRaw<Array<{ id: number; sourceQuestionId: number | null }>>(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = COALESCE(${questionStatus}::text, "status"),
          "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
            qualityGovernance: governance
          })}::jsonb,
          "version" = "version" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
        AND "status" NOT IN ('rejected')
      RETURNING "id", "source_question_id" AS "sourceQuestionId"
    `);
    if (!question) throw new BadRequestException('该题目已被否决，不能执行质量分流。');
    if (disposition === 'archive') {
      await this.archivePublishedPracticeQuestion(question.sourceQuestionId, 'quality_archive');
    }
    const items = await this.listMetrics({ questionIds: [questionId] });
    return items[0];
  }

  private async archivePublishedPracticeQuestion(sourceQuestionId: number | null | undefined, reason: string) {
    if (!sourceQuestionId) return;
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "special_practice_questions"
      SET "status" = 'archived',
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${sourceQuestionId}
        AND "status" <> 'archived'
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_questions"
      SET "review_metadata" = COALESCE("review_metadata", '{}'::jsonb) || ${JSON.stringify({
        publishedPracticeArchive: {
          sourceQuestionId,
          reason,
          archivedAt: new Date().toISOString()
        }
      })}::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "source_question_id" = ${sourceQuestionId}
    `);
  }

  async governanceSummary(query: { subject?: string; useCase?: string } = {}) {
    const metrics = await this.listMetrics({ subject: query.subject, useCase: query.useCase });
    return summarizeQualityGovernance(metrics);
  }

  async qualityTrend(query: { subject?: string; days?: unknown; useCase?: string } = {}) {
    const days = cleanDays(query.days);
    const rows = await this.prisma.$queryRaw<Array<{
      day: Date;
      subject: string;
      attemptCount: bigint | number;
      correctCount: bigint | number;
      unansweredCount: bigint | number;
      uniqueQuestionCount: bigint | number;
      needsReviewCount: bigint | number;
      highSeverityCount: bigint | number;
      assignedReviewCount: bigint | number;
      regenerationRequiredCount: bigint | number;
    }>>(Prisma.sql`
      WITH ai_attempts AS (
        SELECT
          DATE(COALESCE(round."submitted_at", item."updated_at")) AS "day",
          cq."id" AS "questionId",
          cq."subject",
          item."is_correct" AS "isCorrect"
        FROM "csca_adaptive_round_items" item
        JOIN "csca_adaptive_rounds" round ON round."id" = item."round_id"
        JOIN "csca_questions" cq ON (
          (item."question_source" = 'csca_question' AND item."question_id" = cq."id")
          OR (
            COALESCE(item."question_source", 'special_practice') = 'special_practice'
            AND cq."source_question_id" IS NOT NULL
            AND item."question_id" = cq."source_question_id"
          )
        )
        LEFT JOIN "special_practice_questions" spq ON spq."id" = cq."source_question_id"
        WHERE COALESCE(round."submitted_at", item."updated_at") >= CURRENT_DATE - (${days}::int - 1) * INTERVAL '1 day'
          AND cq."status" NOT IN ('rejected')
          ${query.subject ? Prisma.sql`AND cq."subject" = ${query.subject}` : Prisma.empty}
          AND (
            ${query.useCase || null}::text IS NULL
            OR (
              ${query.useCase || null} = 'online_mock_exam'
              AND (
                cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
                OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
                OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
                OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
                OR cq."review_metadata"->'mockExamApproval'->>'status' IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
              )
            )
            OR (
              ${query.useCase || null} = 'subject_practice'
              AND cq."source_type" = 'ai'
              AND cq."source_question_id" IS NOT NULL
              AND spq."status" = 'published'
              AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
              AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
              AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
              AND NOT (
                cq."generation_metadata"->>'fallbackUsed' = 'true'
                OR cq."generation_metadata"->>'generator' = 'rule-fallback'
                OR cq."generation_metadata"->>'sourceKind' ILIKE '%smoke%'
                OR cq."generation_metadata"->>'generationSource' ILIKE '%smoke%'
                OR cq."generation_metadata"->>'generationMode' ILIKE '%smoke%'
                OR cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
                OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
                OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
                OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
                OR cq."review_metadata"->'mockExamApproval'->>'status' IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
              )
            )
          )
      ),
      daily_question_state AS (
        SELECT DISTINCT
          attempts."day",
          attempts."questionId",
          metric."needs_review" AS "needsReview",
          metric."review_reason" AS "reviewReason",
          cq."review_metadata"->'qualityGovernance' AS "qualityGovernance",
          metric."correct_rate" AS "metricCorrectRate",
          metric."attempt_count" AS "metricAttemptCount"
        FROM ai_attempts attempts
        JOIN "csca_questions" cq ON cq."id" = attempts."questionId"
        LEFT JOIN "csca_question_quality_metrics" metric ON metric."question_id" = attempts."questionId"
      )
      SELECT
        attempts."day",
        attempts."subject",
        COUNT(*)::int AS "attemptCount",
        COUNT(*) FILTER (WHERE attempts."isCorrect" = true)::int AS "correctCount",
        COUNT(*) FILTER (WHERE attempts."isCorrect" IS NULL)::int AS "unansweredCount",
        COUNT(DISTINCT attempts."questionId")::int AS "uniqueQuestionCount",
        COUNT(DISTINCT state."questionId") FILTER (WHERE state."needsReview" = true)::int AS "needsReviewCount",
        COUNT(DISTINCT state."questionId") FILTER (
          WHERE state."metricAttemptCount" >= 20
            AND (state."metricCorrectRate" <= 0.25 OR state."metricCorrectRate" >= 0.95 OR state."reviewReason" IN ('weak_variant_effect', 'high_exposure_anomaly'))
        )::int AS "highSeverityCount",
        COUNT(DISTINCT state."questionId") FILTER (WHERE state."qualityGovernance"->>'status' = 'assigned')::int AS "assignedReviewCount",
        COUNT(DISTINCT state."questionId") FILTER (WHERE state."qualityGovernance"->>'disposition' = 'regenerate')::int AS "regenerationRequiredCount"
      FROM ai_attempts attempts
      LEFT JOIN daily_question_state state ON state."day" = attempts."day" AND state."questionId" = attempts."questionId"
      GROUP BY attempts."day", attempts."subject"
      ORDER BY attempts."day" ASC, attempts."subject" ASC
    `);

    const byDay = rows.map((row) => {
      const attemptCount = Number(row.attemptCount);
      const correctCount = Number(row.correctCount);
      const unansweredCount = Number(row.unansweredCount);
      return {
        day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
        subject: row.subject,
        attemptCount,
        uniqueQuestionCount: Number(row.uniqueQuestionCount),
        correctRate: attemptCount ? correctCount / attemptCount : null,
        unansweredRate: attemptCount ? unansweredCount / attemptCount : null,
        needsReviewCount: Number(row.needsReviewCount),
        highSeverityCount: Number(row.highSeverityCount),
        assignedReviewCount: Number(row.assignedReviewCount),
        regenerationRequiredCount: Number(row.regenerationRequiredCount)
      };
    });

    const bySubject = new Map<string, {
      subject: string;
      attemptCount: number;
      uniqueQuestionCount: number;
      correctCount: number;
      unansweredCount: number;
      needsReviewCount: number;
      highSeverityCount: number;
      assignedReviewCount: number;
      regenerationRequiredCount: number;
    }>();
    for (const row of rows) {
      const bucket = bySubject.get(row.subject) ?? {
        subject: row.subject,
        attemptCount: 0,
        uniqueQuestionCount: 0,
        correctCount: 0,
        unansweredCount: 0,
        needsReviewCount: 0,
        highSeverityCount: 0,
        assignedReviewCount: 0,
        regenerationRequiredCount: 0
      };
      bucket.attemptCount += Number(row.attemptCount);
      bucket.uniqueQuestionCount += Number(row.uniqueQuestionCount);
      bucket.correctCount += Number(row.correctCount);
      bucket.unansweredCount += Number(row.unansweredCount);
      bucket.needsReviewCount += Number(row.needsReviewCount);
      bucket.highSeverityCount += Number(row.highSeverityCount);
      bucket.assignedReviewCount += Number(row.assignedReviewCount);
      bucket.regenerationRequiredCount += Number(row.regenerationRequiredCount);
      bySubject.set(row.subject, bucket);
    }

    const subjects = Array.from(bySubject.values()).map((bucket) => ({
      subject: bucket.subject,
      attemptCount: bucket.attemptCount,
      uniqueQuestionCount: bucket.uniqueQuestionCount,
      correctRate: bucket.attemptCount ? bucket.correctCount / bucket.attemptCount : null,
      unansweredRate: bucket.attemptCount ? bucket.unansweredCount / bucket.attemptCount : null,
      needsReviewCount: bucket.needsReviewCount,
      highSeverityCount: bucket.highSeverityCount,
      assignedReviewCount: bucket.assignedReviewCount,
      regenerationRequiredCount: bucket.regenerationRequiredCount
    })).sort((a, b) => b.highSeverityCount - a.highSeverityCount || b.needsReviewCount - a.needsReviewCount || b.attemptCount - a.attemptCount);

    return {
      days,
      subject: query.subject ?? null,
      summary: {
        attemptCount: subjects.reduce((sum, item) => sum + item.attemptCount, 0),
        uniqueQuestionCount: subjects.reduce((sum, item) => sum + item.uniqueQuestionCount, 0),
        needsReviewCount: subjects.reduce((sum, item) => sum + item.needsReviewCount, 0),
        highSeverityCount: subjects.reduce((sum, item) => sum + item.highSeverityCount, 0),
        assignedReviewCount: subjects.reduce((sum, item) => sum + item.assignedReviewCount, 0),
        regenerationRequiredCount: subjects.reduce((sum, item) => sum + item.regenerationRequiredCount, 0)
      },
      byDay,
      bySubject: subjects
    };
  }

  async bulkAction(body: Record<string, unknown> = {}) {
    const action = cleanText(body.action);
    if (!['send_to_review', 'resolve', 'archive', 'manual_fix', 'reduce_exposure', 'regenerate'].includes(action)) {
      throw new BadRequestException('批量质量动作只能是 send_to_review/resolve/archive/manual_fix/reduce_exposure/regenerate。');
    }
    const subject = cleanText(body.subject) || undefined;
    const requestedUseCase = cleanText(body.useCase);
    const useCase = requestedUseCase === 'subject_practice' || requestedUseCase === 'online_mock_exam' ? requestedUseCase : undefined;
    const reason = cleanText(body.reason) || undefined;
    const recommendedAction = cleanText(body.recommendedAction) || undefined;
    const limit = clampLimit(body.limit, 10, action === 'regenerate' ? 10 : 30);
    const questionIds = Array.isArray(body.questionIds)
      ? Array.from(new Set(body.questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))).slice(0, limit)
      : null;
    const allMetrics = await this.listMetrics({ subject, useCase, questionIds: questionIds ?? undefined });
    const selected = allMetrics
      .filter((metric) => {
        if (questionIds && !questionIds.includes(metric.questionId)) return false;
        if (reason && !(metric.qualitySummary?.reasons ?? [metric.reviewReason]).includes(reason)) return false;
        if (recommendedAction && metric.qualitySummary?.recommendedAction !== recommendedAction) return false;
        return true;
      })
      .slice(0, limit);
    const disposition = action === 'archive' || action === 'manual_fix' || action === 'reduce_exposure' || action === 'regenerate'
      ? action
      : null;
    const items: unknown[] = [];
    const errors: Array<{ id: number; message: string }> = [];
    for (const metric of selected) {
      try {
        if (action === 'send_to_review') {
          items.push(await this.sendMetricToReview(metric.questionId, {
            reason: reason || metric.reviewReason || 'bulk_quality_review'
          }));
        } else if (action === 'resolve') {
          items.push(await this.resolveMetric(metric.questionId, { note: 'bulk_quality_resolved' }));
        } else if (disposition) {
          items.push(await this.applyDisposition(metric.questionId, {
            disposition,
            note: `bulk_quality_${disposition}`
          }));
        }
      } catch (error) {
        errors.push({ id: metric.questionId, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      action,
      requested: selected.length,
      succeeded: items.length,
      failed: errors.length,
      filters: {
        subject: subject ?? null,
        useCase: useCase ?? null,
        reason: reason ?? null,
        recommendedAction: recommendedAction ?? null,
        questionIds: questionIds ?? null,
        limit
      },
      items,
      errors
    };
  }

  private async createReplacementCandidate(questionId: number, note: string) {
    const [source] = await this.prisma.$queryRaw<Array<{
      id: number;
      subject: string;
      topicId: number;
      blueprintId: number | null;
      designedDifficulty: string;
      questionType: string;
      prompt: string;
      options: unknown;
      correctAnswer: string;
      explanation: string;
      knowledgeTags: unknown;
      optionMetadata: unknown;
      syllabusVersion: string;
    }>>(Prisma.sql`
      SELECT q."id", q."subject", q."topic_id" AS "topicId", q."blueprint_id" AS "blueprintId",
             q."designed_difficulty" AS "designedDifficulty", q."question_type" AS "questionType",
             q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
             q."knowledge_tags" AS "knowledgeTags", q."option_metadata" AS "optionMetadata",
             t."syllabus_version" AS "syllabusVersion"
      FROM "csca_questions" q
      JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
      WHERE q."id" = ${questionId}
      LIMIT 1
    `);
    if (!source) throw new NotFoundException('题目不存在，不能重生成替代题。');
    const existing = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id"
      FROM "csca_questions"
      WHERE "generated_variant_of" = ${questionId}
        AND "generation_metadata" @> ${JSON.stringify({ purpose: 'quality_replacement' })}::jsonb
        AND "status" NOT IN ('rejected', 'archived')
      ORDER BY "created_at" DESC, "id" DESC
      LIMIT 1
    `);
    if (existing[0]) return existing[0].id;

    const [replacement] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "csca_questions" (
        "subject", "topic_id", "blueprint_id", "source_type", "generated_variant_of",
        "designed_difficulty", "question_type", "prompt", "options", "correct_answer",
        "explanation", "knowledge_tags", "option_metadata", "syllabus_version",
        "generation_metadata", "review_metadata", "status", "updated_at"
      )
      VALUES (
        ${source.subject}, ${source.topicId}, ${source.blueprintId}, 'ai', ${questionId},
        ${source.designedDifficulty}, ${source.questionType},
        ${`Replacement draft for quality review: ${source.prompt}`.slice(0, 4000)},
        ${JSON.stringify(source.options)}::jsonb,
        ${source.correctAnswer},
        ${`${source.explanation}\n\nQuality replacement draft created after admin requested regeneration. Review correctness, uniqueness, syllabus fit, and option metadata before approval.`},
        ${JSON.stringify(source.knowledgeTags)}::jsonb,
        ${JSON.stringify(source.optionMetadata)}::jsonb,
        ${source.syllabusVersion},
        ${JSON.stringify({
          purpose: 'quality_replacement',
          generator: 'quality-governance',
          model: 'local-replacement-draft-v1',
          sourceQuestionId: questionId,
          note,
          createdAt: new Date().toISOString()
        })}::jsonb,
        ${JSON.stringify({
          status: 'needs_review',
          issues: [{ code: 'replacement_requires_human_review', severity: 'warning', message: 'Replacement draft must pass the quality gate before publication.' }],
          dimensions: [],
          sources: ['deterministic'],
          checkedAt: new Date().toISOString()
        })}::jsonb,
        'pending_review',
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);
    return replacement.id;
  }

  async refreshForSpecialPracticeQuestionIds(questionIds: number[]) {
    const ids = Array.from(new Set(questionIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return { refreshed: 0, items: [] };

    const rows = await this.prisma.$queryRaw<Array<{ questionId: number }>>(Prisma.sql`
      SELECT cq."id" AS "questionId"
      FROM "csca_questions" cq
      JOIN "special_practice_questions" spq ON spq."id" = cq."source_question_id"
      WHERE cq."source_type" = 'ai'
        AND cq."status" = 'approved'
        AND cq."source_question_id" IN (${Prisma.join(ids)})
        AND spq."status" = 'published'
        AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
        AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
        AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
        AND NOT (
          COALESCE(cq."generation_metadata"->>'fallbackUsed', '') = 'true'
          OR COALESCE(cq."generation_metadata"->>'generator', '') = 'rule-fallback'
          OR COALESCE(cq."generation_metadata"->>'sourceKind', '') ILIKE '%smoke%'
          OR COALESCE(cq."generation_metadata"->>'generationSource', '') ILIKE '%smoke%'
          OR COALESCE(cq."generation_metadata"->>'generationMode', '') ILIKE '%smoke%'
          OR COALESCE(cq."generation_metadata"->>'sourceKind', '') = 'mock_exam_blueprint_slot'
          OR COALESCE(cq."generation_metadata"->>'generationSource', '') = 'mock_exam_blueprint_slot'
          OR COALESCE(cq."generation_metadata"->>'generationMode', '') LIKE 'online_mock%'
          OR COALESCE(cq."generation_metadata"->'mockExamSlot'->>'slotId', '') <> ''
          OR COALESCE(cq."review_metadata"->'mockExamApproval'->>'status', '') IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
        )
    `);
    return this.refreshUnifiedQuestionMetrics(rows.map((row) => row.questionId), { useCase: 'subject_practice' });
  }

  async refreshForCscaQuestionIds(questionIds: number[]) {
    const ids = Array.from(new Set(questionIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return { refreshed: 0, items: [] };
    return this.refreshUnifiedQuestionMetrics(ids);
  }

  private async refreshUnifiedQuestionMetrics(questionIds: number[], listQuery: { subject?: string; useCase?: string } = {}) {
    const ids = Array.from(new Set(questionIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return { refreshed: 0, items: [] };

    const aggregates = await this.prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
      SELECT
        cq."id" AS "questionId",
        cq."source_question_id" AS "sourceQuestionId",
        cq."generated_variant_of" AS "generatedVariantOf",
        cq."status" AS "questionStatus",
        cq."subject",
        cq."topic_id" AS "topicId",
        cq."designed_difficulty" AS "designedDifficulty",
        COUNT(item."id") AS "attemptCount",
        AVG(CASE WHEN item."is_correct" = true THEN 1.0 ELSE 0.0 END)::float AS "correctRate",
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY item."time_spent_seconds")::int AS "medianSeconds",
        AVG(CASE WHEN item."is_correct" IS NULL THEN 1.0 ELSE 0.0 END)::float AS "unansweredRate"
      FROM "csca_questions" cq
      JOIN "csca_adaptive_round_items" item ON (
        (item."question_source" = 'csca_question' AND item."question_id" = cq."id")
        OR (
          COALESCE(item."question_source", 'special_practice') = 'special_practice'
          AND cq."source_question_id" IS NOT NULL
          AND item."question_id" = cq."source_question_id"
        )
      )
      JOIN "csca_adaptive_rounds" round ON round."id" = item."round_id"
      WHERE cq."id" IN (${Prisma.join(ids)})
        AND round."status" = 'submitted'
      GROUP BY cq."id", cq."source_question_id", cq."generated_variant_of", cq."subject", cq."topic_id", cq."designed_difficulty"
    `);

    const refreshedIds: number[] = [];
    for (const aggregate of aggregates) {
      const optionSelectionStats = await this.optionSelectionStats(aggregate.questionId);
      const attemptCount = Number(aggregate.attemptCount);
      const correctRate = aggregate.correctRate === null ? null : Number(Number(aggregate.correctRate).toFixed(4));
      const unansweredRate = aggregate.unansweredRate === null ? null : Number(Number(aggregate.unansweredRate).toFixed(4));
      const empiricalDifficulty = empiricalDifficultyFromRate(correctRate);
      const difficultyConfidence = Number(Math.min(1, attemptCount / 50).toFixed(4));
      const baseReviewReason = reviewReasonForMetric({
        attemptCount,
        designedDifficulty: aggregate.designedDifficulty,
        empiricalDifficulty,
        correctRate,
        unansweredRate,
        isVariant: Boolean(aggregate.generatedVariantOf)
      });
      const reviewReason = reviewReasonWithOptionQuality(baseReviewReason, optionSelectionStats.stats);

      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "csca_question_quality_metrics" (
          "question_id", "attempt_count", "correct_rate", "median_seconds", "unanswered_rate",
          "marked_rate", "option_selection_stats", "most_selected_wrong_option",
          "empirical_difficulty", "difficulty_confidence", "needs_review",
          "review_reason", "updated_at"
        )
        VALUES (
          ${aggregate.questionId}, ${attemptCount}, ${correctRate}, ${aggregate.medianSeconds},
          ${unansweredRate}, 0, ${JSON.stringify(optionSelectionStats.stats)}::jsonb,
          ${optionSelectionStats.mostSelectedWrongOption}, ${empiricalDifficulty}, ${difficultyConfidence},
          ${Boolean(reviewReason)}, ${reviewReason}, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("question_id") DO UPDATE SET
          "attempt_count" = EXCLUDED."attempt_count",
          "correct_rate" = EXCLUDED."correct_rate",
          "median_seconds" = EXCLUDED."median_seconds",
          "unanswered_rate" = EXCLUDED."unanswered_rate",
          "marked_rate" = EXCLUDED."marked_rate",
          "option_selection_stats" = EXCLUDED."option_selection_stats",
          "most_selected_wrong_option" = EXCLUDED."most_selected_wrong_option",
          "empirical_difficulty" = EXCLUDED."empirical_difficulty",
          "difficulty_confidence" = EXCLUDED."difficulty_confidence",
          "needs_review" = EXCLUDED."needs_review",
          "review_reason" = EXCLUDED."review_reason",
          "updated_at" = CURRENT_TIMESTAMP
      `);
      await this.refreshOptionMetadataEvidence(aggregate.questionId, optionSelectionStats.stats, attemptCount);
      await this.upsertMisconceptionsFromOptionStats(aggregate.questionId, optionSelectionStats.stats);
      await this.ensureConceptCardAndVariantCandidate({
        questionId: aggregate.questionId,
        subject: aggregate.subject,
        topicId: aggregate.topicId,
        designedDifficulty: aggregate.designedDifficulty,
        stats: optionSelectionStats.stats,
        attemptCount
      });
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "csca_questions"
        SET "empirical_difficulty" = ${empiricalDifficulty},
            "difficulty_confidence" = ${difficultyConfidence},
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${aggregate.questionId}
      `);
      refreshedIds.push(aggregate.questionId);
    }

    const items = refreshedIds.length ? await this.listMetrics({ questionIds: refreshedIds, ...listQuery }) : [];
    return { refreshed: refreshedIds.length, items };
  }

  async refreshAll(query: { subject?: string; useCase?: string } = {}) {
    const subject = cleanText(query.subject) || undefined;
    const requestedUseCase = cleanText(query.useCase);
    const useCase = requestedUseCase === 'subject_practice' || requestedUseCase === 'online_mock_exam' ? requestedUseCase : undefined;
    const rows = await this.prisma.$queryRaw<Array<{ questionId: number }>>(Prisma.sql`
      SELECT DISTINCT cq."id" AS "questionId"
      FROM "csca_questions" cq
      JOIN "csca_adaptive_round_items" item ON (
        (item."question_source" = 'csca_question' AND item."question_id" = cq."id")
        OR (
          COALESCE(item."question_source", 'special_practice') = 'special_practice'
          AND cq."source_question_id" IS NOT NULL
          AND item."question_id" = cq."source_question_id"
        )
      )
      JOIN "csca_adaptive_rounds" round ON round."id" = item."round_id"
      LEFT JOIN "special_practice_questions" spq ON spq."id" = cq."source_question_id"
      WHERE round."status" = 'submitted'
        AND (${subject || null}::text IS NULL OR cq."subject" = ${subject || null})
        AND (
          ${useCase || null}::text IS NULL
          OR (
            ${useCase || null} = 'online_mock_exam'
            AND (
              cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
              OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
              OR cq."review_metadata"->'mockExamApproval'->>'status' IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
            )
          )
          OR (
            ${useCase || null} = 'subject_practice'
            AND cq."source_type" = 'ai'
            AND cq."source_question_id" IS NOT NULL
            AND spq."status" = 'published'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
            AND NOT (
              cq."generation_metadata"->>'fallbackUsed' = 'true'
              OR cq."generation_metadata"->>'generator' = 'rule-fallback'
              OR cq."generation_metadata"->>'sourceKind' ILIKE '%smoke%'
              OR cq."generation_metadata"->>'generationSource' ILIKE '%smoke%'
              OR cq."generation_metadata"->>'generationMode' ILIKE '%smoke%'
              OR cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
              OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
              OR cq."review_metadata"->'mockExamApproval'->>'status' IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
            )
          )
        )
    `);
    return this.refreshUnifiedQuestionMetrics(rows.map((row) => row.questionId), { subject, useCase });
  }

  async listMetrics(query: {
    subject?: string;
    needsReview?: boolean;
    questionIds?: number[];
    assignedTo?: number | null;
    unassigned?: boolean;
    reviewReason?: string;
    recommendedAction?: string;
    severity?: 'low' | 'medium' | 'high' | string;
    useCase?: string;
    limit?: number;
  } = {}) {
    const questionIds = query.questionIds?.length ? query.questionIds : null;
    const limit = clampLimit(query.limit, 100, 200);
    const rows = await this.prisma.$queryRaw<QualityMetricRow[]>(Prisma.sql`
      SELECT
        cq."id" AS "questionId",
        cq."source_question_id" AS "sourceQuestionId",
        cq."generated_variant_of" AS "generatedVariantOf",
        cq."status" AS "questionStatus",
        cq."subject",
        cq."topic_id" AS "topicId",
        cq."designed_difficulty" AS "designedDifficulty",
        metric."empirical_difficulty" AS "empiricalDifficulty",
        metric."difficulty_confidence" AS "difficultyConfidence",
        metric."attempt_count" AS "attemptCount",
        metric."correct_rate" AS "correctRate",
        metric."median_seconds" AS "medianSeconds",
        metric."unanswered_rate" AS "unansweredRate",
        metric."marked_rate" AS "markedRate",
        metric."option_selection_stats" AS "optionSelectionStats",
        metric."most_selected_wrong_option" AS "mostSelectedWrongOption",
        metric."needs_review" AS "needsReview",
        metric."review_reason" AS "reviewReason",
        cq."review_metadata"->'qualityGovernance' AS "qualityGovernance",
        replacement."status" AS "replacementCandidateStatus",
        metric."updated_at" AS "updatedAt"
      FROM "csca_question_quality_metrics" metric
      JOIN "csca_questions" cq ON cq."id" = metric."question_id"
      LEFT JOIN "csca_questions" replacement ON replacement."id" = CASE
        WHEN cq."review_metadata"->'qualityGovernance'->>'replacementQuestionId' ~ '^[0-9]+$'
        THEN (cq."review_metadata"->'qualityGovernance'->>'replacementQuestionId')::int
        ELSE NULL
      END
      LEFT JOIN "special_practice_questions" spq ON spq."id" = cq."source_question_id"
      WHERE (${query.subject || null}::text IS NULL OR cq."subject" = ${query.subject || null})
        AND (
          ${query.useCase || null}::text IS NULL
          OR (
            ${query.useCase || null} = 'online_mock_exam'
            AND (
              cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
              OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
            )
          )
          OR (
            ${query.useCase || null} = 'subject_practice'
            AND cq."source_type" = 'ai'
            AND cq."source_question_id" IS NOT NULL
            AND spq."status" = 'published'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
            AND cq."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
            AND NOT (
              cq."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
              OR cq."generation_metadata"->>'generationMode' LIKE 'online_mock%'
              OR cq."generation_metadata"->'mockExamSlot'->>'slotId' IS NOT NULL
            )
          )
        )
        AND (${query.needsReview === undefined ? null : query.needsReview}::boolean IS NULL OR metric."needs_review" = ${query.needsReview === undefined ? null : query.needsReview})
        AND (${query.reviewReason || null}::text IS NULL OR metric."review_reason" = ${query.reviewReason || null})
        AND (${query.assignedTo ?? null}::int IS NULL OR (cq."review_metadata"->'qualityGovernance'->>'assignedTo')::int = ${query.assignedTo ?? null})
        AND (${query.unassigned === undefined ? null : query.unassigned}::boolean IS NULL OR (
          ${query.unassigned === undefined ? null : query.unassigned}::boolean = false
          OR cq."review_metadata"->'qualityGovernance'->>'assignedTo' IS NULL
        ))
        AND (${questionIds ? Prisma.sql`cq."id" IN (${Prisma.join(questionIds)})` : Prisma.sql`true`})
      ORDER BY metric."needs_review" DESC, metric."attempt_count" DESC, metric."updated_at" DESC
      LIMIT ${limit}
    `);
    return rows
      .map(mapMetric)
      .filter((metric) => !query.severity || metric.qualitySummary?.severity === query.severity)
      .filter((metric) => !query.recommendedAction || metric.qualitySummary?.recommendedAction === query.recommendedAction);
  }

  private async optionSelectionStats(questionId: number) {
    const rows = await this.prisma.$queryRaw<OptionSelectionRow[]>(Prisma.sql`
      SELECT
        cq."id" AS "questionId",
        cq."correct_answer" AS "correctAnswer",
        cq."option_metadata" AS "optionMetadata",
        cq."subject",
        cq."topic_id" AS "topicId",
        item."selected_answer" AS "selectedAnswer",
        COUNT(item."id") AS "count"
      FROM "csca_questions" cq
      JOIN "csca_adaptive_round_items" item ON (
        (item."question_source" = 'csca_question' AND item."question_id" = cq."id")
        OR (
          COALESCE(item."question_source", 'special_practice') = 'special_practice'
          AND cq."source_question_id" IS NOT NULL
          AND item."question_id" = cq."source_question_id"
        )
      )
      JOIN "csca_adaptive_rounds" round ON round."id" = item."round_id"
      WHERE cq."id" = ${questionId}
        AND round."status" = 'submitted'
      GROUP BY cq."id", cq."correct_answer", cq."option_metadata", cq."subject", cq."topic_id", item."selected_answer"
    `);
    const attemptCount = rows.reduce((sum, row) => sum + Number(row.count), 0);
    const wrongAttemptCount = rows
      .filter((row) => row.selectedAnswer && row.selectedAnswer !== row.correctAnswer)
      .reduce((sum, row) => sum + Number(row.count), 0);
    const metadata = optionMetadataItems(rows[0]?.optionMetadata);
    const metadataByOption = new Map(metadata.map((item) => [item.optionId, item]));
    const stats = rows.map((row) => {
      const optionId = row.selectedAnswer || '__unanswered__';
      const count = Number(row.count);
      const isCorrectOption = Boolean(row.selectedAnswer && row.selectedAnswer === row.correctAnswer);
      const optionMetadata = metadataByOption.get(optionId);
      const wrongSelectionRate = !isCorrectOption && optionId !== '__unanswered__' && wrongAttemptCount > 0
        ? Number((count / wrongAttemptCount).toFixed(4))
        : 0;
      return {
        optionId,
        count,
        selectionRate: attemptCount > 0 ? Number((count / attemptCount).toFixed(4)) : 0,
        wrongSelectionRate,
        isCorrectOption,
        distractorIntent: optionMetadata?.distractorIntent ?? null,
        misconceptionTags: optionMetadata?.misconceptionTags ?? [],
        qualitySignal: optionQualitySignal({
          isCorrectOption,
          wrongSelectionRate,
          count,
          attemptCount,
          hasMetadata: Boolean(optionMetadata?.distractorIntent && optionMetadata.misconceptionTags?.length)
        })
      };
    }).sort((a, b) => b.count - a.count || a.optionId.localeCompare(b.optionId));
    const mostSelectedWrong = stats.find((item) => item.optionId !== '__unanswered__' && !item.isCorrectOption);
    return {
      stats,
      mostSelectedWrongOption: mostSelectedWrong?.optionId ?? null
    };
  }

  private async refreshOptionMetadataEvidence(questionId: number, stats: Array<{
    optionId: string;
    count: number;
    selectionRate: number;
    wrongSelectionRate: number;
    qualitySignal: string;
  }>, attemptCount: number) {
    const rows = await this.prisma.$queryRaw<Array<{ optionMetadata: unknown }>>(Prisma.sql`
      SELECT "option_metadata" AS "optionMetadata"
      FROM "csca_questions"
      WHERE "id" = ${questionId}
      LIMIT 1
    `);
    const metadata = optionMetadataItems(rows[0]?.optionMetadata);
    if (!metadata.length) return;
    const statsByOption = new Map(stats.map((item) => [item.optionId, item]));
    const updated = metadata.map((item) => {
      const stat = statsByOption.get(item.optionId);
      if (!stat) return item;
      return {
        ...item,
        evidence: {
          ...(item.evidence ?? {}),
          attemptCount,
          selectedCount: stat.count,
          selectionRate: stat.selectionRate,
          wrongSelectionRate: stat.wrongSelectionRate,
          qualitySignal: stat.qualitySignal,
          updatedAt: new Date().toISOString()
        }
      };
    });
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_questions"
      SET "option_metadata" = ${JSON.stringify(updated)}::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
    `);
  }

  private async upsertMisconceptionsFromOptionStats(questionId: number, stats: Array<{
    optionId: string;
    misconceptionTags: string[];
  }>) {
    const rows = await this.prisma.$queryRaw<Array<{ subject: string; topicId: number }>>(Prisma.sql`
      SELECT "subject", "topic_id" AS "topicId"
      FROM "csca_questions"
      WHERE "id" = ${questionId}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return;
    const tags = Array.from(new Set(stats.flatMap((item) => item.misconceptionTags ?? []).map((tag) => cleanText(tag)).filter(Boolean)));
    for (const tag of tags) {
      const slug = `${cleanSlug(row.subject)}-${row.topicId}-${cleanSlug(tag)}`;
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "csca_question_misconceptions" ("slug", "subject", "topic_id", "label", "description", "status", "updated_at")
        VALUES (${slug}, ${row.subject}, ${row.topicId}, ${tag}, 'Observed from AI question option metadata and student answer distribution.', 'active', CURRENT_TIMESTAMP)
        ON CONFLICT ("slug") DO UPDATE SET
          "label" = EXCLUDED."label",
          "description" = COALESCE("csca_question_misconceptions"."description", EXCLUDED."description"),
          "status" = 'active',
          "updated_at" = CURRENT_TIMESTAMP
      `);
    }
  }

  private async ensureConceptCardAndVariantCandidate(input: {
    questionId: number;
    subject: string;
    topicId: number;
    designedDifficulty: string;
    stats: Array<{
      optionId: string;
      count: number;
      wrongSelectionRate: number;
      distractorIntent: string | null;
      misconceptionTags: string[];
      qualitySignal: string;
    }>;
    attemptCount: number;
  }) {
    const trigger = input.stats.find((item) => {
      return item.optionId !== '__unanswered__'
        && !['correct_option', 'unused_distractor'].includes(item.qualitySignal)
        && item.misconceptionTags.length
        && input.attemptCount >= 5
        && (item.qualitySignal === 'dominant_distractor' || item.wrongSelectionRate >= 0.5 || item.count >= 3);
    });
    const tag = trigger?.misconceptionTags[0];
    if (!trigger || !tag) return;

    const [misconception] = await this.prisma.$queryRaw<Array<{ id: number; label: string }>>(Prisma.sql`
      SELECT "id", "label"
      FROM "csca_question_misconceptions"
      WHERE "slug" = ${`${cleanSlug(input.subject)}-${input.topicId}-${cleanSlug(tag)}`}
      LIMIT 1
    `);
    if (!misconception) return;

    const [topic] = await this.prisma.$queryRaw<Array<{ title: string; syllabusVersion: string }>>(Prisma.sql`
      SELECT "title", "syllabus_version" AS "syllabusVersion"
      FROM "csca_exam_topics"
      WHERE "id" = ${input.topicId}
      LIMIT 1
    `);
    if (!topic) return;

    const [card] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "csca_concept_cards" (
        "topic_id", "misconception_id", "title", "body", "example_json", "status", "source", "review_metadata", "updated_at"
      )
      SELECT
        ${input.topicId},
        ${misconception.id},
        ${`${topic.title}: ${misconception.label}`.slice(0, 200)},
        ${`This concept card draft was created because many learners selected option ${trigger.optionId}, which is linked to "${misconception.label}". Review the core definition, then compare it with the distractor intent before retrying a variant question.`},
        ${JSON.stringify({
          sourceQuestionId: input.questionId,
          sourceOptionId: trigger.optionId,
          distractorIntent: trigger.distractorIntent,
          wrongSelectionRate: trigger.wrongSelectionRate,
          selectedCount: trigger.count
        })}::jsonb,
        'draft',
        'quality_feedback',
        ${JSON.stringify({
          reason: 'dominant_misconception',
          createdBy: 'question_quality_refresh',
          sourceQuestionId: input.questionId,
          sourceOptionId: trigger.optionId,
          checkedAt: new Date().toISOString()
        })}::jsonb,
        CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1
        FROM "csca_concept_cards"
        WHERE "topic_id" = ${input.topicId}
          AND "misconception_id" = ${misconception.id}
          AND "source" = 'quality_feedback'
      )
      RETURNING "id"
    `);
    const existingCards = card ? [card] : await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id"
      FROM "csca_concept_cards"
      WHERE "topic_id" = ${input.topicId}
        AND "misconception_id" = ${misconception.id}
        AND "source" = 'quality_feedback'
      ORDER BY "updated_at" DESC
      LIMIT 1
    `);
    const conceptCardId = existingCards[0]?.id ?? null;

    const constraints = {
      purpose: 'variant_after_concept_card',
      originalQuestionId: input.questionId,
      sourceOptionId: trigger.optionId,
      misconceptionTag: tag,
      conceptCardId
    };
    const [blueprint] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "csca_question_blueprints" ("subject", "topic_id", "difficulty", "question_type", "skill", "source", "constraints", "status", "updated_at")
      SELECT ${input.subject}, ${input.topicId}, ${input.designedDifficulty}, 'single_choice',
             ${`variant:${tag}`}, 'misconception_variant', ${JSON.stringify(constraints)}::jsonb, 'active', CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM "csca_question_blueprints"
        WHERE "topic_id" = ${input.topicId}
          AND "source" = 'misconception_variant'
          AND "constraints" @> ${JSON.stringify({ originalQuestionId: input.questionId, misconceptionTag: tag })}::jsonb
      )
      RETURNING "id"
    `);
    const blueprintId = blueprint?.id ?? (await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id"
      FROM "csca_question_blueprints"
      WHERE "topic_id" = ${input.topicId}
        AND "source" = 'misconception_variant'
        AND "constraints" @> ${JSON.stringify({ originalQuestionId: input.questionId, misconceptionTag: tag })}::jsonb
      ORDER BY "updated_at" DESC
      LIMIT 1
    `))[0]?.id;
    if (!blueprintId) return;

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "csca_questions" (
        "subject", "topic_id", "blueprint_id", "source_type", "generated_variant_of",
        "designed_difficulty", "question_type", "prompt", "options", "correct_answer",
        "explanation", "knowledge_tags", "option_metadata", "syllabus_version",
        "generation_metadata", "review_metadata", "status", "updated_at"
      )
      SELECT
        ${input.subject}, ${input.topicId}, ${blueprintId}, 'ai', ${input.questionId},
        ${input.designedDifficulty}, 'single_choice',
        ${`After reviewing "${misconception.label}", which choice best avoids that mistake in ${topic.title}?`},
        ${JSON.stringify([
          { id: 'A', text: `State the target condition first, then apply it consistently.` },
          { id: 'B', text: trigger.distractorIntent || `Repeat the misconception: ${misconception.label}.` },
          { id: 'C', text: `Change the target quantity before checking the condition.` },
          { id: 'D', text: `Use an unrelated comparison instead of the definition.` }
        ])}::jsonb,
        'A',
        ${`The correct answer is A because it repairs the misconception "${misconception.label}" by naming the target condition before applying the rule. This variant is a draft and must pass the quality gate before publication.`},
        ${JSON.stringify([cleanSlug(tag), 'variant-practice'])}::jsonb,
        ${JSON.stringify([
          { optionId: 'B', distractorIntent: trigger.distractorIntent || `Repeats ${misconception.label}.`, misconceptionTags: [tag] },
          { optionId: 'C', distractorIntent: 'Confuses the target quantity.', misconceptionTags: ['target-confusion'] },
          { optionId: 'D', distractorIntent: 'Uses unrelated comparison.', misconceptionTags: ['irrelevant-comparison'] }
        ])}::jsonb,
        ${topic.syllabusVersion},
        ${JSON.stringify({
          generator: 'quality-feedback',
          model: 'local-variant-draft-v1',
          status: 'draft_created',
          originalQuestionId: input.questionId,
          conceptCardId
        })}::jsonb,
        ${JSON.stringify({
          status: 'needs_review',
          issues: [{ code: 'variant_requires_human_review', severity: 'warning', message: 'Variant draft must pass the quality gate before publication.' }],
          dimensions: [],
          sources: ['deterministic'],
          checkedAt: new Date().toISOString()
        })}::jsonb,
        'pending_review',
        CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM "csca_questions"
        WHERE "generated_variant_of" = ${input.questionId}
          AND "blueprint_id" = ${blueprintId}
          AND "status" NOT IN ('rejected', 'archived')
      )
    `);
  }
}
