import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const TOKEN = 'style-audit-token';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', token);
  }, TOKEN);
});

function json(route: Route, body: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

async function expectUsableBox(locator: Locator) {
  await expect.poll(async () => locator.evaluateAll((elements) => elements.some((element) => {
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return box.width > 20 && box.height > 20 && style.display !== 'none' && style.visibility !== 'hidden';
  }))).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

async function mockSignedInUser(page: Page, role: 'admin' | 'student' = 'student') {
  await page.route('**/api/v1/auth/me**', (route) => json(route, {
    id: '1',
    email: role === 'admin' ? 'admin@example.com' : 'student@example.com',
    role,
    displayName: role === 'admin' ? 'Admin' : 'Style Student',
    emailVerifiedAt: '2026-05-26T00:00:00.000Z'
  }));
}

function samplePricing() {
  return {
    currency: 'CNY',
    itemsTotalCents: 49900,
    discountTotalCents: 10000,
    payableTotalCents: 39900,
    pricingBreakdown: [
      {
        type: 'ADVISOR_PACKAGE',
        title: '顾问服务包',
        quantity: 1,
        unitAmountCents: 49900,
        originalAmountCents: 49900,
        discountAmountCents: 10000,
        payableAmountCents: 39900
      }
    ]
  };
}

function sampleCart() {
  return {
    items: [
      {
        id: 1,
        type: 'ADVISOR_PACKAGE',
        title: '顾问服务包',
        quantity: 1,
        createdAt: '2026-05-26T00:00:00.000Z'
      }
    ],
    pricing: samplePricing()
  };
}

test('admin content SurfaceCard migration keeps editor and preview usable', async ({ page }) => {
  await mockSignedInUser(page, 'admin');
  await page.route('**/api/v1/admin/content/blocks**', (route) => json(route, {
    items: [
      {
        id: 'content-1',
        key: 'home.hero',
        locale: 'zh-CN',
        title: 'CSCA 留学申请助手',
        subtitle: '首页首屏',
        body: { body: '把院校、备考和服务流转收在同一个工作台。' },
        status: 'published',
        sortOrder: 1,
        updatedAt: '2026-05-26T00:00:00.000Z',
        version: 1
      }
    ]
  }));

  await page.goto('/admin/content');
  await expectUsableBox(page.locator('.cms-editor-card'));
  await expectUsableBox(page.locator('.cms-preview-card'));
  expect(await page.locator('.cms-editor-card .admin-form-field').count()).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
});

test('account SurfaceCard sections and empty cards stay visible', async ({ page }) => {
  await mockSignedInUser(page);
  await page.route('**/api/v1/csca-mock-exam/my-attempts', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/csca-special-practice/my-sessions', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/csca-special-practice/my-wrong-questions**', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/me/saved-schools', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/me/compare', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/commerce/orders', (route) => json(route, { items: [] }));

  await page.goto('/me');
  const accountNav = page.getByLabel('我的账号页内导航');
  const workspace = page.locator('.me-account-workspace');
  const sidebar = page.locator('.me-account-workspace-sidebar');
  const main = page.locator('.me-account-workspace-main');
  const viewport = page.viewportSize();
  const [workspaceBox, sidebarBox, mainBox] = await Promise.all([
    workspace.boundingBox(),
    sidebar.boundingBox(),
    main.boundingBox()
  ]);
  expect(workspaceBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  await expect(sidebar).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.76)');
  await expect(sidebar).toHaveCSS('border-left-width', '1px');
  if ((viewport?.width ?? 0) > 980) {
    expect(sidebarBox!.x).toBeLessThan(mainBox!.x);
    expect(mainBox!.width).toBeGreaterThan(sidebarBox!.width * 2);
  } else {
    expect(sidebarBox!.y).toBeLessThan(mainBox!.y);
  }
  await expect(page.locator('.me-profile-overview-page .me-account-hero-bare')).toBeVisible();
  await expect(page.locator('.me-profile-overview-page .me-account-activity')).toBeVisible();
  await expect(accountNav).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(accountNav.getByRole('button', { name: '个人信息', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(accountNav.getByRole('button', { name: '个人信息', exact: true })).toHaveCSS('color', 'rgb(49, 93, 255)');
  const learningNavButton = accountNav.getByRole('button', { name: '学习概览', exact: true });
  await learningNavButton.hover();
  await expect(learningNavButton).toHaveCSS('background-color', 'rgba(32, 35, 55, 0.035)');
  if ((viewport?.width ?? 0) <= 640) {
    const activityScroll = page.locator('.me-activity-visual-scroll');
    expect(await activityScroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  }
  await learningNavButton.click();
  await expect(page.locator('.me-learning-overview-page')).toBeVisible();
  await accountNav.getByRole('button', { name: '练习记录', exact: true }).click();
  await expectUsableBox(page.locator('.me-section-card'));
  await expect(page.locator('.me-practice-list')).toContainText('还没有练习记录');
  await accountNav.getByRole('button', { name: '在线模考', exact: true }).click();
  await expectUsableBox(page.locator('.me-section-card'));
  await expect(page.locator('.me-practice-list')).toContainText('还没有模考记录');
  await accountNav.getByRole('button', { name: '账号设置', exact: true }).click();
  await expect(page.locator('.me-settings-workspace')).toBeVisible();
  const [settingsNavBox, settingsPanelBox] = await Promise.all([
    page.locator('.me-settings-sidebar').boundingBox(),
    page.locator('.me-settings-panel').boundingBox()
  ]);
  expect(settingsNavBox).not.toBeNull();
  expect(settingsPanelBox).not.toBeNull();
  expect(settingsNavBox!.y).toBeLessThan(settingsPanelBox!.y);
  expect(Math.abs(settingsNavBox!.width - settingsPanelBox!.width)).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
});

test.skip('retired commerce SurfaceCard and MetricCard areas survive cart and checkout flows', async ({ page }) => {
  await mockSignedInUser(page);
  await page.route('**/api/v1/commerce/cart', (route) => json(route, sampleCart()));
  await page.route('**/api/v1/commerce/checkout', (route) => json(route, {
    id: 88,
    status: 'PENDING',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    payment: null,
    items: [{ id: 10, ...samplePricing().pricingBreakdown[0] }],
    ...samplePricing()
  }));
  await page.route('**/api/v1/commerce/payments', (route) => json(route, {
    provider: 'mock',
    paymentId: 77,
    orderId: 88,
    providerTxnId: 'mock-payment-77',
    amountCents: 39900,
    currency: 'CNY',
    status: 'PENDING',
    callbackSignaturePayload: 'mock-payload',
    testCallbackSignature: 'mock-signature'
  }));

  await page.goto('/cart');
  await expect(page.locator('.commerce-status-grid > article')).toHaveCount(3);
  await expectUsableBox(page.locator('.commerce-card'));
  await expectNoHorizontalOverflow(page);

  await page.goto('/checkout');
  await page.getByRole('button', { name: /创建订单并生成支付/ }).click();
  await expectUsableBox(page.locator('.commerce-card'));
  await expect(page.locator('.commerce-card .commerce-card-head span')).toContainText('PENDING');
  await expectNoHorizontalOverflow(page);
});

test('special-practice visualizer CTA buttons remain usable after GhostButton migration', async ({ page }) => {
  await mockSignedInUser(page);
  await page.goto('/csca-subjects/physics/visualize/newton-second-law');
  await expectUsableBox(page.locator('.special-back-link'));
  await expectUsableBox(page.locator('.newton-action-row button').first());
  await expectUsableBox(page.locator('.newton-support article').nth(1));
  await expectNoHorizontalOverflow(page);
});
