import { defineConfig, devices } from '@playwright/test';

const localNoProxy = 'localhost,127.0.0.1,::1';
process.env.NO_PROXY = [process.env.NO_PROXY, localNoProxy].filter(Boolean).join(',');
process.env.no_proxy = [process.env.no_proxy, localNoProxy].filter(Boolean).join(',');
const port = process.env.E2E_PORT || '5198';
const host = process.env.E2E_HOST || '127.0.0.1';
const baseURL = 'http://' + host + ':' + port;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './e2e',
  timeout: 35_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/golden' }]] : 'line',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: npmCommand + ' run dev:force -- --host ' + host + ' --port ' + port,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 45_000,
    env: { ...process.env, VITE_AGENT_WEB_ENABLED: 'true', VITE_STANDALONE_AGENT: '1' }
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }]
});
