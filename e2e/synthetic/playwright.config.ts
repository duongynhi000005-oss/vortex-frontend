import { defineConfig, devices } from "@playwright/test";

/**
 * Scheduled staging synthetic (see docs/synthetic-monitoring.md).
 *
 * Independent from the PR e2e suites: no webServer, no mocked wallet, read-only
 * (nothing is signed or submitted). Targets are supplied by the workflow via env.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  // One retry: a single transient failure must not open an incident.
  retries: 1,
  timeout: 90_000,
  forbidOnly: !!process.env["CI"],
  reporter: [
    ["list"],
    ["json", { outputFile: "synthetic-results/results.json" }],
  ],
  use: {
    baseURL: process.env["SYNTHETIC_BASE_URL"] || "https://vortex-frontend.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "synthetic-results/artifacts",
  projects: [
    {
      name: "staging-flow",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
