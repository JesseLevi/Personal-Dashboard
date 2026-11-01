import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

// A rhythm signal is settled by the act it suggests, wherever it happens
// (ADR-0046 §6): adding the item to any basket, or planning the recipe.

type Client = SupabaseClient<Database>;

export type SettleMatch = { kind: "buy_rhythm"; itemName: string } | { kind: "cook_rhythm"; recipeId: string };

const buyPayload = z.object({ item_name: z.string() });
const cookPayload = z.object({ recipe_id: z.string() });

const fold = (text: string) => text.trim().toLocaleLowerCase();

/** Pure: the ids among `rows` (new signals of `match.kind`) that this act settles. */
export function matchingSignalIds(rows: readonly { id: string; payload: unknown }[], match: SettleMatch): string[] {
  return rows
    .filter((row) => {
      if (match.kind === "buy_rhythm") {
        const p = buyPayload.safeParse(row.payload);
        return p.success && fold(p.data.item_name) === fold(match.itemName);
      }
      const p = cookPayload.safeParse(row.payload);
      return p.success && p.data.recipe_id === match.recipeId;
    })
    .map((row) => row.id);
}

/** Marks the caller's matching new signals as acted. Never throws: a failure only leaves a signal open. */
export async function settleAssistantSignals(client: Client, match: SettleMatch): Promise<void> {
  try {
    const { data, error } = await client
      .from("agent_signals")
      .select("id, payload")
      .eq("status", "new")
      .eq("kind", match.kind);
    if (error) throw error;
    for (const id of matchingSignalIds(data ?? [], match)) {
      const { error: statusError } = await client.rpc("set_agent_signal_status", { p_id: id, p_status: "acted" });
      if (statusError && statusError.code !== "22023") throw statusError;
    }
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "?";
    console.error("[assistant] settle failed:", code);
  }
}
