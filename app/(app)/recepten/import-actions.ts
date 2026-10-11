"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserLocale } from "@/lib/profile/queries";
import { requireUserId } from "@/lib/recipes/session";
import { upsertAlias } from "@/lib/recipes/import/match-ingredients";
import { runRecipeImport, type ImportJob } from "@/lib/recipes/import/pipeline";
import { retryImport, startImport } from "@/lib/recipes/import/start";
import {
  confirmIngredientMatchSchema,
  retryRecipeImportSchema,
  startRecipeImportSchema,
} from "@/lib/recipes/schemas";
import type { ActionResult } from "@/lib/recipes/types";

// The pipeline runs after the response. The client it gets was built here,
// inside the action, with this request's cookie store captured, and it
// is the user's own RLS-scoped client: nothing in the pipeline reads cookies
// or request headers, and there is no service_role anywhere (ADR-0003).
const scheduleImport = (job: ImportJob) => after(() => runRecipeImport(job));

/**
 * #318: "Via link". Validates, rate-limits (20/hour), inserts the `importing`
 * recipe at the top of the category and schedules the pipeline with `after()`.
 * A recipe in another language than the user's is translated into it.
 * Returns the new recipe id at once.
 */
export async function startRecipeImport(categoryId: unknown, url: unknown): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = startRecipeImportSchema.safeParse({ categoryId, url });
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();

  // Read now, not in the pipeline: it needs this request's cookies.
  const locale = await getUserLocale();
  const result = await startImport(supabase, auth.userId, { ...parsed.data, locale }, scheduleImport);
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath("/recepten", "layout");
  return { success: true, data: { recipeId: result.recipeId } };
}

/** #318: "Opnieuw proberen" on a failed import card; counts against the same hourly limit. */
export async function retryRecipeImport(input: unknown): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = retryRecipeImportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();

  const locale = await getUserLocale();
  const result = await retryImport(supabase, auth.userId, parsed.data.recipeId, locale, scheduleImport);
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath("/recepten", "layout");
  return { success: true, data: { recipeId: result.recipeId } };
}

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
  const supabase = await createSupabaseServerClient();

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
