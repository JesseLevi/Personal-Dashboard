import { VandaagView } from "./VandaagView";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";
import type { AgendaItem } from "@/lib/agenda/types";
import { groupToday } from "@/lib/today/day";

export default { title: "Vandaag / Vandaag page" } satisfies StoryDefault;

const items: AgendaItem[] = [
  { kind: "event", id: "e1", title: "Tandarts", start: "2026-11-02T09:00:00", end: "2026-11-02T09:30:00", allDay: false, linkCount: 0, source: "manual", calendarId: "c", color: "blue", missingSince: null },
  { kind: "event", id: "e2", title: "Verjaardag oma", start: "2026-11-02", end: null, allDay: true, linkCount: 0, source: "sync", calendarId: "c", color: "green", missingSince: null },
  { kind: "meal", id: "m1", title: "Pasta pesto", start: "2026-11-02", end: null, allDay: true, linkCount: 0, slot: "dinner", servings: 4, thumbnailPath: null, attached: false, position: 1000 },
  { kind: "planned_card", id: "c1", title: "Fietsband plakken", start: "2026-11-02", end: null, allDay: true, linkCount: 0, board: "Thuis", column: "Bezig" },
  { kind: "deadline", id: "c2", title: "Belastingaangifte", start: "2026-11-02T17:00:00", end: null, allDay: true, linkCount: 0 },
];

const noop = () => {};
const ok = async () => ({ success: true as const, data: undefined });

export const Overview = () => (
  <div className="flex flex-col gap-stack-lg">
    <StoryIntro what="Landing page: today's events, meals, planned cards and deadlines, the open basket count and new signals." note="VandaagPage" />
    <VandaagView
      today="2026-11-02"
      groups={groupToday(items)}
      basketCount={7}
      signals={[
        {
          id: "s1",
          kind: "buy_rhythm",
          createdAt: "2026-11-01T00:00:00Z",
          text: { key: "assistant.signals.buyRhythm", values: { item: "Pindakaas", median: 30, days: 34 } },
          action: { type: "add_to_basket", itemName: "Pindakaas", labelKey: "assistant.signals.actions.addToBasket" },
        },
      ]}
      baskets={[]}
      onNavigate={noop}
      onSignal={noop}
      onDayToBasket={ok}
    />
  </div>
);

export const Empty = () => (
  <VandaagView today="2026-11-02" groups={groupToday([])} basketCount={0} signals={[]} baskets={[]} onNavigate={noop} onSignal={noop} onDayToBasket={ok} />
);
