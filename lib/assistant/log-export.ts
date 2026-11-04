import type { RunConfig } from "@/lib/assistant/pattern-log";
import { EXPORT_FORMAT, type AssistantLogExport, type LogRun, type LogTrace } from "@/lib/assistant/log-types";

// Serializer of "Exporteer voor analyse" (ADR-0060 §5): pure, one JSON document,
// no LLM. Field meanings: docs/guides/assistant-tuning.md.

export function serializeAssistantLog(args: {
  exportedAt: Date;
  config: RunConfig;
  runs: readonly LogRun[];
  traces: readonly LogTrace[];
}): AssistantLogExport {
  return {
    format: EXPORT_FORMAT,
    exported_at: args.exportedAt.toISOString(),
    config: args.config,
    runs: args.runs.map((run) => ({ ...run })),
    traces: args.traces.map((trace) => ({
      ...trace,
      signal_status: trace.signal_status ?? null,
      status_changed_at: trace.status_changed_at ?? null,
    })),
  };
}

export const exportFileName = (exportedAt: Date) =>
  `atlas-assistant-log-${exportedAt.toISOString().slice(0, 10)}.json`;
