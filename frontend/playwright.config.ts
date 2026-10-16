import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.E2E_PORT || '5187';
const e2eHost = process.env.E2E_HOST || '127.0.0.1';
const e2eBaseUrl = process.env.E2E_BASE_URL || `http://${e2eHost}:${e2ePort}`;
const shouldReuseExistingServer = process.env.E2E_REUSE_SERVER !== 'false';

// Some development environments inject a global HTTP proxy. Keep local E2E
// traffic direct so Playwright and its web-server readiness probe use the same
// Vite process instead of accidentally routing localhost through that proxy.
const localNoProxyHosts = new Set(
  [process.env.NO_PROXY, process.env.no_proxy, '127.0.0.1', 'localhost', e2eHost]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
);
const localNoProxy = Array.from(localNoProxyHosts).join(',');
process.env.NO_PROXY = localNoProxy;
process.env.no_proxy = localNoProxy;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 8000
  },
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry'
  },
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npm run dev:force -- --host ${e2eHost} --port ${e2ePort}`,
        url: e2eBaseUrl,
        reuseExistingServer: shouldReuseExistingServer,
        timeout: 30000
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } }
  ]
});
