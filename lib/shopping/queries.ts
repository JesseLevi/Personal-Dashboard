import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { getDefaultShoppingListId } from "@/lib/shopping/lists";
import type { ShoppingListItemWithGroupInfo } from "@/lib/shopping/types";

// Read side of #176 (mirrors lib/recipes/queries.ts's
// getRecipeCategoriesWithRecipes). Server-only, via the anon-key server
// client (RLS applies, ADR-0002/0003) -- the browser never talks to
// Supabase directly, and service_role never appears here.

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// #179: recipe titles and reference.ingredients' food-group names are each
// resolved as one extra batched query, keyed on the distinct ids already on
// the page -- same shape as lib/recipes/queries.ts's own
// `nutritionInputsForIngredients` (a handful of queries total, never one
// per row/group). `reference` is a separate Postgres schema PostgREST can't
// embed in the same `.select()` as the public-schema query below, and a
// generated-FK embed's array-vs-object typing for a plain (non-unique)
// many-to-one column is unreliable without a real `supabase gen types` run
// to verify against (no Docker on this dev machine, see CLAUDE.md) -- a
// batched lookup sidesteps that risk for both joins, not just the
// cross-schema one.
async function titlesByRecipeId(
  supabase: Client,
  recipeIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (recipeIds.length === 0) return result;

  const { data, error } = await supabase.from("recipes").select("id, title").in("id", recipeIds);
  if (error) {
    console.error("[shopping] titlesByRecipeId failed:", error.code, error.message);
    return result;
  }
  for (const row of data) result.set(row.id, row.title);
  return result;
}

async function categoriesByReferenceIngredientId(
  supabase: Client,
  referenceIngredientIds: string[],
): Promise<Map<string, { categoryNl: string | null; categoryEn: string | null }>> {
  const result = new Map<string, { categoryNl: string | null; categoryEn: string | null }>();
  if (referenceIngredientIds.length === 0) return result;

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredients")
    .select("id, category_nl, category_en")
    .in("id", referenceIngredientIds);

  if (error) {
    console.error(
      "[shopping] categoriesByReferenceIngredientId failed:",
      error.code,
      error.message,
    );
    return result;
  }

  for (const row of data) {
    result.set(row.id, { categoryNl: row.category_nl, categoryEn: row.category_en });
  }
  return result;
}

function distinctNonNull(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((id): id is string => id != null))];
}

/**
 * Every item of one basket (`listId`, default: the signed-in user's default
 * basket), ordered by `position` then `created_at`, plus the source recipe's
 * title and the linked reference.ingredients row's bilingual food-group name
 * -- two extra batched queries total, never one per row or group. RLS decides
 * whether the list is readable. Feeds `WinkelmandList.tsx`'s (#179)
 * Recept/Voedingsgroep grouping. Empty array if signed out or the default
 * basket does not exist yet.
 */
export async function getShoppingListItems(
  listId?: string,
): Promise<ShoppingListItemWithGroupInfo[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const resolvedListId = listId ?? (await getDefaultShoppingListId(supabase, userId));
  if (!resolvedListId) return [];

  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("list_id", resolvedListId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[shopping] getShoppingListItems failed:", error.code, error.message);
    throw new Error("Failed to load shopping list");
  }

  const [titleByRecipeId, categoryByReferenceId] = await Promise.all([
    titlesByRecipeId(supabase, distinctNonNull(data.map((row) => row.recipe_id))),
    categoriesByReferenceIngredientId(
      supabase,
      distinctNonNull(data.map((row) => row.reference_ingredient_id)),
    ),
  ]);

  return data.map((row) => {
    const category = row.reference_ingredient_id
      ? categoryByReferenceId.get(row.reference_ingredient_id)
      : undefined;
    return {
      ...row,
      recipeName: (row.recipe_id ? titleByRecipeId.get(row.recipe_id) : undefined) ?? null,
      categoryNl: category?.categoryNl ?? null,
      categoryEn: category?.categoryEn ?? null,
    };
  });
}
