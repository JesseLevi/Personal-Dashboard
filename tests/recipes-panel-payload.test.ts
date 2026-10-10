import { describe, expect, it } from "vitest";
import {
  buildContentsPayload,
  keepsNeedsReview,
  type IngredientRowState,
  type StepRowState,
} from "@/lib/recipes/panel-payload";

// #318 (user decision): a manual save only clears needs_review on a line the
// user changed or confirmed, never on untouched lines.

function row(id: string, over: Partial<IngredientRowState> = {}): IngredientRowState {
  const base = { name: `ing-${id}`, quantity: 100, unit: "gram" as const, ingredientId: null as string | null };
  return {
    localId: id,
    ...base,
    sourceId: `src-${id}`,
    groupLabel: null,
    needsReview: true,
    link: null,
    loaded: { ...base },
    ...over,
  };
}
const step = (ids: string[]): StepRowState => ({ localId: "s", instruction: "Doe iets", ingredientLocalIds: ids });

describe("needsReview through the RecipePanel save payload", () => {
  it("keeps the flag on untouched flagged lines and never invents one", () => {
    const { ingredients } = buildContentsPayload([row("a"), row("b", { needsReview: false })], []);
    expect(ingredients.map((line) => line.needsReview)).toEqual([true, false]);
  });

  it.each([
    ["name", { name: "anders" }],
    ["quantity", { quantity: 250 }],
    ["unit", { unit: "kilogram" as const }],
    ["ingredient link", { ingredientId: "own-1" }],
  ])("clears the flag once the user changed the %s", (_what, patch) => {
    const { ingredients } = buildContentsPayload([row("a", patch), row("b")], []);
    expect(ingredients.map((line) => line.needsReview)).toEqual([false, true]);
  });

  it("clears the flag when the user confirmed the line (picker sets needsReview false)", () => {
    expect(keepsNeedsReview(row("a", { needsReview: false, ingredientId: "own-1" }))).toBe(false);
  });

  it("a new row (no loaded snapshot) is never flagged", () => {
    expect(keepsNeedsReview(row("n", { loaded: null, sourceId: null }))).toBe(false);
  });

  it("carries group labels through, so a manual save does not erase an imported heading", () => {
    const { ingredients } = buildContentsPayload([row("a", { groupLabel: "Voor de saus" })], []);
    expect(ingredients[0]).toMatchObject({ groupLabel: "Voor de saus" });
  });

  it("step refs index the filtered ingredient list", () => {
    const rows = [row("a", { name: "" }), row("b"), row("c")];
    const { steps } = buildContentsPayload(rows, [step(["a", "c"])]);
    expect(steps[0]!.ingredientRefs).toEqual([1]);
  });
});
