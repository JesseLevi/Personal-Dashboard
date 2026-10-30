// design: Claude-designed (#581)
import type { ReactNode } from "react";
import { PanelFrame, StoryIntro } from "@/.ladle/story-kit";
import { SearchPanel } from "./SearchPanel";
import type { SearchPanelAction } from "@/lib/search/panel";
import type { SearchResult } from "@/lib/search/query";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Search panel" } satisfies StoryDefault;

// Dev-only mock search: the panel never imports the real "use server" module (design/notes/SearchPanel.md).
const results: SearchResult[] = [
  {
    type: "note",
    id: "n1",
    title: "Weekmenu najaar",
    snippet: "…pasta met pompoen op dinsdag, soep op donderdag en iets met de oven in het weekend…",
    href: "/notities/n1",
    score: 0.03,
  },
  { type: "recipe", id: "r1", title: "Pompoensoep", snippet: null, href: "/recepten/r1", score: 0.025 },
  { type: "recipe", id: "r2", title: "Pasta met pompoen en salie", snippet: null, href: "/recepten/r2", score: 0.02 },
  {
    type: "card",
    id: "c1",
    title: "Pompoenen kopen bij de markt",
    snippet: "Vrijdag voor sluitingstijd",
    href: "/te-doen/b1?card=c1",
    score: 0.018,
  },
  {
    type: "calendar_event",
    id: "e1",
    title: "Pompoenen snijden bij Sanne",
    snippet: "Bij Sanne thuis",
    href: "/agenda?date=2026-10-31",
    score: 0.016,
    date: "2026-10-31",
  },
  { type: "shopping_list_item", id: "s1", title: "Pompoen", snippet: null, href: "/winkelmand/l1", score: 0.01 },
];

const hybrid: SearchPanelAction = async () => ({ success: true, data: { mode: "hybrid", results } });
// A short list, so the hint line stays inside the baseline's viewport.
const keyword: SearchPanelAction = async () => ({ success: true, data: { mode: "keyword", results: results.slice(0, 2) } });
const none: SearchPanelAction = async () => ({ success: true, data: { mode: "hybrid", results: [] } });
const pending: SearchPanelAction = () => new Promise(() => {});

// `min-h-screen` wrapper: SidePanel is `position: fixed`. Harness-only.
const Harness = ({ intro, ...props }: Partial<Parameters<typeof SearchPanel>[0]> & { intro?: ReactNode }) => (
  <PanelFrame>
    {intro}
    <SearchPanel
      open
      onClose={() => {}}
      onSearch={hybrid}
      onOpen={() => {}}
      onOpenSettings={() => {}}
      canEnableSmartSearch={false}
      autoFocusField={false}
      {...props}
    />
  </PanelFrame>
);

export const Empty = () => <Harness />;

export const Loading = () => <Harness initialQuery="pomp" onSearch={pending} />;

// The panel is `position: fixed`, so states cannot sit side by side: Overview shows the
// results, the other states are separate stories.
export const Overview = () => (
  <Harness
    initialQuery="pomp"
    intro={<StoryIntro what="Search over every module from the app shell, in a pull-up panel." note="SearchPanel" />}
  />
);

export const NoResults = () => <Harness initialQuery="zzz" onSearch={none} />;

// A member without opt-in: keyword answers plus the calm line to Settings.
export const SmartSearchOff = () => <Harness initialQuery="pomp" onSearch={keyword} canEnableSmartSearch />;
