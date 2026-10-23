import type { CalendarOptions, EventDisplayInfo } from "@fullcalendar/react";
import { isUnderNowLabel } from "@/lib/agenda/time";
import { itemColor, type AgendaColor } from "@/lib/agenda/colors";
import type { AgendaItem } from "@/lib/agenda/types";
import { cn } from "@/lib/ui/cn";

/**
 * FullCalendar 7 class-name settings in Atlas tokens (design/notes/AgendaCalendar.md).
 * Everything here is a class string: FullCalendar's own geometry stays inline.
 */

const LINE = "border-stroke-lines";

export function itemKey(item: AgendaItem): "event" | "sync" | "meal" | "planned_card" | "deadline" {
  if (item.kind === "event") return item.source === "sync" ? "sync" : "event";
  return item.kind;
}

interface ColorClasses {
  /** Fill, text colour and the accent colour of the start-side stripe. */
  block: string;
  text: string;
  /** Fill only: the selected and hovered deadline. */
  tint: string;
}

// Tailwind only sees whole class names, so every colour is spelled out.
const COLOR_CLASSES: Record<AgendaColor, ColorClasses> = {
  red: {
    block: "bg-event-red-surface text-event-red-text border-s-event-red-accent",
    text: "text-event-red-text",
    tint: "bg-event-red-surface",
  },
  orange: {
    block: "bg-event-orange-surface text-event-orange-text border-s-event-orange-accent",
    text: "text-event-orange-text",
    tint: "bg-event-orange-surface",
  },
  amber: {
    block: "bg-event-amber-surface text-event-amber-text border-s-event-amber-accent",
    text: "text-event-amber-text",
    tint: "bg-event-amber-surface",
  },
  green: {
    block: "bg-event-green-surface text-event-green-text border-s-event-green-accent",
    text: "text-event-green-text",
    tint: "bg-event-green-surface",
  },
  teal: {
    block: "bg-event-teal-surface text-event-teal-text border-s-event-teal-accent",
    text: "text-event-teal-text",
    tint: "bg-event-teal-surface",
  },
  blue: {
    block: "bg-event-blue-surface text-event-blue-text border-s-event-blue-accent",
    text: "text-event-blue-text",
    tint: "bg-event-blue-surface",
  },
  violet: {
    block: "bg-event-violet-surface text-event-violet-text border-s-event-violet-accent",
    text: "text-event-violet-text",
    tint: "bg-event-violet-surface",
  },
  pink: {
    block: "bg-event-pink-surface text-event-pink-text border-s-event-pink-accent",
    text: "text-event-pink-text",
    tint: "bg-event-pink-surface",
  },
  stone: {
    block: "bg-event-stone-surface text-event-stone-text border-s-event-stone-accent",
    text: "text-event-stone-text",
    tint: "bg-event-stone-surface",
  },
};


// Hover/active/selected move the border on three sides; the start side keeps the colour stripe.
const BLOCK =
  "border border-s-4 border-transparent hover:border-y-stroke-primary-hover hover:border-e-stroke-primary-hover active:border-y-stroke-primary-active active:border-e-stroke-primary-active";
const BLOCK_SELECTED = "border-y-stroke-primary-selected border-e-stroke-primary-selected";
const BLOCK_MIRROR = "border-y-stroke-primary-active border-e-stroke-primary-active";
const DEADLINE = "border border-transparent bg-transparent text-event-red-text hover:bg-event-red-surface active:border-stroke-primary-active";
const DRAFT = "border border-dashed border-stroke-primary-active bg-surface-highlight-white text-text-secondary";

function itemOf(info: EventDisplayInfo): AgendaItem | undefined {
  return info.event.extendedProps.item as AgendaItem | undefined;
}

function listText(info: EventDisplayInfo): string {
  const item = itemOf(info);
  return cn(item ? COLOR_CLASSES[itemColor(item)].text : "text-text-secondary", item?.kind === "event" && item.missingSince && "opacity-60");
}

function eventSurface(info: EventDisplayInfo): string {
  const item = itemOf(info);
  const isDeadline = item?.kind === "deadline";
  const muted = item?.kind === "event" && item.missingSince !== null;
  return cn(
    !item && DRAFT,
    item && !isDeadline && cn(BLOCK, COLOR_CLASSES[itemColor(item)].block),
    isDeadline && DEADLINE,
    info.isSelected && item && (isDeadline ? COLOR_CLASSES.red.tint : BLOCK_SELECTED),
    info.isDragging && !info.isMirror && "opacity-60",
    info.isMirror && (item && !isDeadline ? BLOCK_MIRROR : "border-stroke-primary-active"),
    muted && "border-dashed opacity-60",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-secondary-active",
  );
}

// A tint, not an opaque fill: the slot lines underneath the day lanes stay visible in light and dark.
const TODAY_TINT = "bg-surface-secondary/40";

/** The date of today in a day header or month cell, and the time label on the axis. */
export const TODAY_CHIP = "bg-event-red-surface text-event-red-text";

const todayCell = (isToday: boolean, isOther?: boolean) => cn(isToday && TODAY_TINT, isOther && "text-text-secondary");

const isSingleDay = (viewType: string) => viewType === "timeGridDay";

// Every label of the time axis has one width, so the now label can sit exactly over an hour label.
const AXIS_LABEL = "mx-component-sm my-component-xs w-14 text-xs font-semibold text-text-secondary";

// The now label sits over the hour labels near it (only where the grid shows today); they keep their space.
function hiddenByNowLabel(info: { time?: { milliseconds: number }; view: { currentStart: Date; currentEnd: Date } }): boolean {
  const now = new Date();
  if (info.time === undefined || now < info.view.currentStart || now >= info.view.currentEnd) return false;
  return isUnderNowLabel(info.time.milliseconds / 60_000, now);
}

const resizeHit = "absolute inset-x-0 z-10";

/** `entering`: the items fade in, for the first paint after the skeleton. */
export function buildAgendaCalendarOptions(entering = false): CalendarOptions {
  const enter = entering && "animate-agenda-item-in";
  return {
    className: "flex h-full min-h-0 flex-col text-sm text-text-primary",
    viewClass:
      "min-h-0 flex-1 overflow-clip rounded-card border border-stroke-primary bg-surface-highlight-white [&_*::-webkit-scrollbar]:hidden [&_*]:[scrollbar-width:none]",
    fillerClass: cn("border", LINE),
    tableHeaderClass: "bg-surface-highlight-white",

    eventClass: (info) => cn(eventSurface(info), enter),
    navLinkClass: "hover:underline",

    // Day header
    dayHeaderClass: (info) =>
      cn(
        "border",
        LINE,
        info.inPopover && "border-x-0 border-t-0 px-component-sm py-component-xs",
        info.isToday && !info.inPopover && !isSingleDay(info.view.type) && TODAY_TINT,
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
        info.isToday ? TODAY_CHIP : "text-text-secondary",
        info.isOther && "opacity-50",
      ),
    dayLaneClass: (info) => cn("border", LINE, info.isToday && !isSingleDay(info.view.type) && TODAY_TINT),
    dayLaneInnerClass: (info) => (info.isStack ? "m-inline-xs" : "mx-inline-xs"),

    // Time axis
    slotLaneClass: (info) => cn("border", LINE, info.isMinor && "border-dotted"),
    slotHeaderRowClass: cn("border", LINE),
    slotHeaderClass: (info) => cn(info.isTime ? "justify-end" : "", "border", LINE, info.isMinor && "border-dotted"),
    slotHeaderInnerClass: (info) => cn(AXIS_LABEL, "text-end", hiddenByNowLabel(info) && "invisible"),
    slotHeaderDividerClass: cn("border-e", LINE),
    allDayHeaderClass: "flex items-center justify-end",
    allDayHeaderInnerClass: cn(AXIS_LABEL, "text-end"),
    allDayDividerClass: cn("border-y bg-surface-primary", LINE),
    nowIndicatorLineClass: "border-t-2 border-event-red-accent",
    nowIndicatorHeaderClass: cn(AXIS_LABEL, "start-0 -translate-y-1/2 rounded-control-inner text-center", TODAY_CHIP),
    nowIndicatorDotClass: "rounded-full border-event-red-accent bg-event-red-accent",
    highlightClass: "border border-dashed border-stroke-primary-active bg-surface-secondary",
    nonBusinessHoursClass: "bg-surface-primary",

    // Block events (all-day bars, month, columns)
    blockEventClass: "group relative rounded-control-inner",
    blockEventInnerClass: "flex min-w-0 flex-1",
    rowEventClass: "mx-inline-xs mb-stack-xs",
    rowEventInnerClass: "flex items-center px-component-xs py-stack-xs",
    // The selection mirror (no item) fills the whole cell: it cancels the lane's inset. Real items keep it.
    columnEventClass: (info) => (info.isMirror && !itemOf(info) ? "-mx-inline-xs" : "overflow-clip ring-1 ring-surface-highlight-white"),
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
        eventClass: (info) => cn("border-0 bg-transparent", listText(info), enter),
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
