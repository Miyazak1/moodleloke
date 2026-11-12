import { z } from 'zod';

export const DailyLearningTaskContextSchema = z.strictObject({
  taskId: z.string().trim().min(1).max(180),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  policyVersion: z.string().trim().min(1).max(80),
  taskKind: z.enum(['mistake_review', 'spaced_verification', 'prescription', 'free_practice']),
  subject: z.enum(['math', 'physics', 'chemistry']),
  entry: z.enum(['today_plan', 'refreshed_next'])
});

export type DailyLearningTaskContext = z.infer<typeof DailyLearningTaskContextSchema>;

export type DailyLearningTaskExecutionState = {
  status: 'started' | 'completed' | 'failed' | 'abandoned';
  startedAt: Date;
  completedAt: Date | null;
  positiveOutcome: boolean | null;
};

export function transitionDailyLearningTaskExecution(
  current: DailyLearningTaskExecutionState | null,
  event: { type: 'started' } | { type: 'completed'; positiveOutcome: boolean } | { type: 'failed' } | { type: 'abandoned' },
  occurredAt: Date
): DailyLearningTaskExecutionState {
  if (current?.status === 'completed') return current;
  if (event.type === 'started') {
    return current ?? { status: 'started', startedAt: occurredAt, completedAt: null, positiveOutcome: null };
  }
  return {
    status: event.type,
    startedAt: current?.startedAt ?? occurredAt,
    completedAt: occurredAt,
    positiveOutcome: event.type === 'completed' ? event.positiveOutcome : false
  };
}
