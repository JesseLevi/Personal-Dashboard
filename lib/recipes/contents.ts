import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { createRecipeSchema } from "@/lib/recipes/schemas";

// The one write path for a recipe's ingredients and steps (#149), shared by
// the manual actions (app/(app)/recepten/actions.ts) and the importer
// (lib/recipes/import/pipeline.ts, #318): one call to the
// public.replace_recipe_contents RPC, a real Postgres transaction. Rejects the
// whole write (`{ ok: false }`, RPC never called) if any line's ingredientId
// doesn't belong to `userId`: the "don't trust the caller for ownership" check
// stays here, not in the RPC, because it is a cross-table check against
// public.ingredients.

type Client = SupabaseClient<Database>;
export type IngredientLine = z.infer<typeof createRecipeSchema>["ingredients"][number];
export type StepLine = z.infer<typeof createRecipeSchema>["steps"][number];

export async function replaceRecipeContents(
  supabase: Client,
  userId: string,
  recipeId: string,
  ingredients: IngredientLine[],
  steps: StepLine[],
): Promise<{ ok: true } | { ok: false }> {
  const ingredientIds = [
    ...new Set(
      ingredients
        .map((line) => line.ingredientId)
        .filter((id): id is string => id != null),
    ),
  ];
  if (ingredientIds.length > 0) {
    const { data: owned, error: ownedError } = await supabase
      .from("ingredients")
      .select("id")
      .eq("user_id", userId)
      .in("id", ingredientIds);
    if (ownedError) {
      console.error("[recipes] replaceRecipeContents/ownership-check failed:", ownedError.code, ownedError.message);
      return { ok: false };
    }
    if ((owned?.length ?? 0) !== ingredientIds.length) return { ok: false };
  }

  const { error } = await supabase.rpc("replace_recipe_contents", {
    p_recipe_id: recipeId,
    p_ingredients: ingredients.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      ingredientId: line.ingredientId ?? null,
      groupLabel: line.groupLabel ?? null,
      needsReview: line.needsReview ?? false,
    })),
    p_steps: steps.map((line) => ({
      instruction: line.instruction,
      ingredientRefs: line.ingredientRefs,
    })),
  });
  if (error) {
    console.error("[recipes] replaceRecipeContents failed:", error.code, error.message);
    return { ok: false };
  }
  return { ok: true };
}
