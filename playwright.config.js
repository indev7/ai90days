// @ts-check
const { defineConfig } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
