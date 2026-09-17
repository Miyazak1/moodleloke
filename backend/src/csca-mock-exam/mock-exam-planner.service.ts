import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockExamPaperSummary, MockExamSubject } from './csca-mock-exam.types';

type PlannerAttempt = {
  id: number;
  paper: MockExamPaperSummary;
  score: number | null;
  submittedAt: Date | null;
};

export type MockExamPlannerTarget =
  | { type: 'attempt'; attemptId: number }
  | { type: 'paper'; paperSlug: string };

export type MockExamPlannerRecommendation = {
  mode: 'resume_attempt' | 'initial_diagnostic' | 'remediate_low_score' | 'mastery_bridge' | 'maintain_pace';
  label: string;
  title: string;
  body: string;
  actionLabel: string;
  target: MockExamPlannerTarget;
  paper: MockExamPaperSummary | null;
  scoreLabel: string;
  masteryLabel: string;
};

function formatMasteryLabel(averageMastery: number | null) {
  return averageMastery === null ? '未诊断' : `${Math.round(averageMastery)}%`;
}

function formatScoreLabel(score: number | null | undefined) {
  return score === null || score === undefined ? '暂无成绩' : `${score} 分`;
}

@Injectable()
export class MockExamPlannerService {
  constructor(private readonly prisma: PrismaService) {}

  async recommendNextPaper(userId: number | undefined, subject: MockExamSubject, subjectLabel: string, papers: MockExamPaperSummary[]): Promise<MockExamPlannerRecommendation | null> {
    const availablePapers = papers.filter((paper) => !paper.isLocked);
    const firstAvailable = availablePapers[0] ?? papers[0];
    if (!firstAvailable) return null;

    const [attempts, averageMastery] = await Promise.all([
      userId ? this.listSubjectAttempts(userId, subject) : Promise.resolve([]),
      userId ? this.getAverageMastery(userId, subject) : Promise.resolve(null)
    ]);

    const activeAttempt = attempts.find((attempt) => !attempt.submittedAt);
    const latestAttempt = attempts[0];
    const attemptedSlugs = new Set(attempts.map((attempt) => attempt.paper.slug));
    const recommendedPaper = availablePapers.find((paper) => !attemptedSlugs.has(paper.slug)) ?? firstAvailable;
    const masteryLabel = formatMasteryLabel(averageMastery);
    const scoreLabel = formatScoreLabel(latestAttempt?.score);

    if (activeAttempt) {
      const activePaper = papers.find((paper) => paper.slug === activeAttempt.paper.slug) ?? activeAttempt.paper;
      return {
        mode: 'resume_attempt',
        label: '未完成模考',
        title: `继续完成 ${activePaper.title}`,
        body: `你有一套${subjectLabel}模考还没有交卷，先回到原进度，避免数据断层影响后续推荐。`,
        actionLabel: '继续作答',
        target: { type: 'attempt', attemptId: activeAttempt.id },
        paper: activePaper,
        scoreLabel,
        masteryLabel
      };
    }

    if (!attempts.length) {
      return {
        mode: 'initial_diagnostic',
        label: '首轮诊断',
        title: `先做 ${recommendedPaper.title}`,
        body: `这套卷会作为${subjectLabel}整卷节奏的初始诊断，提交后再结合专项掌握度安排下一套。`,
        actionLabel: '开始推荐卷',
        target: { type: 'paper', paperSlug: recommendedPaper.slug },
        paper: recommendedPaper,
        scoreLabel,
        masteryLabel
      };
    }

    if ((latestAttempt?.score ?? 100) < 60) {
      return {
        mode: 'remediate_low_score',
        label: '优先补弱',
        title: `下一套建议：${recommendedPaper.title}`,
        body: `最近一次模考为 ${scoreLabel}。建议继续做一套完整卷，观察错题是否集中在同一类知识点。`,
        actionLabel: '按推荐继续',
        target: { type: 'paper', paperSlug: recommendedPaper.slug },
        paper: recommendedPaper,
        scoreLabel,
        masteryLabel
      };
    }

    if (averageMastery !== null && averageMastery < 70) {
      return {
        mode: 'mastery_bridge',
        label: '掌握度联动',
        title: `用 ${recommendedPaper.title} 验证薄弱点`,
        body: `当前专项掌握度 ${masteryLabel}。先用完整卷检验题型迁移，再回到专项训练补细节。`,
        actionLabel: '进入推荐卷',
        target: { type: 'paper', paperSlug: recommendedPaper.slug },
        paper: recommendedPaper,
        scoreLabel,
        masteryLabel
      };
    }

    return {
      mode: 'maintain_pace',
      label: '保持节奏',
      title: `下一套建议：${recommendedPaper.title}`,
      body: `最近一次模考 ${scoreLabel}，专项掌握度 ${masteryLabel}。继续按整卷节奏训练时间分配和稳定性。`,
      actionLabel: '继续模考',
      target: { type: 'paper', paperSlug: recommendedPaper.slug },
      paper: recommendedPaper,
      scoreLabel,
      masteryLabel
    };
  }

  private async listSubjectAttempts(userId: number, subject: MockExamSubject): Promise<PlannerAttempt[]> {
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId, paper: { subject } },
      include: { paper: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 20
    });
    return attempts.map((attempt) => ({
      id: attempt.id,
      paper: {
        id: attempt.paper.id,
        subject: attempt.paper.subject as MockExamSubject,
        slug: attempt.paper.slug,
        title: attempt.paper.title,
        description: attempt.paper.description ?? undefined,
        language: attempt.paper.language,
        questionCount: attempt.paper.questionCount,
        durationMinutes: attempt.paper.durationMinutes,
        priceLabel: attempt.paper.priceLabel ?? undefined,
        isFree: attempt.paper.isFree,
        isLocked: attempt.paper.isLocked
      },
      score: attempt.score,
      submittedAt: attempt.submittedAt
    }));
  }

  private async getAverageMastery(userId: number, subject: MockExamSubject) {
    const rows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, subject },
      select: { mastery: true }
    });
    if (!rows.length) return null;
    return Math.round((rows.reduce((sum, row) => sum + row.mastery, 0) / rows.length) * 100);
  }
}
