import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clamp } from './csca-adaptive.types';
import { SpecialPracticeSubject } from './csca-special-practice.types';

type MasteryEvidence = {
  userId: number;
  subject: SpecialPracticeSubject;
  topicId: number;
  isCorrect: boolean;
  difficulty?: string | null;
  usedHint?: boolean;
  usedExplanation?: boolean;
};

function difficultyWeight(difficulty?: string | null) {
  const value = String(difficulty ?? '').trim();
  if (value.includes('挑战')) return 1.3;
  if (value.includes('较难') || value.includes('提高')) return 1.15;
  if (value.includes('中')) return 1;
  return 0.85;
}

function assistWeight(evidence: MasteryEvidence) {
  if (evidence.usedExplanation) return 0.2;
  if (evidence.usedHint) return 0.5;
  return 1;
}

@Injectable()
export class MasteryEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async updateFromRound(evidenceItems: MasteryEvidence[]) {
    const changes = [];
    for (const evidence of evidenceItems) {
      const existing = await this.prisma.userCscaTopicMastery.findUnique({
        where: { userId_topicId: { userId: evidence.userId, topicId: evidence.topicId } }
      });
      const previousMastery = existing?.mastery ?? 0.5;
      const previousConfidence = existing?.confidence ?? 0.2;
      const weight = difficultyWeight(evidence.difficulty);
      const delta = evidence.isCorrect ? 0.05 * weight * assistWeight(evidence) : -0.08 * weight;
      const nextMastery = clamp(previousMastery + delta);
      const nextConfidence = clamp(previousConfidence + 0.04, 0, 0.95);
      const nextAttemptCount = (existing?.attemptCount ?? 0) + 1;
      const nextCorrectCount = (existing?.correctCount ?? 0) + (evidence.isCorrect ? 1 : 0);

      const updated = await this.prisma.userCscaTopicMastery.upsert({
        where: { userId_topicId: { userId: evidence.userId, topicId: evidence.topicId } },
        create: {
          userId: evidence.userId,
          subject: evidence.subject,
          topicId: evidence.topicId,
          mastery: nextMastery,
          confidence: nextConfidence,
          attemptCount: nextAttemptCount,
          correctCount: nextCorrectCount,
          lastPracticedAt: new Date()
        },
        update: {
          subject: evidence.subject,
          mastery: nextMastery,
          confidence: nextConfidence,
          attemptCount: nextAttemptCount,
          correctCount: nextCorrectCount,
          lastPracticedAt: new Date()
        }
      });

      changes.push({
        topicId: evidence.topicId,
        previousMastery,
        mastery: updated.mastery,
        confidence: updated.confidence,
        delta: Number((updated.mastery - previousMastery).toFixed(4))
      });
    }
    return changes;
  }
}
