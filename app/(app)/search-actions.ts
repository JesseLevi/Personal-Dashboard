"use server";

import type { RecipesErrorCode } from "@/lib/recipes/types";
import { searchAll, type SearchResponse } from "@/lib/search/query";
import { searchAllSchema } from "@/lib/search/schemas";

type SearchActionResult = { success: true; data: SearchResponse } | { success: false; error: RecipesErrorCode };

/** #580: hybrid search over notes, recipes, cards, events and basket items. Over a limit or without AI it answers from keywords alone. */
export async function searchAllAction(input: unknown): Promise<SearchActionResult> {
  const parsed = searchAllSchema.safeParse(typeof input === "string" ? { q: input } : input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  try {
    const data = await searchAll(parsed.data.q, { types: parsed.data.types });
    if (!data) return { success: false, error: "unauthenticated" };
    return { success: true, data };
  } catch {
    console.error("[search] searchAllAction failed");
    return { success: false, error: "generic" };
  }
}
