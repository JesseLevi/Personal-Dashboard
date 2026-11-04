import { describe, expect, it } from "vitest";
import { exportFileName, serializeAssistantLog } from "@/lib/assistant/log-export";
import {
  EXPORT_FORMAT,
  dayFunnel,
  dayOutcomes,
  groupRunsByDay,
  parseTraceAnswer,
  parseTraceItems,
  traceOutcome,
  type LogRun,
  type LogTrace,
} from "@/lib/assistant/log-types";
import { buildConfig } from "@/lib/assistant/pattern-log";

// Serializer and view helpers of the Assistent log (#757, ADR-0060 §5).

const config = buildConfig({ model: "m", system: "s", maxCallsPerDay: 3, maxCandidates: 6 });

const run = (over: Partial<LogRun>): LogRun => ({
  id: "r",
  path: "lazy",
  started_at: "2026-10-26T10:00:00Z",
  duration_ms: 10,
  outcome: "ok",
  error_code: null,
  edges: 4,
  similarity_bands: {},
  clusters: 1,
  cluster_sizes: {},
  known: 0,
  not_fresh: 0,
  candidates: 1,
  calls: 1,
  helpful: 1,
  not_helpful: 0,
  rejected_by_cleaner: 0,
  call_failures: 0,
  input_tokens: 100,
  output_tokens: 20,
  config: {},
  created_at: "2026-10-26T10:00:00Z",
  ...over,
});

const trace = (over: Partial<LogTrace>): LogTrace => ({
  id: "t",
  dedupe_key: "k",
  status: "asked",
  items: [],
  similarities: [],
  prompt_version: "abc",
  model: "m",
  answer: null,
  input_tokens: 0,
  output_tokens: 0,
  duration_ms: 0,
  signal_id: null,
  first_seen_at: "2026-10-26T10:00:00Z",
  last_seen_at: "2026-10-26T10:00:00Z",
  seen_count: 1,
  signal_status: null,
  status_changed_at: null,
  ...over,
});

describe("serializeAssistantLog", () => {
  const exportedAt = new Date("2026-10-27T08:00:00Z");

  it("returns the v1 document with config, runs and traces", () => {
    const doc = serializeAssistantLog({
      exportedAt,
      config,
      runs: [run({ id: "r1" })],
      traces: [trace({ id: "t1", signal_status: "dismissed", status_changed_at: "2026-10-27T07:00:00Z" })],
    });
    expect(Object.keys(doc)).toEqual(["format", "exported_at", "config", "runs", "traces"]);
    expect(doc.format).toBe("atlas.assistant-log.v1");
    expect(doc.format).toBe(EXPORT_FORMAT);
    expect(doc.exported_at).toBe("2026-10-27T08:00:00.000Z");
    expect(doc.config).toEqual(config);
    expect(doc.runs).toHaveLength(1);
    expect(doc.traces[0]).toMatchObject({ id: "t1", signal_status: "dismissed", status_changed_at: "2026-10-27T07:00:00Z" });
  });

  it("gives a trace without a signal explicit nulls, and survives a JSON round trip", () => {
    const doc = serializeAssistantLog({ exportedAt, config, runs: [], traces: [trace({ status: "paused" })] });
    expect(doc.traces[0].signal_status).toBeNull();
    expect(doc.traces[0].status_changed_at).toBeNull();
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("never carries a user_id", () => {
    const doc = serializeAssistantLog({ exportedAt, config, runs: [run({})], traces: [trace({})] });
    expect(JSON.stringify(doc)).not.toContain("user_id");
  });

  it("names the file after the export date", () => {
    expect(exportFileName(exportedAt)).toBe("atlas-assistant-log-2026-10-27.json");
  });
});

describe("traceOutcome", () => {
  it("maps the signal status to the member-facing outcome", () => {
    expect(traceOutcome({ status: "asked", signal_status: "new" })).toBe("new");
    expect(traceOutcome({ status: "asked", signal_status: "dismissed" })).toBe("dismissed");
    expect(traceOutcome({ status: "asked", signal_status: "acted" })).toBe("acted");
  });

  it("is 'unsaid' for a skipped signal, no signal, and every paused trace", () => {
    expect(traceOutcome({ status: "asked", signal_status: "skipped" })).toBe("unsaid");
    expect(traceOutcome({ status: "asked", signal_status: null })).toBe("unsaid");
    expect(traceOutcome({ status: "paused", signal_status: null })).toBe("unsaid");
  });
});

describe("parsing the jsonb columns", () => {
  it("keeps well-formed items and drops the rest", () => {
    const items = parseTraceItems([
      { type: "card", id: "c1", kind: "card", title: "T", fragment: "F", stale: true },
      "nonsense",
      { title: 4 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: "card", id: "c1", kind: "card", title: "T", fragment: "F", stale: true });
    expect(items[1]).toMatchObject({ title: "", fragment: "", stale: false });
    expect(parseTraceItems(null)).toEqual([]);
  });

  it("reads an answer and refuses a malformed one", () => {
    expect(parseTraceAnswer({ helpful: true, message_raw: "r", message: null, rejected: "link" })).toEqual({
      helpful: true,
      message_raw: "r",
      message: null,
      rejected: "link",
    });
    expect(parseTraceAnswer(null)).toBeNull();
    expect(parseTraceAnswer({ message: "x" })).toBeNull();
  });
});

describe("runs per day", () => {
  const runs = [
    run({ id: "a", started_at: "2026-10-26T05:30:00Z", outcome: "ok", edges: 5, calls: 1 }),
    run({ id: "b", started_at: "2026-10-26T12:00:00Z", outcome: "all_known", edges: 5, calls: 0, input_tokens: 0 }),
    run({ id: "c", started_at: "2026-10-25T12:00:00Z", outcome: "no_edges", edges: 0, calls: 0 }),
    // 23:30 UTC on the 26th is already the 27th in Amsterdam.
    run({ id: "d", started_at: "2026-10-26T23:30:00Z", outcome: "paused", edges: 3, calls: 0 }),
  ];

  it("groups in Europe/Amsterdam, newest day first", () => {
    const days = groupRunsByDay(runs);
    expect(days.map((d) => d.day)).toEqual(["2026-10-27", "2026-10-26", "2026-10-25"]);
    expect(days[1].runs.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("totals the funnel and counts outcomes in funnel order", () => {
    const day = groupRunsByDay(runs)[1].runs;
    expect(dayFunnel(day)).toMatchObject({ edges: 10, calls: 1 });
    expect(dayOutcomes(day)).toEqual([
      { outcome: "all_known", count: 1 },
      { outcome: "ok", count: 1 },
    ]);
  });
});
