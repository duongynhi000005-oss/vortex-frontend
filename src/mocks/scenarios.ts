/**
 * Scenario switches for the mock API. A scenario decides how many fixture rows
 * exist, how much latency is injected, and whether every request fails.
 *
 * Browser (`npm run dev:mock`): pick one with `?mock=<name>` in the URL.
 * Vitest / Playwright: pass a scenario object to `createHandlers`.
 */

export type MockScenarioName = "default" | "empty" | "error" | "slow" | "large";

export interface MockScenario {
  name: MockScenarioName;
  /** Number of seeded rows in the public intent feed. */
  feedCount: number;
  /** Artificial latency added to every handled request, in milliseconds. */
  latencyMs: number;
  /** When set, every handled request responds with this HTTP status. */
  errorStatus: number | null;
}

export const MOCK_SCENARIOS: Record<MockScenarioName, MockScenario> = {
  default: { name: "default", feedCount: 12, latencyMs: 0, errorStatus: null },
  empty: { name: "empty", feedCount: 0, latencyMs: 0, errorStatus: null },
  error: { name: "error", feedCount: 0, latencyMs: 0, errorStatus: 500 },
  slow: { name: "slow", feedCount: 12, latencyMs: 2000, errorStatus: null },
  large: { name: "large", feedCount: 5000, latencyMs: 0, errorStatus: null },
};

/** Reads `?mock=<name>` from a query string; unknown or missing names fall back to `default`. */
export function resolveScenario(search: string): MockScenario {
  const requested = new URLSearchParams(search).get("mock");
  if (requested && Object.prototype.hasOwnProperty.call(MOCK_SCENARIOS, requested)) {
    return MOCK_SCENARIOS[requested as MockScenarioName];
  }
  return MOCK_SCENARIOS.default;
}
