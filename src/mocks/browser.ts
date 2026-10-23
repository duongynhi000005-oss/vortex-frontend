/**
 * Browser MSW worker for `npm run dev:mock`. Loaded lazily by `MockApiGate`
 * so it never reaches the production bundle.
 */
import { setupWorker } from "msw/browser";
import { createHandlers } from "./handlers";
import type { MockScenario } from "./scenarios";

export async function startMockApi(scenario: MockScenario): Promise<void> {
  const worker = setupWorker(...createHandlers(scenario));
  await worker.start({
    serviceWorker: { url: "/mockServiceWorker.js" },
    onUnhandledRequest: "bypass",
    quiet: true,
  });
}
