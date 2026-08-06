import { describe, expect, it } from "vitest";
import {
  buildInsertStatement,
  escapeSqlString,
  mapCsvRowToMappedPortion,
  mapMaatToUnit,
  parseHoeveelheidGrams,
  resolveUnitMasses,
  unitMassSeedToSqlTuple,
  type MappedPortionRow,
  type PortionCsvRow,
} from "../scripts/import-nevo-portions";

// Unit tests for #163's NEVO Portie-online import script (ADR-0013
// amendment). Covers the rules the issue body calls out by name -- tier
// precedence, conflict-skip, ml exclusion, opgehoopt/multi-count
// exclusion, and the "bak bioscoop" exact-match trap -- against fixture
// rows, never the real CSVs (26 files, git-ignored, see .gitignore).

function fixtureRow(overrides: Partial<PortionCsvRow> = {}): PortionCsvRow {
  return {
    Productnaam: "Aardbeien",
    "NEVO-code": "148",
    "NEVO-naam": "Aardbeien",
    Maat: "eetlepel",
    Hoeveelheid: "15",
    Eenheid: "gram",
    "Maat-Toelichting": "",
    ...overrides,
  };
}

function mappedRow(overrides: Partial<MappedPortionRow> = {}): MappedPortionRow {
  return {
    nevoCode: "148",
    unit: "eetlepel",
    tier: 1,
    grams: 15,
    ...overrides,
  };
}

describe("mapMaatToUnit", () => {
  it("maps the tier-1 measures exactly", () => {
    expect(mapMaatToUnit("eetlepel")).toEqual({ unit: "eetlepel", tier: 1 });
    expect(mapMaatToUnit("theelepel")).toEqual({ unit: "theelepel", tier: 1 });
    expect(mapMaatToUnit("stuks")).toEqual({ unit: "stuk", tier: 1 });
    expect(mapMaatToUnit("stuk")).toEqual({ unit: "stuk", tier: 1 });
  });

  it("maps the tier-2/tier-3 variants", () => {
    expect(mapMaatToUnit("eetlepel afgestreken")).toEqual({ unit: "eetlepel", tier: 2 });
    expect(mapMaatToUnit("afgestreken eetlepel")).toEqual({ unit: "eetlepel", tier: 2 });
    expect(mapMaatToUnit("eetlepel (afgestreken)")).toEqual({ unit: "eetlepel", tier: 2 });
    expect(mapMaatToUnit("eetlepel (geraspt)")).toEqual({ unit: "eetlepel", tier: 3 });
    expect(mapMaatToUnit("theelepel afgestreken")).toEqual({ unit: "theelepel", tier: 2 });
    expect(mapMaatToUnit("theelepel (afgestreken)")).toEqual({ unit: "theelepel", tier: 2 });
    expect(mapMaatToUnit("stuks gemiddeld")).toEqual({ unit: "stuk", tier: 2 });
    expect(mapMaatToUnit("stuks middel")).toEqual({ unit: "stuk", tier: 2 });
  });

  it("uses exact string matching -- 'bak bioscoop klein' never maps to the 'scoop' unit", () => {
    // "scoop" is a public.recipe_unit value; a substring/LIKE match on
    // "%scoop%" would incorrectly match a cinema popcorn tub measure. There
    // is no "scoop" mapping at all -- this must return null, not a scoop.
    expect(mapMaatToUnit("bak bioscoop klein")).toBeNull();
    expect(mapMaatToUnit("bak bioscoop middel")).toBeNull();
    expect(mapMaatToUnit("bak bioscoop groot")).toBeNull();
  });

  it("excludes opgehoopt (heaped) measures", () => {
    expect(mapMaatToUnit("eetlepel opgehoopt")).toBeNull();
    expect(mapMaatToUnit("theelepel opgehoopt")).toBeNull();
    expect(mapMaatToUnit("opgehoopte eetlepel")).toBeNull();
    expect(mapMaatToUnit("eetlepel opgehoopt (geraspt)")).toBeNull();
  });

  it("excludes multi-count measures -- their Hoeveelheid covers several spoons", () => {
    expect(mapMaatToUnit("4 theelepels")).toBeNull();
    expect(mapMaatToUnit("2 theelepels")).toBeNull();
    expect(mapMaatToUnit("2 afgestreken theelepels")).toBeNull();
    expect(mapMaatToUnit("2 opgehoopte theelepels")).toBeNull();
  });

  it("excludes units with no NEVO/public.recipe_unit overlap", () => {
    expect(mapMaatToUnit("snufje")).toBeNull();
    expect(mapMaatToUnit("cup")).toBeNull();
    expect(mapMaatToUnit("stuks klein")).toBeNull();
    expect(mapMaatToUnit("stuks groot")).toBeNull();
    expect(mapMaatToUnit("stukje")).toBeNull();
  });

  it("trims surrounding whitespace but does not fold case or trim internal spacing", () => {
    expect(mapMaatToUnit("  eetlepel  ")).toEqual({ unit: "eetlepel", tier: 1 });
    expect(mapMaatToUnit("Eetlepel")).toBeNull();
  });
});

describe("parseHoeveelheidGrams", () => {
  it("parses a plain integer", () => {
    expect(parseHoeveelheidGrams("15")).toBe(15);
    expect(parseHoeveelheidGrams("238")).toBe(238);
  });

  it("throws on a non-integer value rather than coercing to 0", () => {
    expect(() => parseHoeveelheidGrams("")).toThrow();
    expect(() => parseHoeveelheidGrams("n/a")).toThrow();
    expect(() => parseHoeveelheidGrams("12,3")).toThrow();
    expect(() => parseHoeveelheidGrams("12.3")).toThrow();
  });
});

describe("mapCsvRowToMappedPortion", () => {
  it("maps a valid gram-unit row", () => {
    expect(mapCsvRowToMappedPortion(fixtureRow())).toEqual({
      nevoCode: "148",
      unit: "eetlepel",
      tier: 1,
      grams: 15,
    });
  });

  it("excludes Eenheid = 'ml' rows -- volume portions carry no mass", () => {
    expect(mapCsvRowToMappedPortion(fixtureRow({ Eenheid: "ml", Hoeveelheid: "100" }))).toBeNull();
  });

  it("excludes rows with a blank NEVO-code -- they can never resolve to an ingredient", () => {
    expect(mapCsvRowToMappedPortion(fixtureRow({ "NEVO-code": "" }))).toBeNull();
    expect(mapCsvRowToMappedPortion(fixtureRow({ "NEVO-code": "  " }))).toBeNull();
  });

  it("excludes rows whose Maat is not in the mapping table", () => {
    expect(mapCsvRowToMappedPortion(fixtureRow({ Maat: "schaaltje" }))).toBeNull();
    expect(mapCsvRowToMappedPortion(fixtureRow({ Maat: "bak bioscoop klein" }))).toBeNull();
  });
});

describe("resolveUnitMasses", () => {
  it("tier 1 beats tier 2 when both are present for the same (code, unit)", () => {
    const result = resolveUnitMasses([
      mappedRow({ tier: 1, grams: 15 }),
      mappedRow({ tier: 2, grams: 12 }),
    ]);
    expect(result).toEqual([{ nevoCode: "148", unit: "eetlepel", grams: 15 }]);
  });

  it("falls back to tier 2 when tier 1 is absent", () => {
    const result = resolveUnitMasses([mappedRow({ tier: 2, grams: 12 })]);
    expect(result).toEqual([{ nevoCode: "148", unit: "eetlepel", grams: 12 }]);
  });

  it("falls back to tier 3 when tiers 1 and 2 are both absent", () => {
    const result = resolveUnitMasses([mappedRow({ tier: 3, grams: 9 })]);
    expect(result).toEqual([{ nevoCode: "148", unit: "eetlepel", grams: 9 }]);
  });

  it("skips a conflict (several rows at the winning tier with differing grams) rather than averaging", () => {
    const result = resolveUnitMasses([
      mappedRow({ nevoCode: "999", tier: 1, grams: 15 }),
      mappedRow({ nevoCode: "999", tier: 1, grams: 20 }),
    ]);
    expect(result).toEqual([]);
  });

  it("does not treat equal grams at the same tier as a conflict", () => {
    const result = resolveUnitMasses([
      mappedRow({ nevoCode: "999", tier: 1, grams: 15 }),
      mappedRow({ nevoCode: "999", tier: 1, grams: 15 }),
    ]);
    expect(result).toEqual([{ nevoCode: "999", unit: "eetlepel", grams: 15 }]);
  });

  it("a tier-1 conflict is not rescued by a clean tier-2 value -- the conflict wins at its own tier", () => {
    const result = resolveUnitMasses([
      mappedRow({ nevoCode: "999", tier: 1, grams: 15 }),
      mappedRow({ nevoCode: "999", tier: 1, grams: 20 }),
      mappedRow({ nevoCode: "999", tier: 2, grams: 12 }),
    ]);
    expect(result).toEqual([]);
  });

  it("keeps (code, unit) groups independent -- a conflict in one unit doesn't affect another", () => {
    const result = resolveUnitMasses([
      mappedRow({ nevoCode: "999", unit: "eetlepel", tier: 1, grams: 15 }),
      mappedRow({ nevoCode: "999", unit: "eetlepel", tier: 1, grams: 20 }),
      mappedRow({ nevoCode: "999", unit: "theelepel", tier: 1, grams: 5 }),
    ]);
    expect(result).toEqual([{ nevoCode: "999", unit: "theelepel", grams: 5 }]);
  });

  it("orders output by numeric NEVO-code then unit, independent of input order", () => {
    const result = resolveUnitMasses([
      mappedRow({ nevoCode: "20", unit: "theelepel", tier: 1, grams: 3 }),
      mappedRow({ nevoCode: "20", unit: "eetlepel", tier: 1, grams: 15 }),
      mappedRow({ nevoCode: "3", unit: "stuk", tier: 1, grams: 25 }),
    ]);
    expect(result).toEqual([
      { nevoCode: "3", unit: "stuk", grams: 25 },
      { nevoCode: "20", unit: "eetlepel", grams: 15 },
      { nevoCode: "20", unit: "theelepel", grams: 3 },
    ]);
  });
});

describe("escapeSqlString", () => {
  it("doubles a single quote", () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });
});

describe("unitMassSeedToSqlTuple", () => {
  it("emits a (source_ref, unit, grams) tuple", () => {
    expect(unitMassSeedToSqlTuple({ nevoCode: "148", unit: "eetlepel", grams: 15 })).toBe(
      "  ('148', 'eetlepel', 15)",
    );
  });
});

describe("buildInsertStatement", () => {
  it("emits a set-based insert that resolves the FK by source_ref, not a hardcoded UUID", () => {
    const sql = buildInsertStatement([{ nevoCode: "148", unit: "eetlepel", grams: 15 }]);
    expect(sql).toContain("insert into reference.ingredient_unit_masses");
    expect(sql).toContain("('148', 'eetlepel', 15)");
    expect(sql).toContain("ri.source_ref = v.source_ref");
    expect(sql).toContain("ri.source = 'NEVO-online'");
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
