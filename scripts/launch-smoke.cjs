const { spawn, spawnSync } = require('node:child_process');
const { createHmac } = require('node:crypto');
const net = require('node:net');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const backendEntry = process.env.SMOKE_BACKEND_ENTRY || 'backend/dist/main.js';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 20000);
const stamp = `s18-smoke-${Date.now()}`;
const publicStamp = `s18-public-${Date.now()}`;

function parsePort(url) {
  const parsed = new URL(url);
  if (parsed.port) return Number(parsed.port);
  return parsed.protocol === 'https:' ? 443 : 80;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.JWT_SECRET) missing.push('AUTH_SECRET or JWT_SECRET');
  if (!process.env.ADMIN_BOOTSTRAP_EMAIL) missing.push('ADMIN_BOOTSTRAP_EMAIL');
  if (!process.env.ADMIN_BOOTSTRAP_PASSWORD) missing.push('ADMIN_BOOTSTRAP_PASSWORD');
  if (!process.env.PAYMENT_CALLBACK_SECRET) missing.push('PAYMENT_CALLBACK_SECRET');
  if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (missing.length) {
    throw new Error(`Launch smoke requires env before running: ${missing.join(', ')}`);
  }
}

async function syncPostgresSequences() {
  const prisma = new PrismaClient();
  const tables = [
    'users',
    'admin_audit_logs',
    'schools_raw',
    'schools',
    'school_programs',
    'school_csca_rules',
    'school_scholarships',
    'school_change_logs',
    'school_snapshots',
    'practice_questions',
    'practice_attempts',
    'mock_exam_papers',
    'mock_exam_questions',
    'mock_exam_attempts',
    'cart_items',
    'orders',
    'order_items',
    'payments',
    'payment_callback_logs'
  ];
  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, 1), false)`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function cleanupSmokeData(label) {
  const result = spawnSync(process.execPath, ['scripts/cleanup-s18-smoke-data.cjs', '--execute'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} cleanup failed with exit code ${result.status}`);
}

function isPortOpen(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    token,
    body,
    expectedStatus,
    headers = {}
  } = options;
  const defaultExpectedStatus = method === 'POST' ? [200, 201] : 200;
  const statusExpectation = expectedStatus ?? defaultExpectedStatus;
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
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 160)}`);
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected HTTP ${expectedStatuses.join('/')} got ${response.status}: ${text.slice(0, 240)}`);
  }
  return parsed;
}

async function waitForHealth(child) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend process exited before launch smoke could run with code ${child.exitCode}.`);
    }
    try {
      const health = await request('/api/v1/health');
      if (health.status === 'ok') return;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Backend did not become healthy within ${startupTimeoutMs}ms. Last error: ${lastError?.message}`);
}

async function login(email, password) {
  const result = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  assert(result.tokens?.accessToken, `Login did not return an access token for ${email}`);
  return result.tokens.accessToken;
}

async function registerStudent(index) {
  const email = `${stamp}-student-${index}@cscalite.local`;
  const password = 's18-smoke-pass';
  const result = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password }
  });
  assert(result.tokens?.accessToken, `Register did not return an access token for ${email}`);
  return result.tokens.accessToken;
}

function fullSchoolPayload(index, overrides = {}) {
  const isPublicFixture = overrides.publicFixture !== false;
  const marker = isPublicFixture ? publicStamp : stamp;
  const publicFixture = overrides.publicFixture;
  delete overrides.publicFixture;
  return {
    nameZh: `${marker} school ${index}`,
    nameEn: `${marker} school ${index}`,
    schoolType: 'regular',
    region: 'S18',
    cscaRequired: true,
    cscaRequirement: isPublicFixture ? 'S18 release CSCA requirement' : 'S18 smoke CSCA requirement',
    languageRequirement: isPublicFixture ? 'S18 release language requirement' : 'S18 smoke language requirement',
    tuitionSummary: isPublicFixture ? 'S18 release tuition summary' : 'S18 smoke tuition summary',
    sourceUrl: `https://example.com/${marker}/school-${index}`,
    source: isPublicFixture ? 's18-public' : 's18-smoke',
    sourceId: `${marker}-school-${index}`,
    lastVerifiedAt: '2026-04-30',
    status: 'published',
    ...overrides
  };
}

function callbackSignaturePayload(input) {
  return `${input.providerTxnId}|${input.orderId}|${input.amountCents}|${input.currency}|${input.status}`;
}

function signCallbackPayload(input) {
  return createHmac('sha256', process.env.PAYMENT_CALLBACK_SECRET).update(callbackSignaturePayload(input)).digest('hex');
}

async function assertReadyAndPublicSmoke() {
  const ready = await request('/api/v1/ops/ready');
  assert(ready.status === 'ready', `/api/v1/ops/ready must be ready for launch smoke, got ${ready.status}`);
  for (const key of [
    'app',
    'databaseUrlConfigured',
    'authSecretConfigured',
    'adminBootstrapConfigured',
    'paymentCallbackSecretConfigured',
    'corsOriginsConfigured'
  ]) {
    assert(ready.checks?.[key] === true, `/api/v1/ops/ready missing ready check: ${key}`);
  }

  const content = await request('/api/v1/content/home');
  assert(Array.isArray(content.items) && content.items.length >= 7, 'Home content must include at least seven blocks.');

  const schools = await request('/api/v1/schools?pageSize=1');
  assert(Array.isArray(schools.items), 'Public schools list must return an items array.');

  const search = await request('/api/v1/search?q=csca');
  assert(Array.isArray(search.items), 'Search must return an items array.');
  assert(search.groups && typeof search.groups === 'object', 'Search must return groups.');
  assert(typeof search.total === 'number', 'Search must return total.');
}

function smokeProgramPayload(overrides = {}) {
  return {
    nameZh: `${stamp} Computer Science`,
    nameEn: `${stamp} Computer Science`,
    degreeLevel: '本科',
    durationYears: '4 年',
    fieldCategory: 'Computer Science',
    teachingLanguage: '英文授课',
    cscaSubjects: ['数学', '物理'],
    cscaRequirement: 'S18 smoke program CSCA requirement',
    hskRequirement: '可免 HSK',
    englishRequirement: 'IELTS 6.0',
    tuitionAmount: 30000,
    tuitionCurrency: 'RMB',
    tuitionPeriod: '年',
    tuitionText: '30000 RMB / 年',
    scholarshipText: 'S18 smoke scholarship note',
    openDate: '2026-03-01',
    deadlineDate: '2026-12-31',
    deadlineLabel: 'Dec 31, 2026',
    applicationRound: 'S18 round',
    applicationUrl: `https://example.com/${stamp}/program/apply`,
    applicationNote: 'S18 smoke program application note',
    sourceUrl: `https://example.com/${stamp}/program`,
    sourceLabel: 'S18 smoke program source',
    lastVerifiedAt: '2026-04-30',
    sortOrder: 1,
    status: 'published',
    ...overrides
  };
}

async function assertSchoolProgramSmoke(adminToken, schoolId) {
  const createdProgram = await request(`/api/v1/admin/schools/${schoolId}/programs`, {
    method: 'POST',
    token: adminToken,
    body: smokeProgramPayload()
  });
  assert(createdProgram.id, 'Created school program must return an id.');
  assert(createdProgram.cscaSubjects?.includes('数学'), 'Created school program must keep CSCA subjects.');

  const updatedProgram = await request(`/api/v1/admin/schools/${schoolId}/programs/${createdProgram.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      tuitionAmount: 32000,
      tuitionText: '32000 RMB / 年',
      cscaSubjects: ['数学', '物理', '化学']
    }
  });
  assert(updatedProgram.tuitionAmount === 32000, 'School program update must persist tuition amount.');
  assert(updatedProgram.cscaSubjects?.includes('化学'), 'School program update must persist CSCA subjects.');

  const createdRule = await request(`/api/v1/admin/schools/${schoolId}/csca-rules`, {
    method: 'POST',
    token: adminToken,
    body: {
      title: `${stamp} science rule`,
      category: '理工科类',
      scope: 'Computer Science',
      programId: createdProgram.id,
      cscaSubjects: ['数学', '物理'],
      languageCondition: '英文授课',
      description: 'S18 smoke CSCA rule',
      importantNote: 'S18 smoke important note',
      sourceUrl: `https://example.com/${stamp}/rule`,
      sourceLabel: 'S18 rule source',
      lastVerifiedAt: '2026-04-30',
      status: 'published'
    }
  });
  assert(createdRule.id, 'Created CSCA rule must return an id.');
  const updatedRule = await request(`/api/v1/admin/schools/${schoolId}/csca-rules/${createdRule.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { cscaSubjects: ['数学', '物理', '化学'] }
  });
  assert(updatedRule.cscaSubjects?.includes('化学'), 'CSCA rule update must persist subjects.');

  const createdScholarship = await request(`/api/v1/admin/schools/${schoolId}/scholarships`, {
    method: 'POST',
    token: adminToken,
    body: {
      name: `${stamp} CSC Scholarship`,
      type: 'csc',
      programId: createdProgram.id,
      coverage: 'Full scholarship',
      amountText: 'Full tuition',
      requirementText: 'S18 smoke scholarship requirement',
      sourceUrl: `https://example.com/${stamp}/scholarship`,
      sourceLabel: 'S18 scholarship source',
      lastVerifiedAt: '2026-04-30',
      status: 'published'
    }
  });
  assert(createdScholarship.id && createdScholarship.isCsc, 'Created CSC scholarship must be marked as CSC.');

  const detail = await request(`/api/v1/schools/${schoolId}`);
  assert(Array.isArray(detail.programs) && detail.programs.length >= 1, 'Public school detail must return programs.');
  assert(detail.programCount >= 1, 'Public school detail must return programCount.');
  assert(detail.programSubjectTags?.includes('数学'), 'Public school detail must aggregate program subject tags.');
  assert(Array.isArray(detail.cscaRules) && detail.cscaRules.length >= 1, 'Public school detail must return CSCA rules.');
  assert(Array.isArray(detail.scholarshipsDetailed) && detail.scholarshipsDetailed.length >= 1, 'Public school detail must return detailed scholarships.');
  assert(detail.upcomingDeadlines?.length >= 1, 'Public school detail must return upcoming program deadlines.');
  assert(detail.cscScholarshipCount >= 1, 'Public school detail must aggregate CSC scholarship count.');

  for (const query of [
    `programSubject=${encodeURIComponent('数学')}`,
    `degreeLevel=${encodeURIComponent('本科')}`,
    `teachingLanguage=${encodeURIComponent('英文授课')}`,
    'hasProgramTuition=true',
    'hasUpcomingDeadline=true',
    'hasCsc=true',
    'hasCscaRules=true',
    'hasDetailedScholarship=true'
  ]) {
    const filtered = await request(`/api/v1/schools?${query}&pageSize=50`);
    assert(
      Array.isArray(filtered.items) && (filtered.items.some((school) => school.id === schoolId) || filtered.pagination?.total > 0),
      `Public schools filter must return at least one matching school for ${query}.`
    );
  }

  const archivedProgram = await request(`/api/v1/admin/schools/${schoolId}/programs/${createdProgram.id}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert(archivedProgram.status === 'archived', 'School program archive must set archived status.');

  const afterArchive = await request(`/api/v1/schools/${schoolId}`);
  assert(
    !(afterArchive.programs ?? []).some((program) => program.id === createdProgram.id),
    'Archived school program must not appear in public detail programs.'
  );

  const archivedRule = await request(`/api/v1/admin/schools/${schoolId}/csca-rules/${createdRule.id}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert(archivedRule.status === 'archived', 'CSCA rule archive must set archived status.');

  const archivedScholarship = await request(`/api/v1/admin/schools/${schoolId}/scholarships/${createdScholarship.id}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert(archivedScholarship.status === 'archived', 'Scholarship archive must set archived status.');
}

function mockExamQuestionPayload(orderNumber = 1, overrides = {}) {
  return {
    orderNumber,
    questionType: 'single-choice',
    prompt: `${stamp} 不等式 x + 3 > 8 的解集为（ ）`,
    options: [
      { id: 'A', text: 'x > 5' },
      { id: 'B', text: 'x < 5' },
      { id: 'C', text: 'x >= 5' },
      { id: 'D', text: 'x <= 5' }
    ],
    correctAnswer: 'A',
    explanation: `${stamp} snapshot old explanation`,
    knowledgeTags: ['集合与不等式'],
    status: 'published',
    ...overrides
  };
}

function specialPracticeQuestionPayload(orderNumber = 1, overrides = {}) {
  return {
    orderNumber,
    difficulty: 'easy',
    prompt: `${stamp} 若集合 A={1,2,3}, B={2,3,4}，则 A∩B=（ ）`,
    options: [
      { id: 'A', text: '{2,3}' },
      { id: 'B', text: '{1,4}' },
      { id: 'C', text: '{1,2,3,4}' },
      { id: 'D', text: '{4}' }
    ],
    correctAnswer: 'A',
    explanation: `${stamp} special snapshot old explanation`,
    knowledgeTags: ['集合'],
    status: 'published',
    ...overrides
  };
}

async function assertAdminMockExamSmoke(adminToken) {
  const slug = `${stamp}-math-mock`;
  const importPayload = {
    papers: [
      {
        subject: 'math',
        slug,
        title: `${stamp} 数学 smoke 模考`,
        description: 'Launch smoke mock exam paper.',
        language: 'zh',
        durationMinutes: 60,
        questionCount: 1,
        isFree: true,
        isLocked: false,
        sortOrder: 999,
        status: 'draft',
        questions: [mockExamQuestionPayload()]
      }
    ]
  };

  const validation = await request('/api/v1/admin/mock-exam/import/validate', {
    method: 'POST',
    token: adminToken,
    body: importPayload
  });
  assert(validation.ok === true, `Mock exam import validation must pass: ${(validation.errors || []).join('; ')}`);

  const imported = await request('/api/v1/admin/mock-exam/import', {
    method: 'POST',
    token: adminToken,
    body: importPayload
  });
  assert(imported.questionsUpserted === 1, 'Mock exam import must upsert one question.');

  const papers = await request('/api/v1/admin/mock-exam/papers', { token: adminToken });
  const paper = papers.items.find((item) => item.slug === slug);
  assert(paper, 'Imported mock exam paper must appear in admin list.');
  assert(paper.status === 'draft', 'Imported mock exam paper must remain draft before publish.');

  const published = await request(`/api/v1/admin/mock-exam/papers/${paper.id}/publish`, {
    method: 'POST',
    token: adminToken
  });
  assert(published.status === 'published', 'Mock exam publish must set published status.');

  const start = await request(`/api/v1/csca-mock-exam/papers/${slug}/start`);
  assert(start.locked === false && start.paper.slug === slug, 'Published free mock exam must be startable.');

  const attempt = await request(`/api/v1/csca-mock-exam/papers/${slug}/attempts`, { method: 'POST' });
  const attemptDetail = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}`);
  assert(attemptDetail.questions.length === 1, 'Attempt must expose one snapshot question.');
  assert(attemptDetail.questions[0].correctAnswer === undefined, 'Attempt question payload must not expose correctAnswer.');
  const questionId = attemptDetail.questions[0].id;

  await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}`, {
    method: 'PATCH',
    body: { answers: { [questionId]: 'A' }, markedQuestions: [questionId], timeSpent: { [questionId]: 9 }, currentQuestion: 1 }
  });
  const report = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}/submit`, { method: 'POST' });
  assert(report.summary.score === 100, 'Mock exam attempt should score 100 for the correct answer.');
  assert(report.items[0].explanation === `${stamp} snapshot old explanation`, 'Submitted report must use the original snapshot explanation.');

  await request(`/api/v1/admin/mock-exam/questions/${questionId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { prompt: `${stamp} changed core prompt` },
    expectedStatus: 400
  });

  const updatedQuestion = await request(`/api/v1/admin/mock-exam/questions/${questionId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { explanation: `${stamp} updated current-bank explanation` }
  });
  assert(updatedQuestion.explanation.includes('updated current-bank'), 'Non-core explanation update should apply.');

  const stableReport = await request(`/api/v1/csca-mock-exam/attempts/${attempt.id}/report`);
  assert(stableReport.items[0].explanation === `${stamp} snapshot old explanation`, 'Historical report must remain stable after question-bank edits.');

  const duplicated = await request(`/api/v1/admin/mock-exam/papers/${paper.id}/duplicate`, {
    method: 'POST',
    token: adminToken
  });
  assert(duplicated.status === 'draft' && duplicated.slug !== paper.slug, 'Duplicated mock exam paper must be a new draft.');
  const duplicatedDetail = await request(`/api/v1/admin/mock-exam/papers/${duplicated.id}`, { token: adminToken });
  assert(duplicatedDetail.questions.every((question) => question.status === 'draft'), 'Duplicated questions must be drafts.');

  const archivedQuestion = await request(`/api/v1/admin/mock-exam/questions/${questionId}/archive`, {
    method: 'POST',
    token: adminToken
  });
  assert(archivedQuestion.status === 'archived', 'Mock exam question archive must set archived status.');

  const audits = await request('/api/v1/admin/audit-events', { token: adminToken });
  assert(audits.items.some((item) => item.module === 'mock-exam'), 'Admin audit must include mock-exam actions.');
}

async function assertAdminSpecialPracticeSmoke(adminToken) {
  const slug = `${stamp}-math-special`;
  const importPayload = {
    topics: [
      {
        subject: 'math',
        module: '集合与不等式',
        slug,
        title: `${stamp} 集合 smoke 专项`,
        description: 'Launch smoke special practice topic.',
        estimatedMinutes: 12,
        questionCount: 1,
        sortOrder: 999,
        status: 'draft',
        questions: [specialPracticeQuestionPayload()]
      }
    ]
  };

  const validation = await request('/api/v1/admin/special-practice/import/validate', {
    method: 'POST',
    token: adminToken,
    body: importPayload
  });
  assert(validation.ok === true, `Special practice import validation must pass: ${(validation.errors || []).join('; ')}`);

  const imported = await request('/api/v1/admin/special-practice/import', {
    method: 'POST',
    token: adminToken,
    body: importPayload
  });
  assert(imported.questionsUpserted === 1, 'Special practice import must upsert one question.');

  const topics = await request('/api/v1/admin/special-practice/topics', { token: adminToken });
  const topic = topics.items.find((item) => item.slug === slug);
  assert(topic, 'Imported special practice topic must appear in admin list.');
  assert(topic.status === 'draft', 'Imported special practice topic must remain draft before publish.');

  const published = await request(`/api/v1/admin/special-practice/topics/${topic.id}/publish`, {
    method: 'POST',
    token: adminToken
  });
  assert(published.status === 'published', 'Special practice publish must set published status.');

  const start = await request(`/api/v1/csca-special-practice/topics/${slug}/start`);
  assert(start.topic.slug === slug, 'Published special practice topic must be startable.');

  const session = await request(`/api/v1/csca-special-practice/topics/${slug}/sessions`, { method: 'POST' });
  const sessionDetail = await request(`/api/v1/csca-special-practice/sessions/${session.id}`);
  assert(sessionDetail.questions.length === 1, 'Special practice session must expose one snapshot question.');
  assert(sessionDetail.questions[0].correctAnswer === undefined, 'Special practice session payload must not expose correctAnswer.');
  const questionId = sessionDetail.questions[0].id;

  await request(`/api/v1/csca-special-practice/sessions/${session.id}`, {
    method: 'PATCH',
    body: { answers: { [questionId]: 'A' }, timeSpent: { [questionId]: 8 }, currentQuestion: 1 }
  });
  const report = await request(`/api/v1/csca-special-practice/sessions/${session.id}/submit`, { method: 'POST' });
  assert(report.summary.accuracy === 100, 'Special practice session should score 100 for the correct answer.');
  assert(report.items[0].explanation === `${stamp} special snapshot old explanation`, 'Special practice report must use the original snapshot explanation.');

  await request(`/api/v1/admin/special-practice/questions/${questionId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { prompt: `${stamp} changed special core prompt` },
    expectedStatus: 400
  });

  const updatedQuestion = await request(`/api/v1/admin/special-practice/questions/${questionId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { explanation: `${stamp} updated current-bank special explanation` }
  });
  assert(updatedQuestion.explanation.includes('updated current-bank'), 'Special practice non-core explanation update should apply.');

  const stableReport = await request(`/api/v1/csca-special-practice/sessions/${session.id}/report`);
  assert(stableReport.items[0].explanation === `${stamp} special snapshot old explanation`, 'Special practice historical report must remain stable after question-bank edits.');

  const duplicated = await request(`/api/v1/admin/special-practice/topics/${topic.id}/duplicate`, {
    method: 'POST',
    token: adminToken
  });
  assert(duplicated.status === 'draft' && duplicated.slug !== topic.slug, 'Duplicated special practice topic must be a new draft.');
  const duplicatedDetail = await request(`/api/v1/admin/special-practice/topics/${duplicated.id}`, { token: adminToken });
  assert(duplicatedDetail.questions.every((question) => question.status === 'draft'), 'Duplicated special practice questions must be drafts.');

  const archivedQuestion = await request(`/api/v1/admin/special-practice/questions/${questionId}/archive`, {
    method: 'POST',
    token: adminToken
  });
  assert(archivedQuestion.status === 'archived', 'Special practice question archive must set archived status.');

  const exhaustedStart = await request(`/api/v1/csca-special-practice/topics/${slug}/start`);
  assert(exhaustedStart.availability?.isAvailable === false, 'Special practice start must mark exhausted banks unavailable.');
  assert(exhaustedStart.questionPreviewCount === 0, 'Special practice exhausted start must not expose preview questions.');
  const exhaustedSession = await request(`/api/v1/csca-special-practice/topics/${slug}/sessions`, {
    method: 'POST',
    expectedStatus: 409
  });
  assert(exhaustedSession.errorCode === 'SPECIAL_PRACTICE_POOL_EXHAUSTED', 'Special practice exhausted sessions must return a specific launch-isolation error code.');

  const audits = await request('/api/v1/admin/audit-events', { token: adminToken });
  assert(audits.items.some((item) => item.module === 'special-practice'), 'Admin audit must include special-practice actions.');
}

async function assertAdminSmoke(adminToken) {
  const contentKey = `${stamp}.content`;
  const createdBlock = await request('/api/v1/admin/content/blocks', {
    method: 'POST',
    token: adminToken,
    body: {
      key: contentKey,
      title: `${stamp} content draft`,
      body: { body: 'S18 smoke content' },
      status: 'draft',
      sortOrder: 900
    }
  });
  assert(createdBlock.status === 'draft', 'Created content block must start as draft.');

  const updatedBlock = await request(`/api/v1/admin/content/blocks/${contentKey}`, {
    method: 'PATCH',
    token: adminToken,
    body: { title: `${stamp} content updated` }
  });
  assert(updatedBlock.title.includes('updated'), 'Content block update did not apply.');

  const publishedBlock = await request(`/api/v1/admin/content/blocks/${contentKey}/publish`, {
    method: 'POST',
    token: adminToken
  });
  assert(publishedBlock.status === 'published', 'Content block publish did not set published.');

  const archivedBlock = await request(`/api/v1/admin/content/blocks/${contentKey}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert(archivedBlock.status === 'archived', 'Content block archive did not set archived.');

  const draftSchool = await request('/api/v1/admin/schools', {
    method: 'POST',
    token: adminToken,
    body: {
      nameZh: `${stamp} incomplete school`,
      schoolType: 'regular',
      status: 'draft',
      source: 's18-smoke',
      sourceId: `${stamp}-incomplete`
    }
  });
  assert(draftSchool.status === 'draft', 'Incomplete school must be created as draft.');

  await request(`/api/v1/admin/schools/${draftSchool.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'published' },
    expectedStatus: 400
  });

  const firstSchool = await request(`/api/v1/admin/schools/${draftSchool.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: fullSchoolPayload(1)
  });
  assert(firstSchool.status === 'published', 'Complete school publish did not set published.');
  await assertSchoolProgramSmoke(adminToken, firstSchool.id);

  const secondSchool = await request('/api/v1/admin/schools', {
    method: 'POST',
    token: adminToken,
    body: fullSchoolPayload(2)
  });
  const thirdSchool = await request('/api/v1/admin/schools', {
    method: 'POST',
    token: adminToken,
    body: fullSchoolPayload(3)
  });

  const importPayload = fullSchoolPayload('import', {
    nameZh: `${stamp} import school`,
    sourceId: `${stamp}-import`,
    status: 'draft',
    programs: [
      smokeProgramPayload({
        nameZh: `${stamp} import program`,
        nameEn: `${stamp} Import Program`,
        sourceUrl: `https://example.com/${stamp}/import-program`,
        sourceLabel: 'S18 import program source'
      })
    ],
    cscaRules: [
      {
        title: `${stamp} import rule`,
        category: '理工科类',
        scope: 'Import Program',
        cscaSubjects: ['数学'],
        description: 'S18 import rule',
        sourceUrl: `https://example.com/${stamp}/import-rule`,
        lastVerifiedAt: '2026-04-30',
        status: 'published'
      }
    ],
    scholarshipsDetailed: [
      {
        name: `${stamp} import scholarship`,
        type: 'csc',
        coverage: 'Full scholarship',
        sourceUrl: `https://example.com/${stamp}/import-scholarship`,
        lastVerifiedAt: '2026-04-30',
        status: 'published'
      }
    ]
  });
  const firstImport = await request('/api/v1/admin/schools/import', {
    method: 'POST',
    token: adminToken,
    body: [importPayload]
  });
  const secondImport = await request('/api/v1/admin/schools/import', {
    method: 'POST',
    token: adminToken,
    body: [importPayload]
  });
  assert(firstImport.created === 1 || firstImport.updated === 1, 'First import must create or update one school.');
  assert(secondImport.updated === 1, 'Second import must update the same source/sourceId school.');
  assert(
    firstImport.programsCreated === 1 || firstImport.programsUpdated === 1,
    'First import must create or update one school program.'
  );
  assert(secondImport.programsUpdated === 1, 'Second import must update the same imported school program.');
  assert(firstImport.cscaRulesCreated === 1 || firstImport.cscaRulesUpdated === 1, 'First import must create or update one CSCA rule.');
  assert(secondImport.cscaRulesUpdated === 1, 'Second import must update the same imported CSCA rule.');
  assert(firstImport.scholarshipsCreated === 1 || firstImport.scholarshipsUpdated === 1, 'First import must create or update one scholarship.');
  assert(secondImport.scholarshipsUpdated === 1, 'Second import must update the same imported scholarship.');

  const adminEmail = `${stamp}-admin@cscalite.local`;
  const createdAdmin = await request('/api/v1/admin/users', {
    method: 'POST',
    token: adminToken,
    body: { email: adminEmail, password: 's18-smoke-admin-pass' }
  });
  assert(createdAdmin.role === 'admin' && createdAdmin.status === 'active', 'Created admin user must be active admin.');
  const disabledAdmin = await request(`/api/v1/admin/users/${createdAdmin.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'disabled' }
  });
  assert(disabledAdmin.status === 'disabled', 'Admin disable did not apply.');
  const restoredAdmin = await request(`/api/v1/admin/users/${createdAdmin.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'active' }
  });
  assert(restoredAdmin.status === 'active', 'Admin restore did not apply.');

  const audits = await request('/api/v1/admin/audit-events', { token: adminToken });
  assert(Array.isArray(audits.items) && audits.items.length > 0, 'Audit events must include recent admin actions.');
  await assertAdminMockExamSmoke(adminToken);
  await assertAdminSpecialPracticeSmoke(adminToken);

  const search = await request(`/api/v1/search?q=${encodeURIComponent(publicStamp)}&type=school`);
  assert(Array.isArray(search.items) && search.items.some((item) => item.href === `/schools/${firstSchool.id}`), 'Search must find the S18/S20 smoke school.');

  return [firstSchool.id, secondSchool.id, thirdSchool.id];
}

async function assertSchoolPricing(studentToken, schoolIds) {
  const one = await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token: studentToken,
    body: { type: 'SCHOOL_SERVICE', schoolId: schoolIds[0] }
  });
  assert(one.pricing.itemsTotalCents === 10000, 'One school items total must be 10000 cents.');
  assert(one.pricing.discountTotalCents === 10000, 'One school discount must be 10000 cents.');
  assert(one.pricing.payableTotalCents === 0, 'One school payable must be 0 cents.');

  const two = await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token: studentToken,
    body: { type: 'SCHOOL_SERVICE', schoolId: schoolIds[1] }
  });
  assert(two.pricing.itemsTotalCents === 20000, 'Two schools items total must be 20000 cents.');
  assert(two.pricing.discountTotalCents === 10000, 'Two schools discount must be 10000 cents.');
  assert(two.pricing.payableTotalCents === 10000, 'Two schools payable must be 10000 cents.');

  const three = await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token: studentToken,
    body: { type: 'SCHOOL_SERVICE', schoolId: schoolIds[2] }
  });
  assert(three.pricing.itemsTotalCents === 30000, 'Three schools items total must be 30000 cents.');
  assert(three.pricing.discountTotalCents === 10000, 'Three schools discount must be 10000 cents.');
  assert(three.pricing.payableTotalCents === 20000, 'Three schools payable must be 20000 cents.');
}

async function assertPaymentSmoke(studentToken) {
  const cart = await request('/api/v1/commerce/cart/items', {
    method: 'POST',
    token: studentToken,
    body: { type: 'ADVISOR_PACKAGE', quantity: 1 }
  });
  assert(cart.pricing.payableTotalCents === 39900, 'Advisor package payable must be 39900 cents.');

  const order = await request('/api/v1/commerce/checkout', {
    method: 'POST',
    token: studentToken
  });
  assert(order.status === 'PENDING', 'Checkout must create a PENDING order.');
  assert(order.payableTotalCents === 39900, 'Checkout order payable must be 39900 cents.');

  const payment = await request('/api/v1/commerce/payments', {
    method: 'POST',
    token: studentToken,
    body: { orderId: order.id }
  });
  assert(payment.status === 'PENDING', 'Payment create must return a PENDING payment.');
  assert(payment.amountCents === 39900, 'Payment amount must be 39900 cents.');
  assert(payment.testCallbackSignature, 'Payment create must return a test callback signature.');

  const callbackBody = {
    providerTxnId: payment.providerTxnId,
    orderId: order.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: 'SUCCEEDED',
    signature: payment.testCallbackSignature
  };
  const callback = await request('/api/v1/commerce/payments/callback', {
    method: 'POST',
    body: callbackBody
  });
  assert(callback.paymentStatus === 'SUCCEEDED', 'Callback must mark payment as SUCCEEDED.');
  assert(callback.orderStatus === 'PAID', 'Callback must mark order as PAID.');

  const duplicateCallback = await request('/api/v1/commerce/payments/callback', {
    method: 'POST',
    body: callbackBody
  });
  assert(duplicateCallback.idempotent === true, 'Duplicate callback must be idempotent.');

  await request('/api/v1/commerce/payments/callback', {
    method: 'POST',
    body: { ...callbackBody, signature: '0'.repeat(64) },
    expectedStatus: 403
  });

  const amountMismatchBody = {
    ...callbackBody,
    amountCents: callbackBody.amountCents + 1
  };
  await request('/api/v1/commerce/payments/callback', {
    method: 'POST',
    body: { ...amountMismatchBody, signature: signCallbackPayload(amountMismatchBody) },
    expectedStatus: 400
  });

  const orders = await request('/api/v1/commerce/orders', { token: studentToken });
  assert(Array.isArray(orders.items) && orders.items.some((item) => item.id === order.id && item.status === 'PAID'), 'Orders must include the paid order.');
}

async function runChecks() {
  await assertReadyAndPublicSmoke();
  const adminToken = await login(process.env.ADMIN_BOOTSTRAP_EMAIL, process.env.ADMIN_BOOTSTRAP_PASSWORD);
  const schoolIds = await assertAdminSmoke(adminToken);
  await assertSchoolPricing(await registerStudent(1), schoolIds);
  await assertPaymentSmoke(await registerStudent(2));
}

async function main() {
  requireEnv();
  cleanupSmokeData('pre-launch');
  await syncPostgresSequences();
  const port = parsePort(baseUrl);
  if (await isPortOpen(port)) {
    throw new Error(`Launch smoke expected to start the built backend, but port ${port} is already in use.`);
  }

  const child = spawn(process.execPath, [backendEntry], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`));

  try {
    await waitForHealth(child);
    await runChecks();
    console.log('CSCAlite S18 launch smoke check passed.');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await delay(500);
    }
    cleanupSmokeData('post-launch');
  }
}

main().catch((error) => {
  console.error(`CSCAlite launch smoke check failed: ${error.message}`);
  process.exit(1);
});
