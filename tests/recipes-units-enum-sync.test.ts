import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UNIT_CODES } from "../lib/recipes/units";

// Enum-sync tripwire for #119/#120 (see lib/recipes/units.ts's file-header
// comment for the full mechanism writeup). #119 will add
// `recipe_ingredients.unit` as a Postgres enum sourced from UNIT_CODES, and
// ADR-0011 §3's `ingredient_unit_masses.unit` must use the same codes.
// `lib/database.types.ts` is hand-written and has no `unit` enum today, and
// no recipe migration exists yet on this branch, so a type-level comparison
// against generated types would not compile -- there's nothing to compare
// against. Instead this test scans supabase/migrations/*.sql directly:
//
// - STRICT_ENUM_DECLARATION parses `create type <name> as enum (...)`
//   statements whose type name contains "unit", extracting the declared
//   values.
// - LOOSE_UNIT_ENUM_MENTION is a much looser detector for the same kind of
//   statement (just "create type ... unit ... as enum" in any order/
//   whitespace). If the loose detector finds more matches in a file than
//   the strict parser did, that means some declaration used a SQL shape
//   this parser doesn't understand -- the test fails loudly in that case
//   rather than silently reporting "no unit enum found" when one actually
//   exists. That failure mode is the whole point: a drifted or unparsed
//   enum must never look the same as "no enum yet".
//
// Until #119 lands, both detectors find nothing and this test passes
// trivially. The day #119's migration adds the enum, this starts asserting
// real equality against UNIT_CODES and fails on any drift (added, removed,
// renamed, or misspelled value).

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

const STRICT_ENUM_DECLARATION =
  /create\s+type\s+([a-z0-9_."]*unit[a-z0-9_."]*)\s+as\s+enum\s*\(([^)]*)\)/gi;

// No `\b` around "unit" itself: real enum type names embed it in a compound
// identifier (e.g. `recipe_unit`), where `_` is a word character and would
// defeat a `\bunit\b` boundary check.
const LOOSE_UNIT_ENUM_MENTION = /create\s+type\b[^;]*unit[^;]*\bas\s+enum\b/gi;

function countMatches(pattern: RegExp, text: string): number {
  const withGlobalFlag = new RegExp(pattern.source, pattern.flags);
  return [...text.matchAll(withGlobalFlag)].length;
}

interface UnitEnumDeclaration {
  file: string;
  name: string;
  values: string[];
}

function findUnitEnumDeclarations(): UnitEnumDeclaration[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const declarations: UnitEnumDeclaration[] = [];

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

    const looseCount = countMatches(LOOSE_UNIT_ENUM_MENTION, sql);
    const strictMatches = [...sql.matchAll(STRICT_ENUM_DECLARATION)];

    if (strictMatches.length !== looseCount) {
      // A "create type ... unit ... as enum" shape exists in this file that
      // the strict parser did not capture -- fail loudly instead of
      // silently treating it as "no unit enum here".
      throw new Error(
        `${file}: found a unit-enum-like "create type ... as enum" statement ` +
          "that this tripwire's parser could not fully parse. Update " +
          "STRICT_ENUM_DECLARATION in tests/recipes-units-enum-sync.test.ts " +
          "to handle this migration's exact syntax before trusting this check.",
      );
    }

    for (const match of strictMatches) {
      const [, name, rawValues] = match;
      const values = [...rawValues.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      declarations.push({ file, name, values });
    }
  }

  return declarations;
}

describe("recipe_ingredients.unit enum sync (tripwire for #119)", () => {
  it("has no unit enum migration yet, or matches UNIT_CODES exactly if one exists", () => {
    const declarations = findUnitEnumDeclarations();

    if (declarations.length === 0) {
      // Expected today: #119 hasn't landed on this branch yet.
      expect(declarations).toEqual([]);
      return;
    }

    for (const declaration of declarations) {
      expect(
        [...declaration.values].sort(),
        `${declaration.file}: enum "${declaration.name}" must contain exactly UNIT_CODES from lib/recipes/units.ts`,
      ).toEqual([...UNIT_CODES].sort());
    }
  });
});
