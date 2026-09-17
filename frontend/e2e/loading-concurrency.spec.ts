import { expect, test, type Page, type Route } from '@playwright/test';

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function schoolDetail(id: number, nameZh: string, nameEn: string) {
  return {
    id,
    nameZh,
    nameEn,
    schoolType: '综合类',
    region: '北京',
    city: 'Beijing',
    cityZh: '北京',
    cscaRequired: true,
    cscaRequirement: '数学',
    cscaSubjects: ['数学'],
    languageTags: ['中文授课'],
    subjectTags: ['数学'],
    verificationStatus: 'verified',
    isVerified: true,
    status: 'published',
    programCount: 0,
    programs: [],
    cscaRules: [],
    scholarshipsDetailed: [],
    upcomingDeadlines: []
  };
}

async function installBaseMocks(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
  });
  await page.route('**/api/v1/auth/me**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '未登录' })
    });
  });
  await page.route('**/api/v1/content/home**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

test.skip('retired school detail response cannot overwrite the current route detail', async ({ page }) => {
  await installBaseMocks(page);
  const releaseSchoolOne = deferred();
  let capturedSchoolOne: Route | null = null;

  await page.route('**/api/v1/schools/1**', async (route) => {
    capturedSchoolOne = route;
    await releaseSchoolOne.promise;
    await fulfillJson(route, schoolDetail(1, '旧请求大学', 'Old Request University'));
  });
  await page.route('**/api/v1/schools/2**', async (route) => {
    await fulfillJson(route, schoolDetail(2, '当前页面大学', 'Current Route University'));
  });
  await page.route('**/api/v1/schools?**', async (route) => {
    await fulfillJson(route, {
      items: [],
      pagination: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
      facets: { regions: [], schoolTypes: [], cscaOptions: [], applicationLevels: [] },
      appliedFiltersSummary: []
    });
  });

  await page.goto('/schools/1');
  await expect.poll(() => capturedSchoolOne !== null).toBe(true);
  await page.goto('/schools/2');
  await expect(page.getByRole('heading', { name: '当前页面大学' })).toBeVisible();

  releaseSchoolOne.resolve();
  await expect(page).toHaveURL(/\/schools\/2$/);
  await expect(page.getByRole('heading', { name: '当前页面大学' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('旧请求大学');
});

test.skip('retired search response cannot overwrite newer query results', async ({ page }) => {
  await installBaseMocks(page);
  const releaseOldSearch = deferred();
  let capturedOldSearch: Route | null = null;

  await page.route('**/api/v1/search**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    if (query === 'a') {
      capturedOldSearch = route;
      await releaseOldSearch.promise;
      await fulfillJson(route, {
        query: 'a',
        total: 1,
        degraded: false,
        groups: { school: 1, content: 0, practice: 0, page: 0 },
        items: [{ type: 'school', title: '过期搜索结果', subtitle: '旧请求', snippet: 'stale result', href: '/schools/1', score: 1 }]
      });
      return;
    }
    await fulfillJson(route, {
      query,
      total: 1,
      degraded: false,
      groups: { school: 1, content: 0, practice: 0, page: 0 },
      items: [{ type: 'school', title: `最新搜索结果 ${query}`, subtitle: '当前请求', snippet: 'fresh result', href: '/schools/2', score: 1 }]
    });
  });

  await page.goto('/search?q=a');
  await expect.poll(() => capturedOldSearch !== null).toBe(true);
  await page.goto('/search?q=abc');
  await expect(page.locator('body')).toContainText('最新搜索结果 abc');

  releaseOldSearch.resolve();
  await expect(page).toHaveURL(/\/search\?q=abc$/);
  await expect(page.locator('body')).toContainText('最新搜索结果 abc');
  await expect(page.locator('body')).not.toContainText('过期搜索结果');
});

