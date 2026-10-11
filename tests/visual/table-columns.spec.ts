/**
 * Behavioural check (no screenshots) for #330 against the Ladle table stories:
 * column widths must not move while typing, and a column edge can be dragged.
 * Persistence of the dragged width (`colwidth`) is covered at document level in
 * tests/notes-table.test.ts; Ladle has no save/reload round trip.
 */
import { test, expect, type Page } from "@playwright/test";

async function columnWidths(page: Page) {
  return page.locator(".tiptap tr:first-child > *").evaluateAll((cells) =>
    cells.map((cell) => Math.round(cell.getBoundingClientRect().width * 10) / 10),
  );
}

for (const story of ["note-table--without-stored-widths", "note-table--with-column-widths"]) {
  test.describe(story, () => {
    test("typing in a cell leaves every column width unchanged", async ({ page }) => {
      await page.goto(`/?story=${story}&mode=preview`);
      const cell = page.locator(".tiptap tbody tr:nth-child(2) td").first();
      await cell.waitFor();
      const before = await columnWidths(page);
      await cell.click();
      await page.keyboard.type(" een veel langere tekst die normaal de kolom zou oprekken");
      await page.locator(".tiptap tbody tr:nth-child(3) td").nth(2).click();
      await page.keyboard.type("Nog een lange regel zonder spaties: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(await columnWidths(page)).toEqual(before);
    });
  });
}

test("a column edge can be dragged to resize", async ({ page }) => {
  await page.goto("/?story=note-table--with-column-widths&mode=preview");
  const header = page.locator(".tiptap th").first();
  await header.waitFor();
  const box = await header.boundingBox();
  if (!box) throw new Error("header cell not rendered");
  const edgeX = box.x + box.width - 1;
  const y = box.y + box.height / 2;
  const before = await columnWidths(page);

  await page.mouse.move(edgeX, y);
  await expect(page.locator(".tiptap .column-resize-handle").first()).toBeVisible();
  await page.mouse.down();
  await page.mouse.move(edgeX + 40, y, { steps: 5 });
  await page.mouse.up();

  const after = await columnWidths(page);
  expect(after[0]).toBeGreaterThan(before[0] + 30);
  expect(after[1]).toBe(before[1]);
  await expect(page.locator(".tiptap colgroup col").first()).toHaveCSS("width", `${after[0]}px`);
});
