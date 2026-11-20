/*
 * E2E Arus (fase 4 QA). Menjalankan build produksi lewat `vite preview`.
 *   npm run e2e                      → semua project
 *   npx playwright test --project=iphone
 * Device: iPhone 390×844 @3x (WebKit, touch, mobile) dan iPhone SE 375×667.
 * Offline/SW diuji di Chromium (WebKit Playwright di Windows tidak menjalankan service worker).
 */
import { defineConfig } from '@playwright/test'

const PORT = 4173
const common = {
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  hasTouch: true,
  deviceScaleFactor: 3,
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'iphone',
      testIgnore: ['**/offline.spec.ts', '**/small.spec.ts'],
      use: { ...common, browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true },
    },
    {
      name: 'iphone-se',
      testMatch: ['**/small.spec.ts'],
      use: { ...common, browserName: 'webkit', viewport: { width: 375, height: 667 }, isMobile: true },
    },
    {
      name: 'chromium-offline',
      testMatch: ['**/offline.spec.ts'],
      use: { ...common, browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'allow' },
    },
  ],
})
