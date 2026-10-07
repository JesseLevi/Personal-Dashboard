"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/recipes/session";
import { upsertAlias, type MatcherClient } from "@/lib/recipes/import/match-ingredients";
import { confirmIngredientMatchSchema } from "@/lib/recipes/schemas";
import type { ActionResult } from "@/lib/recipes/types";

/**
 * #316: the user fixed a `needs_review` imported line by picking one of their
 * own ingredients (a reference pick is materialised first through
 * createOwnIngredient, like the manual panel). Links the line, clears
 * needs_review and remembers the line's name as an alias so the next import
 * matches it without review. RLS-bound client only; the alias policies also
 * refuse an ingredient that is not the caller's own.
 */
export async function confirmIngredientMatch(input: unknown): Promise<ActionResult> {
  const parsed = confirmIngredientMatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = (await createSupabaseServerClient()) as unknown as MatcherClient;

  const { data: line, error: lineError } = await supabase
    .from("recipe_ingredients")
    .select("id, name")
    .eq("id", parsed.data.recipeIngredientId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (lineError) {
    console.error("[recipes] confirmIngredientMatch/line failed:", lineError.code, lineError.message);
    return { success: false, error: "generic" };
  }
  if (!line) return { success: false, error: "not-found" };

  const { data: ingredient, error: ingredientError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("id", parsed.data.ingredientId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (ingredientError) {
    console.error("[recipes] confirmIngredientMatch/ingredient failed:", ingredientError.code, ingredientError.message);
    return { success: false, error: "generic" };
  }
  if (!ingredient) return { success: false, error: "not-found" };

  const aliasSaved = await upsertAlias(supabase, auth.userId, line.name, ingredient.id);
  if (!aliasSaved) return { success: false, error: "generic" };

  const { error: updateError } = await supabase
    .from("recipe_ingredients")
    .update({ ingredient_id: ingredient.id, needs_review: false })
    .eq("id", line.id)
    .eq("user_id", auth.userId);
  if (updateError) {
    console.error("[recipes] confirmIngredientMatch/update failed:", updateError.code, updateError.message);
    return { success: false, error: "generic" };
  }

  revalidatePath("/recepten", "layout");
  return { success: true, data: undefined };
}
