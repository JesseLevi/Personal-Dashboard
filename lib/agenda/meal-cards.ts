import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Extra reads for the day cards (ADR-0059), through the RLS client. `agenda_items()` carries
// neither the recipe id nor the basket link of a meal. Each read fails soft to "nothing".

export interface MealCardData {
  /** `meal id -> recipe id`. */
  recipeIds: Record<string, string>;
  /** `meal id -> has a basket item`, only for the meals whose basket read succeeded: the rest are unknown, so never suggested. */
  basket: Record<string, boolean>;
}

export async function getMealCardData(mealIds: readonly string[]): Promise<MealCardData> {
  const empty: MealCardData = { recipeIds: {}, basket: {} };
  if (mealIds.length === 0) return empty;
  try {
    const supabase = await createSupabaseServerClient();
    const [meals, items] = await Promise.all([
      supabase.from("meal_plans").select("id, recipe_id").in("id", [...mealIds]),
      supabase.from("shopping_list_items").select("meal_plan_id").in("meal_plan_id", [...mealIds]),
    ]);
    const sent = new Set((items.data ?? []).map((row) => row.meal_plan_id));
    return {
      recipeIds: meals.error ? {} : Object.fromEntries((meals.data ?? []).map((row) => [row.id, row.recipe_id])),
      basket: items.error ? {} : Object.fromEntries(mealIds.map((id) => [id, sent.has(id)])),
    };
  } catch {
    return empty;
  }
}
