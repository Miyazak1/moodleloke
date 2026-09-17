import { Injectable } from '@nestjs/common';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { PrismaService } from '../prisma/prisma.service';
import { ADAPTIVE_DIAGNOSTIC_ROUND_SIZE, ADAPTIVE_ROUND_SIZE, AdaptivePlannedTopic, AdaptiveVerificationRequest } from './csca-adaptive.types';
import { SpecialPracticeSubject } from './csca-special-practice.types';

type TopicWithMastery = {
  id: number;
  code: string;
  title: string;
  module: string | null;
  mastery: number;
  confidence: number;
  lastPracticedAt: Date | null;
};

type PlannerDifficultyAdjustment = {
  direction: 'increase' | 'decrease' | 'hold' | 'insufficient';
  difficultyStep: number;
  reason: string;
  sampleSize: number;
  averageAccuracy: number | null;
  averageSeconds: number | null;
  unansweredRate: number | null;
};

const DIFFICULTY_LABELS = ['基础', '中等', '较难', '挑战'];

function difficultyFromRank(rank: number) {
  return DIFFICULTY_LABELS[Math.max(0, Math.min(DIFFICULTY_LABELS.length - 1, rank - 1))] ?? '基础';
}

function difficultyRank(value: string) {
  if (value.includes('挑战')) return 4;
  if (value.includes('较难') || value.includes('提高')) return 3;
  if (value.includes('中')) return 2;
  return 1;
}

function baseDifficulty(mastery: number) {
  if (mastery >= 0.78) return '挑战';
  if (mastery >= 0.62) return '较难';
  if (mastery >= 0.45) return '中等';
  return '基础';
}

function targetDifficulty(mastery: number, difficultyStep = 0) {
  const base = baseDifficulty(mastery);
  return difficultyFromRank(difficultyRank(base) + difficultyStep);
}

function plannedTopic(topic: TopicWithMastery, reason: string, adjustment: PlannerDifficultyAdjustment): AdaptivePlannedTopic {
  const base = baseDifficulty(topic.mastery);
  const target = targetDifficulty(topic.mastery, adjustment.difficultyStep);
  return {
    topicId: topic.id,
    code: topic.code,
    title: topic.title,
    module: topic.module,
    targetDifficulty: target,
    reason,
    baseDifficulty: base,
    difficultyAdjustment: adjustment.difficultyStep,
    targetDifficultyReason: adjustment.reason
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function isFallbackOrSmokeGeneratedQuestion(value: unknown) {
  const record = jsonRecord(value);
  const sourceKind = cleanString(record.sourceKind).toLowerCase();
  const generationSource = cleanString(record.generationSource).toLowerCase();
  const generationMode = cleanString(record.generationMode).toLowerCase();
  return (
    record.fallbackUsed === true ||
    record.generator === 'rule-fallback' ||
    record.status === 'generator_disabled' ||
    sourceKind.includes('smoke') ||
    generationSource.includes('smoke') ||
    generationMode.includes('smoke')
  );
}

function isOnlineMockExamApproval(value: unknown) {
  const review = jsonRecord(value);
  const approval = jsonRecord(review.mockExamApproval);
  return ['approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft'].includes(cleanString(approval.status));
}

function isOnlineMockExamQuestion(generationMetadata: unknown, reviewMetadata?: unknown) {
  const metadata = jsonRecord(generationMetadata);
  const scope = jsonRecord(metadata.scope);
  const mockExamSlot = jsonRecord(metadata.mockExamSlot);
  const generationMode = cleanString(metadata.generationMode);
  return (
    scope.targetUseCase === 'online_mock_exam' ||
    metadata.targetUseCase === 'online_mock_exam' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Boolean(mockExamSlot.slotId || mockExamSlot.blueprintId || mockExamSlot.sourcePaperId) ||
    isOnlineMockExamApproval(reviewMetadata)
  );
}

function isPublishedSubjectPracticeAiQuestion(reviewMetadata: unknown) {
  const review = jsonRecord(reviewMetadata);
  const approval = jsonRecord(review.subjectPracticeAutoApproval);
  return approval.status === 'published_to_subject_practice'
    && approval.targetUseCase === 'subject_practice'
    && approval.targetQuestionBank === 'special_practice_questions';
}

function isUsableQuestionVersion(generationMetadata: unknown) {
  const metadata = jsonRecord(generationMetadata);
  const governance = jsonRecord(metadata.versionGovernance);
  const status = cleanString(governance.status);
  return isStudentConsumableAiVersionStatus(status);
}

function recentQuestionIdsFrom(value: unknown) {
  const record = jsonRecord(value);
  const ids = Array.isArray(record.recentQuestionIds) ? record.recentQuestionIds : [];
  const lastQuestionId = Number(record.lastQuestionId);
  return Array.from(new Set([
    ...(Number.isInteger(lastQuestionId) && lastQuestionId > 0 ? [lastQuestionId] : []),
    ...ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
  ])).slice(0, 12);
}

function questionSourceFrom(value: unknown) {
  const source = typeof value === 'string' ? value.trim() : '';
  return source || 'special_practice';
}

function recentQuestionRefsFrom(value: unknown): Array<{ questionId: number; questionSource: string }> {
  const record = jsonRecord(value);
  if (Array.isArray(record.recentQuestionRefs)) {
    return record.recentQuestionRefs
      .map((item) => {
        const next = jsonRecord(item);
        const questionId = Number(next.questionId);
        if (!Number.isInteger(questionId) || questionId <= 0) return null;
        return { questionId, questionSource: questionSourceFrom(next.questionSource) };
      })
      .filter((item): item is { questionId: number; questionSource: string } => Boolean(item))
      .slice(0, 12);
  }
  const legacySource = typeof record.lastQuestionSource === 'string'
    ? questionSourceFrom(record.lastQuestionSource)
    : 'legacy_unknown';
  return recentQuestionIdsFrom(value).map((questionId) => ({
    questionId,
    questionSource: legacySource
  }));
}

function plannedDiagnosticTopic(topic: TopicWithMastery, targetDifficulty: string): AdaptivePlannedTopic {
  return {
    topicId: topic.id,
    code: topic.code,
    title: topic.title,
    module: topic.module,
    targetDifficulty,
    reason: 'diagnostic_baseline'
  };
}

@Injectable()
export class AdaptivePlannerService {
  constructor(private readonly prisma: PrismaService) {}

  async planDiagnosticRound(subject: SpecialPracticeSubject, limit = ADAPTIVE_DIAGNOSTIC_ROUND_SIZE) {
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { subject, status: 'published' },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }]
    });
    const candidates: TopicWithMastery[] = topics.map((topic) => ({
      id: topic.id,
      code: topic.code,
      title: topic.title,
      module: topic.module,
      mastery: 0.5,
      confidence: 0.2,
      lastPracticedAt: null
    }));
    const difficultyMix = ['基础', '中等', '中等', '较难', '挑战'];
    const plannedTopics = Array.from({ length: limit }, (_, index) => {
      const topic = candidates[index % Math.max(candidates.length, 1)];
      if (!topic) return null;
      return plannedDiagnosticTopic(topic, difficultyMix[index % difficultyMix.length]);
    }).filter((topic): topic is AdaptivePlannedTopic => Boolean(topic));

    return {
      subject,
      plannedTopics,
      strategy: 'diagnostic_baseline_balanced',
      roundSize: limit
    };
  }

  async planRound(userId: number, subject: SpecialPracticeSubject, limit = ADAPTIVE_ROUND_SIZE, focusTopicId?: number) {
    const context = await this.buildPlanningContext(userId, subject);
    const selected = new Map<number, AdaptivePlannedTopic>();
    const add = (topic: TopicWithMastery | undefined, reason: string, extras: Partial<AdaptivePlannedTopic> = {}) => {
      if (!topic || selected.has(topic.id) || selected.size >= limit) return;
      selected.set(topic.id, { ...plannedTopic(topic, reason, context.adjustment), ...extras });
    };

    if (focusTopicId) add(context.candidates.find((topic) => topic.id === focusTopicId), 'user_focus_topic');

    const remediationTopics = await this.remediationVariantTopics(userId, subject, context.candidates, limit);
    for (const remediationTopic of remediationTopics) {
      add(remediationTopic.topic, 'misconception_variant_practice', {
        preferredQuestionIds: remediationTopic.preferredQuestionIds,
        targetDifficultyReason: 'recent_repeated_misconception_variant'
      });
    }

    const weakest = [...context.candidates].sort((a, b) => a.mastery - b.mastery || a.confidence - b.confidence || a.id - b.id);
    add(weakest[0], 'weakest_topic');
    add(weakest[1], 'weakest_topic');

    const wrongExposure = await this.prisma.cscaQuestionExposure.findFirst({
      where: { userId, source: { in: ['adaptive_round', 'adaptive_round:special_practice', 'adaptive_round:csca_question'] }, lastResult: 'wrong' },
      orderBy: { lastSeenAt: 'desc' }
    });
    if (wrongExposure) {
      const topicId = wrongExposure.source === 'adaptive_round:csca_question'
        ? (await this.prisma.cscaQuestion.findFirst({
          where: { id: wrongExposure.questionId, subject },
          select: { topicId: true }
        }))?.topicId
        : (await this.prisma.cscaTopicMapping.findFirst({
          where: { sourceType: 'special_practice_question', sourceId: wrongExposure.questionId, topic: { subject } },
          include: { topic: true }
        }))?.topicId;
      const topic = topicId ? context.candidates.find((item) => item.id === topicId) : undefined;
      add(topic, 'recent_wrong_topic');
    }

    const stale = [...context.candidates].sort((a, b) => {
      const aTime = a.lastPracticedAt?.getTime() ?? 0;
      const bTime = b.lastPracticedAt?.getTime() ?? 0;
      return aTime - bTime || a.id - b.id;
    });
    add(stale.find((topic) => !selected.has(topic.id)), 'stale_review_topic');

    const challenge = [...context.candidates].sort((a, b) => b.mastery - a.mastery || a.id - b.id);
    add(challenge.find((topic) => !selected.has(topic.id)), 'challenge_or_foundation_topic');

    for (const topic of weakest) add(topic, 'fill_round');

    return {
      subject,
      plannedTopics: Array.from(selected.values()).slice(0, limit),
      strategy: 'weakest_recent_wrong_stale_challenge',
      mode: 'regular',
      focus: focusTopicId ? { source: 'manual_topic', topicId: focusTopicId } : null,
      adjustment: context.adjustment,
      roundSize: limit
    };
  }

  async planVerificationRound(userId: number, subject: SpecialPracticeSubject, limit = ADAPTIVE_ROUND_SIZE, verification: AdaptiveVerificationRequest = {}) {
    const context = await this.buildPlanningContext(userId, subject);
    const focusTopic = verification.topicId
      ? context.candidates.find((topic) => topic.id === verification.topicId)
      : undefined;
    if (!focusTopic) return this.planRound(userId, subject, limit, verification.topicId);

    const plannedTopics: AdaptivePlannedTopic[] = [];
    const verificationCount = Math.min(3, limit);
    for (let index = 0; index < verificationCount; index += 1) {
      plannedTopics.push(plannedTopic(focusTopic, 'wrong_pattern_verification', context.adjustment));
    }

    const weakest = [...context.candidates].sort((a, b) => a.mastery - b.mastery || a.confidence - b.confidence || a.id - b.id);
    const addFiller = (topic: TopicWithMastery | undefined, reason: string) => {
      if (!topic || plannedTopics.length >= limit) return;
      plannedTopics.push(plannedTopic(topic, reason, context.adjustment));
    };
    addFiller(weakest.find((topic) => topic.id !== focusTopic.id), 'verification_support_weak_topic');
    const stale = [...context.candidates].sort((a, b) => {
      const aTime = a.lastPracticedAt?.getTime() ?? 0;
      const bTime = b.lastPracticedAt?.getTime() ?? 0;
      return aTime - bTime || a.id - b.id;
    });
    addFiller(stale.find((topic) => topic.id !== focusTopic.id), 'verification_support_stale_topic');
    for (const topic of weakest) addFiller(topic, 'verification_fill_round');

    return {
      subject,
      plannedTopics: plannedTopics.slice(0, limit),
      strategy: 'wrong_pattern_verification',
      mode: 'verification',
      focus: {
        source: 'wrong_pattern',
        topicId: focusTopic.id,
        topicCode: focusTopic.code,
        topicTitle: focusTopic.title,
        reviewItemId: verification.reviewItemId ?? null,
        patternType: verification.patternType ?? null
      },
      adjustment: context.adjustment,
      roundSize: limit
    };
  }

  private async buildPlanningContext(userId: number, subject: SpecialPracticeSubject) {
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { subject, status: 'published' },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }]
    });
    const masteryRows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, subject }
    });
    const masteryMap = new Map(masteryRows.map((row) => [row.topicId, row]));
    const candidates: TopicWithMastery[] = topics.map((topic) => {
      const mastery = masteryMap.get(topic.id);
      return {
        id: topic.id,
        code: topic.code,
        title: topic.title,
        module: topic.module,
        mastery: mastery?.mastery ?? 0.5,
        confidence: mastery?.confidence ?? 0.2,
        lastPracticedAt: mastery?.lastPracticedAt ?? null
      };
    });

    const adjustment = await this.performanceAdjustment(userId, subject);
    return { candidates, adjustment };
  }

  private async remediationVariantTopics(userId: number, subject: SpecialPracticeSubject, candidates: TopicWithMastery[], limit: number) {
    const patterns = await this.prisma.cscaWrongPattern.findMany({
      where: {
        userId,
        subject,
        status: { in: ['active', 'pending_verification', 'improving'] },
        recurrenceCount: { gte: 2 },
        topicId: { not: null }
      },
      orderBy: [{ recurrenceCount: 'desc' }, { updatedAt: 'desc' }],
      take: Math.max(3, limit)
    });
    const prismaRecord = this.prisma as unknown as Record<string, { findMany?: unknown } | undefined>;
    const conceptEvents = typeof prismaRecord.cscaTrainingEvent?.findMany === 'function'
      ? await this.prisma.cscaTrainingEvent.findMany({
        where: {
          userId,
          subject,
          eventType: 'concept_card_completed',
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        },
        select: { metadata: true },
        orderBy: { createdAt: 'desc' },
        take: Math.max(5, limit * 2)
      })
      : [];
    const conceptSourceIds = conceptEvents
      .map((event) => Number(jsonRecord(event.metadata).sourceQuestionId))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!patterns.length && !conceptSourceIds.length) return [];
    const recentRefs = [
      ...conceptSourceIds.map((questionId) => ({ questionId, questionSource: 'csca_question' })),
      ...patterns.flatMap((pattern) => recentQuestionRefsFrom(pattern.metadata))
    ];
    const directIds = Array.from(new Set(recentRefs
      .filter((ref) => ref.questionSource === 'csca_question' || ref.questionSource === 'legacy_unknown')
      .map((ref) => ref.questionId)));
    const specialIds = Array.from(new Set(recentRefs
      .filter((ref) => ref.questionSource !== 'csca_question')
      .map((ref) => ref.questionId)));
    const legacyIds = Array.from(new Set([
      ...conceptSourceIds,
      ...patterns.flatMap((pattern) => recentQuestionIdsFrom(pattern.metadata))
    ]));
    if (!directIds.length && !specialIds.length && !legacyIds.length) return [];
    const sourceRows = specialIds.length ? await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: { in: specialIds } },
      select: {
        id: true,
        status: true,
        syllabusVersion: true,
        generationMetadata: true,
        reviewMetadata: true,
        topic: { select: { status: true, syllabusVersion: true } }
      }
    }) : [];
    const formalSourceRows = sourceRows.filter((row) => (
      row.status === 'approved' &&
      row.topic?.status === 'published' &&
      row.syllabusVersion === row.topic.syllabusVersion &&
      isPublishedSubjectPracticeAiQuestion(row.reviewMetadata) &&
      !isOnlineMockExamQuestion(row.generationMetadata, row.reviewMetadata) &&
      !isFallbackOrSmokeGeneratedQuestion(row.generationMetadata) &&
      isUsableQuestionVersion(row.generationMetadata)
    ));
    const sourceQuestionIds = Array.from(new Set([
      ...directIds,
      ...formalSourceRows.map((row) => row.id),
      ...(!directIds.length && !specialIds.length ? legacyIds : [])
    ]));
    const variants = sourceQuestionIds.length ? await this.prisma.cscaQuestion.findMany({
      where: {
        generatedVariantOf: { in: sourceQuestionIds },
        status: 'approved',
        topic: { status: 'published', subject }
      },
      select: { id: true, topicId: true, syllabusVersion: true, sourceType: true, generationMetadata: true, topic: { select: { syllabusVersion: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    }) : [];
    const currentVariants = variants.filter((variant) => (
      variant.syllabusVersion === variant.topic.syllabusVersion &&
      (variant.sourceType !== 'ai' || isUsableQuestionVersion(variant.generationMetadata))
    ));
    if (!currentVariants.length) return [];
    const candidateById = new Map(candidates.map((topic) => [topic.id, topic]));
    const preferredByTopic = new Map<number, number[]>();
    for (const variant of currentVariants) {
      const ids = preferredByTopic.get(variant.topicId) ?? [];
      ids.push(variant.id);
      preferredByTopic.set(variant.topicId, ids);
    }
    return Array.from(preferredByTopic.entries())
      .map(([topicId, preferredQuestionIds]) => ({ topic: candidateById.get(topicId), preferredQuestionIds }))
      .filter((item): item is { topic: TopicWithMastery; preferredQuestionIds: number[] } => Boolean(item.topic && item.preferredQuestionIds.length))
      .slice(0, Math.min(2, limit));
  }

  private async performanceAdjustment(userId: number, subject: SpecialPracticeSubject): Promise<PlannerDifficultyAdjustment> {
    if (!('cscaAdaptiveRound' in this.prisma)) {
      return {
        direction: 'insufficient',
        difficultyStep: 0,
        reason: 'insufficient_recent_rounds',
        sampleSize: 0,
        averageAccuracy: null,
        averageSeconds: null,
        unansweredRate: null
      };
    }
    const recentRounds = await this.prisma.cscaAdaptiveRound.findMany({
      where: {
        submittedAt: { not: null },
        session: { userId, subject, mode: 'practice' }
      },
      include: {
        items: { select: { timeSpentSeconds: true } }
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 3
    });
    if (recentRounds.length < 2) {
      return {
        direction: 'insufficient',
        difficultyStep: 0,
        reason: 'insufficient_recent_rounds',
        sampleSize: recentRounds.length,
        averageAccuracy: null,
        averageSeconds: null,
        unansweredRate: null
      };
    }
    const total = recentRounds.reduce((sum, round) => sum + round.correctCount + round.wrongCount + round.unansweredCount, 0);
    const correct = recentRounds.reduce((sum, round) => sum + round.correctCount, 0);
    const unanswered = recentRounds.reduce((sum, round) => sum + round.unansweredCount, 0);
    const totalSeconds = recentRounds.reduce((sum, round) => sum + round.items.reduce((next, item) => next + item.timeSpentSeconds, 0), 0);
    const averageAccuracy = total ? Math.round((correct / total) * 100) : 0;
    const averageSeconds = total ? Math.round(totalSeconds / total) : 0;
    const unansweredRate = total ? Number((unanswered / total).toFixed(2)) : 0;
    if (averageAccuracy >= 80 && averageSeconds <= 60 && unansweredRate === 0) {
      return {
        direction: 'increase',
        difficultyStep: 1,
        reason: 'stable_fast_correct',
        sampleSize: recentRounds.length,
        averageAccuracy,
        averageSeconds,
        unansweredRate
      };
    }
    if (averageAccuracy <= 45 || unansweredRate >= 0.2) {
      return {
        direction: 'decrease',
        difficultyStep: -1,
        reason: unansweredRate >= 0.2 ? 'too_many_unanswered' : 'low_recent_accuracy',
        sampleSize: recentRounds.length,
        averageAccuracy,
        averageSeconds,
        unansweredRate
      };
    }
    return {
      direction: 'hold',
      difficultyStep: 0,
      reason: averageAccuracy >= 70 ? 'stable_keep_collecting' : 'mixed_recent_performance',
      sampleSize: recentRounds.length,
      averageAccuracy,
      averageSeconds,
      unansweredRate
    };
  }
}
