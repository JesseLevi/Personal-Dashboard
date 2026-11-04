import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiError, setEmbeddingProviderForTests, setProviderForTests, type AiProvider } from "@/lib/ai";
import { dedupeKeyFor } from "@/lib/assistant/clusters";
import { promptVersion } from "@/lib/assistant/pattern-log";
import { runPatterns, systemFor } from "@/lib/assistant/patterns";

// Run log of the pattern step (#756, ADR-0060 §2): one row per run of a member
// with opt-in, with the funnel as counts.

const NOW = new Date("2026-10-26T12:00:00Z");
const FRESH = "2026-10-20T12:00:00Z";
const OLD = "2026-08-01T12:00:00Z";

type Options = {
  aiEnabled?: boolean;
  patternsEnabled?: boolean;
  locale?: string;
  known?: string[];
  reserve?: string[];
  recordFails?: boolean;
  edgesError?: boolean;
  cards?: Array<{ id: string; title: string; description: string | null; updated_at: string }>;
  notes?: Array<{ id: string; title: string; content_text: string; updated_at: string }>;
  edges?: Array<{ a_type: string; a_id: string; b_type: string; b_id: string; similarity: number }>;
};

const edge = (a: string, b: string) => ({ a_type: "note", a_id: a, b_type: "note", b_id: b, similarity: 0.9 });
const note = (id: string) => ({ id, title: `Titel ${id}`, content_text: `Tekst ${id}`, updated_at: FRESH });
const card = (id: string, updated_at: string) => ({ id, title: `Kaart ${id}`, description: null, updated_at });
const threeNotes = { notes: [note("n1"), note("n2"), note("n3")], edges: [edge("n1", "n2"), edge("n2", "n3")] };
const cardEdges = [
  { a_type: "card", a_id: "k1", b_type: "card", b_id: "k2", similarity: 0.9 },
  { a_type: "card", a_id: "k2", b_type: "card", b_id: "k3", similarity: 0.9 },
];

function fakeClient(options: Options = {}) {
  const runs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const reserve = [...(options.reserve ?? [])];
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name.startsWith("record_assistant_pattern_run")) {
      runs.push({ name, args: args ?? {} });
      return options.recordFails ? { data: null, error: { code: "XX000" } } : { data: true, error: null };
    }
    if (name.startsWith("pattern_edges")) {
      return options.edgesError ? { data: null, error: { code: "XX000" } } : { data: options.edges ?? [], error: null };
    }
    if (name.startsWith("reserve_pattern_signal")) return { data: reserve.shift() ?? "reserved", error: null };
    if (name.startsWith("complete_pattern_signal")) return { data: true, error: null };
    return { data: null, error: { code: "42883" } };
  });
  const rows: Record<string, unknown[]> = {
    notes: options.notes ?? [],
    cards: options.cards ?? [],
    agent_signals: (options.known ?? []).map((dedupe_key) => ({ dedupe_key })),
  };
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) chain[m] = () => chain;
    chain.maybeSingle = async () => ({
      data: {
        ai_enabled: options.aiEnabled ?? true,
        assistant_patterns_enabled: options.patternsEnabled ?? true,
        locale: options.locale ?? "nl",
      },
      error: null,
    });
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows[table] ?? [], error: null });
    return chain;
  };
  return { client: { rpc, from } as never, runs };
}

function provider(answer: unknown) {
  const generateObject = vi.fn(async (request: { schema: { parse: (v: unknown) => unknown } }) =>
    request.schema.parse(answer),
  );
  setProviderForTests({ generateObject } as unknown as AiProvider);
  return generateObject;
}

function providerWithUsage(answer: unknown, usage = { inputTokens: 120, outputTokens: 30 }) {
  const generateObjectWithUsage = vi.fn(async (request: { schema: { parse: (v: unknown) => unknown } }) => ({
    object: request.schema.parse(answer),
    usage,
  }));
  setProviderForTests({ generateObject: vi.fn(), generateObjectWithUsage } as unknown as AiProvider);
}

const run = (client: never, path: "lazy" | "cron" = "lazy", userId = "u") => runPatterns({ client, userId, path, now: NOW });

function onlyRow(runs: Array<{ args: Record<string, unknown> }>) {
  expect(runs).toHaveLength(1);
  return runs[0].args;
}

beforeEach(() => {
  setEmbeddingProviderForTests({ embed: async () => [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  setProviderForTests(undefined);
  setEmbeddingProviderForTests(undefined);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("one row per outcome", () => {
  it("no_edges: nothing came back from SQL", async () => {
    provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ edges: [] });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({
      p_outcome: "no_edges",
      p_edges: 0,
      p_clusters: 0,
      p_candidates: 0,
      p_calls: 0,
      p_error_code: "",
    });
  });

  it("no_clusters: edges that group into nothing, with the band histogram", async () => {
    provider({ helpful: true, message: "x" });
    const edges = [
      { a_type: "note", a_id: "n1", b_type: "note", b_id: "n2", similarity: 0.82 },
      { a_type: "note", a_id: "n5", b_type: "note", b_id: "n6", similarity: 0.97 },
    ];
    const { client, runs } = fakeClient({ edges });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({
      p_outcome: "no_clusters",
      p_edges: 2,
      p_clusters: 0,
      p_similarity_bands: { "0.80": 1, "0.85": 0, "0.90": 0, "0.95": 1 },
    });
  });

  it("all_known: every cluster is already in agent_signals", async () => {
    const generate = provider({ helpful: true, message: "x" });
    const known = dedupeKeyFor([
      { type: "note", id: "n1" },
      { type: "note", id: "n2" },
      { type: "note", id: "n3" },
    ]);
    const { client, runs } = fakeClient({ ...threeNotes, known: [known] });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({ p_outcome: "all_known", p_clusters: 1, p_known: 1, p_candidates: 0, p_calls: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("no_candidates: a cluster of stale cards is rejected as not fresh", async () => {
    provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ cards: [card("k1", OLD), card("k2", OLD), card("k3", OLD)], edges: cardEdges });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({ p_outcome: "no_candidates", p_candidates: 1, p_not_fresh: 1, p_calls: 0 });
  });

  it("paused: candidates are counted, no call is made", async () => {
    const generate = provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ ...threeNotes, patternsEnabled: false });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({ p_outcome: "paused", p_candidates: 1, p_calls: 0, p_clusters: 1 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("budget: the database refuses the first reservation", async () => {
    provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ ...threeNotes, reserve: ["budget"] });
    await run(client);
    expect(onlyRow(runs)).toMatchObject({ p_outcome: "budget", p_candidates: 1, p_calls: 0 });
  });

  it("ok: counts the call, the answer and the token usage", async () => {
    providerWithUsage({ helpful: true, message: "Je schrijft vaak over koffie." });
    const { client, runs } = fakeClient(threeNotes);
    expect(await run(client)).toBe(1);
    expect(onlyRow(runs)).toMatchObject({
      p_outcome: "ok",
      p_edges: 2,
      p_clusters: 1,
      p_cluster_sizes: { "3": 1, "4": 0 },
      p_candidates: 1,
      p_calls: 1,
      p_helpful: 1,
      p_not_helpful: 0,
      p_rejected_by_cleaner: 0,
      p_call_failures: 0,
      p_input_tokens: 120,
      p_output_tokens: 30,
    });
  });

  it("ok with a not-helpful answer, and with a message the cleaner rejects", async () => {
    provider({ helpful: false, message: "" });
    const first = fakeClient(threeNotes);
    await run(first.client);
    expect(onlyRow(first.runs)).toMatchObject({ p_outcome: "ok", p_calls: 1, p_helpful: 0, p_not_helpful: 1, p_rejected_by_cleaner: 0 });

    provider({ helpful: true, message: "Kijk op https://evil.example/x" });
    const second = fakeClient(threeNotes);
    await run(second.client);
    expect(onlyRow(second.runs)).toMatchObject({ p_outcome: "ok", p_calls: 1, p_helpful: 1, p_rejected_by_cleaner: 1 });
  });

  it("error: a failed call keeps the count and records the code, never the message", async () => {
    setProviderForTests({
      generateObject: vi.fn(async () => {
        throw new AiError("overloaded", "secret prompt text");
      }),
    } as unknown as AiProvider);
    const { client, runs } = fakeClient(threeNotes);
    await run(client);
    const args = onlyRow(runs);
    expect(args).toMatchObject({ p_outcome: "error", p_error_code: "overloaded", p_calls: 1, p_call_failures: 1 });
    expect(JSON.stringify(args)).not.toContain("secret");
  });

  it("error: a failing SQL step still leaves a row", async () => {
    provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ edgesError: true });
    expect(await run(client)).toBe(0);
    expect(onlyRow(runs)).toMatchObject({ p_outcome: "error", p_error_code: "unexpected" });
  });
});

describe("the row itself", () => {
  it("carries started_at, duration and the config with the prompt version", async () => {
    provider({ helpful: true, message: "Een patroon." });
    const { client, runs } = fakeClient(threeNotes);
    await run(client);
    const args = onlyRow(runs);
    expect(args.p_started_at).toBe(NOW.toISOString());
    expect(args.p_duration_ms).toBeGreaterThanOrEqual(0);
    expect(args.p_config).toMatchObject({
      prompt_version: promptVersion(systemFor("nl")),
      similarity_threshold: 0.8,
      cluster_min: 3,
      cluster_max: 8,
      max_calls_per_day: 3,
    });
    expect(args.p_config).toHaveProperty("model");
    expect((args.p_config as { prompt_version: string }).prompt_version).toMatch(/^[0-9a-f]{12}$/);
  });

  it("the prompt version follows the locale", async () => {
    provider({ helpful: false, message: "" });
    const { client, runs } = fakeClient({ ...threeNotes, locale: "en" });
    await run(client);
    expect((onlyRow(runs).p_config as { prompt_version: string }).prompt_version).toBe(promptVersion(systemFor("en")));
  });

  it("the cron path uses the _for variant with p_user", async () => {
    provider({ helpful: false, message: "" });
    const { client, runs } = fakeClient(threeNotes);
    await run(client, "cron", "member");
    expect(runs).toHaveLength(1);
    expect(runs[0].name).toBe("record_assistant_pattern_run_for");
    expect(runs[0].args).toMatchObject({ p_user: "member", p_path: "cron" });
  });
});

describe("when no row is written", () => {
  it("without opt-in", async () => {
    provider({ helpful: true, message: "x" });
    const { client, runs } = fakeClient({ ...threeNotes, aiEnabled: false });
    await run(client);
    expect(runs).toEqual([]);
  });

  it("without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { client, runs } = fakeClient(threeNotes);
    await run(client);
    expect(runs).toEqual([]);
  });
});

describe("logging never fails the run", () => {
  it("a failed insert leaves a console line without content", async () => {
    provider({ helpful: true, message: "Je schrijft vaak over koffie." });
    const { client } = fakeClient({ ...threeNotes, recordFails: true });
    expect(await run(client)).toBe(1);
    const lines = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c.join(" "));
    expect(lines).toContain("[assistant] pattern run log failed lazy");
    expect(lines.join("\n")).not.toMatch(/koffie|Titel|Tekst/);
  });
});
