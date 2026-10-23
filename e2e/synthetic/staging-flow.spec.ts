import { test, expect, type Page } from "@playwright/test";

/**
 * Scheduled user-path check against staging. Each test name is a stable check
 * id: scripts/status-page/normalise-results.mjs keys history and latency stats
 * on these names, so renaming one starts a new series.
 *
 * Read-only by design: no wallet, no signing, no submissions.
 */

// `||` rather than `??`: an empty workflow variable must fall back to the default.
const API_URL = process.env["SYNTHETIC_API_URL"] || "https://api.vortex-protocol.org";
// Canned route for the quote check. Override via SYNTHETIC_QUOTE_PATH if the
// relay's quote contract changes; the default is a placeholder to verify.
const QUOTE_PATH =
  process.env["SYNTHETIC_QUOTE_PATH"] ||
  "/quote?srcChain=stellar&srcAsset=XLM&dstChain=stellar&dstAsset=USDC&amount=10";
const PAGE_BUDGET_MS = 60_000;
const WS_BUDGET_MS = Number(process.env["SYNTHETIC_WS_BUDGET_MS"] ?? 10_000);
const QUOTE_BUDGET_MS = Number(process.env["SYNTHETIC_QUOTE_BUDGET_MS"] ?? 5_000);

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

test("page-load", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  const response = await page.goto("/", { waitUntil: "load", timeout: PAGE_BUDGET_MS });
  expect(response, "no response from /").not.toBeNull();
  expect(response!.status(), "unexpected status for /").toBeLessThan(400);
  await expect(page.locator("#live-feed-region")).toBeAttached({ timeout: PAGE_BUDGET_MS });

  expect(errors, "console errors on load").toEqual([]);
});

test("relay-health", async ({ request }) => {
  const response = await request.get(`${API_URL.replace(/\/$/, "")}/health`, {
    timeout: PAGE_BUDGET_MS,
  });
  expect(response.status(), "relay /health").toBeLessThan(400);
});

test("feed", async ({ page }) => {
  await page.goto("/", { waitUntil: "load", timeout: PAGE_BUDGET_MS });

  const region = page.locator("#live-feed-region");
  await expect(region).toBeVisible({ timeout: PAGE_BUDGET_MS });
  // Either intents render, or the feed shows an explicit empty state. Both are
  // healthy; a blank or error region is not.
  await expect(
    region.getByRole("listitem").first().or(region.getByText(/no |empty|nothing/i).first()),
  ).toBeVisible({ timeout: PAGE_BUDGET_MS });
});

test("websocket-open", async ({ page }) => {
  // Register before navigation so the socket created during load is not missed.
  const socketCreated = page.waitForEvent("websocket", { timeout: WS_BUDGET_MS });
  await page.goto("/", { waitUntil: "load", timeout: PAGE_BUDGET_MS });
  const socket = await socketCreated;

  // A received frame is the only public signal that the socket reached `open`
  // and the relay is streaming. Staging must emit at least one frame per window.
  await socket.waitForEvent("framereceived", { timeout: WS_BUDGET_MS });
});

test("quote", async ({ request }) => {
  const started = Date.now();
  const response = await request.get(new URL(QUOTE_PATH, API_URL).toString(), {
    timeout: QUOTE_BUDGET_MS,
  });
  const elapsed = Date.now() - started;

  expect(response.status(), "quote status").toBe(200);
  expect(elapsed, "quote latency (ms)").toBeLessThanOrEqual(QUOTE_BUDGET_MS);
});
