import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const admin = {
  id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin', emailVerifiedAt: '2026-09-01T00:00:00.000Z'
};

function block(title: string, status = 'draft', version = 1) {
  return {
    id: 'home-hero-zh', key: 'home.hero', locale: 'zh-CN', title, subtitle: 'CSCA 做题训练',
    body: { body: '从真实作答开始安排训练。', proofPills: ['诊断', '训练', '验证'] },
    status, sortOrder: 10, version, updatedAt: '2026-09-28T00:00:00.000Z'
  };
}

async function seedIdentity(page: Page, user: typeof admin & { role: string }) {
  await page.addInitScript(({ seededUser }) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', 'admin-content-token');
    window.localStorage.setItem('moodlelike.currentUser', JSON.stringify(seededUser));
  }, { seededUser: user });
  await page.route('**/api/v1/auth/me**', (route) => json(route, user));
}

test('edits and publishes homepage content through the isolated admin app', async ({ page }) => {
  let current = block('旧首页标题');
  let publishedTitle = current.title;
  await seedIdentity(page, admin);
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks', (route) => json(route, { items: [current], mode: 'minimal-cms' }));
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks/home.hero', async (route) => {
    const payload = await route.request().postDataJSON();
    current = { ...current, ...payload, version: 2 };
    return json(route, current);
  });
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks/home.hero/publish', (route) => {
    current = { ...current, status: 'published', version: 3 };
    publishedTitle = current.title;
    return json(route, current);
  });
  await page.route((url) => url.pathname === '/api/v1/content/home', (route) => json(route, { items: [{ ...current, title: publishedTitle }] }));
  await page.route((url) => url.pathname === '/api/v1/csca-special-practice/home-mini-mock', (route) => json(route, { message: 'Preview unavailable' }, 503));

  await page.goto('/admin/content');
  await expect(page.getByRole('heading', { name: /管理 CSCA 首页/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '后台工作区导航' }).getByRole('button')).toHaveCount(10);
  await page.getByRole('button', { name: /旧首页标题/ }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('发布后的首页标题');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存 home.hero。')).toBeVisible();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.getByRole('button', { name: '确认发布' }).click();
  await expect(page.getByText('已发布 home.hero。')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '发布后的首页标题' })).toBeVisible();
});

test('denies the content workspace to a signed-in non-admin without loading admin data', async ({ page }) => {
  let adminDataRequested = false;
  await seedIdentity(page, { ...admin, id: '2', email: 'student@example.com', role: 'student' });
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks', (route) => {
    adminDataRequested = true;
    return json(route, { message: 'Forbidden' }, 403);
  });

  await page.goto('/admin/content');
  await expect(page.getByText('当前账号没有后台权限。')).toBeVisible();
  await expect.poll(() => adminDataRequested).toBe(false);
});

test('returns an administrator to the guarded content route after login', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
  });
  await page.route('**/api/v1/auth/refresh', (route) => json(route, { message: 'Unauthenticated' }, 401));
  await page.route('**/api/v1/auth/login', (route) => json(route, {
    user: admin,
    tokens: { accessToken: 'new-admin-token', refreshToken: 'new-admin-refresh-token' }
  }));
  await page.route('**/api/v1/auth/me**', (route) => json(route, admin));
  await page.route((url) => url.pathname === '/api/v1/admin/content/blocks', (route) => json(route, { items: [block('管理员首页标题')], mode: 'minimal-cms' }));

  await page.goto('/admin/content');
  await page.getByRole('button', { name: '去登录' }).click();
  await expect(page).toHaveURL(/\/auth\?redirect=%2Fadmin%2Fcontent$/);
  await page.getByLabel('邮箱').fill('admin@example.com');
  await page.getByLabel('密码').fill('correct-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin\/content$/);
  await expect(page.getByRole('heading', { name: /管理 CSCA 首页/ })).toBeVisible();
});
