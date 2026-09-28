import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const admin = {
  id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin', emailVerifiedAt: '2026-09-01T00:00:00.000Z'
};

async function seedIdentity(page: Page, user: typeof admin & { role: string }) {
  await page.addInitScript(({ seededUser }) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', 'admin-operations-token');
    window.localStorage.setItem('moodlelike.currentUser', JSON.stringify(seededUser));
  }, { seededUser: user });
  await page.route('**/api/v1/auth/me**', (route) => json(route, user));
}

test('shows the CSCA-only operations overview and navigates to content without reloading', async ({ page }) => {
  await seedIdentity(page, admin);
  await page.route((url) => url.pathname === '/api/v1/admin/ops/overview', (route) => json(route, {
    adminAuditEventCount: 18,
    contentAuditEventCount: 7,
    latestAdminAuditEventAt: '2026-09-28T06:30:00.000Z',
    mockExamAttemptCount: 24,
    specialPracticeSessionCount: 36,
    activeAgentConversationCount: 12
  }));
  await page.route((url) => url.pathname === '/api/v1/admin/audit-events', (route) => json(route, {
    items: [{
      id: 19,
      actorId: 1,
      actorEmail: 'admin@example.com',
      module: 'content',
      resourceType: 'public_content_block',
      resourceId: 'home.hero',
      action: 'publish',
      createdAt: '2026-09-28T06:30:00.000Z'
    }]
  }));
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks', (route) => json(route, { items: [], mode: 'minimal-cms' }));

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByRole('heading', { name: 'CSCA 运营概览' })).toBeVisible();
  await expect(page.getByText('18', { exact: true })).toBeVisible();
  await expect(page.getByText('7', { exact: true })).toBeVisible();
  await expect(page.getByText('content.publish')).toBeVisible();
  await expect(page.getByText(/public_content_block #home.hero/)).toBeVisible();
  await expect(page.locator('.admin-site-header')).toBeVisible();
  await expect(page.locator('.admin-site-header .site-avatar-button')).toBeVisible();

  const adminNavigation = page.getByRole('navigation', { name: '后台工作区导航' });
  await expect(adminNavigation.getByRole('button')).toHaveCount(10);
  await expect(adminNavigation.getByRole('button', { name: '模考题库' })).toBeVisible();
  await expect(adminNavigation.getByRole('button', { name: '真题资料' })).toBeVisible();
  await expect(adminNavigation.getByRole('button', { name: '机构团队' })).toBeVisible();
  await expect(adminNavigation.getByRole('button', { name: 'AI 题库' })).toBeVisible();
  const shellBox = await page.locator('.admin-console-shell').boundingBox();
  expect(shellBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1280);
  await adminNavigation.getByRole('button', { name: '内容管理' }).click();
  await expect(page).toHaveURL(/\/admin\/content$/);
  await expect(page.getByRole('heading', { name: /管理 CSCA 首页/ })).toBeVisible();

  await page.getByRole('navigation', { name: '后台工作区导航' }).getByRole('button', { name: '模考题库' }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/mock-exams$/);
  await expect(page.getByRole('heading', { name: '批量导入试卷，也能逐题精修。' })).toBeVisible();
});

test('denies operations data to a signed-in non-admin', async ({ page }) => {
  let operationsRequested = false;
  await seedIdentity(page, { ...admin, id: '2', email: 'student@example.com', role: 'student' });
  await page.route((url) => url.pathname === '/api/v1/admin/ops/overview' || url.pathname === '/api/v1/admin/audit-events', (route) => {
    operationsRequested = true;
    return json(route, { message: 'Forbidden' }, 403);
  });

  await page.goto('/admin/audit');
  await expect(page.getByText('当前账号没有后台权限。')).toBeVisible();
  await expect.poll(() => operationsRequested).toBe(false);
});
