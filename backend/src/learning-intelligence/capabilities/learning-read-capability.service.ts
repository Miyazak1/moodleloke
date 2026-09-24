import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PastPapersService } from '../../past-papers/past-papers.service';
import { CscaSubjectCode, CscaSubjectCodeSchema } from '../contracts/learning-intelligence.contracts';
import { LearningDecisionService } from '../decision/learning-decision.service';
import { ScoreReadinessService } from '../readiness/score-readiness.service';
import { LearningCapabilityError } from './learning-capability.error';

const SUBJECTS: CscaSubjectCode[] = ['math', 'physics', 'chemistry'];

function jsonStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function preferredDays(value: Prisma.JsonValue | null | undefined): number[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is number => Number.isInteger(item) && Number(item) >= 1 && Number(item) <= 7))]
    : [];
}

function answeredCount(value: Prisma.JsonValue | null | undefined): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value).filter((answer) => answer !== null && answer !== undefined && String(answer).trim()).length;
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function masteryStatus(mastery: number, confidence: number, attemptCount: number): string {
  if (attemptCount === 0 || confidence < 0.35) return 'insufficient_evidence';
  if (mastery >= 0.8) return 'strong';
  if (mastery >= 0.6) return 'developing';
  return 'needs_attention';
}

function reviewPriority(input: { recurrenceCount: number; nextReviewAt: Date | null }): number {
  if (input.nextReviewAt && input.nextReviewAt.getTime() <= Date.now()) return 3;
  if (input.recurrenceCount >= 3) return 2;
  return 1;
}

@Injectable()
export class LearningReadCapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningDecision: LearningDecisionService,
    @Optional() private readonly scoreReadiness?: ScoreReadinessService,
    @Optional() private readonly pastPapers?: PastPapersService
  ) {}

  getTargetGap(actorUserId: number) {
    return this.learningDecision.getTargetGap(actorUserId);
  }

  getLearningPrescription(actorUserId: number) {
    return this.learningDecision.getLearningPrescription(actorUserId);
  }

  getScoreReadiness(actorUserId: number) {
    if (!this.scoreReadiness) throw new LearningCapabilityError('TOOL_UNAVAILABLE', 'Score Readiness is unavailable.', true);
    return this.scoreReadiness.getScoreReadiness(actorUserId);
  }

  async searchPastPapers(input: {
    subject?: CscaSubjectCode;
    category?: 'past-paper' | 'mock-paper';
    year?: number;
    locale?: 'zh' | 'en';
    limit?: number;
  }) {
    if (!this.pastPapers) throw new LearningCapabilityError('TOOL_UNAVAILABLE', 'Past-paper search is unavailable.', true);
    const result = await this.pastPapers.listPublic({
      subject: input.subject,
      category: input.category ?? 'past-paper',
      locale: input.locale
    });
    const items = (result.items as Array<Record<string, unknown>>)
      .filter((item) => input.year === undefined || Number(item.examYear) === input.year)
      .slice(0, input.limit ?? 6)
      .map((item) => ({
        id: Number(item.id),
        slug: String(item.slug),
        title: String(item.title),
        category: item.category,
        subject: item.subject,
        ...(typeof item.examYear === 'number' ? { examYear: item.examYear } : {}),
        ...(typeof item.examMonth === 'string' ? { examMonth: item.examMonth } : {}),
        language: String(item.language),
        ...(typeof item.questionCount === 'number' ? { questionCount: item.questionCount } : {}),
        ...(typeof item.pageCount === 'number' ? { pageCount: item.pageCount } : {}),
        hasAnswers: Boolean(item.hasAnswers),
        hasSolutions: Boolean(item.hasSolutions),
        isFree: Boolean(item.isFree),
        fileCount: Number(item.fileCount ?? 0),
        href: `/${input.locale === 'en' ? 'en' : 'zh'}/past-papers/download/${encodeURIComponent(String(item.slug))}`
      }));
    return { items };
  }

  async getLearningProfile(actorUserId: number) {
    const [profile, availability] = await Promise.all([
      this.prisma.studentProfile.findUnique({
        where: { userId: actorUserId },
        select: {
          educationStageCode: true,
          gradeCode: true,
          genderCode: true,
          countryCode: true,
          graduationYear: true,
          targetSubjectCodes: true,
          preferredQuestionLanguageCode: true,
          targetExamDate: true,
          examAttemptType: true,
          weeklyGoalDays: true,
          targetMajorCategoryCode: true
        }
      }),
      this.prisma.studyAvailabilityPreference.findFirst({
        where: { userId: actorUserId, status: 'active' },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      })
    ]);
    const targetSubjectCodes = jsonStringArray(profile?.targetSubjectCodes)
      .filter((subject): subject is CscaSubjectCode => CscaSubjectCodeSchema.safeParse(subject).success);
    return {
      educationStageCode: profile?.educationStageCode ?? null,
      gradeCode: profile?.gradeCode ?? null,
      genderCode: profile?.genderCode ?? null,
      countryCode: profile?.countryCode ?? null,
      graduationYear: profile?.graduationYear ?? null,
      targetSubjectCodes,
      preferredQuestionLanguageCode: profile?.preferredQuestionLanguageCode === 'en'
        ? 'en'
        : profile?.preferredQuestionLanguageCode === 'bilingual'
          ? 'bilingual'
          : profile?.preferredQuestionLanguageCode
            ? 'zh'
            : null,
      targetExamDate: profile?.targetExamDate?.toISOString().slice(0, 10) ?? null,
      examAttemptType: profile?.examAttemptType ?? null,
      weeklyGoalDays: profile?.weeklyGoalDays ?? null,
      studyAvailability: this.mapAvailability(availability),
      targetMajorCategoryCode: profile?.targetMajorCategoryCode ?? null
    };
  }

  async getScoreGoal(actorUserId: number) {
    const goal = await this.prisma.studentScoreGoal.findFirst({
      where: { userId: actorUserId, status: 'active' },
      include: { subjects: { orderBy: [{ priority: 'asc' }, { subjectCode: 'asc' }] } },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    });
    if (!goal) return { status: 'unset' as const, goal: null };
    return {
      status: 'configured' as const,
      goal: {
        goalId: goal.id,
        examSystemCode: goal.examSystemCode,
        examBatchCode: goal.examBatchCode,
        examDate: goal.examDate.toISOString().slice(0, 10),
        goalVersion: String(goal.version),
        totalTargetScore: goal.totalTargetScore,
        scoringPolicyVersion: goal.scoringPolicyVersion,
        source: goal.source,
        effectiveAt: goal.effectiveAt.toISOString(),
        subjects: goal.subjects.flatMap((subject) => {
          const parsed = CscaSubjectCodeSchema.safeParse(subject.subjectCode);
          return parsed.success ? [{ subject: parsed.data, targetScore: subject.targetScore, priority: subject.priority }] : [];
        })
      }
    };
  }

  async getStudyAvailability(actorUserId: number) {
    const availability = await this.prisma.studyAvailabilityPreference.findFirst({
      where: { userId: actorUserId, status: 'active' },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    });
    return this.mapAvailability(availability);
  }

  async getSubjectMastery(actorUserId: number, input: { subject?: CscaSubjectCode; limit?: number }) {
    const subjects = input.subject ? [input.subject] : SUBJECTS;
    const rows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId: actorUserId, subject: { in: subjects } },
      orderBy: [{ subject: 'asc' }, { mastery: 'asc' }, { confidence: 'asc' }, { updatedAt: 'desc' }],
      take: input.limit ?? 50
    });
    const topics = rows.length
      ? await this.prisma.cscaExamTopic.findMany({
          where: { id: { in: [...new Set(rows.map((row) => row.topicId))] }, status: 'published' },
          select: { id: true, code: true, title: true }
        })
      : [];
    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    return {
      stateSource: 'user_csca_topic_mastery_v1' as const,
      subjects: subjects.map((subject) => {
        const subjectRows = rows.filter((row) => row.subject === subject && topicMap.has(row.topicId));
        const weightedAttempts = subjectRows.reduce((sum, row) => sum + row.attemptCount, 0);
        return {
          subject,
          score: weightedAttempts
            ? subjectRows.reduce((sum, row) => sum + row.mastery * Math.max(1, row.attemptCount), 0) /
              subjectRows.reduce((sum, row) => sum + Math.max(1, row.attemptCount), 0)
            : undefined,
          evidenceCount: weightedAttempts,
          topics: subjectRows.map((row) => ({
            topicId: row.topicId,
            code: topicMap.get(row.topicId)!.code,
            title: topicMap.get(row.topicId)!.title,
            score: row.mastery,
            confidence: row.confidence,
            status: masteryStatus(row.mastery, row.confidence, row.attemptCount),
            attemptCount: row.attemptCount,
            correctCount: row.correctCount,
            lastPracticedAt: row.lastPracticedAt?.toISOString() ?? null,
            updatedAt: row.updatedAt.toISOString()
          }))
        };
      })
    };
  }

  async getReviewQueue(actorUserId: number, input: { subject?: CscaSubjectCode; language?: 'zh' | 'en'; limit?: number }) {
    const rows = await this.prisma.cscaWrongPattern.findMany({
      where: {
        userId: actorUserId,
        status: { in: ['active', 'improving'] },
        ...(input.subject ? { subject: input.subject } : {})
      },
      include: { topic: { select: { title: true } } },
      orderBy: [{ nextReviewAt: 'asc' }, { recurrenceCount: 'desc' }, { lastWrongAt: 'desc' }],
      take: input.limit ?? 10
    });
    return {
      items: rows.map((row) => {
        const metadata = jsonRecord(row.metadata);
        return {
        reviewItemId: row.id,
        patternType: row.patternType,
        topicId: row.topicId ?? undefined,
        subject: row.subject,
        title: row.topic?.title ?? (input.language === 'en' ? 'General review' : '综合复习'),
        dueAt: row.nextReviewAt?.toISOString() ?? null,
        priority: reviewPriority(row),
        recurrenceCount: row.recurrenceCount,
        status: row.status,
        consecutiveVerificationPassCount: Math.max(0, Number(metadata.consecutiveVerificationPassCount ?? 0) || 0),
        requiredConsecutiveVerificationPassCount: Math.max(1, Number(metadata.requiredConsecutiveVerificationPassCount ?? 2) || 2),
        lastVerificationPassedAt: typeof metadata.lastVerificationPassedAt === 'string' ? metadata.lastVerificationPassedAt : null,
        href: `/csca-special-practice/${row.subject}?reviewPattern=${encodeURIComponent(row.patternType)}${row.topicId ? `&topicId=${row.topicId}` : ''}`
      }})
    };
  }

  async listMockExamAttempts(actorUserId: number, input: { status?: 'in_progress' | 'submitted' | 'all'; subject?: CscaSubjectCode; limit?: number }) {
    const status = input.status ?? 'all';
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: {
        userId: actorUserId,
        ...(status === 'in_progress' ? { submittedAt: null } : status === 'submitted' ? { submittedAt: { not: null } } : {}),
        ...(input.subject ? { paper: { subject: input.subject } } : {})
      },
      include: { paper: { select: { slug: true, title: true, subject: true, questionCount: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit ?? 10
    });
    return {
      items: attempts.map((attempt) => ({
        attemptId: String(attempt.id),
        paperSlug: attempt.paper.slug,
        title: attempt.paper.title,
        subject: attempt.paper.subject,
        status: attempt.submittedAt ? 'submitted' as const : 'in_progress' as const,
        answeredCount: answeredCount(attempt.answers),
        questionCount: attempt.paper.questionCount,
        score: attempt.score,
        updatedAt: attempt.updatedAt.toISOString(),
        attemptPath: `/csca-mock-exam/attempts/${attempt.id}`,
        reportPath: attempt.submittedAt ? `/csca-mock-exam/attempts/${attempt.id}/report` : null
      }))
    };
  }

  async getQuestionSupplyStatus(input: {
    subject: CscaSubjectCode;
    topicIds?: number[];
    difficulty?: string;
    questionType?: string;
    requestedCount?: number;
  }) {
    const requestedCount = input.requestedCount ?? 5;
    if (input.topicIds?.length) {
      const publishedTopicCount = await this.prisma.cscaExamTopic.count({
        where: { id: { in: input.topicIds }, subject: input.subject, status: 'published' }
      });
      if (publishedTopicCount !== new Set(input.topicIds).size) {
        throw new LearningCapabilityError('RESOURCE_NOT_FOUND', 'One or more topics are unavailable for this subject.');
      }
    }
    const cscaCount = await this.prisma.cscaQuestion.count({
      where: {
        subject: input.subject,
        status: { in: ['approved', 'published'] },
        ...(input.topicIds?.length ? { topicId: { in: input.topicIds } } : {}),
        ...(input.difficulty ? { designedDifficulty: input.difficulty } : {}),
        ...(input.questionType ? { questionType: input.questionType } : {}),
        OR: [{ qualityMetric: null }, { qualityMetric: { needsReview: false } }]
      }
    });
    const specialPracticeCount = input.topicIds?.length || input.questionType
      ? 0
      : await this.prisma.specialPracticeQuestion.count({
          where: {
            status: 'published',
            topic: { subject: input.subject, status: 'published' },
            ...(input.difficulty ? { difficulty: input.difficulty } : {})
          }
        });
    const availableCount = cscaCount + specialPracticeCount;
    return {
      subject: input.subject,
      requestedCount,
      availableCount,
      status: availableCount >= requestedCount ? 'sufficient' as const : availableCount ? 'limited' as const : 'empty' as const,
      canCreatePractice: availableCount >= requestedCount,
      sourceBreakdown: {
        cscaPublished: cscaCount,
        specialPracticePublished: specialPracticeCount
      },
      filters: {
        topicIds: input.topicIds ?? [],
        difficulty: input.difficulty ?? null,
        questionType: input.questionType ?? null
      },
      generatedAt: new Date().toISOString()
    };
  }

  async getInterventionStability(actorUserId: number, input: { verificationId: string }) {
    const verification = await this.prisma.learningInterventionVerification.findFirst({
      where: { id: input.verificationId, userId: actorUserId },
      include: {
        outcome: true,
        sourceDelivery: {
          include: {
            stabilityAssessment: true,
            verifications: { include: { outcome: true }, orderBy: { dueAt: 'asc' } }
          }
        }
      }
    });
    if (!verification) {
      throw new LearningCapabilityError('RESOURCE_NOT_FOUND', 'Intervention verification is unavailable.');
    }
    const phase = (value: string) => value === 'retention' || value === 'transfer' ? value : 'immediate';
    const phaseResult = (value: string | null | undefined) =>
      value === 'passed' || value === 'failed' || value === 'inconclusive' ? value : null;
    const assessment = verification.sourceDelivery.stabilityAssessment;
    const scheduled = verification.sourceDelivery.verifications
      .filter((item) => item.status === 'scheduled' && item.dueAt.getTime() > Date.now())
      .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime())[0];
    return {
      verificationId: verification.id,
      deliveryId: verification.deliveryId,
      subjectCode: verification.subjectCode,
      currentPhase: phase(verification.phase),
      currentPhaseStatus: verification.status,
      currentPhaseResult: phaseResult(verification.outcome?.result),
      stabilityStatus: assessment?.status === 'completed' ? 'completed' as const : 'pending' as const,
      stabilityResult: assessment?.result === 'stable' || assessment?.result === 'not_stable' || assessment?.result === 'inconclusive'
        ? assessment.result : null,
      policyVersion: assessment?.policyVersion ?? 'intervention-stability-immediate-retention-transfer-v1',
      evaluatedAt: assessment?.evaluatedAt?.toISOString() ?? null,
      nextDueAt: scheduled?.dueAt.toISOString() ?? null,
      phases: verification.sourceDelivery.verifications.map((item) => ({
        phase: phase(item.phase),
        status: item.status,
        result: phaseResult(item.outcome?.result),
        accuracy: item.outcome?.accuracy ?? null,
        dueAt: item.dueAt.toISOString(),
        evaluatedAt: item.outcome?.evaluatedAt.toISOString() ?? null
      }))
    };
  }

  private mapAvailability(availability: {
    version: number;
    timezone: string;
    weeklyMinutesGoal: number | null;
    preferredStudyDays: Prisma.JsonValue;
    defaultSessionMinutes: number | null;
    source: string;
    effectiveAt: Date;
  } | null) {
    if (!availability) {
      return {
        availabilityVersion: 'unset',
        timezone: 'UTC',
        weeklyMinutesGoal: null,
        preferredStudyDays: [],
        defaultSessionMinutes: null,
        source: 'unset' as const,
        effectiveAt: null
      };
    }
    return {
      availabilityVersion: String(availability.version),
      timezone: availability.timezone,
      weeklyMinutesGoal: availability.weeklyMinutesGoal,
      preferredStudyDays: preferredDays(availability.preferredStudyDays),
      defaultSessionMinutes: availability.defaultSessionMinutes,
      source: availability.source === 'user' ? 'user' as const : 'account_default' as const,
      effectiveAt: availability.effectiveAt.toISOString()
    };
  }
}
