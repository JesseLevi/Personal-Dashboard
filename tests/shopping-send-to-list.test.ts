import { describe, expect, it } from "vitest";
import { buildShoppingListLines, type SendToListIngredient } from "../lib/shopping/send-to-list";

// Architecture §9 names portion scaling a high-value test target -- this is
// the send-time heart of #178. lib/shopping/send-to-list.ts's own header
// documents the merge/null rules this file locks in.

function ingredient(overrides: Partial<SendToListIngredient>): SendToListIngredient {
  return {
    name: "Bloem",
    quantity: 100,
    unit: "gram",
    ...overrides,
  };
}

describe("buildShoppingListLines", () => {
  it("scales quantities up from the recipe's servings to the target portions", () => {
    const lines = buildShoppingListLines([ingredient({ quantity: 100 })], 4, 8);
    expect(lines).toEqual([{ name: "Bloem", quantity: 200, unit: "gram" }]);
  });

  it("scales quantities down", () => {
    const lines = buildShoppingListLines([ingredient({ quantity: 100 })], 4, 2);
    expect(lines).toEqual([{ name: "Bloem", quantity: 50, unit: "gram" }]);
  });

  it("produces a fractional, rounded result", () => {
    const lines = buildShoppingListLines([ingredient({ name: "Ei", quantity: 1, unit: "stuk" })], 3, 1);
    expect(lines).toEqual([{ name: "Ei", quantity: 0.33, unit: "stuk" }]);
  });

  it("keeps a null quantity null, never 0, when it doesn't merge with anything", () => {
    const lines = buildShoppingListLines(
      [ingredient({ name: "Zout", quantity: null, unit: "naar_smaak" })],
      4,
      8,
    );
    expect(lines).toEqual([{ name: "Zout", quantity: null, unit: "naar_smaak" }]);
  });

  it("merges rows with the same name and same unit, summing quantities", () => {
    const lines = buildShoppingListLines(
      [ingredient({ name: "Bloem", quantity: 100, unit: "gram" }), ingredient({ name: "Bloem", quantity: 50, unit: "gram" })],
      1,
      1,
    );
    expect(lines).toEqual([{ name: "Bloem", quantity: 150, unit: "gram" }]);
  });

  it("merges names case-insensitively and keeps the first-seen row's original casing", () => {
    const lines = buildShoppingListLines(
      [ingredient({ name: "Bloem", quantity: 100 }), ingredient({ name: "bloem", quantity: 50 })],
      1,
      1,
    );
    expect(lines).toEqual([{ name: "Bloem", quantity: 150, unit: "gram" }]);
  });

  it("keeps the numeric side when merging a null quantity with a known one", () => {
    const lines = buildShoppingListLines(
      [
        ingredient({ name: "Zout", quantity: null, unit: "snufje" }),
        ingredient({ name: "Zout", quantity: 2, unit: "snufje" }),
      ],
      1,
      1,
    );
    expect(lines).toEqual([{ name: "Zout", quantity: 2, unit: "snufje" }]);
  });

  it("stays null when merging two null quantities of the same name+unit", () => {
    const lines = buildShoppingListLines(
      [
        ingredient({ name: "Peper", quantity: null, unit: "naar_smaak" }),
        ingredient({ name: "Peper", quantity: null, unit: "naar_smaak" }),
      ],
      1,
      1,
    );
    expect(lines).toEqual([{ name: "Peper", quantity: null, unit: "naar_smaak" }]);
  });

  it("does NOT merge the same name across different units", () => {
    const lines = buildShoppingListLines(
      [
        ingredient({ name: "Bloem", quantity: 1, unit: "cup" }),
        ingredient({ name: "Bloem", quantity: 200, unit: "gram" }),
      ],
      1,
      1,
    );
    expect(lines).toEqual([
      { name: "Bloem", quantity: 1, unit: "cup" },
      { name: "Bloem", quantity: 200, unit: "gram" },
    ]);
  });

  it("returns an empty array for an empty ingredient list", () => {
    expect(buildShoppingListLines([], 4, 8)).toEqual([]);
  });

  it("preserves first-seen order across non-merging lines", () => {
    const lines = buildShoppingListLines(
      [
        ingredient({ name: "Melk", quantity: 200, unit: "milliliter" }),
        ingredient({ name: "Bloem", quantity: 100, unit: "gram" }),
        ingredient({ name: "Melk", quantity: 100, unit: "milliliter" }),
      ],
      1,
      1,
    );
    expect(lines.map((line) => line.name)).toEqual(["Melk", "Bloem"]);
    expect(lines[0].quantity).toBe(300);
  });
});
