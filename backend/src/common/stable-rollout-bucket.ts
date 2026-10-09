import { createHash } from 'node:crypto';

export const LEARNING_ROLLOUT_BUCKET_VERSION = 'csca-learning-rollout-v1' as const;

export function stableLearningRolloutBucket(userId: number): number {
  return createHash('sha256')
    .update(`${LEARNING_ROLLOUT_BUCKET_VERSION}:${userId}`)
    .digest()
    .readUInt16BE(0) % 100;
}
