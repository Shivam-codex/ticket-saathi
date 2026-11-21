import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env["PLAYWRIGHT_BASE_URL"];
const baseURL = externalBaseUrl ?? "http://127.0.0.1:8081";

export default defineConfig({
  testDir: "./e2e",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalBaseUrl ? undefined : {
    command: "bun run dev --host 127.0.0.1 --port 8081",
    url: baseURL,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    env: { APP_ENV: "test", ALLOW_MOCK_PAYMENTS: "true" },
  },
});
