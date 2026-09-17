import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LEARNING_STATE_MODEL_VERSION } from '../evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';

@Injectable()
export class LearningStateShadowQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService
  ) {}

  async compareUserSubject(userId: number, subjectCode: 'math' | 'physics' | 'chemistry') {
    if (!this.featureFlags.isEnabled('shadowProjection')) return { enabled: false, modelVersion: LEARNING_STATE_MODEL_VERSION, items: [] };
    const [v1Rows, v2Rows] = await Promise.all([
      this.prisma.userCscaTopicMastery.findMany({ where: { userId, subject: subjectCode }, orderBy: { topicId: 'asc' } }),
      this.prisma.userCscaTopicStateV2.findMany({
        where: { userId, subjectCode, modelVersion: LEARNING_STATE_MODEL_VERSION },
        orderBy: { topicId: 'asc' }
      })
    ]);
    const v1 = new Map(v1Rows.map((row) => [row.topicId, row]));
    return {
      enabled: true,
      modelVersion: LEARNING_STATE_MODEL_VERSION,
      items: v2Rows.map((row) => ({
        topicId: row.topicId,
        v1Mastery: v1.get(row.topicId)?.mastery ?? null,
        v2Mastery: row.mastery,
        masteryDelta: v1.has(row.topicId) ? Number((row.mastery - v1.get(row.topicId)!.mastery).toFixed(6)) : null,
        confidence: row.confidence,
        independence: row.independence,
        retention: row.retention,
        fluency: row.fluency,
        transfer: row.transfer,
        consistency: row.consistency,
        coverage: row.coverage,
        evidenceCount: row.evidenceCount,
        stateVersion: row.stateVersion,
        lastEvidenceAt: row.lastEvidenceAt?.toISOString() ?? null
      }))
    };
  }
}
