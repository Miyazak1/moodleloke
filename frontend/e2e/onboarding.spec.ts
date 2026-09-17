import { expect, test, type Page, type Route } from '@playwright/test';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, content-type, x-csrf-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};

async function json(route: Route, body: unknown, status = 200) {
  const headers = { ...CORS_HEADERS, 'Access-Control-Allow-Origin': route.request().headers().origin ?? '*' };
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers });
    return;
  }
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

async function useChinese(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
  });
}

test.beforeEach(async ({ page }) => {
  await useChinese(page);
});

test('new email registration completes the two-step learning profile and returns safely', async ({ page }, testInfo) => {
  let savedProfile: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/refresh', (route) => json(route, { message: '未登录' }, 401));
  await page.route('**/api/v1/auth/me/profile', (route) => json(route, {
    id: '91', email: 'new-student@example.com', role: 'student', displayName: 'New Student'
  }));
  await page.route('**/api/v1/auth/me', (route) => json(route, {
    id: '91', email: 'new-student@example.com', role: 'student', displayName: 'New Student'
  }));
  await page.route('**/api/v1/auth/register', (route) => json(route, {
    user: { id: '91', email: 'new-student@example.com', role: 'student', displayName: 'New Student' },
    tokens: { accessToken: 'student-token', refreshToken: 'refresh-token' },
    verificationEmailSent: true
  }));
  await page.route('**/api/v1/me/student-profile', async (route) => {
    if (route.request().method() === 'POST') {
      savedProfile = route.request().postDataJSON() as Record<string, unknown>;
      await json(route, { ...savedProfile, onboardingCompletedAt: '2026-09-10T00:00:00.000Z', onboardingSkippedAt: null });
      return;
    }
    await json(route, { targetSubjectCodes: [], onboardingCompletedAt: null, onboardingSkippedAt: null });
  });

  await page.goto('/auth?redirect=%2Fcsca-subjects%2Fmath');
  await expect(page.locator('.site-footer-account')).toBeVisible();
  await expect(page.locator('.site-footer-account').getByRole('button', { name: '返回首页' })).toBeVisible();
  await expect(page.locator('.site-footer-account')).not.toContainText('开始免费模考');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByLabel('邮箱').fill('new-student@example.com');
  await page.locator('input[type="password"]').first().fill('Strong123');
  await page.getByPlaceholder('确认密码').fill('Strong123');
  await page.getByRole('button', { name: '注册并进入' }).click();

  await expect(page.getByRole('heading', { name: '先确认邮箱，再完善学习档案。' })).toBeVisible();
  await expect(page.getByText('new-student@example.com')).toBeVisible();
  await page.getByRole('button', { name: '暂不验证，继续设置' }).click();

  await expect(page).toHaveURL(/\/onboarding\?returnTo=%2Fcsca-subjects%2Fmath/);
  await expect(page.getByRole('heading', { name: '你现在处于哪个学习阶段？' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('onboarding-step-1.png'), fullPage: true });
  await page.getByLabel('教育阶段').selectOption('high_school');
  await page.getByRole('button', { name: '继续设置学习计划' }).click();
  await page.screenshot({ path: testInfo.outputPath('onboarding-step-2.png'), fullPage: true });
  await page.getByLabel('数学').check();
  await page.getByLabel('题目与解析语言').selectOption('zh-CN');
  await page.getByRole('button', { name: '保存学习档案' }).click();

  await expect(page.getByRole('heading', { name: '学习档案设置好了' })).toBeVisible();
  expect(savedProfile).toMatchObject({
    educationStageCode: 'high_school',
    targetSubjectCodes: ['math'],
    preferredQuestionLanguageCode: 'zh-CN',
    onboardingAction: 'complete'
  });
  await page.getByRole('button', { name: '开始学习' }).click();
  await expect(page).toHaveURL(/\/csca-subjects\/math$/);
});

test('onboarding can be skipped and rejects an external return target', async ({ page }) => {
  let action = '';
  await page.addInitScript(() => window.localStorage.setItem('cscalite.accessToken', 'student-token'));
  await page.route('**/api/v1/auth/me**', (route) => json(route, {
    id: '92', email: 'student@example.com', role: 'student', displayName: 'Student'
  }));
  await page.route('**/api/v1/me/student-profile', async (route) => {
    if (route.request().method() === 'POST') action = (route.request().postDataJSON() as { onboardingAction?: string }).onboardingAction ?? '';
    await json(route, { targetSubjectCodes: [], onboardingCompletedAt: null, onboardingSkippedAt: action ? '2026-09-10T00:00:00.000Z' : null });
  });

  await page.goto('/onboarding?returnTo=https%3A%2F%2Fevil.example%2Fsteal');
  await page.getByRole('button', { name: '稍后再设置' }).click();
  await expect(page).toHaveURL(/\/me$/);
  expect(action).toBe('skip');
});

test('account settings reload and update the same learning profile', async ({ page }) => {
  let savedProfile: Record<string, unknown> | null = null;
  await page.addInitScript(() => window.localStorage.setItem('cscalite.accessToken', 'student-token'));
  await page.route('**/api/v1/auth/me**', (route) => json(route, {
    id: '93', email: 'student@example.com', role: 'student', displayName: 'Student'
  }));
  await page.route('**/api/v1/me/student-profile', async (route) => {
    if (route.request().method() === 'POST') {
      savedProfile = route.request().postDataJSON() as Record<string, unknown>;
      await json(route, { ...savedProfile, onboardingCompletedAt: '2026-09-10T00:00:00.000Z' });
      return;
    }
    await json(route, {
      educationStageCode: 'high_school', gradeCode: 'SCHOOL_G11', targetSubjectCodes: ['math'],
      preferredQuestionLanguageCode: 'zh-CN', weeklyGoalDays: 3, onboardingCompletedAt: '2026-09-10T00:00:00.000Z'
    });
  });

  await page.goto('/me?section=settings');
  await expect(page.getByRole('heading', { name: '学习阶段与 CSCA 计划' })).toBeVisible();
  await expect(page.getByLabel('教育阶段')).toHaveValue('high_school');
  await page.getByLabel('每周学习目标').selectOption('5');
  await page.getByRole('button', { name: '保存学习档案' }).click();
  await expect(page.getByText('学习档案已更新。')).toBeVisible();
  expect(savedProfile).toMatchObject({ weeklyGoalDays: 5, educationStageCode: 'high_school' });
});
