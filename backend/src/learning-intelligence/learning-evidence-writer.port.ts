import type { Prisma } from '@prisma/client';
import type { LearningEvidenceWriteInputV1 } from './contracts/learning-intelligence.contracts';

export const LEARNING_EVIDENCE_WRITER = Symbol('LEARNING_EVIDENCE_WRITER');

export type LearningEvidenceWriteResult = {
  evidenceId: string;
  eventId: string;
  evidenceVersion: string;
  projectedStateVersion: string | null;
  adaptationPending: boolean;
  duplicate: boolean;
};

export function learningEvidenceReceipt(writes: LearningEvidenceWriteResult[]) {
  if (!writes.length) return null;
  const latest = writes[writes.length - 1];
  return {
    eventIds: writes.map((write) => write.eventId),
    evidenceVersion: latest.evidenceVersion,
    projectedStateVersion: latest.projectedStateVersion,
    adaptationPending: latest.adaptationPending
  };
}

/**
 * The caller owns the answer-submission transaction. Implementations must append
 * LearningEvidenceEvent and LearningEvidenceOutbox through the supplied transaction,
 * and must never update UserCscaTopicStateV2 synchronously.
 */
export interface LearningEvidenceWriter {
  appendInTransaction(
    transaction: Prisma.TransactionClient,
    evidence: LearningEvidenceWriteInputV1
  ): Promise<LearningEvidenceWriteResult>;
}
