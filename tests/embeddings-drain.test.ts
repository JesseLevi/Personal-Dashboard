import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiError, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, setEmbeddingProviderForTests } from "@/lib/ai";
import { contentHash } from "@/lib/embeddings/chunk";
import { drainConsentingMembers, drainEmbeddings } from "@/lib/embeddings/drain";

type Row = Record<string, unknown>;

const USER = "user-1";
const UPDATED = "2026-10-23T10:00:00Z";
const literal = (n: number) => `[${Array.from({ length: 3 }, () => n).join(",")}]`;

// In-memory stand-in for the Supabase client: just the calls drain.ts makes.
function fakeClient(init: { tables?: Record<string, Row[]>; backlog?: Array<Record<string, unknown>> }) {
  const tables: Record<string, Row[]> = { embeddings: [], ...init.tables };
  const rpcCalls: string[] = [];
  const from = (table: string) => {
    const state = { op: "select", filters: [] as Array<(r: Row) => boolean>, rows: [] as Row[], arc: "" };
    const run = () => {
      const rows = (tables[table] ??= []);
      const hit = (r: Row) => state.filters.every((f) => f(r));
      if (state.op === "delete") {
        const gone = rows.filter(hit);
        tables[table] = rows.filter((r) => !hit(r));
        return gone;
      }
      if (state.op === "upsert") {
        for (const next of state.rows) {
          const existing = rows.find((r) => r[state.arc] === next[state.arc] && r.chunk_index === next.chunk_index);
          if (existing) Object.assign(existing, next);
          else rows.push({ id: `e${rows.length}-${Math.random()}`, ...next });
        }
        return [];
      }
      return rows.filter(hit);
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      delete: () => ((state.op = "delete"), builder),
      upsert: (rows: Row[], opts: { onConflict: string }) => {
        state.op = "upsert";
        state.rows = rows;
        state.arc = opts.onConflict.split(",")[0]!;
        return builder;
      },
      eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), builder),
      in: (col: string, vals: unknown[]) => (state.filters.push((r) => vals.includes(r[col])), builder),
      gte: (col: string, val: number) => (state.filters.push((r) => (r[col] as number) >= val), builder),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: run(), error: null }),
    };
    return builder;
  };
  const client = {
    from,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push(fn);
      const limit = args.p_limit as number;
      const all = (init.backlog ?? []).filter((b) => !args.p_user || b.user_id === args.p_user);
      return { data: all.slice(0, limit).map((b) => ({ source_type: b.source_type, source_id: b.source_id, updated_at: b.updated_at })), error: null };
    },
  };
  return { client: client as never, tables, rpcCalls };
}

function fakeProvider(options: { failAfter?: number; error?: AiError } = {}) {
  const calls: string[][] = [];
  setEmbeddingProviderForTests({
    embed: async ({ texts }) => {
      if (options.error && calls.length >= (options.failAfter ?? 0)) throw options.error;
      calls.push(texts);
      return texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5));
    },
  });
  return calls;
}

const note = (id: string, text: string) => ({
  id,
  user_id: USER,
  title: "",
  content_text: text,
  updated_at: UPDATED,
});
const due = (id: string, type = "note", userId = USER) => ({
  source_type: type,
  source_id: id,
  updated_at: UPDATED,
  user_id: userId,
});

afterEach(() => setEmbeddingProviderForTests(undefined));

describe("drainEmbeddings", () => {
  it("embeds a source and stores one row per chunk", async () => {
    const calls = fakeProvider();
    const { client, tables } = fakeClient({ tables: { notes: [note("n1", "hallo wereld")] }, backlog: [due("n1")] });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result).toMatchObject({ sources: 1, embedded: 1, reused: 0, stopped: "done" });
    expect(calls).toHaveLength(1);
    expect(tables.embeddings).toHaveLength(1);
    expect(tables.embeddings[0]).toMatchObject({
      user_id: USER,
      note_id: "n1",
      chunk_index: 0,
      model: EMBEDDING_MODEL,
      source_updated_at: UPDATED,
    });
    expect(String(tables.embeddings[0]!.embedding).startsWith("[0.5,")).toBe(true);
  });

  it("reuses a stored vector with the same hash, without a provider call", async () => {
    const calls = fakeProvider();
    const hash = contentHash(EMBEDDING_MODEL, "pindakaas");
    const { client, tables } = fakeClient({
      tables: {
        shopping_list_items: [{ id: "s2", user_id: USER, name: "pindakaas", updated_at: UPDATED }],
        embeddings: [
          { user_id: USER, shopping_list_item_id: "s1", chunk_index: 0, content_hash: hash, model: EMBEDDING_MODEL, embedding: literal(7) },
        ],
      },
      backlog: [due("s2", "shopping_list_item")],
    });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result).toMatchObject({ embedded: 0, reused: 1 });
    expect(calls).toHaveLength(0);
    expect(tables.embeddings.find((r) => r.shopping_list_item_id === "s2")?.embedding).toBe(literal(7));
  });

  it("does not reuse a vector of another model or another member", async () => {
    const calls = fakeProvider();
    const hash = contentHash(EMBEDDING_MODEL, "pindakaas");
    const { client } = fakeClient({
      tables: {
        shopping_list_items: [{ id: "s2", user_id: USER, name: "pindakaas", updated_at: UPDATED }],
        embeddings: [
          { user_id: "ander", shopping_list_item_id: "x", chunk_index: 0, content_hash: hash, model: EMBEDDING_MODEL, embedding: literal(1) },
          { user_id: USER, shopping_list_item_id: "y", chunk_index: 0, content_hash: hash, model: "oud", embedding: literal(2) },
        ],
      },
      backlog: [due("s2", "shopping_list_item")],
    });
    await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(calls).toHaveLength(1);
  });

  it("removes chunk rows beyond the new chunk count and refreshes source_updated_at", async () => {
    fakeProvider();
    const stale = (i: number) => ({
      user_id: USER,
      note_id: "n1",
      chunk_index: i,
      content_hash: `old${i}`,
      model: EMBEDDING_MODEL,
      source_updated_at: "2026-01-01T00:00:00Z",
      embedding: literal(i),
    });
    const { client, tables } = fakeClient({
      tables: { notes: [note("n1", "kort")], embeddings: [stale(0), stale(1), stale(2)] },
      backlog: [due("n1")],
    });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result.removed).toBe(2);
    expect(tables.embeddings).toHaveLength(1);
    expect(tables.embeddings[0]!.source_updated_at).toBe(UPDATED);
  });

  it("refreshes source_updated_at even when no chunk changed", async () => {
    const calls = fakeProvider();
    const { client, tables } = fakeClient({
      tables: {
        notes: [note("n1", "zelfde")],
        embeddings: [
          {
            user_id: USER,
            note_id: "n1",
            chunk_index: 0,
            content_hash: contentHash(EMBEDDING_MODEL, "zelfde"),
            model: EMBEDDING_MODEL,
            source_updated_at: "2026-01-01T00:00:00Z",
            embedding: literal(3),
          },
        ],
      },
      backlog: [due("n1")],
    });
    await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(calls).toHaveLength(0);
    expect(tables.embeddings[0]!.source_updated_at).toBe(UPDATED);
  });

  it("deletes old rows of a source that turned empty", async () => {
    const calls = fakeProvider();
    const { client, tables } = fakeClient({
      tables: {
        notes: [note("n1", "   ")],
        embeddings: [{ user_id: USER, note_id: "n1", chunk_index: 0, content_hash: "h", model: EMBEDDING_MODEL, embedding: literal(1) }],
      },
      backlog: [due("n1")],
    });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result.removed).toBe(1);
    expect(tables.embeddings).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("stops at the first provider error and leaves the rest", async () => {
    fakeProvider({ error: new AiError("rate_limited", "429"), failAfter: 1 });
    const { client, tables } = fakeClient({
      tables: { notes: [note("n1", "een"), note("n2", "twee"), note("n3", "drie")] },
      backlog: [due("n1"), due("n2"), due("n3")],
    });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result).toMatchObject({ sources: 1, stopped: "ai_error" });
    expect(tables.embeddings.map((r) => r.note_id)).toEqual(["n1"]);
  });

  it("stops when the budget is spent", async () => {
    fakeProvider();
    const { client, tables } = fakeClient({ tables: { notes: [note("n1", "een")] }, backlog: [due("n1")] });
    const result = await drainEmbeddings({ client, budgetMs: 0, maxSources: 10 });
    expect(result).toMatchObject({ sources: 0, stopped: "budget" });
    expect(tables.embeddings).toHaveLength(0);
  });

  it("asks the backlog for at most maxSources and reports a full batch", async () => {
    fakeProvider();
    const { client } = fakeClient({
      tables: { notes: [note("n1", "een"), note("n2", "twee")] },
      backlog: [due("n1"), due("n2")],
    });
    const result = await drainEmbeddings({ client, budgetMs: 5_000, maxSources: 1 });
    expect(result).toMatchObject({ sources: 1, stopped: "max_sources" });
  });

  it("uses the member-scoped scan only when a userId is given", async () => {
    fakeProvider();
    const own = fakeClient({ backlog: [] });
    await drainEmbeddings({ client: own.client, budgetMs: 1_000, maxSources: 1 });
    const cron = fakeClient({ backlog: [] });
    await drainEmbeddings({ client: cron.client, userId: USER, budgetMs: 1_000, maxSources: 1 });
    expect(own.rpcCalls).toEqual(["embedding_backlog"]);
    expect(cron.rpcCalls).toEqual(["embedding_backlog_for"]);
  });
});

describe("drainConsentingMembers", () => {
  it("drains only members with ai_enabled, oldest waiting source first", async () => {
    fakeProvider();
    const { client, tables } = fakeClient({
      tables: {
        profiles: [
          { id: "a", ai_enabled: true },
          { id: "b", ai_enabled: true },
          { id: "c", ai_enabled: false },
        ],
        notes: [
          { ...note("na", "van a"), user_id: "a" },
          { ...note("nb", "van b"), user_id: "b" },
        ],
      },
      backlog: [
        { ...due("na", "note", "a"), updated_at: "2026-10-22T10:00:00Z" },
        { ...due("nb", "note", "b"), updated_at: "2026-10-20T10:00:00Z" },
      ],
    });
    const result = await drainConsentingMembers({ client, budgetMs: 5_000, maxSources: 10 });
    expect(result).toMatchObject({ members: 2, sources: 2 });
    expect(tables.embeddings.map((r) => r.user_id)).toEqual(["b", "a"]);
  });
});
