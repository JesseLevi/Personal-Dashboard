import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMPORT_STATUSES } from "../lib/recipes/enums";

// Tripwire (#312): public.recipe_import_status in the migrations must list
// exactly IMPORT_STATUSES from lib/recipes/enums.ts, same idea as
// recipes-units-enum-sync.test.ts.
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const DECLARATION =
  /create\s+type\s+public\.recipe_import_status\s+as\s+enum\s*\(([^)]*)\)/gi;

describe("recipes.import_status enum sync", () => {
  it("matches IMPORT_STATUSES exactly", () => {
    const declared: string[][] = [];
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      for (const m of sql.matchAll(DECLARATION)) {
        declared.push([...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1]));
      }
    }
    expect(declared).toHaveLength(1);
    expect(declared[0]).toEqual([...IMPORT_STATUSES]);
  });
});
