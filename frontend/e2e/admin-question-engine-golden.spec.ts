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
    window.localStorage.setItem('cscalite.accessToken', 'admin-plugin-token');
    window.localStorage.setItem('moodlelike.currentUser', JSON.stringify(seededUser));
  }, { seededUser: user });
  await page.route('**/api/v1/auth/me**', (route) => json(route, user));
}

const disabledStatus = {
  schemaVersion: '1',
  host: {
    apiVersion: '1',
    selectedPluginId: 'verified-math-1.43',
    fallbackMode: 'verified-bank-only',
    fallbackAvailable: true,
    arbitraryRuntimeCodeLoading: false,
    enforcedCapabilities: ['question.generate'],
    taskProtocol: {
      version: 'question-engine-task-v1', executionMode: 'in-process', signingConfigured: false,
      sidecarEndpointConfigured: false, nonceStoreConfigured: true,
      transportImplemented: true, sidecarActivationSupported: false,
      sidecarActivationEnabled: false, workerCapabilities: [], acceptedWorkerVersions: ['1.43.0']
    }
  },
  runtime: {
    worker: { status: 'not_applicable', checkedAt: '2026-09-28T08:00:00.000Z', latencyMs: 0, blockers: [] },
    transport: {
      circuit: { open: false, consecutiveFailures: 0, threshold: 3, resetMs: 30000 },
      lastSuccessAt: null, lastFailure: null
    }
  },
  plugins: [{
    descriptor: {
      id: 'verified-math-1.43',
      displayName: 'Verified Mathematics',
      version: '1.43.0',
      apiVersion: '1',
      capabilities: ['question.generate'],
      subjects: ['math'], executionBoundary: 'isolated-worker',
      activationMode: 'configuration-restart'
    },
    selected: true,
    enabled: false,
    provider: 'rule-fallback',
    model: '',
    providerConfigured: false,
    productionRunnerEnabled: false,
    generationWritesEnabled: false,
    status: 'disabled',
    blockers: ['plugin_host_disabled'],
    capabilityStates: [
      { capability: 'question.generate', enabled: false, provider: 'rule-fallback', model: 'deepseek-v4-flash', providerConfigured: false, executionEnabled: false, status: 'disabled', blockers: ['plugin_host_disabled', 'question_generate_disabled'] }
    ]
  }]
};

test('shows a fail-safe disabled question-engine plugin without generation actions', async ({ page }) => {
  await seedIdentity(page, admin);
  await page.route((url) => url.pathname === '/api/v1/admin/question-engine/plugins/status', (route) => json(route, disabledStatus));

  await page.goto('/admin/ai');
  await expect(page.getByRole('heading', { name: '题目引擎接入状态' })).toBeVisible();
  await expect(page.getByText('已核验题库', { exact: true })).toBeVisible();
  await expect(page.getByText('生成写入')).toBeVisible();
  await expect(page.getByText('Verified Mathematics · v1.43.0')).toBeVisible();
  const disabledReasons = page.getByText(/plugin_host_disabled/);
  await expect(disabledReasons).toHaveCount(1);
  await expect(disabledReasons.first()).toBeVisible();
  await expect(page.getByText('question.generate', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('question.review', { exact: true })).toHaveCount(0);
  await expect(page.getByText('question.topic-map', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/question-engine-task-v1/)).toBeVisible();
  await expect(page.getByText('执行模式：in-process')).toBeVisible();
  await expect(page.getByRole('button', { name: /生成|启用|安装/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '后台工作区导航' }).getByRole('button')).toHaveCount(10);
});

test('does not request plugin status for a non-admin', async ({ page }) => {
  let statusRequested = false;
  await seedIdentity(page, { ...admin, id: '2', email: 'student@example.com', role: 'student' });
  await page.route((url) => url.pathname === '/api/v1/admin/question-engine/plugins/status', (route) => {
    statusRequested = true;
    return json(route, { message: 'Forbidden' }, 403);
  });

  await page.goto('/admin/ai');
  await expect(page.getByText('当前账号没有后台权限。')).toBeVisible();
  await expect.poll(() => statusRequested).toBe(false);
});
