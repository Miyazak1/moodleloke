import { defineConfig, devices } from '@playwright/test';

const localNoProxy = 'localhost,127.0.0.1,::1';
process.env.NO_PROXY = [process.env.NO_PROXY, localNoProxy].filter(Boolean).join(',');
process.env.no_proxy = [process.env.no_proxy, localNoProxy].filter(Boolean).join(',');
const port = process.env.E2E_PORT || '5197';
const host = process.env.E2E_HOST || 'localhost';
const baseURL = `http://${host}:${port}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'agent-runtime.spec.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: { baseURL, trace: 'on-first-retry' },
  webServer: {
    command: `${npmCommand} run dev:force -- --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
    env: { ...process.env, VITE_AGENT_WEB_ENABLED: 'true' }
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 820 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 393, height: 852 } } }
  ]
});
