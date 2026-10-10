/**
 * Behavioural checks (no baselines) for the #335 block drag handle and menu in
 * Ladle: menu actions, keyboard moves, undo, the unshifted reading column and
 * the touch gate.
 */
import { test, expect, type Page } from "@playwright/test";

const handle = "[aria-haspopup=menu]";
const blocks = (page: Page) => page.locator(".tiptap > *");
const blockTexts = (page: Page) => blocks(page).allTextContents();

test("hover shows the handle, the menu duplicates, moves and deletes, undo restores", async ({ page }) => {
  await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
  const trigger = page.locator(handle);
  await expect(trigger).toBeVisible();

  const before = await blockTexts(page);
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Blokacties" });
  await expect(menu).toBeVisible();
  // The paragraph is the current type; its row is checked and holds focus.
  await expect(menu.getByRole("menuitemradio", { name: "Tekst" })).toHaveAttribute("aria-checked", "true");
  await expect(menu.getByRole("menuitemradio", { name: "Tekst" })).toBeFocused();

  await menu.getByRole("menuitem", { name: "Omlaag verplaatsen" }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(async () => (await blockTexts(page))[1]).toBe(before[2]);
  await expect(page.locator(".tiptap")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => blockTexts(page)).toEqual(before);

  await page.locator(".tiptap > p").first().hover();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Dupliceren" }).click();
  await expect(blocks(page)).toHaveCount(before.length + 1);
  await page.keyboard.press("ControlOrMeta+z");

  await page.locator(".tiptap > p").first().hover();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Verwijderen" }).click();
  await expect.poll(() => blockTexts(page)).not.toContain(before[1]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => blockTexts(page)).toEqual(before);
});

test("Turn into converts the block; Escape closes and returns focus to the editor", async ({ page }) => {
  await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
  await page.locator(handle).click();
  await page.getByRole("menuitemradio", { name: "Kop 1" }).click();
  await expect(page.locator(".tiptap > h1")).toHaveText("Boodschappen doen en het recept voor zondag uitzoeken.");

  await page.locator(".tiptap > h1").hover();
  await page.locator(handle).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".tiptap")).toBeFocused();
});

test("Mod-Shift-Arrow moves the block without a mouse", async ({ page }) => {
  await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
  await expect(page.locator(".tiptap > ul")).toBeVisible();
  const before = await blockTexts(page);
  await page.locator(".tiptap > p").first().click();
  // ProseMirror syncs its selection from the DOM on the next tick.
  await page.waitForTimeout(150);
  await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
  await expect.poll(async () => (await blockTexts(page))[0]).toBe(before[1]);
  await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
  await expect.poll(() => blockTexts(page)).toEqual(before);
});

test("dragging the handle reorders a block and undo restores it", async ({ page }) => {
  await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
  await expect(page.locator(".tiptap > ul")).toBeVisible();
  const before = await blockTexts(page);
  const trigger = page.locator(handle);
  await expect(trigger).toBeVisible();
  const from = (await trigger.boundingBox())!;
  const heading = (await page.locator(".tiptap > h2").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + 20, heading.y + 2, { steps: 12 });
  await page.mouse.up();
  const after = await blockTexts(page);
  expect(after).toEqual([before[1], before[0], before[2], before[3]]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => blockTexts(page)).toEqual(before);
});

test("the handle floats in the gutter: the reading column does not move on hover", async ({ page }) => {
  await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
  await expect(page.locator(handle)).toBeVisible();
  await page.mouse.move(0, 0);
  const idle = await page.locator(".tiptap").boundingBox();
  await page.locator(".tiptap > p").first().hover();
  const hovered = await page.locator(".tiptap").boundingBox();
  expect(hovered).toEqual(idle);
});

test.describe("touch device", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("renders no handle", async ({ page }) => {
    await page.goto("/?story=note-block-handle--handle-visible&mode=preview");
    await page.locator(".tiptap").waitFor();
    await page.locator(".tiptap > p").first().tap();
    await expect(page.locator(handle)).toHaveCount(0);
  });
});

test("works on code blocks and details: duplicate, move, delete, undo", async ({ page }) => {
  await page.goto("/?story=note-block-handle--code-and-details&mode=preview");
  await expect(page.locator(".tiptap [data-type=details]")).toBeVisible();
  const trigger = page.locator(handle);
  const count = () => page.locator(".tiptap > *").count();
  // intro, code, details and the trailing paragraph the editor appends.
  await expect.poll(count).toBe(4);
  const start = 4;

  await page.locator(".tiptap > [data-type=details]").hover();
  await trigger.click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Dupliceren" }).click();
  await expect(page.locator(".tiptap > [data-type=details]")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap > [data-type=details]")).toHaveCount(1);

  await page.locator(".tiptap > :has(pre)").hover();
  await trigger.click();
  await expect(page.getByRole("menuitemradio", { name: "Codeblok" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitem", { name: "Omhoog verplaatsen" }).click();
  await expect(page.locator(".tiptap > *").first()).toContainText("let a = 1;");
  await page.keyboard.press("ControlOrMeta+z");

  await page.locator(".tiptap > :has(pre)").hover();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Verwijderen" }).click();
  await expect(page.locator(".tiptap > :has(pre)")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(count).toBe(start);
});
