import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AIQuestioningService } from './ai-questioning.service';

const DEFAULT_INTERVAL_MINUTES = 30;
const MAX_TIMEOUT_MS = 2_147_483_647;

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function intInRange(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

@Injectable()
export class AIQuestioningSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIQuestioningSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly aiQuestioningService: AIQuestioningService) {}

  onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.log('AI questioning scheduler skipped because DATABASE_URL is not configured.');
      return;
    }
    if (!enabled(process.env.CSCA_AI_QUESTIONING_TASK_RECOVERY_DISABLED)) {
      void this.recoverQueuedTasks('startup');
    }
    if (!this.isEnabled()) return;
    this.scheduleNext();
    if (enabled(process.env.CSCA_AI_QUESTIONING_SCHEDULER_RUN_ON_STARTUP)) {
      void this.runCycle('startup');
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private isEnabled() {
    return enabled(process.env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED);
  }

  private async recoverQueuedTasks(trigger: 'scheduled' | 'startup') {
    try {
      const taskRecoverLimit = intInRange(process.env.CSCA_AI_QUESTIONING_TASK_RECOVER_LIMIT, 12, 1, 50);
      const sourceProfileStaleMinutes = intInRange(process.env.CSCA_SOURCE_PROFILE_TASK_STALE_MINUTES, 5, 1, 60);
      const recovered = await this.aiQuestioningService.recoverQueuedAiQuestioningTasks({
        limit: taskRecoverLimit,
        sourceProfileStaleMinutes
      });
      if (recovered.requested > 0) {
        this.logger.log(
          `AI questioning task recovery ${trigger}: scheduled ${recovered.scheduled}/${recovered.requested} background tasks.`
        );
      }
    } catch (error) {
      this.logger.error(`AI questioning task recovery failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  private scheduleNext() {
    if (!this.isEnabled()) return;
    const intervalMinutes = intInRange(
      process.env.CSCA_AI_QUESTIONING_SCHEDULER_INTERVAL_MINUTES,
      DEFAULT_INTERVAL_MINUTES,
      5,
      24 * 60
    );
    const delayMs = Math.min(intervalMinutes * 60 * 1000, MAX_TIMEOUT_MS);
    this.timer = setTimeout(() => {
      void this.runCycle('scheduled').finally(() => this.scheduleNext());
    }, delayMs);
    this.logger.log(`AI questioning production scheduler will run in ${intervalMinutes} minutes.`);
  }

  private async runCycle(trigger: 'scheduled' | 'startup') {
    if (!this.isEnabled()) return;
    if (this.running) {
      this.logger.warn(`AI questioning production scheduler skipped ${trigger}; previous cycle is still running.`);
      return;
    }
    this.running = true;
    try {
      const processLimit = intInRange(process.env.CSCA_AI_QUESTIONING_SCHEDULER_PROCESS_LIMIT, 10, 1, 50);
      const backfillLimit = intInRange(process.env.CSCA_AI_QUESTIONING_SCHEDULER_BACKFILL_LIMIT, 10, 1, 50);
      const perTopic = intInRange(process.env.CSCA_AI_QUESTIONING_SCHEDULER_PER_TOPIC, 1, 1, 5);
      const retryFailed = enabled(process.env.CSCA_AI_QUESTIONING_SCHEDULER_RETRY_FAILED);
      const recovered = await this.aiQuestioningService.recoverQueuedAiQuestioningTasks({
        limit: intInRange(process.env.CSCA_AI_QUESTIONING_TASK_RECOVER_LIMIT, 12, 1, 50),
        sourceProfileStaleMinutes: intInRange(process.env.CSCA_SOURCE_PROFILE_TASK_STALE_MINUTES, 5, 1, 60)
      });
      const subjectProcessed = await this.aiQuestioningService.processGenerationJobs({
        limit: processLimit,
        retryFailed,
        useCase: 'subject_practice',
        queueLane: 'production',
        requireAutoProductionEnabled: true
      });
      const mockProcessed = await this.aiQuestioningService.processGenerationJobs({
        limit: processLimit,
        retryFailed,
        useCase: 'online_mock_exam'
      });
      const pregenerated = await this.aiQuestioningService.runPregeneration({
        limit: backfillLimit,
        perTopic,
        retryFailed: false
      });
      this.logger.log(
        `AI questioning production scheduler ${trigger}: recovered ${recovered.scheduled}/${recovered.requested} tasks, ` +
        `processed subject ${subjectProcessed.succeeded}/${subjectProcessed.requested} jobs, ` +
        `processed mock ${mockProcessed.succeeded}/${mockProcessed.requested} jobs, ` +
        `backfilled ${pregenerated.summary.jobsEnqueued} jobs, created ${pregenerated.summary.candidatesCreated} candidates.`
      );
    } catch (error) {
      this.logger.error(`AI questioning production scheduler failed: ${(error as Error).message}`, (error as Error).stack);
    } finally {
      this.running = false;
    }
  }
}
