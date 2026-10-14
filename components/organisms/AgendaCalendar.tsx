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
  compareEventOrder,
  normalizeSpan,
  toEventInputs,
  type AgendaSpan,
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

// A drop is reported per date; the event under the pointer is found in the DOM.
function eventIdAtPoint(event: Event): string | undefined {
  const pointer = "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
  if (!pointer) return undefined;
  const hit = document
    .elementsFromPoint(pointer.clientX, pointer.clientY)
    .find((el) => el.hasAttribute(EVENT_ID_ATTRIBUTE));
  return hit?.getAttribute(EVENT_ID_ATTRIBUTE) ?? undefined;
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
const NARROW_QUERY = "(max-width: 767px)";

/** True below the `md` breakpoint; false during SSR and the first client render. */
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
  className,
}: AgendaCalendarProps) {
  const t = useTranslations("components.agendaCalendar");
  const locale = useLocale();
  const narrow = useIsNarrow();
  const calendarRef = useRef<CalendarRef>(null);
  const viewName = VIEW_NAMES[effectiveAgendaView(view, narrow)];

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
    slotDuration: { minutes: 30 },
    snapDuration: { minutes: 15 },
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
      const item = itemOf(info.event);
      if (item.kind === "event") info.el.setAttribute(EVENT_ID_ATTRIBUTE, item.id);
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
    select: (info) => onSelectSlot?.(normalizeSpan({ start: info.startStr, end: info.endStr, allDay: info.allDay })),
    eventClick: (info) => onItemClick?.(itemOf(info.event), info.el),
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
    <div className={cn("h-full min-h-0", className)} role="region" aria-label={t("label")}>
      <FullCalendar ref={calendarRef} {...options} />
    </div>
  );
}
