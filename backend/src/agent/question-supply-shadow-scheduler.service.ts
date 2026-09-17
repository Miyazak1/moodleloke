import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { QuestionSupplyFulfillmentService } from './question-supply-fulfillment.service';

const STATE_ID = 'shadow-reconciliation';
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 25;
const LEASE_MS = 5 * 60_000;
const LEASE_HEARTBEAT_MS = 60_000;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function enabled(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

@Injectable()
export class QuestionSupplyShadowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuestionSupplyShadowSchedulerService.name);
  private readonly workerId: string;
  private readonly intervalMinutes: number;
  private readonly batchSize: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly fulfillment: QuestionSupplyFulfillmentService,
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env
  ) {
    this.workerId = `${hostname()}:${process.pid}:question-supply-shadow-scheduler`;
    this.intervalMinutes = boundedInteger(env.CSCA_QUESTION_SUPPLY_SHADOW_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES, 1, 1440);
    this.batchSize = boundedInteger(env.CSCA_QUESTION_SUPPLY_SHADOW_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, 100);
  }

  onModuleInit() {
    if (!this.flags.isQuestionSupplyShadowSchedulerEnabled()) return;
    const runOnStartup = enabled(this.env.CSCA_QUESTION_SUPPLY_SHADOW_RUN_ON_STARTUP, true);
    this.schedule(runOnStartup ? 500 : this.intervalMinutes * 60_000);
    this.logger.log(`Question supply Shadow scheduler enabled every ${this.intervalMinutes}m, batch ${this.batchSize}.`);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async getStatus() {
    const state = await this.prisma.questionSupplySchedulerState.findUnique({ where: { id: STATE_ID } });
    return {
      schemaVersion: '1',
      mode: 'shadow',
      enabled: this.flags.isQuestionSupplyShadowSchedulerEnabled(),
      realAdapterAuthorized: false,
      configuration: { intervalMinutes: this.intervalMinutes, batchSize: this.batchSize },
      state
    };
  }

  async runOnce(trigger: 'scheduled' | 'manual' = 'scheduled', actorUserId: number | null = null, bodyValue: unknown = {}) {
    const executionEnabled = trigger === 'manual'
      ? this.flags.isQuestionSupplyFulfillmentShadowEnabled()
      : this.flags.isQuestionSupplyShadowSchedulerEnabled();
    if (!executionEnabled) {
      if (trigger === 'manual') throw new ServiceUnavailableException('QUESTION_SUPPLY_FULFILLMENT_SHADOW_DISABLED');
      return { status: 'disabled' as const, realAdapterAuthorized: false };
    }
    if (this.running) {
      if (trigger === 'manual') throw new ConflictException('QUESTION_SUPPLY_RECONCILIATION_ALREADY_RUNNING');
      return { status: 'skipped_in_process' as const, realAdapterAuthorized: false };
    }
    this.running = true;
    try {
      const claimed = await this.claimLease();
      if (!claimed) {
        if (trigger === 'manual') throw new ConflictException('QUESTION_SUPPLY_RECONCILIATION_LEASE_HELD');
        return { status: 'skipped_lease_held' as const, realAdapterAuthorized: false };
      }
      const heartbeat = this.startLeaseHeartbeat();
      let runId: string | null = null;
      try {
        await this.recoverExpiredRuns();
        const run = await this.prisma.questionSupplySchedulerRun.create({
          data: { schedulerId: STATE_ID, workerId: this.workerId, trigger }
        });
        runId = run.id;
        const manualBody = bodyValue && typeof bodyValue === 'object' && !Array.isArray(bodyValue)
          ? bodyValue as Record<string, unknown>
          : {};
        const runInput = trigger === 'manual'
          ? { ...manualBody, workerId: this.workerId }
          : { limit: this.batchSize, workerId: this.workerId };
        const result = await this.fulfillment.run(runInput, actorUserId);
        const summary = {
          trigger,
          reconciled: result.reconciled.length,
          materialized: result.materialized.length,
          created: result.materialized.filter((item) => item.created).length,
          dispatched: result.dispatched.length
        };
        const leaseOwned = await this.finishLease('succeeded', summary, null);
        if (!leaseOwned) {
          await this.finishRun(runId, 'lease_expired', summary, 'SCHEDULER_LEASE_LOST');
          if (trigger === 'manual') throw new ConflictException('QUESTION_SUPPLY_RECONCILIATION_LEASE_LOST');
          return { status: 'lease_lost' as const, realAdapterAuthorized: false, summary };
        }
        await this.finishRun(runId, 'succeeded', summary, null);
        return { ...result, status: 'succeeded' as const, realAdapterAuthorized: false, summary };
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'QUESTION_SUPPLY_SHADOW_SCHEDULER_FAILED';
        const leaseOwned = await this.finishLease('failed', { trigger }, errorCode).catch(() => false);
        if (runId) {
          await this.finishRun(runId, leaseOwned ? 'failed' : 'lease_expired', { trigger },
            leaseOwned ? errorCode : 'SCHEDULER_LEASE_LOST').catch(() => undefined);
        }
        this.logger.warn(`Question supply Shadow scheduler failed: ${errorCode}`);
        if (trigger === 'manual') throw error;
        return { status: 'failed' as const, realAdapterAuthorized: false, errorCode };
      } finally {
        clearInterval(heartbeat);
      }
    } finally {
      this.running = false;
    }
  }

  private schedule(delayMs: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.runOnce('scheduled').finally(() => this.schedule(this.intervalMinutes * 60_000));
    }, delayMs);
    this.timer.unref?.();
  }

  private async claimLease() {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + LEASE_MS);
    const claimed = await this.prisma.questionSupplySchedulerState.updateMany({
      where: {
        id: STATE_ID,
        OR: [{ leaseOwner: null }, { leaseUntil: { lt: now } }]
      },
      data: {
        leaseOwner: this.workerId,
        leaseUntil,
        lastStatus: 'running',
        lastStartedAt: now,
        lastErrorCode: null
      }
    });
    if (claimed.count === 1) return true;
    try {
      await this.prisma.questionSupplySchedulerState.create({
        data: {
          id: STATE_ID,
          leaseOwner: this.workerId,
          leaseUntil,
          lastStatus: 'running',
          lastStartedAt: now
        }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  private startLeaseHeartbeat() {
    const timer = setInterval(() => {
      void this.prisma.questionSupplySchedulerState.updateMany({
        where: { id: STATE_ID, leaseOwner: this.workerId, lastStatus: 'running' },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) }
      }).then((result) => {
        if (result.count !== 1) this.logger.warn('Question supply Shadow scheduler lease heartbeat was not renewed.');
      }).catch((error: unknown) => {
        const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'LEASE_HEARTBEAT_FAILED';
        this.logger.warn(`Question supply Shadow scheduler lease heartbeat failed: ${errorCode}`);
      });
    }, LEASE_HEARTBEAT_MS);
    timer.unref?.();
    return timer;
  }

  private async recoverExpiredRuns() {
    await this.prisma.questionSupplySchedulerRun.updateMany({
      where: {
        schedulerId: STATE_ID,
        status: 'running',
        startedAt: { lt: new Date(Date.now() - LEASE_MS) }
      },
      data: {
        status: 'lease_expired',
        completedAt: new Date(),
        errorCode: 'SCHEDULER_LEASE_EXPIRED'
      }
    });
  }

  private async finishRun(
    runId: string,
    status: 'succeeded' | 'failed' | 'lease_expired',
    summary: Record<string, unknown>,
    errorCode: string | null
  ) {
    await this.prisma.questionSupplySchedulerRun.updateMany({
      where: { id: runId, workerId: this.workerId, status: 'running' },
      data: { status, completedAt: new Date(), summary: summary as Prisma.InputJsonValue, errorCode }
    });
  }

  private async finishLease(status: 'succeeded' | 'failed', summary: Record<string, unknown>, errorCode: string | null) {
    const result = await this.prisma.questionSupplySchedulerState.updateMany({
      where: { id: STATE_ID, leaseOwner: this.workerId },
      data: {
        leaseOwner: null,
        leaseUntil: null,
        lastStatus: status,
        lastCompletedAt: new Date(),
        lastSummary: summary as Prisma.InputJsonValue,
        lastErrorCode: errorCode
      }
    });
    return result.count === 1;
  }
}
