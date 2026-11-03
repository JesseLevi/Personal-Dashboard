import { useState, type ReactNode } from "react";
import type { AgendaEventItem, AgendaItem, AgendaMealItem } from "@/lib/agenda/types";
import type { AssistantSignal } from "@/lib/assistant/types";
import type { BasketOption } from "@/lib/shopping/baskets";
import { AgendaDayCards, type AgendaDayCardsProps } from "./AgendaDayCards";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda day cards" } satisfies StoryDefault;

// The visual suite freezes the clock on Thursday 2026-01-01, 14:00.
const TODAY = "2026-01-01";
const NOW = "2026-01-01T14:00";
const TOMORROW = "2026-01-02";
const base = { linkCount: 0, end: null, allDay: false } as const;

const event = (id: string, title: string, start: string, end: string | null, over: Partial<AgendaEventItem> = {}): AgendaEventItem => ({
  ...base,
  kind: "event",
  source: "manual",
  calendarId: "cal-1",
  color: "blue",
  missingSince: null,
  id,
  title,
  start,
  end,
  ...over,
});

const photo = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${color}"/></svg>`)}`;

const meal = (id: string, title: string, slot: AgendaMealItem["slot"], start: string, position = 1000): AgendaMealItem => ({
  ...base,
  kind: "meal",
  id,
  title,
  slot,
  start,
  allDay: true,
  servings: 4,
  thumbnailPath: `u/recipes/${id}`,
  attached: false,
  position,
});

const todayItems: AgendaItem[] = [
  event("e0", "Verjaardag Mila", TODAY, null, { allDay: true, color: "pink" }),
  event("e1", "Standup", `${TODAY}T09:00:00`, `${TODAY}T09:15:00`, { color: "violet", source: "sync" }),
  event("e2", "Hardlopen met Sanne", `${TODAY}T12:00:00`, `${TODAY}T13:00:00`, { color: "green" }),
  event("e3", "Tandarts", `${TODAY}T13:30:00`, `${TODAY}T15:00:00`, { color: "red" }),
  event("e4", "Etentje met de buren", `${TODAY}T19:00:00`, `${TODAY}T21:30:00`),
  event("e5", "Bellen met opa", `${TODAY}T21:45:00`, null),
  meal("m1", "Tosti ham kaas", "lunch", TODAY),
  meal("m2", "Pasta pesto met geroosterde tomaten", "dinner", TODAY),
  { ...base, kind: "planned_card", id: "c1", title: "Fiets laten nakijken", start: TODAY, allDay: true, board: "Mijn bord", column: "Backlog" },
  { ...base, kind: "deadline", id: "deadline:c2", title: "Belastingaangifte", start: TODAY, allDay: true },
];

const otherItems: AgendaItem[] = [
  event("o1", "Teamoverleg", `${TOMORROW}T10:00:00`, `${TOMORROW}T11:00:00`, { color: "violet", source: "sync" }),
  event("o2", "Borrel", `${TOMORROW}T17:00:00`, `${TOMORROW}T19:00:00`, { color: "amber" }),
  meal("m3", "Risotto met paddenstoelen", "dinner", TOMORROW),
  { ...base, kind: "planned_card", id: "c3", title: "Cadeau Mila kopen", start: TOMORROW, allDay: true, board: "Mijn bord", column: "Bezig" },
];

const recipeIds = { m1: "r1", m2: "r2", m3: "r3" };
const thumbnailUrls = { r1: photo("tan"), r2: photo("indianred"), r3: photo("darkseagreen"), r4: photo("goldenrod") };
const baskets: BasketOption[] = [{ id: "own", name: "Boodschappen", shared: false }];
const noop = () => {};
const sent = async () => ({ success: true as const, data: undefined });

const signals: AssistantSignal[] = [
  {
    id: "s1",
    kind: "cook_rhythm",
    createdAt: "2025-12-31T08:00:00Z",
    text: { key: "assistant.signals.cookRhythm", values: { recipe: "Pasta pesto", median: 14, days: 20 } },
    action: { type: "link", href: "/recepten/r2", labelKey: "assistant.signals.actions.openRecipe" },
  },
  {
    id: "s2",
    kind: "pattern",
    createdAt: "2025-12-31T08:00:00Z",
    text: { plain: "Je plant op donderdag vaak een etentje." },
    action: { type: "link", href: "/agenda", labelKey: "assistant.signals.actions.open" },
  },
];

const props = (over: Partial<AgendaDayCardsProps>): AgendaDayCardsProps => ({
  day: TODAY,
  today: TODAY,
  now: NOW,
  items: todayItems,
  recipeIds,
  thumbnailUrls,
  baskets,
  onOpenItem: noop,
  onSignal: async () => ({ success: true }),
  onDayToBasket: sent,
  ...over,
});

// The real page sits on `surface-primary`; the desktop column is 20rem wide.
const Surface = ({ children }: { children: ReactNode }) => <div className="-m-8 bg-surface-primary p-8">{children}</div>;
const Column = ({ children }: { children: ReactNode }) => <div className="w-80">{children}</div>;

export const Overview = () => (
  <Surface>
    <StoryIntro
      what="The day's cards on today: timeline with past events muted and a running one marked, meals with thumbnails, planned cards and deadlines, and the basket suggestion. Six events show five and '+1 meer'."
      note="AgendaPage"
    />
    <Column>
      <AgendaDayCards {...props({ basket: { m1: false, m2: false } })} />
    </Column>
  </Surface>
);

export const OtherDay = () => (
  <Surface>
    <StoryIntro what="Another day: no past or 'Nu' marks and no assistant signals; the basket suggestion for that day's meal stays." note="AgendaPage" />
    <Column>
      <AgendaDayCards {...props({ day: TOMORROW, items: otherItems, signals, basket: { m3: false } })} />
    </Column>
  </Surface>
);

// A recipe under Koppelen is a meal attached to the event (ADR-0058 §2): the pot after the event's title, "bij <afspraak>" on the meal.
const attachedItems: AgendaItem[] = [
  event("e-bodil", "Eten met Bodil", `${TODAY}T19:00:00`, `${TODAY}T21:00:00`),
  meal("m1", "Tosti ham kaas", "lunch", TODAY),
  { ...meal("m4", "Dahl", "dinner", TODAY), attached: true, eventId: "e-bodil" },
];

export const WithAttachedMeal = () => (
  <Surface>
    <StoryIntro what="An event with a recipe on it: a small pot after its title, and the meal on the Eten card says which event it hangs on." note="AgendaPage" />
    <Column>
      <AgendaDayCards {...props({ items: attachedItems, recipeIds: { ...recipeIds, m4: "r4" }, basket: { m1: true, m4: false } })} />
    </Column>
  </Surface>
);

export const WithLinkedCard = () => (
  <Surface>
    <StoryIntro what="A card linked to an event under Koppelen joins the Te doen card as 'Gekoppeld' and opens in Te doen." note="AgendaPage" />
    <Column>
      <AgendaDayCards {...props({ linkedCards: { e3: [{ id: "k-linked", title: "Vragenlijst tandarts invullen" }] }, onOpenCard: noop })} />
    </Column>
  </Surface>
);

export const EmptyDay = () => (
  <Surface>
    <Column>
      <AgendaDayCards {...props({ day: TOMORROW, items: todayItems })} />
    </Column>
  </Surface>
);

export const Suggestions = () => (
  <Surface>
    <StoryIntro what="Suggestions are small, like a highlight Tag: the basket suggestion, and assistant signals on today." note="AgendaPage" />
    <div className="flex flex-wrap items-start gap-stack-xl">
      <Column>
        <AgendaDayCards {...props({ items: todayItems.filter((item) => item.id === "m1"), basket: { m1: false }, signals })} />
      </Column>
    </div>
  </Surface>
);

// Beside the column there is room for the planner; in a narrower container the cards are a row above it.
export const Row = () => (
  <Surface>
    <div className="w-[60rem] max-w-full">
      <AgendaDayCards {...props({ basket: { m1: false, m2: false } })} />
    </div>
  </Surface>
);

export const Loading = () => (
  <Surface>
    <Column>
      <AgendaDayCards {...props({ loading: true })} />
    </Column>
  </Surface>
);

export const Interactive = () => {
  const [opened, setOpened] = useState("nothing yet");
  return (
    <Surface>
      <p className="mb-stack-lg text-sm text-text-secondary">Tapped: {opened}. &quot;+1 meer&quot; expands the timeline; &quot;Nee&quot; hides a suggestion.</p>
      <Column>
        <AgendaDayCards {...props({ basket: { m1: false, m2: false }, signals, onOpenItem: (item) => setOpened(item.title) })} />
      </Column>
    </Surface>
  );
};
