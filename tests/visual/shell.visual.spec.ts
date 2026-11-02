/**
 * The Agenda page inside the real shell's dimensions (#732): the day cards must
 * keep their column left of the planner at laptop widths. Fixed viewports,
 * because the planner's width follows the viewport.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

const stylePath = path.join(__dirname, "screenshot-override.css");
const STORY = "agenda--agenda-page-layout--in-shell";

for (const width of [1440, 1280, 1024]) {
  test(`${STORY} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
    await page.goto(`/?story=${STORY}&mode=preview`);
    const root = page.locator("#ladle-root > div").first();
    await root.waitFor({ state: "visible" });
    await expect(root).toHaveScreenshot(`${STORY}-${width}.png`, { stylePath });
  });
}

/**
 * The Agenda's pull-up sheet below `lg` (#733): fixed to the viewport, so the stories are shot at phone
 * sizes, in light and dark. 320x568 is the smallest phone: at least the timeline card must show.
 */
const SHEET_STORIES = [
  "mobile-peek",
  "mobile-peek-few-cards",
  "mobile-peek-empty-day",
  "mobile-peek-many-cards",
  "mobile-full",
  "mobile-other-day",
  "mobile-title-menu",
  "mobile-date-picker",
];

for (const name of SHEET_STORIES) {
  for (const theme of ["light", "dark"]) {
    test(`agenda sheet ${name} ${theme} at 390x844`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
      await page.goto(`/?story=agenda--agenda-page-layout--${name}&mode=preview${theme === "dark" ? "&theme=dark" : ""}`);
      const root = page.locator("#ladle-root > div").first();
      await root.waitFor({ state: "visible" });
      await expect(root).toHaveScreenshot(`agenda-sheet-${name}-${theme}-390.png`, { stylePath });
    });
  }
}

test("agenda sheet mobile-peek at 320x568", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
  await page.goto("/?story=agenda--agenda-page-layout--mobile-peek&mode=preview");
  const root = page.locator("#ladle-root > div").first();
  await root.waitFor({ state: "visible" });
  await expect(root).toHaveScreenshot("agenda-sheet-mobile-peek-320.png", { stylePath });
});
