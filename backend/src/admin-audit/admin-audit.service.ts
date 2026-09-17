import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CscaLearningService } from '../csca-learning/csca-learning.service';
import { ReadinessActionCalibrationSnapshotRefreshResult } from '../csca-learning/csca-learning.types';
import { PrismaService } from '../prisma/prisma.service';
import { recordAdminAudit } from './admin-audit-log';
import { AdminAuditEvent, AdminReadinessEvidenceDetail, AdminReadinessEvidenceFile, AuditItem, AuditSummary } from './admin-audit.types';

type DbAuditLog = Awaited<ReturnType<PrismaService['adminAuditLog']['findMany']>>[number];

const READINESS_EVIDENCE_FILE_PATTERN = /^csca-readiness-(?!compare-).+\.json$/i;
const READINESS_COMPARISON_FILE_PATTERN = /^csca-readiness-compare-.+\.json$/i;

function readPlainObject(value: unknown) {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readStringField(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return typeof item === 'string' ? item : null;
}

function readConclusionStatus(value: Record<string, unknown>) {
  const conclusion = readPlainObject(value.conclusion);
  return conclusion ? readStringField(conclusion, 'rolloutStatus') : readStringField(value, 'status');
}

function cleanAuditFilter(value: unknown, max = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function readPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function readPositiveNumberField(value: Record<string, unknown> | undefined, key: string) {
  if (!value) return null;
  const parsed = Number(value[key] ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readOptionalStringField(value: Record<string, unknown> | undefined, key: string) {
  if (!value) return null;
  const item = value[key];
  const text = typeof item === 'string' ? item.trim() : '';
  return text || null;
}

function readOrganizationIdFromAudit(event: DbAuditLog, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const fromPayload = readPositiveNumberField(after, 'organizationId') ?? readPositiveNumberField(before, 'organizationId');
  if (fromPayload) return fromPayload;
  if (event.resourceType === 'organization' && event.resourceId) {
    const parsed = Number(event.resourceId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

@Injectable()
export class AdminAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cscaLearningService: CscaLearningService
  ) {}

  async listItems(): Promise<AuditItem[]> {
    const summary = await this.getSummary();

    return [
      {
        id: 'school-copy',
        title: '院校案例字段',
        status: `${summary.schoolsVerified}/${summary.schoolsTotal} 已核验`,
        detail: summary.schoolsPending > 0 ? `仍有 ${summary.schoolsPending} 所学校待继续核验。` : '当前公开院校案例都已有来源与核验时间。'
      },
      {
        id: 'school-changes',
        title: '院校后台变更',
        status: `${summary.schoolChangeCount} 次变更`,
        detail: summary.latestSchoolChangeAt ? `最近一次院校更新：${summary.latestSchoolChangeAt}` : '还没有院校后台更新记录。'
      },
      {
        id: 'admin-audit-events',
        title: '后台操作审计',
        status: `${summary.adminAuditEventCount} 条事件`,
        detail: summary.latestAdminAuditEventAt ? `最近一次后台操作：${summary.latestAdminAuditEventAt}` : '还没有后台操作审计事件。'
      },
      {
        id: 'exam-practice-activity',
        title: '模考与专项记录',
        status: `${summary.mockExamAttemptCount} 次模考 / ${summary.specialPracticeSessionCount} 次专项`,
        detail: '练习数据重点查看在线模考和专项练习。'
      }
    ];
  }

  async getSummary(): Promise<AuditSummary> {
    const [
      schoolsTotal,
      schoolsVerified,
      adminAuditEventCount,
      latestAdminAuditEvent,
      schoolChangeCount,
      latestSchoolChange,
      mockExamAttemptCount,
      specialPracticeSessionCount
    ] = await Promise.all([
      this.prisma.school.count({ where: { status: 'published' } }),
      this.prisma.school.count({ where: { status: 'published', lastVerifiedAt: { not: null }, sourceUrl: { not: null } } }),
      this.prisma.adminAuditLog.count(),
      this.prisma.adminAuditLog.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.schoolChangeLog.count(),
      this.prisma.schoolChangeLog.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.mockExamAttempt.count(),
      this.prisma.specialPracticeSession.count()
    ]);

    return {
      schoolsTotal,
      schoolsVerified,
      schoolsPending: Math.max(0, schoolsTotal - schoolsVerified),
      adminAuditEventCount,
      latestAdminAuditEventAt: latestAdminAuditEvent?.createdAt.toISOString() ?? null,
      schoolChangeCount,
      latestSchoolChangeAt: latestSchoolChange?.createdAt.toISOString() ?? null,
      mockExamAttemptCount,
      specialPracticeSessionCount
    };
  }

  async listEvents(query: Record<string, unknown> = {}): Promise<AdminAuditEvent[]> {
    const module = cleanAuditFilter(query.module);
    const resourceType = cleanAuditFilter(query.resourceType);
    const action = cleanAuditFilter(query.action);
    const organizationId = Number(query.organizationId ?? 0);
    const limit = readPositiveInt(query.limit, 50, 200);
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(module ? { module } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(action ? { action } : {})
    };
    if (Number.isInteger(organizationId) && organizationId > 0) {
      where.OR = [
        { resourceType: 'organization', resourceId: String(organizationId) },
        { after: { path: ['organizationId'], equals: organizationId } },
        { before: { path: ['organizationId'], equals: organizationId } }
      ];
    }
    const events = await this.prisma.adminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit
    });
    const actorIds = Array.from(new Set(events.map((event) => event.actorId).filter((value): value is number => typeof value === 'number')));
    const eventContexts = events.map((event) => {
      const before = readPlainObject(event.before);
      const after = readPlainObject(event.after);
      return {
        event,
        before,
        after,
        organizationId: readOrganizationIdFromAudit(event, before, after),
        relatedUserId: readPositiveNumberField(after, 'userId') ?? readPositiveNumberField(before, 'userId'),
        targetEmail: readOptionalStringField(after, 'email') ?? readOptionalStringField(before, 'email')
      };
    });
    const organizationIds = Array.from(new Set(eventContexts.map((context) => context.organizationId).filter((value): value is number => typeof value === 'number')));
    const relatedUserIds = Array.from(new Set(eventContexts.map((context) => context.relatedUserId).filter((value): value is number => typeof value === 'number')));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, loginName: true }
        })
      : [];
    const organizations = organizationIds.length
      ? await this.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true, slug: true }
        })
      : [];
    const relatedUsers = relatedUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: relatedUserIds } },
          select: { id: true, email: true, loginName: true }
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor.email ?? actor.loginName ?? `user-${actor.id}`] as const));
    const organizationMap = new Map(organizations.map((organization) => [organization.id, organization] as const));
    const relatedUserMap = new Map(relatedUsers.map((user) => [user.id, user.email ?? user.loginName ?? `user-${user.id}`] as const));

    return eventContexts.map((context) => {
      const organization = context.organizationId ? organizationMap.get(context.organizationId) : undefined;
      return {
        id: context.event.id,
        actorId: context.event.actorId ?? undefined,
        actorEmail: context.event.actorId ? actorMap.get(context.event.actorId) : undefined,
        organizationId: context.organizationId ?? undefined,
        organizationName: organization?.name,
        organizationSlug: organization?.slug,
        relatedUserId: context.relatedUserId ?? undefined,
        relatedUserEmail: context.relatedUserId ? relatedUserMap.get(context.relatedUserId) : undefined,
        targetEmail: context.targetEmail ?? undefined,
        module: context.event.module,
        resourceType: context.event.resourceType,
        resourceId: context.event.resourceId ?? undefined,
        action: context.event.action,
        before: context.before,
        after: context.after,
        createdAt: context.event.createdAt.toISOString()
      };
    });
  }

  async refreshReadinessActionCalibrationSnapshots(actorId?: number): Promise<ReadinessActionCalibrationSnapshotRefreshResult> {
    const result = await this.cscaLearningService.refreshReadinessActionCalibrationSnapshots('admin_manual');
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'csca-learning',
      resourceType: 'readiness_action_calibration_snapshot',
      action: 'refresh',
      after: {
        snapshotDate: result.snapshotDate,
        windowDays: result.windowDays,
        actionTypes: result.actionTypes,
        clickedCount: result.clickedCount,
        followedCount: result.followedCount,
        abilityLiftCount: result.abilityLiftCount,
        source: result.source
      }
    });
    return result;
  }

  private readinessEvidenceDir() {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
    if (process.env.RELEASE_EVIDENCE_DIR) return path.resolve(repoRoot, process.env.RELEASE_EVIDENCE_DIR);
    return path.resolve(repoRoot, '.tmp', 'release-evidence');
  }

  private async readReadinessEvidenceFile(name: string, includeComparisons = true): Promise<AdminReadinessEvidenceDetail> {
    if (!READINESS_EVIDENCE_FILE_PATTERN.test(name) && !(includeComparisons && READINESS_COMPARISON_FILE_PATTERN.test(name))) {
      throw new BadRequestException('Invalid readiness evidence file name.');
    }
    const evidenceDir = this.readinessEvidenceDir();
    const filePath = path.resolve(evidenceDir, name);
    if (!filePath.startsWith(`${evidenceDir}${path.sep}`)) {
      throw new BadRequestException('Invalid readiness evidence file path.');
    }
    let stat;
    let raw;
    try {
      [stat, raw] = await Promise.all([fs.stat(filePath), fs.readFile(filePath, 'utf8')]);
    } catch {
      throw new NotFoundException('Readiness evidence file not found.');
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Readiness evidence file is not valid JSON.');
    }
    const kind = readStringField(parsed, 'kind') || 'unknown';
    if (kind !== 'csca-readiness-sampled-threshold-evidence' && kind !== 'csca-readiness-evidence-comparison') {
      throw new BadRequestException('Unsupported readiness evidence kind.');
    }
    return {
      file: {
        name,
        kind,
        phase: readStringField(parsed, 'phase'),
        source: readStringField(parsed, 'source'),
        status: readConclusionStatus(parsed),
        generatedAt: readStringField(parsed, 'generatedAt'),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      },
      content: parsed
    };
  }

  async listReadinessEvidenceFiles(): Promise<AdminReadinessEvidenceFile[]> {
    const evidenceDir = this.readinessEvidenceDir();
    let names: string[];
    try {
      names = await fs.readdir(evidenceDir);
    } catch {
      return [];
    }
    const candidates = names
      .filter((name) => READINESS_EVIDENCE_FILE_PATTERN.test(name) || READINESS_COMPARISON_FILE_PATTERN.test(name))
      .sort()
      .reverse()
      .slice(0, 50);
    const details = await Promise.allSettled(candidates.map((name) => this.readReadinessEvidenceFile(name)));
    return details
      .filter((result): result is PromiseFulfilledResult<AdminReadinessEvidenceDetail> => result.status === 'fulfilled')
      .map((result) => result.value.file)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  async getReadinessEvidenceFile(name: string): Promise<AdminReadinessEvidenceDetail> {
    return this.readReadinessEvidenceFile(name);
  }
}
