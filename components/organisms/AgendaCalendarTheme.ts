import type { CalendarOptions, EventDisplayInfo } from "@fullcalendar/react";
import type { AgendaItem } from "@/lib/agenda/types";
import { cn } from "@/lib/ui/cn";

/**
 * FullCalendar 7 class-name settings in Atlas tokens (design/notes/AgendaCalendar.md).
 * Everything here is a class string: FullCalendar's own geometry stays inline.
 */

const LINE = "border-stroke-lines";

type ItemStyle = "event" | "sync" | "meal" | "planned_card" | "deadline" | "draft";

export function itemKey(item: AgendaItem): Exclude<ItemStyle, "draft"> {
  if (item.kind === "event") return item.source === "sync" ? "sync" : "event";
  return item.kind;
}

// Hover/active/selected follow docs/design-tokens.md: white has fill steps, the
// highlight surfaces have none, so they move their border instead.
const ITEM_BASE: Record<ItemStyle, string> = {
  event:
    "border-stroke-primary bg-surface-highlight-white text-text-primary hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active",
  sync: "border-transparent bg-surface-highlight-blue text-text-highlight-blue hover:border-stroke-primary-hover active:border-stroke-primary-active",
  meal: "border-transparent bg-surface-highlight-green text-text-highlight-green hover:border-stroke-primary-hover active:border-stroke-primary-active",
  planned_card:
    "border-transparent bg-surface-highlight-yellow text-text-highlight-yellow hover:border-stroke-primary-hover active:border-stroke-primary-active",
  deadline: "border-transparent bg-transparent text-text-highlight-red hover:bg-surface-highlight-red active:bg-surface-highlight-red-active",
  draft: "border-dashed border-stroke-primary-active bg-surface-highlight-white text-text-secondary",
};

const ITEM_SELECTED: Partial<Record<ItemStyle, string>> = {
  event: "bg-surface-highlight-white-selected",
  sync: "border-stroke-primary-selected",
  meal: "border-stroke-primary-selected",
  planned_card: "border-stroke-primary-selected",
  deadline: "bg-surface-highlight-red-selected",
};

function itemOf(info: EventDisplayInfo): AgendaItem | undefined {
  return info.event.extendedProps.item as AgendaItem | undefined;
}

function listText(info: EventDisplayInfo): string {
  const item = itemOf(info);
  const style: ItemStyle = item ? itemKey(item) : "draft";
  return cn(ITEM_BASE[style].split(" ").filter((c) => c.startsWith("text-")).join(" "), item?.kind === "event" && item.missingSince && "opacity-60");
}

function eventSurface(info: EventDisplayInfo): string {
  const item = itemOf(info);
  const style: ItemStyle = item ? itemKey(item) : "draft";
  const muted = item?.kind === "event" && item.missingSince !== null;
  return cn(
    "border",
    ITEM_BASE[style],
    info.isSelected && ITEM_SELECTED[style],
    info.isDragging && !info.isMirror && "opacity-60",
    info.isMirror && "border-stroke-primary-active",
    muted && "border-dashed opacity-60",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-secondary-active",
  );
}

const todayCell = (isToday: boolean, isOther?: boolean) =>
  cn(isToday && "bg-surface-primary", isOther && "text-text-secondary");

const isSingleDay = (viewType: string) => viewType === "timeGridDay";

const resizeHit = "absolute inset-x-0 z-10";

export function buildAgendaCalendarOptions(): CalendarOptions {
  return {
    className: "flex h-full min-h-0 flex-col text-sm text-text-primary",
    viewClass:
      "min-h-0 flex-1 overflow-clip rounded-card border border-stroke-primary bg-surface-highlight-white [&_*::-webkit-scrollbar]:hidden [&_*]:[scrollbar-width:none]",
    fillerClass: cn("border", LINE),
    tableHeaderClass: "bg-surface-highlight-white",

    eventClass: (info) => eventSurface(info),
    navLinkClass: "hover:underline",

    // Day header
    dayHeaderClass: (info) =>
      cn(
        "border",
        LINE,
        info.inPopover && "border-x-0 border-t-0 px-component-sm py-component-xs",
        info.isToday && !info.inPopover && !isSingleDay(info.view.type) && "bg-surface-primary",
      ),
    dayHeaderInnerClass: "flex items-center gap-inline-xs px-component-xs py-component-sm text-sm font-semibold text-text-secondary",
    dayHeaderRowClass: cn("border", LINE),
    dayHeaderDividerClass: cn("border-b", LINE),

    // Day cell / lane
    dayRowClass: cn("border", LINE),
    dayCellClass: (info) => cn("border", LINE, todayCell(info.isToday && !isSingleDay(info.view.type), info.isOther)),
    dayCellTopClass: "flex justify-end p-component-xs",
    dayCellTopInnerClass: (info) =>
      cn(
        "rounded-control-inner px-component-xs text-sm font-semibold",
        info.isToday ? "bg-surface-secondary text-text-primary" : "text-text-secondary",
        info.isOther && "opacity-50",
      ),
    dayLaneClass: (info) => cn("border", LINE, info.isToday && !isSingleDay(info.view.type) && "bg-surface-primary"),
    dayLaneInnerClass: (info) => (info.isStack ? "m-inline-xs" : "ms-inline-xs me-inline-lg"),

    // Time axis
    slotLaneClass: (info) => cn("border", LINE, info.isMinor && "border-dotted"),
    slotHeaderRowClass: cn("border", LINE),
    slotHeaderClass: (info) => cn(info.isTime ? "justify-end" : "", "border", LINE, info.isMinor && "border-dotted"),
    slotHeaderInnerClass: "mx-component-sm my-component-xs text-xs font-semibold text-text-secondary",
    slotHeaderDividerClass: cn("border-e", LINE),
    allDayHeaderClass: "flex items-center justify-end",
    allDayHeaderInnerClass: "mx-component-sm my-component-xs text-xs font-semibold text-text-secondary",
    allDayDividerClass: cn("border-y bg-surface-primary", LINE),
    nowIndicatorLineClass: "border-t-2 border-text-highlight-red",
    nowIndicatorHeaderClass: "rounded-full border-text-highlight-red",
    nowIndicatorDotClass: "rounded-full border-text-highlight-red bg-text-highlight-red",
    highlightClass: "bg-surface-secondary",
    nonBusinessHoursClass: "bg-surface-primary",

    // Block events (all-day bars, month, columns)
    blockEventClass: "group relative rounded-control-inner",
    blockEventInnerClass: "flex min-w-0 flex-1",
    rowEventClass: "mx-inline-xs mb-stack-xs",
    rowEventInnerClass: "flex items-center px-component-xs py-stack-xs",
    columnEventClass: "ring-1 ring-surface-highlight-white",
    columnEventInnerClass: (info) => cn("flex min-w-0 flex-col", info.isShort ? "px-component-xs" : "p-component-xs"),
    columnEventBeforeClass: (info) =>
      info.isStartResizable && cn(resizeHit, "top-0 h-component-xs cursor-n-resize", info.isSelected && "top-0"),
    columnEventAfterClass: (info) =>
      info.isEndResizable &&
      cn(
        resizeHit,
        "bottom-0 flex h-component-sm cursor-s-resize items-end justify-center",
        info.isSelected && "after:mb-stack-xs after:h-component-sm after:w-component-sm after:rounded-full after:border after:border-stroke-primary-active after:bg-surface-highlight-white",
      ),

    // "+N more" and popover
    moreLinkClass: "outline-none focus-visible:outline-2 focus-visible:outline-stroke-secondary-active",
    rowMoreLinkClass:
      "mx-inline-xs rounded-control-inner px-component-xs text-xs font-semibold text-text-secondary hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active",
    columnMoreLinkClass:
      "rounded-control-inner border border-stroke-primary bg-surface-highlight-white px-component-xs text-xs font-semibold text-text-secondary hover:bg-surface-highlight-white-hover",
    popoverClass:
      "min-w-56 rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm text-text-primary",
    popoverCloseClass: "absolute end-component-sm top-component-sm rounded-control-inner hover:bg-surface-highlight-white-hover",

    // List view
    listDayClass: (info) => cn(!info.isLast && cn("border-b", LINE)),
    listDayHeaderClass: cn("flex items-center gap-inline-sm border-b bg-surface-primary px-component-lg py-component-sm", LINE),
    listDayHeaderInnerClass: "text-sm font-semibold text-text-primary last:text-text-secondary",
    views: {
      list: {
        eventClass: (info) => cn("border-0 bg-transparent", listText(info)),
      },
    },
    listItemEventClass: (info) =>
      cn(
        "flex items-center gap-inline-md border-b px-component-lg py-component-sm last:border-b-0",
        LINE,
        info.isInteractive && "hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active",
        info.isSelected && "bg-surface-highlight-white-selected",
      ),
    listItemEventInnerClass: "flex min-w-0 flex-1 items-center gap-inline-md",
    noEventsClass: "flex items-center justify-center py-stack-xxl text-text-secondary",
    noEventsInnerClass: "text-sm font-semibold",
  };
}
