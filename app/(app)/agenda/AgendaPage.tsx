// design: Claude-designed (#486)
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  AgendaCalendar,
  effectiveAgendaView,
  useIsNarrow,
  type AgendaChange,
} from "@/components/organisms/AgendaCalendar";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { addDays, loadWindow, spanToUtc, stepDate, visibleRange } from "@/lib/agenda/time";
import type { AgendaItem } from "@/lib/agenda/types";
import { persistAgendaView, type AgendaView } from "@/lib/agenda/view";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";
import { createEvent, deleteEvent, getAgendaEvent, loadAgendaRange, moveEvent, updateEvent } from "./actions";
import { AgendaBody } from "./AgendaBody";
import { AgendaEventPanel, type AgendaPanelTarget } from "./AgendaEventPanel";
import { getAgendaEventLinks, linkToEvent, searchAgendaLinkTargets, unlinkFromEvent } from "./link-actions";
import { AgendaHeader, toToggleView, type AgendaToggleView } from "./AgendaHeader";

export interface AgendaPageProps {
  initialView: AgendaView;
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  /** The items of `loadWindow(today)`. */
  initialItems: AgendaItem[];
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

// Item times are wall-clock strings: a timed one without offset, an all-day one a date.
function wallClock(value: string, allDay: boolean): string {
  return allDay ? value.slice(0, 10) : value.slice(0, 19);
}

export function AgendaPage({ initialView, today, initialItems }: AgendaPageProps) {
  const tErrors = useTranslations("agenda.errors");
  const format = useFormatter();
  const router = useRouter();
  const narrow = useIsNarrow();

  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(today);
  const [items, setItems] = useState(initialItems);
  const [loadedFrom, setLoadedFrom] = useState(() => loadWindow(today).from);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ open: boolean; target: AgendaPanelTarget }>({
    open: false,
    target: { mode: "create", span: { start: `${today}T09:00:00`, end: null, allDay: false } },
  });
  const latestRequest = useRef(0);

  const effectiveView = effectiveAgendaView(view, narrow);

  // Keeps the current items on screen until the new window arrives: no empty flash.
  const loadAround = useCallback(
    async (day: string) => {
      const window = loadWindow(day);
      const request = ++latestRequest.current;
      const result = await loadAgendaRange(window);
      if (request !== latestRequest.current) return;
      if (result.success) {
        setItems(result.data);
        setLoadedFrom(window.from);
        setError(null);
      } else {
        setError(tErrors(result.error));
      }
    },
    [tErrors],
  );

  function goTo(next: string) {
    setDate(next);
    if (loadWindow(next).from !== loadedFrom) void loadAround(next);
  }

  function handleViewChange(next: AgendaToggleView) {
    setView(next);
    persistAgendaView(next);
  }

  function openCreate(span: AgendaSpan) {
    setPanel({ open: true, target: { mode: "create", span } });
  }

  function handleItemClick(item: AgendaItem) {
    switch (item.kind) {
      case "event":
        setPanel({ open: true, target: { mode: "edit", item } });
        break;
      case "deadline":
        router.push(`/te-doen?card=${item.id.replace(/^deadline:/, "")}`);
        break;
      case "planned_card":
        router.push(`/te-doen?card=${item.id}`);
        break;
      case "meal":
        break;
    }
  }

  // Drag and resize save at once; the calendar has already moved the block, so a refusal reverts it.
  function handleChange(change: AgendaChange, revert: () => void) {
    const { item } = change;
    if (item.kind !== "event" || item.source !== "manual") {
      revert();
      return;
    }
    const previous = items;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              start: wallClock(change.start, change.allDay),
              end: change.end ? wallClock(change.end, change.allDay) : null,
              allDay: change.allDay,
            }
          : candidate,
      ),
    );
    void moveEvent({ id: item.id, ...spanToUtc(change) }).then((result: AgendaActionResult) => {
      if (result.success) {
        setError(null);
        return;
      }
      revert();
      setItems(previous);
      setError(tErrors(result.error));
    });
  }

  const range = visibleRange(effectiveView, date);
  const last = utc(addDays(range.end, -1));
  let title: string;
  if (effectiveView === "month") {
    title = format.dateTime(utc(range.start), { month: "long", year: "numeric", timeZone: "UTC" });
  } else if (effectiveView === "day") {
    title = format.dateTime(utc(range.start), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  } else {
    title = format.dateTimeRange(utc(range.start), last, { day: "numeric", month: "short", timeZone: "UTC" });
  }

  return (
    <>
      <AgendaHeader
        title={title}
        view={toToggleView(initialView)}
        onViewChange={handleViewChange}
        onPrevious={() => goTo(stepDate(effectiveView, date, -1))}
        onNext={() => goTo(stepDate(effectiveView, date, 1))}
        onToday={() => goTo(today)}
      />
      {error && <p className="pr-page-right-equal text-base font-semibold text-priority-urgent">{error}</p>}
      <AgendaBody>
        <AgendaCalendar
          items={items}
          view={view}
          date={date}
          onSelectSlot={openCreate}
          onItemClick={handleItemClick}
          onItemMove={handleChange}
          onItemResize={handleChange}
        />
      </AgendaBody>
      <AgendaEventPanel
        open={panel.open}
        onClose={() => setPanel((current) => ({ ...current, open: false }))}
        target={panel.target}
        onLoadEvent={getAgendaEvent}
        onCreateEvent={createEvent}
        onUpdateEvent={updateEvent}
        onDeleteEvent={deleteEvent}
        onMutated={() => void loadAround(date)}
        onLoadLinks={getAgendaEventLinks}
        onSearchLinks={searchAgendaLinkTargets}
        onLink={linkToEvent}
        onUnlink={unlinkFromEvent}
        onNavigate={router.push}
      />
    </>
  );
}
