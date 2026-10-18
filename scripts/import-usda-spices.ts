#!/usr/bin/env -S npx tsx
// Reads the git-ignored USDA SR Legacy 2018-04 CSVs and emits the three SQL
// statements pasted verbatim into supabase/migrations/20261018000001_usda_spices.sql
// (#521, ADR-0011 §5, ADR-0020 §2/§3): new reference.ingredients rows for
// herbs and spices NEVO lacks, their teaspoon/tablespoon masses, and shared
// aliases. Same structure and curation rules as import-usda-unit-masses.ts:
// SPICES below is the curation record. A person read each SR Legacy food.csv
// description and chose the fdc_id by hand (no fuzzy matching); the script
// re-reads the CSVs and throws on any description/portion mismatch.
//
// Usage: npx tsx scripts/import-usda-spices.ts [path/to/usda] > out.sql
// Expects usda/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/.
//
// Rules: one source per row (SR Legacy only); a nutrient with no
// food_nutrient.csv row is NULL, never 0; spoon masses come only from real
// food_portion.csv rows (referenced by id, amount 1).
//
// Looked for in SR Legacy and absent (so not seeded): garam masala, harissa,
// curry leaves, star anise (only aniseed, which NEVO already has).

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { normalizeIngredientName } from "../lib/recipes/import/normalize-name";
import {
  escapeSqlString,
  parseCsv,
  readFoodDescriptions,
  readFoodPortions,
  resolvePortionGrams,
  SR_LEGACY_SOURCE,
  SR_LEGACY_SOURCE_VERSION,
  type FoodTables,
} from "./import-usda-unit-masses";

export const CATEGORY_NL = "Kruiden en specerijen";
export const CATEGORY_EN = "Herbs and spices";
export type SpoonUnit = "theelepel" | "eetlepel";

export interface SpoonRef {
  portionId: string;
  label: string;
}

export interface SpicePairing {
  nameNl: string;
  nameEn: string;
  usdaFdcId: string;
  usdaDescription: string;
  units: Partial<Record<SpoonUnit, SpoonRef>>;
  /** Raw alias texts; stored normalised via normalizeIngredientName. */
  aliases: readonly string[];
}

const tsp = (portionId: string, label: string): SpoonRef => ({ portionId, label });

export const SPICES: readonly SpicePairing[] = [
  {
    nameNl: "Kurkuma gemalen", nameEn: "Turmeric ground",
    usdaFdcId: "172231", usdaDescription: "Spices, turmeric, ground",
    units: { theelepel: tsp("90123", "tsp"), eetlepel: tsp("90124", "tbsp") },
    aliases: ["kurkuma", "geelwortel"],
  },
  {
    nameNl: "Fenegriekzaad", nameEn: "Fenugreek seed",
    usdaFdcId: "171324", usdaDescription: "Spices, fenugreek seed",
    units: { theelepel: tsp("88437", "tsp"), eetlepel: tsp("88438", "tbsp") },
    aliases: ["gemalen fenegriek"],
  },
  {
    // SR Legacy has one coriander seed row (not split whole/ground).
    nameNl: "Koriander gemalen", nameEn: "Coriander seed",
    usdaFdcId: "170922", usdaDescription: "Spices, coriander seed",
    units: { theelepel: tsp("87542", "tsp"), eetlepel: tsp("87543", "tbsp") },
    aliases: ["gemalen koriander", "korianderzaad"],
  },
  {
    nameNl: "Gember gemalen", nameEn: "Ginger ground",
    usdaFdcId: "170926", usdaDescription: "Spices, ginger, ground",
    units: { theelepel: tsp("87550", "tsp"), eetlepel: tsp("87551", "tbsp") },
    aliases: ["gemalen gember", "gemberpoeder"],
  },
  {
    nameNl: "Laurierblad gedroogd", nameEn: "Bay leaf dried",
    usdaFdcId: "170917", usdaDescription: "Spices, bay leaf",
    units: { theelepel: tsp("87532", "tsp, crumbled"), eetlepel: tsp("87533", "tbsp, crumbled") },
    aliases: ["laurierblad", "laurier"],
  },
  {
    nameNl: "Piment gemalen", nameEn: "Allspice ground",
    usdaFdcId: "171315", usdaDescription: "Spices, allspice, ground",
    units: { theelepel: tsp("88417", "tsp"), eetlepel: tsp("88418", "tbsp") },
    aliases: ["piment"],
  },
  {
    // "tijm" normalises to the same key as "verse tijm" (the app strips
    // "verse"), so the generic key goes to dried thyme, as the ticket asks.
    nameNl: "Tijm gedroogd", nameEn: "Thyme dried",
    usdaFdcId: "170938", usdaDescription: "Spices, thyme, dried",
    units: { theelepel: tsp("87578", "tsp, leaves"), eetlepel: tsp("87579", "tbsp, leaves") },
    aliases: ["tijm"],
  },
  {
    nameNl: "Tijm vers", nameEn: "Thyme fresh",
    usdaFdcId: "173470", usdaDescription: "Thyme, fresh",
    units: { theelepel: tsp("92601", "tsp") },
    aliases: ["verse tijm", "verse tijmtakjes"],
  },
  {
    nameNl: "Venkelzaad", nameEn: "Fennel seed",
    usdaFdcId: "171323", usdaDescription: "Spices, fennel seed",
    units: { theelepel: tsp("88435", "tsp, whole"), eetlepel: tsp("88436", "tbsp, whole") },
    aliases: ["venkelzaad"],
  },
  {
    // Dutch bakpoeder is phosphate-based, so the straight-phosphate row
    // rather than the sodium aluminum sulfate one.
    nameNl: "Bakpoeder", nameEn: "Baking powder",
    usdaFdcId: "172804",
    usdaDescription: "Leavening agents, baking powder, double-acting, straight phosphate",
    units: { theelepel: tsp("91439", "tsp") },
    aliases: ["bakpoeder", "zakje bakpoeder"],
  },
  {
    nameNl: "Vanille-extract", nameEn: "Vanilla extract",
    usdaFdcId: "173471", usdaDescription: "Vanilla extract",
    units: { theelepel: tsp("92603", "tsp"), eetlepel: tsp("92604", "tbsp") },
    aliases: ["vanille extract", "vanille-extract"],
  },
  {
    nameNl: "Dille gedroogd", nameEn: "Dill weed dried",
    usdaFdcId: "171322", usdaDescription: "Spices, dill weed, dried",
    units: { theelepel: tsp("88433", "tsp"), eetlepel: tsp("88434", "tbsp") },
    aliases: [],
  },
  {
    nameNl: "Dille vers", nameEn: "Dill weed fresh",
    usdaFdcId: "172233", usdaDescription: "Dill weed, fresh",
    units: {},
    aliases: [],
  },
  {
    nameNl: "Salie gemalen", nameEn: "Sage ground",
    usdaFdcId: "170935", usdaDescription: "Spices, sage, ground",
    units: { theelepel: tsp("87570", "tsp"), eetlepel: tsp("87571", "tbsp") },
    aliases: ["salie"],
  },
  {
    nameNl: "Dragon gedroogd", nameEn: "Tarragon dried",
    usdaFdcId: "170937", usdaDescription: "Spices, tarragon, dried",
    units: { theelepel: tsp("87574", "tsp, leaves"), eetlepel: tsp("87575", "tbsp, leaves") },
    aliases: ["dragon"],
  },
  {
    nameNl: "Kardemom gemalen", nameEn: "Cardamom ground",
    usdaFdcId: "170919", usdaDescription: "Spices, cardamom",
    units: { theelepel: tsp("87536", "tsp, ground"), eetlepel: tsp("87537", "tbsp, ground") },
    aliases: ["kardemom"],
  },
  {
    nameNl: "Knoflookpoeder", nameEn: "Garlic powder",
    usdaFdcId: "171325", usdaDescription: "Spices, garlic powder",
    units: { theelepel: tsp("88439", "tsp"), eetlepel: tsp("88440", "tbsp") },
    aliases: ["knoflookpoeder"],
  },
  {
    nameNl: "Uienpoeder", nameEn: "Onion powder",
    usdaFdcId: "171327", usdaDescription: "Spices, onion powder",
    units: { theelepel: tsp("88443", "tsp"), eetlepel: tsp("88444", "tbsp") },
    aliases: ["uienpoeder"],
  },
  {
    nameNl: "Saffraan", nameEn: "Saffron",
    usdaFdcId: "170934", usdaDescription: "Spices, saffron",
    units: { theelepel: tsp("87568", "tsp"), eetlepel: tsp("87569", "tbsp") },
    aliases: ["saffraan"],
  },
  {
    nameNl: "Mosterdzaad gemalen", nameEn: "Mustard seed ground",
    usdaFdcId: "170929", usdaDescription: "Spices, mustard seed, ground",
    units: { theelepel: tsp("87556", "tsp"), eetlepel: tsp("87557", "tbsp") },
    aliases: ["mosterdzaad"],
  },
  {
    nameNl: "Karwijzaad", nameEn: "Caraway seed",
    usdaFdcId: "170918", usdaDescription: "Spices, caraway seed",
    units: { theelepel: tsp("87534", "tsp"), eetlepel: tsp("87535", "tbsp") },
    aliases: ["karwijzaad"],
  },
];

/** Aliases onto existing NEVO rows (no new ingredient row). */
export const NEVO_ALIASES: readonly { alias: string; nevoCode: string; nevoName: string }[] = [
  { alias: "kerriepoeder", nevoCode: "1223", nevoName: "Kerrie djawa" },
  { alias: "verse kruiden", nevoCode: "5415", nevoName: "Kruiden tuin- vers gem" },
];

export const NEVO_SOURCE = "NEVO-online";

// ============================================================================
// Nutrients
// ============================================================================

const NUTRIENT_IDS = {
  kcal: "1008",
  protein: "1003",
  carbs: "1005",
  fat: "1004",
  fibre: "1079",
} as const;

export interface Nutrients {
  kcal: string | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  fibre: string | null;
}

/** food_nutrient.csv -> per-fdc_id nutrients; absent rows stay null (never 0). */
export function readNutrients(csvText: string, fdcIds: ReadonlySet<string>): Map<string, Nutrients> {
  const out = new Map<string, Nutrients>();
  for (const fdcId of fdcIds) {
    out.set(fdcId, { kcal: null, protein: null, carbs: null, fat: null, fibre: null });
  }
  const byId = new Map<string, keyof Nutrients>(
    (Object.entries(NUTRIENT_IDS) as [keyof Nutrients, string][]).map(([key, id]) => [id, key]),
  );
  for (const row of parseCsv(csvText)) {
    const target = out.get(row.fdc_id);
    const key = byId.get(row.nutrient_id);
    if (!target || !key || row.amount.trim() === "") continue;
    if (!Number.isFinite(Number(row.amount))) {
      throw new Error(`import-usda-spices: non-numeric amount ${JSON.stringify(row.amount)} for fdc_id ${row.fdc_id}`);
    }
    target[key] = String(Number(row.amount));
  }
  return out;
}

// ============================================================================
// Row building + SQL emission
// ============================================================================

export interface IngredientRow {
  nameNl: string;
  nameEn: string;
  nutrients: Nutrients;
  fdcId: string;
}

export interface SpoonMassRow {
  fdcId: string;
  unit: SpoonUnit;
  grams: number;
}

export interface AliasRow {
  aliasNormalized: string;
  source: string;
  sourceRef: string;
}

export function buildIngredientRows(
  tables: FoodTables,
  nutrients: ReadonlyMap<string, Nutrients>,
  pairings: readonly SpicePairing[],
): IngredientRow[] {
  return pairings.map((pairing) => {
    const actual = tables.descriptions.get(pairing.usdaFdcId);
    if (actual !== pairing.usdaDescription) {
      throw new Error(
        `import-usda-spices: fdc_id ${pairing.usdaFdcId} description is ${JSON.stringify(actual)}, expected ${JSON.stringify(pairing.usdaDescription)}`,
      );
    }
    const found = nutrients.get(pairing.usdaFdcId);
    if (!found) throw new Error(`import-usda-spices: no nutrients loaded for fdc_id ${pairing.usdaFdcId}`);
    return { nameNl: pairing.nameNl, nameEn: pairing.nameEn, nutrients: found, fdcId: pairing.usdaFdcId };
  });
}

export function buildSpoonMassRows(tables: FoodTables, pairings: readonly SpicePairing[]): SpoonMassRow[] {
  const rows: SpoonMassRow[] = [];
  for (const pairing of pairings) {
    for (const [unit, ref] of Object.entries(pairing.units) as [SpoonUnit, SpoonRef][]) {
      const portion = tables.portions.get(ref.portionId);
      if (portion && portion.amount !== "1") {
        throw new Error(`import-usda-spices: portion ${ref.portionId} has amount ${portion.amount}, expected 1`);
      }
      const grams = resolvePortionGrams(
        tables,
        { bundle: "sr_legacy", fdcId: pairing.usdaFdcId, portionId: ref.portionId, label: ref.label },
        pairing.usdaDescription,
      );
      rows.push({ fdcId: pairing.usdaFdcId, unit, grams });
    }
  }
  return rows;
}

/**
 * Normalised alias rows, first writer wins. The app strips words such as
 * "verse" and "gemalen" when it looks an alias up, so two raw aliases can
 * collapse to one key; the loser is reported in `dropped`.
 */
export function buildAliasRows(
  pairings: readonly SpicePairing[],
  nevoAliases: readonly { alias: string; nevoCode: string }[],
): { rows: AliasRow[]; dropped: string[] } {
  const rows: AliasRow[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  const add = (alias: string, source: string, sourceRef: string) => {
    const key = normalizeIngredientName(alias);
    if (key === "") throw new Error(`import-usda-spices: alias ${JSON.stringify(alias)} normalises to empty`);
    if (seen.has(key)) {
      dropped.push(`${alias} -> ${key}`);
      return;
    }
    seen.add(key);
    rows.push({ aliasNormalized: key, source, sourceRef });
  };
  for (const pairing of pairings) {
    for (const alias of pairing.aliases) add(alias, SR_LEGACY_SOURCE, pairing.usdaFdcId);
  }
  for (const entry of nevoAliases) add(entry.alias, NEVO_SOURCE, entry.nevoCode);
  return { rows, dropped };
}

const sqlText = (value: string) => `'${escapeSqlString(value)}'`;
const sqlNum = (value: string | null) => (value === null ? "null" : value);

export function buildIngredientsInsert(rows: readonly IngredientRow[]): string {
  const tuples = rows
    .map(
      (r) =>
        `  (${sqlText(r.nameNl)}, ${sqlText(r.nameEn)}, ${sqlText(CATEGORY_NL)}, ${sqlText(CATEGORY_EN)}, 'per_100g', ` +
        `${sqlNum(r.nutrients.kcal)}, ${sqlNum(r.nutrients.protein)}, ${sqlNum(r.nutrients.carbs)}, ` +
        `${sqlNum(r.nutrients.fat)}, ${sqlNum(r.nutrients.fibre)}, ` +
        `${sqlText(SR_LEGACY_SOURCE)}, ${sqlText(r.fdcId)}, ${sqlText(SR_LEGACY_SOURCE_VERSION)})`,
    )
    .join(",\n");
  return (
    `insert into reference.ingredients (\n` +
    `  name_nl, name_en, category_nl, category_en, nutrient_basis, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, source, source_ref, source_version\n` +
    `)\n` +
    `select v.* from (values\n${tuples}\n) as v (\n` +
    `  name_nl, name_en, category_nl, category_en, nutrient_basis, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, source, source_ref, source_version\n` +
    `)\n` +
    `where not exists (\n` +
    `  select 1 from reference.ingredients ri where ri.source = v.source and ri.source_ref = v.source_ref\n` +
    `);\n`
  );
}

export function buildUnitMassesInsert(rows: readonly SpoonMassRow[]): string {
  const tuples = rows
    .map((r) => `  (${sqlText(r.fdcId)}, '${r.unit}', ${r.grams}, ${sqlText(SR_LEGACY_SOURCE)}, ${sqlText(SR_LEGACY_SOURCE_VERSION)})`)
    .join(",\n");
  return (
    `insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)\n` +
    `select ri.id, v.unit::public.recipe_unit, v.grams, v.source, v.source_version\n` +
    `from (values\n${tuples}\n) as v (source_ref, unit, grams, source, source_version)\n` +
    `join reference.ingredients ri\n` +
    `  on ri.source = v.source and ri.source_ref = v.source_ref\n` +
    `on conflict (ingredient_id, unit) do nothing;\n`
  );
}

export function buildAliasesInsert(rows: readonly AliasRow[]): string {
  const tuples = rows
    .map((r) => `  (${sqlText(r.aliasNormalized)}, ${sqlText(r.source)}, ${sqlText(r.sourceRef)})`)
    .join(",\n");
  return (
    `insert into reference.ingredient_aliases (alias_normalized, ingredient_id)\n` +
    `select v.alias_normalized, ri.id\n` +
    `from (values\n${tuples}\n) as v (alias_normalized, source, source_ref)\n` +
    `join reference.ingredients ri\n` +
    `  on ri.source = v.source and ri.source_ref = v.source_ref\n` +
    `on conflict (alias_normalized) do nothing;\n`
  );
}

// ============================================================================
// main() -- CLI only.
// ============================================================================

const DEFAULT_USDA_DIR = fileURLToPath(new URL("../usda", import.meta.url));

function main() {
  const dir = join(
    process.argv[2] ?? DEFAULT_USDA_DIR,
    "sr_legacy",
    "FoodData_Central_sr_legacy_food_csv_2018-04",
  );
  const tables: FoodTables = {
    descriptions: readFoodDescriptions(readFileSync(join(dir, "food.csv"), "utf-8")),
    portions: readFoodPortions(readFileSync(join(dir, "food_portion.csv"), "utf-8")),
  };
  const nutrients = readNutrients(
    readFileSync(join(dir, "food_nutrient.csv"), "utf-8"),
    new Set(SPICES.map((s) => s.usdaFdcId)),
  );

  const ingredientRows = buildIngredientRows(tables, nutrients, SPICES);
  const massRows = buildSpoonMassRows(tables, SPICES);
  const { rows: aliasRows, dropped } = buildAliasRows(SPICES, NEVO_ALIASES);

  process.stdout.write(
    [buildIngredientsInsert(ingredientRows), buildUnitMassesInsert(massRows), buildAliasesInsert(aliasRows)].join("\n"),
  );
  console.error(
    `import-usda-spices: ${ingredientRows.length} ingredients, ${massRows.length} spoon masses, ` +
      `${aliasRows.length} aliases; aliases collapsed by normalisation: ${dropped.join("; ") || "none"}.`,
  );
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
