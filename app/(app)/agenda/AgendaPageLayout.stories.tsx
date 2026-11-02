import { AgendaCalendar, useIsNarrow } from "@/components/organisms/AgendaCalendar";
import type { AgendaItem } from "@/lib/agenda/types";
import type { AgendaView } from "@/lib/agenda/view";
import { useState } from "react";
import { isoWeek, stepDate, visibleRange } from "@/lib/agenda/time";
import { AgendaBody } from "./AgendaBody";
import { AgendaDayCards } from "./AgendaDayCards";
import { AgendaHeader } from "./AgendaHeader";
import { AgendaPageSkeleton } from "./AgendaPageSkeleton";
import { useAgendaShortcuts } from "./useAgendaShortcuts";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda page layout" } satisfies StoryDefault;

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

const noPlan = async () => ({ success: true as const, data: undefined });
const baskets = [{ id: "own", name: "Boodschappen", shared: false }];

const DayCards = () => (
  <AgendaDayCards
    day={DATE}
    today={DATE}
    now="2026-01-01T14:00"
    items={items}
    basket={{ m1: false, m2: false, m3: true }}
    baskets={baskets}
    onOpenItem={noop}
    onSignal={async () => ({ success: true })}
    onDayToBasket={noPlan}
  />
);

// The real page sits on `surface-primary`, not the story canvas.
const Surface = ({ children }: { children: React.ReactNode }) => (
  <div className="-m-8 flex flex-col gap-page-stack bg-surface-primary p-8">{children}</div>
);

const PageContent = ({ view, title }: { view: AgendaView; title: string }) => (
  <>
    <AgendaHeader
      title={title}
      view={view === "threeDay" ? "week" : view}
      weekNumber={view === "week" || view === "list" ? 1 : undefined}
      date={DATE}
      onGoToDate={noop}
      onViewChange={noop}
      onPrevious={noop}
      onNext={noop}
      onToday={noop}
      onNew={noop}
      onOpenCalendars={noop}
      weekToBasket={{ onSend: noPlan, baskets }}
    />
    <AgendaBody cards={<DayCards />}>
      <AgendaCalendar items={items} view={view} date={DATE} scrollToNow={false} />
    </AgendaBody>
  </>
);

const Page = (props: { view: AgendaView; title: string }) => (
  <Surface>
    <PageContent {...props} />
  </Surface>
);

export const Overview = () => (
  <Surface>
    <StoryIntro
      what="The agenda page as composed in AgendaPage: header, the day cards and the calendar. Interactive wires navigation and keys."
      note="AgendaPage"
    />
    <PageContent view="week" title="29 dec – 4 jan" />
  </Surface>
);

// Header and calendar wired like AgendaPage for navigation: keys, date picker and "Vandaag". Try T, D, W, M, L and the arrows.
export const Interactive = () => {
  const [view, setView] = useState<"day" | "week" | "month" | "list">("week");
  const [date, setDate] = useState(DATE);
  const [overlay, setOverlay] = useState(false);
  const [scrollNowKey, setScrollNowKey] = useState(0);
  const range = visibleRange(view, date);
  useAgendaShortcuts((shortcut) => {
    if (shortcut === "today") {
      setDate(DATE);
      setScrollNowKey((key) => key + 1);
    } else if (shortcut === "previous") setDate(stepDate(view, date, -1));
    else if (shortcut === "next") setDate(stepDate(view, date, 1));
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
        onViewChange={setView}
        onPrevious={() => setDate(stepDate(view, date, -1))}
        onNext={() => setDate(stepDate(view, date, 1))}
        onToday={() => setDate(DATE)}
        onNew={noop}
      />
      <AgendaBody cards={<DayCards />}>
        <AgendaCalendar items={items} view={view} date={date} scrollNowKey={scrollNowKey} />
      </AgendaBody>
    </Surface>
  );
};

// Below `lg` the day follows the finger and the neighbour day waits beside it (#713). Swipe the grid with touch
// emulation at 390px; on a wide viewport the page shows the desktop calendar and there is nothing to drag.
export const Swipe = () => {
  const narrow = useIsNarrow();
  const [date, setDate] = useState(DATE);
  return (
    <Surface>
      <AgendaHeader
        title={date}
        view="day"
        date={date}
        today={DATE}
        onGoToDate={setDate}
        onViewChange={noop}
        onPrevious={() => setDate(stepDate("day", date, -1))}
        onNext={() => setDate(stepDate("day", date, 1))}
        onToday={() => setDate(DATE)}
        onNew={noop}
        onOpenCalendars={noop}
        weekToBasket={{ onSend: noPlan, baskets }}
      />
      <AgendaBody
        swipe={
          narrow
            ? {
                date,
                onStep: (step) => setDate(stepDate("day", date, step)),
                renderNeighbour: (step) => (
                  <AgendaCalendar items={items} view="day" date={stepDate("day", date, step)} scrollToNow={false} entrance={false} />
                ),
              }
            : undefined
        }
      >
        <AgendaCalendar items={items} view="day" date={date} scrollToNow={false} />
      </AgendaBody>
    </Surface>
  );
};

// A narrower page container: the cards are a row above the planner.
export const Narrow = () => (
  <div className="w-[60rem]">
    <Page view="week" title="29 dec – 4 jan" />
  </div>
);
export const Week = () => <Page view="week" title="29 dec – 4 jan" />;
export const Month = () => <Page view="month" title="januari 2026" />;
export const List = () => <Page view="list" title="29 dec – 4 jan" />;
export const Loading = () => (
  <Surface>
    <AgendaPageSkeleton />
  </Surface>
);
