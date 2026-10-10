/**
 * Behavioural checks (no screenshots) for the slim EditingBar (#333) in Ladle:
 * roving tabindex over the bar and its overflow, Escape returning focus, and
 * the mobile table-actions swap.
 */
import { test, expect } from "@playwright/test";

const toolbar = (page: import("@playwright/test").Page) => page.getByRole("toolbar", { name: "Opmaakwerkbalk" });

test("arrow keys, Home and End rove over the bar; the overflow is part of the ring", async ({ page }) => {
  await page.goto("/?story=editing-bar--at-rest&mode=preview");
  const buttons = toolbar(page).locator("[data-toolbar-item]");
  await expect(buttons).toHaveCount(9);
  await buttons.first().focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Meer" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Meer" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(buttons.first()).toBeFocused();
});

test("overflow opens by keyboard, toggles a mark, and Escape returns focus to the editor", async ({ page }) => {
  await page.goto("/?story=editing-bar--at-rest&mode=preview");
  await page.locator(".tiptap").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Meer" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Meer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".tiptap")).toBeFocused();

  await page.getByRole("button", { name: "Meer" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Onderstrepen" }).click();
  await expect(page.locator(".tiptap u")).toHaveCount(1);
  await expect(page.locator(".tiptap")).toBeFocused();
});

test("mobile: the bar shows table actions inside a table, goes back, and restores outside it", async ({ page }) => {
  await page.goto("/?story=editing-bar--mobile-in-table&mode=preview");
  await expect(page.getByRole("toolbar", { name: "Tabelwerkbalk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rij eronder invoegen" })).toBeVisible();

  await page.getByRole("button", { name: "Terug naar opmaak" }).click();
  await expect(toolbar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tabelacties" })).toBeVisible();
  await page.getByRole("button", { name: "Tabelacties" }).click();
  await expect(page.getByRole("toolbar", { name: "Tabelwerkbalk" })).toBeVisible();

  await page.locator(".tiptap > p").first().click();
  await expect(toolbar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tabel invoegen" })).toBeVisible();
});

test("mobile: a table action edits the table", async ({ page }) => {
  await page.goto("/?story=editing-bar--mobile-in-table&mode=preview");
  await expect(page.getByRole("button", { name: "Rij eronder invoegen" })).toBeVisible();
  const rows = await page.locator(".tiptap tr").count();
  await page.getByRole("button", { name: "Rij eronder invoegen" }).click();
  await expect(page.locator(".tiptap tr")).toHaveCount(rows + 1);
});
