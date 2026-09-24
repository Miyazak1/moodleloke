import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type DemoCredentials = { email: string; password: string };
type TeachingScenario = {
  marker: string;
  conversationId: string;
  interventionId: string;
  relativeUrl: string;
};

const repositoryRoot = path.resolve(process.cwd(), '..');

function readJson<T>(filename: string, guidance: string): T {
  if (!fs.existsSync(filename)) throw new Error(guidance);
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T;
}

async function authenticate(page: Page) {
  const credentials = readJson<DemoCredentials>(
    path.join(repositoryRoot, '.local', 'agent-demo-credentials.json'),
    'Missing demo credentials. Run node scripts/agent-teaching-browser-demo-prepare.cjs --apply from the repository root.'
  );
  const backendUrl = process.env.AGENT_LIVE_BACKEND_URL || 'http://localhost:3100';
  const response = await page.request.post(`${backendUrl}/api/v1/auth/login`, { data: credentials });
  expect(response.ok(), `Demo login failed with HTTP ${response.status()}`).toBeTruthy();
  const result = await response.json();
  const token = result.tokens?.accessToken as string | undefined;
  expect(typeof token).toBe('string');
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', accessToken);
  }, token);
}

async function completeVerification(page: Page) {
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    await page.locator('.special-answer-options button:has(b:text-is("B"))').click();
    if (index < 2) await page.getByRole('button', { name: '下一题' }).click();
  }
  await page.getByRole('button', { name: '完成本轮' }).click();
  await expect(page.getByRole('heading', { name: /验证完成$/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '返回 Agent 查看验证结论。', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '返回 Agent 更新下一步' }).click();
}

function advanceScheduledVerification() {
  execFileSync(process.execPath, [path.join(repositoryRoot, 'scripts', 'agent-teaching-stability-demo-advance.cjs'), '--apply'], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'pipe'
  });
}

test('completes the real proactive teaching path inside the Agent workspace', async ({ page }) => {
  const scenario = readJson<TeachingScenario>(
    path.join(repositoryRoot, '.local', 'agent-teaching-browser-demo.json'),
    'Missing teaching scenario. Run node scripts/agent-teaching-browser-demo-prepare.cjs --apply from the repository root.'
  );
  expect(scenario.marker).toBe('LOCAL_DEMO_ONLY_AGENT_TEACHING_BROWSER');

  await authenticate(page);
  await page.goto(scenario.relativeUrl);

  const offer = page.locator('.agent-intervention-card');
  await expect(offer).toContainText('函数水平平移的方向判断已重复出错 4 次');
  await expect(offer).toContainText('看懂函数图像的水平平移');
  await page.getByRole('button', { name: '开始学习' }).click();

  await expect(page).toHaveURL(/agentTeachingDeliveryId=/);
  await expect(page.getByLabel('Agent 知识讲解工作区')).toBeVisible();
  await expect(offer).toContainText('继续学习');
  await expect(page.locator('.agent-message-block.assistant')).toContainText('不能把“看过”当成“掌握”');

  await page.reload();
  await expect(page.getByLabel('Agent 知识讲解工作区')).toBeVisible();
  await page.getByRole('button', { name: '开始讲解' }).click();
  await page.getByRole('radio', { name: '(3, 0)' }).check();
  await page.getByRole('button', { name: '检查我的判断' }).click();
  await expect(page.getByText('正确。顶点横坐标就是 h，所以 h=3 时顶点为 (3,0)。')).toBeVisible();
  await page.getByRole('button', { name: '我理解了，完成微课' }).click();

  await expect(page.getByLabel('Agent 知识讲解工作区')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /开始验证/ })).toBeVisible();
  await page.getByRole('button', { name: /开始验证/ }).click();
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByText('讲解后独立验证')).toBeVisible();

  await completeVerification(page);

  await expect(page).toHaveURL(new RegExp(`/agent\\?agentContextId=${scenario.conversationId}`));
  await expect(page.locator('.agent-message-block.assistant').last()).toContainText(/即时独立验证 3\/3 题通过|当前阶段已记录/);
  await expect(page.locator('.agent-message-block.assistant').last()).toContainText(/尚不等于稳定掌握|后续保持验证/);

  advanceScheduledVerification();
  await page.reload();
  const retentionCard = page.locator('.agent-verification-card');
  await expect(retentionCard).toContainText('延迟保持验证');
  await retentionCard.getByRole('button', { name: /开始验证/ }).click();
  await completeVerification(page);

  await expect(page).toHaveURL(new RegExp(`/agent\\?agentContextId=${scenario.conversationId}`));
  await expect(page.locator('.agent-message-block.assistant').last()).toContainText(/保持验证 3\/3 题通过|当前阶段已记录/);
  const transferCard = page.locator('.agent-verification-card');
  await expect(transferCard).toContainText('跨题型迁移验证');
  await transferCard.getByRole('button', { name: /开始验证/ }).click();
  await completeVerification(page);

  await expect(page).toHaveURL(new RegExp(`/agent\\?agentContextId=${scenario.conversationId}`));
  await expect(page.locator('.agent-message-block.assistant').last()).toContainText('迁移验证 3/3 题通过');
  await expect(page.locator('.agent-message-block.assistant').last()).toContainText('三阶段验证已确认稳定掌握');
  await expect(page.locator('.agent-verification-card')).toHaveCount(0);

  await page.getByRole('button', { name: '学习计划', exact: true }).click();
  await expect(page.getByLabel('学习决策变化')).toContainText('已确认稳定掌握');
  await expect(page.getByLabel('当前学习计划')).toBeVisible();

  await page.getByRole('button', { name: '目标进度', exact: true }).click();
  await expect(page.getByLabel('已保存的学习阶段')).toContainText('已确认稳定掌握');
  await expect(page.getByLabel('已保存的学习阶段').locator('button')).toHaveCount(3);

  await page.getByRole('button', { name: '错题与薄弱点', exact: true }).click();
  await expect(page.getByLabel('薄弱知识点').locator('article').first()).toBeVisible();
  await expect(page.locator('aside[aria-label="错题与薄弱点"]')).toContainText('真实学习证据');

  await page.getByRole('button', { name: '学习资料', exact: true }).click();
  const firstResource = page.getByLabel('可用学习资料').locator('button').first();
  await expect(firstResource).toBeVisible();
  await firstResource.click();
  await expect(page.getByLabel('Agent 真题工作区')).toBeVisible();
  const paperViewer = page.locator('.agent-past-paper-viewer iframe');
  await expect(paperViewer).toBeVisible();
  const paperUrl = await paperViewer.getAttribute('src');
  expect(paperUrl, 'The Agent past-paper viewer should point to a published PDF.').toBeTruthy();
  const paperResponse = await page.request.get(paperUrl!);
  expect(paperResponse.status(), `Published PDF failed to load from ${paperUrl}`).toBe(200);
  expect(paperResponse.headers()['content-type']).toContain('application/pdf');

  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await expect(page.getByLabel('Agent 学习设置工作区')).toBeVisible();
  await expect(page.locator('.agent-message-block.assistant').first()).toBeVisible();
  await page.getByRole('button', { name: '学习时间', exact: true }).click();
  await page.getByLabel('默认单次时长').fill('30');
  await page.getByRole('button', { name: '保存学习时间', exact: true }).click();
  await expect(page.locator('.agent-settings-status')).toContainText('学习时间已更新');

  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/me\?section=settings$/);
});
