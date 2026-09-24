import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type DemoCredentials = { email: string; password: string };

function readCredentials(): DemoCredentials {
  const filename = path.resolve(process.cwd(), '..', '.local', 'agent-demo-credentials.json');
  if (!fs.existsSync(filename)) {
    throw new Error('Missing local demo account. Run npm run local:setup from the repository root.');
  }
  const value = JSON.parse(fs.readFileSync(filename, 'utf8')) as Partial<DemoCredentials>;
  if (!value.email || !value.password) throw new Error('Local demo credential file is incomplete.');
  return { email: value.email, password: value.password };
}

async function login(page: Page) {
  const backendUrl = process.env.AGENT_LIVE_BACKEND_URL || 'http://localhost:3100';
  const response = await page.request.post(`${backendUrl}/api/v1/auth/login`, { data: readCredentials() });
  expect(response.ok(), `Demo login failed with HTTP ${response.status()}`).toBeTruthy();
  const result = await response.json();
  expect(typeof result.tokens?.accessToken).toBe('string');
  return result.tokens.accessToken as string;
}

test('loads the independent Agent with real read data and migrates browser identity', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const token = await login(page);
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', accessToken);
  }, token);

  await page.goto('/agent');
  await expect(page.locator('.agent-live-status:visible').first()).toContainText('学习数据已连接');
  await expect(page.locator('.agent-account-card')).toBeVisible();
  await page.getByRole('button', { name: /学科问答/ }).click();
  await expect(page.getByLabel('询问数学、物理或化学')).toBeVisible();
  await expect(page.getByRole('button', { name: '添加附件' })).toHaveCount(0);

  const storage = await page.evaluate(() => ({
    token: window.localStorage.getItem('moodlelike.accessToken'),
    locale: window.localStorage.getItem('moodlelike.locale'),
    localeSource: window.localStorage.getItem('moodlelike.localeSource'),
    legacyToken: window.localStorage.getItem('cscalite.accessToken'),
    legacyLocale: window.localStorage.getItem('cscalite.locale'),
    legacyLocaleSource: window.localStorage.getItem('cscalite.localeSource')
  }));
  expect(storage.token).toBe(token);
  expect(storage.locale).toBe('zh-CN');
  expect(storage.localeSource).toBe('manual');
  expect(storage.legacyToken).toBeNull();
  expect(storage.legacyLocale).toBeNull();
  expect(storage.legacyLocaleSource).toBeNull();

  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/me\?section=settings$/);
  await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();
  await expect(page.getByText('机构与 AI 额度', { exact: true })).toHaveCount(0);
  await expect(page.locator('.standalone-account-card.profile')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
