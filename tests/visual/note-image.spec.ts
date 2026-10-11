/**
 * Behavioural checks (no screenshots) for images in the notes editor (#339):
 * the four node-view states, the keyboard path into the alt-text field, alt
 * editing and delete, and the mobile "Afbeelding" bar button.
 */
import { test, expect } from "@playwright/test";

const story = (id: string) => `/?story=${id}&mode=preview`;

test("uploading: the placeholder is announced and no image node exists yet", async ({ page }) => {
  await page.goto(story("note-image-view--uploading"));
  await expect(page.getByRole("status")).toHaveText("Afbeelding uploaden...");
  await expect(page.locator(".tiptap img")).toHaveCount(0);
});

test("broken: a missing object shows the not-available block", async ({ page }) => {
  await page.goto(story("note-image-view--broken"));
  await expect(page.getByRole("img", { name: /Afbeelding niet beschikbaar/ })).toBeVisible();
});

test("selected: edit the alt text, Enter returns to the document", async ({ page }) => {
  await page.goto(story("note-image-view--selected"));
  const field = page.getByLabel("Alternatieve tekst");
  await expect(field).toHaveValue("Een blauwe lucht boven groene heuvels");
  await field.fill("Nieuwe beschrijving");
  await field.press("Enter");
  await expect(page.locator(".tiptap")).toBeFocused();
  await expect(page.locator(".tiptap img")).toHaveAttribute("alt", "Nieuwe beschrijving");
});

test("selected: Escape discards the draft", async ({ page }) => {
  await page.goto(story("note-image-view--selected"));
  const field = page.getByLabel("Alternatieve tekst");
  await field.fill("Weggooien");
  await field.press("Escape");
  await expect(page.locator(".tiptap")).toBeFocused();
  await expect(page.locator(".tiptap img")).toHaveAttribute("alt", "Een blauwe lucht boven groene heuvels");
});

test("selected: the delete button removes the image", async ({ page }) => {
  await page.goto(story("note-image-view--selected"));
  await page.getByRole("button", { name: "Afbeelding verwijderen" }).click();
  await expect(page.locator(".tiptap img")).toHaveCount(0);
});

test("keyboard: Enter on a selected image focuses its alt-text field", async ({ page }) => {
  await page.goto(story("note-image-view--with-image"));
  await expect(page.getByLabel("Alternatieve tekst")).toHaveCount(0);
  await page.locator(".tiptap img").click();
  await expect(page.getByLabel("Alternatieve tekst")).toBeVisible();
  await page.locator(".tiptap").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Alternatieve tekst")).toBeFocused();
});

test("mobile bar: the labelled Afbeelding button is on the bar; desktop shows it icon-only (#386)", async ({ page }) => {
  await page.goto(story("editing-bar--mobile"));
  await expect(page.getByRole("toolbar", { name: "Opmaakwerkbalk" }).getByRole("button", { name: "Afbeelding" })).toBeVisible();

  await page.goto(story("editing-bar--at-rest"));
  await expect(page.getByRole("toolbar", { name: "Opmaakwerkbalk" }).getByRole("button", { name: "Afbeelding" })).toBeVisible();
  await page.getByRole("button", { name: "Meer" }).click();
  await expect(page.getByRole("menuitem", { name: "Afbeelding" })).toHaveCount(0);
});
