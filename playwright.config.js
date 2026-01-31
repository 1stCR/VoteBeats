// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * VoteBeats E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for consistent state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Start dev servers before running tests (CI only) */
  ...(process.env.CI ? {
    webServer: [
      {
        command: 'npm --prefix server start',
        port: 3002,
        reuseExistingServer: true,
      },
      {
        command: 'npm --prefix client start',
        port: 3000,
        reuseExistingServer: true,
      },
    ],
  } : {}),
});
