import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
export default defineConfig({
  testDir:'./tests',testMatch:'site.spec.ts',fullyParallel:false,workers:1,
  reporter:'list',use:{baseURL:'http://localhost:3101',trace:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']}},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'node server/index.mjs',url:'http://localhost:3101/api/health',reuseExistingServer:false,timeout:30000,env:{PORT:'3101',APP_ORIGIN:'http://localhost:3101',DATA_DIR:'/tmp/sgt-playwright-data',SERVE_DIST:'true',NODE_ENV:'test'}}
})
