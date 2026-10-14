# AgendaEventLinks
Claude-designed (#489), ADR-0037 s4, no Figma node · Code: `app/(app)/agenda/AgendaEventLinks.tsx` ("Gekoppeld" section), `AgendaLinkSearchPanel.tsx` (+ `.stories.tsx`), `link-actions.ts` · Pure: `lib/agenda/links.ts` · Server reads: `lib/agenda/link-queries.ts`

Page-level composition like `AgendaEventPanel`; no new leaf component. The one exception is `AgendaLinkSearchPanel`: `MemberSearchPanel` is person-specific (Avatar, e-mail, a confirm step) and `IngredientSearchPanel` keeps a multi-select that writes on save, so neither fits a grouped, pick-to-link search over three tables. It copies their pattern (level-2 `SidePanel`, `InputField`, debounced search, results in `Card`).

## Anatomy
- **Gekoppeld**: a `Card` with the title, the "Koppelen" `Button` in its `settings` slot and one row per link. A row is a link (kind icon `ChefHat` / `Columns3` / `Notebook`, title, truncated) plus a compact `Button transparent` with `X` ("Ontkoppel <titel>"). Empty and loading states are plain text lines. Shown for a saved event only (not while creating), imported ones included.
- **Search panel** (`SidePanel level={2}`): `InputField` (trailing `Search`), then the hits as groups Recepten, Kaarten, Notities (`h3` + one `Card` per hit). Footer: one "Terug" button. Tapping a hit links it and closes the panel; a hit already linked is disabled with "Al gekoppeld".
- Links open the recipe (`/recepten/<id>`), the card in Te doen (`/te-doen?card=<id>`) or the note (`/notities/<id>`); a plain click uses `onNavigate` (router), a modified click keeps the browser's.

## Contract
- All optional on `AgendaEventPanel` (`onLoadLinks`, `onSearchLinks`, `onLink`, `onUnlink`, `onNavigate`): without `onLoadLinks` the section is absent, so stories and other callers need no mocks.
- `onSelect` resolves to the action result; a refusal shows inside the search panel and keeps it open. Panel state resets on close.
- A link change calls `onMutated` without closing, so the calendar's link counter (`agenda_items.link_count`, shown by `AgendaCalendarItem`) refreshes.

## Deliberate decisions
- **Unlink needs no confirm**: a link is cheap and recreated in two taps. Deleting the event or the target removes links by cascade; the target is never deleted by an unlink.
- **Search is title-only**, 5 hits per kind, `ilike`, minimum 2 characters (as `MemberSearchPanel`). RLS decides what is searchable, so shared recipes appear when the caller can read them. Note body text is not searched here (`searchNotes` does that for the notes page).
- **Errors are codes** under `agenda.errors.*`: `already-linked` (unique violation), `forbidden` (RLS: the event is not editable or an end is not readable), `not-found` (FK), else `generic`. Database text never reaches the UI.
- **Imported events**: title, time, location and description are read-only and the panel says "Uit <agendanaam>" (`calendars.name`, fallback "Uit een andere agenda"); "Gekoppeld" works as for own events.

## Token gaps and flags
- None. Row hover/active use `surface-secondary-hover/-active` as `NoteBacklinks`.
- Kind icons are borrowed from the closed set; there is no dedicated link-kind glyph.

## Gotchas
- `onSearch` is a debounce dependency: pass a stable reference (the imported action).
- Stories: `Empty`, `Results`, `WithAlreadyLinked`, `NoResults`, `SearchFailed`; the section itself is baselined through the `AgendaEventPanel` stories (`EditEvent`, `EditEventNoLinks`, `ImportedReadOnly`).
- A level-2 panel and its parent both follow the viewport on mobile; check the stacked state in a narrow window.

## Open
- Linking from the other side (a "Zet in agenda" action on a recipe, card or note) is not built; the return trip only shows the line.
