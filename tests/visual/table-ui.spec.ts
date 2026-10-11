/**
 * Behavioural checks (no screenshots) for the #330 table controls in Ladle:
 * the size picker by mouse and keyboard, the table menu, and focus returning to
 * the document.
 */
import { test, expect } from "@playwright/test";

const tableToggle = "[aria-haspopup=dialog]";

test("size picker inserts the chosen size by keyboard and returns focus to the editor", async ({ page }) => {
  await page.goto("/?story=editing-bar--at-rest&mode=preview");
  await page.locator(".tiptap").click();
  // The slim bar puts the panel under the click point; a stale pointer there would hover-select a cell.
  await page.mouse.move(0, 0);
  await page.locator(tableToggle).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid")).toBeVisible();
  // Default 3 x 3; two columns right, one row down -> 4 x 5.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toHaveText("4 × 5");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tiptap tr")).toHaveCount(4);
  await expect(page.locator(".tiptap tr").first().locator("th")).toHaveCount(5);
  await expect(page.locator(".tiptap")).toBeFocused();
});

test("size picker: Escape closes without inserting, mouse click inserts the largest size", async ({ page }) => {
  await page.goto("/?story=editing-bar--at-rest&mode=preview");
  await page.locator(".tiptap").click();
  await page.locator(tableToggle).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect(page.locator(".tiptap table")).toHaveCount(0);
  await expect(page.locator(".tiptap")).toBeFocused();

  await page.locator(tableToggle).click();
  await page.getByRole("gridcell", { name: "8 × 8" }).click();
  await expect(page.locator(".tiptap tr")).toHaveCount(8);
  await expect(page.locator(".tiptap tr").first().locator("th")).toHaveCount(8);
});

test("table menu adds a row, disables merge, and returns focus to the editor", async ({ page }) => {
  await page.goto("/?story=table-menu--trigger-visible&mode=preview");
  const trigger = page.getByRole("button", { name: "Tabel" });
  await trigger.waitFor();
  const rowsBefore = await page.locator(".tiptap tr").count();
  await page.locator(".tiptap td").first().click();
  await page.keyboard.press("Alt+F10");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Cellen samenvoegen" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("ArrowDown");
  await page.getByRole("menuitem", { name: "Rij eronder invoegen" }).click();
  await expect(page.locator(".tiptap tr")).toHaveCount(rowsBefore + 1);
  await expect(page.locator(".tiptap")).toBeFocused();
});
