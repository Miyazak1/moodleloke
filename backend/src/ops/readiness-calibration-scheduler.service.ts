import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CscaLearningService } from '../csca-learning/csca-learning.service';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function intInRange(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function nextShanghaiDailyRunMs(now: Date, hour: number, minute: number) {
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const year = shanghaiNow.getUTCFullYear();
  const month = shanghaiNow.getUTCMonth();
  const date = shanghaiNow.getUTCDate();
  let targetUtcMs = Date.UTC(year, month, date, hour - 8, minute, 0, 0);
  if (targetUtcMs <= now.getTime()) {
    targetUtcMs = Date.UTC(year, month, date + 1, hour - 8, minute, 0, 0);
  }
  return Math.max(1, targetUtcMs - now.getTime());
}

@Injectable()
export class ReadinessCalibrationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadinessCalibrationSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly cscaLearningService: CscaLearningService) {}

  onModuleInit() {
    if (!this.isEnabled()) return;
    this.scheduleNext();
    if (enabled(process.env.CSCA_READINESS_CALIBRATION_SCHEDULE_RUN_ON_STARTUP)) {
      void this.runRefresh('startup');
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private isEnabled() {
    return enabled(process.env.CSCA_READINESS_CALIBRATION_SCHEDULE_ENABLED);
  }

  private scheduleNext() {
    if (!this.isEnabled()) return;
    const hour = intInRange(process.env.CSCA_READINESS_CALIBRATION_SCHEDULE_HOUR, 3, 0, 23);
    const minute = intInRange(process.env.CSCA_READINESS_CALIBRATION_SCHEDULE_MINUTE, 20, 0, 59);
    const delayMs = nextShanghaiDailyRunMs(new Date(), hour, minute);
    this.timer = setTimeout(() => {
      void this.runRefresh('scheduled').finally(() => this.scheduleNext());
    }, Math.min(delayMs, MAX_TIMEOUT_MS));
    this.logger.log(`Readiness calibration snapshot refresh scheduled in ${Math.round(delayMs / 60000)} minutes.`);
  }

  private async runRefresh(trigger: 'scheduled' | 'startup') {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.cscaLearningService.refreshReadinessActionCalibrationSnapshots('scheduled');
      this.logger.log(`Readiness calibration snapshots refreshed by ${trigger}: ${result.actionTypes} action types, ${result.clickedCount} clicks.`);
    } catch (error) {
      this.logger.error(`Readiness calibration snapshot refresh failed: ${(error as Error).message}`, (error as Error).stack);
    } finally {
      this.running = false;
    }
  }
}
