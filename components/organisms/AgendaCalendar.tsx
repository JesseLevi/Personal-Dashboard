// design: Claude-designed (#485)
"use client";

import "@fullcalendar/react/skeleton.css";
import FullCalendar, { type CalendarOptions, type CalendarRef } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import nlLocale from "@fullcalendar/react/locales/nl";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgendaItem } from "@/lib/agenda/types";
import type { AgendaView } from "@/lib/agenda/view";
import {
  AGENDA_SLOT_MINUTES,
  AGENDA_SNAP_MINUTES,
  AGENDA_TRAY_ATTRIBUTE,
  clipBox,
  compareEventOrder,
  normalizeSpan,
  slotBox,
  slotForSingleSnap,
  toEventInputs,
  type AgendaSpan,
  type Box,
  type EventOrderSubject,
} from "@/lib/ui/agenda-calendar";
import { cn } from "@/lib/ui/cn";
import { AgendaItemContent, type AgendaItemLabels } from "./AgendaCalendarItem";
import { buildAgendaCalendarOptions } from "./AgendaCalendarTheme";
import { AGENDA_LONG_PRESS_MS, getAgendaDragPayload, type AgendaDragPayload } from "./useAgendaDraggable";

export type { AgendaView };

export interface AgendaChange extends AgendaSpan {
  item: AgendaItem;
}

export interface AgendaExternalDrop {
  payload: AgendaDragPayload;
  start: string;
  allDay: boolean;
  /** Set when the drop landed on an event (`calendar_events.id`), not on an empty slot. */
  eventId?: string;
}

const EVENT_ID_ATTRIBUTE = "data-agenda-event-id";
const ITEM_ATTRIBUTE = "data-agenda-item";
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
/** A tap that follows a `select` within this time is the same gesture: do not select twice. */
const TAP_DEDUPE_MS = 400;
const CELL_SELECTOR = '[role="cell"][data-date]';
const INTERACTIVE_SELECTOR = `[${ITEM_ATTRIBUTE}], a, button, [role="button"]`;

function toBox(rect: DOMRect): Box {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function scrollParent(el: Element, within: Element): Element | null {
  for (let node = el.parentElement; node && node !== within; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * Dashed outline under the mouse on the empty cell it would select: one slot of
 * a day column in the time grid, a whole cell in the all-day row and month.
 * Pointer-driven and frame-throttled, no React state; the overlay is positioned
 * imperatively (like FullCalendar does for its own geometry).
 */
function useCellHover(
  rootRef: React.RefObject<HTMLDivElement | null>,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  viewName: string,
) {
  useEffect(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    if (!root || !overlay || !window.matchMedia(HOVER_QUERY).matches) return;
    const timeGrid = viewName.startsWith("timeGrid");
    let frame = 0;
    const hide = () => {
      cancelAnimationFrame(frame);
      overlay.classList.add("hidden");
    };
    const place = (box: Box) => {
      const origin = root.getBoundingClientRect();
      overlay.style.top = `${box.top - origin.top}px`;
      overlay.style.left = `${box.left - origin.left}px`;
      overlay.style.width = `${box.width}px`;
      overlay.style.height = `${box.height}px`;
      overlay.classList.remove("hidden");
    };
    const onMove = (event: PointerEvent) => {
      hide();
      if (event.pointerType !== "mouse" || event.buttons !== 0 || !(event.target instanceof Element)) return;
      const { target, clientY } = event;
      frame = requestAnimationFrame(() => {
        const cell = target.closest(CELL_SELECTOR);
        if (!cell || !root.contains(cell) || target.closest(INTERACTIVE_SELECTOR)) return;
        const rect = toBox(cell.getBoundingClientRect());
        const scroller = timeGrid ? scrollParent(cell, root) : null;
        const box = scroller ? clipBox(slotBox(rect, clientY), toBox(scroller.getBoundingClientRect())) : rect;
        if (box) place(box);
      });
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", hide);
    root.addEventListener("pointerdown", hide);
    root.addEventListener("scroll", hide, true);
    return () => {
      hide();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", hide);
      root.removeEventListener("pointerdown", hide);
      root.removeEventListener("scroll", hide, true);
    };
  }, [rootRef, overlayRef, viewName]);
}

// A drop is reported per date; the event under the pointer is found in the DOM.
function elementsAtPoint(event: Event): Element[] {
  const pointer = "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
  return pointer ? document.elementsFromPoint(pointer.clientX, pointer.clientY) : [];
}

function eventIdAtPoint(event: Event): string | undefined {
  const hit = elementsAtPoint(event).find((el) => el.hasAttribute(EVENT_ID_ATTRIBUTE));
  return hit?.getAttribute(EVENT_ID_ATTRIBUTE) ?? undefined;
}

function isOverTray(event: Event): boolean {
  return elementsAtPoint(event).some((el) => el.hasAttribute(AGENDA_TRAY_ATTRIBUTE));
}

export interface AgendaCalendarProps {
  items: AgendaItem[];
  view: AgendaView;
  /** Any day inside the range to show, `YYYY-MM-DD`. */
  date: string;
  onSelectSlot?: (span: AgendaSpan) => void;
  onItemClick?: (item: AgendaItem, el: HTMLElement) => void;
  /** Call `revert` when the move is refused; otherwise update `items`. */
  onItemMove?: (change: AgendaChange, revert: () => void) => void;
  onItemResize?: (change: AgendaChange, revert: () => void) => void;
  onExternalDrop?: (drop: AgendaExternalDrop) => void;
  /** An item from the grid was dropped on the plan drawer (an element with `AGENDA_TRAY_ATTRIBUTE`). */
  onItemDropOut?: (item: AgendaItem) => void;
  className?: string;
}

const VIEW_NAMES: Record<AgendaView, string> = {
  day: "timeGridDay",
  threeDay: "timeGridThreeDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
  list: "listWeek",
};

const TIME_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const NARROW_QUERY = "(max-width: 1023px)";

/** True below the `lg` breakpoint; false during SSR and the first client render. */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** A week does not fit a phone: it becomes three days. */
export function effectiveAgendaView(view: AgendaView, narrow: boolean): AgendaView {
  return narrow && view === "week" ? "threeDay" : view;
}

function itemOf(event: { extendedProps: Record<string, unknown> }): AgendaItem {
  return event.extendedProps.item as AgendaItem;
}

function spanOf(event: { startStr: string; endStr: string; allDay: boolean }): AgendaSpan {
  return normalizeSpan({ start: event.startStr, end: event.endStr || null, allDay: event.allDay });
}

export function AgendaCalendar({
  items,
  view,
  date,
  onSelectSlot,
  onItemClick,
  onItemMove,
  onItemResize,
  onExternalDrop,
  onItemDropOut,
  className,
}: AgendaCalendarProps) {
  const t = useTranslations("components.agendaCalendar");
  const locale = useLocale();
  const narrow = useIsNarrow();
  const calendarRef = useRef<CalendarRef>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const lastSelectRef = useRef(0);
  const viewName = VIEW_NAMES[effectiveAgendaView(view, narrow)];
  useCellHover(rootRef, hoverRef, viewName);

  const labels = useMemo<AgendaItemLabels>(
    () => ({
      slots: {
        breakfast: t("slots.breakfast"),
        lunch: t("slots.lunch"),
        dinner: t("slots.dinner"),
        snack: t("slots.snack"),
      },
      kinds: {
        event: t("kinds.event"),
        sync: t("kinds.sync"),
        meal: t("kinds.meal"),
        planned_card: t("kinds.planned_card"),
        deadline: t("kinds.deadline"),
      },
      servings: (count) => t("servings", { count }),
      missingFromSource: t("missingFromSource"),
      recurring: t("recurring"),
      links: (count) => t("links", { count }),
    }),
    [t],
  );

  const events = useMemo(() => toEventInputs(items), [items]);
  const theme = useMemo(buildAgendaCalendarOptions, []);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.unselect();
    if (api.view.type !== viewName) api.changeView(viewName, date);
    else api.gotoDate(date);
  }, [viewName, date]);

  useEffect(() => {
    calendarRef.current?.getApi().unselect();
  }, [items]);

  const handleMove = useCallback<NonNullable<CalendarOptions["eventDrop"]>>(
    (info) => onItemMove?.({ item: itemOf(info.event), ...spanOf(info.event) }, info.revert),
    [onItemMove],
  );
  const handleResize = useCallback<NonNullable<CalendarOptions["eventResize"]>>(
    (info) => onItemResize?.({ item: itemOf(info.event), ...spanOf(info.event) }, info.revert),
    [onItemResize],
  );

  const options: CalendarOptions = {
    ...theme,
    plugins: [timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin],
    initialView: viewName,
    initialDate: date,
    headerToolbar: false,
    height: "100%",
    expandRows: true,
    locale: locale === "nl" ? nlLocale : "en",
    firstDay: 1,
    eventTimeFormat: TIME_FORMAT,
    slotHeaderFormat: TIME_FORMAT,
    slotHeaderInterval: { hours: 1 },
    slotDuration: { minutes: AGENDA_SLOT_MINUTES },
    snapDuration: { minutes: AGENDA_SNAP_MINUTES },
    scrollTime: { hours: 7 },
    nowIndicator: true,
    allDayText: t("allDay"),
    noEventsText: t("noItems"),
    moreLinkText: (count) => t("moreLink", { count }),
    dayMaxEvents: true,
    eventOverlap: true,
    slotEventOverlap: false,
    events,
    eventOrder: (a: unknown, b: unknown) => compareEventOrder(a as EventOrderSubject, b as EventOrderSubject),
    eventDidMount: (info) => {
      // Drag mirrors of external items carry no agenda item.
      const item = itemOf(info.event) as AgendaItem | undefined;
      if (item) info.el.setAttribute(ITEM_ATTRIBUTE, "");
      if (item?.kind === "event") info.el.setAttribute(EVENT_ID_ATTRIBUTE, item.id);
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    droppable: true,
    longPressDelay: AGENDA_LONG_PRESS_MS,
    eventLongPressDelay: AGENDA_LONG_PRESS_MS,
    selectLongPressDelay: AGENDA_LONG_PRESS_MS,
    eventContent: (info) => <AgendaItemContent info={info} labels={labels} />,
    views: {
      ...theme.views,
      timeGridThreeDay: { type: "timeGrid", dayCount: 3 },
      timeGrid: {
        dayHeaderFormat: { weekday: "short", day: "numeric" },
        dayHeaderContent: (info) => (
          <>
            <span>{info.weekdayText}</span>
            <span className={cn("rounded-control-inner px-component-xs", info.isToday && "bg-surface-secondary text-text-primary")}>
              {info.dayNumberText}
            </span>
          </>
        ),
      },
      dayGrid: { dayHeaderFormat: { weekday: "short" } },
    },
    select: (info) => {
      lastSelectRef.current = Date.now();
      const span = normalizeSpan({ start: info.startStr, end: info.endStr, allDay: info.allDay });
      // A click (one snap) selects the whole slot, like the hover outline shows.
      const slot = slotForSingleSnap(span, AGENDA_SNAP_MINUTES, AGENDA_SLOT_MINUTES);
      if (slot) calendarRef.current?.getApi().select(slot.start, slot.end);
      else onSelectSlot?.(span);
    },
    // A tap selects the cell like a click does on desktop; FullCalendar skips it for scrolls and event taps.
    dateClick: (info) => {
      const tappedAt = Date.now();
      const api = calendarRef.current?.getApi();
      window.setTimeout(() => {
        if (!api || lastSelectRef.current >= tappedAt - TAP_DEDUPE_MS) return;
        if (info.allDay) api.select(info.dateStr);
        // One snap, so `select` widens it to the slot it falls in.
        else api.select(info.date, new Date(info.date.getTime() + AGENDA_SNAP_MINUTES * 60_000));
      }, TAP_DEDUPE_MS / 4);
    },
    eventClick: (info) => onItemClick?.(itemOf(info.event), info.el),
    eventDragStop: (info) => {
      const item = itemOf(info.event) as AgendaItem | undefined;
      if (item && isOverTray(info.jsEvent)) onItemDropOut?.(item);
    },
    eventDrop: handleMove,
    eventResize: handleResize,
    drop: (info) => {
      const payload = getAgendaDragPayload(info.draggedEl);
      if (payload) {
        const eventId = eventIdAtPoint(info.jsEvent);
        onExternalDrop?.({ payload, start: info.dateStr, allDay: info.allDay, ...(eventId ? { eventId } : {}) });
      }
    },
  };

  return (
    <div ref={rootRef} className={cn("relative h-full min-h-0", className)} role="region" aria-label={t("label")}>
      <FullCalendar ref={calendarRef} {...options} />
      <div
        ref={hoverRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-20 hidden rounded-control-inner border border-dashed border-stroke-primary-active"
      />
    </div>
  );
}
