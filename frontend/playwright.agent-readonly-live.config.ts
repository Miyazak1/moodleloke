import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.AGENT_LIVE_FRONTEND_URL || 'http://localhost:5190';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'agent-readonly-live.spec.ts',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  outputDir: 'test-results/agent-readonly-live',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'readonly-live-desktop' }]
});
