import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { createHash, createHmac, createPublicKey, createVerify, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { assertActorId, assertEmail, assertEnumValue, assertPassword, assertRecord, assertRequiredString } from '../common/validation';
import { assertRateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.service';
import { sendAuthEmail } from './auth-email.sender';
import { AdminUserCreateInput, AuthPayload, AuthResult, ForgotPasswordInput, MePasswordUpdateInput, MeProfileUpdateInput, ResetPasswordInput } from './auth.types';

const scrypt = promisify(scryptCallback);
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const LOCAL_AUTH_SECRET = 'moodlelike-local-development-secret-change-before-production';
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_USER_STATUS_LOCK_NAMESPACE = 43021;
const GOOGLE_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_OAUTH_PROVIDER = 'google';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const EMAIL_VERIFICATION_TOKEN_TYPE = 'email_verification';
const PASSWORD_RESET_TOKEN_TYPE = 'password_reset';
const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

type TokenType = 'access' | 'refresh';
type AuthEmailTokenType = typeof EMAIL_VERIFICATION_TOKEN_TYPE | typeof PASSWORD_RESET_TOKEN_TYPE;

type TokenPayload = {
  sub: number;
  email: string;
  role: string;
  type: TokenType;
  exp: number;
  iat: number;
  sid?: string;
};

type GoogleOAuthState = {
  state: string;
  codeVerifier: string;
  redirectTo: string;
  mode?: 'login' | 'link';
  userId?: number;
  iat: number;
  exp: number;
};

type GoogleIdTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
};

type GoogleJwk = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
};

function getAuthSecret() {
  // Local fallback keeps the rebuilt app usable; production must set AUTH_SECRET.
  return process.env.AUTH_SECRET || LOCAL_AUTH_SECRET;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signTokenPayload(encodedPayload: string) {
  return createHmac('sha256', getAuthSecret()).update(encodedPayload).digest('base64url');
}

function signaturesMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function assertValidPayload(payload: AuthPayload, minPasswordLength = 8) {
  const record = assertRecord(payload, '请输入邮箱和密码。');
  const email = assertEmail(record.email);
  const password = assertPassword(record.password, minPasswordLength, `密码至少需要 ${minPasswordLength} 位。`);
  return { email, password };
}

function extractBearerToken(authorization?: string) {
  const [scheme, token] = authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedException('请先登录。');
  }
  return token;
}

function buildRateKey(action: string, emailOrToken: string) {
  return `auth:${action}:${emailOrToken.toLowerCase().slice(0, 120)}`;
}

function normalizeUserAgent(userAgent?: string) {
  const value = userAgent?.trim();
  return value ? value.slice(0, 255) : undefined;
}

function assertTokenPayload(value: unknown, expectedType: TokenType): TokenPayload {
  const payload = assertRecord(value, '登录状态已失效。');
  const sub = payload.sub;
  const exp = payload.exp;
  const iat = payload.iat;
  const email = payload.email;
  const role = payload.role;
  const type = payload.type;

  if (!Number.isInteger(sub) || Number(sub) < 1) {
    throw new UnauthorizedException('登录状态已失效。');
  }
  if (!Number.isInteger(exp) || Number(exp) < 1 || Number(exp) < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedException('登录状态已过期。');
  }
  if (!Number.isInteger(iat) || Number(iat) < 1 || Number(iat) > Math.floor(Date.now() / 1000) + 60) {
    throw new UnauthorizedException('登录状态已失效。');
  }
  if (typeof email !== 'string' || typeof role !== 'string') {
    throw new UnauthorizedException('登录状态已失效。');
  }
  if (type !== expectedType) {
    throw new UnauthorizedException(expectedType === 'refresh' ? '请使用刷新令牌。' : '请重新登录。');
  }
  if (expectedType === 'refresh' && (typeof payload.sid !== 'string' || payload.sid.length < 16 || payload.sid.length > 160)) {
    throw new UnauthorizedException('请重新登录。');
  }

  return { sub: Number(sub), email, role, type: expectedType, exp: Number(exp), iat: Number(iat), sid: typeof payload.sid === 'string' ? payload.sid : undefined };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password: string, passwordHash: string) {
  const [method, salt, storedKey] = passwordHash.split(':');
  if (method !== 'scrypt' || !salt || !storedKey) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(storedKey, 'hex');
  return key.length === stored.length && timingSafeEqual(key, stored);
}

function getGoogleClientId() {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!value) throw new BadRequestException('Google 登录暂未配置。');
  return value;
}

function getGoogleClientSecret() {
  const value = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!value) throw new BadRequestException('Google 登录暂未配置。');
  return value;
}

function getGoogleRedirectUri() {
  const value = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!value) throw new BadRequestException('Google 登录回调地址暂未配置。');
  return value;
}

function getPublicAppOrigin() {
  const origin = process.env.PUBLIC_APP_ORIGIN?.trim() || 'http://localhost:5174';
  try {
    return new URL(origin).origin;
  } catch {
    throw new BadRequestException('前端地址配置不正确。');
  }
}

function getPublicApiOrigin() {
  const origin = process.env.PUBLIC_API_ORIGIN?.trim() || process.env.API_BASE_URL?.trim() || 'http://localhost:3000';
  try {
    return new URL(origin).origin;
  } catch {
    throw new BadRequestException('后端公开地址配置不正确。');
  }
}

function sanitizeLocalRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '/me';
  const redirect = value.trim();
  if (!redirect.startsWith('/') || redirect.startsWith('//') || /[\u0000-\u001f\u007f]/.test(redirect) || redirect.includes('\\')) {
    return '/me';
  }
  if (/^\/\s*javascript:/i.test(redirect)) return '/me';
  return redirect.slice(0, 300);
}

function buildFrontendUrl(path: string) {
  return new URL(sanitizeLocalRedirect(path), getPublicAppOrigin()).toString();
}

function buildAuthErrorRedirect(error: string, redirectTo = '/me') {
  const url = new URL('/auth', getPublicAppOrigin());
  url.searchParams.set('error', error);
  const safeRedirect = sanitizeLocalRedirect(redirectTo);
  if (safeRedirect !== '/me') url.searchParams.set('redirect', safeRedirect);
  return url.toString();
}

function buildBackendUrl(path: string) {
  return new URL(path, getPublicApiOrigin()).toString();
}

function signOpaqueValue(encodedPayload: string) {
  return createHmac('sha256', getAuthSecret()).update(encodedPayload).digest('base64url');
}

function encodeSignedJson(value: unknown) {
  const encodedPayload = toBase64Url(JSON.stringify(value));
  return `${encodedPayload}.${signOpaqueValue(encodedPayload)}`;
}

function decodeSignedJson<T>(token: string, message: string): T {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || !signaturesMatch(signOpaqueValue(encodedPayload), signature)) {
    throw new BadRequestException(message);
  }
  try {
    return JSON.parse(fromBase64Url(encodedPayload)) as T;
  } catch {
    throw new BadRequestException(message);
  }
}

function buildPkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function decodeJwtPart<T>(value: string, message: string): T {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    throw new UnauthorizedException(message);
  }
}

function safeString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function hashEmailToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(payload: AuthPayload, userAgent?: string): Promise<AuthResult> {
    const { email, password } = assertValidPayload(payload, 1);
    await assertRateLimit(buildRateKey('login', email), 8, AUTH_WINDOW_MS, '登录尝试过于频繁，请稍后再试。');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('邮箱或密码不正确。');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('这个账号使用 Google 登录。请使用 Google 登录，或登录后设置密码。');
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码不正确。');
    }
    if (user.status === 'disabled') {
      throw new ForbiddenException('账号已停用，请联系管理员。');
    }
    return this.buildAuthResult(user, userAgent);
  }

  async register(payload: AuthPayload, userAgent?: string): Promise<AuthResult> {
    const { email, password } = assertValidPayload(payload);
    await assertRateLimit(buildRateKey('register', email), 4, AUTH_WINDOW_MS, '注册尝试过于频繁，请稍后再试。');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('这个邮箱已经注册。');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'student',
        displayName: email.split('@')[0]
      }
    });
    const verificationEmailSent = await this.sendEmailVerification(user);
    return {
      ...await this.buildAuthResult(user, userAgent),
      verificationEmailSent
    };
  }

  createGoogleOAuthStart(redirect: unknown, options: { mode?: 'login' | 'link'; userId?: number } = {}) {
    const state = randomBytes(24).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const redirectTo = sanitizeLocalRedirect(redirect);
    const stateCookie = encodeSignedJson({
      state,
      codeVerifier,
      redirectTo,
      mode: options.mode ?? 'login',
      ...(options.userId ? { userId: options.userId } : {}),
      iat: now,
      exp: now + GOOGLE_OAUTH_STATE_TTL_SECONDS
    });
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set('client_id', getGoogleClientId());
    url.searchParams.set('redirect_uri', getGoogleRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', buildPkceChallenge(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return { authorizationUrl: url.toString(), stateCookie };
  }

  createGoogleOAuthLinkStart(user: PrismaUser, redirect: unknown) {
    const redirectTo = sanitizeLocalRedirect(redirect || '/me?section=settings');
    return this.createGoogleOAuthStart(redirectTo, { mode: 'link', userId: user.id });
  }

  async completeGoogleOAuth(input: { code?: unknown; state?: unknown; stateCookie?: string; userAgent?: string }) {
    const oauthState = this.verifyGoogleOAuthState(input.stateCookie, input.state);
    const code = typeof input.code === 'string' ? input.code : '';
    if (!code) {
      throw new BadRequestException('Google 登录授权码无效。');
    }
    const idToken = await this.exchangeGoogleAuthorizationCode(code, oauthState.codeVerifier);
    const googleUser = await this.verifyGoogleIdToken(idToken);
    const resolution = oauthState.mode === 'link'
      ? { user: await this.linkGoogleUser(oauthState.userId, googleUser), isNew: false }
      : await this.resolveGoogleUser(googleUser);
    const user = resolution.user;
    if (user.status === 'disabled') {
      throw new ForbiddenException('账号已停用，请联系管理员。');
    }
    return {
      redirectTo: oauthState.mode === 'link'
        ? this.addGoogleLinkedMarker(oauthState.redirectTo)
        : resolution.isNew
          ? `/onboarding?returnTo=${encodeURIComponent(oauthState.redirectTo)}`
          : oauthState.redirectTo,
      result: await this.buildAuthResult(user, input.userAgent)
    };
  }

  buildOAuthSuccessRedirect(path: string) {
    const url = new URL(buildFrontendUrl(path));
    url.searchParams.set('auth', 'google');
    return url.toString();
  }

  private addGoogleLinkedMarker(path: string) {
    const url = new URL(path, 'https://moodlelike.local');
    url.searchParams.set('linked', 'google');
    url.searchParams.set('section', 'settings');
    return `${url.pathname}${url.search}${url.hash}`;
  }

  buildOAuthErrorRedirect(error: string, redirectTo = '/me') {
    return buildAuthErrorRedirect(error, redirectTo);
  }

  buildEmailVerificationSuccessRedirect() {
    return buildFrontendUrl('/me?verified=email');
  }

  buildEmailVerificationErrorRedirect() {
    return buildAuthErrorRedirect('email_verification_failed');
  }

  async resendEmailVerificationForUser(user: PrismaUser) {
    if (user.emailVerifiedAt) {
      return { sent: false, alreadyVerified: true };
    }
    await assertRateLimit(buildRateKey('resend-email-verification', user.email ?? String(user.id)), 3, AUTH_WINDOW_MS, '验证邮件发送过于频繁，请稍后再试。');
    const sent = await this.sendEmailVerification(user, { throwOnFailure: true });
    return { sent, alreadyVerified: false };
  }

  async verifyEmailToken(token: unknown) {
    const rawToken = assertRequiredString(token, '验证链接无效。', 500);
    const authToken = await this.prisma.authEmailToken.findUnique({ where: { tokenHash: hashEmailToken(rawToken) } });
    if (!authToken || authToken.type !== EMAIL_VERIFICATION_TOKEN_TYPE || authToken.usedAt || authToken.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('验证链接无效或已过期。');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.authEmailToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() }
      });
      await tx.user.update({
        where: { id: authToken.userId },
        data: { emailVerifiedAt: new Date() }
      });
    });
    return { verified: true };
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const record = assertRecord(input, '请输入邮箱。');
    const email = assertEmail(record.email);
    await assertRateLimit(buildRateKey('forgot-password', email), 4, AUTH_WINDOW_MS, '密码重置邮件发送过于频繁，请稍后再试。');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      await this.sendPasswordReset(user);
    }
    return { sent: true };
  }

  async resetPassword(input: ResetPasswordInput) {
    const record = assertRecord(input, '重置链接和新密码不能为空。');
    const rawToken = assertRequiredString(record.token, '重置链接无效。', 500);
    const password = assertPassword(record.password, 8, '新密码至少需要 8 位。');
    await assertRateLimit(buildRateKey('reset-password', rawToken.slice(-32)), 8, AUTH_WINDOW_MS, '密码重置尝试过于频繁，请稍后再试。');
    const authToken = await this.prisma.authEmailToken.findUnique({ where: { tokenHash: hashEmailToken(rawToken) } });
    if (!authToken || authToken.type !== PASSWORD_RESET_TOKEN_TYPE || authToken.usedAt || authToken.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('重置链接无效或已过期。');
    }
    const nextPasswordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authToken.userId },
        data: { passwordHash: nextPasswordHash }
      });
      await tx.authEmailToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() }
      });
      await tx.refreshSession.updateMany({
        where: { userId: authToken.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });
    return { reset: true };
  }

  async refresh(authorization?: string, userAgent?: string) {
    const token = extractBearerToken(authorization);
    return this.refreshToken(token, userAgent);
  }

  async refreshToken(token: string, userAgent?: string) {
    await assertRateLimit(buildRateKey('refresh', token.slice(-32)), 20, AUTH_WINDOW_MS, '刷新登录状态过于频繁，请稍后再试。');
    const payload = this.verifyToken(token, 'refresh');
    const user = await this.requireActiveUser(payload.sub);
    const session = await this.requireRefreshSession(payload, userAgent);
    return this.refreshForUser(user, payload.sid as string, session.expiresAt);
  }

  refreshForUser(user: PrismaUser, sid: string, expiresAt: Date) {
    const ttlSeconds = Math.max(1, Math.floor(expiresAt.getTime() / 1000) - Math.floor(Date.now() / 1000));
    return {
      tokens: {
        accessToken: this.signUser(user, 'access'),
        refreshToken: this.signUser(user, 'refresh', ttlSeconds, sid)
      }
    };
  }

  async logout(authorization?: string) {
    const token = extractBearerToken(authorization);
    return this.logoutToken(token);
  }

  async logoutToken(token: string) {
    const payload = this.verifyToken(token, 'refresh');
    await this.prisma.refreshSession.updateMany({
      where: {
        sessionHash: this.hashRefreshSessionId(payload.sid as string),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
    return { revoked: true };
  }

  async logoutAllForUser(userId: number) {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
    return { revoked: true };
  }

  async me(authorization?: string) {
    const user = await this.requireUser(authorization);
    return this.meForUser(user);
  }

  async meForUser(user: PrismaUser) {
    return this.serializeUser(user);
  }

  async updateMeProfile(authorization: string | undefined, input: MeProfileUpdateInput) {
    const user = await this.requireUser(authorization);
    return this.updateMeProfileForUser(user.id, input);
  }

  async updateMeProfileForUser(userId: number, input: MeProfileUpdateInput) {
    const record = assertRecord(input, '显示名不能为空。');
    const displayName = assertRequiredString(record.displayName, '显示名不能为空。', 40);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName }
    });
    return this.serializeUser(updated);
  }

  async updateMePassword(authorization: string | undefined, input: MePasswordUpdateInput) {
    const user = await this.requireUser(authorization);
    return this.updateMePasswordForUser(user, input);
  }

  async updateMePasswordForUser(user: PrismaUser, input: MePasswordUpdateInput) {
    const record = assertRecord(input, '请输入新密码。');
    const newPassword = assertPassword(record.newPassword, 8, '新密码至少需要 8 位。');
    if (user.passwordHash) {
      const currentPassword = assertPassword(record.currentPassword, 1, '请输入当前密码。');
      if (currentPassword === newPassword) {
        throw new BadRequestException('新密码不能和当前密码相同。');
      }
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new BadRequestException('当前密码不正确。');
      }
    } else if (!user.emailVerifiedAt) {
      throw new BadRequestException('请先完成邮箱验证。');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) }
    });
    return { updated: true };
  }

  async getRequiredUser(authorization?: string) {
    return this.requireUser(authorization);
  }

  async getRequiredVerifiedUser(authorization?: string) {
    const user = await this.requireUser(authorization);
    return this.requireEmailVerifiedUser(user);
  }

  async getRequiredAdmin(authorization?: string) {
    const user = await this.getRequiredVerifiedUser(authorization);
    if (user.role !== 'admin') {
      throw new ForbiddenException('需要管理员账号。');
    }
    return user;
  }

  async getOptionalUser(authorization?: string) {
    if (!authorization) return null;
    try {
      return await this.requireUser(authorization);
    } catch {
      return null;
    }
  }

  async listAdminUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        cscaAIEntitlementAccount: {
          select: {
            balanceUnits: true,
            lifetimeGranted: true,
            lifetimeUsed: true
          }
        }
      }
    });
    return {
      items: users.map((user) => ({
        id: String(user.id),
        email: user.email ?? user.loginName ?? `user-${user.id}@moodlelike.local`,
        role: user.role,
        status: user.status,
        aiBalanceUnits: user.cscaAIEntitlementAccount?.balanceUnits ?? 0,
        aiLifetimeGranted: user.cscaAIEntitlementAccount?.lifetimeGranted ?? 0,
        aiLifetimeUsed: user.cscaAIEntitlementAccount?.lifetimeUsed ?? 0,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      })),
      mode: 'admin-ops'
    };
  }

  async createAdminUser(input: AdminUserCreateInput, actorId?: number) {
    const safeActorId = assertActorId(actorId);
    const { email, password } = assertValidPayload(input);
    await assertRateLimit(buildRateKey('admin-create-user', email), 5, AUTH_WINDOW_MS, '创建管理员账号过于频繁，请稍后再试。');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('这个邮箱已经存在。');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'admin',
        status: 'active',
        displayName: typeof input.displayName === 'string' && input.displayName.trim() ? input.displayName.trim().slice(0, 40) : email.split('@')[0]
      }
    });
    await this.sendEmailVerification(user);
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'users',
      resourceType: 'user',
      resourceId: user.id,
      action: 'user.create_admin',
      after: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
    return {
      id: String(user.id),
      email: user.email ?? email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async setUserStatus(targetId: number, status: 'active' | 'disabled', actorId: number) {
    const safeActorId = assertActorId(actorId);
    const safeStatus = assertEnumValue(status, ['active', 'disabled'] as const, '用户状态不正确。');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_USER_STATUS_LOCK_NAMESPACE}::int, 1::int)`;
      const existing = await tx.user.findUnique({ where: { id: targetId } });
      if (!existing) {
        throw new BadRequestException('用户不存在。');
      }
      if (targetId === safeActorId && safeStatus === 'disabled') {
        throw new BadRequestException('不能停用当前登录的管理员。');
      }
      if (existing.role === 'admin' && safeStatus === 'disabled' && existing.status === 'active') {
        const activeAdmins = await tx.user.count({ where: { role: 'admin', status: 'active' } });
        if (activeAdmins <= 1) {
          throw new BadRequestException('不能停用最后一个 active admin。');
        }
      }
      const next = await tx.user.update({
        where: { id: targetId },
        data: { status: safeStatus }
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: safeActorId,
          module: 'users',
          resourceType: 'user',
          resourceId: String(targetId),
          action: 'user.status_change',
          before: {
            id: existing.id,
            email: existing.email,
            role: existing.role,
            status: existing.status
          } as never,
          after: {
            id: next.id,
            email: next.email,
            role: next.role,
            status: next.status
          } as never
        }
      });
      return next;
    });
    return {
      id: String(updated.id),
      email: updated.email ?? updated.loginName ?? `user-${updated.id}@moodlelike.local`,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  private async requireUser(authorization?: string, tokenType: TokenType = 'access') {
    const token = extractBearerToken(authorization);
    const payload = this.verifyToken(token, tokenType);
    return this.requireActiveUser(payload.sub);
  }

  private async requireActiveUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('登录状态已失效。');
    }
    if (user.status === 'disabled') {
      throw new ForbiddenException('账号已停用，请联系管理员。');
    }
    return user;
  }

  private requireEmailVerifiedUser(user: PrismaUser) {
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'email_unverified',
        message: '请先验证邮箱后继续使用。'
      });
    }
    return user;
  }

  private async requireRefreshSession(payload: TokenPayload, userAgent?: string) {
    const sessionHash = this.hashRefreshSessionId(payload.sid as string);
    const session = await this.prisma.refreshSession.findUnique({ where: { sessionHash } });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('请重新登录。');
    }
    await this.prisma.refreshSession.update({
      where: { sessionHash },
      data: {
        lastUsedAt: new Date(),
        ...(userAgent ? { userAgent: normalizeUserAgent(userAgent) } : {})
      }
    });
    return session;
  }

  private async buildAuthResult(user: PrismaUser, userAgent?: string): Promise<AuthResult> {
    const session = await this.createRefreshSession(user, userAgent);
    return {
      user: await this.serializeUser(user),
      tokens: {
        accessToken: this.signUser(user, 'access'),
        refreshToken: this.signUser(user, 'refresh', REFRESH_TOKEN_TTL_SECONDS, session.sid)
      }
    };
  }

  private async serializeUser(user: PrismaUser) {
    const googleLinked = await this.prisma.oAuthAccount.count({
      where: {
        userId: user.id,
        provider: GOOGLE_OAUTH_PROVIDER
      }
    });
    return {
      id: String(user.id),
      email: user.email ?? user.loginName ?? `user-${user.id}@moodlelike.local`,
      role: user.role,
      displayName: user.displayName ?? undefined,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
      emailVerificationSentAt: user.emailVerificationSentAt?.toISOString(),
      passwordConfigured: Boolean(user.passwordHash),
      googleLinked: googleLinked > 0
    };
  }

  private async createAuthEmailToken(userId: number, type: AuthEmailTokenType, ttlSeconds: number) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.authEmailToken.create({
      data: {
        userId,
        type,
        tokenHash: hashEmailToken(token),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000)
      }
    });
    return token;
  }

  private async sendEmailVerification(user: PrismaUser, options: { throwOnFailure?: boolean } = {}) {
    const email = user.email;
    if (!email || user.emailVerifiedAt) return false;
    const token = await this.createAuthEmailToken(user.id, EMAIL_VERIFICATION_TOKEN_TYPE, EMAIL_VERIFICATION_TTL_SECONDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationSentAt: new Date() }
    });
    const verifyUrl = buildBackendUrl(`/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`);
    try {
      const result = await sendAuthEmail({
        to: email,
        subject: 'Verify your Moodlelike email / 验证你的 Moodlelike 邮箱',
        text: [
          'Please verify your Moodlelike email address within 24 hours:',
          verifyUrl,
          '',
          '请在 24 小时内验证你的 Moodlelike 登录邮箱：',
          verifyUrl
        ].join('\n')
      });
      if (!result.sent) {
        throw new Error('SMTP is not configured or email delivery was skipped.');
      }
      return true;
    } catch (error) {
      console.warn(`[auth-email] Failed to send verification email to ${email}: ${(error as Error).message}`);
      if (options.throwOnFailure) {
        throw new ServiceUnavailableException('验证邮件暂时无法发送，请稍后再试。');
      }
      return false;
    }
  }

  private async sendPasswordReset(user: PrismaUser) {
    const email = user.email;
    if (!email) return;
    const token = await this.createAuthEmailToken(user.id, PASSWORD_RESET_TOKEN_TYPE, PASSWORD_RESET_TTL_SECONDS);
    const resetUrl = buildFrontendUrl(`/auth?mode=reset&token=${encodeURIComponent(token)}`);
    try {
      await sendAuthEmail({
        to: email,
        subject: 'Reset your Moodlelike password / 重置你的 Moodlelike 密码',
        text: [
          'Use this link to reset your Moodlelike password within 30 minutes:',
          resetUrl,
          '',
          '请在 30 分钟内使用这个链接重置你的 Moodlelike 密码：',
          resetUrl
        ].join('\n')
      });
    } catch (error) {
      console.warn(`[auth-email] Failed to send password reset email to ${email}: ${(error as Error).message}`);
    }
  }

  private async createRefreshSession(user: PrismaUser, userAgent?: string) {
    const sid = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        sessionHash: this.hashRefreshSessionId(sid),
        expiresAt,
        userAgent: normalizeUserAgent(userAgent)
      }
    });
    return { sid, expiresAt };
  }

  private hashRefreshSessionId(sid: string) {
    return createHmac('sha256', getAuthSecret()).update(sid).digest('hex');
  }

  private signUser(user: PrismaUser, type: TokenType, ttlSeconds = type === 'access' ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS, sid?: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email ?? '',
      role: user.role,
      type,
      iat: now,
      exp: now + ttlSeconds
    };
    if (type === 'refresh') {
      if (!sid) throw new Error('Refresh token session id is required.');
      payload.sid = sid;
    }
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    return `${encodedPayload}.${signTokenPayload(encodedPayload)}`;
  }

  private verifyToken(token: string, expectedType: TokenType): TokenPayload {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature || !signaturesMatch(signTokenPayload(encodedPayload), signature)) {
      throw new UnauthorizedException('登录状态已失效。');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(fromBase64Url(encodedPayload));
    } catch {
      throw new UnauthorizedException('登录状态已失效。');
    }
    return assertTokenPayload(payload, expectedType);
  }

  private verifyGoogleOAuthState(stateCookie: string | undefined, rawState: unknown) {
    if (!stateCookie || typeof rawState !== 'string' || !rawState) {
      throw new BadRequestException('Google 登录状态已失效，请重试。');
    }
    const payload = decodeSignedJson<GoogleOAuthState>(stateCookie, 'Google 登录状态已失效，请重试。');
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now || payload.iat > now + 60 || payload.state !== rawState || !payload.codeVerifier) {
      throw new BadRequestException('Google 登录状态已失效，请重试。');
    }
    return {
      ...payload,
      redirectTo: sanitizeLocalRedirect(payload.redirectTo)
    };
  }

  private async exchangeGoogleAuthorizationCode(code: string, codeVerifier: string) {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        redirect_uri: getGoogleRedirectUri(),
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    });
    const body = await response.json().catch(() => ({})) as { id_token?: string; error?: string; error_description?: string };
    if (!response.ok || !body.id_token) {
      throw new UnauthorizedException(body.error_description || body.error || 'Google 登录失败，请重试。');
    }
    return body.id_token;
  }

  private async verifyGoogleIdToken(idToken: string) {
    const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    const header = decodeJwtPart<{ alg?: string; kid?: string }>(encodedHeader, 'Google 登录凭据无效。');
    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    const payload = decodeJwtPart<GoogleIdTokenPayload>(encodedPayload, 'Google 登录凭据无效。');
    await this.verifyGoogleTokenSignature(`${encodedHeader}.${encodedPayload}`, encodedSignature, header.kid);
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    if (payload.aud !== getGoogleClientId()) {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    if (!Number.isInteger(payload.exp) || payload.exp < now || !Number.isInteger(payload.iat) || payload.iat > now + 60) {
      throw new UnauthorizedException('Google 登录凭据已过期。');
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!payload.email || !emailVerified) {
      throw new UnauthorizedException('Google 邮箱未验证，暂不能用于登录。');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified,
      displayName: safeString(payload.name, 100),
      pictureUrl: safeString(payload.picture, 500)
    };
  }

  private async verifyGoogleTokenSignature(signingInput: string, signature: string, kid: string) {
    const response = await fetch(GOOGLE_JWKS_ENDPOINT);
    const body = await response.json().catch(() => ({})) as { keys?: GoogleJwk[] };
    if (!response.ok || !Array.isArray(body.keys)) {
      throw new UnauthorizedException('Google 登录校验暂时不可用。');
    }
    const jwk = body.keys.find((item) => item.kid === kid && item.kty === 'RSA');
    if (!jwk) {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    if (!verifier.verify(key, Buffer.from(signature, 'base64url'))) {
      throw new UnauthorizedException('Google 登录凭据无效。');
    }
  }

  private async resolveGoogleUser(googleUser: { sub: string; email: string; emailVerified: boolean; displayName?: string; pictureUrl?: string }) {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: GOOGLE_OAUTH_PROVIDER,
          providerUserId: googleUser.sub
        }
      },
      include: { user: true }
    });
    if (linked) {
      if (linked.user.emailVerifiedAt) return { user: linked.user, isNew: false };
      const user = await this.prisma.user.update({
        where: { id: linked.userId },
        data: { emailVerifiedAt: new Date() }
      });
      return { user, isNew: false };
    }

    const existing = await this.prisma.user.findUnique({ where: { email: googleUser.email } });
    if (existing) {
      if (existing.role === 'admin') {
        throw new ForbiddenException('管理员账号请先使用密码登录后再绑定 Google。');
      }
      const user = await this.prisma.$transaction(async (tx) => {
        const verifiedUser = existing.emailVerifiedAt
          ? existing
          : await tx.user.update({
              where: { id: existing.id },
              data: { emailVerifiedAt: new Date() }
            });
        await tx.oAuthAccount.create({
          data: {
            userId: existing.id,
            provider: GOOGLE_OAUTH_PROVIDER,
            providerUserId: googleUser.sub,
            email: googleUser.email,
            emailVerified: googleUser.emailVerified,
            displayName: googleUser.displayName,
            pictureUrl: googleUser.pictureUrl
          }
        });
        return verifiedUser;
      });
      return { user, isNew: false };
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: googleUser.email,
          passwordHash: null,
          role: 'student',
          status: 'active',
          emailVerifiedAt: new Date(),
          displayName: googleUser.displayName || googleUser.email.split('@')[0]
        }
      });
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: GOOGLE_OAUTH_PROVIDER,
          providerUserId: googleUser.sub,
          email: googleUser.email,
          emailVerified: googleUser.emailVerified,
          displayName: googleUser.displayName,
          pictureUrl: googleUser.pictureUrl
        }
      });
      return user;
    });
    return { user, isNew: true };
  }

  private async linkGoogleUser(userId: number | undefined, googleUser: { sub: string; email: string; emailVerified: boolean; displayName?: string; pictureUrl?: string }) {
    if (!userId) {
      throw new BadRequestException('Google 绑定状态已失效，请重试。');
    }
    const user = await this.requireActiveUser(userId);
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: GOOGLE_OAUTH_PROVIDER,
          providerUserId: googleUser.sub
        }
      }
    });
    if (linked && linked.userId !== user.id) {
      throw new ConflictException('这个 Google 账号已绑定其他账号。');
    }

    const sameEmailUser = await this.prisma.user.findUnique({ where: { email: googleUser.email } });
    if (sameEmailUser && sameEmailUser.id !== user.id) {
      throw new ConflictException('这个 Google 邮箱已属于另一个账号。');
    }

    return this.prisma.$transaction(async (tx) => {
      const nextUser = user.email === googleUser.email && !user.emailVerifiedAt
        ? await tx.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: new Date() }
          })
        : user;

      await tx.oAuthAccount.upsert({
        where: {
          provider_providerUserId: {
            provider: GOOGLE_OAUTH_PROVIDER,
            providerUserId: googleUser.sub
          }
        },
        create: {
          userId: user.id,
          provider: GOOGLE_OAUTH_PROVIDER,
          providerUserId: googleUser.sub,
          email: googleUser.email,
          emailVerified: googleUser.emailVerified,
          displayName: googleUser.displayName,
          pictureUrl: googleUser.pictureUrl
        },
        update: {
          email: googleUser.email,
          emailVerified: googleUser.emailVerified,
          displayName: googleUser.displayName,
          pictureUrl: googleUser.pictureUrl
        }
      });
      return nextUser;
    });
  }
}
