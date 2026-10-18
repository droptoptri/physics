import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
export default defineConfig({
  testDir: './tests', testMatch: '*.pages.spec.ts', workers: 1,
  use: {
    baseURL: 'http://localhost:3102',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
  },
  projects: [
    { name: 'pages-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pages-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'node scripts/serve-pages.mjs', url: 'http://localhost:3102/physics/', reuseExistingServer: false },
})
