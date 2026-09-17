import { expect, test, type Page } from '@playwright/test';

function makeBackendStyleAccessToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: 1,
    email: 'admin@example.com',
    role: 'admin',
    type: 'access',
    iat: now,
    exp: now + 3600,
    ...overrides
  })).toString('base64url');
  return `${payload}.signature`;
}

async function seedSignedInAdmin(page: Page) {
  const token = makeBackendStyleAccessToken();
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('cscalite.accessToken', accessToken);
  }, token);
  return token;
}

async function installSharedMocks(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
  });
  await page.route('**/api/v1/**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    const authorization = route.request().headers().authorization;
    const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const isBackendStyleAccessToken = token.split('.').length === 2;
    if (isBackendStyleAccessToken) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          email: 'admin@example.com',
          role: 'admin',
          displayName: 'Admin',
          emailVerifiedAt: '2026-01-01T00:00:00.000Z',
          passwordConfigured: true,
          googleLinked: false
        })
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '未登录' })
    });
  });
  await page.route('**/api/v1/content/home**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('**/api/v1/schools**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        pagination: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
        facets: { regions: [], schoolTypes: [], cscaOptions: [], applicationLevels: [] },
        appliedFiltersSummary: []
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        totals: { subjectCount: 3, topicCount: 3, questionCount: 30 },
        features: ['即时判分', '错题复盘'],
        subjects: [
          { id: 'math', title: '数学', description: '数学专项', topicCount: 1, questionCount: 10 },
          { id: 'physics', title: '物理', description: '物理专项', topicCount: 1, questionCount: 10 },
          { id: 'chemistry', title: '化学', description: '化学专项', topicCount: 1, questionCount: 10 }
        ]
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subjects: [
          { id: 'math', title: '数学', topicCount: 1, questionCount: 10, averageMastery: null, activeSessionId: null, questionLanguage: null, nextAction: 'start_diagnostic' },
          { id: 'physics', title: '物理', topicCount: 1, questionCount: 10, averageMastery: null, activeSessionId: null, questionLanguage: null, nextAction: 'start_diagnostic' },
          { id: 'chemistry', title: '化学', topicCount: 1, questionCount: 10, averageMastery: null, activeSessionId: null, questionLanguage: null, nextAction: 'start_diagnostic' }
        ],
        roundSize: 5,
        diagnosticRoundSize: 20,
        requiresLogin: false
      })
    });
  });
  await page.route('**/api/v1/csca-special-practice/subjects/**', async (route) => {
    const subject = new URL(route.request().url()).pathname.split('/').pop() ?? 'math';
    const titles: Record<string, string> = { math: '数学', physics: '物理', chemistry: '化学' };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: { id: subject, title: titles[subject] ?? '数学', description: '专项练习', tags: [] },
        stats: { topicCount: 1, questionCount: 10, estimatedMinutes: 20 },
        modules: [{ module: '基础', topics: [{ id: 1, subject, slug: `${subject}-topic`, title: '基础题', questionCount: 10 }] }]
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        examDate: '2026-06-30',
        countdownLabel: '测试倒计时',
        subjectCards: [
          { id: 'math', title: '数学', shortTitle: '数学', accent: 'blue', description: '数学模考', tags: ['函数'], paperCount: 1, freePaperCount: 1 },
          { id: 'physics', title: '物理', shortTitle: '物理', accent: 'green', description: '物理模考', tags: ['力学'], paperCount: 1, freePaperCount: 1 },
          { id: 'chemistry', title: '化学', shortTitle: '化学', accent: 'orange', description: '化学模考', tags: ['反应'], paperCount: 1, freePaperCount: 1 }
        ],
        stats: [{ label: '套卷', value: '3', detail: '测试套卷' }],
        features: ['限时作答', '提交报告']
      })
    });
  });
  await page.route('**/api/v1/csca-mock-exam/subjects/**', async (route) => {
    const subject = new URL(route.request().url()).pathname.split('/').pop() ?? 'math';
    const titles: Record<string, string> = { math: '数学', physics: '物理', chemistry: '化学' };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: { id: subject, title: titles[subject] ?? '数学', shortTitle: titles[subject] ?? '数学', accent: 'blue', description: '模考', tags: [] },
        papers: [{ id: 1, subject, slug: `${subject}-mock-1`, title: `${titles[subject]}模拟卷`, questionCount: 3, durationMinutes: 60, isFree: true, isLocked: false }],
        pastPapers: [],
        bundle: { title: '套卷包', priceLabel: '免费', description: '测试' }
      })
    });
  });
  await page.route('**/api/v1/admin/audit-logs**', async (route) => {
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
  await page.route('**/api/v1/admin/csca-special-practice/adaptive/ai/observability**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        range: { from: '', to: '' },
        filters: { provider: null, status: null, type: null, subject: null },
        summary: {
          key: 'all',
          interactions: 0,
          fallbackInteractions: 0,
          externalInteractions: 0,
          successfulInteractions: 0,
          rejectedInteractions: 0,
          errorInteractions: 0,
          billableInteractions: 0,
          estimatedTokens: 0,
          estimatedCost: 0,
          feedbackCount: 0,
          lowFeedbackCount: 0,
          averageRating: null,
          fallbackRate: 0,
          rejectionRate: 0,
          errorRate: 0,
          feedbackRate: 0
        },
        rolloutHealth: {
          status: 'insufficient_data',
          recommendation: 'collect_more_samples',
          sampleSize: 0,
          feedbackSampleSize: 0,
          lowFeedbackRate: 0,
          thresholds: {
            minInteractions: 20,
            minFeedback: 5,
            maxErrorRate: 0.05,
            maxRejectionRate: 0.02,
            maxLowFeedbackRate: 0.2,
            minAverageRating: 3.5
          },
          checks: []
        },
        byDay: [],
        byProvider: [],
        byType: [],
        byStatus: [],
        reasonBreakdown: [],
        recentFailures: []
      })
    });
  });
  await page.route('**/api/v1/admin/csca-special-practice/adaptive/ai/review-queue**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        range: { from: '', to: '' },
        filters: { provider: null, status: null, type: null, subject: null, reason: null },
        summary: { candidates: 0, lowFeedback: 0, providerRejected: 0, providerErrors: 0, quotaExhausted: 0 },
        byReason: [],
        items: []
      })
    });
  });
  await page.route('**/api/v1/admin/csca-special-practice/adaptive/ai/provider-config**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        provider: {
          mode: 'rule-fallback',
          externalReady: false,
          externalToggleEnabled: false,
          provider: 'rule-fallback',
          supported: true,
          model: 'local-rule-v1',
          promptVersion: 'coach-rule-v1',
          requestedPromptVersion: 'coach-v2-safety',
          activePromptVersion: 'coach-v2-safety',
          promptVersionSupported: true,
          supportedPromptVersions: ['coach-v1-basic', 'coach-v2-safety'],
          promptTemplateCheck: { version: 'coach-v2-safety', valid: true, issues: [] },
          apiKeyConfigured: false,
          baseUrlHost: 'api.openai.com',
          timeoutMs: 8000,
          temperature: 0.2,
          maxOutputChars: 1200,
          rollout: { percent: 100, strategy: 'all_users' },
          fallbackModel: 'local-rule-v1',
          fallbackPromptVersion: 'coach-rule-v1',
          blockers: []
        },
        usageMeter: {
          pricingConfigured: false,
          currency: 'USD',
          inputCostPer1KTokens: 0,
          outputCostPer1KTokens: 0,
          unitTokenBudget: 2000,
          meteringMode: 'estimate'
        }
      })
    });
  });
  await page.route('**/api/v1/admin/csca-special-practice/adaptive/events/observability**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        range: { from: '', to: '' },
        filters: { eventType: null, subject: null },
        summary: {
          totalEvents: 0,
          uniqueUsers: 0,
          diagnosticStarted: 0,
          diagnosticCompleted: 0,
          diagnosticCompletionRate: 0,
          practiceStarted: 0,
          practiceCompleted: 0,
          practiceCompletionRate: 0,
          aiEvents: 0
        },
        byDay: [],
        byEventType: [],
        bySubject: [],
        readinessActions: {
          clickedCount: 0,
          followedCount: 0,
          followThroughRate: 0,
          averageExpectedGain: null,
          status: 'no_data',
          byActionType: [],
          recentClicks: []
        },
        readinessEvidence: {
          sampleSize: 0,
          averageScore: null,
          lowCount: 0,
          lowRate: 0,
          status: 'no_data',
          byStatus: [],
          topGaps: [],
          recent: []
        },
        readinessDifficultyThresholds: { mode: 'static', minSampleSize: 8, bySubject: [] },
        readinessCalibrationHealth: { status: 'healthy', snapshotCount: 0, latestSnapshotDate: null, staleDays: null, alerts: [] },
        readinessSampledThresholdRollout: {
          status: 'blocked',
          checklist: [],
          metrics: {
            mode: 'static',
            sampledReadySubjects: 0,
            totalSubjects: 0,
            insufficientSubjects: [],
            impactedUserSubjectCount: 0,
            maxImpactUserSubjectCount: 5,
            maxRecommendedCount: 0,
            minSampleSize: 8,
            blockingCalibrationAlertCount: 0
          }
        },
        plannerAssistant: { total: 0, accepted: 0, adjustedByGuard: 0, acceptanceRate: 0, byStatus: [], rejectedReasons: [], recent: [] },
        conceptCardEffect: {
          summary: {
            completedCards: 0,
            cardsWithVariantAttempts: 0,
            variantAttemptCount: 0,
            variantCorrectCount: 0,
            variantAccuracy: null
          },
          recent: []
        },
        variantEffect: {
          summary: {
            variantQuestionCount: 0,
            sourceQuestionCount: 0,
            variantAttemptCount: 0,
            variantCorrectCount: 0,
            variantAccuracy: null,
            misconceptionTrackedCount: 0,
            weakVariantCount: 0
          },
          recent: []
        },
        recentEvents: []
      })
    });
  });
  await page.route('**/api/v1/admin/ai-questioning/operational-readiness**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        subject: null,
        useCase: 'subject_practice',
        status: 'needs_attention',
        score: 0,
        nextAction: 'monitor',
        blockers: [],
        warnings: [],
        dimensions: {
          blueprintCoverage: { publishedTopicCount: 0, coveredTopicCount: 0, missingTopicCount: 0, activeBlueprintCount: 0, pausedBlueprintCount: 0, archivedBlueprintCount: 0, status: 'unknown' },
          topicBank: { total: 0, missingBlueprintCount: 0, needsCandidateCount: 0, needsPublishCount: 0, needsQualityReviewCount: 0, healthyCount: 0, status: 'unknown' },
          generationQueue: { total: 0, queued: 0, running: 0, succeeded: 0, failed: 0, blocked: 0, staleRunning: 0, status: 'unknown', recommendedAction: 'monitor' },
          syllabusGovernance: { total: 0, currentCount: 0, staleCount: 0, unpublishedTopicCount: 0, pendingReviewCount: 0, status: 'unknown' },
          qualityGovernance: { status: 'unknown', needsReviewCount: 0, highSeverityCount: 0, escalationCount: 0, dueSoonCount: 0 }
        },
        latestAuditEvent: null,
        generatedAt: ''
      })
    });
  });
}

test('desktop subject dropdown can click items without nav pointer interception', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop header navigation is covered by the desktop project.');
  await installSharedMocks(page);
  await page.goto('/csca-subjects/physics');

  await page.getByRole('button', { name: /科目学习|Subjects/ }).click();
  await page.getByRole('menuitem', { name: /化学|Chemistry/ }).click();

  await expect(page).toHaveURL(/\/csca-subjects\/chemistry$/);
  await expect(page.getByRole('heading', { name: /CSCA (化学|Chemistry)/ })).toBeVisible();
});

test('admin account menu stays clickable after auth resolution', async ({ page }) => {
  await seedSignedInAdmin(page);
  await installSharedMocks(page);
  await page.goto('/');

  await expect(page.locator('.site-avatar-button')).toBeVisible();
  await page.locator('.site-avatar-button').click();
  await page.getByRole('menuitem', { name: /后台管理|Dashboard/ }).click();

  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.locator('body')).toContainText(/后台运营检查点|Review backend status/);
});

test('backend-style auth token keeps student routes signed in', async ({ page }) => {
  const backendStyleToken = makeBackendStyleAccessToken();

  await page.addInitScript((token) => {
    window.localStorage.setItem('cscalite.accessToken', token);
  }, backendStyleToken);
  await installSharedMocks(page);

  await page.goto('/');
  await expect(page.locator('.site-avatar-button')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('登录');

  await page.goto('/csca-subjects/math');
  await expect(page.getByRole('heading', { name: /CSCA (数学|Math)/ })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('登录后保存进度');
  await expect(page.locator('body')).not.toContainText('Login saves progress');

  await page.goto('/zh/me');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('请先登录');
  await expect(page.locator('body')).not.toContainText('Log in to keep your CSCA practice path together');

  const tokenAfterNavigation = await page.evaluate(() => window.localStorage.getItem('cscalite.accessToken'));
  expect(tokenAfterNavigation).toBe(backendStyleToken);
});

test('rapid public navigation keeps shell stable and avoids error pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop header navigation is covered by the desktop project.');
  await installSharedMocks(page);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');
  const nav = page.getByLabel(/主导航|Primary navigation/);
  for (const name of [
    /^(CSCA 准备|CSCA Prep)$/,
    /^(科目学习|Subjects)$/,
    /^(在线模考|Online Mock)(\s+NEW|\s+新)?$/,
    /^(真题|Past Papers)(\s+FREE|\s+免费)?$/,
    /^(咨询|Consulting)$/,
    /^(首页|Home)$/
  ]) {
    const button = nav.getByRole('button', { name });
    await expect(button).toBeVisible();
    await button.dispatchEvent('click');
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
    await expect(page.locator('body')).not.toContainText('404');
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
