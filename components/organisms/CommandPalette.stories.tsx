// design: Claude-designed (#686)
import { useState, type ReactNode } from "react";
import { PanelFrame, StoryIntro } from "@/.ladle/story-kit";
import { COMMAND_ACTION_IDS, type CommandAction, type CommandBoard } from "@/lib/command/types";
import type { SearchPanelAction } from "@/lib/search/panel";
import type { SearchResult } from "@/lib/search/query";
import { Button } from "../atoms/Button";
import { CommandPalette, type CommandPaletteProps } from "./CommandPalette";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Command palette" } satisfies StoryDefault;

// Dev-only mocks: the palette never imports the real "use server" modules (design/notes/CommandPalette.md).
const ACTION_DEFS: Record<(typeof COMMAND_ACTION_IDS)[number], Omit<CommandAction, "id">> = {
  "new-card": { kind: "create", icon: "Plus", href: "/te-doen?nieuw=1", pinned: true },
  "new-note": { kind: "create", icon: "Notebook", href: "/notities?nieuw=1", pinned: true },
  "new-recipe": { kind: "create", icon: "ChefHat", href: "/recepten?nieuw=1", pinned: true },
  "new-event": { kind: "create", icon: "Calendar", href: "/agenda?nieuw=1", pinned: true },
  "open-settings": { kind: "settings", icon: "Settings", pinned: true },
  "go-todo": { kind: "navigate", icon: "Columns3", href: "/te-doen", pinned: false },
  "go-agenda": { kind: "navigate", icon: "Calendar", href: "/agenda", pinned: false },
  "go-notes": { kind: "navigate", icon: "Notebook", href: "/notities", pinned: false },
  "go-recipes": { kind: "navigate", icon: "ChefHat", href: "/recepten", pinned: false },
  "go-shopping": { kind: "navigate", icon: "ShoppingBasket", href: "/winkelmand", pinned: false },
};
const actions: CommandAction[] = COMMAND_ACTION_IDS.map((id) => ({ id, ...ACTION_DEFS[id] }));

const boards: CommandBoard[] = [
  { id: "b1", name: "Verhuizing", href: "/te-doen/b1", total: 24, done: 9, isFavorite: false },
  { id: "b2", name: "Weekmenu najaar", href: "/te-doen/b2", total: 25, done: 18, isFavorite: true },
  { id: "b3", name: "Moestuin", href: "/te-doen/b3", total: 11, done: 10, isFavorite: false },
  { id: "b4", name: "November cadeaus", href: "/te-doen/b4", total: 7, done: 1, isFavorite: false },
];
const loadBoards: CommandPaletteProps["loadBoards"] = async () => ({ success: true, data: boards });

const results: SearchResult[] = [
  {
    type: "note",
    id: "n1",
    title: "Notities voor november",
    snippet: "…soep koken op zondag, de cadeaus voor Sinterklaas en iets met de tuin in het weekend…",
    href: "/notities/n1",
    score: 0.03,
  },
  { type: "recipe", id: "r1", title: "Noedelsoep met gember", snippet: null, href: "/recepten/r1", score: 0.025 },
  { type: "card", id: "c1", title: "Nootjes kopen bij de markt", snippet: "Vrijdag voor sluitingstijd", href: "/te-doen/b2?card=c1", score: 0.018 },
  {
    type: "calendar_event",
    id: "e1",
    title: "Nova's verjaardag",
    snippet: "Bij Sanne thuis",
    href: "/agenda?date=2026-11-07",
    score: 0.016,
    date: "2026-11-07",
  },
  { type: "shopping_list_item", id: "s1", title: "Noten", snippet: null, href: "/winkelmand/l1", score: 0.01 },
];

const hybrid: SearchPanelAction = async () => ({ success: true, data: { mode: "hybrid", results } });
const keyword: SearchPanelAction = async () => ({ success: true, data: { mode: "keyword", results: results.slice(0, 2) } });
const none: SearchPanelAction = async () => ({ success: true, data: { mode: "hybrid", results: [] } });
const pending: SearchPanelAction = () => new Promise(() => {});

// `PanelFrame`: the palette is `position: fixed`. Harness-only.
const Harness = ({ intro, ...props }: Partial<CommandPaletteProps> & { intro?: ReactNode }) => (
  <PanelFrame>
    {intro}
    <CommandPalette
      open
      onClose={() => {}}
      onSearch={hybrid}
      onOpen={() => {}}
      onRunAction={() => {}}
      onOpenSettings={() => {}}
      canEnableSmartSearch={false}
      autoFocusField={false}
      actions={actions}
      loadBoards={loadBoards}
      {...props}
    />
  </PanelFrame>
);

// The palette is fixed, so states cannot sit side by side: Overview shows the empty field, the rest are stories.
export const Overview = () => (
  <Harness intro={<StoryIntro what="The ⌘K palette: boards with progress and quick actions, search results once you type." note="CommandPalette" />} />
);

// Opens from a button; try typing "no", the arrow keys, Enter and Escape.
export const Interactive = () => {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState("");
  return (
    <PanelFrame>
      <div className="flex items-center gap-inline-lg">
        <Button variant="filled" onClick={() => setOpen(true)}>
          Open palette
        </Button>
        <span className="text-sm text-text-secondary">{last}</span>
      </div>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSearch={hybrid}
        onOpen={(href) => setLast(`open ${href}`)}
        onRunAction={(action) => setLast(`action ${action.id}`)}
        onOpenSettings={() => setLast("settings")}
        canEnableSmartSearch={false}
        autoFocusField
        actions={actions}
        loadBoards={loadBoards}
      />
    </PanelFrame>
  );
};

// Matches an action, a board and every search group at once.
export const Results = () => <Harness initialQuery="no" />;

export const Loading = () => <Harness initialQuery="zzz" onSearch={pending} />;

export const NoResults = () => <Harness initialQuery="zzz" onSearch={none} />;

// A member without opt-in: keyword answers plus the hint in the footer.
export const SmartSearchOff = () => <Harness initialQuery="nov" onSearch={keyword} canEnableSmartSearch />;
