import { defineConfig } from '@playwright/test';

// Checks the built site, where /frame/, /setup/, and /wifi/ come from the pinned inky-soup release.
export default defineConfig({
  testDir: './tests',
  testMatch: 'frame-app.spec.js',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
