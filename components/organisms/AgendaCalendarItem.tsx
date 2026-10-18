// design: Claude-designed (#485)
import type { EventDisplayInfo } from "@fullcalendar/react";
import type { AgendaItem, MealSlot } from "@/lib/agenda/types";
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "../atoms/Icon";
import { itemKey } from "./AgendaCalendarTheme";

/** Translated strings the item content needs; resolved once by `AgendaCalendar` (FullCalendar renders this outside our hook scope). */
export interface AgendaItemLabels {
  slots: Record<MealSlot, string>;
  kinds: Record<"event" | "sync" | "meal" | "planned_card" | "deadline", string>;
  servings: (count: number) => string;
  missingFromSource: string;
  recurring: string;
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
  const isColumn = view.startsWith("timeGrid") && !info.event.allDay;
  const stacked = isColumn && !info.isShort;
  const icon = leadingIcon(item);
  const timeText = item.allDay ? "" : info.timeText;
  const meta = metaLine(item, isColumn || isList ? timeText : "", labels);
  const inlineTime = !isColumn && !isList && timeText && item.kind !== "meal";
  const secondary = item.kind === "event" && item.source === "manual" ? "text-text-secondary" : "opacity-80";

  const title = (
    <span className={"truncate text-sm font-semibold"}>
      <span className="sr-only">{labels.kinds[itemKey(item)]}: </span>
      {item.title}
    </span>
  );

  const recurring =
    item.kind === "event" && item.recurring ? (
      <span className="flex shrink-0 items-center" title={labels.recurring}>
        <Icon name="Repeat" size={12} />
        <span className="sr-only">{labels.recurring}</span>
      </span>
    ) : null;

  const links =
    item.linkCount > 0 && !info.isNarrow ? (
      <span className={cn("ms-auto flex shrink-0 items-center gap-inline-xs text-xs font-semibold", secondary)} title={labels.links(item.linkCount)}>
        <Icon name="Link" size={12} />
        {item.linkCount}
      </span>
    ) : null;

  if (stacked) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-inline-xs">
          {icon && <Icon name={icon} size={16} className="shrink-0" />}
          {title}
          {recurring}
          {links}
        </div>
        {meta && <span className={cn("truncate text-xs font-semibold", secondary)}>{meta}</span>}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-inline-xs">
      {icon && <Icon name={icon} size={16} className="shrink-0" />}
      {inlineTime && <span className={cn("shrink-0 text-xs font-semibold", secondary)}>{timeText}</span>}
      {title}
      {recurring}
      {meta && (isList || isColumn) && <span className={cn("truncate text-xs font-semibold", secondary)}>{meta}</span>}
      {item.kind === "meal" && !isList && !isColumn && <span className={cn("truncate text-xs font-semibold", secondary)}>{labels.slots[item.slot]}</span>}
      {links}
    </div>
  );
}
