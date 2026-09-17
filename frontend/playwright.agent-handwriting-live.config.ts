import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.AGENT_LIVE_FRONTEND_URL || 'http://localhost:5187';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'agent-handwriting-guided-live.spec.ts',
  timeout: 420_000,
  expect: { timeout: 45_000 },
  workers: 1,
  retries: 0,
  outputDir: 'test-results/agent-handwriting-live',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'handwriting-live-desktop' }]
});
