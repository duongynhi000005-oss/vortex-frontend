import { test, expect, type Page } from "@playwright/test";
import { getResponse } from "msw";
import { createHandlers } from "../src/mocks/handlers";
import { MOCK_SCENARIOS } from "../src/mocks/scenarios";

const API_URL = "http://localhost:4000";
const PUBLIC_KEY = "GDEMOE2ESMOKETESTPUBLICKEY000000000000000000000";

// Freighter talks to the page over window.postMessage, not a `window.freighter`
// object with methods — this shims that bridge so the app's real
// @stellar/freighter-api calls resolve without the browser extension installed.
async function mockFreighter(page: Page) {
  await page.addInitScript((publicKey: string) => {
    (window as unknown as { freighter: boolean }).freighter = true;

    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || !data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") {
        return;
      }

      const respond = (fields: Record<string, unknown>) => {
        window.postMessage(
          { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: data.messageId, ...fields },
          "*"
        );
      };

      switch (data.type) {
        case "REQUEST_ACCESS":
        case "REQUEST_PUBLIC_KEY":
          respond({ publicKey, error: "" });
          break;
        case "REQUEST_NETWORK":
          respond({ network: "TESTNET", error: "" });
          break;
        case "REQUEST_ALLOWED_STATUS":
          respond({ isAllowed: true });
          break;
        case "SUBMIT_TRANSACTION":
          respond({ signedTransaction: "signed-xdr-e2e-mock", error: "" });
          break;
      }
    });
  }, PUBLIC_KEY);
}

// Route fulfilment goes through the shared MSW handlers (src/mocks/handlers.ts)
// so the spec and `npm run dev:mock` cannot drift apart. The "empty" scenario
// keeps the public feed empty, which is the state this flow was written against.
const handlers = createHandlers(MOCK_SCENARIOS.empty);

async function mockBackend(page: Page) {
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

test("swap happy path: connect wallet, get a quote, submit, and see success", async ({ page }) => {
  await mockFreighter(page);
  await mockBackend(page);

  await page.goto("/");

  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByRole("button", { name: /^Disconnect wallet/ })).toBeVisible();

  await page.getByPlaceholder("0").fill("500");
  await expect(page.getByText("Beta Liquidity Co")).toBeVisible();

  await page.getByRole("button", { name: "Swap 500 USDC → USDC" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Swap submitted successfully." })
  ).toBeVisible();
});
