// Mirrors lib/boards/enums.ts's file slot in the lib/recipes/ layout (#122),
// but *not* its content. PRIORITIES/SIZES in that file exist because
// cards.priority/cards.size are DB CHECK constraints, which
// lib/database.types.ts can't see -- there is no other source of truth for
// those lists, so boards/enums.ts is where one gets created.
//
// recipe_ingredients.unit is different: it's a real Postgres enum
// (public.recipe_unit, #130's migration), and its runtime-safe codes/guard
// already live in lib/recipes/units.ts (UNIT_CODES/isUnitCode) -- deliberately
// kept in sync with the migration by tests/recipes-units-enum-sync.test.ts's
// tripwire (see that file and units.ts's own header comment). Redefining the
// list here would build exactly the second, driftable copy #120 was built to
// prevent. So this file re-exports the canonical guard rather than
// duplicating it, and exists at all only to keep the mirrored file layout
// predictable and give any future recipe-domain CHECK-constraint enum an
// obvious home next to this one.
export { UNIT_CODES, isUnitCode, type UnitCode } from "@/lib/recipes/units";

// #312 / ADR-0019: recipes.import_status is the Postgres enum
// public.recipe_import_status. Hand-mirrored here until `pnpm db:types`
// regenerates lib/database.types.ts; tests/recipes-import-status-enum-sync.test.ts
// fails on drift.
export const IMPORT_STATUSES = ["importing", "done", "failed"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];
export const isImportStatus = (value: unknown): value is ImportStatus =>
  typeof value === "string" && (IMPORT_STATUSES as readonly string[]).includes(value);

// recipes.import_error is a free-form snake_case reason code (no DB enum, see
// 20261008000001_recipe_import.sql). Codes the schema relies on live here.
export const IMPORT_ERROR_TIMEOUT = "timeout"; // set by the lazy sweep (ADR-0019 §1)
