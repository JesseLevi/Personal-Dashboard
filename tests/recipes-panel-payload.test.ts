import { describe, expect, it } from "vitest";
import {
  buildContentsPayload,
  keepsNeedsReview,
  moveRow,
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

describe("step order and removal through the save payload", () => {
  const named = (id: string, instruction: string): StepRowState => ({ localId: id, instruction, ingredientLocalIds: [] });

  it("moveRow swaps neighbours without mutating the input", () => {
    const rows = ["a", "b", "c"];
    expect(moveRow(rows, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveRow(rows, 1, 1)).toEqual(["a", "c", "b"]);
    expect(rows).toEqual(["a", "b", "c"]);
  });

  it("moveRow leaves the list alone at the ends and for a bad index", () => {
    expect(moveRow(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveRow(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveRow(["a", "b"], 5, -1)).toEqual(["a", "b"]);
  });

  it("the payload keeps the panel's step order (the server numbers positions from it)", () => {
    const steps = [named("1", "Eerst"), named("2", "Dan"), named("3", "Laatste")];
    const { steps: payload } = buildContentsPayload([row("a")], moveRow(steps, 2, -1));
    expect(payload.map((s) => s.instruction)).toEqual(["Eerst", "Laatste", "Dan"]);
  });

  it("a removed step is absent and its ingredient links go with it", () => {
    const withLink: StepRowState = { localId: "2", instruction: "Dan", ingredientLocalIds: ["a"] };
    const steps = [named("1", "Eerst"), withLink, named("3", "Laatste")];
    const { steps: payload } = buildContentsPayload([row("a")], steps.filter((s) => s.localId !== "2"));
    expect(payload.map((s) => s.instruction)).toEqual(["Eerst", "Laatste"]);
    expect(payload.every((s) => s.ingredientRefs.length === 0)).toBe(true);
  });

  it("a step keeps its ingredient links when it moves", () => {
    const linked: StepRowState = { localId: "1", instruction: "Eerst", ingredientLocalIds: ["b"] };
    const { steps: payload } = buildContentsPayload([row("a"), row("b")], moveRow([linked, named("2", "Dan")], 0, 1));
    expect(payload[1]).toMatchObject({ instruction: "Eerst", ingredientRefs: [1] });
  });
});
