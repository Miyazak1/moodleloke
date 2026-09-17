import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningEvidenceEventV1, LearningEvidenceEventV1Schema } from '../contracts/learning-intelligence.contracts';
import { LEARNING_STATE_MODEL_VERSION, LEARNING_STATE_PROJECTOR_VERSION } from '../evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import { LearningTopicState, projectLearningTopicState } from './learning-state-projection.model';
import { LearningInterventionShadowService } from '../intervention/learning-intervention-shadow.service';

const PROJECTION_LOCK_NAMESPACE = 2_147_001_212;
const MAX_PROJECTION_ATTEMPTS = 8;

type ProjectionResult = 'processed' | 'duplicate' | 'deferred' | 'failed';

function subjectLockKey(subject: string): number {
  return subject === 'math' ? 1 : subject === 'physics' ? 2 : 3;
}
function eventFromRow(row: {
  schemaVersion: string; eventId: string; eventSequence: bigint; userId: number; subjectCode: string;
  occurredAt: Date; recordedAt: Date; sourceType: string; sourceId: string; attemptSequence: number;
  sessionId: string | null; questionId: string; questionVersion: number; answerKeyVersion: string;
  topicMappingVersion: string; scoringRubricVersion: string | null; exposureState: string;
  topicEvidence: Prisma.JsonValue; outcome: string; firstAttempt: boolean; usedHint: boolean;
  usedExplanation: boolean; timeSpentSeconds: number | null; difficulty: string | null;
  questionQualityConfidence: number; metadata: Prisma.JsonValue | null;
}): LearningEvidenceEventV1 {
  return LearningEvidenceEventV1Schema.parse({
    schemaVersion: row.schemaVersion,
    eventId: row.eventId,
    eventSequence: String(row.eventSequence),
    userId: row.userId,
    subjectCode: row.subjectCode,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    attemptSequence: row.attemptSequence,
    sessionId: row.sessionId ?? undefined,
    questionId: row.questionId,
    questionVersion: row.questionVersion,
    answerKeyVersion: row.answerKeyVersion,
    topicMappingVersion: row.topicMappingVersion,
    scoringRubricVersion: row.scoringRubricVersion ?? undefined,
    exposureState: row.exposureState,
    topicEvidence: row.topicEvidence,
    outcome: row.outcome,
    firstAttempt: row.firstAttempt,
    usedHint: row.usedHint,
    usedExplanation: row.usedExplanation,
    timeSpentSeconds: row.timeSpentSeconds ?? undefined,
    difficulty: row.difficulty ?? undefined,
    questionQualityConfidence: row.questionQualityConfidence,
    metadata: row.metadata ?? undefined
  });
}

function dbState(row: {
  mastery: number; confidence: number; independence: number; difficultyCeiling: string | null;
  retention: number; fluency: number; transfer: number; consistency: number; coverage: number;
  misconceptionState: Prisma.JsonValue | null; evidenceCount: number; lastEvidenceAt: Date | null;
} | null): LearningTopicState | null {
  if (!row) return null;
  return {
    ...row,
    misconceptionState: row.misconceptionState && typeof row.misconceptionState === 'object' && !Array.isArray(row.misconceptionState)
      ? row.misconceptionState as Record<string, unknown>
      : null
  };
}

@Injectable()
export class LearningStateProjectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService,
    private readonly interventions?: LearningInterventionShadowService
  ) {}

  async processPending(limitValue = 50) {
    if (!this.featureFlags.isEnabled('shadowProjection')) return { enabled: false, claimed: 0, processed: 0, duplicate: 0, deferred: 0, failed: 0 };
    const limit = Math.min(Math.max(Math.floor(limitValue), 1), 200);
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.learningEvidenceOutbox.updateMany({
      where: { status: 'processing', claimedAt: { lt: staleBefore } },
      data: { status: 'pending', claimedAt: null, lastErrorCode: 'STALE_CLAIM_RECOVERED' }
    });
    const candidates = await this.prisma.learningEvidenceOutbox.findMany({
      where: { status: 'pending', availableAt: { lte: new Date() } },
      select: { id: true },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      take: limit
    });
    const summary = { enabled: true, claimed: 0, processed: 0, duplicate: 0, deferred: 0, failed: 0 };
    for (const candidate of candidates) {
      const claim = await this.prisma.learningEvidenceOutbox.updateMany({
        where: { id: candidate.id, status: 'pending' },
        data: { status: 'processing', claimedAt: new Date(), attemptCount: { increment: 1 }, lastErrorCode: null }
      });
      if (claim.count !== 1) continue;
      summary.claimed += 1;
      const result = await this.projectClaimed(candidate.id);
      summary[result] += 1;
      if (result === 'processed') await this.evaluateInterventionForOutbox(candidate.id);
    }
    return summary;
  }

  async replayUserSubject(userId: number, subjectCode: 'math' | 'physics' | 'chemistry') {
    if (!this.featureFlags.isEnabled('shadowProjection')) return { enabled: false, events: 0, topics: 0, stateVersion: null };
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROJECTION_LOCK_NAMESPACE}::int, ${(userId * 10 + subjectLockKey(subjectCode))}::int)`;
      const allEvents = await tx.learningEvidenceEvent.findMany({
        where: { userId, subjectCode },
        include: { retraction: true },
        orderBy: [{ eventSequence: 'asc' }, { id: 'asc' }]
      });
      const events = allEvents.filter((event) => !event.retraction);
      await tx.userCscaTopicStateV2.deleteMany({ where: { userId, subjectCode, modelVersion: LEARNING_STATE_MODEL_VERSION } });
      await tx.learningStateProjectionCheckpoint.deleteMany({
        where: { userId, subjectCode, projectorVersion: LEARNING_STATE_PROJECTOR_VERSION }
      });
      const states = new Map<number, LearningTopicState>();
      let lastVersion: string | null = null;
      for (const row of events) {
        const event = eventFromRow(row);
        for (const topic of event.topicEvidence) {
          states.set(topic.topicId, projectLearningTopicState(states.get(topic.topicId) ?? null, event, topic.weight));
        }
        lastVersion = this.stateVersion(event);
      }
      const latestRetraction = allEvents.reduce<Date | null>((latest, event) => {
        const createdAt = event.retraction?.createdAt ?? null;
        return createdAt && (!latest || createdAt > latest) ? createdAt : latest;
      }, null);
      const replayVersion = latestRetraction && allEvents.length
        ? `${this.stateVersion(eventFromRow(allEvents[allEvents.length - 1]))}:r${latestRetraction.getTime()}`.slice(0, 80)
        : lastVersion;
      for (const [topicId, state] of states) {
        await this.writeState(tx, userId, subjectCode, topicId, state, replayVersion!);
      }
      if (allEvents.length) {
        const last = allEvents[allEvents.length - 1];
        await tx.learningStateProjectionCheckpoint.create({
          data: {
            userId,
            subjectCode,
            projectorVersion: LEARNING_STATE_PROJECTOR_VERSION,
            lastEventSequence: last.eventSequence,
            lastEvidenceVersion: replayVersion
          }
        });
      }
      return { enabled: true, events: events.length, retracted: allEvents.length - events.length, topics: states.size, stateVersion: replayVersion };
    });
    await this.interventions?.evaluateUserSubject(userId, subjectCode).catch(() => undefined);
    return result;
  }

  private async evaluateInterventionForOutbox(outboxId: string) {
    if (!this.interventions) return;
    try {
      const row = await this.prisma.learningEvidenceOutbox.findUnique({ where: { id: outboxId }, select: { evidence: { select: { userId: true, subjectCode: true } } } });
      const subject = row?.evidence.subjectCode;
      if (row && (subject === 'math' || subject === 'physics' || subject === 'chemistry')) await this.interventions.evaluateUserSubject(row.evidence.userId, subject);
    } catch {
      // Shadow intervention decisions must never fail the primary evidence projection.
    }
  }

  private async projectClaimed(outboxId: string): Promise<ProjectionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const outbox = await tx.learningEvidenceOutbox.findFirst({
          where: { id: outboxId, status: 'processing' },
          include: { evidence: { include: { retraction: true } } }
        });
        if (!outbox) return 'duplicate' as const;
        if (outbox.evidence.retraction) {
          await tx.learningEvidenceOutbox.update({ where: { id: outbox.id }, data: { status: 'processed', processedAt: new Date(), claimedAt: null } });
          return 'duplicate' as const;
        }
        const event = eventFromRow(outbox.evidence);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROJECTION_LOCK_NAMESPACE}::int, ${(event.userId * 10 + subjectLockKey(event.subjectCode))}::int)`;
        const checkpoint = await tx.learningStateProjectionCheckpoint.findUnique({
          where: {
            userId_subjectCode_projectorVersion: {
              userId: event.userId,
              subjectCode: event.subjectCode,
              projectorVersion: LEARNING_STATE_PROJECTOR_VERSION
            }
          }
        });
        const lastSequence = checkpoint?.lastEventSequence ?? 0n;
        const sequence = BigInt(event.eventSequence);
        if (sequence <= lastSequence) {
          await tx.learningEvidenceOutbox.update({ where: { id: outbox.id }, data: { status: 'processed', processedAt: new Date(), claimedAt: null } });
          return 'duplicate' as const;
        }
        if (sequence !== lastSequence + 1n) {
          await tx.learningEvidenceOutbox.update({
            where: { id: outbox.id },
            data: { status: 'pending', claimedAt: null, availableAt: new Date(Date.now() + 1000), lastErrorCode: 'OUT_OF_ORDER_WAIT' }
          });
          return 'deferred' as const;
        }
        const stateVersion = this.stateVersion(event);
        for (const topic of event.topicEvidence) {
          const existing = await tx.userCscaTopicStateV2.findUnique({
            where: {
              userId_subjectCode_topicId_modelVersion: {
                userId: event.userId,
                subjectCode: event.subjectCode,
                topicId: topic.topicId,
                modelVersion: LEARNING_STATE_MODEL_VERSION
              }
            }
          });
          const next = projectLearningTopicState(dbState(existing), event, topic.weight);
          await this.writeState(tx, event.userId, event.subjectCode, topic.topicId, next, stateVersion);
        }
        await tx.learningStateProjectionCheckpoint.upsert({
          where: {
            userId_subjectCode_projectorVersion: {
              userId: event.userId,
              subjectCode: event.subjectCode,
              projectorVersion: LEARNING_STATE_PROJECTOR_VERSION
            }
          },
          create: {
            userId: event.userId,
            subjectCode: event.subjectCode,
            projectorVersion: LEARNING_STATE_PROJECTOR_VERSION,
            lastEventSequence: sequence,
            lastEvidenceVersion: stateVersion
          },
          update: { lastEventSequence: sequence, lastEvidenceVersion: stateVersion }
        });
        await tx.learningEvidenceOutbox.update({
          where: { id: outbox.id },
          data: { status: 'processed', processedAt: new Date(), claimedAt: null, lastErrorCode: null }
        });
        return 'processed' as const;
      });
    } catch {
      const row = await this.prisma.learningEvidenceOutbox.findUnique({ where: { id: outboxId }, select: { attemptCount: true } });
      const terminal = (row?.attemptCount ?? MAX_PROJECTION_ATTEMPTS) >= MAX_PROJECTION_ATTEMPTS;
      await this.prisma.learningEvidenceOutbox.updateMany({
        where: { id: outboxId, status: 'processing' },
        data: {
          status: terminal ? 'failed' : 'pending',
          claimedAt: null,
          availableAt: new Date(Date.now() + Math.min(60_000, 2 ** Math.min(row?.attemptCount ?? 1, 6) * 1000)),
          lastErrorCode: 'PROJECTION_FAILED'
        }
      });
      return 'failed';
    }
  }

  private writeState(
    tx: Prisma.TransactionClient,
    userId: number,
    subjectCode: string,
    topicId: number,
    state: LearningTopicState,
    stateVersion: string
  ) {
    const data = {
      stateVersion,
      mastery: state.mastery,
      confidence: state.confidence,
      independence: state.independence,
      difficultyCeiling: state.difficultyCeiling,
      retention: state.retention,
      fluency: state.fluency,
      transfer: state.transfer,
      consistency: state.consistency,
      coverage: state.coverage,
      misconceptionState: state.misconceptionState as Prisma.InputJsonValue,
      evidenceCount: state.evidenceCount,
      lastEvidenceAt: state.lastEvidenceAt
    };
    return tx.userCscaTopicStateV2.upsert({
      where: { userId_subjectCode_topicId_modelVersion: { userId, subjectCode, topicId, modelVersion: LEARNING_STATE_MODEL_VERSION } },
      create: { userId, subjectCode, topicId, modelVersion: LEARNING_STATE_MODEL_VERSION, ...data },
      update: data
    });
  }

  private stateVersion(event: LearningEvidenceEventV1): string {
    return `${LEARNING_STATE_MODEL_VERSION}:${event.userId}:${event.subjectCode}:${event.eventSequence}`;
  }
}
