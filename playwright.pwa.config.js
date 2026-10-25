import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'frame-pwa.spec.js',timeout:45000,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844}},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});
