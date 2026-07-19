const { scryptSync } = require("node:crypto");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { defineConfig } = require("@playwright/test");

const password = "family-e2e-password";
const salt = Buffer.from("family-e2e-salt!", "utf8");
const passwordHash = `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 64).toString("base64url")}`;
const databasePath = join(tmpdir(), `laogong-caipu-family-e2e-${process.pid}.sqlite`);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: "family-cooking-flow.spec.js",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AI_PROVIDER: "mock",
      DATABASE_PATH: databasePath,
      FAMILY_PASSWORD_HASH: passwordHash,
      FAMILY_SESSION_SECRET: "family-e2e-session-secret-is-32-bytes",
    },
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [{ name: "family-mobile-390", use: { viewport: { width: 390, height: 844 } } }],
});
