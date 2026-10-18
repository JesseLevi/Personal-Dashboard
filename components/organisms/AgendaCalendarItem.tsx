// design: Claude-designed (#485)
import type { EventDisplayInfo } from "@fullcalendar/react";
import type { AgendaItem, MealSlot } from "@/lib/agenda/types";
import { formatClock, isShortSpan } from "@/lib/ui/agenda-calendar";
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "../atoms/Icon";
import { itemKey } from "./AgendaCalendarTheme";

/** Translated strings the item content needs; resolved once by `AgendaCalendar` (FullCalendar renders this outside our hook scope). */
export interface AgendaItemLabels {
  slots: Record<MealSlot, string>;
  kinds: Record<"event" | "sync" | "meal" | "planned_card" | "deadline", string>;
  servings: (count: number) => string;
  missingFromSource: string;
  links: (count: number) => string;
}

const SLOT_ICON: Record<MealSlot, IconName> = {
  breakfast: "Croissant",
  lunch: "Sandwich",
  dinner: "Utensils",
  snack: "Cookie",
};

function leadingIcon(item: AgendaItem): IconName | null {
  switch (item.kind) {
    case "event":
      return item.source === "sync" ? "CalendarSync" : null;
    case "meal":
      return SLOT_ICON[item.slot];
    case "planned_card":
      return "Columns3";
    case "deadline":
      return "AlarmClockCheck";
  }
}

function metaLine(item: AgendaItem, timeText: string, labels: AgendaItemLabels): string {
  const parts: string[] = [];
  if (item.kind === "meal") parts.push(labels.slots[item.slot], labels.servings(item.servings));
  else if (item.kind === "planned_card") parts.push(`${item.board} · ${item.column}`);
  else if (item.kind === "event" && item.missingSince) parts.push(labels.missingFromSource);
  else if (timeText) parts.push(timeText);
  return parts.join(" · ");
}

export function AgendaItemContent({ info, labels }: { info: EventDisplayInfo; labels: AgendaItemLabels }) {
  const item = info.event.extendedProps.item as AgendaItem | undefined;
  if (!item) {
    return <span className="truncate px-component-xs text-sm font-semibold">{info.event.title}</span>;
  }

  const view = info.view.type;
  const isList = view.startsWith("list");
  const isGrid = view.startsWith("timeGrid");
  const isColumn = isGrid && !info.event.allDay;
  const oneLine = isColumn && isShortSpan(info.event.start, info.event.end);
  const stacked = isColumn && !oneLine;
  const icon = leadingIcon(item);
  const timeText = item.allDay ? "" : info.timeText;
  const meta = metaLine(item, isColumn || isList ? timeText : "", labels);
  // Three phone-width columns leave no room beside a title: the time moves to the tooltip.
  const startTime = oneLine && view !== "timeGridThreeDay" && info.event.start ? formatClock(info.event.start) : "";
  const inlineTime = oneLine ? startTime : !isColumn && !isList && item.kind !== "meal" ? timeText : "";
  const moment = item.kind === "meal" ? labels.slots[item.slot] : null;

  const title = (
    <span className={cn("text-sm font-semibold", isGrid && !oneLine ? "line-clamp-2 wrap-anywhere" : "truncate")}>
      <span className="sr-only">{labels.kinds[itemKey(item)]}: </span>
      {item.title}
      {moment && !isList && <span className="sr-only"> ({moment})</span>}
    </span>
  );

  const links =
    item.linkCount > 0 && !info.isNarrow ? (
      <span className="ms-auto flex shrink-0 items-center gap-inline-xs text-xs font-semibold" title={labels.links(item.linkCount)}>
        <Icon name="Link" size={12} />
        {item.linkCount}
      </span>
    ) : null;

  const tooltip = moment ? `${item.title} (${moment})` : oneLine && info.event.start ? `${item.title} ${formatClock(info.event.start)}` : item.title;

  if (stacked) {
    return (
      <div className="flex min-w-0 flex-1 flex-col" title={tooltip}>
        <div className="flex min-w-0 items-start gap-inline-xs">
          {icon && <Icon name={icon} size={16} className="shrink-0" />}
          {title}
          {links}
        </div>
        {meta && <span className="truncate text-xs font-semibold">{meta}</span>}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-inline-xs" title={tooltip}>
      {icon && <Icon name={icon} size={16} className="shrink-0" />}
      {inlineTime && !oneLine && <span className="shrink-0 text-xs font-semibold">{inlineTime}</span>}
      {title}
      {inlineTime && oneLine && <span className="shrink-0 text-xs font-semibold">{inlineTime}</span>}
      {meta && isList && <span className="truncate text-xs font-semibold">{meta}</span>}
      {links}
    </div>
  );
}
