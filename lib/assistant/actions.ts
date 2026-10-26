"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nextPosition } from "@/lib/boards/positioning";
import { requireUserId } from "@/lib/boards/session";
import { getAssistantSignalRow, viewModelsFor } from "@/lib/assistant/signals";
import type { AssistantActionResult } from "@/lib/assistant/types";
import { getDefaultShoppingListId } from "@/lib/shopping/lists";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Follow-up actions of the Assistent (ADR-0046 §8). The member's own RLS client
// does everything; the action is always derived from the stored row, never from
// client input.

const idSchema = z.uuid();

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function setStatus(client: Client, id: string, status: "dismissed" | "acted"): Promise<AssistantActionResult> {
  const { error } = await client.rpc("set_agent_signal_status", { p_id: id, p_status: status });
  if (!error) return { success: true };
  if (error.code === "P0002") return { success: false, error: "not-found" };
  if (error.code === "22023") return { success: false, error: "already-handled" };
  console.error("[assistant] set_agent_signal_status failed:", error.code, error.message);
  return { success: false, error: "generic" };
}

async function addToDefaultBasket(client: Client, userId: string, name: string): Promise<boolean> {
  let listId = await getDefaultShoppingListId(client, userId);
  if (!listId) {
    await client.rpc("ensure_user_defaults");
    listId = await getDefaultShoppingListId(client, userId);
  }
  if (!listId) return false;

  const { data: last } = await client
    .from("shopping_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await client.from("shopping_list_items").insert({
    user_id: userId,
    list_id: listId,
    name,
    position: nextPosition(last?.position ?? null, null),
  });
  if (error) console.error("[assistant] add to basket failed:", error.code, error.message);
  return !error;
}

export async function dismissAssistantSignal(id: unknown): Promise<AssistantActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const client = await createSupabaseServerClient();
  return setStatus(client, parsed.data, "dismissed");
}

export async function actOnAssistantSignal(id: unknown): Promise<AssistantActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const client = await createSupabaseServerClient();
  const row = await getAssistantSignalRow(client, parsed.data);
  if (!row) return { success: false, error: "not-found" };
  if (row.status !== "new") return { success: false, error: "already-handled" };

  const [signal] = await viewModelsFor(client, [row]);
  if (!signal) return { success: false, error: "not-found" };

  const { action } = signal;
  if (action.type === "add_to_basket") {
    if (!(await addToDefaultBasket(client, auth.userId, action.itemName))) return { success: false, error: "generic" };
  }

  const status = await setStatus(client, parsed.data, "acted");
  if (!status.success) return status;

  if (action.type === "add_to_basket") {
    revalidatePath("/winkelmand", "layout");
    return { success: true };
  }
  return { success: true, href: action.href };
}
