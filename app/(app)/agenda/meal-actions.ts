"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/boards/session";
import { getAgendaItems } from "@/lib/agenda/queries";
import { lastMealPosition, weekBasketLines } from "@/lib/agenda/meals";
import {
  createMealSchema,
  mealIdSchema,
  sendMealSchema,
  sendWeekSchema,
  updateMealSchema,
  type AgendaActionResult,
} from "@/lib/agenda/schemas";
import { AGENDA_TIME_ZONE, wallClockToUtc } from "@/lib/agenda/time";
import type { MealSlot } from "@/lib/agenda/types";
import type { Database } from "@/lib/database.types";
import { getRecipeWithIngredientsAndSteps } from "@/lib/recipes/queries";
import { getDefaultShoppingListId } from "@/lib/shopping/lists";
import { insertShoppingListLines } from "@/lib/shopping/insert-lines";
import { sendRecipeToShoppingList } from "../winkelmand/actions";

// Meal plans on the Agenda (ADR-0037 §3). Access is decided by RLS (ADR-0033);
// errors carry a code only, never a database message.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type MealUpdate = Database["public"]["Tables"]["meal_plans"]["Update"];

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[agenda] ${action} failed:`, error.code, error.message);
}

/** 42501 is a refused write (no editor role on the calendar). */
function failure(action: string, error: { code: string; message: string }) {
  logDbError(action, error);
  return { success: false, error: error.code === "42501" ? "read-only" : "generic" } as const;
}

/** The positions of the meals already in the group a meal is about to join. */
async function groupPositions(
  supabase: Supabase,
  group: { plannedOn: string } | { calendarEventId: string },
  slot: MealSlot,
  exceptId?: string,
): Promise<number[]> {
  const query = supabase.from("meal_plans").select("id, position").eq("slot", slot);
  const { data } = await ("plannedOn" in group
    ? query.eq("planned_on", group.plannedOn)
    : query.eq("calendar_event_id", group.calendarEventId));
  return (data ?? []).filter((row) => row.id !== exceptId).map((row) => row.position);
}

export async function createMealPlan(input: unknown): Promise<AgendaActionResult<{ id: string }>> {
  const parsed = createMealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, servings")
    .eq("id", parsed.data.recipeId)
    .maybeSingle();
  if (recipeError) return failure("createMealPlan", recipeError);
  if (!recipe) return { success: false, error: "not-found" };

  const { plannedOn, calendarEventId, slot } = parsed.data;
  let calendarId: string;
  if (calendarEventId) {
    const { data: event, error } = await supabase
      .from("calendar_events")
      .select("calendar_id")
      .eq("id", calendarEventId)
      .maybeSingle();
    if (error) return failure("createMealPlan", error);
    if (!event) return { success: false, error: "not-found" };
    calendarId = event.calendar_id;
  } else {
    const { data: calendar, error } = await supabase.from("calendars").select("id").eq("is_default", true).maybeSingle();
    if (error) return failure("createMealPlan", error);
    if (!calendar) return { success: false, error: "not-found" };
    calendarId = calendar.id;
  }

  const group = calendarEventId ? { calendarEventId } : { plannedOn: plannedOn! };
  const position = lastMealPosition(await groupPositions(supabase, group, slot));
  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: auth.userId,
      calendar_id: calendarId,
      recipe_id: recipe.id,
      servings: parsed.data.servings ?? recipe.servings,
      slot,
      planned_on: plannedOn ?? null,
      calendar_event_id: calendarEventId ?? null,
      position,
    })
    .select("id")
    .single();
  if (error || !data) return error ? failure("createMealPlan", error) : { success: false, error: "generic" };
  return { success: true, data: { id: data.id } };
}

/** Changes servings, moment or day. A new day detaches the plan from its event; a new day or moment puts it last in its group. */
export async function updateMealPlan(input: unknown): Promise<AgendaActionResult> {
  const parsed = updateMealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase
    .from("meal_plans")
    .select("id, slot, planned_on, calendar_event_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError) return failure("updateMealPlan", readError);
  if (!current) return { success: false, error: "not-found" };

  const { slot, servings, plannedOn } = parsed.data;
  const update: MealUpdate = {};
  if (servings !== undefined) update.servings = servings;
  if (slot !== undefined) update.slot = slot;
  if (plannedOn !== undefined) {
    update.planned_on = plannedOn;
    update.calendar_event_id = null;
  }

  const targetSlot = (slot ?? current.slot) as MealSlot;
  const movesGroup = (slot !== undefined && slot !== current.slot) || (plannedOn !== undefined && plannedOn !== current.planned_on);
  if (movesGroup) {
    const group =
      plannedOn !== undefined || !current.calendar_event_id
        ? { plannedOn: plannedOn ?? current.planned_on! }
        : { calendarEventId: current.calendar_event_id };
    update.position = lastMealPosition(await groupPositions(supabase, group, targetSlot, current.id));
  }

  const { data, error } = await supabase.from("meal_plans").update(update).eq("id", current.id).select("id").maybeSingle();
  if (error) return failure("updateMealPlan", error);
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}

export async function deleteMealPlan(input: unknown): Promise<AgendaActionResult> {
  const parsed = mealIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("meal_plans").delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) return failure("deleteMealPlan", error);
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}

export interface MealPlanDetail {
  recipeId: string;
  /** Whether basket items already came from this meal plan. */
  sentToBasket: boolean;
}

/** What the timeline does not carry: the recipe to link to and whether the meal went to a basket. */
export async function getMealPlan(input: unknown): Promise<AgendaActionResult<MealPlanDetail>> {
  const parsed = mealIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("meal_plans").select("recipe_id").eq("id", parsed.data.id).maybeSingle();
  if (error) return failure("getMealPlan", error);
  if (!data) return { success: false, error: "not-found" };

  const { count, error: countError } = await supabase
    .from("shopping_list_items")
    .select("id", { count: "exact", head: true })
    .eq("meal_plan_id", parsed.data.id);
  if (countError) return failure("getMealPlan", countError);
  return { success: true, data: { recipeId: data.recipe_id, sentToBasket: (count ?? 0) > 0 } };
}

/** "Naar mand" for one meal: the recipe path, scaled to the planned servings. */
export async function sendMealToBasket(input: unknown): Promise<AgendaActionResult> {
  const parsed = sendMealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data: meal, error } = await supabase
    .from("meal_plans")
    .select("id, recipe_id, servings")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (error) return failure("sendMealToBasket", error);
  if (!meal) return { success: false, error: "not-found" };

  const result = await sendRecipeToShoppingList({
    listId: parsed.data.listId,
    recipeId: meal.recipe_id,
    targetPortions: meal.servings,
    mealPlanId: meal.id,
  });
  if (!result.success) return { success: false, error: result.error === "not-found" ? "not-found" : "generic" };
  return { success: true, data: undefined };
}

/** "Week naar mand": every meal in [from, to) that has no basket item yet, with the same ingredient and unit merged. */
export async function sendWeekToBasket(input: unknown): Promise<AgendaActionResult<{ count: number }>> {
  const parsed = sendWeekSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    const supabase = await createSupabaseServerClient();
    const items = await getAgendaItems({
      from: wallClockToUtc(`${parsed.data.from}T00:00:00`),
      to: wallClockToUtc(`${parsed.data.to}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    });
    const mealIds = items.filter((item) => item.kind === "meal").map((item) => item.id);
    if (mealIds.length === 0) return { success: false, error: "nothing-to-send" };

    const [{ data: meals, error: mealsError }, { data: sent, error: sentError }] = await Promise.all([
      supabase.from("meal_plans").select("id, recipe_id, servings").in("id", mealIds),
      supabase.from("shopping_list_items").select("meal_plan_id").in("meal_plan_id", mealIds),
    ]);
    if (mealsError) return failure("sendWeekToBasket", mealsError);
    if (sentError) return failure("sendWeekToBasket", sentError);

    const alreadySent = new Set((sent ?? []).map((row) => row.meal_plan_id));
    const open = (meals ?? []).filter((meal) => !alreadySent.has(meal.id));
    if (open.length === 0) return { success: false, error: "nothing-to-send" };

    const recipeIds = [...new Set(open.map((meal) => meal.recipe_id))];
    const recipes = new Map(
      (await Promise.all(recipeIds.map((id) => getRecipeWithIngredientsAndSteps(id))))
        .filter((recipe) => recipe !== null)
        .map((recipe) => [recipe.id, recipe]),
    );
    const lines = weekBasketLines(
      open.flatMap((meal) => {
        const recipe = recipes.get(meal.recipe_id);
        return recipe
          ? [{ mealPlanId: meal.id, recipeServings: recipe.servings, servings: meal.servings, ingredients: recipe.ingredients }]
          : [];
      }),
    );
    if (lines.length === 0) return { success: false, error: "nothing-to-send" };

    const listId = parsed.data.listId ?? (await getDefaultShoppingListId(supabase, auth.userId));
    if (!listId) return { success: false, error: "not-found" };

    const recipeOf = new Map(open.map((meal) => [meal.id, meal.recipe_id]));
    const insertError = await insertShoppingListLines(
      supabase,
      auth.userId,
      listId,
      lines.map(({ tag, ...line }) => ({ line, source: { recipeId: recipeOf.get(tag)!, mealPlanId: tag } })),
    );
    if (insertError) return failure("sendWeekToBasket", insertError);

    revalidatePath("/winkelmand", "layout");
    return { success: true, data: { count: open.length } };
  } catch (error) {
    console.error("[agenda] sendWeekToBasket failed:", error);
    return { success: false, error: "generic" };
  }
}
