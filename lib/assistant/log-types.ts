import type { Database } from "@/lib/database.types";
import type { RunConfig, TraceAnswer, TraceItem, TraceSimilarity } from "@/lib/assistant/pattern-log";

// Shapes of the Assistent log (ADR-0060 §5), shared by the server reads, the
// export serializer and the Settings panel. No I/O, safe in the browser.

type Tables = Database["public"]["Tables"];

/** A run row as the owner sees it; `user_id` never leaves the server. */
export type LogRun = Omit<Tables["assistant_pattern_runs"]["Row"], "user_id">;

export type SignalStatus = "new" | "dismissed" | "acted" | "skipped";

export type LogTrace = Omit<Tables["assistant_pattern_traces"]["Row"], "user_id"> & {
  /** `agent_signals.status` of the linked signal, or null when there is none. */
  signal_status: string | null;
  status_changed_at: string | null;
};

/** What the Settings panel reads: runs of the last 30 days, traces newest first. */
export type AssistantLogView = { runs: LogRun[]; traces: LogTrace[] };

export type AssistantLogResult =
  | { success: true; data: AssistantLogView }
  | { success: false; error: "unauthenticated" | "generic" };

export const LOG_VIEW_DAYS = 30;

export const EXPORT_FORMAT = "atlas.assistant-log.v1";

export type AssistantLogExport = {
  format: typeof EXPORT_FORMAT;
  exported_at: string;
  config: RunConfig;
  runs: LogRun[];
  traces: LogTrace[];
};

/** The member-facing outcome of a trace: Nieuw, Weggeklikt, Geopend or "Niet gezegd". */
export type TraceOutcome = "new" | "dismissed" | "acted" | "unsaid";

export function traceOutcome(trace: Pick<LogTrace, "status" | "signal_status">): TraceOutcome {
  if (trace.status !== "asked") return "unsaid";
  if (trace.signal_status === "new" || trace.signal_status === "dismissed" || trace.signal_status === "acted") {
    return trace.signal_status;
  }
  return "unsaid";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Tolerant read of the `items` jsonb: whatever is not shaped like an item is dropped. */
export function parseTraceItems(json: unknown): TraceItem[] {
  if (!Array.isArray(json)) return [];
  const items: TraceItem[] = [];
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const kind = raw.kind === "card" ? "card" : "note";
    items.push({
      type: raw.type === "card" ? "card" : "note",
      id: typeof raw.id === "string" ? raw.id : "",
      kind,
      title: typeof raw.title === "string" ? raw.title : "",
      fragment: typeof raw.fragment === "string" ? raw.fragment : "",
      stale: raw.stale === true,
    });
  }
  return items;
}

export function parseTraceAnswer(json: unknown): TraceAnswer | null {
  if (!isRecord(json) || typeof json.helpful !== "boolean") return null;
  return {
    helpful: json.helpful,
    message_raw: typeof json.message_raw === "string" ? json.message_raw : "",
    message: typeof json.message === "string" ? json.message : null,
    rejected: json.rejected === "empty" || json.rejected === "link" ? json.rejected : null,
  };
}

export type { TraceSimilarity };

export type RunDay = { day: string; runs: LogRun[] };

/** Runs grouped per calendar day in Europe/Amsterdam (the zone of the operator view), newest day first. */
export function groupRunsByDay(runs: readonly LogRun[]): RunDay[] {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const days = new Map<string, LogRun[]>();
  for (const run of [...runs].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))) {
    const day = format.format(new Date(run.started_at));
    days.set(day, [...(days.get(day) ?? []), run]);
  }
  return [...days.entries()].map(([day, list]) => ({ day, runs: list }));
}

export const FUNNEL_KEYS = [
  "edges",
  "clusters",
  "known",
  "not_fresh",
  "candidates",
  "calls",
  "helpful",
  "rejected_by_cleaner",
] as const;

export type FunnelKey = (typeof FUNNEL_KEYS)[number];

/** Totals of the funnel counters over a day's runs. */
export function dayFunnel(runs: readonly LogRun[]): Record<FunnelKey, number> {
  const total = Object.fromEntries(FUNNEL_KEYS.map((key) => [key, 0])) as Record<FunnelKey, number>;
  for (const run of runs) for (const key of FUNNEL_KEYS) total[key] += run[key];
  return total;
}

/** Outcome counts of a day's runs, in funnel order. */
export function dayOutcomes(runs: readonly LogRun[]): Array<{ outcome: string; count: number }> {
  const order = ["no_edges", "no_clusters", "all_known", "no_candidates", "paused", "budget", "ok", "error"];
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(run.outcome, (counts.get(run.outcome) ?? 0) + 1);
  return order.filter((o) => counts.has(o)).map((outcome) => ({ outcome, count: counts.get(outcome) as number }));
}
