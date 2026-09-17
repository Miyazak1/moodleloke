import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LEARNING_STATE_MODEL_VERSION, LEARNING_STATE_PROJECTOR_VERSION } from '../evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import {
  decideLearningIntervention,
  InterventionEvidenceSignal,
  LEARNING_INTERVENTION_POLICY_VERSION
} from './learning-intervention-policy';

const RECENT_EVIDENCE_LIMIT = 80;
const TOPIC_EVIDENCE_LIMIT = 6;
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DAILY_PROPOSAL_LIMIT = 3;
const ACTIVE_MOCK_WINDOW_MS = 4 * 60 * 60 * 1000;

function jsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function topicIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(jsonObject(item).topicId)).filter((id) => Number.isInteger(id) && id > 0);
}

function keyFor(userId: number, subjectCode: string, topicId: number, stateVersion: string, suppressionCodes: string[]): string {
  return createHash('sha256').update([userId, subjectCode, topicId, stateVersion, LEARNING_INTERVENTION_POLICY_VERSION, suppressionCodes.join(',') || 'eligible'].join(':')).digest('hex');
}

@Injectable()
export class LearningInterventionShadowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService
  ) {}

  private get db(): any { return this.prisma as any; }

  async evaluateUserSubject(userId: number, subjectCode: 'math' | 'physics' | 'chemistry', at = new Date()) {
    if (!this.flags.isEnabled('interventionShadow')) return { enabled: false, evaluated: 0, proposed: 0, suppressed: 0, noop: 0, items: [] };
    const dayStart = new Date(at.getTime() - 24 * 60 * 60 * 1000);
    const mockWindowStart = new Date(at.getTime() - ACTIVE_MOCK_WINDOW_MS);
    const checkpoint = await this.db.learningStateProjectionCheckpoint.findUnique({
      where: { userId_subjectCode_projectorVersion: { userId, subjectCode, projectorVersion: LEARNING_STATE_PROJECTOR_VERSION } },
      select: { lastEventSequence: true }
    });
    if (!checkpoint) return { enabled: true, evaluated: 0, proposed: 0, suppressed: 0, noop: 0, items: [] };
    const [states, evidenceRows, recentInterventions, activeMock] = await Promise.all([
      this.db.userCscaTopicStateV2.findMany({
        where: { userId, subjectCode, modelVersion: LEARNING_STATE_MODEL_VERSION }, orderBy: { topicId: 'asc' }
      }),
      this.db.learningEvidenceEvent.findMany({
        where: { userId, subjectCode, eventSequence: { lte: checkpoint.lastEventSequence } }, include: { retraction: true }, orderBy: [{ eventSequence: 'desc' }, { id: 'desc' }], take: RECENT_EVIDENCE_LIMIT
      }),
      this.db.learningIntervention.findMany({
        where: { userId, createdAt: { gte: dayStart } }, select: { id: true, topicId: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }
      }),
      this.db.mockExamAttempt.findFirst({
        where: { userId, submittedAt: null, updatedAt: { gte: mockWindowStart } }, select: { id: true }
      })
    ]);
    const evidence = evidenceRows.filter((row: any) => !row.retraction);
    let proposalSlotsUsed = recentInterventions.filter((item: any) => item.status === 'shadow_proposed').length;
    const rows = [];
    for (const state of states) {
      const signals: InterventionEvidenceSignal[] = evidence
        .filter((row: any) => topicIds(row.topicEvidence).includes(state.topicId))
        .slice(0, TOPIC_EVIDENCE_LIMIT)
        .map((row: any) => ({
          eventId: row.eventId, outcome: row.outcome, usedHint: row.usedHint, usedExplanation: row.usedExplanation,
          sourceType: row.sourceType, quality: row.questionQualityConfidence, occurredAt: row.occurredAt
        }));
      const decision = decideLearningIntervention({
        topicId: state.topicId, stateVersion: state.stateVersion, mastery: state.mastery, confidence: state.confidence,
        independence: state.independence, retention: state.retention, transfer: state.transfer,
        evidenceCount: state.evidenceCount, incorrectCount: Number(jsonObject(state.misconceptionState).incorrectCount || 0),
        recentEvidence: signals
      });
      const suppressionCodes: string[] = [];
      if (decision.action !== 'continue_practice') {
        if (activeMock) suppressionCodes.push('FORMAL_MOCK_ACTIVE');
        if (recentInterventions.some((item: any) => item.topicId === state.topicId && item.status === 'shadow_proposed' && at.getTime() - item.createdAt.getTime() < COOLDOWN_MS)) suppressionCodes.push('COOLDOWN_ACTIVE');
        if (proposalSlotsUsed >= DAILY_PROPOSAL_LIMIT) suppressionCodes.push('DAILY_LIMIT_REACHED');
      }
      const status = decision.action === 'continue_practice' ? 'shadow_noop' : suppressionCodes.length ? 'shadow_suppressed' : 'shadow_proposed';
      const decisionKey = keyFor(userId, subjectCode, state.topicId, state.stateVersion, suppressionCodes);
      const row = await this.db.learningIntervention.upsert({
        where: { decisionKey },
        create: {
          decisionKey, userId, subjectCode, topicId: state.topicId, stateVersion: state.stateVersion,
          policyVersion: LEARNING_INTERVENTION_POLICY_VERSION, action: decision.action, status,
          urgency: decision.urgency, placement: decision.placement, triggerCodes: decision.triggerCodes,
          suppressionCodes, ...(decision.contentPlan ? { contentPlan: decision.contentPlan } : {}), reasonSummary: decision.reasonSummary,
          inputSnapshot: {
            schemaVersion: '1', state: { mastery: state.mastery, confidence: state.confidence, independence: state.independence, retention: state.retention, transfer: state.transfer, evidenceCount: state.evidenceCount },
            evidenceRefs: signals.map((item) => item.eventId), activeFormalMock: Boolean(activeMock),
            automaticQuestionGenerationInvoked: false, aiExplanationGenerated: false, studentVisible: false
          },
          evidenceCutoffAt: signals[0]?.occurredAt || state.lastEvidenceAt || null,
          expiresAt: new Date(at.getTime() + 24 * 60 * 60 * 1000)
        },
        update: {}
      });
      if (row.status === 'shadow_proposed' && row.createdAt >= dayStart && !recentInterventions.some((item: any) => item.id === row.id)) proposalSlotsUsed += 1;
      rows.push(row);
    }
    return {
      enabled: true, evaluated: rows.length,
      proposed: rows.filter((row: any) => row.status === 'shadow_proposed').length,
      suppressed: rows.filter((row: any) => row.status === 'shadow_suppressed').length,
      noop: rows.filter((row: any) => row.status === 'shadow_noop').length,
      items: rows
    };
  }
}
