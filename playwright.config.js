import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:4173/visualsynth/',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run serve -- --base=/visualsynth/',
    url: 'http://127.0.0.1:4173/visualsynth/',
    reuseExistingServer: !process.env.CI
  }
});
