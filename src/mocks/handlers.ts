/**
 * Single MSW route table for the relay REST API. The same handler array is used
 * by the browser worker (`dev:mock`), the Node server (Vitest) and Playwright
 * (via `getResponse`), so every consumer sees identical behaviour.
 */
import { delay, http, HttpResponse, type HttpResponseResolver } from "msw";
import {
  createMockDb,
  createQuote,
  createSolver,
  type MockDb,
  type MockFeedItem,
} from "./fixtures";
import { MOCK_SCENARIOS, type MockScenario } from "./scenarios";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function createHandlers(
  scenario: MockScenario = MOCK_SCENARIOS.default,
  db: MockDb = createMockDb(scenario),
) {
  // Wraps a resolver with the scenario's latency and error injection.
  const scoped =
    (resolver: HttpResponseResolver): HttpResponseResolver =>
    async (info) => {
      if (scenario.latencyMs > 0) await delay(scenario.latencyMs);
      if (scenario.errorStatus !== null) {
        return HttpResponse.json({ error: "Mock error" }, { status: scenario.errorStatus });
      }
      return resolver(info);
    };

  return [
    http.get(
      `${API_ORIGIN}/intents/feed`,
      scoped(() => HttpResponse.json(db.feed)),
    ),

    http.get(
      `${API_ORIGIN}/intents`,
      scoped(() => HttpResponse.json(Array.from(db.intents.values()))),
    ),

    http.post(
      `${API_ORIGIN}/intents`,
      scoped(() => {
        // Creating an intent updates both lists: the caller's list and the public feed.
        const intentId = `intent-${db.intents.size + 1}`;
        const intent: MockFeedItem = {
          id: intentId,
          status: "open",
          sourceAsset: "USDC",
          destAsset: "XLM",
          sourceAmount: "500.00",
          solver: null,
          createdAt: new Date().toISOString(),
        };
        db.intents.set(intentId, intent);
        db.feed.unshift(intent);
        return HttpResponse.json({ intentId, unsignedXdr: "unsigned-xdr" });
      }),
    ),

    http.get(
      `${API_ORIGIN}/intents/:id`,
      scoped(({ params }) => {
        const intent = db.intents.get(String(params.id));
        if (!intent) return HttpResponse.json({ error: "Not found" }, { status: 404 });
        return HttpResponse.json(intent);
      }),
    ),

    http.post(
      `${API_ORIGIN}/intents/:id/submit`,
      scoped(({ params }) => {
        const intent = db.intents.get(String(params.id));
        if (!intent) return HttpResponse.json({ error: "Not found" }, { status: 404 });
        intent.status = "pending";
        return HttpResponse.json({ intentId: intent.id, status: intent.status });
      }),
    ),

    http.get(
      `${API_ORIGIN}/quote`,
      scoped(() => HttpResponse.json(createQuote())),
    ),

    http.get(
      `${API_ORIGIN}/solvers/:address`,
      scoped(({ params }) => HttpResponse.json(createSolver(String(params.address)))),
    ),
  ];
}
