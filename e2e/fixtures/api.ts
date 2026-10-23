import type { Page } from "@playwright/test";
import { getResponse } from "msw";
import { createHandlers } from "../../src/mocks/handlers";
import { MOCK_SCENARIOS } from "../../src/mocks/scenarios";

export const API_URL = "http://localhost:4000";

const handlers = createHandlers(MOCK_SCENARIOS.empty);

// Stubs the backend routes the swap flow touches via the shared MSW handlers.
// Each spec that needs a different response should call `page.route` again
// after this, since later routes take precedence over earlier ones.
export async function mockBackend(page: Page) {
  await page.route(
    (url) => url.origin === API_URL,
    async (route) => {
      const request = route.request();
      const response = await getResponse(
        handlers,
        new Request(request.url(), {
          method: request.method(),
          headers: request.headers(),
          body: request.postData() ?? undefined,
        })
      );
      if (!response) return route.fallback();

      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    }
  );
}
