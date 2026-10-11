/**
 * Interaction-state baselines for Button (#282). ladle.visual.spec.ts renders
 * every story at rest, so a wrong `hover:`/`active:`/`focus-visible` token
 * shipped green; this file drives the real pseudo-classes and screenshots
 * the result.
 *
 * Source: the `StateMatrix` story. Per variant row it renders three buttons
 * in DOM order (Default, Hover/Active column, Selected); the Default one is
 * used here so no `aria-pressed` styling interferes. Tab order == DOM order,
 * so Tab presses reach a given button and make `:focus-visible` match for
 * real (keyboard-modality heuristic), rather than forcing the pseudo-state.
 *
 * Crops are a clip around the button with padding, so the focus ring (drawn
 * outside the border box) is inside the baseline. Same `threshold: 0` /
 * `maxDiffPixels` policy as the main suite (playwright.config.ts).
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const stylePath = path.join(__dirname, "screenshot-override.css");

const STORY_ID = "button--state-matrix";
const PAD = 8;
// Row order of the StateMatrix story (components/atoms/Button.stories.tsx).
const VARIANTS = [
  "filled",
  "white",
  "transparent",
  "outline",
  "destructive",
] as const;
const BUTTONS_PER_ROW = 3;

async function openStateMatrix(page: Page) {
  await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
  await page.goto(`/?story=${STORY_ID}&mode=preview`);
  await page.locator("#ladle-root > div").first().waitFor({ state: "visible" });
}

async function shoot(page: Page, index: number, name: string) {
  const box = await page.getByRole("button").nth(index).boundingBox();
  if (!box) throw new Error(`button ${index} has no bounding box`);
  await expect(page).toHaveScreenshot(name, {
    stylePath,
    clip: {
      x: Math.max(0, box.x - PAD),
      y: Math.max(0, box.y - PAD),
      width: box.width + PAD * 2,
      height: box.height + PAD * 2,
    },
  });
}

test.describe("Button state baselines", () => {
  VARIANTS.forEach((variant, row) => {
    const index = row * BUTTONS_PER_ROW;

    test(`${variant} hover`, async ({ page }) => {
      await openStateMatrix(page);
      await page.getByRole("button").nth(index).hover();
      await shoot(page, index, `button-${variant}-hover.png`);
    });

    test(`${variant} active`, async ({ page }) => {
      await openStateMatrix(page);
      await page.getByRole("button").nth(index).hover();
      await page.mouse.down();
      try {
        await shoot(page, index, `button-${variant}-active.png`);
      } finally {
        await page.mouse.up();
      }
    });

    test(`${variant} focus-visible`, async ({ page }) => {
      await openStateMatrix(page);
      for (let i = 0; i <= index; i++) await page.keyboard.press("Tab");
      await expect(page.getByRole("button").nth(index)).toBeFocused();
      // Park the pointer away so no hover state leaks into the focus crop.
      await page.mouse.move(0, 0);
      await shoot(page, index, `button-${variant}-focus-visible.png`);
    });
  });
});
