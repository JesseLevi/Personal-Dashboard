import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIQUID_PAIRINGS,
  SOLID_PAIRINGS,
  buildLiquidRows,
  buildSolidRows,
  readFoodDescriptions,
  readFoodPortions,
  type FoodTables,
  type PortionRef,
  type UsdaBundle,
} from "../scripts/import-usda-unit-masses";

// Unit tests for #164/#157's USDA unit-mass import script's follow-up
// (prepared/canned staples). Covers the invariants the curation rules in
// that script's own header call out by name -- no duplicate (nevoCode,
// unit) pair, no portionId reused under a different identity, every
// PortionRef.fdcId matching its pairing's usdaFdcId, and the sanity gates
// (g/cup in [25, 330], density in [0.6, 1.5]) -- against the real curated
// SOLID_PAIRINGS/LIQUID_PAIRINGS tables, modeled on
// tests/import-nevo-portions.test.ts. The structural invariants below need
// no CSV data at all. The one invariant that needs actual resolved gram
// values (the sanity gates) is guarded to skip when the git-ignored
// upstream USDA CSVs aren't present on disk (CI never has them, see
// .gitignore) rather than requiring them to run.

function allPortionRefs(): { pairingNevoCode: string; usdaFdcId: string; ref: PortionRef }[] {
  const refs: { pairingNevoCode: string; usdaFdcId: string; ref: PortionRef }[] = [];
  for (const pairing of SOLID_PAIRINGS) {
    for (const ref of Object.values(pairing.units)) {
      refs.push({ pairingNevoCode: pairing.nevoCode, usdaFdcId: pairing.usdaFdcId, ref: ref! });
    }
  }
  for (const pairing of LIQUID_PAIRINGS) {
    refs.push({ pairingNevoCode: pairing.nevoCode, usdaFdcId: pairing.usdaFdcId, ref: pairing.cup });
  }
  return refs;
}

describe("SOLID_PAIRINGS + LIQUID_PAIRINGS structural invariants", () => {
  it("has no duplicate (nevoCode, unit) pair -- the unique constraint on ingredient_unit_masses would reject it", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const pairing of SOLID_PAIRINGS) {
      for (const unit of Object.keys(pairing.units)) {
        const key = `${pairing.nevoCode}:${unit}`;
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
      }
    }
    for (const pairing of LIQUID_PAIRINGS) {
      const key = `${pairing.nevoCode}:milliliter`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it("never reuses a portionId under a different (bundle, fdcId, label) -- a shared id must be the exact same reference, not a collision", () => {
    const byPortionId = new Map<string, PortionRef>();
    const mismatches: string[] = [];

    for (const { ref } of allPortionRefs()) {
      const key = `${ref.bundle}:${ref.portionId}`;
      const prior = byPortionId.get(key);
      if (prior) {
        const identical = prior.fdcId === ref.fdcId && prior.label === ref.label;
        if (!identical) {
          mismatches.push(
            `portionId ${key} used for both fdc_id ${prior.fdcId} (${JSON.stringify(prior.label)}) and fdc_id ${ref.fdcId} (${JSON.stringify(ref.label)})`,
          );
        }
      } else {
        byPortionId.set(key, ref);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("every PortionRef.fdcId equals its pairing's usdaFdcId", () => {
    const mismatches = allPortionRefs()
      .filter(({ usdaFdcId, ref }) => ref.fdcId !== usdaFdcId)
      .map(({ pairingNevoCode, usdaFdcId, ref }) => `nevoCode ${pairingNevoCode}: ref.fdcId ${ref.fdcId} !== usdaFdcId ${usdaFdcId}`);

    expect(mismatches).toEqual([]);
  });

  it("gives every SolidPairing at least a cup unit", () => {
    const missingCup = SOLID_PAIRINGS.filter((p) => !p.units.cup).map((p) => p.nevoCode);
    expect(missingCup).toEqual([]);
  });
});

// ============================================================================
// Sanity gates against real resolved gram values -- needs the git-ignored
// upstream CSVs (see .gitignore, scripts/import-usda-unit-masses.ts's own
// header for the download links). Skips instead of failing when they're
// absent, the same reason tests/import-nevo-portions.test.ts never reads
// its 26 real CSVs at all: CI has no access to them.
// ============================================================================

const USDA_DIR = join(__dirname, "..", "usda");
const FNDDS_DIR = join(USDA_DIR, "fndds", "FoodData_Central_survey_food_csv_2024-10-31");
const SR_LEGACY_DIR = join(USDA_DIR, "sr_legacy", "FoodData_Central_sr_legacy_food_csv_2018-04");
const csvsPresent =
  existsSync(join(FNDDS_DIR, "food.csv")) &&
  existsSync(join(FNDDS_DIR, "food_portion.csv")) &&
  existsSync(join(SR_LEGACY_DIR, "food.csv")) &&
  existsSync(join(SR_LEGACY_DIR, "food_portion.csv"));

function loadBundle(dir: string): FoodTables {
  return {
    descriptions: readFoodDescriptions(readFileSync(join(dir, "food.csv"), "utf-8")),
    portions: readFoodPortions(readFileSync(join(dir, "food_portion.csv"), "utf-8")),
  };
}

describe.skipIf(!csvsPresent)("sanity gates against real resolved gram values (needs local usda/ CSVs)", () => {
  const tables: Record<UsdaBundle, FoodTables> = {
    fndds: loadBundle(FNDDS_DIR),
    sr_legacy: loadBundle(SR_LEGACY_DIR),
  };

  // NEVO 630 (popcorn, air-popped) pre-dates this test and this ticket's
  // prepared/canned follow-up -- its 8 g/cup is a real, correct
  // food_portion.csv value (popped corn is mostly air), just below the
  // [25, 330] g/cup range the header describes for the rest of the table.
  // Documented here as a known exception rather than silently loosening
  // the gate for every row, or touching a pre-existing pairing this
  // ticket's scope excludes.
  const KNOWN_SOLID_GATE_EXCEPTIONS = new Set(["630"]);

  it("every solid cup row's grams falls within [25, 330] g/cup (documented exceptions aside)", () => {
    const rows = buildSolidRows(tables, SOLID_PAIRINGS);
    const cupRows = rows.filter((r) => r.unit === "cup" && !KNOWN_SOLID_GATE_EXCEPTIONS.has(r.nevoCode));
    expect(cupRows.length).toBeGreaterThan(0);
    const outOfRange = cupRows.filter((r) => r.grams < 25 || r.grams > 330);
    expect(outOfRange).toEqual([]);
  });

  it("every liquid row's density falls within [0.6, 1.5] g/ml", () => {
    const rows = buildLiquidRows(tables, LIQUID_PAIRINGS);
    expect(rows.length).toBe(LIQUID_PAIRINGS.length);
    const outOfRange = rows.filter((r) => r.grams < 0.6 || r.grams > 1.5);
    expect(outOfRange).toEqual([]);
  });

  it("resolves without throwing PortionMismatchError against the currently-downloaded CSV vintage", () => {
    expect(() => buildSolidRows(tables, SOLID_PAIRINGS)).not.toThrow();
    expect(() => buildLiquidRows(tables, LIQUID_PAIRINGS)).not.toThrow();
  });
});
