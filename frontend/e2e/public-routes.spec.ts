import { expect, test, type Page, type Route } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
  });
});

async function useChineseLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
  });
}

const E2E_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-csrf-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: E2E_CORS_HEADERS,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

const ROUTES = [
  { path: '/', title: /CSCA/ },
  { path: '/csca-prep', title: /CSCA|准备/ },
  { path: '/csca-exam-time', title: /CSCA|考试/ },
  { path: '/csca-subjects/math', title: /数学|学习中心/ },
  { path: '/csca-subjects/physics', title: /物理|学习中心/ },
  { path: '/csca-subjects/chemistry', title: /化学|学习中心/ },
  { path: '/csca-subjects/math/vocabulary', title: /数学|词汇/ },
  { path: '/csca-mock-exam', title: /模考|CSCA/ },
  { path: '/past-papers', title: /真题|下载/ },
  { path: '/services/consulting', title: /咨询|CSCA/ },
  { path: '/auth', title: /登录|账号|CSCA/ },
  { path: '/onboarding', title: /登录|注册引导|CSCA/ },
  { path: '/services/ai-coach', title: /AI 服务|额度|Coach/ },
  { path: '/admin/audit', title: /后台|登录|审核/ },
  { path: '/admin/ai', title: /AI|登录/ },
  { path: '/admin/ai-question-bank', title: /AI|题库|登录/ },
  { path: '/admin/content', title: /内容管理|登录/ },
  { path: '/admin/mock-exams', title: /模考题库|登录/ },
  { path: '/admin/past-papers', title: /真题|登录/ },
  { path: '/admin/special-practice', title: /专项题库|登录/ },
  { path: '/admin/organizations', title: /机构|登录/ },
  { path: '/admin/users', title: /用户管理|登录/ }
];

async function mockAdminData(page: Page, token: string) {
  await page.route('**/api/v1/admin/**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/organization/me/organizations**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], currentOrganizationId: null }) });
  });
  await page.route('**/api/v1/admin/audit-logs**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/admin/practice/summary**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schoolsTotal: 0,
        schoolsVerified: 0,
        schoolsPending: 0,
        adminAuditEventCount: 0,
        latestAdminAuditEventAt: null,
        schoolChangeCount: 0,
        latestSchoolChangeAt: null,
        mockExamAttemptCount: 0,
        specialPracticeSessionCount: 0
      })
    });
  });
  await page.route('**/api/v1/admin/audit-events**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

function schoolDetailWithPrograms() {
  return {
    id: 1,
    nameZh: '测试大学',
    nameEn: 'Test University',
    schoolType: '综合类',
    region: '北京',
    cscaRequired: true,
    cscaRequirement: '该校测试记录要求提供 CSCA。',
    cscaSubjects: ['数学', '中文'],
    subjectTags: ['数学', '中文'],
    languageTags: ['中文授课', '英文授课'],
    languageRequirement: 'HSK 5',
    hskRequirement: 'HSK 5',
    applicationLevel: '本科',
    languageOfInstruction: ['中文授课'],
    deadlineSummary: '以学校官网为准',
    tuitionSummary: '待确认',
    applicationFee: '待确认',
    verificationStatus: 'verified',
    isVerified: true,
    lastVerifiedAt: '2026-04-30',
    featuredPrograms: ['计算机科学', '医学'],
    applicationPortalNotes: '测试申请入口说明',
    programCount: 2,
    undergraduateProgramCount: 1,
    postgraduateProgramCount: 1,
    englishProgramCount: 1,
    programSubjectTags: ['数学', '物理', '化学'],
    programTuitionBandLabel: 'RMB 30000-42000/年',
    programs: [
      {
        id: 101,
        schoolId: 1,
        nameZh: '计算机科学',
        nameEn: 'Computer Science',
        degreeLevel: '本科',
        durationYears: '4 年',
        fieldCategory: 'Computer Science',
        teachingLanguage: '英文授课',
        cscaSubjects: ['数学', '物理'],
        cscaRequirement: '数学 + 物理',
        hskRequirement: '可免 HSK',
        englishRequirement: 'IELTS 6.0',
        tuitionAmount: 30000,
        tuitionCurrency: 'RMB',
        tuitionPeriod: '年',
        tuitionText: 'RMB 30000/年',
        scholarshipText: '可申请大学奖学金',
        sourceUrl: 'https://example.com/program',
        sourceLabel: '专业来源',
        lastVerifiedAt: '2026-04-30',
        sortOrder: 1,
        status: 'published',
        isVerified: true
      },
      {
        id: 102,
        schoolId: 1,
        nameZh: '临床医学',
        nameEn: 'Clinical Medicine',
        degreeLevel: '硕士',
        durationYears: '3 年',
        fieldCategory: 'Medicine',
        teachingLanguage: '中文授课',
        cscaSubjects: ['化学'],
        cscaRequirement: '化学',
        hskRequirement: 'HSK 5',
        englishRequirement: null,
        tuitionAmount: 42000,
        tuitionCurrency: 'RMB',
        tuitionPeriod: '年',
        tuitionText: 'RMB 42000/年',
        scholarshipText: null,
        sourceUrl: 'https://example.com/medicine',
        sourceLabel: '医学来源',
        lastVerifiedAt: null,
        sortOrder: 2,
        status: 'published',
        isVerified: false
      }
    ]
  };
}

async function mockSchoolDetailWithPrograms(page: Page) {
  await page.route('**/api/v1/schools/1**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(schoolDetailWithPrograms())
    });
  });
}

async function mockSubjectLearningData(page: Page, auth: 'guest' | 'student' = 'guest') {
  await page.route('**/*auth/me*', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    if (auth === 'student') {
      expect(route.request().headers().authorization).toBe('Bearer student-token');
      await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
      return;
    }
    await fulfillJson(route, { message: '未登录' }, 401);
  });
  await page.route('**/api/v1/public/content**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/schools**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 3 }) });
  });
  await page.route('**/api/v1/csca-special-practice/subjects/**', async (route) => {
    const subject = new URL(route.request().url()).pathname.split('/').pop() ?? 'math';
    const titles: Record<string, string> = { math: '数学', physics: '物理', chemistry: '化学' };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: {
          id: subject,
          title: titles[subject] ?? '数学',
          description: `${titles[subject] ?? '数学'}原创智能练习`,
          tags: ['智能练习']
        },
        stats: { topicCount: 2, questionCount: 20, estimatedMinutes: 30 },
        modules: [
          {
            module: subject === 'math' ? '集合与不等式' : subject === 'physics' ? '力学' : '物质结构',
            topics: [
              {
                id: 1,
                subject,
                module: subject === 'math' ? '集合与不等式' : subject === 'physics' ? '力学' : '物质结构',
                slug: `${subject}-topic-1`,
                title: subject === 'math' ? '集合' : subject === 'physics' ? '运动学' : '原子结构',
                description: '测试知识点说明',
                estimatedMinutes: 10,
                questionCount: 10,
                publishedQuestionCount: 10,
                sessionCount: 0
              }
            ]
          }
        ]
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subjects: [
          { id: 'math', title: '数学', topicCount: 12, questionCount: 240, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
          { id: 'physics', title: '物理', topicCount: 21, questionCount: 420, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
          { id: 'chemistry', title: '化学', topicCount: 15, questionCount: 300, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' }
        ],
        roundSize: 5,
        diagnosticRoundSize: 20,
        requiresLogin: true
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/subjects/**', async (route) => {
    const subject = new URL(route.request().url()).pathname.split('/').pop() ?? 'math';
    const titles: Record<string, string> = { math: '数学', physics: '物理', chemistry: '化学' };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: {
          id: subject,
          title: titles[subject] ?? '数学',
          shortTitle: titles[subject] ?? '数学',
          accent: 'orange',
          description: `${titles[subject] ?? '数学'}模拟卷`,
          tags: ['原创仿真']
        },
        papers: [
          {
            id: 1,
            subject,
            slug: `${subject}-mock-1`,
            title: `${titles[subject] ?? '数学'}模拟卷 1`,
            description: '原创仿真模拟卷',
            language: 'zh',
            questionCount: 48,
            durationMinutes: 60,
            priceLabel: '免费',
            isFree: true,
            isLocked: false
          }
        ],
        pastPapers: [],
        bundle: { title: '套卷包', priceLabel: '建设中', description: '后续开放' }
      })
    });
  });
}

test('auth email register and reset forms validate before submit', async ({ page }) => {
  let registerCalls = 0;
  await page.route('**/api/v1/auth/register', async (route) => {
    registerCalls += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: 'unexpected submit' }) });
  });

  await page.goto('/auth');
  const form = page.locator('.auth-form');
  await form.getByRole('button', { name: '注册', exact: true }).click();
  await form.getByLabel('邮箱').fill('student@example.com');
  await form.locator('input[type="password"]').first().fill('Strong123');
  await form.getByPlaceholder('确认密码').fill('Strong456');
  await form.getByRole('button', { name: '注册并进入' }).click();
  await expect(page.getByText('两次输入的密码不一致。')).toBeVisible();
  expect(registerCalls).toBe(0);

  await page.goto('/auth?mode=reset&token=reset-token');
  await form.locator('input[type="password"]').first().fill('short');
  await form.getByPlaceholder('确认密码').fill('short');
  await form.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByText('密码至少需要 8 位。')).toBeVisible();
  await form.locator('input[type="password"]').first().fill('Strong123');
  await form.getByPlaceholder('确认密码').fill('Strong456');
  await form.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByText('两次输入的密码不一致。')).toBeVisible();
});

test('auth page exposes Google login entry with redirect', async ({ page }) => {
  let googleStartUrl = '';
  await page.route('**/api/v1/auth/google/start**', async (route) => {
    googleStartUrl = route.request().url();
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Google OAuth</title>' });
  });

  await page.goto('/auth?redirect=/csca-subjects/math');
  await page.getByRole('button', { name: '使用 Google 登录' }).click();

  await expect.poll(() => googleStartUrl).toContain('/api/v1/auth/google/start');
  expect(new URL(googleStartUrl).searchParams.get('redirect')).toBe('/csca-subjects/math');
});

test('forgot password returns a generic success message', async ({ page }) => {
  await page.route('**/api/v1/auth/password/forgot', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ sent: true }) });
  });

  await page.goto('/auth');
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await page.getByLabel('邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '发送重置邮件' }).click();
  await expect(page.getByText('如果这个邮箱存在，我们已经发送密码重置邮件。请检查收件箱。')).toBeVisible();
});

test('/me shows unverified email warning and resend action', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        email: 'student@example.com',
        role: 'student',
        displayName: 'Student',
        emailVerifiedAt: null,
        emailVerificationSentAt: null
      })
    });
  });
  await page.route('**/api/v1/auth/email/verification/resend', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ sent: true, alreadyVerified: false }) });
  });
  await page.route('**/api/v1/csca-mock-exam/my-attempts**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/csca-special-practice/my-sessions**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/csca-special-practice/my-wrong-questions**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/me/saved-schools**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/me/compare**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/commerce/orders**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.goto('/me');
  await expect(page.getByText('邮箱未验证，部分账号安全功能可能受限。')).toBeVisible();
  await page.getByRole('button', { name: '重发验证邮件' }).click();
  await page.getByRole('button', { name: '账号设置' }).click();
  await expect(page.getByText('验证邮件已发送，请检查收件箱。')).toBeVisible();
});

async function mockAdminSchoolsWithPrograms(page: Page, token: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'admin-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        displayName: 'Admin'
      })
    });
  });
  await mockAdminData(page, token);
  await page.route('**/api/v1/admin/schools**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            nameZh: '测试大学',
            nameEn: 'Test University',
            region: '北京',
            status: 'published',
            verificationStatus: 'verified',
            completenessLabel: '核心字段完整'
          }
        ],
        summary: { total: 1, published: 1, verified: 1 }
      })
    });
  });
  await page.route('**/api/v1/admin/schools/1**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...schoolDetailWithPrograms(), programs: [] })
    });
  });
  await page.route('**/api/v1/admin/schools/1/change-logs**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

async function mockAdminMockExamData(page: Page, token: string) {
  const paper = {
    id: 41,
    subject: 'math',
    slug: 'math-admin-draft',
    title: '数学后台草稿卷',
    description: '后台导入 smoke 草稿。',
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: '免费',
    isFree: true,
    isLocked: false,
    sortOrder: 1,
    status: 'draft',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    questionTotal: 1,
    attemptTotal: 0
  };
  const question = {
    id: 4101,
    paperId: 41,
    orderNumber: 1,
    questionType: 'single-choice',
    prompt: '不等式 x + 3 > 8 的解集为（ ）',
    options: [
      { id: 'A', text: 'x > 5' },
      { id: 'B', text: 'x < 5' },
      { id: 'C', text: 'x >= 5' },
      { id: 'D', text: 'x <= 5' }
    ],
    correctAnswer: 'A',
    explanation: '两边同时减去 3，得到 x > 5。',
    knowledgeTags: ['集合与不等式'],
    status: 'draft',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z'
  };

  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'admin-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin' })
    });
  });
  await page.route('**/api/v1/admin/mock-exam/papers**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [paper], summary: { total: 1, published: 0, draft: 1 } })
    });
  });
  await page.route('**/api/v1/admin/mock-exam/papers/41**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ paper, questions: [question], issues: ['数学后台草稿卷 发布需要 48 道 published 题，当前 0 道。'] })
    });
  });
  await page.route('**/api/v1/admin/mock-exam/import/validate**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        errors: [],
        warnings: [],
        previews: [{ slug: 'math-admin-draft', title: '数学后台草稿卷', subject: 'math', status: 'draft', questionCount: 1, action: 'update-draft', existingStatus: 'draft', existingAttempts: 0 }]
      })
    });
  });
  await page.route('**/api/v1/admin/mock-exam/import', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        created: 0,
        updated: 1,
        questionsUpserted: 1,
        previews: [{ slug: 'math-admin-draft', title: '数学后台草稿卷', subject: 'math', status: 'draft', questionCount: 1, action: 'update-draft', existingStatus: 'draft', existingAttempts: 0 }]
      })
    });
  });
}

async function mockAdminSpecialPracticeData(page: Page, token: string) {
  const topic = {
    id: 51,
    subject: 'math',
    module: '集合与不等式',
    slug: 'math-set-admin-draft',
    title: '集合后台草稿',
    description: '后台导入 smoke 草稿。',
    estimatedMinutes: 20,
    questionCount: 10,
    publishedQuestionCount: 1,
    sessionCount: 0,
    sortOrder: 1,
    status: 'draft',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    questionTotal: 1,
    sessionTotal: 0
  };
  const question = {
    id: 5101,
    topicId: 51,
    orderNumber: 1,
    difficulty: '基础',
    questionType: 'single-choice',
    prompt: '设 A={1,2,3}，B={2,3,4}，则 A∩B=（ ）',
    options: [
      { id: 'A', text: '{2,3}' },
      { id: 'B', text: '{1,4}' },
      { id: 'C', text: '{1,2,3,4}' },
      { id: 'D', text: '{4}' }
    ],
    correctAnswer: 'A',
    explanation: '交集表示两个集合共有的元素，A 与 B 共有 2 和 3。',
    knowledgeTags: ['集合', '交集'],
    status: 'draft',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z'
  };

  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'admin-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin' })
    });
  });
  await page.route('**/api/v1/admin/special-practice/topics**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [topic], summary: { total: 1, published: 0, draft: 1 } })
    });
  });
  await page.route('**/api/v1/admin/special-practice/topics/51**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ topic, questions: [question], issues: ['集合后台草稿 发布需要 10 道 published 题，当前 0 道。'] })
    });
  });
  await page.route('**/api/v1/admin/special-practice/import/validate**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        errors: [],
        warnings: [],
        previews: [{ slug: 'math-set-admin-draft', title: '集合后台草稿', subject: 'math', module: '集合与不等式', status: 'draft', questionCount: 1, action: 'update-draft', existingStatus: 'draft', existingSessions: 0 }]
      })
    });
  });
  await page.route('**/api/v1/admin/special-practice/import', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        created: 0,
        updated: 1,
        questionsUpserted: 1,
        previews: [{ slug: 'math-set-admin-draft', title: '集合后台草稿', subject: 'math', module: '集合与不等式', status: 'draft', questionCount: 1, action: 'update-draft', existingStatus: 'draft', existingSessions: 0 }]
      })
    });
  });
}

async function mockMockExamFlow(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
  });
  await page.route('**/api/v1/csca-mock-exam/my-attempts**', async (route) => {
    await fulfillJson(route, { items: [] });
  });
  await page.route('**/api/v1/organization/me/organizations**', async (route) => {
    await fulfillJson(route, { items: [], currentOrganizationId: null });
  });
  const startedAt = new Date().toISOString();
  const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const paper = {
    id: 1,
    subject: 'math',
    slug: 'math-mock-1',
    title: '数学模拟卷 1',
    description: '数学演示模考卷。',
    language: 'zh',
    questionCount: 3,
    durationMinutes: 60,
    priceLabel: '免费',
    isFree: true,
    isLocked: false
  };
  const attempt = {
    id: 901,
    paper,
    language: 'zh',
    startedAt,
    dueAt,
    submittedAt: null,
    answers: {},
    markedQuestions: [],
    timeSpent: {},
    currentQuestion: 1
  };
  const questions = [
    {
      id: 101,
      orderNumber: 1,
      questionType: 'single-choice',
      prompt: '已知集合 A={1,2,3}, B={2,3,4}，则 A∩B=（ ）',
      options: [{ id: 'A', text: '2,3' }, { id: 'B', text: '1,4' }, { id: 'C', text: '1,2,3,4' }, { id: 'D', text: '空集' }]
    },
    {
      id: 102,
      orderNumber: 2,
      questionType: 'single-choice',
      prompt: '函数 y=2x+1 的图像与 y 轴交点为（ ）',
      options: [{ id: 'A', text: '(1,0)' }, { id: 'B', text: '(0,1)' }, { id: 'C', text: '(0,2)' }, { id: 'D', text: '(2,0)' }]
    },
    {
      id: 103,
      orderNumber: 3,
      questionType: 'single-choice',
      prompt: '不等式 x+3>8 的解集为（ ）',
      options: [{ id: 'A', text: 'x>5' }, { id: 'B', text: 'x<5' }, { id: 'C', text: 'x≥5' }, { id: 'D', text: 'x≤5' }]
    }
  ];

  await page.route('**/api/v1/csca-mock-exam/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        examDate: '2026-06-27',
        countdownLabel: '距离下次考试 2026年6月27日',
        subjectCards: [
          { id: 'math', title: '数学', shortTitle: '数学', accent: 'blue', description: '数学模考', tags: ['集合'], paperCount: 1, freeSlug: 'math-mock-1', questionCount: 2, durationMinutes: 60 }
        ],
        stats: [{ value: '95%', label: '目标命中率', detail: '测试' }],
        features: ['限时作答']
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/subjects/math**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: { id: 'math', title: '数学', shortTitle: '数学', accent: 'blue', description: '数学模考', tags: ['集合'] },
        papers: [paper, { ...paper, id: 2, slug: 'math-mock-2', title: '数学模拟卷 2', isFree: false, isLocked: true, priceLabel: '$19.99' }],
        pastPapers: [],
        bundle: { title: '数学模考套卷包', priceLabel: '$19.99', description: '解锁计划建设中。' }
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/papers/math-mock-1/start**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ paper, locked: false, rules: ['提交后查看解析。'] }) });
  });
  await page.route('**/api/v1/csca-mock-exam/papers/math-mock-1/attempts**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(attempt) });
  });
  await page.route('**/api/v1/csca-mock-exam/attempts/901**', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(attempt) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ attempt, questions }) });
  });
  await page.route('**/api/v1/csca-mock-exam/attempts/901/submit**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        attempt: { ...attempt, submittedAt: '2026-05-09T00:20:00.000Z' },
        summary: { score: 33, correctCount: 1, wrongCount: 1, unansweredCount: 1, total: 3, totalSeconds: 20, averageSeconds: 7 },
        knowledgeStats: [{ tag: '集合', total: 1, wrong: 0 }, { tag: '函数', total: 1, wrong: 1 }, { tag: '不等式', total: 1, wrong: 1 }],
        items: [
          { ...questions[0], selected: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, isMarked: false, explanation: '交集保留共有元素。', knowledgeTags: ['集合'], secondsSpent: 10 },
          { ...questions[1], selected: 'A', correctAnswer: 'B', isCorrect: false, isUnanswered: false, isMarked: false, explanation: '令 x=0。', knowledgeTags: ['函数'], secondsSpent: 10 },
          { ...questions[2], selected: '', correctAnswer: 'A', isCorrect: false, isUnanswered: true, isMarked: false, explanation: '两边同时减去 3，得到 x>5。', knowledgeTags: ['不等式'], secondsSpent: 0 }
        ]
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/attempts/901/report**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        attempt: { ...attempt, submittedAt: '2026-05-09T00:20:00.000Z' },
        summary: { score: 33, correctCount: 1, wrongCount: 1, unansweredCount: 1, total: 3, totalSeconds: 20, averageSeconds: 7 },
        knowledgeStats: [{ tag: '集合', total: 1, wrong: 0 }, { tag: '函数', total: 1, wrong: 1 }, { tag: '不等式', total: 1, wrong: 1 }],
        items: [
          { ...questions[0], selected: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, isMarked: false, explanation: '交集保留共有元素。', knowledgeTags: ['集合'], secondsSpent: 10 },
          { ...questions[1], selected: 'A', correctAnswer: 'B', isCorrect: false, isUnanswered: false, isMarked: false, explanation: '令 x=0。', knowledgeTags: ['函数'], secondsSpent: 10 },
          { ...questions[2], selected: '', correctAnswer: 'A', isCorrect: false, isUnanswered: true, isMarked: false, explanation: '两边同时减去 3，得到 x>5。', knowledgeTags: ['不等式'], secondsSpent: 0 }
        ]
      })
    });
  });
}

async function mockPastPapers(page: Page) {
  const counters = { downloads: 0 };
  const paper = {
    id: 91,
    slug: 'math-2026-sample',
    title: '数学 2026 样卷',
    subject: 'math',
    examYear: 2026,
    examMonth: '6月',
    sessionLabel: '样卷',
    language: 'zh',
    description: '用于公开真题下载流程的测试资料。',
    questionCount: 48,
    pageCount: 16,
    hasAnswers: true,
    hasSolutions: true,
    isFree: true,
    isPublished: true,
    isFeatured: true,
    sortOrder: 1,
    downloadCount: 7,
    primaryFileUrl: '/uploads/past-papers/math-sample.pdf',
    fileCount: 1,
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    version: 1
  };
  const file = {
    id: 501,
    kind: 'paper',
    label: '真题原卷 PDF',
    fileUrl: '/uploads/past-papers/math-sample.pdf',
    originalFilename: 'math-sample.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 12345,
    checksum: 'sample',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z'
  };
  const bundle = {
    id: 701,
    slug: 'math-2026-bundle',
    title: '数学 2026 真题套装',
    category: 'past-paper',
    subjectScope: 'math',
    language: 'zh',
    description: '数学真题原卷与答案解析。',
    highlights: ['原卷与解析'],
    tags: ['2026'],
    isFeatured: true,
    isPublished: true,
    sortOrder: 1,
    itemCount: 1,
    fileCount: 1,
    questionCount: 48,
    downloadCount: 7,
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    version: 1
  };

  await page.route((url) => url.pathname === '/api/v1/past-papers', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [paper] }) });
  });
  await page.route((url) => url.pathname === '/api/v1/past-papers/math-2026-sample', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ paper, files: [file] }) });
  });
  await page.route((url) => url.pathname === '/api/v1/resource-bundles', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [bundle] }) });
  });
  await page.route((url) => url.pathname === '/api/v1/resource-bundles/math-2026-bundle', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ bundle, items: [{ id: 801, label: '数学 2026 样卷', sortOrder: 1, paper, files: [file] }] }) });
  });
  await page.route('**/api/v1/past-papers/math-2026-sample/downloads/501', async (route) => {
    counters.downloads += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ url: file.fileUrl, file, paper: { ...paper, downloadCount: 8 } })
    });
  });
  return counters;
}

async function mockSpecialPracticeFlow(page: Page) {
  const topic = {
    id: 11,
    subject: 'math',
    module: '集合与不等式',
    slug: 'math-set',
    title: '集合',
    description: '掌握集合表示、交集、并集、补集和元素关系。',
    estimatedMinutes: 20,
    questionCount: 2,
    publishedQuestionCount: 2,
    sessionCount: 0
  };
  const session = {
    id: 701,
    topic,
    language: 'zh',
    startedAt: '2026-05-09T00:00:00.000Z',
    completedAt: null,
    answers: {},
    timeSpent: {},
    currentQuestion: 1,
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: 0
  };
  const questions = [
    {
      id: 7101,
      orderNumber: 1,
      difficulty: '较易',
      questionType: 'single-choice',
      prompt: '设集合 A={1,2,3}，B={2,3,4}，则 A∩B=（ ）',
      options: [{ id: 'A', text: '{2,3}' }, { id: 'B', text: '{1,4}' }, { id: 'C', text: '{1,2,3,4}' }, { id: 'D', text: '{4}' }]
    },
    {
      id: 7102,
      orderNumber: 2,
      difficulty: '较易',
      questionType: 'single-choice',
      prompt: '集合 A={1,2}，B={2,3}，则 A∪B=（ ）',
      options: [{ id: 'A', text: '{2}' }, { id: 'B', text: '{1,2,3}' }, { id: 'C', text: '{1,3}' }, { id: 'D', text: '{3}' }]
    }
  ];
  const report = {
    session: { ...session, completedAt: '2026-05-09T00:05:00.000Z', answers: { 7101: 'A', 7102: 'A' }, correctCount: 1, wrongCount: 1, unansweredCount: 0 },
    summary: { correctCount: 1, wrongCount: 1, unansweredCount: 0, total: 2, accuracy: 50, totalSeconds: 12, averageSeconds: 6 },
    weakTags: [{ tag: '集合与不等式', total: 2, wrong: 1 }],
    items: [
      { ...questions[0], selected: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, explanation: '交集保留共有元素。', knowledgeTags: ['集合与不等式'], secondsSpent: 5 },
      { ...questions[1], selected: 'A', correctAnswer: 'B', isCorrect: false, isUnanswered: false, explanation: '并集包含两个集合全部元素。', knowledgeTags: ['集合与不等式'], secondsSpent: 7 }
    ]
  };

  await page.route('**/api/v1/csca-special-practice/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subjects: [{ id: 'math', title: '数学', description: '数学专项', tags: ['集合与不等式'], topicCount: 1, questionCount: 2, freeTopicSlug: 'math-set' }],
        totals: { subjectCount: 1, topicCount: 1, questionCount: 2 },
        features: ['即时反馈'],
        mockExamPath: '/csca-mock-exam'
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/subjects/math**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: { id: 'math', title: '数学', description: '数学专项', tags: ['集合与不等式'] },
        stats: { topicCount: 1, questionCount: 2, estimatedMinutes: 20 },
        modules: [{ module: '集合与不等式', topics: [topic] }]
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/topics/math-set/start**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ topic, focus: ['集合与不等式'], advice: '先做题再看解析。', questionPreviewCount: 2 }) });
  });
  await page.route('**/api/v1/csca-special-practice/topics/math-set/sessions**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.route('**/api/v1/csca-special-practice/sessions/701**', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ session, questions }) });
  });
  await page.route('**/api/v1/csca-special-practice/sessions/701/check**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const questionId = Number(body.questionId);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(questionId === 7101
        ? { questionId, selected: body.selected, correctAnswer: 'A', isCorrect: body.selected === 'A', explanation: '交集保留共有元素。', knowledgeTags: ['集合与不等式'] }
        : { questionId, selected: body.selected, correctAnswer: 'B', isCorrect: body.selected === 'B', explanation: '并集包含两个集合全部元素。', knowledgeTags: ['集合与不等式'] })
    });
  });
  await page.route('**/api/v1/csca-special-practice/sessions/701/submit**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(report) });
  });
  await page.route('**/api/v1/csca-special-practice/sessions/701/report**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(report) });
  });
}

async function mockAdaptiveSubjectLaunch(page: Page, options: { staleReport?: boolean; summaryDelayMs?: number; nextRoundPoolExhausted?: boolean } = {}) {
  const counters = { roundSummaryCalls: 0, nextSessionCalls: 0 };
  await useChineseLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await mockSubjectLearningData(page, 'student');

  const session = {
    id: 501,
    userId: 2,
    subject: 'math',
    mode: 'diagnostic',
    status: 'active',
    startedAt: '2026-05-12T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z'
  };
  const nextSession = {
    ...session,
    id: 502,
    mode: 'practice',
    startedAt: '2026-05-12T00:21:00.000Z',
    createdAt: '2026-05-12T00:21:00.000Z',
    updatedAt: '2026-05-12T00:21:00.000Z'
  };
  const round = {
    id: 601,
    sessionId: 501,
    roundIndex: 1,
    status: 'active',
    plannerSnapshot: { mode: 'diagnostic', requestedSize: 20 },
    answers: {},
    timeSpent: {},
    currentQuestion: 1,
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: 20,
    startedAt: '2026-05-12T00:00:00.000Z',
    submittedAt: null,
    version: 1
  };
  const nextRound = {
    ...round,
    id: 602,
    sessionId: 502,
    roundIndex: 1,
    plannerSnapshot: { mode: 'practice', requestedSize: 5 },
    unansweredCount: 5
  };
  const questions = Array.from({ length: 20 }, (_, index) => ({
    id: 9000 + index,
    orderNumber: index + 1,
    position: index + 1,
    topicId: 100 + index,
    topicCode: index % 2 === 0 ? 'math.functions' : 'math.geometry',
    topicTitle: index % 2 === 0 ? '函数' : '平面解析几何',
    difficulty: index < 6 ? '较易' : index < 14 ? '中等' : '较难',
    questionType: 'single-choice',
    prompt: `诊断混合题 ${index + 1}（ ）`,
    options: [
      { id: 'A', text: '选项 A' },
      { id: 'B', text: '选项 B' },
      { id: 'C', text: '选项 C' },
      { id: 'D', text: '选项 D' }
    ]
  }));
  const submittedAt = options.staleReport ? new Date(Date.now() - 31 * 60 * 1000).toISOString() : new Date().toISOString();
  const detail = { session, round, questions };
  const nextDetail = { session: nextSession, round: nextRound, questions: questions.slice(0, 5) };
  const report = {
    session: { ...session, mode: 'practice', status: 'completed', completedAt: submittedAt },
    round: { ...round, roundIndex: 2, status: 'submitted', correctCount: 3, wrongCount: 2, unansweredCount: 0, submittedAt },
    summary: { correctCount: 3, wrongCount: 2, unansweredCount: 0, total: 5, accuracy: 60, totalSeconds: 360 },
    weakTopics: [{ topicId: 101, code: 'math.geometry', title: '平面解析几何' }],
    nextRecommendation: 'continue_weak_topics',
    trend: {
      sampleSize: 5,
      recentRounds: [
        { roundId: 596, roundIndex: 1, mode: 'practice', accuracy: 40, correctCount: 2, wrongCount: 3, unansweredCount: 0, total: 5, totalSeconds: 420, averageSeconds: 84, averageDifficulty: 1.6, difficultyLabel: '中等', submittedAt: '2026-05-08T00:20:00.000Z' },
        { roundId: 597, roundIndex: 2, mode: 'practice', accuracy: 60, correctCount: 3, wrongCount: 2, unansweredCount: 0, total: 5, totalSeconds: 380, averageSeconds: 76, averageDifficulty: 1.8, difficultyLabel: '中等', submittedAt: '2026-05-09T00:20:00.000Z' },
        { roundId: 598, roundIndex: 3, mode: 'practice', accuracy: 60, correctCount: 3, wrongCount: 2, unansweredCount: 0, total: 5, totalSeconds: 370, averageSeconds: 74, averageDifficulty: 2, difficultyLabel: '中等', submittedAt: '2026-05-10T00:20:00.000Z' },
        { roundId: 599, roundIndex: 4, mode: 'practice', accuracy: 80, correctCount: 4, wrongCount: 1, unansweredCount: 0, total: 5, totalSeconds: 350, averageSeconds: 70, averageDifficulty: 2, difficultyLabel: '中等', submittedAt: '2026-05-11T00:20:00.000Z' },
        { roundId: 601, roundIndex: 5, mode: 'practice', accuracy: 60, correctCount: 3, wrongCount: 2, unansweredCount: 0, total: 5, totalSeconds: 360, averageSeconds: 72, averageDifficulty: 3, difficultyLabel: '较难', submittedAt: '2026-05-12T00:20:00.000Z' }
      ],
      averageAccuracy: 60,
      averageSeconds: 75,
      previousAccuracy: 80,
      accuracyDelta: -20,
      direction: 'declining',
      currentDifficulty: 3,
      currentDifficultyLabel: '较难',
      previousDifficulty: 2,
      difficultyDelta: 1,
      difficultyDirection: 'increased',
      repeatedWeakTopics: [{ topicId: 101, code: 'math.geometry', title: '平面解析几何', count: 3 }]
    },
    items: questions.slice(0, 5).map((question, index) => ({
      ...question,
      selectedAnswer: index < 3 ? 'A' : 'B',
      correctAnswer: 'A',
      isCorrect: index < 3,
      isUnanswered: false,
      explanation: index < 3 ? '这题基础判断正确。' : '先确认图形条件，再代入公式。',
      knowledgeTags: index === 0 ? [question.topicTitle, question.topicTitle] : [question.topicTitle],
      timeSpentSeconds: 72,
      mastery: index < 3 ? 0.66 : 0.42
    }))
  };

  await page.route('**/api/v1/csca-special-practice/adaptive/overview**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, {
      subjects: [
        { id: 'math', title: '数学', topicCount: 12, questionCount: 240, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
        { id: 'physics', title: '物理', topicCount: 21, questionCount: 420, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
        { id: 'chemistry', title: '化学', topicCount: 15, questionCount: 300, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' }
      ],
      roundSize: 5,
      diagnosticRoundSize: 20,
      requiresLogin: true
    });
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, { enabled: true, balanceUnits: 3, lifetimeGranted: 3, lifetimeUsed: 0, initialFreeUnits: 3 });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/sessions', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.subject).toBe('math');
    if (body.mode === 'practice') {
      counters.nextSessionCalls += 1;
      await fulfillJson(route, nextSession);
      return;
    }
    expect(body.mode).toBe('diagnostic');
    await fulfillJson(route, session);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/sessions/501/rounds**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, detail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/sessions/502/rounds**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    if (options.nextRoundPoolExhausted) {
      await fulfillJson(route, {
        statusCode: 400,
        code: 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED',
        message: '这组练习你已经刷完啦。我们正在补充新的适配题，稍后再来会有更多题目。'
      }, 400);
      return;
    }
    await fulfillJson(route, nextDetail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/601**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    if (route.request().method() === 'PATCH') {
      await fulfillJson(route, { ...round, version: 2 });
      return;
    }
    await fulfillJson(route, detail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/602**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, nextDetail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/601/report**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, report);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/round-summary', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.roundId).toBe(601);
    counters.roundSummaryCalls += 1;
    if (options.summaryDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.summaryDelayMs));
    }
    await fulfillJson(route, {
      id: 8601,
      type: 'round_summary',
      provider: 'openai-compatible',
      model: 'deepseek-v4',
      promptVersion: 'coach-v2-safety',
      status: 'success',
      output: '【本轮判断】正确率 60%，错误集中在平面解析几何。\n【下一步重点】先修正斜率和圆方程半径的判断。\n【一个动作】开始下一轮前，先复盘 1 道同类错题。',
      createdAt: '2026-06-08T00:00:00.000Z'
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai-interactions/8601/feedback', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.rating).toBe(5);
    await fulfillJson(route, { id: 9601, interactionId: 8601, rating: 5, createdAt: '2026-06-08T00:00:00.000Z' });
  });
  return counters;
}

test.describe('public route smoke', () => {
  for (const item of ROUTES) {
    test(`${item.path} renders without console errors`, async ({ page }) => {
      if (item.path.startsWith('/csca-subjects/')) await mockSubjectLearningData(page);
      if (item.path === '/csca-mock-exam') await mockMockExamFlow(page);
      if (item.path === '/past-papers') await mockPastPapers(page);

      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) {
          const sourceUrl = message.location().url;
          consoleErrors.push(sourceUrl ? `${message.text()} (${sourceUrl})` : message.text());
        }
      });

      await page.goto(item.path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(item.title);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test('past papers list detail and download flow', async ({ page }) => {
  const counters = await mockPastPapers(page);

  await page.goto('/past-papers');
  await expect(page.getByRole('heading', { name: 'CSCA 真题下载中心' })).toBeVisible();
  await expect(page.locator('body')).toContainText('数学 2026 真题套装');

  await page.getByRole('button', { name: '进入下载页' }).click();
  await expect(page).toHaveURL(/\/zh\/past-papers\/bundles\/math-2026-bundle$/);
  await expect(page.getByRole('heading', { name: '数学 2026 真题套装' })).toBeVisible();
  await expect(page.locator('body')).toContainText('数学 2026 样卷');
  await page.getByRole('button', { name: '免费下载' }).click();
  await expect.poll(() => counters.downloads).toBe(1);
});

test.skip('retired school filters sync to URL and browser history', async ({ page }) => {
  await page.goto('/schools');
  const searchInput = page.getByRole('textbox', { name: /搜索学校 \/ 要求/ });
  await searchInput.fill('HSK');
  await expect(page).toHaveURL(/keyword=HSK/);

  await page.getByRole('button', { name: '要求提供' }).click();
  await expect(page).toHaveURL(/cscaRequired=true/);

  await page.goBack();
  await expect(page).not.toHaveURL(/cscaRequired=true/);
  await expect(searchInput).toHaveValue('HSK');
});

test('mock exam free paper flows from overview to report', async ({ page }) => {
  await useChineseLocale(page);
  await mockMockExamFlow(page);

  await page.goto('/csca-mock-exam');
  await page.getByRole('button', { name: '进入数学模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/math$/);
  await page.locator('.mock-paper-card').filter({ hasText: 'CSCA 数学在线模考 1' }).getByRole('button', { name: '开始免费试做' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/math\/math-mock-1$/);
  await page.getByRole('button', { name: '开始模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/attempts\/901$/);

  await page.getByRole('button', { name: /A 2,3/ }).click();
  await page.getByRole('button', { name: '下一题' }).click();
  await page.getByRole('button', { name: /A \(1,0\)/ }).click();
  await page.getByRole('button', { name: '交卷' }).click();
  await page.getByRole('button', { name: '确认交卷' }).click();

  await expect(page).toHaveURL(/\/csca-mock-exam\/attempts\/901\/report$/);
  await expect(page.locator('body')).toContainText('模考成绩报告');
  await expect(page.locator('body')).toContainText('题目回顾');
  await page.locator('.mock-review-list .mock-review-row').filter({ hasText: 'A → A' }).click();
  await expect(page.locator('.mock-review-options')).toContainText('正确');
  await page.locator('.mock-review-list .mock-review-row').filter({ hasText: 'A → B' }).click();
  await expect(page.locator('.mock-review-options')).toContainText('你的答案');
  await page.locator('.mock-review-list .mock-review-row').filter({ hasText: '未答' }).click();
  await expect(page.locator('.mock-review-choice-summary')).toContainText('未作答');
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('mock exam subject page recommends the next paper in place', async ({ page }) => {
  await useChineseLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  const paperOne = {
    id: 1,
    subject: 'math',
    slug: 'math-mock-1',
    title: '数学模拟卷 1',
    description: '数学演示模考卷。',
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: '免费',
    isFree: true,
    isLocked: false
  };
  const paperTwo = { ...paperOne, id: 2, slug: 'math-mock-2', title: '数学模拟卷 2' };

  await page.route('**/api/v1/auth/me**', async (route) => {
    await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/overview**', async (route) => {
    await fulfillJson(route, {
      subjects: [
        { id: 'math', title: '数学', topicCount: 12, questionCount: 240, averageMastery: 58, activeSessionId: 701, nextAction: 'continue_training' },
        { id: 'physics', title: '物理', topicCount: 21, questionCount: 420, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
        { id: 'chemistry', title: '化学', topicCount: 15, questionCount: 300, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' }
      ],
      roundSize: 5,
      diagnosticRoundSize: 20,
      requiresLogin: true
    });
  });
  await page.route('**/api/v1/csca-mock-exam/my-attempts**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer student-token');
    await fulfillJson(route, {
      items: [{
        id: 901,
        paper: paperOne,
        score: 72,
        correctCount: 35,
        wrongCount: 13,
        unansweredCount: 0,
        startedAt: '2026-05-09T00:00:00.000Z',
        submittedAt: '2026-05-09T01:00:00.000Z',
        reportPath: '/csca-mock-exam/attempts/901/report'
      }]
    });
  });
  await page.route('**/api/v1/csca-mock-exam/subjects/math**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer student-token');
    await fulfillJson(route, {
      subject: { id: 'math', title: '数学', shortTitle: '数学', accent: 'blue', description: '数学模考', tags: ['函数', '几何'] },
      papers: [paperOne, paperTwo],
      pastPapers: [],
      recommendation: {
        mode: 'mastery_bridge',
        label: '掌握度联动',
        title: '后端推荐：数学模拟卷 2',
        body: '当前专项掌握度 58%。先用完整卷检验题型迁移。',
        actionLabel: '进入推荐卷',
        target: { type: 'paper', paperSlug: 'math-mock-2' },
        paper: paperTwo,
        scoreLabel: '72 分',
        masteryLabel: '58%'
      },
      bundle: { title: '数学模考套卷包', priceLabel: '免费', description: '免费开放。' }
    });
  });
  await page.route('**/api/v1/csca-mock-exam/papers/math-mock-2/start**', async (route) => {
    await fulfillJson(route, { paper: paperTwo, locked: false, rules: ['提交后查看解析。'] });
  });

  await page.goto('/csca-mock-exam/math');
  await expect(page.getByLabel('系统推荐模考')).toContainText('后端推荐：数学在线模考 2');
  await expect(page.getByLabel('系统推荐模考')).toContainText('专项掌握度 58%');
  await expect(page.locator('.mock-paper-card.recommended')).toContainText('CSCA 数学在线模考 2');
  await page.getByRole('button', { name: '进入推荐模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/math\/math-mock-2$/);
});

test('old special practice user route is no longer exposed', async ({ page }) => {
  await useChineseLocale(page);
  await page.goto('/csca-special-practice');
  await expect(page.getByRole('heading', { name: '没有找到这个页面。' })).toBeVisible();
});

test('subject practice starts the first 20-question diagnostic from the subject page', async ({ page }) => {
  await mockAdaptiveSubjectLaunch(page);

  await page.goto('/csca-subjects/math');
  await expect(page.getByRole('button', { name: '开始 20 题诊断' })).toHaveCount(1);
  await expect(page.locator('.subject-learning-hero-note')).toHaveCount(0);
  const diagnosticButton = page.locator('#practice').getByRole('button', { name: '开始 20 题诊断' });
  await diagnosticButton.evaluate((button) => {
    button.addEventListener('click', () => {
      window.localStorage.setItem('cscalite.accessToken', 'student-token');
    }, { capture: true, once: true });
  });
  await diagnosticButton.click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/practice\/rounds\/601$/);
  await expect(page.locator('body')).toContainText('诊断混合题 1');
  await expect(page.locator('body')).toContainText(/第 1 \/ 20 题|1\/20/);
  await expect(page.locator('body')).toContainText('AI Coach');
  await expect(page.locator('body')).toContainText('AI 3 次');
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('subject practice pool exhaustion shows replenishing state from the subject page', async ({ page }) => {
  await useChineseLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await mockSubjectLearningData(page, 'student');
  await page.route('**/api/v1/csca-special-practice/adaptive/sessions', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.subject).toBe('math');
    expect(body.mode).toBe('diagnostic');
    await fulfillJson(route, {
      id: 501,
      userId: 2,
      subject: 'math',
      mode: 'diagnostic',
      status: 'active',
      startedAt: '2026-05-12T00:00:00.000Z',
      completedAt: null,
      createdAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-12T00:00:00.000Z'
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/sessions/501/rounds', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, {
      statusCode: 400,
      code: 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED',
      message: '这组练习你已经刷完啦。我们正在补充新的适配题，稍后再来会有更多题目。'
    }, 400);
  });

  await page.goto('/csca-subjects/math');
  const diagnosticButton = page.locator('#practice').getByRole('button', { name: '开始 20 题诊断' });
  await diagnosticButton.evaluate((button) => {
    button.addEventListener('click', () => {
      window.localStorage.setItem('cscalite.accessToken', 'student-token');
    }, { capture: true, once: true });
  });
  await diagnosticButton.click();
  await expect(page).toHaveURL(/\/csca-subjects\/math$/);
  await expect(page.locator('#practice')).toContainText('这组练习你已经刷完啦。');
  await expect(page.locator('#practice')).toContainText('我们正在努力补充新的适配题');
  await expect(page.locator('#practice')).not.toContainText('当前题库不足以生成完整自适应训练轮');
});

test('subject practice entry resumes an active training session', async ({ page }) => {
  await useChineseLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await mockSubjectLearningData(page, 'student');
  await page.route('**/api/v1/auth/me**', async (route) => {
    await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/overview**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, {
      subjects: [
        { id: 'math', title: '数学', topicCount: 12, questionCount: 240, averageMastery: 58, activeSessionId: 701, nextAction: 'continue_training' },
        { id: 'physics', title: '物理', topicCount: 21, questionCount: 420, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' },
        { id: 'chemistry', title: '化学', topicCount: 15, questionCount: 300, averageMastery: null, activeSessionId: null, nextAction: 'start_diagnostic' }
      ],
      roundSize: 5,
      diagnosticRoundSize: 20,
      requiresLogin: true
    });
  });

  await page.goto('/csca-subjects/math');
  await expect(page.locator('#practice')).toContainText('继续完成上次训练。');
  await expect(page.locator('#practice')).toContainText('自动续上进度');
  await expect(page.getByRole('button', { name: '继续未完成训练' })).toHaveCount(1);
  await expect(page.locator('.subject-learning-hero-note')).toHaveCount(0);
  await expect(page.locator('#practice').getByRole('button', { name: '继续未完成训练' })).toBeVisible();
});

test('subject practice shows a single AI mistake explanation with usable feedback controls', async ({ page }) => {
  await mockAdaptiveSubjectLaunch(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    await fulfillJson(route, { id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' });
  });

  let feedbackCount = 0;
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/601/check', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.questionId).toBe(9000);
    expect(body.selected).toBe('B');
    await fulfillJson(route, {
      questionId: 9000,
      selected: 'B',
      correctAnswer: 'D',
      isCorrect: false,
      explanation: '【知识点】旧标准解析\n【分析】这段不应在 AI 可用时显示。\n【详解】旧解析兜底。',
      knowledgeTags: ['平面解析几何', '平行直线']
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/explain', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.roundId).toBe(601);
    expect(body.questionId).toBe(9000);
    expect(body.selected).toBe('B');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fulfillJson(route, {
      id: 'ai-explain-1',
      type: 'explain_wrong_answer',
      provider: 'openai-compatible',
      model: 'deepseek-v4-flash',
      promptVersion: 'coach-v2-safety',
      status: 'success',
      output: '关键是 **平行直线的斜率相同**。你把相反数关系当成了相同斜率。',
      createdAt: '2026-06-08T00:00:00.000Z'
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai-interactions/ai-explain-1/feedback', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: E2E_CORS_HEADERS });
      return;
    }
    feedbackCount += 1;
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.rating).toBe(5);
    await fulfillJson(route, { id: 'feedback-1', interactionId: 'ai-explain-1', rating: 5, createdAt: '2026-06-08T00:00:00.000Z' });
  });

  await page.goto('/csca-subjects/math/practice/rounds/601');
  await page.getByRole('button', { name: /B 选项 B/ }).click();
  await expect(page.locator('body')).toContainText('答错了，正确答案是 D');
  await page.getByRole('button', { name: '查看解析' }).click();
  await expect(page.getByRole('button', { name: '生成解析中...' })).toBeVisible();
  await expect(page.locator('.special-review-explanation.loading')).toContainText('正在结合你的答案生成错因分析...');
  const explanation = page.locator('.special-review-explanation').filter({ hasText: 'AI 错因解析' });
  await expect(explanation).toContainText('平行直线的斜率相同');
  await expect(explanation.locator('strong')).toContainText('平行直线的斜率相同');
  await expect(explanation).not.toContainText('旧标准解析');

  await page.getByRole('button', { name: '这条 AI 解析有用' }).click();
  await expect(page.locator('.special-ai-feedback-note.success')).toContainText('已收到反馈');
  await page.getByRole('button', { name: '这条 AI 解析有用' }).click({ force: true }).catch(() => undefined);
  expect(feedbackCount).toBe(1);
});

test('subject practice report gives adaptive motivation before details', async ({ page }) => {
  await mockAdaptiveSubjectLaunch(page, { summaryDelayMs: 1000 });
  const duplicateKeyWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('same key')) duplicateKeyWarnings.push(message.text());
  });

  await page.goto('/csca-subjects/math/practice/rounds/601/report');
  await expect(page.locator('.special-report-motivation-card')).toContainText('这一轮问题比较集中，适合短轮修正。');
  await expect(page.locator('.special-report-motivation-card')).toContainText('平面解析几何');
  await expect(page.locator('.special-report-motivation-card')).toContainText('压力测试');
  await expect(page.locator('.special-report-motivation-card')).toContainText('不应直接理解成退步');
  await expect(page.locator('.special-report-motivation-card')).toContainText('本轮难度 较难');
  await expect(page.locator('.special-report-motivation-card')).toContainText('近 5 轮均值 60%');
  await expect(page.locator('.special-report-motivation-card')).toContainText('长期进步');
  await expect(page.locator('.special-report-data-strip')).toContainText('正确');
  await expect(page.getByText('查看本轮数据')).toHaveCount(0);
  await expect(page.locator('.special-report-ai-card.loading')).toContainText('正在生成本轮 AI 分析。');
  await expect(page.locator('.special-report-ai-promises')).toContainText('错因归纳');
  await expect(page.locator('.special-report-loading')).toBeVisible();
  await expect(page.locator('.special-report-ai-card')).toContainText('AI 已生成 3 条复盘建议。');
  await expect(page.locator('.special-report-ai-output')).toContainText('【本轮判断】正确率 60%');
  await expect(page.locator('.special-report-next-card')).toContainText('下一轮 5 题已经准备好');
  await expect(page.locator('.special-report-action-panel')).toContainText('下一轮 5 题已经准备好');
  await expect(page.getByRole('button', { name: '开始下一轮' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新生成' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '立即分析' })).toHaveCount(0);
  await expect(page.locator('.special-review-list article').first().locator('.special-review-tags b')).toHaveCount(2);
  expect(duplicateKeyWarnings).toEqual([]);
  await page.getByRole('button', { name: '这条 AI 总结有用' }).click();
  await expect(page.locator('.special-ai-feedback-note.success')).toContainText('已收到反馈');
  await page.getByRole('button', { name: '开始下一轮' }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/practice\/rounds\/602$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('subject practice pool exhaustion stops next-round preparation on the report page', async ({ page }) => {
  await page.addInitScript(() => {
    const tokenKey = 'cscalite.accessToken';
    const getItem = Storage.prototype.getItem;
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.getItem = function patchedGetItem(key) {
      if (key === tokenKey) return 'student-token';
      return getItem.call(this, key);
    };
    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      if (key === tokenKey) return;
      return removeItem.call(this, key);
    };
    window.localStorage.setItem(tokenKey, 'student-token');
  });
  const counters = await mockAdaptiveSubjectLaunch(page, { nextRoundPoolExhausted: true });

  await page.goto('/csca-subjects/math/practice/rounds/601');
  await expect(page.locator('body')).toContainText('诊断混合题 1');
  await page.goto('/csca-subjects/math/practice/rounds/601/report');
  await expect(page.locator('.special-report-action-panel')).toContainText('这组练习你已经刷完啦。');
  await expect(page.locator('.special-report-action-panel')).toContainText('题库补货中');
  await expect(page.getByRole('button', { name: '题库补货中' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('下一轮暂时没有准备好');
  await expect.poll(() => counters.nextSessionCalls).toBe(1);
});

test('subject practice old report waits for user before spending AI or preparing the next round', async ({ page }) => {
  const counters = await mockAdaptiveSubjectLaunch(page, { staleReport: true });

  await page.goto('/csca-subjects/math/practice/rounds/601/report');
  await expect(page.locator('.special-report-ai-card')).toContainText('本轮 AI 分析未自动生成。');
  await expect(page.getByRole('button', { name: '准备下一轮' })).toBeVisible();
  await expect(page.getByRole('button', { name: '立即分析' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试分析' })).toHaveCount(0);
  expect(counters.roundSummaryCalls).toBe(0);
  expect(counters.nextSessionCalls).toBe(0);
});

test('special practice math visualizer shows trig values and formula link', async ({ page }) => {
  await useChineseLocale(page);
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/trigonometric-functions');

  await expect(page.getByTestId('trig-values')).toContainText('sin(45°) = 0.7071');
  await expect(page.getByTestId('trig-values')).toContainText('cos(45°) = 0.7071');
  await page.getByLabel('tan').check();
  await expect(page.getByTestId('trig-values')).toContainText('tan(45°) = 1.0000');
  await expect(page.locator('.tan-curve')).toBeVisible();
  await expect(page.locator('.tan-line')).toHaveCount(1);

  await page.getByLabel('角度 θ').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '90');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('trig-values')).toContainText('tan(90°) = 未定义');
  await expect(page.locator('body')).toContainText('tan 未定义');

  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/formulas#trigonometry$/);
  await expect(page.locator('#trigonometry')).toContainText('正切定义');

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice math visualizer list exposes available simulations', async ({ page }) => {
  await useChineseLocale(page);
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize');
  await expect(page).toHaveURL(/\/csca-subjects\/math\/visualize$/);
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /三角函数与单位圆交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /函数图像变换交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /集合运算韦恩图交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /初等函数对比交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /不等式解集可视化/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /数列可视化/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /概率统计模拟器/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /向量运算交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /圆锥曲线交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /空间坐标系交互演示/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /立体几何 3D 图形探索/ })).toBeVisible();
  await expect(page.locator('.special-interactive-grid').getByRole('button', { name: /微积分可视化/ })).toBeVisible();

  await page.goto('/csca-subjects/math/formulas');
  const formulaSimulations = page.getByRole('region', { name: '数学交互模拟入口' });
  await expect(formulaSimulations.getByRole('button', { name: /查看三角函数与单位圆交互演示/ })).toBeVisible();
  await expect(formulaSimulations.getByRole('button', { name: /查看立体几何 3D 图形探索/ })).toBeVisible();
  await formulaSimulations.getByRole('button', { name: /查看立体几何 3D 图形探索/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/visualize\/solid-geometry$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice function transformation visualizer updates formula and links formulas', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/function-transformations');
  await expect(page.getByTestId('function-formula')).toContainText('f(x)=x²');
  await page.getByRole('button', { name: '√x' }).click();
  await expect(page.getByTestId('function-formula')).toContainText('f(x)=√x');
  const initialPath = await page.getByTestId('function-curve').getAttribute('d');
  await page.getByLabel('参数 d').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '2');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('function-formula')).toContainText('+ 2');
  await expect.poll(async () => page.getByTestId('function-curve').getAttribute('d')).not.toBe(initialPath);

  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#functions$/);
  await expect(page.locator('#functions')).toContainText('换底公式');

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice elementary functions visualizer compares curves', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/elementary-functions');
  await expect(page.getByTestId('elementary-summary')).toContainText('y=kx+b');
  await expect(page.getByTestId('elementary-curve-linear')).toBeVisible();
  await page.getByLabel('对数函数').check();
  await expect(page.getByTestId('elementary-summary')).toContainText('y=logₐx');
  const initialPath = await page.getByTestId('elementary-curve-exponential').getAttribute('d');
  await page.getByLabel('底数 a').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '3');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => page.getByTestId('elementary-curve-exponential').getAttribute('d')).not.toBe(initialPath);

  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#functions$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice inequality visualizer updates solution intervals', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/inequality-solutions');
  await expect(page.getByTestId('inequality-expression')).toContainText('2x - 4 ≥ 0');
  await expect(page.getByTestId('inequality-result')).toContainText('x ≥ 2');
  await expect(page.locator('.special-number-line .solution-line')).toHaveCount(1);
  await page.getByRole('button', { name: '二次不等式' }).click();
  await expect(page.getByTestId('inequality-expression')).toContainText('x² - 2x - 3 ≥ 0');
  await expect(page.getByTestId('inequality-result')).toContainText('x ≤ -1 或 x ≥ 3');
  await page.getByRole('button', { name: '< 0' }).click();
  await expect(page.getByTestId('inequality-result')).toContainText('-1 < x < 3');

  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#sets$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice set operations visualizer switches results and links formulas', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/set-operations');
  await expect(page.getByTestId('set-result')).toContainText('A ∪ B = {1, 2, 3, 4, 5, 7}');
  await page.locator('.special-set-tabs').getByRole('button', { name: 'A ∩ B' }).click();
  await expect(page.getByTestId('set-result')).toContainText('A ∩ B = {2, 5}');
  await page.locator('.special-set-tabs').getByRole('button', { name: 'A \\ B' }).click();
  await expect(page.getByTestId('set-result')).toContainText('A \\ B = {1, 4}');
  await page.locator('.special-set-tabs').getByRole('button', { name: 'A △ B' }).click();
  await expect(page.getByTestId('set-result')).toContainText('A △ B = {1, 3, 4, 7}');

  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#sets$/);
  await expect(page.getByRole('heading', { name: '数学公式速查表' })).toBeVisible();
  await expect(page.locator('body')).toContainText('集合');

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice sequence probability and vector visualizers are interactive', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/sequence-visualizer');
  await expect(page.getByTestId('sequence-formula')).toContainText('aₙ = 2 + (n-1)·3');
  await expect(page.getByTestId('sequence-result')).toContainText('Sₙ =');
  await page.getByRole('button', { name: '等比数列' }).click();
  await expect(page.getByTestId('sequence-formula')).toContainText('aₙ = 2·1.4ⁿ⁻¹');
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#functions$/);

  await page.goto('/csca-subjects/math/visualize/probability-simulator');
  await expect(page.getByTestId('probability-summary')).toContainText('P(A)=0.50');
  const initialCurve = await page.getByTestId('probability-curve').getAttribute('d');
  await page.getByRole('button', { name: '重新模拟' }).click();
  await expect.poll(async () => page.getByTestId('probability-curve').getAttribute('d')).not.toBe(initialCurve);
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#probability$/);

  await page.goto('/csca-subjects/math/visualize/vector-operations');
  await expect(page.getByTestId('vector-summary')).toContainText('a·b = 12');
  const initialVector = await page.getByTestId('vector-sum').getAttribute('data-testid');
  await page.getByLabel('向量 ax').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '2');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('vector-summary')).toContainText('a·b = 10');
  expect(initialVector).toBe('vector-sum');
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#geometry$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice conic and coordinate visualizers are interactive', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/conic-sections');
  await expect(page.getByTestId('conic-formula')).toContainText('x²/16 + y²/6.25 = 1');
  await expect(page.getByTestId('conic-curve')).toBeVisible();
  await page.getByRole('button', { name: '抛物线' }).click();
  await expect(page.getByTestId('conic-formula')).toContainText('x² = 6y');
  await page.getByRole('button', { name: '双曲线' }).click();
  await expect(page.getByTestId('conic-formula')).toContainText('x²/16 - y²/6.25 = 1');
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#geometry$/);

  await page.goto('/csca-subjects/math/visualize/coordinate-geometry');
  await expect(page.getByTestId('coordinate-summary')).toContainText('AB = 3.74');
  await expect(page.getByTestId('coordinate-point-a')).toBeVisible();
  await page.getByLabel('B 点 z').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '5');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('coordinate-summary')).toContainText('AB = 5.39');
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#geometry$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('special practice solid geometry and calculus visualizers are interactive', async ({ page }) => {
  await mockSpecialPracticeFlow(page);

  await page.goto('/csca-subjects/math/visualize/solid-geometry');
  await expect(page.getByTestId('solid-formula')).toContainText('V=a³');
  await expect(page.getByTestId('solid-result')).toContainText('体积 27');
  await expect(page.getByTestId('solid-three-panel').locator('canvas')).toBeVisible();
  await expect(page.getByLabel('边长')).toHaveCount(1);
  await expect(page.getByLabel('半径')).toHaveCount(0);
  await expect(page.getByLabel('高度')).toHaveCount(0);
  const canvasSize = await page.getByTestId('solid-three-panel').locator('canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    return { width: element.width, height: element.height };
  });
  expect(canvasSize.width).toBeGreaterThan(100);
  expect(canvasSize.height).toBeGreaterThan(100);
  await expect(page.locator('.special-solid-drag-hint')).toContainText('拖动旋转');
  await expect(page.locator('.special-solid-drag-hint')).toContainText('双指缩放');
  await page.getByRole('button', { name: '长方体' }).click();
  await expect(page.getByTestId('solid-formula')).toContainText('V=abc');
  await expect(page.getByLabel('长度')).toHaveCount(1);
  await expect(page.getByLabel('宽度')).toHaveCount(1);
  await expect(page.getByLabel('高度')).toHaveCount(1);
  await page.getByRole('button', { name: '圆柱' }).click();
  await expect(page.getByTestId('solid-formula')).toContainText('V=πr²h');
  await expect(page.getByLabel('边长')).toHaveCount(0);
  await expect(page.getByLabel('半径')).toHaveCount(1);
  await expect(page.getByLabel('高度')).toHaveCount(1);
  await page.getByLabel('高度').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '5');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('solid-result')).toContainText('体积 62.83');
  await page.getByRole('button', { name: '圆锥' }).click();
  await expect(page.getByTestId('solid-formula')).toContainText('V=1/3πr²h');
  await expect(page.getByLabel('半径')).toHaveCount(1);
  await expect(page.getByLabel('高度')).toHaveCount(1);
  await page.getByRole('button', { name: '球' }).click();
  await expect(page.getByTestId('solid-formula')).toContainText('V=4/3πr³');
  await expect(page.getByLabel('半径')).toHaveCount(1);
  await expect(page.getByLabel('高度')).toHaveCount(0);
  await page.getByRole('button', { name: '三棱柱' }).click();
  await expect(page.getByTestId('solid-formula')).toContainText('V=1/2abh');
  await expect(page.getByLabel('底边')).toHaveCount(1);
  await expect(page.getByLabel('三角形高')).toHaveCount(1);
  await expect(page.getByLabel('棱柱长')).toHaveCount(1);
  await page.getByRole('button', { name: '重置视角' }).click();
  await expect(page.getByTestId('solid-three-panel').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '查看公式' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\/formulas#geometry$/);

  await page.goto('/csca-subjects/math/visualize/calculus-area');
  await expect(page.getByTestId('calculus-summary')).toContainText("f'( -1 ) = -0.44");
  await page.getByRole('button', { name: '积分 / 有符号面积' }).click();
  await expect(page.getByTestId('calculus-summary')).toContainText('∫ f(x)dx');
  await expect(page.getByTestId('calculus-area')).toBeVisible();
  await page.getByLabel('积分右端').evaluate((input) => {
    const range = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(range, '4');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByTestId('calculus-summary')).toContainText('∫ f(x)dx');

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});


test('mock exam all free subjects can create an attempt', async ({ page }) => {
  const subjects = [
    { id: 'math', title: '数学', attemptId: 911 },
    { id: 'physics', title: '物理', attemptId: 912 },
    { id: 'chemistry', title: '化学', attemptId: 913 }
  ];

  await page.route('**/api/v1/csca-mock-exam/subjects/**', async (route) => {
    const subjectId = new URL(route.request().url()).pathname.split('/').pop() || 'math';
    const subject = subjects.find((item) => item.id === subjectId) || subjects[0];
    const paper = {
      id: subject.attemptId,
      subject: subject.id,
      slug: `${subject.id}-mock-1`,
      title: `${subject.title}模拟卷 1`,
      description: `${subject.title}原创仿真模拟卷，48 题 / 60 分钟。`,
      language: 'zh',
      questionCount: 48,
      durationMinutes: 60,
      priceLabel: '免费',
      isFree: true,
      isLocked: false
    };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: { id: subject.id, title: subject.title, shortTitle: subject.title, accent: 'blue', description: '原创仿真模考', tags: ['基础'] },
        papers: [paper, { ...paper, id: subject.attemptId + 100, slug: `${subject.id}-mock-2`, title: `${subject.title}模拟卷 2`, isFree: false, isLocked: true, priceLabel: '$19.99' }],
        pastPapers: [],
        bundle: { title: `${subject.title}模考套卷包`, priceLabel: '$19.99', description: '解锁计划建设中。' }
      })
    });
  });

  for (const subject of subjects) {
    const slug = `${subject.id}-mock-1`;
    const paper = {
      id: subject.attemptId,
      subject: subject.id,
      slug,
      title: `${subject.title}模拟卷 1`,
      description: `${subject.title}原创仿真模拟卷，48 题 / 60 分钟。`,
      language: 'zh',
      questionCount: 48,
      durationMinutes: 60,
      priceLabel: '免费',
      isFree: true,
      isLocked: false
    };
    await page.route(`**/api/v1/csca-mock-exam/papers/${slug}/start**`, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ paper, locked: false, rules: ['原创仿真模拟练习。'] }) });
    });
    await page.route(`**/api/v1/csca-mock-exam/papers/${slug}/attempts**`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: subject.attemptId,
          paper,
          language: 'zh',
          startedAt: '2026-05-09T00:00:00.000Z',
          dueAt: '2026-05-09T01:00:00.000Z',
          submittedAt: null,
          answers: {},
          markedQuestions: [],
          timeSpent: {},
          currentQuestion: 1
        })
      });
    });

    await page.goto(`/csca-mock-exam/${subject.id}/${slug}`);
    await page.getByRole('button', { name: '开始模考' }).click();
    await expect(page).toHaveURL(`/csca-mock-exam/attempts/${subject.attemptId}`);
  }
});

test.skip('retired mobile school advanced filters collapse without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only density check');
  await page.goto('/schools');

  await expect(page.getByRole('button', { name: '更多筛选' })).toBeVisible();
  await expect(page.locator('#school-advanced-filters')).not.toBeVisible();
  await page.getByRole('button', { name: '更多筛选' }).click();
  await expect(page.locator('#school-advanced-filters')).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test.skip('retired school detail save action redirects unauthenticated users with redirect', async ({ page }) => {
  await mockSchoolDetailWithPrograms(page);

  await page.goto('/schools/1');
  await page.getByRole('button', { name: '加入短名单' }).click();
  await expect(page).toHaveURL(/\/auth\?redirect=%2Fschools%2F1/);
});

test.skip('retired school detail program filters show matches and empty state', async ({ page }) => {
  await mockSchoolDetailWithPrograms(page);

  await page.goto('/schools/1');
  const programSection = page.locator('.school-program-section');
  await expect(programSection).toContainText('可选专业');
  await expect(programSection).toContainText('计算机科学');

  const filters = programSection.locator('.school-program-filters select');
  await filters.nth(0).selectOption('本科');
  await filters.nth(1).selectOption('英文授课');
  await filters.nth(2).selectOption('数学');
  await expect(programSection).toContainText('计算机科学');
  await expect(programSection).not.toContainText('临床医学');

  await filters.nth(2).selectOption('化学');
  await expect(programSection).toContainText('当前专业筛选没有结果。');
});

test.skip('retired admin school program editor saves and archives a program', async ({ page }) => {
  const token = 'admin-token';
  await mockAdminSchoolsWithPrograms(page, token);

  let createdProgram = false;
  let archivedProgram = false;
  await page.route('**/api/v1/admin/schools/1/programs**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().method()).toBe('POST');
    const payload = await route.request().postDataJSON();
    expect(payload.nameZh).toBe('计算机科学');
    expect(payload.cscaSubjects).toEqual(['数学', '物理']);
    createdProgram = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...payload,
        id: 501,
        schoolId: 1,
        status: payload.status ?? 'draft',
        isVerified: false
      })
    });
  });
  await page.route('**/api/v1/admin/schools/1/programs/501**', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().method()).toBe('DELETE');
    archivedProgram = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 501,
        schoolId: 1,
        nameZh: '计算机科学',
        degreeLevel: '本科',
        cscaSubjects: ['数学', '物理'],
        sortOrder: 1,
        status: 'archived',
        isVerified: false
      })
    });
  });

  await page.goto('/admin/schools');
  await expect(page.locator('body')).toContainText('专业数据待补充');
  await page.getByRole('button', { name: '新增专业' }).click();

  const card = page.locator('.admin-program-card').last();
  await card.getByLabel('专业中文名').fill('计算机科学');
  await card.getByLabel('学历层级').fill('本科');
  await card.getByLabel('授课语言').fill('英文授课');
  await card.getByLabel('CSCA 科目').fill('数学、物理');
  await card.getByRole('button', { name: '保存专业' }).click();

  await expect(page.locator('body')).toContainText('已保存专业 计算机科学。');
  expect(createdProgram).toBe(true);

  await page.locator('.admin-program-card').last().getByRole('button', { name: '归档专业' }).click();
  await expect(page.locator('body')).toContainText('已归档专业 计算机科学。');
  expect(archivedProgram).toBe(true);
});

test('admin mock exam validates and imports JSON draft', async ({ page }) => {
  const token = 'admin-token';
  await mockAdminMockExamData(page, token);

  await page.goto('/admin/mock-exams');
  await expect(page.locator('body')).toContainText('模考题库');
  await expect(page.locator('body')).toContainText('数学后台草稿卷');
  await expect(page.locator('body')).toContainText('发布检查未通过');
  await expect(page.getByRole('list', { name: '模拟卷发布流程' })).toContainText('编辑内容');
  await expect(page.getByRole('list', { name: '模拟卷发布流程' })).toContainText('发布上线');

  await page.locator('details.admin-advanced-section > summary').click();
  await page.getByRole('button', { name: '校验 JSON' }).click();
  await expect(page.locator('body')).toContainText('校验通过');
  await expect(page.locator('body')).toContainText('math-admin-draft：更新草稿，1 题');

  await page.getByRole('button', { name: '导入' }).click();
  await expect(page.locator('body')).toContainText('导入完成');
  await expect(page.locator('body')).toContainText('同步 1 题');
});

test('admin special practice validates and imports JSON draft', async ({ page }) => {
  const token = 'admin-token';
  await mockAdminSpecialPracticeData(page, token);

  await page.goto('/admin/special-practice');
  await expect(page.locator('body')).toContainText('专项题库');
  await expect(page.locator('body')).toContainText('集合后台草稿');
  await expect(page.locator('body')).toContainText('发布检查未通过');
  await expect(page.getByRole('list', { name: '专项练习发布流程' })).toContainText('学生可用性检查');
  await expect(page.getByRole('list', { name: '专项练习发布流程' })).toContainText('发布上线');

  await page.locator('details.admin-advanced-section > summary').click();
  await page.getByRole('button', { name: '校验 JSON' }).click();
  await expect(page.locator('body')).toContainText('校验通过');
  await expect(page.locator('body')).toContainText('math-set-admin-draft：更新 topic 草稿，同步 1 题');

  await page.getByRole('button', { name: '导入' }).click();
  await expect(page.locator('body')).toContainText('导入完成');
  await expect(page.locator('body')).toContainText('同步 1 题');
});

test('account page shows special practice history and wrong question loop', async ({ page }) => {
  await useChineseLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: '2', email: 'student@example.com', role: 'student', displayName: 'Student' })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/my-attempts**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/csca-special-practice/my-sessions**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer student-token');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 11,
          topic: { id: 1, slug: 'math-set', title: '集合', subject: 'math', module: '集合与不等式' },
          subject: 'math',
          module: '集合与不等式',
          accuracy: 80,
          correctCount: 8,
          wrongCount: 2,
          unansweredCount: 0,
          startedAt: '2026-05-11T00:00:00.000Z',
          completedAt: '2026-05-11T00:08:00.000Z',
          reportPath: '/csca-special-practice/sessions/11/report'
        }]
      })
    });
  });
  await page.route('**/api/v1/me/csca/wrong-questions**', async (route) => {
    const url = new URL(route.request().url());
    const subject = url.searchParams.get('subject');
    const items = subject === 'physics' ? [] : [{
      itemKey: 'special_practice:11:5',
      sourceType: 'special_practice',
      sourceId: 11,
      questionId: 5,
      subject: 'math',
      topicId: 1,
      topicTitle: '集合',
      topic: { id: 1, slug: 'math-set', title: '集合', subject: 'math', module: '集合与不等式' },
      prompt: '设 A={1,2,3}，B={2,3,4}，则 A∩B=（ ）',
      options: [{ id: 'A', text: '{2,3}' }, { id: 'B', text: '{1,4}' }, { id: 'C', text: '{1,2,3,4}' }, { id: 'D', text: '{4}' }],
      selected: 'B',
      selectedAnswer: 'B',
      correctAnswer: 'A',
      explanation: '交集表示两个集合共有的元素。',
      aiExplanationId: null,
      structuredExplanation: null,
      mistakePattern: { patternType: 'concept', label: '概念理解', confidence: 0.8, source: 'rule' },
      patternType: 'concept',
      patternLabel: '概念理解',
      patternConfidence: 0.8,
      status: 'unreviewed',
      knowledgeTags: ['集合', '交集'],
      timeSpentSeconds: 8,
      lastWrongAt: '2026-05-11T00:08:00.000Z',
      nextReviewAt: null,
      completedAt: '2026-05-11T00:08:00.000Z',
      reviewPath: '/csca-special-practice/sessions/11/report',
      practicePath: '/csca-subjects/math#practice'
    }];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        summary: { total: items.length, unreviewed: items.length, dueForReview: 0, patternTypes: items.length ? [{ patternType: 'concept', label: '概念理解', count: 1 }] : [] },
        reviewPacks: [],
        items
      })
    });
  });
  await page.route('**/api/v1/me/saved-schools**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/me/compare**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/commerce/orders**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.goto('/me');
  await page.getByRole('button', { name: '练习记录', exact: true }).click();
  await expect(page.locator('body')).toContainText('练习记录');
  await expect(page.locator('body')).toContainText('集合 · 80%');
  await page.getByRole('button', { name: /^错题复盘/ }).click();
  await expect(page.locator('body')).toContainText('统一错题本');
  await expect(page.locator('body')).toContainText('你的答案 B');
  await expect(page.locator('body')).toContainText('正确答案 A');
  await page.getByRole('button', { name: '展开复盘' }).click();
  await expect(page.locator('body')).toContainText('选项回顾');
  await expect(page.locator('body')).toContainText('正确答案');
  await expect(page.locator('body')).toContainText('解析');
  await page.locator('.me-wrong-filters select').first().selectOption('physics');
  await expect(page.locator('body')).toContainText('当前筛选下没有错题');
  await page.locator('.me-section-head').getByRole('button', { name: '重置筛选', exact: true }).click();
  await expect(page.locator('body')).toContainText('设 A={1,2,3}');
  await page.getByRole('button', { name: '重新练这个知识点' }).click();
  await expect(page).toHaveURL(/\/zh\/csca-subjects\/math\?practice=topic&topicSlug=math-set#practice$/);
});

test('admin modules share unauthenticated gate', async ({ page }) => {
  for (const path of ['/admin/audit', '/admin/ai', '/admin/ai-question-bank', '/admin/content', '/admin/mock-exams', '/admin/past-papers', '/admin/special-practice', '/admin/organizations', '/admin/users']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText('请先登录管理员账号。');
  }
});

test('admin pages keep the shared site navigation', async ({ page }) => {
  await page.goto('/admin/audit');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('button', { name: '首页', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'CSCA 准备', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: /在线模考/ })).toBeVisible();
});

test('shared back-to-top control appears after scrolling and returns to page start', async ({ page }) => {
  await page.goto('/');
  const backToTop = page.locator('.scroll-to-top');
  await expect(backToTop).toHaveAttribute('data-visible', 'false');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(backToTop).toHaveAttribute('data-visible', 'true');
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
  await expect(backToTop).toHaveAttribute('data-visible', 'false');
});

test('home hero offers two distinct next steps', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('.site-header');
  await expect(header.locator('.site-login-button')).toBeVisible();
  await expect(header.locator('.site-register-button')).toHaveCount(0);

  const actions = page.locator('.home-hero .home-button-row');
  await expect(actions.getByRole('link')).toHaveCount(2);
  await expect(actions.getByRole('link', { name: '开始免费模考' })).toBeVisible();
  await expect(actions.getByRole('link', { name: '进入科目训练' })).toHaveAttribute('href', /csca-subjects\/math#practice$/);
  await expect(actions).not.toContainText('查看科目学习');
});

test('home science lab showcases three lightweight subject experiments', async ({ page }) => {
  await page.goto('/');
  const lab = page.locator('[data-home-marker="home-science-lab"]');
  await expect(lab.getByRole('heading', { name: '把抽象公式，变成可以观察和操作的过程。' })).toBeVisible();
  await expect(lab.locator('.home-science-lab-card')).toHaveCount(3);
  await expect(lab.locator('canvas')).toHaveCount(0);
  await expect(lab.getByRole('link', { name: /空间几何 3D/ })).toHaveAttribute('href', /csca-subjects\/math\/visualize\/solid-geometry$/);
  await expect(lab.getByRole('link', { name: /牛顿第二定律 3D/ })).toHaveAttribute('href', /csca-subjects\/physics\/visualize\/newton-second-law$/);
  await expect(lab.getByRole('link', { name: /分子结构交互模型/ })).toHaveAttribute('href', /csca-subjects\/chemistry\/visualize\/bonding-structure$/);
});

test('default user avatar stays circular and consistent across account surfaces', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'avatar-test-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await fulfillJson(route, {
      id: 'avatar-user-42',
      email: 'avatar@example.com',
      role: 'admin',
      displayName: 'Avatar Tester',
      emailVerifiedAt: '2026-09-10T00:00:00.000Z'
    });
  });
  await page.route('**/api/v1/organization/me/organizations**', async (route) => {
    await fulfillJson(route, { items: [], currentOrganizationId: null });
  });

  await page.goto('/');
  const headerAvatar = page.locator('.site-avatar-button .user-avatar');
  await expect(headerAvatar).toBeVisible();
  const variant = await headerAvatar.getAttribute('data-avatar-variant');
  expect(Number(variant)).toBeGreaterThanOrEqual(1);
  expect(Number(variant)).toBeLessThanOrEqual(8);
  await expect(headerAvatar).toHaveCSS('border-radius', '50%');

  await page.locator('.site-avatar-button').click();
  const menuAvatar = page.locator('.site-account-menu .user-avatar');
  await expect(menuAvatar).toHaveAttribute('data-avatar-variant', variant!);
  await expect(menuAvatar).toHaveCSS('border-radius', '50%');
});

test('non-admin account sees the shared admin permission gate', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'student-token');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '2',
        email: 'student@example.com',
        role: 'student',
        displayName: 'Student'
      })
    });
  });

  await page.goto('/admin/audit');
  await expect(page.locator('body')).toContainText('当前账号没有后台权限。');
  await expect(page.locator('body')).toContainText('student@example.com');
});

test('expired access token refreshes once for protected admin page', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'expired-access');
    window.localStorage.setItem('cscalite.refreshToken', 'valid-refresh');
  });

  let refreshCalls = 0;
  await page.route('**/api/v1/auth/refresh**', async (route) => {
    refreshCalls += 1;
    const authorization = route.request().headers().authorization;
    if (!authorization) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Cookie refresh is not available in this mocked test.' })
      });
      return;
    }
    expect(authorization).toBe('Bearer valid-refresh');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        tokens: {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh'
        }
      })
    });
  });

  await page.route('**/api/v1/auth/me**', async (route) => {
    const authorization = route.request().headers().authorization;
    if (authorization === 'Bearer expired-access') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: '登录状态已过期。' })
      });
      return;
    }
    expect(authorization).toBe('Bearer fresh-access');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        displayName: 'Admin'
      })
    });
  });
  await mockAdminData(page, 'fresh-access');

  await page.route('**/api/v1/admin/audit-logs**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer fresh-access');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/admin/practice/summary**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schoolsTotal: 0,
        schoolsVerified: 0,
        schoolsPending: 0,
        adminAuditEventCount: 0,
        latestAdminAuditEventAt: null,
        schoolChangeCount: 0,
        latestSchoolChangeAt: null,
        mockExamAttemptCount: 0,
        specialPracticeSessionCount: 0
      })
    });
  });
  await page.route('**/api/v1/admin/audit-events**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.goto('/admin/audit');
  await expect(page.locator('.site-avatar-button')).toBeVisible();
  expect(refreshCalls).toBe(1);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.accessToken'))).toBe('fresh-access');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.refreshToken'))).toBeNull();
});

test('cookie refresh sends csrf header and removes legacy refresh token', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'expired-access');
    window.localStorage.setItem('cscalite.refreshToken', 'legacy-refresh');
    document.cookie = 'cscalite_csrf=csrf-token; path=/';
  });

  let refreshCalls = 0;
  await page.route('**/api/v1/auth/refresh**', async (route) => {
    refreshCalls += 1;
    const headers = route.request().headers();
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-csrf-token']).toBe('csrf-token');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        tokens: {
          accessToken: 'cookie-fresh-access',
          refreshToken: 'cookie-fresh-refresh'
        }
      })
    });
  });

  await page.route('**/api/v1/auth/me**', async (route) => {
    const authorization = route.request().headers().authorization;
    if (authorization === 'Bearer expired-access') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: '登录状态已过期。' })
      });
      return;
    }
    expect(authorization).toBe('Bearer cookie-fresh-access');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        displayName: 'Admin'
      })
    });
  });
  await mockAdminData(page, 'cookie-fresh-access');

  await page.goto('/admin/audit');
  await expect(page.locator('.site-avatar-button')).toBeVisible();
  expect(refreshCalls).toBe(1);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.accessToken'))).toBe('cookie-fresh-access');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.refreshToken'))).toBeNull();
});

test('cookie-only staging rejects legacy bearer refresh and clears stale local auth', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'expired-access');
    window.localStorage.setItem('cscalite.refreshToken', 'legacy-refresh');
  });

  const refreshAuthorizations: Array<string | undefined> = [];
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '登录状态已过期。' })
    });
  });
  await page.route('**/api/v1/auth/refresh**', async (route) => {
    const authorization = route.request().headers().authorization;
    refreshAuthorizations.push(authorization);
    await route.fulfill({
      status: authorization ? 401 : 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: authorization ? '请重新登录。' : '安全校验失败，请刷新页面后重试。' })
    });
  });

  await page.goto('/admin/audit');
  await expect(page.locator('body')).toContainText('请先登录管理员账号。');
  await expect.poll(() => refreshAuthorizations.join('|')).toBe('Bearer legacy-refresh');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.accessToken'))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.refreshToken'))).toBeNull();
});

test('revoked refresh token clears auth state and shows login gate', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.accessToken', 'expired-access');
    window.localStorage.setItem('cscalite.refreshToken', 'revoked-refresh');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '登录状态已过期。' })
    });
  });
  await page.route('**/api/v1/auth/refresh**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '请重新登录。' })
    });
  });

  await page.goto('/admin/audit');
  await expect(page.locator('body')).toContainText('请先登录管理员账号。');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.accessToken'))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('cscalite.refreshToken'))).toBeNull();
});

test('auth page rejects weak registration and shows login failure feedback', async ({ page }) => {
  await page.goto('/auth');
  const form = page.locator('.auth-form');

  await form.getByRole('button', { name: '注册' }).click();
  await form.getByLabel('邮箱').fill('new-user@example.com');
  await form.locator('input[type="password"]').first().fill('1234567');
  await form.getByPlaceholder('确认密码').fill('1234567');
  await form.getByRole('button', { name: '注册并进入' }).click();
  await expect(form).toContainText('密码至少需要 8 位。');

  await page.route('**/api/v1/auth/login**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '邮箱或密码不正确。' })
    });
  });

  await form.getByLabel('账号模式').getByRole('button', { name: '登录' }).click();
  await form.getByLabel('邮箱').fill('new-user@example.com');
  await form.locator('input[type="password"]').first().fill('Wrong1234');
  await form.locator('button[type="submit"]').click();
  await expect(form).toContainText('邮箱或密码不正确。');
});

test('subject learning pages route users into subject tools', async ({ page }) => {
  await useChineseLocale(page);
  await mockSubjectLearningData(page);
  const accountDataRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/csca-special-practice/my-') || url.includes('/csca-mock-exam/my-attempts')) {
      accountDataRequests.push(url);
    }
  });

  await page.goto('/csca-subjects/math');
  await expect(page.getByRole('heading', { name: 'CSCA 数学' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /研究路线图/ })).toBeVisible();
  await expect(page.getByText('预计总时间')).toBeVisible();
  await expect(page.getByLabel('数学路线图总览')).toContainText('预计总时间 58h');
  await expect(page.getByText(/知识点/).first()).toBeVisible();
  await expect(page.getByText('中等').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /考试大纲/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /科学备考三步法/ })).toBeVisible();
  await expect(page.getByText('90 天备考路线图').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /开始 20 题诊断/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /先完成诊断/ }).first()).toBeVisible();
  expect(accountDataRequests).toEqual([]);

  await page.getByRole('button', { name: /学科词汇/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/vocabulary/);
  await page.goto('/csca-subjects/math');

  await page.getByRole('button', { name: /学科词汇/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/vocabulary/);
  await expect(page.getByRole('heading', { name: '数学词汇' })).toBeVisible();
  await page.goto('/csca-subjects/math');

  await page.getByRole('button', { name: /查公式\/知识表/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/formulas/);
  await expect(page.getByRole('heading', { name: /公式速查表|常用公式/ })).toBeVisible();
  await page.goto('/csca-subjects/math');
  await page.getByRole('button', { name: /看图理解概念/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math\/visualize/);

  await page.goto('/csca-subjects/math');
  if ((page.viewportSize()?.width ?? 1280) > 860) {
    await page.getByRole('button', { name: /科目学习/ }).hover();
    await page.getByRole('menuitem', { name: '物理' }).click();
  } else {
    await page.goto('/csca-subjects/physics');
  }
  await expect(page).toHaveURL(/\/csca-subjects\/physics/);
  await expect(page.getByRole('heading', { name: 'CSCA 物理学' })).toBeVisible();
  await expect(page.getByLabel('物理路线图总览')).toContainText('预计总时间 64h');
  await expect(page.getByText('力学').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /科学备考三步法/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /查公式\/知识表/ })).toBeEnabled();
  await page.getByRole('button', { name: /学科词汇/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/physics\/vocabulary/);
  await page.goto('/csca-subjects/physics');
  await page.locator('.subject-learning-actions').getByRole('button', { name: '模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/physics/);
  await page.goto('/csca-subjects/physics');
  await page.getByRole('button', { name: /查公式\/知识表/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/physics\/formulas/);
  await expect(page.getByRole('heading', { name: /公式速查表|常用公式/ })).toBeVisible();
  await page.goto('/csca-subjects/physics');
  await page.getByRole('button', { name: /先完成诊断/ }).click();
  await expect(page).toHaveURL(/\/zh\/login$/);
  await page.goto('/csca-subjects/physics');

  if ((page.viewportSize()?.width ?? 1280) > 860) {
    await page.getByRole('button', { name: /科目学习/ }).hover();
    await page.getByRole('menuitem', { name: '化学' }).click();
  } else {
    await page.goto('/csca-subjects/chemistry');
  }
  await expect(page).toHaveURL(/\/csca-subjects\/chemistry/);
  await expect(page.getByRole('heading', { name: 'CSCA 化学' })).toBeVisible();
  await expect(page.getByLabel('化学路线图总览')).toContainText('预计总时间 62h');
  await expect(page.getByText('无机化学').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /科学备考三步法/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /查公式\/知识表/ })).toBeEnabled();
  await page.getByRole('button', { name: /学科词汇/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/chemistry\/vocabulary/);
  await page.goto('/csca-subjects/chemistry');
  await page.getByRole('button', { name: /查公式\/知识表/ }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/chemistry\/formulas/);
  await expect(page.getByRole('heading', { name: /公式速查表|常用公式/ })).toBeVisible();
  await page.goto('/csca-subjects/chemistry');
  await page.locator('.subject-learning-actions').getByRole('button', { name: '模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/chemistry\/chemistry-mock-1/);
});

test('subject vocabulary pages support search filters and related navigation', async ({ page }) => {
  await useChineseLocale(page);
  await page.goto('/csca-subjects/math/vocabulary');
  await expect(page.getByRole('heading', { name: '数学词汇' })).toBeVisible();
  await expect(page.locator('body')).toContainText('131术语');
  await page.getByLabel('搜索英文、中文或解释').fill('domain');
  await expect(page.locator('body')).toContainText('domain');
  await expect(page.locator('body')).toContainText('定义域');
  await page.getByLabel('按模块筛选').selectOption('函数');
  await page.getByLabel('按频率筛选').selectOption('高频');
  await expect(page.locator('body')).toContainText('函数');
  await page.getByRole('button', { name: '重置筛选' }).click();
  await page.getByLabel('搜索英文、中文或解释').fill('intersection');
  await expect(page.locator('body')).toContainText('交集');
  await page.getByRole('button', { name: '继续科目练习' }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math#practice/);

  await page.goto('/csca-subjects/physics/vocabulary');
  await expect(page.getByRole('heading', { name: '物理词汇' })).toBeVisible();
  await page.getByLabel('搜索英文、中文或解释').fill('velocity');
  await expect(page.locator('body')).toContainText('速度');
  await page.getByRole('button', { name: '做一套模考' }).click();
  await expect(page).toHaveURL(/\/csca-mock-exam\/physics/);

  await page.goto('/csca-subjects/chemistry/vocabulary');
  await expect(page.getByRole('heading', { name: '化学词汇' })).toBeVisible();
  await page.getByLabel('按模块筛选').selectOption('反应原理');
  await expect(page.locator('body')).toContainText('oxidation');
  await page.getByRole('button', { name: '继续科目练习' }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/chemistry#practice/);
});

test.skip('retired unauthenticated commerce actions give visible feedback', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.locator('body')).toContainText(/请先登录|登录/);
  await page.goto('/checkout');
  await expect(page.locator('body')).toContainText(/请先登录|登录|购物车/);
});
