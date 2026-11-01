import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Card labels (ADR-0052): plain names per board, no colour. The card panel
// sends the full set; the server reuses a board label with the same name
// (case ignored), creates the rest, and drops labels no card uses any more.

type Client = SupabaseClient<Database>;

export const LABEL_MAX_LENGTH = 40;
export const LABELS_PER_CARD = 10;

const fold = (name: string) => name.toLocaleLowerCase();

/** Pure: "werk, Thuis ,werk" → ["werk", "Thuis"]. Trims, drops empties and case-insensitive duplicates. */
export function parseLabelInput(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || seen.has(fold(name))) continue;
    seen.add(fold(name));
    out.push(name);
  }
  return out;
}

/** Pure: the label names as the card panel shows them. */
export function formatLabelInput(labels: readonly { name: string }[]): string {
  return labels.map((label) => label.name).join(", ");
}

/** Replaces the card's label set by `names`. Returns false on any database error. */
export async function replaceCardLabels(client: Client, userId: string, cardId: string, names: readonly string[]): Promise<boolean> {
  const { data: card, error: cardError } = await client
    .from("cards")
    .select("id, board_columns!inner(board_id)")
    .eq("id", cardId)
    .maybeSingle();
  if (cardError || !card) return false;
  const boardId = card.board_columns.board_id;

  const { data: existing, error: labelsError } = await client.from("labels").select("id, name").eq("board_id", boardId);
  if (labelsError) return false;
  const byName = new Map((existing ?? []).map((label) => [fold(label.name), label.id] as const));

  const missing = names.filter((name) => !byName.has(fold(name)));
  if (missing.length > 0) {
    const { data: created, error } = await client
      .from("labels")
      .insert(missing.map((name) => ({ user_id: userId, board_id: boardId, name })))
      .select("id, name");
    if (error) return false;
    for (const label of created ?? []) byName.set(fold(label.name), label.id);
  }

  const wanted = names.flatMap((name) => byName.get(fold(name)) ?? []);
  const { error: unlinkError } = await client
    .from("card_labels")
    .delete()
    .eq("card_id", cardId)
    .not("label_id", "in", `(${wanted.length > 0 ? wanted.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (unlinkError) return false;

  if (wanted.length > 0) {
    const { error } = await client
      .from("card_labels")
      .upsert(
        wanted.map((labelId) => ({ user_id: userId, card_id: cardId, label_id: labelId })),
        { onConflict: "card_id,label_id", ignoreDuplicates: true },
      );
    if (error) return false;
  }

  await dropUnusedLabels(client, boardId);
  return true;
}

/** Deletes the board's labels that no card carries. Best effort. */
async function dropUnusedLabels(client: Client, boardId: string): Promise<void> {
  const { data } = await client.from("labels").select("id, card_labels(count)").eq("board_id", boardId);
  const unused = (data ?? []).filter((label) => (label.card_labels as unknown as { count: number }[])[0]?.count === 0);
  if (unused.length > 0) await client.from("labels").delete().in("id", unused.map((label) => label.id));
}

/** Pure: the board's labels that are on at least one card, by name. */
export function boardLabels(columns: readonly { cards: readonly { labels: readonly { id: string; name: string }[] }[] }[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const column of columns) for (const card of column.cards) for (const label of card.labels) byId.set(label.id, label.name);
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Pure: whether a card passes the `?label=` filter (null = no filter). */
export function hasLabel(card: { labels: readonly { id: string }[] }, labelId: string | null): boolean {
  return labelId === null || card.labels.some((label) => label.id === labelId);
}
