// Mutation testing for the pure, security-critical libraries in src/lib.
// See docs/testing.md ("Mutation Testing") for how to run and triage results.
//
// Stryker is pinned to v9: v10 requires Node >=22, while .nvmrc pins Node 20.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: { configFile: "vitest.config.ts" },
  // Only run the tests that cover a given mutant, instead of the whole suite.
  coverageAnalysis: "perTest",
  mutate: [
    "src/lib/**/*.{ts,tsx}",
    "!src/lib/**/*.test.{ts,tsx}",
    "!src/lib/**/*.fuzz.test.{ts,tsx}",
    "!src/lib/**/*.d.ts",
    // Static message catalogues are data, not logic.
    "!src/lib/i18n/messages/**",
  ],
  tsconfigFile: "tsconfig.json",
  // Incremental mode is opted into per run (`npm run test:mutation:incremental`).
  // Full runs (`npm run test:mutation`) ignore the cache.
  incremental: false,
  incrementalFile: "reports/stryker-incremental.json",
  tempDirName: ".stryker-tmp",
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Generous timeouts so slow CI runners are not reported as "timeout" kills.
  timeoutMS: 10000,
  timeoutFactor: 3,
  // `break` fails the run; high/low only colour the report. Ratchet upward
  // once the baseline in docs/testing.md is recorded.
  thresholds: { high: 85, low: 75, break: 75 },
};

export default config;
