import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildForecastCalibrationArtifact,
  buildItemCalibrationArtifact,
  ForecastCalibrationInputSchema,
  ItemCalibrationInputSchema
} from '../learning-intelligence/calibration/score-calibration-engine';
import { ScoreCalibrationGovernanceService } from '../learning-intelligence/readiness/score-calibration-governance.service';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const ReasonSchema = z.string().trim().min(8).max(500);
const SnapshotKindSchema = z.enum(['item', 'forecast']);
const ReviewDecisionSchema = z.enum(['approve', 'reject']);
const PolicyInputSchema = z.strictObject({
  examSystemCode: z.string().trim().min(1).max(40),
  policyVersion: z.string().trim().min(1).max(80),
  sourceType: z.enum(['official', 'provisional']),
  sourceTitle: z.string().trim().min(1).max(240),
  sourceUrl: z.string().url().startsWith('https://').max(1000).nullable(),
  sourcePublishedAt: z.iso.date().nullable().optional(),
  sourceSnapshotHash: Sha256Schema,
  scoreScale: z.record(z.string(), z.unknown()),
  scoringRules: z.record(z.string(), z.unknown()),
  effectiveFrom: z.iso.date().nullable().optional(),
  effectiveTo: z.iso.date().nullable().optional(),
  supersedesPolicyId: z.string().min(1).max(120).nullable().optional()
}).superRefine((value, context) => {
  if (value.sourceType === 'official' && !value.sourceUrl) {
    context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Official policies require an HTTPS source URL.' });
  }
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Effective end must not precede start.' });
  }
});

function parsed<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: result.error.issues });
  return result.data;
}

function eventData(input: {
  resourceType: 'scoring_policy' | 'item_calibration' | 'forecast_calibration';
  resourceId: string;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId: number;
  reason: string;
  payload?: Record<string, unknown>;
}) {
  return {
    ...input,
    fromStatus: input.fromStatus ?? null,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue
  };
}

@Injectable()
export class ScoreCalibrationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: ScoreCalibrationGovernanceService
  ) {}

  async overview() {
    const [policies, itemSnapshots, forecastSnapshots, events] = await Promise.all([
      this.prisma.examScoringPolicy.findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 }),
      this.prisma.itemCalibrationSnapshot.findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 }),
      this.prisma.forecastCalibrationSnapshot.findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 }),
      this.prisma.scoreCalibrationGovernanceEvent.findMany({ orderBy: [{ createdAt: 'desc' }], take: 100 })
    ]);
    return { policies, itemSnapshots, forecastSnapshots, events, numericForecastRelease: 'disabled' as const };
  }

  async createPolicy(raw: unknown, actorUserId: number) {
    const input = parsed(PolicyInputSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.examScoringPolicy.create({ data: {
        ...input,
        sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        scoreScale: input.scoreScale as Prisma.InputJsonValue,
        scoringRules: input.scoringRules as Prisma.InputJsonValue,
        supersedesPolicyId: input.supersedesPolicyId ?? null,
        createdByUserId: actorUserId
      } });
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'scoring_policy', resourceId: policy.id, action: 'created', toStatus: policy.status,
        actorUserId, reason: 'Created scoring policy draft.', payload: { policyVersion: policy.policyVersion }
      }) });
      return policy;
    });
  }

  async reviewPolicy(id: string, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.examScoringPolicy.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Scoring policy not found.');
      if (current.status !== 'draft') throw new ConflictException('Only draft policies can be reviewed.');
      if (current.createdByUserId === actorUserId) throw new ConflictException('Policy creator cannot review the same policy.');
      const changed = await tx.examScoringPolicy.updateMany({ where: { id, status: 'draft' }, data: {
        status: 'reviewed', reviewedByUserId: actorUserId, reviewedAt: new Date()
      } });
      if (changed.count !== 1) throw new ConflictException('Scoring policy changed while it was being reviewed.');
      const policy = (await tx.examScoringPolicy.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'scoring_policy', resourceId: id, action: 'reviewed', fromStatus: current.status,
        toStatus: policy.status, actorUserId, reason, payload: { policyVersion: policy.policyVersion }
      }) });
      return policy;
    });
  }

  async activatePolicy(id: string, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.examScoringPolicy.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Scoring policy not found.');
      if (current.status !== 'reviewed' || !current.reviewedByUserId) {
        throw new ConflictException('Only independently reviewed policies can be activated.');
      }
      if (current.sourceType !== 'official' || !current.sourceUrl) {
        throw new ConflictException('Only official policies with a source URL can be activated.');
      }
      const previous = await tx.examScoringPolicy.findFirst({
        where: { examSystemCode: current.examSystemCode, status: 'active', id: { not: id } }
      });
      if (previous) {
        const superseded = await tx.examScoringPolicy.updateMany({
          where: { id: previous.id, status: 'active' }, data: { status: 'superseded' }
        });
        if (superseded.count !== 1) throw new ConflictException('Active policy changed during activation.');
        await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
          resourceType: 'scoring_policy', resourceId: previous.id, action: 'superseded',
          fromStatus: 'active', toStatus: 'superseded', actorUserId, reason,
          payload: { supersededByPolicyId: id }
        }) });
      }
      const activated = await tx.examScoringPolicy.updateMany({
        where: { id, status: 'reviewed' }, data: { status: 'active', activatedAt: new Date() }
      });
      if (activated.count !== 1) throw new ConflictException('Scoring policy changed during activation.');
      const policy = (await tx.examScoringPolicy.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'scoring_policy', resourceId: id, action: 'activated', fromStatus: current.status,
        toStatus: policy.status, actorUserId, reason, payload: { policyVersion: policy.policyVersion }
      }) });
      return policy;
    });
  }

  async withdrawPolicy(id: string, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.examScoringPolicy.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Scoring policy not found.');
      if (!['draft', 'reviewed', 'active'].includes(current.status)) throw new ConflictException('Policy is already closed.');
      const changed = await tx.examScoringPolicy.updateMany({
        where: { id, status: current.status }, data: { status: 'withdrawn' }
      });
      if (changed.count !== 1) throw new ConflictException('Scoring policy changed during withdrawal.');
      const policy = (await tx.examScoringPolicy.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'scoring_policy', resourceId: id, action: 'withdrawn', fromStatus: current.status,
        toStatus: policy.status, actorUserId, reason, payload: { policyVersion: policy.policyVersion }
      }) });
      return policy;
    });
  }

  async buildItemSnapshot(raw: unknown, actorUserId: number) {
    const input = parsed(ItemCalibrationInputSchema, raw);
    const artifact = buildItemCalibrationArtifact(input);
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.itemCalibrationSnapshot.create({ data: {
        calibrationVersion: artifact.calibrationVersion,
        examSystemCode: artifact.examSystemCode,
        subjectCode: artifact.subjectCode,
        itemBankVersion: artifact.itemBankVersion,
        sampleCount: artifact.metrics.sampleCount,
        itemCount: artifact.metrics.itemCount,
        holdoutSampleCount: artifact.metrics.holdoutSampleCount,
        metrics: { ...artifact.metrics, sourceDatasetHash: artifact.sourceDatasetHash, policyVersion: artifact.policyVersion } as Prisma.InputJsonValue,
        releaseCriteria: artifact.releaseCriteria as unknown as Prisma.InputJsonValue,
        criteriaResults: artifact.criteriaResults as Prisma.InputJsonValue,
        allCriteriaPassed: artifact.allCriteriaPassed,
        artifactHash: artifact.artifactHash,
        dataWindowStart: new Date(artifact.dataWindowStart),
        dataWindowEnd: new Date(artifact.dataWindowEnd),
        createdByUserId: actorUserId
      } });
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'item_calibration', resourceId: snapshot.id, action: 'built', toStatus: snapshot.status,
        actorUserId, reason: 'Built deterministic item calibration artifact.',
        payload: { artifactHash: snapshot.artifactHash, allCriteriaPassed: snapshot.allCriteriaPassed }
      }) });
      return snapshot;
    });
  }

  async buildForecastSnapshot(raw: unknown, actorUserId: number) {
    const envelope = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
    const datasetManifestId = envelope.datasetManifestId === undefined ? null
      : parsed(z.string().min(1).max(120), envelope.datasetManifestId);
    delete envelope.datasetManifestId;
    const input = parsed(ForecastCalibrationInputSchema, envelope);
    const artifact = buildForecastCalibrationArtifact(input);
    return this.prisma.$transaction(async (tx) => {
      const [policy, itemCalibration, datasetManifest] = await Promise.all([
        tx.examScoringPolicy.findUnique({ where: { policyVersion: artifact.scoringPolicyVersion } }),
        tx.itemCalibrationSnapshot.findUnique({ where: { calibrationVersion: artifact.itemCalibrationVersion } }),
        datasetManifestId ? tx.forecastCalibrationDatasetManifest.findUnique({ where: { id: datasetManifestId } }) : null
      ]);
      if (!policy) throw new BadRequestException('Referenced scoring policy does not exist.');
      if (!itemCalibration) throw new BadRequestException('Referenced item calibration does not exist.');
      if (policy.examSystemCode !== artifact.examSystemCode) {
        throw new BadRequestException('Scoring policy scope does not match forecast calibration scope.');
      }
      if (itemCalibration.examSystemCode !== artifact.examSystemCode || itemCalibration.subjectCode !== artifact.subjectCode) {
        throw new BadRequestException('Item calibration scope does not match forecast calibration scope.');
      }
      if (artifact.outcomeSource === 'verified_csca_exam' && (!datasetManifest || datasetManifest.status !== 'active'
        || datasetManifest.sourceDatasetHash !== artifact.sourceDatasetHash
        || datasetManifest.forecastArtifactHash !== artifact.artifactHash
        || datasetManifest.examSystemCode !== artifact.examSystemCode
        || datasetManifest.subjectCode !== artifact.subjectCode
        || datasetManifest.scoringPolicyVersion !== artifact.scoringPolicyVersion
        || datasetManifest.itemCalibrationVersion !== artifact.itemCalibrationVersion)) {
        throw new ConflictException('Verified CSCA input requires its matching active server-generated dataset manifest.');
      }
      if (artifact.outcomeSource !== 'verified_csca_exam' && datasetManifestId) {
        throw new BadRequestException('Verified-outcome manifests cannot be attached to proxy inputs.');
      }
      const snapshot = await tx.forecastCalibrationSnapshot.create({ data: {
        calibrationVersion: artifact.calibrationVersion,
        examSystemCode: artifact.examSystemCode,
        subjectCode: artifact.subjectCode,
        languageCode: artifact.languageCode ?? null,
        examFormCode: artifact.examFormCode ?? null,
        forecastModelVersion: artifact.forecastModelVersion,
        scoringPolicyVersion: artifact.scoringPolicyVersion,
        itemCalibrationVersion: artifact.itemCalibrationVersion,
        outcomeSource: artifact.outcomeSource,
        sampleCount: input.rows.length,
        holdoutSampleCount: input.rows.length,
        metrics: { ...artifact.metrics, sourceDatasetHash: artifact.sourceDatasetHash,
          policyVersion: artifact.policyVersion, outcomeSource: artifact.outcomeSource } as Prisma.InputJsonValue,
        subgroupMetrics: artifact.subgroupMetrics as unknown as Prisma.InputJsonValue,
        releaseCriteria: artifact.releaseCriteria as unknown as Prisma.InputJsonValue,
        criteriaResults: artifact.criteriaResults as Prisma.InputJsonValue,
        allCriteriaPassed: artifact.allCriteriaPassed,
        artifactHash: artifact.artifactHash,
        dataWindowStart: new Date(artifact.dataWindowStart),
        dataWindowEnd: new Date(artifact.dataWindowEnd),
        datasetManifestId,
        createdByUserId: actorUserId
      } });
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'forecast_calibration', resourceId: snapshot.id, action: 'built', toStatus: snapshot.status,
        actorUserId, reason: 'Built deterministic forecast calibration artifact.',
        payload: { artifactHash: snapshot.artifactHash, allCriteriaPassed: snapshot.allCriteriaPassed }
      }) });
      return snapshot;
    });
  }

  async reviewSnapshot(kind: 'item' | 'forecast', id: string, rawDecision: unknown, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    const safeKind = parsed(SnapshotKindSchema, kind);
    const decision = parsed(ReviewDecisionSchema, rawDecision);
    return safeKind === 'item'
      ? this.reviewItemSnapshot(id, decision, reason, actorUserId)
      : this.reviewForecastSnapshot(id, decision, reason, actorUserId);
  }

  private async reviewItemSnapshot(id: string, decision: 'approve' | 'reject', reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.itemCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Item calibration snapshot not found.');
      if (current.status !== 'shadow') throw new ConflictException('Only shadow snapshots can be reviewed.');
      if (current.createdByUserId === actorUserId) throw new ConflictException('Artifact creator cannot review the same snapshot.');
      if (decision === 'approve' && !current.allCriteriaPassed) throw new ConflictException('Failed release criteria cannot be approved.');
      const status = decision === 'approve' ? 'reviewed' : 'rejected';
      const changed = await tx.itemCalibrationSnapshot.updateMany({ where: { id, status: 'shadow' }, data: {
        status, reviewedByUserId: actorUserId, reviewedAt: new Date()
      } });
      if (changed.count !== 1) throw new ConflictException('Item calibration changed during review.');
      const snapshot = (await tx.itemCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'item_calibration', resourceId: id, action: decision === 'approve' ? 'reviewed' : 'rejected',
        fromStatus: current.status, toStatus: status, actorUserId, reason,
        payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  private async reviewForecastSnapshot(id: string, decision: 'approve' | 'reject', reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.forecastCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Forecast calibration snapshot not found.');
      if (current.status !== 'shadow') throw new ConflictException('Only shadow snapshots can be reviewed.');
      if (current.createdByUserId === actorUserId) throw new ConflictException('Artifact creator cannot review the same snapshot.');
      if (decision === 'approve' && (!current.allCriteriaPassed || current.outcomeSource !== 'verified_csca_exam')) {
        throw new ConflictException('Only verified CSCA outcomes with all release criteria passed can be approved.');
      }
      if (decision === 'approve') {
        const manifest = current.datasetManifestId
          ? await tx.forecastCalibrationDatasetManifest.findUnique({ where: { id: current.datasetManifestId } }) : null;
        if (!manifest || manifest.status !== 'active') {
          throw new ConflictException('The verified outcome dataset manifest is missing or invalidated.');
        }
      }
      const status = decision === 'approve' ? 'reviewed' : 'rejected';
      const changed = await tx.forecastCalibrationSnapshot.updateMany({ where: { id, status: 'shadow' }, data: {
        status, reviewedByUserId: actorUserId, reviewedAt: new Date()
      } });
      if (changed.count !== 1) throw new ConflictException('Forecast calibration changed during review.');
      const snapshot = (await tx.forecastCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'forecast_calibration', resourceId: id, action: decision === 'approve' ? 'reviewed' : 'rejected',
        fromStatus: current.status, toStatus: status, actorUserId, reason,
        payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  async qualifySnapshot(kind: 'item' | 'forecast', id: string, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    const safeKind = parsed(SnapshotKindSchema, kind);
    return safeKind === 'item'
      ? this.qualifyItemSnapshot(id, reason, actorUserId)
      : this.qualifyForecastSnapshot(id, reason, actorUserId);
  }

  private async qualifyItemSnapshot(id: string, reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.itemCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Item calibration snapshot not found.');
      if (current.status !== 'reviewed' || !current.allCriteriaPassed || !current.reviewedByUserId) {
        throw new ConflictException('Only reviewed snapshots with all criteria passed can be qualified.');
      }
      const changed = await tx.itemCalibrationSnapshot.updateMany({
        where: { id, status: 'reviewed' }, data: { status: 'qualified', qualifiedAt: new Date() }
      });
      if (changed.count !== 1) throw new ConflictException('Item calibration changed during qualification.');
      const snapshot = (await tx.itemCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'item_calibration', resourceId: id, action: 'qualified', fromStatus: current.status,
        toStatus: snapshot.status, actorUserId, reason, payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  private async qualifyForecastSnapshot(id: string, reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.forecastCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Forecast calibration snapshot not found.');
      if (current.status !== 'reviewed' || current.outcomeSource !== 'verified_csca_exam'
        || !current.allCriteriaPassed || !current.reviewedByUserId) {
        throw new ConflictException('Only reviewed, verified-CSCA snapshots with all criteria passed can be qualified.');
      }
      const [policy, item, manifest] = await Promise.all([
        tx.examScoringPolicy.findUnique({ where: { policyVersion: current.scoringPolicyVersion } }),
        tx.itemCalibrationSnapshot.findUnique({ where: { calibrationVersion: current.itemCalibrationVersion } }),
        current.datasetManifestId ? tx.forecastCalibrationDatasetManifest.findUnique({ where: { id: current.datasetManifestId } }) : null
      ]);
      if (policy?.status !== 'active' || item?.status !== 'qualified'
        || policy.examSystemCode !== current.examSystemCode
        || item.examSystemCode !== current.examSystemCode
        || item.subjectCode !== current.subjectCode || !manifest || manifest.status !== 'active') {
        throw new ConflictException('Forecast qualification requires active governance inputs and a live verified dataset manifest.');
      }
      const changed = await tx.forecastCalibrationSnapshot.updateMany({
        where: { id, status: 'reviewed' }, data: { status: 'qualified', qualifiedAt: new Date() }
      });
      if (changed.count !== 1) throw new ConflictException('Forecast calibration changed during qualification.');
      const snapshot = (await tx.forecastCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'forecast_calibration', resourceId: id, action: 'qualified', fromStatus: current.status,
        toStatus: snapshot.status, actorUserId, reason, payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  async retireSnapshot(kind: 'item' | 'forecast', id: string, rawReason: unknown, actorUserId: number) {
    const reason = parsed(ReasonSchema, rawReason);
    const safeKind = parsed(SnapshotKindSchema, kind);
    return safeKind === 'item'
      ? this.retireItemSnapshot(id, reason, actorUserId)
      : this.retireForecastSnapshot(id, reason, actorUserId);
  }

  private async retireItemSnapshot(id: string, reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.itemCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Item calibration snapshot not found.');
      if (current.status === 'retired') throw new ConflictException('Snapshot is already retired.');
      const changed = await tx.itemCalibrationSnapshot.updateMany({
        where: { id, status: current.status }, data: { status: 'retired' }
      });
      if (changed.count !== 1) throw new ConflictException('Item calibration changed during retirement.');
      const snapshot = (await tx.itemCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'item_calibration', resourceId: id, action: 'retired', fromStatus: current.status,
        toStatus: snapshot.status, actorUserId, reason, payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  private async retireForecastSnapshot(id: string, reason: string, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.forecastCalibrationSnapshot.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Forecast calibration snapshot not found.');
      if (current.status === 'retired') throw new ConflictException('Snapshot is already retired.');
      const changed = await tx.forecastCalibrationSnapshot.updateMany({
        where: { id, status: current.status }, data: { status: 'retired' }
      });
      if (changed.count !== 1) throw new ConflictException('Forecast calibration changed during retirement.');
      const snapshot = (await tx.forecastCalibrationSnapshot.findUnique({ where: { id } }))!;
      await tx.scoreCalibrationGovernanceEvent.create({ data: eventData({
        resourceType: 'forecast_calibration', resourceId: id, action: 'retired', fromStatus: current.status,
        toStatus: snapshot.status, actorUserId, reason, payload: { artifactHash: current.artifactHash }
      }) });
      return snapshot;
    });
  }

  evaluateGate(query: Record<string, unknown>) {
    const input = parsed(z.strictObject({
      examSystemCode: z.string().min(1).max(40),
      subjectCode: z.enum(['math', 'physics', 'chemistry']),
      scoringPolicyVersion: z.string().min(1).max(80),
      itemCalibrationVersion: z.string().min(1).max(100),
      forecastModelVersion: z.string().min(1).max(100)
    }), query);
    return this.gate.evaluate(input);
  }
}
