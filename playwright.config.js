const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mobile-flow.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "rm -f ${DATABASE_PATH:-/tmp/laogong-caipu-stitch-v3-e2e.sqlite} && AI_PROVIDER=mock DATABASE_PATH=${DATABASE_PATH:-/tmp/laogong-caipu-stitch-v3-e2e.sqlite} npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    reducedMotion: "reduce",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "mobile-375", use: { viewport: { width: 375, height: 812 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 } } }
  ]
});
