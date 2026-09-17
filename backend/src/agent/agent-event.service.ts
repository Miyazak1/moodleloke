import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

@Injectable()
export class AgentEventService {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    tx: Prisma.TransactionClient,
    input: { runId: string; conversationId: string; eventKey: string; eventType: string; data: Record<string, unknown> }
  ) {
    const existing = await tx.agentOutbox.findFirst({
      where: { runId: input.runId, eventKey: input.eventKey }
    });
    if (existing) return existing;
    await tx.$executeRaw`SELECT 1 FROM "agent_runs" WHERE "id" = ${input.runId} FOR UPDATE`;
    const existingAfterLock = await tx.agentOutbox.findFirst({
      where: { runId: input.runId, eventKey: input.eventKey }
    });
    if (existingAfterLock) return existingAfterLock;
    const latest = await tx.agentOutbox.findFirst({
      where: { runId: input.runId, sequence: { not: null } },
      orderBy: { sequence: 'desc' },
      select: { sequence: true }
    });
    return tx.agentOutbox.create({
      data: {
        runId: input.runId,
        conversationId: input.conversationId,
        eventType: input.eventType,
        eventKey: input.eventKey,
        sequence: (latest?.sequence ?? 0) + 1,
        payload: input.data as Prisma.InputJsonValue,
        status: 'published'
      }
    });
  }

  async stream(userId: number, runId: string, afterSequence: number): Promise<Observable<MessageEvent>> {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      select: { id: true, conversationId: true }
    });
    if (!run) throw new NotFoundException('Agent run not found.');
    return new Observable<MessageEvent>((subscriber) => {
      let cursor = Math.max(0, afterSequence);
      let busy = false;
      const poll = async () => {
        if (busy || subscriber.closed) return;
        busy = true;
        try {
          const [events, state] = await Promise.all([
            this.prisma.agentOutbox.findMany({
              where: { runId, sequence: { gt: cursor } },
              orderBy: { sequence: 'asc' },
              take: 100
            }),
            this.prisma.agentRun.findFirst({ where: { id: runId, userId }, select: { status: true } })
          ]);
          for (const event of events) {
            if (event.sequence === null) continue;
            cursor = event.sequence;
            subscriber.next({
              id: String(event.sequence),
              type: event.eventType,
              data: {
                eventId: event.id,
                runId,
                conversationId: run.conversationId,
                sequence: event.sequence,
                type: event.eventType,
                createdAt: event.createdAt.toISOString(),
                data: event.payload
              }
            });
          }
          if (state && TERMINAL_STATUSES.has(state.status) && events.length === 0) subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        } finally {
          busy = false;
        }
      };
      void poll();
      const timer = setInterval(() => void poll(), 500);
      return () => clearInterval(timer);
    });
  }
}
