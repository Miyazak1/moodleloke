import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type DemoCredentials = { email: string; password: string };

const repositoryRoot = path.resolve(process.cwd(), '..');
const credentialsPath = path.join(repositoryRoot, '.local', 'agent-demo-credentials.json');
const handwritingFixture = path.join(repositoryRoot, '.local', 'agent-demo-fixtures', 'handwritten-function-answer.png');

function requestId() {
  return crypto.randomUUID();
}

async function authenticate(page: Page) {
  if (!fs.existsSync(credentialsPath) || !fs.existsSync(handwritingFixture)) throw new Error('Run node scripts/agent-demo-seed.cjs --apply first.');
  const backendUrl = process.env.AGENT_LIVE_BACKEND_URL || 'http://localhost:3100';
  let token = process.env.AGENT_DEMO_ACCESS_TOKEN;
  if (!token) {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as DemoCredentials;
    const response = await page.request.post(`${backendUrl}/api/v1/auth/login`, { data: credentials });
    expect(response.ok(), `Demo login failed with HTTP ${response.status()}`).toBeTruthy();
    const result = await response.json();
    token = result.tokens?.accessToken as string;
  }
  expect(token).toBeTruthy();
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', accessToken);
  }, token);
  return { token, backendUrl };
}

async function api(page: Page, backendUrl: string, token: string, pathname: string, options: { method?: string; data?: unknown } = {}) {
  const response = await page.request.fetch(`${backendUrl}${pathname}`, {
    method: options.method || 'GET', data: options.data,
    headers: { authorization: `Bearer ${token}`, ...(options.data ? { 'content-type': 'application/json' } : {}) }
  });
  const text = await response.text();
  expect(response.ok(), `${pathname} returned HTTP ${response.status()}: ${text.slice(0, 500)}`).toBeTruthy();
  return text ? JSON.parse(text) : null;
}

async function waitRun(page: Page, backendUrl: string, token: string, runId: string) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const run = await api(page, backendUrl, token, `/api/v1/agent/runs/${runId}`);
    if (run.status === 'completed') return run;
    if (run.status === 'failed') throw new Error(`Agent run failed: ${run.errorCode || 'unknown'}`);
    await page.waitForTimeout(400);
  }
  throw new Error('Agent run timed out.');
}

test('binds a handwritten review to the current question and preserves the formal evidence boundary', async ({ page }) => {
  test.setTimeout(420_000);
  const { token, backendUrl } = await authenticate(page);
  const conversation = await api(page, backendUrl, token, '/api/v1/agent/conversations', { method: 'POST', data: { title: 'PR12L handwriting golden path' } });
  const submission = await api(page, backendUrl, token, `/api/v1/agent/conversations/${conversation.id}/messages`, {
    method: 'POST', data: { clientRequestId: requestId(), text: '我今天学什么？', locale: 'zh-CN', attachmentIds: [] }
  });
  const run = await waitRun(page, backendUrl, token, submission.runId);
  const artifact = run.artifacts?.find((item: any) => item.type === 'learning_plan');
  expect(artifact?.snapshot?.canStart).toBe(true);
  const launch = await api(page, backendUrl, token, `/api/v1/agent/artifacts/${artifact.id}/start-practice`, {
    method: 'POST', data: { clientRequestId: requestId(), questionLanguage: 'zh' }
  });
  const detail = await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}?language=zh`);
  const question = detail.questions[0];
  expect(question).toBeTruthy();
  const masteryBefore = await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/mastery?subject=${encodeURIComponent(detail.session.subject)}`);

  await page.goto(launch.route);
  const checkButton = page.getByRole('button', { name: '检查手写过程' });
  await expect(checkButton).toBeVisible({ timeout: 45_000 });
  await checkButton.click();
  const pickerBusyMessage = page.getByText('正在选择或检查手写图片');
  await expect(pickerBusyMessage).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(pickerBusyMessage).toBeHidden();
  await expect(checkButton).toBeEnabled();
  await page.locator('.agent-handwriting-input').setInputFiles(handwritingFixture);
  const review = page.locator('.agent-handwriting-review');
  await page.waitForFunction(() => {
    const element = document.querySelector('.agent-handwriting-review');
    return element?.classList.contains('completed') || element?.classList.contains('failed');
  }, undefined, { timeout: 180_000 });
  if (await review.evaluate((element) => element.classList.contains('failed'))) {
    throw new Error(`Handwriting review failed: ${(await review.textContent())?.trim() || 'unknown error'}`);
  }
  await expect(review).toHaveClass(/completed/, { timeout: 180_000 });
  await expect(review).toContainText('不会直接修改成绩或掌握度');

  const handwritingConversationId = await page.evaluate((roundId) => window.localStorage.getItem(`cscalite.agent.handwritingConversation.${roundId}`), launch.roundId);
  expect(handwritingConversationId).toBeTruthy();
  const analyses = await api(page, backendUrl, token, `/api/v1/agent/conversations/${handwritingConversationId}/attachment-analyses`);
  const analysis = analyses.filter((item: any) => item.status === 'completed').at(-1);
  expect(analysis.result.mode).toBe('handwritten_solution_review');
  expect(analysis.result.responseDepth).toBe('guided');
  expect(analysis.result.masteryMutation).toBe(false);
  expect(Number(analysis.result.questionContext.roundId)).toBe(Number(launch.roundId));
  expect(Number(analysis.result.questionContext.questionId)).toBe(Number(question.id));
  expect(String(analysis.result.feedback?.fullSolution || '')).toBe('');
  const candidate = await api(page, backendUrl, token, `/api/v1/agent/attachment-analyses/${analysis.id}/evidence-candidate`);
  expect(candidate).toBeNull();
  const masteryAfterReview = await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/mastery?subject=${encodeURIComponent(detail.session.subject)}`);
  expect(masteryAfterReview).toEqual(masteryBefore);

  await page.reload();
  await expect(page.locator('.agent-handwriting-review.completed')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.agent-handwriting-review.completed')).toContainText('不会直接修改成绩或掌握度');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.agent-handwriting-review.completed')).toBeVisible();
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(2);
  await page.setViewportSize({ width: 1440, height: 900 });

  const answers = Object.fromEntries(detail.questions.map((item: any) => [String(item.id), item.options[0].id]));
  const latestDetail = await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}?language=zh`);
  await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}`, {
    method: 'PATCH', data: { answers, timeSpent: Object.fromEntries(detail.questions.map((item: any) => [String(item.id), 8])), currentQuestion: 1, expectedVersion: latestDetail.round.version }
  });
  const report = await api(page, backendUrl, token, `/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}/submit?language=zh`, { method: 'POST' });
  expect(report.round?.submittedAt || report.summary || report.questions).toBeTruthy();
  const settled = await api(page, backendUrl, token, `/api/v1/agent/practice-rounds/${launch.roundId}/settle`, { method: 'POST' });
  expect(['completed', 'failed']).toContain(settled.decision);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  if (process.env.AGENT_HANDWRITING_LIVE_CAPTURE_PATH) {
    const screenshotPath = path.resolve(process.env.AGENT_HANDWRITING_LIVE_CAPTURE_PATH);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
});
