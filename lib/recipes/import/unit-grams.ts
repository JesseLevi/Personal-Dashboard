import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  EMPTY_BRIDGE_UNIT_GRAMS,
  bridgeUnitGramsFrom,
  resolveMassWithBridge,
} from "@/lib/recipes/mass-resolution";
import type { UnitCode } from "@/lib/recipes/units";

// Grams per unit for the ingredients an import linked (ADR-0019 §8): the
// same user-override -> reference -> bridge precedence as
// lib/recipes/queries.ts (resolveMassWithBridge), batched for one recipe and
// run on the pipeline's own RLS-scoped client (queries.ts builds a
// request-bound client, which `after()` cannot use). The pipeline uses it to
// turn "1 ui" into NEVO's measured stuk weight instead of an LLM estimate.

type Client = SupabaseClient<Database>;

/** Grams for ONE `unit` of the user's ingredient, or null when unknown. */
export type UnitGramsLookup = (ingredientId: string, unit: UnitCode) => number | null;

const NONE: UnitGramsLookup = () => null;

/** Best effort: a database error logs and returns a lookup that knows nothing. */
export async function loadUnitGrams(supabase: Client, userId: string, ingredientIds: string[]): Promise<UnitGramsLookup> {
  const ids = [...new Set(ingredientIds)];
  if (ids.length === 0) return NONE;

  const [own, overrides] = await Promise.all([
    supabase.from("ingredients").select("id, reference_id").eq("user_id", userId).in("id", ids),
    supabase.from("ingredient_unit_masses").select("ingredient_id, unit, grams").eq("user_id", userId).in("ingredient_id", ids),
  ]);
  if (own.error || overrides.error) {
    const error = own.error ?? overrides.error!;
    console.error("[recipes] loadUnitGrams failed:", error.code, error.message);
    return NONE;
  }

  const referenceIdById = new Map(own.data.flatMap((row) => (row.reference_id ? [[row.id, row.reference_id] as const] : [])));
  const referenceIds = [...new Set(referenceIdById.values())];
  let referenceRows: Array<{ ingredient_id: string; unit: string; grams: number }> = [];
  if (referenceIds.length > 0) {
    const { data, error } = await supabase
      .schema("reference")
      .from("ingredient_unit_masses")
      .select("ingredient_id, unit, grams")
      .in("ingredient_id", referenceIds);
    if (error) {
      console.error("[recipes] loadUnitGrams/reference failed:", error.code, error.message);
      return NONE;
    }
    referenceRows = data;
  }

  const userGrams = new Map<string, number>(overrides.data.map((row) => [`${row.ingredient_id}:${row.unit}`, row.grams]));
  const referenceGrams = new Map<string, number>(referenceRows.map((row) => [`${row.ingredient_id}:${row.unit}`, row.grams]));

  return (ingredientId, unit) => {
    const referenceId = referenceIdById.get(ingredientId) ?? null;
    const fromUser = (u: string) => userGrams.get(`${ingredientId}:${u}`) ?? null;
    const fromReference = (u: string) => (referenceId ? (referenceGrams.get(`${referenceId}:${u}`) ?? null) : null);
    const mass = resolveMassWithBridge(
      unit,
      fromUser(unit),
      fromReference(unit),
      bridgeUnitGramsFrom(fromUser),
      referenceId ? bridgeUnitGramsFrom(fromReference) : EMPTY_BRIDGE_UNIT_GRAMS,
    );
    return mass.status === "resolved" ? mass.grams : null;
  };
}
