import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CscaAdaptiveService } from '../csca-special-practice/csca-adaptive.service';
import { PrismaService } from '../prisma/prisma.service';

function positiveInteger(value: unknown, message: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException(message);
  return parsed;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

@Injectable()
export class AgentPracticeQuestionContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adaptive: CscaAdaptiveService
  ) {}

  async resolve(userId: number, roundIdValue: unknown, questionIdValue: unknown, language = 'zh') {
    const roundId = positiveInteger(roundIdValue, '训练轮次无效。');
    const questionId = positiveInteger(questionIdValue, '题目无效。');
    const accepted = await this.prisma.learningPrescriptionOutcome.findFirst({
      where: { userId, decision: 'accepted', domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId) },
      orderBy: { createdAt: 'desc' }
    });
    const artifactId = String(objectValue(accepted?.metadata).artifactId ?? '');
    const artifact = artifactId
      ? await this.prisma.agentArtifact.findFirst({ where: { id: artifactId, userId, type: 'learning_plan' } })
      : null;
    if (!accepted || !artifact) throw new NotFoundException('该轮次不是当前用户的 Agent 学习任务。');
    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id: roundId, session: { userId } },
      include: { session: { select: { id: true, subject: true } }, items: true }
    });
    const item = round?.items.find((candidate) => candidate.questionId === questionId);
    if (!round || !item) throw new NotFoundException('训练题目不存在。');
    const detail = await this.adaptive.getRound(userId, String(roundId), language);
    const question = detail.questions.find((candidate) => candidate.id === questionId);
    if (!question) throw new NotFoundException('训练题目不存在。');
    return { artifact, round, item, question, roundId, questionId, sessionId: round.session.id, subject: round.session.subject };
  }
}
