"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { loadAssistantLog } from "@/lib/assistant/log-actions";
import {
  dayFunnel,
  dayOutcomes,
  groupRunsByDay,
  parseTraceAnswer,
  parseTraceItems,
  traceOutcome,
  type AssistantLogView,
  type LogTrace,
  type TraceOutcome,
} from "@/lib/assistant/log-types";

// design: Claude-designed (#757) — level-2 panel opened from AiSettingsPanel, composed
// from SidePanel, Button and Tag; contract in design/notes/AssistantLogPanel.md.

export interface AssistantLogPanelProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the log (stories); at runtime the panel reads it through `loadAssistantLog` whenever it opens. */
  initialLog?: AssistantLogView | null;
}

const OUTCOME_VARIANT: Record<TraceOutcome, "neutral" | "medium" | "low" | "highlight"> = {
  new: "highlight",
  dismissed: "neutral",
  acted: "low",
  unsaid: "neutral",
};

const EXPORT_PATH = "/api/assistant-log/export";

export function AssistantLogPanel({ open, onClose, initialLog = null }: AssistantLogPanelProps) {
  const t = useTranslations("settings.assistantLog");
  const tSidePanel = useTranslations("components.sidePanel");
  const locale = useLocale();
  const headingId = useId();

  const [log, setLog] = useState<AssistantLogView | null>(initialLog);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadAssistantLog();
    if (result.success) setLog(result.data);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && initialLog === null) void load();
  }, [open, initialLog, load]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(EXPORT_PATH, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`export ${response.status}`);
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "atlas-assistant-log.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("errors.export"));
    } finally {
      setExporting(false);
    }
  }

  // Fixed zone: the server render and the browser agree, so there is no hydration mismatch.
  const formatDay = (day: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${day}T00:00:00Z`),
    );
  const formatSeen = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(
      new Date(iso),
    );

  const days = log ? groupRunsByDay(log.runs) : [];

  return (
    <SidePanel level={2} open={open} onClose={onClose} title={t("title")} closeLabel={tSidePanel("closeLabel")}>
      <section className="flex flex-col gap-stack-md" aria-labelledby={headingId}>
        <div className="flex flex-col gap-stack-xs">
          <h3 id={headingId} className="text-base font-semibold text-text-primary">
            {t("title")}
          </h3>
          <p className="text-base text-text-secondary">{t("intro")}</p>
        </div>

        <div className="flex flex-col gap-stack-xs">
          <Button variant="outline" icon="Download" onClick={handleExport} disabled={exporting}>
            {exporting ? t("export.busy") : t("export.label")}
          </Button>
          <p className="text-sm text-text-secondary">{t("export.help")}</p>
          {exportError ? <p className="text-base font-semibold text-priority-urgent">{exportError}</p> : null}
        </div>

        {error ? <p className="text-base font-semibold text-priority-urgent">{t(`errors.${error}`)}</p> : null}
        {loading && !log ? <p className="text-base text-text-secondary">{t("loading")}</p> : null}

        {log ? (
          <>
            <div className="flex flex-col gap-stack-sm">
              <h4 className="text-base font-semibold text-text-primary">{t("runs.title")}</h4>
              {days.length === 0 ? (
                <p className="text-base text-text-secondary">{t("runs.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-stack-sm">
                  {days.map(({ day, runs }) => {
                    const funnel = dayFunnel(runs);
                    const inputTokens = runs.reduce((sum, run) => sum + run.input_tokens, 0);
                    const outputTokens = runs.reduce((sum, run) => sum + run.output_tokens, 0);
                    return (
                      <li
                        key={day}
                        className="flex flex-col gap-stack-xs rounded-control border border-stroke-primary bg-surface-highlight-white p-component-sm"
                      >
                        <div className="flex items-baseline justify-between gap-inline-sm">
                          <span className="text-base font-semibold text-text-primary">{formatDay(day)}</span>
                          <span className="text-sm text-text-secondary">{t("runs.count", { count: runs.length })}</span>
                        </div>
                        <ul className="flex flex-wrap gap-inline-xs">
                          {dayOutcomes(runs).map(({ outcome, count }) => (
                            <li key={outcome}>
                              <Tag variant={outcome === "error" ? "urgent" : outcome === "ok" ? "low" : "neutral"}>
                                {t(`runs.outcomes.${outcome}`)} {count}
                              </Tag>
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm text-text-secondary">
                          {t("runs.funnel", {
                            edges: funnel.edges,
                            clusters: funnel.clusters,
                            known: funnel.known,
                            not_fresh: funnel.not_fresh,
                            candidates: funnel.candidates,
                            calls: funnel.calls,
                            helpful: funnel.helpful,
                            rejected: funnel.rejected_by_cleaner,
                          })}
                        </p>
                        {funnel.calls > 0 ? (
                          <p className="text-sm text-text-secondary">
                            {t("runs.tokens", { input: inputTokens, output: outputTokens })}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-stack-sm">
              <h4 className="text-base font-semibold text-text-primary">{t("traces.title")}</h4>
              {log.traces.length === 0 ? (
                <p className="text-base text-text-secondary">{t("traces.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-stack-sm">
                  {log.traces.map((trace) => (
                    <TraceCard key={trace.id} trace={trace} t={t} formatSeen={formatSeen} />
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </section>
    </SidePanel>
  );
}

type Translate = ReturnType<typeof useTranslations<"settings.assistantLog">>;

function TraceCard({ trace, t, formatSeen }: { trace: LogTrace; t: Translate; formatSeen: (iso: string) => string }) {
  const items = parseTraceItems(trace.items);
  const answer = parseTraceAnswer(trace.answer);
  const outcome = traceOutcome(trace);
  const asked = trace.status === "asked";
  return (
    <li className="flex flex-col gap-stack-sm rounded-control border border-stroke-primary bg-surface-highlight-white p-component-sm">
      <div className="flex flex-wrap items-center gap-inline-xs">
        <Tag variant={asked ? "low" : "neutral"}>{t(`traces.status.${trace.status === "asked" ? "asked" : "paused"}`)}</Tag>
        <span className="text-sm text-text-secondary">
          {t("traces.lastSeen", { date: formatSeen(trace.last_seen_at) })}
          {trace.seen_count > 1 ? `, ${t("traces.seen", { count: trace.seen_count })}` : ""}
        </span>
      </div>

      <div className="flex flex-col gap-stack-xs">
        <h5 className="text-sm font-semibold text-text-primary">{t("traces.sentTitle")}</h5>
        <ul className="flex flex-col gap-stack-xs">
          {items.map((item, index) => (
            <li key={`${item.type}:${item.id}:${index}`} className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary">
                {t(`traces.kind.${item.kind}`)}: {item.title}
                {item.stale ? ` (${t("traces.stale")})` : ""}
              </span>
              {item.fragment ? <span className="text-sm text-text-secondary">{item.fragment}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-stack-xs">
        <h5 className="text-sm font-semibold text-text-primary">{t("traces.answerTitle")}</h5>
        {answer ? (
          <>
            <p className="text-sm text-text-primary">
              {answer.helpful ? t("traces.helpful") : t("traces.notHelpful")}
              {answer.rejected ? `. ${t(`traces.rejected.${answer.rejected}`)}` : ""}
            </p>
            {answer.message ? <p className="text-sm text-text-primary">{answer.message}</p> : null}
            {answer.rejected === "link" && answer.message_raw ? (
              <p className="text-sm text-text-secondary">{t("traces.rawMessage", { message: answer.message_raw })}</p>
            ) : null}
            <p className="text-sm text-text-secondary">
              {t("traces.tokens", { input: trace.input_tokens, output: trace.output_tokens })}
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">{t("traces.notAsked")}</p>
        )}
      </div>

      <div className="flex items-center gap-inline-xs">
        <span className="text-sm font-semibold text-text-primary">{t("traces.outcomeTitle")}</span>
        <Tag variant={OUTCOME_VARIANT[outcome]}>{t(`traces.outcome.${outcome}`)}</Tag>
      </div>
    </li>
  );
}
