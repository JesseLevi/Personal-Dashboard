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
