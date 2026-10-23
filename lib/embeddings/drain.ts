import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, EMBEDDING_MODEL, embed } from "@/lib/ai";
import type { Database, TablesInsert } from "@/lib/database.types";
import { cardText, eventText, noteText, recipeText, shoppingItemText } from "@/lib/embeddings/canonical";
import { chunkSource } from "@/lib/embeddings/chunk";

// Drains the embedding backlog (ADR-0043 §4-7). It reads and writes with the
// client it is given: the RLS client on the lazy path, service_role only from
// the cron route (ADR-0033). It logs counts and codes, never content.

type Client = SupabaseClient<Database>;

const SOURCE_COLUMN = {
  note: "note_id",
  recipe: "recipe_id",
  card: "card_id",
  calendar_event: "calendar_event_id",
  shopping_list_item: "shopping_list_item_id",
} as const;
type SourceType = keyof typeof SOURCE_COLUMN;
type SourceColumn = (typeof SOURCE_COLUMN)[SourceType];

const isSourceType = (value: string): value is SourceType => value in SOURCE_COLUMN;

export type DrainOptions = {
  client: Client;
  /** Set for the cron (service_role) path; unset means the signed-in member. */
  userId?: string;
  budgetMs: number;
  maxSources: number;
};

export type DrainResult = {
  sources: number;
  embedded: number;
  reused: number;
  removed: number;
  failed: number;
  stopped: "done" | "budget" | "max_sources" | "ai_error";
};

const emptyResult = (): DrainResult => ({ sources: 0, embedded: 0, reused: 0, removed: 0, failed: 0, stopped: "done" });

type Loaded = { userId: string; updatedAt: string; text: string };

// Parent first: if a child changes meanwhile, the touch trigger moves the
// parent's updated_at past what we store and the next run picks it up again.
async function loadSource(client: Client, type: SourceType, id: string): Promise<Loaded | null> {
  switch (type) {
    case "note": {
      const { data, error } = await client
        .from("notes")
        .select("user_id, title, content_text, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data && { userId: data.user_id, updatedAt: data.updated_at, text: noteText(data) };
    }
    case "recipe": {
      const { data, error } = await client
        .from("recipes")
        .select("user_id, title, updated_at, recipe_ingredients(name, position), recipe_steps(instruction, position)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (
        data && {
          userId: data.user_id,
          updatedAt: data.updated_at,
          text: recipeText({ title: data.title, ingredients: data.recipe_ingredients, steps: data.recipe_steps }),
        }
      );
    }
    case "card": {
      const { data, error } = await client
        .from("cards")
        .select("user_id, title, description, updated_at, card_labels(labels(name))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const labels = data.card_labels.flatMap((row) => (row.labels ? [row.labels.name] : []));
      return { userId: data.user_id, updatedAt: data.updated_at, text: cardText({ ...data, labels }) };
    }
    case "calendar_event": {
      const { data, error } = await client
        .from("calendar_events")
        .select("user_id, title, location, description, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data && { userId: data.user_id, updatedAt: data.updated_at, text: eventText(data) };
    }
    case "shopping_list_item": {
      const { data, error } = await client
        .from("shopping_list_items")
        .select("user_id, name, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data && { userId: data.user_id, updatedAt: data.updated_at, text: shoppingItemText(data) };
    }
  }
}

// halfvec travels as its text literal, "[0.1,0.2,...]", both ways.
const toVectorLiteral = (vector: number[]) => `[${vector.join(",")}]`;

type SourceOutcome = { embedded: number; reused: number; removed: number };

async function embedSource(client: Client, type: SourceType, id: string): Promise<SourceOutcome | null> {
  const loaded = await loadSource(client, type, id);
  if (!loaded) return null;
  const column: SourceColumn = SOURCE_COLUMN[type];
  const chunks = chunkSource(loaded.text, EMBEDDING_MODEL);

  // An empty source keeps no rows, or the backlog would list it forever.
  if (chunks.length === 0) {
    const { data, error } = await client.from("embeddings").delete().eq(column, id).select("id");
    if (error) throw error;
    return { embedded: 0, reused: 0, removed: data.length };
  }

  const hashes = [...new Set(chunks.map((chunk) => chunk.hash))];
  const { data: known, error: knownError } = await client
    .from("embeddings")
    .select("content_hash, embedding")
    .eq("user_id", loaded.userId)
    .eq("model", EMBEDDING_MODEL)
    .in("content_hash", hashes);
  if (knownError) throw knownError;
  const vectors = new Map<string, string>();
  for (const row of known) if (typeof row.embedding === "string") vectors.set(row.content_hash, row.embedding);
  const reused = hashes.filter((hash) => vectors.has(hash)).length;

  const missing = hashes.filter((hash) => !vectors.has(hash));
  if (missing.length > 0) {
    const texts = missing.map((hash) => chunks.find((chunk) => chunk.hash === hash)!.text);
    const created = await embed({ texts, purpose: "index_source" });
    missing.forEach((hash, i) => vectors.set(hash, toVectorLiteral(created[i]!)));
  }

  const { error: upsertError } = await client.from("embeddings").upsert(
    chunks.map(
      (chunk): TablesInsert<"embeddings"> => ({
        user_id: loaded.userId,
        [column]: id,
        chunk_index: chunk.index,
        content_text: chunk.text,
        content_hash: chunk.hash,
        source_updated_at: loaded.updatedAt,
        model: EMBEDDING_MODEL,
        embedding: vectors.get(chunk.hash)!,
      }),
    ),
    { onConflict: `${column},chunk_index` },
  );
  if (upsertError) throw upsertError;

  const { data: stale, error: staleError } = await client
    .from("embeddings")
    .delete()
    .eq(column, id)
    .gte("chunk_index", chunks.length)
    .select("id");
  if (staleError) throw staleError;
  return { embedded: missing.length, reused, removed: stale.length };
}

/**
 * Embeds sources from the backlog, oldest first, until the budget or the
 * source count is spent or the provider fails; the rest waits for the next run.
 */
export async function drainEmbeddings(options: DrainOptions): Promise<DrainResult> {
  const { client, userId, budgetMs, maxSources } = options;
  const deadline = Date.now() + budgetMs;
  const result = emptyResult();

  const { data: backlog, error } = userId
    ? await client.rpc("embedding_backlog_for", { p_user: userId, p_model: EMBEDDING_MODEL, p_limit: maxSources })
    : await client.rpc("embedding_backlog", { p_model: EMBEDDING_MODEL, p_limit: maxSources });
  if (error) {
    console.error("[embeddings] backlog failed", error.code);
    result.failed++;
    return result;
  }

  for (const source of backlog) {
    if (Date.now() >= deadline) {
      result.stopped = "budget";
      return result;
    }
    if (!isSourceType(source.source_type)) continue;
    try {
      const outcome = await embedSource(client, source.source_type, source.source_id);
      if (!outcome) continue;
      result.sources++;
      result.embedded += outcome.embedded;
      result.reused += outcome.reused;
      result.removed += outcome.removed;
    } catch (cause) {
      if (cause instanceof AiError) {
        console.error("[embeddings] provider stopped the drain", cause.code);
        result.stopped = "ai_error";
        return result;
      }
      const code = (cause as { code?: string } | null)?.code;
      console.error("[embeddings] source failed", source.source_type, code);
      result.failed++;
    }
  }
  if (backlog.length >= maxSources) result.stopped = "max_sources";
  return result;
}

/**
 * Cron path: every member with ai_enabled, the one with the oldest waiting
 * source first, all within one budget. Expects the service_role client.
 */
export async function drainConsentingMembers(options: {
  client: Client;
  budgetMs: number;
  maxSources: number;
}): Promise<DrainResult & { members: number }> {
  const { client, budgetMs, maxSources } = options;
  const deadline = Date.now() + budgetMs;
  const total = { ...emptyResult(), members: 0 };

  const { data: profiles, error } = await client.from("profiles").select("id").eq("ai_enabled", true);
  if (error) {
    console.error("[embeddings] members failed", error.code);
    total.failed++;
    return total;
  }

  const waiting: Array<{ userId: string; oldest: string }> = [];
  for (const profile of profiles) {
    const { data, error: scanError } = await client.rpc("embedding_backlog_for", {
      p_user: profile.id,
      p_model: EMBEDDING_MODEL,
      p_limit: 1,
    });
    if (scanError) {
      total.failed++;
      continue;
    }
    if (data[0]) waiting.push({ userId: profile.id, oldest: data[0].updated_at });
  }
  waiting.sort((a, b) => a.oldest.localeCompare(b.oldest));

  let sourcesLeft = maxSources;
  for (const { userId } of waiting) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0 || sourcesLeft <= 0) {
      total.stopped = remainingMs <= 0 ? "budget" : "max_sources";
      break;
    }
    const part = await drainEmbeddings({ client, userId, budgetMs: remainingMs, maxSources: sourcesLeft });
    total.members++;
    total.sources += part.sources;
    total.embedded += part.embedded;
    total.reused += part.reused;
    total.removed += part.removed;
    total.failed += part.failed;
    sourcesLeft -= part.sources;
    if (part.stopped === "ai_error" || part.stopped === "budget") {
      total.stopped = part.stopped;
      break;
    }
  }
  return total;
}
