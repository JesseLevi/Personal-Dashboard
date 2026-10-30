import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { embed, isEmbeddingConfigured } from "@/lib/ai";
import { localDate } from "@/lib/agenda/map";
import { AGENDA_TIME_ZONE } from "@/lib/agenda/time";
import type { Database } from "@/lib/database.types";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collapseEvents, fuseRanked, isSearchType, makeSnippet, type RankedHit, type SearchType } from "@/lib/search/merge";
import { consumeSemanticSearch } from "@/lib/search/rate-limit";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from "@/lib/search/schemas";

// Hybrid search (#580, ADR-0043 §10). Everything goes through the member's own
// RLS client. Keyword search always runs; the semantic branch only with opt-in,
// a provider and budget left, and any failure there falls back to keywords.

type Client = SupabaseClient<Database>;

export type SearchResult = {
  type: SearchType;
  id: string;
  title: string;
  snippet: string | null;
  href: string;
  score: number;
  /** Agenda day (`YYYY-MM-DD`) of an event; the Agenda has no deep link yet, so `href` is the page. */
  date?: string;
};

export type SearchResponse = { mode: "hybrid" | "keyword"; results: SearchResult[] };

export type SearchOptions = { types?: SearchType[]; limit?: number; now?: Date };

type Hydrated = Omit<SearchResult, "score"> & { contentHash?: string | null; startsAt?: string };

const CANDIDATES = 100;

const toHits = (rows: Array<{ source_type: string; source_id: string; score: number }> | null): RankedHit[] =>
  (rows ?? []).flatMap((row) =>
    isSearchType(row.source_type) ? [{ sourceType: row.source_type, sourceId: row.source_id, score: row.score }] : [],
  );

async function semanticHits(client: Client, q: string, types: SearchType[] | null): Promise<RankedHit[]> {
  const [vector] = await embed({ texts: [q], purpose: "search_query" });
  const { data, error } = await client.rpc("search_semantic", {
    p_query: `[${vector!.join(",")}]`,
    p_types: types as string[],
    p_match_count: CANDIDATES,
  });
  if (error) throw error;
  return toHits(data);
}

/** Opt-in, provider and budget, in that order, so a member without opt-in uses no budget. */
async function canSearchSemantically(client: Client, userId: string): Promise<boolean> {
  if (!isEmbeddingConfigured()) return false;
  const { data } = await client.from("profiles").select("ai_enabled").eq("id", userId).maybeSingle();
  if (!data?.ai_enabled) return false;
  return consumeSemanticSearch(userId);
}

async function hydrate(client: Client, hits: RankedHit[], q: string): Promise<Map<string, Hydrated>> {
  const out = new Map<string, Hydrated>();
  const put = (item: Hydrated) => out.set(`${item.type}:${item.id}`, item);
  const idsOf = (type: SearchType) => hits.filter((hit) => hit.sourceType === type).map((hit) => hit.sourceId);
  const run = async <T>(type: SearchType, load: (ids: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
    const wanted = idsOf(type);
    if (wanted.length === 0) return [] as T[];
    const { data, error } = await load(wanted);
    if (error) throw error;
    return data ?? [];
  };

  const [notes, recipes, cards, events, items] = await Promise.all([
    run("note", (v) => client.from("notes").select("id, title, content_text").in("id", v)),
    run("recipe", (v) => client.from("recipes").select("id, title").in("id", v)),
    run("card", (v) => client.from("cards").select("id, title, description, column_id").in("id", v)),
    run("calendar_event", (v) =>
      client.from("calendar_events").select("id, title, location, description, starts_at, content_hash").in("id", v),
    ),
    run("shopping_list_item", (v) => client.from("shopping_list_items").select("id, name, list_id").in("id", v)),
  ]);

  for (const n of notes) {
    put({ type: "note", id: n.id, title: n.title, snippet: makeSnippet(n.content_text, q), href: `/notities/${n.id}` });
  }
  for (const r of recipes) put({ type: "recipe", id: r.id, title: r.title, snippet: null, href: `/recepten/${r.id}` });

  const columnIds = [...new Set(cards.map((c) => c.column_id))];
  const boardOf = new Map<string, string>();
  if (columnIds.length > 0) {
    const { data, error } = await client.from("board_columns").select("id, board_id").in("id", columnIds);
    if (error) throw error;
    for (const column of data ?? []) boardOf.set(column.id, column.board_id);
  }
  for (const c of cards) {
    const board = boardOf.get(c.column_id);
    put({
      type: "card",
      id: c.id,
      title: c.title,
      snippet: makeSnippet(c.description, q),
      href: board ? `/te-doen/${board}?card=${c.id}` : "/te-doen",
    });
  }

  for (const e of events) {
    const day = localDate(e.starts_at, AGENDA_TIME_ZONE);
    put({
      type: "calendar_event",
      id: e.id,
      title: e.title,
      snippet: makeSnippet([e.location, e.description].filter(Boolean).join(" · "), q),
      href: `/agenda?date=${day}`,
      date: day,
      contentHash: e.content_hash,
      startsAt: e.starts_at,
    });
  }
  for (const s of items) {
    put({ type: "shopping_list_item", id: s.id, title: s.name, snippet: null, href: `/winkelmand/${s.list_id}` });
  }
  return out;
}

export async function searchAllWith(
  client: Client,
  userId: string,
  q: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const limit = Math.min(Math.max(options.limit ?? SEARCH_DEFAULT_LIMIT, 1), SEARCH_MAX_LIMIT);
  const types = options.types?.length ? options.types : null;

  const keywordRun = async () => {
    const { data, error } = await client.rpc("search_text", {
      p_query: q,
      p_types: types as string[],
      p_match_count: CANDIDATES,
    });
    if (error) throw error;
    return toHits(data);
  };
  const semanticRun = async (): Promise<RankedHit[] | null> => {
    try {
      if (!(await canSearchSemantically(client, userId))) return null;
      return await semanticHits(client, q, types);
    } catch {
      console.error("[search] semantic search failed, using keywords only");
      return null;
    }
  };

  const [keyword, semantic] = await Promise.all([keywordRun(), semanticRun()]);
  const fused = fuseRanked(keyword, semantic ?? []);
  const hydrated = await hydrate(client, fused, q);

  const ranked = fused.flatMap((hit) => {
    const item = hydrated.get(`${hit.sourceType}:${hit.sourceId}`);
    return item ? [{ ...item, sourceType: hit.sourceType, score: hit.score }] : [];
  });
  const results = collapseEvents(ranked, options.now ?? new Date())
    .slice(0, limit)
    .map((item) => ({
      type: item.type,
      id: item.id,
      title: item.title,
      snippet: item.snippet,
      href: item.href,
      score: item.score,
      ...(item.date ? { date: item.date } : {}),
    }));
  return { mode: semantic ? "hybrid" : "keyword", results };
}

/** Null when nobody is signed in. */
export async function searchAll(q: string, options: SearchOptions = {}): Promise<SearchResponse | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;
  return searchAllWith(await createSupabaseServerClient(), userId, q, options);
}
