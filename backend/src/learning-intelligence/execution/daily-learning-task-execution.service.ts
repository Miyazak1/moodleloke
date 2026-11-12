import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLearningTaskContext,
  DailyLearningTaskContextSchema,
  transitionDailyLearningTaskExecution
} from './daily-learning-task-execution.contract';

type ExecutionReferences = {
  topicId?: number | null;
  artifactId?: string | null;
  reviewItemId?: number | null;
  roundId?: number | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
};

function json(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

@Injectable()
export class DailyLearningTaskExecutionService {
  constructor(private readonly prisma: PrismaService) {}

  parseContext(value: unknown): DailyLearningTaskContext | null {
    const parsed = DailyLearningTaskContextSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  async started(userId: number, contextValue: unknown, references: ExecutionReferences = {}) {
    const context = this.parseContext(contextValue);
    if (!context) return null;
    const now = new Date();
    const key = { userId_planDate_taskId: { userId, planDate: context.planDate, taskId: context.taskId } };
    const existing = await this.prisma.dailyLearningTaskExecution.findUnique({ where: key });
    const next = transitionDailyLearningTaskExecution(existing ? {
      status: existing.status as 'started' | 'completed' | 'failed' | 'abandoned',
      startedAt: existing.startedAt,
      completedAt: existing.completedAt,
      positiveOutcome: existing.positiveOutcome
    } : null, { type: 'started' }, now);
    if (existing?.status === 'completed' || existing?.status === 'failed' || existing?.status === 'abandoned') return existing;
    if (!existing) {
      try {
        return await this.prisma.dailyLearningTaskExecution.create({
          data: {
            userId,
            ...context,
            status: next.status,
            startedAt: next.startedAt,
            context: json({ ...context }),
            ...references
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    await this.prisma.dailyLearningTaskExecution.updateMany({
      where: { userId, planDate: context.planDate, taskId: context.taskId, status: 'started' },
      data: references
    });
    return this.prisma.dailyLearningTaskExecution.findUnique({ where: key });
  }

  async completed(
    userId: number,
    contextValue: unknown,
    input: ExecutionReferences & { positiveOutcome: boolean; outcome?: Record<string, unknown> }
  ) {
    const context = this.parseContext(contextValue);
    if (!context) return null;
    const now = new Date();
    const key = { userId_planDate_taskId: { userId, planDate: context.planDate, taskId: context.taskId } };
    const existing = await this.prisma.dailyLearningTaskExecution.findUnique({ where: key });
    if (existing?.status === 'completed' || existing?.status === 'failed' || existing?.status === 'abandoned') return existing;
    const next = transitionDailyLearningTaskExecution(existing ? {
      status: existing.status as 'started' | 'completed' | 'failed' | 'abandoned',
      startedAt: existing.startedAt,
      completedAt: existing.completedAt,
      positiveOutcome: existing.positiveOutcome
    } : null, { type: 'completed', positiveOutcome: input.positiveOutcome }, now);
    const { positiveOutcome: _positiveOutcome, outcome, ...references } = input;
    if (!existing) {
      try {
        return await this.prisma.dailyLearningTaskExecution.create({
          data: {
            userId,
            ...context,
            status: next.status,
            startedAt: next.startedAt,
            completedAt: next.completedAt,
            positiveOutcome: next.positiveOutcome,
            context: json({ ...context }),
            outcome: json(outcome),
            ...references
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    await this.prisma.dailyLearningTaskExecution.updateMany({
      where: { userId, planDate: context.planDate, taskId: context.taskId, status: 'started' },
      data: {
        status: next.status,
        completedAt: next.completedAt,
        positiveOutcome: next.positiveOutcome,
        outcome: json(outcome),
        ...references
      }
    });
    return this.prisma.dailyLearningTaskExecution.findUnique({ where: key });
  }

  async completedBySource(
    userId: number,
    sourceEntityType: string,
    sourceEntityId: string,
    input: ExecutionReferences & { positiveOutcome: boolean; outcome?: Record<string, unknown> }
  ) {
    const execution = await this.prisma.dailyLearningTaskExecution.findFirst({
      where: { userId, sourceEntityType, sourceEntityId },
      orderBy: { createdAt: 'desc' }
    });
    if (!execution) return null;
    return this.completed(userId, execution.context, {
      ...input,
      sourceEntityType,
      sourceEntityId
    });
  }
}
