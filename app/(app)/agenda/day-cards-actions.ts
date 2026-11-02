"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/boards/session";
import { getMealCardData, type MealCardData } from "@/lib/agenda/meal-cards";
import type { AgendaActionResult } from "@/lib/agenda/schemas";

const mealIdsSchema = z.array(z.uuid()).max(500);

/** Recipe ids and basket links of the meals on the day cards, refreshed after a window load or "Naar mand". */
export async function loadMealCardData(input: unknown): Promise<AgendaActionResult<MealCardData>> {
  const parsed = mealIdsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return { success: true, data: await getMealCardData(parsed.data) };
}
