import type { LogRun, LogTrace } from "@/lib/assistant/log-export";

// View-model helpers of the Assistent log panel (ADR-0060 §5). Pure.

/** Runs shown in the panel: the last 30 days. */
export const LOG_PANEL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dates are shown in one fixed zone so server and browser render the same text. */
export const LOG_TIME_ZONE = "Europe/Amsterdam";

export type RunDay = { day: string; runs: LogRun[] };

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOG_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` in the log's time zone. */
export const dayKey = (iso: string) => dayFormat.format(new Date(iso));

/** Runs of the last `days` days, newest day first, newest run first within a day. */
export function groupRunsByDay(runs: readonly LogRun[], now: Date, days = LOG_PANEL_DAYS): RunDay[] {
  const since = now.getTime() - days * DAY_MS;
  const byDay = new Map<string, LogRun[]>();
  for (const run of [...runs].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))) {
    if (Date.parse(run.started_at) < since) continue;
    const key = dayKey(run.started_at);
    byDay.set(key, [...(byDay.get(key) ?? []), run]);
  }
  return [...byDay].map(([day, list]) => ({ day, runs: list }));
}

export type TraceOutcome = "new" | "dismissed" | "acted" | "unsaid";

/**
 * What became of a trace, read from the linked signal: new, dismissed, acted. A paused trace,
 * a signal that was skipped (nothing said) and a trace whose signal is gone are all "unsaid".
 */
export function traceOutcome(trace: Pick<LogTrace, "status" | "signal_status">): TraceOutcome {
  if (trace.status !== "asked") return "unsaid";
  if (trace.signal_status === "new" || trace.signal_status === "dismissed" || trace.signal_status === "acted") {
    return trace.signal_status;
  }
  return "unsaid";
}

export type TraceItemView = { title: string; fragment: string; stale: boolean };

/** Items and answer as plain strings, whatever the stored jsonb holds. */
export function traceItemViews(items: unknown): TraceItemView[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw): TraceItemView[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const item = raw as Record<string, unknown>;
    return [
      {
        title: typeof item.title === "string" ? item.title : "",
        fragment: typeof item.fragment === "string" ? item.fragment : "",
        stale: item.stale === true,
      },
    ];
  });
}

export type TraceAnswerView = { helpful: boolean; raw: string; rejected: "empty" | "link" | null };

export function traceAnswerView(answer: unknown): TraceAnswerView | null {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return null;
  const a = answer as Record<string, unknown>;
  return {
    helpful: a.helpful === true,
    raw: typeof a.message_raw === "string" ? a.message_raw : "",
    rejected: a.rejected === "empty" || a.rejected === "link" ? a.rejected : null,
  };
}
