const assert = require('node:assert/strict');
const { createSign, generateKeyPairSync } = require('node:crypto');
require('reflect-metadata');

process.env.AUTH_SECRET = 'auth-google-oauth-test-secret-at-least-32-characters';
process.env.GOOGLE_CLIENT_ID = 'google-oauth-test-client';
process.env.GOOGLE_CLIENT_SECRET = 'google-oauth-test-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://app.example.com/api/v1/auth/google/callback';
process.env.PUBLIC_APP_ORIGIN = 'https://app.example.com';
process.env.CORS_ORIGINS = 'https://app.example.com';
process.env.AUTH_COOKIE_SECURE = 'true';
process.env.AUTH_REFRESH_COOKIE_ENABLED = 'true';

const { AuthService } = require('../dist/backend/src/auth/auth.service.js');
const { AuthController } = require('../dist/backend/src/auth/auth.controller.js');
const {
  buildOAuthStateCookie,
  getCsrfCookieName,
  getOAuthStateCookieName,
  getRefreshCookieName
} = require('../dist/backend/src/auth/auth.cookies.js');

const keyId = 'google-oauth-test-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });

function createFakePrisma(seed = {}) {
  const state = {
    users: (seed.users ?? []).map((user) => ({ ...user })),
    oauthAccounts: (seed.oauthAccounts ?? []).map((account) => ({ ...account })),
    refreshSessions: [],
    nextUserId: Math.max(0, ...(seed.users ?? []).map((user) => user.id)) + 1,
    nextOAuthId: 1,
    nextRefreshId: 1
  };

  const findUser = (where) => {
    if (where.id !== undefined) return state.users.find((user) => user.id === where.id) ?? null;
    if (where.email !== undefined) return state.users.find((user) => user.email === where.email) ?? null;
    return null;
  };

  const findOAuth = (where) => {
    const composite = where.provider_providerUserId;
    if (composite) {
      return state.oauthAccounts.find(
        (account) => account.provider === composite.provider && account.providerUserId === composite.providerUserId
      ) ?? null;
    }
    return null;
  };

  const prisma = {
    __state: state,
    user: {
      findUnique: async ({ where }) => findUser(where),
      create: async ({ data }) => {
        const now = new Date();
        const user = {
          id: state.nextUserId++,
          loginName: null,
          email: data.email ?? null,
          passwordHash: data.passwordHash ?? null,
          role: data.role ?? 'student',
          status: data.status ?? 'active',
          displayName: data.displayName ?? null,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          emailVerificationSentAt: null,
          createdAt: now,
          updatedAt: now
        };
        state.users.push(user);
        return user;
      },
      update: async ({ where, data }) => {
        const user = findUser(where);
        if (!user) throw new Error('Unknown test user');
        Object.assign(user, data, { updatedAt: new Date() });
        return user;
      }
    },
    oAuthAccount: {
      findUnique: async ({ where, include }) => {
        const account = findOAuth(where);
        if (!account) return null;
        return include?.user ? { ...account, user: findUser({ id: account.userId }) } : account;
      },
      create: async ({ data }) => {
        if (findOAuth({ provider_providerUserId: data })) throw new Error('Duplicate OAuth subject');
        const now = new Date();
        const account = { id: `oauth-${state.nextOAuthId++}`, ...data, createdAt: now, updatedAt: now };
        state.oauthAccounts.push(account);
        return account;
      },
      upsert: async ({ where, create, update }) => {
        const account = findOAuth(where);
        if (account) {
          Object.assign(account, update, { updatedAt: new Date() });
          return account;
        }
        return prisma.oAuthAccount.create({ data: create });
      },
      count: async ({ where } = {}) => state.oauthAccounts.filter((account) => {
        if (!where) return true;
        if (where.userId !== undefined && account.userId !== where.userId) return false;
        if (where.provider !== undefined && account.provider !== where.provider) return false;
        return true;
      }).length
    },
    refreshSession: {
      create: async ({ data }) => {
        const now = new Date();
        const session = {
          id: `refresh-${state.nextRefreshId++}`,
          ...data,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: now,
          updatedAt: now
        };
        state.refreshSessions.push(session);
        return session;
      }
    },
    $transaction: async (callback) => callback(prisma)
  };

  return prisma;
}

function user(overrides = {}) {
  const now = new Date();
  return {
    id: overrides.id ?? 1,
    loginName: null,
    email: overrides.email ?? 'student@example.com',
    passwordHash: overrides.passwordHash ?? 'password-hash',
    role: overrides.role ?? 'student',
    status: overrides.status ?? 'active',
    displayName: overrides.displayName ?? 'Student',
    emailVerifiedAt: overrides.emailVerifiedAt ?? now,
    emailVerificationSentAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function googlePayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    exp: now + 300,
    iat: now,
    sub: 'google-subject-1',
    email: 'student@example.com',
    email_verified: true,
    name: 'Google Student',
    picture: 'https://images.example.com/student.png',
    ...overrides
  };
}

function signGoogleIdToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${header}.${body}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey).toString('base64url')}`;
}

function installGoogleFetch(payload) {
  const idToken = signGoogleIdToken(payload);
  global.fetch = async (input) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return { ok: true, json: async () => ({ id_token: idToken }) };
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
      return {
        ok: true,
        json: async () => ({ keys: [{ ...publicJwk, kid: keyId, alg: 'RS256', use: 'sig' }] })
      };
    }
    throw new Error(`Unexpected test fetch: ${url}`);
  };
}

function startGoogle(auth, redirect = '/agent', options) {
  const result = options
    ? auth.createGoogleOAuthStart(redirect, options)
    : auth.createGoogleOAuthStart(redirect);
  const state = new URL(result.authorizationUrl).searchParams.get('state');
  assert.ok(state, 'authorization URL includes state');
  assert.equal(new URL(result.authorizationUrl).searchParams.get('code_challenge_method'), 'S256');
  return { ...result, state };
}

async function completeGoogle(auth, payload, options = {}) {
  installGoogleFetch(payload);
  const start = startGoogle(auth, options.redirect ?? '/agent', options.startOptions);
  return auth.completeGoogleOAuth({
    code: 'authorization-code',
    state: options.state ?? start.state,
    stateCookie: start.stateCookie,
    userAgent: 'oauth-contract-test'
  });
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

function responseRecorder() {
  return {
    headers: {},
    redirectedTo: '',
    setHeader(name, value) { this.headers[name] = value; },
    redirect(value) { this.redirectedTo = value; }
  };
}

async function run() {
  const originalFetch = global.fetch;
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    assert.throws(
      () => new AuthService(createFakePrisma()).createGoogleOAuthStart('/agent'),
      /未配置/,
      'Google OAuth must fail closed without a client id'
    );
    process.env.GOOGLE_CLIENT_ID = 'google-oauth-test-client';

    const newPrisma = createFakePrisma();
    const newAuth = new AuthService(newPrisma);
    const created = await completeGoogle(newAuth, googlePayload({ email: 'new@example.com', sub: 'new-subject' }));
    assert.equal(newPrisma.__state.users.length, 1, 'new Google identity creates one user');
    assert.equal(newPrisma.__state.oauthAccounts.length, 1, 'new Google identity creates one OAuth account');
    assert.equal(newPrisma.__state.refreshSessions.length, 1, 'new Google login creates a refresh session');
    assert.match(created.redirectTo, /^\/onboarding\?returnTo=/, 'new user enters onboarding');

    const existingStudent = user({ id: 10, email: 'student@example.com', emailVerifiedAt: null });
    const existingPrisma = createFakePrisma({ users: [existingStudent] });
    const existingResult = await completeGoogle(
      new AuthService(existingPrisma),
      googlePayload({ email: existingStudent.email, sub: 'existing-student-subject' })
    );
    assert.equal(existingResult.result.user.id, String(existingStudent.id));
    assert.equal(existingPrisma.__state.users.length, 1, 'verified matching email does not duplicate the user');
    assert.ok(existingPrisma.__state.users[0].emailVerifiedAt, 'verified Google email verifies the matching user');
    assert.equal(existingPrisma.__state.oauthAccounts[0].userId, existingStudent.id, 'matching student receives the OAuth binding');
    assert.equal(existingResult.redirectTo, '/agent');

    const admin = user({ id: 20, email: 'admin@example.com', role: 'admin' });
    const adminPrisma = createFakePrisma({ users: [admin] });
    await expectReject(
      completeGoogle(new AuthService(adminPrisma), googlePayload({ email: admin.email, sub: 'admin-subject' })),
      403,
      'admin matching email must not auto-bind'
    );
    assert.equal(adminPrisma.__state.oauthAccounts.length, 0);

    const linkedUser = user({ id: 30, email: 'linked@example.com' });
    const linkedPrisma = createFakePrisma({
      users: [linkedUser],
      oauthAccounts: [{
        id: 'oauth-existing', userId: linkedUser.id, provider: 'google', providerUserId: 'linked-subject',
        email: linkedUser.email, emailVerified: true, displayName: 'Linked', pictureUrl: null,
        createdAt: new Date(), updatedAt: new Date()
      }]
    });
    const linkedResult = await completeGoogle(
      new AuthService(linkedPrisma),
      googlePayload({ email: linkedUser.email, sub: 'linked-subject' })
    );
    assert.equal(linkedResult.result.user.id, String(linkedUser.id), 'provider subject resolves the existing binding');
    assert.equal(linkedPrisma.__state.users.length, 1);

    const linkingUser = user({ id: 40, email: 'owner@example.com' });
    const otherUser = user({ id: 41, email: 'other@example.com' });
    const conflictPrisma = createFakePrisma({ users: [linkingUser, otherUser] });
    await expectReject(
      completeGoogle(
        new AuthService(conflictPrisma),
        googlePayload({ email: otherUser.email, sub: 'other-email-subject' }),
        { redirect: '/me?section=settings', startOptions: { mode: 'link', userId: linkingUser.id } }
      ),
      409,
      'link mode rejects a Google email owned by another user'
    );

    await expectReject(
      completeGoogle(new AuthService(createFakePrisma()), googlePayload({ aud: 'wrong-client', email: 'bad-aud@example.com' })),
      401,
      'wrong Google audience is rejected'
    );

    const stateAuth = new AuthService(createFakePrisma());
    const stateStart = startGoogle(stateAuth);
    installGoogleFetch(googlePayload({ email: 'state@example.com', sub: 'state-subject' }));
    await expectReject(
      stateAuth.completeGoogleOAuth({ code: 'authorization-code', state: 'tampered-state', stateCookie: stateStart.stateCookie }),
      400,
      'tampered OAuth state is rejected before token exchange'
    );

    const controllerPrisma = createFakePrisma();
    const controllerAuth = new AuthService(controllerPrisma);
    const controller = new AuthController(controllerAuth);
    const controllerStart = startGoogle(controllerAuth, '/agent');
    installGoogleFetch(googlePayload({ email: 'controller@example.com', sub: 'controller-subject' }));
    const successResponse = responseRecorder();
    const oauthCookie = buildOAuthStateCookie(controllerStart.stateCookie).split(';')[0];
    await controller.googleCallback(
      { headers: { cookie: oauthCookie } },
      'authorization-code',
      controllerStart.state,
      undefined,
      'oauth-controller-test',
      successResponse
    );
    assert.match(successResponse.redirectedTo, /^https:\/\/app\.example\.com\/onboarding\?/, 'callback redirects to the trusted frontend');
    assert.match(successResponse.redirectedTo, /auth=google/, 'success redirect carries the Google marker');
    assert.ok(Array.isArray(successResponse.headers['Set-Cookie']), 'callback writes cookies');
    assert.ok(successResponse.headers['Set-Cookie'].some((cookie) => cookie.startsWith(`${getRefreshCookieName()}=`)), 'callback writes refresh cookie');
    assert.ok(successResponse.headers['Set-Cookie'].some((cookie) => cookie.startsWith(`${getCsrfCookieName()}=`)), 'callback writes CSRF cookie');
    assert.ok(successResponse.headers['Set-Cookie'].some((cookie) => cookie.startsWith(`${getOAuthStateCookieName()}=`) && cookie.includes('Max-Age=0')), 'callback clears OAuth state cookie');

    const deniedResponse = responseRecorder();
    await controller.googleCallback(
      { headers: { cookie: oauthCookie } },
      undefined,
      controllerStart.state,
      'access_denied',
      'oauth-controller-test',
      deniedResponse
    );
    assert.match(deniedResponse.redirectedTo, /error=google_denied/, 'denied callback maps to a safe frontend error');
    assert.ok([].concat(deniedResponse.headers['Set-Cookie']).some((cookie) => cookie.includes('Max-Age=0')), 'denied callback clears OAuth state cookie');

    console.log('Moodlelike Google OAuth contract tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
