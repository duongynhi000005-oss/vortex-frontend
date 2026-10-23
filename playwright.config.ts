import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the end-to-end suite in `e2e/`.
 *
 * - Local runs build and serve the production bundle on :3000 (the production
 *   CSP headers are what the CSP specs assert against).
 * - Set `BASE_URL` to run against an existing deployment (e.g. PR previews);
 *   no local server is started in that case.
 * - CI sets `PLAYWRIGHT_RETRIES` and shards per browser project.
 */
const baseURL = process.env["BASE_URL"] ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: Number(process.env["PLAYWRIGHT_RETRIES"] ?? (process.env["CI"] ? 2 : 0)),
  ...(process.env["CI"] ? { workers: 1 } : {}),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(process.env["BASE_URL"]
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run start",
          url: baseURL,
          reuseExistingServer: !process.env["CI"],
          timeout: 300_000,
        },
      }),
});
