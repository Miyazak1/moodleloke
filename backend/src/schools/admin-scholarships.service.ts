import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SchoolStatus } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { assertActorId, assertOptionalUrl, assertRecord, assertRequiredString, cleanNullableString } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

type AdminScholarshipInput = {
  expectedVersion?: number;
  slug?: string | null;
  title?: string | null;
  type?: string | null;
  fundingLevel?: string | null;
  providerName?: string | null;
  providerNameEn?: string | null;
  providerLocation?: string | null;
  summary?: string | null;
  coverage?: string | null;
  applicableDegree?: string | null;
  applicableProgram?: string | null;
  amountText?: string | null;
  requirementText?: string | null;
  bodySections?: unknown;
  benefitItems?: unknown;
  eligibilityItems?: unknown;
  applicationMaterials?: unknown;
  applicationSteps?: unknown;
  contactInfo?: unknown;
  actionLinks?: unknown;
  deadlineDate?: string | null;
  deadlineLabel?: string | null;
  applicationRound?: string | null;
  targetCountries?: string[] | string | null;
  targetRegions?: string[] | string | null;
  benefits?: string[] | string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  lastVerifiedAt?: string | null;
  sortOrder?: number | string | null;
  status?: string | null;
  schoolIds?: number[] | string | null;
  programIds?: number[] | string | null;
};

const ADMIN_SCHOLARSHIP_INCLUDE = {
  schools: {
    include: { school: { select: { id: true, nameZh: true, nameEn: true, region: true, status: true } } },
    orderBy: [{ sortOrder: 'asc' }, { schoolId: 'asc' }]
  },
  programs: {
    include: {
      program: {
        select: {
          id: true,
          schoolId: true,
          nameZh: true,
          nameEn: true,
          degreeLevel: true,
          teachingLanguage: true,
          school: { select: { id: true, nameZh: true } }
        }
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { programId: 'asc' }]
  }
} satisfies Prisma.ScholarshipInclude;

type AdminScholarshipRow = Prisma.ScholarshipGetPayload<{ include: typeof ADMIN_SCHOLARSHIP_INCLUDE }>;

function cleanText(value: unknown, maxLength?: number) {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

function cleanBlock(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return value.split(/[，,;；\n]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function asNumberArray(value: unknown): number[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(/[，,;；\n]/);
  return Array.from(new Set(raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)));
}

function cleanJson(value: unknown): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    try {
      return JSON.parse(normalized) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('奖学金结构化内容必须是有效 JSON。');
    }
  }
  try {
    JSON.stringify(value);
    return value as Prisma.InputJsonValue;
  } catch {
    throw new BadRequestException('奖学金结构化内容必须可序列化。');
  }
}

function parseDate(value: unknown, label = '核验日期') {
  const raw = cleanNullableString(value, `${label}格式不正确。`, 20);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${label}格式不正确。`);
  return parsed;
}

function parseSortOrder(value: unknown, fallback = 0) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function normalizeStatus(value: unknown, fallback: SchoolStatus = SchoolStatus.draft) {
  if (value === SchoolStatus.published || value === SchoolStatus.archived || value === SchoolStatus.draft) return value;
  return fallback;
}

function expectedVersionFrom(input: unknown) {
  if (input === undefined || input === null) return undefined;
  const record = assertRecord(input, '版本输入不正确。');
  if (record.expectedVersion === undefined || record.expectedVersion === null || record.expectedVersion === '') return undefined;
  const parsed = Number(record.expectedVersion);
  if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('版本号不正确。');
  return parsed;
}

function assertExpectedVersion(currentVersion: number, expectedVersion: number | undefined) {
  if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
    throw staleVersionConflict(currentVersion);
  }
}

function staleVersionConflict(currentVersion: number) {
  return new ConflictException({ message: '奖学金已被其他管理员更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion });
}

function normalizeFunding(value: unknown) {
  const normalized = cleanText(value, 40)?.toLowerCase();
  if (normalized === 'full' || normalized === 'partial' || normalized === 'unknown') return normalized;
  return 'unknown';
}

function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return normalized || 'scholarship';
}

function mapAdminScholarship(row: AdminScholarshipRow) {
  return {
    id: row.id,
    version: row.version,
    slug: row.slug,
    title: row.title,
    type: row.type,
    fundingLevel: row.fundingLevel,
    providerName: row.providerName ?? undefined,
    providerNameEn: row.providerNameEn ?? undefined,
    providerLocation: row.providerLocation ?? undefined,
    summary: row.summary ?? undefined,
    coverage: row.coverage ?? undefined,
    applicableDegree: row.applicableDegree ?? undefined,
    applicableProgram: row.applicableProgram ?? undefined,
    amountText: row.amountText ?? undefined,
    requirementText: row.requirementText ?? undefined,
    bodySections: row.bodySections ?? undefined,
    benefitItems: row.benefitItems ?? undefined,
    eligibilityItems: row.eligibilityItems ?? undefined,
    applicationMaterials: row.applicationMaterials ?? undefined,
    applicationSteps: row.applicationSteps ?? undefined,
    contactInfo: row.contactInfo ?? undefined,
    actionLinks: row.actionLinks ?? undefined,
    deadlineDate: row.deadlineDate?.toISOString().slice(0, 10),
    deadlineLabel: row.deadlineLabel ?? undefined,
    applicationRound: row.applicationRound ?? undefined,
    targetCountries: asStringArray(row.targetCountries),
    targetRegions: asStringArray(row.targetRegions),
    benefits: asStringArray(row.benefits),
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: row.sourceLabel ?? undefined,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: row.sortOrder,
    status: row.status,
    schoolIds: row.schools.map((link) => link.schoolId),
    programIds: row.programs.map((link) => link.programId),
    schools: row.schools.map((link) => ({
      id: link.school.id,
      nameZh: link.school.nameZh,
      nameEn: link.school.nameEn ?? undefined,
      region: link.school.region ?? undefined,
      status: link.school.status
    })),
    programs: row.programs.map((link) => ({
      id: link.program.id,
      schoolId: link.program.schoolId,
      schoolName: link.program.school.nameZh,
      nameZh: link.program.nameZh,
      nameEn: link.program.nameEn ?? undefined,
      degreeLevel: link.program.degreeLevel ?? undefined,
      teachingLanguage: link.program.teachingLanguage ?? undefined
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

@Injectable()
export class AdminScholarshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(input: AdminScholarshipInput, mode: 'create' | 'update') {
    const record = assertRecord(input, '奖学金输入不正确。');
    const title = mode === 'create'
      ? assertRequiredString(record.title, '奖学金名称不能为空。', 240)
      : record.title === undefined ? undefined : assertRequiredString(record.title, '奖学金名称不能为空。', 240);
    return {
      slug: record.slug === undefined ? undefined : cleanText(record.slug, 260),
      title,
      type: record.type === undefined ? undefined : cleanText(record.type, 80) || 'other',
      fundingLevel: record.fundingLevel === undefined ? undefined : normalizeFunding(record.fundingLevel),
      providerName: record.providerName === undefined ? undefined : cleanText(record.providerName, 180),
      providerNameEn: record.providerNameEn === undefined ? undefined : cleanText(record.providerNameEn, 180),
      providerLocation: record.providerLocation === undefined ? undefined : cleanText(record.providerLocation, 180),
      summary: record.summary === undefined ? undefined : cleanBlock(record.summary),
      coverage: record.coverage === undefined ? undefined : cleanBlock(record.coverage),
      applicableDegree: record.applicableDegree === undefined ? undefined : cleanText(record.applicableDegree, 160),
      applicableProgram: record.applicableProgram === undefined ? undefined : cleanText(record.applicableProgram, 240),
      amountText: record.amountText === undefined ? undefined : cleanBlock(record.amountText),
      requirementText: record.requirementText === undefined ? undefined : cleanBlock(record.requirementText),
      bodySections: cleanJson(record.bodySections),
      benefitItems: cleanJson(record.benefitItems),
      eligibilityItems: cleanJson(record.eligibilityItems),
      applicationMaterials: cleanJson(record.applicationMaterials),
      applicationSteps: cleanJson(record.applicationSteps),
      contactInfo: cleanJson(record.contactInfo),
      actionLinks: cleanJson(record.actionLinks),
      deadlineDate: record.deadlineDate === undefined ? undefined : parseDate(record.deadlineDate, '截止日期'),
      deadlineLabel: record.deadlineLabel === undefined ? undefined : cleanText(record.deadlineLabel, 160),
      applicationRound: record.applicationRound === undefined ? undefined : cleanText(record.applicationRound, 120),
      targetCountries: record.targetCountries === undefined ? undefined : asStringArray(record.targetCountries),
      targetRegions: record.targetRegions === undefined ? undefined : asStringArray(record.targetRegions),
      benefits: record.benefits === undefined ? undefined : asStringArray(record.benefits),
      sourceUrl: record.sourceUrl === undefined ? undefined : assertOptionalUrl(record.sourceUrl, '奖学金来源链接必须是有效 URL。'),
      sourceLabel: record.sourceLabel === undefined ? undefined : cleanText(record.sourceLabel, 240),
      lastVerifiedAt: record.lastVerifiedAt === undefined ? undefined : parseDate(record.lastVerifiedAt),
      sortOrder: record.sortOrder === undefined ? undefined : parseSortOrder(record.sortOrder),
      status: record.status === undefined ? undefined : normalizeStatus(record.status),
      schoolIds: record.schoolIds === undefined ? undefined : asNumberArray(record.schoolIds),
      programIds: record.programIds === undefined ? undefined : asNumberArray(record.programIds)
    };
  }

  private async ensureUniqueSlug(title: string, requested?: string, excludeId?: number) {
    const base = slugify(requested || title);
    let slug = base;
    let suffix = 2;
    while (await this.prisma.scholarship.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      select: { id: true }
    })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  private async validateLinks(schoolIds: number[], programIds: number[]) {
    const schools = schoolIds.length
      ? await this.prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true } })
      : [];
    if (schools.length !== schoolIds.length) throw new BadRequestException('关联学校不存在。');
    const programs = programIds.length
      ? await this.prisma.schoolProgram.findMany({ where: { id: { in: programIds } }, select: { id: true, schoolId: true } })
      : [];
    if (programs.length !== programIds.length) throw new BadRequestException('关联专业不存在。');
    const programSchoolIds = programs.map((program) => program.schoolId);
    return Array.from(new Set([...schoolIds, ...programSchoolIds]));
  }

  private linkData(schoolIds: number[], programIds: number[]) {
    return {
      schools: {
        create: schoolIds.map((schoolId, index) => ({ schoolId, sortOrder: index }))
      },
      programs: {
        create: programIds.map((programId, index) => ({ programId, sortOrder: index }))
      }
    };
  }

  async listAdminScholarships() {
    const rows = await this.prisma.scholarship.findMany({
      include: ADMIN_SCHOLARSHIP_INCLUDE,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });
    return {
      items: rows.map(mapAdminScholarship),
      summary: {
        total: rows.length,
        published: rows.filter((row) => row.status === SchoolStatus.published).length,
        draft: rows.filter((row) => row.status === SchoolStatus.draft).length
      }
    };
  }

  async createAdminScholarship(input: AdminScholarshipInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const data = this.sanitize(input, 'create');
    if (!data.title) throw new BadRequestException('奖学金名称不能为空。');
    const schoolIds = await this.validateLinks(data.schoolIds ?? [], data.programIds ?? []);
    const slug = await this.ensureUniqueSlug(data.title, data.slug);
    const created = await this.prisma.scholarship.create({
      data: {
        slug,
        title: data.title,
        type: data.type ?? 'other',
        fundingLevel: data.fundingLevel ?? 'unknown',
        providerName: data.providerName,
        providerNameEn: data.providerNameEn,
        providerLocation: data.providerLocation,
        summary: data.summary,
        coverage: data.coverage,
        applicableDegree: data.applicableDegree,
        applicableProgram: data.applicableProgram,
        amountText: data.amountText,
        requirementText: data.requirementText,
        bodySections: data.bodySections as never,
        benefitItems: data.benefitItems as never,
        eligibilityItems: data.eligibilityItems as never,
        applicationMaterials: data.applicationMaterials as never,
        applicationSteps: data.applicationSteps as never,
        contactInfo: data.contactInfo as never,
        actionLinks: data.actionLinks as never,
        deadlineDate: data.deadlineDate,
        deadlineLabel: data.deadlineLabel,
        applicationRound: data.applicationRound,
        targetCountries: (data.targetCountries ?? []) as never,
        targetRegions: (data.targetRegions ?? []) as never,
        benefits: (data.benefits ?? []) as never,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: data.sortOrder ?? 0,
        status: data.status ?? SchoolStatus.draft,
        ...this.linkData(schoolIds, data.programIds ?? [])
      },
      include: ADMIN_SCHOLARSHIP_INCLUDE
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'scholarships',
      resourceType: 'scholarship',
      resourceId: created.id,
      action: 'scholarship.create',
      after: { id: created.id, title: created.title }
    });
    return mapAdminScholarship(created);
  }

  async updateAdminScholarship(id: number, input: AdminScholarshipInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const existing = await this.prisma.scholarship.findUnique({ where: { id }, include: ADMIN_SCHOLARSHIP_INCLUDE });
    if (!existing) throw new NotFoundException('Scholarship not found');
    const expectedVersion = expectedVersionFrom(input);
    assertExpectedVersion(existing.version, expectedVersion);
    const before = mapAdminScholarship(existing);
    const data = this.sanitize(input, 'update');
    const title = data.title ?? existing.title;
    const schoolIds = data.schoolIds === undefined && data.programIds === undefined
      ? before.schoolIds
      : await this.validateLinks(data.schoolIds ?? before.schoolIds, data.programIds ?? before.programIds);
    const programIds = data.programIds ?? before.programIds;
    const slug = data.slug === undefined && !data.title ? existing.slug : await this.ensureUniqueSlug(title, data.slug || title, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.scholarship.updateMany({
        where: { id, version: existing.version },
        data: {
          slug,
          title,
          type: data.type ?? existing.type,
          fundingLevel: data.fundingLevel ?? existing.fundingLevel,
          providerName: data.providerName === undefined ? existing.providerName : data.providerName,
          providerNameEn: data.providerNameEn === undefined ? existing.providerNameEn : data.providerNameEn,
          providerLocation: data.providerLocation === undefined ? existing.providerLocation : data.providerLocation,
          summary: data.summary === undefined ? existing.summary : data.summary,
          coverage: data.coverage === undefined ? existing.coverage : data.coverage,
          applicableDegree: data.applicableDegree === undefined ? existing.applicableDegree : data.applicableDegree,
          applicableProgram: data.applicableProgram === undefined ? existing.applicableProgram : data.applicableProgram,
          amountText: data.amountText === undefined ? existing.amountText : data.amountText,
          requirementText: data.requirementText === undefined ? existing.requirementText : data.requirementText,
          bodySections: (data.bodySections === undefined ? existing.bodySections : data.bodySections) as never,
          benefitItems: (data.benefitItems === undefined ? existing.benefitItems : data.benefitItems) as never,
          eligibilityItems: (data.eligibilityItems === undefined ? existing.eligibilityItems : data.eligibilityItems) as never,
          applicationMaterials: (data.applicationMaterials === undefined ? existing.applicationMaterials : data.applicationMaterials) as never,
          applicationSteps: (data.applicationSteps === undefined ? existing.applicationSteps : data.applicationSteps) as never,
          contactInfo: (data.contactInfo === undefined ? existing.contactInfo : data.contactInfo) as never,
          actionLinks: (data.actionLinks === undefined ? existing.actionLinks : data.actionLinks) as never,
          deadlineDate: data.deadlineDate === undefined ? existing.deadlineDate : data.deadlineDate,
          deadlineLabel: data.deadlineLabel === undefined ? existing.deadlineLabel : data.deadlineLabel,
          applicationRound: data.applicationRound === undefined ? existing.applicationRound : data.applicationRound,
          targetCountries: (data.targetCountries === undefined ? existing.targetCountries : data.targetCountries) as never,
          targetRegions: (data.targetRegions === undefined ? existing.targetRegions : data.targetRegions) as never,
          benefits: (data.benefits === undefined ? existing.benefits : data.benefits) as never,
          sourceUrl: data.sourceUrl === undefined ? existing.sourceUrl : data.sourceUrl,
          sourceLabel: data.sourceLabel === undefined ? existing.sourceLabel : data.sourceLabel,
          lastVerifiedAt: data.lastVerifiedAt === undefined ? existing.lastVerifiedAt : data.lastVerifiedAt,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          status: data.status ?? existing.status,
          version: { increment: 1 }
        }
      });
      if (updateResult.count !== 1) throw staleVersionConflict(existing.version);
      if (data.schoolIds !== undefined || data.programIds !== undefined) {
        await tx.scholarshipSchool.deleteMany({ where: { scholarshipId: id } });
        await tx.scholarshipProgram.deleteMany({ where: { scholarshipId: id } });
        await tx.scholarship.update({
          where: { id },
          data: this.linkData(schoolIds, programIds)
        });
      }
      return tx.scholarship.findUniqueOrThrow({ where: { id }, include: ADMIN_SCHOLARSHIP_INCLUDE });
    });
    const after = mapAdminScholarship(updated);
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'scholarships',
      resourceType: 'scholarship',
      resourceId: id,
      action: data.status === SchoolStatus.archived && existing.status !== SchoolStatus.archived ? 'scholarship.archive' : 'scholarship.update',
      before,
      after
    });
    return after;
  }

  archiveAdminScholarship(id: number, actorId: number, input: AdminScholarshipInput = {}) {
    return this.updateAdminScholarship(id, { status: SchoolStatus.archived, expectedVersion: expectedVersionFrom(input) }, actorId);
  }

  async importAdminScholarships(input: { items?: AdminScholarshipInput[] } | AdminScholarshipInput[], actorId: number) {
    const items = Array.isArray(input) ? input : input.items;
    if (!Array.isArray(items)) throw new BadRequestException('导入内容必须包含 items 数组。');
    const result = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; message: string }> };
    for (const [index, item] of items.entries()) {
      try {
        const record = assertRecord(item, '奖学金输入不正确。');
        const slug = cleanText(record.slug, 260);
        const existing = slug ? await this.prisma.scholarship.findUnique({ where: { slug }, select: { id: true } }) : null;
        if (existing) {
          await this.updateAdminScholarship(existing.id, item, actorId);
          result.updated += 1;
        } else {
          await this.createAdminScholarship(item, actorId);
          result.created += 1;
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({ index, message: error instanceof Error ? error.message : '导入失败。' });
      }
    }
    return result;
  }
}
