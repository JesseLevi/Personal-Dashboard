import type { Database } from "@/lib/database.types";

// The Assistent log as one document (ADR-0060 §5): the member's own runs and traces,
// the linked signal status per trace, and the current config. Pure: no I/O, no user_id.

export const LOG_FORMAT = "atlas.assistant-log.v1";

type RunRow = Database["public"]["Tables"]["assistant_pattern_runs"]["Row"];
type TraceRow = Database["public"]["Tables"]["assistant_pattern_traces"]["Row"];
type SignalState = { status: string; status_changed_at: string };

/** A trace row as read with its signal embedded (`agent_signals(status, status_changed_at)`). */
export type TraceWithSignal = TraceRow & { agent_signals?: SignalState | SignalState[] | null };

export type LogRun = Omit<RunRow, "user_id">;
export type LogTrace = Omit<TraceRow, "user_id"> & {
  signal_status: string | null;
  status_changed_at: string | null;
};

export type LogConfig = Record<string, string | number | boolean>;

export type AssistantLogExport = {
  format: typeof LOG_FORMAT;
  exported_at: string;
  config: LogConfig;
  runs: LogRun[];
  traces: LogTrace[];
};

export function toLogRun(row: RunRow): LogRun {
  const { user_id: _userId, ...run } = row;
  void _userId;
  return run;
}

export function toLogTrace(row: TraceWithSignal): LogTrace {
  const { user_id: _userId, agent_signals: embedded, ...trace } = row;
  void _userId;
  const signal = Array.isArray(embedded) ? (embedded[0] ?? null) : (embedded ?? null);
  return {
    ...trace,
    signal_status: signal?.status ?? null,
    status_changed_at: signal?.status_changed_at ?? null,
  };
}

export function serializeAssistantLog(args: {
  exportedAt: Date;
  config: LogConfig;
  runs: ReadonlyArray<RunRow>;
  traces: ReadonlyArray<TraceWithSignal>;
}): AssistantLogExport {
  return {
    format: LOG_FORMAT,
    exported_at: args.exportedAt.toISOString(),
    config: args.config,
    runs: args.runs.map(toLogRun),
    traces: args.traces.map(toLogTrace),
  };
}

/** The file name of the download, one per day. */
export function exportFileName(exportedAt: Date): string {
  return `atlas-assistent-logboek-${exportedAt.toISOString().slice(0, 10)}.json`;
}
