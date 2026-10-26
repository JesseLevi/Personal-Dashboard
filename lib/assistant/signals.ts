import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { AssistantSignal } from "@/lib/assistant/types";

// Read side of the Assistent (ADR-0046 §8-9): rows -> view-models. RLS scopes
// every query to the caller; links and recipe titles are resolved here, never
// taken from stored text.

type Client = SupabaseClient<Database>;

export interface SignalRow {
  id: string;
  kind: string;
  created_at: string;
  payload: unknown;
  message: string | null;
  status?: string;
}

/** Targets looked up at read time. A missing entry means the target is gone. */
export interface SignalTargets {
  recipeTitles: ReadonlyMap<string, string>;
  hrefs: ReadonlyMap<string, string>;
}

const buyPayload = z.object({
  item_name: z.string().trim().min(1),
  median_days: z.number(),
  days_since: z.number(),
});
const cookPayload = z.object({
  recipe_id: z.uuid(),
  median_days: z.number(),
  days_since: z.number(),
});
const patternPayload = z.object({
  sources: z.array(z.object({ type: z.string(), id: z.string() })).min(1),
});

export const sourceKey = (type: string, id: string) => `${type}:${id}`;

/** The first source of a pattern (SQL-provided), or null for a malformed payload. */
export function firstPatternSource(payload: unknown): { type: string; id: string } | null {
  const parsed = patternPayload.safeParse(payload);
  return parsed.success ? parsed.data.sources[0] : null;
}

export function recipeIdOf(payload: unknown): string | null {
  const parsed = cookPayload.safeParse(payload);
  return parsed.success ? parsed.data.recipe_id : null;
}

/** Pure: one row to one view-model, or null when malformed or its target is gone. */
export function toAssistantSignal(row: SignalRow, targets: SignalTargets): AssistantSignal | null {
  const base = { id: row.id, createdAt: row.created_at };

  if (row.kind === "buy_rhythm") {
    const p = buyPayload.safeParse(row.payload);
    if (!p.success) return null;
    return {
      ...base,
      kind: "buy_rhythm",
      text: {
        key: "assistant.signals.buyRhythm",
        values: {
          item: p.data.item_name,
          median: Math.round(p.data.median_days),
          days: Math.round(p.data.days_since),
        },
      },
      action: { type: "add_to_basket", itemName: p.data.item_name, labelKey: "assistant.signals.actions.addToBasket" },
    };
  }

  if (row.kind === "cook_rhythm") {
    const p = cookPayload.safeParse(row.payload);
    const title = p.success ? targets.recipeTitles.get(p.data.recipe_id) : undefined;
    if (!p.success || !title) return null;
    return {
      ...base,
      kind: "cook_rhythm",
      text: {
        key: "assistant.signals.cookRhythm",
        values: { recipe: title, median: Math.round(p.data.median_days), days: Math.round(p.data.days_since) },
      },
      action: { type: "link", href: `/recepten/${p.data.recipe_id}`, labelKey: "assistant.signals.actions.openRecipe" },
    };
  }

  if (row.kind === "pattern") {
    const source = firstPatternSource(row.payload);
    const href = source ? targets.hrefs.get(sourceKey(source.type, source.id)) : undefined;
    const message = row.message?.trim();
    if (!href || !message) return null;
    return {
      ...base,
      kind: "pattern",
      text: { plain: message },
      action: { type: "link", href, labelKey: "assistant.signals.actions.open" },
    };
  }

  return null;
}

/** Looks up recipe titles and source links for the given rows (RLS decides what exists). */
export async function loadSignalTargets(client: Client, rows: readonly SignalRow[]): Promise<SignalTargets> {
  const recipeIds = new Set<string>();
  const noteIds = new Set<string>();
  const cardIds = new Set<string>();
  const hrefs = new Map<string, string>();

  for (const row of rows) {
    if (row.kind === "cook_rhythm") {
      const id = recipeIdOf(row.payload);
      if (id) recipeIds.add(id);
    } else if (row.kind === "pattern") {
      const source = firstPatternSource(row.payload);
      if (source?.type === "recipe") recipeIds.add(source.id);
      else if (source?.type === "note") noteIds.add(source.id);
      else if (source?.type === "card") cardIds.add(source.id);
    }
  }

  const [recipes, notes, cards] = await Promise.all([
    recipeIds.size ? client.from("recipes").select("id, title").in("id", [...recipeIds]) : null,
    noteIds.size ? client.from("notes").select("id").in("id", [...noteIds]) : null,
    cardIds.size ? client.from("cards").select("id, column_id").in("id", [...cardIds]) : null,
  ]);
  for (const result of [recipes, notes, cards]) if (result?.error) throw result.error;

  const recipeTitles = new Map((recipes?.data ?? []).map((r) => [r.id, r.title] as const));
  for (const id of recipeTitles.keys()) hrefs.set(sourceKey("recipe", id), `/recepten/${id}`);
  for (const n of notes?.data ?? []) hrefs.set(sourceKey("note", n.id), `/notities/${n.id}`);

  const columnIds = [...new Set((cards?.data ?? []).map((c) => c.column_id))];
  if (columnIds.length > 0) {
    const { data, error } = await client.from("board_columns").select("id, board_id").in("id", columnIds);
    if (error) throw error;
    const boardOf = new Map((data ?? []).map((c) => [c.id, c.board_id] as const));
    for (const c of cards?.data ?? []) {
      const board = boardOf.get(c.column_id);
      if (board) hrefs.set(sourceKey("card", c.id), `/te-doen/${board}?card=${c.id}`);
    }
  }

  return { recipeTitles, hrefs };
}

export async function viewModelsFor(client: Client, rows: readonly SignalRow[]): Promise<AssistantSignal[]> {
  const targets = await loadSignalTargets(client, rows);
  return rows.flatMap((row) => toAssistantSignal(row, targets) ?? []);
}

const COLUMNS = "id, kind, created_at, payload, message, status";

/** New signals, newest first. Signals whose target is gone are left out. */
export async function listAssistantSignals(client: Client, { limit }: { limit: number }): Promise<AssistantSignal[]> {
  const { data, error } = await client
    .from("agent_signals")
    .select(COLUMNS)
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw error;
  return viewModelsFor(client, data ?? []);
}

export async function countNewAssistantSignals(client: Client): Promise<number> {
  const { count, error } = await client
    .from("agent_signals")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

/** One of the caller's signals by id, any status (the action layer reports why it cannot act). */
export async function getAssistantSignalRow(client: Client, id: string): Promise<SignalRow | null> {
  const { data, error } = await client.from("agent_signals").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
