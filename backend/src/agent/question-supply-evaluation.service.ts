import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

const QuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const ExportQuerySchema = QuerySchema.extend({ format: z.enum(['json', 'csv']).default('json') });
const SUBJECTS = ['math', 'physics', 'chemistry'] as const;
const MIN_CHECKED_CYCLES = 30;
const MIN_COMPLETED_CYCLES = 20;
const MIN_DISPATCH_ATTEMPTS = 20;
const MIN_SHORTAGE_CONFIRMATION_RATE = 0.8;
const MIN_RECOVERY_EXECUTABLE_RATE = 0.9;
const MAX_DISPATCH_FAILURE_RATE = 0.05;
const MAX_RECOVERY_P90_HOURS = 72;

export type EvaluationRows = { requests: any[]; plans: any[]; checks: any[]; confirmations: any[]; events: any[] };

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)].toFixed(2));
}

function cycleKey(requestId: string, cycle: number) { return `${requestId}:${cycle}`; }

function filterRows(rows: EvaluationRows, subjectCode: string): EvaluationRows {
  const requests = rows.requests.filter((item) => item.subjectCode === subjectCode);
  const requestIds = new Set(requests.map((item) => item.id));
  return {
    requests,
    plans: rows.plans.filter((item) => item.request?.subjectCode === subjectCode),
    checks: rows.checks.filter((item) => requestIds.has(item.requestId)),
    confirmations: rows.confirmations.filter((item) => item.subjectCode === subjectCode),
    events: rows.events.filter((item) => item.plan?.request?.subjectCode === subjectCode)
  };
}

export function buildQuestionSupplyEvaluation(rows: EvaluationRows, range: { days: number; from: Date; to: Date }) {
  const observations = rows.requests.reduce((sum, item) => sum + Number(item.observationCount ?? 0), 0);
  const repeatedObservations = rows.requests.reduce(
    (sum, item) => sum + Math.max(0, Number(item.observationCount ?? 0) - Number(item.cycle ?? 1)), 0
  );
  const firstChecks = new Map<string, any>();
  for (const check of [...rows.checks].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())) {
    const key = cycleKey(check.requestId, check.requestCycle);
    if (!firstChecks.has(key)) firstChecks.set(key, check);
  }
  const checkedCycles = firstChecks.size;
  const confirmedShortageCycles = [...firstChecks.values()].filter((item) => item.result === 'still_short').length;
  const checkFailureCycles = [...firstChecks.values()].filter((item) => item.result === 'check_failed').length;
  const validCheckedCycles = checkedCycles - checkFailureCycles;
  const completedPlans = rows.plans.filter((item) => item.status === 'completed' && item.completedAt);
  const completedKeys = new Set(completedPlans.map((item) => cycleKey(item.requestId, item.requestCycle)));
  const executableKeys = new Set(rows.confirmations.filter((item) => item.confirmationKind === 'domain_preflight_passed').map((item) => cycleKey(item.requestId, item.requestCycle)));
  const startedKeys = new Set(rows.confirmations.filter((item) => item.confirmationKind === 'task_started').map((item) => cycleKey(item.requestId, item.requestCycle)));
  const executableConfirmedCycles = [...completedKeys].filter((key) => executableKeys.has(key)).length;
  const taskStartedCycles = [...completedKeys].filter((key) => startedKeys.has(key)).length;
  const dispatchSuccesses = rows.events.filter((item) => item.action === 'shadow_dispatched').length;
  const dispatchFailures = rows.events.filter((item) => item.action === 'dispatch_failed').length;
  const dispatchAttempts = dispatchSuccesses + dispatchFailures;
  const recoveryHours = completedPlans.map((item) => (item.completedAt.getTime() - item.createdAt.getTime()) / 3_600_000).filter((value) => value >= 0);
  const shortageConfirmationRate = ratio(confirmedShortageCycles, validCheckedCycles);
  const recoveryExecutableRate = ratio(executableConfirmedCycles, completedPlans.length);
  const dispatchFailureRate = ratio(dispatchFailures, dispatchAttempts);
  const recoveryP90Hours = percentile(recoveryHours, 0.9);
  const sampleSufficient = validCheckedCycles >= MIN_CHECKED_CYCLES && completedPlans.length >= MIN_COMPLETED_CYCLES && dispatchAttempts >= MIN_DISPATCH_ATTEMPTS;
  const blockers: string[] = [];
  if (shortageConfirmationRate !== null && shortageConfirmationRate < MIN_SHORTAGE_CONFIRMATION_RATE) blockers.push('SHORTAGE_CONFIRMATION_RATE_LOW');
  if (recoveryExecutableRate !== null && recoveryExecutableRate < MIN_RECOVERY_EXECUTABLE_RATE) blockers.push('RECOVERY_EXECUTABLE_RATE_LOW');
  if (dispatchFailureRate !== null && dispatchFailureRate > MAX_DISPATCH_FAILURE_RATE) blockers.push('DISPATCH_FAILURE_RATE_HIGH');
  if (recoveryP90Hours !== null && recoveryP90Hours > MAX_RECOVERY_P90_HOURS) blockers.push('RECOVERY_P90_TOO_SLOW');
  if (!sampleSufficient) blockers.unshift('INSUFFICIENT_SHADOW_SAMPLE');
  const groups = new Map<string, any>();
  for (const plan of rows.plans) {
    const source = String(plan.request?.source ?? 'unknown');
    const subjectCode = String(plan.request?.subjectCode ?? 'unknown');
    const key = `${source}:${subjectCode}`;
    const group = groups.get(key) ?? { source, subjectCode, plans: 0, completed: 0, failed: 0, executableConfirmed: 0 };
    group.plans += 1;
    if (plan.status === 'completed') group.completed += 1;
    if (plan.status === 'failed') group.failed += 1;
    if (executableKeys.has(cycleKey(plan.requestId, plan.requestCycle))) group.executableConfirmed += 1;
    groups.set(key, group);
  }
  return {
    schemaVersion: '1' as const, mode: 'shadow' as const,
    range: { days: range.days, from: range.from.toISOString(), to: range.to.toISOString() },
    summary: {
      requestRows: rows.requests.length, observations, repeatedObservations, duplicateAggregationRate: ratio(repeatedObservations, observations),
      demandCycles: rows.plans.length, checkedCycles, validCheckedCycles, confirmedShortageCycles, checkFailureCycles, shortageConfirmationRate,
      completedCycles: completedPlans.length, executableConfirmedCycles, recoveryExecutableRate,
      taskStartedCycles, taskStartedRate: ratio(taskStartedCycles, completedPlans.length),
      dispatchAttempts, dispatchFailures, dispatchFailureRate,
      recoveryMedianHours: percentile(recoveryHours, 0.5), recoveryP90Hours
    },
    gate: {
      status: !sampleSufficient ? 'insufficient_sample' as const : blockers.length ? 'hold' as const : 'shadow_evidence_ready' as const,
      realAdapterAuthorized: false as const, blockers,
      thresholds: {
        minCheckedCycles: MIN_CHECKED_CYCLES, minCompletedCycles: MIN_COMPLETED_CYCLES, minDispatchAttempts: MIN_DISPATCH_ATTEMPTS,
        minShortageConfirmationRate: MIN_SHORTAGE_CONFIRMATION_RATE, minRecoveryExecutableRate: MIN_RECOVERY_EXECUTABLE_RATE,
        maxDispatchFailureRate: MAX_DISPATCH_FAILURE_RATE, maxRecoveryP90Hours: MAX_RECOVERY_P90_HOURS
      }
    },
    breakdown: [...groups.values()].sort((a, b) => `${a.source}:${a.subjectCode}`.localeCompare(`${b.source}:${b.subjectCode}`))
  };
}

export function buildQuestionSupplyAcceptanceReport(rows: EvaluationRows, range: { days: number; from: Date; to: Date }) {
  return {
    schemaVersion: '1' as const, mode: 'shadow' as const, generatedAt: range.to.toISOString(), realAdapterAuthorized: false as const,
    overall: buildQuestionSupplyEvaluation(rows, range),
    subjects: SUBJECTS.map((subjectCode) => ({ subjectCode, evaluation: buildQuestionSupplyEvaluation(filterRows(rows, subjectCode), range) }))
  };
}

function anonymizedSampleKey(requestId: string, cycle: number) {
  return createHash('sha256').update(`question-supply-export-v1:${requestId}:${cycle}`).digest('hex').slice(0, 20);
}

export function buildQuestionSupplySanitizedExport(rows: EvaluationRows, range: { days: number; from: Date; to: Date }) {
  const requestMap = new Map(rows.requests.map((item) => [item.id, item]));
  const firstChecks = new Map<string, any>();
  for (const check of [...rows.checks].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())) {
    const key = cycleKey(check.requestId, check.requestCycle);
    if (!firstChecks.has(key)) firstChecks.set(key, check);
  }
  const confirmationKinds = new Map<string, Set<string>>();
  for (const confirmation of rows.confirmations) {
    const key = cycleKey(confirmation.requestId, confirmation.requestCycle);
    const kinds = confirmationKinds.get(key) ?? new Set<string>();
    kinds.add(confirmation.confirmationKind);
    confirmationKinds.set(key, kinds);
  }
  const samples = rows.plans.map((plan) => {
    const request = requestMap.get(plan.requestId) ?? plan.request ?? {};
    const key = cycleKey(plan.requestId, plan.requestCycle);
    const check = firstChecks.get(key);
    const confirmations = confirmationKinds.get(key) ?? new Set<string>();
    const recoveryHours = plan.completedAt ? Number(((plan.completedAt.getTime() - plan.createdAt.getTime()) / 3_600_000).toFixed(2)) : null;
    return {
      sampleKey: anonymizedSampleKey(plan.requestId, plan.requestCycle), source: request.source, subjectCode: request.subjectCode,
      topicIds: Array.isArray(request.topicIds) ? request.topicIds : [], requestedCount: request.requestedCount,
      lastKnownAvailableCount: request.availableCount, observationCount: request.observationCount, requestCycle: plan.requestCycle,
      planStatus: plan.status, attemptCount: plan.attemptCount, firstCheckResult: check?.result ?? null,
      firstCheckAvailableCount: check?.availableCount ?? null, checkerVersion: check?.checkerVersion ?? null,
      domainPreflightConfirmed: confirmations.has('domain_preflight_passed'), taskStarted: confirmations.has('task_started'),
      recoveryHours, createdAt: plan.createdAt.toISOString(), completedAt: plan.completedAt?.toISOString() ?? null
    };
  });
  return {
    schemaVersion: '1' as const, mode: 'shadow' as const, sanitized: true as const, generatedAt: range.to.toISOString(),
    range: { days: range.days, from: range.from.toISOString(), to: range.to.toISOString() }, realAdapterAuthorized: false as const, samples
  };
}

function csvCell(value: unknown) {
  const content = Array.isArray(value) ? value.join('|') : value === null || value === undefined ? '' : String(value);
  return `"${content.replace(/"/g, '""')}"`;
}

export function questionSupplyExportCsv(payload: ReturnType<typeof buildQuestionSupplySanitizedExport>) {
  const fields = payload.samples.length ? Object.keys(payload.samples[0]) : [
    'sampleKey', 'source', 'subjectCode', 'topicIds', 'requestedCount', 'lastKnownAvailableCount', 'observationCount',
    'requestCycle', 'planStatus', 'attemptCount', 'firstCheckResult', 'firstCheckAvailableCount', 'checkerVersion',
    'domainPreflightConfirmed', 'taskStarted', 'recoveryHours', 'createdAt', 'completedAt'
  ];
  return [fields.map(csvCell).join(','), ...payload.samples.map((sample) => fields.map((field) => csvCell((sample as any)[field])).join(','))].join('\n');
}

@Injectable()
export class QuestionSupplyEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluation(queryValue: unknown) {
    const { rows, range } = await this.loadRows(queryValue);
    return buildQuestionSupplyEvaluation(rows, range);
  }

  async getAcceptanceReport(queryValue: unknown) {
    const { rows, range } = await this.loadRows(queryValue);
    return buildQuestionSupplyAcceptanceReport(rows, range);
  }

  async getSanitizedExport(queryValue: unknown) {
    const query = ExportQuerySchema.parse(queryValue ?? {});
    const { rows, range } = await this.loadRows(query);
    const payload = buildQuestionSupplySanitizedExport(rows, range);
    const date = range.to.toISOString().slice(0, 10);
    if (query.format === 'csv') return {
      schemaVersion: '1' as const,
      file: { name: `question-supply-shadow-${date}.csv`, mimeType: 'text/csv;charset=utf-8' },
      content: questionSupplyExportCsv(payload)
    };
    return {
      schemaVersion: '1' as const,
      file: { name: `question-supply-shadow-${date}.json`, mimeType: 'application/json;charset=utf-8' },
      content: payload
    };
  }

  private async loadRows(queryValue: unknown) {
    const query = QuerySchema.parse(queryValue ?? {});
    const to = new Date();
    const from = new Date(to.getTime() - query.days * 86_400_000);
    const [requests, plans, checks, confirmations, events] = await Promise.all([
      this.prisma.questionSupplyRequest.findMany({ where: { lastObservedAt: { gte: from } }, select: {
        id: true, cycle: true, observationCount: true, source: true, subjectCode: true, topicIds: true, requestedCount: true, availableCount: true
      } }),
      this.prisma.questionSupplyFulfillmentPlan.findMany({ where: { createdAt: { gte: from } }, select: {
        requestId: true, requestCycle: true, status: true, attemptCount: true, createdAt: true, completedAt: true,
        request: { select: { source: true, subjectCode: true, topicIds: true, requestedCount: true, availableCount: true, observationCount: true } }
      } }),
      this.prisma.questionSupplyInventoryCheck.findMany({ where: { checkedAt: { gte: from } }, select: {
        requestId: true, requestCycle: true, result: true, checkedAt: true, availableCount: true, checkerVersion: true
      } }),
      this.prisma.questionSupplyRecoveryConfirmation.findMany({ where: { confirmedAt: { gte: from } }, select: {
        requestId: true, requestCycle: true, confirmationKind: true, confirmedAt: true, source: true, subjectCode: true
      } }),
      this.prisma.questionSupplyFulfillmentEvent.findMany({
        where: { createdAt: { gte: from }, action: { in: ['shadow_dispatched', 'dispatch_failed'] } },
        select: { action: true, createdAt: true, plan: { select: { request: { select: { source: true, subjectCode: true } } } } }
      })
    ]);
    return { rows: { requests, plans, checks, confirmations, events }, range: { days: query.days, from, to } };
  }
}
