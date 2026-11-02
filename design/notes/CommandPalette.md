# CommandPalette
Figma: none, designed in code from the user's reference screenshots (ADR-0034, ADR-0048) · Code: `components/organisms/CommandPalette.tsx` (+ `.stories.tsx`), pure helpers in `lib/command/` (`match.ts`, `palette.ts`), types in `lib/command/types.ts`

## Why a new organism
A modal palette is not a `SidePanel`: it is centred, has no drawer shape, no drag handle and no footer actions. ADR-0048 makes it the one modal that is not a `SidePanel`. It keeps `SidePanel`'s conventions and the search logic and keyboard model of the `SearchPanel` it replaced (`lib/search/panel.ts`).

## Anatomy
Scrim, then a dialog. Dialog = decorative "stack" layer (`bg-surface-secondary`, inset, peeks above) behind a frame (`bg-surface-highlight-white-selected`, `rounded-container`, `p-component-sm`) around a white body (`rounded-card`, 1 px `stroke-primary`) with three strips:
- **Field**: `Search` icon, a plain `<input>` (combobox), `Kbd` esc from `md`; below `md` an icon-only `Button` X instead.
- **List** (scrolls, max `min(60vh, 560px)`): groups with an `h3` and a count, then rows. Row = 40 px tile (`Icon`), title + meta (both truncate), optional trailing ring + percentage (project rows only), and a `Kbd` ↵ slot. Highlighted row: `stroke-primary` border on `surface-secondary`.
- **Footer**: `Kbd` hints (↑↓ bewegen, ↵ openen, esc sluiten) from `md`, and the smart-search hint button right-aligned.

## Contract
- Props: `open`, `onClose`, `onSearch`, `onOpen(href)`, `onRunAction(action)`, `onOpenSettings`, `canEnableSmartSearch`, `autoFocusField`, `actions`, `loadBoards`, `loadProjects`, `initialQuery`. Types from `lib/command/types.ts`.
- Empty field: `Projecten` (cards with subtasks outside a done column, at most 3, in the order `loadProjects` returns them, most recently updated first; omitted until loaded and on failure; the last list is kept across opens), `Borden` (at most 3, in the order `loadBoards` returns them, most recently active first; favourites are not moved up; omitted until loaded and on failure; the last list is kept across opens) and `Snelle acties` (`pinned` actions). Typing: `Acties` (translated label matches), `Projecten` (title matches), `Borden` (name matches), then search results per module; a `card` hit whose id is a shown project row is dropped. State lines (idle, searching, failed, no results) only when nothing matched at all.
- Matching (`lib/command/match.ts`): case- and diacritics-insensitive, every query word is a prefix of some label word.
- Search: 2-character minimum, 300 ms debounce, stale responses dropped; a pre-filled query searches at once.
- Choosing a row closes the palette first, then calls `onOpen` or `onRunAction`. `loadBoards` runs on every open.
- **Shell** (`app/(app)/_components/AppShellNav.tsx` owns `open`; the palette never imports a server action or a router):
  - Opens from the Sidebar's search item (the mobile drawer closes first) and from ⌘K via `useSearchShortcut`, which stays blocked while the palette or Settings is open, while typing, and while another modal dialog is open.
  - `actions={COMMAND_ACTIONS}`, `loadBoards={getCommandBoardsAction}`, `loadProjects={getCommandProjectsAction}`, `onSearch={searchAllAction}`, `canEnableSmartSearch={aiAvailable && !aiEnabled}`, `autoFocusField={!narrow}`.
  - `onOpen(href)` and a `create` or `navigate` action both close the mobile drawer, then `page.go(href)` (the page transition, then `router.push`). A `settings` action, and the smart-search hint, open the Settings panel.
  - `getCommandProjects()` (`lib/command/projects.ts`): cards with at least one subtask (`card_subtasks!inner`), newest `updated_at` first, one RLS-bound round trip; the done-column rule runs in code (`isDoneColumn`, `lib/command/progress.ts`: `is_done` flag if present, else the last column by position) and the list is capped at 50. `href` is the board deep link `?card=<id>`.
  - `getCommandBoards()` (`lib/command/boards.ts`) returns every board, most recently active first: the latest of `boards.updated_at` and its cards' `updated_at` (a board without cards uses its own). One round trip: each column embeds its newest card, the sort runs in code.

## Deliberate decisions
- **One highlight across all groups** (`moveActive`: arrows, Home, End, wrapping); focus stays in the field (`aria-activedescendant`); the first row is highlighted on every content change.
- **Plain `<input>`, not `InputField`**: that atom has no trailing node slot (Kbd, close button) and its own border and focus box; the palette's strip is a `surface-primary` bar inside the white body.
- **Scrim `bg-overlay/40`**, lighter than `SidePanel`'s /60: the palette floats and does not cover the page.
- **↵ chip only on the highlighted row**, its slot reserved (`invisible`) so rings stay aligned. No per-row ⌘ shortcuts (browsers reserve them).
- **Smart-search hint** is a short footer button ("Slim zoeken staat uit. Aanzetten?") instead of a long line; it closes the palette and opens Settings. On a phone the footer only exists while the hint applies.
- **Focus**: `autoFocusField` focuses the input; otherwise the dialog itself, so a phone keeps its keyboard down. Own focus trap; focus returns to the trigger on close. Closed = `invisible` + `inert` + `aria-hidden`, `transition-discrete`, `motion-reduce:transition-none`.
- **Phone**: top-anchored, `max-md:p-component-lg` gutter, safe-area top via `max()`. The dialog root is `pointer-events-none`, so a tap in the gutter reaches the scrim.
- **Project row** = board row markup: `ListTodo` tile, meta "{done}/{total} subtaken · {board}", plus a trailing ring and percentage (`boardPercent` on subtasks): `done / total` rounded, no ring when `total === 0`, green at 100 %, else blue.
- **Board row has no ring or percentage** (user decision, 2026-11-02): progress belongs to projects; the board meta keeps its card counts.
- **Frame and highlight tokens are picked for dark mode**: the frame (`surface-highlight-white-selected`, dark stone-600) sits lighter than the body (stone-700), and the highlighted row (`surface-secondary`, dark stone-800) only a step darker. In light the frame stays stone-100 and the row is stone-200.

## Token gaps and flags
- No sizing token: `md:w-[640px]`, `md:top-[12vh]`, `max-h-[min(60vh,560px)]`, `z-40`/`z-50` (as `SidePanel` level 1). Safe-area `max(1rem, env(...))` only adds space.
- No shadow token: separation comes from the scrim, the double frame and the stack layer.
- Dark: the stack layer (`surface-secondary`) is barely visible against the dark page; accepted.

## Gotchas
- Stories wrap in `PanelFrame` (the palette is `position: fixed`). In Ladle the scrim and the phone gutter are relative to that frame, not the viewport.
- Must not be mounted under a `transform`/`filter` ancestor (breaks `fixed`), as `SidePanel`.
- `React.useId` ids contain colons; they are only used for `aria-*` and `getElementById`.
