import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService } from './agent-runner.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { AgentAttachmentAnalysisService } from './agent-attachment-analysis.service';

@Injectable()
export class AgentRecoveryService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly runner: AgentRunnerService,
    private readonly attachmentAnalyses: AgentAttachmentAnalysisService
  ) {}

  onModuleInit(): void {
    if (!this.flags.isWebEnabled()) return;
    setImmediate(() => void this.recover());
    this.timer = setInterval(() => void this.recover(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recover(): Promise<void> {
    if (!this.flags.isWebEnabled()) return;
    await this.prisma.agentRun.updateMany({
      where: { status: 'running', leaseUntil: { lt: new Date() } },
      data: { status: 'queued', leaseUntil: null, errorCode: 'LEASE_RECOVERED', errorRetryable: true }
    });
    const queued = await this.prisma.agentRun.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true, userId: true }
    });
    for (const run of queued) this.runner.dispatch(run.id, run.userId);
    if (this.flags.isAttachmentAnalysisEnabled()) {
      const db = this.prisma as any;
      await db.agentAttachmentAnalysis.updateMany({
        where: { status: 'running', startedAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
        data: { status: 'queued', errorCode: 'LEASE_RECOVERED', errorMessage: '分析任务已自动恢复。' }
      });
      const analyses = await db.agentAttachmentAnalysis.findMany({
        where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, userId: true }
      });
      for (const analysis of analyses) this.attachmentAnalyses.dispatch(analysis.id, analysis.userId);
    }
  }
}
