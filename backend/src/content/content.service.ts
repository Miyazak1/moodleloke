import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { assertActorId, assertNonNegativeInteger, assertRecord, assertRequiredString, cleanNullableString } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminContentBlock,
  AdminContentBlockCreateInput,
  AdminContentBlockInput,
  DEFAULT_HOME_BLOCKS,
  PublicContentBlock
} from './content.types';

type DbBlock = Awaited<ReturnType<PrismaService['publicContentBlock']['findMany']>>[number];
const DEFAULT_LOCALE = 'zh-CN';
const ENABLED_CONTENT_LOCALES = new Set(['zh-CN', 'en', 'vi']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeBody(value: unknown) {
  if (isRecord(value)) return value;
  return {};
}

function normalizeStatus(status: string | undefined, fallback = 'draft') {
  if (!status) return fallback;
  if (['draft', 'published', 'archived'].includes(status)) return status;
  throw new BadRequestException('内容块状态必须是 draft、published 或 archived。');
}

function normalizeLocale(value: unknown, fallback = DEFAULT_LOCALE) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const locale = value.trim();
  if (locale === 'zh') return DEFAULT_LOCALE;
  if (ENABLED_CONTENT_LOCALES.has(locale)) return locale;
  return fallback;
}

function expectedVersionFrom(input: unknown) {
  if (!input || typeof input !== 'object' || !('expectedVersion' in input)) return undefined;
  const value = Number((input as { expectedVersion?: unknown }).expectedVersion);
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('版本号不正确，请刷新后再试。');
  return value;
}

function assertVersion(currentVersion: number, expectedVersion: number | undefined) {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new ConflictException({ message: '内容块已被其他管理员更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion });
  }
}

function snapshot(block: DbBlock) {
  return {
    id: block.id,
    key: block.key,
    locale: block.locale,
    title: block.title,
    subtitle: block.subtitle,
    body: normalizeBody(block.bodyJson),
    status: block.status,
    sortOrder: block.sortOrder,
    version: block.version
  };
}

function mapPublicBlock(block: DbBlock, requestedLocale = block.locale): PublicContentBlock {
  return {
    key: block.key,
    locale: block.locale,
    requestedLocale,
    isFallback: block.locale !== requestedLocale,
    title: block.title,
    subtitle: block.subtitle ?? undefined,
    body: normalizeBody(block.bodyJson),
    updatedAt: block.updatedAt.toISOString()
  };
}

function mapAdminBlock(block: DbBlock): AdminContentBlock {
  return {
    id: block.id,
    key: block.key,
    locale: block.locale,
    title: block.title,
    subtitle: block.subtitle ?? undefined,
    body: normalizeBody(block.bodyJson),
    status: block.status,
    sortOrder: block.sortOrder,
    updatedAt: block.updatedAt.toISOString(),
    version: block.version
  };
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listBlocks(locale = DEFAULT_LOCALE) {
    const requestedLocale = normalizeLocale(locale);
    try {
      await this.ensureDefaultBlocks();
      const blocks = await this.readPublishedBlocksWithFallback(requestedLocale);
      return blocks.map((block) => mapPublicBlock(block, requestedLocale));
    } catch (error) {
      this.logger.warn(`Falling back to in-memory content blocks: ${(error as Error).message}`);
      return DEFAULT_HOME_BLOCKS.map((block) => ({
        key: block.key,
        locale: DEFAULT_LOCALE,
        requestedLocale,
        isFallback: requestedLocale !== DEFAULT_LOCALE,
        title: block.title,
        subtitle: block.subtitle,
        body: block.body,
        updatedAt: '2026-04-30T00:00:00.000Z'
      }));
    }
  }

  private async readPublishedBlocksWithFallback(requestedLocale: string) {
    if (requestedLocale === DEFAULT_LOCALE) {
      return this.prisma.publicContentBlock.findMany({
        where: { status: 'published', locale: DEFAULT_LOCALE },
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }]
      });
    }

    const blocks = await this.prisma.publicContentBlock.findMany({
      where: { status: 'published', locale: { in: [requestedLocale, DEFAULT_LOCALE] } },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }]
    });
    const byKey = new Map<string, DbBlock>();
    blocks
      .filter((block) => block.locale === DEFAULT_LOCALE)
      .forEach((block) => byKey.set(block.key, block));
    blocks
      .filter((block) => block.locale === requestedLocale)
      .forEach((block) => byKey.set(block.key, block));
    return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  }

  async listAdminBlocks(locale = DEFAULT_LOCALE) {
    const requestedLocale = normalizeLocale(locale);
    await this.ensureDefaultBlocks();
    const blocks = await this.prisma.publicContentBlock.findMany({
      where: { locale: requestedLocale },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }]
    });
    return blocks.map(mapAdminBlock);
  }

  async createBlock(input: AdminContentBlockCreateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    await this.ensureDefaultBlocks();
    const record = assertRecord(input, '内容块输入不正确。');
    const key = assertRequiredString(record.key, '内容块 key 只能包含字母、数字、点和短横线。', 120);
    const locale = normalizeLocale(record.locale);
    const title = assertRequiredString(record.title, '内容块标题不能为空。', 160);
    if (!key || !/^[a-z0-9.-]+$/i.test(key)) {
      throw new BadRequestException('内容块 key 只能包含字母、数字、点和短横线。');
    }
    const existing = await this.prisma.publicContentBlock.findFirst({ where: { key, locale } });
    if (existing) {
      throw new ConflictException('这个内容块 key 已存在。');
    }

    const block = await this.prisma.publicContentBlock.create({
      data: {
        key,
        locale,
        title,
        subtitle: cleanNullableString(record.subtitle, '内容块副标题不正确。', 240) ?? null,
        bodyJson: (normalizeBody(record.body) ?? {}) as never,
        status: normalizeStatus(typeof record.status === 'string' ? record.status : undefined, 'draft'),
        sortOrder: record.sortOrder === undefined ? 100 : assertNonNegativeInteger(record.sortOrder, '内容块排序不正确。')
      }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'content',
      resourceType: 'content_block',
      resourceId: key,
      action: 'content.create',
      after: snapshot(block)
    });
    return mapAdminBlock(block);
  }

  async updateBlock(key: string, input: AdminContentBlockInput, actorId: number, locale = DEFAULT_LOCALE) {
    const safeActorId = assertActorId(actorId);
    const requestedLocale = normalizeLocale(locale);
    await this.ensureDefaultBlocks();
    const existing = await this.prisma.publicContentBlock.findFirst({ where: { key, locale: requestedLocale } });
    if (!existing) {
      throw new NotFoundException(`Unknown content block: ${key}`);
    }

    const record = assertRecord(input, '内容块输入不正确。');
    const expectedVersion = expectedVersionFrom(record);
    assertVersion(existing.version, expectedVersion);
    const data = {
        title: record.title === undefined ? existing.title : assertRequiredString(record.title, '内容块标题不能为空。', 160),
        subtitle: record.subtitle === undefined ? existing.subtitle : cleanNullableString(record.subtitle, '内容块副标题不正确。', 240),
        bodyJson: (record.body === undefined ? normalizeBody(existing.bodyJson) : normalizeBody(record.body)) as never,
        status: normalizeStatus(typeof record.status === 'string' ? record.status : undefined, existing.status),
        sortOrder: record.sortOrder === undefined ? existing.sortOrder : assertNonNegativeInteger(record.sortOrder, '内容块排序不正确。'),
        version: { increment: 1 }
      };
    const updated = await this.prisma.publicContentBlock.updateMany({ where: { key, locale: requestedLocale, version: existing.version }, data });
    if (updated.count !== 1) throw new ConflictException({ message: '内容块已被其他管理员更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion: existing.version });
    const next = await this.prisma.publicContentBlock.findFirstOrThrow({ where: { key, locale: requestedLocale } });

    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'content',
      resourceType: 'content_block',
      resourceId: key,
      action: 'content.update',
      before: snapshot(existing),
      after: snapshot(next)
    });
    return mapAdminBlock(next);
  }

  async publishBlock(key: string, actorId: number, input: Record<string, unknown> = {}, locale = DEFAULT_LOCALE) {
    return this.setBlockStatus(key, 'published', 'content.publish', actorId, expectedVersionFrom(input), locale);
  }

  async archiveBlock(key: string, actorId: number, input: Record<string, unknown> = {}, locale = DEFAULT_LOCALE) {
    return this.setBlockStatus(key, 'archived', 'content.archive', actorId, expectedVersionFrom(input), locale);
  }

  private async setBlockStatus(key: string, status: 'published' | 'archived', action: string, actorId: number, expectedVersion?: number, locale = DEFAULT_LOCALE) {
    const safeActorId = assertActorId(actorId);
    const requestedLocale = normalizeLocale(locale);
    await this.ensureDefaultBlocks();
    const existing = await this.prisma.publicContentBlock.findFirst({ where: { key, locale: requestedLocale } });
    if (!existing) {
      throw new NotFoundException(`Unknown content block: ${key}`);
    }
    assertVersion(existing.version, expectedVersion);
    const updated = await this.prisma.publicContentBlock.updateMany({
      where: { key, locale: requestedLocale, version: existing.version },
      data: { status, version: { increment: 1 } }
    });
    if (updated.count !== 1) throw new ConflictException({ message: '内容块已被其他管理员更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion: existing.version });
    const next = await this.prisma.publicContentBlock.findFirstOrThrow({ where: { key, locale: requestedLocale } });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'content',
      resourceType: 'content_block',
      resourceId: key,
      action,
      before: snapshot(existing),
      after: snapshot(next)
    });
    return mapAdminBlock(next);
  }

  private async ensureDefaultBlocks() {
    await Promise.all(
      DEFAULT_HOME_BLOCKS.map(async (block) => {
        const existing = await this.prisma.publicContentBlock.findFirst({ where: { key: block.key, locale: DEFAULT_LOCALE } });
        if (existing) return;
        await this.prisma.publicContentBlock.create({
          data: {
            key: block.key,
            locale: DEFAULT_LOCALE,
            title: block.title,
            subtitle: block.subtitle,
            bodyJson: block.body as never,
            status: block.status,
            sortOrder: block.sortOrder
          }
        });
      })
    );
  }
}
