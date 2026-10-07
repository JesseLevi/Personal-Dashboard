import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { nextPosition } from "@/lib/boards/positioning";
import { ImportRateLimitError, checkImportRateLimit } from "@/lib/recipes/import/rate-limit";
import { hostOf } from "@/lib/recipes/import/url";
import type { ImportJob } from "@/lib/recipes/import/pipeline";
import type { RecipesErrorCode } from "@/lib/recipes/types";

// Start side of the recipe import (#318, ADR-0019 §1): validate ownership,
// rate-limit, insert the `importing` row at the TOP of its category, hand the
// job to `schedule` (the server action passes Next's `after()`; tests pass a
// spy). The row exists before any fetching, so a reload still shows the
// skeleton and a killed function is caught by the lazy sweep (sweep.ts).

type Client = SupabaseClient<Database>;
export type ScheduleImport = (job: ImportJob) => void;
export type StartResult = { ok: true; recipeId: string } | { ok: false; error: RecipesErrorCode };

const MAX_TITLE = 200;

async function firstRecipePosition(supabase: Client, userId: string, categoryId: string): Promise<number | null> {
  const { data } = await supabase
    .from("recipes")
    .select("position")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

export async function startImport(
  supabase: Client,
  userId: string,
  input: { categoryId: string; url: string },
  schedule: ScheduleImport,
): Promise<StartResult> {
  const { data: category, error: categoryError } = await supabase
    .from("recipe_categories")
    .select("id")
    .eq("id", input.categoryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (categoryError) {
    console.error("[recipes] startImport/category-lookup failed:", categoryError.code, categoryError.message);
    return { ok: false, error: "generic" };
  }
  if (!category) return { ok: false, error: "not-found" };

  try {
    await checkImportRateLimit(supabase, userId);
  } catch (error) {
    if (error instanceof ImportRateLimitError) return { ok: false, error: "rate-limited" };
    return { ok: false, error: "generic" };
  }

  const first = await firstRecipePosition(supabase, userId, input.categoryId);
  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      // Placeholder, replaced by the real title when the import finishes.
      // The host is language-independent, so no i18n string is stored.
      title: (hostOf(input.url) || input.url).slice(0, MAX_TITLE),
      source_url: input.url,
      import_status: "importing",
      position: nextPosition(null, first),
    })
    .select("id")
    .single();
  if (error || !recipe) {
    if (error) console.error("[recipes] startImport failed:", error.code, error.message);
    return { ok: false, error: "generic" };
  }

  schedule({ supabase, userId, recipeId: recipe.id, url: input.url });
  return { ok: true, recipeId: recipe.id };
}

/**
 * "Opnieuw proberen" on a failed card: counts as a new import for the rate
 * limit, replaces the failed row with a fresh `importing` one (same
 * source_url and category, top of the column). The new row is inserted before
 * the old one is deleted, so a failure in between never loses the card.
 */
export async function retryImport(
  supabase: Client,
  userId: string,
  recipeId: string,
  schedule: ScheduleImport,
): Promise<StartResult> {
  const { data: failed, error } = await supabase
    .from("recipes")
    .select("id, category_id, source_url, import_status")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[recipes] retryImport/lookup failed:", error.code, error.message);
    return { ok: false, error: "generic" };
  }
  if (!failed || failed.import_status !== "failed" || !failed.source_url) return { ok: false, error: "not-found" };

  const started = await startImport(supabase, userId, { categoryId: failed.category_id, url: failed.source_url }, schedule);
  if (!started.ok) return started;

  const { error: deleteError } = await supabase.from("recipes").delete().eq("id", failed.id).eq("user_id", userId);
  if (deleteError) console.error("[recipes] retryImport/delete failed:", deleteError.code, deleteError.message);
  return started;
}
