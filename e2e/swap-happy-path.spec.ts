import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api";
import { mockFreighter } from "./fixtures/wallet";

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
