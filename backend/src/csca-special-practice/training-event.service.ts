import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TrainingEventInput = {
  userId?: number | null;
  subject?: string | null;
  sessionId?: number | null;
  roundId?: number | null;
  questionId?: number | null;
  eventType: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

type TrainingEventQuery = {
  days?: string;
  from?: string;
  to?: string;
  eventType?: string;
  subject?: string;
};

type EventRow = Awaited<ReturnType<PrismaService['cscaTrainingEvent']['findMany']>>[number];
type CscaSubject = 'math' | 'physics' | 'chemistry';

const CSCA_SUBJECTS: CscaSubject[] = ['math', 'physics', 'chemistry'];
const DEFAULT_HIGH_DIFFICULTY_REQUIRED: Record<CscaSubject, number> = {
  math: 3,
  physics: 2,
  chemistry: 2
};
const HIGH_DIFFICULTY_DISTRIBUTION_SAMPLE_MIN = 8;
const SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function dateRange(query: TrainingEventQuery) {
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

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function aggregate(rows: EventRow[], keyOf: (row: EventRow) => string) {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataString(value: unknown, key: string) {
  const item = jsonRecord(value)[key];
  return typeof item === 'string' ? item.trim() : '';
}

function metadataNumber(value: unknown, key: string) {
  const item = Number(jsonRecord(value)[key]);
  return Number.isFinite(item) ? item : null;
}

function validCscaSubject(value: unknown): CscaSubject | null {
  return CSCA_SUBJECTS.includes(value as CscaSubject) ? value as CscaSubject : null;
}

function difficultyRank(value?: string | null) {
  const label = String(value ?? '').trim();
  if (label.includes('模考')) return 3;
  if (label.includes('挑战')) return 4;
  if (label.includes('较难') || label.includes('提高')) return 3;
  if (label.includes('中')) return 2;
  if (label.includes('基础')) return 1;
  return 0;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function highDifficultyOverride(subject: CscaSubject) {
  const parsed = Number.parseInt(String(process.env[`CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_${subject.toUpperCase()}`] ?? ''), 10);
  return Number.isFinite(parsed) ? clampInt(parsed, 1, 8) : null;
}

function sampledThresholdMaxImpactUserSubjects() {
  const parsed = Number.parseInt(String(process.env.CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS ?? ''), 10);
  return Number.isFinite(parsed) ? clampInt(parsed, 0, 1000) : SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS;
}

function metadataDimensions(value: unknown): Array<{ key: string; score: number; maxScore: number; status: string }> {
  const dimensions = jsonRecord(value).dimensions;
  if (!Array.isArray(dimensions)) return [];
  return dimensions.flatMap((item) => {
    const row = jsonRecord(item);
    const key = metadataString(row, 'key');
    const score = metadataNumber(row, 'score');
    const maxScore = metadataNumber(row, 'maxScore');
    const status = metadataString(row, 'status') || 'unknown';
    if (!key || score === null || maxScore === null) return [];
    return [{ key, score, maxScore, status }];
  });
}

function dateFromUnknown(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateInWindow(date: Date | null | undefined, start: Date, end: Date) {
  if (!date) return false;
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function recommendationStatus(input: { clickedCount: number; followThroughRate: number }) {
  if (input.clickedCount === 0) return 'no_data';
  if (input.clickedCount < 5) return 'watching';
  if (input.followThroughRate >= 0.45) return 'positive';
  if (input.followThroughRate < 0.25) return 'needs_calibration';
  return 'watching';
}

function evidenceHealthStatus(input: { sampleSize: number; averageScore: number | null; lowRate: number }) {
  if (input.sampleSize === 0) return 'no_data';
  if (input.sampleSize < 5) return 'watching';
  if ((input.averageScore ?? 0) >= 8 && input.lowRate <= 0.2) return 'healthy';
  if ((input.averageScore ?? 0) < 5 || input.lowRate >= 0.45) return 'needs_attention';
  return 'watching';
}

function isMissingPrismaRelation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2021' || error.code === 'P2022');
}

function firstMisconceptionTag(value: unknown) {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const record = jsonRecord(item);
    const tags = record.misconceptionTags;
    if (!Array.isArray(tags)) continue;
    const tag = tags.map((entry) => String(entry).trim()).find(Boolean);
    if (tag) return tag;
  }
  return '';
}

function variantHealthStatus(input: { attemptCount: number; accuracy: number | null }) {
  if (input.attemptCount === 0) return 'no_data';
  if (input.attemptCount < 3) return 'watching';
  if ((input.accuracy ?? 0) >= 0.6) return 'improving';
  if ((input.accuracy ?? 0) < 0.4) return 'needs_review';
  return 'mixed';
}

@Injectable()
export class TrainingEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: TrainingEventInput) {
    await this.prisma.cscaTrainingEvent.create({
      data: {
        userId: input.userId ?? null,
        subject: input.subject ?? null,
        sessionId: input.sessionId ?? null,
        roundId: input.roundId ?? null,
        questionId: input.questionId ?? null,
        eventType: input.eventType,
        source: input.source ?? 'adaptive',
        metadata: input.metadata ? input.metadata as Prisma.InputJsonValue : undefined
      }
    });
  }

  async getOverview(query: TrainingEventQuery = {}) {
    const { start, end } = dateRange(query);
    const rows = await this.prisma.cscaTrainingEvent.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        eventType: stringFilter(query.eventType),
        subject: stringFilter(query.subject)
      },
      orderBy: { createdAt: 'asc' }
    });
    const count = (eventType: string) => rows.filter((row) => row.eventType === eventType).length;
    const diagnosticStarted = count('diagnostic_round_started');
    const diagnosticCompleted = count('diagnostic_round_completed');
    const practiceStarted = count('practice_round_started');
    const practiceCompleted = count('practice_round_completed');
    const aiEvents = rows.filter((row) => row.eventType.startsWith('ai_')).length;
    const readinessActions = await this.readinessActionObservability(rows, start, end);
    const readinessEvidence = this.readinessEvidenceObservability(rows);
    const readinessDifficultyThresholds = await this.readinessDifficultyThresholdObservability(start, end);
    const readinessCalibrationHealth = await this.readinessCalibrationHealthObservability(
      readinessActions,
      readinessDifficultyThresholds
    );
    const readinessSampledThresholdRollout = this.readinessSampledThresholdRollout(
      readinessDifficultyThresholds,
      readinessCalibrationHealth
    );
    const conceptCardEffect = await this.conceptCardEffectObservability(rows);
    const variantEffect = await this.variantEffectObservability(rows);

    return {
      range: {
        from: start.toISOString(),
        to: end.toISOString()
      },
      filters: {
        eventType: stringFilter(query.eventType) ?? null,
        subject: stringFilter(query.subject) ?? null
      },
      summary: {
        totalEvents: rows.length,
        uniqueUsers: new Set(rows.map((row) => row.userId).filter((value): value is number => typeof value === 'number')).size,
        diagnosticStarted,
        diagnosticCompleted,
        diagnosticCompletionRate: diagnosticStarted ? Number((diagnosticCompleted / diagnosticStarted).toFixed(4)) : 0,
        practiceStarted,
        practiceCompleted,
        practiceCompletionRate: practiceStarted ? Number((practiceCompleted / practiceStarted).toFixed(4)) : 0,
        aiEvents
      },
      byDay: aggregate(rows, (row) => dayKey(row.createdAt)),
      byEventType: aggregate(rows, (row) => row.eventType),
      bySubject: aggregate(rows, (row) => row.subject ?? 'unknown'),
      readinessActions,
      readinessEvidence,
      readinessDifficultyThresholds,
      readinessCalibrationHealth,
      readinessSampledThresholdRollout,
      plannerAssistant: this.plannerAssistantObservability(rows),
      conceptCardEffect,
      variantEffect,
      recentEvents: rows.slice(-30).reverse().map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        subject: row.subject,
        sessionId: row.sessionId,
        roundId: row.roundId,
        questionId: row.questionId,
        eventType: row.eventType,
        source: row.source,
        metadata: row.metadata
      }))
    };
  }

  private async variantEffectObservability(rows: EventRow[]) {
    const practiceRows = rows.filter((row) => row.eventType === 'practice_round_completed');
    const candidateItemIds = Array.from(new Set(practiceRows.flatMap((row) => {
      const items = jsonRecord(row.metadata).items;
      if (!Array.isArray(items)) return [];
      return items.flatMap((item) => {
        const record = jsonRecord(item);
        const source = metadataString(record, 'questionSource') || 'special_practice';
        const questionId = metadataNumber(record, 'questionId');
        return source === 'csca_question' && questionId ? [questionId] : [];
      });
    })));
    const cscaQuestionRows = candidateItemIds.length ? await this.prisma.cscaQuestion.findMany({
      where: { id: { in: candidateItemIds } },
      select: {
        id: true,
        subject: true,
        topicId: true,
        generatedVariantOf: true,
        generationMetadata: true,
        optionMetadata: true,
        status: true
      }
    }) : [];
    const questionById = new Map(cscaQuestionRows.map((row) => [row.id, row]));
    const variantAttempts = practiceRows.flatMap((row) => {
      const items = jsonRecord(row.metadata).items;
      if (!Array.isArray(items)) return [];
      return items.flatMap((item) => {
        const record = jsonRecord(item);
        const questionId = metadataNumber(record, 'questionId');
        const questionSource = metadataString(record, 'questionSource') || 'special_practice';
        if (!questionId || questionSource !== 'csca_question') return [];
        const question = questionById.get(questionId);
        if (!question?.generatedVariantOf) return [];
        const generationMetadata = jsonRecord(question.generationMetadata);
        const misconceptionLabel = metadataString(generationMetadata, 'misconceptionTag')
          || metadataString(generationMetadata, 'misconceptionLabel')
          || firstMisconceptionTag(question.optionMetadata);
        return [{
          userId: row.userId,
          subject: question.subject ?? row.subject,
          topicId: question.topicId ?? metadataNumber(record, 'topicId'),
          roundId: row.roundId,
          variantQuestionId: question.id,
          sourceQuestionId: question.generatedVariantOf,
          status: question.status,
          misconceptionLabel,
          misconceptionId: metadataNumber(generationMetadata, 'misconceptionId'),
          conceptCardId: metadataNumber(generationMetadata, 'conceptCardId'),
          plannedDifficulty: metadataString(record, 'plannedDifficulty'),
          isCorrect: Boolean(record.isCorrect),
          attemptedAt: row.createdAt
        }];
      });
    });

    const grouped = new Map<number, {
      variantQuestionId: number;
      sourceQuestionId: number;
      subject: string | null;
      topicId: number | null;
      status: string;
      misconceptionLabel: string;
      misconceptionId: number | null;
      conceptCardId: number | null;
      attemptCount: number;
      correctCount: number;
      latestAttemptAt: Date;
      userIds: Set<number>;
    }>();
    for (const attempt of variantAttempts) {
      const existing = grouped.get(attempt.variantQuestionId) ?? {
        variantQuestionId: attempt.variantQuestionId,
        sourceQuestionId: attempt.sourceQuestionId,
        subject: attempt.subject,
        topicId: attempt.topicId,
        status: attempt.status,
        misconceptionLabel: attempt.misconceptionLabel,
        misconceptionId: attempt.misconceptionId,
        conceptCardId: attempt.conceptCardId,
        attemptCount: 0,
        correctCount: 0,
        latestAttemptAt: attempt.attemptedAt,
        userIds: new Set<number>()
      };
      existing.attemptCount += 1;
      if (attempt.isCorrect) existing.correctCount += 1;
      if (attempt.attemptedAt > existing.latestAttemptAt) existing.latestAttemptAt = attempt.attemptedAt;
      if (typeof attempt.userId === 'number') existing.userIds.add(attempt.userId);
      grouped.set(attempt.variantQuestionId, existing);
    }

    const outcomes = Array.from(grouped.values())
      .map((item) => {
        const accuracy = item.attemptCount ? Number((item.correctCount / item.attemptCount).toFixed(4)) : null;
        return {
          variantQuestionId: item.variantQuestionId,
          sourceQuestionId: item.sourceQuestionId,
          subject: item.subject,
          topicId: item.topicId,
          status: item.status,
          misconceptionLabel: item.misconceptionLabel,
          misconceptionId: item.misconceptionId,
          conceptCardId: item.conceptCardId,
          attemptCount: item.attemptCount,
          correctCount: item.correctCount,
          accuracy,
          uniqueUsers: item.userIds.size,
          latestAttemptAt: item.latestAttemptAt.toISOString(),
          health: variantHealthStatus({ attemptCount: item.attemptCount, accuracy })
        };
      })
      .sort((a, b) => new Date(b.latestAttemptAt).getTime() - new Date(a.latestAttemptAt).getTime());
    const recent = outcomes.slice(0, 10);
    const totalAttempts = variantAttempts.length;
    const totalCorrect = variantAttempts.filter((item) => item.isCorrect).length;
    return {
      summary: {
        variantQuestionCount: grouped.size,
        sourceQuestionCount: new Set(variantAttempts.map((item) => item.sourceQuestionId)).size,
        variantAttemptCount: totalAttempts,
        variantCorrectCount: totalCorrect,
        variantAccuracy: totalAttempts ? Number((totalCorrect / totalAttempts).toFixed(4)) : null,
        misconceptionTrackedCount: new Set(variantAttempts.map((item) => item.misconceptionLabel).filter(Boolean)).size,
        weakVariantCount: outcomes.filter((item) => item.health === 'needs_review').length
      },
      recent
    };
  }

  private async conceptCardEffectObservability(rows: EventRow[]) {
    const completions = rows
      .filter((row) => row.eventType === 'concept_card_completed')
      .map((row) => {
        const metadata = jsonRecord(row.metadata);
        const conceptCardId = metadataNumber(metadata, 'conceptCardId');
        const sourceQuestionId = metadataNumber(metadata, 'sourceQuestionId');
        const topicId = metadataNumber(metadata, 'topicId');
        return {
          eventId: row.id,
          createdAt: row.createdAt,
          userId: row.userId,
          subject: row.subject,
          roundId: row.roundId,
          conceptCardId,
          sourceQuestionId,
          topicId,
          title: metadataString(metadata, 'title'),
          misconceptionLabel: metadataString(metadata, 'misconceptionLabel')
        };
      })
      .filter((item) => item.userId && item.subject && item.conceptCardId && item.sourceQuestionId);

    const practiceRows = rows.filter((row) => row.eventType === 'practice_round_completed');
    const candidateItemIds = Array.from(new Set(practiceRows.flatMap((row) => {
      const items = jsonRecord(row.metadata).items;
      if (!Array.isArray(items)) return [];
      return items.flatMap((item) => {
        const record = jsonRecord(item);
        const source = metadataString(record, 'questionSource') || 'special_practice';
        const questionId = metadataNumber(record, 'questionId');
        return source === 'csca_question' && questionId ? [questionId] : [];
      });
    })));
    const cscaQuestionRows = candidateItemIds.length ? await this.prisma.cscaQuestion.findMany({
      where: { id: { in: candidateItemIds } },
      select: { id: true, generatedVariantOf: true }
    }) : [];
    const generatedById = new Map(cscaQuestionRows.map((row) => [row.id, row.generatedVariantOf]));
    const completionOutcomes = completions.map((completion) => {
      const outcomeItems = practiceRows
        .filter((row) => (
          row.userId === completion.userId
          && row.subject === completion.subject
          && row.createdAt > completion.createdAt
          && row.createdAt.getTime() - completion.createdAt.getTime() <= 14 * DAY_MS
        ))
        .flatMap((row) => {
          const items = jsonRecord(row.metadata).items;
          if (!Array.isArray(items)) return [];
          return items.flatMap((item) => {
            const record = jsonRecord(item);
            const questionId = metadataNumber(record, 'questionId');
            const questionSource = metadataString(record, 'questionSource') || 'special_practice';
            if (!questionId || questionSource !== 'csca_question') return [];
            if (generatedById.get(questionId) !== completion.sourceQuestionId) return [];
            return [{
              roundId: row.roundId,
              questionId,
              isCorrect: Boolean(jsonRecord(item).isCorrect),
              plannedDifficulty: metadataString(record, 'plannedDifficulty'),
              answeredAt: row.createdAt
            }];
          });
        });
      const correctCount = outcomeItems.filter((item) => item.isCorrect).length;
      return {
        ...completion,
        variantAttemptCount: outcomeItems.length,
        variantCorrectCount: correctCount,
        variantAccuracy: outcomeItems.length ? Number((correctCount / outcomeItems.length).toFixed(4)) : null,
        latestVariantAt: outcomeItems.length
          ? outcomeItems.reduce((latest, item) => item.answeredAt > latest ? item.answeredAt : latest, outcomeItems[0].answeredAt).toISOString()
          : null
      };
    });
    const attempted = completionOutcomes.filter((item) => item.variantAttemptCount > 0);
    const totalVariantAttempts = attempted.reduce((sum, item) => sum + item.variantAttemptCount, 0);
    const totalVariantCorrect = attempted.reduce((sum, item) => sum + item.variantCorrectCount, 0);
    return {
      summary: {
        completedCards: completions.length,
        cardsWithVariantAttempts: attempted.length,
        variantAttemptCount: totalVariantAttempts,
        variantCorrectCount: totalVariantCorrect,
        variantAccuracy: totalVariantAttempts ? Number((totalVariantCorrect / totalVariantAttempts).toFixed(4)) : null
      },
      recent: completionOutcomes
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((item) => ({
          conceptCardId: item.conceptCardId,
          sourceQuestionId: item.sourceQuestionId,
          userId: item.userId,
          subject: item.subject,
          topicId: item.topicId,
          title: item.title,
          misconceptionLabel: item.misconceptionLabel,
          completedAt: item.createdAt.toISOString(),
          variantAttemptCount: item.variantAttemptCount,
          variantCorrectCount: item.variantCorrectCount,
          variantAccuracy: item.variantAccuracy,
          latestVariantAt: item.latestVariantAt
        }))
    };
  }

  private plannerAssistantObservability(rows: EventRow[]) {
    const plannerRows = rows.flatMap((row) => {
      const assistant = jsonRecord(row.metadata).plannerAssistant;
      if (!assistant || typeof assistant !== 'object' || Array.isArray(assistant)) return [];
      const record = assistant as Record<string, unknown>;
      const status = metadataString(record, 'status') || 'unknown';
      const provider = jsonRecord(record.provider);
      const providerStatus = metadataString(provider, 'status') || 'unknown';
      const rejectedReasons = Array.isArray(record.rejectedReasons)
        ? record.rejectedReasons.map((item) => String(item)).filter(Boolean)
        : [];
      const differences = Array.isArray(record.differences) ? record.differences.length : 0;
      return [{
        eventId: row.id,
        createdAt: row.createdAt,
        userId: row.userId,
        subject: row.subject,
        roundId: row.roundId,
        status,
        providerStatus,
        rejectedReasons,
        differenceCount: differences
      }];
    });
    const total = plannerRows.length;
    const adjusted = plannerRows.filter((row) => row.status === 'adjusted_by_rule_guard').length;
    const accepted = plannerRows.filter((row) => row.status === 'accepted_no_change' || row.status === 'accepted_with_changes').length;
    const rejectedReasonCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    for (const row of plannerRows) {
      statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
      for (const reason of row.rejectedReasons) {
        rejectedReasonCounts.set(reason, (rejectedReasonCounts.get(reason) ?? 0) + 1);
      }
    }
    return {
      total,
      accepted,
      adjustedByGuard: adjusted,
      acceptanceRate: total ? Number((accepted / total).toFixed(4)) : 0,
      byStatus: Array.from(statusCounts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      rejectedReasons: Array.from(rejectedReasonCounts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      recent: plannerRows.slice(-10).reverse().map((row) => ({
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        subject: row.subject,
        roundId: row.roundId,
        status: row.status,
        providerStatus: row.providerStatus,
        rejectedReasons: row.rejectedReasons,
        differenceCount: row.differenceCount
      }))
    };
  }

  private readinessSampledThresholdRollout(
    readinessDifficultyThresholds: Awaited<ReturnType<TrainingEventService['readinessDifficultyThresholdObservability']>>,
    readinessCalibrationHealth: Awaited<ReturnType<TrainingEventService['readinessCalibrationHealthObservability']>>
  ) {
    const maxImpactUserSubjectCount = sampledThresholdMaxImpactUserSubjects();
    const subjects = readinessDifficultyThresholds.bySubject;
    const sampledReadySubjects = subjects.filter((item) => item.canUseSampled).length;
    const insufficientSubjects = subjects.filter((item) => !item.canUseSampled).map((item) => item.subject);
    const impactedUserSubjectCount = subjects.reduce((sum, item) => sum + item.impactedUserSubjectCount, 0);
    const maxRecommendedCount = subjects.reduce((max, item) => Math.max(max, item.recommendedCount), 0);
    const blockingCalibrationAlerts = readinessCalibrationHealth.alerts.filter((alert) => (
      alert.severity !== 'info' && alert.code !== 'sampled_distribution_insufficient'
    ));
    const sampleReady = subjects.length > 0 && insufficientSubjects.length === 0;
    const calibrationReady = blockingCalibrationAlerts.length === 0;
    const impactReady = impactedUserSubjectCount <= maxImpactUserSubjectCount;
    const sampledModeEnabled = readinessDifficultyThresholds.mode === 'sampled';
    const checklist = [
      {
        key: 'sample_size',
        status: sampleReady ? 'passed' : 'blocked',
        detail: `${sampledReadySubjects}/${subjects.length}`
      },
      {
        key: 'calibration_health',
        status: calibrationReady ? 'passed' : 'blocked',
        detail: String(blockingCalibrationAlerts.length)
      },
      {
        key: 'impact_limit',
        status: impactReady ? 'passed' : 'blocked',
        detail: `${impactedUserSubjectCount}/${maxImpactUserSubjectCount}`
      },
      {
        key: 'sampled_mode',
        status: sampledModeEnabled ? 'passed' : 'pending',
        detail: readinessDifficultyThresholds.mode
      }
    ];
    const blocked = checklist.some((item) => item.status === 'blocked');
    const status = blocked ? 'blocked' : sampledModeEnabled ? 'ready' : 'watching';
    return {
      status,
      checklist,
      metrics: {
        mode: readinessDifficultyThresholds.mode,
        sampledReadySubjects,
        totalSubjects: subjects.length,
        insufficientSubjects,
        impactedUserSubjectCount,
        maxImpactUserSubjectCount,
        maxRecommendedCount,
        minSampleSize: readinessDifficultyThresholds.minSampleSize,
        blockingCalibrationAlertCount: blockingCalibrationAlerts.length
      }
    };
  }

  private readinessCalibrationSnapshotModel() {
    return (this.prisma as unknown as {
      cscaReadinessActionCalibrationSnapshot?: {
        findMany: (args: unknown) => Promise<Array<{
          id?: number;
          snapshotDate: Date;
          actionType: string;
          clickedCount: number;
          followedCount: number;
          abilityLiftCount?: number;
          followThroughRate?: number | null;
          abilityLiftRate?: number | null;
          averageMasteryDelta?: number | null;
          multiplier?: number;
          status: string;
        }>>;
      };
    }).cscaReadinessActionCalibrationSnapshot;
  }

  private async readinessCalibrationHealthObservability(
    readinessActions: Awaited<ReturnType<TrainingEventService['readinessActionObservability']>>,
    readinessDifficultyThresholds: Awaited<ReturnType<TrainingEventService['readinessDifficultyThresholdObservability']>>
  ) {
    const alerts: Array<{
      code: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      actionType?: string;
      subject?: CscaSubject;
      sampleSize?: number;
      minSampleSize?: number;
    }> = [];
    const model = this.readinessCalibrationSnapshotModel();
    const now = new Date();
    let snapshots: Array<{
      id?: number;
      snapshotDate: Date;
      actionType: string;
      clickedCount: number;
      followedCount: number;
      abilityLiftCount?: number;
      followThroughRate?: number | null;
      abilityLiftRate?: number | null;
      averageMasteryDelta?: number | null;
      multiplier?: number;
      status: string;
    }> = [];
    let snapshotReadUnavailable = false;
    if (model) {
      try {
        snapshots = await model.findMany({
          where: {
            snapshotDate: { gte: new Date(now.getTime() - 7 * DAY_MS) }
          },
          orderBy: [{ snapshotDate: 'desc' }, { id: 'desc' }],
          take: 80
        });
      } catch (error) {
        if (!isMissingPrismaRelation(error)) throw error;
        snapshotReadUnavailable = true;
      }
    }
    const latestTime = snapshots.reduce((max, row) => Math.max(max, row.snapshotDate.getTime()), 0);
    const latestSnapshots = latestTime > 0 ? snapshots.filter((row) => row.snapshotDate.getTime() === latestTime) : [];
    const latestSnapshotDate = latestTime > 0 ? new Date(latestTime).toISOString() : null;
    const staleDays = latestTime > 0 ? Math.floor((now.getTime() - latestTime) / DAY_MS) : null;

    if (!model || snapshotReadUnavailable) {
      alerts.push({
        code: 'calibration_snapshot_unavailable',
        severity: 'warning',
        message: 'Readiness action calibration snapshot storage is unavailable. Run the latest database migration to enable persisted calibration health.'
      });
    } else if (snapshots.length === 0) {
      alerts.push({
        code: 'calibration_snapshot_missing',
        severity: 'warning',
        message: 'Readiness action calibration has no recent persisted snapshots.'
      });
    } else if (staleDays !== null && staleDays >= 2) {
      alerts.push({
        code: 'calibration_snapshot_stale',
        severity: 'warning',
        message: 'Latest readiness action calibration snapshot is older than two days.'
      });
    }

    const latestClickedCount = latestSnapshots.reduce((sum, row) => sum + row.clickedCount, 0);
    if (latestSnapshots.length > 0 && latestClickedCount === 0) {
      alerts.push({
        code: 'calibration_snapshot_empty',
        severity: 'warning',
        message: 'Latest readiness action calibration snapshot contains no clicked recommendation samples.'
      });
    }

    const needsCalibrationActionTypes = new Set<string>();
    for (const row of latestSnapshots) {
      if (row.status === 'needs_calibration') needsCalibrationActionTypes.add(row.actionType);
    }
    for (const row of readinessActions.byActionType) {
      if (row.status === 'needs_calibration') needsCalibrationActionTypes.add(row.key);
    }
    for (const actionType of Array.from(needsCalibrationActionTypes).sort()) {
      alerts.push({
        code: 'action_type_needs_calibration',
        severity: 'warning',
        message: 'A readiness recommendation action type is underperforming and needs calibration.',
        actionType
      });
    }

    if (readinessDifficultyThresholds.mode === 'sampled') {
      for (const item of readinessDifficultyThresholds.bySubject) {
        if (item.canUseSampled) continue;
        alerts.push({
          code: 'sampled_distribution_insufficient',
          severity: 'warning',
          message: 'Sampled high-difficulty threshold mode is enabled, but this subject lacks enough samples.',
          subject: item.subject,
          sampleSize: item.sampleSize,
          minSampleSize: readinessDifficultyThresholds.minSampleSize
        });
      }
    }

    const status = alerts.some((alert) => alert.severity === 'critical')
      ? 'blocked'
      : alerts.some((alert) => alert.severity === 'warning')
        ? 'needs_attention'
        : alerts.length
          ? 'watching'
          : 'healthy';

    return {
      status,
      snapshotCount: snapshots.length,
      latestSnapshotDate,
      staleDays,
      alerts
    };
  }

  private async readinessDifficultyThresholdObservability(start: Date, end: Date) {
    const adaptiveRoundModel = (this.prisma as unknown as {
      cscaAdaptiveRound?: {
        findMany: (args: unknown) => Promise<Array<{
          session?: { userId?: number | null; subject?: string | null } | null;
          items?: Array<{ plannedDifficulty?: string | null; usedHint?: boolean | null; usedExplanation?: boolean | null }> | null;
        }>>;
      };
    }).cscaAdaptiveRound;
    const rounds = adaptiveRoundModel ? await adaptiveRoundModel.findMany({
      where: {
        submittedAt: { not: null, gte: start, lt: end }
      },
      select: {
        session: { select: { userId: true, subject: true } },
        items: {
          select: {
            plannedDifficulty: true,
            usedHint: true,
            usedExplanation: true
          }
        }
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 1000
    }) : [];

    const countsByUserSubject = new Map<string, { subject: CscaSubject; count: number }>();
    for (const round of rounds) {
      const subject = validCscaSubject(round.session?.subject);
      const userId = typeof round.session?.userId === 'number' ? round.session.userId : null;
      if (!subject || userId === null || !Array.isArray(round.items)) continue;
      const count = round.items.filter((item) => (
        difficultyRank(item.plannedDifficulty) >= 3
        && !item.usedHint
        && !item.usedExplanation
      )).length;
      if (count <= 0) continue;
      const key = `${userId}:${subject}`;
      const existing = countsByUserSubject.get(key);
      countsByUserSubject.set(key, { subject, count: (existing?.count ?? 0) + count });
    }

    const bySubject = CSCA_SUBJECTS.map((subject) => {
      const counts = Array.from(countsByUserSubject.values()).filter((item) => item.subject === subject).map((item) => item.count);
      const defaultRequiredCount = DEFAULT_HIGH_DIFFICULTY_REQUIRED[subject];
      const recommendedCount = clampInt(percentile(counts, 0.6) ?? defaultRequiredCount, defaultRequiredCount, 5);
      const override = highDifficultyOverride(subject);
      const canUseSampled = counts.length >= HIGH_DIFFICULTY_DISTRIBUTION_SAMPLE_MIN;
      const sampledMode = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE === 'sampled';
      const source = override !== null
        ? 'env_override'
        : sampledMode && canUseSampled
          ? 'sampled_distribution'
          : 'default';
      const requiredCount = override ?? (source === 'sampled_distribution' ? recommendedCount : defaultRequiredCount);
      const readyAtDefault = counts.filter((count) => count >= defaultRequiredCount).length;
      const readyAtSampled = counts.filter((count) => count >= recommendedCount).length;
      const impactedUserSubjectCount = Math.max(0, readyAtDefault - readyAtSampled);
      const averageCount = counts.length
        ? Number((counts.reduce((sum, count) => sum + count, 0) / counts.length).toFixed(2))
        : null;
      return {
        subject,
        sampleSize: counts.length,
        averageCount,
        p50Count: percentile(counts, 0.5),
        p60Count: percentile(counts, 0.6),
        p80Count: percentile(counts, 0.8),
        defaultRequiredCount,
        recommendedCount,
        requiredCount,
        source,
        canUseSampled,
        readyAtDefault,
        readyAtSampled,
        impactedUserSubjectCount
      };
    });

    return {
      mode: process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE === 'sampled' ? 'sampled' : 'static',
      minSampleSize: HIGH_DIFFICULTY_DISTRIBUTION_SAMPLE_MIN,
      bySubject
    };
  }

  private readinessEvidenceObservability(rows: EventRow[]) {
    const clicks = rows.filter((row) => row.eventType === 'readiness_action_clicked');
    const snapshots = clicks.flatMap((row) => {
      const dimensions = metadataDimensions(row.metadata);
      const evidence = dimensions.find((dimension) => dimension.key === 'evidence');
      if (!evidence) return [];
      const score = Math.max(0, Math.min(evidence.maxScore, evidence.score));
      const ratio = evidence.maxScore ? score / evidence.maxScore : 0;
      const weakDimensions = dimensions
        .filter((dimension) => dimension.status === 'weak' || dimension.status === 'insufficient')
        .map((dimension) => dimension.key);
      return [{
        createdAt: row.createdAt,
        userId: row.userId,
        score,
        maxScore: evidence.maxScore,
        ratio,
        status: evidence.status,
        weakDimensions
      }];
    });
    if (!snapshots.length) {
      return {
        sampleSize: 0,
        averageScore: null,
        lowCount: 0,
        lowRate: 0,
        status: 'no_data',
        byStatus: [],
        topGaps: [],
        recent: []
      };
    }
    const lowCount = snapshots.filter((snapshot) => snapshot.score < 5 || snapshot.status === 'weak' || snapshot.status === 'insufficient').length;
    const lowRate = Number((lowCount / snapshots.length).toFixed(4));
    const averageScore = Number((snapshots.reduce((sum, snapshot) => sum + snapshot.score, 0) / snapshots.length).toFixed(2));
    const gapCounts = new Map<string, number>();
    for (const snapshot of snapshots) {
      for (const key of snapshot.weakDimensions) {
        gapCounts.set(key, (gapCounts.get(key) ?? 0) + 1);
      }
    }
    return {
      sampleSize: snapshots.length,
      averageScore,
      lowCount,
      lowRate,
      status: evidenceHealthStatus({ sampleSize: snapshots.length, averageScore, lowRate }),
      byStatus: Array.from(snapshots.reduce((map, snapshot) => {
        map.set(snapshot.status, (map.get(snapshot.status) ?? 0) + 1);
        return map;
      }, new Map<string, number>()).entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      topGaps: Array.from(gapCounts.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 8),
      recent: snapshots.slice(-10).reverse().map((snapshot) => ({
        createdAt: snapshot.createdAt.toISOString(),
        userId: snapshot.userId,
        score: snapshot.score,
        maxScore: snapshot.maxScore,
        status: snapshot.status,
        weakDimensions: snapshot.weakDimensions
      }))
    };
  }

  private async readinessActionObservability(rows: EventRow[], start: Date, end: Date) {
    const clicks = rows.filter((row) => row.eventType === 'readiness_action_clicked');
    if (!clicks.length) {
      return {
        clickedCount: 0,
        followedCount: 0,
        followThroughRate: 0,
        averageExpectedGain: null,
        status: 'no_data',
        byActionType: [],
        recentClicks: []
      };
    }

    const userIds = Array.from(new Set(clicks.map((row) => row.userId).filter((value): value is number => typeof value === 'number')));
    const [mockAttempts, wrongPatterns] = await Promise.all([
      this.prisma.mockExamAttempt.findMany({
        where: {
          userId: { in: userIds },
          submittedAt: { not: null, gte: start, lt: new Date(end.getTime() + 24 * 60 * 60 * 1000) }
        },
        select: { userId: true, submittedAt: true },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }]
      }),
      this.prisma.cscaWrongPattern.findMany({
        where: {
          userId: { in: userIds },
          updatedAt: { gte: start, lt: new Date(end.getTime() + 24 * 60 * 60 * 1000) }
        },
        select: { userId: true, metadata: true, lastCorrectAt: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }]
      })
    ]);

    const roundEvents = rows.filter((row) => [
      'diagnostic_round_started',
      'diagnostic_round_completed',
      'practice_round_started',
      'practice_round_completed'
    ].includes(row.eventType));
    const mockTimesByUser = new Map<number, Date[]>();
    for (const attempt of mockAttempts) {
      if (typeof attempt.userId !== 'number' || !attempt.submittedAt) continue;
      const list = mockTimesByUser.get(attempt.userId) ?? [];
      list.push(attempt.submittedAt);
      mockTimesByUser.set(attempt.userId, list);
    }
    const reviewTimesByUser = new Map<number, Date[]>();
    for (const pattern of wrongPatterns) {
      if (typeof pattern.userId !== 'number') continue;
      const metadata = jsonRecord(pattern.metadata);
      const dates = [
        dateFromUnknown(metadata.lastReviewCompletedAt),
        pattern.lastCorrectAt
      ].filter((date): date is Date => Boolean(date));
      if (!dates.length) continue;
      const list = reviewTimesByUser.get(pattern.userId) ?? [];
      list.push(...dates);
      reviewTimesByUser.set(pattern.userId, list);
    }

    const actionRows = clicks.map((click) => {
      const actionType = metadataString(click.metadata, 'actionType') || 'unknown';
      const deadline = new Date(click.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const expectedGain = metadataNumber(click.metadata, 'expectedGain');
      const score = metadataNumber(click.metadata, 'score');
      const userId = typeof click.userId === 'number' ? click.userId : null;
      const followed = (() => {
        if (userId === null) return false;
        if (actionType === 'review_due_patterns') {
          return (reviewTimesByUser.get(userId) ?? []).some((date) => dateInWindow(date, click.createdAt, deadline));
        }
        if (actionType === 'start_mock_exam' || actionType === 'resume_mock_attempt') {
          return (mockTimesByUser.get(userId) ?? []).some((date) => dateInWindow(date, click.createdAt, deadline));
        }
        const expectedEvents = actionType === 'start_diagnostic'
          ? ['diagnostic_round_started', 'diagnostic_round_completed']
          : ['practice_round_started', 'practice_round_completed'];
        return roundEvents.some((event) => (
          event.userId === userId
          && expectedEvents.includes(event.eventType)
          && dateInWindow(event.createdAt, click.createdAt, deadline)
        ));
      })();
      return { click, actionType, expectedGain, score, followed };
    });
    const clickedCount = actionRows.length;
    const followedCount = actionRows.filter((row) => row.followed).length;
    const followThroughRate = Number((followedCount / clickedCount).toFixed(4));
    const expectedGains = actionRows.map((row) => row.expectedGain).filter((value): value is number => value !== null);
    const byActionType = Array.from(actionRows.reduce((map, row) => {
      const bucket = map.get(row.actionType) ?? { key: row.actionType, clickedCount: 0, followedCount: 0, expectedGainTotal: 0, expectedGainCount: 0 };
      bucket.clickedCount += 1;
      if (row.followed) bucket.followedCount += 1;
      if (row.expectedGain !== null) {
        bucket.expectedGainTotal += row.expectedGain;
        bucket.expectedGainCount += 1;
      }
      map.set(row.actionType, bucket);
      return map;
    }, new Map<string, { key: string; clickedCount: number; followedCount: number; expectedGainTotal: number; expectedGainCount: number }>()).values())
      .map((bucket) => {
        const rate = bucket.clickedCount ? Number((bucket.followedCount / bucket.clickedCount).toFixed(4)) : 0;
        return {
          key: bucket.key,
          clickedCount: bucket.clickedCount,
          followedCount: bucket.followedCount,
          followThroughRate: rate,
          averageExpectedGain: bucket.expectedGainCount ? Math.round(bucket.expectedGainTotal / bucket.expectedGainCount) : null,
          status: recommendationStatus({ clickedCount: bucket.clickedCount, followThroughRate: rate })
        };
      })
      .sort((a, b) => b.clickedCount - a.clickedCount || a.key.localeCompare(b.key));

    return {
      clickedCount,
      followedCount,
      followThroughRate,
      averageExpectedGain: expectedGains.length ? Math.round(expectedGains.reduce((sum, gain) => sum + gain, 0) / expectedGains.length) : null,
      status: recommendationStatus({ clickedCount, followThroughRate }),
      byActionType,
      recentClicks: actionRows.slice(-10).reverse().map((row) => ({
        createdAt: row.click.createdAt.toISOString(),
        userId: row.click.userId,
        actionType: row.actionType,
        expectedGain: row.expectedGain,
        score: row.score,
        followed: row.followed
      }))
    };
  }
}
