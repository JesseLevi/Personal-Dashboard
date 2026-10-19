import { describe, expect, it } from "vitest";
import {
  NEVO_ALIASES,
  SPICES,
  buildAliasRows,
  buildAliasesInsert,
  buildIngredientRows,
  buildIngredientsInsert,
  buildSpoonMassRows,
  buildUnitMassesInsert,
  readNutrients,
} from "../scripts/import-usda-spices";
import { readFoodDescriptions, readFoodPortions, type FoodTables } from "../scripts/import-usda-unit-masses";
import { normalizeIngredientName } from "../lib/recipes/import/normalize-name";

// Pure-logic tests for scripts/import-usda-spices.ts (#521). Synthetic CSV
// text stands in for the git-ignored SR Legacy files, so CI needs no data.

const turmeric = SPICES.find((s) => s.usdaFdcId === "172231")!;

const FOOD_CSV = [
  '"fdc_id","data_type","description","food_category_id","publication_date"',
  '"172231","sr_legacy_food","Spices, turmeric, ground","2","2019-04-01"',
].join("\n");
const PORTION_CSV = [
  '"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"',
  '"90123","172231","1","1","9999","","tsp","3"',
  '"90124","172231","2","1","9999","","tbsp","9.4"',
].join("\n");
const NUTRIENT_CSV = [
  '"id","fdc_id","nutrient_id","amount","data_points"',
  '"1","172231","1008","312","1"',
  '"2","172231","1003","9.68","1"',
  '"3","172231","1004","3.25","1"',
  '"4","172231","1005","67.14","1"',
  '"5","172231","1087","183","1"',
].join("\n");

function tables(): FoodTables {
  return { descriptions: readFoodDescriptions(FOOD_CSV), portions: readFoodPortions(PORTION_CSV) };
}

describe("SPICES structural invariants", () => {
  it("has no duplicate fdc_id or name_nl", () => {
    const ids = SPICES.map((s) => s.usdaFdcId);
    const names = SPICES.map((s) => s.nameNl);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("never reuses a portion id", () => {
    const ids = SPICES.flatMap((s) => Object.values(s.units).map((u) => u!.portionId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("pairs theelepel with a tsp label and eetlepel with a tbsp label", () => {
    for (const spice of SPICES) {
      if (spice.units.theelepel) expect(spice.units.theelepel.label).toMatch(/^tsp\b/);
      if (spice.units.eetlepel) expect(spice.units.eetlepel.label).toMatch(/^tbsp\b/);
    }
  });
});

describe("readNutrients", () => {
  it("reads the five nutrients and ignores others", () => {
    const result = readNutrients(NUTRIENT_CSV, new Set(["172231"])).get("172231");
    expect(result).toEqual({ kcal: "312", protein: "9.68", carbs: "67.14", fat: "3.25", fibre: null });
  });

  it("leaves a nutrient with no row as null, never 0", () => {
    const result = readNutrients(NUTRIENT_CSV, new Set(["172231", "999"]));
    expect(result.get("172231")!.fibre).toBeNull();
    expect(result.get("999")).toEqual({ kcal: null, protein: null, carbs: null, fat: null, fibre: null });
  });

  it("keeps a genuine 0 as 0", () => {
    const csv = '"id","fdc_id","nutrient_id","amount"\n"1","5","1004","0"';
    expect(readNutrients(csv, new Set(["5"])).get("5")!.fat).toBe("0");
  });

  it("throws on a non-numeric amount", () => {
    const csv = '"id","fdc_id","nutrient_id","amount"\n"1","5","1004","abc"';
    expect(() => readNutrients(csv, new Set(["5"]))).toThrow(/non-numeric/);
  });
});

describe("buildIngredientRows / buildSpoonMassRows", () => {
  const nutrients = readNutrients(NUTRIENT_CSV, new Set(["172231"]));

  it("builds a row when the description matches", () => {
    const [row] = buildIngredientRows(tables(), nutrients, [turmeric]);
    expect(row).toMatchObject({ nameNl: "Kurkuma gemalen", fdcId: "172231" });
  });

  it("throws when the description drifts", () => {
    const drifted = { ...turmeric, usdaDescription: "Spices, turmeric" };
    expect(() => buildIngredientRows(tables(), nutrients, [drifted])).toThrow(/description/);
  });

  it("reads spoon masses from the referenced portion rows", () => {
    expect(buildSpoonMassRows(tables(), [turmeric])).toEqual([
      { fdcId: "172231", unit: "theelepel", grams: 3 },
      { fdcId: "172231", unit: "eetlepel", grams: 9.4 },
    ]);
  });

  it("throws when a portion label drifts", () => {
    const drifted = { ...turmeric, units: { theelepel: { portionId: "90123", label: "tsp, ground" } } };
    expect(() => buildSpoonMassRows(tables(), [drifted])).toThrow(/label/);
  });

  it("throws when a portion row is missing", () => {
    const missing = { ...turmeric, units: { theelepel: { portionId: "1", label: "tsp" } } };
    expect(() => buildSpoonMassRows(tables(), [missing])).toThrow(/no food_portion/);
  });
});

describe("buildAliasRows", () => {
  const { rows, dropped } = buildAliasRows(SPICES, NEVO_ALIASES);
  const keyToRef = new Map(rows.map((r) => [r.aliasNormalized, `${r.source}:${r.sourceRef}`]));

  it("normalises every key with the app's own function and has no duplicates", () => {
    for (const row of rows) expect(normalizeIngredientName(row.aliasNormalized)).toBe(row.aliasNormalized);
    expect(new Set(rows.map((r) => r.aliasNormalized)).size).toBe(rows.length);
  });

  it("maps the ticket's aliases to the expected rows", () => {
    expect(keyToRef.get("kurkuma")).toBe("USDA-SR-Legacy:172231");
    expect(keyToRef.get("geelwortel")).toBe("USDA-SR-Legacy:172231");
    expect(keyToRef.get("fenegriek")).toBe("USDA-SR-Legacy:171324");
    expect(keyToRef.get("korianderzaad")).toBe("USDA-SR-Legacy:170922");
    expect(keyToRef.get("gemberpoeder")).toBe("USDA-SR-Legacy:170926");
    expect(keyToRef.get("laurier")).toBe("USDA-SR-Legacy:170917");
    expect(keyToRef.get("piment")).toBe("USDA-SR-Legacy:171315");
    expect(keyToRef.get("tijm")).toBe("USDA-SR-Legacy:170938");
    expect(keyToRef.get("tijmtakje")).toBe("USDA-SR-Legacy:173470");
    expect(keyToRef.get("venkelzaad")).toBe("USDA-SR-Legacy:171323");
    for (const key of ["bakpoeder", "zakje bakpoeder", "gember", "koriander"]) {
      expect(keyToRef.has(key)).toBe(false);
    }
    expect(keyToRef.get("vanille extract")).toBe("USDA-SR-Legacy:173471");
    expect(keyToRef.get("kerriepoeder")).toBe("NEVO-online:1223");
  });

  it("reports aliases that collapse onto an earlier key instead of silently emitting them", () => {
    expect(dropped).toContain("verse tijm -> tijm");
    expect(dropped).toContain("vanille-extract -> vanille extract");
  });
});

describe("SQL emission", () => {
  it("renders null for a missing nutrient and escapes quotes", () => {
    const sql = buildIngredientsInsert([
      {
        nameNl: "O'Test",
        nameEn: "Test",
        fdcId: "1",
        nutrients: { kcal: "10", protein: null, carbs: null, fat: "0", fibre: null },
      },
    ]);
    expect(sql).toContain("('O''Test', 'Test', 'Kruiden en specerijen', 'Herbs and spices', 'per_100g', 10, null, null, 0, null, 'USDA-SR-Legacy', '1', '2018-04')");
    expect(sql).toContain("where not exists");
  });

  it("makes unit masses and aliases idempotent and resolves rows by source + source_ref", () => {
    const masses = buildUnitMassesInsert([{ fdcId: "1", unit: "theelepel", grams: 3 }]);
    expect(masses).toContain("on conflict (ingredient_id, unit) do nothing");
    expect(masses).toContain("on ri.source = v.source and ri.source_ref = v.source_ref");
    const aliases = buildAliasesInsert([{ aliasNormalized: "x", source: "NEVO-online", sourceRef: "1223" }]);
    expect(aliases).toContain("on conflict (alias_normalized) do nothing");
    expect(aliases).toContain("('x', 'NEVO-online', '1223')");
  });
});
