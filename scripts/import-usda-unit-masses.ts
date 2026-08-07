#!/usr/bin/env -S npx tsx
// Reads the upstream USDA FoodData Central CSVs (FNDDS/Survey Foods
// 2024-10-31 + SR Legacy 2018-04, https://fdc.nal.usda.gov/download-datasets)
// and emits the `insert into reference.ingredient_unit_masses (...)`
// statement pasted into supabase/migrations/20260807000001_usda_unit_masses.sql
// (#164/#157, slice 1 of 2: DATA + RESOLUTION). Structured like
// scripts/import-nevo-portions.ts (#163): pure exported functions + a thin
// main(), so CSV lookup/assertion logic is unit-testable without the
// git-ignored upstream CSVs present.
//
// Usage: npx tsx scripts/import-usda-unit-masses.ts [path/to/usda] > out.sql
// Defaults to ./usda (this repo's git-ignored download location, see
// .gitignore) with the two bundles expected at
// usda/fndds/FoodData_Central_survey_food_csv_2024-10-31/ and
// usda/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/ -- the same
// layout the ticket's upstream download used.
//
// ============================================================================
// What this script is NOT: a mapping-rule engine like import-nevo-portions.ts.
// ============================================================================
// import-nevo-portions.ts derives its (NEVO code, unit) -> grams seed
// algorithmically from 26 CSVs using an exact-string `Maat` lookup table,
// because NEVO's own household-measure export is already keyed by NEVO
// code. USDA's CSVs have no such NEVO linkage -- pairing a NEVO ingredient
// (reference.ingredients, seeded by 20260806000001_nevo_nutrition_import.sql)
// to the right USDA food required reading both ingredient lists by hand
// and choosing which USDA `fdc_id` genuinely denotes the same raw ingredient
// (a prior automated attempt at this scored 20-56% precision on a name-
// similarity match -- see #164's ticket body -- which is why the pairing
// below is hand-curated, not computed).
//
// So SOLID_PAIRINGS / LIQUID_PAIRINGS below ARE the curation record: for
// every entry, a person read the actual NEVO ingredient name (name_nl +
// name_en, from the parsed reference.ingredients seed) and the actual USDA
// `food.csv` description, decided they denote the same raw ingredient, and
// picked one specific `food_portion.csv` row (referenced by that row's own
// `id`, its true primary key -- never by re-deriving "the nth cup portion"
// from a regex that could silently pick a different row against a future
// CSV revision). At import time this script re-reads the CSVs and asserts
// three things against every referenced row, throwing loudly on any
// mismatch rather than silently drifting:
//   1. the portion row's `fdc_id` matches the pairing's `usdaFdcId`
//   2. that fdc_id's `food.csv` description equals the pairing's
//      `usdaDescription` verbatim
//   3. the portion row's `portion_description` (FNDDS) or `modifier`
//      (SR Legacy) equals the pairing's declared `label` verbatim (e.g.
//      "cup shelled (50 halves)" for walnuts, "cup packed" for brown sugar
//      -- USDA very often carries several differently-qualified "cup"
//      rows for one food, and the label records exactly which one was
//      chosen and why, right next to the choice).
// A future re-run against a re-downloaded copy of the *same* CSV vintage
// (2024-10-31 FNDDS / 2018-04 SR Legacy) reproduces byte-identical output;
// a re-run against a *different* USDA vintage fails loudly instead of
// silently reseeding different numbers under the same fdc_id.
//
// ============================================================================
// Curation rules applied while building the tables below (#164 ticket body):
// ============================================================================
// - Every gram value is read directly out of a real food_portion.csv row
//   (identified by that row's own `id`) -- nothing here is invented,
//   remembered, or rounded from memory.
// - SOLID_PAIRINGS get a `cup` unit (always) plus `tablespoon`/`teaspoon`
//   only when USDA's own food_portion.csv carries an exact "1 tbsp"/"1 tsp"
//   row for that same food -- never derived by scaling the cup value.
// - LIQUID_PAIRINGS get exactly one `milliliter` row: density (g per 1 ml)
//   = (grams for USDA's "1 cup" row) / 240, restricted to genuine liquids
//   (milk, cream, oil, honey, syrup, vinegar, soy sauce, broth, juice,
//   water, yoghurt) -- never a solid's packing density, and never derived
//   from a spoon measure (only cup-derived densities are trustworthy enough
//   to extrapolate to 1 ml -- see lib/recipes/mass-resolution.ts's header
//   for why the resulting bridge is one-way, exactness-first).
// - Every value was sanity-gated: g/cup in [25, 330], density in
//   [0.6, 1.5]. A few plausible-looking USDA rows were rejected for
//   failing this (or for having no exact "1 cup"/"1 tbsp"/"1 tsp" row at
//   all) -- e.g. wine (only fl oz/"serving 5 fl oz" portions exist, no cup
//   row, so NEVO's three wine codes are dropped entirely rather than
//   inventing a cup value by scaling fl oz); dry pasta (USDA's cup weight
//   varies ~64-122 g across shapes for the same "Pasta, dry, enriched"
//   fdc_id, so no single defensible "1 cup" value exists for NEVO's
//   shape-agnostic "Pasta witte rauw"); split peas and dried whole green
//   peas (no raw/dry cup portion in either bundle); molasses, grape juice,
//   cranberry juice, and Worcestershire sauce (no matching NEVO row at
//   all); baking soda, plain dried chickpeas, cornmeal/polenta, and
//   unsweetened desiccated coconut (present in one CSV but not matched by
//   a real row in the other, or vice versa).
//
// Prepared/canned follow-up (#164/#157, same ticket): NEVO's cup coverage
// originally stopped at raw/dry staples, which left cooked/canned recipe
// lines (e.g. "2 cups Rijst witte gekookt") unresolved even after the raw
// pairings above landed -- see this migration's own header for why the
// obvious shortcut (bridging from the NEVO-portie-online eetlepel value)
// is physically wrong, not merely imprecise. SOLID_PAIRINGS below the
// barley entry extends the same hand-curation to cooked grains/legumes and
// drained canned legumes/corn. Also rejected there, same rule (no exact,
// defensible cup row -> drop, don't approximate): multi-grain cooked rice
// and cooked red lentils (no such row in either bundle); canned white
// beans, canned cannellini beans, and canned black-eyed peas (every
// candidate row is either "solids and liquids" at ~240-262 g/cup -- brine-
// inclusive, not what a cook scoops -- or has no cup portion at all, only
// a can-sized one); whole, non-split, non-sprouted dried peas cooked (only
// sprouted-pea and split-pea cooked rows exist, a different food each);
// whole-wheat couscous (no such row); pasta cooked without egg (the one
// matching USDA row has only an oz portion, no cup); and frozen cooked
// peas (the only cup-sized portion is 0.5 cup, and scaling it to 1 cup
// would violate the "never derived by scaling" rule above).
//
// Rounding: solid gram values are the CSV's own value, unmodified. Liquid
// densities are rounded to 4 decimal places (roundTo4dp below) -- enough
// precision to round-trip through a `cup` conversion without drift, not
// spurious floating-point noise.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

// ============================================================================
// Curated pairing data -- the provenance trail ADR-0011 §5 requires.
// ============================================================================

export type UsdaBundle = "fndds" | "sr_legacy";
export type SolidUnit = "cup" | "tablespoon" | "teaspoon";

/** One food_portion.csv row, referenced by its own primary key (`id`) --
 * never re-derived by pattern-matching, so a future CSV revision that
 * reorders or adds rows can't silently swap in a different portion under
 * the same description. `label` is what resolvePortionGrams asserts the
 * row's portion_description (FNDDS) or modifier (SR Legacy) equals. */
export interface PortionRef {
  bundle: UsdaBundle;
  fdcId: string;
  portionId: string;
  label: string;
}

export interface SolidPairing {
  /** reference.ingredients.source_ref for the NEVO-online row this pairs to. */
  nevoCode: string;
  usdaFdcId: string;
  usdaDescription: string;
  units: Partial<Record<SolidUnit, PortionRef>>;
}

export interface LiquidPairing {
  nevoCode: string;
  usdaFdcId: string;
  usdaDescription: string;
  cup: PortionRef;
}

function portion(bundle: UsdaBundle, fdcId: string, portionId: string, label: string): PortionRef {
  return { bundle, fdcId, portionId, label };
}

// 66 solid staples (40 raw/dry + 26 prepared/canned, see header). Every
// entry gets `cup`; `tablespoon`/`teaspoon` are added only where USDA's own
// food_portion.csv carries an exact "1 tbsp"/"1 tsp" row for the same
// fdc_id (see header).
export const SOLID_PAIRINGS: readonly SolidPairing[] = [
  {
    nevoCode: "5", usdaFdcId: "168877",
    usdaDescription: "Rice, white, long-grain, regular, raw, enriched",
    units: { cup: portion("sr_legacy", "168877", "83927", "cup") },
  },
  {
    nevoCode: "712", usdaFdcId: "169703",
    usdaDescription: "Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program)",
    units: { cup: portion("sr_legacy", "169703", "85377", "cup") },
  },
  {
    nevoCode: "220", usdaFdcId: "168894",
    usdaDescription: "Wheat flour, white, all-purpose, enriched, bleached",
    units: { cup: portion("sr_legacy", "168894", "83944", "cup") },
  },
  {
    nevoCode: "222", usdaFdcId: "168893",
    usdaDescription: "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)",
    units: { cup: portion("sr_legacy", "168893", "83943", "cup") },
  },
  {
    // Bloem rogge- ("Flour rye") -- Dutch "bloem" is the finer/lighter
    // flour grade, paired to USDA's "light" rye flour, not "dark".
    nevoCode: "217", usdaFdcId: "168887",
    usdaDescription: "Rye flour, light",
    units: { cup: portion("sr_legacy", "168887", "83937", "cup") },
  },
  {
    // Meel rogge- ("Flour rye wholemeal") -- Dutch "meel" is the coarser/
    // wholemeal grade, paired to USDA's "dark" rye flour (higher
    // extraction rate, closer to whole grain). Flagged as an approximate
    // pairing based on the extraction-rate naming, not a certain one.
    nevoCode: "218", usdaFdcId: "168885",
    usdaDescription: "Rye flour, dark",
    units: { cup: portion("sr_legacy", "168885", "83935", "cup") },
  },
  {
    nevoCode: "208", usdaFdcId: "170687",
    usdaDescription: "Buckwheat flour, whole-groat",
    units: { cup: portion("sr_legacy", "170687", "87083", "cup") },
  },
  {
    nevoCode: "80", usdaFdcId: "169714",
    usdaDescription: "Rice flour, white, unenriched",
    units: { cup: portion("sr_legacy", "169714", "85388", "cup") },
  },
  {
    nevoCode: "696", usdaFdcId: "170290",
    usdaDescription: "Corn flour, whole-grain, yellow",
    units: { cup: portion("sr_legacy", "170290", "86374", "cup") },
  },
  {
    nevoCode: "377", usdaFdcId: "169655",
    usdaDescription: "Sugars, granulated",
    units: {
      cup: portion("sr_legacy", "169655", "85288", "cup"),
      teaspoon: portion("sr_legacy", "169655", "85287", "tsp"),
    },
  },
  {
    // Suiker basterd- witte ("Sugar castor white") -- caster sugar is
    // finer-ground granulated sugar, same substance/density; reuses the
    // granulated-sugar row rather than inventing a distinct value.
    nevoCode: "375", usdaFdcId: "169655",
    usdaDescription: "Sugars, granulated",
    units: { cup: portion("sr_legacy", "169655", "85288", "cup") },
  },
  {
    // "cup packed" -- brown sugar is conventionally measured packed in
    // recipes; USDA's "cup unpacked" (145g) row was not used.
    nevoCode: "374", usdaFdcId: "168833",
    usdaDescription: "Sugars, brown",
    units: { cup: portion("sr_legacy", "168833", "83855", "cup packed") },
  },
  {
    // "cup unsifted" -- the default measurement convention (USDA's "cup
    // sifted" row, 100g, was not used).
    nevoCode: "5089", usdaFdcId: "169656",
    usdaDescription: "Sugars, powdered",
    units: {
      cup: portion("sr_legacy", "169656", "85290", "cup unsifted"),
      tablespoon: portion("sr_legacy", "169656", "85292", "tbsp unsifted"),
      teaspoon: portion("sr_legacy", "169656", "85293", "tsp"),
    },
  },
  {
    nevoCode: "310", usdaFdcId: "173430",
    usdaDescription: "Butter, without salt",
    units: {
      cup: portion("sr_legacy", "173430", "92513", "cup"),
      tablespoon: portion("sr_legacy", "173430", "92512", "tbsp"),
    },
  },
  {
    nevoCode: "879", usdaFdcId: "173410",
    usdaDescription: "Butter, salted",
    units: {
      cup: portion("sr_legacy", "173410", "92458", "cup"),
      tablespoon: portion("sr_legacy", "173410", "92457", "tbsp"),
    },
  },
  {
    nevoCode: "213", usdaFdcId: "2708489",
    usdaDescription: "Oats, raw",
    units: { cup: portion("fndds", "2708489", "303127", "1 cup") },
  },
  {
    nevoCode: "215", usdaFdcId: "169698",
    usdaDescription: "Cornstarch",
    units: { cup: portion("sr_legacy", "169698", "85370", "cup") },
  },
  {
    nevoCode: "430", usdaFdcId: "169593",
    usdaDescription: "Cocoa, dry powder, unsweetened",
    units: {
      cup: portion("sr_legacy", "169593", "85186", "cup"),
      tablespoon: portion("sr_legacy", "169593", "85187", "tbsp"),
    },
  },
  {
    nevoCode: "198", usdaFdcId: "2707489",
    usdaDescription: "Almonds, unsalted",
    units: { cup: portion("fndds", "2707489", "298292", "1 cup") },
  },
  {
    // "cup shelled (50 halves)" -- the closest USDA row to a generic "cup
    // of raw walnuts"; USDA also carries chopped/ground/pieces variants
    // (117/80/120g) which are NOT what a plain "Noten wal- ongezouten" row
    // denotes.
    nevoCode: "206", usdaFdcId: "170187",
    usdaDescription: "Nuts, walnuts, english",
    units: { cup: portion("sr_legacy", "170187", "86204", "cup shelled (50 halves)") },
  },
  {
    nevoCode: "33", usdaFdcId: "2709212",
    usdaDescription: "Raisins",
    units: { cup: portion("fndds", "2709212", "306056", "1 cup") },
  },
  {
    nevoCode: "120", usdaFdcId: "172420",
    usdaDescription: "Lentils, raw",
    units: {
      cup: portion("sr_legacy", "172420", "90594", "cup"),
      tablespoon: portion("sr_legacy", "172420", "90595", "tablespoon"),
    },
  },
  {
    nevoCode: "3153", usdaFdcId: "168874",
    usdaDescription: "Quinoa, uncooked",
    units: { cup: portion("sr_legacy", "168874", "83924", "cup") },
  },
  {
    nevoCode: "1889", usdaFdcId: "169699",
    usdaDescription: "Couscous, dry",
    units: { cup: portion("sr_legacy", "169699", "85371", "cup") },
  },
  {
    // Pindakaas ("Peanut butter", generic/no qualifier) -> smooth style.
    nevoCode: "455", usdaFdcId: "172470",
    usdaDescription: "Peanut butter, smooth style, without salt",
    units: { cup: portion("sr_legacy", "172470", "90674", "cup") },
  },
  {
    // Pindakaas m stukjes pinda ("Peanut butter w peanut pieces") -> chunk style.
    nevoCode: "541", usdaFdcId: "172469",
    usdaDescription: "Peanut butter, chunk style, without salt",
    units: { cup: portion("sr_legacy", "172469", "90672", "cup") },
  },
  {
    nevoCode: "2819", usdaFdcId: "173468",
    usdaDescription: "Salt, table",
    units: {
      cup: portion("sr_legacy", "173468", "92596", "cup"),
      tablespoon: portion("sr_legacy", "173468", "92595", "tbsp"),
      teaspoon: portion("sr_legacy", "173468", "92594", "tsp"),
    },
  },
  {
    // Sesamzaad z schil ("Sesame seeds wo hull") -> decorticated kernels, exact match.
    nevoCode: "838", usdaFdcId: "169412",
    usdaDescription: "Seeds, sesame seed kernels, dried (decorticated)",
    units: {
      cup: portion("sr_legacy", "169412", "84812", "cup"),
      tablespoon: portion("sr_legacy", "169412", "84813", "tbsp"),
      teaspoon: portion("sr_legacy", "169412", "84814", "tsp"),
    },
  },
  {
    // Popcorn naturel gepoft z olie ("Popcorn plain popped wo oil") -> air-popped, exact match.
    nevoCode: "630", usdaFdcId: "167959",
    usdaDescription: "Snacks, popcorn, air-popped",
    units: { cup: portion("sr_legacy", "167959", "82278", "cup") },
  },
  {
    nevoCode: "1013", usdaFdcId: "174928",
    usdaDescription: "Bread, crumbs, dry, grated, plain",
    units: { cup: portion("sr_legacy", "174928", "95194", "cup") },
  },
  {
    nevoCode: "181", usdaFdcId: "171726",
    usdaDescription: "Dates, deglet noor",
    units: { cup: portion("sr_legacy", "171726", "89264", "cup, chopped") },
  },
  {
    nevoCode: "199", usdaFdcId: "2707497",
    usdaDescription: "Cashews, unsalted",
    units: { cup: portion("fndds", "2707497", "298333", "1 cup") },
  },
  {
    nevoCode: "2176", usdaFdcId: "170591",
    usdaDescription: "Nuts, pine nuts, dried",
    units: { cup: portion("sr_legacy", "170591", "86915", "cup") },
  },
  {
    nevoCode: "2890", usdaFdcId: "2709202",
    usdaDescription: "Cranberries, dried",
    units: { cup: portion("fndds", "2709202", "306024", "1 cup") },
  },
  {
    nevoCode: "725", usdaFdcId: "173414",
    usdaDescription: "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)",
    units: { cup: portion("sr_legacy", "173414", "92469", "cup, shredded") },
  },
  // Bonen zwarte blik/glas is DELIBERATELY absent. Its only USDA candidate
  // (sr_legacy 175238, "Beans, black, mature seeds, canned, low sodium") gives
  // 1 cup = 240 g -- i.e. exactly water density, which is the can's total
  // contents including brine, not what a cook scoops. Drained black beans are
  // ~172 g/cup, and SR Legacy carries no drained black-bean row with a cup
  // portion, so there is no defensible value to seed. Unresolved (renders "?")
  // is the correct outcome here, per ADR-0011 §3. Do not "fix" this by
  // reinstating 175238.
  {
    nevoCode: "718", usdaFdcId: "171247",
    usdaDescription: "Cheese, parmesan, grated",
    units: {
      cup: portion("sr_legacy", "171247", "88261", "cup"),
      tablespoon: portion("sr_legacy", "171247", "88262", "tbsp"),
    },
  },
  {
    nevoCode: "3058", usdaFdcId: "168872",
    usdaDescription: "Oat bran, raw",
    units: { cup: portion("sr_legacy", "168872", "83922", "cup") },
  },
  {
    nevoCode: "590", usdaFdcId: "169722",
    usdaDescription: "Wheat bran, crude",
    units: { cup: portion("sr_legacy", "169722", "85396", "cup") },
  },
  {
    // Erwten kikker- blik/glas ("Peas chick canned") -> canned chickpeas,
    // DRAINED AND RINSED (152 g/cup). Deliberately not sr_legacy 175206
    // ("canned, solids and liquids", 240 g/cup): that figure is the can's
    // contents including brine, but a cook measuring a cup of canned
    // chickpeas has drained them first, so 240 g would overstate the mass --
    // and therefore the macros -- by ~58%.
    nevoCode: "3185", usdaFdcId: "173801",
    usdaDescription: "Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained, rinsed in tap water",
    units: { cup: portion("sr_legacy", "173801", "93275", "cup drained, rinsed") },
  },
  {
    // Gerst hele korrel rauw ("Barley whole grain raw") -> USDA "hulled"
    // (bran/germ retained), not "pearled" (bran removed) -- pearled would
    // be a meaningfully different density.
    nevoCode: "1890", usdaFdcId: "170283",
    usdaDescription: "Barley, hulled",
    units: { cup: portion("sr_legacy", "170283", "86366", "cup") },
  },
  // ==========================================================================
  // Prepared/canned staples (#164/#157 follow-up): the raw/dry pairings above
  // don't help a recipe written in cooked or canned quantities -- "2 cups
  // Rijst witte gekookt" needs *cooked* rice's cup weight, not raw rice's.
  // Every entry below is a *different* NEVO ingredient than its raw
  // counterpart above (NEVO's own nutrient composition differs pre/post
  // cooking), paired to USDA's own cooked/canned food rows -- never derived
  // by scaling a raw cup value by a cooked-yield ratio, for the same
  // exactness-first reason the header rejects the eetlepel->cup bridge.
  //
  // Canned legumes: per the curation rule, drained rows are preferred over
  // "solids and liquids" wherever both exist. Several USDA canned-bean
  // entries carry no cup-portion "drained solids" row at all (only a
  // can-sized "can drained solids" portion, unusable for a `cup` unit) --
  // in those cases the "drained solids, rinsed in tap water" row was used
  // instead where it has an exact cup portion, since a cook measuring
  // canned beans by the cup has, in practice, drained (and often rinsed)
  // them first; that is flagged per-entry below. Where *no* drained cup row
  // exists in either bundle at all (only "solids and liquids", which is
  // ~240 g/cup -- essentially water density, i.e. the can's brine included)
  // the ingredient was dropped rather than seeded with a brine-inclusive
  // number -- see the rejection list above for which ones.
  {
    nevoCode: "658", usdaFdcId: "2708408",
    usdaDescription: "Rice, white, cooked, no added fat",
    units: { cup: portion("fndds", "2708408", "302892", "1 cup, cooked") },
  },
  {
    nevoCode: "1014", usdaFdcId: "2708414",
    usdaDescription: "Rice, brown, cooked, no added fat",
    units: { cup: portion("fndds", "2708414", "302904", "1 cup, cooked") },
  },
  {
    // Linzen groene en bruine gekookt ("Lentils green and brown boiled") ->
    // SR Legacy's plain "Lentils" cooked row carries no colour qualifier,
    // which is the standard/common (green-brown) lentil, not red.
    nevoCode: "970", usdaFdcId: "172421",
    usdaDescription: "Lentils, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "172421", "90596", "cup"),
      tablespoon: portion("sr_legacy", "172421", "90597", "tbsp"),
    },
  },
  {
    // Linzen bruine blik/glas ("Lentils brown canned") -> FNDDS carries no
    // colour-specific canned-lentil row; brown/green is the default canned
    // lentil (red lentils are rarely canned whole, they disintegrate when
    // cooked), so the colour-agnostic "from canned" row is the right match.
    nevoCode: "5169", usdaFdcId: "2707426",
    usdaDescription: "Lentils, from canned",
    units: { cup: portion("fndds", "2707426", "298086", "1 cup") },
  },
  {
    // Linzen blik/glas geen zout toegevoegd ("Lentils canned no salt
    // added") -> FNDDS's "from canned" row doesn't split by added salt;
    // reused from 5169 rather than left unresolved, same as 375/374's
    // reuse of the granulated-sugar row above.
    nevoCode: "5429", usdaFdcId: "2707426",
    usdaDescription: "Lentils, from canned",
    units: { cup: portion("fndds", "2707426", "298086", "1 cup") },
  },
  {
    nevoCode: "5173", usdaFdcId: "175194",
    usdaDescription: "Beans, kidney, red, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "175194", "95822", "cup"),
      tablespoon: portion("sr_legacy", "175194", "95823", "tbsp"),
    },
  },
  {
    // Bonen kidney- rode blik/glas ("Beans kidney red canned") -> SR
    // Legacy's plain "canned, drained solids" row (fdc_id 174285) carries
    // only a can-sized portion, no cup; "canned, drained solids, rinsed in
    // tap water" is the only kidney-bean-canned row with an exact cup
    // portion, and rinsed-drained is what a cook scooping a cup of canned
    // kidney beans actually has.
    nevoCode: "3184", usdaFdcId: "175243",
    usdaDescription: "Beans, kidney, red, mature seeds, canned, drained solids, rinsed in tap water",
    units: { cup: portion("sr_legacy", "175243", "95885", "cup cup rinsed solids") },
  },
  {
    // Bonen kidney- rode blik/glas geen zout toegevoegd -> no drained +
    // no-salt-added kidney bean row exists (only "solids and liquid, low
    // sodium" at 256 g/cup, which is brine-inclusive); reused from 3184's
    // drained-and-rinsed row, since rinsing after draining removes most of
    // whatever salt was in the brine regardless of the can's own recipe.
    nevoCode: "5431", usdaFdcId: "175243",
    usdaDescription: "Beans, kidney, red, mature seeds, canned, drained solids, rinsed in tap water",
    units: { cup: portion("sr_legacy", "175243", "95885", "cup cup rinsed solids") },
  },
  {
    // Bonen bruine gekookt / blik/glas ("Beans brown boiled/canned") --
    // USDA carries no "brown bean" category. Dutch "bruine bonen" (as in
    // "bruine bonen met spek") are commonly rendered in English as "pinto
    // beans" or "brown/pinto beans" interchangeably; paired to USDA's pinto
    // bean rows as the closest defensible identity match. Flagged as a
    // judgment call, not a certain one -- unlike the white/kidney/soy/mung
    // pairings above, which match a USDA food category by name exactly.
    nevoCode: "5168", usdaFdcId: "175200",
    usdaDescription: "Beans, pinto, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "175200", "95832", "cup"),
      tablespoon: portion("sr_legacy", "175200", "95833", "tbsp"),
    },
  },
  {
    // Bonen bruine blik/glas -> pinto beans, canned. Same judgment call as
    // 5168 above. SR Legacy's plain "canned, drained solids" row (174286)
    // has only a can-sized portion; "canned, drained solids, rinsed in tap
    // water" is the pinto row with an exact cup portion.
    nevoCode: "660", usdaFdcId: "173797",
    usdaDescription: "Beans, pinto, mature seeds, canned, drained solids, rinsed in tap water",
    units: { cup: portion("sr_legacy", "173797", "93269", "cup") },
  },
  {
    // Bonen bruine blik/glas geen zout toegevoegd -> reused from 660's
    // drained-and-rinsed pinto row, same reasoning as 5431 above (no
    // drained + no-salt-added row exists; rinsing after draining already
    // removes most brine salt regardless of the can's recipe).
    nevoCode: "5428", usdaFdcId: "173797",
    usdaDescription: "Beans, pinto, mature seeds, canned, drained solids, rinsed in tap water",
    units: { cup: portion("sr_legacy", "173797", "93269", "cup") },
  },
  {
    nevoCode: "5175", usdaFdcId: "175203",
    usdaDescription: "Beans, white, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "175203", "95838", "cup"),
      tablespoon: portion("sr_legacy", "175203", "95839", "tbsp"),
    },
  },
  {
    nevoCode: "971", usdaFdcId: "174271",
    // Verbatim USDA text -- SR Legacy's own description omits "seeds"
    // ("Soybeans, mature cooked...", not "mature seeds, cooked...").
    usdaDescription: "Soybeans, mature cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "174271", "94059", "cup"),
      tablespoon: portion("sr_legacy", "174271", "94060", "tbsp"),
    },
  },
  {
    nevoCode: "3073", usdaFdcId: "174257",
    usdaDescription: "Mung beans, mature seeds, cooked, boiled, without salt",
    units: { cup: portion("sr_legacy", "174257", "94032", "cup") },
  },
  {
    nevoCode: "1095", usdaFdcId: "173757",
    usdaDescription: "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt",
    units: { cup: portion("sr_legacy", "173757", "93226", "cup") },
  },
  {
    // Erwten kikker- blik/glas geen zout toegevoegd -> reuses 3185's
    // (already-curated, see above) drained-and-rinsed chickpea row --
    // rinsing after draining removes most brine salt regardless of the
    // can's own recipe, same reasoning as the kidney/pinto reuses above.
    nevoCode: "5430", usdaFdcId: "173801",
    usdaDescription: "Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained, rinsed in tap water",
    units: { cup: portion("sr_legacy", "173801", "93275", "cup drained, rinsed") },
  },
  {
    nevoCode: "2314", usdaFdcId: "172429",
    usdaDescription: "Peas, split, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "172429", "90606", "cup"),
      tablespoon: portion("sr_legacy", "172429", "90607", "tbsp"),
    },
  },
  {
    // Erwten split- groene gekookt -> USDA's "Peas, split" cooked row
    // doesn't split by colour (yellow vs green); reused from 2314 above.
    nevoCode: "3216", usdaFdcId: "172429",
    usdaDescription: "Peas, split, mature seeds, cooked, boiled, without salt",
    units: {
      cup: portion("sr_legacy", "172429", "90606", "cup"),
      tablespoon: portion("sr_legacy", "172429", "90607", "tbsp"),
    },
  },
  {
    nevoCode: "3154", usdaFdcId: "168917",
    usdaDescription: "Quinoa, cooked",
    units: { cup: portion("sr_legacy", "168917", "83990", "cup") },
  },
  {
    nevoCode: "2158", usdaFdcId: "169700",
    usdaDescription: "Couscous, cooked",
    units: { cup: portion("sr_legacy", "169700", "85372", "cup, cooked") },
  },
  {
    // Pasta witte gem gekookt ("Pasta white average cooked") -- USDA's
    // cooked-pasta cup weight still varies by shape (105-151 g across the
    // "not packed" rows below), though far less than dry pasta's 64-122 g
    // range (which is why raw pasta stays rejected, see header). "cup
    // elbows not packed" (120 g) was picked as the representative "average"
    // shape -- close to the not-packed-shapes' mean (~112 g) and the shape
    // most diet-tracking references default to for unqualified "pasta".
    // Flagged as a judgment call.
    nevoCode: "659", usdaFdcId: "169737",
    usdaDescription: "Pasta, cooked, enriched, without added salt",
    units: { cup: portion("sr_legacy", "169737", "85422", "cup elbows not packed") },
  },
  {
    // Pasta volkoren gekookt ("Pasta wholemeal cooked") -- same shape
    // judgment call as 659 above, same shape (elbows) for consistency;
    // whole-wheat's elbow row isn't split into packed/not-packed.
    nevoCode: "2157", usdaFdcId: "168910",
    usdaDescription: "Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program)",
    units: { cup: portion("sr_legacy", "168910", "83965", "cup elbows") },
  },
  {
    nevoCode: "3200", usdaFdcId: "170287",
    usdaDescription: "Bulgur, cooked",
    units: {
      cup: portion("sr_legacy", "170287", "86370", "cup"),
      tablespoon: portion("sr_legacy", "170287", "86371", "tbsp"),
    },
  },
  {
    nevoCode: "963", usdaFdcId: "170420",
    usdaDescription: "Peas, green, cooked, boiled, drained, without salt",
    units: { cup: portion("sr_legacy", "170420", "86614", "cup") },
  },
  {
    nevoCode: "2900", usdaFdcId: "169214",
    usdaDescription: "Corn, sweet, yellow, canned, whole kernel, drained solids",
    units: { cup: portion("sr_legacy", "169214", "84446", "cup") },
  },
  {
    nevoCode: "57", usdaFdcId: "169999",
    usdaDescription: "Corn, sweet, yellow, cooked, boiled, drained, without salt",
    units: { cup: portion("sr_legacy", "169999", "85853", "cup cut") },
  },
];

// 26 genuine liquids -> one `milliliter` row each, density = (grams for
// USDA's "1 cup" row) / 240. See header for the rejected candidates
// (wine, molasses, grape/cranberry juice, Worcestershire).
export const LIQUID_PAIRINGS: readonly LiquidPairing[] = [
  {
    nevoCode: "279", usdaFdcId: "172217",
    usdaDescription: "Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D",
    cup: portion("sr_legacy", "172217", "90101", "cup"),
  },
  {
    nevoCode: "286", usdaFdcId: "172205",
    usdaDescription: "Milk, reduced fat, fluid, 2% milkfat, without added vitamin A and vitamin D",
    cup: portion("sr_legacy", "172205", "90080", "cup"),
  },
  {
    nevoCode: "294", usdaFdcId: "173432",
    usdaDescription: "Milk, nonfat, fluid, without added vitamin A and vitamin D (fat free or skim)",
    cup: portion("sr_legacy", "173432", "92516", "cup"),
  },
  {
    nevoCode: "289", usdaFdcId: "172225",
    usdaDescription: "Milk, buttermilk, fluid, whole",
    cup: portion("sr_legacy", "172225", "90117", "cup"),
  },
  {
    nevoCode: "278", usdaFdcId: "2705418",
    usdaDescription: "Yogurt, whole milk, plain",
    cup: portion("fndds", "2705418", "290676", "1 cup"),
  },
  {
    nevoCode: "2290", usdaFdcId: "2705413",
    usdaDescription: "Coconut milk",
    cup: portion("fndds", "2705413", "290648", "1 cup"),
  },
  {
    // Room slag- onbereid ("Cream whipping unprepared") -> raw heavy cream, not yet whipped.
    nevoCode: "299", usdaFdcId: "2705597",
    usdaDescription: "Cream, heavy",
    cup: portion("fndds", "2705597", "291179", "1 cup"),
  },
  {
    nevoCode: "812", usdaFdcId: "171257",
    usdaDescription: "Cream, sour, cultured",
    cup: portion("sr_legacy", "171257", "88297", "cup"),
  },
  {
    // Room kook- ("Cooking cream", ~15% fat in NL) -> half and half (10-18% fat), closest USDA analog.
    nevoCode: "2275", usdaFdcId: "2705594",
    usdaDescription: "Cream, half and half",
    cup: portion("fndds", "2705594", "291165", "1 cup"),
  },
  {
    nevoCode: "293", usdaFdcId: "2705600",
    usdaDescription: "Coffee creamer, liquid",
    cup: portion("fndds", "2705600", "291189", "1 cup"),
  },
  {
    nevoCode: "443", usdaFdcId: "169640",
    usdaDescription: "Honey",
    cup: portion("sr_legacy", "169640", "85264", "cup"),
  },
  {
    nevoCode: "3063", usdaFdcId: "169661",
    usdaDescription: "Syrups, maple",
    cup: portion("sr_legacy", "169661", "85305", "cup"),
  },
  {
    // Stroop schenk- ("Golden/pouring syrup") -> table blends pancake syrup, the closest generic pourable syrup.
    nevoCode: "3242", usdaFdcId: "169578",
    usdaDescription: "Syrups, table blends, pancake",
    cup: portion("sr_legacy", "169578", "85145", "cup"),
  },
  {
    // Stroop maismout- ("Syrup corn") -> light corn syrup.
    nevoCode: "1652", usdaFdcId: "168837",
    usdaDescription: "Syrups, corn, light",
    cup: portion("sr_legacy", "168837", "83864", "cup"),
  },
  {
    nevoCode: "2615", usdaFdcId: "172237",
    usdaDescription: "Vinegar, distilled",
    cup: portion("sr_legacy", "172237", "90137", "cup"),
  },
  {
    nevoCode: "5253", usdaFdcId: "172241",
    usdaDescription: "Vinegar, balsamic",
    cup: portion("sr_legacy", "172241", "90146", "cup"),
  },
  {
    nevoCode: "5470", usdaFdcId: "174277",
    usdaDescription: "Soy sauce made from soy and wheat (shoyu)",
    cup: portion("sr_legacy", "174277", "94070", "cup"),
  },
  {
    nevoCode: "601", usdaFdcId: "171413",
    usdaDescription: "Oil, olive, salad or cooking",
    cup: portion("sr_legacy", "171413", "88668", "cup"),
  },
  {
    nevoCode: "317", usdaFdcId: "171017",
    usdaDescription: "Oil, sunflower, linoleic (less than 60%)",
    cup: portion("sr_legacy", "171017", "87781", "cup"),
  },
  {
    nevoCode: "383", usdaFdcId: "173933",
    usdaDescription: "Apple juice, canned or bottled, unsweetened, without added ascorbic acid",
    cup: portion("sr_legacy", "173933", "93494", "cup"),
  },
  {
    nevoCode: "410", usdaFdcId: "169099",
    usdaDescription: "Orange juice, canned, unsweetened",
    cup: portion("sr_legacy", "169099", "84234", "cup"),
  },
  {
    nevoCode: "1127", usdaFdcId: "167747",
    usdaDescription: "Lemon juice, raw",
    cup: portion("sr_legacy", "167747", "81887", "cup"),
  },
  {
    nevoCode: "413", usdaFdcId: "170545",
    usdaDescription: "Tomato juice, canned, without salt added",
    cup: portion("sr_legacy", "170545", "86828", "cup"),
  },
  {
    nevoCode: "281", usdaFdcId: "171275",
    usdaDescription: "Milk, canned, condensed, sweetened",
    cup: portion("sr_legacy", "171275", "88342", "cup"),
  },
  {
    nevoCode: "1885", usdaFdcId: "2710707",
    usdaDescription: "Water, tap",
    cup: portion("fndds", "2710707", "312220", "1 cup"),
  },
  {
    // Bouillon v blokje bereid ("Stock from cube prepared", generic) ->
    // paired to USDA's chicken stock specifically, the closest available
    // "prepared savoury stock" analog (USDA has no generic/vegetable
    // stock cup row). Density-wise a prepared stock is essentially water,
    // so the beef/chicken/fish distinction barely moves the number (all
    // 233-240 g/cup) -- flagged as the least certain pairing in this set.
    nevoCode: "1528", usdaFdcId: "172884",
    usdaDescription: "Soup, stock, chicken, home-prepared",
    cup: portion("sr_legacy", "172884", "91631", "cup"),
  },
];

export const FNDDS_SOURCE = "USDA-FNDDS";
export const FNDDS_SOURCE_VERSION = "2024-10-31";
export const SR_LEGACY_SOURCE = "USDA-SR-Legacy";
export const SR_LEGACY_SOURCE_VERSION = "2018-04";

function sourceFor(bundle: UsdaBundle): { source: string; sourceVersion: string } {
  return bundle === "fndds"
    ? { source: FNDDS_SOURCE, sourceVersion: FNDDS_SOURCE_VERSION }
    : { source: SR_LEGACY_SOURCE, sourceVersion: SR_LEGACY_SOURCE_VERSION };
}

// ============================================================================
// CSV reading + defensive lookups
// ============================================================================

/**
 * Minimal RFC-4180 comma-delimited parser, quote-aware so a literal comma
 * inside a quoted field (e.g. "Almonds, unsalted") doesn't get split apart.
 * Same state machine as import-nevo-portions.ts's parseDelimitedText
 * (itself borrowed from import-nevo.ts), parameterised by delimiter there
 * too; duplicated here rather than imported so this script has no
 * import-time dependency on a different, git-ignored CSV directory.
 */
function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyField = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      sawAnyField = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
      sawAnyField = true;
    } else if (char === "\r") {
      // skip -- CRLF line endings
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawAnyField = false;
    } else {
      field += char;
      sawAnyField = true;
    }
  }
  if (sawAnyField || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCsv(text: string): Record<string, string>[] {
  const withoutBom = text.startsWith("﻿") ? text.slice(1) : text;
  const table = parseDelimitedText(withoutBom, ",");
  if (table.length === 0) return [];
  const [header, ...body] = table;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => {
      const record: Record<string, string> = {};
      header.forEach((key, index) => {
        record[key] = cells[index] ?? "";
      });
      return record;
    });
}

export interface FoodPortionRow {
  id: string;
  fdcId: string;
  amount: string;
  portionDescription: string;
  modifier: string;
  gramWeight: string;
}

/** food.csv -> Map<fdc_id, description>. */
export function readFoodDescriptions(csvText: string): Map<string, string> {
  const rows = parseCsv(csvText);
  return new Map(rows.map((row) => [row.fdc_id, row.description] as const));
}

/** food_portion.csv -> Map<portion id, row>, keyed by the CSV's own primary key. */
export function readFoodPortions(csvText: string): Map<string, FoodPortionRow> {
  const rows = parseCsv(csvText);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        fdcId: row.fdc_id,
        amount: row.amount,
        portionDescription: row.portion_description,
        modifier: row.modifier,
        gramWeight: row.gram_weight,
      },
    ]),
  );
}

/** Thrown by resolvePortionGrams when a curated PortionRef no longer
 * matches the CSVs it was read from -- e.g. a different USDA vintage.
 * Deliberately loud rather than a silent fallback (see file header). */
export class PortionMismatchError extends Error {
  constructor(message: string) {
    super(`import-usda-unit-masses: ${message}`);
    this.name = "PortionMismatchError";
  }
}

export interface FoodTables {
  descriptions: Map<string, string>;
  portions: Map<string, FoodPortionRow>;
}

/**
 * Resolves one curated PortionRef against the real CSV tables, asserting
 * the three invariants the file header describes (fdc_id match,
 * description match, portion-description-or-modifier label match) before
 * trusting the row's gram_weight. Throws PortionMismatchError on any
 * mismatch rather than returning a possibly-wrong number.
 */
export function resolvePortionGrams(
  tables: FoodTables,
  ref: PortionRef,
  expectedDescription: string,
): number {
  const row = tables.portions.get(ref.portionId);
  if (!row) {
    throw new PortionMismatchError(
      `no food_portion.csv row with id ${ref.portionId} (bundle ${ref.bundle}, expected fdc_id ${ref.fdcId})`,
    );
  }
  if (row.fdcId !== ref.fdcId) {
    throw new PortionMismatchError(
      `portion id ${ref.portionId} belongs to fdc_id ${row.fdcId}, expected ${ref.fdcId}`,
    );
  }
  const actualDescription = tables.descriptions.get(ref.fdcId);
  if (actualDescription !== expectedDescription) {
    throw new PortionMismatchError(
      `fdc_id ${ref.fdcId} description is ${JSON.stringify(actualDescription)}, expected ${JSON.stringify(expectedDescription)}`,
    );
  }
  const actualLabel = (row.portionDescription || row.modifier).trim();
  if (actualLabel !== ref.label) {
    throw new PortionMismatchError(
      `portion id ${ref.portionId} label is ${JSON.stringify(actualLabel)}, expected ${JSON.stringify(ref.label)}`,
    );
  }
  const grams = Number(row.gramWeight);
  if (!Number.isFinite(grams)) {
    throw new PortionMismatchError(
      `portion id ${ref.portionId} has a non-numeric gram_weight ${JSON.stringify(row.gramWeight)}`,
    );
  }
  return grams;
}

function roundTo4dp(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

// ============================================================================
// Row building + SQL emission
// ============================================================================

export interface UnitMassRow {
  nevoCode: string;
  unit: SolidUnit | "milliliter";
  grams: number;
  source: string;
  sourceVersion: string;
}

export function buildSolidRows(tables: Record<UsdaBundle, FoodTables>, pairings: readonly SolidPairing[]): UnitMassRow[] {
  const rows: UnitMassRow[] = [];
  for (const pairing of pairings) {
    for (const [unit, ref] of Object.entries(pairing.units) as [SolidUnit, PortionRef][]) {
      const grams = resolvePortionGrams(tables[ref.bundle], ref, pairing.usdaDescription);
      rows.push({ nevoCode: pairing.nevoCode, unit, grams, ...sourceFor(ref.bundle) });
    }
  }
  return rows;
}

export function buildLiquidRows(tables: Record<UsdaBundle, FoodTables>, pairings: readonly LiquidPairing[]): UnitMassRow[] {
  return pairings.map((pairing) => {
    const cupGrams = resolvePortionGrams(tables[pairing.cup.bundle], pairing.cup, pairing.usdaDescription);
    const density = roundTo4dp(cupGrams / 240);
    return { nevoCode: pairing.nevoCode, unit: "milliliter", grams: density, ...sourceFor(pairing.cup.bundle) };
  });
}

/** Escapes single quotes for a SQL string literal (same convention as import-nevo.ts's escapeSqlString). */
export function escapeSqlString(raw: string): string {
  return raw.replace(/'/g, "''");
}

function unitMassRowToSqlTuple(row: UnitMassRow): string {
  return (
    `  ('${escapeSqlString(row.nevoCode)}', '${row.unit}', ${row.grams}, ` +
    `'${escapeSqlString(row.source)}', '${escapeSqlString(row.sourceVersion)}')`
  );
}

/**
 * Full set-based `insert into reference.ingredient_unit_masses (...) select
 * ... from (values ...) as v (...) join reference.ingredients ...`
 * statement for every row, source/source_version carried per-row (unlike
 * import-nevo-portions.ts's single-source statement) because this seed
 * spans two distinct USDA bundles. FK resolution is by NEVO code
 * (source_ref) against reference.ingredients, never a hardcoded UUID.
 */
export function buildInsertStatement(rows: readonly UnitMassRow[]): string {
  const sorted = [...rows].sort(
    (a, b) => Number(a.nevoCode) - Number(b.nevoCode) || a.unit.localeCompare(b.unit),
  );
  const tuples = sorted.map(unitMassRowToSqlTuple).join(",\n");
  return (
    `insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)\n` +
    `select ri.id, v.unit::public.recipe_unit, v.grams, v.source, v.source_version\n` +
    `from (values\n${tuples}\n) as v (source_ref, unit, grams, source, source_version)\n` +
    `join reference.ingredients ri\n` +
    `  on ri.source = 'NEVO-online' and ri.source_ref = v.source_ref;\n`
  );
}

// ============================================================================
// main() -- only exercised at the CLI, not by the unit tests.
// ============================================================================

// fileURLToPath, not `new URL(...).pathname`: this repo's path contains a
// space ("Personal Dashboard"), which .pathname would leave
// percent-encoded (see import-nevo.ts for the same note).
const DEFAULT_USDA_DIR = fileURLToPath(new URL("../usda", import.meta.url));

function loadBundle(baseDir: string, subdir: string): FoodTables {
  const dir = join(baseDir, subdir);
  const descriptions = readFoodDescriptions(readFileSync(join(dir, "food.csv"), "utf-8"));
  const portions = readFoodPortions(readFileSync(join(dir, "food_portion.csv"), "utf-8"));
  return { descriptions, portions };
}

function main() {
  const baseDir = process.argv[2] ?? DEFAULT_USDA_DIR;
  const tables: Record<UsdaBundle, FoodTables> = {
    fndds: loadBundle(join(baseDir, "fndds"), "FoodData_Central_survey_food_csv_2024-10-31"),
    sr_legacy: loadBundle(join(baseDir, "sr_legacy"), "FoodData_Central_sr_legacy_food_csv_2018-04"),
  };

  const solidRows = buildSolidRows(tables, SOLID_PAIRINGS);
  const liquidRows = buildLiquidRows(tables, LIQUID_PAIRINGS);
  const allRows = [...solidRows, ...liquidRows];

  process.stdout.write(buildInsertStatement(allRows));
  console.error(
    `import-usda-unit-masses: ${SOLID_PAIRINGS.length} solid staples ` +
      `(${solidRows.length} rows across cup/tablespoon/teaspoon), ` +
      `${LIQUID_PAIRINGS.length} liquids (${liquidRows.length} milliliter rows), ` +
      `${allRows.length} rows total.`,
  );
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
