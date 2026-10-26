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
  "agenda--agenda-calendars-panel--with-calendars",
  "agenda--agenda-calendars-panel--delete-confirm",
  "agenda--agenda-calendars-panel--editor-open",
  "agenda--agenda-event-panel--edit-event-other-category",
  "agenda--agenda-quick-add--event",
  "agenda--agenda-quick-add--meal",
  "agenda--agenda-quick-add--todo",
  "agenda--color-swatches--default",
  "agenda--agenda-sync-notices--default",
  "agenda--agenda-event-panel--create-event",
  "agenda--agenda-event-panel--edit-event",
  "agenda--agenda-header--desktop",
  "agenda--agenda-header--menu-open",
  "agenda--agenda-header--shortcuts-open",
  "agenda--agenda-header--date-picker-open",
  "agenda--agenda-link-search-panel--results",
  "basis--panelen--search-panel--overview",
  "basis--panelen--search-panel--smart-search-off",
  "agenda--event-link-line--several",
  "agenda--agenda-meal-panel--planned-meal",
  "agenda--agenda-meal-panel--attached-to-event",
  "agenda--plan-drawer--recipes",
  "agenda--plan-drawer--plan-menu-open",
  "agenda--plan-drawer--cards-tab",
  "agenda--plan-drawer--cards-plan-menu-open",
  "agenda--plan-choices--default",
  "basis--kaarten--card-content-ticket--overview",
  "te-doen--card-detail-panel--edit-item-planned",
  "basis--kaarten--card-content-recipe--overview",
  "agenda--agenda-page-layout--week",
  "agenda--agenda-page-layout--week-tray-open",
  "agenda--agenda-page-layout--month",
  "agenda--agenda-page-layout--loading",
  "agenda--agenda-calendar--week",
  "agenda--agenda-calendar--now",
  "agenda--agenda-calendar--every-color",
  "agenda--agenda-calendar--item-lengths",
  "agenda--agenda-calendar--month",
  "agenda--agenda-calendar--list",
  "agenda--agenda-calendar--mobile",
  "agenda--agenda-calendar--loading",
  "basis--invoer--button--state-matrix",
  "basis--invoer--button--overview",
  "basis--invoer--button-toggle--overview",
  "basis--kaarten--card--all-content-types",
  "basis--kaarten--card--overview",
  "basis--kaarten--card-container--overview",
  "recepten--shared-recipe-offer--default",
  "basis--kaarten--card-content-ingredient--overview",
  "basis--invoer--checkbox--overview",
  "basis--invoer--dropdown--overview",
  "notities--editor--editing-bar--at-rest",
  "notities--editor--editing-bar--with-active-button",
  "notities--editor--editing-bar--block-type-menu-open",
  "notities--editor--editing-bar--list-menu-open",
  "notities--editor--editing-bar--overflow-open",
  "notities--editor--editing-bar--mobile-in-table",
  "notities--editor--note-editor-content--prose",
  "notities--blokken--note-table--with-column-widths",
  "notities--blokken--note-code-block--highlighted",
  "notities--blokken--note-details--collapsed-and-open",
  "notities--blokken--table-menu--menu-open",
  "notities--editor--note-markdown-menu--menu-open",
  "notities--editor--note-block-handle--menu-open",
  "notities--rondom--note-table-of-contents--default",
  "notities--editor--link-popover--existing-link",
  "notities--editor--link-popover--editing-link",
  "notities--editor--note-bubble-menu--selection-menu",
  "notities--blokken--table-size-picker--open",
  "basis--invoer--image-upload-field--overview",
  "recepten--ingredient-admin--aliases",
  "recepten--ingredient-admin--own-ingredient-panel-edit",
  "basis--invoer--input-field--overview",
  "account--login-code-form--in-page-frame",
  "account--login-form--step1-email",
  "basis--invoer--otp-input--overview",
  "basis--panelen--page-header--overview",
  "basis--invoer--portion-stepper--overview",
  "basis--panelen--side-panel--overview",
  "basis--panelen--sidebar--overview",
  "basis--fundament--step--overview",
  "recepten--step-ingredient-panel--with-selection",
  "basis--fundament--tag--overview",
  "account--settings-panel--ai-off",
  "account--settings-panel--ai-on",
  "account--settings-panel--ai-unavailable",
];

const storyIds = new Set(loadStoryIds());

test.describe("Ladle story dark-mode visual baselines", () => {
  // A renamed/removed story must fail here, not silently shrink the subset.
  test("every dark-subset story still exists", () => {
    expect(DARK_STORIES.filter((id) => !storyIds.has(id))).toEqual([]);
  });

  for (const storyId of DARK_STORIES) {
    test(`${storyId} (dark)`, async ({ page }) => {
      // Same clock freeze as the light suite.
      await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
      await page.goto(`/?story=${storyId}&mode=preview&theme=dark`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

      const root = page.locator("#ladle-root > div").first();
      await root.waitFor({ state: "visible" });

      await expect(root).toHaveScreenshot(`${storyId}-dark.png`, { stylePath });
    });
  }
});
