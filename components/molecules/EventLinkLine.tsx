"use client";

// design: Claude-designed (#489)
import { useFormatter, useTranslations } from "next-intl";
import { Icon } from "@/components/atoms/Icon";
import { AGENDA_TIME_ZONE } from "@/lib/agenda/time";
import { cn } from "@/lib/ui/cn";
import type { AgendaEventRef } from "@/lib/agenda/links";

/**
 * "In agenda: <afspraak>, <datum>" on a recipe, card or note that is linked to
 * events (ADR-0037 s4). Nothing renders without events. See design/notes/EventLinkLine.md.
 */
export interface EventLinkLineProps {
  /** Soonest first; the caller sorts. */
  events: AgendaEventRef[];
  className?: string;
}

const MAX_SHOWN = 3;

export function EventLinkLine({ events, className }: EventLinkLineProps) {
  const t = useTranslations("components.eventLinkLine");
  const format = useFormatter();
  if (events.length === 0) return null;

  const shown = events.slice(0, MAX_SHOWN);
  const hidden = events.length - shown.length;
  // An all-day event is stored as UTC midnight: show its date in UTC, a timed one in the Agenda zone.
  const date = (event: AgendaEventRef) =>
    format.dateTime(new Date(event.startsAt), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: event.allDay ? "UTC" : AGENDA_TIME_ZONE,
    });

  return (
    <p className={cn("flex items-center gap-inline-sm text-sm font-semibold text-text-secondary", className)}>
      <Icon name="Calendar" size={16} className="shrink-0" />
      <span className="min-w-0 break-words">
        {t("label")} {shown.map((event) => `${event.title}, ${date(event)}`).join(" · ")}
        {hidden > 0 && ` ${t("more", { count: hidden })}`}
      </span>
    </p>
  );
}
