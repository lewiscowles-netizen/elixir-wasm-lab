const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['list'], ['./tests/evidence-reporter.cjs']],
  timeout: 150000,
  use: { baseURL: 'http://127.0.0.1:8130', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'python3 serve.py', url: 'http://127.0.0.1:8130/web/', reuseExistingServer: true },
});
