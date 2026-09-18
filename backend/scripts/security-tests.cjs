const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('reflect-metadata');

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'backend-security-tests-secret';
process.env.AUTH_EMAIL_CAPTURE = 'true';
process.env.PUBLIC_APP_ORIGIN = 'http://localhost:5174';
process.env.PUBLIC_API_ORIGIN = 'http://localhost:3000';

const { AuthService } = require('../dist/backend/src/auth/auth.service.js');
const { AuthController } = require('../dist/backend/src/auth/auth.controller.js');
const {
  assertCookieCsrf,
  buildCsrfCookie,
  getCsrfCookieName,
  getRefreshCookieName,
  isLegacyRefreshFallbackEnabled
} = require('../dist/backend/src/auth/auth.cookies.js');
const { resetRateLimitForTests } = require('../dist/backend/src/common/rate-limit.js');
const { runWithRequestContext } = require('../dist/backend/src/common/request-context.js');
const { recordAdminAudit } = require('../dist/backend/src/admin-audit/admin-audit-log.js');
const { buildPublishedSchoolWhere } = require('../dist/backend/src/schools/schools.query.js');
const { SchoolsService } = require('../dist/backend/src/schools/schools.service.js');
const { HealthController } = require('../dist/backend/src/health/health.controller.js');

function createFakePrisma() {
  const state = {
    users: [],
    refreshSessions: [],
    authEmailTokens: [],
    auditLogs: [],
    nextUserId: 1,
    nextRefreshSessionId: 1,
    nextAuthEmailTokenId: 1
  };

  const findUser = (where) => {
    if (where.id !== undefined) return state.users.find((user) => user.id === where.id) ?? null;
    if (where.email !== undefined) return state.users.find((user) => user.email === where.email) ?? null;
    return null;
  };

  return {
    __state: state,
    user: {
      findUnique: async ({ where }) => findUser(where),
      create: async ({ data }) => {
        const now = new Date();
        const user = {
          id: state.nextUserId++,
          loginName: null,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role ?? 'student',
          status: data.status ?? 'active',
          displayName: data.displayName ?? null,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          emailVerificationSentAt: data.emailVerificationSentAt ?? null,
          createdAt: now,
          updatedAt: now
        };
        state.users.push(user);
        return user;
      },
      update: async ({ where, data }) => {
        const user = findUser(where);
        if (!user) throw new Error('Unknown user');
        Object.assign(user, data, { updatedAt: new Date() });
        return user;
      },
      count: async ({ where } = {}) =>
        state.users.filter((user) => {
          if (!where) return true;
          if (where.role !== undefined && user.role !== where.role) return false;
          if (where.status !== undefined && user.status !== where.status) return false;
          return true;
        }).length,
      findMany: async () => [...state.users]
    },
    refreshSession: {
      create: async ({ data }) => {
        const now = new Date();
        const session = {
          id: `session-${state.nextRefreshSessionId++}`,
          userId: data.userId,
          sessionHash: data.sessionHash,
          expiresAt: data.expiresAt,
          revokedAt: data.revokedAt ?? null,
          lastUsedAt: data.lastUsedAt ?? null,
          userAgent: data.userAgent ?? null,
          createdAt: now,
          updatedAt: now
        };
        state.refreshSessions.push(session);
        return session;
      },
      findUnique: async ({ where }) => {
        if (where.sessionHash !== undefined) {
          return state.refreshSessions.find((session) => session.sessionHash === where.sessionHash) ?? null;
        }
        return null;
      },
      update: async ({ where, data }) => {
        const session = state.refreshSessions.find((item) => item.sessionHash === where.sessionHash);
        if (!session) throw new Error('Unknown refresh session');
        Object.assign(session, data, { updatedAt: new Date() });
        return session;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const session of state.refreshSessions) {
          if (where.sessionHash !== undefined && session.sessionHash !== where.sessionHash) continue;
          if (where.userId !== undefined && session.userId !== where.userId) continue;
          if (where.revokedAt === null && session.revokedAt !== null) continue;
          Object.assign(session, data, { updatedAt: new Date() });
          count += 1;
        }
        return { count };
      }
    },
    authEmailToken: {
      create: async ({ data }) => {
        const token = {
          id: `email-token-${state.nextAuthEmailTokenId++}`,
          userId: data.userId,
          type: data.type,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: data.usedAt ?? null,
          createdAt: new Date()
        };
        state.authEmailTokens.push(token);
        return token;
      },
      findUnique: async ({ where }) => {
        if (where.tokenHash !== undefined) return state.authEmailTokens.find((token) => token.tokenHash === where.tokenHash) ?? null;
        if (where.id !== undefined) return state.authEmailTokens.find((token) => token.id === where.id) ?? null;
        return null;
      },
      update: async ({ where, data }) => {
        const token = state.authEmailTokens.find((item) => item.id === where.id || item.tokenHash === where.tokenHash);
        if (!token) throw new Error('Unknown auth email token');
        Object.assign(token, data);
        return token;
      }
    },
    oAuthAccount: {
      count: async () => 0
    },
    adminAuditLog: {
      create: async ({ data }) => {
        state.auditLogs.push(data);
        return { id: state.auditLogs.length, ...data, createdAt: new Date() };
      }
    },
    $transaction: async (fn) => fn(createTransactionClient())
  };

  function createTransactionClient() {
    return {
      user: {
        findUnique: async ({ where }) => findUser(where),
        update: async ({ where, data }) => {
          const user = findUser(where);
          if (!user) throw new Error('Unknown user');
          Object.assign(user, data, { updatedAt: new Date() });
          return user;
        },
        count: async ({ where } = {}) =>
          state.users.filter((user) => {
            if (!where) return true;
            if (where.role !== undefined && user.role !== where.role) return false;
            if (where.status !== undefined && user.status !== where.status) return false;
            return true;
          }).length
      },
      authEmailToken: {
        update: async ({ where, data }) => {
          const token = state.authEmailTokens.find((item) => item.id === where.id || item.tokenHash === where.tokenHash);
          if (!token) throw new Error('Unknown auth email token');
          Object.assign(token, data);
          return token;
        }
      },
      refreshSession: {
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const session of state.refreshSessions) {
            if (where.userId !== undefined && session.userId !== where.userId) continue;
            if (where.revokedAt === null && session.revokedAt !== null) continue;
            Object.assign(session, data, { updatedAt: new Date() });
            count += 1;
          }
          return { count };
        }
      },
      oAuthAccount: { create: async () => ({}) },
      adminAuditLog: {
        create: async ({ data }) => {
          state.auditLogs.push(data);
          return { id: state.auditLogs.length, ...data, createdAt: new Date() };
        }
      },
      $executeRaw: async () => 1
    };
  }
}

async function expectReject(promise, status, label) {
  try {
    await promise;
  } catch (error) {
    const actual = typeof error.getStatus === 'function' ? error.getStatus() : error.status;
    assert.equal(actual, status, label);
    return error;
  }
  assert.fail(`${label}: expected rejection`);
}

function decodeToken(token) {
  const [payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function lastCapturedEmail() {
  const messages = globalThis.__CSC_AUTH_EMAILS__ ?? [];
  return messages[messages.length - 1];
}

function extractTokenFromEmail(message) {
  const match = message.text.match(/[?&]token=([A-Za-z0-9_-]+)/);
  assert.ok(match, `email should contain a token link: ${message.text}`);
  return decodeURIComponent(match[1]);
}

async function run() {
  resetRateLimitForTests();
  const prisma = createFakePrisma();
  const auth = new AuthService(prisma);
  globalThis.__CSC_AUTH_EMAILS__ = [];

  await expectReject(auth.register({ email: 'student@example.com', password: '1234567' }), 400, 'weak register password');

  const registered = await auth.register({ email: 'student@example.com', password: 'Strong123' });
  assert.equal(registered.user.email, 'student@example.com');
  assert.equal(registered.verificationEmailSent, true, 'register reports verification email delivery');
  assert.equal(decodeToken(registered.tokens.accessToken).type, 'access');
  assert.equal(decodeToken(registered.tokens.refreshToken).type, 'refresh');
  assert.equal(typeof decodeToken(registered.tokens.refreshToken).sid, 'string');
  assert.equal(prisma.__state.refreshSessions.length, 1);
  assert.equal(prisma.__state.authEmailTokens.length, 1, 'register creates verification token');
  assert.equal(globalThis.__CSC_AUTH_EMAILS__.length, 1, 'register sends verification email');
  const verificationToken = extractTokenFromEmail(lastCapturedEmail());
  assert.notEqual(prisma.__state.authEmailTokens[0].tokenHash, verificationToken, 'verification token stores hash only');
  assert.equal(prisma.__state.authEmailTokens[0].tokenHash.includes(verificationToken), false, 'verification token hash must not contain raw token');
  await auth.verifyEmailToken(verificationToken);
  assert.ok(prisma.__state.users[0].emailVerifiedAt, 'verification sets emailVerifiedAt');
  assert.ok(prisma.__state.authEmailTokens[0].usedAt, 'verification token is used immediately');
  await expectReject(auth.verifyEmailToken(verificationToken), 400, 'verification token cannot be reused');
  await prisma.authEmailToken.create({
    data: {
      userId: 1,
      type: 'email_verification',
      tokenHash: require('node:crypto').createHash('sha256').update('expired-verification').digest('hex'),
      expiresAt: new Date(Date.now() - 1000)
    }
  });
  await expectReject(auth.verifyEmailToken('expired-verification'), 400, 'expired verification token rejected');

  const accessUser = await auth.getRequiredUser(`Bearer ${registered.tokens.accessToken}`);
  assert.equal(accessUser.id, 1);
  await expectReject(auth.refresh(`Bearer ${registered.tokens.accessToken}`), 401, 'access token cannot refresh');
  await expectReject(auth.getRequiredUser(`Bearer ${registered.tokens.refreshToken}`), 401, 'refresh token cannot access protected APIs');
  const refreshed = await auth.refresh(`Bearer ${registered.tokens.refreshToken}`);
  assert.equal(decodeToken(refreshed.tokens.accessToken).type, 'access');
  assert.equal(decodeToken(refreshed.tokens.refreshToken).sid, decodeToken(registered.tokens.refreshToken).sid);

  const csrfCookie = buildCsrfCookie('csrf-token');
  assert.ok(csrfCookie.cookie.includes(`${getCsrfCookieName()}=csrf-token`), 'csrf cookie must use configured/default name');
  assert.equal(csrfCookie.cookie.includes('HttpOnly'), false, 'csrf cookie must be readable by the frontend');
  assertCookieCsrf({
    cookie: `${getRefreshCookieName()}=refresh-token; ${getCsrfCookieName()}=csrf-token`,
    'x-csrf-token': 'csrf-token'
  });
  assert.throws(
    () => assertCookieCsrf({ cookie: `${getCsrfCookieName()}=csrf-token`, 'x-csrf-token': 'wrong-token' }),
    /安全校验失败/,
    'wrong csrf header rejected'
  );

  const controllerResponse = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  let cookieRefreshCalled = false;
  const controller = new AuthController({
    refreshToken: async (token) => {
      cookieRefreshCalled = token === 'cookie-refresh';
      return { tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } };
    },
    refresh: async () => {
      throw new Error('legacy refresh should not be called for cookie refresh');
    },
    logoutToken: async () => ({ revoked: true }),
    logout: async () => ({ revoked: true })
  });
  const cookieRefreshResult = await controller.refresh(
    { headers: { cookie: `${getRefreshCookieName()}=cookie-refresh; ${getCsrfCookieName()}=csrf-token`, 'x-csrf-token': 'csrf-token' } },
    undefined,
    'security-test',
    controllerResponse
  );
  assert.equal(cookieRefreshCalled, true, 'cookie refresh must call refreshToken');
  assert.equal(cookieRefreshResult.tokens.accessToken, 'new-access');
  assert.ok(Array.isArray(controllerResponse.headers['Set-Cookie']), 'refresh must set refresh and csrf cookies');

  await expectReject(
    controller.refresh(
      { headers: { cookie: `${getRefreshCookieName()}=cookie-refresh; ${getCsrfCookieName()}=csrf-token` } },
      undefined,
      'security-test',
      { setHeader() {} }
    ),
    403,
    'cookie refresh without csrf is rejected'
  );

  process.env.AUTH_LEGACY_REFRESH_FALLBACK_ENABLED = 'false';
  assert.equal(isLegacyRefreshFallbackEnabled(), false);
  await expectReject(controller.refresh({ headers: {} }, `Bearer ${registered.tokens.refreshToken}`, 'security-test', { setHeader() {} }), 401, 'legacy refresh fallback can be disabled');
  delete process.env.AUTH_LEGACY_REFRESH_FALLBACK_ENABLED;

  await auth.logout(`Bearer ${refreshed.tokens.refreshToken}`);
  await expectReject(auth.refresh(`Bearer ${refreshed.tokens.refreshToken}`), 401, 'revoked refresh token rejected');

  const loggedIn = await auth.login({ email: 'student@example.com', password: 'Strong123' });
  const secondLogin = await auth.login({ email: 'student@example.com', password: 'Strong123' });
  await auth.logoutAllForUser(accessUser.id);
  await expectReject(auth.refresh(`Bearer ${loggedIn.tokens.refreshToken}`), 401, 'logout-all revokes first session');
  await expectReject(auth.refresh(`Bearer ${secondLogin.tokens.refreshToken}`), 401, 'logout-all revokes second session');

  const activeLogin = await auth.login({ email: 'student@example.com', password: 'Strong123' });
  globalThis.__CSC_AUTH_EMAILS__ = [];
  const forgotExisting = await auth.forgotPassword({ email: 'student@example.com' });
  const forgotMissing = await auth.forgotPassword({ email: 'missing@example.com' });
  assert.deepEqual(forgotExisting, forgotMissing, 'forgot password response does not expose account existence');
  assert.equal(globalThis.__CSC_AUTH_EMAILS__.length, 1, 'forgot password sends reset only for existing password account');
  const resetToken = extractTokenFromEmail(lastCapturedEmail());
  const resetTokenRecord = prisma.__state.authEmailTokens.find((token) => token.type === 'password_reset');
  assert.ok(resetTokenRecord, 'forgot password creates reset token');
  assert.notEqual(resetTokenRecord.tokenHash, resetToken, 'reset token stores hash only');
  await auth.resetPassword({ token: resetToken, password: 'Reset1234' });
  await expectReject(auth.refresh(`Bearer ${activeLogin.tokens.refreshToken}`), 401, 'password reset revokes old refresh session');
  await expectReject(auth.resetPassword({ token: resetToken, password: 'Again1234' }), 400, 'reset token cannot be reused');
  await expectReject(auth.resetPassword({ token: 'wrong-token', password: 'Again1234' }), 400, 'wrong reset token rejected');
  const resetLogin = await auth.login({ email: 'student@example.com', password: 'Reset1234' });
  assert.equal(decodeToken(resetLogin.tokens.accessToken).type, 'access');
  await prisma.authEmailToken.create({
    data: {
      userId: 1,
      type: 'password_reset',
      tokenHash: require('node:crypto').createHash('sha256').update('expired-reset').digest('hex'),
      expiresAt: new Date(Date.now() - 1000)
    }
  });
  await expectReject(auth.resetPassword({ token: 'expired-reset', password: 'Again1234' }), 400, 'expired reset token rejected');
  const tampered = `${activeLogin.tokens.accessToken.slice(0, -2)}xx`;
  await expectReject(auth.getRequiredUser(`Bearer ${tampered}`), 401, 'tampered token rejected');
  const expiredAccess = auth.signUser(accessUser, 'access', -1);
  await expectReject(auth.getRequiredUser(`Bearer ${expiredAccess}`), 401, 'expired token rejected');

  await expectReject(auth.getRequiredAdmin(`Bearer ${activeLogin.tokens.accessToken}`), 403, 'student cannot access admin');
  await prisma.user.update({ where: { id: accessUser.id }, data: { status: 'disabled' } });
  await expectReject(auth.getRequiredUser(`Bearer ${activeLogin.tokens.accessToken}`), 403, 'disabled user rejected');
  await prisma.user.update({ where: { id: accessUser.id }, data: { status: 'active' } });

  await expectReject(auth.createAdminUser({ email: 'admin@example.com', password: 'Admin123' }), 400, 'admin create requires actor');
  await expectReject(auth.createAdminUser({ email: 'admin@example.com', password: 'short' }, 1), 400, 'weak admin password rejected');
  const admin = await auth.createAdminUser({ email: 'admin@example.com', password: 'Admin1234' }, 1);
  assert.equal(admin.role, 'admin');

  resetRateLimitForTests();
  for (let index = 0; index < 8; index += 1) {
    await expectReject(auth.login({ email: 'student@example.com', password: 'Wrong1234' }), 401, `bad login ${index}`);
  }
  await expectReject(auth.login({ email: 'student@example.com', password: 'Wrong1234' }), 429, 'login limiter');

  const where = buildPublishedSchoolWhere({
    keyword: 'HSK',
    region: '北京',
    schoolType: 'regular',
    cscaRequired: 'true',
    verifiedOnly: 'true',
    quality: 'verified'
  });
  assert.equal(where.status, 'published');
  assert.equal(where.region, '北京');
  assert.equal(where.schoolType, 'regular');
  assert.equal(where.cscaRequired, true);
  assert.ok(Array.isArray(where.OR), 'keyword Prisma OR filter is present');

  const schoolsService = new SchoolsService({});
  await expectReject(
    schoolsService.createAdminSchool({ nameZh: '测试大学', sourceUrl: 'ftp://example.com' }, 1),
    400,
    'invalid school URL rejected'
  );

  const auditPrisma = createFakePrisma();
  await runWithRequestContext({ requestId: 'req-test-1' }, () =>
    recordAdminAudit(auditPrisma, {
      actorId: 7,
      module: 'schools',
      resourceType: 'school',
      resourceId: 12,
      action: 'school.update',
      after: { nameZh: '测试大学' }
    })
  );
  assert.equal(auditPrisma.__state.auditLogs[0].after._audit.requestId, 'req-test-1');
  assert.equal(auditPrisma.__state.auditLogs[0].after._audit.actor.id, 7);

  process.env.DATABASE_URL = 'postgresql://user:secret@db.example.com:5432/cscalite?schema=public';
  process.env.AUTH_SECRET = 'backend-security-tests-secret';
  process.env.CORS_ORIGINS = 'https://www.example.com';
  const health = new HealthController().check();
  assert.equal(health.status, 'ok');
  assert.equal(health.checks.databaseUrlConfigured, true);
  assert.equal(JSON.stringify(health).includes('secret'), false, 'health response must not leak secret values');
  process.env.NODE_ENV = 'test';
  process.env.MOODLELIKE_ENV = 'production';
  delete process.env.OPS_HEALTH_DETAILS_ENABLED;
  const minimalHealth = new HealthController().check();
  assert.equal(minimalHealth.status, 'ok');
  assert.equal(minimalHealth.checks, undefined, 'production health should be minimal by default');
  process.env.OPS_HEALTH_DETAILS_ENABLED = 'true';
  const detailedHealth = new HealthController().check();
  assert.equal(detailedHealth.checks.databaseUrlConfigured, true, 'private detailed health can be enabled explicitly');
  process.env.OPS_READY_TOKEN = 'ready-security-test-token';
  await expectReject(new HealthController().ready(), 401, 'ready token protects readiness endpoint');
  const protectedReady = await new HealthController().ready('Bearer ready-security-test-token');
  assert.equal(protectedReady.status, 'degraded', 'ready token allows protected readiness response');
  delete process.env.OPS_READY_TOKEN;
  delete process.env.OPS_HEALTH_DETAILS_ENABLED;
  delete process.env.MOODLELIKE_ENV;
  process.env.CSC_ENV = 'production';
  const legacyMinimalHealth = new HealthController().check();
  assert.equal(legacyMinimalHealth.checks, undefined, 'legacy CSC_ENV must remain a production-safe fallback');
  delete process.env.CSC_ENV;
  delete process.env.NODE_ENV;

  const backupDryRun = spawnSync(process.execPath, [path.resolve(__dirname, '..', '..', 'scripts', 'db-backup.cjs'), '--dry-run'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: process.env,
    encoding: 'utf8'
  });
  assert.equal(backupDryRun.status, 0, `db backup dry-run failed: ${backupDryRun.stderr || backupDryRun.stdout}`);
  assert.match(backupDryRun.stdout, /Dry run only/);

  const restoreBlocked = spawnSync(process.execPath, [path.resolve(__dirname, '..', '..', 'scripts', 'db-restore.cjs'), '.tmp/backups/not-real.dump'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://user:secret@db.example.com:5432/cscalite?schema=public',
      ALLOW_DB_RESTORE: '1',
      ALLOW_PRODUCTION_DB_RESTORE: '0'
    },
    encoding: 'utf8'
  });
  assert.notEqual(restoreBlocked.status, 0, 'production-like restore target must be blocked');
  assert.match(`${restoreBlocked.stdout}\n${restoreBlocked.stderr}`, /Refusing to restore to possible production database/);

  console.log('CSCAlite backend security tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
