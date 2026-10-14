import { NextIntlClientProvider } from "next-intl";
import { useRef, useState } from "react";
import type { AgendaItem } from "../../lib/agenda/types";
import en from "../../messages/en.json";
import { Icon } from "../atoms/Icon";
import { AgendaCalendar, type AgendaView } from "./AgendaCalendar";
import { AgendaCalendarSkeleton } from "./AgendaCalendarSkeleton";
import { useAgendaDraggable, type AgendaDragPayload } from "./useAgendaDraggable";

// The visual suite freezes the clock on Thursday 2026-01-01.
const DATE = "2026-01-01";

const base = { linkCount: 0, end: null, allDay: false } as const;

const own = (id: string, title: string, start: string, end: string, linkCount = 0): AgendaItem => ({
  ...base,
  kind: "event",
  source: "manual",
  calendarId: "cal-1",
  missingSince: null,
  id,
  title,
  start,
  end,
  linkCount,
});

const imported = (id: string, title: string, start: string, end: string): AgendaItem => ({
  ...base,
  kind: "event",
  source: "sync",
  calendarId: "cal-2",
  missingSince: null,
  id,
  title,
  start,
  end,
});

// A meal is an all-day item on its date; only the date of `start` counts.
const meal = (id: string, title: string, slot: "breakfast" | "lunch" | "dinner" | "snack", start: string, position = 1000): AgendaItem => ({
  ...base,
  kind: "meal",
  slot,
  servings: 4,
  thumbnailPath: null,
  attached: false,
  position,
  id,
  title,
  start: start.slice(0, 10),
  end: null,
  allDay: true,
});

const plannedCard = (id: string, title: string, start: string, end: string): AgendaItem => ({
  ...base,
  kind: "planned_card",
  board: "Huis",
  column: "Bezig",
  id,
  title,
  start,
  end,
});

const deadline = (id: string, title: string, day: string): AgendaItem => ({
  ...base,
  kind: "deadline",
  id,
  title,
  start: day,
  end: null,
  allDay: true,
});

const allKinds: AgendaItem[] = [
  own("e1", "Tandarts", "2025-12-30T09:00:00", "2025-12-30T10:00:00"),
  own("e2", "Verjaardag Eric", "2026-01-01T19:00:00", "2026-01-01T21:30:00", 2),
  imported("s1", "Teamoverleg", "2025-12-31T10:00:00", "2025-12-31T11:30:00"),
  imported("s2", "Sprintplanning", "2026-01-02T13:00:00", "2026-01-02T14:00:00"),
  {
    ...own("e3", "Oude afspraak", "2026-01-02T15:00:00", "2026-01-02T16:00:00"),
    kind: "event",
    source: "sync",
    missingSince: "2025-12-28T00:00:00",
  } as AgendaItem,
  meal("m1", "Lasagne met spinazie", "dinner", "2026-01-01"),
  meal("m2", "Havermout met appel", "breakfast", "2025-12-31"),
  meal("m3", "Tosti", "lunch", "2026-01-02"),
  meal("m4", "Soep van de dag", "lunch", "2026-01-02", 2000),
  meal("m5", "Appeltaart", "snack", "2026-01-02"),
  plannedCard("c1", "Vloer dweilen", "2026-01-03T10:00:00", "2026-01-03T11:00:00"),
  plannedCard("c2", "Belastingaangifte controleren", "2025-12-30T14:00:00", "2025-12-30T15:30:00"),
  deadline("d1", "Belastingaangifte", "2026-01-01"),
  deadline("d2", "Pakketje retourneren", "2025-12-31"),
  { ...own("a1", "Vakantie Marie", "2026-01-02", "2026-01-05"), allDay: true } as AgendaItem,
];

const overlapping: AgendaItem[] = [
  own("o1", "Stand-up", "2026-01-01T09:00:00", "2026-01-01T09:30:00"),
  own("o2", "Workshop", "2026-01-01T09:00:00", "2026-01-01T11:30:00"),
  imported("o3", "Klantgesprek", "2026-01-01T10:00:00", "2026-01-01T12:00:00"),
  meal("o4", "Pasta pesto", "lunch", "2026-01-01"),
  plannedCard("o5", "Fiets repareren", "2026-01-01T12:30:00", "2026-01-01T14:00:00"),
];

const allDay: AgendaItem[] = [
  { ...own("l1", "Vakantie Marie", "2026-01-01", "2026-01-04"), allDay: true } as AgendaItem,
  { ...imported("l2", "Schoolvakantie", "2025-12-31", "2026-01-03"), allDay: true } as AgendaItem,
  deadline("l3", "Belastingaangifte", "2026-01-01"),
  deadline("l4", "Verzekering opzeggen", "2026-01-02"),
  own("l5", "Lunch met oma", "2026-01-02T12:00:00", "2026-01-02T13:30:00"),
];

const Frame = ({ children, className = "h-[44rem]" }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

const Calendar = ({ view, items }: { view: AgendaView; items: AgendaItem[] }) => (
  <Frame>
    <AgendaCalendar items={items} view={view} date={DATE} />
  </Frame>
);

export const Week = () => <Calendar view="week" items={allKinds} />;
export const Day = () => <Calendar view="day" items={overlapping} />;
export const Month = () => <Calendar view="month" items={allKinds} />;
export const List = () => <Calendar view="list" items={allKinds} />;
export const OverlappingItems = () => <Calendar view="week" items={overlapping} />;
export const AllDayAndDeadlines = () => <Calendar view="week" items={allDay} />;
export const Empty = () => <Calendar view="week" items={[]} />;
export const EmptyList = () => <Calendar view="list" items={[]} />;

export const Mobile = () => (
  <div className="h-[40rem] w-[22.5rem]">
    <AgendaCalendar items={allKinds} view="threeDay" date={DATE} />
  </div>
);

export const MobileDay = () => (
  <div className="h-[40rem] w-[22.5rem]">
    <AgendaCalendar items={overlapping} view="day" date={DATE} />
  </div>
);

export const English = () => (
  <NextIntlClientProvider locale="en" messages={en}>
    <Calendar view="week" items={allKinds} />
  </NextIntlClientProvider>
);

export const Loading = () => (
  <Frame>
    <AgendaCalendarSkeleton />
  </Frame>
);

export const LoadingMobile = () => (
  <div className="h-[40rem] w-[22.5rem]">
    <AgendaCalendarSkeleton />
  </div>
);

function TrayItem({ payload, icon }: { payload: AgendaDragPayload; icon: "Utensils" | "Columns3" }) {
  const ref = useRef<HTMLDivElement>(null);
  useAgendaDraggable(ref, payload);
  return (
    <div
      ref={ref}
      className="flex cursor-grab items-center gap-inline-sm rounded-control border border-stroke-primary bg-surface-highlight-white px-component-md py-component-sm text-sm font-semibold text-text-primary hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active"
    >
      <Icon name={icon} size={16} />
      {payload.title}
    </div>
  );
}

export const ExternalDrag = () => {
  const [items, setItems] = useState<AgendaItem[]>(overlapping);
  const [log, setLog] = useState("");
  return (
    <div className="flex flex-col gap-stack-md">
      <div className="flex gap-inline-md">
        <TrayItem icon="Utensils" payload={{ type: "recipe", id: "r1", title: "Risotto met paddenstoelen", durationMinutes: 60 }} />
        <TrayItem icon="Columns3" payload={{ type: "card", id: "k1", title: "Rolluik repareren", durationMinutes: 90 }} />
      </div>
      <p data-testid="drop-log" className="min-h-5 text-sm text-text-secondary">
        {log}
      </p>
      <Frame>
        <AgendaCalendar
          items={items}
          view="week"
          date={DATE}
          onExternalDrop={(drop) => {
            setLog(`${drop.payload.type}:${drop.payload.id} @ ${drop.start} allDay=${drop.allDay}`);
            setItems((current) => [
              ...current,
              {
                ...base,
                kind: drop.payload.type === "recipe" ? "meal" : "planned_card",
                ...(drop.payload.type === "recipe"
                  ? { slot: "dinner", servings: 4, thumbnailPath: null }
                  : { board: "Huis", column: "Bezig" }),
                id: `${drop.payload.id}-${current.length}`,
                title: drop.payload.title,
                start: drop.start,
                allDay: drop.allDay,
              } as AgendaItem,
            ]);
          }}
        />
      </Frame>
    </div>
  );
};

export const Interactive = () => {
  const [items, setItems] = useState<AgendaItem[]>(allKinds);
  const [log, setLog] = useState("");
  return (
    <div className="flex flex-col gap-stack-md">
      <p data-testid="event-log" className="min-h-5 text-sm text-text-secondary">
        {log}
      </p>
      <Frame>
        <AgendaCalendar
          items={items}
          view="week"
          date={DATE}
          onSelectSlot={(span) => setLog(`select ${span.start} - ${span.end}`)}
          onItemClick={(item) => setLog(`click ${item.id}`)}
          onItemMove={(change) => {
            setLog(`move ${change.item.id} ${change.start} - ${change.end}`);
            setItems((current) => current.map((i) => (i.id === change.item.id ? { ...i, start: change.start, end: change.end, allDay: change.allDay } : i)));
          }}
          onItemResize={(change) => {
            setLog(`resize ${change.item.id} ${change.start} - ${change.end}`);
            setItems((current) => current.map((i) => (i.id === change.item.id ? { ...i, start: change.start, end: change.end } : i)));
          }}
        />
      </Frame>
    </div>
  );
};
