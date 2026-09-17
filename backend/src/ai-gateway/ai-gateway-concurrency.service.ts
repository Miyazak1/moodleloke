import { Injectable } from '@nestjs/common';
import { AiConcurrencyReservation, AiTaskPolicy, AiTaskRuntimeClass } from './ai-gateway.types';
import { AiGatewayConfigService } from './ai-gateway-config.service';

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class Semaphore {
  private running = 0;
  private readonly queue: Waiter[] = [];

  constructor(private readonly capacity: () => number) {}

  async acquire(timeoutMs: number) {
    if (this.running < this.capacity()) {
      this.running += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => {
          clearTimeout(waiter.timer);
          this.running += 1;
          resolve();
        },
        reject,
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index >= 0) this.queue.splice(index, 1);
          reject(new Error('gateway_concurrency_timeout'));
        }, timeoutMs)
      };
      this.queue.push(waiter);
    });
  }

  release() {
    this.running = Math.max(0, this.running - 1);
    const waiter = this.queue.shift();
    if (waiter) waiter.resolve();
  }

  stats() {
    return { running: this.running, queued: this.queue.length };
  }
}

@Injectable()
export class AiGatewayConcurrencyService {
  private readonly config: AiGatewayConfigService;
  private readonly global: Semaphore;
  private readonly realtime: Semaphore;
  private readonly background: Semaphore;

  constructor(config?: AiGatewayConfigService) {
    this.config = config ?? new AiGatewayConfigService();
    this.global = new Semaphore(() => this.config.globalConcurrency());
    this.realtime = new Semaphore(() => this.config.realtimeConcurrency());
    this.background = new Semaphore(() => this.config.backgroundConcurrency());
  }

  async reserve(policy: AiTaskPolicy): Promise<AiConcurrencyReservation> {
    const pool = this.pool(policy.runtimeClass);
    const queueTimeoutMs = this.queueTimeoutMs(policy.runtimeClass);
    await pool.acquire(queueTimeoutMs);
    try {
      await this.global.acquire(queueTimeoutMs);
    } catch (error) {
      pool.release();
      throw error;
    }
    let released = false;
    return {
      runtimeClass: policy.runtimeClass,
      release: () => {
        if (released) return;
        released = true;
        this.global.release();
        pool.release();
      }
    };
  }

  snapshot() {
    const realtime = this.realtime.stats();
    const background = this.background.stats();
    return {
      realtimeRunning: realtime.running,
      realtimeQueued: realtime.queued,
      backgroundRunning: background.running,
      backgroundQueued: background.queued
    };
  }

  private pool(runtimeClass: AiTaskRuntimeClass) {
    return runtimeClass === 'realtime' ? this.realtime : this.background;
  }

  private queueTimeoutMs(runtimeClass: AiTaskRuntimeClass) {
    return runtimeClass === 'realtime'
      ? this.config.realtimeQueueTimeoutMs()
      : this.config.backgroundQueueTimeoutMs();
  }
}
