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
  await page.route((url) => url.pathname === '/api/v1/content/home', (route) => {
    const requestedLocale = new URL(route.request().url()).searchParams.get('locale') || 'zh-CN';
    return json(route, {
      items: [{
      key: 'home.hero',
      locale: 'zh-CN',
      requestedLocale,
      isFallback: requestedLocale !== 'zh-CN',
      title: '用真实作答找到下一步。',
      subtitle: 'CSCA 做题训练',
      body: {
        body: '模考、短题训练和错题复盘会沉淀为同一条学习路径。',
        proofPills: ['真实作答诊断', '三科专项训练', '错题回流验证']
      }
    }]
    });
  });
  await page.route((url) => url.pathname === '/api/v1/csca-special-practice/home-mini-mock', (route) => json(route, { message: 'Preview unavailable' }, 503));
}

test('renders the inherited public home and routes every student intent into Agent', async ({ page }) => {
  await mockPublicHome(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main.site-main-home')).toBeVisible();
  await expect(page.getByRole('heading', { name: '用真实作答找到下一步。' })).toBeVisible();
  await expect(page.getByText('真实作答诊断', { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/csca-"], a[href^="/schools"], a[href^="/services/consulting"]')).toHaveCount(0);

  const mainBox = await page.locator('main.site-main-home').boundingBox();
  expect(mainBox?.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 1);

  const footer = page.locator('.public-home-footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expect(footer.getByRole('navigation', { name: '页脚导航' })).toBeVisible();
  await expect(footer.getByText(/© \d{4} CSCAPilot/)).toBeVisible();

  await page.getByLabel('选择语言').click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(footer.getByRole('navigation', { name: 'Footer navigation' }).getByRole('button', { name: 'Practice' })).toBeVisible();
  await expect(footer.getByRole('button', { name: /CSCA Learning Agent/ })).toBeVisible();
  await expect(footer.getByText('AI capabilities supported by DeepSeek models')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New to CSCA?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Take one mock first. See exactly what to improve.' })).toBeAttached();
  await expect.poll(() => page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/);

  await page.getByLabel('Choose language').click();
  await page.getByRole('menuitemradio', { name: /Tiếng Việt/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { name: 'Lần đầu tìm hiểu CSCA?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Làm một đề thi thử trước để biết chính xác cần cải thiện gì.' })).toBeAttached();
  await expect.poll(() => page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/);

  await page.getByLabel('Chọn ngôn ngữ').click();
  await page.getByRole('menuitemradio', { name: /中文/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

  await page.getByRole('link', { name: /开始免费模考/ }).click();
  await expect(page).toHaveURL(/\/agent$/);

  await page.goto('/');
  await page.locator('a[href="/agent?agentSection=weakness"]').first().click();
  await expect(page).toHaveURL(/\/agent\?agentSection=weakness$/);
});
