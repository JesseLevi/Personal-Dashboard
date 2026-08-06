import { describe, expect, it } from "vitest";
import { resultDisplayName } from "../components/organisms/IngredientSearchPanel";
import type { IngredientRow, IngredientSearchResult, ReferenceIngredientRow } from "../lib/recipes/types";

// #161 (ADR-0013 §6): reference.ingredients is now bilingual (name_nl/name_en),
// and the picker must follow the active locale rather than always reading
// name_nl. Covers the fallback rule (empty/missing English name -> name_nl)
// and the "own" branch, which must NEVER localise a user's own free text.

function makeReference(overrides: Partial<ReferenceIngredientRow>): ReferenceIngredientRow {
  return {
    id: "ref-1",
    name_nl: "Appel",
    name_en: "Apple",
    category_nl: null,
    category_en: null,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    carbs_g_per_100g: null,
    fat_g_per_100g: null,
    fiber_g_per_100g: null,
    nutrient_basis: "per_100g",
    source: "hand-curated",
    source_ref: null,
    source_version: "2026-07-30",
    ...overrides,
  };
}

function makeOwn(overrides: Partial<IngredientRow>): IngredientRow {
  return {
    id: "own-1",
    user_id: "user-1",
    reference_id: null,
    name: "Kipfilet",
    category: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resultDisplayName", () => {
  it("reads name_nl for a reference row under locale nl", () => {
    const result: IngredientSearchResult = { source: "reference", ingredient: makeReference({}) };
    expect(resultDisplayName(result, "nl")).toBe("Appel");
  });

  it("reads name_en for a reference row under locale en when name_en is present", () => {
    const result: IngredientSearchResult = { source: "reference", ingredient: makeReference({}) };
    expect(resultDisplayName(result, "en")).toBe("Apple");
  });

  it("falls back to name_nl under locale en when name_en is null", () => {
    const result: IngredientSearchResult = {
      source: "reference",
      ingredient: makeReference({ name_en: null }),
    };
    expect(resultDisplayName(result, "en")).toBe("Appel");
  });

  it("falls back to name_nl under locale en when name_en is an empty string", () => {
    const result: IngredientSearchResult = {
      source: "reference",
      ingredient: makeReference({ name_en: "" }),
    };
    expect(resultDisplayName(result, "en")).toBe("Appel");
  });

  it("never localises an own row -- always the user's own free-text name, any locale", () => {
    const result: IngredientSearchResult = { source: "own", ingredient: makeOwn({ name: "Kipfilet" }) };
    expect(resultDisplayName(result, "nl")).toBe("Kipfilet");
    expect(resultDisplayName(result, "en")).toBe("Kipfilet");
  });
});
