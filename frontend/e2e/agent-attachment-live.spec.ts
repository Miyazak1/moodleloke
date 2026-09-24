import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type DemoCredentials = { email: string; password: string };

const repositoryRoot = path.resolve(process.cwd(), '..');
const credentialsPath = path.join(repositoryRoot, '.local', 'agent-demo-credentials.json');
const fixtureRoot = path.join(repositoryRoot, '.local', 'agent-demo-fixtures');

function fixture(name: string) {
  const filename = path.join(fixtureRoot, name);
  if (!fs.existsSync(filename)) throw new Error(`Missing ${name}. Run node scripts/agent-demo-seed.cjs --apply from the repository root.`);
  return filename;
}

async function authenticate(page: Page) {
  if (!fs.existsSync(credentialsPath)) throw new Error('Missing local demo credentials. Run the demo seed first.');
  const backendUrl = process.env.AGENT_LIVE_BACKEND_URL || 'http://localhost:3100';
  let token = process.env.AGENT_DEMO_ACCESS_TOKEN;
  if (!token) {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as DemoCredentials;
    const response = await page.request.post(`${backendUrl}/api/v1/auth/login`, { data: credentials });
    expect(response.ok(), `Demo login failed with HTTP ${response.status()}`).toBeTruthy();
    const result = await response.json();
    token = result.tokens?.accessToken;
  }
  expect(typeof token).toBe('string');
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', accessToken);
  }, token);
}

async function uploadAndSend(page: Page, filename: string, note: string) {
  await page.getByRole('button', { name: '新建学习对话' }).click();
  await page.locator('.agent-file-input').setInputFiles(filename);
  const name = path.basename(filename);
  const queued = page.locator('.agent-attachment-item').filter({ hasText: name });
  await expect(queued).toBeVisible();
  await expect(queued).not.toContainText(/上传中|正在识别文档/, { timeout: 45_000 });
  await page.getByLabel('向学习 Agent 提问').fill(note);
  await expect(page.getByRole('button', { name: '发送' })).toBeEnabled();
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.locator('.agent-message-attachments').filter({ hasText: name })).toBeVisible({ timeout: 45_000 });
  const citation = page.locator('.agent-analysis-citations').filter({ hasText: name });
  await Promise.race([
    citation.waitFor({ state: 'visible', timeout: 150_000 }),
    page.locator('.agent-inline-error').waitFor({ state: 'visible', timeout: 150_000 }).then(async () => {
      throw new Error(`Attachment analysis failed: ${await page.locator('.agent-inline-error').innerText()}`);
    })
  ]);
  await expect(citation).toContainText(/第\s*1\s*页/);
  return { name, citation };
}

test('analyzes a handwritten answer and a native PDF with grounded citations', async ({ page }) => {
  test.setTimeout(360_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticate(page);
  await page.goto('/agent');

  await uploadAndSend(page, fixture('handwritten-function-answer.png'), '请分析这张手写答案，识别题目、学生答案并判断是否正确。');
  const evidence = page.locator('.agent-evidence-card').filter({ hasText: '确认是否记入学习档案' }).first();
  await expect(evidence).toContainText('已匹配可信题源', { timeout: 30_000 });
  await expect(evidence).toContainText('CSCA 练习题');
  await evidence.getByRole('button', { name: '确认并更新方案' }).click();
  const confirmed = page.locator('.agent-evidence-card.confirmed').first();
  await expect(confirmed).toContainText('已记入学习档案', { timeout: 60_000 });
  await confirmed.getByRole('button', { name: '撤销这条证据' }).click();
  await expect(page.locator('.agent-evidence-card.revoked').first()).toContainText('证据已撤销', { timeout: 60_000 });

  await uploadAndSend(page, fixture('function-answer.pdf'), '请核对这份 PDF 中的题目和答案，并给出可追溯的页码引用。');
  await expect(page.locator('.agent-message-block.assistant').filter({ has: page.locator('.agent-analysis-citations') }).last()).toContainText(/f\(4\)|11|正确/i);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  if (process.env.AGENT_ATTACHMENT_LIVE_CAPTURE_PATH) {
    const screenshotPath = path.resolve(process.env.AGENT_ATTACHMENT_LIVE_CAPTURE_PATH);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((message) => !/Failed to load resource/i.test(message))).toEqual([]);
});
