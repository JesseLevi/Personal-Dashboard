# CommandPalette
Figma: none, designed in code from the user's reference screenshots (ADR-0034, ADR-0048) · Code: `components/organisms/CommandPalette.tsx` (+ `.stories.tsx`), pure helpers in `lib/command/` (`match.ts`, `palette.ts`), types in `lib/command/types.ts`

## Why a new organism
A modal palette is not a `SidePanel`: it is centred, has no drawer shape, no drag handle and no footer actions. ADR-0048 makes it the one modal that is not a `SidePanel`. It keeps `SidePanel`'s conventions and `SearchPanel`'s search logic and keyboard model; `SearchPanel` goes away when the shell switches over.

## Anatomy
Scrim, then a dialog. Dialog = decorative "stack" layer (`bg-surface-secondary`, inset, peeks above) behind a frame (`bg-surface-primary`, `rounded-container`, `p-component-sm`) around a white body (`rounded-card`, 1 px `stroke-primary`) with three strips:
- **Field**: `Search` icon, a plain `<input>` (combobox), `Kbd` esc from `md`; below `md` an icon-only `Button` X instead.
- **List** (scrolls, max `min(60vh, 560px)`): groups with an `h3` and a count, then rows. Row = 40 px tile (`Icon`), title + meta (both truncate), optional trailing ring + percentage, and a `Kbd` ↵ slot.
- **Footer**: `Kbd` hints (↑↓ bewegen, ↵ openen, esc sluiten) from `md`, and the smart-search hint button right-aligned.

## Contract
- Props: `open`, `onClose`, `onSearch`, `onOpen(href)`, `onRunAction(action)`, `onOpenSettings`, `canEnableSmartSearch`, `autoFocusField`, `actions`, `loadBoards`, `initialQuery`. Types from `lib/command/types.ts`.
- Empty field: `Borden` (favourites first, max 4; omitted until loaded and on failure; the last list is kept across opens) and `Snelle acties` (`pinned` actions). Typing: `Acties` (translated label matches), `Borden` (name matches), then search results per module. State lines (idle, searching, failed, no results) only when nothing matched at all.
- Matching (`lib/command/match.ts`): case- and diacritics-insensitive, every query word is a prefix of some label word.
- Search: 2-character minimum, 300 ms debounce, stale responses dropped; a pre-filled query searches at once.
- Choosing a row closes the palette first, then calls `onOpen` or `onRunAction`. `loadBoards` runs on every open.

## Deliberate decisions
- **One highlight across all groups** (`moveActive`: arrows, Home, End, wrapping); focus stays in the field (`aria-activedescendant`); the first row is highlighted on every content change.
- **Plain `<input>`, not `InputField`**: that atom has no trailing node slot (Kbd, close button) and its own border and focus box; the palette's strip is a `surface-primary` bar inside the white body.
- **Scrim `bg-overlay/40`**, lighter than `SidePanel`'s /60: the palette floats and does not cover the page.
- **↵ chip only on the highlighted row**, its slot reserved (`invisible`) so rings stay aligned. No per-row ⌘ shortcuts (browsers reserve them).
- **Smart-search hint** is a short footer button ("Slim zoeken staat uit. Aanzetten?") instead of `SearchPanel`'s long line; same behaviour: closes, opens Settings. On a phone the footer only exists while the hint applies.
- **Focus**: `autoFocusField` focuses the input; otherwise the dialog itself, so a phone keeps its keyboard down. Own focus trap; focus returns to the trigger on close. Closed = `invisible` + `inert` + `aria-hidden`, `transition-discrete`, `motion-reduce:transition-none`.
- **Phone**: top-anchored, `max-md:p-component-lg` gutter, safe-area top via `max()`. The dialog root is `pointer-events-none`, so a tap in the gutter reaches the scrim.
- Board progress is `done / total` rounded; no ring when `total === 0`; green at 100 %, else blue.

## Token gaps and flags
- No sizing token: `md:w-[640px]`, `md:top-[12vh]`, `max-h-[min(60vh,560px)]`, `z-40`/`z-50` (as `SidePanel` level 1). Safe-area `max(1rem, env(...))` only adds space.
- No shadow token: separation comes from the scrim, the double frame and the stack layer.
- Dark: the stack layer (`surface-secondary`) is barely visible against the dark page; accepted.

## Gotchas
- Stories wrap in `PanelFrame` (the palette is `position: fixed`). In Ladle the scrim and the phone gutter are relative to that frame, not the viewport.
- Must not be mounted under a `transform`/`filter` ancestor (breaks `fixed`), as `SidePanel`.
- `React.useId` ids contain colons; they are only used for `aria-*` and `getElementById`.
