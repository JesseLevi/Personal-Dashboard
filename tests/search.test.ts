import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiError, EMBEDDING_DIMENSIONS, setEmbeddingProviderForTests } from "@/lib/ai";
import { collapseEvents, fuseRanked, makeSnippet, RRF_K, type RankedHit } from "@/lib/search/merge";
import { searchAllWith } from "@/lib/search/query";
import { SEMANTIC_SEARCHES_PER_MINUTE, resetSemanticSearchLimit } from "@/lib/search/rate-limit";
import { searchAllSchema } from "@/lib/search/schemas";

const hit = (sourceType: RankedHit["sourceType"], sourceId: string, score = 1): RankedHit => ({
  sourceType,
  sourceId,
  score,
});

describe("fuseRanked", () => {
  it("scores 1 / (k + rank) and orders by the sum over both lists", () => {
    const fused = fuseRanked([hit("note", "a"), hit("note", "b")], [hit("note", "b"), hit("note", "c")]);
    expect(fused.map((h) => h.sourceId)).toEqual(["b", "a", "c"]);
    expect(fused[0]!.score).toBeCloseTo(1 / (RRF_K + 2) + 1 / (RRF_K + 1));
    expect(fused[1]!.score).toBeCloseTo(1 / (RRF_K + 1));
  });

  it("lists a source found by both once, and keys on type as well as id", () => {
    const fused = fuseRanked([hit("note", "x")], [hit("note", "x"), hit("recipe", "x")]);
    expect(fused).toHaveLength(2);
    expect(fused[0]).toMatchObject({ sourceType: "note", sourceId: "x" });
  });

  it("handles an empty semantic list", () => {
    expect(fuseRanked([hit("card", "1"), hit("card", "2")], []).map((h) => h.sourceId)).toEqual(["1", "2"]);
  });
});

describe("collapseEvents", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const ev = (id: string, contentHash: string | null, startsAt: string) => ({
    sourceType: "calendar_event" as const,
    id,
    contentHash,
    startsAt,
  });

  it("merges events with one content_hash into the occurrence nearest to today, at the best rank", () => {
    const out = collapseEvents(
      [
        ev("far", "h", "2027-03-01T10:00:00Z"),
        { sourceType: "note" as const, id: "n" },
        ev("near", "h", "2026-10-26T10:00:00Z"),
        ev("past", "h", "2026-01-01T10:00:00Z"),
      ],
      now,
    );
    expect(out.map((r) => r.id)).toEqual(["near", "n"]);
  });

  it("keeps events without a hash and events with different hashes", () => {
    const out = collapseEvents(
      [ev("a", null, "2026-10-25T10:00:00Z"), ev("b", null, "2026-10-26T10:00:00Z"), ev("c", "h1", "2026-10-27T10:00:00Z")],
      now,
    );
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("makeSnippet", () => {
  it("is null without text, whole when short, and centred on the match when long", () => {
    expect(makeSnippet(null, "x")).toBeNull();
    expect(makeSnippet("  kort   stukje ", "stuk")).toBe("kort stukje");
    const long = `${"a ".repeat(100)}NEEDLE${" b".repeat(100)}`;
    const snippet = makeSnippet(long, "needle")!;
    expect(snippet).toContain("NEEDLE");
    expect(snippet.length).toBeLessThan(160);
  });
});

describe("searchAllSchema", () => {
  it("needs a trimmed query of at least 2 characters", () => {
    expect(searchAllSchema.safeParse({ q: " a " }).success).toBe(false);
    expect(searchAllSchema.safeParse({ q: " ab " })).toMatchObject({ success: true, data: { q: "ab" } });
    expect(searchAllSchema.safeParse({ q: "ab", types: ["bogus"] }).success).toBe(false);
  });
});

type Row = Record<string, unknown>;

function fakeClient(init: {
  aiEnabled?: boolean;
  keyword?: Row[];
  semantic?: Row[] | Error;
  tables?: Record<string, Row[]>;
}) {
  const rpcCalls: string[] = [];
  const tables = init.tables ?? {};
  const rpc = async (name: string) => {
    rpcCalls.push(name);
    if (name === "search_text") return { data: init.keyword ?? [], error: null };
    if (init.semantic instanceof Error) return { data: null, error: init.semantic };
    return { data: init.semantic ?? [], error: null };
  };
  const from = (table: string) => {
    let ids: string[] | null = null;
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: (_col: string, values: string[]) => {
        ids = values;
        return builder;
      },
      maybeSingle: async () => ({ data: table === "profiles" ? { ai_enabled: init.aiEnabled ?? false } : null, error: null }),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: (tables[table] ?? []).filter((r) => !ids || ids.includes(r.id as string)), error: null }),
    };
    return builder;
  };
  return { client: { rpc, from } as never, rpcCalls };
}

const TABLES = {
  notes: [{ id: "n1", title: "Soep maken", content_text: "Pompoensoep met gember" }],
  recipes: [{ id: "r1", title: "Pompoensoep" }],
  cards: [{ id: "c1", title: "Soep kopen", description: null, column_id: "col1" }],
  board_columns: [{ id: "col1", board_id: "b1" }],
  calendar_events: [
    { id: "e1", title: "Soepdag", location: null, description: null, starts_at: "2026-11-30T10:00:00Z", content_hash: "h" },
    { id: "e2", title: "Soepdag", location: null, description: null, starts_at: "2026-10-25T10:00:00Z", content_hash: "h" },
  ],
  shopping_list_items: [{ id: "s1", name: "Soepgroente", list_id: "l1" }],
};
const KEYWORD = [
  { source_type: "note", source_id: "n1", score: 0.9 },
  { source_type: "recipe", source_id: "r1", score: 0.8 },
  { source_type: "card", source_id: "c1", score: 0.7 },
  { source_type: "calendar_event", source_id: "e1", score: 0.6 },
  { source_type: "calendar_event", source_id: "e2", score: 0.5 },
  { source_type: "shopping_list_item", source_id: "s1", score: 0.4 },
  { source_type: "note", source_id: "gone", score: 0.3 },
];

const NOW = new Date("2026-10-24T12:00:00Z");
const embedSpy = vi.fn(async () => [Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1)]);

describe("searchAllWith", () => {
  beforeEach(() => {
    resetSemanticSearchLimit();
    embedSpy.mockClear();
    embedSpy.mockImplementation(async () => [Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1)]);
    setEmbeddingProviderForTests({ embed: embedSpy });
  });
  afterEach(() => setEmbeddingProviderForTests(undefined));

  it("resolves titles and routes per type and collapses the repeated event", async () => {
    const { client } = fakeClient({ aiEnabled: false, keyword: KEYWORD, tables: TABLES });
    const res = await searchAllWith(client, "u", "soep", { now: NOW });
    expect(res.mode).toBe("keyword");
    expect(res.results.map((r) => [r.type, r.id, r.href])).toEqual([
      ["note", "n1", "/notities/n1"],
      ["recipe", "r1", "/recepten/r1"],
      ["card", "c1", "/te-doen/b1?card=c1"],
      ["calendar_event", "e2", "/agenda?date=2026-10-25"],
      ["shopping_list_item", "s1", "/winkelmand/l1"],
    ]);
    expect(res.results.find((r) => r.id === "e2")?.date).toBe("2026-10-25");
  });

  it("honours the limit", async () => {
    const { client } = fakeClient({ keyword: KEYWORD, tables: TABLES });
    expect((await searchAllWith(client, "u", "soep", { limit: 2, now: NOW })).results).toHaveLength(2);
  });

  it("is hybrid with opt-in and a provider, fusing both lists", async () => {
    const { client, rpcCalls } = fakeClient({
      aiEnabled: true,
      keyword: [{ source_type: "note", source_id: "n1", score: 0.9 }],
      semantic: [
        { source_type: "recipe", source_id: "r1", score: 0.8 },
        { source_type: "note", source_id: "n1", score: 0.7 },
      ],
      tables: TABLES,
    });
    const res = await searchAllWith(client, "u", "soep", { now: NOW });
    expect(res.mode).toBe("hybrid");
    expect(res.results.map((r) => r.id)).toEqual(["n1", "r1"]);
    expect(rpcCalls.sort()).toEqual(["search_semantic", "search_text"]);
    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to keywords, without an embed call, when there is no provider key", async () => {
    setEmbeddingProviderForTests(undefined);
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "");
    try {
      const { client, rpcCalls } = fakeClient({ aiEnabled: true, keyword: KEYWORD, tables: TABLES });
      const res = await searchAllWith(client, "u", "soep", { now: NOW });
      expect(res.mode).toBe("keyword");
      expect(rpcCalls).toEqual(["search_text"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is keyword-only without opt-in, with no embed call and no budget used", async () => {
    const { client, rpcCalls } = fakeClient({ aiEnabled: false, keyword: KEYWORD, tables: TABLES });
    const res = await searchAllWith(client, "u", "soep", { now: NOW });
    expect(res.mode).toBe("keyword");
    expect(embedSpy).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual(["search_text"]);
  });

  it("degrades silently when the provider throws rate_limited or anything else", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [new AiError("rate_limited", "slow down"), new Error("boom")]) {
      embedSpy.mockRejectedValueOnce(error);
      const { client, rpcCalls } = fakeClient({ aiEnabled: true, keyword: KEYWORD, tables: TABLES });
      const res = await searchAllWith(client, "u", "soep", { now: NOW });
      expect(res.mode).toBe("keyword");
      expect(res.results.length).toBeGreaterThan(0);
      expect(rpcCalls).toEqual(["search_text"]);
    }
  });

  it("degrades when search_semantic itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ aiEnabled: true, keyword: KEYWORD, semantic: new Error("rpc"), tables: TABLES });
    expect((await searchAllWith(client, "u", "soep", { now: NOW })).mode).toBe("keyword");
  });

  it("goes keyword-only without an error over the per-member limit", async () => {
    const { client } = fakeClient({ aiEnabled: true, keyword: KEYWORD, tables: TABLES });
    for (let i = 0; i < SEMANTIC_SEARCHES_PER_MINUTE; i++) {
      expect((await searchAllWith(client, "u", "soep", { now: NOW })).mode).toBe("hybrid");
    }
    embedSpy.mockClear();
    expect((await searchAllWith(client, "u", "soep", { now: NOW })).mode).toBe("keyword");
    expect(embedSpy).not.toHaveBeenCalled();
    expect((await searchAllWith(client, "other", "soep", { now: NOW })).mode).toBe("hybrid");
  });
});
