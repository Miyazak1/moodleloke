import { Body, Controller, Get, Headers, Logger, NotFoundException, Optional, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { getAppVersion, getCspMode, getMetricsPrometheusText, getMetricsSnapshot, isMetricsEnabled } from '../common/ops-metrics';
import { getRateLimitReadiness } from '../common/rate-limit';
import { isProductionRuntime } from '../common/runtime-environment';
import { PrismaService } from '../prisma/prisma.service';

type HealthChecks = {
  app: boolean;
  databaseUrlConfigured: boolean;
  authSecretConfigured: boolean;
  adminBootstrapConfigured: boolean;
  paymentCallbackSecretConfigured: boolean;
  gumroadCheckoutConfigured: boolean;
  gumroadVerificationConfigured: boolean;
  corsOriginsConfigured: boolean;
};

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  @Get(['health', 'api/v1/health'])
  check() {
    const checks = this.buildChecks();
    if (this.shouldUseMinimalHealth()) {
      return {
        status: 'ok',
        service: 'moodlelike-backend',
        appVersion: getAppVersion(),
        timestamp: new Date().toISOString()
      };
    }
    return {
      status: 'ok',
      service: 'moodlelike-backend',
      appVersion: getAppVersion(),
      cspMode: getCspMode(),
      metricsEnabled: isMetricsEnabled(),
      checks,
      productionReadiness: this.buildProductionReadiness(checks),
      timestamp: new Date().toISOString()
    };
  }

  @Get(['ops/ready', 'api/v1/ops/ready'])
  async ready(@Headers('authorization') authorization?: string) {
    this.assertReadyAccess(authorization);
    const checks = this.buildChecks();
    const database = await this.checkDatabase();

    const optionalReadiness = [
      checks.databaseUrlConfigured,
      checks.authSecretConfigured,
      checks.adminBootstrapConfigured,
      checks.corsOriginsConfigured,
      database.connected
    ];

    return {
      status: optionalReadiness.every(Boolean) ? 'ready' : 'degraded',
      appVersion: getAppVersion(),
      cspMode: getCspMode(),
      metricsEnabled: isMetricsEnabled(),
      database,
      rateLimit: getRateLimitReadiness(),
      checks,
      productionReadiness: this.buildProductionReadiness(checks),
      timestamp: new Date().toISOString()
    };
  }

  @Get(['ops/metrics', 'api/v1/ops/metrics'])
  metrics(
    @Headers('authorization') authorization: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    if (!isMetricsEnabled()) {
      throw new NotFoundException('监控指标未开启。');
    }
    const token = process.env.OPS_METRICS_TOKEN;
    if (token && authorization !== `Bearer ${token}`) {
      throw new UnauthorizedException('需要监控访问令牌。');
    }
    if (format === 'prometheus' || accept?.includes('text/plain')) {
      response.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
      return getMetricsPrometheusText();
    }
    return getMetricsSnapshot();
  }

  @Post(['ops/csp-report', 'api/v1/ops/csp-report'])
  cspReport(@Body() payload: unknown) {
    const report = JSON.stringify(this.sanitizeReport(payload)) || '{}';
    this.logger.warn(`CSP violation report received: ${report.slice(0, 2000)}`);
    return { received: true };
  }

  private buildChecks(): HealthChecks {
    return {
      app: true,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      authSecretConfigured: Boolean(process.env.AUTH_SECRET || process.env.JWT_SECRET),
      adminBootstrapConfigured: Boolean(process.env.ADMIN_BOOTSTRAP_EMAIL || process.env.ADMIN_EMAIL),
      paymentCallbackSecretConfigured: Boolean(process.env.PAYMENT_CALLBACK_SECRET),
      gumroadCheckoutConfigured: Boolean(process.env.GUMROAD_PRODUCT_URL),
      gumroadVerificationConfigured: Boolean(process.env.GUMROAD_ACCESS_TOKEN),
      corsOriginsConfigured: Boolean(process.env.CORS_ORIGINS)
    };
  }

  private shouldUseMinimalHealth() {
    return isProductionRuntime() && process.env.OPS_HEALTH_DETAILS_ENABLED !== 'true';
  }

  private assertReadyAccess(authorization?: string) {
    const token = process.env.OPS_READY_TOKEN;
    if (token && authorization !== `Bearer ${token}`) {
      throw new UnauthorizedException('需要就绪检查访问令牌。');
    }
  }

  private async checkDatabase() {
    if (!this.prisma) return { connected: false, reason: 'not_available' };
    return this.prisma.ping();
  }

  private sanitizeReport(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => this.sanitizeReport(item));
    const output: Record<string, unknown> = {};
    for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
      if (/token|password|secret|cookie|authorization/i.test(key)) {
        output[key] = '[redacted]';
      } else if (typeof nextValue === 'string') {
        output[key] = nextValue.replace(/(token|password|secret|authorization)=([^&\s]+)/gi, '$1=[redacted]').slice(0, 500);
      } else {
        output[key] = this.sanitizeReport(nextValue);
      }
    }
    return output;
  }

  private buildProductionReadiness(checks: HealthChecks) {
    const required = {
      databaseUrlConfigured: checks.databaseUrlConfigured,
      authSecretConfigured: checks.authSecretConfigured,
      corsOriginsConfigured: checks.corsOriginsConfigured
    };
    return {
      status: Object.values(required).every(Boolean) ? 'ready' : 'blocked',
      required,
      optional: {
        adminBootstrapConfigured: checks.adminBootstrapConfigured,
        paymentCallbackSecretConfigured: checks.paymentCallbackSecretConfigured,
        gumroadCheckoutConfigured: checks.gumroadCheckoutConfigured,
        gumroadVerificationConfigured: checks.gumroadVerificationConfigured
      }
    };
  }
}
