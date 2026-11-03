"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/boards/session";
import type { LinkedCards } from "@/lib/agenda/day-cards";
import { getLinkedCards } from "@/lib/agenda/linked-cards";
import { getMealCardData, type MealCardData } from "@/lib/agenda/meal-cards";
import type { AgendaActionResult } from "@/lib/agenda/schemas";

const idsSchema = z.array(z.uuid()).max(500);

/** Recipe ids and basket links of the meals on the day cards, refreshed after a window load or "Naar mand". */
export async function loadMealCardData(input: unknown): Promise<AgendaActionResult<MealCardData>> {
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return { success: true, data: await getMealCardData(parsed.data) };
}

/** The cards linked to the window's events with links, refreshed after a window load. */
export async function loadLinkedCards(input: unknown): Promise<AgendaActionResult<LinkedCards>> {
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return { success: true, data: await getLinkedCards(parsed.data) };
}
