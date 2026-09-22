import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { TeachingAssetPayloadSchema } from './agent-teaching-asset.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';
import { TEACHING_ASSET_COMPONENT_KEYS } from './teaching-asset-registry';

const ComponentKeySchema = z.enum(TEACHING_ASSET_COMPONENT_KEYS);
const SourceRefSchema = z.strictObject({ type: z.string().trim().min(1).max(60), id: z.string().trim().min(1).max(160), version: z.string().trim().min(1).max(80) });
const VersionFieldsSchema = z.strictObject({
  language: z.enum(['zh-CN', 'en', 'vi']),
  difficultyBand: z.string().trim().min(1).max(40),
  estimatedMinutes: z.number().int().min(1).max(120),
  renderer: z.literal('interactive_component'),
  componentKey: ComponentKeySchema,
  componentVersion: z.literal('1'),
  payloadSchemaVersion: z.string().trim().min(1).max(40),
  payload: z.unknown(),
  fallbackPayload: z.record(z.string(), z.unknown()),
  sourceRefs: z.array(SourceRefSchema).max(20)
});
const CreateSchema = VersionFieldsSchema.extend({
  stableKey: z.string().trim().min(3).max(160).regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/),
  type: z.literal('micro_lesson'),
  subjectCode: z.enum(['math', 'physics', 'chemistry']),
  topicIds: z.array(z.number().int().positive()).min(1).max(20)
});
const UpdateSchema = VersionFieldsSchema.extend({ topicIds: z.array(z.number().int().positive()).min(1).max(20) });
const ListSchema = z.object({ subject: z.enum(['math', 'physics', 'chemistry']).optional(), status: z.enum(['draft', 'review', 'approved', 'published', 'retired']).optional() }).passthrough();
const AnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  versionId: z.string().trim().min(1).optional()
}).passthrough();
const QualityQueueQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
  subject: z.enum(['math', 'physics', 'chemistry']).optional(),
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
  signal: z.enum(['insufficient_data', 'watch', 'review']).optional()
}).passthrough();
const QualityActionSchema = z.strictObject({ action: z.enum(['acknowledge', 'resolve', 'reopen']), reason: z.string().trim().min(3).max(500) });
const RoutingDiagnosticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  subject: z.enum(['math', 'physics', 'chemistry']).optional()
}).passthrough();
const RoutingCircuitActionSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });

const EFFECTIVENESS_POLICY_VERSION = 'teaching-asset-effectiveness-v1';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('；'));
  return result.data;
}
function json(value: unknown) { return value as Prisma.InputJsonValue; }
function objectValue(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }

@Injectable()
export class AdminTeachingAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService,
    private readonly routingOutcomes: TeachingAssetRoutingOutcomeService
  ) {}

  private includeDetail() {
    return {
      versions: { orderBy: { version: 'desc' as const } },
      topics: { include: { topic: { select: { id: true, code: true, title: true, subject: true, status: true, syllabusVersion: true } } }, orderBy: { sortOrder: 'asc' as const } }
    };
  }

  private validateVersion(input: z.infer<typeof VersionFieldsSchema>, subjectCode: string) {
    const validated = parse(VersionFieldsSchema, {
      language: input.language, difficultyBand: input.difficultyBand, estimatedMinutes: input.estimatedMinutes,
      renderer: input.renderer, componentKey: input.componentKey, componentVersion: input.componentVersion,
      payloadSchemaVersion: input.payloadSchemaVersion, payload: input.payload, fallbackPayload: input.fallbackPayload, sourceRefs: input.sourceRefs
    });
    const payload = parse(TeachingAssetPayloadSchema, validated.payload);
    if (payload.component.key !== validated.componentKey || payload.component.version !== validated.componentVersion) throw new BadRequestException('组件键或版本与 payload 不一致。');
    if (!validated.componentKey.startsWith(`${subjectCode}.`)) throw new BadRequestException('组件与资产学科不匹配。');
    const fallback = validated.fallbackPayload as Record<string, unknown>;
    if (!String(fallback.title ?? '').trim() || !String(fallback.body ?? '').trim()) throw new BadRequestException('降级内容必须包含 title 和 body。');
    return payload;
  }

  private async validateTopics(topicIds: number[], subjectCode: string) {
    const uniqueIds = [...new Set(topicIds)];
    const topics = await this.prisma.cscaExamTopic.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, subject: true, status: true, syllabusVersion: true } });
    if (topics.length !== uniqueIds.length) throw new BadRequestException('存在无效知识点。');
    if (topics.some((topic) => topic.subject !== subjectCode || topic.status !== 'published')) throw new BadRequestException('教学资产只能绑定同学科且已发布的知识点。');
    return topics;
  }

  async list(query: unknown) {
    const filter = parse(ListSchema, query);
    const items = await this.prisma.teachingAsset.findMany({
      where: { ...(filter.subject ? { subjectCode: filter.subject } : {}), ...(filter.status ? { status: filter.status } : {}) },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, topics: { include: { topic: { select: { id: true, code: true, title: true } } }, orderBy: { sortOrder: 'asc' } }, _count: { select: { exposures: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const topics = await this.prisma.cscaExamTopic.findMany({ where: { status: 'published', subject: { in: ['math', 'physics', 'chemistry'] } }, select: { id: true, code: true, title: true, subject: true, syllabusVersion: true }, orderBy: [{ subject: 'asc' }, { id: 'asc' }] });
    return { schemaVersion: '1' as const, items, topics, componentKeys: ComponentKeySchema.options };
  }

  async detail(id: string) {
    const item = await this.prisma.teachingAsset.findUnique({ where: { id }, include: this.includeDetail() });
    if (!item) throw new NotFoundException('教学资产不存在。');
    return { schemaVersion: '1' as const, item };
  }

  async routingDiagnostics(query: unknown) {
    const input = parse(RoutingDiagnosticsQuerySchema, query);
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.cscaTrainingEvent.findMany({
      where: {
        eventType: 'teaching_asset_routing_decision', source: 'agent', createdAt: { gte: since },
        ...(input.subject ? { subject: input.subject } : {})
      },
      select: { userId: true, subject: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 5000
    });
    const decisions = rows.map((row) => ({ row, value: objectValue(row.metadata) }));
    const count = decisions.length;
    const metricCount = (predicate: (value: Record<string, any>) => boolean) => decisions.filter(({ value }) => predicate(value)).length;
    const fallbackCount = metricCount((value) => value.personalizedFallback === true);
    const explorationCount = metricCount((value) => value.boundedExploration === true);
    const divergenceCount = metricCount((value) => value.diverged === true);
    const alternateCount = metricCount((value) => Array.isArray(value.reasonCodes) && value.reasonCodes.includes('alternate_after_ineffective_asset'));
    const latencies = decisions.map(({ value }) => Number(value.latencyMs)).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const p95LatencyMs = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : null;
    const coverageRate = count ? (count - fallbackCount) / count : null;
    const fallbackRate = count ? fallbackCount / count : null;
    const explorationRate = count ? explorationCount / count : null;
    const reasonCodes: string[] = [];
    if (count < 50) reasonCodes.push('minimum_shadow_sample_not_met');
    if (coverageRate !== null && coverageRate < 0.8) reasonCodes.push('personalized_coverage_below_floor');
    if (fallbackRate !== null && fallbackRate > 0.2) reasonCodes.push('fallback_rate_above_ceiling');
    if (explorationRate !== null && explorationRate > 0.2) reasonCodes.push('exploration_rate_above_ceiling');
    if (p95LatencyMs !== null && p95LatencyMs > 250) reasonCodes.push('routing_latency_above_ceiling');
    const summarizeSubject = (subject: string) => {
      const scoped = decisions.filter(({ row }) => row.subject === subject);
      const scopedFallback = scoped.filter(({ value }) => value.personalizedFallback === true).length;
      return { subject, decisions: scoped.length, coverageRate: scoped.length ? (scoped.length - scopedFallback) / scoped.length : null, divergenceRate: scoped.length ? scoped.filter(({ value }) => value.diverged === true).length / scoped.length : null };
    };
    const learningOutcomes = await this.routingOutcomes.report({ days: input.days, subject: input.subject });
    return {
      schemaVersion: '1' as const,
      policyVersion: 'teaching-asset-selection-v1',
      currentMode: this.flags.teachingAssetRoutingMode(),
      rollout: this.flags.teachingAssetRoutingRollout(),
      window: { days: input.days, since: since.toISOString(), generatedAt: new Date().toISOString() },
      gate: { qualified: reasonCodes.length === 0, minimumDecisions: 50, reasonCodes, automaticActivation: false },
      metrics: {
        decisions: count, coverageRate, fallbackRate, divergenceRate: count ? divergenceCount / count : null,
        explorationRate, alternateAfterIneffectiveCount: alternateCount, p95LatencyMs,
        modes: Object.fromEntries(['legacy', 'shadow', 'active'].map((mode) => [mode, metricCount((value) => value.routingMode === mode)]))
      },
      subjects: ['math', 'physics', 'chemistry'].map(summarizeSubject),
      learningOutcomes,
      recent: decisions.slice(0, 40).map(({ row, value }) => ({
        studentRef: row.userId ? createHash('sha256').update(`teaching-routing:${row.userId}`).digest('hex').slice(0, 10) : 'anonymous',
        subject: row.subject, contextType: String(value.contextType ?? ''), contextKey: String(value.contextKey ?? ''),
        routingMode: String(value.routingMode ?? ''), legacyVersionId: value.legacyVersionId ?? null,
        personalizedVersionId: value.personalizedVersionId ?? null, servedVersionId: value.servedVersionId ?? null,
        diverged: value.diverged === true, personalizedFallback: value.personalizedFallback === true,
        boundedExploration: value.boundedExploration === true, reasonCodes: Array.isArray(value.reasonCodes) ? value.reasonCodes : [],
        latencyMs: Number.isFinite(Number(value.latencyMs)) ? Number(value.latencyMs) : null, createdAt: row.createdAt
      }))
    };
  }

  async resetRoutingCircuit(subject: string, body: unknown, actorId: number) {
    if (!['math', 'physics', 'chemistry'].includes(subject)) throw new BadRequestException('路由熔断学科无效。');
    const input = parse(RoutingCircuitActionSchema, body);
    const before = await this.routingOutcomes.currentCircuit(subject);
    await this.routingOutcomes.resetCircuit(subject, actorId, input.reason);
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset-routing-circuit', resourceId: subject, action: 'manual_reset', before, after: { status: 'monitoring', reason: input.reason } });
    return this.routingDiagnostics({ days: 30, subject });
  }

  async analytics(id: string, query: unknown) {
    const input = parse(AnalyticsQuerySchema, query);
    const asset = await this.prisma.teachingAsset.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } }
    });
    if (!asset) throw new NotFoundException('教学资产不存在。');
    const selectedVersions = input.versionId
      ? asset.versions.filter((version) => version.id === input.versionId)
      : asset.versions;
    if (input.versionId && !selectedVersions.length) throw new NotFoundException('教学资产版本不存在。');
    const versionIds = selectedVersions.map((version) => version.id);
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const [exposures, interactions, deliveries] = await Promise.all([
      this.prisma.teachingAssetExposure.findMany({
        where: { assetId: id, assetVersionId: { in: versionIds }, lastExposedAt: { gte: since } },
        select: { userId: true, assetVersionId: true, contextKey: true, source: true, status: true, completedAt: true }
      }),
      this.prisma.teachingInteractionEvent.findMany({
        where: { assetVersionId: { in: versionIds }, createdAt: { gte: since } },
        select: { userId: true, assetVersionId: true, contextKey: true, action: true, result: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.learningInterventionDelivery.findMany({
        where: { contentSourceType: 'teaching_asset', contentSourceVersion: { in: versionIds }, createdAt: { gte: since } },
        select: {
          id: true, contentSourceVersion: true,
          outcomes: { select: { result: true, accuracy: true, independent: true, verification: { select: { phase: true } } } },
          stabilityAssessment: { select: { status: true, result: true } }
        }
      })
    ]);

    const summarize = (ids: string[]) => {
      const idSet = new Set(ids);
      const scopedExposures = exposures.filter((item) => idSet.has(item.assetVersionId));
      const scopedInteractions = interactions.filter((item) => idSet.has(item.assetVersionId));
      const scopedDeliveries = deliveries.filter((item) => item.contentSourceVersion && idSet.has(item.contentSourceVersion));
      const answers = scopedInteractions.filter((item) => item.action === 'active_prompt_answered');
      const firstAnswers = new Map<string, (typeof answers)[number]>();
      for (const answer of answers) {
        const key = `${answer.userId}:${answer.assetVersionId}:${answer.contextKey}`;
        if (!firstAnswers.has(key)) firstAnswers.set(key, answer);
      }
      const isCorrect = (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).correct === true);
      const independentOutcomes = scopedDeliveries.flatMap((delivery) => delivery.outcomes).filter((outcome) => outcome.independent);
      const conclusiveOutcomes = independentOutcomes.filter((outcome) => outcome.result === 'passed' || outcome.result === 'failed');
      const passedOutcomes = conclusiveOutcomes.filter((outcome) => outcome.result === 'passed').length;
      const completionRate = scopedExposures.length ? scopedExposures.filter((item) => item.status === 'completed' || item.completedAt).length / scopedExposures.length : null;
      const firstTryCorrectRate = firstAnswers.size ? [...firstAnswers.values()].filter((item) => isCorrect(item.result)).length / firstAnswers.size : null;
      const verificationPassRate = conclusiveOutcomes.length ? passedOutcomes / conclusiveOutcomes.length : null;
      const reasons: string[] = [];
      let signal: 'insufficient_data' | 'healthy' | 'watch' | 'review' = 'healthy';
      const uniqueLearners = new Set(scopedExposures.map((item) => item.userId)).size;
      if (scopedExposures.length < 10 || uniqueLearners < 5 || independentOutcomes.length < 3) {
        signal = 'insufficient_data'; reasons.push('minimum_sample_not_met');
      } else if ((verificationPassRate ?? 1) < 0.5 || (firstTryCorrectRate ?? 1) < 0.4) {
        signal = 'review'; reasons.push('learning_outcome_below_floor');
      } else if ((completionRate ?? 1) < 0.5 || (verificationPassRate ?? 1) < 0.67) {
        signal = 'watch'; reasons.push('engagement_or_verification_below_target');
      }
      const phases = ['immediate', 'retention', 'transfer'].map((phase) => {
        const outcomes = independentOutcomes.filter((outcome) => outcome.verification.phase === phase);
        const conclusive = outcomes.filter((outcome) => outcome.result === 'passed' || outcome.result === 'failed');
        return { phase, total: outcomes.length, passed: conclusive.filter((outcome) => outcome.result === 'passed').length, failed: conclusive.filter((outcome) => outcome.result === 'failed').length, inconclusive: outcomes.filter((outcome) => outcome.result === 'inconclusive').length };
      });
      return {
        exposureContexts: scopedExposures.length,
        uniqueLearners,
        completedContexts: scopedExposures.filter((item) => item.status === 'completed' || item.completedAt).length,
        skippedContexts: scopedExposures.filter((item) => item.status === 'skipped').length,
        completionRate,
        sources: Object.fromEntries(['agent_practice', 'agent_intervention'].map((source) => [source, scopedExposures.filter((item) => item.source === source).length])),
        activePrompt: { attempts: answers.length, firstAttempts: firstAnswers.size, firstTryCorrectRate, passedContexts: new Set(answers.filter((item) => isCorrect(item.result)).map((item) => `${item.userId}:${item.assetVersionId}:${item.contextKey}`)).size },
        independentVerification: { total: independentOutcomes.length, conclusive: conclusiveOutcomes.length, passed: passedOutcomes, failed: conclusiveOutcomes.length - passedOutcomes, inconclusive: independentOutcomes.filter((item) => item.result === 'inconclusive').length, passRate: verificationPassRate, phases },
        stability: { stable: scopedDeliveries.filter((item) => item.stabilityAssessment?.result === 'stable').length, notStable: scopedDeliveries.filter((item) => item.stabilityAssessment?.result === 'not_stable').length, inconclusive: scopedDeliveries.filter((item) => item.stabilityAssessment?.result === 'inconclusive').length, pending: scopedDeliveries.filter((item) => !item.stabilityAssessment || item.stabilityAssessment.status !== 'completed').length },
        operationalSignal: { policyVersion: EFFECTIVENESS_POLICY_VERSION, signal, reasonCodes: reasons, automaticAction: false }
      };
    };
    return {
      schemaVersion: '1' as const,
      asset: { id: asset.id, stableKey: asset.stableKey, subjectCode: asset.subjectCode },
      window: { days: input.days, since: since.toISOString(), generatedAt: new Date().toISOString() },
      aggregate: summarize(versionIds),
      versions: selectedVersions.map((version) => ({ id: version.id, version: version.version, language: version.language, status: version.status, publishedAt: version.publishedAt, metrics: summarize([version.id]) }))
    };
  }

  private qualityFingerprint(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
  }

  async qualityQueue(query: unknown) {
    const input = parse(QualityQueueQuerySchema, query);
    const versions = await this.prisma.teachingAssetVersion.findMany({
      where: { status: 'published', asset: { status: 'published', ...(input.subject ? { subjectCode: input.subject } : {}) } },
      include: { asset: { include: { versions: { orderBy: { version: 'desc' } }, topics: { include: { topic: { select: { title: true, code: true } } } } } } },
      orderBy: { publishedAt: 'desc' }, take: 100
    });
    const candidates = await Promise.all(versions.map(async (version) => {
      const current = (await this.analytics(version.assetId, { days: input.days, versionId: version.id })).aggregate;
      const previous = version.asset.versions.find((item) => item.language === version.language && item.version < version.version && ['published', 'retired'].includes(item.status));
      const previousMetrics = previous ? (await this.analytics(version.assetId, { days: input.days, versionId: previous.id })).aggregate : null;
      const verificationRegression = Boolean(previousMetrics && current.independentVerification.conclusive >= 3 && previousMetrics.independentVerification.conclusive >= 3 && (previousMetrics.independentVerification.passRate ?? 0) - (current.independentVerification.passRate ?? 0) >= 0.15);
      const promptRegression = Boolean(previousMetrics && current.activePrompt.firstAttempts >= 10 && previousMetrics.activePrompt.firstAttempts >= 10 && (previousMetrics.activePrompt.firstTryCorrectRate ?? 0) - (current.activePrompt.firstTryCorrectRate ?? 0) >= 0.2);
      const regression = verificationRegression || promptRegression;
      const signal = regression ? 'review' as const : current.operationalSignal.signal;
      if (signal === 'healthy') return null;
      const reasonCodes = [...new Set([...current.operationalSignal.reasonCodes, ...(regression ? ['version_regression'] : [])])];
      const alertKey = `taq:${version.id}:${input.days}`;
      const fingerprint = this.qualityFingerprint({ policyVersion: current.operationalSignal.policyVersion, versionId: version.id, previousVersionId: previous?.id ?? null, days: input.days, signal, reasonCodes });
      return {
        alertKey, fingerprint, signal, severity: signal === 'review' ? 'high' as const : signal === 'watch' ? 'medium' as const : 'info' as const,
        reasonCodes, asset: { id: version.asset.id, stableKey: version.asset.stableKey, subjectCode: version.asset.subjectCode, topics: version.asset.topics.map((item) => item.topic) },
        version: { id: version.id, version: version.version, language: version.language, publishedAt: version.publishedAt }, metrics: current,
        comparison: previous && previousMetrics ? { versionId: previous.id, version: previous.version, verificationPassRate: previousMetrics.independentVerification.passRate, firstTryCorrectRate: previousMetrics.activePrompt.firstTryCorrectRate, regression } : null
      };
    }));
    const active = candidates.filter((item): item is NonNullable<typeof item> => Boolean(item));
    const audits = active.length ? await this.prisma.adminAuditLog.findMany({
      where: { module: 'teaching-assets', resourceType: 'teaching-asset-quality-alert', resourceId: { in: active.map((item) => item.alertKey) }, action: { in: ['quality_alert_acknowledge', 'quality_alert_resolve', 'quality_alert_reopen'] } },
      orderBy: { createdAt: 'desc' }
    }) : [];
    const latestByKey = new Map<string, (typeof audits)[number]>();
    for (const audit of audits) if (audit.resourceId && !latestByKey.has(audit.resourceId)) latestByKey.set(audit.resourceId, audit);
    const items = active.map((item) => {
      const audit = latestByKey.get(item.alertKey);
      const after = audit?.after && typeof audit.after === 'object' && !Array.isArray(audit.after) ? audit.after as Record<string, unknown> : {};
      const status = after.fingerprint === item.fingerprint && ['acknowledged', 'resolved', 'open'].includes(String(after.status)) ? String(after.status) as 'open' | 'acknowledged' | 'resolved' : 'open';
      return { ...item, workflow: { status, reason: after.fingerprint === item.fingerprint ? String(after.reason ?? '') : '', actorId: after.fingerprint === item.fingerprint ? audit?.actorId ?? null : null, updatedAt: after.fingerprint === item.fingerprint ? audit?.createdAt ?? null : null } };
    }).filter((item) => (!input.status || item.workflow.status === input.status) && (!input.signal || item.signal === input.signal));
    const order = { review: 0, watch: 1, insufficient_data: 2 } as const;
    items.sort((left, right) => order[left.signal] - order[right.signal] || left.asset.stableKey.localeCompare(right.asset.stableKey));
    return { schemaVersion: '1' as const, policyVersion: EFFECTIVENESS_POLICY_VERSION, windowDays: input.days, summary: { total: items.length, open: items.filter((item) => item.workflow.status === 'open').length, acknowledged: items.filter((item) => item.workflow.status === 'acknowledged').length, resolved: items.filter((item) => item.workflow.status === 'resolved').length, review: items.filter((item) => item.signal === 'review').length, watch: items.filter((item) => item.signal === 'watch').length, insufficientData: items.filter((item) => item.signal === 'insufficient_data').length }, items };
  }

  async actOnQualityAlert(alertKey: string, body: unknown, actorId: number) {
    const input = parse(QualityActionSchema, body);
    const match = /^taq:([^:]+):(7|30|90)$/.exec(alertKey);
    if (!match) throw new BadRequestException('质量告警标识无效。');
    const version = await this.prisma.teachingAssetVersion.findUnique({ where: { id: match[1] }, include: { asset: true } });
    if (!version || version.status !== 'published' || version.asset.status !== 'published') throw new NotFoundException('质量告警对应的线上版本不存在。');
    const queue = await this.qualityQueue({ days: Number(match[2]) });
    const alert = queue.items.find((item) => item.alertKey === alertKey);
    if (!alert) throw new ConflictException('当前版本没有需要处理的质量告警。');
    const targets = { acknowledge: 'acknowledged', resolve: 'resolved', reopen: 'open' } as const;
    const target = targets[input.action];
    const allowed = { open: ['acknowledged', 'resolved'], acknowledged: ['resolved', 'open'], resolved: ['open'] } as const;
    if (!(allowed[alert.workflow.status] as readonly string[]).includes(target)) throw new ConflictException('当前质量告警状态不能执行该操作。');
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset-quality-alert', resourceId: alertKey, action: `quality_alert_${input.action}`, before: { status: alert.workflow.status, fingerprint: alert.fingerprint }, after: { status: target, fingerprint: alert.fingerprint, reason: input.reason, assetId: alert.asset.id, versionId: alert.version.id, signal: alert.signal, policyVersion: EFFECTIVENESS_POLICY_VERSION } });
    return this.qualityQueue({ days: Number(match[2]) });
  }

  async create(body: unknown, actorId: number) {
    const input = parse(CreateSchema, body);
    if (await this.prisma.teachingAsset.findUnique({ where: { stableKey: input.stableKey }, select: { id: true } })) throw new ConflictException('稳定键已存在，请为现有资产创建新版本。');
    const payload = this.validateVersion(input, input.subjectCode);
    await this.validateTopics(input.topicIds, input.subjectCode);
    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.teachingAsset.create({ data: { stableKey: input.stableKey, type: input.type, subjectCode: input.subjectCode, status: 'draft' } });
      const version = await tx.teachingAssetVersion.create({ data: {
        assetId: asset.id, version: 1, status: 'draft', language: input.language, difficultyBand: input.difficultyBand, estimatedMinutes: input.estimatedMinutes,
        renderer: input.renderer, componentKey: input.componentKey, componentVersion: input.componentVersion, payloadSchemaVersion: input.payloadSchemaVersion,
        payload: json(payload), fallbackPayload: json(input.fallbackPayload), sourceRefs: json(input.sourceRefs), reviewState: 'not_submitted'
      } });
      await tx.teachingAssetTopic.createMany({ data: [...new Set(input.topicIds)].map((topicId, index) => ({ assetId: asset.id, topicId, relationship: 'primary', sortOrder: index })) });
      return { asset, version };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset', resourceId: result.asset.id, action: 'create_draft', after: { stableKey: result.asset.stableKey, versionId: result.version.id } });
    return this.detail(result.asset.id);
  }

  async createVersion(assetId: string, actorId: number) {
    const asset = await this.prisma.teachingAsset.findUnique({ where: { id: assetId }, include: this.includeDetail() });
    if (!asset || !asset.versions[0]) throw new NotFoundException('教学资产不存在。');
    if (asset.versions.some((version) => version.status === 'draft' || version.status === 'review' || version.status === 'approved')) throw new ConflictException('当前资产已有未完成的草稿、审核或待发布版本。');
    const latest = asset.versions[0];
    const version = await this.prisma.teachingAssetVersion.create({ data: {
      assetId, version: latest.version + 1, status: 'draft', language: latest.language, difficultyBand: latest.difficultyBand, estimatedMinutes: latest.estimatedMinutes,
      renderer: latest.renderer, componentKey: latest.componentKey, componentVersion: latest.componentVersion, payloadSchemaVersion: latest.payloadSchemaVersion,
      payload: json(latest.payload), fallbackPayload: json(latest.fallbackPayload), sourceRefs: json(latest.sourceRefs), reviewState: 'not_submitted'
    } });
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset-version', resourceId: version.id, action: 'create_version', after: { assetId, version: version.version } });
    return this.detail(assetId);
  }

  async updateVersion(versionId: string, body: unknown, actorId: number) {
    const input = parse(UpdateSchema, body);
    const current = await this.prisma.teachingAssetVersion.findUnique({ where: { id: versionId }, include: { asset: true } });
    if (!current) throw new NotFoundException('教学资产版本不存在。');
    if (current.status !== 'draft') throw new ConflictException('只有草稿版本可以编辑。');
    const payload = this.validateVersion(input, current.asset.subjectCode);
    await this.validateTopics(input.topicIds, current.asset.subjectCode);
    const [publishedCount, currentTopics] = await Promise.all([
      this.prisma.teachingAssetVersion.count({ where: { assetId: current.assetId, status: 'published' } }),
      this.prisma.teachingAssetTopic.findMany({ where: { assetId: current.assetId, relationship: 'primary' }, select: { topicId: true } })
    ]);
    const currentTopicIds = currentTopics.map((item) => item.topicId).sort((a, b) => a - b);
    const nextTopicIds = [...new Set(input.topicIds)].sort((a, b) => a - b);
    if (publishedCount > 0 && JSON.stringify(currentTopicIds) !== JSON.stringify(nextTopicIds)) throw new ConflictException('存在已发布版本时不能修改资产知识点；请创建新的稳定资产。');
    await this.prisma.$transaction(async (tx) => {
      await tx.teachingAssetVersion.update({ where: { id: versionId }, data: {
        language: input.language, difficultyBand: input.difficultyBand, estimatedMinutes: input.estimatedMinutes, renderer: input.renderer,
        componentKey: input.componentKey, componentVersion: input.componentVersion, payloadSchemaVersion: input.payloadSchemaVersion,
        payload: json(payload), fallbackPayload: json(input.fallbackPayload), sourceRefs: json(input.sourceRefs), reviewState: 'not_submitted'
      } });
      await tx.teachingAssetTopic.deleteMany({ where: { assetId: current.assetId, relationship: 'primary' } });
      await tx.teachingAssetTopic.createMany({ data: [...new Set(input.topicIds)].map((topicId, index) => ({ assetId: current.assetId, topicId, relationship: 'primary', sortOrder: index })) });
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset-version', resourceId: versionId, action: 'update_draft', before: { status: current.status }, after: { status: 'draft' } });
    return this.detail(current.assetId);
  }

  async transition(versionId: string, action: 'submit' | 'approve' | 'return' | 'publish' | 'retire', actorId: number) {
    const current = await this.prisma.teachingAssetVersion.findUnique({ where: { id: versionId }, include: { asset: { include: { topics: true } } } });
    if (!current) throw new NotFoundException('教学资产版本不存在。');
    const sources = Array.isArray(current.sourceRefs) ? current.sourceRefs : [];
    const transitions = {
      submit: { from: 'draft', to: 'review', reviewState: 'pending_review' },
      approve: { from: 'review', to: 'approved', reviewState: 'approved' },
      return: { from: 'review', to: 'draft', reviewState: 'changes_requested' },
      publish: { from: 'approved', to: 'published', reviewState: 'approved' },
      retire: { from: 'published', to: 'retired', reviewState: current.reviewState }
    } as const;
    const transition = transitions[action];
    if (current.status !== transition.from) throw new ConflictException(`当前状态 ${current.status} 不能执行 ${action}。`);
    if ((action === 'submit' || action === 'publish') && (!sources.length || !current.asset.topics.length)) throw new BadRequestException('进入审核或发布前必须配置来源与知识点。');
    this.validateVersion({
      language: current.language as 'zh-CN' | 'en' | 'vi', difficultyBand: current.difficultyBand, estimatedMinutes: current.estimatedMinutes,
      renderer: current.renderer as 'interactive_component', componentKey: current.componentKey as z.infer<typeof ComponentKeySchema>, componentVersion: current.componentVersion as '1',
      payloadSchemaVersion: current.payloadSchemaVersion, payload: current.payload, fallbackPayload: current.fallbackPayload as Record<string, unknown>, sourceRefs: sources as z.infer<typeof SourceRefSchema>[]
    }, current.asset.subjectCode);
    await this.prisma.$transaction(async (tx) => {
      if (action === 'publish') await tx.teachingAssetVersion.updateMany({ where: { assetId: current.assetId, language: current.language, status: 'published', id: { not: versionId } }, data: { status: 'retired', retiredAt: new Date() } });
      await tx.teachingAssetVersion.update({ where: { id: versionId }, data: {
        status: transition.to, reviewState: transition.reviewState,
        ...(action === 'approve' ? { reviewedByUserId: actorId, reviewedAt: new Date() } : {}),
        ...(action === 'publish' ? { publishedAt: new Date(), retiredAt: null } : {}),
        ...(action === 'retire' ? { retiredAt: new Date() } : {})
      } });
      const publishedCount = await tx.teachingAssetVersion.count({ where: { assetId: current.assetId, status: 'published' } });
      await tx.teachingAsset.update({ where: { id: current.assetId }, data: { status: publishedCount > 0 ? 'published' : transition.to } });
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'teaching-assets', resourceType: 'teaching-asset-version', resourceId: versionId, action, before: { status: current.status }, after: { status: transition.to, assetId: current.assetId } });
    return this.detail(current.assetId);
  }
}
