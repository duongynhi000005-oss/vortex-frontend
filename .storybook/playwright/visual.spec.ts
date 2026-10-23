import { expect, test } from "@playwright/test";

type StoryIndex = { entries: Record<string, { id: string; type: string }> };
const FIXED_NOW = Date.parse("2026-01-01T12:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.addInitScript((now) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args: [] | [string | number]) {
        super(args.length === 0 ? now : args[0]);
      }
      static now() { return now; }
    }
    window.Date = FixedDate as DateConstructor;
  }, FIXED_NOW);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname) || url.protocol === "data:") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
});

test("all Storybook stories match committed light and dark baselines", async ({ page, request }) => {
  const response = await request.get("/index.json");
  const index = await response.json() as StoryIndex;
  const stories = Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const story of stories) {
    for (const theme of ["light", "dark"] as const) {
      await page.goto(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("#storybook-root")).toHaveScreenshot(`${story.id}-${theme}.png`);
    }
  }
});
