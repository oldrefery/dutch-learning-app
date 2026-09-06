import { defineConfig } from '@playwright/test'

// Deliberately independent of the authenticated/deployed-app configuration.
// Do not load env files, webServer, auth setup or saved application sessions.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'smoke-collection.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 15_000,
  globalTimeout: 60_000,
  reporter: 'list',
  outputDir: 'test-results/fixtures',
  use: {
    browserName: 'chromium',
    offline: true,
    serviceWorkers: 'block',
    storageState: { cookies: [], origins: [] },
    actionTimeout: 5_000,
  },
})
