import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PastPaper, PastPaperFile, Prisma, ResourceBundle, ResourceBundleItem } from '@prisma/client';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePastPaperLocalPath } from './past-paper-storage';
import { PastPaperFileInput, PastPaperInput, ResourceBundleInput, ResourceBundleItemInput } from './past-papers.types';

const SUBJECTS = ['math', 'physics', 'chemistry'] as const;
const CATEGORIES = ['past-paper', 'mock-paper'] as const;
const FILE_KINDS = ['paper', 'answers', 'solutions', 'mark-scheme', 'cover'] as const;

type PaperWithFiles = PastPaper & { files: PastPaperFile[] };
type BundleItemWithPaper = ResourceBundleItem & { pastPaper: PaperWithFiles };
type BundleWithItems = ResourceBundle & { items: BundleItemWithPaper[] };
type PublicPaperParams = { subject?: string; category?: string; locale?: string };
type PublicBundleParams = { subject?: string; category?: string; locale?: string };

const EN_SUBJECTS: Record<string, string> = {
  math: 'Math',
  physics: 'Physics',
  chemistry: 'Chemistry'
};

const EN_MONTHS: Record<string, string> = {
  '1月': 'January',
  '2月': 'February',
  '3月': 'March',
  '4月': 'April',
  '5月': 'May',
  '6月': 'June',
  '7月': 'July',
  '8月': 'August',
  '9月': 'September',
  '10月': 'October',
  '11月': 'November',
  '12月': 'December'
};

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanOptionalString(value: unknown) {
  const next = cleanString(value);
  return next ? next : null;
}

function cleanInteger(value: unknown, fallback: number | null = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const next = Number(value);
  return Number.isInteger(next) ? next : fallback;
}

function cleanBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeLocale(value: unknown) {
  const locale = cleanString(value).toLowerCase();
  return locale === 'en' || locale.startsWith('en-') ? 'en' : 'zh';
}

function assertSubject(value: unknown) {
  const subject = cleanString(value);
  if (!SUBJECTS.includes(subject as never)) throw new BadRequestException('资料科目必须是 math / physics / chemistry。');
  return subject;
}

function assertCategory(value: unknown, fallback = 'past-paper') {
  const category = cleanString(value, fallback);
  if (!CATEGORIES.includes(category as never)) throw new BadRequestException('资料分类必须是 past-paper / mock-paper。');
  return category;
}

function assertSubjectScope(value: unknown, fallback = 'mixed') {
  const scope = cleanString(value, fallback);
  if (scope === 'mixed') return scope;
  return assertSubject(scope);
}

function cleanStringList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 20);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return cleanStringList(parsed, fallback);
    } catch {
      return trimmed.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
    }
  }
  return fallback;
}

function parseId(value: string | number, message: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new NotFoundException(message);
  return id;
}

function expectedVersionFrom(input: unknown) {
  if (!input || typeof input !== 'object' || !('expectedVersion' in input)) return undefined;
  const value = Number((input as { expectedVersion?: unknown }).expectedVersion);
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('版本号不正确，请刷新后再试。');
  return value;
}

function assertVersion(currentVersion: number, expectedVersion: number | undefined, label: string) {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
  }
}

function englishPaperTitle(paper: PastPaper) {
  const subject = EN_SUBJECTS[paper.subject] || paper.subject;
  if (paper.category === 'mock-paper') {
    const setLabel = paper.sessionLabel && /[A-Za-z0-9]/.test(paper.sessionLabel)
      ? paper.sessionLabel
      : `Set ${paper.sortOrder || paper.id}`;
    return `CSCA ${subject} Mock Paper ${setLabel.replace(/^Set\s+/i, '')}`;
  }
  const month = paper.examMonth ? EN_MONTHS[paper.examMonth] || paper.examMonth : '';
  const dateLabel = [paper.examYear, month].filter(Boolean).join(' ');
  return `CSCA ${dateLabel ? `${dateLabel} ` : ''}${subject} Past Paper`;
}

function englishMonthLabel(value: string | null) {
  if (!value) return undefined;
  return EN_MONTHS[value] || value;
}

function englishSessionLabel(value: string | null, paper: PastPaper) {
  if (!value) return undefined;
  const monthMatch = value.match(/^(\d{1,2})月真题$/);
  if (monthMatch) return `${EN_MONTHS[`${monthMatch[1]}月`] || `${monthMatch[1]} Month`} Past Paper`;
  const paperMatch = value.match(/^第\s*(\d+)\s*份$/);
  if (paperMatch) return `Paper ${paperMatch[1]}`;
  const setMatch = value.match(/^第\s*(\d+)\s*套$/);
  if (setMatch) return `Set ${setMatch[1]}`;
  if (paper.category === 'past-paper' && value.includes('真题')) return 'Past Paper';
  if (paper.category === 'mock-paper' && value.includes('模拟')) return 'Mock Paper';
  return value;
}

function englishPaperDescription(paper: PastPaper) {
  const subject = EN_SUBJECTS[paper.subject] || paper.subject;
  if (paper.category === 'mock-paper') {
    return `${subject} CSCA mock paper with downloadable paper PDF${paper.hasSolutions ? ', answers, and solutions' : paper.hasAnswers ? ' and answers' : ''}.`;
  }
  return `${subject} CSCA past paper with downloadable paper PDF${paper.hasSolutions ? ', answers, and solutions' : paper.hasAnswers ? ' and answers' : ''}.`;
}

function englishFileLabel(file: PastPaperFile, paper: PastPaper) {
  const title = englishPaperTitle(paper);
  const labels: Record<string, string> = {
    paper: 'Paper PDF',
    answers: 'Answers PDF',
    solutions: 'Answers and Solutions PDF',
    'mark-scheme': 'Mark Scheme PDF',
    cover: 'Cover'
  };
  return `${title} ${labels[file.kind] || 'File'}`;
}

function fileSummary(file: PastPaperFile) {
  return {
    id: file.id,
    kind: file.kind,
    label: file.label,
    fileUrl: file.fileUrl,
    originalFilename: file.originalFilename ?? undefined,
    mimeType: file.mimeType,
    fileSizeBytes: file.fileSizeBytes ?? undefined,
    checksum: file.checksum ?? undefined,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString()
  };
}

function localizedFileSummary(file: PastPaperFile, paper: PastPaper, locale = 'zh') {
  const summary = fileSummary(file);
  return {
    ...summary,
    label: locale === 'en' ? englishFileLabel(file, paper) : summary.label
  };
}

export function pastPaperSummary(paper: PaperWithFiles, localeInput?: string) {
  const locale = normalizeLocale(localeInput);
  const primary = paper.files.find((file) => file.kind === 'paper') ?? paper.files[0];
  return {
    id: paper.id,
    slug: paper.slug,
    title: locale === 'en' ? englishPaperTitle(paper) : paper.title,
    category: paper.category,
    subject: paper.subject,
    examYear: paper.examYear ?? undefined,
    examMonth: locale === 'en' ? englishMonthLabel(paper.examMonth) : paper.examMonth ?? undefined,
    sessionLabel: locale === 'en' ? englishSessionLabel(paper.sessionLabel, paper) : paper.sessionLabel ?? undefined,
    language: paper.language,
    description: locale === 'en' ? englishPaperDescription(paper) : paper.description ?? undefined,
    questionCount: paper.questionCount ?? undefined,
    pageCount: paper.pageCount ?? undefined,
    hasAnswers: paper.hasAnswers,
    hasSolutions: paper.hasSolutions,
    coverUrl: paper.coverUrl ?? undefined,
    isFree: paper.isFree,
    isPublished: paper.isPublished,
    isFeatured: paper.isFeatured,
    sortOrder: paper.sortOrder,
    downloadCount: paper.downloadCount,
    primaryFileUrl: primary?.fileUrl,
    fileCount: paper.files.length,
    citationIndexAvailable: Boolean(paper.sourceDocumentId),
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
    version: paper.version
  };
}

function adminPastPaperSummary(paper: PaperWithFiles) {
  return { ...pastPaperSummary(paper), sourceDocumentId: paper.sourceDocumentId ?? undefined };
}

function paperDetail(paper: PaperWithFiles, locale?: string, admin = false) {
  return {
    paper: admin ? adminPastPaperSummary(paper) : pastPaperSummary(paper, locale),
    files: paper.files.map((file) => localizedFileSummary(file, paper, locale))
  };
}

function bundleVisibleItems(bundle: BundleWithItems, publicOnly: boolean) {
  return bundle.items
    .filter((item) => {
      const paper = item.pastPaper;
      if (!paper || paper.deletedAt) return false;
      return publicOnly ? paper.isPublished : true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function resourceBundleSummary(bundle: BundleWithItems, locale?: string, publicOnly = true) {
  void locale;
  const items = bundleVisibleItems(bundle, publicOnly);
  const papers = items.map((item) => item.pastPaper);
  const fileCount = papers.reduce((sum, paper) => sum + paper.files.length, 0);
  const questionCount = papers.reduce((sum, paper) => sum + (paper.questionCount ?? 0), 0);
  const downloadCount = papers.reduce((sum, paper) => sum + paper.downloadCount, 0);
  return {
    id: bundle.id,
    slug: bundle.slug,
    title: bundle.title,
    category: bundle.category,
    subjectScope: bundle.subjectScope,
    language: bundle.language,
    description: bundle.description ?? undefined,
    coverUrl: bundle.coverUrl ?? undefined,
    highlights: cleanStringList(bundle.highlights),
    tags: cleanStringList(bundle.tags),
    isFeatured: bundle.isFeatured,
    isPublished: bundle.isPublished,
    sortOrder: bundle.sortOrder,
    itemCount: items.length,
    fileCount,
    questionCount: questionCount || undefined,
    downloadCount,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
    version: bundle.version
  };
}

function resourceBundleDetail(bundle: BundleWithItems, locale?: string, publicOnly = true) {
  const items = bundleVisibleItems(bundle, publicOnly).map((item) => ({
    id: item.id,
    label: item.label ?? item.pastPaper.title,
    sortOrder: item.sortOrder,
    paper: pastPaperSummary(item.pastPaper, locale),
    files: item.pastPaper.files.map((file) => localizedFileSummary(file, item.pastPaper, locale))
  }));
  return {
    bundle: resourceBundleSummary(bundle, locale, publicOnly),
    items
  };
}

function normalizePaperInput(input: PastPaperInput, existing?: PastPaper): Prisma.PastPaperUncheckedCreateInput {
  const slug = cleanString(input.slug, existing?.slug ?? '');
  if (!/^[a-z0-9-]{3,160}$/.test(slug)) throw new BadRequestException('slug 只能使用小写字母、数字和短横线。');
  const title = cleanString(input.title, existing?.title ?? '');
  if (!title) throw new BadRequestException('真题标题不能为空。');
  const sourceDocumentId = input.sourceDocumentId === null || input.sourceDocumentId === ''
    ? null
    : cleanInteger(input.sourceDocumentId, existing?.sourceDocumentId ?? null);
  return {
    slug,
    title,
    category: assertCategory(input.category ?? existing?.category),
    subject: assertSubject(input.subject ?? existing?.subject),
    examYear: cleanInteger(input.examYear, existing?.examYear ?? null),
    examMonth: cleanOptionalString(input.examMonth ?? existing?.examMonth),
    sessionLabel: cleanOptionalString(input.sessionLabel ?? existing?.sessionLabel),
    language: cleanString(input.language, existing?.language ?? 'zh') || 'zh',
    description: cleanOptionalString(input.description ?? existing?.description),
    questionCount: cleanInteger(input.questionCount, existing?.questionCount ?? null),
    pageCount: cleanInteger(input.pageCount, existing?.pageCount ?? null),
    hasAnswers: cleanBoolean(input.hasAnswers, existing?.hasAnswers ?? false),
    hasSolutions: cleanBoolean(input.hasSolutions, existing?.hasSolutions ?? false),
    coverUrl: cleanOptionalString(input.coverUrl ?? existing?.coverUrl),
    isFree: cleanBoolean(input.isFree, existing?.isFree ?? true),
    isPublished: cleanBoolean(input.isPublished, existing?.isPublished ?? false),
    isFeatured: cleanBoolean(input.isFeatured, existing?.isFeatured ?? false),
    sortOrder: cleanInteger(input.sortOrder, existing?.sortOrder ?? 0) ?? 0,
    sourceDocumentId,
    version: existing ? existing.version + 1 : 1
  };
}

function normalizeFileInput(input: PastPaperFileInput, existing?: PastPaperFile) {
  const kind = cleanString(input.kind, existing?.kind ?? 'paper');
  if (!FILE_KINDS.includes(kind as never)) throw new BadRequestException('文件类型必须是 paper / answers / solutions / mark-scheme / cover。');
  const label = cleanString(input.label, existing?.label ?? '');
  if (!label) throw new BadRequestException('文件名称不能为空。');
  const fileUrl = cleanString(input.fileUrl, existing?.fileUrl ?? '');
  if (!fileUrl) throw new BadRequestException('文件 URL 不能为空。');
  return {
    kind,
    label,
    fileUrl,
    originalFilename: cleanOptionalString(input.originalFilename ?? existing?.originalFilename),
    mimeType: cleanString(input.mimeType, existing?.mimeType ?? 'application/pdf') || 'application/pdf',
    fileSizeBytes: cleanInteger(input.fileSizeBytes, existing?.fileSizeBytes ?? null),
    checksum: cleanOptionalString(input.checksum ?? existing?.checksum)
  };
}

function normalizeBundleInput(input: ResourceBundleInput, existing?: ResourceBundle): Prisma.ResourceBundleUncheckedCreateInput {
  const slug = cleanString(input.slug, existing?.slug ?? '');
  if (!/^[a-z0-9-]{3,180}$/.test(slug)) throw new BadRequestException('套装 slug 只能使用小写字母、数字和短横线。');
  const title = cleanString(input.title, existing?.title ?? '');
  if (!title) throw new BadRequestException('套装标题不能为空。');
  return {
    slug,
    title,
    category: assertCategory(input.category ?? existing?.category),
    subjectScope: assertSubjectScope(input.subjectScope ?? existing?.subjectScope),
    language: cleanString(input.language, existing?.language ?? 'zh') || 'zh',
    description: cleanOptionalString(input.description ?? existing?.description),
    coverUrl: cleanOptionalString(input.coverUrl ?? existing?.coverUrl),
    highlights: cleanStringList(input.highlights, cleanStringList(existing?.highlights)) as Prisma.InputJsonValue,
    tags: cleanStringList(input.tags, cleanStringList(existing?.tags)) as Prisma.InputJsonValue,
    isFeatured: cleanBoolean(input.isFeatured, existing?.isFeatured ?? false),
    isPublished: cleanBoolean(input.isPublished, existing?.isPublished ?? false),
    sortOrder: cleanInteger(input.sortOrder, existing?.sortOrder ?? 0) ?? 0,
    version: existing ? existing.version + 1 : 1
  };
}

function normalizeBundleItemInput(input: ResourceBundleItemInput, existing?: ResourceBundleItem) {
  const pastPaperId = cleanInteger(input.pastPaperId, existing?.pastPaperId ?? null);
  if (!pastPaperId) throw new BadRequestException('请选择要加入套装的资料。');
  return {
    pastPaperId,
    label: cleanOptionalString(input.label ?? existing?.label),
    sortOrder: cleanInteger(input.sortOrder, existing?.sortOrder ?? 0) ?? 0
  };
}

function checksumFile(filepath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filepath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function hashOptional(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

async function removeLocalUpload(fileUrl: string) {
  const filepath = resolvePastPaperLocalPath(fileUrl);
  if (!filepath) return;
  try {
    await unlink(filepath);
  } catch {
    // A missing file should not block metadata cleanup.
  }
}

@Injectable()
export class PastPapersService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic(params: PublicPaperParams = {}) {
    const where: Prisma.PastPaperWhereInput = { isPublished: true, deletedAt: null, category: assertCategory(params.category ?? 'past-paper') };
    if (params.subject) where.subject = assertSubject(params.subject);
    return this.prisma.pastPaper
      .findMany({ where, include: { files: true }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }] })
      .then((items) => ({ items: items.map((item) => pastPaperSummary(item, params.locale)) }));
  }

  async getPublic(slug: string, locale?: string) {
    const paper = await this.prisma.pastPaper.findFirst({ where: { slug, isPublished: true, deletedAt: null }, include: { files: true } });
    if (!paper) throw new NotFoundException('真题资料不存在。');
    return paperDetail(paper, locale);
  }

  async recordDownload(slug: string, fileIdInput: string, context: { userId?: number; ip?: string; userAgent?: string } = {}) {
    const fileId = parseId(fileIdInput, '真题文件不存在。');
    const paper = await this.prisma.pastPaper.findFirst({ where: { slug, isPublished: true, deletedAt: null }, include: { files: true } });
    if (!paper) throw new NotFoundException('真题资料不存在。');
    const file = paper.files.find((item) => item.id === fileId);
    if (!file) throw new NotFoundException('真题文件不存在。');
    await this.prisma.$transaction([
      this.prisma.pastPaper.update({ where: { id: paper.id }, data: { downloadCount: { increment: 1 } } }),
      this.prisma.pastPaperDownload.create({
        data: {
          pastPaperId: paper.id,
          fileId: file.id,
          userId: context.userId,
          ipHash: hashOptional(context.ip),
          userAgentHash: hashOptional(context.userAgent)
        }
      })
    ]);
    return { url: file.fileUrl, file: localizedFileSummary(file, paper), paper: pastPaperSummary({ ...paper, downloadCount: paper.downloadCount + 1 }) };
  }

  async listPublicBundles(params: PublicBundleParams = {}) {
    const where: Prisma.ResourceBundleWhereInput = {
      isPublished: true,
      deletedAt: null,
      category: assertCategory(params.category ?? 'past-paper')
    };
    if (params.subject) {
      const subject = assertSubject(params.subject);
      where.OR = [{ subjectScope: subject }, { subjectScope: 'mixed' }];
    }
    const bundles = await this.prisma.resourceBundle.findMany({
      where,
      include: { items: { include: { pastPaper: { include: { files: true } } } } },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });
    const items = bundles
      .map((bundle) => resourceBundleSummary(bundle, params.locale, true))
      .filter((bundle) => bundle.itemCount > 0);
    return { items };
  }

  async getPublicBundle(slug: string, locale?: string) {
    const bundle = await this.prisma.resourceBundle.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    if (!bundle) throw new NotFoundException('资料套装不存在。');
    const detail = resourceBundleDetail(bundle, locale, true);
    if (!detail.items.length) throw new NotFoundException('资料套装暂无可下载内容。');
    return detail;
  }

  async listAdmin(params: { subject?: string; category?: string } = {}) {
    const where: Prisma.PastPaperWhereInput = { deletedAt: null };
    if (params.subject) where.subject = assertSubject(params.subject);
    if (params.category) where.category = assertCategory(params.category);
    const items = await this.prisma.pastPaper.findMany({ where, include: { files: true }, orderBy: [{ category: 'asc' }, { subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] });
    return {
      items: items.map((item) => adminPastPaperSummary(item)),
      summary: {
        total: items.length,
        published: items.filter((item) => item.isPublished).length,
        draft: items.filter((item) => !item.isPublished).length
      }
    };
  }

  async getAdmin(idInput: string) {
    const paper = await this.prisma.pastPaper.findFirst({ where: { id: parseId(idInput, '真题资料不存在。'), deletedAt: null }, include: { files: true } });
    if (!paper) throw new NotFoundException('真题资料不存在。');
    return paperDetail(paper, undefined, true);
  }

  async listAdminSourceDocuments(subjectInput?: string) {
    const subject = subjectInput ? assertSubject(subjectInput) : undefined;
    const documents = await this.prisma.cscaSourceDocument.findMany({
      where: { sourceType: 'past_paper', status: 'active', ...(subject ? { subject } : {}) },
      select: {
        id: true, subject: true, title: true, examYear: true, examSession: true,
        language: true, sourceLabel: true, usagePolicy: true, _count: { select: { questions: true } }
      },
      orderBy: [{ examYear: 'desc' }, { id: 'desc' }]
    });
    return {
      items: documents.map((document) => {
        const policy = document.usagePolicy && typeof document.usagePolicy === 'object' && !Array.isArray(document.usagePolicy)
          ? document.usagePolicy as Record<string, unknown>
          : {};
        return {
          id: document.id,
          subject: document.subject,
          title: document.title,
          examYear: document.examYear ?? undefined,
          examSession: document.examSession ?? undefined,
          language: document.language,
          sourceLabel: document.sourceLabel,
          questionCount: document._count.questions,
          displayAllowed: policy.allowQuestionDisplay !== false && policy.allowPromptRawText !== false
        };
      })
    };
  }

  private async assertSourceDocument(sourceDocumentId: number | null | undefined, subject: string) {
    if (!sourceDocumentId) return;
    const document = await this.prisma.cscaSourceDocument.findFirst({
      where: { id: sourceDocumentId, subject, sourceType: 'past_paper', status: 'active' },
      select: { id: true, usagePolicy: true }
    });
    if (!document) throw new BadRequestException('所选可信真题索引不存在、科目不一致或尚未启用。');
    const policy = document.usagePolicy && typeof document.usagePolicy === 'object' && !Array.isArray(document.usagePolicy)
      ? document.usagePolicy as Record<string, unknown>
      : {};
    if (policy.allowQuestionDisplay === false || policy.allowPromptRawText === false) {
      throw new BadRequestException('所选可信真题索引的使用策略不允许向学生展示题目。');
    }
  }

  async listAdminBundles(params: { subject?: string; category?: string; status?: string } = {}) {
    const where: Prisma.ResourceBundleWhereInput = { deletedAt: null };
    if (params.category) where.category = assertCategory(params.category);
    if (params.subject) {
      const subject = assertSubject(params.subject);
      where.OR = [{ subjectScope: subject }, { subjectScope: 'mixed' }];
    }
    const status = cleanString(params.status);
    if (status === 'published') where.isPublished = true;
    if (status === 'draft') where.isPublished = false;
    const bundles = await this.prisma.resourceBundle.findMany({
      where,
      include: { items: { include: { pastPaper: { include: { files: true } } } } },
      orderBy: [{ category: 'asc' }, { subjectScope: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });
    return {
      items: bundles.map((bundle) => resourceBundleSummary(bundle, undefined, false)),
      summary: {
        total: bundles.length,
        published: bundles.filter((bundle) => bundle.isPublished).length,
        draft: bundles.filter((bundle) => !bundle.isPublished).length
      }
    };
  }

  async getAdminBundle(idInput: string) {
    const id = parseId(idInput, '资料套装不存在。');
    const bundle = await this.prisma.resourceBundle.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    if (!bundle) throw new NotFoundException('资料套装不存在。');
    return resourceBundleDetail(bundle, undefined, false);
  }

  async createAdminBundle(input: ResourceBundleInput, actorId: number) {
    const data = normalizeBundleInput(input);
    const bundle = await this.prisma.resourceBundle.create({
      data,
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle', resourceId: String(bundle.id), action: 'bundle.create', after: resourceBundleSummary(bundle, undefined, false) });
    return resourceBundleSummary(bundle, undefined, false);
  }

  async updateAdminBundle(idInput: string, input: ResourceBundleInput, actorId: number) {
    const id = parseId(idInput, '资料套装不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.resourceBundle.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    if (!existing) throw new NotFoundException('资料套装不存在。');
    assertVersion(existing.version, expectedVersion, '资料套装');
    const next = await this.prisma.resourceBundle.update({
      where: { id },
      data: normalizeBundleInput(input, existing),
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle', resourceId: String(id), action: 'bundle.update', before: resourceBundleSummary(existing, undefined, false), after: resourceBundleSummary(next, undefined, false) });
    return resourceBundleSummary(next, undefined, false);
  }

  async publishAdminBundle(idInput: string, input: ResourceBundleInput, actorId: number) {
    const id = parseId(idInput, '资料套装不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.resourceBundle.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    if (!existing) throw new NotFoundException('资料套装不存在。');
    assertVersion(existing.version, expectedVersion, '资料套装');
    const visibleItems = bundleVisibleItems(existing, true);
    if (!existing.items.length) throw new BadRequestException('发布套装前至少需要加入一份资料。');
    if (!visibleItems.length) throw new BadRequestException('发布套装前至少需要一份已发布资料。');
    const next = await this.prisma.resourceBundle.update({
      where: { id },
      data: { isPublished: true, version: { increment: 1 } },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle', resourceId: String(id), action: 'bundle.publish', after: resourceBundleSummary(next, undefined, false) });
    return resourceBundleSummary(next, undefined, false);
  }

  async archiveAdminBundle(idInput: string, input: ResourceBundleInput, actorId: number) {
    const id = parseId(idInput, '资料套装不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.resourceBundle.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    if (!existing) throw new NotFoundException('资料套装不存在。');
    assertVersion(existing.version, expectedVersion, '资料套装');
    const next = await this.prisma.resourceBundle.update({
      where: { id },
      data: { isPublished: false, version: { increment: 1 } },
      include: { items: { include: { pastPaper: { include: { files: true } } } } }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle', resourceId: String(id), action: 'bundle.archive', before: resourceBundleSummary(existing, undefined, false), after: resourceBundleSummary(next, undefined, false) });
    return resourceBundleSummary(next, undefined, false);
  }

  async createAdminBundleItem(bundleIdInput: string, input: ResourceBundleItemInput, actorId: number) {
    const bundleId = parseId(bundleIdInput, '资料套装不存在。');
    const bundle = await this.prisma.resourceBundle.findFirst({ where: { id: bundleId, deletedAt: null } });
    if (!bundle) throw new NotFoundException('资料套装不存在。');
    const data = normalizeBundleItemInput(input);
    const paper = await this.prisma.pastPaper.findFirst({ where: { id: data.pastPaperId, deletedAt: null } });
    if (!paper) throw new NotFoundException('要加入套装的资料不存在。');
    if (paper.category !== bundle.category) throw new BadRequestException('真题套装只能加入真题资料，模拟卷套装只能加入模拟卷资料。');
    const item = await this.prisma.resourceBundleItem.create({ data: { bundleId, ...data } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle-item', resourceId: String(item.id), action: 'bundle.item.create', after: { id: item.id, bundleId, pastPaperId: item.pastPaperId } });
    return this.getAdminBundle(String(bundleId));
  }

  async updateAdminBundleItem(bundleIdInput: string, itemIdInput: string, input: ResourceBundleItemInput, actorId: number) {
    const bundleId = parseId(bundleIdInput, '资料套装不存在。');
    const id = parseId(itemIdInput, '套装资料不存在。');
    const existing = await this.prisma.resourceBundleItem.findFirst({ where: { id, bundleId } });
    if (!existing) throw new NotFoundException('套装资料不存在。');
    const data = normalizeBundleItemInput({ ...input, pastPaperId: input.pastPaperId ?? existing.pastPaperId }, existing);
    const item = await this.prisma.resourceBundleItem.update({ where: { id }, data: { label: data.label, sortOrder: data.sortOrder } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle-item', resourceId: String(id), action: 'bundle.item.update', before: { id: existing.id, bundleId, pastPaperId: existing.pastPaperId, label: existing.label, sortOrder: existing.sortOrder }, after: { id: item.id, bundleId, pastPaperId: item.pastPaperId, label: item.label, sortOrder: item.sortOrder } });
    return this.getAdminBundle(String(bundleId));
  }

  async deleteAdminBundleItem(bundleIdInput: string, itemIdInput: string, actorId: number) {
    const bundleId = parseId(bundleIdInput, '资料套装不存在。');
    const id = parseId(itemIdInput, '套装资料不存在。');
    const existing = await this.prisma.resourceBundleItem.findFirst({ where: { id, bundleId } });
    if (!existing) throw new NotFoundException('套装资料不存在。');
    await this.prisma.resourceBundleItem.delete({ where: { id } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'resource-bundle-item', resourceId: String(id), action: 'bundle.item.delete', before: { id: existing.id, bundleId, pastPaperId: existing.pastPaperId } });
    return this.getAdminBundle(String(bundleId));
  }

  async createAdmin(input: PastPaperInput, actorId: number) {
    const data = normalizePaperInput(input);
    await this.assertSourceDocument(data.sourceDocumentId, String(data.subject));
    const paper = await this.prisma.pastPaper.create({ data, include: { files: true } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'paper', resourceId: String(paper.id), action: 'create', after: adminPastPaperSummary(paper) });
    return adminPastPaperSummary(paper);
  }

  async updateAdmin(idInput: string, input: PastPaperInput, actorId: number) {
    const id = parseId(idInput, '真题资料不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.pastPaper.findFirst({ where: { id, deletedAt: null }, include: { files: true } });
    if (!existing) throw new NotFoundException('真题资料不存在。');
    assertVersion(existing.version, expectedVersion, '真题资料');
    const data = normalizePaperInput(input, existing);
    await this.assertSourceDocument(data.sourceDocumentId, String(data.subject));
    const next = await this.prisma.pastPaper.update({ where: { id }, data, include: { files: true } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'paper', resourceId: String(id), action: 'update', before: adminPastPaperSummary(existing), after: adminPastPaperSummary(next) });
    return adminPastPaperSummary(next);
  }

  async publishAdmin(idInput: string, input: PastPaperInput, actorId: number) {
    const id = parseId(idInput, '真题资料不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.pastPaper.findFirst({ where: { id, deletedAt: null }, include: { files: true } });
    if (!existing) throw new NotFoundException('真题资料不存在。');
    assertVersion(existing.version, expectedVersion, '真题资料');
    if (!existing.files.length) throw new BadRequestException('发布前至少需要添加一个真题文件。');
    const next = await this.prisma.pastPaper.update({ where: { id }, data: { isPublished: true, version: { increment: 1 } }, include: { files: true } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'paper', resourceId: String(id), action: 'publish', after: pastPaperSummary(next) });
    return pastPaperSummary(next);
  }

  async archiveAdmin(idInput: string, input: PastPaperInput, actorId: number) {
    const id = parseId(idInput, '真题资料不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const existing = await this.prisma.pastPaper.findFirst({ where: { id, deletedAt: null }, include: { files: true } });
    if (!existing) throw new NotFoundException('真题资料不存在。');
    assertVersion(existing.version, expectedVersion, '真题资料');
    const next = await this.prisma.pastPaper.update({ where: { id }, data: { isPublished: false, deletedAt: new Date(), version: { increment: 1 } }, include: { files: true } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'paper', resourceId: String(id), action: 'archive', before: pastPaperSummary(existing), after: pastPaperSummary(next) });
    return pastPaperSummary(next);
  }

  async createAdminFile(paperIdInput: string, input: PastPaperFileInput, actorId: number) {
    const pastPaperId = parseId(paperIdInput, '真题资料不存在。');
    const paper = await this.prisma.pastPaper.findFirst({ where: { id: pastPaperId, deletedAt: null } });
    if (!paper) throw new NotFoundException('真题资料不存在。');
    const file = await this.prisma.pastPaperFile.create({ data: { pastPaperId, ...normalizeFileInput(input) } });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'file', resourceId: String(file.id), action: 'file.create', after: fileSummary(file) });
    return fileSummary(file);
  }

  async createAdminUploadedFile(paperIdInput: string, input: PastPaperFileInput, uploadedPath: string, actorId: number) {
    try {
      const checksum = await checksumFile(uploadedPath);
      return await this.createAdminFile(paperIdInput, { ...input, checksum }, actorId);
    } catch (error) {
      if (input.fileUrl) await removeLocalUpload(input.fileUrl);
      throw error;
    }
  }

  async updateAdminFile(paperIdInput: string, fileIdInput: string, input: PastPaperFileInput, actorId: number) {
    const pastPaperId = parseId(paperIdInput, '真题资料不存在。');
    const id = parseId(fileIdInput, '真题文件不存在。');
    const existing = await this.prisma.pastPaperFile.findFirst({ where: { id, pastPaperId } });
    if (!existing) throw new NotFoundException('真题文件不存在。');
    const file = await this.prisma.pastPaperFile.update({ where: { id }, data: normalizeFileInput(input, existing) });
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'file', resourceId: String(file.id), action: 'file.update', before: fileSummary(existing), after: fileSummary(file) });
    return fileSummary(file);
  }

  async deleteAdminFile(paperIdInput: string, fileIdInput: string, actorId: number) {
    const pastPaperId = parseId(paperIdInput, '真题资料不存在。');
    const id = parseId(fileIdInput, '真题文件不存在。');
    const existing = await this.prisma.pastPaperFile.findFirst({ where: { id, pastPaperId } });
    if (!existing) throw new NotFoundException('真题文件不存在。');
    await this.prisma.pastPaperFile.delete({ where: { id } });
    await removeLocalUpload(existing.fileUrl);
    await recordAdminAudit(this.prisma, { actorId, module: 'past-papers', resourceType: 'file', resourceId: String(id), action: 'file.delete', before: fileSummary(existing) });
    return { deleted: true };
  }
}
