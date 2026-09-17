import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { apiSecretStorageMode, encryptApiSecretForStorage } from './ai-secret-store';
import { normalizeOrganizationRole, organizationRoleAllows, type OrganizationCapability } from './organization-permissions';

type AIReservation = {
  allowed: boolean;
  accountId?: number;
  ledgerId?: number;
  organizationId?: number;
  organizationCreditPoolId?: number;
  balanceUnits: number;
  reason?: string;
  unlimited?: boolean;
  source?: 'personal' | 'organization' | 'unlimited' | 'fallback';
};

type AIReservationProviderInput = {
  provider?: string;
  model?: string;
  providerSource?: 'platform' | 'organization';
  organizationId?: number;
  providerConfigId?: number;
};

const DEFAULT_UNLIMITED_AI_EMAILS = ['misakitoufu@gmail.com'];
const INVITE_SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const INVITE_SHORT_CODE_LENGTH = 10;
const INVITE_SHORT_CODE_FAILED_WINDOW_MINUTES = 15;
const INVITE_SHORT_CODE_FAILED_LIMIT = 8;
const ORGANIZATION_ROLE_RANK: Record<string, number> = {
  student: 1,
  viewer: 2,
  coach: 3,
  teacher: 4,
  admin: 5,
  owner: 6
};

function readNonNegativeInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function parseGrantUnits(value: unknown) {
  const units = Number(value);
  if (!Number.isInteger(units) || units <= 0) throw new BadRequestException('发放额度必须是正整数。');
  if (units > 10000) throw new BadRequestException('单次发放额度不能超过 10000。');
  return units;
}

function cleanReason(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 180) : null;
}

function cleanText(value: unknown, max = 200) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function cleanSlug(value: unknown) {
  const slug = cleanText(value, 140).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new BadRequestException('机构 slug 不能为空。');
  return slug;
}

function fallbackOrganizationSlug() {
  return `organization-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

function parseOptionalPositiveInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException(`${field} 必须是正整数。`);
  return parsed;
}

function parseNonNegativeInt(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new BadRequestException(`${field} 必须是非负整数。`);
  return parsed;
}

function cleanStatus(value: unknown, allowed: string[], fallback: string) {
  const status = cleanText(value, 40) || fallback;
  if (!allowed.includes(status)) throw new BadRequestException(`状态必须是 ${allowed.join('/')}。`);
  return status;
}

function cleanProvider(value: unknown) {
  const provider = cleanText(value, 60);
  if (!['openai', 'openai-compatible'].includes(provider)) throw new BadRequestException('机构 provider 只能是 openai/openai-compatible。');
  return provider;
}

function storedApiKey(value: unknown) {
  const key = encryptApiSecretForStorage(value);
  if (!key) throw new BadRequestException('API Key 不能为空。');
  return key;
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function cleanOptionalEmail(value: unknown) {
  const email = normalizeEmail(String(value ?? ''));
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('邮箱格式无效。');
  return email.slice(0, 255);
}

function cleanRole(value: unknown) {
  const role = normalizeOrganizationRole(cleanText(value, 60), 'student');
  if (!role) throw new BadRequestException('成员角色必须是 owner/admin/teacher/coach/viewer/student。');
  return role;
}

function cleanCohortSlug(value: unknown) {
  const raw = cleanText(value, 140);
  if (!raw) return null;
  return raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null;
}

function parseOptionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} 格式无效。`);
  return date;
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function cleanOptionalSeatLimit(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException('班级容量必须是正整数。');
  if (parsed > 10000) throw new BadRequestException('班级容量不能超过 10000。');
  return parsed;
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cohortSeatLimit(metadata: unknown) {
  const record = recordFromUnknown(metadata);
  const raw = record.seatLimit ?? record.capacity ?? record.maxSeats;
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function inviteRequiresApproval(metadata: unknown) {
  const record = recordFromUnknown(metadata);
  return record.requiresApproval === true || record.approvalMode === 'manual';
}

function defaultInviteExpiry(email: string | null) {
  return dateAfterDays(email ? 7 : 30);
}

function roleRank(role: string) {
  return ORGANIZATION_ROLE_RANK[role] ?? 0;
}

function assertInviteRolePolicy(email: string | null, role: string, maxUses: number) {
  if (!email && role !== 'student') {
    throw new BadRequestException('通用邀请只能授予学生角色；老师和管理员邀请必须指定邮箱。');
  }
  if (role !== 'student' && maxUses !== 1) {
    throw new BadRequestException('老师和管理员邀请只能使用一次。');
  }
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function hashInviteShortCode(code: string) {
  return createHash('sha256').update(`organization-invite-short-code:${normalizeInviteShortCode(code)}`).digest('hex');
}

function newInviteToken() {
  return randomBytes(24).toString('base64url');
}

function normalizeInviteShortCode(value: unknown) {
  return cleanText(value, 40).replace(/[\s-]+/g, '').toUpperCase();
}

function newInviteShortCode() {
  const bytes = randomBytes(INVITE_SHORT_CODE_LENGTH);
  return Array.from(bytes, (byte) => INVITE_SHORT_CODE_ALPHABET[byte % INVITE_SHORT_CODE_ALPHABET.length]).join('');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseMemberImportRows(body: Record<string, unknown>) {
  if (Array.isArray(body.rows)) {
    return body.rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
      .map((row, index) => ({ rowNumber: index + 1, row }));
  }
  const csv = String(body.csv ?? body.text ?? '').trim();
  if (!csv) throw new BadRequestException('请提供 CSV 或 rows。');
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new BadRequestException('CSV 至少需要表头和一行数据。');
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] ?? '';
    });
    return { rowNumber: index + 2, row };
  });
}

function organizationSummary(row: {
  id: number;
  slug: string;
  name: string;
  type: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  aiCreditPool?: {
    id: number;
    availableCredits: number;
    reservedCredits: number;
    expiresAt: Date | null;
    perUserDailyLimit: number | null;
    status: string;
    updatedAt: Date;
  } | null;
  members?: Array<{ id: number; userId: number; cohortId?: number | null; role: string; status: string; user?: { email: string | null; loginName: string | null } | null; cohort?: { id: number; name: string; slug: string } | null }>;
  cohorts?: Array<{ id: number; slug: string; name: string; status: string; memberCount: number; pendingSeatCount?: number; seatLimit?: number | null; remainingSeats?: number | null; createdAt: Date; updatedAt: Date }>;
  invites?: Array<{
    id: number;
    email: string | null;
    role: string;
    status: string;
    cohortId: number | null;
    maxUses: number;
    usedCount: number;
    expiresAt: Date | null;
    createdBy?: number | null;
    acceptedBy?: number | null;
    acceptedAt?: Date | null;
    creatorEmail?: string | null;
    accepterEmail?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  inviteAttempts?: Array<{
    id: number;
    userId: number | null;
    userEmail: string | null;
    inviteId: number | null;
    inviteEmail: string | null;
    inviteRole: string | null;
    cohortId: number | null;
    cohortName: string | null;
    lookupMode: string;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  llmProviderConfigs?: Array<{ id: number; provider: string; model: string; baseUrl: string | null; status: string; usagePolicy: unknown; createdAt: Date; updatedAt: Date }>;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    aiCreditPool: row.aiCreditPool
      ? {
        id: row.aiCreditPool.id,
        availableCredits: row.aiCreditPool.availableCredits,
        reservedCredits: row.aiCreditPool.reservedCredits,
        expiresAt: row.aiCreditPool.expiresAt?.toISOString() ?? null,
        perUserDailyLimit: row.aiCreditPool.perUserDailyLimit,
        status: row.aiCreditPool.status,
        updatedAt: row.aiCreditPool.updatedAt.toISOString()
      }
      : null,
    members: (row.members ?? []).map((member) => ({
      id: member.id,
      userId: member.userId,
      cohortId: member.cohortId ?? null,
      cohortName: member.cohort?.name ?? null,
      role: member.role,
      status: member.status,
      email: member.user?.email ?? member.user?.loginName ?? null
    })),
    cohorts: (row.cohorts ?? []).map((cohort) => ({
      id: cohort.id,
      slug: cohort.slug,
      name: cohort.name,
      status: cohort.status,
      memberCount: cohort.memberCount,
      pendingSeatCount: cohort.pendingSeatCount ?? 0,
      seatLimit: cohort.seatLimit ?? null,
      remainingSeats: cohort.remainingSeats ?? null,
      createdAt: cohort.createdAt.toISOString(),
      updatedAt: cohort.updatedAt.toISOString()
    })),
    invites: (row.invites ?? []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      cohortId: invite.cohortId,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdBy: invite.createdBy ?? null,
      createdByEmail: invite.creatorEmail ?? null,
      acceptedBy: invite.acceptedBy ?? null,
      acceptedByEmail: invite.accepterEmail ?? null,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString()
    })),
    inviteAttempts: (row.inviteAttempts ?? []).map((attempt) => ({
      id: attempt.id,
      userId: attempt.userId,
      userEmail: attempt.userEmail,
      inviteId: attempt.inviteId,
      inviteEmail: attempt.inviteEmail,
      inviteRole: attempt.inviteRole,
      cohortId: attempt.cohortId,
      cohortName: attempt.cohortName,
      lookupMode: attempt.lookupMode,
      status: attempt.status,
      reason: attempt.reason,
      createdAt: attempt.createdAt.toISOString()
    })),
    llmProviderConfigs: (row.llmProviderConfigs ?? []).map((config) => ({
      id: config.id,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      status: config.status,
      usagePolicy: config.usagePolicy,
      apiKeyConfigured: true,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    }))
  };
}

function readUnlimitedAIEmails() {
  const configured = String(process.env.CSCA_AI_UNLIMITED_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return new Set([...DEFAULT_UNLIMITED_AI_EMAILS, ...configured]);
}

@Injectable()
export class AIEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  isEnabled() {
    return enabled(process.env.CSCA_AI_ENTITLEMENT_ENABLED) || this.initialFreeUnits() > 0;
  }

  initialFreeUnits() {
    return readNonNegativeInt('CSCA_AI_INITIAL_FREE_UNITS', 50);
  }

  private async newUniqueInviteShortCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shortCode = newInviteShortCode();
      const shortCodeHash = hashInviteShortCode(shortCode);
      const existing = await this.prisma.organizationInvite.findUnique({ where: { shortCodeHash } });
      if (!existing) return { shortCode, shortCodeHash };
    }
    throw new BadRequestException('邀请码短码生成失败，请重试。');
  }

  async getSummary(userId: number) {
    const account = await this.ensureAccount(userId);
    const unlimited = await this.isUnlimitedUser(userId);
    const organization = await this.activeOrganizationEntitlement(userId);
    return {
      enabled: this.isEnabled(),
      balanceUnits: account.balanceUnits,
      lifetimeGranted: account.lifetimeGranted,
      lifetimeUsed: account.lifetimeUsed,
      initialFreeUnits: this.initialFreeUnits(),
      unlimited,
      organization: organization
        ? {
          id: organization.organizationId,
          slug: organization.slug,
          name: organization.name,
          balanceUnits: organization.availableCredits,
          reservedCredits: organization.reservedCredits,
          perUserDailyLimit: organization.perUserDailyLimit,
          expiresAt: organization.expiresAt?.toISOString() ?? null,
          providerConfigured: Boolean(organization.providerConfig)
        }
        : null
    };
  }

  async reserve(userId: number, abilityType: string, input: AIReservationProviderInput = {}): Promise<AIReservation> {
    if ((input.provider ?? 'rule-fallback') === 'rule-fallback') {
      return { allowed: true, balanceUnits: 0, source: 'fallback' };
    }
    const organization = input.providerSource === 'platform' ? null : await this.activeOrganizationEntitlement(userId);
    if (organization && organization.providerConfig && organization.availableCredits > Math.max(0, organization.reservedCredits)) {
      if (organization.perUserDailyLimit !== null) {
        const usedToday = await this.organizationUsageToday(userId, organization.organizationId);
        if (usedToday >= organization.perUserDailyLimit) {
          await this.writeDeniedLedger(userId, abilityType, input, 'organization_daily_limit', {
            organizationId: organization.organizationId,
            poolId: organization.poolId,
            perUserDailyLimit: organization.perUserDailyLimit
          });
          return {
            allowed: false,
            organizationId: organization.organizationId,
            organizationCreditPoolId: organization.poolId,
            balanceUnits: organization.availableCredits,
            reason: 'organization_daily_limit',
            source: 'organization'
          };
        }
      }
      const reserved = await this.reserveOrganizationCredit(userId, abilityType, input, organization);
      if (reserved.allowed) return reserved;
    }
    const account = await this.ensureAccount(userId);
    if (await this.isUnlimitedUser(userId)) {
      const ledger = await this.prisma.cscaAIUsageLedger.create({
        data: {
          userId,
          accountId: account.id,
          abilityType,
          provider: input.provider ?? null,
          model: input.model ?? null,
          unitsDelta: 0,
          reason: 'unlimited_reserve',
          status: 'reserved',
          metadata: {
            unlimited: true,
            emailAllowlist: true
          }
        }
      });
      return { allowed: true, accountId: account.id, ledgerId: ledger.id, balanceUnits: account.balanceUnits, unlimited: true, source: 'unlimited' };
    }
    if (account.balanceUnits <= 0) {
      await this.writeDeniedLedger(userId, abilityType, input, 'insufficient_balance', { accountId: account.id });
      return { allowed: false, accountId: account.id, balanceUnits: account.balanceUnits, reason: 'insufficient_balance' };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.cscaAIEntitlementAccount.findUnique({ where: { userId } });
      if (!current || current.balanceUnits <= 0) return { allowed: false, balanceUnits: current?.balanceUnits ?? 0 };
      const decrement = await tx.cscaAIEntitlementAccount.updateMany({
        where: { id: current.id, balanceUnits: { gt: 0 } },
        data: { balanceUnits: { decrement: 1 } }
      });
      const updated = await tx.cscaAIEntitlementAccount.findUnique({ where: { id: current.id } });
      if (decrement.count !== 1 || !updated) return { allowed: false, balanceUnits: updated?.balanceUnits ?? 0 };
      const ledger = await tx.cscaAIUsageLedger.create({
        data: {
          userId,
          accountId: current.id,
          abilityType,
          provider: input.provider ?? null,
          model: input.model ?? null,
          unitsDelta: -1,
          reason: 'reserve',
          status: 'reserved'
        }
      });
      return { allowed: true, accountId: current.id, ledgerId: ledger.id, balanceUnits: updated.balanceUnits, source: 'personal' as const };
    });

    if (!result.allowed) {
      await this.writeDeniedLedger(userId, abilityType, input, 'insufficient_balance', { accountId: account.id });
      return { allowed: false, accountId: account.id, balanceUnits: result.balanceUnits, reason: 'insufficient_balance' };
    }
    return result;
  }

  async commit(reservation: AIReservation | null | undefined, input: { interactionId: number; provider?: string; model?: string; metadata?: Record<string, unknown> }) {
    if (!reservation?.ledgerId) return;
    await this.prisma.$transaction([
      this.prisma.cscaAIUsageLedger.update({
        where: { id: reservation.ledgerId },
        data: {
          interactionId: input.interactionId,
          provider: input.provider ?? undefined,
          model: input.model ?? undefined,
          reason: 'consume',
          status: 'posted',
          metadata: {
            ...(input.metadata ?? {}),
            accountBalanceAfterReserve: reservation.balanceUnits,
            reservationSource: reservation.source ?? null,
            organizationId: reservation.organizationId ?? null,
            organizationCreditPoolId: reservation.organizationCreditPoolId ?? null
          }
        }
      }),
      ...(reservation.accountId
        ? [this.prisma.cscaAIEntitlementAccount.update({
          where: { id: reservation.accountId },
          data: { lifetimeUsed: { increment: 1 } }
        })]
        : []),
      ...(reservation.organizationCreditPoolId
        ? [this.prisma.organizationAiCreditPool.update({
          where: { id: reservation.organizationCreditPoolId },
          data: { reservedCredits: { decrement: 1 } }
        })]
        : [])
    ]);
  }

  async refund(reservation: AIReservation | null | undefined, input: { interactionId?: number; reason: string; provider?: string; model?: string }) {
    if (!reservation?.ledgerId) return;
    if (reservation.unlimited) {
      await this.prisma.cscaAIUsageLedger.update({
        where: { id: reservation.ledgerId },
        data: {
          interactionId: input.interactionId,
          provider: input.provider ?? undefined,
          model: input.model ?? undefined,
          unitsDelta: 0,
          reason: input.reason,
          status: 'refunded',
          metadata: {
            unlimited: true,
            refundWithoutBalanceChange: true
          }
        }
      });
      return;
    }
    await this.prisma.$transaction([
      this.prisma.cscaAIUsageLedger.update({
        where: { id: reservation.ledgerId },
        data: {
          interactionId: input.interactionId,
          provider: input.provider ?? undefined,
          model: input.model ?? undefined,
          unitsDelta: 0,
          reason: input.reason,
          status: 'refunded'
        }
      }),
      ...(reservation.accountId
        ? [this.prisma.cscaAIEntitlementAccount.update({
          where: { id: reservation.accountId },
          data: { balanceUnits: { increment: 1 } }
        })]
        : []),
      ...(reservation.organizationCreditPoolId
        ? [this.prisma.organizationAiCreditPool.update({
          where: { id: reservation.organizationCreditPoolId },
          data: {
            availableCredits: { increment: 1 },
            reservedCredits: { decrement: 1 }
          }
        })]
        : [])
    ]);
  }

  async grant(userId: number, actorId: number, input: { units?: unknown; reason?: unknown; source?: unknown }) {
    const units = parseGrantUnits(input.units);
    const reason = cleanReason(input.reason);
    const source = cleanReason(input.source) ?? 'admin_grant';
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, loginName: true, status: true } });
      if (!user) throw new NotFoundException('用户不存在。');
      const account = await tx.cscaAIEntitlementAccount.upsert({
        where: { userId },
        create: {
          userId,
          balanceUnits: units,
          lifetimeGranted: units
        },
        update: {
          balanceUnits: { increment: units },
          lifetimeGranted: { increment: units }
        }
      });
      const ledger = await tx.cscaAIUsageLedger.create({
        data: {
          userId,
          accountId: account.id,
          abilityType: 'ai_credit_grant',
          unitsDelta: units,
          reason: source,
          status: 'posted',
          metadata: {
            actorId,
            reason,
            source,
            balanceAfterGrant: account.balanceUnits
          }
        }
      });
      await recordAdminAudit(tx as PrismaService, {
        actorId,
        module: 'adaptive-ai',
        resourceType: 'ai_entitlement_account',
        resourceId: String(account.id),
        action: 'ai_entitlement.grant',
        after: {
          userId,
          userEmail: user.email ?? user.loginName,
          units,
          balanceUnits: account.balanceUnits,
          lifetimeGranted: account.lifetimeGranted,
          ledgerId: ledger.id,
          reason,
          source
        }
      });
      return { user, account, ledger };
    });
    return {
      userId,
      email: result.user.email ?? result.user.loginName ?? `user-${userId}@cscalite.local`,
      balanceUnits: result.account.balanceUnits,
      lifetimeGranted: result.account.lifetimeGranted,
      lifetimeUsed: result.account.lifetimeUsed,
      grantedUnits: units,
      ledgerId: result.ledger.id,
      reason,
      source
    };
  }

  async listOrganizations() {
    const items = await this.prisma.organization.findMany({
      include: {
        aiCreditPool: true,
        members: {
          include: { user: { select: { email: true, loginName: true } } },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: 50
        },
        llmProviderConfigs: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const enriched = await this.enrichOrganizations(items);
    return { items: enriched.map(organizationSummary) };
  }

  async listManagedOrganizations(userId: number, capability: OrganizationCapability = 'manage_members') {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'active',
        organization: { status: 'active' }
      },
      include: {
        organization: {
          include: {
            aiCreditPool: true,
            members: {
              include: { user: { select: { email: true, loginName: true } } },
              orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
              take: 50
            },
            llmProviderConfigs: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const organizations = memberships
      .filter((membership) => organizationRoleAllows(membership.role, capability))
      .map((membership) => membership.organization);
    const enriched = await this.enrichOrganizations(organizations);
    return {
      items: enriched.map(organizationSummary),
      currentOrganizationId: enriched[0]?.id ?? null
    };
  }

  async resolveManagedOrganizationId(userId: number, capability: OrganizationCapability = 'manage_members') {
    const result = await this.listManagedOrganizations(userId, capability);
    const organizationId = result.currentOrganizationId;
    if (!organizationId) throw new ForbiddenException('当前账号没有机构管理员权限。');
    return organizationId;
  }

  async upsertOrganization(actorId: number, body: Record<string, unknown>) {
    const id = parseOptionalPositiveInt(body.id, '机构 ID');
    const name = cleanText(body.name, 200);
    if (!name) throw new BadRequestException('机构名称不能为空。');
    const slug = body.slug === undefined || body.slug === null || body.slug === ''
      ? cleanText(name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallbackOrganizationSlug()
      : cleanSlug(body.slug);
    const type = cleanText(body.type, 60) || 'partner';
    const status = cleanStatus(body.status, ['pending', 'active', 'disabled', 'archived'], 'active');
    const existing = id
      ? await this.prisma.organization.findUnique({ where: { id } })
      : await this.prisma.organization.findUnique({ where: { slug } });
    const next = existing
      ? await this.prisma.organization.update({
        where: { id: existing.id },
        data: { slug, name, type, status }
      })
      : await this.prisma.organization.create({
        data: { slug, name, type, status }
      });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'adaptive-ai',
      resourceType: 'organization',
      resourceId: String(next.id),
      action: existing ? 'organization.update' : 'organization.create',
      before: existing ? { slug: existing.slug, name: existing.name, type: existing.type, status: existing.status } : undefined,
      after: { slug: next.slug, name: next.name, type: next.type, status: next.status }
    });
    return this.organizationDetail(next.id);
  }

  async upsertOrganizationMember(actorId: number, organizationId: number, body: Record<string, unknown>) {
    const userId = parseOptionalPositiveInt(body.userId, '用户 ID');
    if (!userId) throw new BadRequestException('用户 ID 不能为空。');
    const role = cleanRole(body.role);
    const status = cleanStatus(body.status, ['active', 'disabled', 'archived'], 'active');
    const cohortId = parseOptionalPositiveInt(body.cohortId, '分组 ID');
    const expiresAt = parseOptionalDate(body.expiresAt, '成员到期时间');
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('机构不存在。');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, loginName: true } });
    if (!user) throw new NotFoundException('用户不存在。');
    if (cohortId) await this.ensureCohortBelongsToOrganization(organizationId, cohortId);
    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } }
    });
    if (status === 'active' && cohortId && !(existing?.status === 'active' && existing.cohortId === cohortId)) {
      await this.assertCohortInviteCapacity(organizationId, cohortId, 1);
    }
    const rows = existing
      ? await this.prisma.$queryRaw<Array<{ id: number; role: string; status: string }>>(Prisma.sql`
          UPDATE "organization_members"
          SET "cohort_id" = ${cohortId}, role = ${role}, status = ${status}, "expires_at" = ${expiresAt}, "updated_at" = CURRENT_TIMESTAMP
          WHERE id = ${existing.id}
          RETURNING id, role, status
        `)
      : await this.prisma.$queryRaw<Array<{ id: number; role: string; status: string }>>(Prisma.sql`
          INSERT INTO "organization_members" ("organization_id", "user_id", "cohort_id", role, status, "invited_by", "joined_at", "expires_at")
          VALUES (${organizationId}, ${userId}, ${cohortId}, ${role}, ${status}, ${actorId}, CURRENT_TIMESTAMP, ${expiresAt})
          RETURNING id, role, status
        `);
    const next = rows[0];
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'adaptive-ai',
      resourceType: 'organization_member',
      resourceId: String(next?.id ?? existing?.id ?? ''),
      action: existing ? 'organization.member.update' : 'organization.member.add',
      before: existing ? { role: existing.role, status: existing.status, cohortId: existing.cohortId ?? null, expiresAt: existing.expiresAt?.toISOString() ?? null } : undefined,
      after: { organizationId, userId, cohortId, role: next?.role ?? role, status: next?.status ?? status, email: user.email ?? user.loginName }
    });
    return this.organizationDetail(organizationId);
  }

  async bulkUpdateOrganizationMembers(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const rawMembers = Array.isArray(body.members) ? body.members : [];
    const members = rawMembers
      .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : null)
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .slice(0, 200);
    if (members.length === 0) throw new BadRequestException('请提供要批量更新的成员。');
    const results = [];
    let latest: Awaited<ReturnType<typeof this.organizationDetail>> | null = null;
    for (const member of members) {
      const userId = parseOptionalPositiveInt(member.userId, '用户 ID');
      if (!userId) {
        results.push({ userId: null, result: 'failed', error: '用户 ID 不能为空。' });
        continue;
      }
      try {
        latest = await this.upsertOrganizationMember(actorId, organizationId, {
          userId,
          role: member.role,
          status: member.status,
          cohortId: member.cohortId,
          expiresAt: member.expiresAt
        });
        results.push({
          userId,
          email: cleanText(member.email, 200),
          role: cleanText(member.role, 60),
          status: cleanText(member.status, 60),
          cohortId: member.cohortId ?? null,
          result: 'success'
        });
      } catch (error) {
        results.push({
          userId,
          email: cleanText(member.email, 200),
          result: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return {
      organization: latest ?? await this.organizationDetail(organizationId),
      requested: members.length,
      succeeded: results.filter((item) => item.result === 'success').length,
      failed: results.filter((item) => item.result === 'failed').length,
      results
    };
  }

  async upsertOrganizationCohort(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const id = parseOptionalPositiveInt(body.id, '分组 ID');
    const name = cleanText(body.name, 200);
    if (!name) throw new BadRequestException('分组名称不能为空。');
    const slug = cleanCohortSlug(body.slug ?? name);
    if (!slug) throw new BadRequestException('分组 slug 不能为空。');
    const status = cleanStatus(body.status, ['active', 'disabled', 'archived'], 'active');
    const rawMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
    const requestedSeatLimit = Object.prototype.hasOwnProperty.call(body, 'seatLimit')
      ? cleanOptionalSeatLimit(body.seatLimit)
      : cleanOptionalSeatLimit(rawMetadata.seatLimit ?? rawMetadata.capacity ?? rawMetadata.maxSeats);
    const metadata = {
      ...rawMetadata,
      ...(requestedSeatLimit ? { seatLimit: requestedSeatLimit } : {})
    };
    const existing = id
      ? await this.prisma.$queryRaw<Array<{ id: number; slug: string; name: string; status: string }>>(Prisma.sql`
          SELECT id, slug, name, status FROM "organization_cohorts"
          WHERE id = ${id} AND "organization_id" = ${organizationId}
          LIMIT 1
        `)
      : await this.prisma.$queryRaw<Array<{ id: number; slug: string; name: string; status: string }>>(Prisma.sql`
          SELECT id, slug, name, status FROM "organization_cohorts"
          WHERE "organization_id" = ${organizationId} AND slug = ${slug}
          LIMIT 1
        `);
    const found = existing[0] ?? null;
    const metaJson = Object.keys(metadata).length ? JSON.stringify(metadata) : null;
    const rows = found
      ? await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          UPDATE "organization_cohorts"
          SET slug = ${slug}, name = ${name}, status = ${status}, metadata = CAST(${metaJson} AS jsonb), "updated_at" = CURRENT_TIMESTAMP
          WHERE id = ${found.id}
          RETURNING id
        `)
      : await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          INSERT INTO "organization_cohorts" ("organization_id", slug, name, status, metadata)
          VALUES (${organizationId}, ${slug}, ${name}, ${status}, CAST(${metaJson} AS jsonb))
          RETURNING id
        `);
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_cohort',
      resourceId: String(rows[0]?.id ?? found?.id ?? ''),
      action: found ? 'organization.cohort.update' : 'organization.cohort.create',
      before: found ? { slug: found.slug, name: found.name, status: found.status } : undefined,
      after: { organizationId, slug, name, status, seatLimit: requestedSeatLimit }
    });
    return this.organizationDetail(organizationId);
  }

  async createOrganizationInvite(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const email = cleanOptionalEmail(body.email);
    const role = cleanRole(body.role);
    const cohortId = parseOptionalPositiveInt(body.cohortId, '分组 ID');
    const maxUses = parseNonNegativeInt(body.maxUses ?? (email ? 1 : 50), '最大使用次数');
    if (maxUses <= 0 || maxUses > 1000) throw new BadRequestException('最大使用次数必须在 1 到 1000 之间。');
    assertInviteRolePolicy(email, role, maxUses);
    const expiresAt = body.expiresAt === undefined ? defaultInviteExpiry(email) : parseOptionalDate(body.expiresAt, '邀请到期时间');
    if (cohortId) await this.ensureCohortBelongsToOrganization(organizationId, cohortId);
    await this.ensureNoActiveInvite(organizationId, email, role, cohortId);
    await this.assertCohortInviteCapacity(organizationId, cohortId, maxUses);
    const token = newInviteToken();
    const tokenHash = hashInviteToken(token);
    const shortCodeInvite = role === 'student' ? await this.newUniqueInviteShortCode() : { shortCode: null, shortCodeHash: null };
    const rawMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
    const requiresApproval = body.requiresApproval === true || rawMetadata.requiresApproval === true || rawMetadata.approvalMode === 'manual';
    const metadata = {
      ...rawMetadata,
      ...(requiresApproval ? { requiresApproval: true, approvalMode: 'manual' } : {})
    };
    const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "organization_invites" ("organization_id", "cohort_id", email, role, "token_hash", "short_code_hash", status, "max_uses", "expires_at", "created_by", metadata)
      VALUES (${organizationId}, ${cohortId}, ${email}, ${role}, ${tokenHash}, ${shortCodeInvite.shortCodeHash}, 'pending', ${maxUses}, ${expiresAt}, ${actorId}, CAST(${Object.keys(metadata).length ? JSON.stringify(metadata) : null} AS jsonb))
      RETURNING id
    `);
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_invite',
      resourceId: String(rows[0]?.id ?? ''),
      action: 'organization.invite.create',
      after: { organizationId, cohortId, email, role, maxUses, expiresAt: expiresAt?.toISOString() ?? null, requiresApproval }
    });
    return {
      organization: await this.organizationDetail(organizationId),
      invite: {
        id: rows[0]?.id,
        email,
        role,
        cohortId,
        maxUses,
        expiresAt: expiresAt?.toISOString() ?? null,
        token,
        shortCode: shortCodeInvite.shortCode,
        acceptPath: `/organizations/invite?token=${encodeURIComponent(token)}`
      }
    };
  }

  async assignOrganizationAdminByEmail(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const email = cleanOptionalEmail(body.email);
    if (!email) throw new BadRequestException('机构管理员邮箱不能为空。');
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, loginName: true }
    });
    if (user) {
      const existing = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: user.id } }
      });
      const organization = await this.upsertOrganizationMember(actorId, organizationId, {
        userId: user.id,
        role: 'admin',
        status: 'active',
        cohortId: null
      });
      await recordAdminAudit(this.prisma, {
        actorId,
        module: 'organization',
        resourceType: 'organization_member',
        resourceId: String(existing?.id ?? user.id),
        action: existing?.role === 'student' ? 'organization.admin.promote_from_student' : 'organization.admin.assign',
        before: existing ? { role: existing.role, status: existing.status, cohortId: existing.cohortId ?? null } : undefined,
        after: { organizationId, userId: user.id, email: user.email ?? user.loginName, role: 'admin', status: 'active' }
      });
      return {
        organization,
        assignment: {
          email,
          status: existing?.role === 'student' ? 'promoted' : 'assigned',
          userId: user.id,
          inviteId: null,
          acceptPath: null
        }
      };
    }
    const result = await this.createOrganizationInvite(actorId, organizationId, {
      email,
      role: 'admin',
      maxUses: 1,
      metadata: { source: 'organization_admin_assignment' }
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_invite',
      resourceId: String(result.invite.id),
      action: 'organization.admin.invite',
      after: { organizationId, email, role: 'admin', maxUses: 1 }
    });
    return {
      organization: result.organization,
      assignment: {
        email,
        status: 'invited',
        userId: null,
        inviteId: result.invite.id,
        acceptPath: result.invite.acceptPath
      }
    };
  }

  async listOrganizationInvites(organizationId: number, query: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const status = cleanStatus(query.status, ['all', 'pending', 'used', 'expired', 'archived'], 'all');
    const cohortId = parseOptionalPositiveInt(query.cohortId, '分组 ID');
    if (cohortId) await this.ensureCohortBelongsToOrganization(organizationId, cohortId);
    const search = cleanText(query.search, 255).toLowerCase();
    const now = new Date();
    const where: Prisma.OrganizationInviteWhereInput = {
      organizationId,
      ...(cohortId ? { cohortId } : {})
    };
    if (status === 'pending') {
      where.status = 'pending';
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    } else if (status === 'expired') {
      where.status = 'pending';
      where.expiresAt = { lte: now };
    } else if (status !== 'all') {
      where.status = status;
    } else {
      where.status = { not: 'archived' };
    }
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }
    const invites = await this.prisma.organizationInvite.findMany({
      where,
      include: { cohort: { select: { id: true, slug: true, name: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 300
    });
    const userIds = Array.from(new Set(invites.flatMap((invite) => [invite.createdBy, invite.acceptedBy]).filter((value): value is number => typeof value === 'number')));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, loginName: true }
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user.email ?? user.loginName ?? `user-${user.id}`] as const));
    return {
      items: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        effectiveStatus: invite.status === 'pending' && invite.expiresAt && invite.expiresAt <= now ? 'expired' : invite.status,
        cohortId: invite.cohortId,
        cohortName: invite.cohort?.name ?? null,
        cohortSlug: invite.cohort?.slug ?? null,
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        createdBy: invite.createdBy ?? null,
        createdByEmail: invite.createdBy ? userMap.get(invite.createdBy) ?? null : null,
        acceptedBy: invite.acceptedBy ?? null,
        acceptedByEmail: invite.acceptedBy ? userMap.get(invite.acceptedBy) ?? null : null,
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        updatedAt: invite.updatedAt.toISOString(),
        canRevealToken: false
      })),
      limit: 300
    };
  }

  async archiveOrganizationInvite(actorId: number, organizationId: number, inviteId: number) {
    await this.ensureOrganizationExists(organizationId);
    const existing = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId }
    });
    if (!existing) throw new NotFoundException('邀请不存在。');
    if (existing.status === 'archived') {
      return { organization: await this.organizationDetail(organizationId), invite: { id: inviteId, status: 'archived' } };
    }
    const next = await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: 'archived' }
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_invite',
      resourceId: String(inviteId),
      action: 'organization.invite.archive',
      before: { status: existing.status, email: existing.email, cohortId: existing.cohortId },
      after: { organizationId, status: next.status }
    });
    return { organization: await this.organizationDetail(organizationId), invite: { id: inviteId, status: next.status } };
  }

  async reissueOrganizationInvite(actorId: number, organizationId: number, inviteId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const existing = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId }
    });
    if (!existing) throw new NotFoundException('邀请不存在。');
    const maxUses = parseNonNegativeInt(body.maxUses ?? existing.maxUses, '最大使用次数');
    if (maxUses <= 0 || maxUses > 1000) throw new BadRequestException('最大使用次数必须在 1 到 1000 之间。');
    assertInviteRolePolicy(existing.email, existing.role, maxUses);
    const expiresAt = body.expiresAt === undefined ? defaultInviteExpiry(existing.email) : parseOptionalDate(body.expiresAt, '邀请到期时间');
    await this.assertCohortInviteCapacity(organizationId, existing.cohortId, maxUses, existing.id);
    const token = newInviteToken();
    const tokenHash = hashInviteToken(token);
    const shortCodeInvite = existing.role === 'student' ? await this.newUniqueInviteShortCode() : { shortCode: null, shortCodeHash: null };
    const previousMetadata = recordFromUnknown(existing.metadata);
    const metadata = {
      ...previousMetadata,
      source: 'invite_reissue',
      reissuedFromInviteId: existing.id,
      ...(inviteRequiresApproval(previousMetadata) ? { requiresApproval: true, approvalMode: 'manual' } : {})
    };
    const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "organization_invites" ("organization_id", "cohort_id", email, role, "token_hash", "short_code_hash", status, "max_uses", "expires_at", "created_by", metadata)
      VALUES (${organizationId}, ${existing.cohortId}, ${existing.email}, ${existing.role}, ${tokenHash}, ${shortCodeInvite.shortCodeHash}, 'pending', ${maxUses}, ${expiresAt}, ${actorId}, CAST(${JSON.stringify(metadata)} AS jsonb))
      RETURNING id
    `);
    if (existing.status === 'pending') {
      await this.prisma.organizationInvite.update({
        where: { id: existing.id },
        data: { status: 'archived' }
      });
    }
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_invite',
      resourceId: String(rows[0]?.id ?? ''),
      action: 'organization.invite.reissue',
      before: { inviteId: existing.id, status: existing.status, email: existing.email, cohortId: existing.cohortId },
      after: { organizationId, sourceInviteId: existing.id, newInviteId: rows[0]?.id ?? null, maxUses, expiresAt: expiresAt?.toISOString() ?? null }
    });
    return {
      organization: await this.organizationDetail(organizationId),
      invite: {
        id: rows[0]?.id,
        email: existing.email,
        role: existing.role,
        cohortId: existing.cohortId,
        maxUses,
        expiresAt: expiresAt?.toISOString() ?? null,
        token,
        shortCode: shortCodeInvite.shortCode,
        acceptPath: `/organizations/invite?token=${encodeURIComponent(token)}`
      }
    };
  }

  async reissueOrganizationInvites(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const rawIds = Array.isArray(body.inviteIds) ? body.inviteIds : [];
    const inviteIds = Array.from(new Set(rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (inviteIds.length === 0) throw new BadRequestException('请选择要重新生成的邀请。');
    if (inviteIds.length > 100) throw new BadRequestException('单次最多重新生成 100 个邀请。');
    const existing = await this.prisma.organizationInvite.findMany({
      where: { organizationId, id: { in: inviteIds } },
      orderBy: [{ id: 'asc' }]
    });
    if (existing.length !== inviteIds.length) throw new BadRequestException('部分邀请不存在或不属于当前机构。');
    const createdInvites: Array<{ sourceInviteId: number; id: number; email: string | null; token: string; shortCode: string | null; acceptPath: string }> = [];
    for (const invite of existing) {
      assertInviteRolePolicy(invite.email, invite.role, invite.maxUses);
      await this.assertCohortInviteCapacity(organizationId, invite.cohortId, invite.maxUses, invite.id);
      const token = newInviteToken();
      const shortCodeInvite = invite.role === 'student' ? await this.newUniqueInviteShortCode() : { shortCode: null, shortCodeHash: null };
      const expiresAt = defaultInviteExpiry(invite.email);
      const previousMetadata = recordFromUnknown(invite.metadata);
      const metadata = {
        ...previousMetadata,
        source: 'invite_bulk_reissue',
        reissuedFromInviteId: invite.id,
        ...(inviteRequiresApproval(previousMetadata) ? { requiresApproval: true, approvalMode: 'manual' } : {})
      };
      const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        INSERT INTO "organization_invites" ("organization_id", "cohort_id", email, role, "token_hash", "short_code_hash", status, "max_uses", "expires_at", "created_by", metadata)
        VALUES (${organizationId}, ${invite.cohortId}, ${invite.email}, ${invite.role}, ${hashInviteToken(token)}, ${shortCodeInvite.shortCodeHash}, 'pending', ${invite.maxUses}, ${expiresAt}, ${actorId}, CAST(${JSON.stringify(metadata)} AS jsonb))
        RETURNING id
      `);
      if (invite.status === 'pending') {
        await this.prisma.organizationInvite.update({
          where: { id: invite.id },
          data: { status: 'archived' }
        });
      }
      createdInvites.push({
        sourceInviteId: invite.id,
        id: rows[0]?.id ?? 0,
        email: invite.email,
        token,
        shortCode: shortCodeInvite.shortCode,
        acceptPath: `/organizations/invite?token=${encodeURIComponent(token)}`
      });
    }
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization_invite',
      resourceId: String(organizationId),
      action: 'organization.invite.bulk_reissue',
      after: { organizationId, sourceInviteIds: inviteIds, createdInviteIds: createdInvites.map((invite) => invite.id) }
    });
    return {
      organization: await this.organizationDetail(organizationId),
      invites: createdInvites
    };
  }

  async previewOrganizationMemberImport(organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const rows = await this.normalizeMemberImportRows(organizationId, body);
    return {
      rows,
      summary: {
        total: rows.length,
        readyMembers: rows.filter((row) => row.action === 'upsert_member').length,
        readyInvites: rows.filter((row) => row.action === 'create_invite').length,
        skipped: rows.filter((row) => row.action === 'skip').length,
        errors: rows.filter((row) => row.errors.length > 0).length
      }
    };
  }

  async applyOrganizationMemberImport(actorId: number, organizationId: number, body: Record<string, unknown>) {
    await this.ensureOrganizationExists(organizationId);
    const preview = await this.normalizeMemberImportRows(organizationId, body);
    const invalid = preview.filter((row) => row.errors.length > 0);
    if (invalid.length > 0) throw new BadRequestException(`导入预检仍有 ${invalid.length} 行错误，请先修正。`);
    const createdInvites: Array<{ rowNumber: number; email: string | null; token: string; shortCode: string | null }> = [];
    let upsertedMembers = 0;
    for (const row of preview) {
      if (row.action === 'skip') continue;
      const cohortId = row.cohortId ?? (row.cohortSlug ? await this.ensureCohortBySlug(organizationId, row.cohortSlug, row.cohortName ?? row.cohortSlug) : null);
      if (row.action === 'upsert_member' && row.userId) {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "organization_members" ("organization_id", "user_id", "cohort_id", role, status, "invited_by", "joined_at")
          VALUES (${organizationId}, ${row.userId}, ${cohortId}, ${row.role}, 'active', ${actorId}, CURRENT_TIMESTAMP)
          ON CONFLICT ("organization_id", "user_id")
          DO UPDATE SET "cohort_id" = EXCLUDED."cohort_id", role = EXCLUDED.role, status = 'active', "updated_at" = CURRENT_TIMESTAMP
        `);
        upsertedMembers += 1;
      } else if (row.action === 'create_invite') {
        await this.assertCohortInviteCapacity(organizationId, cohortId, 1);
        const token = newInviteToken();
        const shortCodeInvite = row.role === 'student' ? await this.newUniqueInviteShortCode() : { shortCode: null, shortCodeHash: null };
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "organization_invites" ("organization_id", "cohort_id", email, role, "token_hash", "short_code_hash", status, "max_uses", "expires_at", "created_by", metadata)
          VALUES (${organizationId}, ${cohortId}, ${row.email}, ${row.role}, ${hashInviteToken(token)}, ${shortCodeInvite.shortCodeHash}, 'pending', 1, ${defaultInviteExpiry(row.email)}, ${actorId}, CAST(${JSON.stringify({ source: 'member_import', rowNumber: row.rowNumber })} AS jsonb))
        `);
        createdInvites.push({ rowNumber: row.rowNumber, email: row.email, token, shortCode: shortCodeInvite.shortCode });
      }
    }
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'organization',
      resourceType: 'organization',
      resourceId: String(organizationId),
      action: 'organization.member_import.apply',
      after: { organizationId, upsertedMembers, createdInvites: createdInvites.length }
    });
    return {
      organization: await this.organizationDetail(organizationId),
      summary: { total: preview.length, upsertedMembers, createdInvites: createdInvites.length },
      invites: createdInvites
    };
  }

  async acceptOrganizationInvite(user: { id: number; email?: string | null; loginName?: string | null }, body: Record<string, unknown>) {
    const token = cleanText(body.token, 300);
    if (!token) throw new BadRequestException('邀请 token 不能为空。');
    return this.acceptOrganizationInviteByHash(user, hashInviteToken(token), 'token');
  }

  async acceptOrganizationInviteCode(user: { id: number; email?: string | null; loginName?: string | null }, body: Record<string, unknown>) {
    const code = normalizeInviteShortCode(body.code);
    if (!code) throw new BadRequestException('邀请码不能为空。');
    if (code.length < 8 || code.length > 12 || !/^[2-9A-HJ-NP-Z]+$/.test(code)) {
      throw new BadRequestException('邀请码格式无效。');
    }
    const inviteHash = hashInviteShortCode(code);
    await this.assertShortCodeAttemptAllowed(user.id, inviteHash);
    try {
      const result = await this.acceptOrganizationInviteByHash(user, inviteHash, 'short_code');
      await this.recordOrganizationInviteAttempt(user.id, 'short_code', inviteHash, result.invite.id, 'accepted');
      return result;
    } catch (error) {
      await this.recordOrganizationInviteAttempt(user.id, 'short_code', inviteHash, await this.findInviteIdByShortCodeHash(inviteHash), 'failed', this.inviteAttemptReason(error));
      throw error;
    }
  }

  private async assertShortCodeAttemptAllowed(userId: number, inviteHash: string) {
    const since = new Date(Date.now() - INVITE_SHORT_CODE_FAILED_WINDOW_MINUTES * 60 * 1000);
    const failedCount = await this.prisma.organizationInviteAttempt.count({
      where: {
        userId,
        lookupMode: 'short_code',
        status: { in: ['failed', 'rate_limited'] },
        createdAt: { gte: since }
      }
    });
    if (failedCount < INVITE_SHORT_CODE_FAILED_LIMIT) return;
    await this.recordOrganizationInviteAttempt(userId, 'short_code', inviteHash, await this.findInviteIdByShortCodeHash(inviteHash), 'rate_limited', 'too_many_short_code_attempts');
    throw new BadRequestException('短邀请码错误次数过多，请稍后再试。');
  }

  private async findInviteIdByShortCodeHash(inviteHash: string) {
    try {
      const invite = await this.prisma.organizationInvite.findUnique({ where: { shortCodeHash: inviteHash }, select: { id: true } });
      return invite?.id ?? null;
    } catch {
      return null;
    }
  }

  private inviteAttemptReason(error: unknown) {
    if (error instanceof Error) return (error.message || error.name || 'invite_error').slice(0, 160);
    return 'invite_error';
  }

  private async recordOrganizationInviteAttempt(
    userId: number,
    lookupMode: 'token' | 'short_code',
    inviteHash: string,
    inviteId: number | null,
    status: 'accepted' | 'failed' | 'rate_limited',
    reason: string | null = null
  ) {
    try {
      await this.prisma.organizationInviteAttempt.create({
        data: {
          userId,
          inviteId,
          lookupMode,
          inviteHash,
          status,
          reason
        }
      });
    } catch {
      // Invite attempt recording should not block the invite flow.
    }
  }

  private async acceptOrganizationInviteByHash(
    user: { id: number; email?: string | null; loginName?: string | null },
    inviteHash: string,
    lookupMode: 'token' | 'short_code'
  ) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const invites = await tx.$queryRaw<Array<{
        id: number;
        organizationId: number;
        cohortId: number | null;
        email: string | null;
        role: string;
        status: string;
        maxUses: number;
        usedCount: number;
        expiresAt: Date | null;
        metadata: unknown;
      }>>(Prisma.sql`
        SELECT id, "organization_id" AS "organizationId", "cohort_id" AS "cohortId", email, role, status,
          "max_uses" AS "maxUses", "used_count" AS "usedCount", "expires_at" AS "expiresAt", metadata
        FROM "organization_invites"
        WHERE ${lookupMode === 'short_code' ? Prisma.sql`"short_code_hash"` : Prisma.sql`"token_hash"`} = ${inviteHash}
        FOR UPDATE
      `);
      const invite = invites[0];
      if (!invite) throw new NotFoundException('邀请不存在或已失效。');
      if (invite.status !== 'pending') throw new BadRequestException('邀请已不可使用。');
      if (invite.expiresAt && invite.expiresAt <= now) throw new BadRequestException('邀请已过期。');
      if (invite.usedCount >= invite.maxUses) throw new BadRequestException('邀请使用次数已用完。');
      const userEmail = normalizeEmail(user.email ?? user.loginName ?? '');
      if (!invite.email && invite.role !== 'student') {
        throw new BadRequestException('通用邀请只能用于学生加入。');
      }
      if (invite.email && normalizeEmail(invite.email) !== userEmail) {
        throw new BadRequestException('这个邀请绑定了其他邮箱，请使用对应账号登录。');
      }
      const organizations = await tx.$queryRaw<Array<{ id: number; slug: string; name: string; status: string }>>(Prisma.sql`
        SELECT id, slug, name, status
        FROM "organizations"
        WHERE id = ${invite.organizationId}
        LIMIT 1
      `);
      const organization = organizations[0];
      if (!organization || organization.status !== 'active') throw new BadRequestException('机构当前不可加入。');
      const cohorts = invite.cohortId ? await tx.$queryRaw<Array<{ id: number; slug: string; name: string }>>(Prisma.sql`
        SELECT id, slug, name
        FROM "organization_cohorts"
        WHERE id = ${invite.cohortId}
          AND "organization_id" = ${invite.organizationId}
        LIMIT 1
      `) : [];
      const cohort = cohorts[0] ?? null;
      const existingMembers = await tx.$queryRaw<Array<{ id: number; role: string; status: string }>>(Prisma.sql`
        SELECT id, role, status
        FROM "organization_members"
        WHERE "organization_id" = ${invite.organizationId}
          AND "user_id" = ${user.id}
        FOR UPDATE
      `);
      const existingMember = existingMembers[0] ?? null;
      if (existingMember && roleRank(invite.role) > roleRank(existingMember.role) && !invite.email) {
        throw new ForbiddenException('公开邀请不能提升已有成员角色。');
      }
      const nextRole = existingMember && roleRank(existingMember.role) > roleRank(invite.role)
        ? existingMember.role
        : invite.role;
      const nextMemberStatus = existingMember?.status === 'active' || !inviteRequiresApproval(invite.metadata)
        ? 'active'
        : 'pending';
      await this.assertCohortAcceptCapacity(tx, invite.organizationId, invite.cohortId, user.id);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "organization_members" ("organization_id", "user_id", "cohort_id", role, status, "invited_by", "joined_at")
        VALUES (${invite.organizationId}, ${user.id}, ${invite.cohortId}, ${nextRole}, ${nextMemberStatus}, NULL, ${nextMemberStatus === 'active' ? new Date() : null})
        ON CONFLICT ("organization_id", "user_id")
        DO UPDATE SET "cohort_id" = EXCLUDED."cohort_id", role = EXCLUDED.role, status = EXCLUDED.status, "joined_at" = COALESCE("organization_members"."joined_at", EXCLUDED."joined_at"), "updated_at" = CURRENT_TIMESTAMP
      `);
      const nextUsedCount = invite.usedCount + 1;
      const nextStatus = nextUsedCount >= invite.maxUses ? 'used' : 'pending';
      await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invites"
        SET "used_count" = ${nextUsedCount}, status = ${nextStatus}, "accepted_by" = ${user.id}, "accepted_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
        WHERE id = ${invite.id}
      `);
      return { invite, organization, cohort, nextRole, nextMemberStatus, nextStatus, nextUsedCount };
    });
    return {
      accepted: true,
      organization: {
        id: result.organization.id,
        slug: result.organization.slug,
        name: result.organization.name
      },
      membership: {
        role: result.nextRole,
        status: result.nextMemberStatus,
        cohortId: result.invite.cohortId,
        cohortName: result.cohort?.name ?? null
      },
      invite: {
        id: result.invite.id,
        status: result.nextStatus,
        usedCount: result.nextUsedCount,
        maxUses: result.invite.maxUses
      }
    };
  }

  async upsertOrganizationCreditPool(actorId: number, organizationId: number, body: Record<string, unknown>) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('机构不存在。');
    const availableCredits = parseNonNegativeInt(body.availableCredits, '机构可用额度');
    const reservedCredits = parseNonNegativeInt(body.reservedCredits ?? 0, '机构预留额度');
    const perUserDailyLimit = parseOptionalPositiveInt(body.perUserDailyLimit, '每日限额');
    const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new BadRequestException('过期时间格式无效。');
    const status = cleanStatus(body.status, ['active', 'disabled', 'archived'], 'active');
    const existing = await this.prisma.organizationAiCreditPool.findUnique({ where: { organizationId } });
    const next = await this.prisma.organizationAiCreditPool.upsert({
      where: { organizationId },
      create: { organizationId, availableCredits, reservedCredits, perUserDailyLimit, expiresAt, status },
      update: { availableCredits, reservedCredits, perUserDailyLimit, expiresAt, status }
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'adaptive-ai',
      resourceType: 'organization_ai_credit_pool',
      resourceId: String(next.id),
      action: existing ? 'organization.credit_pool.update' : 'organization.credit_pool.create',
      before: existing ? {
        availableCredits: existing.availableCredits,
        reservedCredits: existing.reservedCredits,
        perUserDailyLimit: existing.perUserDailyLimit,
        expiresAt: existing.expiresAt?.toISOString() ?? null,
        status: existing.status
      } : undefined,
      after: {
        organizationId,
        availableCredits: next.availableCredits,
        reservedCredits: next.reservedCredits,
        perUserDailyLimit: next.perUserDailyLimit,
        expiresAt: next.expiresAt?.toISOString() ?? null,
        status: next.status
      }
    });
    return this.organizationDetail(organizationId);
  }

  async upsertOrganizationProvider(actorId: number, organizationId: number, body: Record<string, unknown>) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('机构不存在。');
    const provider = cleanProvider(body.provider);
    const model = cleanText(body.model, 120);
    if (!model) throw new BadRequestException('模型名称不能为空。');
    const status = cleanStatus(body.status, ['active', 'disabled', 'archived'], 'disabled');
    const baseUrl = cleanText(body.baseUrl, 500) || null;
    const usagePolicy = body.usagePolicy && typeof body.usagePolicy === 'object' && !Array.isArray(body.usagePolicy)
      ? body.usagePolicy as Prisma.InputJsonValue
      : Prisma.JsonNull;
    const id = parseOptionalPositiveInt(body.id, 'provider 配置 ID');
    const existing = id
      ? await this.prisma.organizationLlmProviderConfig.findFirst({ where: { id, organizationId } })
      : await this.prisma.organizationLlmProviderConfig.findFirst({ where: { organizationId, provider, model, status: { not: 'archived' } } });
    const encryptedApiKey = body.apiKey ? storedApiKey(body.apiKey) : existing?.encryptedApiKey;
    if (!encryptedApiKey) throw new BadRequestException('API Key 不能为空。');
    const next = existing
      ? await this.prisma.organizationLlmProviderConfig.update({
        where: { id: existing.id },
        data: { provider, model, encryptedApiKey, baseUrl, status, usagePolicy }
      })
      : await this.prisma.organizationLlmProviderConfig.create({
        data: { organizationId, provider, model, encryptedApiKey, baseUrl, status, usagePolicy }
      });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'adaptive-ai',
      resourceType: 'organization_llm_provider_config',
      resourceId: String(next.id),
      action: existing ? 'organization.provider.update' : 'organization.provider.create',
      before: existing ? {
        provider: existing.provider,
        model: existing.model,
        baseUrl: existing.baseUrl,
        status: existing.status,
        apiKeyConfigured: Boolean(existing.encryptedApiKey)
      } : undefined,
      after: {
        organizationId,
        provider: next.provider,
        model: next.model,
        baseUrl: next.baseUrl,
        status: next.status,
        apiKeyConfigured: Boolean(next.encryptedApiKey),
        apiKeyStorageMode: apiSecretStorageMode(next.encryptedApiKey)
      }
    });
    return this.organizationDetail(organizationId);
  }

  private async organizationDetail(organizationId: number) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        aiCreditPool: true,
        members: {
          include: { user: { select: { email: true, loginName: true } } },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: 50
        },
        llmProviderConfigs: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }
      }
    });
    if (!organization) throw new NotFoundException('机构不存在。');
    const [enriched] = await this.enrichOrganizations([organization]);
    return organizationSummary(enriched);
  }

  private async ensureOrganizationExists(organizationId: number) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new NotFoundException('机构不存在。');
  }

  private async ensureCohortBelongsToOrganization(organizationId: number, cohortId: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id FROM "organization_cohorts"
      WHERE id = ${cohortId} AND "organization_id" = ${organizationId} AND status <> 'archived'
      LIMIT 1
    `);
    if (!rows[0]) throw new BadRequestException('分组不属于当前机构。');
  }

  private async assertCohortInviteCapacity(organizationId: number, cohortId: number | null, requestedSeats: number, excludedInviteId: number | null = null) {
    if (!cohortId || requestedSeats <= 0) return;
    const rows = await this.prisma.$queryRaw<Array<{ id: number; metadata: unknown; memberCount: bigint; pendingSeatCount: bigint }>>(Prisma.sql`
      SELECT c.id, c.metadata,
        COUNT(m.id)::bigint AS "memberCount",
        COALESCE(pending."pendingSeatCount", 0)::bigint AS "pendingSeatCount"
      FROM "organization_cohorts" c
      LEFT JOIN "organization_members" m ON m."cohort_id" = c.id AND m.status = 'active'
      LEFT JOIN (
        SELECT "cohort_id", SUM(GREATEST("max_uses" - "used_count", 0))::bigint AS "pendingSeatCount"
        FROM "organization_invites"
        WHERE status = 'pending'
          AND "cohort_id" = ${cohortId}
          AND (${excludedInviteId}::int IS NULL OR id <> ${excludedInviteId})
          AND ("expires_at" IS NULL OR "expires_at" > CURRENT_TIMESTAMP)
        GROUP BY "cohort_id"
      ) pending ON pending."cohort_id" = c.id
      WHERE c.id = ${cohortId}
        AND c."organization_id" = ${organizationId}
        AND c.status <> 'archived'
      GROUP BY c.id, pending."pendingSeatCount"
      LIMIT 1
    `);
    const row = rows[0];
    const seatLimit = cohortSeatLimit(row?.metadata);
    if (seatLimit === null) return;
    const occupied = Number(row.memberCount) + Number(row.pendingSeatCount);
    const remaining = seatLimit - occupied;
    if (requestedSeats > remaining) {
      throw new BadRequestException(`班级剩余席位不足：剩余 ${Math.max(0, remaining)}，本次需要 ${requestedSeats}。`);
    }
  }

  private async assertCohortAcceptCapacity(tx: Prisma.TransactionClient, organizationId: number, cohortId: number | null, userId: number) {
    if (!cohortId) return;
    const existingMembers = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id
      FROM "organization_members"
      WHERE "organization_id" = ${organizationId}
        AND "user_id" = ${userId}
        AND "cohort_id" = ${cohortId}
        AND status = 'active'
      LIMIT 1
    `);
    if (existingMembers[0]) return;
    const rows = await tx.$queryRaw<Array<{ id: number; metadata: unknown }>>(Prisma.sql`
      SELECT c.id, c.metadata
      FROM "organization_cohorts" c
      WHERE c.id = ${cohortId}
        AND c."organization_id" = ${organizationId}
      FOR UPDATE OF c
    `);
    const row = rows[0];
    const seatLimit = cohortSeatLimit(row?.metadata);
    if (seatLimit === null) return;
    const counts = await tx.$queryRaw<Array<{ memberCount: bigint }>>(Prisma.sql`
      SELECT COUNT(id)::bigint AS "memberCount"
      FROM "organization_members"
      WHERE "cohort_id" = ${cohortId}
        AND status = 'active'
    `);
    if (Number(counts[0]?.memberCount ?? 0) >= seatLimit) {
      throw new BadRequestException('班级席位已满，请联系老师或管理员。');
    }
  }

  private async ensureNoActiveInvite(organizationId: number, email: string | null, role: string, cohortId: number | null) {
    const rows = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id
      FROM "organization_invites"
      WHERE "organization_id" = ${organizationId}
        AND email IS NOT DISTINCT FROM ${email}
        AND role = ${role}
        AND "cohort_id" IS NOT DISTINCT FROM ${cohortId}
        AND status = 'pending'
        AND ("expires_at" IS NULL OR "expires_at" > CURRENT_TIMESTAMP)
        AND "used_count" < "max_uses"
      LIMIT 1
    `);
    if (rows[0]) {
      throw new BadRequestException(`${email ?? '通用邀请'} 已有未使用邀请，请在邀请历史里重新生成，或先归档旧邀请后再创建。`);
    }
  }

  private async ensureCohortBySlug(organizationId: number, slug: string, name: string) {
    const existing = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id FROM "organization_cohorts"
      WHERE "organization_id" = ${organizationId} AND slug = ${slug}
      LIMIT 1
    `);
    if (existing[0]) return existing[0].id;
    const created = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "organization_cohorts" ("organization_id", slug, name, status)
      VALUES (${organizationId}, ${slug}, ${name}, 'active')
      RETURNING id
    `);
    return created[0]?.id ?? null;
  }

  private async enrichOrganizations<T extends { id: number; members?: Array<{ id: number; userId: number; role: string; status: string; user?: { email: string | null; loginName: string | null } | null }> }>(items: T[]) {
    if (items.length === 0) return items;
    const ids = items.map((item) => item.id);
    const cohorts = await this.prisma.$queryRaw<Array<{ id: number; organizationId: number; slug: string; name: string; status: string; memberCount: bigint; pendingSeatCount: bigint; metadata: unknown; createdAt: Date; updatedAt: Date }>>(Prisma.sql`
      SELECT c.id, c."organization_id" AS "organizationId", c.slug, c.name, c.status,
        COUNT(m.id)::bigint AS "memberCount",
        COALESCE(pending."pendingSeatCount", 0)::bigint AS "pendingSeatCount",
        c.metadata,
        c."created_at" AS "createdAt", c."updated_at" AS "updatedAt"
      FROM "organization_cohorts" c
      LEFT JOIN "organization_members" m ON m."cohort_id" = c.id AND m.status = 'active'
      LEFT JOIN (
        SELECT "cohort_id", SUM(GREATEST("max_uses" - "used_count", 0))::bigint AS "pendingSeatCount"
        FROM "organization_invites"
        WHERE status = 'pending'
          AND "cohort_id" IS NOT NULL
          AND ("expires_at" IS NULL OR "expires_at" > CURRENT_TIMESTAMP)
        GROUP BY "cohort_id"
      ) pending ON pending."cohort_id" = c.id
      WHERE c."organization_id" IN (${Prisma.join(ids)})
      GROUP BY c.id, pending."pendingSeatCount"
      ORDER BY c."updated_at" DESC, c.id DESC
    `);
    const invites = await this.prisma.$queryRaw<Array<{
      id: number;
      organizationId: number;
      email: string | null;
      role: string;
      status: string;
      cohortId: number | null;
      maxUses: number;
      usedCount: number;
      expiresAt: Date | null;
      createdBy: number | null;
      acceptedBy: number | null;
      acceptedAt: Date | null;
      creatorEmail: string | null;
      accepterEmail: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT i.id, i."organization_id" AS "organizationId", i.email, i.role, i.status, i."cohort_id" AS "cohortId",
        i."max_uses" AS "maxUses", i."used_count" AS "usedCount", i."expires_at" AS "expiresAt",
        i."created_by" AS "createdBy", i."accepted_by" AS "acceptedBy", i."accepted_at" AS "acceptedAt",
        COALESCE(creator.email, creator."login_name") AS "creatorEmail",
        COALESCE(accepter.email, accepter."login_name") AS "accepterEmail",
        i."created_at" AS "createdAt", i."updated_at" AS "updatedAt"
      FROM "organization_invites" i
      LEFT JOIN "users" creator ON creator.id = i."created_by"
      LEFT JOIN "users" accepter ON accepter.id = i."accepted_by"
      WHERE i."organization_id" IN (${Prisma.join(ids)}) AND i.status <> 'archived'
      ORDER BY i."updated_at" DESC, i.id DESC
      LIMIT 300
    `);
    const inviteAttempts = await this.prisma.$queryRaw<Array<{
      id: number;
      organizationId: number;
      userId: number | null;
      userEmail: string | null;
      inviteId: number | null;
      inviteEmail: string | null;
      inviteRole: string | null;
      cohortId: number | null;
      cohortName: string | null;
      lookupMode: string;
      status: string;
      reason: string | null;
      createdAt: Date;
    }>>(Prisma.sql`
      SELECT a.id, i."organization_id" AS "organizationId",
        a."user_id" AS "userId",
        COALESCE(u.email, u."login_name") AS "userEmail",
        a."invite_id" AS "inviteId",
        i.email AS "inviteEmail",
        i.role AS "inviteRole",
        i."cohort_id" AS "cohortId",
        c.name AS "cohortName",
        a."lookup_mode" AS "lookupMode",
        a.status,
        a.reason,
        a."created_at" AS "createdAt"
      FROM "organization_invite_attempts" a
      JOIN "organization_invites" i ON i.id = a."invite_id"
      LEFT JOIN "users" u ON u.id = a."user_id"
      LEFT JOIN "organization_cohorts" c ON c.id = i."cohort_id"
      WHERE i."organization_id" IN (${Prisma.join(ids)})
      ORDER BY a."created_at" DESC, a.id DESC
      LIMIT 300
    `);
    const memberCohorts = await this.prisma.$queryRaw<Array<{ memberId: number; cohortId: number; slug: string; name: string }>>(Prisma.sql`
      SELECT m.id AS "memberId", c.id AS "cohortId", c.slug, c.name
      FROM "organization_members" m
      JOIN "organization_cohorts" c ON c.id = m."cohort_id"
      WHERE m."organization_id" IN (${Prisma.join(ids)})
    `);
    return items.map((item) => {
      const cohortByMember = new Map(memberCohorts.map((row) => [row.memberId, row]));
      return {
        ...item,
        members: (item.members ?? []).map((member) => {
          const cohort = cohortByMember.get(member.id);
          return {
            ...member,
            cohortId: cohort?.cohortId ?? null,
            cohort: cohort ? { id: cohort.cohortId, slug: cohort.slug, name: cohort.name } : null
          };
        }),
        cohorts: cohorts
          .filter((cohort) => cohort.organizationId === item.id)
          .map((cohort) => {
            const memberCount = Number(cohort.memberCount);
            const pendingSeatCount = Number(cohort.pendingSeatCount);
            const seatLimit = cohortSeatLimit(cohort.metadata);
            return {
              ...cohort,
              memberCount,
              pendingSeatCount,
              seatLimit,
              remainingSeats: seatLimit === null ? null : Math.max(0, seatLimit - memberCount - pendingSeatCount)
            };
          }),
        invites: invites.filter((invite) => invite.organizationId === item.id),
        inviteAttempts: inviteAttempts.filter((attempt) => attempt.organizationId === item.id)
      };
    });
  }

  private async normalizeMemberImportRows(organizationId: number, body: Record<string, unknown>) {
    const rawRows = parseMemberImportRows(body);
    const rows = rawRows.map(({ rowNumber, row }) => {
      const userId = parseOptionalPositiveInt(row.userId ?? row.user_id ?? row.userid, `第 ${rowNumber} 行用户 ID`);
      const email = cleanOptionalEmail(row.email ?? row.mail);
      const role = cleanRole(row.role);
      const cohortSlug = cleanCohortSlug(row.cohortSlug ?? row.cohort_slug ?? row.group ?? row.class);
      const cohortName = cleanText(row.cohortName ?? row.cohort_name ?? row.groupName ?? cohortSlug ?? '', 200) || cohortSlug;
      const errors: string[] = [];
      if (!userId && !email) errors.push('需要 userId 或 email。');
      return {
        rowNumber,
        userId,
        email,
        role,
        cohortSlug,
        cohortName,
        cohortId: null as number | null,
        action: 'skip' as 'skip' | 'upsert_member' | 'create_invite',
        existingMember: false,
        userFound: false,
        errors
      };
    });
    const userIds = rows.map((row) => row.userId).filter((value): value is number => Boolean(value));
    const emails = rows.map((row) => row.email).filter((value): value is string => Boolean(value));
    const usersById = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, loginName: true } })
      : [];
    const usersByEmail = emails.length
      ? await this.prisma.user.findMany({
        where: { OR: [{ email: { in: emails } }, { loginName: { in: emails } }] },
        select: { id: true, email: true, loginName: true }
      })
      : [];
    const members = userIds.length || usersByEmail.length
      ? await this.prisma.organizationMember.findMany({
        where: { organizationId, userId: { in: Array.from(new Set([...userIds, ...usersByEmail.map((user) => user.id)])) } },
        select: { userId: true, status: true }
      })
      : [];
    const idMap = new Map(usersById.map((user) => [user.id, user]));
    const emailMap = new Map(usersByEmail.flatMap((user) => [user.email, user.loginName].filter(Boolean).map((email) => [normalizeEmail(email), user] as const)));
    const memberMap = new Map(members.map((member) => [member.userId, member]));
    return rows.map((row) => {
      const user = row.userId ? idMap.get(row.userId) : row.email ? emailMap.get(row.email) : null;
      if (row.userId && !user) row.errors.push('用户 ID 不存在。');
      row.userId = user?.id ?? row.userId;
      row.userFound = Boolean(user);
      row.existingMember = Boolean(row.userId && memberMap.get(row.userId));
      row.action = row.errors.length > 0 ? 'skip' : user ? 'upsert_member' : 'create_invite';
      return row;
    });
  }

  private async ensureAccount(userId: number) {
    const initial = this.initialFreeUnits();
    return this.prisma.cscaAIEntitlementAccount.upsert({
      where: { userId },
      create: {
        userId,
        balanceUnits: initial,
        lifetimeGranted: initial
      },
      update: {}
    });
  }

  private async activeOrganizationEntitlement(userId: number) {
    const prismaRecord = this.prisma as unknown as Record<string, unknown>;
    if (!prismaRecord.organizationMember) return null;
    const profilePromise = prismaRecord.studentProfile
      ? this.prisma.studentProfile.findUnique({
          where: { userId },
          select: { currentOrganizationId: true }
        })
      : Promise.resolve(null);
    const [profile, rows] = await Promise.all([
      profilePromise,
      this.prisma.organizationMember.findMany({
        where: {
          userId,
          status: 'active',
          organization: {
            status: 'active',
            aiCreditPool: {
              status: 'active',
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            }
          }
        },
        include: {
          organization: {
            include: {
              aiCreditPool: true,
              llmProviderConfigs: {
                where: { status: 'active' },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                take: 1
              }
            }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 10
      })
    ]);
    const eligibleRows = rows.filter((row) => organizationRoleAllows(row.role, 'use_ai_pool'));
    const membership = profile?.currentOrganizationId
      ? eligibleRows.find((row) => row.organizationId === profile.currentOrganizationId) ?? null
      : eligibleRows[0] ?? null;
    const pool = membership?.organization.aiCreditPool;
    if (!membership || !pool) return null;
    return {
      organizationId: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
      poolId: pool.id,
      availableCredits: pool.availableCredits,
      reservedCredits: pool.reservedCredits,
      perUserDailyLimit: pool.perUserDailyLimit,
      expiresAt: pool.expiresAt,
      providerConfig: membership.organization.llmProviderConfigs[0] ?? null
    };
  }

  private async organizationUsageToday(userId: number, organizationId: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.cscaAIUsageLedger.count({
      where: {
        userId,
        status: 'posted',
        unitsDelta: -1,
        createdAt: { gte: start },
        metadata: {
          path: ['organizationId'],
          equals: organizationId
        }
      }
    });
  }

  private async reserveOrganizationCredit(userId: number, abilityType: string, input: AIReservationProviderInput, organization: {
    organizationId: number;
    poolId: number;
    availableCredits: number;
  }): Promise<AIReservation> {
    const result = await this.prisma.$transaction(async (tx) => {
      const pool = await tx.organizationAiCreditPool.findFirst({
        where: {
          id: organization.poolId,
          status: 'active',
          availableCredits: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      });
      if (!pool) return { allowed: false, balanceUnits: 0 };
      const updated = await tx.organizationAiCreditPool.update({
        where: { id: pool.id },
        data: {
          availableCredits: { decrement: 1 },
          reservedCredits: { increment: 1 }
        }
      });
      const ledger = await tx.cscaAIUsageLedger.create({
        data: {
          userId,
          abilityType,
          provider: input.provider ?? null,
          model: input.model ?? null,
          unitsDelta: -1,
          reason: 'organization_reserve',
          status: 'reserved',
          metadata: {
            organizationId: organization.organizationId,
            organizationCreditPoolId: organization.poolId,
            poolBalanceAfterReserve: updated.availableCredits,
            organizationProviderConfigId: input.providerConfigId ?? null,
            source: 'organization_credit_pool'
          }
        }
      });
      return { allowed: true, ledgerId: ledger.id, balanceUnits: updated.availableCredits };
    });
    if (!result.allowed) {
      await this.writeDeniedLedger(userId, abilityType, input, 'organization_pool_empty', {
        organizationId: organization.organizationId,
        organizationCreditPoolId: organization.poolId
      });
      return {
        allowed: false,
        organizationId: organization.organizationId,
        organizationCreditPoolId: organization.poolId,
        balanceUnits: result.balanceUnits,
        reason: 'organization_pool_empty',
        source: 'organization'
      };
    }
    return {
      allowed: true,
      ledgerId: result.ledgerId,
      organizationId: organization.organizationId,
      organizationCreditPoolId: organization.poolId,
      balanceUnits: result.balanceUnits,
      source: 'organization'
    };
  }

  private async writeDeniedLedger(userId: number, abilityType: string, input: AIReservationProviderInput, reason: string, metadata: Record<string, unknown> = {}) {
    await this.prisma.cscaAIUsageLedger.create({
      data: {
        userId,
        accountId: typeof metadata.accountId === 'number' ? metadata.accountId : null,
        abilityType,
        provider: input.provider ?? null,
        model: input.model ?? null,
        unitsDelta: 0,
        reason,
        status: 'denied',
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async isUnlimitedUser(userId: number) {
    const unlimitedEmails = readUnlimitedAIEmails();
    if (!unlimitedEmails.size) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, loginName: true }
    });
    return unlimitedEmails.has(normalizeEmail(user?.email)) || unlimitedEmails.has(normalizeEmail(user?.loginName));
  }
}
