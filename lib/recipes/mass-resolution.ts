import type { MassResolution } from "@/lib/recipes/types";

// ADR-0011 §3's precedence decision (user override -> reference ->
// unresolved), pulled out of lib/recipes/queries.ts's
// resolveIngredientUnitMass into its own pure, framework-free module —
// same split as lib/boards/positioning.ts's nextPosition vs. its
// DB-touching callers: no Supabase import here, so it is testable without a
// database (tests/recipes-mass-resolution.test.ts) and safe to import from
// client code if a future UI ever needs to reason about the ordering
// itself. queries.ts is the only Supabase-dependent shell around this.

/**
 * Pure precedence decision behind resolveIngredientUnitMass: user override
 * grams (or `null` if none/not fetched) wins over reference grams (or
 * `null`), which wins over `{ status: "unresolved" }`. Branches on
 * `!== null`, not truthiness, so a legitimate 0-gram override or reference
 * value is never silently skipped in favor of the next layer — the same
 * pitfall ADR-0011 §4 names for the (still-empty) nutrition columns.
 */
export function resolveMass(
  userOverrideGrams: number | null,
  referenceGrams: number | null,
): MassResolution {
  if (userOverrideGrams !== null) return { status: "resolved", grams: userOverrideGrams };
  if (referenceGrams !== null) return { status: "resolved", grams: referenceGrams };
  return { status: "unresolved" };
}
