import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setEmbeddingProviderForTests, setProviderForTests, type AiProvider } from "@/lib/ai";
import { traceSimilarities } from "@/lib/assistant/pattern-log";
import { runPatterns } from "@/lib/assistant/patterns";

// Traces of the pattern step (#757, ADR-0060 §3): one per asked cluster, and a
// 'paused' one per fresh candidate while the step is paused.

const NOW = new Date("2026-10-26T12:00:00Z");
const FRESH = "2026-10-20T12:00:00Z";
const OLD = "2026-08-01T12:00:00Z";

type Options = {
  patternsEnabled?: boolean;
  traceFails?: boolean;
  cards?: Array<{ id: string; title: string; description: string | null; updated_at: string }>;
  notes?: Array<{ id: string; title: string; content_text: string; updated_at: string }>;
  edges?: Array<{ a_type: string; a_id: string; b_type: string; b_id: string; similarity: number }>;
};

const edge = (a: string, b: string, similarity = 0.9) => ({ a_type: "note", a_id: a, b_type: "note", b_id: b, similarity });
const note = (id: string) => ({ id, title: `Titel ${id}`, content_text: `Tekst ${id}`, updated_at: FRESH });
const threeNotes = { notes: [note("n1"), note("n2"), note("n3")], edges: [edge("n1", "n2", 0.91), edge("n2", "n3", 0.84)] };

function fakeClient(options: Options = {}) {
  const traces: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name.startsWith("record_assistant_pattern_trace")) {
      traces.push({ name, args: args ?? {} });
      return options.traceFails ? { data: null, error: { code: "XX000" } } : { data: true, error: null };
    }
    if (name.startsWith("record_assistant_pattern_run")) return { data: true, error: null };
    if (name.startsWith("pattern_edges")) return { data: options.edges ?? [], error: null };
    if (name.startsWith("reserve_pattern_signal")) return { data: "reserved", error: null };
    if (name.startsWith("complete_pattern_signal")) return { data: true, error: null };
    return { data: null, error: { code: "42883" } };
  });
  const rows: Record<string, unknown[]> = { notes: options.notes ?? [], cards: options.cards ?? [], agent_signals: [] };
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) chain[m] = () => chain;
    chain.maybeSingle = async () => ({
      data: { ai_enabled: true, assistant_patterns_enabled: options.patternsEnabled ?? true, locale: "nl" },
      error: null,
    });
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows[table] ?? [], error: null });
    return chain;
  };
  return { client: { rpc, from } as never, traces };
}

function providerWithUsage(answer: unknown) {
  const generateObjectWithUsage = vi.fn(async (request: { schema: { parse: (v: unknown) => unknown } }) => ({
    object: request.schema.parse(answer),
    usage: { inputTokens: 120, outputTokens: 30 },
  }));
  setProviderForTests({ generateObject: vi.fn(), generateObjectWithUsage } as unknown as AiProvider);
  return generateObjectWithUsage;
}

const run = (client: never, path: "lazy" | "cron" = "lazy") => runPatterns({ client, userId: "member", path, now: NOW });

beforeEach(() => {
  setEmbeddingProviderForTests({ embed: async () => [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  setProviderForTests(undefined);
  setEmbeddingProviderForTests(undefined);
  vi.restoreAllMocks();
});

describe("asked traces", () => {
  it("writes one trace with items, similarities, tokens and the answer", async () => {
    providerWithUsage({ helpful: true, message: "Je schrijft vaak over koffie." });
    const { client, traces } = fakeClient(threeNotes);
    await run(client);
    expect(traces).toHaveLength(1);
    expect(traces[0].name).toBe("record_assistant_pattern_trace");
    const args = traces[0].args;
    expect(args).toMatchObject({
      p_status: "asked",
      p_input_tokens: 120,
      p_output_tokens: 30,
      p_answer: { helpful: true, message_raw: "Je schrijft vaak over koffie.", message: "Je schrijft vaak over koffie.", rejected: null },
    });
    expect(args.p_dedupe_key).toMatch(/^[0-9a-f]{32}$/);
    const items = args.p_items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ type: "note", kind: "note", stale: false });
    expect(items[0]).toHaveProperty("id");
    expect(items[0]).toHaveProperty("title");
    expect(items[0]).toHaveProperty("fragment");
    expect(args.p_similarities).toHaveLength(2);
    expect(args.p_prompt_version).toMatch(/^[0-9a-f]{12}$/);
  });

  it("keeps the raw message and the rejection reason when the cleaner refuses it", async () => {
    providerWithUsage({ helpful: true, message: "Kijk op https://evil.example/x" });
    const { client, traces } = fakeClient(threeNotes);
    await run(client);
    expect(traces[0].args.p_answer).toMatchObject({
      helpful: true,
      message_raw: "Kijk op https://evil.example/x",
      message: null,
      rejected: "link",
    });
  });

  it("records a not-helpful answer too, and uses the _for variant on the cron path", async () => {
    providerWithUsage({ helpful: false, message: "" });
    const { client, traces } = fakeClient(threeNotes);
    await run(client, "cron");
    expect(traces[0].name).toBe("record_assistant_pattern_trace_for");
    expect(traces[0].args).toMatchObject({ p_user: "member", p_answer: { helpful: false, message: null, rejected: null } });
  });
});

describe("paused traces", () => {
  it("writes a paused trace per fresh candidate and makes no call", async () => {
    const generate = providerWithUsage({ helpful: true, message: "x" });
    const { client, traces } = fakeClient({ ...threeNotes, patternsEnabled: false });
    expect(await run(client)).toBe(0);
    expect(generate).not.toHaveBeenCalled();
    expect(traces).toHaveLength(1);
    expect(traces[0].args).toMatchObject({ p_status: "paused", p_answer: null, p_input_tokens: 0, p_output_tokens: 0 });
    expect(traces[0].args.p_items).toHaveLength(3);
  });

  it("skips a candidate that fails the freshness check", async () => {
    providerWithUsage({ helpful: true, message: "x" });
    const card = (id: string) => ({ id, title: `Kaart ${id}`, description: null, updated_at: OLD });
    const { client, traces } = fakeClient({
      patternsEnabled: false,
      cards: [card("k1"), card("k2"), card("k3")],
      edges: [
        { a_type: "card", a_id: "k1", b_type: "card", b_id: "k2", similarity: 0.9 },
        { a_type: "card", a_id: "k2", b_type: "card", b_id: "k3", similarity: 0.9 },
      ],
    });
    await run(client);
    expect(traces).toEqual([]);
  });
});

describe("logging never fails the run", () => {
  it("a failed trace write leaves a console line without content and the signal is still made", async () => {
    providerWithUsage({ helpful: true, message: "Je schrijft vaak over koffie." });
    const { client } = fakeClient({ ...threeNotes, traceFails: true });
    expect(await run(client)).toBe(1);
    const lines = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c.join(" "));
    expect(lines).toContain("[assistant] pattern trace log failed lazy");
    expect(lines.join("\n")).not.toMatch(/koffie|Titel|Tekst/);
  });
});

describe("traceSimilarities", () => {
  const ordered = [
    { type: "note" as const, id: "a" },
    { type: "note" as const, id: "b" },
    { type: "note" as const, id: "c" },
  ];
  it("maps pairs inside the cluster to item indexes, strongest first, and ignores outsiders", () => {
    const edges = [
      { a: ordered[1], b: ordered[2], similarity: 0.85 },
      { a: ordered[1], b: ordered[0], similarity: 0.93 },
      { a: ordered[0], b: { type: "note" as const, id: "zzz" }, similarity: 0.99 },
    ];
    expect(traceSimilarities(ordered, edges)).toEqual([
      { a: 0, b: 1, similarity: 0.93 },
      { a: 1, b: 2, similarity: 0.85 },
    ]);
  });
});
