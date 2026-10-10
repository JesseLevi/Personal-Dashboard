/**
 * Dark-mode screenshot baselines for a SUBSET of stories (issue #281).
 *
 * ladle.visual.spec.ts only renders light mode, so the `[data-theme="dark"]`
 * overrides in app/theme.css (stroke-primary, overlay, stroke-lines, the
 * surface/text ramps, ...) were invisible to every gate. Every story resolves
 * some dark-overridden token, so doubling all ~115 baselines buys little; this
 * covers the stories that exercise the dark overrides most directly: every
 * component that reads `stroke-primary`, `stroke-lines`, `overlay` or
 * `stroke-secondary-active`, plus the surface/text ramps via Tag, Step, Card
 * and PortionStepper. Static, non-animated story variants only (less flake).
 *
 * Dark is applied exactly like the app and Ladle's own toggle do: a
 * `data-theme="dark"` attribute on <html> (next-themes `attribute="data-theme"`
 * in app/layout.tsx). Ladle reads `?theme=dark` from the URL and sets it; the
 * test asserts the attribute so a Ladle change fails loudly instead of
 * silently screenshotting light mode into a `-dark` baseline.
 *
 * Baselines: `<story>-dark-<platform>.png`, macOS only (darwin), same as the
 * light suite until #188 generates Linux ones. Count and runtime are recorded
 * in docs/guides/ui-components.md.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { loadStoryIds } from "./story-ids";

const stylePath = path.join(__dirname, "screenshot-override.css");

const DARK_STORIES = [
  "button--state-matrix",
  "button--with-and-without-icon",
  "button-toggle--with-title",
  "card--all-content-types",
  "card--with-settings",
  "card-container--default",
  "card-content-ingredient--all-variants",
  "checkbox--states",
  "dropdown--closed",
  "dropdown--open",
  "editing-bar--at-rest",
  "editing-bar--with-active-button",
  "editing-bar--block-type-menu-open",
  "editing-bar--list-menu-open",
  "editing-bar--overflow-open",
  "editing-bar--mobile-in-table",
  "note-editor-content--prose",
  "note-table--with-column-widths",
  "note-code-block--highlighted",
  "note-details--collapsed-and-open",
  "table-menu--menu-open",
  "link-popover--existing-link",
  "link-popover--editing-link",
  "note-bubble-menu--selection-menu",
  "table-size-picker--open",
  "image-upload-field--empty",
  "image-upload-field--file-selected",
  "ingredient-admin--koppelingen",
  "ingredient-admin--own-ingredient-panel-edit",
  "input-field--states",
  "input-field--icon-combinations",
  "login-form--step1-email",
  "page-header--recepten",
  "portion-stepper--representative-values",
  "side-panel--add-item",
  "sidebar--variants",
  "step--sequence",
  "step-ingredient-panel--with-selection",
  "tag--all-variants",
];

const storyIds = new Set(loadStoryIds());

test.describe("Ladle story dark-mode visual baselines", () => {
  // A renamed/removed story must fail here, not silently shrink the subset.
  test("every dark-subset story still exists", () => {
    expect(DARK_STORIES.filter((id) => !storyIds.has(id))).toEqual([]);
  });

  for (const storyId of DARK_STORIES) {
    test(`${storyId} (dark)`, async ({ page }) => {
      // Same clock freeze as the light suite (LoginForm greeting, #158).
      await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
      await page.goto(`/?story=${storyId}&mode=preview&theme=dark`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

      const root = page.locator("#ladle-root > div").first();
      await root.waitFor({ state: "visible" });

      await expect(root).toHaveScreenshot(`${storyId}-dark.png`, { stylePath });
    });
  }
});
