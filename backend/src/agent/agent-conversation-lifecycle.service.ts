import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAgentStorageKey } from './agent-attachment-storage';
import { agentConversationLifecyclePolicy } from './agent-conversation-lifecycle.policy';

type LifecycleOptions = { dryRun?: boolean; now?: Date; batchSize?: number };
type PurgeCandidate = {
  id: string;
  status: string;
  runs: Array<{ status: string }>;
  outbox: Array<{ status: string }>;
  attachments: Array<{ storageKey: string | null; _count: { examOutcomeEvidence: number } }>;
};

@Injectable()
export class AgentConversationLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentConversationLifecycleService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.AGENT_CONVERSATION_LIFECYCLE_ENABLED === 'false') return;
    setImmediate(() => void this.run().catch((error) => this.logger.error('Initial lifecycle pass failed.', error)));
    const configured = Number(process.env.AGENT_CONVERSATION_LIFECYCLE_INTERVAL_MS || 6 * 60 * 60 * 1000);
    const intervalMs = Math.max(60_000, Number.isFinite(configured) ? configured : 6 * 60 * 60 * 1000);
    this.timer = setInterval(() => void this.run().catch((error) => this.logger.error('Lifecycle pass failed.', error)), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(options: LifecycleOptions = {}) {
    if (this.running) return { skipped: true, reason: 'already_running' as const };
    this.running = true;
    try {
      const dryRun = options.dryRun === true;
      const now = options.now ?? new Date();
      const batchSize = Math.max(1, Math.min(500, Math.floor(options.batchSize ?? 100)));
      const policy = agentConversationLifecyclePolicy();
      const db = this.prisma as any;
      const [archiveCandidates, purgeCandidates] = await Promise.all([
        db.agentConversation.findMany({
          where: {
            scopeType: 'practice_question_qa', status: 'active', deletedAt: null,
            messages: { some: {} },
            OR: [
              { lastMessageAt: { lte: policy.archiveCutoff(now) } },
              { lastMessageAt: null, createdAt: { lte: policy.archiveCutoff(now) } }
            ],
            runs: { none: { status: { in: ['queued', 'running'] } } },
            outbox: { none: { status: 'pending' } }
          },
          orderBy: [{ lastMessageAt: 'asc' }, { createdAt: 'asc' }], take: batchSize, select: { id: true }
        }),
        db.agentConversation.findMany({
          where: {
            scopeType: 'practice_question_qa', deletedAt: null,
            OR: [
              { purgeAfter: { lte: now } },
              { messages: { none: {} }, createdAt: { lte: policy.abandonedCutoff(now) } }
            ]
          },
          orderBy: [{ purgeAfter: 'asc' }, { createdAt: 'asc' }], take: batchSize,
          select: {
            id: true, status: true,
            runs: { select: { status: true } },
            outbox: { select: { status: true } },
            attachments: { select: { storageKey: true, _count: { select: { examOutcomeEvidence: true } } } }
          }
        })
      ]) as [Array<{ id: string }>, PurgeCandidate[]];

      const blocked = purgeCandidates.filter((item) =>
        item.runs.some((run) => ['queued', 'running'].includes(run.status))
        || item.outbox.some((event) => event.status === 'pending')
        || item.attachments.some((attachment) => attachment._count.examOutcomeEvidence > 0));
      const purgeable = purgeCandidates.filter((item) => !blocked.includes(item));
      const purgeIds = new Set(purgeCandidates.map((item) => item.id));
      const archiveEligible = archiveCandidates.filter((item) => !purgeIds.has(item.id));
      const report = {
        policyVersion: policy.policyVersion, dryRun, evaluatedAt: now.toISOString(),
        archiveCandidateCount: archiveEligible.length,
        purgeCandidateCount: purgeable.length,
        blockedCount: blocked.length,
        archivedCount: 0,
        purgedCount: 0,
        blockedIds: blocked.map((item) => item.id),
        archiveCandidateIds: archiveEligible.map((item) => item.id),
        purgeCandidateIds: purgeable.map((item) => item.id)
      };
      if (dryRun) return report;

      if (archiveEligible.length) {
        const archived = await db.agentConversation.updateMany({
          where: {
            id: { in: archiveEligible.map((item) => item.id) }, scopeType: 'practice_question_qa',
            status: 'active', deletedAt: null,
            runs: { none: { status: { in: ['queued', 'running'] } } }, outbox: { none: { status: 'pending' } }
          },
          data: { status: 'archived', archivedAt: now }
        });
        report.archivedCount = archived.count;
      }

      for (const candidate of purgeable) {
        const claimed = await db.agentConversation.updateMany({
          where: {
            id: candidate.id, scopeType: 'practice_question_qa', deletedAt: null,
            status: candidate.status,
            runs: { none: { status: { in: ['queued', 'running'] } } }, outbox: { none: { status: 'pending' } }
          },
          data: { status: 'purging' }
        });
        if (!claimed.count) continue;
        try {
          for (const attachment of candidate.attachments) {
            if (attachment.storageKey) await rm(resolveAgentStorageKey(attachment.storageKey), { force: true });
          }
          const removed = await db.agentConversation.deleteMany({
            where: { id: candidate.id, scopeType: 'practice_question_qa', status: 'purging' }
          });
          report.purgedCount += removed.count;
        } catch (error) {
          await db.agentConversation.updateMany({
            where: { id: candidate.id, status: 'purging' }, data: { status: 'archived', archivedAt: now }
          });
          this.logger.error(`Failed to purge practice Q&A conversation ${candidate.id}.`, error);
        }
      }
      if (report.archivedCount || report.purgedCount || report.blockedCount) this.logger.log(JSON.stringify(report));
      return report;
    } finally {
      this.running = false;
    }
  }
}
