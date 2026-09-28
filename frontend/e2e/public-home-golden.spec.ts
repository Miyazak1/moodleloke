import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPublicHome(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
  });
  await page.route('**/api/v1/auth/refresh', (route) => json(route, { message: 'Unauthenticated' }, 401));
  await page.route((url) => url.pathname === '/api/v1/content/home', (route) => json(route, {
    items: [{
      key: 'home.hero',
      locale: 'zh-CN',
      title: '用真实作答找到下一步。',
      subtitle: 'CSCA 做题训练',
      body: {
        body: '模考、短题训练和错题复盘会沉淀为同一条学习路径。',
        proofPills: ['真实作答诊断', '三科专项训练', '错题回流验证']
      }
    }]
  }));
  await page.route((url) => url.pathname === '/api/v1/csca-special-practice/home-mini-mock', (route) => json(route, { message: 'Preview unavailable' }, 503));
}

test('renders the inherited public home and routes every student intent into Agent', async ({ page }) => {
  await mockPublicHome(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '用真实作答找到下一步。' })).toBeVisible();
  await expect(page.getByText('真实作答诊断', { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/csca-"], a[href^="/schools"], a[href^="/services/consulting"]')).toHaveCount(0);

  await page.getByRole('link', { name: /开始免费模考/ }).click();
  await expect(page).toHaveURL(/\/agent$/);

  await page.goto('/');
  await page.locator('a[href="/agent?agentSection=weakness"]').first().click();
  await expect(page).toHaveURL(/\/agent\?agentSection=weakness$/);
});
