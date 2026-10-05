import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:4173/visualsynth/',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        firefoxUserPrefs: {
          'media.autoplay.default': 0,
          'media.autoplay.block-webaudio': false
        }
      }
    }
  ],
  webServer: {
    command: 'npm run serve -- --base=/visualsynth/',
    url: 'http://127.0.0.1:4173/visualsynth/',
    reuseExistingServer: !process.env.CI
  }
});