import { AgendaCalendar } from "@/components/organisms/AgendaCalendar";
import { PlanDrawer } from "@/components/organisms/PlanDrawer";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import type { AgendaItem } from "@/lib/agenda/types";
import type { AgendaView } from "@/lib/agenda/view";
import { useState } from "react";
import { isoWeek, stepDate, visibleRange } from "@/lib/agenda/time";
import { AgendaBody } from "./AgendaBody";
import { AgendaHeader } from "./AgendaHeader";
import { AgendaPageSkeleton } from "./AgendaPageSkeleton";
import { PlanRecipeList } from "./PlanRecipeList";
import { useAgendaShortcuts } from "./useAgendaShortcuts";

// The page as composed in AgendaPage.tsx, without data fetching or actions.
// The visual suite freezes the clock on Thursday 2026-01-01.
const DATE = "2026-01-01";
const noop = () => {};

const base = { linkCount: 0, end: null, allDay: false } as const;
const event = (id: string, title: string, start: string, end: string, source: "manual" | "sync" = "manual"): AgendaItem => ({
  ...base,
  kind: "event",
  source,
  calendarId: "cal-1",
  color: source === "sync" ? "violet" : "blue",
  missingSince: null,
  id,
  title,
  start,
  end,
});

const items: AgendaItem[] = [
  event("e1", "Tandarts", "2025-12-30T09:00:00", "2025-12-30T10:00:00"),
  event("e2", "Verjaardag Eric", "2026-01-01T19:00:00", "2026-01-01T21:30:00"),
  event("s1", "Teamoverleg", "2025-12-31T10:00:00", "2025-12-31T11:30:00", "sync"),
  { ...base, kind: "meal", slot: "dinner", servings: 4, thumbnailPath: null, attached: false, position: 1000, id: "m1", title: "Lasagne met spinazie", start: "2026-01-01", allDay: true },
  { ...base, kind: "meal", slot: "breakfast", servings: 2, thumbnailPath: null, attached: false, position: 1000, id: "m2", title: "Havermout met appel", start: "2026-01-01", allDay: true },
  { ...base, kind: "meal", slot: "dinner", servings: 4, thumbnailPath: null, attached: true, position: 2000, id: "m3", title: "Risotto met paddenstoelen", start: "2026-01-01", allDay: true },
  { ...base, kind: "meal", slot: "lunch", servings: 4, thumbnailPath: null, attached: false, position: 1000, id: "m4", title: "Tosti ham kaas", start: "2026-01-02", allDay: true },
  { ...base, kind: "deadline", id: "d1", title: "Belastingaangifte", start: "2026-01-01", end: null, allDay: true },
];

const recipe = (id: string, title: string, timeMinutes: number | null): PlanRecipe => ({
  id,
  title,
  servings: 4,
  categoryId: "main",
  timeMinutes,
  thumbnailUrl: null,
  thumbnailPath: null,
});
const recipes = [
  recipe("r1", "Lasagne met spinazie", 60),
  recipe("r2", "Pasta pesto", 20),
  recipe("r3", "Risotto met paddenstoelen", 45),
  recipe("r4", "Appeltaart", 90),
  recipe("r5", "Tosti ham kaas", null),
  recipe("r6", "Havermout met appel", 10),
];
const noPlan = async () => ({ success: true as const, data: undefined });
const baskets = [{ id: "own", name: "Boodschappen", shared: false }];

// The real page sits on `surface-primary`, not the story canvas.
const Surface = ({ children }: { children: React.ReactNode }) => (
  <div className="-m-8 flex flex-col gap-page-stack bg-surface-primary p-8">{children}</div>
);

const Page = ({ view, title, trayOpen = false }: { view: AgendaView; title: string; trayOpen?: boolean }) => (
  <Surface>
    <AgendaHeader
      title={title}
      view={view === "threeDay" ? "week" : view}
      weekNumber={view === "week" || view === "list" ? 1 : undefined}
      date={DATE}
      onGoToDate={noop}
      trayOpen={trayOpen}
      onViewChange={noop}
      onPrevious={noop}
      onNext={noop}
      onToday={noop}
      onTrayToggle={noop}
      onNew={noop}
      onOpenCalendars={noop}
      weekToBasket={{ onSend: noPlan, baskets }}
    />
    <AgendaBody
      drawerOpen={trayOpen}
      drawer={
        <PlanDrawer
          className="h-full"
          recipes={
            <PlanRecipeList
              recipes={recipes}
              categories={[{ id: "main", name: "Hoofdgerecht" }]}
              today={DATE}
              onPlan={noPlan}
              onPlanned={noop}
              weekToBasket={{ onSend: noPlan, baskets }}
            />
          }
        />
      }
    >
      <AgendaCalendar items={items} view={view} date={DATE} scrollToNow={false} />
    </AgendaBody>
  </Surface>
);

export const Week = () => <Page view="week" title="29 dec – 4 jan" />;
export const WeekTrayOpen = () => <Page view="week" title="29 dec – 4 jan" trayOpen />;
export const Month = () => <Page view="month" title="januari 2026" />;
export const List = () => <Page view="list" title="29 dec – 4 jan" />;
export const Loading = () => (
  <Surface>
    <AgendaPageSkeleton />
  </Surface>
);

// Header and calendar wired like AgendaPage for navigation: keys, date picker and "Vandaag". Try T, D, W, M, L, P and the arrows.
export const Navigation = () => {
  const [view, setView] = useState<"day" | "week" | "month" | "list">("week");
  const [date, setDate] = useState(DATE);
  const [overlay, setOverlay] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [scrollNowKey, setScrollNowKey] = useState(0);
  const range = visibleRange(view, date);
  useAgendaShortcuts((shortcut) => {
    if (shortcut === "today") {
      setDate(DATE);
      setScrollNowKey((key) => key + 1);
    } else if (shortcut === "previous") setDate(stepDate(view, date, -1));
    else if (shortcut === "next") setDate(stepDate(view, date, 1));
    else if (shortcut === "tray") setTrayOpen((open) => !open);
    else if (shortcut !== "new") setView(shortcut);
  }, overlay);
  return (
    <Surface>
      <AgendaHeader
        title={`${range.start} – ${range.end}`}
        view={view}
        weekNumber={view === "week" || view === "list" ? isoWeek(range.start) : undefined}
        date={date}
        onGoToDate={setDate}
        onOverlayChange={setOverlay}
        trayOpen={trayOpen}
        onViewChange={setView}
        onPrevious={() => setDate(stepDate(view, date, -1))}
        onNext={() => setDate(stepDate(view, date, 1))}
        onToday={() => setDate(DATE)}
        onTrayToggle={() => setTrayOpen((open) => !open)}
        onNew={noop}
      />
      <AgendaBody>
        <AgendaCalendar items={items} view={view} date={date} scrollNowKey={scrollNowKey} />
      </AgendaBody>
    </Surface>
  );
};
