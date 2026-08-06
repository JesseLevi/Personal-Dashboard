import { describe, expect, it } from "vitest";
import {
  escapeSqlString,
  ingredientSeedToSqlRow,
  mapNevoRowToIngredientSeed,
  mapNutrientBasis,
  parseNevoDecimal,
  parseNullableNevoDecimal,
  type NevoCsvRow,
} from "../scripts/import-nevo";

// Unit tests for #161's NEVO import script (ADR-0013 §5). Covers the four
// parsing rules the ADR calls out by name -- comma-decimal, empty-fibre,
// per_100g/per_100ml basis mapping, apostrophe escaping -- against fixture
// rows, never the real 1.7 MB CSV (which isn't committed, see .gitignore).

// A representative fixture row, shaped exactly like a parsed NevoCsvRow.
// Only the columns import-nevo.ts actually reads are populated; other real
// NEVO columns are omitted since NevoCsvRow's index signature allows it.
function fixtureRow(overrides: Partial<NevoCsvRow> = {}): NevoCsvRow {
  return {
    "NEVO-code": "123",
    "Voedingsmiddelnaam/Dutch food name": "Appel rauw",
    "Engelse naam/Food name": "Apple raw",
    "Voedingsmiddelgroep": "Vruchten",
    "Food group": "Fruits",
    "Hoeveelheid/Quantity": "per 100g",
    "ENERCC (kcal)": "52",
    "PROT (g)": "0,3",
    "CHO (g)": "11,8",
    "FAT (g)": "0,2",
    "FIBT (g)": "1,8",
    ...overrides,
  };
}

describe("parseNevoDecimal", () => {
  it("parses a comma decimal separator correctly", () => {
    expect(parseNevoDecimal("1,8")).toBe(1.8);
    expect(parseNevoDecimal("12,3")).toBe(12.3);
  });

  it("does not silently truncate the way a naive parseFloat would", () => {
    // parseFloat("1,8") would read 1 -- this must not.
    expect(parseNevoDecimal("1,8")).not.toBe(1);
  });

  it("parses a whole number with no comma", () => {
    expect(parseNevoDecimal("88")).toBe(88);
  });

  it("throws on an empty or non-numeric value", () => {
    expect(() => parseNevoDecimal("")).toThrow();
    expect(() => parseNevoDecimal("n/a")).toThrow();
  });
});

describe("parseNullableNevoDecimal", () => {
  it("returns null for an empty field, never 0 (ADR-0011 §4)", () => {
    expect(parseNullableNevoDecimal("")).toBeNull();
    expect(parseNullableNevoDecimal("   ")).toBeNull();
  });

  it("parses a populated comma-decimal field", () => {
    expect(parseNullableNevoDecimal("1,8")).toBe(1.8);
  });
});

describe("mapNutrientBasis", () => {
  it("maps 'per 100g' to 'per_100g'", () => {
    expect(mapNutrientBasis("per 100g")).toBe("per_100g");
  });

  it("maps 'per 100ml' to 'per_100ml'", () => {
    expect(mapNutrientBasis("per 100ml")).toBe("per_100ml");
  });

  it("throws on any unexpected third value rather than defaulting", () => {
    expect(() => mapNutrientBasis("per 100 g")).toThrow();
    expect(() => mapNutrientBasis("per liter")).toThrow();
    expect(() => mapNutrientBasis("")).toThrow();
  });
});

describe("escapeSqlString", () => {
  it("doubles a single quote", () => {
    expect(escapeSqlString("Gamba's")).toBe("Gamba''s");
  });

  it("handles multiple quotes in one string", () => {
    expect(escapeSqlString("Kellogg's Cornflakes' box")).toBe("Kellogg''s Cornflakes'' box");
  });

  it("leaves a string with no quotes untouched", () => {
    expect(escapeSqlString("Appel rauw")).toBe("Appel rauw");
  });
});

describe("mapNevoRowToIngredientSeed", () => {
  it("maps a fully-populated per-100g row", () => {
    expect(mapNevoRowToIngredientSeed(fixtureRow())).toEqual({
      nevoCode: "123",
      nameNl: "Appel rauw",
      nameEn: "Apple raw",
      categoryNl: "Vruchten",
      categoryEn: "Fruits",
      nutrientBasis: "per_100g",
      kcalPer100: 52,
      proteinPer100: 0.3,
      carbsPer100: 11.8,
      fatPer100: 0.2,
      fiberPer100: 1.8,
    });
  });

  it("maps empty FIBT (g) to null fiberPer100, not 0", () => {
    const seed = mapNevoRowToIngredientSeed(fixtureRow({ "FIBT (g)": "" }));
    expect(seed.fiberPer100).toBeNull();
  });

  it("maps 'per 100ml' rows to the per_100ml basis (infant formula rows)", () => {
    const seed = mapNevoRowToIngredientSeed(
      fixtureRow({
        "Voedingsmiddelnaam/Dutch food name": "Zuigelingenvoeding poeder",
        "Voedingsmiddelgroep": "Flesvoeding en preparaten",
        "Hoeveelheid/Quantity": "per 100ml",
      }),
    );
    expect(seed.nutrientBasis).toBe("per_100ml");
  });

  it("preserves an apostrophe in the Dutch name unescaped at the mapping stage (escaping happens at SQL-emit time)", () => {
    const seed = mapNevoRowToIngredientSeed(
      fixtureRow({ "Voedingsmiddelnaam/Dutch food name": "Gamba's gegrild" }),
    );
    expect(seed.nameNl).toBe("Gamba's gegrild");
  });

  it("throws on an unexpected Hoeveelheid/Quantity value rather than defaulting", () => {
    expect(() => mapNevoRowToIngredientSeed(fixtureRow({ "Hoeveelheid/Quantity": "per portie" }))).toThrow();
  });
});

describe("ingredientSeedToSqlRow", () => {
  it("escapes an apostrophe in the emitted SQL row", () => {
    const seed = mapNevoRowToIngredientSeed(
      fixtureRow({ "Voedingsmiddelnaam/Dutch food name": "Gamba's gegrild" }),
    );
    const sql = ingredientSeedToSqlRow(seed);
    expect(sql).toContain("'Gamba''s gegrild'");
  });

  it("emits null (unquoted) for a missing fibre value", () => {
    const seed = mapNevoRowToIngredientSeed(fixtureRow({ "FIBT (g)": "" }));
    const sql = ingredientSeedToSqlRow(seed);
    // fiber is the 10th value in the row -- assert the literal token appears
    // rather than pinning the whole row's exact formatting.
    expect(sql).toMatch(/,\s*null\s*,\s*'NEVO-online'/);
  });
});
