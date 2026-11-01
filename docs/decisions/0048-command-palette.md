# ADR-0048: ⌘K is a command palette modal, not a side panel

**Status**: Accepted (user decision, 2026-11-01), amended by ADR-0053 §6. Amends ADR-0043 §10 (the search surface) and ADR-0034 (a modal next to `SidePanel`).

## Context

- ⌘K / Ctrl+K and the Sidebar's search item open `SearchPanel`, a `SidePanel` with a field and grouped results (#581). It only searches: with an empty field it shows a prompt line.
- The user wants a centred modal in the style of a command palette (reference screenshots, 2026-11-01): a search field on top, grouped rows, a keyboard footer, and project rows with a progress ring ("72%").
- Atlas has no "projects" table. The closest thing is a Te doen board: every board has the four seeded columns `Ideeën`, `Klaar`, `Bezig`, `Afgerond` (`lib/boards/defaults.ts`); custom columns do not exist yet.
- Browsers reserve most ⌘/Ctrl + letter or digit combinations (⌘T, ⌘D, ⌘1…⌘9), so a palette cannot promise per-row shortcuts like the reference does.

## Decision

1. **`CommandPalette` replaces `SearchPanel`** in `AppShellNav`, opened by the same ⌘K guard (`isSearchShortcut`) and the Sidebar search item. `SearchPanel` and its stories are removed. The search backend (`searchAllAction`, hybrid or keyword) is unchanged.
2. **Shape**: a modal dialog (`role="dialog"`, `aria-modal`), centred on desktop at a fixed offset from the top, top-anchored with the page gutter on phones (the keyboard covers the bottom). It is built from semantic tokens and existing atoms only, and it is the one modal that is not a `SidePanel`. It keeps `SidePanel`'s conventions: stays mounted while closed (`inert`), own focus trap, focus returns on close, Escape and scrim click close, `motion-reduce` fallback.
3. **Content, in order**:
   - **Empty field**: `Borden` and `Snelle acties` (the create actions and Settings); which boards, and the `Projecten` group above them, is ADR-0053 §6 (Borden at most 3, most recent activity first).
   - **Typing**: actions (the go-to actions too) and boards whose label matches (client-side, deterministic), then the search results grouped per module as today (2-character minimum, 300 ms debounce).
   - Keyboard model unchanged: focus stays in the field, ↑/↓/Home/End move one highlight across all groups (wrapping), Enter runs or opens it.
4. **Board progress is deterministic**: `done / total` cards. `done` counts cards in the board's done columns: `board_columns.is_done` once #681 ships it, until then the last column by `position` (the seeded `Afgerond`). One pure function decides this, so the switch is one line. A board without cards shows no ring. Read through the member's RLS client; no migration, no new table.
5. **Quick actions** are a fixed registry in `lib/command/`: create a card, note, recipe or event; go to each module; open Settings. A create action navigates to its module with `?nieuw=1`, and the module opens its own existing add surface and then strips the parameter. No new write paths.
6. **Shortcut chips only for keys that work**: the footer shows ↑ ↓, ↵ and esc; a row shows a ↵ chip only while it is highlighted. No per-row ⌘-shortcuts.
7. **New atoms**: `Kbd` (the key chip, already inline in `AgendaMoreMenu`) and `ProgressRing` (SVG ring on `stroke-*`/`text-*` tokens, value 0–100, `role="img"` with a percentage label).

## Consequences

- The ⌘K surface is now a palette; later actions or result kinds (people, recents) are a new group, not a new surface.
- `?nieuw=1` becomes a small contract for each module page; a soft navigation while already on the page must still react to it.
- No shadow token exists: the modal separates from the page through the scrim and its stroke, not an elevation shadow.
