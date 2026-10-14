import { addDays, startOfWeek } from "@/lib/agenda/time";
import type { MealSlot } from "@/lib/agenda/types";
import { nextPosition } from "@/lib/boards/positioning";
import {
  buildShoppingListLines,
  mergeShoppingListLines,
  type SendToListIngredient,
  type TaggedShoppingListLine,
} from "@/lib/shopping/send-to-list";

// Pure rules for planned meals (ADR-0037 §3): ordering, defaults, and the
// shopping lines of one meal or a whole week. No server code.

export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const DEFAULT_MEAL_SLOT: MealSlot = "dinner";

/** How many days, today included, the "Plannen" menu lists before "Other date". */
export const PLAN_DAY_COUNT = 5;

export function mealSlotRank(slot: MealSlot): number {
  return MEAL_SLOTS.indexOf(slot);
}

/** Moment first (breakfast to snack), then the stored position, then the title. */
export function compareMeals(
  a: { slot: MealSlot; position: number; title: string },
  b: { slot: MealSlot; position: number; title: string },
): number {
  return mealSlotRank(a.slot) - mealSlotRank(b.slot) || a.position - b.position || a.title.localeCompare(b.title);
}

/** The position that puts a meal last among `positions` (the others in its day and moment). */
export function lastMealPosition(positions: readonly number[]): number {
  return nextPosition(positions.length > 0 ? Math.max(...positions) : null, null);
}

/** Today and the days after it that the "Plannen" menu lists (`YYYY-MM-DD`). */
export function planDays(today: string): string[] {
  return Array.from({ length: PLAN_DAY_COUNT }, (_, offset) => addDays(today, offset));
}

/** The Monday-to-Monday range (end exclusive) of the week containing `date`. */
export function weekRange(date: string): { from: string; to: string } {
  const from = startOfWeek(date);
  return { from, to: addDays(from, 7) };
}

export interface MealForBasket<Ingredient extends SendToListIngredient> {
  mealPlanId: string;
  /** Servings stored on the recipe. */
  recipeServings: number;
  /** Servings planned for this meal. */
  servings: number;
  ingredients: readonly Ingredient[];
}

/** One meal's ingredients scaled to its planned servings, merged per name and unit. */
export function mealBasketLines<Ingredient extends SendToListIngredient>(
  meal: MealForBasket<Ingredient>,
): TaggedShoppingListLine<string>[] {
  return buildShoppingListLines(meal.ingredients, meal.recipeServings, meal.servings).map((line) => ({
    ...line,
    tag: meal.mealPlanId,
  }));
}

/**
 * The lines of several meals at once: each scaled to its own servings, then
 * the same ingredient in the same unit summed into one line. A merged line is
 * tagged with the first meal that contributed to it.
 */
export function weekBasketLines<Ingredient extends SendToListIngredient>(
  meals: readonly MealForBasket<Ingredient>[],
): TaggedShoppingListLine<string>[] {
  return mergeShoppingListLines(meals.flatMap(mealBasketLines));
}
