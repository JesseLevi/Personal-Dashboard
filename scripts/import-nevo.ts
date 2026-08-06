#!/usr/bin/env -S npx tsx
// Reads the upstream NEVO-online CSV and emits the `insert into
// reference.ingredients (...)` statement seeded by
// supabase/migrations/20260806000001_nevo_nutrition_import.sql (#161,
// executing ADR-0013: docs/decisions/0013-nevo-nutrition-import.md §5).
// Committed per ADR-0013 §5: the next NEVO version is a re-run of this
// script, not an archaeology exercise, and the parsing rules below are
// tested in isolation (tests/import-nevo.test.ts) without needing the
// 108 MB raw CSV directory present (git-ignored, see .gitignore).
//
// Usage: npx tsx scripts/import-nevo.ts [path/to/NEVO2025_v9.0.csv] > out.sql
// Defaults to ./NEVO2025_v9.0/NEVO2025_v9.0.csv (this repo's git-ignored
// download location) when no path is given.
//
// Two parsing rules ADR-0013 §5 calls out by name, both verified against the
// real file rather than assumed (see the ADR for the measured counts):
// - The decimal separator is a comma ("12,3") -- parsed naively as a point
//   it silently truncates ("1,8" -> 1).
// - Empty means unknown: FIBT (g) is empty for exactly 7 of 2328 rows, and
//   those become SQL NULL, never 0 (ADR-0011 §4, unchanged by ADR-0013).

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// ============================================================================
// CSV shape -- only the columns this import actually reads. The real file
// carries ~140 nutrient columns (ADR-0013 §3 takes five deliberately); an
// index signature keeps TypeScript honest that a parsed row may carry more
// keys than this interface names, without widening every field to `any`.
// ============================================================================

export interface NevoCsvRow {
  "NEVO-code": string;
  "Voedingsmiddelnaam/Dutch food name": string;
  "Engelse naam/Food name": string;
  "Voedingsmiddelgroep": string;
  "Food group": string;
  "Hoeveelheid/Quantity": string;
  "ENERCC (kcal)": string;
  "PROT (g)": string;
  "CHO (g)": string;
  "FAT (g)": string;
  "FIBT (g)": string;
  [otherColumn: string]: string;
}

export type NutrientBasis = "per_100g" | "per_100ml";

export interface IngredientSeed {
  nevoCode: string;
  nameNl: string;
  nameEn: string | null;
  categoryNl: string | null;
  categoryEn: string | null;
  nutrientBasis: NutrientBasis;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
}

// Fixed per ADR-0013's decision (not read off the CSV's own
// "NEVO-versie/NEVO-version" column, which spells it "NEVO-Online 2025 9.0"
// -- source/source_version describe *this project's* attribution string,
// the one ADR-0013 §2 requires to appear in the UI, not a verbatim echo of
// the upstream field).
export const NEVO_SOURCE = "NEVO-online";
export const NEVO_SOURCE_VERSION = "2025/9.0";

// ============================================================================
// Pure parsing functions -- unit-tested directly (tests/import-nevo.test.ts),
// no CSV file required.
// ============================================================================

/**
 * NEVO numbers use a comma decimal separator ("12,3", "1,8"). A naive
 * `parseFloat` on "1,8" reads "1" and silently drops the rest -- a 44% error
 * ADR-0013 §5 names explicitly. Throws on anything that isn't a valid
 * number after the comma->point swap, rather than returning NaN silently.
 */
export function parseNevoDecimal(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  const value = Number(normalized);
  if (normalized === "" || Number.isNaN(value)) {
    throw new Error(`import-nevo: not a valid NEVO decimal: ${JSON.stringify(raw)}`);
  }
  return value;
}

/**
 * Same as `parseNevoDecimal`, except an empty field means "unknown" and
 * becomes `null` -- never `0` (ADR-0011 §4). FIBT (g) is the only column
 * this import reads where that happens (7 of 2328 rows).
 */
export function parseNullableNevoDecimal(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parseNevoDecimal(raw);
}

/**
 * Maps NEVO's "Hoeveelheid/Quantity" free-text column to the
 * `nutrient_basis` enum-like check constraint (ADR-0013 §4). Throws on any
 * value other than the two verified against the real file, rather than
 * defaulting to `per_100g` and silently mislabelling a future NEVO version's
 * new basis.
 */
export function mapNutrientBasis(raw: string): NutrientBasis {
  const trimmed = raw.trim();
  if (trimmed === "per 100g") return "per_100g";
  if (trimmed === "per 100ml") return "per_100ml";
  throw new Error(`import-nevo: unexpected Hoeveelheid/Quantity value: ${JSON.stringify(raw)}`);
}

/** Empty-string-safe trim: NEVO leaves several free-text columns blank for many rows (e.g. no English category). Blank means NULL, not `""`. */
function trimToNullable(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Maps one parsed CSV row to the shape the migration's INSERT needs.
 * Deterministic and side-effect free -- the only place row-shape decisions
 * live, so tests can feed fixture rows without touching the real 1.7 MB CSV.
 */
export function mapNevoRowToIngredientSeed(row: NevoCsvRow): IngredientSeed {
  return {
    nevoCode: row["NEVO-code"].trim(),
    nameNl: row["Voedingsmiddelnaam/Dutch food name"].trim(),
    nameEn: trimToNullable(row["Engelse naam/Food name"]),
    categoryNl: trimToNullable(row["Voedingsmiddelgroep"]),
    categoryEn: trimToNullable(row["Food group"]),
    nutrientBasis: mapNutrientBasis(row["Hoeveelheid/Quantity"]),
    kcalPer100: parseNevoDecimal(row["ENERCC (kcal)"]),
    proteinPer100: parseNevoDecimal(row["PROT (g)"]),
    carbsPer100: parseNevoDecimal(row["CHO (g)"]),
    fatPer100: parseNevoDecimal(row["FAT (g)"]),
    fiberPer100: parseNullableNevoDecimal(row["FIBT (g)"]),
  };
}

/** Escapes single quotes for a SQL string literal ('' per the standard, same as the hand-curated seed's `Gamba''s` in 20260730000001_ingredient_library.sql). Doesn't quote/wrap -- callers do that, so the same escaper serves both string and nullable-string formatting below. */
export function escapeSqlString(raw: string): string {
  return raw.replace(/'/g, "''");
}

function sqlString(value: string): string {
  return `'${escapeSqlString(value)}'`;
}

function sqlNullableString(value: string | null): string {
  return value === null ? "null" : sqlString(value);
}

function sqlNullableNumber(value: number | null): string {
  return value === null ? "null" : String(value);
}

/** One row of the INSERT's `values` list, columns in the exact order `buildInsertStatement`'s header declares. */
export function ingredientSeedToSqlRow(seed: IngredientSeed): string {
  const values = [
    sqlString(seed.nameNl),
    sqlNullableString(seed.nameEn),
    sqlNullableString(seed.categoryNl),
    sqlNullableString(seed.categoryEn),
    `'${seed.nutrientBasis}'`,
    String(seed.kcalPer100),
    String(seed.proteinPer100),
    String(seed.carbsPer100),
    String(seed.fatPer100),
    sqlNullableNumber(seed.fiberPer100),
    sqlString(NEVO_SOURCE),
    sqlString(seed.nevoCode),
    sqlString(NEVO_SOURCE_VERSION),
  ];
  return `  (${values.join(", ")})`;
}

/** Full `insert into reference.ingredients (...) values (...), (...), ...;` statement for every seed, deterministically ordered by whatever order `seeds` is already in (the caller sorts by NEVO-code numerically -- see `main` below). */
export function buildInsertStatement(seeds: readonly IngredientSeed[]): string {
  const columns = [
    "name_nl",
    "name_en",
    "category_nl",
    "category_en",
    "nutrient_basis",
    "kcal_per_100g",
    "protein_g_per_100g",
    "carbs_g_per_100g",
    "fat_g_per_100g",
    "fiber_g_per_100g",
    "source",
    "source_ref",
    "source_version",
  ];
  const header = `insert into reference.ingredients (\n  ${columns.join(", ")}\n) values\n`;
  const rows = seeds.map(ingredientSeedToSqlRow).join(",\n");
  return `${header}${rows};\n`;
}

// ============================================================================
// CSV reading -- only exercised by `main` below, not by the unit tests.
// ============================================================================

/**
 * Minimal pipe-delimited, double-quoted CSV parser (RFC-4180 quoting rules,
 * "|" instead of ",", "" as the escaped quote). Handwritten rather than a
 * new dependency: NEVO's export is small (1.7 MB) and the quoting is
 * regular, so a small state machine is cheaper than auditing a library's
 * behaviour against this exact dialect.
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

/** Parses the raw CSV text (utf-8-sig, so a leading BOM is stripped first) into header-keyed row objects. */
function parseNevoCsv(text: string): NevoCsvRow[] {
  const withoutBom = text.startsWith("﻿") ? text.slice(1) : text;
  const table = parseDelimitedText(withoutBom, "|");
  if (table.length === 0) return [];
  const [header, ...body] = table;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => {
      const record: Record<string, string> = {};
      header.forEach((key, index) => {
        record[key] = cells[index] ?? "";
      });
      return record as NevoCsvRow;
    });
}

const DEFAULT_CSV_PATH = fileURLToPath(
  new URL("../NEVO2025_v9.0/NEVO2025_v9.0.csv", import.meta.url),
);

function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV_PATH;
  const text = readFileSync(csvPath, "utf-8");
  const rows = parseNevoCsv(text);
  // Deterministic, stable order (spec requirement): numeric NEVO-code
  // ascending, not CSV file order or string sort ("10" < "2" lexically).
  const sortedRows = [...rows].sort(
    (a, b) => Number(a["NEVO-code"]) - Number(b["NEVO-code"]),
  );
  const seeds = sortedRows.map(mapNevoRowToIngredientSeed);
  process.stdout.write(buildInsertStatement(seeds));
  console.error(`import-nevo: emitted ${seeds.length} rows from ${rows.length} CSV rows.`);
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
