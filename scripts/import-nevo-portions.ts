#!/usr/bin/env -S npx tsx
// Reads the upstream NEVO Portie-online CSVs (26 files, one per food group)
// and emits the `insert into reference.ingredient_unit_masses (...)`
// statement pasted into
// supabase/migrations/20260806000002_nevo_unit_masses.sql (#163, executing
// ADR-0013: docs/decisions/0013-nevo-nutrition-import.md, amended for this
// ticket). Structured like scripts/import-nevo.ts (#161): pure exported
// functions + a thin main(), so the mapping rules are unit-testable
// (tests/import-nevo-portions.test.ts) without the 26 git-ignored CSVs
// present.
//
// Usage: npx tsx scripts/import-nevo-portions.ts [path/to/Portie-online] > out.sql
// Defaults to ./NEVO2025_v9.0/Portie-online (this repo's git-ignored
// download location, same directory as import-nevo.ts's source file) when
// no path is given.
//
// Scope is Layer 1 only (measures -> grams); density/volume (#163's ticket
// body, ADR-0011 §3) is a separate future ticket and out of scope here.
//
// Mapping rules, all measured against the real files rather than assumed
// (see the #163 issue body for the exact counts):
// - Only `Eenheid = 'gram'` rows carry a mass; `ml` rows are volume
//   portions and are Layer 2 (2249 of 11547 rows, verified).
// - Only three `Maat` values (plus their tier-2/3 variants) map to a unit,
//   because only these units exist in both NEVO and public.recipe_unit:
//   eetlepel, theelepel, stuk. See MAAT_TO_UNIT below for the exact table.
// - Matching is EXACT STRING, never substring/LIKE: "bak bioscoop klein"
//   (a cinema popcorn tub) must never match on "scoop".
// - `opgehoopt` (heaped) and multi-count measures ("4 theelepels") are
//   deliberately absent from MAAT_TO_UNIT -- their Hoeveelheid covers
//   several spoons/pieces, not one.
// - Per NEVO-code, the lowest tier present wins; tier 2/3 is only
//   consulted when tier 1 is absent for that (code, unit) pair.
// - Conflicts (several rows at the same winning tier with different
//   Hoeveelheid) are skipped entirely, never averaged -- ADR-0011 §4:
//   unknown stays unknown.
// - Rows with a blank NEVO-code (NEVO's own "generic product name" rows,
//   verified present in the real files) can never resolve to an ingredient
//   and are dropped before mapping.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

// ============================================================================
// CSV shape -- Productnaam;NEVO-code;NEVO-naam;Maat;Hoeveelheid;Eenheid;
// Maat-Toelichting, semicolon-delimited, utf-8-sig BOM, CRLF line endings.
// ============================================================================

export interface PortionCsvRow {
  Productnaam: string;
  "NEVO-code": string;
  "NEVO-naam": string;
  Maat: string;
  Hoeveelheid: string;
  Eenheid: string;
  "Maat-Toelichting": string;
}

/** The only three household-measure units NEVO and public.recipe_unit both carry (#163 issue body). */
export type PortionUnit = "eetlepel" | "theelepel" | "stuk";

export interface MaatMapping {
  unit: PortionUnit;
  tier: number;
}

export interface MappedPortionRow {
  nevoCode: string;
  unit: PortionUnit;
  tier: number;
  grams: number;
}

export interface UnitMassSeed {
  nevoCode: string;
  unit: PortionUnit;
  grams: number;
}

// Fixed per ADR-0013 §5's convention of a project-owned attribution string
// rather than a verbatim echo of an upstream field (mirrors NEVO_SOURCE /
// NEVO_SOURCE_VERSION in import-nevo.ts).
export const PORTION_SOURCE = "NEVO-portie-online";
export const PORTION_SOURCE_VERSION = "2025/9.0";

// ============================================================================
// Pure mapping functions -- unit-tested directly
// (tests/import-nevo-portions.test.ts), no CSV file required.
// ============================================================================

/**
 * Exact-match table from NEVO's `Maat` free-text column to
 * (public.recipe_unit, tier). Deliberately does NOT include: `opgehoopt`
 * variants, multi-count measures ("4 theelepels"), `snufje`, `scoop`,
 * `cup`, `teaspoon`, `tablespoon`, or any of NEVO's dozens of `stuks klein`
 * / `stuks groot` / size-qualified variants -- only the exact strings
 * verified against the real files (#163 issue body's mapping table).
 */
export const MAAT_TO_UNIT: Readonly<Record<string, MaatMapping>> = {
  eetlepel: { unit: "eetlepel", tier: 1 },
  "eetlepel afgestreken": { unit: "eetlepel", tier: 2 },
  "afgestreken eetlepel": { unit: "eetlepel", tier: 2 },
  "eetlepel (afgestreken)": { unit: "eetlepel", tier: 2 },
  "eetlepel (geraspt)": { unit: "eetlepel", tier: 3 },
  theelepel: { unit: "theelepel", tier: 1 },
  "theelepel afgestreken": { unit: "theelepel", tier: 2 },
  "theelepel (afgestreken)": { unit: "theelepel", tier: 2 },
  stuks: { unit: "stuk", tier: 1 },
  stuk: { unit: "stuk", tier: 1 },
  "stuks gemiddeld": { unit: "stuk", tier: 2 },
  "stuks middel": { unit: "stuk", tier: 2 },
};

/**
 * Looks up a `Maat` value by EXACT string match (after trimming
 * surrounding whitespace only -- no case folding, no substring matching).
 * Returns null for anything not in MAAT_TO_UNIT, which is the overwhelming
 * majority of NEVO's free-text `Maat` values by design.
 */
export function mapMaatToUnit(maat: string): MaatMapping | null {
  return MAAT_TO_UNIT[maat.trim()] ?? null;
}

/**
 * `Hoeveelheid` is a plain integer in every row of the real files
 * (verified -- no comma decimals here, unlike NEVO2025_v9.0.csv's nutrient
 * columns). Parses defensively and throws on anything unparseable rather
 * than coercing to 0 or NaN.
 */
export function parseHoeveelheidGrams(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `import-nevo-portions: not a plain integer Hoeveelheid: ${JSON.stringify(raw)}`,
    );
  }
  return Number(trimmed);
}

/**
 * Maps one parsed CSV row to a MappedPortionRow, or null if the row is out
 * of scope: `Eenheid` other than `gram` (volume portion, Layer 2), a blank
 * NEVO-code (can never resolve to an ingredient), or a `Maat` not in
 * MAAT_TO_UNIT. The only place row-inclusion decisions live, so tests feed
 * fixture rows without touching the real CSVs.
 */
export function mapCsvRowToMappedPortion(row: PortionCsvRow): MappedPortionRow | null {
  if (row.Eenheid.trim() !== "gram") return null;
  const nevoCode = row["NEVO-code"].trim();
  if (nevoCode === "") return null;
  const mapping = mapMaatToUnit(row.Maat);
  if (mapping === null) return null;
  return {
    nevoCode,
    unit: mapping.unit,
    tier: mapping.tier,
    grams: parseHoeveelheidGrams(row.Hoeveelheid),
  };
}

/**
 * Groups already-mapped rows by (nevoCode, unit), keeps only the lowest
 * tier present per group, and skips (drops entirely) any group whose
 * winning tier carries more than one distinct gram value -- a conflict
 * between several branded products under one NEVO-code, never averaged
 * (ADR-0011 §4: unknown stays unknown). Deterministically ordered by
 * numeric NEVO-code then unit name, independent of input order.
 */
export function resolveUnitMasses(rows: readonly MappedPortionRow[]): UnitMassSeed[] {
  const groups = new Map<string, MappedPortionRow[]>();
  for (const row of rows) {
    const key = `${row.nevoCode}|${row.unit}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const result: UnitMassSeed[] = [];
  for (const entries of groups.values()) {
    const minTier = Math.min(...entries.map((entry) => entry.tier));
    const atMinTier = entries.filter((entry) => entry.tier === minTier);
    const distinctGrams = new Set(atMinTier.map((entry) => entry.grams));
    if (distinctGrams.size > 1) continue; // conflict -- skip, never average
    result.push({
      nevoCode: entries[0].nevoCode,
      unit: entries[0].unit,
      grams: atMinTier[0].grams,
    });
  }

  return result.sort(
    (a, b) => Number(a.nevoCode) - Number(b.nevoCode) || a.unit.localeCompare(b.unit),
  );
}

/** Escapes single quotes for a SQL string literal (same convention as import-nevo.ts's escapeSqlString). */
export function escapeSqlString(raw: string): string {
  return raw.replace(/'/g, "''");
}

/** One `(source_ref, unit, grams)` tuple of the VALUES list. */
export function unitMassSeedToSqlTuple(seed: UnitMassSeed): string {
  return `  ('${escapeSqlString(seed.nevoCode)}', '${seed.unit}', ${seed.grams})`;
}

/**
 * Full set-based `insert into reference.ingredient_unit_masses (...) select
 * ... from (values ...) as v (...) join reference.ingredients ...`
 * statement for every seed. FK resolution is by NEVO-code (source_ref)
 * against reference.ingredients, never a hardcoded UUID -- a
 * (source_ref, unit) pair with no matching ingredient simply produces no
 * row via the join, which is the desired behaviour for the ~1.3% of Portie
 * codes not in the seed (#163 issue body).
 */
export function buildInsertStatement(seeds: readonly UnitMassSeed[]): string {
  const tuples = seeds.map(unitMassSeedToSqlTuple).join(",\n");
  return (
    `insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)\n` +
    `select ri.id, v.unit::public.recipe_unit, v.grams, '${PORTION_SOURCE}', '${PORTION_SOURCE_VERSION}'\n` +
    `from (values\n${tuples}\n) as v (source_ref, unit, grams)\n` +
    `join reference.ingredients ri\n` +
    `  on ri.source = 'NEVO-online' and ri.source_ref = v.source_ref;\n`
  );
}

// ============================================================================
// CSV reading -- only exercised by main() below, not by the unit tests.
// ============================================================================

/**
 * Minimal RFC-4180 delimited-text parser, quote-aware so a literal
 * delimiter inside a quoted field (verified present in the real files --
 * e.g. Brood.csv's `"snee Krentenwegge; snee Ketelbinkie"` Maat value)
 * doesn't get split apart. Same state machine as import-nevo.ts's
 * parseDelimitedText, parameterised by delimiter there too; duplicated
 * here rather than imported so this script has no import-time dependency
 * on import-nevo.ts's CSV (a different, git-ignored directory).
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

/** Parses one Portie-online CSV's raw text (utf-8-sig, leading BOM stripped) into header-keyed row objects. */
function parsePortionCsv(text: string): PortionCsvRow[] {
  const withoutBom = text.startsWith("﻿") ? text.slice(1) : text;
  const table = parseDelimitedText(withoutBom, ";");
  if (table.length === 0) return [];
  const [header, ...body] = table;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => {
      const record: Record<string, string> = {};
      header.forEach((key, index) => {
        record[key] = cells[index] ?? "";
      });
      return record as unknown as PortionCsvRow;
    });
}

// fileURLToPath, not `new URL(...).pathname`: this repo's path contains a
// space ("Personal Dashboard"), which .pathname would leave
// percent-encoded (see import-nevo.ts for the same note).
const DEFAULT_PORTIE_DIR = fileURLToPath(
  new URL("../NEVO2025_v9.0/Portie-online", import.meta.url),
);

function main() {
  const portieDir = process.argv[2] ?? DEFAULT_PORTIE_DIR;
  const csvFiles = readdirSync(portieDir)
    .filter((name) => name.endsWith(".csv"))
    .sort();

  const allRows: PortionCsvRow[] = [];
  for (const fileName of csvFiles) {
    const text = readFileSync(join(portieDir, fileName), "utf-8");
    allRows.push(...parsePortionCsv(text));
  }

  const mapped = allRows
    .map(mapCsvRowToMappedPortion)
    .filter((row): row is MappedPortionRow => row !== null);
  const seeds = resolveUnitMasses(mapped);

  process.stdout.write(buildInsertStatement(seeds));
  console.error(
    `import-nevo-portions: read ${csvFiles.length} CSVs, ${allRows.length} rows total, ` +
      `${mapped.length} rows mapped to a unit, emitted ${seeds.length} (nevo_code, unit) seeds.`,
  );
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
