const { spawn } = require('node:child_process');
const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const net = require('node:net');
const { promisify } = require('node:util');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus, SchoolType } = require('../backend/node_modules/@prisma/client');

loadEnv();

const scrypt = promisify(scryptCallback);
const port = Number(process.env.ADMIN_STALE_SMOKE_PORT || 3021);
const baseUrl = process.env.ADMIN_STALE_SMOKE_BASE_URL || `http://127.0.0.1:${port}`;
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const stamp = `admin-stale-smoke-${Date.now()}`;
const adminEmail = `${stamp}@moodlelike.local`;
const peerAdminEmail = `${stamp}-peer@moodlelike.local`;
const adminPassword = 'AdminStaleSmoke123';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(targetPort) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
}

function requireEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.JWT_SECRET) missing.push('AUTH_SECRET or JWT_SECRET');
  if (missing.length) throw new Error(`Admin stale-edit smoke needs env: ${missing.join(', ')}`);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function upsertAdmin(prisma, email) {
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await hashPassword(adminPassword),
      role: 'admin',
      status: 'active',
      displayName: email.split('@')[0]
    },
    update: {
      passwordHash: await hashPassword(adminPassword),
      role: 'admin',
      status: 'active'
    }
  });
}

async function seedAdmins() {
  const prisma = new PrismaClient();
  try {
    await upsertAdmin(prisma, adminEmail);
    await upsertAdmin(prisma, peerAdminEmail);
  } finally {
    await prisma.$disconnect();
  }
}

async function request(path, options = {}) {
  const { method = 'GET', token, body, headers = {}, expectedStatus } = options;
  const statusExpectation = expectedStatus ?? (method === 'POST' ? [200, 201] : 200);
  const expectedStatuses = Array.isArray(statusExpectation) ? statusExpectation : [statusExpectation];
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `${stamp}-${method.toLowerCase()}-${path.replace(/[^a-z0-9]/gi, '-')}`,
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} returned non-JSON response: ${text.slice(0, 160)}`);
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected HTTP ${expectedStatuses.join('/')} got ${response.status}: ${text.slice(0, 240)}`);
  }
  parsed.__status = response.status;
  return parsed;
}

async function waitUntilReady(child) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited before admin stale-edit smoke could run with code ${child.exitCode}.`);
    try {
      const ready = await request('/api/v1/ops/ready');
      if (ready.status === 'ready') return;
      lastError = new Error(`/api/v1/ops/ready returned ${ready.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Backend did not become ready. Last error: ${lastError?.message}`);
}

async function loginAdmin(email = adminEmail) {
  const result = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password: adminPassword }
  });
  assert(result.tokens?.accessToken, 'Admin login did not return an access token.');
  return result.tokens.accessToken;
}

async function getAdminUserIdByEmail(token, email) {
  const result = await request('/api/v1/admin/users', { token });
  const user = result.items?.find((item) => item.email === email);
  assert(user?.id, `Admin user ${email} was not listed.`);
  return user.id;
}

function assertVersionConflict(result, label) {
  const serialized = JSON.stringify(result);
  assert(result.__status === 409, `${label} stale update should return HTTP 409, got ${serialized.slice(0, 240)}.`);
  assert(
    serialized.includes('VERSION_CONFLICT') || serialized.includes('已被其他管理员更新'),
    `${label} stale update should return a version conflict message, got ${serialized.slice(0, 240)}.`
  );
}

async function assertStaleUpdate(label, staleRequest) {
  const result = await staleRequest();
  assertVersionConflict(result, label);
}

async function assertContentBlockStaleEdit(token) {
  const key = `${stamp}.content`;
  const created = await request('/api/v1/admin/content/blocks', {
    method: 'POST',
    token,
    body: { key, title: 'Admin stale smoke content', body: { body: 'initial' }, status: 'draft', sortOrder: 999 }
  });
  await request(`/api/v1/admin/content/blocks/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    token,
    body: { title: 'Admin stale smoke content saved once', body: { body: 'first' }, expectedVersion: created.version }
  });
  await assertStaleUpdate('Content block', () => request(`/api/v1/admin/content/blocks/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    token,
    body: { title: 'Admin stale smoke content stale save', expectedVersion: created.version },
    expectedStatus: 409
  }));
}

async function createSchool(token) {
  return request('/api/v1/admin/schools', {
    method: 'POST',
    token,
    body: {
      nameZh: `${stamp} 院校`,
      nameEn: 'Admin Stale Smoke School',
      schoolType: SchoolType.regular,
      region: 'Smoke'
    }
  });
}

async function assertSchoolStaleEdit(token, school) {
  await request(`/api/v1/admin/schools/${school.id}`, {
    method: 'PATCH',
    token,
    body: {
      nameZh: school.nameZh,
      nameEn: 'Admin Stale Smoke School Saved Once',
      schoolType: SchoolType.regular,
      region: school.region,
      cscaRequired: school.cscaRequired,
      status: school.status,
      expectedVersion: school.version
    }
  });
  await assertStaleUpdate('School', () => request(`/api/v1/admin/schools/${school.id}`, {
    method: 'PATCH',
    token,
    body: {
      nameZh: school.nameZh,
      nameEn: 'Admin Stale Smoke School Stale Save',
      schoolType: SchoolType.regular,
      region: school.region,
      cscaRequired: school.cscaRequired,
      status: school.status,
      expectedVersion: school.version
    },
    expectedStatus: 409
  }));
}

async function assertSchoolProgramStaleEdit(token, schoolId) {
  const created = await request(`/api/v1/admin/schools/${schoolId}/programs`, {
    method: 'POST',
    token,
    body: { nameZh: `${stamp} 专业`, degreeLevel: '本科', teachingLanguage: '中文授课', status: SchoolStatus.draft }
  });
  await request(`/api/v1/admin/schools/${schoolId}/programs/${created.id}`, {
    method: 'PATCH',
    token,
    body: { nameZh: created.nameZh, degreeLevel: '硕士', expectedVersion: created.version }
  });
  await assertStaleUpdate('School program', () => request(`/api/v1/admin/schools/${schoolId}/programs/${created.id}`, {
    method: 'PATCH',
    token,
    body: { nameZh: created.nameZh, degreeLevel: '博士', expectedVersion: created.version },
    expectedStatus: 409
  }));
}

async function assertSchoolCscaRuleStaleEdit(token, schoolId) {
  const created = await request(`/api/v1/admin/schools/${schoolId}/csca-rules`, {
    method: 'POST',
    token,
    body: { title: `${stamp} CSCA 规则`, category: '其他', status: SchoolStatus.draft }
  });
  await request(`/api/v1/admin/schools/${schoolId}/csca-rules/${created.id}`, {
    method: 'PATCH',
    token,
    body: { title: created.title, category: '语言', expectedVersion: created.version }
  });
  await assertStaleUpdate('School CSCA rule', () => request(`/api/v1/admin/schools/${schoolId}/csca-rules/${created.id}`, {
    method: 'PATCH',
    token,
    body: { title: created.title, category: '学术', expectedVersion: created.version },
    expectedStatus: 409
  }));
}

async function assertSchoolScholarshipStaleEdit(token, schoolId) {
  const created = await request(`/api/v1/admin/schools/${schoolId}/scholarships`, {
    method: 'POST',
    token,
    body: { name: `${stamp} 院校奖学金`, type: 'general', status: SchoolStatus.draft }
  });
  await request(`/api/v1/admin/schools/${schoolId}/scholarships/${created.id}`, {
    method: 'PATCH',
    token,
    body: { name: created.name, type: 'merit', expectedVersion: created.version }
  });
  await assertStaleUpdate('School scholarship', () => request(`/api/v1/admin/schools/${schoolId}/scholarships/${created.id}`, {
    method: 'PATCH',
    token,
    body: { name: created.name, type: 'need', expectedVersion: created.version },
    expectedStatus: 409
  }));
}

async function assertIndependentScholarshipStaleEdit(token) {
  const created = await request('/api/v1/admin/scholarships', {
    method: 'POST',
    token,
    body: {
      slug: `${stamp}-scholarship`,
      title: `${stamp} 独立奖学金`,
      type: 'government',
      fundingLevel: 'full',
      status: SchoolStatus.draft
    }
  });
  await request(`/api/v1/admin/scholarships/${created.id}`, {
    method: 'PATCH',
    token,
    body: { title: created.title, type: 'university', expectedVersion: created.version }
  });
  await assertStaleUpdate('Independent scholarship', () => request(`/api/v1/admin/scholarships/${created.id}`, {
    method: 'PATCH',
    token,
    body: { title: created.title, type: 'enterprise', expectedVersion: created.version },
    expectedStatus: 409
  }));
}

async function assertAdminStatusRaceKeepsOneActive() {
  const prisma = new PrismaClient();
  let pausedAdminIds = [];
  try {
    const otherActiveAdmins = await prisma.user.findMany({
      where: {
        role: 'admin',
        status: 'active',
        email: { notIn: [adminEmail, peerAdminEmail] }
      },
      select: { id: true }
    });
    pausedAdminIds = otherActiveAdmins.map((user) => user.id);
    if (pausedAdminIds.length) {
      await prisma.user.updateMany({ where: { id: { in: pausedAdminIds } }, data: { status: 'disabled' } });
    }

    const primaryToken = await loginAdmin(adminEmail);
    const peerToken = await loginAdmin(peerAdminEmail);
    const primaryId = await getAdminUserIdByEmail(primaryToken, adminEmail);
    const peerId = await getAdminUserIdByEmail(primaryToken, peerAdminEmail);
    const results = await Promise.all([
      request(`/api/v1/admin/users/${peerId}/status`, {
        method: 'PATCH',
        token: primaryToken,
        body: { status: 'disabled' },
        expectedStatus: [200, 400]
      }),
      request(`/api/v1/admin/users/${primaryId}/status`, {
        method: 'PATCH',
        token: peerToken,
        body: { status: 'disabled' },
        expectedStatus: [200, 400]
      })
    ]);
    const successCount = results.filter((item) => item.__status === 200 && item.status === 'disabled').length;
    const rejectedCount = results.filter((item) => item.__status === 400 && JSON.stringify(item).includes('最后一个 active admin')).length;
    assert(successCount === 1, `Exactly one concurrent admin disable should succeed, got ${JSON.stringify(results).slice(0, 360)}.`);
    assert(rejectedCount === 1, `Exactly one concurrent admin disable should be rejected as last active admin, got ${JSON.stringify(results).slice(0, 360)}.`);

    const activeAdmins = await prisma.user.count({
      where: { role: 'admin', status: 'active', email: { in: [adminEmail, peerAdminEmail] } }
    });
    assert(activeAdmins >= 1, 'Admin status race must leave at least one temporary active admin.');
  } finally {
    if (pausedAdminIds.length) {
      await prisma.user.updateMany({ where: { id: { in: pausedAdminIds } }, data: { status: 'active' } });
    }
    await prisma.$disconnect();
  }
}

async function runChecks() {
  const token = await loginAdmin();
  await assertContentBlockStaleEdit(token);
  const school = await createSchool(token);
  await assertSchoolStaleEdit(token, school);
  await assertSchoolProgramStaleEdit(token, school.id);
  await assertSchoolCscaRuleStaleEdit(token, school.id);
  await assertSchoolScholarshipStaleEdit(token, school.id);
  await assertIndependentScholarshipStaleEdit(token);
  await assertAdminStatusRaceKeepsOneActive();
}

async function cleanupSmokeData() {
  const prisma = new PrismaClient();
  try {
    const schools = await prisma.school.findMany({ where: { nameZh: { startsWith: stamp } }, select: { id: true } });
    const schoolIds = schools.map((school) => school.id);
    const scholarships = await prisma.scholarship.findMany({ where: { slug: { startsWith: stamp } }, select: { id: true } });
    const scholarshipIds = scholarships.map((scholarship) => scholarship.id);
    const users = await prisma.user.findMany({ where: { email: { startsWith: stamp } }, select: { id: true } });
    const userIds = users.map((user) => user.id);

    await prisma.publicContentBlock.deleteMany({ where: { key: { startsWith: stamp } } });
    if (scholarshipIds.length) await prisma.scholarship.deleteMany({ where: { id: { in: scholarshipIds } } });
    if (schoolIds.length) await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [
          { resourceId: { startsWith: stamp } },
          ...(schoolIds.length ? [{ resourceId: { in: schoolIds.map(String) } }] : []),
          ...(scholarshipIds.length ? [{ resourceId: { in: scholarshipIds.map(String) } }] : [])
        ]
      }
    });
    if (userIds.length) {
      await prisma.refreshSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  requireEnv();
  if (await isPortOpen(port)) throw new Error(`Admin stale-edit smoke port ${port} is already in use.`);
  await seedAdmins();

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      CSC_ENV: 'production',
      AUTH_SECRET: process.env.ADMIN_STALE_SMOKE_AUTH_SECRET || 'admin-stale-smoke-auth-secret-not-for-production-2026',
      JWT_SECRET: process.env.ADMIN_STALE_SMOKE_AUTH_SECRET || 'admin-stale-smoke-auth-secret-not-for-production-2026',
      PAYMENT_CALLBACK_SECRET: process.env.ADMIN_STALE_SMOKE_PAYMENT_CALLBACK_SECRET || 'admin-stale-smoke-payment-secret-not-for-production-2026',
      ALLOW_LOCAL_DATABASE_IN_PRODUCTION: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[admin-stale-backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[admin-stale-backend] ${chunk}`));

  try {
    await waitUntilReady(child);
    await runChecks();
    console.log('CSCAlite admin stale-edit smoke passed.');
  } finally {
    try {
      await cleanupSmokeData();
    } catch (error) {
      console.warn(`Admin stale-edit smoke cleanup skipped: ${error.message}`);
    }
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
  }
}

main().catch((error) => {
  console.error(`CSCAlite admin stale-edit smoke failed: ${error.message}`);
  process.exit(1);
});
