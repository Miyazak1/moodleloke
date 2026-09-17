import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import { LearningStateProjectorService } from './learning-state-projector.service';

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
@Injectable()
export class LearningStateProjectionWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LearningStateProjectionWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly projector: LearningStateProjectorService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService
  ) {}

  onModuleInit(): void {
    if (!this.featureFlags.isEnabled('shadowProjection')) return;
    const pollMs = boundedInteger(process.env.CSCA_LEARNING_SHADOW_PROJECTION_POLL_MS, 1000, 250, 60_000);
    this.timer = setInterval(() => void this.tick(), pollMs);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const batchSize = boundedInteger(process.env.CSCA_LEARNING_SHADOW_PROJECTION_BATCH_SIZE, 50, 1, 200);
      const result = await this.projector.processPending(batchSize);
      if (result.failed > 0) {
        this.logger.warn(`Learning shadow projection failures=${result.failed} claimed=${result.claimed}`);
      }
    } catch {
      this.logger.error('Learning shadow projection worker tick failed.');
    } finally {
      this.running = false;
    }
  }
}
