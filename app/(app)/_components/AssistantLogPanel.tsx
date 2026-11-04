"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { getAssistantLog } from "@/lib/assistant/log-actions";
import type { AssistantLogExport, LogRun, LogTrace } from "@/lib/assistant/log-export";
import {
  LOG_TIME_ZONE,
  groupRunsByDay,
  traceAnswerView,
  traceItemViews,
  traceOutcome,
  type TraceOutcome,
} from "@/lib/assistant/log-view";

// design: Claude-designed (#757) — level-2 panel opened from AiSettingsPanel, built from
// SidePanel, Tag, Button and text; contract in design/notes/AssistantLogPanel.md.

export const ASSISTANT_LOG_EXPORT_URL = "/api/assistant-log/export";

export interface AssistantLogPanelProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the log and skips the read (stories only); at runtime the panel reads it on every open. */
  initialLog?: AssistantLogExport;
}

type LoadState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; log: AssistantLogExport };

const OUTCOME_VARIANT: Record<TraceOutcome, "highlight" | "neutral" | "low" | "medium"> = {
  new: "highlight",
  dismissed: "neutral",
  acted: "low",
  unsaid: "neutral",
};

export function AssistantLogPanel({ open, onClose, initialLog }: AssistantLogPanelProps) {
  const t = useTranslations("components.assistantLogPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const headingId = useId();
  const [state, setState] = useState<LoadState>(initialLog ? { phase: "ready", log: initialLog } : { phase: "loading" });

  // Read again on every open: the log changes while the member uses the app.
  useEffect(() => {
    if (!open || initialLog) return;
    let cancelled = false;
    getAssistantLog().then(
      (result) => {
        if (cancelled) return;
        setState(result.success ? { phase: "ready", log: result.data } : { phase: "error" });
      },
      () => {
        if (!cancelled) setState({ phase: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, initialLog]);

  // A download, not a navigation: the route answers with Content-Disposition: attachment.
  function handleExport() {
    window.location.assign(ASSISTANT_LOG_EXPORT_URL);
  }

  return (
    <SidePanel
      level={2}
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        <Button variant="filled" icon="Download" onClick={handleExport}>
          {t("exportLabel")}
        </Button>
      }
    >
      <section className="flex flex-col gap-stack-sm" aria-labelledby={headingId}>
        <h3 id={headingId} className="text-base font-semibold text-text-primary">
          {t("title")}
        </h3>
        <p className="text-base text-text-secondary">{t("intro")}</p>
        <p className="text-base text-text-secondary">{t("exportHelp")}</p>
      </section>
      {state.phase === "loading" ? <p className="text-base text-text-secondary">{t("loading")}</p> : null}
      {state.phase === "error" ? <p className="text-base font-semibold text-priority-urgent">{t("loadError")}</p> : null}
      {state.phase === "ready" ? <LogBody log={state.log} /> : null}
    </SidePanel>
  );
}

function LogBody({ log }: { log: AssistantLogExport }) {
  const t = useTranslations("components.assistantLogPanel");
  const format = useFormatter();
  const days = groupRunsByDay(log.runs, new Date(log.exported_at));

  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: LOG_TIME_ZONE });
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const stamp = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: LOG_TIME_ZONE });

  return (
    <>
      <section className="flex flex-col gap-stack-md">
        <h4 className="text-base font-semibold text-text-primary">{t("runsTitle")}</h4>
        {days.length === 0 ? <p className="text-base text-text-secondary">{t("runsEmpty")}</p> : null}
        {days.map(({ day, runs }) => (
          <div key={day} className="flex flex-col gap-stack-sm">
            <p className="text-base font-semibold text-text-primary">
              {dayLabel(day)}
              <span className="font-normal text-text-secondary"> · {t("dayRuns", { count: runs.length })}</span>
            </p>
            <ul className="flex flex-col gap-stack-sm">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-col gap-stack-xs">
                  <span className="text-base text-text-primary">
                    {time(run.started_at)} · {t(`path.${run.path === "cron" ? "cron" : "lazy"}`)}
                  </span>
                  <span className="text-base text-text-primary">{runOutcome(run, t)}</span>
                  <span className="text-sm text-text-secondary">
                    {t("funnel", {
                      edges: run.edges,
                      clusters: run.clusters,
                      known: run.known,
                      notFresh: run.not_fresh,
                      candidates: run.candidates,
                      calls: run.calls,
                      helpful: run.helpful,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-stack-md">
        <h4 className="text-base font-semibold text-text-primary">{t("tracesTitle")}</h4>
        {log.traces.length === 0 ? <p className="text-base text-text-secondary">{t("tracesEmpty")}</p> : null}
        <ul className="flex flex-col gap-stack-md">
          {log.traces.map((trace) => (
            <TraceCard key={trace.id} trace={trace} stamp={stamp} />
          ))}
        </ul>
      </section>
    </>
  );
}

type Translate = ReturnType<typeof useTranslations<"components.assistantLogPanel">>;

function runOutcome(run: LogRun, t: Translate): string {
  switch (run.outcome) {
    case "no_edges":
      return t("outcome.no_edges");
    case "no_clusters":
      return t("outcome.no_clusters");
    case "all_known":
      return t("outcome.all_known");
    case "no_candidates":
      return t("outcome.no_candidates");
    case "paused":
      return t("outcome.paused");
    case "budget":
      return t("outcome.budget");
    case "ok":
      return t("outcome.ok", { calls: run.calls });
    case "error":
      return t("outcome.error", { code: run.error_code ?? "?" });
    default:
      return run.outcome;
  }
}

function TraceCard({ trace, stamp }: { trace: LogTrace; stamp: (iso: string) => string }) {
  const t = useTranslations("components.assistantLogPanel");
  const outcome = traceOutcome(trace);
  const items = traceItemViews(trace.items);
  const answer = traceAnswerView(trace.answer);
  return (
    <li className="flex flex-col gap-stack-sm rounded-control border border-stroke-lines p-component-md">
      <div className="flex flex-wrap items-center gap-inline-xs">
        <Tag variant={trace.status === "asked" ? "medium" : "neutral"}>{t(`status.${trace.status === "asked" ? "asked" : "paused"}`)}</Tag>
        <Tag variant={OUTCOME_VARIANT[outcome]}>{t(`traceOutcome.${outcome}`)}</Tag>
        <span className="text-sm text-text-secondary">{stamp(trace.last_seen_at)}</span>
        {trace.seen_count > 1 ? (
          <span className="text-sm text-text-secondary">· {t("seenCount", { count: trace.seen_count })}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-stack-xs">
        <p className="text-sm font-semibold text-text-secondary">
          {trace.status === "asked" ? t("sentLabel") : t("wouldSendLabel")}
        </p>
        <ul className="flex flex-col gap-stack-xs">
          {items.map((item, index) => (
            <li key={index} className="flex flex-col">
              <span className="text-base font-semibold text-text-primary">{item.title || t("untitled")}</span>
              {item.fragment ? <span className="text-sm text-text-secondary">{item.fragment}</span> : null}
              {item.stale ? <span className="text-sm text-text-secondary">{t("staleNote")}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      {trace.status === "asked" ? (
        <div className="flex flex-col gap-stack-xs">
          <p className="text-sm font-semibold text-text-secondary">{t("answerLabel")}</p>
          {answer ? (
            <>
              <p className="text-base text-text-primary">{answer.helpful ? t("answerHelpful") : t("answerNotHelpful")}</p>
              {answer.raw ? <p className="text-base text-text-primary">{answer.raw}</p> : null}
              {answer.rejected ? <p className="text-sm text-text-secondary">{t(`rejected.${answer.rejected}`)}</p> : null}
            </>
          ) : (
            <p className="text-base text-text-secondary">{t("noAnswer")}</p>
          )}
          {trace.input_tokens !== null && trace.output_tokens !== null ? (
            <p className="text-sm text-text-secondary">
              {t("tokens", { input: trace.input_tokens, output: trace.output_tokens })}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
