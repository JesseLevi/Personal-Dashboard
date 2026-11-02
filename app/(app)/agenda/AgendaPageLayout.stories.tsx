import { AgendaCalendar, useIsNarrow } from "@/components/organisms/AgendaCalendar";
import type { AgendaItem } from "@/lib/agenda/types";
import { fitAgendaView, type AgendaView } from "@/lib/agenda/view";
import { MobileTabBar } from "@/components/organisms/MobileTabBar";
import { SIDEBAR_EXPANDED_WIDTH } from "@/components/organisms/Sidebar";
import type { AgendaSheetStop } from "@/lib/agenda/sheet";
import { cn } from "@/lib/ui/cn";
import { useState } from "react";
import { isoWeek, stepDate, visibleRange } from "@/lib/agenda/time";
import { AgendaBody, type AgendaBodySheet } from "./AgendaBody";
import { AgendaDayCards } from "./AgendaDayCards";
import { AgendaDayStrip } from "./AgendaDayStrip";
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

const DayCards = ({ day = DATE, dayItems = items }: { day?: string; dayItems?: AgendaItem[] }) => (
  <AgendaDayCards
    day={day}
    today={DATE}
    now="2026-01-01T14:00"
    items={dayItems}
    basket={{ m1: false, m2: false, m3: true }}
    baskets={baskets}
    onOpenItem={noop}
    onSignal={async () => ({ success: true })}
    onDayToBasket={noPlan}
  />
);

// The sheet below `lg`, in a fixed stop or wired to its own grabber. `date` feeds the week strip.
const sheetFor = (
  stop: AgendaSheetStop,
  date = DATE,
  onStopChange: (stop: AgendaSheetStop) => void = noop,
  onSelect: (date: string) => void = noop,
): AgendaBodySheet => ({
  stop,
  onStopChange,
  strip: <AgendaDayStrip date={date} today={DATE} onSelect={onSelect} />,
});

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
    <AgendaBody cards={<DayCards />} sheet={sheetFor("peek")}>
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
      <AgendaBody cards={<DayCards />} sheet={sheetFor("peek", date)}>
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
        sheet={sheetFor("peek", date)}
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

// A narrow page container: the cards keep their column and the planner shows fewer days.
export const Narrow = () => (
  <div className="w-[60rem]">
    <Page view="week" title="29 dec – 4 jan" />
  </div>
);

// The page at the real shell's dimensions (AppShellNav): sidebar spacer, page margins, `main`'s padding. The
// planner's width picks the week, three days or one day; the visual suite shoots it at 1440, 1280 and 1024.
const FittedPage = () => {
  const [plannerWidth, setPlannerWidth] = useState<number | null>(null);
  const view = fitAgendaView("week", plannerWidth);
  return (
    <div className="-m-8 flex min-h-screen items-stretch bg-surface-primary">
      <div aria-hidden="true" className={cn("hidden shrink-0 md:block", SIDEBAR_EXPANDED_WIDTH)} />
      <main className="flex min-w-0 flex-1 flex-col gap-page-stack pb-page-bottom pl-page-left pt-20">
        <div className="flex min-w-0 flex-1 flex-col gap-page-stack">
          <AgendaHeader
            title="29 dec – 4 jan"
            view="week"
            weekNumber={1}
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
          <AgendaBody cards={<DayCards />} sheet={sheetFor("peek")} onPlannerWidth={setPlannerWidth}>
            <AgendaCalendar items={items} view={view} date={DATE} scrollToNow={false} />
          </AgendaBody>
        </div>
      </main>
    </div>
  );
};
export const InShell = () => <FittedPage />;
export const Week = () => <Page view="week" title="29 dec – 4 jan" />;
export const Month = () => <Page view="month" title="januari 2026" />;
export const List = () => <Page view="list" title="29 dec – 4 jan" />;
export const Loading = () => (
  <Surface>
    <AgendaPageSkeleton />
  </Surface>
);

// Below `lg` (#733): the header is the date opener, the cards scroll under it and the planner is the pull-up sheet above the tab bar. The
// sheet is fixed to the viewport, so these stories are made for a phone viewport (390x844; 320x568 for the smallest). The visual suite shoots
// them in `shell.visual.spec.ts`.
const tabs = [
  { id: "todo", icon: "Columns3", label: "Te doen" },
  { id: "agenda", icon: "Calendar", label: "Agenda" },
  { id: "notes", icon: "Notebook", label: "Notities" },
  { id: "recipes", icon: "FolderClosed", label: "Recepten" },
  { id: "shopping", icon: "ShoppingBasket", label: "Mand" },
] as const;

interface MobileShellProps {
  initialStop?: AgendaSheetStop;
  initialDate?: string;
  dayItems?: AgendaItem[];
  titleMenuOpen?: boolean;
  pickerOpen?: boolean;
}

// The day follows the finger over the cards and the grid (#744): `swipe` is wired like AgendaPage.
const MobileShell = ({ initialStop = "peek", initialDate = DATE, dayItems = items, titleMenuOpen, pickerOpen }: MobileShellProps) => {
  const [stop, setStop] = useState(initialStop);
  const [date, setDate] = useState(initialDate);
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", timeZone: "UTC" });
  const subtitle = new Date(`${date}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });
  const swipe = {
    date,
    onStep: (step: 1 | -1) => setDate(stepDate("day", date, step)),
    renderNeighbour: (step: 1 | -1) => (
      <AgendaCalendar items={dayItems} view="day" date={stepDate("day", date, step)} scrollToNow={false} entrance={false} />
    ),
    renderCardsNeighbour: (step: 1 | -1) => <DayCards day={stepDate("day", date, step)} dayItems={dayItems} />,
  };
  return (
    <div className="-m-8 flex min-h-dvh items-stretch bg-surface-primary">
      <main className="flex min-w-0 flex-1 flex-col gap-page-stack pt-[max(1rem,env(safe-area-inset-top))] pb-page-bottom pl-page-left md:pt-20">
        <div className="flex min-w-0 flex-1 flex-col gap-page-stack">
          <div className="max-lg:sticky max-lg:top-[env(safe-area-inset-top)] max-lg:z-10">
            <AgendaHeader
              title={weekday.charAt(0).toUpperCase() + weekday.slice(1)}
              subtitle={subtitle}
              isToday={date === DATE}
              view="day"
              date={date}
              onGoToDate={setDate}
              onViewChange={noop}
              onPrevious={noop}
              onNext={noop}
              onToday={() => setDate(DATE)}
              onNew={noop}
              onOpenCalendars={noop}
              weekToBasket={{ onSend: noPlan, baskets }}
              defaultTitleMenuOpen={titleMenuOpen}
              defaultPickerOpen={pickerOpen}
            />
          </div>
          <AgendaBody swipe={swipe} cards={<DayCards day={date} dayItems={dayItems} />} sheet={sheetFor(stop, date, setStop, setDate)}>
            <AgendaCalendar items={dayItems} view="day" date={date} scrollToNow={false} />
          </AgendaBody>
        </div>
      </main>
      <MobileTabBar navLabel="Modules" items={tabs} activeItem="agenda" onNavigate={noop} />
    </div>
  );
};

// One card, and a day with nothing at all: the sheet's top edge rests 64px under the last card or the empty-day line.
const fewItems = items.filter((item) => item.id === "e2");
// More cards than fit above the minimal peek: the minimal peek stays and the cards scroll.
const manyItems: AgendaItem[] = [
  ...items,
  event("e3", "Brunch met oma", "2026-01-01T10:30:00", "2026-01-01T12:00:00"),
  event("e4", "Fietsen repareren", "2026-01-01T13:00:00", "2026-01-01T14:00:00"),
  event("e5", "Boodschappen doen", "2026-01-01T16:00:00", "2026-01-01T17:00:00"),
  event("e6", "Yoga", "2026-01-01T18:00:00", "2026-01-01T19:00:00"),
];

export const MobilePeek = () => <MobileShell />;
export const MobilePeekFewCards = () => <MobileShell dayItems={fewItems} />;
export const MobilePeekEmptyDay = () => <MobileShell dayItems={[]} />;
export const MobilePeekManyCards = () => <MobileShell dayItems={manyItems} />;
export const MobileFull = () => <MobileShell initialStop="full" />;
// Another day than today: no dot after the weekday.
export const MobileOtherDay = () => <MobileShell initialDate="2026-01-02" />;
// The title's menu (Vandaag, Ga naar datum) and the date field it opens; both are portalled.
export const MobileTitleMenu = () => <MobileShell titleMenuOpen />;
export const MobileDatePicker = () => <MobileShell pickerOpen />;

