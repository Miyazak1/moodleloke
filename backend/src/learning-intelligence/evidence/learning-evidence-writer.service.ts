import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LearningEvidenceEventV1,
  LearningEvidenceWriteInputV1,
  LearningEvidenceWriteInputV1Schema
} from '../contracts/learning-intelligence.contracts';
import { LearningEvidenceWriter, LearningEvidenceWriteResult } from '../learning-evidence-writer.port';

const EVIDENCE_SEQUENCE_LOCK_NAMESPACE = 2_147_001_211;
export const LEARNING_STATE_PROJECTOR_VERSION = 'ls-v1-shadow-projector-1' as const;
export const LEARNING_STATE_MODEL_VERSION = 'ls-v1-shadow-model-1' as const;

function subjectLockKey(subject: string): number {
  return subject === 'math' ? 1 : subject === 'physics' ? 2 : 3;
}

function evidenceVersion(userId: number, subject: string, sequence: bigint): string {
  return `${userId}:${subject}:${sequence}`;
}

@Injectable()
export class LearningEvidenceWriterService implements LearningEvidenceWriter {
  async appendInTransaction(
    transaction: Prisma.TransactionClient,
    evidenceValue: LearningEvidenceWriteInputV1
  ): Promise<LearningEvidenceWriteResult> {
    const evidence = LearningEvidenceWriteInputV1Schema.parse(evidenceValue);
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${EVIDENCE_SEQUENCE_LOCK_NAMESPACE}::int, ${(evidence.userId * 10 + subjectLockKey(evidence.subjectCode))}::int)`;

    const duplicate = await transaction.learningEvidenceEvent.findFirst({
      where: {
        OR: [
          { eventId: evidence.eventId },
          {
            sourceType: evidence.sourceType,
            sourceId: evidence.sourceId,
            questionId: evidence.questionId,
            attemptSequence: evidence.attemptSequence,
            schemaVersion: evidence.schemaVersion
          }
        ]
      },
      select: {
        id: true,
        eventId: true,
        eventSequence: true,
        userId: true,
        subjectCode: true,
        sourceType: true,
        sourceId: true,
        questionId: true,
        attemptSequence: true,
        schemaVersion: true
      }
    });
    if (duplicate) {
      const sameBusinessKey = duplicate.sourceType === evidence.sourceType
        && duplicate.sourceId === evidence.sourceId
        && duplicate.questionId === evidence.questionId
        && duplicate.attemptSequence === evidence.attemptSequence
        && duplicate.schemaVersion === evidence.schemaVersion;
      if (duplicate.userId !== evidence.userId || duplicate.subjectCode !== evidence.subjectCode || !sameBusinessKey) {
        throw new Error('LEARNING_EVIDENCE_IDEMPOTENCY_CONFLICT');
      }
      const checkpoint = await transaction.learningStateProjectionCheckpoint.findUnique({
        where: {
          userId_subjectCode_projectorVersion: {
            userId: evidence.userId,
            subjectCode: evidence.subjectCode,
            projectorVersion: LEARNING_STATE_PROJECTOR_VERSION
          }
        },
        select: { lastEvidenceVersion: true, lastEventSequence: true }
      });
      return {
        evidenceId: duplicate.id,
        eventId: duplicate.eventId,
        evidenceVersion: evidenceVersion(evidence.userId, evidence.subjectCode, duplicate.eventSequence),
        projectedStateVersion: checkpoint?.lastEvidenceVersion ?? null,
        adaptationPending: (checkpoint?.lastEventSequence ?? 0n) < duplicate.eventSequence,
        duplicate: true
      };
    }

    const latest = await transaction.learningEvidenceEvent.findFirst({
      where: { userId: evidence.userId, subjectCode: evidence.subjectCode },
      select: { eventSequence: true },
      orderBy: { eventSequence: 'desc' }
    });
    const previousQuestionEvidence = await transaction.learningEvidenceEvent.findFirst({
      where: {
        userId: evidence.userId,
        subjectCode: evidence.subjectCode,
        questionId: evidence.questionId
      },
      select: { id: true }
    });
    const eventSequence = (latest?.eventSequence ?? 0n) + 1n;
    const recordedAt = new Date();
    const event: LearningEvidenceEventV1 = {
      ...evidence,
      eventSequence: String(eventSequence),
      recordedAt: recordedAt.toISOString(),
      firstAttempt: !previousQuestionEvidence
    };
    const created = await transaction.learningEvidenceEvent.create({
      data: {
        schemaVersion: event.schemaVersion,
        eventId: event.eventId,
        eventSequence,
        userId: event.userId,
        subjectCode: event.subjectCode,
        occurredAt: new Date(event.occurredAt),
        recordedAt,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        attemptSequence: event.attemptSequence,
        sessionId: event.sessionId,
        questionId: event.questionId,
        questionVersion: event.questionVersion,
        answerKeyVersion: event.answerKeyVersion,
        topicMappingVersion: event.topicMappingVersion,
        scoringRubricVersion: event.scoringRubricVersion,
        exposureState: event.exposureState,
        topicEvidence: event.topicEvidence as Prisma.InputJsonValue,
        outcome: event.outcome,
        firstAttempt: event.firstAttempt,
        usedHint: event.usedHint,
        usedExplanation: event.usedExplanation,
        timeSpentSeconds: event.timeSpentSeconds,
        difficulty: event.difficulty,
        questionQualityConfidence: event.questionQualityConfidence,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        outbox: {
          create: {
            payload: event as unknown as Prisma.InputJsonValue
          }
        }
      },
      select: { id: true }
    });
    const checkpoint = await transaction.learningStateProjectionCheckpoint.findUnique({
      where: {
        userId_subjectCode_projectorVersion: {
          userId: evidence.userId,
          subjectCode: evidence.subjectCode,
          projectorVersion: LEARNING_STATE_PROJECTOR_VERSION
        }
      },
      select: { lastEvidenceVersion: true, lastEventSequence: true }
    });
    return {
      evidenceId: created.id,
      eventId: evidence.eventId,
      evidenceVersion: evidenceVersion(evidence.userId, evidence.subjectCode, eventSequence),
      projectedStateVersion: checkpoint?.lastEvidenceVersion ?? null,
      adaptationPending: (checkpoint?.lastEventSequence ?? 0n) < eventSequence,
      duplicate: false
    };
  }
}
