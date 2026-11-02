import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAssistantSignals } from "@/lib/assistant/signals";
import type { AssistantSignal } from "@/lib/assistant/types";

// Where rhythm signals show up (ADR-0046 §6): the module where the decision
// is made. Loaders only; a failure shows no suggestions, never an error page.

const SURFACE_LIMIT = 5;

export interface BasketSuggestionView {
  id: string;
  item: string;
  median: number;
  days: number;
}

/** Pure: buy-rhythm view-models to the Winkelmand's suggestion rows. */
export function toBasketSuggestions(signals: readonly AssistantSignal[]): BasketSuggestionView[] {
  return signals.flatMap((s) => {
    if (s.kind !== "buy_rhythm" || !("values" in s.text) || s.action.type !== "add_to_basket") return [];
    const { median, days } = s.text.values;
    return [{ id: s.id, item: s.action.itemName, median: Number(median), days: Number(days) }];
  });
}

export async function basketSuggestions(): Promise<BasketSuggestionView[]> {
  try {
    const client = await createSupabaseServerClient();
    return toBasketSuggestions(await listAssistantSignals(client, { limit: SURFACE_LIMIT, kinds: ["buy_rhythm"] }));
  } catch {
    return [];
  }
}
