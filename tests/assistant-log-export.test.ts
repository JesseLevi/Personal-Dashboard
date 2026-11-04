import { describe, expect, it } from "vitest";
import { exportFileName, LOG_FORMAT, serializeAssistantLog, toLogTrace } from "@/lib/assistant/log-export";
import { groupRunsByDay, traceAnswerView, traceItemViews, traceOutcome } from "@/lib/assistant/log-view";
import { buildTraceArgs, clusterSimilarities } from "@/lib/assistant/pattern-log";
import { assistantLogFixture } from "../.ladle/mocks/assistant-log-actions";
import type { Database } from "@/lib/database.types";

type RunRow = Database["public"]["Tables"]["assistant_pattern_runs"]["Row"];
type TraceRow = Database["public"]["Tables"]["assistant_pattern_traces"]["Row"];

const USER = "00000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-11-04T10:00:00.000Z");

const runRow = (patch: Partial<RunRow> = {}): RunRow => ({
  id: "r1",
  user_id: USER,
  path: "lazy",
  started_at: "2026-11-04T07:00:00.000Z",
  duration_ms: 10,
  outcome: "ok",
  error_code: null,
  edges: 1,
  similarity_bands: { "0.80": 1 },
  clusters: 1,
  cluster_sizes: { "3": 1 },
  known: 0,
  not_fresh: 0,
  candidates: 1,
  calls: 1,
  helpful: 1,
  not_helpful: 0,
  rejected_by_cleaner: 0,
  call_failures: 0,
  input_tokens: 5,
  output_tokens: 6,
  config: {},
  created_at: "2026-11-04T07:00:00.000Z",
  ...patch,
});

const traceRow = (patch: Partial<TraceRow> = {}): TraceRow => ({
  id: "t1",
  user_id: USER,
  dedupe_key: "k",
  status: "asked",
  items: [{ type: "note", id: "n1", kind: "note", title: "Titel", fragment: "Tekst", stale: false }],
  similarities: [],
  prompt_version: "abc",
  model: "m",
  answer: { helpful: true, message_raw: "Hoi", message: "Hoi", rejected: null },
  input_tokens: 1,
  output_tokens: 2,
  duration_ms: 3,
  signal_id: "s1",
  first_seen_at: "2026-11-04T07:00:00.000Z",
  last_seen_at: "2026-11-04T07:00:00.000Z",
  seen_count: 1,
  ...patch,
});

describe("serializeAssistantLog", () => {
  it("returns the v1 document and survives a JSON round trip", () => {
    const doc = serializeAssistantLog({
      exportedAt: NOW,
      config: { model: "m", similarity_threshold: 0.8, patterns_enabled: true },
      runs: [runRow()],
      traces: [{ ...traceRow(), agent_signals: { status: "acted", status_changed_at: "2026-11-04T08:00:00.000Z" } }],
    });
    expect(doc.format).toBe(LOG_FORMAT);
    expect(doc.format).toBe("atlas.assistant-log.v1");
    expect(doc.exported_at).toBe("2026-11-04T10:00:00.000Z");
    expect(Object.keys(doc)).toEqual(["format", "exported_at", "config", "runs", "traces"]);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("never carries a user id", () => {
    const doc = serializeAssistantLog({ exportedAt: NOW, config: {}, runs: [runRow()], traces: [traceRow()] });
    expect(JSON.stringify(doc)).not.toContain(USER);
  });

  it("adds signal_status and status_changed_at to each trace", () => {
    const doc = serializeAssistantLog({
      exportedAt: NOW,
      config: {},
      runs: [],
      traces: [
        { ...traceRow({ id: "a" }), agent_signals: { status: "dismissed", status_changed_at: "2026-11-04T09:00:00.000Z" } },
        { ...traceRow({ id: "b", status: "paused", signal_id: null }), agent_signals: null },
        { ...traceRow({ id: "c" }), agent_signals: [{ status: "new", status_changed_at: "2026-11-04T07:00:00.000Z" }] },
        traceRow({ id: "d" }),
      ],
    });
    expect(doc.traces.map((t) => [t.id, t.signal_status, t.status_changed_at])).toEqual([
      ["a", "dismissed", "2026-11-04T09:00:00.000Z"],
      ["b", null, null],
      ["c", "new", "2026-11-04T07:00:00.000Z"],
      ["d", null, null],
    ]);
    expect(doc.traces[0]).not.toHaveProperty("agent_signals");
  });

  it("keeps items, similarities, answer and tokens as stored", () => {
    const trace = toLogTrace(traceRow({ similarities: [{ a: "note:n1", b: "note:n2", similarity: 0.9 }] }));
    expect(trace).toMatchObject({
      prompt_version: "abc",
      model: "m",
      input_tokens: 1,
      output_tokens: 2,
      duration_ms: 3,
      seen_count: 1,
      similarities: [{ a: "note:n1", b: "note:n2", similarity: 0.9 }],
    });
  });

  it("names the file after the day", () => {
    expect(exportFileName(NOW)).toBe("atlas-assistent-logboek-2026-11-04.json");
  });

  it("the story fixture is a valid v1 document", () => {
    expect(assistantLogFixture.format).toBe(LOG_FORMAT);
    expect(JSON.parse(JSON.stringify(assistantLogFixture))).toEqual(assistantLogFixture);
  });
});

describe("log view helpers", () => {
  it("groups the last 30 days of runs per day in Amsterdam time, newest first", () => {
    const runs = [
      runRow({ id: "old", started_at: "2026-09-01T10:00:00.000Z" }),
      runRow({ id: "a", started_at: "2026-11-03T22:30:00.000Z" }), // 23:30 on the 3rd in Amsterdam
      runRow({ id: "b", started_at: "2026-11-03T23:30:00.000Z" }), // 00:30 on the 4th
      runRow({ id: "c", started_at: "2026-11-04T07:00:00.000Z" }),
    ];
    const days = groupRunsByDay(runs, NOW);
    expect(days.map((d) => [d.day, d.runs.map((r) => r.id)])).toEqual([
      ["2026-11-04", ["c", "b"]],
      ["2026-11-03", ["a"]],
    ]);
  });

  it("reads the outcome from the signal status; paused and skipped are not said", () => {
    expect(traceOutcome({ status: "asked", signal_status: "new" })).toBe("new");
    expect(traceOutcome({ status: "asked", signal_status: "dismissed" })).toBe("dismissed");
    expect(traceOutcome({ status: "asked", signal_status: "acted" })).toBe("acted");
    expect(traceOutcome({ status: "asked", signal_status: "skipped" })).toBe("unsaid");
    expect(traceOutcome({ status: "asked", signal_status: null })).toBe("unsaid");
    expect(traceOutcome({ status: "paused", signal_status: null })).toBe("unsaid");
  });

  it("turns the stored jsonb into plain strings", () => {
    expect(traceItemViews([{ title: "T", fragment: "F", stale: true }, 3, null, { title: 5 }])).toEqual([
      { title: "T", fragment: "F", stale: true },
      { title: "", fragment: "", stale: false },
    ]);
    expect(traceItemViews("nope")).toEqual([]);
    expect(traceAnswerView({ helpful: true, message_raw: "x", rejected: "link" })).toEqual({
      helpful: true,
      raw: "x",
      rejected: "link",
    });
    expect(traceAnswerView(null)).toBeNull();
  });
});

describe("trace builders", () => {
  const edge = (a: string, b: string, similarity: number) => ({
    a: { type: "note", id: a },
    b: { type: "note", id: b },
    similarity,
  });

  it("keeps only the pairs inside the cluster, once each, sorted", () => {
    const sources = [
      { type: "note", id: "n1" },
      { type: "note", id: "n2" },
      { type: "note", id: "n3" },
    ];
    expect(
      clusterSimilarities(sources, [
        edge("n2", "n1", 0.91234567),
        edge("n1", "n2", 0.85),
        edge("n3", "n2", 0.9),
        edge("n3", "x", 0.99),
      ]),
    ).toEqual([
      { a: "note:n1", b: "note:n2", similarity: 0.9123 },
      { a: "note:n2", b: "note:n3", similarity: 0.9 },
    ]);
  });

  it("leaves tokens and duration out for a paused trace", () => {
    const args = buildTraceArgs({
      dedupeKey: "k",
      status: "paused",
      items: [],
      similarities: [],
      promptVersion: "abc",
      model: "m",
      answer: null,
      inputTokens: null,
      outputTokens: null,
      durationMs: null,
    });
    expect(args.p_input_tokens).toBeUndefined();
    expect(args.p_duration_ms).toBeUndefined();
    expect(args.p_answer).toBeNull();
    expect(buildTraceArgs({ ...{ dedupeKey: "k", status: "asked" as const, items: [], similarities: [], promptVersion: "a", model: "m", answer: null, inputTokens: 1, outputTokens: 2 }, durationMs: 12.6 }).p_duration_ms).toBe(13);
  });
});
