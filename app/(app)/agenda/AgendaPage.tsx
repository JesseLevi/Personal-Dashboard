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
  type AgendaExternalDrop,
} from "@/components/organisms/AgendaCalendar";
import type { SyncNoticeView } from "@/lib/agenda/calendars";
import { PlanDrawer } from "@/components/organisms/PlanDrawer";
import { Toast } from "@/components/organisms/Toast";
import { weekRange } from "@/lib/agenda/meals";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { addDays, loadWindow, spanToUtc, stepDate, visibleRange } from "@/lib/agenda/time";
import type { AgendaItem, AgendaMealItem, MealSlot } from "@/lib/agenda/types";
import { persistAgendaView, type AgendaView } from "@/lib/agenda/view";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";
import { createEvent, deleteEvent, getAgendaEvent, loadAgendaRange, moveEvent, updateEvent } from "./actions";
import { AgendaBody } from "./AgendaBody";
import { AgendaCalendarsPanel } from "./AgendaCalendarsPanel";
import { AgendaEventPanel, type AgendaPanelTarget } from "./AgendaEventPanel";
import { getAgendaEventLinks, linkToEvent, searchAgendaLinkTargets, unlinkFromEvent } from "./link-actions";
import { AgendaHeader, toToggleView, type AgendaToggleView } from "./AgendaHeader";
import { AgendaSyncNotices } from "./AgendaSyncNotices";
import { addIcsCalendar, listCalendarAccounts, removeCalendarAccount, resolveSyncNotice } from "./calendars-actions";
import { AgendaMealPanel } from "./AgendaMealPanel";
import { createMealPlan, deleteMealPlan, getMealPlan, sendMealToBasket, sendWeekToBasket, updateMealPlan } from "./meal-actions";
import { PlanRecipeList } from "./PlanRecipeList";

export interface AgendaPageProps {
  initialView: AgendaView;
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  /** The items of `loadWindow(today)`. */
  initialItems: AgendaItem[];
  /** Open basket notices after a sync deleted an event with a meal. */
  initialNotices: SyncNoticeView[];
  /** Recipes the plan drawer offers. */
  recipes: PlanRecipe[];
  recipeCategories: { id: string; name: string }[];
  /** Baskets "Naar mand" can target. */
  baskets: BasketOption[];
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

// Item times are wall-clock strings: a timed one without offset, an all-day one a date.
function wallClock(value: string, allDay: boolean): string {
  return allDay ? value.slice(0, 10) : value.slice(0, 19);
}

// The panel shows the latest copy of its meal, so a reload after a save updates it in place.
function liveMeal(items: AgendaItem[], fallback: AgendaMealItem): AgendaMealItem {
  const found = items.find((item) => item.id === fallback.id);
  return found?.kind === "meal" ? found : fallback;
}

export function AgendaPage({
  initialView,
  today,
  initialItems,
  initialNotices,
  recipes,
  recipeCategories,
  baskets,
}: AgendaPageProps) {
  const tErrors = useTranslations("agenda.errors");
  const tPlan = useTranslations("agenda.plan");
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
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [mealPanel, setMealPanel] = useState<{ open: boolean; item: AgendaMealItem | null }>({ open: false, item: null });
  const [notice, setNotice] = useState<string | null>(null);
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
        setMealPanel({ open: true, item });
        break;
    }
  }

  // A meal moves to a day, whatever slot it was dropped on; it stays an all-day item.
  function handleMealMove(item: AgendaMealItem, change: AgendaChange, revert: () => void) {
    const plannedOn = change.start.slice(0, 10);
    const previous = items;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, start: plannedOn, end: null, allDay: true } : candidate,
      ),
    );
    void updateMealPlan({ id: item.id, plannedOn }).then((result) => {
      if (result.success) {
        setError(null);
        void loadAround(date);
        return;
      }
      revert();
      setItems(previous);
      setError(tErrors(result.error));
    });
  }

  async function planRecipe(recipeId: string, target: { plannedOn: string; slot?: MealSlot } | { calendarEventId: string }) {
    const result = await createMealPlan({ recipeId, ...target });
    if (result.success) {
      setError(null);
      void loadAround(date);
    } else {
      setError(tErrors(result.error));
    }
    return result;
  }

  function handleExternalDrop(drop: AgendaExternalDrop) {
    if (drop.payload.type !== "recipe") return;
    void planRecipe(
      drop.payload.id,
      drop.eventId ? { calendarEventId: drop.eventId } : { plannedOn: drop.start.slice(0, 10) },
    );
  }

  function announcePlanned(plannedOn: string, slot: MealSlot) {
    setNotice(
      tPlan("plannedNotice", {
        slot: tPlan(`slots.${slot}`),
        date: format.dateTime(utc(plannedOn), { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }),
      }),
    );
  }

  // Sends the unsent meals of the visible week; the button shows success only when this resolves with it.
  async function handleWeekToBasket(listId?: string): Promise<ActionResult> {
    setError(null);
    const result = await sendWeekToBasket({ ...weekRange(date), listId });
    if (result.success) return { success: true, data: undefined };
    setError(tErrors(result.error));
    return { success: false, error: "generic" };
  }

  // Drag and resize save at once; the calendar has already moved the block, so a refusal reverts it.
  function handleChange(change: AgendaChange, revert: () => void) {
    const { item } = change;
    if (item.kind === "meal") {
      handleMealMove(item, change, revert);
      return;
    }
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
        onOpenCalendars={() => setCalendarsOpen(true)}
        weekToBasket={{ onSend: handleWeekToBasket, baskets }}
      />
      <AgendaSyncNotices initialNotices={initialNotices} onResolve={resolveSyncNotice} />
      {error && <p className="pr-page-right-equal text-base font-semibold text-priority-urgent">{error}</p>}
      <AgendaBody
        drawer={
          <PlanDrawer
            className="h-full"
            recipes={
              <PlanRecipeList
                recipes={recipes}
                categories={recipeCategories}
                today={today}
                onPlan={(recipeId, plannedOn, slot) => planRecipe(recipeId, { plannedOn, slot })}
                onPlanned={announcePlanned}
              />
            }
          />
        }
      >
        <AgendaCalendar
          items={items}
          view={view}
          date={date}
          onSelectSlot={openCreate}
          onItemClick={handleItemClick}
          onItemMove={handleChange}
          onItemResize={handleChange}
          onExternalDrop={handleExternalDrop}
        />
      </AgendaBody>
      <Toast message={notice} onDismiss={() => setNotice(null)} />
      {mealPanel.item && (
        <AgendaMealPanel
          open={mealPanel.open}
          onClose={() => setMealPanel((current) => ({ ...current, open: false }))}
          item={liveMeal(items, mealPanel.item)}
          baskets={baskets}
          onLoadMeal={getMealPlan}
          onUpdateMeal={updateMealPlan}
          onDeleteMeal={deleteMealPlan}
          onSendMeal={sendMealToBasket}
          onOpenRecipe={(recipeId) => router.push(`/recepten/${recipeId}`)}
          onMutated={() => void loadAround(date)}
        />
      )}
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
      <AgendaCalendarsPanel
        open={calendarsOpen}
        onClose={() => setCalendarsOpen(false)}
        onList={listCalendarAccounts}
        onAdd={addIcsCalendar}
        onRemove={removeCalendarAccount}
        onMutated={() => void loadAround(date)}
      />
    </>
  );
}
