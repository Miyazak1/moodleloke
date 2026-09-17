import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'agent-teaching-live.spec.ts',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  outputDir: 'test-results/agent-teaching-live',
  use: {
    baseURL: process.env.AGENT_LIVE_FRONTEND_URL || 'http://localhost:5187',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'live-desktop' }]
});
