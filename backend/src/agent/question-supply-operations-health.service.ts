import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionSupplyShadowSchedulerService } from './question-supply-shadow-scheduler.service';

const SUBJECTS = ['math', 'physics', 'chemistry'] as const;
const STALE_REQUEST_MS = 24 * 60 * 60_000;
const RECENT_CHECK_MS = 24 * 60 * 60_000;
const RECENT_COMPLETION_MS = 7 * 24 * 60 * 60_000;

type HealthRows = {
  scheduler: any;
  requests: any[];
  plans: any[];
  checks: any[];
  runs: any[];
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

export function buildQuestionSupplyOperationsHealth(rows: HealthRows, now = new Date()) {
  const alerts: Array<{ severity: 'warning' | 'critical'; code: string; subjectCode?: string; count?: number }> = [];
  const state = rows.scheduler.state;
  const intervalMs = Number(rows.scheduler.configuration.intervalMinutes) * 60_000;
  const overdueAfterMs = Math.max(intervalMs * 3, intervalMs + 2 * 60_000);
  const activeLeaseExpired = state?.leaseOwner && state?.leaseUntil && new Date(state.leaseUntil).getTime() < now.getTime();

  if (rows.scheduler.enabled && !state) alerts.push({ severity: 'warning', code: 'SCHEDULER_NEVER_RAN' });
  if (rows.scheduler.enabled && state?.lastStatus === 'failed') alerts.push({ severity: 'critical', code: 'SCHEDULER_LAST_RUN_FAILED' });
  if (rows.scheduler.enabled && activeLeaseExpired) alerts.push({ severity: 'critical', code: 'SCHEDULER_LEASE_EXPIRED' });
  if (rows.scheduler.enabled && state?.lastCompletedAt && state?.lastStatus !== 'running'
    && now.getTime() - new Date(state.lastCompletedAt).getTime() > overdueAfterMs) {
    alerts.push({ severity: 'warning', code: 'SCHEDULER_OVERDUE' });
  }

  const staleBefore = now.getTime() - STALE_REQUEST_MS;
  const staleRequests = rows.requests.filter((item) => new Date(item.lastObservedAt).getTime() < staleBefore);
  if (staleRequests.length) alerts.push({ severity: 'warning', code: 'STALE_OPEN_REQUESTS', count: staleRequests.length });

  const failedPlans = rows.plans.filter((item) => item.status === 'failed');
  if (failedPlans.length) alerts.push({ severity: 'warning', code: 'FAILED_FULFILLMENT_PLANS', count: failedPlans.length });
  const expiredPlanLeases = rows.plans.filter((item) => item.status === 'leased' && item.leaseUntil && new Date(item.leaseUntil).getTime() < now.getTime());
  if (expiredPlanLeases.length) alerts.push({ severity: 'critical', code: 'EXPIRED_PLAN_LEASES', count: expiredPlanLeases.length });

  const checkFailures = rows.checks.filter((item) => item.result === 'check_failed').length;
  const checkFailureRate = ratio(checkFailures, rows.checks.length);
  if (rows.checks.length >= 5 && checkFailureRate !== null && checkFailureRate > 0.1) {
    alerts.push({ severity: 'critical', code: 'INVENTORY_CHECK_FAILURE_RATE_HIGH', count: checkFailures });
  }

  const subjects = SUBJECTS.map((subjectCode) => {
    const subjectRequests = rows.requests.filter((item) => item.subjectCode === subjectCode);
    const subjectChecks = rows.checks.filter((item) => item.request?.subjectCode === subjectCode);
    const subjectPlans = rows.plans.filter((item) => item.request?.subjectCode === subjectCode);
    const latestCheckAt = subjectChecks.reduce<Date | null>((latest, item) => {
      const value = new Date(item.checkedAt);
      return !latest || value > latest ? value : latest;
    }, null);
    if (rows.scheduler.enabled && subjectRequests.length > 0 && subjectChecks.length === 0) {
      alerts.push({ severity: 'warning', code: 'SUBJECT_HAS_NO_RECENT_CHECKS', subjectCode, count: subjectRequests.length });
    }
    return {
      subjectCode,
      openRequests: subjectRequests.length,
      staleOpenRequests: subjectRequests.filter((item) => new Date(item.lastObservedAt).getTime() < staleBefore).length,
      checks24h: subjectChecks.length,
      checkFailures24h: subjectChecks.filter((item) => item.result === 'check_failed').length,
      completedCycles7d: subjectPlans.filter((item) => item.status === 'completed' && item.completedAt).length,
      failedPlans: subjectPlans.filter((item) => item.status === 'failed').length,
      latestCheckAt: latestCheckAt?.toISOString() ?? null
    };
  });

  const status = !rows.scheduler.enabled
    ? 'disabled'
    : alerts.some((item) => item.severity === 'critical')
      ? 'critical'
      : alerts.length
        ? 'warning'
        : 'healthy';
  const publicScheduler = {
    schemaVersion: rows.scheduler.schemaVersion,
    mode: rows.scheduler.mode,
    enabled: rows.scheduler.enabled,
    realAdapterAuthorized: false as const,
    configuration: rows.scheduler.configuration,
    state: state ? {
      lastStatus: state.lastStatus,
      lastStartedAt: state.lastStartedAt,
      lastCompletedAt: state.lastCompletedAt,
      lastSummary: state.lastSummary,
      lastErrorCode: state.lastErrorCode,
      leaseActive: Boolean(state.leaseOwner && state.leaseUntil && new Date(state.leaseUntil).getTime() >= now.getTime()),
      leaseUntil: state.leaseUntil
    } : null
  };
  return {
    schemaVersion: '1' as const,
    mode: 'shadow' as const,
    generatedAt: now.toISOString(),
    status,
    realAdapterAuthorized: false as const,
    summary: {
      openRequests: rows.requests.length,
      staleOpenRequests: staleRequests.length,
      checks24h: rows.checks.length,
      checkFailures24h: checkFailures,
      checkFailureRate,
      failedPlans: failedPlans.length,
      expiredPlanLeases: expiredPlanLeases.length
    },
    alerts,
    subjects,
    scheduler: publicScheduler,
    recentRuns: rows.runs
  };
}

@Injectable()
export class QuestionSupplyOperationsHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: QuestionSupplyShadowSchedulerService
  ) {}

  async getHealth() {
    const now = new Date();
    const recentChecksAt = new Date(now.getTime() - RECENT_CHECK_MS);
    const recentCompletionsAt = new Date(now.getTime() - RECENT_COMPLETION_MS);
    const [scheduler, requests, plans, checks, runs] = await Promise.all([
      this.scheduler.getStatus(),
      this.prisma.questionSupplyRequest.findMany({
        where: { status: { in: ['open', 'acknowledged'] } },
        select: { subjectCode: true, lastObservedAt: true }
      }),
      this.prisma.questionSupplyFulfillmentPlan.findMany({
        where: {
          OR: [
            { status: { in: ['failed', 'leased'] } },
            { status: 'completed', completedAt: { gte: recentCompletionsAt } }
          ]
        },
        select: {
          status: true, leaseUntil: true, completedAt: true,
          request: { select: { subjectCode: true } }
        }
      }),
      this.prisma.questionSupplyInventoryCheck.findMany({
        where: { checkedAt: { gte: recentChecksAt } },
        select: { result: true, checkedAt: true, request: { select: { subjectCode: true } } }
      }),
      this.prisma.questionSupplySchedulerRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: { id: true, trigger: true, status: true, summary: true, errorCode: true, startedAt: true, completedAt: true }
      })
    ]);
    return buildQuestionSupplyOperationsHealth({ scheduler, requests, plans, checks, runs }, now);
  }
}
