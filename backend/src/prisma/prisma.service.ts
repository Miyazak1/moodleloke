import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL is not configured; Prisma connection is skipped for rebuild fallback mode.');
      return;
    }

    await this.$connect();
    this.isConnected = true;
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }

  async ping(timeoutMs = Number(process.env.READY_DB_TIMEOUT_MS || 1500)) {
    if (!process.env.DATABASE_URL) {
      return { connected: false, reason: 'not_configured' };
    }
    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('database_ping_timeout')), timeoutMs);
        })
      ]);
      return { connected: true };
    } catch {
      return { connected: false, reason: 'unreachable' };
    }
  }
}
